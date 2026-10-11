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

Goal: implement `SongWidgets.js::formatTransposedChordNotesFunctions(noteArray)`.

Now that we have the plain list of notes in chords and modes, properly transposed, we want to display them in widgets that will get expanded in the Caption row per Section, and in a later iteration, we will add a Caption row of Song widgets that can be specified for the whole song and don't need to be set in each Section.  They will still, however, continue to be evaluated per Section by infinite-neck.js::updateSectionsStatus().  To start this process we are working on the first function as our goal.

We have mocked up the output of the function `SongWidgets.js::formatTransposedChordNotesFunctions()` in an html template string.  This html should in fact be calculated and output using the real transposed value from the chart as passed in in the `noteArray` parameter.

The first row of the mock output in SongWidgets.js::formatTransposedChordNotesFunctions()  uses `["noteHatchedRootPink noteWhite", "noteBlue4", "noteRed4", "noteGreen6"]` as stand-ins for the current values of  `[note1, note5, note8, note12]` coloring as though AutoColor applied to the first row, *even if AutoColor is off*.  But if the User uses `Palette > Stylesheets` to redefine note1, note2, etc., then the current values of these note colors should be used, just as though AutoColor and the Stylesheets were in effect in the Instrument cells.

Additionally, note that we have mocked up the handling of black keys and white keys that use our new CSS rules in infinite-neck.css as `blackKey` and `whiteKey`.  For these expansions, we have already called TonalNote.simplify() (thus removing double flats etc.) so that any remaining flat or sharp on the note names means it is a blackKey, otherwise it is a whiteKey.

Also, note the use of `em` as a nested element within `notesFunctionTable` to tighten up the display of `&flat;`.  We want this used in the real code.


