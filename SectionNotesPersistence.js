import { Note } from './Note.js';

const sectionNotesDefaults = {
    tonalSourceSet: ""
}

export class SectionNotesPersistence {
    constructor(obj = {}, Note_Class){
        this.namedNotes = {};
        this.recordedNotes = {};
        this.chord = "";
        this.mode = "";
        this.tonalSourceSet = "";
        
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

    /** Removes every playedNote and namedNote whose `owner` field matches the given owner string
     *  (same owner-tagging convention as ArpeggioPlugin/FillPlugin's generated notes). Used by MIDI
     *  Momentary mode to sweep up notes left behind when a Section change happens while a button is
     *  still held -- see templates/midi/midi.builder.js's cleanupMomentaryNotes(). No-op for a falsy
     *  owner, so it can never accidentally clear unowned (regular) notes. */
    removeNotesByOwner(owner){
        if (!owner) {
            return;
        }
        this.removePlayedNotesWhere((note) => note?.owner === owner);
        Object.entries(this.namedNotes || {}).forEach(([noteName, note]) => {
            if (note?.owner === owner) {
                this.clearNamedNote(noteName);
            }
        });
    }

    /** Removes the specific owner-tagged note(s) at ONE cell -- a namedNote by `noteName`, or
     *  playedNote(s) by `row`+`col` -- rather than every owner-tagged note in this table (see
     *  removeNotesByOwner() for the broader table-wide sweep). Used by MIDI Momentary's proactive
     *  cross-Section release handling (templates/midi/midi.builder.js): when a button-up lands in a
     *  DIFFERENT Section than its button-down (the Section changed while held, e.g. while looping),
     *  this surgically releases exactly the note THAT press created in the Section it was pressed
     *  in, without disturbing any OTHER currently-held Momentary button's note in that same (now
     *  stale) Section. No-op for a falsy owner, so it can never accidentally clear unowned notes. */
    removeOwnedNoteAtCell(owner, { noteName, row, col } = {}){
        if (!owner) {
            return;
        }
        if (noteName && this.namedNotes?.[noteName]?.owner === owner) {
            this.clearNamedNote(noteName);
        }
        if (row != null && col != null) {
            this.removePlayedNotesWhere((note) => note?.owner === owner
                && `${note?.row ?? ''}` === `${row}`
                && `${note?.col ?? ''}` === `${col}`);
        }
    }

}