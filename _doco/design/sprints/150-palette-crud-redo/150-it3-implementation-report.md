# Sprint 150 — Iteration 3 Implementation Report

Status: coded and Jest-verified (85 suites / 1213 tests green). **Nothing here has been exercised in a browser yet.** Use UA checklist C below.

Decisions applied (from [150-design.md](150-design.md) "Iteration 3"): Looks + Recipe; all new DIVs have ids; delete glyph is U+232B (⌫) including the Tunings `btnRemoveTuning`; the Tuning move/delete buttons and the new Stylesheet buttons share one box size; all top-level edits approved; Q1–Q17 accepted as recommended.

## What was built

### Pure planning module (new)
[templates/palette/stylesheetPlan.js](../../../../templates/palette/stylesheetPlan.js) — no DOM, all logic Jest-tested.
- Names: `cleanSheetName`, `freeName`, `sanitizeColorDicts`.
- Flags and order: `resetBuiltInFlags`, `setBuiltInLevel`, `moveUserSheet`.
- Recipes: `buildRecipe`, `parseRecipe`, `recipeKey`, `applyRecipe`, `chooseColorDictValue`, `describeColorValue`.
- Usage/rename: `findSheetUsage`, `findLookUsage`, `describeUsage`, `repointReferences`.
- Editor state machine: `createEditor`, `editorSelect`, `editorSetPart`, `editorClearRole`, `editorLoadEdits`, `visibleCell`, `countChanges`.
- Plans: `planSave`, `planCopy`, `planRename`, `describePlan`, `buildSheetEntry`, `planSaveLook`, `describeLookPlan`.

### colorFunctions.js (rewritten)
- Safe jQuery rendering (`.text()`, `.attr()`), ids on every row/button.
- Row buttons ↑ ↓ ⌫; delete buries the sheet in the Graveyard and reports what still references it.
- Click a user sheet = tick + load editor, no reorder. Click a built-in = set level only, user sheets untouched.
- `applyStylesheetsTo_gUserColorDict` rebuilds the live dict from the OEM dict + ticked sheets in list order.
- Save / Copy / Rename / New / From Section, with a live hint line and disabled buttons when nothing would happen.
- Looks: select, name box, Save Look, remove.
- Removed: `recordUserColors*`, `saveUserColorChoices`, `clean_ColorSchemeName`, `moveStylesheetToEnd`, `registerColorSchemeCBEventSelectors*`; `userColors.js` `resetUserColorsToDefault`.
- Backup of the old file was at `/tmp/colorFunctions.old.js` (not in repo; use git history).

### Palette UI
- [templates/palette/palette.html](../../../../templates/palette/palette.html): Looks block, Legend (`#btnLegend_Stylesheets`), message line, name row, buttons, hint and note. Iteration 2 test ids kept.
- [templates/palette/palette.builder.js](../../../../templates/palette/palette.builder.js): wiring.
- [templates/palette/palette.css](../../../../templates/palette/palette.css): `.ssRow`, `.ssHint`, `.ssMessage`, `.ssLegend`, `.ssCell-*` etc.

### infinite-neck.js
- `installDefaultColorDicts`: sanitize names/classes, reset built-in flags per Song (fixes carry-over between Songs), repoint references on rename, log under UserLog "Stylesheet".
- `updateAfterOpenSong`: `resetStylesheetEditor()` after `buildColorDicts()`.
- Section apply: `applyColorLook(currentColorDict)`.
- `appendStylesheetsFromSong` skips `__proto__`.

### Other
- [TuningsLibrary.js](../../../../TuningsLibrary.js) remove button `&#x232B;`; [infinite-neck.css](../../../../infinite-neck.css) unified glyph-button box and `:disabled` style.
- Matrix: `dmMissingSheet` wavy strike-through for a `currentColorDict` naming a missing sheet (Section cells, DEFAULTS row, LIVE row); [display-options.css](../../../../display-options.css) / `templates/display-options/*`.
- [bin/song-file-schema.js](../../../../bin/song-file-schema.js): `colorLooks` entry.
- [help.html](../../../../help.html) `#paletteUsage` updated (Stylesheets, Customize, task table, Save rules, Sections, new `#paletteLooks`). `#palette` and `#paletteOverview` untouched.

## Tests added
- [_tests/jest/stylesheet-plan.test.js](../../../../_tests/jest/stylesheet-plan.test.js) — 32 tests.
- [_tests/jest/stylesheet-open-and-matrix.test.js](../../../../_tests/jest/stylesheet-open-and-matrix.test.js) — 10 tests (open/no carry-over, name cleaning + repoint, unsafe class/role drop, live-dict rebuild, matrix flags, schema, glyph/CSS contract).
- Scan of shipped `songs/**`: 33 user sheets, 0 renames, 0 dropped cells.

## Behavior changes to know about
1. A Song with ticked user sheets now stores the canonical recipe (e.g. `Default+user`) in `song.currentColorDict` at open; a later Save writes it into Sections. A plain `Default` Song is not written.
2. Sections apply a recipe **absolutely** (they no longer "add up").
3. Clicking `Default` no longer unticks user sheets.
4. Updating a sheet keeps its position (previously moved to bottom); the old version goes to the Graveyard.
5. Names are sanitized on open, with a UserLog entry.
6. The checked color radio is preserved across rebuilds.
7. "Starting copy" memory for built-ins is gone: a built-in source writes only changed cells.

## UA checklist C (browser)
1. Open a Song with user sheets: list, ticks, ↑↓⌫ present; Result row correct.
2. ↑↓⌫ heights match the Tunings buttons in Song; Tunings ⌫ shows the glyph.
3. Click a built-in (level changes, user sheets stay), then a user sheet (ticks, name box fills, editor loads, no reorder).
4. Edit cells: color, hatch, `clear`, `none`; cell states (saved/edited/removed/inherited/blank) and hint counts match.
5. Save a new name, Save over an existing name (Graveyard gets the old one), built-in name → `-user`, Look name blocked, empty name → `user`, no-change disabled.
6. Copy and Rename (Sections/Looks/DEFAULTS follow the rename).
7. Delete: message lists references; raise from Graveyard.
8. From Section with AutoColor on and off (note text differs).
9. Looks: Save, choose, update, remove; select tracks `currentColorDict`.
10. A Section storing a Look or recipe applies it absolutely, in both directions of travel.
11. Matrix: missing sheet strikes through in Section, DEFAULTS and LIVE cells; hover title names it.
12. Open another Song after All-Clear: no carry-over of built-in ticks.
13. Enter key in the name box = Save Stylesheet.
14. Legend toggle opens/closes with the arrow.
15. Picker positioning for the cell pickers (each role row).
