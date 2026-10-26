import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    TOOLS, ZONES, DEFAULT_TOOL_ID, getTool, isToolLegalInZone, sectionHeaderNavigates, isGateSet, planToggleGate, planAffectsApply,
    describeCell, planMatrixClick
} from '../../templates/display-options/displayOptionsMatrixTools.js';
import {
    buildMatrixHtml, buildSectionRowHtml, buildLiveRowHtml, buildDefaultsRowHtml, buildLegendHtml, buildLegendSong,
    groupRuns, LEGEND_KEYS, CLIP_TITLE_LENGTH, WANT_LITERAL_ROWMARK_TEXT, WANT_LITERAL_COLMARK_TEXT
} from '../../templates/display-options/displayOptionsMatrixView.js';
import { cellText, cellState } from '../../templates/display-options/displayOptionsCellRules.js';
import { DISPLAY_OPTION_KEYS } from '../../templates/display-options/displayOptionsMeta.js';
import {
    planStoreCell, applyPlan, undoLastDisplayOptionsOp, canUndoDisplayOptionsOp, resetUndoForTests
} from '../../templates/display-options/displayOptionsPlan.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function mkSong(blocks, extra = {}) {
    return {
        presentationMode: true,
        allowThemeAutomation: true,
        sections: blocks.map((b) => ({ displayOptions: b ?? undefined })),
        ...extra
    };
}

const snap = (song) => JSON.parse(JSON.stringify({ g: song.displayOptionGates ?? null, s: song.sections }));
const clickOn = (song, toolId, zone, target = {}, ctx = {}) => planMatrixClick(song, toolId, zone, target, ctx);

beforeEach(() => resetUndoForTests());

describe('Matrix tools: legality', () => {
    test('the tool list is the ten approved tools, Inspect first', () => {
        expect(TOOLS.map((t) => t.id)).toEqual([
            'inspect', 'clearSection', 'clearCell', 'storeCell', 'keyRead', 'keyWrite', 'sectionRead', 'sectionWrite', 'cellRead', 'cellWrite'
        ]);
        expect(DEFAULT_TOOL_ID).toBe('inspect');
        expect(getTool('nope')).toBeNull();
    });

    test('no Tool is one-shot: the selected Tool stays selected (Round 4)', () => {
        expect(TOOLS.some((t) => 'oneShot' in t)).toBe(false);
        const song = mkSong([{ noteFont: 'a' }]);
        for (const tool of TOOLS) {
            const result = clickOn(song, tool.id, ZONES.cell, { sectionIndex: 0, key: 'noteFont' }, { live: { noteFont: 'b' } });
            expect(result).not.toHaveProperty('oneShot');
        }
    });

    test('a Section number acts as a Tool target only for Clear Section, Section r and Section w; otherwise it navigates (Round 4)', () => {
        const song = mkSong([{ noteFont: 'a' }, null]);
        const acting = TOOLS.filter((t) => t.actsOnSectionRow).map((t) => t.id);
        expect(acting).toEqual(['clearSection', 'sectionRead', 'sectionWrite']);
        for (const tool of TOOLS) {
            const result = clickOn(song, tool.id, ZONES.sectionHeader, { sectionIndex: 1 });
            if (acting.includes(tool.id)) {
                expect(result.kind).toBe('plan');
                expect(sectionHeaderNavigates(tool.id)).toBe(false);
            } else {
                expect(result).toEqual({ kind: 'navigate', sectionIndex: 1 });
                expect(sectionHeaderNavigates(tool.id)).toBe(true);
            }
            expect(isToolLegalInZone(tool.id, ZONES.sectionHeader)).toBe(true);
        }
    });

    test('navigating from a Section number changes nothing in the model', () => {
        const song = mkSong([{ noteFont: 'a' }, null]);
        const before = snap(song);
        for (const id of ['clearCell', 'keyRead', 'keyWrite', 'cellRead', 'cellWrite', 'storeCell']) {
            clickOn(song, id, ZONES.sectionHeader, { sectionIndex: 0 }, { live: { noteFont: 'b' } });
        }
        expect(snap(song)).toEqual(before);
        expect(canUndoDisplayOptionsOp(song)).toBe(false);
    });

    test('Key tools show the column overlay, Section tools the row overlay (Q10)', () => {
        expect(getTool('keyRead').overlay).toBe('column');
        expect(getTool('keyWrite').overlay).toBe('column');
        expect(getTool('sectionRead').overlay).toBe('row');
        expect(getTool('sectionWrite').overlay).toBe('row');
        expect(getTool('cellRead').overlay).toBeNull();
    });

    test('every tool x zone: a never-clickable zone is a silent no-op for every tool', () => {
        const song = mkSong([{ noteFont: 'a' }]);
        const target = { sectionIndex: 0, key: 'noteFont' };
        for (const tool of TOOLS) {
            for (const zone of [ZONES.corner, ZONES.groupHeader, ZONES.specialLabel, ZONES.sectionLabel]) {
                expect(clickOn(song, tool.id, zone, target)).toEqual({ kind: 'none' });
            }
        }
    });

    test('a click is acted on exactly in the tool zones', () => {
        const song = mkSong([{ noteFont: 'a' }]);
        const target = { sectionIndex: 0, key: 'noteFont' };
        for (const tool of TOOLS) {
            for (const zone of [ZONES.keyHeader, ZONES.specialCell, ZONES.sectionHeader, ZONES.cell]) {
                const result = clickOn(song, tool.id, zone, target, { live: { noteFont: 'b' } });
                expect(isToolLegalInZone(tool.id, zone)).toBe(result.kind !== 'none');
            }
        }
    });

    test('Section tools do not work in special rows, Key tools do', () => {
        const song = mkSong([null]);
        expect(clickOn(song, 'sectionRead', ZONES.specialCell, { key: 'noteFont' })).toEqual({ kind: 'none' });
        expect(clickOn(song, 'keyRead', ZONES.specialCell, { key: 'noteFont' }).kind).toBe('plan');
    });

    test('a click with a bad Section or key is a no-op, not an exception', () => {
        const song = mkSong([null]);
        expect(clickOn(song, 'keyRead', ZONES.keyHeader, { key: 'bogus' })).toEqual({ kind: 'none' });
        expect(clickOn(song, 'sectionRead', ZONES.sectionHeader, { sectionIndex: 9 })).toEqual({ kind: 'none' });
        expect(clickOn(song, 'nope', ZONES.cell, { sectionIndex: 0, key: 'noteFont' })).toEqual({ kind: 'none' });
    });
});

describe('Matrix tools: gate toggles', () => {
    const cases = [
        ['keyRead', ZONES.keyHeader, 'column', 'read'],
        ['keyRead', ZONES.cell, 'column', 'read'],
        ['keyWrite', ZONES.specialCell, 'column', 'write'],
        ['sectionRead', ZONES.sectionHeader, 'row', 'read'],
        ['sectionWrite', ZONES.cell, 'row', 'write'],
        ['cellRead', ZONES.cell, 'cell', 'read'],
        ['cellWrite', ZONES.cell, 'cell', 'write']
    ];

    test.each(cases)('%s on %s toggles the %s %s gate and two clicks round-trip', (toolId, zone, scope, side) => {
        const song = mkSong([{ noteFont: 'a', showMidiNum: true }, { noteFont: 'b' }]);
        const before = snap(song);
        const target = { sectionIndex: 1, key: 'noteFont' };
        const probe = { scope, sectionIndex: scope === 'column' ? null : 1, key: 'noteFont', side };

        expect(isGateSet(song, probe)).toBe(false);
        const first = clickOn(song, toolId, zone, target);
        expect(first.kind).toBe('plan');
        expect(first.plan.ops[0].on).toBe(true);
        applyPlan(song, first.plan);
        expect(isGateSet(song, probe)).toBe(true);
        expect(snap(song).s.map((s) => s.displayOptions)).toEqual(before.s.map((s) => s.displayOptions)); // values untouched

        const second = clickOn(song, toolId, zone, target);
        expect(second.plan.ops[0].on).toBe(false);
        applyPlan(song, second.plan);
        expect(snap(song)).toEqual(before);
    });

    test('a read gate and a write gate on the same place are independent', () => {
        const song = mkSong([{ noteFont: 'a' }]);
        applyPlan(song, planToggleGate(song, { scope: 'column', key: 'noteFont', side: 'read' }));
        applyPlan(song, planToggleGate(song, { scope: 'column', key: 'noteFont', side: 'write' }));
        expect(song.displayOptionGates).toEqual({ readBlocked: ['noteFont'], writeBlocked: ['noteFont'] });
        applyPlan(song, planToggleGate(song, { scope: 'column', key: 'noteFont', side: 'read' }));
        expect(song.displayOptionGates).toEqual({ writeBlocked: ['noteFont'] });
    });

    test('a column gate and a cell gate on the same key do not interfere', () => {
        const song = mkSong([{ noteFont: 'a' }]);
        applyPlan(song, clickOn(song, 'keyRead', ZONES.keyHeader, { key: 'noteFont' }).plan);
        applyPlan(song, clickOn(song, 'cellRead', ZONES.cell, { sectionIndex: 0, key: 'noteFont' }).plan);
        expect(song.displayOptionGates.readBlocked).toEqual(['noteFont']);
        expect(song.sections[0].displayOptionGates.readBlocked).toEqual(['noteFont']);
        applyPlan(song, clickOn(song, 'keyRead', ZONES.keyHeader, { key: 'noteFont' }).plan);
        expect(song.displayOptionGates).toBeUndefined();
        expect(song.sections[0].displayOptionGates.readBlocked).toEqual(['noteFont']);
    });

    test('one click is one Undo', () => {
        const song = mkSong([{ noteFont: 'a' }]);
        const before = snap(song);
        applyPlan(song, clickOn(song, 'sectionWrite', ZONES.sectionHeader, { sectionIndex: 0 }).plan);
        expect(canUndoDisplayOptionsOp(song)).toBe(true);
        undoLastDisplayOptionsOp(song);
        expect(snap(song)).toEqual(before);
    });
});

describe('Matrix tools: clear and store', () => {
    test('Clear Section removes values only, never gates, and works on a non-Current Section', () => {
        const song = mkSong([{ noteFont: 'a' }, { noteFont: 'b', showMidiNum: true }], {
            displayOptionGates: { readBlocked: ['noteFont'] }
        });
        song.sections[1].displayOptionGates = { readBlocked: ['showMidiNum'] };
        const result = clickOn(song, 'clearSection', ZONES.cell, { sectionIndex: 1, key: 'noteFont' });
        expect(result.kind).toBe('plan');
        applyPlan(song, result.plan);
        expect(song.sections[1].displayOptions).toBeUndefined();
        expect(song.sections[1].displayOptionGates).toEqual({ readBlocked: ['showMidiNum'] });
        expect(song.displayOptionGates).toEqual({ readBlocked: ['noteFont'] });
        expect(song.sections[0].displayOptions).toEqual({ noteFont: 'a' });
    });

    test('Clear Section skips write-blocked cells and reports them', () => {
        const song = mkSong([{ noteFont: 'a', showMidiNum: true }]);
        song.sections[0].displayOptionGates = { writeBlocked: ['showMidiNum'] };
        const { plan } = clickOn(song, 'clearSection', ZONES.sectionHeader, { sectionIndex: 0 });
        const { report } = applyPlan(song, plan);
        expect(song.sections[0].displayOptions).toEqual({ showMidiNum: true });
        expect(report).toContain('skipped showMidiNum (write-blocked)');
    });

    test('Clear Cell removes one cell and nothing else', () => {
        const song = mkSong([{ noteFont: 'a', showMidiNum: true }]);
        applyPlan(song, clickOn(song, 'clearCell', ZONES.cell, { sectionIndex: 0, key: 'noteFont' }).plan);
        expect(song.sections[0].displayOptions).toEqual({ showMidiNum: true });
    });

    test('Store Cell writes the live value into that one cell', () => {
        const song = mkSong([null, { noteFont: 'b' }]);
        const live = { noteFont: 'Live', showMidiNum: true };
        const result = clickOn(song, 'storeCell', ZONES.cell, { sectionIndex: 0, key: 'noteFont' }, { live });
        expect(result.kind).toBe('plan');
        applyPlan(song, result.plan);
        expect(song.sections[0].displayOptions).toEqual({ noteFont: 'Live' });
        expect(song.sections[1].displayOptions).toEqual({ noteFont: 'b' });
    });

    test('Store Cell honors read gates, write gates, adapter gates, and missing live values', () => {
        const song = mkSong([null], { presentationMode: false });
        const live = { noteFont: 'L', showMidiNum: true, NoteDisplaySizes: { width: '1px' }, hideTinyNotes: undefined };
        song.displayOptionGates = { readBlocked: ['noteFont'] };
        song.sections[0].displayOptionGates = { writeBlocked: ['showMidiNum'] };
        const why = (key) => planStoreCell(song, 0, key, live).skipped[0]?.reason;
        expect(why('noteFont')).toBe('read-blocked');
        expect(why('showMidiNum')).toBe('write-blocked');
        expect(why('NoteDisplaySizes')).toBe('presentationMode is off');
        expect(why('hideTinyNotes')).toBe('no live value');
        expect(why('autoColor')).toBe('no live value');
    });

    test('Store Cell of an identical stored value is "unchanged"', () => {
        const song = mkSong([{ noteFont: 'a' }]);
        const plan = planStoreCell(song, 0, 'noteFont', { noteFont: 'a' });
        expect(plan.ops).toEqual([]);
        expect(plan.unchanged).toBe(1);
    });
});

describe('Matrix tools: does Apply change? (the "controls not re-applied" hint)', () => {
    const toggle = (song, scope, sectionIndex, key, side) => planToggleGate(song, { scope, sectionIndex, key, side });
    const song = mkSong([{ noteFont: 'a' }, { noteFont: 'b' }, { noteFont: 'c' }]);

    test('read gates at or before the Current Section, and column gates, can change Apply', () => {
        expect(planAffectsApply(toggle(song, 'column', null, 'noteFont', 'read'), 1)).toBe(true);
        expect(planAffectsApply(toggle(song, 'row', 1, '*', 'read'), 1)).toBe(true);
        expect(planAffectsApply(toggle(song, 'cell', 0, 'noteFont', 'read'), 1)).toBe(true);
    });

    test('write gates never change Apply; later Sections cannot change the Current Section', () => {
        expect(planAffectsApply(toggle(song, 'column', null, 'noteFont', 'write'), 1)).toBe(false);
        expect(planAffectsApply(toggle(song, 'row', 1, '*', 'write'), 1)).toBe(false);
        expect(planAffectsApply(toggle(song, 'row', 2, '*', 'read'), 1)).toBe(false);
        expect(planAffectsApply(toggle(song, 'cell', 2, 'noteFont', 'read'), 1)).toBe(false);
    });

    test('clears at or before the Current Section change Apply; Store Cell does not', () => {
        const clear0 = clickOn(song, 'clearSection', ZONES.sectionHeader, { sectionIndex: 0 }).plan;
        const clear2 = clickOn(song, 'clearSection', ZONES.sectionHeader, { sectionIndex: 2 }).plan;
        const store = planStoreCell(song, 1, 'showMidiNum', { showMidiNum: true });
        expect(planAffectsApply(clear0, 1)).toBe(true);
        expect(planAffectsApply(clear2, 1)).toBe(false);
        expect(planAffectsApply(store, 1)).toBe(false);
    });

    test('a plan with no ops changes nothing', () => {
        const empty = clickOn(song, 'clearCell', ZONES.cell, { sectionIndex: 0, key: 'showMidiNum' }).plan;
        expect(planAffectsApply(empty, 0)).toBe(false);
    });
});

describe('Matrix tools: Inspect', () => {
    test('a Section header navigates', () => {
        const song = mkSong([null, null]);
        expect(clickOn(song, 'inspect', ZONES.sectionHeader, { sectionIndex: 1 })).toEqual({ kind: 'navigate', sectionIndex: 1 });
    });

    test('inspecting never changes the model', () => {
        const song = mkSong([{ noteFont: 'a' }]);
        const before = snap(song);
        clickOn(song, 'inspect', ZONES.cell, { sectionIndex: 0, key: 'noteFont' });
        clickOn(song, 'inspect', ZONES.keyHeader, { key: 'noteFont' });
        expect(snap(song)).toEqual(before);
        expect(canUndoDisplayOptionsOp(song)).toBe(false);
    });

    test('stored and inherited values, with provenance', () => {
        const song = mkSong([{ noteFont: 'Eczar' }, { noteFont: 'Cardo' }, null]);
        const stored = describeCell(song, 1, 'noteFont');
        expect(stored.title).toBe('Section 2, noteFont');
        expect(stored.lines[0]).toContain('stored here: Cardo');
        expect(stored.lines[0]).toContain('Eczar (stored of Section 1)');
        expect(stored.lines[1]).toBe('gates: none');
        const inherits = describeCell(song, 2, 'noteFont');
        expect(inherits.lines[0]).toContain('no stored cell; the Section inherits: Cardo (stored of Section 2)');
    });

    test('a cell read gate says the stored cell is ignored; a column read gate says the control is left alone', () => {
        const song = mkSong([{ noteFont: 'Eczar' }, { noteFont: 'Cardo' }]);
        song.sections[1].displayOptionGates = { readBlocked: ['noteFont'] };
        const cell = describeCell(song, 1, 'noteFont').lines.join('\n');
        expect(cell).toContain('gates: cell read-blocked');
        expect(cell).toContain('this stored cell is ignored');
        song.displayOptionGates = { readBlocked: ['noteFont'] };
        const col = describeCell(song, 1, 'noteFont').lines.join('\n');
        expect(col).toContain('leaves the noteFont control alone');
    });

    test('write gates: SAVE Diff skips; Clear skips only for explicit gates; adapter gates are explained', () => {
        const song = mkSong([{ noteFont: 'a' }], { presentationMode: false });
        song.sections[0].displayOptionGates = { writeBlocked: ['*'] };
        const row = describeCell(song, 0, 'noteFont').lines.join('\n');
        expect(row).toContain('row write-blocked');
        expect(row).toContain('SAVE Diff and Save All skip this cell; Clear skips it.');
        const adapter = describeCell(mkSong([{ noteFont: 'a' }], { presentationMode: false }), 0, 'NoteDisplaySizes').lines.join('\n');
        expect(adapter).toContain('presentationMode is off');
        expect(adapter).not.toContain('Clear skips it');
    });

    test('header and special cells: group, default, live, column gates', () => {
        const song = mkSong([null]);
        song.displayOptionGates = { writeBlocked: ['noteFont'] };
        const info = describeCell(song, null, 'noteFont', { live: { noteFont: 'Live' } });
        expect(info.title).toBe('noteFont');
        expect(info.lines[0]).toBe('group: Fonts; default: EB Garamond; song default: (none); live: Live');
        expect(info.lines[1]).toBe('gates: column write-blocked');
        expect(describeCell(song, null, 'sectionTheme').lines[0]).toContain('(no default)');
    });
});

describe('shared cell rules (also used by /vdd)', () => {
    test('cellText: /vdd blanks false, the Matrix draws a cross', () => {
        expect(cellText(true)).toBe('\u2713');
        expect(cellText(false)).toBe('');
        expect(cellText(false, { boolMarks: true })).toBe('\u2717');
        expect(cellText({ caption: 'Big' })).toBe('Big');
        expect(cellText(undefined)).toBe('');
        expect(cellText(35)).toBe('35');
    });

    test('cellState', () => {
        expect(cellState({ noteFont: 'a' }, 'noteFont', { noteFont: 'a' })).toBe('same');
        expect(cellState({ noteFont: 'a' }, 'noteFont', { noteFont: 'b' })).toBe('changed');
        expect(cellState({ noteFont: 'a' }, 'noteFont', {})).toBe('changed');
        expect(cellState({}, 'noteFont', {})).toBe('absent');
        expect(cellState(undefined, 'noteFont', {})).toBe('absent');
    });
});

describe('Matrix wiring (source checks; the browser behavior is checked in UI acceptance)', () => {
    const read = (rel) => fs.readFileSync(path.join(here, '../..', rel), 'utf8');

    test('every floating-window disposal docks the Matrix first (Q7)', () => {
        const core = read('infinite-neck.js');
        expect(core.match(/DisplayOptionsMatrixBuilder\.dockBeforeDispose\(\);[^\n]*\n\s*disposeAllDockables\(\);/g)).toHaveLength(2);
        expect(read('key-handlers.js')).toMatch(/dockDivInPage\('divDisplayOptionsMatrix'\);[^\n]*\n\s*disposeAllDockables\(\);/);
    });

    test('the Matrix is mounted, linked, and hosted on the View page', () => {
        expect(read('infinite-neck.js')).toContain("DisplayOptionsMatrixBuilder.addToDest('#divDisplayOptionsMatrixHost')");
        const html = read('index.html');
        expect(html).toContain('templates/display-options/display-options.css');
        expect(html).toContain('id="divDisplayOptionsMatrixHost"');
        expect(html).toContain('id="btnToggleDisplayOptionsMatrix"');
    });

    test('the template has the buttons, the Float button id dockable.js expects, and the host elements', () => {
        const tpl = read('templates/display-options/display-options.html');
        for (const id of ['divDisplayOptionsMatrix', 'btnSaveDiff_Matrix', 'btnSaveAll_Matrix', 'btnApply_Matrix', 'cbAutoApply_Matrix', 'btnUndo_Matrix',
            'btnFloatSection_divDisplayOptionsMatrix', 'btnViewColumnGates_Matrix', 'btnViewRowGates_Matrix', 'dmTools', 'dmStatus', 'dmScroll', 'dmTableHost', 'btnLegend_Matrix', 'dmLegend',
            'btnCurrentSectionToSongDisplayOptions', 'btnClearSongDisplayOptions']) {
            expect(tpl).toContain(`id="${id}"`);
        }
    });

    test('the Matrix is quiet: its calls pass quiet, and the core only opens Messages when not quiet', () => {
        const builder = read('templates/display-options/display-options.builder.js');
        expect(builder).not.toMatch(/showMessages/);
        expect(builder.match(/quiet: true/g).length).toBeGreaterThanOrEqual(4);
        expect(read('infinite-neck.js')).toMatch(/if \(!options\.quiet\)\{\s*Messages\.showMessages\(html\);/);
    });

    test('SAVE Diff dirty highlight reaches the Matrix button, and the Matrix inputs do not light up SAVE Diff', () => {
        const core = read('infinite-neck.js');
        expect(core).toContain("$('#btnSaveDiff_View, #btnSaveDiff_Matrix').toggleClass('riskyButtonActionRequired'");
        expect(core).toContain(':not(#divDisplayOptionsMatrix *)');
    });

    test('the controls and adapter handlers publish the events the Matrix listens to', () => {
        const core = read('infinite-neck.js');
        expect(core).toContain("EventBus.trigger('DisplayOptions:liveChanged'");
        expect(core.match(/adapter: true/g)).toHaveLength(2);
    });

    test('the CSS defines every class the view emits', () => {
        const css = read('templates/display-options/display-options.css');
        for (const cls of ['dmColGateR', 'dmColGateW', 'dmRowGateR', 'dmRowGateW', 'dmCellGateR', 'dmCellGateW', 'dmAdapter', 'dmAbsent', 'dmStored', 'dmChanged',
            'dmCurrentRow', 'dmHot', 'dmIllegal', 'dmShowColGates', 'dmShowRowGates']) {
            expect(css).toContain(cls);
        }
    });
});

describe('Matrix view', () => {
    const count = (text, re) => (text.match(re) || []).length;

    test('every Section is a row, even one that stores nothing, and absent cells are dmAbsent', () => {
        const song = mkSong([{ noteFont: 'a' }, null, null]);
        const html = buildMatrixHtml(song, { currentIndex: 0 });
        expect(count(html, /<tr class='dmSectionRow/g)).toBe(3);
        expect(count(html, /class='dmCell dmAbsent/g)).toBe(3 * DISPLAY_OPTION_KEYS.length - 1);
        expect(html).not.toContain('dashed');
    });

    test('visual order: group row, key row, DEFAULTS, Song-DEFAULTS, LIVE, Section # label, then Sections', () => {
        const html = buildMatrixHtml(mkSong([null]), {});
        const positions = ['dmGroupRow', 'dmKeyRow', 'dmDefaultsRow', 'dmSongDefaultsRow', 'dmLiveRow', 'dmSectionLabelRow', 'dmSectionRow'].map((c) => html.indexOf(c));
        expect(positions.every((p) => p >= 0)).toBe(true);
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });

    test('the group row spans the keys: its colspans add up to the key count', () => {
        const total = groupRuns().reduce((sum, run) => sum + run.count, 0);
        expect(total).toBe(DISPLAY_OPTION_KEYS.length);
        expect(groupRuns().map((r) => r.group)).toEqual(['Color', 'Cell text', 'Layout', 'Piano', 'Hide', 'Opacity', 'Looper', 'Fonts', 'Tiny notes']);
        const html = buildMatrixHtml(mkSong([null]), {});
        expect(html).toContain("colspan='4'>Color<");
    });

    test('the Current Section is marked on its row and header only', () => {
        const html = buildMatrixHtml(mkSong([null, null, null]), { currentIndex: 1 });
        expect(count(html, /dmCurrentRow/g)).toBe(2);
        expect(html).toContain("<tr class='dmSectionRow dmCurrentRow' data-section-row='1'>");
    });

    test('stored cells: changed (green) vs same (white)', () => {
        const song = mkSong([{ noteFont: 'Cardo' }, { noteFont: 'Cardo', showMidiNum: true }]);
        const row2 = buildSectionRowHtml(song, 1);
        expect(row2).toMatch(/class='dmCell dmStored'[^>]*data-key='noteFont'>Cardo</);
        expect(row2).toMatch(/class='dmCell dmStored dmChanged'[^>]*data-key='showMidiNum'>\u2713</);
    });

    test('booleans: true is a check mark, false a cross, in cells, DEFAULTS and LIVE', () => {
        const song = mkSong([{ showMidiNum: false }]);
        expect(buildSectionRowHtml(song, 0)).toContain('>\u2717</td>');
        expect(buildDefaultsRowHtml()).toContain('>\u2717</td>');
        expect(buildLiveRowHtml({ showMidiNum: true, hideTinyNotes: false })).toContain('>\u2713</td>');
    });

    test('per-source gate classes are separate: column, row and cell', () => {
        const song = mkSong([{ noteFont: 'a', showMidiNum: true, autoColor: true }]);
        song.displayOptionGates = { readBlocked: ['noteFont'], writeBlocked: ['noteFont'] };
        song.sections[0].displayOptionGates = { readBlocked: ['*', 'showMidiNum'], writeBlocked: ['autoColor'] };
        const html = buildMatrixHtml(song, {});
        const cell = (key) => html.match(new RegExp(`<td class='([^']*)'[^>]*data-section='0' data-key='${key}'`))[1].split(' ');
        expect(cell('noteFont')).toEqual(expect.arrayContaining(['dmColGateR', 'dmColGateW', 'dmRowGateR']));
        expect(cell('noteFont')).not.toContain('dmCellGateR');
        expect(cell('showMidiNum')).toEqual(expect.arrayContaining(['dmRowGateR', 'dmCellGateR']));
        expect(cell('showMidiNum')).not.toContain('dmColGateR');
        expect(cell('autoColor')).toEqual(expect.arrayContaining(['dmRowGateR', 'dmCellGateW']));
        expect(cell('autoColor')).not.toContain('dmCellGateR');
        expect(html).toMatch(/<th class='dmKeyHeader dmColGateR dmColGateW'[^>]*data-key='noteFont'/);
        expect(html).toMatch(/<th class='dmSectionHeader dmRowGateR'/);
        expect(html).not.toContain('gateRead');
    });

    test('adapter-gated keys are marked on the header and the cells', () => {
        const song = mkSong([{ sectionTheme: 'x' }], { allowThemeAutomation: false });
        const html = buildMatrixHtml(song, {});
        expect(html).toMatch(/dmKeyHeader dmAdapter'[^>]*data-key='sectionTheme'/);
        expect(html).toContain('a:allowThemeAutomation');
        expect(html).toMatch(/dmAdapterKey'[^>]*data-key='sectionTheme'/);
    });

    test('Round 3: the adapter hint is its own line beside the key name, not a superscript', () => {
        const song = mkSong([null], { allowThemeAutomation: false });
        const html = buildMatrixHtml(song, {});
        expect(html).toContain("<span><span class='dmKeyName'>sectionTheme</span><span class='dmKeyHint' title='a:allowThemeAutomation'>a:allowThemeAutomation</span></span>");
        expect(html).not.toContain('<sup');
        const plain = buildMatrixHtml(mkSong([null]), {});
        expect(plain).not.toContain('dmKeyHint');
    });

    test('Round 3: literal row:/col: marks are off by default, and the gate is shown by classes alone', () => {
        expect(WANT_LITERAL_ROWMARK_TEXT).toBe(false);
        expect(WANT_LITERAL_COLMARK_TEXT).toBe(false);
        const song = mkSong([{ noteFont: 'a' }]);
        song.displayOptionGates = { readBlocked: ['noteFont'] };
        song.sections[0].displayOptionGates = { writeBlocked: ['*'] };
        const html = buildMatrixHtml(song, {});
        expect(html).not.toMatch(/row:[rw]/);
        expect(html).not.toMatch(/col:[rw]/);
        expect(html).not.toContain('gateMark');
        expect(html).toMatch(/<th class='dmKeyHeader dmColGateR'[^>]*data-key='noteFont'/);
        expect(html).toMatch(/<th class='dmSectionHeader dmRowGateW'/);
    });

    test('Round 3: the CSS lets the docked host shrink so the scroll container overflows', () => {
        const css = fs.readFileSync(path.join(here, '../../templates/display-options/display-options.css'), 'utf8');
        const rule = css.match(/#divDisplayOptionsMatrixHost \{[^}]*\}/)[0];
        expect(rule).toContain('min-width: 0');
        expect(rule).toMatch(/max-width: \d+%/);
    });

    test('clickable elements carry data attributes; special rows never carry data-section', () => {
        const html = buildMatrixHtml(mkSong([null]), { live: { noteFont: 'x' } });
        const special = html.slice(html.indexOf('dmDefaultsRow'), html.indexOf('</thead>'));
        expect(special).not.toContain('data-section');
        expect(special).toContain("data-zone='specialCell'");
        expect(html).toContain("data-zone='keyHeader'");
        expect(html).toContain("data-zone='sectionHeader' data-section='0'");
        expect(html).toContain("<a href='#' class='dmSectionLink' data-section='0'>1</a>");
        expect(html).toContain("data-zone='corner'");
    });

    test('long text is clipped by CSS and carries a title; short text does not', () => {
        const song = mkSong([{ noteFont: 'A very long font name indeed', tinyNoteWidth: '35%' }]);
        const row = buildSectionRowHtml(song, 0);
        expect(row).toContain("title='A very long font name indeed'");
        expect(row).not.toContain("title='35%'");
        expect('A very long font name indeed'.length).toBeGreaterThan(CLIP_TITLE_LENGTH);
    });

    test('values are escaped', () => {
        const song = mkSong([{ noteFont: '<b>x</b>' }]);
        const html = buildMatrixHtml(song, { live: { noteFont: '<i>y</i>' } });
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
        expect(html).toContain('&lt;i&gt;y&lt;/i&gt;');
        expect(html).not.toContain('<b>x</b>');
        expect(html).not.toContain('<i>y</i>');
    });

    test('an object value shows its caption', () => {
        const song = mkSong([{ NoteDisplaySizes: { width: '1px', height: '1px', NoteFontSize: 1, caption: 'Big' } }]);
        expect(buildSectionRowHtml(song, 0)).toContain('>Big</td>');
    });

    test('the Legend is drawn by the same renderer and is inert', () => {
        const html = buildLegendHtml();
        for (const cls of ['dmStored dmChanged', 'dmAbsent', 'dmColGateR', 'dmColGateW', 'dmRowGateR', 'dmRowGateW', 'dmCellGateR', 'dmCellGateW', 'dmAdapter', 'dmCurrentRow']) {
            expect(html).toContain(cls);
        }
        expect(html).not.toContain('data-zone');
        expect(html).not.toContain('data-section');
        expect(html).not.toContain('data-key');
        expect(html).not.toContain('<a ');
        expect(count(html, /<tr class='dmSectionRow/g)).toBe(buildLegendSong().sections.length);
        expect(count(html, /class='dmKeyHeader/g)).toBe(LEGEND_KEYS.length);
    });
});
