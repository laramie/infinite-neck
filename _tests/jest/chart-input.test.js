import {
  buildChartInputHtml,
  buildChordSuggestionCatalog,
  buildModeSuggestionCatalog,
  cycleSuggestion,
  filterChartInputSuggestions,
  formatSuggestionColumns,
  parseNewSectionCommand
} from '../../ChartInput.js';

describe('Chart Input suggestion helpers', () => {
  test('panel markup includes current chart chord and mode spans', () => {
    const html = buildChartInputHtml();

    expect(html).toContain("class='chartInputCurrentValues'");
    expect(html).toContain("class='lblSectionChartChord'");
    expect(html).toContain("class='lblSectionMode'");
    expect(html.indexOf("class='chartInputCurrentValues'")).toBeLessThan(html.indexOf("id='chartInputSuggestions'"));
  });

  test('empty input and bare root do not show full suggestion catalog', () => {
    const catalog = buildChordSuggestionCatalog({ chordTypes: ['M', 'm7'], noteNamesFlat: ['C'], noteNamesSharp: [] });

    expect(filterChartInputSuggestions('', catalog, 'chord')).toEqual([]);
    expect(filterChartInputSuggestions('C', catalog, 'chord')).toEqual([]);
  });

  test('rooted chord input filters matching chord suggestions', () => {
    const catalog = buildChordSuggestionCatalog({ chordTypes: ['M', 'm', 'm7', 'maj7'], noteNamesFlat: ['C'], noteNamesSharp: [] });

    const suggestions = filterChartInputSuggestions('Cm', catalog, 'chord');

    expect(suggestions.map((entry) => entry.value)).toEqual(expect.arrayContaining(['Cm', 'Cm7']));
    expect(suggestions[0].value).toBe('Cm');
  });

  test('rooted major chord input is restricted to the typed key', () => {
    const catalog = buildChordSuggestionCatalog({ chordTypes: ['M', 'M7', 'm'], noteNamesFlat: ['A', 'Bb', 'C', 'Db'], noteNamesSharp: ['C#'] });

    const suggestions = filterChartInputSuggestions('CM', catalog, 'chord');
    const values = suggestions.map((entry) => entry.value);

    expect(values).toContain('CM');
    expect(values).toContain('CM7');
    expect(values).not.toContain('AM');
    expect(values).not.toContain('BbM');
    expect(values).not.toContain('C#M');
    expect(suggestions.every((entry) => entry.root === 'C' || entry.value === 'none')).toBe(true);
  });

  test('new-section easter egg parses key and lead-key forms', () => {
    expect(parseNewSectionCommand('!')).toEqual(expect.objectContaining({
      display: 'Create new Section in Key of C',
      keyName: 'C',
      keyID: 3,
      leadKeyName: '',
      leadKeyID: -1
    }));
    expect(parseNewSectionCommand('!C')).toEqual(expect.objectContaining({
      display: 'Create new Section in Key of C',
      keyName: 'C',
      keyID: 3,
      leadKeyID: -1
    }));
    expect(parseNewSectionCommand('!/c')).toEqual(expect.objectContaining({
      display: 'Create new Section in Key of C',
      keyName: 'C',
      keyID: 3,
      leadKeyID: -1
    }));
    expect(parseNewSectionCommand('!f/c')).toEqual(expect.objectContaining({
      display: 'Create new Section in Key of C with LeadKey of F',
      keyName: 'C',
      keyID: 3,
      leadKeyName: 'F',
      leadKeyID: 8
    }));
    expect(parseNewSectionCommand('!F/')).toEqual(expect.objectContaining({
      display: 'Create new Section in Key of C with LeadKey of F',
      keyName: 'C',
      leadKeyName: 'F'
    }));
  });

  test('new-section easter egg appears as a chord suggestion only', () => {
    const chordSuggestions = filterChartInputSuggestions('!F/C', [], 'chord');
    const modeSuggestions = filterChartInputSuggestions('!F/C', [], 'mode');

    expect(chordSuggestions).toHaveLength(1);
    expect(chordSuggestions[0]).toEqual(expect.objectContaining({
      action: 'newSection',
      display: 'Create new Section in Key of C with LeadKey of F',
      keyID: 3,
      leadKeyID: 8
    }));
    expect(modeSuggestions).toEqual([]);
  });

  test('mode compact input finds spaced mode suggestion', () => {
    const catalog = buildModeSuggestionCatalog({
      modeOptions: [{ value: 'minor pentatonic' }, { value: 'major' }],
      noteNamesFlat: ['C'],
      noteNamesSharp: []
    });

    const suggestions = filterChartInputSuggestions('Cminorpentatonic', catalog, 'mode');

    expect(suggestions.map((entry) => entry.value)).toContain('C minor pentatonic');
  });

  test('mode-only input applies current section root for suggestions', () => {
    const catalog = buildModeSuggestionCatalog({
      modeOptions: [{ value: 'minor pentatonic' }, { value: 'major' }],
      noteNamesFlat: ['C'],
      noteNamesSharp: []
    });

    const suggestions = filterChartInputSuggestions('minor pent', catalog, 'mode', { section: { rootID: 3, sharps: false } });

    expect(suggestions[0].value).toBe('C minor pentatonic');
  });

  test('chord suffix-only input applies current section root for suggestions', () => {
    const catalog = buildChordSuggestionCatalog({ chordTypes: ['M', 'm7'], noteNamesFlat: ['C'], noteNamesSharp: [] });

    const suggestions = filterChartInputSuggestions('m7', catalog, 'chord', { section: { rootID: 3, sharps: false } });

    expect(suggestions[0].value).toBe('Cm7');
  });

  test('current section sharp preference is used for suffix-only suggestions', () => {
    const catalog = buildChordSuggestionCatalog({ chordTypes: ['m7'], noteNamesFlat: ['Db'], noteNamesSharp: ['C#'] });

    const suggestions = filterChartInputSuggestions('m7', catalog, 'chord', { section: { rootID: 4, sharps: true } });

    expect(suggestions[0].value).toBe('C#m7');
  });

  test('explicit none can be selected after typing a prefix', () => {
    const catalog = buildModeSuggestionCatalog({ modeOptions: [{ value: 'major' }], noteNamesFlat: ['C'], noteNamesSharp: [] });

    const suggestions = filterChartInputSuggestions('n', catalog, 'mode', { section: { rootID: 3 } });

    expect(suggestions[0].value).toBe('none');
  });

  test('cycling wraps and empty suggestions are ignored', () => {
    expect(cycleSuggestion(-1, [])).toBe(-1);
    expect(cycleSuggestion(-1, [{ value: 'CM' }, { value: 'Cm' }])).toBe(0);
    expect(cycleSuggestion(0, [{ value: 'CM' }, { value: 'Cm' }])).toBe(1);
    expect(cycleSuggestion(1, [{ value: 'CM' }, { value: 'Cm' }])).toBe(0);
  });

  test('suggestion columns use five rows unless more than five columns are needed', () => {
    const suggestions = Array.from({ length: 26 }, (_, index) => ({ value: `C${index}`, display: `C${index}` }));

    const columns = formatSuggestionColumns(suggestions, 0);

    expect(columns).toHaveLength(5);
    expect(columns[0]).toHaveLength(6);
    expect(columns[4]).toHaveLength(2);
  });
});
