import * as Globals from './globals.js';

import {
	getSongMacroIds,
} from './MacroExecutor.js';



export function getMacroNumberOptions(actionName) {
    const song = Globals.getSong();
    return getSongMacroIds(song).slice(0, 9).map((macroId, index) => ({
        name: `${actionName}:${macroId}`,
        caption: `<b>${index + 1}</b>) ${macroId}`,
        trigger: `${index + 1}`,
        action: actionName,
        value: macroId,
        popOnBang: true
    }));
}

export function getMacroDeleteNumberOptions() {
    const song = Globals.getSong();
    return getSongMacroIds(song).slice(0, 9).map((macroId, index) => ({
        name: `macroDeleteConfirm:${macroId}`,
        caption: `<b>${index + 1}</b>) ${macroId}`,
        trigger: `${index + 1}`,
        children: [
            {
                caption: `<b>Y</b>es: delete ${macroId}`,
                trigger: 'Y',
                action: 'macroDeleteConfirmed',
                value: macroId,
                popOnBang: true
            },
            {
                caption: '<b>n</b>o: keep macro',
                trigger: 'n',
                action: 'macroDeleteCancel',
                popOnBang: true
            }
        ]
    }));
}

export function getMacroMoveNumberOptions() {
    const song = Globals.getSong();
    return getSongMacroIds(song).slice(0, 9).map((macroId, index) => ({
        name: `macroMove:${macroId}`,
        caption: `<b>${index + 1}</b>) ${macroId}`,
        trigger: `${index + 1}`,
        action: 'macroMoveById',
        value: macroId,
        popOnBang: true,
        input: {
            type: 'input',
            caption: 'destination number',
            datatype: 'int',
            id: 'destination'
        }
    }));
}









