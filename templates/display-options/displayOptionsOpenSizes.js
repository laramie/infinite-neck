/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 it6 round 4: which size values a Song open puts into the size controls.  Pure module (no DOM, no jQuery).
//
// NoteDisplaySizes is one blob: cell width, cell height and the Note font size (and, from Scaling Prefs, the UI font
// size).  At Song open, lowest to highest:
//   1. LIVE (the controls as they are; not handled here: when this returns nothing, LIVE stands)
//   2. the Song-DEFAULTS NoteDisplaySizes cell, even when Presentation Mode is off
//   3. the Browser Scaling Prefs (whole blob; they beat Song-DEFAULTS)
//   4. the Presentation Mode cascade, applied afterwards by the normal Section sync (not handled here)
// Applied once, at Song open.  Navigation and Apply never re-apply 2 or 3.
// The winner replaces the blob as a whole: Scaling Prefs never mix with Song-DEFAULTS values.

/**
 * @param {object}   [input]
 * @param {object|null} [input.songDefaultSizes]  Song-DEFAULTS NoteDisplaySizes: {width, height, NoteFontSize, caption}
 * @param {object|null} [input.prefs]             the stored Scaling Prefs: {UIFontSize, NoteFontSize, CellWidth, CellHeight}
 * @param {string[]} [input.widthOptions]         the option values of the width dropdown
 * @param {string[]} [input.heightOptions]        the option values of the height dropdown
 * @returns {null | {source:'prefs'|'songDefault', width?:string, height?:string, noteFontSize?:number, uiFontSize?:number, skipped:string[]}}
 *   null when neither source has anything (LIVE stands).  A width or height that is not a dropdown option is left
 *   out and named in `skipped`.
 */
export function pickOpenTimeSizes({ songDefaultSizes = null, prefs = null, widthOptions = [], heightOptions = [] } = {}) {
    const prefsUsable = !!prefs && typeof prefs === 'object' && !!prefs.UIFontSize;   // as applyScalingPrefs() judges it
    const songUsable = !!songDefaultSizes && typeof songDefaultSizes === 'object';
    if (!prefsUsable && !songUsable) {
        return null;
    }
    const source = prefsUsable ? 'prefs' : 'songDefault';
    const from = prefsUsable ? 'Scaling Prefs' : 'Song-DEFAULTS';
    const raw = prefsUsable
        ? { width: prefs.CellWidth, height: prefs.CellHeight, noteFontSize: prefs.NoteFontSize, uiFontSize: prefs.UIFontSize }
        : { width: songDefaultSizes.width, height: songDefaultSizes.height, noteFontSize: songDefaultSizes.NoteFontSize };

    const out = { source, skipped: [] };
    const choose = (name, value, options) => {
        if (value === undefined || value === null || value === '') return;
        const text = String(value);
        if (options.map(String).includes(text)) {
            out[name] = text;
        } else {
            out.skipped.push(`${from}: ${name} "${text}" is not a choice in the ${name} dropdown; skipped`);
        }
    };
    choose('width', raw.width, widthOptions);
    choose('height', raw.height, heightOptions);
    if (raw.noteFontSize) out.noteFontSize = raw.noteFontSize;
    if (raw.uiFontSize) out.uiFontSize = raw.uiFontSize;
    return out;
}
