import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRedundantCells } from '../../bin/compact-display-options.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('bin/compact-display-options.js (dry run)', () => {
    test('reports cells that repeat the inherited value, in section order', () => {
        const data = {
            sections: [
                { displayOptions: { noteFont: 'Cardo', showCellNotes: true, currentColorDict: 'D' } },
                { displayOptions: { noteFont: 'Cardo', showCellNotes: false, currentColorDict: 'D' } },
                { displayOptions: { noteFont: 'Eczar', showCellNotes: false } },
                {}
            ]
        };
        const { stored, redundant } = findRedundantCells(data);
        expect(stored).toBe(8);
        expect(redundant).toEqual([
            { sectionIndex: 0, key: 'showCellNotes' },   // equals the default
            { sectionIndex: 1, key: 'noteFont' },
            { sectionIndex: 1, key: 'currentColorDict' },
            { sectionIndex: 2, key: 'showCellNotes' }
        ]);
    });

    test('does not modify its input and ignores write-blocked and read-blocked cells', () => {
        const data = {
            displayOptionGates: { writeBlocked: ['showCellNotes'] },
            sections: [
                { displayOptions: { showCellNotes: true, noteFont: 'EB Garamond' }, displayOptionGates: { readBlocked: ['noteFont'] } }
            ]
        };
        const copy = JSON.parse(JSON.stringify(data));
        expect(findRedundantCells(data).redundant).toEqual([]);
        expect(data).toEqual(copy);
    });

    test('adapter-gated keys are not reported until the Song enables them', () => {
        const sizes = { width: '100px', height: '30px', NoteFontSize: 22 };
        const data = {
            sections: [{ displayOptions: { NoteDisplaySizes: sizes } }, { displayOptions: { NoteDisplaySizes: sizes } }]
        };
        expect(findRedundantCells(data).redundant).toEqual([]);
        data.presentationMode = true;
        expect(findRedundantCells(data).redundant).toEqual([{ sectionIndex: 1, key: 'NoteDisplaySizes' }]);
    });

    test('the CLI refuses --write', () => {
        const run = spawnSync('node', ['bin/compact-display-options.js', '--write'], { cwd: root, encoding: 'utf8' });
        expect(run.status).not.toBe(0);
        expect(`${run.stderr}`).toContain('dry run only');
    });
});

describe('bin/print-control-defaults.js', () => {
    test('DISPLAY_OPTIONS_DEFAULTS agree with the markup (apart from the documented exceptions)', () => {
        const run = spawnSync('node', ['bin/print-control-defaults.js', '--check'], { cwd: root, encoding: 'utf8' });
        expect(`${run.stdout}`).toContain('no drift');
        expect(run.status).toBe(0);
    });
});
