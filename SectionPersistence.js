const sectionDefaults = {
      "caption": "",
      "chartChord": "",
      "chartMode": "",
    "chartPosition": "BAR",
    "chartCaptionWidth": "none",
      "rootID": "3",
      "rootIDLead": "-1",
      "beats": 4,
      "currentBeat": 1,
      "sharps": false

};

function normalizeSectionTutorial(rawTutorial) {
    if (!rawTutorial || typeof rawTutorial !== 'object' || Array.isArray(rawTutorial)) {
        return undefined;
    }
    const tutorial = {};
    if (typeof rawTutorial.caption === 'string') {
        tutorial.caption = rawTutorial.caption;
    }
    if (rawTutorial.prompt && typeof rawTutorial.prompt === 'object' && !Array.isArray(rawTutorial.prompt)) {
        const lines = Array.isArray(rawTutorial.prompt.lines)
            ? rawTutorial.prompt.lines.map((line) => `${line ?? ''}`)
            : [];
        tutorial.prompt = { lines };
    }
    return Object.keys(tutorial).length > 0 ? tutorial : undefined;
}

export class SectionPersistence {
    constructor(obj = {}, SectionNotes_Class) {
        this.sectionNotesByTable = {};
        Object.assign(this, sectionDefaults, obj);
        this.tutorial = normalizeSectionTutorial(this.tutorial);
        for (const [k, v] of Object.entries(obj.sectionNotesByTable||{})) {
            this.sectionNotesByTable[k] = new SectionNotes_Class(v);
        }
    }
}
