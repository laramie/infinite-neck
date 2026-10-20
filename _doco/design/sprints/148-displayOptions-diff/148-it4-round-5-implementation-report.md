# Sprint 148 (displayOptions-diff), Iteration 4, Round 5: implementation report and acceptance test recipes

date: 20261020

Answers to [148-it4-round-4-analysis.md](148-it4-round-4-analysis.md) are in [148-it4-round-5-design.md](148-it4-round-5-design.md): Q1 yes, Q2 yes, Q3 keep, Q4 keep, Q5 "new recipe numbers 13, 14, and old step 8 as new step 15", Q6 yes.  Sprint overview: [sprint-148.md](sprint-148.md).

Jest: 74 suites, 870 tests, all passing.  Nothing here has been run in a browser.

## What changed

| # | Change | Where |
|---|---|---|
| Q1 | Choosing a note type reveals that type's HIDE checkbox, including the Fingering radios (`rbFinger0`-`rbFingerT`, keys `1`-`5`) | [infinite-neck.js](../../../../infinite-neck.js) `installRBColorChangeEvents()` |
| Q1 | The note-type to HIDE-key mapping is now a pure, Jest-tested module function `hideKeyForNoteType()`; `turnOffHiding(noteType)` uses it | [templates/display-options/displayOptionsMeta.js](../../../../templates/display-options/displayOptionsMeta.js) |
| Q2 | Choosing Paint, Clear or Dropper mode hides the "Palette::Keep is now selected" label, even when a HIDE box stays checked | `installRBColorChangeEvents()`, the `rbPaletteMode` handler |
| Q3 | Placement-time reveal in `NoteTableController.js` is unchanged | none |
| Q4 | Gate meaning unchanged (cell = ignore the cell; row, column, adapter = leave the control alone) | none |
| Q6 | SaveDiff and SaveAll skip a live value that is `undefined` or `null`; no blank `currentColorDict` cell | [templates/display-options/displayOptionsPlan.js](../../../../templates/display-options/displayOptionsPlan.js) `knownKeysOf()` |

Details of Q1:

- The reveal is bound on `click` and on `change` of `input[name="rbHighlight"]`.  A click on an already-selected radio fires only `click`, which is the common case of pressing `6` while Named is already selected.  Both handlers call the same idempotent `turnOffHiding(noteType)`, so a real click that fires both is harmless; only the first one repaints.
- `MidiPitches` and `MidiPitchesSingle` (Pitch, Multi) reveal nothing.  `Bend` reveals `hideTinyNotes`.
- The reveal is skipped when the palette is `keepLocked` (strict tutorial mode), so a tutorial that hides notes is not undone by a radio click.  This guard is mine, not in your answers; it uses the same `keepLocked` test as the cursor code beside it.
- The Paint, Clear, Dropper and color radios still reveal nothing.  Only a note-type choice, or placing a note, does.
- Revealing a type unchecks the box programmatically, then rescans the dirty flag, so SAVE Diff turns magenta, as in Round 4.

One test-only change: two assertions in [display-options-table.test.js](../../../../_tests/jest/display-options-table.test.js) were stale after your committed `display-options.js` / CSS work (`background-color: darkgray` is now `#303030`, and the literal `cell:r` text is off because `WANT_LITERAL_CELLMARK_TEXT` is false).  They now assert `#303030` and the `cellGateRead` class.  No product code was changed for that.

## Acceptance test recipes (new numbering)

Steps 1-12 of the [Round 3 plan](148-it4-round-3-implementation-report.md) stay as reported, except step 8, which is replaced by step 15.

Note: with `WANT_LITERAL_CELLMARK_TEXT` false, `/vdd` no longer prints `cell:r`, `cell:w`, `cell:rw`.  Cell gates show as the `cellGateRead`, `cellGateWrite`, `cellGateReadWrite` classes (your hatches).  Row and column gates still print `row:` and `col:`.

### 13. HIDE is revealed by choosing a note type (Round 4 request, Round 5 Q1-Q3)

Setup: new Song, place a few NamedNotes, SingleNotes, TinyNotes and fingerings (so each type has something to hide).

1. **Named, already selected.**  Select Named (it is the default radio).  Check HIDE NamedNotes.  The NamedNotes vanish and "Palette::Keep is now selected" shows.  Press `6`.
   - Expected: HIDE NamedNotes is unchecked, the NamedNotes are back, the label is gone, SAVE Diff is magenta.
2. **Named, not selected.**  Select Single (`7`).  Check HIDE NamedNotes, then press `6`.  Same expected result as 1.
3. **Only the matching type.**  Check HIDE NamedNotes and HIDE TinyNotes.  Press `6`.
   - Expected: Named notes are back and HIDE NamedNotes is unchecked.  Tiny notes stay hidden, HIDE TinyNotes stays checked.  The label is gone (Keep is no longer selected, even though a HIDE box remains).
4. **A different type reveals nothing.**  Check HIDE SingleNotes only.  Press `6`.
   - Expected: Single stays hidden and checked, the label is gone, and nothing is repainted.
5. **Tiny and Bend.**  Check HIDE TinyNotes.  Choose Bend (`#rbBend`).  Expected: Tiny notes (and Bend notes, which are Tiny) are back, the box is unchecked.  Repeat choosing Tiny instead of Bend.
6. **Fingering.**  Check HIDE Fingering.  Press `3`.  Expected: the fingering is back and the box is unchecked (Q1).
7. **Highlights reveal nothing.**  Check HIDE NamedNotes.  Choose Pitch (`#idMidiPitches`), then Multi.  Expected: still hidden and checked.
8. **Mode buttons.**  Check HIDE NamedNotes (label shows).  Click the Paint button.
   - Expected: the label is gone (Q2), the notes stay hidden and the box stays checked.  Click Clear, then Dropper with the box checked: the label stays gone and nothing is revealed.  Repeat after re-checking HIDE for each.
9. **Color radios.**  Check HIDE NamedNotes and click a color.  Expected: nothing is revealed.
10. **Placement still reveals (Q3).**  Check HIDE SingleNotes, click Paint (label goes), choose a non-Single type (say Named), then place a Named note.  Expected: no Single reveal.  Now choose Single without pressing `7` by clicking the radio label: the Single reveal of step 4 applies.  Re-check HIDE SingleNotes, click Paint, then place a Single note on the table: HIDE SingleNotes is unchecked and the Single notes appear.
11. **Loop.**  Loop 3 Sections while pressing `7` repeatedly with HIDE SingleNotes checked.  Expected: reveal on the first press only; no flicker, no extra repaints after it.
12. **Manual Keep.**  Click the Keep button yourself with no HIDE box checked.  Expected: unchanged behavior (the cursor is `no-drop`, no label).
13. **Strict tutorial** (if you have one handy): with notes hidden by the Song, a radio click does not reveal them.

### 14. SaveDiff and a blank `currentColorDict` (Round 4 test 2 note, Round 5 Q6)

1. New Song (it has no color dictionary chosen).  On Section 1 change Note Font.  Click SAVE Diff.
   - Expected: Messages says `wrote noteFont` (no `currentColorDict` in the list), and `/vdd` shows one row with only `noteFont` filled and no blank green `currentColorDict` cell.
2. Click SAVE Diff again.  Expected: `nothing to change`.
3. Choose a color dictionary, click SAVE Diff.  Expected: `wrote currentColorDict` with its value (a real value is still stored).
4. `/vpa` or Save All on a Song without a dictionary: no blank `currentColorDict` cell is written.
5. Save the Song, reload it.  Expected: the same cells in `/vdd` as before the save.

### 15. Gates (replaces old step 8)

Setup for all sub-steps: a new Song with 3 Sections.  Use Note Font values Cardo, Eczar and Vollkorn.

Why this step was reworded: a column or row **read** gate means "the Song stops steering this key, the control keeps what it holds", so it can only be seen when the live control differs from what the Section would have applied.  A cell **read** gate means "ignore this stored cell", and it can be seen directly.  Gate commands never re-apply the controls; the effect shows on the next navigation into a Section.

**15.1 Column read gate (`/vpmgak`).**
1. On Section 1 choose Cardo and click SAVE Diff.  On Section 2 choose Eczar and click SAVE Diff.  Loop: the font follows Cardo then Eczar.
2. `/vpmgak`, input `noteFont,read-blocked`.  `/vdd` header for `noteFont` shows `col:r` and the read hatch.
3. Go to Section 1.  By hand choose Vollkorn.  Navigate 1 -> 2 -> 1 -> 2.
   - Expected: Vollkorn stays on every Section (without the gate it would flip between Cardo and Eczar).
4. `/vpmgdk`, input `noteFont,read-blocked`, then navigate 1 -> 2.  Expected: Cardo, Eczar again.
5. `/vpmgdk` removes only what you name: run `/vpmgak` with `noteFont` (both) then `/vpmgdk` with `noteFont,read-blocked` and confirm the write half remains in the header.

**15.2 Column write gate.**
1. `/vpmgak`, input `noteFont,write-blocked`.  On Section 3 choose Vollkorn and click SAVE Diff.
   - Expected: the report says `skipped noteFont (write-blocked)` and no cell is stored in Section 3.

**15.3 Cell write gate (`/vpmgac`).**
1. `/vpmgac`, input `2,showMidiNum,write-blocked`.  Go to Section 2, toggle MIDI numbers, click SAVE Diff.
   - Expected: `skipped showMidiNum (write-blocked)`.  CLEAR on Section 2 leaves that cell if it has one (an explicit write block stops Clear).
2. `/vdd`: the cell shows the `cellGateWrite` style.

**15.4 Row read gate (`/vpmgas`), observable form.**
1. Section 1 stores `noteFont: Cardo`.  Section 2 stores nothing.  Section 3 stores `noteFont: Eczar`.
2. Go to Section 3 (the control shows Eczar).  `/vpmgas`, input `2,read-blocked`.  The `/vdd` row 2 gets the row read style.
3. Navigate 3 -> 2.
   - Expected: Eczar **stays** (Section 2 applies nothing).  Without the gate it would show Cardo (inherited from Section 1).
4. `/vpmgds`, input `2,read-blocked`.  Navigate 3 -> 2.  Expected: Cardo.
5. With `showMidiNum` write-blocked on Section 2 (15.3) and then `/vpmgas 2,read-blocked`: both gates show in `/vdd` (row read plus the cell write style), and the cell write gate is still there after adding the row gate (gate edits add to each other, they do not replace).

**15.5 Clear one cell (`/vpmc`).**
1. Section 1 stores `noteFont`, Section 2 does not.  `/vpmc`, input `1,noteFont`.  Expected: the cell is removed.
2. `/vpmu` undoes it.  `/vpmc`, input `2,noteFont`.  Expected: nothing is removed, and the report says nothing was cleared (Section 2 does not store the cell; this is correct).  With a cell write gate on the target cell: `skipped noteFont (write-blocked)`.

**15.6 Undo (`/vpmu`).**
1. After any gate command (15.1, 15.3, 15.4), `/vpmu` restores the gates as they were.  A second `/vpmu` reports `nothing to undo` (one level).

**15.7 Cell read gate (the Round 4 fix; spot check).**
1. Section 1 stores `autoColor: off` (press `c`, then SAVE Diff).  `/vpmgac`, input `1,autoColor,read-blocked`.
   - Expected: `/vdd` shows the `cellGateRead` hatch on that cell.  Loop: Section 1 follows the default (AutoColor on), not the stored off.
2. `/vpmgdc`, input `1,autoColor,read-blocked`.  Loop: Section 1 is off again.

**15.8 Cell gate classes in `/vdd` (visual).**
1. Set `cell:r`, `cell:w` and `cell:rw` on three different cells (`/vpmgac` with `read-blocked`, `write-blocked`, and no value for both).  Expected: three different looks: `cellGateRead`, `cellGateWrite`, `cellGateReadWrite`.  Row and column gates still use `gateRead` / `gateWrite` styles.

## Not verified

- Every browser behavior in steps 13-15, in particular the `click` versus `change` behavior in 13.1 (the one most likely to differ from the code reading).
- The strict-tutorial guard (13.13) has no Jest or browser coverage.
