# MovePlugin

## Iteration 1: Design

We want a MovePlugin, similar to the other plugins in ./plugins/ in the repository.

It will function almost like the set of tools available when the User "unlocks" the keyboard actions with `/fu` : "/file/unlock", which transposes the NamedNotes in the current Section only.  These are the transpose keymapped actions `u`,`d`,`U`,`D`,`j`,`J`.  This is a bit different than how to the TransposePlugin operates, but underlying is the same transpose algorithm.

In the plugin, we will map their mostly-equivalent actions to `u`,`d`,`j`,`J` as bang options in the plugin's menu item `m) motions`.  We say 'mostly-equivalent' because they will be functionally very different, but will have the same visual effect to the User.

Differences from transpose() and TransposePlugin:
- in MovePlugin, the User will select to include PlayedNotes or RecordedNotes, explicitly chosing SingleNote, TinyNote, Highlight and whether to include RecordedNotes.
- NamedNotes will not be moved or available to select.
- Since SingleNotes, TinyNotes, and HighlightMulti Notes don't wrap the way NamedNotes automatically do, as we move the notes they will drop off the neck/table left, right, up, and down.  We will handle this with an "algorithm" the User chooses.
- HighlightSingle notes do represent NamedNotes, effectively, since they are bound to a MIDI value, which always resolves to a real note name, such as MIDI 60 === 'C'.  So when moving these, they will automatically wrap correctly.  Therefore it is not possible to wrap them algorithmically, or to "drop" them.  By moving them, they algorithmically increase or decrease their MIDI number, so "octaving" them won't make sense either, as we'll see as we define what "octaving" is for other moved notes.

Note: It is not possible through the UI to have both HighlightMulti and HighlightPitch recorded in the same beat.  So we don't need to support adding or transforming Multi into MIDI or vice-versa, or worry about one style stepping on the other.

The programmer-facing documentation terminology and slightly sloppy names HighlightMulti and HighlightSingle, HighlightPitch, and HighlightMidi are sprinkled around.  The real definitions are the styleNum values in Note class in `Note.js`: 
- HighlightMulti is Note.STYLENUM_MIDIPITCHES
- HighlightPitch is Note.STYLENUM_MIDIPITCHESSINGLE 
- HighlightSingle is Note.STYLENUM_MIDIPITCHESSINGLE 
- HighlightMidi is Note.STYLENUM_MIDIPITCHESSINGLE 

## droppedNotes

The "algorithm" chosen will have the opportuning to drop notes from the Section, and these will be collected in a MovePlugin-owned single object, called droppedNotes.  The User will have a menu option to dump the droppedNotes to showMessages as JSON so it appears in the plain messages and as a JSON tree.

Any dropped note should be added to a collection of informational log entries, called droppedNotes, to be presented in a showMessages message.  droppedNotes is thus held onto as state by the MovePlugin. To show the messages, there will be a menu option `show droppedNotes`.  The droppedNotes collection entry should be:
  1) the JSON of the Note in its original cell, key "Note"
  2) a reason field, key "reason", which will be defined in the algorithm, and may be loose, defined as a string at the code location, for example "no string up from row 0", "no string down from row 5", "no fret below 0", "no fret above 16".
  3) an "algorithm" field, key "algorithm", which is the name of the "algorithm" in effect, e.g. "drop", "octave" or "string".
  4) the beat, key "beat", if and only if the Note was in a "recordedNotes", otherwise absent.
  5) the sequence should be kept in order, such as an Array, as notes are dropped, so first dropped note is element 0 and so on.
  6) a sample log would thus be:
  ```
   "droppedNotes": [
        {
            "Note":{
              "noteName": "Gb",
              "styleNum": 2,
              "midinum": "66",
              "row": "0",
              "col": "1",
              "colorClass": "noteTransparent"
            },
            "reason": "no string above row 0",
            "algorithm": "drop"
        },
        {
            "Note":{
              "noteName": "D",
              "styleNum": 4,
              "midinum": "62",
              "row": "2"
            },
            "reason": "no string above row 0",
            "algorithm": "drop",
            "beat": "1" 
        }
   ]
  ``` 

## "algorithm" options

We want to be consistent, and use "up" to mean the direction bound to the `u` option, "down" to be the direction bound to the `d` option, "jump up" to be the direction bound to the `j` option, and "jump down" to be the direction bound to the `J` option.

This is tricky, because up and down are defined differently in User-facing terminology for strings than up and down in the visual representation in a NoteTable, and also Tunings allow very different string/pitch orders, so these cannot be relied on to be consistent. Here we will not use "up" and "down" in User-facing terminology, only the meanings just defined.  

However, the algorithms will make the following efforts, and not consult any Tuning-specific rules. 

In the following discussion, we'll use zero-based "row" number and not "string number" which is a User-facing term.

For "jump up" and "jump down" be careful that the strings may have a strange string/octave order, such as Instrument "Banjo" or Instrument "ChapmanStick". We deal with this below by specifying how the rows are searched.

In all algorithms, when we say a note is dropped, dropped notes are added to droppedNotes. 

The User will select an "algorithm" for moving notes:

1) "drop"
  a) "drop" simply deletes the note from the set if the User "jumps up" (`j`) or "jumps down" (`J`) and that makes the note go to a non-existent string.
  b) "drop" simply deletes the note from the set if the User moves "up" (`u`) or moves "down" (`d`) and that makes the note go below fret 0, or above the last available fret on the Tuning.
  

2) "octave"
  a) When the User "jumps up", and the note disappears because it is now on a non-existent string, the algorithm will subtract 12 from the MIDI value, and find the next available note on a higher row number.  
    1) The strings are searched in the oposite direction of the "jump up".  "jump up" *is* clearly defined as going up in the note table as laid out on the page, that is from row 1 to row 0. (A persisted Note has value `"row": "0"` when it is on the first/top row/cell in a note table.)  So the first step in "jump up" from `row[i]` when we run out of strings is to search `row[i+1]`
    2) if the next string at `row[i+1]` does not have the lower octave note (MIDI-12) value within fret range, then the algorithm continues to `row[i+2]`, the next string, until it runs out of strings, at which point it wraps and tries again from `row[0]` and continues down until it hits the string we started on, `row[i]`, at which point it gives up and drops the note, deleting it from the set, including it in the droppedNotes log. For example, if we started on `i == 0` and it wraps to searching `row[0]`, then we are done.  For another example if we started on `i == 1` and it wraps to searching `row[0]` then we search that row, then proceed to `i == 1` and the next row to search is `row[1]` so we are done and `row[1]` is not searched.
  b) For "jump down", the logic is reversed: when we run out of strings in the high row-number direction, we start at `row[i-1]` and so on.
  c) For "up", we are sliding the note higher in column number until we reach fret max.  Then we search for the MIDI-12 note on the same string/row, but going back 12 frets.  If we have more than 12 frets, this is guaranteed to be on the same string.  If we have an instrument with, say, 6 frets, then we can't go back 12 frets.  So we would proceed to search the next row+1, and wrap to searching from row 0 as in outline point `2)"octave", a)` above.
  d) For "down" we are sliding notes lower in column number.  When we run out of frets at fret 0, we attempt to find a note an octave "higher" at MIDI+12 on the same string.  If we don't have enough frets, we search row-1 as above, attempting a wrap in the same way. 
    

3) "string"
  a) For "up" and "down", this is identical to "octave", but we only search the current string.  No attempts are made to change row number.  If it does not have a MIDI+12 (when going "down") or MIDI-12 (when going "up") value on that string, the note is dropped.
  b) For "jump up" and "jump down", this is not logically possible, so notes are dropped when we run out of strings.  However, notes *are* moved "jump up" and "jump down" as in "drop" and "octave", but without attempting to find note replacements on other strings.

## recordedNotes handling

The user will be "blind" when moving recordedNotes.  He won't be able to see them move in the table.  The algorithm will move the notes using the best efforts describe above.  If the User wants to see the notes, he must go into beat looping or looping. If beat looping or looping is in effect while the algorithm is working, it should not affect the algorithm, since beat looping of recorded notes is a view of the model, and the algorithm will work on the model, and not emit any events.  As the beats come around during looping, the tickBeat callbacks will pick up the model changes automatically.

## Bend handling

The system already deals with bend notes by not allowing bend notes in the nut, column 0 / fret 0.  This code should be consulted when coding, so the move algorithm doesn't attempt to place bends in column 0, and operates the same way, but doesn't need to call a shared function, just duplicate the behavior.

## Menu structure

The MovePlugin should have the following menu structure.  We define it as we have before, where `s) some caption` means `s` is the trigger, `some caption` is the caption, and the markdown indentation level is the menu nesting child menu items.

`E) Enable` and so on are provided by the Plugin Manager, but are repeated here for clarity.


```
- f) file
  - p) plugins
    - m) move
      - E) Enable
      - A) Apply
      - a) algorithm
        - d) drop
        - o) octave
        - s) string
      - m) motions
        - u) up
        - d) down
        - j) jump up
        - J) Jump down
      - i) include
        - s) single notes
        - t) tiny notes
        - h) highlights
        - p) played notes
        - r) recorded notes 
      - s) show dropped notes
      - c) clear dropped notes     
```

The i) items should all be toggles so that the User sees the values chosen in the menu.  They should all default to false.

We can see that /fpmir toggles doing recordedNotes.  What this implies is that the set of note styles for recorded notes will use s, t, and h as toggled. For not recordedNotes, h doesn't make sense, and is silently ignored. If there are SingleNotes or TinyNotes in both recordedNotes and playedNotes, then the toggle for p and r determine if they are included or not.  

There is no handling of "please do SingleNotes for playedNotes, but do TinyNotes only in recordedNotes".  That use-case is handled by first chosing p) true and s) true, then hitting A) Apply, then coming back in and chosing p) false, r) true, and t) true, s) false, then hitting A) Apply.

There is no feature for restoring or reviving dropped notes.  Users can back up songfiles, or use the graveyard to archive Sections prior to MovePlugin Apply.

`s) show dropped notes` should send the droppedNotes JSON to showMessages JSON so that the messages view is available and the JSON tree.

## Request

Copilot, for Iteration 1, please analyze this Feature sprint "MovePlugin", and point out design holes, coding problems and challenges, and document problems.  Please provide your report in new, empty file: 
`_doco/design/MovePlugin-design-copilot-1.md`

Next Iterations will move toward Implementation Plan, then coding, as Iterations in this sprint.


