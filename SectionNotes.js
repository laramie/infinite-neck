import { SectionNotesPersistence  } from './SectionNotesPersistence.js';
import { Note } from './Note.js';

export class SectionNotes extends SectionNotesPersistence{
    constructor(obj = {}){
        super(obj, Note);
    }
}