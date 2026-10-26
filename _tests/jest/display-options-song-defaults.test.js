// Sprint 148 Iteration 6: Song-DEFAULTS (song.displayOptionsDefault).  Pure modules + Song persistence; no DOM.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Song } from '../../Song.js';
import { SongPersistence } from '../../SongPersistence.js';
import { validateSongFileSchema as validateSongFile } from '../../bin/song-file-schema.js';
import {
    DISPLAY_OPTIONS_DEFAULTS, normalizeSongDisplayOptionsDefault
} from '../../templates/display-options/displayOptionsMeta.js';
import { resolveDisplayOptions, songDefaultValues } from '../../templates/display-options/displayOptionsResolver.js';
import {
    planCurrentToSongDefaults, planClearSongDefaults, planSaveDiff, planSaveAll, planClear, applyPlan,
    canUndoDisplayOptionsOp, undoLastDisplayOptionsOp, resetUndoForTests
} from '../../templates/display-options/displayOptionsPlan.js';
import { describeCell, planAffectsApply, songDefaultsButtonCaption } from '../../templates/display-options/displayOptionsMatrixTools.js';
import {
    buildMatrixHtml, buildSongDefaultsRowHtml, buildLegendHtml
} from '../../templates/display-options/displayOptionsMatrixView.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, '../../songs/tests/display-options.json');

function mkSong(blocks, extra = {}) {
    return {
        presentationMode: true,
        allowThemeAutomation: true,
        sections: blocks.map((b) => ({ displayOptions: b ?? undefined })),
        ...extra
    };
}

const saved = (song) => JSON.parse(JSON.stringify(song, SongPersistence.persistentSongFileReplacer));

beforeEach(() => resetUndoForTests());

describe('normalizeSongDisplayOptionsDefault and persistence', () => {
    test('missing, empty, non-object and all-unknown blocks are all "no block"', () => {
        for (const raw of [undefined, null, {}, [], 'x', 7, { bogus: 1 }, { noteFont: null }, { noteFont: undefined }]) {
            expect(normalizeSongDisplayOptionsDefault(raw)).toBeUndefined();
        }
    });

    test('keeps known keys with real values (false and 0 included), in column order, deep-cloned', () => {
        const raw = { noteFont: 'Cardo', showMidiNum: false, bogus: 1, autoColor: true, NoteDisplaySizes: { width: '1', height: '2', NoteFontSize: 3 } };
        const out = normalizeSongDisplayOptionsDefault(raw);
        expect(Object.keys(out)).toEqual(['autoColor', 'showMidiNum', 'NoteDisplaySizes', 'noteFont']);
        expect(out.showMidiNum).toBe(false);
        out.NoteDisplaySizes.width = 'changed';
        expect(raw.NoteDisplaySizes.width).toBe('1');
    });

    function load(extra = {}) {
        const data = { ...JSON.parse(fs.readFileSync(FIXTURE, 'utf8')), ...extra };
        const song = new Song(data);
        song.ensureDefaultSection();
        song.fixupCurrentIndexForLoadedSong();
        song.setHeadless(true, true);
        return song;
    }

    test('an old Song (no field) loads with no field and saves without one', () => {
        const song = load();
        expect('displayOptionsDefault' in song).toBe(false);
        expect(saved(song).displayOptionsDefault).toBeUndefined();
    });

    test('an empty or junk block is dropped on load (the same as a missing block)', () => {
        expect('displayOptionsDefault' in load({ displayOptionsDefault: {} })).toBe(false);
        expect('displayOptionsDefault' in load({ displayOptionsDefault: { bogus: 1 } })).toBe(false);
    });

    test('a block is normalized on load and round-trips through the Song file', () => {
        const song = load({ displayOptionsDefault: { noteFont: 'Cardo', bogus: 1, showMidiNum: false } });
        expect(song.displayOptionsDefault).toEqual({ showMidiNum: false, noteFont: 'Cardo' });
        const out = saved(song);
        expect(out.displayOptionsDefault).toEqual({ showMidiNum: false, noteFont: 'Cardo' });
        expect(new Song(out).displayOptionsDefault).toEqual({ showMidiNum: false, noteFont: 'Cardo' });
    });

    test('the Song file schema accepts a good block and rejects an unknown key or an empty block', () => {
        const good = saved(load());
        good.displayOptionsDefault = { noteFont: 'Cardo' };
        expect(validateSongFile(good).valid).toBe(true);
        good.displayOptionsDefault = { bogus: 'x' };
        expect(validateSongFile(good).valid).toBe(false);
        good.displayOptionsDefault = {};
        expect(validateSongFile(good).valid).toBe(false);
    });
});

describe('resolver: the Song-DEFAULTS tier', () => {
    test('apply: Song-DEFAULTS beat DEFAULTS even when no Section automates the key', () => {
        const song = mkSong([null, null], { displayOptionsDefault: { noteFont: 'Cardo' } });
        const r = resolveDisplayOptions(song, 1, { purpose: 'apply' });
        expect(r.values.noteFont).toBe('Cardo');
        expect(r.entries.noteFont).toEqual({ source: 'songDefault' });
        expect(r.values.showMidiNum).toBeUndefined();   // defaultIfAutomated: nothing else is pushed
    });

    test('apply: a Section cell beats Song-DEFAULTS, and later Sections inherit it', () => {
        const song = mkSong([null, { noteFont: 'Eczar' }, null], { displayOptionsDefault: { noteFont: 'Cardo' } });
        expect(resolveDisplayOptions(song, 0, { purpose: 'apply' }).values.noteFont).toBe('Cardo');
        expect(resolveDisplayOptions(song, 1, { purpose: 'apply' }).values.noteFont).toBe('Eczar');
        expect(resolveDisplayOptions(song, 2, { purpose: 'apply' }).values.noteFont).toBe('Eczar');
    });

    test('apply: works for keys that have no DEFAULTS entry', () => {
        const song = mkSong([null], { displayOptionsDefault: { currentColorDict: 'D', sectionTheme: 'T' } });
        const r = resolveDisplayOptions(song, 0, { purpose: 'apply' });
        expect(r.values.currentColorDict).toBe('D');
        expect(r.values.sectionTheme).toBe('T');
    });

    test('a missing, empty and all-unknown block resolve identically to a Song without the field', () => {
        const base = mkSong([{ noteFont: 'Eczar' }, null]);
        for (const block of [undefined, {}, { bogus: 1 }]) {
            const song = mkSong([{ noteFont: 'Eczar' }, null], { displayOptionsDefault: block });
            for (const purpose of ['apply', 'baseline']) {
                for (const idx of [0, 1]) {
                    expect(resolveDisplayOptions(song, idx, { purpose }))
                        .toEqual(resolveDisplayOptions(base, idx, { purpose }));
                }
            }
        }
        expect(songDefaultValues(undefined)).toEqual({});
    });

    test('dormant values (D5): a column read-block or an off adapter leaves the key alone', () => {
        const song = mkSong([null], {
            displayOptionsDefault: { noteFont: 'Cardo', sectionTheme: 'T' },
            displayOptionGates: { readBlocked: ['noteFont'] },
            allowThemeAutomation: false
        });
        const r = resolveDisplayOptions(song, 0, { purpose: 'apply' });
        expect(r.values.noteFont).toBeUndefined();
        expect(r.entries.noteFont.source).toBe('blocked');
        expect(r.values.sectionTheme).toBeUndefined();
        song.displayOptionGates = undefined;
        song.allowThemeAutomation = true;
        const open = resolveDisplayOptions(song, 0, { purpose: 'apply' });
        expect(open.values.noteFont).toBe('Cardo');
        expect(open.values.sectionTheme).toBe('T');
    });

    test('a cell read-blocked Section cell now inherits from Song-DEFAULTS (D6)', () => {
        const song = mkSong([{ noteFont: 'Eczar' }], { displayOptionsDefault: { noteFont: 'Cardo' } });
        song.sections[0].displayOptionGates = { readBlocked: ['noteFont'] };
        expect(resolveDisplayOptions(song, 0, { purpose: 'apply' }).values.noteFont).toBe('Cardo');
    });

    test('baseline: Song-DEFAULTS sit between earlier Sections and DEFAULTS', () => {
        const song = mkSong([null, { noteFont: 'Eczar' }, null], { displayOptionsDefault: { noteFont: 'Cardo', showMidiNum: true } });
        const first = resolveDisplayOptions(song, 0, { purpose: 'baseline' });
        expect(first.values.noteFont).toBe('Cardo');
        expect(first.entries.noteFont.source).toBe('songDefault');
        expect(first.values.showMidiNum).toBe(true);
        expect(first.values.showCellNotes).toBe(DISPLAY_OPTIONS_DEFAULTS.showCellNotes);
        expect(first.entries.showCellNotes.source).toBe('default');
        expect(resolveDisplayOptions(song, 2, { purpose: 'baseline' }).values.noteFont).toBe('Eczar');
    });

    test('baseline: Song-DEFAULTS beat syncLive for keys without a DEFAULTS entry', () => {
        const song = mkSong([null], { displayOptionsDefault: { currentColorDict: 'D' } });
        const r = resolveDisplayOptions(song, 0, { purpose: 'baseline', syncLive: { currentColorDict: 'other' } });
        expect(r.values.currentColorDict).toBe('D');
    });

    test('SaveDiff diffs against Song-DEFAULTS: a repeat stores nothing, a redundant cell is deleted', () => {
        const song = mkSong([null, { noteFont: 'Eczar' }], { displayOptionsDefault: { noteFont: 'Cardo' } });
        const same = planSaveDiff(song, 0, { noteFont: 'Cardo' });
        expect(same.ops).toEqual([]);
        // live now equals what Section 2 inherits (Song-DEFAULTS), so its stored cell is redundant
        const redundant = planSaveDiff(song, 1, { noteFont: 'Cardo' });
        expect(redundant.ops).toEqual([expect.objectContaining({ type: 'deleteCell', key: 'noteFont', note: 'redundant' })]);
        const different = planSaveDiff(song, 0, { noteFont: 'Eczar' });
        expect(different.ops).toEqual([expect.objectContaining({ type: 'setCell', key: 'noteFont', value: 'Eczar' })]);
    });
});

describe('planCurrentToSongDefaults', () => {
    test('copies the Current Section\'s STORED cells, leaves the Section alone, and writes in column order', () => {
        const song = mkSong([{ noteFont: 'Cardo', showMidiNum: true }, { noteFont: 'Eczar' }]);
        const plan = planCurrentToSongDefaults(song, 0);
        expect(plan.skipped).toEqual([]);
        expect(plan.noUndo).toBe(true);
        const out = applyPlan(song, plan);
        expect(out.changed).toBe(true);
        expect(song.displayOptionsDefault).toEqual({ showMidiNum: true, noteFont: 'Cardo' });
        expect(Object.keys(song.displayOptionsDefault)).toEqual(['showMidiNum', 'noteFont']);
        expect(song.sections[0].displayOptions).toEqual({ noteFont: 'Cardo', showMidiNum: true });   // Q1: copy, not move
        expect(out.report).toContain('Section 1: currentToSongDefaults');
        expect(out.report).toContain('Song-DEFAULTS wrote showMidiNum, noteFont');
    });

    test('the copy is a pure mirror (D3): another Section replaces the block and stale keys go', () => {
        const song = mkSong([{ noteFont: 'Cardo', showMidiNum: true }, { noteFont: 'Eczar' }]);
        applyPlan(song, planCurrentToSongDefaults(song, 0));
        const out = applyPlan(song, planCurrentToSongDefaults(song, 1));
        expect(song.displayOptionsDefault).toEqual({ noteFont: 'Eczar' });
        expect(out.report).toContain('Song-DEFAULTS wrote noteFont');
        expect(out.report).toContain('Song-DEFAULTS removed showMidiNum');
    });

    test('a repeat press changes nothing', () => {
        const song = mkSong([{ noteFont: 'Cardo' }]);
        applyPlan(song, planCurrentToSongDefaults(song, 0));
        const plan = planCurrentToSongDefaults(song, 0);
        expect(plan.ops).toEqual([]);
        expect(plan.unchanged).toBe(1);
        const out = applyPlan(song, plan);
        expect(out.changed).toBe(false);
        expect(out.report).toContain('nothing to change');
    });

    test('a Section that stores nothing does not wipe the block', () => {
        const song = mkSong([null], { displayOptionsDefault: { noteFont: 'Cardo' } });
        const out = applyPlan(song, planCurrentToSongDefaults(song, 0));
        expect(out.changed).toBe(false);
        expect(out.report).toContain('Section 1 stores nothing; Song-DEFAULTS unchanged');
        expect(song.displayOptionsDefault).toEqual({ noteFont: 'Cardo' });
    });

    test('hand-edited junk in a Section block is not copied', () => {
        const song = mkSong([{ noteFont: 'Cardo', bogus: 1, showMidiNum: null }]);
        applyPlan(song, planCurrentToSongDefaults(song, 0));
        expect(song.displayOptionsDefault).toEqual({ noteFont: 'Cardo' });
    });

    test('D1: it overrides every gate, skips nothing, and names the gated keys in the report (D4)', () => {
        const song = mkSong([{ noteFont: 'a', showMidiNum: true, autoColor: true, tinyNoteWidth: '40%', sectionTheme: 'T', hideTinyNotes: true }], {
            allowThemeAutomation: false,
            displayOptionGates: { readBlocked: ['noteFont'], writeBlocked: ['tinyNoteWidth'] }
        });
        song.sections[0].displayOptionGates = { readBlocked: ['*', 'showMidiNum'], writeBlocked: ['autoColor', '*'] };
        const gatesBefore = JSON.stringify(song.sections[0].displayOptionGates);
        const plan = planCurrentToSongDefaults(song, 0);
        expect(plan.skipped).toEqual([]);
        const out = applyPlan(song, plan);
        expect(Object.keys(song.displayOptionsDefault).sort()).toEqual(
            ['autoColor', 'hideTinyNotes', 'noteFont', 'sectionTheme', 'showMidiNum', 'tinyNoteWidth'].sort()
        );
        expect(out.report).toContain('gated (overridden):');
        expect(out.report).toContain('noteFont (column r, row rw)');
        expect(out.report).toContain('showMidiNum (row rw, cell r)');
        expect(out.report).toContain('autoColor (row rw, cell w)');
        expect(out.report).toContain('tinyNoteWidth (column w, row rw)');
        expect(out.report).toContain('sectionTheme (adapter rw, row rw)');
        expect(out.report).toContain('hideTinyNotes (row rw)');
        expect(JSON.stringify(song.sections[0].displayOptionGates)).toBe(gatesBefore);   // gates untouched
    });

    test('a plan with no gated keys has no gated text', () => {
        const song = mkSong([{ noteFont: 'a' }]);
        expect(applyPlan(song, planCurrentToSongDefaults(song, 0)).report).not.toContain('gated');
    });

    test('an unknown Section index throws', () => {
        expect(() => planCurrentToSongDefaults(mkSong([null]), 3)).toThrow('no Section at index 3');
    });

    test('it does not take the Undo slot, and leaves an earlier undo intact', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, { showMidiNum: true }]);
        applyPlan(song, planClear(song, 1));
        expect(canUndoDisplayOptionsOp(song)).toBe(true);
        applyPlan(song, planCurrentToSongDefaults(song, 0));
        expect(canUndoDisplayOptionsOp(song)).toBe(true);
        undoLastDisplayOptionsOp(song);
        expect(song.sections[1].displayOptions).toEqual({ showMidiNum: true });   // the Clear was undone
        expect(song.displayOptionsDefault).toEqual({ noteFont: 'Cardo' });         // Undo did not touch Song-DEFAULTS
    });

    test('the copy follows a SaveAll flow: SaveAll on the Section, then Current to Song-DEFAULTS', () => {
        const song = mkSong([null]);
        const live = { ...DISPLAY_OPTIONS_DEFAULTS, noteFont: 'Cardo' };
        applyPlan(song, planSaveAll(song, 0, live));
        applyPlan(song, planCurrentToSongDefaults(song, 0));
        expect(song.displayOptionsDefault.noteFont).toBe('Cardo');
        expect(Object.keys(song.displayOptionsDefault)).toHaveLength(Object.keys(song.sections[0].displayOptions).length);
    });
});

describe('planClearSongDefaults', () => {
    test('empties the block and leaves no empty block behind', () => {
        const song = mkSong([null], { displayOptionsDefault: { noteFont: 'Cardo', showMidiNum: true } });
        const out = applyPlan(song, planClearSongDefaults(song));
        expect(out.changed).toBe(true);
        expect('displayOptionsDefault' in song).toBe(false);
        expect(out.report).toContain('Song-DEFAULTS removed showMidiNum, noteFont');
    });

    test('D2: it removes gated keys too, and names them', () => {
        const song = mkSong([null], {
            displayOptionsDefault: { noteFont: 'Cardo', sectionTheme: 'T' },
            displayOptionGates: { writeBlocked: ['noteFont'] },
            allowThemeAutomation: false
        });
        const plan = planClearSongDefaults(song);
        expect(plan.skipped).toEqual([]);
        const out = applyPlan(song, plan);
        expect('displayOptionsDefault' in song).toBe(false);
        expect(out.report).toContain('noteFont (column w)');
        expect(out.report).toContain('sectionTheme (adapter rw)');
        expect(song.displayOptionGates).toEqual({ writeBlocked: ['noteFont'] });
    });

    test('a missing or empty block: nothing to clear, no change', () => {
        for (const block of [undefined, {}]) {
            const song = mkSong([null], { displayOptionsDefault: block });
            const out = applyPlan(song, planClearSongDefaults(song));
            expect(out.changed).toBe(false);
            expect(out.report).toContain('nothing to clear');
        }
    });

    test('it does not take the Undo slot', () => {
        const song = mkSong([null], { displayOptionsDefault: { noteFont: 'Cardo' } });
        applyPlan(song, planClearSongDefaults(song));
        expect(canUndoDisplayOptionsOp(song)).toBe(false);
    });

    test('after Clear the cascade is back to DEFAULTS', () => {
        const song = mkSong([null], { displayOptionsDefault: { noteFont: 'Cardo' } });
        applyPlan(song, planClearSongDefaults(song));
        expect(resolveDisplayOptions(song, 0, { purpose: 'apply' }).values.noteFont).toBeUndefined();
        expect(resolveDisplayOptions(song, 0, { purpose: 'baseline' }).values.noteFont).toBe(DISPLAY_OPTIONS_DEFAULTS.noteFont);
    });
});

describe('Matrix integration', () => {
    test('planAffectsApply: a Song-DEFAULTS change always affects Apply', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, null], { displayOptionsDefault: { noteFont: 'x' } });
        expect(planAffectsApply(planCurrentToSongDefaults(song, 0), 1)).toBe(true);
        expect(planAffectsApply(planClearSongDefaults(song), 0)).toBe(true);
    });

    test('Inspect on a key header or DEFAULTS/LIVE cell shows the Song-DEFAULTS value', () => {
        const song = mkSong([null], { displayOptionsDefault: { noteFont: 'Cardo' } });
        const info = describeCell(song, null, 'noteFont', { live: { noteFont: 'Live' } });
        expect(info.lines[0]).toBe('group: Fonts; default: EB Garamond; song default: Cardo; live: Live');
    });

    test('Inspect on a Section cell names the Song-DEFAULTS source it inherits from', () => {
        const song = mkSong([null], { displayOptionsDefault: { noteFont: 'Cardo' } });
        expect(describeCell(song, 0, 'noteFont').lines[0]).toContain('Cardo (songDefault)');
    });

    test('the row sits between DEFAULTS and LIVE, with the label, plain cells and no data-section', () => {
        const song = mkSong([null], { displayOptionsDefault: { noteFont: 'Cardo', showMidiNum: false } });
        const html = buildMatrixHtml(song, {});
        const at = (c) => html.indexOf(c);
        expect(at('dmDefaultsRow')).toBeLessThan(at('dmSongDefaultsRow'));
        expect(at('dmSongDefaultsRow')).toBeLessThan(at('dmLiveRow'));
        const row = html.slice(at('dmSongDefaultsRow'), at('dmLiveRow'));
        expect(row).toContain('>Song-DEFAULTS</th>');
        expect(row).toMatch(/<td class='dmSpecialCell' data-zone='specialCell' data-key='noteFont'>Cardo<\/td>/);
        expect(row).toMatch(/data-key='showMidiNum'>\u2717<\/td>/);
        expect(row).not.toContain('data-section');
    });

    test('the row is drawn blank when the block is missing or empty', () => {
        for (const block of [undefined, {}]) {
            const html = buildSongDefaultsRowHtml(mkSong([null], { displayOptionsDefault: block }));
            expect(html).toContain('dmSongDefaultsRow');
            expect(html.match(/<td class='dmSpecialCell'/g).length).toBeGreaterThan(30);
            expect(html).not.toMatch(/<td class='dmSpecialCell'[^>]*>[^<&]/);
        }
    });

    test('Q11: the special rows are plain: a gated key\'s Song-DEFAULTS value carries no gate classes', () => {
        const song = mkSong([null], {
            displayOptionsDefault: { noteFont: 'Cardo', sectionTheme: 'T' },
            displayOptionGates: { readBlocked: ['noteFont'] },
            allowThemeAutomation: false
        });
        const row = buildSongDefaultsRowHtml(song);
        expect(row).not.toMatch(/dmColGate|dmAdapter|dmRowGate|dmCellGate/);
        expect(row).toMatch(/data-key='noteFont'>Cardo</);
    });

    test('the non-interactive row (Legend) carries no data attributes', () => {
        expect(buildSongDefaultsRowHtml(mkSong([null]), { interactive: false })).not.toContain('data-');
    });

    test('the Legend explains the row', () => {
        expect(buildLegendHtml()).toContain('Song-DEFAULTS');
    });

    test('round 3: the write button is captioned with the one-based Current Section, and the builder keeps it current', () => {
        expect(songDefaultsButtonCaption(0)).toBe('\u00a71 \u2192 Song-DEFAULTS');
        expect(songDefaultsButtonCaption(11)).toBe('\u00a712 \u2192 Song-DEFAULTS');
        expect(songDefaultsButtonCaption(-1)).toBe('\u00a7? \u2192 Song-DEFAULTS');
        expect(songDefaultsButtonCaption(undefined)).toBe('\u00a7? \u2192 Song-DEFAULTS');
        const read = (file) => fs.readFileSync(path.join(here, '../..', file), 'utf8');
        expect(read('templates/display-options/display-options.builder.js')).toContain('.text(songDefaultsButtonCaption(ctx.currentIndex))');
        expect(read('templates/display-options/display-options.html')).toContain('&sect;1 &rarr; Song-DEFAULTS</button>');
    });

    test('/vdd and the Matrix wiring: the buttons are bound, the core handlers and context exist, and the Matrix stays quiet', () => {
        const read = (file) => fs.readFileSync(path.join(here, '../..', file), 'utf8');
        const builder = read('templates/display-options/display-options.builder.js');
        expect(builder).toContain("press('#btnCurrentSectionToSongDisplayOptions'");
        expect(builder).toContain("press('#btnClearSongDisplayOptions'");
        expect(builder).toContain('hasSongDefaults');
        expect(builder).toContain('currentStoresCells');
        expect(builder).toContain('--dm-top-songdefaults');
        expect(builder).not.toMatch(/showMessages/);
        const core = read('infinite-neck.js');
        expect(core).toContain('export function handleBtnCurrentSectionToSongDisplayOptions');
        expect(core).toContain('export function handleBtnClearSongDisplayOptions');
        expect(core).toContain('hasSongDefaults:');
        const css = read('templates/display-options/display-options.css');
        expect(css).toContain('dmSongDefaultsRow');
        expect(css).toContain('--dm-top-songdefaults');
        const tpl = read('templates/display-options/display-options.html');
        expect(tpl.indexOf('btnApply_Matrix')).toBeLessThan(tpl.indexOf('btnCurrentSectionToSongDisplayOptions'));
        expect(tpl.indexOf('btnClearSongDisplayOptions')).toBeLessThan(tpl.indexOf('btnFloatSection_divDisplayOptionsMatrix'));
    });
});
