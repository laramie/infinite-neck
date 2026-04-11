/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */
import { jsonTree } from './jsonTree80kg/json-tree-80kg.js';
import { setOneCssVar } from './themeFunctions.js';
import {
	clearCmdResults,
	hideCmdLine,
	setCmdActionRunner,
	showCmdLine,
	stringifyMenuItem,
	updateCmdLineView
} from './command-line.js';
import {
	displayOptionsTable
} from './display-options.js';
import {
	beatsLooping,
	restartLoopSections,
	sectionsLooping,
	toggleLoopBeats,
	toggleLoopSections
} from './looper.js';
import {
	buildChildMenuCaptionsRow,
	dumpMenus,
	gMenuFile,
	gMenuPointer,
	setMenuValueResolver,
	setMenuAtRoot,
	gMenuLoaded
} from './menu.js';
import {
	gUserColorDict
} from './userColors.js';
import {
	toInt
} from './utils.js';
import {
	showMessagesTab,
	getVersionString,
	getVersionObject,
	toggleWiringOpenState,
	toggleTransport,
	toggleSectionDrawer,
	setSectionKeysFlats,
	setSectionKeysSharps
} from './infinite-neck.js';
import DaCapo from './plugins/DaCapo.js';
import EventBus from './event-bus.js';

export { document_keypress, document_keyup };

let keyHandlerProviders = {};

export function setKeyHandlerProviders(nextProviders = {}) {
	keyHandlerProviders = { ...keyHandlerProviders, ...nextProviders };
}

function requireProvider(name) {
	const fn = keyHandlerProviders[name];
	if (typeof fn !== 'function') {
		throw new Error('key-handlers missing provider: ' + name);
	}
	return fn;
}

function addBeat(...args) { return requireProvider('addBeat')(...args); }
function checkRB(...args) { return requireProvider('checkRB')(...args); }
function clearAndReplaySection(...args) { return requireProvider('clearAndReplaySection')(...args); }
function cycleThruKeys(...args) { return requireProvider('cycleThruKeys')(...args); }
function cycleThruNutWidths(...args) { return requireProvider('cycleThruNutWidths')(...args); }
function downloadBackupThenClearGraveyard(...args) { return requireProvider('downloadBackupThenClearGraveyard')(...args); }
function downloadPlayedNotes(...args) { return requireProvider('downloadPlayedNotes')(...args); }
function enterFullscreen(...args) { return requireProvider('enterFullscreen')(...args); }
function getBPM(...args) { return requireProvider('getBPM')(...args); }
function getCurrentSection(...args) { return requireProvider('getCurrentSection')(...args); }
function getPersistentSongFile(...args) { return requireProvider('getPersistentSongFile')(...args); }
function getSectionsCurrentIndex(...args) { return requireProvider('getSectionsCurrentIndex')(...args); }
function getSong(...args) { return requireProvider('getSong')(...args); }
function hideAllMenuDivs(...args) { return requireProvider('hideAllMenuDivs')(...args); }
function highlightOneNote(...args) { return requireProvider('highlightOneNote')(...args); }
function leaveFullscreen(...args) { return requireProvider('leaveFullscreen')(...args); }
function printSections(...args) { return requireProvider('printSections')(...args); }
function printSectionNotes(...args) { return requireProvider('printSectionNotes')(...args); }
function resetNoteNames(...args) { return requireProvider('resetNoteNames')(...args); }
function sectionChanged(...args) { return requireProvider('sectionChanged')(...args); }
function setBPM(...args) { return requireProvider('setBPM')(...args); }
function setNamedNoteOpacity(...args) { return requireProvider('setNamedNoteOpacity')(...args); }
function setSingleNoteOpacity(...args) { return requireProvider('setSingleNoteOpacity')(...args); }
function setTinyNoteOpacity(...args) { return requireProvider('setTinyNoteOpacity')(...args); }
function showOneMenu(...args) { return requireProvider('showOneMenu')(...args); }
function toggleCaption(...args) { return requireProvider('toggleCaption')(...args); }
function toggleFullscreen(...args) { return requireProvider('toggleFullscreen')(...args); }
function toggleInstrumentCaptionRow(...args) { return requireProvider('toggleInstrumentCaptionRow')(...args); }
function transpose(...args) { return requireProvider('transpose')(...args); }
function transposeSong(...args) { return requireProvider('transposeSong')(...args); }
function transposeSongKeys(...args) { return requireProvider('transposeSongKeys')(...args); }
function updateFontLabel(...args) { return requireProvider('updateFontLabel')(...args); }
function updateSectionsStatus(...args) { return requireProvider('updateSectionsStatus')(...args); }


const FONT_INCREMENT = 1;
const DEFAULT_FONT_SIZE = 10;  
const DEFAULT_NOTE_FONT_SIZE = 22;  // Keep in sync with infinite-neck.css :root --named-note-font-size: 22pt;  Here "pt" is glued on by code below.


function moveSelectByClampedStep(selectSelector, delta) {
	var jSelect = $(selectSelector);
	if (jSelect.length === 0) {
		return;
	}
	var optionCount = jSelect.find('option').length;
	if (optionCount === 0) {
		return;
	}
	var currentIndex = jSelect.prop('selectedIndex');
	if (currentIndex < 0) {
		currentIndex = 0;
	}
	var nextIndex = Math.max(0, Math.min(optionCount - 1, currentIndex + delta));
	if (nextIndex === currentIndex) {
		return;
	}
	jSelect.prop('selectedIndex', nextIndex).trigger('change');
}


function document_keyup(evt) {
    if (evt.keyCode == 27) {  // ESC key
        leaveFullscreen();
        hideCmdLine();
        hideAllMenuDivs();
        $("#btnLoopSections").focus();
    }
}



function document_keypress(e) {

    if (e.keyCode == 13) {
        //alert(this.value);
        e.preventDefault();
    }
    var tag = e.target.tagName.toLowerCase();
    if ( tag != 'input' && tag != 'textarea'){
        switch (e.key){
            case "m":
            case "M":
                showCmdLine();
                e.preventDefault();
                break;
            case "/":
                setMenuAtRoot();
                clearCmdResults();
                showCmdLine();
                var menu = gMenuPointer;
                var childCaptions = buildChildMenuCaptionsRow(menu);
                updateCmdLineView();
                e.preventDefault();
                break;
            case "a":
                toggleCaption();
                break;
            case "A":
                toggleInstrumentCaptionRow();
                break;
            case "b":
            case "B":
                getSong().prevBeat();
                break;
            case "c": //"_C_olor"
                $("#cbAutomaticColor").click();
                break;
            case "e":
                toggleWiringOpenState();
                break;
            case "f":
            case "F":
                toggleFullscreen();
                break;
            case "i":
                showOneMenu("#divFillNotes");
                break;
            case "k":
                 cycleThruKeys(1);
                 highlightOneNote(getSong().getRootNoteName());
                 break;
            case "K":
                cycleThruKeys(-1);
                highlightOneNote(getSong().getRootNoteName());
                break;
            case "l":
            case "L":
                toggleLoopSections();
                break;
            case "n":
            case "N":
                getSong().nextBeat();
                break;
            case "p":
            case "P":
                showOneMenu("#palette");
                break;
            case "q":
                $('#divQuick').toggle();
                break;
            case "s":
            case "S":
                toggleSectionDrawer();
                break;
            case "t":
                toggleTransport();
                break;
            case "v":
            case "V":
                showOneMenu("#divViewControls");
                break;
			case "u":
            case "D":  //SHIFT-D is the same as "up"
                if ( ! $("#cbTransposeNotes").prop("checked")){
                    break;
                }
                transpose(1);
                break;
            case "U": // SHIFT-U is the same as "down"
            case "d":
                if ( ! $("#cbTransposeNotes").prop("checked")){
                    break;
                }
                transpose(-1);
                break;
            case "j":  //for "Jump strings"
                if ( ! $("#cbTransposeNotes").prop("checked")){
                    break;
                }
                 transpose(5);
                 break;
            case "J":
                if ( ! $("#cbTransposeNotes").prop("checked")){
                    break;
                }
                transpose(-5);
                break;
            case "W":
				 moveSelectByClampedStep('#dropDownCellWidth', -1);
				 break;
            case "w":
				 moveSelectByClampedStep('#dropDownCellWidth', 1);
				 break;
            case "H":
					moveSelectByClampedStep('#dropDownCellHeight', -1);
                break;
            case "h":
					moveSelectByClampedStep('#dropDownCellHeight', 1);
                break;
            case "o":
				//the letter 'o' because '0' (zero) is for the nut width.
                $("#rbFinger0").attr('checked', 'checked');
                checkRB("#idRFinger0");
                break;
            case "1":
                //select radio button with value e.key, which will be one of 12345, with 5 representing "T".
                $("#rbFinger1").attr('checked', 'checked');
                checkRB("#idRFinger1");
                break;
            case "2":
                $("#rbFinger2").attr('checked', 'checked');
                checkRB("#idRFinger2");
                break;
            case "3":
                $("#rbFinger3").attr('checked', 'checked');
                checkRB("#idRFinger3");
                break;
            case "4":
                $("#rbFinger4").attr('checked', 'checked');
                checkRB("#idRFinger4");
                break;
            case "5":
                $("#rbFingerT").attr('checked', 'checked');
                checkRB("#idRFingerT");
                break;
            case "6":
                checkRB("#idNamedNotes");
                break;
            case "7":
                checkRB("#idSingleNotes");
                break;
            case "8":
                checkRB("#idTinyNotes");
                break;
            case "9":
                checkRB("#rbBend");
                break;
            case "0":
            	cycleThruNutWidths(-1);
                break;
            case "=":
                increaseUIFont();
                break;
            case "-":
                decreaseUIFont();
                break;
            case "+":
                increaseNoteFont();
                break;
            case "_":
                decreaseNoteFont();
                break;
            case ")":
                m_NoteFontSize = DEFAULT_NOTE_FONT_SIZE;
                setOneCssVar("--named-note-font-size",""+m_NoteFontSize+"pt");
                updateFontLabel();
                break;
            case "<":
				getSong().firstSection(false);
                break;
            case ",":
                getSong().gotoPrevSection(false);
                break;
            case ">":
				getSong().lastSection(false);
                break;
            case ".":
                getSong().gotoNextSection(false);
                break;
            case "[":
                checkRB('#idMidiPitches');
                break;
            case "]":
                checkRB('#idMidiPitchesSingle');
                break;
            default:
        }
    }
}

//=============== Handlers for CmdMenu =========================================
   	//  performCmdAction :: take a menuItem and user entered trigger and perhaps a value, and perform some action in this engine.
   	//
   	//  getValue :: turn a string Get request from a menu into a value.
	//


// Called by the CmdMenu whenever someone has a string that identifies an "action".
export function performCmdAction(menuItem, args){
	var actionResult = {};
	actionResult.result = "";
	actionResult.menuItem = menuItem;
	actionResult.args = args;
	actionResult.popOnBang = false;

	if (menuItem.popOnBang){
		actionResult.popOnBang = true;
	}
	var argByInputID = (args && menuItem && menuItem.input) ? args[menuItem.input.id] : undefined;
	switch (menuItem.action){
		case "setupOpenFile":
			document.getElementById('fileInput').click();
			break;
		case "lock":
            //right now just unlocks "Allow keyboard transposing..."  but there could be other things to lock down in a "song".
            $("#cbTransposeNotes").prop("checked", false);
			break;
		case "unlock":
            $("#cbTransposeNotes").prop("checked", true);
			break;
		case "version":
			actionResult.result = getVersionString();
			break;
		case "versionMore":
			actionResult.result = getVersionString();
			let version = getVersionObject();
			showMessagesJSON(JSON.stringify(version, null, 2),
			                 `<a target='_blank' href='${version.README}'>${version.README}</a><br><br>`);
			break;
		case "downloadPlayedNotes":
			downloadPlayedNotes();
			break;
		case "downloadBackupThenClearGraveyard":
			downloadBackupThenClearGraveyard();
			break;
		case "setSongName":
			if (argByInputID){
				$("#txtFilename").val(argByInputID).change();
			}
			break;
		case "setSectionCaption":
			getCurrentSection().caption = argByInputID;
			updateSectionsStatus();
			break;

		case "setSectionFlats":
			setSectionKeysFlats();
			break;
		case "setSectionSharps":
			setSectionKeysSharps();
			break;
		case "setSectionKeyWhite":
			var keyIdx = ['a','x','b','c','x','d','x','e','f','x','g','x',].indexOf(menuItem.trigger);
			if (keyIdx >= 0){
				getCurrentSection().rootID = keyIdx;
				if (menuItem.trigger == 'f'){
					setSectionKeysFlats();
				} else {					
					setSectionKeysSharps();
				}
				sectionChanged();
			}
			break;
		case "setSectionKeyBlack":
			var keyIdx = ['x','b','x','x','d','x','e','x','x','g','x','a'].indexOf(menuItem.trigger);
			if (keyIdx >= 0){
				getCurrentSection().rootID = keyIdx;
				setSectionKeysFlats();
				sectionChanged();
			}
			break;
        case "setSectionLeadKeyWhite":
			var keyIdx = ['a','x','b','c','x','d','x','e','f','x','g','x',].indexOf(menuItem.trigger);
			if (keyIdx >= 0){
				getCurrentSection().rootIDLead = keyIdx;
				sectionChanged();
			}
			break;
		case "setSectionLeadKeyBlack":
			var keyIdx = ['x','b','x','x','d','x','e','x','x','g','x','a'].indexOf(menuItem.trigger);
			if (keyIdx >= 0){
				getCurrentSection().rootIDLead = keyIdx;
				sectionChanged();
			}
			break;

		case "firstSection":
			getSong().firstSection();
            clearAndReplaySection();
			actionResult.result = ""+(getSectionsCurrentIndex()+1);
			break;
		case "prevSection":
			getSong().gotoPrevSection(false);  //calls clearAndReplaySection();
			actionResult.result = ""+(getSectionsCurrentIndex()+1);
			break;
		case "nextSection":
			getSong().gotoNextSection(false);  //calls clearAndReplaySection();
			actionResult.result = ""+(getSectionsCurrentIndex()+1);
			break;
		case "lastSection":
			getSong().lastSection();
            clearAndReplaySection();
			actionResult.result = ""+(getSectionsCurrentIndex()+1);
			break;
        case "transposeSong":
            if (argByInputID){
				let amount = toInt(argByInputID, 0);
				if (amount != 0){
				    transposeSong(amount);
                    actionResult.result = "transposed "+amount;
				}
			}
            break;
        case "transposeSongKeys":
            if (argByInputID){
				let amount = toInt(argByInputID, 0);
				if (amount != 0){
				    transposeSongKeys(amount);
                    actionResult.result = "transposed keys "+amount;
				}
			}
            break;
		case "setBPM":
			if (argByInputID){
				var bpm = toInt(argByInputID, 0);
				if (bpm > 0){
					setBPM(bpm);
					restartLoopSections();
				}
			}
			actionResult.result = getBPM();
			break;
		case "setNamedNoteOpacity":
			actionResult.result = "ERROR";
			if (argByInputID){
				var opacity = toInt(argByInputID, -1);
				if (opacity > -1 && opacity<101){
					setNamedNoteOpacity(0.01*opacity);
					actionResult.result = getSong().namedNoteOpacity;
				}
			}
			break;
		case "setSingleNoteOpacity":
			actionResult.result = "ERROR";
			if (argByInputID){
				var opacity = toInt(argByInputID, -1);
				if (opacity > -1 && opacity<101){
					setSingleNoteOpacity(0.01*opacity);
					actionResult.result = getSong().singleNoteOpacity;
				}
			}
			break;
		case "setTinyNoteOpacity":
			actionResult.result = "ERROR";
			if (argByInputID){
				var opacity = toInt(argByInputID, -1);
				if (opacity > -1 && opacity<101){
					setTinyNoteOpacity(0.01*opacity);
					actionResult.result = getSong().tinyNoteOpacity;
				}
			}
			break;
		case "toggleLoopSections":
			toggleLoopSections();
			actionResult.result = sectionsLooping() ? "ON" : "OFF";
			break;
		case "toggleLoopBeats":
			toggleLoopBeats();
			actionResult.result = beatsLooping() ? "ON" : "OFF";
			break;
			
		case "nextBeat":
			getSong().nextBeat();
			actionResult.result = ""+getCurrentSection().currentBeat;
			break;
		case "prevBeat":
			getSong().prevBeat();
			actionResult.result = ""+getCurrentSection().currentBeat;
			break;
		case "addBeat":
			addBeat();
			actionResult.result = ""+getCurrentSection().beats;
			break;
		case "deleteBeat":
			getSong().deleteBeat();
			actionResult.result = ""+getCurrentSection().beats;
			break;
        case "moveBeatsLater":
			getSong().moveBeatsLater();
			actionResult.result = ""+getCurrentSection().beats;
			break;
		case "showDialog-song":
			showOneMenu("#divFileControls");//file==song now.
			break;
		case "showDialog-section":
			showOneMenu("#divSectionControls");
			break;
		case "showDialog-fill":
			showOneMenu("#divFillNotes");
			break;
		case "showDialog-view":
			showOneMenu("#divViewControls");
			break;
		case "showDialog-themes":
			showOneMenu("#divThemeControls");
			break;
		case "showDialog-tunings":
			showOneMenu("#divTunings");
			break;
		case "showDialog-palette":
			showOneMenu("#palette");
			break;
		case "toggleTransport":
			toggleTransport();
			break;
		case "viewFullscreen":
			enterFullscreen();
			hideCmdLine();
			break;
		case "toggleFullscreen":
			toggleFullscreen();
			break;
		case "setMenuPrefs":
			console.log("setMenuPrefs:"+JSON.stringify(args));
			var c = args["key"];
			if (c == "s"){ //"short"
				gMenuFile.tall = false;
			} else if (c == "t"){
				gMenuFile.tall = true;
			}
			break;
		case "showViewDiagnostics":
			showMessagesJSON(JSON.stringify(getCurrentSection(), null, 2));
			break;
		case "showViewDiagnosticsFullModel":
			showMessagesJSON(JSON.stringify(getSong(), null, 2));
			break;
		case "showViewDiagnosticsMenu":
			showMessages(dumpMenus());
			break;
        case "showViewDiagnosticsMenuJson":
			showMessagesJSON(gMenuLoaded);
			break;
        case "showViewDiagnosticsUserColorDict":
            showMessagesJSON(JSON.stringify(gUserColorDict.dict, null, 2));
            actionResult.result = "ColorDictionary sent to Messages";
            break;
        case "showViewDiagnosticsDisplayOptions":
            showMessages(displayOptionsTable());
            actionResult.result = "DisplayOptions sent to Messages";
            break;
        case "showViewDiagnosticsSongFileFormat":
			showMessagesJSON(getPersistentSongFile());
			break;
		case "showGraveyard":
			showGraveyard();
			break;
		case "hideViewMessages":
			$("#divMessageAndJsonTree").hide()
            $("#divMessages").hide();
            actionResult.result = "Messages hidden";
            break;

		case "printSections":
			$("#divMessageAndJsonTree").show()
            $("#divMessages").show();
			$("#divMessages").html(printSections());
			hideCmdLine();
			break;
		case "printSectionNotes":
			$("#divMessageAndJsonTree").show()
            $("#divMessages").show();
			$("#divMessages").html(printSectionNotes());
			hideCmdLine();
			break;
		case "sectionDelete":
			var deleted = getSong().deleteCurrentSection();
			if (deleted){
				actionResult.result = "deleted";
			} else {
				actionResult.result = "cleared";
			}
			break;
		case "sectionAdd":
			console.log("sectionAdd=====!!");
			getSong().newSection(); //don't call addSection(section), which is an internal call.
			actionResult.result = "added";
			break;
		case "sectionAddShallowClone":
			getSong().addShallowCloneSection();
			actionResult.result = "added-shallow";
			break;
		case "sectionAddDeepClone":
			getSong().addDeepCloneSection();
			actionResult.result = "added-deep";
			break;
		case "sectionKeep":
			console.log("sectionKeep=====!");
			actionResult.result = "kept";
			break;
		case "showHelp":
			window.open('help.html','_blank');
			break;
		case "showNamedNotes":
			$("#cbHideNamedNotes").prop("checked", false).change();
			break;
		case "showSingleNotes":
			$("#cbHideSingleNotes").prop("checked", false).change();
			break;
		case "showTinyNotes":
			$("#cbHideTinyNotes").prop("checked", false).change();
			break;
		case "showFingering":
			$("#cbHideFingering").prop("checked", false).change();
			break;
		case "hideNamedNotes":
			$("#cbHideNamedNotes").prop("checked", true).change();
			break;
		case "hideSingleNotes":
			$("#cbHideSingleNotes").prop("checked", true).change();
			break;
		case "hideTinyNotes":
			$("#cbHideTinyNotes").prop("checked", true).change();
			break;
		case "hideFingering":
			$("#cbHideFingering").prop("checked", true).change();
			break;
		case "selectFingering":
			if (args){
				switch (args["key"]){
					case "o":  //the letter o, for the Finger0, since 0 is used for the nut width keymap.
						checkRB("#rbFinger0");
						checkRB("#idRFinger0");
						break;
					case "1":
					    checkRB("#rbFinger1");
						checkRB("#idRFinger1");
						break;
					case "2":
					    checkRB("#rbFinger2");
					    checkRB("#idRFinger2");
						break;
					case "3":
					    checkRB("#rbFinger3");
					    checkRB("#idRFinger3");
						break;
					case "4":
					    checkRB("#rbFinger4");
					    checkRB("#idRFinger4");
						break;
					case "5":
					    checkRB("#rbFingerT");
					    checkRB("#idRFingerT");
						break;
					case "t":
					    checkRB("#rbFingerT");
						checkRB("#idRFingerT");
						break;
				}
			}
			break;
		case "selectRadioNoteType":
			if (args){
				function check(id){
					$(id).prop("checked", true);
				}
				switch (args["key"]){
					case "n":
					    check("#idNamedNotes");
						break;
					case "s":
						check("#idSingleNotes");
						break;
					case "t":
						check("#idTinyNotes");
						break;
					case "b":
						check("#rbBend");
						break;
					case "p":
						check("#idMidiPitches");
						break;
					case "h":
						check("#idMidiPitchesSingle");
						break;
					case "k":
						check("#idKeep");
						break;
					case "c":
						check("#idClear");
						break;
                    case "f":
						check("#idDropper");
                        $("#idDropper").change();
                        //$("#idDropper").prop("checked", true);
						break;
				}
			}
			break;
		case "selectBendType":
			console.log("selectBendType: "+stringifyMenuItem(menuItem));
			$("#selBend").val(menuItem.name);
			$("#rbBend").prop("checked", true);
			break;
		case "pluginDaCapoWInput":
			console.log("pluginDaCapoWInput: "+stringifyMenuItem(menuItem));
			console.log("pluginDaCapoWInput inputs: "+JSON.stringify(argByInputID));
			let daCapoOptWI = JSON.parse(argByInputID);
			let daCapoWI = new DaCapo();
			daCapoWI.installHook(DaCapo.ON_SONG_END, daCapoOptWI);
			restartLoopSections(); 
			break;
		case "pluginDaCapo":
			console.log("pluginDaCapo: "+stringifyMenuItem(menuItem));
			let daCapo = new DaCapo();
			let daCapoOpt = {'amount':1, 'NamedNotes':true};
			daCapo.installHook(DaCapo.ON_SONG_END, daCapoOpt);
			restartLoopSections(); 
			break;
		case "disposeAllDockables":
			disposeAllDockables();
			EventBus.trigger('ReinstallAllTuningsTables');
			EventBus.trigger('UpdateAllWiringSelects');
			break;		
		case "dockAllDockables":
			dockAllDockables();
			break;		
		case "gatherAllDockables":
			gatherAllDockables();
			break;		
		case "clampAllDockablesToViewport":
			clampAllDockablesToViewport();
			break;		
		case "noAction":
			console.log("noAction=====!");
			actionResult.result = "none";
			break;
		
		default:
			break;
	}
	return actionResult;
}

function scrollToMessages(){
    var scrollDiv = document.getElementById("divMessageAndJsonTree").offsetTop;
    window.scrollTo({ top: scrollDiv, behavior: 'smooth'});
}
export function showMessagesJSON(json, preamble = ""){
	showMessages(preamble+json);
    const div = document.getElementById('divJsonTree');
	div.innerHTML = '';
	let data = JSON.parse(json);
	jsonTree(data, div);
}
export function showMessages(html){
    $("#divMessageAndJsonTree").show();
    $("#divMessages").show();
    $("#divMessages").html(html);
	showMessagesTab("Messages");
    hideCmdLine();
    scrollToMessages();
}
export function hideMessages(){
    $("#divMessages").hide();
	$("#divMessageAndJsonTree").hide();
}
function showGraveyard(){
    hideAllMenuDivs();
    showMessages(getSong().graveyard.buildGraveyardTable());
}
export function hideGraveyard(){
    $("#divMessages").hide();
}

function increaseUIFont(){
    ++m_FontSize;
    updateUIFont();
}
function decreaseUIFont(){
    --m_FontSize;
    updateUIFont();
}
function updateUIFont(){
    $("body").css({"font-size": (m_FontSize)+"pt"});
    updateFontLabel();
}
export function getUIFontSize(){
    return m_FontSize;
}
export function setUIFontSize(newValue){
    m_FontSize = newValue;
    updateUIFont();
}


function increaseNoteFont(){
    m_NoteFontSize += FONT_INCREMENT;
    updateNoteFont();
}
function decreaseNoteFont(){
    if (m_NoteFontSize > 0.5){ m_NoteFontSize -= FONT_INCREMENT; }
    updateNoteFont();
}
function updateNoteFont(){
    setOneCssVar("--named-note-font-size",""+m_NoteFontSize+"pt");
    updateFontLabel();
}

var m_FontSize = DEFAULT_FONT_SIZE;
export function getFontSize() {
	return m_FontSize;
}

var m_NoteFontSize = DEFAULT_NOTE_FONT_SIZE;

export function getNoteFontSize(){
    return m_NoteFontSize;
}
export function setNoteFontSize(newValue){
    m_NoteFontSize = newValue;
    updateNoteFont();
}




export function getValue(what){
	switch (what){
		case "currentSectionNumber":
		case "currentSectionIndex":
			return getSectionsCurrentIndex();
		case "currentSectionCardinal":
			return getSectionsCurrentIndex()+1;
		case "sectionCount":
			return getSong().sections.length;
		case "graveyardRecordCount":
			return getSong().graveyard.getRecordCount();
		case "beats":
		case "beatCount":
			return getCurrentSection().beats;
		case "currentBeat":
			return getCurrentSection().currentBeat;
		case "getBPM":
			return getBPM();
		case "getNamedNoteOpacity":
			var op = parseFloat(getSong().namedNoteOpacity);
			if (isNaN(op)){
				return "NaN";
			}
			return ""+(op*100);
        case "getSingleNoteOpacity":
            var op = parseFloat(getSong().singleNoteOpacity);
            if (isNaN(op)){
                return "NaN";
            }
            return ""+(op*100);
		case "getTinyNoteOpacity":
            var op = parseFloat(getSong().tinyNoteOpacity);
            if (isNaN(op)){
                return "NaN";
            }
            return ""+(op*100);
		case "getSongName":
			return getSong().songName;
		case "getSectionCaption":
			return getCurrentSection().caption;
		default:
            console.log("key-handler.js::getValue::no-value-found::default:"+what);
			return what;
	}
}

setMenuValueResolver(getValue);
setCmdActionRunner(performCmdAction);
