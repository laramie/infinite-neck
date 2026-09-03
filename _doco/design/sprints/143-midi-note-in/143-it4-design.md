# "Iteration 4": Momentary/Latch modes; Note OFF/NOTE ON:0; MIDI OUT to VoiceLive 3 for ProgrammerMode.  

# Status and Goal

ProgrammerMode controls a (Launchpad) board with its input buttons and its lights, and reports it to us.  That is what we are working on now.  

We have documented some differences in NoteMode, which is now out of scope for this iteration.

We have detailed needs for 
  - Momentary/Latch modes
  - MIDI OUT of true midi NOTE ON with velociy to a downstream device/sythesizer/sound-output. 

## NoteMode out of scope

In NoteMode, things are very different, it turns out, so we are deferring that to another sprint, or a later iteration.  But know that the different behaviors to be encapsulated by Programmer/Note model algorithm objects, are:
  - In NoteMode the pad sends the inner 8x8 grid as MIDI numbers, with a C on the bottom left and Perfect 4ths tuning all the way up.  
  - We will supply the grid when we do that sprint so the output numbers and input MIDI  get mapped correctly, 
  - Any output lighting numbers or NOTE ON/OFF will be largely thrown away in NoteMode in terms of anything we send to the Launchpad in Programmer mode.  In fact, in NoteMode we send nothing back to the LaunchPad except some mode buttons so we can switch.
  - There is *no* sending of colored notes such as CycleOfColors or mapped named color mode in NoteMode.  
  - Because: In NoteMode we can send a `NOTE ON 127`, or *any* number, and they all turn the light green, full brightness, and ON.  We can then send again with velocity 0 and the light goes off, and the board's internal lighting of the C scale is resumed.  But we can't set any other colors, or even know any row or column info.

## ProgrammerMode working and in scope

In ProgrammerMode, we *do* have access to full row/column info inbound and outbound.  But the MIDI info, correctly mapped to Pitch, must then immediately be forwarded on the VoiceLive 3 MIDI 2 channel, which will go out of a Class-Compliant  USB to MIDI cable, which shows up as it's own device/port.  We must identify this and send NOTE ON/OFF to it, so that it routs real 5-Pin DIN MIDI into the VoiceLive 3's MIDI IN, where it works best.  It won't know that there's a launchpad out there--the Launchpad is now USB'd into the Chromebook, and the Class-Compliant-USB/MIDI attached to VoiceLive 3. 

So this is the chain:
- Launchpad: has buttons for User Input which trigger `NOTE ON/OFF`, Button-Lights for feedback to User which accept special `NOTE ON/OFF velocity`.  Plugged into MIDI USB to laptop.
- infinite-neck: 
  - Reads and writes to device `Launchpad Pro Standalone Port`. 
    - Read `NOTE ON/OFF`
    - Write `NOTE ON velocity` to turn on lights 
  - Writes to device `VoiceLive 3 MIDI 2`
    - pure MIDI NOTE pitches to convey musical notes
- "VoiceLive 3": generates sound based on direct microphone and modified by MIDI IN notes, effectively, a voice-synthesizer or pitch-shifter/auto-tuner.
  - Reads input MIDI NOTE messages
  - Modifies Mic signal by NOTEs, sends to sound output.

## Outbound light codes to Launchpad


We must send this encoded MIDI notes back to the board to maintain lights, as we are doing now.  

## Forwarding NOTE ON/OFF to downstream devices

We must also send the MIDI NOTE ON/OFF messages *as mapped by us* to the output device (VoiceLive 3), and *as depends on state Momentary/Latch*.  The mapping needs to be that regardless of ProgrammerMode/NoteMode, the MIDI OUT we send to sound devices (the Voicelive 3) must be true midi, not the row/column concoction used by the Launchpad in Programmer mode to sneak in row/column info.  Useful, but must be undone as we pass-through the NOTE ON with velocity to the downstream sound device, be it a 
VoiceLive 3, or an organ, or a synthesizer, or Ableton Live or anything that is expecting MIDI where Middle-C is 60.

## Latch mode (the current default)

Latch is standard behavior today (since we mostly ignore mouse_up in the UI): TD.note click adds note, click again removes note.  In Momentary mode, button down (NOTE ON) does a TD.note click.  Note appears in Section.  When in Momentary mode, NOTE OFF or NOTE ON 0 trigger a "click it again so the Note goes away" action just like another TD.note click, all of which should also work with REC turned on.  

## Momentary (needed)
In reality, Momentary will be a state button on the infinite-neck Instrument (with a UI button on the Instrument Event Wiring panel), and a toggle button on the Launchpad that can be set with its own MIDI note number in column[0], so for example, 50,60,70 are all valid side buttons so one of these when clicked will be caught by a special case in the NOTE ON handler, and a persistent light is sent to that button, and the internal state of the class of that button in the instrument is known and flipped. so that infinite-neck can know whether we are in Momentary.  In Momentary, we *don't* ignore `Launchpad button UP` ==> NOTE OFF.  In Latch, we *do* ignore `Launchpad button UP` ==> NOTE OFF.

## Latch Button

For now, we don't need Latch to be on each Instrument.

For now, we don't need the physical Launchpad to get MIDI NOTEs for lighting the Latch button (one of the column 0 available buttons).

For this iteration, we just need one latched button, next to the "MIDI Routing"/"MIDI Routing On" button, that is "Latched" (default, PunchedOut), or "Momentary" (PunchedIn). It is Song-wide, persisted with this device in the `Song.midiDevice` storage.


