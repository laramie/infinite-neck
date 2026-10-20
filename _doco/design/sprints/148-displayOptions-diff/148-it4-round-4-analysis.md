# Sprint 148 (displayOptions-diff), Iteration 4, Round 4: analysis of testing report 2

date: 20261020

Requested by [148-it4-round-4-testing-report-2.md](148-it4-round-4-testing-report-2.md).  Earlier reports: [round 3 implementation report](148-it4-round-3-implementation-report.md), [round 4 testing report 1](148-it4-round-4-testing-report.md).  Sprint overview: [sprint-148.md](sprint-148.md).

**No code was changed for this report.**  One throw-away `node -e` call was used to confirm the `currentColorDict` finding in section 4.

## 0. Summary

| # | Item | Verdict | Action |
|---|---|---|---|
| 1 | Change Requested: reveal HIDE by choosing a note type (presentation.js) | Doable, small.  Two traps: the radio `change` event does not fire when the radio is already selected, and keys `1`-`5` are in the same radio group | Section 1.  Questions Q1-Q3 |
| 2 | Test 8.1 (column read gate): "only after clearing the live control" | **Not a bug.**  It is rule R2 working as designed.  The test wording is what is wrong | Section 2.  Reword the step; question Q4 about the asymmetry with `cell:r` |
| 3 | Test 8.4 (`/vpmgas 2,read-blocked`) marked FAIL | The report describes correct behavior, so I cannot see what failed.  Probably an expectation that cannot be observed in that state | Section 3.  Q5 asks for the expectation; a better test recipe is given |
| 4 | Test 8.5 (`/vpmc 2,noteFont` clears nothing) | **Correct behavior.**  The cell does not exist in Section 2.  The report text ("already match") is misleading | Section 5.  Optional wording fix |
| 5 | Test 2 note: SaveDiff "wants to write" a blank `currentColorDict` | **Reproduced.**  Real, harmless-looking, but wrong.  Cause found | Section 4.  Q6 |
| 6 | Everything else (1-7, 9-12 of the plan) | PASS | none |

## 1. Change Requested: HIDE is cleared by choosing the note type

### 1.1 What the code does today

- Checking any HIDE checkbox runs the change handler in [infinite-neck.js](../../../../infinite-neck.js): `turnOnKeep()` (forced Keep) and the "Palette::Keep is now selected" label.
- Keys `6`, `7`, ... call `paletteUtils.activateUiControl()` twice: first `#idPaletteModePaint`, then the note-type radio ([key-handlers.js](../../../../key-handlers.js#L693)).  `activateUiControl()` calls `el.click()`.
- The `rbPaletteMode` handler and the `rbHighlight` handler in `installRBColorChangeEvents()` only change palette mode and cursor.  Since commit `d9a6dcf` they do **not** call `turnOffHiding()`.  That was the earlier bugfix (a flashcard / name-that-note Song hides Named notes, and pressing `6`/`7`/`8` revealed the answer key).
- Today the only un-hide path is placing a note: `NoteTableController.js` calls `turnOffHiding(noteType)` when the palette is not in Keep mode.  Round 4 made that clear only the matching checkbox, and rescan the dirty flag.

### 1.2 What you asked for

Choosing a note type reveals that type, and only that type:

| Choice | Clears |
|---|---|
| `#idNamedNotes` / key `6` | `hideNamedNotes` |
| `#idSingleNotes` / key `7` | `hideSingleNotes` |
| `#idTinyNotes` and `#rbBend` | `hideTinyNotes` |
| `#rbFinger*` (keys `1`-`5`) | `hideFingering` (see Q1) |
| `#idMidiPitches`, `#idMidiPitchesSingle` | nothing (they are highlights, not placed kinds) |

This is the old behavior, made granular, and limited to the `rbHighlight` group.  The Paint / Clear / Dropper mode radios and the color radios still reveal nothing.

### 1.3 Proposed change

1. In `installRBColorChangeEvents()`, the `rbHighlight` handler calls the existing `turnOffHiding(noteType)` with the radio's value.  The granular logic, the dirty-flag rescan and the `clearAll(); replay();` already exist from Round 4.
2. Move the note-type to checkbox mapping out of `infinite-neck.js` into the pure module `templates/display-options/displayOptionsMeta.js`, so Jest can test it without a DOM (our rule: no jQuery or JSDom in Jest).  The browser behavior stays a UI acceptance test.
3. Leave the placement-time call in `NoteTableController.js` in place (Q3).

### 1.4 Traps found

**Trap A: `change` does not fire on an already-selected radio.**  Pressing `6` when `#idNamedNotes` is already the selected note type calls `el.click()`.  A click on a checked radio fires `click` but **not** `change`.  A `change`-only handler would leave "HIDE NamedNotes" checked, which is exactly your most likely scenario (Named is the default note type).  The `rbColor` radios in the same function already use a `click` handler for this reason.  So the new reveal must be bound on `click`, not on `change`.  A mouse click on the selected radio then also works, as does clicking its label.  The handler is idempotent, so a click that also causes a `change` is harmless.

**Trap B: the Fingering radios are `rbHighlight` too.**  `#rbFinger0` ... `#rbFingerT` have `name="rbHighlight"`, so keys `1`-`5` would reveal Fingering.  I think that is right (same "choose the note type" rule), but it was not in your list.  Q1.

**Trap C (existing, adjacent): the stale warning.**  Key `6` clicks Paint first, which leaves forced Keep.  If another HIDE box (say Tiny) is still checked, the red "Palette::Keep is now selected" label stays visible, although Keep is no longer selected.  Today only `turnOffHiding()` hides that label.  With the new `rbHighlight` handler it is hidden whenever a note type is chosen, which covers keys `6`/`7`.  Clicking the Paint mode button alone, with a HIDE box checked, still leaves it.  Not part of this request.  Q2.

### 1.5 Side effects to be aware of

- **Dirty flag and Section automation.**  If a Section stores `hideNamedNotes: true`, pressing `6` unchecks the box and SAVE Diff turns magenta (correct).  The next Section navigation re-applies the stored `true`.  This is intended: the toggle is a live control until you SAVE Diff.
- **The flashcard Song regression** that caused `d9a6dcf` returns for exactly one case: a Song that hides type X, where the learner presses the key for type X.  Flashcards that hide Named and have the learner place Single or Tiny are unaffected.  If a quiz ever needs "Named hidden and Named chosen", it can use the Paint mode button (reveals nothing) or an unchanged radio selection with the keys disabled.  I do not think this needs a switch, but it is the cost of the request.
- **Cost.**  Un-hiding a type runs `clearAll(); replay();`, so a key press during a loop repaints the table once.  It only happens when a box was actually checked.

### 1.6 Tests

- Jest: the mapping (all seven values, plus an unknown value gives nothing) in the pure module.
- Browser acceptance (new steps for the plan): 
  1. Place NamedNotes, check HIDE NamedNotes (they vanish, label shows), press `6`.  Expected: box unchecked, notes shown, label gone, SAVE Diff magenta.
  2. Same with a different note type selected first (so `6` really changes the radio).
  3. Check HIDE Named and HIDE Tiny, press `6`.  Expected: only Named is revealed, Tiny stays hidden.
  4. Check HIDE Single, press `6`.  Expected: nothing is revealed.
  5. Check HIDE Fingering, press `3`.  Expected: Fingering revealed (if Q1 is yes).
  6. Check HIDE Named, click the Paint mode button, no note-type change.  Expected: still hidden (unchanged).
  7. Loop while pressing `7`: no flicker or double repaint after the first press.

## 2. Test 8.1: column read gate "only works after clearing the live control"

Your observation is exactly the rule:

- A Song (column) read gate on `noteFont` means: when navigating, the resolver does **not** apply `noteFont` at all (rule R2: the key is removed from the result and the entry is marked `blocked`).  The control **keeps whatever it holds**.
- So the gate is invisible unless the live control differs from what the Section would have applied.  If the control already holds the stored font, nothing changes.  If you set it to some other font, that other font stays on every Section.  Both observations in your report are R2 behaving correctly.
- "Navigating no longer applies Note Font" is true.  The step failed to say that you must first make the live value different from the stored one, which is why it looked like it only worked "after clearing the live control".

Recipe for the step, so it is observable:

1. Section 1 stores `noteFont: Cardo` (SaveDiff).  Section 2 stores `noteFont: Eczar`.  Loop: the font follows the Sections.
2. `/vpmgak` `noteFont,read-blocked`.  `/vdd` header shows `col:r`.
3. Navigate to Section 1 (the control still shows the last font).  Pick Vollkorn by hand.  Navigate 1 -> 2 -> 1.  Expected: Vollkorn on all.  (Without the gate it flips Cardo / Eczar.)
4. `/vpmgdk` `noteFont`, navigate again.  Expected: back to Cardo / Eczar.

### 2.1 The asymmetry (Q4)

Since the Round 4 fix there are two meanings of "read-blocked":

| Gate | Meaning | Control on navigation |
|---|---|---|
| cell (`cell:r`) | this stored value is ignored, as if the cell did not exist | takes the earlier Section's value, or the **default** |
| row (`*`), column (Song), adapter | this key (or all keys) are off-limits at this Section | **left alone** |

This is what you asked for in Round 4 (the cell case) and what Round 3 specified (the row and column cases), so I am not proposing a change.  I raise it because it is the one place where "read-blocked" gives two visible behaviors, and it will matter when the Matrix page adds a Column click: a user who clicks "read-block" on a column may expect either.  Both options work with the existing resolver:

- **Keep as is (recommended).**  Row and column gates are an "automation off" switch for the key: the Song stops steering it and the user's control wins.  A cell gate is "mute this value".
- **Unify toward the cell meaning.**  Column and row gates would also mean "ignore stored values", so the key follows the default or the earlier value.  The "automation off" use case (the macro and Song Widgets use case you confirmed earlier, where clicks must not be undone) would then need a different gate, so I would not unify.

## 3. Test 8.4: `/vpmgas` `2,read-blocked`, marked FAIL

The report says the row read gate is applied and the cell write gate on `showMidiNum` is preserved.  That matches the code: row and cell gates live in separate lists in the Section's `displayOptionGates` (`readBlocked: ['*']`, `writeBlocked: ['showMidiNum']`), and `planGate` never touches the other list.  So the visible result described is correct, and I cannot tell which expectation failed.  Likely candidates:

1. **"Section 2 applies nothing" is not observable in that state.**  A row read gate makes the resolver return no keys for Section 2 (R2), so the controls are left alone.  If Section 2 stores no cells and inherits the same values the controls already hold, then with or without the gate nothing visibly changes.  Also, gate changes never re-apply the controls (Round 3, Q10): the effect only appears on the next navigation into Section 2.
2. An expectation that adding a row gate replaces or clears the existing cell gate.  It does not, by design (gates add, `/vpmgds` removes).
3. An actual defect I cannot see from the report, for example the `/vdd` display of the row.  Please say.

Q5 asks which.  A recipe that makes the step observable:

1. Section 1 stores `noteFont: Cardo`; Section 2 stores nothing.  Section 3 stores `noteFont: Eczar`.
2. Go to Section 3 (Eczar).  `/vpmgas` `2,read-blocked`.
3. Navigate 3 -> 2.  Expected: Eczar **stays** (Section 2 applies nothing).  Without the gate it would show Cardo (inherited from Section 1).
4. `/vpmgds` `2,read-blocked`, navigate 3 -> 2.  Expected: Cardo.
5. With `showMidiNum` write-blocked on Section 2: SaveDiff in Section 2 reports it as skipped, and both gates show in `/vdd` (`row:r` and `cell:w`).

## 4. `currentColorDict` is written blank by SaveDiff (found in Test 2)

Reproduced with a throw-away script: SaveDiff on a Section with live `currentColorDict: undefined` returns a `setCell` for it with no value, whereas an empty string `''` does not.

- `controlsToDisplayOptions()` reads `getSong().currentColorDict`, which is `undefined` for a new Song (and any Song file that never chose a dictionary).
- The dirty baseline (`displayOptionsDirtyBaseline`) is cloned with `JSON.parse(JSON.stringify(...))`, which **drops** `undefined` properties.  So the baseline has no `currentColorDict` key.
- `planSaveDiff` iterates the keys present in the live object (the key is present, with the value `undefined`).  The key is not in the baseline, so the "unchanged" test (`has || hasBaseline`) is false and it falls through to `setCell`.
- The cell holds `undefined`.  It shows as a green blank in `/vdd`, counts as a stored cell (so the Section gets a row and the key becomes "automated", but with no default it is harmless), and vanishes on Save/reload (`JSON.stringify` drops it).  So the in-memory model and the reloaded Song disagree.  That is a small but real defect.

Proposed fix (not applied): in the plan engine, treat a live value of `undefined` (and `null`) as "no value": skip the key in `planSaveDiff` and `planSaveAll`, with no cell.  It is a two-line change in `knownKeysOf` plus a Jest test.  Q6.

## 5. Test 8.5: `/vpmc 2,noteFont` clears nothing

Correct: `planClearCell` found no `noteFont` cell in Section 2 (it is stored in Section 1), so there is nothing to delete.  The command reports `nothing to change (1 cell(s) already match)`, which reads like a SaveDiff message.  Suggested wording (optional, trivial): `Section 2 has no noteFont cell (nothing to clear)`.  The test step should say "on a Section that stores the cell".

## 6. Suggested additions to the acceptance plan

- Step 8.1 and 8.4 as rewritten in sections 2 and 3.
- 8.5: split into "stores the cell: cleared" and "does not store it: reports nothing to clear".
- New step 13 (HIDE reveal, section 1.6), after Q1 to Q3 are answered.
- New step 14 (if Q6 is yes): SaveDiff on a new Song with `currentColorDict` unset writes only the changed cell, and `/vdd` has no blank `currentColorDict` cell.
- Cell-gate classes (`cellGateRead`, `cellGateWrite`, `cellGateReadWrite`): confirm in `/vdd` that all three styles show on `cell:r`, `cell:w` and `cell:rw`.

## 7. Questions

**Q1.**  Should the Fingering radios (`#rbFinger0`-`#rbFingerT`, keys `1`-`5`) reveal `hideFingering`?  Recommendation: **yes**.

**Q2.**  Should choosing Paint mode (button or the first half of a number key) hide the "Palette::Keep is now selected" label even when nothing is revealed?  Recommendation: **yes, as a separate small fix**, since Keep is no longer selected.  Not required for the request above.

**Q3.**  Keep the placement-time reveal in `NoteTableController.js`?  Recommendation: **keep**.  After the type is chosen, you can re-check HIDE (this puts you in forced Keep), click Paint, and place a note of that type: the box clears, as in Round 4.  Without it, a hidden type could be painted into while still hidden.

**Q4.**  Keep column and row read gates as "leave the control alone" and cell gates as "ignore this cell" (section 2.1)?  Recommendation: **keep**.

**Q5.**  What did the Test 8.4 FAIL expect, and was it observable in that state?  (Section 3, candidates 1-3.)

**Q6.**  Fix the blank `currentColorDict` write by skipping `undefined` / `null` live values in SaveDiff and SaveAll?  Recommendation: **yes**, it is the only change here to the plan engine.

## 8. Not verified

Everything in sections 1.4, 1.5 and 4 comes from reading the code (and the one script in section 4).  Nothing has been run in a browser.  Trap A (`click` versus `change` on an already-selected radio) is standard HTML behavior but is worth confirming with step 1.6-1 using the already-selected Named radio.
