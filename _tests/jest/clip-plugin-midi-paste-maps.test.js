import { jest } from '@jest/globals';

const mockRuntime = {
  song: null
};

jest.useFakeTimers().setSystemTime(new Date('2026-11-01T12:02:00Z'));

jest.unstable_mockModule('../../infinite-neck.js', () => ({
  getSong: () => mockRuntime.song
}));

const Constants = await import('../../Constants.js');
const EventBus = (await import('../../event-bus.js')).default;
const { GraveType } = await import('../../graveyard.js');
const { ClipPlugin } = await import('../../plugins/clip/ClipPlugin.js');
const { MAP_CHOICE_TRIGGERS } = await import('../../plugins/clip/midiPasteMaps.js');
const { BUILTIN_MIDI_PASTE_MAPS } = await import('../../plugins/clip/midiPasteMapBuiltins.js');
const { PluginProperty } = await import('../../plugins/PluginProperty.js');
const { SectionNotes } = await import('../../SectionNotes.js');
const { Note } = await import('../../Note.js');
const { createTuningLayout } = await import('../../move-helpers.js');

const P48_ROWS = [65, 60, 55, 50, 45, 40, 35, 30];
const P46_ROWS = [65, 60, 55, 50, 45, 40];

function tuning(baseID, fromBaseID, baseInstrument, rowRange, overrides = {}) {
  return {
    baseID,
    fromBaseID,
    baseInstrument,
    nStrings: rowRange.length,
    frets: 15,
    rowRange,
    nut: true,
    reverse: false,
    ...overrides
  };
}

function createSection(sectionNotesByTable = {}) {
  return {
    rootID: 3,
    caption: 'Verse',
    beats: 4,
    currentBeat: 1,
    sectionNotesByTable: Object.fromEntries(
      Object.entries(sectionNotesByTable).map(([tableID, value]) => [
        tableID,
        value instanceof SectionNotes ? value : new SectionNotes(value)
      ])
    ),
    getBeat() { return this.currentBeat; },
    getBeats() { return this.beats; },
    setBeats(value) { this.beats = value; },
    gotoBeat(value) { this.currentBeat = value; },
    getAllSectionNotes() { return Object.entries(this.sectionNotesByTable); },
    getSectionNotes(tableID) {
      if (!this.sectionNotesByTable[tableID]) {
        this.sectionNotesByTable[tableID] = new SectionNotes();
      }
      return this.sectionNotesByTable[tableID];
    }
  };
}

function createSong({ myTunings, sections }) {
  return {
    myTunings,
    sections,
    wirings: [],
    recording: false,
    graveyard: {
      records: [],
      bury(type, obj, context) {
        this.records.push({ type, context, json: JSON.stringify(obj), lastRevived: null });
      }
    },
    getCurrentSection() { return this.sections[0]; },
    isRecording() { return this.recording === true; },
    setRecording(value) { this.recording = value === true; return this.recording; },
    requestUiFullRepaint: jest.fn()
  };
}

const tableOf = (baseID) => `${Constants.TABLE_ID_PREFIX}${baseID}`;

function played(row, col, marker) {
  return { noteName: marker, marker, styleNum: Note.STYLENUM_SINGLE, row: `${row}`, col: `${col}`, colorClass: 'noteTransparent' };
}

function playedSummary(section, tableID) {
  return section.getSectionNotes(tableID).playedNotes.map((note) => `${note.marker}@${Number(note.row) + 1}:${note.col}`);
}

/**
 * Copies `notes` from the source table of a fresh Song, then points the plugin at the target
 * table, ready for `midiPasteClipChoice`.
 */
function setupPaste({ sourceTuning, targetTuning, notes, extraTunings = [] }) {
  const sourceID = tableOf(sourceTuning.baseID);
  const targetID = tableOf(targetTuning.baseID);
  const section = createSection({
    [sourceID]: { namedNotes: {}, playedNotes: notes },
    [targetID]: { namedNotes: {}, playedNotes: [] }
  });
  const song = createSong({ myTunings: [sourceTuning, targetTuning, ...extraTunings], sections: [section] });
  mockRuntime.song = song;
  const plugin = new ClipPlugin();
  plugin.setManager({ song });
  plugin.getVisibleMenuChildren();
  plugin.setPropertyValue('targetTable', sourceID, { song });
  plugin.invokeAction('copyToGraveyard', { song, args: { value: 'clip1' } });
  plugin.setPropertyValue('targetTable', targetID, { song });
  plugin.setPropertyValue('automatic', false, { song });
  return { plugin, song, section, sourceID, targetID };
}

describe('ClipPlugin MIDI Paste maps', () => {
  let userLog;
  let userLogHandler;

  beforeEach(() => {
    userLog = [];
    userLogHandler = (event, data) => userLog.push(data.message);
    EventBus.on('UserLog', userLogHandler);
  });

  afterEach(() => {
    EventBus.off('UserLog', userLogHandler);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('storage', () => {
    test('defaults: no active map, no user maps, and the ObjectArray datatype normalizes structurally', () => {
      const plugin = new ClipPlugin();
      expect(plugin.getProperty('midiPasteMapId').getValue()).toBe('');
      expect(plugin.getProperty('midiPasteUserMaps').getValue()).toEqual([]);

      const property = new PluginProperty({ name: 'x', datatype: 'org.dynamide.ObjectArray', value: [] });
      expect(property.setValue('[{"id":"a"}, 3, null, [1]]')).toEqual([{ id: 'a' }]);
      expect(() => property.setValue('{"id":"a"}')).toThrow('array of objects');
    });

    test('maps and the active id round-trip through export and load', () => {
      const song = createSong({ myTunings: [tuning('P46', 'P46', 'Guitar', P46_ROWS)], sections: [createSection()] });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });
      plugin.addMidiPasteMap('"lute reorder" 1:1, 2:4,  3:2');
      plugin.selectMidiPasteMap('lute reorder');
      const state = plugin.exportSongState();
      expect(state.midiPasteUserMaps).toEqual([{ id: 'lute reorder', spec: '1:1, 2:4,  3:2' }]);
      expect(state.midiPasteMapId).toBe('lute reorder');

      const reloaded = new ClipPlugin();
      reloaded.setManager({ song });
      reloaded.loadSongState(JSON.parse(JSON.stringify(state)), { song });
      expect(reloaded.getUserMidiPasteMaps()).toEqual([{ id: 'lute reorder', spec: '1:1, 2:4,  3:2' }]);
      expect(reloaded.getActiveMidiPasteMapId()).toBe('lute reorder');

      reloaded.resetToDefaults();
      expect(reloaded.getUserMidiPasteMaps()).toEqual([]);
      expect(reloaded.getActiveMidiPasteMapId()).toBe('');
    });

    test('damaged stored maps are dropped with a User Log message and never throw', () => {
      const plugin = new ClipPlugin();
      const song = createSong({ myTunings: [], sections: [createSection()] });
      mockRuntime.song = song;
      plugin.setManager({ song });
      const builtinId = Object.keys(BUILTIN_MIDI_PASTE_MAPS)[0];
      expect(() => plugin.loadSongState({
        midiPasteUserMaps: [
          { id: 'ok', spec: '1:1' },
          { id: 'bad spec', spec: '0:1' },
          { id: builtinId, spec: '1:1' },
          { id: 'OK', spec: '2:2' },
          { spec: '1:1' }
        ],
        midiPasteMapId: 'gone'
      }, { song })).not.toThrow();

      expect(plugin.getUserMidiPasteMaps()).toEqual([{ id: 'ok', spec: '1:1' }]);
      expect(plugin.getActiveMidiPasteMapId()).toBe('');
      expect(userLog.length).toBe(5);
      expect(userLog.join('\n')).toContain('"bad spec" dropped');
      expect(userLog.join('\n')).toContain('id already exists');
    });

    test('a stored value that is not an array is ignored with a User Log message', () => {
      const plugin = new ClipPlugin();
      const song = createSong({ myTunings: [], sections: [createSection()] });
      mockRuntime.song = song;
      plugin.setManager({ song });
      expect(() => plugin.loadSongState({ midiPasteUserMaps: 'not json' }, { song })).not.toThrow();
      expect(plugin.getUserMidiPasteMaps()).toEqual([]);
      expect(userLog.join('\n')).toContain('midiPasteUserMaps');
    });
  });

  describe('actions', () => {
    function fresh() {
      const song = createSong({ myTunings: [], sections: [createSection()] });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });
      return { plugin, song };
    }

    test('add stores the id and spec as typed, and reports warnings in the result and User Log', () => {
      const { plugin } = fresh();
      const result = plugin.invokeAction('addMidiPasteMap', { args: { value: '"Foo>Bar" 1:2,  3:2' } });
      expect(result.result).toContain('MIDI Paste map added: "Foo &gt; Bar" 1:2,  3:2');
      expect(result.result).toContain('the later pair wins');
      expect(plugin.getUserMidiPasteMaps()).toEqual([{ id: 'Foo > Bar', spec: '1:2,  3:2' }]);
      expect(userLog.join('\n')).toContain('the later pair wins');
      expect(plugin.getActiveMidiPasteMapId()).toBe('');
    });

    test.each([
      ['no quotes', 'Foo 1:2'],
      ['string zero', '"Foo" 0:1'],
      ['empty map', '"Foo"'],
      ['two arrows', '"A > B > C" 1:1']
    ])('add rejects %s, stores nothing, and logs', (label, line) => {
      const { plugin } = fresh();
      const result = plugin.invokeAction('addMidiPasteMap', { args: { value: line } });
      expect(result.result).toContain('MIDI Paste map not added');
      expect(plugin.getUserMidiPasteMaps()).toEqual([]);
      expect(userLog.length).toBe(1);
    });

    test('add rejects an id that equals a built-in or an existing map, ignoring case', () => {
      const { plugin } = fresh();
      const builtinId = Object.keys(BUILTIN_MIDI_PASTE_MAPS)[0];
      expect(plugin.invokeAction('addMidiPasteMap', { args: { value: `"${builtinId.toUpperCase()}" 1:1` } }).result)
        .toContain('already exists');
      plugin.invokeAction('addMidiPasteMap', { args: { value: '"mine" 1:1' } });
      expect(plugin.invokeAction('addMidiPasteMap', { args: { value: '"MINE" 2:2' } }).result).toContain('already exists');
      expect(plugin.getUserMidiPasteMaps().length).toBe(1);
    });

    test('select sets and clears the active map; unknown ids are skipped', () => {
      const { plugin } = fresh();
      const builtinId = Object.keys(BUILTIN_MIDI_PASTE_MAPS)[0];
      expect(plugin.invokeAction(`selectMidiPasteMap:${encodeURIComponent(builtinId)}`, {}).result).toContain('MIDI Paste map:');
      expect(plugin.getActiveMidiPasteMapId()).toBe(builtinId);
      expect(plugin.resolveValue('midiPasteMapId')).toBe(builtinId.replaceAll('>', '&gt;'));
      expect(plugin.invokeAction('selectMidiPasteMap:nope', {}).result).toContain('not found');
      expect(plugin.getActiveMidiPasteMapId()).toBe(builtinId);
      expect(plugin.invokeAction('selectMidiPasteMap:', {}).result).toBe('MIDI Paste map: none');
      expect(plugin.getActiveMidiPasteMapId()).toBe('');
      expect(plugin.resolveValue('midiPasteMapId')).toBe('none');
    });

    test('delete removes only user maps and clears the active id when it was deleted', () => {
      const { plugin } = fresh();
      const builtinId = Object.keys(BUILTIN_MIDI_PASTE_MAPS)[0];
      plugin.invokeAction('addMidiPasteMap', { args: { value: '"mine" 1:1' } });
      plugin.invokeAction('addMidiPasteMap', { args: { value: '"other" 1:1' } });
      plugin.selectMidiPasteMap('mine');

      expect(plugin.invokeAction(`deleteMidiPasteMap:${encodeURIComponent(builtinId)}`, {}).result).toContain('is built in');
      expect(plugin.invokeAction('deleteMidiPasteMap:missing', {}).result).toContain('not found');
      const result = plugin.invokeAction('deleteMidiPasteMap:mine', {});
      expect(result.result).toContain('no map selected');
      expect(plugin.getUserMidiPasteMaps().map((map) => map.id)).toEqual(['other']);
      expect(plugin.getActiveMidiPasteMapId()).toBe('');
      expect(plugin.invokeAction('keepMidiPasteMap', {}).result).toBe('MIDI Paste map kept');
    });

    test('list shows built-in then user maps with keys, specs as stored, and the active mark', () => {
      const { plugin } = fresh();
      plugin.invokeAction('addMidiPasteMap', { args: { value: '"mine" 1:1,2:2' } });
      plugin.selectMidiPasteMap('mine');
      const { result, message } = plugin.invokeAction('listMidiPasteMaps', {});
      const builtinCount = Object.keys(BUILTIN_MIDI_PASTE_MAPS).length;
      expect(result).toBe(`${builtinCount + 1} MIDI Paste maps; current: mine`);
      expect(message).toContain('<td>1</td>');
      expect(message).toContain('<td>mine &#x2713;</td><td>1:1,2:2</td><td>yours</td>');
      expect(message).toContain('built-in');
      expect(message.indexOf('built-in')).toBeLessThan(message.indexOf('yours'));
    });
  });

  describe('menu', () => {
    function menuOf(plugin) {
      return plugin.getVisibleMenuChildren().find((child) => child.name === 'midiPasteMap');
    }

    test('m)idi paste map sits after Listener copy with map, add, delete, list children', () => {
      const song = createSong({ myTunings: [tuning('P46', 'P46', 'Guitar', P46_ROWS)], sections: [createSection()] });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });

      const children = plugin.getVisibleMenuChildren();
      const index = children.findIndex((child) => child.name === 'midiPasteMap');
      expect(children[index - 1].name).toBe('copyListenedToGraveyard');
      const node = children[index];
      expect(node.caption).toBe('<b>m</b>idi paste map');
      expect(node.trigger).toBe('m');
      expect(node.children.map((child) => child.trigger)).toEqual(['m', 'a', 'd', 'l']);
      expect(node.children[0].caption).toBe('<b>m</b>ap [${plugin:clip:midiPasteMapId}]');
      expect(node.children[0].vars).toEqual(['plugin:clip:midiPasteMapId']);
      expect(node.children[1].input).toMatchObject({ datatype: 'string', id: 'value' });
      expect(node.children[3].actionName).toBe('listMidiPasteMaps');
    });

    test('m)ap lists built-ins then user maps as 1-9 then a-z, with no 0 and a final n)one', () => {
      const song = createSong({ myTunings: [], sections: [createSection()] });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });
      plugin.addMidiPasteMap('"mine" 1:1');
      plugin.selectMidiPasteMap('mine');

      const mapNode = menuOf(plugin).children[0];
      const choices = mapNode.children.slice(0, -1);
      const builtinIds = Object.keys(BUILTIN_MIDI_PASTE_MAPS);
      expect(choices.map((choice) => choice.trigger)).toEqual(MAP_CHOICE_TRIGGERS.slice(0, builtinIds.length + 1));
      expect(choices[0].caption).toBe(`<b>1</b>) ${builtinIds[0].replaceAll('>', '&gt;')}`);
      expect(choices[builtinIds.length].caption).toContain(') mine &#x2713;');
      expect(choices[builtinIds.length].actionName).toBe('selectMidiPasteMap:mine');
      expect(choices.every((choice) => choice.popOnBang === true)).toBe(true);
      expect(mapNode.children.some((child) => child.trigger === '0')).toBe(false);
      const none = mapNode.children[mapNode.children.length - 1];
      expect(none).toMatchObject({ trigger: 'n', actionName: 'selectMidiPasteMap:', caption: '<b>n</b>one' });
    });

    test('choice keys are capped and skip n; extra maps are only visible in list', () => {
      const song = createSong({ myTunings: [], sections: [createSection()] });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });
      for (let i = 0; i < 40; i += 1) {
        plugin.addMidiPasteMap(`"map ${i}" 1:1`);
      }
      const mapNode = menuOf(plugin).children[0];
      expect(mapNode.children.length).toBe(MAP_CHOICE_TRIGGERS.length + 1);
      expect(mapNode.children.filter((child) => child.trigger === 'n').length).toBe(1);
      expect(plugin.listMidiPasteMapsMessage().message).toContain('<td>-</td>');
    });

    test('ids with HTML characters are escaped in captions', () => {
      const song = createSong({ myTunings: [], sections: [createSection()] });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });
      plugin.addMidiPasteMap(`"it's > ok" 1:1`);
      const captions = menuOf(plugin).children[0].children.map((child) => child.caption).join('\n');
      expect(captions).toContain('it&#39;s &gt; ok');
      expect(captions).not.toContain('it\'s');
    });

    test('d)elete lists only user maps, each asking Y/n; with none it shows a status row', () => {
      const song = createSong({ myTunings: [], sections: [createSection()] });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });

      let deleteNode = menuOf(plugin).children[2];
      expect(deleteNode.children.map((child) => child.caption)).toEqual(['no maps of your own']);

      plugin.addMidiPasteMap('"mine" 1:1');
      plugin.addMidiPasteMap('"yours" 1:1');
      deleteNode = menuOf(plugin).children[2];
      expect(deleteNode.children.map((child) => child.caption)).toEqual(['<b>1</b>) mine', '<b>2</b>) yours']);
      expect(deleteNode.children[0].children.map((child) => child.trigger)).toEqual(['Y', 'n']);
      expect(deleteNode.children[0].children[0].actionName).toBe('deleteMidiPasteMap:mine');
    });
  });

  describe('paste with a map', () => {
    test('built-in P48 > P46: strings 7 and 8 are not pasted, and the result names the map', () => {
      const { plugin, song, section, targetID } = setupPaste({
        sourceTuning: tuning('P48_1', 'P48', 'Guitar', P48_ROWS, { frets: 24 }),
        targetTuning: tuning('P46_1', 'P46', 'Guitar', P46_ROWS, { frets: 24 }),
        notes: [played(0, 2, 'a'), played(5, 1, 'b'), played(6, 3, 'c'), played(7, 0, 'd')]
      });

      // Without a map an 8-string source is not eligible at all.
      expect(plugin.getMidiPasteClipRecords(song)).toHaveLength(0);
      expect(plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } }).result).toContain('not available');

      plugin.setPropertyValue('midiPasteMapId', 'P48 > P46', { song });
      expect(plugin.getMidiPasteClipRecords(song)).toHaveLength(1);
      const result = plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

      expect(result.result).toContain('[map "P48 &gt; P46" forward]');
      expect(result.result).toContain('unmapped 2; collisions 0');
      expect(playedSummary(section, targetID)).toEqual(['a@1:2', 'b@6:1']);
    });

    test('the reverse direction is inferred from the active map', () => {
      const bass4 = tuning('Bass4_1', 'Bass4', 'Bass', [43, 38, 33, 28]);
      const bass5 = tuning('Bass5_1', 'Bass5', 'Bass', [43, 38, 33, 28, 23]);
      const { plugin, song, section, targetID } = setupPaste({
        sourceTuning: bass4,
        targetTuning: bass5,
        notes: [played(1, 2, 'a'), played(3, 0, 'b')]
      });
      plugin.setPropertyValue('midiPasteMapId', 'Bass5 > Bass4', { song });

      const result = plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

      expect(result.result).toContain('reverse-inferred');
      expect(playedSummary(section, targetID)).toEqual(['a@2:2', 'b@4:0']);
    });

    test('a map written for one pair also fits sibling tunings of the same class', () => {
      const { plugin, song, section, targetID } = setupPaste({
        sourceTuning: tuning('P48_1', 'P48', 'Guitar', P48_ROWS, { frets: 24 }),
        targetTuning: tuning('DropD_1', 'DropD', 'Guitar', [64, 59, 55, 50, 45, 38], { frets: 24 }),
        notes: [played(5, 2, 'a')]
      });
      plugin.setPropertyValue('midiPasteMapId', 'P48 > S6', { song });

      const result = plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

      expect(result.result).toContain('forward');
      // P48 string 6 (E 40) fret 2 = 42 -> DropD string 6 (D 38) fret 4
      expect(playedSummary(section, targetID)).toEqual(['a@6:4']);
    });

    test('a 4-string reorder map on instruments with no library entry', () => {
      const lute = tuning('LuteA', 'LuteA', 'Lute', [60, 55, 50, 45]);
      const luteB = tuning('LuteB', 'LuteB', 'Lute', [60, 45, 55, 50]);
      const { plugin, song, section, targetID } = setupPaste({
        sourceTuning: lute,
        targetTuning: luteB,
        notes: [played(0, 0, 's1'), played(1, 0, 's2'), played(2, 0, 's3'), played(3, 0, 's4')]
      });
      plugin.invokeAction('addMidiPasteMap', { args: { value: '"lute reorder" 1:1, 2:3, 3:4, 4:2' } });
      plugin.selectMidiPasteMap('lute reorder');

      const result = plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

      expect(result.result).toContain('[map "lute reorder" custom]');
      expect(playedSummary(section, targetID)).toEqual(['s1@1:0', 's2@3:0', 's3@4:0', 's4@2:0']);
    });

    test('one-to-many pastes a note on each named string that can play it', () => {
      const lute = tuning('LuteA', 'LuteA', 'Lute', [60, 55]);
      const luteB = tuning('LuteB', 'LuteB', 'Lute', [60, 48, 60]);
      const { plugin, song, section, targetID } = setupPaste({
        sourceTuning: lute,
        targetTuning: luteB,
        notes: [played(0, 0, 'a')]
      });
      plugin.addMidiPasteMap('"fan" 1:1, 1:2, 1:3');
      plugin.selectMidiPasteMap('fan');

      const result = plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

      // pitch 60 is open on strings 1 and 3, and fret 12 on string 2 (open 48)
      expect(result.result).toContain('custom');
      expect(playedSummary(section, targetID)).toEqual(['a@1:0', 'a@2:12', 'a@3:0']);
    });

    test('many-to-one: the later pair wins even when overwrite is off, with a User Log warning', () => {
      const sourceTuning = tuning('LuteA', 'LuteA', 'Lute', [60, 60]);
      const targetTuning = tuning('LuteB', 'LuteB', 'Lute', [60, 55]);
      const { plugin, song, section, targetID } = setupPaste({
        sourceTuning,
        targetTuning,
        notes: [played(0, 0, 'first'), played(1, 0, 'second')]
      });
      plugin.setPropertyValue('overwrite', false, { song });
      plugin.addMidiPasteMap('"collide" 1:1, 2:1');
      userLog.length = 0;
      plugin.selectMidiPasteMap('collide');

      const result = plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

      expect(result.result).toContain('collisions 1');
      expect(playedSummary(section, targetID)).toEqual(['second@1:0']);
      expect(userLog.join('\n')).toContain('1 notes landed on the same cell');
    });

    test('pairs naming a string the instrument lacks are skipped and logged, not fatal', () => {
      const { plugin, song, section, targetID } = setupPaste({
        sourceTuning: tuning('LuteA', 'LuteA', 'Lute', [60, 55]),
        targetTuning: tuning('LuteB', 'LuteB', 'Lute', [60, 55]),
        notes: [played(0, 0, 'a'), played(1, 0, 'b')]
      });
      plugin.addMidiPasteMap('"wide" 1:1, 2:2, 3:3, 1:7');
      plugin.selectMidiPasteMap('wide');

      const result = plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

      expect(result.result).toContain('MIDI Paste revived');
      expect(playedSummary(section, targetID)).toEqual(['a@1:0', 'b@2:0']);
      expect(userLog.join('\n')).toContain('skipped pairs 3:3, 1:7');
    });

    test('an active map that does not fit falls back to default behavior and says so', () => {
      const { plugin, song, section, targetID } = setupPaste({
        sourceTuning: tuning('S6_1', 'S6', 'Guitar', [64, 59, 55, 50, 45, 40], { frets: 24 }),
        targetTuning: tuning('P46_1', 'P46', 'Guitar', P46_ROWS, { frets: 24 }),
        notes: [played(0, 1, 'a')]
      });
      plugin.setPropertyValue('midiPasteMapId', 'Bass6 > Bass4', { song });

      const result = plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

      expect(result.result).toContain('MIDI Paste revived clip1:');
      expect(result.result).toContain('[map "Bass6 &gt; Bass4" not applied: does not fit]');
      expect(result.result).not.toContain('unmapped');
      expect(playedSummary(section, targetID)).toEqual(['a@1:0']);
    });

    test('a non-fitting map plus unsupported tunings skips with a hint naming the map', () => {
      const { plugin, song } = setupPaste({
        sourceTuning: tuning('Bass4_1', 'Bass4', 'Bass', [43, 38, 33, 28]),
        targetTuning: tuning('P46_1', 'P46', 'Guitar', P46_ROWS),
        notes: [played(0, 0, 'a')]
      });
      plugin.setPropertyValue('midiPasteMapId', 'P48 > P46', { song });
      const record = song.graveyard.records.findIndex((entry) => entry.type === GraveType.CLIP);

      const result = plugin.midiPasteClip(song, record);

      expect(result.result).toContain('MIDI Paste skipped');
      expect(result.result).toContain('map "P48 &gt; P46" does not fit');
    });

    test('the paste choice list lists a clip when a map fits even though the default gate fails', () => {
      const { plugin, song } = setupPaste({
        sourceTuning: tuning('Bass5_1', 'Bass5', 'Bass', [43, 38, 33, 28, 23]),
        targetTuning: tuning('Bass4_1', 'Bass4', 'Bass', [43, 38, 33, 28]),
        notes: [played(0, 0, 'a')]
      });
      expect(plugin.getMidiPasteClipRecords(song)).toHaveLength(0);
      plugin.setPropertyValue('midiPasteMapId', 'Bass5 > Bass4', { song });
      expect(plugin.getMidiPasteClipRecords(song)).toHaveLength(1);
      expect(plugin.resolveValue('midiPasteSummary', { song })).toContain('[1:');
    });

    test('named notes are pasted unchanged', () => {
      const sourceTuning = tuning('Bass5_1', 'Bass5', 'Bass', [43, 38, 33, 28, 23]);
      const targetTuning = tuning('Bass4_1', 'Bass4', 'Bass', [43, 38, 33, 28]);
      const sourceID = tableOf(sourceTuning.baseID);
      const targetID = tableOf(targetTuning.baseID);
      const section = createSection({
        [sourceID]: {
          namedNotes: { C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteTransparent' } },
          playedNotes: [played(0, 0, 'a')]
        },
        [targetID]: { namedNotes: {}, playedNotes: [] }
      });
      const song = createSong({ myTunings: [sourceTuning, targetTuning], sections: [section] });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });
      plugin.getVisibleMenuChildren();
      plugin.setPropertyValue('targetTable', sourceID, { song });
      plugin.invokeAction('copyToGraveyard', { song, args: { value: 'named' } });
      plugin.setPropertyValue('targetTable', targetID, { song });
      plugin.setPropertyValue('midiPasteMapId', 'Bass5 > Bass4', { song });

      plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

      expect(Object.keys(section.getSectionNotes(targetID).namedNotes)).toEqual(['C']);
    });
  });

  describe('recorded notes MIDI Paste', () => {
    function recorded(row, col, marker) {
      return { noteName: marker, marker, beat: 1, styleNum: Note.STYLENUM_SINGLE, row: `${row}`, col: `${col}`, colorClass: `note${marker}` };
    }

    function setupRecorded() {
      const sourceTuning = tuning('P48_1', 'P48', 'Guitar', P48_ROWS, { frets: 24 });
      const targetTuning = tuning('P46_1', 'P46', 'Guitar', P46_ROWS, { frets: 24 });
      const sourceID = tableOf('P48_1');
      const targetID = tableOf('P46_1');
      const sourceSection = createSection({
        [sourceID]: { recordedNotes: { '1': [recorded(0, 2, 'A'), recorded(6, 3, 'B')] } }
      });
      const destSection = createSection({ [targetID]: { recordedNotes: { '1': [] } } });
      const song = createSong({ myTunings: [sourceTuning, targetTuning], sections: [sourceSection, destSection] });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });
      plugin.getVisibleMenuChildren();
      plugin.setPropertyValue('targetTable', sourceID, { song });
      plugin.invokeAction('copyRecordedCurrentBeat', { song, args: {} });
      song.getCurrentSection = () => destSection;
      song.setRecording(true);
      plugin.setPropertyValue('targetTable', targetID, { song });
      return { plugin, song, destSection, targetID };
    }

    test('without a map an 8-string clip is unsupported, naming no map', () => {
      const { plugin, song } = setupRecorded();
      expect(plugin.invokeAction('pasteRecordedPlayIntoCurrent', { song, args: {} }).result)
        .toBe('P48_1 unsupported for MIDI Paste to P46_1');
    });

    test('with a map the recorded notes use it, skipping unmapped strings', () => {
      const { plugin, song, destSection, targetID } = setupRecorded();
      plugin.setPropertyValue('midiPasteMapId', 'P48 > P46', { song });

      const result = plugin.invokeAction('pasteRecordedPlayIntoCurrent', { song, args: {} });

      expect(result.result).toContain('played 1/1 beats: added 1, overwritten 0');
      expect(result.result).toContain('[map "P48 &gt; P46" forward]; unmapped 1; collisions 0');
      const notes = destSection.getSectionNotes(targetID).recordedNotes['1'];
      expect(notes.map((note) => `${note.marker}@${Number(note.row) + 1}:${note.col}`)).toEqual(['A@1:2']);
    });

    test('a non-fitting active map is named in the unsupported message', () => {
      const { plugin, song } = setupRecorded();
      plugin.setPropertyValue('midiPasteMapId', 'Bass6 > Bass4', { song });
      expect(plugin.invokeAction('pasteRecordedPlayIntoCurrent', { song, args: {} }).result)
        .toBe('P48_1 unsupported for MIDI Paste to P46_1 (map "Bass6 &gt; Bass4" does not fit)');
    });
  });

  describe('listener copy is unaffected by an active map', () => {
    test('listener projection still uses the row-and-MIDI default', () => {
      const song = createSong({
        myTunings: [tuning('S6_1', 'S6', 'Guitar', [64, 59, 55, 50, 45, 40], { frets: 24 }), tuning('P46_1', 'P46', 'Guitar', P46_ROWS, { frets: 24 })],
        sections: [createSection()]
      });
      mockRuntime.song = song;
      const plugin = new ClipPlugin();
      plugin.setManager({ song });
      plugin.addMidiPasteMap('"swap" 1:2, 2:1');
      plugin.selectMidiPasteMap('swap');

      const sourceLayout = createTuningLayout(tuning('S6_1', 'S6', 'Guitar', [64, 59, 55, 50, 45, 40], { frets: 24 }));
      const targetLayout = createTuningLayout(tuning('P46_1', 'P46', 'Guitar', P46_ROWS, { frets: 24 }));
      // buildMidiPasteCandidate (used by listener copy) keeps the source row regardless of any map
      const candidate = plugin.buildMidiPasteCandidate(played(0, 1, 'a'), sourceLayout, targetLayout);
      expect(candidate.row).toBe('0');
      expect(candidate.col).toBe('0');
    });
  });
});
