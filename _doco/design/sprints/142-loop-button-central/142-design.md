# Iteration 1: define the problem

We have several locations that have LOOP buttons.  They all get their captions set a little differently.  We want a unified, centralized approach. 

At `#divQuick` in index.html is one location with `#quickLoopToggle` for Section looping, and `#quickBeatLoopToggle` for Beat looping, with `#btnRandomLoop` for random loop flag setting which correctly latches `.BtnPunchedOut` and `.BtnPunchedIn` today via `infinite-neck.js:toggleRandomLoop()`.  However, the quickLoopToggle quickBeatLoopToggle don't get the caption updates.
These buttons are handled by infinite-neck.js bindEvent() sites near `infinite-neck.js:3808-3813`

There are various loop initiation sites in key-handlers.js for `toggleLoopSections` `toggleLoopBeats` `toggleRandomLoop`.

There is code in looper.js and transport-controller.js to manipulate the states.

At `#transport` is `#btnLoopSections` for Section Looping and status  `#btnLoopBeats` for Beat looping and status.  These were the originals, and behave correctly, except don't show the status of when looping is only over some Sections via the tutorial checkboxes `tutorialToggleIncludeInLooping`


At `tutorial.builder.js` it has  renderTutorialPrompt() that spits out `#tutorialPromptWidgetRow` and `.tutorialLoopBeats` and a `.tutorialLOOP` button, that get special updates when doing looping with included Sections, but that are not updating the caption today when only some Sections are included in looping. 
The LOOP button correctly shows red and "LOOPING..." status, but then the status reverts and is not displayed correctly on Section change.

At infinite-neck.js:3360-3377 is one update.

## Request

Without coding changes, please prepare a plan in `142-plan.md` to centralize and clean up handling in a way that is elegant, easy to read for maintainance, and keeps as much of the current architecture in place as possible.