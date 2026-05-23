# MovePlugin

## Document Version

- This is document version 2, for Iteration 2.
- Iteration 1 is preserved in MovePlugin-design-1.md
- Iteration 1 language is kept in this document in section `## Iteration 1: Design` but is not the original text.  
- Some edits make Iteration 1 worth re-reading rather than refering to version 1.  Specifically, the naming around Highlights is clarified.

# Iteration 1: Design

We want a MovePlugin, similar to the other plugins in ./plugins/ in the repository.

It will function almost like the set of tools available when the User "unlocks" the keyboard actions with `/fu` : "/file/unlock", which transposes the NamedNotes in the current Section only.  These are the transpose keymapped actions `u`,`d`,`U`,`D`,`j`,`J`.  This is a bit different than how to the TransposePlugin operates, but underlying is the same transpose algorithm.

In the plugin, we will map their mostly-equivalent actions to `u`,`d`,`j`,`J` as bang options in the plugin's menu item `m) motions`.  We say 'mostly-equivalent' because they will be functionally very different, but will have the same visual effect to the User.

The programmer-facing documentation terminology and slightly sloppy names around Highlight are simplified in this document: we refer to Note.STYLENUM_MIDIPITCHESSINGLE and Note.STYLENUM_MIDIPITCHES.

Differences from transpose() and TransposePlugin:
- in MovePlugin, the User will select to include PlayedNotes or RecordedNotes, explicitly chosing SingleNote, TinyNote, Highlight and whether to include RecordedNotes.
- NamedNotes will not be moved or available to select.
- Since SingleNotes, TinyNotes, and Note.STYLENUM_MIDIPITCHESSINGLE Notes don't wrap the way NamedNotes automatically do, as we move the notes they will drop off the neck/table left, right, up, and down.  We will handle this with an "algorithm" the User chooses.
- Note.STYLENUM_MIDIPITCHES notes do represent NamedNotes, effectively, since they are bound to a MIDI value, which always resolves to a real note name, such as MIDI 60 === 'C'.  So when moving these, they will automatically wrap correctly.  Therefore it is not possible to wrap them algorithmically, or to "drop" them.  By moving them, they algorithmically increase or decrease their MIDI number, so "octaving" them won't make sense either, as we'll see as we define what "octaving" is for other moved notes.

Note: It is not possible through the UI to have both Note.STYLENUM_MIDIPITCHESSINGLE and Note.STYLENUM_MIDIPITCHES recorded in the same beat.  So we don't need to support adding or transforming one into the other, or worry about one style stepping on the other.

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

# Iteration 2: Design, Clarifications

1) One table at a time.  Arpeggio > Target table has a menu item for selecting this.

2) Collisions. Conceptually, the algorithm should behave as though we have a scratch Section, and all note are moved to the scratch Section, then the scratch Section replaces the playedNotes and recordedNotes in the real Section.  In the event of a moved note landing on a note in the scratch section because of string searches for octave replacements etc., then the candidate note should be dropped, should be added to droppedNotes with a "reason" of "moved note already played".  So the collision is only with a note in the new location as decided by the algorithm so far. 

3) the core move pipeline should live in MovePlugin, not the Song or infinite-neck. It is weird and interactive and not deterministic entirely, so that is why it is being implemented as a plugin.  Plugins have the desired side-effect of keeping strange or complex code out of the core engine.  During initial design, we thought all notes could be moved deterministically, which is why we left stubs.  On review, the strange jumps turned out to be User-preference driven, so it is not deterministic.  We will clean up the song stubs post-sprint.

4) in our understanding, Bends *are* TinyNotes.  Please point out where there is a problem with this simplification in actual code.  A Bend and a Tiny note cannot occupy the same cell.  So two of them sitting in adjacent cells should move "up" fine.  When the algorithm changes string etc., then the cell may be occupied by one or the other, and in that case, the newcomer should be dropped.  

5) To aid in lowering collisions, we should specify that "jump up" starts moving notes on low row index rows, so that cells on these strings are more likely to be available.  Similarly, "jump down" should start on high index rows and process in order of decreasing row index.  The patterns where this helps is where a User has placed notes in a chord pattern on three strings, and "jump up"s them, so the open strings above get occupied, or the open strings below become occupied in "jump down".  This should help in your point "9." along with our comment about "scratch Section" which is equivalent to your "stable snapshot" handling.

6) please explain "a moved note lands on a cell occupied by an ineligible note type that is not being moved in this pass".  To our view, the note types are selected by the menu toggle, and can't step on each other, except for Highlights which we'll deal with separately in this Iteration.

7) We have clarified the naming in this document version by editing Iteration 1 here.  The pertinent edit is: "The programmer-facing documentation terminology and slightly sloppy names around Highlight are simplified in this document: we refer to Note.STYLENUM_MIDIPITCHESSINGLE and Note.STYLENUM_MIDIPITCHES."  With that, the UI only allows recordedNotes persistence of Highlights, and only allows one type per beat, so moving Highlights should not step on other Highlight types.

8) the midinum is the authoritative thing.  It is the only thing that can claim to be algorithmic truth.  The newly placed note should then have noteName recomputed.  colorClass is preserved, unless it is one of the colorClass set that implies function `[note1, note2...]`, in which case it should be recalculated based on the Key of the Section, and the new function of the new cell, User-calculation be damned (if the user incorrectly assigned note1 colorClass to a note that should properly have been note2 if Automatic had been in effect, ignore that and calculate properly). If colorClass is noteTransparent, all should be fine.  If the colorClass is any of the other functions such as noteChromatic or noteColornote, preserve all those values. row and col should be recalculated based on the landing cell.

9) We aren't sure where notes can be persisted that do not have midinum, except for NamedNotes.  So this should not be an issue. If you find cases where this is not true, let us know.  In any event, the action should be drop with reason "malformed note had no midinum".

10) the droppedNote log hangs around until explicitly cleared by the User.  We have included this in the menu in `c) clear dropped notes`  On each Apply, add a record with no "Note" entry, a "algorithm" property, and a "reason": "Move #3 options: {}" where the options in effect are object notation (no double quotes to simplify the JSON, just property names and values dumped in that string, which should be the set of choices excluding "algorithm" such as: "options:{ motions:u, include: [s,t,h,p]}"  without the quotes) and logged in "options" inside that reason, and #3 is the iteration of Apply that is kept and incremented for the life of the Plugin in this session, and thrown away on persistence and zero'd on load.

11) the algorithm should continue all the way to the end, and log any problems to droppedNotes.  If there are cases outside what we have defined above, drop and invent a "reason".

12) with the above rules, we feel that the MovePlugin manipulating the model, but in code completely out of the core is consistent, as long as it does not create duplicates that the core would have a problem with.  We are happy to treat these as MovePlugin bugs, rather than kicking the core to validate, which we don't currently have.  MovePlugin should thus audit each beat it messes with, and each set of playedNotes it messes with.  The real rules would be: no notes of the same styleNum may have the same cell within these. 

13) If utility functions are needed, place them in new shared module `move-helpers.js`

14) not exactly sure about this one, but we like the option "work on a normalized intermediate representation containing tableID, beat, storageKind, and note" and having "beat" be present but empty or some other representation in droppedNotes, and adding any other fields to droppedNotes to simplify coding and be consistent.  The design of droppedNotes object structure should be considered flexible and should support the simplest, safest coding. We don't intend to parse and use droppedNotes algorithmicly, it is just for logging, and would be read by developers and advanced Users in the messages areas.  We don't intend any fancy use-cases such as highlighting of dropped note cells 
for example.

15) You are correct that we should ask for a repaint for playedNotes after motions.  In fact, we have specified motions incorrectly.  We really want them to be bang menu options, and hit Apply automatically and move the notes, then request a repaint.  However, this is best deferred to another sprint, and only Apply does the work.  While we're at it `E) Enable` should be a no-op and could even veto it's toggle, or even veto its presentation as a menu item.  Enable is for plugins to listen to events, and we won't respond to events or make MovePlugin available as a DaCapo handler.  However, we suspect this is too fancy for PluginManager, so for this iteration, a simple ignoring of Enable is fine.  Apply would work whether Enabled or not.

16) currently, /fu then u,d,j,J work on left-handed tunings.  This should be emulated.  The logic should be reversed so that the behavior of NamedNote transposition keyboard shortcuts is emulated.  If this means copying and re-writing the Design document rules, please do that in the Implementation plan.

17) Accepted. This is a good idea: 'the implementation plan should identify one shared predicate or helper for "is bend placement legal".'

18) Apply with no include toggles: no-op with Log one Apply start droppedNote entry as described above, with "reason" including a message about this.

19) default to "octave" as the algorithm, and default its menu toggle to "true".

20) backup.  A reasonable feature would be that on the first time Apply is applied, a graveyard row entry of the current Section is cut.  No other graveyard entries until the User clears droppedNotes, after which any Apply cuts one more graveyard row, then goes quiet again until the next clear.

## Request

Since we have answered so many different areas, Iteration 2 for Copilot should produce an Implementation Plan that has further questions and doesn't intend to resolve everything. It should provide some explanations to areas where we demonstrate in our answers that we don't understand something.  

Please produce your report in the Implementation Plan, with version number 1, expecting that you will produce another revision in version number 2 of that document.  version 1 is this new, empty document for your work: 

`_doco/design/MovePlugin-implementation-plan-1.md`


