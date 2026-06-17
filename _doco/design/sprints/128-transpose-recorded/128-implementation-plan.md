# Sprint 128 implementation plan: TransposePlugin recorded StringOneOctave

## Status

- Based on [128-design.md](128-design.md), including `Design Round 2 : Questions answered` through the end of the document.
- This plan is for review before coding.
- Goal: teach `TransposePlugin` to transpose `recordedNotes` with a fixed `StringOneOctave` behavior, while preserving existing plugin isolation and non-destructive reset semantics.

## Summary of approved design decisions

1. Add `/fptr` as `r) recorded`, an `org.dynamide.toggle`.
2. `s) single notes` remains in `TransposePlugin`, but it must apply only to `playedNotes` `SingleNote` values.
3. Existing recorded-SingleNote behavior under `s) single notes` is an obsolete early attempt and should be replaced by `r) recorded`.
4. `r) recorded=true` moves a fixed, non-configurable recorded-note style set:
	- `SingleNote`
	- `TinyNote`
	- `Bend`
	- `Fingering`
	- `Pitch`
	- `Multi`
5. `NamedNote` is not included in recorded-note transposition.
6. The algorithm is `StringOneOctave` only; no other `MovePlugin` algorithms are included.
7. The existing `octaves` option does not apply to `r) recorded`.
8. `TransposePlugin` must not drop notes for this feature.
9. If the one-octave path would collide, fall back to full-neck/off-screen placement rather than dropping.
10. Do not show UI messages for normal fallback, because resets and interval cycles would repeatedly disrupt user flow.
11. Malformed recorded notes should be cloned unchanged. If malformed notes are found, log with `console.log` and include `TransposePlugin` in the line. Do not use `showMessages`.
12. Bends must never land on tuning-derived nut cells. If a Bend candidate reaches a nut, immediately move it up one octave on the same row/string.
13. Short-neck instruments should allow off-screen `col` values to preserve reversibility.
14. Reverse/left-handed tunings use MIDI direction, not visual direction.
15. Keep implementation isolated to `TransposePlugin`; do not call `MovePlugin`.
16. Preserve core paint behavior: navigation paints `playedNotes`, looping paints `recordedNotes`; TransposePlugin should not try to enforce played-over-recorded precedence.
17. `Pitch` is MIDI-authoritative and means “highlight all notes with that MIDI number.” It should not be reduced to a single fret/cell idea.

## Files expected to change

Primary implementation files:

- [plugins/transpose/TransposePlugin.js](../../../../plugins/transpose/TransposePlugin.js)
- [plugins/transpose/properties.json](../../../../plugins/transpose/properties.json)
- [_tests/jest/transpose-plugin.test.js](../../../../_tests/jest/transpose-plugin.test.js)

Likely documentation after coding:

- [help-plugins.html](../../../../help-plugins.html), if plugin help snapshots are regenerated in this workflow.

Do not change core model files unless an already-existing helper is insufficient and a small reusable helper is clearly justified. The design preference is plugin-contained implementation.

## User-facing property plan

Add a persisted property to [plugins/transpose/properties.json](../../../../plugins/transpose/properties.json):

```json
{
  "name": "RecordedNotes",
  "caption": "recorded",
  "trigger": "r",
  "datatype": "org.dynamide.toggle",
  "value": false,
  "defaultValue": false,
  "inputCaption": "true|false",
  "visibleInMenu": true
}
```

Recommended menu order in `getVisibleMenuChildren()`:

1. `apply`
2. `resetMenu`
3. `help`
4. `intervals`
5. `NamedNotes`
6. `SingleNotes`
7. `RecordedNotes`
8. `octaves`
9. `autoSharpsFlats`
10. `doLeadKey`

The toggle should be exported and loaded by the existing `exportSongState()` / `loadSongState()` paths because those iterate over non-action properties.

## State and reset integration

No new runtime offset state is needed.

The existing reset model already funnels musical changes through `applySongDelta(delta, song)`:

- manual `Apply`
- `Reset > current interval`
- `Reset > original`
- `Looper:OnResetSong` soft reset
- `Looper:OnResetSong` hard reset
- `DaCapo:OnSongEnd` / event interval advance

Implementation rule:

1. Add recorded-note transposition inside `applySongDelta(delta, song)`.
2. Gate it with `getRecordedNotesEnabled()`.
3. Call it for every non-zero delta.
4. Do not update baseline state separately; `liveSongOffset` remains the authoritative plugin offset.

## Relationship between `SingleNotes` and `RecordedNotes`

Current behavior moves recorded `SingleNote` values when `SingleNotes=true`. That must end.

New behavior:

- `SingleNotes=true` moves only `playedNotes` whose `styleNum` is `Note.STYLENUM_SINGLE`.
- `RecordedNotes=true` moves `recordedNotes` for the approved fixed style set, including recorded `SingleNote`.
- When both toggles are true, recorded SingleNotes move exactly once, by the `RecordedNotes` path.

Implementation approach:

1. Refactor `transposeSectionTableSingleNotes(...)` or replace it with a played-only variant.
2. Ensure `transposeSingleNotesAllSections(...)` writes `playedNotes` only and leaves `recordedNotes` unchanged.
3. Add a separate `transposeRecordedNotesAllSections(...)` path for `recordedNotes`.

This cleanup is intentionally allowed by the design: the old recorded-SingleNote implementation need not be preserved once its lessons are captured.

## Note style behavior

### Cell-bound styles

These styles should share the cell-bound `StringOneOctave` path:

- `Note.STYLENUM_SINGLE`
- `Note.STYLENUM_TINY`
- `Note.STYLENUM_BEND`
- `Note.STYLENUM_FINGERING`
- `Note.STYLENUM_MIDIPITCHESSINGLE`

For each note:

1. Clone the original note.
2. Parse `row`, `col`, and `midinum`.
3. If `row` is malformed, clone unchanged and log a malformed-note diagnostic.
4. If `col` is malformed but `midinum` and row tuning are available, infer source fret from `midinum - rowOpenMidi`.
5. If source fret cannot be inferred, clone unchanged and log a malformed-note diagnostic.
6. Compute same-string transposition from `sourceFret + delta`.
7. Apply `StringOneOctave` one-octave normalization.
8. Recompute:
	- `row`
	- `col`
	- `midinum`
	- `noteName`
9. Preserve all other fields, including `bendValue`, `finger`, color fields, and any user-authored metadata.
10. Recalculate automatic functional colors only if the existing code path already does so for the equivalent SingleNote behavior.

### Bend-specific rule

For `Note.STYLENUM_BEND`:

1. Landing legality must use tuning-derived nut structure, not `col === 0`.
2. Use row-specific nut information from `createTuningLayout(tuning)`.
3. If the normalized landing is the nut cell for the row, add 12 repeatedly until it is not the nut.
4. Preserve `bendValue`.
5. Never drop the Bend.

### Pitch-wide style

`Note.STYLENUM_MIDIPITCHES` / `Pitch` is not a cell-bound single-fret note.

Implementation rule:

1. Treat `midinum` as authoritative.
2. Compute `targetMidinum = sourceMidinum + delta`.
3. Apply one-octave repeat behavior to MIDI if needed to preserve the `StringOneOctave` cycle. The exact persisted `row` should be a deterministic display row, not a semantic restriction.
4. Recompute `noteName` from `targetMidinum`.
5. Recompute `row` using a deterministic preferred cell for `targetMidinum` when possible.
6. Do not require `col`; if present, it may be deleted or left untouched only if existing Pitch persistence conventions require it. Prefer deleting `col`, matching MovePlugin's treatment of `STYLENUM_MIDIPITCHES`.
7. The UI meaning remains: highlight all cells with that MIDI number when displayed.

Open implementation detail to verify while coding: use the same projection helper behavior that currently resolves `STYLENUM_MIDIPITCHES` rows in MovePlugin where practical, but keep the code local or helper-level rather than invoking MovePlugin.

## StringOneOctave algorithm plan

### Definitions

For a row/string:

- `openMidi`: `tuning.rowRange[row]`
- `sourceFret`: `note.col`, or `note.midinum - openMidi` if `col` is missing
- `nutCol`: tuning-derived row nut cell `col`
- one-octave window lower bound: `nutCol`
- one-octave window upper bound: `nutCol + 12`

### One-octave normalization

For cell-bound notes:

1. `targetFret = sourceFret + delta`
2. While `targetFret < nutCol`, add 12.
3. While `targetFret > nutCol + 12`, subtract 12.
4. For Bends only, while the target is the row's nut cell, add 12.
5. `targetMidinum = openMidi + targetFret`
6. `targetCol = targetFret`

This intentionally allows off-screen `targetCol` on short-neck instruments and in fallback mode. It also intentionally uses MIDI direction even on reversed tables.

### Full-neck/off-screen fallback

If one-octave normalization produces a collision within the transformed recorded-note set, rerun the affected table with full-neck/off-screen mode.

Full-neck/off-screen behavior should follow current TransposePlugin semantics:

1. Keep same string.
2. Wrap below-nut results upward until legal.
3. Do not force the `nutCol + 12` upper threshold.
4. Allow off-screen high `col` values.
5. Never drop.

No UI message should be emitted for this fallback.

Optional developer diagnostic: a `console.log` line containing `TransposePlugin` may be useful during coding, but normal fallback should not spam production console output unless the project wants that diagnostic.

## Collision policy

### What to detect

Detect collisions within the transformed recorded-note set for a single section/table.

Use lane-aware keys compatible with current model behavior:

- Single lane: `SingleNote` at beat + row + col
- Tiny/Bend lane: `TinyNote` or `Bend` at beat + row + col
- Fingering lane: `Fingering` at beat + row + col
- Multi lane: `STYLENUM_MIDIPITCHESSINGLE` at beat + row + col
- Pitch lane: `STYLENUM_MIDIPITCHES` singular per beat or beat + MIDI, depending on current UI persistence behavior

Given the design's non-destructive goal, collision detection should be used only to decide fallback, not to delete or overwrite notes.

### What not to detect or enforce

Do not treat played-note occupancy as a reason to drop or rewrite recorded notes.

Reason:

- Core navigation paints `playedNotes`.
- Looping paints `recordedNotes` and can visually override played notes.
- The model still keeps both.
- The design explicitly wants TransposePlugin to preserve this simple core behavior and not outsmart it.

### Fallback scope

Recommended fallback scope: one section/table transformation.

If any recorded collision is found after one-octave transformation for a section/table:

1. Recompute that section/table's recorded notes using full-neck/off-screen mode.
2. Keep all notes.
3. Do not rewrite the user's `octaves` property.
4. Do not emit `showMessages`.

If implementation is simpler and safer, fallback may be widened to the whole table across all sections for that one `applySongDelta()`, but section/table fallback is more local and easier to reason about in tests.

## Malformed note handling

Malformed notes must be preserved.

Rules:

1. Clone unchanged if required fields cannot be parsed or inferred.
2. Do not drop.
3. Do not show UI messages.
4. Emit a `console.log` line containing `TransposePlugin`.
5. Prefer summarizing malformed notes per `applySongDelta()` to avoid console spam.

Recommended message shape:

```text
TransposePlugin recorded note preserved unchanged: malformed row/col/midinum in table tblP46_1 beat 3
```

## Helper/refactor plan

### Existing helpers to preserve or reuse

Current useful code in [plugins/transpose/TransposePlugin.js](../../../../plugins/transpose/TransposePlugin.js):

- `toInt(...)`
- `clone(...)`
- `buildRecordedNotes(...)`
- `getTuningByTableID(...)`
- `getRowBoundaries(...)`
- `normalizeSingleNoteColor(...)`
- `transposeSingleNoteOnString(...)` as a reference for same-string movement

### New or refactored helpers

Recommended helper names:

- `getRecordedNotesEnabled()`
- `isRecordedTransposeStyle(styleNum)`
- `isCellBoundRecordedTransposeStyle(styleNum)`
- `isPitchWideRecordedTransposeStyle(styleNum)`
- `getRowNutCol(layout, row)`
- `isNutLanding(layout, row, col)`
- `resolveSourceFret(note, tuning, row)`
- `normalizeFretStringOneOctave(targetFret, nutCol, { isBend })`
- `normalizeFretFullNeck(targetFret, nutCol)`
- `transposeCellBoundRecordedNote(...)`
- `transposePitchRecordedNote(...)`
- `transposeRecordedNotesForSectionTable(...)`
- `detectRecordedTransformCollision(recordedNotes)`
- `transposeRecordedNotesAllSections(delta, song)`
- `logMalformedRecordedTransposeNote(...)`

Keep these in [plugins/transpose/TransposePlugin.js](../../../../plugins/transpose/TransposePlugin.js) unless they become clearly reusable elsewhere.

## Detailed implementation phases

### Phase 1: Property and menu

1. Add `RecordedNotes` to [plugins/transpose/properties.json](../../../../plugins/transpose/properties.json).
2. Add `getRecordedNotesEnabled()`.
3. Add `recorded notes=${...}` to `buildSummary()`.
4. Add current setting/help text to `buildHelpMessage()`.
5. Add `RecordedNotes` to `getVisibleMenuChildren()` after `SingleNotes`.
6. Update existing menu test expectations.

### Phase 2: Make `SingleNotes` played-only

1. Replace `transposeSectionTableSingleNotes(...)` with a played-only table transform, or add a mode flag.
2. Ensure `transposeSingleNotesAllSections(...)` updates `sectionNotes.playedNotes` only.
3. Ensure recorded notes are cloned/preserved untouched when only `SingleNotes=true`.
4. Update existing tests that currently expect recorded SingleNotes to move under `SingleNotes=true`.

### Phase 3: Implement recorded StringOneOctave core

1. Add recorded style filtering.
2. Implement cell-bound transform for Single/Tiny/Bend/Fingering/Multi.
3. Implement Pitch transform.
4. Implement Bend nut legality using `createTuningLayout(tuning)` row nut cells.
5. Preserve malformed notes unchanged and log diagnostics.
6. Add collision detection and fallback to full-neck/off-screen transform.
7. Call `transposeRecordedNotesAllSections(delta, song)` from `applySongDelta()` when `RecordedNotes=true`.

### Phase 4: Reset/event integration verification

1. Verify `resetCurrentInterval()` moves recorded notes back.
2. Verify `resetOriginal()` moves recorded notes back.
3. Verify `Looper:OnResetSong` soft and hard resets move recorded notes through the same path.
4. Verify `DaCapo:OnSongEnd` interval advance moves recorded notes.

### Phase 5: Polish and docs

1. Ensure no `showMessages` path is used for recorded fallback.
2. Ensure no MovePlugin invocation or dependency is introduced.
3. Update plugin help snapshots/docs if this repo's workflow expects generated help updates.
4. Run targeted and full Jest validation.

## Test plan

Add or update tests in [_tests/jest/transpose-plugin.test.js](../../../../_tests/jest/transpose-plugin.test.js).

### Property/menu tests

1. Menu includes `RecordedNotes` after `SingleNotes`.
2. `RecordedNotes` trigger is `r`.
3. `PlayedNotes` remains absent.
4. `buildSummary()` and help include recorded setting.
5. `exportSongState()` persists `RecordedNotes`.
6. `loadSongState()` restores `RecordedNotes`.

### SingleNotes cleanup tests

1. `SingleNotes=true` moves played SingleNotes.
2. `SingleNotes=true` no longer moves recorded SingleNotes.
3. `SingleNotes=true` still participates in reset for played SingleNotes.

### RecordedNotes style coverage tests

Use a table such as `S6_1` or `P46_1` with recorded notes on one or more beats.

1. `RecordedNotes=true` moves recorded `SingleNote`.
2. `RecordedNotes=true` moves recorded `TinyNote`.
3. `RecordedNotes=true` moves recorded `Bend` and preserves `bendValue`.
4. `RecordedNotes=true` moves recorded `Fingering` and preserves `finger`.
5. `RecordedNotes=true` moves recorded `Multi` / `STYLENUM_MIDIPITCHESSINGLE` and recomputes cell fields.
6. `RecordedNotes=true` moves recorded `Pitch` / `STYLENUM_MIDIPITCHES` by MIDI and keeps it pitch-wide.
7. Recorded `NamedNote` is preserved unchanged.

### Bend/nut tests

1. A Bend transposed down onto a standard nut moves up one octave on the same row.
2. A Bend transposed down onto a row-specific BanjoNut moves up one octave on the same row.
3. The Bend never persists at the row's nut cell.

### Reset tests

1. Apply then `resetCurrentInterval` restores recorded notes.
2. Apply then `resetOriginal` restores recorded notes.
3. `Looper:OnResetSong` soft reset restores recorded notes to sequence baseline.
4. `Looper:OnResetSong` hard reset restores recorded notes to original baseline.

### Collision and fallback tests

1. One-octave collision triggers full-neck/off-screen fallback.
2. Fallback preserves all recorded notes.
3. Fallback does not rewrite `octaves`.
4. Fallback does not emit an action message.
5. Played-note occupancy does not cause recorded notes to drop or change policy.

### Malformed tests

1. Missing `row` clones unchanged and logs `TransposePlugin`.
2. Missing `col` but valid `midinum` infers fret and moves.
3. Missing `col` and unusable `midinum` clones unchanged and logs.

### Reverse/short-neck tests

1. Reverse tuning uses MIDI direction, not visual direction.
2. Short-neck instrument allows off-screen `col` and remains reversible.

## Validation commands

Targeted validation:

```sh
export INFINITE_NECK_VERBOSE=-1
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/transpose-plugin.test.js --verbose --runInBand
```

Full validation before handoff:

```sh
export INFINITE_NECK_VERBOSE=-1
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand
```

## Risks and mitigations

### Risk: accidental double transpose

If `SingleNotes=true` and `RecordedNotes=true`, recorded SingleNotes could be moved twice unless `SingleNotes` is made played-only first.

Mitigation: implement Phase 2 before Phase 3 and add a regression test.

### Risk: Pitch semantics collapse to one cell

`Pitch` should highlight all occurrences of a MIDI number. Treating it as a row/col note would change meaning.

Mitigation: keep `midinum` authoritative, do not require `col`, and follow pitch-wide display expectations.

### Risk: hidden destructive behavior

MovePlugin can drop. TransposePlugin should not.

Mitigation: no drop entries, no filtering-out malformed notes, no collision-based deletion.

### Risk: UI disruption during reset loops

Repeated fallback messages would interrupt flow.

Mitigation: no `showMessages` / action message for normal recorded fallback.

### Risk: malformed data console spam

Malformed notes could repeat on every interval.

Mitigation: summarize malformed diagnostics where practical; still include `TransposePlugin` in the log line.

## Acceptance checklist

Coding is complete when:

1. `/fptr` shows `r) recorded` and persists as `RecordedNotes`.
2. `s) single notes` moves played SingleNotes only.
3. `r) recorded` moves recorded Single/Tiny/Bend/Fingering/Pitch/Multi.
4. Recorded NamedNotes remain unchanged.
5. `octaves` does not affect `r) recorded`.
6. No recorded notes are dropped by the new path.
7. One-octave collisions fall back to full-neck/off-screen placement without UI messages.
8. Bends never land on nut cells, including row-specific BanjoNut cells.
9. Reset and hard reset include recorded notes.
10. Reverse tunings use MIDI direction.
11. Short-neck instruments are reversible via off-screen `col` values.
12. Targeted and full Jest suites pass.

## Open coding notes

The only notable implementation detail to confirm while coding is the exact persistence choice for `STYLENUM_MIDIPITCHES` `col`. The preferred plan is to delete `col`, matching MovePlugin's current `reconstructMovedNote()` behavior for pitch-wide highlights. If an existing UI path expects a stale `col`, preserve compatibility only if tests reveal the need.

## Bottom line

Implement `RecordedNotes` as a standalone TransposePlugin feature using the existing same-string lessons, but with the round-2 corrections: `SingleNotes` becomes played-only, recorded-note transposition is non-destructive, Bends are nut-safe, Pitch remains MIDI-wide, and reset/hard reset use the same delta pathway as every other TransposePlugin operation.
