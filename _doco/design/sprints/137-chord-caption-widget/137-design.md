# Iteration 1

## Request

Today, we can expand a value in the caption: `${enharmonicTransposedModeNotes}`

We would like a corresponding output for the current Section, the current chord, as transposed.
- we need one new expansion for the Key: `${transposedChordNotes}`
- we need one new expansion for the LeadKey: `${transposedLeadKeyChordNotes}`

enharmonicTransposedModeNotes is found in approved-values.js::approvedValueEntries where it is then expanded in plugins/tonal/TonalPlugin.js :: getApprovedCaptionValue()

The Key should be considered as the key after transposition, the same as the Chart when `stripTonalRoots` and `addTransposedRootToChord` are in effect.  So if we are in a Section and the original Key was C and the transpose plugin current chroma value is 5, then we are sitting in the key of G.  If the chart chord was Cm7, then the `#lblSectionChartChord` will be showing Gm7.  This is the transposed chord.  We want the notes for transposedChordNotes, as calulated by Tonal.js that is:
```
"notes": [
        "G",
        "Bb",
        "D",
        "F"
```

If the Lead Key were set to Bb (B flat), then we would want the notes from transposedLeadKeyChordNotes to be: 
```
"notes": [
        "Bb",
        "Db",
        "F",
        "Ab"
    ]
```

For this Iteration, the expansion should yield a comma-space-separated list of these notes without the quotes, but with sharps and flats treated the same way as `enharmonicTransposedModeNotes` e.g.:

- `${transposedChordNotes}` ==> "G, B<small>♭</small>, D, F"

- `${transposedLeadKeyChordNotes}` ==> "B<small>♭</small>, D<small>♭</small>, F, A<small>♭</small>"

These are currently correctly calculated in Chart > Notes where the output appears here, for example, when the chart chord is Cmaj7 and the transposition is one semi-tone, so the current transposed key is Db and thus the notes are `Db,F,Ab,C`: 

```
<div class="SPN_CC"><b>noteRoot:Player: P46_1:Db</b>»<br>Db,F,Ab,C: ....
```

We do not need any new Jest tests, or for the full Jest suite to be run.  We will run the full Jest suite afterwards.


# Iteration 2

## Request

Now that we have the plain list of notes in chords and modes, properly transposed, we want to display them in widgets that will get expanded in the Caption row per Section, and in a later iteration, we will add a Caption row of Song widgets that can be specified for the whole song and don't need to be set in each Section.  They will still, however, continue to be evaluated per Section by infinite-neck.js::updateSectionsStatus().

We feel there is a slight refactor of the output of TonalPlugin.js::buildTransposedChordNotes() such that buildTransposedChordNotes() should return an array, and all string processing delayed until the flavor of output is known.

These are the levels of output that will rely on this function: 
- 'transposedChordNotes'
- 'transposedChordNotesTable'
- 'transposedChordNotesTableAuto'
- 'transposedLeadKeyChordNotes',
- 'transposedLeadKeyChordNotesTable',
- 'transposedLeadKeyChordNotesTableAuto',
The expansions that have 'Table' will output an HTML table that is the widget.
The expansions that have the 'Table' and also 'Auto', that is, 'TableAuto' will be the widget plus the first row of the widget will use `[note1, note2, note3, ... note12]` coloring as though AutoColor applied to the first row, *even if AutoColor is off*.  The plain 'Table' versions will just have the note functions in the first row as plain text.


