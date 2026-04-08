import * as Constants from './Constants.js';

class Song {
    constructor() {
        this.sections = [];
        this.randomSectionHistory = [];
        this.myTunings = [];
        this.tunings = [];
        this.visibleNoteTables = [];
        this.colorDicts = {};
        this.wirings = [];
        this.graveyard = null;//new Graveyard().
        this.presentationMode = false;
        this.isHeadless = false;
        this.defaultBPM = "80";
        this.rootID = "3";
        this.gSectionsCurrentIndex = 0;
        this.namedNoteOpacity = "1.00";
        this.singleNoteOpacity = "1.00";
        this.sharps = false;
        //run-time fields:
        this.gSectionsCurrentIndex = 0;
        this.gFirstBeatSeen = false;
        this.userInstrumentTuning = null;
        this.gSongModelListener = null;
        this.captionsRowShowing = false;
        this.noteNamesFuncArr = [...Constants.noteNamesFuncArrDEFAULT];
        this.randomSectionHistory = [];
        this.fretLengths = Constants.calcFretLengths();
    }

    
    getPersistentSongFile(){
        var text = JSON.stringify(getSong(), Song.persistentSongFileReplacer, 2); // Create element. (with 2 spaces indentation)
        return text;
    }

    static fromJSON(obj) {
        const song = new Song();
        song.presentationMode = obj.presentationMode;
        song.defaultBPM = obj.defaultBPM;
        song.rootID = obj.rootID;
        song.namedNoteOpacity = obj.namedNoteOpacity;
        song.singleNoteOpacity = obj.singleNoteOpacity;
        song.sharps = obj.sharps;
        song.captionsRowShowing = obj.captionsRowShowing;
        // Add other primitive fields as needed

        if (Array.isArray(obj.sections)) {
            song.sections = obj.sections.map(sectionObj => new Section(sectionObj));
        }
        return song;
    }



}
            