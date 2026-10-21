/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 5: the cell rules shared by the static /vdd report (display-options.js) and the interactive
// Matrix (displayOptionsMatrixView.js).  Pure module (no DOM, no jQuery).  /vdd's HTML is pinned byte for byte by
// _tests/jest/display-options-vdd-golden.test.js, so change these functions only on purpose.

import { valuesEqual } from './displayOptionsMeta.js';

export function escapeHtml(text) {
    return `${text}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Cell text.  /vdd: true = check mark, false = blank.  boolMarks (the Matrix): true = check mark, false = cross. */
export function cellText(value, { boolMarks = false } = {}) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value ? '\u2713' : (boolMarks ? '\u2717' : '');
    if (typeof value === 'object') {
        if (value.caption) return `${value.caption}`;
        return JSON.stringify(value);
    }
    return `${value}`;
}

/** The merged classes /vdd uses: read and/or write, from whichever sources were passed. */
export function gateClasses(...gateStrings) {
    const text = gateStrings.join('');
    const classes = [];
    if (text.includes('r')) classes.push('gateRead');
    if (text.includes('w')) classes.push('gateWrite');
    return classes.join(' ');
}

/** Classes for a cell-level gate only, for styling in infinite-neck.css (/vdd). */
export const CELL_GATE_CLASS = { r: 'cellGateRead', w: 'cellGateWrite', rw: 'cellGateReadWrite' };

/**
 * The state of one stored/absent cell.
 *   'absent'  : the Section stores nothing for the key
 *   'changed' : stored, and differs from what the Section would otherwise inherit (`baseline`)
 *   'same'    : stored, and merely repeats the inherited value
 * @param {object|null|undefined} block   section.displayOptions
 * @param {string} key
 * @param {object} baseline   resolveDisplayOptionsAt(idx, {purpose:'baseline'}).values
 */
export function cellState(block, key, baseline) {
    const hasCell = !!block && Object.prototype.hasOwnProperty.call(block, key);
    if (!hasCell) return 'absent';
    const differs = !(key in baseline) || !valuesEqual(key, block[key], baseline[key]);
    return differs ? 'changed' : 'same';
}
