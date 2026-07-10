import * as Constants from './Constants.js';
import { Note } from './Note.js';

const { Chord } = globalThis.Tonal?.Chord
    ? globalThis.Tonal
    : await import('tonal');
const { Scale } = globalThis.Tonal?.Scale
    ? globalThis.Tonal
    : await import('tonal');

export const TonalSourceSet = Object.freeze({
    NAMEDNOTE: 'NamedNote',
    SINGLENOTE: 'SingleNote',
    TINYNOTE: 'TinyNote'
});

export function getChord(chordNameString){
    return Chord.get(chordNameString);
}
export function getMode(modeNameString){
    return Scale.get(modeNameString);
}

export function getTonalForTable(theSong, section, tablename, options = {}){
    let result = {};
    const applyWesternFilter = options.filterWesternScales !== false;
    let rootKey = theSong.noteIDToNoteName(section.rootID);
    result.rootKey = rootKey;
    let sectionNoteRootResult = section.getNoteRoot(tablename);//search order: tablename has a Note with `"colorClass": "noteRoot"`, then any other table in section (order: namedNotes, playedNotes, then recordedNotes), and pass back the "noteName" and the tablename, or null if nobody had it.
    if (sectionNoteRootResult){
        rootKey = sectionNoteRootResult.noteName;
        result.rootKey = rootKey;
        result.noteRootTablename = sectionNoteRootResult.tablename; 
    }
    let tableSectionNotes = section.sectionNotesByTable?.[tablename] || null;
    let tonalSourceSet = getEffectiveTonalSourceSet(tableSectionNotes);
    
    // For TinyNote, use LeadKey as the tonal root if it differs from Key and no noteRoot is placed
    if (tonalSourceSet === TonalSourceSet.TINYNOTE && !sectionNoteRootResult) {
        const leadKey = section.getRootKeyLead();
        if (leadKey && leadKey !== rootKey) {
            rootKey = leadKey;
            result.rootKey = rootKey;
        }
    }
    
    let namedNotes = collectTonalSourceNoteNames(tableSectionNotes, tonalSourceSet);
    let noteNamesForDetection = namedNotes.slice();
    if (result.rootKey && !noteNamesForDetection.includes(result.rootKey)) {
        noteNamesForDetection.unshift(result.rootKey);
    }
    let normalizedNamedNotes = normalizeChord(noteNamesForDetection, rootKey);
    let chords = Chord.detect(normalizedNamedNotes);
    result.normalizedNamedNotes = normalizedNamedNotes;
    result.scale = [];
    if (Array.isArray(result.normalizedNamedNotes) && result.normalizedNamedNotes.length > 0) {
        let worldScales = Scale.detect(result.normalizedNamedNotes, { tonic: rootKey });
        result.scale = applyWesternFilter ? filterWesternScales(worldScales) : worldScales;
    }
    result.chords = chords;
    result.chord = tableSectionNotes ? tableSectionNotes.chord : "";
    result.mode = tableSectionNotes ? tableSectionNotes.mode : "";
    result.tonalSourceSet = tonalSourceSet;
    return result;
}

export function getEffectiveTonalSourceSet(sectionNotes){
    const tonalSourceSet = sectionNotes?.tonalSourceSet || "";
    switch (tonalSourceSet) {
        case TonalSourceSet.SINGLENOTE:
        case TonalSourceSet.TINYNOTE:
        case TonalSourceSet.NAMEDNOTE:
            return tonalSourceSet;
        default:
            return TonalSourceSet.NAMEDNOTE;
    }
}

function collectTonalSourceNoteNames(sectionNotes, tonalSourceSet) {
    switch (tonalSourceSet) {
        case TonalSourceSet.SINGLENOTE:
            return collectPlayedNoteNamesByStyle(sectionNotes, Note.STYLENUM_SINGLE);
        case TonalSourceSet.TINYNOTE:
            return collectPlayedNoteNamesByStyle(sectionNotes, Note.STYLENUM_TINY);
        case TonalSourceSet.NAMEDNOTE:
        default:
            return collectNamedNoteNames(sectionNotes);
    }
}

function collectNamedNoteNames(sectionNotes) {
    let noteNames = [];
    Object.entries(sectionNotes?.namedNotes || {}).forEach(([noteName, noteObj]) => {
        if (noteObj && Object.keys(noteObj).length > 0) {
            noteNames.push(noteName);
        }
    });
    return noteNames;
}

function collectPlayedNoteNamesByStyle(sectionNotes, styleNum) {
    let noteNames = [];
    (sectionNotes?.playedNotes || []).forEach((noteObj) => {
        if (noteObj && noteObj.styleNum === styleNum && noteObj.noteName) {
            noteNames.push(noteObj.noteName);
        }
    });
    return noteNames;
}


function normalizeChord(arr, rootKey) {
  const unique = [...new Set(arr)];
  const sorted = unique.slice().sort(
    (a, b) => Constants.NOTE_NAMES_ARRAY.indexOf(a) - Constants.NOTE_NAMES_ARRAY.indexOf(b)
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
  "major pentatonic", "minor pentatonic", "blues", "double harmonic minor", "major blues", "minor blues",
  "harmonic minor", "melodic minor", "double harmonic major",
  "diminished", "half-diminished", "dominant diminished",
  "whole tone", "altered", "ultralocrian", "super locrian","augmented",
  "chromatic", "neapolitan major", "neapolitan minor", "balinese" 
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

function todoBetterMidiDetectOfModes(){
    //There are a few strategies.  
    // Strategy I: 
        const scaleIntervals = Scale.get("diminished").intervals;

        // 4. Transpose those intervals from your root
        const diminishedNotes = scaleIntervals.map(interval => Distance.transpose(rootName, interval));

    //Strategy II
        //import { Midi, Scale } from "@tonaljs/tonal";

        // 1. Array of MIDI numbers (e.g., C, Eb, Gb, Bbb -> C diminished 7th)
        const midiNumbers = [60, 63, 66, 69];

        // 2. Convert MIDI numbers to note names
        const notes = midiNumbers.map(num => Midi.midiToNoteName(num)); 
        // Result: ['C4', 'D#4', 'F#4', 'A4']

        // 3. Detect the scale/mode
        const detectedModes = Scale.detect(notes);
        console.log(detectedModes); 
        // Outputs matched scales like: [ 'C diminished', 'C locrian 6', ... ]
}


//==============================================================

