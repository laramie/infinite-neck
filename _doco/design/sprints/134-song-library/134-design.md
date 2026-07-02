# sprint-134-song-libary Design

## Iteration 1

### Goals

- Make the song library deeper, to support directory/categories of songs, and support descriptions.
  - Add buttons to open up each (curated) directory in "songs" (some may be hidden due to test fixtures).
  - Close up directories as desired by User
  - Show song link plus description for each song. 

### Code Separation

To ensure that we keep this feature clean, let the work be done in a new module: `./SongLibrary.js`.  It should migrate any current directory/song listing in the codebase to this new module.

The tests that currently depend on "songs" array should be updated to accept this new format. The old format should be readable by the tests, as we won't migrate all the song list files immediately.

### Discussion and Features

When `File > Open Song from: [Song Library]` button is clicked, it should open up the first level, which is the directory listing of ./songs/

We should curate this directory to have only directories in it.

Test directories should not be shown.  (But we may want to turn this off with `/fa` somehow so we can test fixture files as super-users.)  This will be achieved in song-list.json, by simply excluding those directories.  This needs to be worked out by Design team.  For this iteration, produce all directories listed in the "songs" array as visible rows/links.

The directories and buttons should be driven by the paths present in song-list.json, not by a specification of what directories to show in some other struct, nor by walking the songs/ directory.

When a User clicks on a directory button, show the contents of that directory, and close up any other directory showing.  First implementation will have all the directory buttons displayed running down the page like so: 
```
Song Library
   Directory 1
   Directory 2
   Directory 3
```
and when Directory 2 is clicked: 
```
Song Library
   Directory 1
   Directory 2
       Song A
       Song B
       Song C
   Directory 3
```
hiding any songs in Directory 1, Directory 3.

Directory 1 is a button; Song A is a link, followed by its description block.

Note: instead of literal buttons that we have to code state for, we have had good success with the details/summary tags used in `help.html` in element `#detailsMenuDump`.  We would imagine that would be a good way to go *instead of* custom menu buttons, as long as we could have them be closed upon entering with the `Song Library` button the first time.  If the User came back in by simply hiding and showing the File menu page, then we would leave their respective states how the User had them.  In fact, the `Song Library` button itself could be a details/summary element block, so that would be one less thing to track with state. 

### Links and Descriptions

Provide a table-like layout, with each song on one row, its link in column 1, its description in column 2.  Column 1 is built by the system as hyperlinks.  Column 2 is used as HTML from the JSON of song-list.json, using HTML in the curated description.

The links will appear as they do today, with the relative path in column 1: 
```
sprint-121/piano-follows-guitar-basic-blues.json
sprint-121/guitar-follows-piano-basic-blues.json
```
Of course, we will get around to renaming directory "sprint-121" and curate all the directories, but this shows the format as we have it in the code today.

If a description is present, show the description in column 2, bumping the other links down the page, since each song is a row with two columns.

### Example new song-list.json file format

We want to keep the features of this format, since they support our tests.

To support descriptions, song-list.json will have a new format for `/songs[]`, like this, which moves the simple path string in the "songs" array to an object with href and description properties, but retains other properties of the file: 
```
{
  "songs": [
    {"href": "sprint-121/piano-follows-guitar-basic-blues.json", "description": "A Basic Blues progression on guitar <i>with a piano Listener</i>"},

    {"href": "sprint-121/guitar-follows-piano-basic-blues.json", "description": "A Basic blues prgresion on piano <i>with a guitar Listener</i>"},
    {"href": "sprint-121/piano-follows-guitar-chorus-coda.json", "description": "Piano listening to guitar, with a Coda in the Chart"},
    {"href": "sprint-121/All-Chords.json", "description": "All Chords in C, then transposed to all 12 keys"},
    {"href": "sprint-121/All-Chords-fill-mode-piano-listener-light.json", "description": ""},
    {"href": "sprint-121/All-Chords-fill-mode-S8-light.json", "description": ""},
    {"href": "sprint-121/C-chords-w-tiny-modes.json", "description": ""},
    {"href": "sprint-121/pentatonics-7-m-V7-in-6-keys.json", "description": ""},
    {"href": "sprint-121/pentatonics-7-m-V7-in-6-keys-Fill.json", "description": ""},
    {"href": "sprint-121/name-that-note-bass-4.json", "description": ""}
    {"href": "practice/name-that-note-bass-4.json", "description": "A copy of the file in sprint-121, here in <b>new</b> songs/practice directory."}
  ],
  "ignoredSongs": [],
  "sections": [],
  "songfileVersion": "V2.1"
}

```
Missing descriptons and empty descriptions are allowed.  Missing href should be skippped.

### Iteration 1 Request

Copilot, please analyze this Iteration 1 specification, and produce an implementation plan in 
[Iteration 1 implementation plan](134-it1-implementation-plan.md)
with any questions, design holes, etc.

### Iteration 1 Answers to Questions


1. Directory key for href values with no `/`:
- Option A: show under `(root)`.
- Option B: skip as malformed.
ANSWER: Show under root

2. Description rendering policy:
- Should we allow raw HTML exactly as provided (current design intent), or pass through existing sanitizer utilities before insertion?
ANSWER: raw HTML exactly.  This is programmer-authored and needs no sanitizer.

3. Initial open-state behavior detail:
- Should the top-level Song Library details be closed every time `Song Library` button is clicked, or only the first time in a session?
ANSWER: Despite what we may have said in the early design, let it be user/browser remembered.  Initial state is closed for all, if they open one and the browser remembers, let it stay open.  No active/programmatic opening or closing.

4. Empty directories behavior:
- If all entries in a derived directory are skipped (invalid href), should that directory still appear?
ANSWER: Yes.  We will likely fix them, but this will enable us to see them and know it's not a caching issue.

5. Link text behavior:
- Confirm link text remains full relative path (`dir/file.json`) rather than filename-only.
ANSWER: Yes.  Full relative path, which will match the URI, so Users can understand where they live and copy URI's easily.

6. Test-fixture visibility:
- Iteration says list curation excludes fixtures; confirm no code-based filtering should be added now.
ANSWER: No active filtering in code.  We will curate them and remove them from song-list.json

ADDITIONALLY: 

a) Let the alternating row colors of the current design be used as the model for alternate rows in the new list.

b) Let there be an introductory paragraph/colspan, with HTML presented in two-column-wide format so that it spans the whole row/div.  It would come before any songs or directory open/close widgets.  This will have the form:

```
{
  "songs": [
    {"href": "sprint-121/piano-follows-guitar-basic-blues.json", "description": "A Basic Blues progression on guitar <i>with a piano Listener</i>"}
  ],
  "directoryIntros": [
    {"introFor": "sprint-121", "html": "This directory has all the songs that you can use for practices: arpeggios, scales, note memorization." }
  ]
}
```

"introFor" is a directory name that matches a path given in other songs.

So the final form should be:
```
Song Library
   Root-Directory-Intro
   Root-song-1-link  |  Root-song-1-description
   Root-song-2-link  |  Root-song-2-description
        Directory-1
            Directory-1-Intro
            song-3-link  |  song-3-description
            song-4-link  |  song-4-description
        Directory-2
            Directory-2-Intro
            song-5-link  |  song-5-description
            song-6-link  |  song-6-description
```
Here "Song Library", "Directory-1", and "Directory-2" are all open/close widgets.  "Song Library" is an alias for "./songs" and the other are the actual directory names.

## Iteration 2: tune visuals

Testing is going well.

We would like to tune the visuals:

1) We no longer need `#btnSongList`.  It will be sufficient to have the first UI in the `.sectionPageControlsGroup` to be `#divSongList`.  It will also not be needed to hide `#divSongList`.  It can be the always visible container.  

We'll always have songs, but in the event of error or missing song directories etc., having "Song Library" be the always-present songLibrarySummary would be good.

So on startup, instead of "Open Song from: [Song Library]" would be replaced by simply having the top collapse/expand item "Song Library".

On startup, "Song Library" would be closed.  Again, the code doesn't react.  If the User opens it, it stays open.  But nor do we persist that state either way.

2) We decided you were right, and the links will look better with just the filename, and not the directory.
e.g. replace 
`sprint-121/piano-follows-guitar-basic-blues.json`
with 
`piano-follows-guitar-basic-blues.json`

## Iteration 3: song-multi-instrument

We are finding an explosion of songs needed, and we would prefer to add multi-instrument authoring into the songs, rather than having the same song duplicated for, say, P46 and S6, with all the transpositions, positions, etc.  The songs, of course, support this, and we do this all the time.  What is slightly new is that we want to be guilt-free knowing that we are not slowing down the song looping by putting in more instruments as options for various players' preferred tunings, and making them not visible by using the checkbox in the MyTunings page.

### Goals
1) Ensure that replay() and friends are optimized for Instruments that are not Visible, especially anything that affects time showing the next Section or things we are trying to optimize with caching.
2) Ensure that TransposePlugin and positions for Fill and Arpeggio are updated in Instruments that are not visible, but that resources that affect time spent in tickBeat, beat looping, and Section looping are not wasting.
3) Create a utility in `./bin/update-song-list.js` that can be run anytime, especially as part of the build, that will update `./songs/song-list.json` to have the field `instruments` be up-to-date with the status of the song on disk.  The song should not be modified, but song-list.json should be modified after reading the songs.  If a developer goes in and modifies a song by making an instrument visible, or not visible, or a Listener, or an Observer, and runs the utility, then the song-list.json should be updated.  Only songs in song-list.json need be read.  Other songs not added to the song-list.json are not read.  There may be other test songs that are added to other lists, but these also are not read.
4) Make changes to the display of song-list.json in SongLibrary.js and song-library.css so that the categories of Instruments in the songs are displayed differently in the song list as it appears in the `File > Song Library` accordion directory listings.

### Design

#### Display of categories of Instrument stati

These live in song-library.css and are attached to directory listing elements, not Instruments or tuning objects elsewhere in the app.

For each Instrument/tuning, the baseID, or fromBaseID is used, so we get things like `["P46", "S6", "Bass4", "Piano"]`

CSS Classes: 

Instrument not Listener, not Observer: `.instrumentMain`

Instrument is wired as Listener: `.instrumentListener`

Instrument is wired as Observer: `.instrumentObserver`

Instrument not visible: `.instrumentNotVisible`

So `song-list.json` would get new entries such as:
```
{ 
  "songs": [
    {
      "href": "theory/mode-nat-minor-transposed-S6.json",
      "description": "<i>natural minor mode</i> shown with a blue, light color-theme, transposed through all 12 Keys on a <em>Standard-tuning Guitar</em>, so you can see the pattern in all positions.",
      "instruments": [
        {"fromBaseID":"P46", "wiring":"Listener", "visible": true},
        {"fromBaseID":"S6", "wiring":"Observer", "visible": false},
        {"fromBaseID":"S6", "wiring":"Main", "visible": true},
        {"fromBaseID":"Piano", "wiring":"Listener", "visible": false}  
      ]
    }
  ]
}
```

The new "instruments" property will be generated from reading the song files and written to song-list.json, while preserving the hand-authored properties such as "href" and "description".  We will not tweak or edit the "instruments" property.

Note that this does not show the wiring, whom which is wired to, etc.  We don't care about that.  We just care that these instruments are in the song in their roles, and are persisted as visible or not visible.  If I'm a P4 player, I'm going to look for songs that already are authored for P4 players, that is, they have P4 as "Main" and may have other Listeners and Observers.  I may also want to see if there is a P4 hidden in the song if it is the only one available with that purpose, (for example, to show natural minor mode with color-themes), and when I see that P4 is invisible then I know I can open the song and hit the visible checkmark and be in business.

We will tweak the CSS, so just make basic CSS rules in separate categories for each:

```
.instrumentMain {
  background-color: white;
  color: brown;
  border: 2px solid brown;
}
.instrumentMain.instrumentNotVisible {
  background-color: #aaa;
  color: brown;
  border: 1px solid brown;
}
.instrumentListener {
  background-color: #ffe57b;
  color: #0a0;
  border: 2px solid #0a0;
}
.instrumentListener.instrumentNotVisible {
  background-color: #bdaa5d;
  color: #0a0;
  border: 1px solid #0a0;
}
.instrumentObserver {
  background-color: rgb(213, 255, 213);
  color: #00a;
  border: 2px solid #00a;
}
.instrumentObserver.instrumentNotVisible {
  background-color: rgb(136, 164, 136);
  color: #00a;
  border: 1px solid #00a;
}
```

#### Display of Instruments in "Song Library" entries

Each Instrument in a song should get a span with the above CSS classes, and all the Instruments in a song together should occupy a new third column in the per-song listings.

e.g.

```
<div class="songLibraryRow"><div class="songLibraryCell songLibraryCellLink"><a href="#" data-action="loadSong" data-action-args="[&quot;demo/piano-follows-guitar-basic-blues.json&quot;]">piano-follows-guitar-basic-blues.json</a></div><div class="songLibraryCell songLibraryCellDescription">A Basic Blues progression on <b>Guitar</b> with a <em>Piano Listener</em></div><div class="songLibraryCell songLibraryCellInstruments"></div></div>
```

with the Instruments in the song being spans, one span per instrument, with the above CSS classes, inside `div class="songLibraryCell songLibraryCellInstruments"`.

### Iteration 3 Request

Please provide an implementation plan for the parts of this design that make sense, and provide analysis and questions for anything that doesn't especially holes in the strategy of making invisible instruments be low-performance-impact.

Please suggest any changes that would make the CSS more idiomatic, efficient, or maintainable

Please provide this plan in [Iteration 3 implementation plan](134-it3-implementation-plan.md)

### Iteration 3 Revisions for implementation

Please revise [Iteration 3 implementation plan](134-it3-implementation-plan.md) with the information below, then proceed to coding.

#### Revised CSS

We appreciate the suggested CSS edits.  However, in this codebase, we use css vars heavily and almost exclusively for dealing with themes and DisplayOptions where we set the vars at runtime.  So we don't want to confuse our programmers and external programming consumers with css vars that are merely for maintenance centralization efficiency yet are statically known at load time.  So we have the CSS here installed in song-library.css now:


```css
.songLibraryInstrument {
		display: inline-block;
		margin: 0.1em 0.2em 0.1em 0;
		padding: 0.1em 0.35em;
		border-radius: 0.35em;
		font-family: "Kode Mono", "Courier New", monospace;
		font-size: 85%;
		font-weight: 700;
		white-space: nowrap;
}

.instrumentMain {
  background-color: white;
  color: brown;
  border: 2px solid brown;
}
.instrumentMain.instrumentNotVisible {
  background-color: #aaa;
  color: brown;
  border: 1px solid brown;
}
.instrumentListener {
  background-color: #ffe57b;
  color: #0a0;
  border: 2px solid #0a0;
}
.instrumentListener.instrumentNotVisible {
  background-color: #bdaa5d;
  color: #0a0;
  border: 1px solid #0a0;
}
.instrumentObserver {
  background-color: rgb(213, 255, 213);
  color: #00a;
  border: 2px solid #00a;
}
.instrumentObserver.instrumentNotVisible {
  background-color: rgb(136, 164, 136);
  color: #00a;
  border: 1px solid #00a;
}
```


#### Revised visibleNoteTables and song-list.json

We completed an edit where we removed visibleNoteTables from songs in the repository on our branch, and a chat where Copilot removed visibleNoteTables from the repository, and adjusted a few tests, on our branch.  So the implementation plan should reflect these changes and not have to deal with visibleNoteTables.

In this revision, we also ensured that song-list.json has no "legacy" format simple one-line song references, only the new href/description objects.  There may be song lists for testing, but those are not shown in the Song Library, and may be ignored.

Order in song-list.json must be display order.

#### Revised Clarity on baseID/fromBaseID

Unless we have an errant song, we believe all songs in the library now properly use `fromBaseID` as their class/inheritance, and so should be appropriate for the badge display.  We should not have to deal with, or want to display, `baseID`.  The canonical set of songs should be those listed in `./songs/song-list.json`.  Other lists may include test songs that may have intentional errors, or at the least, are not readily available to Users.

#### Clarifying Observer

Yes, the definition of an Observer is one who is wired with a relative section specifier.  This definition from the implementation plan is a good one: 

  "Observer: wiring exists and relativeSection is non-empty."

#### implementation plan Questions Answered


1. **Generated field ownership:** Should developers ever hand-edit `instruments`, or should `bin/update-song-list.js` be treated as the sole owner? Recommendation: generated-only; hand edits will be overwritten.
ANSWER: generated-only.

2. **String song-list entries:** Is converting legacy strings to objects acceptable in the primary curated list when running the updater? Recommendation: yes, because adding `instruments` requires object entries.
ANSWER:  Skip it, and warn.  We'd prefer to fix the song-list files if found.  We believe the main one is up-to-date, and others are for testing only. 


3. **Observer label source:** The proposed role mapping assumes `relativeSection` means Observer. This matches current code comments, but the plan should be confirmed before implementation.
ANSWER: The roles definition in `### Role model` in the implementation plan is perfectly correct.


4. **Duplicate `fromBaseID` display:** Songs may intentionally have two S6-derived instruments, such as an S6 Main and an S6 Observer. Recommendation: render duplicate badges separately because role/visibility may differ.
ANSWER: Yes, render duplicates.  Especially for Observers, where there may be a look-ahead and a look-behind and the Main.  For now, look-ahead and look-behind will be identical badges and that is OK.  We like that there will be duplicates to show that there are different ones. 


5. **`Piano` vs `PianoSkeuomorphic`:** The design examples show `Piano`, but current sample songs may have `fromBaseID: "PianoSkeuomorphic"`. Recommendation: use exact `fromBaseID` for generation now. Add a later display-label map only if users dislike the raw base IDs.
ANSWER:  Yes, use exact `fromBaseID`.   


6. **Visibility source of truth:** Runtime currently prefers `noteTablesLayout`; generation should also prefer it. If a song has conflicting `myTunings[].visible`, `noteTablesLayout` should win.
ANSWER: Yes.  Log warning to UserLog.


7. **Updater error policy:** If a listed song is missing or invalid JSON, should the updater fail the whole run or keep going? Recommendation: keep going, report all errors, and exit non-zero without writing partial changes unless an explicit `--force` is added later.
ANSWER: Keep going and report. 


8. **Performance acceptance target:** The design asks for low impact but does not define a threshold. Recommendation: record baseline counts/timing for replay/prewarm tasks before and after adding hidden instruments; use “hidden tables produce zero replay/prewarm tasks” as the first pass criterion.
ANSWER: Recommendation approved.


## Iteration 4 : Badges, instrument.visible cleanup

### Instrument Role Badges in My Tunings

We like the fromBaseID badges.  We want to use them in other parts of the app.  So the function that produces them should be clean and re-useable.  Hopefull this is already so.  If not, small refactoring would be in order.

We want to use them in the "My Tunings" grid.  Where it currently has a column (6th) called "from" we now want the caption to be "Role", and the value in the column instead of being the text value of fromBaseID, should be the badge for this fromBaseID, using the CSS stylings from `song-library.css`, which should already be available since this is on the same host page as "Song Library".  

When a User changed wiring, the "My Tunings" page will need to be rebuilt when shown next.  If this is already handled then fine.  However, since the wiring panels in each instrument can be shown while the "My Tunings" menu page is showing, the "My Tunings" menu page will probably have to be kicked with an event to get the update to happen.


### Instrument Role Badges in approved expansion and thence in File > Info

We also want the badges to be available to an approved text expansion, and that text expansion should be available to "File > Info" in the User-entered HTML in the editable textarea.

This means all values allowed should be allowed in "File > Info" the same way they are allowed in Section Caption, even though they may not always make sense outside of a particular Section. This is how the Caption is expanded:
`var caption = expandApprovedTemplate(rawCaption);`

This means any widgets we expose this way will be available in Caption and in File > Info.

In particular, we'd like to add a widget that dumps out what the song-library dumps out for badges when listing the songs.  A User could put this in "File > Info" if they wanted to share that in the Info landing page for opening a Song, without us making every song show this in Info.

So in parallel with things like `${arpeggioPositionsStatus}` we'd like this widget to be called via `${songInstrumentBadges}` and also a longer version in a table called 
`${songInstrumentTable}`.

Here is the format of songInstrumentTable:

```
<table>
    <tr>
        <th>Role</th>
        <th>ID</th>
    </tr>
    <tr>
        <td>Instrument1-badge</td>
        <td>Instrument1-ID</td>
    </tr>
    <tr>
        <td>Instrument2-badge</td>
        <td>Instrument2-ID</td>
    </tr>
</table>
```

### Tuning "visible" is out of date and out of sync

Additionally, we found during testing that this message kept being produced:
```
npm run update:song-list

> infinite-neck@1.0.0 update:song-list
> node bin/update-song-list.js

WARN UserLog SongListUpdater warning: guitar-basic-blues-fwd-back-observers tblS6_back tuning.visible=false conflicts with noteTablesLayout=true; using noteTablesLayout.
WARN UserLog SongListUpdater warning: guitar-basic-blues-fwd-back-observers tblP46_1 tuning.visible=false conflicts with noteTablesLayout=true; using noteTablesLayout.
songs/song-list.json is up to date.
```
This means that even in new songs, messing around with the visible checkbox gets the Model out of sync.  noteTablesLayout has been working well, and we don't see any need for `visible` in tunings.js,  or in "My Tunings" runtime, or in the songfiles.  We'd like to remove it from these. 


### Request

Please produce the implementation plan, with any questions, in [sprint-134 Iteration 4 Implementation Plan](134-it4-implementation-plan.md)

## Iteration 5

Here is an example from the DOM of an Instrument with ID "S6_forward", showing its caption inside `.captionRow` and then inside `.captionRowInstrument`:
`<span class="captionRowInstrument"><span>S6_forward:</span></span>`

Then this one comes from the left-rail below the looper light and section status.

`<div class="leftRailCaptionHost"><span class="fretTableLeftCaption">S6_forward</span></div>`

We would like both of these to get the news when wiring has changed, so that they get a new class, and we can style that class.

We want a similar class to the Role badges we just installed.  However, we don't want to tie that code in with this caption row and left-rail code.  Merely copying the CSS will suit most of our needs of that implementation.  However, we suspect that the easiest way to do this is to add the Caption inside the Section-Status widget and output the left-rail caption where it is but inside the widget so that it can get events when wiring changes happen.  We want the same as the Key fields, which have css for Observer and Listener, but they are called `ssKey_relative` and `ssKey_listener`

However, this means the code in TableBuilder.js:186-211 will need to be modified somehow.  The span that gets inserted there for the caption has a destination for changing the Instrument ID dynamically.  So we want that target destination span to still be there, but the span that sorrounds the caption and its necessary destination classes for finding it still inside.  This way, we can get the ID updated as it is today, and the Observer/Listener (ssKey_relative/ssky_listener) class so we can add CSS rules to putting the caption classes in section-status.css.

Please advise if this is the cleanest way to do this without disturbing too much.

So since inside the SectionStatus widget output we have:

`<span class="ssCaptionWrapper"><span class="fretTableLeftCaption">S6_forward</span></span>`

then in the section-status.css we just want: 

.fretTableLeftCaption :: defined in instrument.css, could be moved

.ssCaptionWrapper .fretTableLeftCaption {
   border 2px solid red;
}
.ssCaptionWrapper .fretTableLeftCaption.ssKey_relative {
  border 2px solid blue;
  background-color: white;
}
.ssCaptionWrapper .fretTableLeftCaption.ssKey_listener {
  border 2px solid green;
  background-color: white;
}

We'd like your analysis on the cleanest and least disturbing way to make this happen.




    
