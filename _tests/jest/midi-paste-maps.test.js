import { BUILTIN_MIDI_PASTE_MAPS } from '../../plugins/clip/midiPasteMapBuiltins.js';
import {
  MAP_CHOICE_TRIGGERS,
  applyStringMap,
  cleanMapId,
  findMapIgnoringCase,
  invertPairs,
  listMidiPasteMaps,
  matchEndpoint,
  normalizeMapId,
  parseAddInput,
  parseMapSpec,
  prepareStringPairs,
  resolveMidiPasteMap,
  splitMapId
} from '../../plugins/clip/midiPasteMaps.js';

function tuning(overrides = {}) {
  return {
    baseID: 'X1',
    fromBaseID: 'X1',
    baseInstrument: 'Guitar',
    nStrings: 6,
    ...overrides
  };
}

describe('built-in MIDI Paste maps', () => {
  // Syntax only: editing the constant must never break these tests.
  test('every built-in id is canonical and every spec parses', () => {
    const ids = Object.keys(BUILTIN_MIDI_PASTE_MAPS);
    expect(ids.length).toBeGreaterThan(0);
    expect(Object.isFrozen(BUILTIN_MIDI_PASTE_MAPS)).toBe(true);
    ids.forEach((id) => {
      expect(cleanMapId(id)).toBe(id);
      expect(parseMapSpec(BUILTIN_MIDI_PASTE_MAPS[id]).ok).toBe(true);
    });
    expect(new Set(ids.map((id) => id.toLowerCase())).size).toBe(ids.length);
  });

  test('listMidiPasteMaps puts built-ins first, then user maps in order, skipping malformed entries', () => {
    const list = listMidiPasteMaps([{ id: 'zeta', spec: '1:1' }, null, { id: 5 }, { id: 'alpha', spec: '2:2' }]);
    const builtinCount = Object.keys(BUILTIN_MIDI_PASTE_MAPS).length;
    expect(list.slice(0, builtinCount).every((map) => map.builtin)).toBe(true);
    expect(list.slice(builtinCount)).toEqual([
      { id: 'zeta', spec: '1:1', builtin: false },
      { id: 'alpha', spec: '2:2', builtin: false }
    ]);
  });
});

describe('parseMapSpec', () => {
  test('accepts pairs with or without spaces and preserves the typed text', () => {
    const spaced = parseMapSpec('  1:1, 2 : 4 ,3:2  ');
    expect(spaced.ok).toBe(true);
    expect(spaced.spec).toBe('1:1, 2 : 4 ,3:2');
    expect(spaced.pairs).toEqual([{ from: 1, to: 1 }, { from: 2, to: 4 }, { from: 3, to: 2 }]);
    expect(parseMapSpec('1:1,2:2').ok).toBe(true);
  });

  test.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['1:1,', 'trailing comma'],
    ['1:1,,2:2', 'empty pair'],
    ['0:1', 'string 0'],
    ['1:0', 'string 0'],
    ['1-2', 'not a pair'],
    ['a:b', 'not a pair'],
    ['1:2:3', 'not a pair'],
    ['1:', 'half pair'],
    ['-1:2', 'negative'],
    ['1:2 3:4', 'missing comma'],
    ['1:1000', 'too large']
  ])('rejects %j (%s)', (text) => {
    const result = parseMapSpec(text);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.pairs).toEqual([]);
  });

  test('the string 0 error tells the user to omit the string', () => {
    expect(parseMapSpec('0:3').errors[0]).toContain('omit');
  });

  test('exact duplicate pairs warn and are ignored', () => {
    const result = parseMapSpec('1:2, 3:4, 1:2');
    expect(result.ok).toBe(true);
    expect(result.pairs).toEqual([{ from: 1, to: 2 }, { from: 3, to: 4 }]);
    expect(result.warnings.join(' ')).toContain('duplicate pair 1:2');
  });

  test('many-to-one warns that the later pair wins; one-to-many does not warn', () => {
    expect(parseMapSpec('1:2, 3:2').warnings.join(' ')).toContain('later pair wins');
    expect(parseMapSpec('1:1, 1:2').warnings).toEqual([]);
  });

  test('over-long specs are rejected', () => {
    const long = Array.from({ length: 200 }, (_, i) => `${(i % 9) + 1}:${(i % 9) + 1}`).join(', ');
    expect(parseMapSpec(long).ok).toBe(false);
  });
});

describe('map ids', () => {
  test('pair-form ids are respaced to "A > B"', () => {
    expect(cleanMapId('P48>P46')).toBe('P48 > P46');
    expect(cleanMapId('  P48   >    P46  ')).toBe('P48 > P46');
    expect(splitMapId('P48 > P46')).toEqual({ source: 'P48', dest: 'P46' });
    expect(splitMapId('lute reorder')).toBeNull();
  });

  test('disallowed characters are dropped; allowed punctuation stays', () => {
    expect(cleanMapId('my <script map & "quote"')).toBe('my script map quote');
    expect(cleanMapId("Drop-D_2.0 it's")).toBe("Drop-D_2.0 it's");
    const result = normalizeMapId('a<b');
    expect(result.id).toBe('ab');
    expect(result.changed).toBe(true);
  });

  test('is idempotent', () => {
    ['P48>P46', 'lute  reorder', '<<x>>y', "it's > fine"].forEach((raw) => {
      const once = cleanMapId(raw);
      expect(cleanMapId(once)).toBe(once);
    });
  });

  test.each([
    ['', 'empty'],
    ['<>', 'nothing left'],
    ['A > B > C', 'two >'],
    ['> B', 'missing source'],
    ['A >', 'missing dest'],
    ['x'.repeat(61), 'too long']
  ])('rejects %j (%s)', (raw) => {
    const result = normalizeMapId(raw);
    expect(result.id).toBe('');
    expect(result.error).not.toBe('');
  });
});

describe('parseAddInput', () => {
  test('parses a quoted id then pairs', () => {
    const result = parseAddInput('"Foo > Bar" 1:2, 3:4');
    expect(result).toMatchObject({ ok: true, id: 'Foo > Bar', spec: '1:2, 3:4' });
    expect(result.pairs).toEqual([{ from: 1, to: 2 }, { from: 3, to: 4 }]);
    expect(result.warnings).toEqual([]);
  });

  test('warns when the id is stored differently from what was typed', () => {
    const result = parseAddInput('"Foo>Bar" 1:2');
    expect(result.ok).toBe(true);
    expect(result.id).toBe('Foo > Bar');
    expect(result.warnings.join(' ')).toContain('id stored as "Foo > Bar"');
  });

  test.each([
    'Foo 1:2',
    '1:2',
    '"Foo 1:2',
    '"" 1:2',
    '"Foo"',
    '"Foo" 0:1',
    '"A > B > C" 1:1',
    ''
  ])('rejects %j', (line) => {
    const result = parseAddInput(line);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('collects both an id error and a spec error', () => {
    expect(parseAddInput('"" 0:1').errors.length).toBe(2);
  });
});

describe('invertPairs', () => {
  test('swaps each pair and is its own inverse', () => {
    const pairs = [{ from: 1, to: 2 }, { from: 3, to: 3 }, { from: 1, to: 4 }];
    expect(invertPairs(pairs)).toEqual([{ from: 2, to: 1 }, { from: 3, to: 3 }, { from: 4, to: 1 }]);
    expect(invertPairs(invertPairs(pairs))).toEqual(pairs);
  });
});

describe('map choice triggers', () => {
  test('are 1-9 then a-z with no 0 and no n', () => {
    expect(MAP_CHOICE_TRIGGERS.slice(0, 9)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(MAP_CHOICE_TRIGGERS).not.toContain('0');
    expect(MAP_CHOICE_TRIGGERS).not.toContain('n');
    expect(MAP_CHOICE_TRIGGERS).toContain('z');
    expect(new Set(MAP_CHOICE_TRIGGERS).size).toBe(MAP_CHOICE_TRIGGERS.length);
  });
});

describe('matchEndpoint', () => {
  const library = {
    A: tuning({ baseID: 'A', fromBaseID: 'A', nStrings: 8 }),
    B: tuning({ baseID: 'B', fromBaseID: 'B', nStrings: 6 }),
    Bassy: tuning({ baseID: 'Bassy', fromBaseID: 'Bassy', baseInstrument: 'Bass', nStrings: 4 })
  };
  const lookup = (id) => library[id] || null;

  test('matches by lineage id, including instance baseIDs', () => {
    expect(matchEndpoint(tuning({ baseID: 'A_1', fromBaseID: 'A', nStrings: 3 }), 'A', lookup)).toBe('lineage');
    expect(matchEndpoint(tuning({ baseID: 'A_1', fromBaseID: 'A' }), 'A_1', lookup)).toBe('lineage');
  });

  test('matches by class: same baseInstrument and string count as the named tuning', () => {
    expect(matchEndpoint(tuning({ baseID: 'Other', fromBaseID: 'Other', nStrings: 8 }), 'A', lookup)).toBe('class');
    expect(matchEndpoint(tuning({ baseID: 'Other', fromBaseID: 'Other', nStrings: 6 }), 'A', lookup)).toBeNull();
    expect(matchEndpoint(tuning({ baseID: 'Other', fromBaseID: 'Other', baseInstrument: 'Bass', nStrings: 8 }), 'A', lookup)).toBeNull();
  });

  test('an endpoint that names no known tuning matches only by lineage; matching is case-sensitive', () => {
    const lute = tuning({ baseID: 'Lute', fromBaseID: 'Lute', baseInstrument: 'Lute', nStrings: 4 });
    expect(matchEndpoint(lute, 'Lute', lookup)).toBe('lineage');
    expect(matchEndpoint(lute, 'lute', lookup)).toBeNull();
    expect(matchEndpoint(lute, 'Unknown', lookup)).toBeNull();
    expect(matchEndpoint(null, 'A', lookup)).toBeNull();
  });

  test('string count falls back to rowRange length', () => {
    const noCount = { baseID: 'R', baseInstrument: 'Guitar', rowRange: [1, 2, 3, 4, 5, 6, 7, 8] };
    expect(matchEndpoint(noCount, 'A', lookup)).toBe('class');
  });
});

describe('resolveMidiPasteMap', () => {
  const library = {
    S: tuning({ baseID: 'S', fromBaseID: 'S', nStrings: 6 }),
    E: tuning({ baseID: 'E', fromBaseID: 'E', nStrings: 8 }),
    Bs4: tuning({ baseID: 'Bs4', fromBaseID: 'Bs4', baseInstrument: 'Bass', nStrings: 4 }),
    Bs5: tuning({ baseID: 'Bs5', fromBaseID: 'Bs5', baseInstrument: 'Bass', nStrings: 5 })
  };
  const lookup = (id) => library[id] || null;
  const maps = [
    { id: 'E > S', spec: '1:1, 2:2', builtin: true },
    { id: 'Bs5 > Bs4', spec: '1:1, 2:2, 3:3, 4:4', builtin: true },
    { id: 'S > E', spec: '1:2', builtin: false },
    { id: 'lute reorder', spec: '1:1, 2:4, 3:2, 4:3', builtin: false }
  ];
  const resolve = (activeId, sourceTuning, targetTuning, overrideMaps = maps) => resolveMidiPasteMap({
    maps: overrideMaps, activeId, sourceTuning, targetTuning, lookupTuning: lookup
  });

  test('no active id, or an unknown one, resolves to null', () => {
    expect(resolve('', library.E, library.S)).toBeNull();
    expect(resolve('missing', library.E, library.S)).toBeNull();
  });

  test('forward direction uses the active map', () => {
    const resolved = resolve('E > S', library.E, library.S);
    expect(resolved).toEqual({ id: 'E > S', pairs: [{ from: 1, to: 1 }, { from: 2, to: 2 }], route: 'forward' });
  });

  test('forward applies to any tuning of the same class (instance and sibling tunings)', () => {
    const dropD = tuning({ baseID: 'DropD', fromBaseID: 'DropD', nStrings: 6 });
    const e8instance = tuning({ baseID: 'E_1', fromBaseID: 'E', nStrings: 8 });
    expect(resolve('E > S', e8instance, dropD).route).toBe('forward');
  });

  test('reverse prefers a stored reverse map over inference', () => {
    const resolved = resolve('E > S', library.S, library.E, [...maps, { id: 'S > E', spec: '1:2', builtin: false }]);
    expect(resolved.route).toBe('reverse-stored');
    expect(resolved.id).toBe('S > E');
    expect(resolved.pairs).toEqual([{ from: 1, to: 2 }]);
  });

  test('reverse is inferred by swapping pairs when no reverse map is stored', () => {
    const resolved = resolve('Bs5 > Bs4', library.Bs4, library.Bs5);
    expect(resolved.route).toBe('reverse-inferred');
    expect(resolved.id).toBe('Bs5 > Bs4');
    expect(resolved.pairs).toEqual(invertPairs([{ from: 1, to: 1 }, { from: 2, to: 2 }, { from: 3, to: 3 }, { from: 4, to: 4 }]));
  });

  test('a custom id applies to any pair of tunings and is never reversed', () => {
    const resolved = resolve('lute reorder', library.Bs4, library.Bs5);
    expect(resolved).toEqual({
      id: 'lute reorder',
      pairs: [{ from: 1, to: 1 }, { from: 2, to: 4 }, { from: 3, to: 2 }, { from: 4, to: 3 }],
      route: 'custom'
    });
  });

  test('a map that does not fit the pair resolves to null', () => {
    expect(resolve('Bs5 > Bs4', library.E, library.S)).toBeNull();
    expect(resolve('E > S', library.Bs4, library.Bs5)).toBeNull();
  });

  test('an unparsable stored map resolves to null instead of throwing', () => {
    expect(resolve('bad', library.E, library.S, [{ id: 'bad', spec: '0:0' }])).toBeNull();
  });

  test('findMapIgnoringCase is the uniqueness check', () => {
    expect(findMapIgnoringCase(maps, 'LUTE REORDER').id).toBe('lute reorder');
    expect(findMapIgnoringCase(maps, 'nope')).toBeNull();
  });
});

describe('prepareStringPairs and applyStringMap', () => {
  const note = (row, id, extra = {}) => ({ row: `${row}`, id, styleNum: 1, ...extra });
  // Places a note on target row `row` with a column equal to its id so cells are distinguishable.
  const placeAll = (n, targetRow) => ({ ...n, row: `${targetRow}`, col: `${n.col ?? 0}` });

  test('converts to 0-based, keeps spec order, and reports pairs beyond the string counts', () => {
    const { rowPairs, skipped } = prepareStringPairs(
      [{ from: 1, to: 2 }, { from: 7, to: 1 }, { from: 2, to: 9 }],
      6,
      4
    );
    expect(rowPairs).toEqual([{ from0: 0, to0: 1, order: 0 }]);
    expect(skipped).toEqual([{ from: 7, to: 1 }, { from: 2, to: 9 }]);
  });

  test('unmapped source strings are counted and not pasted', () => {
    const rowPairs = prepareStringPairs([{ from: 1, to: 1 }], 6, 6).rowPairs;
    const result = applyStringMap({ notes: [note(0, 'a'), note(3, 'b')], rowPairs, placeNote: placeAll });
    expect(result.candidates.map((c) => c.id)).toEqual(['a']);
    expect(result.unmapped).toBe(1);
    expect(result.dropped).toBe(0);
  });

  test('a note no pair can place is dropped, and notes with unusable rows are dropped', () => {
    const rowPairs = prepareStringPairs([{ from: 1, to: 1 }], 6, 6).rowPairs;
    const result = applyStringMap({
      notes: [note(0, 'a'), { row: 'x', id: 'bad' }],
      rowPairs,
      placeNote: () => null
    });
    expect(result.candidates).toEqual([]);
    expect(result.dropped).toBe(2);
  });

  test('one-to-many places a candidate for each pair', () => {
    const rowPairs = prepareStringPairs([{ from: 1, to: 1 }, { from: 1, to: 3 }], 4, 4).rowPairs;
    const result = applyStringMap({ notes: [note(0, 'a')], rowPairs, placeNote: placeAll });
    expect(result.candidates.map((c) => c.row)).toEqual(['0', '2']);
  });

  test('a string that cannot play the pitch is skipped, the others still land', () => {
    const rowPairs = prepareStringPairs([{ from: 1, to: 1 }, { from: 1, to: 2 }], 4, 4).rowPairs;
    const result = applyStringMap({
      notes: [note(0, 'a')],
      rowPairs,
      placeNote: (n, targetRow) => (targetRow === 0 ? null : placeAll(n, targetRow))
    });
    expect(result.candidates.map((c) => c.row)).toEqual(['1']);
    expect(result.dropped).toBe(0);
  });

  test('many-to-one: the later pair in the spec wins, whatever the clip order', () => {
    const rowPairs = prepareStringPairs([{ from: 1, to: 2 }, { from: 3, to: 2 }], 4, 4).rowPairs;
    const forward = applyStringMap({ notes: [note(0, 'first'), note(2, 'second')], rowPairs, placeNote: placeAll });
    expect(forward.candidates.map((c) => c.id)).toEqual(['second']);
    expect(forward.collisions).toBe(1);

    const reversedClip = applyStringMap({ notes: [note(2, 'second'), note(0, 'first')], rowPairs, placeNote: placeAll });
    expect(reversedClip.candidates.map((c) => c.id)).toEqual(['second']);
  });

  test('many-to-one only collides when the notes land on the same cell', () => {
    const rowPairs = prepareStringPairs([{ from: 1, to: 2 }, { from: 3, to: 2 }], 4, 4).rowPairs;
    const result = applyStringMap({
      notes: [note(0, 'a', { col: 1 }), note(2, 'b', { col: 5 })],
      rowPairs,
      placeNote: placeAll
    });
    expect(result.candidates.map((c) => c.id)).toEqual(['a', 'b']);
    expect(result.collisions).toBe(0);
  });

  test('candidates from the same pair are never de-duplicated (identity maps behave like no map)', () => {
    const rowPairs = prepareStringPairs([{ from: 1, to: 1 }], 4, 4).rowPairs;
    const result = applyStringMap({
      notes: [note(0, 'a', { col: 2 }), note(0, 'b', { col: 2 })],
      rowPairs,
      placeNote: placeAll
    });
    expect(result.candidates.map((c) => c.id)).toEqual(['a', 'b']);
    expect(result.collisions).toBe(0);
  });

  test('a 4-to-4 reorder map moves each source string to its own destination', () => {
    // lute-style: 1->1, 2->4, 3->2, 4->3
    const pairs = parseMapSpec('1:1, 2:4, 3:2, 4:3').pairs;
    const rowPairs = prepareStringPairs(pairs, 4, 4).rowPairs;
    const notes = [note(0, 's1'), note(1, 's2', { col: 1 }), note(2, 's3', { col: 2 }), note(3, 's4', { col: 3 })];
    const result = applyStringMap({ notes, rowPairs, placeNote: placeAll });
    expect(result.candidates.map((c) => `${c.id}->${Number(c.row) + 1}`)).toEqual(['s1->1', 's2->4', 's3->2', 's4->3']);
  });
});
