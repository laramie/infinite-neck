/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Thin wrapper around the native Web MIDI API. No third-party dependency.
// Sprint 143 (midi-note-in), Iteration 1: see
// _doco/design/sprints/143-midi-note-in/143-it1-plan.md for the design/viability
// discussion behind this module.
//
// This module is deliberately app-agnostic: it does not know about EventBus,
// jQuery, or the rest of infinite-neck. It is exercised directly by the
// standalone tester page at
// _doco/design/sprints/143-midi-note-in/143-it1-midi-prototype.html.
//
// Pure, DOM/navigator-free helpers (parseMidiMessage, formatMidiBytesHex,
// buildNoteOnBytes, buildNoteOffBytes) are unit-tested in
// _tests/jest/midi-io.test.js. Everything else here is a thin integration
// layer over navigator.requestMIDIAccess/MIDIInput/MIDIOutput and is only
// verified by manual acceptance testing against a real MIDI device, per this
// repo's Jest conventions (no JSDom/browser MIDI mocking).

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

// Parses a raw MIDI Channel Voice message (a Uint8Array-like of 1-3 bytes,
// e.g. event.data from a MIDIMessageEvent) into a plain object.
//
// A Note On message with velocity 0 is, per the MIDI spec's running-status
// convention, treated as a Note Off (not a second Note On) -- this matters
// for the "bright screen" indicator so it does not misreport note releases.
export function parseMidiMessage(data) {
	const statusByte = data[0];
	const command = statusByte & 0xf0;
	const isSystemMessage = statusByte >= 0xf0;
	const channel = isSystemMessage ? null : statusByte & 0x0f;
	const note = data.length > 1 ? data[1] : null;
	const velocity = data.length > 2 ? data[2] : null;

	let type = 'other';
	if (command === NOTE_ON) {
		type = velocity > 0 ? 'noteon' : 'noteoff';
	} else if (command === NOTE_OFF) {
		type = 'noteoff';
	}

	return {
		type,
		channel,
		note: (type === 'noteon' || type === 'noteoff') ? note : null,
		velocity: (type === 'noteon' || type === 'noteoff') ? velocity : null,
		statusByte,
		raw: Array.from(data)
	};
}

// Formats raw MIDI bytes as an uppercase, space-separated hex string, e.g.
// [144, 60, 1] -> "90 3C 01" -- matches the log format used by common MIDI
// monitor tools (and the example log in 143-it1-design-2.md).
export function formatMidiBytesHex(bytes) {
	return Array.from(bytes)
		.map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
		.join(' ');
}

function clampToNibble(value) {
	return value & 0x0f;
}

function clampToDataByte(value) {
	return value & 0x7f;
}

// Builds the 3-byte payload for a Note On channel voice message.
// channel is 0-based (0-15, i.e. MIDI channel 1-16).
export function buildNoteOnBytes(channel, note, velocity = 127) {
	return new Uint8Array([
		NOTE_ON | clampToNibble(channel),
		clampToDataByte(note),
		clampToDataByte(velocity)
	]);
}

// Builds the 3-byte payload for a Note Off channel voice message.
// A velocity of 0 sent as a Note On (NOTE_ON | channel, note, 0) is
// functionally equivalent to this and is what most controllers actually
// send, but this helper emits an explicit 0x80 Note Off for clarity when the
// caller wants one.
export function buildNoteOffBytes(channel, note, velocity = 0) {
	return new Uint8Array([
		NOTE_OFF | clampToNibble(channel),
		clampToDataByte(note),
		clampToDataByte(velocity)
	]);
}

// Requests access to the browser's MIDI ports. Resolves to a MIDIAccess
// object, or rejects with a plain Error (including on browsers that don't
// implement the Web MIDI API at all).
export function requestMidiAccess(options = { sysex: false }) {
	if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
		return Promise.reject(new Error('Web MIDI API is not available in this browser.'));
	}
	return navigator.requestMIDIAccess(options);
}

export function listInputs(midiAccess) {
	return Array.from(midiAccess.inputs.values());
}

export function listOutputs(midiAccess) {
	return Array.from(midiAccess.outputs.values());
}

// Attaches a parsed-message listener to a MIDIInput. handler is called as
// handler(parsedMessage, rawEvent) for every message the port receives.
// Returns a dispose() function that detaches the listener.
export function attachInputListener(input, handler) {
	input.onmidimessage = (event) => {
		handler(parseMidiMessage(event.data), event);
	};
	return function dispose() {
		input.onmidimessage = null;
	};
}

export function sendNoteOn(output, channel, note, velocity = 127) {
	output.send(buildNoteOnBytes(channel, note, velocity));
}

export function sendNoteOff(output, channel, note, velocity = 0) {
	output.send(buildNoteOffBytes(channel, note, velocity));
}

// ---------------------------------------------------------------------------
// Launchpad Pro "Programmer mode" grid mapping.
// Sprint 143 (midi-note-in), Iteration 3: see
// _doco/design/sprints/143-midi-note-in/143-design-3.md (orientation
// confirmed against the real device in this iteration's follow-up request).
//
// In Programmer mode the device's 8x8 grid of pads sends NOTE ON with a note
// number encoding row/column in base-10: tens digit = row (1-8), units digit
// = column (1-8) -- e.g. note 36 -> row 3, column 6. Notes outside that 1-8/1-8
// range (the extra control-button row/column around the grid) are not part of
// the 8x8 grid and are treated as "not a grid note" by parseLaunchpadProgrammerGridNote.
//
// Orientation: on the real Launchpad Pro used for this sprint, hardware row 8
// (tens digit 8, e.g. notes 81-88) is the physically TOP row of the device,
// same as this repo's "8x8" tuning's cellrow 0 is the top row of the rendered
// table -- top matches top, mirroring how a guitar's thinnest/highest string
// is drawn at the top. That correspondence is "normal" orientation (the
// default). A device wired up backwards (hardware row 1 at the top) would use
// "inverted" instead.
// ---------------------------------------------------------------------------

export const LAUNCHPAD_GRID_SIZE = 8;
export const LAUNCHPAD_VELOCITY_RED = 5;
export const LAUNCHPAD_ORIENTATIONS = Object.freeze(['normal', 'inverted']);
export const LAUNCHPAD_DEFAULT_ORIENTATION = 'normal';

// Returns {row, col} (both 1-8) for a real Launchpad Programmer-mode grid
// note, or null if the note number isn't part of the 8x8 grid.
export function parseLaunchpadProgrammerGridNote(note) {
	const row = Math.floor(note / 10);
	const col = note % 10;
	if (row < 1 || row > LAUNCHPAD_GRID_SIZE || col < 1 || col > LAUNCHPAD_GRID_SIZE) {
		return null;
	}
	return { row, col };
}

// Converts a 1-8/1-8 Launchpad grid position to a 0-7/0-7 (cellrow, cellcol)
// pair matching this repo's "8x8" tuning's <td> attributes.
export function launchpadGridToCell(row, col, { orientation = LAUNCHPAD_DEFAULT_ORIENTATION } = {}) {
	return {
		cellrow: orientation === 'inverted' ? (row - 1) : (LAUNCHPAD_GRID_SIZE - row),
		cellcol: col - 1
	};
}

// Inverse of launchpadGridToCell: builds the Launchpad Programmer-mode NOTE
// ON note number for a given (cellrow, cellcol) on the "8x8" tuning.
export function cellToLaunchpadGridNote(cellrow, cellcol, { orientation = LAUNCHPAD_DEFAULT_ORIENTATION } = {}) {
	const row = orientation === 'inverted' ? (cellrow + 1) : (LAUNCHPAD_GRID_SIZE - cellrow);
	const col = cellcol + 1;
	return row * 10 + col;
}

// Every real Programmer-mode grid note number (11..88, decimal, row/col both
// 1-8) -- excludes the surrounding control-button row/column, which are not
// part of the 8x8 grid and must not be lit/cleared by grid-wide operations.
export function listAllLaunchpadGridNotes() {
	const notes = [];
	for (let row = 1; row <= LAUNCHPAD_GRID_SIZE; row++) {
		for (let col = 1; col <= LAUNCHPAD_GRID_SIZE; col++) {
			notes.push(row * 10 + col);
		}
	}
	return notes;
}

// Sends NOTE ON with velocity 0 for every grid note, per 143-design-3.md's
// "simple algorithm...for now" (a full SysEx-based screen wipe is explicitly
// out of scope). Intended to be called once per Section change/navigation,
// immediately before repainting the currently active notes.
export function clearLaunchpadGrid(output, channel = 0) {
	listAllLaunchpadGridNotes().forEach((note) => {
		sendNoteOn(output, channel, note, 0);
	});
}
