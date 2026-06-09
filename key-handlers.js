/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */
import { jsonTree } from './jsonTree80kg/json-tree-80kg.js';
import { setOneCssVar } from './themeFunctions.js';
import {
	clearCmdResults,
	hideCmdLine,
	setCmdLineMenuMode,
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
	sectionsLooping,
	restartLoopSections,
	toggleLoopBeats,
	toggleLoopSections,
	clearBeatAndSectionLooping
} from './looper.js';
import {
	buildChildMenuCaptionsRow,
	diveMenu,
	dumpMenus,
	gMenuFile,
	gMenuPointer,
	setMenuValueResolver,
	setMenuAtRoot,
	gMenuLoaded
} from './menu.js';
import {
	renderApprovedValuesReferenceHtml,
	resolveApprovedValue
} from './approved-values.js';
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
	showTransport,
	toggleSectionDrawer,
	toggleRandomLoop,
	setSectionKeysFlats,
	setSectionKeysSharps
} from './infinite-neck.js';
import EventBus from './event-bus.js';
import pluginManager from './plugins/pluginRuntime.js';

export { document_keydown, document_keypress, document_keyup, runActionByName };

let keyHandlerProviders = {};
let spacebarActionName = '';

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
function getTransportController(...args) { return requireProvider('getTransportController')(...args); }
function hideAllMenuDivs(...args) { return requireProvider('hideAllMenuDivs')(...args); }
function hideFullscreenLeadSheetLine(...args) { return requireProvider('hideFullscreenLeadSheetLine')(...args); }
function highlightOneNote(...args) { return requireProvider('highlightOneNote')(...args); }
function leaveFullscreen(...args) { return requireProvider('leaveFullscreen')(...args); }
function printSections(...args) { return requireProvider('printSections')(...args); }
function printSectionsNotes(...args) { return requireProvider('printSectionsNotes')(...args); }
function printSectionsOptions(...args) { return requireProvider('printSectionsOptions')(...args); }
function printSectionsChart(...args) { return requireProvider('printSectionsChart')(...args); }
function printSectionsLine(...args) { return requireProvider('printSectionsLine')(...args); }
function resetNoteNames(...args) { return requireProvider('resetNoteNames')(...args); }
function sectionChanged(...args) { return requireProvider('sectionChanged')(...args); }
function setBPM(...args) { return requireProvider('setBPM')(...args); }
function setNamedNoteOpacity(...args) { return requireProvider('setNamedNoteOpacity')(...args); }
function setSingleNoteOpacity(...args) { return requireProvider('setSingleNoteOpacity')(...args); }
function setTinyNoteOpacity(...args) { return requireProvider('setTinyNoteOpacity')(...args); }
function showAllNoteNames(...args) { return requireProvider('showAllNoteNames')(...args); }
function showInfoDialog(...args) { return requireProvider('showInfoDialog')(...args); }
function showOneMenu(...args) { return requireProvider('showOneMenu')(...args); }
function toggleCaption(...args) { return requireProvider('toggleCaption')(...args); }
function toggleFullscreen(...args) { return requireProvider('toggleFullscreen')(...args); }
function toggleInstrumentCaptionRow(...args) { return requireProvider('toggleInstrumentCaptionRow')(...args); }
function toggleRecording(...args) { return requireProvider('toggleRecording')(...args); }
function transpose(...args) { return requireProvider('transpose')(...args); }
function transposeSong(...args) { return requireProvider('transposeSong')(...args); }
function transposeSongKeys(...args) { return requireProvider('transposeSongKeys')(...args); }
function updateFontLabel(...args) { return requireProvider('updateFontLabel')(...args); }
function updateSectionsStatus(...args) { return requireProvider('updateSectionsStatus')(...args); }


const FONT_INCREMENT = 1;
const DEFAULT_FONT_SIZE = 10;  
const DEFAULT_NOTE_FONT_SIZE = 22;  // Keep in sync with infinite-neck.css :root --named-note-font-size: 22pt;  Here "pt" is glued on by code below.

function makeSyntheticMenuItem(actionName) {
	return {
		action: actionName,
		popOnBang: false
	};
}

function runActionByName(actionName, args) {
	if (!actionName) {
		return { result: '' };
	}
	return performCmdAction(makeSyntheticMenuItem(actionName), args);
}

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

function parkCommandLineAtPath(triggerPath = '') {
	setMenuAtRoot();
	let currentMenu = gMenuPointer;
	for (const trigger of `${triggerPath}`) {
		const children = currentMenu?.children || [];
		const childIdx = children.findIndex((child) => child && child.trigger === trigger);
		if (childIdx < 0) {
			throw new Error(`Command-line path not found: /${triggerPath}`);
		}
		const child = children[childIdx];
		diveMenu(child, childIdx);
		currentMenu = gMenuPointer;
	}
	clearCmdResults();
	$("#txtCmdLine").val('');
	showCmdLine();
	updateCmdLineView();
}

function isTextEditingTarget(target) {
	if (!target) {
		return false;
	}
	var tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
	return tagName === 'input'
		|| tagName === 'textarea'
		|| tagName === 'select'
		|| target.isContentEditable === true;
}

function isMappedSpacebarEvent(evt) {
	return Boolean(spacebarActionName)
		&& !isTextEditingTarget(evt?.target)
		&& (evt.key === ' ' || evt.key === 'Spacebar' || evt.code === 'Space');
}

function document_keydown(e) {
	if (isMappedSpacebarEvent(e)) {
		e.preventDefault();
		runActionByName(spacebarActionName);
	}
}


function document_keyup(evt) {
    if (evt.keyCode == 27) {  // ESC key
        leaveFullscreen();
        hideCmdLine();
        hideAllMenuDivs();
		$("#btnLoopSections").trigger('focus');
    }
}



function document_keypress(e) {
	if (isMappedSpacebarEvent(e)) {
		e.preventDefault();
		return;
	}

    var tag = e.target.tagName.toLowerCase();
	if (e.keyCode == 13 && tag != 'textarea') {
		e.preventDefault();
	}
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
				$("#cbAutomaticColor").trigger('click');
                break;
			case "C":
				try {
					parkCommandLineAtPath('fpc');
				} catch (error) {
					showMessages(`<pre>${error.message}</pre>`);
				}
				e.preventDefault();
				break;
            case "e":
                toggleWiringOpenState();
                break;
            case "f":
                toggleFullscreen();
                break;
			case "F":
                showOneMenu("#divFileControls");
                break;
            case "g":
                showOneMenu("#divTunings");
				EventBus.trigger('ReloadTuningsDisplays');
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
                toggleLoopSections();
                break;
            case "L":
                clearBeatAndSectionLooping();
                break;
            case "n":
            case "N":
                getSong().nextBeat();
                break;
			case "p":
                showOneMenu("#palette");
                break;
			case "P":
				try {
					parkCommandLineAtPath('fp');
				} catch (error) {
					showMessages(`<pre>${error.message}</pre>`);
				}
				e.preventDefault();
				break;
            case "q":
                $('#divQuick').toggle();
                break;
			case "r":
                showOneMenu("#divChart");
                break;
			case "s":
                toggleSectionDrawer();
                break;
			case "S":
				try {
					runActionByName('sectionAdd', {});
				} catch (error) {
					showMessages(`<pre>${error.message}</pre>`);
				}
				e.preventDefault();
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
				$("#rbFinger0").prop('checked', true);
                checkRB("#idRFinger0");
                break;
            case "1":
                //select radio button with value e.key, which will be one of 12345, with 5 representing "T".
				$("#rbFinger1").prop('checked', true);
                checkRB("#idRFinger1");
                break;
            case "2":
				$("#rbFinger2").prop('checked', true);
                checkRB("#idRFinger2");
                break;
            case "3":
				$("#rbFinger3").prop('checked', true);
                checkRB("#idRFinger3");
                break;
            case "4":
				$("#rbFinger4").prop('checked', true);
                checkRB("#idRFinger4");
                break;
            case "5":
				$("#rbFingerT").prop('checked', true);
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
				runActionByName('firstSection');
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

function check(id){
    $(id).prop("checked", true);
}

function checkAndTrigger(id){
    $(id).prop("checked", true).trigger('change');
}

// Called by the CmdMenu whenever someone has a string that identifies an "action".
export function performCmdAction(menuItem, args){
	var actionResult = {};
	actionResult.result = "";
	actionResult.menuItem = menuItem;
	actionResult.args = args;
	actionResult.popOnBang = false;
	actionResult.preserveMenuStack = false;

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
		case "removeUnusedTablesFromMemoryModel":
			getSong().removeUnusedTablesFromMemoryModel();
			break;
		case "downloadPlayedNotes":
			downloadPlayedNotes();
			break;
		case "downloadBackupThenClearGraveyard":
			downloadBackupThenClearGraveyard();
			break;
		case "setSongName":
			if (argByInputID){
				$("#txtFilename").val(argByInputID).trigger('change');
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
			Object.assign(actionResult, getTransportController().goFirstSection());
			break;
		case "prevSection":
			Object.assign(actionResult, getTransportController().prevSection());
			break;
		case "nextSection":
			Object.assign(actionResult, getTransportController().nextSection());
			break;
		case "lastSection":
			Object.assign(actionResult, getTransportController().lastSection());
			break;
		case "gotoSection":
			if (argByInputID){
				const targetSectionCardinal = toInt(argByInputID, 0);
				if (targetSectionCardinal > 0){
					Object.assign(actionResult, getTransportController().gotoSection(targetSectionCardinal - 1));
				}
			}
			break;
		case "gotoFirstBeat":
			Object.assign(actionResult, getTransportController().restartSection());
			break;
		case "gotoLastBeat": {
			Object.assign(actionResult, getTransportController().gotoLastBeat());
			break;
		}
		case "gotoLastBeatInSong": {
			Object.assign(actionResult, getTransportController().gotoLastBeatInSong());
			break;
		}
		case "gotoBeat":
			if (argByInputID){
				const targetBeat = toInt(argByInputID, 0);
				if (targetBeat > 0){
					Object.assign(actionResult, getTransportController().gotoBeat(targetBeat));
				}
			}
			break;
		case "resetSong":
			Object.assign(actionResult, getTransportController().resetSong(false));
			break;
		case "resetSongHard":
			Object.assign(actionResult, getTransportController().resetSong(true));
			break;
		case "mapSpacebar_firstSection":
			spacebarActionName = 'firstSection';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_prevSection":
			spacebarActionName = 'prevSection';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_nextSection":
			spacebarActionName = 'nextSection';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_lastSection":
			spacebarActionName = 'lastSection';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_nextBeat":
			spacebarActionName = 'nextBeat';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_prevBeat":
			spacebarActionName = 'prevBeat';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_gotoFirstBeat":
			spacebarActionName = 'gotoFirstBeat';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_gotoLastBeat":
			spacebarActionName = 'gotoLastBeat';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_gotoLastBeatInSong":
			spacebarActionName = 'gotoLastBeatInSong';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_restartSong":
			spacebarActionName = 'firstSection';
			actionResult.result = `spacebar mapped: restartSong using ${spacebarActionName}`;
			break;
		case "mapSpacebar_resetSong":
			spacebarActionName = 'resetSong';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_resetSongHard":
			spacebarActionName = 'resetSongHard';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_toggleLoopSections":
			spacebarActionName = 'toggleLoopSections';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_toggleLoopBeats":
			spacebarActionName = 'toggleLoopBeats';
			actionResult.result = `spacebar mapped: ${spacebarActionName}`;
			break;
		case "mapSpacebar_unsetSpacebarAction":
			spacebarActionName = '';
			actionResult.result = 'spacebar unmapped';
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
				Object.assign(actionResult, getTransportController().setBPM(argByInputID));
			}
			if (!argByInputID) {
				actionResult.result = getBPM();
			}
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
			Object.assign(actionResult, getTransportController().toggleLoopSections());
			break;
		case "toggleLoopBeats":
			Object.assign(actionResult, getTransportController().toggleLoopBeats());
			break;
		case "toggleRandomLoop":
			toggleRandomLoop();
			let rl = getSong().randomLoop ?  "RANDOM ON, " : "RANDOM OFF, ";
			let sl = sectionsLooping() ? "LOOP ON" : "LOOP OFF";
			actionResult.result = rl+sl;
			break;
		case "nextBeat":
			Object.assign(actionResult, getTransportController().nextBeat());
			break;
		case "prevBeat":
			Object.assign(actionResult, getTransportController().prevBeat());
			break;
		case "addBeat":
			addBeat();
			actionResult.result = ""+getCurrentSection().beats;
			break;
		case "deleteBeat":
			getSong().deleteBeat();
			actionResult.result = ""+getCurrentSection().beats;
			break;
        case "insertBeat":
			getSong().insertBeat(getSong().getBeat());
			actionResult.result = ""+getCurrentSection().beats;
			break;
		case "insertFirstBeat":
			getSong().insertFirstBeat();
			actionResult.result = ""+getCurrentSection().beats;
			break;
		case "showDialog-song":
			showOneMenu("#divFileControls");//file==song now.
			break;
		case "showDialog-info":
			showInfoDialog();
			break;
		case "showDialog-section":
			toggleSectionDrawer(true);
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
		case "toggleRecording":
			toggleRecording();
			actionResult.result = "REC toggled";
			break;
		case "parkTransport":
			showTransport(true);
			break;
		case "parkTransportTopRight":
			showTransport('top-right');
			break;
		case "viewFullscreen":
			enterFullscreen();
			hideCmdLine();
			break;
		case "toggleFullscreen":
			toggleFullscreen();
			break;
		case "setMenuPrefs":
			var c = args["key"];
			if (c == "s"){ //"short"
				gMenuFile.tall = false;
				setCmdLineMenuMode('short');
				actionResult.result = 'menu prefs: short';
			} else if (c == "t"){
				gMenuFile.tall = true;
				setCmdLineMenuMode('tall');
				actionResult.result = 'menu prefs: tall';
			} else if (c == "o"){
				gMenuFile.tall = false;
				setCmdLineMenuMode('one-line');
				actionResult.result = 'menu prefs: one-line';
			}
			break;
		case "cmdBackgroundOpacity":
			setOneCssVar("--cmd-menu-opacity", menuItem.name);
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
		case "showViewDiagnosticsVariables":
			showMessages(renderApprovedValuesReferenceHtml({ includeSamples: true }));
			actionResult.result = "Approved variables sent to Messages";
			break;
        case "showViewDiagnosticsSongFileFormat":
			showMessagesJSON(getPersistentSongFile());
			break;
        case "showViewDiagnosticsLogEvents":
			let obj = {};
			if (argByInputID){
				obj = JSON.parse(argByInputID);
			}
			actionResult.result = "EventBus logging: "+EventBus.setLogEvents(!EventBus.getLogEvents(), obj);
			break;
		case "showGraveyard":
			showGraveyard();
			break;
		case "hideViewMessages":
			$("#divMessageAndJsonTree").hide()
            $("#divMessages").hide();
            actionResult.result = "Messages hidden";
            break;
		case "reshowViewMessages":
			$("#divMessageAndJsonTree").show()
            $("#divMessages").show();
            actionResult.result = "Messages re-shown";
			hideCmdLine();
    		scrollToMessages();
            break;
		case "printSectionsDetails":
			printSections(true);
			hideCmdLine();
			break;
		case "printSectionsSummary":
			printSections(false);
			hideCmdLine();
			break;
		case "printSectionsNotes":
			printSectionsNotes();
			hideCmdLine();
			break;
		case "printSectionsOptions":
			printSectionsOptions();
			hideCmdLine();
			break;
		case "printSectionsChart":
			printSectionsChart();
			hideCmdLine();
			break;
		case "printSectionsLine":
			actionResult.result = printSectionsLine() || actionResult.result;
			hideCmdLine();
			break;
		case "hideFullscreenLeadSheetLine":
			actionResult.result = hideFullscreenLeadSheetLine() || actionResult.result;
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
		case "showAllNoteNames":
			showAllNoteNames(true);
			break;
		case "showNamedNotes":
			$("#cbHideNamedNotes").prop("checked", false).trigger('change');
			break;
		case "showSingleNotes":
			$("#cbHideSingleNotes").prop("checked", false).trigger('change');
			break;
		case "showTinyNotes":
			$("#cbHideTinyNotes").prop("checked", false).trigger('change');
			break;
		case "showFingering":
			$("#cbHideFingering").prop("checked", false).trigger('change');
			break;
		case "hideAllNoteNames":
			showAllNoteNames(false);
			break;
		case "hideNamedNotes":
			$("#cbHideNamedNotes").prop("checked", true).trigger('change');
			break;
		case "hideSingleNotes":
			$("#cbHideSingleNotes").prop("checked", true).trigger('change');
			break;
		case "hideTinyNotes":
			$("#cbHideTinyNotes").prop("checked", true).trigger('change');
			break;
		case "hideFingering":
			$("#cbHideFingering").prop("checked", true).trigger('change');
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
						checkAndTrigger("#idKeep");
						break;
					case "c":
						checkAndTrigger("#idClear");
						break;
					case "f":
						checkAndTrigger("#idDropper");
						break;
				}
			}
			break;
		case "selectRole":
			if (args) {
				switch (args["key"]) {
					case "t":
						checkAndTrigger("#idRTransparent");
						break;
					case "a":
						checkAndTrigger("#idRAutomatic");
						break;
					case "s":
						checkAndTrigger("#idRScale");
						break;
					case "r":
						checkAndTrigger("#idRRoot");
						break;
					case "c":
						checkAndTrigger("#idRChromatic");
						break;
					case "p":
						checkAndTrigger("#idRPassing");
						break;
					case "b":
						checkAndTrigger("#idRBass");
						break;
				}
			}
			break;
		case "selectRoleChord":
			if (args) {
				switch (args["key"]) {
					case "1":
						checkAndTrigger("#idRChord");
						break;
					case "2":
						checkAndTrigger("#idRChord2");
						break;
					case "3":
						checkAndTrigger("#idRChord3");
						break;
				}
			}
			break;
		case "selectRoleColornote":
			if (args) {
				switch (args["key"]) {
					case "1":
						checkAndTrigger("#idRColornote");
						break;
					case "2":
						checkAndTrigger("#idRColornote2");
						break;
					case "3":
						checkAndTrigger("#idRColornote3");
						break;
				}
			}
			break;
		case "selectRoleAvoid":
			if (args) {
				switch (args["key"]) {
					case "1":
						checkAndTrigger("#idRAvoid");
						break;
					case "2":
						checkAndTrigger("#idRAvoid2");
						break;
					case "3":
						checkAndTrigger("#idRAvoid3");
						break;
				}
			}
			break;
		case "selectRoleLead":
			if (args) {
				switch (args["key"]) {
					case "1":
						checkAndTrigger("#idRLead");
						break;
					case "2":
						checkAndTrigger("#idRLead2");
						break;
				}
			}
			break;		
		case "selectBendType":
			console.log("selectBendType: "+stringifyMenuItem(menuItem));
			$("#selBend").val(menuItem.name);
			$("#rbBend").prop("checked", true);
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
		case "pluginProperty:set":
		case "pluginProperty:toggle":
		case "pluginProperty:select":
		case "pluginAction:invoke":
		case "pluginAction:bury": {
			const pluginResult = pluginManager.invokeMenuAction(menuItem, args || {});
			actionResult.result = pluginResult.result || '';
			actionResult.preserveMenuStack = pluginResult.preserveMenuStack === true;
			if (pluginResult.messageJSON) {
				showMessagesJSON(pluginResult.messageJSON);
			} else if (pluginResult.message) {
				showMessages(pluginResult.message);
			}
			break;
		}
		
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
	if (what === 'spacebarActionName'){
		return spacebarActionName;
	}
	if (typeof what === 'string' && what.startsWith('plugin:')) {
		const pluginValue = pluginManager.resolveValue(what);
		if (pluginValue !== undefined) {
			return pluginValue;
		}
	}
	const resolved = resolveApprovedValue(what, { logUnknown: false });
	if (resolved !== undefined) {
		return resolved;
	}
	console.log("key-handler.js::getValue::no-value-found::default:"+what);
	return what;
}

setMenuValueResolver(getValue);
setCmdActionRunner(performCmdAction);
