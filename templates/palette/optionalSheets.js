// Sprint 155: the OPTIONAL system stylesheets (not part of the shipping set).  Data only.
// Which sheets exist, their folders and their order is decided in systemFolders.js; this file holds the cells.
//
// How to edit
//   - A sheet is { readOnly: true, computed: false, checked: false, dict }.  `checked` is reset on every Song open
//     (from `defaultOn` in systemFolders.js), so leave it false here.
//   - A cell is { colorClass, caption, tiny?, captionClass? }.  The live dictionary replaces the WHOLE cell of a role,
//     so give each cell the caption (and tiny / captionClass) you want to see.  colorClass is a color class
//     optionally followed by a `noteHatched...` class (that is how the editor splits color and hatch).
//   - Classes may only use [A-Za-z0-9_ -] (see sanitizeCell in stylesheetPlan.js) and must exist in a stylesheet.
//   - Moods cover note1..note12 only.  noteRoot stays with Roles for now (the Piano, Guitar and MIDI Root styles
//     differ and are still being worked out).  The Song versions of these sheets also colored noteRoot:
//       light-minor (mode-nat-minor-transposed-ebony-ivory.json):
//         noteRoot: { colorClass: 'noteHatched4 noteBlue7', captionClass: 'noteBlack', caption: 'Root', tiny: 'R' }
//     and note1 had a "MOJOcaptionClass": "noteBlack" key, which is not a real field, so it is not copied.
//   - The three Printing sheets start as copies of All-Clear so they can be hand-edited.  `Gradient` and `Halftone`
//     each have one finished cell, note1, as a pattern to follow.

const sheet = (dict) => ({ readOnly: true, computed: false, checked: false, dict });

// Copied from the Song stylesheet "light" (theory/mode-major-transposed-S6.json).
const MoodLight = sheet({
    note1: { colorClass: 'noteGreen3', caption: 'I' },
    note2: { colorClass: 'noteYellow6', caption: '&tau;' },
    note3: { colorClass: 'noteYellow5', caption: 'II' },
    note4: { colorClass: 'noteYellow5', caption: 'm' },
    note5: { colorClass: 'noteGreen6', caption: 'III' },
    note6: { colorClass: 'noteYellow5', caption: 'IV' },
    note7: { colorClass: 'noteYellow5', caption: '&Theta;' },
    note8: { colorClass: 'noteGreen7', caption: 'V' },
    note9: { colorClass: 'noteYellow5', caption: '&sigma;' },
    note10: { colorClass: 'noteYellow5', caption: '6' },
    note11: { colorClass: 'noteYellow5', caption: '&delta;' },
    note12: { colorClass: 'noteYellow5', caption: '&Delta;' }
});

// Copied from the Song stylesheet "light-minor" (theory/mode-nat-minor-transposed-ebony-ivory.json), without noteRoot.
const MoodMinor = sheet({
    note1: { colorClass: 'noteBlue7', caption: 'I' },
    note2: { colorClass: 'notePink3', caption: '&tau;' },
    note3: { colorClass: 'noteBlue2', caption: 'II' },
    note4: { colorClass: 'noteBlue4', caption: 'm' },
    note5: { colorClass: 'noteGreen7', caption: 'III' },
    note6: { colorClass: 'noteBlue2', caption: 'IV' },
    note7: { colorClass: 'notePink3', caption: '&Theta;' },
    note8: { colorClass: 'noteBlue5', caption: 'V' },
    note9: { colorClass: 'noteBlue2', caption: '&sigma;' },
    note10: { colorClass: 'notePink3', caption: '6' },
    note11: { colorClass: 'noteBlue2', caption: '&delta;' },
    note12: { colorClass: 'noteGreen7', caption: '&Delta;' }
});

// Printing: complete sheets (every role), starting as copies of All-Clear.
const printingDict = () => ({
    note1: { colorClass: 'noteWhite', caption: 'I' },
    note2: { colorClass: 'noteWhite', caption: '&tau;' },
    note3: { colorClass: 'noteWhite', caption: 'II' },
    note4: { colorClass: 'noteWhite', caption: 'm' },
    note5: { colorClass: 'noteWhite', caption: 'III' },
    note6: { colorClass: 'noteWhite', caption: 'IV' },
    note7: { colorClass: 'noteWhite', caption: '&Theta;' },
    note8: { colorClass: 'noteWhite', caption: 'V' },
    note9: { colorClass: 'noteWhite', caption: '&sigma;' },
    note10: { colorClass: 'noteWhite', caption: '6' },
    note11: { colorClass: 'noteWhite', caption: '&delta;' },
    note12: { colorClass: 'noteWhite', caption: '&Delta;' },
    noteScale: { colorClass: 'noteWhite', caption: 'Scale', tiny: 'Sc' },
    noteRoot: { colorClass: 'noteWhite', captionClass: 'noteBassPlayer', caption: 'Root', tiny: 'R' },
    noteChord: { colorClass: 'noteWhite', caption: 'Chord', tiny: 'Ch' },
    noteChord2: { colorClass: 'noteWhite', caption: 'Ch2', tiny: 'Ch' },
    noteChord3: { colorClass: 'noteWhite', caption: 'Ch3', tiny: 'Ch' },
    noteColornote: { colorClass: 'noteWhite', caption: 'Colornote', tiny: 'C1' },
    noteColornote2: { colorClass: 'noteWhite', caption: 'C2', tiny: 'C2' },
    noteColornote3: { colorClass: 'noteWhite', caption: 'C3', tiny: 'C3' },
    noteChromatic: { colorClass: 'noteWhite', caption: 'Chromatic', tiny: 'c' },
    notePassing: { colorClass: 'noteWhite', caption: 'Passing', tiny: 'p' },
    noteAvoid: { colorClass: 'noteWhite', captionClass: 'noteBlackout1Caption', caption: 'Avoid', tiny: 'a1' },
    noteAvoid2: { colorClass: 'noteWhite', captionClass: 'noteBlackout2Caption', caption: 'Avoid', tiny: 'a2' },
    noteAvoid3: { colorClass: 'noteWhite', caption: 'Avoid', tiny: 'a3' },
    noteBass: { colorClass: 'noteWhite', captionClass: 'noteBassPlayer', caption: 'Bass', tiny: 'B' },
    noteLead: { colorClass: 'noteWhite', caption: 'Lead', tiny: 'L' },
    noteLead2: { colorClass: 'noteWhite', caption: 'Lead 2', tiny: 'L2' },
    noteFinger0: { colorClass: 'noteWhite', caption: 'Finger0', tiny: 'F0' },
    noteFinger1: { colorClass: 'noteWhite', caption: 'Finger1', tiny: 'F1' },
    noteFinger2: { colorClass: 'noteWhite', caption: 'F2', tiny: 'F2' },
    noteFinger3: { colorClass: 'noteWhite', caption: 'F3', tiny: 'F3' },
    noteFinger4: { colorClass: 'noteWhite', caption: 'F4', tiny: 'F4' },
    noteFingerT: { colorClass: 'noteWhite', caption: 'Thumb', tiny: 'T' },
    noteH1: { colorClass: 'noteWhite', caption: 'H1', tiny: 'H1' },
    noteH2: { colorClass: 'noteWhite', caption: 'H2', tiny: 'H2' },
    noteH3: { colorClass: 'noteWhite', caption: 'H3', tiny: 'H3' }
});

// Black and white as All-Clear is today.
const Letterpress = sheet(printingDict());

// note1 is the CycleOfColors note1 cell exactly (a gradient hatch over noteWhite, caption "I").
const Gradient = sheet({
    ...printingDict(),
    note1: { colorClass: 'noteHatchedRootPink noteWhite', caption: 'I' }
});

// note1 is a halftone image: .noteHatchedHalftoneTrippy (infinite-neck.css) is the "halftone-trippy" image of
// #dropDownBorderImageWhiteKey, url('img/halftone-trippy.png'), over noteWhite.
const Halftone = sheet({
    ...printingDict(),
    note1: { colorClass: 'noteHatchedHalftoneTrippy noteWhite', caption: 'I' }
});

export const OPTIONAL_SHEETS = { MoodLight, MoodMinor, Letterpress, Gradient, Halftone };
