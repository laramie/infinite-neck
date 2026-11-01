# sprint-148 Iteration 7 testing report


## Acceptance test recipes 37-42

Setup: [songs/tests/display-options.json](../../../../songs/tests/display-options.json) or any Song with 4+ Sections.  Open View and the Matrix.

### 37. Section drawer SAVE Diff is magenta (item 1)

1. Open the Section drawer.  Change a control on the View page (say Note Font): SAVE Diff turns magenta on the View card, the Matrix and the Section drawer.
- RESULT: PASS

2. Click the drawer's **Save Diff**: all three go back to normal.
- RESULT: PASS

3. Reload, change a control **before** you ever open the Section drawer, then open it: its SAVE Diff is already magenta.
- RESULT: PASS

### 38. Read-blocks do not stop writes (item 2)

1. Section 2 is Current and stores `noteFont` (Section 1 stores a different one).  Choose **Cell r** and click Section 2's `noteFont`.  Press **Apply from Model**: the control shows Section 1's font.  SAVE Diff is **not** magenta.
- RESULT: PASS

2. Choose **Store Cell**, change Note Font by hand to a third font, click Section 2's `noteFont`: the cell takes the live value, the status line has no "skipped", and the cell still shows the Cell r hatch.  (The old result was PARTIAL PASS here.)
- RESULT: PASS

3. Do the same in a Section that is not Current: the cell is written.
- RESULT: PASS

4. Repeat 2 with a **Key r** on `noteFont` and with a **Section r** on the Section: the cell is written each time.
- RESULT: PASS

5. With a **Cell w** on the cell, Store Cell reports `skipped noteFont (write-blocked)`.
- RESULT: PASS

6. Set Note Font by hand on a Section with a Cell r on its `noteFont` cell and press **SAVE Diff**: the cell is written.  With the control left at the inherited value, SAVE Diff changes nothing and does not delete the cell (check in the Matrix).
- RESULT: PASS

7. **Inspect** a Cell r cell: the status line no longer says SAVE Diff and Save All skip it.

- RESULT: PASS


### 39. Space under the bottom row (item 3)

1. In a Song with several Sections, scroll the Matrix to the end and hover the bottom row: the horizontal scrollbar thumb appears **below** the cells.  Click cells in the bottom row with a Tool: every click lands.
- RESULT: PASS.  Note, we can still use two-finger trackpad scrolling when the Matrix is floated, but the scrollbar disappears.  When docked, hovering the mouse near the bottom of the table makes the scrollbar appear.  This might be some browser weirdness about scrollbars and floated windows.  If so, leave it. If there is a known fix, apply it.  We generally use two-finger scrolling, but some users might not.  If there is no stable, known fix, it's OK because docking fixes it.


2. Loop the Song with the Matrix open: when the Current row is the last one, it stays above the blank band.
- RESULT: PASS


### 40. Help Tips (item 4a)

1. Open View: the Display Options card shows **Help Tips ▶** and no tips text.
- RESULT: PASS

2. Click it: the panel opens and the arrow is ▼.  Click again: the panel closes and the arrow is ▶.
- RESULT: PASS


### 41. Show Messages checkbox (item 4b)

1. Open Help Tips.  Unchecked: click **SAVE Diff**, **CLEAR** and **Save All** on the View card, and **Save Diff** in the Section drawer: the Messages panel does **not** open, and the User Log tab has a `DisplayOptions` row for each.  SAVE Diff does not turn magenta when you tick or untick the checkbox.
- RESULT: PASS

2. Check it and repeat: Messages opens with the report each time.
- RESULT: PASS

3. The Matrix stays quiet in both states (status line only).
- RESULT: PASS


### 42. `/vpms` (item 4c)

1. `/vpm`: the menu shows `s)how messages [false]`.  Press `s` (`/vpms`): the Help Tips checkbox becomes checked.  Open `/vpm` again: `[true]`.
- RESULT: PASS

2. Click the checkbox off: `/vpm` shows `[false]`.  `/vpms` again checks it.
- RESULT: PASS

3. `/vps` (SAVE Diff) still saves; `/vpmo` still opens the Matrix.
- RESULT: PASS

