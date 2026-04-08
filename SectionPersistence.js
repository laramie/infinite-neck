const sectionDefaults = {
      "caption": "",
      "rootID": "3",
      "rootIDLead": "-1",
      "beats": 4,
      "currentBeat": 1,
      "sharps": false

};

export class SectionPersistence {
    constructor(obj = {}, SectionNotes_Class) {
        this.sectionNotesByTable = {};
        Object.assign(this, sectionDefaults, obj);
        for (const [k, v] of Object.entries(obj.sectionNotesByTable||{})) {
            this.sectionNotesByTable[k] = new SectionNotes_Class(v);
        }
    }
}
