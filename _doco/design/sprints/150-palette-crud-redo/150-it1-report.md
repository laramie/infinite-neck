# sprint-150 Iteration 1 Report: Palette Stylesheets CRUD

Request: [150-design.md](150-design.md).  Sprint: [sprint-150.md](sprint-150.md).

**No code was changed in this Iteration.**  This is findings, proposals and questions.  Where a finding was only read from the code and not run, it says so.

Contents:

1. [Findings from the help.html rewrite](#1-findings-from-the-helphtml-rewrite)
2. [Catalog of holes](#2-catalog-of-holes)
3. [Addressing the Goal](#3-addressing-the-goal)
4. [Proposed Iterations](#4-proposed-iterations)
5. [Questions for you](#5-questions-for-you)
6. [Not in scope, but noticed](#6-not-in-scope-but-noticed)

---

## 1. Findings from the help.html rewrite

### 1.1 What was done

A new user-facing section, `#paletteUsage`, now exists in [help.html](../../../../help.html), with a TOC sub-list.  It covers how the Palette works, Note types, Fingering, the paint modes (Clear, KEEP, Find Color, Color), the colors, the Stylesheets table, Customize, task recipes, the Record rules, Sections and Stylesheets, and keyboard shortcuts.  The older Palette text (`<a name="palette">`) is still in place.

To write it truthfully, the real [colorFunctions.js](../../../../colorFunctions.js) was run in Node with a stubbed jQuery and driven through Record, choose, check/uncheck and delete.  The probes were throwaway and are deleted.  Everything marked **verified** below came from those runs.

### 1.2 How Stylesheets work today (the mental model the UI has to explain)

| Concept | Today |
|---|---|
| Storage | `song.colorDicts`: an ordered object of `{ readOnly, computed, checked, dict }`. |
| Built-in sheets | All-Clear, CycleOfColors, Roles, Fingerings, Highlights, Default.  Rebuilt by `installDefaultColorDicts()` ([infinite-neck.js](../../../../infinite-neck.js#L2350)); never saved in the Song file. |
| User sheets | Everything else.  Saved in the Song file, with their `checked` flag. |
| Effective colors | `gUserColorDict.dict`, the "Result" row.  Built by merging checked sheets in list order; later wins. |
| Choosing | A sheet name link calls `chuseStylesheet()` ([colorFunctions.js](../../../../colorFunctions.js#L460)), which reorders the list (`moveStylesheetToEnd`, [L410](../../../../colorFunctions.js#L410)) and sets `song.currentColorDict`. |
| Per-Section | `currentColorDict` is a Display Option in the Color group.  Navigating to a Section calls `chuseStylesheet` with the stored name ([infinite-neck.js](../../../../infinite-neck.js#L3480)). |
| Recording | `recordUserColorsBoth()` ([L116](../../../../colorFunctions.js#L116)): name + picks (or the first instrument's Named Notes) become a sheet. |
| Deleting | `deleteUserStylesheet()` ([L505](../../../../colorFunctions.js#L505)) buries the sheet in the Graveyard.  `raise()` in [graveyard.js](../../../../graveyard.js#L102) brings it back. |

### 1.3 Verified behavior (the "state-dependent" part)

Record has **three independent inputs the user cannot see**: whether the name exists, whether a hidden base is set, and whether anything was picked.

| # | Situation | Result | Status |
|---|---|---|---|
| V1 | Name empty | Saved as `user`; the name label flashes. | verified |
| V2 | Name is a user sheet that exists | Merged into it with `Object.assign`.  No prompt, no undo.  `{note3}` then `{note5}` leaves 2 keys. | verified |
| V3 | Name is a built-in (`Roles`) | Becomes `Roles-user`, a **full copy** of Roles, then merged.  A second Record merges into `Roles-user`. | verified |
| V4 | New name, no picks | Creates an **empty** sheet (0 keys) that does nothing. | verified |
| V5 | New name after clicking a built-in link | Full copy of that built-in (hidden `systemSchemeName` on the name field). | verified |
| V6 | New name after clicking a built-in link, **then** a user sheet link | Still a full copy of the built-in.  The hidden base is never cleared by the user-sheet click.  (Recording "copyOfUser" gave a 39-key copy of Default and lost the user sheet's color.) | verified |
| V7 | `FirstInstrument:NamedNotes => Stylesheet`, AutoColor off | Records the painted colors. | verified |
| V8 | Same, AutoColor on | Records the AutoColor result, so the sheet changes nothing. | verified |
| V9 | Click a built-in link | Checks it and everything above; **unchecks everything below, including all user sheets**. | verified |
| V10 | Delete a sheet that is `currentColorDict` | `song.currentColorDict` still names it. | verified |
| V11 | Sections store A, B, A | Both A and B end up checked, so a Section's look depends on which Sections you visited first. | verified |
| V12 | Name cleaning: `"  "` | Becomes `"-"` (the trim test runs after the replace, so it never fires). | verified |

V6 and V11 are the likeliest sources of "hit-or-miss".

### 1.4 Claims in the new help text that this report changes

Two statements in the new help section describe today's behavior accurately but would become wrong after fixes below.  They are tagged here so the final iteration updates them:

- The starting-copy rule (V5/V6) is documented as current behavior.
- The paragraph saying the role buttons show "the color the current Stylesheet gives that role" is true after choose/Record/delete, but **not after a checkbox toggle** (see B4).  Either the help or the code must change; the code fix is cheap.

---

## 2. Catalog of holes

Priority: **P1** wrong or unsafe, **P2** confusing or lossy, **P3** polish.  Size is code footprint only: **S** a few lines, **M** one function plus tests, **L** new UI plus module.

### 2.1 Defects

| ID | Pri | Size | Hole | Evidence |
|---|---|---|---|---|
| B1 | P1 | S | **Stale hidden base.**  `.attr('systemSchemeName', undefined)` is a jQuery no-op, so choosing a user sheet never clears the base.  Next new-name Record silently becomes a copy of a built-in.  Also, `.attr(..., null)` in Record is the only clear. | V6; [L460](../../../../colorFunctions.js#L460) `chuseStylesheet` |
| B2 | P1 | M | **Sections accumulate sheets.**  The Section-apply path uses the same "keep the rest" rule as a manual click, so rendering depends on navigation history.  It also reorders `song.colorDicts` and rewrites `checked` flags on every navigation, and those are saved in the file. | V11; [moveStylesheetToEnd](../../../../colorFunctions.js#L410); [infinite-neck.js](../../../../infinite-neck.js#L3480) |
| B3 | P1 | M | **Suspected: the live dict is never rebuilt from a baseline.**  `applyStylesheetsTo_gUserColorDict()` only `Object.assign`s checked sheets onto the existing live dict, and the built-in sheets are module singletons whose `checked` flags survive opening another Song.  So after choosing `Roles` (which unchecks Default), unchecking a user sheet may leave its colors for any key `Roles` does not define, and Song B can inherit Song A's colors.  This would explain "state-dependent" better than B1. | **Read from code, not yet probed.**  [colorFunctions.js](../../../../colorFunctions.js) `applyStylesheetsTo_gUserColorDict`; [infinite-neck.js](../../../../infinite-neck.js#L2350) `installDefaultColorDicts` |
| B4 | P2 | S | **Checkbox toggle does less than a link click.**  The change handler ([L396](../../../../colorFunctions.js#L396)) repaints and rebuilds the table but not the role buttons or the Customize editor, so the paint buttons show stale colors.  It also does not touch `currentColorDict` or the list order. | read from code |
| B5 | P1 | M | **Dangling references.**  Delete leaves `song.currentColorDict` and any Section's stored `currentColorDict` naming a sheet that is gone.  `chuseStylesheet` then does nothing, silently.  Delete has no confirm and does not say which Sections use the sheet. | V10; [palette.builder.js](../../../../templates/palette.builder.js#L123) |
| B6 | P2 | S | **Silent merge on update, silent rename-to-`-user`.**  Both are right ideas with no feedback beyond a label flash. | V2, V3 |
| B7 | P2 | S | **Nothing-picked Record** creates an empty sheet, or a full copy of the hidden base, with no warning. | V4, V6 |
| B8 | P2 | S | **Rebuilds eat state.**  `buildUserColors()` ([L555](../../../../colorFunctions.js#L555)) empties the role buttons and re-checks the first radio, so the selected paint role jumps to the first role after any choose/Record/delete.  It also rebuilds the Customize table, wiping un-recorded picks. | read from code |
| B9 | P3 | S | **AutoColor on makes `FirstInstrument:NamedNotes => Stylesheet` a no-op** and says nothing. | V8 |
| B10 | P2 | S | **Suspected: hatch-only pick drops the color.**  `genericPickerClicked` ([L717](../../../../colorFunctions.js#L717)) does `removeClass()` then adds only the picked class, and Record reads the cell's class list.  A hatch picked first records a class with no fill. | read from code; **needs a browser check** |
| B11 | P1 | S | **Unsanitized sheet names (security).**  A sheet name that comes from an opened or appended Song file is concatenated into HTML (`data-dictkey="..."`, `.html(dictkey)`, `.html("Active Stylesheets: "+...)`) and into jQuery selectors (`'#cbWhichColorDict'+dictkey`).  A crafted name can inject markup, and a name with a space or `.` breaks the checkbox handler.  Cleaning happens only in Record, not on open/append. | [colorFunctions.js](../../../../colorFunctions.js) `colorDictDisplayRow`, `buildColorDicts` |
| B12 | P3 | S | **Name cleaning gaps.**  No trim before cleaning (V12); `roles` and `Roles` are different sheets; leading/trailing/repeated `-`. | V12 |
| B13 | P3 | S | **`chuseStylesheet` has UI side effects on Section navigation.**  It overwrites the Stylesheet name field and flashes the label every time a Section applies, even if the user is typing a name. | read from code |
| B14 | P3 | S | **Append stylesheets overwrites same-named sheets without saying so.** | [infinite-neck.js](../../../../infinite-neck.js#L2063) |

### 2.2 Missing capabilities (the CRUD matrix)

| Operation | Today | Gap |
|---|---|---|
| **C**reate | Name + picks, or from the first instrument. | Creation mode (empty / copy / overlay) is implicit and depends on hidden state. |
| **R**ead | Stylesheets table (rows = sheets, columns = roles), Result row, Active Stylesheets line. | No "which Sections use this?", no legend, no hover explanation of order, `checked` semantics or the arrows. |
| **U**pdate | Same name merges new picks. | Picks start empty, so you cannot see or edit the sheet's own values; no remove-a-role; no confirm; no undo. |
| **D**elete | The ⌫ link. | No confirm, no usage warning, dangling references (B5).  Restore exists only through the Graveyard, and only as `NameR1` when the name is taken. |
| Copy / Save As | None, except Graveyard-raise twice. | Missing. |
| Rename | None. | Missing. |
| Undo | None (Graveyard only on Delete). | An overwriting merge leaves no copy. |

---

## 3. Addressing the Goal

### 3.1 Idioms already in the app that Stylesheets should borrow

| Idiom | Where it lives | Use for Stylesheets |
|---|---|---|
| **Plan, then do.**  A pure module computes what a click would do; the builder only renders and applies it. | [displayOptionsPlan.js](../../../../templates/display-options/displayOptionsPlan.js) | `stylesheetPlan.js`: `planRecord(song, {name, base, picks, mode})` returns `{action: create / update / copyBuiltin / nothing, name, keyCount, adds, removes, notes[]}`. |
| **Live hint under the controls.**  The Matrix shows what Apply would do before you press. | Matrix Auto-apply hint; Theme Matrix **Preview** | One line under the name field: `Will CREATE "foo" with 3 colors.` / `Will UPDATE "foo": 2 changed, 1 removed.` / `Will CREATE "Roles-user" as a copy of Roles + 3 colors.` / `Nothing picked.` |
| **Gray / italic / struck-through states with hover text.** | Theme Matrix Preview | A dangling `currentColorDict` shown struck through with "sheet not found"; a Section's sheet shown gray when inherited. |
| **Legend toggle button.** | `Legend ▶` in the Display Options Matrix ([display-options.html](../../../../templates/display-options/display-options.html#L45)) | `Legend ▶` beside the Stylesheets table, explaining `✓`, `⇒`, `⇏`, the checkbox, `⌫`, "later rows win", and the Result row. |
| **Undo through an existing store.** | Matrix Undo; Graveyard | Reuse the Graveyard: bury the previous version before any overwrite, so "undo" is Graveyard-raise, which already works and already persists in the file. |
| **Small glyph actions in the row.** | the existing `⌫` | Add `⧉` (copy) and, if wanted, `✎` (rename) beside it.  No new toolbar buttons. |
| **Usage lists.** | Themes page "Songs that use" | A "Used by Sections 1, 3" suffix or hover on each user sheet. |

### 3.2 Proposed UI, with minimal additions

Current Customize panel:

```
Stylesheet name: [ sheet-name ]  [Record Stylesheet]  [FirstInstrument:NamedNotes => Stylesheet]
 Role | caption | current | [pick] color hatch
```

Proposed:

```
Stylesheet name: [ sheet-name ]  [Save Stylesheet]  [FirstInstrument:NamedNotes => Stylesheet]
 -> Will UPDATE "sunset": 2 changed, 1 removed.  (hint line, live)
 based on: Roles  [x]           (only when a base is set; [x] clears it)
 Role | caption | current | [pick] color hatch | none = remove from this sheet (when updating)
```

Stylesheets table, user rows:

```
[x] sunset   ... colors ...   used by §1,§3   ⧉ ⌫      (hover explains each)
Legend ▶   (legend toggles beneath the table)
```

New controls: the live hint line, the visible base read-out with its clear, the `⧉` glyph, optionally `✎`, and one `Legend` button.  Nothing else is added, and no existing button changes meaning except `Record` being renamed `Save` (optional; see Q10).

### 3.3 CRUD, after the proposal

| Operation | After |
|---|---|
| Create | Explicit by hint: empty (blocked or confirmed), overlay (sparse, the default), copy-of-base (visible base). |
| Read | Table + Legend + usage + dangling markers. |
| Update | Hint says what changes; previous version is buried first (undo = Graveyard); `none` removes a role; picks survive rebuilds until Save or an explicit clear. |
| Delete | Confirm, naming the Sections that use it; clears or repoints `currentColorDict`; buried (as today). |
| Copy | `⧉` copies the clicked sheet to the name in the name field (must be new). |
| Rename | Copy, then Delete, in one step, repointing Sections that referenced it (if Q4 says yes). |

### 3.4 Keeping the code maintainable (no vast refactors)

- **One new pure module**, `templates/stylesheetPlan.js`: no DOM, no jQuery, like [themeMatrixPreview.js](../../../../templates/themeMatrixPreview.js) and `displayOptionsPlan.js`.  It holds `cleanSheetName`, `planRecord`, `applyRecordPlan(song, plan)`, `copySheet`, `renameSheet`, `findSheetUsage(song, name)`, `computeEffectiveDict(song, baseline)`.  This is what Jest tests, without JSDom, following our no-browser rule.
- `colorFunctions.js` keeps its exports and call sites.  `recordUserColorsBoth`, `chuseStylesheet`, `deleteUserStylesheet` become thin: read the DOM, call the pure function, write the DOM.  The existing function names stay so [infinite-neck.js](../../../../infinite-neck.js), [palette.builder.js](../../../../templates/palette.builder.js) and the Graveyard are untouched.
- No change to the saved Song format.  `colorDicts`, `checked` and `currentColorDict` keep their shapes.  (B2's fix changes *when* `checked` is written, not its shape.)
- Edits stay in [colorFunctions.js](../../../../colorFunctions.js), [templates/palette.html](../../../../templates/palette.html), [templates/palette.builder.js](../../../../templates/palette.builder.js), a small CSS addition, plus [graveyard.js](../../../../graveyard.js) only if the `NameR1` rule changes.
- Top-level `./` files such as `Song.js` and `infinite-neck.js` need no change in the first three iterations, except one call site in `infinite-neck.js` if B2 passes an `exclusive` option from the Section-apply path.  That is a main-code change, so it needs your explicit go-ahead.

---

## 4. Proposed Iterations

Each iteration ends with the full Jest run and your browser acceptance pass.

| It | Theme | Contents | Needs your decision |
|---|---|---|---|
| 2 | **Probe, then safe fixes** | First a throwaway probe to confirm or kill B3, B10 and B4.  Then: B1 (clear the base), B4, B8 (keep the selected role; keep picks until Save), B11 (escape names; clean on open/append), B12, B13, and the pure `cleanSheetName`.  Jest for each. | Q6, Q7 |
| 3 | **Plan and hint** | `stylesheetPlan.js`, the live hint line, visible base with clear, nothing-picked guard (B7), bury-before-update (B6), `none` removes a role, B9 message. | Q1, Q2, Q3, Q5 |
| 4 | **Row actions and usage** | `⧉` Copy, optional `✎` Rename, "Used by" markers, delete confirm with usage (B5), repoint/clear `currentColorDict`, Legend button and tooltips, exclusive Section-apply (B2). | Q1, Q4, Q9 |
| 5 | **Docs and cleanup** | Update `#paletteUsage` for the new behavior, retire the old Palette text, acceptance checklist, a closing report. | Q8, Q11 |

If B3 turns out to be real, it moves to the front of Iteration 2 and may change what the "baseline" in `computeEffectiveDict` means (see Q6).

---

## 5. Questions for you

Each has a recommendation; reply with the numbers you want to override.

1. **Exclusive or stacking?**  When a Section applies its `currentColorDict`, or you click a user sheet link, should user sheets be **exclusive** (only that user sheet on; checkboxes remain the deliberate way to stack), or keep today's accumulate rule?  *Recommend exclusive for the Section-apply path at least, since stacking makes a Section's look depend on history.  The link click could stay as is.*  This touches one call site in [infinite-neck.js](../../../../infinite-neck.js#L3480).
2. **What does a new name start as?**  Today it is empty (sparse overlay) unless a hidden base is set.  *Recommend: sparse overlay by default; a base is set only when you click a built-in, and it is shown on screen with a clear.*  An alternative is to drop the base idea entirely and rely on `⧉` Copy.
3. **Overwriting an existing user sheet:** silent merge today.  *Recommend no confirm, but bury the previous version in the Graveyard and say so in the hint.*  Or add a confirm.
4. **Copy and Rename as row glyphs (`⧉`, `✎`)?**  *Recommend Copy yes, Rename yes only if you want Sections repointed automatically; otherwise it is Copy then Delete.*
5. **`none` in the picker:** today it records nothing.  *Recommend: when updating an existing user sheet, `none` removes that role from the sheet.*  Do you want a different word, since `noteTransparent` also exists as a color?
6. **Baseline for the live dict (B3).**  If B3 is confirmed, the fix is to rebuild the live dict from Default each time, then layer checked sheets.  Is "Default unchecked" ever meant to leave previous colors in place, or may we always start from Default (and All-Clear as a sheet that overrides it)?  Also, should built-in `checked` flags reset to a known state when a Song opens?  *Recommend yes to both.*
7. **B11 (unsanitized names):** fix now, in Iteration 2, including cleaning names on open/append.  Names in existing Song files that do not survive cleaning would be renamed.  *Recommend yes; we do not support legacy, and a security fix should not wait.*
8. **Old help text:** retire it in Iteration 5, replacing the old `#palette` block with `#paletteUsage`?
9. **DisplayOptions Matrix:** should a Section's `currentColorDict` that names a missing sheet show struck through in the Color column?  That edits the Matrix view code.  *Recommend yes, small.*
10. **Rename `Record Stylesheet` to `Save Stylesheet`?**  It matches the hint wording, but changes a name that appears in help and probably in your muscle memory.  *Recommend keep `Record`.*
11. **Browser pass:** should I start Iteration 2 with the probe plus a short browser checklist for B3, B4 and B10, and stop for your results before writing fixes?  *Recommend yes.*
12. **Pure module name and place:** `templates/stylesheetPlan.js`, next to `themeMatrixPreview.js`.  OK?

---

## 6. Not in scope, but noticed

- The old Palette text still says "Last Color" and advises deleting Sections before an append.  Both are stale.  Retired by Q8.
- The older text near help.html line 3287 claims Tutorials use automation.  Still inaccurate; deliberately left alone as before.
- There are no keyboard shortcuts for CLEAR, KEEP or Find Color (the rest of the paint modes have them).  A feature request, not a defect.
- `colorDictDisplayRow` raises a browser `alert` if a sheet has no `dict`.  Malformed files only.
- [149-it1-implementation-report.md](../149-theme-matrix-update/149-it1-implementation-report.md) still describes `default*`; deferred earlier by you.
