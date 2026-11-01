# sprint-149 Iteration 1 Implementation Report

Request: [149-design.md](149-design.md).  Sprint: [sprint-149.md](sprint-149.md).

## What was built

A **Preview** checkbox on the Theme Matrix.  Unchecked (the default), the Matrix is exactly as before.  Checked, every cell shows what its Section would *apply*, with cascaded (not stored) values in gray.

| File | Change |
|---|---|
| [templates/themeMatrixPreview.js](../../../../templates/themeMatrixPreview.js) | **New**, pure (no DOM/jQuery).  `buildThemeMatrixPreview(song, tableIDs, {knownThemeIds})` returns one cell `{text, kind, title}` per Section x column. |
| [templates/themes.builder.js](../../../../templates/themes.builder.js) | `ThemesBuilder.themeMatrixPreview` state, Preview rendering in `renderThemeMatrix()`, the checkbox in the footer cell, a delegated `change` handler. |
| [templates/themes.css](../../../../templates/themes.css) | Gray/italic/strikethrough classes, and the larger-type wrapper for the checkbox. |
| [_tests/jest/theme-matrix-preview.test.js](../../../../_tests/jest/theme-matrix-preview.test.js) | **New**, 13 tests against a real `Song`. |
| [help.html](../../../../help.html) | One paragraph on Preview in "The Theme Matrix". |

No change to `Song.js`, `infinite-neck.js` or the resolver.

## How the rules stay in one place

The Preview has no copy of the cascade.  It asks the Song:

- **Default column (Theme automation):** `song.resolveDisplayOptionsAt(index, { purpose: 'apply' })`, the same resolve navigation uses.  Cascade, Song-DEFAULTS, cell/row/column read-blocks and the Allow Theme Automation adapter all come from there, so a rule change in the resolver shows up in the Preview automatically.  Provenance (`entries.sectionTheme`) gives the hover text ("from Section 3", "from Song-DEFAULTS").
- **Instrument columns (Table Themes):** `song.getStoredTableThemeInEffect(section, tableID)`, the same walk-back the live tables use.  The "carried from Section N" hover finds the owning Section by object identity.

Re-render triggers are unchanged and already cover Preview: Section change, Theme/Clear/Copy buttons, Allow Theme Automation toggle, and every DisplayOptions model change (`finishDisplayOptionsModelChange()` already calls `renderThemeMatrix()`).

## What the cells show (Preview on)

| Kind | Look | Meaning |
|---|---|---|
| stored | normal | The Section stores and applies it. |
| inherited | gray | Carried from an earlier Section (or Song-DEFAULTS, for the default column). |
| song | gray `default` / `default*` | Instrument with no Table Theme at or before this Section: it shows the Song Theme. |
| held | gray italic `(kept)` | Automation applies nothing here: no Section at or before it stores a Theme (and no Song-DEFAULTS), or it is read-blocked.  The Themes dropdown keeps what it holds. |
| dormant | gray, struck through | A `sectionTheme` is stored but Allow Theme Automation is off. |
| ignored | gray, struck through | Stored here but read-blocked; the Theme that *is* applied is in the hover text. |

Hover text is on every non-stored cell.

## "default" hiding more than one Theme (the question in the request)

Yes, it can.  An Instrument with no Table Theme shows the Song Theme, and with Theme automation on the Song Theme is not one Theme.  So the Instrument cells say **`default*`** (instead of `default`) when automation is on and either:

- it applies two or more different Themes across the Song, or
- it applies a Theme in some Sections and holds in others (so the dropdown's value is also in play).

When the Song Theme is one fixed Theme (automation off, or the same Theme everywhere, or none at all), the cell says plain `default`.  The hover text of each cell names the Theme at *that* Section, and the legend under the table lists the ids.  The star is per Matrix, not per cell: every `default` cell gets it, so you see at a glance that the Song Theme moves.

This is a first cut.  Alternatives to consider:

- show the applied Theme id in the Instrument cell instead of `default*` (clearer, but less table-like and wider);
- star only the Sections whose Song Theme differs from the previous Section.

## Holes found, and what was done

Implemented (all in the Preview only):

1. **Read-blocks on `sectionTheme`** (cell, row, column): the Preview follows the resolver, so a blocked cell is `ignored` and a blocked Section or column is `(kept)`.
2. **Dormant values:** with Allow Theme Automation off, stored `sectionTheme` values are still visible (struck through), where the non-Preview column shows blank.
3. **Song-DEFAULTS `sectionTheme`:** applied to Sections before the first stored one, labeled "from Song-DEFAULTS".
4. **Unknown Theme id:** a `sectionTheme` that is not in the Themes dropdown is shown as `id?` with a hover note.  (Applying one in the live app sets the dropdown to nothing.)
5. **Sections that apply nothing** are shown as `(kept)` rather than blank, since blank would read as "default Theme".
6. **Provenance on hover** for every cascaded cell.

Not implemented; noticed, for discussion:

- **Open question: Sections before the first stored `sectionTheme` show `(kept)`.**  That is accurate (they apply nothing), but what you *see* in such a Section depends on how you arrived: opening the Song shows the Song's saved Theme; going back from a later Section leaves the later Theme.  The Preview cannot show a single value there.  A Song-DEFAULTS `sectionTheme`, or a Theme stored on Section 1, removes the ambiguity.  If you would prefer, `(kept)` could show the Song's saved theme (`song.theme`) in parentheses, which is what opening the Song gives.
- **Table Themes do not capture the "default" snapshot.**  An Instrument cell cannot show "default (as of Section 3)" as a Theme name; it shows only the label, with the id in the hover.
- **The Matrix does not reflect the Theme controls.**  The controls on the page show the last Theme loaded, which can disagree with the Matrix after Section changes (documented in help already).  A Preview "current Theme in controls" marker could help; not done.
- The footer cell is `colspan="3"` as in the request, so with many Instruments the Preview legend wraps inside the first three columns.  Raising the colspan to the column count would let it use the full width.

## Testing

- New: [theme-matrix-preview.test.js](../../../../_tests/jest/theme-matrix-preview.test.js), 13 tests: Table Theme cascade (forward only, per Instrument, source Section), automation off/on, Song-DEFAULTS, cell and column read-blocks, unknown ids, and the `default` / `default*` cases.
- Full suite: 79 suites, 1030 tests, all passing.
- Not tested in a browser (Jest stays non-DOM).  UI acceptance checklist:
  1. Open the Theme Matrix: the Preview checkbox is under the help text, unchecked, with readable size.
  2. Open `practice/diatonics.json`, check Preview: Sections 2-7 show gray `Guitar Black+P46_1:S1` and `Guitar Black+Piano_1:S1`; the default column is blank (automation off).
  3. Check Allow Theme Automation, store a Theme on Section 3 (View > SAVE Diff): Sections 1-2 show `(kept)`, Sections 3-7 show the Theme (both Instruments here keep their Section 1 Table Themes, so their cells do not change; on a Song with an Instrument that has no Table Theme, its cells read `default*`).
  4. Put a **Key r** on the `sectionTheme` column in the Display Options Matrix: the default column turns to struck-through stored values and `(kept)`.
  5. Uncheck Preview: the Matrix is as before.
  6. Preview stays checked while navigating, looping and pressing Theme / Clear Table Theme / Copy to Section.
