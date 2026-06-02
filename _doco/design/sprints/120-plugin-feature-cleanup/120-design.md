# Design



## Iteration 1: ClipPlugin copy Listener notes

Informationally, with no code changes, what is the viability of having a new Copy type in ClipPlugin that looks at all notes placed by a Wired Listener.  These should exist in the DOM but not in the Model.  But for the moment where they have been played into the Section (ignoring recordedNotes since current Clip doesn't deal with them), they are visible, so the User should conceptually be able to "select them for Copy".  We want to see what would be involved in making that true, without doing any coding.

### Iteration 1: Questions answered / Design refined

In general, we are going with your simplest, safest recommendations.  The intent is to copy original notes from the listened-to-table, as they would map to cell (col/row) in the listening table, ignoring dropped notes, and ignoring color transformations that happen because of the listening table.

1) Implement a capture of the Listener notes, not a DOM scrape.  Preserve note meaning, not exact visible cells.

2) Simply drop notes that Listener drops today.

3) Ignore recordedNotes

4) Using notes as they would appear in the Model from the source table, escewing color attributes and other things picked up as part of Listinging into the current/destination/listening table, in other words, the projections you called namedNotes project as namedNotes and playedNotes project as playedNotes.

5) Obey and use options set in the ClipPlugin for note types etc.

6) Completely ignore Observer tables. These are strictly for look-ahead and look-behind.  If the User wants to copy these notes, they should go ahead/behind to that Section and work from a real table and section.

7) menu item would be something like `L) copy Listened notes` after `M) MIDI Paste ....`

### Iteration 1 answers to implementation plan questions

`Clip` copied listened notes <count> as <name>`.
Question: should the message also include from <sourceTableID> to <targetTableID>? ANSWER: Yes.

Menu caption. Yes, use exactly as `L copy Listened notes`

This is the correct interpretation: 
- preserve any color-related attributes already present on the source model note
- ignore any destination-side listener display coloring

## Iteration 2 : ArpeggioPlugin uses "from" SingleNotes as well as NamedNotes

Currently, ArpeggioPlugin uses NamedNotes as the sole source of note names [A,Bb,C,Db....G,Ab], as Named Notes to include in candidate set.

We want to extend ArpeggioPlugin to behave exactly as it does now, but have a "from" option that allows the User to choose from an org.dynamide.Select of ["NamedNote","SingleNote"], and if NamedNote is chosen, behavior is exactly as today, and if SingleNote is chosen, the SingleNotes in the Current Section are read for their Note Names only, and these become the candidate set exactly as if those NamedNote note name values had been in the namedNotes in the Section Model.

- Menu Item: trigger `t`, caption: `type`, default: `NamedNote`, shows as `<b>t</b>ype [NamedNote]` or as `<b>t</b>ype [SingleNote]`

Copilot, please produce implementation plan `120-it2-implementation-plan.md` and raise any questions or alerts above viability or coding problems with the simple feature extension as proposed above.  We will review the implementation plan before approving coding.

### Iteration 2 answers: 

Question 1: should SingleNote mean only STYLENUM_SINGLE?
ANSWER: Yes: the narrowest reading and the safest implementation.

Question 2: should SingleNote source read only the selected target table?
ANSWER: Yes: just the selected target table, just like NamedNotes today.

Question 3: should bend/tiny/fingering ever become valid future from modes?
ANSWER: No.  And unlikely in future iterations, so no scaffolding should be errected in expectation.

Also flagged in questions: what to do with conflicting trigger.  Answered above, with new trigger `t) type`.

## Iteration 3: menu changes for Fill

- from `/fpfo`, add actions for NamedNote (in menu /fpfoN ) and SingleNote (/fpfoS) and TinyNote (/fpfoT) after `Copy from SingleNote`, where `A) All role note` means trigger is `A` and caption is `All role note`.  Except that SingleNote has no `Copy from SingleNote` so put the new actions first.
  - `A) All role note`
  - `N) All none`
For the A) action, set the sub-menu items as though the User had dropped into those menus and chosen all the roles, for example, as if they had typed these three: 
`/fpfoNrrn`
`/fpfoNcrn`
`/fpfoNsrn`
For the N) action, its as though the User had selected `none` at the leaf menus, `fpfoNrn` and so on.

Then, we'd like the NamedNote, SingleNote, and TinyNote menu items to have a value constructed so the menus look like this example: 
NamedNote [r:none,c:noteChord,s:noteScale]
SingleNote [r:none,c:none,s:none]
TinyNote [r:keep,c:keep,s:keep]

Then change caption in /fpfo from `g scale formula` to `mode` trigger `m`.  Change `chord formula` to `chord` same caption `c`.

## Iteration 4 

- fill should listen to Song.chartChord and Song.chartMode with an option, and should make NamedNotes or SingleNotes using the current options for position and string ranges.  

- It would ignore the chord and mode picks if chart versions are chosen.

- When the User has entered notes into a table, and used the TonalPicker to set the value in Section.chartChord and Section.chartMode, then clears the notes, but goes back into FillPlugin, we'd like the an option in the menu to use chartChord or use chartMode.  The plugin would then select the value from the list, and pop up.  If not found, would just stay there, silently failing, except for a message in the action result which would go into the dropdown.

- We would need to strip the slash root and slash bass so that it plays well with the fill options available.

- Menu items. 
  - Avoid messing with the properties-based menu, and instead create a dynamic menu in the /fpfo dynamic menu area.
  - At the level of /fpfo, add a menu item `u) use chart` with two action items on one sub-menu: `c) chord`, `m) mode`.  On success or fail it would pop so we'd be sitting at /fpfo again, and would see the dropdown and the defaults filled in on chord and mode.
  - structure: 
```
/fpfo
  u) use chart
  c) chord
  m) mode
  p) positions
  ....

/fpfou
  c) chord
  m) mode  
```


Please produce an implementation plan in `_doco/design/sprints/120-plugin-feature-cleanup/120-it4-implementation-plan.md`

### Iteration 4 Answers

For slash chords such as FMadd9/A, should the match be based only on the stripped chord type left of /, with the bass always ignored? This is what the design text suggests, but it is the main product rule worth confirming explicitly.  ANSWER: Yes--stripped only.

For misses, do you want the action result to include only the normalized candidate and current Fill list, or also a short set of likely suggestions when there are close alias matches? The simpler and safer first version is to report raw value, normalized value, and current Fill candidates only. ANSWER: simpler and safer version.  Further, action result that goes in the dropdown has to stay short, so don't include the list.  Then, put the full message in showMessages.  We'll turn this off later or with an option.  For now, showMessages is fine even though it disrupts User flow slightly.

- Example for dropdown: 
`No fill match for chartChord="FMadd9/A" normalized="Madd9"`

- Example for showMessages:
`Fill use chart chord: no match for chartChord="FMadd9/A" normalized="Madd9" against [M, m, aug, dim, dim7, m7b5, sus2, sus4, maj7, s m7, 7 (dom7), 7no5, m/ma7, m9, 6add9]` 

For chartMode, is tonic stripping always expected, so C major and A minor should map to the same Fill entries as plain major and minor? This appears intended, but it is the core normalization rule.  ANSWER: Yes, tonic stripping always expected.

If chartChord or chartMode is empty, should the message explicitly say empty chartChord / empty chartMode, or should that be treated as the same silent-style miss as any unmapped value? I recommend an explicit no-op message because it helps testing. ANSWER: if chartChord or chartMode is empty, simply skip filling anything in, don't showMessage, and do add a simple dropdown result: `No chartChord` | `No chartMode`

For Fill's curated subset, should unmatched but clearly related chart chord types such as Madd9 be allowed to map to an existing Fill approximation like 6add9, or should only exact approved aliases be accepted? I recommend exact approved aliases only for the first version, because approximation rules are where surprising behavior creeps in. ANSWER: only exact approved aliases.  We will likely add a second properties menu with "additional Tonal" values so we can find them but not clutter up our menu, as we find the set we are missing and actually get used.

