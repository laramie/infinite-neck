export const TABLE_ID_PREFIX = "tbl";
export const NUM_FRETS_MAX = 108;
export const TABLEDIV_ID_PREFIX = "div";
export const ALL_TUNINGS_TABLE_ID = "allTuningsTable";
export const MY_TUNINGS_TABLE_ID = "myTuningsTable";

/*
(?<!\.)\bNUM_FRETS_MAX\b
(?<!\.)\bTABLEDIV_ID_PREFIX\b
(?<!\.)\bTABLE_ID_PREFIX\b
(?<!\.)\bALL_TUNINGS_TABLE_ID\b
(?<!\.)\bMY_TUNINGS_TABLE_ID\b

*/

export function calcFretLengths() {
    var width = 60;
    var L0 = 1;
    const MAGIC_RATIO = 0.9438743;
    const FIRSTFRET_LENGTH = 0.05297;
    const fretLengths = [];
    for (var n = 2; n <= Constants.NUM_FRETS_MAX + 1; n++) {
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
