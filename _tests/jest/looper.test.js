import { jest } from '@jest/globals';
import { setLooperProviders, sectionsLooping, beatsLooping, tickBeat } from '../../looper.js';

function makeMockSong({ beat = 1, beats = 4 } = {}) {
	const s = {
		_beat: beat,
		_beats: beats,
	};
	s.getBeat = jest.fn(() => s._beat);
	s.getBeats = jest.fn(() => s._beats);
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

describe('looper looping-state providers', () => {
	test('sectionsLooping true for LOOPING... caption', () => {
		setLooperProviders({
			getLoopSectionsCaption: () => 'LOOPING...'
		});
		expect(sectionsLooping()).toBe(true);
	});

	test('sectionsLooping true for RANDOM.... caption', () => {
		setLooperProviders({
			getLoopSectionsCaption: () => 'RANDOM....'
		});
		expect(sectionsLooping()).toBe(true);
	});

	test('sectionsLooping false for non-loop caption', () => {
		setLooperProviders({
			getLoopSectionsCaption: () => 'LOOP'
		});
		expect(sectionsLooping()).toBe(false);
	});

	test('beatsLooping reflects loop-beats caption', () => {
		setLooperProviders({
			getLoopBeatsCaption: () => 'LOOPING...'
		});
		expect(beatsLooping()).toBe(true);

		setLooperProviders({
			getLoopBeatsCaption: () => 'LOOP BEATS'
		});
		expect(beatsLooping()).toBe(false);
	});
});
