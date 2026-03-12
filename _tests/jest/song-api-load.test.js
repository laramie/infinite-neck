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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SONG_FILENAME = 'All-Chords-All-Keys-w-highlights.json';
const SONG_PATH = path.join(__dirname, '../../songs', SONG_FILENAME);

function readSongJson() {
    return JSON.parse(fs.readFileSync(SONG_PATH, 'utf8'));
}

function loadSongForApiTests() {
    const data = readSongJson();

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
    test('load JSON -> prepareForSave -> stringify(replacer) produces equivalent saved shape', () => {
        const data = readSongJson();
        const song = createFreshHeadlessSong();
        song.addSections(data);
        song.prepareForSave({
            visibleTableIds:      data.visibleNoteTables ?? [],
            songName:             data.songName,
            theme:                data.theme,
            bpm:                  parseInt(data.defaultBPM),
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
    test('loads All-Chords-All-Keys-w-highlights.json into the Song model', () => {
        const { data, song } = loadSongForApiTests();

        expect(Array.isArray(data.sections)).toBe(true);
        expect(data.sections.length).toBeGreaterThan(0);
        expect(song.getSections().length).toBe(data.sections.length);
    });

    test('leaves the loaded Song ready for headless API tests', () => {
        const { data, song } = loadSongForApiTests();

        expect(song.isHeadless).toBe(true);
        expect(song.getCurrentSection()).toBe(song.getSections()[song.getSectionsCurrentIndex()]);
        expect(song.getSectionsCurrentIndex()).toBe(data.sections.length - 1);
        expect(song.getCurrentSection()).toHaveProperty('caption');
        expect(song.getCurrentSection()).toHaveProperty('namedNotes');
        expect(song.getCurrentSection()).toHaveProperty('noteTables');
    });
});

describe('Song API on loaded JSON', () => {
    test('getCurrentSection returns the section at the current index after load', () => {
        const { data, song } = loadSongForApiTests();
        const lastIndex = getLastSectionIndex(song);

        expect(song.getSectionsCurrentIndex()).toBe(lastIndex);
        expect(song.getCurrentSection()).toBe(song.getSections()[lastIndex]);
        expect(song.getCurrentSection()).toBe(data.sections[lastIndex]);
    });

    test('gotoSection selects a valid section and ignores an invalid one', () => {
        const { song } = loadSongForApiTests();
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

    test('getBeat reads currentBeat from the selected section and normalizes bad values to 1', () => {
        const { song } = loadSongForApiTests();

        song.gotoSection(2);
        song.getCurrentSection().currentBeat = '3';
        expect(song.getBeat()).toBe(3);
        expect(song.getCurrentSection().currentBeat).toBe(3);

        song.getCurrentSection().currentBeat = 'not-a-number';
        expect(song.getBeat()).toBe(1);
        expect(song.getCurrentSection().currentBeat).toBe(1);
    });

    test('getRelativeSectionWithWrap resolves relative, absolute, and malformed inputs on a real loaded song', () => {
        const { song } = loadSongForApiTests();
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
    test('getBeats and setBeats round-trip through current section', () => {
        const { song } = loadSongForApiTests();

        song.gotoSection(0);
        song.setBeats('7');

        expect(song.getBeats()).toBe(7);
        expect(song.getCurrentSection().beats).toBe('7');
    });

    test('gotoFirstBeat, nextBeat, and prevBeat respect section beat bounds', () => {
        const { song } = loadSongForApiTests();
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
});

describe('Song section navigation APIs on loaded JSON', () => {
    test('firstSection, lastSection, prevSection, and nextSection update index deterministically', () => {
        const { song } = loadSongForApiTests();
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

    test('gotoNextSection and gotoPrevSection honor wrap flags at boundaries', () => {
        const { song } = loadSongForApiTests();
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

    test('getTableArrInCurrentSection and getTableArrInSection return stable arrays and create missing ones', () => {
        const { data, song } = loadSongForApiTests();
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
});

describe('Song construction and section add APIs', () => {
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
});