# Iteration 4 Implementation Plan: Momentary/Latch + True-Pitch MIDI OUT Forwarding

Scope per [143-it4-design.md](143-it4-design.md): ProgrammerMode only (NoteMode explicitly deferred).
All work is in `templates/midi/` + `SongPersistence.js`; no `NoteTableController.js` changes needed
(reuses the existing `colorNote()` call and `'Note:colored'` EventBus event already wired in the
prior iteration).

## 1. Data model (SongPersistence.js `normalizeMidiDevice()`)

Add two fields to `song.midiDevice`:
- `triggerMode`: `'Latch'` (default) | `'Momentary'`
- `forwardName`: string — persisted output device name for the downstream sound device (e.g.
  "VoiceLive 3 MIDI 2"), same pattern as the existing `name` field for the Launchpad port.
- `forwardChannel`: 0–15, default `1` (i.e. MIDI channel 2, per design's "VoiceLive 3 MIDI 2")

## 2. UI (midi.html / midi.css)

- New `#btnMidiTriggerMode` toggle next to `#btnMidiRouteToggle`: "Latched" (BtnPunchedOut, default) /
  "Momentary" (BtnPunchedIn) — Song-wide only, per design's explicit "for now" simplification (no
  per-Instrument button, no physical Launchpad column-0 button/light).
- New Routing controls: `#selMidiForwardDevice` (output-port picker, same population logic as
  `#selMidiOutDevice`, preferring a device name containing "VoiceLive") + `#selMidiForwardChannel`
  (1–16, mirrors existing channel selects).

## 3. Input handling (`handleIncomingMidiMessage()`)

- **Latch** (default, unchanged): only `parsed.type === 'noteon'` triggers `colorNote(cell)`.
- **Momentary**: both `'noteon'` and `'noteoff'` resolve the same cell and call `colorNote(cell)`.
  (`midi-io.js`'s `parseMidiMessage()` already normalizes NOTE ON velocity-0 to `'noteoff'`, so both
  forms the design mentions are already unified.) Since `colorNote()` toggles, down→add, up→remove —
  no extra state tracking needed.

## 4. True-pitch downstream forwarding

Reuses the existing paint-plan diff machinery (`buildDevicePaintPlan()` / `diffRepaint()` /
`hardRepaint()`) rather than a new parallel path:
- `buildDevicePaintPlan()` will also capture each entry's real `midinum` (already read off the cell)
  alongside the Launchpad-light velocity, so one pass produces both the light-plan and the
  always-true-pitch data needed downstream (regardless of `device.mode`, per design).
- New `forwardPitchChanges(previousPlan, newPlan)`: diffs by **pitch presence only** (ignores
  color/velocity-only recolors, which must not retrigger the synth) and sends real NOTE ON (added
  pitches) / NOTE OFF (removed pitches) to `forwardName`/`forwardChannel`.
- Runs from `onNoteColored()` (real-time clicks/presses) — see Open Question 3 for whether Section
  navigation's bulk repaint should also forward.

## Open Questions

1. Dedicated `#selMidiForwardDevice` persisted as `midiDevice.forwardName`, separate from the
   Launchpad's own `name`/`channel` fields — OK? **(Y/N)**
2. Separate `midiDevice.forwardChannel` (not reusing the Launchpad `channel`), default channel 2 —
   OK? **(Y/N)**
3. Should `clearAndRepaintDevice()` (Section-navigation's bulk relight of the *whole* new Section)
   also forward a burst of NOTE ONs for every already-active note to VoiceLive, or should forwarding
   happen *only* from real per-click/per-press add/remove events?
   **A)** Yes, forward on Section change too (keeps VoiceLive in sync with what's lit)
   **B)** No, only forward on real-time add/remove (avoids retriggering the synth for notes that were
   already sounding) — *recommended*
4. NOTE ON velocity forwarded downstream: pass through the real incoming Launchpad velocity when the
   add was triggered by a physical press; default to 127 when triggered by a plain UI mouse click.
   NOTE OFF always at velocity 0. OK? **(Y/N)**
5. Confirming: Momentary mode is a single Song-wide toggle only this iteration (no per-Instrument
   override, no physical Launchpad mode-switch button) — matches design doc's "for now" language.
   **(Y/N)**
6. Flipping Latched↔Momentary mid-Song leaves any already-lit/held notes untouched (no forced
   release) — the new mode only governs the *next* press/release. OK? **(Y/N)**
