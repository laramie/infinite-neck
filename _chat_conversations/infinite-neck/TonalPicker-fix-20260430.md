# TonalPicker-fix-202630

- commit before fix: 551a931b0b00ca4d2dc2eec7f8f4fd8d3cb13489
- commit after fix:

# Scope
- TonalPicker is functional code that implements a set of pickers for chosing chord and mode from arrays emitted by Tonal.js in Chord.detect() and Scale.detect(), which are wrapped by a function in TonalFunction.js .

- TonalPicker is available in a vertical and a horizontal version chosen with a flag.

- TonalPicker emits a pair of pickers (one for chords, one for modes) as a set, which gets an id that makes it unique to owners in the single-page app, and to multiple tableIDs (instruments) and Section ids.

- "Picking" a value in the popup list calls pickTonal() with all the args needed to find the correct picker, and also passes the arrays returned from TonalFunctions.js

- We need a new pair of args, so that the chord and mode can be stored *per table*, in addition to the per-Session storage of Session.chartChord and Session.chartMode.    

- New *per table* values are stored in the SectionNotes object, logically as Session.SectionNotes.chord and Session.SectionNotes.mode, but in code, these are dug out of the dictionaries from the Song sessions array by tableID.  The callers should extract this value from the table in each Section. 

- We also need to implement the behavior that comes with these new properties:

    - the display of the picked value for mode and chord is given by a truth table, below.

    - when these values are picked, they are picked in a Section and tableID context, so the SectionNotes by tableID in that Section should have the .mode and .chord stored.

However, the easiest place to grab this information is in 
`getTonal(theSong, section)`
so the return object from this function should be modified to now contain `.chord` and `.mode` properties.

In section-printer.js, the code does a walk through `instrumentTableIDs.forEach((tableID)....` grabbing sectionNotesByTable, so while not passed in to functions in section-printer.js, the values should be available by the time TonalPicker is created.

- The AllChords builder currently does not have enough args to distinguish for SectionID and tableID, so these will probably need to be added to make sure AllChords arrays aren't building the wrong pickers.

# Guidelines

- The most minimal code should be used.

- This fix should be done with surgical precision.  The code works now, and we just want to use the new values of Session.SectionNotes.mode and Session.SectionNotes.chord. 

- The argument lists of changed calls should have any new parameters at the end so no positional args are changed.

- The style of the current code should be followed.

- No refactoring should take place.  If duplicate code is spotted, or other refactoring opportunities bring it up in the Pre-implementation questions.

- No legacy situations should be coded for.  If a legacy case is spotted, bring it up in the Pre-implementation questions.  For example don't attempt to write code to handle SectionNotes objects that don't have a .chord or a .mode

- Session.chartChord and Session.chartMode (currently Session.mode) are guaranteed to exist on Session instances; do not check for null or undefined. 

# Display truth table of picked value in TonalPicker

This is the table for chord.  There is a matching logical table for mode, which is not shown.

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

# TODO

We'd like Copilot to Create an implementation plan, and emit it in the file: 

`_chat_conversations/infinite-neck/TonalPicker-fix-20260430-copilot-implementation-plan.md`

Please point out code sections to change, and produce any example code snippets in markdown code blocks in that file as part of the plan and conversation.

Please don't implement changes in any other files in this iteration.

We expect there to be gaps in the requests above and would like these and any problems pointed out in this iteration.  Please ask any questions so there are no assumptions or guesses you will have to make in the implementation iteration.

The next step will be to refine the code snippets to actual code to be merged, so any organizational structure in the implementation plan file to assist that iteration is welcome.

Below, for reference, are examples of output of the current code.

# TonalPicker DOM example output

- Here is example code from the browser of a TonalPicker in Vertical orientation for table tblS6_1, Section 0, inside the section-printer from printSectionNotes() 

```
<table class="TonalPickerVert"><tbody><tr><td>
    <span class="tonalPicker" id="tonalPicker-SectionPrinterTonal-chords-tblS6_1-0">
        <span class="tonalPicker-row">
            <button style="padding:0;font-size:60%;" onclick="toggleAllChordsButtonState('SectionPrinterTonal', 'tblS6_1', '0');">┅</button><span style="display:inline;" class="spanTonal_chords_all" id="spanTonal_chords_all-SectionPrinterTonal-tblS6_1-0"><span class="TonalPickerAllChords"><span>Asus24</span><span>E7sus4/A</span><span>B4/A</span></span></span>
            <span class="spanTonal_chords" id="spanTonal_SectionPrinterTonal-chords-tblS6_1-0"><b>Asus24</b></span>
            <button onclick="$('#tonalMode-list-SectionPrinterTonal-chords-tblS6_1-0').toggle()">chords:3</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-SectionPrinterTonal-chords-tblS6_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;chords&quot;, &quot;Asus24&quot;, [&quot;Asus24&quot;,&quot;E7sus4/A&quot;,&quot;B4/A&quot;]);">Asus24</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;chords&quot;, &quot;E7sus4/A&quot;, [&quot;Asus24&quot;,&quot;E7sus4/A&quot;,&quot;B4/A&quot;]);">E7sus4/A</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;chords&quot;, &quot;B4/A&quot;, [&quot;Asus24&quot;,&quot;E7sus4/A&quot;,&quot;B4/A&quot;]);">B4/A</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;,  &quot;tblS6_1&quot;, 0, &quot;chords&quot;, &quot;clear&quot;, [&quot;Asus24&quot;,&quot;E7sus4/A&quot;,&quot;B4/A&quot;]);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td></tr><tr><td>
    <span class="tonalPicker" id="tonalPicker-SectionPrinterTonal-modes-tblS6_1-0">
        <span class="tonalPicker-row">
            
            <span class="spanTonal_modes" id="spanTonal_SectionPrinterTonal-modes-tblS6_1-0"><b>C lydian</b></span>
            <button onclick="$('#tonalMode-list-SectionPrinterTonal-modes-tblS6_1-0').toggle()">modes:2</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-SectionPrinterTonal-modes-tblS6_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;modes&quot;, &quot;C major&quot;, [&quot;C major&quot;,&quot;C lydian&quot;]);">C major</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;modes&quot;, &quot;C lydian&quot;, [&quot;C major&quot;,&quot;C lydian&quot;]);">C lydian</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;,  &quot;tblS6_1&quot;, 0, &quot;modes&quot;, &quot;clear&quot;, [&quot;C major&quot;,&quot;C lydian&quot;]);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td></tr></tbody></table>
```

- Here is example code from the browser for a TonalPicker in Horizontal orientation, same table and Section, inside its destination span, from NoteTableController.

```
<span id="tblS6_1_captionRowTonalInfo" class="captionRowTonalInfo"><table class="TonalPickerHoriz"><tbody><tr><td>
    <span class="tonalPicker" id="tonalPicker-CaptionRowTonal-chords-tblS6_1-0">
        <span class="tonalPicker-row">
            <button style="padding:0;font-size:60%;" onclick="toggleAllChordsButtonState('CaptionRowTonal', 'tblS6_1', '0');">┅</button><span style="display: none;" class="spanTonal_chords_all" id="spanTonal_chords_all-CaptionRowTonal-tblS6_1-0"><span class="TonalPickerAllChords"><span>Asus24</span><span>E7sus4/A</span><span>B4/A</span></span></span>
            <span class="spanTonal_chords" id="spanTonal_CaptionRowTonal-chords-tblS6_1-0"><b>Asus24</b></span>
            <button onclick="$('#tonalMode-list-CaptionRowTonal-chords-tblS6_1-0').toggle()">chords:3</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-CaptionRowTonal-chords-tblS6_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;chords&quot;, &quot;Asus24&quot;, [&quot;Asus24&quot;,&quot;E7sus4/A&quot;,&quot;B4/A&quot;]);">Asus24</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;chords&quot;, &quot;E7sus4/A&quot;, [&quot;Asus24&quot;,&quot;E7sus4/A&quot;,&quot;B4/A&quot;]);">E7sus4/A</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;chords&quot;, &quot;B4/A&quot;, [&quot;Asus24&quot;,&quot;E7sus4/A&quot;,&quot;B4/A&quot;]);">B4/A</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;,  &quot;tblS6_1&quot;, 0, &quot;chords&quot;, &quot;clear&quot;, [&quot;Asus24&quot;,&quot;E7sus4/A&quot;,&quot;B4/A&quot;]);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td><td>
    <span class="tonalPicker" id="tonalPicker-CaptionRowTonal-modes-tblS6_1-0">
        <span class="tonalPicker-row">
            
            <span class="spanTonal_modes" id="spanTonal_CaptionRowTonal-modes-tblS6_1-0"><b>C lydian</b></span>
            <button onclick="$('#tonalMode-list-CaptionRowTonal-modes-tblS6_1-0').toggle()">modes:2</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-CaptionRowTonal-modes-tblS6_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;modes&quot;, &quot;C major&quot;, [&quot;C major&quot;,&quot;C lydian&quot;]);">C major</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblS6_1&quot;, 0, &quot;modes&quot;, &quot;C lydian&quot;, [&quot;C major&quot;,&quot;C lydian&quot;]);">C lydian</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;,  &quot;tblS6_1&quot;, 0, &quot;modes&quot;, &quot;clear&quot;, [&quot;C major&quot;,&quot;C lydian&quot;]);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td></tr></tbody></table></span>

```