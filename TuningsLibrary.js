// TuningsLibrary.js
// Contains all TuningsTable management and helpers.
// Copyright (c) 2023, 2024 Laramie Crocker

import * as Constants from './Constants.js';
import EventBus from './event-bus.js';
import { allTunings } from './tunings.js';
import { rowRangeToNoteNames } from './TableBuilder.js';
import { refreshShowAllNoteNames, getSong } from './infinite-neck.js';
import {
    supportsPianoSkeuomorphic,
    normalizePianoLayoutOptions
} from './templates/piano/piano-skeuomorphic.builder.js';



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

export function getLibraryTunings() {
    return allTunings.tunings;
}

export function getAllTunings() {
    return getLibraryTunings().concat(getMyTuningsStore());
}

export function getMyTunings() {
    return getMyTuningsStore();
}

export function findTuning(oneBaseID) {
    return getAllTunings().find(tuning => tuning.baseID === oneBaseID);
}


/** name includes the string Constants.TABLE_ID_PREFIX, currently "tbl" **/
export function findTuningForName(tableID) {
    var tuningID = tableID.substring(Constants.TABLE_ID_PREFIX.length);
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
        const tuningID = tableID.substring(Constants.TABLE_ID_PREFIX.length);
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

function cloneTuningObject(tuning) {
    return JSON.parse(JSON.stringify(tuning));
}

function arraysEqual(left = [], right = []) {
    if (left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) {
            return false;
        }
    }
    return true;
}

function buildDefaultSongTuningTemplate(baseInstrument = 'Guitar') {
    const isPiano = baseInstrument === 'Piano';
    return {
        instance: true,
        visible: true,
        baseInstrument,
        caption: '',
        nStrings: 0,
        rowRange: [],
        showDiamonds: !isPiano,
        diamonds: [3, 5, 7, 9, 15, 17, 19, 21],
        doubleDiamonds: [12, 24],
        frets: 24,
        nut: !isPiano,
        reverse: false,
        banjoNut: {},
        pianoNamesRow: false,
        pianoSkeuomorphic: false,
        stringDividerHeight: '0.5em'
    };
}

function getLineageReferenceTunings(fromBaseID, {
    libraryTunings = getLibraryTunings(),
    songTunings = getMyTuningsStore()
} = {}) {
    const references = [];
    const libraryReference = libraryTunings.find((tuning) => tuning.baseID === fromBaseID);
    if (libraryReference) {
        references.push(libraryReference);
    }
    songTunings
        .filter((tuning) => tuning.fromBaseID === fromBaseID)
        .forEach((tuning) => references.push(tuning));
    return references;
}

export function validateSongTuningDraft(draft = {}, {
    libraryTunings = getLibraryTunings(),
    songTunings = getMyTuningsStore()
} = {}) {
    const baseID = `${draft.baseID || ''}`.trim();
    const fromBaseID = `${draft.fromBaseID || ''}`.trim();
    const caption = `${draft.caption || ''}`.trim() || baseID;
    const baseInstrument = `${draft.baseInstrument || 'Guitar'}`.trim() || 'Guitar';
    const rowRange = Array.isArray(draft.rowRange)
        ? draft.rowRange.map((value) => Number.parseInt(value, 10))
        : [];
    const banjoNut = draft.banjoNut && typeof draft.banjoNut === 'object'
        ? draft.banjoNut
        : {};

    if (!baseID) {
        return { valid: false, error: 'Tuning ID is required.' };
    }

    if (!fromBaseID) {
        return { valid: false, error: 'Lineage ID is required.' };
    }

    if (!rowRange.length || rowRange.some((value) => !Number.isInteger(value))) {
        return { valid: false, error: 'MIDI rowRange is required and must contain only integers.' };
    }

    if (getAllTunings().some((tuning) => tuning.baseID === baseID)) {
        return { valid: false, error: `A tuning with ID '${baseID}' already exists.` };
    }

    if (songTunings.some((tuning) => tuning.baseID === fromBaseID)) {
        return {
            valid: false,
            error: `Lineage ID '${fromBaseID}' conflicts with an existing tuning ID in the song.`
        };
    }

    const referenceTunings = getLineageReferenceTunings(fromBaseID, { libraryTunings, songTunings });
    for (const referenceTuning of referenceTunings) {
        if ((referenceTuning.baseInstrument || '') !== baseInstrument) {
            return {
                valid: false,
                error: `Lineage ID '${fromBaseID}' already exists for instrument '${referenceTuning.baseInstrument}'.`
            };
        }
        if (Number.parseInt(referenceTuning.nStrings, 10) !== rowRange.length) {
            return {
                valid: false,
                error: `Lineage ID '${fromBaseID}' requires ${referenceTuning.nStrings} strings.`
            };
        }
        if (!arraysEqual(referenceTuning.rowRange || [], rowRange)) {
            return {
                valid: false,
                error: `Lineage ID '${fromBaseID}' already exists with a different MIDI rowRange.`
            };
        }
    }

    return {
        valid: true,
        normalizedDraft: {
            baseID,
            fromBaseID,
            caption,
            baseInstrument,
            rowRange,
            nStrings: rowRange.length,
            banjoNut
        }
    };
}

export function createSongTuningFromDraft(draft = {}, {
    libraryTunings = getLibraryTunings(),
    songTunings = getMyTuningsStore()
} = {}) {
    const validation = validateSongTuningDraft(draft, { libraryTunings, songTunings });
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const { normalizedDraft } = validation;
    const referenceTuning = getLineageReferenceTunings(normalizedDraft.fromBaseID, {
        libraryTunings,
        songTunings
    })[0];
    const createdTuning = referenceTuning
        ? cloneTuningObject(referenceTuning)
        : buildDefaultSongTuningTemplate(normalizedDraft.baseInstrument);

    Object.assign(createdTuning, normalizedDraft, {
        instance: true,
        visible: true
    });
    if (!createdTuning.banjoNut || typeof createdTuning.banjoNut !== 'object') {
        createdTuning.banjoNut = {};
    }
    return createdTuning;
}

export function dumpTuningsToTable(tuningsInMemoryHash, tunings = allTunings.tunings, options = {}) {
    var table = $("<table>");
    if (options.tableID) {
        table.attr("id", options.tableID);
    }
    var primaryControl = options.primaryControl || "clone";
    var isSongOwnedTable = primaryControl === "visibility";
    var primaryHeader = primaryControl === "visibility" ? "&#10003;" : "Clone";
    var showMoveColumn = primaryControl === "visibility";
    var trh = $("<tr>");
    trh.html("<th>" + primaryHeader + "</th>"
        + (showMoveColumn ? "<th>Move</th>" : "")
        +"<th>Tuning</th><th>ID</th>"+(isSongOwnedTable?"<th>from</th>":"")+"<th>Strings</th><th>Instrument</th><th>Notes&nbsp;&uarr;</th><th>MIDI&nbsp;&darr;</th><th>SR&nbsp;&nbsp;</th>"
        + "<th>BN</th><th>Right/Left</th><th>PianoNames</th><th>PianoSkeuo</th><th>Diamonds</th><th>Nut</th><th>Frets</th><th>Divider</th><th>InMem</th>"
        
    );
    table.append(trh);
    var sInMemCount = "";
    var rows = tunings.length;
    for (var r = 0; r < rows; r++) {
        var tun = tunings[r];
        normalizePianoLayoutOptions(tun);
        var isPianoTuning = tun.baseInstrument === 'Piano';
        var disableMoveUp = r === 0 ? ' disabled' : '';
        var disableMoveDown = r === rows - 1 ? ' disabled' : '';
        var checkedVisible = tun.visible ? " checked " : "";

        var captionStr = '<nobr>' + tun.caption + '</nobr>';
        var primaryControlHtml = '<button type="button" class="btnCloneTuning" data-baseid="' + tun.baseID + '">Clone</button>';
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
        var leftHandCellHtml = isSongOwnedTable ? checkboxLH : (tun.reverse ? 'Left-Handed' : '');

        var checkedPN = tun.pianoNamesRow ? " checked " : "";
        var disabledPN = tun.pianoSkeuomorphic ? " disabled " : "";
        var pianoNamesTitle = tun.pianoSkeuomorphic
            ? ' title="PianoNames is unavailable when PianoSkeuo is enabled." '
            : '';
        var checkboxPN = '<label for="cbPN' + tun.baseID + '"><nobr>'
            + '<input class="checkboxPN"   id="cbPN' + tun.baseID + '" '
            + ' type="checkbox" name="cbnPN' + tun.baseID + '" value="'
            + tun.baseID + '" ' + checkedPN + disabledPN + pianoNamesTitle + '></nobr></label>';
        var pianoNamesCellHtml = isSongOwnedTable ? checkboxPN : (tun.pianoNamesRow ? 'Yes' : '');

        var pianoSkeuomorphicSupported = supportsPianoSkeuomorphic(tun);
        var checkedPianoSkeuomorphic = tun.pianoSkeuomorphic ? " checked " : "";
        var disabledPianoSkeuomorphic = pianoSkeuomorphicSupported ? "" : " disabled ";
        var pianoSkeuomorphicTitle = pianoSkeuomorphicSupported
            ? ' title="Decorate this one-row piano tuning as a keyboard." '
            : ' title="Piano skeuomorphic layout is limited to one-row Piano tunings." ';
        var checkboxPianoSkeuomorphic = '<label for="cbPianoSkeuomorphic' + tun.baseID + '"><nobr>'
            + '<input class="checkboxPianoSkeuomorphic"   id="cbPianoSkeuomorphic' + tun.baseID + '" '
            + ' type="checkbox" name="cbnPianoSkeuomorphic' + tun.baseID + '" value="'
            + tun.baseID + '" ' + checkedPianoSkeuomorphic + disabledPianoSkeuomorphic + pianoSkeuomorphicTitle + '></nobr></label>';
        var pianoSkeuoCellHtml = isSongOwnedTable ? checkboxPianoSkeuomorphic : (tun.pianoSkeuomorphic ? 'Yes' : '');

        var checkedShowDiamonds = tun.showDiamonds ? " checked " : "";
        var checkboxShowDiamonds = '<label for="cbShowDiamonds' + tun.baseID + '"><nobr>'
            + '<input class="checkboxShowDiamonds"   id="cbShowDiamonds' + tun.baseID + '" '
            + ' type="checkbox" name="cbnShowDiamonds' + tun.baseID + '" value="'
            + tun.baseID + '" ' + checkedShowDiamonds + '></nobr></label>';
        var showDiamondsCellHtml = isSongOwnedTable ? checkboxShowDiamonds : (tun.showDiamonds ? 'Yes' : '');

        var checkedNut = tun.nut ? " checked " : "";
        var disabledNut = isPianoTuning ? ' disabled ' : '';
        var nutTitle = isPianoTuning
            ? ' title="Nut is unavailable for Piano layouts." '
            : '';
        var checkboxNut = '<label for="cbNut' + tun.baseID + '"><nobr>'
            + '<input class="checkboxNut"   id="cbNut' + tun.baseID + '" '
            + ' type="checkbox" name="cbnNut' + tun.baseID + '" value="'
            + tun.baseID + '" ' + checkedNut + disabledNut + nutTitle + '></nobr></label>';
        var nutCellHtml = isSongOwnedTable ? checkboxNut : (tun.nut ? 'Yes' : '');

        var checked_doSpecialRows = tun.doSpecialRows ? " checked " : "";
        var checkboxDoSpecialRows = '<label for="cbDoSpecialRows' + tun.doSpecialRows + '"><nobr>'
            + '<input class="checkboxDoSpecialRows"   id="cbDoSpecialRows' + tun.doSpecialRows + '" '
            + ' type="checkbox" name="cbnDoSpecialRows' + tun.doSpecialRows + '" value="'
            + tun.baseID + '" ' + checked_doSpecialRows + '></nobr></label>';

            


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
        var selectStringDividerHt = generateSelectStringDividerHt(
            tun.baseID,
            tun.stringDividerHeight,
            isPianoTuning,
            isPianoTuning ? 'Divider is unavailable for Piano layouts.' : ''
        );
        var moveButtonHtml = '<button type="button" class="btnMoveTuningUp" data-baseid="' + tun.baseID + '"' + disableMoveUp + '>&uarr;</button>'
            + '<button type="button" class="btnMoveTuningDown" data-baseid="' + tun.baseID + '"' + disableMoveDown + '>&darr;</button>'
            + '<button type="button" class="btnRemoveTuning" data-baseid="' + tun.baseID + '">X</button>';

        // For myTunings (visibility mode), make ID editable; for allTunings (clone mode), show as text
        var idCellHtml;
        if (isSongOwnedTable) {
            idCellHtml = '<nobr><input type="text" class="inputTuningID" data-oldid="' + tun.baseID + '" value="' + tun.baseID + '" /><button type="button" class="moveyButton">&check;</button></nobr>';
        } else {
            idCellHtml = tun.baseID;
        }
        let specialRows = (tun.specialBackgroundIDRows) 
                            ? checkboxDoSpecialRows+' '+tun.specialBackgroundIDRows 
                            : "";

        var tr = $("<tr>");
        tr.append($("<td>").html(primaryControlHtml));
        if (showMoveColumn) {
            tr.append($("<td>").html(moveButtonHtml));
        }
        tr.append($("<td>").html(captionStr));
        tr.append($("<td>").html(idCellHtml));
        if (isSongOwnedTable) {tr.append($("<td>").html(tun.fromBaseID));}
        tr.append($("<td>").html(tun.nStrings + "-string"));
        tr.append($("<td>").html(tun.baseInstrument));
        tr.append($("<td>").html(rowRangeToNoteNames(tun.rowRange, tun)));
        tr.append($("<td>").html("" + tun.rowRange));
        tr.append($("<td>").html());
        tr.append($("<td>").html(specialRows));
        tr.append($("<td>").html("" + BN));
        tr.append($("<td>").html(leftHandCellHtml));
        tr.append($("<td>").html(pianoNamesCellHtml));
        tr.append($("<td>").html(pianoSkeuoCellHtml));
        tr.append($("<td>").html(showDiamondsCellHtml));
        tr.append($("<td>").html(nutCellHtml));
        tr.append($("<td>").html(isSongOwnedTable ? selectBlock : `${tun.frets ?? ''}`)); //numFrets
        tr.append($("<td>").html(isSongOwnedTable ? selectStringDividerHt : `${tun.stringDividerHeight || ''}`));
        tr.append($("<td>").html("<b>" + sInMemCount + "</b>"));
        

        table.append(tr);
    }
    return table;
}

const SELECT_FRETS_PFX = "selFrets";
const SELECT_STRINGDIVIDER_PFX = "selDivider";

export function generateSelect(ID, frets) {
    var sel = "<select class='selectFrets' id='" + SELECT_FRETS_PFX + ID + "'>";
    for (var r = 1; r <= Constants.NUM_FRETS_MAX; r++) {  // Constants.NUM_FRETS_MAX from infinite-neck.js
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

export function generateSelectStringDividerHt(ID, sHeightValue, disabled = false, title = '') {
    var disabledAttr = disabled ? ' disabled' : '';
    var titleAttr = title ? " title='" + title + "'" : '';
    var sel = "<select class='selectStringDividerHt' id='" + SELECT_STRINGDIVIDER_PFX + ID + "'" + disabledAttr + titleAttr + ">";
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

export const DEFAULT_TUNING = 'S6';

export function showDefaultTuning(preferredTuning = DEFAULT_TUNING) {
   // if (getMyTuningsStore().length === 0) {
        ensureDefaultMyTuning(preferredTuning);
        reloadAllTuningsDisplay();
        reloadMyTuningsDisplay()
        //requestReinstallAllTuningsTables();
     //   return;
   // }
    return showHideTunings();
}

export function ensureDefaultMyTuning(defaultBaseID) {
    if (!defaultBaseID) defaultBaseID = DEFAULT_TUNING;
    var store = getMyTuningsStore();
    //if (store.length > 0) return;
    var original = findTuningForID(defaultBaseID);
    if (!original) return;
    var cloned = JSON.parse(JSON.stringify(original));
    cloned.baseID = generateNextTuningID(defaultBaseID);
    cloned.fromBaseID = defaultBaseID;
    cloned.instance = true;
    cloned.visible = true;
    store.push(cloned);
}

export function showHideTunings() {
    var tuningsCheckboxes = $('#' + Constants.MY_TUNINGS_TABLE_ID + ' .cbTuningVisible');
    tuningsCheckboxes.each(function (index, element) {
        var theCB = $(element)
        var show = theCB.prop('checked');
        var basekey = theCB.val();
        showHideTuning(show, basekey);
        //console.log("showhideTuning: idx:"+index+" ["+basekey+"] "+show);
    });
    var numTunings = $('#' + Constants.MY_TUNINGS_TABLE_ID + ' .cbTuningVisible:checked').length;
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
    var divKey = "#" + Constants.TABLEDIV_ID_PREFIX + basekey;
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
        getSong().visibleNoteTables.forEach(visTableID => {
            const visbasekey = visTableID.substring(Constants.TABLE_ID_PREFIX.length);
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

export function moveMyTuningUp(baseID) {
    var myTunings = getMyTuningsStore();
    var index = myTunings.findIndex(function (tuning) {
        return tuning.baseID === baseID;
    });
    if (index <= 0) {
        return false;
    }
    var tuning = myTunings[index];
    myTunings.splice(index, 1);
    myTunings.splice(index - 1, 0, tuning);
    return true;
}

export function moveMyTuningDown(baseID) {
    var myTunings = getMyTuningsStore();
    var index = myTunings.findIndex(function (tuning) {
        return tuning.baseID === baseID;
    });
    if (index < 0 || index >= myTunings.length - 1) {
        return false;
    }
    var tuning = myTunings[index];
    myTunings.splice(index, 1);
    myTunings.splice(index + 1, 0, tuning);
    return true;
}

export function removeMyTuning(baseID) {
    var myTunings = getMyTuningsStore();
    var index = myTunings.findIndex(function (tuning) {
        return tuning.baseID === baseID;
    });
    if (index < 0) {
        return false;
    }
    myTunings.splice(index, 1);
    return true;
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


//===================== EventBus handling =======================================
export function reloadMyTuningsDisplay(){
    reloadTuningsDisplay('my');
}
export function reloadAllTuningsDisplay(){
    reloadTuningsDisplay('all');
}
export function reloadTuningsDisplay(which){
        var tuningsInMemoryHash = getSong().getTuningHashInMemoryModel();
        if (which === 'my'){
            var myTuningsDiv = $('#divMyTuningsTab');
            var myTunings = getSong().myTunings || [];
            myTuningsDiv.empty();
            myTuningsDiv
            .append(dumpTuningsToTable(tuningsInMemoryHash, myTunings, {
                tableID: Constants.MY_TUNINGS_TABLE_ID,
                primaryControl: 'visibility'
            }));
        } else if (which === 'all'){
            var allTuningsDiv = $('#divAllTuningsTab');
            allTuningsDiv.empty();
            allTuningsDiv
                .append(dumpTuningsToTable(tuningsInMemoryHash, getLibraryTunings(), {
                    tableID: Constants.ALL_TUNINGS_TABLE_ID,
                    primaryControl: 'clone'
                }));
        }
        bindFormTuningsEvents();
        showTuningsTab('my');
    }

//===================== event binding =======================================
//One dependency: the existence of a form called "#frmTunings" with our tuningstable.

function showTuningsTab(which) {
    var showMy = which !== 'all';
    $('#divMyTuningsTab').toggle(showMy);
    $('#divAllTuningsTab').toggle(!showMy);
    $('#divSongTuningControls').toggle(showMy);
    $('#btnMyTuningsTab')
        .toggleClass('BtnPunchedIn', showMy)
        .toggleClass('BtnPunchedOut', !showMy);
    $('#btnAllTuningsTab')
        .toggleClass('BtnPunchedIn', !showMy)
        .toggleClass('BtnPunchedOut', showMy);
}

function revealPianoReverseWarning(tuningID) {
    $('.captionRow').show();
    const tuningRoot = $('#' + Constants.TABLEDIV_ID_PREFIX + tuningID);
    tuningRoot.find('.subcaption').show();
    tuningRoot.find('.spanTuningDetails').show();
}

function resetSongTuningForm() {
    $('#txtSongTuningID').val('');
    $('#txtLineageID').val('');
    $('#textareaRowRange').val('');
    $('#textareaBanjoNut').val('');
    $('#txtUserInstrumentCaption').val('');
    $('#dropDownBaseInstrument').val('Guitar');
}

export function bindFormTuningsEvents() {
    $('#frmTunings').off('submit').on('submit', function (event) {
        event.preventDefault();
    });

    $('#btnMyTuningsTab').off('click').on('click', function() {
        showTuningsTab('my');
    });
    $('#btnAllTuningsTab').off('click').on('click', function() {
        showTuningsTab('all');
    });
    $('#' + Constants.MY_TUNINGS_TABLE_ID + ' .cbTuningVisible').change(function () {
        var show = this.checked;
        var basekey = this.value;
        var tuning = findTuning(basekey);
        if (tuning) {
            tuning.visible = show;
        } else {
            console.log("tuning not found for basekey: " + basekey);
        }
        if (!show) {
            $('#' + Constants.TABLEDIV_ID_PREFIX + basekey).hide();
        }
        requestReinstallAllTuningsTables();
        showHideTuning(show, basekey);
    });
    $('#frmTunings .checkboxLH').change(function () {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        tuning.reverse = this.checked;
        requestReinstallAllTuningsTables();
        if (tuning.reverse && tuning.baseInstrument === 'Piano') {
            revealPianoReverseWarning(tuningID);
        }
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
    $('#frmTunings .checkboxDoSpecialRows').change(function () {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        tuning.doSpecialRows = this.checked;
        requestReinstallAllTuningsTables();
        refreshShowAllNoteNames();
    });
    $('#frmTunings .checkboxPN').change(function () {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        if (tuning.pianoSkeuomorphic) {
            tuning.pianoNamesRow = false;
            $(this).prop('checked', false);
            return;
        }
        tuning.pianoNamesRow = this.checked;
        requestReinstallAllTuningsTables();
    });
    $('#frmTunings .checkboxPianoSkeuomorphic').change(function () {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        tuning.pianoSkeuomorphic = this.checked;
        normalizePianoLayoutOptions(tuning);
        $('#cbPN' + tuningID)
            .prop('checked', tuning.pianoNamesRow === true)
            .prop('disabled', tuning.pianoSkeuomorphic === true);
        requestReinstallAllTuningsTables();
    });
    $('#frmTunings .checkboxShowDiamonds').change(function () {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        tuning.showDiamonds = this.checked;
        requestReinstallAllTuningsTables();
    });
    $('#frmTunings .checkboxNut').change(function () {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        tuning.nut = this.checked;
        requestReinstallAllTuningsTables();
    });
    $('#btnShowHideAddSongTuning').off('click').on('click', function () {
        $('#divAddSongTuning').toggle();
    });
    $('#btnSaveSongTuning').off('click').on('click', function () {
        let rowRange;
        const rowRangeText = ($('#textareaRowRange').val() || '').trim();
        if (!rowRangeText) {
            alert('MIDI rowRange is required.');
            return;
        }
        try {
            rowRange = convertStringToIntArray(rowRangeText);
        } catch (error) {
            alert('Song tuning RowRange invalid: ' + rowRangeText);
            return;
        }

        let banjoNut = {};
        const banjoNutText = ($('#textareaBanjoNut').val() || '').trim();
        if (banjoNutText) {
            try {
                banjoNut = JSON.parse(banjoNutText);
            } catch (error) {
                alert('BanjoNut invalid JSON: ' + banjoNutText);
                return;
            }
        }

        const createdTuningResult = validateSongTuningDraft({
            baseID: $('#txtSongTuningID').val(),
            fromBaseID: $('#txtLineageID').val(),
            caption: $('#txtUserInstrumentCaption').val(),
            baseInstrument: $('#dropDownBaseInstrument').val(),
            rowRange,
            banjoNut
        });
        if (!createdTuningResult.valid) {
            alert(createdTuningResult.error);
            return;
        }

        const createdTuning = createSongTuningFromDraft(createdTuningResult.normalizedDraft);
        getMyTuningsStore().push(createdTuning);
        reloadMyTuningsDisplay();
        resetSongTuningForm();
        $('#divAddSongTuning').hide();
        requestInstrumentAdded(createdTuning.baseID);
        requestReinstallAllTuningsTables(createdTuning.baseID);
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
        cloned.fromBaseID = baseID;
        cloned.instance = true;
        cloned.visible = true;
        getMyTuningsStore().push(cloned);
        reloadMyTuningsDisplay();
        requestInstrumentAdded(cloned.baseID);
        requestReinstallAllTuningsTables(cloned.baseID);
    });

    $('#frmTunings').off('click', '.btnMoveTuningUp').on('click', '.btnMoveTuningUp', function () {
        var baseID = $(this).data('baseid');
        if (!moveMyTuningUp(baseID)) {
            return;
        }
        reloadMyTuningsDisplay();
        requestReinstallAllTuningsTables(); //todo: make this just reorder the divs, because some are floating.
    });

    $('#frmTunings').off('click', '.btnMoveTuningDown').on('click', '.btnMoveTuningDown', function () {
        var baseID = $(this).data('baseid');
        if (!moveMyTuningDown(baseID)) {
            return;
        }
        reloadMyTuningsDisplay();
        requestReinstallAllTuningsTables();
    });

    $('#frmTunings').off('click', '.btnRemoveTuning').on('click', '.btnRemoveTuning', function () {
        var baseID = $(this).data('baseid');
        if (!removeMyTuning(baseID)) {
            return;
        }
        reloadMyTuningsDisplay();
        requestReinstallAllTuningsTables();
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
            $(this).val(oldID);
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

        reloadMyTuningsDisplay();
        requestReinstallAllTuningsTables();
    });
}

EventBus.on('ReloadTuningsDisplays', function() {
	reloadAllTuningsDisplay();
    reloadMyTuningsDisplay();
});


function requestReinstallAllTuningsTables() {
	EventBus.trigger('ReinstallAllTuningsTables');
	EventBus.trigger('UpdateAllWiringSelects');
}


function requestUpdateAllWiringSelects() {
   EventBus.trigger('UpdateAllWiringSelects'); 
}
function requestInstrumentAdded() {
   EventBus.trigger('InstrumentAdded'); 
}












