import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Song } from '../../Song.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_FILE = path.join(__dirname, '../../songs/tests/display-options.json');
const APP_CSS_FILE = path.join(__dirname, '../../infinite-neck.css');

function readFixture() {
    return JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8'));
}

function makeHeadlessSongFromFixture() {
    const song = new Song(readFixture());
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();
    song.setHeadless(true, true);
    return song;
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
            expect(section.displayOptions).toHaveProperty('showLooperLightBeats');
            expect(section.displayOptions).toHaveProperty('showCellNotes');
            expect(section.displayOptions).toHaveProperty('NoteDisplaySizes');
            expect(section.displayOptions.NoteDisplaySizes).toHaveProperty('width');
            expect(section.displayOptions.NoteDisplaySizes).toHaveProperty('height');
            if (idx === 1) {
                expect(section.displayOptions.hideSingleNotes).toBe(false);
                expect(section.displayOptions.showLooperLightBeats).toBe(true);
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
        song.getCurrentSection().displayOptions.pianoHeightScaleFactor = '7';
        song.getCurrentSection().displayOptions.pianoWidthScaleFactor = '5';
        song.getCurrentSection().displayOptions.showLooperLightBeats = false;

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
            showCellNotes: s.displayOptions.showCellNotes,
            pianoHeightScaleFactor: s.displayOptions.pianoHeightScaleFactor,
            pianoWidthScaleFactor: s.displayOptions.pianoWidthScaleFactor,
            showLooperLightBeats: s.displayOptions.showLooperLightBeats
        }));

        song.prepareForSave({
            songName: data.songName,
            theme: data.theme,
            bpm: parseInt(data.defaultBPM, 10),
            userColors: data.userColors
        });

        const savedObj = JSON.parse(JSON.stringify(song));
        const afterSummary = savedObj.sections.map((s) => ({
            hideSingleNotes: s.displayOptions.hideSingleNotes,
            width: s.displayOptions.NoteDisplaySizes.width,
            height: s.displayOptions.NoteDisplaySizes.height,
            showCellNotes: s.displayOptions.showCellNotes,
            pianoHeightScaleFactor: s.displayOptions.pianoHeightScaleFactor,
            pianoWidthScaleFactor: s.displayOptions.pianoWidthScaleFactor,
            showLooperLightBeats: s.displayOptions.showLooperLightBeats
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

        // Fixture expectation: section0=false, section1=false, section2=false, wrap->section0=false
        expect(observed).toEqual([false, false, false, false]);
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
        savedOptions.pianoHeightScaleFactor = '8';
        savedOptions.pianoWidthScaleFactor = '4';
        savedOptions.showLooperLightBeats = false;

        // Mirrors the save-button runtime contract: getCurrentSection().displayOptions = options
        song.getCurrentSection().displayOptions = savedOptions;

        expect(sections[1].displayOptions.hideSingleNotes).toBe(false);
        expect(sections[1].displayOptions.NoteDisplaySizes.width).toBe('88px');
        expect(sections[1].displayOptions.pianoHeightScaleFactor).toBe('8');
        expect(sections[1].displayOptions.pianoWidthScaleFactor).toBe('4');
        expect(sections[1].displayOptions.showLooperLightBeats).toBe(false);
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
            songName: data.songName,
            theme: data.theme,
            bpm: parseInt(data.defaultBPM, 10),
            userColors: data.userColors
        });

        const savedObj = JSON.parse(JSON.stringify(song));

        expect(savedObj.sections[1].displayOptions).toBeUndefined();
        expect(savedObj.sections[0].displayOptions).toBeTruthy();
        expect(savedObj.sections[2].displayOptions).toBeTruthy();
    });
});

describe('getDisplayOptionsInEffect contracts', () => {
    test('inherits nearest prior saved displayOptions for sections without explicit options', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();
        const fallbackOptions = {
            hideSingleNotes: false,
            NoteDisplaySizes: { width: '77px', height: '44px' }
        };

        delete sections[1].displayOptions;
        const inEffect = song.getDisplayOptionsInEffect(sections[1], fallbackOptions);

        expect(inEffect).toEqual(sections[0].displayOptions);
        expect(inEffect).not.toEqual(fallbackOptions);
    });

    test('uses provided default options when no earlier section has explicit displayOptions', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();
        const fallbackOptions = {
            hideSingleNotes: true,
            showCellNotes: false,
            NoteDisplaySizes: { width: '91px', height: '52px' }
        };

        delete sections[0].displayOptions;
        delete sections[1].displayOptions;

        const inEffect = song.getDisplayOptionsInEffect(sections[1], fallbackOptions);

        expect(inEffect).toEqual(fallbackOptions);
    });
});

describe('recorded note playback display options', () => {
    test('Playback marker does not override fingering display-option font size', () => {
        const css = fs.readFileSync(APP_CSS_FILE, 'utf8');

        expect(css).toContain('font-size: var(--fingering-font-size);');
        expect(css).not.toMatch(/\.Playback\s*\{[^}]*font-size/s);
    });
});
