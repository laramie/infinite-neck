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
const { applyMovePlan, createTuningLayout, isBendLandingLegal } = await import('../../move-helpers.js');

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
});