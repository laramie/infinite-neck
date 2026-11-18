import * as Globals from './globals.js';

import {
	getSongMacroIds,
} from './MacroExecutor.js';
import { buildPickCaption, getPickTriggers } from './pick-triggers.js';

// Macro ids are validated to letters, digits, _ and -, so they are safe to show as HTML.
function getPickedMacroIds() {
    const macroIds = getSongMacroIds(Globals.getSong());
    const triggers = getPickTriggers(macroIds.length);
    return macroIds.slice(0, triggers.length).map((macroId, index) => ({ macroId, trigger: triggers[index] }));
}

export function getMacroNumberOptions(actionName) {
    return getPickedMacroIds().map(({ macroId, trigger }) => ({
        name: `${actionName}:${macroId}`,
        caption: buildPickCaption(trigger, macroId),
        trigger,
        pick: true,
        action: actionName,
        value: macroId,
        popOnBang: true
    }));
}

export function getMacroDeleteNumberOptions() {
    return getPickedMacroIds().map(({ macroId, trigger }) => ({
        name: `macroDeleteConfirm:${macroId}`,
        caption: buildPickCaption(trigger, macroId),
        trigger,
        pick: true,
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
    return getPickedMacroIds().map(({ macroId, trigger }) => ({
        name: `macroMove:${macroId}`,
        caption: buildPickCaption(trigger, macroId),
        trigger,
        pick: true,
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









