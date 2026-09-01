# Sprint 903 timing-caching — Phase 5-5: real-world acceptance capture (Transport mode, 333 BPM)

date: 20260831

## Context

Phase 5-4's predictive section-transition lead was extended to apply in both Visual and Transport
timing modes (see [903-implementation-notes-ph5-4.md](903-implementation-notes-ph5-4.md)), but had not
yet been re-validated with a fresh real-browser capture. The user supplied a new capture
(`console-ph5-4.log`, `Trace-ph5-4.json`) taken at **333 BPM in Transport timing mode**, deliberately an
aggressive/fast tempo, along with subjective acceptance feedback.

## User's subjective report

> Visually, the flow of Sections and Beats feels perfect. It gets better after the first 4 or 5
> switches, so the average may be warming up. Once the cache and the average are rockin, only minor
> hiccups can be detected on big tear-downs when we move positions with ArpeggioPlugin and FillPlugin.
> But by and large, it is smooth and undetectable.

## Console log analysis (`console-ph5-4.log`)

- Every section-boundary tick logs `[LooperPredictiveLead] mode=transport leadMs=... delayMs=...
  adjustedDelayMs=0` -- confirming the lead is active in Transport mode as intended (phase 5-4's
  extension). `leadMs` climbs from ~246-264ms in the first few transitions up toward ~300-338ms in
  later ones, matching the user's own observation that "it gets better after the first 4 or 5 switches"
  (i.e. the 5-sample moving average is still filling/warming up early in the session).
- At this tempo, `delayMs` (the raw Transport-computed nominal delay before the beat carrying the
  section-transition rebuild) is only ~242-244ms, while the measured average transition cost
  (`leadMs`) is *larger* than that -- so `adjustedDelayMs` is floored at `0` on every single boundary
  in this capture. This is the documented edge case from phase 5-4's original design notes ("if the
  measured transition cost consistently exceeds the beat interval itself... this alone cannot fully
  hide the hiccup"): at 333 BPM the lead cannot fully cancel the rebuild cost, only fire the timer as
  early as possible (immediately). Despite this, the user reports the result as visually smooth --
  i.e. even a partial lead (firing the boundary tick at the earliest possible moment instead of after
  the full nominal delay) is enough to make the transition imperceptible at this tempo/song.
- `[NoteTableTiming] buildCellsForTable` entries are overwhelmingly `cacheState: 'skipped-unchanged'`
  (0-0.5ms) or `'hit'` (~8.8-9.5ms) -- no live `'miss'` states appear in this capture, meaning the
  render cache and prewarm from earlier phases are holding up correctly under Transport/333 BPM too.
  `prewarmSection` consistently reports `cacheState: 'no-work'`, `durationMs: 0` -- phase 5-3's deferred
  setup is not adding measurable synchronous cost.

## Trace analysis (`Trace-ph5-4.json`, 82,292 events)

- **Flyweight content-node cache still holds**: `0` of `1,875` `ParseHTML` events in the trace have
  `buildCellsFromSelector` anywhere in their stack trace -- same result as phase 5-1's validation,
  now confirmed under this new Transport/333 BPM scenario as well. The per-cell HTML-parsing cost
  eliminated in phase 5 has not regressed.
- **The "big tear-down" hiccups the user noticed are two isolated ~465ms and ~488ms `RunTask` spans**,
  each dominated by a V8 **major (mark-compact) garbage collection** pause -- `MajorGC`,
  `V8.GC_MARK_COMPACTOR`, `V8.GCFinalizeMC`, `V8.GC_MC_BACKGROUND_MARKING`, `CppGC.ConcurrentMark`, and
  related GC sub-events account for the bulk of each window. The actual rendering work inside those same
  windows (`Layout` ~22ms, `ParseHTML` ~14-18ms, `UpdateLayoutTree` ~12ms) sums to well under 60ms --
  nowhere near the ~465-488ms total. In other words, the perceptible hiccups on ArpeggioPlugin/FillPlugin
  position changes are very likely **garbage-collection pauses triggered by memory churn**, not a cost
  inside this sprint's render/timing code paths.
- This GC-pause finding is noted here as a candidate area for future investigation (e.g. reducing
  allocation churn during large plugin-driven rebuilds) but is explicitly **out of scope for this
  sprint** and not being acted on now, consistent with the user's direction below.

## Acceptance

- The user has confirmed the phase 5 (Flyweight content-node cache) and phase 5-3/5-4 (deferred
  prewarm setup + predictive section-transition lead, now covering both Visual and Transport timing
  modes) work is **smooth and undetectable** in real use, including at an aggressive 333 BPM tempo in
  Transport mode. **This closes out the active work for Sprint 903 timing-caching.**
- Deferred/not-acted-on recommendations, to be revisited only after (and if informed by) the upcoming
  external-timing/MIDI-clock-sync sprint:
  - Step D2 (whole-tbody single-write markup batching, in place of the current per-`<td>` Flyweight
    `cloneNode` approach) -- still just a documented option, not scheduled.
  - Any explicit *gating* of the section-transition tick (e.g. delaying the boundary reveal until
    rebuild work actually completes, rather than only leading the timer's firing time) -- still just a
    documented option, not scheduled.
  - The GC-pause investigation noted above.
  - Any future external clock source (e.g. MIDI) is expected to plug in at the same
    `applySectionTransitionLead()` hook point identified in phase 5-4's correction, since the
    section-change prep cost is real regardless of what drives the beat clock.

## Not yet done

- Nothing further planned for this sprint; remaining ideas above are explicitly deferred to a future
  external-timing sprint, per the user's direction.
