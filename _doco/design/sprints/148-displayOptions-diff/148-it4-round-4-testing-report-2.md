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

# More testing


