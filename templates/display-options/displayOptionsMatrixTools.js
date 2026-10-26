/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 5: the interactive Matrix's Tools and click translator.  Pure module (no DOM, no jQuery).
//
// A click in the Matrix is (tool, zone, {sectionIndex, key}).  planMatrixClick() turns it into one of:
//   { kind: 'none' }                                   a zone the tool does not work in: a silent no-op
//   { kind: 'navigate', sectionIndex }                 a Section number clicked with a Tool that does not act on rows
//   { kind: 'inspect', title, lines }                  Inspect elsewhere: text for the status area
//   { kind: 'plan', plan, tool }                       a DisplayOptions plan for runDisplayOptionsPlan()
//
// Design: _doco/design/sprints/148-displayOptions-diff/148-it5-round-1-implementation-plan.md (3.1, 3.2, 3.3)

import { DISPLAY_OPTION_META, DISPLAY_OPTIONS_DEFAULTS, isDisplayOptionKey } from './displayOptionsMeta.js';
import {
    describeBlocks, isColumnBlocked, isRowBlocked, isCellBlocked, ROW_KEY, GATE_READ, GATE_WRITE
} from './displayOptionsGates.js';
import { resolveDisplayOptions, songDefaultValues } from './displayOptionsResolver.js';
import { planClear, planClearCell, planGate, planStoreCell } from './displayOptionsPlan.js';
import { cellText } from './displayOptionsCellRules.js';

/** The places a click can land.  Only keyHeader, specialCell, sectionHeader and cell ever do anything. */
export const ZONES = Object.freeze({
    corner: 'corner',               // the blank 0,0 cell
    groupHeader: 'groupHeader',     // the group row above the key headers
    keyHeader: 'keyHeader',         // a key (column) header
    specialLabel: 'specialLabel',   // the DEFAULTS / LIVE row label
    specialCell: 'specialCell',     // a DEFAULTS / LIVE cell
    sectionLabel: 'sectionLabel',   // the "Section #" label row
    sectionHeader: 'sectionHeader', // a Section number
    cell: 'cell'                    // a Section x key cell
});

const Z = ZONES;

/**
 * Tool order is the order of the radio group.  `zones` are where a click does something.  A Tool stays selected until the
 * User picks another (there are no one-shot Tools).
 * `actsOnSectionRow`: the Tool acts on the whole Section row, so a Section number is a Tool target (and the row lights up).
 * For every other Tool a click on a Section number is normal: it navigates to that Section (the number is a link).
 */
export const TOOLS = Object.freeze([
    { id: 'inspect', label: 'Inspect', zones: [Z.keyHeader, Z.specialCell, Z.sectionHeader, Z.cell], actsOnSectionRow: false, overlay: null },
    { id: 'clearSection', label: 'Clear Section', zones: [Z.sectionHeader, Z.cell], actsOnSectionRow: true, overlay: null },
    { id: 'clearCell', label: 'Clear Cell', zones: [Z.sectionHeader, Z.cell], actsOnSectionRow: false, overlay: null },
    { id: 'storeCell', label: 'Store Cell', zones: [Z.sectionHeader, Z.cell], actsOnSectionRow: false, overlay: null },
    { id: 'keyRead', label: 'Key r', zones: [Z.keyHeader, Z.specialCell, Z.sectionHeader, Z.cell], actsOnSectionRow: false, overlay: 'column' },
    { id: 'keyWrite', label: 'Key w', zones: [Z.keyHeader, Z.specialCell, Z.sectionHeader, Z.cell], actsOnSectionRow: false, overlay: 'column' },
    { id: 'sectionRead', label: 'Section r', zones: [Z.sectionHeader, Z.cell], actsOnSectionRow: true, overlay: 'row' },
    { id: 'sectionWrite', label: 'Section w', zones: [Z.sectionHeader, Z.cell], actsOnSectionRow: true, overlay: 'row' },
    { id: 'cellRead', label: 'Cell r', zones: [Z.sectionHeader, Z.cell], actsOnSectionRow: false, overlay: null },
    { id: 'cellWrite', label: 'Cell w', zones: [Z.sectionHeader, Z.cell], actsOnSectionRow: false, overlay: null }
]);

export const DEFAULT_TOOL_ID = 'inspect';

export function getTool(toolId) {
    return TOOLS.find((tool) => tool.id === toolId) ?? null;
}

export function isToolLegalInZone(toolId, zone) {
    return !!getTool(toolId)?.zones.includes(zone);
}

/** Does a click on a Section number navigate (instead of acting) with this Tool?  Also: the hover shows no row preview. */
export function sectionHeaderNavigates(toolId) {
    const tool = getTool(toolId);
    return !!tool && !tool.actsOnSectionRow;
}

/** Sprint 148 it6 round 3: caption of the write button, naming the Current Section (one-based): "§1 → Song-DEFAULTS".
 *  § (U+00A7) and → (U+2192) are in every common UI font and sit on the text baseline, so the button keeps its height. */
export function songDefaultsButtonCaption(currentIndex) {
    const number = Number.isInteger(currentIndex) && currentIndex >= 0 ? currentIndex + 1 : '?';
    return `\u00a7${number} \u2192 Song-DEFAULTS`;
}

//=========================== gate toggles ============================================

/** Is the gate that a toggle Tool would flip currently set?  scope: 'column' | 'row' | 'cell'; side: 'read' | 'write'. */
export function isGateSet(song, { scope, sectionIndex = null, key = null, side }) {
    const section = sectionIndex == null ? null : song.sections[sectionIndex];
    if (scope === 'column') return isColumnBlocked(song, key, side);
    if (scope === 'row') return isRowBlocked(section, side);
    return isCellBlocked(section, key, side);
}

/** A planGate() that flips the gate: set -> removed, not set -> added.  Two calls (with applyPlan between) are a round trip. */
export function planToggleGate(song, { scope, sectionIndex = null, key = null, side }) {
    const on = !isGateSet(song, { scope, sectionIndex, key, side });
    return planGate(song, { scope, sectionIndex, key, direction: side, on });
}

const GATE_TOOLS = Object.freeze({
    keyRead: { scope: 'column', side: GATE_READ },
    keyWrite: { scope: 'column', side: GATE_WRITE },
    sectionRead: { scope: 'row', side: GATE_READ },
    sectionWrite: { scope: 'row', side: GATE_WRITE },
    cellRead: { scope: 'cell', side: GATE_READ },
    cellWrite: { scope: 'cell', side: GATE_WRITE }
});

//=========================== what would Apply do differently? ========================

/**
 * Would navigating to the Current Section now push different values into the controls than before the plan?
 * Used for the "controls not re-applied" hint.  Cells and read gates at a Section AFTER the current one cannot change
 * what the current Section inherits; a column gate can.  Write gates never change Apply.
 */
export function planAffectsApply(plan, currentIndex) {
    return plan.ops.some((op) => {
        if (op.type === 'setSongDefault' || op.type === 'deleteSongDefault') {
            return true;   // Sprint 148 it6: the Song-DEFAULTS tier sits under every Section
        }
        if (op.type === 'setGate') {
            if (op.direction === GATE_WRITE) return false;
            return op.scope === 'column' || (op.sectionIndex != null && op.sectionIndex <= currentIndex);
        }
        return op.type === 'deleteCell' && op.sectionIndex <= currentIndex;
    });
}

//=========================== Inspect =================================================

function describeValue(key, value) {
    if (value === undefined || value === null) return '(none)';
    const text = cellText(value, { boolMarks: true });
    return text === '' ? '(empty)' : `${text}`;
}

const SIDES = { r: 'read-blocked', w: 'write-blocked', rw: 'read- and write-blocked' };

function gateSummary(blocks) {
    const parts = [];
    for (const source of ['adapter', 'column', 'row', 'cell']) {
        if (blocks[source]) parts.push(`${source} ${SIDES[blocks[source]]}`);
    }
    return parts.length ? parts.join(', ') : 'none';
}

/**
 * Text for the status area when a cell, a key header or a DEFAULTS/LIVE cell is inspected.
 * @param {number|null} sectionIndex  null for a key header or a DEFAULTS/LIVE cell
 * @returns {{title:string, lines:string[]}}  plain text (the builder escapes it)
 */
export function describeCell(song, sectionIndex, key, { live = null, syncLive = null } = {}) {
    const meta = DISPLAY_OPTION_META[key];
    const lines = [];
    if (sectionIndex == null) {
        const columnBlocks = describeBlocks(song, null, key);
        lines.push(`group: ${meta.group}; default: ${meta.hasDefault ? describeValue(key, DISPLAY_OPTIONS_DEFAULTS[key]) : '(no default)'}; song default: ${describeValue(key, songDefaultValues(song)[key])}; live: ${describeValue(key, live?.[key])}`);
        lines.push(`gates: ${gateSummary({ adapter: columnBlocks.adapter, column: columnBlocks.column, row: '', cell: '' })}`);
        if (columnBlocks.adapter) {
            lines.push(`adapter: ${meta.gate} is off, so ${key} is neither applied nor saved until it is turned on.`);
        }
        return { title: key, lines };
    }

    const section = song.sections[sectionIndex];
    const block = section?.displayOptions;
    const stored = !!block && Object.prototype.hasOwnProperty.call(block, key);
    const baseline = resolveDisplayOptions(song, sectionIndex, { purpose: 'baseline', syncLive });
    const inherited = baseline.entries[key];
    const blocks = describeBlocks(song, section, key);

    const inheritedText = key in baseline.values
        ? `${describeValue(key, baseline.values[key])} (${inherited.source}${inherited.sectionIndex != null ? ` of Section ${inherited.sectionIndex + 1}` : ''})`
        : '(nothing; the control is left alone)';
    lines.push(stored
        ? `stored here: ${describeValue(key, block[key])}; the Section would otherwise inherit: ${inheritedText}`
        : `no stored cell; the Section inherits: ${inheritedText}`);
    lines.push(`gates: ${gateSummary(blocks)}`);

    const readRegion = blocks.adapter || blocks.column.includes('r') || blocks.row.includes('r');
    if (blocks.adapter) {
        lines.push(`adapter: ${meta.gate} is off, so ${key} is neither applied nor saved until it is turned on.`);
    }
    if (readRegion) {
        lines.push(`effect: going to Section ${sectionIndex + 1} leaves the ${key} control alone (a column, row or adapter read gate).`);
    } else if (blocks.cell.includes('r')) {
        lines.push(`effect: this stored cell is ignored when applying; ${key} is inherited from an earlier Section or the default (a cell read gate).`);
    }
    const explicitWrite = blocks.column.includes('w') || blocks.row.includes('w') || blocks.cell.includes('w');
    if (readRegion || blocks.cell.includes('r') || blocks.adapter || explicitWrite) {
        lines.push(`effect: SAVE Diff and Save All skip this cell${explicitWrite ? '; Clear skips it' : ''}.`);
    }
    return { title: `Section ${sectionIndex + 1}, ${key}`, lines };
}

//=========================== the click translator ====================================

/**
 * @param {object} song
 * @param {string} toolId   one of TOOLS[].id
 * @param {string} zone     one of ZONES
 * @param {{sectionIndex?:number|null, key?:string|null}} target
 * @param {{live?:object, syncLive?:object}} context
 */
export function planMatrixClick(song, toolId, zone, target = {}, context = {}) {
    const none = { kind: 'none' };
    const tool = getTool(toolId);
    if (!tool || !tool.zones.includes(zone)) return none;

    const { sectionIndex = null, key = null } = target;
    const needsSection = zone === Z.sectionHeader || zone === Z.cell;
    const needsKey = zone === Z.keyHeader || zone === Z.specialCell || zone === Z.cell;
    if (needsSection && !song.sections[sectionIndex]) return none;
    if (needsKey && !isDisplayOptionKey(key)) return none;

    if (tool.id === 'inspect' || (zone === Z.sectionHeader && !tool.actsOnSectionRow)) {
        if (zone === Z.sectionHeader) return { kind: 'navigate', sectionIndex };
        const info = describeCell(song, needsSection ? sectionIndex : null, key, context);
        return { kind: 'inspect', ...info };
    }

    let plan = null;
    if (tool.id === 'clearSection') {
        plan = planClear(song, sectionIndex);
    } else if (tool.id === 'clearCell') {
        plan = planClearCell(song, sectionIndex, key);
    } else if (tool.id === 'storeCell') {
        plan = planStoreCell(song, sectionIndex, key, context.live);
    } else {
        const gate = GATE_TOOLS[tool.id];
        plan = planToggleGate(song, {
            scope: gate.scope,
            sectionIndex: gate.scope === 'column' ? null : sectionIndex,
            key: gate.scope === 'row' ? ROW_KEY : key,
            side: gate.side
        });
    }
    return { kind: 'plan', plan, tool };
}
