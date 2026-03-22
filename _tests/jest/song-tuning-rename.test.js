import { jest } from '@jest/globals';
import { 
    setupSongTests, 
    getSong, 
    readVersionHeadless 
} from '../../infinite-neck-headless.js';
import {
    setSongProvider,
    findTuningForID,
    generateNextTuningID,
    getAllTunings,
    getMyTunings,
    TABLE_ID_PREFIX
} from '../../TableBuilder.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFreshHeadlessSong() {
    setupSongTests();
    getSong().setHeadless(true, true);
    return getSong();
}

/**
 * Wire TableBuilder's song provider to the current test song and return it.
 * This mirrors the pattern used in infinite-neck.js / installModuleProviders.
 */
function wireSongProvider(song) {
    setSongProvider(() => song);
    return song;
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
    if (!section.noteTables) section.noteTables = {};
    section.noteTables[tableKey] = notes;
}

// ---------------------------------------------------------------------------
// generateNextTuningID
// ---------------------------------------------------------------------------

describe('generateNextTuningID', () => {
    beforeEach(() => {
        const song = createFreshHeadlessSong();
        wireSongProvider(song);
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

// ---------------------------------------------------------------------------
// Clone → seed notes → rename: pure model path
// ---------------------------------------------------------------------------

describe('renameTuningIDInModel: pure model rename', () => {
    let song;

    beforeEach(() => {
        song = createFreshHeadlessSong();
        wireSongProvider(song);
        song.myTunings = [];
        // Give the song a single plain section with no notes
        song.sections[0].noteTables = {};
        song.visibleNoteTables = [];
    });

    test('renames the noteTables key in the section', () => {
        cloneTuningHeadless(song, 'P46', 'P46_1');
        seedNotesInSection0(song, TABLE_ID_PREFIX + 'P46_1', [{ beat: 1 }]);
        song.visibleNoteTables = [TABLE_ID_PREFIX + 'P46_1'];

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        const section = song.getSections()[0];
        expect(section.noteTables).not.toHaveProperty(TABLE_ID_PREFIX + 'P46_1');
        expect(section.noteTables).toHaveProperty(TABLE_ID_PREFIX + 'P46_lead');
    });

    test('preserves the note data during rename', () => {
        cloneTuningHeadless(song, 'P46', 'P46_1');
        const notes = [{ beat: 1, string: 0, fret: 3 }];
        seedNotesInSection0(song, TABLE_ID_PREFIX + 'P46_1', notes);

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        const section = song.getSections()[0];
        expect(section.noteTables[TABLE_ID_PREFIX + 'P46_lead']).toEqual(notes);
    });

    test('updates visibleNoteTables to reflect the new key', () => {
        cloneTuningHeadless(song, 'P46', 'P46_1');
        song.visibleNoteTables = [TABLE_ID_PREFIX + 'P46_1'];

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        expect(song.visibleNoteTables).not.toContain(TABLE_ID_PREFIX + 'P46_1');
        expect(song.visibleNoteTables).toContain(TABLE_ID_PREFIX + 'P46_lead');
    });

    test('is a no-op in sections that do not have the old key', () => {
        // Section 0 has a different table; old key doesn't exist there
        seedNotesInSection0(song, TABLE_ID_PREFIX + 'S6', [{ beat: 1 }]);

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        const section = song.getSections()[0];
        expect(section.noteTables).toHaveProperty(TABLE_ID_PREFIX + 'S6');
        expect(section.noteTables).not.toHaveProperty(TABLE_ID_PREFIX + 'P46_lead');
    });

    test('renames across multiple sections', () => {
        // Add a second section
        const second = song.constructSection();
        second.noteTables = {};
        song.addSection(second);

        const notes0 = [{ beat: 1 }];
        const notes1 = [{ beat: 2 }];
        seedNotesInSection0(song, TABLE_ID_PREFIX + 'P46_1', notes0);
        song.getSections()[1].noteTables[TABLE_ID_PREFIX + 'P46_1'] = notes1;

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        expect(song.getSections()[0].noteTables).toHaveProperty(TABLE_ID_PREFIX + 'P46_lead');
        expect(song.getSections()[1].noteTables).toHaveProperty(TABLE_ID_PREFIX + 'P46_lead');
        expect(song.getSections()[0].noteTables[TABLE_ID_PREFIX + 'P46_lead']).toEqual(notes0);
        expect(song.getSections()[1].noteTables[TABLE_ID_PREFIX + 'P46_lead']).toEqual(notes1);
    });

    test('does not touch visibleNoteTables when old key is absent', () => {
        song.visibleNoteTables = [TABLE_ID_PREFIX + 'S6'];

        song.renameTuningIDInModel('P46_1', 'P46_lead');

        expect(song.visibleNoteTables).toEqual([TABLE_ID_PREFIX + 'S6']);
    });
});

// ---------------------------------------------------------------------------
// End-to-end headless scenario: Clone → seed notes → rename → JSON round-trip
// ---------------------------------------------------------------------------

describe('headless Clone → use → rename scenario', () => {
    let song;

    beforeEach(() => {
        song = createFreshHeadlessSong();
        wireSongProvider(song);
        song.myTunings = [];
        song.sections[0].noteTables = {};
        song.visibleNoteTables = [];
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
        seedNotesInSection0(song, TABLE_ID_PREFIX + 'P46_1', notes);
        song.visibleNoteTables = [TABLE_ID_PREFIX + 'P46_1'];

        // Step 4: Rename via model method and sync the myTunings entry
        song.renameTuningIDInModel('P46_1', 'P46_lead');
        song.myTunings[0].baseID = 'P46_lead';

        // Step 5: Verify model consistency
        const section = song.getSections()[0];
        expect(section.noteTables).toHaveProperty(TABLE_ID_PREFIX + 'P46_lead');
        expect(section.noteTables).not.toHaveProperty(TABLE_ID_PREFIX + 'P46_1');
        expect(section.noteTables[TABLE_ID_PREFIX + 'P46_lead']).toEqual(notes);
        expect(song.visibleNoteTables).toContain(TABLE_ID_PREFIX + 'P46_lead');
        expect(song.visibleNoteTables).not.toContain(TABLE_ID_PREFIX + 'P46_1');
        expect(song.myTunings[0].baseID).toBe('P46_lead');

        // Step 6: JSON round-trip — renamed key survives serialisation
        const jsonText = JSON.stringify(song);
        const restored = JSON.parse(jsonText);
        expect(restored.sections[0].noteTables).toHaveProperty(TABLE_ID_PREFIX + 'P46_lead');
        expect(restored.visibleNoteTables).toContain(TABLE_ID_PREFIX + 'P46_lead');
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
