# Sprint 148 (displayOptions-diff), Iteration 6, Round 2: implementation report for Song-DEFAULTS

date: 20261025

Implements [148-it6-implementation-plan.md](148-it6-implementation-plan.md) with the answers in [148-it6-design.md](148-it6-design.md).  Sprint overview: [sprint-148.md](sprint-148.md).

**Status:** implemented.  Jest green (77 suites, 990 tests).  **Not verified in a browser** (see the list at the end).

## What was built

| Area | Change | Where |
|---|---|---|
| File format | Optional `song.displayOptionsDefault` (sparse `{key: value}`).  `normalizeSongDisplayOptionsDefault()` keeps known keys with real values, in column order, and returns `undefined` for missing/empty/all-unknown, so those are all "no block".  Omitted from the file when empty | [displayOptionsMeta.js](../../../../templates/display-options/displayOptionsMeta.js), [SongPersistence.js](../../../../SongPersistence.js) |
| Schema and tools | Song file schema accepts the block (known keys, at least one); the compaction report diffs against it | [bin/song-file-schema.js](../../../../bin/song-file-schema.js), [bin/compact-display-options.js](../../../../bin/compact-display-options.js) |
| Cascade | New tier between Sections and DEFAULTS, source `songDefault`.  `apply`: unconditional (no `defaultIfAutomated` test; works for keys with no DEFAULTS entry).  `baseline` (SaveDiff, Inspect): earlier Sections, then Song-DEFAULTS, then DEFAULTS, then `syncLive`.  Column/adapter read blocks still leave the key alone (dormant value) | [displayOptionsResolver.js](../../../../templates/display-options/displayOptionsResolver.js) |
| Plans | `planCurrentToSongDefaults(song, idx)`: pure mirror of the Section's **stored** cells; `planClearSongDefaults(song)`.  New ops `setSongDefault` / `deleteSongDefault`.  **No gate is consulted** (D1, D2); gated keys are only named in the report (`gated (overridden): noteFont (column r, row rw), ...`).  `plan.noUndo` leaves the Undo slot alone | [displayOptionsPlan.js](../../../../templates/display-options/displayOptionsPlan.js) |
| Core | `handleBtnCurrentSectionToSongDisplayOptions()`, `handleBtnClearSongDisplayOptions()` (quiet, keep the dirty highlight); `getDisplayOptionsMatrixContext()` adds `hasSongDefaults`, `currentStoresCells` | [infinite-neck.js](../../../../infinite-neck.js) |
| Matrix | Two buttons between Apply and Float; `Song-DEFAULTS` row between DEFAULTS and LIVE (plain cells, no gate classes, per Q11); sticky offset `--dm-top-songdefaults`; Clear is disabled when the block is empty, Current to Song-DEFAULTS when the Current Section stores nothing; Inspect on a key header shows `song default:`; Legend explains the row | [display-options.html](../../../../templates/display-options/display-options.html), [builder](../../../../templates/display-options/display-options.builder.js), [display-options.css](../../../../templates/display-options/display-options.css), [displayOptionsMatrixView.js](../../../../templates/display-options/displayOptionsMatrixView.js), [displayOptionsMatrixTools.js](../../../../templates/display-options/displayOptionsMatrixTools.js) |
| Tests | New [display-options-song-defaults.test.js](../../../../_tests/jest/display-options-song-defaults.test.js); [display-options-matrix-ui.test.js](../../../../_tests/jest/display-options-matrix-ui.test.js) updated (Inspect text, row order, button ids) | `_tests/jest/` |

Top-level files changed (as announced in the plan): [SongPersistence.js](../../../../SongPersistence.js) and [infinite-neck.js](../../../../infinite-neck.js).  [Song.js](../../../../Song.js) was not touched.

## Decisions applied

- Q1: copy, not move; the Current Section is left as it is.  Q2/D3: replace (pure mirror).  Q3/D1/D4/D6: gates ignored, gated keys named.  Q4: no Undo slot.  Q5: `/vdd` unchanged (golden file untouched).  Q6: the Matrix's usual Apply/hint/dirty path runs after a real change.  Q7: Inspect and Key r / Key w only.  Q8: no command line.  Q9/D2: Clear overrides gates too.  Q10: both names kept.  Q11: the **alternative**: plain cells, no gate classes on the special rows.  Q12: no confirmation.
- Behavior to know: Current Section stores nothing -> nothing happens and the report says so (it does not wipe; Clear does).  The button is also disabled in that case.

## Browser acceptance recipes (26-30)

Use a Song with several Sections.  Open the Matrix (`/vpmo`).

26. **Copy and mirror.**  On Section 2 SaveAll.  Press Current to Song-DEFAULTS.  Expect: the Song-DEFAULTS row shows the same values as Section 2; Section 2's cells are unchanged (white, since they repeat the inherited value); the status line says `Song-DEFAULTS wrote ...`.  Go to Section 3, change one control, SaveDiff, press Current to Song-DEFAULTS again: the row now equals Section 3's cells only (stale keys gone).
27. **Cascade.**  Clear Section 1's cells.  Press Apply on Section 1, then go to Section 3 and back: Section 1's controls come from Song-DEFAULTS.  Change a control in Section 4 and SaveDiff: only cells that differ from Song-DEFAULTS are stored.  A Section cell that now repeats Song-DEFAULTS is removed by the next SaveDiff.
28. **Clear and reload.**  Press Clear Song-DEFAULTS: the row is blank, the button greys out, controls return to DEFAULTS after Apply.  Press Current to Song-DEFAULTS, save the Song, reload it: the row is restored, and the file contains `displayOptionsDefault` (and no such field after Clear).
29. **Blocks are ignored.**  Put a cell r on a cell in Section 2, a Key r on `noteFont`, and Section w on Section 2.  Press Current to Song-DEFAULTS: every stored cell of Section 2 is copied, and the status line ends with `gated (overridden): ...` naming them.  `noteFont` is not applied while its Key r is on (dormant), and applies when the Key r is removed.  Clear Song-DEFAULTS removes gated keys as well.  No block was added or removed by either button.
30. **Old Songs and Undo.**  Open an old Song that uses the Section-1 idiom: its Song-DEFAULTS row is blank and it behaves exactly as before.  Do a Clear Section, then press either new button: Undo still undoes the Clear Section.  The buttons also work in a floating Matrix.  Auto-apply on and off has its own recipes, 30a-30e below.

### Recipes 30a-30e: Auto-apply (clarification of recipe 30)

**What Auto-apply does.**  After an edit in the Matrix, the stored model may now say something different from the controls on the View page.  The edit leaves the controls alone unless Auto-apply is ticked.  Auto-apply then re-applies the Current Section from the model at once (the same as pressing Apply).  The controls are only re-applied when **all** of these are true:

1. **The edit changed what Apply would push into the Current Section.**  Yes: `Clear Song-DEFAULTS` (when the row is not empty), `§N → Song-DEFAULTS` (when it changes the row), Clear Cell / Clear Section / Undo of a cell in a Section at or before the Current Section, a read gate (Key r, Section r, Cell r) at or before the Current Section.  No: any write gate (Key w, Section w, Cell w), any edit to a Section after the Current Section, a button press that changed nothing.
2. **The controls are clean.**  The SaveDiff button is not highlighted (no unsaved control changes).  If it is, Auto-apply refuses and the status line warns `Live controls changed: SaveDiff before next Apply`.
3. **Auto-apply is ticked.**  If not, the status line shows the hint `Controls not re-applied: press Apply, or navigate.`

**What hides the difference (do not do these between the edit and your observation).**  Each of these re-applies the Current Section whatever Auto-apply says:

- the **Apply** button;
- clicking a **Section number** (the first column of the Matrix) while the Inspect, Store Cell, Key r, Key w, Cell r or Cell w Tool is selected: the number is a link and navigates, even to the Section you are already on.  Only the Clear Section, Section r and Section w Tools make a Section number act on the row instead;
- the Transport (Next/Previous Section, Looping, the spacebar mappings).

**What makes the difference visible.**  The Current Section must *inherit* the value from what you edit, and the new value must differ from the control.  Pressing `§N → Song-DEFAULTS` with Section N as the Current Section shows nothing in the controls, because Section N's own cells beat Song-DEFAULTS.  Use **Clear Song-DEFAULTS** to see it.  Also, a Song-DEFAULTS value falls back to the built-in DEFAULTS only when some Section stores that key, so the setup below has Section 3 store it.

**Setup (once).**  Use a scratch Song with at least 4 Sections, whose Sections store no `showMidiNum` cell yet.  Open the Matrix (`/vpmo`), select the **Inspect** Tool, tick no other View options.  The control is **Show MIDI Number** (`showMidiNum`, built-in DEFAULT: off); the Matrix's **LIVE** row shows its current value.

- S1. Press `Clear Song-DEFAULTS` if it is enabled.
- S2. Click Section number **3** (navigates).  Tick Show MIDI Number.  Press SaveDiff.  Expect a green ✓ cell for `showMidiNum` in Section 3.
- S3. Press `§3 → Song-DEFAULTS`.  Expect a ✓ in the Song-DEFAULTS row.
- S4. Click Section number **2** (navigates).  Expect: Show MIDI Number ticked, LIVE row ✓, Section 2 has no cell in that column, SaveDiff not highlighted.  This is the **ARMED** state.

**Re-arm** (before each recipe below): click **3**, press `§3 → Song-DEFAULTS`, click **2**.  Expect ARMED again.  (Re-arming navigates, so do it before the edit and never between the edit and the observation.)

30a. **Auto-apply OFF.**  From ARMED, untick Auto-apply.  Press `Clear Song-DEFAULTS`.  Expect: the Song-DEFAULTS row is blank; the status line is in hint style and ends `Controls not re-applied: press Apply, or navigate.`; **Show MIDI Number is still ticked and the LIVE row still shows ✓**.  The model changed, the controls did not.  Now press **Apply**: Show MIDI Number unticks, LIVE shows ✗, status `Applied Section 2: ...`.

30b. **Auto-apply ON.**  Re-arm.  Tick Auto-apply.  Press `Clear Song-DEFAULTS`.  Expect, with no other click: Show MIDI Number unticked, LIVE ✗, and the status line ends `Applied: controls re-applied from the model.` with no hint.  The only difference from 30a is the checkbox.

30c. **Auto-apply ON but the controls are dirty.**  Re-arm.  Tick Auto-apply.  Untick **Show Left Subscript** (any control other than Show MIDI Number): SaveDiff is highlighted and the status shows `Live controls changed: SaveDiff before next Apply`.  Press `Clear Song-DEFAULTS`.  Expect the same warning, **Show MIDI Number still ticked**, and Show Left Subscript still unticked (your edit is protected).  Press SaveDiff, then Apply (or just Apply to discard the edit): Show MIDI Number unticks.

30d. **An edit that cannot change the Current Section.**  Re-arm.  Tick Auto-apply.  Select the **Section w** Tool and click Section number **4** (the Tool acts on the row, it does not navigate).  Expect: the status line reports the write gate, with neither `Applied:` nor the hint; Show MIDI Number is still ticked.  Click Section number 4 again to remove the gate.

30e. **Navigation hides the difference.**  Re-arm.  Untick Auto-apply.  Press `Clear Song-DEFAULTS` (hint shown, Show MIDI Number still ticked, as in 30a).  Select Inspect and click Section number **2**: the control unticks.  That is navigation, not Auto-apply.  Repeat the same with the Transport's Next, then Previous Section.

## Not verified in a browser

- Layout of the top row (two wide captions), the row's colour (`#fff6cf`), and the sticky header with four stuck rows while scrolling a long Song.
- Button enabling/disabling after navigation.
- The `title` tooltips and the Legend sentence.
