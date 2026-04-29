import { jest } from '@jest/globals';
import EventBus from '../../event-bus.js';

const mockRuntime = {
	song: null,
	millisForBeatClock: 125,
	showBeats: jest.fn(),
	showBPM: jest.fn()
};

jest.unstable_mockModule('../../infinite-neck.js', () => ({
	getSong: () => mockRuntime.song,
	getMillisForBeatClock: () => mockRuntime.millisForBeatClock,
	showBeats: () => mockRuntime.showBeats(),
	showBPM: () => mockRuntime.showBPM()
}));

const {
	sectionsLooping,
	beatsLooping,
	tickBeat,
	toggleLoopSections,
	toggleLoopBeats,
	restartLoopSections,
	__resetLooperForTests
} = await import('../../looper.js');

function makeMockSong({ beat = 1, beats = 4, randomLoop = false } = {}) {
	const s = {
		_beat: beat,
		_beats: beats,
		randomLoop
	};
	s.getBeat = jest.fn(() => s._beat);
	s.getBeats = jest.fn(() => s._beats);
	s.getSectionsCurrentIndex = jest.fn(() => 0);
	s.getSections = jest.fn(() => [{ caption: 'One' }, { caption: 'Two' }]);
	s.incBeatLoop = jest.fn();
	s.gotoNextSection = jest.fn();
	return s;
}

describe('looper tickBeat', () => {
	test('mid-beat tick: increments beat and shows beats', () => {
		const song = makeMockSong({ beat: 1, beats: 4 });
		const showBeats = jest.fn();
		tickBeat(song, { sectionsLooping: false, showBeats });
		expect(song.incBeatLoop).toHaveBeenCalledTimes(1);
		expect(showBeats).toHaveBeenCalledTimes(1);
		expect(song.gotoNextSection).not.toHaveBeenCalled();
	});

	test('end-of-beat tick without section loop: wraps beat and shows beats', () => {
		const song = makeMockSong({ beat: 4, beats: 4 });
		const showBeats = jest.fn();
		tickBeat(song, { sectionsLooping: false, showBeats });
		expect(song.incBeatLoop).toHaveBeenCalledTimes(1);
		expect(showBeats).toHaveBeenCalledTimes(1);
		expect(song.gotoNextSection).not.toHaveBeenCalled();
	});

	test('end-of-beat tick with section loop: advances section (gotoNextSection calls showBeats internally)', () => {
		const song = makeMockSong({ beat: 4, beats: 4 });
		const showBeats = jest.fn();
		tickBeat(song, { sectionsLooping: true, showBeats });
		expect(song.gotoNextSection).toHaveBeenCalledWith(true);
		expect(song.incBeatLoop).not.toHaveBeenCalled();
		expect(showBeats).not.toHaveBeenCalled();
	});

	test('beat past end treated same as at-end (beat > beats)', () => {
		const song = makeMockSong({ beat: 5, beats: 4 });
		const showBeats = jest.fn();
		tickBeat(song, { sectionsLooping: true, showBeats });
		expect(song.gotoNextSection).toHaveBeenCalledWith(true);
		expect(song.incBeatLoop).not.toHaveBeenCalled();
		expect(showBeats).not.toHaveBeenCalled();
	});
});

describe('looper looping state', () => {
	let triggerSpy;
	let setIntervalSpy;
	let clearIntervalSpy;

	beforeEach(() => {
		__resetLooperForTests();
		mockRuntime.song = null;
		mockRuntime.millisForBeatClock = 125;
		mockRuntime.showBeats = jest.fn();
		mockRuntime.showBPM = jest.fn();
		triggerSpy = jest.spyOn(EventBus, 'trigger');
		setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => 99);
		clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
	});

	afterEach(() => {
		triggerSpy.mockRestore();
		setIntervalSpy.mockRestore();
		clearIntervalSpy.mockRestore();
	});

	test('looping state defaults to false', () => {
		expect(sectionsLooping()).toBe(false);
		expect(beatsLooping()).toBe(false);
	});

	test('toggleLoopSections turns sections looping on when off', () => {
		mockRuntime.song = makeMockSong();
		toggleLoopSections();
		expect(sectionsLooping()).toBe(true);
		expect(beatsLooping()).toBe(false);
		expect(mockRuntime.showBPM).toHaveBeenCalledTimes(1);
		expect(setIntervalSpy).toHaveBeenCalledTimes(1);
		expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 125);
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopSectionsStart', { caption: 'LOOPING...' });
	});

	test('toggleLoopSections emits random caption when randomLoop is enabled', () => {
		mockRuntime.song = makeMockSong({ randomLoop: true });
		toggleLoopSections();
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopSectionsStart', { caption: 'RANDOM....' });
	});

	test('toggleLoopSections turns sections looping off when on', () => {
		mockRuntime.song = makeMockSong();
		toggleLoopSections();
		triggerSpy.mockClear();
		toggleLoopSections();
		expect(sectionsLooping()).toBe(false);
		expect(beatsLooping()).toBe(false);
		expect(clearIntervalSpy).toHaveBeenCalledWith(99);
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopSectionsStop');
	});

	test('toggleLoopBeats turns beats looping on then off', () => {
		mockRuntime.song = makeMockSong();
		toggleLoopBeats();
		expect(beatsLooping()).toBe(true);
		expect(sectionsLooping()).toBe(false);
		expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 125);
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopBeatsStart', { caption: 'LOOPING...' });

		triggerSpy.mockClear();
		toggleLoopBeats();
		expect(beatsLooping()).toBe(false);
		expect(clearIntervalSpy).toHaveBeenCalledWith(99);
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopBeatsStop');
	});

	test('switching from beat loop to section loop emits stop then start', () => {
		mockRuntime.song = makeMockSong();
		toggleLoopBeats();
		triggerSpy.mockClear();
		toggleLoopSections();
		expect(triggerSpy.mock.calls).toEqual([
			['Looper:OnLoopBeatsStop'],
			['Looper:OnLoopSectionsStart', { caption: 'LOOPING...' }],
			['DaCapo:OnSongBegin', expect.any(Object)]
		]);
	});

	test('restartLoopSections keeps sections looping active', () => {
		mockRuntime.song = makeMockSong();
		restartLoopSections();
		expect(sectionsLooping()).toBe(true);
		triggerSpy.mockClear();
		restartLoopSections();
		expect(sectionsLooping()).toBe(true);
		expect(clearIntervalSpy).toHaveBeenCalledWith(99);
		expect(setIntervalSpy).toHaveBeenCalledTimes(2);
		expect(triggerSpy.mock.calls).toEqual([
			['Looper:OnLoopSectionsStop'],
			['Looper:OnLoopSectionsStart', { caption: 'LOOPING...' }],
			['DaCapo:OnSongBegin', expect.any(Object)]
		]);
	});

	test('toggleLoopSections is safe without a song', () => {
		mockRuntime.song = null;
		expect(() => toggleLoopSections()).not.toThrow();
		expect(sectionsLooping()).toBe(true);
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopSectionsStart', { caption: 'LOOPING...' });
	});
});
