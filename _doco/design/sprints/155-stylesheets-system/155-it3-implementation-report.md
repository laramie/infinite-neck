# Sprint 155, Iteration 3: Implementation report

Status: core coding done. Full Jest: 92 suites, 1387 tests, all passing. **Nothing has been tested in a browser yet**; see the User Acceptance checklist (section D).

## A. What was built

**New modules**

- [templates/palette/systemFolders.js](../../../../templates/palette/systemFolders.js): `SYSTEM_LAYOUT` (the one place that says which system sheets exist, their order, folders, `alwaysOn`, `defaultOn`, `exclusive`) and pure helpers that take an optional `layout` so Jest can inject its own: `systemIds`, `shippingIds`, `findLayoutSheet`, `exclusiveSiblings`, `layoutProblems`.
- [templates/palette/optionalSheets.js](../../../../templates/palette/optionalSheets.js): the cells of `MoodLight`, `MoodMinor`, `Letterpress`, `Gradient`, `Halftone`, with a "how to edit" header.

**Layout, in precedence order (the bottom wins)**

| Row | Notes |
| --- | --- |
| `All-Clear` | always on, no checkbox, shows a check mark |
| folder `NoteFunctions` | exclusive; `CycleOfColors` on at open |
| `Roles`, `Fingerings`, `Highlights` | top level; on at open |
| folder `Moods` | exclusive; `MoodLight`, `MoodMinor`; off at open |
| folder `Printing` | exclusive; `Letterpress`, `Gradient`, `Halftone`; off at open |
| your sheets | flat list, no folder, non-exclusive, arrow and delete buttons |

The shipping set (what `Default` means) is `All-Clear`, `CycleOfColors`, `Roles`, `Fingerings`, `Highlights`.

**Model** ([templates/palette/stylesheetPlan.js](../../../../templates/palette/stylesheetPlan.js))

- The level model is gone (`setBuiltInLevel`, `highestBuiltIn`, `resetBuiltInFlags`). New: `resetSystemFlags`, `setSystemSheetChecked` (exclusive folders untick siblings), `isSystemTicked`, `assembleColorDicts`.
- Recipes are sets. `buildRecipe` writes your ticked sheets, then the system sheets, each last-applied first; the shipping set collapses to the token `Default` (for example `b+a+MoodLight+Default`); `expandDefault` writes them out (used by Save Look so a Look keeps its meaning). `parseRecipe` returns `{system, users}`; `Default` expands to the shipping set; a recipe with no system token means shipping plus those users (so the stored `user`, `Default+user`, `mojo` values in the shipped Songs still parse); `All-Clear` is always included.
- `Default` is a Look: `allLooks`/`lookTable` put it first. It is not stored, cannot be saved over, and `planSaveLook` refuses the name. `Default` and all system ids are reserved names (user sheets of those names get `-user`). Folder names are not reserved.
- `planStylesheetRows`, `folderSummaryCells`, `folderLabel`, `wrapRecipeHtml`: the pure half of the new table.

**UI** ([colorFunctions.js](../../../../colorFunctions.js), [templates/palette/palette.css](../../../../templates/palette/palette.css), [templates/palette/palette.html](../../../../templates/palette/palette.html))

- `buildColorDicts` is split: `renderStylesheetsTable()` draws only; the folder arrows and the "All" box call just that (no repaint, no Section change).
- Corner cell is the "All" checkbox in the Floaty style (id `ssAllCheck`, **unchecked by default**); the word "Stylesheets" is gone.
- First column is three fixed slots: glyph | mark | name. Folder rows have the arrow (`ssFolderToggle-<name>`, `aria-expanded`) and the label `Folder : child+child` (last-applied first) or just the name; children are tinted, not indented. A closed folder shows the merged colors of its ticked sheets; an open one is blank; an unticked sheet row is blank unless "All" is on. The `<nobr>` is removed.
- System sheets have a checkbox (except `All-Clear`); clicking a system name only loads the editor. User sheets are unchanged.
- Looks select lists `Default` first; the remove button is disabled for it. The strip label shows the Look name (or `Default`), else the recipe, with the recipe as a `title`. `Active Stylesheets` and the strip wrap after each `+`.

**Wiring and wrap**

- [infinite-neck.js](../../../../infinite-neck.js) `installDefaultColorDicts` uses `assembleColorDicts` (no `Default` row any more).
- The live dict still starts from the OEM seed (column order and the `noteTransparent`/`noteAutomatic` frame keys that only `Roles` has); `All-Clear` is always on and overrides every other role.
- `wrapRecipeHtml` is used by [display-options.js](../../../../display-options.js) (/vdd) and the Matrix ([templates/display-options/displayOptionsMatrixView.js](../../../../templates/display-options/displayOptionsMatrixView.js), class `dmWrapCell`, rule in [display-options.css](../../../../templates/display-options/display-options.css)).
- CSS `.noteHatchedHalftoneTrippy` in [infinite-neck.css](../../../../infinite-neck.css).
- [help.html](../../../../help.html): Palette Stylesheets, system sheets, Section recipes and Looks sections rewritten.

## B. Decisions to check

1. **`MoodMinor` has no `noteRoot`**, per "Mood sheets do not color noteRoot". The source Song sheet had `noteRoot: {colorClass:'noteHatched4 noteBlue7', captionClass:'noteBlack', caption:'Root', tiny:'R'}`; restoring it is one line, written in the header comment of `optionalSheets.js`. The stray `MOJOcaptionClass` key was not copied.
2. **All three folders are exclusive**, because the design says `Moods` is exclusive "for now" and `Printing` and `NoteFunctions` hold sheets that only make sense one at a time. This is one flag each in `systemFolders.js`. Nothing in Jest pins it.
3. **Saved recipes stay readable.** The old `Default+user` form parses (the token `Default` is the shipping set). Old level-style recipes such as `Roles+a` now mean `All-Clear`+`Roles` only; no shipped Song uses one (checked with a scan of `songs/`).
4. **Save Look** stores the fully expanded system list, so it keeps meaning the same sheets if the shipping set changes later; recipes the app writes into Sections use `Default`.
5. **Printing sheets** are literal copies of `All-Clear` (checked identical by a script). `Gradient` and `Halftone` have only `note1` changed.
6. The Song `mojo` (no sheet) was left for you to fix, as agreed.

## C. Files

New: `templates/palette/systemFolders.js`, `templates/palette/optionalSheets.js`.
Changed: `colorFunctions.js`, `infinite-neck.js`, `display-options.js`, `infinite-neck.css`, `help.html`, `templates/palette/stylesheetPlan.js`, `templates/palette/palette.css`, `templates/palette/palette.html`, `templates/display-options/displayOptionsMatrixView.js`, `templates/display-options/display-options.css`.
Tests rewritten or edited: `_tests/jest/stylesheet-plan.test.js`, `_tests/jest/stylesheet-open-and-matrix.test.js`, `_tests/jest/song-api-more.test.js`.
No change: `userColors.js`, `SongPersistence.js`, `bin/song-file-schema.js`.

Jest additions: layout invariants on the real layout (no duplicate ids, optional below shipping, every optional sheet's cells are known roles) and everything about exclusivity, folders and rows on an injected `TEST_LAYOUT`.

## D. User Acceptance checklist (browser)

1. Open any Song, open Palette > Stylesheets. The corner cell shows an "All" checkbox (unchecked) and no word "Stylesheets".
2. Rows, top to bottom: `All-Clear` (check mark), folder `NoteFunctions`, `Roles`, `Fingerings`, `Highlights`, folders `Moods` and `Printing` (closed), then your sheets. Ticked rows show colors; unticked rows are blank.
3. Tick **All**: unticked rows now show their colors. Untick it: they go blank again. Folder rows do not change.
4. Open each folder with its arrow and with its name. Children are tinted, not indented; the glyph, mark and name stay in three aligned columns. Close it: the label reads `Moods : MoodLight` when one is ticked, or just `Moods`.
5. Tick `MoodLight`; the Note Function colors change on the instrument. Tick `MoodMinor`: `MoodLight` unticks. Untick it: the colors return.
6. Tick `Gradient` (Printing): note 1 shows the hatched pink pattern. Tick `Halftone`: note 1 shows the halftone image. Print preview keeps the pattern.
7. Untick `Roles`. The Emboss and Auto swatches in the Result row and the instrument still work (frame keys kept). The recipe now lists the system sheets instead of `Default`.
8. `Active Stylesheets` and the strip show `Default` at open. With two of your sheets and `MoodLight` ticked the text reads like `b+a+MoodLight+Default`, wraps after a `+`, and the strip's tooltip shows the recipe.
9. Looks select: `Default` is first. Choosing it restores the shipping ticks. The remove button is disabled for it, and Save Look refuses the name `Default`.
10. Click a system name (for example `Roles`): the editor loads, the name box shows `Roles-user`, and **nothing is ticked or unticked**. Click a name of one of your sheets: it is ticked and loaded as before; arrows and delete still work.
11. Open another Song after unticking `Roles` here: the shipping set is ticked again.
12. Display Options Matrix and `/vdd`: a long Color recipe wraps instead of widening the column; a missing sheet is still struck through.
13. Open a Song with the `light`/`light-minor` sheets (for example `songs/theory/mode-nat-minor-transposed-ebony-ivory.json`): its own sheets appear in the flat user list, with no collision with `MoodLight`/`MoodMinor`.
14. Check the help page: Palette > Stylesheets, Sections and Songs, and Looks.

Not done, out of scope: auto-ticking Printing on print, cleaning the shipped Songs, curating more Moods.
