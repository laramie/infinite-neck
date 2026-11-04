import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Song } from '../../Song.js';
import { SongPersistence } from '../../SongPersistence.js';
import { Wiring } from '../../Wiring.js';
import { getThemes } from '../../themeFunctions.js';
import * as PL from '../../printlayout.js';
import { PrintLayoutController } from '../../templates/printlayout/printlayout.controller.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function tuning(baseID, extra = {}) {
  return { instance: true, baseID, baseInstrument: 'Guitar', caption: baseID, nStrings: 2, rowRange: [60, 55], frets: 3, ...extra };
}

describe('printlayout.js: ids', () => {
  test('isPrintTileID recognizes the tile suffix on table ids and base ids only', () => {
    expect(PL.isPrintTileID('tblP46_1__pt3')).toBe(true);
    expect(PL.isPrintTileID('P46_1__pt12')).toBe(true);
    expect(PL.isPrintTileID('tblP46_1')).toBe(false);
    expect(PL.isPrintTileID('tblP46_1__pt')).toBe(false);
    expect(PL.isPrintTileID(undefined)).toBe(false);
  });

  test('mainBaseIDOf strips the table prefix', () => {
    expect(PL.mainBaseIDOf('tblP46_1')).toBe('P46_1');
    expect(PL.mainBaseIDOf('')).toBe('');
  });
});

describe('printlayout.js: normalizePrintOptions', () => {
  const mains = ['tblA', 'tblB'];

  test('defaults', () => {
    const o = PL.normalizePrintOptions(undefined, mains);
    expect(o.grid).toEqual({ rows: PL.PRINT_GRID_DEFAULTS.rows, cols: PL.PRINT_GRID_DEFAULTS.cols, mainTableID: 'tblA', theme: PL.PRINT_GRID_DEFAULTS.theme, scale: 'auto', paper: 'letter-portrait' });
    expect(o.chart).toEqual({ top: true, left: true, leftWidthEm: 4.8, leftPaddingTopEm: 0.15, topPaddingLeftEm: 'align' });
  });

  test('rows and columns are 1-8 and never more than 48 tiles (rows is reduced)', () => {
    expect(PL.normalizePrintOptions({ grid: { rows: 99, cols: 99 } }, mains).grid).toMatchObject({ rows: 6, cols: 8 });
    expect(PL.normalizePrintOptions({ grid: { rows: 8, cols: 6 } }, mains).grid).toMatchObject({ rows: 8, cols: 6 });
    expect(PL.normalizePrintOptions({ grid: { rows: 0, cols: -3 } }, mains).grid).toMatchObject({ rows: 1, cols: 1 });
    expect(PL.normalizePrintOptions({ grid: { rows: 'x', cols: 2 } }, mains).grid.rows).toBe(PL.PRINT_GRID_DEFAULTS.rows);
  });

  test('an unknown Main falls back to the first candidate, and to empty with none', () => {
    expect(PL.normalizePrintOptions({ grid: { mainTableID: 'tblZ' } }, mains).grid.mainTableID).toBe('tblA');
    expect(PL.normalizePrintOptions({ grid: { mainTableID: 'tblB' } }, mains).grid.mainTableID).toBe('tblB');
    expect(PL.normalizePrintOptions({ grid: { mainTableID: 'tblB' } }, []).grid.mainTableID).toBe('');
  });

  test('scale is auto or a clamped percent; paper must be a known paper', () => {
    expect(PL.normalizePrintOptions({ grid: { scale: 'auto' } }, mains).grid.scale).toBe('auto');
    expect(PL.normalizePrintOptions({ grid: { scale: 1000 } }, mains).grid.scale).toBe(400);
    expect(PL.normalizePrintOptions({ grid: { scale: 3 } }, mains).grid.scale).toBe(25);
    expect(PL.normalizePrintOptions({ grid: { scale: '80' } }, mains).grid.scale).toBe('auto');
    expect(PL.normalizePrintOptions({ grid: { paper: 'a4-landscape' } }, mains).grid.paper).toBe('a4-landscape');
    expect(PL.normalizePrintOptions({ grid: { paper: 'tabloid' } }, mains).grid.paper).toBe('letter-portrait');
  });

  test('raw merges over current', () => {
    const current = PL.normalizePrintOptions({ grid: { rows: 2, cols: 4 }, chart: { left: false } }, mains);
    const next = PL.normalizePrintOptions({ grid: { cols: 3 } }, mains, current);
    expect(next.grid).toMatchObject({ rows: 2, cols: 3 });
    expect(next.chart.left).toBe(false);
  });
});

describe('printlayout.js: Main candidates and tiles', () => {
  test('listMainCandidates: visible, not a Tool, not wired, not a tile', () => {
    const myTunings = [tuning('A'), tuning('B'), tuning('T', { Tool: true }), tuning('O'), tuning('A__pt1')];
    const wirings = [{ tablename: 'tblO' }];
    const visibleTableIDs = ['tblA', 'tblB', 'tblT', 'tblO', 'tblA__pt1', 'tblNotInTunings'];
    expect(PL.listMainCandidates({ myTunings, wirings, visibleTableIDs })).toEqual(['tblA', 'tblB']);
    expect(PL.listMainCandidates()).toEqual([]);
  });

  test('planTiles makes rows*cols-1 deep copies as Observers of the Main, +1..+k', () => {
    const opts = PL.normalizePrintOptions({ grid: { rows: 2, cols: 3 } }, ['tblA']);
    const main = tuning('A', { diamonds: [3, 5] });
    const tiles = PL.planTiles(opts, main);
    expect(tiles).toHaveLength(5);
    expect(tiles.map((t) => t.tableID)).toEqual(['tblA__pt1', 'tblA__pt2', 'tblA__pt3', 'tblA__pt4', 'tblA__pt5']);
    expect(tiles.map((t) => t.relativeSection)).toEqual(['+1', '+2', '+3', '+4', '+5']);
    expect(tiles[0].listenToTablename).toBe('tblA');
    expect(tiles[0].tuning.baseID).toBe('A__pt1');
    expect(tiles[0].tuning.diamonds).toEqual([3, 5]);
    expect(tiles[0].tuning.diamonds).not.toBe(main.diamonds);
    expect(main.baseID).toBe('A');
  });

  test('a 1x1 grid has no tiles; no Main means no tiles; the largest grid is 48 tiles', () => {
    expect(PL.planTiles(PL.normalizePrintOptions({ grid: { rows: 1, cols: 1 } }, ['tblA']), tuning('A'))).toEqual([]);
    expect(PL.planTiles(PL.normalizePrintOptions({}, ['tblA']), undefined)).toEqual([]);
    const big = PL.normalizePrintOptions({ grid: { rows: 6, cols: 8 } }, ['tblA']);
    expect(PL.perPage(big)).toBe(48);
    expect(PL.planTiles(big, tuning('A'))).toHaveLength(47);
  });

  test('slots past the last Section are blank', () => {
    const opts = PL.normalizePrintOptions({ grid: { rows: 2, cols: 3 } }, ['tblA']);
    expect(PL.sectionIndexForSlot(4, 0, 6)).toBe(4);
    expect(PL.sectionIndexForSlot(4, 2, 6)).toBeNull();
    expect(PL.hiddenSlots(4, 6, opts)).toEqual([2, 3, 4, 5]);
    expect(PL.hiddenSlots(0, 12, opts)).toEqual([]);
  });
});

describe('printlayout.js: pages', () => {
  const opts = PL.normalizePrintOptions({ grid: { rows: 2, cols: 3 } }, ['tblA']);   // 6 per page

  test('next, previous, first, last are aligned to multiples of the page size', () => {
    expect(PL.nextPageIndex(0, 14, opts)).toBe(6);
    expect(PL.nextPageIndex(8, 14, opts)).toBe(12);
    expect(PL.nextPageIndex(12, 14, opts)).toBeNull();
    expect(PL.previousPageIndex(12, 14, opts)).toBe(6);
    expect(PL.previousPageIndex(8, 14, opts)).toBe(6);
    expect(PL.previousPageIndex(0, 14, opts)).toBeNull();
    expect(PL.firstPageIndex()).toBe(0);
    expect(PL.lastPageIndex(14, opts)).toBe(12);
    expect(PL.lastPageIndex(12, opts)).toBe(6);
    expect(PL.lastPageIndex(0, opts)).toBe(0);
  });

  test('pageInfo labels the Sections shown and flags a sliding window', () => {
    expect(PL.pageInfo(0, 14, opts)).toEqual({ first: 1, last: 6, count: 14, perPage: 6, page: 1, pages: 3, sliding: false });
    expect(PL.pageInfo(12, 14, opts)).toMatchObject({ first: 13, last: 14, page: 3, sliding: false });
    expect(PL.pageInfo(2, 14, opts)).toMatchObject({ first: 3, last: 8, sliding: true });
  });
});

describe('printlayout.js: page size and scale', () => {
  test('the page width is the paper minus the margins, in CSS px', () => {
    expect(PL.pageWidthPx('letter-portrait')).toBe(739);
    expect(PL.pageWidthPx('letter-landscape')).toBe(Math.floor((11 - 0.8) * 96));
    expect(PL.pageWidthPx('a4-portrait')).toBe(Math.floor((8.27 - 0.8) * 96));
    expect(PL.pageWidthPx('nonsense')).toBe(739);
  });

  test('pageSizeCss names the sheet and orientation', () => {
    expect(PL.pageSizeCss('letter-portrait')).toBe('@page { size: letter portrait; margin: 0.4in; }');
    expect(PL.pageSizeCss('a4-landscape')).toBe('@page { size: A4 landscape; margin: 0.4in; }');
  });

  test('trackWidthPx subtracts the gaps; fitScale shrinks the widest tile into the track', () => {
    expect(PL.trackWidthPx({ pageWidthPx: 739, cols: 1 })).toBe(739);
    expect(PL.trackWidthPx({ pageWidthPx: 739, cols: 3 })).toBeCloseTo((739 - 16) / 3, 5);
    const track = PL.trackWidthPx({ pageWidthPx: 739, cols: 3 });
    const scale = PL.fitScale({ trackPx: track, naturalWidthPx: 600 });
    expect(scale).toBeGreaterThan(0.25);
    expect(600 * scale).toBeLessThanOrEqual(track);
    expect(PL.fitScale({ trackPx: 700, naturalWidthPx: 0 })).toBe(1);
    expect(PL.fitScale({ trackPx: 100, naturalWidthPx: 10000 })).toBe(0.25);
    expect(PL.fitScale({ trackPx: 10000, naturalWidthPx: 100 })).toBe(1.5);
  });

  test('effectiveScale: a typed percent wins over the fit', () => {
    expect(PL.effectiveScale('auto', 0.62)).toBe(0.62);
    expect(PL.effectiveScale(80, 0.62)).toBe(0.8);
  });
});

describe('Print theme', () => {
  test('exists, is white with black shadows', () => {
    const theme = getThemes()[PL.PRINT_THEME_PRINT];
    expect(theme).toBeTruthy();
    expect(theme.id).toBe('Print');
  });
});

describe('tiles are never saved', () => {
  function songWithTiles() {
    const song = new Song(JSON.parse(fs.readFileSync(path.join(here, '../../songs/tests/display-options.json'), 'utf8')));
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();
    song.setHeadless(true, true);
    return song;
  }
  const saved = (song) => JSON.parse(JSON.stringify(song, SongPersistence.persistentSongFileReplacer));

  test('tile entries are filtered from myTunings, wirings, noteTablesLayout and sectionNotesByTable', () => {
    const song = songWithTiles();
    song.myTunings = [tuning('A')];
    song.wirings = [];
    song.setNoteTablesLayout([{ tableID: 'tblA', visible: true }]);
    const before = saved(song);

    song.myTunings.push(tuning('A__pt1'));
    song.wirings.push(new Wiring({ tablename: 'tblA__pt1', relativeSection: '+1', listenToTablename: 'tblA' }));
    song.getNoteTablesLayout().push({ tableID: 'tblA__pt1', visible: true });
    const after = saved(song);

    expect(after.myTunings).toEqual(before.myTunings);
    expect(after.wirings).toEqual(before.wirings);
    expect(after.noteTablesLayout).toEqual(before.noteTablesLayout);
    expect(JSON.stringify(after)).not.toContain('__pt');
  });
});

describe('PrintLayoutController (model side, no DOM)', () => {
  let song;
  let reinstalls;
  let gotos;

  beforeEach(() => {
    song = new Song(JSON.parse(fs.readFileSync(path.join(here, '../../songs/tests/display-options.json'), 'utf8')));
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();
    song.setHeadless(true, true);
    song.myTunings = [tuning('A'), tuning('B')];
    song.wirings = [];
    song.setNoteTablesLayout([{ tableID: 'tblA', visible: true }, { tableID: 'tblB', visible: true }]);
    reinstalls = 0;
    gotos = [];
    PrintLayoutController.setProviders({
      getSong: () => song,
      reinstallTables: () => { reinstalls += 1; },
      gotoSection: (idx) => gotos.push(idx)
    });
  });

  test('getOptions reads the Layout and falls back to the first Main', () => {
    const opts = PrintLayoutController.getOptions();
    expect(opts.grid.mainTableID).toBe('tblA');
    expect(PrintLayoutController.getMainChoices().map((c) => c.tableID)).toEqual(['tblA', 'tblB']);
  });

  test('setOptions persists into layout.screenList.print', () => {
    PrintLayoutController.setOptions({ grid: { rows: 2, cols: 2, mainTableID: 'tblB' }, chart: { left: false } });
    const printScreen = song.getLayout().screenList.print;
    expect(printScreen.grid).toMatchObject({ rows: 2, cols: 2, mainTableID: 'tblB' });
    expect(printScreen.chart.left).toBe(false);
  });

  test('buildTiles adds Observer tiles to the model (and only reinstalls once); removeTilesFromModel takes them out', () => {
    const opts = PrintLayoutController.setOptions({ grid: { rows: 2, cols: 2 } });
    PrintLayoutController.buildTiles(opts);
    expect(reinstalls).toBe(1);
    expect(song.myTunings.map((t) => t.baseID)).toEqual(['A', 'B', 'A__pt1', 'A__pt2', 'A__pt3']);
    expect(song.wirings.map((w) => [w.tablename, w.relativeSection, w.listenToTablename])).toEqual([
      ['tblA__pt1', '+1', 'tblA'], ['tblA__pt2', '+2', 'tblA'], ['tblA__pt3', '+3', 'tblA']
    ]);
    expect(song.getNoteTablesLayout().filter((e) => PL.isPrintTileID(e.tableID))).toHaveLength(3);

    PrintLayoutController.buildTiles(PrintLayoutController.setOptions({ grid: { rows: 1, cols: 2 } }));
    expect(song.myTunings.map((t) => t.baseID)).toEqual(['A', 'B', 'A__pt1']);

    PrintLayoutController.removeTilesFromModel(song);
    expect(song.myTunings.map((t) => t.baseID)).toEqual(['A', 'B']);
    expect(song.wirings).toEqual([]);
    expect(song.getNoteTablesLayout().map((e) => e.tableID)).toEqual(['tblA', 'tblB']);
  });

  test('getThemeToSave is null unless print is active', () => {
    expect(PrintLayoutController.getThemeToSave()).toBeNull();
  });
});
