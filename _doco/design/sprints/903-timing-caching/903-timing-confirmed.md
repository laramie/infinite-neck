# 903 Timing/Caching — Confirmed: Dump-2 + DevTools Trace Analysis

## Purpose

This is the "remaining next step" called for at the end of [903-timing-revisited.md](903-timing-revisited.md): re-capture a console dump and a DevTools Performance profile with `NOTE_TABLE_RENDER_CACHE_TIMING_ENABLED = true`, and use the new `callSite`/`renderCacheKeyHash`/`performance.mark()` instrumentation to settle the open hypotheses from that document. Investigation only — no code was changed to produce this document.

## Data sources

- [903-console-dump-2.txt](903-console-dump-2.txt) — 21 `sectionBoundary` transitions, all `cacheState: 'hit'`, callSite always `'buildCells'`.
- `Trace-20260831T032442.json` (repo root, `~/infinite-neck/Trace-20260831T032442.json`) — a ~87MB Chrome DevTools Performance recording, 120,738 trace events, including the `performance.mark()`/`performance.measure()` pairs (`buildCells:start/end`, `replay:start/end`) added per the prior investigation, plus a full V8 CPU profile (201,905 samples across the capture).

Analysis was done with ad-hoc Python scripts against the raw trace JSON (main thread = pid 457062 / tid 1 `CrRendererMain`; CPU profile samples arrive on tid 15 `v8:ProfEvntProc` but represent main-thread execution).

## Finding 1 — Cache hit rate: 100%, as designed

Every `buildCellsForTable` line in dump-2 reports `cacheState: 'hit'`. The same two tables (`tblS6_lead`, `tblPiano_listener`) repeat 21 times each, with `renderCacheKeyHash` cycling between a small set of hashes as the song loops through its Sections — exactly matching the "bounded pool of rootID/rootIDLead/sharps keys" design. `size: 4` / `maxEntries: 6` never overflows. The cache itself is functioning correctly.

## Finding 2 — Duplicate-build hypothesis (item 2 in 903-timing-revisited.md): not exercised in this capture

`grep -c "RELATIVE"` against dump-2 returns 0 — every `buildCellsForTable` call in this recording has `callSite: 'buildCells'`; there is no `'replayTable:RELATIVE'` call site. Neither table in this song (`tblS6_lead`, `tblPiano_listener`) is apparently wired with a `relativeSection`, so this capture cannot confirm or deny the "double rebuild at Section-change for relative/Tool tables" hypothesis. That would need a capture against a song/table configuration that actually exercises the `RELATIVE` branch in `replayTable()` ([NoteTableController.js](../../../../NoteTableController.js#L1108-L1115)).

What dump-2 *does* show, that dump-1 didn't make explicit: **3 `buildCellsForTable` calls per table per Section**, not 2 — i.e. `buildCells()` (and therefore full note-table rebuild) runs on every beat while looping, not just at Section boundaries. Each of those 3 calls per table, per Section, is a cache hit (same `renderCacheKeyHash`), yet each still costs 50–90ms per table (confirmed below). This means the "first beat of a changed Section is slowest" symptom is really a special case of a **per-beat** cost that exists throughout playback, not a one-off Section-transition cost.

## Finding 3 — Quantified: cache-hit `buildCells()` cost is 105–180ms per beat, dominated by DOM writes

Using the `buildCells:start`/`buildCells:end` marks (21 complete cycles captured):

| Metric | Mean | Min | Max |
|---|---|---|---|
| `buildCells()` duration (both tables) | 142.0ms | 104.7ms | 179.7ms |
| `replay()` duration | 13.9ms | 9.8ms | 25.3ms |
| gap: `buildCells:end` → `replay:start` | 16.9ms | 13.0ms | 24.2ms |
| full cycle: `buildCells:start` → `replay:end` | 172.9ms | 128.2ms | 219.2ms |
| beat-to-beat cadence (`buildCells:start` → next `buildCells:start`) | 1060.4ms | **189.9ms** | 4610.7ms |

The CPU profile pinpoints exactly where the `buildCells()` time goes, sampled self-time by function, checked across 5 separate cycles for consistency:

| Window | Duration | `set innerHTML` self-time | % of window |
|---|---|---|---|
| #0 | 179.7ms | 96.0ms | 53% |
| #3 | 109.9ms | 63.7ms | 58% |
| #5 | 104.7ms | 57.6ms | 55% |
| #10 | 154.5ms | 80.4ms | 52% |
| #15 | 127.3ms | 72.8ms | 57% |
| #20 | 112.8ms | 64.7ms | 57% |

**52–58% of every cache-hit `buildCells()` cycle is spent in the native `set innerHTML` DOM setter**, consistently across the trace. In window #5, this corresponds to 380 separate `ParseHTML` trace events (50.32ms measured) inside a single 104.7ms window — i.e. hundreds of individual per-cell `.html()` calls, each triggering a real browser HTML-parse, in [buildCellsFromSelector()](../../../../NoteTableController.js#L352-L420):

```js
cell.html(cachedHtml || cellBuilder(noteLetter, sharpflat, noteNum, options, midinum));
```

Because `cachedHtml` is a *string*, using it doesn't avoid the `.html()` call itself — it only avoids re-running `cellBuilder()` to produce that string. The CPU profile confirms this exactly: `cellBuilder` does not appear anywhere in the top self-time list for these cache-hit windows. The remaining ~40–45% of the window is jQuery internal overhead attributable to the same per-cell loop: `cleanData`, `style`, `setAttribute`, `each`, `matchesSelector`, `ce.fn.init`, plus the two additional per-cell writes later in the same function — `cell.children(".NoteDisplay").css(newNoteDisplaySizes)` and `cell.css(newTDSizes)` — which run unconditionally after every `.html()` write, cache hit or not.

This is a direct, measured confirmation of finding 1 in [903-timing-revisited.md](903-timing-revisited.md#3-code-analysis-are-we-caching-the-right-things-and-is-the-cache-count-working) ("the cache is only removing the string-build cost, not the DOM-write cost"), with concrete numbers: **not** a minor residual cost, but the majority (>50%) of the entire cache-hit rebuild time, repeated on every beat.

## Finding 4 — Beat cadence risk is real, not just a Section-transition edge case

The full `buildCells()` + `replay()` cycle takes 128–219ms (mean 172.9ms). The fastest observed beat-to-beat interval in this capture was 189.9ms. In the worst case measured here (219.2ms cycle vs. 189.9ms fastest cadence), a single beat's rebuild can take *longer than the beat interval itself* — meaning for fast tempos/short note durations, the app can fall behind its own playback schedule purely from note-table rebuild cost, independent of cache hit/miss state. This gives a quantitative explanation for the sprint's original "loop hiccup on first beat" symptom: it's not (only) a cold-cache/Section-transition problem, it's a structural per-beat DOM-mutation cost that happens to be most visible when it collides with a Section change.

## Answering the open questions from 903-timing-revisited.md

- **Is the cache keyed correctly and behaving as designed?** Yes — confirmed 100% hit rate, bounded pool size holding steady, no evictions of in-use keys during this loop.
- **Is `buildCellsFromSelector` really the top cost, even on cache hits?** Yes, and now quantified: 52–58% native `set innerHTML`, rest jQuery per-cell overhead — not cache-miss string-building.
- **Is the double relative/Tool-table build happening?** Not observable in this capture — the tables involved aren't `RELATIVE`-wired. Needs a follow-up capture against a song where a visible table has `relativeSection` set, to test independently.

## Recommendation

This data strengthens the case for the design-level option already listed in 903-timing-revisited.md: **cache and inject whole-table markup with a single batched DOM write per table**, instead of the current per-note-class `.each()` loop doing one `.html()` + two `.css()` writes per matched `<td>`. Since the string-build cost is already eliminated by the existing cache, and the remaining cost is >90% attributable to the sheer number of individual DOM mutation calls (not their content), collapsing "N cells × (1 `.html()` + 2 `.css()` + 1 `.attr()`)" into one write per table is the highest-leverage next step. This is investigation-only; no caching redesign has been implemented as a result of this document.
