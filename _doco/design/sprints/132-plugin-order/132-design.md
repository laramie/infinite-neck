# Design

When the attached-to-chat songfile, found here in the repository: 
[songs/sprint-121/C-chords-w-tiny-modes.json](../../../../songs/sprint-121/C-chords-w-tiny-modes.json)
is looped, TransposePlugin seems to run after FillPlugin.  The fill of TinyNotes has happened, and then the transposition takes effect, and all the TinyNotes are moved up one chroma per transposition.  If we change chroma, the movement amount changes too.

The design of this song uses the interaction of the plugins following a certain mental model.  We want the code to suport this model.

Additionally, we think the mental model has FillPlugin being "applied" before ArpeggioPlugin, but aren't so sure of the code status of that.  We think there are valid use cases for switching the ordering of these two.  

Obviously, there are several orders, in truth.  The order duing beat looping, the order during looping, and the order due to DaCapo events, which is affected by the fact that not all plugins listen to the same events at the same times, e.g. Transpose runs on DaCapo looping the song, while Fill runs on starting a Section.  This needs to be considered.

We need the plugin order to be dictated on looping.  First step would be to validated that this is the culprit.  Registration order is probably too brittle.  So we were envisioning an array that stored the desired plugin order, somewhere we can change in code in one spot.  We want to put in the array in code first, then support a menu item under `/fap` caption `p) plugin firing order`.  It would take a comma-separated list  (or a simple string of them in the right order without commas) of plugin menu triggers as they appear in `/fp`.  So the advanced User could specify `t,f,a,o,c,m` or `tfaocm`, and the menu after action would look like: 
`p) plugin firing order [t,f,a,o,c,m]`
This would be stored per song in the songfile as a Song property and its property name included in the schema, but values would not be in the schema since they are configuration-driven.

The non-event-listening plugins don't matter, but we'd like to include them for completeness, and resillience to future addition of any of them or future plugins to events.

# Request

Please provide an analysis of applying this strategy in 132-implementation-plan.md
