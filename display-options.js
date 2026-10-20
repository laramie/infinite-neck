// Sprint 148 it4: the /vdd "view DisplayOptions" table (a minimal Matrix view).
//   - static columns, straight from DISPLAY_OPTION_META (not from the current controls)
//   - one row per Section that stores cells or has gates
//   - a stored cell is green (chartreuse) when it differs from what the Section would otherwise inherit
//     (the resolver's 'baseline': earlier Sections' readable cells, then the defaults); white when it merely
//     repeats the inherited value; dark gray when the Section stores nothing for that key
//   - gates: column gates on the header, row gates on the Section number, cell gates on the cell.
//     Marks: r = read-blocked, w = write-blocked; a = derived from presentationMode / allowThemeAutomation.

import { DISPLAY_OPTION_KEYS, DISPLAY_OPTION_META, valuesEqual } from './templates/display-options/displayOptionsMeta.js';
import { describeBlocks } from './templates/display-options/displayOptionsGates.js';

let getSongProvider = function () {
    return null;
};

export function setDisplayOptionsProviders(providers){
    if (!providers) return;
    if (typeof providers.getSong === 'function') {
        getSongProvider = providers.getSong;
    }
    // providers.controlsToDisplayOptions is accepted for compatibility but no longer used: the columns are static.
}

function escapeHtml(text){
    return `${text}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function cellText(value){
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value ? '\u2713' : '';
    if (typeof value === 'object') {
        if (value.caption) return `${value.caption}`;
        return JSON.stringify(value);
    }
    return `${value}`;
}

function sup(parts){
    const text = escapeHtml(parts.join(' '));
    return parts.length ? `<sup class='gateMark' title='${text}'>${text}</sup>` : '';
}

function gateClasses(...gateStrings){
    const text = gateStrings.join('');
    const classes = [];
    if (text.includes('r')) classes.push('gateRead');
    if (text.includes('w')) classes.push('gateWrite');
    return classes.join(' ');
}

// Classes for a cell-level gate only (the `cell:r` / `cell:w` / `cell:rw` marks), for styling in infinite-neck.css.
const CELL_GATE_CLASS = { r: 'cellGateRead', w: 'cellGateWrite', rw: 'cellGateReadWrite' };

//For debugging turn this to true, and it will spit out "cell:r", "cell:w", "cell:rw", otherwise you just get the css classes.
const WANT_LITERAL_CELLMARK_TEXT = false;

function columnGateDescription(song){
    const gates = song.displayOptionGates;
    if (!gates) return 'no Song (column) gates';
    const list = (name, keys) => (Array.isArray(keys) && keys.length ? `${name}: ${keys.map(escapeHtml).join(', ')}` : null);
    return `Song column gates &mdash; ${[list('read-blocked', gates.readBlocked), list('write-blocked', gates.writeBlocked)].filter(Boolean).join('; ')}`;
}

export function displayOptionsTable(){
    const song = getSongProvider();
    if (!song) {
        return "";
    }
    const sections = song.getSections();
    const res = [];
    res.push("<table border='1' class='tblDisplayOptions'><caption>DisplayOptions: Sections with stored cells or gates"
        + `<br><small>${columnGateDescription(song)}.  green = differs from what the Section inherits; gray = no stored cell; `
        + "marks: r read-blocked, w write-blocked, a = presentationMode / allowThemeAutomation is off</small></caption>");

    const header = DISPLAY_OPTION_KEYS.map((key) => {
        const blocks = describeBlocks(song, null, key);
        const colMarks = [];
        if (blocks.adapter) colMarks.push(`a:${DISPLAY_OPTION_META[key].gate}`);
        if (blocks.column) colMarks.push(`col:${blocks.column}`);
        return `<th class='vertical-header ${gateClasses(blocks.adapter, blocks.column)}'><span>${escapeHtml(key)}${sup(colMarks)}</span></th>`;
    });
    res.push(`<tr><td style='vertical-align: bottom;'>Section&nbsp;#</td>${header.join('')}</tr>`);

    let skippedRow = false;
    sections.forEach((section, sectionIdx) => {
        const block = section.displayOptions;
        if (!block && !section.displayOptionGates) {
            skippedRow = true;
            return;
        }
        const baseline = song.resolveDisplayOptionsAt(sectionIdx, { purpose: 'baseline' }).values;
        const topBorder = skippedRow ? " style='border-top: 2px dashed orange;'" : '';
        const rowGate = describeBlocks(song, section, DISPLAY_OPTION_KEYS[0]).row;
        const cells = [`<td${topBorder} class='${gateClasses(rowGate)}'>${sectionIdx + 1}${sup(rowGate ? [`row:${rowGate}`] : [])}</td>`];
        for (const key of DISPLAY_OPTION_KEYS) {
            const blocks = describeBlocks(song, section, key);
            const hasCell = !!block && Object.prototype.hasOwnProperty.call(block, key);
            const classes = [gateClasses(blocks.column, blocks.row, blocks.cell), CELL_GATE_CLASS[blocks.cell]]
                .filter(Boolean).join(' ');
            const cellMarks = [];
            if (WANT_LITERAL_CELLMARK_TEXT){
                if (blocks.cell) cellMarks.push(`cell:${blocks.cell}`);
            }
            const markHtml = sup(cellMarks);
            if (!hasCell) {
                cells.push(`<td class='${classes}' style='background-color: #303030;'>${markHtml || ''}</td>`);
                continue;
            }
            const differs = !(key in baseline) || !valuesEqual(key, block[key], baseline[key]);
            const text = escapeHtml(cellText(block[key])) || '&nbsp;';
            cells.push(`<td class='${classes}' style='background-color: ${differs ? 'chartreuse' : 'white'};'>${text}${markHtml}</td>`);
        }
        res.push(`<tr>${cells.join('')}</tr>`);
        skippedRow = false;
    });

    res.push("</table>");
    return res.join("\r\n");
}
