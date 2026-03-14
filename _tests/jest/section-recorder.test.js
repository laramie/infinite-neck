import {
    setSectionRecorderProviders,
    recordPlayedNote,
    recordingHasPlayedNote,
    unRecordPlayedNote,
    getRecordedNotesForSection
} from '../../section-recorder.js';
import { Note } from '../../note.js';

describe('section recorder played-note identity', () => {
    let currentSection;

    beforeEach(() => {
        currentSection = { recordedNotes: {} };
        setSectionRecorderProviders({
            getCurrentSection: () => currentSection,
            clearHighlights: () => {}
        });
    });

    test('distinguishes otherwise identical played notes by tableID', () => {
        const recorded = {
            midinum: '60',
            row: '2',
            styleNum: Note.STYLENUM_SINGLE,
            tableID: 'tableA'
        };

        recordPlayedNote('1', recorded);

        expect(recordingHasPlayedNote('1', recorded)).toBe(true);
        expect(recordingHasPlayedNote('1', {
            midinum: '60',
            row: '2',
            styleNum: Note.STYLENUM_SINGLE,
            tableID: 'tableB'
        })).toBe(false);
    });

    test('unrecord removes only the matching table-owned note', () => {
        recordPlayedNote('1', {
            midinum: '60',
            row: '2',
            styleNum: Note.STYLENUM_TINY,
            tableID: 'tableA'
        });
        recordPlayedNote('1', {
            midinum: '60',
            row: '2',
            styleNum: Note.STYLENUM_TINY,
            tableID: 'tableB'
        });

        unRecordPlayedNote('1', {
            midinum: '60',
            row: '2',
            styleNum: Note.STYLENUM_TINY,
            tableID: 'tableA'
        });

        expect(getRecordedNotesForSection()['1']).toEqual([
            {
                midinum: '60',
                row: '2',
                styleNum: Note.STYLENUM_TINY,
                tableID: 'tableB'
            }
        ]);
    });

    test('legacy notes without tableID still match by midi row and style', () => {
        recordPlayedNote('1', {
            midinum: '64',
            row: '3',
            styleNum: Note.STYLENUM_BEND,
            bendValue: 'bUp'
        });

        expect(recordingHasPlayedNote('1', {
            midinum: '64',
            row: '3',
            styleNum: Note.STYLENUM_BEND
        })).toBe(true);

        unRecordPlayedNote('1', {
            midinum: '64',
            row: '3',
            styleNum: Note.STYLENUM_BEND
        });

        expect(getRecordedNotesForSection()['1']).toEqual([]);
    });
});