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

function getSectionNotes(section, tableID) {
  return section.getSectionNotes(tableID);
}

function getPlayedNotes(section, tableID) {
  return getSectionNotes(section, tableID).playedNotes;
}

function getNamedNotes(section, tableID) {
  return getSectionNotes(section, tableID).namedNotes;
}

function getPlayedNotesByStyle(section, tableID, styleNum) {
  return getPlayedNotes(section, tableID).filter((note) => note.styleNum === styleNum);
}

function setFamilyMode(plugin, familyName, roleName, modeValue, song) {
  plugin.setPropertyValue(`${familyName}${roleName.charAt(0).toUpperCase()}${roleName.slice(1)}Mode`, modeValue, { song });
}

function setAllFamilyModes(plugin, familyName, modeValue, song) {
  ['root', 'chord', 'scale'].forEach((roleName) => {
    setFamilyMode(plugin, familyName, roleName, modeValue, song);
  });
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
      myTunings: [createPrimaryTuning({ baseID: 'P46_1' })],
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

  
  test('use chart submenu exposes chord and mode actions with c and m triggers', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    const optionsNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'options');
    const useChartNode = optionsNode.children.find((child) => child.name === 'useChart');

    expect(useChartNode.children.map((child) => child.trigger)).toEqual(['c', 'm']);
    expect(useChartNode.children.map((child) => child.actionName)).toEqual(['useChartChord', 'useChartMode']);
    const automaticNode = optionsNode.children.find((child) => child.name === 'automaticFromChart');
    expect(automaticNode.trigger).toBe('a');
  });

  test('positions submenu includes Import from arpeggio action', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    const optionsNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'options');
    const positionsNode = optionsNode.children.find((child) => child.name === 'positions');
    expect(positionsNode.children.map((child) => child.name)).toContain('positions:importFromArpeggio');
  });

  test('automatic from chart maps payload section chart values before section-begin fill', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const firstSection = makeSection({ [targetTable]: {} });
    const secondSection = makeSection({ [targetTable]: {} });
    firstSection.chartChord = 'Am';
    firstSection.chartMode = 'A minor';
    secondSection.chartChord = 'Cmaj7';
    secondSection.chartMode = 'C major';

    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [firstSection, secondSection],
      currentSectionIndex: 0
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('automaticFromChart', true, { song });
    setAllFamilyModes(plugin, 'named', 'none', song);
    setAllFamilyModes(plugin, 'tiny', 'none', song);
    plugin.setPropertyValue('singleChordMode', 'none', { song });
    plugin.setPropertyValue('singleScaleMode', 'none', { song });

    const result = plugin.handleEvent('DaCapo:OnSectionBegin', { sectionIndex: 1 }, { song });

    expect(result.result).toBe('Fill applied: named 0, single 1, tiny 0, overlay 0, kept 0');
    expect(plugin.getProperty('chordFormula').getValue()).toBe('maj7');
    expect(plugin.getProperty('scaleFormula').getValue()).toBe('major');
    expect(getPlayedNotesByStyle(secondSection, targetTable, Note.STYLENUM_SINGLE)).toHaveLength(1);
  });

  test('automatic from chart clears formulas to none when payload section chart values are empty', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const firstSection = makeSection({ [targetTable]: {} });
    const secondSection = makeSection({ [targetTable]: {} });
    firstSection.chartChord = 'Cmaj7';
    firstSection.chartMode = 'A harmonic minor';
    secondSection.chartChord = '';
    secondSection.chartMode = '';

    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [firstSection, secondSection],
      currentSectionIndex: 0
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('automaticFromChart', true, { song });
    setAllFamilyModes(plugin, 'named', 'none', song);
    setAllFamilyModes(plugin, 'tiny', 'none', song);
    plugin.setPropertyValue('singleChordMode', 'none', { song });
    plugin.setPropertyValue('singleScaleMode', 'none', { song });

    plugin.handleEvent('DaCapo:OnSectionBegin', { sectionIndex: 0 }, { song });
    expect(plugin.getProperty('chordFormula').getValue()).toBe('maj7');
    expect(plugin.getProperty('scaleFormula').getValue()).toBe('harmonic minor');

    plugin.handleEvent('DaCapo:OnSectionBegin', { sectionIndex: 1 }, { song });
    expect(plugin.getProperty('chordFormula').getValue()).toBe('');
    expect(plugin.getProperty('scaleFormula').getValue()).toBe('');
  });

  test('section-begin fill keeps formulas unchanged when automatic from chart is off', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const firstSection = makeSection({ [targetTable]: {} });
    const secondSection = makeSection({ [targetTable]: {} });
    secondSection.chartChord = 'Cmaj7';
    secondSection.chartMode = 'C major';

    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [firstSection, secondSection],
      currentSectionIndex: 0
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('chordFormula', 'm', { song });
    plugin.setPropertyValue('scaleFormula', 'minor', { song });
    setAllFamilyModes(plugin, 'named', 'none', song);
    setAllFamilyModes(plugin, 'tiny', 'none', song);
    plugin.setPropertyValue('singleChordMode', 'none', { song });
    plugin.setPropertyValue('singleScaleMode', 'none', { song });

    plugin.handleEvent('DaCapo:OnSectionBegin', { sectionIndex: 1 }, { song });

    expect(plugin.getProperty('chordFormula').getValue()).toBe('m');
    expect(plugin.getProperty('scaleFormula').getValue()).toBe('minor');
  });

  test('useChartChord adopts direct chart matches and slash-chord aliases', () => {
    const section = makeSection();
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    section.chartChord = 'Cmaj7';
    let result = plugin.invokeAction('useChartChord', { song });
    expect(result.result).toBe('chartChord -> maj7');
    expect(plugin.getProperty('chordFormula').getValue()).toBe('maj7');

    section.chartChord = 'G7';
    result = plugin.invokeAction('useChartChord', { song });
    expect(result.result).toBe('chartChord -> 7 (dom7)');
    expect(plugin.getProperty('chordFormula').getValue()).toBe('7');

    section.chartChord = 'Cm';
    result = plugin.invokeAction('useChartChord', { song });
    expect(result.result).toBe('chartChord -> m');
    expect(plugin.getProperty('chordFormula').getValue()).toBe('m');

    section.chartChord = 'FMadd9/A';
    result = plugin.invokeAction('useChartChord', { song });
    expect(result.result).toBe('chartChord -> 6add9');
    expect(plugin.getProperty('chordFormula').getValue()).toBe('6add9');
  });

  test('useChartMode adopts tonic-stripped chart modes', () => {
    const section = makeSection();
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    section.chartMode = 'C major';
    let result = plugin.invokeAction('useChartMode', { song });
    expect(result.result).toBe('chartMode -> major (ionian)');
    expect(plugin.getProperty('scaleFormula').getValue()).toBe('major');

    section.chartMode = 'A minor';
    result = plugin.invokeAction('useChartMode', { song });
    expect(result.result).toBe('chartMode -> minor (aeolian/natural)');
    expect(plugin.getProperty('scaleFormula').getValue()).toBe('minor');
  });

  test('use chart misses keep existing selection and return short result plus full message', () => {
    const section = makeSection();
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    section.chartChord = 'Amb6b9';
    let result = plugin.invokeAction('useChartChord', { song });
    expect(result.result).toBe('No fill subset match for chartChord="Amb6b9" tonalType="mb6b9"');
    expect(result.message).toBe('Fill use chart chord: no match for chartChord="Amb6b9" normalized="mb6b9" against [M, m, aug, dim, dim7, m7b5, sus2, sus4, maj7, s m7, 7 (dom7), 7no5, m/ma7, m9, 6add9, none]');
    expect(plugin.getProperty('chordFormula').getValue()).toBe('M');

    section.chartMode = 'A ultralocrian';
    result = plugin.invokeAction('useChartMode', { song });
    expect(result.result).toBe('No fill subset match for chartMode="A ultralocrian" tonalType="ultralocrian"');
    expect(result.message).toBe('Fill use chart mode: no match for chartMode="A ultralocrian" normalized="ultralocrian" against [major (ionian), dorian, phrygian, lydian, mixolydian, minor (aeolian/natural), locrian, whole tone, diminished, minor pentatonic, major Pentatonic, harmonic minor, melodic minor, Lydian dominant, double harmonic major (Gypsy), Neapolitan major, balinese (neapolitan minor), chromatic, (none)]');
    expect(plugin.getProperty('scaleFormula').getValue()).toBe('major');
  });

  test('empty chart values return no-op results without messages', () => {
    const section = makeSection();
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    expect(plugin.invokeAction('useChartChord', { song })).toEqual({ result: 'No chartChord' });
    expect(plugin.invokeAction('useChartMode', { song })).toEqual({ result: 'No chartMode' });
    expect(plugin.getProperty('chordFormula').getValue()).toBe('M');
    expect(plugin.getProperty('scaleFormula').getValue()).toBe('major');
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

  test('switching target instrument resets string limits to the new instrument full range', () => {
    const song = makeSong({
      myTunings: [
        createPrimaryTuning({ baseID: 'P1', rowRange: [48] }),
        createPrimaryTuning({ baseID: 'P46_1', rowRange: [64, 59, 55, 50, 45, 40] })
      ],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    plugin.setPropertyValue('targetTable', `${Constants.TABLE_ID_PREFIX}P46_1`, { song });
    plugin.setPropertyValue('minRow', 2, { song });
    plugin.setPropertyValue('maxRow', 3, { song });
    expect(plugin.resolveValue('minRow', { song })).toBe(2);
    expect(plugin.resolveValue('maxRow', { song })).toBe(3);

    plugin.setPropertyValue('targetTable', `${Constants.TABLE_ID_PREFIX}P1`, { song });
    expect(plugin.resolveValue('minRow', { song })).toBe(1);
    expect(plugin.resolveValue('maxRow', { song })).toBe(1);

    plugin.setPropertyValue('targetTable', `${Constants.TABLE_ID_PREFIX}P46_1`, { song });

    expect(plugin.getProperty('minRow').getValue()).toBe(0);
    expect(plugin.getProperty('maxRow').getValue()).toBe(5);
    expect(plugin.resolveValue('minRow', { song })).toBe(1);
    expect(plugin.resolveValue('maxRow', { song })).toBe(6);
  });

  test('family role displays default to canonical colors while standalone tiny defaults to none', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    expect(plugin.resolveValue('namedRootDisplay', { song })).toBe('noteRoot');
    expect(plugin.resolveValue('singleChordDisplay', { song })).toBe('noteChord');
    expect(plugin.resolveValue('tinyScaleDisplay', { song })).toBe('none');
    expect(plugin.resolveValue('singleAddTiny', { song })).toBe('none');
    expect(plugin.resolveValue('namedSummary', { song })).toBe('r:noteRoot,c:noteChord,s:noteScale');
    expect(plugin.resolveValue('tinySummary', { song })).toBe('r:none,c:none,s:none');
  });

  test('family role menu captions use ${plugin:...} value references', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    const optionsNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'options');
    const namedNode = optionsNode.children.find((child) => child.name === 'named');
    const namedScaleNode = namedNode.children.find((child) => child.name === 'named:scale');
    const namedScaleRoleNode = namedScaleNode.children.find((child) => child.name === 'named:scale:roleMenu');

    expect(namedScaleNode.caption).toContain('[${plugin:fill:namedScaleDisplay}]');
    expect(namedScaleRoleNode.caption).toContain('[${plugin:fill:namedScaleColor}]');
  });

  test('copy from SingleNote copies role modes and colors once for named and tiny', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('singleRootMode', 'keep', { song });
    plugin.setPropertyValue('singleRootColor', 'noteLead2', { song });
    plugin.setPropertyValue('singleChordMode', 'none', { song });
    plugin.setPropertyValue('singleChordColor', 'noteTransparent', { song });
    plugin.setPropertyValue('singleScaleMode', 'role', { song });
    plugin.setPropertyValue('singleScaleColor', 'noteLead', { song });

    expect(plugin.invokeAction('copyFamilyFromSingle:named', { song }).result).toBe('named copied from SingleNote');
    expect(plugin.invokeAction('copyFamilyFromSingle:tiny', { song }).result).toBe('tiny copied from SingleNote');

    expect(plugin.getProperty('namedRootMode').getValue()).toBe('keep');
    expect(plugin.getProperty('namedRootColor').getValue()).toBe('noteLead2');
    expect(plugin.getProperty('tinyChordMode').getValue()).toBe('none');
    expect(plugin.getProperty('tinyScaleColor').getValue()).toBe('noteLead');

    plugin.setPropertyValue('singleRootColor', 'noteRoot', { song });

    expect(plugin.getProperty('namedRootColor').getValue()).toBe('noteLead2');
    expect(plugin.getProperty('tinyRootColor').getValue()).toBe('noteLead2');
  });

  test('all role note and all none bulk actions update a family consistently', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('singleRootColor', 'noteLead2', { song });
    plugin.setPropertyValue('singleChordColor', 'noteTransparent', { song });
    plugin.setPropertyValue('singleScaleColor', 'noteLead', { song });

    expect(plugin.invokeAction('allRoleNote:single', { song }).result).toBe('single set to all role note');
    expect(plugin.resolveValue('singleSummary', { song })).toBe('r:noteRoot,c:noteChord,s:noteScale');

    expect(plugin.invokeAction('allNone:single', { song }).result).toBe('single set to all none');
    expect(plugin.resolveValue('singleSummary', { song })).toBe('r:none,c:none,s:none');
    expect(plugin.getProperty('singleRootColor').getValue()).toBe('noteRoot');
    expect(plugin.getProperty('singleChordColor').getValue()).toBe('noteChord');
    expect(plugin.getProperty('singleScaleColor').getValue()).toBe('noteScale');
  });

  test('loadSongState maps the legacy single-family fields onto sprint-2 SingleNote properties', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.loadSongState({
      targetTable: `${Constants.TABLE_ID_PREFIX}P1`,
      rootMode: 'keep',
      rootColor: 'noteLead2',
      chordMode: 'none',
      chordColor: 'noteTransparent',
      scaleMode: 'role',
      scaleColor: 'noteLead',
      tinyNotes: 'noteLead2'
    }, { song });

    expect(plugin.getProperty('singleRootMode').getValue()).toBe('keep');
    expect(plugin.getProperty('singleRootColor').getValue()).toBe('noteLead2');
    expect(plugin.getProperty('singleChordMode').getValue()).toBe('none');
    expect(plugin.getProperty('singleScaleColor').getValue()).toBe('noteLead');
    expect(plugin.getProperty('singleAddTiny').getValue()).toBe('noteLead2');
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
      chordFormula: 'M',
      scaleFormula: 'major',
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

  test('help and summary describe the sprint-2 family model', () => {
    const song = makeSong({
      myTunings: [createPrimaryTuning({ baseID: 'P46_1', rowRange: [64, 59, 55, 50, 45, 40] })],
      sections: [makeSection()]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });

    const help = plugin.buildHelpMessage(song);

    expect(plugin.buildSummary(song)).toContain('target table=P46_1');
    expect(plugin.buildSummary(song)).toContain('chord=M');
    expect(plugin.buildSummary(song)).toContain('mode=major (ionian)');
    expect(plugin.buildSummary(song)).toContain('named=root=noteRoot chord=noteChord scale=noteScale');
    expect(plugin.buildSummary(song)).toContain('single=root=noteRoot chord=noteChord scale=noteScale');
    expect(plugin.buildSummary(song)).toContain('tiny=root=none chord=none scale=none');
    expect(help).toContain('NamedNote, SingleNote, and TinyNote fill.');
    expect(help).toContain('- chord = M');
    expect(help).toContain('- mode = major (ionian)');
    expect(help).toContain('NamedNote ignores fret and string limits.');
    expect(help).toContain('Standalone TinyNote suppresses SingleNote add TinyNote');
    expect(help).toContain('DaCapo:OnSectionBegin');
  });

  test('apply can emit NamedNotes, SingleNotes, and overlay TinyNotes together', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('maxFret', 4, { song });
    plugin.setPropertyValue('singleAddTiny', 'noteLead', { song });
    setAllFamilyModes(plugin, 'tiny', 'none', song);

    const result = plugin.applyToCurrentSection(song);
    const namedNotes = getNamedNotes(section, targetTable);
    const singleNotes = getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_SINGLE);
    const tinyNotes = getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_TINY);

    expect(result.result).toBe('Fill applied: named 7, single 3, tiny 0, overlay 3, kept 0');
    expect(Object.keys(namedNotes).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(namedNotes.C.colorClass).toBe('noteRoot');
    expect(singleNotes.map((note) => `${note.noteName}:${note.colorClass}`)).toEqual([
      'C:noteRoot',
      'D:noteScale',
      'E:noteChord'
    ]);
    expect(tinyNotes).toHaveLength(3);
    expect(tinyNotes.every((note) => note.colorClass === 'noteLead')).toBe(true);
  });

  test('NamedNote ignores fret and string limits while SingleNote still obeys them', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('minFret', 1, { song });
    plugin.setPropertyValue('maxFret', 3, { song });
    setAllFamilyModes(plugin, 'tiny', 'none', song);

    plugin.applyToCurrentSection(song);

    expect(Object.keys(getNamedNotes(section, targetTable)).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_SINGLE).map((note) => note.noteName)).toEqual(['D']);
  });

  test('standalone TinyNote can emit with no SingleNote present and marks add TinyNote disabled', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    setAllFamilyModes(plugin, 'single', 'none', song);
    setAllFamilyModes(plugin, 'named', 'none', song);
    setAllFamilyModes(plugin, 'tiny', 'none', song);
    plugin.setPropertyValue('tinyRootMode', 'role', { song });
    plugin.setPropertyValue('singleAddTiny', 'noteLead', { song });

    const result = plugin.applyToCurrentSection(song);
    const tinyNotes = getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_TINY);

    expect(result.result).toBe('Fill applied: named 0, single 0, tiny 1, overlay 0, kept 0');
    expect(getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_SINGLE)).toHaveLength(0);
    expect(tinyNotes).toHaveLength(1);
    expect(tinyNotes[0].colorClass).toBe('noteRoot');
    expect(plugin.resolveValue('singleAddTiny', { song })).toBe('noteLead [disabled]');
  });

  test('standalone TinyNote suppresses SingleNote add TinyNote output entirely', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning()],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    setAllFamilyModes(plugin, 'named', 'none', song);
    setAllFamilyModes(plugin, 'tiny', 'none', song);
    plugin.setPropertyValue('singleAddTiny', 'noteLead', { song });
    plugin.setPropertyValue('tinyRootMode', 'role', { song });

    plugin.applyToCurrentSection(song);

    const tinyNotes = getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_TINY);
    expect(tinyNotes).toHaveLength(1);
    expect(tinyNotes[0].colorClass).toBe('noteRoot');
  });

  test('family keep semantics preserve existing notes in their own lanes', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({
      [targetTable]: {
        namedNotes: {
          C: new Note({ noteName: 'C', colorClass: 'noteBlack' })
        },
        playedNotes: [
          new Note({ noteName: 'C', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 0, colorClass: 'noteBlack' }),
          new Note({ noteName: 'C', styleNum: Note.STYLENUM_TINY, row: 0, col: 0, colorClass: 'noteBlack' })
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
    setAllFamilyModes(plugin, 'named', 'none', song);
    setAllFamilyModes(plugin, 'single', 'none', song);
    setAllFamilyModes(plugin, 'tiny', 'none', song);
    plugin.setPropertyValue('namedRootMode', 'keep', { song });
    plugin.setPropertyValue('singleRootMode', 'keep', { song });
    plugin.setPropertyValue('tinyRootMode', 'keep', { song });

    const result = plugin.applyToCurrentSection(song);

    expect(result.result).toBe('Fill applied: named 0, single 0, tiny 0, overlay 0, kept 3');
    expect(getNamedNotes(section, targetTable).C.colorClass).toBe('noteBlack');
    expect(getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_SINGLE)[0].colorClass).toBe('noteBlack');
    expect(getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_TINY)[0].colorClass).toBe('noteBlack');
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
    setAllFamilyModes(plugin, 'named', 'none', song);
    setAllFamilyModes(plugin, 'tiny', 'none', song);
    plugin.setPropertyValue('singleChordMode', 'none', { song });
    plugin.setPropertyValue('singleScaleMode', 'none', { song });

    const beforeOptions = {
      targetTable: plugin.getProperty('targetTable').getValue(),
      minFret: plugin.getProperty('minFret').getValue(),
      maxFret: plugin.getProperty('maxFret').getValue(),
      minRow: plugin.getProperty('minRow').getValue(),
      maxRow: plugin.getProperty('maxRow').getValue()
    };

    const result = plugin.handleEvent('DaCapo:OnSectionBegin', { sectionIndex: 1 }, { song });

    expect(result.result).toBe('Fill applied: named 0, single 1, tiny 0, overlay 0, kept 0');
    expect(getPlayedNotes(firstSection, targetTable)).toHaveLength(0);
    expect(getPlayedNotesByStyle(secondSection, targetTable, Note.STYLENUM_SINGLE)).toHaveLength(1);
    expect(plugin.getProperty('targetTable').getValue()).toBe(beforeOptions.targetTable);
    expect(plugin.getProperty('minFret').getValue()).toBe(beforeOptions.minFret);
    expect(plugin.getProperty('maxFret').getValue()).toBe(beforeOptions.maxFret);
    expect(plugin.getProperty('minRow').getValue()).toBe(beforeOptions.minRow);
    expect(plugin.getProperty('maxRow').getValue()).toBe(beforeOptions.maxRow);
  });

  test('positions actions set, copy, and clear section position arrays', () => {
    const firstSection = makeSection();
    const secondSection = makeSection();
    const song = makeSong({
      myTunings: [createPrimaryTuning({ baseID: 'P1', frets: 12, rowRange: [48] })],
      sections: [firstSection, secondSection],
      currentSectionIndex: 0
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', `${Constants.TABLE_ID_PREFIX}P1`, { song });

    expect(plugin.invokeAction('positions:setCurrentSection', { song, args: { value: '[[0,2],[3,5]]' } }).result).toBe('positions=[[0,2],[3,5]]');
    expect(firstSection.pluginData?.fill?.positions).toEqual([[0, 2], [3, 5]]);
    expect(plugin.invokeAction('positions:copyToUnsetSections', { song }).result).toBe('positions copied to 1 unset sections');
    expect(secondSection.pluginData?.fill?.positions).toEqual([[0, 2], [3, 5]]);

    expect(plugin.invokeAction('positions:clearCurrentSection', { song }).result).toBe('positions cleared for current section');
    expect(firstSection.pluginData?.fill?.positions).toBeUndefined();
    expect(secondSection.pluginData?.fill?.positions).toEqual([[0, 2], [3, 5]]);

    expect(plugin.invokeAction('positions:clearAllSections', { song }).result).toBe('positions cleared across 1 sections');
    expect(secondSection.pluginData?.fill?.positions).toBeUndefined();
  });

  test('section positions override global min/max fret for apply', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning({ baseID: 'P1', frets: 12, rowRange: [48] })],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    setAllFamilyModes(plugin, 'named', 'none', song);
    setAllFamilyModes(plugin, 'tiny', 'none', song);
    plugin.setPropertyValue('singleChordMode', 'none', { song });
    plugin.setPropertyValue('singleScaleMode', 'none', { song });
    plugin.setPropertyValue('minFret', 0, { song });
    plugin.setPropertyValue('maxFret', 12, { song });

    plugin.invokeAction('positions:setCurrentSection', { song, args: { value: '[[3,5]]' } });
    plugin.applyToCurrentSection(song);
    expect(getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_SINGLE)).toHaveLength(0);

    plugin.invokeAction('positions:setCurrentSection', { song, args: { value: '[[0,0]]' } });
    plugin.applyToCurrentSection(song);
    expect(getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_SINGLE)).toHaveLength(1);
  });

  test('song loops per position rotates current section position windows', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning({ baseID: 'P1', frets: 12, rowRange: [48] })],
      sections: [section]
    });
    mockRuntime.song = song;

    const plugin = new FillPlugin();
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    setAllFamilyModes(plugin, 'named', 'none', song);
    setAllFamilyModes(plugin, 'tiny', 'none', song);
    plugin.setPropertyValue('singleChordMode', 'none', { song });
    plugin.setPropertyValue('singleScaleMode', 'none', { song });
    plugin.setPropertyValue('songLoopsPerPositionPair', 2, { song });
    plugin.invokeAction('positions:setCurrentSection', { song, args: { value: '[[0,0],[1,1]]' } });

    plugin.applyToCurrentSection(song);
    expect(getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_SINGLE)).toHaveLength(1);

    plugin.handleEvent('DaCapo:OnSongEnd', {}, { song });
    plugin.applyToCurrentSection(song);
    expect(getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_SINGLE)).toHaveLength(1);

    plugin.handleEvent('DaCapo:OnSongEnd', {}, { song });
    plugin.applyToCurrentSection(song);
    expect(getPlayedNotesByStyle(section, targetTable, Note.STYLENUM_SINGLE)).toHaveLength(0);
  });

  test('import from arpeggio applies payload and clears positions when source positions is empty', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning({ baseID: 'P1', frets: 12, rowRange: [48] })],
      sections: [section]
    });
    mockRuntime.song = song;

    const getPluginMenuOptions = jest.fn(() => ({
      status: 'ok',
      pluginId: 'arpeggio',
      menuPath: 'p',
      payload: {
        minFret: 2,
        maxFret: 6,
        songLoopsPerPositionPair: 3,
        positions: []
      }
    }));

    const plugin = new FillPlugin();
    plugin.setManager({ song, getPluginMenuOptions });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.invokeAction('positions:setCurrentSection', { song, args: { value: '[[0,2]]' } });

    const result = plugin.invokeAction('positions:importFromArpeggio', { song });

    expect(result.result).toContain('Fill imported from arpeggio');
    expect(getPluginMenuOptions).toHaveBeenCalledWith('arpeggio/p');
    expect(plugin.getProperty('minFret').getValue()).toBe(2);
    expect(plugin.getProperty('maxFret').getValue()).toBe(6);
    expect(plugin.getSongLoopsPerPositionPair()).toBe(3);
    expect(section.pluginData?.fill?.positions).toBeUndefined();
  });

  test('import from arpeggio rejects malformed payload without partial updates', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const section = makeSection({ [targetTable]: {} });
    const song = makeSong({
      myTunings: [createPrimaryTuning({ baseID: 'P1', frets: 12, rowRange: [48] })],
      sections: [section]
    });
    mockRuntime.song = song;

    const getPluginMenuOptions = jest.fn(() => ({
      status: 'ok',
      pluginId: 'arpeggio',
      menuPath: 'p',
      payload: {
        minFret: 4,
        maxFret: 8,
        songLoopsPerPositionPair: 'oops',
        positions: [[0, 2]]
      }
    }));

    const plugin = new FillPlugin();
    plugin.setManager({ song, getPluginMenuOptions });
    plugin.setPropertyValue('targetTable', targetTable, { song });
    plugin.setPropertyValue('minFret', 0, { song });
    plugin.setPropertyValue('maxFret', 4, { song });

    const result = plugin.invokeAction('positions:importFromArpeggio', { song });

    expect(result.result).toBe('positions import failed');
    expect(result.message).toContain('songLoopsPerPositionPair');
    expect(plugin.getProperty('minFret').getValue()).toBe(0);
    expect(plugin.getProperty('maxFret').getValue()).toBe(4);
  });

  test('clear current section, clear song, and commit notes affect owned named, single, and tiny notes only in the selected table', () => {
    const targetTable = `${Constants.TABLE_ID_PREFIX}P1`;
    const otherTable = `${Constants.TABLE_ID_PREFIX}ALT`;
    const firstSection = makeSection({
      [targetTable]: {
        namedNotes: {
          C: new Note({ noteName: 'C', colorClass: 'noteRoot', owner: 'FillPlugin' }),
          D: new Note({ noteName: 'D', colorClass: 'noteBlack' })
        },
        playedNotes: [
          new Note({ noteName: 'C', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 0, owner: 'FillPlugin' }),
          new Note({ noteName: 'C', styleNum: Note.STYLENUM_TINY, row: 0, col: 0, owner: 'FillPlugin' }),
          new Note({ noteName: 'D', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 2 })
        ]
      },
      [otherTable]: {
        namedNotes: {
          E: new Note({ noteName: 'E', colorClass: 'noteRoot', owner: 'FillPlugin' })
        },
        playedNotes: [
          new Note({ noteName: 'E', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 4, owner: 'FillPlugin' })
        ]
      }
    });
    const secondSection = makeSection({
      [targetTable]: {
        namedNotes: {
          F: new Note({ noteName: 'F', colorClass: 'noteRoot', owner: 'FillPlugin' })
        },
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
    plugin.setManager({ song });
    plugin.setPropertyValue('targetTable', targetTable, { song });

    expect(plugin.clearCurrentSection(song).result).toBe('Fill cleared current section');
    expect(Object.keys(getNamedNotes(firstSection, targetTable)).sort()).toEqual(['D']);
    expect(getPlayedNotes(firstSection, targetTable).map((note) => note.noteName)).toEqual(['D']);
    expect(Object.keys(getNamedNotes(secondSection, targetTable)).sort()).toEqual(['F']);
    expect(getPlayedNotes(secondSection, targetTable).map((note) => note.noteName)).toEqual(['F', 'F']);
    expect(Object.keys(getNamedNotes(firstSection, otherTable)).sort()).toEqual(['E']);

    getNamedNotes(firstSection, targetTable).C = new Note({ noteName: 'C', colorClass: 'noteRoot', owner: 'FillPlugin' });
    getPlayedNotes(firstSection, targetTable).push(new Note({ noteName: 'C', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 0, owner: 'FillPlugin' }));
    getPlayedNotes(firstSection, targetTable).push(new Note({ noteName: 'C', styleNum: Note.STYLENUM_TINY, row: 0, col: 0, owner: 'FillPlugin' }));

    expect(plugin.commitNotes(song).result).toBe('Fill committed generated notes');
    expect(Object.values(getNamedNotes(firstSection, targetTable)).some((note) => note.owner === 'FillPlugin')).toBe(false);
    expect(getPlayedNotes(firstSection, targetTable).some((note) => note.owner === 'FillPlugin')).toBe(false);
    expect(Object.values(getNamedNotes(secondSection, targetTable)).some((note) => note.owner === 'FillPlugin')).toBe(false);
    expect(getPlayedNotes(secondSection, targetTable).some((note) => note.owner === 'FillPlugin')).toBe(false);
    expect(getPlayedNotes(firstSection, otherTable)[0].owner).toBe('FillPlugin');

    getNamedNotes(firstSection, targetTable).G = new Note({ noteName: 'G', colorClass: 'noteRoot', owner: 'FillPlugin' });
    getPlayedNotes(firstSection, targetTable).push(new Note({ noteName: 'G', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 7, owner: 'FillPlugin' }));
    getPlayedNotes(firstSection, targetTable).push(new Note({ noteName: 'G', styleNum: Note.STYLENUM_TINY, row: 0, col: 7, owner: 'FillPlugin' }));
    getNamedNotes(secondSection, targetTable).A = new Note({ noteName: 'A', colorClass: 'noteRoot', owner: 'FillPlugin' });
    getPlayedNotes(secondSection, targetTable).push(new Note({ noteName: 'A', styleNum: Note.STYLENUM_SINGLE, row: 0, col: 9, owner: 'FillPlugin' }));
    getPlayedNotes(secondSection, targetTable).push(new Note({ noteName: 'A', styleNum: Note.STYLENUM_TINY, row: 0, col: 9, owner: 'FillPlugin' }));

    expect(plugin.clearSong(song).result).toBe('Fill cleared all sections');
    expect(Object.values(getNamedNotes(firstSection, targetTable)).every((note) => note.owner !== 'FillPlugin')).toBe(true);
    expect(getPlayedNotes(firstSection, targetTable).every((note) => note.owner !== 'FillPlugin')).toBe(true);
    expect(Object.values(getNamedNotes(secondSection, targetTable)).every((note) => note.owner !== 'FillPlugin')).toBe(true);
    expect(getPlayedNotes(secondSection, targetTable).every((note) => note.owner !== 'FillPlugin')).toBe(true);
    expect(getPlayedNotes(firstSection, otherTable)[0].owner).toBe('FillPlugin');
  });
});