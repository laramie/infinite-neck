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
