
# Iteration 3

# Simplifications

To keep code changes to the core to a minimum and ensure success and simplicity for tutorial mode, we are making the following simplifications to the Iteration 2 design.  This is Iteration 3.  It encompasses all Iteration 2 features minus the simplifications.

## No special wizard mode

Wizard mode will still be a named mode, but it won't do anything in this sprint, other than allowing the viewing of the prompt (Section.tutorial.lines[]) and Section.tutorial.caption in the tutorial Prompt Area, without the widget row, and without the breadcrumb row.

This simplified wizard mode can be extended in the future, but the only use-case it handles now is allowing prompts per-Section for Song Authors who want to provide tips to advanced Users.  Since this is for advanced Users, all other features and chrome are available since it really is just normal mode.

This also doubles as authoring mode, since the prompts are visible, and yet all features are available.

So the User is cruising along in normal mode, and is advised in `Info` that some sections have wizards (per-Section prompts) and so turns them on with `/vptw` (`/ > view > presentation > tutorial mode > wizard`) and hides them with `/vptn` (`/ > view > presentation > tutorial mode > none`). These actions work by setting tutorialMode. if tutorialMode==wizard and if there is a prompt in a Section, the prompts "pop up" in that the Prompt Area is suddenly visible on showing a Section, and suddenly hidden when entering a Section with no prompt.

There is only tutorialAuthoring==false and authorPreviewLockdown==false, since we are just in normal mode and don't have a widget row.

## No adding/removing allowedUI

allowedUI is still implemented for strict mode, as the mechanism designed so far for locking down strict mode.

## No special allowed button actions

wizard mode, being normal mode plus prompts, will not have buttons in the prompts.  But it will allow links to macro, raise, and superlinks.  The stylsheet for tutorial.css should allow for links to be styled as pseudo-buttons, so we can make them more button-like by simply having a background-color, border, and padding, and possibly active/hover rules, but still preserving default link behavior.  Thus in the prompt html, they would be authored simply as A tags and not need any more sanitation than is already in place for `Info`.

The tutorial navigation buttons (including LOOP and BEAT-LOOP) should really just map exactly to the same as the #transport navigation buttons.  Because tutorial Sections _are_ Song Sections.

## No new keyboard mappings

We will be reusing keyboard mappings.  The gates in the keyboard handler functions will either let the code path in, or they won't.

ESC / Escape key : Does not stop looping.  Does not exit tutorial.  Since it's main action is to exit fullscreen and hide menus, it should not have any effect anyway. Should continue to hide command-line.

document_keypress would have a gate, something like: 
```
  if tutorialMode == strict and not key in ['n','b',',','.','<','>','h','H','w','W','l','L']
  then return early from document_keypress().
```

Thus, strike this from plan: 
```
Keyboard behavior
  Strict mode keyboard defaults:
    ArrowRight or n: next Section
    ArrowLeft or p: previous Section
    Home: first Section
    End: last Section
    Space: tutorial loop toggle or design-confirmed default
    Escape: stop transient UI/loop, not exit tutorial
```
because we are using the same keyboard mapping, with the restrictions described.

## Easter-egg access to command-line

When the keyboard shortcut `Meta+SHIFT+m` (available in all modes) is pressed, the command-line is launched, as though we were in normal mode and the keyboard shortcut `m` had been pressed.  Thus in any mode, a command-line can be entered.  Upon hitting `ESC` or `x` the command-line is hidden normally.  Thus an author can make command-line tweaks to the Song while in strict mode, or can escape to wizard or none via the command-line presentation sub-menu `/vp` which is where tutorialMode will be placed per this sprint.  So the author could do `Meta+SHIFT+m` then `/vpt` (`/ > view > presentation > tutorial mode`) then choose new item `w) wizard` and be in wizard mode, with controls restored so he can set Section properties, set keys, add beats, clone Sections, add Tunings, create macros, etc., yet still see tutorial prompts and Section.tutorial.caption.  When done, since he now has normal command-line access, he can use either `Meta+SHIFT+m``/vpts` or simply `/vpts` to get back into the command-line thus executing `/ > view > presentation > tutorial mode > strict`.

Thus, the command-line should never be hidden even in lockdown, but should simply not be accessible except by `Meta+SHIFT+m` in strict.  `ESC` should continue to function to hide command-line, and within command-line, since it traps and deals with `x`, that should continue to function to exit and hide the command-line.

# Bookmark Refinement

The bookmark feature should look like this when set: 
 `bookmark: [&sect;1]  [Set]` 
when not set it looks like this: 
 `bookmark: [Set]` 
where `[]` means it is a button, and `1` is the Section number bookmarked.
The entire snippet should be wrapped in a `border: 2px solid black; background-color: white;`.  The `[Set]` button should be green like `.BtnPunchedIn` and when present, the `[&sect;1]` should also be green.  If the User clicks on `[Set]` when the current Section is the Section bookmarked, the bookmark is cleared.
Thus, the bookmark is for one Section max, or unset.

This replaces and obviates the bookmark checkbox in the tutorial widget row.

# Iteration 2 Questions Answered

Given the Simplifications, we can now answer questions from Iteration 2 implementation plan draft.

- plan says: "Strict default visible surfaces should include: topLogoMenuBar, or equivalent stable top logo area".  Not sure this is correct.  In fact, if the menu buttons are hidden (including the leftmost hamburger), we want logo in tutorial widget row first, styled small and compact, and a link to the main app with no tutorial, just like in the bottom strip.  

- We confirm that plan suggestion for splash as separate template is correct.  It *should* be independent of tutorial.  We have experimented with animated GIFs and found the loading delays to be just as problematic, so we will include a very simple CSS transistion animation for a spinner on the splash screen.  For this iteration, a simple "Loading..." message will suffice.

- We believe these entire sections in [Iteration 2 implementation plan](138-it2-implementation-plan.md) are unnecessary: 
  - `## Action gating`
    - Since the system provides the tutorial widget row, with a known set of navigation, bookmark, and loop buttons, authors can't sneak un-sanitized buttons in.  They can only use macro, raise, and superlinks, which are duly sanitized.  
    - Since we know we can already change Tunings and raise plugin settings and run anything on the command-line with at most providing plain-text ID's, we know that even macros are sanitized.
    - And we know from the demo, practice, and name-that-note songs that we can powerfully excercise all the features we could show in a tutorial and make the tutorials flexible for any Tunings we wish to include.

  - `## Keyboard behavior`
    - Obviated by keyboard handling discussed above.

- Logo should go to the URL of the current app.  So we generally load `http://localhost:8000/infinite-neck/`  So if the User is sitting on a tutorial, that base URL should be available. e.g. if they are on `http://localhost:8000/infinite-neck/?song=tutorials/C000-intro/L001-one-string-intro/L001-1.json`  then extracting `http://localhost:8000/infinite-neck/` as the app base is straightforward, since we don't cook up URI's into our URL's (such as this, which we *don't* do: `http://localhost:8000/infinite-neck/songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json`.  You can access that URL, but our basic server simply serves up the raw file.)

- For this sprint, we are not extracting captions from songs or tutorials to update directory `song-list.json` files.  Except for the Instrument badges edited by our build process (`npm run update:song-list` which calls `node bin/update-song-list.js`), we intend to manually edit `song-list.json` files.

- Since the `song-list.json` files are read at run-time, however, we would like to integrate the progress badges into the display listing available on the File menu page under `Song Library`.  Thus, if a song is a tuturial, it should get badges in addition to the Instrument badges.  Except that they will appear in a different location from the Instrument badges.  They would appear after the "Copy song link..." glyphs in the first column.  They would take the form: 
`[&sect;1:&sect;3]` if the User had marked Section 1 as their highest numbered "completed" Section, and had bookmarked Section 3.  The whole badge should have a CSS class we can style that looks initially like `songLibraryInstrument instrumentObserver` and that we will tweak after implementation.  Also, the bookmark should be surrounded by a span with a different CSS class than the completed Section so we can make it a different color etc.

- We confirm that Random Looping should not be available.  But without access to the quick menu or the command-line, we don't feel there is any way to activate it, so again we don't want extra code to guard against it or turn it off.

- Yes, use the looping and beat-looping visuals in the loop buttons.  Also we will want the left rail LooperLight to be visible for tutorials, since the instrument caption row and the Song caption rows are hidden.  

- The bookmark checkbox is replaced by the bookmark buttons described above.  The "Done" checkbox remains.  "Next" does not alter "Done" state.

- Since we are specifying that macros are allowed, we don't need: 
  - `themeSelectorBuiltIn`
  - `tuningSelectorBuiltIn`

- tutorialAuthoring is obviated.

- In terms of sending the User to the Song Library for opening a Library song it would be great if we could send them to the File menu, and open "Song Library" details node. If they click "Open Tutorial" it would be great if we could send them to the File menu, and open "Song Library" > "tutorials" details node.  If they click "Author Song / Play Instruments" we send them to a new, blanks song.  If they click "Open Local Song File" we just send them to the File menu with "Song Library" collapsed.

- Can prompt HTML include `img`? ANSWER: No. However, the various `help.html` links should continue to work, where we can send a User to an image of a widget in action for example.  But we don't want to crowd the Prompt Area with these images.

- Approved variables including widgets may be expanded in Prompt Area just as they are in `Info`.

- We don't need "visited" and "seen" for Sections in tutorials.  Just "Done" and "Bookmarked".  Bookmark does not auto-save Section.  When the User opens the tutorial, they can mash on the "Goto" button of the bookmark widget.

- As described above under simplifications, default wizard surface is "all", i.e. identical to tutorialMode==none, except that Prompt Area minus nav buttons is shown.

- In keeping with the idea of Wizards as guides that keep the User in control, entering into a new Section shows a Wizard text and pseudo-button-styled-hyperlinks as the Prompt Area.  Thus a text could advise the User to mash on the "Change Tuning" or "Change Theme" button without having to have an on-Section-enter-run-macro event, which is a nice-to-have but complicated and out-of-scope for this sprint.  So keeping it wizard-style and letting the User mash on the link to run the macro seems simpler and safe.  This justifies our calling it wizard mode rather than just advanced tutorial mode.

- Splash Screen
  - Full screen overlay seems safest, since we have so many moving parts: menus, tunings, instruments, and later, floating divs.  Plus, it can load quickly if it is kept to a simple set of buttons and a simple CSS spinner.
  - As describe above, yes, open local file should be included.
  - Opening tutorials branch should be a matter of opening "Song Library" and then "tutorials" under that, which will be a first sibling to "name-that-note" and "demo".  By implementation time, expect the tutorials directory to be installed in the Song Library and song-list.json.
  - Splash screen should always load until one of the valid choices is loaded.  If the User has clicked one of the splash screen buttons, they should really just see the spinner and not the button choices any more.

- a "Real HTML parser" sounds like the right option.  Which one would you recommend for solid dependibility, wide-spread addoption, and simplicity?

- Chart Line and LeadSheet
  - running in fullscreen mode and executing `/cl` is the behavior we want, when a User clicks on a link that runs a macro that runs `/cl` in strict mode.  The Line appears without the tab button chrome.  Similarly, in fullscreen mode, and in strict mode, we want `/cc` to run  in fullscreen and strict mode without the tab button chrome.  We said "LeadSheet" but what we really mean is that the tutorial author will set Chart > Options to LeadSheet or Bare or Box, so that `/cc` simply brings up the style that has been set, just as it does today in non-fullscreen mode.  The behavior that in fullscreen mode it remembers that Line is up separately from non-fullscreen mode should thus be extended to `/cc`.  And in strict mode, both `/cl` and `/cc` should be shown without tab chrome since these are an escape into view settings and all kinds of restructuring of the Chart we don't want to expose.



