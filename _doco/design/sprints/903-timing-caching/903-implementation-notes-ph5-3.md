# Sprint 903 timing-caching — Phase 5-3: defer prewarmNoteTablesForSection's synchronous setup

date: 20260831

## Context

A separate investigation (looper section-boundary timing, `903-implementation-notes-ph5-2.md`-equivalent
chat-only findings) found that `[Violation] 'setTimeout' handler took Nms` entries logged right at Section
boundaries (looper.js's `runScheduledBeatTick()`) match, to within 1ms, the "Section delay" figures the
user measured directly (e.g. 229ms/234ms/432ms). Cross-referencing against
`[NoteTableTiming] prewarmSection {..., durationMs: ...}` log lines (173.7ms/252ms/256.8ms) taken from the
same capture (`console-section-kickoffs.log`) showed `prewarmSection`'s own reported cost was often the
single largest contributor to that Violation window -- larger than the `buildCellsForTable` "miss" costs
for the tables actually being displayed.

Root cause: `EventBus.trigger(...)` (`event-bus.js`) invokes all registered handlers **synchronously**.
`sectionChanged()` -> `EventBus.trigger('NoteTableCache:prewarmNextSection', ...)` -> the handler at the
bottom of `infinite-neck.js` -> `prewarmNextSectionNoteTables()` -> `prewarmNoteTablesForSection()`, all run
inline, inside the same call stack as the looper's `setTimeout` callback. Only the actual per-table
`NoteTableRenderCache.createEntry()` population work inside `runNoteTablePrewarmTasks()` was already
deferred (one table per `scheduleNoteTableCacheWork()` chunk, via `requestIdleCallback`/`setTimeout(0)`).
The **setup** work directly in `prewarmNoteTablesForSection()` -- a `dumpNoteTableTiming()` stats snapshot,
`NoteTableRenderCache.setMaxEntries(...)`, and critically `song.getVisibleTunings().map(buildPrewarmTaskForTable)`
(which calls `buildRenderOptionsForSection()` per visible table -- `cloneDisplayOptions()`,
`parseNoteNamesFuncArrForOptions()`'s `JSON.parse`, and `NoteTableRenderCache.buildRenderKey()`'s recursive
`stableStringify()`) -- ran as one synchronous pass, directly inside the tick's blocking window.

## Fix

[infinite-neck.js's `prewarmNoteTablesForSection()`](../../../../infinite-neck.js) now defers everything
past its cheap early-return guards (feature-flag check, song/section-bounds check) into a
`scheduleNoteTableCacheWork(...)` callback -- the same `requestIdleCallback`/`setTimeout(0)` helper already
used per-table inside `runNoteTablePrewarmTasks()`. The generation counter
(`noteTablePrewarmGeneration`) is still bumped **synchronously** at call time (so a rapid second Section
change immediately invalidates the first change's still-pending deferred work, via the same
`generation !== noteTablePrewarmGeneration` guard `runNext()` already used), but the stats dump,
`setMaxEntries()`, task-list construction, and `runNoteTablePrewarmTasks()` call itself now all run inside
the deferred callback instead of inline.

Net effect: `sectionChanged()` (and therefore the looper's `setTimeout` handler / `tickBeat()`) now returns
as soon as the *already-required* `buildCellsForTable()` rebuild for the section that just became current
finishes, without also paying the next-section prewarm's setup cost inline. That setup cost still happens
(nothing about caching behavior changed), just on a separate task/idle slice instead of extending the
current tick's blocking window.

## Scope / what this does NOT address

This is the "cheaper first move" explicitly separated out from the bigger double-buffering/gated-reveal
redesign discussed in the same investigation (build the next Section's DOM off-screen, reveal only on the
scheduled tick) -- that remains a hand-wave-stage idea, not attempted here. This change also does not touch:

- The synchronous `buildCellsForTable()`/`replay()`/forced-reflow cost for the section that just became
  current (that work is required immediately, since it's what the user is about to see -- it's not
  prewarm, it's the live render).
- Visual vs. Transport timing-mode scheduling behavior (`looper.js`/`looper-transport-timing.js`) --
  unrelated code path.

## Testing

No existing Jest test covers `prewarmNoteTablesForSection()` directly (it isn't exported; `infinite-neck.js`
is largely covered indirectly / not unit-tested per this repo's established Jest philosophy of avoiding
JSDom/browser-timing assertions). No new test was added for this specific change since validating
`requestIdleCallback`/`setTimeout(0)` deferral timing is exactly the kind of real-browser-behavior Jest is
not used for in this repo -- this needs a fresh real-browser capture (repeating the `console-section-kickoffs.log`
methodology) to confirm the Violation/Section-delay figures shrink. Full Jest suite re-run after this change:
65 suites / 711 tests passing (no regressions; this is a pure-deferral change to a code path no test
exercises).

## Suggested next step

Capture a fresh console dump + DevTools trace during Section-loop playback (same song/methodology as
`console-section-kickoffs.log`/`section-kickoffs.csv`) and compare the `[Violation] 'setTimeout' handler`
durations and `[LooperRealtimeTick]`-derived Section delays against the pre-change baseline
(229ms/234ms/432ms) to quantify the real-world improvement.
