/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 4: static metadata for the DisplayOptions "matrix" (Sections x keys).
// Pure module: no DOM, no jQuery, no Song.  See
// _doco/design/sprints/148-displayOptions-diff/148-it4-round-2-implementation-plan.md
//
// DISPLAY_OPTION_META lists every key that infinite-neck.js::controlsToDisplayOptions() produces,
// in column order.  A Jest test pins the two lists together.
//
//   group      : the column group shown in /vdd
//   kind       : 'boolean' | 'string' | 'object' (value shape)
//   gate       : null | 'presentationMode' | 'allowThemeAutomation'
//                (an "adapter" gate: the key is read- and write-blocked while that Song flag is off)
//   hasDefault : true if DISPLAY_OPTIONS_DEFAULTS has an entry for the key

export const DEFAULT_FUNCTION_SYMBOLS_ID = 'function';

/** Values the markup of index.html / templates/palette.html gives the controls before any Song is
 *  applied.  `bin/print-control-defaults.js` prints the markup values for comparison.
 *  NOT defaulted (no entry): currentColorDict, NoteDisplaySizes, sectionTheme.  */
export const DISPLAY_OPTIONS_DEFAULTS = Object.freeze({
    autoColorHighlight: false,
    autoColor: true,
    showCellNotes: true,
    showSubscriptFunctions: true,
    cellIsFunction: true,
    showMidiNum: false,
    useCenterForRightFunction: true,
    naturalFretWidths: true,
    hideNamedNotes: false,
    hideTinyNotes: false,
    hideSingleNotes: false,
    hideFingering: false,
    showAllNoteNames: false,
    namedNoteOpacity: '1',
    singleNoteOpacity: '1',
    tinyNoteOpacity: '1',
    functionSymbols: DEFAULT_FUNCTION_SYMBOLS_ID,
    naturalFontScaling: '60',
    pianoHeightScaleFactor: '5',
    pianoWidthScaleFactor: '3',
    pianoWhiteToBlackWidthRatio: '2.3',
    pianoFingeringHPosition: '50%',
    showLooperLightBeats: true,
    noteFont: 'EB Garamond',
    leftSubscriptFontSize: '80%',
    rightSubscriptFontSize: '80%',
    midiFontSize: '80%',
    fingeringFontSize: '80%',
    fingeringPosition: '0',
    tinyNoteFontSize: '50%',
    tinyNoteMaxHeight: '45%',
    tinyNoteVPosition: '50%',
    tinyNoteWidth: '35%',
    tinyNoteHPosition: '90%',
    tinyNoteRadius: '50%'
});

function m(group, kind, gate = null) {
    return Object.freeze({ group, kind, gate });
}

const META_ROWS = [
    ['autoColorHighlight',         m('Color', 'boolean')],
    ['autoColor',                  m('Color', 'boolean')],
    ['currentColorDict',           m('Color', 'string')],
    ['sectionTheme',               m('Color', 'string', 'allowThemeAutomation')],
    ['showCellNotes',              m('Cell text', 'boolean')],
    ['showSubscriptFunctions',     m('Cell text', 'boolean')],
    ['cellIsFunction',             m('Cell text', 'boolean')],
    ['showMidiNum',                m('Cell text', 'boolean')],
    ['useCenterForRightFunction',  m('Cell text', 'boolean')],
    ['functionSymbols',            m('Cell text', 'string')],
    ['naturalFretWidths',          m('Layout', 'boolean')],
    ['NoteDisplaySizes',           m('Layout', 'object', 'presentationMode')],
    ['naturalFontScaling',         m('Layout', 'string')],
    ['pianoHeightScaleFactor',     m('Piano', 'string')],
    ['pianoWidthScaleFactor',      m('Piano', 'string')],
    ['pianoWhiteToBlackWidthRatio', m('Piano', 'string')],
    ['pianoFingeringHPosition',    m('Piano', 'string')],
    ['hideNamedNotes',             m('Hide', 'boolean')],
    ['hideTinyNotes',              m('Hide', 'boolean')],
    ['hideSingleNotes',            m('Hide', 'boolean')],
    ['hideFingering',              m('Hide', 'boolean')],
    ['showAllNoteNames',           m('Hide', 'boolean')],
    ['namedNoteOpacity',           m('Opacity', 'string')],
    ['singleNoteOpacity',          m('Opacity', 'string')],
    ['tinyNoteOpacity',            m('Opacity', 'string')],
    ['showLooperLightBeats',       m('Looper', 'boolean')],
    ['noteFont',                   m('Fonts', 'string')],
    ['leftSubscriptFontSize',      m('Fonts', 'string')],
    ['rightSubscriptFontSize',     m('Fonts', 'string')],
    ['midiFontSize',               m('Fonts', 'string')],
    ['fingeringFontSize',          m('Fonts', 'string')],
    ['fingeringPosition',          m('Fonts', 'string')],
    ['tinyNoteFontSize',           m('Tiny notes', 'string')],
    ['tinyNoteMaxHeight',          m('Tiny notes', 'string')],
    ['tinyNoteVPosition',          m('Tiny notes', 'string')],
    ['tinyNoteWidth',              m('Tiny notes', 'string')],
    ['tinyNoteHPosition',          m('Tiny notes', 'string')],
    ['tinyNoteRadius',             m('Tiny notes', 'string')]
];

export const DISPLAY_OPTION_META = Object.freeze(Object.fromEntries(
    META_ROWS.map(([key, meta], order) => [key, Object.freeze({
        ...meta,
        order,
        hasDefault: Object.prototype.hasOwnProperty.call(DISPLAY_OPTIONS_DEFAULTS, key)
    })])
));

/** Keys in column order. */
export const DISPLAY_OPTION_KEYS = Object.freeze(META_ROWS.map(([key]) => key));

/** rbHighlight note type (the radio's value) -> the HIDE DisplayOptions key that hides notes of that type.
 *  Highlight types (MidiPitches, MidiPitchesSingle) place no hidden kind, so they are absent. */
export const HIDE_KEY_FOR_NOTE_TYPE = Object.freeze({
    Named: 'hideNamedNotes',
    Single: 'hideSingleNotes',
    Tiny: 'hideTinyNotes',
    Bend: 'hideTinyNotes',
    Fingering: 'hideFingering'
});

/** @returns {string|null} the HIDE key for a note type, or null when that type reveals nothing. */
export function hideKeyForNoteType(noteType) {
    return Object.prototype.hasOwnProperty.call(HIDE_KEY_FOR_NOTE_TYPE, noteType)
        ? HIDE_KEY_FOR_NOTE_TYPE[noteType]
        : null;
}

export function isDisplayOptionKey(key) {
    return Object.prototype.hasOwnProperty.call(DISPLAY_OPTION_META, key);
}

/** The Song flag that must be on for `key` to take part, or null. */
export function adapterGateFor(key) {
    return DISPLAY_OPTION_META[key]?.gate ?? null;
}

function isNumericLike(v) {
    if (typeof v === 'number') return Number.isFinite(v);
    return typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v));
}

/** Equality used for diffs: booleans strictly; scalars by string/number value ("1" == "1.0" == 1);
 *  NoteDisplaySizes by {width,height,NoteFontSize}. */
export function valuesEqual(key, a, b) {
    if (a === undefined || b === undefined) {
        return a === b;
    }
    if (key === 'NoteDisplaySizes') {
        const x = a || {};
        const y = b || {};
        return String(x.width) === String(y.width)
            && String(x.height) === String(y.height)
            && String(x.NoteFontSize) === String(y.NoteFontSize);
    }
    if (typeof a === 'boolean' || typeof b === 'boolean') {
        return a === b;
    }
    if (isNumericLike(a) && isNumericLike(b)) {
        return Number(a) === Number(b);
    }
    return String(a) === String(b);
}

export function cloneValue(value) {
    if (value && typeof value === 'object') {
        return JSON.parse(JSON.stringify(value));
    }
    return value;
}
