# Design

## Iteration 1: Define the problem

When a Piano is a Listener of a Guitar, it is currently only listenening to notes on the first string, because a piano has "one string".  We want to include a checkbox or something on the Wiring options panel that allows the Listener to chose an algorithm that maps all playedNotes by MIDI number only, ignoring row and col.  It would chose to listen in order from low string to high string or from high string to low string on the source instrument, since notes will clobber earlier listened notes with this algorithm. 

We could put it in a ListenerPlugin if the algorithms got varied, but we think that if it could be contained to just listen in one string order or the other, and it could be contained in a routine or two, or a helper module, then we would not do it as a plugin.

Without coding changes, can you sketch out how we would do this, and which core files need to be changed?  

Please write the sketch as `_doco/design/sprints/126-piano-listener/126-sketch.md`

Iteration 1 completed with Copilot writing [design sketch](126-sketch.md)

## Iteration 2: Final Design + Implementation Plan

NOTE: Sprint has been promoted from sprint-903-piano-listener to sprint-126-piano-listener and is scheduled for implementation plan and subsequent cooding.

Here are the questions from the design sketch: 

1) Should the new mode affect only played notes, or should recorded highlights eventually follow the same MIDI-only projection rule? ANSWER: If recordedNotes and Highlights can be done, they should be included.  Now that we see the scope, we are changing that spec.

2) For multi-row non-piano targets in MIDI-only mode, is "first matching target cell" acceptable, or do we want a more musical preferred-row rule now?  ANSWER: First matching target cell is acceptable.  This is mostly for Piano Lineage instruments.  If other instruments seem to work out, we can tweak them later.

3) Do we want the UI label to say "string" or "row"? The user-facing language should probably stay musical and say "string" even though the model stores rows. ANSWER: User-facing is "string".

4) Should the persisted field name be explicit like listenerProjection, or shorter like listenMode? ANSWER: listenerProjection.

Additionally: 
- yes, a SELECT must be used instead of a checkbox.  This is better than a Radio Group.
- yes, not a plugin.  Especially with keeping algorithm in move-helper.js .
- yes, in move-helpers.js, with tight changes in the other core files.
- good catch on sorting source strings by starting pitch.  `ChapmanStick` is a particularly nasty one, but can be normalized when thought of as just a collection of string that all have a starting pitch.

For Iteration 2, please produce implementation plan in [implementation plan](126-implementation-plan.md) .

We will then approve and proceed to coding in Iteration 3.

