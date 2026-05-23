# sprint-2: Feature: more-types of Notes for FillPlugin

# Document version
 - This is document version 1 of (FillPlugin-sprint-2-design.md).
 - This sprint picks up where sprint-1 (FillPlugin-implementation-plan.md) and (FillPlugin-design.md) and (FillPlugin-design-copilot.md) leave off.

# Iteration 1 : Design more-types

FillPlugin is working well with SingleNotes, and the option to add TinyNotes (not Bends) on top of SingleNotes, with a small set of functional note colors.

For this sprint, we want to add the compliment of note types that will likely complete the plugin.  

Highlights and Bends don't make sense, since these are for special notes played by the User, not guides for playing a chord or scale, which is what NamedNotes, SingleNotes, and TinyNotes are for.  

TinyNotes were originally designed just for licks or arpeggios a lead player might play over comping chords, but they are so visually useful, that they can be considered as functional as SingleNotes for defining root, chords, modes and scales.  Additionally, TinyNotes may be used in the future feature of bringing in Notes via MIDI from external programs reading TAB file format, and so can form a separate set of LeadKey notes orthogonal to User-placed Notes using NamedNotes and SingleNotes and Bends. Therefore, TinyNotes are included in the complimentary full set.

Now that SingleNote has been figured out, we can define the behavior of NamedNote and TinyNote to follow almost all the implementation details of SingleNote.

Most different, will be that TinyNote will have two behaviors in two locations: 
1) in the existing location, a TinyNote is added in the same cell as a SingleNote, and follows its rules for placement based on Root, Chord, and Scale, while following LeadKey, and having a set of color choices that are different than role based colors that the SingleNotes use. It is currently menu item "tiny note" which will be moved *under* the SingleNote menu item to "add tiny note".
2) in a new location, sibling to SingleNote and the new sibling NamedNote, TinyNotes will be available to be used stand-alone just like SingleNotes, with the options of role-based colors for root, chord, and ccale, and the rules around keep, none, and role.

Then, a NamedNote option will be just like SingleNote, but will use NamedNotes.  NamedNotes will necessarily ignore fret and string range limitations, because NamedNotes go everywhere on the neck that a note with a name appears. This is in preference to moving/duplicating the range options under SingleNote and TinyNote.

The current menu hierarchy is 

```
chord formula [Maj]
g scale formula [Ionian/Major]
minFret position [0]
maxFret position [4]
upper string limit [1]
lower string limit [6]
root [noteRoot]
chord [noteChord]
scale [noteScale]
tiny notes [none]
Apply
```

So the menu hierarchy including the more-types note types in sprint-2 will be:

- c) chord formula
- g) g scale formula
- i) minFret position
- a) maxFret position
- u) upper string limit
- l) lower string limit
- n) NamedNote
  - C) Copy from SingleNote 
  - r) root
  - c) chord
  - s) scale  
- s) SingleNote
  - r) root
  - c) chord
  - s) scale
  - a) add TinyNote
- t) TinyNote
  - C) Copy from SingleNote
  - r) root
  - c) chord
  - s) scale  

These are then independent and can be chosen independently.

The new action `C) Copy from SingleNote` copies the options root, chord, and scale from SingleNote once, and leaves the values there. If SingleNote values are later changed, the values copied do not update.

"add TinyNote" is the new location for what is today just the menu item "tiny notes".  If the SingleNote has no notes chosen by root, chord, or scale, then "tiny notes" has no note to add to and doesn't appear on the neck.  That is how the plugin operates today after sprint-1.  That will still be the behavior when that menu choice is moved to "SingleNote"/"add TinyNote".

But if TinyNote as its own category has root, chord, or scale chosen, then it would be placed because of that on its own.  If TinyNote is used in this way, then "SingleNote"/"add TinyNote" should become unavailable during the fill, that is, ignored if chosen or persisted.

A NamedNote would also be independent and can have root, chord and scale. NamedNote simply ignores fret and string range limits.

Important: all three sibling types can have roles assigned to root,chord,scale, so can be present in the same table with different colors and therefore color functions. (Note Function is of course still determined by the system normally, such as "I" or "IV" based on cell and RootKey).  However, "add TinyNote" has special, limited color options because it rides atop a SingleNote.

## Request

Copilot, 
- please review sprint-1, documented here: (sprint-1.md) in this directory.  
- Please then review sprint-2, planned here: (sprint-2.md)
- Please then review this document's section "Iteration 1" as the launch of this feature sprint, and reply in (FillPlugin-sprint-2-design-copilot.md) with design feasibility based on the completed code from sprint-1 in the repository now, and include a section of questions and clarifications needed from the Design team.
- We have moved a bunch of files around in the _doco/design/ area to organize them into sprints and features, so if any references to stale locations persist, please let us know.

# Iteration 2: Design clarifications

Answers (based on numbered questions in "Main design clarifications needed"): 
1. follow recommendation.
  - runtime ignore plus help/summary text
  - best UX is disabled or captioned unavailable if the menu system makes that easy.  Our favorite is if the menu item can be dynamically updated with "[disabled]" or somesuch.
2. yes, if any of tiny/root, tiny/chord, or tiny/scale would emit notes, standalone TinyNote is active.  It will be impossible to distinguish a TinyNote's origin, so TinyNote as a sibling must prevail, and hopefully disable and/or hint the one under SingleNote.
3. The full compliment of properties is copied: 
  - the mode (none, keep, role)
  - and the color value for any role-mode entries
4. "Copy from SingleNote" ignores the overlay TinyNote choice.  That option is only available under SingleNote.
5. the existing engine renders the three note types in different "lanes", that is there are separate divs z-ordered over each other, so they can co-exist.  Therefore the design specifically allows the same and different color/role choices.  So these are all allowed simultaneously: 
  - NamedNote root
  - SingleNote root
  - TinyNote root  
6. "Keep" semantics are the way the User preserves his Notes placed prior to entering the plugin Action.  If Keep is not true, then the plugin effectively hoses any Notes in that lane.  Therefore they should be kept on commit.  Other plugins have the option to not overwrite notes without the "owner:" attribute, but I think we designed FillPlugin instead to follow its own Keep strategy.  If so, continue to use the Keep model, and overwrite notes as implied.
7. Today, a NamedNote may be placed in a BanjoNut, because that implies the string is played and the "open string note" sounds.  Conceptually, the musical note is determined by the fret location, but physically, you must put your finger on the nut side of every fret to mechanically make that happen.  So the name of the note is shown in the cell on the nut side of the fret for this reason, so the instrument in its construction places a mechanical finger at the nut for you by how it is built. So the name of the nut note is shown left of the nut fret in a right-handed instrument.  It is "playable" in that the mechanics make the string resonate all the way down to the nut fret (fret 0), just like when you finger (fret 1) the note sounds with the shorter string length and the name is placed left of the fret.  In fact, you can place SingleNotes and TinyNotes on Nut positions for this reason.  It means play the note without fingering any fret, so the position at the Nut is "playable" just not "fingerable".  We put in a restriction in MovePlugin, but that doesn't apply here.

We have fixed the stale file links and stubbed out an empty implementation plan for you.  Thanks.

We appreciate your recommendations about how the code should be refactored and concur.

## Request

Copilot, please proceed to implementation plan in the empty, stubbed out file (FillPlugin-sprint-2-implementation-plan.md).

# Iteration 3: Coding

Minor clarification: Today, the FillPlugin also allows SingleNotes and TinyNote overlays to be placed in Nut locations.  This is as-designed, is good, and should be kept. So the clarification is that not just NamedNotes allow nut/open-string placement, but that all note types do this.

I know you spelled this out clearly elsewhere in the document, but this statement should not be construed to mean that singleOverlayTinyOutput can exist at all if TinyNotes from the sibling level are in effect and writing even one note.  statement from plan: "Then combine tinyOutput and singleOverlayTinyOutput carefully into the TinyNote lane according to the sprint-2 rules."  Presumably the "sprint-2 rules" are what prevent them from being written.

With these, please proceed to Coding!

