/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 143 (midi-note-in), Iteration 3 (+ follow-up): see
// _doco/design/sprints/143-midi-note-in/143-design-3.md for the design
// discussion behind this module.
//
// Builds the "MIDI" Desktop tab: MIDI IN/OUT device pickers ported from the
// Iteration 1 standalone prototype, plus Instrument routing (NOTE ON from the
// device -> row/col or raw MIDI note -> a click on the routed Instrument's
// matching <td class="note">, and NOTE OUT of whatever notes are on for that
// Instrument, colored per the device's configured colorMap).
//
// Device config (name/mode/colorMap/orientation/tableID/channel/enabled) is
// persisted on the Song itself (song.midiDevice, normalized by
// SongPersistence.js) so it follows the Song file rather than living only in
// this module's in-memory state -- this class always reads/writes
// getSong().midiDevice directly rather than keeping its own mirrored copy.
//
// Per 143-design-3.md, NOTE OFF from the device is ignored entirely (routing
// only reacts to NOTE ON with velocity > 0); ON/OFF-flip semantics for
// individual notes remain deferred to a later iteration. MIDI OUT tracks a
// "paint plan" (Map<outNote, velocity>) of whatever should currently be lit,
// rebuilt from the routed table's namedNotes/playedNotes on two triggers:
//   - 'Widget:SectionStatus:statusChanged' (replayTable() fires this once per
//     visible table on Section navigation and every Looper beat tick) -> full
//     clear-and-repaint, but skipped entirely if the freshly computed plan is
//     identical to what's already lit (avoids visibly re-flashing the grid for
//     redundant back-to-back firings of this event for the same Section).
//   - 'Note:colored' (colorNote() fires this on every td.note click) -> a
//     targeted diff against the previous plan: only notes that were added,
//     removed, or recolored get a message, so composing on the neck doesn't
//     flash the whole grid.
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
		MidiTabBuilder.applyRoutingButtonUi();
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
	// this does the same thing for a routed device NOTE ON. NOTE OFF is
	// intentionally ignored per 143-design-3.md ("that NOTE OFF means nothing to us").
	// device.mode selects the input algorithm: 'Programmer' decodes the
	// Launchpad's row*10+col grid encoding; 'Note' treats the incoming note
	// number as a real MIDI pitch and matches it directly against the
	// Instrument's own midinum attributes (whatever device sent it).
	static handleIncomingMidiMessage(parsed, deviceName) {
		if (parsed.type === 'noteon') {
			MidiTabBuilder.showNoteOnIndicator(parsed, deviceName);
		}
		const device = MidiTabBuilder.getDevice();
		if (!device.enabled || parsed.type !== 'noteon' || !device.tableID) {
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
		colorNote(cell);
	}

	static currentOutputPort() {
		const sel = document.getElementById('selMidiOutDevice');
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
	static onNoteColored(event, data) {
		const device = MidiTabBuilder.getDevice();
		if (!device.enabled || !device.tableID || !data || data.sourceTableID !== device.tableID) {
			return;
		}
		const output = MidiTabBuilder.currentOutputPort();
		if (!output) {
			return;
		}
		const channel = device.channel || 0;
		const plan = MidiTabBuilder.buildDevicePaintPlan(device.tableID);
		if (MidiTabBuilder.lastPaintPlan && device.tableID === MidiTabBuilder.lastPaintTableID) {
			MidiTabBuilder.diffRepaint(output, channel, plan);
		} else {
			MidiTabBuilder.hardRepaint(output, channel, plan);
		}
		MidiTabBuilder.lastPaintPlan = plan;
		MidiTabBuilder.lastPaintTableID = device.tableID;
	}

	// Wipes the device's lights, then repaints whatever notes are currently on
	// for the routed Instrument in the current Section -- prevents lit buttons
	// from a previous Section (or a since-removed note) from piling up. Skips
	// entirely when the freshly computed plan is identical to what's already
	// lit, so redundant back-to-back statusChanged firings for the same
	// Section don't visibly re-flash the device.
	static clearAndRepaintDevice() {
		const device = MidiTabBuilder.getDevice();
		if (!device.enabled || !device.tableID) {
			return;
		}
		const output = MidiTabBuilder.currentOutputPort();
		if (!output) {
			return;
		}
		const plan = MidiTabBuilder.buildDevicePaintPlan(device.tableID);
		const tableChanged = device.tableID !== MidiTabBuilder.lastPaintTableID;
		if (!tableChanged && MidiTabBuilder.lastPaintPlan && MidiTabBuilder.plansAreEqual(plan, MidiTabBuilder.lastPaintPlan)) {
			return;
		}
		MidiTabBuilder.hardRepaint(output, device.channel || 0, plan);
		MidiTabBuilder.lastPaintPlan = plan;
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

	// Builds a Map<outNote, velocity> of everything that should currently be
	// lit for tableID's Section, covering BOTH data sources replayTable()
	// paints from (see NoteTableController.js replayTable()):
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
		const plan = new Map();
		if (!sectionNotes) {
			return plan;
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
            MidiTabBuilder.logActivityText('resolvedColorClass:'+resolvedColorClass+',velocity:'+velocity+',map:'+JSON.stringify(device.colorMap));
			plan.set(outNote, velocity);
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

		return plan;
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


	static applyRoutingButtonUi() {
		const enabled = MidiTabBuilder.getDevice().enabled === true;
		$('#btnMidiRouteToggle')
			.toggleClass('BtnPunchedIn', enabled)
			.toggleClass('BtnPunchedOut', !enabled)
			.text(enabled ? 'MIDI Routing On' : 'MIDI Routing');
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

	static populateDeviceSelect(selectEl, devices, preferredName = '') {
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
		if (preferredIndex < 0) {
			preferredIndex = devices.findIndex(
				(device) => device.name && device.name.includes(PREFERRED_DEVICE_NAME_SUBSTRING)
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
		MidiTabBuilder.attachToInput(MidiTabBuilder.inputs[Number($('#selMidiInDevice').val()) || 0]);

		midiAccess.onstatechange = () => {
			MidiTabBuilder.inputs = listInputs(midiAccess);
			MidiTabBuilder.outputs = listOutputs(midiAccess);
			const currentPreferredName = MidiTabBuilder.getDevice().name || '';
			MidiTabBuilder.populateDeviceSelect(document.getElementById('selMidiInDevice'), MidiTabBuilder.inputs, currentPreferredName);
			MidiTabBuilder.populateDeviceSelect(document.getElementById('selMidiOutDevice'), MidiTabBuilder.outputs, currentPreferredName);
			MidiTabBuilder.attachToInput(MidiTabBuilder.inputs[Number($('#selMidiInDevice').val()) || 0]);
		};
	}
}
