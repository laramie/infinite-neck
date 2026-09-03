# User Request

These are the the buttons: 

rows,cols == 0-9,0-9

row 9, col 1: 
1439.524 receive [B0 01 7F] Launchpad Pro Standalone Port
1440.015 receive [B0 01 00] Launchpad Pro Standalone Port

row 9, col 2: 
1467.602 receive [B0 02 7F] Launchpad Pro Standalone Port
1467.831 receive [B0 02 00] Launchpad Pro Standalone Port

row 9, col 3:
1529.603 receive [B0 03 7F] Launchpad Pro Standalone Port
1529.836 receive [B0 03 00] Launchpad Pro Standalone Port


row 9, col 4: 
1571.604 receive [B0 04 7F] Launchpad Pro Standalone Port
1571.861 receive [B0 04 00] Launchpad Pro Standalone Port

and so on until 
row 9, col 8: 
1609.351 receive [B0 08 7F] Launchpad Pro Standalone Port
1609.630 receive [B0 08 00] Launchpad Pro Standalone Port

So we would like  the first 6 of these 8 buttons to line up with radio buttons on the palette: 
row 9, col 1 : Named
row 9, col 2 : Single
row 9, col 3 : Tiny
row 9, col 4 : Bend
row 9, col 5 : Pitch
row 9, col 6 :  Multi
row 9, col 7 :  unused for now 
row 9, col 8 : unused for now

When Named radio button on the palette is chosen, only the "Named" control button would be lit, and Single, Tiny, Bend, Pitch and Multi would all be sent velocity zero.  So they act as the radio group they are a part of.

And so on for the other buttons: Single, Tiny, Bend, Pitch and Multi.

# Copilot responses

Updated memory file infinite-neck-midi-sprint-143.md

Implementation complete. Summary:

## What was added (templates/midi/midi.builder.js only)

- **`LAUNCHPAD_NOTE_TYPE_CONTROL_MAP`**: maps CC 1-6 (row 9, top control row) to the Palette's `rbHighlight` radio buttons — Named, Single, Tiny, Bend, Pitch (`MidiPitches`), Multi (`MidiPitchesSingle`). Columns 7-8 are left unmapped (unused).
- **`LAUNCHPAD_VELOCITY_NOTE_TYPE_SELECTED`** (green, `LAUNCHPAD_MAJOR_COLOR_VELOCITIES.GREEN`): the lit-indicator color — inferred as a sensible default since you didn't specify one for this row; easy to retune via that single constant.
- **`handleIncomingMidiMessage()`**: a new branch checks for CC 1-8 control-change messages; on press, calls `paletteUtils.check(radioSelector)` — a real simulated click, so it goes through the exact same code path as clicking the radio on-screen.
- **`syncNoteTypeControlLights()`**: reads the currently-checked `rbHighlight` radio and lights only the matching control button, sending velocity 0 to the other five — implementing the radio-group behavior you described.
- Wired to fire from three places: a new `change` listener on `input[name="rbHighlight"]` (covers on-screen clicks, `[`/`]` keystrokes, and physical button presses, since they all converge on the same native radio change event), `syncOnDeviceConnect()` (so "Named" lights up on initial connect), and the device-mode selector's change handler.

All three trigger-mode/note-type physical control features (Latch/Momentary CC10, edge-artifact cleanup, and this new radio-group row) are independent of whether Instrument routing is enabled, matching the established pattern.

Full suite: **67/67 suites, 746/746 tests passing** (no new tests needed — this is DOM/jQuery integration code, consistent with the repo's existing untested-by-convention pattern for `handleIncomingMidiMessage()`). Repo memory and the sprint doc are updated with full details for future sessions.

Made changes.