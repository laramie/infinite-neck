import { Note } from '../../Note.js';
import { SectionNotes } from '../../SectionNotes.js';
import { getTonalForTable, TonalSourceSet } from '../../TonalFunctions.js';

function createSongMock(rootKey = 'C') {
    return {
        noteIDToNoteName() {
            return rootKey;
        }
    };
}

function createSection(sectionNotesByTable, rootID = '3') {
    return {
        rootID,
        sectionNotesByTable,
        getNoteRoot(tablename) {
            const orderedTables = [];
            if (tablename && this.sectionNotesByTable?.[tablename]) {
                orderedTables.push([tablename, this.sectionNotesByTable[tablename]]);
            }
            Object.entries(this.sectionNotesByTable || {}).forEach(([tableID, sectionNotes]) => {
                if (tableID !== tablename) {
                    orderedTables.push([tableID, sectionNotes]);
                }
            });

            for (const [tableID, sectionNotes] of orderedTables) {
                for (const [noteName, note] of Object.entries(sectionNotes?.namedNotes || {})) {
                    if (note?.colorClass === 'noteRoot') {
                        return { noteName, tablename: tableID };
                    }
                }
            }

            return null;
        },
        getAllSectionNotes() {
            return Object.entries(this.sectionNotesByTable);
        }
    };
}

function createNamedNotes(noteNames) {
    return Object.fromEntries(
        noteNames.map((noteName) => [noteName, { noteName, styleNum: Note.STYLENUM_NAMED, colorClass: 'noteTransparent' }])
    );
}

function createPlayedNotes(noteNames, styleNum) {
    return noteNames.map((noteName, index) => ({
        noteName,
        styleNum,
        row: `${index}`,
        col: `${index}`,
        midinum: `${60 + index}`,
        colorClass: 'noteTransparent'
    }));
}

describe('TonalFunctions tonal source selection', () => {
    test('empty tonalSourceSet falls back to NamedNote and returns the documented C triad recommendations', () => {
        const tableID = 'tblP46_1';
        const section = createSection({
            [tableID]: new SectionNotes({
                namedNotes: createNamedNotes(['C', 'E', 'G'])
            })
        });

        const result = getTonalForTable(createSongMock('C'), section, tableID);

        expect(result.tonalSourceSet).toBe(TonalSourceSet.NAMEDNOTE);
        expect(result.normalizedNamedNotes).toEqual(['C', 'E', 'G']);
        expect(result.chords).toEqual(['CM', 'Em#5/C']);
        expect(result.scale).toEqual(['C major pentatonic', 'C major', 'C lydian', 'C mixolydian']);
    });

    test('NamedNote source returns the documented Cmaj7 recommendations', () => {
        const tableID = 'tblP46_1';
        const section = createSection({
            [tableID]: new SectionNotes({
                tonalSourceSet: TonalSourceSet.NAMEDNOTE,
                namedNotes: createNamedNotes(['C', 'E', 'G', 'B'])
            })
        });

        const result = getTonalForTable(createSongMock('C'), section, tableID);

        expect(result.normalizedNamedNotes).toEqual(['C', 'E', 'G', 'B']);
        expect(result.chords).toEqual(['Cmaj7']);
        expect(result.scale).toEqual(['C major', 'C lydian']);
    });

    test('NamedNote source returns the documented C minor and dorian recommendations for C D Eb F G Bb', () => {
        const tableID = 'tblP46_1';
        const section = createSection({
            [tableID]: new SectionNotes({
                tonalSourceSet: TonalSourceSet.NAMEDNOTE,
                namedNotes: createNamedNotes(['C', 'D', 'Eb', 'F', 'G', 'Bb'])
            })
        });

        const result = getTonalForTable(createSongMock('C'), section, tableID);

        expect(result.normalizedNamedNotes).toEqual(['C', 'D', 'Eb', 'F', 'G', 'Bb']);
        expect(result.chords).toEqual(['Cm11', 'Ebmaj13/C', 'EbM7add13/C', 'F13sus4/C']);
        expect(result.scale).toEqual(['C minor', 'C dorian']);
    });

    test('SingleNote source uses playedNotes filtered to single-note style only', () => {
        const tableID = 'tblP46_1';
        const section = createSection({
            [tableID]: new SectionNotes({
                tonalSourceSet: TonalSourceSet.SINGLENOTE,
                namedNotes: createNamedNotes(['C', 'Db']),
                playedNotes: [
                    ...createPlayedNotes(['C', 'E', 'G'], Note.STYLENUM_SINGLE),
                    ...createPlayedNotes(['Db'], Note.STYLENUM_TINY),
                    ...createPlayedNotes(['F'], Note.STYLENUM_BEND)
                ]
            })
        });

        const result = getTonalForTable(createSongMock('C'), section, tableID);

        expect(result.tonalSourceSet).toBe(TonalSourceSet.SINGLENOTE);
        expect(result.normalizedNamedNotes).toEqual(['C', 'E', 'G']);
        expect(result.chords).toEqual(['CM', 'Em#5/C']);
    });

    test('TinyNote source uses playedNotes filtered to tiny-note style only', () => {
        const tableID = 'tblP46_1';
        const section = createSection({
            [tableID]: new SectionNotes({
                tonalSourceSet: TonalSourceSet.TINYNOTE,
                namedNotes: createNamedNotes(['C', 'Db']),
                playedNotes: [
                    ...createPlayedNotes(['C', 'E', 'G', 'B'], Note.STYLENUM_TINY),
                    ...createPlayedNotes(['Db'], Note.STYLENUM_SINGLE),
                    ...createPlayedNotes(['F'], Note.STYLENUM_BEND)
                ]
            })
        });

        const result = getTonalForTable(createSongMock('C'), section, tableID);

        expect(result.tonalSourceSet).toBe(TonalSourceSet.TINYNOTE);
        expect(result.normalizedNamedNotes).toEqual(['C', 'E', 'G', 'B']);
        expect(result.chords).toEqual(['Cmaj7']);
        expect(result.scale).toEqual(['C major', 'C lydian']);
    });

    test('NamedNote source injects noteRoot ahead of the collected notes before chord detection', () => {
        const tableID = 'tblP46_1';
        const rootTableID = 'BASS_1';
        const section = createSection({
            [tableID]: new SectionNotes({
                tonalSourceSet: TonalSourceSet.NAMEDNOTE,
                namedNotes: createNamedNotes(['C', 'E', 'G'])
            }),
            [rootTableID]: new SectionNotes({
                namedNotes: {
                    B: { noteName: 'B', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteRoot' }
                }
            })
        });

        const result = getTonalForTable(createSongMock('C'), section, tableID);

        expect(result.rootKey).toBe('B');
        expect(result.noteRootTablename).toBe(rootTableID);
        expect(result.normalizedNamedNotes).toEqual(['B', 'C', 'E', 'G']);
    });
});