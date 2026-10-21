/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 5: HTML for the interactive Matrix (and its Legend).  Pure module (no DOM, no jQuery):
// strings in, strings out, so Jest can pin it.  The thin DOM half is templates/display-options/display-options.builder.js.
//
// Class vocabulary (per-source gate classes; /vdd keeps its merged gateRead/gateWrite classes):
//   key header      th.dmKeyHeader   + dmColGateR/W (Song gate) + dmAdapter (derived)
//   Section header  th.dmSectionHeader + dmRowGateR/W (Section '*' gate) + dmCurrentRow (the Current Section)
//   Section cell    td.dmCell        + dmAbsent | dmStored (+ dmChanged)  + dmColGateR/W + dmRowGateR/W + dmCellGateR/W
//   special rows    tr.dmDefaultsRow / tr.dmLiveRow, td.dmSpecialCell (never carry data-section)
// Every clickable element carries data-zone, plus data-section and/or data-key.  Legend cells carry none (interactive:false).

import { DISPLAY_OPTION_KEYS, DISPLAY_OPTION_META, DISPLAY_OPTIONS_DEFAULTS } from './displayOptionsMeta.js';
import { describeBlocks } from './displayOptionsGates.js';
import { resolveDisplayOptions } from './displayOptionsResolver.js';
import { escapeHtml, cellText, cellState, gateMarkHtml, keyLabelHtml, WANT_LITERAL_ROWMARK_TEXT, WANT_LITERAL_COLMARK_TEXT } from './displayOptionsCellRules.js';
import { ZONES } from './displayOptionsMatrixTools.js';

/** Text longer than this gets a title attribute with the full text (the CSS clips with an ellipsis). */
export const CLIP_TITLE_LENGTH = 12;

// Shared with /vdd: see displayOptionsCellRules.js.
export { WANT_LITERAL_ROWMARK_TEXT, WANT_LITERAL_COLMARK_TEXT };

function gateFlagClasses(prefix, marks) {
    const classes = [];
    if (marks.includes('r')) classes.push(`${prefix}R`);
    if (marks.includes('w')) classes.push(`${prefix}W`);
    return classes;
}

const gateMark = gateMarkHtml;

function dataAttrs(interactive, zone, { sectionIndex = null, key = null } = {}) {
    if (!interactive) return '';
    let text = ` data-zone='${zone}'`;
    if (sectionIndex != null) text += ` data-section='${sectionIndex}'`;
    if (key != null) text += ` data-key='${escapeHtml(key)}'`;
    return text;
}

function cellBody(value) {
    const text = cellText(value, { boolMarks: true });
    const html = escapeHtml(text) || '&nbsp;';
    const title = text.length > CLIP_TITLE_LENGTH ? ` title='${escapeHtml(text)}'` : '';
    return { html, title };
}

/** Runs of adjacent keys with the same group: [{group, count}]. */
export function groupRuns(keys = DISPLAY_OPTION_KEYS) {
    const runs = [];
    for (const key of keys) {
        const group = DISPLAY_OPTION_META[key].group;
        if (runs.length && runs[runs.length - 1].group === group) {
            runs[runs.length - 1].count++;
        } else {
            runs.push({ group, count: 1 });
        }
    }
    return runs;
}

function groupRowHtml(interactive, keys) {
    const cells = groupRuns(keys).map((run) => `<th class='dmGroupHeader'${dataAttrs(interactive, ZONES.groupHeader)} colspan='${run.count}'>${escapeHtml(run.group)}</th>`);
    return `<tr class='dmGroupRow'><th class='dmCorner'${dataAttrs(interactive, ZONES.corner)}></th>${cells.join('')}</tr>`;
}

function keyRowHtml(song, interactive, keys) {
    const cells = keys.map((key) => {
        const blocks = describeBlocks(song, null, key);
        const marks = [];
        if (WANT_LITERAL_COLMARK_TEXT && blocks.column) marks.push(`col:${blocks.column}`);
        // the adapter hint is its own line: in the rotated header it sits beside the key name, so the header is not taller
        const hintText = blocks.adapter ? `a:${DISPLAY_OPTION_META[key].gate}` : '';
        const classes = ['dmKeyHeader', ...gateFlagClasses('dmColGate', blocks.column), ...(blocks.adapter ? ['dmAdapter'] : [])];
        const title = `${DISPLAY_OPTION_META[key].group}: ${key}`;
        return `<th class='${classes.join(' ')}'${dataAttrs(interactive, ZONES.keyHeader, { key })} title='${escapeHtml(title)}'>${keyLabelHtml(key, hintText, marks)}</th>`;
    });
    return `<tr class='dmKeyRow'><th class='dmCorner'${dataAttrs(interactive, ZONES.corner)}></th>${cells.join('')}</tr>`;
}

function specialCellHtml(interactive, key, value) {
    const { html, title } = value === undefined || value === null ? { html: '', title: '' } : cellBody(value);
    return `<td class='dmSpecialCell'${dataAttrs(interactive, ZONES.specialCell, { key })}${title}>${html}</td>`;
}

/** The DEFAULTS row. */
export function buildDefaultsRowHtml({ interactive = true, keys = DISPLAY_OPTION_KEYS } = {}) {
    const cells = keys.map((key) => specialCellHtml(interactive, key, DISPLAY_OPTIONS_DEFAULTS[key]));
    return `<tr class='dmSpecialRow dmDefaultsRow'><th class='dmSpecialLabel'${dataAttrs(interactive, ZONES.specialLabel)}>DEFAULTS</th>${cells.join('')}</tr>`;
}

/** The LIVE row (values of the controls).  The builder patches this row in place when the controls change. */
export function buildLiveRowHtml(live, { interactive = true, keys = DISPLAY_OPTION_KEYS } = {}) {
    const cells = keys.map((key) => specialCellHtml(interactive, key, live ? live[key] : undefined));
    return `<tr class='dmSpecialRow dmLiveRow'><th class='dmSpecialLabel'${dataAttrs(interactive, ZONES.specialLabel)}>LIVE</th>${cells.join('')}</tr>`;
}

/** One Section row: every Section gets one, even a Section that stores nothing (all dark gray). */
export function buildSectionRowHtml(song, sectionIndex, { currentIndex = -1, interactive = true, keys = DISPLAY_OPTION_KEYS } = {}) {
    const section = song.sections[sectionIndex];
    const block = section.displayOptions;
    const baseline = resolveDisplayOptions(song, sectionIndex, { purpose: 'baseline' }).values;
    const isCurrent = sectionIndex === currentIndex;
    const rowMarks = describeBlocks(song, section, keys[0]).row;
    const headerClasses = ['dmSectionHeader', ...gateFlagClasses('dmRowGate', rowMarks), ...(isCurrent ? ['dmCurrentRow'] : [])];
    const number = sectionIndex + 1;
    const link = interactive
        ? `<a href='#' class='dmSectionLink' data-section='${sectionIndex}'>${number}</a>`
        : `${number}`;
    const cells = [`<th class='${headerClasses.join(' ')}'${dataAttrs(interactive, ZONES.sectionHeader, { sectionIndex })}>${link}${gateMark(WANT_LITERAL_ROWMARK_TEXT && rowMarks ? [`row:${rowMarks}`] : [])}</th>`];
    for (const key of keys) {
        const blocks = describeBlocks(song, section, key);
        const state = cellState(block, key, baseline);
        const classes = ['dmCell',
            state === 'absent' ? 'dmAbsent' : 'dmStored',
            ...(state === 'changed' ? ['dmChanged'] : []),
            ...gateFlagClasses('dmColGate', blocks.column),
            ...gateFlagClasses('dmRowGate', blocks.row),
            ...gateFlagClasses('dmCellGate', blocks.cell),
            ...(blocks.adapter ? ['dmAdapterKey'] : [])];
        const { html, title } = state === 'absent' ? { html: '', title: '' } : cellBody(block[key]);
        cells.push(`<td class='${classes.join(' ')}'${dataAttrs(interactive, ZONES.cell, { sectionIndex, key })}${title}>${html}</td>`);
    }
    return `<tr class='dmSectionRow${isCurrent ? ' dmCurrentRow' : ''}'${interactive ? ` data-section-row='${sectionIndex}'` : ''}>${cells.join('')}</tr>`;
}

/**
 * The whole Matrix table.
 * @param {object} song  a Song, or any object with sections[], displayOptionGates, presentationMode, allowThemeAutomation
 * @param {{currentIndex?:number, live?:object|null, interactive?:boolean, keys?:string[]}} options  keys: the columns (default all)
 */
export function buildMatrixHtml(song, { currentIndex = -1, live = null, interactive = true, keys = DISPLAY_OPTION_KEYS } = {}) {
    const rows = [];
    rows.push(`<thead>${groupRowHtml(interactive, keys)}${keyRowHtml(song, interactive, keys)}${buildDefaultsRowHtml({ interactive, keys })}${buildLiveRowHtml(live, { interactive, keys })}</thead>`);
    rows.push('<tbody>');
    rows.push(`<tr class='dmSectionLabelRow'><th class='dmSectionLabel'${dataAttrs(interactive, ZONES.sectionLabel)}>Section&nbsp;#</th><td class='dmSectionLabelFill'${dataAttrs(interactive, ZONES.sectionLabel)} colspan='${keys.length}'></td></tr>`);
    song.sections.forEach((section, idx) => rows.push(buildSectionRowHtml(song, idx, { currentIndex, interactive, keys })));
    rows.push('</tbody>');
    return `<table class='dmTable'>${rows.join('')}</table>`;
}

//=========================== Legend ==================================================

/**
 * A tiny synthetic Song that shows every cell look.  Used for the Legend so it is drawn by the same code as the real
 * Matrix and cannot drift.  Section 1 is the "inherited" source; the rest are the examples.
 */
export function buildLegendSong() {
    return {
        presentationMode: false,
        allowThemeAutomation: false,
        displayOptionGates: { readBlocked: ['naturalFontScaling'], writeBlocked: ['tinyNoteWidth'] },
        sections: [
            { displayOptions: { autoColor: true, noteFont: 'Cardo', showMidiNum: false } },
            { displayOptions: { autoColor: true, noteFont: 'Eczar', showMidiNum: false, naturalFontScaling: '70', tinyNoteWidth: '40%' } },
            { displayOptions: { hideTinyNotes: true, hideNamedNotes: true }, displayOptionGates: { readBlocked: ['hideTinyNotes'], writeBlocked: ['hideNamedNotes'] } },
            { displayOptions: { noteFont: 'Cardo' }, displayOptionGates: { readBlocked: ['*'] } },
            { displayOptions: { noteFont: 'Cardo' }, displayOptionGates: { writeBlocked: ['*'], readBlocked: ['noteFont', 'showMidiNum'] } }
        ]
    };
}

/** The columns the Legend shows, in Matrix order. */
export const LEGEND_KEYS = Object.freeze(
    ['autoColor', 'showMidiNum', 'hideTinyNotes', 'hideNamedNotes', 'naturalFontScaling', 'NoteDisplaySizes', 'tinyNoteWidth', 'noteFont']
        .sort((a, b) => DISPLAY_OPTION_META[a].order - DISPLAY_OPTION_META[b].order)
);

/** The Legend: explanatory text plus a table drawn by the real renderer from buildLegendSong(). */
export function buildLegendHtml() {
    const song = buildLegendSong();
    const table = buildMatrixHtml(song, { currentIndex: 1, live: { autoColor: true, noteFont: 'Cardo', showMidiNum: false }, interactive: false, keys: LEGEND_KEYS });
    return `<div class='dmLegendText'>
<p><b>Cells</b>: <span class='dmLegendSwatch dmStored dmChanged'>green</span> stored, and differs from what the Section inherits;
<span class='dmLegendSwatch dmStored'>white</span> stored, but repeats the inherited value;
<span class='dmLegendSwatch dmAbsent'>gray</span> nothing stored.  The highlighted Section number is the Current Section.</p>
<p><b>Gates</b> (r = read-block, w = write-block): a <b>column</b> gate lights the key header and its cells, a <b>row</b> gate lights the Section number and its cells,
a <b>cell</b> gate marks one cell.  A cell read-block means <i>this stored cell is ignored</i> (the key inherits); a column, row or adapter read-block means <i>the control is left alone</i>.
Write-blocks stop SAVE Diff, Save All and Clear.  An <b>a</b> mark means Presentation Mode or Allow Theme Automation is off.</p>
<p>Example below: Section 2 is the Current Section.  <code>naturalFontScaling</code> has a column read-block and <code>tinyNoteWidth</code> a column write-block;
Section 3 has a cell read-block and a cell write-block; Section 4 has a row read-block; Section 5 has a row write-block and two cell read-blocks.
<code>NoteDisplaySizes</code> is off because Presentation Mode is off.</p>
</div>${table}`;
}
