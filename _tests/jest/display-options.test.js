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
    // Sprint 148 it4: sparse blocks + per-key resolver (see display-options-matrix.test.js for the full rules).
    test('inherits nearest prior saved cells for sections without explicit options', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();
        const fallbackOptions = {
            hideSingleNotes: true,
            NoteDisplaySizes: { width: '77px', height: '44px' }
        };

        delete sections[1].displayOptions;
        song.presentationMode = false;
        const inEffect = song.getDisplayOptionsInEffect(sections[1], fallbackOptions);

        expect(inEffect.hideSingleNotes).toBe(sections[0].displayOptions.hideSingleNotes);
        expect(inEffect.showCellNotes).toBe(sections[0].displayOptions.showCellNotes);
        // presentationMode is off: NoteDisplaySizes is adapter-gated, so the live value is used
        expect(inEffect.NoteDisplaySizes).toEqual(fallbackOptions.NoteDisplaySizes);

        song.presentationMode = true;
        expect(song.getDisplayOptionsInEffect(sections[1], fallbackOptions).NoteDisplaySizes)
            .toEqual(sections[0].displayOptions.NoteDisplaySizes);
    });

    test('returns a fresh object, never the live stored block', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();

        const inEffect = song.getDisplayOptionsInEffect(sections[1], {});
        inEffect.hideSingleNotes = 'mutated';

        expect(sections[1].displayOptions.hideSingleNotes).not.toBe('mutated');
    });

    test('uses the live options for keys no readable cell specifies', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();
        const fallbackOptions = {
            hideSingleNotes: true,
            currentColorDict: 'LiveDict'
        };

        delete sections[0].displayOptions;
        delete sections[1].displayOptions;
        sections[2].displayOptions = { showCellNotes: false };

        const inEffect = song.getDisplayOptionsInEffect(sections[1], fallbackOptions);

        expect(inEffect.currentColorDict).toBe('LiveDict');
        expect(inEffect.hideSingleNotes).toBe(true);
        // showCellNotes is stored at Section 3 only, so it is "automated": default before its first cell
        expect(inEffect.showCellNotes).toBe(true);
    });

    test('falls back to the live options when the Section is not in the Song', () => {
        const song = makeHeadlessSongFromFixture();
        const live = { hideSingleNotes: true };

        expect(song.getDisplayOptionsInEffect({}, live)).toBe(live);
    });
});

describe('getStoredDisplayOptionsInEffect contracts', () => {
    test('returns the nearest prior saved cells for sections without explicit options', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();

        delete sections[1].displayOptions;
        const stored = song.getStoredDisplayOptionsInEffect(sections[1]);

        expect(stored.hideSingleNotes).toBe(sections[0].displayOptions.hideSingleNotes);
        expect(stored.showCellNotes).toBe(sections[0].displayOptions.showCellNotes);
    });

    test('returns a fresh sparse object (never a synthetic live default) when no Section stores anything', () => {
        const song = makeHeadlessSongFromFixture();
        const sections = song.getSections();

        sections.forEach((s) => delete s.displayOptions);

        expect(song.getStoredDisplayOptionsInEffect(sections[1])).toEqual({});
    });

    test('returns null when the Section is not found in song.sections', () => {
        const song = makeHeadlessSongFromFixture();
        const stranger = { displayOptions: { autoColor: true } };

        expect(song.getStoredDisplayOptionsInEffect(stranger)).toBeNull();
    });
});

describe('recorded note playback display options', () => {
    test('Playback marker does not override fingering display-option font size', () => {
        const css = fs.readFileSync(APP_CSS_FILE, 'utf8');

        expect(css).toContain('font-size: var(--fingering-font-size);');
        expect(css).not.toMatch(/\.Playback\s*\{[^}]*font-size/s);
    });
});
