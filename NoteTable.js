export class NoteTable {
    constructor(id){
        this.id = id;
        this.playedNotes = [];
        this.namedNotes = {};
        this.recordedNotes = {};
    }
}