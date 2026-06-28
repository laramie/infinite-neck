# sprint-133 Iteration 7 implementation plan

Date: 2026-06-23
Sprint: 133 name-that-note
Inputs:
- [133-it7-design.md](133-it7-design.md)
- [sprint-133.md](sprint-133.md)
- [menu.js](../../../../menu.js)
- [key-handlers.js](../../../../key-handlers.js)
- [infinite-neck.js](../../../../infinite-neck.js)
- [graveyard.js](../../../../graveyard.js)

## Goal

Add fine-grained graveyard cleanup in command menu and add per-record delete links in graveyard table display, while preserving the existing backup-first behavior for bulk clear actions.

## Current behavior summary

1. `/fg` shows graveyard table from [graveyard.js](../../../../graveyard.js).
2. `/faC` clears entire graveyard with backup and confirmation (defined in [menu.js](../../../../menu.js)).
3. Graveyard table rows currently support `raise` and `show/hide` links.
4. There is no selective-by-type bulk clear and no one-record delete action.

## Scope and non-scope

In scope:
1. Add new `/fac` submenu under file advanced.
2. Add toggle choices for selected GraveType subset.
3. Add `/facC` action to clear selected types with backup and no confirmation.
4. Add per-record delete link in graveyard table detail row when expanded.
5. Refresh graveyard view after delete.

Out of scope:
1. Changing existing `/faC` full-clear confirmation flow.
2. Adding backup/confirmation for single-record delete.
3. Redesigning graveyard table structure beyond requested actions.

## Proposed UX and menu shape

Target under `/fa`:
1. `c) clear graveyard by type`
2. Existing `C) Clear graveyard, with backup` remains unchanged.

Target under `/fac`:
1. `c) CLIP [false]`
2. `i) INSTRUMENT [false]`
3. `p) PLUGIN [false]`
4. `s) SECTION [false]`
5. `t) TUNING [false]`
6. `y) STYLESHEET [false]`
7. `C) Clear selected types, with backup`

Behavior:
1. Toggles default false at menu open.
2. `/facC` skips backup when no types are selected and returns `no types selected`.
3. `/facC` performs backup first only when at least one type is selected, then clears records matching currently selected true toggles.
3. No confirmation submenu for `/facC`.
4. Action result text includes removed count and selected types summary.

## Implementation approach

### Step 1: add graveyard selective-clear API

File:
- [graveyard.js](../../../../graveyard.js)

Add methods:
1. `clearByTypes(typeSetOrArray)`:
- Removes records where `record.type` is in selected set.
- Returns count removed.
2. `deleteRecordByIndex(index)`:
- Deletes one record by index if present.
- Returns boolean or removed record.

Notes:
1. Keep `clear()` unchanged for full wipe behavior.
2. Keep record ordering semantics unchanged.

### Step 2: add new menu nodes for `/fac`

File:
- [menu.js](../../../../menu.js)

Add under file advanced:
1. New child `c) clear graveyard by type` with submenu trigger `c`.
2. Submenu entries for six toggles using `org.dynamide.toggle` style already used elsewhere in command menu.
3. Final action item `C) Clear selected types, with backup` with action name `downloadBackupThenClearGraveyardByType`.

Notes:
1. Keep existing `/faC` block intact.
2. Ensure trigger collisions are local to submenu and do not break existing siblings.

### Step 3: action dispatch and provider wiring

Files:
- [key-handlers.js](../../../../key-handlers.js)
- [infinite-neck.js](../../../../infinite-neck.js)

Add action handling:
1. New key-handlers action case: `downloadBackupThenClearGraveyardByType`.
2. Resolve selected toggles from menu item input/toggle state.
3. Call provider function in infinite-neck layer.

Add provider function in infinite-neck:
1. `downloadBackupThenClearGraveyardByType(selectedTypes)`:
- Returns `no types selected` when no toggles are true.
- Calls existing backup function first when selectedTypes is non-empty (same pattern as `/faC`).
- Calls `getSong().graveyard.clearByTypes(selectedTypes)`.
- Refreshes messages via `buildGraveyardTable()`.

Notes:
1. Keep backup behavior identical to `/faC` timing.
2. Keep return/result message concise and deterministic for tests.

### Step 4: add one-record delete link in graveyard table

Files:
- [graveyard.js](../../../../graveyard.js)
- [infinite-neck.js](../../../../infinite-neck.js)

Rendering changes in graveyard table:
1. Keep existing top row ACTION cell as current behavior (`raise` or clip message).
2. In the second row (show/hide JSON row), include a dedicated ACTION column cell at the end of the row and render `delete_{id}` there.
3. Keep the first-column `show/hide` link where it is; do not place delete beside it.
4. `delete_{id}` is hidden while JSON is hidden and shown only when that row is expanded.

Event handling:
1. Add delegated click handler for `.graveyard-delete-link`.
2. Parse index and call `graveyard.deleteRecordByIndex(index)`.
3. Re-render graveyard table immediately.
4. No backup and no confirmation.

## Data and behavior rules

1. Selective clear matches exact `record.type` strings from GraveType values.
2. Empty selection for `/facC`:
2. Empty selection for `/facC`:
- no records removed,
- no backup,
- returns `no types selected`.
3. Single delete works for all record types, including CLIP.
4. Existing raise behavior remains unchanged.
5. Delete label format is `delete_{id}` and raise label format should remain underscore-style for consistency.

## Testing plan

Primary files:
1. [ _tests/jest/key-handlers.test.js ](../../../../_tests/jest/key-handlers.test.js)
2. New graveyard-focused tests, for example [ _tests/jest/graveyard-selective-clear.test.js ](../../../../_tests/jest/graveyard-selective-clear.test.js)
3. Update or add graveyard table markup tests, for example [ _tests/jest/graveyard-table.test.js ](../../../../_tests/jest/graveyard-table.test.js)

Required test cases:
1. `/facC` action routes through key-handlers and calls provider with selected types.
2. Provider runs backup then selective clear.
3. `clearByTypes` removes only targeted types and reports count.
4. Table render includes delete link in detail row.
5. Delete click removes one record and refreshes graveyard table.
6. Existing `/faC` flow remains unchanged.

Recommended commands:
1. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/key-handlers.test.js --verbose --runInBand`
2. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/graveyard*.test.js --verbose --runInBand`
3. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`

## Risks and mitigations

Risk 1: menu toggle state not flowing into action payload.
1. Mitigation: follow existing toggle/input wiring pattern already used in command menu and assert payload in tests.

Risk 2: delete link visibility tied to show/hide state.
1. Mitigation: keep link in same detail row container toggled by existing show/hide mechanism.

Risk 3: backup side effects for empty type selection.
1. Mitigation: lock expected behavior in tests and action result text.

## Open questions

All open questions have been answered in [133-it7-design.md](133-it7-design.md#answers-to-implementation-plan-questions), and this plan reflects those decisions.
