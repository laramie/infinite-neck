import {
	parseMidiMessage,
	formatMidiBytesHex,
	buildNoteOnBytes,
	buildNoteOffBytes,
	parseLaunchpadProgrammerGridNote,
	launchpadGridToCell,
	cellToLaunchpadGridNote,
	listAllLaunchpadGridNotes,
	clearLaunchpadGrid,
	LAUNCHPAD_ORIENTATIONS,
	LAUNCHPAD_DEFAULT_ORIENTATION,
	LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC,
	LAUNCHPAD_VELOCITY_TRIGGER_MODE_MOMENTARY,
	sendTriggerModeIndicatorLight,
	LAUNCHPAD_RIGHT_CONTROL_COLUMN_NOTES,
	LAUNCHPAD_KNOWN_SPURIOUS_CONNECT_NOTE,
	clearLaunchpadEdgeArtifacts
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

	test('classifies genuinely unhandled channel messages (e.g. Program Change) as other, with no note/velocity', () => {
		const parsed = parseMidiMessage([0xc0, 0x05]);
		expect(parsed.type).toBe('other');
		expect(parsed.note).toBeNull();
		expect(parsed.velocity).toBeNull();
		expect(parsed.channel).toBe(0);
	});

	test('parses a Control Change message, exposing controller/ccValue (e.g. a Launchpad Pro control button)', () => {
		const parsed = parseMidiMessage([0xb0, 0x07, 0x7f]);
		expect(parsed.type).toBe('controlchange');
		expect(parsed.channel).toBe(0);
		expect(parsed.controller).toBe(0x07);
		expect(parsed.ccValue).toBe(0x7f);
		expect(parsed.note).toBeNull();
		expect(parsed.velocity).toBeNull();
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

describe('Launchpad Programmer-mode grid mapping', () => {
	test('parses a grid note into row/col per the documented base-10 formula', () => {
		expect(parseLaunchpadProgrammerGridNote(36)).toEqual({ row: 3, col: 6 });
		expect(parseLaunchpadProgrammerGridNote(11)).toEqual({ row: 1, col: 1 });
		expect(parseLaunchpadProgrammerGridNote(88)).toEqual({ row: 8, col: 8 });
	});

	test('rejects note numbers outside the 8x8 grid (control row/column)', () => {
		expect(parseLaunchpadProgrammerGridNote(1)).toBeNull(); // row 0
		expect(parseLaunchpadProgrammerGridNote(10)).toBeNull(); // col 0
		expect(parseLaunchpadProgrammerGridNote(89)).toBeNull(); // col 9
		expect(parseLaunchpadProgrammerGridNote(99)).toBeNull(); // row 9
	});

	test('launchpadGridToCell maps 1-based grid position to 0-based cellrow/cellcol using the default (normal) orientation', () => {
		// normal: hardware row 8 (top of device) -> cellrow 0 (top of screen).
		expect(launchpadGridToCell(8, 1)).toEqual({ cellrow: 0, cellcol: 0 });
		expect(launchpadGridToCell(3, 6)).toEqual({ cellrow: 5, cellcol: 5 });
		expect(launchpadGridToCell(1, 8)).toEqual({ cellrow: 7, cellcol: 7 });
	});

	test('launchpadGridToCell supports an inverted orientation', () => {
		expect(launchpadGridToCell(1, 1, { orientation: 'inverted' })).toEqual({ cellrow: 0, cellcol: 0 });
		expect(launchpadGridToCell(8, 1, { orientation: 'inverted' })).toEqual({ cellrow: 7, cellcol: 0 });
	});

	test('cellToLaunchpadGridNote is the inverse of launchpadGridToCell under the default (normal) orientation', () => {
		expect(cellToLaunchpadGridNote(0, 0)).toBe(81);
		expect(cellToLaunchpadGridNote(5, 5)).toBe(36);
		expect(cellToLaunchpadGridNote(7, 7)).toBe(18);
	});

	test('cellToLaunchpadGridNote supports an inverted orientation', () => {
		expect(cellToLaunchpadGridNote(0, 0, { orientation: 'inverted' })).toBe(11);
		expect(cellToLaunchpadGridNote(7, 0, { orientation: 'inverted' })).toBe(81);
	});

	test('LAUNCHPAD_DEFAULT_ORIENTATION is normal, matching the confirmed real-device mapping', () => {
		expect(LAUNCHPAD_DEFAULT_ORIENTATION).toBe('normal');
		expect(LAUNCHPAD_ORIENTATIONS).toEqual(['normal', 'inverted']);
	});

	test('listAllLaunchpadGridNotes lists exactly the 64 real 8x8 grid notes, no control row/column', () => {
		const notes = listAllLaunchpadGridNotes();
		expect(notes).toHaveLength(64);
		expect(new Set(notes).size).toBe(64);
		notes.forEach((note) => {
			expect(parseLaunchpadProgrammerGridNote(note)).not.toBeNull();
		});
		expect(notes).toContain(11);
		expect(notes).toContain(88);
		expect(notes).not.toContain(19);
		expect(notes).not.toContain(91);
	});

	test('clearLaunchpadGrid sends a velocity-0 Note On for every one of the 64 grid notes', () => {
		const sent = [];
		const fakeOutput = { send: (bytes) => sent.push(Array.from(bytes)) };
		clearLaunchpadGrid(fakeOutput, 0);
		expect(sent).toHaveLength(64);
		sent.forEach(([statusByte, note, velocity]) => {
			expect(statusByte).toBe(0x90);
			expect(velocity).toBe(0);
			expect(parseLaunchpadProgrammerGridNote(note)).not.toBeNull();
		});
	});

	test('clearLaunchpadGrid encodes the requested channel', () => {
		const sent = [];
		const fakeOutput = { send: (bytes) => sent.push(Array.from(bytes)) };
		clearLaunchpadGrid(fakeOutput, 3);
		expect(sent[0][0]).toBe(0x93);
	});
});

describe('Launchpad trigger-mode control button + edge-artifact cleanup', () => {
	test('LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC matches the confirmed real-device control number', () => {
		expect(LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC).toBe(10);
	});

	test('sendTriggerModeIndicatorLight sends the momentary-on velocity at the control button address', () => {
		const sent = [];
		const fakeOutput = { send: (bytes) => sent.push(Array.from(bytes)) };
		sendTriggerModeIndicatorLight(fakeOutput, 0, true);
		expect(sent).toEqual([[0x90, LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC, LAUNCHPAD_VELOCITY_TRIGGER_MODE_MOMENTARY]]);
	});

	test('sendTriggerModeIndicatorLight sends velocity 0 (light off) for Latch mode', () => {
		const sent = [];
		const fakeOutput = { send: (bytes) => sent.push(Array.from(bytes)) };
		sendTriggerModeIndicatorLight(fakeOutput, 0, false);
		expect(sent).toEqual([[0x90, LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC, 0]]);
	});

	test('clearLaunchpadEdgeArtifacts wipes the right control column and the known spurious-connect note', () => {
		const sent = [];
		const fakeOutput = { send: (bytes) => sent.push(Array.from(bytes)) };
		clearLaunchpadEdgeArtifacts(fakeOutput, 0);
		const notesSent = sent.map(([, note]) => note);
		expect(notesSent).toEqual([...LAUNCHPAD_RIGHT_CONTROL_COLUMN_NOTES, LAUNCHPAD_KNOWN_SPURIOUS_CONNECT_NOTE]);
		sent.forEach(([statusByte, , velocity]) => {
			expect(statusByte).toBe(0x90);
			expect(velocity).toBe(0);
		});
	});
});
