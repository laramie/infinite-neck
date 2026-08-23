/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */


import * as Constants from './Constants.js';
import * as Globals from './globals.js';
import EventBus from './event-bus.js';
import {
	expandApprovedTemplate,
	setApprovedValueProviders
} from './approved-values.js';
import { parseAppActionFragment } from './app-action-fragment.js';
import {
	chuseStylesheet,
	applyStylesheetsTo_gUserColorDict,
	buildColorDicts,
	buildUserColors,
	setColorFunctionsProviders
} from './colorFunctions.js';
import {
	addCmdResults,
	hideCmdLine,
	toggleCmdLine,
	txtCmdLine_keydown,
	txtCmdLine_keypress,
	updateCmdLineView
} from './command-line.js';
import {
	setDisplayOptionsProviders,
	displayOptionsTable
} from './display-options.js';
import {
	draggable
} from './drag.js';
import {
	disposeAllDockables,
	makeDivDockable,
	isDivFloating,
	setDockCaptureHook,
	setDragEndCaptureHook,
	setZIndexCaptureHook,
	setHandleOrientationCaptureHook
} from './dockable.js';
import { 
	gPresentation, 
	PalettePresentation 
} from './presentation.js';
import {
	getFontSize,
	getUIFontSize,
	hideGraveyard,
	getNoteFontSize,
	runActionByName,
	
	setUIFontSize,
	setNoteFontSize,
	setKeyHandlerProviders,
	document_keydown,
	document_keypress,
	document_keyup
} from './key-handlers.js';
import { createChartInputController } from './ChartInput.js';
import {
	beatsLooping,
	restartLoopSections,
	sectionsLooping
} from './looper.js';
import './menu.js';
import {
	buildCellsFromSelector,
	cellBuilder,
	clearAll,
	clearHighlights,
	colorNote,
	fillChord,
	highlightOneNote,
	replay,
	setNotetableProviders,
	showHighlightsForBeat,
	fullRepaint
} from './NoteTableController.js';
import * as NoteTableRenderCache from './NoteTableRenderCache.js';
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
	installUserTheme,
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
	scrollToTop,
	toInt
} from './utils.js';
import {
	canonicalizeChordForStorage,
	canonicalizeModeForStorage
} from './plugins/chart/chart-tonal-resolver.js';
import { installFillPageSelects } from './fillPageSelectBuilder.js';

import { installLoopTimingModeControls } from './looper-timing-select-handler.js';
import * as SongLibrary from './SongLibrary.js';
import { escapeHtml, renderSongInstrumentBadges } from './InstrumentRoleBadges.js';

import * as WiringBuilder from './templates/WiringBuilder.js';
import { ThemesBuilder }  from './templates/themes.builder.js';
import { PaletteBuilder } from './templates/palette.builder.js';
import { InfoBuilder } from './templates/info/info.builder.js';
import { MobileKeyboardBuilder } from './templates/mobile-keyboard/mobile-keyboard.builder.js';
import { MacroBuilder } from './templates/macros/macros.builder.js';
import { SectionDrawerBuilder } from './templates/section-drawer.builder.js';
import { TransportBuilder } from './templates/transport.builder.js';
import { SectionStatusBuilder } from './templates/SectionStatus/section-status.builder.js';
import { TutorialPromptBuilder } from './templates/tutorial/tutorial.builder.js';
import {
	filterStrictLoopSectionIndex,
	getLoopCaptionModel,
	normalizeTutorialMode,
	readTutorialProgressFromStorage,
	TUTORIAL_MODES,
	toggleAllIncludeInLooping,
	toggleBookmarkSection,
	toggleDoneSection,
	toggleIncludeInLooping,
	writeTutorialProgressToStorage
} from './Tutorial.js';
import { setLoopSectionFilter } from './SongNavigationHooks.js';

import './plugins/registerPlugins.js';
import pluginManager from './plugins/pluginRuntime.js';
import { TransportController } from './transport-controller.js';
import { runMacroLine, runSongMacroById } from './MacroEngine.js';
import { Messages } from './Messages.js';
import { UserLog } from './UserLog.js';

// If running in a browser, call appInit() on DOM ready.  Browser loads DOM, then since index.html pulls in this module, this module is run after DOM loaded.  
// This top-level code runs first, which calls appInit().
if (typeof window !== 'undefined' && typeof $ !== 'undefined') {
	$(function() {
		if (typeof appInit === 'function') appInit();
	});
}

	
	const DEFAULT_BEATS_PER = 4;
	const DEFAULT_BPM = 80;
	const NOTE_TABLE_RENDER_CACHE_ENABLED = true;
	const NOTE_TABLE_RENDER_CACHE_TIMING_ENABLED = false;


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

	let gUrlMacroRunAttempted = false;
	let gFullscreenLeadSheetLineVisible = false;
	let gFullscreenChartVisible = false;
	let gCurrentSongLibraryHref = '';
	let gPendingSongLibraryHref = '';
	let chartInputController = null;
	export function getSong(){
		return Globals.getSong();
	}

	function getChartInputController() {
		if (!chartInputController) {
			chartInputController = createChartInputController({
				getSong,
				getSectionsCurrentIndex,
				linkToSectionChartChord,
				linkToSectionChartMode,
				createNewSectionAfterCurrent: createChartInputSectionAfterCurrent,
				firstSection: () => getTransportController().goFirstSection(),
				prevSection: () => getTransportController().prevSection(),
				nextSection: () => getTransportController().nextSection(),
				lastSection: () => getTransportController().lastSection()
			});
		}
		return chartInputController;
	}

	const transportController = new TransportController();
	export function getTransportController() {
		return transportController;
	}

	function refreshFileMenuSongInstrumentBadges() {
		const target = $('#fileMenuSongInstrumentBadges');
		if (target.length === 0 || !getSong() || typeof target.html !== 'function') {
			return;
		}
		target.html(renderSongInstrumentBadges(getSong(), { allowUnknown: true }));
	}

	export function copyApprovedPattern(name) {
		if (!name) {
			return;
		}
		const text = String(name).startsWith('${') ? String(name) : '${' + String(name) + '}';
		void navigator.clipboard.writeText(text);
	}

	export function copySongLink(songName) {
		const songPath = `${songName || ''}`.trim();
		if (!songPath || typeof window === 'undefined') {
			return;
		}
		const url = new URL(window.location.href);
		url.search = '';
		url.hash = '';
		url.searchParams.set('song', songPath);
		void navigator.clipboard.writeText(url.toString().replaceAll('%2F','/')); //safe to have song= have '/' and not '%2F' for slashes.
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
		setApprovedValueProviders({
			getBPM,
			getCurrentSection,
			getSectionsCurrentIndex,
			getSong,
			getRootKey: () => getCurrentSection().getRootKey(),
			getRootKeyLead: () => getCurrentSection().getRootKeyLead(),
			getTransposeCaptionValue: (tokenName) => {
				const plugin = pluginManager.getPluginById('transpose');
				if (!plugin || typeof plugin.getApprovedCaptionValue !== 'function') {
					return '';
				}
				return plugin.getApprovedCaptionValue(tokenName, {
					song: getSong(),
					section: getCurrentSection()
				});
			},
			getArpeggioCaptionValue: (tokenName) => {
				const plugin = pluginManager.getPluginById('arpeggio');
				if (!plugin || typeof plugin.getApprovedCaptionValue !== 'function') {
					return '';
				}
				return plugin.getApprovedCaptionValue(tokenName, {
					song: getSong(),
					section: getCurrentSection()
				});
			},
			getFillCaptionValue: (tokenName) => {
				const plugin = pluginManager.getPluginById('fill');
				if (!plugin || typeof plugin.getApprovedCaptionValue !== 'function') {
					return '';
				}
				return plugin.getApprovedCaptionValue(tokenName, {
					song: getSong(),
					section: getCurrentSection()
				});
			},
			getTonalCaptionValue: (tokenName) => {
				const plugin = pluginManager.getPluginById('tonal');
				if (!plugin || typeof plugin.getApprovedCaptionValue !== 'function') {
					return '';
				}
				return plugin.getApprovedCaptionValue(tokenName, {
					song: getSong(),
					section: getCurrentSection()
				});
			}
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
			cycleThruKeys,
			cycleThruNutWidths: (...args) => cycleThruNutWidths(...args),
			downloadBackupThenClearGraveyard,
			downloadBackupThenClearGraveyardByType,
			downloadPlayedNotes,
			enterFullscreen,
			fixDockableHandlesIfFullscreen,
			getBPM,
			getCurrentSection,
			getDisplayOptionsClearState,
			getDisplayOptionsSaveState,
			getPersistentSongFile,
			getSectionsCurrentIndex,
			getSong,
			getTransportController,
			hideAllMenuDivs,
			hideFullscreenLeadSheetLine,
			hideFullscreenChart,
			hideFullscreenAllCharts,
			handleBtnControlsToDisplayOptions,
			handleBtnDeleteDisplayOptions,
			highlightOneNote,
			leaveFullscreen,
			printSections,
			printSectionsInput,
			printSectionsNotes,
			printSectionsOptions,
			printSectionsChart,
			printSectionsLine,
			sectionChanged,
			setPresentationMode,
			setTutorialMode,
			setNamedNoteOpacity,
			setSingleNoteOpacity,
			setTinyNoteOpacity,
			showAllNoteNames,
			toggleShowAllNoteNames,
			showInfoDialog,
			showMacroDialog,
			showOneMenu,
			getMyTunings: TuningsLibrary.getMyTunings,
			showTuning: TuningsLibrary.showTuning,
			hideTuning: TuningsLibrary.hideTuning,
			toggleFullscreen,
			toggleRecording,
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
			fullRepaint,
			displayOptionsChanged: refreshDisplayOptionsSaveActionRequired
		});
		transportController.setProviders({
			getBPM,
			getCurrentSection,
			getSectionsCurrentIndex,
			getSong,
			replayCurrentSectionView,
			setBPM,
			syncSectionUi
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

	export function setPresentationMode(shouldAutomate){
		if (!getSong()){
			return;
		}
		getSong().presentationMode = !!shouldAutomate;
		$("#cbPresentationMode").prop("checked", !!getSong().presentationMode).trigger('change');
	}

	export function setTutorialMode(mode){
		if (!getSong()){
			return TUTORIAL_MODES.NONE;
		}
		const normalizedMode = normalizeTutorialMode(mode);
		const existingTutorial = getSong().tutorial && typeof getSong().tutorial === 'object' ? getSong().tutorial : {};
		getSong().tutorial = {
			...existingTutorial,
			level: normalizedMode
		};
		sectionChanged();
		resetTutorialChrome();
		return normalizedMode;
	}

	export function resetTutorialChrome(){
		//reset it either direction.
		if (isStrictTutorial()){
			$('#divTopCaptions').hide();
			$(".dockable-handle").hide();
			$('#topControlsCaptions').hide();
			$('.captionRow').hide();
			$('#transport').hide();
			setWiringOpenState(false); 
			PalettePresentation.lockKeep();
			$("td.note").css({"cursor": "no-drop"});
			$(".leftRailSectionStatusHost").hide();
			$(".fretTableLeftCaption").hide();
		} else {
			$('#divTopCaptions').show();
			$(".dockable-handle").show();
			$('#topControlsCaptions').show();
			//leave off for now.  You can always turn them on with SHIFT+A
			//    $('.captionRow').show();
			$('#transport').show();
			PalettePresentation.unlockKeep();
			$("td.note").css({"cursor": "pointer"});
		}
	}

	const tutorialRuntimeState = {
		song: null,
		progress: null,
		includeInLoopingSectionIndexes: null,
		lessonSectionListOpen: false,
		hamburgerControlsOpen: true
	};

	function getTutorialStorageEntry(song = getSong()){
		return {
			...song,
			href: gCurrentSongLibraryHref || $("#txtFilename").val() || song?.songName || '',
			SectionCount: Array.isArray(song?.sections) ? song.sections.length : 0
		};
	}

	function getTutorialFallbackStorageEntry(song = getSong()){
		const fallbackHref = $("#txtFilename").val() || song?.songName || '';
		if (!fallbackHref || !gCurrentSongLibraryHref || fallbackHref === gCurrentSongLibraryHref){
			return null;
		}
		return {
			...song,
			href: fallbackHref,
			SectionCount: Array.isArray(song?.sections) ? song.sections.length : 0
		};
	}

	function hasTutorialProgress(progress = {}){
		return Array.isArray(progress.doneSectionIndexes) && progress.doneSectionIndexes.length > 0
			|| progress.bookmarkSectionIndex !== null;
	}

	function resetTutorialRuntimeForSongIfNeeded(song = getSong()){
		if (tutorialRuntimeState.song === song){
			return;
		}
		tutorialRuntimeState.song = song;
		tutorialRuntimeState.progress = null;
		tutorialRuntimeState.includeInLoopingSectionIndexes = null;
		tutorialRuntimeState.lessonSectionListOpen = false;
		tutorialRuntimeState.hamburgerControlsOpen = true;
		resetTutorialChrome();
	}

	function getTutorialProgress(){
		const song = getSong();
		resetTutorialRuntimeForSongIfNeeded(song);
		if (!tutorialRuntimeState.progress){
			const storageEntry = getTutorialStorageEntry(song);
			let progress = readTutorialProgressFromStorage(storageEntry);
			if (!hasTutorialProgress(progress)){
				const fallbackStorageEntry = getTutorialFallbackStorageEntry(song);
				if (fallbackStorageEntry){
					const fallbackProgress = readTutorialProgressFromStorage(fallbackStorageEntry);
					if (hasTutorialProgress(fallbackProgress)){
						progress = writeTutorialProgressToStorage(storageEntry, fallbackProgress);
					}
				}
			}
			tutorialRuntimeState.progress = progress;
		}
		return tutorialRuntimeState.progress;
	}

	function saveTutorialProgress(progress){
		tutorialRuntimeState.progress = writeTutorialProgressToStorage(getTutorialStorageEntry(), progress);
		return tutorialRuntimeState.progress;
	}

	function renderTutorialPrompt(){
		const song = getSong();
		resetTutorialRuntimeForSongIfNeeded(song);
		return TutorialPromptBuilder.renderToDest({
			song,
			currentSectionIndex: getSectionsCurrentIndex(),
			progress: getTutorialProgress(),
			includeInLoopingSectionIndexes: tutorialRuntimeState.includeInLoopingSectionIndexes,
			lessonSectionListOpen: tutorialRuntimeState.lessonSectionListOpen,
			hamburgerControlsOpen: tutorialRuntimeState.hamburgerControlsOpen
		});
	}

	function refreshTutorialLoopCaption(){
		if (!sectionsLooping()){
			return;
		}
		const sectionCount = getSong()?.getSections?.().length || 0;
		showLoopSectionsStarted({
			caption: getLoopCaptionModel({
				looping: true,
				includeInLoopingSectionIndexes: tutorialRuntimeState.includeInLoopingSectionIndexes || [],
				sectionCount
			})
		});
	}

	export function tutorialToggleHamburgerControls(){
		resetTutorialRuntimeForSongIfNeeded(getSong());
		tutorialRuntimeState.hamburgerControlsOpen = !tutorialRuntimeState.hamburgerControlsOpen;
		renderTutorialPrompt();
	}

	export function tutorialToggleSectionList(){
		resetTutorialRuntimeForSongIfNeeded(getSong());
		tutorialRuntimeState.lessonSectionListOpen = !tutorialRuntimeState.lessonSectionListOpen;
		renderTutorialPrompt();
	}

	export function tutorialGotoSection(sectionIndex){
		linkToSection(sectionIndex);
	}

	export function tutorialToggleDone(sectionIndex){
		const sectionCount = getSong()?.getSections?.().length || 0;
		saveTutorialProgress(toggleDoneSection(getTutorialProgress(), sectionIndex, sectionCount));
		renderTutorialPrompt();
	}

	export function tutorialToggleBookmark(sectionIndex){
		const sectionCount = getSong()?.getSections?.().length || 0;
		saveTutorialProgress(toggleBookmarkSection(getTutorialProgress(), sectionIndex, sectionCount));
		renderTutorialPrompt();
	}

	export function tutorialToggleIncludeInLooping(sectionIndex){
		const sectionCount = getSong()?.getSections?.().length || 0;
		tutorialRuntimeState.includeInLoopingSectionIndexes = toggleIncludeInLooping(tutorialRuntimeState.includeInLoopingSectionIndexes, sectionIndex, sectionCount);
		renderTutorialPrompt();
		refreshTutorialLoopCaption();
	}

	export function tutorialToggleAllIncludeInLooping(){
		const sectionCount = getSong()?.getSections?.().length || 0;
		tutorialRuntimeState.includeInLoopingSectionIndexes = toggleAllIncludeInLooping(tutorialRuntimeState.includeInLoopingSectionIndexes, sectionCount);
		renderTutorialPrompt();
		refreshTutorialLoopCaption();
	}
	export function tutorialNextSection(){
		runActionByName('nextSection');
	}
	export function tutorialPrevSection(){
		runActionByName('prevSection');
	}
	export function tutorialFirstSection(){
		runActionByName('firstSection');
	}
	export function tutorialLastSection(){
		runActionByName('lastSection');
	}
	export function tutorialLoopBeats(){
		runActionByName('toggleLoopBeats');
	}
	export function tutorialLoopSections(){
		runActionByName('toggleLoopSections');
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

	let defaultDisplayOptionsForNavigation = null;
	let displayOptionsDirtyBaseline = null;

	function cloneDisplayOptions(options){
		if (!options || typeof options !== 'object') {
			return {};
		}
		return JSON.parse(JSON.stringify(options));
	}

	function ensureDefaultDisplayOptionsForNavigation(){
		if (!defaultDisplayOptionsForNavigation) {
			defaultDisplayOptionsForNavigation = cloneDisplayOptions(controlsToDisplayOptions());
		}
		return cloneDisplayOptions(defaultDisplayOptionsForNavigation);
	}

	function captureDisplayOptionsNavigationDefault(){
		defaultDisplayOptionsForNavigation = cloneDisplayOptions(controlsToDisplayOptions());
		return ensureDefaultDisplayOptionsForNavigation();
	}

	function setDisplayOptionsSaveActionRequired(isRequired){
		$('#btnControlsToDisplayOptions_View').toggleClass('riskyButtonActionRequired', !!isRequired);
	}

	export function updateDisplayOptionsReadonlyValues(options = null){
		const values = options || controlsToDisplayOptions();
		$('#viewDisplayOptionAutoColorValue').text(String(!!values.autoColor));
		$('#viewDisplayOptionCurrentColorDictValue').text(values.currentColorDict || '');
		
		let displayOptionsTheme = values.sectionTheme||'';
		let storedDisplayOptions = getSong().getCurrentSection().displayOptions;
		let storedTheme = (storedDisplayOptions?.sectionTheme)||'';
		let showTheme;
		if (storedTheme === displayOptionsTheme){
			showTheme = `${storedTheme}`;
		} else {
			showTheme = `${storedTheme} <s>${displayOptionsTheme}</s>`;
		}
		$('#viewDisplayOptionCurrentSectionTheme').html(showTheme || '');
	}

	function captureDisplayOptionsDirtyBaseline(){
		displayOptionsDirtyBaseline = cloneDisplayOptions(controlsToDisplayOptions());
		updateDisplayOptionsReadonlyValues(displayOptionsDirtyBaseline);
		setDisplayOptionsSaveActionRequired(false);
	}

	function areDisplayOptionsEqual(left, right){
		return JSON.stringify(left || {}) === JSON.stringify(right || {});
	}

	function refreshDisplayOptionsSaveActionRequired(){
		if (!displayOptionsDirtyBaseline) {
			captureDisplayOptionsDirtyBaseline();
			return;
		}
		const currentOptions = controlsToDisplayOptions();
		updateDisplayOptionsReadonlyValues(currentOptions);
		setDisplayOptionsSaveActionRequired(!areDisplayOptionsEqual(currentOptions, displayOptionsDirtyBaseline));
	}

	export function getDisplayOptionsSaveState(){
		if (!getSong() || !getCurrentSection()) {
			return 'none';
		}
		if (displayOptionsDirtyBaseline && !areDisplayOptionsEqual(controlsToDisplayOptions(), displayOptionsDirtyBaseline)) {
			return 'unsaved';
		}
		return getCurrentSection().displayOptions ? 'saved' : 'none';
	}

	export function getDisplayOptionsClearState(){
		if (!getSong() || !getCurrentSection()) {
			return 'none';
		}
		return getCurrentSection().displayOptions ? 'present' : 'none';
	}

	function syncSectionUi(){
		const defaultDisplayOptions = ensureDefaultDisplayOptionsForNavigation();
		var options = getSong().getDisplayOptionsInEffect(getCurrentSection(), defaultDisplayOptions);
		if (options){
			displayOptionsToControls(cloneDisplayOptions(options));
		}
		showHideDisplayOptionsPresent();
		SectionDrawerBuilder.sectionChanged();
		renderTutorialPrompt();
		captureDisplayOptionsDirtyBaseline();
	}

	export function sectionChanged(){
		syncSectionUi();
		clearAndReplaySection();
		// Refresh plugin menus so that Tonal datalables/suggestions are current when user navigates to /fpoa, etc.
		pluginManager.refreshPluginsMenuNode();
		if (NOTE_TABLE_RENDER_CACHE_ENABLED) {
			EventBus.trigger('NoteTableCache:prewarmNextSection', {
				currentSectionIndex: getSectionsCurrentIndex(),
				reason: 'sectionChanged'
			});
		}
		if (isStrictTutorial()){
			turnOnKeep();
			$("td.note").css({"cursor": "no-drop"});
		}
	}

	export function updateSectionsStatus(){
		if (getSong().isHeadless){
            return;
        }
	    var rawCaption = getSong().getCurrentSection().caption;
		var caption = expandApprovedTemplate(rawCaption);
	    $(".lblSectionCaption").html(caption);

		var pluginWidgets = expandApprovedTemplate("${fillPositionsStatus} &nbsp;&nbsp;&nbsp; ${arpeggioPositionsStatus} &nbsp;&nbsp;&nbsp; ${transposeIntervalsStatus} ${transposeProgressionFunctionDistances}");
	    $(".lblLeadSheetWidgets").html(pluginWidgets);

		const chartOptions = getSong().chartOptions || {};
		const currentSection = getSong().getCurrentSection();
		const displayChartChord = SectionPrinter.getChartDisplayValue(currentSection.chartChord, 'chord', chartOptions, { section: currentSection });
		const displayChartMode = SectionPrinter.getChartDisplayValue(currentSection.chartMode, 'mode', chartOptions, { section: currentSection });
	    $(".lblSectionChartChord").html(displayChartChord);
	    $(".lblSectionMode").html(displayChartMode);

		var currentFilename = getSong().songName;
		if (currentFilename === undefined || currentFilename === null || currentFilename === '') {
			currentFilename = $("#txtFilename").val();
		}
	    $(".lblSongName").html(currentFilename);

		var rootIndex = toInt(getSong().getCurrentSection().rootID, 0);
	    var rootIndexLead = toInt(getSong().getCurrentSection().rootIDLead, 0);
		var keyname = getSong().noteIDToNoteName(rootIndex);
		var keynameLead = getSong().noteIDToNoteName(rootIndexLead);

		
		//This is in Instrument Caption row:
		var spans = $(".spanLeadDifferentFromRoot");
	    
		//These are in Transport:
	    $("#lblBeats").html(getSong().getBeats());
		$("#lblBeat").html(String(getSong().getBeat()));
		
		var txt = ""+(getSong().getSectionsCurrentIndex()+1)+"/"+ getSong().sections.length;
	    $("#lblSectionsStatus").html(txt);
	    $("#lblSectionsStatusChartInput").html(txt);
		
		// .lblRootID and .lblRootIDLead have controls in 
		//     Fill, Transport, and Song Caption:
	    $(".lblRootID").html(keyname);
		let leadKeyValue = "";
		if (getSong().getCurrentSection().rootIDLead != "-1"){
	        spans.html(keynameLead);
	        spans.show();
	        $(".lblRootIDLead").html(keynameLead).addClass("lblRootIDLead_active");
			leadKeyValue = keynameLead;
	    } else {
          spans.hide();
          $(".lblRootIDLead").html("&nbsp;").removeClass("lblRootIDLead_active");
	    }

		const showBeatCounter = $("#cbShowLooperLightBeats").prop("checked");
		const sectionNumber = getSong().getSectionsCurrentIndex() + 1;
		const currentBeat = getSong().getBeat();
		const isLoopActive = sectionsLooping() || beatsLooping();

		emitSectionStatusBeatUpdate();

		EventBus.trigger('Widget:SectionStatus:statusChanged', {
			ownerID: 'leadsheet',
			placementID: 'leadSheet',
			rootKey: keyname,
			rootKeyLead: leadKeyValue,
		});

		showHideDisplayOptionsPresent();  //also calls SectionDrawerBuilder API.
		updatePrintSections();
	}

	function emitSectionStatusBeatUpdate(){
		if (getSong().isHeadless){
			return;
		}
		const song = getSong();
		const showBeatCounter = $("#cbShowLooperLightBeats").prop("checked");
		const isLoopActive = sectionsLooping() || beatsLooping();

		const visibleTables = (typeof song.getVisibleTunings === 'function')
			? song.getVisibleTunings()
			: [];

		visibleTables.forEach((tableID) => {
			const wiring = Array.isArray(song.wirings)
				? song.wirings.find((w) => w && w.tablename === tableID)
				: null;
			const relativeSpec = `${wiring?.relativeSection || ''}`.trim();
			if (relativeSpec) {
				const relativeSection = song.getRelativeSectionWithWrap(relativeSpec);
				const relativeSectionIndex = song.getSections().indexOf(relativeSection);
				EventBus.trigger('Widget:SectionStatus:statusChanged', {
					ownerID: tableID,
					sectionNumber: (relativeSectionIndex >= 0) ? relativeSectionIndex + 1 : '',
					beatNumber: relativeSection?.currentBeat ?? '',
					showBeatCounter,
					isLoopActive
				});
				return;
			}

			EventBus.trigger('Widget:SectionStatus:statusChanged', {
				ownerID: tableID,
				sectionNumber: song.getSectionsCurrentIndex() + 1,
				beatNumber: song.getBeat(),
				showBeatCounter,
				isLoopActive
			});
		});

		EventBus.trigger('Widget:SectionStatus:statusChanged', {
			ownerID: 'leadsheet',
			placementID: 'leadSheet',
			sectionNumber: song.getSectionsCurrentIndex() + 1,
			beatNumber: song.getBeat(),
			showBeatCounter,
			isLoopActive
		});
	}

	export function clearAndReplaySection(){
		getSong().gotoFirstBeat();
		replayCurrentSectionView();
	}

	export function replayCurrentSectionView(){
		clearAll();
		resetNoteNames(); //calls replay()
		updateSectionsStatus();
		showBeats();
		//prevSection calls this: updateSectionsStatus();
	}

	export function showBeats(){
		var beat = getSong().getBeat();
		$("#lblBeat").html(""+beat);
		emitSectionStatusBeatUpdate();
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

	
	function hideMessages_KeyHandler(){
		Messages.hideMessages();
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
					visibleTableIds.forEach(tableID => {
						NoteTableController.buildCellsForTable(sharps, options, `#${tableID}`)
				resetSharpsControls
			resetFlats(options)
				buildCells
					visibleTableIds.forEach(tableID => {
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
		options.pianoHeightScaleFactor = toInt($('#selPianoHeightScaleFactor').val(), 3);
		options.pianoWidthScaleFactor = toInt($('#selPianoWidthScaleFactor').val(), 3);
		options.pianoWhiteToBlackWidthRatio = $('#selPianoWhiteToBlackWidthRatio').val() || '2.3';
		options.pianoFingeringHPosition = $('#selPianoFingeringHPosition').val() || '50%';

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
		let visibleTableIds = updateVisibleTablesInMemoryModel();
		visibleTableIds.forEach(tableID => {
		    buildCellsForTable(sharps, options, tableID);
		});
	}
	export function buildCellsForTable(sharps, options, tableID=""){
		let tableID_prefix = "";
		if (tableID){
			tableID_prefix = '#'+tableID + ' ';
		}
		options = checkOptionsForToolTables(tableID, options);

		const timingStart = getNoteTableTimingNow();
		const noteNamesFuncArr = Array.isArray(options.noteNamesFuncArr)
			? options.noteNamesFuncArr
			: getSong()?.noteNamesFuncArr;
		const tuning = tableID ? TuningsLibrary.findTuningForName(tableID) : null;
		const renderCacheKey = (NOTE_TABLE_RENDER_CACHE_ENABLED && tableID)
			? NoteTableRenderCache.buildRenderKey({ tableID, options, tuning, noteNamesFuncArr })
			: '';
		const renderCacheEntry = renderCacheKey ? NoteTableRenderCache.get(renderCacheKey) : null;
		let selectorCount = 0;

		NoteTableRenderCache.getNoteClassSpecs(sharps).forEach((spec) => {
			selectorCount++;
			buildCellsFromSelector(
				tableID_prefix+`td.${spec.noteClass}`,
				spec.noteLetter,
				spec.sharpflat,
				spec.noteNum,
				options,
				renderCacheEntry,
				spec.noteClass
			);
		});
		dumpNoteTableTiming('buildCellsForTable', {
			tableID: tableID || '(all tables)',
			durationMs: getNoteTableTimingNow() - timingStart,
			cacheState: NOTE_TABLE_RENDER_CACHE_ENABLED
				? (renderCacheEntry ? 'hit' : 'miss')
				: 'disabled',
			selectorCount,
			sharps: !!sharps,
			rootID: options.rootID,
			rootIDLead: options.rootIDLead
		});
	}

	function checkOptionsForToolTables(tableID, options){
		let noteTablesLayout = getSong().getNoteTablesLayout();
		let entry = noteTablesLayout.find((one) => one.tableID === tableID);
		if (entry.ToolDisplayOptions){
			return { ...structuredClone(options), ...entry.ToolDisplayOptions };
		}
		return options;
	}

	let noteTablePrewarmGeneration = 0;

	function getNoteTableTimingNow(){
		const perf = globalThis?.performance || globalThis?.window?.performance;
		if (perf && typeof perf.now === 'function') {
			return perf.now();
		}
		return Date.now();
	}

	function dumpNoteTableTiming(label, data = {}){
		if (!NOTE_TABLE_RENDER_CACHE_TIMING_ENABLED) {
			return;
		}
		const payload = {
			...data,
			durationMs: Math.round((Number(data.durationMs) || 0) * 100) / 100
		};
		console.info(`[NoteTableTiming] ${label}`, payload);
	}

	function scheduleNoteTableCacheWork(work){
		const requestIdle = globalThis?.requestIdleCallback || globalThis?.window?.requestIdleCallback;
		if (typeof requestIdle === 'function') {
			return requestIdle(work, { timeout: 500 });
		}
		return setTimeout(() => work({ didTimeout: true, timeRemaining: () => 0 }), 0);
	}

	function parseNoteNamesFuncArrForOptions(options = {}){
		const optionValue = options.dropDownFunctionSymbols?.value;
		if (optionValue) {
			try {
				return JSON.parse(optionValue);
			} catch (error) {
				// Fall back to the current song symbols below.
			}
		}
		return Array.isArray(getSong()?.noteNamesFuncArr)
			? [...getSong().noteNamesFuncArr]
			: [];
	}

	function buildRenderOptionsForSection(section){
		const defaultDisplayOptions = ensureDefaultDisplayOptionsForNavigation();
		const displayOptions = cloneDisplayOptions(getSong().getDisplayOptionsInEffect(section, defaultDisplayOptions));
		const options = {
			...displayOptions,
			rootID: section?.rootID ?? 0,
			rootIDLead: section?.rootIDLead ?? -1,
			sharps: !!section?.sharps
		};
		options.noteNamesFuncArr = parseNoteNamesFuncArrForOptions(options);
		return options;
	}

	function getPrewarmSectionForTable(song, tableID, baseSectionIndex){
		const wiring = Array.isArray(song?.wirings)
			? song.wirings.find((entry) => entry?.tablename === tableID)
			: null;
		const relativeSection = `${wiring?.relativeSection || ''}`.trim();
		if (!relativeSection) {
			return song.getSections()[baseSectionIndex];
		}

		const previousIndex = song.gSectionsCurrentIndex;
		try {
			song.gSectionsCurrentIndex = baseSectionIndex;
			return song.getRelativeSectionWithWrap(relativeSection);
		} finally {
			song.gSectionsCurrentIndex = previousIndex;
		}
	}

	function buildPrewarmTaskForTable(tableID, sectionIndex){
		const song = getSong();
		const section = getPrewarmSectionForTable(song, tableID, sectionIndex);
		const tuning = TuningsLibrary.findTuningForName(tableID);
		if (!section || !tuning) {
			return null;
		}

		const options = buildRenderOptionsForSection(section);
		const key = NoteTableRenderCache.buildRenderKey({
			tableID,
			options,
			tuning,
			noteNamesFuncArr: options.noteNamesFuncArr
		});

		if (NoteTableRenderCache.has(key)) {
			return null;
		}

		return {
			key,
			options,
			sectionIndex,
			tableID,
			tuning
		};
	}

	function runNoteTablePrewarmTasks(tasks, generation, reason = ''){
		const timingStart = getNoteTableTimingNow();
		if (!Array.isArray(tasks) || tasks.length === 0) {
			dumpNoteTableTiming('prewarmSection', {
				cacheState: NOTE_TABLE_RENDER_CACHE_ENABLED ? 'no-work' : 'disabled',
				durationMs: getNoteTableTimingNow() - timingStart,
				reason,
				taskCount: 0
			});
			EventBus.trigger('NoteTableCache:ready', { count: 0, reason });
			return;
		}

		let completed = 0;
		const taskCount = tasks.length;
		function runNext(){
			if (generation !== noteTablePrewarmGeneration) {
				return;
			}
			const task = tasks.shift();
			if (!task) {
				dumpNoteTableTiming('prewarmSection', {
					cacheState: 'stored',
					completed,
					durationMs: getNoteTableTimingNow() - timingStart,
					reason,
					taskCount
				});
				EventBus.trigger('NoteTableCache:ready', { count: completed, reason });
				return;
			}

			const entry = NoteTableRenderCache.createEntry({
				key: task.key,
				tableID: task.tableID,
				sectionIndex: task.sectionIndex,
				options: task.options,
				tuning: task.tuning,
				buildCellHtml: ({ noteLetter, sharpflat, noteNum, midinum, options }) => {
					return cellBuilder(noteLetter, sharpflat, noteNum, options, midinum);
				}
			});
			NoteTableRenderCache.set(task.key, entry);
			completed++;
			scheduleNoteTableCacheWork(runNext);
		}

		scheduleNoteTableCacheWork(runNext);
	}

	function prewarmNoteTablesForSection(sectionIndex, data = {}){
		if (!NOTE_TABLE_RENDER_CACHE_ENABLED) {
			dumpNoteTableTiming('prewarmSection', {
				cacheState: 'disabled',
				durationMs: 0,
				reason: data.reason || 'prewarmSection',
				sectionIndex
			});
			return;
		}
		const song = getSong();
		const sections = song?.getSections?.() || [];
		if (!song || song.isHeadless || sectionIndex < 0 || sectionIndex >= sections.length) {
			return;
		}

		NoteTableRenderCache.setMaxEntries(Math.max(1, song.getVisibleTunings().length * 3));
		const generation = ++noteTablePrewarmGeneration;
		const tasks = song.getVisibleTunings()
			.map((tableID) => buildPrewarmTaskForTable(tableID, sectionIndex))
			.filter(Boolean);
		runNoteTablePrewarmTasks(tasks, generation, data.reason || 'prewarmSection');
	}

	function prewarmNextSectionNoteTables(data = {}){
		if (!NOTE_TABLE_RENDER_CACHE_ENABLED) {
			return;
		}
		const song = getSong();
		const nextSectionIndex = NoteTableRenderCache.getNextSectionIndexForPrewarm(song);
		if (nextSectionIndex < 0) {
			return;
		}
		prewarmNoteTablesForSection(nextSectionIndex, {
			...data,
			reason: data.reason || 'prewarmNextSection'
		});
	}

	function invalidateNoteTableRenderCache(){
		noteTablePrewarmGeneration++;
		NoteTableRenderCache.clear();
	}

	// List of menu divs, accessed through .entries(), and associated button names,
	//  accessed through selectors stored in values with menu as key: AllMenuDivs[strMenuDiv]
	const AllMenuDivs = {
		"#palette": "#btnPalette",
		"#info": "#btnInfo",
		"#macros": undefined,
		"#divFileControls": "#btnFileControls",
		"#divViewControls": "#btnViewControls",
		"#divThemeControls": "#btnThemeControls",
		"#divFillNotes": "#btnFillNotes",
		"#divTunings": "#btnTunings",
		"#divDesktop": "#btnDesktop",
		"#divChart": "#btnChart",
		"#spanSectionDrawer": "#btnEditSection"
	}

	export function hideAllMenuDivs(openingSong=false){
		for (const key of Object.keys(AllMenuDivs)){
			if (key === "#spanSectionDrawer"){
				TransportBuilder.hideSectionDrawer();
			} else if (key === "#info") {
				if (!openingSong){
					InfoBuilder.hide();
				}
			} else if (key === "#macros") {
				if(!openingSong){
					MacroBuilder.persistMacro();
					MacroBuilder.hide();
				}
			} else {
				dockDivInPage(stripDivHash(key));
				$(key).hide();
			}
		}
		$('.MainMenuTabBtn').removeClass("BtnPunchedIn").addClass("BtnPunchedOut");
		//$("#topControlsCaptions").show();
	}

	function isStrictTutorial(){
		return getSong()?.tutorial?.level === TUTORIAL_MODES.STRICT;
	}

	function isFullscreenActive(){
		return !$('.container').is(':visible');
	}

	function updateFullscreenLeadSheetLineHost(){
		const jHost = $("#divFullscreenLeadSheetLineHost");
		if (jHost.length === 0) {
			return;
		}
		if (gFullscreenLeadSheetLineVisible && (isFullscreenActive() || isStrictTutorial()) && getSong()) {
			jHost
				.html(SectionPrinter.printLeadSheetLine(getSong(), getSections(), { rootId: 'sectionPrinterChartLineFullscreen' }))
				.show();
			return;
		}
		jHost.hide().empty();
	}

	function updateFullscreenChartHost(){
		const jHost = $("#divFullscreenChartHost");
		if (jHost.length === 0) {
			return;
		}
		if (gFullscreenChartVisible && (isFullscreenActive() || isStrictTutorial()) && getSong()) {
			jHost
				.html(SectionPrinter.printChart(getSong(), getSections()))
				.show();
			return;
		}
		jHost.hide().empty();
	}

	function setFullscreenLeadSheetLineVisible(isVisible) {
		gFullscreenLeadSheetLineVisible = !!isVisible;
		if (gFullscreenLeadSheetLineVisible && gFullscreenChartVisible){
			hideFullscreenChart();
		}
		updateFullscreenLeadSheetLineHost();
	}

	function setFullscreenChartVisible(isVisible) {
		gFullscreenChartVisible = !!isVisible;
		if (gFullscreenLeadSheetLineVisible && gFullscreenChartVisible){
			hideFullscreenLeadSheetLine();
		}
		updateFullscreenChartHost();
	}

	export function hideFullscreenLeadSheetLine(){
		if (!(isFullscreenActive() || isStrictTutorial())) {
			const wasChartVisible = $("#divChart").is(":visible");
			if (wasChartVisible) {
				hideAllMenuDivs();
			}
			return wasChartVisible ? "Chart hidden" : "Chart not shown";
		}
		const wasVisible = gFullscreenLeadSheetLineVisible;
		setFullscreenLeadSheetLineVisible(false);
		return wasVisible ? "LeadSheetLine hidden" : "LeadSheetLine not shown";
	}
	
	export function hideFullscreenChart(){
		if (!(isFullscreenActive() || isStrictTutorial())) {
			const wasChartVisible = $("#divChart").is(":visible");
			if (wasChartVisible) {
				hideAllMenuDivs();
			}
			return wasChartVisible ? "Chart hidden" : "Chart not shown";
		}
		const wasVisible = gFullscreenChartVisible;
		setFullscreenChartVisible(false);
		return wasVisible ? "Chart hidden" : "Chart not shown";
	}

	export function hideFullscreenAllCharts(){
		if (!(isFullscreenActive() || isStrictTutorial())) {
			const wasChartVisible = $("#divChart").is(":visible");
			if (wasChartVisible) {
				hideAllMenuDivs();
			}
			return wasChartVisible ? "Chart hidden" : "Chart not shown";
		}
		const wasVisible = gFullscreenChartVisible || gFullscreenLeadSheetLineVisible;
		setFullscreenChartVisible(false);
		setFullscreenLeadSheetLineVisible(false);
		return wasVisible ? "Fullscreen/Tutorial Charts hidden" : "Chart not shown";
	}


	export function isFloaty(){
		return $("#cbFloatyControls").prop("checked");  
	}
	export function isMenuShowing(strMenuDiv){
		var jStrMenuDiv = $(strMenuDiv);
		return jStrMenuDiv.is(":visible");
	}
	export function getVisibleMenu(){
		var anchor = "";
		 for (const [key, value] of Object.entries(AllMenuDivs)){
			 var jStrMenuDiv = $(key);
			 if (jStrMenuDiv.is(":visible")){
			 	anchor = key;
				break;
 			 }
 		 }
		 return anchor;
	}

	function stripDivHash(strMenuDiv){
		let divNoHash = strMenuDiv;
		if (strMenuDiv.startsWith('#')){
			divNoHash = strMenuDiv.slice(1);
		}
		return divNoHash;
	}

	function showOneMenuDiv(strMenuDiv, jMenuDiv) {
		jMenuDiv.show();
		if (isFloaty()){
			makeDivDockable(stripDivHash(strMenuDiv),900);
		}
	}

	export function showOneMenu(strMenuDiv, forceOpen = false) {
		var wasFull = leaveFullscreen();
		var jMenuDiv = $(strMenuDiv);
		if (wasFull) {
			hideAllMenuDivs();
			showOneMenuDiv(strMenuDiv, jMenuDiv);
		} else if (forceOpen) {
			hideAllMenuDivs();
			showOneMenuDiv(strMenuDiv, jMenuDiv);
			$(AllMenuDivs[strMenuDiv]).addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
		} else {
			if (jMenuDiv.is(":visible")) {
				hideAllMenuDivs();
			} else {
				hideAllMenuDivs();
				showOneMenuDiv(strMenuDiv, jMenuDiv);
				$(AllMenuDivs[strMenuDiv]).addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
			}
		}
		//$("#topControlsCaptions").hide();
		scrollToTop();
	}

	export function showInfoDialog(forceMode = null, forceOpen = false) {
		if (!forceOpen && InfoBuilder.isVisible()) {
			hideAllMenuDivs();
			return;
		}
		if (forceMode === null){
			forceMode = isFloaty() ? 'float' : 'parked';
		}
		InfoBuilder.show(forceMode);
	}

	export function showMacroDialog(macroId = '') {
		MacroBuilder.show(macroId);
	}

	function handleInfoActionFragment(href = '') {
		const parsed = parseAppActionFragment(href);
		if (parsed.errors.length > 0) {
			UserLog.addToUserLog('InfoLink', parsed.errors.map((error) => escapeHtml(error)).join('<br>'));
		}
		parsed.items.forEach((item) => {
			if (item.action === 'raise') {
				pluginManager.raisePluginSnapshotsFromHash(`#raise=${item.value}`);
				return;
			}
			if (item.action === 'macro') {
				runSongMacroById(item.macroId);
			}
		});
		return parsed;
	}

	export function getHelpTopic(){
		const tabAnchors = [
			'#divChartSummaryTab',
			'#divChartInputTab',
			'#divChartNotesTab',
			'#divChartDetailsTab',
			'#divChartOptionsTab',
			'#divChartTab',
			'#divChartLineTab',
			'#divSongTuningControls',
			'#divAllTuningsTab'
		];
		for (const selector of tabAnchors) {
			const jTab = $(selector);
			if (jTab.length > 0 && jTab.is(':visible')) {
				return 'help.html' + selector;
			}
		}
		 var anchor = getVisibleMenu();
		 return  'help.html'+anchor;
	}

	export function createChartInputSectionAfterCurrent({ rootID = 3, rootIDLead = -1 } = {}) {
		const section = getSong().constructSection();
		section.rootID = rootID;
		section.rootIDLead = Number.parseInt(rootIDLead, 10) >= 0 ? Number.parseInt(rootIDLead, 10) : '-1';
		section.sharps = Constants.noteIdPrefersSharps(rootID);
		getSong().addSectionAfterCurrent(section);
		sectionChanged();
		return section;
	}

	export function turnOnKeep(){
		PalettePresentation.enterKeepMode({
			forcedKeep: true
		});
		$("td.note").css({"cursor": "no-drop"});
	}
	
	export function turnOffKeep(){
		if (!gPresentation.palette.keepWasForced) {
			return;
		}
		gPresentation.palette.keepWasForced = false;
		PalettePresentation.enterPaintMode({
			restoreHighlightIfNeeded: true,
			forcedKeep: false
		});
		if (!gPresentation.palette.lockKeep){
			$("td.note").css({"cursor": "pointer"});
		}
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
	    return getSong().getVisibleTunings();
	}

	export function updateMemoryModelPreFileSave(){
	    updateVisibleTablesInMemoryModel();
	    captureAnchorageBeforeSave();
	    var bpm = parseInt($("#txtBPM").val());
	    if (Number.isNaN(bpm) || bpm == 0) { bpm = DEFAULT_BPM; }
	    getSong().prepareForSave({
	        songName: $("#txtFilename").val(),
	        theme: $('#selThemes').val(),
	        bpm,
	        userColors: gUserColorDict.dict,
	        plugins: pluginManager.exportSongPluginState()
	    });
	}

	export function downloadBackupThenClearGraveyard(){
		downloadPlayedNotes();
		getSong().graveyard.clear();
		Messages.showMessages(getSong().graveyard.buildGraveyardTable());
	}

	export function downloadBackupThenClearGraveyardByType(selectedTypes = []) {
		const normalizedSelectedTypes = (selectedTypes || [])
			.map((typeName) => `${typeName || ''}`.trim())
			.filter((typeName) => typeName.length > 0);

		if (normalizedSelectedTypes.length === 0) {
			return { result: 'no types selected' };
		}

		downloadPlayedNotes();
		const removed = getSong().graveyard.clearByTypes(normalizedSelectedTypes);
		Messages.showMessages(getSong().graveyard.buildGraveyardTable());
		return { result: `cleared: ${normalizedSelectedTypes.join(',')} (${removed})` };
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
				const importOptions = {
					sections: $("#cbAppendSections").prop("checked"),
					stylesheets: $("#cbAppendStylesheets").prop("checked"),
					replaceUserTheme: $("#cbReplaceUserTheme").prop("checked"),
					graveyardRecords: $("#cbAppendGraveyardRecords").prop("checked")
				};
				var reader = new FileReader();
				reader.onload = function(e) {
					var str = JSON.stringify(reader.result, null, 2);
					openSong(reader.result, importOptions);
				}
				hideAllMenuDivs();
				reader.readAsText(file);
			} else {
				console.warn("File not supported!"+file.name);
			}
        });
	}

	function normalizeOpenSongImportOptions(appendOrOptions){
		if (appendOrOptions && typeof appendOrOptions === 'object') {
			return {
				sections: !!appendOrOptions.sections,
				stylesheets: !!appendOrOptions.stylesheets,
				replaceUserTheme: !!appendOrOptions.replaceUserTheme,
				graveyardRecords: !!appendOrOptions.graveyardRecords
			};
		}
		return {
			sections: !!appendOrOptions,
			stylesheets: false,
			replaceUserTheme: false,
			graveyardRecords: false
		};
	}

	function appendStylesheetsFromSong(newSong){
		const incomingColorDicts = newSong?.colorDicts && typeof newSong.colorDicts === 'object'
			? newSong.colorDicts
			: {};
		if (!getSong().colorDicts || typeof getSong().colorDicts !== 'object') {
			getSong().colorDicts = {};
		}

		Object.entries(incomingColorDicts).forEach(([name, scheme]) => {
			if (!name || !scheme || typeof scheme !== 'object') {
				return;
			}
			if (scheme.readOnly || scheme.computed) {
				return;
			}
			getSong().colorDicts[name] = JSON.parse(JSON.stringify(scheme));
		});

		installDefaultColorDicts();
	}

	function replaceUserThemeFromSong(newSong){
		if (!newSong || typeof newSong !== 'object') {
			return;
		}
		getSong().userTheme = newSong.userTheme
			? JSON.parse(JSON.stringify(newSong.userTheme))
			: undefined;
	}

	function appendGraveyardRecordsFromSong(newSong){
		const currentRecords = Array.isArray(getSong()?.graveyard?.records)
			? getSong().graveyard.records
			: null;
		if (!currentRecords) {
			return;
		}

		const incomingRecords = Array.isArray(newSong?.graveyard?.records)
			? newSong.graveyard.records
			: [];
		incomingRecords.forEach((record) => {
			if (!record || typeof record !== 'object') {
				return;
			}
			currentRecords.push(JSON.parse(JSON.stringify(record)));
		});
	}

	export function openSong(str, append=false){
		var jsonObj = JSON.parse(str);
		const importOptions = normalizeOpenSongImportOptions(append);
		const hasSelectiveImport = importOptions.sections || importOptions.stylesheets || importOptions.replaceUserTheme || importOptions.graveyardRecords;
		if (!hasSelectiveImport) {
			gCurrentSongLibraryHref = gPendingSongLibraryHref;
			gPendingSongLibraryHref = '';
		}
		if (Globals.getSong() && hasSelectiveImport){
			let newSong = new Song(jsonObj);

			if (importOptions.sections) {
				let sections = newSong.getSections();
				for (const section of sections){
					Globals.getSong().addSection(section);
				}
				let newTunings = newSong.getMyTunings();
				if (newTunings){
					Globals.getSong().addTunings(newTunings);
				}
			}

			if (importOptions.stylesheets) {
				appendStylesheetsFromSong(newSong);
			}

			if (importOptions.replaceUserTheme) {
				replaceUserThemeFromSong(newSong);
			}

			if (importOptions.graveyardRecords) {
				appendGraveyardRecordsFromSong(newSong);
			}

			updateAfterAppendSong(importOptions);
			return;
		}
		Globals.setSong(new Song(jsonObj));
		UserLog.clearUserLog();
		Globals.getSong().ensureDefaultSection();
		pluginManager.loadSongPluginState(Globals.getSong());
		updateAfterOpenSong();
	}

	export function updateAfterAppendSong(importOptions = { sections: true, stylesheets: false, replaceUserTheme: false, graveyardRecords: false }){
		const song = getSong();
		if (!song || song.isHeadless){
			return;
		}

		if (importOptions.replaceUserTheme) {
			installUserTheme(getSong().userTheme);
			$('#selThemes').val('USER').trigger('change');
		}

		if (importOptions.stylesheets || importOptions.replaceUserTheme) {
			applyStylesheetsTo_gUserColorDict();
			buildColorDicts();
		}

		if (importOptions.sections) {
			// Stale floating windows from whatever song was previously open must not survive
			// into the newly-appended sections: their DOM ids can collide with the tables
			// ReinstallAllTuningsTables is about to (re)build. See sprint-141 Iteration 1 analysis.
			disposeAllDockables();
			requestReloadTuningsDisplays();
			EventBus.trigger('ReinstallAllTuningsTables');
			EventBus.trigger('UpdateAllWiringSelects');
			applyPersistedAnchorage();
		}

		

		replay();
		sectionChanged();
	}

	export function updateAfterOpenSong(){
		// Stale floating windows from a previously open song must not survive a new song
		// load: they'd share DOM ids with the tables about to be (re)built below, causing
		// duplicate-id bugs (mash-the-Float-button, UF affecting both, etc.). See
		// sprint-141 Iteration 1 analysis.
		disposeAllDockables();
		getSong().resetRecording?.();
		syncRecordingViews();
		getSong().fixupCurrentIndexForLoadedSong();
		hideGraveyard();
		installDefaultColorDicts();
		const hasUserTheme = !!installUserTheme(getSong().userTheme);
		
		const songTheme = resolveLoadedThemeId(getSong().theme, hasUserTheme);
		$('#selThemes').val(songTheme).trigger('change');

		$("#txtFilename").val(getSong().songName).trigger('change');
		$("#cbPresentationMode").prop("checked", !!getSong().presentationMode).trigger('change');
		$("#cbAllowThemeAutomation").prop("checked", !!getSong().allowThemeAutomation).trigger('change');

		setBPM(getSong().defaultBPM);

		applyStylesheetsTo_gUserColorDict();
		buildColorDicts();
		requestReloadTuningsDisplays();
		refreshFileMenuSongInstrumentBadges();
		EventBus.trigger('ReinstallAllTuningsTables');
		EventBus.trigger('UpdateAllWiringSelects');
		applyPersistedAnchorage();
		
		var tuningsShowing = TuningsLibrary.showTuningsForTablesInFile();
		const ghostTableIds = getSong().getGhostTableIDs();
		if (ghostTableIds.length > 0) {
			const rows = ghostTableIds.map((tableID) => {
				const tuningID = tableID.startsWith(Constants.TABLE_ID_PREFIX)
					? tableID.substring(Constants.TABLE_ID_PREFIX.length)
					: tableID;
				const tuning = TuningsLibrary.findTuningForID(tuningID);
				const fromBaseID = tuning?.fromBaseID || '(unknown)';
				return `"${tableID}", ID: "${tuningID}", Lineage("from"): ${fromBaseID}<br>`;
			});
			Messages.showMessages(
				`Tunings without views found in song:<br>${rows.join('')}`
				+ 'These will continue to be accessible to Observers and Listeners through the Wiring page, and their Sections and Notes are visible in "Chart | Notes".<br>'
				+ 'If you wish to attach a visible instrument to this Tuning, Clone a Tuning with a baseID equal to Lineage("from") and set its ID to the ID shown.'
			);
		}
		if (tuningsShowing == 0){
			// Preserve loaded no-visible state; UI already provides warning and recovery flows.
		}

		leaveFullscreen();
		hideCmdLine();
		hideAllMenuDivs(true);

		replay();
		sectionChanged();
		InfoBuilder.renderFromSong(getSong());
		InfoBuilder.handleSongLoaded(getSong());
		scheduleUrlMacroRun();
	}

	export function resolveLoadedThemeId(themeId, hasUserTheme = false){
		if (themeId && getThemes()[themeId]){
			return themeId;
		}
		if (hasUserTheme){
			return 'USER';
		}
		return getDefaultTheme().id;
	}

	function showDefaultTunings(){
		let preferredTuningArray = applyInstrumentPrefs();
		const params = new URLSearchParams(window.location.search);
		const songParam = normalizeUrlSongPath(params.get('song'));
		if (songParam) {
			// song= opens a saved song, and that song's own tunings should win.
			return;
		}
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

	function normalizeUrlSongPath(rawSongPath = '') {
		let text = `${rawSongPath || ''}`.trim();
		if (!text) {
			return '';
		}
		try {
			text = decodeURIComponent(text);
		} catch {
			// Keep original if decodeURIComponent fails.
		}
		text = text
			.trim()
			.replace(/\\/g, '/')
			.replace(/^\/+/, '')
			.replace(/^songs\//i, '')
			.replace(/\s+\.json$/i, '.json');
		if (!text || text.includes('..')) {
			return '';
		}
		return text;
	}

	function loadSongFromUrlQueryParam(){
		if (typeof window === 'undefined') {
			return false;
		}
		const params = new URLSearchParams(window.location.search);
		const songPath = normalizeUrlSongPath(params.get('song'));
		if (!songPath) {
			return false;
		}
		loadSong(songPath);
		leaveFullscreen();
		hideCmdLine();
		hideAllMenuDivs(true);
		return true;
	}

	function scheduleUrlMacroRun(){
		if (gUrlMacroRunAttempted || typeof window === 'undefined') {
			return;
		}
		const params = new URLSearchParams(window.location.search);
		const macroId = `${params.get('macro') || ''}`.trim();
		if (!macroId) {
			return;
		}
		gUrlMacroRunAttempted = true;
		setTimeout(() => {
			const result = runSongMacroById(macroId);
			if (!result.ok) {
				UserLog.addToUserLog('Macro', `URL macro ${macroId} failed: ${result.error}`);
			}
		}, 0);
	}

	export function installDefaultColorDicts(){
		const existingColorDicts = getSong().colorDicts && typeof getSong().colorDicts === 'object'
			? getSong().colorDicts
			: {};
		const userColorDicts = {};
		Object.entries(existingColorDicts).forEach(([key, scheme]) => {
			if (!scheme || typeof scheme !== 'object'){
				return;
			}
			if (scheme.readOnly || scheme.computed){
				return;
			}
			userColorDicts[key] = scheme;
		});
		getSong().colorDicts = {
			"All-Clear": gAllClear,
			"CycleOfColors": gDefault_CycleOfColors,
			"Roles": gUserColorDictRolesDefault,
			"Fingerings": gUserColorDictFingeringsDefault,
			"Default": gUserColorDictOEM,
			...userColorDicts
		};
	}


	export function loadSong(songName){
		$.get( "songs/"+songName, function( data ) {  //jQuery automatically calls something like JSON.parse and turns the result into a real javascript Object.
			if (!getSong().isEmpty(getSong().getCurrentSection())){
				var yes = confirm("Did you save the current Song with File | Download already? ( 'Cancel' cancels, otherwise 'OK' forgets the current song and opens the new one.");
				if (!yes){
					return;
				}
			}
			gPendingSongLibraryHref = normalizeUrlSongPath(songName);
			openSong(JSON.stringify(data));
		});
	}

	export function songLibrary(){
		SongLibrary.initializeSongLibrary('#divSongList');
	}

	export function showGraveyard(){
		hideAllMenuDivs();
		Messages.showMessages(getSong().graveyard.buildGraveyardTable());
	}

	export function showDisplayOptions(){
		Messages.showMessages(displayOptionsTable());
	}

	export function increaseUIFont(){
		setUIFontSize(getUIFontSize() + 1);
	}

	export function decreaseUIFont(){
		setUIFontSize(getUIFontSize() - 1);
	}

	export function increaseNoteFont(){
		setNoteFontSize(getNoteFontSize() + 1);
		refreshDisplayOptionsSaveActionRequired();
	}

	export function decreaseNoteFont(){
		if (getNoteFontSize() > 0.5){
			setNoteFontSize(getNoteFontSize() - 1);
			refreshDisplayOptionsSaveActionRequired();
		}
	}

	export function installAllTuningsTables(){
		var count = 0;
		var tunings = TuningsLibrary.getMyTunings();
		for (let i = 0; i < tunings.length; i++) {
			const tuning = tunings[i];
			const tableID = Constants.TABLE_ID_PREFIX + tuning.baseID;
			const divID = Constants.TABLEDIV_ID_PREFIX + tuning.baseID;
			var outerDiv = TableBuilder.buildNoteTable({ ...tuning, visible: true });
			if (outerDiv){
				if (isDivFloating(divID)) {
					// Rebuild-in-place: to the User, a floated instrument has only moved
					// over a bit -- it's still "the same table" -- so MyTunings structural
					// changes (Frets, reverse, etc.) must apply without disturbing the
					// floating window's chrome/position. Swap just the instrumentBackground
					// content node (id=divID) in place; the floating wrapper it lives inside
					// is left untouched. See sprint-141 Iteration 3.
					const newContent = outerDiv.find('#' + divID);
					const existingContent = document.getElementById(divID);
					if (existingContent && newContent.length > 0) {
						$(existingContent).replaceWith(newContent);
					} else {
						$('#tabledest').append(outerDiv);
					}
				} else {
					$('#tabledest').append(outerDiv);
				}
				if (!getSong().isTableVisible(tableID)) {
					$('#' + divID).hide();
				}
				count++;
			}
	    }
		if (count==0){
			var warning = $("<div class='warningMessage'>");
			warning.html("No tunings chosen: click the Tunings button.<br>");
			$('#tabledest').append(warning);
		}
		buildColorDicts();
		installFillPageSelects();
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
			getSong().getLayout().doToggles();
			setUIFromNoteTablesLayoutOptions();
			$('#spanFillVisibleTablesSelect').html(getVisibleTablesSelect());
	}

	/** Resolves the { left, top, width, height, zIndex, handleOrientation } rect to
	 *  pass to dockable.js's makeDivDockable() for tableID, reading floatRect/
	 *  handleOrientation straight from the model's saved anchorage. If the table has
	 *  no zIndex recorded yet (a table that's never been floated before), assigns and
	 *  persists a new one via song.getNextAnchorageZIndex()/setTableZIndex() -- see
	 *  sprint-141 Iteration 4, point 3. */
	export function buildFloatRectForTable(song, tableID){
		if (!song || !tableID) {
			return null;
		}
		const anchorage = song.getTableAnchorage(tableID);
		let zIndex = anchorage?.zIndex;
		if (typeof zIndex !== 'number' || !Number.isFinite(zIndex)) {
			zIndex = song.getNextAnchorageZIndex();
			song.setTableZIndex(tableID, zIndex);
		}
		const rect = { ...(anchorage?.floatRect || {}), zIndex };
		if (anchorage?.handleOrientation) {
			rect.handleOrientation = anchorage.handleOrientation;
		}
		return rect;
	}

	/** Applies each noteTablesLayout entry's saved anchorage.floated/floatRect by
	 *  floating the corresponding table's div. Must run only once, right after a
	 *  song is loaded (not on every reinstallAllTuningsTables() call) -- otherwise a
	 *  table the User explicitly docks mid-session would be re-floated the next time
	 *  any unrelated MyTunings change triggers a reinstall. See sprint-141 Iteration 3,
	 *  section 7 (restore-on-open order) and the discussion following section 10. */
	export function applyPersistedAnchorage(){
		const song = getSong();
		if (!song) {
			return;
		}
		song.getNoteTablesLayout().forEach((entry) => {
			const anchorage = entry?.anchorage;
			if (!anchorage || anchorage.floated !== true || entry.visible === false) {
				return;
			}
			const tableID = `${entry.tableID || ''}`;
			if (!tableID.startsWith(Constants.TABLE_ID_PREFIX)) {
				return;
			}
			const baseID = tableID.substring(Constants.TABLE_ID_PREFIX.length);
			const divID = Constants.TABLEDIV_ID_PREFIX + baseID;
			makeDivDockable(divID, null, buildFloatRectForTable(song, tableID));
		});
	}

	/** The opposite of dockAllDockables()/'/vwd': walks every noteTablesLayout entry
	 *  that has a non-empty anchorage.floatRect and (re-)floats it, restoring whatever
	 *  floating layout the User last had, regardless of anchorage.floated (a table may
	 *  have been docked, or never explicitly marked floated, yet still carry a
	 *  remembered floatRect worth restoring). Idempotent: makeDivDockable() is a no-op
	 *  for a div that's already floating, so this still works correctly if some of the
	 *  group have already been re-floated. See sprint-141 Iteration 4, point 5. */
	export function refloatAllDockables(){
		const song = getSong();
		if (!song) {
			return;
		}
		song.getNoteTablesLayout().forEach((entry) => {
			const floatRect = entry?.anchorage?.floatRect;
			if (!floatRect || typeof floatRect !== 'object' || Object.keys(floatRect).length === 0) {
				return;
			}
			if (entry.visible === false) {
				return;
			}
			const tableID = `${entry.tableID || ''}`;
			if (!tableID.startsWith(Constants.TABLE_ID_PREFIX)) {
				return;
			}
			const baseID = tableID.substring(Constants.TABLE_ID_PREFIX.length);
			const divID = Constants.TABLEDIV_ID_PREFIX + baseID;
			makeDivDockable(divID, null, buildFloatRectForTable(song, tableID));
		});
		const menuDivID = getVisibleMenu();
		makeDivDockable(stripDivHash(menuDivID), 900, null);
	}
	if (typeof window !== 'undefined') {
		window.refloatAllDockables = refloatAllDockables;
	}

	/** Captures each currently-floating table's live position/size as percentages of
	 *  the viewport into noteTablesLayout[].anchorage, right before the song file is
	 *  serialized. This is a safety net for any case the live hooks below might miss
	 *  (e.g. a resize, which has no live end-of-resize hook) -- drags and docks are
	 *  already captured live as they happen (see captureAnchorageOnDragEnd() and
	 *  captureAnchorageOnDock() below), so this mostly just reaffirms their result at
	 *  save time. See sprint-141 Iteration 3, point 9.1. */
	export function captureAnchorageBeforeSave(){
		const song = getSong();
		if (!song || typeof window === 'undefined' || typeof document === 'undefined') {
			return;
		}
		const viewportWidth = window.innerWidth || 1;
		const viewportHeight = window.innerHeight || 1;
		song.getMyTunings().forEach((tuning) => {
			if (!tuning || !tuning.baseID) {
				return;
			}
			const tableID = Constants.TABLE_ID_PREFIX + tuning.baseID;
			const divID = Constants.TABLEDIV_ID_PREFIX + tuning.baseID;
			const floatWin = document.getElementById('floating-' + divID);
			if (floatWin) {
				const rect = floatWin.getBoundingClientRect();
				song.setTableFloated(tableID, true);
				song.setTableFloatRect(tableID, {
					left: (rect.left / viewportWidth) * 100,
					top: (rect.top / viewportHeight) * 100,
					width: (rect.width / viewportWidth) * 100,
					height: (rect.height / viewportHeight) * 100
				});
			} else {
				song.setTableFloated(tableID, false);
			}
		});
	}

	/** Resolves divId to its tableID only when it's a currently-registered Tuning's
	 *  instrument table div (Constants.TABLEDIV_ID_PREFIX-prefixed and found via
	 *  TuningsLibrary.findTuningForID()) -- returns '' for non-tuning-backed divs
	 *  (Info, ChartInput, etc.), which have no anchorage to persist. */
	function tableIDForDockableDivID(divId){
		if (!divId.startsWith(Constants.TABLEDIV_ID_PREFIX)) {
			return '';
		}
		const baseID = divId.substring(Constants.TABLEDIV_ID_PREFIX.length);
		if (!TuningsLibrary.findTuningForID(baseID)) {
			return '';
		}
		return Constants.TABLE_ID_PREFIX + baseID;
	}

	/** Registered with dockable.js via setDockCaptureHook() below: fires with
	 *  (divId, rectPercent) at the moment any div is docked (Dock/pin button, or
	 *  dockIfFloating() in TuningsLibrary.js before a move-up/down). Persists that
	 *  live rect into the Song model immediately -- rather than waiting for the next
	 *  save (captureAnchorageBeforeSave() above still runs at save time, for tables
	 *  still floating) -- so the model is *always* current, even mid-session before
	 *  any save. This is what re-Floating (see floatNoteTableDiv() below) reads back
	 *  from. See sprint-141 Iteration 3 bugfix ("Float button throws away floatRect" /
	 *  "consult the model, not a window var"). No-op for non-tuning-backed divs (Info,
	 *  ChartInput, etc.), identified via TuningsLibrary.findTuningForID(). */
	function captureAnchorageOnDock(divId, rect){
		const tableID = tableIDForDockableDivID(divId);
		const song = getSong();
		if (!tableID || !song) {
			return;
		}
		song.setTableFloated(tableID, false);
		song.setTableFloatRect(tableID, rect);
	}
	setDockCaptureHook(captureAnchorageOnDock);

	/** Registered with dockable.js via setDragEndCaptureHook() below: fires with
	 *  (divId, rectPercent) right when a User finishes dragging a still-floating
	 *  table. Persists the new position/size into anchorage.floatRect immediately
	 *  (without touching anchorage.floated, since the table is still floating) --
	 *  responding to the User's action live, in the in-memory model, without waiting
	 *  for a file save. */
	function captureAnchorageOnDragEnd(divId, rect){
		const tableID = tableIDForDockableDivID(divId);
		const song = getSong();
		if (!tableID || !song) {
			return;
		}
		song.setTableFloatRect(tableID, rect);
	}
	setDragEndCaptureHook(captureAnchorageOnDragEnd);

	/** Registered with dockable.js via setZIndexCaptureHook() below: fires with
	 *  (divId, zIndex) whenever a floating window's stacking order changes (currently:
	 *  a .dockable-handle click, raising it to the front of the "deck"). See
	 *  sprint-141 Iteration 4, points 1-2. */
	function captureZIndexOnChange(divId, zIndex){
		const tableID = tableIDForDockableDivID(divId);
		const song = getSong();
		if (!tableID || !song) {
			return;
		}
		song.setTableZIndex(tableID, zIndex);
	}
	setZIndexCaptureHook(captureZIndexOnChange);

	/** Registered with dockable.js via setHandleOrientationCaptureHook() below: fires
	 *  with (divId, orientation) whenever a floating window's drag-handle orientation
	 *  is toggled. See sprint-141 Iteration 4, point 4. */
	function captureHandleOrientationOnChange(divId, orientation){
		const tableID = tableIDForDockableDivID(divId);
		const song = getSong();
		if (!tableID || !song) {
			return;
		}
		song.setTableHandleOrientation(tableID, orientation);
	}
	setHandleOrientationCaptureHook(captureHandleOrientationOnChange);

	/** Global handler for the per-instrument-table Float button's inline onclick (see
	 *  TableBuilder.js's btnPopOutDiv) -- looks up this table's saved anchorage from
	 *  the Song model and passes it to makeDivDockable(), so re-Floating (after a
	 *  prior Dock) reopens exactly where the table was last left, with the same
	 *  stacking order and handle orientation, the same way applyPersistedAnchorage()
	 *  does at song-open time. Falls back to makeDivDockable's hardcoded defaults when
	 *  there's no saved anchorage yet (e.g. a table that's never been floated before).
	 *  See sprint-141 Iteration 3 bugfix ("Float button throws away floatRect"). */
	export function floatNoteTableDiv(divId){
		const baseID = divId.startsWith(Constants.TABLEDIV_ID_PREFIX)
			? divId.substring(Constants.TABLEDIV_ID_PREFIX.length)
			: '';
		const tableID = baseID ? Constants.TABLE_ID_PREFIX + baseID : '';
		makeDivDockable(divId, null, buildFloatRectForTable(getSong(), tableID));
	}
	if (typeof window !== 'undefined') {
		window.floatNoteTableDiv = floatNoteTableDiv;
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

		$('input[name="rbPaletteMode"]:radio, input[name="rbColor"]:radio, input[name="rbHighlight"]:radio')
			.off(eventNamespace);

		$(document)
			.off(`change${eventNamespace}`, 'input[name="rbPaletteMode"]:radio')
			.on(`change${eventNamespace}`, 'input[name="rbPaletteMode"]:radio', function() {
				if (!$(this).is(":checked")) {
					return;
				}

				const mode = $(this).val();
				if (mode === 'keep') {
					PalettePresentation.enterKeepMode();
					$("td.note").css({"cursor": "no-drop"});
					return;
				}

				if (mode === 'clear') {
					PalettePresentation.enterClearMode();
					$("td.note").css({"cursor": "crosshair"});
					return;
				}

				if (mode === 'dropper') {
					PalettePresentation.enterDropperMode();
					$("td.note").css({"cursor": "zoom-in"});
					return;
				}

				PalettePresentation.enterPaintMode({
					restoreHighlightIfNeeded: true,
					forcedKeep: false
				});
				if (!gPresentation.palette.lockKeep){
					$("td.note").css({"cursor": "pointer"});
					turnOffHiding();
				}
			});
	
		$(document)
			.off(`change${eventNamespace}`, 'input[name="rbColor"]:radio')
			.on(`change${eventNamespace}`, 'input[name="rbColor"]:radio', function() {
				if ($(this).is(":checked") && !gPresentation.palette.suppressRbColorRemember) {
					PalettePresentation.rememberRestorableRbColor(this);
				}
				PalettePresentation.updateRestoreRbColorButton();
			});

		$(document)
			.off(`change${eventNamespace}`, 'input[name="rbHighlight"]:radio')
			.on(`change${eventNamespace}`, 'input[name="rbHighlight"]:radio', function() {
				if (!$(this).is(":checked")) {
					return;
				}
				PalettePresentation.rememberRestorableRbHighlight(this);
				PalettePresentation.enterPaintMode({
					restoreHighlightIfNeeded: false,
					forcedKeep: false
				});
				if (!gPresentation.palette.lockKeep){
					$("td.note").css({"cursor": "pointer"});
					turnOffHiding();
				}
			});
	
		$(document)
			.off(`click${eventNamespace}`, 'input[name="rbColor"]')
			.on(`click${eventNamespace}`, 'input[name="rbColor"]', function() {
				$('input[name="rbColor"]').css({"box-shadow": "none"});
				PalettePresentation.enterPaintMode({
					restoreHighlightIfNeeded: true,
					forcedKeep: false
				});
				if (!gPresentation.palette.lockKeep){
					$("td.note").css({"cursor": "pointer"});
					turnOffHiding();
				}
			});
	
		PalettePresentation.initializePalettePresentation();
	}

    export function addBeat(){
		clearHighlights();
		getSong().addBeat();
    }

	export function fixDockableHandlesIfFullscreen(){
		if (isFullscreenActive()){
			$(".dockable-handle").hide();
		}
	}

	export function leaveFullscreen(){
		var wasVisible =  $('.container').is(':visible');
		$('.container').show();
		$(".dockable-handle").show();
		$("#divESCAPE").hide();
		updateFullscreenLeadSheetLineHost();
		updateFullscreenChartHost();
		getSong().getLayout().leaveFullscreen();
		return !wasVisible;
	}
	export function enterFullscreen(showESCButton){
		$('.container').hide();
		$(".dockable-handle").hide();
		if (showESCButton){ // undefined ==> false
			$("#divESCAPE").show();
		}
		updateFullscreenLeadSheetLineHost();
		updateFullscreenChartHost();
		getSong().getLayout().enterFullscreen();
	}
	
	export function toggleFullscreen(){
		var wasVisible =  $('.container').is(':visible');  //container holds the menu buttons, so NOT fullscreen when visible.
		$('.container').toggle();
		if (wasVisible){
			getSong().captionsRowShowing = $('.captionRow').is(":visible");
			$('.captionRow').hide();
			$(".dockable-handle").hide()
			setWiringOpenState(false); //going fullscreen
			updateFullscreenLeadSheetLineHost();
			updateFullscreenChartHost();
			getSong().getLayout().enterFullscreen();
		} else {
			if (getSong().captionsRowShowing){
				$('.captionRow').show();
			} else {
				$('.captionRow').hide();
			}
			$(".dockable-handle").show()
			$("#divESCAPE").hide();
			updateFullscreenLeadSheetLineHost();
			updateFullscreenChartHost();
			getSong().getLayout().leaveFullscreen();
		}
	}
	export function showTransport(parkMode = false) {
		TransportBuilder.showTransport(parkMode);
	}
	export function toggleTransport(){
		TransportBuilder.toggleTransport();
	}
	export function syncRecordingViews(){
		const recording = getSong()?.isRecording?.() === true;
		if (recording) {
			$('.RecordButton').addClass('ButtonOn');
		} else {
			$('.RecordButton').removeClass('ButtonOn');
		}
		return recording;
	}
	export function toggleRecording(){
		const recording = getSong()?.toggleRecording?.() === true;
		syncRecordingViews();
		if (recording) {
			clearRecordedNotes();
			showBeats(getSong().getBeat());
		}
		return recording;
	}
	export function toggleSectionDrawer(){
		TransportBuilder.toggleSectionDrawer();
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

	export function transposeSong(amount, options = {}){
		//options is {amount: 1, NamedNotes: true, doKeyLead:false}
		const song = getSong();
		const normalizedOptions = {
			NamedNotes: options.NamedNotes !== false,
			doKeyLead: !!options.doKeyLead
		};
		song.cycleThruKeysAllSections(amount, normalizedOptions.doKeyLead);
		if (normalizedOptions.NamedNotes){
			song.moveNamedNotesAllSections(amount);
		}
		if (song.isHeadless){
			return;
		}
		fullRepaint();
		//Did the whole song, but at least give visual cue that we did something by highlighting current section:
		var namedNoteName =  song.getCurrentSection().getRootNoteName();
		highlightOneNote(namedNoteName);
	}

	export function transposeSongKeys(amount, doKeyLead=false){
		const song = getSong();
		song.cycleThruKeysAllSections(amount, doKeyLead);
		if (song.isHeadless){
			return;
		}
		fullRepaint();
		showBeats();
	}

	export function updatePrintSections(){
		$("#divChartSummaryTab").html(SectionPrinter.printSections(getSong(), getSections(), false));
		$("#divChartDetailsTab").html(SectionPrinter.printSections(getSong(), getSections(), true));
		$("#divChartNotesTab")  .html(SectionPrinter.printSectionsNotes(getSong(), getSections()));
		$("#divChartOptionsTab").html(SectionPrinter.printChartOptions(getSong()));
		$("#divChartTab")       .html(SectionPrinter.printChart(getSong(), getSections()));
		$("#divChartLineTab")   .html(SectionPrinter.printLeadSheetLine(getSong(), getSections()));
		getChartInputController().ensurePanel('#divChartInputTab');
		updateFullscreenLeadSheetLineHost();
		updateFullscreenChartHost();
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

	export function printSectionsInput(){
		updatePrintSections();
		showChartTab("Input");
		showOneMenu("#divChart", true);
		getChartInputController().focusChordField();
	}

	export function printSectionsOptions(){
		updatePrintSections();
		showChartTab("Options");
		showOneMenu("#divChart", true);
	}

	export function printSectionsChart(){
		updatePrintSections();
		showChartTab("Chart");
		if (isFullscreenActive() || isStrictTutorial()) {
			setFullscreenChartVisible(true);
			return "Chart shown";
		}
		showOneMenu("#divChart", true);
		return "Chart shown";
	}

	export function printSectionsLine(){
		updatePrintSections();
		showChartTab("Line");
		if (isFullscreenActive() || isStrictTutorial()) {
			setFullscreenLeadSheetLineVisible(true);
			return "LeadSheetLine shown";
		}
		showOneMenu("#divChart", true);
		return "Chart Line shown";
	}

	export function linkToSectionChartPosition(idx, chartPosition) {
		getSong().sections[idx].chartPosition = chartPosition;
		let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
		if (doSectionChanged){
			sectionChanged();
		}
	}

	export function linkToSectionChartCaptionWidth(idx, chartCaptionWidth) {
		getSong().sections[idx].chartCaptionWidth = chartCaptionWidth;
		let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
		if (doSectionChanged){
			sectionChanged();
		}
	}

	export function linkToSectionBeatsPerBar(idx, beatsPerBar) {
		const section = getSong().sections[idx];
		if (!section) {
			return;
		}

		const rawValue = beatsPerBar == null ? '' : String(beatsPerBar).trim();
		if (!rawValue) {
			delete section.beatsPerBar;
			let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
			if (doSectionChanged){
				sectionChanged();
			}
			return;
		}

		if (!/^[1-9]\d*$/.test(rawValue)) {
			Messages.showMessages(`<b>Chart Details:</b> Section ${idx + 1} Beats must be a positive, non-zero integer.`);
			updatePrintSections();
			return;
		}

		section.beatsPerBar = rawValue;
		let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
		if (doSectionChanged){
			sectionChanged();
		}
	}

	export function linkToSectionCaption(idx, caption) {
		const section = getSong().sections[idx];
		if (!section) {
			return;
		}

		section.caption = caption;
		let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
		if (doSectionChanged){
			sectionChanged();
		}
	}

	export function linkToSongChartOption(optionName, optionValue) {
		if (optionName === 'HEADNames') {
			const doSectionChanged = (arguments.length < 3) ? true : arguments[2];
			linkToSongChartHeadNames(optionValue, doSectionChanged);
			return;
		}
		if (!getSong().chartOptions || typeof getSong().chartOptions !== 'object') {
			getSong().chartOptions = {};
		}
		if (optionName === 'stripTonalRoots' && optionValue !== true) {
			getSong().chartOptions.addTransposedRootToChord = false;
		}
		if (optionName === 'addTransposedRootToChord' && optionValue === true && getSong().chartOptions.stripTonalRoots !== true) {
			optionValue = false;
		}
		getSong().chartOptions[optionName] = optionValue;
		let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
		if (doSectionChanged){
			sectionChanged();
		}
	}

	export function linkToSongChartHeadNames(headNames) {
		if (!getSong().chartOptions || typeof getSong().chartOptions !== 'object') {
			getSong().chartOptions = {};
		}
		const normalizedHeadNames = SectionPrinter.normalizeChartHeadNames(headNames);
		getSong().chartOptions.HEADNames = normalizedHeadNames;

		if (!normalizedHeadNames.includes(Constants.SECTION_CHART_POSITION.HEAD)) {
			const replacementHeadName = normalizedHeadNames[0];
			getSong().sections.forEach((section) => {
				if (section?.chartPosition === Constants.SECTION_CHART_POSITION.HEAD) {
					section.chartPosition = replacementHeadName;
				}
			});
		}

		let doSectionChanged = (arguments.length < 2) ? true : arguments[1];
		if (doSectionChanged){
			sectionChanged();
		}
	}

	export function linkToSection(idx) {
		getSong().gotoSection(idx);
		hideCmdLine();
	}
	export function linkToSectionChartChord(idx, chartChord) {
		const section = getSong().sections[idx];
		const rootName = getSong().noteIDToNoteName(section?.rootID ?? 0);
		section.chartChord = canonicalizeChordForStorage(chartChord, { rootNoteName: rootName });
		let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
		if (doSectionChanged){
			sectionChanged(); //updateSectionsStatus(); //calls printSectionsNotes();
		}
	}
	export function linkToSectionChartMode(idx, chartMode) {
		const section = getSong().sections[idx];
		const rootName = getSong().noteIDToNoteName(section?.rootID ?? 0);
		section.chartMode = canonicalizeModeForStorage(chartMode, { rootNoteName: rootName });
		let doSectionChanged = (arguments.length < 3) ? true : arguments[2];
		if (doSectionChanged){
			sectionChanged(); //updateSectionsStatus(); //calls printSectionsNotes();
		}
	}

	export function linkToSectionChangedTonal(){
		sectionChanged();
	}

		export function linkToSectionTableTonalSourceSet(idx, tableID, tonalSourceSet) {
			let section = getSong().sections[idx];
			if (!section){
				return;
			}
			let sn = section.getSectionNotes(tableID);
			sn.tonalSourceSet = tonalSourceSet;
			let doSectionChanged = (arguments.length < 4) ? true : arguments[3];
			if (doSectionChanged){
				sectionChanged();
			}
		}

	export function linkToSectionTableChord(idx, tableID, chord) {
		let section = getSong().sections[idx];
		let sn = section.sectionNotesByTable[tableID];
		if (!sn){
			return;	
		}
		const rootName = getSong().noteIDToNoteName(section?.rootID ?? 0);
		sn.chord = canonicalizeChordForStorage(chord, { rootNoteName: rootName });
		let doSectionChanged = (arguments.length < 4) ? true : arguments[3];
		if (doSectionChanged){
			sectionChanged();
		}
	}

	export function linkToSectionTableMode(idx, tableID, mode) {
		let section = getSong().sections[idx];
		let sn = section.sectionNotesByTable[tableID];
		if (!sn){
			return;	
		}
		const rootName = getSong().noteIDToNoteName(section?.rootID ?? 0);
		sn.mode = canonicalizeModeForStorage(mode, { rootNoteName: rootName });
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
		showAllNoteNames(isChecked);
	}

	export function toggleShowAllNoteNames(){
		let isChecked = $("#cbShowAllNoteNames").prop("checked");
		console.log("toggleShowAllNoteNames isChecked: "+isChecked);
		showAllNoteNames(!isChecked);
	}

	export function showAllNoteNames(show){
		console.log("showAllNoteNames: "+show);
		$("#cbShowAllNoteNames").prop("checked", !!show);
		$('#btnShowAllNoteNames')
			.toggleClass("BtnPunchedIn", !!show)
			.toggleClass("BtnPunchedOut", !show);
		$('body').toggleClass('ShowAllNoteNames', !!show);
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

		if (getSong().allowThemeAutomation){
			let sectionTheme = options.sectionTheme;
			if (sectionTheme){
				$('#selThemes').val(sectionTheme).trigger('change');
			}

		}
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

		PalettePresentation.setAutomaticColorUi(options.autoColor);

		//ignore #cbPresentationMode because it is Song-scope, not Section-scope.
		if (naturalFontScaling != null){
			$("#selNaturalFontScaling").val(String(naturalFontScaling));
		}
		$("#selPianoHeightScaleFactor").val(String(options.pianoHeightScaleFactor ?? 3));
		$("#selPianoWidthScaleFactor").val(String(options.pianoWidthScaleFactor ?? 3));
		$("#selPianoWhiteToBlackWidthRatio").val(String(options.pianoWhiteToBlackWidthRatio ?? '2.3'));
			$("#selPianoFingeringHPosition").val(String(options.pianoFingeringHPosition ?? '50%'));
		$("#cbShowLooperLightBeats").prop("checked", options.showLooperLightBeats ?? true);
		$("#selNoteFont").val(options.noteFont);
		$("#selLeftSubscriptFontSize").val(options.leftSubscriptFontSize);
		$("#selRightSubscriptFontSize").val(options.rightSubscriptFontSize);
		$("#selMidiFontSize").val(options.midiFontSize);
		$("#selFingeringFontSize").val(options.fingeringFontSize);
		$("#selFingeringPosition").val(options.fingeringPosition);
		$("#selTinyNoteFontSize").val(options.tinyNoteFontSize);
		$("#selTinyNoteMaxHeight").val(options.tinyNoteMaxHeight);
		$("#selTinyNoteVPosition").val(options.tinyNoteVPosition);
		$("#selTinyNoteWidth").val(options.tinyNoteWidth);
		$("#selTinyNoteHPosition").val(options.tinyNoteHPosition);
		$("#selTinyNoteRadius").val(options.tinyNoteRadius);
		
		setOneCssVar("--td-note-font-family",  $("#selNoteFont").val());
		setOneCssVar("--left-subscript-font-size", $("#selLeftSubscriptFontSize").val());
		setOneCssVar("--right-subscript-font-size", $("#selRightSubscriptFontSize").val());
		setOneCssVar("--tiny-note-max-height", $("#selTinyNoteMaxHeight").val());
		setOneCssVar("--tiny-note-vposition",  $("#selTinyNoteVPosition").val());
		setOneCssVar("--tiny-note-width",      $("#selTinyNoteWidth").val());
		setOneCssVar("--tiny-note-max-width",  $("#selTinyNoteMaxWidth").val());
		setOneCssVar("--tiny-note-hposition",  $("#selTinyNoteHPosition").val());
		setOneCssVar("--tiny-note-radius",     $("#selTinyNoteRadius").val());
		setOneCssVar("--tiny-note-font-size",  $("#selTinyNoteFontSize").val());
		setOneCssVar("--midi-font-size",       $("#selMidiFontSize").val());
		setOneCssVar("--fingering-font-size",  $("#selFingeringFontSize").val());
		setOneCssVar("--fingering-position",   $("#selFingeringPosition").val());
		setOneCssVar("--piano-fingering-hposition", $("#selPianoFingeringHPosition").val());
		updateDisplayOptionsReadonlyValues();
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
		options.pianoHeightScaleFactor = $("#selPianoHeightScaleFactor").val();
		options.pianoWidthScaleFactor = $("#selPianoWidthScaleFactor").val();
		options.pianoWhiteToBlackWidthRatio = $("#selPianoWhiteToBlackWidthRatio").val();
		options.pianoFingeringHPosition = $("#selPianoFingeringHPosition").val();
		options.showLooperLightBeats = $("#cbShowLooperLightBeats").prop("checked");
		options.noteFont = $("#selNoteFont").val();
		options.leftSubscriptFontSize = $("#selLeftSubscriptFontSize").val();
		options.rightSubscriptFontSize = $("#selRightSubscriptFontSize").val();
		options.midiFontSize = $("#selMidiFontSize").val();
		options.fingeringFontSize = $("#selFingeringFontSize").val();
		options.fingeringPosition = $("#selFingeringPosition").val();
		options.tinyNoteFontSize = $("#selTinyNoteFontSize").val();
		options.tinyNoteMaxHeight = $("#selTinyNoteMaxHeight").val();
		options.tinyNoteVPosition = $("#selTinyNoteVPosition").val();
		options.tinyNoteWidth = $("#selTinyNoteWidth").val();
		options.tinyNoteHPosition = $("#selTinyNoteHPosition").val();
		options.tinyNoteRadius = $("#selTinyNoteRadius").val();
		
		//This is for storing theme, but only if allowThemeAutomation is in effect:
		if (getSong().allowThemeAutomation){
			options.sectionTheme = $('#selThemes').val();
		}

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
		$(".showCaptionRowButtons")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
			$(".captionRowNoteCell").toggle();
			$(".captionRowButtons").toggle();
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
		$(".toggleCaptionLooperLayout")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				getSong().getLayout().toggleCaptionLooperLayout();
		});
		$(".showLeftCaption")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				let tableID = $(this).data('tableid');
				let CaptionLeft = $('#'+tableID+'_leftRailCaptionHost').toggle().css('display') !== 'none';
				getSong().setNoteTablesLayoutOption(tableID, "CaptionLeft", CaptionLeft);
		});
		$(".swapToolTopCaption")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				let tableID = $(this).data('tableid');
				let TopToolCaption = $('#'+tableID+'_TopToolCaptionHost').toggle().css('display') !== 'none';
				//We also have a div that has to be toggled:
				$('#'+tableID+'_TopToolCaptionHost_Div').toggle(TopToolCaption).css('display') !== 'none';
				// Then make the inline one be the opposite:
				let InlineToolCaption = $('#'+tableID+'_InlineToolCaptionHost').toggle(!TopToolCaption).css('display') !== 'none';
				getSong().setNoteTablesLayoutOption(tableID, "TopToolCaption", TopToolCaption);
		});
		$(".clearFloatRectRecordButton")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				let tableID = $(this).data('tableid');
				let entry = getSong().noteTablesLayout.find((one) => one.tableID === tableID);
				if (entry?.anchorage?.floatRect){
					entry.anchorage.floatRect = {};
				}
		});
		$(".showLeftSectionStatus")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				let tableID = $(this).data('tableid');
				let SectionStatusLeft = $('#'+tableID+'_leftRailSectionStatusHost').toggle().css('display') !== 'none';
				getSong().setNoteTablesLayoutOption(tableID, "SectionStatusLeft", SectionStatusLeft);
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

		// Tool tables: toggle freeze/unfreeze of the current View DisplayOptions (colors,
		// opacities, fonts, etc.) into noteTablesLayout[].ToolDisplayOptions. Button reads
		// "F" (Freeze) when no ToolDisplayOptions exists yet, or "U" (Unfreeze) once it does --
		// mirroring how the Save Display Options button reflects section.displayOptions state.
		// Deliberately does NOT touch rootID/rootIDLead/sharps/noteNamesFuncArr: Tool tables
		// must keep following the live current Section for those so the same fixed set of
		// NamedNotes keeps recoloring/relabeling correctly as the song moves between Sections/keys.
		$(".toolDisplayOptionsToggleButton")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
			let tableID = $(this).data('tableid');
			const song = getSong();
			const existingEntry = song.getNoteTablesLayout().find((one) => one.tableID === tableID);
			if (existingEntry && existingEntry.ToolDisplayOptions) {
				song.clearToolDisplayOptions(tableID);
			} else {
				song.setToolDisplayOptions(tableID, controlsToDisplayOptions());
			}
			const updatedEntry = song.getNoteTablesLayout().find((one) => one.tableID === tableID);
			updateToolDisplayOptionsToggleButton(tableID, updatedEntry);
			resetNoteNames();
		});

	}

	function updateToolDisplayOptionsToggleButton(tableID, entry){
		const button = $(`.toolDisplayOptionsToggleButton[data-tableid="${tableID}"]`);
		if (button.length === 0) {
			return;
		}
		if (entry && entry.ToolDisplayOptions) {
			button.text('UF').attr('title', "Unfreeze DisplayOptions");
		} else {
			button.text('Fr').attr('title', 'Freeze DisplayOptions');
		}
	}

	export function setUIFromNoteTablesLayoutOptions(){
		const song = getSong();
		if (!song) {
			return;
		}

		const layout = typeof song.getNoteTablesLayout === 'function'
			? song.getNoteTablesLayout()
			: (Array.isArray(song.noteTablesLayout) ? song.noteTablesLayout : []);

		layout.forEach((entry) => {
			const tableID = `${entry?.tableID || ''}`.trim();
			if (!tableID) {
				return;
			}

			const sectionStatusLeft = entry?.SectionStatusLeft === true;
			const captionLeft = entry?.CaptionLeft === true;
			const TopToolCaption = entry?.TopToolCaption === true;

			$(`#${tableID}_leftRailSectionStatusHost`).toggle(sectionStatusLeft);
			$(`#${tableID}_leftRailCaptionHost`).toggle(captionLeft);

			$(`#${tableID}_TopToolCaptionHost`).toggle(TopToolCaption);
			//We also have a div that has to be toggled:
			$('#'+tableID+'_TopToolCaptionHost_Div').toggle(TopToolCaption);
			// Then make the inline one be the opposite:
			$('#'+tableID+'_InlineToolCaptionHost').toggle(!TopToolCaption);

			updateToolDisplayOptionsToggleButton(tableID, entry);
		});
	}

	function showLoopSectionsStarted(data){
        const caption = (data && data.caption)
            ? data.caption
            : (getSong() && getSong().randomLoop ? 'RANDOM....' : 'LOOPING...');
        $('#btnLoopSections').html(caption).addClass('ButtonOn');
        $('.classLoopSections').html(caption).addClass('ButtonOn');
		EventBus.trigger('Widget:SectionStatus:loopChanged', {
			isLoopActive: true
		});
    }

    function showLoopSectionsStopped(){
        $('#btnLoopSections').html('LOOP').removeClass('ButtonOn');
        $('.classLoopSections').html('LOOP').removeClass('ButtonOn');
		EventBus.trigger('Widget:SectionStatus:loopChanged', {
			isLoopActive: false
		});
    }

	export function toggleAutoColorCheckbox(){
		var cbac = $("#cbAutomaticColor");
		PalettePresentation.setAutomaticColorUi(!cbac.prop("checked"));
		$("#cbAutomaticColor").trigger("change");
		resetNoteNames();
	}
	export function turnOffAutoColorCheckbox(){
		PalettePresentation.setAutomaticColorUi(false);
		$("#cbAutomaticColor").trigger("change");
		resetNoteNames();
	}

	export function handleBtnControlsToDisplayOptions() {
		var options = controlsToDisplayOptions();
		getCurrentSection().displayOptions = options;
		THEME_INFO("controlsToDisplayOptions: <br>"+JSON.stringify(options, null, 2));
		showHideDisplayOptionsPresent();
		captureDisplayOptionsDirtyBaseline();
	}
	
	export function handleBtnDeleteDisplayOptions() {
		delete getCurrentSection().displayOptions;
		showHideDisplayOptionsPresent();
		captureDisplayOptionsDirtyBaseline();
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

	export function runMobileCommandLine(line){
		const result = runMacroLine(line);
		updateCmdLineView();
		return result;
	}


	//==================== 4) UI event binding and control wiring =============

	function showChartTab(which) {
		var showNotesTab = which === "Notes";
		var showSummaryTab = which === "Summary";
		var showInputTab = which === "Input";
		var showDetailsTab = which === "Details";
		var showOptionsTab = which === "Options";
		var showChartOnlyTab = which === "Chart";
		var showLineTab = which === "Line";
		
		$('#divChartSummaryTab').toggle(showSummaryTab);
		$('#divChartInputTab').toggle(showInputTab);
		$('#divChartNotesTab').toggle(showNotesTab);
		$('#divChartDetailsTab').toggle(showDetailsTab);
		$('#divChartOptionsTab').toggle(showOptionsTab);
		$('#divChartTab').toggle(showChartOnlyTab);
		$('#divChartLineTab').toggle(showLineTab);

		$('#btnChartSummaryTab')
			.toggleClass('BtnPunchedIn', showSummaryTab)
			.toggleClass('BtnPunchedOut', !showSummaryTab);
		$('#btnChartInputTab')
			.toggleClass('BtnPunchedIn', showInputTab)
			.toggleClass('BtnPunchedOut', !showInputTab);
		$('#btnChartNotesTab')
			.toggleClass('BtnPunchedIn', showNotesTab)
			.toggleClass('BtnPunchedOut', !showNotesTab);
		$('#btnChartDetailsTab')
			.toggleClass('BtnPunchedIn', showDetailsTab)
			.toggleClass('BtnPunchedOut', !showDetailsTab);
		$('#btnChartOptionsTab')
			.toggleClass('BtnPunchedIn', showOptionsTab)
			.toggleClass('BtnPunchedOut', !showOptionsTab);
		$('#btnChartTab')
			.toggleClass('BtnPunchedIn', showChartOnlyTab)
			.toggleClass('BtnPunchedOut', !showChartOnlyTab);
		$('#btnChartLineTab')
			.toggleClass('BtnPunchedIn', showLineTab)
			.toggleClass('BtnPunchedOut', !showLineTab);	
	}

	function showDesktopTab(which) {
		var showKeyboardTab = which !== "Buttons";
		var showButtonsTab = !showKeyboardTab;

		$('#divMobileKeyboard').toggle(showKeyboardTab);
		$('#divDesktopButtons').toggle(showButtonsTab);

		$('#btnDesktopTabKeyboard')
			.toggleClass('BtnPunchedIn', showKeyboardTab)
			.toggleClass('BtnPunchedOut', !showKeyboardTab);
		$('#btnDesktopTabButtons')
			.toggleClass('BtnPunchedIn', showButtonsTab)
			.toggleClass('BtnPunchedOut', !showButtonsTab);
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

		function bindDisplayOptionsDirtyEvent(events, selector){
			const namespacedEvents = events
				.split(' ')
				.map((eventName) => `${eventName}${eventNamespace}.displayOptionsDirty`)
				.join(' ');
			$(selector)
				.off(namespacedEvents)
				.on(namespacedEvents, function() {
					refreshDisplayOptionsSaveActionRequired();
				});
		}

		function bindDelegatedEvent(events, selector, handler){
			const namespacedEvents = namespaceEvents(events);
			$(document)
				.off(namespacedEvents, selector)
				.on(namespacedEvents, selector, handler);
		}

		function isPlainEnterKey(e) {
			return e.key === 'Enter'
				&& !e.shiftKey
				&& !e.ctrlKey
				&& !e.altKey
				&& !e.metaKey
				&& !e.isComposing;
		}

		function commitFieldOnEnter(e) {
			if (!isPlainEnterKey(e)) {
				return;
			}
			e.preventDefault();
			this.blur();
		}

		function openChartCaptionEditor(container) {
			const jContainer = $(container);
			jContainer.find('.sectionChartCaptionDisplay, .sectionChartCaptionEditButton').prop('hidden', true);
			jContainer.find('.sectionChartCaptionEditor').prop('hidden', false);
			const textarea = jContainer.find('.sectionChartCaptionTextarea').get(0);
			if (textarea) {
				textarea.focus();
				textarea.setSelectionRange(textarea.value.length, textarea.value.length);
			}
		}
		
		bindDelegatedEvent('click', '.graveyard-raise-link', function(e) {
			e.preventDefault();
			const index = toInt($(this).data('grave-index'), -1);
			if (index >= 0) {
				getSong().graveyard.raise(index);
			}
		});

		bindDelegatedEvent('click', '.graveyard-delete-link', function(e) {
			e.preventDefault();
			const index = toInt($(this).data('grave-index'), -1);
			if (index >= 0) {
				getSong().graveyard.deleteRecordByIndex(index);
				Messages.showMessages(getSong().graveyard.buildGraveyardTable());
			}
		});

		bindDelegatedEvent('click', '#divInfoRendered a[href^="#raise="], #divInfoRendered a[href^="#macro="], #divTutorialPrompt a[href^="#raise="], #divTutorialPrompt a[href^="#macro="]', function(e) {
			e.preventDefault();
			const href = $(this).attr('href') || '';
			if (href) {
				if (window.history && typeof window.history.pushState === 'function') {
					window.history.pushState(null, '', href);
				}
				handleInfoActionFragment(href);
			}
		});

		bindDelegatedEvent('click', '#divInfoRendered a[href^="help.html#"], #divInfoRendered a[href^="help-plugins.html#"]', function(e) {
			e.preventDefault();
			const href = ($(this).attr('href') || '').trim();
			if (href) {
				window.open(href, 'infinitehelp');
			}
		});

		bindDelegatedEvent('click', '.graveyard-toggle-json', function(e) {
			e.preventDefault();
			const target = $(this).data('target');
			if (target) {
				const jTarget = $(target);
				jTarget.toggle();
				const deleteTarget = $(this).data('delete-target');
				if (deleteTarget) {
					$(deleteTarget).toggle(jTarget.is(':visible'));
				}
				const moreText = $(this).data('more-text');
				const lessText = $(this).data('less-text');
				if (moreText && lessText) {
					const nextText = jTarget.is(':visible') ? lessText : moreText;
					$(this).empty().append($('<u></u>').text(nextText));
				}
			}
		});

		bindDelegatedEvent('keydown', '#txtFilename, #txtBPM, #txtCaption, .inputTuningID, .sectionChartBeatsPerBarInput', commitFieldOnEnter);
		bindDelegatedEvent('change', '.sectionChartBeatsPerBarInput', function() {
			const idx = toInt($(this).data('section-idx'), -1);
			if (idx >= 0) {
				linkToSectionBeatsPerBar(idx, $(this).val());
			}
		});
		bindDelegatedEvent('change', '.sectionChartPositionSelect', function() {
			const idx = toInt($(this).data('section-idx'), -1);
			if (idx >= 0) {
				linkToSectionChartPosition(idx, $(this).val());
			}
		});
		bindDelegatedEvent('change', '.sectionChartCaptionWidthSelect', function() {
			const idx = toInt($(this).data('section-idx'), -1);
			if (idx >= 0) {
				linkToSectionChartCaptionWidth(idx, $(this).val());
			}
		});
		bindDelegatedEvent('dblclick', '.sectionChartCaptionDisplay', function() {
			openChartCaptionEditor($(this).closest('.sectionChartCaptionCell'));
		});
		bindDelegatedEvent('click', '.sectionChartCaptionEditButton', function() {
			openChartCaptionEditor($(this).closest('.sectionChartCaptionCell'));
		});
		bindDelegatedEvent('click', '.sectionChartCaptionSaveButton', function() {
			const container = $(this).closest('.sectionChartCaptionCell');
			const idx = toInt(container.data('section-idx'), -1);
			if (idx >= 0) {
				linkToSectionCaption(idx, container.find('.sectionChartCaptionTextarea').val());
			}
		});
		bindDelegatedEvent('change', '.songChartOptionsCheckbox', function() {
			const optionName = $(this).data('chart-option');
			if (optionName) {
				linkToSongChartOption(optionName, $(this).prop('checked'));
			}
		});
		bindDelegatedEvent('change', '.songChartBarClassSelect', function() {
			linkToSongChartOption('barClass', $(this).val());
		});
		bindDelegatedEvent('change', '.songChartSpacingSelect', function() {
			linkToSongChartOption('chartSpacing', $(this).val());
		});
		bindDelegatedEvent('change', '.songChartFontsizeSelect', function() {
			const optionName = $(this).data('chart-option');
			if (optionName) {
				linkToSongChartOption(optionName, $(this).val());
			}
		});
		bindDelegatedEvent('change blur', '.songChartHeadNamesTextarea', function() {
			const headNames = SectionPrinter.parseChartHeadNamesTextarea($(this).val());
			linkToSongChartHeadNames(headNames);
		});
		bindDelegatedEvent('keydown', '#txtColorSchemeName', function(e) {
			if (!isPlainEnterKey(e)) {
				return;
			}
			e.preventDefault();
			$('#btnRecordUserColors').trigger('click');
			$(this).trigger('blur');
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
		bindEvent('click', '#btnChartInputTab', function() {
			showChartTab("Input");
			getChartInputController().ensurePanel('#divChartInputTab');
			getChartInputController().focusChordField();
		});
		bindEvent('click', '#btnChartNotesTab', function() {
			showChartTab("Notes");
		});
		bindEvent('click', '#btnChartDetailsTab', function() {
			showChartTab("Details");
		});
		bindEvent('click', '#btnChartOptionsTab', function() {
			showChartTab("Options");
		});
		bindEvent('click', '#btnChartTab', function() {
			showChartTab("Chart");
		});
		bindEvent('click', '#btnChartLineTab', function() {
			showChartTab("Line");
		});
		//=========================================
		bindEvent('click', '#btnDesktopTabKeyboard', function() {
			showDesktopTab("Keyboard");
		});
		bindEvent('click', '#btnDesktopTabButtons', function() {
			showDesktopTab("Buttons");
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
		bindEvent('change', '#cbAllowThemeAutomation', function(){
			getSong().allowThemeAutomation = this.checked;
			updateDisplayOptionsReadonlyValues();
		});

		bindEvent('click', '#btnMessagesTab', function() {
			Messages.showMessagesTab('Messages');
		});
		bindEvent('click', '#btnJsonTreeTab', function() {
			Messages.showMessagesTab('JsonTree');
		});
		bindEvent('click', '#btnUserLog', function() {
			Messages.showMessagesTab('UserLog');
		});
		bindEvent('click', '#btnHideMessagesJsonTree', function() {
			Messages.hideMessages_KeyHandler();
		});

		bindEvent('click', '#btnFileControls', function() {
		    showOneMenu("#divFileControls")
		});
		bindEvent('click', '#btnInfo', function() {
			let forceMode = isFloaty() ? 'float' : 'parked';
			showInfoDialog(forceMode);
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
		bindEvent('click', '#btnRunMobileCmdLine', function() {
			let line = $('#txtMobileCmdLine').val();
			runMobileCommandLine(line);
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
		bindEvent('click', '#btnPrevSection', function() {
			runActionByName('prevSection');
		});
		bindEvent('click', '#btnNextSection', function() {
			runActionByName('nextSection');
		});
		bindEvent('click', '#btnFirstSection', function() {
			runActionByName('firstSection');
		});
		bindEvent('click', '#btnLastSection', function() {
			runActionByName('lastSection');
		});

		bindEvent('click', '#btnLoopSections', function() {
		    runActionByName('toggleLoopSections');
		});
		bindEvent('click', '#btnLoopBeats', function() {
		    runActionByName('toggleLoopBeats');
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
			toggleRecording();
		});

		bindEvent('click', '#btnPrevBeat', function() {
			runActionByName('prevBeat');
		});
		bindEvent('click', '#btnNextBeat', function() {
			runActionByName('nextBeat');
		});
		bindDelegatedEvent('click', '#transport button', function() {
			if ($(this).closest('#sectionDrawer').length > 0) {
				return;
			}
			this.blur();
		});
		bindEvent('change', '#txtFilename', function() {
			getSong().songName = $(this).val();
			$(".lblSongName").html(getSong().songName);
		});

		bindEvent('change', '#txtBPM', function() {
			getTransportController().setBPM($(this).val());
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
		bindEvent('change', '#cbNaturalFretWidths,#selNaturalFontScaling,#selPianoHeightScaleFactor,#selPianoWidthScaleFactor,#selPianoWhiteToBlackWidthRatio,#selPianoFingeringHPosition', function(){
			setOneCssVar("--piano-fingering-hposition", $("#selPianoFingeringHPosition").val());
			fullRepaint();
		});
		bindEvent('change', '#cbShowLooperLightBeats', function() {
			updateSectionsStatus();
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
		bindEvent('change', '#selTinyNoteVPosition', function(){
			setOneCssVar("--tiny-note-vposition", $("#selTinyNoteVPosition").val());
			fullRepaint();
		});
		bindEvent('change', '#selTinyNoteWidth', function(){
			setOneCssVar("--tiny-note-width", $("#selTinyNoteWidth").val());
			fullRepaint();
		});
		bindEvent('change', '#selTinyNoteHPosition', function(){
			setOneCssVar("--tiny-note-hposition", $("#selTinyNoteHPosition").val());
			fullRepaint();
		});
		bindEvent('change', '#selTinyNoteRadius', function(){
			setOneCssVar("--tiny-note-radius", $("#selTinyNoteRadius").val());
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
		bindDisplayOptionsDirtyEvent('change input', '#divViewControls input:not(#cbPresentationMode):not(#cbAllowThemeAutomation), #divViewControls select, #divViewControls textarea');
		bindDisplayOptionsDirtyEvent('click', '#btnFunctionSymbolsReset');
		bindDelegatedEvent('change', '#cbAutomaticColor', function() {
			refreshDisplayOptionsSaveActionRequired();
		});
	}
	
	export function bindDataActionHandlers(){
		const dataActionHandlers = {
			help: () => window.open(getHelpTopic(), 'infinitehelp'),
			songLibrary,
			showGraveyard,
			showDisplayOptions,
			increaseUIFont,
			decreaseUIFont,
			increaseNoteFont,
			decreaseNoteFont,
			ChromeFullscreen,
			enterFullscreen,
			leaveFullscreen,
			hideAllMenuDivs,
			saveScalingPrefs,
			applyScalingPrefs,
			clearScalingPrefs,
			loadSong,
			linkToSection,
			linkToSectionChartChord,
			linkToSectionChartMode,
			tutorialToggleHamburgerControls,
			tutorialToggleSectionList,
			tutorialGotoSection,
			tutorialToggleDone,
			tutorialToggleBookmark,
			tutorialToggleIncludeInLooping,
			tutorialToggleAllIncludeInLooping,
			tutorialNextSection,
			tutorialPrevSection,
			tutorialFirstSection,
			tutorialLastSection,
			tutorialLoopBeats,
			tutorialLoopSections,
			hideGraveyard,
			saveInstrumentPrefs,
			applyInstrumentPrefs,
			clearInstrumentPrefs,
			copyApprovedPattern,
			copySongLink
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

	function installHeadlessJQueryStub() {
		if (typeof globalThis.$ === 'function') {
			return;
		}

		const chain = {
			length: 0,
			each() { return this; },
			html(value) { return value === undefined ? '' : this; },
			val(value) { return value === undefined ? '' : this; },
			show() { return this; },
			hide() { return this; },
			toggle() { return this; },
			empty() { return this; },
			append() { return this; },
			prepend() { return this; },
			appendTo() { return this; },
			remove() { return this; },
			find() { return this; },
			prop(name, value) { return value === undefined ? undefined : this; },
			attr(name, value) { return value === undefined ? undefined : this; },
			data(name, value) { return value === undefined ? undefined : this; },
			on() { return this; },
			off() { return this; },
			change() { return this; },
			click() { return this; },
			trigger() { return this; },
			is() { return false; },
			get() { return undefined; },
			map() { return []; },
			text(value) { return value === undefined ? '' : this; },
			addClass() { return this; },
			removeClass() { return this; },
			toggleClass() { return this; },
			focus() { return this; },
			blur() { return this; }
		};

		globalThis.$ = function () {
			return chain;
		};
		globalThis.jQuery = globalThis.$;
	}

	// Headless replacement for document.ready for testing
	export function setupSongTests() {
		installHeadlessJQueryStub();
		Globals.setSong(new Song());   //var song global in this file (at top).
		Globals.getSong().setHeadless(true, true);
		Globals.getSong().ensureDefaultSection();
		pluginManager.loadSongPluginState(Globals.getSong());

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

		Globals.setSong(new Song());
		Globals.getSong().ensureDefaultSection();
		pluginManager.loadSongPluginState(Globals.getSong());

		
		installAllTuningsTables();
		installBtnHamburgerClicks();
		setupOpenFile();

		/* This presto-magico grabs all the View menu page options 
		 *  and routes them as defaults, as though you had Save Display Options on Section 1.
		 *  This way, if you haven't, you still get the defaults we coded into the controls in index.html
		 */  
		let options = controlsToDisplayOptions();
		if (options){
			displayOptionsToControls(options);
		}

		sectionChanged();
		installTDNoteClick();
		bindDesktopEvents();
		installLoopTimingModeControls();
		applyScalingPrefs(true);
		captureDisplayOptionsNavigationDefault();
		captureDisplayOptionsDirtyBaseline();
		
		$('#textareaFunctionSymbols').val(JSON.stringify(getSong().noteNamesFuncArr));
		
		setOneCssVar("--cmd-menu-opacity", "90%");

		var currentFilename = $("#txtFilename").val();
		$(".lblSongName").html(currentFilename);
		getSong().songName = currentFilename;
		refreshFileMenuSongInstrumentBadges();
		$('.topControlsCaptions').show();

		
      	$("#lblHideWarning").hide(); //in divViewControls

		showHideDisplayOptionsPresent();  //enables and disables btnDeleteDisplayOptions_* etc.
 		hideAllMenuDivs();
		$("#divQuick").hide();
		$("#CmdMenu").hide();
		SongLibrary.initializeSongLibrary('#divSongList');
		setLoopSectionFilter((candidateIndex, context = {}) => filterStrictLoopSectionIndex(candidateIndex, {
			...context,
			strictTutorial: normalizeTutorialMode(isStrictTutorial()),
			sectionCount: getSong()?.getSections?.().length ?? context.sectionCount,
			includeInLoopingSectionIndexes: tutorialRuntimeState.includeInLoopingSectionIndexes || []
		}));

		updateFontLabel();

		loadTemplates('templates/palette.html').then(() => {
			PaletteBuilder.addToDest("#divPalette");
			installDefaultColorDicts();
			applyStylesheetsTo_gUserColorDict();
			buildColorDicts();
			$('#divColorDicts').hide();
			$("#CustomColorEditors").hide();

			buildUserColors();
			installRBColorChangeEvents();

			// Palette startup should use the shared AutoColor initializer directly,
			// not a synthetic change event on a stale checkbox state.
			PalettePresentation.setAutomaticColorUi(true);
			fullRepaint();

			// The palette loads asynchronously, so recapture the startup navigation
			// defaults only after AutoColor and the palette controls really exist.
			captureDisplayOptionsNavigationDefault();
			captureDisplayOptionsDirtyBaseline();
		});


		bindDataActionHandlers();
		TuningsLibrary.bindFormTuningsEvents();
		

		$(document).on('keydown', document_keydown);
		$(document).on('keypress', document_keypress);
		$("#txtCmdLine").on('keydown', txtCmdLine_keydown);
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
		showDesktopTab("Keyboard"); //choose tab but don't show Desktop menu yet.
		getSong().getLayout().leaveFullscreen();
		scrollToTop();

		const promises = [
			loadTemplates().then(() => {
				getSong().getVisibleTuningIDs().forEach(tuningID => {
					WiringBuilder.addWiringWidget(tuningID, Constants.TABLE_ID_PREFIX+tuningID);
				});
				setWiringOpenState(false);
			}),

			loadTemplates('templates/info/info.html').then(() => {
				InfoBuilder.addToDest('#divInfo');
				InfoBuilder.renderFromSong(getSong());
			}),

			loadTemplates('templates/mobile-keyboard/mobile-keyboard.html').then(() => {
				MobileKeyboardBuilder.addToDest('#divMobileKeyboard');
				MobileKeyboardBuilder.renderFromSong(getSong());
			}),

			loadTemplates('templates/macros/macros.html').then(() => {
				MacroBuilder.addToDest('#divMacros');
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
				SectionStatusBuilder.addToDest('#spanSectionStatusLeadSheetHost', 'leadsheet', 'leadSheet', 'horizontal');
	
			}),

			loadTemplates('templates/tutorial/tutorial.html').then(() => {
				TutorialPromptBuilder.addToDest('#divTutorialPrompt');
				renderTutorialPrompt();
	
			})
		];
		Promise.all(promises).then(() => {
			setSectionKeysFlats();  //The default. Calls resetNoteNames();
			EventBus.trigger('ReinstallAllTuningsTables');
			EventBus.trigger('UpdateAllWiringSelects');
			setWiringOpenState(false);
			gAppInit_running = false;
			loadSongFromUrlQueryParam();
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
	refreshFileMenuSongInstrumentBadges();
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
EventBus.on('SongUiUpdatePrintSections', function() {
	updatePrintSections();
});
EventBus.on('SongUiClearAndReplaySection', function() {
	clearAndReplaySection();
});
EventBus.on('NoteTableCache:invalidate', function() {
	invalidateNoteTableRenderCache();
});
EventBus.on('NoteTableCache:prewarmNextSection', function(event, data) {
	prewarmNextSectionNoteTables(data || {});
});
EventBus.on('NoteTableCache:prewarmSection', function(event, data) {
	prewarmNoteTablesForSection(data?.sectionIndex, data || {});
});
EventBus.on('ShowMessages', function(event, data) {
	Messages.showMessages(data && data.html ? data.html : '');
});
EventBus.on('UserLog', function(event, data) {
	UserLog.addToUserLog(data?.subSystem || '', data?.message || '');
});
EventBus.on('PluginManager:ShowResult', function(event, data) {
	if (data && data.result) {
		addCmdResults(`${data.pluginId}:${data.eventName} >> ${data.result}`);
	}
	if (data && data.message) {
		UserLog.addToUserLog(data?.subSystem || 'PluginManager', data.message);
	}
});
EventBus.on('PluginGraveyard:linkAdded', function() {
	InfoBuilder.renderFromSong(getSong());
});

function refreshPluginMenus() {
	pluginManager.refreshPluginsMenuNode();
}

EventBus.on('ReinstallAllTuningsTables', function() {
	EventBus.trigger('NoteTableCache:invalidate', { reason: 'ReinstallAllTuningsTables' });
	reinstallAllTuningsTables();
	refreshPluginMenus();
});
EventBus.on('UpdateAllWiringSelects', function() {
	getSong().getVisibleTuningIDs().forEach(tuningID => {
		WiringBuilder.addWiringWidget(tuningID, Constants.TABLE_ID_PREFIX+tuningID);
	});
	updateAllWiringSelects();
	refreshPluginMenus();
});
EventBus.on('InstrumentAdded', function() {
	//setWiringOpenState(true);  // to open
	refreshPluginMenus();
});
EventBus.on('Wiring:added', function() {
	requestReloadTuningsDisplays();
	refreshPluginMenus();
});
EventBus.on('Wiring:removed', function() {
	requestReloadTuningsDisplays();
	refreshPluginMenus();
});
EventBus.on('TableVisibility:changed', function() {
	refreshFileMenuSongInstrumentBadges();
});
EventBus.on('TableLayout:changed', function() {
	refreshFileMenuSongInstrumentBadges();
});
EventBus.on('Looper:OnLoopBeatsStart', function() {
	$('#btnLoopBeats').addClass('ButtonOn');
	$('.classLoopBeats').addClass('ButtonOn');
	EventBus.trigger('Widget:SectionStatus:loopChanged', {
		isLoopActive: true
	});
});
EventBus.on('Looper:OnLoopBeatsStop', function() {
	$('#btnLoopBeats').removeClass('ButtonOn');
	$('.classLoopBeats').removeClass('ButtonOn');
	EventBus.trigger('Widget:SectionStatus:loopChanged', {
		isLoopActive: false
	});
});
EventBus.on('Looper:OnLoopSectionsStart', function(event, data) {
    showLoopSectionsStarted(data);
});
EventBus.on('Looper:OnLoopSectionsStop', function() {
    showLoopSectionsStopped();
});


