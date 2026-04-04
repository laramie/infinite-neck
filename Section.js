import { toInt } from './utils.js';
import { Note } from './note.js';

const NOTE_NAMES_RAW = 'A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab'.split(',');
const NOTE_NAMES_FLATS = 'A,B<small>&#9837;</small>,B,C,D<small>&#9837;</small>,D,E<small>&#9837;</small>,E,F,G<small>&#9837;</small>,G,A<small>&#9837;</small>'.split(',');
const NOTE_NAMES_SHARPS = 'A,A<small>&#9839;</small>,B,C,C<small>&#9839;</small>,D,D<small>&#9839;</small>,E,F,F<small>&#9839;</small>,G,G<small>&#9839;</small>'.split(',');
const DEFAULT_BEATS = 4;

export class Section {
    constructor({ rootID = '3', sharps = false, beats = 4 } = {}) {
        this.noteTables = {};
        this.namedNotes = {};
        this.recordedNotes = {};
        this.caption = '';
        this.rootID = rootID;
        this.rootIDLead = '-1';
        this.beats = beats;
        this.currentBeat = 1;
        this.sharps = sharps;
    }

    cloneFrom(other) {
        this.noteTables = other.noteTables;
        this.namedNotes = other.namedNotes;
        this.recordedNotes = other.recordedNotes;
        this.caption = other.caption;
        this.rootID = other.rootID;
        this.rootIDLead = other.rootIDLead;
        this.beatsPer = other.beatsPer;
        this.beats = other.beats;
        this.currentBeat = other.currentBeat;
        this.sharps = other.sharps;
        this.noteNamesFuncArr = other.noteNamesFuncArr;
    }

    populateCloneFrom(sourceSection, { deep = false } = {}) {
        this.rootID = sourceSection.rootID;
        this.rootIDLead = sourceSection.rootIDLead;
        this.caption = sourceSection.caption;
        this.beats = sourceSection.beats;
        this.currentBeat = 1;
        this.namedNotes = JSON.parse(JSON.stringify(sourceSection.namedNotes || {}));

        if (deep) {
            this.noteTables = JSON.parse(JSON.stringify(sourceSection.noteTables || {}));
            this.recordedNotes = JSON.parse(JSON.stringify(sourceSection.recordedNotes || {}));
        } else {
            this.noteTables = {};
            this.recordedNotes = {};
        }

        return this;
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

    getTableArr(tableID) {
        let tableArr = this.noteTables[tableID];
        if (!tableArr) {
            this.noteTables[tableID] = [];
            tableArr = this.noteTables[tableID];
        }
        return tableArr;
    }

    isEmpty() {
        let namedNoteCount = 0;
        let tableCount = 0;

        Object.keys(this.namedNotes).forEach(() => {
            namedNoteCount++;
        });

        Object.keys(this.noteTables).forEach((tableName) => {
            const tableArr = this.noteTables[tableName];
            tableCount += tableArr.length;
        });

        return (tableCount + namedNoteCount) == 0;
    }

    removeEmptyTables() {
        const compact = {};
        Object.entries(this.noteTables).forEach(([tableName, tableArr]) => {
            if (tableArr && tableArr.length && tableArr.length > 0) {
                compact[tableName] = tableArr;
            }
        });
        this.noteTables = compact;
    }

    moveNamedNotes(amount) {
        const namedNotesClone = {};
        const namedNotes = this.namedNotes;

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
        //callers should call this afterwards: this.getRootNoteName();
    }

    transposeRoot(amount) {
        const curr = toInt(this.rootID, 0);
        this.rootID = (12 + curr + amount) % 12;
        return this.rootID;
    }

    static revive(sectionLike, { rootID = '3', sharps = false, beats = 4 } = {}) {
        const section = (sectionLike && typeof sectionLike === 'object') ? sectionLike : {};

        Object.setPrototypeOf(section, Section.prototype);

        if (!section.noteTables || typeof section.noteTables !== 'object') section.noteTables = {};
        if (!section.namedNotes || typeof section.namedNotes !== 'object') section.namedNotes = {};
        if (!section.recordedNotes || typeof section.recordedNotes !== 'object') section.recordedNotes = {};
        if (section.caption === undefined) section.caption = '';
        if (section.rootID === undefined) section.rootID = rootID;
        if (section.rootIDLead === undefined) section.rootIDLead = '-1';
        if (section.beats === undefined) section.beats = beats;
        if (section.currentBeat === undefined) section.currentBeat = 1;
        if (section.sharps === undefined) section.sharps = sharps;

        return section;
    }
}
