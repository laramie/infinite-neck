# Feature: ArpeggioPlugin position Option

## Document Version

This is version 3.
- version 1 in a different file described a separate style `position` which used `positions` Array-of-Array to implement a new style.
- version 2 abandons that separate style.  It replaces it with the concept of `positions` being available to all ArpeggioPlugin `style` algorithm options, through resetting the minFret and maxFret properties for each Section at loop boundaries.
- version 3 changes the strategy from mutating plugin-level minFret and maxFret to a strategy of using those values as User-authored defaults, to be used as they are today, unless a Section has `positions`, in which case they are ignored and un-altered.

## Description

We would like to add a menu item to ArpeggioPlugin menu, called `positions`.  The trigger would be `p`.  It would open up a child menu, similar to how FillPlugin opens up a child menu for option `o) options`. 

The terminology is: "position" is a pair of `[minFret,maxFret]` values, while "positions" is an Array of Array of these, as `[[minFret,maxFret],[minFret,maxFret]]`.  This could be thought of as `[FirstPosition,SecondPostion]` which aligns with the musical terminology for certain ascending value sets.

One child of `p) positions` would be `value`, default `[[0,3],[4,7],[8,12]]`, prompt "arrays of positions".  This is the main data storage that drives this feature.  It is an Array of Arrays of integer.  The inner Array is a pair of integers, called a `position` where the first integer is for minFret, the second for maxFret.  The outer Array is a list of positions, to be iterated through in order, presented first one first, then the following one on every loop of a Section.

Sections may loop for these reasons:
- The User has chosen 'loop beats' and the looper has exhausted the beats and is now looping the Section through its beats a subsequent time.
- The Song has only one Section, and the Song is looping Sections, so the one Section just keeps looping.
- The Song has played over the Section, and loops around after playing through the Song to the Section again, and so plays the Section a subsequent time.
- The User has `restart`ed or `reset` the Section or the Song, with one of several of the navigation shortcuts or commands and the Section is played again from its first beat such that DaCapo:OnSectionBegin is fired.

The common point is that `DaCapo:OnSectionBegin` is fired.  At this point, ArpeggioPlugin already deals with the event by restarting its candidate notes calculations and performs clearing of previous notes.  At this moment, it should be consulting minFret and maxFret.

So at this moment, we want to inject consulting the `positions` Array of Array, and setting a position `[minFret,maxFret]` to pass in to the style algorithms.  If a positions value is not available in the Section, default to the plugin-level minFret and maxFret, passed in the same way.  In this way, all the existing `style` algorithms should participate as they do now, thinking the user has gone in and set minFret and maxFret just before the event.

## Storage

Storage is in the Section object, because Users are allowed to move, delete, clone, shallow-clone Sections in the Song, and Bury/Revive Sections in the Graveyard. These positions values are per-section, so should follow the Section objects, not the plugin, or the per-Song Song.plugins persistence.

minFret and maxFret are stored in Song.plugins, and will not be overwritten just because there are `positions::value` properties in any Section.  Since these are not reset by values in `positions`, there is no separate need to mutate these or persist them any differently than they are now.  On `Looper.OnResetSong` (both hard and not hard), the plugin should reset all Sections `lastPositionIndex` integer pointers to 0.  

## Menu

To support this `positions` passing in minFret and maxFret, we must allow the User to choose positions for each Section.  Musically, some Sections will only be played in higher up the fretboard and some will only be played lower, while some will use the full fretboard, that is, all the frets defined in the Tuning. Also, some may have three positions to play, some will only have one.  If they have zero, we simply use the values found in minFret and maxFret which already have defaults.  So we want per-Section values, which means we must have editing controls to set, copy, edit, and clear positions per Section.

There are some edge cases where we might want to consult previous Sections for positions values for Sections that don't have positions stored, i.e. sparse positions values.  However, in this sprint we will consider these cases to instead use the minFret and maxFret defined in the plugin-level properties.

The following menu defines options and actions for defining the positions::values property and promulgating it around the Song, i.e. set, copy, edit, and clear.

Because we are in a menu, we accept that we don't want to be continually kicking the menu to refresh or listen to the looper. We introduce an action verb, "Refresh values", that allows the user to force the menu to re-read the storage in the Section.  On dropping into the `positions` child menu, these values should be read from the current Section as well.  So the User only needs to "Refresh values" when the menu is kept open during looping or navigation.  Having the "Refresh values" menu item reminds the User of this limitation.

- p) plugins
  - a) arpeggio
    - p) positions
      - L) cLear all sections
      - T) clear This section
      - C) Copy to all sections
      - U) copy to Unset sections
      - R) Refresh values
      - v) values this section [[[3,5],[5,9]]]  

Comments: 
- Setting values to the empty string or whitespace would effectively "clear this section", or `T)` can be used.
- `L)` cLear all sections would set value to empty for all Sections
- `C)` would copy the current Sections's values to all other Sections, overwriting values or creating values storage.
- `U)` would copy the current Section's values to all other Sections that have empty values. 

## Properties and storage

This will be the first plugin that will keep track of its state in the Section object.  All plugins keep some properties in `Song.plugins`.   Previous plugins have kept state in the standard `Song.sections[n].SectionNotes` as Note object with  "owner:" properties.  This will be different because it will involve a new property tree of Section, which should be added to the Song/Section schema as well, which is documented in our root `README.md`.

- Song
  - Section
    - "pluginData"
      - "arpeggio"
        - `{
            lastPositionIndex: 0, 
            positions: [[0,3],[4,8],[8,12]]
           }`


On event `DaCapo:OnSectionBegin`, lastPositionIndex is calculated and written, and used as the index into the positions array to grab the pair of `[minFret,maxFret]`.  After this is calculated, `lastPositionIndex` may be immediately written, so that if the User advances the loop somehow, the next time `DaCapo:OnSectionBegin` fires, we get a new `lastPositionIndex`. 

In the above outline example of properties, `lastPositionIndex` would be 0 for the zeroth array member [0,3] and 1 for the first array member [4,8].           

It is valid to have overlapping positions.  These are all legal: 
- ` [[0,3],[4,8],[8,12]]`
- ` [[0,3],[4,8],[6,9]]`
- ` [[0,3],[4,8],[5,7]]`

It is valid to have the start index of the inner Arrays not be in order.  This is legal:
- ` [[4,8],[0,3],[5,7]]`

The outer array is just processed in order, and kept track of in lastPositionIndex, then wrapped to the beginning, forever.  This is true for each Section, so the positions Arrays in different Sections are not in lock-step and are unrelated.


## There should be input shortcuts so Users do not have to enter valid JSON for `positions::values`

All the following User entries do not have quotes or backticks in the User entry, only shown for Markdown purposes here.

When a User enters array pairs separated by semicolons as an input string (without the quotes), it is to be normalized to the Array-of-Arrays storage.

- User: `0,3;2,5;6,9` 
- `position` storage: `[[0,3],[2,5],[6,9]]`

When a User enters a missing end Array element, assume an end Array element equal to the last element entered plus 4:

- User: `0,3;2,5;6`
- `position` storage:`[[0,3],[2,5],[6,10]]` 

When a User enters a value as `0,3,5,9` without semicolons, it should be interpreted as the boundaries of the positions, with no gaps or overlaps between positions. (In this case, there is no need to calculate a final position width, because the entries are all boundaries.): 

- User: `0,3,5,9`
- `position` storage: `[[0,3],[3,5],[5,9]]`

Whitespace in the arrays should simply be squeezed out.

For any errors below, the handling should be:
- prepare a short, meaningful message for actionResult.result, knowing that it must fit within one line (60 characters).
- emit a showMessages message with more detail, such as the full JSON error when trying to parse, or a more pertinent message if one of the below conditions is known to be the problem.  Include the attempted string in the message.
- reject the new value
- preserve the existing value
This set of handling is called REJECT.

Otherwise invalid JSON: REJECT.

Negative integers: REJECT.

Values outside the fret range for the Tuning: REJECT.

Reversed minFret and maxFret values: REJECT, e.g. [5,3] for a position pair is rejected.

# Resets

When Looper:OnResetSong is handled by ArpeggioPlugin, if `position` has written Song.Section.pluginData["arpeggio"] it should clear: 

- for either hard or not hard reset, then the ArpeggioPlugin should reset such that `lastPositionIndex` is 0 again for all Sections that have positions.

- without resets, the storage remains part of each Section, and will be persisted with the song, including values of lastPositionIndex.  It is up to the User to perform a reset before saving the song.  We'd prefer to have a freshly loaded song to have all lastPositionIndex values be 0, but we don't have an OnSongSave hook for plugins, nor do we think we have a clean way to clean these data on song load.  If a clean way to do that is available, Copilot please let the Design team know.

- Other options may later add different properties under `pluginData["arpeggio"]`, and should not be stepped on.

## Implementing position

When the Section loops ArpeggioPlugin should advance the lastPositionIndex, to the zeroth array element on the first time, and to the next element thereafter.  That "position" is interpreted as minFret and maxFret.

Any time DaCapo:OnSectionBegin is received, the lastPostionIndex is advanced, minFret and maxFret are set from the postion found at that index, and the plugin proceeds normally.

If the User performs any transport action or explicitly resets/restarts the song or section, the lastPositionIndex should be incremented.  So if the User starts looping, then the lastPositionIndex could be 0, and when he hits /rs0 (/run/section/"0 restart song") then the looper should emit `DaCapo:OnSectionBegin` so the ArpeggioPlugin should already recalculate candidates, and it should do that with lastPostionIndex incremented to 1.

## Copilot response (before we reworked the navigation with TransportController)

I’m reviewing version 3 against the actual event and plugin lifecycle now, especially the transport assumptions and whether there is already a clean hook to zero section state on song load/save.

I found the plugin load path. I’m reading the load/apply sequence and the transport event emitters now so I can answer two specific open points in version 3: whether a load-time cleanup hook already exists, and whether restart/reset actions really do emit `DaCapo:OnSectionBegin` the way the design assumes.

I found a real mismatch in the restart/reset assumptions: loop restarts emit `DaCapo:OnSectionBegin`, but plain transport actions only call `clearAndReplaySection`, so I’m tracing that UI replay path to see whether it emits the same event or not.


I found a clean load-time hook: plugin state is loaded during song open, and plugins already get `loadSongState(...)` with the song context. I’m pulling that method so I can confirm whether zeroing `lastPositionIndex` on load is feasible without inventing a new global hook.

The main remaining question is whether plain replay/navigation emits the event your design relies on. I’m reading the actual `clearAndReplaySection()` body now, because that determines whether version 3 can use only `DaCapo:OnSectionBegin` or needs an additional transport/replay hook.


**Findings**
1. The design still assumes some transport restarts will increment via `DaCapo:OnSectionBegin`, but plain replay/navigation does not currently do that.
   Version 3 says restart/reset actions should increment because they cause `DaCapo:OnSectionBegin` in ArpeggioPlugin-position-3.md. That is only true for loop start/wrap paths in looper.js, looper.js, looper.js, and looper.js.
   Plain transport actions like `firstSection` and `resetSong` go through `clearAndReplaySection()` from key-handlers.js and key-handlers.js, and `clearAndReplaySection()` in infinite-neck.js does not emit `DaCapo:OnSectionBegin`.
   So the current design has a behavioral mismatch: if you want `/rs0`, reset song, and similar replay-style transport actions to advance positions, that will require either:
   - changing transport/replay code to emit `DaCapo:OnSectionBegin`, or
   - introducing a second hook for “section replay/restart” that Arpeggio listens to.

2. The `lastPositionIndex` update rule is still off-by-one ambiguous.
   The document says on `DaCapo:OnSectionBegin`, `lastPositionIndex` is calculated, written, and used in ArpeggioPlugin-position-3.md, then later says any time `DaCapo:OnSectionBegin` is received, the index is advanced and that new position is used in ArpeggioPlugin-position-3.md.
   Those are not the same rule. You need one exact contract such as:
   - if no prior value, apply index `0`
   - persist `lastPositionIndex = 0`
   - next `OnSectionBegin` applies `(lastPositionIndex + 1) % positions.length`
   Without that precision, implementation and tests will drift.

3. The menu and storage model is viable, but “Refresh values” implies custom runtime state handling beyond normal plugin properties.
   The submenu design in ArpeggioPlugin-position-3.md is workable, and Fill already shows the custom submenu pattern in FillPlugin.js. But this will not fit the current flat property-driven Arpeggio menu in ArpeggioPlugin.js without custom menu-building code.
   That is not a blocker, but it means version 3 is no longer “just add a property.” It needs:
   - a custom submenu node
   - custom action handlers for `clear this`, `clear all`, `copy to all`, `copy to unset`, `refresh`
   - custom value-resolution from section-local storage, not only plugin properties

4. The save/load story is better than the document currently assumes.
   The document says there may not be a clean way to zero `lastPositionIndex` on song load in ArpeggioPlugin-position-3.md. There is no plugin save hook, but there is a clean load hook already:
   - song open calls `pluginManager.loadSongPluginState(gSong)` in infinite-neck.js
   - that calls `entry.plugin.loadSongState(...)` in PluginManager.js and PluginManager.js
   So if the design wants freshly loaded songs to start with all `lastPositionIndex = 0`, that is implementable cleanly during plugin load. You do not need to require users to reset before saving just to get deterministic load behavior.

**Viability**
The core version 3 strategy is viable.

The important improvement over version 2 is correct:
- plugin-level `minFret` and `maxFret` remain user-authored defaults in ArpeggioPlugin-position-3.md
- section-local `positions` overrides them only for that section in ArpeggioPlugin-position-3.md

That means the style algorithms can remain conceptually unchanged. Today they already operate on a candidate list that is collected before style-specific expansion:
- candidate collection in ArpeggioPlugin.js
- style dispatch in ArpeggioPlugin.js
- existing style algorithms in ArpeggioPlugin.js, ArpeggioPlugin.js, ArpeggioPlugin.js, and ArpeggioPlugin.js

So yes: this can be implemented without changing the internal logic of the several style algorithms, if you only change how the effective fret window is chosen before candidate collection.

**Likely Implementation Snags**
- `collectCandidatesForSection()` currently reads `minFret` and `maxFret` directly from plugin properties in ArpeggioPlugin.js. To keep style code untouched, this function needs an override range parameter or a wrapper that resolves the effective range per section/event.
- `handleEvent()` currently treats `Looper:OnResetSong` as “clear generated notes in song” only in ArpeggioPlugin.js. Version 3 needs additional section-state reset logic there.
- The REJECT semantics in ArpeggioPlugin-position-3.md are much better, but they imply command-line/UI result plumbing beyond the current simple property set path. That is fine, but it points again to custom actions rather than a plain `pluginProperty:set`.

**What Version 3 Fixes Well**
- It removes the bad idea of mutating plugin defaults during loop playback.
- It gives deterministic fallback for sparse sections: use plugin-level defaults in ArpeggioPlugin-position-3.md.
- It makes invalid input preserve the old value instead of clearing it, in ArpeggioPlugin-position-3.md. That is the right UX choice.

**Recommended Design Tightening**
1. Replace the current `lastPositionIndex` wording with one exact state machine.
   Example:
   - if section has no positions, use plugin defaults and do not touch `lastPositionIndex`
   - if section has positions and no prior index, apply index `0`
   - after applying index `i`, persist `lastPositionIndex = i`
   - next qualifying section-begin applies `(i + 1) % positions.length`

2. Decide whether non-loop transport replay must count as a qualifying section-begin.
   If yes, the design needs to explicitly require transport/replay code to emit `DaCapo:OnSectionBegin` or some equivalent event.

3. Update the save/load note.
   You do have a clean load-time place to zero `lastPositionIndex`: `loadSongState()` during `loadSongPluginState()`.

**Bottom Line**
Version 3 is substantially better and is now architecturally sound for the main goal.

The main remaining flaw is not in the fret-range strategy. That part is good. The main remaining flaw is event semantics: the design assumes more actions currently produce `DaCapo:OnSectionBegin` than actually do. If the design team resolves that explicitly, this is ready to turn into an implementation plan.

Natural next steps:
1. Tighten the event contract for restart/reset/replay actions.
2. Lock down the exact `lastPositionIndex` transition rule.
3. Then produce the implementation plan around:
   - section storage helpers
   - custom positions submenu/actions
   - effective-range resolution before candidate collection
   - reset and load-time zeroing behavior


## Design Status Update (by Design Team)

We have completed a sprint that reworked navigation and transport and centralized looping logic and DaCapo events around navigation, in the key-handlers.js verbs and in the central TransportController.

The design, along with the above Copilot response, should be reviewed with the new codebase.  Especially since we have fixed and tightened what it means to emit certain events when looping and not looping.

We like the recommendation for "Replace the current `lastPositionIndex` wording with one exact state machine".
  - Approved:
   - if section has no positions, use plugin defaults and do not touch `lastPositionIndex`
   - if section has positions and no prior index, apply index `0`
   - after applying index `i`, persist `lastPositionIndex = i`
   - next qualifying section-begin applies `(i + 1) % positions.length`

We also approve the idea of fixing up the lastPostionIndex values in each Section at load time.   

## Request (by Design Team)

Copilot, please review this entire document, and append a new section at the end with your report and questions we still need to answer.  We will then request an implementation plan to be put in a separate document.

## Copilot Review After TransportController Sprint

This review supersedes the earlier concern that the feature was blocked on pre-sprint transport behavior.

### Summary

The positions feature is now viable on the current codebase.

The transport/event blocker from the earlier review has been materially resolved:

- explicit transport restarts now emit `DaCapo:OnSectionBegin` when looping and do not emit it when not looping
- explicit first-section navigation now emits:
   - section looping: `DaCapo:OnSongBegin` and `DaCapo:OnSectionBegin`
   - beat looping only: `DaCapo:OnSectionBegin`
   - not looping: neither
- beat-loop startup no longer emits `DaCapo:OnSongBegin`; it emits only `DaCapo:OnSectionBegin`

That means the document's intended trigger, "qualifying section-begin while looping or explicit looping restart semantics," is now real enough to support implementation.

### What Still Looks Strong In Version 3

These design choices still look correct and should be preserved in the implementation plan:

- `positions` is section-local state, not plugin-global state
- plugin-level `minFret` and `maxFret` remain user-authored defaults
- section-local positions overrides those defaults only for the active section and only when positions exist
- the style algorithms should remain unchanged conceptually; the effective fret window should be resolved before candidate collection
- resetting `lastPositionIndex` on `Looper:OnResetSong` is the right runtime behavior
- zeroing `lastPositionIndex` in `loadSongState()` is a clean way to make freshly loaded songs deterministic
- the approved exact state machine for `lastPositionIndex` is the right fix for the old ambiguity

### Current-Code Findings

#### 1. The event contract is now implementable

The earlier report's biggest blocker was transport semantics. That is no longer the main issue.

Arpeggio already listens to:

- `DaCapo:OnSectionBegin`
- `SongUiShowBeats`
- `Looper:OnResetSong`

That is a good fit for positions.

In practical terms:

- `DaCapo:OnSectionBegin` can own position advancement and section-start regeneration
- `SongUiShowBeats` can continue owning per-beat transient UI refresh
- `Looper:OnResetSong` can own zeroing `lastPositionIndex`

I do not see a new transport blocker that would require a second event just for this feature.

#### 2. The menu shape is supported by the current plugin menu runtime

The earlier note that this would need custom menu-building code is still true, but it is no longer a concern.

The current plugin menu runtime already supports custom children and custom actions through:

- `getVisibleMenuChildren()`
- `MenuItemProxy`
- `pluginAction:invoke`
- plugin-specific `invokeAction(...)`

So a custom `p) positions` subtree with:

- clear this section
- clear all sections
- copy to all sections
- copy to unset sections
- refresh values
- values this section

fits the current runtime model cleanly.

#### 3. The candidate-collection seam is still the key integration point

The same core implementation seam remains correct:

- `collectCandidatesForSection()` currently reads plugin-level `minFret` and `maxFret`
- positions should change the effective fret window passed into candidate collection, not rewrite the style algorithms themselves

So the implementation plan should still treat effective-range resolution as the main insertion point.

#### 4. Section storage is still new territory

This still appears to be the first plugin feature that wants durable per-section plugin state in a dedicated property tree such as:

- `section.pluginData.arpeggio.positions`
- `section.pluginData.arpeggio.lastPositionIndex`

That is viable, but it means the implementation plan should explicitly include:

- section storage helpers
- schema/documentation updates
- careful non-destructive writes so future `pluginData.arpeggio.*` properties are preserved

I would not recommend scattering raw optional-chaining object writes everywhere.

### Recommended Interpretation Of The Current Event Rule

The approved state machine is good. I recommend making one additional clarification explicit in the implementation plan:

- a "qualifying section-begin" means any `DaCapo:OnSectionBegin` that Arpeggio actually receives
- if there is no positions array for that section, Arpeggio uses plugin defaults and does not touch `lastPositionIndex`
- if there is a positions array and there is no stored index, apply `0`
- after applying index `i`, persist `lastPositionIndex = i`
- next qualifying section-begin applies `(i + 1) % positions.length`

That wording keeps the implementation anchored to the actual event the plugin already handles.

### What I Would Carry Forward Into The Implementation Plan

The implementation plan should likely break into these work streams:

1. Section storage helpers
2. positions parsing and validation
3. custom plugin submenu and actions
4. effective fret-range resolution before candidate collection
5. reset and load-time `lastPositionIndex` normalization
6. focused Jest coverage for:
    - event-driven advancement
    - reset behavior
    - load-time normalization
    - validation rejection
    - copy/clear actions

### Questions Still To Answer

These are the questions I think the design team should answer before implementation planning:

1. Should manual Arpeggio apply advance positions, or should advancement happen only on `DaCapo:OnSectionBegin`?

Current reading:
- the document centers advancement on section-begin events
- but manual plugin actions such as `apply` also exist today

Recommendation:
- keep advancement tied only to qualifying `DaCapo:OnSectionBegin`
- manual `apply` should use the currently resolved position without incrementing state unless the design team explicitly wants otherwise

2. When `values this section` is edited successfully, should `lastPositionIndex` reset to `0` immediately for that section?

This affects user predictability.

Recommendation:
- yes, on any successful replacement of the positions array for a section, reset that section's `lastPositionIndex` to `0`

3. When `C) Copy to all sections` or `U) copy to Unset sections` writes positions into another section, should the destination section's `lastPositionIndex` become `0`?

Recommendation:
- yes, copied-in positions should initialize the destination section as fresh state with `lastPositionIndex = 0`

4. If a section has `positions: []`, should that be treated exactly like "no positions"?

The document informally implies yes, but the implementation plan should state it explicitly.

Recommendation:
- yes, empty array should mean fallback to plugin defaults and no `lastPositionIndex` mutation

5. Should `clear this section` remove the whole `pluginData.arpeggio` object when it becomes empty, or only remove `positions` and leave other future keys intact?

Recommendation:
- remove only the positions-related keys being cleared
- preserve unrelated future `pluginData.arpeggio.*` keys
- prune the parent object only if it becomes completely empty and that can be done safely

6. What exact fret-range validation rule should be used against the target tuning?

The document says reject values outside the fret range for the tuning. The implementation plan should pin down whether valid max fret is:

- `0..tuning.frets`
- or `0..tuning.frets - 1`

Recommendation:
- match the same inclusive fret semantics currently used by candidate collection and UI tables, and state that explicitly in the plan

7. Should the menu's displayed `v) values this section [...]` caption always show normalized JSON, even if the user entered shorthand like `0,3;5,9`?

Recommendation:
- yes, normalize to canonical JSON-array display in captions and stored values

8. Should `Refresh values` only refresh menu captions from the current section, or should it also normalize/prune malformed legacy persisted section data when encountered?

Recommendation:
- keep `Refresh values` read-only for this sprint
- use load-time normalization for cleanup, not a read action with side effects

### Bottom Line

This design is now in a much better place than it was before the transport sprint.

The main architectural blockers are gone. What remains is implementation-shape discipline:

- clean section storage helpers
- clean parsing/validation rules
- a custom submenu/action surface
- explicit decisions on a few user-facing edge cases

With the approved `lastPositionIndex` state machine and the newly-correct event semantics, I think this is ready for a separate implementation-plan document once the remaining questions above are answered or explicitly deferred.

## Design Team Answers

1. Should manual Arpeggio apply advance positions, or should advancement happen only on `DaCapo:OnSectionBegin`?  
- ANSWER: Only on `DaCapo:OnSectionBegin`.  TransposePlugin provides an Apply, but does not allow manual advancement of `intervals`.  The correct way for the User to preview or step through ArpeggioPlugin `positions` would be to use beat looping, thus viewing the positions for one Section.  Another use case is where the User has set up just one Section, then section looping would perform the same way.  Allowing manual advancment would throw off calculations where the User has figured out how many positions for number of Sections and fret widths and times through a song.  Also a User may use spacebar mapping to restart a Section, thus making its position index relative to other Sections change, and we'd want to preserve that for the session.

2. When `values this section` is edited successfully, should `lastPositionIndex` reset to `0` immediately for that section? 
- ANSWER: Yes. 

3. When `C) Copy to all sections` or `U) copy to Unset sections` writes positions into another section, should the destination section's `lastPositionIndex` become `0`?
- ANSWER: Yes.

4. If a section has `positions: []`, should that be treated exactly like "no positions"?
- ANSWER: Yes.  

5. Should `clear this section` remove the whole `pluginData.arpeggio` object when it becomes empty, or only remove `positions` and leave other future keys intact?
- ANSWER: Just the pluginData.arpeggio.positions and pluginData.arpeggio.lastPositionIndex.  However, we have had issues with empty objects, so if there are no properties left and `pluginData.arpeggio` is the empty object, it would be good to clean up `pluginData.arpeggio`.  So, exactly your recommendation.

6. What exact fret-range validation rule should be used against the target tuning?
- ANSWER: match the same inclusive fret semantics currently used by candidate collection and UI tables.  Keeping in mind that the Nut is fret 0, and all other cells thus become 1-based, the last playable cell is tuning.frets, so maxFret == 16 on a Standard-8 would be the last playable fret and last playable position, and should thus be included in positions.

7. Should the menu's displayed `v) values this section [...]` caption always show normalized JSON, even if the user entered shorthand like `0,3;5,9`?
- ANSWER: Yes, the shorthand is just for User convenience.  When they see it again, it should be JSON.  We want Users to get used to reading JSON and hopefully being able to enter or at least edit it when presented a value as the default, from storage, in the edit input.  The cycle of entering shorthand and immediately seeing JSON reinforces this training.

8. Should `Refresh values` only refresh menu captions from the current section, or should it also normalize/prune malformed legacy persisted section data when encountered?
- ANSWER: only refresh from the current Section.  We eschew legacy handling. In this case, we'd rather see malformed values and fix the code.

## Request

Copilot, please review our answers in the above section.

Please produce an implementation plan in 
`_doco/design/ArpeggioPlugin-position-implementation-plan.md`




