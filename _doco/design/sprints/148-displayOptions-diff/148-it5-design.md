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