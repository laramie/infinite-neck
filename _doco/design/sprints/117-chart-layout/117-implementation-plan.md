# Sprint 117 Implementation Plan

## Scope Summary

This sprint adds a new printable-style Chart tab under the existing Chart page and introduces two new Section-level persisted properties:

- `Section.chartPosition`
- `Section.chartCaptionWidth`

The chart feature now has these core rules:

- the new fourth tab is `Chart`
- only `Chart Details` gets the new controls
- `Chart Summary` remains a simple vertical list of Sections
- `Chart Notes` remains the tonal/table view
- `Chart` is read-only and printer-oriented
- `Chart` uses Section-level `chartChord` and `chartMode`, not per-table tonal values
- CSS stays in `section-printer.css`
- implementation should remain centered in `section-printer.js`

That is a better fit for the current architecture than any `templates/` approach, so the implementation plan should assume no new `templates/` files.

## Current Architecture

### Rendering flow today

- `index.html`
  - owns the three existing Chart tab buttons and tab containers
- `infinite-neck.js`
  - `updatePrintSections()` renders the chart-related tabs by calling `section-printer.js`
  - `showChartTab()` toggles which tab is visible
- `section-printer.js`
  - `printSections(theSong, theSections, showDetails)` renders Summary and Details
  - `printSectionsNotes(theSong, theSections)` renders Notes
- `section-printer.css`
  - owns the CSS for these rendered pages
- `SectionPersistence.js`
  - defines default Section fields
- `bin/song-file-schema.js`
  - documents the Section schema for songs

### Why this matters

The new requirements align directly with the existing chart-page pipeline:

- one new tab body
- one existing tab gaining controls
- one central refresh function already rebuilding all chart tabs together

So the least risky implementation is to extend this path rather than create a parallel rendering system.

## Recommended Implementation Direction

### Recommendation

Keep `section-printer.js` as the chart rendering hub and extend it in-place.

Reasoning:

- The latest design explicitly rejects the `./templates` idea.
- The new controls live only on `Chart Details`, which is already rendered by `printSections(..., true)`.
- The new `Chart` tab is another report-like output, which fits the current string-builder pattern.
- `updatePrintSections()` already guarantees all chart tabs stay synchronized after one Section change.

### Implementation shape

1. Add `SECTION_CHART_POSITION` and `SECTION_CHART_CAPTION_WIDTH` constants in `Constants.js`.
2. Add runtime defaults in `SectionPersistence.js`:
   - `chartPosition: 'BAR'`
   - `chartCaptionWidth: 'none'` or the chosen default after clarification
3. Document both properties in `bin/song-file-schema.js` as optional Section properties.
4. Extend `index.html` with:
   - a new `btnChartTab`
   - a new `divChartTab`
5. Extend `infinite-neck.js` with:
   - new chart-tab rendering in `updatePrintSections()`
   - new tab visibility support in `showChartTab()`
   - write/update functions for `chartPosition` and `chartCaptionWidth`
6. Extend `section-printer.js` with:
   - control builders for Position and Width selects
   - a Details table column update
   - a new `printChart()` renderer for the new `Chart` tab
7. Add new chart layout CSS to `section-printer.css`.

## Model Changes

### New Section properties

Add these persisted Section fields:

- `chartPosition`
- `chartCaptionWidth`

Recommended runtime defaults:

- `chartPosition: 'BAR'`
- `chartCaptionWidth: 'none'`

`chartPosition` values:

- `INTRO`
- `HEAD`
- `LINE`
- `BAR`
- `OUTRO`

`chartCaptionWidth` values:

- `none`
- `short`
- `medium`
- `line`

### Constants

Preferred names based on the design:

- `SECTION_CHART_POSITION`
- `SECTION_CHART_CAPTION_WIDTH`

Use `Object.freeze(...)` in `Constants.js`.

## Schema Changes

### `bin/song-file-schema.js`

Add optional Section properties:

- `chartPosition`
- `chartCaptionWidth`

These should be optional, matching the updated design answer.

That means:

- old songs remain schema-valid
- runtime construction supplies defaults

This is consistent with the design instruction to default on Section construction rather than add special migration code.

## UI Changes

### Tab strip and tab bodies

Add a fourth Chart page tab:

- `Chart Summary`
- `Chart Notes`
- `Chart Details`
- `Chart`

Required updates:

- `index.html` adds button and body container
- `infinite-neck.js` updates `showChartTab()` and `updatePrintSections()`

### Control placement

Per the revised design, the new controls appear only on `Chart Details`.

That means the old plan item about adding controls to all chart tabs is obsolete and should be removed.

### Details table column order

The updated order is:

- `ID | beats | KEY | ♯/♭ | Chord | Mode | Position | Width | Caption`

This should be implemented only in `Chart Details`.

`Chart Summary` and `Chart Notes` should not gain the new controls under the revised design.

## Rendering Plan For The New `Chart` Tab

### Data source

Each Section span should use Section-level fields:

- `section.chartChord`
- `section.chartMode`
- current Section key display
- section index link
- optional caption display depending on `section.chartCaptionWidth`

Do not use per-table `SectionNotes.chord` or `SectionNotes.mode` here.

### Base span content

For each Section BAR span, the visible lines should be:

1. chord line
2. mode line
3. `${sectionIndex1Based}:${KEY}:${sectionBeatCount}`
4. optional caption line for `short` and `medium`

For empty chord or mode, render a non-visible placeholder with preserved line height, e.g. `&nbsp;`.

### Row/container rules

Every rendered Section span is a `chartBAR`.

Row containers vary by row type:

- `chartINTRO`
- `chartHEAD`
- `chartLINE`
- `chartOUTRO`

The first Section on a row is still a `chartBAR`; row semantics live on the container.

### Title rules from the design

Descriptive title blocks are emitted above certain row containers:

- `INTRO` row may get `INTRO`
- `HEAD` row may get `HEAD`
- `OUTRO` row may get `OUTRO`
- `LINE` rows do not get descriptive text

Additional rule from the design:

- if the chart begins with `LINE` or `BAR`, the descriptive text should still be `HEAD`

This means the first row may visually present as HEAD even if the first Section is not explicitly marked `HEAD`.

### Caption-width rules

#### `none`

- no caption output for that Section in `Chart`

#### `short`

- caption appears inside the bar span
- caption is on a line below the `${index}:${KEY}:${beats}` line
- caption wraps
- span gets a narrower width constraint in CSS

#### `medium`

- caption appears inside the bar span
- caption is on a line below the `${index}:${KEY}:${beats}` line
- caption wraps
- span gets a wider width constraint in CSS

#### `line`

- captions are not rendered inside each bar span
- instead, captions from the row are accumulated in a block below the row
- each caption entry is a full-width line like:

  `1. The first Section caption`

The line-caption block should follow its corresponding row container.

## CSS Plan

All CSS should go into `section-printer.css`.

### Existing CSS file to extend

- `section-printer.css`

### New CSS areas likely needed

- chart page root container
- row containers for:
  - `.chartINTRO`
  - `.chartHEAD`
  - `.chartLINE`
  - `.chartOUTRO`
- title blocks for:
  - `.chartINTROTitle`
  - `.chartHEADTitle`
  - `.chartOUTROTitle`
- `.chartBAR`
- caption-width variants, likely on the bar span or descendants
- line-caption container and per-caption rows

### CSS behavior called for by design

- all styling simple and printable in this iteration
- black and white appearance is acceptable
- `chartBAR` has `border: 1px solid black`
- generous padding, `2em`
- INTRO container text should be italic
- INTRO title text should not be italic; it should match the bold/larger title treatment of HEAD and OUTRO
- page may overflow horizontally when needed

## Event And Update Model

### Recommended write functions in `infinite-neck.js`

Add functions analogous to existing chart update helpers:

- `linkToSectionChartPosition(idx, chartPosition, doSectionChanged = true)`
- `linkToSectionChartCaptionWidth(idx, chartCaptionWidth, doSectionChanged = true)`

Each should:

1. write the Section field
2. trigger `sectionChanged()` unless explicitly suppressed

### Refresh flow

1. user changes Position or Width in `Chart Details`
2. Section field is updated
3. `sectionChanged()` runs
4. `updatePrintSections()` rebuilds:
   - Summary
   - Notes
   - Details
   - Chart

This keeps the new `Chart` tab synchronized with the controls without custom cross-tab state management.

## Proposed File Changes

### Existing files to modify

#### `Constants.js`

Add:

- `SECTION_CHART_POSITION`
- `SECTION_CHART_CAPTION_WIDTH`

#### `SectionPersistence.js`

Add Section defaults:

- `chartPosition`
- `chartCaptionWidth`

#### `bin/song-file-schema.js`

Add optional Section schema properties:

- `chartPosition`
- `chartCaptionWidth`

#### `index.html`

Add the new Chart-tab button and container.

Likely IDs:

- `btnChartTab`
- `divChartTab`

#### `infinite-neck.js`

Modify:

- `updatePrintSections()`
- `showChartTab()`

Add:

- write helpers for the two new Section properties

#### `section-printer.js`

This is the main implementation file.

Expected changes:

- add control renderers for Position and Width selects
- extend `printSections(..., true)` so `Chart Details` gets:
  - Position column
  - Width column
- keep `printSections(..., false)` as the Summary renderer without new controls
- keep `printSectionsNotes(...)` focused on Notes without new controls
- add `printChart(theSong, theSections)` for the new Chart tab

#### `section-printer.css`

Add all new styles for the Chart tab and the Details-tab controls.

### Existing files that probably do not need changes

- `section-printer.css` is sufficient for styling, so no new CSS file is needed
- `templates/` files should not be touched for this sprint
- `tonalPicker.js` is unrelated to this feature

### New files not recommended

Do not add:

- `templates/chart/chart.css`
- `templates/chart/chart.builder.js`
- `templates/chart/chart.html`

The updated design explicitly drops that direction.

## Design Review Notes

The revised design is much clearer than the earlier version. The main architectural direction now fits the repo better:

- one module, `section-printer.js`, remains the chart/report renderer
- controls are localized to one place
- CSS remains centralized in `section-printer.css`

That said, a few areas still need confirmation or tighter wording.

## Open Questions / Clarifications Needed

### 1. Default value for `Section.chartCaptionWidth`

`chartPosition` clearly defaults to `BAR`.

`chartCaptionWidth` has defined values, but the default is not stated.

Recommended default:

- `none`

Question:

- Should new Sections default `chartCaptionWidth` to `none`, `short`, `medium`, or `line`?

### 2. Likely typo in descriptive-text rule

This sentence appears inconsistent:

- `A HEAD gets its own descriptive text if it exists, otherwise not.`

Given the surrounding text, this may have meant `INTRO`, not `HEAD`.

Question:

- Is that sentence intended to say `INTRO gets its own descriptive text if it exists, otherwise not`?

### 3. First-row class when the chart begins with `LINE` or `BAR`

The design says the first row should still get `HEAD` descriptive text in that case.

Question:

- Should that first row container also use class `chartHEAD`, or should it keep its literal row class and only show a `HEAD` title?

This affects CSS and renderer logic.

### 4. Meaning of `LINE` row type

The current text says `LINE` starts a new row but does not get descriptive text.

Question:

- Should `LINE` have its own container class, e.g. `chartLINE`, even if it has no title block?

Recommended answer:

- yes, so future styling remains possible

### 5. Mixed `chartCaptionWidth` values within the same row

One row can contain several BAR spans. Some Sections could be `line`, some `short`, some `none`, some `medium`.

Question:

- In a mixed row, should only the `line` Sections contribute entries to the caption block below the row, while `short` and `medium` still render their captions inside their own bars?

Recommended answer:

- yes

That is the most literal reading of the per-Section model.

### 6. Which beat count formatter to use in `${index}:${KEY}:${beats}`

Question:

- Should the Chart tab use raw `section.beats` or the normalized `section.getBeats()` behavior?

Recommended answer:

- use the same effective beat value already shown elsewhere in chart pages, not the raw field if normalization matters

### 7. Whether Summary and Notes should show the raw persisted values anywhere

The revised design removes controls from Summary and Notes.

Question:

- Should Summary and Notes remain exactly as they are now, with no new Position or Width columns at all?

This appears to be the intent, but it is worth confirming because it changes the previous answer about table column order.

## Validation Plan

### Model and schema

- new Section defaults include `chartPosition` and `chartCaptionWidth`
- old song files load and default correctly at runtime
- schema documents both properties as optional

### Chart Details controls

- changing Position updates the Section and refreshes all chart tabs
- changing Width updates the Section and refreshes all chart tabs
- controls persist after refresh

### New Chart tab

- row breaks occur correctly for `INTRO`, `HEAD`, `LINE`, `OUTRO`
- `BAR` appends to the current row
- first row behavior is correct when the first Section is `BAR` or `LINE`
- title blocks render according to the agreed rules
- `short`, `medium`, and `line` caption modes render as designed
- horizontal overflow is acceptable when rows get wide

### CSS

- chart remains readable in black and white
- `chartBAR` borders and padding match the design
- INTRO row italic style does not leak into INTRO title styling

## Final Recommendation

Proceed with a single-module chart implementation centered in `section-printer.js`, backed by two new Section properties and corresponding schema documentation.

The updated design no longer has any strong reason to involve `templates/`, so the implementation plan should treat that avenue as closed for this sprint.
