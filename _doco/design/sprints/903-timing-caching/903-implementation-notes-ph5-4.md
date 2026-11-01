# Sprint 903 timing-caching — Phase 5-4: predictive section-transition lead (experimental)

date: 20260831

## Context

Phase 5-2/5-3's console-log analysis (`console-section-kickoffs.log`, `section-kickoffs.csv`) confirmed
that in Visual timing mode, the entire synchronous cost of a section-transition rebuild is paid *inside*
the same tick that triggers it, and the next tick is then scheduled a flat interval later from that point
-- so the outgoing section's last beat visually lingers on screen for `beatInterval + transitionCost`
instead of the nominal `beatInterval`. The user asked to try compensating for this directly: measure how
long section-transition ticks actually take, keep a moving average, and use that average to schedule the
*next* section-boundary tick earlier by that amount ("pre-launch"), gated by a boolean const so it can be
disabled outright.

## Design

Added to [looper.js](../../../../looper.js):

- `LOOPER_PREDICTIVE_SECTION_LEAD_ENABLED` (const, default `true`) -- the requested on/off switch. Setting
  it to `false` restores the exact previous flat-interval Visual-timing scheduling behavior with zero other
  code-path changes.
- `sectionTransitionDurationsMs` -- a sliding window (`SECTION_TRANSITION_LEAD_SAMPLE_WINDOW = 5` samples)
  of the most recently *measured* section-transition tick durations. `recordSectionTransitionDurationMs()`
  pushes a new sample and drops the oldest once the window is full, so the average tracks recent behavior
  (e.g. drops automatically as caches warm up or a song's tables get cheaper to rebuild) rather than a
  lifetime average that would react too slowly. `getAverageSectionTransitionMs()` (exported) is the simple
  arithmetic mean, `0` until at least one real transition has been measured.
- `willNextTickBeSectionBoundary(loopKind, song)` -- true when the *currently displayed* beat has already
  reached the section's beat count, meaning the *next* scheduled tick (not the one just run) is the one
  that will perform `tickBeat()`'s heavy `gotoNextSection()`/rebuild path. Only meaningful for the
  `'sections'` loop kind (the `'beats'` loop kind never transitions sections, see `tickBeat()`).
- `applySectionTransitionLead(loopKind, song, delayMillis)` -- if enabled, and the next tick is predicted to
  be a boundary tick, subtracts the current average from the normal delay (floored at `0`) and logs
  `[LooperPredictiveLead] mode=... leadMs=... delayMs=... adjustedDelayMs=...` to the console. **Applies in
  both Visual and Transport timing modes** (see "Correction: extended to Transport mode" below).

Wiring:

- `runScheduledBeatTick()` now records `Date.now()` immediately before calling `tickBeat()`, and -- only
  when `tickResult.sectionTransition` is true -- records the elapsed time via
  `recordSectionTransitionDurationMs()` right after `tickBeat()` returns. This measures exactly the
  synchronous cost that phase 5-3's `console-section-kickoffs.log` analysis identified as the source of the
  hiccup (the same window the `[Violation] 'setTimeout' handler took Nms` entries were reporting).
- `scheduleNextBeatTick()` now passes its computed `delayMillis` through `applySectionTransitionLead()`
  before starting the timer.
- `__resetLooperForTests()` clears `sectionTransitionDurationsMs` along with the other reset state.

## Why this specific approach

- **Self-tuning, no per-song configuration needed**: the user's "signature load time per Section" idea was
  considered but the moving-average approach was chosen instead, since it automatically adapts as songs
  vary in table count/complexity and as caching (Steps A-D1, Flyweight) continues to change the actual
  cost, without needing per-song calibration data.
- **Zero risk to the render pipeline itself**: this only adjusts a `setTimeout` delay value; it does not
  touch `buildCellsFromSelector()`, `NoteTableRenderCache`, or any DOM code from this sprint's earlier
  phases.
- **Cheap to disable**: a single const flip fully reverts to prior behavior, keeping this squarely in
  "experimental instrumentation" territory rather than a hard architectural commitment -- appropriate given
  the user's own framing of the surrounding ideas as "hand-waving at this point."
- **Does not replace the double-buffering idea**: this only pre-launches the *tick*, not the actual
  rendering. If the measured transition cost consistently exceeds the beat interval itself (i.e. the
  average would want to floor the delay at/near `0`), this alone cannot fully hide the hiccup -- that
  remains the province of the larger build-ahead/gated-reveal redesign discussed previously, still not
  attempted.

## Correction: extended to Transport mode

The initial version of this feature (above) restricted the lead to Visual timing mode only, reasoning that
Transport mode's own absolute-anchor scheduling would "double-compensate" if the lead were applied there
too. After validating the Visual-mode behavior in the real app ("it works very well"), the user challenged
that restriction: Transport mode's job is only to prevent long-run clock drift/creep against its clock
source, not to eliminate the real, measurable cost of a section-change rebuild -- and shortening *when the
timer fires* should not affect the anchor's own arithmetic.

Tracing `looper-transport-timing.js` confirms this: `state.nextTickAtMillis` is an absolute anchor,
recomputed in `afterBeatTick()` as `state.nextTickAtMillis += beatDurationMillis` (plus a `while` loop that
only advances further to skip genuinely missed beats). This recomputation depends solely on the *previous
anchor value* and the fixed beat duration -- it does not depend on what actual delay value was used to fire
the underlying timer. So shortening that delay via the lead only changes when the (already-scheduled) tick
fires early; it cannot cause the anchor to drift, because the anchor was never derived from the timer's
actual firing time in the first place. The two mechanisms operate on different axes and are complementary:
Transport's anchor guarantees no long-run drift against its clock source, while the lead starts the known,
unavoidable rebuild work early enough that it finishes closer to the nominal boundary.

This also happens to be the natural hook point for a future external clock sync source (e.g. MIDI clock):
the section-change prep cost is real regardless of what's driving the beat clock, so the lead calculation
belongs at this level rather than being tied to a specific timing-mode implementation.

`applySectionTransitionLead()`'s early-return condition was changed from
`!LOOPER_PREDICTIVE_SECTION_LEAD_ENABLED || looperTimingMode !== LoopTimingMode.VISUAL` to just
`!LOOPER_PREDICTIVE_SECTION_LEAD_ENABLED`, and its console log now includes `mode=${looperTimingMode}` so
Visual vs. Transport behavior remains distinguishable in captured logs.

## Testing

Added to [looper.test.js](../../../../_tests/jest/looper.test.js):

- No adjustment is applied before any transition duration has actually been measured (`getAverageSectionTransitionMs()`
  starts at `0`, first `setTimeout` uses the flat interval).
- Using a single-beat-per-section mock song (`beats: 1`, so every tick is a boundary tick) and a `Date.now()`
  mock that advances a fixed `10ms` per call (making the measured tick duration deterministically `10ms`,
  since `tickBeat()` itself makes no `Date.now()` calls against this mock song), confirms the *second*
  scheduled tick uses the shortened delay (`125 - 10 = 115`) and logs the expected
  `[LooperPredictiveLead] mode=visual ...` message.
- Confirms the lead **also applies** once Transport timing mode is installed (`installTransportTiming()`),
  using a separately-controlled transport clock (decoupled from the `Date.now()` mock used for duration
  measurement): the first schedule (before any measurement) still uses the flat nominal delay even in
  Transport mode; after one measured transition, the second scheduled delay is shortened
  (`125 - 10 = 115`) and the log line's pre-lead `delayMs=125` shows the Transport anchor's raw computed
  delay is still the full nominal value -- proving the anchor did not creep from the previous cycle's lead.

Full Jest suite: 65 suites / 714 tests passing (the old "does not apply in Transport mode" test was
replaced 1:1 with the new "also applies in Transport mode, without introducing schedule creep" test).

## Not yet done

- No fresh real-browser capture yet to confirm the real-world effect on the `console-section-kickoffs.log`
  methodology's measured Section delays (229/234/432ms baseline), now that the lead also applies in
  Transport mode. This is a `setTimeout`-scheduling change whose real-world effect depends on actual browser
  timing, consistent with this sprint's practice of validating such changes with a fresh capture rather than
  assuming from code alone.
- The larger build-ahead/gated-reveal double-buffering idea remains unimplemented and unscoped.
