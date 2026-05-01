# TonalPicker-fix-202630

- commit before fix:
- commit after fix:

# Scope
- TonalPicker is functional code that implements a set of pickers for chosing chord and mode from arrays emitted by Tonal.js in Chord.detect and Scale.detect, which are wrapped by a function in TonalFunction.js .

- TonalPicker is available in a vertical and a horizontal version chosen with a flag.

- TonalPicker emits a pair of pickers (one for chords, one for modes) as a set, which gets an id that makes it unique to owners in the single-page app, and to multiple tableIDs (instruments) and Section ids.

- "Picking" a value in the popup list calls pickTonal() with all the args needed to find the correct picker, and also passes the arrays returned from TonalFunctions.js

- We need a new pair of args, so that the chord and mode can be stored *per table*, in addition to the per-Session storage of Session.chartChord and Session.chartMode (currently Session.mode).  Session.mode should be changed to Session.chartMode.  New *per table* values are stored in the SectionNotes object, logically as Session.SectionNotes.chord and Session.SectionNotes.mode, but in code, these are dug out of the dictionaries from the Song sessions array by tableID.  The callers should extract this value from the table in each Section.  

However, the easiest place to grab this information is in 
`getTonal(theSong, section)`
so the return object from this function should now contain chord and mode.

In section-printer.js, the code does a walk through `instrumentTableIDs.forEach((tableID)....` grabbing sectionNotesByTable, so while not passed in to functions in section-printer.js, the values should be available by the time TonalPicker is created.

- The AllChords builder currently does not have enough args to distinguish for SectionID and tableID, so these will probably need to be added to make sure AllChords arrays aren't building the wrong pickers.

# Guidelines

- The most minimal code should be used.

- This fix should be done with surgical precision.  The code works now, and we just want to change Session.mode to Session.chartMode, and to use the new values of Session.SectionNotes.mode and Session.SectionNotes.chord.

- The argument lists of changed calls should have any new parameters at the end so no positional args are changed.

- The style of the current code should be followed.

- No refactoring should take place.  If duplicate code is spotted, or other refactoring opportunities bring it up in the Pre-implementation questions.

- No legacy situations should be coded for.  If a legacy case is spotted, bring it up in the Pre-implementation questions.

- Session.chartChord and Session.chartMode (currently Session.mode) are guaranteed to exist on Session instances; do not check for null or undefined. 

# Display truth table of picked value in TonalPicker

This is the table for chord.  There is a matching logical table for mode, not shown.

 |                                                        | Value in Section.chartChord | Empty string in Section.chartChord |
 | Same value in section[tableID].SectionNotes.chord      |  <b>value</b>               |  value       |
 | Different value in section[tableID].SectionNotes.chord |  <s>value</b>               |  value (n/a) |
 | Empty value in    section[tableID].SectionNotes.chord  |  &lt;choose&gt;             |  &lt;choose&gt; |

# Call Locations

This is the call during NoteTableController.js::colorNote()

```
export function colorNote(cell) {
    let res = {returnCause: Cause.ERROR};
    try {
        res = colorNoteInner(cell);
    } finally {
        EventBus.trigger('Note:colored', {
            sourceTableID: res.tableID,
            colorNoteResult: res
        });

        let theCurrentSection = getCurrentSection();

        let idx = getSong().sections.indexOf(theCurrentSection);
        let tonalResult = getTonalForTable(getSong(), theCurrentSection, res.tableID);

        let tonalPickerSet = buildTonalPickerSet("CaptionRowTonal", TonalPickerOrientation.HORIZONTAL, 
                                                 res.tableID, idx, 
                                                 tonalResult.chords, theCurrentSection.chartChord, 
                                                 tonalResult.scale,  theCurrentSection.mode);
        
        $('#'+res.tableID+'_captionRowTonalInfo').html(tonalPickerSet); //"_captionRowTonalInfo" from TableBuilder
    }
}
```

This is the beginning of the call in NoteTableController.js::replayTable(). After this the code needs no changes.

```

export function replayTable(replayOptions){
    if (replayOptions.type === ReplayOptions.Type.SELF){
        let idx = getSong().sections.indexOf(getCurrentSection());
        let tonalResult = getTonalForTable(getSong(), replayOptions.currSection, replayOptions.listenToTablename);
        let chords = tonalResult.chords;
        let tonalPickerSet = buildTonalPickerSet("CaptionRowTonal", TonalPickerOrientation.HORIZONTAL, 
                                                 replayOptions.listenToTablename, idx, 
                                                 tonalResult.chords, replayOptions.currSection.chartChord, 
                                                 tonalResult.scale,  replayOptions.currSection.mode);
        $('#'+replayOptions.listenToTablename+'_captionRowTonalInfo').html(tonalPickerSet);
    }
    // END changes
    // ......
```

This is the code point in `section-printer.js::printSectionsNotes(theSong, theSections)`

```
 let tonalResult = getTonalForTable(theSong, section, tableID);
            let chartChordsNotes = tonalResult.normalizedNamedNotes.join(',');
            let tonalPickerSet = buildTonalPickerSet("SectionPrinterTonal", TonalPickerOrientation.VERTICAL, 
                                                        tableID, idx, 
                                                        tonalResult.chords, section.chartChord, 
                                                        tonalResult.scale,  section.mode);
            result += "<td><div class='SPN_CC'>" 
                            +chartChordsNotes+':'
                            +tonalPickerSet
                            +"</div></td>";

```

# Pre-implementation Questions

# Implementation Notes