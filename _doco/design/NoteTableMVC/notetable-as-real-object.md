# Moving Towards NoteTable as first-class object

## Document Version
- version: V2

## Discussion

- `notetable.js` currently manages *all* tables in `#tabledest`, which is the div container that contains everything visible and playing.  We want to move to `#tabledest` being managed by a `Layout` that knows which instruments are in it and handles CSS layouts. 
- An "instrument" is a `NoteTable`: it has a `Tuning`, and a `baseID`, _(also a `caption`)_, and displays its `baseID` as:
    + **P46_Laramie** or just **Laramie**
    +  **Willy** would be an S6
    + **Jimmy** would be an S6 Left-Handed.
    + **James** would be a `USER` tuning with `MIDI` notes following the S6 `MIDI` notes, plus custom `BN` (**B**_anjo_ **N**_ut_) values for Capo tunings.  
    + **Duane** would be an S6.  But **Duane**'s track would mostly show `TinyNote` values, which follow `Section` property `leadKey`. While  **Dickey**'s track mostly uses `SingleNote`  which follow `rootKey`.  _(It may be desirable to add `followLeadKey` as a `Tuning` property, such that all Notes in this Tuning follow the `Section.leadKey`.)_
- Additionally, we want to support look-ahead and look-behind Observer NoteTable objects which reference NoteTable.relativeSection.  Each instrument, a real, new, `NoteTable` object, will own:

    + Which Tuning it is
        + `myTunings :: {baseInstrument:"S6",baseID:"Willy"}`

    + Which Section it is observing

        + `relativeSection="^2"`

        + `relativeSection="" ===> CurrentSection`

- Observer NoteTable objects will:
    + be a special subclass that only views other relative Sections.
    + can follow relativeSection="0" which means CurrentSection.
    + be read-only, that is, no click handlers for cell.  
    + have a properties showPrevBeat and showNextBeat such that the Observed Section's Next and Prev beats are played and captured and shown in the observer.  
    + These played and captured notes should be calculated, and not persisted.  In fact, no notes should be persisted in Observer NoteTable.
    + showPrevBeat and showNextBeat are exclusive.  Only one shows.  They can both be true, but the `Layout` should ask the `Section` whether the `relativeSection` is following or preceding the `CurrentSection`, and then choose whether to display showing the prev or next.

- Listener NoteTable objects will:
    + have their own Tuning
    + listen to Notes played on another Instrument(NoteTable) in this Section, and transform the notes via MIDI position.  
    + example: an S6 Tuning "listens" to a P46 Tuning
    + listen to all Note types and Beats in RecordedNotes.
    + follow the same Looper and RecordedNotes.     

- For each Section, the `Layout` may change, including which instruments are showing, just like a real score. To implement this, the `Layout` would know which Sections it is showing, and chose the right layout, instruments showing, including Observer and Listener instruments. Section should not know about `Layout` or `Observer`.

## Current Architecture

- See [class diagram](class-diagram.md)
- See [class diagram(actual)](class-diagram-actual-vs-expected.md)

- Call flow: 
```js
    table-builder.js :: showTuningsForTablesInFile
        getSong().visibleNoteTables.forEach(visTableID => {
            ....
            requestReinstallAllTuningsTables();
            showTuning(visbasekey);
```


- ALL controls on the tunings (table-builder) page request the reinstall:

```js
          $('#frmTunings .checkboxLH').change(function ()
            {requestReinstallAllTuningsTables
```

- Then eventually this gets called in `infinite-neck.js`: 

```js
    export function reinstallAllTuningsTables(){
        var target = $("#tabledest");
        target.empty();
        installAllTuningsTables();
        installTDNoteClick();
        installBtnHamburgerClicks();
        clearAll();
        resetNoteNames();
        TableBuilder.showHideTunings();
	}
```

```
    table-builder.js :: showHideTunings ==>
        showHideTuning ==>
            var tuning = findTuningForID(basekey);
            if (tuning) {
                tuning.visible = show;
```
- That's it.  The tuning has already been built in `requestReinstallAllTuningsTables()`  and now we just show it.   
## Fixes before refactor
- Note that showTuningsForTablesInFile() calls both
```js
    requestReinstallAllTuningsTables();
    showTuning(visbasekey);
```

- within the inner loop, so requestReinstallAllTuningsTables is called way too many times!

## Document Updates
- This current document is the driving design document maintained by the Developer.

- This section will be incorporated into document which is managed by Copilot, and which has valuable design decisions and specifications created by Copilot in previous iterations.  It is to be updated with a goal of preserving existing structure, references, and classes, unless these become obviated.  Then Copilot should update the document: 

    + [Copilot-manged design document](notetable-as-real-object-planning.md)
    + Let this Copilot managed document now specify the Version number V2, in the H2 section at the top called "Document Version", currently on V1.


### New Requirements and Rules for V2

1. The NoteTable class should now have a NoteTableView View class responsible for emitting HTML.  Unclear which class is the controller right now.

2. The Layout class should be spilt into the following classes:
    a. a LayoutManager class
        + responsible for maintinging a list of Layout.ID values used anywhere in the Song in memory (and therefore in persistence in the song file).        
        + Maps between Section index and which Layout class to hand back (probably to itself most of the time, except for reporting)

        
    b. a Layout class

        + has an ID property (string), with examples:
            + "FullBand"
            + "Guitars"
            + "Solo"
            " "DrumNBass"
            + "WillyPractice"

        + Knows which named Responsive CSS layout will be used.  Stored in the property Layout.responsivePattern, which will become a class to specify all the things a pattern would need: left/right/flow, NoteTable order, orientation.

        + Knows which NoteTable objects will be included and visible.    

        + emits blocks of HTML emitted by NoteTableView into DIV elements within the Layout.responsivePattern chosen, e.g. "Table" "Flow", and other CSS standard Responsive Web Design patterns.         


    c. NoteTableView class

        + View class for NoteTable

        + emits HTML from NoteTable when asked to repaint().

3. ListenerNoteTable now a role, not a class

- The class ListenerNoteTable is no longer a class. It is now a role, caled Listener, perhaps just specified with a property.  Either a regular NoteTable or an ObserverNoteTable will be able to "Listen" to other NoteTable object *within the same section*.  

- Rule: no Listener may specify any Section other than the CurrentSection.          



