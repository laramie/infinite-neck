import { jest } from '@jest/globals';

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
  return { rootID, sharps };
}

function makeSong({ sections, currentSectionIndex = 0, isHeadless = true } = {}) {
  return {
    sections,
    isHeadless,
    sharps: false,
    getCurrentSection() {
      return this.sections[currentSectionIndex];
    },
    requestUiFullRepaint: jest.fn()
  };
}

describe('TransposePlugin', () => {
  beforeEach(() => {
    mockTransposeSong.mockClear();
  });

  test('help includes summary formatting and handled events', () => {
    const plugin = new TransposePlugin();
    const help = plugin.buildHelpMessage();

    expect(plugin.buildSummary()).toContain('current interval=0');
    expect(plugin.buildSummary()).toContain('offset=0');
    expect(plugin.buildSummary()).toContain('auto sharps/flats=false');
    expect(plugin.buildSummary()).toContain('do lead key=false');
    expect(help).toContain('Events handled:');
    expect(help).toContain('DaCapo:OnSongEnd');
  });

  test('visible menu includes lowercase auto sharps/flats toggle', () => {
    const plugin = new TransposePlugin();
    const children = plugin.getVisibleMenuChildren();
    const autoNode = children.find((child) => child.name === 'autoSharpsFlats');
    const leadNode = children.find((child) => child.name === 'doLeadKey');

    expect(autoNode).toBeTruthy();
    expect(autoNode.trigger).toBe('a');
    expect(leadNode).toBeTruthy();
    expect(leadNode.trigger).toBe('d');
  });

  test('apply advances interval, tracks offset, and reset returns to zero', () => {
    const song = makeSong({ sections: [makeSection(3)] });
    mockRuntime.song = song;

    const plugin = new TransposePlugin();
    plugin.setPropertyValue('intervals', [0, 2, 5]);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 2 (delta 2)');
    expect(mockTransposeSong).toHaveBeenNthCalledWith(1, 2, {
      NamedNotes: true,
      PlayedNotes: false,
      RecordedNotes: false,
      doKeyLead: false
    });
    expect(plugin.resolveValue('currentOffset')).toBe(2);

    expect(plugin.invokeAction('apply', { song }).result).toBe('manual apply: interval 5 (delta 3)');
    expect(mockTransposeSong).toHaveBeenNthCalledWith(2, 3, {
      NamedNotes: true,
      PlayedNotes: false,
      RecordedNotes: false,
      doKeyLead: false
    });
    expect(plugin.resolveValue('currentOffset')).toBe(5);

    expect(plugin.invokeAction('reset', { song }).result).toBe('manual reset: offset 0');
    expect(mockTransposeSong).toHaveBeenNthCalledWith(3, -5, {
      NamedNotes: true,
      PlayedNotes: false,
      RecordedNotes: false,
      doKeyLead: false
    });
    expect(plugin.resolveValue('currentOffset')).toBe(0);
    expect(plugin.resolveValue('currentInterval')).toBe(0);
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
      PlayedNotes: false,
      RecordedNotes: false,
      doKeyLead: true
    });
  });
});