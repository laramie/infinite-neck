import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Song } from '../../Song.js';
import { Section } from '../../Section.js';
import { SectionNotes } from '../../SectionNotes.js';
import { Note } from '../../Note.js';
import { Wiring } from '../../Wiring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_FILENAME = 'persistence/3-chord-3keys-S6-Bass-observers-highlights.json';

function getSongPath(songFilename = FIXTURE_FILENAME) {
    return path.join(__dirname, '../../songs', songFilename);
}

function readSongJson(songFilename = FIXTURE_FILENAME) {
    return JSON.parse(fs.readFileSync(getSongPath(songFilename), 'utf8'));
}

function loadSongCanonical(songFilename = FIXTURE_FILENAME) {
    const data = readSongJson(songFilename);
    const song = new Song(data);
    song.setHeadless(true, true);
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();
    return { data, song };
}

function collectAllNoteStyleNums(song) {
    const styleNums = new Set();
    let bendNote = null;

    song.getSections().forEach((section) => {
        section.getAllSectionNotes().forEach(([_, sectionNotes]) => {
            Object.values(sectionNotes.namedNotes || {}).forEach((note) => {
                if (Number.isInteger(note?.styleNum)) {
                    styleNums.add(note.styleNum);
                }
            });

            (sectionNotes.playedNotes || []).forEach((note) => {
                if (Number.isInteger(note?.styleNum)) {
                    styleNums.add(note.styleNum);
                }
            });

            Object.values(sectionNotes.recordedNotes || {}).forEach((notesForBeat) => {
                (notesForBeat || []).forEach((note) => {
                    if (Number.isInteger(note?.styleNum)) {
                        styleNums.add(note.styleNum);
                    }
                    if (!bendNote && note?.styleNum === Note.STYLENUM_BEND && note?.bendValue) {
                        bendNote = note;
                    }
                });
            });
        });
    });

    return { styleNums, bendNote };
}

describe('Song V2 canonical load from disk', () => {
    test('loads the V2 persistence fixture into Song, Section, SectionNotes, Note, and Wiring instances', () => {
        const { data, song } = loadSongCanonical();

        expect(song.songfileVersion).toBe('V2');
        expect(song.songName).toBe(data.songName);
        expect(song.theme).toBe(data.theme);
        expect(song.getSections()).toHaveLength(data.sections.length);
        expect(song.getSectionsCurrentIndex()).toBe(0);
        expect(song.myTunings).toHaveLength(data.myTunings.length);
        expect(song.visibleNoteTables).toEqual(data.visibleNoteTables);
        expect(song.wirings).toHaveLength(data.wirings.length);

        const firstSection = song.getSections()[0];
        expect(firstSection).toBeInstanceOf(Section);

        const s6Notes = firstSection.getSectionNotes('tblS6_1');
        expect(s6Notes).toBeInstanceOf(SectionNotes);
        expect(s6Notes.namedNotes.C).toBeInstanceOf(Note);
        expect(s6Notes.recordedNotes['1'][0]).toBeInstanceOf(Note);

        expect(song.wirings[0]).toBeInstanceOf(Wiring);
        expect(song.wirings[1]).toBeInstanceOf(Wiring);
    });

    test('preserves the V2 note style spread and bend metadata from the fixture', () => {
        const { song } = loadSongCanonical();
        const { styleNums, bendNote } = collectAllNoteStyleNums(song);

        expect(Array.from(styleNums).sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(bendNote).toBeTruthy();
        expect(typeof bendNote.bendValue).toBe('string');
    });

    test('loads observer/listener wirings that reference visible persisted tables', () => {
        const { song } = loadSongCanonical();
        const visibleTables = new Set(song.visibleNoteTables);

        expect(song.wirings).toEqual([
            expect.objectContaining({
                tablename: 'tblBass4_Observer',
                relativeSection: '-1',
                listenToTablename: 'tblBass4_1'
            }),
            expect.objectContaining({
                tablename: 'tblP46_1',
                relativeSection: '',
                listenToTablename: 'tblS6_1'
            })
        ]);

        song.wirings.forEach((wiring) => {
            expect(visibleTables.has(wiring.tablename)).toBe(true);
            expect(visibleTables.has(wiring.listenToTablename)).toBe(true);
        });
    });
});

describe('Song V2 headless operations on a loaded song', () => {
    test('table accessors on the loaded song preserve playedNotes array identity and allow headless edits', () => {
        const { song } = loadSongCanonical();

        song.gotoSection(0);
        const tableID = 'tblP46_1';
        const arr1 = song.getTableArrInCurrentSection(tableID);
        const added = new Note({ noteName: 'C', styleNum: Note.STYLENUM_SINGLE, midinum: '60', row: '2', col: '5' });

        arr1.push(added);

        const arr2 = song.getTableArrInCurrentSection(tableID);
        expect(arr2).toBe(arr1);
        expect(arr2).toContain(added);
        expect(song.getCurrentSection().getSectionNotes(tableID).playedNotes).toBe(arr1);
    });

    test('deleteBeat on loaded V2 recordedNotes realigns later beats downward', () => {
        const { song } = loadSongCanonical();

        song.gotoSection(0);
        song.getCurrentSection().currentBeat = 2;

        const tableID = 'tblBass4_1';
        const sectionNotes = song.getCurrentSection().getSectionNotes(tableID);
        const beat1 = sectionNotes.recordedNotes['1'].map((note) => note.noteName);
        const beat3 = sectionNotes.recordedNotes['3'].map((note) => note.noteName);
        const beat4 = sectionNotes.recordedNotes['4'].map((note) => note.noteName);

        song.deleteBeat();

        const shifted = song.getCurrentSection().getSectionNotes(tableID).recordedNotes;
        expect(song.getBeats()).toBe(3);
        expect(song.getBeat()).toBe(2);
        expect(shifted['1'].map((note) => note.noteName)).toEqual(beat1);
        expect(shifted['2'].map((note) => note.noteName)).toEqual(beat3);
        expect(shifted['3'].map((note) => note.noteName)).toEqual(beat4);
        expect(shifted['4']).toBeUndefined();
    });

    test('renameTuningIDInModel updates loaded V2 sectionNotesByTable and visibleNoteTables', () => {
        const { song } = loadSongCanonical();

        song.renameTuningIDInModel('Bass4_Observer', 'Bass4_Listener');

        expect(song.visibleNoteTables).toContain('tblBass4_Listener');
        expect(song.visibleNoteTables).not.toContain('tblBass4_Observer');

        const thirdSection = song.getSections()[2];
        expect(thirdSection.sectionNotesByTable).toHaveProperty('tblBass4_Listener');
        expect(thirdSection.sectionNotesByTable).not.toHaveProperty('tblBass4_Observer');
        expect(thirdSection.sectionNotesByTable.tblBass4_Listener.recordedNotes['1'][0].noteName).toBe('Ab');
    });

    test('cycleThruKeysAllSections transposes every loaded section rootID with wrap', () => {
        const { data, song } = loadSongCanonical();

        const before = data.sections.map((section) => Number.parseInt(section.rootID, 10));
        song.cycleThruKeysAllSections(2);

        const after = song.getSections().map((section) => Number.parseInt(section.rootID, 10));
        const expected = before.map((rootID) => (12 + rootID + 2) % 12);
        expect(after).toEqual(expected);
    });
});

describe('Song V2 save path from a loaded song', () => {
    test('prepareForSave and getPersistentSongFile preserve save-facing V2 fields and exclude runtime-only state', () => {
        const { data, song } = loadSongCanonical();

        song.prepareForSave({
            visibleTableIds: data.visibleNoteTables,
            songName: data.songName,
            theme: data.theme,
            bpm: parseInt(data.defaultBPM, 10),
            userColors: data.userColors,
            userInstrumentTuning: data.userInstrumentTuning
        });

        const savedObj = JSON.parse(song.getPersistentSongFile());

        expect(savedObj.songfileVersion).toBe('V2');
        expect(savedObj.songName).toBe(data.songName);
        expect(savedObj.theme).toBe(data.theme);
        expect(savedObj.visibleNoteTables).toEqual(data.visibleNoteTables);
        expect(savedObj.sections).toHaveLength(data.sections.length);
        expect(savedObj.wirings).toEqual(data.wirings);
        expect(savedObj).not.toHaveProperty('isHeadless');
        expect(savedObj).not.toHaveProperty('gSectionsCurrentIndex');
        expect(savedObj).not.toHaveProperty('randomSectionHistory');

        const bendNote = savedObj.sections[0].sectionNotesByTable.tblS6_1.recordedNotes['1'][1];
        expect(bendNote.styleNum).toBe(Note.STYLENUM_BEND);
        expect(bendNote.bendValue).toBe('semitone1');
    });
});