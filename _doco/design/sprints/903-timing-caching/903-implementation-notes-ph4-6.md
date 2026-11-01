# Sprint 903 timing-caching — Phase 4 (continued 5): Step D1 confirmed insufficient — real dominant cost is per-cell `innerHTML` parsing, not jQuery

date: 20260831

## Context

Fresh real-world capture after Step D1 landed (see
[903-implementation-notes-ph4-5.md](903-implementation-notes-ph4-5.md)), testing the same "loop over Sections
repeatedly" scenario. Files (temp, in this sprint directory):

- `Trace-20260831T154722.json` (DevTools performance trace)
- `localhost-1788216563626.log` (console dump)

## Log-level result: only a modest improvement, not the expected order-of-magnitude drop

```
cacheState: 'hit'            -> 14 occurrences, durationMs: 37.2 - 42.8  (avg ~39ms)
cacheState: 'skipped-unchanged' -> 60 occurrences, durationMs: 0 - 0.2
```

Compare to phase 4-4's pre-Step-D1 numbers: `'hit'` was 50.4-62.5ms. Step D1's raw-DOM rewrite of
`buildCellsFromSelector()` (dropping jQuery, caching per-column sizing) only bought **roughly a 20-25%
reduction** (~50-62ms -> ~37-43ms) — nowhere near closing the gap to `'skipped-unchanged'`'s ~0-0.2ms, which
was the actual goal.

## Trace-level root cause: each cell's `innerHTML =` assignment triggers its own browser HTML-parse pass

Filtering `Trace-20260831T154722.json`'s `traceEvents` for entries whose JS stack trace includes
`buildCellsFromSelector`, every single one of them is a **`ParseHTML`** event — one per `<td>` per
note-class-selector iteration, exactly as many as there are `.each()` callback invocations:

- One representative `'hit'` cluster (covering both `tblP46_main` and `tblS6_listener`) spans **~79ms**
  wall-clock and contains **408 separate `ParseHTML` events**, summing to **~48ms** of actual HTML-parsing
  time (average **~119µs per call**, one per matched `<td>`).
- The remaining events in that same window are a handful of `RunTask` slices totalling only ~3.4ms — i.e.
  essentially all measurable cost is the `ParseHTML` events themselves, not jQuery traversal, not
  `computeCellSizing()`, not layout/paint.
- `'skipped-unchanged'` entries never call `buildCellsFromSelector()` at all (confirmed by reading
  [infinite-neck.js](../../../../infinite-neck.js#L1119) — `wasLastPainted()` short-circuits before it), which is
  exactly why those cost ~0ms: there's no `innerHTML=` assignment to parse.

**This means the true dominant cost was never "jQuery wrapper overhead" — it's the fact that
`element.innerHTML = htmlString` (however it's invoked, jQuery `.html()` or raw DOM) makes the browser spin
up its HTML parser and construct a fragment tree once per call.** Doing this ~200+ times per table (once
per matched `<td>`) pays that fixed per-call parsing overhead ~200+ times over, even though the *total*
amount of markup being parsed across the whole table hasn't changed. Step D1 removed jQuery's traversal/
wrapper cost around each of those calls, which is why there's a real but modest (~20-25%) improvement — but
it left the fundamentally expensive part (many small `ParseHTML` calls instead of one large one) untouched.

## Why this wasn't caught by Step D1's plan

[903-implementation-plan-step-D.md](903-implementation-plan-step-D.md) attributed the phase 4-4 cost to
"jQuery's per-cell `.html()`/`.attr()`/`.css()` DOM writes" as a category, and split the fix into D1
(remove jQuery, keep per-cell writes) vs D2 (batch all cells into one write per table). D1 was framed as
low-risk/high-value; this capture shows D1's value is real but limited — the *batching* half of D2's design
(one `innerHTML=`/`tbody.innerHTML=` call per table instead of one per cell) is what actually addresses the
now-confirmed root cause, not the jQuery-removal half.

## Status / recommendation

- Step D1 remains a legitimate, low-risk improvement (confirmed ~20-25% faster on real cache hits, zero
  Jest regressions, same `<td>` node identity preserved) — no reason to revert it.
- To close the remaining gap, **Step D2 (batch each table's markup into a single DOM write instead of one
  write per cell)** is now the next actionable, evidence-backed step — this capture is the first time the
  ParseHTML-per-cell cost has been isolated and measured directly, rather than inferred.
- Per repo SOP, Step D2 is a structural change to top-level files (`NoteTableController.js`,
  `infinite-neck.js`) and per [903-implementation-plan-step-D.md](903-implementation-plan-step-D.md)'s own
  risk section carries real complications: `installTDNoteClick()` currently binds click handlers directly
  per-`<td>` (not delegated), and `replayTable()`/overlay logic re-queries `<td>`s by attribute after a
  rebuild — a wholesale markup replace needs a plan for re-binding/re-querying those without behavior
  changes. **No code has been written for Step D2** in this note; this is a findings-and-recommendation
  writeup only, awaiting explicit approval to proceed, consistent with how phase 4-4 handled the same kind
  of decision point.
