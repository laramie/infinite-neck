# 903 Timing/Caching — Confirmed Part 2: Relative-Section Song (guitar-basic-blues-fwd-back-observers)

## Purpose

Follow-up to [903-timing-confirmed.md](903-timing-confirmed.md). That capture used a song with no `RELATIVE`-wired tables, so the "duplicate build for relative/Tool tables" hypothesis (item 2 in [903-timing-revisited.md](903-timing-revisited.md)) could not be tested. This capture is against `http://localhost:8000/infinite-neck/?song=demo/guitar-basic-blues-fwd-back-observers.json`, which has two relative-section "Observer" tables (forward/back) plus a Listener table, specifically to exercise that code path. Investigation only — no code changed.

## Data sources

- [903-console-dump3.txt](903-console-dump3.txt) — 210 lines, 5 sectionBoundary transitions, 180 `buildCellsForTable` entries.
- `Trace-20260831T092651.json` (repo root) — 243,745 trace events, main thread pid 4584/tid 1, CPU profile with 269,282 samples.

## Finding 1 — The RELATIVE double-build is real and confirmed for the first time

Dump-3 shows, per section-transition cycle, 4 tables built via `callSite: 'buildCells'` (`tblS6_back`, `tblS6_lead`, `tblS6_forward`, `tblP46_1`), immediately followed by 2 **additional** `buildCellsForTable` calls for `tblS6_back` and `tblS6_forward` with `callSite: 'replayTable:RELATIVE'` — i.e. the two Observer (forward/back) tables get built **twice per beat**, exactly matching the mechanism described in [903-timing-revisited.md, item 2](903-timing-revisited.md#3-code-analysis-are-we-caching-the-right-things-and-is-the-cache-count-working): `resetNoteNames()` → `buildCells()` builds every visible table using the current Section's options, then `replay()` → `replayTable()`'s `RELATIVE` branch rebuilds the same relative-wired tables again with the correct relative-section options.

Across all 180 `buildCellsForTable` entries in the dump:

| tableID | callSite | n | mean ms | min | max |
|---|---|---|---|---|---|
| tblS6_lead | buildCells | 30 | 45.7 | 40.3 | 65.4 |
| tblS6_forward | buildCells | 30 | 46.2 | 40.3 | 82.1 |
| tblS6_forward | replayTable:RELATIVE | 30 | 41.3 | 37.9 | 47.6 |
| tblS6_back | buildCells | 30 | 45.6 | 40.5 | 66.0 |
| tblS6_back | replayTable:RELATIVE | 30 | 40.7 | 36.9 | 43.9 |
| tblP46_1 (Listener) | buildCells | 30 | 67.6 | 58.0 | 105.0 |

Every one of the 30 section-transition cycles matches the `[buildCells×4, replayTable:RELATIVE×2]` pattern exactly — no exceptions.

## Finding 2 — Half of the double-builds are pure waste (identical cache key both times)

Comparing `renderCacheKeyHash` between each table's `buildCells` call and its subsequent `replayTable:RELATIVE` call within the same cycle:

- `tblS6_back`: **15/30 cycles** produced the *same* hash both times (pure wasted rebuild — the second call redoes work identical to the first), 15/30 produced a *different* hash (legitimately a different relative-section key).
- `tblS6_forward`: same split, 15/30 match, 15/30 differ.

This maps directly onto the song's alternating Section structure: when the currently-playing Section happens to coincide with what the Observer table's `relativeSection` resolves to, the first (`buildCells`) build already produced the correct output and the second (`RELATIVE`) build is 100% redundant — yet it still runs, at ~37-48ms per call. Averaged across the whole capture, **this confirms roughly half of the ~82ms/beat spent in the two `replayTable:RELATIVE` calls (mean 41.3ms + 40.7ms) is completely wasted work** — not "different but valid" rendering, but literally re-deriving and re-writing the same DOM the first pass already wrote.

## Finding 3 — Quantified cost: full per-beat cycle now averages 321ms (vs. 172.9ms in the non-relative song)

Using the `performance.mark`/`measure` pairs (`NoteTableTiming:buildCells`, `NoteTableTiming:replay`, async `b`/`e` events, 30 complete cycles):

| Metric | Mean | Min | Max |
|---|---|---|---|
| `buildCells()` duration (4 tables) | 206.7ms | 181.7ms | 270.9ms |
| `replay()` duration (includes both RELATIVE rebuilds) | 99.7ms | 91.9ms | 108.6ms |
| full cycle: `buildCells:start` → `replay:end` | **321.1ms** | 287.3ms | 399.7ms |
| beat-to-beat cadence (`buildCells:start` → next `buildCells:start`) | 1239.0ms | 419.4ms | 4557.2ms |

`replay()`'s cost jumped from a mean of 13.9ms in the prior (non-relative) capture to 99.7ms here — almost entirely explained by the two embedded `replayTable:RELATIVE` → `buildCellsForTable` calls (41.3 + 40.7 ≈ 82ms of the 99.7ms). In this capture the fastest observed cadence (419.4ms) still comfortably exceeds the slowest full cycle (399.7ms), so no outright beat-overrun was observed here — but the margin is far smaller than in the non-relative song, and any additional Section/Tool table on top of these four would erode it further.

## Finding 4 — CPU profile confirms the same root cause: jQuery `.html()` setter, not string-building

Sampling self-time within individual `buildCells()` windows (4 samples across the 30-cycle capture) shows jQuery's `.html()` setter path dominating every window, consistent with [903-timing-confirmed.md, Finding 3](903-timing-confirmed.md):

| Window | Duration | Self-time inside jQuery `.html()` setter (node under `M`/`html`, called from [NoteTableController.js](../../../../NoteTableController.js#L354)) | % of window |
|---|---|---|---|
| #0 | 249.5ms | 166.6ms | 67% |
| #5 | 239.5ms | 160.6ms | 67% |
| #15 | 201.6ms | 143.3ms | 71% |
| #29 | 182.2ms | 135.7ms | 74% |

Walking the sampled call stack for the single hottest node in window #0 (166.57ms self-time) gives the exact call chain, confirming both the DOM-write bottleneck and the full trigger path for a Section change:

```
sectionChanged (infinite-neck.js:762)
 → syncSectionUi (infinite-neck.js:750)
 → displayOptionsToControls (infinite-neck.js:3065)
 → chuseStylesheet (colorFunctions.js:452)
 → fullRepaint (colorFunctions.js:48)
 → fullRepaint (NoteTableController.js:1544)
 → resetNoteNames (NoteTableController.js:102)
 → resetNoteNames (infinite-neck.js:1022)
 → resetFlats (infinite-neck.js:993)
 → buildCells (infinite-neck.js:1069)
 → buildCellsForTable (infinite-neck.js:1078)
 → buildCellsFromSelector (NoteTableController.js:352)
 → each (jquery-3.7.1.min.js)
 → [cell] (NoteTableController.js:354)
 → html() → M() → [innerHTML write] (jquery-3.7.1.min.js)
```

Unlike the first trace ([903-timing-confirmed.md](903-timing-confirmed.md)), this profile doesn't surface a separately-named `set innerHTML` native frame — the cost is attributed to the enclosing minified jQuery frame instead — but the call-stack walk above confirms it is the same code path and the same operation (jQuery's `.html()` setter invoked once per matched `<td>` inside the `.each()` loop). `cellBuilder()` again does not appear anywhere in the sampled self-time, confirming the render cache is doing its job (eliminating string-build cost); the dominant cost remains DOM mutation, not cache misses.

`tblP46_1` (the Listener table) is consistently the most expensive single table (mean 67.6ms vs. ~46ms for the S6 tables) despite also being a cache hit — plausibly explained by `pianoSkeuomorphic` handling in [buildCellsFromSelector()](../../../../NoteTableController.js#L367-L379), which calls `cell.closest("table")` per matched cell for piano-style tables, an expensive per-cell upward DOM walk flagged as a concern in the original [903-timing-revisited.md, section 2](903-timing-revisited.md#2-what-to-look-for-in-chrome-devtools-performance-tab).

## Answering the open question from 903-timing-confirmed.md

- **"Is the relative/Tool-table double-build happening?"** — **Yes, confirmed.** Every Section transition rebuilds both Observer tables (`tblS6_back`, `tblS6_forward`) twice: once via `buildCells()` with the current Section's options, once via `replayTable()`'s `RELATIVE` branch with the correct relative-section options. In exactly half of the observed transitions, both builds used an identical cache key — meaning the second build was 100% wasted, re-running the same DOM-mutation loop against output that was already correct.

## Recommendation

This capture adds direct, measured support for the fix already proposed as a "pure win regardless of caching strategy" in [903-timing-revisited.md](903-timing-revisited.md#other-caching-choices-to-consider-design-level-not-yet-decided): skip the `buildCellsForTable()` call inside `buildCells()`/`resetNoteNames()` for any table whose wiring has a non-empty `relativeSection`, since `replay()` immediately rebuilds it correctly afterward. Based on this capture, that alone would remove ~46ms × 2 tables ≈ 92ms from every `buildCells()` cycle (roughly 33-45% of its 182-271ms measured duration) with zero risk of stale output, independent of and prior to any whole-table-cache redesign. This remains investigation-only; no code has been changed as a result of this document.
