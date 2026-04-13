/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */


import * as Constants from './Constants.js';
import * as TuningsLibrary from './TuningsLibrary.js';
import { setOneCssVar } from './themeFunctions.js';

const DEFAULT_NOTE_NAMES = "A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab".split(',');

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
	const tableID = Constants.TABLE_ID_PREFIX + options.baseID;

	var table = $('<table>');
	table.attr("border", "0");
	table.attr("cellpadding", "0");
	table.attr("cellspacing", "4");
	table.attr("id", tableID);
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

	let addBackgroundImageWithoutTheme = false;

	for (var r = 0; r < numRows; r++) {
		tuningNoteNames = midinumToNoteName(options.rowRange[r]) + tuningNoteNames;
		var row = $('<tr>');
		row.addClass("stringRow");
		var namesRow = $("<tr>");
		var dividerRow = $("<tr>");
		dividerRow.addClass('stringDividerTR');
		var nCols = options.nut ? options.frets + 1 : options.frets;
		var banjoNut = options.banjoNut ? options.banjoNut[r] : undefined;

    	//$('.noteDb:not(.nut,.nutR,.noBackgroundImg)').addClass("noteBlackKey");
		let specialBackgroundIDRowsClass = "";
		if (options.doSpecialRows && options.specialBackgroundIDRows){
			if (options.specialBackgroundIDRows && options.specialBackgroundIDRows.includes(r)) {
				specialBackgroundIDRowsClass = 'specialRowBackgroundImg';
				addBackgroundImageWithoutTheme = true;
			}
		}


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
				notePinkClass = "notePinkKey";
			}
			var tdline = '<td class="note ' + noteClass +' '+ notePinkClass +' '+ nutClass +' '+ specialBackgroundIDRowsClass + '" noteName="' + noteName + '">';
			var cell = $(tdline).html("");
			cell.attr("midiNum", "" + midinum);
			cell.attr("cellrow", r);
			cell.attr("cellcol", colDisplay);
			cell.attr("celltable", tableID);
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

	if (addBackgroundImageWithoutTheme){
		//setOneCssVar("--special-row-border-image-black-key", "url('img/celtic-background-black.png')");
		//setOneCssVar("--special-row-border-image-white-key", "url('img/celtic-background-white.png')");
		setOneCssVar("--special-background-color-black-key", "#110500");
		setOneCssVar("--special-background-color-white-key", "#ffdd77");
	}

	if (options.diamonds && options.showDiamonds) {
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

	var instrumentBackground = $('<div>');
	instrumentBackground.addClass("instrumentBackground");
	instrumentBackground.attr("id", Constants.TABLEDIV_ID_PREFIX + options.baseID);
	var hamburger = "<button id='btnHamburger" + options.baseID + "' class='HamburgerInstrumentClass showsubcaption moveyButton' type='button' >&equiv;</button>";
	//var hamburgerColorDict = "<button id='btnHamburgerColorDict" + options.baseID + "' class='showcolordict moveyButton' type='button' ><img src='img/colordictThumbnail.png'></button>";
	var hamburgerColorDict = "<button id='btnHamburgerColorDict" + options.baseID + "' class='showcolordict sectionDrawerButton' type='button' >M<small>ini</small>P<small>alette</small></button>";
	var hamburgerLeftCaption = "<button id='btnHamburgerLeftCaption" + options.baseID + "' class='showLeftCaption sectionDrawerButton' type='button' >C</button>";
	var hamburgerLeftSectionMark = "<button id='btnHamburgerLeftSectionMark" + options.baseID + "' class='showLeftSectionMark sectionDrawerButton' type='button' >S</button>";
	var hamburgerTuningDetails = "<button id='hamburgerTuningDetails" + options.baseID + "' class='showTuningDetails sectionDrawerButton' type='button' >T<small>uning</small></button>";
	
	//Not really a btnHamburger, but that's where this button's event is wired: installBtnHamburgerClicks() 
	var btnShowWiring = "<button id='btnHamburgerShowWiring" + options.baseID + "' class='showWiringButton sectionDrawerButton' type='button' tabindex='-1'>W<small>iring</small></button>";

	var joniTuning = "<span><small>Joni:</small>" + getJoniTuning(options) + "</span>";
	var noteClickedCaption = "<span class='lblNoteClickedCaption'></span>";
	var tuningBaseIDCaption = '<span>' + options.caption + '</span>';
	var tuningIDCaption = '<span>' + options.baseID + '</span>';
	var tuningIDnStrings = '<span>' + options.nStrings + '-string</span>';
	var tuningIDbaseInstrument = '<span>' + options.baseInstrument + '</span>';

	var captionRow = $("<div>");
	captionRow.addClass("captionRow");
	var reverse = options.reverse ? '&nbsp;&nbsp;<span class="tuningReverseCaption">Left-Handed</span>' : '';
	var btnPopOutDiv = `<button id="btnFloatSection_div${options.baseID}" class="sectionDrawerButton floatDockableButton" onclick="makeDivDockable('div${options.baseID}')">F<small>loat</small></button>`;
	
	captionRow.html(
		hamburger 
		+ '<span class="captionRowInstrument">'
		+ tuningIDCaption
		+ '</span>'
		+ '<span class="subcaption">'
		+ hamburgerLeftCaption
		+ hamburgerLeftSectionMark 
		+ hamburgerColorDict
		+ btnShowWiring
		+ btnPopOutDiv
		+ hamburgerTuningDetails
		+ '<span class="spanTuningDetails">'
		+ tuningBaseIDCaption
		+ tuningIDnStrings
		+ tuningIDbaseInstrument
		+ '<span>[' + rowRangeToNoteNames(options.rowRange, options) + ']</span>'
		+ joniTuning
		+ reverse
		+ '</span>'
		+ noteClickedCaption
		+ '</span>'
		+ '<span class="captionRowLiveInfo">'
		+   formatKeyBoxes(tableID, "1", false)
		+ '</span>'
		+ "<div class='currentColorDict''></div>"
	);
	instrumentBackground.append(captionRow);

	let wiringAndFretTable = $("<div>");
	wiringAndFretTable.addClass("wiringAndFretTable");

	let divWiring = $("<div>");
	divWiring.attr("id", Constants.TABLEDIV_ID_PREFIX + options.baseID + "_wiring");
	divWiring.addClass("divWiring");
	divWiring.html("Wiring for "+Constants.TABLEDIV_ID_PREFIX + options.baseID+" goes here.");
	
	
	wiringAndFretTable.append(divWiring);
	instrumentBackground.append(wiringAndFretTable);
	
	let fretTableWrapper = $("<div>");
	fretTableWrapper.addClass("fretTableWrapper");
		var tbl = $("<table><tr><td class='fretTableTDCaption'></td><td class='fretTableTDSectionMark'></td><td></td></tr></table>");
			let fretTableLeftCaption = $("<span class='fretTableLeftCaption'>");
			fretTableLeftCaption.html(options.baseID);
			tbl.find('td:first').append(fretTableLeftCaption);
			tbl.find('td:nth-child(2)').append(formatKeyBoxes(tableID, "2", true));
			tbl.find('td:nth-child(3)').append(table);
	fretTableWrapper.append(tbl);
	wiringAndFretTable.append(fretTableWrapper);

	let instrumentBackgroundOuter = $("<div>");
	instrumentBackgroundOuter.addClass("instrumentBackgroundOuter");
	instrumentBackgroundOuter.append(instrumentBackground);

	return instrumentBackgroundOuter;
}

function formatKeyBoxes(tableID, idx, vertical){
	if (vertical){
		return `<table>
				  	<tr>
						<td class="LooperLightTD">
							<span class="instrumentSectionBox LooperLight" id='relSec${idx}_${tableID}'></span>
						</td>
					</tr>
				  	<tr id='normalKeys${idx}_${tableID}'>
						<td>
							<span class='lblRootID'></span>&nbsp;
						</td>
					</tr>
				  	<tr id='normalKeys${idx}_${tableID}'>
						<td>
							<span class='spanLeadDifferentFromRoot'></span>&nbsp;
						</td>
					</tr>
					<tr id='relativeKeys${idx}_${tableID}'>
						<td>				
							<span class='lblRootIDRelative' id='relSecRootID${idx}_${tableID}'></span>&nbsp;
							</td>
					</tr>
				  	<tr id='relativeKeys${idx}_${tableID}'>
						<td>
							<span class='lblRootIDLeadRelative' id='relSecRootIDLead${idx}_${tableID}'></span>&nbsp;
						</td>
					</tr>
				</table>
			`;
	} else {
		return ` 
				 <span class="instrumentSectionBox LooperLight" id='relSec${idx}_${tableID}'></span>
				 <span id='normalKeys${idx}_${tableID}'>
					<span class='lblRootID'></span>
					<span class='spanLeadDifferentFromRoot'></span>
				 </span><span id='relativeKeys${idx}_${tableID}'>
					<span class='lblRootIDRelative' id='relSecRootID${idx}_${tableID}'></span>
					<span class='lblRootIDLeadRelative' id='relSecRootIDLead${idx}_${tableID}'></span>
				 </span>
			`;	
	}
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
	return DEFAULT_NOTE_NAMES[index];
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

