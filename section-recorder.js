/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */

//Static functions handling recorded notes in a Section.  Kept out of song.js to keep the recording logic in one place.
//Of course, this picks up the gSong reference from infinite-neck.js via getCurrentSection().
import {
    Note
} from './Note.js';
import { SectionNotes } from './SectionNotes.js';


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



    export function getRecordedNotesForSection(tableID){
        const sn = getCurrentSection().getSectionNotes(tableID);
        if (!(sn instanceof SectionNotes)) {
            console.error('getSectionNotes did not return a SectionNotes instance:', sn);
        }
	    return sn.recordedNotes;
	}

    export function clearRecordedNotes(){
      clearHighlights();
	}

    export function recordHighlight(tableID, doEraseHighlight, styleNum, sBeatNum, midinum, cellrow, noteName) {
        var recNote = Note.newNote(noteName, styleNum);
        recNote.midinum = midinum;
        recNote.row = cellrow;

        var recordedNotes = getRecordedNotesForSection(tableID);
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

    export function recordHighlightSingle(tableID, doEraseHighlightSingle, styleNum, sBeatNum, midinum, cellrow, noteName){
        var recNote = Note.newNote(noteName, styleNum);
        recNote.midinum = midinum;
        recNote.row = cellrow;

        var recordedNotes = getRecordedNotesForSection(tableID);
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

    export function recordPlayedNote(tableID, sBeatNum, recNote){
        var recordedNotes = getRecordedNotesForSection(tableID);
        var notesInBeatArr = recordedNotes[sBeatNum];
        if (!notesInBeatArr){
            recordedNotes[sBeatNum] = [];
        }
        recordedNotes[sBeatNum].push(recNote);
    }

    export function recordingHasPlayedNote(tableID, sBeatNum, proxyNote){
		function filterForNote(element, index, array){
            if (element.midinum == proxyNote.midinum
				&& element.row == proxyNote.row
				&& element.styleNum == proxyNote.styleNum){
				  return true;
			}
			return false;
        }
		var recordedNotes = getRecordedNotesForSection(tableID);
		var notesInBeatArr = recordedNotes[sBeatNum];
		if (!notesInBeatArr){
			return false;
		}
		return recordedNotes[sBeatNum].filter(filterForNote).length>0;
	}

    export function unRecordPlayedNote(tableID, sBeatNum, recNote){
		getRecordedNotesForSection(tableID)[sBeatNum] = filterOutMidinumRowStyleNum(getRecordedNotesForSection(tableID), sBeatNum, recNote);
	}

	function filterOutMidinumRowStyleNum(recordedNotes, sBeatNum, recNote){
		function callbackRemoveNotesWith_midinum_row_styleNum(element, index, array){
			if (element.midinum == recNote.midinum
				&& element.row == recNote.row
				&& element.styleNum == recNote.styleNum){
				  return false;
			}
			return true;
		}
		var newArray = recordedNotes[sBeatNum].filter(callbackRemoveNotesWith_midinum_row_styleNum);
		return newArray;
	}
