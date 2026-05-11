import { jest } from '@jest/globals';

const mockRuntime = {
  song: null
};

const mockPalettePresentation = {
  getLastRestorableRbColor: jest.fn(() => ({
    id: 'idRTransparent',
    value: 'noteTransparent',
    caption: 'Emboss'
  }))
};

jest.unstable_mockModule('../../infinite-neck.js', () => ({
  getSong: () => mockRuntime.song
}));

jest.unstable_mockModule('../../presentation.js', () => ({
  PalettePresentation: mockPalettePresentation
}));

const Constants = await import('../../Constants.js');
const { FillPlugin } = await import('../../plugins/fill/FillPlugin.js');
const { SectionNotes } = await import('../../SectionNotes.js');
const { Note } = await import('../../Note.js');

function makeSectionNotesByTable(entries = {}) {
  return Object.fromEntries(
    Object.entries(entries).map(([tableID, value]) => [tableID, value instanceof SectionNotes ? value : new SectionNotes(value)])
  );
}

function makeSection(sectionNotesByTable = {}) {
  const normalized = makeSectionNotesByTable(sectionNotesByTable);
  return {
    rootID: 3,
    sectionNotesByTable: normalized,
    getSectionNotes(tableID) {
      if (!this.sectionNotesByTable[tableID]) {
        this.sectionNotesByTable[tableID] = new SectionNotes();
      }
      return this.sectionNotesByTable[tableID];
    }
  };
}

function makeSong({ myTunings, wirings = [], sections, currentSectionIndex = 0, isHeadless = true } = {}) {
  return {
    myTunings,
    wirings,
    sections,
    isHeadless,
    getCurrentSection() {
      return this.sections[currentSectionIndex];
    },
    requestUiClearAll: jest.fn(),
    requestUiReplay: jest.fn(),
    requestUiShowBeats: jest.fn()
  };
}

function createPrimaryTuning(overrides = {}) {
  return {
    baseID: 'P1',
    frets: 12,
    rowRange: [48],
    nut: true,
    reverse: false,
    ...overrides
  };
}

function getPlayedNotes(section, tableID) {
  return section.getSectionNotes(tableID).playedNotes;
}

describe('FillPlugin', () => {
  beforeEach(() => {
    mockPalettePresentation.getLastRestorableRbColor.mockClear();
  });

  test('target table options exclude wired display tables and default to the first eligible table', () => {
    const song = makeSong({
      myTunings: [
        createPrimaryTuning({ baseID: 'S6_1' }),
        createPrimaryTuning({ baseID: 'P4_1' }),
        createPrimaryTuning({ baseID: 'B4_1' })
      ],
      wirings: [
        { tablename: `${Constants.TABLE_ID_PREFIX}P4_1`, listenToTablename: `${Constants.TABLE_ID_PREFIX}S6_1` }
      ],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    const children = plugin.getVisibleMenuChildren();
    const targetNode = children.find((child) => child.name === 'targetTable');

    expect(targetNode.children.map((child) => child.value)).toEqual([
      `${Constants.TABLE_ID_PREFIX}S6_1`,
      `${Constants.TABLE_ID_PREFIX}B4_1`
    ]);
    expect(plugin.getProperty('targetTable').getValue()).toBe(`${Constants.TABLE_ID_PREFIX}S6_1`);
    expect(plugin.resolveValue('targetTable', { song })).toBe('S6_1');
  });

  test('target table resolves on first display without prior submenu navigation', () => {
    const song = makeSong({
      myTunings: [
        createPrimaryTuning({ baseID: 'P46_1' })
      ],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    expect(plugin.getProperty('targetTable').getValue()).toBe('');
    expect(plugin.resolveValue('targetTable', { song })).toBe('P46_1');
    expect(plugin.getProperty('targetTable').getValue()).toBe(`${Constants.TABLE_ID_PREFIX}P46_1`);
  });

  test('startup keeps maxFret at FIRST_POSITION_MAX_FRET before any submenu navigation', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning({ baseID: 'P46_1', frets: 24, rowRange: [64, 59, 55, 50, 45, 40] })],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    plugin.getVisibleMenuChildren();

    expect(plugin.getProperty('minFret').getValue()).toBe(0);
    expect(plugin.getProperty('maxFret').getValue()).toBe(Constants.FIRST_POSITION_MAX_FRET);
  });

  test('refreshing without any available target tuning does not collapse maxFret to zero', () => {
    const song = makeSong({
      myTunings: [],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    plugin.getVisibleMenuChildren();

    expect(plugin.getProperty('targetTable').getValue()).toBe('');
    expect(plugin.getProperty('maxFret').getValue()).toBe(Constants.FIRST_POSITION_MAX_FRET);
  });

  test('groups configurable FillPlugin options under a dedicated options submenu', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    const children = plugin.getVisibleMenuChildren();
    const optionsNode = children.find((child) => child.name === 'options');

    expect(children.map((child) => child.name)).toEqual([
      'targetTable',
      'options',
      'apply',
      'clear',
      'clearSong',
      'commitNotes',
      'help'
    ]);
    expect(optionsNode.trigger).toBe('o');
    expect(optionsNode.children.map((child) => child.name)).toEqual([
      'chordFormula',
      'scaleFormula',
      'minFret',
      'maxFret',
      'minRow',
      'maxRow',
      'root',
      'chord',
      'scale',
      'tinyNotes',
      'apply'
    ]);
    expect(optionsNode.children.map((child) => child.trigger)).toEqual([
      'd',
      'g',
      'm',
      'f',
      'u',
      'l',
      'r',
      'c',
      's',
      't',
      'A'
    ]);
    expect(optionsNode.children[4].name).toBe('minRow');
    expect(optionsNode.children[5].name).toBe('maxRow');
    expect(optionsNode.children[4].caption).toContain('pper string limit');
    expect(optionsNode.children[5].caption).toContain('ower string limit');
    expect(optionsNode.children.at(-1).actionName).toBe('apply');
  });

  test('string limits display as 1-based values while persisting zero-based rows', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning({ rowRange: [64, 59, 55, 50, 45, 40] })],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    expect(plugin.getProperty('maxFret').getValue()).toBe(Constants.FIRST_POSITION_MAX_FRET);
    expect(plugin.resolveValue('minRow', { song })).toBe(1);
    expect(plugin.resolveValue('maxRow', { song })).toBe(6);

    plugin.setPropertyValue('minRow', 2, { song });
    plugin.setPropertyValue('maxRow', 5, { song });

    expect(plugin.getProperty('minRow').getValue()).toBe(1);
    expect(plugin.getProperty('maxRow').getValue()).toBe(4);
    expect(plugin.resolveValue('minRow', { song })).toBe(2);
    expect(plugin.resolveValue('maxRow', { song })).toBe(5);
  });

  test('role displays default to canonical note role colors on startup', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    expect(plugin.getProperty('rootMode').getValue()).toBe('role');
    expect(plugin.getProperty('chordMode').getValue()).toBe('role');
    expect(plugin.getProperty('scaleMode').getValue()).toBe('role');
    expect(plugin.resolveValue('rootDisplay', { song })).toBe('noteRoot');
    expect(plugin.resolveValue('chordDisplay', { song })).toBe('noteChord');
    expect(plugin.resolveValue('scaleDisplay', { song })).toBe('noteScale');
  });

  test('registers the same section-begin event used by looper and arpeggio', () => {
    const plugin = new FillPlugin();

    expect(plugin.getEventNames()).toEqual(['DaCapo:OnSectionBegin']);
  });

  test('ignores the legacy empty persisted Fill stub and restores runtime defaults', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning({ baseID: 'P46_1', frets: 24, rowRange: [64, 59, 55, 50, 45, 40] })],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.loadSongState({
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
    }, { song });

    expect(plugin.getProperty('targetTable').getValue()).toBe(`${Constants.TABLE_ID_PREFIX}P46_1`);
    expect(plugin.getProperty('maxFret').getValue()).toBe(Constants.FIRST_POSITION_MAX_FRET);
    expect(plugin.resolveValue('maxRow', { song })).toBe(6);
  });

  test('help and summary use user-facing table and string terminology', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning({ baseID: 'P46_1', rowRange: [64, 59, 55, 50, 45, 40] })],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    const help = plugin.buildHelpMessage(song);

    expect(plugin.buildSummary(song)).toContain('target table=P46_1');
    expect(plugin.buildSummary(song)).toContain(`fret range=0..${Constants.FIRST_POSITION_MAX_FRET}`);
    expect(plugin.buildSummary(song)).toContain('upper/lower string limit=1..6');
    expect(plugin.buildSummary(song)).toContain('tiny notes=none');
    expect(help).toContain('target table = P46_1');
    expect(help).toContain('upper/lower string limit = 1..6');
    expect(help).toContain('root color = noteRoot');
    expect(help).toContain('Events handled:');
    expect(help).toContain('DaCapo:OnSectionBegin');
  });

  test('apply fills SingleNotes, preserves precedence, and skips occupied user SingleNotes', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({
      [targetTable]: {
        playedNotes: [
          new Note({ noteName: 'E', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 4, midinum: 52, colorClass: 'noteBlack' })
        ]
      }
    });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('rootMode', 'role', { song });
    plugin.setPropertyValue('rootColor', 'noteRoot', { song });
    plugin.setPropertyValue('chordMode', 'role', { song });
    plugin.setPropertyValue('chordColor', 'noteChord', { song });
    plugin.setPropertyValue('scaleMode', 'role', { song });
    plugin.setPropertyValue('scaleColor', 'noteScale', { song });

    const result = plugin.applyToCurrentSection(song);
    const playedNotes = getPlayedNotes(section, targetTable);
    const noteByCell = Object.fromEntries(playedNotes.map((note) => [`${note.row}:${note.col}`, note]));

    expect(result.result).toBe('Fill applied: added 2, tiny 0, skipped 1');
    expect(playedNotes.every((note) => note.styleNum === Note.STYLENUM_SINGLE)).toBe(true);
    expect(noteByCell['0:0'].colorClass).toBe('noteRoot');
    expect(noteByCell['0:2'].colorClass).toBe('noteScale');
    expect(noteByCell['0:4'].colorClass).toBe('noteBlack');
    expect(noteByCell['0:7']).toBeUndefined();
    expect(noteByCell['0:11']).toBeUndefined();
  });

  test('section-begin event applies Fill to the payload section without changing options', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const firstSection = makeSection({ [targetTable]: {} });
    const secondSection = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [firstSection, secondSection],
      currentSectionIndex: 0
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('maxFret', 7, { song });
    plugin.setPropertyValue('minRow', 1, { song });
    plugin.setPropertyValue('maxRow', 1, { song });

    const beforeOptions = {
      targetTable: plugin.getProperty('targetTable').getValue(),
      minFret: plugin.getProperty('minFret').getValue(),
      maxFret: plugin.getProperty('maxFret').getValue(),
      minRow: plugin.getProperty('minRow').getValue(),
      maxRow: plugin.getProperty('maxRow').getValue()
    };

    const result = plugin.handleEvent('DaCapo:OnSectionBegin', { sectionIndex: 1 }, { song });

  expect(result.result).toBe('Fill applied: added 5, tiny 0, skipped 0');
    expect(getPlayedNotes(firstSection, targetTable)).toHaveLength(0);
    expect(getPlayedNotes(secondSection, targetTable)).toHaveLength(5);
    expect(plugin.getProperty('targetTable').getValue()).toBe(beforeOptions.targetTable);
    expect(plugin.getProperty('minFret').getValue()).toBe(beforeOptions.minFret);
    expect(plugin.getProperty('maxFret').getValue()).toBe(beforeOptions.maxFret);
    expect(plugin.getProperty('minRow').getValue()).toBe(beforeOptions.minRow);
    expect(plugin.getProperty('maxRow').getValue()).toBe(beforeOptions.maxRow);
  });

  test('apply resolves noteAutomatic to a concrete note* color at fill time', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('rootMode', 'role', { song });
    plugin.setPropertyValue('rootColor', 'noteAutomatic', { song });
    plugin.setPropertyValue('chordMode', 'keep', { song });
    plugin.setPropertyValue('scaleMode', 'keep', { song });

    plugin.applyToCurrentSection(song);

    const rootNotes = getPlayedNotes(section, targetTable).filter((note) => note.noteName === 'C');
    expect(rootNotes.length).toBeGreaterThan(0);
    expect(rootNotes[0].colorClass).toBe('note1');
  });

  test('last role selection stores the current remembered palette value and switches mode to role', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;
    mockPalettePresentation.getLastRestorableRbColor.mockReturnValueOnce({
      id: 'idRAuto',
      value: 'noteAutomatic',
      caption: 'Auto'
    });

    const plugin = new FillPlugin();
    const result = plugin.invokeAction('setRoleColorLast:scale', { song });

    expect(result.result).toBe('scale color set to noteAutomatic');
    expect(plugin.getProperty('scaleMode').getValue()).toBe('role');
    expect(plugin.getProperty('scaleColor').getValue()).toBe('noteAutomatic');
  });

  test('clear current section, clear song, and commit notes affect only FillPlugin-owned SingleNotes in the selected table', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const otherTable = `${Constants.TABLE_ID_PREFIX}ALT`;
    const firstSection = makeSection({
      [targetTable]: {
        playedNotes: [
          new Note({ noteName: 'C', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 0, owner: 'FillPlugin' }),
          new Note({ noteName: 'C', styleNum: Note.STYLENUM_TINY, row: 0, col: 0, owner: 'FillPlugin' }),
          new Note({ noteName: 'D', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 2 })
        ]
      },
      [otherTable]: {
        playedNotes: [
          new Note({ noteName: 'E', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 4, owner: 'FillPlugin' })
        ]
      }
    });
    const secondSection = makeSection({
      [targetTable]: {
        playedNotes: [
          new Note({ noteName: 'F', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 5, owner: 'FillPlugin' }),
          new Note({ noteName: 'F', styleNum: Note.STYLENUM_TINY, row: 0, col: 5, owner: 'FillPlugin' })
        ]
      }
    });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [firstSection, secondSection],
      currentSectionIndex: 0
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setPropertyValue('targetTable', targetTable, { song });

    expect(plugin.clearCurrentSection(song).result).toBe('Fill cleared current section');
    expect(getPlayedNotes(firstSection, targetTable).map((note) => note.noteName)).toEqual(['D']);
    expect(getPlayedNotes(secondSection, targetTable).map((note) => note.noteName)).toEqual(['F', 'F']);
    expect(getPlayedNotes(firstSection, otherTable).map((note) => note.noteName)).toEqual(['E']);

    firstSection.getSectionNotes(targetTable).playedNotes.push(new Note({ noteName: 'C', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 0, owner: 'FillPlugin' }));
    firstSection.getSectionNotes(targetTable).playedNotes.push(new Note({ noteName: 'C', styleNum: Note.STYLENUM_TINY, row: 0, col: 0, owner: 'FillPlugin' }));

    expect(plugin.commitNotes(song).result).toBe('Fill committed generated notes');
    expect(getPlayedNotes(firstSection, targetTable).some((note) => note.owner === 'FillPlugin')).toBe(false);
    expect(getPlayedNotes(secondSection, targetTable).some((note) => note.owner === 'FillPlugin')).toBe(false);
    expect(getPlayedNotes(firstSection, otherTable)[0].owner).toBe('FillPlugin');

    firstSection.getSectionNotes(targetTable).playedNotes.push(new Note({ noteName: 'G', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 7, owner: 'FillPlugin' }));
    firstSection.getSectionNotes(targetTable).playedNotes.push(new Note({ noteName: 'G', styleNum: Note.STYLENUM_TINY, row: 0, col: 7, owner: 'FillPlugin' }));
    secondSection.getSectionNotes(targetTable).playedNotes.push(new Note({ noteName: 'A', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 9, owner: 'FillPlugin' }));
    secondSection.getSectionNotes(targetTable).playedNotes.push(new Note({ noteName: 'A', styleNum: Note.STYLENUM_TINY, row: 0, col: 9, owner: 'FillPlugin' }));

    expect(plugin.clearSong(song).result).toBe('Fill cleared all sections');
    expect(getPlayedNotes(firstSection, targetTable).every((note) => note.owner !== 'FillPlugin')).toBe(true);
    expect(getPlayedNotes(secondSection, targetTable).every((note) => note.owner !== 'FillPlugin')).toBe(true);
    expect(getPlayedNotes(firstSection, otherTable)[0].owner).toBe('FillPlugin');
  });

  test('scale keep is no longer offered and legacy scale keep normalizes to role', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    const optionsNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'options');
    const scaleNode = optionsNode.children.find((child) => child.name === 'scale');

    expect(scaleNode.children.map((child) => child.name)).toEqual(['scale:none', 'scale:roleMenu']);

    plugin.setPropertyValue('scaleMode', 'keep', { song });
    expect(plugin.getProperty('scaleMode').getValue()).toBe('role');
  });

  test('root none suppresses lower-priority notes at root positions while chord keep preserves scale notes', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('rootMode', 'none', { song });
    plugin.setPropertyValue('chordMode', 'keep', { song });
    plugin.setPropertyValue('scaleMode', 'role', { song });

    plugin.applyToCurrentSection(song);

    const noteByCell = Object.fromEntries(getPlayedNotes(section, targetTable).map((note) => [`${note.row}:${note.col}`, note]));
    expect(noteByCell['0:0']).toBeUndefined();
    expect(noteByCell['0:2'].colorClass).toBe('noteScale');
    expect(noteByCell['0:4'].colorClass).toBe('noteScale');
  });

  test('tiny notes mirror emitted FillPlugin SingleNotes only', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('rootMode', 'role', { song });
    plugin.setPropertyValue('chordMode', 'none', { song });
    plugin.setPropertyValue('scaleMode', 'none', { song });
    plugin.setPropertyValue('tinyNotes', 'noteLead', { song });

    const result = plugin.applyToCurrentSection(song);
    const playedNotes = getPlayedNotes(section, targetTable);
    const singleNotes = playedNotes.filter((note) => note.styleNum === Note.STYLENUM_SINGLE);
    const tinyNotes = playedNotes.filter((note) => note.styleNum === Note.STYLENUM_TINY);

    expect(result.result).toBe('Fill applied: added 1, tiny 1, skipped 0');
    expect(singleNotes).toHaveLength(1);
    expect(tinyNotes).toHaveLength(1);
    expect(tinyNotes[0].row).toBe(singleNotes[0].row);
    expect(tinyNotes[0].col).toBe(singleNotes[0].col);
    expect(tinyNotes[0].colorClass).toBe('noteLead');
  });
});