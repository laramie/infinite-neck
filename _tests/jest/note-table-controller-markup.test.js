const {
  buildNamedNote,
  buildUniversalNamedNote,
  cellBuilder,
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