# sprint-133 Iteration 8 implementation plan

Date: 2026-06-23
Sprint: 133 name-that-note
Inputs:
- [133-it8-design.md](133-it8-design.md)
- [plugins/arpeggio/ArpeggioPlugin.js](../../../../plugins/arpeggio/ArpeggioPlugin.js)
- [plugins/arpeggio/properties.json](../../../../plugins/arpeggio/properties.json)
- [plugins/fill/FillPlugin.js](../../../../plugins/fill/FillPlugin.js)
- [plugins/fill/properties.json](../../../../plugins/fill/properties.json)
- [songs/sprint-121/pentatonics-7-m-7-in-6-keys-Fill.json](../../../../songs/sprint-121/pentatonics-7-m-7-in-6-keys-Fill.json)

## Goal

Port ArpeggioPlugin position handling semantics into FillPlugin so both plugins land on the same fret windows when configured the same way, including during transposition and song-loop progression, while keeping plugin implementations independent.

## Design intent captured

1. Fill should move from simple min/max-only position handling to section-scoped positions arrays (values) like Arpeggio.
2. Fill should support the same position-management actions as Arpeggio:
- set values for current section
- clear current/all sections
- copy to all sections
- copy to unset sections
3. Fill should include song loops per position behavior and match Arpeggio’s progression model.
4. No runtime coupling between plugins, and no shared plugin-menu generator requirement in this iteration.
5. Duplicate code between plugins is acceptable if readability/maintainability in each plugin stays clear.

## Current state summary

Arpeggio already has:
1. Section-scoped positions in section pluginData (`section.pluginData.arpeggio.positions`).
2. Position index bookkeeping (`lastPositionIndex`).
3. Song-loop-driven position advancement (`songLoopsPerPositionPair` + OnSongEnd counter).
4. Position copy/clear actions and robust value parsing/validation.
5. Effective fret window selection via section positions first, fallback to min/max defaults.

Fill currently has:
1. Global min/max fret properties and min/max string limits.
2. No section-scoped positions arrays.
3. No song-loop position stepping.
4. No copy-to-section position actions.
5. Candidate filtering always using current property min/max range.

## Architecture approach

Primary strategy:
1. Keep FillPlugin independent and self-contained.
2. Port Arpeggio position model into FillPlugin with Fill-local method names and data paths.
3. Keep existing Fill role/family note emission logic intact; only change the fret-window source feeding candidate selection.

Data model in section state:
1. Add Fill section data at `section.pluginData.fill`.
2. Store:
- `positions`: array of [minFret, maxFret]
- `lastPositionIndex`: integer index, reset sentinel -1

No cross-plugin state sharing:
1. Fill reads only `section.pluginData.fill`.
2. Arpeggio continues reading only `section.pluginData.arpeggio`.

## Proposed Fill menu and property changes

### properties.json updates

In [plugins/fill/properties.json](../../../../plugins/fill/properties.json):
1. Add `songLoopsPerPositionPair` Number property.
2. Keep existing `minFret` and `maxFret` as defaults/fallback when section positions are unset.

### Fill positions submenu parity

In [plugins/fill/FillPlugin.js](../../../../plugins/fill/FillPlugin.js), expand positions submenu to mirror Arpeggio structure:
1. minFret default position
2. maxFret default position
3. cLear all sections
4. clear This section
5. Copy to all sections
6. copy to Unset sections
7. Refresh values
8. values this section [current positions]
9. song loops per position

Action naming:
1. Use Fill-local action names (same semantic names, Fill namespace by plugin id already handled by PluginManager).

## Fill runtime changes

### Step 1: event model parity

In [plugins/fill/FillPlugin.js](../../../../plugins/fill/FillPlugin.js):
1. Add `DaCapo:OnSongEnd` to Fill eventNames.
2. Add Fill song-loop counter (`songLoopCountForPositionPair`) and helpers mirroring Arpeggio semantics.
3. On `Looper:OnResetSong`, reset loop counter and reset section position indexes to sentinel (-1).

### Step 2: section positions data layer

Add Fill-local methods analogous to Arpeggio:
1. getFillSectionData / ensureFillSectionData / pruneEmptyFillSectionData
2. getSectionPositions / setSectionPositions / clearSectionPositions
3. getLastPositionIndex / setLastPositionIndex / resetSectionPositionIndex / resetAllSectionPositionIndexes
4. normalizeSectionPositionsOnLoad

### Step 3: positions value parsing and validation

Add Fill-local parsing/validation functions (copied/adapted):
1. parsePositionsInput
2. parsePositionInteger
3. validatePositionsValue
4. normalizePositionsValue
5. formatPositionsValue

Validation rules same as Arpeggio:
1. pair shape [min,max]
2. non-negative ints
3. min <= max
4. max within target tuning fret range

### Step 4: effective fret window resolution

Replace simple range use with a resolver:
1. resolveEffectiveFretWindow(section, tuning)
2. If section positions exist:
- choose active pair by current song loop counter and `songLoopsPerPositionPair`
- persist `lastPositionIndex`
3. If section positions are unset:
- fallback to plugin `minFret`/`maxFret`

### Step 5: apply path integration

In Fill apply flow:
1. Build plan using effective fret window from Step 4.
2. Keep role sets, family decisions, and note ownership behavior unchanged.
3. Ensure min/max row behavior remains unchanged.

### Step 6: positions management actions

Implement Fill action handlers:
1. positions:setCurrentSection
2. positions:clearCurrentSection
3. positions:clearAllSections
4. positions:copyToAllSections
5. positions:copyToUnsetSections
6. positions:refreshCurrentSection

Behavior should match Arpeggio result strings where practical to reduce user surprise.

## Transposition alignment expectation

Target outcome:
1. Fill fret windows should advance by loop-position rules, not drift based on transposition side effects.
2. Given same song loops per position and same per-section positions arrays in both plugins, Fill and Arpeggio should operate in equivalent fret windows after each transposition loop.

Acceptance check using [songs/sprint-121/pentatonics-7-m-7-in-6-keys-Fill.json](../../../../songs/sprint-121/pentatonics-7-m-7-in-6-keys-Fill.json):
1. Configure matching positions and loop count in both plugins.
2. Run song loops across transpositions.
3. Confirm Fill-generated notes stay in same active position windows Arpeggio highlights.

## Migration and compatibility

1. Existing Fill songs without section positions should continue using min/max defaults.
2. Persisted Fill properties remain backward compatible; add default for new `songLoopsPerPositionPair`.
3. For old songs, initialize Fill section position index to -1 when positions are set or normalized.

## Test plan

Primary files:
1. [ _tests/jest/fill-plugin.test.js ](../../../../_tests/jest/fill-plugin.test.js)
2. [ _tests/jest/arpeggio-plugin.test.js ](../../../../_tests/jest/arpeggio-plugin.test.js) (only if shared assumptions are updated)

New Fill test coverage to add:
1. positions submenu includes copy/clear/set/refresh actions and song loops per position property.
2. positions value parsing and validation parity cases.
3. set/clear/copy positions actions update `section.pluginData.fill` as expected.
4. On song end, Fill position index advances according to `songLoopsPerPositionPair`.
5. On reset song, Fill loop counter and section position indexes reset.
6. Fill apply uses section positions when present and min/max fallback when unset.
7. Transposition loop regression: Fill position choice remains stable with position progression model.

Recommended commands:
1. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/fill-plugin.test.js --verbose --runInBand`
2. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/arpeggio-plugin.test.js --verbose --runInBand`
3. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`

## Risks and mitigations

Risk 1: Off-by-one differences in loop-to-position index progression.
1. Mitigation: copy Arpeggio’s index math and sentinel behavior exactly, with direct parity tests.

Risk 2: Fill menu complexity regression or trigger conflicts.
1. Mitigation: keep positions submenu shape intentionally parallel to Arpeggio and test menu node triggers.

Risk 3: Unexpected persistence side effects in pluginData.
1. Mitigation: add load/export tests for Fill section pluginData and legacy fallback behavior.

## Questions for approval

1. Should Fill use the exact same default menu seed for values this section as Arpeggio (`[[0,3],[4,7],[8,12]]`), or should Fill keep a tighter default due to prior first-position bias?
2. Do you want Fill positions status widgets (caption-level table like Arpeggio) now, or only the values/summary text parity for this iteration?
3. When `positions:refreshCurrentSection` is invoked in Fill, should it be a pure status refresh (Arpeggio style) or should it also trigger an immediate apply?
4. Should Fill `songLoopsPerPositionPair` be included in Fill help summary text exactly as in Arpeggio wording?
5. If Fill has section positions set and user edits min/max defaults, should those edits remain strictly fallback-only (no mutation of existing section positions), matching Arpeggio behavior?
