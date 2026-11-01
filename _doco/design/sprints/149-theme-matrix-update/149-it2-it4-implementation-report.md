# sprint-149 Iterations 2-4 Implementation Report

Requests: [149-design.md](149-design.md).  Sprint: [sprint-149.md](sprint-149.md).  Earlier report: [149-it1-implementation-report.md](149-it1-implementation-report.md), which still describes `default*` (superseded by Iterations 2 and 3 below).

## Part 1: What changed

### Iteration 2: `default*` becomes `default:Current`

An Instrument with no Table Theme shows the Song Theme.  When Theme automation makes the Song Theme change across the Song, the Preview cell now says what it is at that Section instead of a star.

- `default:USER`, then later `default:BigInJapan`.
- `default:(kept)` where automation applies nothing at that Section.
- `default:Nope?` where the `sectionTheme` id is not in the Themes dropdown.
- The tooltip text is unchanged apart from dropping the `default*` wording.
- New exported helper `songThemeVariesLabel(current)`; the `SONG_THEME_VARIES_LABEL` constant was removed.

### Iteration 3: plain `default` becomes `default[PICKER]`

Where the Song Theme is one fixed Theme (automation off, the same Theme everywhere, or none stored), the cell now shows the Themes dropdown value, with literal square brackets: `default[USER]`.

- New exported helper `songThemeLabel(pickerThemeId)`.  With no picker value it falls back to plain `default` (tests only).
- `buildThemeMatrixPreview()` takes a new `pickerThemeId` option; the builder passes `$('#selThemes').val()`.  The Preview module stays free of the page.
- `ThemesBuilder.selThemesChange()` now redraws the Matrix when Preview is on, so `default[PICKER]` follows the dropdown.
- `default:Current` takes precedence over `default[PICKER]` when the Song Theme varies.

### Iteration 4: live read-only label, normal text size, footer as a div

- A line `Allow Theme Automation: true|false` above the Preview checkbox, with a bold brown value, in the style of the View page's read-only lines.  It is a paragraph, not a checkbox, and cannot change the setting.  New ids `themeMatrixAllowThemeAutomationValue`, and CSS in `templates/themes.css` (copied, not shared with `infinite-neck.css`).  It stays live because `renderThemeMatrix()` already runs when `#cbAllowThemeAutomation` changes.
- The footer text is back to normal size (the 60% is gone, and so is the 166% workaround on the checkbox).
- The footer help text was rewritten, because the old sentence (`"default" shows when [Allow Theme Automation] sets a Theme for this Section`) was incomplete.  It now says the `default` column shows the `sectionTheme` that Theme automation stores on a Section (only while Allow Theme Automation is true), the Instrument columns show the Table Theme stored on that Section, and a blank cell stores nothing.
- Follow-up: the footer moved out of the table (`<tfoot><td colspan="3">`), which had forced the table to full width, into a new `#divThemeMatrixFooter` div directly under the table, inside `#divThemeMatrixWrap` (so it still hides with the Matrix).  It has a single `1px solid gray` border, matching the table cells.  `#divThemeMatrixWrap` is now `inline-block` with `min-width: 24em`, and the footer is `width: 0; min-width: 100%`, so it takes the table's width without widening it.  The Preview checkbox's `change` handler moved from `#tblThemeMatrix` to `#divThemeMatrixFooter`.

### Files

| File | Change |
|---|---|
| [templates/themeMatrixPreview.js](../../../../templates/themeMatrixPreview.js) | Labels `default:Current` and `default[PICKER]`; `pickerThemeId` option. |
| [templates/themes.builder.js](../../../../templates/themes.builder.js) | Passes the picker value; redraw on picker change; footer built into `#divThemeMatrixFooter`; read-only label; new help text. |
| [templates/themes.html](../../../../templates/themes.html) | New `#divThemeMatrixFooter` after the table. |
| [templates/themes.css](../../../../templates/themes.css) | Footer border/width rules, read-only label styles; 60%/166% rules removed. |
| [help.html](../../../../help.html) | Preview paragraph describes `default[PICKER]` and `default:Current`. |
| [_tests/jest/theme-matrix-preview.test.js](../../../../_tests/jest/theme-matrix-preview.test.js) | Tests updated and extended (now 16 in this file). |

No change to `Song.js`, `infinite-neck.js` or the resolver in these iterations.

### Testing

- Full suite after each iteration: 79 suites, 1031 tests (it2), 1034 (it3), 1034 (it4 and the footer follow-up), all passing.
- Not tested in a browser (Jest stays non-DOM).  Acceptance checklist:
  1. Open the Theme Matrix: the footer is a bordered box under the table, the table keeps its own width, and closing the Matrix hides both.
  2. The footer text is normal size; the Preview checkbox and label are not cramped.
  3. Check and uncheck Allow Theme Automation on the View page: the label flips between `true` and `false` with the Matrix open.
  4. With Preview on, change the main menu Themes dropdown: `default[...]` cells follow it.
  5. With a Song that stores two different `sectionTheme` values and automation on: cells read `default:Current`, changing at the right Section.
  6. A Song with one Instrument: the footer is not absurdly narrow (`min-width: 24em`).

## Part 2: Holes to fix

These are the issues and inaccuracies found while documenting Themes in `help.html`, and what could be done about each.  "Verified" means I read the code path; "Suspected" means it follows from the code but I have not run it.  None of them were changed in this sprint so far.

Not covered here, as requested: Songs that do not exercise the features, and the Tutorials claiming to automate Themes.

### A. Likely bugs

**A1. The Theme page controls go stale on Section change (Verified).**
Navigation, looping and automation never reload the controls on the Themes page.  They show the last Theme loaded.  `Theme` and `Copy to Section` save whatever the controls hold, so a User who loops or navigates, and then presses either button, can store a Theme that is not the one in effect at the Section they are on.  The help text now warns about this.
- Fix: on `SectionChanged`, if the Theme page is open and the picker is on an Instrument, re-run `selThemeTableChange()`, so the controls follow the Theme in effect.  If the picker is on `default`, reload from the Themes dropdown.  Guard against reloading while the User is mid-edit (for example, only when the controls match the last-loaded Theme).
- Feature, lighter alternative: mark the controls as "stale" when the Section changes after load, and disable or warn on `Theme` and `Copy to Section` until they are reloaded.

**A2. The Song's saved `theme` depends on where you were when you downloaded it (Verified).**
`updateMemoryModelPreFileSave()` stores `$('#selThemes').val()` as the Song's `theme`.  With Theme automation on, that is whatever the last Section applied.  On opening the Song, the Sections before the first stored `sectionTheme` (or all of them, if none stores one) show that incidental Theme.
- Fix: when Allow Theme Automation is on and the Song stores any `sectionTheme`, save `song.theme` from the Song's first applied value (Song-DEFAULTS, else the first stored `sectionTheme`), not the dropdown.  Or add an explicit "Song Theme" that is not changed by automation.

**A3. Automation applies a `sectionTheme` that is not in the dropdown (Suspected).**
`displayOptionsToControls()` does `$('#selThemes').val(sectionTheme).trigger('change')`.  For an unknown id, jQuery leaves the dropdown with no selection, and `selThemesChange()` then calls `themeToControls(undefined)`, which reads `theme[...]` and probably throws.  This can happen when a Song is edited by hand, or when a USER Theme was renamed or removed.  The Preview marks such ids with `?`, but the live app is not protected.
- Fix: in `displayOptionsToControls()`, only apply when `getThemes()[sectionTheme]` exists, and report in the UserLog otherwise.  Add a guard in `selThemesChange()`.

**A4. Table Theme names go stale when Sections move or are deleted (Suspected).**
`_computeTableThemeIdentity()` bakes the Section number into the stored `id` and `caption` (`Autobahn+P46_1:S1`).  The Theme belongs to the Section, so after a move or delete the Matrix shows `:S1` on what is now Section 3.  The cascade still works; only the name is wrong, and `Copy to Section` re-bases from `baseid` so it is unaffected.
- Fix: do not store the `:S<n>` suffix; build the caption in the Matrix from the Section index when displaying.  Or re-tag on `SectionMoved`/delete.

**A5. Appending Sections from another Song does not refresh the Theme page (Verified in the Sprint 146 notes).**
`openSong()` with `importOptions.sections` adds Sections through raw `Song.addSection()`, which does not publish `SectionChanged`.  `#selThemeSectionNumDest` and the Matrix are then stale until the next navigation.
- Fix: publish `SectionChanged` once after the append, in `updateAfterAppendSong()`.

### B. Missing capabilities (inaccuracies the documentation has to work around)

**B1. No way to return an Instrument to the Song Theme from a later Section (Verified).**
Table Themes have no "none" marker, and `Clear Table Theme` only removes the Current Section's own block, after which the earlier one carries forward again.  The documented workaround (Copy a snapshot of the Song Theme with `default` picked) stores a snapshot that no longer follows the Song Theme.
- Feature: a stored marker such as `theme: null` or `{ inherit: true }` on a Section meaning "use the Song Theme from here", honored by `getStoredTableThemeInEffect()` (return `null` when the nearest block is a marker), shown in the Matrix as `default[...]`, and written by a new "Use Song Theme from this Section" button.  The schema (`theme: { type: 'object' }`) and `removeEmptyTables()` would need to accept it.

**B2. Table Themes are full snapshots and do not follow the Song Theme (By design; a documentation burden).**
Changing the USER Theme later does not change a Table Theme that started from it.  Users will expect otherwise, since the id says `Autobahn+P46_1:S1`.
- Feature: store only the keys that differ from the base (`baseid`), resolved at render time.  This is a larger change, and affects `controlsToTheme()`, `applyThemeToTableElement()` and the file format.  At least show the base Theme id in the Matrix tooltip.

**B3. Theme automation can only be stored from the View page (Verified).**
The Themes page has no button for it.  The workflow is: choose a Theme in the main menu, go to View, press SAVE Diff.  `#selThemes` is outside `#divViewControls`, so changing it never turns SAVE Diff magenta.  Nothing warns that a chosen Theme is unsaved, and the next Section change overwrites it.
- Feature: a "Store Theme on this Section" button (and "Clear") in the Theme Matrix footer, acting on the `sectionTheme` cell through the existing Display Options plan engine (honoring gates).  Optionally mark the Themes dropdown, or the footer label, when the live dropdown differs from the stored or inherited `sectionTheme`.

**B4. The Matrix cannot act on cells (By design in Sprint 146).**
No delete, move or copy from a Matrix cell; it only navigates.  Copy needs three pickers, and the Themes page has no Undo (the Display Options Matrix does).
- Feature: a Tool row like the Display Options Matrix (Clear Cell, Store Cell, Copy From...), and a one-step Undo for Theme operations.

**B5. Table Themes ignore Display Options gates, and there is no per-Instrument block (Verified).**
A Key r on `sectionTheme` stops automation, but nothing stops a Table Theme from applying.
- Feature: a read-block for Table Themes (Song or Instrument scope), if Users want to free Instruments from stored looks for a session.

**B6. Instrument Margins cannot vary per Instrument (Verified).**
`--instrument-margin-tb` is written by `theme()` and `TABLE_THEME_CSS_VARS` but no CSS rule reads it; Margins are applied by a jQuery `.css()` call on every `.instrumentBackground` when the dropdown changes.  A Table Theme saves a margin value that does nothing on its own.
- Fix: read the variable in the `.instrumentBackground` rule in `instrument.css` (for example `margin-block: var(--instrument-margin-tb, 0)`), and remove the jQuery shortcut or limit it to the live preview.

### C. Display and documentation accuracy

**C1. The Matrix does not show what the Instrument really shows (Partly addressed by Preview).**
Preview shows what each Section would apply, but not the live controls, and cannot show a single value for Sections before the first stored `sectionTheme` (the result depends on how you arrived).
- Fix or feature: A2 removes most of the ambiguity.  Meanwhile, `(kept)` could carry the Song's saved Theme in parentheses (the value opening the Song gives).  A marker for "the Theme the controls currently hold" would help with A1.

**C2. The non-Preview "default" column hides dormant values (Addressed in Preview only).**
With Allow Theme Automation off, the normal Matrix shows a blank where a `sectionTheme` is stored; Preview shows it struck through.  Users may delete Themes they cannot see.
- Fix: show dormant values struck through in the normal view too.

**C3. `default` is overloaded (Addressed in Preview).**
The column header `default`, the picker entry `default (whole song)`, the Preview labels, and the built-in Theme `Default` are four different things.
- Fix: rename the picker entry to `Song Theme (whole song)` and the column header to `automation`; keep `Default` for the built-in.

**C4. The Instrument picker lists Instruments that are not shown (Verified).**
`getAllModelTableIDs()` includes layout entries, wirings and Sections' tables, so hidden Instruments and ghost tables appear.  Saving a Table Theme for one is harmless but has no visible effect.
- Fix: mark hidden Instruments in the list (for example "(hidden)").

**C5. Existing help text about Theme automation.**
The `/vdd` section in `help.html` says Users do not get prompted to SAVE Diff for a Theme change.  That is true (B3).  If B3 is built, update it.

### D. Suggested order

1. A3 (guard against unknown ids) and A5 (publish `SectionChanged`): small and safe.
2. A1 (reload the controls) and A2 (Song `theme` on save): they affect data users keep.
3. B6 (Margins) and A4 (stale names): small, local.
4. B1 (a "none" marker) and B3 (store/clear `sectionTheme` from the Theme page): the largest gains for Song authors.
5. B2, B4 and B5: larger design questions; worth a design discussion first.
