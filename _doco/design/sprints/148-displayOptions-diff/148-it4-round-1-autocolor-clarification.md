# User:
Quick question before posting answers to all questions: If we don't do any special handling for "Automate AutoColor" then it seems: 
- we still get AutoColor automate-able because AutoColor is one column.
- we have a tiny bit of clunkiness in that AutoColor, AutoColorHighlight, and currentColorDict must be set to automate with three different clicks, but we are OK with that, especially if it means these three columns will do what all the other do.

Is this the extent of that decision, or are there other ramifications?  Since we don't automate/gate automation of  AutoColor now, it seems we would not have migration issues.  Is this true?

# Copilot:
Searched for regex `currentColorDict|function chuseStylesheet|setAutomaticColorUi|cbAutomaticColor"` (`**/{infinite-neck.js,palette-presentation.js,PalettePresentation.js,colorFunctions.js,SongPersistence.js,Song.js}`), 24 results

Searched for regex `setAutomaticColorUi|setAutomaticColorHighlightUi|cbAutomaticColor` (`**/PalettePresentation*.js`), no results

Yes, that is the core of it. Dropping the AutoColor gate means no new stored data and nothing to build for it. Your migration conclusion holds for gates, with one caveat about compaction. There are other ramifications, listed below.

## Confirming your two points

- **One column each:** `autoColor`, `autoColorHighlight` and `currentColorDict` become ordinary columns. They get the same AllowRead/AllowWrite column and cell gates as everything else.
- **Three clicks:** this is the cost. A "Color" group header (Q12) would turn it into one click, if you keep the `group` metadata.

## Other ramifications

1. **Default gate polarity changes.**
   - My Round 1 report (C6, Q5) gave these three keys default-closed gates, the "opt-in" class. Under your decision they are default-open for both read and write, like every other key.
   - Only `sectionTheme` and `NoteDisplaySizes` stay special, through their existing Song checkboxes (Q6).
   - Q5 then largely disappears, and so does the idea of opening the AutoColor column for existing Songs.

2. **`c` and `y` can be captured by SaveDiff.** This is the real cost.
   - Startup sets AutoColor on (infinite-neck.js), so the baseline is `autoColor: true`.
   - Press `c`, then SaveDiff something unrelated like opacity. The live `false` differs from the baseline, so `autoColor: false` is written into the block.
   - `y` has the same problem with `autoColorHighlight`.
   - This is the "macro toggle captured by SaveDiff" gap from Iteration 2, but `c` is much more routine than a Hide macro.
   - Bounding it:
     - Messages will list the keys written.
     - There is an undo snapshot.
     - Clear plus re-save fixes it.
   - Until the Matrix ships there is no UI to close the column. The workaround is to put the checkbox back before saving.
   - I recommend accepting this. It is what "do what the others do" means, and it is still much better than today's Save, which writes everything.

3. **`DISPLAY_OPTIONS_DEFAULTS` grows.**
   - Iteration 2 kept these keys out of the defaults. They now go in, as `autoColor: true` and `autoColorHighlight: false`.
   - `currentColorDict` has no default value. Apply only sets it when it is truthy (infinite-neck.js), and I found no "none" value.
   - So a Section can't store "go back to no dictionary". The only way to undo it is to delete the cell. Acceptable, but worth knowing.

4. **Q13 (reset on Song open) needs an answer.**
   - "Same as the others" suggests all three reset to defaults on Song open.
   - Under sparse apply, the alternative is that a Song with no stored `autoColor` inherits whatever the last Song or session left.
   - If you want `c` to be a per-session preference that survives Song changes, `autoColor` and `autoColorHighlight` must be exempt from the reset.

## Migration

- **Persisted data:** no new fields, and no change to stored `autoColor`, `autoColorHighlight` or `currentColorDict`. Existing blocks keep applying exactly as they do now. The 62 stored `false` and 35 stored `true` values simply stay.
- **What would have caused a migration:** default-closed read gates would have stopped those stored values from applying. Default-open avoids that.
- **Compaction is a behaviour change, not a data migration.**
  - Today every full block pins `autoColor`, so any Section boundary resets it.
  - After compaction prunes later blocks against the cascade, those blocks no longer carry the key. A `c` toggle then survives boundaries until the loop wraps to Section 1.
  - This is the intended design and applies to every pruned key, not just these three. It is still a visible change in existing Songs, so it should be in the migration report.
  - I recommend compaction prune only against prior blocks, as Iteration 1 said, and never prune first blocks against the new defaults. That keeps each Song's Section 1 values.

I haven't changed the report. If you agree, C6 and Q5 should be revised for default-open gates, and the AutoColor gate dropped from the Round 2 scope. I can make that edit when you post your answers.