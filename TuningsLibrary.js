// TuningsLibrary.js
// Contains all TuningsTable management and helpers.
// Copyright (c) 2023, 2024 Laramie Crocker

import EventBus from './event-bus.js';
import { allTunings } from './tunings.js';
import { rowRangeToNoteNames } from './TableBuilder.js';


export const TABLE_ID_PREFIX = "tbl";
export const NUM_FRETS_MAX = 108;
export const TABLEDIV_ID_PREFIX = "div";
export const ALL_TUNINGS_TABLE_ID = "allTuningsTable";
export const MY_TUNINGS_TABLE_ID = "myTuningsTable";

let getSongProvider = function () {
    return null;
};
export function setSongProvider(providerFn) {
    if (typeof providerFn === 'function') {
        getSongProvider = providerFn;
    }
}

function getSong() {
    return getSongProvider();
}

export function getMyTuningsStore() {
    var song = getSong();
    if (!song) {
        return [];
    }
    if (!Array.isArray(song.myTunings)) {
        song.myTunings = [];
    }
    return song.myTunings;
}

export function getAllTunings() {
    return allTunings.tunings.concat(getMyTuningsStore());
}

export function getMyTunings() {
    return getMyTuningsStore();
}

export function findTuning(oneBaseID) {
    return getAllTunings().find(tuning => tuning.baseID === oneBaseID);
}


/** name includes the string TABLE_ID_PREFIX, currently "tbl" **/
export function findTuningForName(tableID) {
    var tuningID = tableID.substring(TABLE_ID_PREFIX.length);
    return findTuningForID(tuningID);
}

export function findTuningForID(id) {
    var tunings = getAllTunings();
    var rows = tunings.length;
    for (var r = 0; r < rows; r++) {
        var tun = tunings[r];
        var baseID = tun.baseID;
        if (baseID === id) {
            return tun;
        }
    }
    return null;
}

export function getTunings(tableNamesArr) {
    return tableNamesArr.map(tableID => {
        const tuningID = tableID.substring(TABLE_ID_PREFIX.length);
        return findTuningForID(tuningID);
    });
}


export function generateNextTuningID(baseID) {
    // Given S6, generate S6_1, S6_2, etc.
    // Given S6_1, generates S6_2, etc.
    var allMyTunings = getMyTuningsStore() || [];
    var prefix = baseID.endsWith('_') ? baseID : baseID + '_';
    var existingNumbers = [];

    allMyTunings.forEach(function (tuning) {
        if (tuning.baseID.startsWith(prefix)) {
            var suffix = tuning.baseID.substring(prefix.length);
            var num = parseInt(suffix);
            if (!isNaN(num)) {
                existingNumbers.push(num);
            }
        }
    });

    if (existingNumbers.length === 0) {
        return prefix + '1';
    }
    var maxNum = Math.max.apply(null, existingNumbers);
    return prefix + (maxNum + 1);
}

export function dumpTuningsToTable(tuningsInMemoryHash, tunings = allTunings.tunings, options = {}) {
    var table = $("<table>");
    if (options.tableID) {
        table.attr("id", options.tableID);
    }
    var primaryControl = options.primaryControl || "clone";
    var primaryHeader = primaryControl === "visibility" ? "&#10003;" : "Clone";
    var trh = $("<tr>");
    trh.html("<th>" + primaryHeader + "</th><th>Tuning</th><th>ID</th><th>Strings</th><th>Instrument</th><th>Notes&nbsp;&uarr;</th><th>MIDI&nbsp;&darr;</th>"
        + "<th>BN</th><th>Right/Left</th><th>PianoNames</th><th>Nut</th><th>Frets</th><th>Divider</th><th>InMem</th>"
    );
    table.append(trh);
    var sInMemCount = "";
    var rows = tunings.length;
    for (var r = 0; r < rows; r++) {
        var tun = tunings[r];
        var checkedVisible = tun.visible ? " checked " : "";

        var captionStr = '<nobr>' + tun.caption + '</nobr>';
        var primaryControlHtml = '<button class="btnCloneTuning" data-baseid="' + tun.baseID + '">Clone</button>';
        if (primaryControl === "visibility") {
            primaryControlHtml = '<label for="cb' + tun.baseID + '"><input id="cb' + tun.baseID + '" '
                + ' type="checkbox" class="cbTuningVisible" '
                + ' name="cbn' + tun.baseID + '" value="' + tun.baseID + '" '
                + checkedVisible + ' ></label>';
        }

        var checkedLH = tun.reverse ? " checked " : "";
        var checkboxLH = '<label for="cbLH' + tun.baseID + '"><nobr>'
            + '<input class="checkboxLH"   id="cbLH' + tun.baseID + '" '
            + ' type="checkbox" name="cbnLH' + tun.baseID + '" value="'
            + tun.baseID + '" ' + checkedLH + '>Left-Handed</nobr></label>';

        var checkedPN = tun.pianoNamesRow ? " checked " : "";
        var checkboxPN = '<label for="cbPN' + tun.baseID + '"><nobr>'
            + '<input class="checkboxPN"   id="cbPN' + tun.baseID + '" '
            + ' type="checkbox" name="cbnPN' + tun.baseID + '" value="'
            + tun.baseID + '" ' + checkedPN + '></nobr></label>';


        var checkedNut = tun.nut ? " checked " : "";
        var checkboxNut = '<label for="cbNut' + tun.baseID + '"><nobr>'
            + '<input class="checkboxNut"   id="cbNut' + tun.baseID + '" '
            + ' type="checkbox" name="cbnNut' + tun.baseID + '" value="'
            + tun.baseID + '" ' + checkedNut + '></nobr></label>';

        var BN = tun.banjoNut ? JSON.stringify(tun.banjoNut) : "";
        if (BN) {
            BN = BN.replaceAll(",", ",<br>");
        }

        sInMemCount = "";
        if (tuningsInMemoryHash[tun.baseID]) {
            var val = tuningsInMemoryHash[tun.baseID];
            if (val && val > 0) {
                sInMemCount = "" + val;
            }
        }

        var selectBlock = generateSelect(tun.baseID, tun.frets);
        var selectStringDividerHt = generateSelectStringDividerHt(tun.baseID, tun.stringDividerHeight);

        // For myTunings (visibility mode), make ID editable; for allTunings (clone mode), show as text
        var idCellHtml;
        if (primaryControl === "visibility") {
            idCellHtml = '<nobr><input type="text" class="inputTuningID" data-oldid="' + tun.baseID + '" value="' + tun.baseID + '" /><button type="button" class="moveyButton">&check;</button></nobr>';
        } else {
            idCellHtml = tun.baseID;
        }

        var tr = $("<tr>");
        tr.append($("<td>").html(primaryControlHtml));
        tr.append($("<td>").html(captionStr));
        tr.append($("<td>").html(idCellHtml));
        tr.append($("<td>").html(tun.nStrings + "-string"));
        tr.append($("<td>").html(tun.baseInstrument));
        tr.append($("<td>").html(rowRangeToNoteNames(tun.rowRange, tun)));
        tr.append($("<td>").html("" + tun.rowRange));
        tr.append($("<td>").html("" + BN));
        tr.append($("<td>").html(checkboxLH));
        tr.append($("<td>").html(checkboxPN));
        tr.append($("<td>").html(checkboxNut));
        tr.append($("<td>").html(selectBlock)); //numFrets
        tr.append($("<td>").html(selectStringDividerHt));
        tr.append($("<td>").html("<b>" + sInMemCount + "</b>"));

        table.append(tr);
    }
    return table;
}

const SELECT_FRETS_PFX = "selFrets";
const SELECT_STRINGDIVIDER_PFX = "selDivider";

export function generateSelect(ID, frets) {
    var sel = "<select class='selectFrets' id='" + SELECT_FRETS_PFX + ID + "'>";
    for (var r = 1; r <= NUM_FRETS_MAX; r++) {  // NUM_FRETS_MAX from infinite-neck.js
        var selected = "";
        if (r == frets) {
            selected = " selected ";
        }
        var opt = "<option value='" + r + "' " + selected + "> " + r + " </option>";
        sel = sel + opt;

    }
    sel = sel + "</select>";
    return sel;
}

export function generateSelectStringDividerHt(ID, sHeightValue) {
    var sel = "<select class='selectStringDividerHt' id='" + SELECT_STRINGDIVIDER_PFX + ID + "'>";
    var opt = "<option value='0'>0</option>";
    sel = sel + opt;
    for (var r = 1; r <= 8; r++) {
        var ht = "0." + r + "em";
        var selected = "";
        if (ht == sHeightValue) {
            selected = " selected ";
        }
        opt = "<option value='" + ht + "' " + selected + "> " + ht + " </option>";
        sel = sel + opt;
    }
    sel = sel + "</select>";
    return sel;
}

//================ Public functions to manage tunings ==========================

export function showDefaultTuning() {
    if (getMyTuningsStore().length === 0) {
        ensureDefaultMyTuning('S6');
        requestReloadAllTuningsDisplay();
        requestReinstallAllTuningsTables();
        return;
    }
    return showHideTunings();
}

export function ensureDefaultMyTuning(defaultBaseID) {
    if (!defaultBaseID) defaultBaseID = 'S6';
    var store = getMyTuningsStore();
    if (store.length > 0) return;
    var original = findTuningForID(defaultBaseID);
    if (!original) return;
    var cloned = JSON.parse(JSON.stringify(original));
    cloned.baseID = generateNextTuningID(defaultBaseID);
    cloned.instance = true;
    cloned.visible = true;
    store.push(cloned);
}

export function showHideTunings() {
    var tuningsCheckboxes = $('#' + MY_TUNINGS_TABLE_ID + ' .cbTuningVisible');
    tuningsCheckboxes.each(function (index, element) {
        var theCB = $(element)
        var show = theCB.prop('checked');
        var basekey = theCB.val();
        showHideTuning(show, basekey);
        //console.log("showhideTuning: idx:"+index+" ["+basekey+"] "+show);
    });
    var numTunings = $('#' + MY_TUNINGS_TABLE_ID + ' .cbTuningVisible:checked').length;
    //console.log("showHideTunings num: "+numTunings);
    return numTunings;
}

export function hideTuning(tablekey) {
    showHideTuning(false, tablekey);
}
export function showTuning(tablekey) {
    showHideTuning(true, tablekey);
}
export function showHideTuning(show, basekey) {
    //console.log("showHideTuning:"+show+":"+basekey);
    var cbKey = "#cb" + basekey;
    var divKey = "#" + TABLEDIV_ID_PREFIX + basekey;
    var jcb = $(cbKey);
    var jdiv = $(divKey);
    jcb.prop("checked", show);
    //jcb.click();
    if (show) {   //change the checkbox in the GUI
        jdiv.show();
    } else {
        jdiv.hide();
    }
    var tuning = findTuningForID(basekey);
    if (tuning) {
        tuning.visible = show;  //change it in the in-memory model.
    } else {
        //example: user opens new song, but default tuning S6_1 has been added to myTunings
        // and getAllTunings() concats myTunings into allTunings list, but findTuningForID
        // only consults all Tunings, so S6_1 will never be found.  Log it and TODO fix it 
        // when we sort out what to do with myTunings. 20260318.
        console.log("showHideTuning::Tuning not found (probably a myTunings) for: " + basekey);
    }
}

export function showTuningsForTablesInFile() {
    var numFound = 0;
    getSong().sections.forEach(section => {
        Object.entries(section.noteTables).forEach(([tablekey, tablearr]) => {
            if (tablearr && tablearr.length > 0) {
                const basekey = tablekey.substring(TABLE_ID_PREFIX.length);
                showTuning(basekey);
                numFound++;
            }
        });
    });
    getSong().visibleNoteTables.forEach(visTableID => {
        const visbasekey = visTableID.substring(TABLE_ID_PREFIX.length);
        const tuning = findTuning(visbasekey);
        if (tuning) {
            tuning.visible = true;
        } else {
            console.log("tuning not found for basekey: " + visbasekey);
        }
        requestReinstallAllTuningsTables();
        showTuning(visbasekey);
        numFound++;
    });
    return numFound;
}

export function hideAllTunings() {
    getAllTunings().forEach(tuning => hideTuning(tuning.baseID));
}

//===============================================================================

/**
 * Converts a comma-separated string to an array of integers, with validation.
 * @param {string} inputString The string to convert.
 * @returns {number[]} The array of integers.
 * @throws {Error} If any element is not a valid integer.
 */
function convertStringToIntArray(inputString) {
    // 1. Split the string by the comma separator
    const stringArray = inputString.split(',');

    // 2. Map each string element to an integer and validate
    const intArray = stringArray.map(str => {
        // Trim whitespace from the string
        const trimmedStr = str.trim();

        // Use parseInt with base 10 (decimal) for robust conversion
        const num = Number.parseInt(trimmedStr, 10);

        // 3. Check if the result is a valid integer and not NaN
        // The `Number.isNaN()` check is crucial for safety
        if (Number.isNaN(num) || trimmedStr === '') {
            throw new Error(`Invalid input: "${str}" is not a valid integer.`);
        }

        // 4. Additionally, check if the original string was an actual number (prevents '1a' being parsed as '1')
        // This is the safest way to ensure the whole string was an integer representation
        if (String(num) !== trimmedStr) {
            throw new Error(`Invalid input: "${str}" contains non-integer characters.`);
        }

        return num;
    });

    return intArray;
}


//===================== event binding =======================================
//One dependency: the existence of a form called "#frmTunings" with our tuningstable.

export function bindFormTuningsEvents() {
    $('#' + MY_TUNINGS_TABLE_ID + ' .cbTuningVisible').change(function () {
        var show = this.checked;
        var basekey = this.value;
        var tuning = findTuning(basekey);
        if (tuning) {
            tuning.visible = show;
        } else {
            console.log("tuning not found for basekey: " + basekey);
        }
        if (!show) {
            $('#' + TABLEDIV_ID_PREFIX + basekey).hide();
            requestReloadAllTuningsDisplay();
            requestReinstallAllTuningsTables();
            return;
        }
        requestReinstallAllTuningsTables();
        showHideTuning(show, basekey);
    });
    $('#frmTunings .checkboxLH').change(function () {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        tuning.reverse = this.checked;
        requestReinstallAllTuningsTables();
    });
    $('#frmTunings .selectFrets').change(function () {
        var tuningID = this.id.substring(SELECT_FRETS_PFX.length);
        var tuning = findTuningForID(tuningID);
        tuning.frets = parseInt(this.value);
        requestReinstallAllTuningsTables();
    });
    $('#frmTunings .selectStringDividerHt').change(function () {
        var tuningID = this.id.substring(SELECT_STRINGDIVIDER_PFX.length);
        var tuning = findTuningForID(tuningID);
        tuning.stringDividerHeight = this.value;
        requestReinstallAllTuningsTables();
    });
    $('#frmTunings .checkboxPN').change(function () {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        tuning.pianoNamesRow = this.checked;
        requestReinstallAllTuningsTables();
    });
    $('#frmTunings .checkboxNut').change(function () {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        tuning.nut = this.checked;
        requestReinstallAllTuningsTables();
    });
    $('#btnShowHideEditUserTuning').off('click').click(function () {
        $('#divEditUserTuning').toggle();
    });
    $('#btnSaveUserTuning').off('click').click(function () {
        var tun = findTuningForID("USER");
        if (tun) {
            var text = $('#textareaRowRange').val();
            if (text) {
                if (text.trim()) {
                    try {
                        var arr = convertStringToIntArray(text.trim());
                        tun.rowRange = arr;
                        tun.nStrings = tun.rowRange.length;
                    } catch (e) {
                        alert("User instrument RowRange invalid: " + text);
                        return;
                    }
                }
            }


            var sBanjoNut = $('#textareaBanjoNut').val();
            if (sBanjoNut && sBanjoNut.trim()) {
                tun.banjoNut = JSON.parse(sBanjoNut);
            }

            var sCaption = $('#txtUserInstrumentCaption').val();
            if (sCaption && sCaption.trim()) {
                tun.caption = sCaption.trim();
            }

            tun.baseInstrument = $('#dropDownBaseInstrument').val();

            requestReloadAllTuningsDisplay();
            requestReinstallAllTuningsTables();
        }
    });

    // Clone button handler (delegated from #frmTunings to support table reloads)
    $('#frmTunings').off('click', '.btnCloneTuning').on('click', '.btnCloneTuning', function () {
        var baseID = $(this).data('baseid');
        var newBaseID = generateNextTuningID(baseID);

        // Find original tuning
        var original = findTuningForID(baseID);
        if (!original) {
            alert("Original tuning not found.");
            return;
        }

        var cloned = JSON.parse(JSON.stringify(original)); // Deep clone
        cloned.baseID = newBaseID;
        cloned.instance = true;
        cloned.visible = true;
        getMyTuningsStore().push(cloned);
        requestReloadAllTuningsDisplay();
        requestReinstallAllTuningsTables();
        $('#btnMyTuningsTab').trigger('click');
    });

    // Tuning ID edit handler (for myTunings table only)
    $('#frmTunings').off('change', '.inputTuningID').on('change', '.inputTuningID', function () {
        var oldID = $(this).data('oldid');
        var newID = $(this).val().trim();

        if (!newID) {
            alert("Tuning ID cannot be empty.");
            $(this).val(oldID);
            return;
        }

        if (newID === oldID) {
            return; // No change
        }

        // Check for duplicate baseID in all tunings
        if (getAllTunings().some(function (tuning) { return tuning.baseID === newID; })) {
            alert("A tuning with ID '" + newID + "' already exists.");
            $(this).val(oldID);
            return;
        }

        // Find and update the tuning in myTunings
        var myTunings = getMyTuningsStore();
        var tuning = myTunings.find(function (t) { return t.baseID === oldID; });
        if (!tuning) {
            alert("Tuning not found in myTunings.");
            $(this).val(oldID);
            return;
        }

        // Update the tuning's baseID
        tuning.baseID = newID;
        $(this).data('oldid', newID); // Update the stored old ID for future changes

        // Rename all NoteTable references in the Song model (section noteTables keys + visibleNoteTables)
        getSong().renameTuningIDInModel(oldID, newID);

        requestReloadAllTuningsDisplay();
        requestReinstallAllTuningsTables();
    });
}


function requestReinstallAllTuningsTables() {
    EventBus.trigger('ReinstallAllTuningsTables');
}

function requestReloadAllTuningsDisplay() {
    EventBus.trigger('ReloadAllTuningsDisplay');
}












