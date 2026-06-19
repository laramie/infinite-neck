User: We want to investigate the effect of caching Instrument note tables on app responsiveness while looping.  The biggest hiccup comes when changing Sections, the first beat always gets robbed of realtime clock ticks because the rebuild takes so long.  Subsequent beats are fine because they are just turning classes on and off.

For most songs, there will be between 3 and 6 Sections.  These would benefit greatly from caching, we think, if the memory requirements are reasonable.  We have a sense that simply keeping the other cached tables cached right on the page in a div and setting the div to display:none would get it out of the way, not require breaking a bunch of event handlers, and allow quick swaps without slowing down, because in the profiler our biggest hit seems to be `.html()` and most of that should be setting the sharps/flats and the function names.  The note letter names are constant for each tuning.

So we would think the cache keys would be [tableID,sharps,flats,key,leadKey]

Can you provide an analysis based on the actual code of some strategies for caching?  

No code changes needed at this time.


------

GitHub Copilot: Created 3 todos

Searched for regex `buildCellsFromSelector|buildNoteTable|buildCellsForTable|reinstallAllTuningsTables|class TableBuilder|TableBuilder|function buildCellsFromSelector` (`**/*.js`), 57 results

Read memory infinite-neck-jest.md

Read memory infinite-neck-plugin-actions.md

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#1320-1320), lines 1320 to 1395

Read [](file:///home/laramie/infinite-neck/TableBuilder.js#1-1), lines 1 to 260

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#1-1), lines 1 to 220

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#300-300), lines 300 to 520

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#1020-1020), lines 1020 to 1110

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#220-220), lines 220 to 330

Searched for regex `export function clearAll|function clearAll|removeClass\(|showHighlightsForBeat|function showHighlightsForBeat|export function showHighlightsForBeat` (`**/NoteTableController.js`), 40 results

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#760-760), lines 760 to 980

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#980-980), lines 980 to 1205

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#1390-1390), lines 1390 to 1595

Searched for regex `sectionChanged\(|gotoSection|nextSection|prevSection|loop|restartLoopSections|sectionsLooping` (`**/*.js`), 100 results

Read [](file:///home/laramie/infinite-neck/transport-controller.js#140-140), lines 140 to 220

Read [](file:///home/laramie/infinite-neck/looper.js#1-1), lines 1 to 260

Read [](file:///home/laramie/infinite-neck/looper-transport-timing.js)

Read [](file:///home/laramie/infinite-neck/looper.js#250-250), lines 250 to 389

Searched for regex `gotoNextSection\(|gotoNextSectionStateOnly|gotoSectionStateOnly|gotoNextSection` (`**/Song.js`), 5 results

Read [](file:///home/laramie/infinite-neck/Song.js#1030-1030), lines 1030 to 1115

Searched for regex `requestUiClearAndReplaySection|publish_SectionChanged|requestUiShowBeats|setProviders|UiClear` (`**/Song.js`), 36 results

Read [](file:///home/laramie/infinite-neck/Song.js#960-960), lines 960 to 995

Searched for regex `EventBus\.on\('SectionChanged|SongUiClearAndReplaySection|SongUiShowBeats|SongUiClearAll|SongUiClearHighlights` (`**/infinite-neck.js`), 5 results

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#3200-3200), lines 3200 to 3252

Read [](file:///home/laramie/infinite-neck/transport-controller.js#1-1), lines 1 to 140

Searched for text `getDisplayOptionsInEffect` (`**/Song.js`), 1 result

Read [](file:///home/laramie/infinite-neck/Song.js#1328-1328), lines 1328 to 1355

Starting: *Summarize recommendations* (3/3)

Completed: *Summarize recommendations* (3/3)

No code changes made.

## Key finding

Caching looks viable, but the current section-transition path appears to do more work than necessary before caching is even considered.

On a loop section change, `tickBeat()` calls `song.gotoNextSection(true)` in looper.js. That calls both:

- `publish_SectionChanged()`
- `requestUiClearAndReplaySection()`

in Song.js.

Then the UI event handlers in infinite-neck.js cause:

1. `SectionChanged` → `sectionChanged()`
2. `SongUiClearAndReplaySection` → `clearAndReplaySection()`

But `sectionChanged()` itself already calls `clearAndReplaySection()` after `syncSectionUi()` in infinite-neck.js. So a section transition can replay/rebuild twice, and if `displayOptionsToControls()` runs, it calls `fullRepaint()` too, which calls `resetNoteNames()` again through NoteTableController.js.

That means caching table note displays may help a lot, but there is also likely a direct responsiveness win from eliminating duplicate section-transition repaint/replay work.

## Where the expensive work is

The expensive baseline rebuild is here:

- `resetNoteNames()` gathers display/key options, then calls `resetSharps()` or `resetFlats()` in infinite-neck.js.
- `buildCells()` loops visible tunings in infinite-neck.js.
- `buildCellsForTable()` calls `buildCellsFromSelector()` for all 12 note-name classes in infinite-neck.js.
- `buildCellsFromSelector()` selects cells, calls `cellBuilder()`, sets `.html()`, and recalculates size/style per cell in NoteTableController.js.
- `cellBuilder()` generates the nested `NoteDisplay`, `namedNote`, `tinyNote`, `singleNote`, and `Fingering` HTML in NoteTableController.js.

Your profiler observation makes sense: the note table structure itself is mostly static after `TableBuilder.buildNoteTable()` in TableBuilder.js, while the expensive recurring part is replacing per-cell HTML and styles.

## Cache key

Your proposed key is close, but I would refine it.

For the baseline note-cell rendering, this is not enough:

```text
[tableID, sharps/flats, key, leadKey]
```

The actual `cellBuilder()` / `buildCellsFromSelector()` output also depends on:

- `tableID`
- `sharps` boolean; `flats` is redundant unless future modes are planned
- `rootID`
- `rootIDLead`
- function-symbol array, from `getSong().noteNamesFuncArr`
- `showCellNotes`
- `showSubscriptFunctions`
- `cellIsFunction`
- `showMidiNum`
- `useCenterForRightFunction`
- `NoteDisplaySizes.width`
- `NoteDisplaySizes.height`
- `naturalFretWidths`
- `naturalFontScaling`
- piano options:
  - `pianoHeightScaleFactor`
  - `pianoWidthScaleFactor`
  - `pianoWhiteToBlackWidthRatio`
  - possibly `pianoFingeringHPosition`
- structural tuning fingerprint, if tunings can be edited:
  - `rowRange`
  - `frets`
  - `nut`
  - `reverse`
  - `banjoNut`
  - piano/skeuomorphic options
  - special rows/background flags

The played notes, named notes, highlights, beat playback classes, and recording overlays should probably **not** be in the baseline table cache key. Those are already applied later by `clearAll()`, `replay()`, and `showHighlightsForBeat()` in NoteTableController.js, NoteTableController.js, and NoteTableController.js.

## Strategy 1: skip rebuild when render key has not changed

This is the safest first strategy.

Keep one “last baseline render key” per live `tableID`. When `resetNoteNames()` or `buildCellsForTable()` runs, compute the baseline key. If it matches the table’s current key, skip `buildCellsFromSelector()` entirely.

Pros:

- Small change surface.
- No duplicate DOM IDs.
- No event-handler problems.
- Directly avoids repeated `.html()` calls when returning to a section whose display/key state has already been rendered.
- Helps relative-section observer tables too, because `replayTable()` currently rebuilds relative tables in NoteTableController.js.

Cons:

- First visit to a section/key still pays the rebuild cost.
- If every section has unique key/display options and is visited cold, first loop pass still hiccups unless prewarmed.
- Does not solve duplicate `clearAndReplaySection()` calls.

This would be my first implementation candidate.

## Strategy 2: detached DOM cache per baseline key

Instead of keeping hidden copies on the page, keep cached jQuery/DOM nodes detached in a `Map`.

Important: keeping full cached tables “right on the page” with `display:none` is risky because the generated DOM uses fixed IDs:

- table ID is `Constants.TABLE_ID_PREFIX + options.baseID` in TableBuilder.js
- caption IDs include `tableID` in TableBuilder.js
- many selectors use `#${tableID}` directly, e.g. NoteTableController.js

If hidden cached copies have the same IDs as the live table, the DOM becomes invalid and jQuery selectors can hit the hidden copy or both copies. Global selectors like `td.note`, `.noteDb`, `.noteHighlight`, and `.captionRowTonalInfo` would also start touching hidden caches.

A safer variant:

- Only one table per `tableID` is attached to the live page.
- Other cached variants are detached DOM nodes.
- On section change:
  - detach current baseline node into cache
  - attach matching cached baseline node, or build if missing
  - run replay/overlay pass for current section

Pros:

- Avoids rebuilding the expensive nested note-cell HTML.
- Preserves event handlers if using `detach()` instead of string cloning.
- Avoids duplicate IDs while cached nodes are detached.
- Better cold-to-warm performance than Strategy 1.

Cons:

- More complex invalidation.
- Need to ensure stale transient classes are cleared before caching or after restoring.
- If a user edits notes while a table is live, that live DOM now contains mutable overlay state; the cache must represent only baseline or must be cleaned before storage.
- Direct click handlers installed by `installTDNoteClick()` in infinite-neck.js need care. Delegated handlers would make this easier, but that is a separate behavioral change.

This is probably the best “real cache” architecture, but I would not keep duplicate tables attached with `display:none`.

## Strategy 3: cache generated cell HTML templates, not whole tables

For each render key, precompute the 12 note-class HTML strings generated by `cellBuilder()`.

Then `buildCellsFromSelector()` can reuse strings instead of regenerating them per cell.

Pros:

- Very low memory.
- Simple invalidation.
- No duplicate DOM.
- Still compatible with current selectors/event handlers.

Cons:

- It still calls `.html()` for every cell, which you identified as the big profiler cost.
- It helps CPU string-generation cost, but not layout/DOM mutation cost.

This is useful as a micro-optimization, but likely not enough for the loop hiccup by itself.

## Strategy 4: prewarm baseline cache during idle time

Because most songs have 3–6 sections, prewarming is attractive.

After song load, section edit, display-options save/delete, tuning change, or key change, queue cache generation for:

```text
visible tableIDs × section render keys
```

Use `requestIdleCallback` where available, or chunked `setTimeout(..., 0)` fallback.

Pros:

- Moves first-hit cost away from the realtime loop.
- Works with Strategy 1 or Strategy 2.
- Memory is probably reasonable for 3–6 sections.

Cons:

- Must cancel/invalidate if user changes display options, tunings, function symbols, or song.
- Still main-thread work, so it must be chunked.

Memory estimate: a typical 6-string × 24-fret table is around 144 note cells, but each cell contains several nested elements after `cellBuilder()`. Six sections × six visible tunings could easily mean tens of thousands of cached DOM nodes. That is probably tolerable on desktop, but it argues for detached cache plus an upper bound/LRU rather than hidden duplicate DOM on the page.

## Strategy 5: full section DOM cache

Cache the entire visible instrument area per section.

I would avoid this initially.

The section DOM contains lots of mutable state:

- named-note overlays
- played-note overlays
- transient playback highlights
- caption-row tonal info
- section-status widgets
- wiring/relative-section state
- potentially floated/docked instrument positions

The current architecture expects one set of stable table IDs and applies current section state into it. Full section DOM caching would fight that architecture unless a larger refactor namespaces every cached section.

## Biggest caution: relative-section observers

`replayTable()` explicitly rebuilds relative-section tables with `buildCellsForTable()` in NoteTableController.js. That means a cache needs to account for tables whose visual key is not the current section’s own key, but a relative section’s key/display options.

So the cache should be driven by the effective `replayOptions` / section-in-effect, not just the current section index.

## Recommended path

1. First, profile/confirm duplicate section-transition rebuilds:
   - `Song.gotoNextSection()` publishes section changed and then requests clear/replay.
   - `sectionChanged()` already clears/replays.
   - `displayOptionsToControls()` may call `fullRepaint()` inside that same path.

2. Then implement the lowest-risk cache:
   - per-table baseline render key
   - skip `buildCellsForTable()` when unchanged
   - include relative-section render keys

3. Then add idle prewarming:
   - build all likely section/table baseline keys before the loop reaches them

4. Only then consider detached DOM swapping:
   - detached cache, not hidden duplicate IDs on-page
   - one attached live table per `tableID`
   - clean transient classes before storage or after restore

## Bottom line

Caching is viable and likely useful, but I would not start with hidden duplicate tables in `display:none` divs because the codebase depends heavily on unique table IDs and global jQuery selectors.

The best first design is:

```text
baseline render cache per tableID + effective display/key options,
with skip-if-current-key-matches,
then idle prewarm for the song’s 3–6 section keys.
```

That directly targets the `.html()` rebuild cost while staying compatible with current event handlers and replay logic.