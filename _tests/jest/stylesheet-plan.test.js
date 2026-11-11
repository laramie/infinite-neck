import {
    BUILT_IN_ORDER, RESERVED_NAMES, cleanSheetName, freeName, sanitizeColorDicts, resetSystemFlags, setSystemSheetChecked,
    assembleColorDicts, isSystemTicked,
    moveUserSheet, buildRecipe, parseRecipe, recipeKey, applyRecipe, chooseColorDictValue, allLooks,
    describeColorValue, findSheetUsage, findLookUsage, describeUsage, repointReferences,
    createEditor, editorSelect, editorSetPart, editorClearRole, editorLoadEdits, visibleCell, countChanges,
    planSave, planCopy, planRename, describePlan, buildSheetEntry, planSaveLook, describeLookPlan,
    planStylesheetRows, folderSummaryCells, folderLabel, wrapRecipeHtml,
    splitClass, joinClass, userKeys, isUserSheet
} from '../../templates/palette/stylesheetPlan.js';
import {
    SYSTEM_LAYOUT, DEFAULT_LOOK_NAME, systemIds, shippingIds, layoutProblems, folderEntry
} from '../../templates/palette/systemFolders.js';
import { OPTIONAL_SHEETS } from '../../templates/palette/optionalSheets.js';
import { gAllClear, gUserColorDictOEM } from '../../userColors.js';

// Sprint 150 Iteration 3 / Sprint 155: pure model for Stylesheet CRUD (no DOM).
// Layout facts that Sprint 155 may still tune (which folder is exclusive, which optional sheets exist) are NOT pinned on
// the real layout: those tests use the injected TEST_LAYOUT.

const cell = (colorClass) => ({ colorClass, caption: 'c', tiny: 't' });
const user = (dict, checked = true) => ({ readOnly: false, computed: false, checked, dict });
const sysSheets = (layout = SYSTEM_LAYOUT) => {
    const o = {};
    systemIds(layout).forEach((k) => { o[k] = { readOnly: true, computed: false, checked: false, dict: { note1: cell('noteRed1') } }; });
    return o;
};
const dicts = (users = {}) => assembleColorDicts(sysSheets(), users);
const SHIPPING = shippingIds();
const OPTIONAL = systemIds().filter((id) => !SHIPPING.includes(id));
const TEMPLATES = { note1: { caption: 'Tau', tiny: 'T' }, note2: { caption: 'Two', tiny: '2' }, note3: { caption: 'Three', tiny: '3' } };

// S1 always on, S2 on by default, F exclusive, G not exclusive; X, Y, P, Q optional (below the shipping sheets).
const TEST_LAYOUT = [
    { sheet: 'S1', alwaysOn: true },
    { sheet: 'S2', defaultOn: true },
    { folder: 'F', exclusive: true, sheets: [{ id: 'X' }, { id: 'Y' }] },
    { folder: 'G', sheets: [{ id: 'P' }, { id: 'Q' }] }
];
const tdicts = (users = {}) => assembleColorDicts(sysSheets(TEST_LAYOUT), users, TEST_LAYOUT);

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
    test('resetSystemFlags ticks the shipping set only (no carry-over between Songs)', () => {
        const d = dicts();
        setSystemSheetChecked(d, 'Roles', false);
        resetSystemFlags(d);
        BUILT_IN_ORDER.forEach((k) => { expect(d[k].checked).toBe(SHIPPING.includes(k)); });
    });
    test('assembleColorDicts: system sheets in layout order, then user sheets, flags reset', () => {
        const d = tdicts({ u: user({}) });
        expect(Object.keys(d)).toEqual(['S1', 'S2', 'X', 'Y', 'P', 'Q', 'u']);
        expect(['S1', 'S2', 'X', 'Y', 'P', 'Q'].map((k) => d[k].checked)).toEqual([true, true, false, false, false, false]);
    });
    test('system sheets are independent checkboxes; alwaysOn stays on', () => {
        const d = tdicts();
        expect(setSystemSheetChecked(d, 'S2', false, TEST_LAYOUT)).toBe(true);
        expect(d.S2.checked).toBe(false);
        expect(setSystemSheetChecked(d, 'S1', false, TEST_LAYOUT)).toBe(false);
        expect(d.S1.checked).toBe(true);
        expect(isSystemTicked(d, 'S1', TEST_LAYOUT)).toBe(true);
        expect(setSystemSheetChecked(d, 'nope', true, TEST_LAYOUT)).toBe(false);
    });
    test('ticking a sheet in an exclusive folder unticks its siblings; unticking all is allowed', () => {
        const d = tdicts();
        setSystemSheetChecked(d, 'X', true, TEST_LAYOUT);
        setSystemSheetChecked(d, 'Y', true, TEST_LAYOUT);
        expect([d.X.checked, d.Y.checked]).toEqual([false, true]);
        setSystemSheetChecked(d, 'Y', false, TEST_LAYOUT);
        expect([d.X.checked, d.Y.checked]).toEqual([false, false]);
    });
    test('a non-exclusive folder allows several ticks', () => {
        const d = tdicts();
        setSystemSheetChecked(d, 'P', true, TEST_LAYOUT);
        setSystemSheetChecked(d, 'Q', true, TEST_LAYOUT);
        expect([d.P.checked, d.Q.checked]).toEqual([true, true]);
    });
    test('user sheets are untouched by system ticks', () => {
        const d = dicts({ u: user({ note1: cell('noteRed1') }, false) });
        setSystemSheetChecked(d, 'Roles', false);
        expect(d.u.checked).toBe(false);
    });
    test('moveUserSheet moves within the user block and refuses at the ends', () => {
        const d = dicts({ a: user({}), b: user({}), c: user({}) });
        expect(Object.keys(moveUserSheet(d, 'b', -1))).toEqual([...BUILT_IN_ORDER, 'b', 'a', 'c']);
        expect(moveUserSheet(d, 'a', -1)).toBeNull();
        expect(moveUserSheet(d, 'c', 1)).toBeNull();
        expect(moveUserSheet(d, 'Roles', 1)).toBeNull();
    });
    test('isUserSheet guards inherited keys and reserved names', () => {
        const d = dicts({ a: user({}) });
        expect(isUserSheet(d, 'a')).toBe(true);
        expect(isUserSheet(d, 'constructor')).toBe(false);
        expect(isUserSheet(d, 'Roles')).toBe(false);
    });
});

describe('the real layout', () => {
    test('has no layout problems (unique ids, optional sheets below shipping sheets)', () => {
        expect(layoutProblems()).toEqual([]);
    });
    test('layoutProblems finds mistakes in an injected layout', () => {
        const bad = [{ sheet: 'A', defaultOn: true }, { folder: 'F', sheets: [] }, { sheet: 'a' }, { sheet: 'Default' }, { sheet: 'B' }, { sheet: 'C', defaultOn: true }];
        const problems = layoutProblems(bad).join(' | ');
        expect(problems).toContain('duplicate id: a');
        expect(problems).toContain('folder F is empty');
        expect(problems).toContain('name of the Default Look');
        expect(problems).toContain('optional sheet B is above a shipping sheet');
    });
    test('shipping = alwaysOn + defaultOn, all-clear first; reserved names add Default', () => {
        expect(SHIPPING[0]).toBe('All-Clear');
        expect(RESERVED_NAMES).toEqual([...BUILT_IN_ORDER, DEFAULT_LOOK_NAME]);
        expect(shippingIds(TEST_LAYOUT)).toEqual(['S1', 'S2']);
    });
    test('every layout id has data, and every cell is a known role', () => {
        const data = { 'All-Clear': gAllClear, ...OPTIONAL_SHEETS };
        const known = new Set(Object.keys(gUserColorDictOEM.dict));
        expect(Object.keys(OPTIONAL_SHEETS).sort()).toEqual(OPTIONAL.slice().sort());
        expect(OPTIONAL.length).toBeGreaterThan(0);
        OPTIONAL.forEach((id) => {
            const sheet = OPTIONAL_SHEETS[id];
            expect(sheet).toMatchObject({ readOnly: true, computed: false, checked: false });
            Object.entries(sheet.dict).forEach(([k, v]) => {
                expect(known.has(k)).toBe(true);
                expect(typeof v.colorClass).toBe('string');
                expect(v.colorClass).toMatch(/^[A-Za-z0-9_ -]+$/);
            });
        });
        expect(data['All-Clear']).toBeDefined();
    });
    test('the Printing-style sheets that are copies of All-Clear cover every All-Clear role', () => {
        const clearKeys = Object.keys(gAllClear.dict);
        Object.entries(OPTIONAL_SHEETS).filter(([, s]) => Object.keys(s.dict).length === clearKeys.length).forEach(([, s]) => {
            expect(Object.keys(s.dict).sort()).toEqual(clearKeys.slice().sort());
        });
    });
    test('the folders and Default are not sheet names; folder names are free for user sheets', () => {
        const folder = SYSTEM_LAYOUT.find((e) => e.folder);
        expect(folderEntry(folder.folder)).toBe(folder);
        expect(RESERVED_NAMES).not.toContain(folder.folder);
    });
});

describe('recipes', () => {
    const opt = OPTIONAL[0];
    test('buildRecipe: ticked user sheets last-applied first, then the system part; the shipping set is Default', () => {
        const d = dicts({ b: user({}), a: user({}), off: user({}, false) });
        expect(buildRecipe(d)).toBe('a+b+Default');
        setSystemSheetChecked(d, opt, true);
        expect(buildRecipe(d)).toBe(`a+b+${opt}+Default`);
    });
    test('buildRecipe: without the whole shipping set the system sheets are listed, All-Clear included', () => {
        const d = dicts({ a: user({}) });
        setSystemSheetChecked(d, 'Roles', false);
        const expected = ['a', ...SHIPPING.filter((id) => id !== 'Roles').reverse()].join('+');
        expect(buildRecipe(d)).toBe(expected);
        expect(expected).toContain('All-Clear');
        expect(expected).not.toContain('Default');
    });
    test('buildRecipe with expandDefault writes the system sheets out', () => {
        const d = dicts({ a: user({}) });
        expect(buildRecipe(d, { expandDefault: true })).toBe(['a', ...SHIPPING.slice().reverse()].join('+'));
    });
    test('buildRecipe on an injected layout', () => {
        const d = tdicts({ u: user({}) });
        expect(buildRecipe(d, { layout: TEST_LAYOUT })).toBe('u+Default');
        setSystemSheetChecked(d, 'Y', true, TEST_LAYOUT);
        setSystemSheetChecked(d, 'P', true, TEST_LAYOUT);
        expect(buildRecipe(d, { layout: TEST_LAYOUT })).toBe('u+P+Y+Default');
    });
    test('parseRecipe: Default is the shipping set; a bare name means shipping plus that user sheet', () => {
        expect(parseRecipe('Default')).toEqual({ system: SHIPPING, users: [] });
        expect(parseRecipe('user')).toEqual({ system: SHIPPING, users: ['user'] });
        expect(parseRecipe('x+y+x+Default')).toEqual({ system: SHIPPING, users: ['x', 'y'] });
        expect(parseRecipe('')).toEqual({ system: null, users: [] });
    });
    test('parseRecipe: a system token names only that sheet (All-Clear is always there), matched case-insensitively, in layout order', () => {
        expect(parseRecipe('roles').system).toEqual(['All-Clear', 'Roles']);
        expect(parseRecipe(`${opt}+Roles`).system).toEqual(systemIds().filter((id) => id === 'All-Clear' || id === 'Roles' || id === opt));
        expect(parseRecipe(`b+a+${opt}+Default`)).toEqual({ system: systemIds().filter((id) => SHIPPING.includes(id) || id === opt), users: ['b', 'a'] });
    });
    test('parseRecipe on an injected layout', () => {
        expect(parseRecipe('X', TEST_LAYOUT)).toEqual({ system: ['S1', 'X'], users: [] });
        expect(parseRecipe('u+Default+Y', TEST_LAYOUT)).toEqual({ system: ['S1', 'S2', 'Y'], users: ['u'] });
    });
    test('recipeKey ignores token order and spells Default out', () => {
        expect(recipeKey('b+a+Default')).toBe(recipeKey('Default+a+b'));
        expect(recipeKey('Default')).toBe(recipeKey(SHIPPING.slice().reverse().join('+')));
        expect(recipeKey('Default')).not.toBe(recipeKey('Roles'));
        expect(recipeKey('')).toBe('');
    });
    test('round trip: a ticked set rebuilt from its own recipe is the same set', () => {
        const d = dicts({ a: user({}), b: user({}) });
        setSystemSheetChecked(d, opt, true);
        setSystemSheetChecked(d, 'Fingerings', false);
        const recipe = buildRecipe(d);
        const e = dicts({ a: user({}, false), b: user({}, false) });
        applyRecipe(e, recipe);
        expect(buildRecipe(e)).toBe(recipe);
        expect(recipeKey(recipe)).toBe(recipeKey(buildRecipe(e)));
    });
    test('applyRecipe sets flags absolutely, does not reorder, reports missing', () => {
        const d = dicts({ a: user({}), b: user({}) });
        const res = applyRecipe(d, 'Fingerings+b+gone');
        expect(res.missing).toEqual(['gone']);
        expect(d.a.checked).toBe(false);
        expect(d.b.checked).toBe(true);
        expect(d.Fingerings.checked).toBe(true);
        expect(d['All-Clear'].checked).toBe(true);
        expect(d.Roles.checked).toBe(false);
        expect(d.Highlights.checked).toBe(false);
        expect(Object.keys(d).slice(-2)).toEqual(['a', 'b']);
    });
    test('applyRecipe resolves a Look name and the Default Look', () => {
        const d = dicts({ a: user({}) });
        applyRecipe(d, 'Pretty', { Pretty: 'Roles+a' });
        expect(buildRecipe(d)).toBe('a+Roles+All-Clear');
        applyRecipe(d, 'Default');
        expect(buildRecipe(d)).toBe('Default');
    });
    test('chooseColorDictValue keeps legacy spelling, else a Look, else the recipe', () => {
        const d = dicts({ user: user({}) });
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'user' })).toBe('user');
        expect(chooseColorDictValue({ colorDicts: d, preferred: '' })).toBe('user+Default');
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'Default' })).toBe('user+Default');
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'old', colorLooks: { Mine: 'user+Default' } })).toBe('Mine');
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'Mine', colorLooks: { Mine: 'user+Default' } })).toBe('Mine');
    });
    test('chooseColorDictValue returns the Default Look for the shipping set', () => {
        const d = dicts();
        expect(chooseColorDictValue({ colorDicts: d, preferred: '' })).toBe('Default');
        const explicit = SHIPPING.slice().reverse().join('+');
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'x', colorLooks: { Same: explicit } })).toBe('Default');
    });
    test('chooseColorDictValue keepMissing keeps a Section value whose sheet is gone', () => {
        const d = dicts({ user: user({}) });
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'mojo' })).toBe('user+Default');
        expect(chooseColorDictValue({ colorDicts: d, preferred: 'mojo', keepMissing: true })).toBe('mojo');
    });
    test('describeColorValue lists missing members and is unknown without colorDicts', () => {
        const song = { colorDicts: dicts({ a: user({}) }), colorLooks: { L: 'a+Default+zz' } };
        expect(describeColorValue(song, 'a')).toEqual({ status: 'ok', missing: [], kind: 'recipe' });
        expect(describeColorValue(song, 'Default')).toEqual({ status: 'ok', missing: [], kind: 'look' });
        expect(describeColorValue(song, 'gone').missing).toEqual(['gone']);
        expect(describeColorValue(song, 'L')).toMatchObject({ status: 'missing', missing: ['zz'], kind: 'look' });
        expect(describeColorValue(song, '').status).toBe('ok');
        expect(describeColorValue({}, 'x').status).toBe('unknown');
    });
});

describe('Looks table', () => {
    test('allLooks puts Default first, as the shipping set, and drops a stored Look named Default', () => {
        const looks = allLooks({ colorLooks: { Mine: 'a+Default', default: 'x' } });
        expect(Object.keys(looks)).toEqual(['Default', 'Mine']);
        expect(parseRecipe(looks.Default).system).toEqual(SHIPPING);
        expect(Object.keys(allLooks({}))).toEqual(['Default']);
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
    test('planSaveLook records the expanded recipe and blocks sheet names, including Default', () => {
        const d = dicts({ a: user({}) });
        const expanded = ['a', ...SHIPPING.slice().reverse()].join('+');
        const plan = planSaveLook({ rawName: 'Pretty look', colorDicts: d });
        expect(plan).toMatchObject({ ok: true, action: 'create', name: 'Pretty-look', recipe: expanded });
        expect(describeLookPlan(plan)).toBe(`Name cleaned to "Pretty-look". Saves Look "Pretty-look" = ${expanded}`);
        expect(planSaveLook({ rawName: 'a', colorDicts: d })).toMatchObject({ blocked: 'name-taken' });
        expect(planSaveLook({ rawName: 'Default', colorDicts: d })).toMatchObject({ blocked: 'name-taken' });
        expect(planSaveLook({ rawName: 'default', colorDicts: d })).toMatchObject({ blocked: 'name-taken' });
        expect(planSaveLook({ rawName: 'P', colorDicts: d, colorLooks: { P: expanded } })).toMatchObject({ blocked: 'no-change' });
        expect(planSaveLook({ rawName: '', colorDicts: d })).toMatchObject({ blocked: 'empty' });
    });
});

describe('table rows, folder summary and label', () => {
    const names = (rows) => rows.map((r) => (r.kind === 'folder' ? `[${r.name}]` : r.id));
    test('order: system layout (folder children only when open), then the user sheets as a flat list', () => {
        const d = tdicts({ u1: user({}), u2: user({}, false) });
        expect(names(planStylesheetRows(d, { layout: TEST_LAYOUT }))).toEqual(['S1', 'S2', '[F]', '[G]', 'u1', 'u2']);
        const open = planStylesheetRows(d, { layout: TEST_LAYOUT, openFolders: new Set(['F']) });
        expect(names(open)).toEqual(['S1', 'S2', '[F]', 'X', 'Y', '[G]', 'u1', 'u2']);
        expect(open.filter((r) => r.folder === 'F').map((r) => r.id)).toEqual(['X', 'Y']);
    });
    test('user sheets are never in a folder and carry their position for the arrow buttons', () => {
        const rows = planStylesheetRows(tdicts({ u1: user({}), u2: user({}) }), { layout: TEST_LAYOUT });
        const users = rows.filter((r) => r.kind === 'sheet' && !r.system);
        expect(users.map((r) => [r.id, r.folder, r.userIndex, r.userCount])).toEqual([['u1', null, 0, 2], ['u2', null, 1, 2]]);
    });
    test('showColors: ticked rows, or every row when All is on; alwaysOn is ticked', () => {
        const d = tdicts({ u: user({}, false) });
        const rows = (showAll) => planStylesheetRows(d, { layout: TEST_LAYOUT, openFolders: new Set(['F']), showAll });
        const flags = (rs) => Object.fromEntries(rs.filter((r) => r.kind === 'sheet').map((r) => [r.id, r.showColors]));
        expect(flags(rows(false))).toEqual({ S1: true, S2: true, X: false, Y: false, u: false });
        expect(flags(rows(true))).toEqual({ S1: true, S2: true, X: true, Y: true, u: true });
        expect(rows(false)[0]).toMatchObject({ id: 'S1', alwaysOn: true, checked: true });
    });
    test('a folder row lists its ticked sheets, ignores All, and shows its label', () => {
        const d = tdicts();
        setSystemSheetChecked(d, 'Y', true, TEST_LAYOUT);
        const folder = planStylesheetRows(d, { layout: TEST_LAYOUT, showAll: true }).find((r) => r.kind === 'folder' && r.name === 'F');
        expect(folder).toMatchObject({ open: false, ids: ['X', 'Y'], ticked: ['Y'], summaryIds: ['Y'], label: 'F : Y' });
        const none = planStylesheetRows(d, { layout: TEST_LAYOUT }).find((r) => r.name === 'G');
        expect(none).toMatchObject({ ticked: [], label: 'G' });
    });
    test('folderLabel lists ticked sheets in precedence order (last-applied first)', () => {
        expect(folderLabel('G', ['P', 'Q'])).toBe('G : Q+P');
        expect(folderLabel('G', [])).toBe('G');
    });
    test('folderSummaryCells merges the ticked sheets in order, the last winning', () => {
        const d = tdicts();
        d.P.dict = { note1: cell('noteRed1'), note2: cell('noteRed2') };
        d.Q.dict = { note2: cell('noteBlue2'), note3: { colorClass: 'noteBlue3', readonly: true } };
        const cells = folderSummaryCells(d, ['P', 'Q']);
        expect(Object.keys(cells)).toEqual(['note1', 'note2']);
        expect(cells.note2.colorClass).toBe('noteBlue2');
        expect(folderSummaryCells(d, [])).toEqual({});
    });
    test('wrapRecipeHtml', () => {
        expect(wrapRecipeHtml('b+a+Default')).toBe('b+<wbr>a+<wbr>Default');
        expect(wrapRecipeHtml('a&b')).toBe('a&amp;b');
    });
});

describe('Song open sequence has no carry-over', () => {
    test('open Song A, untick Roles, open Song B: the shipping set is ticked again', () => {
        const open = (users) => assembleColorDicts(sysSheets(), sanitizeColorDicts(Object.entries(users)).dicts);
        const a = open({});
        setSystemSheetChecked(a, 'Roles', false);
        const b = open({ u: user({ note1: cell('noteRed1') }) });
        expect(userKeys(b)).toEqual(['u']);
        expect(buildRecipe(b)).toBe('u+Default');
    });
    test('a user sheet named like a system sheet or Default is renamed', () => {
        const { dicts: out } = sanitizeColorDicts([
            [OPTIONAL[0], user({ note1: cell('noteRed1') })],
            ['default', user({ note1: cell('noteRed1') })]
        ]);
        expect(Object.keys(out)).toEqual([`${OPTIONAL[0]}-user`, 'default-user']);
    });
});
