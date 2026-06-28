# sprint-136-chart-input

## Iteration 1 Draft Implementation Plan

Date: 2026-06-28
Sprint: 136 chart-input
Inputs:
- [136-design.md](136-design.md)
- [index.html](../../../../index.html)
- [infinite-neck.js](../../../../infinite-neck.js)
- [dockable.js](../../../../dockable.js)
- [Constants.js](../../../../Constants.js)
- [tonalPicker-functions.js](../../../../tonalPicker-functions.js)
- [plugins/chart/chart-tonal-resolver.js](../../../../plugins/chart/chart-tonal-resolver.js)

## Iteration 1 objective

Implement a first working Chart Input panel that can be used either docked in the Chart tab set or floated as a dockable tool window. The panel lets the user type or cycle chart chord and chart mode suggestions, accepts values into the current `Section.chartChord` and `Section.chartMode`, and refreshes the existing Chart, Section status, and Tonal-driven consumers through the current section update path.

## Scope for Iteration 1

In scope:
1. Add a new Chart tab page named `Input` between `Summary` and `Notes`.
2. Render a reusable Chart Input DOM block with:
	- a suggestions display area
	- one-line `chord:` input
	- one-line `mode:` input
	- a float button using the existing dockable window mechanism
3. Build chord suggestions from Tonal `ChordType.symbols().sort()` plus key/root prefixes from `Constants.NOTE_NAMES_ARRAY` and `Constants.NOTE_NAMES_ARRAY_SHARPS`.
4. Build mode suggestions from `Constants.FILL_SCALE_OPTIONS` plus key/root prefixes from the same note-name arrays.
5. Support filtering after the first non-key specifier is typed; empty input shows no suggestions.
6. Support `SPACE` to cycle the current suggestion, `ENTER` to accept the current suggestion into the focused input, and `TAB` to move between the two inputs using normal browser focus behavior.
7. Support `SHIFT+SPACE` as a literal space in the focused input.
8. Support input-local section navigation keys:
	- `,` previous section
	- `.` next section
	- `<` first section
	- `>` last section
9. On section navigation or external section change, replace input values from the new current section's `chartChord` and `chartMode` and refresh suggestions if visible/floated.
10. Add focused Jest coverage for the pure suggestion/filtering/state helpers and lightweight event-command routing where practical.

Out of scope for Iteration 1:
1. Persisting float placement or Chart Input visibility in the song file.
2. Replacing the existing Tonal Picker UI.
3. A full redesign of Chart tab layout or the dockable framework.
4. Browser/JSDom-heavy acceptance tests; manual UI acceptance remains the main validation for focus, float, and keyboard behavior.
5. Legacy compatibility for older song formats beyond existing `chartChord` / `chartMode` behavior.

## Current state summary

1. [index.html](../../../../index.html#L1202-L1234) defines Chart tabs for `Summary`, `Notes`, `Details`, `Options`, `Chart`, and `Line`; no `Input` tab exists yet.
2. [infinite-neck.js](../../../../infinite-neck.js#L2534-L2577) owns `showChartTab(...)` and toggles Chart tab buttons/panels.
3. [infinite-neck.js](../../../../infinite-neck.js#L1867-L1874) repopulates Chart tab HTML in `updatePrintSections()`.
4. [infinite-neck.js](../../../../infinite-neck.js#L2023-L2040) already provides `linkToSectionChartChord(...)` and `linkToSectionChartMode(...)`, including canonicalization and `sectionChanged()` emission.
5. [tonalPicker-functions.js](../../../../tonalPicker-functions.js#L147-L155) wraps chart writes through `writeTonalValueToChart(...)`, but Chart Input can call the lower-level link functions directly if table writes are not desired.
6. [plugins/chart/chart-tonal-resolver.js](../../../../plugins/chart/chart-tonal-resolver.js#L118-L153) already canonicalizes chord/mode input for storage using Tonal and the current section root.
7. [Constants.js](../../../../Constants.js#L60-L61) contains flat and sharp note names; [Constants.js](../../../../Constants.js#L85-L106) contains the mode list source.
8. [dockable.js](../../../../dockable.js#L133-L253) can float/dock an existing div by id and is exposed globally for inline or delegated UI use.
9. [transport-controller.js](../../../../transport-controller.js#L156-L194) provides section navigation semantics, but `infinite-neck.js` also exposes the current app state/update paths needed by UI code.

## Proposed implementation design

### 1) New module: `ChartInput.js`

Create [ChartInput.js](../../../../ChartInput.js) as a small ES module with pure helpers plus a DOM adapter.

Core exports:
1. `buildChartInputHtml(state)`
	- Returns the Chart Input block markup for insertion into `#divChartInputTab`.
	- Uses stable ids/classes, for example `divChartInput`, `chartInputSuggestions`, `txtChartInputChord`, `txtChartInputMode`, and `btnFloatChartInput`.
2. `createChartInputController(deps)`
	- Accepts dependencies for `getSong`, `getSectionsCurrentIndex`, `linkToSectionChartChord`, `linkToSectionChartMode`, and navigation actions.
	- Binds namespaced delegated events and exposes `refreshFromSection()`.
3. Pure helper functions:
	- `buildChordSuggestionCatalog({ chordTypes, noteNamesFlat, noteNamesSharp })`
	- `buildModeSuggestionCatalog({ modeOptions, noteNamesFlat, noteNamesSharp })`
	- `parseChartInputQuery(rawValue, kind)`
	- `filterChartInputSuggestions(rawValue, catalog, kind)`
	- `cycleSuggestion(currentIndex, suggestions)`
	- `formatSuggestionColumns(suggestions, currentIndex, options)`
	- `resolveAcceptedSuggestion(rawValue, suggestions, currentIndex)`

Design notes:
1. Keep filtering and cycling testable without DOM.
2. Keep DOM/event binding thin and namespaced, following existing binding style in [infinite-neck.js](../../../../infinite-neck.js#L2680-L2764).
3. Use existing storage canonicalization by routing accepts through `linkToSectionChartChord(...)` / `linkToSectionChartMode(...)` rather than duplicating canonicalization in this module.

### 2) Suggestion catalog rules

Chord catalog:
1. Source suffixes from Tonal `ChordType.symbols().sort()`.
2. Compose keyed entries from each accepted key name plus each chord suffix.
3. Include both flat and sharp key spellings so `C#m7` and `Dbm7` can both be typed/accepted.
4. Treat bare major suffix carefully:
	- Tonal suffix `M` produces entries such as `CM` and `DbM` unless Design prefers bare roots such as `C` and `Db`.
	- This is an open design question below.

Mode catalog:
1. Source mode type values from `Constants.FILL_SCALE_OPTIONS.map(option => option.value)`.
2. Exclude the empty `none` option from suggestions unless Design wants a visible clear option.
3. Compose keyed entries as `${key} ${mode}`.
4. Support compact matching so `Cminorpentatonic` filters/accepts `C minor pentatonic`.

Filtering:
1. Empty input: no suggestions.
2. If text begins with a valid note name, use the remainder as the first non-key specifier.
3. If only a note name has been typed and no chord/mode specifier exists yet, keep the suggestions empty per design.
4. Match case-insensitively against a compact comparison key that removes whitespace, while preserving display/storage text from the catalog.
5. Rank exact prefix matches before contains/fuzzy compact matches. Keep source sort stable inside a rank.

### 3) Suggestion display layout

Render the suggestions area as a small column-wrapped list:
1. Default to five items per column.
2. If the list would require more than five columns, compute `itemsPerColumn = Math.ceil(totalItems / 5)`.
3. Mark the current suggestion with a class such as `chartInputSuggestion--current`.
4. Current suggestion style:
	- black background
	- cyan bold text
5. Non-current suggestions:
	- white/list background
	- black normal text
6. Escape rendered suggestion text.

### 4) Keyboard behavior

For `.chartInputField` keydown:
1. `Space` without shift:
	- prevent default
	- if suggestions are available, cycle current suggestion
	- if suggestions are not available, leave value unchanged
2. `Shift+Space`:
	- allow normal literal-space entry
3. `Enter`:
	- prevent default
	- if a current suggestion exists, set focused input value to that suggestion
	- write accepted value to the current section via the correct link function
	- keep focus in the same input
	- refresh the suggestion list
4. `Tab`:
	- do not intercept; browser moves between chord and mode inputs
5. `,`, `.`, `<`, `>`:
	- prevent default
	- dispatch the matching navigation action
	- after section update, refresh both inputs from the new current section

For input events:
1. Re-filter suggestions as the user types.
2. When suggestions first appear, set current index to `0`.
3. If the input becomes empty, clear suggestions and current index.

For blur/change:
1. Iteration 1 should not auto-write arbitrary typed text on blur.
2. Only `ENTER` acceptance writes to the section.
3. This is an explicit assumption to confirm with Design.

### 5) Chart tab integration

Edits in [index.html](../../../../index.html):
1. Add `Input` button after `Summary` and before `Notes`.
2. Add `#divChartInputTab` after `#divChartSummaryTab` and before `#divChartNotesTab`.

Edits in [infinite-neck.js](../../../../infinite-neck.js):
1. Import/init `ChartInput.js`.
2. Extend `updatePrintSections()` to render or refresh the Chart Input panel.
3. Extend `showChartTab(...)` with the new `Input` case.
4. Add a click binding for `#btnChartInputTab`.
5. Ensure `sectionChanged()` or `syncSectionUi()` refreshes Chart Input from the current section even when the panel is currently floated.

### 6) Float/dock integration

Preferred Iteration 1 approach:
1. Render one canonical `#divChartInput` element inside `#divChartInputTab`.
2. Add a `Float` button that calls `makeDivDockable('divChartInput')` or delegates to the exported function.
3. Let `dockable.js` restore the panel to the original tab position when pinned/docked.
4. Do not create a second floating copy; move the same DOM node so input state/focus are single-source.

Important implementation detail:
1. Avoid replacing `#divChartInput` wholesale during `updatePrintSections()` if it is floated, because `dockable.js` stores the original node and parent.
2. Prefer `ensureChartInputPanel()` plus `refreshFromSection()` over blind `.html(...)` replacement once the controller is initialized.

### 7) Navigation integration

Implementation options:
1. Use the existing transport controller instance if it is accessible from `infinite-neck.js` in the Chart Input dependency set.
2. Otherwise, expose small wrappers from `infinite-neck.js` for first/prev/next/last section navigation that call the same state-only navigation plus replay/update path as transport actions.

The implementation should not duplicate the transport replay logic inside `ChartInput.js`; navigation should stay in app-level code.

### 8) Styling

Add targeted styles to [infinite-neck.css](../../../../infinite-neck.css), or a small new [chart-input.css](../../../../chart-input.css) if Design prefers isolation.

Suggested classes:
1. `.chartInputPanel`
2. `.chartInputSuggestionList`
3. `.chartInputSuggestionColumn`
4. `.chartInputSuggestion`
5. `.chartInputSuggestion--current`
6. `.chartInputRow`
7. `.chartInputField`

Keep visual language close to current tab panels: compact controls, readable suggestions, no broad changes to Chart tab styling.

## Detailed work plan

### Phase 1: Pure suggestion engine

1. Create [ChartInput.js](../../../../ChartInput.js) with catalog, parse, filter, cycle, accept, and list-format helpers.
2. Import `Constants` and Tonal `ChordType` using the same browser/global fallback style already used by chart Tonal utilities if needed.
3. Add unit tests in [_tests/jest/chart-input.test.js](../../../../_tests/jest/chart-input.test.js) for:
	- empty input returns no suggestions
	- `Cmi` finds minor-family chords/modes as applicable
	- `Cminorpentatonic` finds `C minor pentatonic`
	- sharp and flat roots both work
	- `SPACE` cycling wraps after the last suggestion
	- column sizing uses five rows unless more than five columns would be needed

### Phase 2: DOM shell and Chart tab

1. Add `Input` tab button and panel in [index.html](../../../../index.html).
2. Extend `showChartTab(...)` in [infinite-neck.js](../../../../infinite-neck.js).
3. Add Chart Input rendering/initialization in the existing `updatePrintSections()` or startup path.
4. Ensure the first render populates inputs from the current section.

### Phase 3: Acceptance writes and refresh

1. On `ENTER`, write the accepted chord via `linkToSectionChartChord(currentIndex, value)` or mode via `linkToSectionChartMode(currentIndex, value)`.
2. Rely on existing `sectionChanged()` to refresh Chart, Section status, Tonal-related state, and plugin menus.
3. After the write, keep focus in the active input and restore caret/value in a predictable way.
4. Preserve the current suggestion list if useful after canonicalization; otherwise re-filter from the accepted value.

### Phase 4: Navigation keys

1. Add `,`, `.`, `<`, `>` handling only for the Chart Input fields.
2. Route through app-level navigation wrappers.
3. Refresh inputs from the new current section after navigation.
4. Verify global shortcuts are not triggered from these inputs.

### Phase 5: Float support

1. Add `Float` control to the panel.
2. Use `makeDivDockable('divChartInput')` for floating.
3. Verify docking returns to the Chart Input tab.
4. Verify section changes while floated update the same panel.

### Phase 6: Manual UI acceptance

1. Open Chart > Input and verify inputs reflect current section values.
2. Type a note plus chord/mode prefix and verify suggestions appear with first item current.
3. Press `SPACE` repeatedly and verify wraparound.
4. Press `ENTER` and verify current suggestion writes to the section and updates Chart/Summary/Line/Tonal consumers.
5. Press `SHIFT+SPACE` in the mode input and verify literal spaces remain possible.
6. Use `,`, `.`, `<`, `>` and verify section navigation and value refresh.
7. Float the panel, navigate sections, write values, and dock it again.

## Acceptance criteria

1. Chart tab group includes `Input` between `Summary` and `Notes`.
2. Chart Input shows two one-line fields labelled `chord:` and `mode:` on the same row.
3. Suggestions area is empty when the focused input is empty or only contains a key/root with no non-key specifier.
4. Typing a non-key specifier shows filtered suggestions and marks the first suggestion current.
5. `SPACE` cycles suggestions without inserting a space.
6. `SHIFT+SPACE` inserts a literal space.
7. `ENTER` accepts the current suggestion into the focused input, writes to the current section, and keeps focus in that input.
8. Accepted values persist into `Section.chartChord` / `Section.chartMode` and trigger the normal section update flow.
9. `,`, `.`, `<`, `>` navigate sections from inside either input and refresh field values from the destination section.
10. The panel can be floated and docked using the existing dockable window behavior.
11. Jest helper tests pass.

## Test plan

Primary focused tests:
1. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/chart-input.test.js --verbose --runInBand`

Pre-checkin test:
1. `export INFINITE_NECK_VERBOSE=-1`
2. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`

Manual acceptance remains required for keyboard focus, float/dock, and browser event ordering.

## Risks and mitigations

Risk 1: Blindly replacing Chart Input HTML breaks a floated panel.
1. Mitigation: initialize once and refresh values/suggestions in place.

Risk 2: `SPACE` interception conflicts with text entry for modes containing spaces.
1. Mitigation: reserve plain `SPACE` for cycling and explicitly allow `SHIFT+SPACE` for literal spaces, as designed.

Risk 3: Suggestion catalog becomes too large or noisy.
1. Mitigation: do not show anything until a non-key specifier is typed; cap visual layout through column wrapping rather than truncating unless Design later requests truncation.

Risk 4: Chord root parsing ambiguity between single-letter roots and sharp/flat roots.
1. Mitigation: parse longest valid key names first, including sharp/flat arrays.

Risk 5: Navigation from input fields bypasses existing transport side effects.
1. Mitigation: route through app-level transport/navigation wrappers rather than implementing navigation inside `ChartInput.js`.

Risk 6: Canonicalized stored value differs from accepted display text.
1. Mitigation: treat canonicalization as source-of-truth after write and refresh the input from the section after `sectionChanged()`.

## Questions for Design team

1. Should accepting typed text with `ENTER` require a highlighted suggestion, or should arbitrary typed chord/mode text be accepted when no suggestion matches?
2. Should major chords display/store as bare roots (`C`, `Db`) or explicit Tonal major symbols (`CM`, `DbM`) when the Tonal suffix is `M`?
3. Should the suggestions include an explicit `none` / clear item for chord and mode, or is clearing the input and pressing `ENTER` expected to clear the section value?
4. When a suggestion is accepted, should the input show the raw selected text or the canonicalized stored text after `linkToSectionChartChord(...)` / `linkToSectionChartMode(...)` runs?
5. If the user edits text but navigates away without `ENTER`, should those edits always be discarded as specified, or should there be a dirty-state warning?
6. Should a click on a suggestion accept it, cycle to it, or do nothing in Iteration 1?
7. Should `SPACE` cycle suggestions even when the suggestion list is empty, or should it be ignored until suggestions exist?
8. Should filtering match only prefixes, or should compact contains/fuzzy matches be allowed after prefix matches?
9. Should mode filtering allow mode-only text such as `minor pentatonic` without a key, then accept by applying the current section root?
10. Should chord filtering allow suffix-only text such as `m7` without a key, then accept by applying the current section root?
11. Should the current section's root preference determine whether suggestions initially prefer flat or sharp spellings, while still accepting both?
12. Should the new `Input` tab be the default visible tab when clicking top-level `Chart`, or should `Summary` remain the default?
13. Should the floated Chart Input window have a custom title/handle text beyond the generic dockable handle?
14. Should the panel have an explicit `Dock`/`Float` button label in addition to the existing dockable pin icon?
15. Should section navigation keys `,`, `.`, `<`, `>` also accept pending input before navigating, or always discard pending edits as the current design says?

## Recommended delivery order

1. Confirm open Design questions that affect storage/acceptance semantics: questions 1 through 5 and 9 through 11.
2. Implement/test pure suggestion helpers.
3. Add Chart tab shell and styling.
4. Wire acceptance writes through existing section link functions.
5. Wire section navigation keys.
6. Add float/dock control and verify the single-DOM-node approach.
7. Run focused Jest and manual UI acceptance.

## Definition of done

1. Chart > Input exists and can be used docked or floated.
2. `Section.chartChord` and `Section.chartMode` are updated only through explicit acceptance behavior agreed by Design.
3. Section update flow refreshes Chart, Section status, and Tonal consumers after accepted writes and navigation.
4. Pure suggestion helper tests pass.
5. Manual acceptance for keyboard behavior and float/dock behavior is complete.
