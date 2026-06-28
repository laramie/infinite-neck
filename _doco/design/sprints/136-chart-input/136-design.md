# sprint-136-chart-input

## Goal 

Create a pop-up float window that accepts text input, navigation commands, and acceptance keystrokes, and populates Section.chartChord and Section.chartMode.

# Iteration 1: Define UI, chart input

## Design

We need a pop-up float window, like `/fi`.  When parked, it would live in a tab-page in `Chart > Input` betweeen `Chart > Summary` and `Chart > Notes`.

It will be live in the sense that when the acceptance key (ENTER) is pressed, it will persist into the Song in the current Section, and kick the Section Update event so that the Chart, the Section, and TonalPicker all get the news.

It will have two controls, probably both one-line edit boxes, one for chartChord, one for chartMode.  They will be on the same row, in that order. They will have labels:
` chord: [edit box for chord]   mode: [edit box for mode]`
TAB key takes us back and forth between these.  SPACE key cycles us through presented option.  ENTER key accepts current cycled option and then populates the current edit box, leaving focus there in case of editing or SPACE key.  SPACE key would cycle through any remaining options.

It will have a div above the input row, which will present the options for the currently focused edit box.  When the edit box is empty, the div should be empty, rather than display the entire list of possibilities.  The possibilities appear when the first non-key specifier is typed.  SPACE key cycles, so to input a space for mode, User can hit SHIFT+SPACE.  But modes without spaces should be accpeted.  So typing `Cminorpentatonic` should present `C minor pentatonic` in the list of acceptable choices in the list div.

When an item in the list is "current", it is presented in reverse: black background with cyan bold text.  When it is in the list, it is the same background as the list, white, with black, normal text.  When the list is first presented on a hit from the edit box, the first item is "current".  SPACE key cycles us through the list making the next item current, until after the last one, when it cycles to the top of the list.  The list should be 5 items tall, then wrap to the next column.  If there will be more than 5 columns, that number of items per column should be adjusted up.

Here is the maximum list from Tonal.js, because no characters have been chosen to filter it: 

```
> console.dir(ChordType.symbols().sort(), { maxArrayLength: null });
[
'+add#9',     '11',      '11b9',      '13',       '13#11',
'13#9',       '13#9#11', '13b5',      '13b9',     '13b9#11',
'13no5',      '13sus4',  '4',         '5',        '6',
'69#11',      '6add9',   '7',         '7#11',     '7#11b13',
'7#5',        '7#5#9',   '7#5b9',     '7#5b9#11', '7#5sus4',
'7#9',        '7#9#11',  '7#9#11b13', '7#9b13',   '7add6',
'7b13',       '7b5',     '7b6',       '7b9',      '7b9#11',
'7b9#9',      '7b9b13',  '7b9b13#11', '7no5',     '7sus4',
'7sus4b9b13', '9',       '9#11',      '9#11b13',  '9#5',
'9#5#11',     '9b13',    '9b5',       '9no5',     '9sus4',
'M',          'M#5add9', 'M13#11',    'M6#11',    'M7#5sus4',
'M7add13',    'M7b5',    'M7b6',      'M7b9',     'M7sus4',
'M9#5sus4',   'M9b5',    'M9sus4',    'Madd9',    'Maddb9',
'Mb5',        'alt7',    'aug',       'b9sus',    'dim',
'dim7',       'm',       'm#5',       'm/ma7',    'm11',
'm11A',       'm13',     'm6',        'm69',      'm7',
'm7#5',       'm7add11', 'm7b5',      'm9',       'm9#5',
'm9b5',       'mM9',     'mMaj7b6',   'mMaj9b6',  'madd4',
'madd9',      'maj#4',   'maj13',     'maj7',     'maj7#5',
'maj7#9#11',  'maj9',    'maj9#11',   'maj9#5',   'mb6M7',
'mb6b9',      'o7M7',    'oM7',       'sus2',     'sus24',
'sus4'
]

```

The maximum modes list is `Constants.js::FILL_SCALE_OPTIONS`.

The acceptable input names for Key are 
`Constants.js::NOTE_NAMES_ARRAY`
or 
`Constants.js::NOTE_NAMES_ARRAY_SHARPS`
which, of course, map exactly to NOTE_NAMES_ARRAY in terms of note equivalencce.  But Tonal accepts sharps names, e.g. `C#m7` as well as `Dbm7`.  The current Section determines, ultimately, whether flats or sharps are displayed.  So enterming C#m7 will work in the edit box, but the Chart etc. show sharps/flats appropriately when the Section changed/update event is fired.

Since they are not needed for chords or modes, the special character key-presses will map to navigation commands similar to the global keyboard shortcuts.

When in one of the chord or mode edit boxes, then, these character do the following: 
`,` : prevSection
`.` : nextSection
`<` : firstSection
`>` : lastSection

Other navigation can be achieved by leaving the focus of the inputs, and using the Transport.  Therefore, when the Section changes, input box values are lost and are replaced by Section.chartChord and Section.chartMode when present, and the suggestion div is updated if the input boxes are visible in `Chart > Input` or if the Input is floated.
