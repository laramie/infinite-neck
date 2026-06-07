# Sprint 126 Piano Listener Implementation Plan

This document is the Iteration 2 implementation plan for sprint 126.

It is based on:

- the original problem statement in `126-design.md`
- the approved design sketch in `126-sketch.md`
- the follow-up design decisions recorded in Iteration 2 of `126-design.md`

This is not coding yet.

The purpose of this document is to define the approved implementation shape, identify the concrete file touch points, and set a low-risk execution order for Iteration 3.

## Scope Summary

Sprint 126 should make Piano Lineage listener instruments able to listen to multi-string source instruments by projecting listener notes by MIDI pitch rather than by source row and column.

This sprint should:

1. keep the existing listener replay mode as the default
2. add a persisted listener projection mode on each wiring
3. expose that mode in Wiring UI as a `select`
4. support two new MIDI-only projection orders:
	1. low string to high string
	2. high string to low string
5. apply the new projection rule to both:
	1. `playedNotes`
	2. `recordedNotes` / looped Highlights

This sprint should not introduce a Listener plugin.

## Approved Design Decisions

The following decisions are now fixed for this sprint:

1. Use a persisted field named `listenerProjection`.
2. Use a `select`, not a checkbox and not a radio group.
3. Keep the feature in core listener/wiring code.
4. Put the projection helpers in `move-helpers.js`.
5. Sort source strings by musical starting pitch, not by raw visual row order.
6. For MIDI-only mode on non-piano multi-row targets, using the first deterministic matching target cell is acceptable in this sprint.
7. User-facing labels should say `string`, not `row`.
8. `recordedNotes` and Highlights should be included if feasible; for this plan they are in scope.

## User-Visible Feature Shape

The Wiring UI should gain one new control after the source instrument select:

```text
Listener projection:
  Same string + MIDI
  MIDI only, low string to high
  MIDI only, high string to low
```

Recommended persisted values:

```js
'row-midi'
'midi-low-to-high'
'midi-high-to-low'
```

The default must remain `row-midi` so all existing songs behave exactly as they do today unless the new mode is explicitly selected.

## Architectural Direction

## 1. Keep current listener model, add one new wiring option

The model already represents listener relationships as `wirings`.

That should remain the only persistence location for this feature.

The new capability is not a new object type. It is one more property on `Wiring`.

## 2. Add helper-based projection, not ad hoc selector branching

The current listener replay code in `NoteTableController.js` has two row-aware rendering paths:

1. played-note replay inside `replayTable(...)`
2. beat-based recorded/highlight replay inside `showHighlightsForBeatForOptions(...)`

Those two render paths should not each invent their own MIDI-only mapping logic.

Instead:

1. `move-helpers.js` should own the layout-driven projection helpers
2. `NoteTableController.js` should call those helpers and then render the projected results

This keeps the mapping rules deterministic and testable.

## 3. Treat played and recorded projection as parallel consumers

Even though both note classes should use the new listener projection mode, the current runtime does not replay them through the same function.

So the first implementation should keep the split explicit:

1. one helper family for projecting `playedNotes`
2. one helper family for projecting `recordedNotes` beat arrays
3. one shared mode-and-layout policy under those helpers

That is safer than trying to redesign the full listener render pipeline in this sprint.

## 4. Preserve NamedNotes behavior in this sprint

NamedNotes already project by note-name semantics, not by literal source row/col replay.

This sprint should leave NamedNotes unchanged.

The new listener projection mode is specifically about note objects whose runtime display currently depends on `row` plus `midinum`.

## Core Runtime Interpretation

### Current default mode: `row-midi`

Current behavior remains unchanged:

1. `playedNotes` land by source `row` plus `midinum`
2. `recordedNotes` / highlights land by source `row` plus `midinum`

### New modes: `midi-low-to-high` and `midi-high-to-low`

When one of the MIDI-only modes is selected:

1. source row and source col are ignored for listener placement
2. source note order is determined by source string starting pitch
3. notes are projected onto the target table by MIDI only
4. if more than one target cell can host the MIDI pitch, the first deterministic matching target cell is acceptable
5. later notes in the chosen source-string order overwrite earlier notes when they collide on the same target landing cell

This overwrite rule is part of the approved product behavior and should be identical for both `playedNotes` and `recordedNotes`.

## Proposed Helper Responsibilities

The helper layer in `move-helpers.js` should provide small, reusable functions rather than one giant listener-specific routine.

Recommended helper responsibilities:

1. normalize and validate listener projection mode
2. compute musical string order for a tuning layout from string starting pitches
3. sort source note candidates in low-to-high or high-to-low order
4. resolve a target cell by MIDI-only lookup
5. clone a note onto a target cell by rewriting `row`, `col`, `midinum`, and `noteName`
6. apply collision policy so later notes overwrite earlier ones at the same landing cell
7. project a `playedNotes` array
8. project a `recordedNotes` beat dictionary

The existing tuning-layout helpers already provide most of the foundation:

1. `createTuningLayout(...)`
2. `getCellByRowMidi(...)`
3. `getPreferredCellForMidi(...)`

The new listener-specific helpers should build on those.

## Proposed File Touch Points

### 1. `Wiring.js`

Add the new default property:

```js
listenerProjection: 'row-midi'
```

This keeps old songs backward-compatible without special-case migration code.

### 2. `Song.js`

Update `addWiring(...)` so it can accept and persist `listenerProjection`.

Recommended shape:

1. extend the method signature to take the fourth argument
2. include it when building `new Wiring(...)`
3. default it to `'row-midi'` when omitted

This should be a narrow change only.

### 3. `templates/templates.html`

Update the `Wiring-template` markup to add the new `select`.

This template currently contains:

1. Relative Section input
2. Instrument select
3. Add Wiring button

The new control should live with those existing fields.

### 4. `templates/WiringBuilder.js`

Update Wiring UI behavior so that it:

1. reads the new `select`
2. includes the selected projection mode in `getSong().addWiring(...)`
3. restores the current saved value in `updateAllWiringSelects()`
4. includes the control in button dirty-state detection inside `updateWiringButtonStatus(...)`

This file is the main UI entry point for the feature.

### 5. `ReplayOptions.js`

Add `listenerProjection` as a replay option field.

This keeps listener mode explicit once wiring is translated into replay state.

### 6. `NoteTableController.js`

This file needs the main runtime integration.

Expected changes:

1. when listener replay options are created from wiring, copy `wiring.listenerProjection` into the listener replay options
2. in `replayTable(...)`, preserve current behavior for `row-midi`
3. in `replayTable(...)`, call a helper-based MIDI-only projection path for `playedNotes` when one of the new modes is selected
4. in `showHighlightsForBeatForOptions(...)`, preserve current behavior for `row-midi`
5. in `showHighlightsForBeatForOptions(...)`, call a helper-based MIDI-only projection path for `recordedNotes` / highlights in the new modes

This is the highest-risk file for the sprint and should be changed in small, traceable slices.

### 7. `move-helpers.js`

This file should host the shared listener projection logic.

Suggested additions:

1. listener projection mode constants or normalization helper
2. string-order helpers based on layout row starting pitch
3. target-cell resolution by MIDI-only rule
4. projection helpers for:
	1. `playedNotes`
	2. `recordedNotes`
5. collision handling keyed by target landing cell and note style

If collision bookkeeping differs between played and recorded notes, keep that explicit rather than hiding it behind too much abstraction.

### 8. `bin/song-file-schema.js`

Allow `listenerProjection` on each wiring object.

Recommended schema treatment:

1. add the new property to `wiringSchema.properties`
2. do not make it required

The field must stay optional so old V2 song files continue to validate.

### 9. `help.html`

Update Event Wiring documentation to describe the new listener projection control.

The help text should use user-facing musical language:

1. `Same string + MIDI`
2. `MIDI only, low string to high`
3. `MIDI only, high string to low`

It should also explicitly say that MIDI-only mode is meant for Piano Lineage listeners and other single-row targets.

## Tests

### Primary test files

1. `_tests/jest/song-api-load-V2.test.js`
2. one new or updated Jest file for listener projection helper behavior
3. possibly a `NoteTableController`-adjacent Jest file if helper-only tests are not enough

### Required test coverage

#### 1. Persistence defaults

Verify that loading a wiring without `listenerProjection` produces a `Wiring` instance whose effective value is `row-midi`.

#### 2. Persistence round-trip

Verify that saving and loading a song with `listenerProjection: 'midi-low-to-high'` preserves that value.

#### 3. Played-note helper projection

Verify that a multi-string source tuning projected into a one-row piano target produces the expected `playedNotes` landing cells by MIDI only.

#### 4. Played-note collision order

Verify that `midi-low-to-high` and `midi-high-to-low` select different winners when two source notes land on the same target cell.

#### 5. Recorded-note projection

Verify that a beat dictionary of recorded listener notes is projected beat-by-beat by MIDI only, preserving beat grouping.

#### 6. Recorded-note collision order

Verify that collisions within one beat obey the same low-to-high / high-to-low overwrite rule as played notes.

#### 7. Default mode regression

Verify that `row-midi` preserves current row-aware behavior for both:

1. `playedNotes`
2. `recordedNotes`

### Preferred testing strategy

The safest test strategy is:

1. keep most new logic in `move-helpers.js`
2. test that helper logic directly with deterministic layouts and note fixtures
3. add only a small amount of integration coverage around persistence and replay-option plumbing

That avoids over-investing in DOM-heavy listener tests for the first implementation.

## Implementation Slices

### Slice 1: Data model and schema

Goal:

Persist the new mode safely before changing behavior.

Steps:

1. update `Wiring.js`
2. update `Song.js`
3. update `bin/song-file-schema.js`
4. add persistence tests

Expected result:

The new mode exists in the model and old songs still behave the same.

### Slice 2: Wiring UI

Goal:

Let the user choose the projection mode.

Steps:

1. update `templates/templates.html`
2. update `templates/WiringBuilder.js`
3. verify dirty-state and restore behavior

Expected result:

The option is visible, selectable, saved, and restored.

### Slice 3: Projection helpers in `move-helpers.js`

Goal:

Create one tested projection policy for MIDI-only listener mapping.

Steps:

1. add mode normalization
2. add musical string-order helpers
3. add played-note projection helper
4. add recorded-note projection helper
5. add collision handling
6. add focused helper tests

Expected result:

All risky mapping logic is testable outside the DOM.

### Slice 4: Listener `playedNotes` integration

Goal:

Switch only the played-note listener path to the new helper when needed.

Steps:

1. plumb `listenerProjection` into `ReplayOptions`
2. pass it into listener replay options in `NoteTableController.js`
3. branch inside `replayTable(...)`
4. preserve current path for `row-midi`

Expected result:

Piano listeners can see played notes from all source strings in MIDI-only mode.

### Slice 5: Listener `recordedNotes` / highlight integration

Goal:

Apply the same mode to looped recorded playback.

Steps:

1. branch inside `showHighlightsForBeatForOptions(...)`
2. project beat arrays through the helper for MIDI-only modes
3. preserve current path for `row-midi`
4. confirm beat grouping and note-style rendering remain intact

Expected result:

Looped Highlights and recorded note playback follow the same listener projection rule as played notes.

### Slice 6: Documentation and final validation

Goal:

Make the feature discoverable and verify the sprint boundary.

Steps:

1. update `help.html`
2. run targeted Jest coverage
3. do a manual UI acceptance pass with at least:
	1. guitar source to piano listener
	2. low-to-high mode
	3. high-to-low mode
	4. default mode regression

Expected result:

The feature is shippable without broad listener rewrites.

## Non-Goals

The following items should stay out of scope for sprint 126:

1. no Listener plugin
2. no redesign of NamedNote listener behavior
3. no new general-purpose listener algorithms beyond the three approved modes
4. no deeper target-row preference heuristics for non-piano instruments
5. no broad replay-pipeline refactor unrelated to listener projection
6. no changes to relative-section semantics

## Main Risks

1. sorting source strings by visual row instead of actual string starting pitch
2. making `listenerProjection` required in schema and breaking old songs
3. duplicating mapping logic separately in played and recorded replay paths
4. changing current row-aware replay behavior by accident when mode is `row-midi`
5. mishandling collision order so low-to-high and high-to-low do not deterministically differ
6. breaking recorded highlight playback because it is beat-driven and not replayed through the same code as played notes

## Validation Plan For Iteration 3

At minimum, Iteration 3 should validate:

1. a legacy song with no `listenerProjection` still replays as before
2. a guitar listener wired to piano in `midi-low-to-high` shows notes from all source strings
3. the same setup in `midi-high-to-low` changes collision winners as expected
4. looped recorded notes and highlights also project by MIDI-only mode
5. the Wiring UI restores the saved mode after reload

## Suggested Completion Criteria

Sprint 126 is complete when all of the following are true:

1. existing songs replay exactly as before unless the new projection mode is chosen
2. Wiring UI exposes a persisted `listenerProjection` select
3. MIDI-only projection works for listener `playedNotes`
4. MIDI-only projection works for listener `recordedNotes` / Highlights
5. low-to-high and high-to-low produce deterministic overwrite behavior
6. the implementation remains in core wiring/listener code with the mapping logic centralized in `move-helpers.js`
