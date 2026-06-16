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
const { gMenuFile } = await import('../../menu.js');
const { ArpeggioPlugin } = await import('../../plugins/arpeggio/ArpeggioPlugin.js');
const { ClipPlugin } = await import('../../plugins/clip/ClipPlugin.js');
const { FillPlugin } = await import('../../plugins/fill/FillPlugin.js');
const { MovePlugin } = await import('../../plugins/move/MovePlugin.js');
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
    gMenuFile.children = [];
  });

  function createManagerWithPlugins() {
    const manager = new PluginManager(mockEventBus);
    manager.register(new ArpeggioPlugin());
    manager.register(new ClipPlugin());
    manager.register(new FillPlugin());
    manager.register(new MovePlugin());
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
        bury(graveType, obj, context) {
          const record = {
            type: graveType,
            context,
            json: JSON.stringify(obj),
            lastRevived: null
          };
          this.records.push(record);
          return record;
        },
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

    manager.setPropertyValue(entry, 'doLeadKey', true);

    expect(manager.exportSongPluginState()).toEqual({
      transpose: {
        enabled: false,
        enableOnSongLoad: false,
        graveyardKey: 'USER',
        properties: {
          intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          NamedNotes: true,
          SingleNotes: false,
          RecordedNotes: false,
          octaves: '',
          autoSharpsFlats: false,
          doLeadKey: true
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
          SingleNotes: false,
          RecordedNotes: false,
          octaves: '',
          autoSharpsFlats: false,
          doLeadKey: false
        }
      }
    });
  });

  test('stores graveyardKey with persisted plugin state', () => {
    const manager = createManagerWithPlugins();
    const entry = manager.getPluginEntry('transpose');

    manager.setPropertyValue(entry, 'doLeadKey', true);
    manager.setPropertyValue(entry, 'graveyardKey', "Bob's I-IV-V Blues Practice");

    expect(manager.exportSongPluginState().transpose.graveyardKey).toBe("Bob's I-IV-V Blues Practice");
  });

  test('bury stores plugin snapshot, resets entry, and keeps persisted load-enabled value in snapshot', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    manager.loadSongPluginState(song);
    const entry = manager.getPluginEntry('transpose');

    manager.setPropertyValue(entry, 'enableOnSongLoad', true);
    manager.setPropertyValue(entry, 'doLeadKey', true);
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
        SingleNotes: false,
        RecordedNotes: false,
        octaves: '',
        autoSharpsFlats: false,
        doLeadKey: true
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

    manager.setPropertyValue(entry, 'doLeadKey', true);
    manager.setPropertyValue(entry, 'graveyardKey', 'Current');

    manager.importPluginSnapshot('transpose', {
      enabled: false,
      enableOnSongLoad: true,
      graveyardKey: 'Revived Config',
      properties: {
        intervals: [0, 2, 4],
        NamedNotes: true,
        SingleNotes: false,
        octaves: '',
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

    manager.setPropertyValue(entry, 'NamedNotes', false);
    manager.buryPluginEntry(entry, 'Preset');
    manager.setPropertyValue(entry, 'doLeadKey', true);
    manager.buryPluginEntry(entry, 'Preset');

    expect(song.graveyard.records).toHaveLength(1);
    const payload = JSON.parse(song.graveyard.records[0].json);
    expect(payload.properties.NamedNotes).toBe(true);
    expect(payload.properties.doLeadKey).toBe(true);
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

  test('plugins without registered events omit managed enable menu items', () => {
    const manager = createManagerWithPlugins();
    const clipNode = manager.buildPluginsMenuChildren().find((node) => node.name === 'clip');
    const moveNode = manager.buildPluginsMenuChildren().find((node) => node.name === 'move');

    expect(clipNode.children.find((child) => child.name === 'enabled')).toBeUndefined();
    expect(clipNode.children.find((child) => child.name === 'enableOnSongLoad')).toBeUndefined();
    expect(clipNode.children[0].name).toBe('bury');

    expect(moveNode.children.find((child) => child.name === 'enabled')).toBeUndefined();
    expect(moveNode.children.find((child) => child.name === 'enableOnSongLoad')).toBeUndefined();
    expect(moveNode.children[0].name).toBe('bury');
  });

  test('plugins with registered events keep managed enable menu items', () => {
    const manager = createManagerWithPlugins();
    const transposeNode = manager.buildPluginsMenuChildren().find((node) => node.name === 'transpose');
    const arpeggioNode = manager.buildPluginsMenuChildren().find((node) => node.name === 'arpeggio');

    expect(transposeNode.children[0].name).toBe('enabled');
    expect(transposeNode.children[1].name).toBe('enableOnSongLoad');

    expect(arpeggioNode.children[0].name).toBe('enabled');
    expect(arpeggioNode.children[1].name).toBe('enableOnSongLoad');
  });

  test('plugins without registered events suppress the enabled status mark', () => {
    const manager = createManagerWithPlugins();
    const clipEntry = manager.getPluginEntry('clip');
    const transposeEntry = manager.getPluginEntry('transpose');

    clipEntry.enabled = true;
    transposeEntry.enabled = true;

    expect(manager.buildPluginStatusSuffix(clipEntry)).toBe('');
    expect(manager.buildPluginStatusSuffix(transposeEntry)).toContain('&#x1F5F9;');
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

  test('pluginAction:invoke preserves JSON plugin messages', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    manager.loadSongPluginState(song);
    const entry = manager.getPluginEntry('move');
    entry.plugin.droppedNotes = [{ reason: 'apply start', applyNumber: 1 }];

    const result = manager.invokePluginAction(entry, 'showDroppedNotes');

    expect(result.result).toBe('Move dropped notes shown');
    expect(result.messageJSON).toBe(JSON.stringify({ droppedNotes: entry.plugin.droppedNotes }, null, 2));
  });

  test('pluginAction:invoke preserves menu-stack hints from plugin responses', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    manager.loadSongPluginState(song);
    manager.register({
      getId() {
        return 'menuhint';
      },
      setManager() {},
      getEventNames() {
        return [];
      },
      exportSongState() {
        return {};
      },
      getProperties() {
        return [];
      },
      invokeAction() {
        return {
          result: 'stub help shown',
          message: 'stub help',
          preserveMenuStack: true
        };
      }
    });
    const entry = manager.getPluginEntry('menuhint');

    const result = manager.invokePluginAction(entry, 'help');

    expect(result.result).toBe('stub help shown');
    expect(result.preserveMenuStack).toBe(true);
    expect(result.message).toBe('stub help');
  });

  test('plugin actions and property changes refresh runtime plugin menus for dynamic children', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    manager.loadSongPluginState(song);
    const refreshSpy = jest.spyOn(manager, 'refreshPluginsMenuNode');
    const clipEntry = manager.getPluginEntry('clip');

    manager.setPropertyValue(clipEntry, 'overwrite', false);
    manager.togglePropertyValue(clipEntry, 'includeTiny');
    manager.invokePluginAction(clipEntry, 'help');

    expect(refreshSpy).toHaveBeenCalledTimes(3);
  });

  test('dynamic Clip revive submenu updates in place after copy', () => {
    const manager = createManagerWithPlugins();
    const song = createSongWithTunings();
    const tableID = `${Constants.TABLE_ID_PREFIX}P46_1`;
    song.getCurrentSection().getSectionNotes(tableID).playedNotes.push({
      noteName: 'D',
      styleNum: 2,
      row: '0',
      col: '2',
      colorClass: 'noteTransparent'
    });
    manager.loadSongPluginState(song);

    gMenuFile.children = [
      {
        name: 'pluginsRuntime',
        runtimeChildren: 'pluginManager',
        trigger: 'p',
        caption: 'plugins',
        children: []
      }
    ];

    const markerNode = manager.refreshPluginsMenuNode();
    const clipNode = markerNode.children.find((node) => node.name === 'clip');
    const reviveNode = clipNode.children.find((child) => child.name === 'reviveFromGraveyard');
    const clipEntry = manager.getPluginEntry('clip');

    expect(reviveNode.actionName).toBe('reviveClipChoice');
    expect(reviveNode.input).toBeNull();
    expect(reviveNode.popOnBang).toBe(false);
    expect(manager.resolveValue('plugin:clip:defaultReviveChoice')).toBe('');

    manager.invokePluginAction(clipEntry, 'copyToGraveyard', { value: 'single-1' });

    expect(manager.resolveValue('plugin:clip:defaultReviveChoice')).toBe('1');
    expect(manager.resolveValue('plugin:clip:reviveSummary')).toContain('[1:single-1]');
  });
});