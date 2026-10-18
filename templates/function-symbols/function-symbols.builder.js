/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 3: Function Symbols panel.  Follows the other widgets built from
// templates/ (see themes.builder.js, palette.builder.js): addToDest() clones the <template>
// once into a destination div and binds events.
//
// MODEL FIRST, DOM SECOND.  appInit applies DisplayOptions before any template has loaded,
// so the "current set" lives here in JS (currentID) and in song.noteNamesFuncArr.
// applyFunctionSymbols() is the ONLY writer of song.noteNamesFuncArr; it works with no widget
// mounted, and the widget (when mounted) just repaints from that state.

import * as Globals from '../../globals.js';
import EventBus from '../../event-bus.js';
import * as Constants from '../../Constants.js';
import * as NoteTableController from '../../NoteTableController.js';
import { createLookupContext, lookupClassForNote } from '../../colorFunctions.js';
import {
    BUILTIN_SETS,
    DEFAULT_SET_ID,
    resolveSet,
    getAllSets,
    isBuiltInId,
    proposeCaption,
    buildPreviewGrid,
    addUserSet,
    updateUserSet,
    deleteUserSet,
    moveUserSet,
    computeState
} from './functionSymbolSets.js';

const EVENT_NS = '.functionSymbolsBuilder';

function sanitizeClassList(classList) {
    return `${classList || ''}`.replace(/[^\w\s-]/g, '').trim();
}

export class FunctionSymbolsBuilder {
    static widget = null; // Singleton: #widgetFunctionSymbols
    static currentID = DEFAULT_SET_ID;
    static missingID = ''; // set when a Section referred to an id we could not find

    //========================= model API (works with no widget) =========================

    static getUserSets() {
        const song = Globals.getSong();
        return Array.isArray(song?.functionSymbolSets) ? song.functionSymbolSets : [];
    }

    static setUserSets(userSets) {
        const song = Globals.getSong();
        if (song) {
            song.functionSymbolSets = userSets;
        }
    }

    /** The id saved into DisplayOptions as `functionSymbols`. */
    static getCurrentID() {
        return FunctionSymbolsBuilder.currentID;
    }

    /** Makes `id` the Function Symbols in effect.  An unknown id falls back to the default set
     *  and is reported in the widget.  Returns the id actually applied. */
    static applyFunctionSymbols(id, { skipRepaint = false } = {}) {
        const song = Globals.getSong();
        let set = resolveSet(id, FunctionSymbolsBuilder.getUserSets());
        FunctionSymbolsBuilder.missingID = '';
        if (!set) {
            FunctionSymbolsBuilder.missingID = id ? `${id}` : '';
            set = BUILTIN_SETS[0];
        }
        FunctionSymbolsBuilder.currentID = set.id;
        if (song) {
            song.noteNamesFuncArr = [...set.symbols];
        }
        if (FunctionSymbolsBuilder.widget) {
            FunctionSymbolsBuilder.rebuildSelect();
            FunctionSymbolsBuilder.resetDraft();
        }
        if (!skipRepaint) {
            NoteTableController.fullRepaint();
        }
        return set.id;
    }

    /** Call when a different Song becomes current: the registry (built-ins + that Song's User sets) changed. */
    static onSongOpened() {
        FunctionSymbolsBuilder.applyFunctionSymbols(DEFAULT_SET_ID, { skipRepaint: true });
    }

    //========================= mounting =========================

    static addToDest(divDestSelector) {
        if (!FunctionSymbolsBuilder.widget) {
            const template = document.getElementById('function-symbols-template');
            const clone = template.content.cloneNode(true);
            FunctionSymbolsBuilder.widget = clone.querySelector('#widgetFunctionSymbols');
            $(divDestSelector).empty().append(FunctionSymbolsBuilder.widget);
            FunctionSymbolsBuilder.bindEvents();
            FunctionSymbolsBuilder.applyFunctionSymbols(FunctionSymbolsBuilder.currentID, { skipRepaint: true });
        }
        return FunctionSymbolsBuilder.widget;
    }

    /** (Re)builds the SELECT: built-ins in fixed order, then this Song's User sets.  Captions via .text(). */
    static rebuildSelect() {
        const select = $('#dropDownFunctionSymbols');
        if (select.length === 0) {
            return;
        }
        select.empty();
        getAllSets(FunctionSymbolsBuilder.getUserSets()).forEach((set) => {
            select.append($('<option>', { value: set.id, text: set.caption }));
        });
        select.val(FunctionSymbolsBuilder.currentID);
    }

    //========================= painting =========================

    /** Puts the selected set into the draft controls (textarea, caption), then repaints state. */
    static resetDraft() {
        const userSets = FunctionSymbolsBuilder.getUserSets();
        const set = resolveSet(FunctionSymbolsBuilder.currentID, userSets) || BUILTIN_SETS[0];
        $('#dropDownFunctionSymbols').val(set.id);
        $('#lblFunctionSymbolsCaption').text(set.caption);
        $('#textareaFunctionSymbols').val(JSON.stringify(set.symbols));
        // Built-ins can only be cloned: propose "U: <caption>".  A User set is edited in place.
        $('#txtUserFunctionSymbolsCaption').val(isBuiltInId(set.id) ? proposeCaption(set.caption) : set.caption);
        FunctionSymbolsBuilder.refreshState();
        FunctionSymbolsBuilder.refreshPreview();
    }

    static computeCurrentState() {
        return computeState({
            selectedId: FunctionSymbolsBuilder.currentID,
            userSets: FunctionSymbolsBuilder.getUserSets(),
            draftText: $('#textareaFunctionSymbols').val(),
            draftCaption: $('#txtUserFunctionSymbolsCaption').val(),
            sections: Globals.getSong()?.sections || []
        });
    }

    /** Repaints warnings and enable states from the draft.  skipId: leave the ID label alone
     *  (it updates when the caption loses focus, as the design specifies). */
    static refreshState({ skipId = false } = {}) {
        if (!FunctionSymbolsBuilder.widget) {
            return;
        }
        const state = FunctionSymbolsBuilder.computeCurrentState();
        $('#lblWarnUserFunctionSymbols').text(state.symbolsMessage);
        $('#lblWarnUserFunctionSymbolsCaption').text(state.captionMessage);
        if (!skipId) {
            $('#lblUserFunctionSymbolsID').text(state.idLabel);
        }
        $('#btnSaveUserFunctionSymbols').prop('disabled', !state.canSave);
        $('#btnMoveUpUserFunctionSymbols').prop('disabled', !state.canMoveUp);
        $('#btnMoveDownUserFunctionSymbols').prop('disabled', !state.canMoveDown);
        $('#btnDeleteUserFunctionSymbols').prop('disabled', !state.canDelete);

        const used = state.usageSections;
        $('#lblWarnUserFunctionSymbolsUsageCount').text(used.length
            ? `This Song uses this set in ${used.length === 1 ? 'Section' : 'Sections'} ${used.join(', ')}; clear that DisplayOptions automation to delete it.`
            : '');
        $('#lblNoteFunctionSymbolsMissing').text(FunctionSymbolsBuilder.missingID
            ? `A Section refers to a missing set "${FunctionSymbolsBuilder.missingID}"; showing Function.`
            : '');
    }

    /** Preview of the SELECTED set, colored like the note cells (AutoColor live). */
    static refreshPreview() {
        const table = document.getElementById('previewFunctionSymbols');
        if (!table) {
            return;
        }
        const set = resolveSet(FunctionSymbolsBuilder.currentID, FunctionSymbolsBuilder.getUserSets()) || BUILTIN_SETS[0];
        // rootID 0 makes function number == index in NOTE_NAMES_ARRAY (which starts at "A").
        const lookupContext = createLookupContext({ rootID: 0, rootIDLead: 0 });
        table.textContent = '';
        buildPreviewGrid(set.symbols).forEach((rowCells) => {
            const tr = document.createElement('tr');
            rowCells.forEach((cell) => {
                const td = document.createElement('td');
                if (!cell) {
                    td.className = 'fsPreviewBlank';
                } else {
                    let colorClass = '';
                    if (lookupContext.autoColor) {
                        const looked = lookupClassForNote({ noteName: Constants.NOTE_NAMES_ARRAY[cell.index] }, lookupContext);
                        colorClass = sanitizeClassList(looked?.colorClass);
                    }
                    td.className = colorClass || 'noteTransparent fsPreviewWhite';
                    td.innerHTML = cell.symbol; // validated on Save and on Song load (functionSymbolSets.js)
                }
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });
    }

    /** For other code (DisplayOptions saved/cleared, Section changed): usage counts may have changed. */
    static refresh() {
        FunctionSymbolsBuilder.refreshState();
        FunctionSymbolsBuilder.refreshPreview();
    }

    //========================= actions =========================

    static save() {
        const state = FunctionSymbolsBuilder.computeCurrentState();
        if (!state.canSave) {
            return;
        }
        const userSets = FunctionSymbolsBuilder.getUserSets();
        if (state.mode === 'create') {
            const id = state.caption.id;
            FunctionSymbolsBuilder.setUserSets(addUserSet(userSets, {
                id,
                caption: state.caption.caption,
                symbols: state.symbols.symbols
            }));
            FunctionSymbolsBuilder.currentID = id;
        } else {
            // Edit in place: the id never changes, the caption may be renamed.
            FunctionSymbolsBuilder.setUserSets(updateUserSet(userSets, state.selectedId, {
                caption: state.caption.caption,
                symbols: state.symbols.symbols
            }));
        }
        FunctionSymbolsBuilder.applyFunctionSymbols(FunctionSymbolsBuilder.currentID);
        EventBus.trigger('FunctionSymbols:changed');
    }

    static deleteCurrent() {
        const state = FunctionSymbolsBuilder.computeCurrentState();
        if (!state.canDelete) {
            return;
        }
        FunctionSymbolsBuilder.setUserSets(deleteUserSet(FunctionSymbolsBuilder.getUserSets(), state.selectedId));
        FunctionSymbolsBuilder.applyFunctionSymbols(DEFAULT_SET_ID);
        EventBus.trigger('FunctionSymbols:changed');
    }

    static moveCurrent(delta) {
        const state = FunctionSymbolsBuilder.computeCurrentState();
        if ((delta < 0 && !state.canMoveUp) || (delta > 0 && !state.canMoveDown)) {
            return;
        }
        FunctionSymbolsBuilder.setUserSets(moveUserSet(FunctionSymbolsBuilder.getUserSets(), state.selectedId, delta));
        FunctionSymbolsBuilder.rebuildSelect();
        FunctionSymbolsBuilder.refreshState();
    }

    static toggleCustomize() {
        const wrap = $('#divFunctionSymbolsCRUD');
        const opening = !wrap.is(':visible');
        wrap.toggle(opening);
        $('#spanCustomizeFunctionSymbolsArrow').html(opening ? '&#x25BC;' : '&#x25B6;');
    }

    //========================= events =========================

    static bindEvents() {
        const on = (events, selector, handler) => {
            const namespaced = events.split(' ').map((name) => `${name}${EVENT_NS}`).join(' ');
            $(selector).off(namespaced).on(namespaced, handler);
        };

        on('change', '#dropDownFunctionSymbols', function () {
            FunctionSymbolsBuilder.applyFunctionSymbols($(this).val());
            EventBus.trigger('FunctionSymbols:changed');
        });
        on('input', '#textareaFunctionSymbols', () => FunctionSymbolsBuilder.refreshState({ skipId: true }));
        on('input', '#txtUserFunctionSymbolsCaption', () => FunctionSymbolsBuilder.refreshState({ skipId: true }));
        on('blur change', '#txtUserFunctionSymbolsCaption', () => FunctionSymbolsBuilder.refreshState());
        on('click', '#btnSaveUserFunctionSymbols', () => FunctionSymbolsBuilder.save());
        on('click', '#btnDeleteUserFunctionSymbols', () => FunctionSymbolsBuilder.deleteCurrent());
        on('click', '#btnMoveUpUserFunctionSymbols', () => FunctionSymbolsBuilder.moveCurrent(-1));
        on('click', '#btnMoveDownUserFunctionSymbols', () => FunctionSymbolsBuilder.moveCurrent(1));
        on('click', '#btnCustomizeFunctionSymbols', () => FunctionSymbolsBuilder.toggleCustomize());

        // Preview follows AutoColor / stylesheet / theme changes: NoteTableController.fullRepaint()
        // triggers this, as do Section changes (AutoColor and usage counts can change there).
        EventBus.on('FunctionSymbols:refresh', () => FunctionSymbolsBuilder.refresh());
    }
}
