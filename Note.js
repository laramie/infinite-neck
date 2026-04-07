export class Note {
    static STYLENUM_NAMED = 0;
    static STYLENUM_TINY = 1;
    static STYLENUM_SINGLE = 2;
    static STYLENUM_MIDIPITCHES = 3;
    static STYLENUM_MIDIPITCHESSINGLE = 4;
    static STYLENUM_BEND = 5;
    static STYLENUM_FINGERING = 6;

    static styleNumToCaption(styleNum){
        switch(styleNum){
            case Note.STYLENUM_NAMED:
                return "Named";
            case Note.STYLENUM_TINY:
                return "Tiny";
            case Note.STYLENUM_SINGLE:
                return "Single";
            case Note.STYLENUM_MIDIPITCHES:
                return "Pitch";
            case Note.STYLENUM_MIDIPITCHESSINGLE:
                return "Multi";
            case Note.STYLENUM_BEND:
                return "Bend";
            case Note.STYLENUM_FINGERING:
                return "Fingering";
        }
        return "Unknown"+styleNum;
    }

    static newNote(noteName, styleNum) {
        let note = new Note();
        note.noteName = noteName;
        note.styleNum = styleNum;
        return note;
    }

    constructor(obj = {}){
        Object.assign(this, obj);
    }

}


