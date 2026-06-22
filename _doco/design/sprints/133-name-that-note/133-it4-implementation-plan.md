# 133 Iteration 4 Implementation Plan: Arpeggio auto chart source types

Date: 2026-06-22
Sprint: 133 name-that-note
Inputs:
- [133-it4-arpeggio-chart.md](133-it4-arpeggio-chart.md)
- [133-design.md](133-design.md)
- [133-implementation-plan-1.md](133-implementation-plan-1.md)

## Goal

Add chart-driven Arpeggio source types that parallel Fill automatic-from-chart behavior:
- `c) auto chord`
- `m) auto mode`
- `b) auto chord+mode`

while ensuring root handling follows transposition-aware behavior (effective transposed root), not persisted chart roots.

## Scope and non-scope

In scope for this plan:
- Arpeggio `type` menu/property expansion for auto chart variants
- chart text normalization and alias matching reuse from Fill
- transposition-aware root resolution for auto chart parsing
- candidate-note generation contract for chord/mode/chord+mode (union)
- Jest coverage for parsing, root behavior, and sequence generation compatibility

Out of scope for this plan:
- changes to Fill plugin behavior
- changes to chart UI checkbox state handling itself
- broad transpose architecture refactor
- non-Arpeggio plugin behavior changes

## Current implementation anchors

- Arpeggio source type contract and property menu:
  - [plugins/arpeggio/properties.json](plugins/arpeggio/properties.json)
  - [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)
- Arpeggio note-source selection currently branches only named/single:
  - [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js#L1560)
- Arpeggio Bach root lookup currently uses `section.rootID`:
  - [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js#L1176)
- Fill chart normalization and alias matching helpers:
  - [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js#L955)
  - [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js#L976)
- Existing chart display logic demonstrating strip-root plus add-transposed-root behavior:
  - [section-printer.js](section-printer.js#L232)
  - [section-printer.js](section-printer.js#L245)
- Section root and lead-root transposition semantics:
  - [Section.js](Section.js#L241)
  - [Song.js](Song.js#L1367)

## Proposed behavior contract

### 1) New source type values

Add constants and menu options in Arpeggio:
- `AutoChartChord`
- `AutoChartMode`
- `AutoChartChordMode`

Menu captions/triggers should match design:
- `named (n)`
- `single (s)`
- `auto chord (c)`
- `auto mode (m)`
- `auto chord+mode (b)`

### 2) Candidate note-name resolution by source type

Define one resolver that returns a set of note names for the active section:
- `NamedNote`: existing behavior
- `SingleNote`: existing behavior
- `AutoChartChord`: note names from effective chart chord only
- `AutoChartMode`: note names from effective chart mode only
- `AutoChartChordMode`: union of effective chord set and effective mode set

If one side is empty/unresolved, use the non-empty side.

### 3) Effective chart value parsing

Use Fill-style normalization before lookup:
- chord normalization strips slash bass and strips root token to identify quality
- mode normalization strips tonic and normalizes aliases

Then map to canonical formulas using alias tables (ported/shared from Fill patterns).

### 4) Transposition-aware root behavior

For Arpeggio auto types, compute note sets as if:
- strip tonal roots is active
- add transposed root is active

without consulting checkbox state.

Operationally:
1. Parse chart quality/mode name from stored section `chartChord`/`chartMode`.
2. Resolve effective root from section transposition state.
3. Recompose tonal query with effective root.
4. Build note-name set from recomposed chord/mode.

Root source rule for Iteration 4:
- use transposed `section.rootID` as authoritative root for auto chart note generation.
- ignore `rootIDLead` for these auto source types.
- do not use persisted root literal that may be embedded in chart text.

This aligns with current chart display logic that uses section root as transposed root display.

### 5) Empty and none handling

Arpeggio auto behavior should mirror Fill automatic semantics for empties:
- empty chart chord/mode (or explicit `none`) is treated as explicit empty source set
- no fallback to previous derived set
- no sticky behavior across section boundaries or loops

### 6) Sequence and style compatibility

Once candidate note names are resolved, sequence generation remains unchanged:
- every/alternate/random/bach reuse existing path
- random cache key must include `sourceType` and effective chart-derived identity inputs

## Implementation work breakdown

### Step 1: Extend Arpeggio source type schema and constants

Primary files:
- [plugins/arpeggio/properties.json](plugins/arpeggio/properties.json)
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Tasks:
1. Add new `type` options in properties.
2. Add source type constants and help/summary text updates.
3. Ensure persisted song state can load new values.

Expected outcome:
- UI and persistence understand new source variants.

### Step 2: Introduce chart-derived note-name resolver

Primary file:
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Tasks:
1. Add `collectAutoChartChordNames`, `collectAutoChartModeNames`, `collectAutoChartChordModeNames` helpers.
2. Add normalization/matching helpers via shared utility extraction with Fill as source-of-truth.
3. Route `collectCandidateNoteNames` through new source-type switch.

Expected outcome:
- source note names can originate from chart chord/mode values.

### Step 3: Add transposition-aware root composer

Primary files:
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)
- optional shared utility target if extracted (for follow-up)

Tasks:
1. Add helper that derives effective root note name from `section.rootID`.
2. Recompose chord/mode query strings from normalized quality plus effective root.
3. Keep behavior independent from chart option toggles.

Expected outcome:
- auto chart note sets follow transposed section root.

### Step 4: Stabilize empty/miss behavior and diagnostics

Primary file:
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Tasks:
1. Treat empty/none chart values as explicit empty sets.
2. Add miss-message helper for unmatched chart aliases (parallel to Fill messaging).
3. Ensure no implicit fallback to named/single sets.

Expected outcome:
- predictable no-sticky behavior and inspectable misses.

### Step 5: Expand Jest contracts

Primary file:
- [_tests/jest/arpeggio-plugin.test.js](_tests/jest/arpeggio-plugin.test.js)

Add contracts:
1. `auto chord` resolves expected note set from chart chord aliases.
2. `auto mode` resolves expected note set from chart mode aliases.
3. `auto chord+mode` uses union semantics.
4. empty chart inputs produce empty candidate set and no sequence output.
5. transposed root changes modify auto note set even when chart text tonic is unchanged.
6. random cache invalidates when effective chart-derived source identity changes.
7. bach style remains stable with auto chart source candidates.

Optional integration tests:
- [_tests/jest/transpose-plugin.test.js](_tests/jest/transpose-plugin.test.js)
- [_tests/jest/transport-controller.test.js](_tests/jest/transport-controller.test.js)

## Suggested coding sequence

1. Add schema/constants/menu updates.
2. Implement source-type switch expansion.
3. Implement chart normalization and alias matching for Arpeggio auto.
4. Add transposed-root composition helper.
5. Add miss/empty behavior handling.
6. Add/adjust Jest tests.
7. Run focused Arpeggio tests, then full suite.

## Validation checklist

Functional acceptance:
1. Auto chord/mode/chord+mode appear and persist in menu state.
2. Auto candidates are derived from chart metadata, not from pre-existing named/single note lists.
3. Transposing section root changes auto-derived notes accordingly.
4. Empty chart metadata clears auto-derived candidates (no sticky carryover).
5. Existing non-auto source types remain unchanged.

Regression acceptance:
1. Existing random plus flashcard contracts still pass.
2. Existing bach contracts still pass.
3. Existing Fill tests remain green.

Recommended test commands:
- `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/arpeggio-plugin.test.js --verbose --runInBand`
- `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`

## Implications and surprising outcomes

1. Auto source types decouple Arpeggio from section note ownership: even with no named/single marks, chart metadata can now drive generated sequences.
2. Chart chord symbols with explicit tonic (for example `Gbmaj7`) can yield notes rooted on transposed section root rather than literal `Gb`; this is intentional per design but may surprise users expecting literal symbol playback.
3. `auto chord+mode` can increase candidate size relative to either source alone, which changes random and bach phrase feel.
4. If alias coverage is incomplete, auto types may look "empty" despite populated chart text, increasing importance of explicit miss diagnostics.

## Design decisions confirmed

1. Root authority: use `section.rootID` only and ignore `rootIDLead`.
2. Literal-vs-transposed expectation: transposed-root-only for all auto types; named and single remain unchanged.
3. Chord+mode semantics: union, not intersection.
4. Percent repeat `%`: display-only for chart bars; Arpeggio reads section-level chart fields only.
5. Chord extensions/playability: use concrete chord and mode selections as provided by the current chart selection flow.
6. Alias source-of-truth: Fill and Arpeggio share one alias table module.

## Definition of done

Done means:
1. new Arpeggio auto source types are implemented and selectable
2. auto chart candidate derivation follows transposed-root contract
3. empty/miss behavior is deterministic and covered by tests
4. focused Arpeggio and full Jest suites pass
5. sprint docs capture final behavior and implementation notes for the confirmed design decisions
