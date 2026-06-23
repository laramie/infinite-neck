# 133 Iteration 5 Analysis: Tonal.js naming divergence in Chart, Fill, and Arpeggio

Date: 2026-06-22
Sprint: 133 name-that-note
Input:
- [133-it5-design.md](_doco/design/sprints/133-name-that-note/133-it5-design.md)

## Goal of this analysis

Analyze where current code paths diverge from Tonal.js naming and behavior, and explain how that creates split handling for Chart values used by Fill and Arpeggio auto modes.

No implementation changes are proposed here yet.

## Executive summary

Current behavior has two different source-of-truth systems:

1. Tonal.js-driven strings from Tonal suggestion flows (for example values coming from Chord.detect and Scale.detect via Tonal picker).
2. Local interval-formula plus alias tables used by Fill and Arpeggio auto chart parsing.

This split is the reason a user-selected Tonal chart value can be valid in Chart/TonalPicker but fail in Fill or Arpeggio auto parsing.

Concrete example:
- A Tonal-detected chord like CM7sus4 can be written into Section.chartChord.
- Arpeggio auto chord currently normalizes and attempts lookup only against the local alias table subset.
- Since M7sus4 is not in that subset, no match is found, yielding an empty candidate set.

## Where Tonal.js is the source-of-truth today

1. Tonal suggestion generation:
- [TonalFunctions.js](TonalFunctions.js)
- [tonalPicker-functions.js](tonalPicker-functions.js)
- [plugins/tonal/TonalPlugin.js](plugins/tonal/TonalPlugin.js)

Details:
- getTonalForTable uses Chord.detect and Scale.detect to generate suggestions.
- TonalPlugin and tonalPicker-functions write selected values directly into Section.chartChord and Section.chartMode.

2. Chart display normalization:
- [section-printer.js](section-printer.js)

Details:
- formatChordWithoutRoot uses Chord.get.
- mode label display uses Mode.name fallback to Mode.get and Scale.get.

## Where local alias/formula tables are the source-of-truth today

1. Fill formula options and captions:
- [Constants.js](Constants.js)

Details:
- FILL_CHORD_OPTIONS and FILL_SCALE_OPTIONS are interval formulas plus UI captions/triggers.
- These include user-facing aliases and naming variants that are not always Tonal canonical strings.

2. Shared chart alias matching layer:
- [plugins/chart/chart-aliases.js](plugins/chart/chart-aliases.js)

Details:
- CHART_CHORD_ALIASES and CHART_MODE_ALIASES map normalized strings to formula values.
- Matching is subset-based and intentionally curated.

3. Fill auto chart parsing:
- [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)

Details:
- useChartChordForSection and useChartModeForSection normalize chart text and match against local option arrays.
- If not matched, Fill returns a miss message.

4. Arpeggio auto chart parsing:
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Details:
- collectAutoChartChordSourceNames and collectAutoChartModeSourceNames normalize and match against local Fill option arrays.
- Candidate note names are then built from interval formulas, not from Tonal chord/scale parsing.

## Divergence map and impact

1. Divergence A: suggestion source vs apply source
- Suggestion source (TonalPlugin/TonalPicker) is Tonal.js.
- Apply source (Fill/Arpeggio auto) is local alias subset.
- Impact: values that appear selectable in Tonal picker may not resolve in Fill/Arpeggio auto.

2. Divergence B: canonical naming mismatch
- Tonal outputs canonical or detected names that can differ from local aliases.
- Local aliases include forms like dom7 and Neopolitan variants.
- Impact: round-trip from detected name to local alias lookup can fail.

3. Divergence C: spelling and mode-name variants
- Local list includes neopolitanmaj and neopolitanmin formulas.
- Tonal recognizes neapolitan major (canonical spelling with ae).
- Impact: same musical intent can map to different strings and fail matching depending on path.

4. Divergence D: chord-symbol family coverage
- Local chord alias list is intentionally limited for UI simplicity.
- Tonal chord universe is much larger.
- Impact: chart values like M7sus4/Maj7sus4 family are likely misses in current Fill/Arpeggio auto.

## Requested Maj7sus4 case: current behavior analysis

Observed behavior pattern in current architecture:

1. Tonal suggestion side can produce suspended-7 family symbols.
- Example detection output can include CM7sus4.

2. Auto-chart parsing side strips root and maps quality through local aliases.
- Current alias subset does not include M7sus4 or Maj7sus4.

3. Result:
- Fill/Arpeggio auto chart lookup misses and yields no formula-derived notes.

This exactly matches the failure mode described in the design request.

## Alias behavior requested in the prompt

The prompt asks to preserve user-facing aliases while understanding whether they produce different note sets.

Current state:

1. Many aliases are semantic synonyms to the same formula in local tables.
- Example: dom/dom7 -> same formula value as 7.

2. Some names are Tonal-recognized but may canonicalize differently.
- Example: gypsy resolves to Tonal double harmonic major naming.

3. Some local spellings are not Tonal canonical.
- Example: neopolitan major misspelling differs from Tonal canonical neapolitan major.

Implication:
- Alias preservation is feasible, but should be treated as an input-normalization layer, not the music-theory source-of-truth layer.

## Where split handling can cause future regressions

1. Any new Tonal suggestion accepted into Chart but absent from local alias tables.
2. Any refactor that changes display canonicalization without updating alias normalization.
3. Any transposition-related auto parsing path that assumes formula lookup succeeds.
4. Tests that validate only local alias cases but not Tonal-generated chart values.

## Analysis conclusions

1. The repo currently has intentional UI curation and unintended theory-engine split.
2. The split is now materially visible because Chart values increasingly originate from Tonal picker flows.
3. For chart-driven Fill/Arpeggio note derivation, Tonal.js should be treated as the music-theory authority, with local aliases kept as compatibility input forms.
4. The Maj7sus4 failure is a direct symptom of subset alias matching, not a one-off bug.

## Questions to lock before implementation planning

1. For chart-driven auto parsing, should unmatched local aliases always fall through to Tonal parsing before declaring miss?
2. Should local aliases remain accepted for backward compatibility indefinitely, or only for import/legacy paths?
3. Should mode-name canonicalization rewrite stored chart strings, or only normalize at read time?
4. Do you want explicit telemetry/logging for Tonal-fallback conversions during rollout?

## Suggested scope for next artifact (implementation plan)

1. Define a single chart-to-note-set resolver used by both Fill and Arpeggio auto.
2. Use Tonal-derived interval sets for chart chord/mode values first.
3. Keep existing alias tables as compatibility normalization into Tonal-equivalent forms.
4. Add regression tests proving round-trip support for Tonal picker outputs including CM7sus4 family and neapolitan naming variants.
5. Preserve current UI subset behavior for picker/menu ergonomics while decoupling it from theory resolution.
