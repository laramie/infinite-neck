import { jest } from '@jest/globals';

const mockEventBus = {
  on: jest.fn(),
  off: jest.fn(),
  trigger: jest.fn()
};

const mockGetSong = jest.fn(() => null);
const mockTransposeSong = jest.fn();

jest.unstable_mockModule('../../menu.js', () => ({
  gMenuFile: {
    children: []
  }
}));

jest.unstable_mockModule('../../infinite-neck.js', () => ({
  getSong: mockGetSong,
  transposeSong: mockTransposeSong
}));

const { PluginManager } = await import('../../plugins/PluginManager.js');
const { ArpeggioPlugin } = await import('../../plugins/arpeggio/ArpeggioPlugin.js');
const { FillPlugin } = await import('../../plugins/fill/FillPlugin.js');
const { TransposePlugin } = await import('../../plugins/transpose/TransposePlugin.js');
const Constants = await import('../../Constants.js');

describe('PluginManager plugin persistence', () => {
  beforeEach(() => {
    mockEventBus.on.mockClear();
    mockEventBus.off.mockClear();
    mockEventBus.trigger.mockClear();
    mockGetSong.mockClear();
    mockTransposeSong.mockClear();
  });

  function createManagerWithPlugins() {
    const manager = new PluginManager(mockEventBus);
    manager.register(new ArpeggioPlugin());
    manager.register(new FillPlugin());
    manager.register(new TransposePlugin());
    return manager;
  }

  function createSongWithTunings() {
    const section = {
      rootID: 3,
      sectionNotesByTable: {},
      getSectionNotes(tableID) {
        if (!this.sectionNotesByTable[tableID]) {
          this.sectionNotesByTable[tableID] = { playedNotes: [], namedNotes: {}, recordedNotes: {} };
        }
        return this.sectionNotesByTable[tableID];
      }
    };

    return {
      myTunings: [
        {
          baseID: 'P46_1',
          frets: 24,
          rowRange: [64, 59, 55, 50, 45, 40],
          nut: true,
          reverse: false
        }
      ],
      wirings: [],
      sections: [section],
      getCurrentSection() {
        return section;
      }
    };
  }

  test('omits untouched plugins from song persistence', () => {
    const manager = createManagerWithPlugins();

    expect(manager.exportSongPluginState()).toEqual({});
  });

  test('does not persist FillPlugin after dynamic defaults initialize on song load', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();

    manager.loadSongPluginState(song);

    expect(manager.exportSongPluginState()).toEqual({});
  });

  test('does not persist FillPlugin after opening its options menu on an untouched song', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();

    manager.loadSongPluginState(song);
    manager.getPluginById('fill').getVisibleMenuChildren();

    expect(manager.exportSongPluginState()).toEqual({});
  });

  test('does not persist FillPlugin after an early refresh before any target tuning exists', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    const [primaryTuning] = song.myTunings;
    song.myTunings = [];

    manager.loadSongPluginState(song);
    manager.getPluginById('fill').getVisibleMenuChildren();

    song.myTunings = [primaryTuning];

    expect(manager.exportSongPluginState()).toEqual({});
    expect(manager.getPluginById('fill').getProperty('maxFret').getValue()).toBe(Constants.FIRST_POSITION_MAX_FRET);
  });

  test('ignores the legacy empty Fill stub on song load', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    song.plugins = {
      fill: {
        enabled: false,
        enableOnSongLoad: false,
        properties: {
          targetTable: '',
          chordFormula: '4,7',
          scaleFormula: '0,2,4,5,7,9,11',
          minFret: 0,
          maxFret: 0,
          minRow: 0,
          maxRow: 0,
          rootMode: 'role',
          rootColor: 'noteRoot',
          chordMode: 'role',
          chordColor: 'noteChord',
          scaleMode: 'role',
          scaleColor: 'noteScale'
        }
      }
    };

    manager.loadSongPluginState(song);

    expect(manager.exportSongPluginState()).toEqual({});
    expect(manager.getPluginById('fill').getProperty('maxFret').getValue()).toBe(Constants.FIRST_POSITION_MAX_FRET);
  });

  test('does not persist a plugin that was only manually enabled for the current session', () => {
    const manager = createManagerWithPlugins();
    const entry = manager.getPluginEntry('transpose');

    manager.setPropertyValue(entry, 'enabled', true);

    expect(manager.exportSongPluginState()).toEqual({});
  });

  test('persists a plugin after a save-facing property changes', () => {
    const manager = createManagerWithPlugins();
    const entry = manager.getPluginEntry('transpose');

    manager.setPropertyValue(entry, 'PlayedNotes', true);

    expect(manager.exportSongPluginState()).toEqual({
      transpose: {
        enabled: false,
        enableOnSongLoad: false,
        properties: {
          intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          NamedNotes: true,
          PlayedNotes: true,
          RecordedNotes: false
        }
      }
    });
  });

  test('persists a plugin when load enabled changes even if other properties remain at defaults', () => {
    const manager = createManagerWithPlugins();
    const entry = manager.getPluginEntry('transpose');

    manager.setPropertyValue(entry, 'enableOnSongLoad', true);

    expect(manager.exportSongPluginState()).toEqual({
      transpose: {
        enabled: false,
        enableOnSongLoad: true,
        properties: {
          intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          NamedNotes: true,
          PlayedNotes: false,
          RecordedNotes: false
        }
      }
    });
  });
});