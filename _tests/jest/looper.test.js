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
	getLoopTimingMode,
	LoopTimingMode,
	__resetLooperForTests
} = await import('../../looper.js');

function makeMockSong({ beat = 1, beats = 4, randomLoop = false, sectionIndex = 0, sectionCount = 2 } = {}) {
	const s = {
		_beat: beat,
		_beats: beats,
		randomLoop,
		_sectionIndex: sectionIndex,
		_sectionCount: sectionCount
	};
	s.getBeat = jest.fn(() => s._beat);
	s.getBeats = jest.fn(() => s._beats);
	s.getSectionsCurrentIndex = jest.fn(() => s._sectionIndex);
	s.getSections = jest.fn(() => Array.from({ length: s._sectionCount }, (_, idx) => ({ caption: `Section ${idx + 1}` })));
	s.incBeatLoop = jest.fn();
	s.gotoNextSection = jest.fn((orGotoFirst) => {
		if (s._sectionIndex + 1 >= s._sectionCount) {
			s._sectionIndex = orGotoFirst ? 0 : s._sectionIndex;
		} else {
			s._sectionIndex += 1;
		}
		s._beat = 1;
	});
	s.requestUiShowBeats = jest.fn();
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
		const triggerSpy = jest.spyOn(EventBus, 'trigger');
		tickBeat(song, { sectionsLooping: false, showBeats });
		expect(song.incBeatLoop).toHaveBeenCalledTimes(1);
		expect(showBeats).toHaveBeenCalledTimes(1);
		expect(song.gotoNextSection).not.toHaveBeenCalled();
		expect(triggerSpy.mock.calls).toEqual([
			['DaCapo:OnSectionEnd', expect.any(Object)],
			['DaCapo:OnSectionBegin', expect.any(Object)]
		]);
		triggerSpy.mockRestore();
	});

	test('end-of-beat tick with section loop: advances section (gotoNextSection calls showBeats internally)', () => {
		const song = makeMockSong({ beat: 4, beats: 4 });
		const showBeats = jest.fn();
		tickBeat(song, { sectionsLooping: true, showBeats });
		expect(song.gotoNextSection).toHaveBeenCalledWith(true);
		expect(song.incBeatLoop).not.toHaveBeenCalled();
		expect(showBeats).not.toHaveBeenCalled();
	});

	test('end-of-song section-loop wrap emits song end, song begin, then section begin', () => {
		const song = makeMockSong({ beat: 4, beats: 4, sectionIndex: 1, sectionCount: 2 });
		const showBeats = jest.fn();
		const triggerSpy = jest.spyOn(EventBus, 'trigger');

		tickBeat(song, { sectionsLooping: true, showBeats });

		expect(song.gotoNextSection).toHaveBeenCalledWith(true);
		expect(song.getSectionsCurrentIndex()).toBe(0);
		expect(triggerSpy.mock.calls).toEqual([
			['DaCapo:OnSectionEnd', expect.objectContaining({ sectionIndex: 1, sectionCount: 2, beat: 4, beats: 4 })],
			['DaCapo:OnSongEnd', expect.objectContaining({ sectionIndex: 1, sectionCount: 2, beat: 4, beats: 4 })],
			['DaCapo:OnSongBegin', expect.objectContaining({ sectionIndex: 0, sectionCount: 2, beat: 1, beats: 4 })],
			['DaCapo:OnSectionBegin', expect.objectContaining({ sectionIndex: 0, sectionCount: 2, beat: 1, beats: 4 })]
		]);
		triggerSpy.mockRestore();
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
	let setTimeoutSpy;
	let clearTimeoutSpy;

	beforeEach(() => {
		__resetLooperForTests();
		mockRuntime.song = null;
		mockRuntime.millisForBeatClock = 125;
		mockRuntime.showBeats = jest.fn();
		mockRuntime.showBPM = jest.fn();
		triggerSpy = jest.spyOn(EventBus, 'trigger');
		setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(() => 99);
		clearTimeoutSpy = jest.spyOn(global, 'clearTimeout').mockImplementation(() => {});
	});

	afterEach(() => {
		triggerSpy.mockRestore();
		setTimeoutSpy.mockRestore();
		clearTimeoutSpy.mockRestore();
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
		expect(getLoopTimingMode()).toBe(LoopTimingMode.VISUAL);
		expect(mockRuntime.showBPM).toHaveBeenCalledTimes(1);
		expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 125);
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
		expect(clearTimeoutSpy).toHaveBeenCalledWith(99);
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopSectionsStop');
	});

	test('toggleLoopBeats turns beats looping on then off', () => {
		mockRuntime.song = makeMockSong();
		toggleLoopBeats();
		expect(beatsLooping()).toBe(true);
		expect(sectionsLooping()).toBe(false);
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 125);
		expect(triggerSpy.mock.calls).toEqual([
			['Looper:OnLoopBeatsStart', { caption: 'LOOPING...' }],
			['DaCapo:OnSectionBegin', expect.any(Object)]
		]);

		triggerSpy.mockClear();
		toggleLoopBeats();
		expect(beatsLooping()).toBe(false);
		expect(clearTimeoutSpy).toHaveBeenCalledWith(99);
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
			['DaCapo:OnSongBegin', expect.any(Object)],
			['DaCapo:OnSectionBegin', expect.any(Object)]
		]);
	});

	test('restartLoopSections keeps sections looping active', () => {
		mockRuntime.song = makeMockSong();
		restartLoopSections();
		expect(sectionsLooping()).toBe(true);
		triggerSpy.mockClear();
		restartLoopSections();
		expect(sectionsLooping()).toBe(true);
		expect(clearTimeoutSpy).toHaveBeenCalledWith(99);
		expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
		expect(triggerSpy.mock.calls).toEqual([
			['Looper:OnLoopSectionsStop'],
			['Looper:OnLoopSectionsStart', { caption: 'LOOPING...' }],
			['DaCapo:OnSongBegin', expect.any(Object)],
			['DaCapo:OnSectionBegin', expect.any(Object)]
		]);
	});

	test('toggleLoopSections is safe without a song', () => {
		mockRuntime.song = null;
		expect(() => toggleLoopSections()).not.toThrow();
		expect(sectionsLooping()).toBe(true);
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopSectionsStart', { caption: 'LOOPING...' });
	});

	test('scheduled loop beat uses song.requestUiShowBeats when available', () => {
		mockRuntime.song = makeMockSong({ beat: 1, beats: 4 });
		toggleLoopBeats();

		const scheduledHandler = setTimeoutSpy.mock.calls[0][0];
		scheduledHandler();

		expect(mockRuntime.song.requestUiShowBeats).toHaveBeenCalledTimes(1);
		expect(mockRuntime.showBeats).not.toHaveBeenCalled();
	});
});
