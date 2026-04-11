import { toInt } from './utils.js';
import { Note } from './Note.js';
import { SectionNotes } from './SectionNotes.js';
import { SectionPersistence } from './SectionPersistence.js';


const NOTE_NAMES_RAW = 'A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab'.split(',');
const NOTE_NAMES_FLATS = 'A,B<small>&#9837;</small>,B,C,D<small>&#9837;</small>,D,E<small>&#9837;</small>,E,F,G<small>&#9837;</small>,G,A<small>&#9837;</small>'.split(',');
const NOTE_NAMES_SHARPS = 'A,A<small>&#9839;</small>,B,C,C<small>&#9839;</small>,D,D<small>&#9839;</small>,E,F,F<small>&#9839;</small>,G,G<small>&#9839;</small>'.split(',');
const DEFAULT_BEATS = 4;

export class Section extends SectionPersistence {
	constructor(obj = {}) {
		super(obj, SectionNotes);
	}

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

    getBeatCount(){
        let beats = toInt(this.beats, -1); 
        if (beats>-1){
            return beats;
        }
        return -1;
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

	gotoBeat(oneBasedIndex){
		this.currentBeat = oneBasedIndex;
	}

	
	// V2: isEmpty checks all NoteTables for content
	isEmpty() {
		let noteCount = 0;
		Object.values(this.sectionNotesByTable).forEach((sn) => {
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
		Object.entries(this.sectionNotesByTable).forEach(([tableID, sn]) => {
			const hasNotes = (Array.isArray(sn.playedNotes) && sn.playedNotes.length > 0)
				|| (sn.namedNotes && Object.keys(sn.namedNotes).length > 0)
				|| (sn.recordedNotes && Object.keys(sn.recordedNotes).length > 0);
			if (hasNotes) {
				compact[tableID] = sn;
			}
		});
		this.sectionNotesByTable = compact;
	}

	// --- Methods that reference namedNotes, noteTables, or recordedNotes directly are omitted or must be rewritten for V2 ---

	moveNamedNotes(amount) {
		Object.entries(this.sectionNotesByTable).forEach(([tableID, sn]) => {
			this.moveNamedNotesForOneTable(sn, amount);
		});
	}
	moveNamedNotesForOneTable(sn, amount) {
		const namedNotes = sn.namedNotes;
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
		sn.namedNotes = namedNotesClone;
	}

	transposeRoot(amount) {
		const curr = toInt(this.rootID, 0);
		this.rootID = (12 + curr + amount) % 12;
		return this.rootID;
	}

	
	//================= New V2 Methods =========================================

	ensureSectionNotes(tableID){
		let sn = this.sectionNotesByTable[tableID];
		if (sn && !(sn instanceof SectionNotes)) {
			console.error(`sectionNotesByTable[${tableID}] is not a SectionNotes instance!`, sn);
		}
		if (!sn){
			sn = new SectionNotes();
			this.sectionNotesByTable[tableID] = sn;
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
		return Object.entries(this.sectionNotesByTable);
	}
	renameSectionNotesTableID(newTableID){
		//TODO: implement moving the tableID embedded in SectionNotes if someone renames their table/myTunings instrument.
	}

	clone(deep){
		let c = new Section(JSON.parse(JSON.stringify(this)));
		if (!deep){
			let snbt = c.getAllSectionNotes();
			snbt.forEach(([tableID, sectionNotes]) => {
				sectionNotes.emptyPlayedNotes();
				sectionNotes.emptyRecordedNotes();
			});
		}
		return c;
	}

	
}
