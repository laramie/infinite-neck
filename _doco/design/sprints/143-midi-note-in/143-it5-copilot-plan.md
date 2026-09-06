# Iteration 5 -- Copilot implementation log

Per-Round implementation notes, kept up to date as each Round in
[143-it5-design.md](143-it5-design.md) is coded.

## Round 1

Implemented in `templates/midi/midi.builder.js` (+ small `templates/midi/midi.html` markup change).
No `midi-io.js` or Jest test changes this round (all DOM/jQuery integration code, per repo
convention of not adding Jest coverage for this untestable-under-JSDom layer).

- **CC_AllClear**: new column-0/doc-row-8 control button, address `CC 80`
  (`LAUNCHPAD_CONTROL_BUTTON_ALL_CLEAR_CC`), same `row*10+col` address scheme as the existing
  CC10/CC20/CC30 column-0 buttons. Unlike those, it's a fire-once action (not a toggle/latch, no
  light feedback): press sends `CC 123 127` (`MIDI_CC_ALL_NOTES_OFF`) to the **forward** (downstream
  sound device) output/channel via new `sendAllNotesOffToForwardDevice()`, and resets
  `lastPitchPlan` to an empty Map so later diffing doesn't think a pitch is still sounding when the
  device just went silent. Wired into `handleIncomingMidiMessage()` alongside the other column-0
  branches, unconditional of `device.enabled`/`tableID` (device-level control).
- **Mouse Clicks silent**: added `MidiTabBuilder.deviceOriginatedColorEvent` (boolean, default
  `false`). `handleIncomingMidiMessage()` sets it `true` immediately before its own `colorNote(cell)`
  call (for a real physical Launchpad NOTE ON/OFF) and back to `false` right after. `onNoteColored()`
  (the shared `'Note:colored'` handler that also fires for plain mouse clicks on a `td.note`, since
  `NoteTableController.js`'s click handler calls the same `colorNote()`) now only calls
  `forwardPitchChanges()` when this flag is `true` -- mouse-driven chart edits still update the
  Launchpad's own lights (`lightPlan`/`diffRepaint`/`hardRepaint` unaffected) but never reach the
  downstream sound device. No `NoteTableController.js` changes needed/made.
- **Debug output versus wired output**: split the single `#selMidiOutDevice` (still used for the
  Launchpad's own light-feedback wiring, via unchanged `currentOutputPort()`) from a NEW
  `#selMidiDebugOutDevice` select in its own `templates/midi/midi.html` "MIDI OUT (debug/test send)"
  section, feeding the existing `midiOutTestGrid` (Note On/Off/CC test-send buttons). New
  `currentDebugOutputPort()` mirrors `currentOutputPort()`'s shape but reads the new select; the four
  test-send button handlers (`btnMidiTestSendNoteOn/Off/OnZero`, `btnMidiTestSendCC`) now call
  `currentDebugOutputPort()` instead of `currentOutputPort()`. New select is populated/refreshed
  alongside IN/OUT/Forward in `initMidiAccess()`/`onstatechange`, with a new
  `PREFERRED_DEBUG_DEVICE_NAME_SUBSTRING = 'CH345'` fallback (the Class-Compliant cable's own
  advertised name, per the user's own device research) since this select isn't part of the
  persisted `song.midiDevice` model (no `preferredName` to pass, unlike OUT/Forward).
- **Prefer NOTE ON 0 to NOTE OFF**: `forwardPitchChanges()`'s "note removed" branch now sends
  `sendNoteOn(output, channel, midinum, 0)` (logged as `fwd-off` with a `0x90`-tagged status byte)
  instead of `sendNoteOff(...)` (`0x80`) -- the VoiceLive 3 was observed to respond better to an
  explicit NOTE ON velocity-0 than a true NOTE OFF, even though they're spec-equivalent. Only this
  one call site changed; the debug test grid's dedicated "Note Off" row still sends a literal
  `0x80` NOTE OFF on purpose (it's specifically there to test that message shape).

### Round 1 follow-up (no code change)

Real-device acceptance testing after Round 1 landed found the forwarded notes silent on the
VoiceLive 3, traced from the activity log to a `0x91` (MIDI channel 2) status byte on every
`fwd-on`/`fwd-off` line -- this Class-Compliant cable only works reliably on channel 1 (per the
`_doco` conversation's original framing). Root cause: `SongPersistence.js`'s
`normalizeMidiDevice()` defaults `forwardChannel` to `1` (0-based, i.e. MIDI channel 2) when unset,
a leftover default from Iteration 4 predating this channel-2 limitation being discovered. Fixed by
the user changing the MIDI tab's own "Forward (downstream sound device)" Channel select
(`#selMidiForwardChannel`) to channel 1 -- persists into `song.midiDevice.forwardChannel` via the
existing change handler, no code change needed. The `normalizeMidiDevice()` default itself was
deliberately left as-is (a `SongPersistence.js` core-file change wasn't requested).

## Round 2

Implemented in `templates/midi/midi.builder.js` only. No `midi-io.js`/Jest changes (same rationale
as Round 1).

- **All Clear button light**: added `LAUNCHPAD_VELOCITY_ALL_CLEAR_IDLE` (YELLOW_GREEN) and
  `LAUNCHPAD_VELOCITY_ALL_CLEAR_PRESSED` (MAGENTA). `handleIncomingMidiMessage()`'s CC80 branch now
  also lights the button itself (via the existing `setControlLight()` helper): MAGENTA while held
  (alongside the existing `sendAllNotesOffToForwardDevice()` action-on-press), back to YELLOW_GREEN
  on release (previously release was a pure no-op for this button). `syncOnDeviceConnect()` now also
  sets the idle YELLOW_GREEN light once an output port is reachable, so the button shows its resting
  state without waiting for a first press/release, matching every other control-button light's
  connect-time sync.
- **Forward latency**: the design doc reported real-device latency between a Launchpad press and
  the VoiceLive actually sounding. Root cause found in `onNoteColored()`: `forwardPitchChanges()`
  (the actual sound-producing forward send) was called LAST, after the Launchpad's own light
  feedback (`diffRepaint()`/`hardRepaint()`) -- and a hard repaint alone sends a full 64-note clear +
  edge-artifact wipe + resend (~70+ MIDI messages) to the Launchpad's separate physical output port,
  ahead of the one or two forward messages a single press actually needs. Fixed by reordering
  `onNoteColored()` so `forwardPitchChanges()` runs FIRST (immediately after `buildDevicePaintPlan()`
  returns), before the light-output block. This is a plain synchronous statement reorder, not an
  actual async deferral: `output.send()` calls for the forward port are now issued before any
  `output.send()` calls for the light-feedback port within the same event, which is suffient since
  they're separate physical ports and doesn't require yielding the JS thread. Deliberately did NOT
  wrap the light-repaint block in `setTimeout`/a microtask despite the design doc's "even async if
  necessary" allowance: `diffRepaint()` reads the live `MidiTabBuilder.lastPaintPlan` static field at
  call time (not a captured snapshot), so deferring that call while `lastPaintPlan` gets overwritten
  in the meantime (which happens at the end of the same `onNoteColored()` call) would make every
  deferred diff compare the new plan against itself and silently turn into a no-op -- fixing that
  properly would require threading an explicit "previous plan" parameter through `diffRepaint()`,
  which felt like unnecessary risk/complexity for a latency fix that a plain reorder already solves.
  No changes to `clearAndRepaintDevice()` (Section-navigation/beat-tick path) -- it never forwards at
  all (per Iteration 4's design), so there was nothing to reorder there.

## Round 3

Touched `midi-io.js` (+ 2 new Jest tests in `_tests/jest/midi-io.test.js`, since both additions are
pure/testable per the repo's existing convention) and `templates/midi/midi.builder.js`/`midi.html`.
Full suite after this round: 67 suites / 757 tests passing (was 755).

- **Speeding up batch lighting**: added `midi-io.js` `buildLightAllLedsSysExBytes(colour)` (pure,
  tested) + `sendLightAllLedsSysEx(output, colour)`, encoding the Launchpad Pro manual's "Light all
  LEDs" SysEx message (`F0 00 20 29 02 10 0E <colour> F7`) -- ONE message that overrides every pad
  LED (including the round control buttons) to a single colour, replacing the ~70-message NOTE-ON-
  based wipe (`clearLaunchpadGrid()` + `clearLaunchpadEdgeArtifacts()`) for the CLEAR half of a hard
  repaint. New `#chkMidiUseSysExClear` checkbox (Routing section, next to Orientation) opts into it;
  `hardRepaint()` branches on it (still gated by `device.mode !== 'Note'`, same as before). Because
  the SysEx message touches literally every LED (unlike the two functions it replaces, which
  deliberately leave column-0/9 control buttons alone), the SysEx branch immediately resyncs every
  control-button light that would otherwise go dark: trigger-mode, NoteType row, REC, Clear-mode, and
  the All-Clear button's own idle light -- all via their existing `sync*()`/`setControlLight()`
  helpers, so no new state-tracking was needed. `requestMidiAccess({ sysex: false })` in
  `initMidiAccess()` changed to `{ sysex: true }` (required for `output.send()` to accept a SysEx
  message at all) -- requested unconditionally rather than only when the checkbox is checked, since
  Web MIDI's sysex permission is granted once up front, not renegotiable per later feature use.
  SCOPE DECISION: only the CLEAR half of `hardRepaint()` was batched this round, not the "paint"
  (resend) half -- the manual's per-row/per-column SysEx variants would ALSO always overwrite the
  column-0/9 control-button positions in that row/column, and unlike the "light all" case there's no
  existing tracked "last known value" for every control light (in particular the column-9 rows-1-6
  Section-action latch lights have no restore-from-memory function at all, a PRE-EXISTING gap noted
  back in Iteration 4 Round 4's memory notes) to safely restore afterward -- judged too risky to
  attempt without real hardware verification of the exact row/column addressing first. The resend
  loop (`plan.forEach(...) => sendNoteOnRaw(...)`) is unchanged; it already only sends what's
  actually lit (typically far fewer than 64 messages), unlike the clear step's fixed ~70-message cost
  every single time.
- **Ignore Aftertouch**: `midi-io.js` `parseMidiMessage()` now classifies Channel Aftertouch
  (`0xD0`-`0xDF`) as `type: 'aftertouch'` with a new `pressure` field (`data[1]`), rather than falling
  through to the generic `'other'` bucket -- pure/tested addition, same pattern as the earlier
  Control Change classification. New `#chkMidiFilterAftertouch` checkbox (activity log header, next
  to Clear) gates the `logActivity('receive', ...)` call in `attachToInput()`'s input-message
  callback: checked skips logging (and, implicitly, wastes no time formatting/appending to the log's
  `textContent` for a message type nothing ever acts on); unchecked logs it exactly as before this
  checkbox existed. Deliberately did NOT change `handleIncomingMidiMessage()` itself -- it already
  harmlessly no-ops for `'aftertouch'` today (falls through every `controlchange`/`noteon`/`noteoff`
  branch untouched), so gating only the logging call is the minimal change that satisfies "throw
  these away as soon as possible" for the part that actually costs anything (DOM log writes).

