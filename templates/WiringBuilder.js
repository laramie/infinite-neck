import { getSong } from '../infinite-neck.js';

function buildWiringWidget(tuningID, tablename) {
    const template = document.getElementById('Wiring-template');
    const clone = template.content.cloneNode(true);
    const controlsDiv = clone.querySelector('.Wiring-controls');
    controlsDiv.id = `${tablename}-Wiring-controls`;
    controlsDiv.dataset.tuningID = tuningID;
    controlsDiv.dataset.tablename = tablename;

    // Set the span for this widget's table
    const spanTablename = controlsDiv.querySelector('.thisTablename');
    spanTablename.textContent = tablename;
    spanTablename.dataset.tablename = tablename;

    // Populate the select with all visible table names
    const selTablename = controlsDiv.querySelector('.selTablename');
    selTablename.innerHTML = '';
    getSong().getVisibleTunings().forEach(tid => {
        const opt = document.createElement('option');
        opt.value = tid;
        opt.textContent = tid;
        selTablename.appendChild(opt);
    });

    // Button event
    const button = controlsDiv.querySelector('.btnAddWiring');
    button.addEventListener('click', () => {
        const editRelativeSection = controlsDiv.querySelector('.editRelativeSection');
        const thisTable = spanTablename.dataset.tablename;
        getSong().addWiring(
            thisTable,
            editRelativeSection.value,
            selTablename.value
        );
    });

    return controlsDiv;
}

export function addWiringWidget(tuningID, tablename) {
    const controls = buildWiringWidget(tuningID, tablename);
    $(`#div${tuningID}_wiring`).empty().append(controls);
}

export function updateAllWiringSelects() {
    const tuningIDs = getSong().getVisibleTunings();
    $('.Wiring-controls').each(function() {
        const sel = $(this).find('.selTablename');
        sel.empty();
        tuningIDs.forEach(tid => {
            sel.append($('<option>', { value: tid, text: tid }));
        });
    });
}