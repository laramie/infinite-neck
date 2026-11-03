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