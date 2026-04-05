import { toInt } from './utils.js';
import { Note } from './note.js';
import { SectionNotes } from './SectionNotes.js';

const NOTE_NAMES_RAW = 'A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab'.split(',');
const NOTE_NAMES_FLATS = 'A,B<small>&#9837;</small>,B,C,D<small>&#9837;</small>,D,E<small>&#9837;</small>,E,F,G<small>&#9837;</small>,G,A<small>&#9837;</small>'.split(',');
const NOTE_NAMES_SHARPS = 'A,A<small>&#9839;</small>,B,C,C<small>&#9839;</small>,D,D<small>&#9839;</small>,E,F,F<small>&#9839;</small>,G,G<small>&#9839;</small>'.split(',');
const DEFAULT_BEATS = 4;
const INTERNAL_SECTION_KEYS = new Set([
	'_legacyDefaultTableID',
	'_legacyFallbackSectionNotes',
	'_noteTablesProxy',
	'_persistedLegacySectionData'
]);

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clonePersistedValue(value) {
	if (value?.toJSON && typeof value.toJSON === 'function') {
		return value.toJSON();
	}
	if (Array.isArray(value)) {
		return value.map((item) => clonePersistedValue(item));
	}
	if (isPlainObject(value)) {
		const clone = {};
		Object.entries(value).forEach(([key, child]) => {
			clone[key] = clonePersistedValue(child);
		});
		return clone;
	}
	return value;
}

function hasSectionNotesContent(sectionNotes) {
	if (!(sectionNotes instanceof SectionNotes)) {
		return false;
	}
	return sectionNotes.playedNotes.length > 0
		|| Object.keys(sectionNotes.namedNotes).length > 0
		|| Object.keys(sectionNotes.recordedNotes).length > 0;
}

function cloneNamedOrRecordedNotes(notesLike) {
	const safeNotes = (notesLike && typeof notesLike === 'object') ? notesLike : {};
	const clone = {};
	Object.entries(safeNotes).forEach(([key, value]) => {
		clone[key] = value instanceof Note
			? value.clone()
			: clonePersistedValue(value);
	});
	return clone;
}

export class Section {
	constructor({ rootID = '3', sharps = false, beats = 4, defaultTableID = undefined } = {}) {
		this._legacyDefaultTableID = defaultTableID;
		this._legacyFallbackSectionNotes = new SectionNotes();
		this._noteTablesProxy = null;
		this._persistedLegacySectionData = {};
		this.sectionNotesByTable = {};
		this.caption = '';
		this.rootID = rootID;
		this.rootIDLead = '-1';
		this.beats = beats;
		this.currentBeat = 1;
		this.sharps = sharps;
	}

	static fromJSON(sectionLike, {
		rootID = '3',
		sharps = false,
		beats = 4,
		defaultTableID = undefined
	} = {}) {
		if (sectionLike instanceof Section) {
			if (sectionLike._legacyDefaultTableID === undefined && defaultTableID !== undefined) {
				sectionLike._legacyDefaultTableID = defaultTableID;
			}
			return sectionLike;
		}

		const safeSection = (sectionLike && typeof sectionLike === 'object') ? sectionLike : {};
		const section = new Section({
			rootID: safeSection.rootID !== undefined ? safeSection.rootID : rootID,
			sharps: safeSection.sharps !== undefined ? safeSection.sharps : sharps,
			beats: safeSection.beats !== undefined ? safeSection.beats : beats,
			defaultTableID
		});

		['noteTables', 'namedNotes', 'recordedNotes'].forEach((key) => {
			if (Object.prototype.hasOwnProperty.call(safeSection, key)) {
				section._persistedLegacySectionData[key] = clonePersistedValue(safeSection[key]);
			}
		});

		section.caption = safeSection.caption ?? '';
		section.rootIDLead = safeSection.rootIDLead !== undefined ? safeSection.rootIDLead : '-1';
		section.currentBeat = safeSection.currentBeat !== undefined ? safeSection.currentBeat : 1;

		Object.entries(safeSection).forEach(([key, value]) => {
			if ([
				'caption',
				'rootID',
				'rootIDLead',
				'beats',
				'currentBeat',
				'sharps',
				'sectionNotesByTable',
				'noteTables',
				'namedNotes',
				'recordedNotes'
			].includes(key)) {
				return;
			}
			section[key] = clonePersistedValue(value);
		});

		if (isPlainObject(safeSection.sectionNotesByTable)) {
			Object.entries(safeSection.sectionNotesByTable).forEach(([tableID, sectionNotesLike]) => {
				section.sectionNotesByTable[tableID] = SectionNotes.fromJSON(sectionNotesLike);
				section._legacyDefaultTableID ??= tableID;
			});
		} else {
			const legacyNoteTables = isPlainObject(safeSection.noteTables) ? safeSection.noteTables : {};
			const legacyNamedNotes = isPlainObject(safeSection.namedNotes) ? safeSection.namedNotes : {};
			const legacyRecordedNotes = isPlainObject(safeSection.recordedNotes) ? safeSection.recordedNotes : {};
			const tableIDs = Object.keys(legacyNoteTables);

			if (tableIDs.length > 0) {
				tableIDs.forEach((tableID) => {
					section.sectionNotesByTable[tableID] = new SectionNotes({
						playedNotes: legacyNoteTables[tableID],
						namedNotes: legacyNamedNotes,
						recordedNotes: legacyRecordedNotes
					});
					section._legacyDefaultTableID ??= tableID;
				});
			} else {
				if (defaultTableID !== undefined && (Object.keys(legacyNamedNotes).length > 0 || Object.keys(legacyRecordedNotes).length > 0)) {
					section.sectionNotesByTable[defaultTableID] = new SectionNotes({
						playedNotes: [],
						namedNotes: legacyNamedNotes,
						recordedNotes: legacyRecordedNotes
					});
					section._legacyDefaultTableID = defaultTableID;
				} else {
					section._legacyFallbackSectionNotes = new SectionNotes({
						playedNotes: [],
						namedNotes: legacyNamedNotes,
						recordedNotes: legacyRecordedNotes
					});
				}
			}
		}

		return section;
	}

	static fromV2Format(sectionLike, options = {}) {
		return Section.fromJSON(sectionLike, options);
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

	static revive(sectionLike, options = {}) {
		return Section.fromJSON(sectionLike, options);
	}

	getPrimaryTableID() {
		const tableIDs = Object.keys(this.sectionNotesByTable);
		if (tableIDs.length > 0) {
			return tableIDs[0];
		}
		return this._legacyDefaultTableID;
	}

	get noteTables() {
		if (!this._noteTablesProxy) {
			this._noteTablesProxy = new Proxy({}, {
				get: (_target, property) => {
					if (property === 'hasOwnProperty') {
						return (key) => Object.prototype.hasOwnProperty.call(this.sectionNotesByTable, key);
					}
					if (typeof property !== 'string') {
						return undefined;
					}
					const sectionNotes = this.sectionNotesByTable[property];
					return sectionNotes ? sectionNotes.playedNotes : undefined;
				},
				set: (_target, property, value) => {
					if (typeof property !== 'string') {
						return false;
					}
					const sectionNotes = this.ensureSectionNotes(property);
					sectionNotes.playedNotes = Array.isArray(value)
						? value.map((note) => note instanceof Note ? note.clone() : clonePersistedValue(note))
						: [];
					return true;
				},
				deleteProperty: (_target, property) => {
					if (typeof property !== 'string') {
						return true;
					}
					delete this.sectionNotesByTable[property];
					return true;
				},
				has: (_target, property) => {
					return typeof property === 'string'
						&& Object.prototype.hasOwnProperty.call(this.sectionNotesByTable, property);
				},
				ownKeys: () => Object.keys(this.sectionNotesByTable),
				getOwnPropertyDescriptor: (_target, property) => {
					if (typeof property === 'string' && Object.prototype.hasOwnProperty.call(this.sectionNotesByTable, property)) {
						return {
							configurable: true,
							enumerable: true,
							writable: true,
							value: this.sectionNotesByTable[property].playedNotes
						};
					}
					return undefined;
				}
			});
		}
		return this._noteTablesProxy;
	}

	set noteTables(noteTablesLike) {
		const existingLegacyNotes = this.getLegacySectionNotes().clone();
		this.sectionNotesByTable = {};
		const safeNoteTables = isPlainObject(noteTablesLike) ? noteTablesLike : {};
		const tableIDs = Object.keys(safeNoteTables);

		if (tableIDs.length === 0) {
			this._legacyFallbackSectionNotes = existingLegacyNotes;
			return;
		}

		tableIDs.forEach((tableID, index) => {
			this.sectionNotesByTable[tableID] = new SectionNotes({
				playedNotes: safeNoteTables[tableID],
				namedNotes: index === 0 ? existingLegacyNotes.namedNotes : {},
				recordedNotes: index === 0 ? existingLegacyNotes.recordedNotes : {}
			});
			this._legacyDefaultTableID ??= tableID;
		});
	}

	get namedNotes() {
		return this.getLegacySectionNotes().namedNotes;
	}

	set namedNotes(namedNotesLike) {
		this.getLegacySectionNotes().namedNotes = cloneNamedOrRecordedNotes(namedNotesLike);
	}

	get recordedNotes() {
		return this.getLegacySectionNotes().recordedNotes;
	}

	set recordedNotes(recordedNotesLike) {
		this.getLegacySectionNotes().recordedNotes = cloneNamedOrRecordedNotes(recordedNotesLike);
	}

	getLegacySectionNotes() {
		const primaryTableID = this.getPrimaryTableID();
		if (primaryTableID && this.sectionNotesByTable[primaryTableID]) {
			return this.sectionNotesByTable[primaryTableID];
		}
		return this._legacyFallbackSectionNotes;
	}

	migrateLegacyFallbackToTable(tableID) {
		if (!tableID) {
			return;
		}
		const sectionNotes = this.sectionNotesByTable[tableID];
		if (!sectionNotes || !hasSectionNotesContent(this._legacyFallbackSectionNotes)) {
			return;
		}
		if (!hasSectionNotesContent(sectionNotes)) {
			sectionNotes.playedNotes = this._legacyFallbackSectionNotes.playedNotes;
			sectionNotes.namedNotes = this._legacyFallbackSectionNotes.namedNotes;
			sectionNotes.recordedNotes = this._legacyFallbackSectionNotes.recordedNotes;
		}
		this._legacyFallbackSectionNotes = new SectionNotes();
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
			this._legacyDefaultTableID ??= tableID;
			this.migrateLegacyFallbackToTable(tableID);
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
	getSectionNotesDisplayData() {
		const namedNotes = new Set();
		const playedNotes = [];
		const recordedNotes = [];

		this.getAllSectionNotes().forEach(([tableID, sn]) => {
			Object.keys(sn?.namedNotes || {}).forEach((noteName) => {
				namedNotes.add(noteName);
			});

			const playedCount = Array.isArray(sn?.playedNotes) ? sn.playedNotes.length : 0;
			if (playedCount > 0) {
				playedNotes.push(`${tableID}:${playedCount}`);
			}

			const recordedCount = Object.values(sn?.recordedNotes || {}).reduce((count, notesForBeat) => {
				return count + (Array.isArray(notesForBeat) ? notesForBeat.length : 0);
			}, 0);
			if (recordedCount > 0) {
				recordedNotes.push(`${tableID}:${recordedCount}`);
			}
		});

		return {
			namedNotes: Array.from(namedNotes).sort((left, right) => left.localeCompare(right)),
			playedNotes,
			recordedNotes
		};
	}

	getSectionNotesDisplayString() {
		const details = this.getSectionNotesDisplayData();
		return [
			'{',
			`    namedNotes: ${JSON.stringify(details.namedNotes)},`,
			`    playedNotes: ${JSON.stringify(details.playedNotes)},`,
			`    recordedNotes: ${JSON.stringify(details.recordedNotes)}`,
			'}'
		].join('\n');
	}
	getAllSectionNotes() {
		// Returns an array of [tableID, SectionNotes] pairs, so you can .forEach(([tableID, sn]) => ...)
		return Object.entries(this.sectionNotesByTable);
	}
	renameSectionNotesTableID(newTableID){
		//TODO: implement moving the tableID embedded in SectionNotes if someone renames their table/myTunings instrument.
	}

	toJSON() {
		const sectionNotesByTable = {};
		Object.entries(this.sectionNotesByTable).forEach(([tableID, sectionNotes]) => {
			sectionNotesByTable[tableID] = SectionNotes.fromJSON(sectionNotes).toJSON();
		});

		if (Object.keys(sectionNotesByTable).length === 0 && hasSectionNotesContent(this._legacyFallbackSectionNotes)) {
			const fallbackTableID = this._legacyDefaultTableID;
			if (fallbackTableID) {
				sectionNotesByTable[fallbackTableID] = this._legacyFallbackSectionNotes.toJSON();
			}
		}

		const json = {
			caption: this.caption,
			rootID: this.rootID,
			rootIDLead: this.rootIDLead,
			beats: this.beats,
			currentBeat: this.currentBeat,
			sharps: this.sharps,
			sectionNotesByTable
		};

		Object.keys(this).forEach((key) => {
			if ([
				'caption',
				'rootID',
				'rootIDLead',
				'beats',
				'currentBeat',
				'sharps',
				'sectionNotesByTable'
			].includes(key) || INTERNAL_SECTION_KEYS.has(key)) {
				return;
			}
			json[key] = clonePersistedValue(this[key]);
		});

		Object.entries(this._persistedLegacySectionData).forEach(([key, value]) => {
			json[key] = clonePersistedValue(value);
		});

		return json;
	}

	clone({ deep = true } = {}) {
		if (deep) {
			return Section.fromJSON(this.toJSON(), {
				defaultTableID: this._legacyDefaultTableID
			});
		}

		const clone = new Section({
			rootID: this.rootID,
			sharps: this.sharps,
			beats: this.beats,
			defaultTableID: this._legacyDefaultTableID
		});
		clone.caption = this.caption;
		clone.rootIDLead = this.rootIDLead;
		clone.currentBeat = 1;

		Object.keys(this).forEach((key) => {
			if ([
				'caption',
				'rootID',
				'rootIDLead',
				'beats',
				'currentBeat',
				'sharps',
				'sectionNotesByTable'
			].includes(key) || INTERNAL_SECTION_KEYS.has(key)) {
				return;
			}
			clone[key] = clonePersistedValue(this[key]);
		});

		clone.namedNotes = cloneNamedOrRecordedNotes(this.namedNotes);
		return clone;
	}

	populateCloneFrom(sectionLike, { deep = true } = {}) {
		const source = Section.fromJSON(sectionLike, {
			defaultTableID: this._legacyDefaultTableID
		});
		const clone = source.clone({ deep });

		Object.keys(this).forEach((key) => {
			delete this[key];
		});
		Object.assign(this, clone);
	}

	
}
