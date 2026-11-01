// Sprint 149 Iteration 1: Theme Matrix Preview model.  Pure module + real Song; no DOM, no jQuery.
import { Song } from '../../Song.js';
import {
    buildThemeMatrixPreview, SONG_THEME_LABEL, HELD_LABEL, songThemeVariesLabel, songThemeLabel
} from '../../templates/themeMatrixPreview.js';

const P46 = 'tblP46_1';
const PIANO = 'tblPiano_1';
const tt = (caption) => ({ id: `${caption}-id`, caption });

/** blocks[i] = { displayOptions?, themes?: {tableID: caption}, gates? } for Section i. */
function mkSong(blocks, extra = {}) {
    const song = new Song({
        sections: blocks.map((b = {}) => ({
            sectionNotesByTable: Object.fromEntries(
                Object.entries(b.themes ?? {}).map(([tableID, caption]) => [tableID, { theme: tt(caption) }])
            ),
            displayOptions: b.displayOptions,
            displayOptionGates: b.gates
        })),
        ...extra
    });
    song.setHeadless(true, true);
    return song;
}

const defaults = (preview, tableID = P46) => preview.rows.map((r) => r.tableCells[tableID]);

describe('Table Themes (Instrument columns)', () => {
    test('a Table Theme cascades forward from the Section that stores it, never backward', () => {
        const song = mkSong([{}, {}, { themes: { [P46]: 'Autobahn+P46_1:S3' } }, {}, {}]);
        const cells = defaults(buildThemeMatrixPreview(song, [P46]));
        expect(cells.map((c) => c.kind)).toEqual(['song', 'song', 'stored', 'inherited', 'inherited']);
        expect(cells.map((c) => c.text)).toEqual([SONG_THEME_LABEL, SONG_THEME_LABEL, 'Autobahn+P46_1:S3', 'Autobahn+P46_1:S3', 'Autobahn+P46_1:S3']);
        expect(cells[3].title).toContain('Section 3');
    });

    test('a later Section that stores its own Theme replaces the carried one; each Instrument is separate', () => {
        const song = mkSong([
            { themes: { [P46]: 'A', [PIANO]: 'P' } }, {}, { themes: { [P46]: 'B' } }, {}
        ]);
        const preview = buildThemeMatrixPreview(song, [P46, PIANO]);
        expect(defaults(preview, P46).map((c) => c.text)).toEqual(['A', 'A', 'B', 'B']);
        expect(defaults(preview, PIANO).map((c) => c.text)).toEqual(['P', 'P', 'P', 'P']);
        expect(defaults(preview, P46)[3].title).toContain('Section 3');
        expect(defaults(preview, PIANO)[3].title).toContain('Section 1');
    });
});

describe('Theme automation (default column)', () => {
    const withAuto = (blocks) => mkSong(blocks, { allowThemeAutomation: true });
    const col = (preview) => preview.rows.map((r) => r.defaultCell);

    test('off: nothing is applied; a stored value is shown as dormant', () => {
        const song = mkSong([{ displayOptions: { sectionTheme: 'Snow' } }, {}], { allowThemeAutomation: false });
        const preview = buildThemeMatrixPreview(song, [P46]);
        expect(col(preview).map((c) => c.kind)).toEqual(['dormant', 'none']);
        expect(preview.automationOn).toBe(false);
        expect(preview.songThemeVaries).toBe(false);
        expect(defaults(preview)[1].text).toBe(SONG_THEME_LABEL);
    });

    test('on: a stored Theme carries forward, and does not reach back', () => {
        const song = withAuto([{}, {}, { displayOptions: { sectionTheme: 'Snow' } }, {}, {}]);
        const cells = col(buildThemeMatrixPreview(song, []));
        expect(cells.map((c) => c.kind)).toEqual(['held', 'held', 'stored', 'inherited', 'inherited']);
        expect(cells.map((c) => c.text)).toEqual([HELD_LABEL, HELD_LABEL, 'Snow', 'Snow', 'Snow']);
        expect(cells[4].title).toContain('Section 3');
    });

    test('on: Song-DEFAULTS supplies the Theme for Sections before the first stored one', () => {
        const song = withAuto([{}, { displayOptions: { sectionTheme: 'Snow' } }]);
        song.displayOptionsDefault = { sectionTheme: 'Autobahn' };
        const cells = col(buildThemeMatrixPreview(song, []));
        expect(cells[0]).toMatchObject({ kind: 'inherited', text: 'Autobahn' });
        expect(cells[0].title).toContain('Song-DEFAULTS');
        expect(cells[1]).toMatchObject({ kind: 'stored', text: 'Snow' });
    });

    test('a cell read-block ignores the stored value; the earlier Theme applies instead', () => {
        const song = withAuto([
            { displayOptions: { sectionTheme: 'Snow' } },
            { displayOptions: { sectionTheme: 'Autobahn' }, gates: { readBlocked: ['sectionTheme'] } }
        ]);
        const cells = col(buildThemeMatrixPreview(song, []));
        expect(cells[1]).toMatchObject({ kind: 'ignored', text: 'Autobahn' });
        expect(cells[1].title).toContain('Snow');
    });

    test('a column read-block applies nothing anywhere (the dropdown is left alone)', () => {
        const song = withAuto([{ displayOptions: { sectionTheme: 'Snow' } }, {}]);
        song.displayOptionGates = { readBlocked: ['sectionTheme'] };
        const cells = col(buildThemeMatrixPreview(song, []));
        expect(cells.map((c) => c.kind)).toEqual(['ignored', 'held']);
        expect(cells[1].title).toContain('Read-blocked');
    });

    test('a Theme id that is not in the dropdown is marked "?"', () => {
        const song = withAuto([{ displayOptions: { sectionTheme: 'Nope' } }, {}]);
        const cells = col(buildThemeMatrixPreview(song, [], { knownThemeIds: new Set(['Snow']) }));
        expect(cells[0].text).toBe('Nope?');
        expect(cells[1].text).toBe('Nope?');
    });
});

describe('default vs default:Current', () => {
    test('a fixed Song Theme is shown as default[PICKER], with the picker value; brackets are literal', () => {
        const song = mkSong([{ themes: { [P46]: 'A' } }, {}, {}]);
        const preview = buildThemeMatrixPreview(song, [P46, PIANO], { pickerThemeId: 'USER' });
        expect(songThemeLabel('USER')).toBe('default[USER]');
        expect(defaults(preview, PIANO).map((c) => c.text)).toEqual(['default[USER]', 'default[USER]', 'default[USER]']);
        expect(defaults(preview, P46).map((c) => c.text)).toEqual(['A', 'A', 'A']);
    });

    test('one automated Theme everywhere is still a fixed Song Theme: default[PICKER], not default:Current', () => {
        const song = mkSong([{ displayOptions: { sectionTheme: 'Snow' } }, {}], { allowThemeAutomation: true });
        const preview = buildThemeMatrixPreview(song, [P46], { pickerThemeId: 'Snow' });
        expect(defaults(preview).map((c) => c.text)).toEqual(['default[Snow]', 'default[Snow]']);
    });

    test('default:Current takes precedence over default[PICKER] when the Song Theme varies', () => {
        const song = mkSong([{ displayOptions: { sectionTheme: 'USER' } }, { displayOptions: { sectionTheme: 'Snow' } }], { allowThemeAutomation: true });
        const preview = buildThemeMatrixPreview(song, [P46], { pickerThemeId: 'Snow' });
        expect(defaults(preview).map((c) => c.text)).toEqual(['default:USER', 'default:Snow']);
    });
    test('one automated Theme in every Section: the Song Theme is a single Theme, plain "default"', () => {
        const song = mkSong([{ displayOptions: { sectionTheme: 'Snow' } }, {}, {}], { allowThemeAutomation: true });
        const preview = buildThemeMatrixPreview(song, [P46]);
        expect(preview.songThemeVaries).toBe(false);
        expect(defaults(preview).map((c) => c.text)).toEqual([SONG_THEME_LABEL, SONG_THEME_LABEL, SONG_THEME_LABEL]);
        expect(defaults(preview)[2].title).toContain('Snow');
    });

    test('two automated Themes: "default:Current" follows the Theme applied at each Section', () => {
        const song = mkSong([
            { displayOptions: { sectionTheme: 'USER' } }, {}, { displayOptions: { sectionTheme: 'BigInJapan' } }
        ], { allowThemeAutomation: true });
        const preview = buildThemeMatrixPreview(song, [P46]);
        expect(preview.songThemeVaries).toBe(true);
        expect(preview.songThemeIds).toEqual(['USER', 'BigInJapan']);
        expect(defaults(preview).map((c) => c.text)).toEqual(['default:USER', 'default:USER', 'default:BigInJapan']);
    });

    test('a Theme stored only partway through: earlier Sections show default:(kept)', () => {
        const song = mkSong([{}, { displayOptions: { sectionTheme: 'Snow' } }], { allowThemeAutomation: true });
        const preview = buildThemeMatrixPreview(song, [P46]);
        expect(preview.songThemeVaries).toBe(true);
        expect(defaults(preview).map((c) => c.text)).toEqual([songThemeVariesLabel(HELD_LABEL), 'default:Snow']);
    });

    test('default:Current marks an id that is not in the dropdown with "?"', () => {
        const song = mkSong([{ displayOptions: { sectionTheme: 'Nope' } }, { displayOptions: { sectionTheme: 'Snow' } }], { allowThemeAutomation: true });
        const preview = buildThemeMatrixPreview(song, [P46], { knownThemeIds: new Set(['Snow']) });
        expect(defaults(preview).map((c) => c.text)).toEqual(['default:Nope?', 'default:Snow']);
    });

    test('no automation at all: plain "default"', () => {
        const song = mkSong([{}, {}], { allowThemeAutomation: true });
        const preview = buildThemeMatrixPreview(song, [P46]);
        expect(preview.songThemeVaries).toBe(false);
        expect(defaults(preview).map((c) => c.text)).toEqual([SONG_THEME_LABEL, SONG_THEME_LABEL]);
    });

    test('an Instrument with a Table Theme is never drawn as default, whatever automation does', () => {
        const song = mkSong([
            { themes: { [P46]: 'A' }, displayOptions: { sectionTheme: 'Snow' } }, {}, { displayOptions: { sectionTheme: 'Autobahn' } }
        ], { allowThemeAutomation: true });
        const preview = buildThemeMatrixPreview(song, [P46, PIANO]);
        expect(defaults(preview, P46).map((c) => c.text)).toEqual(['A', 'A', 'A']);
        expect(defaults(preview, PIANO).map((c) => c.text)).toEqual(['default:Snow', 'default:Snow', 'default:Autobahn']);
    });
});
