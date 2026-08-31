const {
  buildNamedNote,
  buildUniversalNamedNote,
  cellBuilder,
  computeCellSizing,
  setNotetableProviders,
  getPianoSkeuomorphicCellHeightPx,
  getPianoSkeuomorphicCellHeightPxForScaleFactor,
  getPianoSkeuomorphicScaleFactor,
  getPianoSkeuomorphicWhiteKeyWidthPx,
  getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor,
  getPianoSkeuomorphicWidthScaleFactor,
  getPianoSkeuomorphicBlackKeyWidthPx,
  getPianoSkeuomorphicBlackKeyWidthPxForScaleFactor
} = await import('../../NoteTableController.js');

describe('NoteTableController note-name lane markup', () => {
  test('universal note-name lane uses the same internal layout shape as NamedNote', () => {
    const named = buildNamedNote('IV', 'C', '', '', '60', 'CenterCell');
    const universal = buildUniversalNamedNote('IV', 'C', '', '', '60', 'CenterCell');

    expect(named).toContain("class='namedNote'");
    expect(universal).toContain("class='universalNamedNote'");

    const normalizedNamed = named.replace("class='namedNote'", "class='lane'");
    const normalizedUniversal = universal.replace("class='universalNamedNote'", "class='lane'");
    expect(normalizedUniversal).toBe(normalizedNamed);
  });

  test('cellBuilder includes the universal lane alongside floating notes and NamedNote', () => {
    const html = cellBuilder('C', '&nbsp;', 3, {
      rootID: 0,
      rootIDLead: -1,
      showCellNotes: true,
      cellIsFunction: false,
      showSubscriptFunctions: true,
      useCenterForRightFunction: false,
      showMidiNum: true
    }, '60');

    expect(html).toContain("class='NoteDisplay'");
    expect(html).toContain("class='universalNamedNote'");
    expect(html).toContain("class='singleNote'");
    expect(html).toContain("class='tinyNote'");
    expect(html).toContain("class='namedNote'");
    expect(html.indexOf("class='universalNamedNote'")).toBeLessThan(html.indexOf("class='namedNote'"));
  });

  test('piano skeuomorphic sizing helpers scale from the standard cell controls with floors', () => {
    expect(getPianoSkeuomorphicCellHeightPx('30px')).toBe(120);
    expect(getPianoSkeuomorphicCellHeightPx('50px')).toBe(200);
    expect(getPianoSkeuomorphicScaleFactor(undefined)).toBe(3);
    expect(getPianoSkeuomorphicScaleFactor('0')).toBe(1);
    expect(getPianoSkeuomorphicScaleFactor('11')).toBe(10);
    expect(getPianoSkeuomorphicCellHeightPxForScaleFactor('50px', 3)).toBe(200);
    expect(getPianoSkeuomorphicCellHeightPxForScaleFactor('50px', 1)).toBe(67);
    expect(getPianoSkeuomorphicCellHeightPxForScaleFactor('50px', 6)).toBe(400);
    expect(getPianoSkeuomorphicWhiteKeyWidthPx('40px')).toBe(50);
    expect(getPianoSkeuomorphicWhiteKeyWidthPx('100px')).toBe(50);
    expect(getPianoSkeuomorphicWhiteKeyWidthPx('200px')).toBe(100);
    expect(getPianoSkeuomorphicWidthScaleFactor(undefined)).toBe(3);
    expect(getPianoSkeuomorphicWidthScaleFactor('0')).toBe(1);
    expect(getPianoSkeuomorphicWidthScaleFactor('7')).toBe(6);
    expect(getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor('100px', 1)).toBe(25);
    expect(getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor('100px', 3)).toBe(50);
    expect(getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor('100px', 6)).toBe(87.5);
    expect(getPianoSkeuomorphicBlackKeyWidthPx('100px')).toBeCloseTo(21.74, 2);
    expect(getPianoSkeuomorphicBlackKeyWidthPx('200px')).toBeCloseTo(43.48, 2);
    expect(getPianoSkeuomorphicBlackKeyWidthPxForScaleFactor('100px', 1)).toBeCloseTo(10.87, 2);
    expect(getPianoSkeuomorphicBlackKeyWidthPxForScaleFactor('100px', 6)).toBeCloseTo(38.04, 2);
  });
});

describe('NoteTableController computeCellSizing (Step D1 render-cache sizing)', () => {
  const baseOptions = {
    NoteDisplaySizes: { width: '60px', height: '40px' },
    naturalFretWidths: false,
    naturalFontScaling: 60
  };
  const tuning = {};

  test('returns fixed nut-width sizing for isNut=true, independent of naturalFretWidths', () => {
    const sizing = computeCellSizing(0, true, baseOptions, tuning);
    expect(sizing).toEqual({
      fontMultiplier: 1,
      tdWidth: 'var(--nut-width)',
      tdHeight: '40px',
      noteDisplayFontSize: '0.6em',
      noteDisplayHeight: '40px'
    });
  });

  test('returns width-derived sizing for isNut=false when naturalFretWidths is off', () => {
    const sizing = computeCellSizing(2, false, baseOptions, tuning);
    expect(sizing).toEqual({
      fontMultiplier: 1,
      tdWidth: '60pt',
      tdHeight: '40px',
      noteDisplayFontSize: '1em',
      noteDisplayHeight: '40px'
    });
  });

  test('scales width and fontMultiplier per-column via fretLengths when naturalFretWidths is on', () => {
    setNotetableProviders({ getSong: () => ({ fretLengths: { 2: 2 } }) });
    try {
      const options = { ...baseOptions, naturalFretWidths: true };
      const sizing = computeCellSizing(2, false, options, tuning);
      expect(sizing.tdWidth).toBe('72pt'); // 60 * 2 * 0.6
      expect(sizing.fontMultiplier).toBeCloseTo(Math.pow(2, 0.6), 10);
    } finally {
      setNotetableProviders({ getSong: () => null });
    }
  });

  test('uses fixedFretWidthMult over naturalFretWidths when both are set', () => {
    const options = { ...baseOptions, naturalFretWidths: true };
    const fixedTuning = { fixedFretWidthMult: 0.5 };
    setNotetableProviders({ getSong: () => ({ fretLengths: { 1: 3 } }) });
    try {
      const sizing = computeCellSizing(1, false, options, fixedTuning);
      expect(sizing.tdWidth).toBe('18pt'); // width(60) * 0.5 * 0.6
    } finally {
      setNotetableProviders({ getSong: () => null });
    }
  });

  test('applies piano-skeuomorphic cell height when enabled on the tuning', () => {
    const pianoTuning = { baseInstrument: 'Piano', rowRange: [1, 2, 3], pianoSkeuomorphic: true };
    const options = { ...baseOptions, pianoHeightScaleFactor: 3 };
    const sizing = computeCellSizing(0, false, options, pianoTuning);
    expect(sizing.tdHeight).toBe(getPianoSkeuomorphicCellHeightPxForScaleFactor('40px', 3) + 'px');
    expect(sizing.noteDisplayHeight).toBe(sizing.tdHeight);
  });
});