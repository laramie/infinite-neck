import { jest } from '@jest/globals';

import * as NoteTableRenderCache from '../../NoteTableRenderCache.js';

const tuning = {
    baseID: 'S6_1',
    frets: 3,
    nut: true,
    reverse: false,
    rowRange: [40]
};

const baseOptions = {
    sharps: true,
    rootID: 0,
    rootIDLead: -1,
    showCellNotes: true,
    showSubscriptFunctions: true,
    cellIsFunction: false,
    showMidiNum: false,
    useCenterForRightFunction: false,
    NoteDisplaySizes: { width: '60px', height: '40px' },
    naturalFretWidths: false,
    naturalFontScaling: 60,
    pianoHeightScaleFactor: 3,
    pianoWidthScaleFactor: 3,
    pianoWhiteToBlackWidthRatio: '2.3'
};

describe('NoteTableRenderCache', () => {
    beforeEach(() => {
        NoteTableRenderCache.__resetForTests();
    });

    test('render key is stable and changes for root changes', () => {
        const left = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            noteNamesFuncArr: ['1', 'b2']
        });
        const right = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1',
            options: { ...baseOptions },
            tuning: { ...tuning },
            noteNamesFuncArr: ['1', 'b2']
        });
        const changed = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1',
            options: { ...baseOptions, rootID: 1 },
            tuning,
            noteNamesFuncArr: ['1', 'b2']
        });

        expect(left).toBe(right);
        expect(changed).not.toBe(left);
    });

    test('createEntry stores default html when midi numbers are hidden', () => {
        const key = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            noteNamesFuncArr: []
        });
        const buildCellHtml = jest.fn(({ noteClass, midinum }) => `${noteClass}:${midinum ?? 'default'}`);

        const entry = NoteTableRenderCache.createEntry({
            key,
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            buildCellHtml
        });

        expect(NoteTableRenderCache.getHtml(entry, 'noteE', '40')).toBe('noteE:default');
        expect(buildCellHtml).toHaveBeenCalledTimes(12);
    });

    test('createEntry stores midi-specific html when midi numbers are shown', () => {
        const options = { ...baseOptions, showMidiNum: true };
        const key = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1',
            options,
            tuning,
            noteNamesFuncArr: []
        });
        const entry = NoteTableRenderCache.createEntry({
            key,
            tableID: 'tblS6_1',
            options,
            tuning,
            buildCellHtml: ({ noteClass, midinum }) => `${noteClass}:${midinum}`
        });

        expect(NoteTableRenderCache.getHtml(entry, 'noteE', '40')).toBe('noteE:40');
        expect(NoteTableRenderCache.getHtml(entry, 'noteF', '41')).toBe('noteF:41');
        expect(NoteTableRenderCache.getHtml(entry, 'noteG', '43')).toBe('noteG:43');
    });

    test('next section prewarm skips random loop and wraps normal loop', () => {
        const song = {
            randomLoop: false,
            getSections: () => [{}, {}, {}],
            getSectionsCurrentIndex: () => 2
        };
        expect(NoteTableRenderCache.getNextSectionIndexForPrewarm(song)).toBe(0);

        song.randomLoop = true;
        expect(NoteTableRenderCache.getNextSectionIndexForPrewarm(song)).toBe(-1);
    });

    test('stats() tracks hits, misses, sets, and evictions', () => {
        const key = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            noteNamesFuncArr: []
        });
        const entry = NoteTableRenderCache.createEntry({
            key,
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            buildCellHtml: ({ noteClass, midinum }) => `${noteClass}:${midinum ?? 'default'}`
        });

        // Miss before the entry is stored.
        expect(NoteTableRenderCache.get(key)).toBeUndefined();
        expect(NoteTableRenderCache.stats()).toMatchObject({ hits: 0, misses: 1, sets: 0, evictions: 0 });

        NoteTableRenderCache.set(key, entry);
        expect(NoteTableRenderCache.get(key)).toBe(entry);
        expect(NoteTableRenderCache.stats()).toMatchObject({ size: 1, hits: 1, misses: 1, sets: 1, evictions: 0 });

        NoteTableRenderCache.setMaxEntries(1);
        NoteTableRenderCache.set('anotherKey', { ...entry, key: 'anotherKey' });
        expect(NoteTableRenderCache.stats()).toMatchObject({ size: 1, sets: 2, evictions: 1 });
    });

    test('wasLastPainted/recordPainted track per-tableID last-painted keys independently', () => {
        expect(NoteTableRenderCache.wasLastPainted('tblS6_1', 'keyA')).toBe(false);

        NoteTableRenderCache.recordPainted('tblS6_1', 'keyA');
        expect(NoteTableRenderCache.wasLastPainted('tblS6_1', 'keyA')).toBe(true);
        expect(NoteTableRenderCache.wasLastPainted('tblS6_1', 'keyB')).toBe(false);
        expect(NoteTableRenderCache.wasLastPainted('tblOther', 'keyA')).toBe(false);

        NoteTableRenderCache.recordPainted('tblS6_1', 'keyB');
        expect(NoteTableRenderCache.wasLastPainted('tblS6_1', 'keyA')).toBe(false);
        expect(NoteTableRenderCache.wasLastPainted('tblS6_1', 'keyB')).toBe(true);

        NoteTableRenderCache.recordPainted('tblOther', 'keyA');
        expect(NoteTableRenderCache.wasLastPainted('tblOther', 'keyA')).toBe(true);
        expect(NoteTableRenderCache.wasLastPainted('tblS6_1', 'keyB')).toBe(true);
    });

    test('clearPaintedTracking clears a single tableID or all tableIDs', () => {
        NoteTableRenderCache.recordPainted('tblS6_1', 'keyA');
        NoteTableRenderCache.recordPainted('tblOther', 'keyB');

        NoteTableRenderCache.clearPaintedTracking('tblS6_1');
        expect(NoteTableRenderCache.wasLastPainted('tblS6_1', 'keyA')).toBe(false);
        expect(NoteTableRenderCache.wasLastPainted('tblOther', 'keyB')).toBe(true);

        NoteTableRenderCache.clearPaintedTracking();
        expect(NoteTableRenderCache.wasLastPainted('tblOther', 'keyB')).toBe(false);
    });

    test('wasLastPainted returns false for empty tableID or key', () => {
        NoteTableRenderCache.recordPainted('tblS6_1', 'keyA');
        expect(NoteTableRenderCache.wasLastPainted('', 'keyA')).toBe(false);
        expect(NoteTableRenderCache.wasLastPainted('tblS6_1', '')).toBe(false);
    });

    test('createEntry omits sizingByColumn entries when buildSizing is not provided', () => {
        const key = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            noteNamesFuncArr: []
        });
        const entry = NoteTableRenderCache.createEntry({
            key,
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            buildCellHtml: () => 'html'
        });

        expect(NoteTableRenderCache.getSizing(entry, 0, false)).toBeUndefined();
        expect(NoteTableRenderCache.getSizing(entry, 1, true)).toBeUndefined();
    });

    test('createEntry precomputes sizingByColumn for every displayed column and nut-ness, keyed by cellcol', () => {
        // tuning: frets=3, nut=true -> 4 columns, displayed cellcol == raw index (non-reverse).
        const key = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            noteNamesFuncArr: []
        });
        const buildSizing = jest.fn(({ cellcol, isNut }) => ({ cellcol, isNut }));
        const entry = NoteTableRenderCache.createEntry({
            key,
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            buildCellHtml: () => 'html',
            buildSizing
        });

        // 4 columns (frets=3 + nut) x 2 (isNut true/false) = 8 calls.
        expect(buildSizing).toHaveBeenCalledTimes(8);
        expect(NoteTableRenderCache.getSizing(entry, 0, false)).toEqual({ cellcol: 0, isNut: false });
        expect(NoteTableRenderCache.getSizing(entry, 0, true)).toEqual({ cellcol: 0, isNut: true });
        expect(NoteTableRenderCache.getSizing(entry, 3, false)).toEqual({ cellcol: 3, isNut: false });
        expect(NoteTableRenderCache.getSizing(entry, 4, false)).toBeUndefined();
    });

    test('createEntry keys sizingByColumn by displayed cellcol (getDisplayedCellcol), not raw loop index, for reverse tunings', () => {
        // reverse + no nut: getDisplayedCellcol(options, c) = frets - c, so raw index 0..frets-1
        // displays as cellcol frets..1, not 0..frets-1. Step D1 must key off the displayed value.
        const reverseTuning = { ...tuning, nut: false, reverse: true };
        const key = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1R',
            options: baseOptions,
            tuning: reverseTuning,
            noteNamesFuncArr: []
        });
        const buildSizing = jest.fn(({ cellcol }) => ({ cellcol }));
        const entry = NoteTableRenderCache.createEntry({
            key,
            tableID: 'tblS6_1R',
            options: baseOptions,
            tuning: reverseTuning,
            buildCellHtml: () => 'html',
            buildSizing
        });

        // frets=3, no nut -> 3 columns, raw index 0..2, displayed cellcol = 3,2,1.
        expect(NoteTableRenderCache.getSizing(entry, 0, false)).toBeUndefined();
        expect(NoteTableRenderCache.getSizing(entry, 1, false)).toEqual({ cellcol: 1 });
        expect(NoteTableRenderCache.getSizing(entry, 2, false)).toEqual({ cellcol: 2 });
        expect(NoteTableRenderCache.getSizing(entry, 3, false)).toEqual({ cellcol: 3 });
    });

    test('getSizing returns undefined for a missing entry or an empty cellcol', () => {
        expect(NoteTableRenderCache.getSizing(null, 0, false)).toBeUndefined();
        expect(NoteTableRenderCache.getSizing(undefined, 0, false)).toBeUndefined();

        const key = NoteTableRenderCache.buildRenderKey({
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            noteNamesFuncArr: []
        });
        const entry = NoteTableRenderCache.createEntry({
            key,
            tableID: 'tblS6_1',
            options: baseOptions,
            tuning,
            buildCellHtml: () => 'html',
            buildSizing: ({ cellcol }) => ({ cellcol })
        });
        expect(NoteTableRenderCache.getSizing(entry, '', false)).toBeUndefined();
        expect(NoteTableRenderCache.getSizing(entry, null, false)).toBeUndefined();
    });
});
