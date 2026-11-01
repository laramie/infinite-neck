import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DISPLAY_OPTIONS_DEFAULTS, DISPLAY_OPTION_META, DISPLAY_OPTION_KEYS, valuesEqual,
    HIDE_KEY_FOR_NOTE_TYPE, hideKeyForNoteType
} from '../../templates/display-options/displayOptionsMeta.js';
import {
    normalizeSongGates, normalizeSectionGates, setGate, parseGateDirection,
    isReadBlocked, isWriteBlocked, isExplicitWriteBlocked, describeBlocks
} from '../../templates/display-options/displayOptionsGates.js';
import {
    resolveDisplayOptions, getAutomatedKeys, ABSENT_CELL_POLICY
} from '../../templates/display-options/displayOptionsResolver.js';
import {
    planSaveDiff, planSaveAll, planClear, planClearCell, planGate, applyPlan, keysInSyncWithModel,
    undoLastDisplayOptionsOp, canUndoDisplayOptionsOp, resetUndoForTests
} from '../../templates/display-options/displayOptionsPlan.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function mkSong(blocks, extra = {}) {
    return {
        presentationMode: false,
        allowThemeAutomation: false,
        sections: blocks.map((b) => ({ displayOptions: b ?? undefined })),
        ...extra
    };
}

describe('displayOptionsMeta', () => {
    test('META keys match the keys controlsToDisplayOptions() assigns', () => {
        const src = fs.readFileSync(path.join(here, '../../infinite-neck.js'), 'utf8');
        const start = src.indexOf('export function controlsToDisplayOptions()');
        const end = src.indexOf('return options;', start);
        const body = src.slice(start, end);
        const assigned = [...body.matchAll(/options\.(\w+)\s*=/g)].map((m) => m[1]);
        expect([...new Set(assigned)].sort()).toEqual([...DISPLAY_OPTION_KEYS].sort());
    });

    test('defaults only name known keys, and hasDefault agrees', () => {
        for (const key of Object.keys(DISPLAY_OPTIONS_DEFAULTS)) {
            expect(DISPLAY_OPTION_META[key]).toBeDefined();
        }
        for (const key of DISPLAY_OPTION_KEYS) {
            expect(DISPLAY_OPTION_META[key].hasDefault).toBe(key in DISPLAY_OPTIONS_DEFAULTS);
        }
        expect(DISPLAY_OPTIONS_DEFAULTS.autoColor).toBe(true);
        expect(DISPLAY_OPTIONS_DEFAULTS.autoColorHighlight).toBe(false);
        expect('NoteDisplaySizes' in DISPLAY_OPTIONS_DEFAULTS).toBe(false);
        expect('currentColorDict' in DISPLAY_OPTIONS_DEFAULTS).toBe(false);
        expect('sectionTheme' in DISPLAY_OPTIONS_DEFAULTS).toBe(false);
    });

    test('valuesEqual', () => {
        expect(valuesEqual('namedNoteOpacity', '1', '1.0')).toBe(true);
        expect(valuesEqual('namedNoteOpacity', 1, '1')).toBe(true);
        expect(valuesEqual('tinyNoteWidth', '35%', '35%')).toBe(true);
        expect(valuesEqual('tinyNoteWidth', '35%', '45%')).toBe(false);
        expect(valuesEqual('autoColor', true, 'true')).toBe(false);
        expect(valuesEqual('NoteDisplaySizes', { width: '40px', height: '30px', NoteFontSize: 12, caption: 'a' },
            { width: '40px', height: '30px', NoteFontSize: '12', caption: 'b' })).toBe(true);
        expect(valuesEqual('noteFont', undefined, 'x')).toBe(false);
    });
});

describe('displayOptionsGates', () => {
    test('note type -> HIDE key (Round 5): the reveal granularity for note placement and note-type choice', () => {
        expect(hideKeyForNoteType('Named')).toBe('hideNamedNotes');
        expect(hideKeyForNoteType('Single')).toBe('hideSingleNotes');
        expect(hideKeyForNoteType('Tiny')).toBe('hideTinyNotes');
        expect(hideKeyForNoteType('Bend')).toBe('hideTinyNotes');
        expect(hideKeyForNoteType('Fingering')).toBe('hideFingering');
        // highlights reveal nothing; unknown values and inherited Object keys are safe
        expect(hideKeyForNoteType('MidiPitches')).toBeNull();
        expect(hideKeyForNoteType('MidiPitchesSingle')).toBeNull();
        expect(hideKeyForNoteType(undefined)).toBeNull();
        expect(hideKeyForNoteType('toString')).toBeNull();
        for (const key of Object.values(HIDE_KEY_FOR_NOTE_TYPE)) {
            expect(DISPLAY_OPTION_META[key]).toBeDefined();
        }
    });

    test('normalization drops unknown keys, duplicates, empties; row only in Section gates', () => {
        expect(normalizeSongGates({ readBlocked: ['bogus', 'noteFont', 'noteFont', '*'], writeBlocked: [] }))
            .toEqual({ readBlocked: ['noteFont'] });
        expect(normalizeSectionGates({ readBlocked: ['noteFont', '*'] })).toEqual({ readBlocked: ['*', 'noteFont'] });
        expect(normalizeSongGates({})).toBeUndefined();
        expect(normalizeSongGates(null)).toBeUndefined();
    });

    test('setGate is pure and removes empties', () => {
        const a = setGate(undefined, 'noteFont', 'read', true);
        expect(a).toEqual({ readBlocked: ['noteFont'] });
        const b = setGate(a, 'noteFont', 'both', true);
        expect(b).toEqual({ readBlocked: ['noteFont'], writeBlocked: ['noteFont'] });
        expect(a).toEqual({ readBlocked: ['noteFont'] });
        expect(setGate(b, 'noteFont', 'both', false)).toBeUndefined();
        expect(() => setGate(undefined, '*', 'read', true)).toThrow();
        expect(setGate(undefined, '*', 'write', true, { allowRow: true })).toEqual({ writeBlocked: ['*'] });
        expect(() => setGate(undefined, 'nope', 'read', true)).toThrow();
    });

    test('parseGateDirection', () => {
        expect(parseGateDirection('')).toBe('both');
        expect(parseGateDirection('read-blocked')).toBe('read');
        expect(parseGateDirection('write-blocked')).toBe('write');
        expect(parseGateDirection('blocked')).toBe('both');
        expect(parseGateDirection('huh')).toBeNull();
    });

    test('evaluation: column OR row OR cell OR adapter', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, {}], {
            displayOptionGates: { readBlocked: ['showCellNotes'] }
        });
        song.sections[1].displayOptionGates = { writeBlocked: ['*'], readBlocked: ['noteFont'] };
        const [s0, s1] = song.sections;
        expect(isReadBlocked(song, s0, 'showCellNotes')).toBe(true);
        expect(isReadBlocked(song, s0, 'noteFont')).toBe(false);
        expect(isReadBlocked(song, s1, 'noteFont')).toBe(true);
        expect(isWriteBlocked(song, s1, 'autoColor')).toBe(true);
        expect(isWriteBlocked(song, s0, 'autoColor')).toBe(false);
        // adapters
        expect(isReadBlocked(song, s0, 'NoteDisplaySizes')).toBe(true);
        expect(isWriteBlocked(song, s0, 'sectionTheme')).toBe(true);
        expect(isExplicitWriteBlocked(song, s0, 'NoteDisplaySizes')).toBe(false);
        song.presentationMode = true;
        expect(isReadBlocked(song, s0, 'NoteDisplaySizes')).toBe(false);
        expect(describeBlocks(song, s1, 'noteFont')).toEqual({ adapter: '', column: '', row: 'w', cell: 'r' });
    });
});

describe('displayOptionsResolver', () => {
    test('policy constant is defaultIfAutomated', () => {
        expect(ABSENT_CELL_POLICY).toBe('defaultIfAutomated');
    });

    test('sparse cascade with provenance', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, null, { showCellNotes: false }]);
        const { values, entries } = resolveDisplayOptions(song, 2);
        expect(values.noteFont).toBe('Cardo');
        expect(entries.noteFont).toEqual({ source: 'stored', sectionIndex: 0 });
        expect(values.showCellNotes).toBe(false);
        expect(entries.showCellNotes).toEqual({ source: 'stored', sectionIndex: 2 });
    });

    test('policy C: automated keys get defaults before their first cell; others are left alone', () => {
        const song = mkSong([null, { noteFont: 'Cardo' }]);
        const r0 = resolveDisplayOptions(song, 0);
        expect(r0.values.noteFont).toBe(DISPLAY_OPTIONS_DEFAULTS.noteFont);
        expect(r0.entries.noteFont.source).toBe('default');
        expect('showCellNotes' in r0.values).toBe(false);
        expect('currentColorDict' in r0.values).toBe(false);
    });

    test('policy leave and default', () => {
        const song = mkSong([null, { noteFont: 'Cardo' }]);
        expect('noteFont' in resolveDisplayOptions(song, 0, { policy: 'leave' }).values).toBe(false);
        const all = resolveDisplayOptions(song, 0, { policy: 'default' }).values;
        expect(all.showCellNotes).toBe(true);
        expect('currentColorDict' in all).toBe(false);
        expect(() => resolveDisplayOptions(song, 0, { policy: 'x' })).toThrow();
    });

    test('R1: a read-blocked cell contributes nothing, the previous value carries', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, { noteFont: 'Eczar' }, null]);
        song.sections[1].displayOptionGates = { readBlocked: ['noteFont'] };
        expect(resolveDisplayOptions(song, 2).values.noteFont).toBe('Cardo');
    });

    test('cell read gate = cell ignored: the key inherits an earlier value or the default', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, { noteFont: 'Eczar' }]);
        song.sections[1].displayOptionGates = { readBlocked: ['noteFont'] };
        const r = resolveDisplayOptions(song, 1);
        expect(r.values.noteFont).toBe('Cardo');
        expect(r.entries.noteFont).toEqual({ source: 'stored', sectionIndex: 0 });
    });

    test('cell read gate on the only stored cell: the key still counts as automated, so the default applies', () => {
        // autoColor OFF stored in Section 0 only, then cell-read-blocked
        const song = mkSong([{ autoColor: false }, null]);
        song.sections[0].displayOptionGates = { readBlocked: ['autoColor'] };
        expect(getAutomatedKeys(song).has('autoColor')).toBe(true);
        for (const idx of [0, 1]) {
            const r = resolveDisplayOptions(song, idx);
            expect(r.values.autoColor).toBe(true);
            expect(r.entries.autoColor.source).toBe('default');
        }
    });

    test('R2: row and column read gates at the target Section leave the control alone', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, null]);
        song.sections[1].displayOptionGates = { readBlocked: ['*'] };
        expect(Object.keys(resolveDisplayOptions(song, 1).values)).toEqual([]);
        song.sections[1].displayOptionGates = undefined;
        song.displayOptionGates = { readBlocked: ['noteFont'] };
        const r = resolveDisplayOptions(song, 1);
        expect('noteFont' in r.values).toBe(false);
        expect(r.entries.noteFont.source).toBe('blocked');
    });


    test('column read gate blocks everywhere; adapter blocks NoteDisplaySizes until presentationMode', () => {
        const size = { width: '40px', height: '30px', NoteFontSize: 12 };
        const song = mkSong([{ NoteDisplaySizes: size, noteFont: 'Cardo' }]);
        expect('NoteDisplaySizes' in resolveDisplayOptions(song, 0).values).toBe(false);
        song.presentationMode = true;
        expect(resolveDisplayOptions(song, 0).values.NoteDisplaySizes).toEqual(size);
        song.displayOptionGates = { readBlocked: ['noteFont'] };
        expect('noteFont' in resolveDisplayOptions(song, 0).values).toBe(false);
        expect(getAutomatedKeys(song).has('noteFont')).toBe(false);
    });

    test('render completes from live; apply result is not mutated into the stored block', () => {
        const song = mkSong([{ noteFont: 'Cardo' }]);
        const live = { noteFont: 'Vollkorn', showMidiNum: true, currentColorDict: 'x' };
        const r = resolveDisplayOptions(song, 0, { purpose: 'render', live });
        expect(r.values.noteFont).toBe('Cardo');
        expect(r.values.showMidiNum).toBe(true);
        expect(r.entries.showMidiNum.source).toBe('live');
        r.values.noteFont = 'changed';
        expect(song.sections[0].displayOptions.noteFont).toBe('Cardo');
    });

    test('baseline: cascade of earlier Sections, then defaults, then syncLive for default-less keys', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, { noteFont: 'Eczar' }]);
        const syncLive = { currentColorDict: 'Dict', noteFont: 'Ignored' };
        const { values, entries } = resolveDisplayOptions(song, 1, { purpose: 'baseline', syncLive });
        expect(values.noteFont).toBe('Cardo');
        expect(values.showCellNotes).toBe(true);
        expect(values.currentColorDict).toBe('Dict');
        expect(entries.currentColorDict.source).toBe('sync');
        expect(entries.showCellNotes.source).toBe('default');
    });

    test('out of range index', () => {
        expect(resolveDisplayOptions(mkSong([null]), 5)).toEqual({ values: {}, entries: {} });
    });
});

describe('displayOptionsPlan', () => {
    beforeEach(() => resetUndoForTests());

    test('keysInSyncWithModel: a Store Cell that brings the model level with the controls leaves nothing unsaved (it6 round 2)', () => {
        const song = mkSong([{ functionSymbols: 'kanji' }]);
        const live = { ...DISPLAY_OPTIONS_DEFAULTS, functionSymbols: 'function' };
        expect(keysInSyncWithModel(song, 0, live, {})).not.toContain('functionSymbols');
        song.sections[0].displayOptions.functionSymbols = 'function';
        expect(keysInSyncWithModel(song, 0, live, {})).toContain('functionSymbols');
        // a key with no cell, no default and a stale snapshot stays out of sync
        expect(keysInSyncWithModel(song, 0, { ...live, currentColorDict: 'B' }, { currentColorDict: 'A' })).not.toContain('currentColorDict');
        expect(keysInSyncWithModel(song, 0, { ...live, currentColorDict: 'B' }, { currentColorDict: 'B' })).toContain('currentColorDict');
    });

    test('SaveDiff writes only changed cells', () => {
        const song = mkSong([null, null]);
        const live = { ...DISPLAY_OPTIONS_DEFAULTS, noteFont: 'Cardo', currentColorDict: 'D' };
        const plan = planSaveDiff(song, 1, live, { currentColorDict: 'D' });
        expect(plan.ops.map((o) => o.key)).toEqual(['noteFont']);
        const res = applyPlan(song, plan);
        expect(res.changed).toBe(true);
        expect(song.sections[1].displayOptions).toEqual({ noteFont: 'Cardo' });
        expect(song.sections[0].displayOptions).toBeUndefined();
    });

    test('SaveDiff against an inherited value; reverting to the baseline removes the redundant cell', () => {
        const song = mkSong([{ showCellNotes: false }, { showCellNotes: true }]);
        // live goes back to what Section 0 gives
        const live = { ...DISPLAY_OPTIONS_DEFAULTS, showCellNotes: false };
        const plan = planSaveDiff(song, 1, live);
        expect(plan.ops).toEqual([{ type: 'deleteCell', sectionIndex: 1, key: 'showCellNotes', note: 'redundant' }]);
        applyPlan(song, plan);
        expect(song.sections[1].displayOptions).toBeUndefined();
    });

    test('Round 5: an undefined/null live value (e.g. no currentColorDict yet) is never stored', () => {
        const song = mkSong([null]);
        const live = { noteFont: 'Cardo', currentColorDict: undefined, sectionTheme: null };
        // the dirty baseline is JSON-cloned, so undefined keys vanish from it: mirror that
        const syncLive = JSON.parse(JSON.stringify(live));
        const diff = planSaveDiff(song, 0, live, syncLive);
        expect(diff.ops.map((o) => o.key)).toEqual(['noteFont']);
        expect(planSaveAll(song, 0, live).ops.map((o) => o.key)).toEqual(['noteFont']);
        applyPlan(song, diff);
        expect(Object.keys(song.sections[0].displayOptions)).toEqual(['noteFont']);
    });

    test('SaveDiff updates an existing cell and skips write-blocked cells; a read block never stops a write (it7)', () => {
        const song = mkSong([{ noteFont: 'Cardo' }], { displayOptionGates: { writeBlocked: ['showMidiNum'] } });
        song.sections[0].displayOptionGates = { readBlocked: ['hideTinyNotes'] };
        const live = { ...DISPLAY_OPTIONS_DEFAULTS, noteFont: 'Eczar', showMidiNum: true, hideTinyNotes: true };
        const plan = planSaveDiff(song, 0, live);
        expect(plan.ops.map((o) => `${o.type}:${o.key}`).sort()).toEqual(['setCell:hideTinyNotes', 'setCell:noteFont']);
        expect(plan.skipped).toEqual([
            { key: 'showMidiNum', reason: 'write-blocked' }
        ]);
        applyPlan(song, plan);
        expect(song.sections[0].displayOptions.noteFont).toBe('Eczar');
        expect(song.sections[0].displayOptions.hideTinyNotes).toBe(true);
    });

    test('it7: a read-blocked stored cell is dormant: SaveDiff does not delete or overwrite it while the control shows the inherited value', () => {
        const song = mkSong([{ noteFont: 'Eczar' }, { noteFont: 'Cardo' }]);
        song.sections[1].displayOptionGates = { readBlocked: ['noteFont'] };
        // after Apply the control shows what Section 2 inherits (Section 1's Eczar), not the ignored cell
        const live = { ...DISPLAY_OPTIONS_DEFAULTS, noteFont: 'Eczar' };
        const plan = planSaveDiff(song, 1, live);
        expect(plan.ops).toEqual([]);
        expect(keysInSyncWithModel(song, 1, live, {})).toContain('noteFont');
        // a control the author changed by hand is written, and the block stays
        const changed = planSaveDiff(song, 1, { ...live, noteFont: 'Lora' });
        expect(changed.ops).toEqual([{ type: 'setCell', sectionIndex: 1, key: 'noteFont', value: 'Lora' }]);
        applyPlan(song, changed);
        expect(song.sections[1].displayOptionGates).toEqual({ readBlocked: ['noteFont'] });
    });

    test('it7: Save All and Store Cell write read-blocked cells', () => {
        const song = mkSong([null], { displayOptionGates: { readBlocked: ['noteFont'] } });
        song.sections[0].displayOptionGates = { readBlocked: ['*'] };
        const live = { ...DISPLAY_OPTIONS_DEFAULTS, noteFont: 'Eczar' };
        const all = planSaveAll(song, 0, live);
        expect(all.skipped.map((s) => s.reason)).not.toContain('read-blocked');
        expect(all.ops.map((o) => o.key)).toContain('noteFont');
    });

    test('adapter-gated keys are skipped by SaveDiff and SaveAll', () => {
        const song = mkSong([null]);
        const live = { ...DISPLAY_OPTIONS_DEFAULTS, NoteDisplaySizes: { width: '1', height: '2', NoteFontSize: 3 }, sectionTheme: 'x' };
        expect(planSaveAll(song, 0, live).skipped.map((s) => s.key).sort()).toEqual(['NoteDisplaySizes', 'sectionTheme']);
        song.presentationMode = true;
        song.allowThemeAutomation = true;
        const plan = planSaveAll(song, 0, live);
        expect(plan.skipped).toEqual([]);
        applyPlan(song, plan);
        expect(song.sections[0].displayOptions.sectionTheme).toBe('x');
    });

    test('SaveAll writes every key, and is a no-op when everything matches', () => {
        const song = mkSong([null]);
        const live = { ...DISPLAY_OPTIONS_DEFAULTS };
        applyPlan(song, planSaveAll(song, 0, live));
        expect(Object.keys(song.sections[0].displayOptions).sort()).toEqual(Object.keys(live).sort());
        const again = planSaveAll(song, 0, live);
        expect(again.ops).toEqual([]);
        expect(applyPlan(song, again).changed).toBe(false);
    });

    test('Clear honors only explicit write blocks, not read blocks (Round 3 Q6); empty block is deleted', () => {
        const song = mkSong([{ noteFont: 'Cardo', showMidiNum: true, hideTinyNotes: true }]);
        song.sections[0].displayOptionGates = { readBlocked: ['*'], writeBlocked: ['showMidiNum'] };
        const plan = planClear(song, 0);
        expect(plan.skipped).toEqual([{ key: 'showMidiNum', reason: 'write-blocked' }]);
        applyPlan(song, plan);
        expect(song.sections[0].displayOptions).toEqual({ showMidiNum: true });
        song.sections[0].displayOptionGates = { readBlocked: ['*'] };
        applyPlan(song, planClear(song, 0));
        expect(song.sections[0].displayOptions).toBeUndefined();
        // gates are never touched
        expect(song.sections[0].displayOptionGates).toEqual({ readBlocked: ['*'] });
    });

    test('Clear of a cell stored under an adapter block still works', () => {
        const song = mkSong([{ NoteDisplaySizes: { width: '1', height: '2', NoteFontSize: 3 } }]);
        applyPlan(song, planClear(song, 0));
        expect(song.sections[0].displayOptions).toBeUndefined();
    });

    test('clear one cell', () => {
        const song = mkSong([{ noteFont: 'Cardo', showMidiNum: true }]);
        applyPlan(song, planClearCell(song, 0, 'noteFont'));
        expect(song.sections[0].displayOptions).toEqual({ showMidiNum: true });
        expect(planClearCell(song, 0, 'noteFont').unchanged).toBe(1);
        expect(() => planClearCell(song, 0, 'nope')).toThrow();
        song.displayOptionGates = { writeBlocked: ['showMidiNum'] };
        expect(planClearCell(song, 0, 'showMidiNum').skipped).toHaveLength(1);
    });

    test('gate ops: column, row, cell, and removal', () => {
        const song = mkSong([null, null]);
        applyPlan(song, planGate(song, { scope: 'column', key: 'noteFont', direction: 'read' }));
        expect(song.displayOptionGates).toEqual({ readBlocked: ['noteFont'] });
        applyPlan(song, planGate(song, { scope: 'row', sectionIndex: 1, direction: 'both' }));
        expect(song.sections[1].displayOptionGates).toEqual({ readBlocked: ['*'], writeBlocked: ['*'] });
        applyPlan(song, planGate(song, { scope: 'cell', sectionIndex: 0, key: 'showMidiNum', direction: 'write' }));
        expect(song.sections[0].displayOptionGates).toEqual({ writeBlocked: ['showMidiNum'] });
        applyPlan(song, planGate(song, { scope: 'cell', sectionIndex: 0, key: 'showMidiNum', direction: 'write', on: false }));
        expect(song.sections[0].displayOptionGates).toBeUndefined();
        expect(() => planGate(song, { scope: 'row', sectionIndex: 9 })).toThrow();
        expect(() => planGate(song, { scope: 'column', key: 'nope' })).toThrow();
    });

    test('undo restores displayOptions and gates; one level; only for the same song', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, null]);
        applyPlan(song, planGate(song, { scope: 'column', key: 'noteFont', direction: 'read' }));
        expect(canUndoDisplayOptionsOp(song)).toBe(true);
        undoLastDisplayOptionsOp(song);
        expect(song.displayOptionGates).toBeUndefined();
        expect(undoLastDisplayOptionsOp(song).changed).toBe(false);

        applyPlan(song, planClear(song, 0));
        expect(song.sections[0].displayOptions).toBeUndefined();
        const res = undoLastDisplayOptionsOp(song);
        expect(res.changed).toBe(true);
        expect(song.sections[0].displayOptions).toEqual({ noteFont: 'Cardo' });

        applyPlan(song, planClear(song, 0));
        expect(canUndoDisplayOptionsOp(mkSong([null]))).toBe(false);
    });

    test('a no-op plan does not disturb the previous undo', () => {
        const song = mkSong([{ noteFont: 'Cardo' }]);
        applyPlan(song, planClear(song, 0));
        applyPlan(song, planClear(song, 0));
        undoLastDisplayOptionsOp(song);
        expect(song.sections[0].displayOptions).toEqual({ noteFont: 'Cardo' });
    });

    test('report text mentions written, removed and skipped keys', () => {
        const song = mkSong([{ showMidiNum: true }], { displayOptionGates: { writeBlocked: ['hideFingering'] } });
        const live = { ...DISPLAY_OPTIONS_DEFAULTS, noteFont: 'Cardo', hideFingering: true };
        const res = applyPlan(song, planSaveDiff(song, 0, live));
        expect(res.report).toContain('Section 1');
        expect(res.report).toContain('wrote');
        expect(res.report).toContain('hideFingering (write-blocked)');
    });
});
