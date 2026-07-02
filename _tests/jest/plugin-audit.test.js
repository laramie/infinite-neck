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
const { TransposePlugin } = await import('../../plugins/transpose/TransposePlugin.js');
const { ClipPlugin } = await import('../../plugins/clip/ClipPlugin.js');
const { MovePlugin } = await import('../../plugins/move/MovePlugin.js');

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
    manager.register(new ClipPlugin());
    manager.register(new FillPlugin());
    manager.register(new MovePlugin());
    manager.register(new TransposePlugin());
    return manager;
  }

  test('appends bold-trigger Audit plugins after runtime plugin menu entries', () => {
    const manager = createManager();

    const children = manager.buildPluginsMenuChildren();
    const lastNode = children[children.length - 1];

    expect(lastNode.name).toBe('pluginAudit');
    expect(lastNode.trigger).toBe('A');
    expect(lastNode.action).toBe('pluginAction:audit');
    expect(lastNode.caption).toBe('<b>A</b>udit plugins');
  });

  test('pluginAction:audit returns showMessages HTML report with current section row highlight and native pair highlight', () => {
    const manager = createManager();
    const song = createSongWithSectionPluginData();
    manager.loadSongPluginState(song);
    const arpeggioEntry = manager.getPluginEntry('arpeggio');
    manager.setPropertyValue(arpeggioEntry, 'enabled', true);
    manager.setPropertyValue(arpeggioEntry, 'type', 'SingleNote');
    manager.setPropertyValue(arpeggioEntry, 'colorNotes', true);

    const result = manager.invokeMenuAction({ action: 'pluginAction:audit' });

    expect(result.result).toBe('plugin audit');
    expect(result.message).toContain('Plugin Audit');
    expect(result.message).toContain('sectionPrinterCurrentSectionRow');
    expect(result.message).toContain('arpeggioCurrentPositionPair');
    expect(result.message).toContain('fillCurrentPositionPair');
    expect(result.message).toContain('<th scope=\'col\'>plugin</th>');
    expect(result.message).toContain('<span>enabled</span>');
    expect(result.message).toContain('<span>persisted</span>');
    expect(result.message).toContain('<span>Instrument</span>');
    expect(result.message).toContain('<span>chroma</span>');
    expect(result.message).toContain('<span>inputs</span>');
    expect(result.message).toContain('<span>outputs</span>');
    expect(result.message).toContain('<td>arpeggio</td>');
    expect(result.message).toContain('<td>clip</td>');
    expect(result.message).toContain('<td>fill</td>');
    expect(result.message).toContain('<td>move</td>');
    expect(result.message).toContain('<td>transpose</td>');
    expect(result.message).toContain('&#x1F5F9;');
    expect(result.message).toContain('&#x1F5BA;');
    expect(result.message).toContain('<tr><td>move</td><td style=\'background-color: #555;\'>&nbsp;</td>');
    expect(result.message).toContain('<tr><td>clip</td><td style=\'background-color: #555;\'>&nbsp;</td>');
    expect(result.message).toContain('include:n,s,t,b,f,r');
    expect(result.message).toContain('played');
    expect(result.message).toContain("background-color: #555;");
    expect(result.message).toContain("background-color: chartreuse;");
    expect(result.message).toMatch(/<tr><td>arpeggio<\/td>[\s\S]*?<td style='background-color: chartreuse;'>single<\/td>[\s\S]*?<td style='background-color: chartreuse;'>played<br>color:true<\/td>/);
    expect(result.message).toContain('fill.customExtra');
    expect(result.message).toContain('Plugin Audit:');
    expect(result.message).toContain('Song-Level');
    expect(result.message).toContain('Persisted Properties');
    expect(result.message).toContain('Section-Level');
    expect(result.message).toContain('pluginData');
  });

  test('arpeggio type resolveValue displays normalized labels instead of raw enum names', () => {
    const manager = createManager();
    const song = createSongWithSectionPluginData();
    manager.loadSongPluginState(song);
    const entry = manager.getPluginEntry('arpeggio');

    expect(manager.resolveValue('plugin:arpeggio:type')).toBe('named');

    manager.setPropertyValue(entry, 'type', 'SingleNote');
    expect(manager.resolveValue('plugin:arpeggio:type')).toBe('single');

    manager.setPropertyValue(entry, 'type', 'AutoChartChord');
    expect(manager.resolveValue('plugin:arpeggio:type')).toBe('chord');

    manager.setPropertyValue(entry, 'type', 'AutoChartMode');
    expect(manager.resolveValue('plugin:arpeggio:type')).toBe('mode');

    manager.setPropertyValue(entry, 'type', 'AutoChartChordMode');
    expect(manager.resolveValue('plugin:arpeggio:type')).toBe('chord+mode');
  });
});
