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
  - "Iteration 3": 
    - Wire to basic 8x8 Instrument
    - Route NOTE ON to TD.note click, and send light info (NOTE ON [rowcolNum, velocity])
  - "Iteration 4": 
    - Momentary/Latch modes; 
    - Note OFF/NOTE ON:0; 
    - MIDI OUT to VoiceLive 3 for ProgrammerMode Highlights. 
    - Recorded Notes. 