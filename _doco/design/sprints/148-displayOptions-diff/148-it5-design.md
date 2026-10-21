# sprint-148 Iteration 5 : Implement DisplayOptionsMatrix

Goal: implement a first version interactive Matrix as discussed to-date, with simplifications, building on read-only display from /vdd.

We'll continue to call the static html report informally as /vdd, and the interactive page/div/widget DisplayOptionsMatrix as the Matrix.  Since there are several matrices in the app, if disambiguation is needed, the full name is DisplayOptionsMatrix and the implementation filenames are based on `display-options`.

# Iteration 5 Round 1

For this Round, we will specify the design of the Matrix again, and request Copilot to put together an Implementation Plan with questions to review before coding.

## UX

The commands we have in /vpm are almost sufficient -- we were able to do the UA testing and excercise the SaveDiff engine and handle our most important use-cases.  We wish to retain the command-line UX for macros and advanced Users. So we would like to wrap that command-line functionality in mouse clicks in the interactive Matrix whose display looks just like the output of /vdd. The big advantage is that debug/advanced "Show Messages" (which we will hide with a future, planned checkbox, and should not be shown when updating the Matrix) won't disrupt the flow of seeing the /vdd output, and that it will be live and respond to bus events so can be left around during changes and looping.

We wish to leave /vdd output as it is.  These are the motivations:
- It works.
- It is simple.
- It appears to be feature-complete as far as disabmiguated display of the DisplayOptions Model.
- It is exportable as a static html report.
- The output is versionable, and could be used for a report before and after any of the interactive uses of the Matrix.
- It works with the testing framework.

We wish to have a UI to allow mouse use which is more visually reactive than using the command-line UX.

Like the main interface of notes in Instruments in infinite-neck, we don't see much need for undo/redo/graveyard, as the UX will be click rows, columns, and cells, and then observe the Instruments and Looping.  A column click sets a key gate, which seems like a lot of change, but then another click undoes that. A row click sets row gates, a cell click sets cell gates. Clicking again unsets.  So hopefull all clicks in the Matrix proper become toggles. Since we have worked out visually different display of cells with different gates, row and column clicks are not destructive to cell states.  The cell states can be considered more valuable to the User because they would be one fine detail he has worked out that he knows he wants, and may be clicking rows and columns to experiment with broader effects.  Rather than multiple levels of undo/redo/graveyard or versioning, we will simply protect cells by ensuring the User is in a granular cell Tool.

We define the areas of the Matrix as:
- Matrix proper : an HTML table with:
  - column headers for keys
  - row headers for Sections, with Current Section highlight, and Section nav link
  - cells for Section x Key values and gates.  
  - special rows (display values from Model and Controls, always white background, immutable to clicks):
    - DEFAULTS 
    - LIVE (live values of controls)
- Tools : an area of Tool buttons, probably radio buttons all in one radio group, that allows the User to select: column read-block, column write-block, Section read-block, Section write-block, Clear Cell, and so on, defined below.  
  - "Clear Column" that removes all cell values or cell gates is deferred, as clearing individual cells will be allowed with the right granular Tool. 
  - "Clear Row" effectively already allowed in the "CLEAR Display Options" button for the Current Section -- it will be a Tool button in the first Iteration of the Matrix that allows other Sections to be CLEARed of *values*.
- View Options:  Special .BtnPunchedIn/.BtnPunchedOut state buttons: 
  - View Column Gates
  - View Row Gates
  - View Cell Gates (unlikely)
  - View Changed Cells (deferred) 
- Additional buttons: 
  - Save All... : Copy of "Save All..." button from View page.
  - Undo (kicks current Undo command like /vpmu)
  - Float : floats the Matrix into a floating window like "Floaty"/`#cbFloatyControls` does for all the other main divs like View.  Thus, the Matrix may be viewed at User placement nearer the View page controls.  When not floated, the Matrix simply lives in a page-wide div below the View cards, with overflow sideways scrolling like /vdd so all keys can be seen.
- Legend with example cells showing CSS effects of combinations of values and gate.  Similar to `#MobileKeyboardLegend`.

  Visual order for first deliverable should be: 
```
Additional Buttons
View Options
Tools
Matrix proper
  column headers / Keys
  DEFAULTS
  LIVE
  | "Section #" | blank span td |
  | <section-number like /vdd but with hyperlink> background color for Current Section |  cells .... |
  Legend Open/Close Button
  Legend
```


### View Options discussion: 
  
The View Options buttons would not toggle or obscure any display of values, only gates.

"View Cell Gates" seems possible for balance, but our current thinking is that the User never can turn off Cell Gate viewing, for sanity.  Thus we don't plan on having "View Cell Gates".
  
The big idea is that the two View options we want, "View Column Gates" and "View Row Gates", are conceptually and visually overlays over the constant display of cell gates and values.  The user toggles display of them off in order to see a pure view of cells.  The slight occlusion of view by having "View Column Gates" and "View Row Gates" punched in (and therefore "ON" allowing Viewing) is offset by the visually satisfying view of seeing the whole row or column light up at once, reminding us of the column and row operations. At any rate, our current CSS rules do allow for row, column, and cell gate states to be seen simultaneously with all the View Options on, which is the state /vdd ships now.

"View Changed Cells" is deferred for this Iteration. It is a useful way to toggle display of changed cell green background.  Will be useful to lower the visual clutter.

### Tools

Which brings us to the Tools, defined here with less hand-waving.

- Inspect : largely a safe do-nothing default and a place to cause detail info to be displayed if needed.  Does nothing to the state of the Matrix.
- Clear Section : Same action as "CLEAR Display Options" but allows to clear row of non-Current Section of *values*.
- Key read-block 
- Key write-block
- Section read-block
- Section write-block

The four *-block Tools only set and clear gates, so they toggle all at once, and thus on two clicks we are back to where we started, safely.  They don't affect cell gates.

Our current idea is that once a Tool is selected, any legal area of the Matrix proper would work.  So clicking in a Section row header *or* a Section row cell would be effective for the Section Tools.  Clicking in a column header or any cell would be effective for Key tools.  Our current thinking is that clicking in a special row in what looks like a cell works for the Key Tools but not for the Section Tools.  Clicking in row headers for special rows or the weird blank cell at 0,0 would do nothing for any of the Tools.

If we need more Tools to manipulate the primitives, let's discuss it in the Questions in the Implementation Plan.

## templating 

You have already set up the ./templates/ folder, so we'll continue to build the Matrix in `./templates/display-options/`.  The newly built support modules will continue to live here.  The Matrix page/widget proper will live in: 
  - ./templates/display-options/display-options.css
  - ./templates/display-options/display-options.html
  - ./templates/display-options/display-options.builder.js

## Request

Please produce Iteration 5 Round 1 deliverable: the Implementation Plan with Questions, especially any holes in the design or missing controls.





# sprint-148 Iteration 5 Round 2

Round 1's deliverable, `_doco/design/sprints/148-displayOptions-diff/148-it5-round-1-implementation-plan.md` is accepted, with the following Answers from the Design Team.

Round 2's deliverable is a working first implementation of the DisplayOptionsMatrix widget, installed in the View page.

## Design Team Answers to Round 1 Questions

### Iteration 5 Round 1 Implementation Plan header section 9. Questions, with Answers


**Q1.  Tool set (H1).**  Add Clear Cell, Cell read-block, Cell write-block and Store Cell to the design's six Tools (ten in all, in the order of 3.2)?  Recommendation: **yes**.  Without them cell gates stay command-line only.

- ANSWER: yes.

**Q2.  Re-apply after an edit (H2).**  Add an **Apply** button (= `sectionChanged()`) to Additional Buttons, and show `controls not re-applied: Apply, or navigate` in the status line after a gate, clear or undo on the Current Section?  And should there also be an "Auto-apply" toggle (default off)?  Recommendation: **Apply button yes, Auto-apply no** (it would silently overwrite unsaved live edits on every click).

- ANSWER: Apply button: yes.  Auto-apply with checkbox: yes.  When SaveDiff would turn magenta and Auto-apply is checked, put warning in Status area: "Live controls changed: SaveDiff before next Apply" 


**Q3.  Quiet reporting (H3).**  Matrix actions skip `Messages.showMessages()`, still write a UserLog row, and show the report in a status line in the Matrix.  Is that what you want, or should the status line also be hidden until the planned "hide Messages" checkbox lands?  Recommendation: **as described**.

- ANSWER: Yes: as described. 


**Q4.  Every Section is a row (H4).**  Confirm, with empty rows dark gray and no dashed-border gap marker.  Recommendation: **yes**.

- ANSWER: yes.


**Q5.  Per-source gate classes and the CSS (H6).**  Confirm that the Matrix gets its own per-source classes (5.2), that /vdd keeps its merged classes, and that I port the current look into `display-options.css` as a starting point for you to tune.  Recommendation: **yes**.

- ANSWER: yes.


**Q6.  Destructive Tools (H7).**  Make Clear Section, Clear Cell and Store Cell **one-shot** (they revert to Inspect after one use); the gate Tools stay selected.  Or: keep all Tools selected until changed, with a `confirm()` for Clear Section.  Recommendation: **one-shot, no confirm** (the design avoids modal prompts; Undo exists).

- ANSWER: one-shot, no confirm.


**Q7.  Floating (H8).**  Handle disposal by calling `dockBeforeDispose()` in `updateAfterOpenSong()`, the append-sections import and the `disposeAllDockables` command (no change to `dockable.js`).  Recommendation: **yes**.  (Alternative: let `disposeAllDockables` accept a keep list, a change in `dockable.js`.)

- ANSWER: yes.  Not sure if this is a needed decision, but there will be no option to persist floating state, so default is parked in page, like every other Menu Page div.  User must click something to float the widget.  "Info" may be the only system widget/page/div that stores a float option.


**Q8.  SAVE Diff in the Matrix.**  Add a SAVE Diff button (with the magenta dirty highlight) to Additional Buttons, next to Save All, Apply, Undo and Float?  Recommendation: **yes**: SAVE Diff is the main action and a floating Matrix is far from the View card.  CLEAR (Current) is covered by the Clear Section Tool on the Current row.

- ANSWER: Yes.


**Q9.  Sharing code with /vdd.**  (a) Extract the cell-state and text rules into a shared pure function, used by /vdd and the Matrix, with /vdd's output pinned byte-for-byte by a golden test written first; or (b) leave [display-options.js](../../../../display-options.js) untouched and let the Matrix renderer duplicate about 40 lines, with a test that the two agree on cell state and text for the fixture.  Recommendation: **(a)**, so the two cannot drift; **(b)** if "don't touch /vdd" also means its code.

- ANSWER: (a).


**Q10.  Tool selection turns the matching overlay on.**  Selecting a Key Tool switches "View Column Gates" on; selecting a Section Tool switches "View Row Gates" on.  Recommendation: **yes**.

- ANSWER: yes. 


**Q11.  Height and scrolling.**  Scroll container (about 60vh) with sticky header, DEFAULTS and LIVE rows and a sticky Section column; auto-scroll to the Current row only when it is out of view and only within the container.  Recommendation: **yes**.

- ANSWER: yes.


**Q12.  `false` as a mark.**  The Matrix (and DEFAULTS and LIVE) draws `false` as `✗` and `true` as `✓`; /vdd stays as is.  Recommendation: **yes**.

- ANSWER: yes.


**Q13.  How it is opened.**  A collapsed-by-default toggle on the View Display Options card, in the Theme Matrix style (a right/down arrow), and a `/vpm` command (`/vpmo`) to open it.  Recommendation: **yes**.

- ANSWER: yes.


**Q14.  Session-only UI state.**  Open/closed, the Tool, the two View Options and the Legend are not saved with the Song or in the browser; the Tool resets to Inspect on Song open.  Recommendation: **yes**.

- ANSWER: yes.


**Q15.  Group header row.**  Show a thin group row above the key headers (`Color`, `Cell text`, `Layout`, `Piano`, `Hide`, `Opacity`, `Looper`, `Fonts`, `Tiny notes`), display only in this Iteration; "a Key Tool click on a group toggles the whole group" as a fast follow (it is one plan with several ops, so one Undo)?  Recommendation: **display now, toggling later**.

- ANSWER: display now, toggling later.


**Q16.  Adapter columns.**  Key Tools toggle only the explicit Song gate on `NoteDisplaySizes` and `sectionTheme`; Presentation Mode and Allow Theme Automation stay on the View card, and Inspect explains the adapter block.  Recommendation: **yes**.

- ANSWER: yes.


**Q17.  Hover preview.**  Highlight the whole column, row or cell a Tool would affect, and a `not-allowed` cursor on illegal zones (5.5).  Recommendation: **yes**.

- ANSWER: yes.


**Q18.  Inspect output.**  A status line filled on an Inspect click (3.3), with `title` text on headers only; no per-cell tooltips (up to 1,700 attributes) except the full text of clipped long values.  Recommendation: **yes**.

- ANSWER: yes.


**Q19.  LIVE-row "would change" marker.**  Mark the LIVE cells that SAVE Diff would write (`planSaveDiff(...).ops`), as the natural first step of the deferred "View Changed Cells"?  Recommendation: **defer**, as the design says; it is cheap to add later because the plan is pure.

- ANSWER: defer.


**Q20.  Concurrent edits.**  The Matrix reads the model and the controls at render and click time and holds no state of its own, so command-line `/vpm` commands, SAVE Diff buttons and the Matrix can be mixed freely, and all rebuild the Matrix through `DisplayOptionsModel:changed`.  Confirm that is acceptable, and that Undo stays **one level and shared** with `/vpmu`.  Recommendation: **yes**.

- ANSWER: yes.

### Change to Plan point 3.2

In addition to the above answers, we can skip status line updates and any action when a dis-allowed zone is clicked.  Simply clicking in any "nothing, never clickable" zones is a no-op, with no status update.  In other words, *don't* do this: "Clicks anywhere not legal for the Tool do nothing and say so in the status line (Section tools need a Section row or cell)."  For example clicking in zone Z0 does nothing and reports no status line.

## Request

Please proceed to APPROVED coding. Coding is CORE-APPROVED for infinite-neck.js.

# sprint-148 Iteration 5 Round 3

Implementation Report `_doco/design/sprints/148-displayOptions-diff/148-it5-round-2-implementation-report.md` is accepted.

In Round 3 we'd like to apply some tweaks.

1. The sticky scrolling is working for when there are many rows (Sections).  However, the horizontal scrolling when there are more columns than fit in the window is not happening when docked. If we float and scroll around a bit, then both vertical sticky scroll and horizontal sticky scroll are happening.  Going back to parked means the horizontal scroll stops, and there are columns we can't get to without decreasing Chrome's size with `Ctrl-`.

2. Now that we have CSS rules, we no longer need `row:r` etc. in the Section row headers.  We'd like to turn them off with a code constant like WANT_LITERAL_CELLMARK_TEXT, call it WANT_LITERAL_ROWMARK_TEXT.  Similarly for `col:r` and variants, call it WANT_LITERAL_COLMARK_TEXT.  We would like them turned off in the code, so that later we can turn them on for debugging cases where the CSS won't show properly.

3. We like the hints `a:allowThemeAutomation` and `a:presentationMode`, however, they make the column header much taller.  We'd prefer them to live next to, rather than inline as superscript.  Since the text direction is vertical, we think that means something like this would be what we want:
```
sectionTheme
a:allowThemeAutomation
```
When rotated for the text direction, the second line would appear to the right of the first line (sectionTheme) on the page.

4. We already changed display-options.css rule 
```
#divDisplayOptionsMatrix .dmTable {
    border-collapse: separate;     /* sticky cells lose collapsed borders */
    border-spacing: 0.2em;
}
```
so that border-spacing was non-zero so that it matches the look of /vdd.  The extra space makes the css cell border and inset shadow work better visually.  However, this may have thrown off some of the sticky calculations.

## Followup Requests

Float and docked horizontal and vertical scroll working in Matrix table.

Rotated header and hint look good in Matrix.   

The sticky behavior is looking correct with the gaps.

We *would* like /vdd to look the same and have the changes for  WANT_LITERAL_ROWMARK_TEXT and WANT_LITERAL_COLMARK_TEXT  and the rotated header hints.

----

Those tweaks work.

For each of the Tool buttons like `#rbnDisplayOptionsMatrixTool` we'd like to have a style like `#chooseHighlightNamed` with `#idNamedNotes` from the palette.  That is, the white button with a floating-look box-shadow. The CSS rules copied from the palette should live in display-options.css. 