# Iteration 1 : Implementation Plan

## Summary

This sprint extends `TransposePlugin` so it can optionally handle `SingleNote` values, using only the existing "stay on the same string" behavior already proven in `MovePlugin`'s `"string"` algorithm.

This is a good fit for plugin-layer implementation. The design is consistent with the current plugin philosophy: keep the complexity local to `TransposePlugin`, reuse only shared plumbing and public API, and avoid new contracts with core.

The main implementation risk is not the transposition math itself, but matching existing project conventions in:

- plugin option parsing and menu display
- how `TransposePlugin` currently iterates cells and note lanes
- how `MovePlugin` currently computes same-string octave wrapping
- whether hidden/off-neck `SingleNote` storage is already preserved by `Section`
- how nut position is represented for non-zero-nut instruments such as banjo

## Initial evaluation against expected code structure

Based on the design and known plugin patterns in this repository, the likely implementation is straightforward:

- `TransposePlugin` already has traversal and mutation flow for transposing note content.
- `MovePlugin` already has the one-string wrapping behavior that should be copied in a limited, local way.
- The feature can be gated behind new menu options without affecting existing named-note behavior.
- The new logic appears isolated to `SingleNote` handling and should not require core data model changes if off-screen notes are already tolerated.

However, before coding, the following code-level assumptions should be confirmed in the actual files:

1. `TransposePlugin` currently operates independently on note lanes, so `NamedNote` and `SingleNote` can be toggled separately.
2. `MovePlugin`'s `"string"` behavior is implemented in a form that can be copied or adapted without pulling in unrelated move semantics.
3. The API already exposes per-string nut position lookup, including banjo-style non-zero nut handling.
4. `Section` storage already tolerates notes at columns beyond the visible neck width.
5. Plugin option parsing can distinguish:
   - empty value `""`
   - numeric `0`
   - positive integer values
   - boolean `false`

If any of these are false, the sprint remains feasible, but the implementation should be adjusted before coding begins.

## Scope

### In scope

- Add `SingleNote` support to `TransposePlugin`
- Add menu options:
  - `s) single notes [false]`
  - `o) octaves []`
- Support same-string wrapping only
- Preserve current `NamedNote` behavior
- Allow both `NamedNote` and `SingleNote` processing in one run
- Respect per-string nut position
- Preserve off-screen notes if repository behavior already supports that

### Out of scope

- `TinyNote`
- `Bend`
- `Highlight`
- string-crossing algorithms
- generalized algorithm menu for `TransposePlugin`
- core API or core model redesign

## Proposed behavior

## 1. Menu/options behavior

`TransposePlugin` should gain two new options:

- `named notes` remains existing behavior and default `true`
- `single notes` new, default `false`
- `octaves` new, default empty

Expected meanings:

- `single notes = false`: ignore `SingleNote`
- `single notes = true`: process `SingleNote`
- `octaves = ""`: wrap according to full neck length from the opposite end, as described in design
- `octaves = 0`: allow same-string transposition growth/shrinkage without forced one-octave wrapping, but still prevent negative-fret results by wrapping upward as needed
- `octaves = 1`: force one-octave wrap behavior when threshold is crossed, matching current `MovePlugin` string-style behavior
- `octaves >= 2`: permit larger octave-distance wrapping behavior when neck length allows it

Implementation note: empty string and numeric zero must remain distinct values.

## 2. SingleNote transposition behavior

For `SingleNote`, transposition should not attempt to choose a new string. It should remain on the same string and adjust fret/column only.

Conceptually:

- apply transpose delta
- if result remains valid under configured wrapping rules, keep it
- if result exceeds playable boundary, wrap from opposite end in octave steps
- if result falls below string nut, wrap upward in octave steps until it is at or above nut
- if the result is still outside visible range but valid for storage, preserve it in the `Section`

This logic should be local to `TransposePlugin`, even if it is adapted from `MovePlugin`.

## 3. NamedNote coexistence

If both toggles are enabled:

- `NamedNote` transposition should continue exactly as it works today
- `SingleNote` transposition should run in its own lane/path
- neither note type should interfere with the other

If both toggles are disabled, the plugin should be a no-op.

## Planned implementation steps

## Step 1: Audit current code paths

Review:

- `TransposePlugin`
- `MovePlugin`
- plugin option/menu registration conventions
- any shared plugin utilities for parsing option values
- API helpers for nut position and neck bounds
- tests covering transpose and move behavior

Goal of this step:

- identify exact mutation points for `SingleNote`
- identify the smallest reusable part of `MovePlugin`'s string wrapping logic
- verify whether off-screen notes are already preserved

## Step 2: Define local helper behavior inside TransposePlugin

Add internal helper logic to `TransposePlugin` for same-string `SingleNote` transposition.

Suggested responsibilities:

- detect whether a cell contains supported `SingleNote` content
- compute candidate transposed fret/column
- determine low bound from string nut, not hardcoded zero
- determine high bound from neck end
- apply wrapping according to `octaves`
- return updated note position or unchanged note if unsupported

Important: keep this helper internal to the plugin unless there is already an obvious shared plugin utility for exactly this behavior.

## Step 3: Add new plugin options

Update `TransposePlugin` menu/config handling to include:

- `single notes`
- `octaves`

Requirements:

- display defaults exactly as designed
- preserve backward compatibility for existing `NamedNote` workflows
- parse blank `octaves` distinctly from numeric `0`

## Step 4: Extend traversal logic

Update `TransposePlugin` processing loop so it:

- processes `NamedNote` when enabled
- processes `SingleNote` when enabled
- skips unsupported note types
- preserves existing event/plugin-manager behavior

## Step 5: Implement same-string wrapping rules

Match the design in this order:

1. Keep note on same string only
2. Respect nut position from API
3. For values below nut, wrap upward by 12 until non-negative relative to nut
4. For values above neck range, wrap from the other end according to configured octave behavior
5. If repository already supports hidden notes beyond visible columns, preserve them rather than deleting or clamping them

This step should copy behavior intentionally from `MovePlugin`, but only the subset needed for transpose.

## Step 6: Add tests

Add or extend tests for:

### Menu/config parsing

- defaults: named notes true, single notes false, octaves empty
- explicit empty octaves
- octaves zero
- octaves one
- octaves greater than neck-supported octave distance

### SingleNote transposition

- transpose up within visible range
- transpose down within visible range
- transpose up past neck end with `octaves = ""`
- transpose up past threshold with `octaves = 1`
- transpose down below nut wraps upward
- banjo/non-zero nut case
- short neck less than 13 cells
- hidden/off-screen note preservation if supported

### Coexistence behavior

- named notes only
- single notes only
- both enabled
- both disabled

### Non-supported note types

- confirm `TinyNote`, `Bend`, and `Highlight` are untouched

## Step 7: Update sprint/design documentation if needed

After implementation, update sprint notes to capture any confirmed behavior differences discovered in the code.

Also fix the sprint doc cross-references that currently point to sprint 111 instead of sprint 113.

## Design questions to resolve before coding

These are the main items that should be answered from the actual code during implementation:

1. **What exactly is the stored coordinate for `SingleNote` in `TransposePlugin` terms?**  
   Need to confirm whether the plugin edits a column/fret field directly, or derives position another way.

2. **Does `TransposePlugin` already distinguish note lanes cleanly?**  
   The design assumes `NamedNote` and `SingleNote` can be handled independently.

3. **What is the exact current `MovePlugin` rule for `"string"` and octave cap?**  
   The sprint should match that behavior where intended, not merely approximate it.

4. **How should `octaves = 0` behave at the upper boundary?**  
   The design says empty, 0, and positive integers are all allowed, but the difference between empty and zero should be verified from desired UX before coding.

5. **Is hidden/off-screen note persistence already covered by tests?**  
   If not, tests should be added before relying on that behavior.

6. **What should happen if a wrapped result still cannot be shown on the current neck?**  
   Current design suggests preserve in storage if valid. That should be confirmed against existing renderer assumptions.

7. **Should invalid `octaves` input be normalized or rejected?**  
   For example negative numbers, non-numeric strings, or whitespace-only values.

## Recommended acceptance criteria

This sprint is complete when:

- `TransposePlugin` exposes `single notes` and `octaves` options
- existing named-note transpose behavior remains unchanged
- `SingleNote` transposition works on the same string only
- wrapping respects nut position and neck end
- `octaves = 1` reproduces the intended one-octave wrap behavior
- unsupported note types remain untouched
- tests cover visible, hidden, short-neck, and non-zero-nut cases

## Recommended implementation order

1. audit `TransposePlugin` and `MovePlugin`
2. confirm note storage and nut APIs
3. add option parsing and menu display
4. add local `SingleNote` transpose helper
5. wire helper into traversal
6. add tests
7. run full plugin-related test suite
8. update docs

## Conclusion

The design is sound and appears implementable without core changes, provided the existing code confirms the expected storage and API behavior.

The only meaningful pre-coding uncertainties are:

- exact `SingleNote` storage/mutation shape
- exact interpretation of `octaves = ""` versus `0`
- confirmation that off-screen note persistence is already safe

These should be resolved in the first coding pass before behavior is finalized.