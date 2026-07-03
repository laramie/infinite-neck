import { jest } from '@jest/globals';

const mockEventBus = {
	trigger: jest.fn(),
	setLogEvents: jest.fn(() => false),
	getLogEvents: jest.fn(() => false)
};

const looperState = {
	sections: false,
	beats: false
};

const clearBeatAndSectionLooping = jest.fn(() => {
	looperState.sections = false;
	looperState.beats = false;
});
const restartLoopSections = jest.fn(() => {
	looperState.sections = true;
});
const restartLoopBeats = jest.fn(() => {
	looperState.beats = true;
});
const mockToggleTransport = jest.fn();
const mockShowTransport = jest.fn();
const mockSetCmdLineMenuMode = jest.fn();

jest.unstable_mockModule('../../jsonTree80kg/json-tree-80kg.js', () => ({
	jsonTree: jest.fn()
}));

jest.unstable_mockModule('../../themeFunctions.js', () => ({
	setOneCssVar: jest.fn()
}));

jest.unstable_mockModule('../../command-line.js', () => ({
	clearCmdResults: jest.fn(),
	hideCmdLine: jest.fn(),
	setCmdLineMenuMode: mockSetCmdLineMenuMode,
	setCmdActionRunner: jest.fn(),
	showCmdLine: jest.fn(),
	stringifyMenuItem: jest.fn(() => ''),
	updateCmdLineView: jest.fn()
}));

jest.unstable_mockModule('../../display-options.js', () => ({
	displayOptionsTable: jest.fn(() => '')
}));

jest.unstable_mockModule('../../looper.js', () => ({
	beatsLooping: () => looperState.beats,
	restartLoopBeats,
	restartLoopSections,
	sectionsLooping: () => looperState.sections,
	toggleLoopBeats: jest.fn(),
	toggleLoopSections: jest.fn(),
	clearBeatAndSectionLooping
}));

jest.unstable_mockModule('../../menu.js', () => ({
	buildChildMenuCaptionsRow: jest.fn(() => ''),
	diveMenu: jest.fn(),
	dumpMenus: jest.fn(() => ''),
	gMenuFile: {},
	gMenuPointer: {},
	refreshRuntimeChildren: jest.fn(),
	setMenuRuntimeChildrenResolver: jest.fn(),
	setMenuValueResolver: jest.fn(),
	setMenuAtRoot: jest.fn(),
	gMenuLoaded: '{}'
}));

jest.unstable_mockModule('../../approved-values.js', () => ({
	renderApprovedValuesReferenceHtml: jest.fn(() => ''),
	resolveApprovedValue: jest.fn(() => '')
}));

jest.unstable_mockModule('../../userColors.js', () => ({
	gUserColorDict: { dict: {} }
}));

jest.unstable_mockModule('../../infinite-neck.js', () => ({
	showMessagesTab: jest.fn(),
	showDisplayOptions: jest.fn(),
	getVersionString: jest.fn(() => 'vtest'),
	getVersionObject: jest.fn(() => ({ README: 'README.md' })),
	toggleWiringOpenState: jest.fn(),
	toggleTransport: mockToggleTransport,
	showTransport: mockShowTransport,
	toggleSectionDrawer: jest.fn(),
	toggleRandomLoop: jest.fn(),
	setSectionKeysFlats: jest.fn(),
	setSectionKeysSharps: jest.fn()
}));

jest.unstable_mockModule('../../event-bus.js', () => ({
	default: mockEventBus
}));

jest.unstable_mockModule('../../plugins/pluginRuntime.js', () => ({
	default: {}
}));

const { performCmdAction, document_keydown, document_keypress, runActionByName, setKeyHandlerProviders, getValue } = await import('../../key-handlers.js');
let mockDownloadBackupThenClearGraveyardByType;

function createSong() {
	const sections = [{ currentBeat: 1 }, { currentBeat: 1 }];
	return {
		sections,
		gSectionsCurrentIndex: 0,
		getCurrentSection() {
			return this.sections[this.gSectionsCurrentIndex];
		},
		firstSection: jest.fn(function () {
			this.gSectionsCurrentIndex = 0;
		}),
		lastSection: jest.fn(function () {
			this.gSectionsCurrentIndex = this.sections.length - 1;
		}),
		gotoFirstBeat: jest.fn(function () {
			this.getCurrentSection().currentBeat = 1;
		}),
		gotoLastBeat: jest.fn(function () {
			this.getCurrentSection().currentBeat = this.getBeats();
		}),
		gotoLastBeatInSong: jest.fn(function () {
			this.gSectionsCurrentIndex = this.sections.length - 1;
			this.getCurrentSection().currentBeat = this.getBeats();
		}),
		gotoBeat: jest.fn(function (beat) {
			this.getCurrentSection().currentBeat = beat;
		}),
		gotoPrevSection: jest.fn(),
		gotoNextSection: jest.fn(),
		nextBeat: jest.fn(),
		prevBeat: jest.fn(),
		publish_UpdateSectionStatus: jest.fn(),
		requestUiShowBeats: jest.fn(),
		getBeats: jest.fn(() => 4)
	};
}

function installPaletteJqueryStub(elements) {
	const byId = new Map(elements.map((element) => [element.id, element]));

	function matchesSelector(element, selector) {
		if (!element || !selector) {
			return false;
		}

		const trimmed = selector.trim();
		if (trimmed.startsWith('#')) {
			return element.id === trimmed.slice(1);
		}

		const inputMatch = trimmed.match(/^input\[name="([^"]+)"\](?::checked)?$/);
		if (!inputMatch) {
			return false;
		}

		const [, name] = inputMatch;
		const requiresChecked = trimmed.includes(':checked');
		if (element.tag !== 'input' || element.name !== name) {
			return false;
		}
		if (requiresChecked && !element.checked) {
			return false;
		}
		return true;
	}

	function query(selector) {
		if (!selector) {
			return [];
		}
		return Array.from(byId.values()).filter((element) => matchesSelector(element, selector));
	}

	function wrap(items) {
		const api = {
			length: items.length,
			first() {
				return wrap(items.slice(0, 1));
			},
			val() {
				return items[0]?.value;
			},
			prop(name, value) {
				if (value === undefined) {
					return items[0]?.[name];
				}
				items.forEach((item) => {
					item[name] = value;
				});
				return api;
			},
			trigger(name) {
				items.forEach((item) => {
					item.triggered = item.triggered || [];
					item.triggered.push(name);
				});
				return api;
			},
			attr(name) {
				return items[0]?.[name];
			}
		};
		items.forEach((item, index) => {
			api[index] = item;
		});
		return api;
	}

	globalThis.$ = (selector) => {
		if (typeof selector === 'string') {
			return wrap(query(selector));
		}
		if (!selector) {
			return wrap([]);
		}
		return wrap([selector]);
	};
	globalThis.jQuery = globalThis.$;

	return { byId };
}

describe('key-handlers spacebar mapping', () => {
	let song;
	let clearAndReplaySection;
	let mockTransportController;
	let mockSetBPM;
	let mockGetBPM;
	let mockToggleRecording;
	let mockShowAllNoteNames;
	let mockHandleBtnControlsToDisplayOptions;
	let mockHandleBtnDeleteDisplayOptions;
	let updateSectionsStatus;

	beforeEach(() => {
		song = createSong();
		clearAndReplaySection = jest.fn(() => {
			song.gotoFirstBeat();
		});
		mockTransportController = {
			goFirstSection: jest.fn(() => ({ result: '1' })),
			prevSection: jest.fn(() => ({ result: '1' })),
			nextSection: jest.fn(() => ({ result: '2' })),
			lastSection: jest.fn(() => ({ result: '2' })),
			restartSection: jest.fn(() => ({ result: '1' })),
			gotoLastBeat: jest.fn(() => ({ result: '4' })),
			gotoLastBeatInSong: jest.fn(() => ({ result: '2:4' })),
			prevBeat: jest.fn(() => ({ result: '1' })),
			nextBeat: jest.fn(() => ({ result: '2' })),
			gotoSection: jest.fn(() => ({ result: '1', didNavigate: true })),
			gotoBeat: jest.fn(() => ({ result: '1' })),
			setBPM: jest.fn(() => ({ result: 120 })),
			resetSong: jest.fn((hard) => ({ result: hard ? 'reset song (hard)' : 'reset song' })),
			toggleLoopSections: jest.fn(() => ({ result: 'RANDOM OFF, LOOP OFF' })),
			toggleLoopBeats: jest.fn(() => ({ result: 'OFF' }))
		};
		mockSetBPM = jest.fn();
		mockGetBPM = jest.fn(() => 120);
		mockToggleRecording = jest.fn();
		mockShowAllNoteNames = jest.fn();
		mockHandleBtnControlsToDisplayOptions = jest.fn();
		mockHandleBtnDeleteDisplayOptions = jest.fn();
		mockDownloadBackupThenClearGraveyardByType = jest.fn(() => ({ result: 'cleared: SECTION (1)' }));
		updateSectionsStatus = jest.fn();

		looperState.sections = false;
		looperState.beats = false;
		clearBeatAndSectionLooping.mockClear();
		restartLoopSections.mockClear();
		restartLoopBeats.mockClear();
		mockToggleTransport.mockClear();
		mockShowTransport.mockClear();
		mockSetCmdLineMenuMode.mockClear();
		mockEventBus.trigger.mockClear();

		setKeyHandlerProviders({
			addBeat: jest.fn(),
			checkRB: jest.fn(),
			clearAndReplaySection,
			cycleThruKeys: jest.fn(),
			cycleThruNutWidths: jest.fn(),
			downloadBackupThenClearGraveyard: jest.fn(),
			downloadBackupThenClearGraveyardByType: mockDownloadBackupThenClearGraveyardByType,
			downloadPlayedNotes: jest.fn(),
			enterFullscreen: jest.fn(),
			getBPM: mockGetBPM,
			getCurrentSection: () => song.getCurrentSection(),
			getDisplayOptionsClearState: jest.fn(() => song.getCurrentSection().displayOptions ? 'present' : 'none'),
			getDisplayOptionsSaveState: jest.fn(() => song.displayOptionsSaveState || 'none'),
			getPersistentSongFile: jest.fn(() => ({})),
			getSectionsCurrentIndex: () => song.gSectionsCurrentIndex,
			getSong: () => song,
			getTransportController: () => mockTransportController,
			hideAllMenuDivs: jest.fn(),
			hideFullscreenLeadSheetLine: jest.fn(() => 'LeadSheetLine hidden'),
			handleBtnControlsToDisplayOptions: mockHandleBtnControlsToDisplayOptions,
			handleBtnDeleteDisplayOptions: mockHandleBtnDeleteDisplayOptions,
			highlightOneNote: jest.fn(),
			leaveFullscreen: jest.fn(),
			printSections: jest.fn(),
			printSectionsNotes: jest.fn(),
			printSectionsOptions: jest.fn(),
			printSectionsChart: jest.fn(),
			printSectionsLine: jest.fn(() => 'LeadSheetLine shown'),
			resetNoteNames: jest.fn(),
			sectionChanged: jest.fn(),
			setPresentationMode: jest.fn((value) => {
				song.presentationMode = !!value;
			}),
			setBPM: mockSetBPM,
			setNamedNoteOpacity: jest.fn(),
			setSingleNoteOpacity: jest.fn(),
			setTinyNoteOpacity: jest.fn(),
			showAllNoteNames: mockShowAllNoteNames,
			showOneMenu: jest.fn(),
			toggleCaption: jest.fn(),
			toggleFullscreen: jest.fn(),
			toggleInstrumentCaptionRow: jest.fn(),
			toggleRecording: mockToggleRecording,
			transpose: jest.fn(),
			transposeSong: jest.fn(),
			transposeSongKeys: jest.fn(),
			updateFontLabel: jest.fn(),
			updateSectionsStatus
		});

		performCmdAction({ action: 'mapSpacebar_unsetSpacebarAction' });
	});

	test('printSectionsOptions routes to the Chart Options tab action', () => {
		const printSectionsOptions = jest.fn();
		setKeyHandlerProviders({ printSectionsOptions });

		performCmdAction({ action: 'printSectionsOptions' });

		expect(printSectionsOptions).toHaveBeenCalledTimes(1);
	});

	test('printSectionsChart routes to the Chart tab action', () => {
		const printSectionsChart = jest.fn();
		setKeyHandlerProviders({ printSectionsChart });

		performCmdAction({ action: 'printSectionsChart' });

		expect(printSectionsChart).toHaveBeenCalledTimes(1);
	});

	test('printSectionsLine routes to the Line action and returns its result', () => {
		const printSectionsLine = jest.fn(() => 'LeadSheetLine shown');
		setKeyHandlerProviders({ printSectionsLine });

		const result = performCmdAction({ action: 'printSectionsLine' });

		expect(printSectionsLine).toHaveBeenCalledTimes(1);
		expect(result.result).toBe('LeadSheetLine shown');
	});

	test('keypress g opens tunings and reloads tunings displays', () => {
		const showOneMenu = jest.fn();
		setKeyHandlerProviders({ showOneMenu });

		document_keypress({
			key: 'g',
			keyCode: 'g'.charCodeAt(0),
			target: { tagName: 'DIV' },
			preventDefault: jest.fn()
		});

		expect(showOneMenu).toHaveBeenCalledWith('#divTunings');
		expect(mockEventBus.trigger).toHaveBeenCalledWith('ReloadTuningsDisplays');
	});

	test('hideFullscreenLeadSheetLine routes to the fullscreen hide action and returns its result', () => {
		const hideFullscreenLeadSheetLine = jest.fn(() => 'LeadSheetLine hidden');
		setKeyHandlerProviders({ hideFullscreenLeadSheetLine });

		const result = performCmdAction({ action: 'hideFullscreenLeadSheetLine' });

		expect(hideFullscreenLeadSheetLine).toHaveBeenCalledTimes(1);
		expect(result.result).toBe('LeadSheetLine hidden');
	});

	test('mapSpacebar_restartSong stores firstSection as the mapped action', () => {
		const result = performCmdAction({ action: 'mapSpacebar_restartSong' });

		expect(result.result).toBe('spacebar mapped: restartSong using firstSection');
	});

	test('spacebar executes the mapped transport action on keydown', () => {
		performCmdAction({ action: 'mapSpacebar_lastSection' });
		const event = {
			key: ' ',
			code: 'Space',
			target: { tagName: 'BODY' },
			preventDefault: jest.fn()
		};

		document_keydown(event);

		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		expect(mockTransportController.lastSection).toHaveBeenCalledTimes(1);
		expect(song.lastSection).not.toHaveBeenCalled();
		expect(clearAndReplaySection).not.toHaveBeenCalled();
	});

	test('spacebar can be mapped to loop toggles', () => {
		performCmdAction({ action: 'mapSpacebar_toggleLoopSections' });
		const sectionLoopEvent = {
			key: ' ',
			code: 'Space',
			target: { tagName: 'BODY' },
			preventDefault: jest.fn()
		};

		document_keydown(sectionLoopEvent);

		expect(sectionLoopEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(mockTransportController.toggleLoopSections).toHaveBeenCalledTimes(1);

		performCmdAction({ action: 'mapSpacebar_toggleLoopBeats' });
		const beatLoopEvent = {
			key: ' ',
			code: 'Space',
			target: { tagName: 'BODY' },
			preventDefault: jest.fn()
		};

		document_keydown(beatLoopEvent);

		expect(beatLoopEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(mockTransportController.toggleLoopBeats).toHaveBeenCalledTimes(1);
	});

	test('mapped spacebar ignores text inputs', () => {
		performCmdAction({ action: 'mapSpacebar_lastSection' });
		const event = {
			key: ' ',
			code: 'Space',
			target: { tagName: 'INPUT' },
			preventDefault: jest.fn()
		};

		document_keydown(event);

		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(song.lastSection).not.toHaveBeenCalled();
		expect(clearAndReplaySection).not.toHaveBeenCalled();
	});

	test('showAllNoteNames action delegates true to provider', () => {
		performCmdAction({ action: 'showAllNoteNames' });

		expect(mockShowAllNoteNames).toHaveBeenCalledWith(true);
	});

	test('hideAllNoteNames action delegates false to provider', () => {
		performCmdAction({ action: 'hideAllNoteNames' });

		expect(mockShowAllNoteNames).toHaveBeenCalledWith(false);
	});

	test('resetSong delegates to the transport controller', () => {
		const result = performCmdAction({ action: 'resetSong' });

		expect(result.result).toBe('reset song');
		expect(mockTransportController.resetSong).toHaveBeenCalledWith(false);
	});

	test('resetSongHard delegates to the transport controller', () => {
		const result = performCmdAction({ action: 'resetSongHard' });

		expect(result.result).toBe('reset song (hard)');
		expect(mockTransportController.resetSong).toHaveBeenCalledWith(true);
	});

	test('gotoFirstBeat delegates to the transport controller', () => {
		const result = performCmdAction({ action: 'gotoFirstBeat' });

		expect(result.result).toBe('1');
		expect(mockTransportController.restartSection).toHaveBeenCalledTimes(1);
	});

	test('firstSection delegates to the transport controller', () => {
		const result = performCmdAction({ action: 'firstSection' });

		expect(result.result).toBe('1');
		expect(mockTransportController.goFirstSection).toHaveBeenCalledTimes(1);
	});

	test('runActionByName routes firstSection through the same transport action path', () => {
		const result = runActionByName('firstSection');

		expect(result.result).toBe('1');
		expect(mockTransportController.goFirstSection).toHaveBeenCalledTimes(1);
	});

	test('runActionByName routes toggleLoopSections through the same transport action path', () => {
		const result = runActionByName('toggleLoopSections');

		expect(result.result).toBe('RANDOM OFF, LOOP OFF');
		expect(mockTransportController.toggleLoopSections).toHaveBeenCalledTimes(1);
	});

	test('setMenuPrefs routes short, one-line, and tall through the command-line mode helper', () => {
		const shortResult = performCmdAction({ action: 'setMenuPrefs' }, { key: 's' });
		expect(shortResult.result).toBe('menu prefs: short');
		expect(mockSetCmdLineMenuMode).toHaveBeenNthCalledWith(1, 'short');

		const oneLineResult = performCmdAction({ action: 'setMenuPrefs' }, { key: 'o' });
		expect(oneLineResult.result).toBe('menu prefs: one-line');
		expect(mockSetCmdLineMenuMode).toHaveBeenNthCalledWith(2, 'one-line');

		const tallResult = performCmdAction({ action: 'setMenuPrefs' }, { key: 't' });
		expect(tallResult.result).toBe('menu prefs: tall');
		expect(mockSetCmdLineMenuMode).toHaveBeenNthCalledWith(3, 'tall');
	});

	test('presentation submenu actions toggle mode and invoke Display Options save/clear without popping', () => {
		song.presentationMode = false;
		song.displayOptionsSaveState = 'unsaved';
		song.getCurrentSection().displayOptions = { noteFontSize: 22 };

		expect(getValue('presentationModeState')).toBe(false);
		const toggleResult = performCmdAction({ action: 'togglePresentationMode' });
		expect(toggleResult.result).toBe('presentation mode: true');
		expect(toggleResult.preserveMenuStack).toBe(true);
		expect(getValue('presentationModeState')).toBe(true);

		expect(getValue('displayOptionsSaveState')).toBe('unsaved');
		const saveResult = performCmdAction({ action: 'saveViewDisplayOptions' });
		expect(mockHandleBtnControlsToDisplayOptions).toHaveBeenCalledTimes(1);
		expect(saveResult.preserveMenuStack).toBe(true);

		expect(getValue('displayOptionsClearState')).toBe('present');
		const clearResult = performCmdAction({ action: 'clearViewDisplayOptions' });
		expect(mockHandleBtnDeleteDisplayOptions).toHaveBeenCalledTimes(1);
		expect(clearResult.preserveMenuStack).toBe(true);
	});

	test('runActionByName routes remaining navigation verbs through the transport controller', () => {
		expect(runActionByName('prevSection').result).toBe('1');
		expect(runActionByName('nextSection').result).toBe('2');
		expect(runActionByName('lastSection').result).toBe('2');
		expect(runActionByName('prevBeat').result).toBe('1');
		expect(runActionByName('nextBeat').result).toBe('2');
		expect(runActionByName('gotoLastBeat').result).toBe('4');
		expect(runActionByName('gotoLastBeatInSong').result).toBe('2:4');

		expect(mockTransportController.prevSection).toHaveBeenCalledTimes(1);
		expect(mockTransportController.nextSection).toHaveBeenCalledTimes(1);
		expect(mockTransportController.lastSection).toHaveBeenCalledTimes(1);
		expect(mockTransportController.prevBeat).toHaveBeenCalledTimes(1);
		expect(mockTransportController.nextBeat).toHaveBeenCalledTimes(1);
		expect(mockTransportController.gotoLastBeat).toHaveBeenCalledTimes(1);
		expect(mockTransportController.gotoLastBeatInSong).toHaveBeenCalledTimes(1);
	});

	test('keypress < routes through the firstSection transport action', () => {
		const event = {
			key: '<',
			keyCode: 60,
			target: { tagName: 'BODY' },
			preventDefault: jest.fn()
		};

		document_keypress(event);

		expect(mockTransportController.goFirstSection).toHaveBeenCalledTimes(1);
		expect(song.firstSection).not.toHaveBeenCalled();
	});

	test('setBPM delegates to the transport controller', () => {

		const result = performCmdAction(
			{ action: 'setBPM', input: { id: 'bpm' } },
			{ bpm: '140' }
		);

		expect(mockTransportController.setBPM).toHaveBeenCalledWith('140');
		expect(mockSetBPM).not.toHaveBeenCalled();
		expect(result.result).toBe(120);
	});

	test('parkTransportTopRight delegates to showTransport with top-right mode', () => {
		performCmdAction({ action: 'parkTransportTopRight' });

		expect(mockShowTransport).toHaveBeenCalledWith('top-right');
	});

	test('toggleRecording delegates to the recording provider', () => {
		const result = performCmdAction({ action: 'toggleRecording' });

		expect(result.result).toBe('REC toggled');
		expect(mockToggleRecording).toHaveBeenCalledTimes(1);
	});

	test('/fac toggle actions update graveyard type state and keep menu stack', () => {
		performCmdAction({ action: 'resetGraveyardClearByTypeSelection' });

		expect(getValue('graveyardClearByTypeSECTION')).toBe('false');
		const toggleResult = performCmdAction({ action: 'toggleGraveyardClearTypeSECTION' });
		expect(toggleResult.preserveMenuStack).toBe(true);
		expect(toggleResult.result).toBe('SECTION=true');
		expect(getValue('graveyardClearByTypeSECTION')).toBe('true');
	});

	test('/facC skips provider call when no types are selected', () => {
		performCmdAction({ action: 'resetGraveyardClearByTypeSelection' });

		const result = performCmdAction({ action: 'downloadBackupThenClearGraveyardByType' });

		expect(result.result).toBe('no types selected');
		expect(mockDownloadBackupThenClearGraveyardByType).not.toHaveBeenCalled();
	});

	test('/facC sends selected graveyard types to provider and resets submenu toggles', () => {
		performCmdAction({ action: 'resetGraveyardClearByTypeSelection' });
		performCmdAction({ action: 'toggleGraveyardClearTypeSECTION' });
		performCmdAction({ action: 'toggleGraveyardClearTypePLUGIN' });

		const result = performCmdAction({ action: 'downloadBackupThenClearGraveyardByType' });

		expect(result.result).toBe('cleared: SECTION (1)');
		expect(mockDownloadBackupThenClearGraveyardByType).toHaveBeenCalledWith(['PLUGIN', 'SECTION']);
		expect(getValue('graveyardClearByTypeSECTION')).toBe('false');
		expect(getValue('graveyardClearByTypePLUGIN')).toBe('false');
	});

	test('selectRadioNoteType enters paint mode before selecting a note type when CLEAR mode is active', () => {
		const paintModeRadio = {
			id: 'idPaletteModePaint',
			tag: 'input',
			name: 'rbPaletteMode',
			type: 'radio',
			value: 'paint',
			checked: false,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		const namedRadio = {
			id: 'idNamedNotes',
			tag: 'input',
			name: 'rbHighlight',
			type: 'radio',
			value: 'Named',
			checked: false,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		const clearRadio = {
			id: 'idPaletteModeClear',
			tag: 'input',
			name: 'rbPaletteMode',
			type: 'radio',
			value: 'clear',
			checked: true,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		installPaletteJqueryStub([paintModeRadio, namedRadio, clearRadio]);

		performCmdAction({ action: 'selectRadioNoteType' }, { key: 'n' });

		expect(paintModeRadio.click).toHaveBeenCalledTimes(1);
		expect(namedRadio.click).toHaveBeenCalledTimes(1);
	});

	test('selectRadioNoteType last-chosen selects paint mode directly', () => {
		const paintModeRadio = {
			id: 'idPaletteModePaint',
			tag: 'input',
			name: 'rbPaletteMode',
			type: 'radio',
			value: 'paint',
			checked: false,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		installPaletteJqueryStub([paintModeRadio]);

		performCmdAction({ action: 'selectRadioNoteType' }, { key: 'l' });

		expect(paintModeRadio.click).toHaveBeenCalledTimes(1);
	});

	test('selectFingering enters paint mode before selecting a fingering when a special mode is active', () => {
		const paintModeRadio = {
			id: 'idPaletteModePaint',
			tag: 'input',
			name: 'rbPaletteMode',
			type: 'radio',
			value: 'paint',
			checked: false,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		const keepRadio = {
			id: 'idPaletteModeKeep',
			tag: 'input',
			name: 'rbPaletteMode',
			type: 'radio',
			value: 'keep',
			checked: true,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		const fingerRadio = {
			id: 'rbFinger1',
			tag: 'input',
			name: 'rbHighlight',
			type: 'radio',
			value: 'Fingering',
			checked: false,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		const fingerColor = {
			id: 'idRFinger1',
			tag: 'input',
			name: 'rbColor',
			type: 'radio',
			value: 'noteFinger1',
			checked: false,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		installPaletteJqueryStub([paintModeRadio, keepRadio, fingerRadio, fingerColor]);

		performCmdAction({ action: 'selectFingering' }, { key: '1' });

		expect(paintModeRadio.click).toHaveBeenCalledTimes(1);
		expect(fingerRadio.click).toHaveBeenCalledTimes(1);
		expect(fingerColor.click).toHaveBeenCalledTimes(1);
	});

	test('selectRole enters paint mode before selecting a role when dropper mode is active', () => {
		const paintModeRadio = {
			id: 'idPaletteModePaint',
			tag: 'input',
			name: 'rbPaletteMode',
			type: 'radio',
			value: 'paint',
			checked: false,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		const dropperRadio = {
			id: 'idPaletteModeDropper',
			tag: 'input',
			name: 'rbPaletteMode',
			type: 'radio',
			value: 'dropper',
			checked: true,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		const rootRole = {
			id: 'idRRoot',
			tag: 'input',
			name: 'rbColor',
			type: 'radio',
			value: 'noteRoot',
			checked: false,
			click: jest.fn(function () {
				this.checked = true;
			})
		};
		installPaletteJqueryStub([paintModeRadio, dropperRadio, rootRole]);

		performCmdAction({ action: 'selectRole' }, { key: 'r' });

		expect(paintModeRadio.click).toHaveBeenCalledTimes(1);
		expect(rootRole.click).toHaveBeenCalledTimes(1);
	});
});