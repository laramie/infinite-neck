import { jest } from '@jest/globals';

const mockEventBus = {
  on: jest.fn(),
  off: jest.fn(),
  trigger: jest.fn()
};

const mockGetSong = jest.fn(() => null);
const mockTransposeSong = jest.fn();
const mockClearBeatAndSectionLooping = jest.fn();
const mockSectionsLooping = jest.fn(() => false);
const mockBeatsLooping = jest.fn(() => false);

jest.unstable_mockModule('../../menu.js', () => ({
  gMenuFile: {
    children: []
  }
}));

jest.unstable_mockModule('../../looper.js', () => ({
  clearBeatAndSectionLooping: mockClearBeatAndSectionLooping,
  sectionsLooping: mockSectionsLooping,
  beatsLooping: mockBeatsLooping
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
    mockClearBeatAndSectionLooping.mockClear();
    mockSectionsLooping.mockReset();
    mockSectionsLooping.mockReturnValue(false);
    mockBeatsLooping.mockReset();
    mockBeatsLooping.mockReturnValue(false);
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
      },
      graveyard: {
        records: [],
        buryReplacing(graveType, obj, context, predicate) {
          const record = {
            type: graveType,
            context,
            json: JSON.stringify(obj),
            lastRevived: null
          };
          const idx = this.records.findIndex((candidate) => predicate(candidate));
          if (idx >= 0) {
            this.records.splice(idx, 1, record);
          } else {
            this.records.push(record);
          }
          return record;
        }
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
        graveyardKey: 'USER',
        properties: {
          intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          NamedNotes: true,
          PlayedNotes: true,
          RecordedNotes: false,
          autoSharpsFlats: false,
          doLeadKey: false
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
        graveyardKey: 'USER',
        properties: {
          intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          NamedNotes: true,
          PlayedNotes: false,
          RecordedNotes: false,
          autoSharpsFlats: false,
          doLeadKey: false
        }
      }
    });
  });

  test('stores graveyardKey with persisted plugin state', () => {
    const manager = createManagerWithPlugins();
    const entry = manager.getPluginEntry('transpose');

    manager.setPropertyValue(entry, 'PlayedNotes', true);
    manager.setPropertyValue(entry, 'graveyardKey', "Bob's I-IV-V Blues Practice");

    expect(manager.exportSongPluginState().transpose.graveyardKey).toBe("Bob's I-IV-V Blues Practice");
  });

  test('bury stores plugin snapshot, resets entry, and keeps persisted load-enabled value in snapshot', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    manager.loadSongPluginState(song);
    const entry = manager.getPluginEntry('transpose');

    manager.setPropertyValue(entry, 'enableOnSongLoad', true);
    manager.setPropertyValue(entry, 'PlayedNotes', true);
    const result = manager.buryPluginEntry(entry, 'Blues A');

    expect(result.result).toBe('buried transpose as Blues A');
    expect(song.graveyard.records).toHaveLength(1);
    expect(song.graveyard.records[0].type).toBe('PLUGIN');
    expect(song.graveyard.records[0].context.pluginId).toBe('transpose');
    expect(song.graveyard.records[0].context.userKey).toBe('Blues A');
    expect(JSON.parse(song.graveyard.records[0].json)).toEqual({
      enabled: false,
      enableOnSongLoad: true,
      graveyardKey: 'Blues A',
      properties: {
        intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        NamedNotes: true,
        PlayedNotes: true,
        RecordedNotes: false,
        autoSharpsFlats: false,
        doLeadKey: false
      }
    });
    expect(entry.enabled).toBe(false);
    expect(entry.enableOnSongLoad).toBe(false);
    expect(entry.graveyardKey).toBe('Blues A');
  });

  test('bury stops looping when needed', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    manager.loadSongPluginState(song);
    const entry = manager.getPluginEntry('transpose');
    mockSectionsLooping.mockReturnValue(true);

    manager.buryPluginEntry(entry, 'USER');

    expect(mockClearBeatAndSectionLooping).toHaveBeenCalledTimes(1);
  });

  test('importPluginSnapshot auto-buries current state to USER before restore', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    manager.loadSongPluginState(song);
    const entry = manager.getPluginEntry('transpose');

    manager.setPropertyValue(entry, 'PlayedNotes', true);
    manager.setPropertyValue(entry, 'graveyardKey', 'Current');

    manager.importPluginSnapshot('transpose', {
      enabled: false,
      enableOnSongLoad: true,
      graveyardKey: 'Revived Config',
      properties: {
        intervals: [0, 2, 4],
        NamedNotes: true,
        PlayedNotes: false,
        RecordedNotes: false,
        autoSharpsFlats: false,
        doLeadKey: true
      }
    });

    expect(song.graveyard.records).toHaveLength(1);
    expect(song.graveyard.records[0].context.userKey).toBe('USER');
    expect(entry.enableOnSongLoad).toBe(true);
    expect(entry.enabled).toBe(true);
    expect(entry.graveyardKey).toBe('Revived Config');
    expect(entry.plugin.getProperty('doLeadKey').getValue()).toBe(true);
  });

  test('same-key bury replaces earlier snapshot', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    manager.loadSongPluginState(song);
    const entry = manager.getPluginEntry('transpose');

    manager.setPropertyValue(entry, 'PlayedNotes', true);
    manager.buryPluginEntry(entry, 'Preset');
    manager.setPropertyValue(entry, 'RecordedNotes', true);
    manager.buryPluginEntry(entry, 'Preset');

    expect(song.graveyard.records).toHaveLength(1);
    const payload = JSON.parse(song.graveyard.records[0].json);
    expect(payload.properties.PlayedNotes).toBe(false);
    expect(payload.properties.RecordedNotes).toBe(true);
  });

  test('runtime plugin menu captions use ${plugin:...} value references', () => {
    const manager = createManagerWithPlugins();
    const transposeNode = manager.buildPluginsMenuChildren().find((node) => node.name === 'transpose');
    const enabledNode = transposeNode.children.find((child) => child.name === 'enabled');
    const loadEnabledNode = transposeNode.children.find((child) => child.name === 'enableOnSongLoad');
    const intervalsNode = transposeNode.children.find((child) => child.name === 'intervals');

    expect(transposeNode.caption).toContain('${plugin:transpose:statusSuffix}');
    expect(enabledNode.caption).toContain('[${plugin:transpose:enabled}]');
    expect(loadEnabledNode.caption).toContain('[${plugin:transpose:enableOnSongLoad}]');
    expect(intervalsNode.caption).toContain('[${plugin:transpose:intervals}]');
  });

  test('pluginAction:invoke passes menu input args through to the plugin action', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    const section = song.sections[0];
    section.beats = 4;
    section.currentBeat = 1;
    section.sharps = false;
    manager.loadSongPluginState(song);
    const arpeggioNode = manager.buildPluginsMenuChildren().find((node) => node.name === 'arpeggio');
    const positionsNode = arpeggioNode.children.find((child) => child.name === 'positions');
    const valueNode = positionsNode.children.find((child) => child.name === 'positions:setCurrentSection');

    const result = manager.invokeMenuAction(valueNode, { value: '0,3;5,9' });

    expect(result.result).toBe('positions=[[0,3],[5,9]]');
    expect(song.sections[0].pluginData.arpeggio.positions).toEqual([[0, 3], [5, 9]]);
    expect(song.sections[0].pluginData.arpeggio.lastPositionIndex).toBe(-1);
  });
});