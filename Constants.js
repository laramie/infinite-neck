export const TABLE_ID_PREFIX = "tbl";
export const NUM_FRETS_MAX = 108;
export const TABLEDIV_ID_PREFIX = "div";
export const ALL_TUNINGS_TABLE_ID = "allTuningsTable";
export const MY_TUNINGS_TABLE_ID = "myTuningsTable";

export const DEFAULT_BEATS = 4;
export const RANDOM_SECTION_HISTORY_MAX = 16;
export const FIRST_POSITION_MAX_FRET = 4;

export const SECTION_CHART_POSITION = Object.freeze({
    INTRO: 'INTRO',
    HEAD: 'HEAD',
    LINE: 'LINE',
    BAR: 'BAR',
    OUTRO: 'OUTRO'
});

export const SECTION_CHART_CAPTION_WIDTH = Object.freeze({
    NONE: 'none',
    SHORT: 'short',
    MEDIUM: 'medium',
    LINE: 'line'
});

export const SONG_CHART_BAR_CLASS = Object.freeze({
    BOX: 'Box',
    BARE: 'Bare',
    LEADSHEET: 'LeadSheet'
});

export function calcFretLengths() {
    var L0 = 1;
    const MAGIC_RATIO = 0.9438743;
    const FIRSTFRET_LENGTH = 0.05297;
    const fretLengths = [];
    for (var n = 2; n <= NUM_FRETS_MAX + 1; n++) {
        var Cn = (Math.pow(MAGIC_RATIO, n));
        var Cnm1 = (Math.pow(MAGIC_RATIO, (n - 1)));
        var R = (L0 * (1 - Cn) - L0 * (1 - Cnm1)) / FIRSTFRET_LENGTH;
        fretLengths.push(R);
    }
    return fretLengths;
}

export const noteNamesFuncArrDEFAULT = [
    "I", // 1 - I    I
    "&tau;", //"&tau;", // 2 - Tau    was: "&#x1D70F;"
    "II", // 3 - II
    "m", // 4 - m
    "III", // 5 - 3
    "IV", // 6 - IV
    "&Theta;", // 7 - Tri
    "V", // 8 - V
    "&sigma;", // 9 - Sigma
    "6", // 10 - VI
    "&delta;", // 11 - dom
    "&Delta;" // 12 - say 
];
export const NOTE_NAMES_ARRAY = "A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab".split(',');
export const SHARP_IDS = ['A', 'B', 'C', 'D', 'E', 'G'];
export const FUNCTION_OFFSETS = ["I+0","&tau;+1","II+2","m+3","III+4","IV+5","&Theta;+6","V+7","&sigma;+8","6+9","&delta;+10","&Delta;+11"];


export const FILL_CHORD_OPTIONS = [
    { value: '4,7', caption: 'M', trigger: 'M' },
    { value: '3,7', caption: 'm', trigger: 'm' },
    { value: '4,8', caption: 'aug', trigger: 'u' },
    { value: '3,6', caption: 'dim&nbsp;&nbsp;&nbsp;&ordm;', trigger: 'd' },
    { value: '3,6,9', caption: 'dim7', trigger: 'i' },
    { value: '3,6,10', caption: 'm7b5&nbsp;&nbsp;&nbsp;&oslash;', trigger: 'b' },
    { value: '2,7', caption: 'sus2', trigger: '2' },
    { value: '5,7', caption: 'sus4', trigger: '4' },
    { value: '4,7,11', caption: 'maj7&nbsp;&nbsp;&nbsp;&Delta;', trigger: 'a' },
    { value: '3,7,10', caption: 'm7', trigger: 'n' },
    { value: '4,7,10', caption: '7 (dom7)', trigger: '7' },
    { value: '3,7,11', caption: 'm/ma7', trigger: 'j' },
    { value: '3,7,10,14', caption: 'm9', trigger: '9' },
    { value: '4,7,9,14', caption: '6add9', trigger: '6' }
];

export const FILL_SCALE_OPTIONS = [
    { value: '0,2,4,6,8,10', caption: 'WholeTone', trigger: 'w' },
    { value: '0,3,6,9', caption: 'Diminished', trigger: 'd' },
    { value: '0,3,5,7,10', caption: 'MinPentatonic', trigger: 'p' },
    { value: '0,2,4,7,9', caption: 'MajPentatonic', trigger: 't' },
    { value: '0,2,4,5,7,9,11', caption: 'Ionian/Major', trigger: 'i' },
    { value: '0,2,3,5,7,9,10', caption: 'Dorian', trigger: 'o' },
    { value: '0,1,3,5,7,8,10', caption: 'Phrygian', trigger: 'h' },
    { value: '0,2,4,6,7,9,11', caption: 'Lydian', trigger: 'l' },
    { value: '0,2,4,6,7,9,10', caption: 'LydianDominant', trigger: 'y' },
    { value: '0,2,4,5,7,9,10', caption: 'Mixolydian', trigger: 'x' },
    { value: '0,2,3,5,7,8,10', caption: 'Aeolian/Natural', trigger: 'a' },
    { value: '0,1,3,5,6,8,10', caption: 'Locrian', trigger: 'c' },
    { value: '0,2,3,5,7,8,11', caption: 'HarmonicMinor', trigger: 'r' },
    { value: '0,2,3,5,7,9,11', caption: 'MelodicMinor', trigger: 'm' },
    { value: '0,1,4,5,7,8,10', caption: 'Gypsy', trigger: 'g' },
    { value: '0,1,3,5,7,9,11', caption: 'NeopolitanMaj', trigger: 'n' },
    { value: '0,1,3,5,7,8,11', caption: 'NeopolitanMin', trigger: 'e' }
];


export function noteIDToNoteNameRaw(noteIndex) {
    return NOTE_NAMES_ARRAY[noteIndex];
}

export function noteIdPrefersSharps(noteIndex) {
    const normalizedIndex = ((Number.parseInt(noteIndex, 10) || 0) % NOTE_NAMES_ARRAY.length + NOTE_NAMES_ARRAY.length) % NOTE_NAMES_ARRAY.length;
    return SHARP_IDS.includes(noteIDToNoteNameRaw(normalizedIndex));
}

export function noteNameToNoteID(noteName) {
    return NOTE_NAMES_ARRAY.indexOf(noteName);
}

export function midinumToNoteName(midinum) {
    if (midinum <= 9) {
        midinum += 12;
    }
    var index = (midinum - 9) % 12;
    return NOTE_NAMES_ARRAY[index];
    // 21 == A0
    // 9 == A, 8 Ab, 7 G, 6 Gb, 5 F, 4 E, 3 Eb, 2 D, 1 Db, 0 C
}
