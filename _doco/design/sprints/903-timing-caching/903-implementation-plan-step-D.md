# 903 Timing/Caching — Step D Implementation Plan: Reducing Per-Cell DOM-Write Cost

## Purpose

This is a plan only — no code changes are made in this document, per the repo's SOP that structural
changes to top-level files need a design discussion first.

Phase 3's [903-implementation-plan-ph3-1.md](903-implementation-plan-ph3-1.md) deferred "Step D — whole-table
single-write batched markup" as design-level/not-yet-decided. Steps A-C from that plan (skip-if-unchanged,
hoisted piano-skeuomorphic CSS vars, single DOM query per table) have since shipped and been confirmed
working in real captures (phases 4-1 through 4-3, see below). Phase 4-4's real-world capture
([903-implementation-notes-ph4-4.md](903-implementation-notes-ph4-4.md)) reproduced, with live numbers for
the first time, exactly the cost Step D was proposed to address:

> a cache **hit** still costs ~50-62ms — statistically the same as a **miss** did before the phase-4-3
> live-populate fix — while a `'skipped-unchanged'` result (Step A) costs 0-0.2ms. The gap is entirely
> inside `buildCellsFromSelector()`'s per-cell jQuery DOM-mutation loop, not `cellBuilder()` string
> generation.

This document plans how to close that gap.

## Recap: how we got here

- [903-timing-revisited-plan-1.md](903-timing-revisited-plan-1.md) item 1 first identified (via DevTools
  CPU profile) that **>50% of cache-hit `buildCells()` time is spent in jQuery's per-cell `.html()`/`.css()`
  DOM writes**, not string-building.
- [903-implementation-plan-ph3-1.md](903-implementation-plan-ph3-1.md) implemented Steps A-C (skip whole
  rebuild when the render key is unchanged; hoist per-table piano-skeuomorphic CSS vars out of the
  per-cell loop; single DOM query per table instead of 12) and deferred Step D as too risky to bundle in
  without a dedicated design pass, flagging two concrete risks:
  1. Click handlers are bound **directly per-`<td>`**, not delegated (`installTDNoteClick()`,
     [infinite-neck.js](../../../../infinite-neck.js#L2525-L2532)) — destroying/recreating `<td>` nodes
     would orphan those handlers.
  2. `replayTable()`'s overlay layer ([NoteTableController.js](../../../../NoteTableController.js#L1108-L1225))
     re-queries `<td>` elements **after** every `buildCells()`/`replay()` cycle, by class
     (`.note{Letter}`) and by attribute (`td[cellrow=...][midiNum=...]`) — a wholesale markup swap must
     preserve those exact attributes on exactly the same logical cells.
- Phase 4 (this session) fixed two *different* bugs that were masking/confounding measurement of the
  Step-D-relevant cost: a duplicate `fullRepaint()` per Section transition
  ([903-implementation-notes-ph4-1.md](903-implementation-notes-ph4-1.md)), an under-sized render-cache
  capacity ([903-implementation-notes-ph4-2.md](903-implementation-notes-ph4-2.md)), and a render cache
  that was never populated from the live build path
  ([903-implementation-notes-ph4-3.md](903-implementation-notes-ph4-3.md)). With all three fixed, phase
  4-4's capture isolates the remaining cost cleanly: **cache hits and misses cost about the same, and both
  cost ~50-90ms, because the per-cell DOM-write loop runs regardless of cache state.**

## Code read for this plan

- [NoteTableController.js](../../../../NoteTableController.js#L373-L428) — `buildCellsFromSelector()`, the
  per-cell `.each()` loop: for every matched `<td>`, does `cell.html(...)`, computes `fontMultiplier` and
  writes it via `cell.attr(...)`, then `cell.children(".NoteDisplay").css(newNoteDisplaySizes)` and
  `cell.css(newTDSizes)` — 1 `.html()` + 1 `.attr()` + 2 `.css()` jQuery calls per cell, per rebuild.
- [infinite-neck.js](../../../../infinite-neck.js#L1098-L1204) — `buildCellsForTable()`, the caller; already
  does one DOM query per table (Step C) and skips entirely when unchanged (Step A); still calls
  `buildCellsFromSelector()` once per note-class spec (12 calls) for a cache hit or miss.
- [TableBuilder.js](../../../../TableBuilder.js#L45-L117) — `buildNoteTable()`: where `<td class="note
  noteX ...">` cells are constructed **once**, with static `midiNum`/`cellrow`/`cellcol`/`celltable`
  attributes baked in and never touched again outside `buildCellsFromSelector()`'s `fontMultiplier`
  attr write.
- [infinite-neck.js](../../../../infinite-neck.js#L2525-L2532) — `installTDNoteClick()`: unbinds/rebinds a
  `click` handler on **every** `td.note` in the document (not scoped to one table, not delegated), via
  `.off('click.installTDNoteClick').on('click.installTDNoteClick', ...)`.
- [NoteTableController.js](../../../../NoteTableController.js#L1108-L1225) — `replayTable()`: re-applies
  named notes (`.note{Letter}` class selector), played notes
  (`td[cellrow=...][midiNum=...]` attribute selector), and (elsewhere) highlights, strictly **after** every
  `buildCells()`/`replay()` cycle, using selectors that assume the same `<td>` identity/attributes persist
  across rebuilds.
- [NoteTableRenderCache.js](../../../../NoteTableRenderCache.js) — existing per-note-class HTML string
  cache (`noteClassHtmlByNoteName`), keyed by `renderCacheKey` (already covers every input that affects
  a cell's content+size for a given `tableID`, per phase-3's "Key finding").

## Key insight: the sizing writes are also cacheable, and don't depend on note content

Reading `buildCellsFromSelector()`'s size-computation block
([NoteTableController.js](../../../../NoteTableController.js#L389-L421)) shows the `fontMultiplier`,
`newTDSizes` (`width`/`height`), and `newNoteDisplaySizes` (`font-size`/`height`) values depend only on:

- `options.NoteDisplaySizes` (width/height) — table-wide, from the render key.
- `options.naturalFretWidths`, `options.naturalFontScaling` — table-wide, from the render key.
- `tuning.fixedFretWidthMult` — table-wide, from the render key (folded into `tuningFingerprint`).
- `cellcol` (the cell's fret/column position, a **static** `<td>` attribute) and whether the cell `isNut`
  (also static, from its class list) — never changes for a given `<td>`, and there are only
  `frets (+1 if nut)` distinct columns per table (typically ~13-25), **not** one value per cell.
- `getSong().fretLengths[cellcol]` — a per-column multiplier, also effectively table-wide/static for a
  given tuning (not something that varies over time or by note content).

None of the sizing computation depends on `noteLetter`/`sharpflat`/`noteNum`/`midinum` — i.e., **sizing is
a pure function of `(renderCacheKey, cellcol, isNut)`**, a small (~13-25-entry) table, completely
independent of which specific note-class/cell is being painted. Today it is nonetheless recomputed and
rewritten via jQuery **once per cell, every rebuild** (up to ~144 cells for a 6-string/24-fret guitar).

This means there are two independent, separable costs bundled into the same loop today://
1. **Per-cell content** (`cell.html(cachedHtml)`) — already minimized to a cache lookup by the existing
   `NoteTableRenderCache`, but still applied via one jQuery `.html()` call per cell.
2. **Per-cell sizing** (`fontMultiplier` attr + 2 `.css()` calls) — has a much smaller true state space
   (per-column, not per-cell) than the code currently exploits, and is *not* cached at all today.

## Proposed design: two independently-shippable sub-steps, ordered by risk

Consistent with how phase-3 sequenced Steps A-C by risk, this plan splits "Step D" into two sub-steps.
**D1** stays entirely within the existing DOM structure (no `<td>` destruction, no click-handler/overlay
risk) and directly targets the *measured* cost. **D2** is the more aggressive whole-tbody-markup swap
originally envisioned, kept as a documented, deferred option.

### Step D1 — Cache per-column sizing; apply content+sizing with raw DOM writes instead of jQuery, still one `<td>` at a time

#### Design

1. **Extend `NoteTableRenderCache`'s entry shape** to also cache per-column sizing, alongside the existing
   per-note-class HTML:

   ```js
   // NoteTableRenderCache.js — createEntry() gains a sibling computation, sizingByColumn:
   // Map<cellcol string, { fontMultiplier, tdWidth, tdHeight, noteDisplayFontSize, noteDisplayHeight }>
   // plus a separate nut-specific entry since isNut cells use a different width formula.
   ```

   Computed once per `createEntry()` call (i.e., once per distinct `renderCacheKey`, not once per cell),
   by iterating `tuning.frets (+1 if nut)` distinct columns instead of once per matched `<td>`. This
   collapses what is currently an *O(cells)* sizing computation into an *O(columns)* one — for a typical
   6-string × 24-fret guitar, that's a drop from ~144 recomputations to ~25.

2. **Replace `buildCellsFromSelector()`'s `.each()` body** with raw DOM property/attribute writes instead
   of jQuery wrapper calls, reading from the cached content + sizing instead of recomputing:

   ```js
   cellsSet.each(function (i, obj) {
       const td = obj; // raw element, no `$(this)` wrap needed for reads we already have as attrs
       const midinum = td.getAttribute('midinum');
       const cellcol = td.getAttribute('cellcol');
       const celltable = td.getAttribute('celltable');
       if (!celltable) return;
       const isNut = td.classList.contains('nut') || td.classList.contains('nutR');
       const sizing = sizingByColumn.get(isNut ? 'nut' : cellcol);
       td.innerHTML = NoteTableRenderCache.getHtml(renderCacheEntry, noteClass, midinum) || cellBuilder(...);
       td.setAttribute('fontMultiplier', sizing.fontMultiplier);
       td.style.width = sizing.tdWidth;
       td.style.height = sizing.tdHeight;
       const noteDisplay = td.querySelector('.NoteDisplay');
       if (noteDisplay) {
           noteDisplay.style.fontSize = sizing.noteDisplayFontSize;
           noteDisplay.style.height = sizing.noteDisplayHeight;
       }
   });
   ```

   This keeps every `<td>` node exactly as-is (same identity, same attributes except the intentionally
   updated `fontMultiplier`/inline styles) — **zero risk to click handlers or `replayTable()`'s
   attribute/class-based re-queries**, since nothing about node identity, `class`, `cellrow`, `midiNum`, or
   `celltable` changes.

3. Continue populating/reading the cache exactly as today (phase-4-3's live-populate fix, phase-4-2's
   capacity sizing) — D1 only changes *how* the cached values are applied to the DOM, not the caching
   mechanism itself.

#### Why this is expected to help

- Removes the per-cell sizing *recomputation* (now O(columns) via cache, not O(cells)).
- Removes jQuery's per-call wrapping/dispatch overhead (`$(this)`, `.attr()`, `.css()`, `.children()`) for
  every cell, replacing it with direct DOM property/attribute access — the same category of change that
  phase-2/phase-3's CPU-profile findings pointed at as the dominant cost, addressed at its actual mechanism
  (jQuery call overhead) rather than by trying to avoid calling into the loop at all (which Steps A/C
  already did as much as safely possible).
- No new cache-invalidation surface: sizing is derived from the same `renderCacheKey` inputs already
  tracked; if `options`/`tuning` change, `renderCacheKey` changes, and `createEntry()` recomputes
  `sizingByColumn` fresh, same as it already does for `noteClassHtmlByNoteName`.

#### Risk

Low. No DOM structural change, no click-handler re-binding needed, no change to `replayTable()`'s
assumptions. The main risk is a behavioral regression in the sizing formula itself if the by-column
extraction misses an edge case — mitigated by testing (below) that asserts identical computed
values/output before and after for the same inputs.

### Step D2 — Whole-tbody single-write batched markup (deferred; documented for completeness)

#### Design sketch

Build one HTML string per table representing the entire `<tbody>` (or row-container) content, from the
same cell-construction logic `TableBuilder.js::buildNoteTable()` uses (same classes/attributes per `<td>`,
just refreshed inner content instead of first-time construction), and assign it with a single
`tbody.innerHTML = wholeTableMarkup` per table.

#### Why this remains deferred rather than planned now

- **Requires re-running `installTDNoteClick()` after every whole-table swap** (`<td>` nodes are destroyed
  and recreated), which itself is an O(all `td.note` in the document) rebind today — not scoped to the
  changed table — so it would need to become table-scoped first to avoid paying an unrelated,
  document-wide re-bind cost on every Section transition. That is itself a separate, unreviewed change to
  `installTDNoteClick()`'s selector scope.
- **`replayTable()`'s attribute/class-based re-queries must still find equivalent nodes** after the swap.
  This is achievable in principle (as long as the freshly-built markup produces `<td>` attributes
  byte-identical to what `TableBuilder.js` would produce), but requires either sharing/duplicating
  `TableBuilder.js`'s cell-construction logic inside the cache-entry builder, or refactoring
  `TableBuilder.js` itself to expose a per-cell builder function usable from both places — a larger,
  cross-cutting change.
- **D1's expected win largely overlaps with D2's.** D1 removes both the O(cells) sizing recomputation and
  the jQuery per-call overhead — the two costs phase-4-4's numbers are most directly attributable to.
  D2's *additional* win on top of D1 would be collapsing "N `.html()`/attribute writes" into "1
  `innerHTML=` write," which matters most when N is very large; for typical tuning sizes in this repo
  (dozens to ~150 cells), the marginal benefit is unclear and not worth the added risk without first
  measuring D1's real-world effect.

#### Recommendation

Do not schedule D2 now. Revisit only if a post-D1 capture (same recipe as phases 4-1 through 4-4) still
shows a significant per-table rebuild cost on cache hit/miss after D1 ships.

## Testing plan

- Extend [_tests/jest/note-table-render-cache.test.js](../../../../_tests/jest/note-table-render-cache.test.js)
  with coverage for the new `sizingByColumn` computation in `createEntry()`: assert correct values for a
  nut column vs. a non-nut column, and that `naturalFretWidths`/`fixedFretWidthMult` variations produce the
  expected per-column width.
- Extend [_tests/jest/note-table-controller-markup.test.js](../../../../_tests/jest/note-table-controller-markup.test.js)
  (or a new focused test file) asserting `cellBuilder()`'s output content is unchanged by this refactor —
  D1 does not change what HTML is generated, only how it's written to the DOM and how sizing is computed,
  so existing markup-shape assertions should continue to pass unmodified.
- Per repo convention (browser/jQuery/JSDOM behavior is validated via manual UI acceptance testing, not
  Jest), do not attempt to assert raw DOM write behavior (`td.innerHTML =`, `td.style.width =`) in Jest;
  rely on the console-dump/trace recapture recipe used throughout this sprint
  (`NOTE_TABLE_RENDER_CACHE_TIMING_ENABLED = true`, then a fresh browser capture) to confirm the real-world
  timing improvement, consistent with how phases 4-1 through 4-4 were each validated.
- Full suite: `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`
  must continue to pass (65 suites/698 tests as of this writing) after D1 lands.

## Rollout

- No new feature flag is proposed for D1: it is a drop-in replacement of `buildCellsFromSelector()`'s
  internals with equivalent, cache-backed output — same risk profile as Steps A-C, which also shipped
  without new flags, gated only by the existing `NOTE_TABLE_RENDER_CACHE_ENABLED`.
- If reviewers prefer an extra safety net given this touches the DOM-write mechanism directly (rather than
  just skip/hoist/batch-query logic as in Steps A-C), a temporary local constant analogous to
  `NOTE_TABLE_RENDER_CACHE_ENABLED` (e.g. `NOTE_TABLE_RAW_DOM_WRITE_ENABLED`) could gate D1's raw-DOM path
  vs. falling back to the current jQuery-per-cell path, removable once confirmed stable in real sessions.

## Validation after implementation

1. Full Jest suite (see above).
2. Re-capture a console dump + DevTools trace using the same recipe as phases 4-1 through 4-4: run the
   same `practice/pentatonics-7-m-V7-in-6-keys-with-fill.json` scenario ("full transpose cycle, then loop
   over previously-seen keys") and confirm `cacheState: 'hit'` durations drop from the current ~50-62ms
   toward something closer to `'skipped-unchanged'`'s ~0-0.2ms (some non-zero cost is expected and fine —
   the per-cell DOM writes still happen, just cheaper — full parity with `'skipped-unchanged'` is not the
   goal since that path skips the DOM entirely).
3. Manual UI acceptance testing (per repo convention): loop a song with piano-skeuomorphic tables and
   relative-section Observer tables; confirm no visual regression in note names, cell sizing (including nut
   cells specifically, since they use a distinct width formula), and click-to-color behavior (confirming
   `installTDNoteClick()`'s existing bindings still function, since D1 never destroys/recreates `<td>`
   nodes).

## Summary

| | Removes cellBuilder() string-gen cost | Removes per-cell sizing recompute | Removes jQuery per-call overhead | Requires click-handler rebind | Requires overlay-requery redesign | Risk |
|---|---|---|---|---|---|---|
| Current (post phase 4-3) | Yes (cache hit) | No | No | No | No | — |
| **Step D1 (this plan)** | Yes | **Yes** (cached per-column) | **Yes** (raw DOM writes) | No | No | Low |
| Step D2 (deferred) | Yes | Yes | Yes (single write) | **Yes** | **Yes** | Medium-High |

Step D1 is the recommended next implementation step: it directly targets the exact cost phase-4-4's real
capture measured (~50-62ms per cache hit, dominated by per-cell jQuery DOM writes and redundant sizing
recomputation), without touching DOM structure, click handlers, or the overlay re-query contract that
Step D2 would put at risk.
