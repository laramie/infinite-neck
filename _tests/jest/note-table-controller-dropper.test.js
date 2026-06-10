import {
  findDropperNoteForCell
} from '../../NoteTableController.js';
import { Note } from '../../Note.js';

function createSection(sectionNotesByTable) {
  return {
    sectionNotesByTable,
    getSectionNotes(tableID) {
      return this.sectionNotesByTable[tableID] || null;
    }
  };
}

describe('NoteTableController dropper lookup', () => {
  test('finds NamedNotes from SectionNotes by note name', () => {
    const namedNote = {
      noteName: 'C',
      styleNum: Note.STYLENUM_NAMED,
      colorClass: 'noteRoot'
    };
    const section = createSection({
      tblUser: {
        namedNotes: {
          C: namedNote
        },
        playedNotes: []
      }
    });

    const result = findDropperNoteForCell({
      section,
      tableID: 'tblUser',
      cellrow: '0',
      cellcol: '3',
      styleNum: Note.STYLENUM_NAMED,
      noteName: 'C'
    });

    expect(result).toBe(namedNote);
  });

  test('finds played notes from SectionNotes by cell and style', () => {
    const singleNote = {
      noteName: 'A',
      styleNum: Note.STYLENUM_SINGLE,
      row: '2',
      col: '5',
      colorClass: 'noteChord'
    };
    const bendNote = {
      noteName: 'Bb',
      styleNum: Note.STYLENUM_BEND,
      row: '2',
      col: '5',
      colorClass: 'noteTransparent',
      bendValue: 'semitone1'
    };
    const section = createSection({
      tblUser: {
        namedNotes: {},
        playedNotes: [singleNote, bendNote]
      }
    });

    const singleResult = findDropperNoteForCell({
      section,
      tableID: 'tblUser',
      cellrow: '2',
      cellcol: '5',
      styleNum: Note.STYLENUM_SINGLE
    });
    const bendResult = findDropperNoteForCell({
      section,
      tableID: 'tblUser',
      cellrow: '2',
      cellcol: '5',
      styleNum: Note.STYLENUM_BEND
    });

    expect(singleResult).toBe(singleNote);
    expect(bendResult).toBe(bendNote);
  });
});