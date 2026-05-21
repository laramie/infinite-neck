import { jest } from '@jest/globals';

const mockEventBus = {
	trigger: jest.fn()
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
const toggleLoopSections = jest.fn(() => {
	looperState.sections = !looperState.sections;
	if (looperState.sections) {
		looperState.beats = false;
	}
});
const toggleLoopBeats = jest.fn(() => {
	looperState.beats = !looperState.beats;
	if (looperState.beats) {
		looperState.sections = false;
	}
});

jest.unstable_mockModule('../../event-bus.js', () => ({
	default: mockEventBus
}));

jest.unstable_mockModule('../../looper.js', () => ({
	beatsLooping: () => looperState.beats,
	clearBeatAndSectionLooping,
	restartLoopBeats,
	restartLoopSections,
	sectionsLooping: () => looperState.sections,
	toggleLoopBeats,
	toggleLoopSections
}));

const { TransportController } = await import('../../transport-controller.js');

function createSong() {
	const sections = [{ currentBeat: 1 }, { currentBeat: 1 }];
	return {
		sections,
		randomLoop: false,
		gSectionsCurrentIndex: 0,
		clearedHighlights: 0,
		getCurrentSection() {
			return this.sections[this.gSectionsCurrentIndex];
		},
		getSectionsCurrentIndex() {
			return this.gSectionsCurrentIndex;
		},
		firstSectionStateOnly: jest.fn(function () {
			this.gSectionsCurrentIndex = 0;
		}),
		lastSectionStateOnly: jest.fn(function () {
			this.gSectionsCurrentIndex = this.sections.length - 1;
		}),
		gotoPrevSectionStateOnly: jest.fn(function () {
			if (this.gSectionsCurrentIndex > 0) {
				this.gSectionsCurrentIndex -= 1;
			}
		}),
		gotoNextSectionStateOnly: jest.fn(function () {
			if (this.gSectionsCurrentIndex < this.sections.length - 1) {
				this.gSectionsCurrentIndex += 1;
			}
		}),
		gotoSectionStateOnly: jest.fn(function (index) {
			if (index < 0 || index >= this.sections.length) {
				return false;
			}
			this.gSectionsCurrentIndex = index;
			return true;
		}),
		firstSection: jest.fn(function () {
			this.gSectionsCurrentIndex = 0;
		}),
		gotoFirstBeat: jest.fn(function () {
			this.getCurrentSection().currentBeat = 1;
		}),
		gotoLastBeat: jest.fn(function () {
			this.getCurrentSection().currentBeat = this.getBeats();
		}),
		gotoBeat: jest.fn(function (beat) {
			this.getCurrentSection().currentBeat = beat;
		}),
		incBeat: jest.fn(function () {
			if (this.getCurrentSection().currentBeat < this.getBeats()) {
				this.getCurrentSection().currentBeat += 1;
			}
		}),
		decBeat: jest.fn(function () {
			if (this.getCurrentSection().currentBeat > 1) {
				this.getCurrentSection().currentBeat -= 1;
			}
		}),
		getBeat: jest.fn(function () {
			return this.getCurrentSection().currentBeat;
		}),
		getBeats: jest.fn(() => 4),
		publish_UpdateSectionStatus: jest.fn(),
		requestUiShowBeats: jest.fn(),
		requestUiClearHighlights: jest.fn()
	};
}

describe('TransportController', () => {
	let song;
	let replayCurrentSectionView;
	let syncSectionUi;
	let controller;

	beforeEach(() => {
		song = createSong();
		replayCurrentSectionView = jest.fn();
		syncSectionUi = jest.fn();
		looperState.sections = false;
		looperState.beats = false;
		mockEventBus.trigger.mockClear();
		clearBeatAndSectionLooping.mockClear();
		restartLoopSections.mockClear();
		restartLoopBeats.mockClear();
		toggleLoopSections.mockClear();
		toggleLoopBeats.mockClear();

		controller = new TransportController({
			getBPM: jest.fn(() => 120),
			getCurrentSection: () => song.getCurrentSection(),
			getSectionsCurrentIndex: () => song.getSectionsCurrentIndex(),
			getSong: () => song,
			replayCurrentSectionView,
			setBPM: jest.fn(),
			syncSectionUi
		});
	});

	test('restartSection replays and emits section begin once while looping', () => {
		looperState.sections = true;

		const result = controller.restartSection();

		expect(result.result).toBe('1');
		expect(song.gotoFirstBeat).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledWith('DaCapo:OnSectionBegin', expect.objectContaining({
			sectionIndex: 0,
			sectionCount: 2,
			beat: 1,
			beats: 4
		}));
	});

	test('goFirstSection emits song begin and section begin once while section looping', () => {
		looperState.sections = true;
		song.gSectionsCurrentIndex = 1;

		const result = controller.goFirstSection();

		expect(result.result).toBe('1');
		expect(result.didEmitSongBegin).toBe(true);
		expect(song.firstSectionStateOnly).toHaveBeenCalledTimes(1);
		expect(song.firstSection).not.toHaveBeenCalled();
		expect(song.gotoFirstBeat).toHaveBeenCalledTimes(1);
		expect(syncSectionUi).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledTimes(2);
		expect(mockEventBus.trigger).toHaveBeenNthCalledWith(1, 'DaCapo:OnSongBegin', expect.objectContaining({
			sectionIndex: 0,
			sectionCount: 2,
			beat: 1,
			beats: 4
		}));
		expect(mockEventBus.trigger).toHaveBeenNthCalledWith(2, 'DaCapo:OnSectionBegin', expect.objectContaining({
			sectionIndex: 0,
			sectionCount: 2,
			beat: 1,
			beats: 4
		}));
	});

	test('goFirstSection emits only section begin while beat looping', () => {
		looperState.beats = true;
		song.gSectionsCurrentIndex = 1;

		const result = controller.goFirstSection();

		expect(result.result).toBe('1');
		expect(result.didEmitSongBegin).toBe(false);
		expect(result.didEmitSectionBegin).toBe(true);
		expect(mockEventBus.trigger).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledWith('DaCapo:OnSectionBegin', expect.objectContaining({
			sectionIndex: 0,
			sectionCount: 2,
			beat: 1,
			beats: 4
		}));
	});

	test('goFirstSection emits no DaCapo events when not looping', () => {
		song.gSectionsCurrentIndex = 1;

		const result = controller.goFirstSection();

		expect(result.result).toBe('1');
		expect(result.didEmitSongBegin).toBe(false);
		expect(result.didEmitSectionBegin).toBe(false);
		expect(mockEventBus.trigger).not.toHaveBeenCalled();
	});

	test('prevSection replays from the first beat without emitting transport lifecycle events', () => {
		song.gSectionsCurrentIndex = 1;
		song.sections[1].currentBeat = 3;

		const result = controller.prevSection();

		expect(result.result).toBe('1');
		expect(song.gotoPrevSectionStateOnly).toHaveBeenCalledWith(false);
		expect(song.gotoFirstBeat).toHaveBeenCalledTimes(1);
		expect(syncSectionUi).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).not.toHaveBeenCalledWith('DaCapo:OnSectionBegin', expect.anything());
	});

	test('nextSection advances through the controller-owned replay path', () => {
		const result = controller.nextSection();

		expect(result.result).toBe('2');
		expect(song.gotoNextSectionStateOnly).toHaveBeenCalledWith(false);
		expect(song.gotoFirstBeat).toHaveBeenCalledTimes(1);
		expect(syncSectionUi).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).toHaveBeenCalledTimes(1);
	});

	test('lastSection lands on the first beat of the last section', () => {
		const result = controller.lastSection();

		expect(result.result).toBe('2');
		expect(song.lastSectionStateOnly).toHaveBeenCalledTimes(1);
		expect(song.gotoFirstBeat).toHaveBeenCalledTimes(1);
		expect(syncSectionUi).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).toHaveBeenCalledTimes(1);
	});

	test('gotoLastBeat refreshes beat-only UI without replaying the section', () => {
		const result = controller.gotoLastBeat();

		expect(result.result).toBe('4');
		expect(song.gotoLastBeat).toHaveBeenCalledTimes(1);
		expect(song.publish_UpdateSectionStatus).toHaveBeenCalledTimes(1);
		expect(song.requestUiShowBeats).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).not.toHaveBeenCalled();
	});

	test('gotoLastBeatInSong replays the last section at its last beat', () => {
		const result = controller.gotoLastBeatInSong();

		expect(result.result).toBe('2:4');
		expect(song.lastSectionStateOnly).toHaveBeenCalledTimes(1);
		expect(song.gotoLastBeat).toHaveBeenCalledTimes(1);
		expect(syncSectionUi).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).toHaveBeenCalledTimes(1);
	});

	test('prevBeat and nextBeat clear highlights and refresh beat UI', () => {
		song.sections[0].currentBeat = 2;

		const prevResult = controller.prevBeat();
		const nextResult = controller.nextBeat();

		expect(prevResult.result).toBe('1');
		expect(nextResult.result).toBe('2');
		expect(song.requestUiClearHighlights).toHaveBeenCalledTimes(2);
		expect(song.publish_UpdateSectionStatus).toHaveBeenCalledTimes(2);
		expect(song.requestUiShowBeats).toHaveBeenCalledTimes(2);
	});

	test('gotoSection and gotoBeat use controller-owned navigation paths', () => {
		const sectionResult = controller.gotoSection(1);
		const beatResult = controller.gotoBeat(3);

		expect(sectionResult.result).toBe('2');
		expect(sectionResult.didNavigate).toBe(true);
		expect(song.gotoSectionStateOnly).toHaveBeenCalledWith(1);
		expect(beatResult.result).toBe('3');
		expect(song.gotoBeat).toHaveBeenCalledWith(3);
	});

	test('setBPM preserves active section loop mode through the controller', () => {
		looperState.sections = true;

		const result = controller.setBPM('140');

		expect(result.result).toBe(120);
		expect(controller.providers.setBPM).toHaveBeenCalledWith(140);
		expect(restartLoopSections).toHaveBeenCalledTimes(1);
		expect(restartLoopBeats).not.toHaveBeenCalled();
	});

	test('setBPM preserves active beat loop mode through the controller', () => {
		looperState.beats = true;

		controller.setBPM('140');

		expect(controller.providers.setBPM).toHaveBeenCalledWith(140);
		expect(restartLoopBeats).toHaveBeenCalledTimes(1);
		expect(restartLoopSections).not.toHaveBeenCalled();
	});

	test('restartSection does not emit song begin', () => {
		looperState.sections = true;

		controller.restartSection();

		expect(mockEventBus.trigger).not.toHaveBeenCalledWith('DaCapo:OnSongBegin', expect.anything());
	});

	test('restartSection while beat looping emits section begin but not song begin', () => {
		looperState.beats = true;
		song.gSectionsCurrentIndex = 0;
		song.sections[0].currentBeat = 3;

		controller.restartSection();

		expect(mockEventBus.trigger).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledWith('DaCapo:OnSectionBegin', expect.objectContaining({
			sectionIndex: 0,
			sectionCount: 2,
			beat: 1,
			beats: 4
		}));
		expect(mockEventBus.trigger).not.toHaveBeenCalledWith('DaCapo:OnSongBegin', expect.anything());
	});

	test('resetSong preserves active section loop mode', () => {
		looperState.sections = true;

		const result = controller.resetSong(false);

		expect(result.result).toBe('reset song');
		expect(clearBeatAndSectionLooping).toHaveBeenCalledTimes(1);
		expect(song.firstSectionStateOnly).toHaveBeenCalledTimes(1);
		expect(song.firstSection).not.toHaveBeenCalled();
		expect(song.gotoFirstBeat).toHaveBeenCalledTimes(1);
		expect(syncSectionUi).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledWith('Looper:OnResetSong', expect.objectContaining({ hard: false, beat: 1 }));
		expect(restartLoopSections).toHaveBeenCalledTimes(1);
		expect(restartLoopBeats).not.toHaveBeenCalled();
	});

	test('resetSong emits reset before replay/view refresh', () => {
		controller.resetSong(false);

		const resetCallOrder = mockEventBus.trigger.mock.invocationCallOrder[0];
		const syncCallOrder = syncSectionUi.mock.invocationCallOrder[0];
		const replayCallOrder = replayCurrentSectionView.mock.invocationCallOrder[0];

		expect(resetCallOrder).toBeLessThan(syncCallOrder);
		expect(resetCallOrder).toBeLessThan(replayCallOrder);
	});

	test('resetSongHard preserves active beat loop mode', () => {
		looperState.beats = true;

		const result = controller.resetSong(true);

		expect(result.result).toBe('reset song (hard)');
		expect(clearBeatAndSectionLooping).toHaveBeenCalledTimes(1);
		expect(song.firstSectionStateOnly).toHaveBeenCalledTimes(1);
		expect(song.gotoFirstBeat).toHaveBeenCalledTimes(1);
		expect(syncSectionUi).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledWith('Looper:OnResetSong', expect.objectContaining({ hard: true, beat: 1 }));
		expect(restartLoopBeats).toHaveBeenCalledTimes(1);
		expect(restartLoopSections).not.toHaveBeenCalled();
	});

	test('toggleLoopSections preserves loop result format', () => {
		song.randomLoop = true;

		const result = controller.toggleLoopSections();

		expect(toggleLoopSections).toHaveBeenCalledTimes(1);
		expect(result.result).toBe('RANDOM ON, LOOP ON');
	});

	test('toggleLoopBeats preserves loop result format', () => {
		const result = controller.toggleLoopBeats();

		expect(toggleLoopBeats).toHaveBeenCalledTimes(1);
		expect(result.result).toBe('ON');
	});
});