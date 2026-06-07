# Iteration 1 : Design

## Purpose

We would like to teach TransposePlugin to handle SingleNote values in addition to NamedNotes.  After we implemented MovePlugin, we confirmed that the use-cases around moving SingleNotes and sets of SingleNotes (chords and arpeggios) are too varied to have a deterministic rule for transposition.  

However, the "string" "algorithm" for MovePlugin has proved useful enough, and resilient enough in preserving User-authored notes, that we want to copy that small subset of functionality into TransposePlugin.

## Plugin Philosophy 

We restate here that the design philosophy of our plugins is to relieve coding pressures, changes, and risks from impacting our core code.  We don't mind complicated or non-shared code in the plugins--they should be considered stand-alone, and depend only on shared plumbing in plugins utilities such as PluginManager, and of course the core API, but should not make special contracts with the core or cause any dependencies other than the registration in `registerPlugins.js`.  They should also have minimal impact on the other plugins, communicating mostly through the PluginManager and the EventBus system.

## Features

MovePlugin allows SingleNotes to be moved with "algorith" property of "string".  This simply wraps the note values around on the same string, since adding or subtracting 12 takes the note up or down the MIDI scale semi-tones or steps (one integer step per semi-tone), wherein the note name sequence repeats.  12 semi-tones is one "octave", for example middle "C" is MIDI 60, but MIDI 72 is also a "C".  So musically they function similarly enough that a substitution can be made on the neck/fretboard when the note has moved up or down too much to fit on the fretboard.

MovePlugin makes the distinction of capping the motion at one octave which is 12 steps (musically called semi-tones).  We'd like this to be an option in Transpose, so that the jump is made:
- whenever the note's new cell would be outside the playable range: from fret-0 for the Nut position, to fret-n for the last cell on the neck, left-handed or right-handed.  In this case, the note would be wrapped to the other end of the fretboard, incremented up, or decremented down until it was the first octave equivalent found.  On a 16-fret tuning, this would be one octave away.  On a 26 fret tuning, with "octaves" property empty or equal to "2" or more, this would be two octaves away, and wouldn't be just the first fret available from the other direction.  We would support this option with having the User chose a concrete number such as "octaves":2, or an empty value for "octaves", which would mean go the length of the neck, and start the maximum octave away from the other end.
- if the option for "octaves" is 1, then when the candidate position was 13 and we are transposing up to a number 14, then wrap down an octave, even if there are more positions available on the neck, e.g. fret-14.  This is effectively what MovePlugin does today. 

The only motion of notes will be on one string.  No attempt to jump strings will be made.

The only other weird edge case we need to worry about is where n-frets is less than 13 counting the Nut.  In this case, we'd like to think that the Section storage will allow notes that are not visible are still preservable in the Section without breaking anything.  We think this is true today.  Thus, notes would simply not be displayed until they finally grew or shrank to visible range again.  So the Section would store a note at col 11 even if the tuning only had 6 cols.  To prevent having to store negative fret values, the notes should wrap up an octave any time they go below the per-string Nut.  

As a reminder, there are functions in the API to determine where the Nut is, in the case of BanjoNut, where the nut might not be at fret-0.

The only new note type supported will be SingleNote.  TinyNote, Bend, and Highlights are not supported and will not get a menu item.

The top menu for TransposePlugin will thus grow two new items:
`s) single notes [false]`
`o) octaves []`
where octaves can be empty, 0, or larger positive integer.  Numbers higher than the neck allows are simply treated as allowed values that result in the note being wrapped when it exceeds cells on the neck.
`n) named notes [true]` is currently defaulted to true.  `s) single notes [false]` will default to false.  If both named notes and single notes are true, the plugin will handle both note types, and the rest of the truth table combinations follow logically, since these are in separate cell lanes.
Triggers s and o are currently available.  The above syntax is the same as we have been using, the `o)` means don't show those characters: just use the letter as the trigger.

The only supported "algorithm" supported is "string" so there is no menu item for selecting "algorithm".

## Request

Copilot, please evaluate this design against the actual codebase for TransposePlugin and MovePlugin.  We feel it is straightforward, but if there are design holes or coding questions that need answers before coding, please bring them up in the draft implementation plan, which is your deliverable for this Iteration 1.  No code changes this Iteration 1.

# Iteration 2: design questions answered

We don't see a distinction between "octaves":0, "octaves":null, "octaves":undefined, "octaves":"", and "octaves":(n>numfrets%12)  They should all continue trying the maximum fret until the note becomes invisible, then just rely on Section storage.  When approaching the Nut, before they are given a negative fret number or one illegal with BanjoNut, wrap to the max visible octave, unless the instrument has less than an octave of frets, in which case wrap up one octave and rely on Section storage.

A feature of MovePlugin to be replicated is that the notes are to be thought of as written to a scratch set, then all moved at once into the Section new positions.  So that a candidate note can never be thought to collide with a note that hasn't been calculated yet.  Since the entire set of notes is being moved (up, say), then in theory no notes from the current set on that string should ever clobber any other notes, since they are all moved/wrapped the same amount.  This should modify the request so far: if a user has requested "octaves":1 and there would be a collision, the algorithm should switch to "octaves":0, so that the entire neck can be used, including off-screen positions, thus ovoiding collisions, which is more important so the transposition can be non-lossy.  In this case, the "octaves" value should be rewritten so the User can see what happened.

Invalid values for "octaves" upon parsing/validation should set "octaves":0, and a showMessages should be issued.  "help" should spell out the legal values statically. 

All fields from SingleNote should be preserved.  The only other field needed would be whatever TransposePlugin currently uses to do "resetSong hard" and "reset" so that SingleNote gets reset the correct number of steps/semi-tones.

To confirm, SingleNotes should participate in the "resetSong hard" and "resetSong" algorithm of TransposePlugin.