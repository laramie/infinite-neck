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
    

}