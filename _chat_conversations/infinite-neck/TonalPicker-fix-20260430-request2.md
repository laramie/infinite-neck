Thank you for your thoughtful and thorough response.
To keep the conversation linear, we are responding in this document,
`_chat_conversations/infinite-neck/TonalPicker-fix-20260430-request2.md`
and leaving 
`_chat_conversations/infinite-neck/TonalPicker-fix-20260430.md`
as is, complete with errors, which we'll correct below.
Similarly, we are not modifying your response `_chat_conversations/infinite-neck/TonalPicker-fix-20260430-copilot-implementation-plan.md` so please leave that file unchanged now.
Please place your next response in 
`_chat_conversations/infinite-neck/TonalPicker-fix-20260430-copilot-implementation-plan-response2.md`

# Error Corrections

- The correct properties are
Section
   .chartChord
   .chartMode

SectionNotes
    .chord
    .mode

Or, in your framing: 
    - section-level: `chartChord` and `chartMode`
    - per-table SectionNotes: `chord` and `mode`    

# Questions Answered

- The behavior on pickTonal() should be a bit more subtle than (incorrectly) described in our first request.  Here is the full picture.

    - When the user picks a value, that value should be written to the table SectionNotes .chord or .mode location.

    - When the user picks a value, if the Section value is empty, as passed in (don't attempt to access the model from picker code), then the Section value should be written.  This will have to be by call to infinite-neck.js through these:

        - `linkToSectionChartChord(idx, chartChord)`
        - `linkToSectionChartMode(idx, chartMode)`

    - But if the Section value is not empty, do not call one of those functions.  Instead, just update the value by leaving it set in the picker current value span, and the Table value in SectionNotes. It would logically then be strikethrough or bold depending on how it matches the value from Section. Then call the new functions imported into tonalPicker.js and added to infinite-neck.js:

        - `linkToSectionTableChord()`
        - `linkToSectionTableModel()`
    

    - We neglected to describe the next sprint's feature, which is a button next to the picker-pop-up button called "save to chart".  We are promoting implementing that button to this sprint so that we can get the storage logic right.  So the user flow will be to use the picker to select the value, and assume that the value will set both the Table level value and the Section value, (which appears on the Chart, since the Chart only tracks one chord and one mode, even though multiple instruments/tables may and do play in one Section).  But the user can also expect that if he has done this once for tblS6_1, if he then choses a value for tblBass4_1, that the Section Chart won't be overwritten.  The Bass player  (either another user or the same user wearing a Bass player role) needs to see his chord and mode in his horizontal TonalPicker in the subcaption above his table/instrument, but the band leader (user in role of being responsible for all instruments), who must read the Chart, should only have one chord and mode, because the Standard Tuning 6-string guitar (tblS6_1) was the first to choose the chord and mode when inputting the song.  If the band leader, on seeing the bass part, decides to use the chord or mode from that instrument, he will click on the "save to chart" button in the PrintSectionNotes page or in the Bass player's instrument.  Since we aren't storing who set the Section value, on a second pick, the same behavior would apply: don't overwrite Section value.

    - In addition to the logic above, please implement outputing the new "save to chart" button, and wire it to calling the appropriate link functions.

    - an implementation detail: even though we will eventually move to sending messages around with our EventBus, you may assume that SectionChange causes pickers to be rebuilt every time.  Pickers are not backed by ES6 class instances or objects with data.  The Song/Section/SectionNotes data model layer is kept updated by infinite-neck.js and NoteTableController.  The visibility state of the AllChords element is kept on window.  So this may be considered to be TonalPicker state.  That's why we pass around the value arrays, so that model data (other than window.tonalChordsButtonStates) is not touched directly by TonalPicker.

    - In answer to window.tonalChordsButtonStates being only table specific, the idea was that when a user clicks the button to hide/show the AllChords, it would affect all instances.  We may not have the class DOM broadcast perfect on this, but that is the intention, and is implemented curretly for sectionChanged which rebuilds TonalPickers.  So when a user hides the AllChords display for tblS6_1, on the next sectionChanged message, all tblS6_1 Section rows in the table kicked out by `section-printer::printSectionsNotes(theSong, theSections)` are updated. So we want to preserve that behavior. If there is overbroad concern, it is that the AllChords array must not be set with values from another table or Section.  That is a separate concern, that to our eyes looks like it is handled by the destination for the display being keyed by the span returned by format_allChordsSpan() but that should be checked.   So: 4. For the AllChords show/hide state, should the state remain shared per `tableID`, or should it become unique per picker instance using `ownerID + tableID + sectionIdx`? YES: shared per `tableID`.

    - In answer to whether getTonal() should match getTonalForTable(), yes, please update getTonal() to return the same shaped object. So: 2. Should `getTonalForTable()` also be extended to return `.chord` and `.mode`, in addition to `getTonal()`? YES.

    - Point 3. is valid, and is not considered a "refactor", but a welcome code simplification, so please do this:
       "3. centralize the picker display logic into one helper that applies the truth table for chords and modes"

# Summary

- Since this was a lot of new specification, please validate our responses with the plan you are working on, and let us know of any still-missing information, or new problems introduced!

- For this next iteration, please format your detailed implementation plan and any new questions in 
`_chat_conversations/infinite-neck/TonalPicker-fix-20260430-copilot-implementation-plan-response2.md`

- still no repository code changes this iteration.

Thanks!