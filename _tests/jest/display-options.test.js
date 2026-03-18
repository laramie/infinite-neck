import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Song } from '../../song.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_FILE = path.join(__dirname, '../../songs/tests/display-options.json');

function readFixture() {
    return JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8'));
}

function makeHeadlessSongFromFixture() {
    return new Song( {legacy: false, headless: true, fileObj: readFixture(), quiet: true, fixIndex: true });
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

describe('DisplayOptions baseline fixture contracts', () => {
    test('fixture has three sections and each section persists displayOptions', () => {
        const data = readFixture();

        expect(Array.isArray(data.sections)).toBe(true);
        expect(data.sections).toHaveLength(3);

        data.sections.forEach((section, idx) => {
            expect(section).toHaveProperty('displayOptions');
            expect(section.displayOptions).toBeTruthy();
            expect(section.displayOptions).toHaveProperty('hideSingleNotes');
            expect(section.displayOptions).toHaveProperty('showCellNotes');
            expect(section.displayOptions).toHaveProperty('NoteDisplaySizes');
            expect(section.displayOptions.NoteDisplaySizes).toHaveProperty('width');
            expect(section.displayOptions.NoteDisplaySizes).toHaveProperty('height');
            if (idx === 1) {
                expect(section.displayOptions.hideSingleNotes).toBe(true);
            }
        });
    });

    test('section-local displayOptions mutation does not leak across sections', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();

        const before0 = clone(sections[0].displayOptions);
        const before2 = clone(sections[2].displayOptions);

        song.gotoSection(1);
        song.getCurrentSection().displayOptions.hideSingleNotes = false;
        song.getCurrentSection().displayOptions.NoteDisplaySizes.width = '90px';

        expect(sections[0].displayOptions).toEqual(before0);
        expect(sections[2].displayOptions).toEqual(before2);
    });

    test('prepareForSave keeps per-section displayOptions values intact', () => {
        const data = readFixture();
        const song = makeHeadlessSongFromFixture();

        const beforeSummary = song.getSections().map((s) => ({
            hideSingleNotes: s.displayOptions.hideSingleNotes,
            width: s.displayOptions.NoteDisplaySizes.width,
            height: s.displayOptions.NoteDisplaySizes.height,
            showCellNotes: s.displayOptions.showCellNotes
        }));

        song.prepareForSave({
            visibleTableIds: data.visibleNoteTables ?? [],
            songName: data.songName,
            theme: data.theme,
            bpm: parseInt(data.defaultBPM, 10),
            userColors: data.userColors,
            userInstrumentTuning: data.userInstrumentTuning
        });

        const savedObj = JSON.parse(JSON.stringify(song));
        const afterSummary = savedObj.sections.map((s) => ({
            hideSingleNotes: s.displayOptions.hideSingleNotes,
            width: s.displayOptions.NoteDisplaySizes.width,
            height: s.displayOptions.NoteDisplaySizes.height,
            showCellNotes: s.displayOptions.showCellNotes
        }));

        expect(afterSummary).toEqual(beforeSummary);
        expect(savedObj.sections).toHaveLength(3);
    });

    test('looping section navigation exposes each section displayOptions without skipping', () => {
        const song = makeHeadlessSongFromFixture();

        song.gotoSection(0);
        const observed = [];

        observed.push(song.getCurrentSection().displayOptions.hideSingleNotes);
        song.gotoNextSection(true);
        observed.push(song.getCurrentSection().displayOptions.hideSingleNotes);
        song.gotoNextSection(true);
        observed.push(song.getCurrentSection().displayOptions.hideSingleNotes);
        song.gotoNextSection(true);
        observed.push(song.getCurrentSection().displayOptions.hideSingleNotes);

        // Fixture expectation: section0=false, section1=true, section2=false, wrap->section0=false
        expect(observed).toEqual([false, true, false, false]);
    });
});

describe('Save and Clear DisplayOptions baseline contracts', () => {
    test('saving displayOptions updates only the current section payload', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();

        const before0 = clone(sections[0].displayOptions);
        const before2 = clone(sections[2].displayOptions);

        song.gotoSection(1);
        const savedOptions = clone(song.getCurrentSection().displayOptions);
        savedOptions.hideSingleNotes = false;
        savedOptions.NoteDisplaySizes.width = '88px';

        // Mirrors the save-button runtime contract: getCurrentSection().displayOptions = options
        song.getCurrentSection().displayOptions = savedOptions;

        expect(sections[1].displayOptions.hideSingleNotes).toBe(false);
        expect(sections[1].displayOptions.NoteDisplaySizes.width).toBe('88px');
        expect(sections[0].displayOptions).toEqual(before0);
        expect(sections[2].displayOptions).toEqual(before2);
    });

    test('clearing displayOptions removes only the current section displayOptions', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();

        expect(sections[0].displayOptions).toBeTruthy();
        expect(sections[1].displayOptions).toBeTruthy();
        expect(sections[2].displayOptions).toBeTruthy();

        song.gotoSection(1);
        delete song.getCurrentSection().displayOptions;

        expect(sections[1].displayOptions).toBeUndefined();
        expect(sections[0].displayOptions).toBeTruthy();
        expect(sections[2].displayOptions).toBeTruthy();
    });

    test('save path preserves cleared section while retaining other sections displayOptions', () => {
        const data = readFixture();
        const song = makeHeadlessSongFromFixture();

        song.gotoSection(1);
        delete song.getCurrentSection().displayOptions;

        song.prepareForSave({
            visibleTableIds: data.visibleNoteTables ?? [],
            songName: data.songName,
            theme: data.theme,
            bpm: parseInt(data.defaultBPM, 10),
            userColors: data.userColors,
            userInstrumentTuning: data.userInstrumentTuning
        });

        const savedObj = JSON.parse(JSON.stringify(song));

        expect(savedObj.sections[1].displayOptions).toBeUndefined();
        expect(savedObj.sections[0].displayOptions).toBeTruthy();
        expect(savedObj.sections[2].displayOptions).toBeTruthy();
    });
});
