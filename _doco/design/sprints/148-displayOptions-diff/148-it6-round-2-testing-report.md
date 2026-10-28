## Browser acceptance recipes (26-30)


Use a Song with several Sections.  Open the Matrix (`/vpmo`).

26. **Copy and mirror.**  On Section 2 SaveAll.  Press Current to Song-DEFAULTS.  Expect: the Song-DEFAULTS row shows the same values as Section 2; Section 2's cells are unchanged (white, since they repeat the inherited value); the status line says `Song-DEFAULTS wrote ...`.  Go to Section 3, change one control, SaveDiff, press Current to Song-DEFAULTS again: the row now equals Section 3's cells only (stale keys gone).

- RESULT: PASS


27. **Cascade.**  Clear Section 1's cells.  Press Apply on Section 1, then go to Section 3 and back: Section 1's controls come from Song-DEFAULTS.  Change a control in Section 4 and SaveDiff: only cells that differ from Song-DEFAULTS are stored.  A Section cell that now repeats Song-DEFAULTS is removed by the next SaveDiff.

- RESULT: PASS.  When setting Section 4 to same "Jazz Extensions" as Song-DEFAULTS while Section 3 has "Extensions", it saves in Section 4.  After clearing Section 3, "Jazz Extensions" stays in Section 4, but white since same as Song-DEFAULTS.  Now setting Section 4 to "Extensions" then SaveDiff, "Extensions" is green.  Setting back to "Jazz Extensions" in Section 4 then SaveDiff makes it go gray/empty, because Song-DEFAULTS already has it, and this time there are no other Sections holding values.  Expected.


28. **Clear and reload.**  Press Clear Song-DEFAULTS: the row is blank, the button greys out, controls return to DEFAULTS after Apply.  Press Current to Song-DEFAULTS, save the Song, reload it: the row is restored, and the file contains `displayOptionsDefault` (and no such field after Clear).

- RESULT: PASS


29. **Blocks are ignored.**  Put a cell r on a cell in Section 2, a Key r on `noteFont`, and Section w on Section 2.  Press Current to Song-DEFAULTS: every stored cell of Section 2 is copied, and the status line ends with `gated (overridden): ...` naming them.  `noteFont` is not applied while its Key r is on (dormant), and applies when the Key r is removed.  Clear Song-DEFAULTS removes gated keys as well.  No block was added or removed by either button.

- RESULT: PASS


30. **Old Songs and Undo.**  Open an old Song that uses the Section-1 idiom: its Song-DEFAULTS row is blank and it behaves exactly as before.  Do a Clear Section, then press either new button: Undo still undoes the Clear Section.  The buttons also work in a floating Matrix and with Auto-apply on or off (hint `Controls not re-applied: press Apply, or navigate.` when off).

- RESULT: PASS, EXCEPT: Auto-apply results not clear.  We need a recipe that explicitly gives instructions on how to show a difference with Auto-apply, including what constitutes creating a condition where Auto-apply makes a difference, e.g. clicking on a row in `Section #` Section heading column 0 as opposed to using the Transport, clearing, setting, etc.
- RESULT updated: after the below 30a-30e PASS, this test of recipe 30 is now considered PASS.


### Recipes 30a-30e added
Recipese where added.  We then replied with the Ad hoc testing results below, and got a response and a fix from Copilot below that.  Then we return to testing recipes 30a and on.

# Ad hoc testing results.

1. Writing Cell doesn't clear magenta

We notice that 
- Current is Section 2
- Set Section settings functionSymbols to "Kanji" 
- Click SaveDiff
- SaveDiff is not magenta
- Change live control to "Function"
- SaveDiff is magenta
- Click "Store Cell" Tool
- Click Section 2 functionSymbols
- Cell value is "function"
- SaveDiff is magenta, but Model is in sync with LIVE.
- Click SaveDiff.  Nothing changes, SaveDiff is still magenta.
- Navigate, come back, SaveDiff is not magenta, nothing has changed about Section 2.
- Apply now makes magenta go away, Section still the same.

EXPECTED: once Model in sync with controls, SaveDiff not magenta.

2. "Apply" button caption changed

It seems that "Apply" is applying the Model to the LIVE controls (as designed).  If that is the case, then could button label be changed to "Apply from Model"?  It's a bit programmer-ish, but it is less vague.

# Copilot responds and fixes

Both changes are in. The display-options Jest suites pass (180 tests), but I have not tried either change in the browser.

**SaveDiff staying magenta**

SaveDiff compares the live controls against a snapshot taken when you arrived at the Section. Store Cell wrote "function" into Section 2, but the snapshot still said "Kanji", so the control looked unsaved. Pressing SaveDiff changed nothing, so the snapshot was never refreshed either. Navigating away and back re-took it, which is why the magenta cleared then.

Now, after a Matrix edit or an Undo, any control that already equals what the Section stores or inherits drops out of the unsaved comparison. A SaveDiff with nothing to write does the same. Controls that still differ stay magenta, so a real unsaved edit still shows.

The Matrix's Auto-apply check also reads the unsaved state after the edit now. Before, it read it before, so it could warn "SaveDiff before next Apply" when nothing was unsaved.

The fix is in infinite-neck.js and displayOptionsPlan.js, with the handler change in display-options.builder.js. I added a Jest test, `keysInSyncWithModel`, in display-options-matrix.test.js.

**Apply button label**

It now reads "Apply from Model", and its tooltip says the model overwrites the controls (display-options.html). I did not update docs or the recipes that call the button "Apply".

I did not record these in the testing report, and I did not re-run your steps from it. To check the first fix, repeat them: after Store Cell on functionSymbols the SaveDiff should lose its magenta right away.

Made changes.

### Recipes 30a-30e: Auto-apply (follow-up to recipe 30)

After the above ad hoc testing result and the fixes, we are now back to testing 30a-30e.

The full text (what Auto-apply does, what hides the difference, Setup and Re-arm) is in [148-it6-round-2-implementation-report.md](148-it6-round-2-implementation-report.md), section "Recipes 30a-30e: Auto-apply".  Use the **Show MIDI Number** control and the Matrix **LIVE** row as the thing to watch.

30a. Auto-apply OFF: `Clear Song-DEFAULTS` leaves the control ticked and shows the hint; Apply then unticks it.

- RESULT: PASS

30b. Auto-apply ON: the same press unticks the control at once and says `Applied: controls re-applied from the model.`

- RESULT: PASS

30c. Auto-apply ON, controls dirty: warning, nothing re-applied, your edit protected.

- RESULT: PASS

30d. `Section w` on Section 4 (after the Current Section): no `Applied:` and no hint.

- RESULT: PASS

30e. Clicking Section number 2 with Inspect, or using the Transport, re-applies regardless of Auto-apply.

- RESULT: PASS

# Final Results

Recipes 26-30 PASS with note on 30.
Recipes 30a-30e added.
Bugfixes applied.
Recipes 30a-30e PASS.

Suite passes.



