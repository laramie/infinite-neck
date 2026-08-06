/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */
import { jsonTree } from './jsonTree80kg/json-tree-80kg.js';
import { 
	setOneCssVar, 
	dumpThemeIds 
} from './themeFunctions.js';
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
	sectionsLooping,
	toggleLoopSections,
	clearBeatAndSectionLooping
} from './looper.js';
import {
	buildChildMenuCaptionsRow,
	diveMenu,
	dumpMenus,
	gMenuFile,
	gMenuPointer,
	refreshRuntimeChildren,
	setMenuRuntimeChildrenResolver,
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
	showDisplayOptions,
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
import * as paletteUtils from './paletteUtils.js';
import {
	deleteSongMacro,
	getMacroIdValidationMessage,
	getSongMacro,
	getSongMacroIds,
	moveSongMacro,
	upsertSongMacro
} from './MacroExecutor.js';
import {
	configureMacroEngine,
	focusMacroOverlay,
	isAllowedDuringMacro,
	isInMacroAction,
	isMacroMutationLockActive,
	logMacro,
	parseMacroCallInput,
	runSongMacroById as runSongMacroByIdFromEngine,
	startSongMacroById
} from './MacroEngine.js';
import {
	TUTORIAL_MODES
} from './Tutorial.js';
export { document_keydown, document_keypress, document_keyup, runActionByName };

let keyHandlerProviders = {};
let spacebarActionName = '';
let sectionEditInstrumentTableID = '';
let macroVerbose = false;
let pendingMacroDeleteID = '';
const USER_LOG_MAX_ROWS = 1000;
const GRAVEYARD_CLEAR_BY_TYPE_ORDER = Object.freeze([
	'CLIP',
	'INSTRUMENT',
	'PLUGIN',
	'SECTION',
	'TUNING',
	'STYLESHEET'
]);

let graveyardClearByTypeState = {
	CLIP: false,
	INSTRUMENT: false,
	PLUGIN: false,
	SECTION: false,
	TUNING: false,
	STYLESHEET: false
};

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
function cycleThruKeys(...args) { return requireProvider('cycleThruKeys')(...args); }
function cycleThruNutWidths(...args) { return requireProvider('cycleThruNutWidths')(...args); }
function downloadBackupThenClearGraveyard(...args) { return requireProvider('downloadBackupThenClearGraveyard')(...args); }
function downloadBackupThenClearGraveyardByType(...args) { return requireProvider('downloadBackupThenClearGraveyardByType')(...args); }
function downloadPlayedNotes(...args) { return requireProvider('downloadPlayedNotes')(...args); }
function enterFullscreen(...args) { return requireProvider('enterFullscreen')(...args); }
function getBPM(...args) { return requireProvider('getBPM')(...args); }
function getCurrentSection(...args) { return requireProvider('getCurrentSection')(...args); }
function getPersistentSongFile(...args) { return requireProvider('getPersistentSongFile')(...args); }
function getSectionsCurrentIndex(...args) { return requireProvider('getSectionsCurrentIndex')(...args); }
function getSong(...args) { return requireProvider('getSong')(...args); }
function getTransportController(...args) { return requireProvider('getTransportController')(...args); }
function getDisplayOptionsClearState(...args) { return requireProvider('getDisplayOptionsClearState')(...args); }
function getDisplayOptionsSaveState(...args) { return requireProvider('getDisplayOptionsSaveState')(...args); }
function hideAllMenuDivs(...args) { return requireProvider('hideAllMenuDivs')(...args); }
function hideFullscreenLeadSheetLine(...args) { return requireProvider('hideFullscreenLeadSheetLine')(...args); }
function hideFullscreenChart(...args) { return requireProvider('hideFullscreenChart')(...args); }
function hideFullscreenAllCharts(...args) { return requireProvider('hideFullscreenAllCharts')(...args); }
function highlightOneNote(...args) { return requireProvider('highlightOneNote')(...args); }
function handleBtnControlsToDisplayOptions(...args) { return requireProvider('handleBtnControlsToDisplayOptions')(...args); }
function handleBtnDeleteDisplayOptions(...args) { return requireProvider('handleBtnDeleteDisplayOptions')(...args); }
function leaveFullscreen(...args) { return requireProvider('leaveFullscreen')(...args); }
function printSections(...args) { return requireProvider('printSections')(...args); }
function printSectionsInput(...args) { return requireProvider('printSectionsInput')(...args); }
function printSectionsNotes(...args) { return requireProvider('printSectionsNotes')(...args); }
function printSectionsOptions(...args) { return requireProvider('printSectionsOptions')(...args); }
function printSectionsChart(...args) { return requireProvider('printSectionsChart')(...args); }
function printSectionsLine(...args) { return requireProvider('printSectionsLine')(...args); }
function sectionChanged(...args) { return requireProvider('sectionChanged')(...args); }
function setPresentationMode(...args) { return requireProvider('setPresentationMode')(...args); }
function setTutorialMode(...args) { return requireProvider('setTutorialMode')(...args); }
function setNamedNoteOpacity(...args) { return requireProvider('setNamedNoteOpacity')(...args); }
function setSingleNoteOpacity(...args) { return requireProvider('setSingleNoteOpacity')(...args); }
function setTinyNoteOpacity(...args) { return requireProvider('setTinyNoteOpacity')(...args); }
function showAllNoteNames(...args) { return requireProvider('showAllNoteNames')(...args); }
function toggleShowAllNoteNames(...args) { return requireProvider('toggleShowAllNoteNames')(...args); }
function showInfoDialog(...args) { return requireProvider('showInfoDialog')(...args); }
function showMacroDialog(...args) { return requireProvider('showMacroDialog')(...args); }
function showOneMenu(...args) { return requireProvider('showOneMenu')(...args); }
function getMyTunings(...args) { return requireProvider('getMyTunings')(...args); }
function showTuning(...args) { return requireProvider('showTuning')(...args); }
function hideTuning(...args) { return requireProvider('hideTuning')(...args); }
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

function getTableBaseID(tableID){
	const text = `${tableID || ''}`;
	return text.startsWith('tbl') ? text.substring(3) : text;
}

function getSectionEditInstrumentOptions(){
	const song = getSong();
	if (!song || typeof song.getVisibleUnwiredTunings !== 'function') {
		return [];
	}
	return song.getVisibleUnwiredTunings().slice(0, 9).map((tuning, index) => {
		const tableID = `tbl${tuning.baseID}`;
		return {
			name: `sectionEditInstrument:${tableID}`,
			caption: `${index + 1}) ${tuning.baseID}`,
			trigger: `${index + 1}`,
			action: 'sectionEditInstrumentSelect',
			value: tableID,
			popOnBang: true
		};
	});
}

function resetGraveyardClearByTypeSelection() {
	graveyardClearByTypeState = {
		CLIP: false,
		INSTRUMENT: false,
		PLUGIN: false,
		SECTION: false,
		TUNING: false,
		STYLESHEET: false
	};
}

function toggleGraveyardClearType(typeName) {
	const normalized = `${typeName || ''}`;
	if (!GRAVEYARD_CLEAR_BY_TYPE_ORDER.includes(normalized)) {
		return false;
	}
	graveyardClearByTypeState[normalized] = !graveyardClearByTypeState[normalized];
	return graveyardClearByTypeState[normalized];
}

function getGraveyardSelectedTypes() {
	return GRAVEYARD_CLEAR_BY_TYPE_ORDER.filter((typeName) => graveyardClearByTypeState[typeName] === true);
}

function isSectionEditInstrumentStillAvailable(tableID = sectionEditInstrumentTableID){
	if (!tableID) {
		return false;
	}
	return getSectionEditInstrumentOptions().some((option) => option.value === tableID);
}

function getSectionEditInstrumentTableID(){
	return isSectionEditInstrumentStillAvailable() ? sectionEditInstrumentTableID : '';
}

function requireSectionEditInstrument(actionResult){
	const tableID = getSectionEditInstrumentTableID();
	if (tableID) {
		return tableID;
	}
	actionResult.result = 'no Instrument chosen';
	actionResult.suppressBang = true;
	actionResult.preventDive = true;
	return '';
}

function refreshSectionEditRuntimeChildren(menu){
	if (menu?.runtimeChildren !== 'sectionEditInstrument') {
		return null;
	}
	return getSectionEditInstrumentOptions();
}

function getMacroNumberOptions(actionName) {
	const song = getSong();
	return getSongMacroIds(song).slice(0, 9).map((macroId, index) => ({
		name: `${actionName}:${macroId}`,
		caption: `<b>${index + 1}</b>) ${macroId}`,
		trigger: `${index + 1}`,
		action: actionName,
		value: macroId,
		popOnBang: true
	}));
}

function getMacroDeleteNumberOptions() {
	const song = getSong();
	return getSongMacroIds(song).slice(0, 9).map((macroId, index) => ({
		name: `macroDeleteConfirm:${macroId}`,
		caption: `<b>${index + 1}</b>) ${macroId}`,
		trigger: `${index + 1}`,
		children: [
			{
				caption: `<b>Y</b>es: delete ${macroId}`,
				trigger: 'Y',
				action: 'macroDeleteConfirmed',
				value: macroId,
				popOnBang: true
			},
			{
				caption: '<b>n</b>o: keep macro',
				trigger: 'n',
				action: 'macroDeleteCancel',
				popOnBang: true
			}
		]
	}));
}

function getMacroMoveNumberOptions() {
	const song = getSong();
	return getSongMacroIds(song).slice(0, 9).map((macroId, index) => ({
		name: `macroMove:${macroId}`,
		caption: `<b>${index + 1}</b>) ${macroId}`,
		trigger: `${index + 1}`,
		action: 'macroMoveById',
		value: macroId,
		popOnBang: true,
		input: {
			type: 'input',
			caption: 'destination number',
			datatype: 'int',
			id: 'destination'
		}
	}));
}

function getMyTuningOptions(actionName) {
	const tunings = Array.isArray(getMyTunings()) ? getMyTunings() : [];
	return tunings.slice(0, 9).map((tuning, index) => ({
		name: `${actionName}:${tuning.baseID}`,
		caption: `<b>${index + 1}</b>) ${tuning.baseID}`,
		trigger: `${index + 1}`,
		action: actionName,
		value: tuning.baseID,
		popOnBang: true
	}));
}

function hasMyTuningBaseID(baseID) {
	const id = `${baseID || ''}`.trim();
	const tunings = Array.isArray(getMyTunings()) ? getMyTunings() : [];
	return tunings.some((tuning) => `${tuning?.baseID || ''}` === id);
}

function refreshMacroAndTuningRuntimeChildren(menu) {
	if (menu?.runtimeChildren === 'macroEditNumber') {
		return getMacroNumberOptions('macroEditById');
	}
	if (menu?.runtimeChildren === 'macroRunNumber') {
		return getMacroNumberOptions('macroRunById');
	}
	if (menu?.runtimeChildren === 'macroDeleteNumber') {
		return getMacroDeleteNumberOptions();
	}
	if (menu?.runtimeChildren === 'macroMoveNumber') {
		return getMacroMoveNumberOptions();
	}
	if (menu?.runtimeChildren === 'tuningShowList') {
		return getMyTuningOptions('showTuningById');
	}
	if (menu?.runtimeChildren === 'tuningHideList') {
		return getMyTuningOptions('hideTuningById');
	}
	return null;
}

function refreshRuntimeMenuChildren(menu) {
	return refreshSectionEditRuntimeChildren(menu)
		|| refreshMacroAndTuningRuntimeChildren(menu)
		|| null;
}

function setPluginToggleValueForMacro(menuItem, value) {
	const entry = pluginManager.getPluginEntry(menuItem.pluginId);
	if (!entry) {
		throw new Error(`Unknown plugin: ${menuItem.pluginId}`);
	}
	const pluginResult = pluginManager.setPropertyValue(entry, menuItem.propertyName, value);
	return { result: pluginResult.result || '' };
}

configureMacroEngine({
	addToUserLog,
	getSong,
	getValue,
	isMacroVerbose: () => macroVerbose,
	performCmdAction,
	refreshBeforePath: () => pluginManager.refreshPluginsMenuNode(),
	refreshRuntimeChildren,
	rootMenu: () => gMenuFile,
	setPluginToggleValueForMacro,
	showUserLog
});

export function runSongMacroById(macroId, options = {}) {
	return runSongMacroByIdFromEngine(macroId, options);
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
	// Ensure plugin runtime menu nodes are rebuilt for direct path entry (/fpoa, etc.)
	// so nested suggestion menus are not stale from prior sections/notes.
	pluginManager.refreshPluginsMenuNode();
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
	if (isMacroMutationLockActive()) {
		e.preventDefault();
		focusMacroOverlay();
		return;
	}
	if ((e.metaKey || e.ctrlKey) && e.shiftKey && `${e.key || ''}`.toLowerCase() === 'm' && getSong()?.tutorial?.level === 'strict') {
		showCmdLine();
		e.preventDefault();
		return;
	}
	if (isMappedSpacebarEvent(e)) {
		e.preventDefault();
		runActionByName(spacebarActionName);
	}
}


function document_keyup(evt) {
	if (isMacroMutationLockActive()) {
		evt.preventDefault();
		focusMacroOverlay();
		return;
	}
    if (evt.keyCode == 27) {  // ESC key
        leaveFullscreen();
        hideCmdLine();
        hideAllMenuDivs();
		$("#btnLoopSections").trigger('focus');
    }
}



function document_keypress(e) {
	if (isMacroMutationLockActive()) {
		e.preventDefault();
		focusMacroOverlay();
		return;
	}
	if (isMappedSpacebarEvent(e)) {
		e.preventDefault();
		return;
	}

    var tag = e.target.tagName.toLowerCase();
	if (e.keyCode == 13 && tag != 'textarea') {
		e.preventDefault();
	}
    if ( tag != 'input' && tag != 'textarea'){
		const strictTutorial = getSong()?.tutorial?.level === TUTORIAL_MODES.STRICT;
				
		if (strictTutorial && (!['n', 'b', 'B', ',', '.', '<', '>', 'h', 'H', 'w', 'W', 'l', 'L','0','-','=','_','+',')'].includes(e.key))){
			return;
		}
        switch (e.key){
            case "m":
            case "M":
                showCmdLine();
                e.preventDefault();
                break;
            case "/":
				// Rebuild runtime plugin menu nodes before entering command mode
				// so /fpoa starts with fresh tonal suggestions every time.
				pluginManager.refreshPluginsMenuNode();
                setMenuAtRoot();
                clearCmdResults();
                showCmdLine();
                var menu = gMenuPointer;
                buildChildMenuCaptionsRow(menu);
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
				getSong().prevBeat();
                break;
			case "B":
				getTransportController().toggleLoopBeats();
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

			case "E":
				//Using toggle() here is a stop-gap.  It works well, until you show one set in just one instrument, then the toggling of this gets instruments out of sync. Solution is to only click C and S toggle buttons when this is toggled into view.  Later, we'll sync all these behaviors up.  For now, it works if you just get all the instruments set how you want them and then toggle them off and on with this.
				$(".leftRailSectionStatusHost").toggle();//display:flex (hide seems to preserve this)
				$(".fretTableLeftCaption").toggle();//display:flex (hide seems to preserve this)
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
            case "I":
                showInfoDialog();
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
				getSong().nextBeat();
                break;
			case "N":
				getSong().addBeat();
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
			case "R":
                toggleRecording();
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
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#rbFinger0');
				paletteUtils.activateUiControl('#idRFinger0');
                break;
            case "1":
                //select radio button with value e.key, which will be one of 12345, with 5 representing "T".
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idRFinger1');
				paletteUtils.activateUiControl('#rbFinger1');
                break;
            case "2":
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idRFinger2');
				paletteUtils.activateUiControl('#rbFinger2');
                break;
            case "3":
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idRFinger3');
				paletteUtils.activateUiControl('#rbFinger3');
                break;
            case "4":
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idRFinger4');
				paletteUtils.activateUiControl('#rbFinger4');
                break;
            case "5":
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idRFingerT');
				paletteUtils.activateUiControl('#rbFingerT');
                break;
            case "6":
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idNamedNotes');
                break;
            case "7":
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idSingleNotes');
                break;
            case "8":
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idTinyNotes');
                break;
            case "9":
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#rbBend');
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
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idMidiPitches');
                break;
            case "]":
				paletteUtils.activateUiControl('#idPaletteModePaint');
				paletteUtils.activateUiControl('#idMidiPitchesSingle');
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
	actionResult.preserveMenuStack = false;

	if (menuItem.popOnBang){
		actionResult.popOnBang = true;
	}
	if (isMacroMutationLockActive() && !isAllowedDuringMacro(menuItem?.action)) {
		actionResult.result = `macro running: blocked action ${menuItem?.action || ''}`;
		actionResult.suppressBang = true;
		return actionResult;
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
		case "resetGraveyardClearByTypeSelection":
				resetGraveyardClearByTypeSelection();
				actionResult.preserveMenuStack = true;
				break;
		case "toggleGraveyardClearTypeCLIP":
		case "toggleGraveyardClearTypeINSTRUMENT":
		case "toggleGraveyardClearTypePLUGIN":
		case "toggleGraveyardClearTypeSECTION":
		case "toggleGraveyardClearTypeTUNING":
		case "toggleGraveyardClearTypeSTYLESHEET": {
				const typeName = menuItem.action.replace('toggleGraveyardClearType', '');
				const nextValue = toggleGraveyardClearType(typeName);
				actionResult.result = `${typeName}=${nextValue}`;
				actionResult.preserveMenuStack = true;
				break;
		}
		case "downloadBackupThenClearGraveyardByType": {
				const selectedTypes = getGraveyardSelectedTypes();
				if (selectedTypes.length === 0) {
					actionResult.result = 'no types selected';
					resetGraveyardClearByTypeSelection();
					break;
				}
				const clearResult = downloadBackupThenClearGraveyardByType(selectedTypes) || {};
				if (typeof clearResult === 'string') {
					actionResult.result = clearResult;
				} else {
					actionResult.result = clearResult.result || '';
				}
				resetGraveyardClearByTypeSelection();
				break;
		}
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
		case "clearBeatAndSectionLooping":
			clearBeatAndSectionLooping();
			actionResult.result = "Looping Stopped";
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
		case "macroAdd": {
			const macroId = `${argByInputID || ''}`.trim();
			const idError = getMacroIdValidationMessage(macroId);
			if (idError) {
				actionResult.result = idError;
				actionResult.suppressBang = true;
				break;
			}
			if (getSongMacro(getSong(), macroId)) {
				actionResult.result = `macro exists: ${macroId}`;
				actionResult.suppressBang = true;
				break;
			}
			upsertSongMacro(getSong(), macroId, []);
			showMacroDialog(macroId);
			actionResult.result = `added ${macroId}`;
			break;
		}
		case "macroEditById": {
			const macroId = `${menuItem.value || argByInputID || ''}`.trim();
			if (!getSongMacro(getSong(), macroId)) {
				actionResult.result = `macro not found: ${macroId}`;
				actionResult.suppressBang = true;
				break;
			}
			showMacroDialog(macroId);
			actionResult.result = `editing ${macroId}`;
			break;
		}
		case "macroRunById": {
			const macroId = `${menuItem.value || argByInputID || ''}`.trim();
			const macroResult = startSongMacroById(macroId);
			actionResult.result = macroResult.ok ? `running ${macroId}` : macroResult.error;
			actionResult.suppressBang = !macroResult.ok;
			break;
		}
		case "macroCall": {
			try {
				const parsedCall = parseMacroCallInput(argByInputID);
				const inMacroAction = isInMacroAction();
				const macroResult = inMacroAction
					? runSongMacroById(parsedCall.macroId, { callArgs: parsedCall.args })
					: startSongMacroById(parsedCall.macroId, { callArgs: parsedCall.args });
				actionResult.result = macroResult.ok
					? (inMacroAction ? `ran ${parsedCall.macroId}` : `running ${parsedCall.macroId}`)
					: macroResult.error;
				actionResult.suppressBang = !macroResult.ok;
				if (!macroResult.ok) {
					actionResult.macroExecutionError = macroResult.error;
				}
			} catch (error) {
				logMacro(`macroCall rejected: ${error.message}`);
				actionResult.result = error.message;
				actionResult.suppressBang = true;
				actionResult.macroExecutionError = error.message;
			}
			break;
		}
		case "macroListAll": {
			const list = getSongMacroIds(getSong());
			showMessages(list.join("<br>"));
			actionResult.result ="listed macros";
			break;
		}
		case "macroLog": {
			if (typeof argByInputID !== 'string') {
				actionResult.result = 'printf input must be a JSON string value';
				actionResult.suppressBang = true;
				actionResult.macroExecutionError = actionResult.result;
				break;
			}
			const message = `${argByInputID}`;
			if (macroVerbose) {
				logMacro(message);
				actionResult.result = `printf: ${message}`;
			} else {
				actionResult.result = 'printf skipped (macro verbose=false)';
			}
			break;
		}
		case "macroQueueDeleteById": {
			const macroId = `${argByInputID || ''}`.trim();
			if (!getSongMacro(getSong(), macroId)) {
				actionResult.result = `macro not found: ${macroId}`;
				actionResult.suppressBang = true;
				break;
			}
			pendingMacroDeleteID = macroId;
			actionResult.result = `confirm delete with /fmdY: ${macroId}`;
			break;
		}
		case "macroDeleteConfirmed": {
			const macroId = `${menuItem.value || pendingMacroDeleteID || ''}`.trim();
			if (!macroId) {
				actionResult.result = 'no macro delete pending';
				actionResult.suppressBang = true;
				break;
			}
			const deleted = deleteSongMacro(getSong(), macroId);
			pendingMacroDeleteID = '';
			actionResult.result = deleted ? `deleted ${macroId}` : `macro not found: ${macroId}`;
			actionResult.suppressBang = !deleted;
			break;
		}
		case "macroDeleteCancel":
			pendingMacroDeleteID = '';
			actionResult.result = 'delete canceled';
			break;
		case "macroMoveById": {
			const macroId = `${menuItem.value || ''}`.trim();
			const destinationText = `${argByInputID || ''}`.trim();
			if (!/^-?\d+$/.test(destinationText)) {
				actionResult.result = `destination must be a number: ${destinationText}`;
				actionResult.suppressBang = true;
				break;
			}
			const moveResult = moveSongMacro(getSong(), macroId, Number.parseInt(destinationText, 10));
			if (!moveResult.moved) {
				actionResult.result = moveResult.reason || `macro not moved: ${macroId}`;
				actionResult.suppressBang = true;
				break;
			}
			actionResult.result = `moved ${macroId} ${moveResult.from}→${moveResult.to}`;
			break;
		}
		case "toggleMacroVerbose":
			macroVerbose = !macroVerbose;
			actionResult.result = `macro verbose=${macroVerbose}`;
			break;
		case "showAllTunings": {
			const tunings = Array.isArray(getMyTunings()) ? getMyTunings() : [];
			tunings.forEach((tuning) => showTuning(tuning.baseID));
			actionResult.result = `shown ${tunings.length}`;
			break;
		}
		case "hideAllTunings": {
			const tunings = Array.isArray(getMyTunings()) ? getMyTunings() : [];
			tunings.forEach((tuning) => hideTuning(tuning.baseID));
			actionResult.result = `hidden ${tunings.length}`;
			break;
		}
		case "showTuningById": {
			const baseID = `${menuItem.value || argByInputID || ''}`.trim();
			if (!hasMyTuningBaseID(baseID)) {
				actionResult.result = `tuning not found: ${baseID}`;
				actionResult.suppressBang = true;
				break;
			}
			showTuning(baseID);
			actionResult.result = `shown ${baseID}`;
			break;
		}
		case "hideTuningById": {
			const baseID = `${menuItem.value || argByInputID || ''}`.trim();
			if (!hasMyTuningBaseID(baseID)) {
				actionResult.result = `tuning not found: ${baseID}`;
				actionResult.suppressBang = true;
				break;
			}
			hideTuning(baseID);
			actionResult.result = `hidden ${baseID}`;
			break;
		}
		case "selThemeById": {
			const songTheme = `${menuItem.value || argByInputID || ''}`.trim();
			$('#selThemes').val(songTheme).trigger('change');
			actionResult.result = `shown ${songTheme}`;
			break;
		}
		case "showThemeIds":
			showMessages(dumpThemeIds());
			break;
		case "viewFullscreen":
			enterFullscreen();
			hideCmdLine();
			break;
		case "toggleFullscreen":
			toggleFullscreen();
			break;
		case "setMenuPrefs":
			var c = args?.["key"];
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
		case "setPluginFiringOrder": {
			const normalizedOrder = pluginManager.setSongPluginFiringOrder(argByInputID || pluginManager.getPluginFiringOrderInput());
			actionResult.result = `plugin firing order [${normalizedOrder.join(',')}]`;
			actionResult.preserveMenuStack = true;
			break;
		}
		case "togglePresentationMode":
			setPresentationMode(!getSong()?.presentationMode);
			actionResult.result = `presentation mode: ${!!getSong()?.presentationMode}`;
			actionResult.preserveMenuStack = true;
			break;
		case "setTutorialMode": {
			const mode = setTutorialMode(menuItem.value || argByInputID || 'none');
			actionResult.result = `tutorial mode: ${mode}`;
			actionResult.preserveMenuStack = true;
			break;
		}
		case "saveViewDisplayOptions":
			handleBtnControlsToDisplayOptions();
			actionResult.result = `Display Options saved: ${getDisplayOptionsSaveState()}`;
			actionResult.preserveMenuStack = true;
			break;
		case "clearViewDisplayOptions":
			handleBtnDeleteDisplayOptions();
			actionResult.result = `Display Options cleared: ${getDisplayOptionsClearState()}`;
			actionResult.preserveMenuStack = true;
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
            showDisplayOptions();
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
		case "showUserLog":
			showUserLog();
			actionResult.result = "User Log shown";
			break;
		case "clearUserLog":
			clearUserLog();
			actionResult.result = "User Log cleared";
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
		case "printSectionsInput":
			printSectionsInput();
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
			actionResult.result = printSectionsChart() || actionResult.result;
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
		case "hideFullscreenChart":
			actionResult.result = hideFullscreenChart() || actionResult.result;
			hideCmdLine();
			break;
		case "hideFullscreenAllCharts":
			actionResult.result = hideFullscreenAllCharts() || actionResult.result;
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
		case "sectionEditInstrumentSelect":
			sectionEditInstrumentTableID = menuItem.value || '';
			actionResult.result = getTableBaseID(sectionEditInstrumentTableID);
			break;
		case "sectionEditInstrumentClone": {
			const tableID = requireSectionEditInstrument(actionResult);
			if (!tableID) {
				break;
			}
			const cloneResult = getSong().addCloneSectionForTable(tableID);
			if (cloneResult.cloned) {
				actionResult.result = `cloned ${getTableBaseID(tableID)}`;
			} else {
				actionResult.result = cloneResult.reason || `no notes for ${getTableBaseID(tableID)}`;
				actionResult.suppressBang = true;
			}
			break;
		}
		case "sectionEditInstrumentInsertIntoSection": {
			const tableID = requireSectionEditInstrument(actionResult);
			if (!tableID) {
				break;
			}
			const destSectionNumber = toInt(argByInputID, -1);
			if (destSectionNumber < 1) {
				actionResult.result = `invalid Section ${argByInputID}`;
				actionResult.suppressBang = true;
				break;
			}
			const insertResult = getSong().insertCloneTableIntoSection(tableID, destSectionNumber);
			if (insertResult.inserted) {
				actionResult.result = `inserted ${getTableBaseID(tableID)} into Section ${destSectionNumber}`;
			} else {
				actionResult.result = insertResult.reason || `not inserted ${getTableBaseID(tableID)}`;
				actionResult.suppressBang = true;
			}
			break;
		}
		case "sectionEditInstrumentClearGuard":
			requireSectionEditInstrument(actionResult);
			break;
		case "sectionEditInstrumentClear": {
			const tableID = requireSectionEditInstrument(actionResult);
			if (!tableID) {
				break;
			}
			const clearResult = getSong().clearCurrentSectionTable(tableID);
			if (clearResult.cleared) {
				actionResult.result = `cleared ${getTableBaseID(tableID)}`;
			} else {
				actionResult.result = clearResult.reason || `no table data for ${getTableBaseID(tableID)}`;
				actionResult.suppressBang = true;
				actionResult.popOnBang = false;
			}
			break;
		}
		case "sectionEditInstrumentClearKeep":
			actionResult.result = "kept";
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
		case "showSectionStatusLeft":
			$(".leftRailSectionStatusHost").show();//display:flex (hide seems to preserve this)
			break;
		case "showCaptionLeft":
			$(".fretTableLeftCaption").show();//display:flex (hide seems to preserve this)
			break;
		case "hideSectionStatusLeft":
			$(".leftRailSectionStatusHost").hide();
			break;
		case "hideCaptionLeft":
			$(".fretTableLeftCaption").hide();
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
		case "toggleShowAllNoteNames":
			toggleShowAllNoteNames();
			break;
		case "toggleNamedNotes":
			$("#cbHideNamedNotes").prop("checked", !($("#cbHideNamedNotes").prop("checked"))).trigger('change');
			break;
		case "toggleSingleNotes":
			$("#cbHideSingleNotes").prop("checked", !($("#cbHideSingleNotes").prop("checked"))).trigger('change');
			break;
		case "toggleTinyNotes":
			$("#cbHideTinyNotes").prop("checked", !($("#cbHideTinyNotes").prop("checked",))).trigger('change');
			break;
		case "toggleFingering":
			$("#cbHideFingering").prop("checked", !($("#cbHideFingering").prop("checked"))).trigger('change');
			break;
		case "selectFingering":
			if (args){
				paletteUtils.activatePaintModeIfSpecialSelected();
				switch (args["key"]){
					case "o":  //the letter o, for the Finger0, since 0 is used for the nut width keymap.
						paletteUtils.check("#rbFinger0");
						paletteUtils.checkAndTrigger("#idRFinger0");
						break;
					case "1":
					    paletteUtils.check("#rbFinger1");
						paletteUtils.checkAndTrigger("#idRFinger1");
						break;
					case "2":
					    paletteUtils.check("#rbFinger2");
					    paletteUtils.checkAndTrigger("#idRFinger2");
						break;
					case "3":
					    paletteUtils.check("#rbFinger3");
					    paletteUtils.checkAndTrigger("#idRFinger3");
						break;
					case "4":
					    paletteUtils.check("#rbFinger4");
					    paletteUtils.checkAndTrigger("#idRFinger4");
						break;
					case "5":
					    paletteUtils.check("#rbFingerT");
						paletteUtils.checkAndTrigger("#idRFingerT");
						break;
					case "t":
					    paletteUtils.check("#rbFingerT");
						paletteUtils.checkAndTrigger("#idRFingerT");
						break;
				}
			}
			break;
		case "selectRadioNoteType":
			if (args){
				switch (args["key"]){
					case "n":
						paletteUtils.activatePaintModeIfSpecialSelected();
					    paletteUtils.check("#idNamedNotes");
						break;
					case "s":
						paletteUtils.activatePaintModeIfSpecialSelected();
						paletteUtils.check("#idSingleNotes");
						break;
					case "t":
						paletteUtils.activatePaintModeIfSpecialSelected();
						paletteUtils.check("#idTinyNotes");
						break;
					case "b":
						paletteUtils.activatePaintModeIfSpecialSelected();
						paletteUtils.check("#rbBend");
						break;
					case "p":
						paletteUtils.activatePaintModeIfSpecialSelected();
						paletteUtils.check("#idMidiPitches");
						break;
					case "m":
						paletteUtils.activatePaintModeIfSpecialSelected();
						paletteUtils.check("#idMidiPitchesSingle");
						break;
					case "l":
						paletteUtils.check("#idPaletteModePaint");
						break;
					case "k":
						paletteUtils.checkAndTrigger("#idPaletteModeKeep");
						break;
					case "c":
						paletteUtils.checkAndTrigger("#idPaletteModeClear");
						break;
					case "f":
						paletteUtils.checkAndTrigger("#idPaletteModeDropper");
						break;
				}
			}
			break;
		case "selectRole":
			if (args) {
				paletteUtils.activatePaintModeIfSpecialSelected();
				switch (args["key"]) {
					case "t":
						paletteUtils.checkAndTrigger("#idRTransparent");
						break;
					case "a":
						paletteUtils.checkAndTrigger("#idRAutomatic");
						break;
					case "s":
						paletteUtils.checkAndTrigger("#idRScale");
						break;
					case "r":
						paletteUtils.checkAndTrigger("#idRRoot");
						break;
					case "c":
						paletteUtils.checkAndTrigger("#idRChromatic");
						break;
					case "p":
						paletteUtils.checkAndTrigger("#idRPassing");
						break;
					case "b":
						paletteUtils.checkAndTrigger("#idRBass");
						break;
				}
			}
			break;
		case "selectRoleChord":
			if (args) {
				paletteUtils.activatePaintModeIfSpecialSelected();
				switch (args["key"]) {
					case "1":
						paletteUtils.checkAndTrigger("#idRChord");
						break;
					case "2":
						paletteUtils.checkAndTrigger("#idRChord2");
						break;
					case "3":
						paletteUtils.checkAndTrigger("#idRChord3");
						break;
				}
			}
			break;
		case "selectRoleColornote":
			if (args) {
				paletteUtils.activatePaintModeIfSpecialSelected();
				switch (args["key"]) {
					case "1":
						paletteUtils.checkAndTrigger("#idRColornote");
						break;
					case "2":
						paletteUtils.checkAndTrigger("#idRColornote2");
						break;
					case "3":
						paletteUtils.checkAndTrigger("#idRColornote3");
						break;
				}
			}
			break;
		case "selectRoleAvoid":
			if (args) {
				paletteUtils.activatePaintModeIfSpecialSelected();
				switch (args["key"]) {
					case "1":
						paletteUtils.checkAndTrigger("#idRAvoid");
						break;
					case "2":
						paletteUtils.checkAndTrigger("#idRAvoid2");
						break;
					case "3":
						paletteUtils.checkAndTrigger("#idRAvoid3");
						break;
				}
			}
			break;
		case "selectRoleLead":
			if (args) {
				paletteUtils.activatePaintModeIfSpecialSelected();
				switch (args["key"]) {
					case "1":
						paletteUtils.checkAndTrigger("#idRLead");
						break;
					case "2":
						paletteUtils.checkAndTrigger("#idRLead2");
						break;
				}
			}
			break;		
		case "selectBendType":
			console.log("selectBendType: "+stringifyMenuItem(menuItem));
			$("#selBend").val(menuItem.name);
			paletteUtils.activatePaintModeIfSpecialSelected();
			paletteUtils.check("#rbBend");
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
		case "pluginProperty:selectByBaseID":
		case "pluginAction:invoke":
		case "pluginAction:audit":
		case "pluginAction:graveyardBury":
		case "pluginAction:graveyardSave":
		case "pluginAction:graveyardRaise":
		case "pluginAction:graveyardRaiseByKey":
		case "pluginAction:graveyardLink": {
			const pluginResult = pluginManager.invokeMenuAction(menuItem, args || {});
			actionResult.result = pluginResult.result || '';
			actionResult.preserveMenuStack = pluginResult.preserveMenuStack === true;
			if (pluginResult.messageJSON) {
				showMessagesJSON(pluginResult.messageJSON);
			} else if (pluginResult.message) {
				if (isQuietUserLogMessage(pluginResult.message)) {
					addToUserLog('PluginManager', pluginResult.message);
				} else {
					showMessages(pluginResult.message);
				}
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

function getUserLogTableBody(){
	if (typeof document === 'undefined') {
		return null;
	}

	const divUserLog = document.getElementById('divUserLog');
	if (!divUserLog) {
		return null;
	}

	let table = document.getElementById('tblUserLog');
	if (!table) {
		table = document.createElement('table');
		table.id = 'tblUserLog';
		const thead = document.createElement('thead');
		const headerRow = document.createElement('tr');
		['Time', 'SubSystem', 'Message'].forEach((caption) => {
			const th = document.createElement('th');
			th.textContent = caption;
			headerRow.appendChild(th);
		});
		thead.appendChild(headerRow);
		table.appendChild(thead);
		table.appendChild(document.createElement('tbody'));
		divUserLog.appendChild(table);
	}

	let tbody = table.querySelector('tbody');
	if (!tbody) {
		tbody = document.createElement('tbody');
		table.appendChild(tbody);
	}
	return tbody;
}

function getUserLogTime(){
	const now = new Date();
	return [now.getHours(), now.getMinutes(), now.getSeconds()]
		.map((value) => `${value}`.padStart(2, '0'))
		.join(':');
}

function isQuietUserLogMessage(message = '') {
	const text = `${message || ''}`.trim();
	return text.startsWith('#raise=');
}

export function addToUserLog(subSystem, message){
	const tbody = getUserLogTableBody();
	if (!tbody) {
		return false;
	}

	const row = document.createElement('tr');
	const timeCell = document.createElement('td');
	const subSystemCell = document.createElement('td');
	const messageCell = document.createElement('td');

	timeCell.textContent = getUserLogTime();
	subSystemCell.textContent = `${subSystem || ''}`;
	messageCell.innerHTML = `${message || ''}`;

	row.appendChild(timeCell);
	row.appendChild(subSystemCell);
	row.appendChild(messageCell);
	tbody.insertBefore(row, tbody.firstChild);

	while (tbody.rows.length > USER_LOG_MAX_ROWS) {
		tbody.deleteRow(tbody.rows.length - 1);
	}

	return true;
}

export function clearUserLog(){
	const tbody = getUserLogTableBody();
	if (tbody) {
		tbody.innerHTML = '';
	}
}

function showUserLog(){
	getUserLogTableBody();
	$("#divMessageAndJsonTree").show();
	showMessagesTab("UserLog");
	hideCmdLine();
	scrollToMessages();
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
	if (what === 'sectionEditInstrumentTableID'){
		return getSectionEditInstrumentTableID();
	}
	if (what === 'sectionEditInstrumentBaseID'){
		return getTableBaseID(getSectionEditInstrumentTableID());
	}
	if (what === 'sectionEditNextSectionCardinal'){
		return getSectionsCurrentIndex() + 2;
	}
	if (what === 'presentationModeState'){
		return !!getSong()?.presentationMode;
	}
	if (what === 'displayOptionsSaveState'){
		return getDisplayOptionsSaveState();
	}
	if (what === 'displayOptionsClearState'){
		return getDisplayOptionsClearState();
	}
	if (what === 'pluginFiringOrderDisplay') {
		return pluginManager.getPluginFiringOrderDisplay();
	}
	if (what === 'pluginFiringOrderInput') {
		return pluginManager.getPluginFiringOrderInput();
	}
	if (what === 'macroVerbose') {
		return `${macroVerbose}`;
	}
	if (what === 'graveyardClearByTypeCLIP') {
		return `${!!graveyardClearByTypeState.CLIP}`;
	}
	if (what === 'graveyardClearByTypeINSTRUMENT') {
		return `${!!graveyardClearByTypeState.INSTRUMENT}`;
	}
	if (what === 'graveyardClearByTypePLUGIN') {
		return `${!!graveyardClearByTypeState.PLUGIN}`;
	}
	if (what === 'graveyardClearByTypeSECTION') {
		return `${!!graveyardClearByTypeState.SECTION}`;
	}
	if (what === 'graveyardClearByTypeTUNING') {
		return `${!!graveyardClearByTypeState.TUNING}`;
	}
	if (what === 'graveyardClearByTypeSTYLESHEET') {
		return `${!!graveyardClearByTypeState.STYLESHEET}`;
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
	//console.log("key-handler.js::getValue::no-value-found::default:"+what);
	return what;
}

setMenuRuntimeChildrenResolver(refreshRuntimeMenuChildren);
setMenuValueResolver(getValue);
setCmdActionRunner(performCmdAction);
