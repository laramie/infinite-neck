import * as Constants from '../../Constants.js';
import { Note } from '../../Note.js';
import { Song } from '../../Song.js';
import {
  isNotesourceID,
  getNotesourceEntries,
  resolveNotesourceNamedNotes
} from '../../fill/notesource-registry.js';

describe('notesource-registry', () => {
  test('isNotesourceID recognizes only the reserved ns prefix', () => {
    expect(isNotesourceID(`${Constants.NOTESOURCE_ID_PREFIX}EveryNamedNote`)).toBe(true);
    expect(isNotesourceID(`${Constants.TABLE_ID_PREFIX}S6_1`)).toBe(false);
    expect(isNotesourceID('')).toBe(false);
    expect(isNotesourceID(undefined)).toBe(false);
  });

  test('getNotesourceEntries exposes id/caption pairs for the Wiring select optgroup', () => {
    const entries = getNotesourceEntries();
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((entry) => {
      expect(isNotesourceID(entry.id)).toBe(true);
      expect(typeof entry.caption).toBe('string');
      expect(entry.caption.length).toBeGreaterThan(0);
    });
  });

  test('resolveNotesourceNamedNotes returns null for an unregistered id', () => {
    expect(resolveNotesourceNamedNotes('nsDoesNotExist', {})).toBeNull();
  });

  describe('nsPerfect4ths (canonical Perfect4thsCalculator use case)', () => {
    const NOTESOURCE_ID = `${Constants.NOTESOURCE_ID_PREFIX}EveryNamedNote`;

    test('always includes every named note as STYLENUM_NAMED, regardless of Section context', () => {
      const namedNotes = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 3, chartChord: 'Cmaj7' });
      expect(Object.keys(namedNotes).sort()).toEqual([...Constants.NOTE_NAMES_ARRAY].sort());
      Constants.NOTE_NAMES_ARRAY.forEach((noteName) => {
        expect(namedNotes[noteName]).toMatchObject({
          noteName,
          styleNum: Note.STYLENUM_NAMED
        });
      });
    });

    test('the same fixed note set is returned no matter what rootID/section context is passed', () => {
      // This is the mechanism behind Perfect4thsCalculator: the notesource itself does not
      // change between Sections/keys. Recoloring per-Section happens downstream, via the
      // existing AutoColor pipeline (colorFunctions.js::lookupClassForNote) using the live
      // Section's rootID at render time -- not by this resolver computing different notes.
      const namedNotesForC = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 3 }); // C
      const namedNotesForF = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 8 }); // F
      expect(Object.keys(namedNotesForC).sort()).toEqual(Object.keys(namedNotesForF).sort());
    });
  });

  describe('nsChartChordAtRoot', () => {
    const NOTESOURCE_ID = `${Constants.NOTESOURCE_ID_PREFIX}ChartChordAtRoot`;

    test('resolves the chart chord tones transposed onto the given rootID', () => {
      const namedNotesInC = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 3, chartChord: 'C' }); // C major triad
      expect(Object.keys(namedNotesInC).sort()).toEqual(['C', 'E', 'G'].sort());

      // "Always rooted on the noteRoot": same stored chord, different rootID, transposed tones.
      const namedNotesInF = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 8, chartChord: 'C' }); // F
      expect(Object.keys(namedNotesInF).sort()).toEqual(['F', 'A', 'C'].sort());
    });

    test('returns no notes when there is no chart chord', () => {
      const namedNotes = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 3, chartChord: '' });
      expect(Object.keys(namedNotes)).toEqual([]);
    });
  });

  describe('nsChartChordAsCharted', () => {
    const NOTESOURCE_ID = `${Constants.NOTESOURCE_ID_PREFIX}ChartChordAsCharted`;

    test('resolves chart chord tones exactly as charted regardless of section rootID', () => {
      const namedNotesInC = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 3, chartChord: 'C' });
      expect(Object.keys(namedNotesInC).sort()).toEqual(['C', 'E', 'G'].sort());

      const namedNotesInF = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 8, chartChord: 'C' });
      expect(Object.keys(namedNotesInF).sort()).toEqual(['C', 'E', 'G'].sort());
    });

    test('returns no notes when there is no chart chord', () => {
      const namedNotes = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 3, chartChord: '' });
      expect(Object.keys(namedNotes)).toEqual([]);
    });

    test('normalizes sharp note names to model flat names', () => {
      const namedNotes = resolveNotesourceNamedNotes(NOTESOURCE_ID, { rootID: 3, chartChord: 'AM' });
      expect(Object.keys(namedNotes).sort()).toEqual(['A', 'Db', 'E'].sort());
      expect(Object.keys(namedNotes)).not.toContain('C#');
    });
  });

  describe('ghost-table detection', () => {
    const TOOL_TABLE_ID = `${Constants.TABLE_ID_PREFIX}Perfect4thsCalculator_1`;
    const NOTESOURCE_ID = `${Constants.NOTESOURCE_ID_PREFIX}EveryNamedNote`;

    test('a Wiring listening to a notesource is not reported as a ghost table', () => {
      const song = new Song({});
      song.wirings = [
        { tablename: TOOL_TABLE_ID, relativeSection: 'current', listenToTablename: NOTESOURCE_ID }
      ];

      expect(song.getAllModelTableIDs()).not.toContain(NOTESOURCE_ID);
      expect(song.getGhostTableIDs()).not.toContain(NOTESOURCE_ID);
    });

    test('a Wiring listening to a real, unviewed table is still reported as a ghost table', () => {
      const song = new Song({});
      const realListenToTableID = `${Constants.TABLE_ID_PREFIX}SomeOtherTable`;
      song.wirings = [
        { tablename: TOOL_TABLE_ID, relativeSection: 'current', listenToTablename: realListenToTableID }
      ];

      expect(song.getAllModelTableIDs()).toContain(realListenToTableID);
      expect(song.getGhostTableIDs()).toContain(realListenToTableID);
    });
  });
});
