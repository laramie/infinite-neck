# sprint-148 Iteration 4 Round 5 

Having worked most of the way through Round 4 testing, we are opening Round 5 to keep the code changes and the new test plan cleanly separate from Round 4.  This Round heavily references Round 4, but new responses and fixes should be marked Round 5 for clarity.

This is the Design Team's response to `_doco/design/sprints/148-displayOptions-diff/148-it4-round-4-analysis.md`.

# Design Team Round 5 Answers to Round 4 Copilot questions

## Answers to heading section 7. Questions

**Q1.**  Should the Fingering radios (`#rbFinger0`-`#rbFingerT`, keys `1`-`5`) reveal `hideFingering`?  Recommendation: **yes**.

- ANSWER: yes.


**Q2.**  Should choosing Paint mode (button or the first half of a number key) hide the "Palette::Keep is now selected" label even when nothing is revealed?  Recommendation: **yes, as a separate small fix**, since Keep is no longer selected.  Not required for the request above.

- ANSWER: yes.


**Q3.**  Keep the placement-time reveal in `NoteTableController.js`?  Recommendation: **keep**.  After the type is chosen, you can re-check HIDE (this puts you in forced Keep), click Paint, and place a note of that type: the box clears, as in Round 4.  Without it, a hidden type could be painted into while still hidden.

- ANSWER: keep.


**Q4.**  Keep column and row read gates as "leave the control alone" and cell gates as "ignore this cell" (section 2.1)?  Recommendation: **keep**.

- ANSWER: keep.


**Q5.**  What did the Test 8.4 FAIL expect, and was it observable in that state?  (Section 3, candidates 1-3.)

- ANSWER: The new test plan wording should fix this.  Please include re-worded and new test recipies as new numbers for clarity, rather than fixing the older test recipies.  Please start at recipe steps 13 and 14 as you suggested, and add old step 8 as new step 15.


**Q6.**  Fix the blank `currentColorDict` write by skipping `undefined` / `null` live values in SaveDiff and SaveAll?  Recommendation: **yes**, it is the only change here to the plan engine.

- ANSWER: yes.

# Round 5 Testing Report

The Tutorial bypass was a good call, and it works in testing.  Users cannot select a radio palette button or use those keyboard shortcuts in strict mode, but we are able to enter Easter-egg Ctrl+Shift+m to get into sneaky command-line and change things in otherwise hidden View and Palette pages and confirm that the HIDE as programmed by the Tutorial author is protected.

New Step 13: PASS.

New Step 14: PASS.

New Step 15: PASS.



