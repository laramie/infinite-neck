import * as Constants from '../../Constants.js';

const tonalNamespace = globalThis.Tonal?.Chord
  ? globalThis.Tonal
  : await import('tonal');
const { Chord, Scale, Interval } = tonalNamespace;

const NONE_VALUES = new Set(['none', '(none)']);

const CHORD_ALIAS_MAP = new Map([
  ['dom7', '7'],
  ['major', 'M'],
  ['Major', 'M'],
  ['Maj', 'M'],
  ['minor', 'm'],
  ['madd9', '6add9']
]);

const MODE_ALIAS_MAP = new Map([
  ['gypsy', 'double harmonic major'],
  ['neapolitan minor', 'balinese'],
  ['minor (aeolian/natural)', 'minor'],
  ['major (ionian)', 'major']
]);

function normalizeText(rawValue) {
  return `${rawValue || ''}`.trim();
}

function normalizeAliasKey(rawValue) {
  return normalizeText(rawValue).toLowerCase();
}

function stripCaptionParens(rawValue) {
  const text = normalizeText(rawValue);
  const trailingCaptionMatch = text.match(/^(.+?)\s+\([^)]*\)$/);
  if (trailingCaptionMatch) {
    return normalizeText(trailingCaptionMatch[1]);
  }
  const wrappedCaptionMatch = text.match(/^\((.+)\)$/);
  if (wrappedCaptionMatch) {
    return normalizeText(wrappedCaptionMatch[1]);
  }
  return text;
}

function isNoneValue(rawValue) {
  const normalized = normalizeAliasKey(rawValue);
  return !normalized || normalized === '%' || NONE_VALUES.has(normalized);
}

function normalizeModeAlias(rawMode) {
  const stripped = stripCaptionParens(rawMode);
  const normalized = normalizeAliasKey(stripped);
  if (MODE_ALIAS_MAP.has(normalized)) {
    return MODE_ALIAS_MAP.get(normalized);
  }
  return stripped;
}

function normalizeChordAlias(rawChord) {
  const stripped = stripCaptionParens(rawChord);
  const normalized = normalizeAliasKey(stripped);
  if (CHORD_ALIAS_MAP.has(normalized)) {
    return CHORD_ALIAS_MAP.get(normalized);
  }
  return stripped;
}

function rootIDToNoteName(rootID = 0) {
  const normalized = ((Number.parseInt(rootID, 10) || 0) % 12 + 12) % 12;
  return Constants.NOTE_NAMES_ARRAY[normalized] || Constants.NOTE_NAMES_ARRAY[0];
}

function parseChordBestEffort(rawChord) {
  const normalized = normalizeChordAlias(rawChord);
  const direct = Chord.get(normalized);
  if (!direct.empty) {
    return direct;
  }

  const compact = normalized.replace(/\s+/g, '');
  const compactParsed = Chord.get(compact);
  if (!compactParsed.empty) {
    return compactParsed;
  }

  return Chord.get('');
}

function parseScaleBestEffort(rawMode) {
  const normalized = normalizeModeAlias(rawMode);
  const direct = Scale.get(normalized);
  if (!direct.empty) {
    return direct;
  }

  // Try replacing compact labels with spaces for values like LydianDominant.
  const spaced = normalized.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  const spacedParsed = Scale.get(spaced);
  if (!spacedParsed.empty) {
    return spacedParsed;
  }

  return Scale.get('');
}

function intervalsToNoteSet(intervals = [], rootID = 0) {
  const result = new Set();
  intervals.forEach((interval) => {
    const semitones = Interval.semitones(interval);
    if (!Number.isFinite(semitones)) {
      return;
    }
    result.add(Constants.NOTE_NAMES_ARRAY[(rootID + semitones) % 12]);
  });
  return result;
}

function composeChordWithRoot(rootName, chordType) {
  const tight = `${rootName}${chordType}`.trim();
  if (!Chord.get(tight).empty) {
    return tight;
  }
  const spaced = `${rootName} ${chordType}`.trim();
  if (!Chord.get(spaced).empty) {
    return spaced;
  }
  return tight;
}

function composeModeWithRoot(rootName, modeType) {
  const spaced = `${rootName} ${modeType}`.trim();
  if (!Scale.get(spaced).empty) {
    return spaced;
  }
  return spaced;
}

export function canonicalizeChordForStorage(rawChord = '', options = {}) {
  const text = normalizeText(rawChord);
  if (isNoneValue(text)) {
    return '';
  }

  const parsed = parseChordBestEffort(text);
  if (!parsed.empty) {
    if (parsed.tonic) {
      return parsed.symbol;
    }
    const rootName = normalizeText(options.rootNoteName || '');
    if (rootName) {
      const rooted = composeChordWithRoot(rootName, parsed.symbol || normalizeChordAlias(text));
      const rootedParsed = Chord.get(rooted);
      if (!rootedParsed.empty) {
        return rootedParsed.symbol;
      }
    }
    return parsed.symbol || text;
  }

  return text;
}

export function canonicalizeModeForStorage(rawMode = '', options = {}) {
  const text = normalizeText(rawMode);
  if (isNoneValue(text)) {
    return '';
  }

  const parsed = parseScaleBestEffort(text);
  if (!parsed.empty) {
    if (parsed.tonic) {
      return parsed.name;
    }
    const rootName = normalizeText(options.rootNoteName || '');
    if (rootName) {
      const rooted = composeModeWithRoot(rootName, parsed.type || parsed.name || normalizeModeAlias(text));
      const rootedParsed = Scale.get(rooted);
      if (!rootedParsed.empty) {
        return rootedParsed.name;
      }
    }
    return parsed.name || text;
  }

  return normalizeModeAlias(text);
}

export function chordTypeFromStoredChord(rawChord = '') {
  if (isNoneValue(rawChord)) {
    return '';
  }
  const chord = parseChordBestEffort(rawChord);
  if (chord.empty) {
    return '';
  }
  let chordType = chord.symbol || '';
  if (chord.tonic && chord.symbol.toLowerCase().startsWith(chord.tonic.toLowerCase())) {
    const suffix = chord.symbol.slice(chord.tonic.length).trim();
    chordType = suffix || 'M';
  }
  const withoutSlashBass = chordType.split('/')[0].trim();
  return normalizeChordAlias(withoutSlashBass);
}

export function modeTypeFromStoredMode(rawMode = '') {
  if (isNoneValue(rawMode)) {
    return '';
  }
  const mode = parseScaleBestEffort(rawMode);
  if (mode.empty) {
    return '';
  }
  return mode.type || mode.name || '';
}

export function chordNotesFromStoredChord(rawChord = '', rootID = 0) {
  if (isNoneValue(rawChord)) {
    return new Set();
  }
  const chord = parseChordBestEffort(rawChord);
  if (chord.empty) {
    return new Set();
  }
  return intervalsToNoteSet(chord.intervals || [], ((Number.parseInt(rootID, 10) || 0) % 12 + 12) % 12);
}

export function modeNotesFromStoredMode(rawMode = '', rootID = 0) {
  if (isNoneValue(rawMode)) {
    return new Set();
  }
  const mode = parseScaleBestEffort(rawMode);
  if (mode.empty) {
    return new Set();
  }
  return intervalsToNoteSet(mode.intervals || [], ((Number.parseInt(rootID, 10) || 0) % 12 + 12) % 12);
}

export function chordNotesFromType(chordType = '', rootID = 0) {
  if (isNoneValue(chordType)) {
    return new Set();
  }
  const rootName = rootIDToNoteName(rootID);
  const chord = Chord.get(composeChordWithRoot(rootName, normalizeChordAlias(chordType)));
  if (chord.empty) {
    return new Set();
  }
  return intervalsToNoteSet(chord.intervals || [], ((Number.parseInt(rootID, 10) || 0) % 12 + 12) % 12);
}

export function modeNotesFromType(modeType = '', rootID = 0) {
  if (isNoneValue(modeType)) {
    return new Set();
  }
  const rootName = rootIDToNoteName(rootID);
  const mode = Scale.get(composeModeWithRoot(rootName, normalizeModeAlias(modeType)));
  if (mode.empty) {
    return new Set();
  }
  return intervalsToNoteSet(mode.intervals || [], ((Number.parseInt(rootID, 10) || 0) % 12 + 12) % 12);
}
