# Sprint 118 Implementation Plan

## Scope Summary

Sprint 118 adds a new chart-facing view named `LeadSheetLine` and exposes it as a new tab named `Line` immediately after `Chart`.

This iteration is intentionally narrow:

- reuse the existing `Chart | Chart` LeadSheet layout rules rather than invent a second chart format
- show only the current LeadSheet line that contains the current Section
- optionally show the next LeadSheet line when a new `Chart Options` checkbox `Show Next Line` is enabled
- keep the line view synchronized with transport and with click-to-section navigation
- apply the new background colors for the outer container, current line, next line, and current Section using directly editable hex values

This sprint should not redesign the chart system. The goal is to derive a focused, transport-aware line view from the chart model that already exists after sprint 117.

## Current Baseline

The repo already contains the chart infrastructure needed for this sprint:

- `index.html` already defines the `Chart` page tab strip and tab bodies
- `infinite-neck.js` already rebuilds chart tabs in `updatePrintSections()` and switches among them in `showChartTab()`
- `section-printer.js` already owns:
	- `printChartOptions(theSong)`
	- `printChart(theSong, theSections)`
	- LeadSheet bar expansion via `createChartBarEntries(...)`
	- chart line and block grouping
- `section-printer.css` already owns chart styles, including LeadSheet bar styling
- `SongPersistence.js` and `bin/song-file-schema.js` already persist and validate `Song.chartOptions`
- `_tests/jest/chart-layout.test.js` already covers chart layout behavior and is the natural place to extend for this sprint

That matters because `LeadSheetLine` should be implemented as another rendering of the existing chart model, not as a parallel layout engine.

## Recommended Implementation Direction

### Recommendation

Keep `section-printer.js` as the rendering hub and factor the existing chart line/block construction into reusable helpers.

Reasoning:

- `LeadSheetLine` is defined as “just like `Chart > Chart Options > Bar Style > LeadSheet`” but filtered to one or two lines
- `printChart()` already knows how to expand Sections into LeadSheet bars and group them into lines
- duplicating that logic in a separate module would create divergence between `Chart` and `Line`
- the new transport-aware view can be derived from the same intermediate chart-line model that the full chart uses

### Architectural shape

Refactor toward this internal flow inside `section-printer.js`:

1. normalize effective chart options
2. expand Sections into bar entries, including LeadSheet repeat bars
3. group expanded bars into chart blocks and lines
4. render either:
	 - the full `Chart`
	 - the filtered `LeadSheetLine` view

The important design rule is that `Chart` and `Line` should share the same line computation so the second view always matches the full chart exactly.

For CSS, do not depend heavily on the existing `LeadSheet` cascade. `LeadSheetLine` should have its own compact class set, even if that duplicates some styling, so spacing and colors can be tuned independently in the stylesheet.

## Model And Option Changes

### New song-wide chart option

Add a new optional boolean field under `Song.chartOptions`:

- `showNextLine`

Recommended default:

- `false`

Recommended rationale:

- the design treats the second line as an optional enhancement behind a checkbox
- all existing chart options are song-wide and persisted, so this fits the current model cleanly

### Schema and defaults

Update:

- `SongPersistence.js` to include default `showNextLine: false`
- `bin/song-file-schema.js` to allow optional boolean `chartOptions.showNextLine`

No Section schema changes appear necessary for this sprint.

## UI Changes

### New tab

Add a new tab after `Chart` named `Line`.

Expected updates:

- `index.html`
	- add `btnChartLineTab`
	- add `divChartLineTab`
- `infinite-neck.js`
	- update `updatePrintSections()` to render the new tab body
	- update `showChartTab()` to toggle the new tab
	- add the new button click binding

### Chart Options addition

Extend `printChartOptions(theSong)` so the `Chart Options` page includes:

- a checkbox labeled `Show Next Line`

That checkbox should use the same binding path as the existing song-wide chart options.

The `Line` tab is always available and always renders with its own LeadSheetLine styling. It does not depend on the `Bar Style` select and `LeadSheetLine` is not added as a `barClass` option.

## Rendering Plan

### New renderer

Add a new renderer in `section-printer.js`, conceptually:

- `printLeadSheetLine(theSong, theSections)`

This renderer should:

- use the same grouping logic as `printChart()`
- locate the chart line containing the current Section
- render only that line by default
- render that line plus the following line when `showNextLine` is enabled
- preserve the vertical space for the second line when there is no next line
- ignore captions
- respect the existing song-wide `modes` and `detailLine` checkboxes

### Required intermediate data

The existing `printChart()` path likely needs a reusable intermediate structure such as:

- chart blocks containing chart lines
- each chart line containing rendered or renderable bar entries
- line metadata including which Section indices appear on that line

Each line model should make it possible to answer:

- which line contains the current Section?
- what is the next line after that one in chart order?
- which bar or bars belong to the current Section?

That last point matters because a LeadSheet Section can expand into multiple bars when `beatsPerBar` is set.

### Current-line detection

Recommended rule:

- use the song’s current Section object or current Section index as the anchor
- find the first chart line whose Section-index set includes that current Section

This keeps the `Line` tab aligned with playback, section clicks, and any existing `gotoSection(...)` navigation.

### “Next line” behavior

When `showNextLine` is enabled:

- render the chart line immediately following the current line in chart reading order
- if there is no following line, render an empty placeholder area with the same structural height class as the second line container

This preserves the intended layout stability.

### Highlighting rules

Apply the design colors as follows:

- outer `LeadSheetLine` container: `#fbb963`
- primary line: `#ffeb9c`
- current Section bar or bars: `#a1fde9`
- next line container: `#f7c56a`

Recommended interpretation for multi-bar LeadSheet Sections:

- highlight all rendered bars that belong to the current Section, not just the first expanded bar

Reasoning:

- the current Section is the model entity being followed by transport
- a Section that expands into multiple LeadSheet bars should read as one active musical unit in this focused view

### Click and hover behavior

Preserve existing click-to-section behavior by continuing to emit `data-action='linkToSection'` on clickable LeadSheet bars.

This should continue to:

- jump to the clicked Section
- update current Section state
- trigger chart re-render via the existing refresh path
- move the `LeadSheetLine` view to the newly selected line when needed

Existing hover affordances should remain visible in the new view.

## Styling Plan

All styling should stay in `section-printer.css`.

Recommended new classes:

- `#sectionPrinterChartLine`
- `.leadSheetLinePanel`
- `.leadSheetLinePanelCurrent`
- `.leadSheetLinePanelNext`
- `.leadSheetLinePanelPlaceholder`
- `.leadSheetLineRow`
- `.leadSheetLineBAR`
- `.leadSheetLineBAR--currentSection`
- `.leadSheetLineBARChord`
- `.leadSheetLineBARMode`
- `.leadSheetLineBARBeatCount`

Recommended styling approach:

- prefer a dedicated `LeadSheetLine` class family over reuse of `chartBAR` and `barClass-LeadSheet`
- accept some CSS duplication so padding, width, and colors are easy to tune independently from the full chart
- keep the line view scrollable horizontally, matching the full chart’s overflow behavior

## Event And Refresh Integration

### Existing refresh path to reuse

The current design already has the right repaint mechanism:

- `linkToSection(...)` calls `getSong().gotoSection(idx)`
- song and UI events already trigger `updatePrintSections()`
- `updatePrintSections()` can rebuild all chart-related tabs together

So the new tab should update correctly when:

- transport advances to a different Section
- the user clicks a bar in `Chart`
- the user clicks a bar in `Line`
- the user changes `Chart Options > Show Next Line`

### Why no separate event bus feature should be needed

The sprint description says the view should “follow transport navigation via events,” but the current chart system already refreshes from central song/UI updates. Unless testing proves otherwise, the least risky path is to hook the new tab into that existing redraw cycle instead of introducing a new event family.

## Files To Touch

### Definitely

- `index.html`
- `infinite-neck.js`
- `section-printer.js`
- `section-printer.css`
- `SongPersistence.js`
- `bin/song-file-schema.js`
- `_tests/jest/chart-layout.test.js`

### Possibly

- `Constants.js`

Only if a dedicated chart-option constant set is introduced. This sprint does not require it, but adding one could make option names less stringly-typed if the chart-options surface continues to grow.

## Testing Plan

Extend `_tests/jest/chart-layout.test.js` with focused coverage for:

1. `printChartOptions()` renders `Show Next Line` with default unchecked state
2. `printLeadSheetLine()` renders only the current line when `showNextLine` is false
3. `printLeadSheetLine()` renders current and next lines when `showNextLine` is true
4. `printLeadSheetLine()` renders a placeholder second-line container when there is no next line
5. current Section highlighting applies to the current Section’s rendered LeadSheet bars
6. clicking semantics remain represented by `data-action='linkToSection'`
7. the line view stays aligned with LeadSheet grouping, including Sections expanded by `beatsPerBar`

If a helper is extracted for building chart lines, unit-level tests against that helper would also be worthwhile, because the new sprint depends on line identity being correct.

## Risks And Edge Cases

### Risk: duplicated chart grouping logic

If `LeadSheetLine` computes lines separately from `printChart()`, the two views can drift on:

- implicit HEAD behavior
- LINE boundaries
- LeadSheet repeated bars
- caption line accumulation rules

This is the main architectural risk in the sprint and is the strongest reason to extract shared grouping helpers first.

### Risk: current Section spans multiple rendered bars

LeadSheet mode can expand one Section into several bars. The implementation needs a deliberate rule for current-section highlighting, otherwise the user may only see part of the active Section highlighted.

### Risk: hidden dependency on active bar style

The design defines `LeadSheetLine` as being like LeadSheet. The plan should assume the `Line` tab always renders with LeadSheet visuals regardless of the `Chart Options > Bar Style` value, unless the product decision is that the tab should disappear or degrade when bar style is not `LeadSheet`.

That is one of the key open questions below.

## Open Questions

1. Should `Line` always render in LeadSheet form regardless of `Chart Options > Bar Style`, or should it only be meaningful when `barClass === 'LeadSheet'`?

2. Should `Show Next Line` be persisted in `Song.chartOptions` like the other chart options, or is it intended to be a transient UI-only setting?

3. When the current Section expands into multiple LeadSheet bars, should all of those bars receive the current-section background color, or only the first bar?

4. If the user is currently on a Section whose line is inside an `INTRO`, `HEAD`, or `OUTRO` block boundary, should the `Line` tab also show the surrounding block title text, or should it show only raw line rows with no titles?

5. Should captions be shown in the `Line` tab exactly as they appear in `Chart`, including inline and below-line caption behavior, or should the line view suppress captions to stay compact?

6. The sprint summary says this feature “may take over its div and hide tab controls” or “may become available as a widget,” while the iteration design says it lives in a new tab after `Chart`. For sprint 118 iteration 1, should implementation be limited to the new tab only, with no widget work yet?

7. If `Chart Options > Bar Style` is not `LeadSheet`, should the `Line` tab:
	 - still render using LeadSheetLine rules,
	 - render a simplified non-LeadSheet single-line chart view,
	 - or display a message that the tab is intended for LeadSheet mode?

## Recommended Decision Before Coding

The cleanest product interpretation is:

- `Line` is tab-only for this sprint
- `Show Next Line` is persisted in `Song.chartOptions` with default `false`
- `Line` always uses LeadSheet visuals, independent of the main `Chart` bar-style select
- all bars belonging to the current Section are highlighted
- the `Line` tab omits block titles and focuses only on the one or two rendered lines
- caption behavior is suppressed in the `Line` tab

That yields a small, coherent iteration and keeps the later “widget” sprint separate.
