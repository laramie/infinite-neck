import {
    getSong,
    restoreWiringOpenState
} from '../infinite-neck.js';
import { pluginManager } from '../plugins/pluginRuntime.js';

const mutedListenerWiringByTable = new Map();

function isListenerWiring(wiring) {
    if (!wiring || !wiring.listenToTablename) {
        return false;
    }
    return !`${wiring.relativeSection || ''}`.trim();
}

function normalizePluginActionResult(response) {
    if (typeof response === 'string') {
        return response;
    }
    if (response && typeof response === 'object') {
        return `${response.result || ''}`;
    }
    return '';
}

function runCaptureForTable(tablename) {
    const song = getSong();
    const clipPlugin = pluginManager.getPluginById('clip');
    if (!song || !clipPlugin) {
        return;
    }

    clipPlugin.refreshDynamicPropertyOptions(song);
    clipPlugin.setPropertyValue('targetTable', tablename, {
        song,
        pluginManager
    });

    const copyResult = normalizePluginActionResult(clipPlugin.invokeAction('copyListenedToGraveyard', {
        song,
        pluginManager,
        args: {}
    }));

    if (copyResult.includes('listener-copy skipped')) {
        return;
    }

    clipPlugin.invokeAction('reviveClipChoice', {
        song,
        pluginManager,
        args: {
            value: '1'
        }
    });
}

function muteListenerWiringForWidget(widget) {
    const song = getSong();
    const thisTable = $(widget).find('.thisTablename').data('tablename');
    const wiring = (song.wirings || []).find((candidate) => candidate?.tablename === thisTable);
    if (!isListenerWiring(wiring)) {
        return;
    }

    mutedListenerWiringByTable.set(thisTable, {
        relativeSection: wiring.relativeSection || '',
        listenToTablename: wiring.listenToTablename || '',
        listenerProjection: wiring.listenerProjection || 'row-midi'
    });
    widget.dataset.wiringMuted = 'true';
    song.removeWiring(thisTable);
}

function unmuteListenerWiringForWidget(widget) {
    const song = getSong();
    const thisTable = $(widget).find('.thisTablename').data('tablename');
    const mutedWiring = mutedListenerWiringByTable.get(thisTable);
    widget.dataset.wiringMuted = 'false';
    if (!mutedWiring || !mutedWiring.listenToTablename) {
        mutedListenerWiringByTable.delete(thisTable);
        return;
    }

    song.addWiring(
        thisTable,
        mutedWiring.relativeSection || '',
        mutedWiring.listenToTablename,
        mutedWiring.listenerProjection || 'row-midi'
    );
    mutedListenerWiringByTable.delete(thisTable);
}

function wouldCreateReciprocalWiring(thisTable, listenToTable) {
    if (!thisTable || !listenToTable || thisTable === listenToTable) {
        return false;
    }
    const wirings = Array.isArray(getSong().wirings) ? getSong().wirings : [];
    return wirings.some((wiring) => {
        if (!wiring) {
            return false;
        }
        return wiring.tablename === listenToTable
            && wiring.listenToTablename === thisTable;
    });
}

function refreshAllWiringButtonStatus() {
    $('.Wiring-controls').each(function () {
        updateWiringButtonStatus(this);
    });
}

function buildWiringWidget(tuningID, tablename) {
    const template = document.getElementById('Wiring-template');
    const clone = template.content.cloneNode(true);
    const controlsDiv = clone.querySelector('.Wiring-controls');
    controlsDiv.id = `${tablename}-Wiring-controls`;
    controlsDiv.dataset.tuningID = tuningID;
    controlsDiv.dataset.tablename = tablename;

    const spanTablename = controlsDiv.querySelector('.thisTablename');
    spanTablename.textContent = "";
    spanTablename.dataset.tablename = tablename;

    const button = controlsDiv.querySelector('.btnAddWiring');
    button.addEventListener('click', () => {
        // If button is blocked, do nothing
        if ($(button).hasClass('WiredButtonBlocked')) return;
        if ($(button).hasClass('WiredButtonOn')) {
            const selTablename = controlsDiv.querySelector('.selTablename');
            if (selTablename) {
                $(selTablename).val('').trigger('change');
            }
            return;
        }
        const editRelativeSection = controlsDiv.querySelector('.editRelativeSection');
        const thisTable = spanTablename.dataset.tablename;
        const selTablename = controlsDiv.querySelector('.selTablename');
        const relativeSection = editRelativeSection ? editRelativeSection.value : '';
        const listenToTable = selTablename ? selTablename.value : '';
        if (wouldCreateReciprocalWiring(thisTable, listenToTable)) {
            updateWiringButtonStatus(controlsDiv);
            return;
        }
        const selListenerProjection = controlsDiv.querySelector('.selListenerProjection');
        getSong().addWiring(
            thisTable,
            relativeSection,
            listenToTable,
            selListenerProjection ? selListenerProjection.value : 'row-midi'
        );
        refreshAllWiringButtonStatus();
    });

    const muteButton = controlsDiv.querySelector('.btnMuteWiring');
    muteButton.addEventListener('click', () => {
        if ($(muteButton).hasClass('WiringActionButtonBlocked')) {
            return;
        }
        if (controlsDiv.dataset.wiringMuted === 'true') {
            unmuteListenerWiringForWidget(controlsDiv);
        } else {
            muteListenerWiringForWidget(controlsDiv);
        }
        refreshAllWiringButtonStatus();
    });

    const captureButton = controlsDiv.querySelector('.btnCaptureWiring');
    captureButton.addEventListener('click', () => {
        if ($(captureButton).hasClass('WiringActionButtonBlocked')) {
            return;
        }
        const thisTable = $(controlsDiv).find('.thisTablename').data('tablename');
        runCaptureForTable(thisTable);
    });

    $(controlsDiv).find('.selTablename').on('change', function () {
        updateWiringButtonStatus(controlsDiv);
        // If the new value is "" (none), remove the wiring for thisTablename, and empty the Relative Section Amount.
        if ($(this).val() === "") {
            const thisTablename = $(controlsDiv).find('.thisTablename').data('tablename');
            mutedListenerWiringByTable.delete(thisTablename);
            controlsDiv.dataset.wiringMuted = 'false';
            getSong().removeWiring(thisTablename);
            $(controlsDiv).find('.editRelativeSection').val("");
            refreshAllWiringButtonStatus();
        }
    });
    const edit = $(controlsDiv).find('.editRelativeSection');
    edit.id = `${tablename}-edit-relative-section`;
    edit.on('change input', function () {
        updateWiringButtonStatus(controlsDiv);
    });
    $(controlsDiv).find('.selListenerProjection').on('change', function () {
        updateWiringButtonStatus(controlsDiv);
    });

    return controlsDiv;
}

export function addWiringWidget(tuningID, tablename) {
    const controls = buildWiringWidget(tuningID, tablename);
    $(`#div${tuningID}_wiring`).empty().append(controls);
}

export function updateAllWiringSelects() {
    const tuningIDs = getSong().getAllModelTableIDs();
    const wirings = getSong().wirings;
    $('.Wiring-controls').each(function () {
        const thisTable = $(this).find('.thisTablename').data('tablename');
        const sel = $(this).find('.selTablename');
        const editRelativeSection = $(this).find('.editRelativeSection');
        const selListenerProjection = $(this).find('.selListenerProjection');
        sel.empty();
        sel.append($('<option>', { value: "", text: "none" }));
        const prefix = (typeof Constants !== 'undefined' && Constants.TABLE_ID_PREFIX) ? Constants.TABLE_ID_PREFIX : 'tbl';
        tuningIDs.forEach(tid => {
            if (thisTable !== tid) {
                let displayText = tid.startsWith(prefix) ? tid.slice(prefix.length) : tid;
                sel.append($('<option>', { value: tid, text: displayText }));
            }
        });
        const wiring = wirings.find(w => w.tablename === thisTable) || {};
        const mutedWiring = mutedListenerWiringByTable.get(thisTable);
        sel.val(wiring.listenToTablename || "");
        editRelativeSection.val(wiring.relativeSection || "");
        selListenerProjection.val(wiring.listenerProjection || 'row-midi');
        if (mutedWiring) {
            sel.val(mutedWiring.listenToTablename || '');
            editRelativeSection.val(mutedWiring.relativeSection || '');
            selListenerProjection.val(mutedWiring.listenerProjection || 'row-midi');
            this.dataset.wiringMuted = 'true';
        } else {
            this.dataset.wiringMuted = 'false';
        }

        updateWiringButtonStatus(this);
    });
    restoreWiringOpenState();
}

function updateWiringButtonStatus(widget) {
    const wirings = getSong().wirings;
    const thisTable = $(widget).find('.thisTablename').data('tablename');
    const sel = $(widget).find('.selTablename');
    const editRelativeSection = $(widget).find('.editRelativeSection');
    const selListenerProjection = $(widget).find('.selListenerProjection');
    const button = $(widget).find('.btnAddWiring');
    const muteButton = $(widget).find('.btnMuteWiring');
    const captureButton = $(widget).find('.btnCaptureWiring');
    const wiring = wirings.find(w => w.tablename === thisTable) || {};
    const isMuted = widget.dataset.wiringMuted === 'true';

    const isBlocked = sel.val() === "";
    const isReciprocalBlocked = wouldCreateReciprocalWiring(thisTable, sel.val());
    const isWired =
        (thisTable === wiring.tablename) &&
        (editRelativeSection.val() === (wiring.relativeSection || "")) &&
        (sel.val() === (wiring.listenToTablename || "")) &&
        (selListenerProjection.val() === (wiring.listenerProjection || 'row-midi'));
    const isWiredListener = isWired && isListenerWiring(wiring);

    function setButtonBlocked(theButton, caption) {
        theButton
            .addClass('WiringActionButtonBlocked')
            .removeClass('WiringActionButtonMuted')
            .prop('disabled', true)
            .html(`<s>${caption}</s>`);
    }

    function setButtonEnabled(theButton, caption) {
        theButton
            .removeClass('WiringActionButtonBlocked')
            .removeClass('WiringActionButtonMuted')
            .prop('disabled', false)
            .text(caption);
    }

    if (isMuted) {
        button.removeClass('WiredButtonOn');
        button.addClass('WiredButtonBlocked');
        button.removeAttr('title');
        button.html('<s>Wired</s>');
    } else if (isBlocked) {
        button.removeClass('WiredButtonOn');
        button.addClass('WiredButtonBlocked');
        button.removeAttr('title');
        button.html('<s>No Instrument</s>');
    } else if (isReciprocalBlocked) {
        button.removeClass('WiredButtonOn');
        button.addClass('WiredButtonBlocked');
        button.attr('title', 'Mutual wiring loops are blocked (Observer/Listener combinations included).');
        button.html('<s>Loop Blocked</s>');
    } else if (isWired) {
        button.removeClass('WiredButtonBlocked');
        button.addClass('WiredButtonOn');
        button.removeAttr('title');
        button.text('Wired');
    } else {
        button.removeClass('WiredButtonOn WiredButtonBlocked');
        button.removeAttr('title');
        button.text('Add Wiring');
    }

    if (isMuted) {
        muteButton
            .removeClass('WiringActionButtonBlocked')
            .addClass('WiringActionButtonMuted')
            .prop('disabled', false)
            .text('MUTE');
        setButtonBlocked(captureButton, 'Capture');
        return;
    }

    if (isWiredListener) {
        setButtonEnabled(muteButton, 'MUTE');
        setButtonEnabled(captureButton, 'Capture');
        return;
    }

    setButtonBlocked(muteButton, 'MUTE');
    setButtonBlocked(captureButton, 'Capture');
}