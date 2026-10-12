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

# Iteration 3

Re: Claude question about whether the LeadKey moved notes should have functions relative to LeadKey.

Good catch!  We want something slightly different than what we previously had.  We want the notes to remain as though from the transposed chart chord to the current Section key.  But we want the *functions* calculated as though those same notes were in the LeadKey.  Because taking the notes of the root key and moving them to the LeadKey is a different issue we aren't showing with this expansion.  What we want is the same notes *as viewed in the LeadKey*.  Which means the notes don't change, just the functions.  This is the same as placing TinyNote in each cell and observing that the color and Function display differently for the same notes as SingleNote and NamedNote, which is the purpose of TinyNote and LeadKey.

So in TonalPlugin.js where we do: 
```
} else if (tokenName === 'transposedChordNotesLeadKeyFunctions') {
      return this.formatTransposedChordNotesFunctions(true);
```
we have altered the code since you last saw it.   

This `true` parameter  to formatTransposedChordNotesFunctions now is added and called    `relativeToLeadKey`.  It is in the signature, but is not implemented.  Please implement/fix  formatTransposedChordNotesFunctions so that if relativeToLeadKey is true, then just the *functions* and the corresponding classes are presented as though in the LeadKey, while keeping the notes the same, and in the same order. 

We have removed the previous expansion `transposedLeadKeyChordNotes` that allowed the notes to be moved.  

# Iteration 4

## Goal

Now that we have these expansions working, we want to enable having these expansions and other widgets work for the whole song, not just per-Section, as are expansions in the in the Song Caption.  To make this work, we have added `#lblSongWidgets` in `index.html`.  This new div is a combination of the User-specified expansions from the Section Caption, and the always-available built-in system widgets in `.SongTitleLeadSheet`.  `#lblSongWidgets` will be available any time a User wants to define widgets available for the whole song, and will be `display:none;` any time the User has not specified them.

Here is a sample set of 4 widgets (two spans and two expansions), that will correctly expand and be filled in for a whole Song, and respond flexibly to Sections that have no Chart chord or mode: 

```
<span class="lblSectionChartChord"></span> ${transposedChordNotesFunctions} <span class="lblSectionMode"></span> ${transposedModeNotesFunctions}
```

## Features

To enable this lblSongWidgets row, we want to implement these features:
- updateSectionsStatus() fills in lblSongWidgets so it feels "live".
- lblSongWidgets should completely disappear when it is empty, otherwise it should consume the whole row like a div.
- Users can enter raw HTML and expansions as shown in the sample 4 widgets above in the Goal heading section.
- This new textarea will be called `#textareaSongWidgets`
- The input area for entering this HTML will be most similar to the Info input area:
  - textarea like `#textareaSongInfo` 
  - converted to multiple `lines` for storage in the Song and persistence like Song.info.lines.
  - HTML validation like  `#textareaSongInfo` 
- The sample string for `#textareaSongWidgets` that a User would enter, and that the Song would persist, is: 
```
<span class="lblSectionChartChord"></span> ${transposedChordNotesFunctions} <span class="lblSectionMode"></span> ${transposedModeNotesFunctions}
```
- The location in the UI is a new tab in the tabgroup: `Desktop > SongWidgets` just like `#divDesktop` > `#divDesktopButtons`.  Its tab button will be after `#btnDesktopTabButtons` and before `#btnDesktopTabMIDI`.
- The tab page and textarea should be built using the same strategy as `./templates/info/` and `./tamplates/macro`.
- There does not need to be close button on the editing page, but there should be a checkmark save button that operates the same way: actual saving occurs because focus is lost, like Info and Macro.







