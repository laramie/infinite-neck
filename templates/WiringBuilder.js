import { 
    getSong,
    restoreWiringOpenState
} from '../infinite-neck.js';

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
        const editRelativeSection = controlsDiv.querySelector('.editRelativeSection');
        const thisTable = spanTablename.dataset.tablename;
        const selTablename = controlsDiv.querySelector('.selTablename');
        getSong().addWiring(
            thisTable,
            editRelativeSection.value,
            selTablename.value
        );
        updateWiringButtonStatus(controlsDiv);
    });

    $(controlsDiv).find('.selTablename').on('change', function() {
        updateWiringButtonStatus(controlsDiv);
        // If the new value is "" (none), remove the wiring for thisTablename, and empty the Relative Section Amount.
        if ($(this).val() === "") {
            const thisTablename = $(controlsDiv).find('.thisTablename').data('tablename');
            getSong().removeWiring(thisTablename);
            $(controlsDiv).find('.editRelativeSection').val("");
        }
    });
    $(controlsDiv).find('.editRelativeSection').on('change input', function() {
        updateWiringButtonStatus(controlsDiv);
    });

    return controlsDiv;
}

export function addWiringWidget(tuningID, tablename) {
    const controls = buildWiringWidget(tuningID, tablename);
    $(`#div${tuningID}_wiring`).empty().append(controls);
}

export function updateAllWiringSelects() {
    const tuningIDs = getSong().getVisibleTunings();
    const wirings = getSong().wirings;
    $('.Wiring-controls').each(function() {
        const thisTable = $(this).find('.thisTablename').data('tablename');
        const sel = $(this).find('.selTablename');
        const editRelativeSection = $(this).find('.editRelativeSection');
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
        sel.val(wiring.listenToTablename || "");
        editRelativeSection.val(wiring.relativeSection || "");

        updateWiringButtonStatus(this);
    });
    restoreWiringOpenState();
}

function updateWiringButtonStatus(widget) {
    const wirings = getSong().wirings;
    const thisTable = $(widget).find('.thisTablename').data('tablename');
    const sel = $(widget).find('.selTablename');
    const editRelativeSection = $(widget).find('.editRelativeSection');
    const button = $(widget).find('.btnAddWiring');
    const wiring = wirings.find(w => w.tablename === thisTable) || {};

    const isBlocked = sel.val() === "";
    const isWired =
        (thisTable === wiring.tablename) &&
        (editRelativeSection.val() === (wiring.relativeSection || "")) &&
        (sel.val() === (wiring.listenToTablename || ""));

    if (isBlocked) {
        button.removeClass('WiredButtonOn');
        button.addClass('WiredButtonBlocked');
        button.html('<s>No Instrument</s>');
    } else if (isWired) {
        button.removeClass('WiredButtonBlocked');
        button.addClass('WiredButtonOn');
        button.text('Wired');
    } else {
        button.removeClass('WiredButtonOn WiredButtonBlocked');
        button.text('Add Wiring');
    }
}