# sprint-152 Design Document

# sprint-152 Iteration 1

Sprint 138 added tutorial mode with strict mode and wizard mode.

[sprint-138 sprint document](../138-tutorial-mode/sprint-138.md)

The work was completed partly by Copilot, and then by hand, as documented in the sprint documents.

Left out of the implementation was allowing IncludeInLooping in wizard mode.  We now want to add it in the similar page location and functionality it has in strict tutorial mode.  

## Features we want in wizard mode: 

Mostly we just want `.lessonSectionList` to be available.
This can either be accomplished by turning off all other tutorial chrome under `#divTutorialPrompt` or by preferrably making a new div that just holds an instance of `.lessonSectionList`.  This should be available in `fullscreen` and non-fullscreen modes (`escaped`), since wizard mode allows those presentations.  It should be hidden/toggled/hidden/shown by a new set of command-line menu items:
- under `/vtw` as `p)ractice list`
- under `/vhw` as `p)ractice list`
- under `/vsw` as `p)ractice list`

All have trigger `p` and behave as the other siblings: toggle, hide, view.
These should be remembered in `Song.layout` so that they are presented separately in `fullscreen` and `escaped` like some of the others. 

We think the easiest to see and maintain is to retain the `Done` and `Bookmark` columns.  We have tested this in a song where we simply set presentation mode to strict tutorial, and upon saving and re-loading, the bookmarks and done columns came back as persisted in Browser storage.  

What we are really after is the choosing of Sections to loop.  If we get the Done and Bookmarks nearly for free, we would be happy.


## Features we don't want in wizard mode: 

We don't need the other elements of `#divTutorialPrompt` available except for `.lessonSectionList`.  So we don't need breadcrumbs or `#tutorialPromptWidgetRow` for example. 

We don't need the captions or other text found in an authored strict mode tutorial.  Authoring or including the html prompt fragments the way strict mode requires is also out of scope. 

We don't need a fancy display or buttons around the list.  A new container with simple paper background and box-shadow like `#divInfoRendered` inside `.infoTabsPaper` would be ideal.

## Enhancement to LOOP display.

Recall that IncludeInLooping is only for Section looping, and not beat looping.

When we are Section looping, with a Set that constrains which Sections will be played, i.e. IncludeInLooping is in effect and not just with all Sections included by checkboxes, we want the Looper Light to use a different `dashed` border everywhere.  e.g. this rule from section-status.css would be runtime-modified with:
```
.SectionStatus_loopLight {
    border: 3px dashed green;
}
```
The magenta and green color switching would be as they are today.  The rest of the style also stays the same.

In the Transport, the hint is already done in strict tutorial mode: the caption is "LOOPING 1..3" for example.  This should work in wizard mode.  Wizard mode does not hide the Transport, so we don't need the special minimal strict mode controls in `tutorialPromptWidgetRow`.

## sprint-152 Iteration 1 Request

Please evaluate our design and produce an implementation plan with questions in `152-implementation-plan.md` .  We will answer questions then approve coding.

# sprint-152 Iteration 2 

For this Iteration, the output is the implementation.  We answer questions required for implementation below.

Code changes listed in `152-implementation-plan.md` are APPROVED.

## Iteration 1 Section 7. Questions :: ANSWERED

**Q1. Done and Bookmark in wizard mode.**  
[sprint-152.md](sprint-152.md) says "Do not add Learner Done and Bookmark progress to wizard mode." [152-design.md](152-design.md) says to retain those columns because they come nearly free. These conflict.  
*Recommend:* follow the design (keep the columns) and edit the sprint Purpose line. The `progressColumns` option makes the alternative a one-line change.

- ANSWER: follow the design.  We edited the sprint document to remove that stale line.

**Q2. Caption column for wizard Songs.**  
Many wizard Songs have no `section.tutorial.caption`, so the Caption column would be blank.  
*Recommend:* in wizard mode, fall back to `section.caption` when the tutorial caption is blank, and use the same fallback for the list in either mode. Render wizard captions HTML-escaped. Strict authored captions keep their current raw rendering.

- ANSWER: Accept Recommendation.


**Q3. When is the border dashed?**  
Your wording is "when we are Section looping with a constraining Set", but the example rule changes the green (idle) base rule.  
- A: dashed only while Section looping (magenta dashed). Idle stays solid green.  
- B: dashed whenever a subset is set and we are not beat looping (idle green dashed as a preview, and magenta dashed while looping).  
*Recommend A* because it matches the first sentence. B is one extra CSS line.


- ANSWER: B is safer for Song Users, since it warns them before they start looping.  Accept B.  Implication is that magenta solid is in effect while beat looping, which is correct.


**Q4. Default and behavior of the flag.**  
(a) *Recommend* the Practice List defaults to hidden, so existing wizard Songs look the same until the User opts in. (b) In strict or none mode, `/vtwp` and friends still record the flag, with no visible effect. *Recommend* they show a short result message ("Practice list is available in wizard mode") and still store the flag.


- ANSWER: Accept (a).  To prevent doubling, in strict mode, should be ignored and thus hidden.  In none mode also remains hidden. 


**Q5. Fix the `Layout.screen` aliasing (F3)?**  
It is a one-line re-link in the constructor. Without it, per-screen toggles on a loaded Song can be lost, including the new flag. *Recommend yes*, with a test.


- ANSWER: Yes.


**Q6. Placement.**  
Above `#topControlsCaptions` (Song Caption row), below the quick menu, outside `.container`, with `max-height: 40vh` scrolling. In fullscreen it pushes the tables down when shown, and it is toggleable. OK? Should clicking a Section link auto-hide it? *Recommend no.*


- ANSWER: OK.   Accept Recommendation to *not* auto-hide.


**Q7. Rename `filterStrictLoopSectionIndex` and its option, no alias.**  
This matches the repo's no-legacy rule. OK?


- ANSWER: OK.


**Q8. IncludeInLooping stays transient in wizard mode** (not persisted in the Song or browser storage, reset on Song load), the same as strict. Confirm.
 as they are today.  The rest of the style also stays the same.

- ANSWER: Confirm: not persisted, reset on load. Rest of style also stays the same.


Also: items in Notes section after questions are acknowledged.

## Iteration 2 Request

Please proceed to coding.



