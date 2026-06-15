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

# Request

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

# Request

Please produce an implementation plan in new, empty file [sprint-128 implementation plan](128-implementation-plan.md) factoring in our answers and discussion as needed.



