# Changes to code since implementation

Please note that we have changed, and we have requested Copilot to change, a few things in the code since implementation. In particular, we had you fix the bug in `_doco/design/sprints/148-displayOptions-diff/148-it4-round-4-testing-report.md` and that was successful.  Also, we have fiddled a lot with `infinite-neck.css` and had you change `display-options.js` which was also successful.  These changes are committed.  They affect how we see the results and reported them below.  Mostly, they allow us to see visual display of everything in /vdd.

# Clarify automation rule

## Design Team Question

We don't want this fixed or changed yet -- we want to understand how the rule is applied.  Here is the behavior.
- new Song
- add two Sections, for a total of three
- add some TinyNotes in all Sections
- loop.  TinyNotes show in each Section
- View > HIDE TinyNotes
- TinyNotes hidden, and stay hidden after wrap
- This is correct, because we have no automation for hiding saved.
- Go to Section 2
- Hit SaveDiff.
- loop.
- on Section 2, TinyNotes hidden
- on wrap, in Section 1, TinyNotes shown, following the DEFAULT.
So the behavior seems to be: once you save for *any* section, DEFAULT is read for the cascade, but if you don't save for any section, the DEFAULT is not read for automating around the wrap.

Again, please don't change the rules or plans.  Just explain it.

## Copilot Answer: 

Searched for text `hideTinyNotes` (`**/templates/display-options/displayOptionsMeta.js`), 2 results

Your reading is right. The cause is the absent-cell policy `defaultIfAutomated`, which controls when a default is applied. No code was read or changed beyond a lookup of the `hideTinyNotes` default, which is `false`.

**The rule**
- Navigating to a Section applies only the keys its resolve returns. Any key it omits leaves the control alone.
- A key with a default gets that default only when two things are true: no stored cell exists at or before that Section, and some Section in the Song stores that key in a readable cell. The Song then counts as automating the key.
- If no Section stores the key, nothing is applied and the control keeps whatever it holds.

**Before SaveDiff**
- No Section stores `hideTinyNotes`, so the key is not automated.
- Every Section resolves with `hideTinyNotes` absent, so the checkbox is never touched.
- The checkbox stays checked as you loop, which is why the TinyNotes stay hidden after the wrap. The checked box is just a live control value, not Song data.

**After SaveDiff in Section 2**
- SaveDiff compares the live controls with what Section 2 inherits. That is the cascade over Sections 1 and 0, which is empty, so it falls back to the defaults.
- Live is `true` and the inherited value is `false`, so a cell `hideTinyNotes: true` is stored in Section 2.
- The key is now automated, so the default applies wherever no earlier cell exists:

| Section | Result | Reason |
|---|---|---|
| 1 | `false` (shown) | no cell at or before it, so the default |
| 2 | `true` (hidden) | its own stored cell |
| 3 | `true` (hidden) | inherits from Section 2 |

- On the wrap back to Section 1, the default `false` is applied and the TinyNotes show.

So saving a cell is what makes the Song automate the key. It does not turn on a separate default-reading mode. The same rule is behind the `cell:r` fix from Round 4.

The distinction is deliberate. Policy C was chosen so that a Song with no stored value for a key behaves exactly as it did before DisplayOptions automation, and the controls stay manual. If you would rather have every key with a default always applied, that is the `'default'` policy. It already exists in the resolver, but it would make the controls snap back on every navigation even when nothing is saved. I have not proposed or changed anything.

## Design Team Accepts current rule

The Design Team accepts the explanation and confirms that this is the desired behavior. Keep Policy C.  No code change is scheduled.

As a side note, we now confirm that going into `http://localhost:8000/infinite-neck/?song=practice/All-Chords-w-Modes-Piano.json` and *CLEARing* the DisplayOptions puts us in a state where the macros work perfectly and automation doesn't undo the link clicks in Song Widgets.  Because this removes the hack where we manually deleted these keys in DisplayOptions in the JSON. So that use-case is solved.

# Change Requested for presentation.js handling

1. Clearing HIDE waits for actual notes to be placed before unhiding.

Now that the checkboxes are behaving correctly, we want to go back to state before a previous bugfix for presentation.js where just selecting a note type reveals all notes of that type.  The desired behavior is: 
- place NamedNotes
- "HIDE NamedNotes" checked
- NamedNotes are hidden
- Press key `6` or choose `#idNamedNotes`
- "HIDE NamedNotes" is automatically unchecked, existing NamedNotes are now shown (desired)
- Other note styles (SingleNote, TinyNote, Fingering) remain hidden if their HIDE checkboxes were checked.

 
# Acceptance test plan (browser) Results

1. **Startup**: AutoColor is checked, Highlight unchecked, View controls at their markup values.  `/vdd` shows an empty table with the full column list.
- RESULT: PASS

2. **SAVE Diff basics**: on Section 1 change Note Font, click SAVE Diff.  Messages says `wrote noteFont`.  `/vdd` shows one row with only `noteFont` filled, the rest gray.
- RESULT: PASS
  - Note that message says `Section 1: saveDiff: wrote currentColorDict, noteFont; skipped NoteDisplaySizes (presentationMode is off)` and the background color is the "changed" green. We have been noticing that it really wants to write the blank+changed value for `currentColorDict`.  So far, this is not a problem.

3. **Inheritance**: add Section 2; navigate 1 -> 2: Note Font stays.  On Section 2 change Show Left Subscript, SAVE Diff: row 2 holds only that cell.  Go back to Section 1: the subscript checkbox returns to its default (policy C).
- RESULT: PASS

4. **Revert**: on Section 2 set Show Left Subscript back to the default, SAVE Diff: the cell is removed (`removed showSubscriptFunctions`).
- RESULT: PASS

5. **Save All...**: click it; cancel keeps the model unchanged; OK writes every writable key.  `/vpa` writes without asking.
- RESULT: PASS

6. **Clear**: CLEAR on Section 2 removes its cells; Section 1 is untouched.
- RESULT: PASS

7. **AutoColor**: toggle it with `c`; move between Sections: it stays as you left it (no AutoColor cell is stored unless you SAVE Diff after changing it).
- RESULT: PASS

8. **Gates**
   1. `/vpmgak` then `noteFont,read-blocked`: navigating no longer applies Note Font; `/vdd` header shows `col:r`.
   2. `/vpmgdk` then `noteFont`: removes it.
   3. `/vpmgac` then `2,showMidiNum,write-blocked`: on Section 2, SAVE Diff after toggling MIDI numbers reports `skipped showMidiNum (write-blocked)`; CLEAR leaves that cell.
   4. `/vpmgas` then `2,read-blocked`: Section 2 applies nothing.
   5. `/vpmc` then `2,noteFont`: clears one cell.
   6. `/vpmu`: undoes the last change, including a gate.
- RESULT: 
  1. `/vpmgak` then `noteFont,read-blocked`: navigating no longer applies Note Font :: *only after clearing the live control*.  When the control is left as it was, that font just stays and displays in the Instrument.  When the control is set to some other font, *that font* stays and displays.
  2. PASS
  3. PASS
  4. FAIL. At the end of sequence 3. we have showMidiNum write-blocked, and all other cells gray.  When we perform step **`/vpmgas` then `2,read-blocked`: Section 2 applies nothing** the read-blocked is duly applied to the row, and the write-block on cell showMidiNum is preserved.
  5. **`/vpmc` then `2,noteFont`: clears one cell.** clears nothing because our state was that noteFont was in Section 1 but not Section 2.  **`/vpmc` then `1,noteFont`: clears one cell.** works.

9. **Presentation Mode**: with it off, SAVE Diff reports `skipped NoteDisplaySizes (presentationMode is off)`; turn it on and change cell width: SAVE Diff stores `NoteDisplaySizes`.
- RESULT: PASS

10. **Song round trip**: Save the Song, reload it: gates, sparse cells and the controls are as before.  The View > diagnostics "Song file format" item shows `displayOptionGates` only when set.
- RESULT: PASS

11. **Clone**: Clone copies cells and gates; Shallow clone keeps the Section's gates and drops its cells.
- RESULT: PASS

12. **Looping**: loop through 3 Sections with the View page open: controls follow the cascade; nothing flickers back to defaults at the loop wrap.
- RESULT: PASS

## Results Discussion

We would like analysis of the results, and if there are more detailed tests we need to run for the FAIL case and the ambiguous ones.




