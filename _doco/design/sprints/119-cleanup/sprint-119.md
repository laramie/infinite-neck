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
  - specific bug introduced by command-line one-line is FIXED.  
  - CLOSED. Keep an eye out for other use-cases, such as in Plugins.

- chart colors and shadows
  - DEFERRED.  Looks good for now.

- plugin menu capitalizations on triggers inconsistent or unneeded in sub-menus

- palete KEEP, etc. should get a highlight ring so that KEEP is not so unexpected

- default spacebar to looper is getting trapped so you must hit ESC to use it again.
  - CLOSED. Can't replicate.

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

- add verb under Clip to "Copy all Listened notes in song into this Listening/wired instrument"

- Make Find Color work for other Note types than just NamedNote.

- DOCO: 
  - I want to:
    - Use the chart to fill in the notes on an instrument: FillPlugin, 
    - Copy the notes from one instrument into another: `L` Listened notes copy
    - Turn the notes from many Sections into chart chords: `rip-through` flow in TonalPlugin
    - how do I copy highlighted notes from Arpeggio? I can see them in Chart > Notes!
      - You can't.  They are just highlights, not NamedNotes or SingleNotes or TinyNotes.
      - You can pause looping and click on the positions with a NamedNote or SingleNote, and you can look through the beats with `n` and `b` or the Transport.  These notes you click would become a permanent part of the Section, and will stick around because you authored them.  You Could also record highlights over the highlights you see Section by Section and beat by beat, and these will persist because you authored them.  You would click REC, also choose Multihighlight note style `]`, then click onec to clear the highlight Arpeggio has placed, then click again to place yours.  Then `n` to go to the next beat, then click twice on the next highlight you see, and so on.  Then, when you Clear in Arpeggio and set Enable to false, you'll see your highlights in beat looping and looping, but not Arpeggio, and Chart > Notes no longer shows notes with "owner": "ArpeggioPlugin". 
    - Preserve the changes made by TransposePlugin
    - Roll back the changes made by TransposePlugin
        - You have several options:
          1) Keep a backup of the songfile by downloading a copy before Enabling TransposePlugin
          2) Use the Graveyard for backups of Sections or Plugin settings
          3) Use TransposePlugin's built-in commands which will roll the changes it has made since the songfile was opened. 
              - Before closing the file, just go into TransposePlugin's Reset command sub-menu.  Hitting Reset won't reset anything until you choose an option from the sub-menu, which has: 
                - original
                - current interval
                - set original to current
             - After the song is downloaded, the transpositions are kept, and TransposePlugin starts fresh the next time the song is opened.
  
         
  - HELP!
    - no clicky? Check Note KEEP
    - can't select my Instrument in ArpeggioPlugin? Check that it is not Wired. Arpeggio doesn't work on Listeners or Observers.
    