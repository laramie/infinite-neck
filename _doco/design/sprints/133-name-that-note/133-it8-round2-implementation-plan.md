# sprint-133 Iteration 8 Round 2 implementation plan

Date: 2026-06-23
Sprint: 133 name-that-note
Inputs:
- [133-it8-design.md](133-it8-design.md)
- [133-it8-implementation-plan.md](133-it8-implementation-plan.md)
- [plugins/PluginManager.js](../../../../plugins/PluginManager.js)
- [plugins/arpeggio/ArpeggioPlugin.js](../../../../plugins/arpeggio/ArpeggioPlugin.js)
- [plugins/fill/FillPlugin.js](../../../../plugins/fill/FillPlugin.js)
- [_tests/jest/arpeggio-plugin.test.js](../../../../_tests/jest/arpeggio-plugin.test.js)
- [_tests/jest/fill-plugin.test.js](../../../../_tests/jest/fill-plugin.test.js)
- [_tests/jest/plugin-manager-persistence.test.js](../../../../_tests/jest/plugin-manager-persistence.test.js)

## Goal

Add a loose-coupled import/export handshake so Fill and Arpeggio can copy positions settings from each other through JSON payloads, without shared runtime state and without linking plugin internals.

## Design intent captured

1. Copy settings selectively between plugins for positions behavior.
2. Handshake/dispatch should be centralized, preferably in PluginManager.
3. Request path format is plugin plus menu path, examples:
- arpeggio/p
- fill/op
4. Scope for this iteration is Current Section and Current Instrument only.
5. Payload shape is normalized and flattened per supplier plugin, not a direct persistence dump.
6. lastPositionIndex must not be imported/exported.
7. On shape mismatch or route mismatch, requester exits with an error result/message for UserLog.

## Current architecture fit

1. Plugin actions already receive pluginManager via context in [plugins/PluginManager.js](../../../../plugins/PluginManager.js).
2. Both plugins already own independent positions parsing/validation and section data handling.
3. Both plugins already have positions submenu with room to add Import action.

This means we can add one manager-level routing API and minimal plugin-side import/export methods without changing core event flow.

## Proposed API contract

### Manager dispatch API

In [plugins/PluginManager.js](../../../../plugins/PluginManager.js), add:
1. getPluginMenuOptions(requestPath, options = {})

Input:
1. requestPath string format: pluginId/menuPath
2. menuPath is trigger path string, for example p or op
3. options:
- sectionRef: default empty string meaning Current
- instrumentRef: default empty string meaning Current

Output shape:
1. success:
- status: ok
- pluginId
- menuPath
- payload
2. failure:
- status: error
- code
- message

Validation behavior:
1. Reject malformed requestPath.
2. Reject unknown pluginId.
3. Reject supplier/menuPath mismatch.
4. Reject supplier unsupported export.

### Supplier plugin API

In each supplier plugin class, add:
1. exportMenuOptions(menuPath, context = {})

Responsibilities:
1. Verify requested menuPath is supported by that plugin.
2. Return normalized JSON payload for that menuPath only.
3. Enforce whitelist of exportable keys.

For positions export payload in this iteration:
1. minFret
2. maxFret
3. songLoopsPerPositionPair
4. positions (current section only)

No export of:
1. lastPositionIndex
2. internal pluginData envelope
3. unrelated properties

## Route mapping and scope

1. arpeggio/p maps to Arpeggio positions.
2. fill/op maps to Fill options->positions path.

Implementation note:
1. menuPath matching is an explicit per-plugin allowlist, not inferred by walking menu trees.
2. Context defaults empty string to Current for section/instrument as requested.

## Fill requester changes

In [plugins/fill/FillPlugin.js](../../../../plugins/fill/FillPlugin.js):

1. Add positions menu action:
- caption: Import from arpeggio
- trigger: I
- actionName: positions:importFromArpeggio

2. Implement action handler:
- call pluginManager.getPluginMenuOptions(arpeggio/p)
- validate payload shape and field types
- if valid, import into Fill equivalents:
  - set minFret
  - set maxFret
  - set songLoopsPerPositionPair
  - set positions for current section
- do not import lastPositionIndex
- return summary result string

3. Error behavior:
- if manager returns error or payload invalid, stop import and return error result/message
- no partial import on shape mismatch

## Arpeggio requester changes

In [plugins/arpeggio/ArpeggioPlugin.js](../../../../plugins/arpeggio/ArpeggioPlugin.js):

1. Add positions menu action:
- caption: Import from fill
- trigger: I
- actionName: positions:importFromFill

2. Implement action handler:
- call pluginManager.getPluginMenuOptions(fill/op)
- validate payload shape
- map values into Arpeggio equivalents
- keep lastPositionIndex untouched/reset according to existing positions-set behavior

3. Error behavior mirrors Fill importer.

## Supplier export behavior details

### Arpeggio exportMenuOptions

1. Support menuPath p.
2. Return current section positions if set; otherwise empty positions array.
3. Return current effective property values for minFret/maxFret/songLoopsPerPositionPair.

### Fill exportMenuOptions

1. Support menuPath op.
2. Return current section positions if set; otherwise empty positions array.
3. Return current effective property values for minFret/maxFret/songLoopsPerPositionPair.

## Validation and normalization rules

1. Import payload must be an object.
2. minFret/maxFret/songLoopsPerPositionPair must parse to integers in valid ranges.
3. positions must be an array of [min,max] pairs and pass the importer plugin existing validation logic.
4. If positions is empty, importer treats as clear current section positions.
5. Import should refresh current-section UI/status tokens after apply.

## UX and result messaging

1. Successful import result should name source and summarize imported values.
2. Failure result should include short reason plus optional detailed message.
3. Manager route mismatch errors should include requested plugin/menu path pair.

## Test plan

### PluginManager tests

In [_tests/jest/plugin-manager-persistence.test.js](../../../../_tests/jest/plugin-manager-persistence.test.js) or new focused manager test file:
1. getPluginMenuOptions resolves known plugin/menu path and returns payload.
2. malformed requestPath returns status error.
3. unknown plugin returns status error.
4. plugin/menuPath mismatch returns status error.

### Fill tests

In [_tests/jest/fill-plugin.test.js](../../../../_tests/jest/fill-plugin.test.js):
1. positions menu includes Import from arpeggio at /fpfop.
2. import action requests arpeggio/p and applies payload to Fill properties and current-section positions.
3. import rejects malformed payload with no partial update.

### Arpeggio tests

In [_tests/jest/arpeggio-plugin.test.js](../../../../_tests/jest/arpeggio-plugin.test.js):
1. positions menu includes Import from fill at /fpap.
2. import action requests fill/op and applies payload to Arpeggio properties and current-section positions.
3. import rejects malformed payload with no partial update.

### Regression checks

1. Existing positions progression tests still pass.
2. Existing persistence tests still pass.
3. No coupling introduced between pluginData.fill and pluginData.arpeggio.

Recommended commands:
1. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/fill-plugin.test.js --verbose --runInBand
2. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/arpeggio-plugin.test.js --verbose --runInBand
3. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/plugin-manager-persistence.test.js --verbose --runInBand
4. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand

## Risks and mitigations

Risk 1: Silent partial import on bad payload.
1. Mitigation: strict upfront validation and atomic apply semantics.

Risk 2: Menu path drift causes runtime confusion.
1. Mitigation: explicit allowlist mapping and clear error code/message.

Risk 3: Over-coupling through shared payload assumptions.
1. Mitigation: keep importer/supplier whitelists independent and version payload shape if expanded later.

## Questions for approval

1. On import when source positions is empty, should importer clear current section positions or leave existing positions unchanged?
2. Should import run when source plugin is disabled, or require source enabled state?
3. Do you want importer success text to include full JSON payload in message, or concise summary only?
