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

# Iteration 3

In this iteration we are aiming to make simplifications.  The net result should be a new version of the implementation plan, to replace the Iteration 2 implementation plan.

## Simplifications

1. The proposed leftRailChartHost and instrumentChartTop  widget container elements are for `print` *only*.  They do not need to be accessible during other uses, are not part of the toggling buttons in the Instrument Captions.  There is thus no per-instrument UI for toggling them.  There is thus also no command-line toggle/view/hide either.  They are toggled by the print control panel and replicated in all the tiled Observers.  

    (In non-print presentations, we already have a Caption (`.lblSectionCaption`), Widget Row (`.SongTitleLeadSheet`), and SongWidgets (`.lblSongWidgets`) for showing chart strings, and per-Instrument we have (`.captionRow`) where we can open the Tonal.js displays. If we ever decide they are useful when we have lots of Instruments showing, then we can use the plumbing we built in this sprint and promote them.  Until then, assume they are only for print.)

2. Similarly, nothing in `.leftRailStack` is needed for print, and nothing in `.captionRow` is needed for print.  The proposed leftRailChartHost and instrumentChartTop  print widget elements *replace* viewing of current `.leftRailStack` occupants `.leftRailCaptionHost` and `.leftRailSectionStatusHost`, and `.captionRow` occupants.  We think the simplest way to implement this is to retain the existing element and add new siblings left/top of them.  We aren't sure whether this means these elements with the above classes or their containers, but please work it out so that the current layout and flex parentage etc. are retained, and new containers for leftRailChartHost functionality and instrumentChartTop functionality act as siblings inside the correct stable existing container for maximum simplicity and least disruption.  Since for example `.leftRailCaptionHost` may some day get another legitimate, toggled sibling of some other flavor, it seems one of its parents should be the one that is display toggled, but we'll let you work that out.

3. To save having to enter and delete text from the textarea for widget expansion source, the print control panel should simply have two checkboxes: `[] show left chart widget` which shows `leftRailChartHost` and hides `LeftRail` and `[] show top chart widget` which shows `instrumentChartTop` and hides `InstrumentCaptionRow`. When unchecked, no widget expansion is added and all the elements stays hidden in print Layout.

4. The Observers simply follow how the Main is configured thusly, since the control panel clones them.

5. The Observers are never built for use outside of print, so may allow more simplification.  They always follow the Main (Tunings fields such as number of frets, DisplayOptions, Theme, and so on), they always follow the building of the tiles, they always get the chart widgets or they don't, they only are viewable from where the tiles container is (which may mean they simply don't appear in fullscreen).  So this becomes more like print preview than being a generalized Layout Manager with grid option.

6. The default template can be simplified thusly.  There is more screen real estate in horzontal mode, so we keep vertical mode the more terse one.

```html
<!-- top (horizontal) -->
<b>${chartChord}</b>&nbsp;${chartMode}&nbsp;&nbsp;${rootKeys}&nbsp;&nbsp;&sect;${currentSectionCardinal}&nbsp;<small>${beats} beats</small>&nbsp;${getSectionCaption}&nbsp;

<!-- left (vertical) -->
<small>&sect;${currentSectionCardinal}</small><br><b>${chartChord}</b><br>${rootKeys}
```

7. For Q1. we aren't quite sure the implications, but we'd like to restate that the Observers are entirely built by the print control panel, and as simplified above, have almost no way to access customization of their UI any more in `print`.  Hopefull that implies that there is nothing to persist, and nothing to choose, except letting the print control panel do cloning that matches the Main.

# Iteration 4

One thing want to change is to use the optionally transposed values: 
`${chartChordCaption}` and `${chartModeCaption}` , though later we will want to also provide `${chartChord}` and `${chartMode}` in the sibling instrument-chart-templates.

So the first-round templates should be: 

```html
<!-- top (horizontal) -->
<b>${chartChordCaption}</b>&nbsp;${chartModeCaption}&nbsp;&nbsp;${rootKeys}&nbsp;&nbsp;&sect;${currentSectionCardinal}&nbsp;<small>${beats} beats</small>&nbsp;${getSectionCaption}

<!-- left (vertical) -->
<small>&sect;${currentSectionCardinal}</small><br><b>${chartChordCaption}</b><br>${rootKeys}
```

## ANSWERS for 8. Questions for the review round


- **Q1. `${instrumentCaption}`.**  Ship the token (not used by the curated templates), so whoever edits the template file can add the Instrument name?

    - ANSWER: YES

- **Q2. The two templates.**  Verbatim from the design doc (3.4).  The Top one ends with `&nbsp;` after `${getSectionCaption}`; the Left one has no mode and no beat count.  Confirm.

    - ANSWER: YES, fixed.  Left one is more spare.

- **Q3. `live` tokens and captions.**  Blank (not echo literally) song-wide `live` tokens such as plugin status inside widgets; and `getSectionCaption` expanded once in the widget's context (recommended) or inserted as raw escaped text.

    - ANSWER: use recommended. 

- **Q4. SectionStatus leak (F13).**  Also call `SectionStatusBuilder.removeAll()` before each table rebuild in this sprint?  Recommended: yes, one line, same place.

    - ANSWER: use recommended.

- **Q5. Names.**  Confirm `instrumentChartTop`, `leftRailChartHost`, `icwTop` / `icwLeft`, `templates/InstrumentChart/`, and `window.InstrumentChartBuilder`.

    - ANSWER: Confirmed.

- **Q6. Step 5.**  Scope the Tonal tokens in this sprint, or leave for later?

    - ANSWER: Do in this sprint-153.

- **Q7. Mode semantics.**  `setMode` merges partial input (`{ top: true }` leaves `left` alone), and the mode resets to off at every Song load in 153 (154 re-applies it from its persisted panel choices).  OK?

    - ANSWER: OK.

- **Q8. The template file shape.**  A flat `{ top, left }` of two strings now; the 154 selector later changes the file to named choices without changing callers (3.4).  OK, or would you rather start with named choices now?

    - ANSWER: Continue without the named choices for this sprint-153.

## Iteration 4 Request

With that one change, plus the answered questions, we think the plan says all holes have  a strategy approved. Please proceed to CORE-APPROVED coding.

