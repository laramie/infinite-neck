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
const { TransposePlugin } = await import('../../plugins/transpose/TransposePlugin.js');

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
    manager.register(new TransposePlugin());
    return manager;
  }

  test('omits untouched plugins from song persistence', () => {
    const manager = createManagerWithPlugins();

    expect(manager.exportSongPluginState()).toEqual({});
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