# sprint-903-timing-caching

sprint number: 903

sprint timing-caching:

date: 20260727

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: cache building of Sections html overhead.

## Sprint document locations

- phase-1:
  - [design document](903-design-chat.md) 
  - [implementation plan](903-implementation-plan-1.md) 

- phase-2: 
  - [design document](903-timing-revisited.md)
  - [Copilot report ](903-timing-revisited-plan-1.md)
  - [Copilot report](903-timing-confirmed.md)
  - [Copilot report](903-timing-confirmed-2.md)

- phase-3:
  - [implementation plan](903-implementation-plan-ph3-1.md)
  - [implementation notes](903-implementation-notes-ph3-2.md)

- phase-4:
  - [implementation notes](903-implementation-notes-ph4-1.md)
  - [implementation notes (cache capacity)](903-implementation-notes-ph4-2.md)
  - [implementation notes (cache never populated on live path)](903-implementation-notes-ph4-3.md)
  - [implementation notes (fix confirmed; real dominant cost revealed)](903-implementation-notes-ph4-4.md)
  - [Step D implementation plan](903-implementation-plan-step-D.md)

## Status

### phase-1 complete 

Done, with some code points installed for future investigation.

- 903-timing-caching
  - [903-timing-caching design chat](../design/sprints/903-timing-caching/903-design-chat.md)
  - Figure out how to get rid of loop hiccup on first beat
  - Investigate paint/rebuild optimization
  - Investigate warming up the next Section in idle time.  
  - Investigate caching possibilities
  - *IMPLEMENTED* A first implementation was done and installed.  Its caching and console messages are controlled with flags:
    - const NOTE_TABLE_RENDER_CACHE_ENABLED = true;
      - const NOTE_TABLE_RENDER_CACHE_TIMING_ENABLED = false;

### phase-2 complete
- 20260831 Reopenned phase with `903-timing-revisited.md`

- Made coding changes recommended in `903-timing-confirmed-2.md`

- relativeSection double-builds are fixed.

### phase-3

- This is a new phase following recommendations in phase-2.  The goal is to try to eliminate expensive DOM calls, including calls to jQuery.

  - From Copilot: 
      "Not implemented — the other, larger finding (>50% of cache-hit buildCells() time spent in jQuery's per-cell .html()/.css() DOM writes in buildCellsFromSelector()) is documented as a "design-level, not yet decided" redesign (batch whole-table markup into one DOM write instead of per-cell writes). Per the repo's SOP, that kind of structural change to top-level files needs its own design discussion/approval first, so I left it as-is rather than making that call unilaterally. Let me know if you want to proceed with a design doc for that next."

### phase-4 complete

- Real-world trace/dump validation of Steps A-C confirmed `buildCellsForTable()` cost is now negligible (`cacheState: 'skipped-unchanged'`), but revealed a new residual issue: `buildCells()`/`replay()` fired **twice** per Section transition.
- Root cause found via CPU-profile call-stack analysis: `syncSectionUi()` -> `displayOptionsToControls()` unconditionally called `fullRepaint()` (a full clear+resetNoteNames+showBeats cycle plus a forced synchronous reflow), immediately followed by `clearAndReplaySection()` doing the equivalent work again. This exact risk was flagged but not fixed in phase-1's `903-implementation-plan-1.md`.
- *FIXED*: `displayOptionsToControls()` now takes an optional `skipRepaint` param; `syncSectionUi()` passes `true` since `clearAndReplaySection()` (called right after in `sectionChanged()`) already performs the equivalent rebuild. See [903-implementation-notes-ph4-1.md](903-implementation-notes-ph4-1.md) for full details. Full Jest suite (65 suites/698 tests) passes.
- *CONFIRMED IN BROWSER*: a fresh real-world capture after the fix landed shows exactly one `buildCellsForTable`/`replay` cycle per Section transition (previously two), cutting the per-transition cost roughly in half (13-17ms vs ~30-38ms) and removing the extra forced synchronous reflow.
- *SECOND ISSUE FOUND AND FIXED*: a follow-up capture on a multi-key, multi-table song ("6 keys") revealed the render cache's shared global pool (`visibleTunings.length * 3` = 6 slots for 2 tables) is far smaller than the song's real working set (12 distinct table/key combos), causing genuine cache misses (45-90ms real rebuild cost, `hits: 0` throughout) on nearly every key change even when revisiting a previously-seen key. Bumped the per-table budget to `* 12` (comfortably covers a full chromatic cycle). See [903-implementation-notes-ph4-2.md](903-implementation-notes-ph4-2.md). Full Jest suite (65/698) still passes.
- *THIRD ISSUE FOUND AND FIXED*: a re-capture deliberately testing "revisit a key on the second cycle" still showed `hits: 0` throughout, even with ample cache capacity (`size:14 < maxEntries:24`, no eviction). Root cause: `buildCellsForTable()` only ever *read* from the cache; only the async next-section prewarm (triggered from `sectionChanged()`) ever called `.set()`. This song's key-transposition workflow (`transpose()`/`cycleThruKeys()`) bypasses `sectionChanged()` entirely, so the cache was never populated for any key reached that way, no matter how many times revisited. *FIXED*: `buildCellsForTable()` now populates the cache itself on a live miss using the existing `NoteTableRenderCache.createEntry()` helper, so any future lookup of that key (from any code path) becomes a real hit. See [903-implementation-notes-ph4-3.md](903-implementation-notes-ph4-3.md). Full Jest suite (65/698) still passes.
- *FIX CONFIRMED, REVEALS TRUE DOMINANT COST*: a follow-up capture shows the live-populate fix working (`misses: 0`, `hits` climbing 0->30, `cacheState: 'hit'` now actually occurs). However, a cache *hit* still costs ~50-62ms -- essentially the same as a miss -- because `buildCellsFromSelector()` still runs its full per-cell jQuery `.html()`/`.attr()`/`.css()` write loop on every hit; the cache only ever avoided `cellBuilder()` string-generation cost, not DOM-mutation cost. This confirms, with real numbers, phase-2's original "whole-table markup" finding (previously theoretical, deferred as phase-3's Step D). No code change made; see [903-implementation-notes-ph4-4.md](903-implementation-notes-ph4-4.md) for the full writeup and recommendation -- a design discussion is needed before attempting Step D per repo SOP for top-level file changes.- *STEP D IMPLEMENTATION PLAN WRITTEN*: [903-implementation-plan-step-D.md](903-implementation-plan-step-D.md) proposes splitting Step D into D1 (cache per-column sizing, apply content+sizing via raw DOM writes instead of jQuery, same `<td>` identity preserved -- low risk, no click-handler/overlay-requery impact) and D2 (full whole-tbody markup replace -- deferred, higher risk since it requires re-scoping `installTDNoteClick()` and guaranteeing overlay-requery attribute compatibility). D1 is recommended as the next actionable step; no code written yet, plan only.
- New implementation plan for phase-3: `903-implementation-plan-ph3-1.md`

- **phase-3 Steps A-C implemented** — see [903-implementation-notes-ph3-2.md](903-implementation-notes-ph3-2.md):
  - Step A: skip the entire per-cell rebuild for a table when its render-cache key hasn't changed since the last paint (new `NoteTableRenderCache.wasLastPainted`/`recordPainted`/`clearPaintedTracking`).
  - Step B: piano-skeuomorphic table-level CSS custom properties now written once per table per rebuild, not once per matched `<td>`.
  - Step C: one DOM query per table for `td.note`, filtered in-memory per note-class, instead of 12 separate DOM queries.
  - Full Jest suite: 65 suites / 698 tests passing.
  - Step D (whole-table single-write batched markup) remains deferred pending re-measurement.
  - Not yet done: re-capture console dump/DevTools trace to measure the real-world effect, and manual UI acceptance testing for visual regressions.

