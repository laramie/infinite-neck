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

## Round 4

### Output LED Optimization

Touched `midi-io.js` (+5 new Jest tests, since the new builder/sender is pure/testable per repo
convention) and `templates/midi/midi.builder.js`/`midi.html`. Full suite after this round: 67 suites
/ 762 tests passing (was 757).

- Added `midi-io.js` `buildLightLedsSysExBytes(ledColourPairs)` (pure, tested) +
  `sendLightLedsSysEx(output, ledColourPairs)`, encoding the Launchpad Pro manual's "Light LED using
  SysEx" message (`F0 00 20 29 02 10 0A <LED> <Colour>... F7`, chunked defensively at the manual's
  documented 97-pair-per-message cap via new exported `LAUNCHPAD_SYSEX_MAX_LED_PAIRS_PER_MESSAGE`).
  **Design choice over the doc's row/column-sliced suggestion**: this message addresses an arbitrary
  SPARSE set of individual LEDs in one shot, which maps directly onto this module's existing paint
  plan shape (`Map<outNote, velocity>`) -- a Map's default iteration already yields `[key, value]`
  pairs in exactly the `[led, colour]` shape needed, so a plan is passed to `sendLightLedsSysEx()`
  with NO conversion. Chosen over the row/column variants because: (1) the whole 8x8 grid is only 64
  addresses, comfortably under the 97-pair cap, so a full repaint is ALWAYS one message this way; (2)
  row/column messages always touch every LED in that row/column (10 values each), forcing the caller
  to also compute an explicit "off" value for any cell in that row/column that isn't actually part of
  the plan -- the sparse LED-pair message needs no such compensation. `buildLightLedsSysExBytes()`
  uses `Array.from(ledColourPairs).forEach(...)` rather than calling `.forEach()` directly on the
  input -- a bug caught by its own Jest test: `Map.prototype.forEach`'s callback signature is
  `(value, key)`, NOT a `[key, value]` pair, so calling it directly on a Map without the `Array.from()`
  conversion silently corrupted the encoding (values landing in the wrong byte positions) rather than
  throwing -- `Array.from()` on a Map always yields its `.entries()` pairs regardless, so this makes
  a Map and a plain Array of `[led, colour]` pairs behave identically.
- `templates/midi/midi.builder.js` `hardRepaint()`: `#chkMidiUseSysExClear` (added Round 3) now also
  governs the PAINT half (previously only gated the clear half) -- per the design doc, the paint step
  (sending one NOTE ON per lit cell, up to 64 individual messages) was the bigger measured latency
  contributor at slow tempos, not just the clear step. When checked, the resend loop is replaced by a
  single `sendLightLedsSysEx(output, plan)` call (plan passed straight through, see above) instead of
  `plan.forEach(...) => sendNoteOnRaw(...)`; `channel` is intentionally unused in that branch, since
  Launchpad Pro Programmer-mode grid LED addressing via SysEx doesn't vary by MIDI channel. Renamed
  the checkbox label from "Use SysEx bulk clear" to "Use SysEx bulk clear+paint" in `midi.html` to
  reflect the widened scope, same `id` (no other plumbing changed).
  **Deliberately NOT batched**: `diffRepaint()` (the per-click/press path used by `onNoteColored()`)
  is completely untouched -- per the design doc's own "Single notes played should go out when they
  go out", only the Section-boundary/beat-tick `hardRepaint()` path (`replay()`'s device-side
  consequence) was in scope for this optimization.
- Confirmed with the user (no code change needed): the SysEx-clear branch's existing Round-3
  control-button-light resync (trigger-mode/NoteType row/REC/Clear-mode/All-Clear) is working
  correctly as-is and needed no revisiting this round.

## Round 4 close-out

Four small user-requested wrap-up items after real-hardware confirmation that Round 4's SysEx
batch-paint made Single-note/Momentary play "snappy and playable." Full suite after this close-out:
67 suites / 762 tests passing (unchanged -- no new pure/tested `midi-io.js` logic this round, all DOM/
bookkeeping changes in `templates/midi/midi.builder.js`, `templates/midi/midi.html`,
`templates/midi/midi.css`, and `SongPersistence.js`).

- **Color-coded activity log**: `logActivity()`/`logActivityText()` (`midi.builder.js`) now append one
  `<div>` per line via a new `appendActivityLogLine(el, text, direction)` helper, instead of the
  previous `el.textContent += line + '\n'` raw concatenation -- needed so each line can carry its own
  CSS class. `direction.startsWith('fwd')` (`fwd-on`/`fwd-off`/`fwd-cc`) gets `.midiLogForward` (green,
  `#39ff14`); anything else except `'receive'` gets `.midiLogSend` (yellow, `#ffd700`); `'receive'`
  stays unstyled, inheriting the log's existing base color (`#b7f7b7`, `midi.css`). `logActivityText()`
  gained a `direction = 'send'` default param (all 3 existing callers are SysEx/grid-clear device
  writes, correctly yellow with no call-site changes needed). Still uses `line.textContent = text`
  (never innerHTML) -- device names from the Web MIDI API are external/untrusted strings and must
  never be interpreted as markup. `#btnMidiClearActivityLog`'s `el.textContent = ''` still clears the
  new `<div>` children exactly as it cleared plain text before.
- **Use SysEx default-on**: `#chkMidiUseSysExClear` (`midi.html`) now has the `checked` attribute by
  default. Still session-only/non-persisted per the Round 3 decision -- unaffected by this change.
- **Forward channel default -> 1**: `SongPersistence.js` `normalizeMidiDevice()`'s `forwardChannel`
  fallback changed from `1` (MIDI channel 2, the original `143-it4-design.md` "VoiceLive 3 MIDI 2"
  default) to `0` (MIDI channel 1) -- channel 2 was root-caused earlier this iteration as the reason
  the real VoiceLive 3 went silent over the Class-Compliant cable; channel 1 is the user-confirmed
  working default. Matching `?? 1` fallbacks in `midi.builder.js` (`syncControlsFromDevice()`,
  `forwardPitchChanges()`, `sendAllNotesOffToForwardDevice()`) updated to `?? 0` for consistency (only
  matters for a `device.forwardChannel` that somehow bypassed `normalizeMidiDevice()`).
- **"3 clicks to make MIDI Routing stick" bug, ROOT CAUSE FOUND AND FIXED**: `clearAndRepaintDevice()`
  was unconditionally committing `lastPaintPlan`/`lastPaintTableID`/`lastPitchPlan` even when
  `currentOutputPort()` returned `null` (no output port yet -- e.g. `initMidiAccess()`'s
  `requestMidiAccess()` still resolving right after page load, or the User clicked
  `#btnMidiRouteToggle` before the device was reachable). This falsely marked the table as
  "already painted" for every later call, so once an output DID appear, the existing
  `tableChanged`/`plansAreEqual()` "unchanged" check would wrongly skip the real repaint --
  requiring a manual second toggle-off/toggle-on (clearing `lastPaintTableID`/`lastPaintPlan` via the
  off-branch, then forcing a fresh paint on the next on-click) to actually get painted. FIX (two
  parts): (1) `clearAndRepaintDevice()` now returns immediately, before touching any of the three
  `last*` fields, when `output` is null. (2) `syncOnDeviceConnect()` (already the established
  "device just became reachable" hook, used for all the control-button idle lights) now also calls
  `clearAndRepaintDevice()` at the end -- so if routing was already enabled (via button click, or
  persisted `enabled:true` from a previously-saved Song) before an output existed,
  the pending paint finishes itself the moment a port shows up, with zero extra clicks needed.
  Idempotent/safe to call from both places: `clearAndRepaintDevice()`'s own `plansAreEqual()` check
  means a redundant call (e.g. `syncOnDeviceConnect()` firing on every `onstatechange`, or routing
  already off) is always a harmless no-op.

## Round 5

### NamedNote forward bug

Root cause: a NamedNote press colors EVERY cell across the whole tuning sharing that note letter
(e.g. one physical Gb press lights 4 different octave cells -- 4 distinct `midinum` values), and the
old `forwardPitchChanges(previousPlan, newPlan)` diffed the ENTIRE `pitchPlan` Map returned by
`buildDevicePaintPlan()` -- so one physical press produced 4 `fwd-on` messages instead of 1. Per the
design doc's core rule, "one Launchpad button == one MIDI NOTE ON", regardless of note type
(Named/Single/Tiny/Fingering/Bend/Pitch/Multi must all forward exactly the one physically pressed
pitch, never a calculated/spread set).

Fix, entirely within `templates/midi/midi.builder.js` (no `NoteTableController.js` changes needed --
the exact physically-pressed `<td>` and its `midinum` were already available in
`handleIncomingMidiMessage()` before this round, just not threaded through to the forwarding
decision):

- New `pendingForwardMidinum` static field: the exact `midinum` of the ONE cell a real physical
  press/release targets, stashed in `handleIncomingMidiMessage()` right before the `colorNote(cell)`
  call (same call site/pattern as the existing `pendingForwardVelocityByMidinum`), reset to `null`
  right after -- available synchronously to `onNoteColored()`.
- New `forwardedPitches` static field (replaces `lastPitchPlan`): the single source of truth for "is
  this pitch currently believed sounding downstream", maintained ONLY by the new
  `forwardSinglePitchChange()`/`sendAllNotesOffToForwardDevice()`/`releaseForwardedPitches()`.
  Deliberately NOT derived from `pitchPlan` (the chart's full highlighted-cells snapshot) -- that
  snapshot legitimately contains many pitches for one press (the NamedNote spread) and must never be
  diffed wholesale again.
- Old `forwardPitchChanges(previousPlan, newPlan)` (whole-Map diff) replaced with
  `forwardSinglePitchChange(midinum, pitchPlan)`: checks only `forwardedPitches.has(midinum)`
  (before) vs. `pitchPlan.has(midinum)` (after) for the ONE `pendingForwardMidinum` -- an on/off/no-op
  decision for exactly one pitch, no matter how many other cells got (re)colored as a side effect of
  the same click. `onNoteColored()` now calls this instead of the old whole-diff call, still gated on
  `haveBaseline && deviceOriginatedColorEvent` (Round 1's "Mouse Clicks silent" rule unchanged) plus a
  new `Number.isInteger(pendingForwardMidinum)` guard.
- `releaseForwardedPitches()` (routing off/re-target) and `sendAllNotesOffToForwardDevice()`
  (CC_AllClear panic button) both updated to release/clear `forwardedPitches` instead of
  `lastPitchPlan` -- `lastPitchPlan` is now fully removed (was only ever read by the old whole-diff
  function).
- `clearAndRepaintDevice()` (Section-navigation, never forwards) no longer needs `pitchPlan` at all --
  only destructures `lightPlan` from `buildDevicePaintPlan()` now.
- Full suite unaffected: 67 suites / 762 tests passing (no `midi-io.js` changes this round; all
  `midi.builder.js`-only bookkeeping/logic, no new pure-layer surface to test).

