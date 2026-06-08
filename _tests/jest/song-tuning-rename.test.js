import { jest } from '@jest/globals';
import * as Constants from '../../Constants.js';

import { 
    setupSongTests, 
    getSong, 
} from '../../infinite-neck-headless.js';
import {
    applyTuningVisibilityToggle,
    findTuningForID,
    generateNextTuningID,
    removeMyTuning,
    validateSongTuningDraft
} from '../../TuningsLibrary.js';
import EventBus from '../../event-bus.js';
 


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFreshHeadlessSong() {
    if (typeof globalThis.$ !== 'function') {
        globalThis.$ = () => ({
            each() {
                return this;
            }
        });
    }
    setupSongTests();
    getSong().setHeadless(true, true);
    return getSong();
}

/**
 * Clone a tuning from allTunings into song.myTunings with a new baseID,
 * using the pure-object path (no DOM).
 */
function cloneTuningHeadless(song, sourceBaseID, newBaseID) {
    const original = findTuningForID(sourceBaseID);
    if (!original) throw new Error('Source tuning not found: ' + sourceBaseID);
    const clone = Object.assign({}, original, { baseID: newBaseID, instance: true });
    if (!Array.isArray(song.myTunings)) song.myTunings = [];
    song.myTunings.push(clone);
    return clone;
}

/**
 * Seed notes for a given table key in section 0 of the song.
 */
function seedNotesInSection0(song, tableKey, notes) {
    const section = song.getSections()[0];
    section.getSectionNotes(tableKey).playedNotes = notes;
}

// ---------------------------------------------------------------------------
// generateNextTuningID
// ---------------------------------------------------------------------------

describe('generateNextTuningID', () => {
    beforeEach(() => {
        const song = createFreshHeadlessSong();
        //wireSongProvider(song);
        song.myTunings = [];
    });

    test('generates _1 suffix when no clones exist yet', () => {
        expect(generateNextTuningID('S6')).toBe('S6_1');
    });

    test('generates _1 suffix for a different base ID with no clones', () => {
        expect(generateNextTuningID('P46')).toBe('P46_1');
    });

    test('increments past existing _1 to produce _2', () => {
        const song = getSong();
        song.myTunings = [{ baseID: 'S6_1' }];
        expect(generateNextTuningID('S6')).toBe('S6_2');
    });

    test('finds the max suffix and increments by one', () => {
        const song = getSong();
        song.myTunings = [
            { baseID: 'S6_1' },
            { baseID: 'S6_3' },
            { baseID: 'S6_2' }
        ];
        expect(generateNextTuningID('S6')).toBe('S6_4');
    });

    test('does not count clones of a different base ID', () => {
        const song = getSong();
        song.myTunings = [{ baseID: 'P46_1' }, { baseID: 'P46_2' }];
        // S6 has no clones yet
        expect(generateNextTuningID('S6')).toBe('S6_1');
    });

    test('an ID ending with _ uses itself as the prefix; double-underscore clones have NaN suffix so counter resets to 1', () => {
        // S6_ as baseID → prefix is 'S6_' (no extra _ added).
        // S6__1 starts with 'S6_', but its suffix is '_1' → parseInt('_1') === NaN → not counted.
        // Result: no recognized clones → returns 'S6_1'.
        const song = getSong();
        song.myTunings = [{ baseID: 'S6__1' }];
        expect(generateNextTuningID('S6_')).toBe('S6_1');
    });
});

describe('validateSongTuningDraft', () => {
    beforeEach(() => {
        const song = createFreshHeadlessSong();
        song.myTunings = [];
    });

    test('accepts a brand-new lineage for a new custom tuning', () => {
        const result = validateSongTuningDraft({
            baseID: 'LarP5_mark',
            fromBaseID: 'P5',
            caption: 'P5',
            baseInstrument: 'Guitar',
            rowRange: [75, 68, 61, 54, 47, 40],
            banjoNut: {}
        });

        expect(result.valid).toBe(true);
        expect(result.normalizedDraft.nStrings).toBe(6);
    });

    test('rejects duplicate song tuning IDs', () => {
        const song = getSong();
        song.myTunings = [{ baseID: 'LarP5_mark', fromBaseID: 'P5', rowRange: [75, 68, 61, 54, 47, 40], nStrings: 6, baseInstrument: 'Guitar' }];

        const result = validateSongTuningDraft({
            baseID: 'LarP5_mark',
            fromBaseID: 'P5',
            caption: 'P5',
            baseInstrument: 'Guitar',
            rowRange: [75, 68, 61, 54, 47, 40],
            banjoNut: {}
        });

        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/already exists/);
    });

    test('rejects lineage reuse when an existing library lineage has a different rowRange', () => {
        const result = validateSongTuningDraft({
            baseID: 'BrokenP46_mark',
            fromBaseID: 'P46',
            caption: 'Broken P4',
            baseInstrument: 'Guitar',
            rowRange: [64, 59, 55, 50, 46, 40],
            banjoNut: {}
        });

        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/different MIDI rowRange/);
    });

    test('rejects lineage IDs that conflict with an existing song tuning ID', () => {
        const song = getSong();
        song.myTunings = [{ baseID: 'LarP5_mark', fromBaseID: 'P5', rowRange: [75, 68, 61, 54, 47, 40], nStrings: 6, baseInstrument: 'Guitar' }];

        const result = validateSongTuningDraft({
            baseID: 'LarP5_jimmy',
            fromBaseID: 'LarP5_mark',
            caption: 'P5',
            baseInstrument: 'Guitar',
            rowRange: [75, 68, 61, 54, 47, 40],
            banjoNut: {}
        });

        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/conflicts with an existing tuning ID/);
    });
});

// ---------------------------------------------------------------------------
// Clone → seed notes → rename: pure model path
// ---------------------------------------------------------------------------

describe('renameTuningIDInModel: pure model rename', () => {
    let song;

    beforeEach(() => {
        song = createFreshHeadlessSong();
        //wireSongProvider(song);
        song.myTunings = [];
        song.noteTablesLayout = [];
    });

    test('renames the sectionNotesByTable key in the section', () => {
        cloneTuningHeadless(song, 'P46', 'P46_1');
        seedNotesInSection0(song, Constants.TABLE_ID_PREFIX + 'P46_1', [{ beat: 1 }]);
        song.setNoteTablesLayout([{ tableID: Constants.TABLE_ID_PREFIX + 'P46_1', visible: true }]);

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        const section = song.getSections()[0];
        expect(section.sectionNotesByTable).not.toHaveProperty(Constants.TABLE_ID_PREFIX + 'P46_1');
        expect(section.sectionNotesByTable).toHaveProperty(Constants.TABLE_ID_PREFIX + 'P46_lead');
    });

    test('preserves the note data during rename', () => {
        cloneTuningHeadless(song, 'P46', 'P46_1');
        const notes = [{ beat: 1, string: 0, fret: 3 }];
        seedNotesInSection0(song, Constants.TABLE_ID_PREFIX + 'P46_1', notes);

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        const section = song.getSections()[0];
        expect(section.sectionNotesByTable[Constants.TABLE_ID_PREFIX + 'P46_lead'].playedNotes).toEqual(notes);
    });

    test('preserves tonalSourceSet during rename', () => {
        cloneTuningHeadless(song, 'P46', 'P46_1');
        const section = song.getSections()[0];
        section.getSectionNotes(Constants.TABLE_ID_PREFIX + 'P46_1').tonalSourceSet = 'TinyNote';

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        expect(section.sectionNotesByTable[Constants.TABLE_ID_PREFIX + 'P46_lead'].tonalSourceSet).toBe('TinyNote');
    });

    test('updates noteTablesLayout to reflect the new key', () => {
        cloneTuningHeadless(song, 'P46', 'P46_1');
        song.setNoteTablesLayout([{ tableID: Constants.TABLE_ID_PREFIX + 'P46_1', visible: true }]);

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        const layoutTableIDs = song.getNoteTablesLayout().map((entry) => entry.tableID);
        expect(layoutTableIDs).not.toContain(Constants.TABLE_ID_PREFIX + 'P46_1');
        expect(layoutTableIDs).toContain(Constants.TABLE_ID_PREFIX + 'P46_lead');
    });

    test('is a no-op in sections that do not have the old key', () => {
        // Section 0 has a different table; old key doesn't exist there
        seedNotesInSection0(song, Constants.TABLE_ID_PREFIX + 'S6', [{ beat: 1 }]);

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        const section = song.getSections()[0];
        expect(section.sectionNotesByTable).toHaveProperty(Constants.TABLE_ID_PREFIX + 'S6');
        expect(section.sectionNotesByTable).not.toHaveProperty(Constants.TABLE_ID_PREFIX + 'P46_lead');
    });

    test('renames across multiple sections', () => {
        // Add a second section
        const second = song.constructSection();
        song.addSection(second);

        const notes0 = [{ beat: 1 }];
        const notes1 = [{ beat: 2 }];
        seedNotesInSection0(song, Constants.TABLE_ID_PREFIX + 'P46_1', notes0);
        song.getSections()[1].getSectionNotes(Constants.TABLE_ID_PREFIX + 'P46_1').playedNotes = notes1;

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        expect(song.getSections()[0].sectionNotesByTable).toHaveProperty(Constants.TABLE_ID_PREFIX + 'P46_lead');
        expect(song.getSections()[1].sectionNotesByTable).toHaveProperty(Constants.TABLE_ID_PREFIX + 'P46_lead');
        expect(song.getSections()[0].sectionNotesByTable[Constants.TABLE_ID_PREFIX + 'P46_lead'].playedNotes).toEqual(notes0);
        expect(song.getSections()[1].sectionNotesByTable[Constants.TABLE_ID_PREFIX + 'P46_lead'].playedNotes).toEqual(notes1);
    });

        test('removing a tuning also removes wirings that reference its table', () => {
            song.myTunings = [
                { baseID: 'DEV_1' },
                { baseID: 'DEV_2' }
            ];
            song.setNoteTablesLayout([
                { tableID: Constants.TABLE_ID_PREFIX + 'DEV_1', visible: true },
                { tableID: Constants.TABLE_ID_PREFIX + 'DEV_2', visible: true }
            ]);
            song.wirings = [
                {
                    tablename: Constants.TABLE_ID_PREFIX + 'DEV_2',
                    relativeSection: '',
                    listenToTablename: Constants.TABLE_ID_PREFIX + 'DEV_1'
                },
                {
                    tablename: Constants.TABLE_ID_PREFIX + 'DEV_1',
                    relativeSection: '',
                    listenToTablename: Constants.TABLE_ID_PREFIX + 'DEV_2'
                }
            ];
            // Simulate stale empty section table entry that can leak into /cn and wiring picker.
            song.getSections()[0].getSectionNotes(Constants.TABLE_ID_PREFIX + 'DEV_1');

            const removed = removeMyTuning('DEV_1');

            expect(removed).toBe(true);
            expect(song.myTunings.map((t) => t.baseID)).toEqual(['DEV_2']);
            expect(song.getNoteTablesLayout().map((entry) => entry.tableID)).toEqual([
                Constants.TABLE_ID_PREFIX + 'DEV_2'
            ]);
            expect(song.wirings).toEqual([]);
            expect(song.getSections()[0].sectionNotesByTable).not.toHaveProperty(Constants.TABLE_ID_PREFIX + 'DEV_1');
            expect(song.getAllModelTableIDs()).not.toContain(Constants.TABLE_ID_PREFIX + 'DEV_1');
        });

    test('does not touch noteTablesLayout when old key is absent', () => {
        song.setNoteTablesLayout([{ tableID: Constants.TABLE_ID_PREFIX + 'S6', visible: true }]);

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        expect(song.getNoteTablesLayout()).toEqual([{ tableID: Constants.TABLE_ID_PREFIX + 'S6', visible: true }]);
    });

    test('updates wirings source and listener table IDs during rename', () => {
        song.wirings = [
            {
                tablename: Constants.TABLE_ID_PREFIX + 'DEV_2',
                relativeSection: '',
                listenToTablename: Constants.TABLE_ID_PREFIX + 'DEV_1'
            },
            {
                tablename: Constants.TABLE_ID_PREFIX + 'DEV_1',
                relativeSection: '',
                listenToTablename: Constants.TABLE_ID_PREFIX + 'DEV_2'
            }
        ];

        song.renameTuningIDInModel('DEV_1', 'DEV_moved');

        expect(song.wirings).toEqual([
            {
                tablename: Constants.TABLE_ID_PREFIX + 'DEV_2',
                relativeSection: '',
                listenToTablename: Constants.TABLE_ID_PREFIX + 'DEV_moved'
            },
            {
                tablename: Constants.TABLE_ID_PREFIX + 'DEV_moved',
                relativeSection: '',
                listenToTablename: Constants.TABLE_ID_PREFIX + 'DEV_2'
            }
        ]);
    });
});

// ---------------------------------------------------------------------------
// End-to-end headless scenario: Clone → seed notes → rename → JSON round-trip
// ---------------------------------------------------------------------------

describe('headless Clone → use → rename scenario', () => {
    let song;

    beforeEach(() => {
        song = createFreshHeadlessSong();
        //wireSongProvider(song);
        song.myTunings = [];
        song.noteTablesLayout = [];
    });

    test('full scenario: clone P46 → seed notes → rename → model is consistent', () => {
        // Step 1: Clone P46 into myTunings as P46_1
        const newID = generateNextTuningID('P46');  // 'P46_1'
        expect(newID).toBe('P46_1');

        cloneTuningHeadless(song, 'P46', newID);
        expect(song.myTunings.length).toBe(1);
        expect(song.myTunings[0].baseID).toBe('P46_1');

        // Step 2: The clone is visible in getAllTunings
        const cloneInAll = findTuningForID('P46_1');
        expect(cloneInAll).not.toBeNull();
        expect(cloneInAll.baseID).toBe('P46_1');

        // Step 3: Seed notes into the song under the clone's table key
        const notes = [{ beat: 1, string: 2, fret: 5 }];
        seedNotesInSection0(song, Constants.TABLE_ID_PREFIX + 'P46_1', notes);
        song.setNoteTablesLayout([{ tableID: Constants.TABLE_ID_PREFIX + 'P46_1', visible: true }]);

        // Step 4: Rename via model method and sync the myTunings entry
        song.renameTuningIDInModel('P46_1', 'P46_lead');
        song.myTunings[0].baseID = 'P46_lead';

        // Step 5: Verify model consistency
        const section = song.getSections()[0];
        expect(section.sectionNotesByTable).toHaveProperty(Constants.TABLE_ID_PREFIX + 'P46_lead');
        expect(section.sectionNotesByTable).not.toHaveProperty(Constants.TABLE_ID_PREFIX + 'P46_1');
        expect(section.sectionNotesByTable[Constants.TABLE_ID_PREFIX + 'P46_lead'].playedNotes).toEqual(notes);
        const layoutTableIDs = song.getNoteTablesLayout().map((entry) => entry.tableID);
        expect(layoutTableIDs).toContain(Constants.TABLE_ID_PREFIX + 'P46_lead');
        expect(layoutTableIDs).not.toContain(Constants.TABLE_ID_PREFIX + 'P46_1');
        expect(song.myTunings[0].baseID).toBe('P46_lead');

        // Step 6: JSON round-trip — renamed key survives serialisation
        const jsonText = JSON.stringify(song);
        const restored = JSON.parse(jsonText);
        expect(restored.sections[0].sectionNotesByTable).toHaveProperty(Constants.TABLE_ID_PREFIX + 'P46_lead');
        expect(restored.noteTablesLayout).toContainEqual({ tableID: Constants.TABLE_ID_PREFIX + 'P46_lead', visible: true });
        expect(restored.myTunings[0].baseID).toBe('P46_lead');
    });

    test('cloning twice produces P46_1 then P46_2', () => {
        const id1 = generateNextTuningID('P46');
        cloneTuningHeadless(song, 'P46', id1);

        const id2 = generateNextTuningID('P46');
        cloneTuningHeadless(song, 'P46', id2);

        expect(id1).toBe('P46_1');
        expect(id2).toBe('P46_2');
        expect(song.myTunings.length).toBe(2);
    });

    test('rename then clone produces the next available suffix', () => {
        // Clone → rename from _1 to _lead → clone again should still give _2
        const id1 = generateNextTuningID('P46');
        cloneTuningHeadless(song, 'P46', id1);   // P46_1 in myTunings
        song.renameTuningIDInModel('P46_1', 'P46_lead');
        song.myTunings[0].baseID = 'P46_lead';

        // P46_lead no longer starts with 'P46_', so next clone slot is _1 again
        const id2 = generateNextTuningID('P46');
        expect(id2).toBe('P46_1');
    });
});

describe('tuning visibility toggle repaint behavior', () => {
    let song;

    beforeEach(() => {
        song = createFreshHeadlessSong();
        jest.spyOn(EventBus, 'trigger').mockImplementation((eventName) => {
            // Keep the test focused on repaint behavior and avoid DOM wiring side effects.
            if (eventName === 'UpdateAllWiringSelects') {
                return;
            }
        });
        globalThis.$ = () => ({
            prop() { return this; },
            show() { return this; },
            hide() { return this; },
            each() { return this; },
            removeClass() { return this; },
            addClass() { return this; }
        });
        song.myTunings = [];
        song.noteTablesLayout = [];
        song.requestUiClearAll = jest.fn();
        song.requestUiReplay = jest.fn();
        song.requestUiResetNoteNames = jest.fn();
        song.requestUiShowBeats = jest.fn();
        song.publish_UpdateSectionStatus = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('showing a hidden tuning triggers one immediate repaint cycle', () => {
        cloneTuningHeadless(song, 'P46', 'P46_1');

        applyTuningVisibilityToggle('P46_1', true);

        expect(song.requestUiClearAll).toHaveBeenCalledTimes(1);
        expect(song.requestUiResetNoteNames).toHaveBeenCalledTimes(1);
        expect(song.requestUiShowBeats).toHaveBeenCalledTimes(1);
        expect(song.publish_UpdateSectionStatus).toHaveBeenCalledTimes(1);
    });

    test('hiding a tuning does not trigger repaint cycle', () => {
        cloneTuningHeadless(song, 'P46', 'P46_1');

        applyTuningVisibilityToggle('P46_1', false);

        expect(song.requestUiClearAll).not.toHaveBeenCalled();
        expect(song.requestUiResetNoteNames).not.toHaveBeenCalled();
        expect(song.requestUiShowBeats).not.toHaveBeenCalled();
        expect(song.publish_UpdateSectionStatus).not.toHaveBeenCalled();
    });
});
