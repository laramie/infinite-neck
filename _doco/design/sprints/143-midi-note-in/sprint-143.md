# sprint-143-midi-note-in

sprint number: 143

sprint midi-note-in:

date: 2026083`

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: Wire MIDI NOTE ON inputs to Note triggering.  When notes come in, they should be wired in to notes on instruments.  Design work will have to be done to figure out which strings to put the notes on, since MIDI note alone is not enough. Different devices may send strings on separate channels or codes. 

## Sprint document locations

- [design document](143-it1-design.md) 

## Iterations

  - "Iteration 1": Get MIDI notes coming in to the app from the MIDI USB source.
  - "Iteration 2": Implement prototype i/o page.
  - "Iteration 3": Wire to basic 8x8 Instrument, route NOTE ON to TD.note click, and send light info (NOTE ON [rowcolNum, velocity])
  - "Iteration 4": Momentary/Latch modes; Note OFF/NOTE ON:0; MIDI OUT to VoiceLive3 for ProgrammerMode.  ProgrammerMode controls a (Launchpad) board with its input buttons and its lights, and reports it to us.  We must send this encoded MIDI notes back to the board to maintain lights.  We must also send the MIDI NOTE ON/OFF messages *as mapped by us* to the output device (VoiceLive3), and *as depends on state Momentary/Latch*.  Latch is standard: TD.note click adds note, click again removes note.  In Momentary mode, button down (NOTE ON) does a TD.note click.  Note appears in Section.  When in Momentary mode, NOTE OFF or NOTE ON 0 trigger a "click it again so the Note goes away" action just like another TD.note click, all of which should also work with REC turned on.

