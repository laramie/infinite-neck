# Feature: ArpeggioPlugin position Option

## Document Version

This is version 2.
- version 1 in a different file described a separate style `position` which used `positions` Array-of-Array to implement a new style.
- version 2 abandons that separate style.  It replaces it with the concept of `positions` being available to all ArpeggioPlugin `style` algorithm options, through resetting the minFret and maxFret properties for each Section at loop boundaries.

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

So at this moment, we want to inject consulting the `positions` Array of Array, and setting minFret and maxFret.  In this way, all the existing `style` algorithms should participate as they do now, thinking the user has gone in and set minFret and maxFret just before the event.

## Storage

Storage is in the Section object, because Users are allowed to move, delete, clone, shallow-clone Sections in the Song, and Bury/Revive Sections in the Graveyard. These positions values are per-section, so should follow the Section objects, not the plugin, or the per-Song Song.plugins persistence.

minFret and maxFret *are* stored in Song.plugins, and will be considered expendable if the user has set *any* positions in any Section.  Once a Section's positions has been applied, the minFret and maxFret are overwritten.  There is one exception to this: the plugin should persist the minFret and maxFret found in Song.plugins and reset those values on event `Looper.OnResetSong`(hard).  On `Looper.OnResetSong` (both hard and not hard), the plugin should reset all Sections `lastPositionIndex` integer pointers to 0.  So without a hard resetSong, the values persisted in the Song.plugins on file save/download will be the last values used if set by positions::value.

## Menu

To support this `positions` switching of minFret and maxFret, we must allow the User to choose positions for each Section.  Musically, some Sections will only be played in higher up the fretboard and some will only be played lower, while some will use the full fretboard, that is, all the frets defined in the Tuning. Also, some may have three positions to play, some will only have one.  If they have zero, we simply use the values found in minFret and maxFret which already have defaults.  So we want per-Section values, which means we must have editing controls to set, copy, edit, and clear positions per Section.

There are some edge cases where we might want to consult previous Sections for positions values for Sections that don't have positions stored, i.e. sparse positions values.  However, in this sprint we will consider these cases to instead use the minFret and maxFret however they were left in the state of the Plugin by previous loops or navigation or defaults.  The expected result will only be available by starting at the first Section and playing the Song through.  We will address carrying forward positions values for sparse positions values Songs in a later sprint.

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

Otherwise invalid JSON should set a actionResult.result of the JSON error trying to parse, or other terse, meaningful message, and value set to the empty string.

Negative integers should be rejected with a result message.

Values outside the fret range for the Tuning should be coerced into the allowable values of the Tuning.  If this yields position pairs such as [3,3] they should be rejected as the User-input value.

Reversed minFret and maxFret values should be rejected with a result message, e.g. [5,3] for a position pair is rejected.

# Resets

When Looper:OnResetSong is handled by ArpeggioPlugin, if `position` has written Song.Section.pluginData["arpeggio"] it should clear, based on the "hard" option of the event data: 

- when "hard"===true, reset minFret and maxFret at the plugin level from values set when non-empty positions are input, or on read from Song persistence, whichever produces a more reliable saving of the values from Song load.  

- for either hard or not hard reset, then the ArpeggioPlugin should reset such that `lastPositionIndex` is 0 again for all Sections.  

- Other options may later add different properties under `pluginData["arpeggio"]`, and should not be stepped on.

## Implementing position

When the Section loops ArpeggioPlugin should advance the lastPositionIndex, to the zeroth array element on the first time, and to the next element thereafter.  That "position" is interpreted as minFret and maxFret.

Any time DaCapo:OnSectionBegin is received, the lastPostionIndex is advanced, minFret and maxFret are set from the postion found at that index, and the plugin proceeds normally.

