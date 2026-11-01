# Sprint 903 timing-caching — Phase 4 (continued 3): fix confirmed, but reveals the real dominant cost

date: 20260831

## Context

Re-capture on the same song/scenario after the phase-4-3 "populate cache on live miss" fix landed
(see [903-implementation-notes-ph4-3.md](903-implementation-notes-ph4-3.md)):
`console-timing-phase-4-3.log` / `Trace-phase-4-3.json`.

## Fix confirmed working

- `cacheState: 'miss'` now appears **zero times** in the log (previously every repeat key visit was a
  miss).
- `cacheState: 'hit'` appears **14 times**.
- `NoteTableRenderCache.stats().hits` climbs steadily from `0` up to `30` across the capture (previously
  stuck at `0` for the entire session, every time, in both prior captures).
- `size` reaches and holds at `24` (== `maxEntries`, confirming the phase-4-2 capacity bump is also doing
  its job — the working set now fits and stays resident).

This confirms the phase-4-3 fix (populate `NoteTableRenderCache` from the live `buildCellsForTable()` path,
not just the async prewarm) works exactly as intended: revisited keys are now served from cache instead of
being permanently-guaranteed misses.

## New finding: a cache *hit* still costs ~50ms

Despite the cache now genuinely being consulted and hit, **`cacheState: 'hit'` durations are 50.4–62.5ms**
— statistically indistinguishable from the 45.7–91.9ms `'miss'` durations measured in the phase-4-2
capture, before this fix existed. Caching the `cellBuilder()` HTML strings therefore saved essentially
none of the wall-clock cost for this song's key-transposition workflow.

By contrast, `cacheState: 'skipped-unchanged'` entries (Step A from phase 3 — the same key already
painted into that table's DOM) cost **0–0.2ms**, confirming the DOM is genuinely untouched in that case.

The gap between `'hit'` (~50ms) and `'skipped-unchanged'` (~0ms) is entirely inside
[`buildCellsFromSelector()`](../../../../NoteTableController.js#L373): on a `'hit'`, the function still
runs its full per-cell loop — `cell.html(cachedHtml)` plus `cell.attr("fontMultiplier", ...)`,
`cell.children(".NoteDisplay").css(...)`, `cell.css(...)` — once per matched `<td>`, per note-class
selector (12 specs/table). The cache only ever removed the `cellBuilder()` HTML-string *generation* work,
not the actual DOM-mutation work, which was already identified as the dominant cost back in phase-2's
[903-timing-revisited-plan-1.md](903-timing-revisited-plan-1.md#L61) item 1 ("**>50% of cache-hit
buildCells() time spent in jQuery's per-cell `.html()`/`.css()` DOM writes**... not string-building") and
listed in phase-3's plan as the deferred, not-yet-decided **Step D** ("whole-table single-write markup").

This capture is the first time that theoretical finding has been reproduced with concrete, live numbers:
a genuine cache **hit** for a previously-unseen-this-fix code path (key transposition) still costs
essentially the same wall-clock time as a **miss** did, because the per-cell jQuery write loop dominates
regardless of whether the HTML came from cache or was freshly built.

## No code change made in this note

Per repo SOP, structural changes to top-level files like `NoteTableController.js`/`infinite-neck.js`
(here: batching `buildCellsFromSelector()`'s per-cell writes into one per-table write) need a design
discussion/decision first — this is exactly the deferred Step D from
[903-implementation-plan-ph3-1.md](903-implementation-plan-ph3-1.md), and phase-3's own status notes
already declined to make that call unilaterally. This document only records the now-confirmed real-world
evidence for that decision; no implementation was attempted here.

## Status / recommendation

- The render-cache mechanism itself (key composition, prewarm, live-populate, capacity, skip-if-unchanged)
  is now working correctly end-to-end for both Section-navigation and key-transposition workflows.
- The remaining ~50ms-per-table cost on any *first* visit to a new (table, key) combination — and, as this
  capture shows, on a *cache-hit-but-DOM-still-stale* visit too — is real, measured, and squarely
  attributable to `buildCellsFromSelector()`'s per-cell jQuery DOM writes, not to any caching gap.
- If this cost is still worth addressing (it may already be acceptable — 50ms is not the ~90ms worst case
  seen for misses, and only 14 such hits occurred across this whole capture), the next actionable step
  would be a design discussion for Step D: batch each table's markup into a single DOM write (e.g. building
  one HTML string per table and using one `.html()`/`innerHTML=` call) instead of the current per-note-class,
  per-cell write loop — noting the known complication flagged in phase-3's plan that
  `installTDNoteClick()` binds click handlers directly per-`<td>` (not delegated), so a wholesale markup
  swap would need a re-binding strategy.
