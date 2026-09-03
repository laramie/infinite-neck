/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 143 (midi-note-in), Iterations 3-4: see
// _doco/design/sprints/143-midi-note-in/143-design-3.md and
// 143-it4-design.md/143-it4-implementation-plan.md for the design discussion
// behind this module. NoteMode is explicitly out of scope for Iteration 4;
// only Programmer mode's Momentary/Latch + downstream forwarding are covered.
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
	formatMidiBytesHex,
	parseLaunchpadProgrammerGridNote,
	launchpadGridToCell,
	cellToLaunchpadGridNote,
	clearLaunchpadGrid
} from '../../midi-io.js';
import { resolveLaunchpadVelocityForColorClass } from './midiColorMaps.js';
import { colorNote, findNoteCell, showMidiNotesInTable } from '../../NoteTableController.js';
import { createLookupContext, lookupUserColorClass } from '../../colorFunctions.js';
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
		el.textContent += `${elapsedSeconds} ${paddedDirection} [${formatMidiBytesHex(bytes)}] ${deviceName}\n`;
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
			MidiTabBuilder.logActivity('receive', event.data, input.name);
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
		colorNote(cell);
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
		const { lightPlan, pitchPlan } = MidiTabBuilder.buildDevicePaintPlan(device.tableID);
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

		// On the very first sync for this table (no baseline yet -- e.g. routing
		// was just enabled or re-targeted), only ADOPT the pitchPlan; don't
		// forward it, so pre-existing notes never retrigger the synth just
		// because MIDI routing started watching this table.
		if (haveBaseline) {
			MidiTabBuilder.forwardPitchChanges(MidiTabBuilder.lastPitchPlan || new Map(), pitchPlan);
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
		const { lightPlan, pitchPlan } = MidiTabBuilder.buildDevicePaintPlan(device.tableID);
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
	// Covers BOTH data sources replayTable() paints from (see
	// NoteTableController.js replayTable()):
	//   - namedNotes: the chart's main note-name coloring (what colorNote()
	//     writes to in the default 'Named' highlight mode -- setNamedNote()).
	//     A single named note colors EVERY cell sharing that note name across
	//     the tuning, so every matching cell is included.
	//   - playedNotes: the Tiny/Single/Fingering/Bend overlay styles, addressed
	//     by an exact midinum+row (a single cell).
	static buildDevicePaintPlan(tableID) {
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

		return { lightPlan, pitchPlan };
	}

	static sendNoteOnRaw(output, channel, outNote, velocity) {
		sendNoteOn(output, channel, outNote, velocity);
		MidiTabBuilder.logActivity('send', [0x90 | channel, outNote & 0x7f, velocity & 0x7f], output.name);
	}

	// Full wipe + repaint of every entry in plan -- used at Section boundaries
	// so no lights from a previous Section/table/device-config can persist.
	static hardRepaint(output, channel, plan) {
		if (MidiTabBuilder.getDevice().mode !== 'Note') {
			// Programmer mode's row*10+col numbering has a fixed 64-note address
			// space, so a full wipe is cheap and simple (per 143-design-3.md's
			// "simple algorithm...for now" -- a real SysEx screen-wipe is deferred).
			clearLaunchpadGrid(output, channel);
			MidiTabBuilder.logActivityText(`clear   64 grid notes -> velocity 0 (${output.name})`);
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
				sendNoteOff(output, channel, midinum, 0);
				MidiTabBuilder.logActivity('fwd-off', [0x80 | channel, midinum & 0x7f, 0], output.name);
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

	static applyRoutingButtonUi() {
		const enabled = MidiTabBuilder.getDevice().enabled === true;
		$('#btnMidiRouteToggle')
			.toggleClass('BtnPunchedIn', enabled)
			.toggleClass('BtnPunchedOut', !enabled)
			.text(enabled ? 'MIDI Routing On' : 'MIDI Routing');
	}

	static applyTriggerModeButtonUi() {
		const momentary = MidiTabBuilder.getDevice().triggerMode === 'Momentary';
		$('#btnMidiTriggerMode')
			.toggleClass('BtnPunchedIn', momentary)
			.toggleClass('BtnPunchedOut', !momentary)
			.text(momentary ? 'Momentary' : 'Latched');
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

		$('#btnMidiTriggerMode')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				const device = MidiTabBuilder.getDevice();
				device.triggerMode = device.triggerMode === 'Momentary' ? 'Latch' : 'Momentary';
				MidiTabBuilder.applyTriggerModeButtonUi();
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
				const output = MidiTabBuilder.currentOutputPort();
				if (!output) {
					return;
				}
				const channel = Number($('#selMidiTestNoteOnChannel').val());
				const note = Number($('#txtMidiTestNoteOnNote').val());
				const velocity = Number($('#txtMidiTestNoteOnVelocity').val());
				sendNoteOn(output, channel, note, velocity);
				MidiTabBuilder.logActivity('send', [0x90 | channel, note & 0x7f, velocity & 0x7f], output.name);
			});

		$('#btnMidiTestSendNoteOff')
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function () {
				const output = MidiTabBuilder.currentOutputPort();
				if (!output) {
					return;
				}
				const channel = Number($('#selMidiTestNoteOffChannel').val());
				const note = Number($('#txtMidiTestNoteOffNote').val());
				const velocity = Number($('#txtMidiTestNoteOffVelocity').val());
				sendNoteOff(output, channel, note, velocity);
				MidiTabBuilder.logActivity('send', [0x80 | channel, note & 0x7f, velocity & 0x7f], output.name+'-velocity:'+velocity);
			});

		EventBus.on('Widget:SectionStatus:statusChanged', MidiTabBuilder.onSectionStatusChanged);
		EventBus.on('Note:colored', MidiTabBuilder.onNoteColored);
		EventBus.on('UpdateAllWiringSelects', () => MidiTabBuilder.populateInstrumentPicker());
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
			midiAccess = await requestMidiAccess({ sysex: false });
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
		MidiTabBuilder.attachToInput(MidiTabBuilder.inputs[Number($('#selMidiInDevice').val()) || 0]);

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
			MidiTabBuilder.attachToInput(MidiTabBuilder.inputs[Number($('#selMidiInDevice').val()) || 0]);
		};
	}
}
