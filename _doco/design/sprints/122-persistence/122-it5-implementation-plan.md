# sprint-122-persistence Iteration 5 implementation plan

Status: Revised after Round 3 REDO (Song.noteTablesLayout)

## 1) Intent and scope

Iteration 5 now replaces Song.visibleNoteTables with Song.noteTablesLayout as the canonical source of truth for:
- Tunings in Song row order
- whether each row is visible in layout

This sprint also prevents table-note orphaning by gating delete (X) when InMem is present and greater than zero.

In scope:
- Introduce and persist Song.noteTablesLayout.
- Migrate read path from visibleNoteTables to noteTablesLayout.
- Keep hidden tunings in Tunings in Song rows; hide only table layout view.
- Preserve ghost tables (model exists, no view) and make them usable in Wiring pickers.
- Remove DOM visibility as model/save authority.
- Remove tuning.visible usage as persisted/runtime authority.
- Keep prepareForSave() cleanup behavior for empty note payloads.

Out of scope:
- New Graveyard UX for missing-table references.
- New section revive/migrate UX beyond current manual repair path.

## 2) Canonical data contract

### 2.1 New persisted field

Song.noteTablesLayout shape:

```json
"noteTablesLayout": [
	{ "tableID": "tblP46_2", "visible": true },
	{ "tableID": "tblDADGAD_1", "visible": true },
	{ "tableID": "tblBass4_1", "visible": false }
]
```

Rules:
- Array order is Tunings in Song order.
- Every row in Tunings in Song is represented here.
- visible controls table layout rendering only.
- Notes in sections remain valid regardless of visible.

### 2.2 Ghost table definition

Ghost table = table data present in model (sections/wirings) without an attached visible instrument/table view.

Rules:
- Ghost tables are valid model citizens.
- Ghost tables must participate in Wiring selects/pickers/validation.
- On load, ghost presence triggers showMessages informational output (not fatal).

### 2.3 X gating contract

Delete (X) in Tunings in Song is disabled when InMem is present and > 0.

Gate details:
- Blank/whitespace InMem UI, or null/undefined in backing data, means ungated (X enabled).
- Plugin-owned notes count toward InMem.
- Listener/Observer references do not count as table-owned notes for this gate.
- Disabled X carries title: Delete Sections/Notes first.

## 3) Compatibility and versioning plan

### 3.1 Read compatibility

Support both song formats at load time:
- Existing field: visibleNoteTables (legacy input)
- New field: noteTablesLayout (canonical)

Migration logic:
1. If noteTablesLayout is present, use it.
2. If both noteTablesLayout and visibleNoteTables are present, noteTablesLayout wins and visibleNoteTables is ignored.
3. Else if visibleNoteTables is present, map each tableID string to { tableID, visible: true }.
4. Ensure noteTablesLayout exists in memory (possibly empty array).

### 3.2 Write format

On save:
- Persist noteTablesLayout.
- Write songfileVersion as V2.1.
- Omit visibleNoteTables entirely from V2.1 persisted output.

### 3.3 Version handling

V2 handlers must accept V2.1 as valid V2-family input.

Schema/validator direction:
- visibleNoteTables remains optional for read compatibility.
- noteTablesLayout is required in canonical write path and should always exist (including empty array).

## 4) Concrete implementation changes

### A) Song model API (Song.js, SongPersistence.js)

Add or adapt model helpers around noteTablesLayout:
- getNoteTablesLayout()
- setNoteTablesLayout(layout)
- getVisibleTuningIDs() derived from noteTablesLayout.visible
- getVisibleTunings() derived from noteTablesLayout + tunings lookup
- helper for Wiring options that includes visible, hidden, and ghost model tables

Update persistence constructor defaults:
- Initialize noteTablesLayout as [] if absent.
- Keep migration from visibleNoteTables during hydration.

Rename/update operations:
- Tuning ID rename must atomically update sectionNotesByTable keys and noteTablesLayout.tableID entries.

### B) Save path and load path (infinite-neck.js)

Save path:
- Remove DOM scraping as visibility source.
- Save current model noteTablesLayout state.

Load path:
- Run migration to canonical layout field.
- Detect ghost tables and call showMessages with approved text once per song-load event only.
- Preserve no-visible-table state when that is the loaded truth.

### C) Tunings in Song behavior (TuningsLibrary.js)

Render and interaction model:
- Build rows from noteTablesLayout order/state.
- View checkbox toggles noteTablesLayout[row].visible.
- Up/down moves reorder noteTablesLayout array.
- X button enablement uses resolved InMem gate rules.

Performance:
- Checkbox toggle must be granular show/hide update, not full reinstall, unless strictly required.

### D) Layout/render projection (TableBuilder.js and related)

Projection rule:
- Table rendering decisions use noteTablesLayout visibility.
- Remove tuning.visible as control signal.

### E) Wiring behavior (templates/WiringBuilder.js, NoteTableController.js, event wiring)

Required behavior:
- Wiring source/target selects include ghost tables and hidden tables.
- Wiring validation and replay paths treat those tables as valid model tables.
- Existing listener/observer playback behavior remains intact after reload.

## 5) Concrete files expected to change

- Song.js
- SongPersistence.js
- infinite-neck.js
- TuningsLibrary.js
- TableBuilder.js
- templates/WiringBuilder.js
- NoteTableController.js
- bin/song-file-schema.js
- bin/validate-song-schema.js
- _tests/jest/song-api-load-V2.test.js
- _tests/jest/song-tuning-rename.test.js
- _tests/jest/ui-smoke.test.js
- _tests/jest/display-options.test.js
- _tests/jest/song-load-library.test.js

Note:
Exact test file set may expand during implementation.

## 6) Test plan (required)

### 6.1 Migration and persistence

1. Load legacy visibleNoteTables-only song and migrate in memory to noteTablesLayout with visible=true rows.
2. Save migrated song writes V2.1 and noteTablesLayout.
3. V2 handlers accept V2.1 as valid V2-family input.
4. noteTablesLayout always exists in saved payload (empty allowed).
5. V2.1 save omits visibleNoteTables completely.
6. If both fields are present on load, noteTablesLayout wins.

### 6.2 Tunings in Song behavior

1. Hidden tuning remains in Tunings in Song row list with checkbox off.
2. Checkbox toggles only layout visibility and preserves section note data.
3. Up/down changes noteTablesLayout order.
4. X disables when InMem > 0 and shows title help.
5. X enables when InMem is blank/whitespace/0/null/undefined.

### 6.3 Wiring and ghost behavior

1. Hidden and ghost tables appear in Wiring selectors.
2. Listener/Observer wirings referencing hidden or ghost tables survive reload.
3. Ghost tables trigger showMessages informational warning on load.

### 6.4 Rename and repair

1. Rename updates sectionNotesByTable keys and noteTablesLayout.tableID atomically.
2. Manual ID repair path remains functional for ghost-table recovery flow.

## 7) Delivery sequence and checkpoints

1. Implement schema/version compatibility and model migration.
2. Implement Song model helpers and rename propagation for noteTablesLayout.
3. Implement Tunings in Song row/render/update behavior from noteTablesLayout.
4. Implement wiring selector/model-table coverage for hidden and ghost tables.
5. Remove remaining tuning.visible control usage.
6. Add and update tests.

Checkpoint A (after step 2):
- Legacy fixture loads and exposes noteTablesLayout correctly in memory.

Checkpoint B (after step 4):
- Ghost wiring flows are selectable, valid, and replay-safe.

Checkpoint C (after step 6):
- Full save/load round trip passes with V2 and V2.1 fixtures.

## 8) Round 4 locked decisions (coding-approved)

1. noteTablesLayout key name:
- Use tableID (not tablename).

2. Dual-field precedence:
- noteTablesLayout always wins; visibleNoteTables is ignored when both exist.

3. Ghost load messaging:
- showMessages warning appears once per load event only.

4. V2.1 save payload:
- Omit visibleNoteTables entirely.

## 9) Definition of done

Iteration 5 is complete when all are true:
- noteTablesLayout is the single model/save source of order and visibility.
- Tunings in Song can be rebuilt with hidden rows retained and ordered.
- Ghost tables are preserved and usable in Wiring tools.
- X gating behaves exactly per InMem rules and title hint.
- Save/load supports legacy input migration and writes canonical V2.1 output.
- noteTablesLayout entries persist with tableID key.
- Dual-field load precedence and ghost warning frequency match Round 4 locks.
- Tests cover migration, behavior, wiring, rename, and round-trip persistence.

