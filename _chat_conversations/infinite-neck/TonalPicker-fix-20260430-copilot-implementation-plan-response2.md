# Validation Of Your Responses

Your clarifications resolve the main behavioral ambiguity from the first round.

Confirmed requirements now are:

1. Section-level properties are `chartChord` and `chartMode`.
2. Per-table `SectionNotes` properties are `chord` and `mode`.
3. `getTonal()` and `getTonalForTable()` should both return the same expanded shape, including `.chord` and `.mode`.
4. TonalPicker should use one shared helper for the truth-table display logic.
5. AllChords show/hide state should remain shared per `tableID`.
6. On picker selection:
   - always write the selected value to `SectionNotes.chord` or `.mode` for that table
   - if the passed-in section value is empty, also write the section-level chart value
   - if the passed-in section value is not empty, do not overwrite the section-level value
7. Add a new "save to chart" button next to the picker popup button, wired to the existing section-level link functions.

Two codebase observations materially reduce scope:

1. `linkToSectionTableChord(idx, tableID, chord)` already exists in [infinite-neck.js](/home/laramie/infinite-neck/infinite-neck.js#L1081).
2. `linkToSectionTableMode(idx, tableID, mode)` already exists in [infinite-neck.js](/home/laramie/infinite-neck/infinite-neck.js#L1086).

Also, [tonalPicker.js](/home/laramie/infinite-neck/tonalPicker.js) already imports both of those functions. That means the implementation does not need new infinite-neck exports unless we decide to address the double-refresh issue noted below.

One small correction from the request text: the repo function is `linkToSectionTableMode`, not `linkToSectionTableModel`.

# Updated Implementation Plan

## Scope Summary

The implementation now breaks down into five focused changes:

1. extend tonal result objects with per-table stored values
2. pass both section-level and table-level current values into TonalPicker
3. centralize display formatting through one truth-table helper
4. update picker click behavior to write table values first, and write section values only when the passed-in section value is empty
5. add a new save-to-chart button for both chord and mode pickers

## Planned File Changes

### 1. TonalFunctions.js

Files/functions:

- `getTonal(theSong, section)`
- `getTonalForTable(theSong, section, tablename)`

Planned change:

- add `.chord` and `.mode` to each result object
- keep the rest of the tonal detection logic unchanged
- keep the return shape aligned between both functions

Example shape:

```js
result.normalizedNamedNotes = normalizedNamedNotes;
result.chords = chords;
result.scale = filterWesternScales(worldScales);
result.chord = sn.chord;
result.mode = sn.mode;
```

Implementation note:

- this is surgical and low-risk because those values already exist in `SectionNotesPersistence`

### 2. NoteTableController.js

Files/functions:

- `colorNote()`
- `replayTable()`

Planned change:

- append new trailing arguments to `buildTonalPickerSet()`
- pass section-level values first, then table-level values from `tonalResult`

Example call shape:

```js
let tonalPickerSet = buildTonalPickerSet(
	"CaptionRowTonal",
	TonalPickerOrientation.HORIZONTAL,
	res.tableID,
	idx,
	tonalResult.chords,
	theCurrentSection.chartChord,
	tonalResult.scale,
	theCurrentSection.chartMode,
	tonalResult.chord,
	tonalResult.mode
);
```

The same pattern applies in `replayTable()`.

### 3. section-printer.js

Files/functions:

- `printSectionsNotes(theSong, theSections)`

Planned change:

- append the same new trailing arguments to `buildTonalPickerSet()`

Example call shape:

```js
let tonalPickerSet = buildTonalPickerSet(
	"SectionPrinterTonal",
	TonalPickerOrientation.VERTICAL,
	tableID,
	idx,
	tonalResult.chords,
	section.chartChord,
	tonalResult.scale,
	section.chartMode,
	tonalResult.chord,
	tonalResult.mode
);
```

### 4. tonalPicker.js

Files/functions:

- `buildTonalPicker()`
- `buildTonalPickerSet()`
- `window.pickTonal()`
- new helper for truth-table rendering
- new helper for save-to-chart button output
- possibly a small helper for reading the chosen local picker value when save-to-chart is clicked

Planned signature direction:

```js
export function buildTonalPicker(
	ownerID,
	tableID,
	sectionIdx,
	dest,
	valueArray,
	chartCurrentValue,
	tableCurrentValue
)

export function buildTonalPickerSet(
	ownerID,
	orientation,
	tableID,
	sectionIdx,
	chordValueArray,
	chartChordCurrentValue,
	modeValueArray,
	chartModeCurrentValue,
	tableChordCurrentValue,
	tableModeCurrentValue
)
```

Reasoning:

- the section-level value controls whether the display is bold, struck, or plain
- the table-level value is the actual selected local value for that picker
- keeping these distinct removes the current ambiguity where one `currentValue` is doing two jobs

## Truth-Table Display Helper

I recommend one dedicated helper that returns rendered HTML from raw values.

Example:

```js
function formatTonalCurrentValue(chartValue, tableValue) {
	if (!tableValue) {
		return '&lt;choose&gt;';
	}
	if (!chartValue) {
		return tableValue;
	}
	if (tableValue === chartValue) {
		return '<b>' + tableValue + '</b>';
	}
	return '<s>' + tableValue + '</s>';
}
```

This helper should be used in two places:

1. initial TonalPicker render
2. immediate DOM update after a pick, before the next `sectionChanged()` rebuild replaces the markup

Important implementation detail:

- `format_allChords()` must continue to receive the raw current chord value, not the rendered HTML, so the selected chord highlight remains correct

## Updated pickTonal() Behavior

### Target behavior

For a chord pick:

1. hide the list
2. normalize `clear` to `""`
3. write the table-level chord through `linkToSectionTableChord(sectionIdx, tableID, val)`
4. if the passed-in `chartChordCurrentValue` is empty, also write the section-level chord through `linkToSectionChartChord(sectionIdx, val)`
5. update the local DOM display to match the truth table
6. update the AllChords strip using the raw chosen chord value

Mode uses the matching logic with `linkToSectionTableMode()` and `linkToSectionChartMode()`.

### Proposed pickTonal() signature

```js
window.pickTonal = function pickTonal(
	ownerID,
	tableID,
	sectionIdx,
	dest,
	val,
	valueArray,
	chartCurrentValue,
	tableCurrentValue
)
```

### Proposed link generation

Each generated picker link would pass both current values as trailing args:

```js
<a href='javascript:pickTonal(
	"CaptionRowTonal",
	"tblS6_1",
	0,
	"chords",
	"Asus24",
	["Asus24","E7sus4/A","B4/A"],
	"Asus24",
	"Asus24"
);'>
```

That keeps picker code model-free, consistent with your stated architecture.

## Save-To-Chart Button

### Behavior

The new button should:

1. appear next to the existing popup button
2. read the picker's current local value for that row and dest
3. call the matching section-level link function:
   - `linkToSectionChartChord(sectionIdx, value)`
   - `linkToSectionChartMode(sectionIdx, value)`
4. rely on `sectionChanged()` to rebuild all pickers after the chart value changes

### Minimal rendering approach

Add one small helper such as:

```js
function format_saveToChartButton(ownerID, tableID, sectionIdx, dest) {
	return `<button onclick="saveTonalToChart('${ownerID}', '${tableID}', ${sectionIdx}, '${dest}')">save</button>`;
}
```

Then place that button in the picker row next to the existing `${dest}:${valueArray.length}` button.

### Minimal save handler direction

```js
window.saveTonalToChart = function saveTonalToChart(ownerID, tableID, sectionIdx, dest) {
	let rawValue = getCurrentTonalPickerValue(ownerID, tableID, sectionIdx, dest);
	switch (dest) {
		case 'chords':
			linkToSectionChartChord(sectionIdx, rawValue);
			break;
		case 'modes':
			linkToSectionChartMode(sectionIdx, rawValue);
			break;
	}
}
```

Because the span stores formatted HTML rather than raw data, the cleanest minimal implementation is to also store the raw value in a DOM attribute during render and update it on pick. For example:

```js
<span
	class="spanTonal_chords"
	id="spanTonal_CaptionRowTonal-chords-tblS6_1-0"
	data-tonal-raw-value="Asus24"
>...</span>
```

That avoids scraping `<b>` or `<s>` markup back into a raw string.

## AllChords Behavior

Your clarification aligns with the existing state model.

Planned handling:

- keep `window.tonalChordsButtonStates[tableID]`
- do not broaden or narrow its scope
- verify only that `format_allChordsSpan()` and DOM ids continue to use `ownerID + tableID + sectionIdx` so chord lists are rendered into the correct picker instance

## One New Technical Risk

There is one behavior gap introduced by the clarified requirements:

### Double `sectionChanged()` on first pick into an empty chart

Current helpers behave like this:

- `linkToSectionTableChord()` calls `sectionChanged()`
- `linkToSectionChartChord()` also calls `sectionChanged()`

So if a picker selection must write both table and chart values because the chart value is empty, the naïve implementation will trigger two rebuilds back-to-back.

That is not functionally wrong, but it is likely to be redundant and may produce avoidable UI churn.

### Minimal options

Option A: accept the double rebuild for now

- smallest code change
- behavior should still be correct

Option B: add one combined helper per dest in `infinite-neck.js`

```js
export function linkToSectionChartAndTableChord(idx, tableID, chord) {
	getSong().sections[idx].sectionNotesByTable[tableID].chord = chord;
	getSong().sections[idx].chartChord = chord;
	sectionChanged();
}
```

And similarly for mode.

This adds a little code, but keeps one user action to one rebuild. It is not a refactor in the broad sense; it is a targeted way to preserve the existing architecture while avoiding duplicate refresh.

# Recommended Implementation Order

1. update `TonalFunctions.js` result shapes
2. update the three `buildTonalPickerSet()` call sites
3. add the truth-table display helper in `tonalPicker.js`
4. change `buildTonalPicker()` and `buildTonalPickerSet()` to accept both chart and table current values
5. update `pickTonal()` to write table values and conditionally write chart values
6. add `data-tonal-raw-value` support to picker spans
7. add the new save-to-chart button and handler
8. verify AllChords highlighting still uses the raw chosen chord value

# Verification Checklist

1. Pick a chord when `section.chartChord` is empty:
   - table `SectionNotes.chord` is written
   - `section.chartChord` is written
   - picker display becomes bold because local and chart values now match after rebuild

2. Pick a second chord in another table after the chart chord is already set:
   - second table `SectionNotes.chord` is written
   - `section.chartChord` is not overwritten
   - second picker display is struck if different from chart, bold if same

3. Repeat those checks for mode.

4. Click save-to-chart from a picker whose local value differs from the chart:
   - section-level chart value updates
   - all pickers rebuild
   - matching local picker becomes bold after rebuild

5. Click save-to-chart when the local value is empty:
   - confirm intended behavior once answered in the questions below

6. Toggle AllChords visibility for one `tableID` and confirm the state remains shared across all instances for that table.

# Remaining Questions

These are the only issues I still see that need confirmation before implementation.

1. For the new save-to-chart button, what should happen when the local table value is empty?

   My default recommendation is: allow it, so clicking save writes `""` to `chartChord` or `chartMode`, because that is the most literal and minimal behavior.

2. What button label do you want for the new control?

   My default recommendation is plain text `save`, since it is minimal and clear.

3. Is the double `sectionChanged()` on a first pick into an empty chart acceptable for this sprint, or do you want the one-refresh combined helper approach?

   My default recommendation is the combined helper approach, because it is still surgical and avoids needless duplicate rebuilds.

4. Should the save-to-chart button always be visible, or should it only appear when the local table value is non-empty and differs from the chart value?

   My default recommendation is always visible. That is simpler, avoids conditional UI logic, and matches your request to output the new button in both contexts.

# Implementation Notes

- No runtime files were changed in this iteration.
- The new plan is narrower than the first-round plan because the table-level link functions already exist.
- The raw-value DOM attribute is the smallest reliable way to support save-to-chart without reaching into the model from picker code.
- The core architectural constraint remains intact: TonalPicker receives state through arguments and updates state through exported link functions.
