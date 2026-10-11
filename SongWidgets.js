import * as Constants from './Constants.js';
import { createLookupContext, lookupClassForNote } from './colorFunctions.js';
import { Note } from './Note.js';
import { getSong } from './infinite-neck.js';

const LETTER_CHROMA = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_HTML = { '#': '&sharp;', 'b': '&flat;' };

/** Tonal chroma (C==0) of a note name such as "Eb" or "F#", or -1 if unparseable. */
function noteNameToChroma(noteName) {
    const letter = `${noteName || ''}`.charAt(0).toUpperCase();
    if (!(letter in LETTER_CHROMA)) {
        return -1;
    }
    let chroma = LETTER_CHROMA[letter];
    for (const accidental of `${noteName}`.slice(1)) {
        chroma += accidental === '#' ? 1 : (accidental === 'b' ? -1 : 0);
    }
    return ((chroma % 12) + 12) % 12;
}

function formatNoteNameHtml(noteName) {
    const letter = noteName.charAt(0);
    const accidentals = [...noteName.slice(1)].map((acc) => ACCIDENTAL_HTML[acc] ? `<em>${ACCIDENTAL_HTML[acc]}</em>` : '').join('');
    return letter + accidentals;
}

function sanitizeClassList(classList) {
    return `${classList || ''}`.replace(/[^\w\s-]/g, '').trim();
}

/** Builds a two-row table (function symbols over note names) for a list of already-transposed
 *  note names, e.g. ['Eb','G','Bb','D'] in Section Key Eb.
 *  - Function row colors come from the current color dict (note1..note12, honoring Palette > Stylesheets),
 *    always as though AutoColor were on.
 *  - Function symbols come from the Song's current `View > Function Symbols`.
 *  - Notes remaining with a sharp or flat (after TonalNote.simplify) are blackKey, otherwise whiteKey. */
export function formatTransposedChordNotesFunctions(noteArray, relativeToLeadKey=false){
    const notes = (Array.isArray(noteArray) ? noteArray : []).filter((noteName) => noteNameToChroma(noteName) >= 0);
    if (notes.length === 0) {
        return '';
    }

    const lookupContext = createLookupContext({ autoColor: true });
    const songSymbols = getSong()?.noteNamesFuncArr;
    const symbols = Array.isArray(songSymbols) ? songSymbols : Constants.noteNamesFuncArrDEFAULT;

    let functionCells = '';
    let noteCells = '';
    notes.forEach((noteName) => {
        const chroma = noteNameToChroma(noteName);
        // Constants.NOTE_NAMES_ARRAY starts at A (index 0) and uses the flat spelling lookupClassForNote() expects.
        const lookupNoteName = Constants.NOTE_NAMES_ARRAY[(chroma + 3) % 12];
        const lookedUp = lookupClassForNote({ noteName: lookupNoteName, styleNum: Note.STYLENUM_NAMED }, lookupContext);
        const colorClass = sanitizeClassList(lookedUp?.colorClass);
        const symbol = lookedUp ? (symbols[lookedUp.functionNum] ?? '') : '';
        const keyClass = noteName.length > 1 ? 'blackKey' : 'whiteKey';
        functionCells += `<td class='${colorClass}'>${symbol}</td>`;
        noteCells += `<td class='${keyClass}'>${formatNoteNameHtml(noteName)}</td>`;
    });

    return `<table class='notesFunctionTable' style='display: inline-table;'>`
        + `<tr class='functionRow'>${functionCells}</tr>`
        + `<tr class='notesRow'>${noteCells}</tr>`
        + `</table>`;
}
   