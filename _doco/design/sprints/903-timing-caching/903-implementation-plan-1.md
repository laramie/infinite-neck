# 903 Timing/Caching — Implementation Plan 1

## Purpose

Improve loop responsiveness at Section boundaries with the smallest practical code changes.

The specific symptom is that the first beat of a newly selected Section loses realtime clock ticks because Section transition rendering is expensive. Later beats are usually fine because beat playback mostly toggles classes.

This plan intentionally avoids hidden DOM table caches. The current DOM depends heavily on stable unique ids such as `tableID`, `tableID_captionRowTonalInfo`, and selectors rooted at `#${tableID}`. Hidden duplicate tables would create duplicate ids and risk selectors hitting cached nodes.

## Scope

Implement only the two simplest, highest-return changes:

1. Eliminate duplicate Section-transition repaint/replay work.
2. Pre-warm only the next Section's expensive note-cell rendering data during the current Section.

The cache should store pre-calculated data out of the DOM and inject/use it at table update time. The first implementation should not swap whole table DOM nodes, clone instrument nodes, or maintain hidden instrument copies.

## Current expensive path

The expensive baseline work is concentrated in the note-cell rebuild path:

1. `resetNoteNames()` gathers display/key options and calls `resetSharps()` or `resetFlats()` in [infinite-neck.js](infinite-neck.js#L718-L764).
2. `buildCells()` loops visible tunings in [infinite-neck.js](infinite-neck.js#L768-L771).
3. `buildCellsForTable()` calls `buildCellsFromSelector()` for all note classes in [infinite-neck.js](infinite-neck.js#L773-L797).
4. `buildCellsFromSelector()` selects note cells, calls `cellBuilder()`, applies `.html()`, and recalculates cell sizing in [NoteTableController.js](NoteTableController.js#L323-L389).
5. `cellBuilder()` generates nested `NoteDisplay`, `namedNote`, `tinyNote`, `singleNote`, and `Fingering` markup in [NoteTableController.js](NoteTableController.js#L223-L276).

The expensive pieces are mostly baseline note display structure and sizing, not the transient playback overlays. Playback/highlight state is already layered later by `replay()`, `replayTable()`, and `showHighlightsForBeat()` in [NoteTableController.js](NoteTableController.js#L1044-L1197) and [NoteTableController.js](NoteTableController.js#L1404-L1489).

## Current duplicate transition work

On a section loop boundary, `tickBeat()` calls `song.gotoNextSection(true)` in [looper.js](looper.js#L314-L320).

`Song.gotoNextSection()` then does both of these in [Song.js](Song.js#L1095-L1098):

- `publish_SectionChanged()`
- `requestUiClearAndReplaySection()`

The UI EventBus handlers in [infinite-neck.js](infinite-neck.js#L3216-L3245) translate those events to:

- `SectionChanged` -> `sectionChanged()`
- `SongUiClearAndReplaySection` -> `clearAndReplaySection()`

But `sectionChanged()` itself calls `clearAndReplaySection()` after `syncSectionUi()` in [infinite-neck.js](infinite-neck.js#L462-L467). So one Section transition may do redundant replay/rebuild work.

## Design principle

Make Section transition rendering a single EventBus-mediated UI transaction:

1. Model state changes once.
2. UI syncs display options once.
3. Baseline note cells rebuild once, preferably using pre-warmed cached render data.
4. Current Section overlays replay once.
5. Beat highlight for the new first beat applies once.
6. The next Section pre-warm starts after the transition completes.

## Phase 1 — Eliminate duplicate Section-transition repaint/replay

### Goal

Guarantee that Section navigation produces one clear/replay path, not two.

### Preferred approach

Use a single EventBus event for Section transition UI work.

Recommended event name:

```text
Section:changed
```

Payload shape:

```text
{
	sectionIndex,
	previousSectionIndex,
	source: 'transport' | 'song' | 'ui' | 'plugin' | 'looper',
	reason: 'next' | 'prev' | 'goto' | 'loop' | 'open-song' | 'edit',
	replay: true,
	prewarmNext: true
}
```

Keep the old `SectionChanged` event temporarily as a compatibility alias if that is less invasive, but internally route to one handler.

### Minimal code shape

1. Add a small UI transition helper in [infinite-neck.js](infinite-neck.js):

	 ```text
	 handleSectionChangedUi(data)
		 -> syncSectionUi()
		 -> clearAndReplaySection()
		 -> pluginManager.refreshPluginsMenuNode()
		 -> EventBus.trigger('NoteTableCache:prewarmNextSection', ...)
	 ```

2. Make the EventBus handler call this helper once:

	 ```text
	 EventBus.on('SectionChanged', handleSectionChangedUi)
	 ```

3. Stop pairing `publish_SectionChanged()` with `requestUiClearAndReplaySection()` for the same navigation operation.

	 For `Song.gotoNextSection()` in [Song.js](Song.js#L1095-L1098), use one of these options:

	 - Preferred: only publish the Section change event and let the UI handler do the clear/replay.
	 - Alternative: add an option to suppress `requestUiClearAndReplaySection()` when the Section change event will be published.

4. Keep direct `requestUiClearAndReplaySection()` for cases that truly are not Section changes.

### Affected paths to audit

Audit these call families and ensure each uses exactly one UI route:

- Loop section advance: [looper.js](looper.js#L314-L320) -> [Song.js](Song.js#L1095-L1098)
- Transport next/prev/goto: [transport-controller.js](transport-controller.js#L164-L198)
- Direct `Song.gotoSection()`, `Song.gotoNextSection()`, and `Song.gotoPrevSection()` in [Song.js](Song.js#L1052-L1112)
- Plugin navigation actions that call transport or song navigation

### Acceptance criteria

- On one loop Section boundary, `resetNoteNames()` runs no more than once.
- On one loop Section boundary, `replay()` runs no more than once except for intentional per-table listener/relative replay passes inside `replay()`.
- `sectionChanged()` remains the canonical UI Section-change path or is replaced by a clearly named equivalent.
- Existing EventBus architecture is strengthened, not bypassed.

### Suggested instrumentation

Add temporary counters or `performance.mark()` around:

- `sectionChanged()`
- `clearAndReplaySection()`
- `resetNoteNames()`
- `buildCellsForTable()`
- `replay()`

During validation, one Section transition should show one high-level UI transaction.

## Phase 2 — Next-Section pre-warm cache

### Goal

Use the 3-ish seconds available during a typical 4-beat Section at 80 BPM to precompute the expensive note-cell rendering data for only the next Section.

This should improve the common case without caching a whole song, duplicating DOM, or increasing code complexity too much.

### Cache concept

Create a small out-of-DOM render-data cache. Suggested module:

```text
NoteTableRenderCache.js
```

The cache stores data needed by `buildCellsFromSelector()` / `cellBuilder()` without storing live DOM nodes.

Recommended initial value type:

```text
{
	key,
	tableID,
	sectionIndex,
	noteClassHtmlByNoteName: {
		noteAb: '...',
		noteA: '...',
		...
	},
	sizingByCellSignature: optional,
	createdAt,
	hitCount
}
```

The simplest useful version caches the output strings from `cellBuilder()` for the 12 note classes for a render key. That avoids recomputing note functions, enharmonic labels, and the nested display markup. It does not avoid the `.html()` call, but it is low-risk and directly injectable.

An optional second step can cache cell sizing calculations by table/fret/piano mode if profiling shows width/font calculations are still significant.

### Render key

Use a normalized JSON-stable key. Include only baseline rendering inputs, not transient note state.

Minimum recommended fields:

```text
{
	version: 1,
	tableID,
	sharps,
	rootID,
	rootIDLead,
	noteNamesFuncArr,
	showCellNotes,
	showSubscriptFunctions,
	cellIsFunction,
	showMidiNum,
	useCenterForRightFunction,
	noteDisplayWidth,
	noteDisplayHeight,
	naturalFretWidths,
	naturalFontScaling,
	pianoHeightScaleFactor,
	pianoWidthScaleFactor,
	pianoWhiteToBlackWidthRatio,
	tuningFingerprint
}
```

Do not include:

- named notes
- played notes
- recorded notes
- current beat
- transient highlight classes
- opacity values unless profiling shows they affect baseline build output

Those are replay-layer concerns.

### Next Section selection

Provide a helper that asks the song what the next Section would be without changing state.

Suggested helper:

```text
getNextSectionIndexForPrewarm(song)
```

Rules:

- Normal loop: current index + 1, wrapping to 0 at song end.
- Random loop: either skip prewarm initially, or prewarm one randomly predicted target with low confidence.
- Manual non-loop navigation: prewarm current index + 1 after the UI settles.
- Relative-section observer tables: compute their effective relative Section for the predicted next current Section.

For random loop, this plan recommends skipping prewarm in the first implementation unless a deterministic “next random section” concept already exists. A wrong prewarm is not harmful, but it can waste the idle budget.

### EventBus integration

Use EventBus events so the cache remains loosely coupled.

Recommended events:

```text
NoteTableCache:invalidate
NoteTableCache:prewarmNextSection
NoteTableCache:prewarmSection
NoteTableCache:hit
NoteTableCache:miss
NoteTableCache:ready
```

Suggested flow:

1. After a Section UI transition finishes, [infinite-neck.js](infinite-neck.js) triggers:

	 ```text
	 EventBus.trigger('NoteTableCache:prewarmNextSection', {
		 currentSectionIndex,
		 reason: 'sectionChanged'
	 })
	 ```

2. The cache module resolves next Section render keys for visible tables.
3. The cache schedules idle/chunked precomputation.
4. At table update time, `buildCellsForTable()` asks the cache for a matching entry.
5. On cache hit, `buildCellsFromSelector()` uses cached note-class HTML strings instead of calling `cellBuilder()` for every cell.
6. On cache miss, current behavior runs and optionally stores the computed render strings.

### Scheduling

Use idle scheduling when available:

```text
requestIdleCallback(work, { timeout: 500 })
```

Fallback:

```text
setTimeout(work, 0)
```

Prewarm should be chunked by table and possibly by note class:

```text
next Section -> visible table 1 -> 12 note classes
next Section -> visible table 2 -> 12 note classes
...
```

Stop work if:

- song changes
- current Section changes before the prewarm completes
- display options change
- tuning visibility or tuning structure changes
- function symbols change
- theme/color changes only if later profiling shows it affects baseline note-cell rendering

### Injection point

Keep the injection narrow.

Preferred change:

1. Extend `buildCellsForTable(sharps, options, tableID)` in [infinite-neck.js](infinite-neck.js#L773-L797) to compute/request a render cache key.
2. Pass an optional cache entry into `buildCellsFromSelector()` in [NoteTableController.js](NoteTableController.js#L323-L389).
3. In `buildCellsFromSelector()`, replace:

	 ```text
	 cell.html(cellBuilder(...))
	 ```

	 with:

	 ```text
	 cell.html(cachedHtml || cellBuilder(...))
	 ```

4. Preserve all existing sizing and class behavior initially.

This means the first version only caches `cellBuilder()` output. It is deliberately not a wholesale rewrite of the table rendering pipeline.

### Cache invalidation

Trigger `NoteTableCache:invalidate` from these situations:

- Song open/load/append completes.
- Tunings are reinstalled or visibility changes.
- Display options are saved, deleted, or controls change in ways that affect baseline rendering.
- Function-symbol dropdown/textarea changes.
- Key/root/lead key changes.
- Piano sizing options change.
- Any operation that calls `fullRepaint()` due to baseline display changes.

The first version can simply clear the entire cache. Fine-grained invalidation can wait.

### Cache bounds

Since this plan prewarms only the next Section, the cache can stay small:

```text
maxEntries = visibleTableCount * 2 or visibleTableCount * 3
```

Keep:

- current Section render entries
- next Section render entries
- maybe the previous Section entries if cheap

Evict by oldest `createdAt` or least recently used.

## Recommended implementation sequence

### Step 1 — Add transition instrumentation

Add temporary counters/logging guarded by a verbose flag. Confirm the duplicate path before changing behavior.

Expected result before fix:

- one Section transition may show duplicate `clearAndReplaySection()` / `resetNoteNames()` calls.

Expected result after fix:

- one Section transition shows one high-level UI render transaction.

### Step 2 — Normalize SectionChanged handling

Create one handler in [infinite-neck.js](infinite-neck.js) that performs the Section-change UI sequence.

Route `SectionChanged` through this handler. Avoid also firing `SongUiClearAndReplaySection` for the same Section navigation.

### Step 3 — Add render cache module skeleton

Add `NoteTableRenderCache.js` with:

```text
buildRenderKey(context)
get(key)
set(key, value)
clear(reason)
prewarmNextSection(context)
prewarmSection(context)
```

Register EventBus listeners inside module install/init code or from [infinite-neck.js](infinite-neck.js), depending on existing style preference.

### Step 4 — Add narrow cache lookup to table rebuild

Modify only the `buildCellsForTable()` -> `buildCellsFromSelector()` path.

Do not change `TableBuilder.buildNoteTable()` in [TableBuilder.js](TableBuilder.js#L13-L217) for this phase.

### Step 5 — Prewarm next Section after transition

After the canonical Section-change UI handler completes, trigger `NoteTableCache:prewarmNextSection`.

The next Section cache should be ready long before a 4-beat, 80 BPM Section ends.

### Step 6 — Validate loop timing

Measure:

- Section transition render time
- missed beats / timing drift from transport timing state in [looper-transport-timing.js](looper-transport-timing.js#L168-L179)
- cache hit/miss count
- prewarm completion time

## Testing plan

### Jest

Add focused non-browser tests where practical:

- render key stability
- render key changes when root/sharps/function-symbol/display options change
- cache LRU/clear behavior
- next Section index calculation
- random-loop prewarm skip behavior

Keep these tests browser-light; avoid trying to validate jQuery DOM rendering in Jest unless existing patterns already support it.

### Manual/browser acceptance

Use a song with 3–6 Sections and visible 3–6 instruments.

Validate:

- Section loop no longer hiccups on the first beat as noticeably.
- Cache logs show next Section prewarm completing before transition.
- Changing key/display options invalidates cache.
- Relative-section observer tables still display the right relative key and notes.
- Manual next/prev Section navigation still works.
- Random loop either skips prewarm or behaves safely on cache miss.

## Risks and mitigations

### Risk: cached HTML is incomplete

Mitigation: cache only the exact output of `cellBuilder()` first. Keep sizing and replay code unchanged.

### Risk: stale cache after display option changes

Mitigation: first implementation clears whole cache broadly. Fine-grained invalidation is unnecessary for this sprint.

### Risk: EventBus transition behavior changes old callers

Mitigation: preserve old event names while normalizing handlers. Do not remove `SongUiClearAndReplaySection`; just stop emitting it redundantly for Section navigation.

### Risk: prewarm work steals time from active beat playback

Mitigation: schedule with `requestIdleCallback` or chunked `setTimeout`. Prewarm only one next Section. Cancel if Section changes.

### Risk: cache hit still calls `.html()` per cell

Mitigation: this is accepted for the first low-risk version. If it is not enough, the next sprint can cache detached sanitized baseline fragments or precomputed sizing, but that should be based on measurements.

## Non-goals

- Do not keep hidden duplicate note tables in the live DOM.
- Do not swap whole instrument DOM subtrees.
- Do not rewrite `TableBuilder.buildNoteTable()`.
- Do not cache a whole song in the first implementation.
- Do not add legacy song-format handling.

## Definition of done

- Section transitions trigger one clear/replay path.
- Next Section prewarm is EventBus-driven and out-of-DOM.
- `buildCellsFromSelector()` can use precomputed `cellBuilder()` output on cache hit.
- Cache invalidates safely on broad baseline-render changes.
- Instrumented loop testing shows reduced Section-boundary work and no duplicate replay/repaint transaction.
