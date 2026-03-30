import * as Constants from './Constants.js';
import EventBus from './event-bus.js';
import {
    GraveType
} from './graveyard.js';
import {
    getRecordedNotesForSection
} from './section-recorder.js';
import {
	toInt
} from './utils.js';
import { ANSIColors } from './bin/ANSIColors.js';
import { Section } from './Section.js';
import { SectionV2 } from './SectionV2.js';
import { SectionNotes } from './SectionNotes.js';
import { Wiring } from './Wiring.js';

const DEFAULT_BEATS = 4;
const RANDOM_SECTION_HISTORY_MAX = 16;
export const constNoteNamesArr = "A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab".split(',');

export function noteNameToNoteID(noteName) {
    return constNoteNamesArr.indexOf(noteName);
}

export class Song {
    constructor({ fileObj = null, legacy = true, headless = false, quiet = true, fixIndex = false } = {}) {
        if (legacy) {
            this._initLegacy();
        } else if (fileObj) {
            this._initFromData(fileObj, { headless, quiet, fixIndex });
        } else {
            this._initLegacy();
        }
    }

    _initLegacy() {
        this.useSectionV2 = false;
        this.sections = null;
        this.gSectionsCurrentIndex = 0;
        this.gFirstBeatSeen = false;
        this.userInstrumentTuning = null;
        this.gSongModelListener = null;
        this.noteNamesFuncArrDEFAULT = [
            "I", // 1 - I    I
            "&tau;", //"&tau;", // 2 - Tau    was: "&#x1D70F;"
            "II", // 3 - II
            "m", // 4 - m
            "III", // 5 - 3
            "IV", // 6 - IV
            "&Theta;", // 7 - Tri
            "V", // 8 - V
            "&sigma;", // 9 - Sigma
            "6", // 10 - VI
            "&delta;", // 11 - dom
            "&Delta;" // 12 - I
        ];

        this.noteNamesFuncArr = [...this.noteNamesFuncArrDEFAULT];
        this.sharps = false;
        this.captionsRowShowing = false;
        this.fretLengths = (() => {
            var width = 60;
            var L0 = 1;
            const MAGIC_RATIO = 0.9438743;
            const FIRSTFRET_LENGTH = 0.05297;
            const fretLengths = [];
            for (var n = 2; n <= Constants.NUM_FRETS_MAX + 1; n++) {
                var Cn = (Math.pow(MAGIC_RATIO, n));
                var Cnm1 = (Math.pow(MAGIC_RATIO, (n - 1)));
                var R = (L0 * (1 - Cn) - L0 * (1 - Cnm1)) / FIRSTFRET_LENGTH;
                fretLengths.push(R);
            }
            return fretLengths;
        })();
        this.presentationMode = false;
        this.constructing = false;
        this.randomSectionHistory = [];
        this.wirings = [];
        this.make();
    }

    _initFromData(fileObj, { headless = true, quiet = true, fixIndex = true } = {}) {
        this._initLegacy();
        if (headless) {
            this.setHeadless(true, quiet);
        }
        if (fileObj && Array.isArray(fileObj.sections)) {
            this.addSections(fileObj);
            if (fixIndex) {
                this.fixupCurrentIndexForLoadedSong();
            }
        }
    }

    // --- Methods from makeSongLegacy ---
    make() { this.construct_gSections(); }
    construct_gSections() { this.initializeSongState(); }
    initializeSongState() {
        this.constructing = true;
        this.isHeadless = false;
        this.sections = [];
        this.randomSectionHistory = [];
        this.myTunings = [];
        this.tunings = [];
        this.visibleNoteTables = [];
        this.colorDicts = {};
        this.defaultBPM = "80";
        this.rootID = "3";
        this.gSectionsCurrentIndex = this.addSection(this.constructSection());
        this.namedNoteOpacity = "1.00";
        this.singleNoteOpacity = "1.00";
        this.constructing = false;
        delete this.constructing;
    }
    setHeadless(value, quiet = false) {
        this.isHeadless = value;
        if (this.isHeadless) {
            if (!quiet) console.log(ANSIColors.Bold + ANSIColors.cyan("Song running in Headless mode.  No $ or jQuery calls supported."));
            return;
        }
    }
    setSongfileVersion(version){
        if (version==="V2"){
            this.useSectionV2 = true;
        }
        this.songfileVersion = version;
    }
    
    dump(full) {
        const OMIT_WHEN_TERSE = new Set([
            'noteNamesFuncArrDEFAULT',
            'noteNamesFuncArr',
            'fretLengths',
            'colorDicts',
            'myTunings'
        ]);

        function replacer(key, value) {
            if (!full && OMIT_WHEN_TERSE.has(key)) {
                return undefined;
            }
            return value;
        }

        let res = JSON.stringify(this, replacer, 4);
        return res;
    }
    
    getVisibleTunings(){
        const visibleTableIds = this.myTunings
            .filter(t => $(`#${Constants.TABLEDIV_ID_PREFIX}${t.baseID}`).is(':visible'))
            .map(t => Constants.TABLE_ID_PREFIX + t.baseID);
        return visibleTableIds;    
    }
    getVisibleTuningIDs(){
        const visibleTuningIDs = this.myTunings
            .filter(t => $(`#${Constants.TABLEDIV_ID_PREFIX}${t.baseID}`).is(':visible'))
            .map(t => t.baseID);
        return visibleTuningIDs;    
    }
    addWiring(tablename, relativeSection, listenToTablename) {
        const idx = this.wirings.findIndex(w => w.tablename === tablename);
        const newWiring = new Wiring(tablename, relativeSection, listenToTablename);
        if (idx === -1) {
            this.wirings.push(newWiring);
        } else {
            this.wirings[idx] = newWiring;
        }
    }
    removeWiring(tablename){
        this.wirings = this.wirings.filter(w => w.tablename !== tablename);
    }
    fixupCurrentIndexForLoadedSong() {
        var sci = this.gSectionsCurrentIndex;
        if (this.gSectionsCurrentIndex >= this.sections.length) {
            this.gSectionsCurrentIndex = this.sections.length - 1;
            console.warn("gSong::fixupCurrentIndexForLoadedSong() found that the song gSectionsCurrentIndex was out of range: " + sci + " resetting to : " + this.gSectionsCurrentIndex);
        }
        if (this.gSectionsCurrentIndex < 0) {
            this.gSectionsCurrentIndex = 0;
            console.warn("gSong::fixupCurrentIndexForLoadedSong() found that the song gSectionsCurrentIndex was out of range: " + sci);
        }
    }
    getCurrentSection() {
        const section = this.sections[this.gSectionsCurrentIndex];
        return this.normalizeSection(section);
    }

    // ==========  Utility methods ==========
    noteIDToNoteName(noteIndex) {
        return this.getCurrentSection().noteIDToDisplayName(noteIndex);
    }
    noteIDToNoteNameRaw(noteIndex) {
        return constNoteNamesArr[noteIndex];
    }
    noteNameToNoteID(noteName) {
        return constNoteNamesArr.indexOf(noteName);
    }

    // =========== wrapping ==================

    test_getRelativeSectionWithWrap(consoleLog = false){
        const testResult = {
            warnings: [],
            infos: [],
            terse: []
        };

        const test = (sAmount) => {
            allSections.forEach((section, idx) => {
                this.gotoSection(idx);
                let resultSection = this.getRelativeSectionWithWrap(sAmount, testResult.warnings);
                let resultIdx = this.sections.indexOf(resultSection);
                let message = "test-relative: sections[" + idx + "] by   "
                               + String(sAmount).padStart(4, ' ')  
                               + " ==> sections["+resultIdx+"] ::"
                               +" key:" + String(this.noteIDToNoteNameRaw(resultSection.rootID)).padEnd(3, ' ') 
                               + " caption:" + resultSection.caption;
                let terseMessage = "[" + idx + "] " + String(sAmount).padStart(4, ' ')  + " ==> ["+resultIdx+"]"              
                if (consoleLog) {
                    console.log(message);
                }
                testResult.terse.push(terseMessage);
                testResult.infos.push(message);
            });
        }
        let allSections = this.getSections();
        testResult.infos.push("This song has "+allSections.length+" sections.  Tests will be applied to each.");
        test("-2");
        test("-1");
        test("-0");
        test("0");
        test("1");
        test("2");
        test("3");
        test("+0");
        test("+1");
        test("+2");
        test("+3");
        test("@2");
        test("@1");
        test("@0");
        test("@-0");
        test("@-1");
        test("^0");
        test("^1");
        test("^2");
        test("^-1");
        test("^+1");
        test("&-1");
        test("&-0");
        test("&0");
        test("&1");
        test("&2");
        test("&3");
        test("&4");
        test("&-1");
        test("&+1");
        test("foo");
        test("+foo");
        test("-foo");
        test("+");
        test("-");
        test("");
        return testResult;
    }

    /*   Support
     *   +3   3 sections ahead, with wrap
     *   -3   3 sections back, with wrap
     *   -1   previous section, with wrap
     *   +1   next section, with wrap
     *   -0   current section
     *   +0   current section
     *    0   first section
     *    1   Section 1 absolute (there always must be one section)
     *    2   Section 2 absolute, or last if num too large
     *    @1  Last section played in Random mode
     *    @2  Two sections ago played in Random mode
     *    ^1  previous section, no wrap, just go as early as you can, max is Section 1
     *    ^-1 ignore sign, just do ^1
     *    ^+1 ignore sign, just do ^1
     *    ^2  2 sections back, no wrap, just go as early as you can, max is Section 1
     *    &1  1 section ahead, no wrap, max is last Section
     *    &2  2 sections ahead, no wrap, max is last Section
     *    &-2 ignore sign, just do &2
     *    &+2 ignore sign, just do &2
     * 
     *    Negative signs after the first character are ignored, so @-1 is the same as @1, and --1 is the same as -1.
     *     So you can go "back" with -1 or ^1 or @1, and --1, ^-1, and @-1 are identical, respectively.
    */
    getRelativeSectionWithWrap(sAmount, logCollector = null) {
        const Direction = Object.freeze({
            FORWARD:         '+',
            BACKWARD:        '-',
            ABSOLUTE:        'A',
            PREVIOUS_PLAYED: '@',  // legal values for full string: "@-2" or "@2" or "@+2"
            BACKWARD_NOWRAP: '^',  // legal values: ^1 ^2  go backwards.  No minus sign.
            FORWARD_NOWRAP:  '&',  // legal value: &1 &2 go forwards. No minus signs.
            BAD_INPUT:       'X',
            EMPTY:           'E'
        });

        if (sAmount && sAmount[0]){

            if (sAmount === "0") {
                return this.sections[0];
            }
            if (sAmount === "+0" || sAmount === "-0") {
                return this.sections[this.gSectionsCurrentIndex];
            }
            // Extract firstChar if present
            const match = sAmount.match(/^([+\-@^&])([-+]?\d+)/);
            let firstChar = null;
            let intNum = 0;
            let isnum = false;
            if (match) {
                firstChar = match[1];
                // Try to parse the integer part
                intNum = Math.abs(parseInt(match[2], 10));
                isnum = /^[-+]?\d+$/.test(match[2]);
                if (!isnum){
                    firstChar = Direction.BAD_INPUT;
                }
            } else {
                // If no special char, check for pure integer
                if (/^[-+]?\d+$/.test(sAmount)) {
                    firstChar = Direction.ABSOLUTE;
                    intNum = Math.abs(parseInt(sAmount, 10));  //deal with the illegal --2.
                    isnum = true;
                } else {
                    // Malformed input: neither special char nor integer
                    firstChar = Direction.BAD_INPUT;
                    intNum = 0;
                    isnum = false;
                    const msg = "Malformed section amount: " + sAmount;
                    if (logCollector) {
                        logCollector.push(msg);
                    } else {
                        console.warn(msg);
                    }
                }
            }

            
            var currentIndex = this.gSectionsCurrentIndex;
            function wrap(oneBasedDistance, sectionsArray, currentZeroBasedIndex){
                const n = sectionsArray.length;
                const wrappedIndex = ((currentZeroBasedIndex + oneBasedDistance) % n + n) % n;
                return wrappedIndex;
            }

            if (intNum === 0){
                firstChar = Direction.BAD_INPUT;
            }

            if ((firstChar === Direction.FORWARD || firstChar === Direction.BACKWARD) && intNum === 0) {
                firstChar = Direction.ABSOLUTE;
                intNum = 1;
            }

            switch (firstChar){
                case Direction.BAD_INPUT:
                case Direction.EMPTY:
                    return this.sections[currentIndex];
                case Direction.ABSOLUTE: //(number only, goto num or max)
                    if (intNum < 1) {
                        return this.sections[0];
                    }
                    if (intNum > this.sections.length){
                        return this.sections[this.sections.length-1];                           
                    }
                    return this.sections[intNum-1];
                case Direction.PREVIOUS_PLAYED:  //(@) sections back in random-play history
                    if (intNum < 1) {
                        return this.sections[currentIndex];
                    }
                    return this.sections[this.getPreviousPlayedSectionIndex(intNum, currentIndex)];
                case Direction.FORWARD: // (+)
                    var wrappedIndex = wrap(intNum, this.sections, currentIndex);
                    return this.sections[wrappedIndex];
                case Direction.BACKWARD: //(-)
                    var wrappedIndex = wrap( -1 * intNum, this.sections, currentIndex);
                    return this.sections[wrappedIndex];
                case Direction.BACKWARD_NOWRAP:  //(^)
                    return this.sections[Math.max(0, (currentIndex - Math.abs(intNum)))];
                case Direction.FORWARD_NOWRAP:   //(&)
                    var idx = (currentIndex + Math.abs(intNum))
                    var maxidx = this.sections.length-1;
                    return this.sections[(idx > maxidx) ? maxidx : idx];
            }
        } else {
            return this.getCurrentSection();        
        }
    }
    pushRandomSectionHistory(idx){
        if (!Array.isArray(this.randomSectionHistory)){
            this.randomSectionHistory = [];
        }
        if (!Number.isInteger(idx)){
            return;
        }
        if (idx < 0 || idx >= this.sections.length){
            return;
        }
        this.randomSectionHistory.push(idx);
        if (this.randomSectionHistory.length > RANDOM_SECTION_HISTORY_MAX){
            this.randomSectionHistory.splice(0, this.randomSectionHistory.length - RANDOM_SECTION_HISTORY_MAX);
        }
    }

    getPreviousPlayedSectionIndex(nBack, fallbackIndex){
        if (!Array.isArray(this.randomSectionHistory) || this.randomSectionHistory.length === 0){
            return fallbackIndex;
        }
        const safeBack = Math.max(1, Math.abs(toInt(nBack, 1)));
        const historyPos = Math.max(0, this.randomSectionHistory.length - safeBack);
        const idx = this.randomSectionHistory[historyPos];
        if (!Number.isInteger(idx) || idx < 0 || idx >= this.sections.length){
            return fallbackIndex;
        }
        return idx;
    }

    getRelativeSectionIndexWithWrap(sAmount, logCollector = null) {
        const section = this.getRelativeSectionWithWrap(sAmount, logCollector);
        return this.sections.indexOf(section);
    }

    getRelativeSectionIndicesWithWrap(relativeSectionSpecs, logCollector = null) {
        if (!Array.isArray(relativeSectionSpecs)) {
            return [];
        }
        return relativeSectionSpecs.map(spec => this.getRelativeSectionIndexWithWrap(spec, logCollector));
    }

    getSectionsCurrentIndex(){
        return this.gSectionsCurrentIndex;
    }

    static assertAllSectionNotesAreInstances(section) {
        Object.entries(section.sectionNotesByTable).forEach(([tableID, sn]) => {
            if (!(sn instanceof SectionNotes)) {
                console.error(`sectionNotesByTable[${tableID}] is not a SectionNotes instance!`, sn);
            }
        });
    }

    constructSection(){
        if (this.useSectionV2){
            let theSection = new SectionV2({
                rootID: this.rootID,
                sharps: this.sharps,
                beats: DEFAULT_BEATS
            }); 
            Song.assertAllSectionNotesAreInstances(theSection);
            return theSection;
        } else {
            return Section.revive(new Section({
                rootID: this.rootID,
                sharps: this.sharps,
                beats: DEFAULT_BEATS
            }), {
                rootID: this.rootID,
                sharps: this.sharps,
                beats: DEFAULT_BEATS
            });
        }
    }

    normalizeSection(sectionLike){
         if (this.useSectionV2){
            let theSection = SectionV2.revive(sectionLike, {
                rootID: this.rootID,
                sharps: this.sharps,
                beats: DEFAULT_BEATS
            });
            Song.assertAllSectionNotesAreInstances(theSection);
            return theSection;
        } else {
            return Section.revive(sectionLike, {
                rootID: this.rootID,
                sharps: this.sharps,
                beats: DEFAULT_BEATS
            });
        }
    }

    removeAllSections(){
        this.sections = [];
        this.addSection(this.constructSection());
    }

	addSection(section){
        section = this.normalizeSection(section);
	    var newIndex = this.sections.push(section) - 1;
	    this.gSectionsCurrentIndex = newIndex;
	    if (!this.constructing) this.publish_UpdateSectionStatus();
	    return newIndex;
	    // sections is an array of gNotesPlayed objects. push() returns length.
	}
	addSectionAfterCurrent(section){
        section = this.normalizeSection(section);
        if (this.sections.length == 0){
            this.sections.push(section);
            this.gSectionsCurrentIndex = 0;
        } else {
    		var deleteCount=0;
    		var start = this.gSectionsCurrentIndex+1;
    	    var newIndex = this.sections.splice(start, deleteCount, section);
            this.gSectionsCurrentIndex = this.gSectionsCurrentIndex+1;
        }
        this.requestUiFullRepaint();
	    this.publish_UpdateSectionStatus();
	    return this.gSectionsCurrentIndex;
	    // sections is an array of gNotesPlayed objects.
	}
	getSections(){
	    return this.sections;
	}
	addSections(fileObj){
	    if (this.sections.length==1 && this.isEmpty(this.sections[0])){
	        //special case: file open is adding sections, but default section is empty, so delete it.
	        this.sections = [];
	    }
        var normalizedSections = fileObj.sections.map(section => this.normalizeSection(section));
        var count = Array.prototype.push.apply(this.sections, normalizedSections);
        this.gSectionsCurrentIndex = count - 1;
	}

    //these two return an html string that is either sharps or flats, depending on section.
    getRootKey(){
        return this.getCurrentSection().getRootKey();
    }
    getRootKeyLead(){
        return this.getCurrentSection().getRootKeyLead();
    }

    //these two return a simple noteName, one of [A, Bb, B, C, Db, ...etc.]
    getRootNoteName(){
        return this.getCurrentSection().getRootNoteName();
    }
    getLeadNoteName(){
        return this.getCurrentSection().getLeadNoteName();
    }

	getBeat(){
        return this.getCurrentSection().getBeat();
	}
	incBeat(){
        return this.getCurrentSection().incBeat(DEFAULT_BEATS);
	}
	incBeatLoop(){
        return this.getCurrentSection().incBeatLoop(DEFAULT_BEATS);
	}
	decBeat(){
        return this.getCurrentSection().decBeat(DEFAULT_BEATS);
	}

	getBeats(){
        var curr = this.getCurrentSection();
        if (!curr){
			console.warn("this.getCurrentSection() returned undefined in song.getBeats().");
            return DEFAULT_BEATS;
        }
        return curr.getBeats(DEFAULT_BEATS);
	}
	setBeats(newValue){
        this.getCurrentSection().setBeats(newValue);
	}


	gotoFirstBeat(){
        this.getCurrentSection().gotoFirstBeat();
	    this.gFirstBeatSeen = false;
	}

    moveBeatsLaterForTable(tableID, beatCount){
        var result = {};
        var notes = getRecordedNotesForSection(tableID);
        for (var i=1; i<=beatCount; i++){
            result[""+(i+1)] = notes[""+i];
        }
        result["1"] = [];
        getCurrentSection().getSectionNotes(tableID).recordedNotes = result;
    }

	moveBeatsLater(){
        var beatCount = this.getBeats();
        let allTablesInSection = getCurrentSection().getAllSectionNotes();
        allTablesInSection.forEach(([tableID, sn]) => {
            this.moveBeatsLaterForTable(tableID, beatCount);
        });
		this.setBeats(beatCount+1);
        this.gotoFirstBeat();
		this.publish_UpdateSectionStatus();
		this.requestUiFullRepaint();
        this.requestUiShowBeats();
	}

    shuffleRecordedBeatsDown(recordedBeats, nBeats, nStartBeat){
  	  for (var curr=nStartBeat; curr<=nBeats; curr++){
  		if (recordedBeats[curr]){
  			delete recordedBeats[curr];
          }
  		if ( (curr+1 <= nBeats) && recordedBeats[curr+1] ){
  			recordedBeats[curr]=recordedBeats[curr+1];
  		}
  	  }
  	  return recordedBeats;
    }

    deleteBeat() {
        var nStartBeat = this.getBeat();
        var nBeats = this.getBeats();
        if (nBeats <= 1) {
            console.warn("Can't delete beat #1. returning.");
            return;
        }
        // For each table in sectionNotesByTable:
        let allTablesInSection = this.getCurrentSection().getAllSectionNotes();
        allTablesInSection.forEach(([tableID, sn]) => {
            if (sn.recordedNotes) {
                sn.recordedNotes = this.shuffleRecordedBeatsDown(sn.recordedNotes, nBeats, nStartBeat);
            }
        });
        this.setBeats(nBeats - 1);
        var currBeat = nStartBeat > this.getBeats() ? this.getBeats() : nStartBeat;
        this.getCurrentSection().currentBeat = currBeat;
        this.publish_UpdateSectionStatus();
        this.requestUiShowBeats();
    }

    prevBeat(){
  	  this.prevNextBeat(false);
    }

    nextBeat(){
  	  this.prevNextBeat(true);
    }

    prevNextBeat(isNext){
			this.requestUiClearHighlights();
  	        var beat  = this.getBeat();
  	        var beats = this.getBeats();

            if (isNext){
  	            if (beat < beats){
  	               this.incBeat();
  	            }
  	        } else {
  	            if (beat > 1){
  	               this.decBeat();
  	            }
  	        }
            this.publish_UpdateSectionStatus();
            this.requestUiShowBeats();
    }


    //============== TODO:EventBus keep all new EventBus handling code between these comments, ending in END-TODO:EventBus =====================================
    
    publish_SectionChanged(){
        var song = this || obj;
        if (song.isHeadless){
            return;
        }
        //sectionChanged(); //TODO:EventBus: call this throught the EventBus
        EventBus.trigger('SectionChanged', { sectionIndex: song.getSectionsCurrentIndex() });
    }      

    // replacement for direct calls to infinite-neck.js :: updateSectionsStatus();
    publish_UpdateSectionStatus(){
        var song = this || obj;
        if (song.isHeadless){
            return;
        }
        //updateSectionsStatus();  // TODO:EventBus:  call this through the EventBus instead.
        EventBus.trigger('UpdateSectionStatus', { sectionIndex: song.getSectionsCurrentIndex() });
    }

    //Not handled at all yet:
    publish_SectionMoved(){
        var song = this || obj;
        EventBus.trigger('SectionMoved', { sectionIndex: song.getSectionsCurrentIndex() });
    }

    //============== END-TODO:EventBus =====================================

    
    
    //============== Section handling =====================================

	firstSection(){
	    this.gSectionsCurrentIndex = 0;
        this.publish_SectionChanged();
	}

	lastSection() {
		 this.gSectionsCurrentIndex = this.sections.length-1;
         this.publish_SectionChanged();
	}

	prevSection(){
	    if (this.gSectionsCurrentIndex > 0){
	        this.gSectionsCurrentIndex--;
	    }
        this.publish_SectionChanged();
	}
	nextSection(){
	    if (this.gSectionsCurrentIndex < (this.sections.length-1)){
	        this.gSectionsCurrentIndex++;
	    }
        this.publish_SectionChanged();
	}
    gotoSection(idx){
        var sectionIdx = toInt(idx, -1);
        if (sectionIdx > -1 && sectionIdx < this.sections.length){
            this.gSectionsCurrentIndex = sectionIdx;
            if (!this.isHeadless){
				this.requestUiClearAndReplaySection();
                this.publish_SectionChanged();
            }
        } else {
            console.warn("############### bad sectionIdx:"+sectionIdx+" gotoSection("+idx+") len:"+this.sections.length);
        }
    }

    gotoNextSection(orGotoFirst){
        var isRandom = this.randomLoop == true;
        if (isRandom) {
            var prevSectionIdx = this.gSectionsCurrentIndex;
            var rand = Math.random();
            var randSection = Math.floor(rand*this.sections.length);
            if (randSection == this.gSectionsCurrentIndex){
                for (var r = 0; r<10; r++){
                    rand = Math.random();
                    randSection = Math.floor(rand*this.sections.length);
                    if (randSection != this.gSectionsCurrentIndex){
                        break;
                    }
                }
            }
            this.pushRandomSectionHistory(prevSectionIdx);
            this.gSectionsCurrentIndex = randSection;
        } else if (this.getSectionsCurrentIndex()+1 >= this.sections.length){
            if( orGotoFirst ) this.firstSection();
		} else {
			this.nextSection();
		}
        this.requestUiClearAndReplaySection();
	}

	gotoPrevSection(orGotoLast){
		if (this.getSectionsCurrentIndex()==0){
			if( orGotoLast ) this.lastSection();
		} else {
			this.prevSection();
		}
        this.requestUiClearAndReplaySection();
	}

    insertSectionAtDest(aSection, destIndex){
        aSection = this.normalizeSection(aSection);
        if (destIndex == "END"){
            this.sections.push(aSection);
            this.gSectionsCurrentIndex = this.sections.length-1;
        } else if (destIndex == "BEGIN"){
            this.sections.splice(0, 0, aSection);  //insert BEFORE first current.
            this.gSectionsCurrentIndex = 0;
        } else {
            var iDest = toInt(destIndex, -1);
            if (iDest<=-1){
                alert("bad index in addCloneSection: "+destIndex);
                this.addSectionAfterCurrent(aSection);
            } else {
                iDest = iDest + 1; //insert AFTER named section.
                this.sections.splice(iDest, 0, aSection);
                if (iDest >= this.sections.length){
                    this.gSectionsCurrentIndex = this.sections.length - 1;
                } else {
                    this.gSectionsCurrentIndex = iDest;
                }
            }
        }
    }

	newSection(destIndex){
	    var aSection = this.constructSection();  //populates rootID from dropDownRoot.
	    if (destIndex){
            this.insertSectionAtDest(aSection, destIndex);
        } else {
            this.addSectionAfterCurrent(aSection);
        }
        this.requestUiClearAll();
	    this.gotoFirstBeat();
	    this.publish_SectionChanged();//updateSectionsStatus();
	}

	addShallowCloneSection(destIndex){
	    return this.addCloneSection(false, destIndex);
	}
	addDeepCloneSection(destIndex){
	    return this.addCloneSection(true, destIndex);
	}
	addCloneSection(deep, destIndex){
        var aSection = this.constructSection();  //populates rootID from dropDownRoot.
        aSection.populateCloneFrom(this.getCurrentSection(), { deep });
        if (destIndex){
            this.insertSectionAtDest(aSection, destIndex);
        } else {
    		this.addSectionAfterCurrent(aSection);
        }
        this.requestUiClearAll();
        this.requestUiResetNoteNames();//calls replay
	    //updateSectionsStatus();
        this.publish_SectionChanged();//calls updateSectionsStatus...TODO might be one too many calls in this chain--could cleanup for efficiency
	    return aSection;
	}

	deleteCurrentSection(){
	    var obj = this.getCurrentSection();
        var context = {"SectionIndex": this.getSections().indexOf(obj),
                       "caption": obj.caption
                      };
        this.graveyard.bury(GraveType.SECTION, obj, context);

        if (this.sections.length<=1){
            console.warn("Can't remove only section. Clearing instead.");
	        this.sections = [];
            this.gSectionsCurrentIndex = 0;
	        this.newSection();
	        return false;
	    }

        this.sections.splice(this.gSectionsCurrentIndex, 1);
	    this.prevSection();
        this.requestUiClearAll();
        this.requestUiReplay();
        this.publish_SectionChanged();
        //fullRepaint();
		return true;
	}

	isEmpty(section){
        return Section.revive(section).isEmpty();
	}

    moveSectionToEND(){
		var section = this.getCurrentSection();
        var arr = this.sections;
	    arr.push(arr.splice(this.gSectionsCurrentIndex, 1)[0]);
        this.lastSection(); //calls clear and update
	}

	moveSectionTo(newIndex){
        if (newIndex > this.sections.length-1){
            alert("moveSectionTo can't move to section index: "+newIndex+" because sections.length = "+this.sections.length);
            return;
        }
        var oldIndex = this.gSectionsCurrentIndex
        this.sections.splice(newIndex, 0, this.sections.splice(oldIndex, 1)[0]);
        this.gotoSection(newIndex);  //calls clear and update
	}

    //=============== Model Management/Cleanup Functions ==========================================

    //This function works: it transposes every Section in a Song by 'amount', but I haven't installed it in the menu yet.
    cycleThruKeysAllSections(amount){
        var sections = this.getSections();
        sections.forEach(section => {
            this.normalizeSection(section).transposeRoot(amount);
        });
	}

    getTableArrInCurrentSection(tableID){
        return this.getCurrentSection().getTableArr(tableID);
	}

	getTableArrInSection(section, tableID){
        return this.normalizeSection(section).getTableArr(tableID);
	}


    removeUnusedTablesFromMemoryModel(){
    	    this.sections.forEach(section => {
    	        this.normalizeSection(section).removeEmptyTables();
    	    });
	}

    renameTuningIDInModel(oldID, newID) {
        var oldKey =  Constants.TABLE_ID_PREFIX + oldID;
        var newKey =  Constants.TABLE_ID_PREFIX + newID;
        // Rename in each section's noteTables
        this.sections.forEach(function(section) {
            if (section.noteTables && section.noteTables.hasOwnProperty(oldKey)) {
                section.noteTables[newKey] = section.noteTables[oldKey];
                delete section.noteTables[oldKey];
            }
        });
        // Rename in visibleNoteTables array
        if (this.visibleNoteTables) {
            var idx = this.visibleNoteTables.indexOf(oldKey);
            if (idx >= 0) {
                this.visibleNoteTables[idx] = newKey;
            }
        }
    }

    markVisibleTablesForFileSave(visibleTableIds){
        this.visibleNoteTables = visibleTableIds;
    }

    prepareForSave({ visibleTableIds, songName, theme, bpm, userColors, userInstrumentTuning }){
        this.markVisibleTablesForFileSave(visibleTableIds);
        this.removeUnusedTablesFromMemoryModel();
        this.songName = songName;
        this.defaultBPM = "" + bpm;
        this.userColors = userColors;
        this.theme = theme;
    }

  getTuningHashInMemoryModel(){
    if (this.useSectionV2){
        return {"warning":"Not Implemented for V2 yet"};
    }
   var hashTuningNames = {};
     this.sections.forEach((section, sectionIdx) => { //for all sections...
            Object.entries(section.noteTables).forEach(([tablename, tablearr]) => {
                if (tablearr && tablearr.length && tablearr.length > 0) {
                    var tuningID = tablename.substring( Constants.TABLE_ID_PREFIX.length);
                    var val = hashTuningNames[tuningID];
                    if (!val) {
                        val = tablearr.length;
                        hashTuningNames[tuningID] = val;
                        //console.log("section:"+sectionIdx+" tuningID:"+tuningID
                        //    +" val-len:"+val+" new: "+tablearr.length+" obj: "+JSON.stringify(hashTuningNames));
                    } else {
                        hashTuningNames[tuningID] = val + tablearr.length;
                        //console.log("section: "+sectionIdx+" tuningID:"+tuningID
                        //   +" val:"+val+" adding:"+tablearr.length+" obj:"+JSON.stringify(hashTuningNames));
                    }
                }
            });
        });
	  return hashTuningNames;
	}


    removeNotePlayedFromTable(notePlayed, parentTableID){
      var tableArr = this.getTableArrInCurrentSection(parentTableID);
      tableArr.forEach((itemNotePlayed, key) => {
            if (   itemNotePlayed.col == notePlayed.col
                && itemNotePlayed.row == notePlayed.row
                && itemNotePlayed.styleNum == notePlayed.styleNum  ){
                //console.log("found cell["+key+"] item: "+JSON.stringify(itemNotePlayed));
                tableArr.splice(key, 1);
                return false; // break out of forEach
            }
        });
    }

    moveNamedNotesAllSections(amount){
        var sections = this.getSections();
        sections.forEach(section => {
            this.moveNamedNotesForSection(amount, section);       
        });
	}

    moveNamedNotes(amount){
        this.moveNamedNotesForSection(amount, this.getCurrentSection());

    }
    moveNamedNotesForSection(amount, section){
	    this.normalizeSection(section).moveNamedNotes(amount);
  	}

    movePlayedNotesAllSections(amount){
        console.log("movePlayedNotesAllSections not implemented");
    }
    moveRecordedNotesAllSections(amount){
        console.log("moveRecordedNotesAllSections not implemented");
    }
    
    //============= EventBus =========================

    requestUiClearAll() {
        EventBus.trigger('SongUiClearAll');
    }

    requestUiReplay() {
        EventBus.trigger('SongUiReplay');
    }

    requestUiFullRepaint() {
        EventBus.trigger('SongUiFullRepaint');
    }

    requestUiClearHighlights() {
        EventBus.trigger('SongUiClearHighlights');
    }

    requestUiResetNoteNames() {
        EventBus.trigger('SongUiResetNoteNames');
    }

    requestUiShowBeats() {
        EventBus.trigger('SongUiShowBeats');
    }

    requestUiClearAndReplaySection() {
        EventBus.trigger('SongUiClearAndReplaySection');
    }




}

