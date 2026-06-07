# sprint-122-persistence Iteration 5 visibleNoteTables

See: 
  - [sprint-122.md](sprint-122.md)
  - [persistence matrix](122-persistence-matrix.md)
  - [Copilor report on pre-sprint state](122-it5-report.md)
  - [Iteraion 5 implementation plan](122-it5-implementation-plan.md)

## Round 1: Define TODO

It is possible to orphan SectionNotes by table, since you are allowed to X a table in "Tunings in Song". 
  - this should be changed so that the X is grayed if there are SectionNotes
  - so you must go into Section Drawer and delete Sections until they are gone.
  - this puts them in the Graveyard
  - so you must have a flow available to revive Sections to a *different* table. This is deferred for this sprint.  
    - When we get around to it, we'd include the following notes: Presumably the same Lineage.  If you messed up and want to move it to a different tuning, you could revive to a new instrument of the same Lineage, then use MIDI paste between that instrument and the alternate tuning table you want.

## Round 2: Define Changes 

- On "Tunings" > "Tunings in Song" tab, disable "X" in column "Move" when value in column "InMem" is not blank anda greater than zero.  This will prevent orphaned table data.  It will be up to the User to optionally copy/backup/move them using Clip or the Graveyard, then delete all Sections from that table.

- Let User X out any table that has zero/blank InMem.

- Let User uncheck the visible box.  This simply hides the table from layout.  Notes are preserved for tables in SectionNotes regardless of View.  This is how we want it.

- There is a hidden use-case that we want to preserve.  Since Tunings in  "Tunings Library" can't be instantiated without Clone, they never get SectionNotes by their baseID.  So if a User has somehow deleted a view Instrument, they can rewire it to that table data by naming a new Clone of the right Lineage to the ID seen in `/vdf`.  We can do this now, and would want to be able to continue doing it.  However, after this sprint, it should no longer be necessary, since we are going to disallow X-ing out an Instrument that has notes InMem.

- Make Song.visibleNoteTables the definitive storage and source of truth.

- Song.visibleNoteTables does preserve order, and that order should be the order in "Tunings in Song" as it is today.  The up/down arrows in the Move column should rely on this.  If they are instead relying on the DOM, this should be changed.

- `tuning.visible` is derived runtime convenience only, or removed.  It is in tunings.js where all records are `"visible": false`.  This is an artifact, and doesn't matter.  What matters is when this is constructed, and in memory, that it is toggled and consulted.  That should cease, and Song.visibleNoteTables should be used instead.

- `prepareForSave()` calls `removeUnusedTablesFromMemoryModel()`.  This is fine: it doesn't unwire anything, just reclaims storage where there are no notes.  This is mosltyl obviated, because cleanup also happens elsewhere on delting notes.  We keep it on song save, and we have a command-line menu for it for development in `/far`

- So making a table disappear from layout with the checkbox should update Song.visibleNoteTables, but not remove and table data in SectionNotes in the Sections.  And the Instrument should continue to live as a row in "Tunings in Song", so it can be turned on again, which writes to Song.visibleNoteTables.  The "Tunings in Song" therefore, should get this info from Song.visibleNoteTables, and truth should stop being stored in the DOM.  We want to be a little careful not to just rebuild the Tunings tables all the time, however, as these have real code impacts, cause a lot of event noise, and are a performance hit.  So the checkmark View update should be more granular.

- Today, the User can set up a P46 guitar, put in some NamedNotes, and some recordedNotes SingleNotes, and wire a second P46 Guitar to the first in Listener mode.  He can hide the first, and even X out the first, and the Listener keeps displaying notes and also when looping.  On song reload, only the second guitar is visible, but happily displays notes it is listening to.  This is all correct, except that we'll prevent them from X-ing out the View table in this sprint.  But the behavior of un-viewable table data being totally valid is desireable.  They will be prevented from getting into that situation with the X/InMem rule, and in a situation that slips through the cracks, they can repair by Clone of a new instrument and setting its ID.

- There is no flow in this sprint for worrying about Graveyard records that reference missing tables.

## Round 3 visibleNoteTables REDO

Invisible Tunings still appear in "Tunings in Song".  That is how you get them back, by clicking on the checkbox.  They retain their order and full column display.  It's just that they disappear from layout as Instrument/Tuning note tables.

So...we actually need `visibleNoteTables REDO!  Because visibleNoteTables can't store these data.

### visibleNoteTables REDO

Since the DOM is no longer the source of truth, we need to make visibleNoteTables smarter, so that "Tunings in Song" can be rebuilt perfectly with rows that have unchecked visibility.  This means we need a structure like this instead: 

  ```
  "visibleNoteTables": [
    "tblP46_2": {visible:true},
    "tblDADGAD_1": {visible:true},
    "tblBass4_1": {visible:false}
  ]
  ```
  This is not valid Javascript, and seems a bit wonky with 'visible' written twice. So instead, let it be: 
  ```
  "noteTablesLayout": [
    {tablename: "tblP46_2", visible:true},
    {tablename: "tblDADGAD_1", visible:true},
    {tablename: "tblBass4_1", visible:true}
  ]
  ```
  We presume this is better than a dictionary because this is guaranteed to preserve order.
  This struct will be useful for future un-scheduled sprints that will deal with whether tables are layed out in the main div, or floated.

  The remainder of this document is now a restating of the above specs, and answers to the question in the implementation plan **with the new name and struct Song.noteTablesLayout**, replaceing the existing, and now obviated struct Song.visibleNoteTables.


### Restatement of above specs with Song.noteTablesLayout

- Definition: "ghost" tables: model, but no view.  Valid and preserved.

- New storage: Song.noteTablesLayout, as defined above.

- On "Tunings" > "Tunings in Song" tab, disable "X" in column "Move" when value in column "InMem" is not blank and greater than zero.  This will prevent orphaned table data.  It will be up to the User to optionally copy/backup/move them using Clip or the Graveyard, then delete all Sections from that table.

- Let User X out any table that has zero/blank InMem.

- Let User uncheck the visible box.  This simply hides the table from layout.  To achieve this, set `Song.noteTablesLayout["tblP46_1"]`.visible`.

- Notes are preserved for tables in SectionNotes regardless of View.  This is how we want it.

- Preserve ghost tables.

- Make Song.noteTablesLayout the definitive storage and source of truth.

- Song.noteTablesLayout does preserve order, and that order should be the order in "Tunings in Song" as it is today.  The up/down arrows in the Move column should rely on this.  If they are instead relying on the DOM, this should be changed.

- `tuning.visible` is removed.  It is in tunings.js where all records are `"visible": false`.  This is an artifact, and should go away.  What matters is when this is constructed, and in memory, that it is toggled and consulted.  That should cease, and Song.noteTablesLayout should be used instead.

- `prepareForSave()` calls `removeUnusedTablesFromMemoryModel()`.  This is fine: it doesn't unwire anything, just reclaims storage where there are no notes.  This is mosltyl obviated, because cleanup also happens elsewhere on delting notes.  We keep it on song save, and we have a command-line menu for it for development in `/far`

- So making a table disappear from layout with the checkbox should update Song.noteTablesLayout, but not remove and table data in SectionNotes in the Sections.  And the Instrument should continue to live as a row in "Tunings in Song", so it can be turned on again, which writes to `Song.noteTablesLayout[table].visible` .  The "Tunings in Song" therefore, should get this info from Song.noteTablesLayout, and truth should stop being stored in the DOM.  We want to be a little careful not to just rebuild the Tunings tables all the time, however, as these have real code impacts, cause a lot of event noise, and are a performance hit.  So the checkmark View update should be more granular.

- Today, the User can set up a P46 guitar, put in some NamedNotes, and some recordedNotes SingleNotes, and wire a second P46 Guitar to the first in Listener mode.  He can hide the first, and even X out the first, and the Listener keeps displaying notes and also when looping.  On song reload, only the second guitar is visible, but happily displays notes it is listening to.  This is all correct, except that we'll prevent them from X-ing out the View table in this sprint.  But the behavior of un-viewable table data being totally valid is desireable.  They will be prevented from getting into that situation with the X/InMem rule, and in a situation that slips through the cracks, they can repair by Clone of a new instrument and setting its ID.

- There is no flow in this sprint for worrying about Graveyard records that reference missing tables.

### implementation plan questions answered

An interesting point is brought up by what to display in Wirings when a table is no longer viewable by a Song.noteTablesLayout.  Today, everything works, except that you can't re-wire to an invisible table.  Fixing this one thing in the UI for Wirings means everything works with "ghost" tables: model, but no view.  We don't think we need any UX for this, because Chart > Notes shows all tables with notes, so the User has a full UI for seeing that there are ghost tables.  Helpfile will mention how to repair, and the UI should prevent that from happening post-sprint.  But we do need to now make the Wiring builder include ghost tables in the picker.  It may make sense to add a central helper to Song to surface this.

If a ghost table is found on song load, use showMessages to inform the User.  Otherwise allow it so it can participate as described above.
Message:
```
  Tunings without views found in song:<br>
    "tblP46_1",  ID: "P46_1",  Lineage("from"): ${fromBaseID}<br>
    "tblP6_2",  ID : "P6_2",   Lineage("from"): ${fromBaseID}<br>
  These will continue to be accessible to Observers and Listeners through the Wiring page, and their Sections and Notes are visible in "Chart | Notes".<br>
  If you wish to attach a visible instrument to this Tuning, Clone a Tuning with a baseID equal to Lineage("from") and set its ID to the ID shown.
```   

X Gating
  - The InMem is from a function, and it results in an empty table cell today, not a zero.  So blank/whitespace for InMem or null/undefined in the underlying dictionary, would constitute a gate condition for X. 
  - If X is gated, it should simply be grayed out, with a help tip `title` of `Delete Sections/Notes first`.

Even though we say we don't support legacy songs, this change turns all our songs immediately into legacy songs. Therefore, on song load, perform update to new schema field.  Allow old field to be valid in schema.  Update writing songfile version as "V2.1".  Ensure that "V2" handlers will read "V2.1" as a valid field and a valid "V2" songfile.  Map as:

Existing songfile allowed in schema:
```
  "visibleNoteTables": [
    "tblP46_2",
    "tblDADGAD_1",
    "tblBass4_1"
  ]
  ```
  In memory after load, and format on every file save:
  ```
  "noteTablesLayout": [
    {tablename: "tblP46_2", visible:true},
    {tablename: "tblDADGAD_1", visible:true},
    {tablename: "tblBass4_1", visible:true}
  ]
  ```
  So just pull all tables in and make them `visible:true`.


## Answers to specific questions:

1. InMem definition for X gating:
- Is InMem strictly "count of sectionNotesByTable entries with non-empty notes across all sections", or a broader count including derived/legacy note containers? 
- ANSWER: Not sure what this means, but we generally don't support legacy songfiles, and certainly no formats pre-V2.  Listeners and Observers should not count towards table-owned notes.  Plugin-owned notes do count, so ArpeggioPlugin creates Note.owner:"ArpeggioPlugin" and these should survive round-trip as they do today, and should be counted towards InMem.  If a User wants to clear them the proper way is through `/fpaC` and similar friends for other plugins.

2. X-button UX when blocked:
- Disable only, or disable + tooltip/message/`title` explaining "Delete Sections/Notes first"?
- ANSWER: Yes, as edited here.

3. Invalid visibleNoteTables policy on load:
- Keep valid subset and warn?
- If subset is empty but song has myTunings, should fallback be first song tuning, previous default table ID, or no visible tables?
- ANSWER: No visible tables.  There is already a message for when no Tunings are visible.  If no views exist, see showMessages case above. 

4. Ordering source of truth details:
- If a tuning exists in myTunings but missing from visibleNoteTables, should it appear in "Tunings in Song" list as hidden append, or not appear until manually added?
- ANSWER:  When a Tuning is hidden due to the checkbox, it is the User's pref to simply not show the table, but it is not a ghost table.  So show the "Tunings in Song" in full order. To do this, use new struct `Song.noteTablesLayout`. 

5. Hidden-table participation policy:
- Should hidden tables remain selectable in wiring source/target pickers, or should pickers remain "visible-only"?
- Current behavior appears mixed; design decision required for consistency.
- ANSWER: Treat them as full citizens in the Model.  Specifically, allow them to populate Wiring selects, pickers, and validation rules. 

6. Rename handling and ID repair:
- Confirm that rename continues to update visibleNoteTables and sectionNotesByTable references atomically.
- ANSWER: Yes.  This has been the biggest buggaboo for truly orphanining objects.  We need to chase down renames well. 
- Confirm whether preserving manual ID-repair workflow is still required as an explicit supported behavior.
- ANSWER: Yes.  Support the ability to name a Tuning to a name that exists as a ghost table, but not as a visible or hidden existing Tuning. 

7. Event/performance constraints:
- Approve requirement that visibility checkbox updates must be granular (no full table reinstall unless necessary).
- ANSWER: Yes. 

8. Schema strictness:
- Should visibleNoteTables be required in V2 schema formally, or remain optional with strict validator enforcement only?
- ANSWER: No.  Allow them to be optional, read them and transform them as discussed above, and now require Song.noteTablesLayout and ensure that even empty Song.noteTablesLayout array exists.

## Round 4: coding approved

The implementation plan is CORE-APPROVED with the following answers: 

### answers to specific questions


1. noteTablesLayout canonical key naming:
- Confirm field key is exactly tablename (not tableName/tableID).
- ANSWER: Name for field in Song.noteTablesLayout is `tableID`.  A search showed `tableID = ${Constants.TABLE_ID_PREFIX}${tuning.baseID}` to be more prevalent, even though replay() uses tablename.  Let it be `tableID`.


2. Dual-field precedence when both are present:
- Confirm noteTablesLayout always wins and visibleNoteTables is ignored.
- ANSWER: YES.

3. Ghost load messaging behavior:
- Confirm message shows once per load event (not repeated by redraw/reinstall events).
- ANSWER: Yes, once per load only. 

4. Save payload coexistence policy:
- Confirm whether to omit visibleNoteTables entirely on V2.1 writes, or optionally keep it as redundant compatibility field.
- ANSWER: omit visibleNoteTables entirely on V2.1 writes.  After this we will rip through the songs and migrate the good ones as part of sprint-121-songs . 






