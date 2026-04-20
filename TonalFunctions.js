import * as Constants from './Constants.js';

const { Chord } = globalThis.Tonal?.Chord
    ? globalThis.Tonal
    : await import('tonal');
const { Scale } = globalThis.Tonal?.Scale
    ? globalThis.Tonal
    : await import('tonal');

export function getTonal(theSong, section){
    let tablesResult = {};
    let rootKey = theSong.noteIDToNoteName(section.rootID);
    section.getAllSectionNotes().forEach(([tableID, sn]) => {
        let result = {};
        let namedNotes = [];
        Object.entries(sn?.namedNotes || {}).forEach(([noteName, noteObj]) => {
            if (noteObj && Object.keys(noteObj).length > 0) {
                namedNotes.push(noteName);
            }
        });
        let normalizedNamedNotes = normalizeChord(namedNotes, rootKey);
        let chords = Chord.detect(normalizedNamedNotes);
        result.normalizedNamedNotes = normalizedNamedNotes;
        result.chords = chords;
        result.scale = Scale.detect(result.normalizedNamedNotes, { tonic: rootKey });
        tablesResult[tableID] = result;
    });
    return tablesResult;
}

export function getTonalForTable(theSong, section, tablename){
    let rootKey = theSong.noteIDToNoteName(section.rootID);
    let result = {};
    let namedNotes = [];
    section.getAllSectionNotes().forEach(([tableID, sn]) => {
        if (tablename === tableID){
            Object.entries(sn?.namedNotes || {}).forEach(([noteName, noteObj]) => {
                if (noteObj && Object.keys(noteObj).length > 0) {
                    namedNotes.push(noteName);
                }
            });
        }
    });
    let normalizedNamedNotes = normalizeChord(namedNotes, theSong.noteIDToNoteName(section.rootID));
    let chords = Chord.detect(normalizedNamedNotes);
    result.normalizedNamedNotes = normalizedNamedNotes;
    result.scale = Scale.detect(result.normalizedNamedNotes, { tonic: rootKey });
    result.chords = chords;
    return result;
}


function normalizeChord(arr, rootKey) {
  // Remove duplicates
  const unique = [...new Set(arr)];
  // Sort by constNoteNamesArr order
  const sorted = unique.slice().sort(
    (a, b) => Constants.constNoteNamesArr.indexOf(a) - Constants.constNoteNamesArr.indexOf(b)
  );
  // Rotate so rootKey is first
  const idx = sorted.indexOf(rootKey);
  if (idx === -1) return sorted; // rootKey not found
  return sorted.slice(idx).concat(sorted.slice(0, idx));
}