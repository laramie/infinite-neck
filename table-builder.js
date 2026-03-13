/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */

import EventBus from './event-bus.js';
import {
	allTunings
} from './tunings.js';


const NUM_FRETS_MAX = 108;
const DEFAULT_NOTE_NAMES = "A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab".split(',');
let getSongProvider = function () {
    return null;
};
let getNoteNamesProvider = function () {
	return DEFAULT_NOTE_NAMES;
};

export function setSongProvider(providerFn) {
    if (typeof providerFn === 'function') {
        getSongProvider = providerFn;
    }
}

export function setNoteNamesProvider(providerFn) {
	if (typeof providerFn === 'function') {
		getNoteNamesProvider = providerFn;
	}
}

function getSong() {
    return getSongProvider();
}

function requestReinstallAllTuningsTables() {
    EventBus.trigger('ReinstallAllTuningsTables');
}

function requestReloadAllTuningsDisplay() {
    EventBus.trigger('ReloadAllTuningsDisplay');
}

function getMyTuningsStore() {
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

export const TABLE_ID_PREFIX = "tbl";
export const TABLEDIV_ID_PREFIX = "div";
export const ALL_TUNINGS_TABLE_ID = "allTuningsTable";
export const MY_TUNINGS_TABLE_ID = "myTuningsTable";

//the "table" is the instrument NoteTable, i.e. the neck, not the tunings html table on the Tunings page.
export function buildNoteTable(options) {
	if (options.visible == false) {
		//console.log("NOT building invisible table: "+options.caption);
		return null;
	}
	var midinum;
	var nutClass = "";
	var noteName = "";
	var colDisplay = 0;
	var numRows = options.rowRange.length;

	var table = $('<table>');
	table.attr("border", "0");
	table.attr("cellpadding", "0");
	table.attr("cellspacing", "4");
	table.attr("id", TABLE_ID_PREFIX + options.baseID);
	table.attr("rowRange", '[' + options.rowRange.toString() + ']');
	table.attr("reversed", options.reverse);
	table.attr("fretTableBuilt", true);
	table.addClass("fretTable");
	if (options.leftmargin) {
		table.addClass("leftmarginInstrument");
	}
	var doNamesRow = options.pianoNamesRow;
	var stringDividerHeight = options.stringDividerHeight;
	var doStringDivider = false;
	if (stringDividerHeight && ("" + stringDividerHeight) != "0") {
		doStringDivider = true;
	}
	var tuningNoteNames = "";
	for (var r = 0; r < numRows; r++) {
		tuningNoteNames = midinumToNoteName(options.rowRange[r]) + tuningNoteNames;
		var row = $('<tr>');
		row.addClass("stringRow");
		var namesRow = $("<tr>");
		var dividerRow = $("<tr>");
		dividerRow.addClass('stringDividerTR');
		var nCols = options.nut ? options.frets + 1 : options.frets;
		var banjoNut = options.banjoNut ? options.banjoNut[r] : undefined;

		for (var c = 0; c < nCols; c++) {
			var deadCell = false;
			if (banjoNut) {
				nutClass = "";
				if (options.reverse) {
					if (c == (nCols - banjoNut - 1)) {
						nutClass = "nutR";
					} else if (c > (nCols - banjoNut - 1)) {
						deadCell = true;
					}
				} else {
					if (c == banjoNut) {
						nutClass = "nut";
					} else if (c < banjoNut) {
						deadCell = true;
					}
				}
			} else if ((c == 0) && options.nut && !options.reverse) {
				nutClass = "nut";
			} else if ((c == options.frets) && options.nut && options.reverse) {
				nutClass = "nutR";
			} else {
				nutClass = "";
			}

			if (options.reverse) {
				midinum = options.rowRange[r] + options.frets - c;
				colDisplay = options.frets - c;
			} else {
				midinum = options.rowRange[r] + c;
				colDisplay = c;
			}
			noteName = midinumToNoteName(midinum);
			var noteClass = "note" + noteName;//"noteD";
			var notePinkClass = "";
			if (options.pinkKey && noteName == options.pinkKey) {
				notePinkClass = " notePinkKey";
			}
			var tdline = '<td class="note ' + noteClass + notePinkClass + ' ' + nutClass + '" noteName="' + noteName + '">';
			var cell = $(tdline).html("");
			cell.attr("midiNum", "" + midinum);
			cell.attr("cellrow", r);
			cell.attr("cellcol", colDisplay);
			cell.attr("celltable", TABLE_ID_PREFIX + options.baseID);
			cell.html("" + noteName);
			if (deadCell) {
				cell = $('<td class="note" style="min-width: 1em; background-color: #222;">');
			}
			row.append(cell);
			if (doNamesRow) {
				var sHeight = "";
				var namesRowHeight = options.pianoNamesRowHeight;
				if (namesRowHeight) {
					sHeight = ' style="height: ' + namesRowHeight + '" ';
				}
				var namesTdline = '<td class="namesRowCell" >';
				var colorArea = $('<div class="' + noteClass + '" ' + sHeight + ' >');
				colorArea.html(noteName);
				var namesCell = $(namesTdline);
				namesCell.append(colorArea);
				namesRow.append(namesCell);
			}
			if (doStringDivider && r > 0) {
				var dividerCell = $("<td class='stringDividerTD'>");
				dividerRow.append(dividerCell);
			}
		} //end for-loop columns
		if (doStringDivider) {
			dividerRow.css({ "height": stringDividerHeight });
			table.append(dividerRow);
		}
		if (doNamesRow) {
			table.append(namesRow);
		}


		table.append(row);
	} //end for-loop rows

	if (options.diamonds) {
		var diamondRow = diamondsRow(options);
		if (diamondRow != null) {
			table.append(diamondRow);
		}
	} else {
		if (doStringDivider) {
			dividerRow.css({ "height": stringDividerHeight });
			table.append(dividerRow);
		}
	}

	var div = $('<div>');
	div.addClass("instrumentBackground");
	div.attr("id", TABLEDIV_ID_PREFIX + options.baseID);
	var exportButton = "&nbsp;&nbsp;<button class='exportButton moveyButton' tabindex='-1' data-export-tableid='" + TABLE_ID_PREFIX + options.baseID + "'>Export Highlights</button>";
	var hamburger = "<button id='btnHamburger" + options.baseID + "' class='HamburgerInstrumentClass showsubcaption moveyButton' type='button' tabindex='-1'>&equiv;</button>";
	var hamburgerColorDict = "<button id='btnHamburgerColorDict" + options.baseID + "' class='showcolordict moveyButton' type='button' tabindex='-1'><img src='img/colordictThumbnail.png' style='width:35px;height:15px;'></button>";

	var spanLeadDifferentFromRoot = "&nbsp;<span class='spanLeadDifferentFromRoot'></span>";
	var spanRootID = "&nbsp;&nbsp;&nbsp;<span class='lblRootID'></span>";
	var joniTuning = "<span class='joniTuning'><small>Joni:</small>" + getJoniTuning(options) + "</span>";
	var noteClickedCaption = "<span class='lblNoteClickedCaption'></span>";
	var tuningBaseIDCaption = '<span class="tuningBaseIDCaption">' + options.caption + '</span>&nbsp;&nbsp;&nbsp;';
	var tuningIDCaption = '<span class="tuningIDCaption">' + options.baseID + '</span>&nbsp;&nbsp;&nbsp;';
	var p = $("<p>");
	p.addClass("captionRow");
	var reverse = options.reverse ? '&nbsp;&nbsp;<span class="tuningReverseCaption">Left-Handed</span>' : '';
	var S = "&nbsp;&nbsp;";
	p.html(tuningBaseIDCaption
		+ tuningIDCaption
		+ '<span class="subcaption">'
		+ options.nStrings + '-string '
		+ options.baseInstrument
		+ '&nbsp;&nbsp;&nbsp;[' + rowRangeToNoteNames(options.rowRange, options) + ']' + S
		+ joniTuning
		+ reverse
		+ exportButton + S
		+ spanRootID
		+ spanLeadDifferentFromRoot + S
		+ noteClickedCaption
		+ hamburgerColorDict + S + S
		+ '</span>'
		+ hamburger + S + S
		+ "<div class='currentColorDict''></div>" + S

	);
	div.append(p);
	div.append(table);
	return div;
}

export function getJoniTuning(options) {
	var len = options.rowRange.length;
	var last = len - 1;  //zero-based.
	// First, bottom string:
	var tuningNoteNames = "";
	var firstStringNum = options.rowRange[last];
	if (options.banjoNut && options.banjoNut[last]) {
		firstStringNum = firstStringNum + options.banjoNut[last];
	}
	var prevStringNum = firstStringNum;
	for (var r = last; r >= 0; r--) {
		var currStringNum = options.rowRange[r];
		var semitones = currStringNum - prevStringNum;
		if (r == last) {
			tuningNoteNames = midinumToNoteName(firstStringNum);
		} else {
			var st = (semitones < 0) ? '(' + semitones + ')' : semitones;
			tuningNoteNames = tuningNoteNames + st;
		}
		prevStringNum = currStringNum;
	}
	var result = '[' + tuningNoteNames + ']';
	return result;
}

export function diamondsRow(options) {
	var arr = options.diamonds; //[3,5,7,9,15,17,19,21]
	var dblArr = options.doubleDiamonds; //[12,24];
	if (!dblArr) { 
		dblArr = [];
	}
	var singleDiamond = "&#9672;";
	var doubleDiamonds = '<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr class="diamondsRow" ><td class="doubleDiamonds">&#9672;</td>'
		+ '</tr><tr><td class="doubleDiamonds">&#9672;</td></tr></table>';
	var diamondRow = $("<tr  class='diamondsRow' >");
	//diamondRow.addClass('diamonds');
	diamondRow.addClass('NotAString');
	var nCols = options.nut ? options.frets + 1 : options.frets;
	var dcwn;
	for (var dc = 0; dc < nCols; dc++) {
		var td = $('<td>');
		td.addClass('diamonds');
		dcwn = dc;  //short for DiamondColumnWithNut
		if (options.reverse) {
			if (options.nut) {
				dcwn = (options.frets - 1) - dc;
				if (dc == (nCols - 1)) td.addClass("diamondRowSupernut");
			} else {
				dcwn = options.frets - dc;
			}
		} else {
			if (options.nut) {
				dcwn = dc - 1;
				if (dc == 0) td.addClass("diamondRowSupernut");
			} else {
				dcwn = dc;
			}
		}
		if (dblArr.includes(dcwn + 1)) {  //user reads JSON file value as 1-based.
			td.html(doubleDiamonds);
		} else if (arr.includes(dcwn + 1)) {
			td.html(singleDiamond);
		} else {
			td.html("&nbsp;");
		}
		diamondRow.append(td);
	}
	return diamondRow;
}

export function midinumToNoteName(midinum) {
	if (midinum <= 9) {
		midinum += 12;
	}
	var index = (midinum - 9) % 12;
	return getNoteNamesProvider()[index];
	// 21 == A0
	// 9 == A, 8 Ab, 7 G, 6 Gb, 5 F, 4 E, 3 Eb, 2 D, 1 Db, 0 C
}

export function rowRangeToNoteNames(rowRange, options) {
	var numRows = rowRange.length;
	var tuningNoteNames = "";
	for (var r = 0; r < numRows; r++) { 
		var midi = rowRange[r];
		if (options.banjoNut && options.banjoNut[r]) {
			var nCols = options.nut ? options.frets + 1 : options.frets;
			var banjoNut = options.banjoNut[r];
			midi += banjoNut;
		}
		tuningNoteNames = midinumToNoteName(midi) + tuningNoteNames;

	}
	return tuningNoteNames;

}

export function generateNextTuningID(baseID) {
	// Given S6, generate S6_1, S6_2, etc.
	// Given S6_1, generates S6_2, etc.
	var allMyTunings = getMyTuningsStore() || [];
	var prefix = baseID.endsWith('_') ? baseID : baseID + '_';
	var existingNumbers = [];
	
	allMyTunings.forEach(function(tuning) {
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





export function showDefaultTuning() {
	//if none, then show for newbies or browsers that clear checkboxes:
	var numShowing = showHideTunings();
	if (numShowing == 0) {
		console.log("================== NOT showDefaultTuning showing P46 ==========="); 
		//showHideTuning(true, "P46");
	}
	return numShowing;
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
		var stacktrace = "";
		try {
			throw new Error();
		} catch (e) {
			stacktrace = "" + e.stack;
		}
		alert("Tuning not found for: " + basekey + " at: " + stacktrace);
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

			tun.baseInstrument = $('#dropDownBaseInstrument  option:selected').val();

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
