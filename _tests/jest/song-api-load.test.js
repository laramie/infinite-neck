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
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        try {
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
        } finally {
            logSpy.mockRestore();
        }
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