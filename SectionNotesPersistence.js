import { Note } from './Note.js';

const sectionNotesDefaults = {
}

export class SectionNotesPersistence {
    constructor(obj = {}, Note_Class){
        this.namedNotes = {};
        this.recordedNotes = {};
        this.chord = "";
        this.mode = "";
        
        Object.assign(this, sectionNotesDefaults, obj);

        this.playedNotes = (obj.playedNotes || []).map(n => new Note_Class(n));
        
        for (const [k, v] of Object.entries(obj.namedNotes || {})) {
            this.namedNotes[k] = new Note_Class(v);
        }
        
        for (const [k, arr] of Object.entries(obj.recordedNotes || {})) {
            this.recordedNotes[k] = (arr || []).map(n => new Note_Class(n));
        }
    }

    emptyPlayedNotes(){
        this.playedNotes = [];
    }

    emptyRecordedNotes(){
        this.recordedNotes = {}
    }

    setNamedNote(noteName, note){
        if (!note || (typeof note === 'object' && Object.keys(note).length === 0)) {
            delete this.namedNotes[noteName];
            return;
        }

        this.namedNotes[noteName] = note;
    }

    clearNamedNote(noteName){
        delete this.namedNotes[noteName];
    }

    removePlayedNotesWhere(predicate){
        const match = typeof predicate === 'function' ? predicate : () => false;
        this.playedNotes = (this.playedNotes || []).filter((note, index, notes) => !match(note, index, notes));
    }

    forEachPlayedNoteWhere(predicate, callback){
        const match = typeof predicate === 'function' ? predicate : () => false;
        const visit = typeof callback === 'function' ? callback : () => {};
        (this.playedNotes || []).forEach((note, index, notes) => {
            if (match(note, index, notes)) {
                visit(note, index, notes);
            }
        });
    }
    

}