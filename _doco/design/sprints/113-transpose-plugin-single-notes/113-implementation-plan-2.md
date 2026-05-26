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

Implementation remains plugin-local and should follow this order:

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
10. update sprint notes with any confirmed code-level discoveries

## Expected behavior summary

### Menu/options

- `named notes` remains default `true`
- `single notes` defaults to `false`
- `octaves` defaults to empty display `[]`
- invalid `octaves` input becomes `0` with message output
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

Tests should cover:

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