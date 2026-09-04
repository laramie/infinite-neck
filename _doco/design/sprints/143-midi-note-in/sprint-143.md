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
    - Round 2: Highlights (Multi/Pitch) + Recorded Notes lit on the Launchpad; Quick Menu
      Latch/Momentary duplicate button.
    - Round 3: physical Latch/Momentary control button (Launchpad Pro control-column CC 10,
      via a new 'controlchange' MIDI message type) with its own LED indicator; defensive
      cleanup of known real-hardware LED artifacts (right control column, spurious
      connect-time light); top control row (CC 1-8) wired to the Palette's rbHighlight
      (NoteType) radio group as a lit radio group (Named/Single/Tiny/Bend/Pitch/Multi).
    - Round 4 (143-it4-round-4-design.md): column 0 REC indicator/toggle (mirrors and can
      trigger the on-screen REC button, red when recording); column 9 wired to Section/Beat
      navigation actions (rows 1-6: Add Section/Add Beat/First/Prev/Next/Last Section, press
      flashes magenta then latches green until any other column-9 button is pressed) and the
      centralized Looper toggles (rows 7-8: Beat Loop/Section Loop, mirror the transport UI's
      own color, and blank rows 1-6 on press); row 9 cols 7-8 (Prev/Next Beat, non-latching
      magenta flash). These right-control-column addresses are the SAME ones
      LAUNCHPAD_RIGHT_CONTROL_COLUMN_NOTES in midi-io.js previously only treated as a "known
      edge artifact" to blank -- now given real meaning, with midi.builder.js re-syncing the
      Looper lights immediately after every defensive artifact wipe.
    - Round 4 follow-up: column 0, doc row 3 wired to the Palette's Clear-mode radio
      (#idPaletteModeClear) as a full two-way status-mirroring toggle button (yellow-amber when
      Clear is selected, off otherwise): pressing while unlit selects Clear (lights up); pressing
      while lit selects Paint (turns off). Required a small presentation.js change:
      updatePaletteModeUi() (the single choke point for every palette-mode change, including the
      "leaving Clear" special-casing done when picking a color/highlight while in Clear mode) now
      fires a 'Palette:modeChanged' EventBus event so midi.builder.js can stay in sync regardless
      of which code path changed the mode.
    - Round 4 follow-up 2: REC dot's Momentary-mode border (.RecordDotMomentaryBorder(Vertical)
      in section-status.css) is now only visible while MIDI triggerMode is Momentary, via a
      'MidiTriggerModeMomentary' class toggled on &lt;body&gt; by
      MidiTabBuilder.applyTriggerModeButtonUi().