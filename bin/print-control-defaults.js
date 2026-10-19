#!/usr/bin/env node

// Sprint 148 Iteration 4: prints the control values the markup of index.html (and templates/palette.html)
// gives the DisplayOptions controls, next to DISPLAY_OPTIONS_DEFAULTS, so a drift is easy to spot.
// Text-only: it reads the checked / selected / value attributes with regular expressions.
//
// Usage: node bin/print-control-defaults.js [--check]     (--check exits 1 when the two disagree)

import fs from 'fs';
import { DISPLAY_OPTIONS_DEFAULTS } from '../templates/display-options/displayOptionsMeta.js';

const CHECKBOXES = {
    showCellNotes: 'cbShowCellNotes', showSubscriptFunctions: 'cbShowSubscriptFunctions', showMidiNum: 'cbMidiNum',
    useCenterForRightFunction: 'cbCenterForRightFunction', naturalFretWidths: 'cbNaturalFretWidths',
    hideNamedNotes: 'cbHideNamedNotes', hideTinyNotes: 'cbHideTinyNotes', hideSingleNotes: 'cbHideSingleNotes',
    hideFingering: 'cbHideFingering', showAllNoteNames: 'cbShowAllNoteNames', showLooperLightBeats: 'cbShowLooperLightBeats',
    autoColor: 'cbAutomaticColor', autoColorHighlight: 'cbAutomaticColorHighlight'
};
const SELECTS = {
    naturalFontScaling: 'selNaturalFontScaling', pianoHeightScaleFactor: 'selPianoHeightScaleFactor',
    pianoWidthScaleFactor: 'selPianoWidthScaleFactor', pianoWhiteToBlackWidthRatio: 'selPianoWhiteToBlackWidthRatio',
    pianoFingeringHPosition: 'selPianoFingeringHPosition', noteFont: 'selNoteFont',
    leftSubscriptFontSize: 'selLeftSubscriptFontSize', rightSubscriptFontSize: 'selRightSubscriptFontSize',
    midiFontSize: 'selMidiFontSize', fingeringFontSize: 'selFingeringFontSize', fingeringPosition: 'selFingeringPosition',
    tinyNoteFontSize: 'selTinyNoteFontSize', tinyNoteMaxHeight: 'selTinyNoteMaxHeight',
    tinyNoteVPosition: 'selTinyNoteVPosition', tinyNoteWidth: 'selTinyNoteWidth',
    tinyNoteHPosition: 'selTinyNoteHPosition', tinyNoteRadius: 'selTinyNoteRadius'
};
const RANGES = { namedNoteOpacity: 'rangeNamedNoteOpacity', singleNoteOpacity: 'rangeSingleNoteOpacity', tinyNoteOpacity: 'rangeTinyNoteOpacity' };

const html = ['index.html', 'templates/palette.html'].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

function tagFor(id) {
    const m = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`, 's'));
    return m ? m[0] : null;
}

function checkboxDefault(id) {
    const tag = tagFor(id);
    return tag === null ? undefined : /\schecked(=|\s|>|\/)/.test(tag) && !/FOOchecked/.test(tag);
}

function selectDefault(id) {
    const m = html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>(.*?)</select>`, 's'));
    if (!m) return undefined;
    const sel = m[1].match(/<option[^>]*value="([^"]*)"[^>]*selected/);
    return sel ? sel[1] : undefined;
}

function rangeDefault(id) {
    const tag = tagFor(id);
    const v = tag && tag.match(/value="([^"]*)"/);
    return v ? `${Number(v[1])}` : undefined;
}

const found = {};
Object.entries(CHECKBOXES).forEach(([key, id]) => { found[key] = checkboxDefault(id); });
Object.entries(SELECTS).forEach(([key, id]) => { found[key] = selectDefault(id); });
Object.entries(RANGES).forEach(([key, id]) => { found[key] = rangeDefault(id); });

// Keys whose markup differs ON PURPOSE: the palette checkbox is unchecked in templates/palette.html and
// applyDisplayOptionDefaults() checks it once the palette exists (AutoColor starts on).
const KNOWN_MARKUP_DIFFERENCES = new Set(['autoColor']);

let drift = 0;
Object.keys(DISPLAY_OPTIONS_DEFAULTS).forEach((key) => {
    const expected = DISPLAY_OPTIONS_DEFAULTS[key];
    const markup = found[key];
    let note = markup === undefined ? 'not in the markup (set in code)' : (`${markup}` === `${expected}` ? 'ok' : 'DIFFERS');
    if (note === 'DIFFERS' && KNOWN_MARKUP_DIFFERENCES.has(key)) {
        note = 'differs on purpose (set in code)';
    } else if (note === 'DIFFERS') {
        drift++;
    }
    console.log(`${key.padEnd(30)} defaults=${`${expected}`.padEnd(14)} markup=${`${markup}`.padEnd(14)} ${note}`);
});
console.log(drift ? `${drift} key(s) differ` : 'no drift');
if (process.argv.includes('--check') && drift) {
    process.exitCode = 1;
}
