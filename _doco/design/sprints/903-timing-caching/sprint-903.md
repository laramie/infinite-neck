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
  - [implementation notes (Step D1 implemented)](903-implementation-notes-ph4-5.md)
  - [implementation notes (Step D1 confirmed insufficient; real cost is per-cell innerHTML parsing)](903-implementation-notes-ph4-6.md)

- phase-5 (prep for Step D2):
  - [innerHTML/.html() call-site inventory](903-phase-5-D2-call-sites.md)
  - [Flyweight content-node cache implementation plan](903-phase-5-flyweight-content-cache-plan.md)
  - [standalone benchmark page (innerHTML vs cloneNode, real captured content)](903-phase-5-flyweight-benchmark.html)
  - [console-pasteable benchmark snippet (run against the live app)](903-phase-5-flyweight-console-snippet.js)
  - [implementation notes (Flyweight re-validated in browser)](903-implementation-notes-ph5-1.md)
  - [implementation notes (prewarmSection setup deferred)](903-implementation-notes-ph5-3.md)
  - [implementation notes (predictive section-transition lead)](903-implementation-notes-ph5-4.md)
  - [implementation notes (real-world acceptance capture, sprint closed for now)](903-implementation-notes-ph5-5.md)

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
- *FIX CONFIRMED, REVEALS TRUE DOMINANT COST*: a follow-up capture shows the live-populate fix working (`misses: 0`, `hits` climbing 0->30, `cacheState: 'hit'` now actually occurs). However, a cache *hit* still costs ~50-62ms -- essentially the same as a miss -- because `buildCellsFromSelector()` still runs its full per-cell jQuery `.html()`/`.attr()`/`.css()` write loop on every hit; the cache only ever avoided `cellBuilder()` string-generation cost, not DOM-mutation cost. This confirms, with real numbers, phase-2's original "whole-table markup" finding (previously theoretical, deferred as phase-3's Step D). No code change made; see [903-implementation-notes-ph4-4.md](903-implementation-notes-ph4-4.md) for the full writeup and recommendation -- a design discussion is needed before attempting Step D per repo SOP for top-level file changes.
- New implementation plan for phase-3: `903-implementation-plan-ph3-1.md`
- *phase-3 Steps A-C IMPLEMENTED* — see [903-implementation-notes-ph3-2.md](903-implementation-notes-ph3-2.md):
  - Step A: skip the entire per-cell rebuild for a table when its render-cache key hasn't changed since the last paint (new `NoteTableRenderCache.wasLastPainted`/`recordPainted`/`clearPaintedTracking`).
  - Step B: piano-skeuomorphic table-level CSS custom properties now written once per table per rebuild, not once per matched `<td>`.
  - Step C: one DOM query per table for `td.note`, filtered in-memory per note-class, instead of 12 separate DOM queries.
  - Full Jest suite: 65 suites / 698 tests passing.
  - Step D (whole-table single-write batched markup) remains deferred pending re-measurement.
  - Not yet done: re-capture console dump/DevTools trace to measure the real-world effect, and manual UI acceptance testing for visual regressions.
- *STEP D IMPLEMENTATION PLAN WRITTEN*: [903-implementation-plan-step-D.md](903-implementation-plan-step-D.md) proposes splitting Step D into D1 (cache per-column sizing, apply content+sizing via raw DOM writes instead of jQuery, same `<td>` identity preserved -- low risk, no click-handler/overlay-requery impact) and D2 (full whole-tbody markup replace -- deferred, higher risk since it requires re-scoping `installTDNoteClick()` and guaranteeing overlay-requery attribute compatibility). D1 is recommended as the next actionable step; no code written yet, plan only.
- *STEP D1 IMPLEMENTED*: `NoteTableRenderCache.createEntry()` now accepts an optional `buildSizing` callback that precomputes a per-column `sizingByColumn` map (both nut and non-nut variants), keyed by **displayed** `cellcol` via `getDisplayedCellcol()` (a reverse-tuning correctness issue not anticipated in the plan doc was caught and fixed during implementation). `NoteTableController.js` gained an exported `computeCellSizing()` (extracted from the old per-cell sizing math) and `buildCellsFromSelector()` was rewritten to use raw `getAttribute`/`classList`/`innerHTML`/`style`/`setAttribute` DOM calls instead of jQuery, looking up sizing from the cache with a `computeCellSizing()` fallback. `infinite-neck.js` wires a `buildSizing` callback into both `createEntry()` call sites (live-populate and prewarm). Step D2 remains deferred per the user's instruction. See [903-implementation-notes-ph4-5.md](903-implementation-notes-ph4-5.md). Full Jest suite (65 suites/707 tests, incl. 9 new tests for the sizing cache and `computeCellSizing()`) passes. Not yet done: real-world browser re-capture to confirm the expected wall-clock improvement on cache hits.
- *STEP D1 RE-CAPTURE: CONFIRMED WORKING BUT INSUFFICIENT, REAL ROOT CAUSE ISOLATED*: a fresh capture (`Trace-20260831T154722.json` / `localhost-1788216563626.log`) shows `cacheState: 'hit'` durations improved only modestly, from ~50-62ms (phase 4-4) to ~37-43ms -- a ~20-25% reduction, not the order-of-magnitude drop expected toward `'skipped-unchanged'`'s ~0-0.2ms. Trace analysis (filtering `traceEvents` for JS stacks containing `buildCellsFromSelector`) isolated the real dominant cost directly: every one of ~408 events in a representative cache-hit cluster is a **`ParseHTML`** event -- one per matched `<td>` per note-class selector -- summing to ~48ms of a ~79ms cluster span (avg ~119us/call), with all other JS work in that window totaling only ~3.4ms. This proves the true bottleneck was never jQuery wrapper/traversal overhead (which Step D1 removed) but the fact that **any** `innerHTML=` assignment (jQuery's `.html()` or raw DOM) forces the browser to spin up its HTML parser once per call; doing this ~200+ times per table pays that fixed per-call overhead ~200+ times over instead of once. See [903-implementation-notes-ph4-6.md](903-implementation-notes-ph4-6.md). No code change made in this note -- Step D2 (batch each table's markup into one write instead of one per cell) is now the actual, evidence-backed fix for this cost; awaiting explicit approval to proceed per repo SOP for top-level file changes.

### phase-5 (Flyweight content-node cache, in progress)

- [903-phase-5-D2-call-sites.md](903-phase-5-D2-call-sites.md): inventoried every `innerHTML`/`.html()` call site touching NoteTable cells to prepare for a Step D2 discussion; confirmed the hot one is `buildCellsFromSelector()`'s `obj.innerHTML = cachedHtml || cellBuilder(...)` line, and pulled a real sample of `cellBuilder()`'s ~800-byte output to see its shape directly.
- A temporary diagnostic `console.log('cached-->'+cachedHtml+'<--')` was added at that line and a real capture (`903-notes-for-flyweight-cache.log`) was supplied: **300 total per-cell rebuild lines resolved to only 24 distinct content strings**, each repeated 12-13 times -- confirming directly (not just theoretically) that `cellBuilder()`'s content is a small, shareable, cacheable set (a pitch-class x function-name matrix), not one-per-cell.
- This led to a **Flyweight pattern proposal** (separate from Step D2's whole-tbody-batching idea, and lower-risk): instead of caching HTML *strings* and re-`innerHTML`-parsing them every cell (Step D1's remaining cost per phase 4-6), cache a detached master DOM **Node** per distinct content key -- built once via a one-time HTML-string parse -- and `cloneNode(true)` it onto every cell needing that content, skipping the browser's parser entirely on every use after the first. Same `<td>` loop shape as Step D1 (zero risk to `installTDNoteClick()`/`replayTable()`'s per-`<td>` assumptions), unlike Step D2's whole-tbody replace.
- Full design written up in [903-phase-5-flyweight-content-cache-plan.md](903-phase-5-flyweight-content-cache-plan.md) (Option A: parse-once-then-clone, recommended; Option B: fully programmatic master-node construction with text-node patching, no parsing at all, noted as a further future refinement).
- Two benchmark artifacts delivered (no app code changed) to validate the `cloneNode` win with real numbers before implementing, per this sprint's "measure, don't guess" pattern: [903-phase-5-flyweight-benchmark.html](903-phase-5-flyweight-benchmark.html) (standalone page, embeds the real 24 captured content variants, no app/server needed) and [903-phase-5-flyweight-console-snippet.js](903-phase-5-flyweight-console-snippet.js) (paste into DevTools console while the live app is loaded; benchmarks against whatever content is actually currently rendered).
- **Benchmarks run, results confirm the win**: standalone-page runs against a vanilla 4-section song and against `pentatonics-7-m-V7-in-6-keys-with-fill.json` (many plugins/transpositions/fills/key changes, 150 distinct variants) both showed `cloneNode` ~3.5x faster (avg ~41ms -> ~12ms for 300 cells, ~138us/cell -> ~40us/cell). The live-app console-snippet run against the real rendered DOM (24 real distinct variants, 300 cells) showed an even larger **~4.4x speedup**: `innerHTML=` avg 21.37ms (71.2us/cell) vs `cloneNode(true)` avg 4.9ms (16.3us/cell).
- **Option A implemented** (Option B explicitly declined by the user -- with only ~24 real distinct variants observed, per-cell text-node patching was judged unnecessary complexity over caching the whole parsed node): [NoteTableRenderCache.js](../../../../NoteTableRenderCache.js) gained `getOrBuildContentNode(entry, noteClass, midinum, buildNode)` plus a lazily-populated `entry.contentNodeByKey` field (initialized empty in `createEntry()`); [NoteTableController.js's `buildCellsFromSelector()`](../../../../NoteTableController.js#L426) now calls it with a new local `parseHtmlToNode()` helper (a throwaway `<template>` parse, paid once per distinct key) and inserts via `obj.replaceChildren(contentNode.cloneNode(true))`, falling back to the original string-based `innerHTML=` path whenever no cached master is available (render cache disabled, or a missing key). The temporary diagnostic `console.log('cached-->'+cachedHtml+'<--')` was removed as part of this change. Added Jest coverage in [note-table-render-cache.test.js](../../../../_tests/jest/note-table-render-cache.test.js) for `getOrBuildContentNode()`'s pure caching/lookup behavior and `createEntry()`'s new `contentNodeByKey` field (3 new tests); full suite passes at 65 suites / 710 tests.
- **Re-validated in a real browser** ([903-implementation-notes-ph5-1.md](903-implementation-notes-ph5-1.md), `Trace-flyweight-pentatonics.json` / `console-flyweight-pentatonics.log`, same multi-key stress song as phase 4-2): `cacheState:'hit'` durations dropped from phase 4-6's ~37-43ms to **avg 10.2ms (9.5-11.0ms)** -- a ~3.7-4.2x reduction, matching the ~3.5-4.4x predicted by the pre-implementation benchmarks. Trace-level confirmation: **0 `ParseHTML` events** anywhere in the trace have `buildCellsFromSelector` in their stack (was ~408 events/~48ms in phase 4-6's representative cluster) -- the parser cost is gone from the hot path. CPU-profile self-time shows `replaceChildren` (the new clone-based insert) costs only ~36ms across the whole session; remaining per-cell costs (`querySelectorAll`/`setAttribute`/`getAttribute`/`style`, unrelated to HTML parsing) are noted as a possible future optimization target, out of scope for this phase.

### phase-5-3 (Section-boundary looper delay: prewarmSection setup deferred)

- User added `#realtimeTickStart` (divQuick, index.html) span updates + `[LooperRealtimeTick]` console logging in `looper.js` (once per beat tick, before `tickBeat()` runs) to independently observe wall-clock tick timing against the LooperLight paint flash.
- Real captures (`console-section-kickoffs.log`, `section-kickoffs.csv`, `transport-timing.csv`) confirmed: `[Violation] 'setTimeout' handler took Nms` entries at Section boundaries match the user's measured "Section delay" figures (229/234/432ms) to within 1ms. `[NoteTableTiming] prewarmSection durationMs` values (173.7/252/256.8ms) from the same captures showed `prewarmSection`'s own cost was often the single largest contributor. Root cause: `EventBus.trigger()` is synchronous, so `sectionChanged()` -> `NoteTableCache:prewarmNextSection` -> `prewarmNoteTablesForSection()`'s synchronous setup (stats dump, `setMaxEntries`, and especially `song.getVisibleTunings().map(buildPrewarmTaskForTable)` which calls `buildRenderOptionsForSection()`'s `cloneDisplayOptions`/`JSON.parse`/`stableStringify`) all ran inline inside the looper's own `setTimeout` callback -- only the per-table `createEntry()` population loop inside `runNoteTablePrewarmTasks()` was already deferred via `scheduleNoteTableCacheWork()`.
- Confirmed Visual timing mode "steals" this cost by extending the outgoing Section's last beat (no re-anchoring), while Transport timing mode (already implemented, selectable via the "Transport Timing" radio button) instead absorbs it by shortening the following beat interval (self-correcting, no drift, but the hiccup itself isn't eliminated).
- **IMPLEMENTED** the "cheaper first move" (deferring `prewarmSection`'s synchronous setup, without attempting the larger build-ahead/gated-reveal double-buffering redesign): `prewarmNoteTablesForSection()` in [infinite-neck.js](../../../../infinite-neck.js) now bumps its generation counter synchronously (preserving the existing stale-work-cancellation guard) but defers everything else (stats snapshot, `setMaxEntries`, task-list construction, `runNoteTablePrewarmTasks()`) into a `scheduleNoteTableCacheWork(...)` callback -- the same `requestIdleCallback`/`setTimeout(0)` helper already used per-table. See [903-implementation-notes-ph5-3.md](903-implementation-notes-ph5-3.md) for the full writeup. Full Jest suite: 65 suites / 711 tests passing (no dedicated new test added -- this function isn't exported/unit-tested; validating the real-world timing improvement needs a fresh browser capture, not yet done).

### phase-5-4 (predictive section-transition lead, experimental)

- User asked to try compensating for the remaining Visual-timing hiccup directly: measure how long section-transition ticks actually take, keep a moving average, and use it to schedule the next boundary tick earlier by that amount ("pre-launch"), gated by a boolean const.
- **IMPLEMENTED** in [looper.js](../../../../looper.js): new `LOOPER_PREDICTIVE_SECTION_LEAD_ENABLED` const (default `true`) gates the whole feature. `runScheduledBeatTick()` measures the actual elapsed time of `tickBeat()` whenever `tickResult.sectionTransition` is true and records it into a 5-sample sliding-window moving average (`getAverageSectionTransitionMs()`, exported). `scheduleNextBeatTick()` passes its computed delay through a new `applySectionTransitionLead()` which, when the upcoming tick is predicted to be the next section boundary (`willNextTickBeSectionBoundary()`), subtracts the current average (floored at 0) and logs `[LooperPredictiveLead] mode=... leadMs=... delayMs=... adjustedDelayMs=...`.
- **Corrected: applies in both Visual and Transport timing modes.** Initially restricted to Visual mode only, reasoning that Transport's own absolute-anchor scheduling (`looper-transport-timing.js`) would double-compensate if the lead were applied there too. After real-world validation ("it works very well"), the user challenged that restriction, and tracing `looper-transport-timing.js` confirmed the anchor (`state.nextTickAtMillis`, advanced in `afterBeatTick()` by a fixed `beatDurationMillis` each cycle) is recomputed independent of the actual delay used to fire the previous timer -- so shortening that delay cannot cause drift/creep. The two mechanisms are complementary: Transport's anchor guards against long-run clock drift, while the lead starts the known, measurable rebuild cost early enough to hide it. The Visual-mode-only early-return was removed; see [903-implementation-notes-ph5-4.md](903-implementation-notes-ph5-4.md) for the full corrected reasoning.
- See [903-implementation-notes-ph5-4.md](903-implementation-notes-ph5-4.md) for the full design writeup and rationale. Added 3 new Jest tests in [looper.test.js](../../../../_tests/jest/looper.test.js) (no-adjustment-before-first-measurement, delay-shortened-after-one-measured-transition in Visual mode using a deterministic `Date.now()` mock, and lead-also-applies-in-Transport-mode-without-creep using a separately-controlled transport clock). Full Jest suite: 65 suites / 714 tests passing.
- **Not yet done**: a fresh real-browser capture to confirm the real-world effect on the Section-delay figures measured in `console-section-kickoffs.log`/`section-kickoffs.csv` (229/234/432ms baseline), now that the lead applies in both timing modes; the larger build-ahead/gated-reveal double-buffering idea remains unimplemented and unscoped.

### phase-5-5 (real-world acceptance capture, sprint CLOSED for now)

- User supplied a fresh real-browser capture (`console-ph5-4.log`, `Trace-ph5-4.json`) taken at an aggressive **333 BPM in Transport timing mode**, plus subjective feedback: "Visually, the flow of Sections and Beats feels perfect... by and large, it is smooth and undetectable," noting it improves after the first 4-5 Section switches (the predictive-lead moving average warming up) and that only minor hiccups remain on "big tear-downs" when moving positions with ArpeggioPlugin/FillPlugin.
- Console log confirms `[LooperPredictiveLead] mode=transport ...` fires on every Section boundary as designed. At this tempo the raw nominal delay (~242ms) is smaller than the measured average transition cost (`leadMs` climbing ~246->338ms across the capture), so `adjustedDelayMs` floors at `0` every time -- the documented edge case where the lead can't fully cancel the cost, only fire the tick as early as possible. Still reported as smooth by the user. `buildCellsForTable` cache states show only `'skipped-unchanged'`/`'hit'`, no live misses.
- Trace analysis (82,292 events) confirms the phase-5 Flyweight fix still holds under this scenario: `0` of `1,875` `ParseHTML` events have `buildCellsFromSelector` in their stack. The two largest hiccups in the trace (~465ms/~488ms) are dominated by V8 major (mark-compact) garbage-collection events, not by this sprint's render/timing code (actual `Layout`/`ParseHTML`/`UpdateLayoutTree` work in those windows sums to well under 60ms) -- i.e. the remaining ArpeggioPlugin/FillPlugin hiccups the user noticed are very likely GC pauses, out of scope for this sprint.
- See [903-implementation-notes-ph5-5.md](903-implementation-notes-ph5-5.md) for the full capture analysis.
- **ACCEPTANCE CONFIRMED -- sprint 903 (timing-caching) is considered CLOSED for now.** Deferred, explicitly-not-acted-on recommendations for a possible future sprint: Step D2 (whole-tbody batched markup, superseded in practice by the phase-5 Flyweight `cloneNode` approach), explicit gating of the section-transition tick reveal (vs. only leading the timer's firing time), and the GC-pause finding above. Per the user's direction, none of these are being scheduled now -- any further looper-timing work is expected to happen as part of an upcoming **external-timing/MIDI-clock-sync sprint**, which should plug into the same `applySectionTransitionLead()` hook point identified in phase 5-4's correction, since the section-change prep cost is real regardless of what drives the beat clock.

