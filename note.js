export class Note {
    static STYLENUM_NAMED = 0;
    static STYLENUM_TINY = 1;
    static STYLENUM_SINGLE = 2;
    static STYLENUM_MIDIPITCHES = 3;
    static STYLENUM_MIDIPITCHESSINGLE = 4;
    static STYLENUM_BEND = 5;
    static STYLENUM_FINGERING = 6;

    constructor(noteNameOrOther, styleNum) {
        if (typeof noteNameOrOther === 'object' && noteNameOrOther !== null) {
            Object.keys(noteNameOrOther).forEach(key => {
                this[key] = noteNameOrOther[key];
            });
        } else {
            this.noteName = noteNameOrOther;
            this.styleNum = styleNum;
        }
    }

    static fromJSON(noteLike) {
        if (noteLike instanceof Note) {
            return noteLike;
        }
        if (!noteLike || typeof noteLike !== 'object') {
            return noteLike;
        }
        return new Note(noteLike);
    }

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
        return new Note(noteName, styleNum);
    }

    static cloneNote(other) {
        return Note.fromJSON(other)?.clone?.() ?? Note.fromJSON(other);
    }

    toJSON() {
        const json = {};
        Object.keys(this).forEach((key) => {
            json[key] = this[key];
        });
        return json;
    }

    clone() {
        return Note.fromJSON(this.toJSON());
    }
}


