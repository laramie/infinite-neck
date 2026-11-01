// MIDI Paste string maps (sprint 151).  Pure module: no DOM, no Song access.
//
// A map is a list of "source:dest" string pairs, 1-based, string 1 = top of the page.
//   "1:1, 2:4, 3:2"
// Strings not named in a map are not pasted (source) or receive nothing (dest).
import { BUILTIN_MIDI_PASTE_MAPS } from './midiPasteMapBuiltins.js';

export const MAX_STRING_NUMBER = 99;
export const MAX_SPEC_LENGTH = 400;
export const MAX_ID_LENGTH = 60;
export const MAX_USER_MAPS = 100;

// Menu trigger keys for choosing a map: 1-9 then a-z.  'n' is reserved for the n)one entry.
export const MAP_CHOICE_TRIGGERS = Object.freeze([
  ...'123456789',
  ...'abcdefghijklmopqrstuvwxyz'
]);

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// ids
// ---------------------------------------------------------------------------

/**
 * Sanitizes and canonicalizes a map id.
 * Keeps letters, digits, space, _ - . ' and at most one '>'.  A pair-form id is
 * rewritten to "A > B".  Returns { id, changed, error }.
 */
export function normalizeMapId(raw) {
  const original = `${raw ?? ''}`.trim();
  const stripped = original
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z0-9 _\-.'>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) {
    return { id: '', changed: original !== '', error: 'id is empty' };
  }
  const parts = stripped.split('>');
  let id = stripped;
  if (parts.length > 2) {
    return { id: '', changed: true, error: 'id may contain only one >' };
  }
  if (parts.length === 2) {
    const source = parts[0].trim();
    const dest = parts[1].trim();
    if (!source || !dest) {
      return { id: '', changed: true, error: 'an id with > needs a name on both sides, like "P48 > P46"' };
    }
    id = `${source} > ${dest}`;
  }
  if (id.length > MAX_ID_LENGTH) {
    return { id: '', changed: true, error: `id is longer than ${MAX_ID_LENGTH} characters` };
  }
  return { id, changed: id !== original, error: '' };
}

export function cleanMapId(raw) {
  return normalizeMapId(raw).id;
}

/** { source, dest } for a pair-form id ("A > B"), else null. */
export function splitMapId(id) {
  const text = `${id ?? ''}`;
  const index = text.indexOf('>');
  if (index < 0) {
    return null;
  }
  const source = text.slice(0, index).trim();
  const dest = text.slice(index + 1).trim();
  return source && dest ? { source, dest } : null;
}

// ---------------------------------------------------------------------------
// specs
// ---------------------------------------------------------------------------

/**
 * Parses "1:1, 2:2".  Spaces around commas and colons are tolerated; the stored spec is the
 * trimmed text exactly as typed.  Returns { ok, spec, pairs, errors, warnings }, where pairs
 * are { from, to } (1-based) in written order with exact duplicates removed.
 */
export function parseMapSpec(text) {
  const spec = `${text ?? ''}`.trim();
  const errors = [];
  const warnings = [];
  const pairs = [];

  if (!spec) {
    errors.push('map is empty; expected pairs like 1:2, 3:4');
  } else if (spec.length > MAX_SPEC_LENGTH) {
    errors.push(`map is longer than ${MAX_SPEC_LENGTH} characters`);
  } else {
    const seen = new Set();
    spec.split(',').forEach((part, index) => {
      const token = part.trim();
      if (!token) {
        errors.push(`empty pair at position ${index + 1}`);
        return;
      }
      const match = /^(\d+)\s*:\s*(\d+)$/.exec(token);
      if (!match) {
        errors.push(`"${token}" is not a source:dest pair`);
        return;
      }
      const from = toInt(match[1]);
      const to = toInt(match[2]);
      if (from === 0 || to === 0) {
        errors.push(`"${token}": string 0 is not valid, strings start at 1 (omit a string to skip it)`);
        return;
      }
      if (from > MAX_STRING_NUMBER || to > MAX_STRING_NUMBER) {
        errors.push(`"${token}": string numbers go up to ${MAX_STRING_NUMBER}`);
        return;
      }
      const key = `${from}:${to}`;
      if (seen.has(key)) {
        warnings.push(`duplicate pair ${key} ignored`);
        return;
      }
      seen.add(key);
      pairs.push({ from, to });
    });
  }

  const ok = errors.length === 0;
  if (ok) {
    const sourcesByDest = new Map();
    pairs.forEach(({ from, to }) => {
      if (!sourcesByDest.has(to)) {
        sourcesByDest.set(to, []);
      }
      sourcesByDest.get(to).push(from);
    });
    sourcesByDest.forEach((sources, to) => {
      if (sources.length > 1) {
        warnings.push(`dest string ${to} receives from sources ${sources.join(', ')}; the later pair wins`);
      }
    });
  }

  return { ok, spec, pairs: ok ? pairs : [], errors, warnings };
}

/**
 * Parses the add-menu line:  "Foo > Bar" 1:2, 3:4
 * Returns { ok, id, spec, pairs, errors, warnings }.
 */
export function parseAddInput(line) {
  const match = /^\s*"([^"]*)"\s*([\s\S]*)$/.exec(`${line ?? ''}`);
  if (!match) {
    return {
      ok: false,
      id: '',
      spec: '',
      pairs: [],
      errors: ['expected "id" followed by pairs, for example "Foo > Bar" 1:2, 3:4'],
      warnings: []
    };
  }
  const idResult = normalizeMapId(match[1]);
  const specResult = parseMapSpec(match[2]);
  const errors = [...(idResult.error ? [idResult.error] : []), ...specResult.errors];
  const warnings = [...specResult.warnings];
  if (!idResult.error && idResult.changed) {
    warnings.push(`id stored as "${idResult.id}"`);
  }
  return {
    ok: errors.length === 0,
    id: idResult.id,
    spec: specResult.spec,
    pairs: specResult.pairs,
    errors,
    warnings
  };
}

export function invertPairs(pairs = []) {
  return pairs.map(({ from, to }) => ({ from: to, to: from }));
}

// ---------------------------------------------------------------------------
// the map list
// ---------------------------------------------------------------------------

/** Built-in maps first, then the Song's maps in the order they were added. */
export function listMidiPasteMaps(userMaps = []) {
  const builtins = Object.entries(BUILTIN_MIDI_PASTE_MAPS).map(([id, spec]) => ({ id, spec, builtin: true }));
  const user = (Array.isArray(userMaps) ? userMaps : [])
    .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.spec === 'string')
    .map(({ id, spec }) => ({ id, spec, builtin: false }));
  return [...builtins, ...user];
}

export function findMapIgnoringCase(maps = [], id = '') {
  const wanted = `${id}`.toLowerCase();
  return maps.find((map) => `${map.id}`.toLowerCase() === wanted) || null;
}

// ---------------------------------------------------------------------------
// choosing the map for a source/target pair
// ---------------------------------------------------------------------------

function stringCountOf(tuning) {
  const explicit = toInt(tuning?.nStrings);
  if (explicit !== null && explicit > 0) {
    return explicit;
  }
  return Array.isArray(tuning?.rowRange) ? tuning.rowRange.length : 0;
}

/**
 * Does `tuning` match the endpoint id of a pair-form map?
 *  - 'lineage': fromBaseID (or baseID) equals the id, or baseID equals the id exactly.
 *  - 'class':   the id names a known tuning (lookupTuning) with the same baseInstrument and
 *               string count as `tuning`, so "P48 > S6" also covers DropD or DADGAD.
 * Matching is case-sensitive.  Returns 'lineage', 'class' or null.
 */
export function matchEndpoint(tuning, endpointId, lookupTuning = () => null) {
  if (!tuning || !endpointId) {
    return null;
  }
  if (`${tuning.fromBaseID || tuning.baseID || ''}` === endpointId || `${tuning.baseID || ''}` === endpointId) {
    return 'lineage';
  }
  const reference = lookupTuning(endpointId);
  if (
    reference
    && reference.baseInstrument
    && reference.baseInstrument === tuning.baseInstrument
    && stringCountOf(reference) > 0
    && stringCountOf(reference) === stringCountOf(tuning)
  ) {
    return 'class';
  }
  return null;
}

/**
 * Picks the pairs to use for a paste, or null when the active map does not fit.
 *  - custom id (no >): applies to any pair of tunings, no reverse inference.
 *  - pair-form "A > B": forward when source~A and target~B.  Reverse when source~B and
 *    target~A: the stored "B > A" map when there is one, else the active pairs swapped.
 * Returns { id, pairs, route } with route 'custom' | 'forward' | 'reverse-stored' | 'reverse-inferred'.
 */
export function resolveMidiPasteMap({ maps = [], activeId = '', sourceTuning, targetTuning, lookupTuning = () => null } = {}) {
  if (!activeId) {
    return null;
  }
  const active = maps.find((map) => map.id === activeId);
  if (!active) {
    return null;
  }
  const activeParsed = parseMapSpec(active.spec);
  if (!activeParsed.ok) {
    return null;
  }
  const endpoints = splitMapId(active.id);
  if (!endpoints) {
    return { id: active.id, pairs: activeParsed.pairs, route: 'custom' };
  }

  const sourceIsA = matchEndpoint(sourceTuning, endpoints.source, lookupTuning);
  const targetIsB = matchEndpoint(targetTuning, endpoints.dest, lookupTuning);
  if (sourceIsA && targetIsB) {
    return { id: active.id, pairs: activeParsed.pairs, route: 'forward' };
  }

  const sourceIsB = matchEndpoint(sourceTuning, endpoints.dest, lookupTuning);
  const targetIsA = matchEndpoint(targetTuning, endpoints.source, lookupTuning);
  if (sourceIsB && targetIsA) {
    const stored = maps.find((map) => map.id === `${endpoints.dest} > ${endpoints.source}`);
    const storedParsed = stored ? parseMapSpec(stored.spec) : null;
    if (storedParsed?.ok) {
      return { id: stored.id, pairs: storedParsed.pairs, route: 'reverse-stored' };
    }
    return { id: active.id, pairs: invertPairs(activeParsed.pairs), route: 'reverse-inferred' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// applying a map
// ---------------------------------------------------------------------------

/**
 * Converts 1-based pairs to 0-based row pairs, dropping pairs that name a string the
 * instruments do not have.  Each row pair keeps its position (`order`) in the spec.
 * Returns { rowPairs, skipped } where skipped are the dropped { from, to } pairs.
 */
export function prepareStringPairs(pairs = [], sourceStringCount = 0, targetStringCount = 0) {
  const rowPairs = [];
  const skipped = [];
  pairs.forEach(({ from, to }, order) => {
    if (from > sourceStringCount || to > targetStringCount) {
      skipped.push({ from, to });
      return;
    }
    rowPairs.push({ from0: from - 1, to0: to - 1, order });
  });
  return { rowPairs, skipped };
}

/**
 * Maps notes through row pairs.  `placeNote(note, targetRow0)` returns the candidate
 * note on that row, or null when the pitch has no cell there.
 *
 * - A note whose source string has no pair is `unmapped`.
 * - A note that no pair could place (illegal pitch / unusable row) is `dropped`.
 * - One-to-many: one candidate per pair.
 * - Many-to-one: when candidates from different pairs land on the same cell, only the
 *   later pair's survive (`collisions` counts the removed ones).  Candidates from the same
 *   pair are untouched, so a straight map behaves exactly like a map-less paste.
 * Candidates keep clip order.
 */
export function applyStringMap({ notes = [], rowPairs = [], placeNote }) {
  const entries = [];
  let dropped = 0;
  let unmapped = 0;

  notes.forEach((note) => {
    const row = toInt(note?.row);
    if (row === null || row < 0) {
      dropped += 1;
      return;
    }
    const matching = rowPairs.filter((pair) => pair.from0 === row);
    if (matching.length === 0) {
      unmapped += 1;
      return;
    }
    let placed = false;
    matching.forEach((pair) => {
      const candidate = placeNote(note, pair.to0);
      if (candidate) {
        entries.push({ candidate, order: pair.order });
        placed = true;
      }
    });
    if (!placed) {
      dropped += 1;
    }
  });

  const ordersByCell = new Map();
  entries.forEach(({ candidate, order }) => {
    const key = `${candidate.styleNum}:${candidate.row}:${candidate.col}`;
    if (!ordersByCell.has(key)) {
      ordersByCell.set(key, new Set());
    }
    ordersByCell.get(key).add(order);
  });
  const winningOrder = new Map();
  ordersByCell.forEach((orders, key) => {
    winningOrder.set(key, Math.max(...orders));
  });

  let collisions = 0;
  const candidates = [];
  entries.forEach(({ candidate, order }) => {
    const key = `${candidate.styleNum}:${candidate.row}:${candidate.col}`;
    if (order < winningOrder.get(key)) {
      collisions += 1;
      return;
    }
    candidates.push(candidate);
  });

  return { candidates, dropped, unmapped, collisions };
}
