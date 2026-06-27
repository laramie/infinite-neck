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

jest.unstable_mockModule('../../looper.js', () => ({
  clearBeatAndSectionLooping: jest.fn(),
  sectionsLooping: jest.fn(() => false),
  beatsLooping: jest.fn(() => false)
}));

jest.unstable_mockModule('../../infinite-neck.js', () => ({
  getSong: mockGetSong,
  transposeSong: mockTransposeSong
}));

const { PluginManager } = await import('../../plugins/PluginManager.js');
const { ArpeggioPlugin } = await import('../../plugins/arpeggio/ArpeggioPlugin.js');
const { FillPlugin } = await import('../../plugins/fill/FillPlugin.js');

function createSongWithSectionPluginData() {
  const sections = [
    {
      pluginData: {
        arpeggio: {
          positions: [[0, 3], [4, 7]],
          lastPositionIndex: 1
        },
        fill: {
          positions: [[0, 2], [3, 5]],
          lastPositionIndex: 0,
          customExtra: true
        }
      },
      getSectionNotes() {
        return { playedNotes: [], namedNotes: {}, recordedNotes: {} };
      }
    },
    {
      pluginData: {
        arpeggio: {
          positions: [[5, 8]],
          lastPositionIndex: 0
        }
      },
      getSectionNotes() {
        return { playedNotes: [], namedNotes: {}, recordedNotes: {} };
      }
    }
  ];

  const song = {
    name: 'audit-fixture',
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
    sections,
    plugins: {
      arpeggio: {
        properties: {
          targetTable: 'tblP46_1',
          minFret: 0,
          maxFret: 12,
          minRow: 1,
          maxRow: 6
        }
      },
      fill: {
        properties: {
          targetTable: 'tblP46_1',
          minFret: 0,
          maxFret: 8,
          minRow: 1,
          maxRow: 6
        }
      },
      transpose: {
        properties: {
          intervals: [0, 2, 4, 5, 7, 9, 11]
        }
      }
    },
    getSections() {
      return this.sections;
    },
    getCurrentSection() {
      return this.sections[0];
    },
    graveyard: {
      records: [],
      bury() {
        return {};
      },
      buryReplacing() {
        return {};
      }
    }
  };

  return song;
}

describe('Plugin audit', () => {
  beforeEach(() => {
    mockEventBus.on.mockClear();
    mockEventBus.off.mockClear();
    mockEventBus.trigger.mockClear();
    mockGetSong.mockClear();
    mockTransposeSong.mockClear();
  });

  function createManager() {
    const manager = new PluginManager(mockEventBus);
    manager.register(new ArpeggioPlugin());
    manager.register(new FillPlugin());
    return manager;
  }

  test('appends A) Audit plugins after runtime plugin menu entries', () => {
    const manager = createManager();

    const children = manager.buildPluginsMenuChildren();
    const lastNode = children[children.length - 1];

    expect(lastNode.name).toBe('pluginAudit');
    expect(lastNode.trigger).toBe('A');
    expect(lastNode.action).toBe('pluginAction:audit');
    expect(lastNode.caption).toContain('Audit plugins');
  });

  test('pluginAction:audit returns showMessages HTML report with current section row highlight and native pair highlight', () => {
    const manager = createManager();
    const song = createSongWithSectionPluginData();
    manager.loadSongPluginState(song);

    const result = manager.invokeMenuAction({ action: 'pluginAction:audit' });

    expect(result.result).toBe('plugin audit');
    expect(result.message).toContain('Plugin Audit');
    expect(result.message).toContain('sectionPrinterCurrentSectionRow');
    expect(result.message).toContain('arpeggioCurrentPositionPair');
    expect(result.message).toContain('fillCurrentPositionPair');
    expect(result.message).toContain('fill.customExtra');
    expect(result.message).toContain('Plugin Audit: Song-Level Persisted Properties');
    expect(result.message).toContain('Plugin Audit: Section-Level pluginData');
  });
});
