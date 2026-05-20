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
		getCurrentSection() {
			return this.sections[this.gSectionsCurrentIndex];
		},
		getSectionsCurrentIndex() {
			return this.gSectionsCurrentIndex;
		},
		firstSectionStateOnly: jest.fn(function () {
			this.gSectionsCurrentIndex = 0;
		}),
		firstSection: jest.fn(function () {
			this.gSectionsCurrentIndex = 0;
		}),
		gotoFirstBeat: jest.fn(function () {
			this.getCurrentSection().currentBeat = 1;
		}),
		getBeat: jest.fn(function () {
			return this.getCurrentSection().currentBeat;
		}),
		getBeats: jest.fn(() => 4)
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
			getCurrentSection: () => song.getCurrentSection(),
			getSectionsCurrentIndex: () => song.getSectionsCurrentIndex(),
			getSong: () => song,
			replayCurrentSectionView,
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

	test('goFirstSection emits section begin once while looping', () => {
		looperState.sections = true;
		song.gSectionsCurrentIndex = 1;

		const result = controller.goFirstSection();

		expect(result.result).toBe('1');
		expect(song.firstSectionStateOnly).toHaveBeenCalledTimes(1);
		expect(song.firstSection).not.toHaveBeenCalled();
		expect(song.gotoFirstBeat).toHaveBeenCalledTimes(1);
		expect(syncSectionUi).toHaveBeenCalledTimes(1);
		expect(replayCurrentSectionView).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledTimes(1);
		expect(mockEventBus.trigger).toHaveBeenCalledWith('DaCapo:OnSectionBegin', expect.objectContaining({
			sectionIndex: 0,
			sectionCount: 2,
			beat: 1,
			beats: 4
		}));
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