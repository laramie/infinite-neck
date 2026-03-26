# ChangeLog

### 20260326

- Added 'e' to key shortcuts to toggle event wirings; set up some comments to help with locating song model access points for V2 file format; changed default Special Row colors to be less in-your-face; defaulted Cello to not showDiamonds because it has an empty array for diamonds, rather than simply not having diamonds, for some reason;  fixed a few comments and strings around wrapping rules.
- Final step to make listeners listen AND play their own notes; Added showDiamonds to tunings so you can easily turn them off with a checkbox in the myInstruments.
- Added instrument section box with current index and relative if present; Handled WIRING_OPEN state;  Allow myTunings table to hide diamonds row;  TuningsLibrary now triggers EventBus 'InstrumentAdded';
- ProTools-like wiring now in place for instruments to listen to another table, or do relativeSection to another table. Connected to the model's getSong().wirings, and that persists.  You don't relativeSection or anything to yourself.  Not wired into refactored replayTable() yet....
- Wirings in place with new Templating in ./templates/
- Cleaned up missing Constants so that TuningsLibrary table id was not getting through.
- Got Jest tests working again, moved constants into Constants.js and got rid of some "providers".
- Ready for GP4 refactor.
- Added changelog and instructions for 20260324

### 20260324

- Fixed display of View tab tables with better borders and backgrounds, and less table nesting, thus clearing up CSS bug introduced that cause *all* tables to have extra borders.  Added help for "Special Rows". Removed extra paragraph in "My Tunings" with useless title.  Fixed bug where Desktop wouldn't toggle back on to be visible.

- Initialize doSpecialRows in tunings.js for S8 and S6 so they are Special by default.


- Added Special Row, for Standard guitars, if you want to show the rows that are tuned different than P4 you can turn on SR in the Tuning, and it will use different colors, which you can also theme with Note White Key Special Color and Note Black Key Special Color.

- Migrated table-builder.js to TableBuilder.js, obviating the Facade class, and instead using an import * as...; Killed old song-old.js; Moved most of the Tunings table out of TableBuilder into TuningsLibrary.js; moved notetable.js to NoteTableController.js, since it is mostly a Controller, but still has View in it, which can now be refactored out.

- New song V1 to V2 converter installed.

- Added css and button and flex grid layout so .instrumentBackground now has a slot for wiring on the left side.  P caption row is still above all, but wiring is on the left of th
e instrument table.  This will be for Wiring what this table is listening to on the EventBus for new notes, deleted noted, midi notes, and external midi events.



### 20260320

- build version: `stable-20260320`

Added dual box-shadow to nut, since black I note was disapperaring: td.nut div.NoteActive .CenterCell

Added flexbox layout to View page, Themes page.  Broke long tables into flexbox cards.

Fixed bug where snake.json, which didn't have a .theme, was crashing the default Theme dropdown.

Added some Themes font colors.

Investigated why there are nested .CenterCell div in a NoteTable.  Don't remove them.  They are there for some height layout purpose.

### 20260319

`version` works in Jest tests via infinite-neck-headless.js.  infinite-neck.js does not import any Node.js modules.  

Added Diatonic-Scales-Piano.json which works great with 8x8+DJTrailmix.  

Added All-Keys-Maj7-Chords-Piano.json.  

And added these to the song-list.json for the library.



Added version info to the menu in /fv that simply returns a result which can be seen in the dropdown of menu command results, and /fV (that's a capital V) for a more verbose message that shows up in Show Messages. Added external help file link for README.md

Added the supporting version stuff which runs version-update.js as part of manual pushing of a version. Added version.json, and version-read.js, and a block of code in infinite-neck.js that exports getVersionString from the async call to fetch version.json.