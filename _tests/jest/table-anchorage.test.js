import { Song } from '../../Song.js';
import * as Constants from '../../Constants.js';

const TABLE_ID = `${Constants.TABLE_ID_PREFIX}Perfect4thsCalculator_singleton`;

describe('noteTablesLayout[].anchorage persistence (sprint-141 Iteration 3)', () => {
  test('setTableFloated(true) creates a layout entry with anchorage.floated', () => {
    const song = new Song({});
    song.setTableFloated(TABLE_ID, true);

    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TABLE_ID);
    expect(entry).toBeDefined();
    expect(entry.anchorage).toEqual({ floated: true });
  });

  test('setTableFloatRect only keeps finite numeric left/top/width/height keys', () => {
    const song = new Song({});
    song.setTableFloatRect(TABLE_ID, { left: 10, top: 20, width: 'nope', height: NaN, extra: 5 });

    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TABLE_ID);
    expect(entry.anchorage.floatRect).toEqual({ left: 10, top: 20 });
  });

  test('setTableFloated and setTableFloatRect merge into the same anchorage object', () => {
    const song = new Song({});
    song.setTableFloated(TABLE_ID, true);
    song.setTableFloatRect(TABLE_ID, { left: 12, top: 12, width: 40, height: 30 });

    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TABLE_ID);
    expect(entry.anchorage).toEqual({
      floated: true,
      floatRect: { left: 12, top: 12, width: 40, height: 30 }
    });
  });

  test('docking (setTableFloated(false)) preserves a previously-saved floatRect', () => {
    const song = new Song({});
    song.setTableFloated(TABLE_ID, true);
    song.setTableFloatRect(TABLE_ID, { left: 12, top: 12, width: 40, height: 30 });

    song.setTableFloated(TABLE_ID, false);

    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TABLE_ID);
    expect(entry.anchorage.floated).toBe(false);
    expect(entry.anchorage.floatRect).toEqual({ left: 12, top: 12, width: 40, height: 30 });
  });

  test('getTableAnchorage returns null when no anchorage has been set', () => {
    const song = new Song({});
    song.setTableVisibilityByTableID(TABLE_ID, true);
    expect(song.getTableAnchorage(TABLE_ID)).toBeNull();
  });

  test('getTableAnchorage returns the stored anchorage object', () => {
    const song = new Song({});
    song.setTableFloated(TABLE_ID, true);
    expect(song.getTableAnchorage(TABLE_ID)).toEqual({ floated: true });
  });

  test('anchorage survives a full save/load round trip (SongPersistence normalizeLayoutEntry)', () => {
    const song = new Song({});
    song.setTableFloated(TABLE_ID, true);
    song.setTableFloatRect(TABLE_ID, { left: 5, top: 6, width: 7, height: 8 });

    const json = JSON.parse(song.getPersistentSongFile());
    const reloadedSong = new Song(json);

    const entry = reloadedSong.getNoteTablesLayout().find((one) => one.tableID === TABLE_ID);
    expect(entry).toBeDefined();
    expect(entry.anchorage).toEqual({
      floated: true,
      floatRect: { left: 5, top: 6, width: 7, height: 8 }
    });
  });

  test('anchorage survives repeated getNoteTablesLayout() calls (the runtime normalizer)', () => {
    const song = new Song({});
    song.setTableFloated(TABLE_ID, true);
    song.setTableFloatRect(TABLE_ID, { left: 1, top: 2, width: 3, height: 4 });

    song.getNoteTablesLayout();
    song.getNoteTablesLayout();
    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TABLE_ID);

    expect(entry.anchorage).toEqual({
      floated: true,
      floatRect: { left: 1, top: 2, width: 3, height: 4 }
    });
  });

  test('anchorage coexists with ToolDisplayOptions and boolean layout flags', () => {
    const song = new Song({});
    song.setTableFloated(TABLE_ID, true);
    song.setToolDisplayOptions(TABLE_ID, { autoColor: true });
    song.setNoteTablesLayoutOption(TABLE_ID, 'CaptionLeft', true);

    const json = JSON.parse(song.getPersistentSongFile());
    const reloadedSong = new Song(json);
    const entry = reloadedSong.getNoteTablesLayout().find((one) => one.tableID === TABLE_ID);

    expect(entry.anchorage).toEqual({ floated: true });
    expect(entry.ToolDisplayOptions).toEqual({ autoColor: true });
    expect(entry.CaptionLeft).toBe(true);
  });

  test('no anchorage present is a valid, legal state (table opened today, never floated)', () => {
    const song = new Song({});
    song.setTableVisibilityByTableID(TABLE_ID, true);

    const entry = song.getNoteTablesLayout().find((one) => one.tableID === TABLE_ID);
    expect(entry.anchorage).toBeUndefined();
  });
});
