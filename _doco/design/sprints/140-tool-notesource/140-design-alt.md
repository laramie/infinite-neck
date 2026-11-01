# sprint-140-tool-notesource Design

## Goal

We would like to support our new Tool windows with notesource data providers.

A Tool window is an instrument that has Tool checked in MyTunings, such that tuning.Tool is true, and so doesn't have an Instrument Caption Row, but just has a Float button in the caption row div.  It gets its display options specially from persisted DisplayOptions in Layout, stored in Song.noteTablesLayout in planned property `ToolDisplayOptions` checked by `infinite-neck.js::checkOptionsForToolTables()`.

It is planned that Tool tables will have no click handlers, so will be informational only--Users won't add notes, they will be added from a predetermined set of notes.

However, right now, we have to populate that set of notes for each Section.  

The basic use-case is "Perfect4thsCalculator" which is populated with every NamedNote, but which does respect the Key of the Section, the Note Function and correct AutoColor is displayed for each Section.  Thus, by consulting the floating table against notes that may or may not be displayed in a particular chord or mode in an instrument in any Section in the Song, the User can quickly see the cycle of fourths in correct order, color, and function.  So a User may be looking at a C chord in the key of C in a P4 guitar, which has notes C, E, G, but want to know what the fourths above C (the F and the Bb), and to know their colors, without having to place those notes in the Song on his current guitar, and without having to turn on "Show All Note Names".

Another use-case would be to show a chart chord on a one-string tuning or two-octave Piano in a Tool window, always rooted on the noteRoot.  Again, this smells exactly like FillPlugin.

The design is to have the set of notes provided by the "notesource".  The obvious choice is to use FillPlugin to be the notesource.

## Problem

The problem statement is: how do we have FillPlugin be the notesource for many Tool tables with different FillPlugin settings while note breaking any behavior of current FillPlugin as needed by Users who wire FillPlugin to tunings with the "Instrument" property?

Along the way, allowing FillPlugin to fill multiple instruments would be a good feature.

Another option would be to make a Notesource property or class that a tuning can wire to.  The Notesource would be configurable via the command-line, with options like FillPlugin provides, so could provide a preset FillPlugin set of properties.  But this starts to smell exactly like FillPlugin.

## Design

Without any coding changes, please provide an analysis of our options.

What would coding changes look like for: 
1) Allowing FillPlugin a new menu item such as "Instruments" that when you drop into it, allows you to add any instrument (tuning) in MyTunings, and then under that has the FillPlugin menu.
2) Creating a new plugin called Notesource that maintains a list of tunings it drives, and for each instrument, stores an object that is the FillPlugin properties, or another algorithm.
3) another design.

Others have provided analysis of this design.  Without consulting these, please provide your own, unique analysis and write your analysis and proposals to `140-design-alt-analysis.md`