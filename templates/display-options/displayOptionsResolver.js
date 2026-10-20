/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 4: the DisplayOptions resolver.  Pure module (no DOM, no jQuery).
//
// Given a Song-like object ({ sections, displayOptionGates, presentationMode, allowThemeAutomation })
// and a Section index, work out the value of every DisplayOptions key, per key, with provenance.
// A Section's stored `displayOptions` block is SPARSE: it holds only the cells that Section changed.
//
// Cascade rule: the value of a key at Section k is the last READABLE stored cell at a Section <= k.
// A read-blocked cell contributes nothing (R1), as if it were absent; a key whose column, row or adapter
// is read-blocked AT the target Section is not applied at all, so its control keeps its value (R2).
//
// Absent cells (no stored cell at or before k) -- see ABSENT_CELL_POLICY:
//   'leave'              : omit the key; the control is left alone
//   'default'            : keys that have a default get it
//   'defaultIfAutomated' : keys that have a default get it only if some Section stores that key
//                          readably (the Song "automates" it); other keys are left alone  [chosen]
//
// Purposes:
//   'apply'    : what navigation pushes into the controls (sparse; may omit keys)
//   'render'   : 'apply' completed from `live` (the controls), for drawing a Section's table
//   'baseline' : what the Section at `idx` INHERITS: cascade over Sections < idx, then the
//                defaults, then `syncLive` (controls as of the last Section sync) for keys that
//                have no default.  SaveDiff diffs the live controls against it.

import {
    DISPLAY_OPTIONS_DEFAULTS, DISPLAY_OPTION_KEYS, DISPLAY_OPTION_META, isDisplayOptionKey, cloneValue
} from './displayOptionsMeta.js';
import { isReadBlocked, isRegionReadBlocked } from './displayOptionsGates.js';

export const POLICY_LEAVE = 'leave';
export const POLICY_DEFAULT = 'default';
export const POLICY_DEFAULT_IF_AUTOMATED = 'defaultIfAutomated';
export const ABSENT_CELL_POLICY = POLICY_DEFAULT_IF_AUTOMATED;

const POLICIES = [POLICY_LEAVE, POLICY_DEFAULT, POLICY_DEFAULT_IF_AUTOMATED];

/** Keys that at least one Section stores (a cell-gated or row-gated cell still counts; column/adapter-gated keys do not). */
export function getAutomatedKeys(song) {
    const automated = new Set();
    for (const section of song?.sections ?? []) {
        const block = section?.displayOptions;
        if (!block) continue;
        for (const key of Object.keys(block)) {
            if (isDisplayOptionKey(key) && !isRegionReadBlocked(song, null, key)) {
                automated.add(key);
            }
        }
    }
    return automated;
}

function cascade(song, lastIndex) {
    const values = {};
    const entries = {};
    for (let j = 0; j <= lastIndex; j++) {
        const section = song.sections[j];
        const block = section?.displayOptions;
        if (!block) continue;
        for (const key of Object.keys(block)) {
            if (!isDisplayOptionKey(key) || isReadBlocked(song, section, key)) continue;
            values[key] = cloneValue(block[key]);
            entries[key] = { source: 'stored', sectionIndex: j };
        }
    }
    return { values, entries };
}

/**
 * @returns {{values:Object, entries:Object}}  `entries[key]` = { source, sectionIndex? } where source is
 *   'stored' | 'default' | 'live' | 'sync' | 'blocked' (R2: read-blocked at the target Section).
 */
export function resolveDisplayOptions(song, sectionIndex, options = {}) {
    const { purpose = 'apply', live = null, syncLive = null, policy = ABSENT_CELL_POLICY } = options;
    if (!POLICIES.includes(policy)) {
        throw new Error(`unknown absent-cell policy: ${policy}`);
    }
    if (!['apply', 'render', 'baseline'].includes(purpose)) {
        throw new Error(`unknown resolve purpose: ${purpose}`);
    }
    const sections = song?.sections ?? [];
    if (!Number.isInteger(sectionIndex) || sectionIndex < 0 || sectionIndex >= sections.length) {
        return { values: {}, entries: {} };
    }
    const target = sections[sectionIndex];

    if (purpose === 'baseline') {
        const { values, entries } = cascade(song, sectionIndex - 1);
        for (const key of DISPLAY_OPTION_KEYS) {
            if (key in values) continue;
            if (DISPLAY_OPTION_META[key].hasDefault) {
                values[key] = cloneValue(DISPLAY_OPTIONS_DEFAULTS[key]);
                entries[key] = { source: 'default' };
            } else if (syncLive && key in syncLive) {
                values[key] = cloneValue(syncLive[key]);
                entries[key] = { source: 'sync' };
            }
        }
        return { values, entries };
    }

    const { values, entries } = cascade(song, sectionIndex);
    const automated = policy === POLICY_DEFAULT_IF_AUTOMATED ? getAutomatedKeys(song) : null;
    for (const key of DISPLAY_OPTION_KEYS) {
        if (key in values || !DISPLAY_OPTION_META[key].hasDefault) continue;
        if (policy === POLICY_DEFAULT || (automated && automated.has(key))) {
            values[key] = cloneValue(DISPLAY_OPTIONS_DEFAULTS[key]);
            entries[key] = { source: 'default' };
        }
    }
    // R2: adapter/column/row gates leave the control alone; a cell gate only made that cell absent (R1).
    for (const key of DISPLAY_OPTION_KEYS) {
        if (isRegionReadBlocked(song, target, key)) {
            delete values[key];
            entries[key] = { source: 'blocked' };
        }
    }
    if (purpose === 'render' && live) {
        for (const key of Object.keys(live)) {
            if (!(key in values)) {
                values[key] = cloneValue(live[key]);
                entries[key] = { source: 'live' };
            }
        }
    }
    return { values, entries };
}
