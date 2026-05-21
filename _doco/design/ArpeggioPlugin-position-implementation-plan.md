# ArpeggioPlugin positions Implementation Plan

## Purpose

Implement section-local `positions` for ArpeggioPlugin so that each qualifying `DaCapo:OnSectionBegin` can resolve an effective `[minFret,maxFret]` pair for the active Section without mutating the plugin-level `minFret` and `maxFret` defaults.

This plan is based on:

- version 3 of the design in `_doco/design/ArpeggioPlugin-position-3.md`
- the post-transport-sprint event semantics now present in the codebase
- the Design Team answers in the `## Design Team Answers` section of that document

## Approved Behavioral Contract

The implementation should treat these points as locked for this sprint.

### Event and advancement contract

- positions advance only on `DaCapo:OnSectionBegin`
- manual Arpeggio `apply` does not advance positions
- a "qualifying section-begin" means any `DaCapo:OnSectionBegin` that ArpeggioPlugin actually receives

### `lastPositionIndex` state machine

- if a Section has no positions, use plugin defaults and do not touch `lastPositionIndex`
- if a Section has positions and no prior index, apply index `0`
- after applying index `i`, persist `lastPositionIndex = i`
- next qualifying section-begin applies `(i + 1) % positions.length`

### Section-local state rules

- `positions` is stored under `section.pluginData.arpeggio.positions`
- `lastPositionIndex` is stored under `section.pluginData.arpeggio.lastPositionIndex`
- `positions: []` is treated exactly like "no positions"
- successful edit of `values this section` resets that Section's `lastPositionIndex` to `0`
- `Copy to all sections` and `copy to Unset sections` reset destination sections' `lastPositionIndex` to `0`
- `clear this section` removes `positions` and `lastPositionIndex`
- if `pluginData.arpeggio` becomes empty after that cleanup, remove `pluginData.arpeggio`
- preserve any unrelated future `pluginData.arpeggio.*` keys

### Validation and display rules

- valid fret range is inclusive `0..tuning.frets`
- reject negative integers
- reject reversed ranges like `[5,3]`
- reject values outside the target tuning's inclusive fret range
- reject malformed JSON or malformed shorthand input
- preserve the old value on reject
- return a short one-line `actionResult.result`
- emit a more detailed `showMessages` message including the attempted string
- always normalize stored and displayed values to canonical JSON array text
- `Refresh values` is read-only for this sprint

## Non-Goals

- no new transport events
- no mutation of plugin-level `minFret` and `maxFret`
- no manual "advance position" action
- no legacy persisted-data repair beyond load-time index normalization
- no redesign of existing Arpeggio style algorithms

## Affected Files

Primary implementation files:

- `plugins/arpeggio/ArpeggioPlugin.js`
- `plugins/PluginManager.js` only if action result plumbing exposes a small gap during custom actions
- `plugins/MenuItemProxy.js` only if current caption/input support proves insufficient

Likely documentation files:

- `README.md`
- `_doco/developer/schema-programmers-reference.md`
- `_doco/developer/ArpeggioPlugin-programmers-reference.md`

Primary test files:

- `_tests/jest/arpeggio-plugin.test.js`
- `_tests/jest/plugin-manager-persistence.test.js`
- add a song/section persistence test only if section-local `pluginData` needs explicit constructor coverage

## Current-Code Constraints

These observations should shape the implementation.

1. `ArpeggioPlugin` already listens to the correct event set:
	 - `DaCapo:OnSectionBegin`
	 - `SongUiShowBeats`
	 - `Looper:OnResetSong`

2. `collectCandidatesForSection()` currently reads plugin-level `minFret` and `maxFret` directly.

3. `getVisibleMenuChildren()` already supports custom menu nodes, and the plugin runtime already supports custom actions through `MenuItemProxy` and `pluginAction:invoke`.

4. `SectionPersistence` already copies unknown persisted fields via `Object.assign(...)`, so section-local `pluginData` does not require a large persistence refactor.

5. The runtime currently has no reason to push this feature into `properties.json`; `positions` should remain custom submenu state, not a flat persisted plugin property.

## Recommended Implementation Shape

Keep the section-local state management inside `ArpeggioPlugin` for this sprint.

Do not scatter direct writes like `section.pluginData?.arpeggio = ...` across unrelated methods. Instead, add a compact helper layer inside `ArpeggioPlugin.js` so every read/write path uses the same rules.

Recommended helper group:

- `getArpeggioSectionData(section)`
- `ensureArpeggioSectionData(section)`
- `getSectionPositions(section)`
- `setSectionPositions(section, positions)`
- `clearSectionPositions(section)`
- `getLastPositionIndex(section)`
- `setLastPositionIndex(section, index)`
- `resetSectionPositionIndex(section)`
- `resetAllSectionPositionIndexes(song)`
- `pruneEmptyArpeggioSectionData(section)`

This keeps the feature local, testable, and reversible if the repository later introduces a generic plugin section-state abstraction.

## Execution Plan

### Phase 1: Add section-state helpers in ArpeggioPlugin

File:

- `plugins/arpeggio/ArpeggioPlugin.js`

Work:

- add the section-data helper methods listed above
- treat absent `pluginData`, absent `pluginData.arpeggio`, and `positions: []` as "no positions"
- make helper writes preserve unrelated sibling keys under `pluginData.arpeggio`
- make clear/prune logic remove empty `pluginData.arpeggio` safely

Exit criteria:

- one helper path owns all `positions` and `lastPositionIndex` storage
- there are no ad hoc direct writes outside that helper layer

### Phase 2: Add parsing, normalization, and validation for positions input

File:

- `plugins/arpeggio/ArpeggioPlugin.js`

Work:

- add a parser that accepts:
	- canonical JSON arrays like `[[0,3],[4,8]]`
	- semicolon shorthand like `0,3;2,5;6,9`
	- semicolon shorthand with missing end like `0,3;2,5;6`
	- boundary shorthand like `0,3,5,9`
- squeeze whitespace before parsing
- normalize successful parses to canonical JSON array-of-arrays data
- validate:
	- array-of-array shape
	- exactly two integers per position
	- non-negative integers
	- `minFret <= maxFret`
	- `maxFret <= tuning.frets`
- return a compact success/result summary for menu actions
- on reject:
	- keep prior stored value unchanged
	- provide a short one-line result
	- emit detailed message text with the attempted string

Recommended helper group:

- `parsePositionsInput(rawValue)`
- `normalizePositionsValue(rawValue)`
- `validatePositionsValue(positions, tuning)`
- `formatPositionsValue(positions)`
- `buildPositionsRejectResponse(reason, rawValue)`

Implementation note:

- if the normalized result is `[]`, treat that the same as clear/unset instead of persisting an empty array

Exit criteria:

- menu input accepts both shorthand and JSON
- storage and captions always use canonical JSON
- rejection never mutates stored section data

### Phase 3: Add effective-range resolution for section begin and manual apply

File:

- `plugins/arpeggio/ArpeggioPlugin.js`

Work:

- introduce a single resolver for the effective fret window used by candidate collection
- keep plugin-level `minFret` and `maxFret` as fallback defaults
- on `DaCapo:OnSectionBegin`:
	- inspect the active Section's positions
	- compute the next index from the approved state machine
	- persist `lastPositionIndex`
	- pass the resolved `[minFret,maxFret]` into candidate generation
- on manual `apply`:
	- do not advance index
	- if positions exist and `lastPositionIndex` exists, reuse that current resolved position
	- if positions exist and no index exists yet, use index `0` for rendering without advancing state, or explicitly initialize to `0` before apply if that proves necessary for consistency

Recommended implementation shape:

- extend `collectCandidatesForSection(section, tuning, options = {})` to accept `minFret` and `maxFret` overrides
- add a resolver such as `resolveEffectiveFretWindow(section, tuning, options)` that returns:
	- `minFret`
	- `maxFret`
	- `positionsUsed`
	- `appliedIndex`
	- whether state mutation is required

Important consistency rule:

- `SongUiShowBeats` refresh must use the currently effective stored position, not recompute and advance again

That means beat-display refresh should read the current stored `lastPositionIndex` for the Section and resolve the same fret window that section-begin already chose.

Exit criteria:

- no style algorithm body changes are required
- candidate collection uses either section-local position range or plugin defaults
- section-begin advances exactly once per event
- `SongUiShowBeats` does not accidentally advance positions

### Phase 4: Extend event handling for reset and load normalization

File:

- `plugins/arpeggio/ArpeggioPlugin.js`

Work:

- update `loadSongState(...)` so that after loading persisted plugin properties it normalizes every Section in the Song:
	- if a Section has positions, set `lastPositionIndex = 0`
	- if a Section has empty positions, treat as unset and clear positions/index keys
- update `handleEvent('Looper:OnResetSong', ...)` so it:
	- resets `lastPositionIndex = 0` for every Section that still has positions
	- continues clearing generated notes as it does today

Recommended order inside reset handler:

1. normalize/reset section-local positions state
2. clear generated notes in the song
3. return a result that still matches current Arpeggio expectations

Exit criteria:

- freshly loaded songs start deterministic
- both hard and non-hard song resets put all position indexes back to `0`

### Phase 5: Add the custom `p) positions` submenu

File:

- `plugins/arpeggio/ArpeggioPlugin.js`

Work:

- update `getVisibleMenuChildren()` to insert a custom `positions` node alongside current Arpeggio menu children
- implement submenu items:
	- `L) cLear all sections`
	- `T) clear This section`
	- `C) Copy to all sections`
	- `U) copy to Unset sections`
	- `R) Refresh values`
	- `v) values this section [...]`
- implement the submenu with `MenuItemProxy` custom children and `pluginAction:invoke`
- keep `positions` out of flat `properties.json`

Recommended custom action names:

- `positions:setCurrentSection`
- `positions:clearCurrentSection`
- `positions:clearAllSections`
- `positions:copyToAllSections`
- `positions:copyToUnsetSections`
- `positions:refreshCurrentSection`

Recommended caption/value helpers:

- extend `resolveValue(...)` or add a small caption helper so `values this section [...]` always shows the normalized current-section JSON value or an empty/unset marker
- on submenu entry and on refresh action, read from the current Section only

Refresh behavior for this sprint:

- no mutation
- no legacy cleanup side effects
- simply cause the menu caption/value to re-resolve from the active Section

Exit criteria:

- the positions submenu behaves like a real plugin-owned submenu, not a fake flat property
- value captions reflect the current Section's normalized stored state

### Phase 6: Implement submenu actions

File:

- `plugins/arpeggio/ArpeggioPlugin.js`

Work:

- extend `invokeAction(actionName, context = {})` to handle the new positions actions
- `values this section`:
	- accept input
	- parse/validate
	- store normalized positions or clear on empty input
	- reset `lastPositionIndex = 0` on success
- `clear this section`:
	- remove `positions` and `lastPositionIndex`
	- prune empty `pluginData.arpeggio`
- `clear all sections`:
	- do the same cleanup across all Sections
- `copy to all sections`:
	- copy normalized positions from current Section to every Section
	- set each destination `lastPositionIndex = 0`
- `copy to Unset sections`:
	- copy only into Sections without positions
	- set each destination `lastPositionIndex = 0`
- `Refresh values`:
	- return a short refresh result only

Important behavior choice:

- if the current Section has no positions and the user runs copy actions, return a short rejection/skip result rather than silently writing nothing

Exit criteria:

- every custom menu command has deterministic state effects
- copy and clear paths follow the approved reset/prune rules

### Phase 7: Update docs and schema references

Files:

- `README.md`
- `_doco/developer/schema-programmers-reference.md`
- `_doco/developer/ArpeggioPlugin-programmers-reference.md`

Work:

- document the new optional Section shape:
	- `section.pluginData.arpeggio.positions`
	- `section.pluginData.arpeggio.lastPositionIndex`
- note that `lastPositionIndex` is runtime-ish but may be persisted and will be normalized to `0` on load
- document the shorthand input forms and the fact that storage/display are canonical JSON
- document that advancement is tied only to `DaCapo:OnSectionBegin`

Exit criteria:

- docs describe both persistence shape and runtime behavior accurately

### Phase 8: Add focused Jest coverage

Primary file:

- `_tests/jest/arpeggio-plugin.test.js`

Secondary file if needed:

- `_tests/jest/plugin-manager-persistence.test.js`

Tests to add:

1. parsing and normalization
	 - JSON input persists as canonical JSON
	 - semicolon shorthand normalizes correctly
	 - missing trailing bound gets `+4`
	 - boundary shorthand becomes adjacent ranges

2. validation rejection
	 - negative numbers reject
	 - reversed ranges reject
	 - values above `tuning.frets` reject
	 - malformed input rejects
	 - reject preserves previous section value

3. state-machine behavior
	 - first `DaCapo:OnSectionBegin` applies index `0`
	 - next begin advances to `1`
	 - wraps after final entry
	 - no positions means defaults and no index mutation
	 - `positions: []` behaves like unset

4. manual apply behavior
	 - manual `apply` does not advance index
	 - manual `apply` uses current resolved position

5. beat-display behavior
	 - `SongUiShowBeats` uses current stored position and does not advance

6. reset/load normalization
	 - `loadSongState()` resets indexes to `0`
	 - `Looper:OnResetSong` resets indexes to `0`
	 - empty positions are cleaned up during load normalization if that behavior is implemented there

7. submenu actions
	 - set current section
	 - clear this section
	 - clear all sections
	 - copy to all sections
	 - copy to unset sections
	 - refresh is read-only

8. caption/value helpers
	 - current section menu value shows canonical JSON

Existing transport-controller and looper tests already cover the event semantics that made this feature viable, so this sprint does not need to duplicate those transport assertions unless a regression appears during implementation.

## Suggested Delivery Order

Implement in this order to minimize churn and reduce debugging ambiguity:

1. section-state helpers
2. parser/validator/formatter
3. effective fret-window resolver in candidate collection
4. section-begin and reset/load behavior
5. custom submenu node and actions
6. documentation updates
7. final focused Jest pass, then full Jest suite

This order keeps storage and event semantics stable before the menu starts exercising them.

## Risk Notes

### Risk 1: Advancing twice per musical cycle

If both `DaCapo:OnSectionBegin` and `SongUiShowBeats` recompute the next index, the feature will appear to skip positions.

Mitigation:

- only `DaCapo:OnSectionBegin` may advance
- `SongUiShowBeats` must be read-only with respect to positions state

### Risk 2: Menu actions and runtime playback diverge

If manual `apply` ignores the current stored index while beat display uses it, the user will see inconsistent previews.

Mitigation:

- centralize effective-range resolution
- make manual apply reuse the current resolved/stored index without advancing

### Risk 3: Empty-object cleanup removes future state accidentally

Because this is the first Section-local plugin state tree, careless cleanup could delete future keys.

Mitigation:

- only remove known positions keys directly
- prune `pluginData.arpeggio` only after checking it is truly empty

## Definition Of Done

This sprint is done when all of the following are true:

- Arpeggio has a working `p) positions` submenu
- current-section values can be entered in shorthand or JSON and are stored/displayed as canonical JSON
- qualifying `DaCapo:OnSectionBegin` events advance positions by the approved state machine
- manual `apply` does not advance positions
- plugin defaults remain unchanged and are used when positions are unset
- reset and load paths normalize `lastPositionIndex` to `0`
- clear/copy actions follow the approved Section-state rules
- Section schema documentation is updated
- focused Jest coverage is added and the full Jest suite passes
