import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gMenuFile } from '../../menu.js';
import { splitMatrixArgs } from '../../templates/display-options/displayOptionsGates.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function child(menu, trigger) {
    const found = (menu.children || []).find((c) => c.trigger === trigger);
    if (!found) throw new Error(`no child "${trigger}" under "${menu.caption}"`);
    return found;
}

function walk(path_) {
    return path_.split('').reduce((menu, trigger) => child(menu, trigger), gMenuFile);
}

describe('Sprint 148 it4: /vpm Matrix menu', () => {
    test('/vp has unique triggers, and m)atrix is under it', () => {
        const presentation = walk('vp');
        const triggers = presentation.children.map((c) => c.trigger);
        expect(new Set(triggers).size).toBe(triggers.length);
        expect(walk('vpm').caption).toContain('atrix');
    });

    test('Matrix paths and inputs', () => {
        expect(walk('vpmc').action).toBe('matrixClearCell');
        expect(walk('vpmc').input.caption).toBe('section-number,key');
        expect(walk('vpmgak').action).toBe('matrixGateKey');
        expect(walk('vpmgak').on).toBe(true);
        expect(walk('vpmgas').action).toBe('matrixGateSection');
        expect(walk('vpmgac').action).toBe('matrixGateCell');
        expect(walk('vpmgdk').on).toBe(false);
        expect(walk('vpmgds').on).toBe(false);
        expect(walk('vpmgdc').on).toBe(false);
        expect(walk('vpmu').action).toBe('matrixUndo');
        expect(walk('vpmo').action).toBe('matrixOpen');
        expect(walk('vpmgak').input.datatype).toBe('string');
    });

    test('it7: /vpms is the show-messages toggle, expanded from the checkbox state like presentation mode', () => {
        const node = walk('vpms');
        expect(node.action).toBe('toggleDisplayOptionsShowMessages');
        expect(node.caption).toBe('<b>s</b>how messages [${displayOptionsShowMessagesState}]');
        expect(node.vars).toEqual(['displayOptionsShowMessagesState']);
        expect(node.preserveMenuStack).toBe(true);
        expect(node.input).toBeUndefined();   // a static toggle, not an org.dynamide.toggle plugin item
    });

    test('SaveDiff stays on s) and Save All is a)', () => {
        expect(walk('vps').action).toBe('saveViewDisplayOptions');
        expect(walk('vpa').action).toBe('saveViewDisplayOptionsAll');
    });

    test('every Matrix action has a case in key-handlers.js', () => {
        const src = fs.readFileSync(path.join(here, '../../key-handlers.js'), 'utf8');
        for (const action of ['matrixClearCell', 'matrixGateKey', 'matrixGateSection', 'matrixGateCell', 'matrixUndo', 'matrixOpen',
                              'toggleDisplayOptionsShowMessages', 'saveViewDisplayOptionsAll']) {
            expect(src).toContain(`case "${action}"`);
        }
    });

    test('splitMatrixArgs trims and pads', () => {
        expect(splitMatrixArgs('3, noteFont')).toEqual(['3', 'noteFont', '']);
        expect(splitMatrixArgs('1,showMidiNum,write-blocked')).toEqual(['1', 'showMidiNum', 'write-blocked']);
        expect(splitMatrixArgs(undefined)).toEqual(['', '', '']);
    });
});
