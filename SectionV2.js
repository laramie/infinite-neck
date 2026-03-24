import { toInt } from './utils.js';
import { Note } from './note.js';
import { NoteTable } from './NoteTable.js';

const NOTE_NAMES_RAW = 'A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab'.split(',');
const NOTE_NAMES_FLATS = 'A,B<small>&#9837;</small>,B,C,D<small>&#9837;</small>,D,E<small>&#9837;</small>,E,F,G<small>&#9837;</small>,G,A<small>&#9837;</small>'.split(',');
const NOTE_NAMES_SHARPS = 'A,A<small>&#9839;</small>,B,C,C<small>&#9839;</small>,D,D<small>&#9839;</small>,E,F,F<small>&#9839;</small>,G,G<small>&#9839;</small>'.split(',');
const DEFAULT_BEATS = 4;

export class SectionV2 {
	constructor({ rootID = '3', sharps = false, beats = 4 } = {}) {
		this.noteTables = {};
		this.caption = '';
		this.rootID = rootID;
		this.rootIDLead = '-1';
		this.beats = beats;
		this.currentBeat = 1;
		this.sharps = sharps;
	}

	/**
	 * Load a SectionV2 from a section-like object in the new V2 format.
	 * Each noteTables entry is a dictionary of NoteTable objects, each with playedNotes, namedNotes, recordedNotes.
	 */
	static fromV2Format(sectionLike, { rootID = '3', sharps = false, beats = 4 } = {}) {
		const section = new SectionV2({ rootID, sharps, beats });
		section.caption = sectionLike.caption || '';
		section.rootID = sectionLike.rootID !== undefined ? sectionLike.rootID : rootID;
		section.rootIDLead = sectionLike.rootIDLead !== undefined ? sectionLike.rootIDLead : '-1';
		section.beats = sectionLike.beats !== undefined ? sectionLike.beats : beats;
		section.currentBeat = sectionLike.currentBeat !== undefined ? sectionLike.currentBeat : 1;
		section.sharps = sectionLike.sharps !== undefined ? sectionLike.sharps : sharps;

		// noteTables: { id: { playedNotes, namedNotes, recordedNotes } }
		if (sectionLike.noteTables && typeof sectionLike.noteTables === 'object') {
			Object.entries(sectionLike.noteTables).forEach(([tableID, tableObj]) => {
				const nt = new NoteTable(tableID);
				if (Array.isArray(tableObj.playedNotes)) nt.playedNotes = tableObj.playedNotes;
				if (typeof tableObj.namedNotes === 'object') nt.namedNotes = tableObj.namedNotes;
				if (typeof tableObj.recordedNotes === 'object') nt.recordedNotes = tableObj.recordedNotes;
				section.noteTables[tableID] = nt;
			});
		}
		return section;
	}

	// --- Methods below are copied from Section.js, unchanged, unless they reference namedNotes, noteTables, or recordedNotes directly ---

	getRootKey() {
		return this.noteIDToDisplayName(toInt(this.rootID, 0));
	}

	getRootKeyLead() {
		const leadKey = this.noteIDToDisplayName(toInt(this.rootIDLead, 0));
		if (!leadKey) {
			return this.noteIDToDisplayName(toInt(this.rootID, 0));
		}
		return leadKey;
	}

	getRootNoteName() {
		return NOTE_NAMES_RAW[toInt(this.rootID, 0)];
	}

	getLeadNoteName() {
		if (this.rootIDLead == '-1') {
			return NOTE_NAMES_RAW[toInt(this.rootID, 0)];
		}
		return NOTE_NAMES_RAW[toInt(this.rootIDLead, 0)];
	}

	noteIDToDisplayName(noteIndex) {
		const names = this.sharps ? NOTE_NAMES_SHARPS : NOTE_NAMES_FLATS;
		return names[noteIndex];
	}

	getBeat() {
		const beat = toInt(this.currentBeat, 1);
		this.currentBeat = beat;
		return beat;
	}

	getBeats(defaultBeats = DEFAULT_BEATS) {
		let beats = toInt(this.beats, -1);
		if (beats < 1) {
			beats = defaultBeats;
			this.beats = '' + beats;
		}
		return beats;
	}

	setBeats(newValue) {
		this.beats = newValue;
	}

	incBeat(defaultBeats = DEFAULT_BEATS) {
		let beat = this.getBeat();
		const beats = this.getBeats(defaultBeats);
		if (beat >= beats) {
			beat = beats;
			return beat;
		}
		beat++;
		this.currentBeat = beat;
		return beat;
	}

	incBeatLoop(defaultBeats = DEFAULT_BEATS) {
		let beat = this.getBeat();
		const beats = this.getBeats(defaultBeats);
		beat++;
		if (beat > beats) {
			beat = 1;
		}
		this.currentBeat = beat;
		return beat;
	}

	decBeat(defaultBeats = DEFAULT_BEATS) {
		let beat = this.getBeat();
		const beats = this.getBeats(defaultBeats);
		if (beat <= 1) {
			beat = 1;
			return beat;
		}
		beat--;
		this.currentBeat = beat;
		return beat;
	}

	gotoFirstBeat() {
		this.currentBeat = 1;
	}

	// V2: getTable returns the NoteTable object
	getTable(tableID) {
		return this.noteTables[tableID];
	}

	// V2: isEmpty checks all NoteTables for content
	isEmpty() {
		let noteCount = 0;
		Object.values(this.noteTables).forEach((nt) => {
			if (nt) {
				noteCount += (Array.isArray(nt.playedNotes) ? nt.playedNotes.length : 0);
				noteCount += Object.keys(nt.namedNotes || {}).length;
				noteCount += Object.keys(nt.recordedNotes || {}).length;
			}
		});
		return noteCount === 0;
	}

	// V2: removeEmptyTables removes NoteTables with no notes
	removeEmptyTables() {
		const compact = {};
		Object.entries(this.noteTables).forEach(([tableID, nt]) => {
			const hasNotes = (Array.isArray(nt.playedNotes) && nt.playedNotes.length > 0)
				|| (nt.namedNotes && Object.keys(nt.namedNotes).length > 0)
				|| (nt.recordedNotes && Object.keys(nt.recordedNotes).length > 0);
			if (hasNotes) {
				compact[tableID] = nt;
			}
		});
		this.noteTables = compact;
	}

	// --- Methods that reference namedNotes, noteTables, or recordedNotes directly are omitted or must be rewritten for V2 ---
}
