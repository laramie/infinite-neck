## Acceptance test recipes 16-25


Setup: open [songs/tests/display-options.json](../../../../songs/tests/display-options.json) or any Song with 3+ Sections, and a few DisplayOptions stored via SAVE Diff.  Open View, click **Display Options Matrix**.

link: http://localhost:8000/infinite-neck/?song=tests/display-options.json

### 16. Open, look, and layout

1. The Matrix opens under the View cards, page wide.  Order: Additional Buttons, View Options, Tools, status line, table, Legend button.

- RESULT: PASS

2. Table: group row, key headers (vertical), DEFAULTS (white), LIVE (white), "Section #", then one row per Section, **including Sections that store nothing** (all dark gray).  The Current Section's number is highlighted gold with a navy border across the row.

- RESULT: PASS

3. Scroll sideways and down in a Song with many Sections: the key headers, DEFAULTS and LIVE rows stay put, and the Section column stays put.  Check that the three sticky rows do not overlap each other (the offsets are measured, so this is the first thing to look at).

- RESULT: PASS

4. Booleans show check and cross marks.

- RESULT: PASS

5. Close the Matrix, reopen it with `/vpmo` (the View page comes up if it was closed).

- RESULT: PASS


### 17. Inspect (the default Tool)

1. Click a Section number: navigates to it, the highlight moves, the page does not scroll.

- RESULT: PASS

2. Click a stored cell, an empty cell, a key header, a DEFAULTS cell and a LIVE cell: the status line describes stored value, inherited value with its source, the gates, and what they do.  Nothing in the Song changes (Undo stays disabled).

- RESULT: PASS

3. Click the 0,0 corner, the group row, the DEFAULTS/LIVE labels and the "Section #" row: nothing happens and the status line does not change.

- RESULT: PASS


### 18. Gate Tools (toggles)

1. Choose **Key read-block**: the View Column Gates button is punched in.  Click a key header: the whole column lights up with the orange read look; click again: gone.  Repeat clicking a cell and a DEFAULTS cell in that column.  Repeat with **Key write-block** (blue glow).

- RESULT: PASS

2. **Section read-block / write-block**: same on a Section number and a cell; the row lights up.  Clicking a DEFAULTS or LIVE cell does nothing.

- RESULT: PASS

3. **Cell read-block / write-block**: the single cell gets the red or blue hatch.  Both at once give the combined hatch.

- RESULT: PASS

4. Turn View Column Gates off: column lights go out, cell hatches stay.  Turn View Row Gates off likewise.  Turn both off: only values and cell gates remain.

- RESULT: PASS

5. Each click is reported in the status line and the UserLog tab, and the Messages panel does **not** open.

- RESULT: PASS

6. A column gate plus a row gate plus a cell gate on one cell: all three show (see the Legend).

- RESULT: PASS


### 19. One-shot Tools

1. **Clear Cell** on a stored cell: it goes dark gray, the Tool returns to Inspect.  On a gated-write cell: reports "skipped ... (write-blocked)".

- RESULT: PASS

2. **Clear Section** on a non-Current Section: its values go; its gates stay; the Tool returns to Inspect.

- RESULT: PASS.  But Tool stays on Clear Section, because I think we changed that behavior after this test recipe was written.  At any rate, we like this current behavior: Clear Section Tool remains selected.

3. **Store Cell**: change a control (say Note Font), choose Store Cell, click a cell in that column on any Section: the cell gets the live value.  Store into a read-blocked or write-blocked cell reports the skip.

- RESULT: PARTIAL PASS. Exception:  A "Cell r" cell read-block also prevents a "Store Cell" from changing font on that cell in either Current Section row or other row.

4. **Undo** reverts the last change (one level); the button is disabled when there is nothing to undo.  `/vpmu` does the same, and either one rebuilds the Matrix.

- RESULT: PASS


### 20. Apply and Auto-apply

1. Section 2 is Current and stores `noteFont`, Section 1 stores a different `noteFont`.  Choose **Cell read-block** and click Section 2's `noteFont` cell.  Status ends with "Controls not re-applied: press Apply, or navigate."  The Note Font control is unchanged.  Press **Apply**: the control shows Section 1's font.

- RESULT: 

2. Clear Section on the Current Section: the hint appears; **Apply** brings the inherited values.

- RESULT: 

3. Write-block toggles and Store Cell show no hint.  A read gate on a later Section shows no hint.

- RESULT: 

4. Check **Auto-apply**.  Repeat step 1: the control changes at once and the status says "Applied".

- RESULT: 

5. With Auto-apply on, change a control yourself (SAVE Diff turns magenta): the status shows "Live controls changed: SaveDiff before next Apply".  Now do a read-block edit that changes Apply: the Matrix does not apply, and keeps the warning.  Press SAVE Diff, repeat: it applies.

- RESULT: 

6. Edits by Matrix Tools keep SAVE Diff magenta if it was magenta.

- RESULT: 


### 21. SAVE Diff, Save All

1. Change a control: SAVE Diff turns magenta on **both** the View card and the Matrix.  Click the Matrix's SAVE Diff: the report appears in the status line (no Messages panel), the cell turns green or white in the table, both buttons stop being magenta.

- RESULT: 

2. **Save All...** asks first; Cancel changes nothing.

- RESULT: 


### 22. Live updates (the Matrix open while looping)

1. Loop Sections: the Current highlight follows, the LIVE row follows the controls, the table scrolls itself only when the Current row leaves the view, and the page never scrolls.

- RESULT: 

2. Click Tools during looping: clicks are not lost (the cells are not replaced by the loop).

- RESULT: 

3. Add, delete or move a Section: the table gets the new list of rows.

- RESULT: 

4. Toggle Presentation Mode and Allow Theme Automation: the `a:` marks on `NoteDisplaySizes` and `sectionTheme` follow.

- RESULT: 

5. Run `/vpm` commands (`/vpmgak`, `/vpmc`, `/vpmu`) with the Matrix open: it redraws.  Close View: looping does nothing to the Matrix (it idles) and reopening shows current data.

- RESULT: 


### 23. Float

1. Click **Float**: the Matrix goes to a window; the Float button hides; the View card is free of it.  Drag, resize, scroll inside it.  The table has a white background.

- RESULT: 

2. Close the View page: the floating Matrix stays and still updates.

- RESULT: 

3. Dock (the pin button), then Float again.

- RESULT: 

4. Open another Song with the Matrix floating, and run the `disposeAllDockables` command: the Matrix is docked back first and is **not** destroyed; the new Song's Sections appear in it.  With Floaty on (the whole View page floated), the Matrix inside it floats and docks properly.

- RESULT: 

5. After a reload the Matrix is closed and parked (nothing persists).

- RESULT: 


### 24. Legend and hover

1. **Legend** opens a table drawn like the Matrix with an explanation; clicking its cells does nothing.

- RESULT: 

2. Hover with each Tool: Key Tools highlight the column, Section Tools and Clear Section the row, cell Tools the cell.  A Tool over a zone it does not work in (a Section Tool over a DEFAULTS cell) shows the not-allowed cursor.  The corner, group row and labels show the plain cursor.

- RESULT: 


### 25. /vdd unchanged

Run `/vdd` before and after using the Matrix on the same Song: the static report is as before (skips plain Sections, merged gate classes, blank for `false`).

- RESULT: 

# Post-testing Request

- Please summarize the rules from this sprint's discussion and test recipies in a new help.html file section `#displayOptionsMatrixTopic` that is User-facing (remove the test todo instructions, but retain them, pared-down and User-facing in the following Examples section).  Should read like instructions on using the Matrix if you know the application but don't know the DisplayOptionsMatrix.  May repeat instructions in the Legend and the Hints. Note that existing help content `#displayOptionsMatrixTopic` may be re-written as part of this.

- Please summarize the tests in this sprint in a new help.html file section called Display Options Matrix Examples.  Should read like a help file, but retain the individual use cases from the test recipes.

- Note that `displayOptionsVDDTopic` in the help file is stale.  Don't edit this section, we will integrate it into the other help sections after you have written the sections for the Matrix.

