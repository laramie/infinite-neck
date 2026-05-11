/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */


import * as Constants from './Constants.js';
import EventBus from './event-bus.js';
import {
	chuseStylesheet,
	deleteUserStylesheet,
	showColorPicker,
	showHatchPicker,
	colorPickerClicked,
	hatchPickerClicked,
	applyStylesheetsTo_gUserColorDict,
	buildColorDicts,
	buildUserColors,
	setColorFunctionsProviders
} from './colorFunctions.js';
import {
	addCmdResults,
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
	gPresentation, 
	PalettePresentation 
} from './presentation.js';
import {
	getFontSize,
	getUIFontSize,
	hideGraveyard,
	getNoteFontSize,
	setUIFontSize,
	setNoteFontSize,
	setKeyHandlerProviders,
	showMessages,
	hideMessages,
	document_keypress,
	document_keyup
} from './key-handlers.js';
import {
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
} from './Note.js'; 
import {
	Song
} from './Song.js';
import {
	clearRecordedNotes,
	setSectionRecorderProviders
} from './section-recorder.js';
import './svgLines.js';
import {
	getDefaultTheme,
	getThemes,
	THEME_INFO,
	setOneCssVar
} from './themeFunctions.js';
import * as SectionPrinter from './section-printer.js';
import * as TableBuilder from './TableBuilder.js';
import * as TuningsLibrary from './TuningsLibrary.js';
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
import { installFillPageSelects } from './fillPageSelectBuilder.js';

import { installLoopTimingModeControls } from './looper-timing-select-handler.js';

import * as WiringBuilder from './templates/WiringBuilder.js';
import { ThemesBuilder }  from './templates/themes.builder.js';
import { PaletteBuilder } from './templates/palette.builder.js';
import { SectionDrawerBuilder } from './templates/section-drawer.builder.js';
import { TransportBuilder } from './templates/transport.builder.js';
import { SectionStatusBuilder } from './templates/SectionStatus/section-status.builder.js';

import './plugins/registerPlugins.js';
import pluginManager from './plugins/pluginRuntime.js';

// If running in a browser, call appInit() on DOM ready.  Browser loads DOM, then since index.html pulls in this module, this module is run after DOM loaded.  
// This top-level code runs first, which calls appInit().
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
	
	var gAppInit_running = false; //set in appInit() and cleared when done and Promises from loadTemplate() have returned..
	export function appInit_running(){
		return gAppInit_running;
	}

	var gSong = null;  //constructed in document ready.
	export function getSong(){
		return gSong;
	}

	let WIRING_OPEN = false;
	export function restoreWiringOpenState(){
		setWiringOpenState(WIRING_OPEN);
	}
	export function setWiringOpenState(open) {
		WIRING_OPEN = !!open;
		if (WIRING_OPEN) {
			$(".divWiring").show();
			$(".showWiringButton").addClass("ShowWiringButtonOpen");
		} else {
			$(".divWiring").hide();
			$(".showWiringButton").removeClass("ShowWiringButtonOpen");
		}
	}
	export function toggleWiringOpenState() {
		setWiringOpenState(!WIRING_OPEN);
	}

	function installModuleProviders(){
		setDisplayOptionsProviders({
			getSong,
			controlsToDisplayOptions
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
			getPersistentSongFile,
			getSectionsCurrentIndex,
			getSong,
			hideAllMenuDivs,
			highlightOneNote,
			leaveFullscreen,
			printSections,
			printSectionsNotes,
			resetNoteNames,
			sectionChanged,
			setBPM,
			setNamedNoteOpacity,
			setSingleNoteOpacity,
			setTinyNoteOpacity,
			showOneMenu,
			toggleCaption,
			toggleFullscreen,
			toggleInstrumentCaptionRow,
			transpose,
			transposeSong,
			transposeSongKeys,
			updateFontLabel,
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
		$('#btnDeleteDisplayOptions_View').prop("disabled", !options);
		SectionDrawerBuilder.setDisplayOptionsPresent(!!options);
	}

	export function sectionChanged(){
		var options = getCurrentSection().displayOptions;
		if (options){
			displayOptionsToControls(options);
		}
		showHideDisplayOptionsPresent();
		clearAndReplaySection()
	    updateSectionsStatus();
		SectionDrawerBuilder.sectionChanged();
	}

	export function updateSectionsStatus(){
		if (getSong().isHeadless){
            return;
        }
		//These should be in #topControlsCaptions in index.html
	    $(".lblSectionsStatusSectionNo").html(""+(getSong().getSectionsCurrentIndex()+1));
	    var rawCaption = getSong().getCurrentSection().caption;
		var caption = eval("\`"+rawCaption+"\`");
	    $(".lblSectionCaption").html(caption);

	    $(".lblSectionChartChord").html( getSong().getCurrentSection().chartChord);
	    $(".lblSectionMode").html( getSong().getCurrentSection().chartMode);

		var currentFilename = $("#txtFilename").val();
	    $(".lblSongName").html(currentFilename);
		//getSong().songName = currentFilename;

		var rootIndex = toInt(getSong().getCurrentSection().rootID, 0);
	    var rootIndexLead = toInt(getSong().getCurrentSection().rootIDLead, 0);
		var keyname = getSong().noteIDToNoteName(rootIndex);
		var keynameLead = getSong().noteIDToNoteName(rootIndexLead);

		
		//This is in Instrument Caption row:
		var spans = $(".spanLeadDifferentFromRoot");
	    
		//These are in Transport:
	    $("#lblBeats").html(getSong().getBeats());
		$("#lblBeat").html("1");
		
		var txt = ""+(getSong().getSectionsCurrentIndex()+1)+"/"+ getSong().sections.length;
	    $("#lblSectionsStatus2").html(txt);
		
		// .lblRootID and .lblRootIDLead have controls in 
		//     Fill, Transport, and Song Caption:
	    $(".lblRootID").html(keyname);
		if (getSong().getCurrentSection().rootIDLead != "-1"){
	        spans.html(keynameLead);
	        spans.show();
	        $(".lblRootIDLead").html(keynameLead).addClass("lblRootIDLead_active");
	    } else {
          spans.hide();
          $(".lblRootIDLead").html("&nbsp;").removeClass("lblRootIDLead_active");
	    }

		showHideDisplayOptionsPresent();  //also calls SectionDrawerBuilder API.
		updatePrintSections();
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

	/*******  Call Graph *******************
	 
	 NoteTableController.fullRepaint
		resetNoteNames

	 infinite-neck.setSectionKeysFlats
	 	resetNoteNames
	 
	 clearAndReplaySection
		resetNoteNames //also called by every GUI control...
			options {rootID, rootIDLead, cellIsFunction
			resetSharps(options)
				buildCells
					theVisibleNoteTables.forEach(tableID => {
						NoteTableController.buildCellsForTable(sharps, options, `#${tableID}`)
				resetSharpsControls
			resetFlats(options)
				buildCells
					theVisibleNoteTables.forEach(tableID => {
						NoteTableController.buildCellsForTable(sharps, options, `#${tableID}`)
				resetFlatsControls
			replay()	
	**************************************/

	export function resetNoteNames() {
	    let options = {};
	    let rootID = getCurrentSection().rootID;
		let rootIDLead = getCurrentSection().rootIDLead;
	    getSong().sharps = getCurrentSection().sharps;
	    if (rootID!=null && ((""+rootID).length>0)) {
	        options.rootID = rootID;
			options.rootIDLead = rootIDLead;
	    } else {
			alert('rootID not in current section');
			debugger
	        var optVal = $('#dropDownRoot').val();
			rootIDLead = $("#dropDownRootLead").val();
	        options.rootID = parseInt(optVal);
			options.rootIDLead = toInt(rootIDLead, -2);
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
		options.naturalFontScaling = toInt($('#selNaturalFontScaling').val(), 60);

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
		let theVisibleNoteTables = updateVisibleTablesInMemoryModel();
		theVisibleNoteTables.forEach(tableID => {
		    buildCellsForTable(sharps, options, tableID);
		});
	}
	export function buildCellsForTable(sharps, options, tableID=""){
		let tableID_prefix = "";
		if (tableID){
			tableID_prefix = '#'+tableID + ' ';
		}
		if (sharps) {
			buildCellsFromSelector(tableID_prefix+"td.noteAb", "G", SHARP, 11, options);
			buildCellsFromSelector(tableID_prefix+"td.noteBb", "A", SHARP, 1, options);
			buildCellsFromSelector(tableID_prefix+"td.noteDb", "C", SHARP, 4, options);
			buildCellsFromSelector(tableID_prefix+"td.noteEb", "D", SHARP, 6, options);
			buildCellsFromSelector(tableID_prefix+"td.noteGb", "F", SHARP, 9, options);
		} else {
			buildCellsFromSelector(tableID_prefix+"td.noteAb","A", FLAT, 11, options);
			buildCellsFromSelector(tableID_prefix+"td.noteBb","B", FLAT, 1, options);
			buildCellsFromSelector(tableID_prefix+"td.noteDb","D", FLAT, 4, options);
			buildCellsFromSelector(tableID_prefix+"td.noteEb","E", FLAT, 6, options);
			buildCellsFromSelector(tableID_prefix+"td.noteGb","G", FLAT, 9, options);
		}
		buildCellsFromSelector(tableID_prefix+"td.noteA","A", NATURAL, 0, options);
		buildCellsFromSelector(tableID_prefix+"td.noteB","B", NATURAL, 2, options);
		buildCellsFromSelector(tableID_prefix+"td.noteC","C", NATURAL, 3, options);
		buildCellsFromSelector(tableID_prefix+"td.noteD","D", NATURAL, 5, options);
		buildCellsFromSelector(tableID_prefix+"td.noteE","E", NATURAL, 7, options);
		buildCellsFromSelector(tableID_prefix+"td.noteF","F", NATURAL, 8, options);
		buildCellsFromSelector(tableID_prefix+"td.noteG","G", NATURAL, 10, options);
	}

	// List of menu divs, accessed through .entries(), and associated button names,
	//  accessed through selectors stored in values with menu as key: AllMenuDivs[strMenuDiv]
	const AllMenuDivs = {
		"#palette": "#btnPalette",
		"#divFileControls": "#btnFileControls",
		"#divViewControls": "#btnViewControls",
		"#divThemeControls": "#btnThemeControls",
		"#divFillNotes": "#btnFillNotes",
		"#divTunings": "#btnTunings",
		"#divDesktop": "#btnDesktop",
		"#divChart": "#btnChart",
		"#spanSectionDrawer": "#btnEditSection"
	}

	export function hideAllMenuDivs(){
		for (const key of Object.keys(AllMenuDivs)){
			if (key === "#spanSectionDrawer"){
				TransportBuilder.hideSectionDrawer();
			} else {
				$(key).hide();
			}
		}
		$('.MainMenuTabBtn').removeClass("BtnPunchedIn").addClass("BtnPunchedOut");
		//$("#topControlsCaptions").show();
	}

	export function isMenuShowing(strMenuDiv){
		var jStrMenuDiv = $(strMenuDiv);
		return jStrMenuDiv.is(":visible");
	}

	export function showOneMenu(strMenuDiv, forceOpen = false) {
		var wasFull = leaveFullscreen();
		var jStrMenuDiv = $(strMenuDiv);
		if (wasFull) {
			hideAllMenuDivs();
			jStrMenuDiv.show();
		} else if (forceOpen) {
			hideAllMenuDivs();
			jStrMenuDiv.show();
			$(AllMenuDivs[strMenuDiv]).addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
		} else {
			if (jStrMenuDiv.is(":visible")) {
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

	export function turnOnKeep(){
		PalettePresentation.selectRbColorById("#idKeep", {
			remember: false,
			forcedKeep: true
		});
	}
	
	export function turnOffKeep(){
		if (!gPresentation.palette.keepWasForced) {
			return;
		}
		gPresentation.palette.keepWasForced = false;
		PalettePresentation.restoreLastRbColor();
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
		return getSong().getBeat();
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
	
		turnOffKeep();
	
		if (hideNamedNotes || hideTinyNotes || hideSingleNotes || hideFingering){
			clearAll();
			replay();
		}
	}

	function updateVisibleTablesInMemoryModel(){
	    const visibleTableIds = TuningsLibrary.getMyTunings()
	        .filter(t => $(`#${Constants.TABLEDIV_ID_PREFIX}${t.baseID}`).is(':visible'))
	        .map(t => Constants.TABLE_ID_PREFIX + t.baseID);
	    getSong().markVisibleTablesForFileSave(visibleTableIds);
	    return visibleTableIds;
	}

	export function updateMemoryModelPreFileSave(){
	    const visibleTableIds = updateVisibleTablesInMemoryModel();
	    var bpm = parseInt($("#txtBPM").val());
	    if (Number.isNaN(bpm) || bpm == 0) { bpm = DEFAULT_BPM; }
	    getSong().prepareForSave({
	        visibleTableIds,
	        songName: $("#txtFilename").val(),
	        theme: $('#selThemes').val(),
	        bpm,
	        userColors: gUserColorDict.dict,
	        userInstrumentTuning: TuningsLibrary.findTuningForID("USER"),  //Persistence only. allTunings.tunings with id="USER" is the live object used at runtime.
	        plugins: pluginManager.exportSongPluginState()
	    });
	}

	export function downloadBackupThenClearGraveyard(){
		downloadPlayedNotes();
		getSong().graveyard.clear();
		showMessages(getSong().graveyard.buildGraveyardTable());
	}

	//==================== 3) File open/save and persistence ==================

	export function getPersistentSongFile(){
		updateMemoryModelPreFileSave(); //last-minute sync of stuff that should have been done before like 
		                                // song name, bpm, myTunings, Theme, userColors, USERTuning, visibleTableIDs
	    var text = getSong().getPersistentSongFile();
		return text;
	}

    // file save / save file / saveFile event
	export function downloadPlayedNotes(){
		var text = getPersistentSongFile();
	    var a = document.createElement('a'); // Attach href attribute with value of your file.
	    var fname = "";
	    fname = $("#txtFilename").val().trim();
	    if (fname==""){
	        fname = "untitled";
	    }

		const blob = new Blob([text], {type: "application/json"});
		const url = URL.createObjectURL(blob);
		a.setAttribute("href", url);
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
					var str = JSON.stringify(reader.result, null, 2);
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
		var jsonObj = JSON.parse(str);
		gSong = new Song(jsonObj);
		gSong.ensureDefaultSection();
		pluginManager.loadSongPluginState(gSong);
		updateAfterOpenSong();
	}

	export function updateAfterOpenSong(){
		getSong().fixupCurrentIndexForLoadedSong();
		hideGraveyard();
		installDefaultColorDicts();
		
		let songTheme = getSong().theme;  //some songs, e.g. snake.json, don't have theme stored.
		if (!songTheme){
			songTheme = getDefaultTheme().id;
		}
		$('#selThemes').val(songTheme).trigger('change');

		$("#txtFilename").val(getSong().songName).trigger('change');
		$("#cbPresentationMode").prop("checked", !!getSong().presentationMode).trigger('change');

		setBPM(getSong().defaultBPM);

		applyStylesheetsTo_gUserColorDict();
		buildColorDicts();
		
		if (getSong().userInstrumentTuning){
			var theUSERTuning = TuningsLibrary.findTuningForID("USER");
			if (theUSERTuning){
				TuningsLibrary.hideAllTunings();
				Object.assign(theUSERTuning, getSong().userInstrumentTuning);  //the version in the song model is just used for persistence. allTunings.tunings array keeps the USER tuning that is used at runtime.
			}
		}

		var tuningsShowing = TuningsLibrary.showTuningsForTablesInFile();
		if (tuningsShowing == 0){
			showDefaultTunings();
		}

		replay();
		sectionChanged();
	}

	function showDefaultTunings(){
		let preferredTuningArray = applyInstrumentPrefs();
		const params = new URLSearchParams(window.location.search);
		const tuning = params.get('tuning');
		if (tuning){
			TuningsLibrary.showDefaultTuning(tuning);
		} else if ( Array.isArray(preferredTuningArray) && preferredTuningArray.length>0 ){
			preferredTuningArray.forEach(baseID => {
				TuningsLibrary.showDefaultTuning(baseID);//calls showHideTunings and shows S6 if none found.
			});
		} else {
			TuningsLibrary.showDefaultTuning();
		}
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
					result = result + "<a href='#' data-action='loadSong' data-action-args='"+song+"'>"+song+"</a><br />";
				});
				$('#divSongList').html(result).show();
			});
		}
	}

	export function showGraveyard(){
		hideAllMenuDivs();
		showMessages(getSong().graveyard.buildGraveyardTable());
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
				.append(div);
				/* This has been commented out 20260420 because it was potentially weird and didn't seem to do anything any more,
				   and may register this function too many times, e.g. once per loop.
				    .on("click", "td", function() { // This function will execute when any td inside #container is clicked
					    var noteRole = $(this).attr('noteRole'); 
						$("input[name=rbColor][value="+noteRole+"]")
							.prop('checked', true);
							//this div has a ColorDict generated by buildColorDicts 
							// and then we click on the TDs in there, 
							// and the role has been stored in the td attr "noteRole"
						//turnOffAutoColorCheckbox();	
					});*/
				count++;
			}
	    }
		if (count==0){
			var warning = $("<div class='warningMessage'>");
			warning.html("No tunings chosen: click the Tunings button.");
			$('#tabledest').append(warning);
		}
		buildColorDicts();
		installFillPageSelects();
	}

	//TODO: make this targeted, especially watching out for un-docked tables.
	export function reinstallAllTuningsTables(){
			var target = $("#tabledest");
			target.empty();
			installAllTuningsTables();
			installTDNoteClick();
			installBtnHamburgerClicks();
			clearAll();
			resetNoteNames();
			TuningsLibrary.showHideTunings();
			$('#spanFillVisibleTablesSelect').html(getVisibleTablesSelect());
	}

	export function installTDNoteClick(){
		const eventNamespace = '.installTDNoteClick';
		$('td.note')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function(event) {
			colorNote($(this));
			event.stopPropagation();
		});
	}

	export function installRBColorChangeEvents(){
		const eventNamespace = '.installRBColorChangeEvents';
	
		$('input[name="rbColor"]:radio')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function() {
				if ($(this).is(":checked") && !gPresentation.palette.suppressRbColorRemember) {
					PalettePresentation.rememberRestorableRbColor(this);
				}
				PalettePresentation.updateRestoreRbColorButton();
				if ("noteKeep" === $(this).val()) {
				} else if ("noteDropper" === $(this).val()) {
					$("td.note").css({"cursor": "zoom-in"});
				} else {
					$("td.note").css({"cursor": "pointer"});
					turnOffHiding();
				}
			});
	
		$('input[name="rbColor"]')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				$('input[name="rbColor"]').css({"box-shadow": "none"});
				$("td.note").css({"cursor": "auto"});
			});
	
		PalettePresentation.initializePalettePresentation();
	}

    export function addBeat(){
		clearHighlights();
		var beats = getSong().getBeats();
		beats++;
		getSong().setBeats(beats);
		$('#lblBeats').html(beats);  //number of beats in Section
		showBeats();  //updates #lblBeat  current beat in Section
    }

	export function leaveFullscreen(){
		var wasVisible =  $('.container').is(':visible');
		$('.container').show();
		$("#tabledestTopPad").hide();
		$(".dockable-handle").show();
		$("#divESCAPE").hide();
		return !wasVisible;
	}
	export function enterFullscreen(showESCButton){
		$('.container').hide();
		$("#tabledestTopPad").show();
		$(".dockable-handle").hide();
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
			$(".dockable-handle").hide()
			setWiringOpenState(false); //going fullscreen
		} else {
			if (getSong().captionsRowShowing){
				$('.captionRow').show();
			} else {
				$('.captionRow').hide();
			}
			$(".dockable-handle").show()
			$("#tabledestTopPad").hide();
			$("#divESCAPE").hide();
		}
	}
	export function showTransport(parkAtBottom = false) {
		TransportBuilder.showTransport(parkAtBottom);
	}
	export function toggleTransport(){
		TransportBuilder.toggleTransport();
	}
	export function toggleSectionDrawer(){
		TransportBuilder.toggleSectionDrawer();
	}
	export function toggleCaption(){
		$('#topControlsCaptions').toggle();
	}
	export function toggleInstrumentCaptionRow(){
		$('.captionRow').toggle();
	}

	export function setSectionKeysFlats(){
		getSong().sharps = false;
		getCurrentSection().sharps = false;
		resetNoteNames();
		updateSectionsStatus();
	}
	
	export function setSectionKeysSharps(){
		getSong().sharps = true;
		getCurrentSection().sharps = true;
		resetNoteNames();
		updateSectionsStatus();
	}
	// see also: song.js :: cycleThruKeysAllSections()
	export function cycleThruKeys(amount){
		var curr = toInt(getCurrentSection().rootID, 0);
		curr=(12+curr + amount) % 12;
		getCurrentSection().rootID = curr;
		SectionDrawerBuilder.rootIDChanged();
		resetNoteNames();
		clearRecordedNotes();// TODO: make sure this is OK, and delete this comment: This clears highlights correctly, and used to be in updateSectionsStatus, but didn't belong there.
		updateSectionsStatus();
	}

	export function transpose(amount){
		cycleThruKeys(amount);
		getSong().moveNamedNotes(amount); //operates on getCurrentSection().

		//fullRepaint();//Don't do this, it is a bit slow because it rebuilds.
		clearAll();
		replay();
		showBeats();
		var namedNoteName =  getSong().getCurrentSection().getRootNoteName();
		highlightOneNote(namedNoteName);
	}

	export function transposeSong(amount, options){
		//options is {amount: 1, NamedNotes: true, PlayedNotes: true, RecordedNotes:true}
		getSong().cycleThruKeysAllSections(amount);
		//TODO: select on arg "which" and call other variants: PlayedNotes, RecordedNotes.
		if (options.NamedNotes){
			getSong().moveNamedNotesAllSections(amount);
		}
		if (options.PlayedNotes){
			getSong().movePlayedNotesAllSections(amount);
		}
		if (options.RecordedNotes){
			getSong().moveRecordedNotesAllSections(amount);
		}
		fullRepaint();
		//Did the whole song, but at least give visual cue that we did something by highlighting current section:
		var namedNoteName =  getSong().getCurrentSection().getRootNoteName();
		highlightOneNote(namedNoteName);
	}

	export function transposeSongKeys(amount){
		getSong().cycleThruKeysAllSections(amount);
		fullRepaint();
		showBeats();
	}

	export function updatePrintSections(){
		$("#divChartSummaryTab").html(SectionPrinter.printSections(getSong(), getSections(), false));
		$("#divChartDetailsTab").html(SectionPrinter.printSections(getSong(), getSections(), true));
		$("#divChartNotesTab")  .html(SectionPrinter.printSectionsNotes(getSong(), getSections()));
	}

	export function printSections(showDetail) {
		updatePrintSections();
		if (showDetail) {
			showChartTab("Details");
		} else {
			showChartTab("Summary");
		}
		showOneMenu("#divChart", true);
	}

	export function printSectionsNotes(){
		updatePrintSections();
		showChartTab("Notes");
		showOneMenu("#divChart", true);
	}

	export function linkToSection(idx) {
		getSong().gotoSection(idx);
		hideCmdLine();
	}
	export function linkToSectionChartChord(idx, chartChord) {
		getSong().sections[idx].chartChord = chartChord;
		let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
		if (doSectionChanged){
			sectionChanged(); //updateSectionsStatus(); //calls printSectionsNotes();
		}
	}
	export function linkToSectionChartMode(idx, chartMode) {
		getSong().sections[idx].chartMode = chartMode;
		let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
		if (doSectionChanged){
			sectionChanged(); //updateSectionsStatus(); //calls printSectionsNotes();
		}
	}

	export function linkToSectionChangedTonal(){
		sectionChanged();
	}

	export function linkToSectionTableChord(idx, tableID, chord) {
		let sn = getSong().sections[idx].sectionNotesByTable[tableID];
		if (!sn){
			return;	
		}
		sn.chord = chord;
		let doSectionChanged = (arguments.length < 4) ? true : arguments[3];
		if (doSectionChanged){
			sectionChanged();
		}
	}

	export function linkToSectionTableMode(idx, tableID, mode) {
		let sn = getSong().sections[idx].sectionNotesByTable[tableID];
		if (!sn){
			return;	
		}
		sn.mode = mode;
		let doSectionChanged = (arguments.length < 4) ? true : arguments[3];
		if (doSectionChanged){
			sectionChanged();
		}
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
			if (!LastBlackBackgroundColor || !LastWhiteBackgroundColor){
				return;
			}
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

	export function getVisibleTablesSelect() {
		const tableIds = getSong().getVisibleTunings();
		const prefix = Constants.TABLE_ID_PREFIX;
		let html = '<select id="fillVisibleTablesSelect">';
		tableIds.forEach(tableId => {
			// Remove the prefix from the tableId for display
			let displayText = tableId.startsWith(prefix) ? tableId.slice(prefix.length) : tableId;
			html += `<option value="${tableId}">${displayText}</option>`;
		});
		html += '</select>';
		return html;
	}


	export function automateDisplay(){

	}

	//=========================================================================

	export function displayOptionsToControls(options){
		const sizesObj = options.NoteDisplaySizes || {};
		const naturalFontScaling = options.naturalFontScaling;
		const functionSymbolsValue = options.dropDownFunctionSymbols?.value;

		if (getSong().presentationMode){
			if (sizesObj.width != null){
				$("#dropDownCellWidth").val(String(sizesObj.width));
			}
			if (sizesObj.height != null){
				$("#dropDownCellHeight").val(String(sizesObj.height));
			}
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

		if (options.hideNamedNotes || options.hideTinyNotes || options.hideSingleNotes || options.hideFingering){
			turnOnKeep();
			$("#lblHideWarning").show();
		} else {
			$("#lblHideWarning").hide();
			turnOffKeep();
		}

		getSong().namedNoteOpacity = options.namedNoteOpacity;
		getSong().singleNoteOpacity = options.singleNoteOpacity;
		getSong().tinyNoteOpacity = options.tinyNoteOpacity;
		$("#rangeNamedNoteOpacity").val(options.namedNoteOpacity);
		$("#rangeSingleNoteOpacity").val(options.singleNoteOpacity);
		$("#rangeTinyNoteOpacity").val(options.tinyNoteOpacity);

		if (functionSymbolsValue != null){
			$('#dropDownFunctionSymbols').val(functionSymbolsValue);
			$('#textareaFunctionSymbols').val(functionSymbolsValue);
		}
		try {
			getSong().noteNamesFuncArr = JSON.parse(functionSymbolsValue ?? $('#dropDownFunctionSymbols').val());
		} catch (error) {
			const fallback = Array.isArray(getSong().noteNamesFuncArrDEFAULT)
				? [...getSong().noteNamesFuncArrDEFAULT]
				: JSON.parse($('#dropDownFunctionSymbols').val());
			getSong().noteNamesFuncArr = fallback;
			$('#textareaFunctionSymbols').val(JSON.stringify(getSong().noteNamesFuncArr));
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
		if (naturalFontScaling != null){
			$("#selNaturalFontScaling").val(String(naturalFontScaling));
		}
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
		options.naturalFontScaling = $("#selNaturalFontScaling").val();
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

	//================================================================

	export function installBtnHamburgerClicks(){
		const eventNamespace = '.installBtnHamburgerClicks';

		$(".showsubcaption")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
			$(".subcaption").toggle();
		});
		$(".showcolordict")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
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
		$(".showLeftCaption")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
			$(".fretTableTDCaption").toggle();
		});
		$(".showLeftSectionMark")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
			$(".LooperLightTD").toggle();
		});
		$(".showTuningDetails")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
			$(".spanTuningDetails").toggle();
		});
		$(".showNoteDetails")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
			$(".spanNoteDetails").toggle();
		});
		$(".showTonalDetails")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
			$(".spanTonalDetails").toggle();
		});

		//This should become an id not a class, when the button just affect one instrument.  For now, it shows all wirings.
		$(".showWiringButton")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
			toggleWiringOpenState();
		});

	}

	function showLoopSectionsStarted(data){
        const caption = (data && data.caption)
            ? data.caption
            : (getSong() && getSong().randomLoop ? 'RANDOM....' : 'LOOPING...');
        $('#btnLoopSections').html(caption).addClass('ButtonOn');
        $('.LooperLight').addClass('LooperLightOn');
    }

    function showLoopSectionsStopped(){
        $('#btnLoopSections').html('LOOP').removeClass('ButtonOn');
        $('.LooperLight').removeClass('LooperLightOn');
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

	export function handleBtnControlsToDisplayOptions() {
		var options = controlsToDisplayOptions();
		getCurrentSection().displayOptions = options;
		THEME_INFO("controlsToDisplayOptions: <br>"+JSON.stringify(options, null, 2));
		showHideDisplayOptionsPresent();
	}
	
	export function handleBtnDeleteDisplayOptions() {
		delete getCurrentSection().displayOptions;
		showHideDisplayOptionsPresent();
	}

	export function toggleRandomLoop(){
		getSong().randomLoop = ! getSong().randomLoop;
		if (getSong().randomLoop){
			$('#btnRandomLoop').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
		} else {
			$('#btnRandomLoop').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
		}
		if (sectionsLooping()){
			restartLoopSections();
		}
	}

	//==================== 4) UI event binding and control wiring =============

	function showChartTab(which) {
		var showNotesTab = which === "Notes";
		var showSummaryTab = which === "Summary";
		var showDetailsTab = which === "Details";
		
		$('#divChartSummaryTab').toggle(showSummaryTab);
		$('#divChartNotesTab').toggle(showNotesTab);
		$('#divChartDetailsTab').toggle(showDetailsTab);

		$('#btnChartSummaryTab')
			.toggleClass('BtnPunchedIn', showSummaryTab)
			.toggleClass('BtnPunchedOut', !showSummaryTab);
		$('#btnChartNotesTab')
			.toggleClass('BtnPunchedIn', showNotesTab)
			.toggleClass('BtnPunchedOut', !showNotesTab);
		$('#btnChartDetailsTab')
			.toggleClass('BtnPunchedIn', showDetailsTab)
			.toggleClass('BtnPunchedOut', !showDetailsTab);	
	}

	export function bindDesktopEvents(){
		const eventNamespace = '.bindDesktopEvents';

		function namespaceEvents(events){
			return events
				.split(' ')
				.map((eventName) => `${eventName}${eventNamespace}`)
				.join(' ');
		}

		function bindEvent(events, selector, handler){
			const namespacedEvents = namespaceEvents(events);
			$(selector)
				.off(namespacedEvents)
				.on(namespacedEvents, handler);
		}

		function bindDelegatedEvent(events, selector, handler){
			const namespacedEvents = namespaceEvents(events);
			$(document)
				.off(namespacedEvents, selector)
				.on(namespacedEvents, selector, handler);
		}
		
		bindDelegatedEvent('click', '.graveyard-raise-link', function(e) {
			e.preventDefault();
			const index = toInt($(this).data('grave-index'), -1);
			if (index >= 0) {
				getSong().graveyard.raise(index);
			}
		});

		bindDelegatedEvent('click', '.graveyard-toggle-json', function(e) {
			e.preventDefault();
			const target = $(this).data('target');
			if (target) {
				$(target).toggle();
			}
		});

		bindDelegatedEvent('input change', '#rangeNamedNoteOpacity, #rangeSingleNoteOpacity, #rangeTinyNoteOpacity', function() {
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

		bindEvent('click', '#btnPalette', function() {
			showOneMenu("#palette");
		});
		bindEvent('click', '#btnDesktop', function() {
		    showOneMenu("#divDesktop");
		});
		//======= Chart TabGroup buttons ========
		bindEvent('click', '#btnChart', function() {
		    showOneMenu("#divChart");
		});
		bindEvent('click', '#btnChartSummaryTab', function() {
			showChartTab("Summary");
		});
		bindEvent('click', '#btnChartNotesTab', function() {
			showChartTab("Notes");
		});
		bindEvent('click', '#btnChartDetailsTab', function() {
			showChartTab("Details");
		});
		//=========================================
		bindEvent('click', '#btnHelp', function() {

		});
		bindEvent('click', '#btnHamburger', function() {
		   $("#divControls").toggle();
		   hideAllMenuDivs();
		});
		bindEvent('change', '#cbPresentationMode', function(){
			getSong().presentationMode = this.checked;
		});

		bindEvent('click', '#btnMessagesTab', function() {
			showMessagesTab('Messages');
		});
		bindEvent('click', '#btnJsonTreeTab', function() {
			showMessagesTab('JsonTree');
		});
		bindEvent('click', '#btnHideMessagesJsonTree', function() {
			hideMessages_KeyHandler();
		});

		bindEvent('click', '#btnFileControls', function() {
		    showOneMenu("#divFileControls")
		});
		bindEvent('click', '#btnTunings', function() {
			showOneMenu("#divTunings");//toggles on
			requestReloadTuningsDisplays();//sets MyTunings button to PunchedIn, so has to go last.
		});
		bindEvent('click', '#btnFillNotes', function() {
		    showOneMenu("#divFillNotes");
		});
		bindEvent('click', '#btnViewControls', function() {
		    showOneMenu("#divViewControls");
		});
		bindEvent('click', '#btnThemeControls', function() {
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
		bindEvent('click', '#btnShowAllNoteNames', function() {
			linkButtonToCB('#btnShowAllNoteNames', '#cbShowAllNoteNames');
			showAllNoteNames($('#cbShowAllNoteNames').prop('checked'));
		});
		bindEvent('click', '#btnRandomLoop', function() {
			toggleRandomLoop();
		});
		bindEvent('click', '#btnNoteV', function() {
			checkRB("#rbNotename");
			resetNoteNames();
		});
		bindEvent('click', '#btnFuncV', function() {
			checkRB("#rbFunction");
			resetNoteNames();
		});
		bindEvent('click', '#btnAutoColor,#btnAutoColor2', function() {
			toggleAutoColorCheckbox();
		});
		// ========== END "Quick" Menu ==========

		bindEvent('click', '#btnToggleTransport', function() {
			TransportBuilder.toggleTransport();
		});
		bindEvent('click', '#btnToggleCmdLine', function() {
			toggleCmdLine();
		});
		bindEvent('click', '#btnToggleQuick', function() {
			$('#divQuick').toggle();
		});

		bindEvent('click', '#btnClear', function() {
		    resetNoteNames();
		    clearAll();
		});
		bindEvent('click', '#btnDownload', function() {
		    downloadPlayedNotes();
		});
		bindEvent('click', '#btnPrevSection, #btnPrevSection2', function() {
		    getSong().gotoPrevSection(false);
		});
		bindEvent('click', '#btnNextSection, #btnNextSection2', function() {
		    getSong().gotoNextSection(false);
		});
		bindEvent('click', '#btnFirstSection', function() {
			getSong().firstSection();
			clearAndReplaySection();
		});
		bindEvent('click', '#btnLastSection', function() {
		    getSong().lastSection();
			clearAndReplaySection();
		});

		bindEvent('click', '#btnLoopSections', function() {
		    toggleLoopSections();
		});
		bindEvent('click', '#btnLoopBeatsTransport', function() {
		    toggleLoopBeats();
		});
		bindEvent('click', '#btnEditSection', function() {
			toggleSectionDrawer();
		});


		bindEvent('click', '#cbShowAllNoteNames', function() {
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

		bindEvent('click', '.RecordButton', function() {
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

		bindEvent('click', '#btnPrevBeat', function() {
		    getSong().prevBeat();
		    showHighlightsForBeat(getSong().getBeat());
		});
		bindEvent('click', '#btnNextBeat', function() {
		    getSong().nextBeat();
		});
		bindEvent('click', '#btnPrevBeatTransport', function() {
		    getSong().prevBeat();
		});
		bindEvent('click', '#btnNextBeatTransport', function() {
		  	getSong().nextBeat();
		});
		bindEvent('change', '#txtFilename', function() {
		 $(".lblSongName").html($( this ).val());
		});

		bindEvent('change', '#txtBPM', function() {
		 setBPM($(this).val());  //interestingly, this does NOT cause jQuery to call ".change()" again.
		});

		bindEvent('click', '#btnRowRangeReset', function() {
			//$('#textareaRowRange').val(JSON.stringify(noteNamesRowRangeArr));
			fullRepaint();
		});

		bindEvent('change', '#dropDownBaseInstrument', function() {
			var baseInstrumentID = $(this).val();
			fullRepaint();
			updateSectionsStatus();
		});

		bindEvent('change', '#dropDownCellHeight', function() {
			fullRepaint();
	    });
		bindEvent('change', '#dropDownCellWidth', function() {
			fullRepaint();
		});
		bindEvent('change', '#cbNaturalFretWidths,#selNaturalFontScaling', function(){
			fullRepaint();
		});
		bindEvent('change', '#selNoteFont', function(){
			setOneCssVar("--td-note-font-family", $("#selNoteFont").val());
			fullRepaint();
		});
		bindEvent('change', '#selLeftSubscriptFontSize', function(){
			setOneCssVar("--left-subscript-font-size", $("#selLeftSubscriptFontSize").val());
			fullRepaint();
		});
		bindEvent('change', '#selRightSubscriptFontSize', function(){
			setOneCssVar("--right-subscript-font-size", $("#selRightSubscriptFontSize").val());
			fullRepaint();
		});
		bindEvent('change', '#selTinyNoteMaxHeight', function(){
			setOneCssVar("--tiny-note-max-height", $("#selTinyNoteMaxHeight").val());
			fullRepaint();
		});
		bindEvent('change', '#selTinyNoteFontSize', function(){
			setOneCssVar("--tiny-note-font-size", $("#selTinyNoteFontSize").val());
			fullRepaint();
		});


		bindEvent('change', '#selMidiFontSize', function(){
			setOneCssVar("--midi-font-size", $("#selMidiFontSize").val());
			fullRepaint();
		});
		bindEvent('change', '#selFingeringFontSize', function(){
			setOneCssVar("--fingering-font-size", $("#selFingeringFontSize").val());
			fullRepaint();
		});
		bindEvent('change', '#selFingeringPosition', function(){
			setOneCssVar("--fingering-position", $("#selFingeringPosition").val());
			fullRepaint();
		});
		bindEvent('change', '#dropDownInstrumentMargins', function() {
			//short-circuit and set it now, it is in mem for next time.
			var margin = this.value;
			$('.instrumentBackground').css({"margin-top": margin, "margin-bottom": +margin });
		});

		bindEvent('change', '#cbHideNamedNotes, #cbHideSingleNotes, #cbHideTinyNotes, #cbHideFingering', function() {
			var hnchecked = $('#cbHideNamedNotes').prop("checked");
			var hschecked = $('#cbHideSingleNotes').prop("checked");
			var htchecked = $('#cbHideTinyNotes').prop("checked");
			var hfchecked = $('#cbHideFingering').prop("checked");
		
			if (htchecked || hschecked || hfchecked || hnchecked){
				turnOnKeep();
				$("#lblHideWarning").show();
			} else {
				$("#lblHideWarning").hide();
				turnOffKeep();
			}
			clearAll();
			replay();
		});

		
		bindEvent('change', '#cbShowCellNotes', function() {

			if ( ! this.checked ) {
				$("#cbCenterForRightFunction").prop("checked", false);
			}
			resetNoteNames();
	    });
		bindEvent('change', '#cbCenterForRightFunction', function() {

			if ( this.checked ) {
				$("#cbShowCellNotes").prop("checked", true);
			}
			resetNoteNames();
	    });
		bindEvent('change', 'input[type=radio][name=rbnFunctionNotename]', function() {
	        resetNoteNames();
	    });

		bindEvent('change', '#cbShowSubscriptFunctions', function() {
	        resetNoteNames();
	    });
		bindEvent('change', '#cbMidiNum', function() {
	        resetNoteNames();
	    });
		bindEvent('change', '#textareaFunctionSymbols', function() {
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
		bindEvent('click', '#btnFunctionSymbolsReset', function() {
			const fallback = Array.isArray(getSong().noteNamesFuncArrDEFAULT)
				? [...getSong().noteNamesFuncArrDEFAULT]
				: JSON.parse($('#dropDownFunctionSymbols').val());
			getSong().noteNamesFuncArr = fallback;
			$('#textareaFunctionSymbols').val(JSON.stringify(getSong().noteNamesFuncArr));
			fullRepaint();
		});
		// END-CODE-EXAMPLE("TextAreaWButtonWidget") 
		// CODE-EXAMPLE("TextAreaWButtonWidget", "BanjoNut")
		bindEvent('click', '#btnBanjoNutExamples', function() {
			$("#divBanjoNutExamples").toggle();
		});

		bindEvent('click', '#divBanjoNutExamples tr[data-banjo-nut-value]', function() {
			$("#textareaBanjoNut").val($(this).attr("data-banjo-nut-value")).trigger("change");
			$("#divBanjoNutExamples").hide();
		});
		// END-CODE-EXAMPLE("TextAreaWButtonWidget") 
		bindEvent('change', '#dropDownFunctionSymbols', function() {
            var value = $('#dropDownFunctionSymbols').val();
			getSong().noteNamesFuncArr = JSON.parse(value);  //this one is safe--comes from our built SELECT.
			$('#textareaFunctionSymbols').val(JSON.stringify(getSong().noteNamesFuncArr));
            fullRepaint();
	    });

		bindEvent('click', '#btnFillChord', function() {
	        fillChord();
	    });

		bindEvent('click', '#btnControlsToDisplayOptions_View', function() {
	        handleBtnControlsToDisplayOptions();
	    });
		bindEvent('click', '#btnDeleteDisplayOptions_View', function() {
			handleBtnDeleteDisplayOptions();
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
			linkToSectionChartChord,
			linkToSectionChartMode,
			hideGraveyard,
			saveInstrumentPrefs,
			applyInstrumentPrefs,
			clearInstrumentPrefs
		};

		$(document).on('click', '[data-action]', function(e) {
			e.preventDefault();
			const action = $(this).data('action');
			let args = $(this).data('action-args');
			if (typeof args === 'string') {
				try { args = JSON.parse(args); } catch { args = [args]; }
			}
			if (!Array.isArray(args)) args = args !== undefined ? [args] : [];
			const handler = dataActionHandlers[action];
			if (typeof handler === 'function') {
				handler(...args);
			} else {
				console.warn('No data-action handler registered for:', action);
			}
		});
	}

	//==================== document.ready helper functions =====================

	export function ChromeFullscreen() {
	  document.documentElement.webkitRequestFullScreen();
	}

	//============= Scaling Prefs in localStorage ==========================

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
				$("#dropDownCellWidth").val(scalingPrefs.CellWidth).trigger('change');
				$("#dropDownCellHeight").val(scalingPrefs.CellHeight).trigger('change');
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

	//============= Instrument Prefs in localStorage ==========================

	const INSTRUMENT_PREFS = "InstrumentPrefs";

	export function saveInstrumentPrefs(){
		let baseIDArray = TuningsLibrary.getMyTunings().map(tuning => tuning.fromBaseID)
		let instrumentPrefs = {baseIDArray: baseIDArray};

		localStorage.setItem(INSTRUMENT_PREFS, JSON.stringify(instrumentPrefs));
		$("#divInstrumentPrefs").html(JSON.stringify(instrumentPrefs));

	}

	export function applyInstrumentPrefs(){
		$("#divInstrumentPrefs").html("");
		var instrumentPrefsStr = localStorage.getItem(INSTRUMENT_PREFS);
		if (instrumentPrefsStr){
			var instrumentPrefs = JSON.parse(instrumentPrefsStr);
			if (instrumentPrefs){
				$("#divInstrumentPrefs").html(JSON.stringify(instrumentPrefs));
				if (instrumentPrefs.baseIDArray){
					return instrumentPrefs.baseIDArray;
				}
			}
		}
		return "";
	}

	export function clearInstrumentPrefs(){
		localStorage.removeItem(INSTRUMENT_PREFS);
		$("#divInstrumentPrefs").html("");
	}

	//========================================================================

	/** After calling this, choose a theme either by default or by looking in song you just opened for USER theme. */
	export function rebuildThemesDropdown(){
		ThemesBuilder.rebuildThemesDropdown();
	}

	//==================== 5) App init and EventBus integration ===============

	// Headless replacement for document.ready for testing
	export function setupSongTests() {
		gSong = new Song();   //var song global in this file (at top).
		gSong.setHeadless(true, true);
		gSong.ensureDefaultSection();
		pluginManager.loadSongPluginState(gSong);

		installModuleProviders();
		
		//getSong().graveyard = makeGraveyard();
		installDefaultColorDicts();
		applyStylesheetsTo_gUserColorDict();
		TuningsLibrary.ensureDefaultMyTuning('S6');

		//TODO: in each test be sure to set this somehow: getSong().songName = currentFilename;
	}

	// appInit() called by document.ready
	// File-level appInit for browser startup
	export function appInit() {
		gAppInit_running = true;

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

		gSong = new Song();
		gSong.ensureDefaultSection();
		pluginManager.loadSongPluginState(gSong);

		
		installAllTuningsTables();
		installBtnHamburgerClicks();
		setupOpenFile();
		sectionChanged();
		installTDNoteClick();
		bindDesktopEvents();
		installLoopTimingModeControls();
		applyScalingPrefs(true);
		
		$('#textareaFunctionSymbols').val(JSON.stringify(getSong().noteNamesFuncArr));

		var currentFilename = $("#txtFilename").val();
		$(".lblSongName").html(currentFilename);
		getSong().songName = currentFilename;
		$('.topControlsCaptions').show();

		
      	$("#lblHideWarning").hide(); //in divViewControls

		showHideDisplayOptionsPresent();  //enables and disables btnDeleteDisplayOptions_* etc.
 		hideAllMenuDivs();
		$("#divQuick").hide();
		$("#tabledestTopPad").hide();
		$("#CmdMenu").hide();

		updateFontLabel();

		loadTemplates('templates/palette.html').then(() => {
			PaletteBuilder.addToDest("#divPalette");
			installDefaultColorDicts();
			applyStylesheetsTo_gUserColorDict();
			buildColorDicts();
			$('#divColorDicts').hide();
			$("#CustomColorEditors").hide();

			//in palette div: 
			$('#cbAutomaticColor').prop('checked', true);
			$("#cbAutomaticColor").trigger('change');//will change from checked to not checked and run click().

			buildUserColors();
			installRBColorChangeEvents();
		});


		bindDataActionHandlers();
		TuningsLibrary.bindFormTuningsEvents();
		

		$(document).on('keypress', document_keypress);
		$("#txtCmdLine").on('keypress', txtCmdLine_keypress);
		$(document).on('keyup', document_keyup);

		setWiringOpenState(false);

		$( window ).on( "resize", function() {
			TransportBuilder.transportResize();
		} );
		TransportBuilder.transportResize(true);
        draggable(document.getElementById('transport'));
		TransportBuilder.showTransport();

		showDefaultTunings();
		showChartTab("Summary"); //choose tab but don't show Chart menu yet.
		scrollToTop();

		const promises = [
			loadTemplates().then(() => {
				getSong().getVisibleTuningIDs().forEach(tuningID => {
					WiringBuilder.addWiringWidget(tuningID, Constants.TABLE_ID_PREFIX+tuningID);
				});
				setWiringOpenState(false);
			}),

			loadTemplates('templates/themes.html').then(() => {
				ThemesBuilder.addToDest('#divThemeControls');
				rebuildThemesDropdown();
				$('#selThemes').val("Autobahn").trigger('change');
			}),
			
			loadTemplates('templates/section-drawer.html').then(() => {
				SectionDrawerBuilder.addToDest("#spanSectionDrawer");
				sectionChanged();
			}),

			loadTemplates('templates/SectionStatus/section-status.html').then(() => {
				SectionStatusBuilder.addToDest('#divSectionStatus_LeadSheet', 'leadsheet', 'caption', 'horizontal');
			})
		];
		Promise.all(promises).then(() => {
			setSectionKeysFlats();  //The default. Calls resetNoteNames();
			EventBus.trigger('ReinstallAllTuningsTables');
			EventBus.trigger('UpdateAllWiringSelects');
			setWiringOpenState(false);
			gAppInit_running = false;
			fullRepaint();
			scrollToTop();
		});
	}
	// End of appInit() with document ready call

	//========================================================================= 
	//  $(document).ready(appInit)                                      =======
	//      will now be called from index.html                          =======
	//      after all other script tags.                                =======
	//=========================================================================

	//Note the default param value.  This function is also called with other templates as "url".
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

function requestReloadTuningsDisplays() {
	EventBus.trigger('ReloadTuningsDisplays');
}

EventBus.on('UpdateSectionStatus', function(event, data) {
  updateSectionsStatus();
});
EventBus.on('SectionChanged', function(event, data) {
  sectionChanged();
});
EventBus.on('SectionMoved', function(event, data) {
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
EventBus.on('ShowMessages', function(event, data) {
	showMessages(data && data.html ? data.html : '');
});
EventBus.on('PluginManager:ShowResult', function(event, data) {
	if (data && data.result) {
		addCmdResults(`${data.pluginId}:${data.eventName} >> ${data.result}`);
	}
	if (data && data.message) {
		showMessages(data.message);
	}
});
EventBus.on('ReinstallAllTuningsTables', function() {
	reinstallAllTuningsTables();
});
EventBus.on('UpdateAllWiringSelects', function() {
	getSong().getVisibleTuningIDs().forEach(tuningID => {
		WiringBuilder.addWiringWidget(tuningID, Constants.TABLE_ID_PREFIX+tuningID);
	});
	updateAllWiringSelects();
});
EventBus.on('InstrumentAdded', function() {
	setWiringOpenState(true);  // to open
});
EventBus.on('Looper:OnLoopBeatsStart', function() {
	$('#btnLoopBeatsTransport').addClass('ButtonOn');
});
EventBus.on('Looper:OnLoopBeatsStop', function() {
	$('#btnLoopBeatsTransport').removeClass('ButtonOn');
});
EventBus.on('Looper:OnLoopSectionsStart', function(event, data) {
    showLoopSectionsStarted(data);
});
EventBus.on('Looper:OnLoopSectionsStop', function() {
    showLoopSectionsStopped();
});


