# sprint-119-cleanup

This sprint is a grab-bag of cleanup and fixes in preparation for the rollout of Version 2. See the discussion in sprints.md.

Specific work alloted to this sprint is broken into Iterations.  See the Iterations sections below.

# Iterations

Here are the work items, grouped by status.

## Complete

- Iteration 1: /ch should also be fullscreen aware.  Weird that it affects fullscreen when not fullscreen, and doesn't hide non-fullscreen. DONE.

- Iteration 2: Track down and supress or replace message: "noteRoot:undefined" Chart>Notes>Chords per instrument.  If no noteRoot found, should just be silent.  DONE.

## Active

- Iteration 3: finish the coding of `section-status-vertical-widget` and friends, and sync with `.SongTitleLeadSheet` widget area, probably ditching the hand-coded LooperLight, and Key indicator. 
    - make the title and the looper light be in the same vertical column on the LHS of the Instrument.
    - ensure that the title in vertical mode in the instrument doesn't creep up above the table, leaving a space at the top.
    - Add optional beat counter to looper light. Add "Show LooperLight Beats" after "Piano Width Scale Factor". 
    - See: [119-it3-design.md](119-it3-design.md)

## Unscheduled

- menu prompt stale sometimes

- chart colors and shadows

- plugin menu capitalizations on triggers inconsistent or unneeded in sub-menus

- palete KEEP, etc. should get a highlight ring so that KEEP is not so unexpected

- default SPACEBAR to looper is getting trapped so you must hit ESC to use it again.

- In all menus, make sure "table" and "Table" are replaced by "Instrument". 


