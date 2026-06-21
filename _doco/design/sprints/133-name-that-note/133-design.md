# Design.

We want to implement a name-that-note practice song using Arpeggio Plugin.
    - arpeggio already has: 
      - style: random
      - string range
      - position range
      - note coloring
      - delay of display of note name and function with "flashcard" mode
      - display NamedNote based on SingleNote inputs, which can be hidden.  So the User can put up to 12 SingleNotes on the neck, in a mode or chord pattern, choose "Hide Single Notes" in View, choose "type": "single" in arpeggio in `/fpat`, enable the plugin, and hit "LOOP" and be in busines.

name-that-note is like flashcard mode with arpeggio today, but within string range and positions a note is chosen at random, shown with the highlight, then revealed with a NamedNote on the next beat.      

If we try this today with style: random, we get some funny results because "random" was never worked out fully or tested. It was put in when we wrote arpeggio, but never spec'd very carefully because we knew this sprint would come some day.

So we'd like to nail down what "random" means, then get into the details of what using "flashcard" mode with random means.

Eventually, in a later Iteration in this sprint, we'd like to teach arpeggio to read the Chart the way FillPlugin does.  But that is deferred for the first Iterations.  We just want to keep it in mind.  For these first Iterations, the strategy will be to allow the User to build Sections with lots of beats (like 24 to 36) so they can easily cover a wide "position" on all strings, and learn that position before changing "positions" (position-pairs in the internal naming of the code) either by adjusting plugin settings manually or through revive, or by setting `positions > values` and "song loops per position" to get the whole practice session they want.

Our first step will be to understand what "style": "random" is doing.  It seems to select the entire candidate set by random number set, on *each beat*, which seems a bit much.  At any rate, for the name-that-note in "flashcard" mode practice, we need it to randomly select one note, show the highlight, then on the next beat show the note name and the next highlight, the way flashcard mode works properly in "style":"every".  Particularly we don't want the highlight to be replaced in the next beat by a random note.  We want the NamedNote shown to be in the exact cell where the highlight was shown in the previous beat.

So the first deliverable from Copilot is `133-analysis-1.md`.  Please provide a bried summary of what random is doing now, and discuss the steps needed to make it do what we have sketched out, and what answers we will need to design or provide for a meaningful implementation plan.
    