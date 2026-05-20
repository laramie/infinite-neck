# Transport Controller Implementation Plan

## Purpose

This sprint introduces a new `TransportController` in `transport-controller.js` to separate transport semantics from Song state changes and from UI replay/repaint code.

The immediate driver is duplicate and inconsistent firing of `DaCapo:OnSectionBegin` during explicit replay and restart actions while looping. The broader goal is to establish clear ownership boundaries for transport behavior so later repaint/event-order cleanup can happen on a better foundation.

This plan is based on the approved design decisions from chat.

## Approved Choices

- Baseline code has already been committed and tagged as `before-transport-state-refactor`.
- The new file should be `transport-controller.js` and should contain `TransportController`.
- Migrate only the minimal set of verbs discussed in the plan. Do not move all section navigation at once.
- `notifySectionRestartIfLooping()` should not remain the long-term owner of restart semantics. That responsibility should move into controller methods.
- Non-goals for this sprint are approved. UI repaint cleanup and broader event sorting are explicitly deferred.

## End State For This Sprint

At the end of this sprint, the code should trend toward these ownership rules:

- `Song` owns state.
- `TransportController` owns single-verb transport actions and domain lifecycle events such as `DaCapo:*`.
- UI code owns replay/repaint requests only.

The practical effect should be:

- transport button handlers and command-line actions for the same verb both delegate to one controller method
- `DaCapo:OnSectionBegin` is emitted exactly once for migrated verbs when intended
- generic replay helpers no longer decide transport semantics for migrated verbs

## Problem Statement

The current transport behavior is spread across three layers:

- `Song.js` mutates state and also publishes some events
- `key-handlers.js` and transport button handlers in `infinite-neck.js` combine state mutation with replay calls
- looper code emits `DaCapo:*` events for actual loop start/wrap

This has led to duplicate replay paths and duplicate `DaCapo:OnSectionBegin` emissions, especially when explicit restart actions are performed while looping.

The current `notifySectionRestartIfLooping()` helper made the duplicate ownership visible, but it is temporary scaffolding rather than the desired final architecture.

## Minimal In-Scope Verbs

The sprint will migrate only the minimal set of verbs needed to establish the controller pattern and fix the known event ownership issue.

### Section restart / reset verbs

- restart section: command-line `/rbf`
- first section / restart song equivalent paths:
	- command-line `/rsf`
	- command-line `/rs0`
	- `#transport` button `btnFirstSection`
- reset song: `/rsr`
- reset song hard: `/rsR`

### Loop start verbs

- start/stop loop sections: `/rl`
- start/stop loop beats: `/re`

### Equivalent transport buttons in scope

- `#btnFirstSection`
- `#btnLoopSections`
- `#btnLoopBeats`

These are in scope because command-line actions and transport buttons are intended to become thin equivalent front doors to the same transport verbs.

## Non-Goals For This Sprint

These items are intentionally out of scope:

- repaint deduplication across the full app
- general cleanup of all `replay()` and repaint-related duplicate calls
- broader EventBus repaint strategy redesign
- migration of all section navigation verbs in one pass
- transport-independent UI paint optimization
- solving every double paint behavior currently suspected in the UI

Those concerns should be handled in a later sprint once transport ownership is no longer split.

## Proposed New File

### `transport-controller.js`

This file should define `TransportController`.

The controller should be narrowly focused on owning transport verbs and the decision to emit domain lifecycle events.

It should not own DOM details or direct UI rendering.

## Responsibilities Of `TransportController`

`TransportController` should:

- perform the single-verb action for each migrated transport command
- call into `Song` for state mutation
- decide whether the action implies a fresh section begin
- decide whether reset semantics apply
- coordinate with looper state where needed
- request replay/repaint through existing UI-facing helpers, but not implement replay itself
- emit `DaCapo:*` events exactly once for the migrated verbs

`TransportController` should not:

- manipulate DOM directly
- own menu rendering
- implement `replay()` or paint/update behavior itself
- become a new home for generic UI side effects

## Expected High-Level Architecture After This Sprint

### Song

`Song` should move toward being a state holder and state mutator.

For the migrated flows, `Song` should eventually:

- mutate section index / beat / related state
- publish state-oriented events only
- avoid deciding repaint or `DaCapo:*` transport semantics

### TransportController

`TransportController` should become the single owner of:

- restart section
- first section / restart song path
- reset song
- reset song hard
- loop start semantics for the minimal verbs in scope
- when `DaCapo:OnSectionBegin` and related domain events are emitted for explicit verbs

### UI Layer

UI code in `infinite-neck.js` and command handling in `key-handlers.js` should move toward:

- thin delegation to the controller
- replay/repaint only
- no direct transport lifecycle emission logic for migrated verbs

## Iteration 1

### Goal

Introduce `TransportController` and migrate the highest-value verbs so that explicit restart/reset actions and loop starts have one owner for transport semantics.

### Scope

- add `transport-controller.js`
- wire minimal verbs through the controller
- remove controller-owned semantics from generic replay for migrated verbs
- keep `notifySectionRestartIfLooping()` as temporary scaffolding only if needed during the migration, with the intent that controller methods absorb that responsibility

### Concrete Verbs To Migrate

- `restartSection()` for `/rbf`
- `goFirstSection()` for `/rsf`, `/rs0`, and `#btnFirstSection`
- `resetSong()`
- `resetSongHard()`
- `toggleLoopSections()` or a controller-owned wrapper around loop-sections start/stop
- `toggleLoopBeats()` or a controller-owned wrapper around loop-beats start/stop

### Files Likely Touched

- `transport-controller.js` new file
- `key-handlers.js`
- `infinite-neck.js`
- `looper.js`
- possibly small touch points in `Song.js` only if needed to reduce immediate duplication for the migrated verbs

### Implementation Direction

1. Create `TransportController` with explicit public methods for migrated verbs.
2. Provide it the dependencies it needs instead of hard-coding DOM ownership into it.
3. Change command-line action cases in `key-handlers.js` so migrated verbs delegate to controller methods.
4. Change the equivalent transport button handlers in `infinite-neck.js` so they delegate to the same controller methods.
5. For migrated verbs, make the controller the only place deciding whether `DaCapo:OnSectionBegin` is emitted.
6. Reduce reliance on `notifySectionRestartIfLooping()` from generic replay/view code for the migrated verbs.

### Acceptance Criteria

- `/rbf` and its equivalent UI path use the same controller method
- `/rs0` and `#btnFirstSection` use the same controller method
- `/rsr` and `/rsR` use controller methods
- `/rl` and `/re` are under controller-owned transport semantics for the minimal path
- migrated verbs emit `DaCapo:OnSectionBegin` exactly once when intended
- no direct UI handler for migrated verbs performs its own transport semantics outside the controller

### Tests For Iteration 1

- focused controller-level tests for migrated verbs
- regression tests for command paths:
	- `/rbf`
	- `/rs0`
	- `/rsr`
	- `/rsR`
	- `/rl`
	- `/re`
- regression tests for button paths:
	- `#btnFirstSection`
	- `#btnLoopSections`
	- `#btnLoopBeats`
- assertions that `DaCapo:OnSectionBegin` is not double-fired for the migrated flows

## Iteration 2

### Goal

Move `Song` toward state ownership only, for the migrated transport flows.

### Scope

- reduce or remove replay ownership from `Song` methods involved in migrated flows
- reduce coupling between `SectionChanged` and replay for the migrated flows

### Problem Areas To Address

Current `Song` methods combine or indirectly cause:

- state mutation
- `SectionChanged` publication
- direct replay requests through UI-facing pathways

That needs to be narrowed so the controller owns transport behavior while `Song` owns state.

### Implementation Direction

1. Audit `Song` methods involved in migrated flows.
2. For those flows, reduce `Song` responsibilities to state mutation plus state-oriented event publication.
3. Stop using `Song` methods as hidden owners of replay side effects for the migrated flows.
4. Redefine the role of `SectionChanged` for migrated flows as state/UI synchronization rather than transport semantics.

### Files Likely Touched

- `Song.js`
- `infinite-neck.js`
- possibly `key-handlers.js` and `transport-controller.js` for resulting call-path cleanup

### Acceptance Criteria

- `Song` no longer decides replay for the migrated verbs
- `SectionChanged` no longer causes hidden transport semantics for those flows
- controller remains the single owner of `DaCapo:OnSectionBegin` decisions for migrated verbs

### Tests For Iteration 2

- tests showing state mutation without transport lifecycle emission from `Song` alone
- regression tests for `SectionChanged` behavior in migrated flows
- tests confirming controller still produces correct replay/event outcomes after side effects are removed from `Song`

## Iteration 3

### Goal

Make UI handlers thin one-liners and constrain replay/view helpers to repaint-only behavior for the migrated verbs.

### Scope

- transport button handlers in `infinite-neck.js`
- command handlers in `key-handlers.js`
- replay helper ownership for migrated flows

### Implementation Direction

1. Convert in-scope button handlers into thin delegators to `TransportController`.
2. Convert in-scope command action cases into thin delegators to `TransportController`.
3. Keep replay helpers as view helpers only for migrated flows.
4. Remove leftover compatibility glue or transitional branching introduced in Iteration 1.

### Acceptance Criteria

- button path and command path for the same migrated verb are structurally equivalent
- UI handlers do not emit `DaCapo:*` directly for migrated verbs
- replay/view helpers do not decide transport lifecycle semantics for migrated verbs
- the migrated transport surface is readable as a thin UI shell over controller-owned semantics

### Tests For Iteration 3

- command/button equivalence tests for migrated verbs
- regression tests verifying repaint helpers do not emit transport lifecycle events in migrated flows
- final duplicate-fire assertions for the in-scope verbs

## Temporary Status Of `notifySectionRestartIfLooping()`

The baseline code currently contains `notifySectionRestartIfLooping()`.

That helper should be treated as transitional.

Approved direction:

- do not make it the long-term owner of restart semantics
- move its semantic responsibility into controller methods
- simplify `looper.js` where possible as that migration proceeds

By the end of Iteration 1, migrated explicit verbs should no longer depend on generic replay calling that helper in order to decide transport lifecycle semantics.

## Suggested Public API For `TransportController`

Exact naming may evolve, but the controller should likely expose methods along these lines:

- `restartSection()`
- `goFirstSection()`
- `resetSong()`
- `resetSongHard()`
- `toggleLoopSections()` or `startLoopSections()` / `stopLoopSections()` wrappers
- `toggleLoopBeats()` or `startLoopBeats()` / `stopLoopBeats()` wrappers

Each method should return a structured result suitable for both button paths and command-line paths.

Example fields:

- `result`
- `sectionIndex`
- `beat`
- `didReplay`
- `didEmitSectionBegin`
- `didReset`

This keeps command-line result formatting simple while allowing tests to assert exact behavior.

## Design Constraints

### Keep the sprint narrow

Do not migrate all navigation verbs immediately.

The point of this sprint is to establish ownership and fix the transport semantic duplication on the known high-value paths without over-expanding scope.

### Preserve loop behavior where already correct

Existing actual looper-controlled start and wrap semantics should remain valid. The controller should not duplicate correct looper-owned loop transitions.

### Avoid mixing repaint cleanup into this sprint

The later repaint-focused sprint should address broader duplicate paint behavior. This sprint should resist the temptation to solve that wider problem now.

## TODO / After Sprint

- Audit remaining direct looper calls in command handlers and UI handlers, but defer any migration unless they are already part of the approved transport verb set.
- Revisit whether BPM-change loop restarts belong under `TransportController` once the sprint-scoped transport ownership work is complete.
- Do a focused cleanup pass on replay/view helper duplication only after the transport-ownership iterations are finished.

## Likely Risks

### Risk 1: migrating too many verbs at once

Mitigation:

- keep Iteration 1 strictly to the minimal migrated set

### Risk 2: temporary overlap between old and new call paths

Mitigation:

- characterization tests before removing old wiring
- explicit acceptance criteria for single-fire behavior

### Risk 3: conflating controller responsibilities with repaint logic

Mitigation:

- controller requests replay, but does not implement repaint
- UI helpers repaint, but do not decide transport lifecycle semantics for migrated flows

## Deliverables

By the end of the sprint, expected deliverables are:

- new `transport-controller.js`
- migrated minimal transport verbs routed through `TransportController`
- button and command paths made equivalent for migrated verbs
- duplicate `DaCapo:OnSectionBegin` firing removed for migrated flows
- focused regression tests covering controller ownership and single-fire behavior

## Review Notes

This plan intentionally does not include the later repaint cleanup sprint. That later sprint is expected to inspect double-paint behavior and broader EventBus repaint ownership once transport/model semantics are no longer split.

This sprint should produce a cleaner core transport engine/model boundary first.
