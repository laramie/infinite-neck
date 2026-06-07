# sprint-113-transpose-plugin-single-notes

sprint number: 113

sprint short name: transpose-plugin-single-notes

date: 20260525

Index of all sprints for reference to how other plugins have been discussed, designed, and implemented: [sprint planning index](_doco/lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to:

- add `SingleNote` support to `TransposePlugin`
- keep `SingleNote` transposition limited to same-string behavior only
- copy only the proven `"string"`-style wrapping behavior from `MovePlugin`
- preserve plugin-layer isolation, avoiding core redesign

## Sprint document locations

- [sprint-113 design document](113-design.md)
- [sprint-113 implementation plan](113-implementation-plan.md)

## Scope summary

### In scope

- `TransposePlugin` support for `SingleNote`
- new plugin menu options:
  - `s) single notes [false]`
  - `o) octaves []`
- same-string wrapping only
- preservation of existing `NamedNote` transpose behavior
- support for running `NamedNote` and `SingleNote` transposition together
- per-string nut handling, including non-zero nut instruments
- preservation of off-screen notes if current `Section` storage already supports it
- participation of `SingleNote` in `resetSong` and `resetSong hard`

### Out of scope

- `TinyNote`
- `Bend`
- `Highlight`
- string-crossing logic
- generalized transpose algorithm selection
- core API/model redesign

## Design status

Iteration 1 established that the feature belongs cleanly in `TransposePlugin` and should reuse only public API and existing plugin conventions.

Iteration 2 answered the remaining design questions and refined expected behavior:

- no meaningful distinction is required between:
  - `"octaves": 0`
  - `"octaves": null`
  - `"octaves": undefined`
  - `"octaves": ""`
  - `"octaves"` values larger than the visible neck supports
- these cases should all continue using the maximum usable fret space and then rely on `Section` storage for off-screen notes when needed
- when approaching the nut, notes must wrap upward before becoming negative or otherwise illegal for the current string's nut position
- on short necks, off-screen storage is acceptable and preferred over lossy behavior
- transposition should use scratch-set style calculation so all note destinations are computed before writing back
- if user-selected `"octaves": 1` would cause collisions, behavior should fall back to full-neck/off-screen placement, and the plugin should rewrite the option value so the user can see what happened
- invalid `"octaves"` input should normalize to `0` and emit a `showMessages` notice
- `help` output should describe legal `octaves` values statically
- all fields on `SingleNote` must be preserved
- `SingleNote` must participate in `resetSong` and `resetSong hard`

## Planned implementation summary

Implementation remained plugin-local and was completed in this order:

1. audit `TransposePlugin` and `MovePlugin`
2. confirm exact `SingleNote` storage shape and reset metadata usage
3. add menu/config support for:
   - `named notes`
   - `single notes`
   - `octaves`
4. validate and normalize `octaves`
5. add local same-string `SingleNote` transpose helper
6. compute note movement through a scratch set before write-back
7. add collision fallback from `octaves:1` to full-neck/off-screen behavior
8. integrate `SingleNote` into reset flows
9. add tests
10. update sprint notes with confirmed code-level discoveries

## Implementation outcome

Implementation is complete.

`TransposePlugin` now has:

- `SingleNotes` toggle support, default `false`
- `octaves` string-backed property, default empty
- same-string `SingleNote` transposition across all sections and all section tables that map to a live `myTunings` entry
- collision fallback from capped octave mode to full-neck/off-screen mode, with `octaves` rewritten to `0`
- `SingleNote` participation in `apply`, `reset current interval`, `reset original`, and `Looper:OnResetSong`
- help/summary output updated to describe the new options

Validation was completed with Jest:

- targeted transpose and persistence suites passed
- full repository Jest suite passed
- final green count: `28` suites, `323` tests

## Code-confirmed adjustments

The implementation matches the design direction, with these code-confirmed details:

- `octaves` is implemented as a `String` plugin property rather than an integer-type property, because the plugin property system must preserve the semantic distinction between empty string and numeric values.
- invalid `octaves` input normalizes to `0` and is surfaced through the plugin action/message response path, which is the plugin-local equivalent used here instead of adding a new direct UI contract.
- existing `transposeSong()` behavior was intentionally preserved, so root/key transposition and existing named-note handling remain unchanged even when `NamedNotes` is `false`; the new `SingleNote` movement is additive to that existing path.
- same-string `SingleNote` movement is implemented with plugin-local table/tuning traversal using `createTuningLayout()` from move helpers, rather than by introducing a new core API.
- the implementation preserves all `SingleNote` object fields by cloning the original note object and only rewriting note-position fields and recalculated auto-color values.
- collision fallback is evaluated on the fully transposed scratch result for a table before write-back, preserving the non-lossy behavior intended by Iteration 2.
- off-screen storage is confirmed to work through normal `playedNotes` and `recordedNotes` persistence because the section note model does not clamp stored `col` values.

## Implemented behavior summary

### Menu/options

- `named notes` remains default `true`
- `single notes` is now present and defaults to `false`
- `octaves` is now present and defaults to empty display `[]`
- invalid `octaves` input stores as `0`
- help text now lists legal `octaves` values statically

### `SingleNote` transpose behavior

- movement stays on the same string only
- transpose updates `col`, `midinum`, and `noteName`
- all other note fields are preserved
- below-nut candidates wrap upward by octaves until they are legal for that string
- full-neck mode uses the largest visible octave span available on the current string and then permits off-screen storage when needed
- capped octave mode uses the requested octave span threshold; if that result would collide, the plugin falls back to full-neck/off-screen mode and rewrites `octaves` to `0`

### Reset behavior

- `reset current interval` reverses `SingleNote` movement back to the current sequence baseline
- `reset original` reverses `SingleNote` movement back to the original baseline
- `Looper:OnResetSong` soft/hard behavior now includes `SingleNote` movement through those same reset paths

## Expected behavior summary

### Menu/options

- `named notes` remains default `true`
- `single notes` defaults to `false`
- `octaves` defaults to empty display `[]`
- invalid `octaves` input becomes `0` with plugin message output
- help text should list accepted values and meanings

### `SingleNote` transpose behavior

- remain on the same string
- transpose fret/column only
- preserve all other `SingleNote` fields
- wrap upward when moving below the per-string nut
- for upper-bound overflow, use maximum available octave distance on the neck unless explicitly capped and non-lossy
- if capped one-octave behavior would collide, fall back to full-neck/off-screen behavior
- preserve off-screen note positions if the repository already allows that storage

### Coexistence

- `NamedNote` behavior must remain unchanged
- `NamedNote` and `SingleNote` may both run in one pass
- if both toggles are false, plugin is a no-op

### Reset behavior

- `SingleNote` must be included in `resetSong`
- `SingleNote` must be included in `resetSong hard`

## Testing summary

Tests now cover:

- menu defaults and parsing
- invalid `octaves` normalization and messaging
- empty/zero/full-neck `octaves` behavior
- `octaves:1` behavior
- collision fallback behavior
- same-string transpose up/down
- below-nut wrap
- non-zero-nut instruments
- short-neck off-screen persistence
- coexistence with `NamedNote`
- reset participation
- unsupported note types unchanged

Additional implemented coverage includes:

- menu presence of `SingleNotes` and `octaves`
- persistence/export of the new transpose properties
- interval-reset restoration of moved `SingleNote` data

## Iterations

### Iteration 1

- review design
- produce implementation plan

### Iteration 2

- refine behavior for `octaves`
- define collision fallback behavior
- define validation and messaging requirements
- confirm reset participation for `SingleNote`

### Iteration 3

- implement `TransposePlugin` changes
- add tests
- update sprint notes with any code-confirmed adjustments