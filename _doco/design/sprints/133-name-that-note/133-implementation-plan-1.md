# 133 Implementation Plan 1: random plus flashcard name-that-note

Date: 2026-06-22
Sprint: 133 name-that-note
Inputs:
- [133-design.md](133-design.md)
- [133-analysis-1.md](133-analysis-1.md)

## Goal

Implement stable, section-scoped random behavior for Arpeggio so flashcard reveal always matches the prior highlighted cell, following Iteration 2 decisions.

## Scope and non-scope

In scope for this plan:
- random sequence lifecycle and caching
- flashcard plus random consistency
- event-driven regeneration rules
- restart and loop semantics from Iteration 2
- Jest contract coverage for the above

Out of scope for this plan:
- chartChord and chartMode source note support
- ClipPlugin owner-commit workflow enhancements
- new UI/menu features beyond what already exists

## Product decisions captured from Iteration 2

1. Minimum candidate size is 1 note.
2. Random is independent of flashcard mode.
3. Random dedupes per section and starts fresh per section generation boundary.
4. Config changes regenerate random sequence for affected section.
5. Restart song regenerates.
6. Restart section via mapped restart should not regenerate.
7. Pause and resume inside same section should not regenerate.
8. Starting loop at beat 1 or crossing into a section should generate.
9. Last-beat flashcard handling remains as-is.
10. If beats exceed unique set capacity, reshuffle the same set and continue.

## High-level behavior model to implement

Define an active random sequence cache per section context.

Cache key dimensions:
- section identity
- table identity
- source type
- candidate-affecting config snapshot
- position window snapshot

Cache payload:
- ordered deduped candidate cycle for current section window
- beat-to-candidate mapping helper state
- metadata needed for invalidation diagnostics

Core rule:
- Any display and reveal logic must use the same cached sequence that produced the current highlights for that section context.

## Event and invalidation policy

Generate new random sequence when:
1. entering a section at beat 1 through normal progression
2. crossing section boundary into a different section
3. restart song or hard reset song
4. candidate-affecting configuration changes
5. position window changes due to positions settings or song loops per position transitions

Do not generate new random sequence when:
1. restart section action in-place
2. beat-loop or section-loop resume inside current section and current beat not reset to entry boundary
3. SongUiShowBeats display refresh events only

Exhaustion policy:
- if beat count requires more entries than unique cycle length, append a newly reshuffled cycle of the same deduped set and continue.

## Implementation work breakdown

### Step 1: Introduce sequence cache state in Arpeggio runtime

Primary file:
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Tasks:
1. Add runtime structure for cached random sequence per active section context.
2. Add cache-key builder from section plus config plus position window.
3. Add helper to determine whether existing cache is reusable.
4. Add helper to clear cache on global reset paths.

Expected outcome:
- random sequence can persist across display refreshes and non-regenerating transport actions.

### Step 2: Route random sequence generation through cache-aware path

Primary file:
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Tasks:
1. Split random sequence creation into:
   - build deduped candidate set
n   - build one shuffled cycle
   - extend sequence to needed beat count with reshuffle-on-exhaustion
2. Ensure apply path and display-refresh path both query the same sequence resolver.
3. Keep existing non-random styles unchanged.

Expected outcome:
- flashcard reveal derives from identical sequence as highlight generation.

### Step 3: Wire event semantics to regenerate or reuse

Primary files:
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)
- potentially transport interaction tests in [transport-controller.test.js](_tests/jest/transport-controller.test.js) and [looper.test.js](_tests/jest/looper.test.js)

Tasks:
1. Explicitly classify incoming events as regenerate vs reuse.
2. Ensure section restart action path reuses current cache.
3. Ensure song reset and section-entry boundary regenerate.
4. Preserve current song-loop position-pair behavior while adding cache invalidation when pair changes.

Expected outcome:
- deterministic replay within section when user asks for restart section or pause/resume.

### Step 4: Maintain flashcard boundary behavior

Primary file:
- [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js)

Tasks:
1. Keep first-beat hide behavior for flashcard one-mode.
2. Keep last-beat dual reveal behavior.
3. Validate behavior remains stable under random cache reuse.

Expected outcome:
- no regression in existing flashcard contracts while fixing random mismatch.

### Step 5: Add and update Jest contract tests

Primary file:
- [arpeggio-plugin.test.js](_tests/jest/arpeggio-plugin.test.js)

Add new contracts:
1. random plus flashcard continuity: reveal on beat N+1 matches highlighted cell from beat N.
2. SongUiShowBeats does not reshuffle random sequence for active section context.
3. restart section keeps identical random order.
4. pause/resume in same section keeps identical random order.
5. entering new section regenerates random order.
6. reset song regenerates random order.
7. exhaustion reshuffles and continues from same deduped set.
8. one-candidate random set remains valid and stable.

Adjust existing tests where needed:
- keep random dedupe contracts
- keep last-beat flashcard contracts

Optional integration assertions:
- if needed, add focused coverage in [looper.test.js](_tests/jest/looper.test.js) for boundary semantics.

## Suggested coding sequence

1. Introduce cache state and helper functions.
2. Refactor random sequence generation to use helpers.
3. Plug apply and SongUiShowBeats into common resolver.
4. Implement regenerate vs reuse event decisions.
5. Update and expand Jest contracts.
6. Run focused Arpeggio tests.
7. Run full Jest suite.

## Validation and acceptance checklist

Functional acceptance:
1. In random plus flashcard, revealed note always corresponds to prior highlighted cell.
2. Restart section repeats same random order.
3. Pause and resume inside section preserves order.
4. Section entry and song reset regenerate order.
5. Exhaustion reshuffles same set and continues.

Regression acceptance:
1. Existing every, alternate, bach styles still pass tests.
2. Existing position-pair song-loop behavior still passes tests.
3. Existing flashcard boundary behavior still passes tests.

Test commands:
- preferred focused run: node --experimental-vm-modules node_modules/.bin/jest _tests/jest/arpeggio-plugin.test.js --verbose --runInBand
- preferred full run: node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand

## Risks and mitigation

Risk 1: transport event interpretation drift
- Mitigation: lock behavior with explicit regenerate-vs-reuse tests tied to observed events.

Risk 2: cache key incomplete and causes stale sequence reuse
- Mitigation: centralize cache-key construction and include candidate-affecting property snapshot plus position window state.

Risk 3: accidental behavior change in non-random styles
- Mitigation: isolate new logic behind style=random branch and preserve legacy paths.

## Open review items before coding starts

1. Confirm exact definition of section entry boundary for regeneration when user manually seeks beat 1.
2. Confirm whether random regeneration should be observable in UserLog for debugging during sprint.
3. Confirm whether randomness source remains Math.random or should be wrapped for optional seeded testing in a follow-on.

## Definition of done for this iteration

Done means:
1. plan scope implemented in Arpeggio runtime
2. new random plus flashcard continuity contracts pass
3. full Jest suite passes
4. sprint docs updated with final behavior notes and any follow-on items for chart source support
