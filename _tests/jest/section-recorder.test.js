import { jest } from '@jest/globals';

let currentSection = null;

const { Note } = await import('../../Note.js');
const { SectionNotes } = await import('../../SectionNotes.js');
const { setSectionRecorderProviders, recordHighlight } = await import('../../section-recorder.js');

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
});