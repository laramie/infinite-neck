import EventBus from './event-bus.js';
import {
    GraveType
} from './graveyard.js';
import {
    getRecordedNotesForSection
} from './section-recorder.js';
import {
    TABLE_ID_PREFIX,
    getTunings
} from './table-builder.js';
import {
	toInt
} from './utils.js';
import { ANSIColors } from './bin/ANSIColors.js';
import { Section } from './Section.js';

const NUM_FRETS_MAX = 108;

export const constNoteNamesArr       = "A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab".split(',');

//Don't export this one, it uses "this" and must be used through the method.
function noteIDToNoteName(noteIndex){
    return this.getCurrentSection().noteIDToDisplayName(noteIndex);
}

function noteIDToNoteNameRaw(noteIndex){
    return constNoteNamesArr[noteIndex];
}

export function noteNameToNoteID(noteName){
		return constNoteNamesArr.indexOf(noteName);
	}

function requestUiClearAll() {
    EventBus.trigger('SongUiClearAll');
}

function requestUiReplay() {
    EventBus.trigger('SongUiReplay');
}

function requestUiFullRepaint() {
    EventBus.trigger('SongUiFullRepaint');
}

function requestUiClearHighlights() {
    EventBus.trigger('SongUiClearHighlights');
}

function requestUiResetNoteNames() {
    EventBus.trigger('SongUiResetNoteNames');
}

function requestUiShowBeats() {
    EventBus.trigger('SongUiShowBeats');
}

function requestUiClearAndReplaySection() {
    EventBus.trigger('SongUiClearAndReplaySection');
}


/**
 * @typedef {Object} Song
 * @property {function(boolean):void} gotoNextSection
 * @property {function():void} replay
 * @property {function():void} getCurrentSection
 * // ...add other methods you use...
 */

/**
 * @returns {Song}
 */
export class Song {
    constructor() {
        Object.assign(this, makeSongLegacy());
    }
}

export function makeSong() {
    return new Song();
}

function makeSongLegacy(){
    const DEFAULT_BEATS = 4;
    const noteNamesFuncArrDEFAULT = [
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

    const FRET_LENGTHS_ARRAY = (() => {
		var width = 60;
		var L0 = 1;  //tuned length, (L-sub-zero)
		const MAGIC_RATIO = 0.9438743;      //hand calculated from equation for fret ratios.
		const FIRSTFRET_LENGTH = 0.05297;   //hand calculated from equation for fret ratios.
        const fretLengths = [];
		for (var n=2; n<=NUM_FRETS_MAX+1; n++){
			var Cn = (Math.pow(MAGIC_RATIO, n));
			var Cnm1 = (Math.pow(MAGIC_RATIO, (n-1)));
			var R = (L0*(1-Cn)-L0*(1-Cnm1))/FIRSTFRET_LENGTH ; //0.05297 is the length of the first fret, if tuned length is 1.
			fretLengths.push(R);
		}
        return fretLengths;
    })();

    let obj = {
        //FIELDS:
            sections: null,
        	gSectionsCurrentIndex: 0,
            gFirstBeatSeen: false,
            userInstrumentTuning: null,
            gSongModelListener: null,
            noteNamesFuncArrDEFAULT: [...noteNamesFuncArrDEFAULT],
            noteNamesFuncArr: [...noteNamesFuncArrDEFAULT],
            sharps: false,
            captionsRowShowing: false,
            fretLengths: FRET_LENGTHS_ARRAY,
            presentationMode: false,
            constructing: false,
        //METHODS:
            make: construct_gSections,

            fixupCurrentIndexForLoadedSong: fixupCurrentIndexForLoadedSong,
            getRelativeSectionWithWrap: getRelativeSectionWithWrap,
            test_getRelativeSectionWithWrap: test_getRelativeSectionWithWrap,
            constructSection: constructSection,

            getSections: getSections,
            addSection: addSection,
            addSections: addSections,
            addSectionAfterCurrent: addSectionAfterCurrent,
            removeAllSections: removeAllSections,

            getBeat: getBeat,
            incBeat: incBeat,
            incBeatLoop: incBeatLoop,
            decBeat: decBeat,
            getBeats: getBeats,
            setBeats: setBeats,
            deleteBeat: deleteBeat,
            prevBeat: prevBeat,
            nextBeat: nextBeat,
            prevNextBeat: prevNextBeat,
            gotoFirstBeat: gotoFirstBeat,
            moveBeatsLater: moveBeatsLater,

            firstSection: firstSection,
            lastSection: lastSection,
            prevSection: prevSection,
            nextSection: nextSection,
            gotoSection: gotoSection,
            gotoNextSection: gotoNextSection,
            gotoPrevSection: gotoPrevSection,

            getCurrentSection: getCurrentSection,
            getSectionsCurrentIndex: getSectionsCurrentIndex,

            insertSectionAtDest: insertSectionAtDest,
            newSection: newSection,
            addShallowCloneSection: addShallowCloneSection,
            addDeepCloneSection: addDeepCloneSection,
            addCloneSection: addCloneSection,
            deleteCurrentSection: deleteCurrentSection,
            isEmpty: isEmpty,
            moveSectionToEND: moveSectionToEND,
            moveSectionTo: moveSectionTo,

            cycleThruKeysAllSections: cycleThruKeysAllSections,

            getTableArrInCurrentSection: getTableArrInCurrentSection,
            getTableArrInSection: getTableArrInSection,

            removeUnusedTablesFromMemoryModel: removeUnusedTablesFromMemoryModel,
            markVisibleTablesForFileSave: markVisibleTablesForFileSave,
            prepareForSave: prepareForSave,
            getTuningHashInMemoryModel: getTuningHashInMemoryModel,
            removeNotePlayedFromTable: removeNotePlayedFromTable,
            moveNamedNotesAllSections: moveNamedNotesAllSections,
            moveNamedNotes: moveNamedNotes,
            moveNamedNotesForSection: moveNamedNotesForSection,

            getRootKey: song_getRootKey,
            getLeadKey: song_getRootKeyLead,
            getLeadNoteName: song_getLeadNoteName,
            getRootNoteName: song_getRootNoteName,

            // Expose noteIDToNoteName and noteIDToNoteNameRaw as methods
            noteIDToNoteName: noteIDToNoteName,
            noteIDToNoteNameRaw: noteIDToNoteNameRaw,
            noteNameToNoteID: noteNameToNoteID,

            //new method for EventBus:
                publish_SectionChanged: publish_SectionChanged,
            publish_UpdateSectionStatus: publish_UpdateSectionStatus,
                publish_SectionMoved: publish_SectionMoved,
            setHeadless: setHeadless
    }
    obj.make();
    return obj;




	function construct_gSections(){
        initializeSongState.call(this);
    }

    function initializeSongState(){
        this.constructing = true;
        this.isHeadless = false;
        this.sections = [];
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

    function setHeadless(value, quiet = false){
        this.isHeadless = value;
         if (this.isHeadless){
            if (!quiet) console.log(ANSIColors.Bold+ANSIColors.cyan("Song running in Headless mode.  No $ or jQuery calls supported."));
            return;
        }
    }

    function fixupCurrentIndexForLoadedSong(){
        var sci = this.gSectionsCurrentIndex;
        if (this.gSectionsCurrentIndex >= this.sections.length){
            this.gSectionsCurrentIndex = this.sections.length-1;
            console.warn("gSong::fixupCurrentIndexForLoadedSong() found that the song gSectionsCurrentIndex was out of range: "+sci+" resetting to : "+this.gSectionsCurrentIndex);
        }
        if (this.gSectionsCurrentIndex < 0){
            this.gSectionsCurrentIndex = 0;
            console.warn("gSong::fixupCurrentIndexForLoadedSong() found that the song gSectionsCurrentIndex was out of range: "+sci);
        }  
    }

    function getCurrentSection(){
        const section = this.sections[this.gSectionsCurrentIndex];
        return normalizeSection.call(this, section);
	}

    function test_getRelativeSectionWithWrap(consoleLog = false){
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
     *    ^+1
     *    ^2  2 sections back, no wrap, just go as early as you can, max is Section 1
     *    &1  1 section ahead, no wrap, max is last Section
     *    &2  2 sections ahead, no wrap, max is last Section
     *    &-2 ignore sign, just do &2
     *    &+2 ignore sign, just do &2
     * 
     *    Negative signs after the first character are ignored, so @-1 is the same as @1, and --1 is the same as -1.
     *     So you can go "back" with -1 or ^1 or @1, and --1, ^-1, and @-1 are identical, respectively.
    */
    function getRelativeSectionWithWrap(sAmount, logCollector = null) {
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
        var firstChar = Direction.EMPTY; //TODO: fix this.

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
                case Direction.PREVIOUS_PLAYED:  //(@)  TODO: this needs to use a stored list of previously played sections if Random Looping.
                    intNum = -1*Math.abs(intNum);  
                    //fall through for now, use the FORWARD/BACKWARD logic.
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

    function getSectionsCurrentIndex(){
        return this.gSectionsCurrentIndex;
    }

    // This all works with Section objects, but JSON doesn't revive them. Working on the reviver, but for now, don't use.
    function constructSection(){
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

    function normalizeSection(sectionLike){
        return Section.revive(sectionLike, {
            rootID: this.rootID,
            sharps: this.sharps,
            beats: DEFAULT_BEATS
        });
    }

    function removeAllSections(){
        this.sections = [];
        this.addSection(this.constructSection());
    }

	function addSection(section){
        section = normalizeSection.call(this, section);
	    var newIndex = this.sections.push(section) - 1;
	    this.gSectionsCurrentIndex = newIndex;
	    if (!this.constructing) this.publish_UpdateSectionStatus();
	    return newIndex;
	    // sections is an array of gNotesPlayed objects. push() returns length.
	}
	function addSectionAfterCurrent(section){
        section = normalizeSection.call(this, section);
        if (this.sections.length == 0){
            this.sections.push(section);
            this.gSectionsCurrentIndex = 0;
        } else {
    		var deleteCount=0;
    		var start = this.gSectionsCurrentIndex+1;
    	    var newIndex = this.sections.splice(start, deleteCount, section);
            this.gSectionsCurrentIndex = this.gSectionsCurrentIndex+1;
        }
        requestUiFullRepaint();
	    this.publish_UpdateSectionStatus();
	    return this.gSectionsCurrentIndex;
	    // sections is an array of gNotesPlayed objects.
	}
	function getSections(){
	    return this.sections;
	}
	function addSections(fileObj){
	    if (this.sections.length==1 && isEmpty(this.sections[0])){
	        //special case: file open is adding sections, but default section is empty, so delete it.
	        this.sections = [];
	    }
        var normalizedSections = fileObj.sections.map(section => normalizeSection.call(this, section));
        var count = Array.prototype.push.apply(this.sections, normalizedSections);
        this.gSectionsCurrentIndex = count - 1;
	}

    //these two return an html string that is either sharps or flats, depending on section.
    function song_getRootKey(){
        return this.getCurrentSection().getRootKey();
    }
    function song_getRootKeyLead(){
        return this.getCurrentSection().getRootKeyLead();
    }

    //these two return a simple noteName, one of [A, Bb, B, C, Db, ...etc.]
    function song_getRootNoteName(){
        return this.getCurrentSection().getRootNoteName();
    }
    function song_getLeadNoteName(){
        return this.getCurrentSection().getLeadNoteName();
    }

	function getBeat(){
        return this.getCurrentSection().getBeat();
	}
	function incBeat(){
        return this.getCurrentSection().incBeat(DEFAULT_BEATS);
	}
	function incBeatLoop(){
        return this.getCurrentSection().incBeatLoop(DEFAULT_BEATS);
	}
	function decBeat(){
        return this.getCurrentSection().decBeat(DEFAULT_BEATS);
	}

	function getBeats(){
        var curr = this.getCurrentSection();
        if (!curr){
            console.log("WARNING: this.getCurrentSection() returned undefined in song.getBeats().");
            return DEFAULT_BEATS;
        }
        return curr.getBeats(DEFAULT_BEATS);
	}
	function setBeats(newValue){
        this.getCurrentSection().setBeats(newValue);
	}


	function gotoFirstBeat(){
        this.getCurrentSection().gotoFirstBeat();
	    this.gFirstBeatSeen = false;
	}

	function moveBeatsLater(){
		var result = {};
        var beatCount = this.getBeats();
		var notes = getRecordedNotesForSection();
		for (var i=1; i<=beatCount; i++){
			result[""+(i+1)] = notes[""+i];
		}
		result["1"] = [];
		this.getCurrentSection().recordedNotes = result;
		this.setBeats(beatCount+1);
        this.gotoFirstBeat();
		this.publish_UpdateSectionStatus();
		requestUiFullRepaint();
        requestUiShowBeats();
	}

    function shuffleRecordedBeatsDown(recordedBeats, nBeats, nStartBeat){
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

    function deleteBeat(){
         var nStartBeat = this.getBeat();
         var nBeats = this.getBeats();
         if (nBeats <=1){
        	 console.log("Can't delele beat #1. returning.");
        	 return;
         }
         var recordedNotes = this.getCurrentSection().recordedNotes;
         if (recordedNotes){
        	 this.getCurrentSection().recordedNotes = shuffleRecordedBeatsDown(recordedNotes, nBeats, nStartBeat);
         }
         this.setBeats(nBeats-1);
         var currBeat = nStartBeat > this.getBeats() ? this.getBeats() : nStartBeat;
         this.getCurrentSection().currentBeat = currBeat;
         this.publish_UpdateSectionStatus();
    		 requestUiShowBeats();
    }

    function prevBeat(){
  	  this.prevNextBeat(false);
    }

    function nextBeat(){
  	  this.prevNextBeat(true);
    }

    function prevNextBeat(isNext){
			requestUiClearHighlights();
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
    			requestUiShowBeats();
    }


    //============== TODO:EventBus keep all new EventBus handling code between these comments, ending in END-TODO:EventBus =====================================
    
    function publish_SectionChanged(){
        var song = this || obj;
        if (song.isHeadless){
            return;
        }
        console.log("in new EventBus strategy: publish_SectionChanged");
        //sectionChanged(); //TODO:EventBus: call this throught the EventBus
        EventBus.trigger('SectionChanged', { sectionIndex: song.getSectionsCurrentIndex() });
    }      

    // replacement for direct calls to infinite-neck.js :: updateSectionsStatus();
    function publish_UpdateSectionStatus(){
        var song = this || obj;
        if (song.isHeadless){
            return;
        }
        console.log("in new EventBus strategy: this.publish_UpdateSectionStatus");
        //updateSectionsStatus();  // TODO:EventBus:  call this through the EventBus instead.
        EventBus.trigger('UpdateSectionStatus', { sectionIndex: song.getSectionsCurrentIndex() });
    }

    //Not handled at all yet:
    function publish_SectionMoved(){
        var song = this || obj;
        EventBus.trigger('SectionMoved', { sectionIndex: song.getSectionsCurrentIndex() });
    }

    //============== END-TODO:EventBus =====================================

    
    
    //============== Section handling =====================================

	function firstSection(){
	    this.gSectionsCurrentIndex = 0;
        this.publish_SectionChanged();
	}

	function lastSection() {
		 this.gSectionsCurrentIndex = this.sections.length-1;
         this.publish_SectionChanged();
	}

	function prevSection(){
	    if (this.gSectionsCurrentIndex > 0){
	        this.gSectionsCurrentIndex--;
	    }
        this.publish_SectionChanged();
	}
	function nextSection(){
	    if (this.gSectionsCurrentIndex < (this.sections.length-1)){
	        this.gSectionsCurrentIndex++;
	    }
        this.publish_SectionChanged();
	}
    function gotoSection(idx){
        var sectionIdx = toInt(idx, -1);
        if (sectionIdx > -1 && sectionIdx < this.sections.length){
            this.gSectionsCurrentIndex = sectionIdx;
            if (!this.isHeadless){
				requestUiClearAndReplaySection();
                publish_SectionChanged();
            }
        } else {
            console.warn("############### bad sectionIdx:"+sectionIdx+" gotoSection("+idx+") len:"+this.sections.length);
        }
    }

    function gotoNextSection(orGotoFirst){
        var isRandom = this.randomLoop == true;
        if (isRandom) {
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
            this.gSectionsCurrentIndex = randSection;
            console.log("Random:"+(rand*this.sections.length)+" section:"+randSection);
        } else if (this.getSectionsCurrentIndex()+1 >= this.sections.length){
            if( orGotoFirst ) this.firstSection();
		} else {
			this.nextSection();
		}
        requestUiClearAndReplaySection();
	}

	function gotoPrevSection(orGotoLast){
		if (this.getSectionsCurrentIndex()==0){
			if( orGotoLast ) this.lastSection();
		} else {
			this.prevSection();
		}
        requestUiClearAndReplaySection();
	}

    function insertSectionAtDest(aSection, destIndex){
        aSection = normalizeSection.call(this, aSection);
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

	function newSection(destIndex){
	    var aSection = this.constructSection();  //populates rootID from dropDownRoot.
	    if (destIndex){
            this.insertSectionAtDest(aSection, destIndex);
        } else {
            this.addSectionAfterCurrent(aSection);
        }
        requestUiClearAll();
	    this.gotoFirstBeat();
	    this.publish_SectionChanged();//updateSectionsStatus();
	}

	function addShallowCloneSection(destIndex){
	    return this.addCloneSection(false, destIndex);
	}
	function addDeepCloneSection(destIndex){
	    return this.addCloneSection(true, destIndex);
	}
	function addCloneSection(deep, destIndex){
        var aSection = this.constructSection();  //populates rootID from dropDownRoot.
        aSection.populateCloneFrom(this.getCurrentSection(), { deep });
        if (destIndex){
            this.insertSectionAtDest(aSection, destIndex);
        } else {
    		this.addSectionAfterCurrent(aSection);
        }
        requestUiClearAll();
        requestUiResetNoteNames();//calls replay
	    //updateSectionsStatus();
        this.publish_SectionChanged();//calls updateSectionsStatus...TODO might be one too many calls in this chain--could cleanup for efficiency
	    return aSection;
	}

	function deleteCurrentSection(){
	    var obj = this.getCurrentSection();
        var context = {"SectionIndex": this.getSections().indexOf(obj),
                       "caption": obj.caption
                      };
        this.graveyard.bury(GraveType.SECTION, obj, context);

        if (this.sections.length<=1){
	        console.log("Can't remove only section. Clearing instead.");
	        this.sections = [];
            this.gSectionsCurrentIndex = 0;
	        this.newSection();
	        return false;
	    }

        this.sections.splice(this.gSectionsCurrentIndex, 1);
	    this.prevSection();
        requestUiClearAll();
        requestUiReplay();
        this.publish_SectionChanged();
        //fullRepaint();
		return true;
	}

	function isEmpty(section){
        return Section.revive(section).isEmpty();
	}

    function moveSectionToEND(){
		var section = this.getCurrentSection();
        var arr = this.sections;
	    arr.push(arr.splice(this.gSectionsCurrentIndex, 1)[0]);
        this.lastSection(); //calls clear and update
	}

	function moveSectionTo(newIndex){
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
    function cycleThruKeysAllSections(amount){
        var sections = this.getSections();
        sections.forEach(section => {
            normalizeSection.call(this, section).transposeRoot(amount);
        });
	}

    function getTableArrInCurrentSection(tableID){
        return this.getCurrentSection().getTableArr(tableID);
	}

	function getTableArrInSection(section, tableID){
        return normalizeSection.call(this, section).getTableArr(tableID);
	}


    function removeUnusedTablesFromMemoryModel(){
    	    this.sections.forEach(section => {
    	        normalizeSection.call(this, section).removeEmptyTables();
    	    });
	}

    function markVisibleTablesForFileSave(visibleTableIds){
        this.visibleNoteTables = visibleTableIds;
        this.tunings = getTunings(visibleTableIds);
    }

    function prepareForSave({ visibleTableIds, songName, theme, bpm, userColors, userInstrumentTuning }){
        this.markVisibleTablesForFileSave(visibleTableIds);
        this.removeUnusedTablesFromMemoryModel();
        this.songName = songName;
        this.defaultBPM = "" + bpm;
        this.userColors = userColors;
        this.theme = theme;
        if (userInstrumentTuning) {
            this.userInstrumentTuning = userInstrumentTuning;
        }
    }

  function getTuningHashInMemoryModel(){
   var hashTuningNames = {};
   var section;
     this.sections.forEach((section, sectionIdx) => { //for all sections...
            Object.entries(section.noteTables).forEach(([tablename, tablearr]) => {
                if (tablearr && tablearr.length && tablearr.length > 0) {
                    var tuningID = tablename.substring(TABLE_ID_PREFIX.length);
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


    function removeNotePlayedFromTable(notePlayed, parentTableID){
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

    function moveNamedNotesAllSections(amount){
        var sections = this.getSections();
        sections.forEach(section => {
            moveNamedNotesForSection(amount, section);
        });
	}

    function moveNamedNotes(amount){
        return moveNamedNotesForSection(amount, this.getCurrentSection());

    }
    function moveNamedNotesForSection(amount, section){
	    return normalizeSection.call(this, section).moveNamedNotes(amount);
  	}
}
