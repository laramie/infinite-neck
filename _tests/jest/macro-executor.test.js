import { jest } from '@jest/globals';
import {
    executeMacroLine,
    executeMacroLines,
    getSongMacroIds,
    moveSongMacro,
    normalizeMacroLines,
    parseMacroLine,
    upsertSongMacro,
    validateMacroId,
    validateMacroLines
} from '../../MacroExecutor.js';

describe('MacroExecutor', () => {
    test('parseMacroLine parses path-only lines', () => {
        expect(parseMacroLine('/fpaye')).toEqual({
            path: '/fpaye',
            hasValue: false,
            value: undefined
        });
    });

    test('parseMacroLine splits only on the first space', () => {
        expect(parseMacroLine('/foo "bar baz"')).toEqual({
            path: '/foo',
            hasValue: true,
            value: 'bar baz'
        });
    });

    test('parseMacroLine parses JSON values', () => {
        expect(parseMacroLine('/fpapv [[7, 12]]').value).toEqual([[7, 12]]);
        expect(parseMacroLine('/fpasl 4').value).toBe(4);
        expect(parseMacroLine('/fpac true').value).toBe(true);
    });

    test('validateMacroLines rejects invalid JSON', () => {
        const result = validateMacroLines(['/ok true', '/bad nope']);
        expect(result.valid).toBe(false);
        expect(result.errors[0].lineNumber).toBe(2);
        expect(result.errors[0].message).toContain('Invalid JSON');
    });

    test('normalizeMacroLines trims lines and removes blanks', () => {
        expect(normalizeMacroLines('  /a  \n\n /b 1 \n')).toEqual(['/a', '/b 1']);
    });

    test('validateMacroId accepts conservative ids', () => {
        expect(validateMacroId('macro1')).toBe(true);
        expect(validateMacroId('Macro_1-a')).toBe(true);
        expect(validateMacroId('1macro')).toBe(false);
        expect(validateMacroId('macro one')).toBe(false);
    });

    test('upsertSongMacro normalizes song macros', () => {
        const song = {};
        upsertSongMacro(song, 'macro1', [' /a ', '', '/b true']);
        expect(getSongMacroIds(song)).toEqual(['macro1']);
        expect(song.macros.macro1.lines).toEqual(['/a', '/b true']);
    });

    test('moveSongMacro reorders macros using 1-based destinations', () => {
        const song = {};
        upsertSongMacro(song, 'first', ['/a']);
        upsertSongMacro(song, 'second', ['/b']);
        upsertSongMacro(song, 'third', ['/c']);

        expect(moveSongMacro(song, 'third', 1)).toEqual({
            moved: true,
            macroId: 'third',
            from: 3,
            to: 1,
            ids: ['third', 'first', 'second']
        });
        expect(getSongMacroIds(song)).toEqual(['third', 'first', 'second']);

        moveSongMacro(song, 'third', 99);
        expect(getSongMacroIds(song)).toEqual(['first', 'second', 'third']);

        moveSongMacro(song, 'second', 0);
        expect(getSongMacroIds(song)).toEqual(['second', 'first', 'third']);
    });

    test('executeMacroLine passes input values by input id', () => {
        const rootMenu = {
            children: [
                {
                    trigger: 'f',
                    children: [
                        {
                            trigger: 'n',
                            action: 'setName',
                            input: { id: 'name' }
                        }
                    ]
                }
            ]
        };
        const actionRunner = jest.fn(() => ({ result: 'ok' }));
        const result = executeMacroLine('/fn "Round Midnight"', { rootMenu, actionRunner });
        expect(result.ok).toBe(true);
        expect(actionRunner).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'setName' }),
            { name: 'Round Midnight' },
            expect.objectContaining({ path: '/fn', value: 'Round Midnight' })
        );
    });

    test('executeMacroLines stops on first failure', () => {
        const rootMenu = {
            children: [
                { trigger: 'a', action: 'a' }
            ]
        };
        const actionRunner = jest.fn(() => ({ result: 'ok' }));
        const result = executeMacroLines(['/a', '/b', '/a'], { rootMenu, actionRunner });
        expect(result.ok).toBe(false);
        expect(result.failedLineNumber).toBe(2);
        expect(actionRunner).toHaveBeenCalledTimes(1);
    });

    test('executeMacroLine passes toggle values to action runner context', () => {
        const rootMenu = {
            children: [
                { trigger: 't', action: 'pluginProperty:toggle' }
            ]
        };
        const actionRunner = jest.fn(() => ({ result: 'color=true' }));
        executeMacroLine('/t true', { rootMenu, actionRunner });
        expect(actionRunner).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'pluginProperty:toggle' }),
            { value: true },
            expect.objectContaining({ hasValue: true, value: true })
        );
    });
});
