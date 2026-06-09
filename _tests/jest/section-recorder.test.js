import { jest } from '@jest/globals';

let currentSection = null;

const { Note } = await import('../../Note.js');
const { SectionNotes } = await import('../../SectionNotes.js');
const {
  setSectionRecorderProviders,
  recordHighlight,
  recordHighlightSingle,
  unRecordPlayedNote
} = await import('../../section-recorder.js');

describe('section-recorder highlight recording', () => {
  beforeEach(() => {
    currentSection = {
      sectionNotesByTable: {},
      getSectionNotes(tableID) {
        if (!this.sectionNotesByTable[tableID]) {
          this.sectionNotesByTable[tableID] = new SectionNotes();
        }
        return this.sectionNotesByTable[tableID];
      }
    };

    setSectionRecorderProviders({
      getCurrentSection: () => currentSection,
      clearHighlights: jest.fn()
    });
  });

  test('recordHighlight keeps only one STYLENUM_MIDIPITCHES note per beat', () => {
    const tableID = 'tblS6_1';
    const recordedNotes = currentSection.getSectionNotes(tableID).recordedNotes;
    recordedNotes['1'] = [
      { noteName: 'C', styleNum: Note.STYLENUM_MIDIPITCHES, midinum: '60', row: '2' },
      { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, midinum: '62', row: '2', col: '0' }
    ];

    recordHighlight(tableID, false, Note.STYLENUM_MIDIPITCHES, '1', '61', '3', 'Db');

    expect(recordedNotes['1']).toEqual([
      { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, midinum: '62', row: '2', col: '0' },
      { noteName: 'Db', styleNum: Note.STYLENUM_MIDIPITCHES, midinum: '61', row: '3' }
    ]);
  });

  test('recordHighlight erase deletes empty beat bucket', () => {
    const tableID = 'tblS6_1';
    const recordedNotes = currentSection.getSectionNotes(tableID).recordedNotes;
    recordedNotes['2'] = [
      { noteName: 'D', styleNum: Note.STYLENUM_MIDIPITCHES, midinum: '62', row: '2' }
    ];

    recordHighlight(tableID, true, Note.STYLENUM_MIDIPITCHES, '2', '62', '2', 'D');

    expect(recordedNotes['2']).toBeUndefined();
  });

  test('recordHighlightSingle erase deletes empty beat bucket', () => {
    const tableID = 'tblS6_1';
    const recordedNotes = currentSection.getSectionNotes(tableID).recordedNotes;
    recordedNotes['3'] = [
      { noteName: 'E', styleNum: Note.STYLENUM_SINGLE, midinum: '64', row: '2', col: '1' }
    ];

    recordHighlightSingle(tableID, true, Note.STYLENUM_SINGLE, '3', '64', '2', 'E');

    expect(recordedNotes['3']).toBeUndefined();
  });

  test('unRecordPlayedNote deletes empty beat bucket', () => {
    const tableID = 'tblS6_1';
    const recordedNotes = currentSection.getSectionNotes(tableID).recordedNotes;
    recordedNotes['4'] = [
      { noteName: 'F', styleNum: Note.STYLENUM_TINY, midinum: '65', row: '1', col: '0' }
    ];

    unRecordPlayedNote(tableID, '4', {
      noteName: 'F',
      styleNum: Note.STYLENUM_TINY,
      midinum: '65',
      row: '1',
      col: '0'
    });

    expect(recordedNotes['4']).toBeUndefined();
  });
});