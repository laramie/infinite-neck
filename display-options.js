// Sprint 148 it4: the /vdd "view DisplayOptions" table (a minimal Matrix view).
//   - static columns, straight from DISPLAY_OPTION_META (not from the current controls)
//   - one row per Section that stores cells or has gates
//   - a stored cell is green (chartreuse) when it differs from what the Section would otherwise inherit
//     (the resolver's 'baseline': earlier Sections' readable cells, then the defaults); white when it merely
//     repeats the inherited value; dark gray when the Section stores nothing for that key
//   - gates: column gates on the header, row gates on the Section number, cell gates on the cell.
//     Marks: r = read-blocked, w = write-blocked; a = derived from presentationMode / allowThemeAutomation.

import { DISPLAY_OPTION_KEYS, DISPLAY_OPTION_META } from './templates/display-options/displayOptionsMeta.js';
import { describeBlocks } from './templates/display-options/displayOptionsGates.js';
import { escapeHtml, cellText, gateClasses, CELL_GATE_CLASS, cellState, gateMarkHtml, keyLabelHtml, WANT_LITERAL_ROWMARK_TEXT, WANT_LITERAL_COLMARK_TEXT } from './templates/display-options/displayOptionsCellRules.js';

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

// escapeHtml, cellText, gateClasses, CELL_GATE_CLASS, cellState, the key label and the WANT_LITERAL_ROW/COLMARK_TEXT switches
// are shared with the interactive Matrix (Sprint 148 it5).

const sup = gateMarkHtml;

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
        + "marks: a = presentationMode / allowThemeAutomation is off</small></caption>");

    const header = DISPLAY_OPTION_KEYS.map((key) => {
        const blocks = describeBlocks(song, null, key);
        const colMarks = [];
        if (WANT_LITERAL_COLMARK_TEXT && blocks.column) colMarks.push(`col:${blocks.column}`);
        const hintText = blocks.adapter ? `a:${DISPLAY_OPTION_META[key].gate}` : '';
        return `<th class='vertical-header ${gateClasses(blocks.adapter, blocks.column)}'>${keyLabelHtml(key, hintText, colMarks)}</th>`;
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
        const cells = [`<td${topBorder} class='${gateClasses(rowGate)}'>${sectionIdx + 1}${sup(WANT_LITERAL_ROWMARK_TEXT && rowGate ? [`row:${rowGate}`] : [])}</td>`];
        for (const key of DISPLAY_OPTION_KEYS) {
            const blocks = describeBlocks(song, section, key);
            const state = cellState(block, key, baseline);
            const classes = [gateClasses(blocks.column, blocks.row, blocks.cell), CELL_GATE_CLASS[blocks.cell]]
                .filter(Boolean).join(' ');
            const cellMarks = [];
            if (WANT_LITERAL_CELLMARK_TEXT){
                if (blocks.cell) cellMarks.push(`cell:${blocks.cell}`);
            }
            const markHtml = sup(cellMarks);
            if (state === 'absent') {
                cells.push(`<td class='${classes}' style='background-color: #303030;'>${markHtml || ''}</td>`);
                continue;
            }
            const text = escapeHtml(cellText(block[key])) || '&nbsp;';
            cells.push(`<td class='${classes}' style='background-color: ${state === 'changed' ? 'chartreuse' : 'white'};'>${text}${markHtml}</td>`);
        }
        res.push(`<tr>${cells.join('')}</tr>`);
        skippedRow = false;
    });

    res.push("</table>");
    return res.join("\r\n");
}
