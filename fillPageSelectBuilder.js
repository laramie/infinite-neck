import { FILL_CHORD_OPTIONS, FILL_SCALE_OPTIONS } from './Constants.js';

function buildOptionsHtml(options = []) {
    return options.map((option) => `<option value="${option.value}">${option.caption}</option>`).join('');
}

export function installFillPageSelects() {
    const chordSelect = $('#dropDownChords');
    if (chordSelect.length > 0) {
        chordSelect.html(buildOptionsHtml(FILL_CHORD_OPTIONS));
    }

    const scaleSelect = $('#dropDownScales');
    if (scaleSelect.length > 0) {
        scaleSelect.html(buildOptionsHtml(FILL_SCALE_OPTIONS));
    }
}

export function getFillSelectOptionCollections() {
    return {
        chords: FILL_CHORD_OPTIONS.map((option) => ({ ...option })),
        scales: FILL_SCALE_OPTIONS.map((option) => ({ ...option }))
    };
}