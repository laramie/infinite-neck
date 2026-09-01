# Sprint 903 timing-caching — Phase 5-1: Flyweight content-node cache (Option A), real-browser validation

date: 20260831

## Context

[903-phase-5-flyweight-content-cache-plan.md](903-phase-5-flyweight-content-cache-plan.md)'s Option A
(parse-once-per-distinct-key, `cloneNode(true)` thereafter) was implemented in
[NoteTableRenderCache.js](../../../../NoteTableRenderCache.js) (`getOrBuildContentNode()` +
`entry.contentNodeByKey`) and
[NoteTableController.js's `buildCellsFromSelector()`](../../../../NoteTableController.js#L426) (`parseHtmlToNode()`
helper + `obj.replaceChildren(contentNode.cloneNode(true))`, with a string-based `innerHTML=` fallback).
Standalone/console-snippet benchmarks predicted a ~3.5-4.4x speedup for `cacheState:'hit'` renders. This
note captures the first real-browser trace/console capture taken against the live app after that change,
to confirm the prediction holds and to see what (if anything) is now the dominant remaining cost.

**Song used**: `practice/pentatonics-7-m-V7-in-6-keys-with-fill.json` (same song used for phase 4-2's
multi-key stress test — many plugins/transpositions/fills/key changes, 2 visible tables:
`tblP46_main` + `tblS6_listener`). **Captures**: `Trace-flyweight-pentatonics.json` (DevTools Performance
trace) + `console-flyweight-pentatonics.log` (console dump of `[NoteTableTiming]` markers).

## Console-log timing: confirms the predicted speedup

```
cacheState: 'hit'               n=6   avg=10.2ms  min=9.5ms   max=11.0ms
cacheState: 'skipped-unchanged' n=24  avg=0.07ms  min=0.0ms   max=0.1ms
```

Compare to phase 4-6's post-D1, pre-Flyweight numbers for the same `'hit'` state: **avg ~37-43ms**. That's
a **~3.7-4.2x reduction** for `cacheState:'hit'` renders, landing right in the middle of the ~3.5-4.4x
range predicted by the standalone/console-snippet benchmarks run before implementation. `'skipped-unchanged'`
(Step A, unaffected by this change) remains negligible as expected, confirming no regression there.

## Trace-level ParseHTML cost: confirmed eliminated from the hot path

Repeating phase 4-6's exact methodology (filter `traceEvents` for `ParseHTML` events whose
`args.beginData.stackTrace` contains a frame with `functionName === 'buildCellsFromSelector'`):

- Phase 4-6 (pre-Flyweight): **~408 ParseHTML events** in one representative hit-cluster, summing to
  **~48ms** of a ~79ms span.
- Phase 5-1 (post-Flyweight, this capture): **0 ParseHTML events** with `buildCellsFromSelector` anywhere
  in their stack trace, across the entire ~35MB trace (2168 total `ParseHTML` events exist in the trace,
  none attributable to this function). This directly confirms `buildCellsFromSelector()`'s hot loop no
  longer triggers the browser's HTML parser at all in the steady state -- the exact mechanism the Flyweight
  design intended to eliminate.
- A search for `parseHtmlToNode`/`getOrBuildContentNode` in any trace event's stack trace also found zero
  hits. This is expected, not a red flag: by this point in the session the render-cache entries for both
  visible tables' keys had already been prewarmed/populated (their `contentNodeByKey` masters already
  built) on an earlier visit, so this particular capture window's `'hit'` renders never needed to run
  `parseHtmlToNode()` even once -- they went straight to `cloneNode(true)`.

## What's left: CPU-profile self-time reconstruction

To see what the remaining ~10ms/hit is actually spent on, reconstructed self-time per function from the
trace's `ProfileChunk` CPU-profile samples (same technique as phase 4's stack-trace analysis, applied to
sampled self-time instead of synchronous event durations) across the whole capture:

```
querySelectorAll   205.0ms   (whole-session total, not just hits)
setAttribute       177.0ms
fullRepaint        160.0ms
getAttribute        93.5ms
style               48.6ms
replaceChildren     36.1ms   <- the new cloneNode-based insert, whole-session total
```

`replaceChildren` (which internally performs the `cloneNode(true)` + DOM insert) is a real but modest cost
now -- nowhere near the ~48ms-per-79ms-span `ParseHTML` used to cost. The larger remaining costs
(`querySelectorAll`, `setAttribute`, `getAttribute`, `style`) are the per-cell DOM reads/writes still done
once per matched `<td>` inside `buildCellsFromSelector()`'s loop (the `obj.querySelector(".NoteDisplay")`
call, `obj.setAttribute("fontMultiplier", ...)`, `obj.getAttribute("midinum"/"cellcol"/"celltable")`,
`noteDisplay.style.fontSize =` / `.height =`) -- unrelated to content/HTML parsing, and not part of this
plan's scope. These would be the natural next optimization target if further gains are wanted, but are
**not addressed by this note** -- flagged here only for future-session context.

## Outcome

Option A's real-world effect matches the pre-implementation benchmark predictions almost exactly
(~3.5-4.4x predicted, ~3.7-4.2x measured), and the trace-level `ParseHTML` cost that motivated this whole
phase-5 investigation is now unambiguously gone from `buildCellsFromSelector()`'s hot path. No further code
changes made in this note. Full Jest suite (65 suites/710 tests) was already confirmed passing when Option A
landed; not re-run here since no code changed.
