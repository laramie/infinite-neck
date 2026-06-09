import { Section } from '../../Section.js';

describe('Section V2 cleanup', () => {
  test('removeEmptyTables drops table with only empty recorded beat arrays', () => {
    const section = new Section({
      sectionNotesByTable: {
        tblDADGAD_1: {
          namedNotes: {},
          recordedNotes: {
            '1': [],
            '2': [],
            '3': [],
            '4': []
          },
          playedNotes: []
        }
      }
    });

    section.removeEmptyTables();

    expect(section.sectionNotesByTable.tblDADGAD_1).toBeUndefined();
  });

  test('removeEmptyTables prunes empty beats but keeps table with recorded notes', () => {
    const section = new Section({
      sectionNotesByTable: {
        tblS6_1: {
          namedNotes: {},
          recordedNotes: {
            '1': [],
            '2': [{ noteName: 'A', midinum: '57', row: '0', col: '0', styleNum: 1 }],
            '3': []
          },
          playedNotes: []
        }
      }
    });

    section.removeEmptyTables();

    expect(section.sectionNotesByTable.tblS6_1).toBeDefined();
    expect(section.sectionNotesByTable.tblS6_1.recordedNotes['1']).toBeUndefined();
    expect(section.sectionNotesByTable.tblS6_1.recordedNotes['3']).toBeUndefined();
    expect(section.sectionNotesByTable.tblS6_1.recordedNotes['2']).toHaveLength(1);
  });

  test('removeEmptyTables keeps table with noteTransparent named notes', () => {
    const section = new Section({
      sectionNotesByTable: {
        tblP46_1: {
          namedNotes: {
            F: { noteName: 'F', colorClass: 'noteTransparent', styleNum: 0 },
            A: { noteName: 'A', colorClass: 'noteTransparent', styleNum: 0 }
          },
          recordedNotes: {},
          playedNotes: []
        }
      }
    });

    section.removeEmptyTables();

    expect(section.sectionNotesByTable.tblP46_1).toBeDefined();
    expect(Object.keys(section.sectionNotesByTable.tblP46_1.namedNotes)).toEqual(['F', 'A']);
  });
});
