// Sprint 148 Iteration 6 round 4: which sizes a Song open puts into the size controls.  Pure module; no DOM.
import { pickOpenTimeSizes } from '../../templates/display-options/displayOptionsOpenSizes.js';
import { resolveDisplayOptions } from '../../templates/display-options/displayOptionsResolver.js';
import { buildLegendHtml } from '../../templates/display-options/displayOptionsMatrixView.js';

const widthOptions = ['60px', '80px', '100px', '140px'];
const heightOptions = ['20px', '30px', '40px'];
const songSizes = { caption: '80x40:12', width: '80px', height: '40px', NoteFontSize: 12 };
const prefs = { UIFontSize: 14, NoteFontSize: 16, CellWidth: '140px', CellHeight: '30px' };
const pick = (input) => pickOpenTimeSizes({ widthOptions, heightOptions, ...input });

describe('pickOpenTimeSizes', () => {
    test('nothing from either source: null, so LIVE stands', () => {
        expect(pick({})).toBeNull();
        expect(pick({ songDefaultSizes: null, prefs: null })).toBeNull();
        expect(pickOpenTimeSizes()).toBeNull();
    });

    test('Song-DEFAULTS alone: the blob, as strings, with no UI font size', () => {
        expect(pick({ songDefaultSizes: songSizes })).toEqual({
            source: 'songDefault', width: '80px', height: '40px', noteFontSize: 12, skipped: []
        });
    });

    test('Scaling Prefs alone', () => {
        expect(pick({ prefs })).toEqual({
            source: 'prefs', width: '140px', height: '30px', noteFontSize: 16, uiFontSize: 14, skipped: []
        });
    });

    test('Prefs beat Song-DEFAULTS as a whole blob (no mixing)', () => {
        const out = pick({ songDefaultSizes: songSizes, prefs });
        expect(out.source).toBe('prefs');
        expect(out).toEqual({ source: 'prefs', width: '140px', height: '30px', noteFontSize: 16, uiFontSize: 14, skipped: [] });
    });

    test('Prefs without UIFontSize are not usable (same test as applyScalingPrefs), so Song-DEFAULTS stand', () => {
        const out = pick({ songDefaultSizes: songSizes, prefs: { CellWidth: '140px', CellHeight: '30px', NoteFontSize: 16 } });
        expect(out.source).toBe('songDefault');
        expect(out.width).toBe('80px');
    });

    test('H6: a width or height that is not a dropdown option is skipped and named; the rest still applies', () => {
        const out = pick({ songDefaultSizes: { ...songSizes, width: '999px' } });
        expect(out.width).toBeUndefined();
        expect(out.height).toBe('40px');
        expect(out.noteFontSize).toBe(12);
        expect(out.skipped).toEqual(['Song-DEFAULTS: width "999px" is not a choice in the width dropdown; skipped']);

        const fromPrefs = pick({ prefs: { ...prefs, CellHeight: '77px' } });
        expect(fromPrefs.height).toBeUndefined();
        expect(fromPrefs.skipped[0]).toContain('Scaling Prefs: height "77px"');
    });

    test('a partial Song-DEFAULTS blob applies only what it has', () => {
        const out = pick({ songDefaultSizes: { width: '60px' } });
        expect(out).toEqual({ source: 'songDefault', width: '60px', skipped: [] });
    });
});

describe('how this fits the resolver (Song-DEFAULTS sizes are open-time only; it8: navigation never pushes a non-automated Song-DEFAULTS key)', () => {
    const song = (presentationMode) => ({
        presentationMode,
        allowThemeAutomation: false,
        displayOptionsDefault: { NoteDisplaySizes: songSizes },
        sections: [{ displayOptions: { noteFont: 'Cardo' } }, {}]
    });

    test('Presentation Mode off: navigation does not apply Song-DEFAULTS sizes (open-time only)', () => {
        for (const idx of [0, 1]) {
            const { values, entries } = resolveDisplayOptions(song(false), idx, { purpose: 'apply' });
            expect('NoteDisplaySizes' in values).toBe(false);
            expect(entries.NoteDisplaySizes.source).toBe('blocked');
        }
    });

    test('Presentation Mode on: the open push applies Song-DEFAULTS sizes (after the open-time step); navigation does not', () => {
        const open = resolveDisplayOptions(song(true), 1, { purpose: 'open' });
        expect(open.values.NoteDisplaySizes.width).toBe('80px');
        expect(open.entries.NoteDisplaySizes.source).toBe('songDefault');
        const nav = resolveDisplayOptions(song(true), 1, { purpose: 'apply' });
        expect('NoteDisplaySizes' in nav.values).toBe(false);
    });

    test('Presentation Mode off: the open push drops the sizes too (adapter gate)', () => {
        const open = resolveDisplayOptions(song(false), 0, { purpose: 'open' });
        expect('NoteDisplaySizes' in open.values).toBe(false);
    });

    test('the Legend tells the author when Song-DEFAULTS sizes apply', () => {
        const html = buildLegendHtml();
        expect(html).toContain('applied <b>once, when the Song opens</b>');
        expect(html).toContain('Browser Scaling Prefs');
    });
});
