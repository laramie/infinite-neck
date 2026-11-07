# Iteration 1

## Initial Design Wishlist

Purpose of this sprint is to: 
- Implement a print layout so Songs can be printed.
  - grid/table layout allows Sections to be presented for the printed page
  - Options like row and column count, e.g. 2x6, 2x4, etc.
  - Leave portrait/landscape to the system print dialogs, but support any aspect ratio in the layout.  Not sure if a bounding box is needed to constrain this, since we have just done screenshots so far.  Leave this item open to testing and redesign.
  - Investigate whether printing from the Browser is workable and gives the right level of control, e.g. scaling and font sizing. Currently we do screenshots.
  - At least one print-friendly Theme.  See `songs/demo/superchart.json` for a mockup that uses the USER Theme to tweak `Snow` with darker cell shadow lines.
  - Possible built-in algorithm for inserting and managing the Observers needed.  Right now, for a 2x3 table, superchart.json just uses Floated Observers dragged into place in fullscreen with Grabbles off for printing.  It would be sweet if when you specify a 2x3 the algorithm creates a 2x3 table or grid layout, and inserts 5 Observers to match your main/chosen Instrument, automatically calculating their relative Sections back `[-1,-2,-3,-4,-5]`.  This works in superchart.json because when you navigate to Section 6, the page shows all 6 Sections.  If you were to add 6 more Sections and navigate to Section 12, the page would show Sections 7-12. 
  - Investigate whether it is more intuitive to go +n Sections forward with the Observers instead. With this scheme, it might be easier to page through the song until there are no more Sections, and deal with empties at the end of the page.
  - Investigate whether table layout or flex grid layout is better.
  - Define the layout so it can be stored in the song elegantly and minimally. Options such as putting the chart details in the Instrument Captions or the Left Rail will be stored in the Instruments and Layout as defined in sprint-153 which is currently in progress.  Open question will be how to manage this for the Observers without needless repetition (i.e. a reference to widget layout from Observer to Main that says "copy its widgets and layout" versus having the print layout algorithm simply set all the Observers properties when the print layout properties are set.)

## Iteration 1 Request

Please produce a high-level analysis of this wishlist, showing how it would be implemented, making recommendations for elegant design, and showing any holes in Design that need addressing.

We don't need detailed reporting on code locations yet.  But we would like to understand where new modules would be needed, and broad strokes around new methods and members needed.

Please produce the report in `154-it1-analysis.md`

# Iteration 2

We have made some decisions, answered some questions, and perhaps opened up more.  Please produce a first-draft implementation plan.

As discussed below, we assume that sprint-153 will be implemented first, so you'll have at least one more chance to review the code before committing to an implementation plan for this sprint-154.

## Notes while reading analysis

Yes: Use docked for everything. Float was only for mock-up.  No need to support it at all.  It was actually a bear to set up because of constant dragging around and window resizing to get the spacing right!

Yes: No Tool Tables.

For this sprint, DisplayOptions can take the simplification discussed below for Theme automation: assume that each tile is the same DisplayOptions so they all match, which is really the concept of the superchart.  The fullscreen view or preview may eventually show per-Section DisplayOptions, and that would be very useful, but is out of scope for this sprint.

H7. Yes, accept the recommendation and allow the Caption into the horizontal row widget. (Since the widgets are separate markup, we can author these separately and not have the code decide to hide Caption in vertical/LeftRail mode for example.)

H12. `Print` theme, (descends from `Snow`) already handles most of this.  We have found that `AutoColor: false` prints a whole lot more readably for seeing a whole song during a performance (SingleNote borders actually printed nicely making Note Name and Function very clear and high-contrast), but `AutoColor: true` was still useful for detailed study while practicing, since working with the printed page then shows similar colors to screen view on a monitor.  The note fill colors used in CycleOfColors, Stylesheets, and Roles all become part of the musician's memory and are great for learning modes and keys.  It would be up to the Song author to create or use a Stylesheet for the whole Song that is printer-friendly in both color and grayscale printing (lighter colors, more use of hatching than solid fills).  That is therefore out of scope, so long as selecting a Stylesheet or Look is available during `print` layout.

Superchart is our new term for the printed page with optional Chart at the top, and multiple per-Section snapshots of Instrument@Section.  In the existing music literature, Song Charts, and Scores, often have small glyphs of chords that show a tiny table (about `4 frets` X `6 strings`, for example) with tiny dots where we show Notes.  These tend to be scaled to about the size of a printed word, so fit nicely over the score.  The other option is TAB, where the timeline and the fret positions are merged into a score.  infinite-neck attempts to go beyond the limitations of these systems, by effectively showing Master-Detail view in normal screen presentation: the Chart is Master, the Instrument@Section is Detail which displays when the Current Section cell of the Chart changes.  So when we go to print, we are envisioning something closer to existing scores and TAB, hence the tiling of, say, 6 Sections with a Chart row/rows on top of the page. The musician follows the Chart, and simultaneously has a visual reference of the voicing of each chord in the 6 printed Section snapshots below.  We would rely on recorded notes in the first beat only, so the Song must be authored with an idea of how it will print.

Print layout should include presentation of choice of chart as you can today: Chart, LeadSheet, Line, Line+"Show Next Line".  Since you can turn these on per Layout, if you were in `print` Layout and requested a chart variant normally, that would be the one displayed in the printed page and the screen (really just fullscreen but knows it is `print` so it is effectively print preview).

For print, we would likely hide Instrument Caption and Section Status widgets, because 1) they include print-ink-heavy coloring, 2) are redundant, and 3) are largely not needed for printed supercharts.  sprint-153 was designed to replace the existing widgets for print Layout.  For example, Relative Section Amount would be useful in screen Layout to make sure the Sections are laid out correctly, but we wouldn't need them in print Layout because the page cements the order.  Section Key would be valuable, but will be presented as simple text, similar to how Chart>Chart does it. 
 

allowThemeAutomation is overkill for print.  Assume we go with the USER Theme derived from `Snow` and install it as system Theme `Print`. (We also have to tweak the Nut which currently uses colors too light to print, and problematic borders that are too attention-grabbing.)  While having the tiling be able to show Theme-per-table-per-Section might be nice for viewing songs on screen instead of printing them (which means this would work during looping ?!?!?!), that should be considered a nice-to-have.  The Design decisions seem complicated and that feature should be out of scope.  So for these sprints, consider that the only Theme allowed is the default Theme, or one single Theme chosen as part of the print options.  Defaults to Theme: `Print`.  Viewing all on screen as `Theme: Print` then is the simplification, and prints nicely, since we will address issues such as shadows and problematic colors for `Print`.

The issue we are most unclear about is the split between thinking of this as a Layout, and as Print Preview.  Ideally, we think of going into Layout `print` which is effectively Layout `tile` but with rules/limitations versus a generalized `tile` where we could put multiple instruments in multiple Themes, DisplayOptions, and multiple tile sizes etc.  We are definitely not doing that.  But we would like to be able to be tiled in `print` layout and turn on Caption rows, LeftRail widgets, and have it be pretty much what we will see when a print media query is in effect and we send it off to the printer.  So we envision Print Preview to be `print` Layout that is live, e.g. follow the Transport, and be a real mode, even if it has "temporary" Observers in "temporary" tiles, with "temporary" options, e.g. all Observers mimic the Main.

We see going into this mode as the system automatically cloning the required number of Observers, matching the Main as much as possible, and not letting us customize those Observers other than through a single panel that affects all at once and lets us throw them away, for example changing the 2x3 to a 2x4.

We see simple buttons for T and L. `T` == "Top Chart Widgets", `L` == "LeftRail Chart Widgets".  They are always available to the right of `S` which puts them inside the hamburger that makes them hidden (e.g. `btnHamburgerCaptionRowButtonsP46_6`).  They live on the Main, and get copied on the Observers.  It's OK that for now the buttons on the Observers work individually.  But going through the tile/print-preview control panel `templates/printlayout/*` should set them up as cloned values as far as state, even if a manual button click is required to re-sync them.  Obviously the values in the widgets need to come from the right Section, and the template (e.g. the expansion used to build the actual widget) should be in one place: the panel that controls the horizontal and vertical markup, which is tied to the Main first.

As far as the editing of the tiled/print mode (number of rows/columns, widget expansion markup, paging, etc.) we see putting a new Tab page next to divSongWidgetsTab and matching button for the widget expansion markup: "ChartWidgets", and another for all the tiling/cloning options: "PrintLayout" (the control panel `templates/printlayout/*`).  Perhaps a radio button to switch between widgets: "Top Chart" and "LeftRail Chart" on one Tab Page called "ChartWidgets".  We see a GUI-first approach for designing the Tab page called "PrintLayout". We would do command-line access later when we can see which things we would want to make available to the command-line and thus Macros.  Changing anything on "PrintLayout" should affect the Layout and tiling live.  The actual effects are throw-away.  The persistable parts are the choices on PrintLayout Tab.

We would appreciate a code snippet for pasting into DevTools for investigating the spike from section 7.

## Points Answered

Choices by Section in 154-it1-analysis.md

- 1.1 All docked, no floats.
- 1 Recommendation
  - Accept the one sentence recommendation.
- 3.1 points  
  - Backgrounds and cell colors will be modified by print-friendly Stylesheet, to be developed after implementation.
  - single `--print-scale` variable sounds right.
  - no floats
- 3.2 points
  - Accept CSS Grid recommendation.
- 3.3 points
  - Choose "Forward" as the only option.
- 3.4 points
  - Blank policies: support only `blank`
  - Navigation helper on PrintLayout panel seems cool.
  - let the plan hide the tile. Agree on this less invasive, second option
- 3.5 points
  - We lean towards an ephemeral solution as discussed above, but we  like the "Stage A, page view" option.  We are fine doing that for the first round, and either an option to ditch it all, or just save the panel options and not save the Observers.  Seems there might be more work in defining this.
- 3.6 points
  - Agree on the minimal, elegant solution.  "reference by inheritance" etc.
  - Agree on de-duping the tuning copies.  Not even sure anything goes in the persisted Song file.  In this way, it is more like Print Preview, but the tiling options and Observer options are stored as properties of the panel.
- 3.7 points
  - Yes, call it simply `Print` in Themes.
  - As discussed, no allowThemeAutomation applies to printing (or previewing either).
- 3.8 points
  - Yes, use the Main's DisplayOptions, so the tiled tables look as similar as possible.
- 3.8a points
  - As discussed, SectionStatus will most likely be turned off for printing.  It seems useful to let it behave as it does today and make the User turn it off, at least in the Main, rather than some fancy control on the tiling control panel `templates/printlayout/*`.
- 4.5 points
  - Commands: defer command-line addition until later, except for matching siblings for show/hide/toggle of Layout elements, e.g. `/vtw`
- 6 Holes
- H1 We would appreciate some boilerplate or sample code or recipe for completing this Spike.
- H2 Single `--print-scale` seems a good step.
- H3 Discussed above.  
  - `blank` only
  - Navigation helper
  - hide the tile
- H4 Seems we want both: navigating with Transport slides.  Hitting the NextPage button moves by rows*cols.  Not sure how to handle when sliding but then going to print multiple pages.  I guess that's why other apps have a real "Print Preview" in addition to "Page Preview" mode.  If we have to choose, NextPage is more reasonable.
- H5 Resolve from tile's Section.
- H6 Just one Main Instrument.
- H7 Accept recommended tokens.  Our idea is that the default expansion markup will have all the `${getSectionCaption}<br>${beats}<br>...` in the default initial system storage, and authors will delete expansions they don't want. See additional discussion above.
- H8 minimal persistence, lean towards throwing everything away except options for control panel `templates/printlayout/*`.
- H9 Personally hate headers and footers as page-wasters! :) Section numbers are available in widgets.  Perhaps supported in later iteration.
- H10 Regenerate yes.  No undo.  Real data is in the Song and Sections and Main Instrument.  Save data for control panel `templates/printlayout/*`, but don't worry about undo or graveyard.
- H11 Either use Song default or put Theme choice in control panel `templates/printlayout/*`.  Probably simplest to have it in control panel `templates/printlayout/*` and simply ignore Song and Section settings.
- H12 Answered above.
- H13 Not sure.  Make reasonable, safe, simple choice for implementation.
- H14 Will test.
- H15 Tool tables and Listeners definitely out of scope.
- 7.1 would appreciate recipe.
- 7.2 Hopefully, implement sprint-153 first, which should close this gap.
- 7.5 Decisions:
  - forward as the default (3.3). YES.
  - plan-owned blanks (3.4). YES.
  - print as a third Layout screen (3.6). YES.
  - inheritance instead of copy for Observer layout (3.6). YES.
  - and whether Stage B is in scope for this sprint or the next. NEXT sprint / later Iteration.

# sprint-154 Iteration 4

## ANSWERS for: 10. Questions for the review round

- **Q2. `print` flag defaults** (4.5), now including `LeftRails: false`.  Recommended as written.

  - ANSWER: Accept recommendation.
  
- **Q3. The panel in fullscreen print.**  Recommended: ESC returns to it; floating it via `dockable.js` later if wanted.

  - ANSWER:  Accept recommendation.
  
- **Q4. Print is not fullscreen** (menus stay, `@media print` hides them).  Recommended: yes.

  - ANSWER: Accept recommendation. 
  
- **Q5. Option T** (transient tiles in the model, filtered at save).  Recommended: yes.

  - ANSWER: Accept recommendation. 
  
- **Q6. Command siblings.**  Which letter, and an enter / leave pair now?

  - ANSWER: No command-line changes this round.  Presumably we can enter / leave print with the GUI print control panel. 
  
- **Q7. Main's own per-table Theme override** while previewing: recommended ignore and restore on leave.

  - ANSWER:  Accept recommendation.
  
- **Q8. Pages aligned to multiples of N** (Next snaps).  Recommended: yes.

  - ANSWER: Accept recommendation. 
  
- **Q9. Size caps:** 1-8 for rows and columns, 24 tiles.  Enough?

  - ANSWER: Almost.  Allow 48 max tiles so if the author makes small tables he can fit them in, in the style of current music literature chord books.  It may cause slowness, which is OK.
  
- **Q10. Auto fit in the first round**, or manual percent until the spike results are in?  Recommended: both, Auto fit measured from `.instrumentBackground`.

  - ANSWER:  Accept recommendation.
  
- **Q11. Which table is the Main** when several qualify: remember only in the panel (recommended).

  - ANSWER:  Accept recommendation.

New:

- **Q1. Left width: fixed or minimum?**  Recommended **fixed** (`width` = `min-width` = `max-width`) so all tiles match even with a longer chord.  If you prefer the pure `min-width` of your workaround, the CSS drops two lines and the label says "minimum".

  - ANSWER:  Accept recommendation.
  
- **Q12. Default width** `4.8em` (identical to your accepted look, 4em plus padding) or a round `4em` total?

  - ANSWER:  Accept recommendation.
  
- **Q13. Top padding default `'align'`** (checked) when the left widget is on.  When the left widget is off, the Top widget has nothing to align with, so the number field is used (default `0.4em`).  OK?

  - ANSWER: OK.
  
- **Q14. Widget checkbox defaults** `true` / `true` in `print`.  OK?

  - ANSWER: OK.
  
- **Q15. The latent Layout bug fix** (Step 3) is outside the print work.  Include it in this sprint (recommended; two lines in a non-CORE file), or log it separately?

  - ANSWER: Approved for inclusion in this sprint.
  
- **Q16. `showDesktopTab` refactor** in `infinite-neck.js` is CORE and touches working tabs.  Recommended: do it (adds the tab cleanly, covered by the UI script); alternative: one more `if` branch with no refactor.

  - ANSWER:  Accept recommendation.

# sprint-154 Iteration 5

Testing is going well.  We have one bug, one feature request that may be informational only, and one feature request that is required.

## bug

The bug is that this element shows up when we first click "Enter Print Layout": 
```
<div id="divP46_1_wiring" class="divWiring">Wiring for divP46_1 goes here.</div>
```
Note that it has no controls in it, but is visible and does consume the regular amount of space.
Since we are in print layout, and the code seems to already suppress display of the event wiring controls, this div should also not be displayed.  We have been dismissing it with the usual `e` keyboard shortcut.  We don't think disabling this keyboard shortcut is the best way to fix this bug, we'd prefer to have that div be suppressed. But the cleanest bugfix would solve the problem and not make future debugging of keyboard shortcuts a head-scratcher, regardless of the strategy used.

## Optional Feature

The optional/informational-only feature is that we are having a hard time visualizing the bounds of the printed page once "Paper" `#plPaper` is chosen.  Would a bounding box representing the page dimensions or the printable area dimensions displayed around all the tiles printable on page 1 be feasible and accurate?  If it can be calculated in advance of going to the system print dialog, then it would be cool, and you should try an implementation.  If it can't be reliably calculated or displayed, then please just inform us of the problems or decisions in the implementation report, and skip coding it.

## Required Feature

For the required feature of this Iteration, we would like to now implement the increase of `CHART_WIDGET_TEMPLATES` from a single value for top and a single value for left to now be multiple values for each provided by the system, and allow User-editable values to the end of each list.

This will require a caption for each and an id.

Follow the example in `#btnCustomizeFunctionSymbols` for `#dropDownFunctionSymbols`.  That editor allows chosing a caption, a system-managed ID, a Save and an `X` button, a dropdown, a "Customize" button, a textarea for editing, and a preview table.  We do not need the preview tables, since we will be sitting on the `#divPrintLayoutTab` tab, and will have the print preview tiles open and will be able to see changes.  It does mean that the changes should be "live" with appropriate events so the instrument table print captions "Top caption widget" and "Left rail widget" get updated. Also, we don't need the up/down buttons for re-ordering the User-managed list items.  They can simply be added to the list and retain the order there, and the `X` button simply removes them from the list and SELECT, since they should all have IDs.

We will need two of these editors, one for "Top caption widget" and one for "Left rail widget".  Just place them on the `#divPrintLayoutTab`, "left" before "top" arranged over the other on the page.  If they were divs, it would just be  a div for the "left" editor, followed by a div for the "top" editor.  They don't need a special container different than how the other controls run down the page.

We need one feature not found in the dropDownFunctionSymbols editor area.  We need a dropdown and insert button similar to "SongWidgets" > "class:", i.e. the controls `#selWhitelistClassesSongWidgets` and `.btnInsertWhitelistClass`.  Their instances on `#divPrintLayoutTab` should be just like the ones on the SongWidgets page, but should target the correct textarea.  Specifically, they should point to the same whitelist.  (Rather than the previous idea proposed in this sprint, we are not using radio buttons to make the controls do double-duty. Instead, these "top" and "left" editors will coexist, one per each, and both visible at the same time, so there will be two of everything.)  We don't need the save false button from the SongWidgets page, because we will have an actual Save button as implemented on the Function Symbols editor.

Please proceed to APPROVED coding, making the choices you normally propose as "Recommended" choices in questions to us, but auto-approving them yourself, and reporting the choices and implementation details in an implementation report `154-it5-implementation-report.md`, rather than an implementation plan that we approve. We think the patterns of the Function Symbols editor, the SongWidgets whitelist insert mechanism, and the previous discussion in this sprint on how to turn the single frozen values into expandable lists give sufficient guidance.  If there are any issues, we'll fix them in a subsequent clean-up round.

Here is the example of what the system-provided list will look like, that you can popluate the structure with.  (We will actually use the User-edited list to develop the system-provided list further, and copy from the Song JSON to the source in `instrument-chart-templates.js` as developers, so this is just a list to establish how the captions will work.  You'll need to work out how the IDs are persisted.) We are not saying this is the best data structure to store, or how you handle IDs, or whether `placement` is a property, or only the name associated with each list.  We leave those details up to you. We just want to point out how the captions will look.

```
top: 
[
  {
    placement: "top",
    template: '<b>${chartChordCaption}</b></span><span class="spacer2"> </span><span class="fontSmaller">${chartModeCaption}&nbsp;&nbsp;${getSectionCaption}<span class="spacer2"> </span>${rootKeys}&nbsp;&nbsp;'
      + '&sect;${currentSectionCardinal}&nbsp;<small>${beats} beats</small></span>',
    caption: "Chord,Mode,Caption,k,s,b"
  },
  {
    placement: "top",
    template: '<b>${chartChordCaption}</b>',
    caption: "Chord"
  }
]
left: 
[
  {
    placement: "left",
    template: '<b>${chartChordCaption}</b><br>${rootKeys}',
    caption: "Chord,k"
  },
  {
    placement: "left",
    template: '<b>${chartChordCaption}</b>',
    caption: "Chord"
  }
]
```
Again, the captions are programmer-editable via the source code for the system items, and User-editable for the User-added items via the GUI, so it doesn't matter what they are in this rev.  They have no symbolic or semantic meaning or mapping, they just bind to each template object as sibling properties.

