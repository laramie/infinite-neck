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

	var table = $('<table>');
	table.attr("border", "0");
	table.attr("cellpadding", "0");
	table.attr("cellspacing", "4");
	table.attr("id", Constants.TABLE_ID_PREFIX + options.baseID);
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
			cell.attr("celltable", Constants.TABLE_ID_PREFIX + options.baseID);
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

	var div = $('<div>');
	div.addClass("instrumentBackground");
	div.attr("id", Constants.TABLEDIV_ID_PREFIX + options.baseID);
	var exportButton = "&nbsp;&nbsp;<button class='exportButton moveyButton' tabindex='-1' data-export-tableid='" + Constants.TABLE_ID_PREFIX + options.baseID + "'>Export Highlights</button>";
	var hamburger = "<button id='btnHamburger" + options.baseID + "' class='HamburgerInstrumentClass showsubcaption moveyButton' type='button' tabindex='-1'>&equiv;</button>";
	var hamburgerColorDict = "<button id='btnHamburgerColorDict" + options.baseID + "' class='showcolordict moveyButton' type='button' tabindex='-1'><img src='img/colordictThumbnail.png' style='width:35px;height:15px;'></button>";
	
	//Not really a btnHamburger, but that's where this button's event is wired: installBtnHamburgerClicks() 
	var btnShowWiring = "<button id='btnHamburgerShowWiring" + options.baseID + "' class='showWiringButton moveyButton' type='button' tabindex='-1'>Wiring</button>";

	var spanLeadDifferentFromRoot = "&nbsp;<span class='spanLeadDifferentFromRoot'></span>";
	var spanRootID = "&nbsp;&nbsp;&nbsp;<span class='lblRootID'></span>";
	var joniTuning = "<span class='joniTuning'><small>Joni:</small>" + getJoniTuning(options) + "</span>";
	var noteClickedCaption = "<span class='lblNoteClickedCaption'></span>";
	var tuningBaseIDCaption = '<span class="tuningBaseIDCaption">' + options.caption + '</span>&nbsp;&nbsp;&nbsp;';
	var tuningIDCaption = '<span class="tuningIDCaption">' + options.baseID + '</span>&nbsp;&nbsp;&nbsp;';
	var sectionMark = '<span class="instrumentSectionBox" id="relSec_'+Constants.TABLE_ID_PREFIX+options.baseID+'"></span>';
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
		+ btnShowWiring + S + S
		+ '</span>'
		+ hamburger + S + S + sectionMark  +S
		+ "<div class='currentColorDict''></div>" + S

	);
	div.append(p);

	let divWiring = $("<div>");
	divWiring.attr("id", Constants.TABLEDIV_ID_PREFIX + options.baseID + "_wiring");
	divWiring.addClass("divWiring");
	divWiring.html("Wiring for "+Constants.TABLEDIV_ID_PREFIX + options.baseID+" goes here.");
	div.append(divWiring);
	
	
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

