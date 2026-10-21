# Sprint 148 (displayOptions-diff), Iteration 5, Round 1: implementation plan for the DisplayOptionsMatrix

date: 20261020

Requested by [148-it5-design.md](148-it5-design.md).  Builds on the accepted Iteration 4 work ([Round 3 report](148-it4-round-3-implementation-report.md), [Round 5 report](148-it4-round-5-implementation-report.md)).  Sprint overview: [sprint-148.md](sprint-148.md).

**No code was changed.**  Everything below comes from reading the code (files are linked where it matters).  Nothing has been run in a browser.

Vocabulary: **/vdd** = the static report ([display-options.js](../../../../display-options.js)).  **Matrix** = the new interactive widget.  **cell** = one key in one Section.  **Zone** = an area of the Matrix table that a click can land on (section 3).  **Tool** = the selected radio verb.

## 0. Summary

1. **Nothing in the Song file format changes.**  The Matrix is a front end over the primitives that already exist and passed UA: `planGate`, `planClear`, `planClearCell`, `planSaveDiff`, `planSaveAll`, `applyPlan` and the one-level undo in [displayOptionsPlan.js](../../../../templates/display-options/displayOptionsPlan.js).  The new work is mostly (a) a pure click-to-plan translator, (b) a pure HTML builder, (c) a thin DOM builder, and (d) a few small hooks in [infinite-neck.js](../../../../infinite-neck.js).
2. **Eight holes in the design** need your decision before coding (section 2).  The most important:
   - The Tools list has **no way to set a cell gate or clear a cell** (the intro mentions Clear Cell, the Tools list does not).  Cell gates would remain command-line only.
   - **Gate and clear edits do not change the controls** (Round 3 Q10), so after a click nothing visibly changes in the Instruments until the next navigation.  The mouse UX promises "click, then observe the Instruments".
   - **The Matrix must not open Messages**, but every current command does (`Messages.showMessages()` also scrolls the page and hides the command line).  A quiet path is needed.
   - **`/vdd` skips Sections that store nothing**; the Matrix needs every Section as a row (nav link, Section tools).
   - **/vdd merges column, row and cell gates into the same CSS classes**, so "View Column Gates" and "View Row Gates" cannot be turned off separately until the cells carry per-source classes.
   - **Clear Section is the one broad destructive Tool** in a design that otherwise protects cell values by keeping row and column Tools non-destructive.
   - **Floating:** `disposeAllDockables()` (called on every Song open) deletes a floated div, so a floating Matrix would be destroyed.
   - **The Matrix has no SAVE Diff**, but a floating Matrix is the point of the Float button: it would sit away from the View page's SAVE Diff.
3. **Architecture (section 4):** same split as Iteration 3 and 4: pure Jest-tested modules (`displayOptionsMatrixTools.js`, `displayOptionsMatrixView.js`) and a thin builder (`display-options.builder.js`).  The builder has no logic that Jest cannot reach: it sets `innerHTML`, binds delegated clicks, and calls the pure functions.
4. **Update strategy (section 6):** a full rebuild only when the model changes; the loop path (Section change, live controls) patches the Current-Section highlight and the LIVE row in place and does nothing while the Matrix is hidden.  Cells are therefore never replaced under the mouse during looping.
5. Twenty questions (section 9): **Q1-Q10 change behavior** and need an answer; **Q11-Q20 are minor** and the recommendation is used if you do not object.

## 1. What exists today (facts the plan relies on)

| Area | Fact | Where |
|---|---|---|
| Primitives | Plans take indexes, not text: `planGate(song, {scope, sectionIndex, key, direction, on})`, `planClear(song, idx)`, `planClearCell(song, idx, key)`, `planSaveDiff`, `planSaveAll`; `applyPlan` returns `{changed, report}`; `undoLastDisplayOptionsOp`, `canUndoDisplayOptionsOp` | [displayOptionsPlan.js](../../../../templates/display-options/displayOptionsPlan.js) |
| Command wrappers | `clearDisplayOptionsCell(sectionNumberText, key)`, `setDisplayOptionsGate({...on})` take 1-based text and only **set or remove** (no toggle); both go through `finishDisplayOptionsModelChange()` | [infinite-neck.js](../../../../infinite-neck.js#L3697) |
| Reporting | `finishDisplayOptionsModelChange()` always runs `UserLog.addToUserLog()` **and** `Messages.showMessages()`.  The latter shows the Messages panel, hides the command line and scrolls the page ([Messages.js](../../../../Messages.js#L18)).  The UserLog write alone only appends a row | same, [UserLog.js](../../../../UserLog.js#L57) |
| Bus event | `DisplayOptionsModel:changed {report}` is triggered by `finishDisplayOptionsModelChange()` when the model changed.  Nobody listens yet | same |
| Section event | `Song.publish_SectionChanged()` triggers `SectionChanged {sectionIndex}`; [infinite-neck.js](../../../../infinite-neck.js#L4984) registers its own handler at module load, so any widget handler registered later (at mount) runs **after** `sectionChanged()` has synced the controls | [Song.js](../../../../Song.js#L1200) |
| Live controls | `controlsToDisplayOptions()` is exported and reads the DOM.  The single choke point for "a control changed" is `refreshDisplayOptionsSaveActionRequired()`; it does not publish an event | [infinite-neck.js](../../../../infinite-neck.js#L741) |
| Dirty highlight | `setDisplayOptionsSaveActionRequired()` toggles only `#btnSaveDiff_View` (the Section drawer's `#btnSaveDiff_Section` is not highlighted) | same, [L713](../../../../infinite-neck.js#L713) |
| /vdd rows | `displayOptionsTable()` **skips** a Section with no `displayOptions` and no gates (it draws a dashed top border on the next row instead) | [display-options.js](../../../../display-options.js#L97) |
| /vdd classes | A cell gets `gateClasses(blocks.column, blocks.row, blocks.cell)`: one `gateRead`/`gateWrite` pair **merging all three sources**, plus `cellGateRead`/`cellGateWrite`/`cellGateReadWrite` for the cell source only.  Backgrounds are **inline styles** (`#303030`, `chartreuse`, `white`) | same, [L106-L117](../../../../display-options.js#L106) |
| Templates | Pattern is `templates/<name>/<name>.html` (a `<template>`), `.css` (linked in [index.html](../../../../index.html#L41)), `.builder.js` (`addToDest('#host')`, mounted from `loadTemplates(...)` in [infinite-neck.js](../../../../infinite-neck.js#L4912)) | [function-symbols](../../../../templates/function-symbols/) |
| Navigation | `linkToSection(idx)` calls `getSong().gotoSection(idx)` (the Theme Matrix uses it) | [infinite-neck.js](../../../../infinite-neck.js#L3057) |
| Floating | `makeDivDockable(divId, 900)` re-parents the div into a body-level window and **hides `#btnFloatSection_<divId>`**; `dockDivInPage(divId)` restores it to its original parent and un-hides that button.  `hideAllMenuDivs()` docks only the divs in `AllMenuDivs` | [dockable.js](../../../../dockable.js#L284) |
| Dispose | `disposeAllDockables()` is called by `updateAfterOpenSong()`, by append-sections import, and by the `disposeAllDockables` menu command.  It **removes the floating window element**, and the div inside it is removed with it | [dockable.js](../../../../dockable.js#L464) |
| Metadata | `DISPLAY_OPTION_META[key]` has `group` (`Color`, `Cell text`, `Layout`, `Piano`, `Hide`, `Opacity`, `Looper`, `Fonts`, `Tiny notes`), `kind`, `gate` (adapter), `hasDefault` | [displayOptionsMeta.js](../../../../templates/display-options/displayOptionsMeta.js) |

## 2. Holes in the design

**H1. No cell-level Tools.**  The UX text says "Clear Cell" is a Tool, but the Tools list is Inspect, Clear Section, and the four block Tools.  The block Tools "don't affect cell gates", and no Tool sets one.  So today's `/vpmgac`, `/vpmgdc` (cell gates) and `/vpmc` (clear one cell) have no mouse equivalent, and a cell-read gate (the Round 4 semantics: "ignore this cell") is the main use of cell gates.  **Add:** Clear Cell, Cell read-block, Cell write-block (toggles).  Also worth adding: **Store Cell** (write this key's LIVE value into this Section's cell, honoring gates): the "single-cell store" that Iteration 4 explicitly deferred, and the natural way to fix one cell without SAVE Diff touching others.  Q1.

**H2. Edits do not change what you see.**  Round 3 (Q10) decided that gate, clear and undo commands never re-apply the controls.  On the command line that is fine; with a mouse, "click rows, columns and cells and then observe the Instruments and Looping" does not work: toggling a column read-block changes nothing on screen until you navigate away and back.  **Proposal:** an **Apply** button (Additional Buttons) that re-runs the Current Section's apply; it is exactly `sectionChanged()` (what navigating to the same Section does).  Unsaved live edits are overwritten, which the magenta SAVE Diff already warns about.  Optional: an "Auto-apply after Matrix edits" toggle, default off.  Q2.

**H3. Messages.**  Each handler calls `Messages.showMessages()`, which pops the panel and scrolls the page, the exact thing the Matrix is meant to avoid.  **Proposal:** `finishDisplayOptionsModelChange(result, { quiet })`.  When quiet it still writes the UserLog row (an audit trail that does not open the panel) and returns the report; the Matrix shows the report in a one-line status area under the Tools (`skipped showMidiNum (write-blocked)`, `removed noteFont`, `nothing to clear`).  The future "hide Messages" checkbox can reuse the same flag.  Q3.

**H4. Sections that store nothing.**  /vdd hides them (and marks the gap with a dashed border).  The Matrix needs **every Section as a row**: it is the nav list, and a Section Tool (Section read-block, Clear Section) is only clickable on a row that exists.  Empty rows are all dark gray (`#303030`), so a long Song's Matrix is as tall as the Song.  This needs vertical scrolling (H5).  Q4.

**H5. Height.**  Header, DEFAULTS and LIVE are three rows above the Sections, and the biggest Song has 46 Sections: the Current Section is easily off-screen.  **Proposal:** the Matrix proper scrolls inside a container (`max-height` about 60vh, `overflow: auto` both ways) with **sticky** header, DEFAULTS and LIVE rows, and a sticky first column.  On `SectionChanged` the container scrolls the Current row into view only if it is outside the container's visible area, and only the container (never `scrollIntoView`, which scrolls the page).  Q11.

**H6. Gate classes are merged.**  "View Column Gates" and "View Row Gates" are overlays that must turn off independently.  /vdd's `gateRead` on a cell means "column OR row OR cell", so CSS cannot tell which source it was.  **Proposal:** the Matrix emits **per-source classes** (section 5.2) and a wrapper class per overlay (`dmHideColGates`, `dmHideRowGates`) that neutralizes just that source's rules.  /vdd is untouched (it keeps its merged classes).  I would port the current look into `display-options.css` one-to-one so the Matrix opens looking like /vdd, and you tune it from there.  Q5.

**H7. Clear Section is broad and destructive.**  The design's safety argument is "column and row clicks never destroy cell values, and the cell Tools are granular".  Clear Section deletes a whole row of values (gates survive).  **Proposal:** the destructive Tools (Clear Section, Clear Cell) are **one-shot**: after one use the Tool snaps back to Inspect, so a second stray click cannot delete again; the gate Tools stay selected (repeat clicking is their purpose).  Undo (one level, shared with `/vpmu`) remains.  Q6.

**H8. Floating.**  Three findings:
   - `disposeAllDockables()` destroys a floated Matrix on every Song open (and on the `disposeAllDockables` menu command).  **Proposal:** call `DisplayOptionsMatrixBuilder.dockBeforeDispose()` (which is `dockDivInPage('divDisplayOptionsMatrix')`, a no-op when docked) immediately before those three calls.  No change to [dockable.js](../../../../dockable.js).  Q7.
   - The Float button must be named `btnFloatSection_divDisplayOptionsMatrix`, which `makeDivDockable` hides and `dockDivInPage` restores by itself.
   - The floating window's content host has a black background, so the Matrix needs its own white background and a `min-width`.
   - A floating Matrix is not tied to the View page being open (the View div is closed by `hideAllMenuDivs()`, the Matrix stays).  That is what you want; it only matters because a floating Matrix then needs its own **SAVE Diff** button (Q8), and live updates continue only while it is visible.

**Smaller observations (no decision needed):**
- **Same-Section navigation under Inspect:** `linkToSection(currentIndex)` repeats `sectionChanged()`; harmless, and it doubles as "Apply".
- **Adapter gates** (`NoteDisplaySizes` off while Presentation Mode is off; `sectionTheme` off while Allow Theme Automation is off) already show as `a:` on the header.  Key Tools toggle only the explicit Song gate; Inspect explains the adapter block.  Q16.
- **`false` is a blank in /vdd** (a stored `false` is a green or white blank).  In an interactive table a blank stored cell looks like a bug.  Q12.
- **Long text** (`noteFont`, `sectionTheme`, color dictionary names) widens columns.  CSS clips with an ellipsis and a `title` shows the full text.
- **Closing the Messages-based debugging flow:** `/vdd` stays exactly as it is, so a before/after report remains possible.

## 3. Zones, Tools and what a click does

### 3.1 Zones

```
+----------+------------------------------------------------+
| corner   | key header (vertical text), one per key        |   Z0 / ZH
+----------+------------------------------------------------+
| DEFAULTS | default values (white, immutable)              |   ZL / ZS
| LIVE     | live control values (white, immutable)         |   ZL / ZS
+----------+------------------------------------------------+
| 1 (link) | cells: stored / inherited-equal / absent       |   ZR / ZC
| 2        | ...                                            |
+----------+------------------------------------------------+
```

| Id | Zone | Carries |
|---|---|---|
| Z0 | corner ("Section #" and the blank cell at 0,0) | nothing, never clickable |
| ZH | key header | `data-key` |
| ZL | label of DEFAULTS / LIVE | nothing, never clickable |
| ZS | cell of DEFAULTS / LIVE | `data-key` |
| ZR | Section header (number, nav link) | `data-section` |
| ZC | Section cell | `data-section`, `data-key` |

### 3.2 Tools (proposed set; Q1 changes it)

| Tool | Group | Legal zones | Effect | One-shot? |
|---|---|---|---|---|
| Inspect | - | ZH, ZS, ZR, ZC | ZR: navigate to that Section.  Others: fill the Inspect line (section 3.3).  Never changes the model | no |
| Clear Section | Clear | ZR, ZC | `planClear(song, idx)` for that Section (values only; write-blocked cells are skipped and reported) | yes |
| Clear Cell (H1) | Clear | ZC | `planClearCell(song, idx, key)` | yes |
| Key read-block | Gate | ZH, ZS, ZC | **toggle** the Song read gate on `key` | no |
| Key write-block | Gate | ZH, ZS, ZC | **toggle** the Song write gate on `key` | no |
| Section read-block | Gate | ZR, ZC | **toggle** the Section row (`*`) read gate | no |
| Section write-block | Gate | ZR, ZC | **toggle** the Section row (`*`) write gate | no |
| Cell read-block (H1) | Gate | ZC | **toggle** that cell's read gate | no |
| Cell write-block (H1) | Gate | ZC | **toggle** that cell's write gate | no |
| Store Cell (H1) | Store | ZC | `planStoreCell`: write this key's LIVE value into this Section (skips with a reason if gated) | yes |

Clicks anywhere not legal for the Tool do nothing and say so in the status line (`Section tools need a Section row or cell`).  A toggle is decided from the model at click time: the gate is currently set, so remove it; else add it.  So two clicks always return to the start, and Undo can restore the last change.

### 3.3 Inspect line

One status area under the Tools, filled on an Inspect click, from the pure `describeCell(song, sectionIndex, key, {live})`.  It uses the resolver's `entries[key].source` (`stored | default | blocked`) and `describeBlocks()`:

```
Section 3, noteFont
  stored here: "Cardo"   (inherited would be: "Eczar", from Section 2)   [differs: SAVE Diff would keep it]
  gates: column r (read-blocked) | row - | cell w (write-blocked)
  effect: navigating to Section 3 leaves the noteFont control alone (column read gate).
          SAVE Diff / Save All / Clear skip this cell (cell write gate).
```

This is the one place the two meanings of "read-blocked" (cell: *ignore this value*; row, column, adapter: *leave the control alone*) are spelled out.  Header and DEFAULTS/LIVE clicks show the column's group, default, live value, and Song gates.

## 4. Architecture

All new files are under [templates/display-options/](../../../../templates/display-options/).  Pure modules take plain objects (no `$`, no `document`) so they run under Jest, as in Iteration 4.

| File | Kind | Responsibility |
|---|---|---|
| `displayOptionsMatrixTools.js` | pure | `TOOLS`, `ZONES`; `planMatrixClick(song, tool, zone, {sectionIndex, key}, {live, syncLive})` returns `{kind:'none', reason}`, `{kind:'navigate', sectionIndex}`, or `{kind:'plan', plan}`; `isGateSet(...)`; `describeCell(...)`.  Toggles are built from `planGate` with the computed `on` |
| `displayOptionsPlan.js` (existing) | pure | add `planStoreCell(song, idx, key, live)`; `knownKeysOf` already skips `undefined`/`null` |
| `displayOptionsMatrixView.js` | pure | `buildMatrixHtml(song, {currentIndex, live, view})` (header, DEFAULTS, LIVE, Section rows), `buildLiveRowCells(live)`, `buildLegendHtml()`, the class vocabulary (section 5.2), `cellText()` shared with /vdd (Q9) |
| `display-options.html` | markup | a `<template id="display-options-matrix-template">` with the areas of the design: Additional Buttons, View Options, Tools, status line, scroll container, Legend button and Legend |
| `display-options.css` | styles | layout, sticky rows and column, per-source gate classes, wrapper overlay classes, hover preview, Legend |
| `display-options.builder.js` | DOM | `DisplayOptionsMatrixBuilder`: `addToDest`, `refresh`, `onSongOpened`, `dockBeforeDispose`; binds clicks; calls the pure modules and the new [infinite-neck.js](../../../../infinite-neck.js) entry points |

### 4.1 Hooks in infinite-neck.js (the only top-level code changes)

1. `finishDisplayOptionsModelChange(result, { quiet = false } = {})`: when quiet, skip `Messages.showMessages()`; still write the UserLog and trigger `DisplayOptionsModel:changed`.  Existing callers keep the old behavior.
2. New export `runDisplayOptionsPlan(plan, { quiet })`: `applyPlan` then `finishDisplayOptionsModelChange`; returns `{changed, report}`.  The builder uses it for every plan, plus `undoDisplayOptionsOp({quiet:true})` and `handleBtnSaveAll({quiet:true})`.
3. `refreshDisplayOptionsSaveActionRequired()` triggers `DisplayOptions:liveChanged` (coalesced in the builder).
4. `setDisplayOptionsSaveActionRequired()` also toggles `#btnSaveDiff_Matrix`.
5. Presentation Mode and Allow Theme Automation `change` handlers trigger `DisplayOptionsModel:changed` (they change the adapter marks on two columns).
6. `updateAfterOpenSong()`, the append-sections import and the `disposeAllDockables` command call `DisplayOptionsMatrixBuilder.dockBeforeDispose()` first; `updateAfterOpenSong()` also calls `onSongOpened()` (reset Tool to Inspect, rebuild).
7. The mount: `loadTemplates('templates/display-options/display-options.html')` then `DisplayOptionsMatrixBuilder.addToDest('#divDisplayOptionsMatrixHost')`, next to the Function Symbols mount, plus the `<link>` for the CSS and the host div in [index.html](../../../../index.html).

[display-options.js](../../../../display-options.js) (/vdd) keeps its output.  See Q9 for whether it is touched at all.

## 5. The Matrix proper

### 5.1 Content

- **Columns:** `DISPLAY_OPTION_KEYS` in order, so /vdd, the metadata and the Matrix agree.  A group row above the keys (`Color`, `Cell text`, ...) comes free from `DISPLAY_OPTION_META[key].group` (Q15).
- **DEFAULTS row:** `DISPLAY_OPTIONS_DEFAULTS`; keys with no default (`currentColorDict`, `NoteDisplaySizes`, `sectionTheme`) are empty.
- **LIVE row:** `controlsToDisplayOptions()`.
- **Section rows:** one per Section (H4).  Each cell's state is one of `stored-changed` (green), `stored-same` (white), `absent` (dark gray), exactly the /vdd rule: a stored cell is "changed" when it differs from the resolver's `baseline` for that Section (one `resolveDisplayOptionsAt(idx, {purpose:'baseline'})` per row).
- **Current Section:** a `dmCurrentRow` class on the Section header and a thin outline on the row (not a background, which would hide the cell states).

### 5.2 Class vocabulary (new; /vdd keeps its own)

| Meaning | Header (key) | Section header (row) | Cell |
|---|---|---|---|
| column gate | `dmColGateR`, `dmColGateW` | - | `dmColGateR`, `dmColGateW` |
| row gate | - | `dmRowGateR`, `dmRowGateW` | `dmRowGateR`, `dmRowGateW` |
| cell gate | - | - | `dmCellGateR`, `dmCellGateW` (both for `rw`) |
| adapter (derived) | `dmAdapter` | - | - |
| state | - | - | `dmStored` + `dmChanged`, or `dmStored`, or `dmAbsent` |
| zone | `dmKeyHeader` | `dmSectionHeader`, `dmCurrentRow` | `dmCell` |

Wrapper classes on the scroll container: `dmHideColGates`, `dmHideRowGates` (the two View Options), and `dmTool-<id>` (so CSS can show tool-specific cursors and hover).  Cell-state colors are classes, not inline styles, so a `background-image` gradient layers on top of a `background-color` without `!important`.

The Matrix cell markup carries `data-section` and `data-key`; Legend cells carry neither, so they are inert.

### 5.3 View Options

Two `.BtnPunchedIn`/`.BtnPunchedOut` buttons, both on at start (the state /vdd ships in).  They add or remove only the wrapper classes in 5.2; values, cell gates and the Section header's number are always shown.  Selecting a Key or Section Tool switches the matching overlay on (Q10), because toggling a gate you cannot see would look like nothing happened.  "View Changed Cells" is deferred as stated.

### 5.4 Legend

An Open/Close button below the table.  The Legend is **built by the same renderer** from a synthetic mini-Song (not hand-written HTML), so it cannot drift from the real cells: stored-changed, stored-same, absent, column r / w / rw, row r / w, cell r / w / rw, adapter, current Section, and three combinations (column plus cell, row plus cell, all three).  A short text explains the two read-block meanings (section 3.3) and the Tools.

### 5.5 Hover preview

With a Tool selected, hovering a legal zone adds `dmHot` to the whole affected column (Key Tools), row (Section Tools) or cell (cell Tools), via a delegated `mouseover` and `data-key`/`data-section` lookups (at most 46 cells).  Illegal zones get a `not-allowed` cursor.  Q17.

## 6. Update strategy

| Event | Source | Matrix does |
|---|---|---|
| `DisplayOptionsModel:changed` | any save, clear, gate or undo (button, command line, Matrix); adapter checkbox | full rebuild of the Section rows and header (only while visible) |
| `SectionChanged` | navigation, looping | move `dmCurrentRow`; patch the LIVE row in place; scroll the Current row into view if out of view.  If the Section list changed (length or object identities differ from the last render: add, delete, move, clone) do a full rebuild instead |
| `DisplayOptions:liveChanged` | a control changed (checkbox, select, slider, programmatic flip) | patch the LIVE row in place, coalesced with `requestAnimationFrame` |
| Song open | `updateAfterOpenSong()` | reset Tool to Inspect, full rebuild |

Rules:
- **Hidden means idle.**  If `#divDisplayOptionsMatrix` is not visible (View closed and not floating, or collapsed), handlers only set a `stale` flag; opening the Matrix rebuilds.  Zero cost during looping when you are not using it.
- **Stable DOM in the loop path.**  The loop path never replaces Section cells, so a click that began on a cell is not lost to a rebuild.  LIVE cells are updated by `textContent`.
- **Order.**  The Matrix's `SectionChanged` handler is registered at mount, after the core handler, so it sees synced controls; the plan states this and a browser step checks it.

## 7. Phases

1. **Prep (no behavior change).**  Add a golden-file test that pins today's `/vdd` HTML for the `display-options.json` fixture.  If Q9 is "extract", move `cellText`, `gateClasses`, and the cell-state rule into a shared pure function and prove `/vdd` is byte-identical.
2. **Pure planning.**  `displayOptionsMatrixTools.js` and `planStoreCell`, with Jest (section 8).
3. **Pure view.**  `displayOptionsMatrixView.js` with Jest (the Matrix table, the DEFAULTS and LIVE rows, the Legend).
4. **infinite-neck.js hooks** (section 4.1) with the existing tests kept green.
5. **Template, CSS, builder.**  Mount, collapse toggle, Float, Tools, View Options, Additional Buttons, status line, Legend, click and hover handling, update strategy.
6. **Entry points.**  A toggle button on the View Display Options card, plus a `/vpm` command (Q13).
7. **Docs.**  [help.html](../../../../help.html) Display Options section (the Matrix), the Round 1 implementation report with the acceptance steps, and a repo-memory note.

## 8. Tests

**Jest (pure, no DOM):**
- Tools: for every Tool x Zone, the legal and illegal combinations (a table-driven test over `TOOLS`).
- Toggles: two clicks of each gate Tool return the Song and Sections to a deep-equal start state (key, row, cell; read and write); a Song and a Section carrying the other direction's gate are unaffected.
- Gate toggles never touch cell values; Clear Section and Clear Cell never touch gates; Store Cell honors read, write, row, column and adapter gates and skips `undefined`/`null`.
- Clear Section on a non-Current Section; write-blocked cells are skipped and reported.
- One plan = one undo: after a click-plan, `/vpmu`'s undo restores everything that plan touched.
- `describeCell`: stored, inherited, default, `blocked` (each of the four sources), and the two read-block meanings.
- View: every Section is a row; classes per source; the Current row; DEFAULTS and LIVE rows are inert (no `data-section`); Legend cells are inert; HTML escaping of values (as /vdd's test does).
- Golden `/vdd` test (phase 1).

**Browser (UI acceptance, steps 16 onward in the Round 1 report):** open and close; every Tool x zone; View Options; looping with the Matrix open (no flicker, no lost clicks); Float, dock, and Song open while floating; SAVE Diff dirty highlight in the Matrix; Apply; the quiet path (Messages never opens from the Matrix); Legend.

## 9. Questions

Q1-Q10 change what you see or do.  **Q11-Q20 are minor: the recommendation is used unless you object.**

**Q1.  Tool set (H1).**  Add Clear Cell, Cell read-block, Cell write-block and Store Cell to the design's six Tools (ten in all, in the order of 3.2)?  Recommendation: **yes**.  Without them cell gates stay command-line only.

**Q2.  Re-apply after an edit (H2).**  Add an **Apply** button (= `sectionChanged()`) to Additional Buttons, and show `controls not re-applied: Apply, or navigate` in the status line after a gate, clear or undo on the Current Section?  And should there also be an "Auto-apply" toggle (default off)?  Recommendation: **Apply button yes, Auto-apply no** (it would silently overwrite unsaved live edits on every click).

**Q3.  Quiet reporting (H3).**  Matrix actions skip `Messages.showMessages()`, still write a UserLog row, and show the report in a status line in the Matrix.  Is that what you want, or should the status line also be hidden until the planned "hide Messages" checkbox lands?  Recommendation: **as described**.

**Q4.  Every Section is a row (H4).**  Confirm, with empty rows dark gray and no dashed-border gap marker.  Recommendation: **yes**.

**Q5.  Per-source gate classes and the CSS (H6).**  Confirm that the Matrix gets its own per-source classes (5.2), that /vdd keeps its merged classes, and that I port the current look into `display-options.css` as a starting point for you to tune.  Recommendation: **yes**.

**Q6.  Destructive Tools (H7).**  Make Clear Section, Clear Cell and Store Cell **one-shot** (they revert to Inspect after one use); the gate Tools stay selected.  Or: keep all Tools selected until changed, with a `confirm()` for Clear Section.  Recommendation: **one-shot, no confirm** (the design avoids modal prompts; Undo exists).

**Q7.  Floating (H8).**  Handle disposal by calling `dockBeforeDispose()` in `updateAfterOpenSong()`, the append-sections import and the `disposeAllDockables` command (no change to `dockable.js`).  Recommendation: **yes**.  (Alternative: let `disposeAllDockables` accept a keep list, a change in `dockable.js`.)

**Q8.  SAVE Diff in the Matrix.**  Add a SAVE Diff button (with the magenta dirty highlight) to Additional Buttons, next to Save All, Apply, Undo and Float?  Recommendation: **yes**: SAVE Diff is the main action and a floating Matrix is far from the View card.  CLEAR (Current) is covered by the Clear Section Tool on the Current row.

**Q9.  Sharing code with /vdd.**  (a) Extract the cell-state and text rules into a shared pure function, used by /vdd and the Matrix, with /vdd's output pinned byte-for-byte by a golden test written first; or (b) leave [display-options.js](../../../../display-options.js) untouched and let the Matrix renderer duplicate about 40 lines, with a test that the two agree on cell state and text for the fixture.  Recommendation: **(a)**, so the two cannot drift; **(b)** if "don't touch /vdd" also means its code.

**Q10.  Tool selection turns the matching overlay on.**  Selecting a Key Tool switches "View Column Gates" on; selecting a Section Tool switches "View Row Gates" on.  Recommendation: **yes**.

**Q11.  Height and scrolling.**  Scroll container (about 60vh) with sticky header, DEFAULTS and LIVE rows and a sticky Section column; auto-scroll to the Current row only when it is out of view and only within the container.  Recommendation: **yes**.

**Q12.  `false` as a mark.**  The Matrix (and DEFAULTS and LIVE) draws `false` as `✗` and `true` as `✓`; /vdd stays as is.  Recommendation: **yes**.

**Q13.  How it is opened.**  A collapsed-by-default toggle on the View Display Options card, in the Theme Matrix style (a right/down arrow), and a `/vpm` command (`/vpmo`) to open it.  Recommendation: **yes**.

**Q14.  Session-only UI state.**  Open/closed, the Tool, the two View Options and the Legend are not saved with the Song or in the browser; the Tool resets to Inspect on Song open.  Recommendation: **yes**.

**Q15.  Group header row.**  Show a thin group row above the key headers (`Color`, `Cell text`, `Layout`, `Piano`, `Hide`, `Opacity`, `Looper`, `Fonts`, `Tiny notes`), display only in this Iteration; "a Key Tool click on a group toggles the whole group" as a fast follow (it is one plan with several ops, so one Undo)?  Recommendation: **display now, toggling later**.

**Q16.  Adapter columns.**  Key Tools toggle only the explicit Song gate on `NoteDisplaySizes` and `sectionTheme`; Presentation Mode and Allow Theme Automation stay on the View card, and Inspect explains the adapter block.  Recommendation: **yes**.

**Q17.  Hover preview.**  Highlight the whole column, row or cell a Tool would affect, and a `not-allowed` cursor on illegal zones (5.5).  Recommendation: **yes**.

**Q18.  Inspect output.**  A status line filled on an Inspect click (3.3), with `title` text on headers only; no per-cell tooltips (up to 1,700 attributes) except the full text of clipped long values.  Recommendation: **yes**.

**Q19.  LIVE-row "would change" marker.**  Mark the LIVE cells that SAVE Diff would write (`planSaveDiff(...).ops`), as the natural first step of the deferred "View Changed Cells"?  Recommendation: **defer**, as the design says; it is cheap to add later because the plan is pure.

**Q20.  Concurrent edits.**  The Matrix reads the model and the controls at render and click time and holds no state of its own, so command-line `/vpm` commands, SAVE Diff buttons and the Matrix can be mixed freely, and all rebuild the Matrix through `DisplayOptionsModel:changed`.  Confirm that is acceptable, and that Undo stays **one level and shared** with `/vpmu`.  Recommendation: **yes**.

## 10. Risks and what is not verified

- **Everything above is from reading code.**  In particular the event order (core `SectionChanged` handler before the Matrix's), the sticky-header layout inside a floating window, and clip-and-`title` rendering of long values are unverified until the browser step.
- **Floating plus the View menu:** a floated Matrix keeps updating after the View page is closed; a docked one stops (hidden means idle).  Intended, but the first thing to check.
- **/vdd regression** is the one risk to something that works today; hence phase 1 (golden test first).
- **CSS ownership:** the hatch gradients are yours; I will port the existing look and keep the per-source class names stable so your CSS survives.
- **No Song file change, no migration, no new gate semantics.**
