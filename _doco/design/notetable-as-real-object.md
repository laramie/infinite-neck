# Moving Towards NoteTable as first-class object

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


