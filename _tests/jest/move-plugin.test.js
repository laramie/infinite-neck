import { jest } from '@jest/globals';

const mockRuntime = {
  song: null
};

jest.unstable_mockModule('../../infinite-neck.js', () => ({
  getSong: () => mockRuntime.song
}));

const Constants = await import('../../Constants.js');
const { MovePlugin } = await import('../../plugins/move/MovePlugin.js');
const { SectionNotes } = await import('../../SectionNotes.js');
const { Note } = await import('../../Note.js');
const {
  ListenerProjection,
  applyMovePlan,
  createTuningLayout,
  isBendLandingLegal,
  projectListenerPlayedNotes,
  projectListenerRecordedNotes
} = await import('../../move-helpers.js');

function createTuning(overrides = {}) {
  return {
    baseID: 'Banjo_1',
    frets: 17,
    rowRange: [62, 57, 54, 50, 64],
    nut: true,
    banjoNut: { 4: 5 },
    reverse: false,
    ...overrides
  };
}

function createListenerSourceTuning(overrides = {}) {
  return {
    baseID: 'S6_1',
    fromBaseID: 'S6',
    baseInstrument: 'Guitar',
    nStrings: 6,
    frets: 24,
    rowRange: [64, 59, 55, 50, 45, 40],
    nut: true,
    reverse: false,
    ...overrides
  };
}

function createPianoTargetTuning(overrides = {}) {
  return {
    baseID: 'Piano_1',
    fromBaseID: 'Piano',
    baseInstrument: 'Piano',
    nStrings: 1,
    frets: 0,
    rowRange: [60],
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
    rootIDLead: '-1',
    caption: 'Verse',
    sectionNotesByTable,
    getSectionNotes(tableID) {
      if (!this.sectionNotesByTable[tableID]) {
        this.sectionNotesByTable[tableID] = new SectionNotes();
      }
      return this.sectionNotesByTable[tableID];
    }
  };
}

function createSong({ myTunings, sections, currentSectionIndex = 0 } = {}) {
  return {
    myTunings,
    wirings: [],
    sections,
    graveyard: {
      bury: jest.fn()
    },
    getCurrentSection() {
      return this.sections[currentSectionIndex];
    },
    requestUiFullRepaint: jest.fn()
  };
}

describe('Move helpers', () => {
  test('bend legality respects row-specific banjo nut cells', () => {
    const layout = createTuningLayout(createTuning());

    expect(isBendLandingLegal(layout, 4, 5)).toBe(false);
    expect(isBendLandingLegal(layout, 4, 6)).toBe(true);
  });

  test('pitch-wide highlights are singular per beat', () => {
    const tuning = createTuning({ banjoNut: {} });
    const sectionNotes = createSectionNotes({
      recordedNotes: {
        '1': [
          { styleNum: Note.STYLENUM_MIDIPITCHES, midinum: '60', row: '2', colorClass: 'noteTransparent' },
          { styleNum: Note.STYLENUM_MIDIPITCHES, midinum: '61', row: '2', colorClass: 'noteTransparent' }
        ]
      }
    });

    const result = applyMovePlan({
      tableID: `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`,
      sectionNotes,
      tuning,
      motion: 'u',
      algorithm: 'octave',
      include: { single: false, tiny: false, highlights: false, played: false, recorded: false },
      lookupContext: { section: createSection(), autoColor: true },
      logContext: { algorithm: 'octave', optionsSummary: 'test', applyNumber: 1 }
    });

    expect(result.recordedNotes['1']).toHaveLength(1);
    expect(result.droppedEntries).toHaveLength(1);
  });

  test('played notes take precedence over recorded notes at the same cell', () => {
    const tuning = createTuning({ banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const section = createSection();
    const sectionNotes = createSectionNotes({
      playedNotes: [
        { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent' }
      ],
      recordedNotes: {
        '1': [
          { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent' }
        ]
      }
    });

    const result = applyMovePlan({
      tableID,
      sectionNotes,
      tuning,
      motion: 'u',
      algorithm: 'octave',
      include: { single: false, tiny: false, highlights: false, played: false, recorded: false },
      lookupContext: { section, autoColor: true },
      logContext: { algorithm: 'octave', optionsSummary: 'test', applyNumber: 1 }
    });

    expect(result.playedNotes).toHaveLength(1);
    expect(result.recordedNotes['1']).toBeUndefined();
    expect(result.droppedEntries[0].reason).toBe('played note takes precedence');
  });

  test('string algorithm wraps jump up from the first row to the last row at the same fret', () => {
    const tuning = createTuning({ baseID: 'S6_1', banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const section = createSection();
    const sectionNotes = createSectionNotes({
      playedNotes: [
        { noteName: 'F', styleNum: Note.STYLENUM_SINGLE, midinum: '65', row: '0', col: '3', colorClass: 'noteTransparent' }
      ]
    });

    const result = applyMovePlan({
      tableID,
      sectionNotes,
      tuning,
      motion: 'j',
      algorithm: 'string',
      include: { single: true, tiny: false, highlights: false, played: true, recorded: false },
      lookupContext: { section, autoColor: true },
      logContext: { algorithm: 'string', optionsSummary: 'test', applyNumber: 1 }
    });

    expect(result.playedNotes).toHaveLength(1);
    expect(result.playedNotes[0].row).toBe('4');
    expect(result.playedNotes[0].col).toBe('3');
    expect(result.droppedEntries).toHaveLength(0);
  });

  test('string algorithm wraps jump down from the last row to the first row at the same fret', () => {
    const tuning = createTuning({ baseID: 'S6_1', banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const section = createSection();
    const sectionNotes = createSectionNotes({
      playedNotes: [
        { noteName: 'A', styleNum: Note.STYLENUM_SINGLE, midinum: '67', row: '4', col: '3', colorClass: 'noteTransparent' }
      ]
    });

    const result = applyMovePlan({
      tableID,
      sectionNotes,
      tuning,
      motion: 'J',
      algorithm: 'string',
      include: { single: true, tiny: false, highlights: false, played: true, recorded: false },
      lookupContext: { section, autoColor: true },
      logContext: { algorithm: 'string', optionsSummary: 'test', applyNumber: 1 }
    });

    expect(result.playedNotes).toHaveLength(1);
    expect(result.playedNotes[0].row).toBe('0');
    expect(result.playedNotes[0].col).toBe('3');
    expect(result.droppedEntries).toHaveLength(0);
  });

  test('string algorithm wrapped jump still drops when the wrapped row has no legal BanjoNut cell', () => {
    const tuning = createTuning();
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const section = createSection();
    const sectionNotes = createSectionNotes({
      playedNotes: [
        { noteName: 'F', styleNum: Note.STYLENUM_SINGLE, midinum: '65', row: '0', col: '3', colorClass: 'noteTransparent' }
      ]
    });

    const result = applyMovePlan({
      tableID,
      sectionNotes,
      tuning,
      motion: 'j',
      algorithm: 'string',
      include: { single: true, tiny: false, highlights: false, played: true, recorded: false },
      lookupContext: { section, autoColor: true },
      logContext: { algorithm: 'string', optionsSummary: 'test', applyNumber: 1 }
    });

    expect(result.playedNotes).toHaveLength(0);
    expect(result.droppedEntries).toHaveLength(1);
    expect(result.droppedEntries[0].reason).toBe('no string above row 0');
  });

  test('listener played-note projection overwrites collisions by selected string order', () => {
    const sourceTuning = createListenerSourceTuning();
    const targetTuning = createPianoTargetTuning();
    const lowStringNote = {
      noteName: 'C',
      styleNum: Note.STYLENUM_SINGLE,
      midinum: '60',
      row: '5',
      col: '20',
      colorClass: 'noteTransparent',
      marker: 'low-string'
    };
    const highStringNote = {
      noteName: 'C',
      styleNum: Note.STYLENUM_SINGLE,
      midinum: '60',
      row: '1',
      col: '1',
      colorClass: 'noteTransparent',
      marker: 'high-string'
    };

    const lowToHigh = projectListenerPlayedNotes({
      playedNotes: [highStringNote, lowStringNote],
      sourceTuning,
      targetTuning,
      listenerProjection: ListenerProjection.MIDI_LOW_TO_HIGH
    });
    const highToLow = projectListenerPlayedNotes({
      playedNotes: [highStringNote, lowStringNote],
      sourceTuning,
      targetTuning,
      listenerProjection: ListenerProjection.MIDI_HIGH_TO_LOW
    });

    expect(lowToHigh).toHaveLength(1);
    expect(lowToHigh[0].row).toBe('0');
    expect(lowToHigh[0].marker).toBe('high-string');

    expect(highToLow).toHaveLength(1);
    expect(highToLow[0].row).toBe('0');
    expect(highToLow[0].marker).toBe('low-string');
  });

  test('listener recorded-note projection carries highlights and beat-local overwrite order', () => {
    const sourceTuning = createListenerSourceTuning();
    const targetTuning = createPianoTargetTuning();
    const recordedNotes = {
      '1': [
        {
          noteName: 'C',
          styleNum: Note.STYLENUM_MIDIPITCHESSINGLE,
          midinum: '60',
          row: '5',
          col: '20',
          colorClass: 'noteTransparent',
          marker: 'low-string'
        },
        {
          noteName: 'C',
          styleNum: Note.STYLENUM_MIDIPITCHESSINGLE,
          midinum: '60',
          row: '1',
          col: '1',
          colorClass: 'noteTransparent',
          marker: 'high-string'
        },
        {
          noteName: 'C',
          styleNum: Note.STYLENUM_MIDIPITCHES,
          midinum: '60',
          row: '5',
          colorClass: 'noteTransparent',
          marker: 'pitch-highlight'
        }
      ]
    };

    const lowToHigh = projectListenerRecordedNotes({
      recordedNotes,
      sourceTuning,
      targetTuning,
      listenerProjection: ListenerProjection.MIDI_LOW_TO_HIGH
    });
    const highToLow = projectListenerRecordedNotes({
      recordedNotes,
      sourceTuning,
      targetTuning,
      listenerProjection: ListenerProjection.MIDI_HIGH_TO_LOW
    });

    expect(lowToHigh['1']).toHaveLength(2);
    expect(lowToHigh['1'].find((note) => note.styleNum === Note.STYLENUM_MIDIPITCHESSINGLE).marker).toBe('high-string');
    expect(lowToHigh['1'].find((note) => note.styleNum === Note.STYLENUM_MIDIPITCHES)).toEqual(
      expect.objectContaining({
        marker: 'pitch-highlight',
        midinum: '60',
        row: '0'
      })
    );

    expect(highToLow['1']).toHaveLength(2);
    expect(highToLow['1'].find((note) => note.styleNum === Note.STYLENUM_MIDIPITCHESSINGLE).marker).toBe('low-string');
  });
});

describe('MovePlugin', () => {
  test('target table defaults to the first eligible tuning and is not empty after menu render', () => {
    const song = createSong({
      myTunings: [createTuning({ baseID: 'S6_1', banjoNut: {} })],
      sections: [createSection()]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.setManager({ song });

    const children = plugin.getVisibleMenuChildren();
    const targetTable = children.find((child) => child.name === 'targetTable');

    expect(targetTable).toBeTruthy();
    expect(plugin.resolveValue('targetTable', { song })).toBe('S6_1');
  });

  test('apply with no include toggles logs start entry, backs up section, and returns no-op', () => {
    const tuning = createTuning({ baseID: 'S6_1', banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const song = createSong({
      myTunings: [tuning],
      sections: [createSection({ [tableID]: createSectionNotes() })]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();

    const result = plugin.invokeAction('apply', { song });

    expect(result.result).toContain('no-op');
    expect(song.graveyard.bury).toHaveBeenCalledTimes(1);
    expect(song.graveyard.bury).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      MovePlugin: { applyNumber: '1' }
    }));
    expect(plugin.droppedNotes).toHaveLength(2);
    expect(plugin.droppedNotes[0].reason).toBe('apply start');
    expect(plugin.droppedNotes[1].reason).toBe('no-op warning: no note styles selected');
  });

  test('include summary resolves without changing persisted include properties', () => {
    const song = createSong({
      myTunings: [createTuning({ baseID: 'S6_1', banjoNut: {} })],
      sections: [createSection()]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('includeSingle', true, { song });
    plugin.setPropertyValue('includeRecorded', true, { song });

    expect(plugin.resolveValue('includeSummary', { song })).toBe(' [s,r]');
    expect(plugin.exportSongState().includeSingle).toBe(true);
    expect(plugin.exportSongState().includeRecorded).toBe(true);
  });

  test('include summary includes the fingering flag without changing persisted include properties', () => {
    const song = createSong({
      myTunings: [createTuning({ baseID: 'S6_1', banjoNut: {} })],
      sections: [createSection()]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('includeFingering', true, { song });
    plugin.setPropertyValue('includePlayed', true, { song });

    expect(plugin.resolveValue('includeSummary', { song })).toBe(' [f,p]');
    expect(plugin.exportSongState().includeFingering).toBe(true);
    expect(plugin.exportSongState().includePlayed).toBe(true);
  });

  test('showDroppedNotes returns JSON content for showMessagesJSON', () => {
    const song = createSong({
      myTunings: [createTuning({ baseID: 'S6_1', banjoNut: {} })],
      sections: [createSection()]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.droppedNotes = [{ reason: 'apply start', applyNumber: 1 }];

    const result = plugin.invokeAction('showDroppedNotes', { song });

    expect(result.messageJSON).toBe(JSON.stringify({ droppedNotes: plugin.droppedNotes }, null, 2));
  });

  test('moving a bend onto a nut cell drops it', () => {
    const tuning = createTuning();
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const sectionNotes = createSectionNotes({
      playedNotes: [
        {
          noteName: 'E',
          styleNum: Note.STYLENUM_BEND,
          midinum: '70',
          row: '4',
          col: '6',
          colorClass: 'noteTransparent',
          bendValue: 'semitone1'
        }
      ]
    });
    const section = createSection({ [tableID]: sectionNotes });
    const song = createSong({
      myTunings: [tuning],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('includeTiny', true, { song });
    plugin.setPropertyValue('includePlayed', true, { song });
    plugin.setPropertyValue('motion', 'd', { song });

    const result = plugin.invokeAction('apply', { song });

    expect(result.result).toContain('dropped 1');
    expect(sectionNotes.playedNotes).toHaveLength(0);
    expect(plugin.droppedNotes.some((entry) => entry.reason === 'bend cannot land on nut')).toBe(true);
  });

  test('recorded note drops when moved destination is occupied by a played note', () => {
    const tuning = createTuning({ baseID: 'S6_1', banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const sectionNotes = createSectionNotes({
      playedNotes: [
        { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent' }
      ],
      recordedNotes: {
        '1': [
          { noteName: 'Db', styleNum: Note.STYLENUM_SINGLE, midinum: '61', row: '0', col: '0', colorClass: 'noteTransparent' }
        ]
      }
    });
    const section = createSection({ [tableID]: sectionNotes });
    const song = createSong({
      myTunings: [tuning],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('includeSingle', true, { song });
    plugin.setPropertyValue('includeRecorded', true, { song });
    plugin.setPropertyValue('motion', 'u', { song });

    const result = plugin.invokeAction('apply', { song });

    expect(result.result).toContain('moved 0');
    expect(sectionNotes.recordedNotes['1']).toBeUndefined();
    expect(plugin.droppedNotes.some((entry) => entry.reason === 'played note takes precedence')).toBe(true);
  });

  test('played fingering moves when includeFingering and includePlayed are enabled', () => {
    const tuning = createTuning({ baseID: 'S6_1', banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const sectionNotes = createSectionNotes({
      playedNotes: [
        { noteName: 'D', styleNum: Note.STYLENUM_FINGERING, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent', finger: '2' }
      ]
    });
    const section = createSection({ [tableID]: sectionNotes });
    const song = createSong({
      myTunings: [tuning],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('includeFingering', true, { song });
    plugin.setPropertyValue('includePlayed', true, { song });
    plugin.setPropertyValue('motion', 'u', { song });

    const result = plugin.invokeAction('apply', { song });

    expect(result.result).toContain('moved 1');
    expect(sectionNotes.playedNotes).toHaveLength(1);
    expect(sectionNotes.playedNotes[0].styleNum).toBe(Note.STYLENUM_FINGERING);
    expect(sectionNotes.playedNotes[0].midinum).toBe('63');
    expect(sectionNotes.playedNotes[0].row).toBe('0');
    expect(sectionNotes.playedNotes[0].col).toBe('1');
    expect(sectionNotes.playedNotes[0].finger).toBe('2');
  });

  test('recorded fingering moves when includeFingering and includeRecorded are enabled', () => {
    const tuning = createTuning({ baseID: 'S6_1', banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const sectionNotes = createSectionNotes({
      recordedNotes: {
        '2': [
          { noteName: 'D', styleNum: Note.STYLENUM_FINGERING, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent', finger: '3' }
        ]
      }
    });
    const section = createSection({ [tableID]: sectionNotes });
    const song = createSong({
      myTunings: [tuning],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('includeFingering', true, { song });
    plugin.setPropertyValue('includeRecorded', true, { song });
    plugin.setPropertyValue('motion', 'u', { song });

    const result = plugin.invokeAction('apply', { song });

    expect(result.result).toContain('moved 1');
    expect(sectionNotes.recordedNotes['2']).toHaveLength(1);
    expect(sectionNotes.recordedNotes['2'][0].styleNum).toBe(Note.STYLENUM_FINGERING);
    expect(sectionNotes.recordedNotes['2'][0].midinum).toBe('63');
    expect(sectionNotes.recordedNotes['2'][0].row).toBe('0');
    expect(sectionNotes.recordedNotes['2'][0].col).toBe('1');
    expect(sectionNotes.recordedNotes['2'][0].finger).toBe('3');
  });

  test('played fingering duplicate landing on the same cell is dropped', () => {
    const tuning = createTuning({ baseID: 'S6_1', banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const section = createSection();
    const sectionNotes = createSectionNotes({
      playedNotes: [
        { noteName: 'D', styleNum: Note.STYLENUM_FINGERING, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent', finger: '2' },
        { noteName: 'D', styleNum: Note.STYLENUM_FINGERING, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent', finger: '3' }
      ]
    });

    const result = applyMovePlan({
      tableID,
      sectionNotes,
      tuning,
      motion: 'u',
      algorithm: 'octave',
      include: { single: false, tiny: false, highlights: false, fingering: true, played: true, recorded: false },
      lookupContext: { section, autoColor: true },
      logContext: { algorithm: 'octave', optionsSummary: 'test', applyNumber: 1 }
    });

    expect(result.playedNotes).toHaveLength(1);
    expect(result.droppedEntries).toHaveLength(1);
  });

  test('recorded fingering duplicate landing on the same beat and cell is dropped', () => {
    const tuning = createTuning({ baseID: 'S6_1', banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const section = createSection();
    const sectionNotes = createSectionNotes({
      recordedNotes: {
        '1': [
          { noteName: 'D', styleNum: Note.STYLENUM_FINGERING, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent', finger: '2' },
          { noteName: 'D', styleNum: Note.STYLENUM_FINGERING, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent', finger: '3' }
        ]
      }
    });

    const result = applyMovePlan({
      tableID,
      sectionNotes,
      tuning,
      motion: 'u',
      algorithm: 'octave',
      include: { single: false, tiny: false, highlights: false, fingering: true, played: false, recorded: true },
      lookupContext: { section, autoColor: true },
      logContext: { algorithm: 'octave', optionsSummary: 'test', applyNumber: 1 }
    });

    expect(result.recordedNotes['1']).toHaveLength(1);
    expect(result.droppedEntries).toHaveLength(1);
  });

  test('recorded fingering still drops when moved destination is occupied by a played note', () => {
    const tuning = createTuning({ baseID: 'S6_1', banjoNut: {} });
    const tableID = `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
    const sectionNotes = createSectionNotes({
      playedNotes: [
        { noteName: 'D', styleNum: Note.STYLENUM_SINGLE, midinum: '62', row: '0', col: '0', colorClass: 'noteTransparent' }
      ],
      recordedNotes: {
        '1': [
          { noteName: 'Db', styleNum: Note.STYLENUM_FINGERING, midinum: '61', row: '0', col: '0', colorClass: 'noteTransparent', finger: '4' }
        ]
      }
    });
    const section = createSection({ [tableID]: sectionNotes });
    const song = createSong({
      myTunings: [tuning],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new MovePlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('includeFingering', true, { song });
    plugin.setPropertyValue('includeRecorded', true, { song });
    plugin.setPropertyValue('motion', 'u', { song });

    const result = plugin.invokeAction('apply', { song });

    expect(result.result).toContain('moved 0');
    expect(sectionNotes.recordedNotes['1']).toBeUndefined();
    expect(plugin.droppedNotes.some((entry) => entry.reason === 'played note takes precedence')).toBe(true);
  });
});