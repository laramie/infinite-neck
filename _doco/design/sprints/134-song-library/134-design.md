# sprint-134-song-libary Design

## Goals

- Make the song library deeper, to support directory/categories of songs, and support descriptions.
  - Add buttons to open up each (curated) directory in "songs" (some may be hidden due to test fixtures).
  - Close up directories except current one
  - Show song link plus description for each song. 

## Code Separation

To ensure that we keep this feature clean, let the work be done in a new module: `./SongLibrary.js`.  It should migrate any current directory/song listing in the codebase to this new module.

The tests that currently depend on "songs" array should be updated to accept this new format. The old format should be readable by the tests, as we won't migrate all the song list files immediately.

## Discussion and Features

When `File > Open Song from: [Song Library]` button is clicked, it should open up the first level, which is the directory listing of ./songs/

We should curate this directory to have only directories in it.

Test directories should not be shown.  (But we may want to turn this off with `/fa` somehow so we can test fixture files as super-users.)  This will be achieved in song-list.json, by simply excluding those directories.  This needs to be worked out by Design team.  For this iteration, produce all directories listed in the "songs" array as visible rows/links.

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

Note: instead of literal buttons that we have to code state for, we have had good success with the details/summary tags used in `help.html` in element `#detailsMenuDump`.  We would imagine that would be a good way to go *instead of* custom menu buttons, as long as we could programmatically close them all up on entering with the `Song Library` button the first time.  If the User came back in by simply hiding and showing the File menu page, then we would leave their respective states how the User had them.  In fact, the `Song Library` button itself could be a details/summary element block, so that would be one less thing to track with state. 

## Links and Descriptions

Provide a table-like layout, with each song on one row, its link in column 1, its description in column 2.  Column 1 is built by the system as hyperlinks.  Column 2 is pasted as HTML from the JSON of song-list.json, using HTML in the curated description.

The links will appear as they do today, with the relative path in column 1: 
```
sprint-121/piano-follows-guitar-basic-blues.json
sprint-121/guitar-follows-piano-basic-blues.json
```
Of course, we will get around to renaming directory "sprint-121" and curate all the directories, but this shows the format as we have it in the code today.

If a description is present, show the description in column 2, bumping the other links down the page, since each song is a row with two columns.

## Example new song-list.json file format

We want to keep the features of this format, since they support our tests.

To support descriptions, song-list.json will have a new format for `/songs[]`, like this, which moves the simple path string in the "songs" array to an object with href and description properties, but retains other properties of the file: 
```
{
  "songs": [
    {"href": "sprint-121/piano-follows-guitar-basic-blues.json", "description": "A Basic Blues progression on guitar <i>with a piano Listener</i>"},

    {"href": "sprint-121/guitar-follows-piano-basic-blues.json", "description": "A Basic blues prgresion on piano <i>with a guitar Listener</i>"},
    {"href": "sprint-121/piano-f-guitar-chorus-coda.json", "description": "Piano listening to guitar, with a Coda in the Chart"},
    {"href": "sprint-121/All-Chords.json", "description": "All Chords in C, then transposed to all 12 keys"},
    {"href": "sprint-121/All-Chords-fill-mode-piano-listener-light.json", "description": ""},
    {"href": "sprint-121/All-Chords-fill-mode-S8-light.json", "description": ""},
    {"href": "sprint-121/C-chords-w-tiny-modes.json", "description": ""},
    {"href": "sprint-121/pentatonics-7-m-7-in-6-keys.json", "description": ""},
    {"href": "sprint-121/pentatonics-7-m-7-in-6-keys-Fill.json", "description": ""},
    {"href": "sprint-121/name-that-note-bass-4.json", "description": ""}
    {"href": "practice/name-that-note-bass-4.json", "description": "A copy of the file in sprint-121, here in <b>new</b> songs/practice directory."}
  ],
  "ignoredSongs": [],
  "sections": [],
  "songfileVersion": "V2.1"
}

```
Missing descriptons and empty descriptions are allowed.  Missing href should be skippped.