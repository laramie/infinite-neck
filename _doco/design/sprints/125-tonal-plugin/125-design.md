# Design

This next question is for a future, unscheduled sprint.  No code changes, no implementation plan.  Please produce a design-sketch document as described below.  It is currently sprint-903.

We want a hand-waving answer about what the shape of the menu and the viability of having a command-line menu version of the TonalPickers.

Here's our hand-wavy wish-list:
903-TonalPlugin
  - allows clearing the filter for Western modes. It's a toggle.  When off, the TonalFunction.js filterWesternScales is paused. 
  - has a nextSection, prevSection nav
  - has a A) Accept first modes, and A) Accept first chords in modes and chords sub-menus
  - has a numeric list of suggestions to accept, just like the tonalPicker
  - writes to Song automatically (maybe protected with an option) 

  Again, this is just to start a design discussion on our side, based in the reality and feasibility of the code side.

Include a proposed full plugin menu shape, and include discussion of risks and design/product challenges and coding challenges.

Let the output report be in `_doco/design/sprints/903-tonal-plugin/903-design-sketch.md` 

