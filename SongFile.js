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

    static persistentSongFileReplacer(key, value){
        if (   key === 'userColors' 
            || key === 'colorDicts' 
            || key === 'fretLengths' 
            || key === 'noteNamesFuncArr'
            || key === 'noteNamesFuncArrDEFAULT'
            || key === 'gSectionsCurrentIndex'
            || key === 'gFirstBeatSeen'
            || key === 'gSongModelListener'
            || key === 'randomSectionHistory'
            || key === 'isHeadless'
            || key === 'tunings'
            ) 
        {
            return undefined;
        }
        return value;
    }

    getPersistentSongFile(){
        this.updateMemoryModelPreFileSave();
        var text = JSON.stringify(getSong(), Song.persistentSongFileReplacer, 2); // Create element. (with 2 spaces indentation)
        return text;
    }

}
            