# TODO

## Inbox / Unassigned

- place new TODOs here...
- 

## Outstanding Tasks

## Bugs

## Save Path / Model-Controller Separation

## TODOs about migrating to a pure Model architecture

### Architecture Principle
The Song model (`song.js`) must never touch the DOM or jQuery.
UI state is gathered by the controller (`infinite-neck.js`) and passed into the model via `prepareForSave()` or direct field assignment.

### Code Sections to Know
- `song.js` — `prepareForSave({ visibleTableIds, songName, theme, bpm, userColors, userInstrumentTuning })` — the pure model entry point for all save-path state
- `song.js` — `markVisibleTablesForFileSave(visibleTableIds)` — accepts the array, sets `visibleNoteTables` + `tunings`
- `infinite-neck.js` — `updateMemoryModelPreFileSave()` — the controller-layer DOM snapshot; the only place that reads DOM values for save
- `infinite-neck.js` — `exportFromTable()` — also computes `visibleTableIds` for cross-table note export

### TODOs — Wire UI change events directly into the model

Each of these events should call `getSong().<field> = <value>` immediately on change, so the model stays current without needing `updateMemoryModelPreFileSave()` to do a bulk snapshot at save time.

- [ ] **BPM** — `#txtBPM` change event → `getSong().defaultBPM = "" + parsedBpm`
  - `getBPM()` in `infinite-neck.js` is still used at runtime (beat clock, etc.) — it can stay, but it should stop writing to the model; the model write belongs in the change handler
- [ ] **Theme** — `#selThemes` change event + "Theme" button click → `getSong().theme = val`
- [ ] **Song name** — `#txtFilename` blur/leave event → `getSong().songName = val`
- [ ] **User colors** — palette customization buttons/links (all `recordUserColors*` paths) → `getSong().userColors = gUserColorDict.dict` (may already happen in some paths — audit `recordUserColors` and `recordUserColorsFromSection`)
- [ ] **User instrument tuning** — currently set in `prepareForSave` via `TableBuilder.findTuningForID("USER")`; should eventually be set when the user changes the USER tuning, not at save time. Belongs on the NoteTable when NoteTables become independent objects.

### TODO — visibleTableIds (future: NoteTable objects)
- [ ] Currently, `visibleTableIds` is computed at save time by querying DOM visibility — this is acceptable for now since tables don't change visibility independently
- [ ] When NoteTables become independent objects, each NoteTable should track its own visible state. The `visibleNoteTables` array on Song then becomes a derived property (or is populated by NoteTable lifecycle events)
- [ ] `markVisibleTablesForFileSave(visibleTableIds)` is already the right seam — the caller just needs to source the array from NoteTable objects instead of a DOM query

### TODO — updateMemoryModelPreFileSave() end state
Once all change events write to the model directly, `updateMemoryModelPreFileSave()` should shrink to only:
1. Compute `visibleTableIds` from DOM (or NoteTable state)
2. Call `getSong().prepareForSave({ visibleTableIds, ...all other fields already current on model... })`
Or, if all fields are kept live, it may reduce to just `getSong().removeUnusedTablesFromMemoryModel()` + the `visibleTableIds` snapshot.

## Round-trip test cleanup (song-api-load.test.js)

### What was done
- Replaced `updateMemoryModelPreFileSave()` + `$` stub with a direct call to
  `song.prepareForSave({ visibleTableIds, songName, theme, bpm, userColors, userInstrumentTuning })`
  using values sourced from the file data.
- Removed: `installMinimalDollarStubForSavePath`, `applySaveInputsFromLoadedData`,
  `stripHeadlessVolatileSaveFields`, and the `updateMemoryModelPreFileSave` import.
- Removed: `updateMemoryModelPreFileSave` from the test imports (still exported for the app).

### One remaining strip: `tunings`
`tunings` is a denormalization of `visibleNoteTables` — each tuning object is a live reference
from `allTunings.tunings` and carries a runtime `visible` flag (DOM visibility state).
That flag is `false` in headless tests but was `true` when the file was saved in a browser.
`visibleNoteTables` covers the real persistence contract and round-trips correctly.

- [ ] Fix `tunings.visible` so it is not captured as part of the saved-file snapshot.
  Options:
  1. Strip `visible` from the tuning object in `markVisibleTablesForFileSave` before saving
     (save a plain value object, not a live reference).
  2. Deep-clone the tuning objects in `getTunings` and omit `visible`.
  The test comment documents this already; remove the `delete tunings` lines once fixed.
-



