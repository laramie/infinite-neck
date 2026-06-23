# sprint-133 Iteration 5 implementation plan

Date: 2026-06-22
Sprint: 133 name-that-note
Inputs:
- [133-it5-design.md](133-it5-design.md)
- [133-it5-analysis.md](133-it5-analysis.md)
- [133-it4-implementation-plan.md](133-it4-implementation-plan.md)

## Goal

Standardize chord and mode storage plus runtime resolution on Tonal.js names, while preserving a small, curated Fill UI subset with your existing caption and trigger ergonomics.

Key intent from design responses:
1. Tonal.js names are the canonical storage format in section and table values.
2. Fill captions and triggers remain a curated UI concern only.
3. Alias/subset complexity should be reduced to the smallest viable surface.

## Scope and non-scope

In scope:
1. Chart-driven note-set derivation in Fill and Arpeggio auto modes.
2. Canonicalization rules for values written from Fill UI into section and table fields.
3. Simplification of alias/subset strategy.
4. Regression coverage for TonalPicker round trips including CM7sus4/Maj7sus4 family scenarios.

Out of scope:
1. Expanding TonalPicker UX breadth beyond this naming and canonicalization migration.
2. Large transport or transpose architecture changes unrelated to chart name resolution.
3. Removing curated Fill UI subsets entirely in this iteration.

## Current split to remove

Current split:
1. Suggestion and picker flows are Tonal.js-driven.
2. Fill and Arpeggio chart-auto apply paths still resolve through formula-plus-alias subset maps.

Migration target:
1. One canonical chart-to-note resolver for apply paths, backed by Tonal.js.
2. Fill subset only drives menu options and captions/triggers, not theory resolution authority.

## Canonical data contract (target)

### Canonical stored values

1. Section.chartChord stores Tonal-recognized chord symbol text.
2. Section.chartMode stores Tonal-recognized mode or scale text.
3. Section table tonal fields store the same canonical Tonal text.

### UI subset values

1. Fill dropdown and Fill plugin menu continue to show curated entries with custom captions and triggers.
2. Curated entries map to canonical Tonal names before writing to section/table.
3. Custom caption-only values do not become stored canonical values unless mapped to canonical Tonal names first.

### Runtime theory resolution

1. Fill use chart and Arpeggio auto chord/mode/chord+mode resolve notes from canonical chart text through Tonal.js.
2. Local alias tables, if retained, are compatibility normalization only and must not be the primary resolver.

## Recommended implementation approach

### Step 1: Introduce shared canonical resolver module

Primary files:
- [TonalFunctions.js](TonalFunctions.js)
- new helper module under plugin-neutral path (for example chart tonal resolver)

Tasks:
1. Build shared helpers:
- normalizeChordNameForStorage(input)
- normalizeModeNameForStorage(input)
- resolveChordNoteSet({ chordText, rootID })
- resolveModeNoteSet({ modeText, rootID })
2. Implement Tonal-first resolution:
- chord parsing via Tonal chord APIs
- mode/scale parsing via Tonal mode or scale APIs
3. Add compatibility normalization hooks for known Fill aliases and spelling variants.

Expected outcome:
1. One reusable engine for canonicalization and note-set resolution.

### Step 2: Move Fill chart apply paths to Tonal resolver

Primary file:
- [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)

Tasks:
1. Replace formula-option lookup as the primary source in use-chart paths.
2. Keep Fill formulas for manual Fill formula mode behavior where needed.
3. Ensure empty and none behavior remains as currently expected.

Expected outcome:
1. Fill use-chart accepts TonalPicker-origin values beyond curated subset.

### Step 3: Move Arpeggio auto source paths to Tonal resolver

Primary file:
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Tasks:
1. Replace alias-formula matching in auto chord/mode/chord+mode with shared resolver results.
2. Preserve transposed-root-only behavior using section.rootID.
3. Preserve union semantics for auto chord+mode.

Expected outcome:
1. Arpeggio auto supports TonalPicker values such as CM7sus4 without subset misses.

### Step 4: Constrain Fill subset to UI-only mapping

Primary files:
- [Constants.js](Constants.js)
- [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)

Tasks:
1. Change Fill option model from formula authority to UI preset map:
- value id
- caption
- trigger
- canonicalChordName or canonicalModeName
2. Keep special captions you requested:
- dom7 caption variant
- dim with degree glyph
- m7b5 with half-diminished glyph
- maj7 with delta glyph
- paren mode captions and all triggers
3. Write canonical Tonal names to storage, never caption text.

Expected outcome:
1. Fill UX preserved while storage and runtime are Tonal-canonical.

### Step 5: Reduce or remove chart alias table responsibility

Primary file:
- [plugins/chart/chart-aliases.js](plugins/chart/chart-aliases.js)

Tasks:
1. Remove primary parsing responsibility from alias table.
2. Optionally retain tiny compatibility map for legacy import or typo normalization only.
3. Document explicit deprecation boundary.

Expected outcome:
1. No ongoing split authority between alias table and Tonal APIs.

### Step 6: Add migration-safe write and read normalization

Primary files:
- [tonalPicker-functions.js](tonalPicker-functions.js)
- [plugins/tonal/TonalPlugin.js](plugins/tonal/TonalPlugin.js)
- [infinite-neck.js](infinite-neck.js)

Tasks:
1. Normalize on write from Fill flows.
2. Normalize on read for legacy values when encountered.
3. Do not add an automatic one-time song-file canonical rewrite pass.

Expected outcome:
1. Existing songs continue to work, while all newly written values are canonical without forced migration rewrites.

## Simplification options for alias/subset strategy

### Option A: UI Preset Registry (recommended)

Summary:
1. Keep small Fill subset as a UI registry only.
2. Each preset points directly to canonical Tonal name.
3. No formula values in UI constants for chart workflows.

Pros:
1. Minimal cognitive load and clear separation of concerns.
2. Preserves current triggers and captions.
3. Easy to audit and prune.

Cons:
1. Requires updating Fill internals that currently rely on interval formulas.

### Option B: Two-layer compatibility map

Summary:
1. Keep current constants mostly intact.
2. Add explicit canonicalName fields next to current formula values.
3. Runtime always uses canonicalName if present.

Pros:
1. Lowest migration friction.
2. Backward-friendly for existing code.

Cons:
1. Leaves more legacy structure in place.
2. Higher long-term risk of accidental fallback to formula authority.

### Option C: Tonal-native dynamic subset generator

Summary:
1. Generate Fill dropdown options from a curated list of canonical Tonal names.
2. Apply captions and triggers as a separate skin layer.
3. Remove formula constants from chart workflows entirely.

Pros:
1. Most future-proof and clean architecture.
2. Very clear Tonal authority.

Cons:
1. Largest refactor in this sprint.
2. Higher test and rollout surface.

Recommendation:
1. Implement Option A in this sprint.
2. Keep Option B compatibility fallback behind small helper during transition.
3. Reevaluate Option C after rollout stability.

## Specific edge-case handling in this iteration

1. CM7sus4 and Maj7sus4 family:
- Ensure canonical parser accepts Tonal-detect output and common user variants.
- If Maj7sus4 is a display alias but CM7sus4 is canonical, store canonical form.

2. Neapolitan spelling variants:
- Normalize legacy Neopolitan spellings to canonical Neapolitan forms for storage.

3. dom7 caption:
- Caption remains dom7-style in Fill UI where desired.
- Stored value should remain Tonal canonical chord symbol.

4. Gypsy naming:
- Preserve caption choices, but canonical storage should align to Tonal-recognized representation.

## Validation and test plan

Primary tests to add/update:
- [_tests/jest/fill-plugin.test.js](_tests/jest/fill-plugin.test.js)
- [_tests/jest/arpeggio-plugin.test.js](_tests/jest/arpeggio-plugin.test.js)
- [_tests/jest/tonal-plugin.test.js](_tests/jest/tonal-plugin.test.js)
- add targeted resolver tests in new or existing tonal utility tests

Required contracts:
1. TonalPicker-selected chart values are accepted by Fill use-chart and Arpeggio auto.
2. CM7sus4 family no longer misses in Arpeggio auto chord.
3. Fill curated captions and triggers remain unchanged in menu and dropdown display.
4. Stored section and table chord/mode values are canonical Tonal names.
5. Legacy alias inputs normalize to canonical values without changing note sets.
6. Transposed-root behavior remains unchanged for Arpeggio auto.

Recommended test commands:
1. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/arpeggio-plugin.test.js --verbose --runInBand
2. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/fill-plugin.test.js --verbose --runInBand
3. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/tonal-plugin.test.js --verbose --runInBand
4. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand

## Risks and mitigations

Risk 1: Canonicalization drift between write paths
1. Mitigation: one shared normalization helper used by all writers.

Risk 2: Unexpected symbol canonical rewrites confuse users
1. Mitigation: preserve UI captions and canonicalize at write points only, avoiding broad file rewrite behavior.

Risk 3: Legacy songs with old aliases break in auto paths
1. Mitigation: compatibility normalization table retained for legacy forms.

Risk 4: Over-retaining alias compatibility keeps split alive
1. Mitigation: enforce Tonal-first resolver and lint-level tests proving alias map is fallback-only.

## Decisions locked before coding

1. Storage canonicalization policy: canonicalize on write to section and table chord/mode fields.
2. Compatibility policy: read-normalize legacy alias forms when encountered.
3. Rewrite policy: do not perform an automatic migration rewrite of song files.

## Remaining questions to lock before coding

1. For ambiguous chord labels, should we prefer Tonal Chord.get canonical symbol or keep user-entered equivalent if Tonal-valid?
2. For mode canonicalization, do you prefer canonical scale names with tonic in storage, or tonic-free mode names where possible?
3. Should the compatibility alias map remain indefinitely for imports, or be sunset after one migration cycle?
4. Do you want explicit migration notes in sprint docs for users opening older song files?

## Definition of done

Done means:
1. Fill and Arpeggio chart-driven note derivation are Tonal-authoritative.
2. TonalPicker-origin chart values round-trip without misses.
3. Fill curated captions/triggers remain intact as UI-only concerns.
4. Canonical Tonal names are stored in section and table chord/mode fields.
5. Regression tests pass focused and full suite.
