/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */


import * as Constants from './Constants.js';
import {
	chuseStylesheet,
	deleteUserStylesheet,
	showColorPicker,
	showHatchPicker,
	colorPickerClicked,
	hatchPickerClicked,
	recordUserColors,
	recordUserColorsFromSection,
	applyStylesheetsTo_gUserColorDict,
	buildColorDicts,
	buildUserColors,
	setColorFunctionsProviders
} from './colorFunctions.js';
import {
	hideCmdLine,
	toggleCmdLine,
	txtCmdLine_keypress 
} from './command-line.js';
import {
	setDisplayOptionsProviders
} from './display-options.js';
import {
	draggable
} from './drag.js';
import {
	makeGraveyard,
	setGraveyardProviders
} from './graveyard.js';
import {
	getFontSize,
	getUIFontSize,
	hideGraveyard,
	getNoteFontSize,
	setUIFontSize,
	setNoteFontSize,
	setSectionKeysFlats,
	setSectionKeysSharps,
	setKeyHandlerProviders,
	showMessages,
	hideMessages,
	document_keypress,
	document_keyup
} from './key-handlers.js';
import {
	setLooperProviders,
	restartLoopSections,
	sectionsLooping,
	toggleLoopBeats,
	toggleLoopSections
} from './looper.js';
import './menu.js';
import {
	buildCellsFromSelector,
	clearAll,
	clearHighlights,
	colorNote,
	colorSingleNotes,
	fillChord,
	highlightOneNote,
	replay,
	setNotetableProviders,
	showHighlightsForBeat,
	showMidiNotesInTable,
	fullRepaint
} from './NoteTableController.js';
import {
	Note
} from './note.js'; 
import {
	Song
} from './song.js';
import {
	clearRecordedNotes,
	setSectionRecorderProviders
} from './section-recorder.js';
import './svgLines.js';
import {
	controlsToTheme,
	auditThemes,
	clearThemeDiffResults,
	getDefaultTheme,
	getThemes,
	getWidget_SelectThemes,
	INFO,
	setOneCssVar,
	theme,
	themeToControls
} from './themeFunctions.js';
import * as TableBuilder from './TableBuilder.js';
import * as TuningsLibrary from './TuningsLibrary.js';
import {
	allTunings
} from './tunings.js';
import {
	gUserColorDict,
	gUserColorDictRolesDefault,
	gUserColorDictFingeringsDefault,
	gDefault_CycleOfColors,
	gAllClear,
	gUserColorDictOEM
} from './userColors.js';
import {
	convertRGB_to_HEX,
	invertColor,
	scrollToTop,
	toInt
} from './utils.js';
import * as WiringBuilder from './templates/WiringBuilder.js';

// If running in a browser, call appInit() on DOM ready
if (typeof window !== 'undefined' && typeof $ !== 'undefined') {
	$(function() {
		if (typeof appInit === 'function') appInit();
	});
}

	
	const SHARP = "&#9839;";
	const FLAT = "&#9837;";
	const NATURAL = "&nbsp;";
	const DEFAULT_BEATS_PER = 4;
	const DEFAULT_BPM = 80;

	const gBEND_CLASSES = "semitone1 semitone2 semitone3 prebend1 prebend2 prebend3 updown1 updown2 updown3"
						  +" semitone1LH semitone2LH semitone3LH prebend1LH prebend2LH prebend3LH updown1LH updown2LH updown3LH";

	// Section Index (high-level)
	// 1) Core providers and accessors
	// 2) Section/song state helpers
	// 3) File open/save and persistence
	// 4) UI event binding and control wiring
	// 5) App init and EventBus integration

	//==================== 1) Core providers and accessors ====================

	var gSong = null;  //constructed in document ready.
	export function getSong(){
		return gSong;
	}

	function installModuleProviders(){
		setDisplayOptionsProviders({
			getSong,
			controlsToDisplayOptions
		});
		setGraveyardProviders({
			getSong,
			applyStylesheet: chuseStylesheet
		});
		setLooperProviders({
			getSong,
			getMillisForBeatClock,
			showBeats,
			showBPM
		});
		setNotetableProviders({
			getBeatNumber,
			getCurrentSection,
			getSong,
			hideNoteClickedCaption,
			resetNoteNames,
			setNoteClickedCaption,
			showBeats,
			turnOffHiding
		});
		setSectionRecorderProviders({
			getCurrentSection,
			clearHighlights
		});
		setKeyHandlerProviders({
			addBeat,
			checkRB,
			clearAndReplaySection,
			cycleThruKeys,
			cycleThruNutWidths: (...args) => cycleThruNutWidths(...args),
			downloadBackupThenClearGraveyard,
			downloadPlayedNotes,
			enterFullscreen,
			getBPM,
			getCurrentSection,
			getSectionsCurrentIndex,
			getSong,
			hideAllMenuDivs,
			highlightOneNote,
			leaveFullscreen,
			printSections,
			resetNoteNames,
			sectionChanged,
			setBPM,
			setNamedNoteOpacity,
			setSingleNoteOpacity,
			setTinyNoteOpacity,
			showOneMenu,
			skipColorDictsReplacer,
			toggleCaption,
			toggleFullscreen,
			toggleInstrumentCaptionRow,
			toggleTransport,
			transpose,
			transposeSong,
			transposeSongKeys,
			updateFontLabel,
			updateMemoryModelPreFileSave,
			updateSectionsStatus
		});
		setColorFunctionsProviders({
			getSong,
			getCurrentSection,
			doingAutomaticColor: (...args) => doingAutomaticColor(...args),
			fullRepaint
		});
	}

	installModuleProviders();

	let version =  {"gitTag": "NOT INITIALIZED"}
	function fetchVersionInBrowser() {
		// Fetch version.json once at module load and store in module-level const
		version = { gitTag: 'LOADING', error: null };
		fetch('version.json')
			.then(response => {
				if (!response.ok) throw new Error('Failed to load version.json');
				return response.json();
			})
			.then(json => {
				version = json;
			})
			.catch(err => {
				version = { gitTag: 'ERROR', error: err.message };
				console.error('Error loading version.json:', err);
			});
	}

	export function getVersionString() {
	  return 	(version.gitTag || 'UNKNOWN');
	}
	export function getVersionObject(){
		return (version || {"error": "version didn't load"});
	}

	export function getCurrentSection(){
	    return getSong().getCurrentSection();
	}

	export function getSectionsCurrentIndex(){
	    return getSong().getSectionsCurrentIndex();
	}

	export function getSections(){
	    return getSong().getSections();
	}
	//==================== 2) Section/song state helpers ======================

	export function checkRB(id){
		$(id).prop("checked", true);
	}
	
	export function buildDropDownSectionOrderOptions(){
		var len = getSong().getSections().length;
		var curr = getSong().getSectionsCurrentIndex();
		var result = "<option value='BEGIN'>BEGIN</option>";
		for (var i=0; i<len; i++){
			var iStr = ""+(i+1);
			if (i==curr){
				result += "<option value='"+i+"' selected>"+iStr+"</option>";
			} else {
				result += "<option value='"+i+"'>"+iStr+"</option>";
			}
		}
		result += "<option value='END'>END</option>";
		return result;
	}

	export function showHideDisplayOptionsPresent(){
		var options = getCurrentSection().displayOptions;
		if (options){
			$('#btnDeleteDisplayOptions,#btnDeleteDisplayOptions2').prop("disabled",false);
		} else {
			$('#btnDeleteDisplayOptions,#btnDeleteDisplayOptions2').prop("disabled",true);
		}
	}

	export function sectionChanged(){
		$('#dropDownSectionOrder').html(buildDropDownSectionOrderOptions());
		$("#dropDownRoot").val(getCurrentSection().rootID);
	    $("#dropDownRootLead").val(getCurrentSection().rootIDLead);
		var options = getCurrentSection().displayOptions;
		if (options){
			displayOptionsToControls(options);
		}
		showHideDisplayOptionsPresent();
	    getSong().gotoFirstBeat();
	    showHighlightsForBeat(getSong().getBeat());
	    updateSectionsStatus();
	}

	export function updateSectionsStatus(){
		$(".lblSectionsStatusSectionNo").html(""+(getSong().getSectionsCurrentIndex()+1));
	    var txt = ""+(getSong().getSectionsCurrentIndex()+1)+"/"+ getSong().sections.length;
	    $("#lblSectionsStatus").html(txt);
	    $("#lblSectionsStatus2").html(txt);
	    $("#txtBeatsPer" ).val(getSong().getBeats());
		$("#lblBeats").html(getSong().getBeats());
	    var jLblCurrentBeat = $("#lblCurrentBeat");
	    jLblCurrentBeat.text("1");
	    $("#lblBeat").html("1");

	    //clearRecordedNotes();
	    $("#txtCaption").val(getSong().getCurrentSection().caption);
	    var key =  getSong().getCurrentSection().rootID;
	    var rawCaption = getSong().getCurrentSection().caption;
		var caption = eval("\`"+rawCaption+"\`");
	    $(".lblSectionCaption").html(caption);

		var currentFilename = $("#txtFilename").val();
	    $(".lblSongName").html(currentFilename);
		//getSong().songName = currentFilename;

		var rootIndex = toInt(getSong().getCurrentSection().rootID, 0);
	    var rootIndexLead = toInt(getSong().getCurrentSection().rootIDLead, 0);
		var keyname = getSong().noteIDToNoteName(rootIndex);
		var keynameLead = getSong().noteIDToNoteName(rootIndexLead);

	    $(".lblRootID").html(keyname);

	    var spans = $(".spanLeadDifferentFromRoot");
	    if (getSong().getCurrentSection().rootIDLead != "-1"){
	        spans.html("lead key: "+keynameLead);
	        spans.show();
	        $(".lblRootIDLead").html(keynameLead).show();
	    } else {
          spans.hide();
          $(".lblRootIDLead").hide();//zanzibar
	    }
		showHideDisplayOptionsPresent();
	}

	export function clearAndReplaySection(){
		getSong().gotoFirstBeat();
		clearAll();
		resetNoteNames(); //calls replay()
		updateSectionsStatus();
		showBeats();
		//prevSection calls this: updateSectionsStatus();

	}

	export function showBeats(){
		var beat = getSong().getBeat();
		$("#lblBeat").html(""+beat);
		$("#lblCurrentBeat").text(""+beat);
		showHighlightsForBeat(beat);
	}

	export function getMillisForCurrentSection(){
	    var beats = DEFAULT_BEATS_PER;
	    var sBeats = getCurrentSection().beats;
	    if (sBeats){
	        beats = parseInt(sBeats);
	    }

	    var bpm = getBPM();
	    var millisNextTimeout = (beats/bpm)*60*1000;
	    return millisNextTimeout;
	}

	export function showBPM(){
		$(".bpm").html(getSong().defaultBPM+"<small>bpm</small>");
	}

	export function setBPM(newValue){
		$("#txtBPM").val(newValue);
		getSong().defaultBPM = ""+newValue;
		showBPM();
	}

	export function getBPM(){
	    var sBpm = $("#txtBPM").val();
	    var bpm = parseInt(sBpm);
	    if (Number.isNaN(bpm) || bpm == 0){
	        bpm = DEFAULT_BPM;
	    }
	    getSong().defaultBPM = ""+bpm;
	    return bpm;
	}

	export function getMillisForBeatClock(){
	    var bpm = getBPM();
	    var fBpm =  (1/bpm)*60*1000;
	    return fBpm;
	}

		function cloneTuningForSong(tuning) {
			return JSON.parse(JSON.stringify(tuning));
		}

		export function collectSongOwnedTunings(song) {
			if (!song) {
				return [];
			}
			var builtInBaseIDs = new Set(allTunings.tunings.map(function(tuning) {
				return tuning.baseID;
			}));
			var customTunings = [];
			var seenBaseIDs = new Set();
			var addCustomTuning = function(tuning) {
				if (!tuning || !tuning.baseID || tuning.baseID === "USER") {
					return;
				}
				if (builtInBaseIDs.has(tuning.baseID) || seenBaseIDs.has(tuning.baseID)) {
					return;
				}
				seenBaseIDs.add(tuning.baseID);
				customTunings.push(cloneTuningForSong(tuning));
			};

			if (Array.isArray(song.myTunings)) {
				song.myTunings.forEach(addCustomTuning);
			}
			if (Array.isArray(song.tunings)) {
				song.tunings.forEach(addCustomTuning);
			}
			return customTunings;
		}

		function loadSongOwnedTunings() {
			getSong().myTunings = collectSongOwnedTunings(getSong());
		}

		function getStartupTuningBaseID(defaultBaseID) {
			var fallback = defaultBaseID || 'S6';
			if (typeof window === 'undefined' || !window.location || typeof URLSearchParams === 'undefined') {
				return fallback;
			}

			var raw = new URLSearchParams(window.location.search || '').get('tuning');
			if (!raw) {
				return fallback;
			}

			var requested = raw.trim();
			if (!requested) {
				return fallback;
			}

			var variants = [];
			var addVariant = function(value) {
				if (!value) {
					return;
				}
				if (!variants.includes(value)) {
					variants.push(value);
				}
			};

			addVariant(requested);
			addVariant(requested.toUpperCase());
			if (requested.startsWith(Constants.TABLE_ID_PREFIX)) {
				addVariant(requested.substring(Constants.TABLE_ID_PREFIX.length));
			}
			if (requested.toUpperCase().startsWith(Constants.TABLE_ID_PREFIX.toUpperCase())) {
				addVariant(requested.substring(Constants.TABLE_ID_PREFIX.length).toUpperCase());
			}

			for (var i = 0; i < variants.length; i++) {
				var candidate = variants[i];
				if (!candidate) {
					continue;
				}
				var byID = TuningsLibrary.findTuningForID(candidate);
				if (byID && byID.baseID !== 'USER') {
					return byID.baseID;
				}
				if (candidate.includes('_')) {
					var baseCandidate = candidate.split('_')[0];
					var byBase = TuningsLibrary.findTuningForID(baseCandidate);
					if (byBase && byBase.baseID !== 'USER') {
						return byBase.baseID;
					}
				}
			}

			return fallback;
		}

	function showTuningsTab(which) {
		var showMy = which !== 'all';
		$('#divMyTuningsTab').toggle(showMy);
		$('#divAllTuningsTab').toggle(!showMy);
		$('#btnMyTuningsTab')
			.toggleClass('BtnPunchedIn', showMy)
			.toggleClass('BtnPunchedOut', !showMy);
		$('#btnAllTuningsTab')
			.toggleClass('BtnPunchedIn', !showMy)
			.toggleClass('BtnPunchedOut', showMy);
	}

	export function showMessagesTab(which) {
		var showMsgs = which !== 'JsonTree';
		   $('#divMessages').toggle(showMsgs);
		   $('#divJsonTree').toggle(!showMsgs);
		   let selector = '#btnMessagesTab, #btnJsonTreeTab, #btnHideMessagesJsonTree';
		   $(selector).css('display', 'inline-block');

		   $('#btnMessagesTab')
			   .toggleClass('BtnPunchedIn', showMsgs)
			   .toggleClass('BtnPunchedOut', !showMsgs);
		   $('#btnJsonTreeTab')
			   .toggleClass('BtnPunchedIn', !showMsgs)
			   .toggleClass('BtnPunchedOut', showMsgs);
	   }
	function hideMessages_KeyHandler(){
		hideMessages();
	}

	export function reloadAllTuningsDisplay(){
		    var tuningsInMemoryHash = getSong().getTuningHashInMemoryModel();
			var myTuningsDiv = $('#divMyTuningsTab');
			var allTuningsDiv = $('#divAllTuningsTab');
			var myTunings = getSong().myTunings || [];
			var userControls = allTuningsDiv.find('.userInstrumentControlsGroup').detach();
			myTuningsDiv.empty();
			allTuningsDiv.empty();
			myTuningsDiv
				.append(TuningsLibrary.dumpTuningsToTable(tuningsInMemoryHash, myTunings, {
					tableID: Constants.MY_TUNINGS_TABLE_ID,
					primaryControl: 'visibility'
				}));
			allTuningsDiv
				.append($("<p><b>All Tunings</b></p>"))
				.append(TuningsLibrary.dumpTuningsToTable(tuningsInMemoryHash, allTunings.tunings, {
					tableID: Constants.ALL_TUNINGS_TABLE_ID,
					primaryControl: 'clone'
				}));
			if (userControls.length > 0) {
				allTuningsDiv.append(userControls);
			}
		TuningsLibrary.bindFormTuningsEvents();
	}

	function updateAllWiringSelects() {
		WiringBuilder.updateAllWiringSelects();
	}

	export function resetSharpsControls() {
	    //turn all to sharps
	    $(".ddnAb").html("G<small>&#9839;&nbsp;</small>");
	    $(".ddnBb").html("A<small>&#9839;&nbsp;</small>");
	    $(".ddnDb").html("C<small>&#9839;&nbsp;</small>");
	    $(".ddnEb").html("D<small>&#9839;&nbsp;</small>");
	    $(".ddnGb").html("F<small>&#9839;&nbsp;</small>");
	}

	export function resetFlatsControls() {
	    //turn all to flats
	    $(".ddnAb").html("A<small>&#9837;</small>");
	    $(".ddnBb").html("B<small>&#9837;</small>");
	    $(".ddnDb").html("D<small>&#9837;</small>");
	    $(".ddnEb").html("E<small>&#9837;</small>");
	    $(".ddnGb").html("G<small>&#9837;</small>");
	}

	export function resetSharps(options) {
		buildCells(getSong().sharps, options);
		resetSharpsControls();
	}

	export function resetFlats(options) {
		buildCells(getSong().sharps, options);
		resetFlatsControls();
	}


	export function resetNoteNames() {
	    var options = {};
	    var rootID = getCurrentSection().rootID;
	    getSong().sharps = getCurrentSection().sharps;
	    if (rootID!=null && ((""+rootID).length>0)) {
	        options.rootID = rootID;
			options.rootIDLead = getCurrentSection().rootIDLead;//20240423
	        //console.log("=========Using rootID from getCurrentSection(): "+rootID+" ");
	    } else {
	        var optVal = $('#dropDownRoot').val();
			var rootIDLead = $("#dropDownRootLead").val();
	        options.rootID = parseInt(optVal);
			options.rootIDLead = toInt(rootIDLead, -2);
	        //console.log("==========NOT Using rootID:"+rootID+", using dropDownRoot value instead: "+optVal+" options.rootID: "+options.rootID);
	        getCurrentSection().rootID = options.rootID;
	        getCurrentSection().rootIDLead = options.rootIDLead;
	    }
	    options.showCellNotes = $("#cbShowCellNotes").prop("checked");
	    options.showSubscriptFunctions = $("#cbShowSubscriptFunctions").prop("checked");
	    options.cellIsFunction = ($('input[name="rbnFunctionNotename"]:checked').val() == "showFunction");
	    options.showMidiNum = $("#cbMidiNum").prop("checked");
		options.useCenterForRightFunction = $("#cbCenterForRightFunction").prop("checked");
		options.NoteDisplaySizes = {"width":$("#dropDownCellWidth").val(),"height":$("#dropDownCellHeight").val()};
		options.naturalFretWidths = $("#cbNaturalFretWidths").prop("checked");
		options.naturaFontScaling = toInt($('#selNaturaFontScaling').val(), 60);

	    if (getSong().sharps) {
	        resetSharps(options);
	        resetSharpsControls();
	    } else {
	        resetFlats(options);
	        resetFlatsControls();
	    }
		if ($("#rbNotename").prop("checked")) {
			$('#btnNoteV').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
			$('#btnFuncV').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
		} else if ($("#rbFunction").prop("checked")) {
			$('#btnFuncV').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
			$('#btnNoteV').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
		}
		replay();
	}

	export function buildCells(sharps, options) {
		updateMemoryModelPreFileSave();
		console.log("############# getSong().visibleNoteTables: "+JSON.stringify(getSong().visibleNoteTables));
		let theVisibleNoteTables = getSong().visibleNoteTables;
		theVisibleNoteTables.forEach(tableID => {
		    buildCellsForTable(sharps, options, `#${tableID}`);
		});
	}
	export function buildCellsForTable(sharps, options, tableID=""){
		let tableID_prefix = "";
		if (tableID){
			tableID_prefix = tableID + ' ';
		}
		if (sharps) {
			buildCellsFromSelector(tableID_prefix+"td.noteAb", "G", SHARP, 11, options);
			buildCellsFromSelector("td.noteBb", "A", SHARP, 1, options);
			buildCellsFromSelector("td.noteDb", "C", SHARP, 4, options);
			buildCellsFromSelector("td.noteEb", "D", SHARP, 6, options);
			buildCellsFromSelector("td.noteGb", "F", SHARP, 9, options);
		} else {
			buildCellsFromSelector(tableID_prefix+"td.noteAb","A", FLAT, 11, options);
			buildCellsFromSelector("td.noteBb","B", FLAT, 1, options);
			buildCellsFromSelector("td.noteDb","D", FLAT, 4, options);
			buildCellsFromSelector("td.noteEb","E", FLAT, 6, options);
			buildCellsFromSelector("td.noteGb","G", FLAT, 9, options);
		}
		buildCellsFromSelector("td.noteA","A", NATURAL, 0, options);
		buildCellsFromSelector("td.noteB","B", NATURAL, 2, options);
		buildCellsFromSelector("td.noteC","C", NATURAL, 3, options);
		buildCellsFromSelector("td.noteD","D", NATURAL, 5, options);
		buildCellsFromSelector("td.noteE","E", NATURAL, 7, options);
		buildCellsFromSelector("td.noteF","F", NATURAL, 8, options);
		buildCellsFromSelector("td.noteG","G", NATURAL, 10, options);
	}

	// List of menu divs, accessed through .entries(), and associated button names,
	//  accessed through selectors stored in values with menu as key: AllMenuDivs[strMenuDiv]
	const AllMenuDivs = {
		"#palette": "#btnPalette",
		"#divFileControls": "#btnFileControls",
		"#divSectionControls": "#btnSectionControls",
		"#divViewControls": "#btnViewControls",
		"#divThemeControls": "#btnThemeControls",
		"#divFillNotes": "#btnFillNotes",
		"#divTunings": "#btnTunings",
		"#divDesktop": "#btnDesktop"
	}

	export function hideAllMenuDivs(){
		for (const [key, value] of Object.entries(AllMenuDivs)){
			$(key).hide();
		}
		$('.MainMenuTabBtn').removeClass("BtnPunchedIn").addClass("BtnPunchedOut");
	    //$("#topControlsCaptions").show();
	 }

	 export function showOneMenu(strMenuDiv){
		 var wasFull = leaveFullscreen();
		 var jStrMenuDiv = $(strMenuDiv);
		 if (wasFull){
			 hideAllMenuDivs();
			 jStrMenuDiv.show();
		 } else {
		     if (jStrMenuDiv.is(":visible") ){
				 hideAllMenuDivs();
		     } else {
				 hideAllMenuDivs();
		         jStrMenuDiv.show();
				 $(AllMenuDivs[strMenuDiv]).addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
		     }
		 }
		 //$("#topControlsCaptions").hide();
		 scrollToTop();
	 }

	 export function getHelpTopic(){
		 var anchor = "";
		 for (const [key, value] of Object.entries(AllMenuDivs)){
			 var jStrMenuDiv = $(key);
			 if (jStrMenuDiv.is(":visible")){
			 	anchor = key;
				break;
 			 }
 		 }
		 return  'help.html'+anchor;
	 }

	export function exportFromTable(tblSource){
		const visibleTableIds = TuningsLibrary.getAllTunings()
		    .filter(t => $(`#${Constants.TABLEDIV_ID_PREFIX}${t.baseID}`).is(':visible'))
		    .map(t => Constants.TABLE_ID_PREFIX + t.baseID);
		getSong().markVisibleTablesForFileSave(visibleTableIds);
		Object.entries(getSong().visibleNoteTables).forEach(([tableDestKey, tableDest]) => {
			if (tblSource != tableDest){
				//console.log("src:"+tblSource+", dest:"+tableDest);
				exportPlayedNotesToOtherTable(tblSource, tableDest);
			}
		});
	}

	export function exportPlayedNotesToOtherTable(tblSource, tblDest){
	  var noteArr = getSong().getTableArrInCurrentSection(tblSource);
	  noteArr.forEach(noteCell => {
		  //console.log("exportPlayedNotesToOtherTable "+noteCell.midinum+","+noteCell.row);
		  var jtd = showMidiNotesInTable(tblDest, noteCell.midinum, noteCell.row);
		  //colorNote(jtd);
		  colorSingleNotes(jtd, noteCell.colorClass, noteCell.styleNum, false);
	  });
	}



	export function turnOnKeep(){
      $("#idKeep").prop("checked", true);
  }

  export function hideNoteClickedCaption(){
     $(".lblNoteClickedCaption").hide();
  }

  export function setNoteClickedCaption(cell, theColorClass, styleNum){
      var caption = "";
      if (cell.attr('midinum')){
          $(".lblNoteClickedCaption").show();
		  var celltable = cell.attr('celltable');
		  if (celltable){
			  celltable = celltable.substring("lbl".length);
		  }
          caption = " "
                   +cell.attr('noteName')+'&nbsp;&nbsp;&nbsp;<small>'+celltable+'</small>['
	                 +(parseInt(cell.attr('cellrow'))+1)+','
	                 +cell.attr('cellcol')+']&nbsp;<small>midi:</small>'
	                 +cell.attr('midinum')
					 +'&nbsp;<small>'+Note.styleNumToCaption(styleNum)+':'+theColorClass+'</small>' ;
	    }
      $(".lblNoteClickedCaption").html(caption);
   }

  	export function getBeatNumber(){
		return $("#lblCurrentBeat").text();
	}

	export function doingAutomaticColor(){
		return $("#cbAutomaticColor").prop("checked");  //automaticColorScheme
	}

	export function turnOffHiding(){
	    var hideNamedNotes = $("#cbHideNamedNotes").prop("checked");
	    var hideTinyNotes = $("#cbHideTinyNotes").prop("checked");
	    var hideSingleNotes = $("#cbHideSingleNotes").prop("checked");
	    var hideFingering = $("#cbHideFingering").prop("checked");
	    $("#cbHideNamedNotes").prop("checked", false);
	    $("#cbHideTinyNotes").prop("checked", false);
	    $("#cbHideSingleNotes").prop("checked", false);
	    $("#cbHideFingering").prop("checked", false);
	    $("#lblHideWarning").hide();
	    if (hideNamedNotes || hideTinyNotes || hideSingleNotes || hideFingering){
	        clearAll();
	        replay();
	    }
  	}

	export function updateMemoryModelPreFileSave(){
	    const visibleTableIds = TuningsLibrary.getMyTunings()
	        .filter(t => $(`#${Constants.TABLEDIV_ID_PREFIX}${t.baseID}`).is(':visible'))
	        .map(t => Constants.TABLE_ID_PREFIX + t.baseID);
	    var bpm = parseInt($("#txtBPM").val());
	    if (Number.isNaN(bpm) || bpm == 0) { bpm = DEFAULT_BPM; }
	    getSong().prepareForSave({
	        visibleTableIds,
	        songName: $("#txtFilename").val(),
	        theme: $('#selThemes').val(),
	        bpm,
	        userColors: gUserColorDict.dict,
	        userInstrumentTuning: TuningsLibrary.findTuningForID("USER")  //Persistence only. allTunings.tunings with id="USER" is the live object used at runtime.
	    });
	}

	export function downloadBackupThenClearGraveyard(){
		downloadPlayedNotes();
		getSong().graveyard.clear();
		showMessages(getSong().graveyard.buildNoteTable()); // No change: buildNoteTable is not a TableBuilder method here
	}

	//==================== 3) File open/save and persistence ==================

	//Use this function to skip saving the ColorDics, because they get generated anyway.
	// Ultimately, only user-customized dicts should be saved, but right now it is doing 
	// all the default run-time generated dicts, bloating the file.
	// And other run-time props are removed.
	export function skipColorDictsReplacer(key, value){
		if (   key === 'userColors' 
			|| key === 'colorDicts' 
			|| key === 'fretLengths' 
			|| key === 'noteNamesFuncArr' ) {
			return undefined;
		}
		return value;
	}

    // file save / save file / saveFile event
	export function downloadPlayedNotes(){
	    updateMemoryModelPreFileSave();
	    //var text = JSON.stringify(getSong(), null, 2); // Create element. (with 2 spaces indentation)
	    var text = JSON.stringify(getSong(), skipColorDictsReplacer, 2); // Create element. (with 2 spaces indentation)
	    //console.log("saved file:\r\n"+text);
		var a = document.createElement('a'); // Attach href attribute with value of your file.
	    //a.setAttribute("href", "data:application/xml;charset=utf-8," + text);
	    var fname = "";
	    fname = $("#txtFilename").val().trim();
	    if (fname==""){
	        fname = "untitled";
	    }

		const blob = new Blob([text], {type: "application/json"});
		const url = URL.createObjectURL(blob);
		a.setAttribute("href", url)
	    a.setAttribute("download", fname+".json");   // HTML5 property, to force browser to download it.
	    a.click();
	    hideAllMenuDivs();
	}

    // file open / open file / openFile event
	export function setupOpenFile(){
	  	var fileInput = document.getElementById('fileInput');
		fileInput.addEventListener('change', function(e) {  //click works, but is too jumpy. change doesn't work when you apply same file.
		    var file = fileInput.files[0];
			var textType = /json.*/;
			if (file.type.match(textType)) {
				var reader = new FileReader();
				reader.onload = function(e) {
					var str = JSON.stringify(reader.result, null, 2); // spacing level = 2
					openSong(reader.result);
				}
				hideAllMenuDivs();
				reader.readAsText(file);
			} else {
				console.warn("File not supported!"+file.name);
			}
        });
	}

	export function openSong(str){
		var numFoundBeforeFileLoad = TuningsLibrary.showTuningsForTablesInFile();
		if (numFoundBeforeFileLoad==0){
			TuningsLibrary.hideAllTunings();
		}
		var jsonObj = JSON.parse(str);
		Object.assign(gSong, jsonObj);
		loadSongOwnedTunings();
		getSong().fixupCurrentIndexForLoadedSong();

		if (getSong().userInstrumentTuning){
			var theUSERTuning = TuningsLibrary.findTuningForID("USER");
			if (theUSERTuning){
				TuningsLibrary.hideAllTunings();
				Object.assign(theUSERTuning, getSong().userInstrumentTuning);  //the version in the song model is just used for persistence. allTunings.tunings array keeps the USER tuning that is used at runtime.
			}
		}

		var frs = [];
		Object.values(jsonObj.sections).forEach(section => {
			var replacementSection = getSong().constructSection();
			section = Object.assign(replacementSection, section);
			frs.push(section);
		});
		jsonObj.sections = frs;
		if (!getSong().isEmpty(getSong().getCurrentSection())){

			var yes = $("#cbAppendSections").prop("checked");
			if (!yes){
				getSong().removeAllSections();
			}
		}
		getSong().addSections(jsonObj);
		getSong().graveyard = makeGraveyard(getSong().graveyard);

		var userTheme = getSong().userTheme;
		if (userTheme){
			userTheme["id"] = "USER";
			getThemes()["USER"] = userTheme;
			getSong().theme = "USER";
		}
		rebuildThemesDropdown();

		

		updateAfterOpenSong();
	}


	export function updateAfterOpenSong(){
		hideGraveyard();
		installDefaultColorDicts();
		
		let songTheme = getSong().theme;  //some songs, e.g. snake.json, don't have theme stored.
		if (!songTheme){
			songTheme = getDefaultTheme().id;
		}
		$('#mySelect').val(songTheme).change();

		$("#txtFilename").val(getSong().songName).change();
		$("#cbPresentationMode").prop("checked", !!getSong().presentationMode).change();

		setBPM(getSong().defaultBPM);

		applyStylesheetsTo_gUserColorDict();
		buildColorDicts();


		var tuningsShowing = TuningsLibrary.showTuningsForTablesInFile();
		if (tuningsShowing == 0){
			TuningsLibrary.showDefaultTuning();
		}

		replay();
		sectionChanged();
	}

	export function installDefaultColorDicts(){
		getSong().colorDicts["All-Clear"] = gAllClear;
		getSong().colorDicts["CycleOfColors"] = gDefault_CycleOfColors;
		getSong().colorDicts["Roles"] = gUserColorDictRolesDefault;
		getSong().colorDicts["Fingerings"] = gUserColorDictFingeringsDefault;
		getSong().colorDicts["Default"] = gUserColorDictOEM;
	}


	export function loadSong(songName){
		$.get( "songs/"+songName, function( data ) {  //jQuery automatically calls something like JSON.parse and turns the result into a real javascript Object.
			if (!getSong().isEmpty(getSong().getCurrentSection())){
				var yes = confirm("Keep previous Song Sections? ( 'Cancel' deletes !! Otherwise, 'OK' adds new Song Sections at end of current Song Sections.)");
				if (!yes){
					getSong().removeAllSections();
				}
			}
			openSong(JSON.stringify(data));
		});
	}

	export function songLibrary(){
		var divSongList = $('#divSongList');
		if (divSongList.is(":visible") && divSongList.html().trim().length > 0){
			divSongList.hide();
		} else {
			$.get( "songs/song-list.json", function(data){
				var result = "";
				Object.values(data.songs).forEach(song => {
					result = result + "<a href='#' data-action='loadSong' data-action-arg='"+song+"'>"+song+"</a><br />";
				});
				$('#divSongList').html(result).show();
			});
		}
	}

	export function showGraveyard(){
		hideAllMenuDivs();
		showMessages(getSong().graveyard.buildNoteTable());
	}

	export function increaseUIFont(){
		setUIFontSize(getUIFontSize() + 1);
	}

	export function decreaseUIFont(){
		setUIFontSize(getUIFontSize() - 1);
	}

	export function increaseNoteFont(){
		setNoteFontSize(getNoteFontSize() + 1);
	}

	export function decreaseNoteFont(){
		if (getNoteFontSize() > 0.5){
			setNoteFontSize(getNoteFontSize() - 1);
		}
	}

	export function installAllTuningsTables(){
		var count = 0;
		var tunings = TuningsLibrary.getAllTunings();
		for (let i = 0; i < tunings.length; i++) {
			var div = TableBuilder.buildNoteTable(tunings[i]);
			if (div){
		        $('#tabledest')
				    .append(div)
				    .on("click", "td", function() { // This function will execute when any td inside #container is clicked
					    var noteRole = $(this).attr('noteRole'); 
						$("input[name=rbColor][value="+noteRole+"]")
							.attr('checked', 'checked');
							//this div has a ColorDict generated by buildColorDicts 
							// and then we click on the TDs in there, 
							// and the role has been stored in the td attr "noteRole"
						turnOffAutoColorCheckbox();	
					});
				count++;
			}
	    }
		if (count==0){
			var warning = $("<div class='warningMessage'>");
			warning.html("No tunings chosen: click the Tunings button.");
			$('#tabledest').append(warning);
		}
		buildColorDicts();
	}

	export function reinstallAllTuningsTables(){
			var target = $("#tabledest");
			target.empty();
			installAllTuningsTables();
			installTDNoteClick();
			installBtnHamburgerClicks();
			clearAll();
			resetNoteNames();
			TuningsLibrary.showHideTunings();
	}

	export function installTDNoteClick(){
		$('td.note').off('click').click(function(event) {
			colorNote($(this));
			event.stopPropagation();
		});
	}

	export function installRBColorChangeEvents(){
		$( 'input[name="rbColor"]:radio' ).change(function() {
			if ("noteKeep" === $(this).val()){
			} else if ("noteDropper" === $(this).val()){
				$("td.note").css({"cursor": "zoom-in"});
			} else {
				$("td.note").css({"cursor": "pointer"});
				turnOffHiding();
			}
		});
		$( 'input[name="rbColor"]' ).click(function() {
			$('input[name="rbColor"]').css({"box-shadow": "none"});
			$("td.note").css({"cursor": "auto"});
		});
	}


  export function addBeat(){
          clearHighlights();
          var jLblCurrentBeat = $("#lblCurrentBeat");
	        var sBeats = $("#txtBeatsPer").val();
	        if (sBeats == ""){
	            $("#txtBeatsPer").val("1");
	            sBeats = $("#txtBeatsPer").val();
	            jLblCurrentBeat.text("1");
	            $("#lblBeat").html("1");
				$("#lblBeats").html(sBeats);
	            return;
	        }
	        var sCurrBeat = jLblCurrentBeat.text();
	        var currBeat = parseInt(sCurrBeat);
	        var beats = parseInt(sBeats);
	        if (currBeat == beats){
	                beats++;
	                currBeat++;
	                $("#txtBeatsPer").val(beats);
					$("#lblBeats").html(beats);
	                jLblCurrentBeat.text(currBeat);
	                $("#lblBeat").html(currBeat);
	        } else if (currBeat < beats) {
	                beats++;
	                $("#txtBeatsPer").val(beats);
					$("#lblBeats").html(beats);
	        }
			getCurrentSection().beats = beats;
			$('#lblBeats').html(beats);
			showBeats();
  }

	// see also: song.js :: cycleThruKeysAllSections()
	export function cycleThruKeys(amount){
		var curr = toInt(getCurrentSection().rootID, 0);
		curr=(12+curr + amount) % 12;
		getCurrentSection().rootID = curr;
		$("#dropDownRoot").val(getCurrentSection().rootID);
		resetNoteNames();
		clearRecordedNotes();// TODO: make sure this is OK, and delete this comment: This clears highlights correctly, and used to be in updateSectionsStatus, but didn't belong there.
		updateSectionsStatus();
	}

	export function leaveFullscreen(){
		var wasVisible =  $('.container').is(':visible');
		$('.container').show();
		$("#tabledestTopPad").hide();
		$("#divESCAPE").hide();
		return !wasVisible;
	}
	export function enterFullscreen(showESCButton){
		$('.container').hide();
		$("#tabledestTopPad").show();
		if (showESCButton){ // undefined ==> false
			$("#divESCAPE").show();
		}
	}
	
	export function toggleFullscreen(){
		var wasVisible =  $('.container').is(':visible');  //container holds the menu buttons, so NOT fullscreen when visible.
		$('.container').toggle();
		if (wasVisible){
			getSong().captionsRowShowing = $('.captionRow').is(":visible");
			$('.captionRow').hide();
			$("#tabledestTopPad").show();
		} else {
			if (getSong().captionsRowShowing){
				$('.captionRow').show();
			} else {
				$('.captionRow').hide();
			}
			$("#tabledestTopPad").hide();
			$("#divESCAPE").hide();
		}
	}
	export function showTransport() {
		$('#transport').show();
	}
	export function toggleTransport(){
		//var wasVisible =  $('.transport').is(':visible');
		$('#transport').toggle();
	}
	export function toggleCaption(){
		$('#topControlsCaptions').toggle();
	}
	export function toggleInstrumentCaptionRow(){
		$('.captionRow').toggle();
	}

	
	

	export function transpose(amount){
		cycleThruKeys(amount);
		var namedNoteName = getSong().moveNamedNotes(amount);

		//fullRepaint();//Don't do this, it is a bit slow because it rebuilds.
		clearAll();
		replay();
		showBeats();

		highlightOneNote(namedNoteName);
	}

	export function transposeSong(amount){
		getSong().cycleThruKeysAllSections(amount);
		var namedNoteName = getSong().moveNamedNotesAllSections(amount);
		fullRepaint();
		/*clearAll();
		replay();
		showBeats();

		highlightOneNote(namedNoteName);
		*/
	}

	export function transposeSongKeys(amount){
		getSong().cycleThruKeysAllSections(amount);
		fullRepaint();
		showBeats();
	}

		export function printTablesStats(noteTables){
			let result = "";
			const B = "<br />";
			Object.entries(noteTables).forEach(([key, tableArr]) => {
				result += B + key + ":" + tableArr.length;
			});
			return result;
		}

		export function printSections(){
			const sections = getSections();
			const B = "<br />";
			let result = "<table border='1' cellspacing='0'><tr><th>ID</th><th>beats</th><th>KEY</th><th>&sharp;/&flat;</th><th>Caption</th><th>Details</th>";
			let namedNotes, specialNotes;
			sections.forEach((section, idx) => {
				namedNotes = (section.namedNotes && Object.keys(section.namedNotes).length > 0) ? "namedNotes: " + JSON.stringify(Object.keys(section.namedNotes)) : "";
				specialNotes = (section.noteTables && Object.keys(section.noteTables).length > 0) ? "<br />SpecialNotes: " + printTablesStats(section.noteTables) : "";
				const SEP = "</td><td>";
				result += "<tr><td>"
					+ "<a href='#' data-action='linkToSection' data-action-arg='" + idx + "'>" + (toInt(idx, 0) + 1) + "</a>" + SEP
					+ section.beats + SEP
					+ "<B style='font-size: 130%;'>" + getSong().noteIDToNoteName(section.rootID) + (section.rootIDLead != -1 ? "/" + getSong().noteIDToNoteName(section.rootIDLead) : "") + "</B>" + SEP
					+ (section.sharps ? " &sharp; " : " &flat; ") + SEP
					+ "<b style='font-size: 130%;'>" + section.caption + "</b>" + SEP
					+ namedNotes
					+ specialNotes
					+ "</td></tr>";
			});
			return result + "</table>";
		}

		export function linkToSection(idx){
			getSong().gotoSection(idx);
			hideCmdLine();
		}

		export function rangeNamedNoteSlide(element_id, value) {  //called when someone drags the slider--fires javascript onChange from html.
	        //console.log("rangeSlide:"+element_id+" value: "+value);
			setNamedNoteOpacity_inner(element_id, value);
	    }

		export function setNamedNoteOpacity_inner(element_id, newValue){
			getSong().namedNoteOpacity = newValue;
			//console.log("setNamedNoteOpacity_inner element_id:"+element_id+" value: "+newValue);
			clearAll();
		    replay();
		    updateSectionsStatus();
		}

		export function getNamedNoteOpacity(){
			return $("#rangeNamedNoteOpacity").val();
		}

		export function setNamedNoteOpacity(newValue){
			$("#rangeNamedNoteOpacity").val(newValue);
			setNamedNoteOpacity_inner(null, newValue);
		}

		//======== SingleNote opacity ==========

		export function getSingleNoteOpacity(){
			return $("#rangeSingleNoteOpacity").val();
		}

		export function setSingleNoteOpacity(newValue){
			$("#rangeSingleNoteOpacity").val(newValue);
			setSingleNoteOpacity_inner(null, newValue);
		}

		export function setSingleNoteOpacity_inner(element_id, newValue){
			getSong().singleNoteOpacity = newValue;
			clearAll();
		    replay();
		    updateSectionsStatus();
		}

		export function rangeSingleNoteOpacitySlide(element_id, value) {
			setSingleNoteOpacity_inner(element_id, value);
	    }

		//======== TinyNote opacity ==========

		export function getTinyNoteOpacity(){
			return $("#rangeTinyNoteOpacity").val();
		}

		export function setTinyNoteOpacity(newValue){
			$("#rangeTinyNoteOpacity").val(newValue);
			setTinyNoteOpacity_inner(null, newValue);
		}

		export function setTinyNoteOpacity_inner(element_id, newValue){
			getSong().tinyNoteOpacity = newValue;
			clearAll();
			replay();
			updateSectionsStatus();
		}

		export function rangeTinyNoteOpacitySlide(element_id, value) {
			setTinyNoteOpacity_inner(element_id, value);
		}

	//==============  Other functions that set CSS vars but not in Themes (or themeFunctions.js) =====================


	//This is a Closure state machine
	export const cycleThruNutWidths = (() => {
		let gNutSizeState = -1; 
		const arr = ["0", "30px", "60px", "100px", "140px", "220px", "340px", "800px"];
		return function(direction) {
			let newValue = "200px";
			let show = true;
			if (gNutSizeState === -1) {
				gNutSizeState = arr.length - 1;
			}
			gNutSizeState = (gNutSizeState + 1) % arr.length;
			if (gNutSizeState === 0) {
				newValue = "0";
				show = false;
				$('.nut').hide();
			} else {
				newValue = arr[gNutSizeState];
			}
			setOneCssVar("--nut-width", newValue);
			if (show) $('.nut').show();
		};
	})();



	//=============== Misc functions under development  ===========================================

	export function updateFontLabel(){
			$('#lblUIFontSize').html(""+getFontSize()).show();
			$('#lblCellFontSize').html(""+getNoteFontSize()).show();
	}



	export function refreshShowAllNoteNames(){
		let isChecked = $("#cbShowAllNoteNames").prop("checked");
		showAllNoteNames(!isChecked); //hack: do it twice for side-effects.
		showAllNoteNames(isChecked);
	}

	//var gLastWhiteBackgroundColor = null;
	//var gLastBlackBackgroundColor = null;
	export function showAllNoteNames(show){
		if (show){
			var LastBlackBackgroundColor = $('.noteBlackKey').css("background-color");
			var LastWhiteBackgroundColor  = $('.noteWhiteKey').css("background-color");
			var hexbb = convertRGB_to_HEX(LastBlackBackgroundColor);
			var hexww = convertRGB_to_HEX(LastWhiteBackgroundColor);
			var bw = false; //false is cooler. //force choice of Black/White color for all background colors.  mid-tone colors don't work so well.
			var fontblack = invertColor(hexbb, bw);
			var fontwhite = invertColor(hexww, bw);
			$('.noteWhiteKey').css({color: fontwhite});
			$('.noteBlackKey').css({color: fontblack});
		} else {
			//if (gLastBlackBackgroundColor && gLastWhiteBackgroundColor){
			//		$('.noteWhiteKey').css({color: "transparent"});   //gLastWhiteBackgroundColor});
			//		$('.noteBlackKey').css({color: "transparent"});   //gLastBlackBackgroundColor});
			//		console.log("gLastBlackBackgroundColor:"+gLastBlackBackgroundColor);
			//} else {
			$('.noteWhiteKey').css({color: "transparent"}); //this must sync with .noteWhiteKey's default background color so letters disappear.
			$('.noteBlackKey').css({color: "transparent"});  //ditto
			//}
			//alert("else "+$('.noteWhiteKey').css("color"));

		}
	}


	export function automateDisplay(){

	}

	export function displayOptionsToControls(options){

		if (getSong().presentationMode){
			var sizesObj = options.NoteDisplaySizes;
		 	$("#dropDownCellWidth").val(sizesObj.width);
		 	$("#dropDownCellHeight").val(sizesObj.height);	 // e.g. {"width": 120,"height": 60};
			if (sizesObj.NoteFontSize){
				setNoteFontSize(sizesObj.NoteFontSize);
			}
		}

		if (options.showAllNoteNames){
			$("#cbShowAllNoteNames").prop("checked", true);
			$('#btnShowAllNoteNames').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
		} else {
			$("#cbShowAllNoteNames").prop("checked", false);
			$('#btnShowAllNoteNames').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
		}
		showAllNoteNames(options.showAllNoteNames);

		$("#cbShowCellNotes").prop("checked", options.showCellNotes);
		if (options.showCellNotes){
			$("#cbCenterForRightFunction").prop("checked", options.useCenterForRightFunction);  //otherwise unchecked.
		} else {
			$("#cbCenterForRightFunction").prop("checked", false);
		}

		if (options.cellIsFunction){
			$('input[name=rbnFunctionNotename][value=showFunction]').prop('checked', true);
		} else {
			$('input[name=rbnFunctionNotename][value=showNotename]').prop('checked', true);
		}

	    $("#cbShowSubscriptFunctions").prop("checked", options.showSubscriptFunctions);
	    $("#cbMidiNum").prop("checked", options.showMidiNum);


	 	$("#cbNaturalFretWidths").prop("checked", options.naturalFretWidths);

		$("#cbShowAllNoteNames").prop("checked", options.showAllNoteNames);
		$("#cbHideNamedNotes").prop("checked", options.hideNamedNotes);
	    $("#cbHideTinyNotes").prop("checked", options.hideTinyNotes);
	    $("#cbHideSingleNotes").prop("checked", options.hideSingleNotes);
	    $("#cbHideFingering").prop("checked", options.hideFingering);

		$("#lblHideWarning").hide();

		getSong().namedNoteOpacity = options.namedNoteOpacity;
		getSong().singleNoteOpacity = options.singleNoteOpacity;
		getSong().tinyNoteOpacity = options.tinyNoteOpacity;
		$("#rangeNamedNoteOpacity").val(options.namedNoteOpacity);
		$("#rangeSingleNoteOpacity").val(options.singleNoteOpacity);
		$("#rangeTinyNoteOpacity").val(options.tinyNoteOpacity);

		$('#textareaFunctionSymbols').val(options.dropDownFunctionSymbols.value);
		try {
			getSong().noteNamesFuncArr = JSON.parse(options.dropDownFunctionSymbols.value);
		} catch (error) {
			const fallback = Array.isArray(getSong().noteNamesFuncArrDEFAULT)
				? [...getSong().noteNamesFuncArrDEFAULT]
				: JSON.parse($('#dropDownFunctionSymbols').val());
			getSong().noteNamesFuncArr = fallback;
		}


		var currentColorDict = options.currentColorDict;
		if (currentColorDict){
			getSong().currentColorDict = currentColorDict;
			chuseStylesheet(currentColorDict);
		}

		$("#cbAutomaticColor").prop("checked", options.autoColor);
		if (options.autoColor) {
			$('#manualColors').hide();
			$('#btnAutoColor,#btnAutoColor2').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
		} else {
			$('#manualColors').show();
			$('#btnAutoColor,#btnAutoColor2').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
		}

		//ignore #cbPresentationMode because it is Song-scope, not Section-scope.
		$("#selNaturaFontScaling").val(options.naturalFontScaling);
		$("#selNoteFont").val(options.noteFont);
		$("#selLeftSubscriptFontSize").val(options.leftSubscriptFontSize);
		$("#selRightSubscriptFontSize").val(options.rightSubscriptFontSize);
		$("#selMidiFontSize").val(options.midiFontSize);
		$("#selFingeringFontSize").val(options.fingeringFontSize);
		$("#selFingeringPosition").val(options.fingeringPosition);
		$("#selTinyNoteFontSize").val(options.tinyNoteFontSize);
		$("#selTinyNoteMaxHeight").val(options.tinyNoteMaxHeight);

		setOneCssVar("--td-note-font-family", $("#selNoteFont").val());
		setOneCssVar("--left-subscript-font-size", $("#selLeftSubscriptFontSize").val());
		setOneCssVar("--right-subscript-font-size", $("#selRightSubscriptFontSize").val());
		setOneCssVar("--tiny-note-max-height", $("#selTinyNoteMaxHeight").val());
		setOneCssVar("--tiny-note-font-size", $("#selTinyNoteFontSize").val());
		setOneCssVar("--midi-font-size", $("#selMidiFontSize").val());
		setOneCssVar("--fingering-font-size", $("#selFingeringFontSize").val());
		setOneCssVar("--fingering-position", $("#selFingeringPosition").val());

		fullRepaint();
	}

	export function controlsToDisplayOptions(){
		var options = {};
		options.autoColor = $("#cbAutomaticColor").prop("checked");
		options.showCellNotes = $("#cbShowCellNotes").prop("checked");
	    options.showSubscriptFunctions = $("#cbShowSubscriptFunctions").prop("checked");
	    options.cellIsFunction = ($('input[name="rbnFunctionNotename"]:checked').val() == "showFunction");
	    options.showMidiNum = $("#cbMidiNum").prop("checked");
		options.useCenterForRightFunction = $("#cbCenterForRightFunction").prop("checked");
		options.naturalFretWidths = $("#cbNaturalFretWidths").prop("checked");

		options.hideNamedNotes = $("#cbHideNamedNotes").prop("checked");
		options.hideTinyNotes = $("#cbHideTinyNotes").prop("checked");
		options.hideSingleNotes = $("#cbHideSingleNotes").prop("checked");
		options.hideFingering = $("#cbHideFingering").prop("checked");

		options.showAllNoteNames = $("#cbShowAllNoteNames").prop("checked");

		options.namedNoteOpacity = getNamedNoteOpacity();
		options.singleNoteOpacity = getSingleNoteOpacity();
		options.tinyNoteOpacity = getTinyNoteOpacity();

		options.currentColorDict = getSong().currentColorDict;
		options.NoteDisplaySizes =  {
										"caption": parseInt($("#dropDownCellWidth").val()) + 'x' + parseInt($("#dropDownCellHeight").val()) + ':' + getNoteFontSize(),
			                        	"width":$("#dropDownCellWidth").val(),
										"height":$("#dropDownCellHeight").val(),
										"NoteFontSize":getNoteFontSize()
									};
		options.dropDownFunctionSymbols = {
										"caption":	$("#dropDownFunctionSymbols option:selected").text(),
										"value":  $("#dropDownFunctionSymbols").val()
									};
		options.naturalFontScaling = $("#selNaturaFontScaling").val();
		options.noteFont = $("#selNoteFont").val();
		options.leftSubscriptFontSize = $("#selLeftSubscriptFontSize").val();
		options.rightSubscriptFontSize = $("#selRightSubscriptFontSize").val();
		options.midiFontSize = $("#selMidiFontSize").val();
		options.fingeringFontSize = $("#selFingeringFontSize").val();
		options.fingeringPosition = $("#selFingeringPosition").val();
		options.tinyNoteFontSize = $("#selTinyNoteFontSize").val();
		options.tinyNoteMaxHeight = $("#selTinyNoteMaxHeight").val();
		//Ignore #cbPresentationMode because it really is Song-scope and not per Section.
		
		return options;
	}

	export function installBtnHamburgerClicks(){
		$(".showsubcaption").click(function() {
			$(".subcaption").toggle();
		});
		$(".showcolordict").click(function() {
			var $dicts = $(".currentColorDict");
			if (!$dicts.is(":visible")) {
				// If not visible, show them and ensure largeColorDict is removed
				$dicts.removeClass("largeColorDict").toggle();
			} else if (!$dicts.hasClass("largeColorDict")) {
				// If visible and not large, add large
				$dicts.addClass("largeColorDict");
			} else {
				// If visible and large, remove large and hide
				$dicts.removeClass("largeColorDict").hide();
			}
		});
		//This should become an id not a class, when the button just affect one instrument.  For now, it shows all wirings.
		$(".showWiringButton").click(function() {
			$(".divWiring").toggle();
		});

	}

	export function transportResize(){
		//if at top, use this: var left = $('#transportLeftPoint').position().left;
		var tHeight = $('#transport').outerHeight()
		var tWidth = $('#transport').outerWidth()
		var wHeight = $(window).height();
		var wWidth = $(window).width();
		var left = (wWidth / 2) - (tWidth / 2);
		var top = (wHeight-tHeight);

		$('#transport').css({"left": left+"px", "top": top+"px"});
	}

	export function toggleAutoColorCheckbox(){
		var cbac = $("#cbAutomaticColor");
		cbac.prop("checked", !cbac.prop("checked"));
		$("#cbAutomaticColor").trigger("change");
		resetNoteNames();
	}
	export function turnOffAutoColorCheckbox(){
		var cbac = $("#cbAutomaticColor");
		cbac.prop("checked", false);
		$("#cbAutomaticColor").trigger("change");
		resetNoteNames();
	}




	//==================== 4) UI event binding and control wiring =============

	export function bindDesktopEvents(){

		// Event delegation for stylesheet selection and deletion links
		$(document).on('click', 'a.choose-stylesheet', function(e) {
			e.preventDefault();
			const dictkey = $(this).data('dictkey');
			chuseStylesheet(dictkey);
		});

		$(document).on('click', 'a.delete-stylesheet', function(e) {
			e.preventDefault();
			const dictkey = $(this).data('dictkey');
			deleteUserStylesheet(dictkey);
		});

		$(document).on('click', 'span.choose-color-picker', function(e) {
			e.preventDefault();
			const target = $(this).data('target');
			showColorPicker(this, target);
		});

		$(document).on('click', 'span.choose-hatch-picker', function(e) {
			e.preventDefault();
			const target = $(this).data('target');
			showHatchPicker(this, target);
		});

		$(document).on('click', 'td.colorPickerCell', function(e) {
			e.preventDefault();
			colorPickerClicked(this);
		});

		$(document).on('click', 'td.hatchPickerCell', function(e) {
			e.preventDefault();
			hatchPickerClicked(this);
		});

		$(document).on('click', 'button.exportButton', function(e) {
			e.preventDefault();
			const tableId = $(this).data('export-tableid');
			if (tableId) {
				exportFromTable(tableId);
			}
		});

		$(document).on('click', '.graveyard-raise-link', function(e) {
			e.preventDefault();
			const index = toInt($(this).data('grave-index'), -1);
			if (index >= 0) {
				getSong().graveyard.raise(index);
			}
		});

		$(document).on('click', '.graveyard-toggle-json', function(e) {
			e.preventDefault();
			const target = $(this).data('target');
			if (target) {
				$(target).toggle();
			}
		});

		$(document).on('input change', '#rangeNamedNoteOpacity, #rangeSingleNoteOpacity, #rangeTinyNoteOpacity', function() {
			const id = this.id;
			const value = this.value;
			if (id === 'rangeNamedNoteOpacity') {
				rangeNamedNoteSlide(id, value);
			} else if (id === 'rangeSingleNoteOpacity') {
				rangeSingleNoteOpacitySlide(id, value);
			} else if (id === 'rangeTinyNoteOpacity') {
				rangeTinyNoteOpacitySlide(id, value);
			}
		});

		$("#btnPalette").click(function() {
			showOneMenu("#palette");
		});
		$("#btnDesktop").click(function() {
		    showOneMenu("#divDesktop");
		});


		$("#btnHelp").click(function() {

		});

		$("#btnHamburger").click(function() {
		   $("#divControls").toggle();
		   hideAllMenuDivs();
		});


		$("#cbPresentationMode").change(function(){
			getSong().presentationMode = this.checked;
		});



		$("#showHideExtraColors").click(function(event) {
			$("#extraColors").toggle();
			if ($("#extraColors").is(":visible")){
				$("#showHideExtraColors")
					.html("Less...")
					.removeClass("BtnPunchedOut")
					.addClass("BtnPunchedIn");
			} else {
				$("#showHideExtraColors")
				    .html("More...")
					.removeClass("BtnPunchedIn")
					.addClass("BtnPunchedOut");
			}
			event.stopPropagation();
		});

		$("#showHideCustomColorEditors").click(function(event) {
			$("#CustomColorEditors").toggle();
			if ($("#CustomColorEditors").is(":visible")){
				$("#showHideCustomColorEditors").html("Customize Less ...");
			} else {
				$("#showHideCustomColorEditors").html("Customize ...");
			}
			event.stopPropagation();
		});

		$("#showHideCustomColorLinks").click(function() {
			$('#divColorDicts').toggle();
		});

		$('#btnMyTuningsTab').click(function() {
			showTuningsTab('my');
		});
		$('#btnAllTuningsTab').click(function() {
			showTuningsTab('all');
		});
		$('#btnMessagesTab').click(function() {
			showMessagesTab('Messages');
		});
		$('#btnJsonTreeTab').click(function() {
			showMessagesTab('JsonTree');
		});
		$('#btnHideMessagesJsonTree').click(function() {
			hideMessages_KeyHandler();
		});

		$("#btnSectionControls").click(function() {
		    showOneMenu("#divSectionControls");
		});
		$("#btnFileControls").click(function() {
		    showOneMenu("#divFileControls")
		});
		$("#btnTunings").click(function() {
		    reloadAllTuningsDisplay();
			showTuningsTab('my');
		    showOneMenu("#divTunings");
		});
		$("#btnFillNotes").click(function() {
		    showOneMenu("#divFillNotes");
		});
		$("#btnViewControls").click(function() {
		    showOneMenu("#divViewControls");
		});
		$("#btnThemeControls").click(function() {
		    showOneMenu("#divThemeControls");
		});

		// ======== BEGIN "Quick" Menu: ==========
		function linkButtonToCB(btnSelector, cbSelector){
			var btn = $(btnSelector);
			var cb = $(cbSelector);
			var wasChecked = cb.prop('checked');
			if (wasChecked){
				btn.addClass(   "BtnPunchedOut")
				   .removeClass("BtnPunchedIn");
				cb.prop('checked', false);
			} else {
				btn.addClass(   "BtnPunchedIn")
				   .removeClass("BtnPunchedOut");
				cb.prop('checked', true);
			}
		}
		$("#btnShowAllNoteNames").click(function() {
			linkButtonToCB('#btnShowAllNoteNames', '#cbShowAllNoteNames');
			showAllNoteNames($('#cbShowAllNoteNames').prop('checked'));
		});
		$("#btnRandomLoop").click(function() {
			getSong().randomLoop = ! getSong().randomLoop;
			if (getSong().randomLoop){
				$('#btnRandomLoop').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
			} else {
				$('#btnRandomLoop').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
			}
			if (sectionsLooping()){
				restartLoopSections();
			}
		});
		$("#btnNoteV").click(function() {
			checkRB("#rbNotename");
			resetNoteNames();
		});
		$("#btnFuncV").click(function() {
			checkRB("#rbFunction");
			resetNoteNames();
		});
		$("#btnAutoColor,#btnAutoColor2").click(function() {
			toggleAutoColorCheckbox();
		});
		// ========== END "Quick" Menu ==========




		$("#btnToggleTransport").click(function() {
			$('#transport').toggle();
		});
		$("#btnToggleCmdLine").click(function() {
			toggleCmdLine();
		});
		$("#btnToggleQuick").click(function() {
			$('#divQuick').toggle();
		});





		$("#btnClear").click(function() {
		    resetNoteNames();
		    clearAll();
		});
		$("#btnDownload").click(function() {
		    downloadPlayedNotes();
		});
		$("#btnReplay").click(function() {
		    replay();
		});
		$("#btnPrevSection, #btnPrevSection2").click(function() {
		    getSong().gotoPrevSection(false);
		});
		$("#btnNextSection, #btnNextSection2").click(function() {
		    getSong().gotoNextSection(false);
		});
		$("#btnFirstSection").click(function() {
			getSong().firstSection();
			clearAndReplaySection();
		});
		$("#btnLastSection").click(function() {
		    getSong().lastSection();
			clearAndReplaySection();
		});

		$("#btnNewSection").click(function() {
		    var newIndex = $('#dropDownSectionOrder').val();//might include pseudo-value "END".
		    getSong().newSection(newIndex);
		});
		$("#btnDeleteSection").click(function() {
		    getSong().deleteCurrentSection();
		});
		$("#btnAddShallowCloneSection").click(function() {
			var newIndex = $('#dropDownSectionOrder').val();//might include pseudo-value "END".
		    getSong().addShallowCloneSection(newIndex);
		});
		$("#btnAddDeepCloneSection").click(function() {
		    var newIndex = $('#dropDownSectionOrder').val();//might include pseudo-value "END".
		    getSong().addDeepCloneSection(newIndex);
		});
		$('#btnMoveSectionOrder').click(function(){
			var newIndex = $('#dropDownSectionOrder').val();
			if (newIndex == "END"){
				getSong().moveSectionToEND();
			} else {
				getSong().moveSectionTo(newIndex);
			}
			updateSectionsStatus();
			fullRepaint();
		});
		$("#btnLoopSections").click(function() {
		    toggleLoopSections();
		});
		$("#btnLoopBeats").click(function() {
		    toggleLoopBeats();
		});
		$("#btnLoopBeatsTransport").click(function() {
		    toggleLoopBeats();
		});

		$("#cbShowAllNoteNames").click(function() {
			var show = $("#cbShowAllNoteNames").prop("checked");
			if (show){
				$('#btnShowAllNoteNames')
				   .addClass(   "BtnPunchedIn")
				   .removeClass("BtnPunchedOut");
			} else {
				$('#btnShowAllNoteNames')
				   .addClass(   "BtnPunchedOut")
				   .removeClass("BtnPunchedIn");
			}
			showAllNoteNames(show);
		});

		$(".RecordButton").click(function() {
			var btn = $("#btnRecord");
			var recording = btn.attr("recording");
			if (recording === undefined) {
				$(".RecordButton").addClass("ButtonOn");    //.css({"background-color": "red"});
			    $("#btnRecord").attr("recording", "true");
				clearRecordedNotes();
		        showBeats(getSong().getBeat());
			} else if (recording === "false"){
				$(".RecordButton").addClass("ButtonOn");    //.css({"background-color": "red"});
			    $("#btnRecord").attr("recording", "true");
				clearRecordedNotes();
		        showBeats(getSong().getBeat());
			} else if (recording === "true") {
				$(".RecordButton").removeClass("ButtonOn");  //.css({"background-color": "green"});
				   	$("#btnRecord").attr("recording", "false");
			} else {
				$(".RecordButton").removeClass("ButtonOn"); //css({"background-color": "green"});
				   	$("#btnRecord").attr("recording", "false");
			}
		});

		$("#txtBeatsPer" ).on( "change", function() {
		 getCurrentSection().beats = $( this ).val();
		});

		$("#btnPrevBeat").click(function() {
		    getSong().prevBeat();
		    showHighlightsForBeat(getSong().getBeat());
		});
		$("#btnNextBeat").click(function() {
		    getSong().nextBeat();
		});
		$("#btnPrevBeatTransport").click(function() {
		    getSong().prevBeat();
		});
		$("#btnNextBeatTransport").click(function() {
		  	getSong().nextBeat();
		});

		$("#btnInsertFirstBeat").click(function() {
		    getSong().moveBeatsLater();
		});
		$("#btnAddBeat").click(function() {
		    addBeat();
		});
		$("#btnDeleteBeat").click(function() {
			getSong().deleteBeat();
		});

		$("#txtCaption" ).on( "change", function() {
		 var cap = $( this ).val();
		 getCurrentSection().caption = cap;
		 $(".lblSectionCaption").html(cap);

		});
		$("#txtFilename" ).on( "change", function() {
		 $(".lblSongName").html($( this ).val());
		});

		$("#txtBPM" ).on( "change", function() {
		 setBPM($(this).val());  //interestingly, this does NOT cause jQuery to call ".change()" again.
		});

		$("#btnSharps").click(function() {
	        setSectionKeysSharps();
	    });
	    $("#btnFlats").click(function() {
	       setSectionKeysFlats();
	    });

		$("#btnTransposeDown").click(function() {
			 transpose(-1);
	    });
	    $("#btnTransposeUp").click(function() {
			 transpose(1);
	    });
		$("#btnTransposeJumpDown").click(function() {
			 transpose(-5);
	    });
	    $("#btnTransposeJumpUp").click(function() {
			 transpose(5);
	    });

		// CODE-EXAMPLE("SelectWidget", "Root")
	    $('#dropDownRoot').change(function() {
	        getCurrentSection().rootID = $(this).val();
	        fullRepaint();
	        updateSectionsStatus();
	    });
		// END CODE-EXAMPLE("SelectWidget", "Root")
		$('#dropDownRootLead').change(function() {
            getCurrentSection().rootIDLead = $('#dropDownRootLead').val();
            fullRepaint();
	        updateSectionsStatus();
	    });

		$("#btnRowRangeReset").click(function() {
			//$('#textareaRowRange').val(JSON.stringify(noteNamesRowRangeArr));
			fullRepaint();
		});

		$('#dropDownBaseInstrument').change(function() {
			var baseInstrumentID = $(this).val();
			fullRepaint();
			updateSectionsStatus();
		});

		$('#dropDownCellHeight').change(function() {
			fullRepaint();
	    });
		$('#dropDownCellWidth').change(function() {
			fullRepaint();
		});
		$("#cbNaturalFretWidths,#selNaturaFontScaling").change(function(){
			fullRepaint();
		});
		$("#selNoteFont").change(function(){
			setOneCssVar("--td-note-font-family", $("#selNoteFont").val());
			fullRepaint();
		});
		$("#selLeftSubscriptFontSize").change(function(){
			setOneCssVar("--left-subscript-font-size", $("#selLeftSubscriptFontSize").val());
			fullRepaint();
		});
		$("#selRightSubscriptFontSize").change(function(){
			setOneCssVar("--right-subscript-font-size", $("#selRightSubscriptFontSize").val());
			fullRepaint();
		});
		$("#selTinyNoteMaxHeight").change(function(){
			setOneCssVar("--tiny-note-max-height", $("#selTinyNoteMaxHeight").val());
			fullRepaint();
		});
		$("#selTinyNoteFontSize").change(function(){
			setOneCssVar("--tiny-note-font-size", $("#selTinyNoteFontSize").val());
			fullRepaint();
		});


		$("#selMidiFontSize").change(function(){
			setOneCssVar("--midi-font-size", $("#selMidiFontSize").val());
			fullRepaint();
		});
		$("#selFingeringFontSize").change(function(){
			setOneCssVar("--fingering-font-size", $("#selFingeringFontSize").val());
			fullRepaint();
		});
		$("#selFingeringPosition").change(function(){
			setOneCssVar("--fingering-position", $("#selFingeringPosition").val());
			fullRepaint();
		});
		$('#dropDownInstrumentMargins').change(function() {
			//short-circuit and set it now, it is in mem for next time.
			var margin = this.value;
			$('.instrumentBackground').css({"margin-top": margin, "margin-bottom": +margin });
		});

	    $('#selBend').click(function() {
	        $("#rbBend").prop("checked", true);
	    });

		$("#rbFinger0").click(function(){
            checkRB("#idRFinger0");
        });
		$("#rbFinger1").click(function(){
			checkRB("#idRFinger1");
		});
		$("#rbFinger2").click(function(){
			checkRB("#idRFinger2");
		});
		$("#rbFinger3").click(function(){
			checkRB("#idRFinger3");
		});
		$("#rbFinger4").click(function(){
			checkRB("#idRFinger4");
		});
		$("#rbFingerT").click(function(){
			checkRB("#idRFingerT");
		});

		$("#cbAutomaticColor").change(function() {
			if (this.checked) {
				//console.log("cbAutomaticColor was checked--hiding");
				$('#manualColors').hide();
				$('#btnAutoColor,#btnAutoColor2').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
			} else {
				//console.log("cbAutomaticColor was not checked--showing");
				$('#manualColors').show();
				$('#btnAutoColor,#btnAutoColor2').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
			}
			fullRepaint();
		});

		$('#cbHideNamedNotes, #cbHideSingleNotes, #cbHideTinyNotes, #cbHideFingering').change(function() {
				var hnchecked = $('#cbHideNamedNotes').prop("checked");
				var hschecked = $('#cbHideSingleNotes').prop("checked");
				var htchecked = $('#cbHideTinyNotes').prop("checked");
				var hfchecked = $('#cbHideFingering').prop("checked");

				if (htchecked || hschecked || hfchecked || hnchecked){
					turnOnKeep();
					$("#lblHideWarning").show();
				} else {
					$("#lblHideWarning").hide();
				}
				clearAll();
				replay();
	    });

		$('#cbShowCellNotes').change(function() {

			if ( ! this.checked ) {
				$("#cbCenterForRightFunction").prop("checked", false);
			}
			resetNoteNames();
	    });
		$('#cbCenterForRightFunction').change(function() {

			if ( this.checked ) {
				$("#cbShowCellNotes").prop("checked", true);
			}
			resetNoteNames();
	    });
	    $('input[type=radio][name=rbnFunctionNotename]').change(function() {
	        resetNoteNames();
	    });

	    $('#cbShowSubscriptFunctions').change(function() {
	        resetNoteNames();
	    });
	    $('#cbMidiNum').change(function() {
	        resetNoteNames();
	    });
		$("#textareaFunctionSymbols" ).on( "change", function() {
			var txtVal = $('#textareaFunctionSymbols').val();
		    try {
				//Since we are allowing the user to put something in, validate before accepting.
				getSong().noteNamesFuncArr = JSON.parse(txtVal);
				if (!getSong().noteNamesFuncArr.length){
					throw new TypeError("NoteFunction array is empty -- check commas and quotes.");
				}
				if (!getSong().noteNamesFuncArr[0]){
					throw new TypeError("First NoteFunction is empty");
				}
				if (!getSong().noteNamesFuncArr[11]){
					throw new TypeError("Last NoteFunction is empty");
				}
			} catch (error){
				const fallback = Array.isArray(getSong().noteNamesFuncArrDEFAULT)
					? [...getSong().noteNamesFuncArrDEFAULT]
					: JSON.parse($('#dropDownFunctionSymbols').val());
				getSong().noteNamesFuncArr = fallback;
				alert("Error setting NoteFunction names: "+error);
			}
			fullRepaint();
		});
		// CODE-EXAMPLE("TextAreaWButtonWidget", "FunctionSymbols")
		$("#btnFunctionSymbolsReset").click(function() {
			const fallback = Array.isArray(getSong().noteNamesFuncArrDEFAULT)
				? [...getSong().noteNamesFuncArrDEFAULT]
				: JSON.parse($('#dropDownFunctionSymbols').val());
			getSong().noteNamesFuncArr = fallback;
			$('#textareaFunctionSymbols').val(JSON.stringify(getSong().noteNamesFuncArr));
			fullRepaint();
		});
		// END-CODE-EXAMPLE("TextAreaWButtonWidget") 
		$('#dropDownFunctionSymbols').change(function() {
            var value = $('#dropDownFunctionSymbols').val();
			getSong().noteNamesFuncArr = JSON.parse(value);  //this one is safe--comes from our built SELECT.
			$('#textareaFunctionSymbols').val(JSON.stringify(getSong().noteNamesFuncArr));
            fullRepaint();
	    });



		$("#btnFillChord").click(function() {
	        fillChord();
	    });

		$("#btnControlsToDisplayOptions, #btnControlsToDisplayOptions2").click(function() {
	        var options = controlsToDisplayOptions();
			getCurrentSection().displayOptions = options;
			INFO("controlsToDisplayOptions: <br>"+JSON.stringify(options, null, 2));
			showHideDisplayOptionsPresent();
	    });
		$("#btnDeleteDisplayOptions, #btnDeleteDisplayOptions2").click(function() {
			delete getCurrentSection().displayOptions;
			showHideDisplayOptionsPresent();
	    });

		$("#btnRecordUserColors").click(function() {
			recordUserColors();
		});
		$("#btnRecordUserColorsFromSection").click(function() {
			recordUserColorsFromSection();
		});
	}

	export function bindThemeEvents(){
		//======= themes  =======
		$('#btnTheme').click(function() {
			var newTheme = controlsToTheme();
			theme(newTheme);
			getSong().userTheme = newTheme;
			getThemes()["USER"] = newTheme;
		});
		$('#btnToggleThemeTableResults').click(function() {
			$('#themeTableResults').toggle();
		});
		$('#selThemes').change(function() {
			var id = this.id;
			var val =  this.value;
			var selectedTheme = getThemes()[val];
			theme(selectedTheme);
			themeToControls(getDefaultTheme());  //Not all themes have all values, so reset all the dropdowns with theme "Default" first.
			themeToControls(selectedTheme);
			clearThemeDiffResults();
			refreshShowAllNoteNames();
		});
		$('#warny').click(function(){
			$(this).hide();
		});
		$('#btnShowWarny').click(function(){
			$('#warny').show();
		});
	}

	export function bindDataActionHandlers(){
		const dataActionHandlers = {
			help: () => window.open(getHelpTopic(), 'infinitehelp'),
			songLibrary,
			showGraveyard,
			increaseUIFont,
			decreaseUIFont,
			increaseNoteFont,
			decreaseNoteFont,
			ChromeFullscreen,
			enterFullscreen,
			leaveFullscreen,
			toggleCaption,
			toggleInstrumentCaptionRow,
			hideAllMenuDivs,
			saveScalingPrefs,
			applyScalingPrefs,
			clearScalingPrefs,
				loadSong,
				linkToSection,
				hideGraveyard
		};

		$(document).on('click', '[data-action]', function(e) {
			e.preventDefault();
			const action = $(this).data('action');
			const arg = $(this).data('action-arg');
			const handler = dataActionHandlers[action];
			if (typeof handler === 'function') {
				if (arg !== undefined) {
					handler(arg);
				} else {
					handler();
				}
			} else {
				console.warn('No data-action handler registered for:', action);
			}
		});

	}

	//==================== document.ready helper functions =====================

	export function ChromeFullscreen() {
	  document.documentElement.webkitRequestFullScreen();
	}

	const SCALING_PREFS = "ScalingPrefs";

	export function saveScalingPrefs(){
		var scalingPrefs = {
			UIFontSize:   getUIFontSize(),
			NoteFontSize: getNoteFontSize(),
			CellWidth:    $("#dropDownCellWidth").val(),
			CellHeight:  $("#dropDownCellHeight").val()
		};
		localStorage.setItem(SCALING_PREFS, JSON.stringify(scalingPrefs));
		$("#divScalingPrefs").html(JSON.stringify(scalingPrefs));
	}

	export function applyScalingPrefs(noSnark){
		var scalingPrefsStr = localStorage.getItem(SCALING_PREFS);
		if (scalingPrefsStr){
			var scalingPrefs = JSON.parse(scalingPrefsStr);
			if (scalingPrefs.UIFontSize){
				setUIFontSize(scalingPrefs.UIFontSize);
				setNoteFontSize(scalingPrefs.NoteFontSize);
				$("#dropDownCellWidth").val(scalingPrefs.CellWidth).change();
				$("#dropDownCellHeight").val(scalingPrefs.CellHeight).change();
				$("#divScalingPrefs").html(JSON.stringify(scalingPrefs));
			}
		} else {
			if (!noSnark){
				$("#divScalingPrefs").html("No ScalingPrefs in browser storage: click [Save Scaling Prefs] first.");
			}
		}
	}

	export function clearScalingPrefs(){
		localStorage.removeItem(SCALING_PREFS);
		$("#divScalingPrefs").html("ScalingPrefs: "+JSON.stringify(localStorage.getItem(SCALING_PREFS)));
	}

	/** After calling this, choose a theme either by default or by looking in song you just opened for USER theme. */
	export function rebuildThemesDropdown(){
		$('#SelectThemesDest').html(getWidget_SelectThemes());  //must come before bindThemeEvents()
		bindThemeEvents();
		auditThemes();//sends WARN messages, so hide after.
		$('#warny').hide();
		$('#themeTableResults').hide();
	}

	//==================== 5) App init and EventBus integration ===============

	// Headless replacement for document.ready for testing
	export function setupSongTests() {
		gSong = new Song();   //var song global in this file (at top).

		installModuleProviders();
		
		getSong().graveyard = makeGraveyard();
		installDefaultColorDicts();
		applyStylesheetsTo_gUserColorDict();
		TuningsLibrary.ensureDefaultMyTuning('S6');

		//TODO: in each test be sure to set this somehow: getSong().songName = currentFilename;
	}

	// appInit() called by document.ready
	// File-level appInit for browser startup
	export function appInit() {
		window.onerror = function (message, url, lineNo, colno, error){
			let logString = 'window.onerror: ' + message
				+ '\r\n URL:'+url
				+'\r\n Line Number: ' + lineNo
				+'\r\n Col Number: '+colno
				+'\r\n Stack: '+error.stack
			;
			console.warn(logString);
			alert(logString);
			return true;
		}

		fetchVersionInBrowser();

		


		//gSong = makeSong();  //var song global in this file (at top).
		gSong = new Song();
		
		getSong().graveyard = makeGraveyard();

		installDefaultColorDicts();
		applyStylesheetsTo_gUserColorDict();
		buildColorDicts();
		$('#divColorDicts').hide();
		$("#CustomColorEditors").hide();

		TuningsLibrary.ensureDefaultMyTuning(getStartupTuningBaseID('S6'));
		installAllTuningsTables();
		installBtnHamburgerClicks();
		setupOpenFile();
		sectionChanged();
		installTDNoteClick();
		bindDesktopEvents();
		applyScalingPrefs(true);

		rebuildThemesDropdown();
		$('#selThemes').val("Autobahn").change();
		//will get picked up in open file, but here is the default theme,
		//    which isn't "Default", although it should be.
		//$('#selThemes').val("PoolShark").change();

		$('#textareaFunctionSymbols').val(JSON.stringify(getSong().noteNamesFuncArr));

		var currentFilename = $("#txtFilename").val();
		$(".lblSongName").html(currentFilename);
		getSong().songName = currentFilename;
		$('.topControlsCaptions').show();

		$('#cbHighlight').prop('checked', false);
		//NOTE: "checked" is done in buildUserColors, so you don't need to check any rb colors here.

		$("#palette").show();
		$('#cbAutomaticColor').prop('checked', true);
		$("#cbAutomaticColor").trigger('change');//will change from checked to not checked and run click().

		$("#dropDownRootColors").val("noteKeep");
	    $("#dropDownChordsColors").val("noteKeep");
	    $("#dropDownScalesColors").val("noteKeep");
      	$("#lblHideWarning").hide();

		showHideDisplayOptionsPresent();  //enables and disables btnDeleteDisplayOptions etc.
 		hideAllMenuDivs();
		$("#divQuick").hide();
		$("#tabledestTopPad").hide();
		$("#CmdMenu").hide();

		updateFontLabel();

		buildUserColors();
		installRBColorChangeEvents();

		reloadAllTuningsDisplay();
		TuningsLibrary.showDefaultTuning();//calls showHideTunings and shows S6 if none found.
		TuningsLibrary.bindFormTuningsEvents();
		bindDataActionHandlers();

		loadTemplates().then(() => {
    		getSong().getVisibleTuningIDs().forEach(tuningID => {
				WiringBuilder.addWiringWidget(tuningID, Constants.TABLE_ID_PREFIX+tuningID);
			});
		});


		$("#btnFlats").click();  //calls resetNoteNames();

		$(document).on('keypress', document_keypress);
		$("#txtCmdLine").on('keypress', txtCmdLine_keypress);
		$(document).on('keyup', document_keyup);

		$( window ).on( "resize", function() {
			transportResize();
		} );
		transportResize();
        draggable(document.getElementById('transport'));
		showTransport();

		scrollToTop();
	}
	// End of appInit() with document ready call

	//========================================================================= 
	//  $(document).ready(appInit)                                      =======
	//      will now be called from index.html                          =======
	//      after all other script tags.                                =======
	//=========================================================================

	function loadTemplates(url = 'templates/templates.html') {
		return fetch(url)
			.then(response => response.text())
				.then(html => {
					const temp = document.createElement('div');
					temp.innerHTML = html;
					// Move all <template> elements to the main document
					temp.querySelectorAll('template').forEach(tpl => {
						document.body.appendChild(tpl);
				});
			});
	}


	

	//==================== New handling of the EventBus =======================
	//Uncaught SyntaxError: Unexpected token 'export' (at event-bus.js:18:1)

import EventBus from './event-bus.js';

EventBus.on('UpdateSectionStatus', function(data) {
  updateSectionsStatus();
});
EventBus.on('SectionChanged', function(data) {
  sectionChanged();
});
EventBus.on('SectionMoved', function(data) {
  updateSectionsStatus();
  fullRepaint();
});
EventBus.on('SongUiClearAll', function() {
	clearAll();
});
EventBus.on('SongUiReplay', function() {
	replay();
});
EventBus.on('SongUiFullRepaint', function() {
	fullRepaint();
});
EventBus.on('SongUiClearHighlights', function() {
	clearHighlights();
});
EventBus.on('SongUiResetNoteNames', function() {
	resetNoteNames();
});
EventBus.on('SongUiShowBeats', function() {
	showBeats();
});
EventBus.on('SongUiClearAndReplaySection', function() {
	clearAndReplaySection();
});
EventBus.on('ShowMessages', function(data) {
	showMessages(data && data.html ? data.html : '');
});
EventBus.on('ReinstallAllTuningsTables', function() {
	reinstallAllTuningsTables();
});
EventBus.on('ReloadAllTuningsDisplay', function() {
	reloadAllTuningsDisplay();
});
EventBus.on('UpdateAllWiringSelects', function() {
	getSong().getVisibleTuningIDs().forEach(tuningID => {
		WiringBuilder.addWiringWidget(tuningID, Constants.TABLE_ID_PREFIX+tuningID);
	});
	updateAllWiringSelects();
});


