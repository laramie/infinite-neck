# sprint-133 Iteration 6 implementation plan

Date: 2026-06-22
Sprint: 133 name-that-note
Inputs:
- [133-it6-design.md](133-it6-design.md)
- [133-it5-implementation-plan.md](133-it5-implementation-plan.md)
- [NoteTableController.js](../../../../NoteTableController.js)
- [plugins/fill/FillPlugin.js](../../../../plugins/fill/FillPlugin.js)

## Goal

Replace the legacy Fill page flow behind btnFillNotes so it uses the same fill algorithm as FillPlugin, while keeping core and plugin layers decoupled.

Primary outcomes:
1. Old Fill page no longer assumes comma-separated interval formulas.
2. Old Fill page and FillPlugin produce the same note decisions for root/chord/scale and keep/none/role behavior.
3. Shared fill logic lives in small common modules imported by both core and plugin code.

## Scope and non-scope

In scope:
1. Refactor fillChord, fillChord2, and doFill call chain to a thin UI adapter.
2. Extract FillPlugin algorithmic helpers into plugin-neutral modules.
3. Keep existing old Fill page controls and event wiring stable.
4. Preserve current FillPlugin behavior and outputs.

Out of scope:
1. Rebuilding old Fill page UI or changing control IDs.
2. Reworking plugin manager architecture.
3. Introducing provider-injection strategy for shared imports.

## Problem statement

Current mismatch:
1. Legacy page path in NoteTableController expects dropdown values like 4,7 and 0,2,4,5,7,9,11.
2. Iteration 5 moved options to Tonal-native values like M, dim7, major, dorian.
3. FillPlugin already resolves these correctly through Tonal-aware role-note-set logic.

Risk if unchanged:
1. Old Fill page can parse values incorrectly or fail silently.
2. Different Fill engines create inconsistent user results.

## Target architecture

### A. Shared fill-core modules (new)

Create small plugin-neutral modules under a shared path, for example:
1. [fill/fill-role-engine.js](../../../../fill/fill-role-engine.js)
2. [fill/fill-apply-engine.js](../../../../fill/fill-apply-engine.js)
3. Optional small constants module if needed: [fill/fill-constants.js](../../../../fill/fill-constants.js)

Responsibilities:
1. fill-role-engine:
- computeRoleNoteSets using Tonal resolver sources.
- resolveFamilyDecision with role pass order scale then chord then root.
2. fill-apply-engine:
- build named/single/tiny plans.
- apply plans into sectionNotes with keep semantics.
- clear owned fill notes and commit owned notes.

Design constraints:
1. No jQuery or DOM access in shared modules.
2. Inputs are plain data and callbacks where needed.
3. Output shapes match current FillPlugin plan structures to reduce churn.

### B. FillPlugin as consumer of shared engine

FillPlugin keeps:
1. Property definitions and menu structure.
2. Target-table and range selection logic.
3. UI-facing summary/help text.

FillPlugin delegates:
1. computeRoleNoteSets and plan construction to shared modules.
2. apply and clear operations to shared apply helpers.

Expected result:
1. Plugin behavior remains functionally unchanged.
2. Algorithm source of truth is now reusable.

### C. Legacy Fill page as thin wrapper

NoteTableController keeps:
1. Reading old Fill page controls such as table select, chord select, scale select, and role color radios.
2. Triggering replay and refresh behavior already expected by that page.

NoteTableController replaces:
1. Arithmetic parsing and manual class-list generation in fillChord.
2. Local fill decision algorithm in fillChord2 and doFill.

New wrapper flow:
1. Read UI control state into a normalized request object.
2. Convert old-page values to shared engine modes:
- root/chord/scale mode from noteKeep and color selections.
- chord/mode source values passed as Tonal-native strings.
3. Build and apply fill plan via shared engine against selected section and table.
4. Run existing clearAll and replay hooks.

## Extraction map from existing FillPlugin

Extract first:
1. computeRoleNoteSets
2. resolveFamilyDecision
3. buildNamedPlan
4. buildPlayedFamilyPlan
5. buildOverlayTinyPlan and tiny overlay combination
6. applyNamedPlan
7. applyPlayedPlan
8. clearOwnedFillNotesInSection

Keep plugin-local for now:
1. getEligibleTargetTunings and selected-target helpers.
2. Property get/set normalization and menu rendering.
3. Plugin action dispatcher and status message formatting.

## Data contract for shared engine

Suggested request shape:
1. tableID
2. section
3. tuning
4. roleSources:
- chordSource
- modeSource
- useSectionChart boolean
5. familyModes:
- named root/chord/scale modes and colors
- single root/chord/scale modes and colors
- tiny root/chord/scale modes and colors
6. range:
- minFret, maxFret, minRow, maxRow
7. tinyOverlayMode

Suggested response shape:
1. plan with namedPlan, singlePlan, tinyPlan, standaloneTinyActive
2. counts with added and kept totals after apply

## Migration strategy

Step 1: Introduce shared modules without changing behavior.
1. Copy logic from FillPlugin into shared modules with equivalent tests.
2. Adapt FillPlugin to call shared modules.

Step 2: Replace old Fill page internals with wrapper calls.
1. Keep export signatures fillChord, fillChord2, doFill temporarily.
2. Mark fillChord2 and doFill as compatibility wrappers, then reduce them.

Step 3: Remove dead legacy parsing paths.
1. Delete split-comma formula parsing in fillChord.
2. Delete now-unused class-based bulk fill computations.

Step 4: Cleanup.
1. If no remaining callers rely on fillChord2 and doFill old semantics, collapse to a single entry point.

## Compatibility rules

1. Old Fill page must accept Tonal-native select values directly.
2. noteKeep semantics must match FillPlugin precedence behavior.
3. noteHighlightSingle handling should continue to work as currently expected by Fill page users.
4. No provider pattern; only direct ES module imports.

## Validation plan

Tests to update or add:
1. Extend [ _tests/jest/fill-plugin.test.js ](../../../../_tests/jest/fill-plugin.test.js) with shared-engine equivalence assertions.
2. Add NoteTableController old Fill page behavior tests in [ _tests/jest/notetablecontroller-fill.test.js ](../../../../_tests/jest/notetablecontroller-fill.test.js) or nearest existing NoteTableController suite.
3. Add shared engine unit tests for role precedence and keep behavior.

Required assertions:
1. Given same inputs, old Fill page wrapper and FillPlugin apply produce identical named/single/tiny results.
2. Tonal-native values like dim7 and major are handled without comma parsing.
3. keep and clear semantics are preserved for root/chord/scale conflicts.
4. tiny overlay fallback still matches plugin behavior.

Recommended commands:
1. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/fill-plugin.test.js --verbose --runInBand
2. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/notetablecontroller*.test.js --verbose --runInBand
3. node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand

## Risks and mitigations

Risk 1: Behavioral drift during extraction.
1. Mitigation: extract with function-level parity tests before NoteTableController switch.

Risk 2: Hidden old Fill page side effects in replay order.
1. Mitigation: keep clearAll and replay call order unchanged in wrapper.

Risk 3: Tight coupling to plugin-only types.
1. Mitigation: shared modules depend only on plain objects and Note model primitives.

## Open decisions for quick approval before coding

1. Shared module location:
- Option A: new top-level fill directory at repo root.
- Option B: plugins/fill with plugin-neutral naming.
- Recommendation: Option A to keep core/plugin decoupling explicit.

2. Temporary wrapper retention:
- Keep fillChord2 and doFill as shims for one iteration, then remove.
- Recommendation: keep for one iteration to reduce merge risk.

3. Test file placement for old Fill page wrapper:
- New dedicated test file or append to existing NoteTableController tests.
- Recommendation: dedicated file for focused parity cases.
