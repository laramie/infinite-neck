# Iteration 4 Implementation Plan

## Feature

FillPlugin should gain a dynamic `use chart` submenu under `/fpfo` so the user can ask Fill to adopt the current Section's `chartChord` or `chartMode`.

Requested visible shape:

```text
/fpfo
	u) use chart
	c) chord
	m) mode
	p) positions
	...

/fpfou
	c) chord
	m) mode
```

Behavior summary:

1. `use chart -> chord` reads `currentSection.chartChord`
2. `use chart -> mode` reads `currentSection.chartMode`
3. each action tries to select the matching Fill option
4. on success, the action pops back to `/fpfo`
5. on miss, it also pops back to `/fpfo`, leaves the current Fill property unchanged, and reports an informative action result message

## Scope

This plan covers only Iteration 4 of sprint 120.

It does not propose code changes yet.

It does not change TonalPicker itself, chart rendering, or the underlying Fill note-generation algorithm beyond selecting existing Fill options.

It does not attempt to make Fill continuously follow chart values during replay. This iteration is menu-driven selection only.

## Viability

This is viable and should be a modest FillPlugin change.

It is not a one-line property edit, because the current select-menu infrastructure in [plugins/PluginProperty.js](plugins/PluginProperty.js#L119) only renders static option rows from property metadata. The requested `use chart` rows are action items that need to sit alongside the existing property-driven menu under `/fpfo`.

So the change is small-to-moderate for three reasons:

1. `/fpfo` is already built dynamically in [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js#L391), so adding a custom submenu there is mechanically easy
2. the real work is string normalization from section chart values to Fill option captions
3. miss handling should be made informative enough to help tune [Constants.js](Constants.js) as real-world chart values are encountered

The design choice to avoid changing the generic property menu machinery is good. It keeps this iteration localized to FillPlugin.

## Current Behavior Summary

Today FillPlugin does this:

1. stores Fill chord selection in property `chordFormula`
2. stores Fill mode selection in property `scaleFormula`
3. fills note sets by parsing those selected interval formulas in [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js#L889)
4. renders `/fpfo` partly from properties and partly from custom menu nodes in [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js#L391)

The current section chart values are separate section-level strings:

- `section.chartChord`
- `section.chartMode`

Those are written by TonalPicker via [tonalPicker.js](tonalPicker.js#L458) and persisted in the section model.

Important architectural point:

FillPlugin does not currently understand chart strings directly. It only understands its own normalized option set from [Constants.js](Constants.js#L65) and [Constants.js](Constants.js#L83).

So this iteration is fundamentally a mapping feature:

- chart string -> Fill option

not a new Fill-generation mode.

## Proposed Behavior

## New Dynamic Menu Node

Add a new custom submenu node under `/fpfo`:

- name: `useChart`
- caption: `use chart`
- trigger: `u`

Children:

- `c) chord`
- `m) mode`

Both children should be action nodes, not select-property rows.

Recommended action names:

- `useChartChord`
- `useChartMode`

Placement in `/fpfo` should match the approved structure and come before the regular `chord` and `mode` select menus.

## Success Behavior

### `use chart -> chord`

1. read `currentSection.chartChord`
2. normalize it into a Fill chord-type candidate
3. find the matching Fill chord option in `Constants.FILL_CHORD_OPTIONS`
4. set `chordFormula` to that option's `value`
5. return an action result message describing the selected match
6. pop back to `/fpfo`

### `use chart -> mode`

1. read `currentSection.chartMode`
2. normalize it into a Fill mode candidate
3. find the matching Fill mode option in `Constants.FILL_SCALE_OPTIONS`
4. set `scaleFormula` to that option's `value`
5. return an action result message describing the selected match
6. pop back to `/fpfo`

## Miss Behavior

On miss, do not throw, do not block, and do not alter the current Fill property value.

Return an action result string that includes enough diagnostic information to improve [Constants.js](Constants.js) manually.

Recommended miss message shape:

### chord miss

```text
Fill use chart chord: no match for chartChord="FMadd9/A" normalized="Madd9" against [M, m, aug, dim, dim7, m7b5, sus2, sus4, maj7, s m7, 7 (dom7), 7no5, m/ma7, m9, 6add9]
```

### mode miss

```text
Fill use chart mode: no match for chartMode="C major" normalized="major" against [major (Ionian), dorian, phrygian, lydian, mixolydian, minor (Aeolian/Natural), locrian, ...]
```

This meets the user's stated need: enough information to refine the Fill option list or matching aliases by hand as testing proceeds.

## Recommended Matching Strategy

## Chord Matching

Chart chords are full chord symbols such as:

- `Cmaj7`
- `G7`
- `FMadd9/A`
- `Amb6b9`

Fill chord options are chord-type labels only, such as:

- `maj7`
- `7 (dom7)`
- `6add9`
- `m9`

So direct string equality is not sufficient.

Recommended normalization pipeline:

1. read raw `chartChord`
2. trim whitespace
3. if empty, treat as a no-op miss
4. strip slash bass / inversion suffix by splitting on `/` and keeping the left side
5. remove the tonic/root note prefix from the remaining symbol
6. keep only the chord-type suffix
7. compare that normalized suffix against a list of accepted aliases for each Fill chord option

Examples:

- `Cmaj7` -> `maj7`
- `G7` -> `7`
- `FMadd9/A` -> `Madd9`
- `Am` -> `m`
- `Fm7` -> `m7`

### Alias table recommendation

Do not rely on the visible Fill captions alone.

Instead, create a small Fill-local alias map keyed by property value or canonical Fill caption. For example:

- `4,7` -> `M`, `maj`
- `3,7` -> `m`, `min`
- `4,7,11` -> `maj7`, `M7`, `Maj7`
- `3,7,10` -> `m7`, `min7`
- `4,7,10` -> `7`, `dom`, `dom7`
- `4,7,9,14` -> `6add9`, `6/9`, `69`, `Madd9` only if product wants that equivalence

This isolates match logic from the exact visible captions in [Constants.js](Constants.js#L65).

### Tonal helper recommendation

If practical, use Tonal tokenization semantics to split root from chord type rather than hand-parsing every accidental case.

That would reduce brittle logic around:

- sharps / flats
- roots like `Bb`, `F#`, `Db`
- remaining suffix extraction after the root

But this should be used only as a parser aid. The final accepted mapping should still go through FillPlugin's own alias map, because Fill supports a limited curated subset.

## Mode Matching

Chart modes are section strings like:

- `C major`
- `A minor`
- `G mixolydian`
- `A phrygian`

Fill mode options are mode-type labels only, such as:

- `major (Ionian)`
- `minor (Aeolian/Natural)`
- `mixolydian`
- `phrygian`

Recommended normalization pipeline:

1. read raw `chartMode`
2. trim whitespace
3. if empty, treat as a no-op miss
4. remove the tonic/root prefix, leaving just the mode name
5. lowercase and normalize spacing
6. match against a small alias map for Fill modes

Examples:

- `C major` -> `major`
- `A minor` -> `minor`
- `G mixolydian` -> `mixolydian`
- `A phrygian` -> `phrygian`

Alias examples:

- `major` -> `major (Ionian)`
- `ionian` -> `major (Ionian)`
- `minor` -> `minor (Aeolian/Natural)`
- `aeolian` -> `minor (Aeolian/Natural)`
- exact matches for `dorian`, `phrygian`, `lydian`, `mixolydian`, `locrian`

This path is simpler than chord matching.

## Minimal Implementation Shape

## 1. Add a custom `use chart` submenu under `/fpfo`

File:

- [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)

Add a helper like:

- `buildUseChartMenuNode(song)`

Children:

- `buildUseChartActionNode('chord', 'useChartChord', 'c')`
- `buildUseChartActionNode('mode', 'useChartMode', 'm')`

Insert it into `buildOptionsMenuNode(...)` before the regular chord/mode property nodes.

## 2. Add action handlers for chart adoption

File:

- [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)

Extend `invokeAction(...)` with:

- `useChartChord`
- `useChartMode`

Each should:

1. read the current section
2. normalize the chart value
3. resolve a Fill option match
4. set the corresponding Fill property on success
5. return a descriptive action result either way

## 3. Add Fill-local normalization helpers

Recommended helper names:

- `getCurrentSection(song)` if no existing helper is suitable
- `normalizeChartChord(rawChord)`
- `normalizeChartMode(rawMode)`
- `matchChartChordToFillOption(normalizedChord)`
- `matchChartModeToFillOption(normalizedMode)`
- `buildChartMissMessage(kind, rawValue, normalizedValue, candidates)`

The helpers should live inside FillPlugin, not in TonalPicker.

Reasoning:

1. this behavior is Fill-specific
2. TonalPicker writes the section model and should not learn Fill's curated subset rules
3. keeping the mapping local avoids coupling chart UI to plugin semantics

## 4. Preserve existing Fill application behavior

No changes are needed in:

- role selection
- note placement
- family menus
- section application logic

This iteration should only change how the user can select the existing `chordFormula` and `scaleFormula` values.

## File Touch Points

Expected code changes:

- [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)
- [_tests/jest/fill-plugin.test.js](_tests/jest/fill-plugin.test.js)

Likely doc updates:

- [help-plugins.html](help-plugins.html)

No changes should be required in:

- [tonalPicker.js](tonalPicker.js)
- generic property menu infrastructure
- section persistence

## Test Plan

Add focused FillPlugin tests for:

1. `/fpfo` menu now includes `useChart` before `chord` and `mode`
2. `/fpfou` has exactly `chord` and `mode` actions with triggers `c` and `m`
3. `useChartChord` adopts a direct match such as `Cmaj7` -> `maj7`
4. `useChartChord` adopts `G7` -> dominant Fill entry
5. `useChartChord` strips slash bass before matching, e.g. `FMadd9/A`
6. `useChartMode` adopts `C major` -> `major (Ionian)`
7. `useChartMode` adopts `A minor` -> `minor (Aeolian/Natural)`
8. miss on chord leaves `chordFormula` unchanged and returns the detailed miss message
9. miss on mode leaves `scaleFormula` unchanged and returns the detailed miss message
10. empty chart values return a no-op miss message and leave properties unchanged

## Risks and Non-Goals

## Risks

1. chord aliasing can drift from the curated Fill list if normalization is too permissive
2. slash-chord stripping can hide distinctions the user might care about later, but that is explicitly accepted for this iteration
3. some chart chords may have no meaningful Fill equivalent because Fill intentionally exposes only a subset

## Non-Goals

1. automatic live binding from chart fields into Fill
2. adding every Tonal chord or mode to Fill
3. changing how TonalPicker stores chart values
4. changing Fill to operate directly on chart strings without selecting a Fill option first

## Recommended Miss Message Policy

Because the user specifically wants miss information to improve [Constants.js](Constants.js) manually, I recommend including all of the following in miss results:

1. whether the miss was for chord or mode
2. the raw chart value
3. the normalized value Fill tried to use
4. the current accepted Fill candidate captions or aliases

That is enough to answer:

- did normalization go wrong?
- is the Fill list missing a synonym?
- is the chart value outside the intended Fill subset?

## Clarifying Questions

1. For slash chords such as `FMadd9/A`, should the match be based only on the stripped chord type left of `/`, with the bass always ignored? This is what the design text suggests, but it is the main product rule worth confirming explicitly.

2. For misses, do you want the action result to include only the normalized candidate and current Fill list, or also a short set of likely suggestions when there are close alias matches? The simpler and safer first version is to report raw value, normalized value, and current Fill candidates only.

3. For `chartMode`, is tonic stripping always expected, so `C major` and `A minor` should map to the same Fill entries as plain `major` and `minor`? This appears intended, but it is the core normalization rule.

4. If `chartChord` or `chartMode` is empty, should the message explicitly say `empty chartChord` / `empty chartMode`, or should that be treated as the same silent-style miss as any unmapped value? I recommend an explicit no-op message because it helps testing.

5. For Fill's curated subset, should unmatched but clearly related chart chord types such as `Madd9` be allowed to map to an existing Fill approximation like `6add9`, or should only exact approved aliases be accepted? I recommend exact approved aliases only for the first version, because approximation rules are where surprising behavior creeps in.
