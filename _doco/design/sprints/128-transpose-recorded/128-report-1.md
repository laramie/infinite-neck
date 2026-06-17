# Sprint 128 analysis report: TransposePlugin recorded-note StringOneOctave

## Executive summary

The requested feature is viable and fits the current direction of `TransposePlugin`, but it should be specified as a new TransposePlugin-local recorded-note transpose mode rather than as a direct call into `MovePlugin`.

Recommended interpretation:

- Add `/fptr` as `r) recorded`, an `org.dynamide.toggle`, default `false`.
- When `recorded=true`, every TransposePlugin delta operation applies a same-string one-octave wrapping transform to table-scoped `recordedNotes` across all sections and tables.
- The fixed recorded-note style set should be:
	- `SingleNote` / `Note.STYLENUM_SINGLE`
	- `TinyNote` / `Note.STYLENUM_TINY`
	- `Bend` / `Note.STYLENUM_BEND`
	- `Fingering` / `Note.STYLENUM_FINGERING`
	- `Pitch` / `Note.STYLENUM_MIDIPITCHES`
	- `Multi` / `Note.STYLENUM_MIDIPITCHESSINGLE`
- Exclude `NamedNote` / `Note.STYLENUM_NAMED` from recorded-note transpose, even if it appears in malformed or hand-edited song data.
- Use a one-octave cap equivalent to the existing `octaves=1` same-string logic, but make it internal to the new recorded toggle and not dependent on the user's `octaves` property.

The largest design hole is collision policy. MovePlugin is allowed to drop and report notes; TransposePlugin should probably be non-destructive. For this feature, I recommend **do not drop recorded notes**. If one-octave wrapping would collide or create duplicate same-lane cells, fall back for that table/apply to the existing full-neck/off-screen same-string behavior, mirroring current `SingleNotes` collision fallback.

## Current implementation state

### TransposePlugin already has a same-string engine

`TransposePlugin` currently imports `createTuningLayout` from [move-helpers.js](../../../../move-helpers.js) and implements local helpers in [plugins/transpose/TransposePlugin.js](../../../../plugins/transpose/TransposePlugin.js):

- `transposeSingleNoteOnString(note, delta, tuning, layout, section, octavesMode)`
- `transposeSectionTableSingleNotes(sectionNotes, delta, tuning, section, octavesMode)`
- `transposeSingleNotesAllSections(delta, song)`

That path already handles:

- all sections
- all section tables with a matching tuning
- table-scoped `playedNotes`
- table-scoped `recordedNotes`
- same-string movement using `row`, `col`, `midinum`, and tuning `rowRange`
- BanjoNut lower-bound wrapping through row-specific boundaries
- `octaves=1` collision fallback to full-neck/off-screen mode
- reset and hard reset, because reset paths call `applySongDelta(delta, song)`

However, despite the property name `SingleNotes`, the current implementation only moves `Note.STYLENUM_SINGLE`. Recorded `Tiny`, `Bend`, `Fingering`, `Pitch`, and `Multi` are cloned unchanged.

### MovePlugin has the richer style rules

`MovePlugin` already understands the style set and landing legality in [move-helpers.js](../../../../move-helpers.js). Important existing rules there:

- `Tiny` and `Bend` share an occupancy lane.
- `Bend` must not land on the tuning-derived nut cell.
- `Fingering` is cell-bound.
- `Pitch` / `STYLENUM_MIDIPITCHES` is pitch-wide and has no authoritative persisted `col`.
- `Multi` / `STYLENUM_MIDIPITCHESSINGLE` is cell-bound.
- `playedNotes` take precedence over `recordedNotes` inside MovePlugin.

The new Bend/nut fix also means MovePlugin's string movement is now a good behavioral reference for Bends hitting the nut.

## Recommended product semantics

### Menu and persisted property

Add a new property:

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

Recommended menu order under `/fpt`:

1. `A) Apply`
2. `R) Reset`
3. `h) help`
4. `i) intervals`
5. `n) named notes`
6. `s) single notes`
7. `r) recorded`
8. `o) octaves`
9. `a) auto sharps/flats`
10. `d) do lead key`

The new property should persist like other user-facing plugin toggles. Runtime offsets remain runtime-only.

### Scope of the new toggle

When `RecordedNotes=false`, current behavior should remain unchanged.

When `RecordedNotes=true`, every non-zero `applySongDelta()` should additionally transpose table-scoped `recordedNotes` for every section and table that has a matching tuning.

This includes:

- manual `Apply`
- `Reset > current interval`
- `Reset > original`
- `Looper:OnResetSong` soft reset
- `Looper:OnResetSong` hard reset
- any event-driven interval advance such as `DaCapo:OnSongEnd`

This naturally follows if the new recorded path is called from `applySongDelta(delta, song)`, parallel to the existing `SingleNotes` path.

### Fixed style set

Use a fixed style set, not more menu options:

| Style | Constant | Movement kind | Notes |
| --- | --- | --- | --- |
| SingleNote | `Note.STYLENUM_SINGLE` | cell-bound | same as existing single logic |
| TinyNote | `Note.STYLENUM_TINY` | cell-bound | preserve fields |
| Bend | `Note.STYLENUM_BEND` | cell-bound with nut rejection/wrap | preserve `bendValue`; never land on nut |
| Fingering | `Note.STYLENUM_FINGERING` | cell-bound | preserve `finger` and other fields |
| Pitch | `Note.STYLENUM_MIDIPITCHES` | pitch-wide | recompute `midinum`, `noteName`, `row`; omit/ignore `col` |
| Multi | `Note.STYLENUM_MIDIPITCHESSINGLE` | cell-bound | recompute `midinum`, `noteName`, `row`, `col` |

Explicitly exclude `Note.STYLENUM_NAMED`.

### Relationship to `SingleNotes`

This is the most important naming issue.

Current `SingleNotes=true` already moves recorded SingleNotes as well as played SingleNotes. The new `RecordedNotes=true` request could overlap with that path.

Recommended cleanup:

- Keep `SingleNotes` as the existing played-and-recorded SingleNote behavior for compatibility.
- Add `RecordedNotes` as a superset for recorded notes only.
- Avoid double-moving recorded SingleNotes when both toggles are true.

Implementation should make candidate routing explicit:

- `SingleNotes=true` moves played SingleNotes and recorded SingleNotes only if `RecordedNotes=false`.
- `RecordedNotes=true` owns all recorded styles in the fixed style set, including SingleNote.

This preserves existing behavior while giving the new toggle a deterministic meaning.

## Recommended algorithm

### StringOneOctave definition

For each recorded note candidate:

1. Interpret the TransposePlugin interval delta as semitones.
2. Keep the note on its source row/string when the note has a meaningful row.
3. Compute `targetFret = sourceFret + delta`.
4. If `targetFret` is below that row's legal lower bound, add 12 until legal.
5. If `targetFret` is above the one-octave window, subtract 12 until within the one-octave window.
6. Recompute `midinum`, `noteName`, `row`, and `col` where appropriate.
7. For Bends, if the direct or wrapped cell is the nut, immediately move up one octave on the same row until not on the nut.

The one-octave window should be based on the row's tuning-derived nut cell, not numeric `col === 0`:

- lower bound: row `nutCell.col`
- upper one-octave threshold: `nutCell.col + 12`

This matches the current `octaves=1` implementation more than MovePlugin's exact direct-cell search, and it gives the requested one-octave repeat at both ends.

### Pitch / Multi distinction

The design text says `[SingleNote,TinyNote,Bend,Fingering,Pitch,Multi]`. In current constants:

- `Pitch` is `STYLENUM_MIDIPITCHES`; it is pitch-wide and should not require or persist `col`.
- `Multi` is `STYLENUM_MIDIPITCHESSINGLE`; it is cell-bound and should keep `col` semantics.

For `Pitch`, use `midinum` as authoritative. If `row` is present and valid, prefer same-row placement. If `row` is missing, choose a deterministic row for the target MIDI, probably `getPreferredCellForMidi(layout, targetMidi)` or the current TransposePlugin row fallback. Persist the recalculated `row`; delete or leave absent `col`.

## Blockers

No architectural blocker found, but these issues should be resolved before coding:

1. **Collision policy must be explicit.** MovePlugin can drop notes; TransposePlugin reset must be reversible/non-destructive. Recommendation: fallback to full-neck/off-screen mode rather than drop.
2. **Property overlap must be explicit.** Existing `SingleNotes=true` already moves recorded SingleNotes. The new `RecordedNotes=true` must not double-move them.
3. **Pitch-wide row behavior needs a rule.** `STYLENUM_MIDIPITCHES` has no authoritative `col`; same-string behavior only makes sense if `row` is available.
4. **NamedNotes interaction is broad.** `transposeSong(delta, { NamedNotes: true })` still moves named notes independently. The new recorded toggle should not alter that.
5. **Listener/observer projection is not part of this feature.** Hidden or unwired source tables should still be transposed if they are in `sectionNotesByTable` and have a matching `myTunings` entry, matching existing TransposePlugin table iteration.

## Holes / unspecified behavior to settle

### 1. What happens on collision?

Possible policies:

- drop and report, like MovePlugin
- overwrite, like some listener projections
- fallback to full-neck/off-screen, like current TransposePlugin SingleNotes

Recommendation: fallback to full-neck/off-screen for the affected table/apply and emit a message. TransposePlugin is used for reset/hard reset, so destructive dropping is risky.

### 2. Should the fallback rewrite `octaves`?

Current `SingleNotes` collision fallback rewrites `octaves` to `0`. For `RecordedNotes`, the requested behavior is a new fixed algorithm, not the user's `octaves` option.

Recommendation: do **not** rewrite `octaves` for `RecordedNotes` fallback. Instead emit a message such as:

`Transpose recorded-note collision detected for StringOneOctave; full-neck/off-screen placement used for recorded notes.`

### 3. Should playedNotes participate in collision checks?

MovePlugin says playedNotes take precedence over recordedNotes. If recorded transposition is non-destructive, dropping recorded notes because a played note occupies the target cell is probably not acceptable.

Recommendation: for TransposePlugin, detect only duplicate occupancy within the transformed recorded set for fallback. Do not drop because of playedNotes. This keeps reset reversible and avoids surprising loss.

### 4. Does `RecordedNotes=true` require `SingleNotes=true`?

Recommendation: no. `RecordedNotes=true` should stand alone and move all supported recorded styles, including recorded SingleNotes.

### 5. Does `RecordedNotes=true` include played Bends/Tiny/Fingering?

Recommendation: no. The requested `/fptr` is specifically recorded. Played non-Single styles remain out of scope unless a later sprint adds separate toggles.

### 6. Should missing or malformed note fields drop or clone unchanged?

Current TransposePlugin single-note code clones unchanged when it cannot compute row/fret.

Recommendation: keep that policy. For malformed recorded notes, clone unchanged and optionally emit one summary message. Do not delete.

### 7. How should Bends at a row-specific nut behave?

Recommendation: use the same tuning-derived nut logic as MovePlugin. A Bend can pass through a nut attempt but must never land there; it should be immediately shifted up one octave on the same row.

### 8. Should one-octave wrapping work on short-neck instruments?

Recommendation: yes. If the instrument has fewer than 12 visible frets, allow off-screen `col` values. This matches existing TransposePlugin SingleNotes behavior and preserves reversibility.

### 9. Should reverse/left-handed tunings use visual or MIDI direction?

Recommendation: MIDI direction, same as MovePlugin and current TransposePlugin. Do not invert for `reverse` tables.

## Implementation strategy

### Prefer shared helpers over calling MovePlugin actions

Do not instantiate or invoke MovePlugin from TransposePlugin. Reasons:

- MovePlugin operates on the current section and one selected table; TransposePlugin operates globally across all sections/tables.
- MovePlugin has user-selectable include and drop-log semantics; this request wants one fixed algorithm.
- MovePlugin can drop notes; TransposePlugin reset should remain non-destructive.

Instead, factor or add helper functions that can be used by TransposePlugin:

- same-row layout resolution
- Bend nut legality
- style family checks
- note reconstruction for cell-bound styles
- pitch-wide highlight reconstruction

### Suggested code shape

1. Add `RecordedNotes` to [plugins/transpose/properties.json](../../../../plugins/transpose/properties.json).
2. Add `getRecordedNotesEnabled()` to [plugins/transpose/TransposePlugin.js](../../../../plugins/transpose/TransposePlugin.js).
3. Add `RecordedNotes` to `buildSummary()` and help output.
4. Add the property to `getVisibleMenuChildren()` after `SingleNotes`.
5. Add a `transposeRecordedNotesAllSections(delta, song)` path called from `applySongDelta()`.
6. Refactor existing `transposeSingleNoteOnString()` into a more general cell-bound helper.
7. Add separate handling for `STYLENUM_MIDIPITCHES`.
8. Ensure `SingleNotes` and `RecordedNotes` cannot double-transform recorded SingleNotes.

### Testing targets

Add coverage in [_tests/jest/transpose-plugin.test.js](../../../../_tests/jest/transpose-plugin.test.js):

1. Menu contains `RecordedNotes` and no legacy `PlayedNotes` option.
2. `RecordedNotes=false` leaves current behavior unchanged.
3. `RecordedNotes=true` moves recorded Single, Tiny, Bend, Fingering, Pitch, and Multi.
4. Bends moving down onto the nut wrap up one octave and preserve `bendValue`.
5. `RecordedNotes=true` participates in `resetCurrentInterval` and `resetOriginal`.
6. `RecordedNotes=true` participates in `Looper:OnResetSong` soft and hard reset.
7. `RecordedNotes=true` and `SingleNotes=true` do not double-move recorded SingleNotes.
8. `STYLENUM_MIDIPITCHES` recomputes `midinum`, `noteName`, and `row`, and does not require `col`.
9. One-octave collision fallback preserves all notes and does not rewrite `octaves` unless the existing `SingleNotes` path caused the fallback.
10. Malformed recorded notes are preserved unchanged.

## Recommended acceptance definition

This sprint is done when:

1. `/fptr` exists as `r) recorded [false|true]`.
2. With `RecordedNotes=true`, TransposePlugin transposes the requested recorded-note style set using StringOneOctave across all sections/tables.
3. Reset and hard reset restore recorded notes as part of the same delta model as named notes and existing single notes.
4. Bends never land on nut cells and are immediately moved up on the same string.
5. No recorded notes are dropped during ordinary transposition/reset.
6. Existing `SingleNotes` tests continue to pass.
7. New tests prove there is no double-transpose when `SingleNotes=true` and `RecordedNotes=true` are both enabled.

## Bottom line

The request is sound. The feature should be implemented as a TransposePlugin-local `RecordedNotes` toggle with a fixed StringOneOctave recorded-note style set. The key design decision is to preserve TransposePlugin's non-destructive/reset-friendly character: use MovePlugin's movement knowledge, especially Bend nut legality, but avoid MovePlugin's drop-based failure model.
