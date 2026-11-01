# Sprint 903 timing-caching — Phase 4: fixing the duplicate full-repaint per Section transition

date: 20260831

## Context

After Phase 3 (Steps A–C, see [903-implementation-notes-ph3-2.md](903-implementation-notes-ph3-2.md)),
a fresh real-world capture was supplied for validation:

- `timing-after-steps-A-B-C.json` — a simple single-instrument song (`tblP46_1`), 4 sections, all sharing
  the same `rootID`/`rootIDLead`/`sharps` (so the render-cache key never changes across sections).
- `903-console-dump-4.txt` — live `[NoteTableTiming]` console dump captured during looped playback.
- `Trace-20260831T110917.json` — a Chrome DevTools Performance capture of the same session.

Observation: "Pretty snappy in the UI, with a small hiccup entering a new section." The goal was to find
what's still causing that hiccup now that Step A has made `buildCellsForTable()` itself nearly free
(`cacheState: 'skipped-unchanged'`, 0–0.2ms per call).

## Investigation

Console dump analysis confirmed Step A works exactly as designed: every `buildCellsForTable()` call during
looped playback reports `cacheState: 'skipped-unchanged'`.

However, the dump also showed a consistent anomaly: **every Section transition logs two
`buildCells`/`replay` cycles**, not one, despite this song having no `relativeSection` wiring (so the
Phase-1/2 double-build fix doesn't apply here).

Parsing the raw trace's `performance.mark()` entries (`buildCells:start/end`, `replay:start/end`) confirmed
the pattern precisely: cycles occur in **pairs** ~32–38ms apart, then nothing for ~6.1s (the Section's
actual play length) until the next transition. Each pair costs roughly 13–18ms per cycle, ~30ms total.

Reconstructing the CPU profile (`disabled-by-default-v8.cpu_profiler` `Profile`/`ProfileChunk` events —
note: `args.data.timeDeltas` is a **sibling** of `args.data.cpuProfile`, not nested inside it) and dumping
call stacks for every sample in the gap between the two cycles found the smoking gun:

```
fullRepaint @ NoteTableController.js:1553
  <- displayOptionsToControls @ infinite-neck.js:3120
  <- syncSectionUi @ infinite-neck.js:752
  <- sectionChanged @ infinite-neck.js:764
  <- (anonymous) @ infinite-neck.js:4655   // EventBus 'SectionChanged' handler
```

### Root cause

[sectionChanged()](../../../../infinite-neck.js#L764) calls, in order:

```js
syncSectionUi();          // -> displayOptionsToControls(options) -> fullRepaint()
clearAndReplaySection();  // -> replayCurrentSectionView() -> clearAll()+resetNoteNames()+...+showBeats()
```

[`displayOptionsToControls()`](../../../../infinite-neck.js#L3121) unconditionally called
[`fullRepaint()`](../../../../NoteTableController.js#L1546) at its end. `fullRepaint()` does:

```js
clearAll();
resetNoteNames();  // -> buildCellsForTable() + replay(), same cost as clearAndReplaySection()'s cycle
showBeats();
void wrapper.offsetWidth;  // forced synchronous reflow
```

This is **functionally a duplicate** of what `clearAndReplaySection()` → `replayCurrentSectionView()` does
right afterward (`clearAll(); resetNoteNames(); updateSectionsStatus(); showBeats();`) — except
`fullRepaint()` also adds a forced synchronous layout reflow (`void wrapper.offsetWidth`), which explains
the `UpdateLayoutTree`/`Layout`/`LocalFrameView::performLayout` work seen in the raw trace between the two
cycles.

This exact risk was actually already flagged (but not fixed) in Phase 1's
[903-implementation-plan-1.md](903-implementation-plan-1.md#L46): "if `displayOptionsToControls()` runs, it
calls `fullRepaint()` too, which calls `resetNoteNames()` again."

Every normal auto-loop Section transition therefore does the entire clear+rebuild+replay+showBeats cycle
**twice**, plus one extra forced reflow — this is the residual "hiccup," not `buildCellsForTable()` cost
(which Step A already made negligible).

## Fix

Since `clearAndReplaySection()` always runs immediately after `syncSectionUi()` inside `sectionChanged()`
and performs an equivalent (and more complete — it also calls `updateSectionsStatus()`) rebuild, the
`fullRepaint()` call triggered via `syncSectionUi()` → `displayOptionsToControls()` is redundant on the
Section-transition path.

- [`displayOptionsToControls(options, skipRepaint)`](../../../../infinite-neck.js#L3121) now accepts an
  optional `skipRepaint` flag; when true, the trailing `fullRepaint()` call is skipped.
- [`syncSectionUi()`](../../../../infinite-neck.js#L752) now calls
  `displayOptionsToControls(cloneDisplayOptions(options), true)`, skipping the redundant repaint, since
  `clearAndReplaySection()` (called right after in `sectionChanged()`) does the equivalent work.
- The other caller of `displayOptionsToControls()` (app init, [infinite-neck.js](../../../../infinite-neck.js#L4479))
  is left unchanged (still repaints) — it's a one-time startup call, not in the per-Section hot path, and
  is out of scope for this fix.

This removes one full `clearAll()+resetNoteNames()+buildCellsForTable()+replay()+showBeats()` cycle *and*
one forced synchronous reflow per Section transition — cutting the measured per-transition JS+layout cost
roughly in half, and removing the biggest remaining forced-reflow source in the loop.

## Validation

Full Jest suite passes unchanged: 65 suites / 698 tests.

No new Jest test was added for this change since it's a call-site/parameter change in browser-only UI glue
code (`displayOptionsToControls()`/`syncSectionUi()` both touch jQuery/DOM controls extensively and aren't
covered by the existing non-browser Jest patterns in this repo).

## Follow-up (not done here)

- Manual UI acceptance testing to confirm no visual regression when a Section's display options
  legitimately differ from the previous Section's (the `fullRepaint()` skip only removes the *duplicate*
  call — the subsequent `clearAndReplaySection()` still applies the correct per-Section rebuild).

## Real-browser confirmation (20260831T114128)

A fresh capture (`903-console-log-20260831T114128.log`, `Trace-20260831T114128.json`, same
`timing-after-steps-A-B-C.json` song) was taken after the fix landed.

- Console log: every `sectionBoundary` entry is now preceded by exactly **one** `buildCellsForTable` log
  line (previously two per transition).
- Trace `performance.mark()` analysis: 36 marks total = **9 single build+replay cycles** (4 marks each),
  one per Section transition, with **no** secondary ~32-38ms-later cycle. Cadence between cycles is a
  steady ~6.1s, matching the Section's actual play length exactly.
- Per-cycle cost: `buildCells()` 0.6-2.0ms (still `skipped-unchanged`), `replay()` 3.2-5.0ms, full cycle
  13.1-17.5ms — roughly **half** the previous ~30-38ms two-cycle cost, and the extra forced synchronous
  reflow from the duplicate `fullRepaint()` is gone.
- A cluster of `[Violation] 'setTimeout' handler took <N>ms` warnings appears once, immediately after the
  very first Section transition in the capture, and does not recur at any subsequent transition — this
  looks like one-time recording/warm-up overhead (DevTools attaching, JIT warm-up) rather than a symptom
  of the fix or the remaining per-transition cost, but is worth watching for if it recurs in future
  captures.

Confirms the phase-4 fix works as intended in a live browser session.
