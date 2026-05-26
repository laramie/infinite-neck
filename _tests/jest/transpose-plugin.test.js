import { jest } from '@jest/globals';

const Constants = await import('../../Constants.js');

const mockRuntime = {
  song: null
};

const mockTransposeSong = jest.fn();

jest.unstable_mockModule('../../infinite-neck.js', () => ({
  getSong: () => mockRuntime.song,
  transposeSong: mockTransposeSong
}));

const { TransposePlugin } = await import('../../plugins/transpose/TransposePlugin.js');

function makeSection(rootID, sharps = false) {
  return {
    rootID,
    sharps,
    sectionNotesByTable: {},
    getSectionNotes(tableID) {
      if (!this.sectionNotesByTable[tableID]) {
        this.sectionNotesByTable[tableID] = { playedNotes: [], namedNotes: {}, recordedNotes: {} };
      }
      return this.sectionNotesByTable[tableID];
    }
  };
}

function makeCaptionSection(rootID, rootIDLead = '-1', sharps = false) {
  return {
    rootID,
    rootIDLead,
    sharps,
    noteIDToDisplayName(noteIndex) {
      return Constants.noteIDToNoteNameRaw(((Number.parseInt(noteIndex, 10) || 0) % 12 + 12) % 12);
    },
    getRootKey() {
      return this.noteIDToDisplayName(this.rootID);
    },
    getRootKeyLead() {
      if (`${this.rootIDLead}` === '-1') {
        return this.getRootKey();
      }
      return this.noteIDToDisplayName(this.rootIDLead);
    }
  };
}

function makeSong({ sections, currentSectionIndex = 0, isHeadless = true } = {}) {
  return {
    sections,
    isHeadless,
    sharps: false,
    myTunings: [],
    getCurrentSection() {
      return this.sections[currentSectionIndex];
    },
    requestUiFullRepaint: jest.fn()
  };
}

describe('TransposePlugin', () => {
  beforeEach(() => {
    mockTransposeSong.mockReset();
  });

  test('help includes summary formatting and handled events', () => {
    const plugin = new TransposePlugin();
    const help = plugin.buildHelpMessage();

    expect(plugin.buildSummary()).toContain('current interval=0');
    expect(plugin.buildSummary()).toContain('sequence offset=0');
    expect(plugin.buildSummary()).toContain('original offset=0');
    expect(plugin.buildSummary()).toContain('auto sharps/flats=false');
    expect(plugin.buildSummary()).toContain('do lead key=false');
    expect(help).toContain('Events handled:');
    expect(help).toContain('DaCapo:OnSongEnd');
    expect(help).toContain('Looper:OnResetSong');
  });

  test('Looper:OnResetSong performs soft and hard resets', () => {
    const song = makeSong({ sections: [makeSection(3)] });
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 2, 5]);
    plugin.invokeAction('apply', { song });
    plugin.invokeAction('apply', { song });
    plugin.setOriginalToCurrent(song);
    plugin.invokeAction('apply', { song });

    expect(plugin.resolveValue('currentOffset')).toBe(2);
    expect(plugin.resolveValue('originalOffset')).toBe(2);

    expect(plugin.handleEvent('Looper:OnResetSong', { hard: false }, { song }).result).toBe('reset current interval: sequence offset 0');
    expect(plugin.resolveValue('currentOffset')).toBe(0);
    expect(plugin.resolveValue('originalOffset')).toBe(0);

    expect(plugin.handleEvent('Looper:OnResetSong', { hard: true }, { song }).result).toBe('reset original: original offset 0');
    expect(plugin.resolveValue('currentOffset')).toBe(0);
    expect(plugin.resolveValue('originalOffset')).toBe(0);
  });

  test('visible menu includes reset submenu and lowercase auto sharps/flats toggle', () => {
    const plugin = new TransposePlugin();
    const children = plugin.getVisibleMenuChildren();
    const resetNode = children.find((child) => child.name === 'resetMenu');
    const autoNode = children.find((child) => child.name === 'autoSharpsFlats');
    const leadNode = children.find((child) => child.name === 'doLeadKey');
    const playedNode = children.find((child) => child.name === 'PlayedNotes');
    const recordedNode = children.find((child) => child.name === 'RecordedNotes');

    expect(children.map((child) => child.name).slice(0, 6)).toEqual(['apply', 'resetMenu', 'help', 'intervals', 'NamedNotes', 'SingleNotes']);
    expect(resetNode).toBeTruthy();
    expect(resetNode.trigger).toBe('R');
    expect(resetNode.children.map((child) => child.name)).toEqual([
      'resetOriginal',
      'resetCurrentInterval',
      'setOriginalToCurrent'
    ]);
    expect(resetNode.children.map((child) => child.trigger)).toEqual(['o', 'c', 's']);
    expect(autoNode).toBeTruthy();
    expect(autoNode.trigger).toBe('a');
    expect(leadNode).toBeTruthy();
    expect(leadNode.trigger).toBe('d');
    expect(children.find((child) => child.name === 'octaves')?.trigger).toBe('o');
    expect(playedNode).toBeUndefined();
    expect(recordedNode).toBeUndefined();
  });

  test('invalid octaves normalize to zero', () => {
    const plugin = new TransposePlugin();

    expect(plugin.setPropertyValue('octaves', 'banana')).toBe('0');
    expect(plugin.getProperty('octaves').getValue()).toBe('0');
  });

  test('single notes transpose on the same string and reset with interval changes', () => {
    const section = makeSection(3);
    const tableID = `${Constants.TABLE_ID_PREFIX}S6_1`;
    section.getSectionNotes(tableID).playedNotes = [
      { noteName: 'G', styleNum: 2, midinum: '55', row: '3', col: '5', colorClass: 'noteTransparent' }
    ];
    section.getSectionNotes(tableID).recordedNotes = {
      '1': [
        { noteName: 'A', styleNum: 2, midinum: '57', row: '2', col: '2', colorClass: 'noteTransparent' }
      ]
    };
    const song = makeSong({ sections: [section] });
    song.myTunings = [{ baseID: 'S6_1', frets: 17, rowRange: [64, 59, 55, 50, 45, 40], nut: true, reverse: false }];
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 2]);
    plugin.setPropertyValue('SingleNotes', true);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 2 (delta 2)');
    expect(section.getSectionNotes(tableID).playedNotes[0].col).toBe('7');
    expect(section.getSectionNotes(tableID).playedNotes[0].midinum).toBe('57');
    expect(section.getSectionNotes(tableID).recordedNotes['1'][0].col).toBe('4');
    expect(section.getSectionNotes(tableID).recordedNotes['1'][0].midinum).toBe('59');

    expect(plugin.invokeAction('resetCurrentInterval', { song }).result).toBe('reset current interval: sequence offset 0');
    expect(section.getSectionNotes(tableID).playedNotes[0].col).toBe('5');
    expect(section.getSectionNotes(tableID).recordedNotes['1'][0].col).toBe('2');
  });

  test('single notes wrap upward from below a banjo nut', () => {
    const section = makeSection(3);
    const tableID = `${Constants.TABLE_ID_PREFIX}Banjo_1`;
    section.getSectionNotes(tableID).playedNotes = [
      { noteName: 'F', styleNum: 2, midinum: '69', row: '4', col: '5', colorClass: 'noteTransparent' }
    ];
    const song = makeSong({ sections: [section] });
    song.myTunings = [{ baseID: 'Banjo_1', frets: 17, rowRange: [62, 57, 54, 50, 64], nut: true, banjoNut: { 4: 5 }, reverse: false }];
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, -1]);
    plugin.setPropertyValue('SingleNotes', true);

    plugin.invokeAction('apply', { song });

    expect(section.getSectionNotes(tableID).playedNotes[0].col).toBe('16');
    expect(section.getSectionNotes(tableID).playedNotes[0].midinum).toBe('80');
  });

  test('octaves=1 collision falls back to full-neck placement and rewrites octaves to 0', () => {
    const section = makeSection(3);
    const tableID = `${Constants.TABLE_ID_PREFIX}S6_1`;
    section.getSectionNotes(tableID).playedNotes = [
      { noteName: 'Db', styleNum: 2, midinum: '53', row: '4', col: '13', colorClass: 'noteTransparent' },
      { noteName: 'B', styleNum: 5, midinum: '42', row: '4', col: '2', colorClass: 'noteTransparent', bendValue: 'semitone1' }
    ];
    const song = makeSong({ sections: [section] });
    song.myTunings = [{ baseID: 'S6_1', frets: 17, rowRange: [64, 59, 55, 50, 45, 40], nut: true, reverse: false }];
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 1]);
    plugin.setPropertyValue('SingleNotes', true);
    plugin.setPropertyValue('octaves', '1');

    const response = plugin.invokeAction('apply', { song });

    expect(response.result).toBe('manual apply: interval 1 (delta 1)');
    expect(response.message).toContain('octaves reset to 0');
    expect(plugin.getProperty('octaves').getValue()).toBe('0');
    expect(section.getSectionNotes(tableID).playedNotes[0].col).toBe('14');
  });

  test('short-neck instruments preserve off-screen single notes when full-neck mode cannot wrap visibly', () => {
    const section = makeSection(3);
    const tableID = `${Constants.TABLE_ID_PREFIX}Short_1`;
    section.getSectionNotes(tableID).playedNotes = [
      { noteName: 'F#', styleNum: 2, midinum: '46', row: '0', col: '6', colorClass: 'noteTransparent' }
    ];
    const song = makeSong({ sections: [section] });
    song.myTunings = [{ baseID: 'Short_1', frets: 6, rowRange: [40], nut: true, reverse: false }];
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 2]);
    plugin.setPropertyValue('SingleNotes', true);

    plugin.invokeAction('apply', { song });

    expect(section.getSectionNotes(tableID).playedNotes[0].col).toBe('8');
    expect(section.getSectionNotes(tableID).playedNotes[0].midinum).toBe('48');
  });

  test('apply advances interval, tracks sequence offset, and reset current interval returns to zero', () => {
    const song = makeSong({ sections: [makeSection(3)] });
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 2, 5]);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 2 (delta 2)');
    expect(mockTransposeSong).toHaveBeenNthCalledWith(1, 2, {
      NamedNotes: true,
      doKeyLead: false
    });
    expect(plugin.resolveValue('currentOffset')).toBe(2);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 5 (delta 3)');
    expect(mockTransposeSong).toHaveBeenNthCalledWith(2, 3, {
      NamedNotes: true,
      doKeyLead: false
    });
    expect(plugin.resolveValue('currentOffset')).toBe(5);
    expect(plugin.resolveValue('originalOffset')).toBe(5);

    expect(plugin.invokeAction('reset', { song }).result).toBe('reset current interval: sequence offset 0');
    expect(mockTransposeSong).toHaveBeenNthCalledWith(3, -5, {
      NamedNotes: true,
      doKeyLead: false
    });
    expect(plugin.resolveValue('currentOffset')).toBe(0);
    expect(plugin.resolveValue('originalOffset')).toBe(0);
    expect(plugin.resolveValue('currentInterval')).toBe(0);
  });

  test('intervals are canonicalized to start with zero', () => {
    const plugin = new TransposePlugin();

    expect(plugin.setPropertyValue('intervals', [5, 7])).toEqual([0, 5, 7]);
    expect(plugin.setPropertyValue('intervals', '5, 7')).toEqual([0, 5, 7]);
    expect(plugin.getProperty('intervals').getValue()).toEqual([0, 5, 7]);
  });

  test('changing intervals rebases only the current sequence baseline', () => {
    const song = makeSong({ sections: [makeSection(3)] });
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 2, 5]);

    plugin.invokeAction('apply', { song });
    plugin.invokeAction('apply', { song });
    plugin.setPropertyValue('intervals', [0, 4, 7]);

    expect(plugin.resolveValue('currentOffset')).toBe(0);
    expect(plugin.resolveValue('originalOffset')).toBe(5);
    expect(plugin.resolveValue('currentInterval')).toBe(0);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 4 (delta 4)');
    expect(plugin.resolveValue('currentOffset')).toBe(4);
    expect(plugin.resolveValue('originalOffset')).toBe(9);

    expect(plugin.invokeAction('resetCurrentInterval', { song }).result).toBe('reset current interval: sequence offset 0');
    expect(plugin.resolveValue('currentOffset')).toBe(0);
    expect(plugin.resolveValue('originalOffset')).toBe(5);

    expect(plugin.invokeAction('resetOriginal', { song }).result).toBe('reset original: original offset 0');
    expect(plugin.resolveValue('currentOffset')).toBe(0);
    expect(plugin.resolveValue('originalOffset')).toBe(0);
    expect(mockTransposeSong).toHaveBeenNthCalledWith(3, 4, expect.any(Object));
    expect(mockTransposeSong).toHaveBeenNthCalledWith(4, -4, expect.any(Object));
    expect(mockTransposeSong).toHaveBeenNthCalledWith(5, -5, expect.any(Object));
  });

  test('set original to current rebases both baselines and restarts from zero', () => {
    const song = makeSong({ sections: [makeSection(3)] });
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 5, 7]);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 5 (delta 5)');
    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 7 (delta 2)');
    expect(plugin.resolveValue('currentOffset')).toBe(7);
    expect(plugin.resolveValue('originalOffset')).toBe(7);

    expect(plugin.invokeAction('setOriginalToCurrent', { song }).result).toBe('set original to current: baselines rebased');
    expect(plugin.resolveValue('currentOffset')).toBe(0);
    expect(plugin.resolveValue('originalOffset')).toBe(0);
    expect(plugin.resolveValue('currentInterval')).toBe(0);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 5 (delta 5)');
    expect(plugin.resolveValue('currentOffset')).toBe(5);
    expect(plugin.resolveValue('originalOffset')).toBe(5);
    expect(mockTransposeSong).toHaveBeenNthCalledWith(3, 5, {
      NamedNotes: true,
      doKeyLead: false
    });
  });

  test('loadSongState with persisted properties wakes the plugin at zero/original zero', () => {
    const plugin = new TransposePlugin();

    plugin.loadSongState({
      intervals: [5, 7],
      doLeadKey: true
    });

    expect(plugin.getProperty('intervals').getValue()).toEqual([0, 5, 7]);
    expect(plugin.resolveValue('currentOffset')).toBe(0);
    expect(plugin.resolveValue('originalOffset')).toBe(0);
    expect(plugin.resolveValue('currentInterval')).toBe(0);
  });

  test('approved caption values return empty strings when transpose state is not meaningful', () => {
    const song = makeSong({ sections: [makeCaptionSection(3)] });
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setManager({
      song,
      getPluginEntry: () => ({ enabled: false })
    });

    expect(plugin.getApprovedCaptionValue('transposeCurrentOffset', { song, section: song.getCurrentSection() })).toBe('');
    expect(plugin.getApprovedCaptionValue('transposeProgressionFunctionDistances', { song, section: song.getCurrentSection() })).toBe('');
    expect(plugin.getApprovedCaptionValue('transposeIntervalsStatus', { song, section: song.getCurrentSection() })).toBe('');
  });

  test('transposeIntervalsStatus shows while enabled at the zero interval', () => {
    const song = makeSong({ sections: [makeCaptionSection(3)] });
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setManager({
      song,
      getPluginEntry: () => ({ enabled: true })
    });
    plugin.setPropertyValue('intervals', [0, 2, 5]);

    expect(plugin.getApprovedCaptionValue('transposeIntervalsStatus', { song, section: song.getCurrentSection() })).toBe('<span class="transposeIntervalsStatus"><table><tr><td class="transposeCurrentAppliedInterval">0</td><td>2</td><td>5</td></tr></table></span>');
  });

  test('approved caption values expose a one-step transpose chain', () => {
    const song = makeSong({ sections: [makeCaptionSection(3)] });
    mockRuntime.song = song;
    mockTransposeSong.mockImplementation((delta) => {
      const section = song.getCurrentSection();
      section.rootID = ((Number.parseInt(section.rootID, 10) || 0) + delta + 12) % 12;
    });

    const plugin = new TransposePlugin();
    plugin.setManager({
      song,
      getPluginEntry: () => ({ enabled: true })
    });
    plugin.setPropertyValue('intervals', [0, 2]);
    plugin.invokeAction('apply', { song });

    expect(plugin.getApprovedCaptionValue('transposeCurrentInterval', { song, section: song.getCurrentSection() })).toBe('2');
    expect(plugin.getApprovedCaptionValue('transposeCurrentOffset', { song, section: song.getCurrentSection() })).toBe('2');
    expect(plugin.getApprovedCaptionValue('transposeOriginalOffset', { song, section: song.getCurrentSection() })).toBe('2');
    expect(plugin.getApprovedCaptionValue('transposeSequenceRootKey', { song, section: song.getCurrentSection() })).toBe('C');
    expect(plugin.getApprovedCaptionValue('transposeOriginalRootKey', { song, section: song.getCurrentSection() })).toBe('C');
    expect(plugin.getApprovedCaptionValue('transposeFunctionSteps', { song, section: song.getCurrentSection() })).toBe('<em class="transposeProg">II</em>');
    expect(plugin.getApprovedCaptionValue('transposeDistanceSteps', { song, section: song.getCurrentSection() })).toBe('<em class="transposeProg">2</em>');
    expect(plugin.getApprovedCaptionValue('transposeFunctionDistanceSteps', { song, section: song.getCurrentSection() })).toBe('<em class="transposeProg">II+2</em>');
    expect(plugin.getApprovedCaptionValue('transposeIntervalsStatus', { song, section: song.getCurrentSection() })).toBe('<span class="transposeIntervalsStatus"><table><tr><td>0</td><td class="transposeCurrentAppliedInterval">2</td></tr></table></span>');
    expect(plugin.getApprovedCaptionValue('transposeProgressionFunctions', { song, section: song.getCurrentSection() })).toBe('<span class="transposeProgressionFunctionDistances"><span class="transposeKey">C</span><span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeArrow">&Rang;</span></span><span class="transposeKey">D</span></span>');
    expect(plugin.getApprovedCaptionValue('transposeProgressionDistances', { song, section: song.getCurrentSection() })).toBe('<span class="transposeProgressionFunctionDistances"><span class="transposeKey">C</span><span class="transposeCaptionBox"><span class="transposeProgOffset">+2</span><span class="transposeArrow">&Rang;</span></span><span class="transposeKey">D</span></span>');
    expect(plugin.getApprovedCaptionValue('transposeProgressionFunctionDistances', { song, section: song.getCurrentSection() })).toBe('<span class="transposeProgressionFunctionDistances"><span class="transposeKey">C</span><span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeProgOffset">+2</span><span class="transposeArrow">&Rang;</span></span><span class="transposeKey">D</span></span>');
  });

  test('approved caption values expose the two-step transpose chain after interval reset', () => {
    const song = makeSong({ sections: [makeCaptionSection(3)] });
    mockRuntime.song = song;
    mockTransposeSong.mockImplementation((delta) => {
      const section = song.getCurrentSection();
      section.rootID = ((Number.parseInt(section.rootID, 10) || 0) + delta + 12) % 12;
    });

    const plugin = new TransposePlugin();
    plugin.setManager({
      song,
      getPluginEntry: () => ({ enabled: true })
    });
    plugin.setPropertyValue('intervals', [0, 2]);
    plugin.invokeAction('apply', { song });
    plugin.setPropertyValue('intervals', [0, 3]);
    plugin.invokeAction('apply', { song });

    expect(plugin.getApprovedCaptionValue('transposeCurrentInterval', { song, section: song.getCurrentSection() })).toBe('3');
    expect(plugin.getApprovedCaptionValue('transposeCurrentOffset', { song, section: song.getCurrentSection() })).toBe('3');
    expect(plugin.getApprovedCaptionValue('transposeOriginalOffset', { song, section: song.getCurrentSection() })).toBe('5');
    expect(plugin.getApprovedCaptionValue('transposeOriginalRootKey', { song, section: song.getCurrentSection() })).toBe('C');
    expect(plugin.getApprovedCaptionValue('transposeSequenceRootKey', { song, section: song.getCurrentSection() })).toBe('D');
    expect(plugin.getApprovedCaptionValue('transposeFunctionSteps', { song, section: song.getCurrentSection() })).toBe('<em class="transposeProg">II</em>,<em class="transposeProg">m</em>');
    expect(plugin.getApprovedCaptionValue('transposeDistanceSteps', { song, section: song.getCurrentSection() })).toBe('<em class="transposeProg">2</em>,<em class="transposeProg">3</em>');
    expect(plugin.getApprovedCaptionValue('transposeFunctionDistanceSteps', { song, section: song.getCurrentSection() })).toBe('<em class="transposeProg">II+2</em>,<em class="transposeProg">m+3</em>');
    expect(plugin.getApprovedCaptionValue('transposeProgressionFunctions', { song, section: song.getCurrentSection() })).toBe('<span class="transposeProgressionFunctionDistances"><span class="transposeKey">C</span><span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeArrow">&Rang;</span></span><span class="transposeKey">D</span><span class="transposeCaptionBox"><span class="transposeProgFunc">+m</span><span class="transposeArrow">&Rang;</span></span><span class="transposeKey">F</span></span>');
    expect(plugin.getApprovedCaptionValue('transposeProgressionDistances', { song, section: song.getCurrentSection() })).toBe('<span class="transposeProgressionFunctionDistances"><span class="transposeKey">C</span><span class="transposeCaptionBox"><span class="transposeProgOffset">+2</span><span class="transposeArrow">&Rang;</span></span><span class="transposeKey">D</span><span class="transposeCaptionBox"><span class="transposeProgOffset">+3</span><span class="transposeArrow">&Rang;</span></span><span class="transposeKey">F</span></span>');
    expect(plugin.getApprovedCaptionValue('transposeProgressionFunctionDistances', { song, section: song.getCurrentSection() })).toBe('<span class="transposeProgressionFunctionDistances"><span class="transposeKey">C</span><span class="transposeCaptionBox"><span class="transposeProgFunc">+II</span><span class="transposeProgOffset">+2</span><span class="transposeArrow">&Rang;</span></span><span class="transposeKey">D</span><span class="transposeCaptionBox"><span class="transposeProgFunc">+m</span><span class="transposeProgOffset">+3</span><span class="transposeArrow">&Rang;</span></span><span class="transposeKey">F</span></span>');
  });

  test('auto sharps/flats applies the simple section spelling policy after transpose', () => {
    const sections = [makeSection(1), makeSection(2), makeSection(10)];
    const song = makeSong({ sections, currentSectionIndex: 1, isHeadless: false });
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 1]);
    plugin.setPropertyValue('autoSharpsFlats', true);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 1 (delta 1)');
    expect(sections.map((section) => section.sharps)).toEqual([false, true, true]);
    expect(song.sharps).toBe(true);
    expect(song.requestUiFullRepaint).toHaveBeenCalledTimes(1);
  });

  test('do lead key passes through to transposeSong options', () => {
    const song = makeSong({ sections: [makeSection(3)] });
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 4]);
    plugin.setPropertyValue('doLeadKey', true);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 4 (delta 4)');
    expect(mockTransposeSong).toHaveBeenNthCalledWith(1, 4, {
      NamedNotes: true,
      doKeyLead: true
    });
  });
});