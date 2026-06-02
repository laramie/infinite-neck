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

