# sprint-141-float-layouts — Iteration 1 Analysis

No code changes were made for this iteration. This is a grounded read of the current
architecture and reported bugs, plus a design proposal and open questions for
Iteration 2.

## 1. Current architecture: how a NoteTable gets onto (or off) the screen

- **Model**: `Song.noteTablesLayout` is an array of plain entries, one per `tableID`
  (e.g. `tblP46_1`), normalized every time it's read by
  [Song.ensureNoteTablesLayout()](../../../../Song.js#L67-L96). Each entry currently
  only reliably carries `tableID`, `visible`, and a handful of boolean/object flags
  (`CaptionLeft`, `SectionStatusLeft`, `ToolDisplayOptions`, etc. — see the allow-list
  in `ensureNoteTablesLayout()`). There is **no floated/position state anywhere in the
  model today.**
- **DOM build**: [infinite-neck.installAllTuningsTables()](../../../../infinite-neck.js#L2073-L2096)
  unconditionally iterates **every** `myTunings` entry, calls
  [TableBuilder.buildNoteTable()](../../../../TableBuilder.js#L13-L20) to construct a
  **brand-new** `<div id="div{baseID}">` / `<table id="tbl{baseID}">` pair, and
  `$('#tabledest').append(div)`. Invisible tables are still built and appended — they're
  just `.hide()`-den afterward based on `Song.isTableVisible()`. There is no check
  anywhere for "does a DOM node with this id already exist (e.g. floating)?" before
  building a fresh one.
- **Reinstall**: [infinite-neck.reinstallAllTuningsTables()](../../../../infinite-neck.js#L2099-L2112)
  empties `#tabledest` and calls `installAllTuningsTables()` again, then re-binds
  `installTDNoteClick()`, `installBtnHamburgerClicks()`, calls `clearAll()`,
  `resetNoteNames()`, `TuningsLibrary.showHideTunings()`, `getSong().getLayout().doToggles()`,
  and `setUIFromNoteTablesLayoutOptions()`. This is the "rebuild everything" hammer that
  fires very often — see call sites below.
- **Floating**: [dockable.js](../../../../dockable.js) is a separate, DOM-only subsystem.
  `makeDivDockable(divId)` does `document.getElementById(divId)`, detaches it from its
  current parent, and re-parents it into a new `floating-{divId}` window appended to
  `document.body`. State (`{parent, next}` for restoring dock position, plus which ids
  are currently floating) lives in **`window._dockableFloatState`**, a page-global that
  is **never cleared or persisted**, and has no relationship to `Song`/`noteTablesLayout`
  at all. `dockDivInPage(divId)` reverses this using the saved live DOM node references.
- **What triggers a full rebuild** (`requestReinstallAllTuningsTables()` /
  `EventBus.trigger('ReinstallAllTuningsTables')`), confirmed via grep:
  - Every MyTunings tab control: `.checkboxLH`, `.checkboxTool`, `.selectFrets`,
    `.selectStringDividerHt`, `.checkboxDoSpecialRows`, `.checkboxPN`,
    `.checkboxPianoSkeuomorphic`, `.checkboxShowDiamonds`, `.checkboxNut`, tuning ID
    rename, clone, move up/down, remove (all in
    [TuningsLibrary.bindFormTuningsEvents()](../../../../TuningsLibrary.js#L810-L1040)).
  - `updateAfterOpenSong()` and `updateAfterAppendSong()` (song load).
  - Adding a tuning, including `createToolCalculatorSingleton()` in
    [calculators.js](../../../../calculators.js).

## 2. Root cause of the reported bugs

Both reported bugs are **the same underlying defect**: floating is a pure DOM-detach
operation with page-global state, while the model/DOM-build layer knows nothing about
it and unconditionally rebuilds every table's DOM node from scratch. This produces
**two elements sharing the same `id`** the moment any rebuild-triggering action happens
while an instrument is floated.

### Bug: "changes in MyTunings tab don't take effect while floated"

1. User floats `tblFoo` → `divFoo`/`tblFoo` are detached from `#tabledest` and
   re-parented under `#floating-divFoo`, appended at the end of `document.body`.
2. User changes e.g. `.selectFrets` → `requestReinstallAllTuningsTables()` fires →
   `reinstallAllTuningsTables()` empties `#tabledest` and calls
   `installAllTuningsTables()`, which builds a **fresh** `divFoo`/`tblFoo` (with the new
   Frets value) and appends it into `#tabledest`. The floating copy is untouched and
   still shows the **old** Frets.
3. Now there are two elements with `id="tblFoo"` in the document: the stale, correct
   (frets-updated is actually on the *new* one, ironically) one docked in `#tabledest`,
   and the old floating one the user is looking at.
4. Repaint code is ID-scoped, e.g.
   [NoteTableController.clearAllForTable()](../../../../NoteTableController.js#L1559-L1583)
   uses `$('#'+tablename+' td.note')`. Per DOM spec, `getElementById`/`#id` selectors
   always resolve to the **first** matching element in document order. Since
   `#tabledest` appears earlier in the page than the floating window (appended last to
   `document.body`), all subsequent repaints/highlights operate on the **new docked
   duplicate**, not the floating window the user is actually looking at — so the user's
   floated window appears frozen/unresponsive to further changes (matches "note-click
   doesn't seem to take effect" too, since the visual feedback lands on the hidden
   duplicate).
5. Docking the instrument removes the ambiguity (only one `tblFoo` remains), which is
   why the report says docking "fixes" it.

### Bug: "reopening a song leaves the old floated window behind + duplicate ids"

1. `window._dockableFloatState` is a page-global, not reset by `openSong()`/
   `updateAfterOpenSong()`. Confirmed: neither function calls
   `disposeAllDockables()` (that function already exists in
   [dockable.js](../../../../dockable.js#L261-L269) but is currently wired only to a
   manual menu action, `"disposeAllDockables"`, in
   [key-handlers.js](../../../../key-handlers.js#L1857-L1859)).
2. Opening a new song calls `EventBus.trigger('ReinstallAllTuningsTables')` →
   `installAllTuningsTables()` builds a fresh `divPerfect4thsCalculator_singleton` for
   the new song's `myTunings` entry, docked into `#tabledest` — with no awareness that
   `window._dockableFloatState['divPerfect4thsCalculator_singleton']` (and the actual
   `#floating-divPerfect4thsCalculator_singleton` DOM node) from the **previous** song
   is still alive in `document.body`.
3. Result: two `id="divPerfect4thsCalculator_singleton"` elements exist — the old
   floating one (orphaned, belongs conceptually to the previous song) and the new
   docked one.
4. **"Float button on the docked instance won't move it"**: `makeDivDockable(divId)`
   guards with `if (!div || floatState[divId]) return;`
   ([dockable.js line 137](../../../../dockable.js#L137)). Since
   `floatState[divId]` is still truthy from the stale prior registration, the function
   returns immediately and does nothing — regardless of which physical duplicate the
   user is trying to float.
5. **"UF button on either affects both"**: the toggle button is rendered per-tableID
   with a shared class + `data-tableid` attribute, and both the click handler and
   `updateToolDisplayOptionsToggleButton()` in `infinite-neck.js` use
   `$(".toolDisplayOptionsToggleButton[data-tableid=\"...\"])`, a **class/attribute
   selector that matches every element satisfying it**, not just one. With two
   duplicate tables there are two duplicate buttons, both selected and updated together.
   The underlying model state (`noteTablesLayout` entry's `ToolDisplayOptions`) is a
   single Song-level record either way, so this is a real symptom of the duplicate-DOM
   problem, not a separate bug.
6. **"clicking to place notes" is similarly confused"**: `installTDNoteClick()` binds
   click handlers directly with a **global** `$('td.note')` selector (not scoped to
   `#tabledest`), so both duplicates' cells get click handlers bound. Clicking a note
   works locally (`$(this)`), but any ID-scoped repaint/highlight step downstream (same
   mechanism as the first bug) can visually land on the wrong duplicate.

**This is a general defect, not specific to Tool-table singletons** — it reproduces for
*any* floated instrument subjected to a MyTunings change or a song reopen. The repro
song in the sprint doc ([songs/tests/Perfect4thsCalculatorTest.json](../../../../songs/tests/Perfect4thsCalculatorTest.json))
happens to use the newly-built Tool-calculator singleton feature
([calculators.js](../../../../calculators.js), sprint 140), which is a convenient,
sharp reproduction case, but the same defect exists for any regular instrument (e.g.
`tblP46_1` floated, then Frets changed on `P46_1` in MyTunings).

## 3. A naming collision to be aware of

`Song` already has a `getLayout()` method and a persisted `song.layout` key — but this
is an **unrelated, pre-existing concept**: [layout.js](../../../../layout.js)'s `Layout`
class governs **screen-level chrome toggles** (fullscreen vs. escaped mode,
`CaptionRow`, `SongTitle`, `WidgetRow`, `InstrumentCaptions`, `LeftRails`,
`CaptionLooperLayout`). It has nothing to do with per-instrument floating/docking.

**Recommendation:** do not name the new floating-window-persistence concept "Layout" —
that name is taken. Whatever we add should either live directly as new fields on the
existing `noteTablesLayout` entries (simplest, and matches the sprint doc's own example
JSON), or, if it grows a dedicated class later, be named something distinct (e.g.
`WindowState`/`FloatState`) to avoid confusion with `Song.getLayout()`.

## 4. Persistence/schema gap already present today (found during this analysis)

[bin/song-file-schema.js](../../../../bin/song-file-schema.js#L287-L295)'s
`noteTableLayoutEntrySchema` currently only declares `tableID` and `visible` as allowed
properties, with `additionalProperties: false`. It has **not** been updated for
`ToolDisplayOptions`, `CaptionLeft`, or `SectionStatusLeft`, which the runtime model
(`Song.js`) already writes and reads. This is the same class of pitfall already
recorded in project memory around `chartOptions` (a new persisted key requires a schema
update, or `song-load-library.test.js`-style validation will reject it). Whatever new
field(s) are added for float persistence (see below) **must** also be added to this
schema, and the existing gap (`ToolDisplayOptions`/`CaptionLeft`/`SectionStatusLeft`)
should probably be closed in the same pass since it's the identical oversight.

## 5. What persisting "floated" state requires — proposed shape

Given the sprint doc's own example, the natural, minimal-diff approach is to extend
each `noteTablesLayout` entry in place — no new top-level Song property, no new class:

```jsonc
{
  "tableID": "tblPerfect4thsCalculator_singleton",
  "visible": true,
  "floated": true,
  "floatRect": { "left": 100, "top": 100, "width": 480, "height": 220 }
}
```

- `floated` (boolean, default/omitted = docked) drives whether, after tables are built
  on song load, `makeDivDockable(divID)` should be invoked for that table.
- `floatRect` is optional/best-effort position+size restore. Without it, a restored
  floating window would always reappear at `dockable.js`'s hardcoded default
  `top:100px; left:100px` (see [dockable.js](../../../../dockable.js#L148-L149)) — not
  wrong, but not "restoring where you left it" either, which the sprint doc's goal
  statement calls for ("the location it ends up being dragged to saved on File
  Download").

This only requires:
- Extending `ensureNoteTablesLayout()`'s allow-list (same pattern already used for
  `ToolDisplayOptions`) to preserve `floated` (boolean) and `floatRect` (object).
- Extending `noteTableLayoutEntrySchema` in `bin/song-file-schema.js` to match.
- A `Song.setTableFloated(tableID, floated, rect)`-style setter, mirroring
  `setToolDisplayOptions()`'s existing pattern.

## 6. Why persisting the flag is necessary but **not sufficient**

Persisting `floated`/`floatRect` only fixes "the song file remembers where things
were." It does **not** fix the duplicate-id bugs above, because those are caused by
`installAllTuningsTables()`/`reinstallAllTuningsTables()` being completely unaware of
live floating DOM state, model-persisted or not. Both problems need to be solved
together, or the reopened-song bug simply becomes "reopen a song with a floated
instrument → duplicate immediately," i.e. the exact bug already reported, just via a
newly-*intentional* path instead of an accidental one.

**The real architectural fix needed** is making instrument DOM **singleton-per-tableID**,
matching the recommendation already reached independently in a prior design
conversation captured in
[_chat_conversations/infinite-neck/LayoutManager-GPT-5.4-response.md](../../../../_chat_conversations/infinite-neck/LayoutManager-GPT-5.4-response.md)
(finding 1 and the "most important architectural shift" note at the end of that
document — still accurate, and directly explains today's reported bugs). Concretely,
`installAllTuningsTables()` must stop unconditionally creating a new div/table for
every tuning on every rebuild. Instead, for each tuning it should:
- Check whether a live DOM node for that `tableID` already exists **anywhere in the
  document** (docked in `#tabledest` *or* inside a `#floating-{divID}` window) before
  building a new one.
- If it exists and is currently floating, leave it in place (don't touch `#tabledest`
  for it) — but this raises a secondary question: how do MyTunings changes (Frets,
  reverse, showDiamonds, etc.) that require literally regenerating the `<table>`
  markup get applied to an already-floating instance without destroying its floating
  wrapper? Two options to weigh in Iteration 2:
  1. **Rebuild-in-place**: locate the existing table's *contents host* (whatever its
     current parent — `#tabledest` or the floating window's content div — and replace
     just the inner `<table>`, leaving the outer float chrome untouched).
  2. **Never destroy structural options while floated**: gate the structural MyTunings
     controls (Frets, reverse, etc.) to require docking first (simpler, but degrades
     the "don't need to dock to edit" expectation implied by the bug report).
  Option 1 is more correct and is the natural fit with a singleton-DOM-instance model;
  it is more work.

## 7. Sequencing problem for restore-on-load

`dockDivInPage()` restores a floated element using a **live DOM node reference**
captured at float-time (`floatState[divId] = { parent: div.parentNode, next: div.nextSibling }`,
[dockable.js line 141-144](../../../../dockable.js#L141-L144)). That reference cannot
be serialized/persisted across a song reload — it's not data, it's a live pointer.

This means restore-on-open must:
1. Run the normal build/insert pass first (`installAllTuningsTables()`), so every
   table's div lands in its correct `#tabledest` position/order according to
   `noteTablesLayout` — this naturally establishes the correct "where do I go back to
   when un-floated" anchor.
2. **Only then** call `makeDivDockable(divID)` (optionally passing the saved
   `floatRect`) for every entry whose `floated === true`, lifting it back out.

Doing it in the other order (float first, insert later) would leave no valid dock
anchor for a future "un-float" click.

## 8. Related existing gaps worth folding into the same iteration

- **`window._dockableFloatState` is never cleared on song open.** Even without any new
  persisted floating state, calling the *already-existing* `disposeAllDockables()`
  (currently only reachable via a manual menu action) at the start of
  `updateAfterOpenSong()`/`updateAfterAppendSong()` would, by itself, fix the
  "old floated window stays around after reopening a song" half of bug 2 — independent
  of whether we ever implement floated-state persistence. This looks like a
  small, self-contained, low-risk fix candidate for Iteration 2's first PR.
- **No z-index/stacking order is tracked.** Every floating window gets the same
  hardcoded `zIndex: 200` ([dockable.js](../../../../dockable.js#L152)); stacking is
  purely DOM-append-order. Not blocking for this sprint's stated goal, but worth a
  one-line mention if multiple floated windows' visual overlap order matters later.
- **No resize capture exists at all.** The floating window's `resize: both` is native
  browser CSS resize with no `ResizeObserver`/event wired up anywhere — only *position*
  is live-tracked (via `drag.js`'s `mousemove` handler, and not persisted either).
  Capturing `floatRect.width/height` for save will need either a `ResizeObserver` on
  each floating window, or a "read final `getBoundingClientRect()` at save-time" approach
  (see next section) — the latter avoids adding new live event wiring entirely.

## 9. Open design questions for Iteration 2 (need a decision before coding)

1. **When to capture `floatRect`?** Two viable options:
   - **(a) Live-capture on drag-end/resize-end** — needs new event wiring (mouseup
     already exists in `drag.js`; resize would need a `ResizeObserver`). More
     complexity, but state is always fresh even without an explicit save.
   - **(b) Capture-at-save-time only** — `updateMemoryModelPreFileSave()`
     ([infinite-neck.js](../../../../infinite-neck.js#L2013-L2023)) already exists as a
     "last-minute sync before serializing" hook; it could simply read
     `getBoundingClientRect()` (or the inline `style.left/top/width/height`) of every
     currently-floating window and write it into that table's `noteTablesLayout` entry
     right before `getPersistentSongFile()` serializes. Simpler, no new event wiring,
     and matches the existing "sync happens right before save" pattern already used for
     `bpm`/`songName`/`theme`/etc. **This looks like the lower-risk option.**
2. **Pixel vs. relative units for `floatRect`?** Raw `left/top/width/height` px (matching
   dockable.js's current inline styles) is simplest, but won't translate well across very
   different viewport sizes/devices. `clampAllDockablesToViewport()`/
   `clampOneDockableToViewport()` already exist and run on window resize — reusing them
   immediately after restoring any floated window on load is a cheap, already-available
   safety net regardless of which unit choice is made, and is recommended either way.
3. **Docked-list order interplay**: when a table is floated, should it stay listed
   (just visually elsewhere) in `noteTablesLayout`'s order for the purpose of MyTunings
   move-up/move-down, or does floating implicitly "remove" it from the ordered docked
   list until re-docked? Current code (`moveTableInLayoutByBaseID`, `#tabledest`
   ordering) has no floated-awareness at all today, so this needs an explicit answer.
4. **Multiple floated windows referencing the same underlying model row**: does the
   fix for the "singleton DOM per tableID" issue also need to reconsider the
   Tool-calculator singleton pattern in `calculators.js` (which already does its own
   "already registered?" check against `myTunings`, but not against live floating DOM),
   or will the general `installAllTuningsTables()` fix subsume it? Recommendation:
   the general fix should subsume it — `createToolCalculatorSingleton()` should not need
   its own duplicate-prevention logic once `installAllTuningsTables()` is float-aware.

## 10. Recommended scope split for Iteration 2

**Small, independent, low-risk fix (do first, arguably even before persistence):**
- Call `disposeAllDockables()` at the top of `updateAfterOpenSong()` and
  `updateAfterAppendSong()`'s `importOptions.sections` branch, so stale floats from a
  previous song never survive a new song load. This alone removes half of bug 2 with a
  one-line change and no schema/model work.

**Core Iteration 2 feature work (needs the architecture fix, not just persistence):**
1. Make `installAllTuningsTables()` (and by extension `reinstallAllTuningsTables()`)
   float-aware: skip/rebuild-in-place for any `tableID` that already has a live
   floating DOM instance, instead of unconditionally creating a fresh docked duplicate.
2. Add `floated`/`floatRect` fields to `noteTablesLayout` entries: allow-list additions
   in `ensureNoteTablesLayout()`, a `Song.setTableFloated()`-style setter, and schema
   updates in `bin/song-file-schema.js` (also closing the pre-existing
   `ToolDisplayOptions`/`CaptionLeft`/`SectionStatusLeft` schema gap found above).
3. Capture `floatRect` at save-time via `updateMemoryModelPreFileSave()` (recommended
   option 9.1(b)) rather than live drag/resize event wiring.
4. On load, after `installAllTuningsTables()` places every docked instance in its
   correct position/order, iterate `noteTablesLayout` and call `makeDivDockable()`
   (with the saved rect) for every `floated === true` entry, then run
   `clampOneDockableToViewport()` on each restored window.
5. Regression fixture: add a variant of
   `songs/tests/Perfect4thsCalculatorTest.json` with `"floated": true` (and a
   `floatRect`) set on the singleton's layout entry, to serve as the load/restore test
   case once implemented.

No code changes have been made in this iteration; the above is proposed scope and
sequencing for review before Iteration 2 implementation begins.
