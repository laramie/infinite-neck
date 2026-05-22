import * as Constants from './Constants.js';
import { Wiring } from './Wiring.js';
import { Graveyard } from './graveyard.js';

const songDefaults = {
    activeStylesheets: "Default",
    captionsRowShowing: false,
    defaultBPM: "80",
    info: "",
    namedNoteOpacity: "1.00",
    openInfo: "none",
    presentationMode: false,
    rootID: "3",
    sharps: false,
    singleNoteOpacity: "1.00",
    tinyNoteOpacity: "1.00",
    songfileVersion: "V2",
    songName: "RoundMidnight",
    theme: "Snow",

    //run-time fields:
    isHeadless: false,
    gSectionsCurrentIndex: 0,
    gFirstBeatSeen: false,
    userInstrumentTuning: null,
    gSongModelListener: null,
    captionsRowShowing: false,

    //shared collections:
    noteNamesFuncArr: [...Constants.noteNamesFuncArrDEFAULT],
    fretLengths: Constants.calcFretLengths()    
};

export class SongPersistence {
    //TODO: add arg gSongPreferences so that colorDicts, and others can be set from preferences/template song.
    //SEE: chat conversation about what is safe/unsafe to access here: 
    //        _chat_conversations/infinite-neck/gSongPreferences-chat.md
    constructor(obj = {}, Section_Class) {
        //do these first for non-null defaults, though they may get overwritten by obj.
        this.randomSectionHistory = [];
        this.myTunings = [];
        this.visibleNoteTables = [];
        this.colorDicts = {};
        this.plugins = {};

        Object.assign(this, songDefaults, obj);

        this.sections = (obj.sections||[]).map(s => new Section_Class(s));
        this.wirings =  (obj.wirings||[]).map(w => new Wiring(w));
        this.plugins = obj.plugins && typeof obj.plugins === 'object' ? { ...obj.plugins } : {};
        this.graveyard = new Graveyard(obj.graveyard);
        this.graveyard.setSong(this);
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

}
