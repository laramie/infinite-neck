# Notes

1) Bookmarks should be an array as well.  If restart-tutorial is needed, use last-bookmarked-section.  Idea is bookmarks should allow User to mark zero-to-many Sections for revisiting.

2) plan says: "Strict default visible surfaces should include: topLogoMenuBar, or equivalent stable top logo area".  Not sure this is correct: we may want logo in tutorial widget row left if we can make it small and stylish. We certainly don't want it consuming a whole row, and in strict mode there are no menu buttons.  And we don't want the hamburger.  Logo also appears in bottomStrip.

3) Edit/Revise this: 
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

4) Confirm that plan suggestion for splash as separate template is correct.  Should be independent of tutorial.

5) splash screen animation is in `img/splash-screen-animation.gif`

# Iteration 3

# Simplifications

To keep code changes to the core to a minimum and ensure success and simplicity for tutorial mode, we are making the following simplifications to the Iteration 2 design.  This is Iteration 3.  It encompasses all Iteration 2 features minus the simplifications.

## No special wizard mode

Wizard mode will still be a named mode, but it won't do anything in this sprint, other than allowing the viewing of the prompt (Section.tutorial.lines[]) and Section.tutorial.caption in the tutorial Prompt Area, without the widget row, and without the breadcrumb row.

This simplified wizard mode can be extended in the future, but the only use-case it handles now is allowing prompts per-Section for Song Authors who want to provide tips to advanced Users.  Since this is for advanced Users, all other features and chrome are available since it really is just normal mode.

So the User is cruising along in normal mode, and is advised in `Info` that some sections have wizards (per-Section prompts) and so turns them on with `/vsw` (`view > show > wizards`) and hides them with `/vhw` (`view > hide > wizards`). These actions work by setting tutorialMode=wizard.  When they are on, that is tutorialMode==wizard, if there is a prompt in a Section, they "pop up" in that the Prompt Area is suddenly visible on showing a Section, and suddenly hidden when entering a Section with no prompt.

There is only tutorialAuthoring==false and authorPreviewLockdown==false, since we are just in normal mode and don't have a widget row.

## No adding/removing allowedUI

allowedUI is still implemented for strict mode, as the mechanism designed so far for locking down strict mode.

## No special allowed button actions

wizard mode, being normal mode plus prompts, will not have buttons in the prompts.  But it will allow links to macro, raise, and superlinks.  The stylsheet for tutorial.css should allow for links to be styled as pseudo-buttons, so we can make them more button-like by simply having a background-color, border, and padding, and possibly active/hover rules, but still preserving default link behavior.  Thus in the prompt html, they would be authored simply as A tags and not need any more sanitation than is already in place for `Info`.

The tutorial navigation buttons should really just map exactly to the same as the #transport navigation buttons.

## No new keyboard mappings

We will be reusing keyboard mappdings.  The gates in the keyboard handler functions will either let the code path in, or they won't.

ESC / Escape key : Does not stop looping.  Does not exit tutorial.  Since it's main action is to exit fullscreen and hide menus, it should not have any effect anyway.

document_keypress would have a gate, something like: 
```
  if tutorialMode == strict and not key in ['n','b',',','.','<','>','h','H','w','W','l','L']
  then return early from document_keypress().
```

# Iteration 2 Questions Answered

Given the Simplifications, we can now answer questions from Iteration 2 implementation plan draft.
