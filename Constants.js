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
    { value: 'M', caption: 'M', trigger: 'M' },
    { value: 'm', caption: 'm', trigger: 'm' },
    { value: 'aug', caption: 'aug', trigger: 'u' },
    { value: 'dim', caption: 'dim&nbsp;&nbsp;&nbsp;&ordm;', trigger: 'd' },
    { value: 'dim7', caption: 'dim7', trigger: 'i' },
    { value: 'm7b5', caption: 'm7b5&nbsp;&nbsp;&nbsp;&oslash;', trigger: 'b' },
    { value: 'sus2', caption: 'sus2', trigger: '2' },
    { value: 'sus4', caption: 'sus4', trigger: '4' },
    { value: 'maj7', caption: 'maj7&nbsp;&nbsp;&nbsp;&Delta;', trigger: 'a' },
    { value: 'm7', caption: 's m7', trigger: 's' },
    { value: '7', caption: '7 (dom7)', trigger: '7' },
    { value: '7no5', caption: '7no5', trigger: 'n' },
    { value: 'm/ma7', caption: 'm/ma7', trigger: 'j' },
    { value: 'm9', caption: 'm9', trigger: '9' },
    { value: '6add9', caption: '6add9', trigger: '6' },
    { value: '', caption: 'none', trigger: '0' }
];

export const FILL_SCALE_OPTIONS = [
    { value: 'major', caption: 'major (ionian)', trigger: '1' },
    { value: 'dorian', caption: 'dorian', trigger: '2' },
    { value: 'phrygian', caption: 'phrygian', trigger: '3' },
    { value: 'lydian', caption: 'lydian', trigger: '4' },
    { value: 'mixolydian', caption: 'mixolydian', trigger: '5' },
    { value: 'minor', caption: 'minor (aeolian/natural)', trigger: '6' },
    { value: 'locrian', caption: 'locrian', trigger: '7' },
    { value: 'whole tone', caption: 'whole tone', trigger: 'w' },
    { value: 'diminished', caption: 'diminished', trigger: 'd' },
    { value: 'minor pentatonic', caption: 'minor pentatonic', trigger: 'p' },
    { value: 'major pentatonic', caption: 'major Pentatonic', trigger: 'P' },
    { value: 'harmonic minor', caption: 'harmonic minor', trigger: 'h' },
    { value: 'melodic minor', caption: 'melodic minor', trigger: 'm' },
    { value: 'lydian dominant', caption: 'Lydian dominant', trigger: 'L' },
    { value: 'double harmonic major', caption: '(Gypsy)', trigger: 'G' },
    { value: 'neapolitan major', caption: 'Neapolitan major', trigger: 'N' },
    { value: 'balinese', caption: '(neapolitan minor)', trigger: 'n' },
    { value: '', caption: '(none)', trigger: '0' }
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
