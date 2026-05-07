export const TABLE_ID_PREFIX = "tbl";
export const NUM_FRETS_MAX = 108;
export const TABLEDIV_ID_PREFIX = "div";
export const ALL_TUNINGS_TABLE_ID = "allTuningsTable";
export const MY_TUNINGS_TABLE_ID = "myTuningsTable";

export const DEFAULT_BEATS = 4;
export const RANDOM_SECTION_HISTORY_MAX = 16;

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
    "&Delta;" // 12 - I
];
export const NOTE_NAMES_ARRAY = "A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab".split(',');


export function noteIDToNoteNameRaw(noteIndex) {
    return NOTE_NAMES_ARRAY[noteIndex];
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
