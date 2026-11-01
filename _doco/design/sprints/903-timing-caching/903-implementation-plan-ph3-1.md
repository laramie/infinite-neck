# 903 Timing/Caching — Phase 3 Implementation Plan: Whole-Table Caching, Piano Skeuomorphic, Per-TD Loops

## Purpose

Phase 2 ([903-timing-confirmed.md](903-timing-confirmed.md), [903-timing-confirmed-2.md](903-timing-confirmed-2.md)) quantified where cache-hit `buildCells()` time goes and fixed the relative/Tool-table double-build. This phase plans the remaining, larger recommendation from that analysis:

> "Cache and inject whole-table markup with a single batched DOM write per table... collapsing 'N cells × (1 `.html()` + 2 `.css()` + 1 `.attr()`)' into one write per table is the highest-leverage next step." — [903-timing-confirmed.md](903-timing-confirmed.md)

This document is a plan only — no code changes have been made yet.

## Code read for this plan

- [NoteTableController.js](../../../../NoteTableController.js#L353-L424) — `buildCellsFromSelector()`, the per-note-class, per-cell DOM-mutation loop.
- [infinite-neck.js](../../../../infinite-neck.js#L1070-L1138) — `buildCells()` / `buildCellsForTable()`, the live build/cache-lookup path.
- [infinite-neck.js](../../../../infinite-neck.js#L1396-L1399) — `invalidateNoteTableRenderCache()`, the existing hook for `NoteTableCache:invalidate`.
- [NoteTableRenderCache.js](../../../../NoteTableRenderCache.js) — render-key builder, per-note-class cache entries, bounded `Map`.
- [TableBuilder.js](../../../../TableBuilder.js#L85-L114) — how `<td class="note ...">` cells are constructed once, with static `midiNum`/`cellrow`/`cellcol`/`celltable` attributes baked in at table-build time (not touched afterward).
- [infinite-neck.js](../../../../infinite-neck.js#L2451-L2458) — `installTDNoteClick()`: click handlers are bound directly per `<td>` element (not delegated), and only re-installed by `reinstallAllTuningsTables()` ([infinite-neck.js](../../../../infinite-neck.js#L2220-L2229)) — i.e. once per structural table rebuild, never per beat.
- [NoteTableController.js](../../../../NoteTableController.js#L1108-L1225) — `replayTable()`, which re-applies all overlay state (named notes, played notes, highlights) from the model *after every* `buildCells()`/`replay()` cycle, regardless of what the note-content DOM currently looks like.

## Key finding that reframes the problem

`buildRenderKey()` ([NoteTableRenderCache.js](../../../../NoteTableRenderCache.js#L97-L116)) already includes every input that affects a cell's rendered content *and* its computed size for a given table: `rootID`, `rootIDLead`, `sharps`, `showCellNotes`, `cellIsFunction`, `showMidiNum`, `showSubscriptFunctions`, `useCenterForRightFunction`, `NoteDisplaySizes` (width/height), `naturalFretWidths`, `naturalFontScaling`, `pianoHeightScaleFactor`, `pianoWidthScaleFactor`, `pianoWhiteToBlackWidthRatio`, and a `tuningFingerprint` (which folds in `frets`, `rowRange`, `reverse`, `fixedFretWidthMult`, etc.). The remaining per-cell input, `cellcol`/`celltable`/`midiNum`, is a **static attribute baked into the `<td>` once** at table-build time ([TableBuilder.js](../../../../TableBuilder.js#L85-L114)) and never changes for the lifetime of that DOM node.

That means: **for a given `tableID`, the entire visual result of `buildCellsForTable()` — every cell's `.html()` content, `fontMultiplier` attr, and both `.css()` size writes — is a pure function of `renderCacheKey` alone.** Two calls to `buildCellsForTable(tableID)` with the same `renderCacheKey` are guaranteed to produce byte-identical DOM output. This is exactly what Finding 2 in [903-timing-confirmed.md](903-timing-confirmed.md) measured directly: 3 `buildCellsForTable` calls per table per Section, all cache-hit, all same key — at least 2 of those 3 are provably redundant, not just "probably fine to skip."

This gives a lower-risk path to the same payoff as whole-table markup caching: **don't touch the DOM at all when the key hasn't changed**, instead of writing a whole-table string in one shot when it *has* changed. Both are worth doing; they solve different sub-problems and this plan proposes both, in order of risk.

## Scope

1. **Step A — Skip-if-unchanged per table** (near-zero risk, highest confidence payoff). Track the last `renderCacheKey` actually painted into the DOM for each `tableID`; skip the entire `buildCellsForTable()` note-class loop when the incoming key matches.
2. **Step B — Piano Skeuomorphic: hoist per-table CSS custom properties out of the per-cell loop.** These writes target `cell.closest("table")`, not `cell` itself, so they are table-scoped, not cell-scoped, and are currently repeated once per matched `<td>` for no reason.
3. **Step C — Per-TD loop overhead: single DOM query per table instead of twelve.** `buildCellsForTable()` currently calls `buildCellsFromSelector()` once per note-class spec (12 calls), each doing its own `$(selector)` query against the live DOM. Collapse this to one query per table, bucketed by note class in JS.
4. **Step D — Whole-table single-write batched markup (deferred, design-level only in this document).** Addressed here only to record why it is not being implemented now: the risk/reward doesn't currently justify it once Steps A-C land, and it requires re-running `installTDNoteClick()` after any wholesale DOM replacement since click handlers are bound per-`<td>`, not delegated.

Each step is independently shippable and independently testable. Recommended order: A, then C, then B (B is smallest but depends on nothing; could go first too — order between B and C doesn't matter, A should land first since it changes the measurement baseline for B/C).

## Step A — Skip-if-unchanged per table

### Goal

Eliminate the ~2-out-of-3 provably-redundant `buildCellsForTable()` DOM-mutation passes identified in [903-timing-confirmed.md, Finding 2](903-timing-confirmed.md#finding-2--duplicate-build-hypothesis-item-2-in-903-timing-revisitedmd-not-exercised-in-this-capture) and confirmed again in [903-timing-confirmed-2.md, Finding 2](903-timing-confirmed-2.md#finding-2--half-of-the-double-builds-are-pure-waste-identical-cache-key-both-times).

### Design

Add last-painted-key tracking to [NoteTableRenderCache.js](../../../../NoteTableRenderCache.js), alongside the existing `Map` cache (separate concern from the HTML-string cache: this tracks what's *currently in the DOM*, not what's *available to build from*):

```js
const lastPaintedKeyByTableID = new Map();

export function wasLastPainted(tableID, key) {
	return !!tableID && !!key && lastPaintedKeyByTableID.get(tableID) === key;
}

export function recordPainted(tableID, key) {
	if (tableID && key) {
		lastPaintedKeyByTableID.set(tableID, key);
	}
}

export function clearPaintedTracking(tableID) {
	if (tableID) {
		lastPaintedKeyByTableID.delete(tableID);
	} else {
		lastPaintedKeyByTableID.clear();
	}
}
```

In `buildCellsForTable()` ([infinite-neck.js](../../../../infinite-neck.js#L1092-L1138)), short-circuit the per-note-class loop when unchanged:

```js
const renderCacheKey = (NOTE_TABLE_RENDER_CACHE_ENABLED && tableID)
	? NoteTableRenderCache.buildRenderKey({ tableID, options, tuning, noteNamesFuncArr })
	: '';

if (renderCacheKey && NoteTableRenderCache.wasLastPainted(tableID, renderCacheKey)) {
	dumpNoteTableTiming('buildCellsForTable', {
		tableID: tableID || '(all tables)',
		callSite: callSite || '(unspecified)',
		durationMs: getNoteTableTimingNow() - timingStart,
		cacheState: 'skipped-unchanged',
		renderCacheKeyHash: shortHashForLog(renderCacheKey),
		selectorCount: 0,
		sharps: !!sharps,
		rootID: options.rootID,
		rootIDLead: options.rootIDLead
	});
	return;
}

// ...existing renderCacheEntry lookup + getNoteClassSpecs(sharps).forEach(...) loop...

if (renderCacheKey) {
	NoteTableRenderCache.recordPainted(tableID, renderCacheKey);
}
```

### Invalidation — must clear `lastPaintedKeyByTableID` wherever the DOM itself is torn down/rebuilt

If a table's `<td>` elements are destroyed and recreated (e.g. `reinstallAllTuningsTables()`), stale "already painted" bookkeeping would wrongly skip a genuinely-needed rebuild against fresh, blank `<td>` elements. Wire `NoteTableRenderCache.clearPaintedTracking()` into the exact same place the existing string-cache is cleared:

- [infinite-neck.js](../../../../infinite-neck.js#L1396-L1399) `invalidateNoteTableRenderCache()` — add `NoteTableRenderCache.clearPaintedTracking()` alongside the existing `NoteTableRenderCache.clear()` call. This already fires on `NoteTableCache:invalidate`, which [infinite-neck.js](../../../../infinite-neck.js#L4677) triggers with `reason: 'ReinstallAllTuningsTables'` from `reinstallAllTuningsTables()`.

No other call site needs auditing: every other display-option toggle changes the `renderCacheKey` itself (that's the mechanism that already makes stale entries "unused, never served incorrectly" per [903-timing-revisited-plan-1.md, item 4](903-timing-revisited-plan-1.md)), so the skip check will simply see a non-matching key and rebuild normally.

### Testing

- Add unit coverage in [_tests/jest/note-table-render-cache.test.js](../../../../_tests/jest/note-table-render-cache.test.js) for `wasLastPainted()`/`recordPainted()`/`clearPaintedTracking()` (single table, multiple tables, clear-all vs. clear-one).
- Add a focused test (new file or extend an existing `note-table-controller-*.test.js`) that calls `buildCellsForTable()` twice with an identical key and asserts the note-class selector loop (and therefore `.html()`) only ran once — e.g. by spying on `NoteTableRenderCache.getNoteClassSpecs` or on the exported `buildCellsFromSelector` where the test can inject a jest mock, whichever is cheaper given existing DI seams (`setNotetableProviders`).
- Re-run the full suite: `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`.

### Risk

Very low. The skip is provably correct given the render-key composition already covers every input that affects output (see "Key finding" above). The only failure mode is a missed invalidation, which is guarded by reusing the existing, already-audited `NoteTableCache:invalidate` hook rather than inventing a new one.

## Step B — Piano Skeuomorphic: hoist per-table CSS custom properties out of the per-cell loop

### Current problem

Inside the `.each()` loop in `buildCellsFromSelector()` ([NoteTableController.js](../../../../NoteTableController.js#L353-L424)):

```js
if (pianoSkeuomorphic) {
    // ...
    cell.closest("table")
        .css("--piano-white-key-width", pianoWhiteKeyWidth)
        .css("--piano-white-to-black-width-ratio", pianoWhiteToBlackWidthRatio)
        .css("--piano-black-key-width", pianoBlackKeyWidth);
}
```

`cell.closest("table")` walks up the DOM from every single matched `<td>` to find the same `<table>` element, then writes the same three CSS custom properties to it, over and over — once per matched cell, per note-class selector call (up to 12× per table per rebuild), instead of once per table per rebuild. This was already flagged as a concern in [903-timing-revisited-plan-1.md, section 2](903-timing-revisited-plan-1.md#2-what-to-look-for-in-chrome-devtools-performance-tab) and directly implicated for `tblP46_1`'s above-average per-table cost in [903-timing-confirmed-2.md, Finding 4](903-timing-confirmed-2.md#finding-4--cpu-profile-confirms-the-same-root-cause-jquery-html-setter-not-string-building).

### Design

Move the piano-skeuomorphic table-level CSS var write out of `buildCellsFromSelector()` entirely and into `buildCellsForTable()` ([infinite-neck.js](../../../../infinite-neck.js#L1092-L1138)), computed once per table per rebuild, before the `getNoteClassSpecs(sharps).forEach(...)` loop:

```js
const tuning = tableID ? TuningsLibrary.findTuningForName(tableID) : null;
if (tuning && isPianoSkeuomorphicEnabled(tuning)) {
	applyPianoSkeuomorphicTableCssVars(tableID, options, tuning);
}
```

with a new small helper (in [NoteTableController.js](../../../../NoteTableController.js), exported alongside the existing `getPianoSkeuomorphic*` size helpers) that does the `$('#'+tableID).css(...)` write exactly once:

```js
export function applyPianoSkeuomorphicTableCssVars(tableID, options, tuning) {
	const w = options.NoteDisplaySizes.width;
	const pianoWhiteKeyWidth = getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor(w, options.pianoWidthScaleFactor) + "px";
	const pianoWhiteToBlackWidthRatio = getPianoSkeuomorphicWhiteToBlackWidthRatio(options.pianoWhiteToBlackWidthRatio);
	const pianoBlackKeyWidth = getPianoSkeuomorphicBlackKeyWidthPxForScaleFactor(w, options.pianoWidthScaleFactor, pianoWhiteToBlackWidthRatio) + "px";
	$('#' + tableID)
		.css("--piano-white-key-width", pianoWhiteKeyWidth)
		.css("--piano-white-to-black-width-ratio", pianoWhiteToBlackWidthRatio)
		.css("--piano-black-key-width", pianoBlackKeyWidth);
}
```

`buildCellsFromSelector()` keeps its existing per-cell `pianoHeight` calculation (that part genuinely varies nothing extra by hoisting — `h` is already reassigned per cell today even though its value doesn't vary either; leave that alone in this step to keep the diff minimal and focused on the `.css()` table write, which is the part actually shown to be expensive) but drops the `cell.closest("table").css(...)` chain, since the table-level vars are now set once by the caller.

Note: `buildCellsFromSelector()` is called once per note-class spec today; if Step C (below) also lands, this hoist becomes even simpler since there will only be one call into the per-cell loop per table, not twelve.

### Testing

- [_tests/jest/piano-skeuomorphic.builder.test.js](../../../../_tests/jest/piano-skeuomorphic.builder.test.js) and [_tests/jest/piano-skeuomorphic-css.test.js](../../../../_tests/jest/piano-skeuomorphic-css.test.js) already exercise CSS var computation; extend to assert the vars are set exactly once per `buildCellsForTable()` call (e.g. spy on `$.fn.css` call count for the `#tableID` selector, or assert `applyPianoSkeuomorphicTableCssVars` is called exactly once per rebuild via a DI seam).
- Re-run full suite after the change.

### Risk

Low. Pure hoist of an idempotent, per-table write; no behavior change, only fewer redundant calls doing the exact same thing.

## Step C — Per-TD loop overhead: one DOM query per table instead of twelve

### Current problem

`buildCellsForTable()` ([infinite-neck.js](../../../../infinite-neck.js#L1092-L1138)) calls `NoteTableRenderCache.getNoteClassSpecs(sharps)` (12 specs: 5 accidentals + 7 naturals) and invokes `buildCellsFromSelector()` once per spec, each doing its own jQuery selector match:

```js
NoteTableRenderCache.getNoteClassSpecs(sharps).forEach((spec) => {
	buildCellsFromSelector(tableID_prefix + `td.${spec.noteClass}`, ...);
});
```

That's 12 separate `$(selector)` calls against the live DOM per table per rebuild, each re-walking/matching the DOM independently, on top of the already-measured `.html()`/`.css()` write cost.

### Design

Collapse to a single query per table, bucket matched cells by their existing `note{Letter}` class in JS, then run one `.each()` loop:

```js
export function buildCellsForTableClasses(tableIDPrefix, sharps, options, renderCacheEntry) {
	const specsByClass = new Map(
		NoteTableRenderCache.getNoteClassSpecs(sharps).map((spec) => [spec.noteClass, spec])
	);
	const allCells = $(`${tableIDPrefix}td.note`);
	allCells.each(function () {
		const td = $(this);
		const spec = [...specsByClass.values()].find((s) => td.hasClass(s.noteClass));
		if (!spec) {
			return;
		}
		buildOneCell(td, spec, options, renderCacheEntry);
	});
}
```

— refactoring the existing per-cell body of `buildCellsFromSelector()`'s `.each()` callback into a shared `buildOneCell(td, spec, options, renderCacheEntry)` function so both the old per-selector call path (kept for any other callers, if any) and this new batched path share identical cell-painting logic. Before choosing this option, confirm `buildCellsFromSelector()` has no other callers besides `buildCellsForTable()` (a workspace-wide reference search), to decide whether to replace it outright or keep it as a thin wrapper around `buildOneCell()` for a single selector.

A cheaper, smaller-diff alternative that captures most of the win without restructuring the function signature: keep the 12 separate calls, but have `buildCellsForTable()` fetch `$(`${tableID_prefix}td.note`)` **once**, and pass the already-matched jQuery set into `buildCellsFromSelector()`, which then filters it in-memory by class instead of re-querying the DOM:

```js
const allNoteCells = $(`${tableID_prefix}td.note`);
NoteTableRenderCache.getNoteClassSpecs(sharps).forEach((spec) => {
	buildCellsFromSelector(allNoteCells.filter('.' + spec.noteClass), spec.noteLetter, spec.sharpflat, spec.noteNum, options, renderCacheEntry, spec.noteClass);
});
```

(`buildCellsFromSelector()`'s first parameter would change from "a selector string" to "a jQuery-filterable set/selector", accepting either — jQuery's `$()` already accepts a jQuery object or a selector string interchangeably, so this is a low-risk, signature-compatible change.) This keeps the existing 12-call structure and per-spec logic completely intact, changing only *how the initial cell set is obtained* — one DOM query + 12 in-memory `.filter()` calls, instead of 12 DOM queries. Recommended as the first cut given it's the smaller, lower-risk diff; the full `buildOneCell()` refactor above can follow later if profiling still shows selector-matching overhead after this change.

### Testing

- [_tests/jest/note-table-controller-markup.test.js](../../../../_tests/jest/note-table-controller-markup.test.js) already covers cell markup generation; extend to confirm identical output before/after (same `.html()` content, same classes matched) for a representative tuning.
- Add a jsdom-free assertion (per repo Jest convention of avoiding DOM/jQuery expectations) that counts calls into the DOM-query seam if one is mockable via `setNotetableProviders`-style DI, or defer to manual UI acceptance testing for the actual selector-count reduction, consistent with existing repo practice of not asserting jQuery/DOM behavior in Jest.
- Re-run full suite after the change.

### Risk

Low-medium. `.filter()` on an already-matched set is standard jQuery and behaviorally equivalent to re-querying with a compound selector, but touches a function signature (`buildCellsFromSelector`'s first argument) — audit all callers first (currently only `buildCellsForTable()`, per this document's code read) before merging.

## Step D — Whole-table single-write batched markup (deferred)

### Why this is not being scheduled yet

Once Steps A-C land:

- Step A removes the DOM-write cost entirely for any rebuild where the key hasn't changed — this was measured to be roughly 2 out of every 3 `buildCellsForTable()` calls per table per Section in the non-relative-song capture, and is the majority of the "same cost repeated every beat" problem described in [903-timing-confirmed.md, Finding 2](903-timing-confirmed.md#finding-2--duplicate-build-hypothesis-item-2-in-903-timing-revisitedmd-not-exercised-in-this-capture).
- Steps B and C reduce the remaining, genuinely-necessary rebuild's overhead (redundant table-level CSS writes, redundant DOM queries) without touching DOM structure.

A full whole-table markup cache (building one big HTML string for an entire `<tbody>`/table and swapping it in with one `.html()`/`innerHTML=` call) would still be a real further win for the *first* paint of a newly-encountered key (cache miss, or first key-change after a toggle), since that path still does N cells × 1 `.html()` + 2 `.css()` writes today. But it carries additional cost and risk not present in Steps A-C:

- **Click handlers are bound directly per-`<td>`**, not delegated ([infinite-neck.js](../../../../infinite-neck.js#L2451-L2458)). Replacing a table's `<tbody>` HTML wholesale destroys those `<td>` nodes and their bound handlers; `installTDNoteClick()` would need to be re-run after every such whole-table swap, which itself iterates and binds one handler per `<td>` — partially offsetting the win and reintroducing a per-cell loop, just a cheaper one (attaching a handler vs. building/writing markup).
- **`replay()`'s overlay layer re-queries `<td>` elements by attribute/class after every `buildCells()` cycle** ([NoteTableController.js](../../../../NoteTableController.js#L1108-L1225)) to reapply named notes, played notes, and highlights. A wholesale markup swap must guarantee those re-queries still find equivalent nodes with the same attributes (`midiNum`, `cellrow`, `cellcol`, `celltable`) in the same relative structure — solvable, but it means the cached whole-table string must be built from the *exact* same `TableBuilder.js` cell-construction logic used at initial table-build time, duplicating/sharing that logic rather than `cellBuilder()`'s narrower per-note-class output.
- The measured win from Steps A-C alone is expected to remove the large majority of the currently-measured cost (Step A alone removes ~2/3 of all rebuild calls outright); Step D's incremental win on top of that is the remaining first-paint-per-key cost, which is inherently bounded by how many distinct keys a session actually visits (small, per the original "bounded pool of rootID/rootIDLead/sharps keys" design).

### Recommendation

Land and measure Steps A-C first (re-capture a console dump + DevTools trace per the existing [903-timing-revisited-plan-1.md](903-timing-revisited-plan-1.md) instrumentation). Only pursue Step D as a follow-up phase if that re-measurement still shows first-paint/cache-miss rebuild cost as a significant remaining contributor to loop hiccups. This keeps the phase-3 diff small, safe, and independently verifiable, consistent with the repo's SOP of design discussion before touching top-level rendering code broadly.

## Rollout / flags

No new flags needed. Steps A-C are gated by the existing `NOTE_TABLE_RENDER_CACHE_ENABLED` flag (Step A's skip check is inside the same `if` that already guards `renderCacheKey` computation) and `NOTE_TABLE_RENDER_CACHE_TIMING_ENABLED` continues to control whether the richer `dumpNoteTableTiming()` payloads are logged.

## Suggested validation after implementation

1. Full Jest suite: `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`.
2. Re-capture a console dump with `NOTE_TABLE_RENDER_CACHE_TIMING_ENABLED = true` on both the non-relative-section song and the `guitar-basic-blues-fwd-back-observers` relative-section song used in [903-timing-confirmed.md](903-timing-confirmed.md) / [903-timing-confirmed-2.md](903-timing-confirmed-2.md), and confirm: `cacheState: 'skipped-unchanged'` now appears for the majority of same-Section repeat beats, and per-table `durationMs` drops accordingly.
3. Manual UI acceptance testing (per repo convention that browser/jQuery behavior is validated via UI testing, not Jest): loop a song with piano-skeuomorphic tables and relative-section Observer tables, confirm no visual regression in note names, sizing, or click-to-color behavior.
