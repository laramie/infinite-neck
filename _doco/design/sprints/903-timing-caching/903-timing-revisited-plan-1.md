# 903 Timing/Caching — Revisited: Instrumentation, DevTools, and Cache Analysis

## Purpose

This is an investigation-only follow-up to [903-implementation-plan-1.md](903-implementation-plan-1.md). No code was changed to produce this document.

We already have a captured console dump from looping a song with the render cache and timing flags enabled: [903-console-dump-1.txt](903-console-dump-1.txt).

Observed at the highest level:

1. Visual UI testing shows that playing the first beat in a changed Section while looping is the most delayed.
2. The highest timing culprit reported from DevTools is `buildCellsFromSelector()`.
3. Hypothesis under test: if the cache key is really `rootID` / `rootIDLead` / `sharps` (+ stable display options), and a song has (say) three distinct Sections/keys, then a small bounded cache holding those three keys should make note-table rebuilds cheap on loop, since only replay-layer classes (`.Active`, highlight classes, etc.) should need to change per beat — not `.html()`/`.text()` writes.

This document covers:

1. How to instrument/read the console output better.
2. What to look for in the Chrome DevTools Performance tab.
3. Code analysis of whether we're caching the right things, and whether the cache count/behavior is correct.
4. Proposed caching measurement strategy and further caching design choices.

## Code read for this analysis

- [NoteTableRenderCache.js](../../../../NoteTableRenderCache.js) — the render-key builder, bounded `Map` cache, and per-table prewarm entry builder.
- [infinite-neck.js](../../../../infinite-neck.js#L1076-L1114) — `buildCellsForTable()`, the live build/cache-lookup path.
- [infinite-neck.js](../../../../infinite-neck.js#L1223-L1310) — the prewarm pipeline: `runNoteTablePrewarmTasks()`, `prewarmNoteTablesForSection()`, `prewarmNextSectionNoteTables()`.
- [infinite-neck.js](../../../../infinite-neck.js#L1070-L1075) — `buildCells()` / `resetNoteNames()` call chain.
- [NoteTableController.js](../../../../NoteTableController.js#L351-L423) — `buildCellsFromSelector()`, the DOM-mutation loop that consumes the cache.
- [NoteTableController.js](../../../../NoteTableController.js#L1077-L1120) — `replayTable()`, specifically the `RELATIVE` branch that calls `buildCellsForTable()` a second time.
- [_tests/jest/note-table-render-cache.test.js](../../../../_tests/jest/note-table-render-cache.test.js) — existing coverage for `buildRenderKey`, `createEntry`, and next-section prewarm selection.

## 1) Instructions for instrumenting/reading the console output better

The current dump only logs, per call: `tableID`, `durationMs`, `cacheState`, `selectorCount`, `sharps`, `rootID`, `rootIDLead` (see `dumpNoteTableTiming` payload construction at [infinite-neck.js](../../../../infinite-neck.js#L1106-L1114)). That is not enough to explain the pattern seen in the dump: every `showAllNoteNames: false` line is immediately followed by **two** `buildCellsForTable` lines for the *same* `tableID`, then one `prewarmSection` line.

Recommended additions to the existing `dumpNoteTableTiming` payload (no new call sites needed, just richer payloads at the existing two call sites):

- **`callSite`** — a literal string identifying which caller triggered the build, e.g. `'buildCells'` (from `resetNoteNames()` → `buildCells()` at [infinite-neck.js](../../../../infinite-neck.js#L1070-L1075)) vs. `'replayTable:RELATIVE'` (from [NoteTableController.js](../../../../NoteTableController.js#L1115)). This alone confirms or denies the double-build hypothesis in section 3 below.
- **`renderCacheKey`** (or a short hash of it) — lets you see whether the two calls for the same `tableID` used the *same* key (true duplicate work) or *different* keys (two legitimately different renders, e.g. a SELF pass vs. a RELATIVE pass, that happen to share a `tableID`).
- **`cacheSize`** (`NoteTableRenderCache.size()`) at the end of each `buildCellsForTable`/`prewarmSection` log — lets you watch the bounded cache actually fill/evict over a loop instead of inferring it from durations alone.
- **`hitCount`** off the entry (already tracked in [NoteTableRenderCache.js](../../../../NoteTableRenderCache.js#L212-L218)) — dump it once per prewarm cycle to see which cached entries are actually reused before eviction vs. built and never touched again.
- A **loop-boundary marker** — e.g. `console.info('[NoteTableTiming] loop-boundary', { cacheSize, maxEntries })` triggered once at song-start/loop-restart, so the dump can be bucketed by "loop N" instead of eyeballed by repetition.

With `callSite` and `renderCacheKey` added, group the dump lines by `(tableID, callSite)`. That grouping will directly answer "is this a real duplicate, or two different tables/passes sharing a `tableID` string."

## 2) What to look for in Chrome DevTools Performance tab

Record a profile across 2-3 full loop iterations. With `buildCellsFromSelector` already identified as the top cost, focus on:

- **Bottom-Up view, filter by `buildCellsFromSelector`, `cellBuilder`, and jQuery internals** (`jQuery.fn.html`, `jQuery.fn.css`, `jQuery.fn.attr`, `jQuery.fn.closest`). Compare **Self Time** for `cellBuilder` (string building — should shrink toward 0 on cache hits) against **Self Time** for the jQuery DOM-mutation calls inside the `.each()` loop in [NoteTableController.js](../../../../NoteTableController.js#L351-L423). If jQuery DOM calls dominate Self Time even when `cacheState: 'hit'`, that confirms the cache is only removing the *string-build* cost, not the *DOM-write* cost — consistent with the dump already showing "hit" durations still in the 30-300ms range.
- **"Recalculate Style" / "Layout" purple blocks** immediately after each `buildCellsFromSelector` call. `cell.css(newTDSizes)` and `.children(".NoteDisplay").css(...)` are called per-cell inside the loop (not batched), so layout thrashing is possible if any read happens between writes. Check specifically whether `cell.closest("table")` (reached only when `pianoSkeuomorphic` is true, per [NoteTableController.js](../../../../NoteTableController.js#L367-L379)) is being called per-cell — `.closest()` walks the DOM upward per call, which is expensive done in a loop instead of once per table.
- **Two adjacent yellow (Scripting) blocks with the same call-stack root** right after a Section-change marker — this is the DevTools-visible version of the "two `buildCellsForTable` lines" pattern in the console dump. Adding `performance.mark()`/`performance.measure()` around `buildCells()` and `replay()` separately (per the original implementation plan's "Suggested instrumentation" section) will make these two blocks appear as separately named entries in the **Timings** track, making it trivial to attribute each block to its caller.
- **Idle Callback entries** for the `prewarmSection` work — confirm it is actually running inside a `requestIdleCallback` frame rather than being starved/deferred until right when it's needed. If a Section is short, `scheduleNoteTableCacheWork()` ([infinite-neck.js](../../../../infinite-neck.js#L1189-L1195)) may not finish its chunked work before the next transition arrives.

## 3) Code analysis: are we caching the right things, and is the cache count working?

### What's correct, and matches the stated hypothesis

`buildRenderKey()` ([NoteTableRenderCache.js](../../../../NoteTableRenderCache.js#L97-L116)) is keyed on exactly the stable, key/tuning-shape inputs described — `rootID`, `rootIDLead`, `sharps`, plus other baseline display options, and a `tuningFingerprint` — and explicitly excludes named notes, played notes, recorded notes, current beat, and highlight state. The *key composition* is sound and does align with "the cache is really keyed on rootID/rootIDLead/sharps (+ stable display options)."

### Where it falls short of "whole tables cached, thin overlay layer on top"

1. **The cache still only stores per-note-class `cellBuilder()` HTML strings, not whole-table markup**, and `buildCellsFromSelector()` ([NoteTableController.js](../../../../NoteTableController.js#L351-L423)) still does a jQuery `$(selector)` + `.each()` + individual `cell.html()` / `cell.attr()` / `cell.css()` / `.children(".NoteDisplay").css()` per matched `<td>`, on **every** call — cache hit or miss. This is by design per the original implementation plan ("This plan intentionally avoids hidden DOM table caches... does not avoid the `.html()` call"), but it is exactly the gap flagged in this investigation: the console dump shows `cacheState: 'hit'` durations still in the tens-to-hundreds of ms, strongly suggesting the remaining cost is DOM-mutation overhead (one `.html()`/`.css()`/`.attr()` round-trip per cell, times ~12 note classes, times however many cells match each class) rather than `cellBuilder()` string construction.

2. **A real duplicate-build for relative/Tool-wired tables.** `resetNoteNames()` → `buildCells()` ([infinite-neck.js](../../../../infinite-neck.js#L1070-L1075)) unconditionally calls `buildCellsForTable()` for **every** visible table using the *current Section's* options, with no regard for whether that table is wired with a `relativeSection`. Then `replay()` → `replayTable()` for the `RELATIVE` type calls `buildCellsForTable()` **again** for the same table, this time with the correct relative-section options ([NoteTableController.js](../../../../NoteTableController.js#L1108-L1115)). Since `resetNoteNames()` ends by calling `replay()` ([infinite-neck.js](../../../../infinite-neck.js#L1067)), every Section change does one wasted render (wrong options, for a relative table) immediately clobbered by a second, correct render. This is the most plausible explanation for the "two `buildCellsForTable` lines, same `tableID`, back-to-back" pattern in the dump — `tblP46_1` is very likely wired with `relativeSection`. This predates and is independent of the render cache; the cache just makes it visible as two log lines instead of hiding it entirely inside one rebuild.

3. **The cache is never populated on the live build path — only by the async prewarm.** `buildCellsForTable()` ([infinite-neck.js](../../../../infinite-neck.js#L1076-L1114)) calls `NoteTableRenderCache.get(renderCacheKey)` but there is no corresponding `.set()` call anywhere in that function on miss. The only place `NoteTableRenderCache.set()` is called is inside `runNoteTablePrewarmTasks()` ([infinite-neck.js](../../../../infinite-neck.js#L1252-L1260)), which only runs for the section computed as "current index + 1" after a Section change. Consequences:
   - Song open, direct/manual navigation to an arbitrary Section (not the sequential "next"), and any table not covered by the next-section prewarm get a **permanent miss** until a later prewarm cycle happens to recompute that same key.
   - **Random-loop mode explicitly skips prewarm entirely** — `getNextSectionIndexForPrewarm()` returns `-1` when `song.randomLoop` is true — so every Section transition during random loop is a guaranteed miss. Worth confirming this wasn't the mode active when the attached dump was captured.

4. **`maxEntries` is a global cap shared across all tables, not a per-table budget.** `NoteTableRenderCache.setMaxEntries(visibleTableCount * 3)` ([infinite-neck.js](../../../../infinite-neck.js#L1297)) sizes one shared `Map`, evicted by oldest `createdAt` regardless of which table an entry belongs to ([NoteTableRenderCache.js](../../../../NoteTableRenderCache.js#L205-L219)). For a "3 sections, 3 distinct rootID/rootIDLead/sharps combos, 1 visible table" scenario this fits exactly, but it's fragile:
   - Any UI control that changes a key field without going through the prewarm path — `showCellNotes`, `cellIsFunction` (function/notename radio), `showMidiNum`, `showSubscriptFunctions`, the function-symbols textarea — calls `resetNoteNames()` directly (see the `bindEvent('change', ...)` handlers around [infinite-neck.js](../../../../infinite-neck.js#L4029-L4051)) **without** triggering `NoteTableCache:invalidate`. This is not a correctness bug (the key changes, so a stale entry is simply unused, never served incorrectly), but it silently adds new competing keys into the same bounded pool, which can evict a legitimate Section-prewarm entry and cause an unexpected miss on the very next loop transition right after such a toggle.
   - Tool tables get `ToolDisplayOptions` merged in via `checkOptionsForToolTables()` ([infinite-neck.js](../../../../infinite-neck.js#L1116-L1122)), which can make their effective key diverge from a plain "current section" key for reasons unrelated to which Section is active — another source of extra key variants competing for the same shared slot budget.

### Answering the top-level hypotheses directly

- **First beat of a changed Section is most delayed** — consistent with the design: the render cache only removes *some* cost from the rebuild, and the double-build issue (item 2) adds a second full rebuild of at least the relative/Tool table(s) right at the transition, worsening exactly the moment already identified as worst-case.
- **`buildCellsFromSelector` is the top DevTools cost** — consistent with item 1: cache hits still cost real time because the function still walks and mutates the DOM per cell (`.html()`, `.attr()`, `.css()` × ~12 note classes × N cells), regardless of whether the HTML string came from cache or was freshly built.
- **Cache key should really be rootID/rootIDLead/sharps (+ stable options)** — already true structurally, and the cache correctly avoids re-keying on transient overlay state. What's missing is the proposed next step: caching and injecting **whole-table markup** (or at least a whole-note-class-selector batch write) instead of per-cell jQuery writes, with the existing thin overlay layer (`.Active`/highlight classes, already handled separately by `replay()`/`showHighlightsForBeat()`) applied on top.

## 4) Proposed caching measurement strategy

1. Add `callSite`, `renderCacheKey` (hashed), `cacheSize`, and `hitCount` to the `dumpNoteTableTiming` payloads at both existing call sites, per section 1.
2. Add `performance.mark()` / `performance.measure()` pairs around `buildCells()` and `replay()` separately (called for in the original implementation plan's Phase 1, but the "two calls per section" evidence in the dump suggests it was not fully verified) — this shows up cleanly in the DevTools Timings track and settles the duplicate-build question definitively.
3. Instrument `NoteTableRenderCache` with a `stats()` accessor (hits, misses, evictions, sets) so a single summary line can be logged per Section transition instead of inferring cache health from durations alone.

## Other caching choices to consider (design-level, not yet decided)

- **Cache whole per-table markup** per `(tableID, rootID, rootIDLead, sharps, +stable options)` key, and swap it in with a single `.html()` (or `innerHTML =`) call on the table body, instead of iterating 12 note-class selectors with per-cell jQuery writes. This directly matches the "whole tables should be cached, not per-cell `.html()`/`.text()` writes" goal, and would eliminate the jQuery-per-cell overhead that DevTools currently attributes to `buildCellsFromSelector`.
- **Populate the cache from the live/on-demand build path too** (not just the async prewarm), so a cache miss still results in a stored entry for next time — closing the gap in item 3 above (manual navigation, random loop, song-open cold start).
- **Fix the relative/Tool double-build** (item 2) independently of any caching decision — skip the `buildCellsForTable()` call inside `buildCells()`/`resetNoteNames()` for any table whose wiring has a non-empty `relativeSection`, since `replay()` immediately rebuilds it correctly afterward. This is a pure win regardless of which caching strategy is eventually chosen.
- **Give the bounded cache table-aware quotas** (e.g. a per-table LRU of size 3) instead of one shared global pool, so a single Tool table's option churn can't evict a base instrument's Section-prewarm entries.
- **Trigger `NoteTableCache:invalidate` (or a narrower per-table invalidate) from the display-option toggles** listed in item 4, so stale key variants don't linger and compete for slots after the user changes `showCellNotes`/`cellIsFunction`/etc. mid-session.

## Status

Investigation only. No code changes were made as part of this document. Recommended next step: implement the instrumentation additions in section 1 and the mark/measure pairs in section 4, re-capture a console dump + DevTools profile, and confirm the duplicate-build hypothesis (item 2 above) before deciding on the whole-table-cache redesign.
