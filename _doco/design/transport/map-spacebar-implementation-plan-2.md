# Map Spacebar Implementation Plan

## Document Version

- This is document version 3.  It has been edited by the Design team, providing answers to questions, and culling options. The version 1 file can be found here: `_doco/design/map-spacebar-implementation-plan.md`

## Summary

This plan assumes the Iteration 3 design choices are the current target.

The implementation should treat spacebar mapping as a thin configuration layer over transport actions that already exist in `key-handlers.js`, plus a small number of new single-verb actions added there.

The guiding rule for the sprint should be:

- store and dispatch real action names, not a second enum or a parallel action-id system
- keep existing navigation actions semantically unchanged
- add only the missing transport verbs needed by the updated [TransportNavigationTable](TransportNavigationTable.md)
- use one new reset event, `Looper:OnResetSong`, for plugin state clearing

If implemented that way, the plan stays aligned with the current command-menu architecture and should be directly actionable after plan approval.

## Goals For This Sprint

1. Add a configurable spacebar mapping that only runs when focus is not in an input or textarea.
2. Reuse existing transport actions whenever they already exist.
3. Add missing single-verb transport actions needed by the updated navigation table.
4. Add `Looper:OnResetSong` with optional `{ hard: true|false }` payload.
5. Update the relevant plugins to respond to reset without teaching transport code about plugin internals.
6. Keep the implementation small enough that it can be completed from this plan without another design pass.

## Current Baseline

The current code already provides these useful pieces:

- `document_keypress(e)` in `key-handlers.js` already ignores controls and is the right place to intercept spacebar.
- `performCmdAction(menuItem, args)` is already the canonical command-menu action switch.
- Existing single-verb transport actions already exist in `performCmdAction()` for:
	- `toggleLoopSections`
	- `toggleLoopBeats`
	- `firstSection`
	- `prevSection`
	- `nextSection`
	- `lastSection`
	- `nextBeat`
	- `prevBeat`
- `Song.gotoFirstBeat()` already exists.
- `Song.gotoSection(idx)` and `Song.gotoBeat(oneBasedIndex)` already exist.
- `Looper:OnResetSong` does not exist yet.
- `gotoLastBeat()` and `gotoLastBeatInSong()` do not appear to exist yet.
- beat looping currently does not emit `DaCapo:OnSectionBegin` when it wraps, so it does not yet satisfy the Iteration 3 `LoopSection via LoopBeats` design choice.

## Action Inventory

This sprint should treat actions in three buckets.

### Bucket 1: Existing actions that can be mapped directly

These should be reused exactly as they work today:

- `toggleLoopSections`
- `toggleLoopBeats`
- `firstSection`
- `prevSection`
- `nextSection`
- `lastSection`
- `nextBeat`
- `prevBeat`

These actions already exist as command-menu actions and should remain the authoritative verbs.

### Bucket 2: New single-verb transport actions to add

These should be added as real `performCmdAction()` cases so the spacebar map can point at them directly:

- `gotoFirstBeat`
- `gotoLastBeat`
- `gotoLastBeatInSong`
- `resetSong`
- `resetSongHard`
- `unsetSpacebarAction`
- `setSpacebarAction`


### Bucket 3: Items that should not become separate actions for this sprint

These should stay out of scope as standalone transport behaviors:

- `NextSongLoop`
- `OnSongRestart`
- any new DaCapo event for restart

Iteration 3 explicitly replaces `NextSongLoop` with `gotoLastBeatInSong`, and it treats `firstSection` as sufficient for restart-song behavior in this sprint.

## Proposed Spacebar Mapping Model

The mapping model should be deliberately simple.

### Runtime state

Add one module-level variable in `key-handlers.js`:

- spacebarActionName

spacebarActionName takes a value which is one of:

- empty string or `null` for unset
- an existing `performCmdAction()` action name such as `nextBeat`
- a newly added action name such as `resetSong`

The important point is that the stored value is the action name itself.

### Dispatch rule

When `document_keypress(e)` receives a space character and focus is not in a control:

1. if no spacebar action is configured, do nothing
2. otherwise dispatch the mapped action through one shared helper

That helper should execute the same verb used by the command menu.

### Why this fits Iteration 3

This satisfies the design goal of avoiding another action-id layer.

The spacebar map becomes a small piece of configuration that points to existing action names, instead of creating a second semantics table.

## `key-handlers.js` Plan

This file is the center of the implementation.

## 1. Add a shared action executor

Add a small internal helper in `key-handlers.js` that can execute a transport action by action name without requiring a real menu node from `menu.js`.

The approved clean version is:

- extract the action switch body into a helper that receives `{ action, name, trigger, input, popOnBang }`
- have `performCmdAction()` continue to call that helper
- have the spacebar dispatcher call the same helper with a synthetic menuItem object

This avoids duplicating the action switch in two places.

## 2. Add spacebar handling to `document_keypress(e)`

Add one new `case " "` branch.

Behavior:

- if no mapped action is set, return without side effects
- otherwise prevent default and dispatch the mapped action

This branch should live inside the existing non-control guard so the current focus behavior remains intact.

## 3. Add configuration actions

### Approved shape

Add one explicit command case per menu leaf:

- `mapSpacebar_toggleLoopSections`
- `mapSpacebar_toggleLoopBeats`
- `mapSpacebar_firstSection`
- `mapSpacebar_prevSection`
- `mapSpacebar_nextSection`
- `mapSpacebar_lastSection`
- `mapSpacebar_nextBeat`
- `mapSpacebar_prevBeat`
- `mapSpacebar_gotoFirstBeat`
- `mapSpacebar_gotoLastBeat`
- `mapSpacebar_gotoLastBeatInSong`
- `mapSpacebar_restartSong`
- `mapSpacebar_resetSong`
- `mapSpacebar_resetSongHard`
- `mapSpacebar_unsetSpacebarAction`

## 4. Add new transport action cases

Add these `performCmdAction()` cases.

### `gotoFirstBeat`

Implementation intent:

- `getSong().gotoFirstBeat()`
- refresh the section UI consistently
- return the current beat in `actionResult.result`

The refresh should use existing UI flow rather than inventing a new path.

### `gotoLastBeat`

Implementation intent:

- move the current section to its last beat
- refresh the section UI consistently
- return the current beat

Approved: Add a new Song or Section helper to keep this out of key-handler.js: `getSong().gotoBeat(getSong().getBeats())`.

### `gotoLastBeatInSong`

Implementation intent:

- go to last section
- go to last beat of that section
- refresh once consistently
- do not fire `DaCapo:OnSongEnd`

This action is intended to park transport so the next loop turnover happens naturally.

### `resetSong`

Implementation intent:

- move to first section
- move to first beat
- trigger `Looper:OnResetSong` with `{ hard: false }`
- refresh UI through the normal section path

### `resetSongHard`

Implementation intent:

- same as `resetSong`
- trigger `Looper:OnResetSong` with `{ hard: true }`

### `unsetSpacebarAction`

Implementation intent:

- clear the mapped action variable
- report an informative result string

## 5. Keep action semantics consistent

Existing actions should not gain new event behavior just because they are now reachable from spacebar.

For example:

- `nextSection` should keep behaving like current `nextSection`
- `firstSection` should keep behaving like current `firstSection`

The only new eventful actions for this sprint should be the reset actions.

## `menu.js` Plan

`menu.js` should be updated in two areas.

## 1. Add the map-spacebar menu

Add a new submenu under `/f` at `/fm`.

Recommended contents for the first pass:

- convenience mappings to existing verbs
- reset mappings
- unset

### Menu Structure:

Using markdown outlines as menu hierarchy, the menu structure is shown here.

The format is '-' represents a menu item, more indentation means indented lists in markdown, and child menu items in the menu.
Triggers are represented by the trigger letter, case-sensitive, before a close parenthesis, followed by the menu caption

e.g. `- trigger) menu caption`


First menu item is mounted here as "/", "file", "map spacebar": /fm

- f) file
  - m) map spacerbar
    - R) Restart song (w/o DaCapo:OnSongEnd)
    - r) restart Section (begin Section / firstBeat)
    - z) z reset song
    - Z) Z reset song hard
    - u) unset spacebar
	- s) section
      - f) first
      - p) prev
      - n) next
      - l) last
	  - L) Last beat in Song
	- b) beats
      - f) first
      - p) prev
      - n) next
      - l) last


These menus under "/" should be updated

- r) run
  - s) section
    - f) first
    - p) prev
    - n) next
    - l) last
	- L) Last beat in Song
	- r) reset song
	- R) Reset song hard
    - g) goto
      - input) n+1 
  - b) beats
    - f) first
    - p) prev
    - n) next
    - l) last
    - g) goto
      - input) n+1  

- s) section
  - n) nav
    - f) first
    - p) prev
    - n) next
    - l) last
    - g) goto
      - input) n+1 
  - b) beats
    - f) first
    - p) prev
    - n) next
    - l) last
    - g) goto
      - input) n 
    - a) add
    - d) delete
    - '0') insert first
    - i) insert beat  

Therefore, the full menus (without triggers) should be:

/fm
- Restart song (w/o DaCapo:OnSongEnd)
- restart Section (begin Section / firstBeat)
- z reset song
- Z reset song hard
- unset spacebar

/fms
- first
- prev
- next
- last
- Last beat in Song

/fmb	
- first
- prev
- next
- last


/r
- toggle transport
- park transport
- loop
- loop beats
- random loop
- section[n+1/N+1]
- beats[n+1/N+1]

/rs
- first
- prev
- next
- last
- Last beat in song
- reset song
- reset song hard
- goto

/rsg
- input: n+1

/rb
- first
- prev
- next
- last
- goto

/rbg
- input: n+1

/sn
- first
- prev
- next
- last
- goto

/sng
- input: n+1

/sb
- first
- prev
- next
- last
- goto
- add (last)
- delete
- insert first
- insert beat

/sbg
- input: n+1

## 2. Add the missing navigation commands described in Iteration 2/3

The Transport table has two versions now: 
- Existing version: `_doco/design/TransportNavigationTable-existing.md`
- Planned version: `TransportNavigationTable.md`
After implementation, the Planned version should be true.

Add or extend command-menu coverage for the updated, Planned version Transport table:

- section beats submenu commands for first and last beat if they do not already exist
- any `gotoSection n+1` and `gotoBeat n+1` entries from Iteration 2, which are in scope.
- here the `n+1` syntax means remember that the User-facing Section numbers are 1-base, while Song.sections[0] is zero-based.

This is useful independently of the spacebar feature because the transport table now treats these as real navigation verbs.

## `Song.js` and `Section.js` Plan

These files likely need small additions so the transport verbs remain clean.

## `Song.js`

Add helpers as needed for the missing verbs.

Recommended additions:

- `gotoLastBeat()`
- `gotoLastBeatInSong()`

Implementation intent:

- `gotoLastBeat()` should move the current section to its last beat
- `gotoLastBeatInSong()` should move to the last section and then to its last beat

Even though `gotoLastBeatInSong()` could be composed inside `key-handlers.js`, adding it to `Song.js` gives the app one canonical transport-level meaning for that navigation.

## `Section.js`

Approved:

- add `gotoLastBeat()` to mirror `gotoFirstBeat()`

## `looper.js` Plan

Iteration 3 intentionally uses beat looping as the candidate implementation of `LoopSection`, but that is only valid if the event semantics are upgraded.

## Required change

Update beat-loop behavior so it emits the section-begin semantics that plugins expect.

The exact behavior to implement should be:

1. when beat looping starts, emit `DaCapo:OnSectionBegin` for the current section
2. when beat looping wraps from last beat back to beat 1, emit:
	 - `DaCapo:OnSectionEnd`
	 - then `DaCapo:OnSectionBegin`

The current code already emits `OnSectionEnd` on boundary in `tickBeat(...)`, but the beat-loop branch currently only resets beat position and redraws.

That beat-loop branch needs to emit `OnSectionBegin` after wrapping.

## Why this matters

Without this change, `LoopBeats` is still just beat repetition, not a full section-loop semantic substitute for plugin-aware workflows.

## Plugin Plan

Plugins should remain ignorant of transport implementation details and only observe the reset event.

## `TransposePlugin`

Add `Looper:OnResetSong` handling.

Expected semantics:

- soft reset returns to the current reset baseline
- hard reset returns to the original baseline

This matches the Iteration 3 decision and the current Transpose reset model.

## `ArpeggioPlugin`

Add `Looper:OnResetSong` handling.

Expected semantics:

- perform the plugin’s clear action

## `FillPlugin`

Add `Looper:OnResetSong` handling.

Expected semantics:

- perform the plugin’s clear action

## `infinite-neck.js` Plan

This file may not need major changes.

Most of the required helpers are already wired into `setKeyHandlerProviders()`.

Possible updates only if needed:

- expose an additional helper through provider wiring if the chosen `key-handlers.js` implementation needs a UI refresh function not already wrapped
- It is not needed to add a small startup default for the spacebar mapping, because default state is “unset”.

At the moment, I do not expect major provider work to be necessary.

## Recommended Implementation Order

The safest coding order is:

1. add the missing transport helpers in `Song.js` and optionally `Section.js`
2. add the new action cases in `key-handlers.js`
3. add the spacebar mapping state and dispatcher in `key-handlers.js`
4. add the `/fm` map-spacebar submenu in `menu.js`
5. add `Looper:OnResetSong` emission in the reset actions
6. update `TransposePlugin`, `ArpeggioPlugin`, and `FillPlugin` to consume the reset event
7. update beat-loop behavior in `looper.js` so `LoopBeats` can stand in for `LoopSection`
8. run menu validation and focused tests

This order minimizes the chance of building menu wiring before the verbs actually exist.

## Test Plan

The implementation should ship with focused regression coverage.

## Unit and integration targets

- `key-handlers` tests for new actions:
	- `gotoFirstBeat`
	- `gotoLastBeat`
	- `gotoLastBeatInSong`
	- `resetSong`
	- `resetSongHard`
	- spacebar dispatch when mapped
	- no-op when unmapped
- `looper` tests for beat-loop event sequencing:
	- start loop beats emits begin event if that is the chosen design
	- wrap on last beat emits `OnSectionEnd` then `OnSectionBegin`
- plugin tests:
	- Transpose soft reset
	- Transpose hard reset
	- Arpeggio reset clear
	- Fill reset clear
- command menu validation:
	- `npm run validate:cmdmenu`

## Manual verification checklist

1. Map spacebar to `nextBeat` and verify parity with `n`.
2. Map spacebar to `firstSection` and verify parity with `<`.
3. Map spacebar to `gotoFirstBeat` and verify current section stays the same while beat resets.
4. Map spacebar to `gotoLastBeatInSong` and verify the app parks at last section / last beat.
5. Map spacebar to `resetSong` and verify plugin reset behavior without `DaCapo:OnSongEnd`.
6. Map spacebar to `resetSongHard` and verify Transpose returns to original baseline.
7. Map spacebar to unset and verify spacebar does nothing.
8. Verify all of the above while focus is in a text control, where spacebar should remain ordinary text input.

## Remaining Holes And Clarifications Needed

These are the remaining points that still deserve an answer before coding starts.

## 1. Exact loop policy for reset actions

The plan uses these answers on whether `resetSong` and `resetSongHard` should:

- preserve active loop mode: YES
- clear looping before reset: NO
- or preserve loop mode but restart from the beginning: YES

Iteration 3 is explicit that navigation is allowed during looping, but it does not fully settle reset behavior.

Approved behavior:

- `gotoLastBeatInSong` should preserve loop mode
- `resetSong` and `resetSongHard` do immediate restart-from-beginning behavior

## 2. Exact beat-loop begin-event semantics

The design choice says beat looping should become the practical implementation of section looping if it also fires begin/end events correctly.

The only remaining clarification is whether `toggleLoopBeats()` should emit `DaCapo:OnSectionBegin` immediately on start, or only after the first wrap.

Approved: to emit it immediately on start and again on each wrap.

## 3. Final menu contents under `/fm`

Iteration 3 clearly wants the map-spacebar menu, but it does not list the final complete leaf set.

The remaining question is whether `/fm` should contain:

- only reset-oriented mappings and a few core convenience choices
- or the fuller transport set from the updated transport table

My recommendation is the fuller transport set, because that matches the stated use-cases better.

ANSWER: the menus presented above use the fuller transport set, including child menus for section and beats.

## 4. Whether `gotoSection n+1` and `gotoBeat n+1` are in or out for this sprint

- here the `n+1` syntax means remember that the User-facing Section numbers are 1-base, while Song.sections[0] is zero-based.

These are in scope for this implementation.

## 5. Terminology cleanup in docs

The Transport table has two versions now: 
- Existing version: `_doco/design/TransportNavigationTable-existing.md`
- Planned version: `TransportNavigationTable.md`
The Planned version has the cleaned up terminology, including `LastBeatInSong`.

## Bottom Line

The implementation is now straightforward enough to code from a single approved plan.

The most important choices to preserve are:

- use real action names as the mapping values
- add missing transport verbs as real `performCmdAction()` cases
- reserve new event behavior for `Looper:OnResetSong` and for the beat-loop event fix
- keep `firstSection` as the practical restart-song behavior for this sprint

Once the remaining clarifications above are answered, this plan should be sufficient to implement the feature end-to-end.  **ANSWERS: These should all be anwered by this document version.**
