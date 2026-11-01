# Scope

We need two little tweaks to 143-it4 implementation, so this is 143-it4-design-2, or sprint-143, iteration 4. round 2.

We need Highlights handled, and we need to handle Recorded Notes.

# Highlights

We have two Highlights: Highlight Multi, keystroke: `]` , and Highlight Pitch (MIDI), keystroke: `[`. 

## Multi

When a Highlight Multi is pressed, Launchpad-magenta (decimal velocity 53) should go to the button light.  When a Highlight is released, in Latch Mode it should remain as a magenta light, since it will remain as a highlight on the Instrument table.  In Momentary Mode, the magenta should be turned off after the NOTE OFF (or NOTE ON 0) is received, just like current Momentary behavior, but then if there was a non-highlight color still in that cell (NamedNote, SingleNote, Tiny, Bend, Fingering) the Launchpad should be recolored with that note.  So always:
  - Note + Highlight => magenta. 
  - Highlight on => magenta.  
  - Highlight off => color of remaining NamedNote, Single Note, Tiny Note, Bend, or Fingering, or off if none. 

## Pitch

When a Highlight Pitch is pressed, Launchpad-yellow (decimal 14) should go to the button light on Launchpad.  Same behavior as Highlight Multi.

# Recorded Notes

Recorded notes are not being forwarded to the Launchpad on beat ticks.  They should be, and also be blanked on the Launchpad if they get erased on the next beat.

