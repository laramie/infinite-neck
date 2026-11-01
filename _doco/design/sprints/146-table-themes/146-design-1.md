OK.  Please generate an implementation plan.  Here are some decisions to condense what you have into a chosen plan:

- The 11 hard blocks are all approved as var-driven conversions.

- All 11 of those are really *instrument* properties, so should end up scoped to table.

- Some are padding and borders on things within a cell.  However,  theming a cell is part of the theme for a table, since instrument tables are styled by Users to have exacting spacing for the Instrument, including how all the letters fit in the cells within the instrument.  

So it is part of the motivation that, for example, the Launchpad actually has a diamond smack dab in the middle, so we model it as a single double diamond 100% right, and it appears where it does on the board: in between the four buttons at the middle row spacer intersection (So we could have modeled it with a divider row, but that would have meant teaching the table layout to do arrays of divider rows.)  So instead we model the center spot on the board with a single double diamond on the face, and it looks great.  The double diamond size is cranked up, so it looks like the real Launchpad.  But it can't share a theme with a guitar--the huge double diamond doesn't work on tiny guitar cells.  8x8 tends to use huge cells. The special spacing and look only come when we can theme and displayOptions to a given theme in a given instrument.

We plan to implement this in steps.   The final steps include implementing the product shape:
- There is a default Theme.
- Changing the default Theme affects all Instruments who do not have some specified Theme in effect.
- Each Theme page gets an Instrument picker.   You mash on the Theme button for either a single Instrument, or "default".
- System Highlights will only be read from the default Theme.  These values may exist in the Instruments, but they are ignored for the forseeable time.  I don't think there's enough to make a separate System Theme vars area.  So therefore it is also OK to keep them in any written Theme, just know they are not used, but could be, so better to have simple properties that don't get used rather than code to cull them.
- If you mash on Theme button with an Instrument picked in the picker, then that Theme gets written to the table+Section.  It seems the best place is in the Section Model, on sectionNotesByTable[tableID], but where ever it is stored, it is now the Theme for this Instrument in this Section, and is applicable going forward on this Section until the next saved Theme for this Instrument is encountered, just like Display Options.
- If you clear Themes from the Section for that Instrument, then eventually you get the default Theme when the Instrument has no saved Themes.
- So the order is default Theme ==> Theme per Instrument, stored in Section 1 or earlier than current Section ==> Theme per Instrument, stored in subsequent or current Section.

More bells-and-whistles come later, in what we described as "final steps" above.  Many of those are out of scope.

Before that shape is all in place, we'd like the implementation plan to provide for getting us to the next steps: 

- Migrate all to var-driven conversions
- Include everything as a Theme that can be attached to default or an Instrument/Table.
- Even the 3 System Highlight values ride along with this group. They are to be written and read like all the other vars.
- Current code that evaluates the 3 System Highlights should somehow continue to operate on the "default Theme", since that's what it does today.  In other words, ignore the H1, H2, H3 specification of a *table* when setting these Highlights, as it does today.
- Have a picker that lets us choose Instrument/TableID.  On change it picks up the per-table values.  On mashing on Theme it writes to the Table+Section.
- Let us see the persistable shape via `/vdf`

Next steps would be to get the display of the Instrument following its calculated Theme.  Goal would be two Instruments with different Themes displaying on the same page.  We can verify this in UI testing.  If this step can be delivered in the first coding round, great, otherwise we'll test the file/memory dump format and the Instrument dropdown on the theme page.

Please point out any other decisions we need to make prior to coding.