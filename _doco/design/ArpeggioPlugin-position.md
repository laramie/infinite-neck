# Feature: ArpeggioPlugin position Option

We would like to add an option to ArpeggioPlugin `style` menu.  This style would be `position`.  It will be a sibling to every, alternate, random, and bach.  The menu item would be `position` and the trigger would be `p`.  It would have a child input menu item, with caption `positions`, default `[[0,3],[4,7],[5,]]`, prompt "arrays of positions".  There are no other child menus yet, but we expect some as we refine the behavior in testing.  `position` is the name of the `style` child.  `positions` is the Array-of-Arrays input child of `position`.

It will be the first style that will keep track of its state in the Section object.  Previous plugins have kept state in the standard Song.sections[n].SectionNotes as Note object with  "owner:" properties.  This will be different because it will involve a new property tree of Section, which should be added to the Song/Section schema as well, documented in our root `README.md`.

- Song
  - Section
    - "pluginData"
      - "arpeggio"
        - `{
            lastPositionIndex: 0, 
            positions: [[0,3],[4,8],[8,12]]
           }`


In the state of the Plugin, there may internally be a `positionIndex` calculated on `DaCapo:OnSectionBegin`.  After this is calculated, `lastPositionIndex` may be immediately written, so that if the User advances the loop somehow, the next time `DaCapo:OnSectionBegin` fires, we get a new `postionIndex` and then a new `lastPositionIndex`. 

In the above outline example of properties, `lastPositionIndex` and `positionIndex` would be 0 for the zeroth array member [0,3] and 1 for the first array member [4,8].           

It is valid to have overlapping positions.  These are all legal: 
- ` [[0,3],[4,8],[8,12]]`
- ` [[0,3],[4,8],[6,9]]`
- ` [[0,3],[4,8],[5,7]]`

It is valid to have the start index of the inner Arrays not be in order.  This is legal:
- ` [[4,8],[0,3],[5,7]]`

The outer array is just processed in order, and kept track of in lastPositionIndex, then wrapped to the beginning, forever.


## There should be input shortcuts so Users do not have to enter valid JSON for `positions`

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

# Resets

When Looper:OnResetSong is handled by ArpeggioPlugin, if `position` has written Song.Section.pluginData["arpeggio"] it should clear, based on the "hard" option of the event data: 

- when "hard"===true, all data, including the element `pluginData["arpeggio"]`.  This should be done in the Plugin at the event handler level such that Plugin implementors can see that this affects the entire set of options ArpeggioPlugin may have or may be added in code later.

- when "hard"===false or absent, base on how `resetSongHard` is implemented in `key-handlers.js`, then the ArpeggioPlugin should only reset `position` data such that `lastPositionIndex` is 0 again.  Other options may add to this later with different properties under `pluginData["arpeggio"]`, and should not be stepped on.

## Implementing position

When the Section loops, and style is `position`, ArpeggioPlugin should advance the positionIndex, to the zeroth array element on the first time, and to the next element thereafter.  That "position" is interpreted as minFret and maxFret, so that the playable note cells are inclusive, following how the rest of the styles work.

The style of placing notes is exactly like `every`. This is not a feature to be added to cover the other styles at this point.  It is a separate style that behaves like `every`, except that on each loop it changes its internal minFret and maxFret and ignores minFret and maxFret set one level up in the Plugin menu as syblings of style.  For code understandability, it is preferable to leave the other styles alone and create a separate algorithm.

If the number of beats is too small, then the behavior previously defined for other styles is still valid: each loop restarts from the first candidate note and procedes until beats are exhausted.  If not, it repeats as `every` does.  Regardless of how many notes were played in the previous loop, at each advanced position, the algorithm procedes as though the user had set minFret and maxFret as their only looping position.

If the number of beats is greater than the number of candidate notes (respecting `up only` and `low to high`), then the next position in the array is chosen and advanced to, and the first candidate note is chose as though the loop were starting there with minFret and maxFret.
