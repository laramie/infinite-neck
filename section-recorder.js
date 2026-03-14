/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */

//Static functions handling recorded notes in a Section.  Kept out of song.js to keep the recording logic in one place.
//Of course, this picks up the gSong reference from infinite-neck.js via getCurrentSection().
import {
    Note
} from './note.js';

var sectionRecorderProviders = {
    getCurrentSection: function () { return null; },
    clearHighlights: function () { }
};

export function setSectionRecorderProviders(nextProviders = {}) {
    sectionRecorderProviders = { ...sectionRecorderProviders, ...nextProviders };
}

function getCurrentSection() {
    return sectionRecorderProviders.getCurrentSection();
}

function clearHighlights() {
    return sectionRecorderProviders.clearHighlights();
}

function notesMatchByIdentity(element, candidate) {
        const sameCoreIdentity = element.midinum == candidate.midinum
            && element.row == candidate.row
            && element.styleNum == candidate.styleNum;
        if (!sameCoreIdentity) {
            return false;
        }
        const elementHasTable = element.tableID != null && element.tableID !== '';
        const candidateHasTable = candidate.tableID != null && candidate.tableID !== '';
        if (elementHasTable || candidateHasTable) {
            return element.tableID === candidate.tableID;
        }
        return true;
}



    export function getRecordedNotesForSection(){
	    if (!getCurrentSection().recordedNotes){
	       getCurrentSection().recordedNotes = {}
	    }
	    return getCurrentSection().recordedNotes;
	}

    export function clearRecordedNotes(){
      clearHighlights();
	}

    export function recordHighlight(doEraseHighlight, styleNum, sBeatNum, midinum, cellrow, noteName) {
        var recNote = Note.newNote(noteName, styleNum);
        recNote.midinum = midinum;
        recNote.row = cellrow;

        var recordedNotes = getRecordedNotesForSection();
        var notesInBeatArr = recordedNotes[sBeatNum];
        if (!notesInBeatArr){
          recordedNotes[sBeatNum] = [];
        }
        //MOJO TODO:  recordedNotes[sBeatNum] = [];//always hose the array in single-highlight--only one allowed.
        if (!doEraseHighlight){
          recordedNotes[sBeatNum].push(recNote);
        }
        //console.log("noteHighlight:"+JSON.stringify(recordedNotes, null, 2));
    }

    export function recordHighlightSingle(doEraseHighlightSingle, styleNum, sBeatNum, midinum, cellrow, noteName){
        var recNote = Note.newNote(noteName, styleNum);
        recNote.midinum = midinum;
        recNote.row = cellrow;

        var recordedNotes = getRecordedNotesForSection();
        var notesInBeatArr = recordedNotes[sBeatNum];
        if (!notesInBeatArr){
            recordedNotes[sBeatNum] = [];
        }
        function callbackRemoveMIDIPITCHES(element, index, array){
            if (element.styleNum == Note.STYLENUM_MIDIPITCHES){
                return false;
            }
            return true;
        }
        recordedNotes[sBeatNum] = recordedNotes[sBeatNum].filter(callbackRemoveMIDIPITCHES);
        if (doEraseHighlightSingle){
			var newArray =
			    filterOutMidinumRowStyleNum(recordedNotes, sBeatNum, recNote);
			recordedNotes[sBeatNum] = newArray;
        } else {
            recordedNotes[sBeatNum].push(recNote);
        }
    }

    export function recordPlayedNote(sBeatNum, recNote){
        var recordedNotes = getRecordedNotesForSection();
        var notesInBeatArr = recordedNotes[sBeatNum];
        if (!notesInBeatArr){
            recordedNotes[sBeatNum] = [];
        }
        recordedNotes[sBeatNum].push(recNote);
    }

    export function recordingHasPlayedNote(sBeatNum, proxyNote){
		function filterForNote(element, index, array){
            if (notesMatchByIdentity(element, proxyNote)) {
				  return true;
			}
			return false;
        }
		var recordedNotes = getRecordedNotesForSection();
		var notesInBeatArr = recordedNotes[sBeatNum];
		if (!notesInBeatArr){
			return false;
		}
		return recordedNotes[sBeatNum].filter(filterForNote).length>0;
	}

    export function unRecordPlayedNote(sBeatNum, recNote){
		getRecordedNotesForSection()[sBeatNum] = filterOutMidinumRowStyleNum(getRecordedNotesForSection(), sBeatNum, recNote);
	}

	function filterOutMidinumRowStyleNum(recordedNotes, sBeatNum, recNote){
		function callbackRemoveNotesWith_midinum_row_styleNum(element, index, array){
            if (notesMatchByIdentity(element, recNote)) {
				  return false;
			}
			return true;
		}
		var newArray = recordedNotes[sBeatNum].filter(callbackRemoveNotesWith_midinum_row_styleNum);
		return newArray;
	}
