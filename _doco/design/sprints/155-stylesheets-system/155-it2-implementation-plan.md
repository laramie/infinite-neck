# sprint-155 Iteration 2: Implementation plan

Status: plan for review. **No code has been changed.** Built from "Iteration 2" in [155-design.md](155-design.md) only; ideas from [155-it1-analysis.md](155-it1-analysis.md) that the Design Team dropped or simplified are not carried forward. Sprint 150 UA passed 20261108, so this builds on the current [colorFunctions.js](../../../../colorFunctions.js) and [stylesheetPlan.js](../../../../templates/palette/stylesheetPlan.js).

## 1. What gets built

| # | Feature | Source |
|---|---|---|
| 1 | System stylesheets are **independent checkboxes** (no levels). Order in the list = precedence, bottom wins. | Q1, Q3, "Design Team reports" |
| 2 | **Folders** are a view over the flat system list: closed = name + summary of ticked children; open = name + blank cells; never a checkbox; not Looks, not stylesheets, not reserved names. | Design Simplifications |
| 3 | Top-level (no folder) rows: `All-Clear`, `Roles`, `Fingerings`. Folders: `NoteFunctions` (`CycleOfColors`) and `Moods` (one sheet copied from Song `light`). | Design Simplifications |
| 4 | **"All" checkbox** in the 0,0 corner cell: show every row's colors vs only ticked rows. Folder rows ignore it. | Design Simplifications |
| 5 | **`Default` is a Look** (the shipping set), first in the Looks list, read-only. The `Default` row and computed sheet are gone. `Result` stays as the bottom row. | Design Simplifications, Q5, Q6 |
| 6 | `All-Clear` is an ordinary name in built-up names. | Design Team reports |
| 7 | Built-up names list user sheets first, last-applied first: `user2+user1+...`. | Q7 |
| 8 | `defaultOn` per system sheet decides what is ticked at Song open. | Q21 |
| 9 | Long names break after `+` (`<wbr>`), `nobr` removed, full string in `title`: palette, `Result`/`Active Stylesheets`, `/vdd`, Matrix. | Q18 |
| 10 | Folder state (open/closed) is session-only, default closed. | Q9 |
| 11 | A click on a **system link** loads the editor only (copy source); only the checkbox ticks. No `.ssButtons` on system rows. | Q12 |
| 12 | Two developer modules: one for **folders**, one for the **optional system sheets**. | Design Simplifications |

Not in this sprint: curating Moods (only one), Gradient/Halftone/Letterpress content (see Q2), cleaning shipped Songs, auto-ticking a Print sheet, a Mood swatch tool, folder checkboxes, any UI to edit system rows.

## 2. Target look

Defaults shown (shipping set ticked; `Moods` open to show the child; `NoteFunctions` closed):

```
[x] All          | note1 note2 ... (role columns)
  ✓ All-Clear
▸ NoteFunctions : CycleOfColors      <- closed: summary cells of ticked children
  [x] Roles
  [x] Fingerings
  [x] Highlights
▾ Moods                              <- open: name only, blank cells
  [ ] MoodLight
  [x] mine          ↑ ↓ ⌫            <- user sheets, flat, last
⇒ Result
```

First column is three fixed-width slots so every name lines up: **glyph | mark (checkbox, `✓`, or blank) | name**. Folder rows use the glyph slot and leave the mark slot blank. Child rows are not indented (alignment is the requirement); a CSS tint/left border marks them as children.

## 3. Verified starting point

- Built-ins today are `All-Clear, CycleOfColors, Roles, Fingerings, Highlights, Default`, injected at open from module singletons ([installDefaultColorDicts](../../../../infinite-neck.js#L2487)); `Default` is the computed snapshot [gUserColorDictOEM](../../../../userColors.js#L426).
- The live dict is rebuilt from `gUserColorDictOEM.dict` then ticked sheets in `song.colorDicts` order ([applyStylesheetsTo_gUserColorDict](../../../../colorFunctions.js#L405)). **That base disappears with `Default`** (see 4.4).
- Level logic lives in `setBuiltInLevel`, `highestBuiltIn`, `buildRecipe`, `parseRecipe`, `applyRecipe`, `resetBuiltInFlags` ([stylesheetPlan.js](../../../../templates/palette/stylesheetPlan.js#L161)) and in [chuseStylesheet](../../../../colorFunctions.js#L335).
- The table is rebuilt from scratch by [buildColorDicts](../../../../colorFunctions.js#L163), which also writes `song.activeStylesheets`/`song.currentColorDict` as a side effect. The corner cell is `td.ssHeaderCaption`; names sit in a `<nobr>` ([colorDictDisplayRow](../../../../colorFunctions.js#L242)).
- Looks are `song.colorLooks` (user data, persisted); `Default` is already a reserved name, so a user Look or sheet cannot take it.
- Shipped Songs store these `currentColorDict` values: `user`, `Default`, `light-notes`, `light-minor`, `light-3`, `light`, `ionian`, `piano`, `mojo`. Today's `Default` is the same set as the new shipping set, so the 4 Songs that store `Default` need no change.
- The "Floaty" checkbox style is `label.MainMenuTabBtn.BtnPunchedOut.BtnPunchedOutLighter > input[type=checkbox]` ([index.html](../../../../index.html#L74)). I could not find a control captioned "MIDI on" by text; Floaty is my reference (Q5).

## 4. Design

### 4.1 Two developer modules (data only, no DOM)

- **[templates/palette/systemFolders.js](../../../../templates/palette/systemFolders.js)** (new). The one ordered layout. Ids only; no sheet objects, so Jest imports it without `userColors.js`.

  ```js
  export const SYSTEM_LAYOUT = [
    { sheet: 'All-Clear', alwaysOn: true },
    { folder: 'NoteFunctions', exclusive: true, sheets: [{ id: 'CycleOfColors', defaultOn: true }] },
    { sheet: 'Roles',       defaultOn: true },
    { sheet: 'Fingerings',  defaultOn: true },
    { sheet: 'Highlights',  defaultOn: true },
    { folder: 'Moods', exclusive: true, sheets: [{ id: 'MoodLight' }] },
  ];
  ```
  List order is precedence order (bottom wins). Adding a folder or sheet is a one-entry edit here plus data in the other module.
- **[templates/palette/optionalSheets.js](../../../../templates/palette/optionalSheets.js)** (new). The sheet data for everything that is not one of the four shipping sheets already in `userColors.js`: `OPTIONAL_SHEETS = { MoodLight: {readOnly:true, computed:false, checked:false, dict:{...}} }`. `MoodLight` is a copy of Song `light` (12 keys `note1`..`note12`), minus the stray `MOJOcaptionClass` key. A header comment states how to add one.
- The join of ids to objects happens in one place, [installDefaultColorDicts](../../../../infinite-neck.js#L2487): `{ 'All-Clear': gAllClear, CycleOfColors: gDefault_CycleOfColors, Roles, Fingerings, Highlights, ...OPTIONAL_SHEETS }`, inserted in `SYSTEM_LAYOUT` flat order, then user sheets. `userColors.js` is not edited.

`stylesheetPlan.js` imports `SYSTEM_LAYOUT` and derives everything else, with the layout as an optional parameter on each function so Jest can inject test layouts:

- flat id list in precedence order (replaces the hard-coded `BUILT_IN_ORDER`),
- `folderOf(id)`, `defaultIds()` (= `alwaysOn` + `defaultOn`; this *is* the shipping set),
- reserved names = system ids + `Default`. **Folder names are not reserved.**

### 4.2 Flags

- At Song open every system sheet's `checked` = `alwaysOn || defaultOn` (replaces `resetBuiltInFlags` ticking everything). Fixes carry-over between Songs the same way Sprint 150 did.
- `All-Clear` is always ticked and has no checkbox (`✓`). It must stay on: it is the only full baseline once `Default` is gone.
- Ticking a sheet in an `exclusive` folder unticks its siblings; unticking is allowed (none ticked is valid). A stored recipe/Look that names two sheets of one exclusive folder ticks both (stored values win; exclusivity only governs clicks).
- `setBuiltInLevel` is deleted. The system checkbox sets that one flag, then follows the existing user-checkbox path: `refreshAfterUserChange()` + `displayOptionsChanged()`.

### 4.3 Recipe grammar and the `Default` Look

A recipe is a **set of tokens**; token order is cosmetic (as in Sprint 150: apply sets ticks and never reorders, the Song's list order is the precedence).

- **Tokens:** user sheet names, system sheet ids, and `Default` (expands to the shipping set).
- **Canonical build** (what `Active Stylesheets`, `Result`, and stored values show): ticked user sheets in reverse list order, then the ticked system part in reverse list order. If the ticked system part contains the whole shipping set, it is written as extras then `Default`:
  - shipping set only: `Default`
  - plus user `a`, `b`: `b+a+Default`
  - plus `MoodLight`: `b+a+MoodLight+Default`
  - Roles unticked: `b+a+Highlights+Fingerings+CycleOfColors+All-Clear` (explicit list, `All-Clear` like any other name).
- **Parse:** union of tokens, `Default` expanded; `All-Clear` is always added. A recipe with **no system token at all** (shipped values `user`, `light`, `mojo`, ...) means the shipping set plus those user sheets, which is today's "unknown first token implies Default" rule. Level-grammar values from Sprint 150 (for example `Fingerings+user`) change meaning; none are shipped, so no legacy handling.
- **`Default` Look:** system-provided, derived from `defaultIds()`, **not stored in the Song file** and not in `song.colorLooks`. One pure `allLooks(song)` returns `{ Default: <expanded shipping recipe>, ...song.colorLooks }`, and every *reader* of Looks uses it: `songLooks()` in colorFunctions, `describeColorValue` (Matrix), `findSheetUsage`, `findLookUsage`, `valueTokens`, `chooseColorDictValue`. Writers keep using `song.colorLooks`, so `repointReferences`, `saveColorLook` and `removeColorLook` cannot touch `Default`.
- Because `Default` is first in `allLooks`, `chooseColorDictValue` already prefers it when the ticked set equals the shipping set. The rule "a Song that never chose a stylesheet stores nothing" changes from `recipe !== 'Default'` to "canonical recipe differs from the `Default` Look".
- **Floating vs locked (the "to discuss" item):** a stored `Default` means "the shipping set of whatever app opens the Song", so changing the registry to `CycleOfColors2027` follows automatically. To lock a set, the User saves a Look. For that to work, **Save Look stores the fully expanded explicit recipe** (no `Default` token inside it), while auto-stored values use the short form.
- `song.activeStylesheets` keeps being written (never read), using the same short canonical form, so Song files do not grow a long string.

### 4.4 Live dict

`applyStylesheetsTo_gUserColorDict` builds: the two readonly frame keys `noteTransparent` ("Emboss") and `noteAutomatic` ("Auto") taken from `gUserColorDictOEM.dict` (they exist only in `Roles` today, and the color radio buttons and strip need them even if `Roles` is unticked), then ticked system and user sheets in `song.colorDicts` order, `All-Clear` first. The key filter `hasOwn(gUserColorDictOEM.dict, key)` stays. `gUserColorDictOEM` remains as the role-key universe and the role-template source for `buildSheetEntry`; it stops being a row or a recipe token.

### 4.5 Table rendering

Rendering is split from bookkeeping: a render-only `renderStylesheetsTable()` (used by the "All" and folder toggles, which change no stored value and must not repaint or call `displayOptionsChanged`), and `buildColorDicts()` which renders then does the `activeStylesheets`/`currentColorDict` bookkeeping.

Row kinds and cells:

| Row | Mark slot | Name | Color cells |
|---|---|---|---|
| `All-Clear` | `✓` | link | always shown (always ticked) |
| system sheet | checkbox | link (load editor only) | shown if ticked, or if "All" is on |
| user sheet | checkbox | link (tick + load editor, as today) | as system sheets; keeps `.ssButtons` |
| folder, closed | blank | `Folder : childA+childB` (ticked children, precedence first) or just the name if none | merge of ticked children's cells in list order; blank if none; **ignores "All"** |
| folder, open | blank | folder name | blank |
| `Result` | none | `⇒ Result` | live merged dict, ignores "All" |

- Folder toggle is a real `button` with `aria-expanded`; open set is a module-level `Set`, default empty (all closed).
- The corner cell holds the "All" `label/input` in the Floaty style. Default on (Q5); state is a module variable, not stored.
- Every new element has an `id` (`ssFolder-<slug>`, `ssFolderToggle-<slug>`, `ssAllCheck`), all existing Sprint 150 ids stay, and all text goes in through `.text()`/`.attr()`.
- Pure helpers in `stylesheetPlan.js` so Jest covers the rules without a browser: `rowShowsColors`, `folderSummary`, `folderLabel`.

### 4.6 Looks UI

`#selColorLooks` lists `Default` first (read-only): the remove button is disabled while it is selected; Save Look cannot take the name. Choosing it applies the shipping set like any Look. Option text for long recipes keeps its `title`.

### 4.7 Long names

One pure `wrapRecipeHtml(text)` in `stylesheetPlan.js`: split on `+`, escape each token, join with `+<wbr>`. Used by the Matrix ([displayOptionsMatrixView.js](../../../../templates/display-options/displayOptionsMatrixView.js), `cellBody` for key `currentColorDict`), `/vdd` ([display-options.js](../../../../display-options.js#L86)), `.ActiveStylesheets` and the `Result`/strip label in colorFunctions. The `<nobr>` in the palette name cell is removed. Storage is unchanged and `title` carries the full string. The matrix cell gets a `dmWrapCell` class so its column can shrink; I could not confirm from CSS alone that nothing forces `nowrap` there, so this is checked in UA.

## 5. Files

Top-level files need the Design Team's explicit go-ahead (repo rule).

| File | Change | Top-level |
|---|---|---|
| `templates/palette/systemFolders.js` | new, layout data | no |
| `templates/palette/optionalSheets.js` | new, `MoodLight` data | no |
| `templates/palette/stylesheetPlan.js` | derive ids from layout; set grammar; `allLooks`; flags; `rowShowsColors`, `folderSummary`, `folderLabel`, `wrapRecipeHtml`; Save Look expanded recipe; reserved names | no |
| `colorFunctions.js` | table render split, folder rows, "All", system checkboxes, `chuseStylesheet` without levels, live dict base, Looks list, labels | **yes** |
| `infinite-neck.js` | `installDefaultColorDicts`: layout order, flags from `defaultOn`, no `Default` row | **yes** |
| `display-options.js` | `/vdd` wrap for `currentColorDict` | **yes** |
| `templates/display-options/displayOptionsMatrixView.js`, `display-options.css` | wrap | no |
| `templates/palette/palette.css`, `palette.html` | slots, folder/child/All styles; legend text (it still says "built-in level") | no |
| `help.html` | `#paletteUsage`: checkboxes instead of levels, folders, "All", `Default` Look, recipe examples | **yes** |
| `userColors.js`, `SongPersistence.js`, `bin/song-file-schema.js` | **no change** (`Default` stays a valid `activeStylesheets`; no new persisted field) | n/a |

## 6. Phases

1. **Pure model and Jest, no UI.** `systemFolders.js`, `optionalSheets.js`, then the `stylesheetPlan.js` changes. Rewrite the Jest files that assume levels, [stylesheet-plan.test.js](../../../../_tests/jest/stylesheet-plan.test.js) and [stylesheet-open-and-matrix.test.js](../../../../_tests/jest/stylesheet-open-and-matrix.test.js), rather than patching them.
2. **Open and live dict.** `installDefaultColorDicts` and `applyStylesheetsTo_gUserColorDict` (frame keys). App still shows the old table.
3. **Looks.** `allLooks`, `Default` read-only in the list, Save Look expanded recipe, Matrix missing-sheet detection (unknown token = missing).
4. **Table.** Render split, slots, folders, "All", system checkboxes, link behavior, CSS.
5. **Wrap.** `wrapRecipeHtml` on the four surfaces.
6. **Docs.** help `#paletteUsage`, palette legend, `155-it2-implementation-report.md` with a UA checklist.

## 7. Jest plan (no JSDom/jQuery, existing patterns)

- Layout invariants: ids unique; every id has data; keys are known roles; flat order = precedence; folders have at least one sheet; shipping set = `alwaysOn`+`defaultOn`.
- Open: flags from `defaultOn`; no carry-over from a previous Song (All-Clear always on); user flags kept; a user sheet named `Default`/`MoodLight`/`light`-style collision renamed `-user` with references repointed.
- Grammar: build/parse round trips for shipping, shipping+extras, Roles off, all-off (`All-Clear`); user-first, last-applied-first; `Default` expands; bare user names mean shipping + user; unknown token reported missing; order-insensitive `recipeKey`; exclusive-folder clicks vs stored recipes.
- Looks: `allLooks` has `Default` first; `Default` cannot be saved, removed or repointed; Save Look stores the expanded recipe; `chooseColorDictValue` returns `Default` when the ticked set is the shipping set.
- Table rules: `rowShowsColors` for All on/off; `folderSummary` blank/sum/ignores All; `folderLabel`.
- Live dict: frame keys present when `Roles` is unticked; later sheets win; unticked sheets contribute nothing.
- `wrapRecipeHtml`: escapes tokens, breaks only after `+`, empty and single-token input.
- A scan of every `currentColorDict` value in `songs/**` parses without throwing and resolves as shown in section 3.

Browser behavior goes to UA checklist D (Sprint 150 style): folder open/close state across edits and Song open; "All" on/off with open and closed folders; system checkbox changes Result and the note-table colors; `Default` Look in the list; a stored `Default` in the 4 shipped Songs looks the same as before; Matrix and `/vdd` wrap with a long recipe; `Roles` unticked still shows Emboss/Auto radios.

## 8. Holes found and how the plan handles them

- **Emboss/Auto keys vanish** if `Roles` is unticked and the base is `All-Clear` alone (they exist only in `Roles`). Handled by the frame keys in 4.4.
- **Song `light` vs system `light`:** if the system sheet were named `light`, the 8 shipped Songs that embed their own `light` would be renamed `light-user` on open (collision rule) and the Section values repointed, which defeats "use them in place to preview". Plan uses `MoodLight` (Q1).
- **Folder summary vs recipe:** the recipe lists member sheets, not folders, so the closed row shows `Folder : members` to stay consistent with what `Result` and the Matrix say.
- **Floating `Default`:** a stored `Default` follows future changes to the shipping set (by design). Locking uses Save Look with the expanded recipe.
- **`extras+Default` precision:** writing `MoodLight+Default` is precedence-exact only if every optional sheet sits below (after) every shipping sheet in the layout. The layout above does this, and Jest asserts it so a later layout edit that breaks it fails loudly.
- **Stored order is not enforced** (unchanged from Sprint 150): applying `b+a` while the list is `a, b` uses the list order. The canonical name always reports the real list order.
- **View-only toggles** (All, folders) must not run the stored-value bookkeeping in `buildColorDicts`; hence the render split.

## 9. Questions for the Design Team

Q1 to Q3 block coding. Recommendation in italics.

1. **Id of the Mood sheet.** `light` (as written) collides with the `light` embedded in 8 Songs and would rename theirs on open; the earlier list also says `MoodLight`. *Use `MoodLight`; folder `Moods`; keep Song copies as they are.*
2. **Print this sprint?** Q13 listed `PrintPress` with Letterpress/Gradient/Halftone, but Iteration 2 only asks for one Mood sheet. *Not now; the layout takes it as a data-only addition. Optionally add `Letterpress` (a copy of `All-Clear`) now so a second folder and the "later so they win" order get real UA coverage.*
3. **`Highlights` placement.** Not in your list of no-folder sheets. *Top level, after `Fingerings`.*
4. **`Default` inside names.** Accept `Default` as a token in canonical names (`b+a+MoodLight+Default`) when the ticked set contains the shipping set, and explicit lists otherwise? *Yes (4.3).*
5. **"All" checkbox.** Default state and persistence, and the style reference (I used the Floaty markup; "MIDI on" was not found by that text). Also whether the word "Stylesheets" stays in the corner cell next to it. *Default on (today's look), session-only, drop the word because the button above already says it.*
6. **First column.** Three fixed slots glyph | mark | name, children tinted not indented? *Yes.*
7. **Closed-folder text.** Members in precedence order (as recipes) and name only when none ticked? *Yes.*
8. **Exclusive.** Q2 answered yes for NoteFunctions and Print; do you also want `Moods` exclusive? *Yes, exclusive with none allowed. Only Jest can exercise it until a folder has two sheets.*
9. **`Default` "in the list".** I read this as the Looks dropdown, first and read-only (the stylesheets table has no `Default` row). Correct?
10. **Instrument strip label** (`.colorDictSwatchStrip`, a fifth place a long recipe shows). *Look/`Default` name when the selection equals one, else the recipe with a `title`.*
