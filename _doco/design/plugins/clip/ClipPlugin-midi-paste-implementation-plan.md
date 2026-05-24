# ClipPlugin MIDI Paste Implementation Plan

## Goal

Add a new ClipPlugin action menu item:

- `M) MIDI Paste`

This action revives a stored CLIP into the current target instrument even when the source and target tunings differ, as long as the first sprint scope is satisfied.

Initial target scope for the next sprint:

- 6-string Guitar to 6-string Guitar only
- primary use case: `S6` and `P46`
- no string-count mismatch handling in this sprint
- no general cross-instrument support in this sprint

The intent is to reuse the user experience of the current Clip workflow while adding a second revive algorithm that maps by MIDI pitch per string and drops notes that do not land legally on the target neck.

## User Story

As a user, I want to:

- clip notes from one 6-string guitar tuning
- move to another 6-string guitar tuning with a different nut MIDI layout
- press `M` in ClipPlugin
- revive the clip so played notes are translated string-wise by MIDI pitch rather than by raw row/col coordinates

This should behave like a paste operation, not like a configurable batch transform. The action should be mashable.

## Proposed Menu Shape

Under `/fpc` add:

- `M) MIDI Paste`

Proposed behavior:

- if `automatic [true]`, `M` immediately revives clip `1`
- if `automatic [false]`, `M` opens the same style input used by `V`, defaulting to `1`, with the numbered compatible clip list visible in the menu area
- `M` should stay at `/fpc` after execution, matching current automatic `C`, `X`, `V`, and `L`

Open question to confirm:

- should `M` reuse the same compatible clip chooser list as `V`, or should it show a narrower list that only includes cross-tuning-compatible clips for the selected target table?

Recommended answer:

- reuse the same chooser list, but compute compatibility using a broader rule than exact `fromBaseID`

## First-Sprint Compatibility Rule

Current `V` revive means:

- same source tuning family only

New `M` MIDI Paste means:

- source and target may differ
- source and target must both be 6-string guitars
- source and target must both expose usable `rowRange`
- source and target must both be treated as non-wired real tables

Suggested first-sprint gating rule:

- `source.baseInstrument === 'Guitar'`
- `target.baseInstrument === 'Guitar'`
- `source.nStrings === 6`
- `target.nStrings === 6`
- `source.rowRange.length === 6`
- `target.rowRange.length === 6`

This keeps the scope aligned to `S6` vs `P46` and avoids accidental support claims for Bass, Banjo, Piano, or mixed string counts.

## Core Algorithm

### Summary

`MIDI Paste` should map each played note by MIDI pitch on the same string index.

For each played note in the clip payload:

1. Read source note `row`, `col`, `styleNum`, and `midinum`
2. If `midinum` is absent, reconstruct it from the source tuning layout and source row/col
3. On the target tuning, stay on the same `row`
4. Find the target cell on that row whose `midinum` matches the source note MIDI value
5. If found, place the note at the target row/col
6. If no legal target cell exists on that row, drop the note

This is intentionally string-wise only. It does not search adjacent strings.

### Why This Fits The Request

This matches the requested behavior:

- similar to MovePlugin in a MIDI-aware sense
- limited to a drop-only landing rule
- preserves string identity rather than chasing nearest-string alternatives

### Legal Landing Rule

A played note is legal if:

- target row exists
- target row contains a cell with matching `midinum`
- target `col` is within the target neck's legal range

Equivalent practical rule:

- if the derived fret would be below the nut, drop
- if the derived fret exceeds the target fret limit, drop

The existing tuning layout helpers in [move-helpers.js](move-helpers.js) already provide a good base for this through `createTuningLayout()` and row/MIDI lookup helpers.

## Proposed Implementation Structure

### 1. Shared Compatibility Helpers

Add or extend shared helpers in [move-helpers.js](move-helpers.js):

- `getTuningCompatibilityID(tuning)` already exists and should remain for same-family revive
- add a new helper for MIDI-paste eligibility, something like:
  - `canMidiPasteBetweenTunings(sourceTuning, targetTuning)`

This should check the first-sprint constraints only.

### 2. Clip Graveyard Metadata

Current clip records already store:

- `tableID`
- `baseID`
- `fromBaseID`
- `frets`

For MIDI Paste, we should confirm that the clip payload always stores enough source tuning information to reconstruct MIDI positions safely.

Recommended source payload fields:

- `tableID`
- `baseID`
- `fromBaseID`
- `baseInstrument`
- `nStrings`
- `rowRange`
- `frets`
- `nut`
- `reverse`

Rationale:

- relying on the current live song state for the source tuning is brittle if the source table is deleted or renamed later
- the clip payload should be self-describing enough to support later revive operations

Open question to confirm:

- is payload growth acceptable for CLIP records if it improves revive correctness?

Recommended answer:

- yes, store the minimal source tuning layout fields directly in the payload

### 3. New Menu Node Builder

Add a builder in [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js):

- `buildMidiPasteMenuNode(song)`

Behavior:

- `automatic [true]`: no input, `actionName: 'midiPasteClipChoice'`, immediate default choice `1`
- `automatic [false]`: input `clip number`, default `1`, preview list visible

### 4. New Action Entry Point

Add a new action handler:

- `midiPasteClipChoice(song, rawChoice)`

This should parallel `reviveClipChoice()` but dispatch to a distinct revive path.

Then add:

- `midiPasteClip(song, recordIndex)`

### 5. Revive Mapping Implementation

Recommended internal flow:

1. Resolve selected clip record by chooser index
2. Resolve selected target tuning from current ClipPlugin `targetTable`
3. Read source tuning metadata from clip payload
4. Validate `canMidiPasteBetweenTunings(source, target)`
5. Build source and target layouts with `createTuningLayout()`
6. For each note in `payload.sectionNotes.playedNotes`:
   - determine source MIDI pitch
   - find target landing cell on the same row with matching MIDI pitch
   - if no cell, drop
   - if collision and `overwrite === false`, skip
   - if collision and `overwrite === true`, replace
7. Apply NamedNotes according to the confirmed rule
8. Write summary counts and update `lastRevived`

## Proposed NamedNotes Rule

This needs explicit specification.

Three reasonable options:

1. Copy NamedNotes unchanged
2. Skip NamedNotes during `MIDI Paste`
3. Respect the include toggles, but copy NamedNotes unchanged while only remapping played notes by MIDI

Recommended first-sprint choice:

3. Respect include toggles, but treat NamedNotes as tuning-agnostic and copy them unchanged

Reasoning:

- NamedNotes are not row/col anchored
- the current plugin already treats them as a separate lane
- users will expect the current include semantics to remain intact

Open question to confirm:

- should NamedNotes still obey `overwrite` in MIDI Paste exactly as they do in normal revive?

Recommended answer:

- yes

## Proposed PlayedNotes Coverage

First-sprint supported note styles:

- `single`
- `tiny`
- `bend`

Recommended first-sprint bend behavior:

- preserve bend metadata
- remap bend notes exactly like other played notes by target row + MIDI landing
- if landing cell is illegal or missing, drop

Open question to confirm:

- should there be any bend-specific legality restriction beyond normal fret legality in MIDI Paste?

Recommended answer:

- no additional rule in sprint 1 unless an existing bend legality helper is already required by the target table

## Collision Semantics

Keep the current Clip overwrite model:

- `overwrite [false]`: skip collisions
- `overwrite [true]`: replace collisions

Collision identity for played notes should remain:

- same `styleNum`
- same `row`
- same `col`

This keeps the summary language and user expectations consistent with current `V` revive.

## Compatibility Summary UI

The current `V` summary shows:

- `[count:latestLabel]`

For `M`, consider showing a different summary token later, but not necessarily in sprint 1.

Safe sprint-1 choice:

- reuse the same preview list and default chooser behavior
- keep menu text simple: `MIDI Paste`

## Failure Modes

The action should fail safely with clear result strings for:

- no selected target table
- no compatible clip chosen
- invalid clip number
- source payload missing required tuning layout fields
- source and target outside sprint-1 compatibility scope

Suggested result examples:

- `MIDI Paste skipped: invalid choice`
- `MIDI Paste skipped: choice 3 not available`
- `MIDI Paste skipped: source/target tunings are not supported for MIDI Paste`

## Testing Plan

### Focused Unit Tests

Add tests in [_tests/jest/clip-plugin.test.js](_tests/jest/clip-plugin.test.js) for:

- `M` node shape when `automatic === true`
- `M` node shape when `automatic === false`
- same-row S6 -> P46 remap success for legal notes
- same-row P46 -> S6 remap success for legal notes
- drop when target fret would be below legal range
- drop when target fret exceeds target frets
- collision skip when `overwrite === false`
- collision replace when `overwrite === true`
- NamedNotes behavior under the chosen rule
- bend preservation or drop behavior

### Regression Tests

Keep or extend tests for:

- existing `V` revive semantics remain unchanged
- same-family revive using `fromBaseID` still works
- automatic menu behavior remains stable at `/fpc`

## Suggested Implementation Order

1. Extend clip payload source metadata to include the required source tuning fields
2. Add shared `canMidiPasteBetweenTunings()` helper
3. Implement row-wise MIDI landing helper using existing layout utilities
4. Add `M` menu node and automatic/manual chooser behavior
5. Implement `midiPasteClipChoice()` and `midiPasteClip()`
6. Add focused Jest coverage for S6 <-> P46
7. Validate no regressions in current Clip revive/copy/cut flows

## Required Specification Decisions Before Coding

These should be explicitly approved before the sprint starts:

1. NamedNotes rule during MIDI Paste
2. Whether the chooser list for `M` reuses all clips or only MIDI-paste-eligible clips
3. Whether bend notes follow normal landing legality only
4. Whether source tuning layout fields should be fully embedded in the CLIP payload
5. Whether `M` should stay hidden when the target tuning is outside sprint-1 scope, or remain visible and fail with a clear message

## Recommended Defaults For Next Sprint

If no further specification is given, the safest defaults are:

1. NamedNotes copy unchanged and still obey overwrite
2. `M` reuses the standard clip chooser
3. bends are treated like other played notes
4. source tuning layout is embedded in the clip payload
5. `M` stays visible but returns a clear unsupported-scope result when the current target is not supported

## Out Of Scope For This Sprint

- different string counts
- non-Guitar instruments
- cross-row remapping
- nearest-string search
- capos or alternate pitch transforms
- recorded notes
- cross-song clipboard normalization

## Expected Result

At the end of the next sprint, a user should be able to:

- clip from `S6`
- move to `P46`
- press `M`
- get a string-wise MIDI-aware paste that lands legal notes and drops illegal ones

And the reverse path, `P46` to `S6`, should work by the same rule.