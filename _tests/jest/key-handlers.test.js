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

jest.unstable_mockModule('../../jsonTree80kg/json-tree-80kg.js', () => ({
	jsonTree: jest.fn()
}));

jest.unstable_mockModule('../../themeFunctions.js', () => ({
	setOneCssVar: jest.fn()
}));

jest.unstable_mockModule('../../command-line.js', () => ({
	clearCmdResults: jest.fn(),
	hideCmdLine: jest.fn(),
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
	dumpMenus: jest.fn(() => ''),
	gMenuFile: {},
	gMenuPointer: {},
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
	getVersionString: jest.fn(() => 'vtest'),
	getVersionObject: jest.fn(() => ({ README: 'README.md' })),
	toggleWiringOpenState: jest.fn(),
	toggleTransport: jest.fn(),
	showTransport: jest.fn(),
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

const { performCmdAction, document_keypress, setKeyHandlerProviders } = await import('../../key-handlers.js');

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

describe('key-handlers spacebar mapping', () => {
	let song;
	let clearAndReplaySection;
	let updateSectionsStatus;

	beforeEach(() => {
		song = createSong();
		clearAndReplaySection = jest.fn(() => {
			song.gotoFirstBeat();
		});
		updateSectionsStatus = jest.fn();

		looperState.sections = false;
		looperState.beats = false;
		clearBeatAndSectionLooping.mockClear();
		restartLoopSections.mockClear();
		restartLoopBeats.mockClear();
		mockEventBus.trigger.mockClear();

		setKeyHandlerProviders({
			addBeat: jest.fn(),
			checkRB: jest.fn(),
			clearAndReplaySection,
			cycleThruKeys: jest.fn(),
			cycleThruNutWidths: jest.fn(),
			downloadBackupThenClearGraveyard: jest.fn(),
			downloadPlayedNotes: jest.fn(),
			enterFullscreen: jest.fn(),
			getBPM: jest.fn(() => 120),
			getCurrentSection: () => song.getCurrentSection(),
			getPersistentSongFile: jest.fn(() => ({})),
			getSectionsCurrentIndex: () => song.gSectionsCurrentIndex,
			getSong: () => song,
			hideAllMenuDivs: jest.fn(),
			highlightOneNote: jest.fn(),
			leaveFullscreen: jest.fn(),
			printSections: jest.fn(),
			printSectionsNotes: jest.fn(),
			resetNoteNames: jest.fn(),
			sectionChanged: jest.fn(),
			setBPM: jest.fn(),
			setNamedNoteOpacity: jest.fn(),
			setSingleNoteOpacity: jest.fn(),
			setTinyNoteOpacity: jest.fn(),
			showOneMenu: jest.fn(),
			toggleCaption: jest.fn(),
			toggleFullscreen: jest.fn(),
			toggleInstrumentCaptionRow: jest.fn(),
			transpose: jest.fn(),
			transposeSong: jest.fn(),
			transposeSongKeys: jest.fn(),
			updateFontLabel: jest.fn(),
			updateSectionsStatus
		});

		performCmdAction({ action: 'mapSpacebar_unsetSpacebarAction' });
	});

	test('mapSpacebar_restartSong stores firstSection as the mapped action', () => {
		const result = performCmdAction({ action: 'mapSpacebar_restartSong' });

		expect(result.result).toBe('spacebar mapped: restartSong using firstSection');
	});

	test('spacebar executes the mapped transport action', () => {
		performCmdAction({ action: 'mapSpacebar_lastSection' });
		const event = {
			key: ' ',
			target: { tagName: 'BODY' },
			preventDefault: jest.fn()
		};

		document_keypress(event);

		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		expect(song.lastSection).toHaveBeenCalledTimes(1);
		expect(clearAndReplaySection).toHaveBeenCalledTimes(1);
	});

	test('resetSong preserves active section-loop mode', () => {
		looperState.sections = true;

		const result = performCmdAction({ action: 'resetSong' });

		expect(result.result).toBe('reset song');
		expect(clearBeatAndSectionLooping).toHaveBeenCalledTimes(1);
		expect(song.firstSection).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledWith('Looper:OnResetSong', expect.objectContaining({ hard: false, beat: 1 }));
		expect(restartLoopSections).toHaveBeenCalledTimes(1);
		expect(restartLoopBeats).not.toHaveBeenCalled();
	});

	test('resetSongHard preserves active beat-loop mode', () => {
		looperState.beats = true;

		const result = performCmdAction({ action: 'resetSongHard' });

		expect(result.result).toBe('reset song (hard)');
		expect(clearBeatAndSectionLooping).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledWith('Looper:OnResetSong', expect.objectContaining({ hard: true, beat: 1 }));
		expect(restartLoopBeats).toHaveBeenCalledTimes(1);
		expect(restartLoopSections).not.toHaveBeenCalled();
	});

	test('resetSong does not start looping if no loop was active', () => {
		const result = performCmdAction({ action: 'resetSong' });

		expect(result.result).toBe('reset song');
		expect(clearBeatAndSectionLooping).not.toHaveBeenCalled();
		expect(restartLoopSections).not.toHaveBeenCalled();
		expect(restartLoopBeats).not.toHaveBeenCalled();
	});
});