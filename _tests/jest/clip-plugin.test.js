import { jest } from '@jest/globals';

const mockRuntime = {
  song: null
};

jest.useFakeTimers().setSystemTime(new Date('2026-05-23T12:02:00Z'));

jest.unstable_mockModule('../../infinite-neck.js', () => ({
  getSong: () => mockRuntime.song
}));

const Constants = await import('../../Constants.js');
const { GraveType } = await import('../../graveyard.js');
const { ClipPlugin } = await import('../../plugins/clip/ClipPlugin.js');
const { SectionNotes } = await import('../../SectionNotes.js');
const { Note } = await import('../../Note.js');

function createTuning(overrides = {}) {
  return {
    baseID: 'P46',
    fromBaseID: 'P46',
    baseInstrument: 'Guitar',
    nStrings: 6,
    frets: 12,
    rowRange: [64, 59, 55, 50, 45, 40],
    nut: true,
    reverse: false,
    ...overrides
  };
}

function createSectionNotes(value = {}) {
  return value instanceof SectionNotes ? value : new SectionNotes(value);
}

function createSection(sectionNotesByTable = {}) {
  return {
    rootID: 3,
    caption: 'Verse',
    sectionNotesByTable: Object.fromEntries(
      Object.entries(sectionNotesByTable).map(([tableID, value]) => [tableID, createSectionNotes(value)])
    ),
    getSectionNotes(tableID) {
      if (!this.sectionNotesByTable[tableID]) {
        this.sectionNotesByTable[tableID] = new SectionNotes();
      }
      return this.sectionNotesByTable[tableID];
    }
  };
}

function createSong({ myTunings, sections, currentSectionIndex = 0, wirings = [], graveyard } = {}) {
  return {
    myTunings,
    sections,
    wirings,
    graveyard: graveyard || {
      records: [],
      bury(type, obj, context) {
        this.records.push({ type, context, json: JSON.stringify(obj), lastRevived: null });
      }
    },
    getCurrentSection() {
      return this.sections[currentSectionIndex];
    },
    requestUiFullRepaint: jest.fn()
  };
}

function getPlayedNotes(section, tableID) {
  return section.getSectionNotes(tableID).playedNotes;
}

function getNamedNotes(section, tableID) {
  return section.getSectionNotes(tableID).namedNotes;
}

describe('ClipPlugin', () => {
  afterAll(() => {
    jest.useRealTimers();
  });

  test('target table options include wired display tables because clip works on the current table itself', () => {
    const song = createSong({
      myTunings: [
        createTuning({ baseID: 'P46' }),
        createTuning({ baseID: 'P48' }),
        createTuning({ baseID: 'Bass4' })
      ],
      wirings: [
        { tablename: `${Constants.TABLE_ID_PREFIX}P48`, listenToTablename: `${Constants.TABLE_ID_PREFIX}P46` }
      ],
      sections: [createSection()]
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });

    const children = plugin.getVisibleMenuChildren();
    const targetNode = children.find((child) => child.name === 'targetTable');

    expect(targetNode.children.map((child) => child.value)).toEqual([
      `${Constants.TABLE_ID_PREFIX}P46`,
      `${Constants.TABLE_ID_PREFIX}P48`,
      `${Constants.TABLE_ID_PREFIX}Bass4`
    ]);
    expect(plugin.resolveValue('targetTable', { song })).toBe('P46');
  });

  test('revive menu uses input mode when automatic is disabled for a wired table selection', () => {
    const tableID = `${Constants.TABLE_ID_PREFIX}P46_1`;
    const song = createSong({
      myTunings: [
        createTuning({ baseID: 'P46_1' }),
        createTuning({ baseID: 'P48_1' })
      ],
      wirings: [
        { tablename: tableID, listenToTablename: `${Constants.TABLE_ID_PREFIX}P48_1` }
      ],
      sections: [createSection()],
      graveyard: {
        records: [
          {
            type: GraveType.CLIP,
            context: { userKey: 'named-4-single-4-1538', baseID: 'P46_1', fromBaseID: 'P46', tableID },
            json: JSON.stringify({
              schemaVersion: 1,
              source: { tableID, baseID: 'P46_1', fromBaseID: 'P46', frets: 24 },
              sectionNotes: { namedNotes: {}, playedNotes: [] }
            }),
            lastRevived: null
          }
        ]
      }
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('automatic', false, { song });
    plugin.setPropertyValue('targetTable', tableID, { song });

    const reviveNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'reviveFromGraveyard');

    expect(reviveNode.actionName).toBe('reviveClipChoice');
    expect(reviveNode.input.default).toBe('plugin:clip:defaultReviveChoice');
    expect(reviveNode.popOnBang).toBe(true);
    expect(reviveNode.input.children.map((child) => child.caption)).toEqual(['1) named-4-single-4-1538']);
    expect(plugin.resolveValue('defaultReviveChoice', { song })).toBe('1');
  });

  test('compatible clips match sibling myTunings instances by fromBaseID', () => {
    const sourceTableID = `${Constants.TABLE_ID_PREFIX}P46_1`;
    const targetTableID = `${Constants.TABLE_ID_PREFIX}P46_2`;
    const section = createSection({
      [sourceTableID]: {
        playedNotes: [
          { noteName: 'Ab', styleNum: Note.STYLENUM_SINGLE, row: '3', col: '6', colorClass: 'noteTransparent' },
          { noteName: 'C', styleNum: Note.STYLENUM_SINGLE, row: '2', col: '5', colorClass: 'noteTransparent' },
          { noteName: 'Gb', styleNum: Note.STYLENUM_SINGLE, row: '1', col: '6', colorClass: 'noteTransparent' }
        ]
      },
      [targetTableID]: {
        namedNotes: {
          E: { noteName: 'E', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteTransparent' }
        },
        playedNotes: []
      }
    });
    const song = createSong({
      myTunings: [
        createTuning({ baseID: 'P46_1', fromBaseID: 'P46', frets: 24 }),
        createTuning({ baseID: 'P46_2', fromBaseID: 'P46', frets: 24 })
      ],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('targetTable', sourceTableID, { song });

    const copyResult = plugin.invokeAction('copyToGraveyard', { song, args: { value: 'shared-p4' } });

    expect(copyResult.result).toContain('shared-p4');
    expect(song.graveyard.records).toHaveLength(1);
    expect(song.graveyard.records[0].context.baseID).toBe('P46_1');
    expect(song.graveyard.records[0].context.fromBaseID).toBe('P46');

    plugin.setPropertyValue('targetTable', targetTableID, { song });
    plugin.setPropertyValue('automatic', false, { song });

    const reviveNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'reviveFromGraveyard');
    const reviveResult = plugin.invokeAction('reviveClipChoice', { song, args: { value: '1' } });

    expect(reviveNode.input.children.map((child) => child.caption)).toEqual(['1) shared-p4']);
    expect(reviveResult.result).toContain('Clip revived shared-p4');
    expect(Object.keys(getNamedNotes(section, targetTableID)).sort()).toEqual(['E']);
    expect(getPlayedNotes(section, targetTableID).map((note) => `${note.noteName}:${note.row}:${note.col}`)).toEqual([
      'Ab:3:6',
      'C:2:5',
      'Gb:1:6'
    ]);
  });

  test('automatic defaults on and makes copy cut and revive same-level immediate actions', () => {
    const tableID = `${Constants.TABLE_ID_PREFIX}P46`;
    const song = createSong({
      myTunings: [createTuning()],
      sections: [createSection({
        [tableID]: {
          playedNotes: [
            { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '2', colorClass: 'noteTransparent' }
          ]
        }
      })]
    });
    mockRuntime.song = song;
    song.graveyard.records.push({
      type: GraveType.CLIP,
      context: { userKey: 'latest', baseID: 'P46', tableID },
      json: JSON.stringify({
        sectionNotes: {
          namedNotes: {},
          playedNotes: [
            { noteName: 'E', styleNum: Note.STYLENUM_TINY, row: '1', col: '3' }
          ]
        }
      }),
      lastRevived: null
    });

    const plugin = new ClipPlugin();
    plugin.setManager({ song });

    let children = plugin.getVisibleMenuChildren();
    let automaticNode = children.find((child) => child.name === 'automatic');
    let copyNode = children.find((child) => child.name === 'copyToGraveyard');
    let cutNode = children.find((child) => child.name === 'cutToGraveyard');
    let reviveNode = children.find((child) => child.name === 'reviveFromGraveyard');
    let midiPasteNode = children.find((child) => child.name === 'midiPasteFromGraveyard');
    let clearNode = children.find((child) => child.name === 'clearClips');

    expect(automaticNode.trigger).toBe('a');
    expect(plugin.getProperty('automatic').getValue()).toBe(true);
    expect(copyNode.input).toBeNull();
    expect(cutNode.input).toBeNull();
    expect(reviveNode.input).toBeNull();
    expect(midiPasteNode.input).toBeNull();
    expect(copyNode.popOnBang).toBe(false);
    expect(cutNode.popOnBang).toBe(false);
    expect(reviveNode.popOnBang).toBe(false);
    expect(midiPasteNode.popOnBang).toBe(false);
    expect(clearNode.popOnBang).toBe(false);

    const reviveResult = plugin.invokeAction('reviveClipChoice', { song, args: {} });
    const result = plugin.invokeAction('copyToGraveyard', { song, args: {} });

    expect(automaticNode.trigger).toBe('a');
    expect(reviveResult.result).toContain('Clip revived latest');
    expect(result.result).toMatch(/single-1-tiny-1-\d{4}/);
    expect(song.graveyard.records).toHaveLength(2);

    plugin.setPropertyValue('automatic', false, { song });
    children = plugin.getVisibleMenuChildren();
    copyNode = children.find((child) => child.name === 'copyToGraveyard');
    cutNode = children.find((child) => child.name === 'cutToGraveyard');
    reviveNode = children.find((child) => child.name === 'reviveFromGraveyard');
    midiPasteNode = children.find((child) => child.name === 'midiPasteFromGraveyard');
    clearNode = children.find((child) => child.name === 'clearClips');

    expect(copyNode.input).not.toBeNull();
    expect(cutNode.input).not.toBeNull();
    expect(reviveNode.input).not.toBeNull();
    expect(midiPasteNode.input).not.toBeNull();
    expect(copyNode.popOnBang).toBe(true);
    expect(cutNode.popOnBang).toBe(true);
    expect(reviveNode.popOnBang).toBe(true);
    expect(midiPasteNode.popOnBang).toBe(true);
    expect(clearNode.popOnBang).toBe(false);
  });

  test('midi paste menu lists supported cross-tuning clips when automatic is disabled', () => {
    const targetTableID = `${Constants.TABLE_ID_PREFIX}P46_1`;
    const song = createSong({
      myTunings: [
        createTuning({ baseID: 'P46_1', fromBaseID: 'P46', rowRange: [65, 60, 55, 50, 45, 40], frets: 24 })
      ],
      sections: [createSection()],
      graveyard: {
        records: [
          {
            type: GraveType.CLIP,
            context: { userKey: 'bass-clip', baseID: 'Bass4_1', fromBaseID: 'Bass4', tableID: `${Constants.TABLE_ID_PREFIX}Bass4_1` },
            json: JSON.stringify({
              source: {
                tableID: `${Constants.TABLE_ID_PREFIX}Bass4_1`,
                baseID: 'Bass4_1',
                fromBaseID: 'Bass4',
                baseInstrument: 'Bass',
                nStrings: 4,
                rowRange: [43, 38, 33, 28],
                frets: 24,
                nut: true,
                reverse: false
              },
              sectionNotes: { namedNotes: {}, playedNotes: [] }
            }),
            lastRevived: null
          },
          {
            type: GraveType.CLIP,
            context: { userKey: 's6-clip', baseID: 'S6_1', fromBaseID: 'S6', tableID: `${Constants.TABLE_ID_PREFIX}S6_1` },
            json: JSON.stringify({
              source: {
                tableID: `${Constants.TABLE_ID_PREFIX}S6_1`,
                baseID: 'S6_1',
                fromBaseID: 'S6',
                baseInstrument: 'Guitar',
                nStrings: 6,
                rowRange: [64, 59, 55, 50, 45, 40],
                frets: 24,
                nut: true,
                reverse: false
              },
              sectionNotes: { namedNotes: {}, playedNotes: [] }
            }),
            lastRevived: null
          }
        ]
      }
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('automatic', false, { song });
    plugin.setPropertyValue('targetTable', targetTableID, { song });

    const midiPasteNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'midiPasteFromGraveyard');

    expect(midiPasteNode.input.default).toBe('plugin:clip:defaultMidiPasteChoice');
    expect(midiPasteNode.input.children.map((child) => child.caption)).toEqual(['1) s6-clip']);
    expect(plugin.resolveValue('defaultMidiPasteChoice', { song })).toBe('1');
  });

  test('midi paste maps played notes by midi on the same string and drops illegal landings', () => {
    const sourceTableID = `${Constants.TABLE_ID_PREFIX}S6_1`;
    const targetTableID = `${Constants.TABLE_ID_PREFIX}P46_1`;
    const section = createSection({
      [sourceTableID]: {
        namedNotes: {
          C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteTransparent' }
        },
        playedNotes: [
          { noteName: 'A', styleNum: Note.STYLENUM_SINGLE, midinum: '69', row: '0', col: '5', colorClass: 'noteTransparent' },
          { noteName: 'B', styleNum: Note.STYLENUM_TINY, midinum: '59', row: '1', col: '0', colorClass: 'noteTransparent' },
          { noteName: 'Bb', styleNum: Note.STYLENUM_BEND, row: '2', col: '3', colorClass: 'noteTransparent', bendValue: 'semitone1' }
        ]
      },
      [targetTableID]: {
        namedNotes: {
          E: { noteName: 'E', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteTransparent' }
        },
        playedNotes: [
          { noteName: 'Db', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '4', colorClass: 'noteTransparent' }
        ]
      }
    });
    const song = createSong({
      myTunings: [
        createTuning({ baseID: 'S6_1', fromBaseID: 'S6', rowRange: [64, 59, 55, 50, 45, 40], frets: 24 }),
        createTuning({ baseID: 'P46_1', fromBaseID: 'P46', rowRange: [65, 60, 55, 50, 45, 40], frets: 24 })
      ],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('targetTable', sourceTableID, { song });

    const copyResult = plugin.invokeAction('copyToGraveyard', { song, args: { value: 's6-riff' } });

    expect(copyResult.result).toContain('s6-riff');

    plugin.setPropertyValue('targetTable', targetTableID, { song });
    plugin.setPropertyValue('automatic', false, { song });
    plugin.setPropertyValue('overwrite', false, { song });

    const midiPasteNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'midiPasteFromGraveyard');
    const result = plugin.invokeAction('midiPasteClipChoice', { song, args: { value: '1' } });

    expect(midiPasteNode.input.children.map((child) => child.caption)).toEqual(['1) s6-riff']);
    expect(result.result).toContain('MIDI Paste revived s6-riff');
    expect(result.result).toContain('named +1 overwrite 0 skip 0');
    expect(result.result).toContain('played +1 overwrite 0 skip 1');
    expect(result.result).toContain('dropped 1');
    expect(Object.keys(getNamedNotes(section, targetTableID)).sort()).toEqual(['C', 'E']);
    expect(getPlayedNotes(section, targetTableID).map((note) => `${note.styleNum}:${note.row}:${note.col}:${note.noteName}`)).toEqual([
      `${Note.STYLENUM_SINGLE}:0:4:Db`,
      `${Note.STYLENUM_BEND}:2:3:Bb`
    ]);
  });

  test('include summary shows live counts for enabled lanes', () => {
    const tableID = `${Constants.TABLE_ID_PREFIX}P46`;
    const song = createSong({
      myTunings: [createTuning()],
      sections: [createSection({
        [tableID]: {
          namedNotes: {
            C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED },
            E: { noteName: 'E', styleNum: Note.STYLENUM_NAMED }
          },
          playedNotes: [
            { noteName: 'C', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '0' },
            { noteName: 'E', styleNum: Note.STYLENUM_TINY, row: '1', col: '2' },
            { noteName: 'G', styleNum: Note.STYLENUM_BEND, row: '2', col: '5', bendValue: 'semitone1' }
          ]
        }
      })]
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('includeBend', false, { song });

    expect(plugin.resolveValue('includeSummary', { song })).toBe(' [n:2,s:1,t:1]');
  });

  test('copy stores a CLIP graveyard record with stripped owner fields and default naming', () => {
    const tableID = `${Constants.TABLE_ID_PREFIX}P46`;
    const song = createSong({
      myTunings: [createTuning()],
      sections: [createSection({
        [tableID]: {
          namedNotes: {
            C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteRoot', owner: 'FillPlugin' }
          },
          playedNotes: [
            { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '2', colorClass: 'noteChord', owner: 'FillPlugin' },
            { noteName: 'E', styleNum: Note.STYLENUM_BEND, row: '1', col: '3', bendValue: 'semitone1', owner: 'MovePlugin' }
          ]
        }
      })]
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();

    const result = plugin.invokeAction('copyToGraveyard', { song, args: {} });

    expect(result.result).toMatch(/named-1-single-1-bend-1-\d{4}/);
    expect(song.graveyard.records).toHaveLength(1);
    expect(song.graveyard.records[0].type).toBe(GraveType.CLIP);
    expect(song.graveyard.records[0].context.tableID).toBe(tableID);
    const payload = JSON.parse(song.graveyard.records[0].json);
    expect(payload.counts).toEqual({ named: 1, single: 1, tiny: 0, bend: 1 });
    expect(payload.sectionNotes.namedNotes.C.owner).toBeUndefined();
    expect(payload.sectionNotes.playedNotes.every((note) => note.owner == null)).toBe(true);
  });

  test('cut removes only included lanes from the selected table after burying a clip', () => {
    const tableID = `${Constants.TABLE_ID_PREFIX}P46`;
    const section = createSection({
      [tableID]: {
        namedNotes: {
          C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED }
        },
        playedNotes: [
          { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '2' },
          { noteName: 'E', styleNum: Note.STYLENUM_TINY, row: '1', col: '3' },
          { noteName: 'F', styleNum: Note.STYLENUM_BEND, row: '2', col: '4', bendValue: 'semitone1' }
        ]
      },
      [`${Constants.TABLE_ID_PREFIX}P48`]: {
        namedNotes: {
          G: { noteName: 'G', styleNum: Note.STYLENUM_NAMED }
        }
      }
    });
    const song = createSong({
      myTunings: [createTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('includeTiny', false, { song });

    const result = plugin.invokeAction('cutToGraveyard', { song, args: { value: 'riff' } });

    expect(result.result).toContain('removed named=1 played=2');
    expect(song.graveyard.records).toHaveLength(1);
    expect(Object.keys(getNamedNotes(section, tableID))).toEqual([]);
    expect(getPlayedNotes(section, tableID).map((note) => note.styleNum)).toEqual([Note.STYLENUM_TINY]);
    expect(Object.keys(getNamedNotes(section, `${Constants.TABLE_ID_PREFIX}P48`))).toEqual(['G']);
    expect(song.requestUiFullRepaint).toHaveBeenCalled();
  });

  test('revive input defaults to clip 1 and choice 1 revives the newest compatible clip', () => {
    const tableID = `${Constants.TABLE_ID_PREFIX}P46`;
    const graveyard = {
      records: [
        {
          type: GraveType.CLIP,
          context: { userKey: 'older', baseID: 'P46', tableID },
          json: JSON.stringify({
            sectionNotes: {
              namedNotes: {
                C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED }
              },
              playedNotes: [
                { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '1' }
              ]
            }
          }),
          lastRevived: null
        },
        {
          type: GraveType.CLIP,
          context: { userKey: 'newer', baseID: 'P46', tableID },
          json: JSON.stringify({
            sectionNotes: {
              namedNotes: {
                C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteScale' },
                E: { noteName: 'E', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteChord' }
              },
              playedNotes: [
                { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '1' },
                { noteName: 'F', styleNum: Note.STYLENUM_TINY, row: '1', col: '2' },
                { noteName: 'A', styleNum: Note.STYLENUM_BEND, row: '4', col: '20', bendValue: 'whole1' }
              ]
            }
          }),
          lastRevived: null
        },
        {
          type: GraveType.CLIP,
          context: { userKey: 'other-tuning', baseID: 'Bass4', tableID: `${Constants.TABLE_ID_PREFIX}Bass4` },
          json: JSON.stringify({ sectionNotes: { namedNotes: {}, playedNotes: [] } }),
          lastRevived: null
        }
      ]
    };
    const section = createSection({
      [tableID]: {
        namedNotes: {
          C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteRoot' }
        },
        playedNotes: [
          { noteName: 'Db', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '1' }
        ]
      }
    });
    const song = createSong({
      myTunings: [createTuning()],
      sections: [section],
      graveyard
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('overwrite', false, { song });

    const reviveNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'reviveFromGraveyard');

    expect(plugin.resolveValue('defaultReviveChoice', { song })).toBe('1');
    expect(reviveNode.actionName).toBe('reviveClipChoice');

    const result = plugin.invokeAction('reviveClipChoice', { song, args: { value: '1' } });

    expect(result.result).toContain('named +1 overwrite 0 skip 1');
    expect(result.result).toContain('played +1 overwrite 0 skip 1');
    expect(result.result).toContain('dropped 1');
    expect(Object.keys(getNamedNotes(section, tableID)).sort()).toEqual(['C', 'E']);
    expect(getPlayedNotes(section, tableID).map((note) => `${note.styleNum}:${note.row}:${note.col}`)).toEqual([
      `${Note.STYLENUM_SINGLE}:0:1`,
      `${Note.STYLENUM_TINY}:1:2`
    ]);
    expect(song.graveyard.records[1].lastRevived).not.toBeNull();
  });

  test('revive choice rejects invalid or unavailable clip numbers', () => {
    const song = createSong({
      myTunings: [createTuning()],
      sections: [createSection()]
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('automatic', false, { song });

    const reviveNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'reviveFromGraveyard');

    expect(reviveNode.input.children.map((child) => child.caption)).toEqual(['0) none']);
    expect(plugin.invokeAction('reviveClipChoice', { song, args: { value: '' } }).result).toContain('invalid choice');
    expect(plugin.invokeAction('reviveClipChoice', { song, args: { value: '1' } }).result).toContain('choice 1 not available');
  });

  test('revive overwrites matching named and played lanes when overwrite is true', () => {
    const tableID = `${Constants.TABLE_ID_PREFIX}P46`;
    const graveyard = {
      records: [
        {
          type: GraveType.CLIP,
          context: { userKey: 'clip', baseID: 'P46', tableID },
          json: JSON.stringify({
            sectionNotes: {
              namedNotes: {
                C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteScale' }
              },
              playedNotes: [
                { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '1', colorClass: 'noteScale' },
                { noteName: 'E', styleNum: Note.STYLENUM_TINY, row: '0', col: '1', colorClass: 'noteChord' }
              ]
            }
          }),
          lastRevived: null
        }
      ]
    };
    const section = createSection({
      [tableID]: {
        namedNotes: {
          C: { noteName: 'C', styleNum: Note.STYLENUM_NAMED, colorClass: 'noteRoot' }
        },
        playedNotes: [
          { noteName: 'Db', styleNum: Note.STYLENUM_SINGLE, row: '0', col: '1', colorClass: 'noteRoot' },
          { noteName: 'F', styleNum: Note.STYLENUM_TINY, row: '0', col: '1', colorClass: 'noteRoot' }
        ]
      }
    });
    const song = createSong({
      myTunings: [createTuning()],
      sections: [section],
      graveyard
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();

    const result = plugin.invokeAction('reviveClip:0', { song });

    expect(result.result).toContain('named +0 overwrite 1 skip 0');
    expect(result.result).toContain('played +0 overwrite 2 skip 0');
    expect(getNamedNotes(section, tableID).C.colorClass).toBe('noteScale');
    expect(getPlayedNotes(section, tableID).map((note) => note.noteName)).toEqual(['D', 'E']);
  });

  test('clearClips removes only CLIP graveyard records', () => {
    const song = createSong({
      myTunings: [createTuning()],
      sections: [createSection()],
      graveyard: {
        records: [
          { type: GraveType.SECTION, context: {}, json: '{}' },
          { type: GraveType.CLIP, context: {}, json: '{}' },
          { type: GraveType.CLIP, context: {}, json: '{}' }
        ]
      }
    });
    mockRuntime.song = song;

    const plugin = new ClipPlugin();

    const result = plugin.invokeAction('clearClips', { song });

    expect(result.result).toBe('Clip clear removed 2 clip records');
    expect(song.graveyard.records).toHaveLength(1);
    expect(song.graveyard.records[0].type).toBe(GraveType.SECTION);
  });
});