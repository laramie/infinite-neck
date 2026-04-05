import { makeGraveyard } from './graveyard.js';
import { Note } from './note.js';
import { Section } from './Section.js';
import { SectionNotes } from './SectionNotes.js';
import { Wiring } from './Wiring.js';

const SONG_FILE_READ_FIELDS = [
	'useSectionV2',
	'gSectionsCurrentIndex',
	'gFirstBeatSeen',
	'userInstrumentTuning',
	'gSongModelListener',
	'sharps',
	'captionsRowShowing',
	'presentationMode',
	'myTunings',
	'visibleNoteTables',
	'defaultBPM',
	'rootID',
	'namedNoteOpacity',
	'singleNoteOpacity',
	'songfileVersion',
	'activeStylesheets',
	'songName',
	'theme',
	'userTheme'
];

const SONG_FILE_WRITE_FIELDS = [
	'useSectionV2',
	'sections',
	'userInstrumentTuning',
	'sharps',
	'captionsRowShowing',
	'presentationMode',
	'wirings',
	'myTunings',
	'visibleNoteTables',
	'defaultBPM',
	'rootID',
	'namedNoteOpacity',
	'singleNoteOpacity',
	'songfileVersion',
	'graveyard',
	'activeStylesheets',
	'songName',
	'theme',
	'userTheme'
];

const OPTIONAL_SONG_WRITE_FIELDS = new Set([
	'useSectionV2',
	'visibleNoteTables',
	'userTheme'
]);

const SECTION_FILE_FIELDS = [
	'caption',
	'rootID',
	'rootIDLead',
	'beats',
	'currentBeat',
	'sharps'
];

const SECTION_COMPAT_FIELDS = [
	'noteTables',
	'namedNotes',
	'recordedNotes'
];

const OMIT_FROM_PERSISTENT_SONG_FILE = new Set([
	'userColors',
	'colorDicts',
	'fretLengths',
	'noteNamesFuncArr',
	'noteNamesFuncArrDEFAULT',
	'gSectionsCurrentIndex',
	'gFirstBeatSeen',
	'gSongModelListener',
	'randomSectionHistory',
	'isHeadless',
	'tunings'
]);

const songFileMetadata = new WeakMap();
const sectionCompatibilityMetadata = new WeakMap();

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clonePlain(value) {
	if (value instanceof Note || value instanceof Wiring) {
		return value.toJSON();
	}
	if (Array.isArray(value)) {
		return value.map((item) => clonePlain(item));
	}
	if (isPlainObject(value)) {
		const clone = {};
		Object.entries(value).forEach(([key, child]) => {
			clone[key] = clonePlain(child);
		});
		return clone;
	}
	return value;
}

function hasPersistedValue(value) {
	if (value === undefined || value === false) {
		return false;
	}
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	if (isPlainObject(value)) {
		return Object.keys(value).length > 0;
	}
	return true;
}

function buildNote(noteLike) {
	return Note.fromJSON(noteLike);
}

function buildNoteDictionary(noteDictionaryLike) {
	const noteDictionary = {};
	if (!isPlainObject(noteDictionaryLike)) {
		return noteDictionary;
	}

	Object.entries(noteDictionaryLike).forEach(([key, noteLike]) => {
		noteDictionary[key] = buildNote(noteLike);
	});
	return noteDictionary;
}

function buildRecordedNotes(recordedNotesLike) {
	const recordedNotes = {};
	if (!isPlainObject(recordedNotesLike)) {
		return recordedNotes;
	}

	Object.entries(recordedNotesLike).forEach(([beat, notesLike]) => {
		recordedNotes[beat] = Array.isArray(notesLike)
			? notesLike.map((noteLike) => buildNote(noteLike))
			: clonePlain(notesLike);
	});
	return recordedNotes;
}

function buildSectionNotes(sectionNotesLike) {
	const safeSectionNotes = isPlainObject(sectionNotesLike) ? sectionNotesLike : {};
	return new SectionNotes({
		playedNotes: Array.isArray(safeSectionNotes.playedNotes)
			? safeSectionNotes.playedNotes.map((noteLike) => buildNote(noteLike))
			: [],
		namedNotes: buildNoteDictionary(safeSectionNotes.namedNotes),
		recordedNotes: buildRecordedNotes(safeSectionNotes.recordedNotes)
	});
}

function buildSection(sectionLike) {
	const safeSection = isPlainObject(sectionLike) ? sectionLike : {};
	const section = new Section({
		rootID: safeSection.rootID !== undefined ? safeSection.rootID : '3',
		sharps: safeSection.sharps !== undefined ? safeSection.sharps : false,
		beats: safeSection.beats !== undefined ? safeSection.beats : 4
	});

	SECTION_FILE_FIELDS.forEach((fieldName) => {
		if (Object.prototype.hasOwnProperty.call(safeSection, fieldName)) {
			section[fieldName] = clonePlain(safeSection[fieldName]);
		}
	});

	section.sectionNotesByTable = {};
	if (isPlainObject(safeSection.sectionNotesByTable)) {
		Object.entries(safeSection.sectionNotesByTable).forEach(([tableID, sectionNotesLike]) => {
			section.sectionNotesByTable[tableID] = buildSectionNotes(sectionNotesLike);
		});
	}

	const compatibilityFields = {};
	SECTION_COMPAT_FIELDS.forEach((fieldName) => {
		if (Object.prototype.hasOwnProperty.call(safeSection, fieldName)) {
			compatibilityFields[fieldName] = clonePlain(safeSection[fieldName]);
		}
	});
	if (Object.keys(compatibilityFields).length > 0) {
		sectionCompatibilityMetadata.set(section, compatibilityFields);
	}

	return section;
}

function serializeNote(noteLike) {
	return noteLike instanceof Note ? noteLike.toJSON() : clonePlain(noteLike);
}

function serializeSectionNotes(sectionNotesLike) {
	const sectionNotes = sectionNotesLike instanceof SectionNotes ? sectionNotesLike : buildSectionNotes(sectionNotesLike);
	const recordedNotes = {};

	Object.entries(sectionNotes.recordedNotes || {}).forEach(([beat, notesLike]) => {
		recordedNotes[beat] = Array.isArray(notesLike)
			? notesLike.map((noteLike) => serializeNote(noteLike))
			: clonePlain(notesLike);
	});

	const namedNotes = {};
	Object.entries(sectionNotes.namedNotes || {}).forEach(([noteName, noteLike]) => {
		namedNotes[noteName] = serializeNote(noteLike);
	});

	return {
		playedNotes: Array.isArray(sectionNotes.playedNotes)
			? sectionNotes.playedNotes.map((noteLike) => serializeNote(noteLike))
			: [],
		namedNotes,
		recordedNotes
	};
}

function serializeSection(section) {
	const json = {
		sectionNotesByTable: {}
	};

	SECTION_FILE_FIELDS.forEach((fieldName) => {
		json[fieldName] = clonePlain(section[fieldName]);
	});

	Object.entries(section.sectionNotesByTable || {}).forEach(([tableID, sectionNotesLike]) => {
		json.sectionNotesByTable[tableID] = serializeSectionNotes(sectionNotesLike);
	});

	const compatibilityFields = sectionCompatibilityMetadata.get(section);
	if (compatibilityFields) {
		Object.entries(compatibilityFields).forEach(([fieldName, value]) => {
			json[fieldName] = clonePlain(value);
		});
	}

	return json;
}

export function persistenSongFileReplacer(key, value) {
	return OMIT_FROM_PERSISTENT_SONG_FILE.has(key) ? undefined : value;
}

export function hydrateSongFromFileObject(song, fileObj, { headless = false, quiet = true, fixIndex = true } = {}) {
	const safeFileObj = isPlainObject(fileObj) ? fileObj : {};
	const loadedOptionalFields = new Set();

	if (headless && typeof song.setHeadless === 'function') {
		song.setHeadless(true, quiet);
	}

	SONG_FILE_READ_FIELDS.forEach((fieldName) => {
		if (Object.prototype.hasOwnProperty.call(safeFileObj, fieldName)) {
			if (OPTIONAL_SONG_WRITE_FIELDS.has(fieldName)) {
				loadedOptionalFields.add(fieldName);
			}
			song[fieldName] = clonePlain(safeFileObj[fieldName]);
		}
	});

	song.sections = Array.isArray(safeFileObj.sections)
		? safeFileObj.sections.map((sectionLike) => buildSection(sectionLike))
		: [];

	song.wirings = Array.isArray(safeFileObj.wirings)
		? safeFileObj.wirings.map((wiringLike) => Wiring.fromJSON(wiringLike))
		: [];

	song.graveyard = makeGraveyard(isPlainObject(safeFileObj.graveyard) ? clonePlain(safeFileObj.graveyard) : undefined);
	songFileMetadata.set(song, { loadedOptionalFields });

	if (fixIndex && song.sections.length > 0 && typeof song.fixupCurrentIndexForLoadedSong === 'function') {
		song.fixupCurrentIndexForLoadedSong();
	}

	return song;
}

export function songToFileObject(song) {
	const metadata = songFileMetadata.get(song);
	const loadedOptionalFields = metadata?.loadedOptionalFields ?? new Set();
	const json = {
		sections: Array.isArray(song.sections)
			? song.sections.map((section) => serializeSection(section))
			: []
	};

	SONG_FILE_WRITE_FIELDS.forEach((fieldName) => {
		if (fieldName === 'sections') {
			return;
		}
		if (!Object.prototype.hasOwnProperty.call(song, fieldName) || song[fieldName] === undefined) {
			return;
		}
		if (OPTIONAL_SONG_WRITE_FIELDS.has(fieldName)
			&& !loadedOptionalFields.has(fieldName)
			&& !hasPersistedValue(song[fieldName])) {
			return;
		}

		if (fieldName === 'wirings') {
			json.wirings = Array.isArray(song.wirings)
				? song.wirings.map((wiringLike) => wiringLike instanceof Wiring ? wiringLike.toJSON() : clonePlain(wiringLike))
				: [];
			return;
		}

		if (fieldName === 'graveyard') {
			json.graveyard = {
				records: Array.isArray(song.graveyard?.records)
					? clonePlain(song.graveyard.records)
					: []
			};
			return;
		}

		json[fieldName] = clonePlain(song[fieldName]);
	});

	return json;
}

export function songToJSONString(song, spacing = 2) {
	return JSON.stringify(songToFileObject(song), persistenSongFileReplacer, spacing);
}

export function songFromJSONString(jsonText, { createSong, headless = false, quiet = true, fixIndex = true } = {}) {
	if (typeof createSong !== 'function') {
		throw new TypeError('songFromJSONString() requires a createSong function');
	}

	return hydrateSongFromFileObject(createSong(), JSON.parse(jsonText), {
		headless,
		quiet,
		fixIndex
	});
}
