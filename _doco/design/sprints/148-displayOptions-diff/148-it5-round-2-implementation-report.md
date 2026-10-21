# Sprint 148 (displayOptions-diff), Iteration 5, Round 2: implementation report and acceptance test recipes

date: 20261020

Answers: [148-it5-design.md](148-it5-design.md), "Iteration 5 Round 2".  Plan: [148-it5-round-1-implementation-plan.md](148-it5-round-1-implementation-plan.md).  Sprint overview: [sprint-148.md](sprint-148.md).

Jest: 76 suites, 927 tests, all passing (Round 5 ended at 74 suites, 870 tests).  **Nothing here has been run in a browser.**  The CSS (sticky rows, hatches, hover) and the event ordering are the things most likely to need a tweak.

## What was built

| Piece | Where |
|---|---|
| Shared cell rules (`escapeHtml`, `cellText`, `gateClasses`, `CELL_GATE_CLASS`, `cellState`); /vdd now imports them (Q9a) | [templates/display-options/displayOptionsCellRules.js](../../../../templates/display-options/displayOptionsCellRules.js), [display-options.js](../../../../display-options.js) |
| Golden test pinning /vdd's HTML byte for byte, written **before** the refactor and unchanged by it | [_tests/jest/display-options-vdd-golden.test.js](../../../../_tests/jest/display-options-vdd-golden.test.js), [golden/vdd-table.golden.html](../../../../_tests/jest/golden/vdd-table.golden.html) |
| The ten Tools, the zones, `planMatrixClick()`, gate toggles, `planAffectsApply()`, `describeCell()` (Inspect) | [displayOptionsMatrixTools.js](../../../../templates/display-options/displayOptionsMatrixTools.js) |
| `planStoreCell()` (Store Cell) | [displayOptionsPlan.js](../../../../templates/display-options/displayOptionsPlan.js) |
| The Matrix table and Legend HTML (per-source gate classes, every Section a row, group row, DEFAULTS, LIVE, "Section #" row) | [displayOptionsMatrixView.js](../../../../templates/display-options/displayOptionsMatrixView.js) |
| Widget: template, CSS, builder | [display-options.html](../../../../templates/display-options/display-options.html), [display-options.css](../../../../templates/display-options/display-options.css), [display-options.builder.js](../../../../templates/display-options/display-options.builder.js) |
| Core hooks (CORE-APPROVED) | [infinite-neck.js](../../../../infinite-neck.js), [key-handlers.js](../../../../key-handlers.js), [menu.js](../../../../menu.js), [index.html](../../../../index.html) |
| Help | [help.html](../../../../help.html) (View | Display Options) |
| Tests | [display-options-matrix-ui.test.js](../../../../_tests/jest/display-options-matrix-ui.test.js) (tools, toggles, clear/store, Inspect, view, Legend, wiring), [display-options-menu.test.js](../../../../_tests/jest/display-options-menu.test.js) (`/vpmo`) |

### Core changes in infinite-neck.js

- `finishDisplayOptionsModelChange(result, { quiet, keepDirty })`: quiet skips `Messages.showMessages()` and still writes the UserLog row; `keepDirty` rescans instead of re-baselining, so unsaved live edits keep SAVE Diff magenta.
- New exports `runDisplayOptionsPlan(plan)` (quiet, keepDirty), `getDisplayOptionsMatrixContext()` and `showDisplayOptionsMatrix()`.  `handleBtnSaveDiff`, `handleBtnSaveAll` and `undoDisplayOptionsOp` take an optional `{ quiet: true }`; with no argument they behave as before (the command line, the View buttons).
- `DisplayOptions:liveChanged {dirty}` fires from `refreshDisplayOptionsSaveActionRequired()` (a control changed) and from `captureDisplayOptionsDirtyBaseline()` (Section sync, after Apply, after a save).
- The Presentation Mode and Allow Theme Automation `change` handlers trigger `DisplayOptionsModel:changed {adapter:true}`.
- `setDisplayOptionsSaveActionRequired()` also toggles `#btnSaveDiff_Matrix`.  The View page's "dirty" input binding now excludes the Matrix's inputs.
- `DisplayOptionsMatrixBuilder.dockBeforeDispose()` before `disposeAllDockables()` in `updateAfterOpenSong()` and in the append-sections import; [key-handlers.js](../../../../key-handlers.js)'s `disposeAllDockables` case calls `dockDivInPage('divDisplayOptionsMatrix')` first (it uses the same global `dockable.js` functions).  `dockable.js` is unchanged (Q7).
- `showOneMenuDiv('#divViewControls')` calls `DisplayOptionsMatrixBuilder.refreshIfStale()`.
- Mount: `loadTemplates('templates/display-options/display-options.html')` then `addToDest('#divDisplayOptionsMatrixHost')`.

## How the Round 2 answers were handled

| Q | Handling |
|---|---|
| Q1 | Ten Tools: Inspect, Clear Section, Clear Cell, Key read-block, Key write-block, Section read-block, Section write-block, Cell read-block, Cell write-block, Store Cell. |
| Q2 | **Apply** button (`sectionChanged()`) and an **Auto-apply** checkbox, off by default.  The hint "Controls not re-applied: press Apply, or navigate." shows only after an edit that can change what Apply produces: a read gate or a clear at or before the Current Section, any column read gate, or an Undo.  Write gates, Store Cell, and edits at later Sections get a plain report.  With Auto-apply on: if the controls have no unsaved changes the Matrix applies at once; if they do, it does **not** apply (that would overwrite them) and shows "Live controls changed: SaveDiff before next Apply".  The same warning appears whenever a control changes while Auto-apply is on. |
| Q3 | Quiet: reports go to the status line under the Tools and the UserLog; Messages never opens from the Matrix. |
| Q4 | Every Section is a row; empty rows are dark gray; no dashed marker. |
| Q5 | Per-source classes `dmColGateR/W`, `dmRowGateR/W`, `dmCellGateR/W`, `dmAdapter`; the hatch look is ported from `.tblDisplayOptions`; /vdd keeps its classes. |
| Q6 | Clear Section, Clear Cell and Store Cell are one-shot (back to Inspect).  Gate Tools stay selected. |
| Q7 | Docked before disposal at the three call sites.  The Matrix always starts parked in the page; nothing about floating is persisted. |
| Q8 | SAVE Diff button on the Matrix, with the same magenta highlight. |
| Q9 | (a): shared pure rules, /vdd's output pinned by the golden test. |
| Q10 | Selecting a Key Tool turns View Column Gates on; a Section Tool turns View Row Gates on. |
| Q11 | Scroll container (`max-height: 65vh`), sticky key, DEFAULTS and LIVE rows (offsets measured by the builder), sticky Section column; the Current row is scrolled into view only when it is out of view, inside the container only. |
| Q12 | The Matrix shows `true` as a check mark and `false` as a cross, including DEFAULTS and LIVE.  /vdd is unchanged. |
| Q13 | Collapsed by default; toggle with an arrow on the View Display Options card, and `/vpmo`. |
| Q14 | Session-only UI state; the Tool resets to Inspect on Song open. |
| Q15 | Group row displayed; toggling by group deferred. |
| Q16 | Key Tools toggle only the Song gate; adapter-gated columns are marked `a:`; Inspect explains them. |
| Q17 | Hover highlights the whole column, row or cell the Tool would affect; `not-allowed` cursor on a clickable zone the Tool does not work in. |
| Q18 | Inspect fills the status line; key headers have a `title`; long cell text is clipped with a `title`. |
| Q19 | Deferred. |
| Q20 | The Matrix holds no model state; it reads at click and render time; Undo is shared with `/vpmu`. |
| 3.2 change | A click in a zone where the Tool does nothing (including Z0, group row, DEFAULTS/LIVE labels, "Section #" row) is a silent no-op: no status line change. |

Decisions I made that you did not specify:

- Auto-apply does not apply while the controls are unsaved (above).  Say so if you want it to apply anyway.
- A Matrix edit does not re-baseline SAVE Diff's dirty flag (command-line edits still do, as in Round 5).
- Inspect on a Section number navigates (`linkToSection`); Inspect elsewhere reports.
- A **Close** button (docks, then collapses) because a floating Matrix has no View card toggle nearby.
- The Legend is drawn by the real renderer from a 5-Section synthetic Song with 8 columns, so it cannot drift from the Matrix.
- The View Options buttons start on; the wrapper classes are `dmShowColGates` / `dmShowRowGates` (on) rather than "hide" classes.

## Acceptance test recipes (steps 16 onward)

Setup: open [songs/tests/display-options.json](../../../../songs/tests/display-options.json) or any Song with 3+ Sections, and a few DisplayOptions stored via SAVE Diff.  Open View, click **Display Options Matrix**.

### 16. Open, look, and layout

1. The Matrix opens under the View cards, page wide.  Order: Additional Buttons, View Options, Tools, status line, table, Legend button.
2. Table: group row, key headers (vertical), DEFAULTS (white), LIVE (white), "Section #", then one row per Section, **including Sections that store nothing** (all dark gray).  The Current Section's number is highlighted gold with a navy border across the row.
3. Scroll sideways and down in a Song with many Sections: the key headers, DEFAULTS and LIVE rows stay put, and the Section column stays put.  Check that the three sticky rows do not overlap each other (the offsets are measured, so this is the first thing to look at).
4. Booleans show check and cross marks.
5. Close the Matrix, reopen it with `/vpmo` (the View page comes up if it was closed).

### 17. Inspect (the default Tool)

1. Click a Section number: navigates to it, the highlight moves, the page does not scroll.
2. Click a stored cell, an empty cell, a key header, a DEFAULTS cell and a LIVE cell: the status line describes stored value, inherited value with its source, the gates, and what they do.  Nothing in the Song changes (Undo stays disabled).
3. Click the 0,0 corner, the group row, the DEFAULTS/LIVE labels and the "Section #" row: nothing happens and the status line does not change.

### 18. Gate Tools (toggles)

1. Choose **Key read-block**: the View Column Gates button is punched in.  Click a key header: the whole column lights up with the orange read look; click again: gone.  Repeat clicking a cell and a DEFAULTS cell in that column.  Repeat with **Key write-block** (blue glow).
2. **Section read-block / write-block**: same on a Section number and a cell; the row lights up.  Clicking a DEFAULTS or LIVE cell does nothing.
3. **Cell read-block / write-block**: the single cell gets the red or blue hatch.  Both at once give the combined hatch.
4. Turn View Column Gates off: column lights go out, cell hatches stay.  Turn View Row Gates off likewise.  Turn both off: only values and cell gates remain.
5. Each click is reported in the status line and the UserLog tab, and the Messages panel does **not** open.
6. A column gate plus a row gate plus a cell gate on one cell: all three show (see the Legend).

### 19. One-shot Tools

1. **Clear Cell** on a stored cell: it goes dark gray, the Tool returns to Inspect.  On a gated-write cell: reports "skipped ... (write-blocked)".
2. **Clear Section** on a non-Current Section: its values go; its gates stay; the Tool returns to Inspect.
3. **Store Cell**: change a control (say Note Font), choose Store Cell, click a cell in that column on any Section: the cell gets the live value.  Store into a read-blocked or write-blocked cell reports the skip.
4. **Undo** reverts the last change (one level); the button is disabled when there is nothing to undo.  `/vpmu` does the same, and either one rebuilds the Matrix.

### 20. Apply and Auto-apply

1. Section 2 is Current and stores `noteFont`, Section 1 stores a different `noteFont`.  Choose **Cell read-block** and click Section 2's `noteFont` cell.  Status ends with "Controls not re-applied: press Apply, or navigate."  The Note Font control is unchanged.  Press **Apply**: the control shows Section 1's font.
2. Clear Section on the Current Section: the hint appears; **Apply** brings the inherited values.
3. Write-block toggles and Store Cell show no hint.  A read gate on a later Section shows no hint.
4. Check **Auto-apply**.  Repeat step 1: the control changes at once and the status says "Applied".
5. With Auto-apply on, change a control yourself (SAVE Diff turns magenta): the status shows "Live controls changed: SaveDiff before next Apply".  Now do a read-block edit that changes Apply: the Matrix does not apply, and keeps the warning.  Press SAVE Diff, repeat: it applies.
6. Edits by Matrix Tools keep SAVE Diff magenta if it was magenta.

### 21. SAVE Diff, Save All

1. Change a control: SAVE Diff turns magenta on **both** the View card and the Matrix.  Click the Matrix's SAVE Diff: the report appears in the status line (no Messages panel), the cell turns green or white in the table, both buttons stop being magenta.
2. **Save All...** asks first; Cancel changes nothing.

### 22. Live updates (the Matrix open while looping)

1. Loop Sections: the Current highlight follows, the LIVE row follows the controls, the table scrolls itself only when the Current row leaves the view, and the page never scrolls.
2. Click Tools during looping: clicks are not lost (the cells are not replaced by the loop).
3. Add, delete or move a Section: the table gets the new list of rows.
4. Toggle Presentation Mode and Allow Theme Automation: the `a:` marks on `NoteDisplaySizes` and `sectionTheme` follow.
5. Run `/vpm` commands (`/vpmgak`, `/vpmc`, `/vpmu`) with the Matrix open: it redraws.  Close View: looping does nothing to the Matrix (it idles) and reopening shows current data.

### 23. Float

1. Click **Float**: the Matrix goes to a window; the Float button hides; the View card is free of it.  Drag, resize, scroll inside it.  The table has a white background.
2. Close the View page: the floating Matrix stays and still updates.
3. Dock (the pin button), then Float again.
4. Open another Song with the Matrix floating, and run the `disposeAllDockables` command: the Matrix is docked back first and is **not** destroyed; the new Song's Sections appear in it.  With Floaty on (the whole View page floated), the Matrix inside it floats and docks properly.
5. After a reload the Matrix is closed and parked (nothing persists).

### 24. Legend and hover

1. **Legend** opens a table drawn like the Matrix with an explanation; clicking its cells does nothing.
2. Hover with each Tool: Key Tools highlight the column, Section Tools and Clear Section the row, cell Tools the cell.  A Tool over a zone it does not work in (a Section Tool over a DEFAULTS cell) shows the not-allowed cursor.  The corner, group row and labels show the plain cursor.

### 25. /vdd unchanged

Run `/vdd` before and after using the Matrix on the same Song: the static report is as before (skips plain Sections, merged gate classes, blank for `false`).

## Not verified

- Everything in a browser: sticky offsets, hatch rendering with `outline` and `box-shadow` together, the `::after` hover overlay, the `:where()` specificity ordering, and the floating window sizing.
- That `SectionChanged` reaches the Matrix after the controls are synced (it is the second handler registered; the LIVE row is also refreshed by `DisplayOptions:liveChanged`, which does not depend on that order).
- Existing global CSS in infinite-neck.css that targets `th`, `td`, `button` or `label` may restyle the Matrix.
