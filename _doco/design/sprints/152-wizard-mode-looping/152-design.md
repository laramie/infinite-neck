# sprint-152 Design Document

# sprint-152 Iteration 1

Sprint 138 added tutorial mode with strict mode and wizard mode.

[sprint-138 sprint document](../138-tutorial-mode/sprint-138.md)

The work was completed partly by Copilot, and then by hand, as documented in the sprint documents.

Left out of the implementation was allowing IncludeInLooping in wizard mode.  We now want to add it in the same page location and functionality it has in strict tutorial mode.  

## Features we want in wizard mode: 

Mostly we just want `.lessonSectionList` to be available.
This can either be accomplished by turning off all other tutorial chrome under `#divTutorialPrompt` or by making a new div that just holds an instance of `.lessonSectionList`.  This should be available in fullscreen and non-fullscreen modes, since wizard mode allows those presentations.  It should be hidden/toggled/hidden/shown by a new set of command-line menu items:
- under `/vtw` as `p)ractice list`
- under `/vhw` as `p)ractice list`
- under `/vsw` as `p)ractice list`
All have trigger `p` and behave as the other siblings: toggle, hide, view.
These should be remembered in `Song.layout` so that they are presented separately in `fullscreen` and `escaped` like some of the others. 

We think the easiest to see and maintain is to retain the `Done` and `Bookmark` columns.  We have tested this in a song where we simply set presentation mode to strict tutorial, and upon saving and re-loading, the bookmarks and done columns came back as persisted in Browser storage.


## Features we don't want in wizard mode: 

We don't need the other elements of `#divTutorialPrompt` available except for `.lessonSectionList`.  So we don't need breadcrumbs or `#tutorialPromptWidgetRow` for example. 

We don't need a fancy display or buttons around the list.  A new container with simple paper background and box-shadow like `#divInfoRendered` inside `.infoTabsPaper` would be ideal.

## Enhancement to LOOP display.

Recall that IncludeInLooping is only for Section looping, and not beat looping.

When we are Section looping, with a Set that constrains which Sections will be played, i.e. IncludeInLooping is in effect and not just with all Sections included by checkboxes, we want the Looper Light to use a different border everywhere.  e.g. this rule from section-status.css would be runtime-modified with:
```
.SectionStatus_loopLight {
    border: 3px dashed green;
}
```
The magenta and green color switching would be as they are today.  The rest of the style also stays the same.

In the Transport, the hint is already done in strict tutorial mode: the caption is "LOOPING 1..3" for example.  This should work in wizard mode.  Wizard mode does not hide the Transport, so we don't need the special minimal strict mode controls in `tutorialPromptWidgetRow`.

## sprint-152 Iteration 1 Request

Please evaluate our design and produce an implementation plan with questions.  We will answer questions then approve coding.