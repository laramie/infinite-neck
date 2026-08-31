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
});
