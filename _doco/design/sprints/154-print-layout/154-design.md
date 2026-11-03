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