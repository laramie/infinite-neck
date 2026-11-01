# sprint-148 Iteration 6

Purpose of this Iteration is to add feature to save Song-DEFAULTS as a bridge between DEFAULTS and storing base options in Section 1.

# Discussion

After using SaveDiff for a while, we see that our original idea of just storing basic defaults for a Song in Section 1 leads to brittleness. We anticipate more problematic brittleness in the event we wish to change DEFAULTS.  Further, the DisplayOptionsMatrix makes it very easy to see and edit these settings, and to see and organize the cascade flow from DEFAULTS through LIVE to the Sections.  We'd like to stop making Section 1 have this special duty.  We would like to continue to allow this practice, and leave as-is the working songs that use this idiom.

But moving forward, new songs, and probably any song that gets edited and re-worked should follow a new idiom: save Song defaults for View options in a Song.displayOptionsDefault block in the Song JSON file.

# UI

We think the simplest UI would be two new buttons: 
- Placement: in the top row between `#btnApply_Matrix` and `# btnFloatSection_divDisplayOptionsMatrix` with simply some more `&nbsp;` spacing.
- Writing button: 
  - Caption: "Current to Song-DEFAULTS"
  - id: `#btnCurrentSectionToSongDisplayOptions`
  - action: Does a copy of the Current Section to the new "Song-DEFAULTS" display row between "DEFAULTS" and "LIVE".  If the author wants a full "SaveAll" then he simply does SaveAll on the Current Section first. Therefore, if he only does SaveDiff, then the Song.displayOptionsDefault block will be sparse.
- Clear button: 
  - Caption: "Clear Song-DEFAULTS"
  - id: `#btnClearSongDisplayOptions`
  - action: clears the block.  As long as the implementation treats empty block and missing block the same (must for old songs), then we don't care if Clear leaves a named, empty block--whatever makes more sense for the implementation is fine. 

At this time we feel that this pair are not Tool buttons, and don't apply to various rows the way a Tool button would.  The do, however, act on the "Current Section", which is under the control of the author.  In the event of a bad choice, he can immediately or at any time use the Clear button, so it need not consume the Undo stack. 

We will tweak the new captions, fonts, and spacing during testing, so don't worry if some of them seem overly wide.

# Request

Write a succinct implementation plan in `148-it6-implementation-plan.md` to add the two buttons, deal with missing/empty block, add the display row, and handle the new cascade.  Include any questions we need to answer before coding.

# Answers after Implementation Plan

Round 1 can be considered our first Request, the generation of the Implementation plan first draft, the re-writing of the Implementation Plan as second draft for our chat refinement of ignoring blocks when copying Current Section into Song-DEFAULTS.

Round 2 is our request below, plus the implementation/coding.

## Implementation Plan section "7. Questions" ANSWERED

Numbers are kept from the first draft so earlier chat references still work.  **Q2, Q3 and Q9 are decided (D1-D3, D7) and no longer open.**  Q11 and Q12 are new.

**Q1. What does a "copy" take from the Current Section?**  Its stored `displayOptions` cells only.  *Recommend:* yes, exactly that (as the design says).  The Section's own cells stay, so they show white ("repeats the inherited value") until the next SaveDiff or Clear Section removes them.  Alternative: the button also removes the now-redundant cells from the Section ("move" rather than "copy", the word the sprint overview uses).  Which?

- ANSWER: Fixed to "copy" in sprint overview.  We want "copy" and not move.  In fact, for editing flow, we'd like to leave the exemplar row (the Current Section) un-changed so the author can deduce what change has been made, and can undo easily with the Clear button while losing nothing.  If he decides that the new defaults are correct, he can then clean up useless/white cells.  Per our conversation, blocks are also not copied, so leaving the Current Section exemplar alone is consistent.


**Q2. (decided: D3)** Replace, pure mirror.

**Q3. (decided: D1, D4, D6)** Gates are ignored by the copy; gated keys are named in the report.

**Q4. Undo.**  *Recommend:* these two buttons do not touch the one-level Undo slot (as the design implies).  Alternative: include the Song block in the snapshot so `/vpmu` and Undo cover it, at the cost of overwriting the last Undo.

- ANSWER:  Accept recommendation. 

**Q5. `/vdd`.**  The report is pinned by a golden file.  *Recommend:* leave `/vdd` as is for now (only the Matrix shows Song-DEFAULTS).  Alternative: a Song-DEFAULTS row only when the block is non-empty (golden unaffected for Songs without one).

- ANSWER: Accept the recommendation.

**Q6. Apply after the buttons.**  A change always alters what Apply does.  *Recommend:* reuse the Matrix's existing behavior (hint "press Apply", or auto-apply when that box is checked and the controls are clean).  Is that right for a Song-level change, or should these always apply?

- ANSWER: Accept the recommendation.

**Q7. Clicking Song-DEFAULTS cells.**  *Recommend:* same as DEFAULTS cells: Inspect and Key r / Key w work, the cell Tools (Clear Cell, Store Cell, Cell r/w) do nothing there; per-key editing of Song-DEFAULTS is out of scope (only the two buttons write).  OK?

- ANSWER: Yes. Accept the recommendation.

**Q8. Command line.**  Add `/vpm` equivalents for the two buttons (they are cheap: same plans)?  *Recommend:* not in this iteration; add on request.

- ANSWER: Accept the recommendation. The action is very dependent on seeing the Matrix.  Command-line is therefore risky.

**Q9. (decided: D1, D2, D7)** The two buttons override column write-blocks (and every other gate).  The one rule is: "write-blocked cells are skipped by SaveDiff, SaveAll and Clear Section; the two Song-DEFAULTS buttons are explicit author actions and override all gates."

**Q10. Naming.**  The field is `displayOptionsDefault` (singular, as in the design text).  The UI says "Song-DEFAULTS".  Keep both?

- ANSWER: Keep both.  The field is clearer that Default (the singular block) applies to displayOptions (the plurality of properties). The caption matches the DEFAULTS caption that implies a plural collection of properties in one row.

**Q11. (new) Show dormant Song-DEFAULTS values?**  Because of D1/D5 the block can hold values that are not applied (column read-blocked key, adapter-blocked key).  The existing DEFAULTS and LIVE cells carry no gate classes, so by default the Song-DEFAULTS row would show such a value as an ordinary cell.  *Recommend:* Song-DEFAULTS cells carry the **column and adapter** classes (`dmColGateR/W`, `dmAdapterKey`) like Section cells do, so the existing View Column/Key Gates overlay shows a dormant value as blocked.  No row or cell gates apply to this row.  Alternative: plain cells, and Inspect explains it.

- ANSWER: Use the Alternative.  Because the Tools don't apply to the special rows "DEFAULTS", "Song-DEFAULTS", "LIVE", we'd prefer to keep these as simple reports of values stored and read/reported, without fancy blocks.  We feel that being able to apply and clear blocks on the Sections using Tools mean that all possible states are still accessible.  One of the paths to setting these states is re-writing the Song-DEFAULTS, obviously, but keep implying that that is a heavy-handed, one-shot fix that can be Cleared or re-written at will.


**Q12. (new) Confirmation when overriding gates?**  With D1 the buttons never stop on a gate.  *Recommend:* no confirmation dialog; the status report names the gated keys (D4), and Clear is the recovery (the design already says the buttons need not consume Undo).  Alternative: a one-line confirm only when gated keys are involved.

- ANSWER: Accept the recommendation.

# Request Round 2

Questions are answered.
Core changes are APPROVED as requested in the plan.
Please proceed to coding.

