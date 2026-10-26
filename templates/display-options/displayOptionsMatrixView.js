/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 5: HTML for the interactive Matrix (and its Legend).  Pure module (no DOM, no jQuery):
// strings in, strings out, so Jest can pin it.  The thin DOM half is templates/display-options/display-options.builder.js.
//
// Class vocabulary (per-source gate classes; /vdd keeps its merged gateRead/gateWrite classes):
//   key header      th.dmKeyHeader   + dmColGateR/W (Song gate) + dmAdapter (derived)
//   Section header  th.dmSectionHeader + dmRowGateR/W (Section '*' gate) + dmCurrentRow (the Current Section)
//   Section cell    td.dmCell        + dmAbsent | dmStored (+ dmChanged)  + dmColGateR/W + dmRowGateR/W + dmCellGateR/W
//   special rows    tr.dmDefaultsRow / tr.dmSongDefaultsRow / tr.dmLiveRow, td.dmSpecialCell (never carry data-section)
//                   (Sprint 148 it6: the special rows are plain reports of values; they never carry gate classes)
// Every clickable element carries data-zone, plus data-section and/or data-key.  Legend cells carry none (interactive:false).

import { DISPLAY_OPTION_KEYS, DISPLAY_OPTION_META, DISPLAY_OPTIONS_DEFAULTS } from './displayOptionsMeta.js';
import { describeBlocks } from './displayOptionsGates.js';
import { resolveDisplayOptions, songDefaultValues } from './displayOptionsResolver.js';
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

/** Sprint 148 it6: the Song-DEFAULTS row (song.displayOptionsDefault), between DEFAULTS and LIVE.  Always drawn; blank cells when
 *  the block is missing or empty.  A plain report of the stored values: no gate classes (a gated key's value just shows). */
export function buildSongDefaultsRowHtml(song, { interactive = true, keys = DISPLAY_OPTION_KEYS } = {}) {
    const values = songDefaultValues(song);
    const cells = keys.map((key) => specialCellHtml(interactive, key, values[key]));
    return `<tr class='dmSpecialRow dmSongDefaultsRow'><th class='dmSpecialLabel'${dataAttrs(interactive, ZONES.specialLabel)}>Song-DEFAULTS</th>${cells.join('')}</tr>`;
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
    rows.push(`<thead>${groupRowHtml(interactive, keys)}${keyRowHtml(song, interactive, keys)}${buildDefaultsRowHtml({ interactive, keys })}${buildSongDefaultsRowHtml(song, { interactive, keys })}${buildLiveRowHtml(live, { interactive, keys })}</thead>`);
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
<table class="dmTable">
    <tbody>
        <tr class="dmSectionRow">
            <th style="border: none;">Section:</th>
            <th class="dmSectionHeader">1</th>
        </tr>
        <tr class="dmSectionRow dmCurrentRow">
            <th style="border: none;">Current Section:</th>
            <th class="dmSectionHeader dmCurrentRow">2</th>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">checked:</td>
            <td class="dmCell dmStored">✓</td>
        </tr>
        <tr class="dmSectionRow">    
            <td style="border: none;">unchecked:</td>
            <td class="dmCell dmStored">✗</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">absent:</td>
            <td class="dmCell dmAbsent"></td>
        </tr>
        <tr class="dmSectionRow">  
            <td style="border: none;">read-blocked:</td>  
            <td class="dmCell dmAbsent dmColGateR dmRowGateR"></td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">write-blocked:</td>
            <td class="dmCell dmAbsent dmColGateW"></td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">read-blocked<br>write-blocked:</td>
            <td class="dmCell dmAbsent dmColGateR dmRowGateW"></td>
        </tr>
        <tr class="dmSectionRow">  
            <td style="border: none;">read-blocked:</td>  
            <td class="dmCell  dmColGateR dmRowGateR">value</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">write-blocked:</td>
            <td class="dmCell  dmColGateW">value</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">read-blocked<br>write-blocked:</td>
            <td class="dmCell  dmColGateR dmRowGateW">value</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell read-blocked:</td>
            <td class="dmCell  dmCellGateR">value</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell write-blocked:</td>
            <td class="dmCell  dmCellGateW">value</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell read-blocked<br>Cell write-blocked:</td>
            <td class="dmCell  dmCellGateW dmCellGateR">value</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell read-blocked<br>Row write-blocked:</td>
            <td class="dmCell  dmRowGateW dmCellGateR">value</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell read-blocked<br>Row read-blocked:</td>
            <td class="dmCell  dmRowGateR dmCellGateR">value</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell read-blocked:</td>
            <td class="dmCell dmStored dmChanged dmCellGateR">changed ✓</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell write-blocked:</td>
            <td class="dmCell dmStored dmChanged dmCellGateW">changed ✓</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">read-blocked:</td>
            <td class="dmCell dmStored dmChanged dmRowGateR">changed ✓</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell read-blocked<br>Row write-blocked:</td>
            <td class="dmCell dmStored dmChanged dmRowGateW dmCellGateR">changed ✓</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell read-blocked<br>Cell write-blocked:</td>
            <td class="dmCell dmStored dmChanged dmCellGateW dmCellGateR">changed ✓</td>
        </tr>
        <tr class="dmSectionRow">
            <td style="border: none;">Cell read-blocked<br>Cell write-blocked<br>Row read-blocked<br>Row write-blocked:</td>
            <td class="dmCell dmStored dmChanged dmCellGateW dmCellGateR dmRowGateR dmRowGateW">changed ✓</td>
        </tr>
    </tbody>
</table>
<br><p><b>Cells</b>: <ul><li><span class='dmLegendSwatch dmStored dmChanged'>green</span> stored, and differs from what the Section inherits;
<li><span class='dmLegendSwatch dmStored'>white</span> stored, but repeats the inherited value;
<li><span class='dmLegendSwatch dmAbsent'>gray</span> nothing stored. </ul></p>

<br><p><b>Usage:</b><ul>
<li>Click a Tool then click a row (Section), column (Key), or Cell. Clicking again toggles.
<li>Values and blocks flow down from DEFAULTS, to Sections.
<li>The <b>Song-DEFAULTS</b> row sits between DEFAULTS and the Sections: values and blocks flow DEFAULTS, then Song-DEFAULTS, then Sections.  A Section stores only what differs from it.  The <b>&sect;N &rarr; Song-DEFAULTS</b> button (N is the Current Section) copies that Section's stored cells (it ignores blocks, and leaves the Section as it is); "Clear Song-DEFAULTS" empties the row.  The three special rows only report values; they have no blocks.
<li>If any Section or Cell automates any value under one Key, then the DEFAULTS are consulted when Looping around from Section 1.
<li>Cell blocks are partially obscured by Row and Column blocks.  Use the View buttons to suspend display of Row and Column blocks.
</ul></p>


<br><p><b>Gates</b> (r = read-block, w = write-block): 
<ul>
   <li>a <b>column</b> gate lights the key header and its cells. 
    <br>Key read-block: <span class="dmToolsExample">Key r</span> 
    <br>Key write-block: <span class="dmToolsExample">Key w</span> 
   <li>a <b>row</b> gate lights the Section number and its cells. 
    <br>Section read-block: <span class="dmToolsExample">Section r</span> 
    <br>Section write-block: <span class="dmToolsExample">Section w</span>
   <li>a <b>cell</b> gate marks one cell. 
    <br>Cell read-block: <span class="dmToolsExample">Cell r</span> 
    <br>Cell write-block: <span class="dmToolsExample">Cell w</span> 
   <li>A cell read-block means <i>this stored cell is ignored</i> (the key inherits); 
   <li>a column, row or adapter read-block means <i>the control is left alone</i>.
   <li>Write-blocks stop SAVE Diff, Save All and Clear.  
   <li>An <b>a</b> mark means Presentation Mode or Allow Theme Automation is off.
    <br><b>a:presentationMode</b>
    <br><b>a:allowThemeAutomation</b>
</ul></p>
<br><p><b>Example below:</b> 
<ul>
    <li>Section 2 is the Current Section.  
    <li><code>naturalFontScaling</code> has a column read-block and <code>tinyNoteWidth</code> a column write-block;
    <li>Section 3 has a cell read-block and a cell write-block; 
    <li>Section 4 has a row read-block; <li>Section 5 has a row write-block and two cell read-blocks.
    <li><code>NoteDisplaySizes</code> is off because Presentation Mode is off.
</ul></p>
</div>${table}`;
}
