# Sprint 117 Iteration 5 Implementation Plan

## Scope Summary

Iteration 5 extends the existing Chart feature with a more musically conventional LeadSheet rendering mode.

The core change is that one Section may now expand into multiple rendered BAR spans when the Chart `Bar Style` is `LeadSheet` and the Section has an optional `beatsPerBar` value.

This iteration is intentionally narrow:

- new optional Section field: `beatsPerBar`
- one new editable control on `Chart | Chart Details`
- a refinement of the existing `Chart | Chart Options` bar-style behavior
- a view-only change on `Chart | Chart` when `Bar Style` is `LeadSheet`
- no change to Summary, Notes, transport behavior, section timing, or per-table tonal logic

This plan assumes the existing Iteration 1-4 work is already complete and remains the baseline.

## Current Baseline

The current chart implementation already has:

- `Section.chartPosition`
- `Section.chartCaptionWidth`
- `Song.chartOptions`
- `Chart Options` tab
- `Chart` rendering in `section-printer.js`
- `Box` and `LeadSheet` values in the bar-style select
- song-wide options for modes, detail line, caption display, and chart font sizes

Relevant current files:

- `section-printer.js`
- `section-printer.css`
- `infinite-neck.js`
- `SectionPersistence.js`
- `Section.js`
- `Constants.js`
- `SongPersistence.js`
- `bin/song-file-schema.js`
- `_tests/jest/chart-layout.test.js`

This matters because Iteration 5 is not a greenfield chart design. It is a targeted enhancement on top of an already working chart pipeline.

## Design Interpretation

### What changes in LeadSheet mode

When `Song.chartOptions.barClass === 'LeadSheet'`:

- a Section may render as multiple BAR spans instead of exactly one span
- BAR spans in the chart should become uniform width across the whole chart
- the current borderless `LeadSheet` look is replaced with vertical-bar separators
- the previous borderless look moves to a new CSS class `barClass-Bare`

The first rendered bar for a Section remains the Section's anchor in chart ordering.

If `Section.beatsPerBar` is missing or empty:

- the Section renders as exactly one BAR, as today

If `Section.beatsPerBar` is present and valid:

- the Section renders as `ceil(sectionBeats / beatsPerBar)` BAR spans
- each span gets its own `beats:${n}` subtle line
- the last span gets the remainder beats if the Section beat count does not divide evenly

### What does not change

- Section timing and playback semantics do not change
- transport stays Section-based
- key, named notes, recorded notes, chord detection, and table notes do not change
- Summary and Notes stay as they are
- non-LeadSheet chart rendering should keep existing behavior

## Recommended Implementation Direction

Keep all Iteration 5 rendering logic centered in `section-printer.js`.

Reasoning:

- the current Chart renderer is already centralized there
- the existing `Chart Details` and `Chart Options` controls are already emitted there
- `updatePrintSections()` in `infinite-neck.js` already refreshes all chart-related tabs after a Section change
- this iteration changes rendering semantics, not general app architecture

No template-system change is needed.

## Model Changes

### New Section field

Add optional persisted field:

- `Section.beatsPerBar`

Recommended runtime behavior:

- do not initialize it in `SectionPersistence.js`
- if absent, leave it absent
- if empty in the UI, delete/unset it from the Section

This matches the design requirement that an empty input means the Section is a single BAR.

### Data type recommendation

Treat `beatsPerBar` as a positive integer, not an arbitrary numeric value.

Reasoning:

- current song beat values already behave as integer-like values
- the chart expansion rule is discrete BAR counting
- allowing decimals would complicate remainder rules and UI validation for little gain in this sprint

If the design truly wants non-integer values later, that should be a separate expansion.

## Schema Changes

### Section schema

Update `bin/song-file-schema.js` to document optional Section property:

- `beatsPerBar`

Recommendation:

- accept the same integer-like shape used for other beat-count fields
- keep it optional

That preserves compatibility with existing song files and keeps runtime defaulting simple.

## UI Changes

### `Chart | Chart Details`

Add a new input column before `Position`:

- `Bars` or `Beats/Bar` as the user-facing label

Based on the written design, the stored value is `beatsPerBar`, so the recommended label is:

- `Beats/Bar`

Recommended table order:

- `ID | beats | KEY | ♯/♭ | Chord | Mode | Beats/Bar | Position | Width | Caption | Details`

Implementation details:

- render an `<input>` per Section in `printSections(..., true)`
- empty input means unset
- valid input commits `Section.beatsPerBar`
- invalid input should:
	- not persist
	- show a message through the existing `showMessages(...)` path
	- restore the previous valid value on refresh

### `Chart | Chart Options`

The existing select currently offers:

- `Box`
- `LeadSheet`

Iteration 5 requires the current `LeadSheet` CSS behavior to move to `barClass-Bare`.

This creates an important product question:

- should `Bare` also become a user-selectable value, or should the prior borderless behavior simply stop being user-accessible?

The design text does not fully resolve that, so see Clarifying Questions below.

## Rendering Plan For `Chart | Chart`

### High-level approach

Refactor chart BAR rendering so one Section can yield one or more rendered bar models before HTML is produced.

Recommended structure inside `section-printer.js`:

1. Build a normalized render model per Section.
2. Expand that model into one or more chart BAR render entries.
3. Feed those entries into the existing block/line grouping logic.

This avoids scattering `beatsPerBar` math across the block-layout code.

### Recommended render-model helper

Add a helper conceptually like:

- `expandSectionToChartBars(theSong, section, idx, songChartOptions)`

For non-LeadSheet styles:

- returns one render entry matching current behavior

For `LeadSheet` style:

- returns one or more render entries for the Section

Each expanded render entry should include at least:

- original Section reference
- original Section index
- chart position semantics inherited from the Section
- per-rendered-bar beat count
- whether it is the first rendered bar for the Section
- whether it is a repeated/subsequent bar for the Section

### LeadSheet content rules

The design intent appears to be:

- regular chart text lines are suppressed in LeadSheet mode
- the bar body becomes LeadSheet-specific
- each rendered BAR shows:
	- a main symbol line
	- a subtle `beats:${n}` line aligned right

The remaining ambiguity is whether the first rendered BAR of a Section should show the Section chord or whether all rendered BARs, including the first, should show `%`. See Clarifying Questions.

### BAR width rules

For `LeadSheet` style, all BARs in the chart should use a common width.

Recommendation:

- ignore `chartCaptionWidth` for determining LeadSheet bar width
- add a dedicated uniform-width class for LeadSheet bars, for example:
	- `chartBAR--leadSheet`

Reasoning:

- the requirement explicitly says all BARs should be the same width across the chart
- existing `short` and `medium` widths are Section-specific and conflict with that rule

### Caption behavior recommendation

The design does not explicitly remove captions in LeadSheet mode.

Recommended interpretation for this sprint:

- keep caption behavior controlled by `chartCaptionWidth` and `showCaptions`
- but do not let caption width drive bar width in LeadSheet mode
- `line` captions still collect below the line
- `short` and `medium` captions may still render within a fixed-width LeadSheet bar

This keeps the current caption model intact while meeting the equal-width requirement.

If the intent is instead to suppress captions entirely in LeadSheet mode, that should be decided explicitly.

### Block and line grouping

Grouping rules should remain Section-driven, not expanded-bar-driven.

Recommendation:

- the Section's `chartPosition` controls where the first expanded BAR begins
- subsequent expanded BARs from the same Section stay in the same line
- only the Section's first expanded BAR participates in block/line boundary decisions

This preserves the current INTRO/HEAD/LINE/BAR/OUTRO semantics.

## CSS Plan

All CSS stays in `section-printer.css`.

### Required changes

1. Rename current borderless class behavior:
	 - old `barClass-LeadSheet` visuals become `barClass-Bare`
2. Redefine `barClass-LeadSheet` with vertical separators:
	 - each BAR gets `border-right: 2px solid black`
	 - the first BAR in a row also gets `border-left: 2px solid black`
3. Add a dedicated fixed-width LeadSheet bar class.
4. Add a subtle beat-count line style with the same font size as the detail line.
5. Add a helper class for the first bar in a line, for example:
	 - `chartBAR--firstInLine`

### Why a first-in-line class is recommended

The first bar in each rendered chart line needs a left border, but other bars do not.

That is easier and clearer if `section-printer.js` emits a dedicated class rather than trying to express it through complicated CSS selectors.

## Controller / Event Wiring Changes

### New update function

Add a new setter in `infinite-neck.js`, conceptually:

- `linkToSectionBeatsPerBar(idx, beatsPerBar)`

Responsibilities:

- unset when passed an empty value
- validate positive integer input
- on invalid input call `showMessages(...)`
- call `sectionChanged()` on accepted changes

### Event binding

Add delegated binding for the new input class emitted on `Chart Details`.

Recommended event behavior:

- commit on `change`
- optionally also on `blur`
- avoid committing on every `input` event

This reduces churn while the user is typing.

## File Impact Summary

Files that should be touched:

- `SectionPersistence.js`
	- optional field support if construction helpers need awareness, but do not default-initialize
- `Section.js`
	- optional helper methods if beat-splitting logic belongs on the model
- `bin/song-file-schema.js`
	- optional `beatsPerBar`
- `section-printer.js`
	- Details input column
	- LeadSheet expansion helpers
	- updated bar rendering
	- first-in-line class emission
- `section-printer.css`
	- new LeadSheet/Bare styling
	- uniform-width LeadSheet styles
	- beat-count styling
- `infinite-neck.js`
	- setter for `beatsPerBar`
	- delegated input binding
- `Constants.js`
	- only if a new `Bare` enum value is adopted for chart bar class
- `SongPersistence.js`
	- only if `chartOptions.barClass` is expanded to allow `Bare`
- `_tests/jest/chart-layout.test.js`
	- new coverage for LeadSheet expansion and Details input rendering

## Testing Plan

Add focused Jest coverage for:

1. `Chart Details` renders a `beatsPerBar` input column only in Details.
2. Empty `beatsPerBar` yields one rendered BAR.
3. Valid `beatsPerBar` splits a Section into multiple rendered LeadSheet bars.
4. Remainder beats land on the last rendered BAR.
5. Block/line grouping still honors Section `chartPosition` when a Section expands into multiple bars.
6. `LeadSheet` bars suppress the regular chord/mode/detail layout and emit the LeadSheet body.
7. First bar in each line gets left border class; all bars get right-border style.
8. Uniform-width LeadSheet bar class is present across all rendered bars.
9. Existing `Box` behavior is unchanged.

Recommended validation commands:

- `./run-jest.sh _tests/jest/chart-layout.test.js`
- `node bin/validate-song-schema.js`

## Risks And Edge Cases

### Existing saved songs using `LeadSheet`

Current saved songs that already use `barClass: 'LeadSheet'` will change behavior materially once this iteration lands.

That is acceptable only if intentional.

If preserving the old borderless style matters, a new persisted value such as `Bare` should be added and exposed.

### Partial last bar

If `section.beats` is `10` and `beatsPerBar` is `4`, the rendered beat counts should be:

- `4`
- `4`
- `2`

That should be explicitly tested.

### Invalid inputs

Inputs like these should be rejected:

- empty string with whitespace only if it is not normalized to empty
- `0`
- negative numbers
- decimals
- non-numeric strings

The UI should surface the reason through `showMessages(...)` and refresh back to the last valid persisted value.

## Clarifying Questions

1. In `LeadSheet` mode, should the first BAR of a multi-bar Section show the actual Section chord, or should every rendered BAR show `%`? The design text currently says both that the actual chord is not displayed and that a subsequent BAR is a repeat mark, which point in different directions.

2. Should `Bare` become a third user-selectable `Bar Style` value in `Chart Options`, or is it only an internal CSS class with no UI/persistence option?

3. Should `chartCaptionWidth` and `showCaptions` continue to affect `LeadSheet` bars, or should captions be suppressed entirely when `Bar Style` is `LeadSheet`?

4. Should `beatsPerBar` be limited to positive integers only? This plan recommends yes, even though the design text says numeric.

5. What should happen if `beatsPerBar >= section.beats`? This plan assumes that still renders exactly one BAR with `beats:${section.beats}`.

6. What should the new Details column header be: `Beats/Bar`, `Bars`, or something else? This plan recommends `Beats/Bar` because that is the stored concept.

## Recommended Default Decisions If No Further Clarification Arrives

If implementation needs to proceed without more answers, the least risky defaults are:

- `beatsPerBar` accepts positive integers only
- empty input unsets the field
- `beatsPerBar >= section.beats` renders one BAR
- `Bare` is added as a third selectable bar style so the old borderless behavior remains available
- `LeadSheet` keeps caption behavior but uses fixed-width bars
- first BAR of a Section shows the Section chord, subsequent expanded BARs show `%`

That last item is the most important unresolved semantic choice.
