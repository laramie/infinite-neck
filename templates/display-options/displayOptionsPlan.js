/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 4: the DisplayOptions plan engine.  Pure module (no DOM, no jQuery).
//
// Every write to the matrix is first PLANNED (a list of ops plus a list of skipped cells) and then
// APPLIED, so the caller can show a report and so one level of undo is trivial.
//
//   planSaveDiff  : write only the cells whose live control value differs from what the Section
//                   inherits (the 'baseline' resolve); a cell that already exists and now equals
//                   the baseline is deleted as redundant.  Skips read-blocked and write-blocked cells.
//   planSaveAll   : write every cell from the live controls.  Skips read-blocked and write-blocked.
//   planClear     : remove the Section's stored cells.  Skips ONLY explicitly write-blocked cells
//                   (Round 3 Q6: a read block does not stop Clear).
//   planClearCell : remove one cell.  Honors only the write block.
//   planStoreCell : write ONE cell from the live control (Matrix 'Store Cell' tool).  Skips read- and write-blocked.
//   planGate      : add/remove a column, row ('*') or cell gate.  Gates are never touched by the
//                   Save/Clear plans.
//   planCurrentToSongDefaults / planClearSongDefaults  (Sprint 148 it6): mirror the Current Section's STORED cells into the
//                   Song-DEFAULTS block (song.displayOptionsDefault) / empty that block.  Both are explicit author actions
//                   and OVERRIDE ALL GATES (nothing is skipped); gated keys are only named in the report.  Neither takes
//                   the Undo slot (plan.noUndo): Clear is the way back.
//
// An empty displayOptions block is deleted.  Undo is one level and runtime-only: it restores the
// displayOptions blocks and gates of every Section the last plan touched, and the Song gates.

import {
    DISPLAY_OPTION_KEYS, isDisplayOptionKey, valuesEqual, cloneValue, adapterGateFor, normalizeSongDisplayOptionsDefault
} from './displayOptionsMeta.js';
import { resolveDisplayOptions } from './displayOptionsResolver.js';
import {
    isReadBlocked, isWriteBlocked, isExplicitWriteBlocked, setGate, describeBlocks,
    normalizeSongGates, normalizeSectionGates, ROW_KEY, GATE_BOTH
} from './displayOptionsGates.js';

function blockOf(song, idx) {
    return song.sections[idx]?.displayOptions ?? null;
}

function hasCell(song, idx, key) {
    const block = blockOf(song, idx);
    return !!block && Object.prototype.hasOwnProperty.call(block, key);
}

function skipReason(song, idx, key) {
    const section = song.sections[idx];
    const flag = adapterGateFor(key);
    if (flag && !song[flag]) return `${flag} is off`;
    if (isWriteBlocked(song, section, key)) return 'write-blocked';
    if (isReadBlocked(song, section, key)) return 'read-blocked';
    return null;
}

function newPlan(kind, sectionIndex) {
    return { kind, sectionIndex, ops: [], skipped: [], unchanged: 0 };
}

/** Keys with a real live value.  An undefined/null control value (e.g. a Song with no currentColorDict yet)
 *  means "nothing to store": it would be dropped by JSON on save, leaving the model and the file disagreeing. */
function knownKeysOf(live) {
    return DISPLAY_OPTION_KEYS.filter((key) => live && live[key] !== undefined && live[key] !== null);
}

/** Keys whose live value already equals what the Section stores or inherits, i.e. SaveDiff has nothing to write for them.
 *  The caller uses this to drop its "controls changed" snapshot for those keys once the model has caught up with the controls. */
export function keysInSyncWithModel(song, idx, live, syncLive = null) {
    const baseline = resolveDisplayOptions(song, idx, { purpose: 'baseline', syncLive }).values;
    return knownKeysOf(live).filter((key) => {
        const has = hasCell(song, idx, key);
        const effective = has ? blockOf(song, idx)[key] : baseline[key];
        return (has || key in baseline) && valuesEqual(key, live[key], effective);
    });
}

export function planSaveDiff(song, idx, live, syncLive = null) {
    const plan = newPlan('saveDiff', idx);
    const baseline = resolveDisplayOptions(song, idx, { purpose: 'baseline', syncLive }).values;
    for (const key of knownKeysOf(live)) {
        const reason = skipReason(song, idx, key);
        if (reason) {
            plan.skipped.push({ key, reason });
            continue;
        }
        const has = hasCell(song, idx, key);
        const hasBaseline = key in baseline;
        const effective = has ? blockOf(song, idx)[key] : baseline[key];
        if ((has || hasBaseline) && valuesEqual(key, live[key], effective)) {
            plan.unchanged++;
        } else if (has && hasBaseline && valuesEqual(key, live[key], baseline[key])) {
            plan.ops.push({ type: 'deleteCell', sectionIndex: idx, key, note: 'redundant' });
        } else {
            plan.ops.push({ type: 'setCell', sectionIndex: idx, key, value: cloneValue(live[key]) });
        }
    }
    return plan;
}

export function planSaveAll(song, idx, live) {
    const plan = newPlan('saveAll', idx);
    for (const key of knownKeysOf(live)) {
        const reason = skipReason(song, idx, key);
        if (reason) {
            plan.skipped.push({ key, reason });
        } else if (hasCell(song, idx, key) && valuesEqual(key, live[key], blockOf(song, idx)[key])) {
            plan.unchanged++;
        } else {
            plan.ops.push({ type: 'setCell', sectionIndex: idx, key, value: cloneValue(live[key]) });
        }
    }
    return plan;
}

export function planClear(song, idx) {
    const plan = newPlan('clear', idx);
    const block = blockOf(song, idx);
    for (const key of block ? Object.keys(block) : []) {
        if (isExplicitWriteBlocked(song, song.sections[idx], key)) {
            plan.skipped.push({ key, reason: 'write-blocked' });
        } else {
            plan.ops.push({ type: 'deleteCell', sectionIndex: idx, key });
        }
    }
    return plan;
}

export function planClearCell(song, idx, key) {
    const plan = newPlan('clearCell', idx);
    if (!isDisplayOptionKey(key)) {
        throw new Error(`unknown DisplayOptions key: ${key}`);
    }
    if (!hasCell(song, idx, key)) {
        plan.unchanged++;
    } else if (isExplicitWriteBlocked(song, song.sections[idx], key)) {
        plan.skipped.push({ key, reason: 'write-blocked' });
    } else {
        plan.ops.push({ type: 'deleteCell', sectionIndex: idx, key });
    }
    return plan;
}

/** Sprint 148 it5: write one cell from the live controls (the Matrix 'Store Cell' tool). */
export function planStoreCell(song, idx, key, live) {
    const plan = newPlan('storeCell', idx);
    if (!isDisplayOptionKey(key)) {
        throw new Error(`unknown DisplayOptions key: ${key}`);
    }
    if (!song.sections[idx]) {
        throw new Error(`no Section at index ${idx}`);
    }
    const reason = skipReason(song, idx, key);
    if (live?.[key] === undefined || live?.[key] === null) {
        plan.skipped.push({ key, reason: 'no live value' });
    } else if (reason) {
        plan.skipped.push({ key, reason });
    } else if (hasCell(song, idx, key) && valuesEqual(key, live[key], blockOf(song, idx)[key])) {
        plan.unchanged++;
    } else {
        plan.ops.push({ type: 'setCell', sectionIndex: idx, key, value: cloneValue(live[key]) });
    }
    return plan;
}

/** scope: 'column' (Song gate for `key`) | 'row' (Section '*') | 'cell' (Section gate for `key`) */
export function planGate(song, { scope, sectionIndex = null, key = null, direction = GATE_BOTH, on = true }) {
    const plan = newPlan('gate', sectionIndex);
    if (scope === 'column') {
        if (!isDisplayOptionKey(key)) throw new Error(`unknown DisplayOptions key: ${key}`);
    } else if (scope === 'row' || scope === 'cell') {
        if (!song.sections[sectionIndex]) throw new Error(`no Section at index ${sectionIndex}`);
        if (scope === 'cell' && !isDisplayOptionKey(key)) throw new Error(`unknown DisplayOptions key: ${key}`);
    } else {
        throw new Error(`unknown gate scope: ${scope}`);
    }
    plan.ops.push({
        type: 'setGate', scope, sectionIndex, key: scope === 'row' ? ROW_KEY : key, direction, on: !!on
    });
    return plan;
}

//=========================== Song-DEFAULTS (Sprint 148 it6) ==========================

/** 'noteFont (cell r, column w)' for a key that has any gate; '' when it has none. */
function gateLabel(song, section, key) {
    const blocks = describeBlocks(song, section, key);
    const marks = ['adapter', 'column', 'row', 'cell']
        .filter((source) => blocks[source])
        .map((source) => `${source} ${blocks[source]}`);
    return marks.length ? `${key} (${marks.join(', ')})` : '';
}

/** The Current Section's STORED cells (never the live controls) mirrored into Song-DEFAULTS: keys that differ are written,
 *  block keys the Section does not store are removed.  Gates are ignored; gated keys are listed in plan.gated for the report. */
export function planCurrentToSongDefaults(song, idx) {
    const plan = newPlan('currentToSongDefaults', idx);
    plan.noUndo = true;
    plan.gated = [];
    const section = song.sections[idx];
    if (!section) {
        throw new Error(`no Section at index ${idx}`);
    }
    const source = normalizeSongDisplayOptionsDefault(section.displayOptions);
    if (!source) {
        plan.note = `Section ${idx + 1} stores nothing; Song-DEFAULTS unchanged`;
        return plan;
    }
    const block = normalizeSongDisplayOptionsDefault(song.displayOptionsDefault) ?? {};
    for (const key of DISPLAY_OPTION_KEYS) {
        const inSource = key in source;
        const inBlock = key in block;
        if (inSource && inBlock && valuesEqual(key, source[key], block[key])) {
            plan.unchanged++;
        } else if (inSource) {
            plan.ops.push({ type: 'setSongDefault', key, value: cloneValue(source[key]) });
            plan.gated.push(gateLabel(song, section, key));
        } else if (inBlock) {
            plan.ops.push({ type: 'deleteSongDefault', key });
            plan.gated.push(gateLabel(song, null, key));
        }
    }
    plan.gated = plan.gated.filter(Boolean);
    return plan;
}

/** Empties the Song-DEFAULTS block, gated keys included. */
export function planClearSongDefaults(song) {
    const plan = newPlan('clearSongDefaults', null);
    plan.noUndo = true;
    const block = normalizeSongDisplayOptionsDefault(song.displayOptionsDefault);
    if (!block) {
        plan.note = 'Song-DEFAULTS is already empty; nothing to clear';
        plan.gated = [];
        return plan;
    }
    plan.gated = [];
    for (const key of Object.keys(block)) {
        plan.ops.push({ type: 'deleteSongDefault', key });
        plan.gated.push(gateLabel(song, null, key));
    }
    plan.gated = plan.gated.filter(Boolean);
    return plan;
}

//=========================== apply + undo ============================================

let lastUndo = null;

function snapshot(song, plan) {
    const touched = new Set();
    for (const op of plan.ops) {
        if (op.sectionIndex != null && song.sections[op.sectionIndex]) {
            touched.add(song.sections[op.sectionIndex]);
        }
    }
    return {
        song,
        songGates: cloneValue(song.displayOptionGates),
        sections: [...touched].map((section) => ({
            section,
            displayOptions: cloneValue(section.displayOptions),
            gates: cloneValue(section.displayOptionGates)
        }))
    };
}

function assignOrDelete(target, field, value) {
    if (value === undefined) {
        delete target[field];
    } else {
        target[field] = value;
    }
}

function describeOps(plan) {
    const parts = [];
    const written = plan.ops.filter((o) => o.type === 'setCell').map((o) => o.key);
    const deleted = plan.ops.filter((o) => o.type === 'deleteCell').map((o) => o.key);
    const gates = plan.ops.filter((o) => o.type === 'setGate');
    const songWritten = plan.ops.filter((o) => o.type === 'setSongDefault').map((o) => o.key);
    const songDeleted = plan.ops.filter((o) => o.type === 'deleteSongDefault').map((o) => o.key);
    if (written.length) parts.push(`wrote ${written.join(', ')}`);
    if (deleted.length) parts.push(`removed ${deleted.join(', ')}`);
    if (songWritten.length) parts.push(`Song-DEFAULTS wrote ${songWritten.join(', ')}`);
    if (songDeleted.length) parts.push(`Song-DEFAULTS removed ${songDeleted.join(', ')}`);
    for (const g of gates) {
        const where = g.scope === 'column' ? `column ${g.key}`
            : g.scope === 'row' ? `Section ${g.sectionIndex + 1}`
                : `Section ${g.sectionIndex + 1} cell ${g.key}`;
        parts.push(`${g.on ? 'added' : 'removed'} ${g.direction} gate on ${where}`);
    }
    if (plan.skipped.length) {
        parts.push(`skipped ${plan.skipped.map((s) => `${s.key} (${s.reason})`).join(', ')}`);
    }
    if (!plan.ops.length) {
        parts.unshift(`nothing to change (${plan.unchanged} cell(s) already match)`);
    }
    if (plan.gated?.length) {
        parts.push(`gated (overridden): ${plan.gated.join(', ')}`);
    }
    if (!plan.ops.length && plan.note) {
        parts.splice(0, parts.length, plan.note);
    }
    const where = plan.sectionIndex != null && plan.kind !== 'gate' ? `Section ${plan.sectionIndex + 1}: ` : '';
    return `${where}${plan.kind}: ${parts.join('; ')}`;
}

/** Applies a plan.  @returns {{changed:boolean, report:string}} */
export function applyPlan(song, plan) {
    const report = describeOps(plan);
    if (!plan.ops.length) {
        return { changed: false, report };
    }
    // noUndo plans (the Song-DEFAULTS buttons) leave the one Undo slot alone
    if (!plan.noUndo) {
        lastUndo = snapshot(song, plan);
    }
    for (const op of plan.ops) {
        if (op.type === 'setSongDefault' || op.type === 'deleteSongDefault') {
            const block = { ...(song.displayOptionsDefault ?? {}) };
            if (op.type === 'setSongDefault') {
                block[op.key] = cloneValue(op.value);
            } else {
                delete block[op.key];
            }
            // normalizing keeps column order and drops an empty block (missing == empty)
            assignOrDelete(song, 'displayOptionsDefault', normalizeSongDisplayOptionsDefault(block));
            continue;
        }
        if (op.type === 'setGate') {
            if (op.scope === 'column') {
                const next = setGate(song.displayOptionGates, op.key, op.direction, op.on, { allowRow: false });
                assignOrDelete(song, 'displayOptionGates', next);
            } else {
                const section = song.sections[op.sectionIndex];
                const next = setGate(section.displayOptionGates, op.key, op.direction, op.on, { allowRow: true });
                assignOrDelete(section, 'displayOptionGates', next);
            }
            continue;
        }
        const section = song.sections[op.sectionIndex];
        if (op.type === 'setCell') {
            section.displayOptions = section.displayOptions || {};
            section.displayOptions[op.key] = cloneValue(op.value);
        } else if (op.type === 'deleteCell' && section.displayOptions) {
            delete section.displayOptions[op.key];
        }
        if (section.displayOptions && Object.keys(section.displayOptions).length === 0) {
            delete section.displayOptions;
        }
    }
    return { changed: true, report };
}

export function canUndoDisplayOptionsOp(song) {
    return !!lastUndo && lastUndo.song === song;
}

/** @returns {{changed:boolean, report:string}} */
export function undoLastDisplayOptionsOp(song) {
    if (!canUndoDisplayOptionsOp(song)) {
        return { changed: false, report: 'nothing to undo' };
    }
    const undo = lastUndo;
    lastUndo = null;
    assignOrDelete(song, 'displayOptionGates', normalizeSongGates(undo.songGates));
    let restored = 0;
    for (const entry of undo.sections) {
        if (!song.sections.includes(entry.section)) continue;
        assignOrDelete(entry.section, 'displayOptions', entry.displayOptions);
        assignOrDelete(entry.section, 'displayOptionGates', normalizeSectionGates(entry.gates));
        restored++;
    }
    return { changed: true, report: `undo: restored ${restored} Section(s) and the Song gates` };
}

export function resetUndoForTests() {
    lastUndo = null;
}
