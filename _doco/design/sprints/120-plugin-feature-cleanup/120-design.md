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

# Iteration 1 answers to implementation plan questions

`Clip` copied listened notes <count> as <name>`.
Question: should the message also include from <sourceTableID> to <targetTableID>? ANSWER: Yes.

Menu caption. Yes, use exactly as `L copy Listened notes`

This is the correct interpretation: 
- preserve any color-related attributes already present on the source model note
- ignore any destination-side listener display coloring

