import { getSong, showOneMenu } from '../../infinite-neck.js';
import {
    getSongMacro,
    normalizeMacroLines,
    upsertSongMacro,
    validateMacroLines
} from '../../MacroExecutor.js';

export class MacroBuilder {
    static div_macros = null;
    static currentMacroId = '';
    static eventNamespace = '.macroBuilder';

    static addToDest(divDestSelector) {
        if (!MacroBuilder.div_macros) {
            const template = document.getElementById('macros-template');
            const clone = template.content.cloneNode(true);
            MacroBuilder.div_macros = clone.querySelector('#macros');
            $(divDestSelector).empty().append(MacroBuilder.div_macros);
            MacroBuilder.bindEvents();
        }
        return MacroBuilder.div_macros;
    }

    static bindEvents() {
        const eventNamespace = MacroBuilder.eventNamespace;

        $('#btnCloseMacros')
            .off(`click${eventNamespace}`)
            .on(`click${eventNamespace}`, function () {
                MacroBuilder.persistMacro();
                MacroBuilder.hide();
            });

        $('#btnSaveMacro')
            .off(`click${eventNamespace}`)
            .on(`click${eventNamespace}`, function () {
                MacroBuilder.persistMacro();
                $('#textareaMacroLines').trigger('blur');
            });

        $('#textareaMacroLines')
            .off(`blur${eventNamespace}`)
            .on(`blur${eventNamespace}`, function () {
                MacroBuilder.persistMacro();
            });
    }

    static setStatus(message = '', isError = false) {
        const jStatus = $('#divMacroStatus');
        jStatus.text(message);
        jStatus.toggleClass('macroStatusError', isError);
        jStatus.toggleClass('macroStatusOk', !!message && !isError);
    }

    static renderMacro(macroId) {
        const id = `${macroId || ''}`.trim();
        MacroBuilder.currentMacroId = id;
        const macro = getSongMacro(getSong(), id) || { lines: [] };
        $('#txtMacroId').val(id);
        $('#textareaMacroLines').val(normalizeMacroLines(macro.lines).join('\n'));
        MacroBuilder.setStatus(id ? `Editing macro ${id}` : 'No macro selected');
    }

    static persistMacro() {
        const id = `${MacroBuilder.currentMacroId || $('#txtMacroId').val() || ''}`.trim();
        if (!id) {
            MacroBuilder.setStatus('No macro selected', true);
            return false;
        }
        const linesText = $('#textareaMacroLines').val();
        const validation = validateMacroLines(linesText);
        if (!validation.valid) {
            const firstError = validation.errors[0];
            MacroBuilder.setStatus(`Line ${firstError.lineNumber}: ${firstError.message}`, true);
            return false;
        }
        try {
            upsertSongMacro(getSong(), id, validation.lines);
            $('#textareaMacroLines').val(validation.lines.join('\n'));
            MacroBuilder.setStatus(`Saved ${id}: ${validation.lines.length} lines`);
            return true;
        } catch (error) {
            MacroBuilder.setStatus(error.message, true);
            return false;
        }
    }

    static show(macroId) {
        if (!MacroBuilder.div_macros) {
            return null;
        }
        MacroBuilder.renderMacro(macroId);
        showOneMenu('#macros', true);
        $('#textareaMacroLines').focus();
        return MacroBuilder.div_macros;
    }

    static hide() {
        $('#macros').hide();
    }

    static isVisible() {
        return $('#macros').is(':visible');
    }
}

export default MacroBuilder;
