import { jest } from '@jest/globals';
import {
	setLooperProviders,
	sectionsLooping,
	beatsLooping,
	tickBeat,
	toggleLoopSections,
	toggleLoopBeats,
	restartLoopSections,
	__resetLooperForTests,
	__resetLooperProvidersForTests
} from '../../looper.js';

function makeMockSong({ beat = 1, beats = 4 } = {}) {
	const s = {
		_beat: beat,
		_beats: beats,
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
	test('looping state defaults to false', () => {
		expect(sectionsLooping()).toBe(false);
		expect(beatsLooping()).toBe(false);
	});
});

function installHeadlessLoopState({ randomLoop = false } = {}) {
	const state = {
		sectionsCaption: 'LOOP',
		beatsCaption: 'LOOP BEATS',
		sectionsOn: false,
		beatsOn: false,
		transportOn: false,
		lastIntervalMs: null,
		setIntervalCalls: 0,
		clearIntervalCalls: 0,
		showBPMCalls: 0,
	};

	setLooperProviders({
		getSong: () => ({
			randomLoop,
			getSectionsCurrentIndex: () => 0,
			getSections: () => [{ caption: 'One' }, { caption: 'Two' }],
			getBeat: () => 1,
			getBeats: () => 4
		}),
		getMillisForBeatClock: () => 125,
		setLoopSectionsButton: (caption, isOn) => {
			state.sectionsCaption = caption;
			state.sectionsOn = !!isOn;
		},
		setLoopBeatsButton: (caption, isOn) => {
			state.beatsCaption = caption;
			state.beatsOn = !!isOn;
		},
		setLoopBeatsTransportButton: (isOn) => {
			state.transportOn = !!isOn;
		},
		setLoopInterval: (_handler, millis) => {
			state.lastIntervalMs = millis;
			state.setIntervalCalls += 1;
			return 99;
		},
		clearLoopInterval: () => {
			state.clearIntervalCalls += 1;
		},
		showBPM: () => {
			state.showBPMCalls += 1;
		}
	});

	return state;
}

describe('looper toggles and restart', () => {
	beforeEach(() => {
		__resetLooperForTests();
	});

	test('toggleLoopSections turns sections looping on when off', () => {
		const state = installHeadlessLoopState();
		toggleLoopSections();
		expect(sectionsLooping()).toBe(true);
		expect(beatsLooping()).toBe(false);
		expect(state.sectionsCaption).toBe('LOOPING...');
		expect(state.sectionsOn).toBe(true);
		expect(state.setIntervalCalls).toBe(1);
		expect(state.lastIntervalMs).toBe(125);
		expect(state.showBPMCalls).toBe(1);
	});

	test('toggleLoopSections turns sections looping off when on', () => {
		const state = installHeadlessLoopState();
		toggleLoopSections();
		toggleLoopSections();
		expect(sectionsLooping()).toBe(false);
		expect(beatsLooping()).toBe(false);
		expect(state.sectionsCaption).toBe('LOOP');
		expect(state.sectionsOn).toBe(false);
		expect(state.beatsCaption).toBe('LOOP BEATS');
		expect(state.transportOn).toBe(false);
		expect(state.clearIntervalCalls).toBe(1);
	});

	test('toggleLoopBeats turns beats looping on then off', () => {
		const state = installHeadlessLoopState();
		toggleLoopBeats();
		expect(beatsLooping()).toBe(true);
		expect(sectionsLooping()).toBe(false);
		expect(state.beatsCaption).toBe('LOOPING...');
		expect(state.beatsOn).toBe(true);
		expect(state.transportOn).toBe(true);
		toggleLoopBeats();
		expect(beatsLooping()).toBe(false);
		expect(state.beatsCaption).toBe('LOOP BEATS');
		expect(state.beatsOn).toBe(false);
		expect(state.transportOn).toBe(false);
	});

	test('restartLoopSections keeps sections looping active', () => {
		const state = installHeadlessLoopState();
		restartLoopSections();
		expect(sectionsLooping()).toBe(true);
		expect(state.sectionsCaption).toBe('LOOPING...');
		restartLoopSections();
		expect(sectionsLooping()).toBe(true);
		expect(state.sectionsCaption).toBe('LOOPING...');
		expect(state.sectionsOn).toBe(true);
		expect(state.setIntervalCalls).toBe(2);
		expect(state.clearIntervalCalls).toBe(1);
	});
});

describe('looper default provider safety', () => {
	test('sectionsLooping/beatsLooping are safe without jquery', () => {
		__resetLooperForTests();
		__resetLooperProvidersForTests();
		expect(() => sectionsLooping()).not.toThrow();
		expect(() => beatsLooping()).not.toThrow();
		expect(sectionsLooping()).toBe(false);
		expect(beatsLooping()).toBe(false);
	});
});
