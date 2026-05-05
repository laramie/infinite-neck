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
        result.chord = sn.chord;
        result.mode = sn.mode;
        tablesResult[tableID] = result;
    });
    return tablesResult;
}

export function getTonalForTable(theSong, section, tablename){
    let rootKey = theSong.noteIDToNoteName(section.rootID);
    let result = {};
    let namedNotes = [];
    let tableSectionNotes = null;
    section.getAllSectionNotes().forEach(([tableID, sn]) => {
        if (tablename === tableID){
            tableSectionNotes = sn;
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
    result.scale = [];
    if (Array.isArray(result.normalizedNamedNotes) && result.normalizedNamedNotes.length > 0) {
        let worldScales = Scale.detect(result.normalizedNamedNotes, { tonic: rootKey });
        result.scale = filterWesternScales(worldScales);
    }
    result.chords = chords;
    result.chord = tableSectionNotes ? tableSectionNotes.chord : "";
    result.mode = tableSectionNotes ? tableSectionNotes.mode : "";
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

//========== Scale.detect has a silly amount of scales from around the world.  Filter it for Western. ==========

// Define your allowed Western scale types
const westernScales = [
  "major", "minor", 
  "ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian",
  "major pentatonic", "minor pentatonic", "blues",
  "harmonic minor", "melodic minor"
];

/** 
 * @param detections is the result of Scale.detect()
 */
function filterWesternScales(detections) {
  return detections.filter(detection => {
    // Extract the scale type (everything after the tonic name)
    const type = detection.split(" ").slice(1).join(" ");
    return westernScales.includes(type);
  });
}

//==============================================================

