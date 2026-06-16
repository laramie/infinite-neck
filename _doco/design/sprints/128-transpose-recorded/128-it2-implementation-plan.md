# Sprint 128 Iteration 2 implementation plan draft

## Status

- Based on [128-design.md](128-design.md), section `Iteration 2: Menu reorganization and other playedNotes`.
- Iteration 1 is implemented and validated as the baseline for this plan.
- This document is a draft for Design review before coding.

## Iteration 2 goals

1. Preserve Iteration 1 behavior for `recordedNotes` as one fixed block under `r) recorded`.
2. Preserve current `NamedNotes` behavior.
3. Preserve current `playedNotes:SingleNote` behavior.
4. Add `playedNotes:TinyNote`, `playedNotes:Bend`, and `playedNotes:Fingering` to TransposePlugin played-note transposition.
5. Reorganize the TransposePlugin menu so type selection follows the include-submenu pattern used by MovePlugin and ClipPlugin.
6. Keep `octaves` scoped to played-note transposition only; do not apply `octaves` to recorded-note transposition.

## Current implementation snapshot

Relevant files:

- [plugins/transpose/TransposePlugin.js](../../../../plugins/transpose/TransposePlugin.js)
- [plugins/transpose/properties.json](../../../../plugins/transpose/properties.json)
- [_tests/jest/transpose-plugin.test.js](../../../../_tests/jest/transpose-plugin.test.js)
- [_tests/jest/plugin-manager-persistence.test.js](../../../../_tests/jest/plugin-manager-persistence.test.js)

Current important details:

- `transposeSectionTableSingleNotes(...)` currently transforms only `playedNotes` where `styleNum === Note.STYLENUM_SINGLE`.
- Recorded-note handling is separate and already supports the fixed Iteration 1 set: Single, Tiny, Bend, Fingering, Pitch, and Multi.
- Recorded notes use one-octave mode first and silently fall back to full-neck/off-screen mode on recorded transform collisions.
- Played SingleNotes use `octaves` and currently rewrite `octaves` to `0` with an action message when capped-octave collisions require full-neck fallback.
- TransposePlugin currently exposes flat properties: `intervals`, `NamedNotes`, `SingleNotes`, `RecordedNotes`, `octaves`, `autoSharpsFlats`, `doLeadKey`.

## Proposed property model

### Rename menu presentation of `intervals`

Keep the persisted property name `intervals` to avoid needless migration risk, but change the user-facing property metadata:

- caption: `chroma`
- trigger: `c`
- datatype and persisted value unchanged

This keeps existing song files compatible while making the menu match the new design.

### Add played-note include toggles

Add properties for the new played-note types:

- `TinyNotes`
	- caption: `tiny`
	- trigger: `t`
	- datatype: `org.dynamide.toggle`
	- default: likely `false` unless Design wants the redrawn menu's representative `[n,s,t,b,f,r]` to become defaults
- `BendNotes`
	- caption: `bend`
	- trigger: `b`
	- datatype: `org.dynamide.toggle`
	- default: likely `false`
- `FingeringNotes`
	- caption: `fingering`
	- trigger: `f`
	- datatype: `org.dynamide.toggle`
	- default: likely `false`

Keep existing persisted property names:

- `NamedNotes`
- `SingleNotes`
- `RecordedNotes`

Recommended menu captions inside the include submenu:

- `NamedNotes` caption becomes `named`
- `SingleNotes` caption becomes `single`
- `RecordedNotes` caption remains `recorded`

Keeping property names stable avoids breaking existing saved plugin state. Only captions/triggers and menu grouping need change.

## Proposed menu structure

Top-level TransposePlugin menu children:

1. `Apply`
2. `Reset`
3. `help`
4. `chroma [[...]]`
5. `include [n,s,t,b,f,r]`
6. `octaves []`
7. `auto sharps/flats [false]`
8. `do lead key [false]`

The `include` submenu should be built in `TransposePlugin`, following the pattern in MovePlugin and ClipPlugin:

- use `buildCaption('include', 'i')`
- use a `plugin:transpose:includeSummary` value reference
- use `MenuItemProxy`
- keep `popOnBang` behavior inherited from property menu nodes, so toggling a child leaves the user in the include submenu as with the other plugins

Include submenu children:

1. `named`
2. `single`
3. `tiny`
4. `bend`
5. `fingering`
6. `recorded`

`resolveValue('includeSummary')` should return a leading-space summary like MovePlugin/ClipPlugin do, e.g. ` [n,s,t,b,f,r]`.

## Played-note transformation design

### Style set

Iteration 2 played-note transposition should include only the enabled style families:

- `NamedNotes=true`: existing core `transposeSong(...)` NamedNote behavior
- `SingleNotes=true`: `playedNotes` SingleNote
- `TinyNotes=true`: `playedNotes` TinyNote
- `BendNotes=true`: `playedNotes` Bend
- `FingeringNotes=true`: `playedNotes` Fingering

Do not add played-note handling for Pitch or Multi because they are not persisted as played notes.

### Recommended refactor

Rename/generalize the SingleNote helpers rather than duplicate the algorithm:

- `transposeSingleNoteOnString(...)` → `transposePlayedCellBoundNoteOnString(...)`
- `transposeSectionTableSingleNotes(...)` → `transposeSectionTablePlayedNotes(...)`
- `transposeSingleNotesAllSections(...)` → `transposePlayedNotesAllSections(...)`
- `detectSingleNoteCollisions(...)` → `detectPlayedTransformCollisions(...)`

The generalized path should accept a style-include predicate or enabled-style set so it only moves selected played-note families.

### Cell-bound algorithm

For Single, Tiny, Bend, and Fingering, use the same same-string transposition model:

1. Parse `row`.
2. Resolve source fret from `col`, falling back to `midinum - openMidi` if needed.
3. Compute `targetFret = sourceFret + delta`.
4. Bring below-nut values up by octaves.
5. Apply played-note `octaves` behavior exactly as current SingleNote does.
6. Recompute `row`, `col`, `midinum`, and `noteName`.
7. Preserve style-specific fields and user metadata:
	 - Bend: preserve `bendValue`
	 - Fingering: preserve `finger`
	 - all styles: preserve unknown fields unless specifically recomputed
8. Recalculate automatic functional colors using the existing `normalizeSingleNoteColor(...)` policy.

### Bend nut rule

For played `Bend` notes, add the same nut-landing rule as recorded bends:

1. Use tuning-derived row nut via `createTuningLayout(tuning)`.
2. If the target landing is the row's nut cell, add 12 until it is not on the nut.
3. Never drop the Bend.
4. Preserve `bendValue`.

This can reuse the existing recorded helper concepts (`getRowNutCol`, `isNutLanding`) and should remain local to TransposePlugin unless an obvious shared helper already exists.

## Collision and fallback policy for played notes

### Existing SingleNote behavior

Current played SingleNote collision behavior is:

1. Try current `octaves` mode.
2. If capped-octave mode collides, rewrite `octaves` to `0`.
3. Re-run in full-neck/off-screen mode.
4. Emit an action message that `octaves` reset to `0`.

The design says to preserve current SingleNote behavior. The plan therefore extends this behavior to the new played-note style set unless Design says otherwise.

### Lane-aware collision keys

Use lane-aware collisions, consistent with existing model/display behavior:

- Single lane: `SingleNote` at row + col
- Tiny/Bend lane: `TinyNote` and `Bend` share row + col occupancy
- Fingering lane: `Fingering` at row + col

Collision detection should consider only transformed played notes for the affected section/table. Recorded notes should not be collision blockers for played-note transposition, because Iteration 1 intentionally preserves core paint behavior where recorded notes visually win during looping.

### Design question: cross-lane collisions

Open question for Design:

- Should Single and Tiny/Bend at the same row/col be considered a collision for played-note `octaves` fallback?

Current display has separate `singleNote` and `tinyNote` DOM lanes at a cell. The design discussion suggests Single/Tiny/Bend/Fingering have collision concerns, but it does not explicitly say whether cross-lane co-location is legal for played notes. Recommendation: treat collisions lane-wise, not cross-lane, because the UI and model already distinguish these lanes.

## Octaves behavior

### Recommendation

`octaves` should apply to played-note Single, Tiny, Bend, and Fingering only.

It must not apply to recorded notes. The recorded-note path should continue using Iteration 1 StringOneOctave + collision fallback and should not read or rewrite `octaves`.

### Answer to design questions

1. It should be straightforward to add Tiny, Bend, and Fingering to the current played SingleNote octaves implementation because all are cell-bound row/fret notes.
2. There is little risk of disrupting recorded notes if the code keeps recorded-note functions separate and `applySongDelta(...)` calls the played-note and recorded-note paths independently.

Implementation guardrail:

- Do not merge played and recorded transposition into one shared function that accepts `octaves`; instead, share small helpers only where semantics are identical.

## Relationship with NamedNotes and `transposeSong(...)`

Current TransposePlugin calls:

```text
transposeSong(delta, formatOptions(this.propertyMap))
```

`formatOptions(...)` currently only passes:

- `NamedNotes`
- `doKeyLead`

This should remain true. The newly added Tiny/Bend/Fingering played-note toggles should not affect `transposeSong(...)`; they should be handled only by the TransposePlugin played-note path.

Design note:

- If `NamedNotes=false` and any played-note styles are enabled, the current code requests UI repaint after moving played notes. Preserve this behavior.

## Reset/apply integration

No new runtime state is needed.

All of these paths already funnel through `applySongDelta(delta, song)`:

- manual `Apply`
- event interval advance
- soft reset
- hard reset
- reset original
- reset current interval

Update `applySongDelta(...)` so it calls generalized played-note transposition if any played-note include toggle is enabled:

- `SingleNotes`
- `TinyNotes`
- `BendNotes`
- `FingeringNotes`

Then call the existing recorded-note path if `RecordedNotes=true`.

Recommended order:

1. `transposeSong(...)` for NamedNotes / lead key / global song transposition.
2. played-note transposition for enabled played-note families.
3. recorded-note transposition if enabled.
4. update `liveSongOffset`.
5. apply auto sharps/flats.

This matches the current Iteration 1 order and keeps recorded behavior isolated.

## Persistence and compatibility

### New persisted properties

Adding `TinyNotes`, `BendNotes`, and `FingeringNotes` means plugin persistence tests must be updated to include their default values.

Existing songs without those properties should load cleanly because `loadSongState(...)` resets to defaults before applying persisted values.

### Defaults question

Open question for Design:

- Should the new include toggles default to `false` to preserve current behavior, or should defaults match the sample redrawn menu with `[n,s,t,b,f,r]` all true?

Recommendation: default the new toggles to `false` for minimal behavior change. Existing `NamedNotes` currently defaults true, `SingleNotes` false, and `RecordedNotes` false. The sample menu can be understood as representative runtime values, not necessarily defaults.

### Property naming question

Open question for Design:

- Are property names `TinyNotes`, `BendNotes`, and `FingeringNotes` acceptable, or should they follow MovePlugin names such as `includeTiny`, `includeBend`, `includeFingering`?

Recommendation: use TransposePlugin's existing naming style (`NamedNotes`, `SingleNotes`, `RecordedNotes`) and add `TinyNotes`, `BendNotes`, `FingeringNotes`.

## Help and summary updates

Update `buildSummary()` and `buildHelpMessage()` to show:

- `chroma` / interval list
- include summary `[n,s,t,b,f,r]`
- `octaves` scope: played notes only
- recorded notes remain fixed StringOneOctave and ignore `octaves`
- Bend nut rule applies to both played and recorded Bend transposition

Suggested summary fragment:

```text
include=[n,s,t,b,f,r] octaves=[] recorded ignores octaves
```

Avoid overly long menu captions; place details in help.

## Test plan

### Menu tests

Update [_tests/jest/transpose-plugin.test.js](../../../../_tests/jest/transpose-plugin.test.js):

1. `visible menu includes reset submenu...` should expect:
	 - top-level `intervals` node caption/trigger as `chroma` / `c`
	 - top-level `include` node with trigger `i`
	 - include children for named, single, tiny, bend, fingering, recorded
	 - no flat top-level `NamedNotes`, `SingleNotes`, or `RecordedNotes` nodes
2. Add/verify include summary resolver returns `[n,s,t,b,f,r]` with enabled flags only.

### Played-note style tests

Add targeted tests for each new played-note style:

1. TinyNote transposes on the same string and resets correctly.
2. Fingering transposes on the same string, preserves `finger`, and resets correctly.
3. Bend transposes on the same string, preserves `bendValue`, and avoids row nut landing.
4. Disabled toggles leave corresponding played-note styles unchanged.
5. Enabling one style does not move other played-note styles.

### Octaves tests

1. Existing SingleNote `octaves=1` tests should continue to pass.
2. Add TinyNote capped-octave behavior matching SingleNote.
3. Add Bend capped-octave behavior with nut avoidance.
4. Add Fingering capped-octave behavior preserving `finger`.
5. Add collision fallback test with mixed played-note lanes:
	 - Tiny/Bend same lane collision falls back.
	 - Single plus Tiny same cell does not fall back if Design approves lane-wise collision.

### Recorded-note regression tests

Keep Iteration 1 tests and add an explicit guard:

1. `octaves` value does not change recorded-note transposition output.
2. recorded collision fallback still does not rewrite `octaves` and does not emit an action message.
3. recorded Bend nut behavior remains unchanged.

### Persistence tests

Update [_tests/jest/plugin-manager-persistence.test.js](../../../../_tests/jest/plugin-manager-persistence.test.js) expected snapshots to include:

- `TinyNotes: false`
- `BendNotes: false`
- `FingeringNotes: false`

If Design chooses true defaults, update expected values accordingly.

## Validation commands

Targeted validation:

```bash
export INFINITE_NECK_VERBOSE=-1
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/transpose-plugin.test.js _tests/jest/plugin-manager-persistence.test.js --verbose --runInBand
```

Full validation before completion:

```bash
export INFINITE_NECK_VERBOSE=-1
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand
```

## Risks and mitigations

### Risk: `octaves` accidentally affects recorded notes

Mitigation:

- Keep recorded-note transposition functions separate.
- Add regression test proving recorded output and `octaves` property do not change when `octaves` is set.

### Risk: menu reorganization breaks persisted properties

Mitigation:

- Change captions/triggers/menu grouping only.
- Keep existing property names for persisted fields.

### Risk: Bend nut logic diverges between played and recorded paths

Mitigation:

- Reuse local helper functions such as `isNutLanding(...)` and `normalizeFretForRecordedTranspose(...)` concepts.
- Prefer a small generic helper for Bend nut legality if implementation becomes duplicated.

### Risk: collision behavior for mixed played-note styles is ambiguous

Mitigation:

- Ask Design to confirm lane-wise collision policy before coding.
- Default recommendation is lane-wise collision, matching display lanes.

## Design questions before coding

1. Should new played-note include toggles default to `false` for compatibility, or should they default to `true` to match the sample `[n,s,t,b,f,r]` menu state?
2. Confirm property names: `TinyNotes`, `BendNotes`, and `FingeringNotes`.
3. Confirm lane-wise collision policy: Single lane, Tiny/Bend lane, Fingering lane, with no cross-lane collision between Single and Tiny at the same cell.
4. Should played-note capped-octave collision fallback continue to rewrite `octaves` to `0` and emit an action message for Tiny/Bend/Fingering, as it does for SingleNote today?
5. Should `chroma` be only a caption/trigger change while keeping persisted property name `intervals`?

## Acceptance checklist

- [ ] Transpose menu shows `c) chroma` and `i) include [flags]`.
- [ ] Include submenu contains named, single, tiny, bend, fingering, recorded.
- [ ] `n,s,t,b,f` toggles affect only NamedNotes or playedNotes as specified.
- [ ] `r) recorded` remains the fixed Iteration 1 recorded-note block.
- [ ] Played TinyNote transposes and resets correctly.
- [ ] Played Bend transposes, resets, preserves `bendValue`, and never lands on row nut.
- [ ] Played Fingering transposes, resets, and preserves `finger`.
- [ ] `octaves` applies to played Single/Tiny/Bend/Fingering only.
- [ ] Recorded notes ignore `octaves` and keep no-message fallback behavior.
- [ ] Existing Iteration 1 full Jest suite remains green after updates.
