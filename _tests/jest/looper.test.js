import { jest } from '@jest/globals';
import EventBus from '../../event-bus.js';

const mockRuntime = {
	song: null,
	millisForBeatClock: 125,
	showBeats: jest.fn(),
	showBPM: jest.fn(),
	updateRealtimeTickStart: jest.fn()
};

jest.unstable_mockModule('../../infinite-neck.js', () => ({
	getSong: () => mockRuntime.song,
	getMillisForBeatClock: () => mockRuntime.millisForBeatClock,
	showBeats: () => mockRuntime.showBeats(),
	showBPM: () => mockRuntime.showBPM(),
	updateRealtimeTickStart: (text) => mockRuntime.updateRealtimeTickStart(text)
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
	getAverageSectionTransitionMs,
	installTransportTiming,
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
		mockRuntime.updateRealtimeTickStart = jest.fn();
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
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopSectionsStart');
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
			['Looper:OnLoopBeatsStart'],
			['DaCapo:OnSectionBegin', expect.any(Object)]
		]);

		triggerSpy.mockClear();
		toggleLoopBeats();
		expect(beatsLooping()).toBe(false);
		expect(clearTimeoutSpy).toHaveBeenCalledWith(99);
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopBeatsStop');
	});

	test('toggleLoopBeats emits start and stop events that UI can mirror into loop-light state', () => {
		mockRuntime.song = makeMockSong();

		toggleLoopBeats();
		toggleLoopBeats();

		expect(triggerSpy.mock.calls.filter(([eventName]) => eventName === 'Looper:OnLoopBeatsStart')).toEqual([
			['Looper:OnLoopBeatsStart']
		]);
		expect(triggerSpy.mock.calls.filter(([eventName]) => eventName === 'Looper:OnLoopBeatsStop')).toEqual([
			['Looper:OnLoopBeatsStop']
		]);
	});

	test('switching from beat loop to section loop emits stop then start', () => {
		mockRuntime.song = makeMockSong();
		toggleLoopBeats();
		triggerSpy.mockClear();
		toggleLoopSections();
		expect(triggerSpy.mock.calls).toEqual([
			['Looper:OnLoopBeatsStop'],
			['Looper:OnLoopSectionsStart'],
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
			['Looper:OnLoopSectionsStart'],
			['DaCapo:OnSongBegin', expect.any(Object)],
			['DaCapo:OnSectionBegin', expect.any(Object)]
		]);
	});

	test('toggleLoopSections is safe without a song', () => {
		mockRuntime.song = null;
		expect(() => toggleLoopSections()).not.toThrow();
		expect(sectionsLooping()).toBe(true);
		expect(triggerSpy).toHaveBeenCalledWith('Looper:OnLoopSectionsStart');
	});

	test('scheduled loop beat uses song.requestUiShowBeats when available', () => {
		mockRuntime.song = makeMockSong({ beat: 1, beats: 4 });
		toggleLoopBeats();

		const scheduledHandler = setTimeoutSpy.mock.calls[0][0];
		scheduledHandler();

		expect(mockRuntime.song.requestUiShowBeats).toHaveBeenCalledTimes(1);
		expect(mockRuntime.showBeats).not.toHaveBeenCalled();
	});

	test('a scheduled tick logs section/beat/time to the console and mirrors it into #realtimeTickStart before tickBeat runs', () => {
		mockRuntime.song = makeMockSong({ beat: 2, beats: 4, sectionIndex: 1 });
		const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
		toggleLoopSections();

		const scheduledHandler = setTimeoutSpy.mock.calls[0][0];
		scheduledHandler();

		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[LooperRealtimeTick\] \d+\s+s:1:2$/));
		expect(mockRuntime.updateRealtimeTickStart).toHaveBeenCalledWith(expect.stringMatching(/^\d{2}:\d{2}:\d{2}\.\d{3}$/));
		consoleLogSpy.mockRestore();
	});

	test('predictive section-transition lead: no adjustment until a transition duration has actually been measured', () => {
		// beats=1 means every tick is a section-transition tick (beat always >= beats), so the very
		// first schedule (before any tick has run) has zero samples and must use the flat interval.
		mockRuntime.song = makeMockSong({ beat: 1, beats: 1, sectionCount: 3 });
		toggleLoopSections();

		expect(getAverageSectionTransitionMs()).toBe(0);
		expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 125);
	});

	test('predictive section-transition lead: shortens the delay for the tick right before the next boundary once a duration is measured', () => {
		// Every Date.now() call advances the simulated clock by a fixed 10ms step, so the elapsed
		// time measured between tickStartMillis and the post-tickBeat() read is deterministically
		// 10ms (tickBeat() itself makes no Date.now() calls in this mock song), regardless of how
		// many other Date.now() calls happen elsewhere (e.g. logRealtimeTick()).
		let simulatedNowMs = 1000;
		const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
			const value = simulatedNowMs;
			simulatedNowMs += 10;
			return value;
		});
		const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

		// beats=1: the very first tick is itself a section-transition tick, and immediately after
		// it the new section's beat (still 1) is again >= beats (still 1), so the SECOND schedule
		// (for the tick right after) is the one predicted to be the next boundary tick.
		mockRuntime.song = makeMockSong({ beat: 1, beats: 1, sectionCount: 3 });
		toggleLoopSections();
		expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 125);

		const firstScheduledHandler = setTimeoutSpy.mock.calls[0][0];
		firstScheduledHandler();

		expect(getAverageSectionTransitionMs()).toBe(10);
		expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 115);
		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[LooperPredictiveLead\] mode=visual leadMs=10 delayMs=125 adjustedDelayMs=115$/));

		dateNowSpy.mockRestore();
		consoleLogSpy.mockRestore();
	});

	test('predictive section-transition lead also applies in Transport timing mode, without introducing schedule creep', () => {
		// Date.now() (used only for measuring tickBeat() duration/logRealtimeTick display) uses the
		// same auto-incrementing-by-10-per-call mock as the Visual-mode test above, so the measured
		// section-transition duration is again deterministically 10ms.
		let simulatedNowMs = 1000;
		const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
			const value = simulatedNowMs;
			simulatedNowMs += 10;
			return value;
		});
		const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

		// Transport's own clock is deliberately a SEPARATE, manually-controlled value (not tied to the
		// Date.now mock above) so its anchor arithmetic can be verified exactly, independent of how
		// many Date.now() calls happen elsewhere.
		let transportNowMs = 0;
		installTransportTiming({ now: () => transportNowMs });

		// beats=1: every tick looks like a section-transition (boundary) tick.
		mockRuntime.song = makeMockSong({ beat: 1, beats: 1, sectionCount: 3 });
		toggleLoopSections();
		// Fresh anchor: nextTickAtMillis = transportNowMs(0) + beatDurationMillis(125) = 125.
		expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 125);

		// Simulate wall-clock time reaching the nominal boundary before the timer fires.
		transportNowMs = 125;
		const firstScheduledHandler = setTimeoutSpy.mock.calls[0][0];
		firstScheduledHandler();

		expect(getAverageSectionTransitionMs()).toBe(10);
		// The anchor for the FOLLOWING boundary is fixed arithmetic (125 + 125 = 250), independent of
		// the lead applied on this call -- so the raw/pre-lead delay computed for the next schedule is
		// still the full nominal 125 (250 - transportNowMs(125)), proving no creep was introduced. Only
		// the value actually handed to setTimeout is shortened by the measured 10ms lead.
		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[LooperPredictiveLead\] mode=transport leadMs=10 delayMs=125 adjustedDelayMs=115$/));
		expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 115);

		dateNowSpy.mockRestore();
		consoleLogSpy.mockRestore();
	});
});

