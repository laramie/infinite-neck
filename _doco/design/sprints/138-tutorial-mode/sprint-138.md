# sprint-138-tutorial-mode

sprint number: 138

sprint tutorial-mode:

date: 20260711

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: 
- Create a tutorial mode for simple viewing of songs with a minimum of UI or advanced features.
- Allow levels for advanced tutorial Users and for authoring.

## Sprint document locations

- [Iteration 1 Design](138-it1-design.md) 
- [Copilot's Iteration 1 analysis](138-it1-copilot-design-review.md) 
- [Iteration 2 Design](138-it2-design.md) 
- [Iteration 2 implementation plan draft](138-it2-implementation-plan.md)
- [Iteration 3 Design](138-it3-design.md) 
- [Iteration 3 implementation plan](138-it3-implementation-plan.md)
- [Iteration 4 Design](138-it4-design.md) 
- [Iteration 4 implementation questions answered](138-it4-implementation-questions-answered.md)
- [Iteration 4 implementation plan](138-it4-implementation-plan.md)
- [Iteration 5 planing for buttons by hand](138-it5-feature.md) 

## Iterations

  - "Iteration 1": First Design phase
  - "Iteration 2": Second Design phase
  - "Iteration 3": Third Design phase with major simplifications
  - "Iteration 4": Fourth Design phase, added Section List and partial looping, but didn't carry some features forward in the implementation plan.  This implementation plan is the one that got coded by Cody.
  - "Iteration 5": We planned out the buttons, then dove in to make them manually, and manually do the GUI lockdown without the idea of a semantic lockdown list.  We also locked down the keyboard, and with these two, and Cody's work on Iteration 4, tutorial mode strict and wizard were basically working.  We then tweaked by hand, as detailed below.


  After Iteration 4 was done, we found that many of the features had been left in Iteration 2 or Iteration 3, so we went back and, without Copilot, added them manually.  With Iteration 4, and the subsequent work, the feature list now includes:
  - Chart and LeadSheetLine now available in strict tutorial, and in fullscreen.
  - There is no splash screen
  - We implemented the buttons in 138-it5-feature.md and described in earlier iterations.  These all work except the looping buttons' captions get overwritten on section change, and will need some event updating.
  - keyboard lockdown installed
  - Layout and tweaking of the View of tutorial mode, so that it now includes bookmark, done sections, loop-skip sections, sections-list, nav buttons, tutorial caption and section captions
  - anchor tags as pseudo buttons
  - wizard mode
  - correct storage of bookmark and done progress in local browser storage
  - correct functioning of CTRL-SHIFT-m for Easter-egg command-line
  - lockdown of UI 
  - successful lockdown of "KEEP" mode, but problematic setting of "no-drop" cursor.  It works, but using certain nav commands resets to plain hand, though you still can't add notes.  It is just the cursor that is funny.
  - some additional menu items so that tutorial macros can call them
    - left rail widgets toggling
    - work to make Themes settable by command-line so tutorials can have Theme-per-Section
      - display and control of this on the View page.
  - Some more detail from git log: 
    - Fixed left rail caption/section-status widget side-by-side versus vertical.  Removed Cody error of flipping the CaptionRow versions. 
    - Fixed %2F instead of / in URLs. Added themes by id to menu for macros. 
    - Tweaked tutorial layout (added arrow for section toggle). Added dump theme ids to menu. Added show/hide for left rail widgets to menu. Mostly fixed no-drop for tutorial cells, but some nav actions replace it with regular hand, but cells are still locked to KEEP anyway. 
    - Made Instrument Captions have background colors for Observer and Listener--mostly black but subtly green and blue.  Regular is pure black now. 
    - Added 'Allow Theme Automation' checkbox and display of values to View, and its stored 'sectionTheme' variable in Song, schema, and DisplayOptions.
    - Added collapsing of menus and hiding of command-line when a file or URL is opened, including tutorial links.  This especially hides the Song Library when you click on a song. 

At the end of this sprint, we have one tutorial working with all features: [L001-one-string-intro/L001-1.json](../../../../songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json)      



