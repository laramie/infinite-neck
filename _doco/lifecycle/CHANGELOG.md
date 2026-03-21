# ChangeLog

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