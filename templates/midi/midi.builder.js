/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 143 (midi-note-in), Iterations 3-4 (+ Iteration 4 round 2): see
// _doco/design/sprints/143-midi-note-in/143-design-3.md,
// 143-it4-design.md/143-it4-implementation-plan.md, and 143-it4-design-2.md
// for the design discussion behind this module. NoteMode is explicitly out
// of scope for Iteration 4; only Programmer mode's Momentary/Latch +
// downstream forwarding are covered.
//
// Iteration 4 round 2 (143-it4-design-2.md) added two more paint-plan
// sources, both LIGHTS ONLY (never forwarded downstream): Highlight overlays
// (magenta "Highlight Multi"/yellow "Highlight Pitch (MIDI)", always winning
// over whatever note color is underneath) and Recorded Notes (the beat-keyed
// sectionNotes.recordedNotes[] Looper-playback overlay, previously not read
// by this module at all) -- see buildDevicePaintPlan()'s doc comment for the
// full read-source breakdown and why recordedNotes/live-highlight-DOM reads
// are handled differently depending on which trigger (click vs. beat-tick)
// is building the plan.
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
// for the on-screen Section model; Momentary ALSO calls colorNote() again on
// button-up. See handleIncomingMidiMessage()'s comment for the exact
// Latch<->Momentary transition semantics.
//
// Iteration 5, Round 9 (real-hardware mission-critical requirement: "note on
// and off from a button press must go one-to-one with note on and off to the
// VoiceLive at that pitch... lights/Session are secondary"): downstream pitch
// forwarding is now COMPLETELY DECOUPLED from the Section model/paint plan,
// for BOTH Latch and Momentary -- forwardDeviceEvent() echoes every real
// physical NOTE ON/OFF straight through to the forward output 1:1, before
// colorNote() ever runs. See its doc comment for why Rounds 5-8's approach of
// deriving forwarding from a diff of the chart's highlighted-cells snapshot
// (a "pitch plan") kept surfacing new failure modes and was abandoned.
//
// MIDI OUT still tracks a "paint plan" (Map<outNote, velocity>) of whatever
// should currently be lit on the Launchpad -- LIGHTS ONLY now, rebuilt from
// the routed table's namedNotes/playedNotes/etc. on two triggers:
//   - 'Widget:SectionStatus:statusChanged' (replayTable() fires this once per
//     visible table on Section navigation and every Looper beat tick) -> full
//     clear-and-repaint of the lights, skipped entirely if the freshly
//     computed plan is identical to what's already lit (avoids visibly
//     re-flashing the grid for redundant back-to-back firings of this event
//     for the same Section).
//   - 'Note:colored' (colorNote() fires this on every td.note click/press) ->
//     a targeted diff against the previous plan (only changed notes get a
//     message, so composing on the neck doesn't flash the whole grid).
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
	sendLightLedsSysEx,
	LAUNCHPAD_SYSEX_MAX_LED_PAIRS_PER_MESSAGE,
	LAUNCHPAD_GRID_SIZE,
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

	// Downstream forwarding (Iteration 4, 143-it4-design.md; rewritten Iteration
	// 5 Round 9): the SINGLE source of truth for "is this pitch currently
	// believed sounding on the forward output" -- a Map<midinum, velocity>,
	// maintained ONLY by forwardDeviceEvent()/sendAllNotesOffToForwardDevice()/
	// releaseForwardedPitches(). No longer derived from any chart/highlight
	// snapshot at all -- forwardDeviceEvent() is a direct echo of the raw
	// physical MIDI event, so this Map simply mirrors "what NOTE ON/OFF have we
	// actually sent downstream so far" (used only by the panic/cleanup
	// functions above to know what still needs a NOTE OFF).
	static forwardedPitches = new Map();

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
			selForwardChannel.value = String(device.forwardChannel ?? 0);
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
		MidiTabBuilder.appendActivityLogLine(el, line, direction);
	}

	// For lines that aren't a single MIDI message (e.g. the grid-clear summary,
	// which is really 64 separate messages) -- avoids flooding the small log
	// panel with one line per grid note. All current callers are outbound
	// device writes (SysEx clear/paint, NOTE-based grid clear), so `direction`
	// defaults to 'send' for color-coding purposes -- pass an explicit
	// direction if a future caller needs a different color.
	static logActivityText(text, direction = 'send') {
		const el = document.getElementById('divMidiActivityLog');
		if (!el) {
			return;
		}
		const elapsedSeconds = ((performance.now() - MidiTabBuilder.pageStart) / 1000).toFixed(3);
		MidiTabBuilder.appendActivityLogLine(el, `${elapsedSeconds} ${text}`, direction);
	}

	// Iteration 5 Round 4 close-out: color-codes each activity log line by
	// direction -- green ('midiLogForward') for anything forwarded downstream
	// (fwd-on/fwd-off/fwd-cc), yellow ('midiLogSend') for anything sent OUT to
	// a device (send/sysex/clear/error/etc), and the log's existing base color
	// (no class -- unstyled) for inbound 'receive' messages. Appends one <div>
	// per line (rather than the previous `textContent +=` raw concatenation) so
	// each line can carry its own CSS class; `el.textContent = ''`
	// (#btnMidiClearActivityLog) still clears these div children exactly as it
	// cleared plain text before. Uses `line.textContent = text` (never
	// innerHTML/string interpolation into markup) since deviceName comes from
	// the Web MIDI API (an external, untrusted device-name string) and must
	// never be interpreted as HTML.
	static appendActivityLogLine(el, text, direction) {
		const line = document.createElement('div');
		line.textContent = text;
		if (direction.startsWith('fwd')) {
			line.className = 'midiLogForward';
		} else if (direction !== 'receive') {
			line.className = 'midiLogSend';
		}
		el.appendChild(line);
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
	// device.triggerMode now ONLY selects whether button-up (NOTE OFF) reaches
	// the SECTION/on-screen model (see forwardDeviceEvent()'s doc comment for
	// why downstream forwarding itself no longer depends on triggerMode at
	// all):
	//   - 'Latch' (default): button-up means nothing for the model; a note
	//     only toggles on the next button-down (matches the long-standing
	//     td.note click model).
	//   - 'Momentary': button-up ALSO calls colorNote() again, so the model
	//     behaves like a synth key -- down adds the note, up removes it.
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
		const midinum = Number(cell.attr('midinum'));

		// Iteration 5, Round 9 (real-hardware mission-critical requirement, see
		// forwardDeviceEvent()'s doc comment): forward the raw physical event
		// DIRECTLY and UNCONDITIONALLY here, for BOTH Latch and Momentary, BEFORE
		// colorNote() runs any Section-model/highlight side effects -- sound-
		// critical path first, lights/Session strictly secondary.
		MidiTabBuilder.forwardDeviceEvent(midinum, isNoteOn, parsed.velocity);

		// triggerMode now ONLY controls whether the on-screen Section model
		// reacts to button-up: Latch (default) ignores release entirely here
		// (matches the long-standing td.note click model); Momentary also calls
		// colorNote() on release, toggling the model off. The forward above
		// already happened unconditionally either way.
		if (isNoteOff && device.triggerMode !== 'Momentary') {
			return;
		}
		colorNote(cell);
	}

	// Iteration 5, Round 9 (real-hardware mission-critical requirement: "note
	// on and off from a button press must go one-to-one with note on and off
	// to the VoiceLive at that pitch that was pressed with the button...
	// [lights/Session are] secondary... fastest and most reliable way... no
	// other rules should prevent simple forwarding"): forwards the raw
	// physical MIDI event straight through, 1:1, for BOTH Latch and Momentary
	// trigger modes -- a real NOTE ON always produces exactly one forwarded
	// NOTE ON at that pitch/velocity; a real NOTE OFF always produces exactly
	// one forwarded NOTE ON velocity-0 at that pitch. Completely independent
	// of whatever colorNoteInner()'s highlight/Section-model side effects
	// decide to do with the cell (e.g. NamedNote's "press an already-lit cell
	// to flash it off" feature) -- the physical button press/release IS the
	// forwarding signal, full stop.
	//
	// SUPERSEDES Rounds 5-8's pitchPlan/forwardedPitches DIFFING approach
	// (deriving forward on/off from comparing the chart's highlighted-cells
	// snapshot before/after colorNote() ran) entirely -- that approach kept
	// surfacing new failure modes (NamedNote's shared-per-letter model could
	// silence the wrong pitch or double-forward, and Latch mode's NOTE OFF
	// never even reached the forwarding code, since it was ignored before
	// resolving a cell at all) because it tried to INFER the physical event
	// from a side effect of it, rather than just echoing the event itself.
	// Latch and Momentary are not different EVENT MODELS for forwarding
	// purposes -- both already deliver an unambiguous real NOTE ON and a real
	// NOTE OFF from the hardware; only what the SECTION MODEL does with a
	// release differs between them (see handleIncomingMidiMessage()'s
	// triggerMode gate, applied strictly AFTER this call).
	//
	// Called from handleIncomingMidiMessage() BEFORE colorNote() -- sound-
	// critical path first, lights/session strictly secondary (same ordering
	// lesson as Round 2's latency fix, taken to its logical conclusion: zero
	// model dependency at all, not just "goes first").
	static forwardDeviceEvent(midinum, isNoteOn, velocity) {
		const device = MidiTabBuilder.getDevice();
		const output = MidiTabBuilder.currentForwardOutputPort();
		if (!output || !Number.isInteger(midinum)) {
			return;
		}
		const channel = device.forwardChannel ?? 0;
		if (isNoteOn) {
			sendNoteOn(output, channel, midinum, velocity);
			MidiTabBuilder.logActivity('fwd-on', [0x90 | channel, midinum & 0x7f, velocity & 0x7f], output.name);
			MidiTabBuilder.forwardedPitches.set(midinum, velocity);
		} else {
			// Iteration 5, Round 1 (143-it5-design.md "Prefer NOTE ON 0 to NOTE
			// OFF"): the VoiceLive 3 responds better to NOTE ON velocity 0 than an
			// explicit NOTE OFF (0x8n), even though both are spec-equivalent.
			sendNoteOn(output, channel, midinum, 0);
			MidiTabBuilder.logActivity('fwd-off', [0x90 | channel, midinum & 0x7f, 0], output.name);
			MidiTabBuilder.forwardedPitches.delete(midinum);
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

	// Iteration 5, Round 6 (143-it5-design.md "LED ColorMap"): fires 64 raw
	// Launchpad Programmer-mode grid NOTE ON messages (bypassing
	// lightPlan/hardRepaint entirely -- this is a one-off debug/test send,
	// unrelated to any routed Instrument) so the User can visually verify how
	// the physical device renders every one of its Launchpad velocity/colour
	// values, page by page. Iterates row 1-8 (outer) then col 1-8 (inner) --
	// "cell 1,1 gets velocity 1, cell 1,2 gets velocity 2" -- using the SAME
	// raw row*10+col Launchpad address every other grid-lighting call in this
	// file uses (NOT the on-screen tuning's cellrow/cellcol, and NOT
	// cellToLaunchpadGridNote()'s orientation-aware translation -- this is a
	// direct Launchpad hardware test, independent of any routed Instrument's
	// orientation setting). Uses the DEBUG output select (#selMidiDebugOutDevice,
	// see currentDebugOutputPort()'s doc comment), same as every other button
	// in this "MIDI OUT (debug/test send)" group.
	//
	// pageIndex 0 sends velocities 1-64, pageIndex 1 sends velocities 64-127 --
	// together covering all 127 non-zero Launchpad colour velocities across
	// the 64 physical grid pads (64+64=128 slots for 127 colours -- velocity
	// 64 intentionally appears once on each page, the one unavoidable overlap
	// from covering an odd total with two even-sized 64-pad pages).
	static sendColorPage(pageIndex) {
		const output = MidiTabBuilder.currentDebugOutputPort();
		if (!output) {
			return;
		}
		const channel = MidiTabBuilder.getDevice().channel || 0;
		const pageSize = LAUNCHPAD_GRID_SIZE * LAUNCHPAD_GRID_SIZE;
		for (let row = 1; row <= LAUNCHPAD_GRID_SIZE; row++) {
			for (let col = 1; col <= LAUNCHPAD_GRID_SIZE; col++) {
				const index = (row - 1) * LAUNCHPAD_GRID_SIZE + (col - 1);
				const velocity = pageIndex === 0 ? (index + 1) : (index + pageSize);
				const note = row * 10 + col;
				sendNoteOn(output, channel, note, velocity);
			}
		}
		const velocityRange = pageIndex === 0 ? `1-${pageSize}` : `${pageSize}-127`;
		MidiTabBuilder.logActivityText(`send    color page ${pageIndex + 1} (${pageSize} grid notes -> velocities ${velocityRange}) (${output.name})`);
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
	//
	// Iteration 5, Round 9: no longer drives downstream pitch forwarding at
	// all -- forwarding now happens directly in handleIncomingMidiMessage()
	// via forwardDeviceEvent(), completely decoupled from whatever colorNote()
	// does here (see forwardDeviceEvent()'s doc comment). This also means a
	// plain mouse click on a td.note (which also calls colorNote(), and so
	// also fires this same 'Note:colored' event) naturally stays silent to the
	// downstream device with no special-case flag needed -- mouse clicks never
	// go through handleIncomingMidiMessage() at all.
	static onNoteColored(event, data) {
		const device = MidiTabBuilder.getDevice();
		if (!device.enabled || !device.tableID || !data || data.sourceTableID !== device.tableID) {
			return;
		}
		// Real-time click: DOM Highlight classes are trustworthy (see
		// buildDevicePaintPlan()'s doc comment).
		const { lightPlan } = MidiTabBuilder.buildDevicePaintPlan(device.tableID, { includeDomHighlights: true });
		const haveBaseline = !!MidiTabBuilder.lastPaintPlan && device.tableID === MidiTabBuilder.lastPaintTableID;

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
	// lightPlan is still silently adopted as the new lastPaintPlan/
	// lastPaintTableID baseline, so the NEXT click's diffRepaint() is computed
	// against what's actually showing in this Section/table, not stale state
	// left over from a previous one.
	static clearAndRepaintDevice() {
		const device = MidiTabBuilder.getDevice();
		if (!device.enabled || !device.tableID) {
			return;
		}
		// Section-navigation/beat-tick: DOM Highlight classes may still reflect
		// the previous beat (see buildDevicePaintPlan()'s doc comment), so only
		// the model-driven recordedNotes[beat] highlights are trusted here.
		// Section navigation never forwards downstream at all (see this
		// method's own doc comment) -- forwarding is now entirely independent of
		// paint plans (see forwardDeviceEvent()'s doc comment).
		const { lightPlan } = MidiTabBuilder.buildDevicePaintPlan(device.tableID, { includeDomHighlights: false });
		const output = MidiTabBuilder.currentOutputPort();
		if (!output) {
			// Iteration 5 Round 4 close-out ("3 clicks to make MIDI Routing
			// stick" bug fix): no output port yet -- e.g. MIDI
			// access/enumeration is still resolving right after page load, or
			// #btnMidiRouteToggle was just clicked before syncOnDeviceConnect()
			// has ever run. Bail out WITHOUT touching lastPaintPlan/
			// lastPaintTableID below: committing those here, even though nothing
			// was actually painted, would make a LATER call (once an output
			// finally shows up) wrongly believe this table is already
			// painted/unchanged and silently skip the real repaint. See
			// syncOnDeviceConnect(), which now calls this again once an output
			// becomes reachable, so routing enabled before the device was ready
			// finishes painting itself with no extra click required.
			return;
		}
		const tableChanged = device.tableID !== MidiTabBuilder.lastPaintTableID;
		const unchanged = !tableChanged && !!MidiTabBuilder.lastPaintPlan
			&& MidiTabBuilder.plansAreEqual(lightPlan, MidiTabBuilder.lastPaintPlan);
		if (!unchanged) {
			MidiTabBuilder.hardRepaint(output, device.channel || 0, lightPlan);
		}
		MidiTabBuilder.lastPaintPlan = lightPlan;
		MidiTabBuilder.lastPaintTableID = device.tableID;
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

	// Builds this table's current LIGHTS-ONLY paint state as a single map:
	//   - lightPlan: Map<outNote, velocity> for the Launchpad's own lights,
	//     encoded per device.mode/colorMap/orientation (as before).
	// Iteration 5, Round 9: no longer also builds a parallel "pitch plan" for
	// downstream forwarding -- forwarding is now a direct echo of the raw
	// physical MIDI event (see forwardDeviceEvent()'s doc comment), completely
	// independent of this chart-state snapshot.
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
		if (!sectionNotes) {
			return { lightPlan };
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

		return { lightPlan };
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
		// Iteration 5, Round 4 (143-it5-design.md "Output LED Optimization"):
		// #chkMidiUseSysExClear now governs BOTH halves of a hard repaint (was
		// clear-only as of Round 3) -- replay()/Section-navigation's biggest
		// measured latency was the PAINT step below sending one NOTE ON per lit
		// cell (up to 64 individual messages), not just the clear step. Single
		// button presses (diffRepaint(), see its own doc comment) are
		// deliberately NOT batched -- "Single notes played should go out when
		// they go out" -- only this Section-boundary/beat-tick full-repaint path
		// is affected.
		const useSysEx = device.mode !== 'Note' && !!document.getElementById('chkMidiUseSysExClear')?.checked;
		if (device.mode !== 'Note') {
			// #chkMidiUseSysExClear opts into a single SysEx "Light all LEDs"
			// message (sendLightAllLedsSysEx()) instead of the ~70-message NOTE-ON
			// based wipe below. Unlike clearLaunchpadGrid()/clearLaunchpadEdgeArtifacts()
			// (which only ever touch the 64 grid notes + known edge-artifact
			// addresses, leaving column-0/9 control buttons alone), the SysEx
			// message overrides EVERY LED including those control buttons -- so
			// this branch must resync every one of them afterward, which the
			// NOTE-based branch never needed to do.
			if (useSysEx) {
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
		if (useSysEx) {
			// Batch the ENTIRE paint step into as few SysEx "Light LED" messages
			// as possible (see sendLightLedsSysEx()'s doc comment in midi-io.js
			// for why the sparse LED/colour-pair message was chosen over the
			// manual's row/column-sliced alternative) instead of one NOTE ON per
			// lit cell -- a `plan` Map already iterates as [outNote, velocity]
			// pairs, exactly the [led, colour] shape sendLightLedsSysEx() needs,
			// so it's passed straight through with no conversion. `channel` is
			// intentionally unused here: the Launchpad Pro's Programmer-mode grid
			// LED addressing is the same regardless of MIDI channel.
			if (plan.size > 0) {
				sendLightLedsSysEx(output, plan);
				const messageCount = Math.ceil(plan.size / LAUNCHPAD_SYSEX_MAX_LED_PAIRS_PER_MESSAGE);
				MidiTabBuilder.logActivityText(`sysex   paint ${plan.size} grid notes (${messageCount} message${messageCount === 1 ? '' : 's'}) (${output.name})`);
			}
		} else {
			plan.forEach((velocity, outNote) => {
				MidiTabBuilder.sendNoteOnRaw(output, channel, outNote, velocity);
			});
		}
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

	// Releases (NOTE OFF) any pitches we're currently holding open downstream
	// and clears the forwarded-pitches bookkeeping -- used when routing is
	// turned off or re-targeted at a different Instrument, so the downstream
	// device never gets left with a stuck note just because infinite-neck
	// stopped watching.
	static releaseForwardedPitches() {
		const device = MidiTabBuilder.getDevice();
		const output = MidiTabBuilder.currentForwardOutputPort();
		if (output && MidiTabBuilder.forwardedPitches.size > 0) {
			const channel = device.forwardChannel ?? 0;
			MidiTabBuilder.forwardedPitches.forEach((_velocity, midinum) => {
				sendNoteOn(output, channel, midinum, 0);
				MidiTabBuilder.logActivity('fwd-off', [0x90 | channel, midinum & 0x7f, 0], output.name);
			});
		}
		MidiTabBuilder.forwardedPitches = new Map();
	}

	// Iteration 5, Round 1 (143-it5-design.md "CC_AllClear"): fires a single
	// CC 123 127 ("All Notes Off") to the downstream forward output/channel --
	// the VoiceLive 3's own documented single-message panic-clear. Also drops
	// our own "what's currently held downstream" bookkeeping (forwardedPitches),
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
		const channel = device.forwardChannel ?? 0;
		sendControlChange(output, channel, MIDI_CC_ALL_NOTES_OFF, 127);
		MidiTabBuilder.logActivity('fwd-cc', [0xb0 | channel, MIDI_CC_ALL_NOTES_OFF, 127], output.name);
		MidiTabBuilder.forwardedPitches = new Map();
	}

	static applyRoutingButtonUi() {
		const enabled = MidiTabBuilder.getDevice().enabled === true;
		$('#btnMidiRouteToggle')
			.toggleClass('BtnPunchedIn', enabled)
			.toggleClass('BtnPunchedOut', !enabled)
			.text(enabled ? 'MIDI Routing On' : 'MIDI Routing');
		MidiTabBuilder.updateForwardStatusIndicator();
	}

	// Iteration 5, Round 6 (143-it5-design.md "Forwarding indicator"): a single
	// glance answer to "is forwarding on, to which port/device and channel, and
	// is that device actually connected right now" -- the user reported
	// trouble figuring out whether forwarding was correctly wired to the right
	// channel on the real hardware. Called from every place that can change any
	// of those three facts: the routing toggle (via applyRoutingButtonUi()),
	// the forward device/channel selects, and MIDI port connect/disconnect (via
	// initMidiAccess()'s onstatechange, so unplugging/replugging the forward
	// device updates the indicator live with no other interaction needed).
	static updateForwardStatusIndicator() {
		const el = document.getElementById('spanMidiForwardStatus');
		if (!el) {
			return;
		}
		const device = MidiTabBuilder.getDevice();
		el.classList.remove('midiForwardStatusOk', 'midiForwardStatusWarn');
		if (device.enabled !== true) {
			el.textContent = 'Forwarding: OFF (MIDI Routing is off)';
			el.classList.add('midiForwardStatusWarn');
			return;
		}
		const output = MidiTabBuilder.currentForwardOutputPort();
		if (!output) {
			el.textContent = 'Forwarding: ON, but no forward output device is selected';
			el.classList.add('midiForwardStatusWarn');
			return;
		}
		const channelLabel = (device.forwardChannel ?? 0) + 1;
		// Web MIDI's MIDIPort.state reflects whether the underlying port is
		// actually present right now ('connected'/'disconnected') -- distinct
		// from merely being the CURRENTLY SELECTED option, which persists even
		// after the real device is unplugged (listOutputs() keeps returning
		// every port MIDIAccess has ever seen, not just the currently-present
		// ones).
		const connected = output.state === 'connected';
		el.textContent = `Forwarding: ON -> ${output.name} (channel ${channelLabel}) ${connected ? '[connected]' : '[NOT CONNECTED]'}`;
		el.classList.add(connected ? 'midiForwardStatusOk' : 'midiForwardStatusWarn');
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
				MidiTabBuilder.updateForwardStatusIndicator();
			});

		$('#selMidiForwardChannel')
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function () {
				MidiTabBuilder.releaseForwardedPitches();
				MidiTabBuilder.getDevice().forwardChannel = Number(this.value) || 0;
				MidiTabBuilder.updateForwardStatusIndicator();
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

		$('#btnMidiSendColorPage1')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				MidiTabBuilder.sendColorPage(0);
			});

		$('#btnMidiSendColorPage2')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				MidiTabBuilder.sendColorPage(1);
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
		MidiTabBuilder.updateForwardStatusIndicator();

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
			MidiTabBuilder.updateForwardStatusIndicator();
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
		// Iteration 5 Round 4 close-out ("3 clicks to make MIDI Routing stick"
		// bug fix): if routing was already turned on (via the button, or
		// persisted from a previously-saved Song) before this output became
		// reachable, clearAndRepaintDevice() above would have bailed out with
		// no output to paint to -- now that one exists, finish the job here so
		// routing "just works" the moment the device shows up, with no extra
		// click required. No-ops harmlessly if routing isn't enabled/no table
		// is routed (clearAndRepaintDevice()'s own guard).
		MidiTabBuilder.clearAndRepaintDevice();
	}
}
