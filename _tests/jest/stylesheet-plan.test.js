import {
    BUILT_IN_ORDER, cleanSheetName, freeName, sanitizeColorDicts, resetBuiltInFlags, setBuiltInLevel,
    moveUserSheet, buildRecipe, parseRecipe, recipeKey, applyRecipe, chooseColorDictValue,
    describeColorValue, findSheetUsage, findLookUsage, describeUsage, repointReferences,
    createEditor, editorSelect, editorSetPart, editorClearRole, editorLoadEdits, visibleCell, countChanges,
    planSave, planCopy, planRename, describePlan, buildSheetEntry, planSaveLook, describeLookPlan,
    splitClass, joinClass, userKeys, isUserSheet
} from '../../templates/palette/stylesheetPlan.js';

// Sprint 150 Iteration 3: pure model for Stylesheet CRUD (no DOM).

const cell = (colorClass) => ({ colorClass, caption: 'c', tiny: 't' });
const user = (dict, checked = true) => ({ readOnly: false, computed: false, checked, dict });
const builtins = () => {
    const o = {};
    BUILT_IN_ORDER.forEach((k) => { o[k] = { readOnly: k !== 'Default', computed: k === 'Default', checked: true, dict: { note1: cell('noteRed1') } }; });
    return o;
};
const dicts = (users = {}) => ({ ...builtins(), ...users });
const TEMPLATES = { note1: { caption: 'Tau', tiny: 'T' }, note2: { caption: 'Two', tiny: '2' }, note3: { caption: 'Three', tiny: '3' } };

describe('names', () => {
    test('cleanSheetName', () => {
        expect(cleanSheetName('  my sheet!  ')).toEqual({ name: 'my-sheet', changed: true });
        expect(cleanSheetName('ok-name')).toEqual({ name: 'ok-name', changed: false });
        expect(cleanSheetName('<img src=x>').name).toBe('img-src-x');
        expect(cleanSheetName('   ').name).toBe('');
        expect(cleanSheetName('123').name).toBe('sheet-123');
        expect(cleanSheetName('a'.repeat(80)).name.length).toBe(40);
    });
    test('freeName increments a trailing number, case-insensitively', () => {
        expect(freeName('Foo', [])).toBe('Foo');
        expect(freeName('Foo', ['foo'])).toBe('Foo2');
        expect(freeName('Fingerings-user', ['Fingerings-user'])).toBe('Fingerings-user2');
        expect(freeName('x2', ['x2', 'x3'])).toBe('x4');
    });
});

describe('sanitizeColorDicts', () => {
    test('cleans, dedupes and avoids built-in names', () => {
        const { dicts: out, renames } = sanitizeColorDicts([
            ['my sheet', user({ note1: cell('noteRed1') })],
            ['my-sheet', user({ note1: cell('noteRed2') })],
            ['Default', user({ note1: cell('noteRed3') })],
            ['', user({ note1: cell('noteRed4') })]
        ]);
        expect(Object.keys(out)).toEqual(['my-sheet', 'my-sheet2', 'Default-user', 'user']);
        expect(renames.map((r) => r.from)).toEqual(['my sheet', 'my-sheet', 'Default', '']);
    });
    test('drops unsafe classes, unknown roles and non-sheets', () => {
        const known = new Set(['note1', 'note2']);
        const { dicts: out, renames } = sanitizeColorDicts([
            ['a', user({ note1: cell('noteRed1'), note2: cell('"><script>'), note9: cell('noteRed1'), bogus: cell('x') })],
            ['b', null]
        ], { knownRoles: known });
        expect(Object.keys(out)).toEqual(['a']);
        expect(Object.keys(out.a.dict)).toEqual(['note1']);
        expect(renames).toEqual([{ from: 'b', to: null, reason: 'dropped: not a stylesheet' }]);
    });
    test('keeps the saved checked flag', () => {
        const { dicts: out } = sanitizeColorDicts([['a', user({ note1: cell('noteRed1') }, false)]]);
        expect(out.a.checked).toBe(false);
    });
});

describe('flags and order', () => {
    test('resetBuiltInFlags ticks every built-in (no carry-over between Songs)', () => {
        const d = dicts();
        setBuiltInLevel(d, 'All-Clear');
        resetBuiltInFlags(d);
        expect(BUILT_IN_ORDER.every((k) => d[k].checked)).toBe(true);
    });
    test('setBuiltInLevel ticks up to the level and leaves user flags alone', () => {
        const d = dicts({ u: user({ note1: cell('noteRed1') }, false) });
        expect(setBuiltInLevel(d, 'Roles')).toBe(true);
        expect(BUILT_IN_ORDER.map((k) => d[k].checked)).toEqual([true, true, true, false, false, false]);
        expect(d.u.checked).toBe(false);
        expect(setBuiltInLevel(d, 'nope')).toBe(false);
    });
    test('moveUserSheet moves within the user block and refuses at the ends', () => {
        const d = dicts({ a: user({}), b: user({}), c: user({}) });
        expect(Object.keys(moveUserSheet(d, 'b', -1))).toEqual([...BUILT_IN_ORDER, 'b', 'a', 'c']);
        expect(moveUserSheet(d, 'a', -1)).toBeNull();
        expect(moveUserSheet(d, 'c', 1)).toBeNull();
        expect(moveUserSheet(d, 'Roles', 1)).toBeNull();
    });
    test('isUserSheet guards inherited keys', () => {
        const d = dicts({ a: user({}) });
        expect(isUserSheet(d, 'a')).toBe(true);
        expect(isUserSheet(d, 'constructor')).toBe(false);
        expect(isUserSheet(d, 'Roles')).toBe(false);
    });
});

describe('recipes', () => {
    test('buildRecipe: highest ticked built-in plus ticked user sheets in list order', () => {
        const d = dicts({ b: user({}), a: user({}), off: user({}, false) });
        expect(buildRecipe(d)).toBe('Default+b+a');
        setBuiltInLevel(d, 'Fingerings');
        expect(buildRecipe(d)).toBe('Fingerings+b+a');
    });
    test('parseRecipe handles legacy single names and Default', () => {
        expect(parseRecipe('Default')).toEqual({ level: 'Default', users: [] });
        expect(parseRecipe('user')).toEqual({ level: 'Default', users: ['user'] });
        expect(parseRecipe('Fingerings+x+y+x')).toEqual({ level: 'Fingerings', users: ['x', 'y'] });
        expect(parseRecipe('')).toEqual({ level: null, users: [] });
        expect(recipeKey('Default+b+a')).toBe(recipeKey('Default+a+b'));
    });
    test('applyRecipe sets flags absolutely, does not reorder, reports missing', () => {
        const d = dicts({ a: user({}), b: user({}) });
        const res = applyRecipe(d, 'Fingerings+b+gone');
        expect(res.missing).toEqual(['gone']);
        expect(d.a.checked).toBe(false);
        expect(d.b.checked).toBe(true);
        expect(d.Fingerings.checked).toBe(true);
        expect(d.Highlights.checked).toBe(false);
        expect(Object.keys(d).slice(-2)).toEqual(['a', 'b']);
    });
    test('applyRecipe resolves a Look name', () => {
        const d = dicts({ a: user({}) });
        applyRecipe(d, 'Pretty', { Pretty: 'Roles+a' });
        expect(buildRecipe(d)).toBe('Roles+a');
    });
    test('chooseColorDictValue keeps legacy spelling, else a Look, else the recipe', () => {
        const d = dicts({ user: user({}) });
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'user' })).toBe('user');
        expect(chooseColorDictValue({ colorDicts: d, preferred: '' })).toBe('Default+user');
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'Default' })).toBe('Default+user');
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'old', colorLooks: { Mine: 'Default+user' } })).toBe('Mine');
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'Mine', colorLooks: { Mine: 'Default+user' } })).toBe('Mine');
    });
    test('chooseColorDictValue keepMissing keeps a Section value whose sheet is gone', () => {
        const d = dicts({ user: user({}) });
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'mojo' })).toBe('Default+user');
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'mojo', keepMissing: true })).toBe('mojo');
    });
    test('describeColorValue lists missing members and is unknown without colorDicts', () => {
        const song = { colorDicts: dicts({ a: user({}) }), colorLooks: { L: 'Default+a+zz' } };
        expect(describeColorValue(song, 'a')).toEqual({ status: 'ok', missing: [], kind: 'recipe' });
        expect(describeColorValue(song, 'gone').missing).toEqual(['gone']);
        expect(describeColorValue(song, 'L')).toMatchObject({ status: 'missing', missing: ['zz'], kind: 'look' });
        expect(describeColorValue(song, '').status).toBe('ok');
        expect(describeColorValue({}, 'x').status).toBe('unknown');
    });
});

describe('usage and rename', () => {
    const mk = () => ({
        colorDicts: dicts({ a: user({}) }),
        colorLooks: { L: 'Default+a' },
        currentColorDict: 'a',
        activeStylesheets: 'Default+a',
        displayOptionsDefault: { currentColorDict: 'L' },
        sections: [{ displayOptions: { currentColorDict: 'a' } }, { displayOptions: {} }, { displayOptions: { currentColorDict: 'Roles+a' } }]
    });
    test('findSheetUsage and describeUsage', () => {
        const u = findSheetUsage(mk(), 'a');
        expect(u).toEqual({ sections: [1, 3], defaults: true, looks: ['L'] });
        expect(describeUsage(u)).toBe('Sections 1, 3; Song DEFAULTS; Look L');
        expect(findLookUsage(mk(), 'L')).toEqual({ sections: [], defaults: true });
    });
    test('repointReferences rewrites Sections, DEFAULTS, Looks and the Song values; Look names stay', () => {
        const song = mk();
        const n = repointReferences(song, 'a', 'b');
        expect(n).toBe(5);
        expect(song.sections[0].displayOptions.currentColorDict).toBe('b');
        expect(song.sections[2].displayOptions.currentColorDict).toBe('Roles+b');
        expect(song.displayOptionsDefault.currentColorDict).toBe('L');
        expect(song.colorLooks.L).toBe('Default+b');
        expect(song.activeStylesheets).toBe('Default+b');
        expect(song.currentColorDict).toBe('b');
    });
});

describe('editor state', () => {
    test('splitClass / joinClass', () => {
        expect(splitClass('noteBlack noteHatchedRoot')).toEqual({ color: 'noteBlack', hatch: 'noteHatchedRoot' });
        expect(joinClass({ color: 'noteBlue2', hatch: '' })).toBe('noteBlue2');
    });
    test('cell statuses: blank, saved, edited, removed', () => {
        const d = dicts({ u: user({ note1: cell('noteRed1'), note2: cell('noteBlue2') }) });
        const ed = editorSelect(createEditor(), d, 'u');
        expect(ed.sourceKind).toBe('user');
        expect(visibleCell(ed, 'note1').status).toBe('saved');
        expect(visibleCell(ed, 'note3').status).toBe('blank');
        editorSetPart(ed, 'note1', 'color', 'noteGreen1');
        expect(visibleCell(ed, 'note1')).toMatchObject({ color: 'noteGreen1', status: 'edited' });
        editorSetPart(ed, 'note3', 'hatch', 'noteHatched2');
        expect(visibleCell(ed, 'note3')).toMatchObject({ hatch: 'noteHatched2', status: 'edited' });
        editorClearRole(ed, 'note2');
        expect(visibleCell(ed, 'note2').status).toBe('removed');
        expect(countChanges(ed)).toEqual({ changed: 2, removed: 1 });
        editorSetPart(ed, 'note1', 'color', 'noteRed1');
        expect(visibleCell(ed, 'note1').status).toBe('saved');
    });
    test('none (empty part) on a hatch-only cell removes it; picking back the original reverts', () => {
        const d = dicts({ u: user({ note1: cell('noteHatched3') }) });
        const ed = editorSelect(createEditor(), d, 'u');
        editorSetPart(ed, 'note1', 'hatch', '');
        expect(visibleCell(ed, 'note1').status).toBe('removed');
        editorSetPart(ed, 'note1', 'hatch', 'noteHatched3');
        expect(visibleCell(ed, 'note1').status).toBe('saved');
    });
    test('a built-in source shows inherited cells; clearing there is a no-op', () => {
        const ed = editorSelect(createEditor(), dicts(), 'Fingerings');
        expect(ed.sourceKind).toBe('builtin');
        expect(visibleCell(ed, 'note1').status).toBe('inherited');
        editorClearRole(ed, 'note1');
        expect(visibleCell(ed, 'note1').status).toBe('inherited');
    });
    test('editorLoadEdits keeps only differences', () => {
        const d = dicts({ u: user({ note1: cell('noteRed1') }) });
        const ed = editorSelect(createEditor(), d, 'u');
        editorLoadEdits(ed, { note1: { color: 'noteRed1', hatch: '' }, note2: { color: 'noteBlue2', hatch: '' } });
        expect(Object.keys(ed.edits)).toEqual(['note2']);
    });
});

describe('planSave / planCopy / planRename', () => {
    test('new sheet from a blank editor', () => {
        const d = dicts();
        const ed = editorSelect(createEditor(), d, '');
        expect(planSave(ed, { rawName: 'foo', colorDicts: d })).toMatchObject({ ok: false, blocked: 'empty' });
        editorSetPart(ed, 'note1', 'color', 'noteRed1');
        editorSetPart(ed, 'note2', 'color', 'noteBlue2');
        const plan = planSave(ed, { rawName: 'foo bar', colorDicts: d });
        expect(plan).toMatchObject({ ok: true, action: 'create', name: 'foo-bar', count: 2, nameNote: 'cleaned' });
        expect(describePlan(plan)).toBe('Name cleaned to "foo-bar". New sheet "foo-bar" with 2 colors.');
        const entry = buildSheetEntry(plan, TEMPLATES);
        expect(entry.dict.note1).toEqual({ caption: 'Tau', tiny: 'T', colorClass: 'noteRed1' });
        expect(entry).toMatchObject({ readOnly: false, computed: false, checked: true });
    });
    test('built-in name saves as <name>-user and a built-in source writes only the changed cells', () => {
        const d = dicts();
        const ed = editorSelect(createEditor(), d, 'Fingerings');
        editorSetPart(ed, 'note2', 'color', 'noteBlue2');
        const plan = planSave(ed, { rawName: 'Fingerings', colorDicts: d });
        expect(plan).toMatchObject({ ok: true, action: 'create', name: 'Fingerings-user', count: 1, fromBuiltIn: 'Fingerings' });
        expect(Object.keys(plan.cells)).toEqual(['note2']);
        expect(describePlan(plan)).toContain('starts from Fingerings: Save writes only the 1 cell you changed');
    });
    test('update merges, counts, and blocks when nothing changed', () => {
        const d = dicts({ u: user({ note1: cell('noteRed1'), note2: cell('noteBlue2') }) });
        const ed = editorSelect(createEditor(), d, 'u');
        expect(planSave(ed, { rawName: 'u', colorDicts: d })).toMatchObject({ ok: false, blocked: 'no-change' });
        editorSetPart(ed, 'note1', 'color', 'noteGreen1');
        editorClearRole(ed, 'note2');
        const plan = planSave(ed, { rawName: 'u', colorDicts: d });
        expect(plan).toMatchObject({ ok: true, action: 'update', name: 'u', changed: 1, removed: 1 });
        expect(describePlan(plan)).toBe('Updates "u": 1 changed, 1 removed. The previous version goes to the Graveyard.');
        editorClearRole(ed, 'note1');
        editorSetPart(ed, 'note1', 'color', '');
        expect(planSave(ed, { rawName: 'u', colorDicts: d })).toMatchObject({ blocked: 'would-be-empty' });
    });
    test('saving under another existing name merges into it; a Look name blocks', () => {
        const d = dicts({ u: user({ note1: cell('noteRed1') }), v: user({ note2: cell('noteBlue2') }) });
        const ed = editorSelect(createEditor(), d, 'u');
        const plan = planSave(ed, { rawName: 'v', colorDicts: d });
        expect(plan).toMatchObject({ ok: true, action: 'update', name: 'v' });
        expect(Object.keys(plan.cells).sort()).toEqual(['note1', 'note2']);
        expect(planSave(ed, { rawName: 'L', colorDicts: d, colorLooks: { L: 'Default' } })).toMatchObject({ blocked: 'name-is-look' });
    });
    test('empty name becomes a free "user" name', () => {
        const d = dicts({ user: user({ note1: cell('noteRed1') }) });
        const ed = editorSelect(createEditor(), d, '');
        editorSetPart(ed, 'note1', 'color', 'noteRed2');
        expect(planSave(ed, { rawName: '  ', colorDicts: d })).toMatchObject({ name: 'user2', nameNote: 'empty' });
    });
    test('planCopy writes the full visible cells to a free name', () => {
        const d = dicts({ u: user({ note1: cell('noteRed1') }) });
        const ed = editorSelect(createEditor(), d, 'u');
        editorSetPart(ed, 'note2', 'color', 'noteBlue2');
        expect(planCopy(ed, { colorDicts: d })).toMatchObject({ ok: true, name: 'u-copy', count: 2 });
        const d2 = dicts({ 'u-copy': user({}) });
        expect(planCopy(ed, { colorDicts: d2 }).name).toBe('u-copy2');
        const eb = editorSelect(createEditor(), d, 'Roles');
        expect(planCopy(eb, { colorDicts: d }).name).toBe('Roles-user');
    });
    test('planRename', () => {
        const d = dicts({ a: user({}), b: user({}) });
        expect(planRename('a', 'c', { colorDicts: d })).toMatchObject({ ok: true, from: 'a', name: 'c' });
        expect(planRename('a', 'b', { colorDicts: d })).toMatchObject({ blocked: 'name-taken' });
        expect(planRename('a', 'Roles', { colorDicts: d })).toMatchObject({ blocked: 'name-taken' });
        expect(planRename('a', 'a', { colorDicts: d })).toMatchObject({ blocked: 'no-change' });
        expect(planRename('Roles', 'x', { colorDicts: d })).toMatchObject({ blocked: 'not-user-sheet' });
    });
});

describe('Looks', () => {
    test('planSaveLook records the current recipe and blocks sheet names', () => {
        const d = dicts({ a: user({}) });
        const plan = planSaveLook({ rawName: 'Pretty look', colorDicts: d });
        expect(plan).toMatchObject({ ok: true, action: 'create', name: 'Pretty-look', recipe: 'Default+a' });
        expect(describeLookPlan(plan)).toBe('Name cleaned to "Pretty-look". Saves Look "Pretty-look" = Default+a');
        expect(planSaveLook({ rawName: 'a', colorDicts: d })).toMatchObject({ blocked: 'name-taken' });
        expect(planSaveLook({ rawName: 'P', colorDicts: d, colorLooks: { P: 'Default+a' } })).toMatchObject({ blocked: 'no-change' });
        expect(planSaveLook({ rawName: '', colorDicts: d })).toMatchObject({ blocked: 'empty' });
    });
});

describe('Song open sequence has no carry-over', () => {
    test('open Song A, click All-Clear, open Song B: built-ins are ticked again', () => {
        const open = (users) => resetBuiltInFlags({ ...builtins(), ...sanitizeColorDicts(Object.entries(users)).dicts });
        const a = open({});
        setBuiltInLevel(a, 'All-Clear');
        const b = open({ u: user({ note1: cell('noteRed1') }) });
        expect(userKeys(b)).toEqual(['u']);
        expect(buildRecipe(b)).toBe('Default+u');
    });
});
