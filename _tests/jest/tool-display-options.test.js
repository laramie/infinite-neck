import { Song } from '../../Song.js';
import * as Constants from '../../Constants.js';

const TOOL_TABLE_ID = `${Constants.TABLE_ID_PREFIX}Perfect4thsCalculator_1`;

describe('noteTablesLayout[].ToolDisplayOptions persistence', () => {
  test('setToolDisplayOptions creates a layout entry with a deep-cloned copy', () => {
    const song = new Song({});
    const source = { autoColor: true, currentColorDict: 'user' };

    song.setToolDisplayOptions(TOOL_TABLE_ID, source);

    // Mutate the original object after freezing; the stored copy must be independent.
    source.autoColor = false;

    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TOOL_TABLE_ID);
    expect(entry).toBeDefined();
    expect(entry.ToolDisplayOptions).toEqual({ autoColor: true, currentColorDict: 'user' });
  });

  test('does not include rootID/rootIDLead/sharps/noteNamesFuncArr unless the caller explicitly puts them in (the caller is responsible for only passing controlsToDisplayOptions() output)', () => {
    const song = new Song({});
    song.setToolDisplayOptions(TOOL_TABLE_ID, { autoColor: true });

    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TOOL_TABLE_ID);
    expect(entry.ToolDisplayOptions.rootID).toBeUndefined();
    expect(entry.ToolDisplayOptions.rootIDLead).toBeUndefined();
    expect(entry.ToolDisplayOptions.sharps).toBeUndefined();
    expect(entry.ToolDisplayOptions.noteNamesFuncArr).toBeUndefined();
  });

  test('ToolDisplayOptions survives repeated getNoteTablesLayout() calls (the runtime normalizer)', () => {
    const song = new Song({});
    song.setToolDisplayOptions(TOOL_TABLE_ID, { autoColor: true, tinyNoteRadius: '3' });

    // Call getNoteTablesLayout() several times, as normal rendering code does on every replay().
    song.getNoteTablesLayout();
    song.getNoteTablesLayout();
    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TOOL_TABLE_ID);

    expect(entry.ToolDisplayOptions).toEqual({ autoColor: true, tinyNoteRadius: '3' });
  });

  test('ToolDisplayOptions survives a full save/load round trip (SongPersistence normalizeLayoutEntry)', () => {
    const song = new Song({});
    song.setToolDisplayOptions(TOOL_TABLE_ID, { autoColor: true, currentColorDict: 'user' });

    const json = JSON.parse(song.getPersistentSongFile());
    const reloadedSong = new Song(json);

    const entry = reloadedSong.getNoteTablesLayout().find((one) => one.tableID === TOOL_TABLE_ID);
    expect(entry).toBeDefined();
    expect(entry.ToolDisplayOptions).toEqual({ autoColor: true, currentColorDict: 'user' });
  });

  test('boolean layout flags (e.g. CaptionLeft) continue to work alongside ToolDisplayOptions', () => {
    const song = new Song({});
    song.setToolDisplayOptions(TOOL_TABLE_ID, { autoColor: true });
    song.setNoteTablesLayoutOption(TOOL_TABLE_ID, 'CaptionLeft', true);

    const json = JSON.parse(song.getPersistentSongFile());
    const reloadedSong = new Song(json);
    const entry = reloadedSong.getNoteTablesLayout().find((one) => one.tableID === TOOL_TABLE_ID);

    expect(entry.CaptionLeft).toBe(true);
    expect(entry.ToolDisplayOptions).toEqual({ autoColor: true });
  });

  test('clearToolDisplayOptions removes the frozen snapshot, leaving the entry (and its other keys) intact', () => {
    const song = new Song({});
    song.setToolDisplayOptions(TOOL_TABLE_ID, { autoColor: true });
    song.setNoteTablesLayoutOption(TOOL_TABLE_ID, 'CaptionLeft', true);

    song.clearToolDisplayOptions(TOOL_TABLE_ID);

    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TOOL_TABLE_ID);
    expect(entry.ToolDisplayOptions).toBeUndefined();
    expect(entry.CaptionLeft).toBe(true);
  });

  test('clearToolDisplayOptions on a tableID with no layout entry is a no-op, not an error', () => {
    const song = new Song({});
    expect(() => song.clearToolDisplayOptions(TOOL_TABLE_ID)).not.toThrow();
  });

  test('a Tool tuning with no ToolDisplayOptions has no ToolDisplayOptions key at all (valid: follows current Section)', () => {
    const song = new Song({
      myTunings: [{ baseID: 'Perfect4thsCalculator_1', fromBaseID: 'Perfect4thsCalculator', Tool: true }]
    });
    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TOOL_TABLE_ID);
    expect(entry).toBeDefined();
    expect(entry.ToolDisplayOptions).toBeUndefined();
  });
});
