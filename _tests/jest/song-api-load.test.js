import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { jest } from '@jest/globals';
import {
    setupSongTests,
    getSong,
    skipColorDictsReplacer
} from '../../infinite-neck.js';
import EventBus from '../../event-bus.js';
import { Song, makeSong } from '../../song.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_SONG_FILENAME = 'All-Chords-All-Keys-w-highlights.json';
const SECONDARY_SONG_FILENAME = 'snake.json';

const LOADED_SONG_FIXTURES = [
    {
        label: PRIMARY_SONG_FILENAME,
        filename: PRIMARY_SONG_FILENAME
    },
    {
        label: SECONDARY_SONG_FILENAME,
        filename: SECONDARY_SONG_FILENAME
    }
];

function getSongPath(songFilename = PRIMARY_SONG_FILENAME) {
    return path.join(__dirname, '../../songs', songFilename);
}

function readSongJson(songFilename = PRIMARY_SONG_FILENAME) {
    return JSON.parse(fs.readFileSync(getSongPath(songFilename), 'utf8'));
}

function loadSongForApiTests(songFilename = PRIMARY_SONG_FILENAME) {
    const data = readSongJson(songFilename);

    setupSongTests();
    getSong().setHeadless(true, true);
    getSong().addSections(data);

    return {
        data,
        song: getSong()
    };
}

function getLastSectionIndex(song) {
    return song.getSections().length - 1;
}

function createFreshHeadlessSong() {
    setupSongTests();
    getSong().setHeadless(true, true);
    return getSong();
}

function createSectionWithCaption(song, caption) {
    const section = song.constructSection();
    section.caption = caption;
    return section;
}

function seedSongWithCaptionedSections(song, captions) {
    song.sections = [];
    song.gSectionsCurrentIndex = 0;
    captions.forEach((caption) => song.addSection(createSectionWithCaption(song, caption)));
}

function projectToShape(candidate, shape) {
    if (Array.isArray(shape)) {
        if (!Array.isArray(candidate)) return [];
        return shape.map((item, idx) => projectToShape(candidate[idx], item));
    }
    if (shape && typeof shape === 'object') {
        const out = {};
        Object.keys(shape).forEach((key) => {
            out[key] = projectToShape(candidate ? candidate[key] : undefined, shape[key]);
        });
        return out;
    }
    return candidate;
}



describe('Song JSON round-trip save path', () => {
    test.each(LOADED_SONG_FIXTURES)('load $label -> prepareForSave -> stringify(replacer) produces equivalent saved shape', ({ filename }) => {
        const data = readSongJson(filename);
        const song = createFreshHeadlessSong();
        song.addSections(data);
        song.prepareForSave({
            visibleTableIds:      data.visibleNoteTables ?? [],
            songName:             data.songName,
            theme:                data.theme,
            bpm:                  parseInt(data.defaultBPM, 10),
            userColors:           data.userColors,
            userInstrumentTuning: data.userInstrumentTuning
        });

        const savedText = JSON.stringify(getSong(), skipColorDictsReplacer, 2);
        const savedObj = JSON.parse(savedText);

        const expectedSavedShape = JSON.parse(JSON.stringify(data, skipColorDictsReplacer, 2));
        const actualComparable = projectToShape(savedObj, expectedSavedShape);

        // tunings is derived from visibleNoteTables but each tuning object carries a runtime
        // `visible` flag (DOM visibility state) that is always false in a headless test.
        // visibleNoteTables covers the real persistence contract; tunings is a denormalization.
        delete expectedSavedShape.tunings;
        delete actualComparable.tunings;

        expect(actualComparable).toEqual(expectedSavedShape);
    });
});

describe('Song API bootstrap from JSON', () => {
    test.each(LOADED_SONG_FIXTURES)('loads $label into the Song model', ({ filename }) => {
        const { data, song } = loadSongForApiTests(filename);

        expect(Array.isArray(data.sections)).toBe(true);
        expect(data.sections.length).toBeGreaterThan(0);
        expect(song.getSections().length).toBe(data.sections.length);
    });

    test.each(LOADED_SONG_FIXTURES)('leaves $label ready for headless API tests', ({ filename }) => {
        const { data, song } = loadSongForApiTests(filename);

        expect(song.isHeadless).toBe(true);
        expect(song.getCurrentSection()).toBe(song.getSections()[song.getSectionsCurrentIndex()]);
        expect(song.getSectionsCurrentIndex()).toBe(data.sections.length - 1);
        expect(song.getCurrentSection()).toHaveProperty('caption');
        expect(song.getCurrentSection()).toHaveProperty('namedNotes');
        expect(song.getCurrentSection()).toHaveProperty('noteTables');
    });

    test.each(LOADED_SONG_FIXTURES)('revives loaded sections with Section methods for $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);
        const section = song.getSections()[0];

        expect(typeof section.getRootKey).toBe('function');
        expect(typeof section.getRootNoteName).toBe('function');
        expect(typeof section.getTableArr).toBe('function');
        expect(typeof section.isEmpty).toBe('function');
    });
});

describe('Song API on loaded JSON', () => {
    test.each(LOADED_SONG_FIXTURES)('getCurrentSection returns the section at the current index after loading $label', ({ filename }) => {
        const { data, song } = loadSongForApiTests(filename);
        const lastIndex = getLastSectionIndex(song);

        expect(song.getSectionsCurrentIndex()).toBe(lastIndex);
        expect(song.getCurrentSection()).toBe(song.getSections()[lastIndex]);
        expect(song.getCurrentSection()).toBe(data.sections[lastIndex]);
    });

    test.each(LOADED_SONG_FIXTURES)('gotoSection selects a valid section and ignores an invalid one for $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);
        const targetIndex = 1;
        const originalLastIndex = getLastSectionIndex(song);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        song.gotoSection(targetIndex);
        expect(song.getSectionsCurrentIndex()).toBe(targetIndex);
        expect(song.getCurrentSection()).toBe(song.getSections()[targetIndex]);

        song.gotoSection(999999);
        expect(song.getSectionsCurrentIndex()).toBe(targetIndex);
        expect(warnSpy).toHaveBeenCalled();

        song.gotoSection(originalLastIndex);
        expect(song.getSectionsCurrentIndex()).toBe(originalLastIndex);

        warnSpy.mockRestore();
    });

    test.each(LOADED_SONG_FIXTURES)('getBeat reads currentBeat from the selected section and normalizes bad values to 1 for $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);

        song.gotoSection(2);
        song.getCurrentSection().currentBeat = '3';
        expect(song.getBeat()).toBe(3);
        expect(song.getCurrentSection().currentBeat).toBe(3);

        song.getCurrentSection().currentBeat = 'not-a-number';
        expect(song.getBeat()).toBe(1);
        expect(song.getCurrentSection().currentBeat).toBe(1);
    });

    test.each(LOADED_SONG_FIXTURES)('getRelativeSectionWithWrap resolves relative, absolute, and malformed inputs on loaded song $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);
        const lastIndex = getLastSectionIndex(song);
        const warnings = [];

        song.gotoSection(lastIndex);
        expect(song.getSections().indexOf(song.getRelativeSectionWithWrap('+1', warnings))).toBe(0);
        expect(song.getSections().indexOf(song.getRelativeSectionWithWrap('0', warnings))).toBe(0);
        expect(song.getSections().indexOf(song.getRelativeSectionWithWrap('2', warnings))).toBe(1);
        expect(song.getSections().indexOf(song.getRelativeSectionWithWrap('foo', warnings))).toBe(lastIndex);
        expect(warnings).toContain('Malformed section amount: foo');
    });
});

describe('Song beat APIs on loaded JSON', () => {
    test.each(LOADED_SONG_FIXTURES)('getBeats and setBeats round-trip through current section for $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);

        song.gotoSection(0);
        song.setBeats('7');

        expect(song.getBeats()).toBe(7);
        expect(song.getCurrentSection().beats).toBe('7');
    });

    test.each(LOADED_SONG_FIXTURES)('gotoFirstBeat, nextBeat, and prevBeat respect section beat bounds for $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});

        song.gotoSection(0);
        song.setBeats(3);
        song.getCurrentSection().currentBeat = 2;

        song.gotoFirstBeat();
        expect(song.getBeat()).toBe(1);

        song.nextBeat();
        expect(song.getBeat()).toBe(2);

        song.nextBeat();
        expect(song.getBeat()).toBe(3);

        song.nextBeat();
        expect(song.getBeat()).toBe(3);

        song.prevBeat();
        expect(song.getBeat()).toBe(2);

        song.prevBeat();
        song.prevBeat();
        expect(song.getBeat()).toBe(1);

        triggerSpy.mockRestore();
    });

    test('deleteBeat on snake keeps recordedNotes aligned with beats and currentBeat', () => {
        const { song } = loadSongForApiTests(SECONDARY_SONG_FILENAME);
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});

        song.gotoSection(0);
        song.getCurrentSection().currentBeat = 3;
        song.deleteBeat();

        expect(song.getBeats()).toBe(11);
        expect(song.getBeat()).toBe(3);
        expect(song.getCurrentSection().recordedNotes['12']).toBeUndefined();
        expect(Array.isArray(song.getCurrentSection().recordedNotes['3'])).toBe(true);
        expect(Array.isArray(song.getCurrentSection().recordedNotes['11'])).toBe(true);

        triggerSpy.mockRestore();
    });
});

describe('Song section navigation APIs on loaded JSON', () => {
    test.each(LOADED_SONG_FIXTURES)('firstSection, lastSection, prevSection, and nextSection update index deterministically for $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);
        const lastIndex = getLastSectionIndex(song);

        song.lastSection();
        expect(song.getSectionsCurrentIndex()).toBe(lastIndex);

        song.prevSection();
        expect(song.getSectionsCurrentIndex()).toBe(lastIndex - 1);

        song.firstSection();
        expect(song.getSectionsCurrentIndex()).toBe(0);

        song.nextSection();
        expect(song.getSectionsCurrentIndex()).toBe(1);
    });

    test.each(LOADED_SONG_FIXTURES)('gotoNextSection and gotoPrevSection honor wrap flags at boundaries for $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});
        const lastIndex = getLastSectionIndex(song);

        song.gotoSection(lastIndex);
        song.gotoNextSection(false);
        expect(song.getSectionsCurrentIndex()).toBe(lastIndex);

        song.gotoNextSection(true);
        expect(song.getSectionsCurrentIndex()).toBe(0);

        song.gotoPrevSection(false);
        expect(song.getSectionsCurrentIndex()).toBe(0);

        song.gotoPrevSection(true);
        expect(song.getSectionsCurrentIndex()).toBe(lastIndex);

        expect(triggerSpy).toHaveBeenCalled();
        triggerSpy.mockRestore();
    });
});

describe('Song section mutation APIs', () => {
    test('insertSectionAtDest honors BEGIN, END, and numeric insertion-after behavior', () => {
        const song = createFreshHeadlessSong();
        seedSongWithCaptionedSections(song, ['A', 'B', 'C']);

        const beginSection = createSectionWithCaption(song, 'BEGIN-X');
        song.insertSectionAtDest(beginSection, 'BEGIN');
        expect(song.getSectionsCurrentIndex()).toBe(0);
        expect(song.getSections()[0].caption).toBe('BEGIN-X');

        const endSection = createSectionWithCaption(song, 'END-X');
        song.insertSectionAtDest(endSection, 'END');
        expect(song.getSectionsCurrentIndex()).toBe(song.getSections().length - 1);
        expect(song.getSections()[song.getSections().length - 1].caption).toBe('END-X');

        const afterZeroSection = createSectionWithCaption(song, 'AFTER-0');
        song.insertSectionAtDest(afterZeroSection, '0');
        expect(song.getSectionsCurrentIndex()).toBe(1);
        expect(song.getSections()[1].caption).toBe('AFTER-0');
    });

    test('moveSectionTo and moveSectionToEND reorder sections while preserving section identity', () => {
        const song = createFreshHeadlessSong();
        seedSongWithCaptionedSections(song, ['A', 'B', 'C', 'D']);

        song.gotoSection(1); // B
        const movingSection = song.getCurrentSection();
        song.moveSectionTo(3);

        expect(song.getSectionsCurrentIndex()).toBe(3);
        expect(song.getCurrentSection()).toBe(movingSection);
        expect(song.getSections().map((s) => s.caption)).toEqual(['A', 'C', 'D', 'B']);

        song.gotoSection(0); // A
        const sectionToEnd = song.getCurrentSection();
        song.moveSectionToEND();

        expect(song.getSectionsCurrentIndex()).toBe(song.getSections().length - 1);
        expect(song.getCurrentSection()).toBe(sectionToEnd);
        expect(song.getSections().map((s) => s.caption)).toEqual(['C', 'D', 'B', 'A']);
    });

    test('deleteCurrentSection removes one section, updates current index, and keeps remaining order', () => {
        const song = createFreshHeadlessSong();
        seedSongWithCaptionedSections(song, ['A', 'B', 'C']);
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});

        song.gotoSection(1); // B
        const didDelete = song.deleteCurrentSection();

        expect(didDelete).toBe(true);
        expect(song.getSections().length).toBe(2);
        expect(song.getSections().map((s) => s.caption)).toEqual(['A', 'C']);
        expect(song.getSectionsCurrentIndex()).toBe(0);
        expect(song.getCurrentSection().caption).toBe('A');

        triggerSpy.mockRestore();
    });

    test('addDeepCloneSection deep-clones noteTables and recordedNotes', () => {
        const song = createFreshHeadlessSong();
        song.sections = [];
        song.gSectionsCurrentIndex = 0;
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});

        const source = createSectionWithCaption(song, 'SOURCE');
        source.rootID = '7';
        source.rootIDLead = '9';
        source.beats = '3';
        source.namedNotes = { A: true, C: true };
        source.noteTables.tblP46 = [{ midinum: 60, row: 1, colorClass: 'c1', styleNum: 1 }];
        source.recordedNotes = { '1': [{ midinum: 60, row: 1 }], '2': [], '3': [] };
        song.addSection(source);
        song.gotoSection(0);

        const cloned = song.addDeepCloneSection();

        expect(song.getSections().length).toBe(2);
        expect(song.getCurrentSection()).toBe(cloned);
        expect(cloned).not.toBe(source);
        expect(cloned.noteTables).toEqual(source.noteTables);
        expect(cloned.recordedNotes).toEqual(source.recordedNotes);
        expect(cloned.noteTables).not.toBe(source.noteTables);
        expect(cloned.recordedNotes).not.toBe(source.recordedNotes);
        expect(cloned.currentBeat).toBe(1);

        triggerSpy.mockRestore();
    });

    test('addShallowCloneSection clones namedNotes but leaves noteTables and recordedNotes empty', () => {
        const song = createFreshHeadlessSong();
        song.sections = [];
        song.gSectionsCurrentIndex = 0;
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});

        const source = createSectionWithCaption(song, 'SOURCE-SHALLOW');
        source.rootID = '5';
        source.rootIDLead = '7';
        source.beats = '6';
        source.namedNotes = { A: { colorClass: 'noteScale' }, C: { colorClass: 'noteChord' } };
        source.noteTables.tblP46 = [{ midinum: 61, row: 1, colorClass: 'c2', styleNum: 2 }];
        source.recordedNotes = { '1': [{ midinum: 61, row: 1 }] };
        song.addSection(source);
        song.gotoSection(0);

        const cloned = song.addShallowCloneSection();

        expect(song.getSections().length).toBe(2);
        expect(song.getCurrentSection()).toBe(cloned);
        expect(cloned).not.toBe(source);
        expect(cloned.namedNotes).toEqual(source.namedNotes);
        expect(cloned.namedNotes).not.toBe(source.namedNotes);
        expect(cloned.noteTables).toEqual({});
        expect(cloned.recordedNotes).toEqual({});
        expect(cloned.currentBeat).toBe(1);

        triggerSpy.mockRestore();
    });
});

describe('Song index and table accessor contracts', () => {
    test('fixupCurrentIndexForLoadedSong clamps out-of-range high and low values', () => {
        const song = createFreshHeadlessSong();
        seedSongWithCaptionedSections(song, ['A', 'B', 'C']);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        song.gSectionsCurrentIndex = 999;
        song.fixupCurrentIndexForLoadedSong();
        expect(song.getSectionsCurrentIndex()).toBe(song.getSections().length - 1);

        song.gSectionsCurrentIndex = -5;
        song.fixupCurrentIndexForLoadedSong();
        expect(song.getSectionsCurrentIndex()).toBe(0);
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    test.each(LOADED_SONG_FIXTURES)('getTableArrInCurrentSection and getTableArrInSection return stable arrays and create missing ones for $label', ({ filename }) => {
        const { data, song } = loadSongForApiTests(filename);
        const existingTableID = data.visibleNoteTables[0];

        song.gotoSection(0);
        const existingArr = song.getTableArrInCurrentSection(existingTableID);
        expect(Array.isArray(existingArr)).toBe(true);

        const missingTableID = 'tblTEST_MISSING';
        const createdArr = song.getTableArrInCurrentSection(missingTableID);
        expect(Array.isArray(createdArr)).toBe(true);
        expect(createdArr.length).toBe(0);
        createdArr.push({ midinum: 64, row: 3 });
        expect(song.getCurrentSection().noteTables[missingTableID]).toEqual([{ midinum: 64, row: 3 }]);

        const section2 = song.getSections()[2];
        const section2Arr = song.getTableArrInSection(section2, missingTableID);
        expect(Array.isArray(section2Arr)).toBe(true);
        expect(section2.noteTables[missingTableID]).toBe(section2Arr);
    });

    test('Section-backed table accessor keeps array identity for repeated requests', () => {
        const song = createFreshHeadlessSong();
        const section = song.getCurrentSection();
        const tableID = 'tblIDENTITY';

        const arr1 = section.getTableArr(tableID);
        arr1.push({ midinum: 66, row: 2 });
        const arr2 = section.getTableArr(tableID);

        expect(arr2).toBe(arr1);
        expect(arr2).toEqual([{ midinum: 66, row: 2 }]);
    });

    test('getCurrentSection revives a plain section object to Section methods on access', () => {
        const song = createFreshHeadlessSong();

        const plainSection = {
            noteTables: {},
            namedNotes: {},
            recordedNotes: {},
            caption: 'plain',
            rootID: '3',
            rootIDLead: '-1',
            beats: 4,
            currentBeat: 1,
            sharps: false
        };

        song.sections = [plainSection];
        song.gSectionsCurrentIndex = 0;

        const revived = song.getCurrentSection();
        expect(typeof revived.getTableArr).toBe('function');
        expect(typeof revived.getRootNoteName).toBe('function');
        expect(revived).toBe(plainSection);
    });
});

describe('Song note mapping and emptiness contracts', () => {
    test('noteNameToNoteID, noteIDToNoteName, and root name getters are consistent', () => {
        const song = createFreshHeadlessSong();
        song.gotoSection(0);

        expect(song.noteNameToNoteID('Db')).toBe(4);
        expect(song.noteNameToNoteID('A')).toBe(0);

        song.getCurrentSection().sharps = false;
        expect(song.noteIDToNoteName(1)).toContain('9837'); // flat glyph

        song.getCurrentSection().sharps = true;
        expect(song.noteIDToNoteName(1)).toContain('9839'); // sharp glyph

        song.getCurrentSection().rootID = '3';
        song.getCurrentSection().rootIDLead = '-1';
        expect(song.getRootNoteName()).toBe('C');
        expect(song.getLeadNoteName()).toBe('C');

        song.getCurrentSection().rootIDLead = '7';
        expect(song.getLeadNoteName()).toBe('E');
    });

    test('isEmpty returns true for empty section and false when notes are present', () => {
        const song = createFreshHeadlessSong();
        const section = song.constructSection();

        expect(song.isEmpty(section)).toBe(true);

        section.namedNotes.A = true;
        expect(song.isEmpty(section)).toBe(false);

        delete section.namedNotes.A;
        section.noteTables.tblP46 = [{ midinum: 60, row: 1 }];
        expect(song.isEmpty(section)).toBe(false);
    });

    test('removeUnusedTablesFromMemoryModel removes only empty note tables in each section', () => {
        const song = createFreshHeadlessSong();
        const section = song.getCurrentSection();

        section.noteTables.tblEMPTY1 = [];
        section.noteTables.tblKEEP = [{ midinum: 70, row: 1 }];
        section.noteTables.tblEMPTY2 = [];

        song.removeUnusedTablesFromMemoryModel();

        expect(section.noteTables.tblKEEP).toEqual([{ midinum: 70, row: 1 }]);
        expect(section.noteTables.tblEMPTY1).toBeUndefined();
        expect(section.noteTables.tblEMPTY2).toBeUndefined();
    });

    test('moveNamedNotesForSection transposes note keys, clones kept notes, and drops notes without colorClass', () => {
        const song = createFreshHeadlessSong();
        const section = song.getCurrentSection();

        section.rootID = '0'; // A
        const sourceA = { noteNameClass: '.noteA', colorClass: 'noteScale' };
        const sourceC = { noteNameClass: '.noteC', colorClass: 'noteChord' };
        const sourceEbNoColor = { noteNameClass: '.noteEb' };
        section.namedNotes = {
            A: sourceA,
            C: sourceC,
            Eb: sourceEbNoColor
        };

        const highlightedRoot = song.moveNamedNotesForSection(2, section);

        expect(highlightedRoot).toBe('A');
        expect(Object.keys(section.namedNotes).sort()).toEqual(['B', 'D']);
        expect(section.namedNotes.B.noteName).toBe('B');
        expect(section.namedNotes.D.noteName).toBe('D');
        expect(section.namedNotes.B).not.toBe(sourceA);
        expect(section.namedNotes.D).not.toBe(sourceC);
        expect(section.namedNotes.F).toBeUndefined();
    });
});

describe('Song construction and section add APIs', () => {
    test('new Song() and makeSong() initialize with equivalent defaults and section index semantics', () => {
        const viaClass = new Song();
        const viaFactory = makeSong();

        [viaClass, viaFactory].forEach((song) => {
            song.setHeadless(true, true);
            expect(song.defaultBPM).toBe('80');
            expect(song.rootID).toBe('3');
            expect(song.getSections().length).toBe(1);
            expect(song.getSectionsCurrentIndex()).toBe(0);
            expect(typeof song.getCurrentSection().getRootNoteName).toBe('function');
        });

        const classSection = viaClass.constructSection();
        const factorySection = viaFactory.constructSection();
        viaClass.addSection(classSection);
        viaFactory.addSection(factorySection);

        expect(viaClass.getSectionsCurrentIndex()).toBe(1);
        expect(viaFactory.getSectionsCurrentIndex()).toBe(1);
        expect(viaClass.getCurrentSection()).toBe(classSection);
        expect(viaFactory.getCurrentSection()).toBe(factorySection);
    });

    test('fresh song initialization keeps expected defaults and starting section state', () => {
        const song = createFreshHeadlessSong();

        expect(song.defaultBPM).toBe('80');
        expect(song.rootID).toBe('3');
        expect(song.namedNoteOpacity).toBe('1.00');
        expect(song.singleNoteOpacity).toBe('1.00');
        expect(song.getSections().length).toBe(1);
        expect(song.getSectionsCurrentIndex()).toBe(0);
        expect(song.getCurrentSection()).toHaveProperty('rootID');
    });

    test('constructSection returns a section-shaped object with default song rootID', () => {
        const song = createFreshHeadlessSong();
        const section = song.constructSection();

        expect(section).toHaveProperty('noteTables');
        expect(section).toHaveProperty('namedNotes');
        expect(section).toHaveProperty('recordedNotes');
        expect(section).toHaveProperty('beats');
        expect(section).toHaveProperty('currentBeat');
        expect(section).toHaveProperty('rootID');
        expect(section.rootID).toBe(song.rootID);
    });

    test('addSection appends and moves current index to the new section', () => {
        const song = createFreshHeadlessSong();
        const startLen = song.getSections().length;
        const section = song.constructSection();

        const newIndex = song.addSection(section);

        expect(newIndex).toBe(startLen);
        expect(song.getSections().length).toBe(startLen + 1);
        expect(song.getSectionsCurrentIndex()).toBe(newIndex);
        expect(song.getCurrentSection()).toBe(section);
    });

    test('addSections replaces default empty section and sets current index to last added', () => {
        const song = createFreshHeadlessSong();
        const incoming = {
            sections: [song.constructSection(), song.constructSection(), song.constructSection()]
        };

        song.addSections(incoming);

        expect(song.getSections().length).toBe(3);
        expect(song.getSectionsCurrentIndex()).toBe(2);
    });

    test('cycleThruKeysAllSections transposes each section rootID with wrap', () => {
        const song = createFreshHeadlessSong();
        song.sections = [];
        song.gSectionsCurrentIndex = 0;

        const s1 = song.constructSection();
        const s2 = song.constructSection();
        const s3 = song.constructSection();
        s1.rootID = 0;
        s2.rootID = '11';
        s3.rootID = 5;
        song.addSection(s1);
        song.addSection(s2);
        song.addSection(s3);

        song.cycleThruKeysAllSections(2);

        expect(song.getSections()[0].rootID).toBe(2);
        expect(song.getSections()[1].rootID).toBe(1);
        expect(song.getSections()[2].rootID).toBe(7);
    });
});