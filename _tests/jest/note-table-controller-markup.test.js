const { buildNamedNote, buildUniversalNamedNote, cellBuilder } = await import('../../NoteTableController.js');

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
});