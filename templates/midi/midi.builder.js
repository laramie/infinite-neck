/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 143 (midi-note-in), Iterations 3-4 (+ Iteration 4 round 2): see
// _doco/design/sprints/143-midi-note-in/143-design-3.md,
// 143-it4-design.md/143-it4-implementation-plan.md, and 143-it4-design-2.md
// for the design discussion behind this module. NoteMode is explicitly out
// of scope for Iteration 4; only Programmer mode's Momentary/Latch +
// downstream forwarding are covered.
//
// Iteration 4 round 2 (143-it4-design-2.md) added two more paint-plan
// sources, both LIGHTS ONLY (never forwarded downstream, never affecting
// pitchPlan): Highlight overlays (magenta "Highlight Multi"/yellow "Highlight
// Pitch (MIDI)", always winning over whatever note color is underneath) and
// Recorded Notes (the beat-keyed sectionNotes.recordedNotes[] Looper-playback
// overlay, previously not read by this module at all) -- see
// buildDevicePaintPlan()'s doc comment for the full read-source breakdown and
// why recordedNotes/live-highlight-DOM reads are handled differently
// depending on which trigger (click vs. beat-tick) is building the plan.
//
// Builds the "MIDI" Desktop tab: MIDI IN/OUT device pickers ported from the
// Iteration 1 standalone prototype, plus Instrument routing (NOTE ON/OFF from
// the device -> row/col or raw MIDI note -> a click on the routed
// Instrument's matching <td class="note">, and NOTE OUT of whatever notes
// are on for that Instrument, colored per the device's configured colorMap),
// PLUS (Iteration 4) forwarding of the SAME notes as true MIDI pitches to a
// separate downstream sound device (e.g. a VoiceLive 3).
//
// Device config (name/mode/colorMap/orientation/triggerMode/tableID/channel/
// enabled/forwardName/forwardChannel) is persisted on the Song itself
// (song.midiDevice, normalized by SongPersistence.js) so it follows the Song
// file rather than living only in this module's in-memory state -- this
// class always reads/writes getSong().midiDevice directly rather than
// keeping its own mirrored copy.
//
// Per 143-design-3.md, Latch mode (the default) ignores button-up (NOTE OFF)
// entirely. Per 143-it4-design.md, Momentary mode ALSO toggles the note off
// on button-up (see handleIncomingMidiMessage()'s comment for the exact
// Latch<->Momentary transition semantics). MIDI OUT tracks a "paint plan"
// (Map<outNote, velocity>) of whatever should currently be lit on the
// Launchpad, PLUS a parallel "pitch plan" (Map<midinum, velocity>) of true
// MIDI pitches for downstream forwarding -- both rebuilt from the routed
// table's namedNotes/playedNotes on two triggers:
//   - 'Widget:SectionStatus:statusChanged' (replayTable() fires this once per
//     visible table on Section navigation and every Looper beat tick) -> full
//     clear-and-repaint of the LIGHTS ONLY, skipped entirely if the freshly
//     computed light-plan is identical to what's already lit (avoids visibly
//     re-flashing the grid for redundant back-to-back firings of this event
//     for the same Section). The pitch-plan baseline is still silently
//     refreshed here (no forwarding message sent) so a later click's diff
//     stays accurate.
//   - 'Note:colored' (colorNote() fires this on every td.note click/press) ->
//     a targeted diff against the previous plan for BOTH lights (only
//     changed notes get a message, so composing on the neck doesn't flash
//     the whole grid) AND pitches (forwarded downstream) -- see
//     forwardPitchChanges()'s doc comment for why forwarding only ever
//     happens from here, never from Section navigation.
// Neither hook required any changes to NoteTableController.js.

import { getSong, getCurrentSection } from '../../infinite-neck.js';
import EventBus from '../../event-bus.js';
import {
	requestMidiAccess,
	listInputs,
	listOutputs,
	attachInputListener,
	sendNoteOn,
	sendNoteOff,
	sendControlChange,
	sendLightAllLedsSysEx,
	formatMidiBytesHex,
	parseLaunchpadProgrammerGridNote,
	launchpadGridToCell,
	cellToLaunchpadGridNote,
	clearLaunchpadGrid,
	clearLaunchpadEdgeArtifacts,
	LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC,
	sendTriggerModeIndicatorLight
} from '../../midi-io.js';
import { resolveLaunchpadVelocityForColorClass, LAUNCHPAD_MAJOR_COLOR_VELOCITIES } from './midiColorMaps.js';
import { colorNote, findNoteCell, showMidiNotesInTable } from '../../NoteTableController.js';
import { createLookupContext, lookupUserColorClass } from '../../colorFunctions.js';
import { Note } from '../../Note.js';
import { PalettePresentation } from '../../presentation.js';
import * as paletteUtils from '../../paletteUtils.js';
import {
	classifyInstrumentRole,
	getSongTuningsInLayoutOrder,
	tableIDForBaseID,
	WIRING_MAIN
} from '../../InstrumentRoleBadges.js';

// Prefer a device whose name matches this substring when auto-selecting the
// initial MIDI IN/OUT device (used only when song.midiDevice.name isn't set
// yet, e.g. a brand new Song), per the Launchpad Pro used for design/testing.
const PREFERRED_DEVICE_NAME_SUBSTRING = 'Launchpad';
// Same idea for the downstream sound-device forward output (Iteration 4),
// e.g. a VoiceLive 3 reached over a Class-Compliant-USB MIDI cable.
const PREFERRED_FORWARD_DEVICE_NAME_SUBSTRING = 'VoiceLive';
// Same idea for the debug/test-send output select (Iteration 5, Round 1,
// 143-it5-design.md "Debug output versus wired output") -- the debug panel's
// whole purpose is sending raw test messages straight to the Class-Compliant
// cable (advertised as "CH345 MIDI 1"), not the Launchpad.
const PREFERRED_DEBUG_DEVICE_NAME_SUBSTRING = 'CH345';

// Highlight overlay colors (Iteration 4 round 2, 143-it4-design-2.md): fixed
// Launchpad velocities that always win over whatever named/played/recorded
// note color would otherwise show for that exact cell, independent of the
// device's configured colorMap -- these are performance-status indicators
// (is this pitch/cell currently highlighted), not user-chosen chart colors.
// 'noteHighlightSingle'/STYLENUM_MIDIPITCHESSINGLE is "Highlight Multi"
// (keystroke ']', one specific cell); 'noteHighlight'/STYLENUM_MIDIPITCHES is
// "Highlight Pitch (MIDI)" (keystroke '[', EVERY cell sharing that midinum
// across the tuning -- mirrors colorNoteInner()'s own
// td.note[midinum=...] selector, which has no cellrow filter).
const LAUNCHPAD_VELOCITY_HIGHLIGHT_MULTI = 53; // magenta
const LAUNCHPAD_VELOCITY_HIGHLIGHT_PITCH = 14; // yellow

// Iteration 4 round 3 (physical control buttons): row 9 (the top control row,
// ABOVE the 8x8 grid), columns 1-8 -- confirmed via a real Launchpad Pro MK1
// activity log to send Control Change messages with controller number == the
// column number directly (a DIFFERENT addressing scheme than the left-control-
// column's Latch/Momentary button, which uses a row*10+col-style address --
// see LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC in midi-io.js): col 1 sends
// [B0 01 7F]/[B0 01 00] on press/release, col 8 sends [B0 08 7F]/[B0 08 00],
// and so on. Per Laramie's mapping request, columns 1-6 are wired to the
// Palette's rbHighlight ("NoteType", per NoteTableController.js's own
// `result.NoteType = theHighlight`) radio group -- a press selects that radio
// exactly like an on-screen click (paletteUtils.check(), see
// handleIncomingMidiMessage() below); release is ignored, same toggle-switch
// behavior as the CC10 Latch/Momentary button. Columns 7-8 have no entry here
// (reserved/unused for now) -- handleIncomingMidiMessage() simply ignores any
// controller number not present in this map.
const LAUNCHPAD_NOTE_TYPE_CONTROL_MAP = Object.freeze({
	1: Object.freeze({ radioSelector: '#idNamedNotes', noteType: 'Named' }),
	2: Object.freeze({ radioSelector: '#idSingleNotes', noteType: 'Single' }),
	3: Object.freeze({ radioSelector: '#idTinyNotes', noteType: 'Tiny' }),
	4: Object.freeze({ radioSelector: '#rbBend', noteType: 'Bend' }),
	5: Object.freeze({ radioSelector: '#idMidiPitches', noteType: 'MidiPitches' }),
	6: Object.freeze({ radioSelector: '#idMidiPitchesSingle', noteType: 'MidiPitchesSingle' })
});

// "Selected" indicator color for the row above -- green, a sensible default (the
// user's own control-button research used [90 0A 15]/green as its illustrative
// example of lighting a control button) since no color was specified for this
// particular row. Easy to retune later (single constant), same spirit as
// CYCLE_ORDER's own developer-retunability in midiColorMaps.js.
const LAUNCHPAD_VELOCITY_NOTE_TYPE_SELECTED = LAUNCHPAD_MAJOR_COLOR_VELOCITIES.GREEN;

// Iteration 4 round 4 (143-it4-round-4-design.md): column 0 (REC), column 9
// (Section/Beat navigation + Looper toggles), and row 9 cols 7-8 (Prev/Next
// Beat) control buttons. The design doc's own row numbering (row 0 = top of
// page, row 9 = bottom) maps onto this module's underlying Launchpad
// hardware row numbering (1 = bottom, 8 = top -- see midi-io.js's
// "Orientation" comment) via hardwareRow = 9 - docRow; column 0/9 button
// addresses use the SAME row*10+col scheme as the grid and the Latch/
// Momentary button (CC10 in midi-io.js): doc row 7 (hardware row 2), col 0 ->
// CC/NOTE 20 for REC. Column 9's addresses (doc rows 1-8 -> hardware rows
// 8..1) are 89,79,69,59,49,39,29,19 -- these ARE
// LAUNCHPAD_RIGHT_CONTROL_COLUMN_NOTES in midi-io.js, previously only a
// "known edge artifact" to blank on repaint/connect; they're given real
// meaning here (see clearColumn9ActionLights()/syncLooperControlLights()
// below for how the full-artifact-wipe and this new meaning coexist). Row
// 9's cols 7-8 reuse the same controller-number-is-column-number addressing
// as cols 1-6 (LAUNCHPAD_NOTE_TYPE_CONTROL_MAP above).
const LAUNCHPAD_CONTROL_BUTTON_REC_CC = 20;

const LAUNCHPAD_COLUMN9_CONTROL_MAP = Object.freeze({
	89: Object.freeze({ selector: '#btnNewSection', kind: 'action' }),
	79: Object.freeze({ selector: '#btnInsertBeat', kind: 'action' }),
	69: Object.freeze({ selector: '#btnFirstSection', kind: 'action' }),
	59: Object.freeze({ selector: '#btnPrevSection', kind: 'action' }),
	49: Object.freeze({ selector: '#btnNextSection', kind: 'action' }),
	39: Object.freeze({ selector: '#btnLastSection', kind: 'action' }),
	29: Object.freeze({ selector: '#btnLoopBeats', kind: 'loop' }),
	19: Object.freeze({ selector: '#btnLoopSections', kind: 'loop' })
});
// Derived, single-source-of-truth lists so clearColumn9ActionLights()/
// syncLooperControlLights() never have to be kept in sync by hand with the
// map above.
const LAUNCHPAD_COLUMN9_ACTION_CCS = Object.freeze(
	Object.entries(LAUNCHPAD_COLUMN9_CONTROL_MAP)
		.filter(([, entry]) => entry.kind === 'action')
		.map(([cc]) => Number(cc))
);
const LAUNCHPAD_COLUMN9_LOOP_ENTRIES = Object.freeze(
	Object.entries(LAUNCHPAD_COLUMN9_CONTROL_MAP)
		.filter(([, entry]) => entry.kind === 'loop')
		.map(([cc, entry]) => Object.freeze({ cc: Number(cc), selector: entry.selector }))
);

// Raw velocities given directly by 143-it4-round-4-design.md for column 9's
// press/release feedback (not part of LAUNCHPAD_MAJOR_COLOR_VELOCITIES'
// named 12-color wheel -- the doc calls these "magenta"/"green" but specifies
// the exact decimal values to use, so they're used verbatim rather than
// reusing MAGENTA=45/GREEN=25 from midiColorMaps.js).
const LAUNCHPAD_VELOCITY_COLUMN9_PRESSED = 7; // magenta: press flash (rows 1-6); also the Looper "on" color (rows 7-8).
const LAUNCHPAD_VELOCITY_COLUMN9_LATCHED = 21; // green: rows 1-6 only, latches after release until the next column-9 press.

// Row 9, cols 7-8 (Prev/Next Beat): same addressing as
// LAUNCHPAD_NOTE_TYPE_CONTROL_MAP (controller number == column number), but
// non-latching -- flash LAUNCHPAD_VELOCITY_COLUMN9_PRESSED on press, clear on
// release. Kept separate from LAUNCHPAD_NOTE_TYPE_CONTROL_MAP since these
// aren't part of the rbHighlight radio group.
const LAUNCHPAD_ROW9_BEAT_NAV_CONTROL_MAP = Object.freeze({
	7: Object.freeze({ selector: '#btnPrevBeat' }),
	8: Object.freeze({ selector: '#btnNextBeat' })
});

// Column 0, doc row 3 (Clear-mode toggle): confirmed via a real Launchpad
// Pro MK1 activity log -- [B0 1E 7F]/[B0 1E 00] on press/release, same
// row*10+col-style address as CC10 (Latch/Momentary, row 1) and CC20 (REC,
// row 2) for this column. Latches to whether '#idPaletteModeClear' is the
// currently selected rbPaletteMode radio (see PalettePresentation.getMode()
// in presentation.js), lighting yellow-amber when selected. Pressing the
// button toggles: unlit (not Clear) -> selects Clear (lights up); lit
// (Clear) -> selects Paint (turns off). See handleIncomingMidiMessage()'s
// branch below for the exact toggle logic.
const LAUNCHPAD_CONTROL_BUTTON_CLEAR_MODE_CC = 30;
const LAUNCHPAD_VELOCITY_CLEAR_MODE_SELECTED = LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW_AMBER;

// Iteration 5, Round 1 (143-it5-design.md "CC_AllClear"): column 0, doc row 8
// (bottom of the left control column) -- confirmed via a real Launchpad Pro
// activity log ([B0 50 7F]/[B0 50 00], 0x50=80=row8*10+col0, same address
// scheme as CC10/CC20/CC30 for this column). Unlike those three, this button
// is NOT a toggle/latched UI mirror -- it's a fire-once panic action: press
// sends a single CC 123 127 ("All Notes Off", per the VoiceLive 3's own
// documented single-message behavior) to the DOWNSTREAM forward output/
// channel, clearing every currently-sounding note on that device regardless
// of what this app's own NOTE ON bookkeeping thinks is still held. Release
// is ignored. No light-feedback is specified by the design doc for this
// button, so none is sent.
const LAUNCHPAD_CONTROL_BUTTON_ALL_CLEAR_CC = 80;
const MIDI_CC_ALL_NOTES_OFF = 123;

// Iteration 5, Round 2 (143-it5-design.md): the All Clear button stays lit
// YELLOW_GREEN whenever it's not currently held (both at initial device
// connect and immediately after every release), and flashes MAGENTA for as
// long as it's actually held down -- purely visual feedback, independent of
// the CC 123 127 action itself (see handleIncomingMidiMessage()'s branch
// below and sendAllNotesOffToForwardDevice()).
const LAUNCHPAD_VELOCITY_ALL_CLEAR_IDLE = LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW_GREEN;
const LAUNCHPAD_VELOCITY_ALL_CLEAR_PRESSED = LAUNCHPAD_MAJOR_COLOR_VELOCITIES.MAGENTA;


export class MidiTabBuilder {
	static div_MidiTab = null;
	static eventNamespace = '.midiTabBuilder';
	static pageStart = null;

	static midiAccess = null;
	static inputs = [];
	static outputs = [];
	static detachCurrentInputListener = null;
	static brightTimeoutId = null;

	// Tracks what the device is currently believed to be showing: a
	// Map<outNote, velocity> for the last-painted table, so both the
	// Section-change full-repaint and the per-click targeted update can tell
	// what actually changed instead of blindly re-sending everything.
	static lastPaintPlan = null;
	static lastPaintTableID = '';

	// Downstream forwarding (Iteration 4, 143-it4-design.md): tracks a parallel
	// Map<midinum, velocity> of true MIDI pitches currently believed to be
	// sounding on the forward output, so add/remove can be diffed independent
	// of the Launchpad-light encoding (which varies by device.mode/colorMap).
	static lastPitchPlan = null;

	// A physical NOTE ON's velocity, captured just before the resulting
	// colorNote() call (see handleIncomingMidiMessage()) so the SYNCHRONOUS
	// 'Note:colored' handler that follows can forward the real press velocity
	// instead of a default. Keyed by midinum since that's the forwarding unit.
	static pendingForwardVelocityByMidinum = new Map();

	// Iteration 5, Round 1 (143-it5-design.md "Mouse Clicks silent"): true only
	// while handleIncomingMidiMessage() is synchronously inside its own
	// colorNote(cell) call for a REAL physical Launchpad NOTE ON/OFF -- the
	// SAME 'Note:colored' event also fires for plain mouse clicks on a td.note
	// (NoteTableController.js's own click handler calls colorNote() directly,
	// with no way to distinguish origin from the event payload alone). Only
	// device-originated note events may reach the downstream sound device;
	// mouse-driven chart editing must stay silent to the VoiceLive. Checked
	// (and only ever true) inside onNoteColored()'s synchronous handling of
	// that same colorNote() call, then reset to false right after.
	static deviceOriginatedColorEvent = false;

	static getDevice() {
		return getSong().midiDevice || {};
	}

	static addToDest(divDestSelector) {
		if (!MidiTabBuilder.div_MidiTab) {
			const template = document.getElementById('midi-template');
			const clone = template.content.cloneNode(true);
			MidiTabBuilder.div_MidiTab = clone.querySelector('#MidiTab');
			$(divDestSelector).empty().append(MidiTabBuilder.div_MidiTab);
			MidiTabBuilder.pageStart = performance.now();
			MidiTabBuilder.populateChannelSelects();
			MidiTabBuilder.bindEvents();
			MidiTabBuilder.initMidiAccess();
		}
		return MidiTabBuilder.div_MidiTab;
	}

	static renderFromSong(song = getSong()) {
		MidiTabBuilder.populateInstrumentPicker(song);
		MidiTabBuilder.syncControlsFromDevice(song);
	}

	static syncControlsFromDevice(song = getSong()) {
		const device = song.midiDevice || {};
		const selInstrument = document.getElementById('selMidiRouteInstrument');
		if (selInstrument && device.tableID
			&& Array.from(selInstrument.options).some((option) => option.value === device.tableID)) {
			selInstrument.value = device.tableID;
		}
		const selChannel = document.getElementById('selMidiRouteChannel');
		if (selChannel) {
			selChannel.value = String(device.channel || 0);
		}
		const selMode = document.getElementById('selMidiDeviceMode');
		if (selMode) {
			selMode.value = device.mode || 'Programmer';
		}
		const selColorMap = document.getElementById('selMidiDeviceColorMap');
		if (selColorMap) {
			selColorMap.value = device.colorMap || 'LaunchpadCycleOfColors';
		}
		const selOrientation = document.getElementById('selMidiDeviceOrientation');
		if (selOrientation) {
			selOrientation.value = device.orientation || 'normal';
		}
		const selForwardChannel = document.getElementById('selMidiForwardChannel');
		if (selForwardChannel) {
			selForwardChannel.value = String(device.forwardChannel ?? 1);
		}
		MidiTabBuilder.applyRoutingButtonUi();
		MidiTabBuilder.applyTriggerModeButtonUi();
	}

	static populateChannelSelects() {
		function fillOneToSixteen(selectEl) {
			for (let channel = 0; channel < 16; channel++) {
				const option = document.createElement('option');
				option.value = String(channel);
				option.textContent = String(channel + 1);
				selectEl.appendChild(option);
			}
		}
		fillOneToSixteen(document.getElementById('selMidiTestNoteOffChannel'));
		fillOneToSixteen(document.getElementById('selMidiTestNoteOnChannel'));
		fillOneToSixteen(document.getElementById('selMidiTestNoteOnZeroChannel'));
		fillOneToSixteen(document.getElementById('selMidiTestCCChannel'));
		fillOneToSixteen(document.getElementById('selMidiRouteChannel'));
		fillOneToSixteen(document.getElementById('selMidiForwardChannel'));
	}

	static populateInstrumentPicker(song = getSong()) {
		const sel = document.getElementById('selMidiRouteInstrument');
		if (!sel || !song) {
			return;
		}
		const previousValue = sel.value;
		sel.innerHTML = '';
		const noneOption = document.createElement('option');
		noneOption.value = '';
		noneOption.textContent = 'none';
		sel.appendChild(noneOption);

		getSongTuningsInLayoutOrder(song).forEach((tuning) => {
			if (!tuning || !tuning.baseID) {
				return;
			}
			const tableID = tableIDForBaseID(tuning.baseID);
			if (classifyInstrumentRole(tableID, song.wirings) !== WIRING_MAIN) {
				return;
			}
			const option = document.createElement('option');
			option.value = tableID;
			option.textContent = tuning.caption || tuning.baseID;
			sel.appendChild(option);
		});

		if (previousValue && Array.from(sel.options).some((option) => option.value === previousValue)) {
			sel.value = previousValue;
		}
	}

	static logActivity(direction, bytes, deviceName = '') {
		const el = document.getElementById('divMidiActivityLog');
		if (!el) {
			return;
		}
		const elapsedSeconds = ((performance.now() - MidiTabBuilder.pageStart) / 1000).toFixed(3);
		const paddedDirection = direction.padEnd(7, ' ');
		let line = `${elapsedSeconds} ${paddedDirection} [${formatMidiBytesHex(bytes)}] ${deviceName}`;
		if (bytes.length > 1 && (bytes[0] & 0xf0) === 0x90) {
			line += ` pitch:${bytes[1]}`;
		}
		el.textContent += line + '\n';
		el.scrollTop = el.scrollHeight;
	}

	// For lines that aren't a single MIDI message (e.g. the grid-clear summary,
	// which is really 64 separate messages) -- avoids flooding the small log
	// panel with one line per grid note.
	static logActivityText(text) {
		const el = document.getElementById('divMidiActivityLog');
		if (!el) {
			return;
		}
		const elapsedSeconds = ((performance.now() - MidiTabBuilder.pageStart) / 1000).toFixed(3);
		el.textContent += `${elapsedSeconds} ${text}\n`;
		el.scrollTop = el.scrollHeight;
	}

	static showNoteOnIndicator(parsed, deviceName) {
		const el = document.getElementById('spanMidiNoteInIndicator');
		if (!el) {
			return;
		}
		el.textContent =
			`NOTE ON  ch:${parsed.channel + 1}  note:${parsed.note}  velocity:${parsed.velocity}  (${deviceName})`;
		el.classList.add('bright');
		if (MidiTabBuilder.brightTimeoutId) {
			clearTimeout(MidiTabBuilder.brightTimeoutId);
		}
		MidiTabBuilder.brightTimeoutId = setTimeout(() => {
			el.classList.remove('bright');
		}, 200);
	}

	static attachToInput(input) {
		if (MidiTabBuilder.detachCurrentInputListener) {
			MidiTabBuilder.detachCurrentInputListener();
			MidiTabBuilder.detachCurrentInputListener = null;
		}
		if (!input) {
			return;
		}
		MidiTabBuilder.detachCurrentInputListener = attachInputListener(input, (parsed, event) => {
			// Iteration 5, Round 3 (143-it5-design.md "Ignore Aftertouch"): the
			// VoiceLive doesn't respond to Channel Aftertouch at all, so a checked
			// #chkMidiFilterAftertouch also skips LOGGING these (keeps the log free
			// of noise the User can't do anything about). Processing below already
			// harmlessly no-ops for this type regardless of the checkbox (it isn't
			// noteon/noteoff/controlchange), so only the log call is gated here --
			// unchecked still logs it, unchanged from before this checkbox existed.
			const filterAftertouch = document.getElementById('chkMidiFilterAftertouch');
			if (!(parsed.type === 'aftertouch' && filterAftertouch && filterAftertouch.checked)) {
				MidiTabBuilder.logActivity('receive', event.data, input.name);
			}
			MidiTabBuilder.handleIncomingMidiMessage(parsed, input.name);
		});
	}

	// td.note click calls colorNote() from infinite-neck.js::installTDNoteClick();
	// this does the same thing for a routed device NOTE ON/OFF. Aftertouch and
	// other non-note channel messages (parsed.type === 'other', e.g. a
	// Launchpad's Global Aftertouch on status 0xD0) are always ignored -- we
	// never forward those downstream, per 143-it4-design.md.
	// device.mode selects the input algorithm: 'Programmer' decodes the
	// Launchpad's row*10+col grid encoding; 'Note' treats the incoming note
	// number as a real MIDI pitch and matches it directly against the
	// Instrument's own midinum attributes (whatever device sent it).
	// device.triggerMode selects how button-up (NOTE OFF) is handled:
	//   - 'Latch' (default): button-up means nothing; a note only toggles on
	//     the next button-down (matches the long-standing td.note click model).
	//   - 'Momentary': button-up ALSO calls colorNote() again, so it behaves
	//     like a synth key -- down adds the note, up removes it.
	// The CURRENT triggerMode is checked at release time, not whatever mode was
	// in effect when the button went down: switching Latch->Momentary while a
	// button is held means its eventual release now fires one extra toggle-off
	// (making it behave like Momentary from that point on); switching
	// Momentary->Latch while held just means the eventual release is ignored
	// (making it behave like Latch from that point on). No extra per-press
	// state tracking is needed for either transition to work correctly.
	static handleIncomingMidiMessage(parsed, deviceName) {
		if (parsed.type === 'controlchange' && parsed.controller === LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC) {
			// Bottom-left control-column button (CC 10 -- see
			// LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC in midi-io.js for the
			// real-device research behind this): press ([B0 0A 7F]) toggles
			// Latch<->Momentary; release ([B0 0A 00], ccValue 0) is ignored --
			// this button behaves like a toggle switch, not a momentary key.
			// This fires regardless of device.enabled/tableID -- it's a
			// device-level control, not tied to Instrument routing. The
			// physical LED is kept in sync by toggleTriggerMode() ->
			// applyTriggerModeButtonUi() -> syncTriggerModeIndicatorLight(),
			// the same path a click on either on-screen trigger-mode button
			// takes.
			if (parsed.ccValue > 0) {
				MidiTabBuilder.toggleTriggerMode();
			}
			return;
		}
		if (parsed.type === 'controlchange' && LAUNCHPAD_NOTE_TYPE_CONTROL_MAP[parsed.controller]) {
			// Top-control-row NoteType button (see LAUNCHPAD_NOTE_TYPE_CONTROL_MAP
			// above) -- fires regardless of device.enabled/tableID, same as the
			// CC10 trigger-mode button, since it's a Palette-wide UI control, not
			// tied to Instrument routing. paletteUtils.check() simulates a real
			// click (including any of PalettePresentation's own bookkeeping), which
			// naturally fires 'change' on input[name="rbHighlight"] when the
			// selection actually changes -- picked up by the DOM listener bound in
			// bindEvents() below, which calls syncNoteTypeControlLights() to update
			// every button in the row (not just the one pressed).
			if (parsed.ccValue > 0) {
				paletteUtils.check(LAUNCHPAD_NOTE_TYPE_CONTROL_MAP[parsed.controller].radioSelector);
			}
			return;
		}
		if (parsed.type === 'controlchange' && parsed.controller === LAUNCHPAD_CONTROL_BUTTON_REC_CC) {
			// Column 0, doc row 7 (REC -- 143-it4-round-4-design.md): press simulates
			// a real click on the on-screen REC button (toggles recording via the
			// existing '.RecordButton' click handler in infinite-neck.js); release is
			// ignored, same toggle-switch behavior as CC10. The LED is kept in sync
			// by syncRecordButtonLight() (bound to '.RecordButton' click below).
			if (parsed.ccValue > 0) {
				$('.RecordButton').trigger('click');
			}
			return;
		}
		if (parsed.type === 'controlchange' && parsed.controller === LAUNCHPAD_CONTROL_BUTTON_CLEAR_MODE_CC) {
			// Column 0, doc row 3 (Clear-mode toggle -- see
			// LAUNCHPAD_CONTROL_BUTTON_CLEAR_MODE_CC above): press toggles between
			// Clear and Paint, via the SAME paletteUtils.check() real-click
			// simulation used for the NoteType row above:
			//   - unlit (Clear NOT currently selected) -> '#idPaletteModeClear'
			//     (lights up).
			//   - lit (Clear currently selected) -> '#idPaletteModePaint' (turns
			//     off).
			// Either selection naturally goes through PalettePresentation's
			// enterClearMode()/enterPaintMode() -> updatePaletteModeUi(), whose
			// 'Palette:modeChanged' EventBus trigger (see presentation.js) is what
			// actually updates the light (via syncClearModeControlLight(), bound
			// below). Release is always a no-op.
			if (parsed.ccValue > 0) {
				const targetSelector = PalettePresentation.getMode() === 'clear' ? '#idPaletteModePaint' : '#idPaletteModeClear';
				paletteUtils.check(targetSelector);
			}
			return;
		}
		if (parsed.type === 'controlchange' && parsed.controller === LAUNCHPAD_CONTROL_BUTTON_ALL_CLEAR_CC) {
			// Column 0, doc row 8 (All Clear -- 143-it5-design.md): fire-once panic
			// action, unconditional of device.enabled/tableID same as the other
			// column-0 control buttons. See sendAllNotesOffToForwardDevice()'s doc
			// comment for why this targets the forward (downstream sound device)
			// output, not the Launchpad's own light-feedback output.
			// Round 2: the action itself only fires on press, but the button's OWN
			// light (LAUNCHPAD_CONTROL_BUTTON_ALL_CLEAR_CC, a Launchpad-light address,
			// same CC-in/Note-out asymmetry as every other column-0 control button)
			// flashes MAGENTA while held and returns to its normal YELLOW_GREEN idle
			// state on release.
			if (parsed.ccValue > 0) {
				MidiTabBuilder.sendAllNotesOffToForwardDevice();
				MidiTabBuilder.setControlLight(LAUNCHPAD_CONTROL_BUTTON_ALL_CLEAR_CC, LAUNCHPAD_VELOCITY_ALL_CLEAR_PRESSED);
			} else {
				MidiTabBuilder.setControlLight(LAUNCHPAD_CONTROL_BUTTON_ALL_CLEAR_CC, LAUNCHPAD_VELOCITY_ALL_CLEAR_IDLE);
			}
			return;
		}
		if (parsed.type === 'controlchange' && LAUNCHPAD_ROW9_BEAT_NAV_CONTROL_MAP[parsed.controller]) {
			// Row 9 (top control row), cols 7-8 (Prev/Next Beat --
			// 143-it4-round-4-design.md): same controller-number-is-column-number
			// addressing as cols 1-6, but non-latching -- press triggers the action
			// AND flashes magenta; release just clears the flash (no on-screen
			// state to mirror, unlike the Looper buttons below).
			const cc = Number(parsed.controller);
			if (parsed.ccValue > 0) {
				$(LAUNCHPAD_ROW9_BEAT_NAV_CONTROL_MAP[cc].selector).trigger('click');
			}
			MidiTabBuilder.setControlLight(cc, parsed.ccValue > 0 ? LAUNCHPAD_VELOCITY_COLUMN9_PRESSED : 0);
			return;
		}
		if (parsed.type === 'controlchange' && LAUNCHPAD_COLUMN9_CONTROL_MAP[parsed.controller]) {
			// Column 9 (right control column -- 143-it4-round-4-design.md): rows 1-6
			// are Section/Beat navigation actions, rows 7-8 are the Looper toggles.
			// See clearColumn9ActionLights()/syncLooperControlLights() for the full
			// lighting-feedback rules (press flash/release latch for rows 1-6, mirror
			// the Looper UI's own color for rows 7-8, mutual blanking between them).
			const cc = Number(parsed.controller);
			const entry = LAUNCHPAD_COLUMN9_CONTROL_MAP[cc];
			if (entry.kind === 'action') {
				if (parsed.ccValue > 0) {
					$(entry.selector).trigger('click');
					MidiTabBuilder.clearColumn9ActionLights(cc);
					MidiTabBuilder.setControlLight(cc, LAUNCHPAD_VELOCITY_COLUMN9_PRESSED);
				} else {
					MidiTabBuilder.setControlLight(cc, LAUNCHPAD_VELOCITY_COLUMN9_LATCHED);
				}
			} else if (parsed.ccValue > 0) {
				$(entry.selector).trigger('click');
				MidiTabBuilder.clearColumn9ActionLights();
				MidiTabBuilder.syncLooperControlLights();
			}
			return;
		}
		if (parsed.type === 'noteon') {
			MidiTabBuilder.showNoteOnIndicator(parsed, deviceName);
		}
		const device = MidiTabBuilder.getDevice();
		const isNoteOn = parsed.type === 'noteon';
		const isNoteOff = parsed.type === 'noteoff';
		if (!device.enabled || !device.tableID || (!isNoteOn && !isNoteOff)) {
			return;
		}
		if (isNoteOff && device.triggerMode !== 'Momentary') {
			return;
		}
		let cell;
		if (device.mode === 'Note') {
			cell = showMidiNotesInTable(device.tableID, parsed.note);
		} else {
			const grid = parseLaunchpadProgrammerGridNote(parsed.note);
			if (!grid) {
				return;
			}
			const { cellrow, cellcol } = launchpadGridToCell(grid.row, grid.col, { orientation: device.orientation });
			cell = findNoteCell(device.tableID, cellrow, cellcol);
		}
		if (!cell || cell.length === 0) {
			return;
		}
		// Only a physical button-DOWN carries a meaningful press velocity to
		// forward downstream (button-up always forwards NOTE OFF at velocity 0,
		// per 143-it4-design.md) -- stash it so the synchronous 'Note:colored'
		// handler triggered by colorNote() below can pick it up.
		const midinum = Number(cell.attr('midinum'));
		if (isNoteOn && Number.isInteger(midinum)) {
			MidiTabBuilder.pendingForwardVelocityByMidinum.set(midinum, parsed.velocity);
		}
		// Marks this colorNote() call as device-originated (see
		// deviceOriginatedColorEvent's doc comment) -- read synchronously by
		// onNoteColored() below, then always reset so a later mouse click isn't
		// mistaken for a physical press.
		MidiTabBuilder.deviceOriginatedColorEvent = true;
		colorNote(cell);
		MidiTabBuilder.deviceOriginatedColorEvent = false;
		if (isNoteOn && Number.isInteger(midinum)) {
			MidiTabBuilder.pendingForwardVelocityByMidinum.delete(midinum);
		}
	}

	static currentOutputPort() {
		const sel = document.getElementById('selMidiOutDevice');
		if (!sel) {
			return null;
		}
		return MidiTabBuilder.outputs[Number(sel.value)] || null;
	}

	// Iteration 5, Round 1 (143-it5-design.md "Debug output versus wired
	// output"): the manual test-send grid (Note On/Off/CC buttons) has its OWN
	// output-port select (#selMidiDebugOutDevice), completely separate from
	// #selMidiOutDevice (the Launchpad's own light-feedback wiring output) --
	// previously both purposes shared one select, so switching it to send a
	// debug message elsewhere would also (silently) break the Launchpad-light
	// wiring until switched back.
	static currentDebugOutputPort() {
		const sel = document.getElementById('selMidiDebugOutDevice');
		if (!sel) {
			return null;
		}
		return MidiTabBuilder.outputs[Number(sel.value)] || null;
	}

	// The downstream sound device (e.g. VoiceLive 3) is a separate physical
	// output port from the Launchpad's own light-feedback output.
	static currentForwardOutputPort() {
		const sel = document.getElementById('selMidiForwardDevice');
		if (!sel) {
			return null;
		}
		return MidiTabBuilder.outputs[Number(sel.value)] || null;
	}

	// Fires once per visible table every time replay()/replayTable() runs
	// (Section navigation, and every Looper beat tick during playback -- see
	// NoteTableController.js replayTable()/infinite-neck.js emitSectionStatusBeatUpdate()).
	// Filtering by ownerID lets this react only to the routed Instrument, with
	// no need to touch NoteTableController.js itself.
	static onSectionStatusChanged(event, data) {
		const device = MidiTabBuilder.getDevice();
		if (!device.enabled || !data || data.ownerID !== device.tableID) {
			return;
		}
		MidiTabBuilder.clearAndRepaintDevice();
	}

	// td.note click (or anything else that calls colorNote()) fires this;
	// react with a targeted diff so composing on the neck doesn't flash the
	// whole grid -- only the note(s) that actually changed get a message.
	// Also drives downstream pitch forwarding (Iteration 4): the ONLY place
	// forwarding happens, since real add/remove clicks/presses are the only
	// events meant to reach the downstream sound device (see
	// forwardPitchChanges()'s doc comment for why Section navigation must not).
	static onNoteColored(event, data) {
		const device = MidiTabBuilder.getDevice();
		if (!device.enabled || !device.tableID || !data || data.sourceTableID !== device.tableID) {
			return;
		}
		// Real-time click: DOM Highlight classes are trustworthy (see
		// buildDevicePaintPlan()'s doc comment).
		const { lightPlan, pitchPlan } = MidiTabBuilder.buildDevicePaintPlan(device.tableID, { includeDomHighlights: true });
		const haveBaseline = !!MidiTabBuilder.lastPaintPlan && device.tableID === MidiTabBuilder.lastPaintTableID;

		// Iteration 5, Round 2 (143-it5-design.md "latency is killing us... the
		// forward is what creates the sound in real-time, so it must be
		// critical-path"): forward FIRST, before anything else below -- in
		// particular, before the Launchpad's own light feedback, which on a hard
		// repaint sends a full 64-note clear + edge-artifact wipe + resend
		// (~70+ MIDI messages) to a SEPARATE physical port, easily dwarfing the
		// one or two forward messages a single button press needs. Plain
		// synchronous reordering (not an actual async deferral) is enough here:
		// this already guarantees every forward output.send() call for this
		// event is issued before any light output.send() call for the same
		// event, with no risk of the diffRepaint-vs-lastPaintPlan correctness
		// hazard an async (setTimeout/Promise) deferral of the light repaint
		// would introduce (diffRepaint() reads the live lastPaintPlan at call
		// time, so deferring it while lastPaintPlan is updated in the meantime
		// would silently turn every diff into a no-op).
		//
		// On the very first sync for this table (no baseline yet -- e.g. routing
		// was just enabled or re-targeted), only ADOPT the pitchPlan; don't
		// forward it, so pre-existing notes never retrigger the synth just
		// because MIDI routing started watching this table.
		//
		// "Mouse Clicks silent" (Round 1): also gated on deviceOriginatedColorEvent
		// -- a plain mouse click on a td.note fires this SAME 'Note:colored' event,
		// but must never reach the downstream sound device, only a real physical
		// Launchpad NOTE ON/OFF may.
		if (haveBaseline && MidiTabBuilder.deviceOriginatedColorEvent) {
			MidiTabBuilder.forwardPitchChanges(MidiTabBuilder.lastPitchPlan || new Map(), pitchPlan);
		}

		const lightOutput = MidiTabBuilder.currentOutputPort();
		if (lightOutput) {
			const channel = device.channel || 0;
			if (haveBaseline) {
				MidiTabBuilder.diffRepaint(lightOutput, channel, lightPlan);
			} else {
				MidiTabBuilder.hardRepaint(lightOutput, channel, lightPlan);
			}
		}

		MidiTabBuilder.lastPaintPlan = lightPlan;
		MidiTabBuilder.lastPaintTableID = device.tableID;
		MidiTabBuilder.lastPitchPlan = pitchPlan;
	}

	// Wipes the device's lights, then repaints whatever notes are currently on
	// for the routed Instrument in the current Section -- prevents lit buttons
	// from a previous Section (or a since-removed note) from piling up. Skips
	// the light repaint entirely when the freshly computed plan is identical to
	// what's already lit, so redundant back-to-back statusChanged firings for
	// the same Section don't visibly re-flash the device.
	//
	// NEVER forwards to the downstream sound device (per 143-it4-design.md --
	// only real add/remove clicks/presses do, see onNoteColored()): the
	// downstream device should behave as if hard-wired to the upstream
	// controller, and Section navigation is not a controller event. The fresh
	// pitchPlan is still silently adopted as the new baseline, so the NEXT
	// click's diff is computed against what's actually showing in this
	// Section/table, not stale state left over from a previous one.
	static clearAndRepaintDevice() {
		const device = MidiTabBuilder.getDevice();
		if (!device.enabled || !device.tableID) {
			return;
		}
		// Section-navigation/beat-tick: DOM Highlight classes may still reflect
		// the previous beat (see buildDevicePaintPlan()'s doc comment), so only
		// the model-driven recordedNotes[beat] highlights are trusted here.
		const { lightPlan, pitchPlan } = MidiTabBuilder.buildDevicePaintPlan(device.tableID, { includeDomHighlights: false });
		const tableChanged = device.tableID !== MidiTabBuilder.lastPaintTableID;
		const output = MidiTabBuilder.currentOutputPort();
		if (output) {
			const unchanged = !tableChanged && !!MidiTabBuilder.lastPaintPlan
				&& MidiTabBuilder.plansAreEqual(lightPlan, MidiTabBuilder.lastPaintPlan);
			if (!unchanged) {
				MidiTabBuilder.hardRepaint(output, device.channel || 0, lightPlan);
			}
		}
		MidiTabBuilder.lastPaintPlan = lightPlan;
		MidiTabBuilder.lastPaintTableID = device.tableID;
		MidiTabBuilder.lastPitchPlan = pitchPlan;
	}

	// Resolves note-name-scoped notes into the lookup context colorNote() and
	// replayTable() both use, so a role-key colorClass like "noteRoot" or
	// "noteScale" (the primary color-picker's radio value= is the ROLE key, not
	// the resolved CSS class -- see colorFunctions.js buildOneRadio()) resolves
	// to the actual painted color before we compute a Launchpad velocity for
	// it. Without this, most notes colored via the main palette buttons (as
	// opposed to the "More..." raw-swatch picker) would resolve to nothing and
	// fall back to plain red.
	static buildLookupContext(section, tableID) {
		const noteRootResult = section && typeof section.getNoteRoot === 'function'
			? section.getNoteRoot(tableID) || null
			: null;
		return createLookupContext({
			section,
			tableID,
			tablename: tableID,
			noteRootTablename: noteRootResult?.tablename || ''
		});
	}

	// Builds this table's current paint state as TWO parallel maps:
	//   - lightPlan: Map<outNote, velocity> for the Launchpad's own lights,
	//     encoded per device.mode/colorMap/orientation (as before).
	//   - pitchPlan: Map<midinum, velocity> of true MIDI pitches, ALWAYS the
	//     real note number regardless of device.mode -- per 143-it4-design.md,
	//     downstream forwarding must be true MIDI "regardless of
	//     ProgrammerMode/NoteMode". velocity here is whatever a physical press
	//     caused (see pendingForwardVelocityByMidinum), defaulting to 127 for a
	//     plain UI click.
	// Covers THREE data sources (see NoteTableController.js replayTable() and
	// showHighlightsForBeatForOptions()):
	//   - namedNotes: the chart's main note-name coloring (what colorNote()
	//     writes to in the default 'Named' highlight mode -- setNamedNote()).
	//     A single named note colors EVERY cell sharing that note name across
	//     the tuning, so every matching cell is included.
	//   - playedNotes: the Tiny/Single/Fingering/Bend overlay styles, addressed
	//     by an exact midinum+row (a single cell) -- the LIVE (not currently
	//     recording) performance overlay.
	//   - recordedNotes[currentBeat] (143-it4-design-2.md "Recorded Notes"):
	//     the SAME styles, but captured for Looper playback -- see the doc
	//     comment just above the recordedNotes read below for why this is read
	//     from the model rather than the DOM classes showHighlightsForBeat()
	//     paints with (a same-tick ordering hazard).
	// options.includeDomHighlights controls a FOURTH source, live (not
	// necessarily recorded) Highlight overlay toggles -- see its own doc
	// comment below; only trusted from a real-time click (onNoteColored()).
	static buildDevicePaintPlan(tableID, options = {}) {
		const includeDomHighlights = options.includeDomHighlights !== false;
		const device = MidiTabBuilder.getDevice();
		const section = getCurrentSection();
		const sectionNotes = section && typeof section.getSectionNotes === 'function'
			? section.getSectionNotes(tableID)
			: null;
		const lightPlan = new Map();
		const pitchPlan = new Map();
		if (!sectionNotes) {
			return { lightPlan, pitchPlan };
		}
		const lookupContext = MidiTabBuilder.buildLookupContext(section, tableID);

		const addForCell = (cell, note) => {
			const cellrow = Number(cell.attr('cellrow'));
			const cellcol = Number(cell.attr('cellcol'));
			const midinum = Number(cell.attr('midinum'));
			if (!Number.isInteger(cellrow) || !Number.isInteger(cellcol)) {
				return;
			}
			const outNote = device.mode === 'Note'
				? midinum
				: cellToLaunchpadGridNote(cellrow, cellcol, { orientation: device.orientation });
			const resolvedColorClass = lookupUserColorClass(note, lookupContext);
			const velocity = resolveLaunchpadVelocityForColorClass(device.colorMap, resolvedColorClass);
			lightPlan.set(outNote, velocity);
			if (Number.isInteger(midinum)) {
				const forwardVelocity = MidiTabBuilder.pendingForwardVelocityByMidinum.get(midinum) ?? 127;
				pitchPlan.set(midinum, forwardVelocity);
			}
		};

		const namedNotes = sectionNotes.namedNotes || {};
		Object.keys(namedNotes).forEach((noteName) => {
			const note = namedNotes[noteName];
			if (!note) {
				return;
			}
			$(`table[id='${tableID}'] td.note.note${noteName}`).each(function () {
				addForCell($(this), note);
			});
		});

		(sectionNotes.playedNotes || []).forEach((note) => {
			const cell = showMidiNotesInTable(tableID, note.midinum, note.row);
			if (!cell || cell.length === 0) {
				return;
			}
			addForCell(cell, note);
		});

		// Recorded Notes (143-it4-design-2.md): read straight from the model
		// (sectionNotes.recordedNotes[currentBeat]) rather than the DOM
		// classes/divs NoteTableController.js's showHighlightsForBeatForOptions()
		// paints -- this plan is built from the SAME
		// 'Widget:SectionStatus:statusChanged' firing that FIRES BEFORE
		// showHighlightsForBeat() runs (see infinite-neck.js's showBeats():
		// emitSectionStatusBeatUpdate() then showHighlightsForBeat()), so
		// reading the DOM here would still show the PREVIOUS beat's classes.
		// Reading the model directly sidesteps that ordering hazard entirely,
		// and also naturally "blanks on the next beat": a note only in the
		// previous beat's array simply isn't in this beat's lightPlan, and
		// clearAndRepaintDevice()'s existing full hardRepaint-on-change already
		// clears anything not in the fresh plan.
		// Tiny/Single/Fingering/Bend recorded notes paint like a played note
		// (their own colorClass, via the same addForCell() above);
		// MidiPitches/MidiPitchesSingle recorded notes are Highlight overlays,
		// collected into highlightCells so they always win over a
		// played/named color underneath (applied after every base color below).
		const highlightCells = new Map(); // outNote -> velocity
		const currentBeat = getSong().getBeat();
		const recordedNotesForBeat = (sectionNotes.recordedNotes || {})[`${currentBeat}`] || [];
		recordedNotesForBeat.forEach((note) => {
			if (note.styleNum === Note.STYLENUM_MIDIPITCHES || note.styleNum === Note.STYLENUM_MIDIPITCHESSINGLE) {
				MidiTabBuilder.collectHighlightCellsForNote(tableID, device, note, highlightCells);
				return;
			}
			const cell = showMidiNotesInTable(tableID, note.midinum, note.row);
			if (!cell || cell.length === 0) {
				return;
			}
			addForCell(cell, note);
		});

		// Live, click-driven Highlight toggles that AREN'T (necessarily)
		// recorded -- colorNoteInner()'s doHighlight/doHighlightSingle branches
		// toggle these DOM classes on every click regardless of recording
		// state. DOM state is trustworthy here ONLY when this plan is being
		// built synchronously from that same click (onNoteColored(), the
		// default) -- a beat-tick/Section-navigation repaint
		// (clearAndRepaintDevice()) passes includeDomHighlights:false since the
		// DOM may still show the previous beat's classes at that point (same
		// ordering hazard as recordedNotes above, but there's no model-only
		// fallback for a highlight that isn't being recorded).
		if (includeDomHighlights) {
			$(`table[id='${tableID}'] td.note.noteHighlight`).each(function () {
				MidiTabBuilder.addHighlightCellFromDom($(this), device, Note.STYLENUM_MIDIPITCHES, highlightCells);
			});
			$(`table[id='${tableID}'] td.note.noteHighlightSingle`).each(function () {
				MidiTabBuilder.addHighlightCellFromDom($(this), device, Note.STYLENUM_MIDIPITCHESSINGLE, highlightCells);
			});
		}

		highlightCells.forEach((velocity, outNote) => {
			lightPlan.set(outNote, velocity);
		});

		return { lightPlan, pitchPlan };
	}

	static highlightVelocityForStyleNum(styleNum) {
		return styleNum === Note.STYLENUM_MIDIPITCHESSINGLE
			? LAUNCHPAD_VELOCITY_HIGHLIGHT_MULTI
			: LAUNCHPAD_VELOCITY_HIGHLIGHT_PITCH;
	}

	static outNoteForCell(device, cell) {
		const cellrow = Number(cell.attr('cellrow'));
		const cellcol = Number(cell.attr('cellcol'));
		const midinum = Number(cell.attr('midinum'));
		if (!Number.isInteger(cellrow) || !Number.isInteger(cellcol)) {
			return null;
		}
		return device.mode === 'Note'
			? midinum
			: cellToLaunchpadGridNote(cellrow, cellcol, { orientation: device.orientation });
	}

	// MidiPitches ("Highlight Pitch (MIDI)", keystroke '[') highlights EVERY
	// cell sharing this recorded note's midinum across the tuning -- mirrors
	// colorNoteInner()'s own td.note[midinum=...] selector (no cellrow filter).
	// MidiPitchesSingle ("Highlight Multi", keystroke ']') is one specific cell.
	static collectHighlightCellsForNote(tableID, device, note, highlightCells) {
		const velocity = MidiTabBuilder.highlightVelocityForStyleNum(note.styleNum);
		const selector = note.styleNum === Note.STYLENUM_MIDIPITCHES
			? `table[id='${tableID}'] td.note[midinum='${note.midinum}']`
			: `table[id='${tableID}'] td.note[midinum='${note.midinum}'][cellrow='${note.row}']`;
		$(selector).each(function () {
			const outNote = MidiTabBuilder.outNoteForCell(device, $(this));
			if (outNote !== null) {
				highlightCells.set(outNote, velocity);
			}
		});
	}

	static addHighlightCellFromDom(cell, device, styleNum, highlightCells) {
		const outNote = MidiTabBuilder.outNoteForCell(device, cell);
		if (outNote !== null) {
			highlightCells.set(outNote, MidiTabBuilder.highlightVelocityForStyleNum(styleNum));
		}
	}

	static sendNoteOnRaw(output, channel, outNote, velocity) {
		sendNoteOn(output, channel, outNote, velocity);
		MidiTabBuilder.logActivity('send', [0x90 | channel, outNote & 0x7f, velocity & 0x7f], output.name);
	}

	// Full wipe + repaint of every entry in plan -- used at Section boundaries
	// so no lights from a previous Section/table/device-config can persist.
	static hardRepaint(output, channel, plan) {
		const device = MidiTabBuilder.getDevice();
		if (device.mode !== 'Note') {
			// Iteration 5, Round 3 (143-it5-design.md "Speeding up batch lighting"):
			// #chkMidiUseSysExClear opts into a single SysEx "Light all LEDs"
			// message (sendLightAllLedsSysEx()) instead of the ~70-message NOTE-ON
			// based wipe below. Unlike clearLaunchpadGrid()/clearLaunchpadEdgeArtifacts()
			// (which only ever touch the 64 grid notes + known edge-artifact
			// addresses, leaving column-0/9 control buttons alone), the SysEx
			// message overrides EVERY LED including those control buttons -- so
			// this branch must resync every one of them afterward, which the
			// NOTE-based branch never needed to do.
			const useSysExClear = document.getElementById('chkMidiUseSysExClear')?.checked;
			if (useSysExClear) {
				sendLightAllLedsSysEx(output, 0);
				MidiTabBuilder.logActivityText(`sysex   clear all LEDs (1 message) -> velocity 0 (${output.name})`);
				MidiTabBuilder.syncTriggerModeIndicatorLight();
				MidiTabBuilder.syncNoteTypeControlLights();
				MidiTabBuilder.syncRecordButtonLight();
				MidiTabBuilder.syncClearModeControlLight();
				MidiTabBuilder.setControlLight(LAUNCHPAD_CONTROL_BUTTON_ALL_CLEAR_CC, LAUNCHPAD_VELOCITY_ALL_CLEAR_IDLE);
			} else {
				// Programmer mode's row*10+col numbering has a fixed 64-note address
				// space, so a full wipe is cheap and simple (per 143-design-3.md's
				// "simple algorithm...for now").
				clearLaunchpadGrid(output, channel);
				MidiTabBuilder.logActivityText(`clear   64 grid notes -> velocity 0 (${output.name})`);
				// Also defensively wipe the known real-hardware LED artifacts (right
				// control column + the spurious-at-connect note) -- see
				// clearLaunchpadEdgeArtifacts()'s doc comment in midi-io.js.
				clearLaunchpadEdgeArtifacts(output, channel);
			}
			// Restores column 9's Looper-toggle lights (rows 7-8) immediately
			// after the wipe above -- see LAUNCHPAD_COLUMN9_CONTROL_MAP's doc
			// comment: those addresses ARE LAUNCHPAD_RIGHT_CONTROL_COLUMN_NOTES
			// and would otherwise be left dark on every Section navigation.
			MidiTabBuilder.syncLooperControlLights();
		}
		// Note mode's note numbers are real MIDI pitches with no fixed 64-note
		// address space to sweep, so a full clear isn't implemented for it yet.
		plan.forEach((velocity, outNote) => {
			MidiTabBuilder.sendNoteOnRaw(output, channel, outNote, velocity);
		});
	}

	// Sends only what changed since lastPaintPlan: a newly-added or recolored
	// note gets NOTE ON (recolored ones get a NOTE ON 0 first, so the change
	// reads cleanly on the device); a removed/cleared note gets NOTE ON 0.
	// Unchanged notes are left alone -- no message, no flicker.
	static diffRepaint(output, channel, plan) {
		const previous = MidiTabBuilder.lastPaintPlan || new Map();
		previous.forEach((_velocity, outNote) => {
			if (!plan.has(outNote)) {
				MidiTabBuilder.sendNoteOnRaw(output, channel, outNote, 0);
			}
		});
		plan.forEach((velocity, outNote) => {
			const previousVelocity = previous.get(outNote);
			if (previousVelocity === velocity) {
				return;
			}
			if (previousVelocity !== undefined) {
				MidiTabBuilder.sendNoteOnRaw(output, channel, outNote, 0);
			}
			MidiTabBuilder.sendNoteOnRaw(output, channel, outNote, velocity);
		});
	}

	static plansAreEqual(a, b) {
		if (a.size !== b.size) {
			return false;
		}
		for (const [outNote, velocity] of a) {
			if (b.get(outNote) !== velocity) {
				return false;
			}
		}
		return true;
	}

	// Sends true MIDI NOTE ON/OFF to the downstream sound device (e.g.
	// VoiceLive 3) for whatever pitches were added/removed between
	// previousPlan and newPlan. Diffs by PITCH PRESENCE ONLY (ignores a
	// velocity-only change on an already-present pitch) -- a recolor on
	// screen must never retrigger the downstream synth, per
	// 143-it4-design.md's "we are doing nothing downstream to upset the notes
	// sent to VoiceLive 3". If the same pitch is produced by more than one
	// cell (e.g. an enharmonic duplicate elsewhere on the tuning), the pitch
	// naturally stays "present" as long as ANY contributing cell remains lit.
	//
	// Deliberately called ONLY from onNoteColored() (real add/remove
	// clicks/presses) and never from Section-navigation's
	// clearAndRepaintDevice() -- the downstream device should behave as if
	// hard-wired straight to the physical controller; infinite-neck is a
	// man-in-the-middle only for drawing pictures in the browser and lighting
	// the Launchpad, and must not inject or suppress notes based on which
	// Section happens to be displayed.
	static forwardPitchChanges(previousPlan, newPlan) {
		const device = MidiTabBuilder.getDevice();
		const output = MidiTabBuilder.currentForwardOutputPort();
		if (!output) {
			return;
		}
		const channel = device.forwardChannel ?? 1;
		previousPlan.forEach((_velocity, midinum) => {
			if (!newPlan.has(midinum)) {
				// Iteration 5, Round 1 (143-it5-design.md "Prefer NOTE ON 0 to NOTE
				// OFF"): the VoiceLive 3 was observed to behave better when told
				// "note off" via NOTE ON velocity 0 (0x9n note 00) rather than an
				// explicit NOTE OFF (0x8n) message, even though both are
				// spec-equivalent -- sendNoteOn(...,0) here instead of
				// sendNoteOff(...).
				sendNoteOn(output, channel, midinum, 0);
				MidiTabBuilder.logActivity('fwd-off', [0x90 | channel, midinum & 0x7f, 0], output.name);
			}
		});
		newPlan.forEach((velocity, midinum) => {
			if (!previousPlan.has(midinum)) {
				sendNoteOn(output, channel, midinum, velocity);
				MidiTabBuilder.logActivity('fwd-on', [0x90 | channel, midinum & 0x7f, velocity & 0x7f], output.name);
			}
		});
	}

	// Releases (NOTE OFF) any pitches we're currently holding open downstream
	// and clears the pitch-plan baseline -- used when routing is turned off or
	// re-targeted at a different Instrument, so the downstream device never
	// gets left with a stuck note just because infinite-neck stopped watching.
	static releaseForwardedPitches() {
		if (MidiTabBuilder.lastPitchPlan && MidiTabBuilder.lastPitchPlan.size > 0) {
			MidiTabBuilder.forwardPitchChanges(MidiTabBuilder.lastPitchPlan, new Map());
		}
		MidiTabBuilder.lastPitchPlan = null;
	}

	// Iteration 5, Round 1 (143-it5-design.md "CC_AllClear"): fires a single
	// CC 123 127 ("All Notes Off") to the downstream forward output/channel --
	// the VoiceLive 3's own documented single-message panic-clear. Also drops
	// our own "what's currently held downstream" bookkeeping (lastPitchPlan),
	// since the device just went silent independent of any diffing this app
	// has done -- otherwise a later diff could wrongly conclude a pitch is
	// still sounding (and skip resending it) when the device has actually gone
	// quiet. Just a test/panic action for now -- NOT wired to Section changes
	// yet (deferred, per the design doc).
	static sendAllNotesOffToForwardDevice() {
		const device = MidiTabBuilder.getDevice();
		const output = MidiTabBuilder.currentForwardOutputPort();
		if (!output) {
			return;
		}
		const channel = device.forwardChannel ?? 1;
		sendControlChange(output, channel, MIDI_CC_ALL_NOTES_OFF, 127);
		MidiTabBuilder.logActivity('fwd-cc', [0xb0 | channel, MIDI_CC_ALL_NOTES_OFF, 127], output.name);
		MidiTabBuilder.lastPitchPlan = new Map();
	}

	static applyRoutingButtonUi() {
		const enabled = MidiTabBuilder.getDevice().enabled === true;
		$('#btnMidiRouteToggle')
			.toggleClass('BtnPunchedIn', enabled)
			.toggleClass('BtnPunchedOut', !enabled)
			.text(enabled ? 'MIDI Routing On' : 'MIDI Routing');
	}

	// Targets EVERY element sharing '.classMidiTriggerMode' (the MIDI tab's own
	// #btnMidiTriggerMode plus the Quick Menu's duplicate #btnMidiTriggerModeQuick,
	// see index.html #divQuick) so both stay visually in sync with device.triggerMode
	// no matter which one triggered the change -- mirrors the existing
	// .classLoopSections/.classLoopBeats pattern used for the Loop quick-menu buttons.
	// Also toggles 'MidiTriggerModeMomentary' on <body> (same
	// $('body').toggleClass(...) pattern infinite-neck.js uses for
	// 'ShowAllNoteNames') so every SectionStatus widget's REC-dot Momentary
	// border (.RecordDotMomentaryBorder/.RecordDotMomentaryBorderVertical, see
	// section-status.css) shows/hides via a single global class, regardless of
	// how many widget instances exist or when they're created/destroyed.
	static applyTriggerModeButtonUi() {
		const momentary = MidiTabBuilder.getDevice().triggerMode === 'Momentary';
		$('.classMidiTriggerMode')
			.toggleClass('BtnPunchedIn', momentary)
			.toggleClass('BtnPunchedOut', !momentary)
			.text(momentary ? 'Momentary' : 'Latched');
		$('body').toggleClass('MidiTriggerModeMomentary', momentary);
		MidiTabBuilder.syncTriggerModeIndicatorLight();
	}

	// Mirrors device.triggerMode onto the physical Launchpad's own
	// control-button LED (LAUNCHPAD_CONTROL_BUTTON_TRIGGER_MODE_CC in
	// midi-io.js) so the hardware button's light always matches the on-screen
	// #btnMidiTriggerMode/#btnMidiTriggerModeQuick PunchedIn/PunchedOut state,
	// regardless of which of the three (hardware button, MIDI tab button, Quick
	// Menu button) triggered the change. Not reset by Section
	// navigation/clearAndRepaintDevice()'s grid wipe -- that only ever touches
	// the 64 real grid notes (11-88), never this control button's own address.
	static syncTriggerModeIndicatorLight() {
		const output = MidiTabBuilder.currentOutputPort();
		if (!output) {
			return;
		}
		const device = MidiTabBuilder.getDevice();
		sendTriggerModeIndicatorLight(output, device.channel || 0, device.triggerMode === 'Momentary');
	}

	// Mirrors the currently-checked rbHighlight ("NoteType") radio button onto the
	// Launchpad's top control row (see LAUNCHPAD_NOTE_TYPE_CONTROL_MAP): the
	// matching control button lights up, every other mapped control button (and
	// any not currently lit) is sent velocity 0 -- so the row behaves like a lit
	// radio group mirroring the on-screen Palette, regardless of whether the
	// on-screen radio changed via a click, a keystroke ('[' / ']' for
	// Pitch/Multi), or a physical Launchpad control-button press (see
	// handleIncomingMidiMessage() above). Bound to input[name="rbHighlight"]'s
	// 'change' event in bindEvents(), and also called once on device
	// connect/output-change (syncOnDeviceConnect()) so the initial default
	// ("Named") is reflected without waiting for the first change. Guarded by
	// device.mode !== 'Note', same rationale as clearLaunchpadEdgeArtifacts()'s
	// guard in midi-io.js: in 'Note' mode we can't assume the connected
	// controller is even a Launchpad with this control row at all.
	static syncNoteTypeControlLights() {
		const output = MidiTabBuilder.currentOutputPort();
		if (!output || MidiTabBuilder.getDevice().mode === 'Note') {
			return;
		}
		const channel = MidiTabBuilder.getDevice().channel || 0;
		const currentNoteType = $('input[name="rbHighlight"]:checked').val();
		Object.entries(LAUNCHPAD_NOTE_TYPE_CONTROL_MAP).forEach(([cc, entry]) => {
			const isSelected = entry.noteType === currentNoteType;
			MidiTabBuilder.sendNoteOnRaw(output, channel, Number(cc), isSelected ? LAUNCHPAD_VELOCITY_NOTE_TYPE_SELECTED : 0);
		});
	}

	// Shared low-level helper for every Round-4 (143-it4-round-4-design.md)
	// control-button light: a plain NOTE ON at a fixed (non-grid) address,
	// no-op if there's no output port or the device is in 'Note' mode (same
	// guard/rationale as syncNoteTypeControlLights() -- in 'Note' mode we
	// can't assume a Launchpad-shaped controller with these control buttons
	// is even connected).
	static setControlLight(outNote, velocity) {
		const output = MidiTabBuilder.currentOutputPort();
		if (!output || MidiTabBuilder.getDevice().mode === 'Note') {
			return;
		}
		MidiTabBuilder.sendNoteOnRaw(output, MidiTabBuilder.getDevice().channel || 0, outNote, velocity);
	}

	// Column 0, doc row 7 (REC indicator/toggle -- 143-it4-round-4-design.md):
	// mirrors the on-screen '.RecordButton' (#btnRecord) ButtonOn state (set
	// by syncRecordingViews() in infinite-neck.js) onto
	// LAUNCHPAD_CONTROL_BUTTON_REC_CC, red (LAUNCHPAD_MAJOR_COLOR_VELOCITIES.RED)
	// when recording, off otherwise. Bound to '.RecordButton' click in
	// bindEvents() below (so a mouse-driven toggle -- not just a physical
	// button press -- keeps the light in sync), and called once on device
	// connect (syncOnDeviceConnect()).
	static syncRecordButtonLight() {
		const recording = $('.RecordButton').hasClass('ButtonOn');
		MidiTabBuilder.setControlLight(LAUNCHPAD_CONTROL_BUTTON_REC_CC, recording ? LAUNCHPAD_MAJOR_COLOR_VELOCITIES.RED : 0);
	}

	// Column 0, doc row 3 (Clear-mode indicator -- see
	// LAUNCHPAD_CONTROL_BUTTON_CLEAR_MODE_CC above): mirrors
	// PalettePresentation.getMode() === 'clear' onto the button's LED, yellow-
	// amber when Clear is selected, off otherwise. Bound to the
	// 'Palette:modeChanged' EventBus event (fired by
	// PalettePresentation.updatePaletteModeUi() in presentation.js -- the
	// single choke point for EVERY mode change, including the "special
	// handling going back and forth between paint mode and clear" that
	// bypasses the rbPaletteMode radio's own native 'change' event, e.g.
	// picking a color/highlight while in Clear mode), and called once on
	// device connect (syncOnDeviceConnect()).
	static syncClearModeControlLight() {
		const active = PalettePresentation.getMode() === 'clear';
		MidiTabBuilder.setControlLight(LAUNCHPAD_CONTROL_BUTTON_CLEAR_MODE_CC, active ? LAUNCHPAD_VELOCITY_CLEAR_MODE_SELECTED : 0);
	}

	// Column 9, rows 7-8 (Looper toggles -- 143-it4-round-4-design.md): mirrors
	// #btnLoopBeats/#btnLoopSections's own ButtonOn state (set by
	// applyLoopBeatsUi()/applyLoopSectionsUi() in infinite-neck.js, the
	// "recently centralized handling of all looper buttons" the design doc
	// refers to) onto their Launchpad addresses, magenta
	// (LAUNCHPAD_VELOCITY_COLUMN9_PRESSED) when looping, off otherwise. Bound
	// to their own click in bindEvents() below, called after a physical
	// column-9 rows-7-8 press (handleIncomingMidiMessage()), on device
	// connect, and after any full clearLaunchpadEdgeArtifacts() wipe
	// (hardRepaint()/route-toggle-off/syncOnDeviceConnect()) since these
	// addresses ARE LAUNCHPAD_RIGHT_CONTROL_COLUMN_NOTES in midi-io.js and
	// would otherwise be left dark by that wipe.
	static syncLooperControlLights() {
		LAUNCHPAD_COLUMN9_LOOP_ENTRIES.forEach(({ cc, selector }) => {
			const active = $(selector).hasClass('ButtonOn');
			MidiTabBuilder.setControlLight(cc, active ? LAUNCHPAD_VELOCITY_COLUMN9_PRESSED : 0);
		});
	}

	// Blanks every column-9 rows-1-6 action-button light except exceptCC (if
	// given) -- "When any other button is pressed in column 9, blank out all
	// other buttons in rows 1-6" (143-it4-round-4-design.md). Called on every
	// rows-1-6 press (excepting the just-pressed button, which lights itself
	// separately) and on every rows-7-8 (Looper) press (no exception -- rows
	// 7-8 don't participate in this latch group themselves).
	static clearColumn9ActionLights(exceptCC = null) {
		LAUNCHPAD_COLUMN9_ACTION_CCS.forEach((cc) => {
			if (cc !== exceptCC) {
				MidiTabBuilder.setControlLight(cc, 0);
			}
		});
	}

	// Shared by both the MIDI tab's #btnMidiTriggerMode and the Quick Menu's
	// #btnMidiTriggerModeQuick click handlers (bound together below via
	// '.classMidiTriggerMode') so either button flips the SAME device.triggerMode
	// and both update together through applyTriggerModeButtonUi().
	static toggleTriggerMode() {
		const device = MidiTabBuilder.getDevice();
		device.triggerMode = device.triggerMode === 'Momentary' ? 'Latch' : 'Momentary';
		MidiTabBuilder.applyTriggerModeButtonUi();
	}

	static bindEvents() {
		const eventNamespace = MidiTabBuilder.eventNamespace;

		$(`#selMidiInDevice`)
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				const input = MidiTabBuilder.inputs[Number(this.value)];
				MidiTabBuilder.attachToInput(input);
				if (input) {
					MidiTabBuilder.getDevice().name = input.name;
				}
			});

		$('#selMidiOutDevice')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				const output = MidiTabBuilder.outputs[Number(this.value)];
				if (output) {
					MidiTabBuilder.getDevice().name = output.name;
				}
				MidiTabBuilder.syncOnDeviceConnect();
			});

		$('#selMidiRouteInstrument')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				MidiTabBuilder.releaseForwardedPitches();
				MidiTabBuilder.getDevice().tableID = this.value;
				MidiTabBuilder.lastPaintTableID = ''; // force a hard repaint for the newly-routed table
				MidiTabBuilder.clearAndRepaintDevice();
			});

		$('#selMidiRouteChannel')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				MidiTabBuilder.getDevice().channel = Number(this.value) || 0;
			});

		$('#selMidiDeviceMode')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				MidiTabBuilder.getDevice().mode = this.value;
				MidiTabBuilder.clearAndRepaintDevice();
				MidiTabBuilder.syncTriggerModeIndicatorLight();
				MidiTabBuilder.syncNoteTypeControlLights();
				MidiTabBuilder.syncRecordButtonLight();
				MidiTabBuilder.syncLooperControlLights();
			});

		$('#selMidiDeviceColorMap')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				MidiTabBuilder.getDevice().colorMap = this.value;
				MidiTabBuilder.clearAndRepaintDevice();
			});

		$('#selMidiDeviceOrientation')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				MidiTabBuilder.getDevice().orientation = this.value;
				MidiTabBuilder.clearAndRepaintDevice();
			});

		$('#selMidiForwardDevice')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				MidiTabBuilder.releaseForwardedPitches();
				const output = MidiTabBuilder.outputs[Number(this.value)];
				if (output) {
					MidiTabBuilder.getDevice().forwardName = output.name;
				}
			});

		$('#selMidiForwardChannel')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				MidiTabBuilder.releaseForwardedPitches();
				MidiTabBuilder.getDevice().forwardChannel = Number(this.value) || 0;
			});

		$('.classMidiTriggerMode')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				MidiTabBuilder.toggleTriggerMode();
			});

		$('#btnMidiRouteToggle')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				const device = MidiTabBuilder.getDevice();
				device.enabled = !device.enabled;
				MidiTabBuilder.applyRoutingButtonUi();
				if (device.enabled) {
					MidiTabBuilder.lastPaintTableID = ''; // force a hard repaint on re-enable
					MidiTabBuilder.clearAndRepaintDevice();
				} else {
					const output = MidiTabBuilder.currentOutputPort();
					if (output && device.mode !== 'Note') {
						clearLaunchpadGrid(output, device.channel || 0);
						clearLaunchpadEdgeArtifacts(output, device.channel || 0);
						MidiTabBuilder.syncLooperControlLights();
						MidiTabBuilder.logActivityText(`clear   64 grid notes -> velocity 0 (${output.name})`);
					}
					MidiTabBuilder.releaseForwardedPitches();
					MidiTabBuilder.lastPaintPlan = null;
					MidiTabBuilder.lastPaintTableID = '';
				}
			});

		$('#btnMidiTestSendNoteOn')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				const output = MidiTabBuilder.currentDebugOutputPort();
				if (!output) {
					return;
				}
				const channel = Number($('#selMidiTestNoteOnChannel').val());
				const note = Number($('#txtMidiTestNoteOnNote').val());
				const velocity = Number($('#txtMidiTestNoteOnVelocity').val());
				sendNoteOn(output, channel, note, velocity);
				MidiTabBuilder.logActivity('send', [0x90 | channel, note & 0x7f, velocity & 0x7f], output.name);
				$('#txtMidiTestNoteOnZeroNote').val(note);
				$('#txtMidiTestNoteOffNote').val(note);
			});

		$('#btnMidiTestSendNoteOff')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				const output = MidiTabBuilder.currentDebugOutputPort();
				if (!output) {
					return;
				}
				const channel = Number($('#selMidiTestNoteOffChannel').val());
				const note = Number($('#txtMidiTestNoteOffNote').val());
				const velocity = Number($('#txtMidiTestNoteOffVelocity').val());
				sendNoteOff(output, channel, note, velocity);
				MidiTabBuilder.logActivity('send', [0x80 | channel, note & 0x7f, velocity & 0x7f], output.name+'-velocity:'+velocity);
			});

		$('#btnMidiTestSendNoteOnZero')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				const output = MidiTabBuilder.currentDebugOutputPort();
				if (!output) {
					return;
				}
				const channel = Number($('#selMidiTestNoteOnZeroChannel').val());
				const note = Number($('#txtMidiTestNoteOnZeroNote').val());
				const velocity = Number($('#txtMidiTestNoteOnZeroVelocity').val());
				sendNoteOn(output, channel, note, velocity);
				MidiTabBuilder.logActivity('send', [0x90 | channel, note & 0x7f, velocity & 0x7f], output.name+'-velocity:'+velocity);
			});

		$('#btnMidiTestSendCC')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				const output = MidiTabBuilder.currentDebugOutputPort();
				if (!output) {
					return;
				}
				const channel = Number($('#selMidiTestCCChannel').val());
				const controller = Number($('#txtMidiTestCCNumber').val());
				const value = Number($('#txtMidiTestCCValue').val());
				sendControlChange(output, channel, controller, value);
				MidiTabBuilder.logActivity('send', [0xb0 | channel, controller & 0x7f, value & 0x7f], output.name);
			});

		$('#btnMidiClearActivityLog')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				const el = document.getElementById('divMidiActivityLog');
				if (el) {
					el.textContent = '';
				}
			});

		$('input[name="rbHighlight"]')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				MidiTabBuilder.syncNoteTypeControlLights();
			});

		// Round 4 (143-it4-round-4-design.md): mirror a mouse-driven REC/Looper
		// toggle onto their physical Launchpad control-button lights, same idea
		// as the rbHighlight listener above -- these elements are static markup
		// in index.html (#transport), already present by the time the MIDI tab
		// loads, so a direct (non-delegated) binding is safe here.
		$('.RecordButton')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				MidiTabBuilder.syncRecordButtonLight();
			});

		$('#btnLoopSections, #btnLoopBeats')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				MidiTabBuilder.syncLooperControlLights();
			});

		EventBus.on('Widget:SectionStatus:statusChanged', MidiTabBuilder.onSectionStatusChanged);
		EventBus.on('Note:colored', MidiTabBuilder.onNoteColored);
		EventBus.on('UpdateAllWiringSelects', () => MidiTabBuilder.populateInstrumentPicker());
		EventBus.on('Palette:modeChanged', () => MidiTabBuilder.syncClearModeControlLight());
	}

	static populateDeviceSelect(selectEl, devices, preferredName = '', fallbackSubstring = PREFERRED_DEVICE_NAME_SUBSTRING) {
		selectEl.innerHTML = '';
		devices.forEach((device, index) => {
			const option = document.createElement('option');
			option.value = String(index);
			option.textContent = device.name || `(unnamed device ${index})`;
			selectEl.appendChild(option);
		});
		let preferredIndex = preferredName
			? devices.findIndex((device) => device.name === preferredName)
			: -1;
		if (preferredIndex < 0 && fallbackSubstring) {
			preferredIndex = devices.findIndex(
				(device) => device.name && device.name.includes(fallbackSubstring)
			);
		}
		if (preferredIndex >= 0) {
			selectEl.value = String(preferredIndex);
		}
	}

	static async initMidiAccess() {
		let midiAccess;
		try {
			// Iteration 5, Round 3 (143-it5-design.md "Speeding up batch lighting"):
			// sysex:true is required to send the new SysEx bulk-clear message
			// (sendLightAllLedsSysEx()); requestMidiAccess({sysex:false}) previously
			// used here would silently make output.send() throw for any SysEx
			// message. Requested unconditionally (not only when
			// #chkMidiUseSysExClear is checked) since Web MIDI access/permission is
			// granted once up front, not re-negotiable per later feature use.
			midiAccess = await requestMidiAccess({ sysex: true });
		} catch (err) {
			MidiTabBuilder.logActivity('error', [], err.message);
			return;
		}
		MidiTabBuilder.midiAccess = midiAccess;
		MidiTabBuilder.inputs = listInputs(midiAccess);
		MidiTabBuilder.outputs = listOutputs(midiAccess);

		const preferredName = MidiTabBuilder.getDevice().name || '';
		MidiTabBuilder.populateDeviceSelect(document.getElementById('selMidiInDevice'), MidiTabBuilder.inputs, preferredName);
		MidiTabBuilder.populateDeviceSelect(document.getElementById('selMidiOutDevice'), MidiTabBuilder.outputs, preferredName);
		MidiTabBuilder.populateDeviceSelect(
			document.getElementById('selMidiForwardDevice'),
			MidiTabBuilder.outputs,
			MidiTabBuilder.getDevice().forwardName || '',
			PREFERRED_FORWARD_DEVICE_NAME_SUBSTRING
		);
		MidiTabBuilder.populateDeviceSelect(
			document.getElementById('selMidiDebugOutDevice'),
			MidiTabBuilder.outputs,
			'',
			PREFERRED_DEBUG_DEVICE_NAME_SUBSTRING
		);
		MidiTabBuilder.attachToInput(MidiTabBuilder.inputs[Number($('#selMidiInDevice').val()) || 0]);
		MidiTabBuilder.syncOnDeviceConnect();

		midiAccess.onstatechange = () => {
			MidiTabBuilder.inputs = listInputs(midiAccess);
			MidiTabBuilder.outputs = listOutputs(midiAccess);
			const currentPreferredName = MidiTabBuilder.getDevice().name || '';
			MidiTabBuilder.populateDeviceSelect(document.getElementById('selMidiInDevice'), MidiTabBuilder.inputs, currentPreferredName);
			MidiTabBuilder.populateDeviceSelect(document.getElementById('selMidiOutDevice'), MidiTabBuilder.outputs, currentPreferredName);
			MidiTabBuilder.populateDeviceSelect(
				document.getElementById('selMidiForwardDevice'),
				MidiTabBuilder.outputs,
				MidiTabBuilder.getDevice().forwardName || '',
				PREFERRED_FORWARD_DEVICE_NAME_SUBSTRING
			);
			MidiTabBuilder.populateDeviceSelect(
				document.getElementById('selMidiDebugOutDevice'),
				MidiTabBuilder.outputs,
				'',
				PREFERRED_DEBUG_DEVICE_NAME_SUBSTRING
			);
			MidiTabBuilder.attachToInput(MidiTabBuilder.inputs[Number($('#selMidiInDevice').val()) || 0]);
			MidiTabBuilder.syncOnDeviceConnect();
		};
	}

	// Runs once an output port is actually available (initial MIDI access grant,
	// and again on every onstatechange -- e.g. a Launchpad plugged in after page
	// load, or replugged): wipes the known real-hardware LED artifacts (see
	// clearLaunchpadEdgeArtifacts()'s doc comment in midi-io.js -- addresses
	// "gets a light on at connection") and pushes the current trigger-mode
	// indicator light so the physical control button reflects
	// device.triggerMode as soon as the device is reachable, without waiting
	// for the first click/repaint. Round 4 (143-it4-round-4-design.md) adds the
	// REC and Looper-toggle lights to this same initial sync.
	static syncOnDeviceConnect() {
		const output = MidiTabBuilder.currentOutputPort();
		if (!output) {
			return;
		}
		if (MidiTabBuilder.getDevice().mode !== 'Note') {
			clearLaunchpadEdgeArtifacts(output, MidiTabBuilder.getDevice().channel || 0);
		}
		MidiTabBuilder.syncTriggerModeIndicatorLight();
		MidiTabBuilder.syncNoteTypeControlLights();
		MidiTabBuilder.syncRecordButtonLight();
		MidiTabBuilder.syncLooperControlLights();
		MidiTabBuilder.syncClearModeControlLight();
		// Round 2: All Clear button idles lit YELLOW_GREEN as soon as an output
		// port is reachable, same rationale as the other control-button lights
		// above (don't wait for a first press/release to show its idle state).
		MidiTabBuilder.setControlLight(LAUNCHPAD_CONTROL_BUTTON_ALL_CLEAR_CC, LAUNCHPAD_VELOCITY_ALL_CLEAR_IDLE);
	}
}
