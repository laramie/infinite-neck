import { toInt } from './utils.js';
import { Note } from './note.js';
import { SectionNotes } from './SectionNotes.js';

const NOTE_NAMES_RAW = 'A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab'.split(',');
const NOTE_NAMES_FLATS = 'A,B<small>&#9837;</small>,B,C,D<small>&#9837;</small>,D,E<small>&#9837;</small>,E,F,G<small>&#9837;</small>,G,A<small>&#9837;</small>'.split(',');
const NOTE_NAMES_SHARPS = 'A,A<small>&#9839;</small>,B,C,C<small>&#9839;</small>,D,D<small>&#9839;</small>,E,F,F<small>&#9839;</small>,G,G<small>&#9839;</small>'.split(',');
const DEFAULT_BEATS = 4;

export class SectionV2 {
	constructor({ rootID = '3', sharps = false, beats = 4 } = {}) {
		this.sectionNotesDict = {};
		this.caption = '';
		this.rootID = rootID;
		this.rootIDLead = '-1';
		this.beats = beats;
		this.currentBeat = 1;
		this.sharps = sharps;
	}

	/**
	 * Load a SectionV2 from a section-like object in the new V2 format.
	 * Each sectionNotesDict entry is a dictionary of NoteTable objects, each with playedNotes, namedNotes, recordedNotes.
	 */
	static fromV2Format(sectionLike, { rootID = '3', sharps = false, beats = 4 } = {}) {
		const section = new SectionV2({ rootID, sharps, beats });
		section.caption = sectionLike.caption || '';
		section.rootID = sectionLike.rootID !== undefined ? sectionLike.rootID : rootID;
		section.rootIDLead = sectionLike.rootIDLead !== undefined ? sectionLike.rootIDLead : '-1';
		section.beats = sectionLike.beats !== undefined ? sectionLike.beats : beats;
		section.currentBeat = sectionLike.currentBeat !== undefined ? sectionLike.currentBeat : 1;
		section.sharps = sectionLike.sharps !== undefined ? sectionLike.sharps : sharps;

		// sectionNotesDict: { id: { playedNotes, namedNotes, recordedNotes } }
		if (sectionLike.sectionNotesDict && typeof sectionLike.sectionNotesDict === 'object') {
			Object.entries(sectionLike.sectionNotesDict).forEach(([tableID, sectionNotesObj]) => {
				const sn = new SectionNotes();
				if (Array.isArray(sectionNotesObj.playedNotes)) sn.playedNotes = sectionNotesObj.playedNotes;
				if (typeof sectionNotesObj.namedNotes === 'object') sn.namedNotes = sectionNotesObj.namedNotes;
				if (typeof sectionNotesObj.recordedNotes === 'object') sn.recordedNotes = sectionNotesObj.recordedNotes;
				section.sectionNotesDict[tableID] = sn;
				if (!(sn instanceof SectionNotes)) {
					console.error(`sectionNotesDict[${tableID}] is not a SectionNotes instance!`, sn);
				}
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

	
	// V2: isEmpty checks all NoteTables for content
	isEmpty() {
		let noteCount = 0;
		Object.values(this.sectionNotesDict).forEach((sn) => {
			if (sn) {
				noteCount += (Array.isArray(sn.playedNotes) ? sn.playedNotes.length : 0);
				noteCount += Object.keys(sn.namedNotes || {}).length;
				noteCount += Object.keys(sn.recordedNotes || {}).length;
			}
		});
		return noteCount === 0;
	}

	// V2: removeEmptyTables removes NoteTables with no notes
	removeEmptyTables() {
		const compact = {};
		Object.entries(this.sectionNotesDict).forEach(([tableID, sn]) => {
			const hasNotes = (Array.isArray(sn.playedNotes) && sn.playedNotes.length > 0)
				|| (sn.namedNotes && Object.keys(sn.namedNotes).length > 0)
				|| (sn.recordedNotes && Object.keys(sn.recordedNotes).length > 0);
			if (hasNotes) {
				compact[tableID] = sn;
			}
		});
		this.sectionNotesDict = compact;
	}

	// --- Methods that reference namedNotes, noteTables, or recordedNotes directly are omitted or must be rewritten for V2 ---

	moveNamedNotes(amount) {
		Object.entries(this.sectionNotesDict).forEach(([tableID, sn]) => {
			const namedNotes = sn.namedNotes;
			this.moveNamedNotesForOneTable(namedNotes, amount);
		});
	}
	moveNamedNotesForOneTable(namedNotes, amount) {
		const namedNotesClone = {};
		Object.keys(namedNotes).forEach((noteName) => {
			let index = NOTE_NAMES_RAW.indexOf(noteName);
			index = (12 + index + amount) % 12;
			const transposedNoteName = NOTE_NAMES_RAW[index];
			const otherNote = namedNotes[noteName];

			if (otherNote.colorClass) {
				const clonedNote = Note.cloneNote(otherNote);
				clonedNote.noteName = transposedNoteName;
				namedNotesClone[transposedNoteName] = clonedNote;
			}
		});
		this.namedNotes = namedNotesClone;
	}

	transposeRoot(amount) {
		const curr = toInt(this.rootID, 0);
		this.rootID = (12 + curr + amount) % 12;
		return this.rootID;
	}


	static revive(sectionLike, { rootID = '3', sharps = false, beats = 4 } = {}) {
		const section = (sectionLike && typeof sectionLike === 'object') ? sectionLike : {};

		Object.setPrototypeOf(section, SectionV2.prototype);

		// V2: initialize sectionNotesDict from legacy noteTables if present, otherwise empty
		if (!section.sectionNotesDict || typeof section.sectionNotesDict !== 'object') {
			section.sectionNotesDict = {};
		}

		if (section.caption === undefined) section.caption = '';
		if (section.rootID === undefined) section.rootID = rootID;
		if (section.rootIDLead === undefined) section.rootIDLead = '-1';
		if (section.beats === undefined) section.beats = beats;
		if (section.currentBeat === undefined) section.currentBeat = 1;
		if (section.sharps === undefined) section.sharps = sharps;

		return section;
	}


	//================= New V2 Methods =========================================

	ensureSectionNotes(tableID){
		let sn = this.sectionNotesDict[tableID];
		if (sn && !(sn instanceof SectionNotes)) {
			console.error(`sectionNotesDict[${tableID}] is not a SectionNotes instance!`, sn);
		}
		if (!sn){
			sn = new SectionNotes();
			this.sectionNotesDict[tableID] = sn;
		}
		return sn;
	}

	getTableArr(tableID) {
        let sn = this.ensureSectionNotes(tableID);
		return sn.playedNotes;
    }

	getSectionNotes(tableID) {
		const sn = this.ensureSectionNotes(tableID);
		if (!(sn instanceof SectionNotes)) {
			console.error(`getSectionNotes(${tableID}) did not return a SectionNotes instance!`, sn);
		}
		return sn;
	}
	getAllSectionNotes() {
		// Returns an array of [tableID, SectionNotes] pairs, so you can .forEach(([tableID, sn]) => ...)
		return Object.entries(this.sectionNotesDict);
	}
	renameSectionNotesTableID(newTableID){
		//TODO: implement moving the tableID embedded in SectionNotes if someone renames their table/myTunings instrument.
	}

	
}
