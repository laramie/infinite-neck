function makeSong(){
    const DEFAULT_BEATS = 4;
    let obj = {

        //FIELDS:
            frames: null,
        	gFramesCurrentIndex: 0,
            gFirstBeatSeen: false,
            gSongModelListener: null,
            constructing: false,
        //METHODS:
            make: construct_gFrames,

            getCurrentFrame: getCurrentFrame,
            getFramesCurrentIndex: getFramesCurrentIndex,
            constructFrame: constructFrame,

            getFrames: getFrames,
            addFrame: addFrame,
            addFrames: addFrames,
            addFrameAfterCurrent: addFrameAfterCurrent,
            removeAllFrames: removeAllFrames,

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

            firstFrame: firstFrame,
            lastFrame: lastFrame,
            prevFrame: prevFrame,
            nextFrame: nextFrame,
            gotoFrame: gotoFrame,
            gotoNextFrame: gotoNextFrame,
            gotoPrevFrame: gotoPrevFrame,

            insertFrameAtDest: insertFrameAtDest,
            newFrame: newFrame,
            addShallowCloneFrame: addShallowCloneFrame,
            addDeepCloneFrame: addDeepCloneFrame,
            addCloneFrame: addCloneFrame,
            deleteCurrentFrame: deleteCurrentFrame,
            isEmpty: isEmpty,
            moveFrameToEND: moveFrameToEND,
            moveFrameTo: moveFrameTo,

            cycleThruKeysAllFrames: cycleThruKeysAllFrames,

            getTableArrInCurrentFrame: getTableArrInCurrentFrame,
            getTableArrInFrame: getTableArrInFrame,

            removeUnusedTablesFromMemoryModel: removeUnusedTablesFromMemoryModel,
            markVisibleTablesForFileSave: markVisibleTablesForFileSave,
            getTuningHashInMemoryModel: getTuningHashInMemoryModel,
            removeNotePlayedFromTable: removeNotePlayedFromTable,
            exportFromTable: exportFromTable,
            moveNamedNotesAllFrames: moveNamedNotesAllFrames,
            moveNamedNotes: moveNamedNotes,
            moveNamedNotesForFrame: moveNamedNotesForFrame,

            getRootKey: song_getRootKey,
            getLeadKey: song_getRootKeyLead,
            getLeadNoteName: song_getLeadNoteName,
            getRootNoteName: song_getRootNoteName
    }
    obj.make();
    return obj;




	function construct_gFrames(){
        this.constructing = true;
    	this.frames = [];
    	this.visibleTables = [];
        this.colorDicts = {};
    	this.defaultBPM = "80";
        this.rootID = "3";
        this.gFramesCurrentIndex = this.addFrame(this.constructFrame());
	    this.namedNoteOpacity = "1.00";
	    this.singleNoteOpacity = "1.00";
        this.constructing = false;
        delete this.constructing;
    }

    function getCurrentFrame(){
	    return this.frames[this.gFramesCurrentIndex];
	}

    function getFramesCurrentIndex(){
        return this.gFramesCurrentIndex;
    }

    function song_getRootKey(){
        var rootIndex = toInt(this.getCurrentFrame().rootID, 0);
        return noteIDToNoteName(rootIndex);
    }

    // This all works with Frame objects, but JSON doesn't revive them. Working on the reviver, but for now, don't use.
    function constructFrame(){
	    let result = {
            getRootKey: frame_getRootKey,
            getRootKeyLead: frame_getRootKeyLead,
            getLeadNoteName: frame_getLeadNoteName,
            getRootNoteName: frame_getRootNoteName,
            cloneFrom: cloneFrom,
            make: frame_constructor
        };
        result.make();
        return result;
        function frame_constructor(){
    	    this.tables = {};
    	    this.namedNotes = {};
    	    this.recordedNotes = {};
    		this.caption = "";
    	    this.rootID = $("#dropDownRoot").val();
    		this.rootIDLead = "-1";

            var beatsPer = DEFAULT_BEATS;
    	    this.beats = beatsPer;
    		this.currentBeat = 1;
    	    this.sharps = gSharps;
    	}
        function cloneFrom(other){
            this.tables = other.tables;
            this.namedNotes = other.namedNotes ;
            this.recordedNotes = other.recordedNotes ;
            this.caption = other.caption ;
            this.rootID = other.rootID ;
            this.rootIDLead = other.rootIDLead ;
            this.beatsPer = other.beatsPer ;
            this.beats = other.beats ;
            this.currentBeat = other.currentBeat ;
            this.sharps = other.sharps ;
        }

        //these two return an html string that is either sharps or flats, depending on section.
        function frame_getRootKey(){
            var rootIndex = toInt(this.rootID, 0);
    		return noteIDToNoteName(rootIndex);
        }
        function frame_getRootKeyLead(){
    		var leadkey =  noteIDToNoteName(toInt(this.rootIDLead, 0));
            if (!leadkey){
                return noteIDToNoteName(toInt(this.rootID, 0));
            }
            return leadkey;
        }

        //these two return a simple noteName, one of [A, Bb, B, C, Db, ...etc.]
        function frame_getRootNoteName(){
            return noteIDToNoteNameRaw(toInt(this.rootID, 0));
        }
        function frame_getLeadNoteName(){
            if (this.rootIDLead == "-1"){
                return noteIDToNoteNameRaw(toInt(this.rootID, 0));
            }
            return noteIDToNoteNameRaw(toInt(this.rootIDLead, 0));
        }
    }

    function removeAllFrames(){
        this.frames = [];
        this.addFrame(this.constructFrame());
    }

	function addFrame(frame){
	    var newIndex = this.frames.push(frame) - 1;
	    this.gFramesCurrentIndex = newIndex;
	    if (!this.constructing) updateFramesStatus(this);
	    return newIndex;
	    // frames is an array of gNotesPlayed objects. push() returns length.
	}
	function addFrameAfterCurrent(frame){
        if (this.frames.length == 0){
            this.frames.push(frame);
            this.gFramesCurrentIndex = 0;
        } else {
    		var deleteCount=0;
    		var start = this.gFramesCurrentIndex+1;
    	    var newIndex = this.frames.splice(start, deleteCount, frame);
            this.gFramesCurrentIndex = this.gFramesCurrentIndex+1;
        }
        fullRepaint();
	    updateFramesStatus();
	    return this.gFramesCurrentIndex;
	    // frames is an array of gNotesPlayed objects.
	}
	function getFrames(){
	    return this.frames;
	}
	function addFrames(fileObj){
	    if (this.frames.length==1 && isEmpty(this.frames[0])){
	        //special case: file open is adding frames, but default frame is empty, so delete it.
	        this.frames = [];
	    }
	    var count = Array.prototype.push.apply(this.frames, fileObj.frames);
        this.gFramesCurrentIndex = count - 1;
	}

    //these two return an html string that is either sharps or flats, depending on section.
    function song_getRootKey(){
        var rootIndex = toInt(this.getCurrentFrame().rootID, 0);
        return noteIDToNoteName(rootIndex);
    }
    function song_getRootKeyLead(){
        var leadkey =  noteIDToNoteName(toInt(this.getCurrentFrame().rootIDLead, 0));
        if (!leadkey){
            return noteIDToNoteName(toInt(this.getCurrentFrame().rootID, 0));
        }
        return leadkey;
    }

    //these two return a simple noteName, one of [A, Bb, B, C, Db, ...etc.]
    function song_getRootNoteName(){
        return noteIDToNoteNameRaw(toInt(this.getCurrentFrame().rootID, 0));
    }
    function song_getLeadNoteName(){
        if (this.getCurrentFrame().rootIDLead == "-1"){
            return noteIDToNoteNameRaw(toInt(this.getCurrentFrame().rootID, 0));
        }
        return noteIDToNoteNameRaw(toInt(this.getCurrentFrame().rootIDLead, 0));
    }

	function getBeat(){
	    var beat = toInt(this.getCurrentFrame().currentBeat, 1);
	    this.getCurrentFrame().currentBeat = beat;
	    return beat;
	}
	function incBeat(){
	    var beat = getBeat();
	    var beats = getBeats();
	    if (beat >= beats){
	        beat = beats;
	        return beat;
	    }
	    beat++;
	    this.getCurrentFrame().currentBeat = beat;
	    return beat;
	}
	function incBeatLoop(){
	    var beat = this.getBeat();
	    var beats = this.getBeats();
		beat++;
	    if (beat > beats){
	        beat = 1;
	    }
	    this.getCurrentFrame().currentBeat = beat;
	    return beat;
	}
	function decBeat(){
	    var beat = this.getBeat();
	    var beats = this.getBeats();
	    if (beat <= 1){
	        beat = 1;
	        return beat;
	    }
	    beat--;
	    this.getCurrentFrame().currentBeat = beat;
	    return beat;
	}

	function getBeats(){
        var curr = this.getCurrentFrame();
        if (!curr){
            console.log("WARNING: this.getCurrentFrame() returned undefined in song.getBeats().");
            return DEFAULT_BEATS;
        }
	    var beats = toInt(curr.beats, -1);
	    if (beats < 1){
	        beats = DEFAULT_BEATS;
	        this.getCurrentFrame().beats = ""+beats;
	    }
	    return beats;
	}
	function setBeats(newValue){
		this.getCurrentFrame().beats = newValue;
	}


	function gotoFirstBeat(){
	    this.getCurrentFrame().currentBeat = 1;
	    this.gFirstBeatSeen = false;
	}

	function moveBeatsLater(){
		var result = {};
		var beatCount = getBeats();
		var notes = getRecordedNotesForFrame();
		for (var i=1; i<=beatCount; i++){
			result[""+(i+1)] = notes[""+i];
		}
		result["1"] = [];
		this.getCurrentFrame().recordedNotes = result;
		this.setBeats(beatCount+1);
        gotoFirstBeat();
		updateFramesStatus();
        fullRepaint();
        showBeats();
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
         var recordedNotes = this.getCurrentFrame().recordedNotes;
         if (recordedNotes){
        	 this.getCurrentFrame().recordedNotes = shuffleRecordedBeatsDown(recordedNotes, nBeats, nStartBeat);
         }
         this.setBeats(nBeats-1);
         var currBeat = nStartBeat > this.getBeats() ? this.getBeats() : nStartBeat;
         this.getCurrentFrame().currentBeat = currBeat;
         updateFramesStatus();
         showBeats();
    }

    function prevBeat(){
  	  this.prevNextBeat(false);
    }

    function nextBeat(){
  	  this.prevNextBeat(true);
    }

    function prevNextBeat(isNext){
            clearHighlights();
            /*
            var jLblCurrentBeat = $("#lblCurrentBeat");
  	        var sBeats = $("#txtBeatsPer").val();
  	        if (sBeats == ""){
  	            gSong.addBeat();
  	            sBeats = $("#txtBeatsPer").val();
  	        }
            */

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
  	        //jLblCurrentBeat.text(gSong.getBeat());
  	        //$("#lblBeat").html(""+gSong.getBeat());
            updateFramesStatus();
  			showBeats();
    }


    //============== Frame handling =====================================

	function firstFrame(){
	    this.gFramesCurrentIndex = 0;
	    frameChanged();
	}

	function lastFrame() {
		 this.gFramesCurrentIndex = this.frames.length-1;
		 frameChanged();
	}

	function prevFrame(){
	    if (this.gFramesCurrentIndex > 0){
	        this.gFramesCurrentIndex--;
	    }
	    frameChanged();
	}
	function nextFrame(){
	    if (this.gFramesCurrentIndex < (this.frames.length-1)){
	        this.gFramesCurrentIndex++;
	    }
	    frameChanged();
	}
    function gotoFrame(idx){
        var frameIdx = toInt(idx, -1);
        if (frameIdx > -1 && frameIdx < this.frames.length){
            this.gFramesCurrentIndex = frameIdx;
            clearAndReplayFrame();
            frameChanged();
        }
    }

    function gotoNextFrame(orGotoFirst){
        var isRandom = this.randomLoop == true;
        if (isRandom) {
            var rand = Math.random();
            var randFrame = Math.floor(rand*this.frames.length);
            if (randFrame == this.gFramesCurrentIndex){
                for (var r = 0; r<10; r++){
                    rand = Math.random();
                    randFrame = Math.floor(rand*this.frames.length);
                    if (randFrame != this.gFramesCurrentIndex){
                        break;
                    }
                }
            }
            this.gFramesCurrentIndex = randFrame;
            console.log("Random:"+(rand*this.frames.length)+" frame:"+randFrame);
        } else if (this.getFramesCurrentIndex()+1 >= this.frames.length){
            if( orGotoFirst ) this.firstFrame();
		} else {
			this.nextFrame();
		}
		clearAndReplayFrame();
	}

	function gotoPrevFrame(orGotoLast){
		if (this.getFramesCurrentIndex()==0){
			if( orGotoLast ) this.lastFrame();
		} else {
			this.prevFrame();
		}
		clearAndReplayFrame();
	}

    function insertFrameAtDest(aFrame, destIndex){
        if (destIndex == "END"){
            this.frames.push(aFrame);
            this.gFramesCurrentIndex = this.frames.length-1;
        } else if (destIndex == "BEGIN"){
            this.frames.splice(0, 0, aFrame);  //insert BEFORE first current.
            this.gFramesCurrentIndex = 0;
        } else {
            var iDest = toInt(destIndex, -1);
            if (iDest<=-1){
                alert("bad index in addCloneFrame: "+destIndex);
                this.addFrameAfterCurrent(aFrame);
            } else {
                iDest = iDest + 1; //insert AFTER named frame.
                this.frames.splice(iDest, 0, aFrame);
                if (iDest >= this.frames.length){
                    this.gFramesCurrentIndex = this.frames.length - 1;
                } else {
                    this.gFramesCurrentIndex = iDest;
                }
            }
        }
    }

	function newFrame(destIndex){
	    var aFrame = this.constructFrame();  //populates rootID from dropDownRoot.
	    if (destIndex){
            this.insertFrameAtDest(aFrame, destIndex);
        } else {
            this.addFrameAfterCurrent(aFrame);
        }
        clearAll();
	    this.gotoFirstBeat();
	    frameChanged();//updateFramesStatus();
	}

	function addShallowCloneFrame(destIndex){
	    return this.addCloneFrame(false, destIndex);
	}
	function addDeepCloneFrame(destIndex){
	    return this.addCloneFrame(true, destIndex);
	}
	function addCloneFrame(deep, destIndex){
	    var aFrame = this.constructFrame();  //populates rootID from dropDownRoot.
	    aFrame.namedNotes = JSON.parse(JSON.stringify(this.getCurrentFrame().namedNotes));
	    aFrame.rootID = this.getCurrentFrame().rootID;          //$("#dropDownRoot").val();
		aFrame.rootIDLead = this.getCurrentFrame().rootIDLead;  //$('#dropDownRootLead').val(); //foobar: or: use value from getCurren Frame...
	    aFrame.caption = this.getCurrentFrame().caption;
	    aFrame.beats = this.getCurrentFrame().beats;
	    aFrame.currentBeat = 1;
	    if (deep){
	        aFrame.tables = JSON.parse(JSON.stringify(this.getCurrentFrame().tables));
     	    aFrame.recordedNotes = JSON.parse(JSON.stringify(this.getCurrentFrame().recordedNotes));
	    }
        if (destIndex){
            this.insertFrameAtDest(aFrame, destIndex);
        } else {
    		this.addFrameAfterCurrent(aFrame);
        }
		clearAll();
	    resetNoteNames();//calls replay
	    //updateFramesStatus();
	    frameChanged();//calls updateFramesStatus...TODO might be one too many calls in this chain--could cleanup for efficiency
	    return aFrame;
	}

	function deleteCurrentFrame(){
	    var obj = this.getCurrentFrame();
        var context = {"SectionIndex": this.getFrames().indexOf(obj),
                       "caption": obj.caption
                      };
        this.graveyard.bury(GraveType.SECTION, obj, context);

        if (this.frames.length<=1){
	        console.log("Can't remove only frame. Clearing instead.");
	        this.frames = [];
            this.gFramesCurrentIndex = 0;
	        this.newFrame();
	        return false;
	    }

        this.frames.splice(this.gFramesCurrentIndex, 1);
	    this.prevFrame();
	    clearAll();
	    replay();
        frameChanged();
        //fullRepaint();
		return true;
	}

	function isEmpty(frame){
	   var namedNoteCount = 0;
	   var tableCount = 0;
	   for (const noteName in frame.namedNotes){
	        namedNoteCount++;
	    }
	    for (const tablename in frame.tables){
	        var tablearr = frame.tables[tablename];
	        tableCount += tablearr.length;
	    }
	    return ((tableCount + namedNoteCount) == 0);
	}

    function moveFrameToEND(){
		var frame = this.getCurrentFrame();
        var arr = this.frames;
	    arr.push(arr.splice(this.gFramesCurrentIndex, 1)[0]);
        this.lastFrame(); //calls clear and update
	}

	function moveFrameTo(newIndex){
        if (newIndex > this.frames.length-1){
            alert("moveFrameTo can't move to frame index: "+newIndex+" because frames.length = "+this.frames.length);
            return;
        }
        var oldIndex = this.gFramesCurrentIndex
        this.frames.splice(newIndex, 0, this.frames.splice(oldIndex, 1)[0]);
        this.gotoFrame(newIndex);  //calls clear and update
	}

    //=============== Model Management/Cleanup Functions ==========================================

    //This function works: it transposes every Frame in a Song by 'amount', but I haven't installed it in the menu yet.
    function cycleThruKeysAllFrames(amount){
        var frames = this.getFrames();
		for (var idx in frames){
            var frame = frames[idx];
			var curr = toInt(frame.rootID, 0);
			curr=(12+curr + amount) % 12;
			frame.rootID = curr;
		}
	}

    function getTableArrInCurrentFrame(tableID){
	    return getTableArrInFrame(this.getCurrentFrame(), tableID);
	}

	function getTableArrInFrame(frame, tableID){
	    var tableArr = frame.tables[tableID];
	    if (!tableArr){
	        frame.tables[tableID] = [];
	        tableArr = frame.tables[tableID];
	    }
	    return tableArr;
	}


    function removeUnusedTablesFromMemoryModel(){
	  for (frameIdx in this.frames){     //for all frames...
	    var frame = this.frames[frameIdx];
	    var tempTables = {};
	    for (const tablename in frame.tables){
	        var tablearr = frame.tables[tablename];
	        if (tablearr && tablearr.length && tablearr.length>0){
	            tempTables[tablename] = tablearr;
	        }
	    }
	    frame.tables = tempTables;
	  }
	}

    function markVisibleTablesForFileSave(){
	    this.visibleTables = [];
	    for (i in allTunings.tunings){
	         var baseID = allTunings.tunings[i].baseID;
	         var divSelector = "#"+TABLEDIV_ID_PREFIX+baseID;
	         if ($(divSelector).is(':visible')) {
	             this.visibleTables.push(TABLE_ID_PREFIX+baseID);
	         }
	    }
	    var tunings = getTunings(this.visibleTables);
	    this.tunings = tunings;
	}

  function getTuningHashInMemoryModel(){
   var hashTuningNames = {};
   var frame;
   for (frameIdx in this.frames){     //for all frames...
	    frame = this.frames[frameIdx];
   	  for (const tablename in frame.tables){
	        var tablearr = frame.tables[tablename];
	        if (tablearr && tablearr.length && tablearr.length>0){
	            var tuningID = tablename.substring(TABLE_ID_PREFIX.length);
	            var val = hashTuningNames[tuningID];
	            if (!val){
	                val = tablearr.length;
	                hashTuningNames[tuningID] = val;
	                //console.log("frame:"+frameIdx+" tuningID:"+tuningID
	                //    +" val-len:"+val+" new: "+tablearr.length+" obj: "+JSON.stringify(hashTuningNames));
	            } else {
	                hashTuningNames[tuningID] = val + tablearr.length;
	                //console.log("frame: "+frameIdx+" tuningID:"+tuningID
	                //   +" val:"+val+" adding:"+tablearr.length+" obj:"+JSON.stringify(hashTuningNames));
	            }
	        }
	    }
	  }
	  return hashTuningNames;
	}


    function removeNotePlayedFromTable(notePlayed, parentTableID){
      var tableArr = this.getTableArrInCurrentFrame(parentTableID);
      for (key in tableArr){
            var itemNotePlayed = tableArr[key];
            if (   itemNotePlayed.col == notePlayed.col
                && itemNotePlayed.row == notePlayed.row
                && itemNotePlayed.styleNum == notePlayed.styleNum  ){

                //console.log("found cell["+key+"] item: "+JSON.stringify(itemNotePlayed));
                tableArr.splice(key, 1);
                break;
            }
        }
    }

    function moveNamedNotesAllFrames(amount){
        var frames = this.getFrames();
		for (var idx in frames){
            var frame = frames[idx];
	        moveNamedNotesForFrame(amount, frame);
		}
	}

    function moveNamedNotes(amount){
        return moveNamedNotesForFrame(amount, this.getCurrentFrame());

    }
    function moveNamedNotesForFrame(amount, frame){
    	var namedNotesClone = {};
    	var namedNotes = frame.namedNotes;
        debugger
    	for (const noteName in namedNotes){
            var index = gNoteNamesArr.indexOf(noteName);  //globally known list of A,Bb,B,C etc.
            index=(12+index + amount) % 12;
            var transposedNoteName = gNoteNamesArr[index];
            var otherNote = namedNotes[noteName];
            if (otherNote.colorClass){
                var clonedNote = newNote();
                clonedNote.cloneFrom(otherNote);
                clonedNote.noteName = transposedNoteName;
                //clonedNote.noteNameClass = ".note"+transposedNoteName;
                //delete clonedNote.noteNameClass;
                namedNotesClone[transposedNoteName] = clonedNote;
            }

    	}
    	frame.namedNotes = namedNotesClone;
        //console.log("original: "+JSON.stringify(namedNotes) + "\r\n new:"+JSON.stringify(this.getCurrentFrame().namedNotes));
    	return getRootNoteName(frame);  //as we transpose, keep highlighting the rootID.
  	}

  	function getRootNoteName(frame){
  		var noteID = parseInt( frame.rootID );
  		var noteName = gNoteNamesArr[noteID];
  		return noteName;
  	}
}
