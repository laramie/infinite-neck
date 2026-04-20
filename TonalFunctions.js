import * as Constants from './Constants.js';

const { Chord } = globalThis.Tonal?.Chord
    ? globalThis.Tonal
    : await import('tonal');

export function getChartChords(theSong, section){
    let result = {};
    let namedNotes = [];
    section.getAllSectionNotes().forEach(([tableID, sn]) => {
        Object.entries(sn?.namedNotes || {}).forEach(([noteName, noteObj]) => {
            // Only include if noteObj is not empty (has at least one property)
            if (noteObj && Object.keys(noteObj).length > 0) {
                namedNotes.push(noteName);
            }
        });
    });
    let normalizedNamedNotes = normalizeChord(namedNotes, theSong.noteIDToNoteName(section.rootID));
    let chords = Chord.detect(normalizedNamedNotes);
    let chordsLinks = '';
    if (Array.isArray(chords) && chords.length > 0) {
        chordsLinks = chords.map(s => `<a href='#${s}'>${s}</a>`);
    } else {
        chordsLinks = 'none';
    }
    result.normalizedNamedNotes = normalizedNamedNotes;
    result.chords = chords;
    return result;
}

export function getTonalForTable(theSong, section, tablename){
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
    let chords = Chord.detect(normalizeChord(namedNotes, theSong.noteIDToNoteName(section.rootID)));
    let chordsLinks = '';
    if (Array.isArray(chords) && chords.length > 0) {
        chordsLinks = chords
            .map(s => `<a href='#${s}'>${s}</a>`)
            .join('&nbsp;');
    }
    return chordsLinks;
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