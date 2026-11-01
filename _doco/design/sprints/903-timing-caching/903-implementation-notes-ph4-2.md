# Sprint 903 timing-caching — Phase 4 (continued): cache-capacity exhaustion during key cycling

date: 20260831

## Context

A follow-up real-world capture was supplied after the phase-4 duplicate-`fullRepaint()` fix
(see [903-implementation-notes-ph4-1.md](903-implementation-notes-ph4-1.md)) landed and was confirmed working:

- Song: `practice/pentatonics-7-m-V7-in-6-keys-with-fill.json` (2 visible tables:
  `tblP46_main`, `tblS6_listener`; the "-with-fill" listener table is populated via a plugin/relative
  wiring, not a static Section).
- `console-timing-phase-4-1.log` / `Trace-phase-4-1.json` — captured after running "a full transposition
  chroma cycle, then at a high BPM, started tracing while looping over keys that had already been seen at
  least once."

Observation: "Very snappy, but has palpable bump on new Section" — a *different* residual bump from the
one fixed in phase-4-1, since this song exercises many distinct musical keys (not just repeatedly the
same rootID/sharps combo like the earlier single-key test song).

## Investigation

First confirmed the phase-4-1 fix is still working here too: no duplicate `buildCellsForTable` log lines
per `sectionBoundary` in this capture.

Then found a new, distinct issue by reading the `[NoteTableTiming]` payloads:

- `renderCacheKeyHash` values: **12 distinct keys** appear across the log (6 keys × 2 tables — matches the
  song name "6-keys").
- `NoteTableRenderCache.stats()` in every `sectionBoundary`/`prewarmSection` line reports
  `maxEntries: 6` — i.e. the shared cache pool can only ever hold **half** of this song's actual working
  set of 12 distinct (table, key) combinations.
- Every `cacheState: 'miss'` event in the log costs a real, measured **45.7ms–91.9ms** (12 miss events
  found, none faster than 45.7ms) — this is genuine, synchronous rebuild cost sitting directly in the
  `sectionChanged()` → `clearAndReplaySection()` → `resetNoteNames()` → `buildCells()` critical path, not
  hidden async work.
- `hits: 0` in every single stats snapshot in the entire log — the cache never once served a `'hit'`,
  because entries are evicted (LRU, by `createdAt`) long before the user cycles back to a previously-seen
  key.

### Root cause

[`prewarmNoteTablesForSection()`](../../../../infinite-neck.js#L1417) sizes the shared, global
`NoteTableRenderCache` pool with:

```js
NoteTableRenderCache.setMaxEntries(Math.max(1, song.getVisibleTunings().length * 3));
```

This gives only **3 cache slots per visible table** (6 total for this 2-table song), which is enough for a
scenario where a song only ever visits ~3 distinct keys (like the phase-4-1 test song, which used exactly
one key throughout). It is far too small for a song that legitimately cycles through more keys than that —
this exact risk was already flagged (but not fixed) in phase-2's
[903-timing-revisited-plan-1.md](903-timing-revisited-plan-1.md#L67) item 4: *"`maxEntries` is a global
cap shared across all tables, not a per-table budget... fragile."*

With only 6 total slots shared across 2 tables and 12 real (table, key) combinations to keep warm, the
cache is in a state of near-constant eviction/refill — so "looping over keys that had already been seen at
least once" still produces a full ~45-90ms synchronous rebuild almost every time the key changes, because
the earlier entry for that key was pushed out of the pool long ago.

## Fix

Bumped the per-table cache budget from 3 to 12 slots (i.e. `visibleTunings.length * 12` instead of `* 3`)
in [infinite-neck.js](../../../../infinite-neck.js#L1417). 12 was chosen because it comfortably covers a
full chromatic 12-key cycle per visible table (the exact scenario the user tested), with some headroom for
sharps/flats key-spelling variants of the same root. This is still a bounded LRU cache (each entry is just
a small object of cached HTML strings per note-class), so the memory cost of a larger cap is negligible.

This is a minimal, low-risk tuning change (a single constant), not the larger per-table-quota redesign
also suggested in the phase-2 plan doc — that remains a "design-level, not yet decided" option if an even
larger or more dynamic working set (many more tables, or very large chromatic+relative-section combos)
is encountered later.

## Validation

Full Jest suite passes unchanged: 65 suites / 698 tests.

## Follow-up (not done here)

- Re-capture a console dump/trace during the same "full chroma cycle then loop over seen keys" scenario to
  confirm `cacheState: 'hit'` now appears (it never once did in the pre-fix capture) and miss durations
  drop to near-zero on repeat key visits.
- If songs with more than ~2 visible tables and full chromatic cycling are common, consider the per-table
  LRU quota redesign from the phase-2 plan instead of a single shared global pool, so one table's key
  churn can never evict another table's entries.
