# 903 Timing/Caching — Phase 3 Implementation Notes (Steps A-C)

## Purpose

This document records what was actually implemented from [903-implementation-plan-ph3-1.md](903-implementation-plan-ph3-1.md) — Steps A, B, and C — including any deviations from the plan, and the validation performed. Step D remains deferred, unchanged from the plan.

## Summary of changes

| Step | File(s) | What changed |
|---|---|---|
| A | [NoteTableRenderCache.js](../../../../NoteTableRenderCache.js), [infinite-neck.js](../../../../infinite-neck.js) | Added last-painted-key tracking per `tableID`; `buildCellsForTable()` now skips the entire per-cell rebuild when the incoming `renderCacheKey` matches what's already painted. |
| B | [NoteTableController.js](../../../../NoteTableController.js), [infinite-neck.js](../../../../infinite-neck.js) | Piano-skeuomorphic table-level CSS custom properties are now written once per table per rebuild (in `buildCellsForTable()`), not once per matched `<td>` (in `buildCellsFromSelector()`'s `.each()` loop). |
| C | [infinite-neck.js](../../../../infinite-neck.js) | `buildCellsForTable()` now queries `td.note` for the table once and passes an already-filtered jQuery set into each of the 12 note-class `buildCellsFromSelector()` calls, instead of each call re-querying the live DOM with its own selector. |

All three steps landed as planned, with one implementation simplification noted in Step C below. No changes were made to `buildCellsFromSelector()`'s exported signature/behavior beyond removing the piano-skeuomorphic table-CSS write (Step B); its first parameter still accepts either a selector string or a jQuery object, unchanged from before this work (jQuery's `$()` already handled both).

## Step A — Skip-if-unchanged per table

### Implementation

[NoteTableRenderCache.js](../../../../NoteTableRenderCache.js): added a `lastPaintedKeyByTableID` `Map`, separate from the existing HTML-string `cache` `Map`, plus three exports:

- `wasLastPainted(tableID, key)`
- `recordPainted(tableID, key)`
- `clearPaintedTracking(tableID)` — clears one table's entry, or all entries if called with no argument.

`__resetForTests()` now also clears `lastPaintedKeyByTableID`, matching the existing pattern for the other module-level caches/counters.

[infinite-neck.js](../../../../infinite-neck.js) `buildCellsForTable()`: immediately after computing `renderCacheKey`, checks `NoteTableRenderCache.wasLastPainted(tableID, renderCacheKey)`. If true, it logs a `dumpNoteTableTiming()` entry with `cacheState: 'skipped-unchanged'` (new value, distinguishing this from `'hit'`/`'miss'`/`'disabled'` in the console dump) and returns without touching the DOM at all — no `NoteTableRenderCache.get()` lookup, no note-class loop, no piano-skeuomorphic CSS write, no cell query. On the normal (non-skip) path, `NoteTableRenderCache.recordPainted(tableID, renderCacheKey)` is called right after the note-class loop completes, so the next call for the same table records what was actually just painted.

[infinite-neck.js](../../../../infinite-neck.js) `invalidateNoteTableRenderCache()`: now also calls `NoteTableRenderCache.clearPaintedTracking()` (no argument — clears all tables), alongside the pre-existing `NoteTableRenderCache.clear()`. This function is already wired to the `NoteTableCache:invalidate` EventBus event, which fires (among other places) from `reinstallAllTuningsTables()` with `reason: 'ReinstallAllTuningsTables'` — the one call site identified in the plan as needing to invalidate the new painted-tracking state, since that function tears down and rebuilds the actual `<td>` DOM nodes.

### Deviation from plan

None. Implemented exactly as designed.

### Reasoning re: correctness

Every other display-option toggle path (`showCellNotes`, `cellIsFunction`, `showMidiNum`, etc.) changes `renderCacheKey` itself, so `wasLastPainted()` simply returns `false` for those and the normal rebuild path runs — no separate invalidation needed for those, consistent with the plan's analysis.

## Step B — Piano Skeuomorphic: hoist per-table CSS vars

### Implementation

[NoteTableController.js](../../../../NoteTableController.js): added `applyPianoSkeuomorphicTableCssVars(tableID, options)`, exported alongside the existing `getPianoSkeuomorphic*` helpers it calls internally (`getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor`, `getPianoSkeuomorphicWhiteToBlackWidthRatio`, `getPianoSkeuomorphicBlackKeyWidthPxForScaleFactor`). It computes the same three CSS custom property values previously computed inline in `buildCellsFromSelector()`'s `.each()` loop, and writes them with a single `$('#' + tableID).css(...)` chain.

`buildCellsFromSelector()`'s `.each()` loop no longer computes `pianoWhiteKeyWidth`/`pianoWhiteToBlackWidthRatio`/`pianoBlackKeyWidth` or calls `cell.closest("table").css(...)`. It still computes `pianoHeight` per cell and reassigns `h = pianoHeight` — left untouched per the plan, since that calculation is cell-cheap (no DOM write) and the plan explicitly scoped this step to removing the redundant per-cell **DOM write**, not the redundant-but-harmless per-cell recomputation of an already-constant value.

[infinite-neck.js](../../../../infinite-neck.js): imports `applyPianoSkeuomorphicTableCssVars` from `NoteTableController.js` and `isPianoSkeuomorphicEnabled` from `templates/piano/piano-skeuomorphic.builder.js` (the same module `NoteTableController.js` already imports it from). `buildCellsForTable()` calls `applyPianoSkeuomorphicTableCssVars(tableID, options)` once, guarded by `tableID && tuning && isPianoSkeuomorphicEnabled(tuning)`, before the note-class loop — and, since this now lives after the Step A skip-check, it is also skipped entirely when the table's key hasn't changed.

### Deviation from plan

The plan's code sketch passed `tuning` as a third argument to the helper (`applyPianoSkeuomorphicTableCssVars(tableID, options, tuning)`), anticipating the helper might need it. In the actual implementation, `tuning` is not needed inside `applyPianoSkeuomorphicTableCssVars()` — only `options` (`NoteDisplaySizes.width`, `pianoWidthScaleFactor`, `pianoWhiteToBlackWidthRatio`) feeds the three CSS values — so the shipped signature is `applyPianoSkeuomorphicTableCssVars(tableID, options)`, two arguments. The `tuning` check (`isPianoSkeuomorphicEnabled(tuning)`) still happens at the call site in `buildCellsForTable()`, exactly as planned, just not forwarded into the helper unnecessarily.

## Step C — Single DOM query per table instead of twelve

### Implementation

Took the plan's explicitly-recommended "smaller, lower-risk diff" option (not the `buildOneCell()` refactor alternative): `buildCellsForTable()` now does `const allNoteCells = tableID ? $(`${tableID_prefix}td.note`) : null;` once, then for each of the 12 note-class specs calls:

```js
buildCellsFromSelector(
    allNoteCells ? allNoteCells.filter('.' + spec.noteClass) : tableID_prefix+`td.${spec.noteClass}`,
    ...
);
```

`buildCellsFromSelector()` itself is unchanged — its first parameter (`selector`) is passed straight to `$(selector)`, which already accepts either a selector string or a jQuery object, so no signature or internal-logic change was needed there. The `tableID ? ... : null` fallback preserves the exact prior behavior (`tableID_prefix+`td.${spec.noteClass}`` as a plain selector string) for the theoretical `tableID === ''` case, which the code read for this plan confirmed does not occur via any real call site (`buildCells()` and `replayTable()`'s `RELATIVE` branch both always pass a non-empty `tableID`), but is kept as a defensive fallback matching the function's existing default parameter (`tableID=""`).

### Deviation from plan

Confirmed, per the plan's own instruction, that `buildCellsFromSelector()` has exactly one call site (inside `buildCellsForTable()`) before proceeding — via a workspace symbol-usage search, matching what the plan asked to verify. Given that, the smaller-diff `.filter()` approach was chosen over the larger `buildOneCell()` refactor, per the plan's own recommendation ("Recommended as the first cut given it's the smaller, lower-risk diff").

## Interaction between steps

Steps A, B, and C compose in `buildCellsForTable()` in this order: Step A's skip-check runs first (cheapest, highest-value early exit) → Step B's table-level CSS write (only reached on a real rebuild) → Step C's single cell query + per-class `.filter()` (only reached on a real rebuild) → the existing per-note-class `buildCellsFromSelector()` calls → Step A's `recordPainted()` bookkeeping. This means on any beat where a table's key is unchanged from the last paint, none of Steps B/C's work runs either — Step A's early return is a superset win that also implicitly captures B and C's savings for the (measured, majority) case where the key didn't change.

## Testing

- Added 3 new tests to [_tests/jest/note-table-render-cache.test.js](../../../../_tests/jest/note-table-render-cache.test.js) covering `wasLastPainted()`/`recordPainted()`/`clearPaintedTracking()`: per-tableID independence, single-table vs. clear-all, and empty-tableID/empty-key edge cases.
- No new DOM/jQuery-based tests were added for Steps B/C, consistent with existing repo Jest convention (browser/jQuery behavior validated via UI acceptance testing, not Jest — Jest runs with `testEnvironment: 'node'`, no DOM). `applyPianoSkeuomorphicTableCssVars()`'s pure numeric inputs (`getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor`, etc.) already have dedicated coverage in [_tests/jest/note-table-controller-markup.test.js](../../../../_tests/jest/note-table-controller-markup.test.js), unchanged by this work since those helper functions themselves were not modified.
- Full suite run after all three steps: **65 suites / 698 tests passing** (695 pre-existing + 3 new).

## Not done in this pass

- **Re-capturing a console dump / DevTools trace** to directly measure the before/after effect of Steps A-C, as called for in the plan's "Suggested validation after implementation" section. This requires a running browser session (`bin/webserver` + manual song load/loop), which is outside the scope of this coding pass. Recommend doing this next, using the same two songs from [903-timing-confirmed.md](903-timing-confirmed.md) / [903-timing-confirmed-2.md](903-timing-confirmed-2.md), and confirming: `cacheState: 'skipped-unchanged'` now appears in the dump for the majority of same-Section repeat beats, and per-table `durationMs` for those skipped calls is ~0.
- **Manual UI acceptance testing** for visual regressions (piano-skeuomorphic sizing, relative-section Observer tables, click-to-color behavior) — also flagged as a follow-up in the plan, not performed as part of this automated coding pass.
- **Step D** (whole-table single-write batched markup) remains deferred, unchanged from [903-implementation-plan-ph3-1.md](903-implementation-plan-ph3-1.md)'s recommendation to only pursue it if re-measurement after Steps A-C still shows first-paint/cache-miss cost as a significant contributor.
