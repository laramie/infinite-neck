# sprint-150 Iteration 2: Migration, Probe Results, UA Checklists, Implementation Plan

Request: [150-design.md](150-design.md) (section "Iteration 2 Request").  Sprint: [sprint-150.md](sprint-150.md).  Previous: [150-it1-report.md](150-it1-report.md).

Contents:

0. [Migration to templates/palette/ (done)](#0-migration-to-templatespalette-done)
1. [Probe results (corrects two Iteration 1 findings)](#1-probe-results)
2. [UA checklist A: migration baseline](#2-ua-checklist-a-migration-baseline)
3. [UA checklist B: confirm the open findings in the browser](#3-ua-checklist-b-confirm-the-open-findings)
4. [The model we are building](#4-the-model-we-are-building)
5. [What gets stored in a Section (deferred, but shaped now)](#5-what-gets-stored-in-a-section)
6. [Implementation plan](#6-implementation-plan)
7. [Final questions](#7-final-questions)

---

## 0. Migration to templates/palette/ (done)

No functionality changed.  `git mv` was used so history follows the files.

| Before | After |
|---|---|
| `templates/palette.builder.js` | [templates/palette/palette.builder.js](../../../../templates/palette/palette.builder.js) |
| `templates/palette.css` | [templates/palette/palette.css](../../../../templates/palette/palette.css) |
| `templates/palette.html` | [templates/palette/palette.html](../../../../templates/palette/palette.html) |
| (planned) | `templates/palette/stylesheetPlan.js`, created in Iteration 3 |

[paletteUtils.js](../../../../paletteUtils.js) stays at the top level: it is not a template, and [key-handlers.js](../../../../key-handlers.js) and [templates/midi/midi.builder.js](../../../../templates/midi/midi.builder.js) import it from there.

References updated (every one found by search; the three old paths are now absent from all code):

| File | Change |
|---|---|
| [templates/palette/palette.builder.js](../../../../templates/palette/palette.builder.js) | Four relative imports `../` to `../../`. |
| [index.html](../../../../index.html) | `<link>` to `templates/palette/palette.css`. |
| [infinite-neck.js](../../../../infinite-neck.js) | `import ... from './templates/palette/palette.builder.js'`, `loadTemplates('templates/palette/palette.html')`, one comment. |
| [bin/print-control-defaults.js](../../../../bin/print-control-defaults.js) | **Functional.**  It reads `templates/palette.html` and silently skips a missing file (`existsSync`), so the AutoColor/default drift check would have quietly stopped looking at the palette markup. |
| Comments only | [infinite-neck.css](../../../../infinite-neck.css), [presentation.js](../../../../presentation.js), [display-options.css](../../../../templates/display-options/display-options.css), [displayOptionsMeta.js](../../../../templates/display-options/displayOptionsMeta.js), [function-symbols.builder.js](../../../../templates/function-symbols/function-symbols.builder.js). |

Left alone on purpose: historical sprint documents and the CHANGELOG, which describe the old paths as they were.

New Jest guard: [_tests/jest/palette-template-layout.test.js](../../../../_tests/jest/palette-template-layout.test.js) (5 tests, no browser): the files are in the new folder and absent from the old one, `index.html` and `infinite-neck.js` point at the new paths, every relative import of the builder resolves, the markup still carries the ids the builder binds, and `bin/print-control-defaults.js` reads the new path.

**Jest, full run: 80 suites, 1039 tests, all passing** (79 / 1034 before, plus the 5 new).

---

## 1. Probe results

The real [colorFunctions.js](../../../../colorFunctions.js) and [userColors.js](../../../../userColors.js) were run in Node with a stubbed jQuery, as in Iteration 1.  The probe is deleted.  "Browser" means a check is still listed in section 3.

| # | Question | Result | Consequence |
|---|---|---|---|
| P1 | **B3 as stated** (stale colors left in the live dict after clicking a built-in or unchecking a user sheet) | **Refuted.**  Record `U {Finger1: noteRed1, note9: noteBlue1}`, then click `Roles`: Finger1 is `noteWhite` and note9 is `noteYellow2`.  `All-Clear` defines every role and is always checked, and `applyStylesheetsTo_gUserColorDict` applies checked, non-computed sheets in list order, so All-Clear is a complete baseline.  Clicking `All-Clear` and then checking and unchecking `U` also restores white. | The "rebuild the live dict from a baseline" fix is **not needed**.  This matches your Q6 sketch: All-Clear then additions works today. |
| P2 | Built-in checkboxes: can the user switch All-Clear off? | No: built-in rows have no checkbox, only the link.  `Default` is `computed` and is skipped when merging. | All-Clear stays the baseline by construction. |
| P3 | **Carry-over to the next Song** | **Confirmed.**  The built-in sheets are module singletons.  `installDefaultColorDicts()` ([infinite-neck.js](../../../../infinite-neck.js#L2350)) re-uses the same objects, so their `checked` flags survive Song open.  After clicking `All-Clear` in Song A, a freshly built Song B starts with `All-Clear+ CycleOfColors- Roles- Fingerings- Highlights- Default-`, and its colors are all white.  Nothing resets the flags on open. | This is the real B3.  It is the bug you described ("choices carried through to the next Song").  Fix: reset the built-in flags to a known state on Song open (Q14 asks which). |
| P4 | `.ActiveStylesheets` vs stored `currentColorDict` | Record `CycleOfColors-user`, then `CycleOfColors-user2`: `currentColorDict` = `CycleOfColors-user2`; the Active string = `Default+CycleOfColors-user+CycleOfColors-user2`.  Delete `-user2`: `currentColorDict` still `CycleOfColors-user2` (sheet gone); Active = `Default+CycleOfColors-user`.  Uncheck `-user`: `currentColorDict` unchanged; Active = `Default`. | Two different values, never kept in step.  `currentColorDict` is only "the last name that was clicked, recorded, or applied by a Section"; it ignores checkbox toggles and deletes.  Store Cell stores that, not what Result shows.  This is the confusion you hit. |
| P5 | Link click reorders? | Yes: after `A, B` records, clicking link `A` gives `...,B,A`.  Clicking `Roles` then leaves `B-` and `A-`. | Confirms the history-dependent order you want to remove. |
| P6 | **B10** hatch-only pick | Records `colorClass = "noteHatchedRoot"` (hatch only).  Color+hatch records `"noteBlue1 noteHatchedRoot"`.  `none` records nothing (0 keys).  The CSS `.noteHatched*` classes set only `background-image`, so a hatch-only entry is a legitimate "lines over the existing fill" look, not a lost color. | **Reclassified: not a bug.**  It only matters for the new "remove" meaning of `none` (section 4). |

Also found by reading, for the plan:

- `song.activeStylesheets` already holds the long Active string, is saved in the Song file, is validated in [bin/song-file-schema.js](../../../../bin/song-file-schema.js#L378), and is **never read back**.  It is dead data today and a ready place for a recipe (section 5).
- The Result row and the "strip" row take their label as the row id: `colorDictRow&rArr;&nbsp;Result` and `colorDictRowAll-Clear+CycleOfColors+...`, which are not valid selector ids (your point).  The user-sheet checkbox id `cbWhichColorDict<name>` is selected with a raw `'#cbWhichColorDict'+name` selector, so any name with a space, `.`, `+` or `:` cannot be found.
- The checkbox handler ([colorFunctions.js](../../../../colorFunctions.js#L396)) never calls `buildUserColors()` or `displayOptionsChanged()` (B4, by code; browser check B2 below).
- `resetUserColorsToDefault()` in [userColors.js](../../../../userColors.js) is unexported and unused (vestige).

Status of the Iteration 1 findings after this:

| It1 | Status |
|---|---|
| B1 hidden base not cleared | Retired by design: Phase 5 removes the hidden base (your Q2 answer). |
| B2 Sections accumulate | Deferred to the stored-value work (Phase 6); see Q9. |
| B3 stale live dict | **Corrected:** the real defect is the carry-over of built-in flags (P3), fixed in Phase 3. |
| B4 checkbox does less than a click | Phase 3. |
| B5 dangling `currentColorDict` | Phase 3 (clear on delete) and Phase 6 (matrix strike-through). |
| B6, B7 silent merge, nothing-picked | Phase 5 (bury and say so; hint; guard). |
| B8 rebuild eats picks and role selection | Phase 5. |
| B9 AutoColor and `FirstInstrument:NamedNotes` | Phase 5, see Q5. |
| B10 hatch-only | Not a bug (P6). |
| B11 unsanitized names | Phase 3. |
| B12, B13, B14 | Phases 3 and 5. |

---

## 2. UA checklist A: migration baseline

Purpose: prove the move changed nothing.  Please run this on the branch **before** any Iteration 3 code.  Use a Song with at least two Sections and some painted notes.  Open DevTools (F12) first: Console and Network.

**Load**

- [ ] A1. Hard reload.  Console shows no red errors (a stray 404 for `palette` is the thing to look for).
- [ ] A2. Network (filter `palette`): `templates/palette/palette.css` and `templates/palette/palette.html` are 200.  Nothing requests `templates/palette.css`, `templates/palette.html` or `templates/palette.builder.js`.
- [ ] A3. Open the Palette (key `p`, or its menu).  It appears styled as before: the swatch grid, Note types, Fingering, the paint buttons (Clear, KEEP, Find Color).

**Palette behavior** (all go through the moved builder)

- [ ] A4. Click a role swatch (Root, Chord), then paint a note on a fretboard.  It takes the color.
- [ ] A5. Click CLEAR, then a painted note: it clears.  Click KEEP and Find Color: each highlights as the active mode.
- [ ] A6. Press keys `6`, `7`, `8`, `9` (note types) and `o`, `1`..`5` (fingers): the palette radio buttons follow.  (These go through `paletteUtils.js`, which did not move; this proves the wiring.)
- [ ] A7. Toggle AutoColor (key `c`).  The manual-colors area hides/shows.
- [ ] A8. Click **Stylesheets**: the table opens, with the `Roles` row, the `Result` row and the Active line.  Click **Customize ...**: the name field, the two Record buttons and the editor table open (the button text changes to "Customize Less ...").
- [ ] A9. Click the `Roles` link: the table updates and the neck repaints.  Click the `Default` link: back to the standard look.
- [ ] A10. In Customize: type `baseline1` in the name field, pick a color for one role with its `color` button, press **Record Stylesheet**.  A `baseline1` row appears with a checkbox, a link and the delete glyph.
- [ ] A11. Untick and re-tick `baseline1`'s checkbox: the Result row changes each time.
- [ ] A12. Click the delete glyph on `baseline1`: it disappears.  Open the Graveyard: a STYLESHEET record for `baseline1` is there.

**Elsewhere that points at the palette**

- [ ] A13. Open the Display Options Matrix.  Its Tool buttons (which copy the palette's highlight-button look) look as before.
- [ ] A14. Save the Song and re-open it: the Palette still loads and the Stylesheets table is as saved.

If any of A1 to A14 differs from before the move, stop and tell me the item number and what you saw; nothing in Iteration 3 should start until A is clean.

---

## 3. UA checklist B: confirm the open findings

These confirm, in the real UI, what the probe showed in Node.  Each says what the **current** code should do.  A different result is what I need to hear about.  Use two different Songs for B1.

- [ ] **B1. Built-in state carries to the next Song (P3).**  In Song A: Palette, Stylesheets, click `All-Clear`.  Open a different Song from the library.  *Expected today:* Song B opens with `All-Clear` the only checked built-in (the others blank) and a white-ish look, even if Song B's own Sections have colors.  *After the fix:* Song B starts with the known default state.
- [ ] **B2. Checkbox tick vs link click (B4).**  Record a user sheet that sets a role you can see on a paint button (say Chord to a clearly different color), ticked.  Click the `Roles` link (this unticks the user sheet).  Now tick the user sheet's **checkbox**.  *Expected today:* the Result row and the neck change, but the **Chord paint button** in the palette keeps its old color until you click a link or Record again.
- [ ] **B3. Hatch and `none` (P6).**  In Customize, for one role: (a) pick only a hatch, Record: on the neck the role shows lines over the underlying fill.  (b) Pick a color too and Record again: fill plus lines.  (c) Pick `none` in the **color** picker: *expected today:* the cell shows only the hatch.  (d) Pick `none` in the hatch picker too: *expected:* nothing is recorded for that role (the cell is blank).  Note anything that looks different from this.
- [ ] **B4. Sections accumulate sheets (V11).**  Make two user sheets `sheetA` (one role colored) and `sheetB` (another role).  Section 1: click `sheetA`, Display Options Matrix, **Store Cell** on the Color column.  Section 2: click `sheetB`, Store Cell.  Go 1, then 2, then 1.  *Expected today:* the Stylesheets table shows **both** `sheetA` and `sheetB` ticked after returning to Section 1, and the neck shows both sheets' colors.
- [ ] **B5. Stored name vs Result (P4).**  Create `x-user` and `x-user2`, both ticked.  Read the Active line under the table.  Matrix, Store Cell on the Color column: read the stored value.  Delete `x-user2`: read the Active line and Store Cell again.  *Expected today:* the Active line lists `...+x-user+x-user2`, Store Cell stores only the last clicked/recorded single name, and after the delete it still stores `x-user2`.
- [ ] **B6. Ids.**  In the Console run `[...document.querySelectorAll('tr[id^=colorDictRow]')].map(r => r.id)`.  *Expected today:* the last ids contain `&rArr;&nbsp;Result` as literal text.
- [ ] **B7. Move-on-click (P5).**  Record `m1` then `m2`.  Click the `m1` link.  *Expected today:* `m1` moves to the bottom of the list (below `m2`).

Please reply with the B-numbers whose result differs, or "B all as expected".

---

## 4. The model we are building

The rules below come from your Iteration 2 notes.  They are the contract for Phases 3 to 5.

**Layers.**  The effective colors are All-Clear, then the built-in layers up to the chosen level (CycleOfColors, Roles, Fingerings, Highlights), then the ticked user sheets in list order, later wins.  The built-ins are always listed first, in fixed order.  This is what the code already does (P1); the plan keeps it and makes it visible.

| Control | Does | Does not |
|---|---|---|
| **Checkbox** (user rows) | Turns that sheet on or off. | Reorder, select or edit. |
| **Up / Down buttons** (user rows) | Move the sheet within the user block.  Disabled at the ends. | Change which sheets are on. |
| **Remove button** (user rows) | Buries the sheet in the Graveyard and removes it. | Ask a question (Q6). |
| **Link** | **Selects** the sheet as the one being edited, loads its cells into the editor, and ticks its checkbox if it is a user sheet.  Built-in link: selects it as the editing source (see Q1, Q2). | Reorder. |
| **Name field** | The name of the sheet Save will write.  Filled from the selection. | Hold a hidden base (removed). |

The three row buttons reuse the Tunings idiom: `btnMoveTuningUp`, `btnMoveTuningDown` and `btnRemoveTuning`, which are plain global classes in [infinite-neck.css](../../../../infinite-neck.css#L263) (green up, blue down, orange X, gray when disabled), so no new button styles.  Built-in rows get no buttons (Q7).

### 4.1 Stylesheets table, user rows (proposed)

```
[x] sunset        ...role cells...    [↑][↓][X]
[ ] Fingerings-user ...role cells...  [↑][↓][X]
Legend ▶
```

The Legend (the Display Options Matrix idiom, a toggle button) explains: the checkbox, the link, the arrows, "later rows win", the Result row, the check marks on built-ins, and the cell look for selected/edited/removed.

### 4.2 Customize panel (proposed)

```
Stylesheet name: [ Fingerings-user2     ]  <hint line: what Save will do>
[New] [Save Stylesheet] [Copy] [Rename] [From Section]
 Role | caption | now | [ cell ] [color] [hatch] [clear]
```

| Button | Does |
|---|---|
| **New** | Clears the editor to blank cells and an empty name.  Nothing is created until Save.  (This is your "Create": a blank sheet whose cells are all blank, without a separate empty-sheet step.) |
| **Save Stylesheet** | Writes the cells to the sheet named in the field: **creates** it if the name is free, **updates** it if it exists.  An update buries the previous version in the Graveyard first and says so (your Q3).  Blocked, with a message, if there is nothing to save. |
| **Copy** | Duplicates the **selected** sheet under the next free name (`Foo` gives `Foo2`; `Fingerings-user` gives `Fingerings-user2`; a built-in gives `<Name>-user`, the first free one), selects it, and fills the name field. |
| **Rename** | Renames the selected **user** sheet to the name in the field, if free.  Keeps its position and ticked state.  Sections that store its old name are repointed (see section 5). |
| **From Section** | The old `FirstInstrument:NamedNotes => Stylesheet`, now **loading** the editor cells from the first instrument's Named Notes (marked as edited) instead of saving directly.  You then press Save.  This leaves one Save path, so there is one set of rules to learn (Q5). |

Re-clicking a link reverts the editor to that sheet's saved cells, so there is no Revert button.  The count of added buttons is two (New, Copy) plus Rename if you want it.  `Record Stylesheet` becomes `Save Stylesheet` (your Q10).

### 4.3 Editor cells

Each role row's third cell (`#colorDestRole<Role>`) shows the selected sheet's own color and hatch.  Roles the sheet does not define are blank, your "have the others be missing".  Cell states:

| State | Look | Meaning |
|---|---|---|
| blank | empty | Not in the selected sheet. |
| saved | color and hatch | In the sheet as saved. |
| edited | same, with a dashed outline | Changed in this editor, not yet saved. |
| removed | blank, with an `x` mark | Will be removed from the sheet on Save. |
| inherited (built-in source only) | gray | Shown from the built-in you started from; Save does not write it unless you edit it (Q3). |

Controls per row: the existing `color` and `hatch` pickers, plus a new **clear** that removes color and hatch together (your request).  In either picker, `none` clears *that part*; when both parts are empty the role is **removed** from the sheet on Save and the cell goes blank (your `none` answer).

Hint line (the Preview idiom): one line under the name, built by a pure function from the same data Save uses, so what it says is what Save does:

- `New sheet "foo" with 3 colors.`
- `Updates "foo": 2 changed, 1 removed.  The previous version is kept in the Graveyard.`
- `"Fingerings-user2" starts from Fingerings: Save writes only the 2 cells you changed.`
- `Nothing to save.`
- `Name changed to "a-b" (letters, digits and - only).`

### 4.4 Code shape (no vast refactor)

- **New pure module** [templates/palette/stylesheetPlan.js](../../../../templates/palette/stylesheetPlan.js): no DOM, no jQuery.  Functions: `cleanSheetName(raw)`, `nextFreeName(song, base)`, `sanitizeColorDicts(colorDicts)`, `resetBuiltInFlags(colorDicts)`, `moveUserSheet(colorDicts, key, ±1)`, `findSheetUsage(song, key)`, `planSave(song, {name, selectedKey, cells})`, `applySavePlan(song, plan)`, `planCopy`, `planRename`, `loadCells(song, key)`, `describePlan(plan)`.
- `colorFunctions.js` keeps its exports (`recordUserColorsBoth`, `chuseStylesheet`, `deleteUserStylesheet`, `buildColorDicts`, `buildUserColors`, ...) so [infinite-neck.js](../../../../infinite-neck.js), [palette.builder.js](../../../../templates/palette/palette.builder.js) and [graveyard.js](../../../../graveyard.js) keep working.  They become thin: read the DOM, call the pure function, write the DOM.
- The Song file shape is unchanged (`colorDicts` entries, `checked`, `currentColorDict`, `activeStylesheets`).  Phase 6 may add `colorLooks` (optional).
- All new logic is covered in Jest the non-browser way (plain objects, no JSDOM).

---

## 5. What gets stored in a Section

Not solved in Iteration 2 and not a blocker.  This is the analysis, so Phases 3 to 5 do not paint us into a corner, and so you can choose.

### 5.1 The problem, restated

Three different things are all called "the stylesheet":

| Thing | Where | What it is |
|---|---|---|
| **Selected sheet** | the name field and the link just clicked | One sheet, for editing. |
| **Active stack** | `.ActiveStylesheets`, the Result row, `song.activeStylesheets` | The built-in level plus the ticked user sheets in order: the long name. |
| **`currentColorDict`** | Section DisplayOptions, Store Cell | Today: the last selected name, with no relation to the stack. |

A Section should store the **stack**, because the stack is what you see.  The selected sheet is an editing detail.

### 5.2 Options

| | A. Recipe | B. Named Looks | C. Both (recommended) |
|---|---|---|---|
| Section stores | The stack as a string: `Fingerings+CycleOfColors-user2+Fingerings-user` | A Look name: `Sunset` | Either: a Look name if one matches, else the recipe |
| New UI | None | Name field + Save Look, list, delete | A small Looks row, optional |
| Rename or delete of a member sheet | Breaks the string | Edit the Look once | Look edit, or string repoint |
| Dangling shown | Per member | Per Look | Both |
| Honest about what Result shows | Yes, exactly | Yes, through the Look | Yes |

**Recipe grammar (needed for A and C).**  `<built-in level>[+<user sheet>]...`.  The built-in level is the highest ticked built-in, which implies the ones below it (so the long name collapses to `Fingerings+CycleOfColors-user2+Fingerings-user`); `Default` means all built-ins; the user sheets follow in stack order, ticked only.  Names cannot contain `+` because name cleaning turns every non-alphanumeric into `-`, so the string parses without ambiguity.  Applying a recipe sets the checked flags **absolutely**, so the result no longer depends on which Sections you visited first.  That removes the accumulation (B2) as a by-product, and it also answers your "clicking the link should not carry history" without special rules.

**One choke point.**  `buildColorDicts()` already computes the Active string and stores it in `song.activeStylesheets` after every change (link, checkbox, move, delete, record).  If `getSong().currentColorDict` were assigned from the same place, the control read by Store Cell would always equal what Result shows.  This is cheap and needs no new UI; it is the smallest step that fixes the confusion you reported.

**Looks (B).**  A Look is `song.colorLooks[name] = recipe` (a Song-level, saved, optional object).  The Section stores the **Look name** when one is chosen, so editing a member sheet changes every Section that uses the Look, as a Theme does.  UX: `Look: [select] [Save as Look...] [X]` below the Stylesheets table, reusing the name field and the Legend and Preview idioms.  "Two combinations should be two User-facing styles" is exactly this.

### 5.3 What Phases 3 to 5 must do so this stays open

- Names stay unique across sheets and (later) Looks.  Phase 3's `cleanSheetName` and `sanitizeColorDicts` take a reserved-name set.
- `currentColorDict` stays an opaque string everywhere it is read or written (the DisplayOptions Matrix, Store Cell, `chuseStylesheet`).
- Rename and Delete go through `findSheetUsage(song, key)`, which today scans Sections' `currentColorDict` and in Phase 6 also Looks and recipes.
- No new field is written to the Song file until Phase 6.

---

## 6. Implementation plan

Numbering: Iteration 1 was the report; this is Iteration 2.  The Iteration 1 report's "Iterations 2 to 5" become Iterations 3 to 7 below (the Looks decision adds Phase 6).

Every phase: add Jest first, then code, then run the full suite (`export INFINITE_NECK_VERBOSE=-1; node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`), then the UA checklist for the phase.  Per the repo rules, edits to top-level files (`colorFunctions.js`, `infinite-neck.js`, `graveyard.js`) need your go-ahead; they are listed per phase.

### Phase 3: Safe fixes, no new UI

| Item | Change | Top-level files |
|---|---|---|
| S1 | **Reset built-in `checked` flags on Song open** to the known state (Q14).  A pure `resetBuiltInFlags(colorDicts)` in `stylesheetPlan.js`, called from `installDefaultColorDicts`. | [infinite-neck.js](../../../../infinite-neck.js#L2350) (one call) |
| S2 | **Sanitize names on open and append**: `sanitizeColorDicts` cleans every user sheet name; collisions (two names that clean to the same text, or a user sheet named like a built-in) get a numeric suffix; each rename is written to the User Log.  Closes B11. | [infinite-neck.js](../../../../infinite-neck.js#L2063) (open and append call sites) |
| S3 | **Safe DOM**: build rows with jQuery `.text()` and `.attr()` instead of string concatenation; ids from a slug plus index, with the name in a data attribute; checkbox events bound to the element, not to a built selector.  Fix the `Result` and strip row ids (your point).  Closes B11 for the markup side. | [colorFunctions.js](../../../../colorFunctions.js) |
| S4 | **Checkbox handler does what a link does for repaint**: calls `refreshStylesheets()` (apply, role buttons, table, repaint) and `displayOptionsChanged()`.  Closes B4. | [colorFunctions.js](../../../../colorFunctions.js#L396) |
| S5 | **Delete clears dangling `currentColorDict`** on the current Song state; message names the sheet.  Closes the Song-level half of B5. | [colorFunctions.js](../../../../colorFunctions.js#L505) |
| S6 | **Name cleaning**: trim before cleaning; collapse repeated `-`; trim leading and trailing `-`; case-insensitive uniqueness against built-ins.  Closes B12 and V12. | `stylesheetPlan.js` |
| S7 | Remove the unused `resetUserColorsToDefault()` and the dead `registerColorSchemeCBEventSelectorsFAILED`. | [userColors.js](../../../../userColors.js), [colorFunctions.js](../../../../colorFunctions.js) |

Jest: `cleanSheetName` table (empty, spaces, punctuation, built-in names, long, unicode); `sanitizeColorDicts` (collisions, reserved names, `+`, `<script>` text, built-in-flag preservation, idempotent); `resetBuiltInFlags` (every flag set, user flags untouched); a mock-Song open/open sequence proving no carry-over (the P3 sequence as a test).

UA: checklist A repeated, then B1, B2, B5 (delete) re-run.

### Phase 4: The Stylesheets table (move buttons, checkbox-only on/off, link selects)

| Item | Change |
|---|---|
| T1 | User rows get `[↑][↓][X]` using the Tunings classes.  Up disabled on the first user row, Down on the last (as in Tunings). |
| T2 | `moveUserSheet(colorDicts, key, ±1)`: pure; moves within the user block only; built-ins stay first and fixed.  After a move: apply, repaint, rebuild table, `displayOptionsChanged()`. |
| T3 | Link click no longer reorders (`moveStylesheetToEnd` is reduced to a small `setBuiltInLevel(colorDicts, key)` for built-in links, per Q1).  A user-sheet link ticks that sheet's checkbox and selects it. |
| T4 | The delete glyph becomes the `btnRemoveTuning`-style X (same handler `deleteUserStylesheet`). |
| T5 | The Legend toggle under the table (the Matrix idiom): explains checkbox, link, arrows, order, Result, marks, cell states. |
| T6 | Rename "Result" row caption and give it a stable id (done with S3 if you prefer). |

Files: [colorFunctions.js](../../../../colorFunctions.js), [palette.builder.js](../../../../templates/palette/palette.builder.js), [palette.css](../../../../templates/palette/palette.css) (the button column), [palette.html](../../../../templates/palette/palette.html) (Legend button and container), `stylesheetPlan.js`.

Jest: `moveUserSheet` (ends, first and last disabled, single user sheet, built-ins never move, order of `Object.keys` after), link-click selection plan (no reorder, checkbox ticked), `setBuiltInLevel`.

UA: B7 (now: no reorder), table buttons, checklist A.

### Phase 5: Select-to-edit, cells and the CRUD buttons

| Item | Change |
|---|---|
| E1 | Selection model: one `selectedKey`; link click loads that sheet's cells into the editor and fills the name (Q2 for built-ins). |
| E2 | Editor state in a plain object, re-rendered from state, so rebuilds no longer wipe picks (B8) and the selected paint role survives. |
| E3 | Cell states and the `clear` control; `none` semantics (section 4.3). |
| E4 | The hidden base (`systemSchemeName`) is deleted (B1 retired), including the `-user` auto-rename and the starting copy: the explicit paths are New, Copy and "start from a built-in". |
| E5 | Buttons **New**, **Save Stylesheet**, **Copy**, **Rename**, **From Section**; hint line; nothing-to-save guard (B7). |
| E6 | Update buries the previous version (reuse the existing STYLESHEET Graveyard type; the record's caption notes "replaced by Save") and the hint says so (your Q3). |
| E7 | Name field cleans on Save and previews the cleaned name in the hint (Q15). |
| E8 | AutoColor note on From Section (B9, Q5). |

Files: [colorFunctions.js](../../../../colorFunctions.js), [palette.builder.js](../../../../templates/palette/palette.builder.js), [palette.html](../../../../templates/palette/palette.html), [palette.css](../../../../templates/palette/palette.css), `stylesheetPlan.js`; [graveyard.js](../../../../graveyard.js) only if the caption note needs a hook (probably not).

Jest: `planSave` (create, update, sparse from built-in, remove via both-empty, blocked), `describePlan` text for every case, `nextFreeName` (`Foo`, `Foo2`, `Fingerings-user`, many collisions, built-in names), `planCopy`, `planRename` (free, taken, built-in, Section repoint), `loadCells` (built-in source marks inherited), a full CRUD sequence on a mock Song.

UA: new checklist C (written at the end of Phase 4): create, select, edit, remove a role, copy, rename, delete, restore from the Graveyard, hint text matches the result.

### Phase 6: What a Section stores (after your choice in Q10)

| Item | Change |
|---|---|
| R1 | One choke point: `buildColorDicts()` assigns `getSong().currentColorDict` from the same recipe it already stores in `activeStylesheets`, so Store Cell, the Active line and Result agree. |
| R2 | `applyRecipe(song, recipe)` sets the checked flags absolutely; Section apply uses it instead of `chuseStylesheet`.  Ends the accumulation (B2). |
| R3 | `.ActiveStylesheets` shows the canonical shortened recipe. |
| R4 | A missing sheet in a recipe or `currentColorDict` shows struck through in the Matrix Color column with hover text (your Q9: yes); [displayOptionsMatrixView.js](../../../../templates/display-options/displayOptionsMatrixView.js) and its Jest. |
| R5 | If Looks are chosen: `song.colorLooks`, a Looks row, `Save as Look`, delete, and Rename and Delete repoint through `findSheetUsage`. |

Top-level files: [infinite-neck.js](../../../../infinite-neck.js#L3480) (Section apply and `controlsToDisplayOptions`), [colorFunctions.js](../../../../colorFunctions.js), [bin/song-file-schema.js](../../../../bin/song-file-schema.js) only if `colorLooks` is added.

### Phase 7: Docs and close

Maintain [help.html](../../../../help.html) `#paletteUsage` as each phase lands (not `#palette`, not `#paletteOverview`, per your Q8 answer): Stylesheets table, Customize, Record rules (rewritten as Save rules), Sections and Stylesheets, and the Legend wording.  Closing report and the acceptance checklist.

---

## 7. Final questions

Each has a recommendation; reply with the numbers to override.

**Table and links**

1. **What does a built-in link click do to the user checkboxes?**  Today it unticks every user sheet (it also ticks the built-ins up to the clicked one).  *Recommend: set the built-in level only; leave user checkboxes alone, since only checkboxes turn user sheets on or off.*  Consequence: "Default" no longer clears your overlays; you untick them.  Do you want a convenience for "all user sheets off"?  (*Recommend no; the checkboxes are the one way.*)
2. **Clicking a built-in when `<Name>-user` already exists:** put the **next free** name (`Fingerings-user2`) in the name field, or the existing `Fingerings-user`?  *Recommend next free; to edit the existing one, click its own link.*
3. **Starting from a built-in: what does Save write?**  *Recommend only the cells you changed (a small overlay; unchanged cells show gray "inherited" and are not written).*  The alternative is every shown cell, a full copy that no longer follows built-in changes.  **Copy** of a built-in is the explicit full-copy path.  OK?
7. **Row buttons on built-in rows:** none (recommended), or disabled ones for alignment with the Tunings look?  And do the user sheets sit **only** below the built-ins, with Up disabled on the first user row?  *Recommend yes.*

**Editor buttons**

4. **Button set:** New, Save Stylesheet, Copy, Rename, From Section.  Trim or add?  Is Rename wanted?  (*Recommend yes; without it, Copy then Delete leaves Sections pointing at the old name, which Phase 6 repoints only through Rename.*)
5. **`FirstInstrument:NamedNotes => Stylesheet` as "load into editor, then Save"** (recommended), under the label `From Section`.  With AutoColor on it currently records the AutoColor result, which can make the sheet change nothing.  Keep that and show a one-line note, or read the painted classes instead?  *Recommend the note.*
6. **Delete:** no modal.  The hint names the Sections that use the sheet and says it went to the Graveyard.  OK, or do you want a confirm only when Sections use it?
15. **Name cleaning:** on Save, with the cleaned name shown in the hint (recommended), or live as you type?

**Song open and Sections**

14. **Known state for built-in flags on Song open:** all built-ins ticked (today's fresh start, the standard look), then each user sheet's saved flag.  *Recommend this.*  The alternative is All-Clear only.
12. **Existing Song files with names that do not survive cleaning:** rename with a numeric suffix and log each rename in the User Log.  Sections that stored the old name are repointed.  OK?
9. **Interim:** until Phase 6, Section navigation still **accumulates** user sheets (no reorder, but still ticked on apply).  Acceptable for Phases 3 to 5, or pull the recipe work (R1 and R2) forward?  *Recommend pulling R1 and R2 forward right after Phase 4: they are small and they end the confusion you saw in testing.*

**Stored value**

10. **Recipe, Looks, or both (section 5.2)?**  *Recommend C: a canonical recipe first (R1 to R4), with Looks added once you have used it.*  If you want Looks, three decisions: (a) are they per Song (`song.colorLooks`, recommended); (b) does a Section store the Look **name** (live-linked, recommended) or the recipe (a snapshot); (c) where they live in the UI (a row under the Stylesheets table, recommended).
11. **Reuse the persisted `song.activeStylesheets` as the recipe field?**  It already exists, is in the schema, and nothing reads it.  *Recommend yes; no schema change.*
13. **Grammar of the recipe:** `Fingerings+CycleOfColors-user2+Fingerings-user` (the highest ticked built-in, then the ticked user sheets in order).  `Default` means all built-ins.  Acceptable as the visible and stored form?

**Process**

16. **Phase order:** 3 (safe fixes), 4 (table), then R1 and R2 pulled forward (Q9), then 5 (editor), then the rest of 6.  Or keep 3, 4, 5, 6 as written?
17. **Approval of top-level edits:** [colorFunctions.js](../../../../colorFunctions.js) (every phase) and [infinite-neck.js](../../../../infinite-neck.js) (Phase 3: two call sites; Phase 6: Section apply) per the lists above.  Please confirm per phase or all at once.
