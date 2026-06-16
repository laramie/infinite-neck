# Iteration 1

Sections "Design" and "Design Round 2" are now grouped as "Iteration 1".

# Design

For MovePlugin, when we use these settings:
```
Move plugin: 🖺 target table=P46_1 algorithm=string motion=j include single=true tiny=true highlights=true fingering=true played=true recorded=true tuning=P46_1

Moves non-Named notes in the current section and selected table.

- target table = P46_1
- algorithm = string
- motion = j
- include single = true
- include tiny/bend = true
- include highlights = true
- include fingering = true
- include played = true
- include recorded = true
```
it seems that the motions are non-destructive.   We can just repeat "jump up", "Jump down", endlessly and come back to where we started.

It seems that with "down" it is also non-destructive, and repeats correctly, including Bends which we just fixed.  

It seems that with "up" we go all the octaves it can before it subtracts an octave, which matches our design.  Once it repeats at the higher fret number end of the neck, it drops an octave and correctly repeats the cycle of 12 note names.  

So if we limit it to going up only one octave on the "up" motion, we would have a one-octave repeat that was fully non-destructive, and could work at both ends of the neck, including the Nut, and including Bends.

This is what we'd like to install as an option into the TransposePlugin.  Call it "StringOneOctave".  So using this knowlege, we'd like TransposePlugin to be able to do do StringOneOctave for the set shown above: recordedNotes: [SingleNote,TinyNote,Bend,Fingering,Pitch,Multi]  because in this specification Bends are included in TinyNote.  We'd like to specify Bends specifically, because we are trying to move away from an old way in the helpfile of claiming that Bends *are* TinyNotes.  In code, that has diverged and is no longer true.  But for MovePlugin, `include > 'tiny notes'` has the correct effect in options.  So whatever the algorithm is for including Bends, when we make a recordedNote motion algorithm for TransposePlugin, we want to include Bends.

So for our implementation, we'd like to add
/fptr which is `r) recorded` and it's an org.dynamide.toggle, and when true, it includes the above algorithm and note choice set in all transposition operations, including reset and hard reset.

The set of notes would not be configurable, and the other algorithms in MovePlugin would not be included.

## Request

Please provide an analysis of this request, any blockers, any holes or unspecified behaviors we should deal with in trying to teach this trick to TransposePlugin.

Let your output be a report in this empty file: 
[sprint-128 analysis report](128-report-1.md) 


# Design Round 2 : Questions answered

Great catch on SingleNotes already participating when recorded.  This was an early attempt at what we are doing now.  It should actually be turned off, and all that functionality should be replaced by the new functionality.  The toggle `s) single notes []` should now only applied to playedNotes, and *not* recordedNotes.  If there is any knowledge worth keeping, it is the implementation of the algorithm as a reference for the new `r) recorded` option.  The code need not be preserved once the lessons are learned from it when implementing.  To reiterate: the menu option `s) single notes` will continue to exist but only cause playedNotes to be transposed.

With this specification, we believe this mitigates collision risk.  There remains the issue of collision with SingleNote, TinyNote, Bend, and Fingering when those have been placed as playedNotes.  We will answer how to deal with all these by answering specifically SingleNote as playedNotes and recordedNotes.  But the following discussion applies to the other types as well.

The current implementation has a quirk today as a result of leaving this slightly ill-defined use case be.  We intend to preserve that behavior, and let it be the rule in this new TransposePlugin option behavior.  To wit: if on one string a User places a SingleNote (or other valid type) on a D note, and in REC mode then places in beat 1 a C note, then a Db in beat 2, then a D in beat 3, and an Eb in beat 4, he'll see the following SingleNotes while looping: 
- beat 1: C D
- beat 2: Db D
- beat 3: D
- beat 4: Eb
This is the behavior today and is acceptable.  The use-case is to blame, and we don't want to fix it.  Because placing recordedNotes on tickBeat is destructive in terms of the paint order operation.  But in reality, it means the User is saying two things: 1) "I will place a finger on D on a string".  Then "I will play the note behind it with another finger", or "I will play a note ahead of it with another finger".  This is playable finger-wise, but meaningless on a real guitar because the sound comes from the string length between the highest fret fingered and the high-numbered-fret-end of the guitar, called the Bridge. The bridge is off-screen in infinite-neck.  Physically, it is twice the length of the 12th fret away from the Nut, that being the definition of the 12th fret.  Musically, it is an infinite number of frets past the 12th fret on "Natural fret widths" instruments (not Pianos), because the frets get closer and closer as you approach the Bridge, which is part of the joke in the name of the software "infinite-neck". The C does not shorten the high end of the string (the distance between the highest fingered fret and the Bridge), therefore is musically meaningless.  Then when the user plays the Eb (presumably with another finger) the D is blocked from having an effect.  So the SingleNote in the Section is erased by the SingleNote that was in recordedNotes.  So, while visually weird, it is actually visually meaningful.

Yes, the octaves feature should not apply to the new `r) recorded` option.

Yes, TransposePlugin should not drop any notes or use the drop note strategy.  Your interpretation is fully correct.  In other words, this is correct: "fallback to full-neck/off-screen mode rather than drop."  However, do not emit a message to showMessages, because this would come around on every intervals reset and disrupt the User flow.

Yes, we absolutely want this implementation isolated to TransposePlugin, in keeping with the stand-alone philosophy of the plugins: stay out of the CORE except for useful helpers installed there, don't call other plugins, keep specific implementation code contained within plugin.

The statement that playedNotes take precedence over recordedNotes needs some correction.
- in the CORE implementation, playedNotes are painted when arriving at a Section via navigation.
- when looping starts, recordedNotes are painted.  So from a paint/view/refresh perspective, they actually win, as described above.
- however, looping and replacing a view of a playedNotes SingleNote does not erase it from the model, so on navigation, the playedNote SingleNote will reappear.
- We should aim in the looping with TransposePlugin to keep to this simple behavior from the CORE and not try to outsmart it.

For Pitch, not only is MIDI authoritative, but the purpose of Pitch is to show *all* notes with that MIDI number (midiNum). Because the tunings spread out repeated MIDI numbers across an instrument, the possibility that many strings will have that exact MIDI number as a cell is the reason for this type of note: to show the User all the equivalent notes he could play as available on any/all strings to get the same pitch.  Musically, aside from a strange musical sound-color quality called timbre (which has to do with the physical string length and the tension and weight of a string such that tuned length is not the only determinant of pitch), a MIDI 60, note C, is identical to all other MIDI 60 notes regardless of where played.  So with Pitch, highlight all with the same MIDI number you can find, always.

Number questions answered:

6. Should missing or malformed note fields drop or clone unchanged?
Current TransposePlugin single-note code clones unchanged when it cannot compute row/fret.

Recommendation: keep that policy. For malformed recorded notes, clone unchanged and optionally emit one summary message. Do not delete.

ANSWER: approve the recommendation.  If found, do a console.log with "TransposePlugin" in the line, and emit the message.  Do not do showMessage.

7. How should Bends at a row-specific nut behave?

Recommendation: use the same tuning-derived nut logic as MovePlugin. A Bend can pass through a nut attempt but must never land there; it should be immediately shifted up one octave on the same row.

ANSWER: approve the recommendation.

8. Should one-octave wrapping work on short-neck instruments?

Recommendation: yes. If the instrument has fewer than 12 visible frets, allow off-screen `col` values. This matches existing TransposePlugin SingleNotes behavior and preserves reversibility.

ANSWER: approve the recommendation.

9. Should reverse/left-handed tunings use visual or MIDI direction?

Recommendation: MIDI direction, same as MovePlugin and current TransposePlugin. Do not invert for `reverse` tables.

ANSWER: approve the recommendation.

## Request

Please produce an implementation plan in new, empty file [sprint-128 implementation plan](128-implementation-plan.md) factoring in our answers and discussion as needed.

# Iteration 2: Menu reorganization and other playedNotes

## Changes in this document

Previous work in this document has been renamed "Iteration 1".

"Iteration 1" having been implemented following [Iteration 1 implementation plan](128-implementation-plan.md), and the code testing well, we are ready for Iteration 2.

## Iteration 2 discussion of features

For this iteration, Iteration 2, we would like to follow up on what we did in Iteration 1, which was to add handling of all recordedNotes in a new menu option, and ditching special handling of SingleNotes between playedNotes and recordedNotes.  Now SingleNotes are only handled specially as playedNotes.  SingleNotes are handled for recordedNotes with all the other types under the `r) recorded` menu option.

For Iteration 2, we would like to continue to handle all recordedNotes as a block, unchanged from Iteration 1.  We would like to handle NamedNotes exactly as they are handled now.  

For Iteration 2, We would like to handle playedNotes:SingleNotes as they are now.  But we would like to add playedNotes:TinyNote, playedNotes:Bend, and playedNotes:Fingering.  Since Pitch and Multi are not persisted when they are playedNotes, they are not included in playedNotes handling in Iteration 2. 

So we have three issues to implement: 
  1) making sure TinyNote, Bend, and Fingering are handled correctly when using the algorithm for SingleNote, but honoring the restrictions on the Nut for Bends as implemented when doing recordedNotes.
  2) Reorganizing the menu so that the style of chosing options matches the other plugins.
  3) Dealing with `octaves`.

## Handling the new note types

This is straightforward from a design perspective: add the note types and watch out for Bends at the Nut.  We look forward to seeing if the implementation plan has any design holes or questions we need to solve.

## Reorganizing the menu

Here is the /fpt menu today, with representative values from runtime:

```
Enable [false]
Load enabled [false]
Bury
Apply
Reset
help
intervals [[0,1,2,3,4,5,6,7,8,9,10,11]]
named notes [true]
single notes [false]
recorded [false]
octaves []
auto sharps/flats [false]
do lead key [false]
```

We would like to make the menu available with the following changes:

`intervals` is functionally unchanged, but its caption is now `chroma` and its trigger is now `c`.

`include []` is functionally like `/fpmi` (and `/fpci` except no count is provided here), in that they are org.dynamide.toggle, and one lowercase letter selects each and leaves us at that menu to keep selecting types. It has caption `include []` with the computed value being a sum of the types chosen, at maximum: `[n,s,t,b,f,r]`, with no counts.  It has trigger `i` replacing trigger `i) intervals` which is moved to `c) chroma`.

Here `include` has children `named` which is just `named notes` from the original menu moved here, and `recorded` which is just `recorded` from the original menu moved here.  Also, here the selection of the other types [single, tiny, bend, fingering] only adds them to the playedNotes bucket, not the recordedNotes bucket, because recordedNotes are dealt with as a non-configurable block.

Here is the redrawn menu:
```
Enable [false]
Load enabled [false]
Bury
Apply
Reset
help
chroma [[0,1,2,3,4,5,6,7,8,9,10,11]]
include [n,s,t,b,f,r]
    named [true]
    single [true]
    tiny [true]
    bend [true]
    fingering [true]
    recorded [true]
octaves []
auto sharps/flats [false]
do lead key [false]
```

## Dealing with octaves

This option is a bit of a snag.  We added it in [sprint-113-transpose-plugin-single-notes](../113-transpose-plugin-single-notes/sprint-113-transpose-plugin-single-notes.md)

It works for SingleNotes today.  It is especially useful for short neck cases, but also for 24+ fret / long-neck cases.  It also works well when the intervals/chroma contains values greater than 12.

We specifically excluded it from recorded notes, and that algorithm is working perfectly.

But the questions are:
1) Will it be straightforward to add TinyNotes, Bends, and Fingerings to playedNotes using the same feature octaves of playedNotes:SingleNote?
2) Is there a danger of it disrupting the current algorithm for recorded notes, if recorded notes begins to use the octaves feature?

## Request

Please provide an implementation plan draft, with questions and calling out design holes to be answered by the Design team.

Let it be: [Iteration 2 implementation plan](128-it2-implementation-plan.md)

## Answers to Iteration 2 implementation plan questions

1. Should new played-note include toggles default to `false` for compatibility, or should they default to `true` to match the sample `[n,s,t,b,f,r]` menu state?
ANSWER: Default all to `true`.  All song files need to be checked/rewritten for upcoming sprint-121.  We are not worried about legacy songfiles.  We'd prefer to have the default be that everything the User sees is automatically included. 

2. Confirm property names: `TinyNotes`, `BendNotes`, and `FingeringNotes`.
ANSWER: Yes.

3. Confirm lane-wise collision policy: Single lane, Tiny/Bend lane, Fingering lane, with no cross-lane collision between Single and Tiny at the same cell.
ANSWER: Yes.

4. Should played-note capped-octave collision fallback continue to rewrite `octaves` to `0` and emit an action message for Tiny/Bend/Fingering, as it does for SingleNote today?
ANSWER: Yes.

5. Should `chroma` be only a caption/trigger change while keeping persisted property name `intervals`?
ANSWER: Yes.

With these answers, the [Iteration 2 implementation plan](128-it2-implementation-plan.md) is CORE-APPROVED for coding.







