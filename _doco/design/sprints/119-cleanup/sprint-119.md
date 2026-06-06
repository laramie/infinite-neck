# sprint-119-cleanup

This sprint is a grab-bag of cleanup and fixes in preparation for the rollout of Version 2. See the discussion in sprints.md.

Specific work alloted to this sprint is broken into Iterations.  See the Iterations sections below.

# Iterations

Here are the work items, grouped by status.

## Complete

- Iteration 1: /ch should also be fullscreen aware.  Weird that it affects fullscreen when not fullscreen, and doesn't hide non-fullscreen. DONE.

- Iteration 2: Track down and supress or replace message: "noteRoot:undefined" Chart>Notes>Chords per instrument.  If no noteRoot found, should just be silent.  DONE.

- Iteration 3: finish the coding of `section-status-vertical-widget` and friends, and sync with `.SongTitleLeadSheet` widget area, probably ditching the hand-coded LooperLight, and Key indicator. 
    - make the title and the looper light be in the same vertical column on the LHS of the Instrument.
    - ensure that the title in vertical mode in the instrument doesn't creep up above the table, leaving a space at the top.
    - Add optional beat counter to looper light. Add "Show LooperLight Beats" after "Piano Width Scale Factor". 
    - See: [119-it3-design.md](119-it3-design.md)
  - DONE

- Iteration 4: clean up ArpeggioPlugin handling of "Clear" and Song Reset, specifically /fpaC.
  - See: [Iteration 4 notes](119-it4.md)
  - DONE


## Active


## Unscheduled

- menu prompt stale sometimes

- chart colors and shadows

- plugin menu capitalizations on triggers inconsistent or unneeded in sub-menus

- palete KEEP, etc. should get a highlight ring so that KEEP is not so unexpected

- default SPACEBAR to looper is getting trapped so you must hit ESC to use it again.

- In all menus, make sure "table" and "Table" are replaced by "Instrument".

- In Chart Notes, you can select tonalResultSet of "Tiny".  Since Tiny follows LeadKey, when you select a LeadKey that is different from RootKey, the noteRoot must be set to LeadKey Root, unless noteRoot is specifically placed in the Section elsewhere.

- In Chart Notes, we need a link next to the TH for "Caption" that toggles "hide"/"show" so you can hide the caption except for the first 10 characters then "...". The Captions get so long they blow out the width of the table.  Wrapping wouldn't help because then the rows would get tall.

- in /fpoa "Refresh" should be "Refresh [section 1]" - DONE

- command line loses LHS tracks when we go into short and one-line.

- If you start /fpa on Piano, then change Instrument to guitar, it retains that its strings range is 1:1. changing instrument should upgrade strings to the number of that instrument's capacity.

- Add menu choices and action to /vmo `o) opacity` to set this: 1) 100% 2) 95% 3) 90% 4) 85% 5) 80% 6) 60%  v) value
```
  .CmdMenuClass {
      opacity: 85%;
```

- Allow navigation limited set in command-line when not in a value edit, to navigate: [,.<>]  Would be cleanest 

- When not in presentation mode and first section has saved DisplayOptions, apply width and height once.  (Otherwise they are never saved or restored.)

- add menu under /vp - view, presentation mode


- DOCO: 
  - I want to:
    - Use the chart to fill in the notes on an instrument: FillPlugin, 
    - Copy the notes from one instrument into another: `L` Listened notes copy
    - Turn the notes from many Sections into chart chords: `rip-through` flow in TonalPlugin