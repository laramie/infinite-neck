# Iteration 1

## Request

Today, we can expand a value in the caption: `${enharmonicTransposedModeNotes}`

We would like a corresponding output for the current Section, the current chord, as transposed.
- we need one new expansion for the Key: `${transposedChordNotes}`
- we need one new expansion for the LeadKey: `${transposedLeadKeyChordNotes}`

enharmonicTransposedModeNotes is found in approved-values.js::approvedValueEntries where it is then expanded in plugins/tonal/TonalPlugin.js :: getApprovedCaptionValue()

The Key should be considered as the key after transposition, the same as the Chart when `stripTonalRoots` and `addTransposedRootToChord` are in effect.  So if we are in a Section and the original Key was C and the transpose plugin current chroma value is 5, then we are sitting in the key of G.  If the chart chord was Cm7, then the `#lblSectionChartChord` will be showing Gm7.  This is the transposed chord.  We want the notes for this, as calulated by Tonal.js that is:
```
"notes": [
        "G",
        "Bb",
        "D",
        "F"
```

If the Lead Key were set to Bb (B flat), then we would want the notes to be: 
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


