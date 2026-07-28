import { jest } from '@jest/globals';
import { TonalSourceSet } from '../../TonalFunctions.js';

const NOTE_NAMES = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab'];

const mockRuntime = {
  song: null,
  sectionChangedCalls: 0
};

function getSectionAt(song, sectionIndex) {
  return song.sections[sectionIndex];
}

jest.unstable_mockModule('../../infinite-neck.js', () => ({
  getSong: () => mockRuntime.song,
  getTransportController: () => ({
    prevSection() {
      if (mockRuntime.song.currentSectionIndex > 0) {
        mockRuntime.song.currentSectionIndex -= 1;
      }
      return { result: `${mockRuntime.song.currentSectionIndex + 1}` };
    },
    nextSection() {
      if (mockRuntime.song.currentSectionIndex < mockRuntime.song.sections.length - 1) {
        mockRuntime.song.currentSectionIndex += 1;
      }
      return { result: `${mockRuntime.song.currentSectionIndex + 1}` };
    }
  }),
  linkToSectionChartChord(sectionIndex, value) {
    getSectionAt(mockRuntime.song, sectionIndex).chartChord = value;
  },
  linkToSectionChartMode(sectionIndex, value) {
    getSectionAt(mockRuntime.song, sectionIndex).chartMode = value;
  },
  linkToSectionTableChord(sectionIndex, tableID, value) {
    getSectionAt(mockRuntime.song, sectionIndex).getSectionNotes(tableID).chord = value;
  },
  linkToSectionTableMode(sectionIndex, tableID, value) {
    getSectionAt(mockRuntime.song, sectionIndex).getSectionNotes(tableID).mode = value;
  },
  linkToSectionTableTonalSourceSet(sectionIndex, tableID, value) {
    getSectionAt(mockRuntime.song, sectionIndex).getSectionNotes(tableID).tonalSourceSet = value;
  },
  linkToSectionChangedTonal() {
    mockRuntime.sectionChangedCalls += 1;
  }
}));

const { SectionNotes } = await import('../../SectionNotes.js');
const { TonalPlugin } = await import('../../plugins/tonal/TonalPlugin.js');
const { getTonalSuggestionState, TonalAutoWrite } = await import('../../tonalPicker-functions.js');

function createNamedNotes(noteNames) {
  return Object.fromEntries(noteNames.map((noteName) => [noteName, { noteName, colorClass: 'noteTransparent' }]));
}

function createSection(sectionNotesByTable = {}, rootID = '3') {
  return {
    rootID,
    chartChord: '',
    chartMode: '',
    sectionNotesByTable,
    getSectionNotes(tableID) {
      if (!this.sectionNotesByTable[tableID]) {
        this.sectionNotesByTable[tableID] = new SectionNotes();
      }
      return this.sectionNotesByTable[tableID];
    },
    getNoteRoot(tablename) {
      const sectionNotes = this.sectionNotesByTable[tablename];
      for (const [noteName, note] of Object.entries(sectionNotes?.namedNotes || {})) {
        if (note?.colorClass === 'noteRoot') {
          return { noteName, tablename };
        }
      }
      return null;
    }
  };
}

function createSong(sections) {
  return {
    currentSectionIndex: 0,
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
    noteIDToNoteName(noteID) {
      const index = Number.parseInt(noteID, 10);
      return NOTE_NAMES[index] || 'C';
    },
    getCurrentSection() {
      return this.sections[this.currentSectionIndex];
    },
    getSectionsCurrentIndex() {
      return this.currentSectionIndex;
    }
  };
}

describe('TonalPlugin', () => {
  beforeEach(() => {
    mockRuntime.song = null;
    mockRuntime.sectionChangedCalls = 0;
  });

  test('builds the approved accept-focused menu shape under /fpo', () => {
    const section = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G', 'B'])
      })
    });
    const song = createSong([section]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    const children = plugin.getVisibleMenuChildren();
    const acceptNode = children.find((child) => child.name === 'accept');

    expect(children.map((child) => child.trigger)).toEqual(['a', 'p', 'c', 'm']);
    expect(acceptNode.children.map((child) => child.name)).toEqual([
      'targetTable',
      'autoWrite',
      'sourceNoteType',
      'applySourceNoteTypeToAllSections',
      'prevSection',
      'nextSection',
      'acceptChordModeAndNext',
      'chords',
      'acceptFirstChord',
      'modes',
      'acceptFirstMode',
      'refresh',
      'help'
    ]);
    expect(acceptNode.children.find((child) => child.name === 'acceptFirstChord').caption).toContain('<b>C</b>hord <em>Cmaj7</em>');
    expect(plugin.resolveValue('targetTable', { song })).toBe('P46_1');
  });

  test('empty first chord suggestion shows none without a checkmark', () => {
    const section = createSection({
      tblP46_1: new SectionNotes()
    });
    const song = createSong([section]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    const acceptNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'accept');
    const acceptFirstChordNode = acceptNode.children.find((child) => child.name === 'acceptFirstChord');

    expect(section.chartChord).toBe('');
    expect(plugin.resolveValue('chordSummary', { song })).toBe('[]');
    expect(acceptFirstChordNode.caption).toContain('<b>C</b>hord <em>&lt;none&gt;</em>');
    expect(acceptFirstChordNode.caption).not.toContain("<span class='commandCheckmark'>&check;</span>");
  });

  test('accepts the first chord into chart and table by default', () => {
    const section = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G', 'B'])
      })
    });
    const song = createSong([section]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();

    const result = plugin.invokeAction('acceptFirstChord', { song });

    expect(result.result).toBe('accepted chord 1: Cmaj7');
    expect(section.chartChord).toBe('Cmaj7');
    expect(section.getSectionNotes('tblP46_1').chord).toBe('Cmaj7');
    expect(mockRuntime.sectionChangedCalls).toBe(1);
  });

  test('table auto-write leaves chartChord untouched and checkmarks the table value', () => {
    const section = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G', 'B'])
      })
    });
    const song = createSong([section]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });
    plugin.getVisibleMenuChildren();
    plugin.setPropertyValue('autoWrite', TonalAutoWrite.TABLE, { song });

    const result = plugin.invokeAction('acceptFirstChord', { song });
    const acceptNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'accept');
    const acceptFirstChordNode = acceptNode.children.find((child) => child.name === 'acceptFirstChord');

    expect(result.result).toBe('accepted chord 1: Cmaj7');
    expect(section.chartChord).toBe('');
    expect(section.getSectionNotes('tblP46_1').chord).toBe('Cmaj7');
    expect(plugin.resolveValue('chordSummary', { song })).toBe("[<span class='commandCheckmark'>&check;</span>Cmaj7]");
    expect(acceptFirstChordNode.caption).toContain("<span class='commandCheckmark'>&check;</span><em>Cmaj7</em>");
    expect(acceptFirstChordNode.caption).not.toContain("<span class='commandCheckmark'>&check;</span></em>");
  });

  test('chord summary shows up to three visible suggestions before the more count', () => {
    const section = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'D', 'Eb', 'F', 'G', 'Bb'])
      })
    });
    const song = createSong([section]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    expect(plugin.resolveValue('chordSummary', { song })).toBe('[Cm11, Ebmaj13/C, EbM7add13/C, 1 more]');
  });

  test('mode summary shows up to three visible suggestions and submenu accepts stay terse without hidden overflow', () => {
    const section = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'D', 'Eb', 'F', 'G', 'Bb'])
      })
    });
    const song = createSong([section]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    const terse = plugin.invokeAction('acceptFirstMode', { song });
    const verbose = plugin.invokeAction('acceptModeIndex:0:overflow', { song });
    const acceptNode = plugin.getVisibleMenuChildren().find((child) => child.name === 'accept');
    const acceptFirstModeNode = acceptNode.children.find((child) => child.name === 'acceptFirstMode');

    expect(plugin.resolveValue('modeSummary', { song })).toBe("[<span class='commandCheckmark'>&check;</span>C minor, C dorian, C chromatic]");
    expect(terse.result).toBe('accepted mode 1: C minor');
    expect(verbose.result).toBe('accepted mode 1: C minor');
    expect(acceptFirstModeNode.caption).toContain("<span class='commandCheckmark'>&check;</span><em>C minor</em>");
  });

  test('next section navigation keeps the plugin on the new section context', () => {
    const firstSection = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G', 'B'])
      })
    });
    const secondSection = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['D', 'F', 'A', 'C'])
      })
    }, '5');
    const song = createSong([firstSection, secondSection]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    const result = plugin.invokeAction('nextSection', { song });

    expect(result.result).toBe('section 2');
    expect(song.getSectionsCurrentIndex()).toBe(1);
    expect(plugin.resolveValue('chordSummary', { song })).toBe('[Dm7, F6/D]');
  });

  test('N accepts first chord and mode, then advances to next section', () => {
    const firstSection = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G', 'Bb'])
      })
    });
    const secondSection = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['D', 'F', 'A', 'C'])
      })
    }, '5');
    const song = createSong([firstSection, secondSection]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });
    const firstState = getTonalSuggestionState(song, firstSection, 'tblP46_1');
    const expectedChord = firstState.chordSuggestions[0];
    const expectedMode = firstState.modeSuggestions[0];

    const result = plugin.invokeAction('acceptChordModeAndNext', { song });

    expect(firstSection.chartChord).toBe(expectedChord);
    expect(firstSection.getSectionNotes('tblP46_1').chord).toBe(expectedChord);
    expect(firstSection.chartMode).toBe(expectedMode);
    expect(firstSection.getSectionNotes('tblP46_1').mode).toBe(expectedMode);
    expect(song.getSectionsCurrentIndex()).toBe(1);
    expect(result.result).toContain(`accepted chord 1: ${expectedChord}`);
    expect(result.result).toContain(`accepted mode 1: ${expectedMode}`);
    expect(result.result).toContain('section 2');
  });

  test('source note type caption reflects the current section and updates after navigation', () => {
    const firstSection = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G']),
        tonalSourceSet: TonalSourceSet.NAMEDNOTE
      })
    });
    const secondSection = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['D', 'F', 'A']),
        tonalSourceSet: TonalSourceSet.SINGLENOTE
      })
    });
    const song = createSong([firstSection, secondSection]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    expect(plugin.resolveValue('sourceNoteType', { song })).toBe('named');
    plugin.invokeAction('nextSection', { song });
    expect(plugin.resolveValue('sourceNoteType', { song })).toBe('single');
  });

  test('setSourceNoteType updates current section table tonalSourceSet', () => {
    const section = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G']),
        tonalSourceSet: TonalSourceSet.NAMEDNOTE
      })
    });
    const song = createSong([section]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    const result = plugin.invokeAction('setSourceNoteType:tiny', { song });

    expect(result.result).toBe('source note type set to tiny');
    expect(section.getSectionNotes('tblP46_1').tonalSourceSet).toBe(TonalSourceSet.TINYNOTE);
    expect(mockRuntime.sectionChangedCalls).toBe(1);
  });

  test('applySourceNoteTypeToAllSections copies current section source type across sections for target table', () => {
    const firstSection = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G']),
        tonalSourceSet: TonalSourceSet.SINGLENOTE
      })
    });
    const secondSection = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['D', 'F', 'A']),
        tonalSourceSet: TonalSourceSet.NAMEDNOTE
      })
    });
    const thirdSection = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['E', 'G', 'B']),
        tonalSourceSet: TonalSourceSet.TINYNOTE
      })
    });
    const song = createSong([firstSection, secondSection, thirdSection]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    const result = plugin.invokeAction('applySourceNoteTypeToAllSections', { song });

    expect(result.result).toBe('applied source note type single to all sections');
    song.sections.forEach((sectionForAssertion) => {
      expect(sectionForAssertion.getSectionNotes('tblP46_1').tonalSourceSet).toBe(TonalSourceSet.SINGLENOTE);
    });
    expect(mockRuntime.sectionChangedCalls).toBe(1);
  });

  test('print extra modes uses the unfiltered mode list', () => {
    const section = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G'])
      })
    });
    const song = createSong([section]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    const state = getTonalSuggestionState(song, section, 'tblP46_1');
    const result = plugin.invokeAction('printExtraModes', { song });

    expect(state.extraModeSuggestions.length).toBeGreaterThan(state.modeSuggestions.length);
    expect(result.result).toBe(`printed ${state.extraModeSuggestions.length} modes`);
    expect(result.preserveMenuStack).toBe(true);
    expect(result.message).toContain('Tonal extra modes: section 1, table P46_1');
    expect(result.message).toContain('C major');
  });

  test('help keeps the command-line stack parked on the current tonal menu', () => {
    const section = createSection({
      tblP46_1: new SectionNotes({
        namedNotes: createNamedNotes(['C', 'E', 'G'])
      })
    });
    const song = createSong([section]);
    mockRuntime.song = song;

    const plugin = new TonalPlugin();
    plugin.setManager({ song });

    const result = plugin.invokeAction('help', { song });

    expect(result.result).toBe('Tonal help shown');
    expect(result.preserveMenuStack).toBe(true);
    expect(result.message).toContain('/fpo opens the TonalPlugin root menu');
  });
});