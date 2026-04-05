import { Note } from './note.js';

function cloneNoteValue(value) {
    if (value instanceof Note) {
        return value.clone();
    }
    if (Array.isArray(value)) {
        return value.map((item) => cloneNoteValue(item));
    }
    if (value && typeof value === 'object') {
        return Note.fromJSON(value);
    }
    return value;
}

function cloneNoteDictionary(dictionary) {
    const safeDictionary = (dictionary && typeof dictionary === 'object') ? dictionary : {};
    const clone = {};
    Object.entries(safeDictionary).forEach(([key, value]) => {
        clone[key] = cloneNoteValue(value);
    });
    return clone;
}

export class SectionNotes {
    constructor({ playedNotes = [], namedNotes = {}, recordedNotes = {} } = {}){
        this.playedNotes = Array.isArray(playedNotes)
            ? playedNotes.map((note) => cloneNoteValue(note))
            : [];
        this.namedNotes = cloneNoteDictionary(namedNotes);
        this.recordedNotes = cloneNoteDictionary(recordedNotes);
    }

    static fromJSON(sectionNotesLike) {
        if (sectionNotesLike instanceof SectionNotes) {
            return sectionNotesLike;
        }
        const safeSectionNotes = (sectionNotesLike && typeof sectionNotesLike === 'object')
            ? sectionNotesLike
            : {};

        return new SectionNotes({
            playedNotes: safeSectionNotes.playedNotes,
            namedNotes: safeSectionNotes.namedNotes,
            recordedNotes: safeSectionNotes.recordedNotes
        });
    }

    toJSON() {
        const recordedNotes = {};
        Object.entries(this.recordedNotes || {}).forEach(([beat, notes]) => {
            recordedNotes[beat] = Array.isArray(notes)
                ? notes.map((note) => note?.toJSON ? note.toJSON() : cloneNoteValue(note))
                : cloneNoteValue(notes);
        });

        const namedNotes = {};
        Object.entries(this.namedNotes || {}).forEach(([noteName, note]) => {
            namedNotes[noteName] = note?.toJSON ? note.toJSON() : cloneNoteValue(note);
        });

        return {
            playedNotes: Array.isArray(this.playedNotes)
                ? this.playedNotes.map((note) => note?.toJSON ? note.toJSON() : cloneNoteValue(note))
                : [],
            namedNotes,
            recordedNotes
        };
    }

    clone() {
        return SectionNotes.fromJSON(this.toJSON());
    }
}