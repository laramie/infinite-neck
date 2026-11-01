# Sprint 903 timing-caching — Phase 4 (continued 2): cache never actually serves hits

date: 20260831

## Context

A re-capture was taken on the same song (`practice/pentatonics-7-m-V7-in-6-keys-with-fill.json`, reloaded
fresh) after the phase-4-2 `maxEntries` bump landed
(see [903-implementation-notes-ph4-2.md](903-implementation-notes-ph4-2.md)):

- `console-timing-phase-4-2.log` / `Trace-phase-4-2.json` — "run for full transpose cycle, then timing
  started a few sections into looping on the second cycle" — i.e. deliberately testing whether keys
  revisited on a **second** pass through the cycle get served from cache.

## Investigation

`NoteTableRenderCache.stats()` now correctly reports `maxEntries: 24` (confirming the phase-4-2 fix is in
effect) and `size: 14` throughout — well under the cap, so no eviction is happening this time.

But: **`cacheState: 'hit'` appears zero times anywhere in the log** (`grep -c "cacheState: 'hit'"` → `0`),
even though the same 3 (tableID, renderCacheKeyHash) pairs repeat across every logged cycle
(`fhu48o`/`gwra1x`, `-qq882x`/`-oqj5to`, `-8ao2a0`/`v60izp`) and this capture explicitly targets the
"second cycle" revisit scenario. Every occurrence of a key change is still `cacheState: 'miss'`, costing
the same real 51.6–55.4ms per miss as before — the phase-4-2 capacity fix had **no effect** on the actual
reported behavior, because capacity was never the binding constraint in this specific reproduction (`size`
never approached `maxEntries`).

### Root cause

[`buildCellsForTable()`](../../../../infinite-neck.js#L1135) only ever **reads** from the cache
(`NoteTableRenderCache.get(renderCacheKey)`); it never calls `.set()`. The **only** place that ever
populates the cache Map is [`runNoteTablePrewarmTasks()`](../../../../infinite-neck.js#L1341), which is
only ever invoked via the `'NoteTableCache:prewarmNextSection'` event, which is only ever triggered from
[`sectionChanged()`](../../../../infinite-neck.js#L775).

The song's "full transposition cycle" workflow is driven by
[`transpose()`](../../../../infinite-neck.js#L2712) / [`transposeSong()`](../../../../infinite-neck.js#L2724) /
[`cycleThruKeys()`](../../../../infinite-neck.js#L2701), which mutate `rootID` on the current Section
directly and call `resetNoteNames()`/`fullRepaint()`/`replay()` **directly** — they never call
`sectionChanged()` and never trigger `'NoteTableCache:prewarmNextSection'`.

This means: for a song exercised primarily through key transposition (rather than sequential Section
navigation), the render cache Map is **never populated by anything**, no matter how many keys are visited
or how many times the user cycles back through them. This was already flagged as a known gap in phase-2's
[903-timing-revisited-plan-1.md](903-timing-revisited-plan-1.md#L67) item 3 ("the cache is never populated
on the live build path — only by the async prewarm"), but had not yet been fixed, and this capture is the
first hard confirmation that it's a real, user-visible cost (0 hits across two full transpose cycles, not
a rare edge case).

## Fix

[`buildCellsForTable()`](../../../../infinite-neck.js#L1135) now populates the cache itself on a live miss,
using the same `NoteTableRenderCache.createEntry()` helper the prewarm path already uses:

```js
const renderCacheEntry = renderCacheKey ? NoteTableRenderCache.get(renderCacheKey) : null;
let liveBuiltEntry = renderCacheEntry;
if (!liveBuiltEntry && renderCacheKey && tuning) {
    liveBuiltEntry = NoteTableRenderCache.createEntry({ key: renderCacheKey, tableID, sectionIndex: getSectionsCurrentIndex(), options, tuning, buildCellHtml: ... });
    if (liveBuiltEntry) {
        NoteTableRenderCache.set(renderCacheKey, liveBuiltEntry);
    }
}
```

The per-note-class rebuild loop (`buildCellsFromSelector()`) now uses `liveBuiltEntry` (which may have just
been freshly created) instead of the raw `renderCacheEntry`, so the cache also benefits the very same call
that populated it. The dump's `cacheState`/`hitCount` reporting still uses the original `renderCacheEntry`
(the pre-populate lookup result), so `'miss'` is still logged accurately for diagnostic purposes — only
future lookups of that same key become real `'hit'`s.

This makes the cache actually work regardless of which code path reaches a given (table, key) combination
— Section navigation, transpose, or any future caller — instead of only ever being useful for the narrow
"next sequential Section" prewarm window. It is a small, additive change (reusing an already-approved
helper function, no change to `buildCellsFromSelector()`'s DOM-write strategy), not the larger "whole-table
markup redesign" that remains deferred per phase-3's status notes.

## Validation

Full Jest suite passes unchanged: 65 suites / 698 tests.

## Follow-up (not done here)

- Re-capture the same "full transpose cycle, then loop on the second cycle" scenario to confirm
  `cacheState: 'hit'` now appears for repeat key visits, and that miss durations only occur once per truly
  novel key.
- Consider whether `transpose()`/`transposeSong()`/`cycleThruKeys()` should also trigger a "prewarm
  neighboring keys" idle-time hint (analogous to `'NoteTableCache:prewarmNextSection'`) now that the cache
  works from any path — lower priority since live-population already removes the *repeat*-visit cost; this
  would only help the *first* visit to each key, which still requires one real build no matter what.
