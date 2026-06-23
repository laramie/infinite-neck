# Design

Iteration 7 tests perfectly.

We see that in this attached song, 
`songs/sprint-121/pentatonics-7-m-7-in-6-keys-Fill.json`
that Fill is doing something a bit funny, but mostly according to design.  We want to sync its behavior instead with ArpeggioPlugin.

What Fill is doing, is: 

1) it uses simple "positions".  We want it to do complex positions with an array of positions `values`, and copy-to-section action features, as ArpeggioPlugin does.

2) it is moving its positions on transposition.  This is the odd part.  We'd like it to match what ArpeggioPlugin is doing so that the fill lines up with the notes ArpeggioPlugin is highlighting.  This migration of the fill position up the neck during tranposition should be fixed if migrating to the ArpeggioPlugin way of doing business doesn't fix it. 

We don't want this to link the plugins, however.  We want the behavior to line up, without linking either the positions options, or any runtime coordination between plugins.

Some day we might want "positions" to be a reuseable menu chunk generator.  But since it is just two plugins, for this Iteration we'd prefer to have duplicate code where it keeps the plugins independent. Shared code or handling in helpers is fine, as long as staring at the menu code and properties.json in each plugin is easy to see the menu structure and handling while doing programming maintenance.

But basically, the ArpeggioPlugin handling of positions is perfect, and we'd like that ported over to FillPlugin so the User will set it once in each plugin, and if they set the same options, the two plugins will render in the same positions, even during transposition. 

The menu options would look the same in each, including `song loops per position`. If the User does not manually sync this property or any others in the positions sub-menu, they will see odd looping behavior, and that is OK.


## Answers to Questions for approval

1. Should Fill use the exact same default menu seed for values this section as Arpeggio (`[[0,3],[4,7],[8,12]]`), or should Fill keep a tighter default due to prior first-position bias?
ANSWER: Use the value that Arpeggio does today: (`[[0,3],[4,7],[8,12]]`)

2. Do you want Fill positions status widgets (caption-level table like Arpeggio) now, or only the values/summary text parity for this iteration?
ANSWER: Yes, please, with different colors. .fillPositionsStatus td { background-color: #ff9af1; }  this is for the widget when not the active position etc.  Other colors listed in CSS as separate classes for fill, but set to same colors for now.

3. When `positions:refreshCurrentSection` is invoked in Fill, should it be a pure status refresh (Arpeggio style) or should it also trigger an immediate apply?
ANSWER: Just the pure status refresh, no immediate apply. 

4. Should Fill `songLoopsPerPositionPair` be included in Fill help summary text exactly as in Arpeggio wording?
ANSWER: Yes. 

5. If Fill has section positions set and user edits min/max defaults, should those edits remain strictly fallback-only (no mutation of existing section positions), matching Arpeggio behavior?
ANSWER:  Yes.


