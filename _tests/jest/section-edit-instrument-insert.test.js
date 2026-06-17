import { jest } from '@jest/globals';
import { Song } from '../../Song.js';
import { Section } from '../../Section.js';
import { Note } from '../../Note.js';

function makeSection(sectionNotesByTable = {}) {
  return new Section({ sectionNotesByTable });
}

describe('Song.insertCloneTableIntoSection', () => {
  test('inserts selected table clone into an empty destination table slot', () => {
    const tableID = 'tblP46';
    const song = new Song({
      sections: [
        makeSection({
          [tableID]: {
            recordedNotes: {
              '1': [{ noteName: 'A', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '1' }]
            }
          }
        }),
        makeSection({
          tblOther: {
            playedNotes: [{ noteName: 'E', styleNum: Note.STYLENUM_SINGLE, row: '1', col: '2' }]
          }
        })
      ]
    });
    song.gSectionsCurrentIndex = 0;
    song.requestUiClearAll = jest.fn();
    song.requestUiResetNoteNames = jest.fn();
    song.publish_SectionChanged = jest.fn();

    const result = song.insertCloneTableIntoSection(tableID, 2);

    expect(result.inserted).toBe(true);
    expect(song.sections[1].sectionNotesByTable[tableID].recordedNotes['1'][0].noteName).toBe('A');
    expect(song.sections[1].sectionNotesByTable.tblOther.playedNotes[0].noteName).toBe('E');
    expect(song.requestUiClearAll).toHaveBeenCalledTimes(1);
    expect(song.requestUiResetNoteNames).toHaveBeenCalledTimes(1);
    expect(song.publish_SectionChanged).toHaveBeenCalledTimes(1);
  });

  test('rejects missing destination, current destination, non-empty destination, and empty source', () => {
    const tableID = 'tblP46';
    const song = new Song({
      sections: [
        makeSection({
          [tableID]: {
            playedNotes: [{ noteName: 'A', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '1' }]
          }
        }),
        makeSection({
          [tableID]: {
            playedNotes: [{ noteName: 'B', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '2' }]
          }
        }),
        makeSection()
      ]
    });
    song.gSectionsCurrentIndex = 0;

    expect(song.insertCloneTableIntoSection(tableID, 9)).toEqual(expect.objectContaining({
      inserted: false,
      reason: 'Section 9 not found'
    }));
    expect(song.insertCloneTableIntoSection(tableID, 1)).toEqual(expect.objectContaining({
      inserted: false,
      reason: 'Section 1 is current'
    }));
    expect(song.insertCloneTableIntoSection(tableID, 2)).toEqual(expect.objectContaining({
      inserted: false,
      reason: 'tblP46 not empty in Section 2'
    }));

    song.gSectionsCurrentIndex = 2;
    expect(song.insertCloneTableIntoSection(tableID, 2)).toEqual(expect.objectContaining({
      inserted: false,
      reason: 'no notes for tblP46'
    }));
  });
});
