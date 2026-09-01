import {
	parseMidiMessage,
	formatMidiBytesHex,
	buildNoteOnBytes,
	buildNoteOffBytes
} from '../../midi-io.js';

describe('midi-io pure helpers', () => {
	test('parses a Note On message', () => {
		const parsed = parseMidiMessage([0x90, 0x3c, 0x01]);
		expect(parsed).toEqual({
			type: 'noteon',
			channel: 0,
			note: 0x3c,
			velocity: 0x01,
			statusByte: 0x90,
			raw: [0x90, 0x3c, 0x01]
		});
	});

	test('treats a Note On with velocity 0 as a Note Off', () => {
		const parsed = parseMidiMessage([0x90, 0x30, 0x00]);
		expect(parsed.type).toBe('noteoff');
		expect(parsed.note).toBe(0x30);
		expect(parsed.velocity).toBe(0);
	});

	test('parses an explicit Note Off message', () => {
		const parsed = parseMidiMessage([0x80, 0x3c, 0x40]);
		expect(parsed.type).toBe('noteoff');
		expect(parsed.channel).toBe(0);
		expect(parsed.note).toBe(0x3c);
	});

	test('reads the channel from the low nibble of the status byte', () => {
		const parsed = parseMidiMessage([0x91, 0x40, 0x7f]);
		expect(parsed.channel).toBe(1);
	});

	test('classifies non-note channel messages as other, with no note/velocity', () => {
		const parsed = parseMidiMessage([0xb0, 0x07, 0x7f]);
		expect(parsed.type).toBe('other');
		expect(parsed.note).toBeNull();
		expect(parsed.velocity).toBeNull();
		expect(parsed.channel).toBe(0);
	});

	test('system messages (status >= 0xf0) have no channel', () => {
		const parsed = parseMidiMessage([0xf8]);
		expect(parsed.channel).toBeNull();
		expect(parsed.type).toBe('other');
	});

	test('formatMidiBytesHex matches the reference MIDI monitor log format', () => {
		expect(formatMidiBytesHex([0x90, 0x3c, 0x01])).toBe('90 3C 01');
		expect(formatMidiBytesHex([0x90, 0x30, 0x00])).toBe('90 30 00');
	});

	test('buildNoteOnBytes encodes channel/note/velocity into a Note On message', () => {
		expect(Array.from(buildNoteOnBytes(0, 0x3c, 1))).toEqual([0x90, 0x3c, 0x01]);
		expect(Array.from(buildNoteOnBytes(0, 0x3c))).toEqual([0x90, 0x3c, 127]);
	});

	test('buildNoteOffBytes encodes channel/note/velocity into a Note Off message', () => {
		expect(Array.from(buildNoteOffBytes(0, 0x3c))).toEqual([0x80, 0x3c, 0]);
	});

	test('channel is masked to 0-15 so an out-of-range channel cannot corrupt the status byte', () => {
		expect(Array.from(buildNoteOnBytes(16, 60, 127))[0]).toBe(0x90);
	});
});
