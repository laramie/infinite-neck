/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 4: gates for the DisplayOptions matrix.  Pure module (no DOM, no jQuery).
//
// A gate is a deny-only list.  Absence of a gate means "open".
//
//   song.displayOptionGates    = { readBlocked: [key, ...], writeBlocked: [key, ...] }   -- column gates
//   section.displayOptionGates = { readBlocked: [key|'*', ...], writeBlocked: [key|'*', ...] }
//        '*'  = the whole Section (row gate)       key = one cell of that Section (cell gate)
//
// read-blocked : the cell is ignored when applying (cascade, navigation, render).
// write-blocked: the cell is never written or removed by SaveDiff / SaveAll / Clear.
//
// Adapter gates are derived, not stored: NoteDisplaySizes is blocked while song.presentationMode is
// off, sectionTheme while song.allowThemeAutomation is off.  They count as blocks for both reading
// and writing, except that Clear (bulk) honors only explicit write gates.

import { DISPLAY_OPTION_META, isDisplayOptionKey, adapterGateFor } from './displayOptionsMeta.js';

export const ROW_KEY = '*';
export const GATE_READ = 'read';
export const GATE_WRITE = 'write';
export const GATE_BOTH = 'both';

const LIST_NAME = { read: 'readBlocked', write: 'writeBlocked' };

function sortKeys(keys) {
    return [...keys].sort((a, b) => {
        if (a === ROW_KEY) return -1;
        if (b === ROW_KEY) return 1;
        return DISPLAY_OPTION_META[a].order - DISPLAY_OPTION_META[b].order;
    });
}

function normalizeList(list, allowRow) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    for (const key of list) {
        if (key === ROW_KEY ? allowRow : (typeof key === 'string' && isDisplayOptionKey(key))) {
            seen.add(key);
        }
    }
    return sortKeys(seen);
}

/** Returns a clean gates object, or undefined when there is nothing to keep (unknown keys,
 *  duplicates and empty lists are dropped). */
export function normalizeGates(raw, { allowRow = false } = {}) {
    if (!raw || typeof raw !== 'object') return undefined;
    const readBlocked = normalizeList(raw.readBlocked, allowRow);
    const writeBlocked = normalizeList(raw.writeBlocked, allowRow);
    if (!readBlocked.length && !writeBlocked.length) return undefined;
    const out = {};
    if (readBlocked.length) out.readBlocked = readBlocked;
    if (writeBlocked.length) out.writeBlocked = writeBlocked;
    return out;
}

export function normalizeSongGates(raw) {
    return normalizeGates(raw, { allowRow: false });
}

export function normalizeSectionGates(raw) {
    return normalizeGates(raw, { allowRow: true });
}

/** Command-line helper: "3,noteFont,read-blocked" -> ['3','noteFont','read-blocked'] (trimmed; missing parts are ''). */
export function splitMatrixArgs(text) {
    const parts = `${text ?? ''}`.split(',').map((part) => part.trim());
    while (parts.length < 3) {
        parts.push('');
    }
    return parts;
}

export function parseGateDirection(text) {
    const t = String(text ?? '').trim().toLowerCase();
    if (t === '' || t === 'blocked' || t === 'both' || t === 'rw') return GATE_BOTH;
    if (t === 'read-blocked' || t === 'read' || t === 'r') return GATE_READ;
    if (t === 'write-blocked' || t === 'write' || t === 'w') return GATE_WRITE;
    return null;
}

/** Pure setter: returns a new normalized gates object (or undefined when it becomes empty).
 *  direction: 'read' | 'write' | 'both'.  on=false removes the entry. */
export function setGate(gates, key, direction, on, { allowRow = false } = {}) {
    if (key !== ROW_KEY && !isDisplayOptionKey(key)) {
        throw new Error(`unknown DisplayOptions key: ${key}`);
    }
    if (key === ROW_KEY && !allowRow) {
        throw new Error("'*' is only valid in a Section gate");
    }
    const sides = direction === GATE_BOTH ? ['read', 'write'] : [direction];
    const next = {
        readBlocked: [...(gates?.readBlocked ?? [])],
        writeBlocked: [...(gates?.writeBlocked ?? [])]
    };
    for (const side of sides) {
        const name = LIST_NAME[side];
        if (!name) throw new Error(`unknown gate direction: ${direction}`);
        const without = next[name].filter((k) => k !== key);
        next[name] = on ? [...without, key] : without;
    }
    return normalizeGates(next, { allowRow });
}

function listHas(gates, side, key) {
    const list = gates?.[LIST_NAME[side]];
    return Array.isArray(list) && list.includes(key);
}

function adapterBlocked(song, key) {
    const flag = adapterGateFor(key);
    return !!flag && !song?.[flag];
}

/** Column (Song) gate only, adapter excluded. */
export function isColumnBlocked(song, key, side) {
    return listHas(song?.displayOptionGates, side, key);
}

export function isRowBlocked(section, side) {
    return listHas(section?.displayOptionGates, side, ROW_KEY);
}

export function isCellBlocked(section, key, side) {
    return listHas(section?.displayOptionGates, side, key);
}

/** column OR row OR cell OR adapter. */
export function isReadBlocked(song, section, key) {
    return adapterBlocked(song, key)
        || isColumnBlocked(song, key, 'read')
        || isRowBlocked(section, 'read')
        || isCellBlocked(section, key, 'read');
}

export function isWriteBlocked(song, section, key) {
    return adapterBlocked(song, key)
        || isExplicitWriteBlocked(song, section, key);
}

/** As isWriteBlocked(), without the derived adapter gates (what bulk Clear honors). */
export function isExplicitWriteBlocked(song, section, key) {
    return isColumnBlocked(song, key, 'write')
        || isRowBlocked(section, 'write')
        || isCellBlocked(section, key, 'write');
}

/** For /vdd: which gates affect a cell.  Each field is '' | 'r' | 'w' | 'rw'. */
export function describeBlocks(song, section, key) {
    const mark = (r, w) => (r ? 'r' : '') + (w ? 'w' : '');
    return {
        adapter: adapterBlocked(song, key) ? 'rw' : '',
        column: mark(isColumnBlocked(song, key, 'read'), isColumnBlocked(song, key, 'write')),
        row: mark(isRowBlocked(section, 'read'), isRowBlocked(section, 'write')),
        cell: mark(isCellBlocked(section, key, 'read'), isCellBlocked(section, key, 'write'))
    };
}
