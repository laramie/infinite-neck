/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

import * as Constants from './Constants.js';

const SHARP = "&#9839;";
const FLAT = "&#9837;";
const NATURAL = "&nbsp;";

const DEFAULT_MAX_ENTRIES = 24;

const cache = new Map();
let maxEntries = DEFAULT_MAX_ENTRIES;

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

function getCellMidiNumsByNoteClass(tuning = {}) {
	const result = new Map();
	const rowRange = Array.isArray(tuning.rowRange) ? tuning.rowRange : [];
	const frets = Number.parseInt(tuning.frets, 10);
	const normalizedFrets = Number.isFinite(frets) ? frets : 0;
	const nCols = tuning.nut ? normalizedFrets + 1 : normalizedFrets;

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

export function createEntry({ key, tableID = '', sectionIndex = null, options = {}, tuning = {}, buildCellHtml } = {}) {
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

	return {
		key,
		tableID,
		sectionIndex,
		noteClassHtmlByNoteName,
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
	}
	return entry;
}

export function set(key, entry) {
	if (!key || !entry) {
		return null;
	}
	cache.set(key, entry);
	evictIfNeeded();
	return entry;
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
}
