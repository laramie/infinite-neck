import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { jest } from '@jest/globals';

import {
    setupSongTests,
    getSong
} from '../../infinite-neck-headless.js';
import { noteNameToNoteID } from '../../Constants.js';
import EventBus from '../../event-bus.js';
import { Song } from '../../Song.js';
import { Section } from '../../Section.js';
import { SectionNotes } from '../../SectionNotes.js';
import { Note } from '../../Note.js';
import { Wiring } from '../../Wiring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_SONG_FILENAME = 'tests/persistence/3-chord-3keys-S6-Bass-observers-highlights.json';
const PRIMARY_TABLE_ID = 'tblS6_1';
const AUX_TABLE_ID = 'tblP46_1';

const LOADED_SONG_FIXTURES = [
    {
        label: PRIMARY_SONG_FILENAME,
        filename: PRIMARY_SONG_FILENAME
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
    const song = new Song(data);

    song.setHeadless(true, true);
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();

    return {
        data,
        song
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

describe('Headless tuning bootstrap contracts', () => {
    test('setupSongTests seeds at least one myTuning in the model', () => {
        const song = createFreshHeadlessSong();

        expect(Array.isArray(song.myTunings)).toBe(true);
        expect(song.myTunings.length).toBeGreaterThan(0);
        expect(song.myTunings[0]).toHaveProperty('baseID');
        expect(song.myTunings[0].baseID).toMatch(/^S6_\d+$/);
        expect(song.myTunings[0].baseID).toBe('S6_1');
    });
});

describe('Song API bootstrap from JSON', () => {
    test.each(LOADED_SONG_FIXTURES)('loads $label into the Song model', ({ filename }) => {
        const { data, song } = loadSongForApiTests(filename);

        expect(Array.isArray(data.sections)).toBe(true);
        expect(data.sections.length).toBeGreaterThan(0);
        expect(song.getSections().length).toBe(data.sections.length);
        expect(song.songfileVersion).toBe('V2');
    });

    test.each(LOADED_SONG_FIXTURES)('leaves $label ready for headless API tests', ({ filename }) => {
        const { data, song } = loadSongForApiTests(filename);
        const currentSection = song.getCurrentSection();

        expect(song.isHeadless).toBe(true);
        expect(currentSection).toBe(song.getSections()[song.getSectionsCurrentIndex()]);
        expect(song.getSectionsCurrentIndex()).toBe(0);
        expect(currentSection.caption).toBe(data.sections[0].caption);
    });

    test.each(LOADED_SONG_FIXTURES)('revives loaded sections with V2 model instances for $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);
        const section = song.getSections()[0];
        const sectionNotes = section.getSectionNotes(PRIMARY_TABLE_ID);

        expect(section).toBeInstanceOf(Section);
        expect(typeof section.getRootKey).toBe('function');
        expect(typeof section.getRootNoteName).toBe('function');
        expect(typeof section.getTableArr).toBe('function');
        expect(typeof section.isEmpty).toBe('function');
        expect(sectionNotes).toBeInstanceOf(SectionNotes);
        expect(sectionNotes.recordedNotes['1'][0]).toBeInstanceOf(Note);
        expect(song.wirings[0]).toBeInstanceOf(Wiring);
    });

    test.each(LOADED_SONG_FIXTURES)('Song constructor loads $label through the canonical V2 path', ({ filename }) => {
        const data = readSongJson(filename);
        const song = new Song(data);

        song.setHeadless(true, true);
        song.ensureDefaultSection();
        song.fixupCurrentIndexForLoadedSong();

        expect(song.isHeadless).toBe(true);
        expect(song.getSections().length).toBe(data.sections.length);
        expect(song.getSectionsCurrentIndex()).toBe(0);
    });

    test('Song callers can clamp out-of-range gSectionsCurrentIndex via fixupCurrentIndexForLoadedSong', () => {
        const data = readSongJson(PRIMARY_SONG_FILENAME);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const song = new Song(data);

        song.gSectionsCurrentIndex = 99999;
        song.fixupCurrentIndexForLoadedSong();

        expect(song.getSectionsCurrentIndex()).toBe(song.getSections().length - 1);
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
    });
});

describe('Song API on loaded JSON', () => {
    test.each(LOADED_SONG_FIXTURES)('getCurrentSection returns the section at the current index after loading $label', ({ filename }) => {
        const { data, song } = loadSongForApiTests(filename);

        expect(song.getSectionsCurrentIndex()).toBe(0);
        expect(song.getCurrentSection()).toBe(song.getSections()[0]);
        expect(song.getCurrentSection()).toBeInstanceOf(Section);
        expect(song.getCurrentSection().caption).toBe(data.sections[0].caption);
    });

    test.each(LOADED_SONG_FIXTURES)('gotoSection selects a valid section and ignores an invalid one for $label', ({ filename }) => {
        const { song } = loadSongForApiTests(filename);
        const targetIndex = 1;
        const originalIndex = song.getSectionsCurrentIndex();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        song.gotoSection(targetIndex);
        expect(song.getSectionsCurrentIndex()).toBe(targetIndex);
        expect(song.getCurrentSection()).toBe(song.getSections()[targetIndex]);

        song.gotoSection(999999);
        expect(song.getSectionsCurrentIndex()).toBe(targetIndex);
        expect(warnSpy).toHaveBeenCalled();

        song.gotoSection(originalIndex);
        expect(song.getSectionsCurrentIndex()).toBe(originalIndex);

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

    test('deleteBeat keeps V2 recordedNotes aligned with beats and currentBeat', () => {
        const song = createFreshHeadlessSong();
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});

        song.sections = [];
        song.gSectionsCurrentIndex = 0;

        const section = song.constructSection();
        section.beats = 4;
        section.currentBeat = 3;
        const sectionNotes = section.getSectionNotes(PRIMARY_TABLE_ID);
        sectionNotes.recordedNotes['1'] = [{ noteName: 'A' }];
        sectionNotes.recordedNotes['2'] = [{ noteName: 'B' }];
        sectionNotes.recordedNotes['3'] = [{ noteName: 'C' }];
        sectionNotes.recordedNotes['4'] = [{ noteName: 'D' }];
        song.addSection(section);

        song.gotoSection(0);
        song.getCurrentSection().currentBeat = 3;
        song.deleteBeat();

        const recordedNotes = song.getCurrentSection().getSectionNotes(PRIMARY_TABLE_ID).recordedNotes;

        expect(song.getBeats()).toBe(3);
        expect(song.getBeat()).toBe(3);
        expect(recordedNotes['4']).toBeUndefined();
        expect(recordedNotes['1']).toEqual([{ noteName: 'A' }]);
        expect(recordedNotes['2']).toEqual([{ noteName: 'B' }]);
        expect(recordedNotes['3']).toEqual([{ noteName: 'D' }]);

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

        song.gotoSection(1);
        const movingSection = song.getCurrentSection();
        song.moveSectionTo(3);

        expect(song.getSectionsCurrentIndex()).toBe(3);
        expect(song.getCurrentSection()).toBe(movingSection);
        expect(song.getSections().map((section) => section.caption)).toEqual(['A', 'C', 'D', 'B']);

        song.gotoSection(0);
        const sectionToEnd = song.getCurrentSection();
        song.moveSectionToEND();

        expect(song.getSectionsCurrentIndex()).toBe(song.getSections().length - 1);
        expect(song.getCurrentSection()).toBe(sectionToEnd);
        expect(song.getSections().map((section) => section.caption)).toEqual(['C', 'D', 'B', 'A']);
    });

    test('deleteCurrentSection removes one section, updates current index, and keeps remaining order', () => {
        const song = createFreshHeadlessSong();
        seedSongWithCaptionedSections(song, ['A', 'B', 'C']);
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});

        song.gotoSection(1);
        const didDelete = song.deleteCurrentSection();

        expect(didDelete).toBe(true);
        expect(song.getSections().length).toBe(2);
        expect(song.getSections().map((section) => section.caption)).toEqual(['A', 'C']);
        expect(song.getSectionsCurrentIndex()).toBe(0);
        expect(song.getCurrentSection().caption).toBe('A');

        triggerSpy.mockRestore();
    });

    test('addDeepCloneSection deep-clones V2 sectionNotesByTable data', () => {
        const song = createFreshHeadlessSong();
        song.sections = [];
        song.gSectionsCurrentIndex = 0;
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});

        const source = createSectionWithCaption(song, 'SOURCE');
        source.rootID = '7';
        source.rootIDLead = '9';
        source.beats = '3';

        const sourceNotes = source.getSectionNotes(AUX_TABLE_ID);
        sourceNotes.namedNotes = {
            A: new Note({ noteName: 'A', colorClass: 'noteScale', styleNum: 1 }),
            C: new Note({ noteName: 'C', colorClass: 'noteChord', styleNum: 2 })
        };
        sourceNotes.playedNotes = [new Note({ noteName: 'C', midinum: 60, row: 1, colorClass: 'c1', styleNum: 1 })];
        sourceNotes.recordedNotes = {
            '1': [new Note({ noteName: 'C', midinum: 60, row: 1 })],
            '2': [],
            '3': []
        };

        song.addSection(source);
        song.gotoSection(0);

        const cloned = song.addDeepCloneSection();
        const clonedNotes = cloned.getSectionNotes(AUX_TABLE_ID);

        expect(song.getSections().length).toBe(2);
        expect(song.getCurrentSection()).toBe(cloned);
        expect(cloned).not.toBe(source);
        expect(cloned).toBeInstanceOf(Section);
        expect(cloned.sectionNotesByTable).toEqual(source.sectionNotesByTable);
        expect(cloned.sectionNotesByTable).not.toBe(source.sectionNotesByTable);
        expect(clonedNotes).toBeInstanceOf(SectionNotes);
        expect(clonedNotes).not.toBe(sourceNotes);
        expect(clonedNotes.playedNotes).toEqual(sourceNotes.playedNotes);
        expect(clonedNotes.playedNotes).not.toBe(sourceNotes.playedNotes);
        expect(clonedNotes.recordedNotes).toEqual(sourceNotes.recordedNotes);
        expect(clonedNotes.recordedNotes).not.toBe(sourceNotes.recordedNotes);
        expect(cloned.currentBeat).toBe(1);

        triggerSpy.mockRestore();
    });

    test('addShallowCloneSection clones V2 namedNotes but empties playedNotes and recordedNotes', () => {
        const song = createFreshHeadlessSong();
        song.sections = [];
        song.gSectionsCurrentIndex = 0;
        const triggerSpy = jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});

        const source = createSectionWithCaption(song, 'SOURCE-SHALLOW');
        source.rootID = '5';
        source.rootIDLead = '7';
        source.beats = '6';

        const sourceNotes = source.getSectionNotes(AUX_TABLE_ID);
        sourceNotes.namedNotes = {
            A: new Note({ noteName: 'A', colorClass: 'noteScale', styleNum: 1 }),
            C: new Note({ noteName: 'C', colorClass: 'noteChord', styleNum: 2 })
        };
        sourceNotes.playedNotes = [new Note({ noteName: 'Db', midinum: 61, row: 1, colorClass: 'c2', styleNum: 2 })];
        sourceNotes.recordedNotes = {
            '1': [new Note({ noteName: 'Db', midinum: 61, row: 1 })]
        };

        song.addSection(source);
        song.gotoSection(0);

        const cloned = song.addShallowCloneSection();
        const clonedNotes = cloned.getSectionNotes(AUX_TABLE_ID);

        expect(song.getSections().length).toBe(2);
        expect(song.getCurrentSection()).toBe(cloned);
        expect(cloned).not.toBe(source);
        expect(clonedNotes.namedNotes).toEqual(sourceNotes.namedNotes);
        expect(clonedNotes.namedNotes).not.toBe(sourceNotes.namedNotes);
        expect(clonedNotes.playedNotes).toEqual([]);
        expect(clonedNotes.recordedNotes).toEqual({});
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
});

describe('Song note mapping and emptiness contracts', () => {
    test('noteNameToNoteID, noteIDToNoteName, and root name getters are consistent', () => {
        const song = createFreshHeadlessSong();
        song.gotoSection(0);

        expect(noteNameToNoteID('Db')).toBe(4);
        expect(noteNameToNoteID('A')).toBe(0);

        song.getCurrentSection().sharps = false;
        expect(song.noteIDToNoteName(1)).toContain('9837');

        song.getCurrentSection().sharps = true;
        expect(song.noteIDToNoteName(1)).toContain('9839');

        song.getCurrentSection().rootID = '3';
        song.getCurrentSection().rootIDLead = '-1';
        expect(song.getRootNoteName()).toBe('C');
        expect(song.getLeadNoteName()).toBe('C');

        song.getCurrentSection().rootIDLead = '7';
        expect(song.getLeadNoteName()).toBe('E');
    });
});

describe('Song construction and section add APIs', () => {
    test('fresh song initialization keeps expected defaults and starting section state', () => {
        const song = createFreshHeadlessSong();

        expect(song.defaultBPM).toBe('80');
        expect(song.rootID).toBe('3');
        expect(song.namedNoteOpacity).toBe('1.00');
        expect(song.singleNoteOpacity).toBe('1.00');
        expect(song.tinyNoteOpacity).toBe('1.00');
        expect(song.getSections().length).toBe(1);
        expect(song.getSectionsCurrentIndex()).toBe(0);
        expect(song.getCurrentSection()).toHaveProperty('rootID');
    });

    test('constructSection returns a V2 section object with default song rootID', () => {
        const song = createFreshHeadlessSong();
        const section = song.constructSection();

        expect(section).toBeInstanceOf(Section);
        expect(section).toHaveProperty('sectionNotesByTable');
        expect(section).toHaveProperty('beats');
        expect(section).toHaveProperty('currentBeat');
        expect(section).toHaveProperty('rootID');
        expect(typeof section.getTableArr).toBe('function');
        expect(typeof section.getSectionNotes).toBe('function');
        expect(typeof section.isEmpty).toBe('function');
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

    test('Song constructor hydrates persisted sections through the canonical V2 path', () => {
        const sourceSong = createFreshHeadlessSong();
        sourceSong.sections = [];
        sourceSong.gSectionsCurrentIndex = 0;
        sourceSong.addSection(sourceSong.constructSection());
        sourceSong.addSection(sourceSong.constructSection());
        sourceSong.addSection(sourceSong.constructSection());

        const persistedSong = JSON.parse(sourceSong.getPersistentSongFile());
        const loadedSong = new Song(persistedSong);
        loadedSong.setHeadless(true, true);
        loadedSong.ensureDefaultSection();
        loadedSong.fixupCurrentIndexForLoadedSong();

        expect(loadedSong.getSections().length).toBe(3);
        expect(loadedSong.getSectionsCurrentIndex()).toBe(0);
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