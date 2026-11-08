# sprint-155 Iteration 1: Analysis of the wishlist and initial layout

Status: analysis only. No code was changed. Everything below was read from the code and from a scan of `songs/**` (excluding `_trash`). **Nothing was run in a browser.**

Inputs: [155-design.md](155-design.md), [sprint-155.md](sprint-155.md), and the Sprint 150 work it builds on ([150-it3-implementation-report.md](../150-palette-crud-redo/150-it3-implementation-report.md)).

## 1. Summary

1. The wishlist is feasible and mostly additive to the Sprint 150 code, but **one item is not a UI change: "checkboxes for system stylesheets" replaces the built-in *level* model with a *set* model.** Today a built-in click means "this level and everything under it". Folders, checkboxes, Print and NoteFunctions all depend on that being replaced. It touches the recipe grammar, `resetBuiltInFlags`, `setBuiltInLevel`, `applyRecipe`, `buildRecipe`, `parseRecipe` and about 42 existing Jest tests.
2. **Recipe token order is cosmetic today** (the Song's list order is the truth), so "User names before system names" is cheap and safe. See 3.4.
3. **Precedence and display order are two different things** and the proposed list mixes them up: Print must beat Roles/Fingerings/Highlights, but the list shows Print above them. See 4.2.
4. Real content collisions exist in the shipped Songs: `light-minor` has **two different versions**, and the wishlist text and list disagree on the Mood names. See 6.
5. The collapsed-folder row, Default row and wrapping of long names are all cheap at run time (no change to the note-rendering hot path). See 5.
6. 22 questions for the Design Team are in section 8, each with a recommendation. The ones that block coding are Q1 to Q8.

## 2. How it works today (verified)

| Fact | Where |
|---|---|
| Built-ins are a fixed ordered list `All-Clear, CycleOfColors, Roles, Fingerings, Highlights, Default`. | [stylesheetPlan.js](../../../../templates/palette/stylesheetPlan.js#L10) |
| A built-in link click ticks everything up to it and unticks the rest (a **level**). The recipe is `<highest ticked built-in>[+<ticked user sheets>]`. | [setBuiltInLevel](../../../../templates/palette/stylesheetPlan.js#L167), [buildRecipe](../../../../templates/palette/stylesheetPlan.js#L195) |
| `Default` is a *computed* entry: a snapshot of Roles + Fingerings + CycleOfColors + Highlights merged at module load. It shows `⇒`/`⇏`, no checkbox. | [userColors.js](../../../../userColors.js#L426) |
| The live dict starts from that Default snapshot, then layers every ticked non-computed sheet in `song.colorDicts` **object order**. So key order in `song.colorDicts` is the precedence. | [applyStylesheetsTo_gUserColorDict](../../../../colorFunctions.js#L405) |
| Built-ins are **not persisted** in the Song file (`filterPersistentColorDicts` drops `readOnly`/`computed`). They are re-injected, all ticked, on every Song open. Only user sheets and their `checked` flag are saved. | [SongPersistence.js](../../../../SongPersistence.js#L371), [installDefaultColorDicts](../../../../infinite-neck.js#L2487) |
| Only user rows get `.ssButtons` (up/down/delete) and a checkbox. Built-in rows get a `✓` glyph and a link. | [colorDictDisplayRow](../../../../colorFunctions.js#L242) |
| User sheet names are cleaned to `[A-Za-z0-9-]`, so `+` can never be inside a name. A user sheet whose name equals a built-in is renamed `<name>-user` on open and every stored reference is repointed (UserLog entry). | [sanitizeColorDicts](../../../../templates/palette/stylesheetPlan.js#L119) |
| The stored value is `currentColorDict` (per Section, Song-DEFAULTS, or a Look name). `song.activeStylesheets` is written but never read at open. | [buildColorDicts](../../../../colorFunctions.js#L163) |
| `/vdd` and the Matrix both print the stored string through the shared `cellText`. The Matrix adds a `title` only when the text is over 12 characters (`CLIP_TITLE_LENGTH`); I found no wrapping or clipping rule. | [display-options.js](../../../../display-options.js#L86), [displayOptionsMatrixView.js](../../../../templates/display-options/displayOptionsMatrixView.js#L44) |

Key sets of the current built-ins (from the code):

| Sheet | Keys |
|---|---|
| All-Clear | every role except `noteTransparent`/`noteAutomatic` (all `noteWhite`) |
| CycleOfColors | `note1` to `note12` |
| Roles | `noteRoot`, `noteScale`, `noteChord`/`2`/`3`, `noteColornote`/`2`/`3`, `noteChromatic`, `notePassing`, `noteAvoid`/`2`/`3`, `noteBass`, `noteLead`/`2` (plus the readonly `noteTransparent`, `noteAutomatic`) |
| Fingerings | `noteFinger0` to `4`, `noteFingerT` |
| Highlights | `noteH1` to `noteH3` |

**These four are pairwise disjoint, so independent checkboxes cannot conflict for them.** Conflicts only start when new sheets overlap (Mood*, Print*), see 4.2.

### What the shipped Songs use

Scan of every `songs/**/*.json` outside `_trash`:

| Song-embedded user sheet | Songs defining it | Keys | Note |
|---|---|---|---|
| `light` | 8 | 12 (`note1` to `note12`) | all 8 copies identical |
| `light-notes` | 6 | 12 | all identical |
| `light-minor` | 8 | 13 (`note1` to `note12` + `noteRoot`) | **2 different versions** (`diatonics*.json` vs `theory/mode-nat-minor-transposed*.json`) |
| `light-3` | 2 | 13 | |
| `ionian` | 1 | 13 | |
| `user` | 7 | 1 (`note1`) | demo blues Songs |
| `piano` | 1 | 2 | test fixture |

Values stored in Sections/DEFAULTS: `user` (7 Songs), `Default` (4), `light-notes` (4), `light-minor` (4), `light-3` (2), `light` (2), `mojo` (1, **no sheet by that name exists**), `ionian` (1), `piano` (1). No shipped Song stores `Roles`, `Fingerings`, `Highlights`, `CycleOfColors` or `All-Clear` as a value.

Consequences:
- The Songs **embed their own copies**, so adding system sheets with *different ids* (`MoodLight`, ...) breaks nothing. **There is no id conflict with any proposed new name** (`CycleOfColors`, `MoodLight`, `MoodDark`, `MoodBlue`, `Forest`, `LaMer`, `Print`, `Halftone`, `Gradient`, folder names). The "update system songs if an id conflict is found" clause is not triggered by anything in the repo.
- A Song that stores a level-style recipe (`Roles+user`) would change meaning, but none of the shipped Songs do, so under the no-legacy rule this is acceptable.

## 3. Wishlist item by item

| # | Wishlist item | Verdict | Notes |
|---|---|---|---|
| 1 | System stylesheets in expandable folders; users flat at the bottom | Feasible | Needs a registry data structure (4.1) and folder rows in `buildColorDicts`. `song.colorDicts` can stay a **flat** map so [applyStylesheetsTo_gUserColorDict](../../../../colorFunctions.js#L405), Looks, Graveyard and persistence keep working. Folders become a *view* over it. |
| 2 | `AllClear` on top, never uncheckable, still a link | Feasible, nearly free | Already true today (always ticked, link edits a copy). Wishlist says `AllClear`; code, tests and help say `All-Clear`. See Q22. |
| 3 | Outline view for system sheets | Feasible | See 5.1. Folder open/closed state must survive table rebuilds (the table is rebuilt on every change), so it lives in a module-level set, like `editor`. |
| 4 | NoteFunctions folder: CycleOfColors + curated light* sheets | Feasible, content work | Content is design work, see 6. Moving CycleOfColors into a folder also moves it out of the level chain. |
| 5 | Print folder: grayscale, half-tone, gradient, full override | Feasible, needs new CSS | See 7. |
| 6 | User names before system names (`light-notes+Default`) | Cheap and safe | See 3.4. |
| 7 | Reconsider `Default` | Needs a decision | See 3.1 and Q5. |
| 8 | Checkboxes for system sheets, no reordering | Feasible, **model change** | See 3.2. |
| 9 | Collapsed folder shows its own `Default`-like row, no run-time drag | Feasible | Compose per folder in the same pass as the Result row. See 5.2. |
| 10 | `AllClear` should not clutter built-up names | Feasible | Grammar consequence in 3.3 (how to say "nothing but AllClear"). |
| 11 | Constrain width of built-up names in `/vdd` and Matrix | Feasible | View-only; see 5.3. |
| 12 | Only user sheets get `.ssButtons` | **Already true** | Keep as is. |
| 13 | New left column for the open/closed glyph | Feasible, more plumbing | See 5.1 for the cheaper alternative. |

### 3.1 What `Default` means (the wishlist leaves it open)

`Default` currently plays three roles at once: (a) a *level* (top of the chain), (b) a computed row showing the merged system colors, and (c) the recipe token Songs store (`Default`, 4 Songs). With system checkboxes, (a) disappears. Two coherent readings:

- **A. Fixed baseline.** `Default` = the shipping set (`CycleOfColors`, `Roles`, `Fingerings`, `Highlights`). Row never changes.
- **B. Live system composite.** `Default` row = merge of whatever system sheets are ticked right now, placed directly above the user sheets, so you see "system result" before user overrides. The Result row at the bottom then is "system result + user sheets".

Recommendation: **B for the row** (it is what makes the row useful once system sheets are checkable), and keep the *token* `Default` only as an alias that means "the shipping set" (3.3). The row tooltip should say so, otherwise `Default` the row and `Default` the token can disagree and confuse people.

### 3.2 Checkboxes replace levels

- Needs a per-sheet `defaultOn` flag. Today [resetBuiltInFlags](../../../../templates/palette/stylesheetPlan.js#L161) ticks **everything** at Song open. That would switch Print on for every Song. It must become "tick the `defaultOn` ones".
- The link on a system row should **not** tick it (the checkbox does that); it only loads the editor as a copy source. User links keep "tick + load editor". Slight inconsistency, see Q12.
- Section apply stays absolute (`applyRecipe` sets all flags from the value), so a Section that stores `Print+user` switches Print on and `Roles` off.

### 3.3 Recipe grammar (proposal)

Set grammar: `<ticked user sheets, highest precedence first>+<ticked system sheets>`.

- A recipe is a **set of tokens**; token order has no meaning (it never did: [applyRecipe](../../../../templates/palette/stylesheetPlan.js#L224) sets flags only and does not reorder).
- `AllClear` is omitted (it is always on). If it is the only system sheet ticked it is written literally, so that "all system sheets off" is expressible: `light+AllClear`. Without this rule an empty system set cannot be told apart from the legacy "no system token means Default" rule.
- `Default` is written when the ticked system set equals the shipping set; otherwise the explicit list is written, e.g. `user2+user1+Roles+Fingerings+MoodLight`.
- Parsing accepts a bare user name with no system token (as `user`, `mojo`, `light` in shipped Songs) and treats it as "shipping set + that user sheet", same as today's "first token not a built-in implies Default".
- Unknown system tokens (a Song saved by a newer app) are reported as missing by [describeColorValue](../../../../templates/palette/stylesheetPlan.js) the same way missing user sheets are, so the Matrix strike-through works with no extra code.

### 3.4 "User names before system names"

Because token order is cosmetic, this is a change to `buildRecipe`'s output and nothing else. Two things to confirm (Q7): (a) whether stored values change or only the display string; I recommend changing the canonical stored form (parse accepts both, so there is no legacy work); (b) reading left to right as "highest precedence first" also reverses the *user* sheets (`user2+user1+Default`), since a lower row in the list wins. If only system-after-user is wanted, `user1+user2+Default` is simpler but then the order reads inconsistently.

## 4. Proposed design

### 4.1 Developer-maintainable registry (new pure module, no DOM)

A single ordered array in a new file, e.g. `templates/palette/systemSheets.js`:

```js
export const SYSTEM_SHEETS = [
  { type: 'sheet',  id: 'All-Clear', sheet: gAllClear, alwaysOn: true },
  { type: 'folder', id: 'NoteFunctions', exclusive: true, items: [
      { id: 'CycleOfColors', sheet: gDefault_CycleOfColors, defaultOn: true },
      { id: 'MoodLight', sheet: ... }, /* MoodDark, Forest, LaMer */ ] },
  { type: 'sheet',  id: 'Roles',      sheet: gUserColorDictRolesDefault,     defaultOn: true },
  { type: 'sheet',  id: 'Fingerings', sheet: gUserColorDictFingeringsDefault, defaultOn: true },
  { type: 'sheet',  id: 'Highlights', sheet: gUserColorDictHighlightsDefault, defaultOn: true },
  { type: 'folder', id: 'Print', exclusive: true, items: [ /* Print, Halftone, Gradient */ ] },
];
```

Pure helpers derive everything else: flat list in precedence order (what gets injected into `song.colorDicts`), `folderOf(id)`, `defaultSet()`, reserved names, and per-folder composite. `BUILT_IN_ORDER`, `isBuiltInName` and `builtInKeys` in [stylesheetPlan.js](../../../../templates/palette/stylesheetPlan.js#L10) are rebuilt from it, so a new system sheet is a one-entry change. The sheet data itself stays in [userColors.js](../../../../userColors.js) (the existing pattern).

### 4.2 Precedence is not the display order

Because `song.colorDicts` object order is the precedence, and each layer replaces **whole cells** (color and hatch are not layered separately), the list order must be chosen on purpose:

- **Print/Halftone/Gradient are full-cell alternatives**, so they are effectively mutually exclusive; stacking them only means "the last wins" and looks like two things are on. A folder flag `exclusive: true` (tick one, the others untick; unticking the last leaves none) is more honest, and also makes recipes short.
- **Print must win over Roles/Fingerings/Highlights**, otherwise one click cannot make a Song grayscale. In the proposed list Print comes *before* them, so it would lose.
- `light-minor`/`light-3`/`ionian` also color `noteRoot`, which is a **Roles** key. As user sheets they won today because user sheets sit above all built-ins. If curated `Mood*` sheets keep `noteRoot`, NoteFunctions must sit above Roles; if they do not, order is moot.

Recommendation: make the **list order equal the precedence order (bottom wins)**, the same rule users already know for user sheets and the Result row. That means `AllClear, NoteFunctions, Roles, Fingerings, Highlights, Print, Default, users...`. Alternative if the original order is wanted: add an explicit numeric `layer` per entry and keep it separate from the display order (more code, easy to get wrong). Q3, Q4.

### 4.3 Name reservations

Every new system id and folder id becomes a reserved name. User sheets that already use one are renamed `<name>-user` on open with references repointed (existing behavior). Risk: names like `Forest`, `LaMer`, `Print` are plausible user names, but the shipped Songs have none, so only Songs in the wild are affected, and they get a UserLog line. Folder id and sheet id must not be equal (wishlist has folder `Print` containing sheet `Print`); also note the table Theme `Print` ([themes.js](../../../../themes.js#L312)) and the Sprint 154 Print layout use the same word. See Q13.

## 5. Rendering, cost, and the "view only" items

### 5.1 Folder rows in the Stylesheets table

`buildColorDicts` rebuilds the whole table on every change. Adding a folder header row, indented child rows and a glyph is straightforward. Two options for the glyph:

- **Inside the name cell** (glyph span + indent): no change to the header row, the Result row or the column math. Recommended.
- **New narrow left column** (as in the vision): needs one extra `td` in `ssRowHeader`, in `colorDictDisplayRow` (both branches), in the Result row and in the CSS in [palette.css](../../../../templates/palette/palette.css). It aligns the glyphs perfectly. Moderate cost, no technical blocker.

Either way: every new row and button gets an `id` (project rule from Sprint 150: `ssFolder-<slug>`, `ssFolderToggle-<slug>`), the toggle is a real `button` with `aria-expanded`, and opening/closing should toggle a CSS class on the folder's rows instead of calling `buildColorDicts` (so no repaint). The open set is a module-level `Set` that `buildColorDicts` reads when it rebuilds.

### 5.2 "Default" of a closed folder, without run-time drag

- The live dict used by the note-rendering hot path (`lookupUserColor` reads only `gUserColorDict.dict`) is **not touched**. The folder composites exist only for the table.
- A folder composite is "merge of that folder's ticked members" (at most a few sheets of at most about 50 keys), computed in the same pass that already builds the Result row, once per user action. That is negligible.
- Closed folder row: glyph, folder name, the composite's color cells (blank where the folder defines nothing, e.g. Roles columns for NoteFunctions), and a tooltip listing the ticked members. Open folder row: glyph and name, no color cells; the members follow with checkbox, link, name, cells.
- The built-up name must still list the *members* (`CycleOfColors`), not the folder, because the folder is not a layer. So the closed row hides detail the recipe still shows; the `title` on the row should list it. Q10.

### 5.3 Long built-up names in `/vdd`, Matrix and the palette

Both grids print through the same `cellText` ([display-options.js](../../../../display-options.js#L86) and [cellBody](../../../../templates/display-options/displayOptionsMatrixView.js#L44)). Recommended: a small pure, key-aware helper used by both that escapes each token and joins with `+<wbr>`, so the browser may break after a `+`, plus `max-width` and the existing `title` carrying the full string. Storage is untouched. Abbreviating system names (`Fng`) is worse: unreadable and one more thing to keep in sync. The Result row label and `.ActiveStylesheets` text in the palette can show the full string with the same helper (the palette width question is separate: the name cell uses `<nobr>`, so long names widen the table; drop `<nobr>` for the wrapped form and keep the `title`).

## 6. Content questions for the NoteFunctions folder

- The wishlist text names **`MoodLight` and `MoodBlue`**; the list shows **`MoodLight`, `MoodDark`, `Forest`, `LaMer`**. Which set?
- Existing candidates and what I could see (only the first colors of each were inspected; I did not compare them visually):
  - `light` (yellow family on `note2` upward), `light-notes` (yellow family, 12 keys): probably the same family. Merge or keep two?
  - `light-minor`: **two differing versions** (`diatonics*.json` begins `noteAnthracite`/`noteBlue7`; `mode-nat-minor-transposed*.json` begins `noteBlue7`/`notePink3`). One survives, or two sheets?
  - `light-3`, `ionian`: not mentioned in the wishlist; each embedded in 1 to 2 Songs.
- I suggest a read-only `bin/` tool that prints each candidate as a swatch table (id, source Songs, hash, per-role class) so the Design Team can pick by looking, instead of by hash. It is allowed under the project rules (`./bin/`), and is the first thing I would build.
- Cleanup is optional and separable: after the new sheets exist, a `bin/` tool could drop the embedded duplicates (`light` x8, `light-minor` x8, `light-notes` x6) from system Songs and repoint their Sections to the new ids. That is a data migration across Songs, so I recommend it as a later iteration with its own review.

## 7. Print folder content (technical constraints)

- Cells are `colorClass` strings; a sheet cell may be `"noteHatchedRoot noteWhite"` (color part + hatch part, split on the `noteHatched` prefix). Halftone and gradient need **new CSS classes** (for example dot patterns via `radial-gradient`, tone steps via `linear-gradient`) in [infinite-neck.css](../../../../infinite-neck.css) next to the `.noteHatched*` rules.
- Give each class a real `background-color` as well as a `background-image`. [resolveHighlightGlowColor](../../../../colorFunctions.js#L908) reads the computed `background-color` and returns null for transparent, which silently loses the glow ring.
- Caption/text contrast: dark fills need a `captionClass` (as `noteBlack`/`noteRoot` do); the sheet must set it per cell.
- [print.css](../../../../print.css#L107) already sets `print-color-adjust: exact` in `@media print`, so patterns will print.
- "Full override" means the Print sheet defines **all** role keys (Roles, Fingerings, Highlights, and likely `note1` to `note12`), like All-Clear does, otherwise a colored CycleOfColors cell survives under it. This is the reason Print must sit above NoteFunctions too.
- Whether the new classes appear in the Customize pickers ([colorPickerColors.js](../../../../colorPickerColors.js)) is a decision (Q16). The sheet works without it: `sanitizeCell` accepts any `[A-Za-z0-9_ -]` class.

## 8. Questions and holes for the Design Team

Recommended answer in *italics*. Q1 to Q8 block coding.

**Model**
1. Confirm built-in *levels* are replaced by independent checkboxes (a click on `Roles` no longer ticks everything under it). *Yes.*
2. Folder mode: `exclusive` (one ticked at most) or free multi-select? *Exclusive for Print; NoteFunctions exclusive too, with "none ticked" allowed (then `note1` to `note12` show AllClear white). Revisit after UA.*
3. List order vs precedence: one order (bottom wins), or an explicit `layer`? *One order: AllClear, NoteFunctions, Roles, Fingerings, Highlights, Print, Default.*
4. Do the curated `Mood*` sheets color `noteRoot`? If yes NoteFunctions must outrank Roles. *No: keep them to `note1` to `note12` and let Roles keep `noteRoot`, unless a look really needs it.*
5. What is the `Default` row (3.1, A or B) and what does the token `Default` mean? *B for the row, token = shipping set alias.*
6. How is "only AllClear" written, and is `Default` written when the set equals the shipping set? *`AllClear` literal only when alone; yes write `Default` for the shipping set.*
7. User-before-system: store it that way or only display it? Do user sheets also reverse (highest first)? *Store it; reverse users too so left always means "wins".*
8. System tick state persistence. Today it lives only in the recipe stored by Sections/Song-DEFAULTS (not in the Song file), so unticking Roles without a SAVE Diff is lost on reopen, while user ticks persist. Acceptable, or persist (for example apply `song.activeStylesheets` at open)? *Accept; document in help; it is the same rule as every other Display Option.*

**UI**

9. Folder open/closed state: session only (module `Set`), localStorage, or in the Song? *Session only, default closed.*
10. What does a closed folder row show: only its composite and name, or also the ticked member names (`NoteFunctions (CycleOfColors)`)? *Name plus composite; member names in the tooltip.*
11. A folder-level checkbox (tick all / none)? *No. It fights `exclusive`.*
12. Click on a system link: load the editor only, or also tick? *Load only; the checkbox ticks. User links keep tick + load.*
19. Glyph in the name cell or a new left column (5.1)? *In the name cell for this sprint.*

**Names and content**

13. Folder id must differ from its member id (`Print` folder vs `Print` sheet vs table Theme `Print`). *Folder `Print`, sheet `PrintGray`; all ids reserved.*
14. Which Mood set, and which `light-minor` survives (6)? *Decide from the swatch tool.*
15. Update system Songs to the new ids now, or later? *Later iteration; nothing conflicts today.*
16. Print sheets: which keys, `captionClass`, and whether the new classes go into the pickers. *All roles including `note1` to `note12`; yes captionClass; not in the pickers yet.*
17. Should entering the Print screen (Sprint 154) auto-tick a Print sheet? Not in the wishlist. *Out of scope; note it for 156.*
18. Width: `<wbr>` wrap vs abbreviation, and which surfaces get it (Matrix, `/vdd`, `.ActiveStylesheets`, Result label)? *`<wbr>` on all four; full string always in `title`.*
20. Looks store recipes; Looks saved under the old level grammar are unaffected (none shipped). Any Looks to pre-install with the system sheets? *No.*
21. `defaultOn` per sheet (Print and Mood sheets off). *Yes, replaces "tick everything" at open.*
22. Keep the id `All-Clear` or rename to `AllClear` as in the wishlist? *Keep `All-Clear`: no shipped Song stores it, but code, tests, help and the Graveyard use it and the gain is cosmetic.*

**Holes and risks found**

- **Sprint 150 it3 may not be browser-verified** (UA checklist C in its report). Sprint 155 builds on that code; I recommend closing that UA first or fixing the two together.
- `Default` is used as both a token and a computed row (3.1); the Result row label uses it too.
- Every `Default` expectation in tests ([stylesheet-plan.test.js](../../../../_tests/jest/stylesheet-plan.test.js), [stylesheet-open-and-matrix.test.js](../../../../_tests/jest/stylesheet-open-and-matrix.test.js)) assumes level semantics and must be rewritten, not patched.
- [SongPersistence.js](../../../../SongPersistence.js#L262) defaults `activeStylesheets` to `"Default"`; keep working with the alias.
- The `mojo` value in `pentatonics-7-m-V7-in-6-keys-with-fill.json` has no sheet; it only works because of the "unknown first token means Default" rule. Keep that rule (3.3).
- Because the system sheets are module singletons, `checked` flags are shared; the reset at open (Sprint 150) must stay and use `defaultOn`.
- Matrix/`/vdd` "missing sheet" detection must treat an unknown system token like a missing user sheet (3.3).

## 9. Rough implementation plan

Top-level files (these need the Design Team's explicit go-ahead per the repo rules): [colorFunctions.js](../../../../colorFunctions.js), [userColors.js](../../../../userColors.js), [infinite-neck.js](../../../../infinite-neck.js), [infinite-neck.css](../../../../infinite-neck.css), [colorPickerColors.js](../../../../colorPickerColors.js), [display-options.js](../../../../display-options.js), [help.html](../../../../help.html). Everything else is under `templates/`, `bin/` or `_tests/`.

1. **Decide Q1 to Q8** (this document). Close the Sprint 150 UA.
2. **Pure model, Jest first, no UI.** New `templates/palette/systemSheets.js` (registry, `defaultSet`, `folderOf`, reserved names, folder composite); rework [stylesheetPlan.js](../../../../templates/palette/stylesheetPlan.js) to the set grammar (`buildRecipe`, `parseRecipe`, `recipeKey`, `applyRecipe`, `resetBuiltInFlags` using `defaultOn`, replace `setBuiltInLevel` with `setSystemSheet` honoring `exclusive`, `isBuiltInName` from the registry). Rewrite the two Jest files. No browser needed.
3. **Content tooling.** `bin/` swatch report of the candidate light* sheets; Design Team picks; add the `Mood*` data to `userColors.js`.
4. **Print CSS and sheets.** New `.notePrint*`/halftone/gradient classes, the Print folder sheets, a visual page in the style of the existing `gradient-test.html`, UA on the Sprint 154 print screen.
5. **Palette list UI.** Folder rows, glyph, indentation, system checkboxes, Default row, collapsed-folder composite, `ssFolder-*` ids, palette.css. Keep every Sprint 150 id.
6. **Plumbing.** `installDefaultColorDicts` injects in precedence order and uses `defaultOn`; rename collisions via the registry's reserved names; `.ActiveStylesheets` and the Result label use the new canonical name.
7. **Grid width.** Shared wrap helper used by `/vdd` and the Matrix, plus CSS; Jest on the helper (pure string, escaped).
8. **Docs and schema.** [help.html](../../../../help.html) `#paletteUsage` (folders, checkboxes, Default, the ticks-not-saved rule), [bin/song-file-schema.js](../../../../bin/song-file-schema.js) if any field changes, sprint report with a UA checklist.
9. **Later (optional):** migrate system Songs off their embedded `light*` copies.

### Test approach

Jest only for non-browser logic, following the existing patterns (no JSDOM/jQuery): registry invariants (no duplicate ids; sheet and folder ids distinct; every sheet's keys are known roles; precedence order equals flat order), grammar round trips (`parse(build(x))` for every folder mode), `exclusive` behavior, `defaultOn` at open, user-before-system output, parse of every value found in `songs/**` (`user`, `Default`, `mojo`, ...), collision renames for each new reserved name, wrap helper escaping. The browser behavior (glyphs, folder open/close, print) goes into a UA checklist, as in Sprint 150.
