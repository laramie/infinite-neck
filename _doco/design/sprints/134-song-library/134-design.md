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

