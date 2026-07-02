/*  Copyright (c) 2023, 2026 Laramie Crocker http://LaramieCrocker.com  */


import * as Constants from './Constants.js';
import { setOneCssVar } from './themeFunctions.js';
import { decoratePianoSkeuomorphicTable } from './templates/piano/piano-skeuomorphic.builder.js';
import { getDiamondMarkerFret, getDisplayedCellcol } from './table-column-helpers.js';




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
	const doPianoSkeuomorphic = decoratePianoSkeuomorphicTable(table, options);
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
		tuningNoteNames = Constants.midinumToNoteName(options.rowRange[r]) + tuningNoteNames;
		var row = $('<tr>');
		row.addClass("stringRow");
		var namesRow = $("<tr>");
		namesRow.addClass("namesRowTR");
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
				colDisplay = getDisplayedCellcol(options, c);
			} else {
				midinum = options.rowRange[r] + c;
				colDisplay = getDisplayedCellcol(options, c);
			}
			noteName = Constants.midinumToNoteName(midinum);
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
				cell = $('<td class="note deadCell">');
			}
			row.append(cell);
			if (doNamesRow) {
				var sHeight = "";
				var namesRowHeight = options.pianoNamesRowHeight;
				if (namesRowHeight) {
					sHeight = ' style="height: ' + namesRowHeight + '" ';
				}
				var namesCellClass = doPianoSkeuomorphic ? 'namesRowCell ' + noteClass : 'namesRowCell';
				var namesTdline = '<td class="' + namesCellClass + '" >';
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

	let captionRow = buildCaptionRow(options, tableID);
	instrumentBackground.append(captionRow);

	let wiringAndFretTable = $("<div>");
	wiringAndFretTable.addClass("wiringAndFretTable");
	if (doPianoSkeuomorphic) {
		instrumentBackground.addClass("pianoSkeuomorphicInstrument");
		wiringAndFretTable.addClass("pianoSkeuomorphicInstrument");
	}
	let divWiring = $("<div>");
	divWiring.attr("id", Constants.TABLEDIV_ID_PREFIX + options.baseID + "_wiring");
	divWiring.addClass("divWiring");
	divWiring.html("Wiring for "+Constants.TABLEDIV_ID_PREFIX + options.baseID+" goes here.");
	wiringAndFretTable.append(divWiring);
	instrumentBackground.append(wiringAndFretTable);

	let widgetDest = $("<span>");
	widgetDest.addClass('leftRailSectionStatusHost');

	let fretTableWrapper = $("<div>");
	fretTableWrapper.addClass("fretTableWrapper");
	if (doPianoSkeuomorphic) {
		fretTableWrapper.addClass("pianoSkeuomorphicWrapper");
	}
		var table3 = $("<table>");
		var row = $("<row>");
		table3.append(row);
		var td1 = $("<td class='tdLeftRailStack'>");
			let leftRailStack = $("<div class='leftRailStack'>");
			let leftRailCaptionHost = $("<div class='leftRailCaptionHost'>");
			leftRailCaptionHost.addClass('ssCaptionWrapper');
			let fretTableLeftCaption = $("<span class='fretTableLeftCaption'>");
			fretTableLeftCaption.addClass('SectionStatus_captionRoleTarget');
			fretTableLeftCaption.attr('data-tablename', tableID);
			fretTableLeftCaption.html(options.baseID);
			leftRailCaptionHost.append(fretTableLeftCaption);
			SectionStatusBuilder.createWidget(widgetDest, tableID, 'leftRail', 'vertical', {
				roleClassTargets: [fretTableLeftCaption]
			});
			leftRailStack.append(widgetDest);
			leftRailStack.append(leftRailCaptionHost);
			td1.append(leftRailStack);
			row.append(td1);
		var td3 = $("<td>");
			td3.append(table);
			row.append(td3);

	fretTableWrapper.append(table3);
	wiringAndFretTable.append(fretTableWrapper);

	let instrumentBackgroundOuter = $("<div>");
	instrumentBackgroundOuter.addClass("instrumentBackgroundOuter");
	instrumentBackgroundOuter.append(instrumentBackground);

	return instrumentBackgroundOuter;
}

function buildCaptionRow(options, tableID) {
	var hamburger = "<button id='btnHamburger" + options.baseID + "' class='HamburgerInstrumentClass showsubcaption moveyButton' type='button' >&equiv;</button>";
	var hamburgerCaptionRowButtons = "<button id='btnHamburgerCaptionRowButtons" + options.baseID + "' class='showCaptionRowButtons subcaptionButton' type='button' >&equiv;</button>";
	var hamburgerColorDict = "<button id='btnHamburgerColorDict" + options.baseID + "' class='showcolordict subcaptionButton' type='button' >M<small>ini</small>P<small>alette</small></button>";
	var hamburgerLeftCaption = "<button id='btnHamburgerLeftCaption" + options.baseID + "' class='showLeftCaption subcaptionButton' type='button' data-tableid='" + tableID + "' title='Show left side caption'>C</button>";
	var hamburgerLeftSectionMark = "<button id='btnHamburgerLeftSectionMark" + options.baseID + "' class='showLeftSectionMark subcaptionButton' type='button' data-tableid='" + tableID + "' title='Show left side Section info'>S</button>";
	var hamburgerTuningDetails = "<button id='hamburgerTuningDetails" + options.baseID + "' class='showTuningDetails subcaptionButton' type='button' >T<small>uning</small></button>";
	var hamburgerNoteDetails = "<button id='hamburgerNoteDetails" + options.baseID + "' class='showNoteDetails subcaptionButton' type='button' >N<small>ote</small></button>";
	var hamburgerTonalDetails = "<button id='hamburgerTonalDetails" + options.baseID + "' class='showTonalDetails subcaptionButton' type='button' >T<small>onal</small></button>";
	
	//Not really a btnHamburger, but that's where this button's event is wired: installBtnHamburgerClicks() 
	var btnShowWiring = "<button id='btnHamburgerShowWiring" + options.baseID + "' class='showWiringButton subcaptionButton' type='button' tabindex='-1'>W<small>iring</small></button>";

	var joniTuning = "<span><small>Joni:</small>" + getJoniTuning(options) + "</span>";
	var noteClickedCaption = "<span class='lblNoteClickedCaption'></span>";
	var tuningBaseIDCaption = "<span class='tuningBaseIDCaption'>" + options.caption + ':</span>';
	var tuningIDCaption = '<span class="tuningIDCaption SectionStatus_captionRoleTarget" data-tablename="' + tableID + '">' + options.baseID + '</span>';
	var tuningIDnStrings = '<span>' + options.nStrings + '-string:</span>';
	var tuningIDbaseInstrument = '<span>' + options.baseInstrument + '</span>';

	var captionRow = $("<div>");
	captionRow.addClass("captionRow");
	var reverse = options.reverse ? '&nbsp;&nbsp;<span class="tuningReverseCaption">Left-Handed</span>' : '';
	var btnPopOutDiv = `<button id="btnFloatSection_div${options.baseID}" class="subcaptionButton floatDockableButton" onclick="makeDivDockable('div${options.baseID}')">F<small>loat</small></button>`;
	
	var tonalInfo = "<span id='"+tableID + "_captionRowTonalInfo' class='captionRowTonalInfo'></span>";

	let spanCaptionRowLiveInfo = $('<span>');
	spanCaptionRowLiveInfo.attr('id', tableID + '_captionRowLiveInfo');
	spanCaptionRowLiveInfo.addClass('captionRowLiveInfo');
	
		
	const TDTD = "</td><td>";

	captionRow.html(
		hamburger 
		+ '<span class="captionRowInstrument ssCaptionWrapper">'
		+ tuningIDCaption
		+ '</span>'
		+ '<span class="subcaption">'
		+ '<table id="captionRowTable"><tr><td>'

		+ hamburgerCaptionRowButtons
		+ '<span class="captionRowButtons">'
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
		+' </span>'
		
		+TDTD
		+ "<span class='captionRowNoteCell'>"
		+ hamburgerNoteDetails
		+ "<span class='spanNoteDetails'>"
		+ noteClickedCaption
		+"</span>"
		+"</span>"
		
		+TDTD
		+ hamburgerTonalDetails
		+TDTD
		+ "<span class='spanTonalDetails'>"
		+ tonalInfo
		+"</span>"
		+TDTD

		+'</td></tr></table>' //end table captionRowTable
		+ '</span>' //end span subcaption
	);
	SectionStatusBuilder.createWidget(spanCaptionRowLiveInfo, tableID, 'captionRow', 'horizontal', {
		roleClassTargets: captionRow.find('.SectionStatus_captionRoleTarget')
	});
	captionRow.append(spanCaptionRowLiveInfo);
	captionRow.append($("<div class='currentColorDict''></div>"));
	return captionRow;
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
			tuningNoteNames = Constants.midinumToNoteName(firstStringNum);
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
	const tableID = Constants.TABLE_ID_PREFIX + options.baseID;
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
	for (var dc = 0; dc < nCols; dc++) {
		var td = $('<td>');
		td.addClass('diamonds');
		var displayedCellcol = getDisplayedCellcol(options, dc);
		var markerFret = getDiamondMarkerFret(options, dc);
		if (options.reverse) {
			if (options.nut) {
				if (dc == (nCols - 1)) td.addClass("diamondRowSupernut");
			}
		} else {
			if (options.nut) {
				if (dc == 0) td.addClass("diamondRowSupernut");
			}
		}
		td.attr('cellcol', displayedCellcol);
		td.attr('celltable', tableID);
		if (dblArr.includes(markerFret)) {
			td.html(doubleDiamonds);
		} else if (arr.includes(markerFret)) {
			td.html(singleDiamond);
		} else {
			td.html("&nbsp;");
		}
		diamondRow.append(td);
	}
	return diamondRow;
}



export function rowRangeToNoteNames(rowRange, options) {
	var numRows = rowRange.length;
	var tuningNoteNames = "";
	for (var r = 0; r < numRows; r++) { 
		var midi = rowRange[r];
		if (options.banjoNut && options.banjoNut[r]) {
			var banjoNut = options.banjoNut[r];
			midi += banjoNut;
		}
		tuningNoteNames = Constants.midinumToNoteName(midi) + tuningNoteNames;

	}
	return tuningNoteNames;

}

