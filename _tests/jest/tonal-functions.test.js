import { Note } from '../../Note.js';
import { SectionNotes } from '../../SectionNotes.js';
import { getTonalForTable, TonalSourceSet } from '../../TonalFunctions.js';
import { createLookupContext, lookupClassForNote } from '../../colorFunctions.js';
import { gUserColorDict } from '../../userColors.js';
import * as Constants from '../../Constants.js';

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
        rootIDLead: '-1',  // Default to "root" (follow Key), can be overridden
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
        noteIDToDisplayName(noteID) {
            // Use the same mapping as the real system
            return Constants.NOTE_NAMES_ARRAY[noteID % Constants.NOTE_NAMES_ARRAY.length] || '';
        },
        getRootKeyLead() {
            // If rootIDLead is '-1', return the main root key, otherwise return the lead key
            if (this.rootIDLead === '-1') {
                return this.noteIDToDisplayName(parseInt(this.rootID, 10));
            }
            return this.noteIDToDisplayName(parseInt(this.rootIDLead, 10));
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
        expect(result.scale).toEqual(['C major pentatonic', 'C major', 'C major blues', 'C lydian', 'C mixolydian', 'C augmented', 'C double harmonic major', 'C chromatic']);
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
        expect(result.scale).toEqual(['C major', 'C lydian', 'C augmented', 'C double harmonic major', 'C chromatic']);
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
        expect(result.scale).toEqual(['C minor', 'C dorian','C chromatic',]);
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
        expect(result.scale).toEqual(['C major', 'C lydian', 'C augmented', 'C double harmonic major', 'C chromatic']);
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

    test('AutoColor keeps noteRoot from shifting section-relative color lookups', () => {
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
        }, '3');

        const rootLookup = lookupClassForNote(
            { noteName: 'B', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteRoot' },
            createLookupContext({
                section,
                autoColor: true,
                tablename: rootTableID,
                noteRootTablename: rootTableID,
                rootID: section.rootID
            })
        );

        const guitarLookup = lookupClassForNote(
            { noteName: 'C', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteTransparent' },
            createLookupContext({
                section,
                autoColor: true,
                tablename: tableID,
                noteRootTablename: rootTableID,
                rootID: section.rootID
            })
        );

        const nonRootBassLookup = lookupClassForNote(
            { noteName: 'B', styleNum: Note.STYLENUM_NAMED, colorClass: 'note1' },
            createLookupContext({
                section,
                autoColor: true,
                tablename: rootTableID,
                noteRootTablename: rootTableID,
                rootID: section.rootID
            })
        );

        const expectedNoteRootClass = gUserColorDict?.dict?.noteRoot?.colorClass;
        expect(rootLookup?.colorClass).toBe(expectedNoteRootClass);
        expect(guitarLookup?.functionNum).toBe(0);
        expect(guitarLookup?.colorClass).toBe(gUserColorDict.dict.note1.colorClass);
        expect(nonRootBassLookup?.colorClass).toBe(gUserColorDict.dict.note12.colorClass);
    });

    test('TinyNote source uses LeadKey as rootKey when LeadKey differs from Key and no noteRoot is placed', () => {
        const tableID = 'tblP46_1';
        const section = createSection({
            [tableID]: new SectionNotes({
                tonalSourceSet: TonalSourceSet.TINYNOTE,
                playedNotes: [
                    ...createPlayedNotes(['D', 'F#', 'A', 'Db'], Note.STYLENUM_TINY)
                ]
            })
        }, '3');  // rootID = 3 (C)
        section.rootIDLead = '5';  // Set LeadKey to D (index 5, different from C)

        const result = getTonalForTable(createSongMock('C'), section, tableID);

        expect(result.tonalSourceSet).toBe(TonalSourceSet.TINYNOTE);
        expect(result.rootKey).toBe('D');  // Should use LeadKey (D) not Key (C)
        // Notes sorted by NOTE_NAMES_ARRAY and rotated to start with D
        expect(result.normalizedNamedNotes).toEqual(['D', 'F#', 'A', 'Db']);
        // Tonal detects this as Dmaj7 (D-F#-A-C#, where Db=C#)
        expect(result.chords).toEqual(['Dmaj7']);
    });

    test('AutoColor uses numeric rootIDLead zero for TinyNote color lookup', () => {
        const section = createSection({}, 10); // rootID = Gb
        section.rootIDLead = 0; // A, numeric zero must not fall back to rootID

        const lookup = lookupClassForNote(
            { noteName: 'D', styleNum: Note.STYLENUM_TINY, colorClass: 'noteTransparent' },
            createLookupContext({
                section,
                autoColor: true
            })
        );

        expect(lookup?.functionNum).toBe(5);
        expect(lookup?.colorClass).toBe(gUserColorDict.dict.note6.colorClass);
    });

    test('TinyNote source ignores LeadKey if noteRoot is explicitly placed', () => {
        const tableID = 'tblP46_1';
        const rootTableID = 'BASS_1';
        const section = createSection({
            [tableID]: new SectionNotes({
                tonalSourceSet: TonalSourceSet.TINYNOTE,
                playedNotes: [
                    ...createPlayedNotes(['D', 'F#', 'A', 'Db'], Note.STYLENUM_TINY)
                ]
            }),
            [rootTableID]: new SectionNotes({
                namedNotes: {
                    G: { noteName: 'G', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteRoot' }
                }
            })
        }, '3');  // rootID = 3 (C)
        section.rootIDLead = '5';  // Set LeadKey to D (but should be ignored because noteRoot exists)

        const result = getTonalForTable(createSongMock('C'), section, tableID);

        expect(result.tonalSourceSet).toBe(TonalSourceSet.TINYNOTE);
        expect(result.rootKey).toBe('G');  // Should use noteRoot (G), not LeadKey (D)
        expect(result.noteRootTablename).toBe(rootTableID);
        // Notes sorted by NOTE_NAMES_ARRAY and rotated to start with G
    });

    test('TinyNote source ignores LeadKey if LeadKey equals Key', () => {
        const tableID = 'tblP46_1';
        const section = createSection({
            [tableID]: new SectionNotes({
                tonalSourceSet: TonalSourceSet.TINYNOTE,
                playedNotes: [
                    ...createPlayedNotes(['C', 'E', 'G', 'B'], Note.STYLENUM_TINY)
                ]
            })
        }, '3');  // rootID = 3 (C)
        section.rootIDLead = '3';  // Set LeadKey to C (same as Key, so no change)

        const result = getTonalForTable(createSongMock('C'), section, tableID);

        expect(result.tonalSourceSet).toBe(TonalSourceSet.TINYNOTE);
        expect(result.rootKey).toBe('C');  // Should remain C (no change when equal)
        expect(result.normalizedNamedNotes).toEqual(['C', 'E', 'G', 'B']);
        expect(result.chords).toEqual(['Cmaj7']);
    });
});