import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    setupSongTests,
    getSong,
    installDefaultColorDicts
} from '../../infinite-neck-headless.js';
import { applyStylesheetsTo_gUserColorDict } from '../../colorFunctions.js';
import { gUserColorDict, gUserColorDictOEM } from '../../userColors.js';
import { Song } from '../../Song.js';
import { buildSectionRowHtml, buildMatrixHtml } from '../../templates/display-options/displayOptionsMatrixView.js';
import { setBuiltInLevel, buildRecipe } from '../../templates/palette/stylesheetPlan.js';
import { validateSongFileSchema } from '../../bin/song-file-schema.js';

// Sprint 150 Iteration 3: Song open/open carry-over, rename repointing, the live dict rebuild, the Matrix strike-through,
// and the glyph/height CSS contract.  Non-browser (no JSDom).

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const sheet = (colorClass, checked = true) => ({ readOnly: false, computed: false, checked, dict: { note1: { colorClass, caption: 'Tau', tiny: 'T' } } });

describe('installDefaultColorDicts (Song open)', () => {
    beforeEach(() => { setupSongTests(); });

    test('a built-in level chosen in an earlier Song does not carry over', () => {
        const song = getSong();
        song.colorDicts = { a: sheet('noteRed1') };
        installDefaultColorDicts();
        setBuiltInLevel(song.colorDicts, 'All-Clear');
        expect(song.colorDicts.Default.checked).toBe(false);

        const next = getSong();
        next.colorDicts = { b: sheet('noteBlue2', false) };
        installDefaultColorDicts();
        expect(['All-Clear', 'CycleOfColors', 'Roles', 'Fingerings', 'Highlights', 'Default'].every((k) => next.colorDicts[k].checked)).toBe(true);
        expect(next.colorDicts.b.checked).toBe(false);
        expect(buildRecipe(next.colorDicts)).toBe('Default');
    });

    test('bad names are cleaned and Section references are repointed', () => {
        const song = getSong();
        song.colorDicts = { 'my sheet': sheet('noteRed1'), 'Default': sheet('noteRed2') };
        song.sections[0].displayOptions = { currentColorDict: 'my sheet' };
        installDefaultColorDicts();
        expect(Object.keys(song.colorDicts).slice(-2)).toEqual(['my-sheet', 'Default-user']);
        expect(song.sections[0].displayOptions.currentColorDict).toBe('my-sheet');
    });

    test('unsafe classes and unknown roles are dropped on open', () => {
        const song = getSong();
        song.colorDicts = {
            x: { readOnly: false, computed: false, checked: true, dict: {
                note1: { colorClass: 'noteRed1' },
                note2: { colorClass: '"><img src=x onerror=alert(1)>' },
                bogus: { colorClass: 'noteRed1' }
            } }
        };
        installDefaultColorDicts();
        expect(Object.keys(song.colorDicts.x.dict)).toEqual(['note1']);
    });
});

describe('applyStylesheetsTo_gUserColorDict rebuilds from the OEM base', () => {
    beforeEach(() => { setupSongTests(); });

    test('unticking a sheet restores the underlying color (no leftovers)', () => {
        const song = getSong();
        song.colorDicts = { a: sheet('noteGreen3') };
        installDefaultColorDicts();
        applyStylesheetsTo_gUserColorDict();
        expect(gUserColorDict.dict.note1.colorClass).toBe('noteGreen3');
        song.colorDicts.a.checked = false;
        applyStylesheetsTo_gUserColorDict();
        expect(gUserColorDict.dict.note1.colorClass).toBe(gUserColorDictOEM.dict.note1.colorClass);
    });

    test('later sheets win and the order is the list order', () => {
        const song = getSong();
        song.colorDicts = { a: sheet('noteGreen3'), b: sheet('noteBlue3') };
        installDefaultColorDicts();
        applyStylesheetsTo_gUserColorDict();
        expect(gUserColorDict.dict.note1.colorClass).toBe('noteBlue3');
    });
});

describe('Matrix: a Color value naming a missing stylesheet is struck through', () => {
    const mk = (colorDicts, value, extra = {}) => {
        const song = new Song({ sections: [{ displayOptions: { currentColorDict: value } }], ...extra });
        song.setHeadless(true, true);
        if (colorDicts) song.colorDicts = colorDicts;
        return song;
    };
    const built = (users = {}) => ({ 'All-Clear': { readOnly: true, dict: {} }, Default: { readOnly: false, computed: true, dict: {} }, ...users });

    test('missing member gets dmMissingSheet and an explanatory title', () => {
        const html = buildSectionRowHtml(mk(built({ a: sheet('noteRed1') }), 'mojo'), 0);
        expect(html).toContain('dmMissingSheet');
        expect(html).toContain('missing stylesheet: mojo');
    });
    test('present sheets, recipes and Looks are not flagged', () => {
        const colorDicts = built({ a: sheet('noteRed1') });
        expect(buildSectionRowHtml(mk(colorDicts, 'a'), 0)).not.toContain('dmMissingSheet');
        expect(buildSectionRowHtml(mk(colorDicts, 'Default+a'), 0)).not.toContain('dmMissingSheet');
        expect(buildSectionRowHtml(mk(colorDicts, 'Pretty', { colorLooks: { Pretty: 'Default+a' } }), 0)).not.toContain('dmMissingSheet');
        expect(buildSectionRowHtml(mk(colorDicts, 'Pretty', { colorLooks: { Pretty: 'Default+zz' } }), 0)).toContain('dmMissingSheet');
    });
    test('a Song without colorDicts (tests, Legend) is never flagged; the Song-DEFAULTS and LIVE rows are flagged too', () => {
        expect(buildSectionRowHtml(mk(null, 'whatever'), 0)).not.toContain('dmMissingSheet');
        const song = mk(built(), '', { displayOptionsDefault: { currentColorDict: 'gone' } });
        const html = buildMatrixHtml(song, { live: { currentColorDict: 'gone2' } });
        expect(html).toMatch(/dmSongDefaultsRow[\s\S]*dmSpecialCell dmMissingSheet/);
        expect(html).toContain('missing stylesheet: gone2');
    });
});

describe('Song file schema and glyph contract', () => {
    test('colorLooks is a string map in the schema', () => {
        const base = JSON.parse(read('songs/tests/empty-song.json'));
        expect(validateSongFileSchema({ ...base, colorLooks: { Pretty: 'Default+a' } }).valid).toBe(true);
        const bad = validateSongFileSchema({ ...base, colorLooks: { Pretty: 5 } });
        expect(bad.valid).toBe(false);
    });
    test('Tunings in Song and the Stylesheets table share the delete glyph and the unified button box', () => {
        expect(read('TuningsLibrary.js')).toContain('>&#x232B;</button>');
        const css = read('infinite-neck.css');
        expect(css).toMatch(/\.btnMoveTuningUp,\s*\.btnMoveTuningDown,\s*\.btnRemoveTuning\s*\{[^}]*height:/);
        expect(read('colorFunctions.js')).toContain("'\\u232B'");
    });
});
