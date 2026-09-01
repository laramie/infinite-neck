/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

import * as Constants from './Constants.js';
import { getDisplayedCellcol } from './table-column-helpers.js';

const SHARP = "&#9839;";
const FLAT = "&#9837;";
const NATURAL = "&nbsp;";

const DEFAULT_MAX_ENTRIES = 24;

const cache = new Map();
let maxEntries = DEFAULT_MAX_ENTRIES;
let totalHits = 0;
let totalMisses = 0;
let totalSets = 0;
let totalEvictions = 0;

// Tracks the renderCacheKey last actually painted into the live DOM for each tableID,
// separate from the HTML-string cache above. Since buildRenderKey() already covers every
// input that affects a table's rendered content/size, two buildCellsForTable() calls with
// the same key for the same tableID are guaranteed to produce identical DOM output -- so
// the second (and any subsequent) call can skip the per-cell rebuild entirely.
// See 903-implementation-plan-ph3-1.md Step A.
const lastPaintedKeyByTableID = new Map();

const SHARP_NOTE_CLASS_SPECS = Object.freeze([
	{ noteClass: 'noteAb', noteLetter: 'G', sharpflat: SHARP, noteNum: 11 },
	{ noteClass: 'noteBb', noteLetter: 'A', sharpflat: SHARP, noteNum: 1 },
	{ noteClass: 'noteDb', noteLetter: 'C', sharpflat: SHARP, noteNum: 4 },
	{ noteClass: 'noteEb', noteLetter: 'D', sharpflat: SHARP, noteNum: 6 },
	{ noteClass: 'noteGb', noteLetter: 'F', sharpflat: SHARP, noteNum: 9 }
]);

const FLAT_NOTE_CLASS_SPECS = Object.freeze([
	{ noteClass: 'noteAb', noteLetter: 'A', sharpflat: FLAT, noteNum: 11 },
	{ noteClass: 'noteBb', noteLetter: 'B', sharpflat: FLAT, noteNum: 1 },
	{ noteClass: 'noteDb', noteLetter: 'D', sharpflat: FLAT, noteNum: 4 },
	{ noteClass: 'noteEb', noteLetter: 'E', sharpflat: FLAT, noteNum: 6 },
	{ noteClass: 'noteGb', noteLetter: 'G', sharpflat: FLAT, noteNum: 9 }
]);

const NATURAL_NOTE_CLASS_SPECS = Object.freeze([
	{ noteClass: 'noteA', noteLetter: 'A', sharpflat: NATURAL, noteNum: 0 },
	{ noteClass: 'noteB', noteLetter: 'B', sharpflat: NATURAL, noteNum: 2 },
	{ noteClass: 'noteC', noteLetter: 'C', sharpflat: NATURAL, noteNum: 3 },
	{ noteClass: 'noteD', noteLetter: 'D', sharpflat: NATURAL, noteNum: 5 },
	{ noteClass: 'noteE', noteLetter: 'E', sharpflat: NATURAL, noteNum: 7 },
	{ noteClass: 'noteF', noteLetter: 'F', sharpflat: NATURAL, noteNum: 8 },
	{ noteClass: 'noteG', noteLetter: 'G', sharpflat: NATURAL, noteNum: 10 }
]);

export function getNoteClassSpecs(sharps) {
	return [
		...(sharps ? SHARP_NOTE_CLASS_SPECS : FLAT_NOTE_CLASS_SPECS),
		...NATURAL_NOTE_CLASS_SPECS
	];
}

function stableNormalize(value) {
	if (Array.isArray(value)) {
		return value.map(stableNormalize);
	}
	if (value && typeof value === 'object') {
		return Object.keys(value)
			.sort()
			.reduce((result, key) => {
				result[key] = stableNormalize(value[key]);
				return result;
			}, {});
	}
	return value;
}

function stableStringify(value) {
	return JSON.stringify(stableNormalize(value));
}

function normalizeString(value, fallback = '') {
	if (value === undefined || value === null) {
		return fallback;
	}
	return String(value);
}

function normalizeBoolean(value) {
	return !!value;
}

export function buildTuningFingerprint(tuning = {}) {
	return stableStringify({
		banjoNut: tuning?.banjoNut || null,
		baseID: tuning?.baseID || '',
		doSpecialRows: !!tuning?.doSpecialRows,
		fixedFretWidthMult: tuning?.fixedFretWidthMult ?? null,
		frets: tuning?.frets ?? null,
		nut: !!tuning?.nut,
		pianoNamesRow: !!tuning?.pianoNamesRow,
		reverse: !!tuning?.reverse,
		rowRange: Array.isArray(tuning?.rowRange) ? tuning.rowRange.map(Number) : [],
		specialBackgroundIDRows: Array.isArray(tuning?.specialBackgroundIDRows) ? tuning.specialBackgroundIDRows.map(Number) : []
	});
}

export function buildRenderKey({ tableID = '', options = {}, tuning = {}, noteNamesFuncArr = [] } = {}) {
	return stableStringify({
		version: 1,
		tableID: normalizeString(tableID),
		sharps: normalizeBoolean(options.sharps),
		rootID: normalizeString(options.rootID, '0'),
		rootIDLead: normalizeString(options.rootIDLead, '-1'),
		noteNamesFuncArr: Array.isArray(noteNamesFuncArr) ? noteNamesFuncArr.map(String) : [],
		showCellNotes: normalizeBoolean(options.showCellNotes),
		showSubscriptFunctions: normalizeBoolean(options.showSubscriptFunctions),
		cellIsFunction: normalizeBoolean(options.cellIsFunction),
		showMidiNum: normalizeBoolean(options.showMidiNum),
		useCenterForRightFunction: normalizeBoolean(options.useCenterForRightFunction),
		noteDisplayWidth: normalizeString(options.NoteDisplaySizes?.width),
		noteDisplayHeight: normalizeString(options.NoteDisplaySizes?.height),
		naturalFretWidths: normalizeBoolean(options.naturalFretWidths),
		naturalFontScaling: normalizeString(options.naturalFontScaling),
		pianoHeightScaleFactor: normalizeString(options.pianoHeightScaleFactor),
		pianoWidthScaleFactor: normalizeString(options.pianoWidthScaleFactor),
		pianoWhiteToBlackWidthRatio: normalizeString(options.pianoWhiteToBlackWidthRatio),
		tuningFingerprint: buildTuningFingerprint(tuning)
	});
}

function getColumnCount(tuning = {}) {
	const frets = Number.parseInt(tuning.frets, 10);
	const normalizedFrets = Number.isFinite(frets) ? frets : 0;
	return tuning.nut ? normalizedFrets + 1 : normalizedFrets;
}

function getCellMidiNumsByNoteClass(tuning = {}) {
	const result = new Map();
	const rowRange = Array.isArray(tuning.rowRange) ? tuning.rowRange : [];
	const frets = Number.parseInt(tuning.frets, 10);
	const normalizedFrets = Number.isFinite(frets) ? frets : 0;
	const nCols = getColumnCount(tuning);

	rowRange.forEach((rowMidi) => {
		for (let c = 0; c < nCols; c += 1) {
			const midinum = tuning.reverse
				? Number(rowMidi) + normalizedFrets - c
				: Number(rowMidi) + c;
			if (!Number.isFinite(midinum)) {
				continue;
			}
			const noteClass = 'note' + Constants.midinumToNoteName(midinum);
			if (!result.has(noteClass)) {
				result.set(noteClass, new Set());
			}
			result.get(noteClass).add(String(midinum));
		}
	});

	return result;
}

export function createEntry({ key, tableID = '', sectionIndex = null, options = {}, tuning = {}, buildCellHtml, buildSizing } = {}) {
	if (!key || typeof buildCellHtml !== 'function') {
		return null;
	}

	const noteClassHtmlByNoteName = {};
	const midiNumsByNoteClass = getCellMidiNumsByNoteClass(tuning);
	const showMidiNum = !!options.showMidiNum;

	getNoteClassSpecs(options.sharps).forEach((spec) => {
		if (showMidiNum) {
			const midiNums = midiNumsByNoteClass.get(spec.noteClass) || new Set();
			noteClassHtmlByNoteName[spec.noteClass] = {};
			midiNums.forEach((midinum) => {
				noteClassHtmlByNoteName[spec.noteClass][midinum] = buildCellHtml({ ...spec, midinum, options });
			});
			return;
		}
		noteClassHtmlByNoteName[spec.noteClass] = {
			__default: buildCellHtml({ ...spec, midinum: undefined, options })
		};
	});

	// Step D1 (903-implementation-plan-step-D.md): cell SIZING (fontMultiplier, td/NoteDisplay
	// width/height) depends only on (cellcol, isNut, options, tuning) -- never on note content --
	// so it's cached here per-column (a ~2 x nCols state space) alongside the per-note-class HTML
	// above, letting buildCellsFromSelector() skip the per-cell sizing recomputation it used to do
	// on every rebuild, cache hit or miss. Iterates displayed column positions (via
	// getDisplayedCellcol()) rather than raw loop indices, so this matches the actual `cellcol`
	// attribute values TableBuilder.js bakes into each <td>, including for reverse tunings.
	const sizingByColumn = {};
	if (typeof buildSizing === 'function') {
		const nCols = getColumnCount(tuning);
		for (let c = 0; c < nCols; c += 1) {
			const cellcol = getDisplayedCellcol(tuning, c);
			if (cellcol === null || cellcol === undefined) {
				continue;
			}
			sizingByColumn[`${cellcol}:0`] = buildSizing({ cellcol, isNut: false, options, tuning });
			sizingByColumn[`${cellcol}:1`] = buildSizing({ cellcol, isNut: true, options, tuning });
		}
	}

	return {
		key,
		tableID,
		sectionIndex,
		noteClassHtmlByNoteName,
		sizingByColumn,
		// Step D2/Flyweight (903-phase-5-flyweight-content-cache-plan.md): lazily-populated cache of
		// detached master content Nodes, keyed the same way as getHtml()'s string lookup. Populated on
		// first real use via getOrBuildContentNode(), not precomputed eagerly here, since the actual
		// distinct-content count observed in practice is much smaller than the theoretical max.
		contentNodeByKey: {},
		createdAt: Date.now(),
		hitCount: 0
	};
}

export function getHtml(entry, noteClass, midinum) {
	if (!entry || !noteClass) {
		return undefined;
	}
	const byMidi = entry.noteClassHtmlByNoteName?.[noteClass];
	if (!byMidi) {
		return undefined;
	}
	return byMidi[String(midinum)] ?? byMidi.__default;
}

export function getSizing(entry, cellcol, isNut) {
	if (!entry || cellcol === undefined || cellcol === null || cellcol === '') {
		return undefined;
	}
	return entry.sizingByColumn?.[`${cellcol}:${isNut ? 1 : 0}`];
}

/** Flyweight content-node cache (903-phase-5-flyweight-content-cache-plan.md, Option A): returns a
 *  detached master Node built from the same cached HTML string getHtml() would return, parsing it
 *  (via the caller-supplied buildNode callback, kept DOM-agnostic here) only once per distinct
 *  (noteClass, midinum) key, then returning that same cached master on every subsequent call for
 *  the same key. Callers MUST clone the returned node before inserting it -- this function always
 *  returns the shared master, never a fresh instance. Returns undefined whenever getHtml() would
 *  (missing entry/noteClass/cached string), so callers can fall back to their existing string-based
 *  path unchanged. */
export function getOrBuildContentNode(entry, noteClass, midinum, buildNode) {
	if (!entry || !noteClass || typeof buildNode !== 'function') {
		return undefined;
	}
	const html = getHtml(entry, noteClass, midinum);
	if (!html) {
		return undefined;
	}
	entry.contentNodeByKey = entry.contentNodeByKey || {};
	const cacheKey = `${noteClass}:${midinum ?? ''}`;
	let master = entry.contentNodeByKey[cacheKey];
	if (!master) {
		master = buildNode(html);
		entry.contentNodeByKey[cacheKey] = master;
	}
	return master;
}

function evictIfNeeded() {
	while (cache.size > maxEntries) {
		let oldestKey = null;
		let oldestCreatedAt = Number.POSITIVE_INFINITY;
		for (const [key, entry] of cache.entries()) {
			if ((entry?.createdAt ?? 0) < oldestCreatedAt) {
				oldestCreatedAt = entry.createdAt ?? 0;
				oldestKey = key;
			}
		}
		if (!oldestKey) {
			return;
		}
		cache.delete(oldestKey);
		totalEvictions += 1;
	}
}

export function setMaxEntries(nextMaxEntries = DEFAULT_MAX_ENTRIES) {
	const parsed = Number.parseInt(nextMaxEntries, 10);
	maxEntries = Math.max(1, Number.isFinite(parsed) ? parsed : DEFAULT_MAX_ENTRIES);
	evictIfNeeded();
}

export function get(key) {
	const entry = cache.get(key);
	if (entry) {
		entry.hitCount = (entry.hitCount || 0) + 1;
		totalHits += 1;
	} else {
		totalMisses += 1;
	}
	return entry;
}

export function set(key, entry) {
	if (!key || !entry) {
		return null;
	}
	cache.set(key, entry);
	totalSets += 1;
	evictIfNeeded();
	return entry;
}

/** Snapshot of cache health for console/DevTools instrumentation.
 *  See 903-timing-revisited-plan-1.md section 4. */
export function stats() {
	return {
		size: cache.size,
		maxEntries,
		hits: totalHits,
		misses: totalMisses,
		sets: totalSets,
		evictions: totalEvictions
	};
}

export function has(key) {
	return cache.has(key);
}

export function clear() {
	cache.clear();
}

export function size() {
	return cache.size;
}

export function wasLastPainted(tableID, key) {
	return !!tableID && !!key && lastPaintedKeyByTableID.get(tableID) === key;
}

export function recordPainted(tableID, key) {
	if (tableID && key) {
		lastPaintedKeyByTableID.set(tableID, key);
	}
}

export function clearPaintedTracking(tableID) {
	if (tableID) {
		lastPaintedKeyByTableID.delete(tableID);
	} else {
		lastPaintedKeyByTableID.clear();
	}
}

export function getNextSectionIndexForPrewarm(song) {
	if (!song || song.randomLoop) {
		return -1;
	}
	const sections = typeof song.getSections === 'function' ? song.getSections() : song.sections;
	if (!Array.isArray(sections) || sections.length === 0) {
		return -1;
	}
	const currentIndex = typeof song.getSectionsCurrentIndex === 'function'
		? song.getSectionsCurrentIndex()
		: Number.parseInt(song.gSectionsCurrentIndex, 10) || 0;
	return (currentIndex + 1) % sections.length;
}

export function __resetForTests() {
	cache.clear();
	maxEntries = DEFAULT_MAX_ENTRIES;
	totalHits = 0;
	totalMisses = 0;
	totalSets = 0;
	totalEvictions = 0;
	lastPaintedKeyByTableID.clear();
}
