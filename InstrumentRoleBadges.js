/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

import * as Constants from './Constants.js';
import { isNotesourceID } from './fill/notesource-registry.js';

export const WIRING_MAIN = 'Main';
export const WIRING_LISTENER = 'Listener';
export const WIRING_LISTENER_NOTESOURCE = 'ListenerNotesource';
export const WIRING_OBSERVER = 'Observer';

const VALID_WIRINGS = new Set([WIRING_MAIN, WIRING_LISTENER, WIRING_LISTENER_NOTESOURCE, WIRING_OBSERVER]);
const UNKNOWN_FROM_BASE_ID = '(unknown)';

export function escapeHtml(text) {
	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function tableIDForBaseID(baseID) {
	const id = `${baseID || ''}`.trim();
	return id ? `${Constants.TABLE_ID_PREFIX}${id}` : '';
}

export function classifyInstrumentRole(tableID, wirings = []) {
	const wiring = Array.isArray(wirings)
		? wirings.find((entry) => entry?.tablename === tableID)
		: null;
	if (!wiring) {
		return WIRING_MAIN;
	}
	if (`${wiring.relativeSection || ''}`.trim()) {
		return WIRING_OBSERVER;
	}
	if (`${wiring.listenToTablename || ''}`.trim()) {
		return isNotesourceID(wiring.listenToTablename) ? WIRING_LISTENER_NOTESOURCE : WIRING_LISTENER;
	}
	return WIRING_MAIN;
}

export function normalizeInstrumentSummary(instrument, options = {}) {
	if (!instrument || typeof instrument !== 'object' || Array.isArray(instrument)) {
		return null;
	}
	const fromBaseID = `${instrument.fromBaseID || ''}`.trim();
	if (!fromBaseID && options.allowUnknown !== true) {
		return null;
	}
	const wiring = VALID_WIRINGS.has(instrument.wiring) ? instrument.wiring : WIRING_MAIN;
	return {
		fromBaseID: fromBaseID || UNKNOWN_FROM_BASE_ID,
		wiring,
		visible: instrument.visible !== false
	};
}

export function getInstrumentRoleClass(instrument) {
	if (instrument?.wiring === WIRING_LISTENER) {
		return 'instrumentListener';
	}
	if (instrument?.wiring === WIRING_LISTENER_NOTESOURCE) {
		return 'instrumentListenerNotesource';
	}
	if (instrument?.wiring === WIRING_OBSERVER) {
		return 'instrumentObserver';
	}
	return 'instrumentMain';
}

export function renderInstrumentBadge(instrument, options = {}) {
	const normalized = normalizeInstrumentSummary(instrument, options);
	if (!normalized) {
		return '';
	}
	const visibilityClass = normalized.visible === false ? ' instrumentNotVisible' : '';
	const classes = 'songLibraryInstrument ' + getInstrumentRoleClass(normalized) + visibilityClass;
	return "<span class='" + classes + "'>" + escapeHtml(normalized.fromBaseID) + '</span>';
}

export function renderInstrumentBadges(instruments = [], options = {}) {
	return instruments.map((instrument) => renderInstrumentBadge(instrument, options)).join('');
}

function getNoteTablesLayout(song = {}) {
	if (song && typeof song.getNoteTablesLayout === 'function') {
		return song.getNoteTablesLayout();
	}
	return Array.isArray(song?.noteTablesLayout) ? song.noteTablesLayout : [];
}

export function isSongTableVisible(song = {}, tableID = '') {
	if (!tableID) {
		return true;
	}
	if (song && typeof song.isTableVisible === 'function') {
		return song.isTableVisible(tableID);
	}
	const layoutEntry = getNoteTablesLayout(song).find((entry) => entry?.tableID === tableID);
	return layoutEntry ? layoutEntry.visible !== false : true;
}

export function getSongTuningsInLayoutOrder(song = {}) {
	const myTunings = Array.isArray(song?.myTunings) ? song.myTunings : [];
	const layout = getNoteTablesLayout(song);
	const byBaseID = new Map(myTunings.map((tuning) => [tuning?.baseID, tuning]));
	const ordered = [];
	const seen = new Set();

	layout.forEach((entry) => {
		const tableID = entry?.tableID;
		if (typeof tableID !== 'string' || !tableID.startsWith(Constants.TABLE_ID_PREFIX)) {
			return;
		}
		const baseID = tableID.substring(Constants.TABLE_ID_PREFIX.length);
		const tuning = byBaseID.get(baseID);
		if (!tuning || seen.has(baseID)) {
			return;
		}
		seen.add(baseID);
		ordered.push(tuning);
	});

	myTunings.forEach((tuning) => {
		if (!tuning || seen.has(tuning.baseID)) {
			return;
		}
		seen.add(tuning.baseID);
		ordered.push(tuning);
	});

	return ordered;
}

export function getInstrumentSummaryForTuning(song = {}, tuning = {}, options = {}) {
	const tableID = tableIDForBaseID(tuning?.baseID);
	return normalizeInstrumentSummary({
		fromBaseID: tuning?.fromBaseID,
		wiring: classifyInstrumentRole(tableID, song?.wirings),
		visible: isSongTableVisible(song, tableID)
	}, options);
}

export function getSongInstrumentSummaries(song = {}, options = {}) {
	return getSongTuningsInLayoutOrder(song)
		.map((tuning) => getInstrumentSummaryForTuning(song, tuning, options))
		.filter(Boolean);
}

export function renderSongInstrumentBadges(song = {}, options = {}) {
	return renderInstrumentBadges(getSongInstrumentSummaries(song, options), options);
}

export function renderSongInstrumentTable(song = {}, options = {}) {
	const tunings = getSongTuningsInLayoutOrder(song);
	const rows = tunings.map((tuning) => {
		const badge = renderInstrumentBadge(getInstrumentSummaryForTuning(song, tuning, options), options);
		return '<tr><td>' + badge + '</td><td>' + escapeHtml(tuning?.baseID || '') + '</td></tr>';
	}).join('');
	return '<table class="songInstrumentTable"><caption>Instruments in Song</caption><tr><th>Role</th><th>ID</th></tr>' + rows + '</table>';
}