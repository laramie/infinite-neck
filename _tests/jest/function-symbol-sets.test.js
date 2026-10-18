import {
    BUILTIN_SETS,
    DEFAULT_SET_ID,
    MAX_USER_SETS,
    getAllSets,
    resolveSet,
    isBuiltInId,
    findBuiltInIdForSymbols,
    findUsage,
    squeezeId,
    userIdFromCaption,
    stripUserCaptionPrefix,
    proposeCaption,
    validateCaption,
    checkSymbolMarkup,
    validateSymbols,
    validateSymbolArray,
    buildPreviewGrid,
    addUserSet,
    updateUserSet,
    deleteUserSet,
    moveUserSet,
    normalizeUserSets,
    computeState
} from '../../templates/function-symbols/functionSymbolSets.js';

const twelve = (prefix = 's') => Array.from({ length: 12 }, (_, i) => `${prefix}${i + 1}`);
const userSet = (id, caption, symbols = twelve()) => ({ id, caption, symbols });

describe('built-in Function Symbols sets', () => {
    test('order, ids and default', () => {
        expect(BUILTIN_SETS.map((set) => set.id)).toEqual([
            'function', 'extensions', 'extensions-only', 'jazz', 'jazz-extensions',
            'function-numbers', 'function-offset', 'function-plus-offset',
            'sounds-like', 'solfege', 'kanji-numerals'
        ]);
        expect(BUILTIN_SETS[0].id).toBe(DEFAULT_SET_ID);
        expect(BUILTIN_SETS[0].caption).toBe('Function');
    });

    test('every built-in passes the same validation Users get, and ids are unique and never u-', () => {
        const ids = new Set();
        BUILTIN_SETS.forEach((set) => {
            expect(validateSymbolArray([...set.symbols])).toMatchObject({ ok: true });
            expect(set.id.startsWith('u-')).toBe(false);
            expect(ids.has(set.id)).toBe(false);
            ids.add(set.id);
        });
    });

    test('built-ins are frozen', () => {
        expect(Object.isFrozen(BUILTIN_SETS)).toBe(true);
        expect(Object.isFrozen(BUILTIN_SETS[0])).toBe(true);
        expect(Object.isFrozen(BUILTIN_SETS[0].symbols)).toBe(true);
    });

    test('findBuiltInIdForSymbols matches only exact arrays', () => {
        expect(findBuiltInIdForSymbols([...BUILTIN_SETS[3].symbols])).toBe('jazz');
        expect(findBuiltInIdForSymbols(twelve())).toBeNull();
        expect(findBuiltInIdForSymbols('nope')).toBeNull();
    });
});

describe('registry', () => {
    const users = [userSet('u-a', 'U: A'), userSet('u-b', 'U: B')];

    test('getAllSets puts built-ins first and keeps user order', () => {
        const all = getAllSets(users);
        expect(all.slice(0, 11).map((set) => set.id)).toEqual(BUILTIN_SETS.map((set) => set.id));
        expect(all.slice(11).map((set) => set.id)).toEqual(['u-a', 'u-b']);
    });

    test('resolveSet: built-in, user, missing', () => {
        expect(resolveSet('jazz', users).caption).toBe('Jazz');
        expect(resolveSet('u-b', users).caption).toBe('U: B');
        expect(resolveSet('u-zzz', users)).toBeNull();
        expect(resolveSet('', users)).toBeNull();
        expect(resolveSet(undefined, users)).toBeNull();
    });

    test('isBuiltInId', () => {
        expect(isBuiltInId('solfege')).toBe(true);
        expect(isBuiltInId('u-a')).toBe(false);
    });

    test('findUsage counts only stored references, 1-based', () => {
        const sections = [
            { displayOptions: { functionSymbols: 'u-a' } },
            {},
            { displayOptions: { functionSymbols: 'jazz' } },
            { displayOptions: { functionSymbols: 'u-a' } }
        ];
        expect(findUsage(sections, 'u-a')).toEqual([1, 4]);
        expect(findUsage(sections, 'u-b')).toEqual([]);
        expect(findUsage(undefined, 'u-a')).toEqual([]);
    });
});

describe('ids and captions', () => {
    test('squeezeId', () => {
        expect(squeezeId('U: Jazz')).toBe('u-jazz');
        expect(squeezeId('  Solfège  Plus!! ')).toBe('solfege-plus');
        expect(squeezeId('a---b__c')).toBe('a-b-c');
        expect(squeezeId('一二三')).toBe('');
    });

    test('userIdFromCaption always starts with u-', () => {
        expect(userIdFromCaption('U: Jazz')).toBe('u-jazz');
        expect(userIdFromCaption('Utopia')).toBe('u-utopia');
        expect(userIdFromCaption('Bebop')).toBe('u-bebop');
        expect(userIdFromCaption('???')).toBe('');
    });

    test('stripUserCaptionPrefix removes exactly one leading "U: "', () => {
        expect(stripUserCaptionPrefix('U: Jazz')).toBe('Jazz');
        expect(stripUserCaptionPrefix('U: U: Jazz')).toBe('U: Jazz');
        expect(stripUserCaptionPrefix('Jazz')).toBe('Jazz');
    });

    test('proposeCaption', () => {
        expect(proposeCaption('Jazz')).toBe('U: Jazz');
        expect(proposeCaption('Extensions (only)')).toBe('U: Extensions (only)');
        expect(proposeCaption('U: Jazz')).toBe('U: Jazz');
        expect(proposeCaption('  Function  ')).toBe('U: Function');
    });

    test('validateCaption: ok case normalizes whitespace and derives the id', () => {
        const result = validateCaption('  U:   My   Set ', getAllSets([]));
        expect(result).toEqual({ ok: true, caption: 'U: My Set', id: 'u-my-set', message: '' });
    });

    test('validateCaption: empty, too long, forbidden chars', () => {
        expect(validateCaption('   ', getAllSets([])).ok).toBe(false);
        expect(validateCaption('x'.repeat(41), getAllSets([])).message).toMatch(/limit is 40/);
        ['a<b', 'a>b', 'a&b', 'a"b', "a'b"].forEach((bad) => {
            expect(validateCaption(bad, getAllSets([])).ok).toBe(false);
        });
    });

    test('validateCaption: duplicate captions are case-insensitive across built-in and user sets', () => {
        const all = getAllSets([userSet('u-a', 'U: A')]);
        expect(validateCaption('jazz', all).ok).toBe(false);
        expect(validateCaption('u: a', all).ok).toBe(false);
        expect(validateCaption('U: Different', all).ok).toBe(true);
    });

    test('validateCaption: id collision and empty id', () => {
        const all = getAllSets([userSet('u-a', 'Alpha')]);
        const clash = validateCaption('U: A', all); // caption differs from "Alpha" but squeezes to u-a
        expect(clash.ok).toBe(false);
        expect(clash.message).toMatch(/u-a/);
        const empty = validateCaption('???', all);
        expect(empty.ok).toBe(false);
        expect(empty.message).toMatch(/letter or digit/);
    });

    test('validateCaption: update mode ignores own caption and keeps the id', () => {
        const all = getAllSets([userSet('u-a', 'Alpha')]);
        const same = validateCaption('Alpha', all, { exceptId: 'u-a', forCreate: false });
        expect(same).toMatchObject({ ok: true, id: 'u-a' });
        const renamed = validateCaption('Totally Different', all, { exceptId: 'u-a', forCreate: false });
        expect(renamed).toMatchObject({ ok: true, id: 'u-a' });
        expect(validateCaption('Jazz', all, { exceptId: 'u-a', forCreate: false }).ok).toBe(false);
    });
});

describe('symbol validation', () => {
    test('accepts valid text and plain arrays', () => {
        const result = validateSymbols(JSON.stringify(twelve()));
        expect(result.ok).toBe(true);
        expect(result.symbols).toEqual(twelve());
    });

    test('rejects non-JSON, non-array, wrong count', () => {
        expect(validateSymbols('{nope').message).toMatch(/Not valid JSON/);
        expect(validateSymbols('{"a":1}').message).toMatch(/array/);
        expect(validateSymbols(JSON.stringify(twelve().slice(0, 11))).message).toBe('11 entries, need 12.');
        expect(validateSymbols(JSON.stringify([...twelve(), 'x'])).message).toBe('13 entries, need 12.');
        expect(validateSymbols('').ok).toBe(false);
        expect(validateSymbols(undefined).ok).toBe(false);
    });

    test('rejects non-string, empty and over-long entries, naming the entry', () => {
        const withNumber = twelve(); withNumber[2] = 3;
        expect(validateSymbols(JSON.stringify(withNumber)).message).toMatch(/Entry 3 is not text/);
        const withEmpty = twelve(); withEmpty[4] = '  ';
        expect(validateSymbols(JSON.stringify(withEmpty)).message).toMatch(/Entry 5 is empty/);
        const withLong = twelve(); withLong[11] = 'x'.repeat(41);
        expect(validateSymbols(JSON.stringify(withLong)).message).toMatch(/Entry 12 is 41 characters/);
    });

    test('markup: whitelist, no attributes, balanced, entities', () => {
        expect(checkSymbolMarkup('I<small>+0</small>')).toBe('');
        expect(checkSymbolMarkup('<em>&flat;</em>2')).toBe('');
        expect(checkSymbolMarkup('&#x4e00;&#9837;')).toBe('');
        expect(checkSymbolMarkup('<b><i>x</i></b>')).toBe('');
        expect(checkSymbolMarkup('<script>alert(1)</script>')).toMatch(/not allowed/);
        expect(checkSymbolMarkup('<img src=x>')).toMatch(/not allowed/);
        expect(checkSymbolMarkup('<small onclick="x()">1</small>')).toMatch(/not allowed/);
        expect(checkSymbolMarkup('<span class="a">1</span>')).toMatch(/not allowed/);
        expect(checkSymbolMarkup('<small>1')).toMatch(/unclosed/);
        expect(checkSymbolMarkup('1</small>')).toMatch(/unbalanced/);
        expect(checkSymbolMarkup('<b><i>x</b></i>')).toMatch(/unbalanced/);
        expect(checkSymbolMarkup('a & b')).toMatch(/stray/);
        expect(checkSymbolMarkup('a > b')).toMatch(/stray/);
        expect(checkSymbolMarkup('a < b')).toMatch(/not allowed/);
        expect(checkSymbolMarkup('a\u0001b')).toMatch(/control/);
    });

    test('a script entry fails the whole array', () => {
        const bad = twelve(); bad[0] = '<script>x</script>';
        const result = validateSymbols(JSON.stringify(bad));
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/Entry 1/);
    });
});

describe('preview grid', () => {
    test('is laid out like a 5-fret guitar: 11,12 / 6-10 / 1-5, blanks at 13-15', () => {
        const grid = buildPreviewGrid(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
        const text = grid.map((row) => row.map((cell) => (cell ? cell.symbol : '')));
        expect(text).toEqual([
            ['11', '12', '', '', ''],
            ['6', '7', '8', '9', '10'],
            ['1', '2', '3', '4', '5']
        ]);
        expect(grid[0][2]).toBeNull();
        expect(grid[0][0].index).toBe(10);
        expect(grid[2][0].index).toBe(0);
    });

    test('tolerates a bad array', () => {
        expect(buildPreviewGrid(null)).toHaveLength(3);
    });
});

describe('user set list operations', () => {
    const base = [userSet('u-a', 'A'), userSet('u-b', 'B'), userSet('u-c', 'C')];

    test('add / update / delete do not mutate the input', () => {
        const added = addUserSet(base, userSet('u-d', 'D'));
        expect(added.map((set) => set.id)).toEqual(['u-a', 'u-b', 'u-c', 'u-d']);
        expect(base).toHaveLength(3);
        const updated = updateUserSet(base, 'u-b', { caption: 'B2', symbols: twelve('z') });
        expect(updated[1]).toMatchObject({ id: 'u-b', caption: 'B2' });
        expect(updated[1].symbols[0]).toBe('z1');
        expect(base[1].caption).toBe('B');
        expect(deleteUserSet(base, 'u-a').map((set) => set.id)).toEqual(['u-b', 'u-c']);
    });

    test('moveUserSet stays inside the list', () => {
        expect(moveUserSet(base, 'u-b', -1).map((set) => set.id)).toEqual(['u-b', 'u-a', 'u-c']);
        expect(moveUserSet(base, 'u-b', 1).map((set) => set.id)).toEqual(['u-a', 'u-c', 'u-b']);
        expect(moveUserSet(base, 'u-a', -1)).toBe(base);
        expect(moveUserSet(base, 'u-c', 1)).toBe(base);
        expect(moveUserSet(base, 'u-zzz', 1)).toBe(base);
    });

    test('normalizeUserSets drops bad entries, built-in ids, duplicates, and caps the count', () => {
        const raw = [
            userSet('u-ok', 'Fine'),
            userSet('jazz', 'Not user id'),
            userSet('u-ok', 'Duplicate id'),
            userSet('u-short', 'Short', twelve().slice(0, 11)),
            userSet('u-script', 'Script', [...twelve().slice(1), '<script>x</script>']),
            userSet('U-Upper', 'Bad id'),
            userSet('u-amp', 'A & B'),
            null,
            'junk'
        ];
        expect(normalizeUserSets(raw).map((set) => set.id)).toEqual(['u-ok']);
        expect(normalizeUserSets(undefined)).toEqual([]);

        const many = Array.from({ length: 30 }, (_, i) => userSet(`u-n${i}`, `N ${i}`));
        expect(normalizeUserSets(many)).toHaveLength(MAX_USER_SETS);
    });
});

describe('computeState', () => {
    const users = [userSet('u-a', 'U: A', twelve('a')), userSet('u-b', 'U: B', twelve('b'))];
    const text = (symbols) => JSON.stringify(symbols);
    const jazz = BUILTIN_SETS[3];

    test('built-in selected: create mode, Save needs a unique valid caption', () => {
        const ok = computeState({ selectedId: 'jazz', userSets: users, draftText: text(jazz.symbols), draftCaption: 'U: Jazz' });
        expect(ok).toMatchObject({ mode: 'create', isBuiltIn: true, canSave: true, idLabel: 'u-jazz', canDelete: false, canMoveUp: false, canMoveDown: false });
        const dup = computeState({ selectedId: 'jazz', userSets: users, draftText: text(jazz.symbols), draftCaption: 'Jazz' });
        expect(dup.canSave).toBe(false);
        expect(dup.captionMessage).toMatch(/already exists/);
    });

    test('invalid draft blocks Save and reports the problem', () => {
        const bad = computeState({ selectedId: 'jazz', userSets: [], draftText: '[1,2', draftCaption: 'U: Jazz' });
        expect(bad.canSave).toBe(false);
        expect(bad.symbolsMessage).toMatch(/Not valid JSON/);
    });

    test('user set selected: update mode, clean draft is not savable, edits are', () => {
        const clean = computeState({ selectedId: 'u-a', userSets: users, draftText: text(users[0].symbols), draftCaption: 'U: A' });
        expect(clean).toMatchObject({ mode: 'update', dirty: false, canSave: false, idLabel: 'u-a' });

        const symbols = [...users[0].symbols]; symbols[0] = 'edited';
        const edited = computeState({ selectedId: 'u-a', userSets: users, draftText: text(symbols), draftCaption: 'U: A' });
        expect(edited).toMatchObject({ dirty: true, canSave: true });

        const renamed = computeState({ selectedId: 'u-a', userSets: users, draftText: text(users[0].symbols), draftCaption: 'Renamed A' });
        expect(renamed).toMatchObject({ dirty: true, canSave: true, idLabel: 'u-a' });

        const clash = computeState({ selectedId: 'u-a', userSets: users, draftText: text(users[0].symbols), draftCaption: 'U: B' });
        expect(clash.canSave).toBe(false);
    });

    test('move and delete rules follow position and usage', () => {
        const first = computeState({ selectedId: 'u-a', userSets: users, draftText: '', draftCaption: '' });
        expect(first).toMatchObject({ canMoveUp: false, canMoveDown: true, canDelete: true });
        const last = computeState({ selectedId: 'u-b', userSets: users, draftText: '', draftCaption: '' });
        expect(last).toMatchObject({ canMoveUp: true, canMoveDown: false });
        const used = computeState({
            selectedId: 'u-a', userSets: users, draftText: '', draftCaption: '',
            sections: [{}, { displayOptions: { functionSymbols: 'u-a' } }]
        });
        expect(used.canDelete).toBe(false);
        expect(used.usageSections).toEqual([2]);
    });

    test('missing selected id behaves like the default built-in', () => {
        const state = computeState({ selectedId: 'u-gone', userSets: users, draftText: '', draftCaption: '' });
        expect(state.isBuiltIn).toBe(true);
        expect(state.selectedId).toBe(DEFAULT_SET_ID);
    });

    test('at the limit, create is blocked', () => {
        const many = Array.from({ length: MAX_USER_SETS }, (_, i) => userSet(`u-n${i}`, `N ${i}`));
        const state = computeState({ selectedId: 'jazz', userSets: many, draftText: text(jazz.symbols), draftCaption: 'U: Jazz' });
        expect(state.canSave).toBe(false);
        expect(state.captionMessage).toMatch(/already has 20/);
    });
});
