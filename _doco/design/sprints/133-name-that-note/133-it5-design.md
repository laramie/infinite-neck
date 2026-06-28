# sprint 133 Iteration 5: standardizing on Tonal.js names

A few sprints back we began a process to normalize on Tonal.js official chord names and mode names.

Now, with our additions to Chart during Transposition, Fill and Arpeggio with "use chart" and friends, we are face-to-face with this issue again.

We have preserved our names in Fill constants because for our UI, the full list of Tonal.js chords is too much.  Same goes for their modes.

But when we try to construct a list of scale notes or chord notes from modes or chords in the Chart, we must actually use Tonal.js names, since the User has gone through the TonalPicker which uses Tonal.js names, not our Fill names.

So for situations where FillPlugin or ArpeggioPlugin is looking up notes from Section.chartChord or Section.chartMode, we must actually use Tonal.js as the source of truth.  There are various ways into Tonal.js which we can provide based on their documentation on their website if looking at Tonal.js code doesn't make this accessible or obvious to Copilot.  Just let us know and we will provide their API docs or more programmer friendly code builds.

We would also like to know where in our code we are using our array values and not using Tonal.js and where this might lead to split handling in the future.  Simply selecting a subset for the picker has been our goal, but we know there are a few where we provide User-facing aliases, such as `(NeopolitanMaj)`    or `(Gypsy)` or `(dom7)`.  We want these to continue working, and would want to know if any of them select actual different note sets.

Please provide an analysis of our code around where we diverge from Tonal.js.

Please also look at the case where the User has picked a value in the TonalPicker, and Arpeggio "auto chord" won't find a value in our constants, because we don't have a listing for 'Maj7sus4'.  In this case we would want to convert the code to using Tonal.js's list, because the User has decided on 'Maj7sus4' because it came from Tonal.js in the TonalPicker in the first place.

# Iteration 5 responses to Copilot analysis

Copilot has provided analysis in [133-it5-analysis.md](133-it5-analysis.md)

Upon reviewing this, we now feel that we need to standardize fully on Tonal.js names for chords and modes.

We still have a use for providing the User-facing aliases we do in our Fill in the SELECT boxes, and in FillPlugin menu lists.  We'd like to winnow these down to the absolute minimum that Tonal does not provide yet we feel are necessary.  The bigger value for us is the caption and trigger values we provide, which are our UI, and have nothing to do with Tonal, since we don't use them in TonalPicker.

These are the special captions from Constants.js we want to keep using in Fill > #dropDownChords, and its counterpart in FillPlugin.
`(dom7)`
`dim&nbsp;&nbsp;&nbsp;&ordm;`
`m7b5&nbsp;&nbsp;&nbsp;&oslash;`
`maj7&nbsp;&nbsp;&nbsp;&Delta;`

Similarly, in the drodown and menu, any of the mode captions with parens are captions we want to keep, and all the triggers.

However, once they are a valid note set, and are detected/detectable by Tonal, we want them correctly stored in the table and section as Tonal.js chords and modes.

We aren't sure of the value going forward of the alias table in chart-aliases.js since we want to only store Tonal.js values except for our two Fill caption UIs.

We'd like to simply use the two caption UI flows if possible, and have that be the extent of our polution of the namespace: just the Fill #dropDownChords #dropDownScales and the FillPlugin menus at `/fpfoc` and `/fpfoc`. 

Please provide an implementation plan for migrating the code to standardize the code on Tonal.js names with the exception of using our limited set of names in the captions.  If there is a more simple or elegant way to limit the subset than with FILL_CHORD_OPTIONS and FILL_SCALE_OPTIONS, we'd like to see the proposal.

Let the implementation plan be: [sprint-133 Iteration 5 implementation plan](133-it5-implementation-plan.md)

# Iteration 5 responses before implementation/coding

## Ignore "Maj7sus4"

We provided a typo: "Maj7sus4" is not a thing.  We mis-typed it out of habit, because of how many musicians name this chord.  However, the bug we recently spotted actually was a miss because "M7sus4" was not in our Fill picker formalae.  Only on re-typing into the design document it "Maj7sus4" become a thing in infinite-neck.  This is indicative of the problem.  So don't worry about "Maj7sus4" as an alias to be remembered or dealt with. 

The valid cases are:
"CM7sus4" could be selected in the TonalPicker, therefore that would be the storage.  And the storage would then be: "chartChord": "CM7sus4".

If the User chose from our Fill picker "maj7" in the key of C, then went into the TonalPicker then the suggestion would be "Cmaj7" and the storage would be: "chartChord": "Cmaj7".

## Chose "Option C"

As we understan your suggestion, we'd like to go with `Option C: Tonal-native dynamic subset generator`.  This means our formulae would go away and be replaced by a Tonal.js chord name, as given in `help.html#tonalChordNames`.

So we understand you to mean the "formula" is `'4,8'` in the contant in Constants.js: `{ value: '4,8', caption: 'aug', trigger: 'u' }`

## Specific answers:


1. For storage canonicalization, do you want immediate rewrite on any save, or read-normalize with lazy rewrite?
ANSWER:  This has been corrected in the implementation plan.

2. Should legacy alias values be rewritten in-place at load time, or only when user edits/saves?
ANSWER: Again, these should not appear in song files.

3. For ambiguous chord labels, should we prefer Tonal Chord.get canonical symbol or keep user-entered equivalent if Tonal-valid?
ANSWER:  Always Tonal now.

4. For mode canonicalization, do you prefer canonical scale names with tonic in storage, or tonic-free mode names where possible?
ANSWER: Tonic should appear in storage.  They are only stripped out when dealing with the transposition runtime presentation of charts, FillPlugin dealing with Transposition, and ArpeggioPlugin dealing with Transposition.

5. Should the compatibility alias map remain indefinitely for imports, or be sunset after one migration cycle?
ANSWER:  Sunset it.

6. Do you want explicit migration notes in sprint docs for users opening older song files?
ANSWER:  No, we will fix the files in the library.
