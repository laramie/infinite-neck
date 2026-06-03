import { jest } from '@jest/globals';

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

    expect(children.map((child) => child.trigger)).toEqual(['a', 'p']);
    expect(acceptNode.children.map((child) => child.name)).toEqual([
      'targetTable',
      'autoWrite',
      'prevSection',
      'nextSection',
      'chords',
      'acceptFirstChord',
      'modes',
      'acceptFirstMode',
      'refresh',
      'help'
    ]);
    expect(acceptNode.children.find((child) => child.name === 'acceptFirstChord').caption).toContain("Chord 'Cmaj7'");
    expect(plugin.resolveValue('targetTable', { song })).toBe('P46_1');
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

    expect(result.result).toBe('accepted chord 1: Cmaj7');
    expect(section.chartChord).toBe('');
    expect(section.getSectionNotes('tblP46_1').chord).toBe('Cmaj7');
    expect(plugin.resolveValue('chordSummary', { song })).toBe('[&check;Cmaj7]');
  });

  test('submenu accept actions stay terse when there is no hidden overflow', () => {
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

    expect(plugin.resolveValue('modeSummary', { song })).toBe('[&check;C minor, 1 more]');
    expect(terse.result).toBe('accepted mode 1: C minor');
    expect(verbose.result).toBe('accepted mode 1: C minor');
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
    expect(plugin.resolveValue('chordSummary', { song })).toBe('[Dm7, 1 more]');
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
    expect(result.message).toContain('Tonal extra modes: section 1, table P46_1');
    expect(result.message).toContain('C major');
  });
});