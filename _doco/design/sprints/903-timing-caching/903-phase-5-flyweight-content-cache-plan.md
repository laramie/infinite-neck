# Sprint 903 timing-caching — Phase 5: Flyweight content-node cache implementation plan

date: 20260831

## Context

[903-phase-5-D2-call-sites.md](903-phase-5-D2-call-sites.md) inventoried every `innerHTML`/`.html()`
call site touching NoteTable cells and confirmed the hot one is
[NoteTableController.js's `buildCellsFromSelector()`](../../../../NoteTableController.js#L426) at the
`obj.innerHTML = cachedHtml || cellBuilder(...)` line — the exact source of the `ParseHTML` cost measured
directly in [903-implementation-notes-ph4-6.md](903-implementation-notes-ph4-6.md).

A temporary `console.log('cached-->'+cachedHtml+'<--')` was added at that line (visible in
[NoteTableController.js](../../../../NoteTableController.js#L440) as of this writing) and a real capture
was supplied: `903-notes-for-flyweight-cache.log`. Analysis of that capture:

- **300 total cached-content log lines** for one `buildCellsForTable()` rebuild.
- **Only 24 *distinct* content strings** among those 300 lines — each one repeated **12-13 times**.
- This matches the user's observation exactly ("looks like there are 13 log rows identically in the
  loop") and confirms the theoretical ceiling discussed earlier: `cellBuilder()`'s content depends only on
  `(noteLetter, sharpflat, relNoteNum, isNut-ish CSS class variant)`, not on which physical string/fret/
  octave the cell sits at, so any tuning with more physical cells than distinct pitch-class×function
  combinations will re-render byte-identical markup over and over. For this specific tuning/key, the real
  ceiling was 24 (12 pitch classes × 2 for a `useCenterForRightFunction`-style layout variant visible in
  the captured markup), not the theoretical 204 max (which assumes `showMidiNum: true`, making the
  midi-number leaf text also vary per cell — not the case in this capture).

**No code has been changed as part of this plan.** This is a design document only, per repo SOP for
structural changes to top-level files. The diagnostic `console.log` left in
[NoteTableController.js](../../../../NoteTableController.js#L440) should be removed before any real
implementation lands (or before checkin, if it's not wanted in the interim).

## The idea, restated

Every one of those 24 (or up to ~204 in the worst case) distinct content strings is fed through
`obj.innerHTML = ...`, forcing the browser to run its full HTML parser on an ~800-byte fragment **every
single time**, even though the exact same fragment (down to the byte) has almost certainly already been
parsed earlier in this same rebuild (or a previous one). Since:

- `element.cloneNode(true)` duplicates an *already-parsed* node tree with no tokenization/tree-building at
  all, and
- the set of distinct fragments per table/key is small and bounded (a pitch-class/function-name matrix,
  not one-per-cell),

caching a **detached master DOM `Node`** per distinct content key — built once, lazily, on first use — and
cloning it on every subsequent cell that needs that same content should eliminate nearly all of the
measured `ParseHTML` cost, replacing ~200+ parses per table-rebuild with (at most) ~24 parses total,
amortized across the whole session.

This is the classic Flyweight pattern: split each cell's rendered content into **intrinsic** state (the
note spelling + function name — small, shareable, safe to cache and clone) and **extrinsic** state
(per-cell size/position — already handled by Step D1's `sizingByColumn` — and per-cell *interaction*
state like highlight/color/fingering, which is applied via class/attribute mutations on the inserted clone,
never on the shared master).

## Design: Option A (recommended) — parse once per distinct key, clone thereafter

Minimal-risk approach: keep `cellBuilder()` exactly as-is (it's a pure function returning a string, used
directly by existing tests — [note-table-controller-markup.test.js](../../../../_tests/jest/note-table-controller-markup.test.js) — and its contract shouldn't change). Add a *new* lazy node-level cache layered on
top of the existing string cache, populated from those same strings the first time each one is actually
needed.

### `NoteTableRenderCache.js`

Following the same injected-callback pattern already used for `buildCellHtml` and `buildSizing` (keeps this
module decoupled from DOM/`document` — an invariant established since phase 3, see
`/memories/repo/infinite-neck-notetable-timing.md`):

```js
// New, alongside the existing noteClassHtmlByNoteName lookup in createEntry()'s returned entry:
//   entry.contentNodeByKey = {}   // lazily populated Node cache, same key shape as getHtml()'s lookup

export function getOrBuildContentNode(entry, noteClass, midinum, buildNode) {
    if (!entry || !noteClass || typeof buildNode !== 'function') {
        return undefined;
    }
    const html = getHtml(entry, noteClass, midinum); // reuse existing string lookup (incl. __default fallback)
    if (!html) {
        return undefined;
    }
    entry.contentNodeByKey = entry.contentNodeByKey || {};
    const cacheKey = `${noteClass}:${midinum ?? ''}`;
    let master = entry.contentNodeByKey[cacheKey];
    if (!master) {
        master = buildNode(html); // caller-supplied: turns an HTML string into a detached Node, ONCE
        entry.contentNodeByKey[cacheKey] = master;
    }
    return master; // still the master -- caller MUST clone before inserting, never insert this directly
}
```

`createEntry()` needs one addition: initialize `contentNodeByKey: {}` on the returned entry object (an
empty slot, same as `sizingByColumn` starts empty and fills lazily) so the field exists for
`getOrBuildContentNode()` to populate. No eager precompute needed here (unlike `sizingByColumn`, which is
cheap to precompute for every column upfront) — content nodes should build **lazily, on first real use**,
since the actual distinct-content count observed (24) is much smaller than the theoretical max (204), and
building all 204 eagerly for every render-cache entry would waste work for combinations that never
actually appear in a given tuning/key.

Because `contentNodeByKey` lives on the same `entry` object already managed by the existing LRU
(`cache`/`evictIfNeeded()`), master nodes are automatically garbage-collected whenever their entry is
evicted — no separate cache-lifetime bookkeeping needed.

### `NoteTableController.js`

`buildCellsFromSelector()`'s hot line changes from:

```js
var cachedHtml = NoteTableRenderCache.getHtml(renderCacheEntry, noteClass, midinum);
obj.innerHTML = cachedHtml || cellBuilder(noteLetter, sharpflat, noteNum, options, midinum);
```

to (falling back to the current behavior whenever no cache entry is available, e.g. render cache disabled):

```js
var contentNode = NoteTableRenderCache.getOrBuildContentNode(renderCacheEntry, noteClass, midinum, parseHtmlToNode);
if (contentNode) {
    obj.replaceChildren(contentNode.cloneNode(true));
} else {
    obj.innerHTML = NoteTableRenderCache.getHtml(renderCacheEntry, noteClass, midinum)
        || cellBuilder(noteLetter, sharpflat, noteNum, options, midinum);
}
```

with a small new local helper (this is where the one-time-per-key `ParseHTML` cost still happens, but only
once per distinct key ever, not once per cell):

```js
function parseHtmlToNode(html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstElementChild; // the <div class='NoteDisplay'>...</div> root
}
```

### Why this is lower-risk than Step D2

- **The `<td>` loop shape is completely unchanged** — still one iteration per matched cell, same node
  identity, same attributes untouched. This is the same safety property Step D1 already relied on.
  `installTDNoteClick()`'s per-`<td>` click bindings and `replayTable()`'s attribute-based overlay
  re-queries are unaffected, since neither depends on what's *inside* a `<td>`, only on the `<td>` itself.
- Post-insertion mutations already operate on the inserted descendant elements by class
  (`.namedNote`, `.singleNote`, `.Fingering`, etc. — see
  [colorNoteInner()](../../../../NoteTableController.js#L514) and
  [replayTable()](../../../../NoteTableController.js#L1119)), not on any shared object reference, so they
  naturally apply to each cell's own clone with zero cross-contamination risk. A cloned node is a fully
  independent tree from the moment `cloneNode(true)` returns.
- A live DOM `Node` can only be attached in one place at a time — as long as the code always clones the
  master and inserts the *clone* (never the master itself, which the design above enforces by construction
  since `getOrBuildContentNode()` always returns the same cached master reference), there's no risk of two
  `<td>`s fighting over one node.

## Design: Option B (not recommended for a first cut) — no HTML parsing at all, ever

A more aggressive version of the same idea, matching your "build the node, set its known child text
nodes, then clone" suggestion literally: instead of building `cellBuilder()`'s string and parsing it once
per distinct key (Option A), build **one single hardcoded master structure programmatically** via
`document.createElement(...)`/`appendChild(...)` calls (mirroring `cellBuilder()`'s current string-concat
shape), keeping direct references to the specific leaf nodes that vary (the `.enharmonicName` text node,
the `.CenterCell` cell-content nodes, the midi-number spans). Then for each of the ~24 (or up to 204)
distinct variants, clone that ONE master once, patch just the leaf `textContent` values, and cache *that*
patched clone as the per-variant master (itself cloned again per cell, as in Option A).

This would eliminate literally every `ParseHTML` call after initial page load (not even the rare
once-per-variant cost Option A still pays) — but it requires either duplicating `cellBuilder()`'s
structure in two places (string form for the existing string-returning API/tests, node form for this new
path) or restructuring `cellBuilder()` itself to build nodes instead of strings, which would break its
existing contract (`note-table-controller-markup.test.js` asserts on its string output directly). Given
Option A already targets the exact measured cost with far less surgery, **Option B is noted here as a
known future refinement, not recommended for the first implementation.**

## Testing constraints (per repo memory)

Per `/memories/repo/infinite-neck-jest.md` / this session's established practice, this repo's Jest suite
deliberately avoids JSDom/browser-behavior expectations — browser-specific behavior is validated via UI
acceptance testing and real captures, not Jest. `template.innerHTML=`/`cloneNode()` behavior is exactly
this kind of real-DOM-parser behavior, so **this feature cannot be meaningfully unit-tested in Jest** the
same way Step D1's `computeCellSizing()` pure-function logic was. What *can* be covered in Jest (pure
logic, no real DOM parser involved):

- `getOrBuildContentNode()`'s caching/lookup behavior itself (call `buildNode` exactly once per distinct
  key, return the identical cached reference on a second call for the same key, return `undefined` for a
  missing entry/noteClass) — this only needs a `jest.fn()` stub for `buildNode`, no real DOM.
- `createEntry()` initializing an empty `contentNodeByKey` object on every entry.

Everything else (does `cloneNode(true)` actually produce correct/visually-identical markup to
`innerHTML=`, is it actually faster in a real browser) needs real-browser validation — see the benchmark
artifacts below.

## Benchmark artifacts (delivered alongside this plan, no app code changed)

Two ways to validate the `cloneNode` win with real numbers before writing any real implementation code,
consistent with how every phase of this sprint has operated (measure, don't guess):

1. **[903-phase-5-flyweight-benchmark.html](903-phase-5-flyweight-benchmark.html)** — a fully standalone
   page (no server, no app needed; just open it in a browser). Embeds the **24 real content variants**
   extracted directly from `903-notes-for-flyweight-cache.log` (not synthetic data), builds an offscreen
   scratch table of configurable size (default 300 cells, matching the real capture), and benchmarks
   `innerHTML=` vs. `template`-parse-once-then-`cloneNode(true)` across multiple trials, reporting
   avg/min/max total ms and average µs/cell (directly comparable to phase 4-6's measured ~119µs/cell
   figure).

2. **[903-phase-5-flyweight-console-snippet.js](903-phase-5-flyweight-console-snippet.js)** — a
   self-contained script meant to be pasted directly into DevTools' console **while the real
   infinite-neck app is loaded with a song/Section open**, per your request to test "against the same,
   loaded DOM of the app." It reads the *actual currently-rendered* cell content from live `td.note`
   elements (whatever song/key is presently on screen — more realistic than the static embedded sample),
   clones a real `<td>` as a template (preserving its real classes/attributes so CSS selector-matching
   cost is representative), builds an offscreen/invisible scratch table from those clones, runs the same
   two-approach benchmark, prints results to the console, and cleans up its own scratch DOM afterward —
   it never touches or disturbs the live visible table.

Both report results in the same shape (`{avgMs, minMs, maxMs, perCellUs}` per approach plus a computed
speedup ratio) so results from either can be compared directly, or pasted back for further analysis the
same way console/trace captures have been shared throughout this sprint.

## Suggested next steps

1. Run the benchmark (either or both artifacts) in a real browser and share the results.
2. If the results confirm a substantial win (expected, based on the well-understood parse-vs-clone
   mechanism), implement Option A behind the existing `NOTE_TABLE_RENDER_CACHE_ENABLED` flag (no new flag
   needed — it's purely an internal representation change layered on top of the existing cache entry,
   with the same string-based fallback path already used when the cache is disabled or a key is missing).
3. Remove the temporary `console.log('cached-->'+cachedHtml+'<--')` diagnostic at
   [NoteTableController.js#L440](../../../../NoteTableController.js#L440) before or as part of that
   implementation.
4. Add the Jest-coverable pieces described above (`getOrBuildContentNode()`'s caching behavior,
   `createEntry()`'s new field), run the full suite, then validate with a fresh real-browser
   trace/console capture the same way Steps A-D1 were each validated, checking specifically for `ParseHTML`
   event counts/durations in the `buildCellsFromSelector` stack-trace slice dropping toward zero.
