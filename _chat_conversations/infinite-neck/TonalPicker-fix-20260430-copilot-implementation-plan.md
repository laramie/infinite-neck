# Pre-implementation Questions

1. When a user picks a chord or mode from TonalPicker, should the implementation continue to write the section-level values also (`section.chartChord` / `section.chartMode`), or should the picker write only the per-table values (`section.sectionNotesByTable[tableID].chord` / `.mode`)?

   Reason for asking: the request says the per-table values should be stored "in addition to" the section-level values, but the display truth table also explicitly allows these values to differ. That difference matters because it determines whether `pickTonal()` should still call the current section-level link functions, or whether it needs a new table-specific write path and possibly a different section-level update rule.

2. Should `getTonalForTable()` also be extended to return `.chord` and `.mode`, in addition to `getTonal()`?

   Reason for asking: the request text points at `getTonal(theSong, section)`, but all active picker-building call sites currently use `getTonalForTable()`.

3. For the truth-table case where the section-level value is empty and the per-table value is non-empty, should the picker display the per-table value as plain text even when that value is not present in the current Tonal.js detection array?

   My current read is yes, because the table says `value` rather than struck text in that case, but this should be confirmed before implementation.

4. For the AllChords show/hide state, should the state remain shared per `tableID`, or should it become unique per picker instance using `ownerID + tableID + sectionIdx`?

   Reason for asking: the current DOM ids are already unique per picker instance, but `getTonalAllChordsButtonState()` is keyed only by `tableID`. Your note suggests the current scope may be too broad.

5. Please confirm the canonical property names for this fix are:

   - section-level: `chartChord` and `chartMode`
   - per-table SectionNotes: `chord` and `mode`

   I verified that the repo currently uses `chartMode` in live code, while the request text includes a few references to `section.mode`.

# Implementation Plan and code snippets

## Summary

Implement the fix in four small areas:

1. extend tonal result objects so the per-table stored chord and mode travel with the already-computed Tonal data
2. extend TonalPicker argument lists by appending new per-table current-value parameters
3. centralize the picker display logic into one helper that applies the truth table for chords and modes
4. update the pick handler so it writes the per-table values in the correct section/table context, and update the three known call sites to pass those values through

## Code Sections To Change

### 1. TonalFunctions.js

Files/functions:

- `getTonal(theSong, section)`
- `getTonalForTable(theSong, section, tablename)`

Planned change:

- add `result.chord = sn.chord`
- add `result.mode = sn.mode`
- leave the existing tonal detection logic unchanged
- if approved in question 2, make both functions return the same shape so callers do not need two different result contracts

Example shape after change:

```js
result.normalizedNamedNotes = normalizedNamedNotes;
result.chords = chords;
result.scale = filterWesternScales(worldScales);
result.chord = sn.chord;
result.mode = sn.mode;
```

For `getTonal(theSong, section)`, the analogous snippet would use the `sn` already available in that loop.

### 2. tonalPicker.js

Files/functions:

- `buildTonalPicker()`
- `buildTonalPickerSet()`
- `window.pickTonal()`
- `format_allChordsSpan()` / `format_allChords()`
- `getTonalAllChordsButtonState()` / `setTonalAllChordsButtonState()` if question 4 is answered "per picker instance"

Planned change:

- append new parameters at the end of the existing signatures so positional arguments do not shift
- compute display HTML from both the section-level value and the per-table value
- keep the raw chosen value separate from the rendered HTML so the AllChords highlighting still compares raw strings, not `<b>...</b>` / `<s>...</s>` markup
- pass the per-table current values through the generated `pickTonal(...)` links

Proposed signature direction:

```js
export function buildTonalPicker(
	ownerID,
	tableID,
	sectionIdx,
	dest,
	valueArray,
	currentValue,
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

I would not rely on `chartCurrentValue` and `tableCurrentValue` staying current inside the onclick HTML after a click. The safer implementation is:

- use them only for initial render if needed
- on click, write the new model values first
- then compute the new display from the just-written model state

### 3. Display helper in tonalPicker.js

Planned change:

- add one small helper for the truth table and use it for both `chords` and `modes`
- do not refactor unrelated picker rendering

Example helper:

```js
function formatTonalCurrentValue(chartValue, tableValue, valueArray) {
	if (!tableValue) {
		return '&lt;choose&gt;';
	}
	if (!chartValue) {
		return tableValue;
	}
	if (tableValue === chartValue) {
		return valueArray.includes(tableValue)
			? '<b>' + tableValue + '</b>'
			: tableValue;
	}
	return '<s>' + tableValue + '</s>';
}
```

Notes on the helper:

- this matches the provided truth table more closely than the current `valueArray.includes(currentValue)` logic
- the exact behavior for `chartValue === ""` and `tableValue` not in `valueArray` should be confirmed from question 3 before implementation

### 4. Per-table write path

Current write path:

- `pickTonal()` calls `linkToSectionChartChord(sectionIdx, val)` or `linkToSectionChartMode(sectionIdx, val)`
- those functions only update the section-level fields

Planned change options depend on question 1:

Option A, if both section-level and per-table should be updated on picker selection:

- keep the existing section-level update
- add a table-specific write for `section.sectionNotesByTable[tableID].chord` / `.mode`

Option B, if picker selection should only update the per-table value:

- stop calling the section-level link functions from `pickTonal()`
- update only `section.sectionNotesByTable[tableID].chord` / `.mode`
- still trigger the same repaint / section refresh path

Example minimal write path if a new helper is introduced on the infinite-neck side:

```js
export function linkToSectionTableChord(idx, tableID, chord) {
	getSong().sections[idx].sectionNotesByTable[tableID].chord = chord;
	sectionChanged();
}

export function linkToSectionTableMode(idx, tableID, mode) {
	getSong().sections[idx].sectionNotesByTable[tableID].mode = mode;
	sectionChanged();
}
```

If you prefer not to add new exported helpers, the alternative is a direct write inside `pickTonal()` using the current section lookup. That would be smaller in file count, but it pushes data-model mutation into the UI module. I would only do that if you explicitly prefer the smallest possible diff over keeping model writes behind the existing linking layer.

### 5. NoteTableController.js call sites

Files/functions:

- `colorNote()`
- `replayTable()`

Planned change:

- keep the current arguments in place
- append the per-table chord and mode values at the end, sourced from `tonalResult`

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

### 6. section-printer.js call site

Files/functions:

- `printSectionsNotes(theSong, theSections)`

Planned change:

- same appended arguments as in NoteTableController
- use the already-fetched `tonalResult.chord` / `.mode`

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

## Proposed Order Of Implementation

1. update `TonalFunctions.js` result objects first
2. add the display helper and new trailing parameters in `tonalPicker.js`
3. update the three known builder call sites
4. implement the per-table write path in `pickTonal()`
5. if needed, narrow the AllChords state key from `tableID` to a per-picker key
6. verify that vertical and horizontal pickers render the same logical state

## Verification Checklist For The Next Iteration

1. In a section with a non-empty `section.chartChord`, pick the same chord for one table and confirm the picker shows bold text.
2. In a section with a non-empty `section.chartChord`, pick a different chord for one table and confirm the picker shows struck text.
3. In a section with an empty `section.chartChord`, pick a per-table chord and confirm the picker shows plain text, not bold or struck.
4. Repeat the same three checks for mode using `chartMode` and `SectionNotes.mode`.
5. Confirm the AllChords inline list highlights the currently chosen per-table chord correctly after each pick.
6. Confirm the caption-row picker and the section-printer picker agree for the same section/table pair.
7. Confirm changing one table's local value does not render the wrong value in another table's picker for the same section.

# Implementation Notes

- No runtime code was changed in this iteration.
- The repo already has `SectionNotesPersistence.chord` and `SectionNotesPersistence.mode`, so the missing work is propagation and display logic, not persistence structure.
- The live code uses `chartMode`, not `mode`, for the section-level property.
- `getTonal()` is currently used only in `SongHeadless.js` for logging, while the active UI picker code uses `getTonalForTable()`. That is why question 2 matters.
- The smallest likely implementation is still surgical, but I do recommend one dedicated display helper in `tonalPicker.js`; otherwise the truth-table logic will be duplicated between initial render and click updates.

