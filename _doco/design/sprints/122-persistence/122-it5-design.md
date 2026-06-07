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


