# Iteration 1

## Initial Design Wishlist

In this sprint we would like to:
- Create widgets to show chart info close to the Instruments for print layout, especially when print layout shows multiple Sections by using Observers.  This is done in song `demo/superchart.json` using Floated Observers and fullscreen with and Grabbles off and a modified "Snow" Theme with darker cell shadow borders so it plays well with print on paper.  However, print layout is not defined yet, just mocked up in this song, where we drag the floating Observers into an ad hoc grid-like layout.  In a later sprint we will define a real print layout presentation mode.
- Widget Specs:
    - Create a pair of widgets that can show chart chord, chart mode, and keys: one vertical layout, one horizontal layout.
    - Optionally show the horizontal widget layout in Instrument, in a row above the Instrument Caption Row. Allow this row to be toggled separately from Instrument Caption Row.
    - Optionally show the vertical widget layout in the Left Rail
    - Allow the Left Rail version to play in the scheme of stacked or side-by-side already toggled with `C` and `S` and `⇋` (`.showLeftCaption` `.showLeftSectionStatus` `.toggleCaptionLooperLayout`) buttons.
    - Create an editor for the widgets so they can be customized like SongWidgets, but with default HTML provided by the system that use allowed/sanitized CSS classes and `/vdv` variables.
    - Ensure Chart Chord, Chart Mode, Key, LeadKey and needed flavors are in `/vdd` variables. 

## Iteration 1 Request

Please produce a high-level analysis of this wishlist, showing how it would be implemented, making recommendations for elegant design, and showing any holes in Design that need addressing.

We don't need detailed reporting on code locations yet.  But we would like to understand where new modules would be needed, and broad strokes around new methods and members needed.

Please produce the report in `153-it1-analysis.md`

# Iteration 2

We have answered the questions we could see from your document.

We are ready for a first-draft implementation plan.  We expect that we have more decisions to make, and that we have opened up more holes.

## sprint-153  choices

Yes, we meant `/vdv` not `/vdd`.

### GUI for the widget expansion text

We see one Tab page with two radio buttons.

We don't see multiple options for vertical and multiple options for horizontal and CRUD to manage them.

The User either uses the default built-ins, or modifies one or both of them per Song.

They largely use a set of expansions: 

- vertical: `${foo}<br>${bar}`

- horizontal: `${foo}&nbsp;${baz}`

#### Copied from sprint-154 document: 

We see simple buttons for T and L. `T` == "Top Chart Widgets", `L` == "LeftRail Chart Widgets".  They are always available to the right of `S` which puts them inside the hamburger that makes them hidden (e.g. `btnHamburgerCaptionRowButtonsP46_6`).  They live on the Main, and get copied on the Observers.  It's OK that for now the buttons on the Observers work individually.  But going through the tile/print-preview control panel `templates/printlayout/*` should set them up as cloned values as far as state, even if a manual button click is required to re-sync them.  Obviously the values in the widgets need to come from the right Section, and the template (e.g. the expansion used to build the actual widget) should be in one place: the panel that controls the horizontal and vertical markup, which is tied to the Main first.

As far as the editing of the tiled/print mode (number of rows/columns, widget expansion markup, paging, etc.) we see putting a new Tab page next to divSongWidgetsTab and matching button for the widget expansion markup: "ChartWidgets", and another for all the tiling/cloning options: "PrintLayout" (the control panel `templates/printlayout/*`).  Perhaps a radio button to switch between widgets: "Top Chart" and "LeftRail Chart" on one Tab Page called "ChartWidgets".  We see a GUI-first approach for designing the Tab page called "PrintLayout". We would do command-line access later when we can see which things we would want to make available to the command-line and thus Macros.  Changing anything on "PrintLayout" should affect the Layout and tiling live.  The actual effects are throw-away.  The persistable parts are the choices on PrintLayout Tab.

### Holes / Decisions

- H1: Accept recommandation. Code to land first.
- H2: (c) Accept duplication, author can turn off before printing.
- H4: Accepted.
- H5: (Copied from sprint-154 document)
  - We see simple buttons for T and L. `T` == "Top Chart Widgets", `L` == "LeftRail Chart Widgets".  They are always available to the right of `S` which puts them inside the hamburger that makes them hidden (e.g. `btnHamburgerCaptionRowButtonsP46_6`).  They live on the Main, and get copied on the Observers.  It's OK that for now the buttons on the Observers work individually.  But going through the tile/print-preview control panel `templates/printlayout/*` should set them up as cloned values as far as state, even if a manual button click is required to re-sync them.  Obviously the values in the widgets need to come from the right Section, and the template (e.g. the expansion used to build the actual widget) should be in one place: the panel that controls the horizontal and vertical markup, which is tied to the Main first.
- H6: Exclude. No Tool Tables.
- 4.5 effective-flag. Accept recommendation for minimizing repetition, and using inheritance.
