# Sprint 112: Piano Skeuomorphic Implementation Plan

## Goal

Add an opt-in skeuomorphic piano layout for one-row Piano tunings, with minimal core impact and no behavior change for other tunings.

## Approved Decisions From Design Chat

- Follow Option B: keep the current note table as the model/render source and add a piano-specific decorator layer.
- `piano.shtml` was only a guide, not a DOM contract to reproduce literally.
- The new tuning property name is `pianoSkeuomorphic`.
- The feature is limited to one-row Piano tunings.
- It is available to any tuning whose `baseInstrument` is `Piano`, but only when the sibling checkbox is checked.
- Natural fret widths are not the target layout for this mode. The mode may still coexist with them, but precise piano alignment is only expected when natural fret widths are off.
- Non-key gaps and decorative overlap regions should not imply clickability.

## Implementation Strategy

1. Add a small shared helper module to answer two questions:
   - can this tuning support the piano skeuomorphic layout?
   - is it currently enabled?
2. Reuse the existing tuning-driven rebuild path, parallel to `pianoNamesRow`.
3. Keep the core hook narrow:
   - `TableBuilder.buildNoteTable()` imports the helper and adds a table class only when the feature is enabled.
4. Put layout behavior into a new dedicated CSS file under `templates/piano/`.
5. Scope all new CSS to a piano-only table class so non-piano and non-opted-in tunings are unaffected.

## Actual Code Changes

### New Files

- `templates/piano/piano-skeuomorphic.builder.js`
  - Pure helper functions for support/enabled gating.
- `templates/piano/piano-skeuomorphic.css`
  - Scoped keyboard layout rules for one-row piano tables.
- `_tests/jest/piano-skeuomorphic.builder.test.js`
  - Covers the capability and opt-in gating rules.

### Core Files Touched

- `TableBuilder.js`
  - Imports the piano helper.
  - Adds the `pianoSkeuomorphicTable` class only when the feature is enabled.
  - Marks the surrounding instrument wrapper for scoped styling.
  - Adds a reusable `namesRowTR` class and carries note classes onto `namesRowCell` so the piano CSS can align the note-name row with the keyboard geometry.

- `TuningsLibrary.js`
  - Adds a new `PianoSkeuo` checkbox column in the tunings table.
  - Enables the checkbox only for one-row Piano tunings.
  - Wires checkbox changes into the existing `requestReinstallAllTuningsTables()` path.

- `index.html`
  - Loads the new dedicated piano CSS file.

- `tunings.js`
  - Adds the new `pianoSkeuomorphic` property for the `PianoSkeuomorphic` seed tuning.

- `tunings.json`
  - Mirrors the `pianoSkeuomorphic` property for the same tuning definition.

## Layout Approach Chosen

The implementation does not create a second piano DOM tree.

Instead, it remaps the existing one-row note table into a keyboard-like layout by CSS:

- white-key notes become the visible width-bearing keys
- black-key notes collapse to zero layout width and render their `.NoteDisplay` as an overlapping raised key
- the note-name row uses the same white/black spacing logic so labels align with the keyboard

This keeps the existing note rendering, highlighting, playback classes, and click bubbling intact.

## Why This Keeps Core Impact Low

- The rebuild model is unchanged.
- The note table remains the source of truth.
- No new global rendering pipeline was added.
- The feature is fully opt-in.
- The CSS is isolated in a dedicated piano template file.

## Known Limits

- Only one-row Piano tunings are supported.
- The layout is tuned for fixed-width rendering. It does not attempt to perfectly honor natural fret width mode.
- The mode is intended as a skeuomorphic presentation of the existing semitone table, not a wholesale replacement of the note model.

## Validation

- Added a focused Jest test for gating behavior in the helper module.
- Manual visual validation is still recommended in the browser for final key proportions and text placement.

## Recommended Follow-Up Checks

1. Test `PianoSkeuomorphic` with `pianoSkeuomorphic` on and off.
2. Test another one-row Piano tuning by checking the new checkbox.
3. Verify the note-name row alignment when `pianoNamesRow` is on.
4. Confirm that non-piano and multi-row piano tunings remain unchanged.