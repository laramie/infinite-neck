/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */


/*  This file manages an html table, specifically its TD.note collection.
*  Certain model data are stored or replicated in the TD elements themselves.
*  Home of future:
*      class NoteTable
*   which manages the real engine of infinite-neck.js, the display of the main model: getSong().
*   Output is all for the instrument noteTables built and inserted into index.html.
*/
import * as Constants from './Constants.js';
import {
	toInt
} from './utils.js';
import {
	ReplayOptions
} from './ReplayOptions.js';
import {
	createLookupContext,
    lookupClassForNote,
    lookupUserColorClass
} from './colorFunctions.js';
import {
    Note
} from './Note.js';
import {
    Song} from './Song.js';
import { NOTE_NAMES_ARRAY } from './Constants.js';
import {
    recordHighlight,
    recordHighlightSingle,
    recordPlayedNote,
    recordingHasPlayedNote,
    unRecordPlayedNote
} from './section-recorder.js';
import * as TuningsLibrary from './TuningsLibrary.js';
import {
    getTonalForTable
} from './TonalFunctions.js';
import EventBus from './event-bus.js';
import { 
    appInit_running,
    controlsToDisplayOptions,
    buildCellsForTable,
    turnOffAutoColorCheckbox,
    updatePrintSections
} from './infinite-neck.js';
import { 
    buildTonalPickerSet, 
    TonalPickerOrientation 
} from './tonalPicker.js';
import { isPianoSkeuomorphicEnabled } from './templates/piano/piano-skeuomorphic.builder.js';
import {
    getTableID,
    isMidiOnlyListenerProjection,
    projectListenerPlayedNotes,
    projectListenerRecordedNotes
} from './move-helpers.js';

const PIANO_SKEUOMORPHIC_HEIGHT_MULTIPLIER = 4;
const PIANO_SKEUOMORPHIC_MIN_HEIGHT_PX = 100;
const PIANO_SKEUOMORPHIC_WIDTH_MULTIPLIER = 0.5;
const PIANO_SKEUOMORPHIC_MIN_WHITE_KEY_WIDTH_PX = 50;
const PIANO_SKEUOMORPHIC_WHITE_TO_BLACK_WIDTH_RATIO = 2.3;
const PIANO_SKEUOMORPHIC_BASELINE_HEIGHT_SCALE_FACTOR = 3;
const PIANO_SKEUOMORPHIC_BASELINE_WIDTH_SCALE_FACTOR = 3;

var notetableProviders = {
    getBeatNumber: function () { return 0; },
    getCurrentSection: function () { return null; },
    getSong: function () { return null; },
    hideNoteClickedCaption: function () { },
    resetNoteNames: function () { },
    setNoteClickedCaption: function () { },
    showBeats: function () { },
    turnOffHiding: function () { }
};

export function setNotetableProviders(nextProviders = {}) {
    notetableProviders = { ...notetableProviders, ...nextProviders };
}

function getBeatNumber() { return notetableProviders.getBeatNumber(); }
function getCurrentSection() { return notetableProviders.getCurrentSection(); }
function getSong() { return notetableProviders.getSong(); }
function hideNoteClickedCaption() { return notetableProviders.hideNoteClickedCaption(); }
function resetNoteNames() { return notetableProviders.resetNoteNames(); }
function setNoteClickedCaption(...args) { return notetableProviders.setNoteClickedCaption(...args); }
function showBeats() { return notetableProviders.showBeats(); }
function turnOffHiding() { return notetableProviders.turnOffHiding(); }

function createNotetableLookupContext(section = getCurrentSection()) {
    return createLookupContext({ section });
}

function getTuningByTableID(tableID) {
    return (getSong()?.myTunings || []).find((tuning) => getTableID(tuning) === `${tableID || ''}`) || null;
}

function shouldProjectListenerByMidi(replayOptions) {
    return replayOptions?.type === ReplayOptions.Type.LISTENER
        && isMidiOnlyListenerProjection(replayOptions?.listenerProjection);
}

function getProjectedListenerPlayedNotes(replayOptions, playedNotes = []) {
    if (!shouldProjectListenerByMidi(replayOptions)) {
        return playedNotes;
    }
    const sourceTuning = getTuningByTableID(replayOptions.listenToTablename);
    const targetTuning = getTuningByTableID(replayOptions.tablename);
    if (!sourceTuning || !targetTuning) {
        return playedNotes;
    }
    return projectListenerPlayedNotes({
        playedNotes,
        sourceTuning,
        targetTuning,
        listenerProjection: replayOptions.listenerProjection
    });
}

function getProjectedListenerRecordedNotesForBeat(replayOptions, beat, recordedNotes = {}) {
    if (!shouldProjectListenerByMidi(replayOptions)) {
        return recordedNotes?.[`${beat}`] || [];
    }
    const sourceTuning = getTuningByTableID(replayOptions.listenToTablename);
    const targetTuning = getTuningByTableID(replayOptions.tablename);
    if (!sourceTuning || !targetTuning) {
        return recordedNotes?.[`${beat}`] || [];
    }
    const projected = projectListenerRecordedNotes({
        recordedNotes: { [`${beat}`]: recordedNotes?.[`${beat}`] || [] },
        sourceTuning,
        targetTuning,
        listenerProjection: replayOptions.listenerProjection
    });
    return projected?.[`${beat}`] || [];
}

const LOCAL_FALLBACK_NOTE_FUNCTIONS = "A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab".split(',');

export function isRecording(){
    var btn = $("#btnRecord");
    var recording = btn.attr("recording");
    return ((recording != undefined) && recording == "true");
}

export function getPianoSkeuomorphicCellHeightPx(heightValue) {
    return getPianoSkeuomorphicCellHeightPxForScaleFactor(heightValue, PIANO_SKEUOMORPHIC_BASELINE_HEIGHT_SCALE_FACTOR);
}

export function getPianoSkeuomorphicScaleFactor(scaleFactorValue) {
    const parsed = toInt(scaleFactorValue, PIANO_SKEUOMORPHIC_BASELINE_HEIGHT_SCALE_FACTOR);
    return Math.max(1, Math.min(10, parsed));
}

export function getPianoSkeuomorphicCellHeightPxForScaleFactor(heightValue, scaleFactorValue) {
    const baseHeight = toInt(heightValue, 50);
    const normalizedScaleFactor = getPianoSkeuomorphicScaleFactor(scaleFactorValue);
    const relativeScale = normalizedScaleFactor / PIANO_SKEUOMORPHIC_BASELINE_HEIGHT_SCALE_FACTOR;
    return Math.max(
        Math.round(PIANO_SKEUOMORPHIC_MIN_HEIGHT_PX * relativeScale),
        Math.round(baseHeight * PIANO_SKEUOMORPHIC_HEIGHT_MULTIPLIER * relativeScale)
    );
}

export function getPianoSkeuomorphicWhiteKeyWidthPx(widthValue) {
    return getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor(widthValue, PIANO_SKEUOMORPHIC_BASELINE_WIDTH_SCALE_FACTOR);
}

export function getPianoSkeuomorphicWidthScaleFactor(scaleFactorValue) {
    const parsed = toInt(scaleFactorValue, PIANO_SKEUOMORPHIC_BASELINE_WIDTH_SCALE_FACTOR);
    return Math.max(1, Math.min(6, parsed));
}

function getPianoSkeuomorphicWidthScaleMultiplier(scaleFactorValue) {
    const normalizedScaleFactor = getPianoSkeuomorphicWidthScaleFactor(scaleFactorValue);
    return 0.5 + ((normalizedScaleFactor - 1) * 0.25);
}

export function getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor(widthValue, scaleFactorValue) {
    const baseWidth = toInt(widthValue, 100);
    const baselineWidth = Math.max(
        PIANO_SKEUOMORPHIC_MIN_WHITE_KEY_WIDTH_PX,
        Math.round(baseWidth * PIANO_SKEUOMORPHIC_WIDTH_MULTIPLIER)
    );
    return Math.max(1, Math.round(baselineWidth * getPianoSkeuomorphicWidthScaleMultiplier(scaleFactorValue) * 100) / 100);
}

export function getPianoSkeuomorphicBlackKeyWidthPx(widthValue) {
    return getPianoSkeuomorphicBlackKeyWidthPxForScaleFactor(widthValue, PIANO_SKEUOMORPHIC_BASELINE_WIDTH_SCALE_FACTOR);
}

export function getPianoSkeuomorphicBlackKeyWidthPxForScaleFactor(widthValue, scaleFactorValue) {
    const scaledWidth = getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor(widthValue, scaleFactorValue) / PIANO_SKEUOMORPHIC_WHITE_TO_BLACK_WIDTH_RATIO;
    return Math.max(1, Math.round(scaledWidth * 100) / 100);
}


export function cellBuilder(noteNameBase, sharpFlat, noteNum, options, theMidinum) {
    var song = getSong() || {};
    var relNoteNum = (12 + noteNum - options.rootID) % 12; //0-based: 0==first note of scale
    var fnArr = Array.isArray(song.noteNamesFuncArr) ? song.noteNamesFuncArr : [];
    var importFallback = Array.isArray(NOTE_NAMES_ARRAY) ? NOTE_NAMES_ARRAY : LOCAL_FALLBACK_NOTE_FUNCTIONS;
    var noteFnBase = fnArr[relNoteNum] || importFallback[relNoteNum] || "";
    var noteFn = noteFnBase;
    var displayPitch = relNoteNum + 1; //1-based: 1==first note of scale.
    var enharmonicName = "<span class='enharmonicName'>"+noteNameBase + "<small>" + sharpFlat + "</small></span>"
    var enharmonicNameRaw = noteNameBase + sharpFlat;

    var result = "";
    var cell = "&nbsp;";
    var subleft = "&nbsp;";
    var subright = "&nbsp;";

    if (options.showCellNotes) {
        if (options.cellIsFunction) {
            cell = noteFn;
        } else {
            cell = enharmonicName;
        }
    }
    if (options.showSubscriptFunctions) {
        if (options.cellIsFunction) {
            subright = enharmonicName; //already showed noteFn, so swap to enharmonicName
        } else {
            subright = noteFn;
        }
    }
	var noteFunctionClass = "tinyscriptR";
	if (options.useCenterForRightFunction) {
			noteFunctionClass = "CenterCell";
	}
	var midinum = "";
	if (options.showMidiNum){
		if (theMidinum) {
		  midinum = theMidinum;
		  if(!midinum){
		      midinum="xx";
		   }
		}
	}

	var noteFnForHighlight = noteFn;
	if (options.rootIDLead > -1){ //-1 is select option value for "follow rootID".
		var relNoteNumLead = (12 + noteNum - options.rootIDLead) % 12; //0-based: 0==first note of scale
     	noteFnForHighlight = fnArr[relNoteNumLead] || importFallback[relNoteNumLead] || "";
	}

	result = "<div class='NoteDisplay'>"
            +buildUniversalNamedNote(cell, subright, subleft, noteFn, midinum, noteFunctionClass)
            +buildFloatingNotes(cell, subright, subleft, noteFnForHighlight, midinum, noteFunctionClass)
            +buildNamedNote(cell, subright, subleft, noteFn, midinum, noteFunctionClass)
			+"</div>";

    return result;
}

//=================================================================================

function buildNoteNameLane(laneClass, cell, subright, midinum, noteFunctionClass){
    return "<div class='"+laneClass+"'>"
	        +"<span class='midinumDisplayNamedNote'>"+midinum+"</span>"
            +"<div class='CenterCell'>"
                +"<div class='"+noteFunctionClass+"'>"
                   +   cell
                + "</div>"
                +"<span class='tinyscriptL'>"
                    +   subright
                +"</span>"
        +"</div></div>";
}

export function buildNamedNote(cell, subright, subleft, noteFn, midinum, noteFunctionClass){
    return buildNoteNameLane('namedNote', cell, subright, midinum, noteFunctionClass);
}

export function buildUniversalNamedNote(cell, subright, subleft, noteFn, midinum, noteFunctionClass){
    return buildNoteNameLane('universalNamedNote', cell, subright, midinum, noteFunctionClass);
}

export function buildFloatingNotes(cell, subright, subleft, noteFn, midinum, noteFunctionClass){
    var     result =  "<div class='tinyNote'>"+noteFn+"</div>";
            result += "<div class='singleNote'>"
                           +"<span class='midinumDisplay'>" +midinum+"</span>"
                           +"<div class='CenterCell'>"
                               +"<div class='"+noteFunctionClass+"'>"
                                  +   cell
                               + "</div>"
                               +"<span class='tinyscriptL'>"
                                   +   subright
                                +"</span>"
                           +"</div>"
                     +"</div>"
					 +"<div class='Fingering'>1</div>";
     return result;
}

export function buildCellsFromSelector(selector, noteLetter, sharpflat, noteNum, options){
    var cellsSet = $(selector);
	cellsSet.each(function(i, obj){
        var cell=$(this);
        var td = $(obj);
        var midinum = td.attr("midinum");
		var cellcol = td.attr("cellcol");
        var celltable = td.attr("celltable");
        if (celltable) {
            var tuning = TuningsLibrary.findTuningForName(celltable);
            const pianoSkeuomorphic = isPianoSkeuomorphicEnabled(tuning);
            cell.html(cellBuilder(noteLetter, sharpflat, noteNum, options, midinum));

			var isNut = (cell.hasClass("nut") || cell.hasClass("nutR"));

			var w = options.NoteDisplaySizes.width;
			var h = options.NoteDisplaySizes.height;
            if (pianoSkeuomorphic) {
                const pianoHeight = getPianoSkeuomorphicCellHeightPxForScaleFactor(h, options.pianoHeightScaleFactor) + "px";
                const pianoWhiteKeyWidth = getPianoSkeuomorphicWhiteKeyWidthPxForScaleFactor(w, options.pianoWidthScaleFactor) + "px";
                const pianoBlackKeyWidth = getPianoSkeuomorphicBlackKeyWidthPxForScaleFactor(w, options.pianoWidthScaleFactor) + "px";
                h = pianoHeight;
                cell.closest("table")
                    .css("--piano-white-key-width", pianoWhiteKeyWidth)
                    .css("--piano-black-key-width", pianoBlackKeyWidth);
            }
			var multiplier = 1;
			var width = w.substring(0, w.indexOf("px"));
			var height = h.substring(0, h.indexOf("px"));

			var fretWidth = toInt(width,60);
            if (options.naturalFretWidths && !tuning.fixedFretWidthMult){
				multiplier = getSong().fretLengths[cellcol];
                let mellowNormieRadical = 60;
                if (options.naturalFontScaling){
                    mellowNormieRadical = options.naturalFontScaling;
                }
				fretWidth = fretWidth * multiplier * (0.01*mellowNormieRadical);
			}
            if (tuning.fixedFretWidthMult ){
                fretWidth = width * tuning.fixedFretWidthMult * 0.6;
            }
            const sW = fretWidth+"pt";

            var fontMultiplier = Math.pow(multiplier, options.naturalFontScaling*0.01);//{was 0.75 when I got the body, cell, and scaling fonts worked out, before that was: 0.3} The smaller the exponent, the samller the effect of the multiplier, since it is less than one.
            cell.attr("fontMultiplier", fontMultiplier);

            var newTDSizes;
            var newNoteDisplaySizes;
            if (isNut){
                //newSizes = {"width":"var(--nut-width)", "height":h, "font-size":""+(0.6*fontMultiplier)+"em"};  //special for nut.
                newTDSizes = {"width":"var(--nut-width)", "height":h};  //special for nut.
                newNoteDisplaySizes = {"font-size":""+(0.6*fontMultiplier)+"em", "height":h};  //special for nut. //If you set the width for the NoteDisplay instead of td.note it gets wonky.
            } else {
                //newSizes = {"width":sW, "height":h, "font-size":""+fontMultiplier+"em"};
                newTDSizes = {"width":sW, "height":h};
                newNoteDisplaySizes = {"font-size":""+fontMultiplier+"em", "height":h};  //If you set the width for the NoteDisplay instead of td.note it gets wonky.
            }
			//cell.children(".NoteDisplay").css(newSizes);
			cell.children(".NoteDisplay").css(newNoteDisplaySizes);
			cell.css(newTDSizes);  //The calculated width must be on .td.note, not .NoteDisplay
        }
    });
}

//=================================CLICK HANDLING===============================

export const Cause = Object.freeze({
    ERROR: "ERROR", 
    DEFAULT: "default",
    DROPPER: "dropper",
    KEEP: "keep",
    CLEAR: "clear",
    NAMEDNOTE: "NamedNote",
    PLAYEDNOTE: "PlayedNote",
    HIGHLIGHT: "HighlightPitch", // a MIDI highlight, not multi because one MIDI pitch is global.
    HIGHLIGHTMULTI: "HighlightMulti" // for historical reasons, HighlightSingle==HighlightMulti
});

// td.note click calls just this from infinite-neck.js::installTDNoteClick()
export function colorNote(cell) {
    let res = {returnCause: Cause.ERROR};
    try {
        res = colorNoteInner(cell);
    } finally {
        EventBus.trigger('Note:colored', {
            sourceTableID: res.tableID,
            colorNoteResult: res
        });

        let theCurrentSection = getCurrentSection();

        let idx = getSong().sections.indexOf(theCurrentSection);
        let tonalResult = getTonalForTable(getSong(), theCurrentSection, res.tableID);

        let tonalPickerSet = buildTonalPickerSet("CaptionRowTonal", TonalPickerOrientation.HORIZONTAL, 
                                                 res.tableID, idx, 
                                                 tonalResult.chords, theCurrentSection.chartChord, 
                                                 tonalResult.scale,  theCurrentSection.chartMode,
                                                 tonalResult.chord, tonalResult.mode, tonalResult.tonalSourceSet);
        
        $('#'+res.tableID+'_captionRowTonalInfo').html(tonalPickerSet); //"_captionRowTonalInfo" from TableBuilder
        updatePrintSections(); //infinite-neck, rather than updateSectionStatus, which is too heavy.
    }
}
export function colorNoteInner(cell) {
    let result = {returnCause:Cause.ERROR, tableID: ""};
    const lookupContext = createNotetableLookupContext(getCurrentSection());
    var styleNum = Note.STYLENUM_NAMED;
    var doHighlight = false;
    var doHighlightSingle = false;
    var doPlayedNotes = false;
    var doEraseHighlight = cell.hasClass("noteHighlight");
    var doEraseHighlightSingle = cell.hasClass("noteHighlightSingle");

    let tableID = "";
    let parentTableSel = "";
    var parentTable = cell.closest("table");
    if (parentTable){
        var jParentTable =  $(parentTable);
        tableID = jParentTable.attr("id");
        result.tableID = tableID;
        parentTableSel = '#'+tableID+' ';
    }

    $("td.note.noteHighlight").removeClass("noteHighlight");
    var theHighlight = $("input:radio[name=rbHighlight]:checked").val();

    if (  theHighlight != "MidiPitchesSingle" ){
        $(parentTableSel+"td.note.noteHighlightSingle").removeClass("noteHighlightSingle");
    }

    result.NoteType = theHighlight;
    switch (theHighlight){
        case "Named":
            styleNum = Note.STYLENUM_NAMED;
            break;
        case "Tiny":
            doPlayedNotes = true;
            styleNum = Note.STYLENUM_TINY;
            break;
        case "Single":
            doPlayedNotes = true;
            styleNum = Note.STYLENUM_SINGLE;
            break;
        case "Fingering":
            doPlayedNotes = true;
            styleNum = Note.STYLENUM_FINGERING;
            break;
        case "MidiPitches":
            doHighlight = true;
            styleNum = Note.STYLENUM_MIDIPITCHES;
            break;
        case "MidiPitchesSingle":
            doHighlightSingle = true;
            styleNum = Note.STYLENUM_MIDIPITCHESSINGLE;
            break;
        case "Bend":
            doPlayedNotes = true;//MOJO colorNote
            styleNum = Note.STYLENUM_BEND;
            break;
        default:
            styleNum = Note.STYLENUM_NAMED;
    }
    result.styleNum = styleNum;

    var theColorClass = $("input:radio[name=rbColor]:checked").val();
    var doKeep = "noteKeep" === theColorClass;
    var doDropper = "noteDropper" === theColorClass;
    var doIndividualAutomatic = "noteAutomatic" === theColorClass;
	var sBeatNum = getBeatNumber();
	var cellcol = cell.attr("cellcol");//the optional one
	var cellrow = cell.attr("cellrow");//required, the main one w/midinum
	var midinum = cell.attr("midinum");//required

    var proxyNote = {"midinum": midinum,
                     "row": cellrow,
                     "styleNum": styleNum,
                     "noteName": cell.attr("noteName")};

    if (doIndividualAutomatic){
        var lookupResult = lookupClassForNote(proxyNote, lookupContext);
        if (lookupResult && lookupResult.functionNum != null) {
            theColorClass = "note"+(lookupResult.functionNum+1);   //Use 1-based for note1, note2, etc.
        } else if (lookupResult && lookupResult.colorClass) {
            theColorClass = lookupResult.colorClass;
        } else {
            theColorClass = "noteTransparent";
        }
    }

    if (!doKeep){
        turnOffHiding();
    }
    setNoteClickedCaption(cell, theColorClass, styleNum);

    // For these cases,
    //  1) if the user clicks twice whilst recording, remove that note from recording and display.
    //  2) we hose the existing classes on notes being removed, and add back in the essential class.
    //       e.g. cell.find(".singleNote").attr("class", ".singleNote").hide();
    function handleRecordedNote(tableID, className){
        if (recordingHasPlayedNote(tableID, sBeatNum, proxyNote)){
                unRecordPlayedNote(tableID, sBeatNum, proxyNote);
                cell.find('.'+className).attr("class", className).hide();
        } else {
            var thatNote = colorSingleNotes(cell, theColorClass, styleNum, true, lookupContext);
            recordPlayedNote(tableID, sBeatNum, thatNote);
            cell.find('.'+className).addClass("Playback").show();
        }
    }

    var noteName = cell.attr("noteName");
    if (noteName) {
       if (doPlayedNotes) {
            if(doDropper) {
                dropper(cell, cellcol, cellrow, styleNum, noteName);
                result.returnCause = Cause.DROPPER;
                return result;
            }
            if (!doKeep) {
                if (isRecording()){
                    if (theColorClass != "noteClear"){
                        if (styleNum == Note.STYLENUM_FINGERING){
                            handleRecordedNote(tableID, "Fingering");
                        } else if (styleNum == Note.STYLENUM_SINGLE){
                            handleRecordedNote(tableID, "singleNote");
                        } else if (styleNum == Note.STYLENUM_TINY
                               ||  styleNum == Note.STYLENUM_BEND){
                            handleRecordedNote(tableID, "tinyNote");
                        } else {
                            colorSingleNotes(cell, theColorClass, styleNum, false, lookupContext);//no recording for namedNote.
                        }
                    }
                } else {
                    colorSingleNotes(cell, theColorClass, styleNum, false, lookupContext); //not sure why we want to drop in here with noteClear.... TODO!
                }
            }
            result.returnCause = Cause.PLAYEDNOTE;
            return result;
        } else if (doHighlight){
            if (doEraseHighlight){
                cell.removeClass("noteHighlight");
                $(parentTableSel+"td.note[midinum='"+midinum+"']").removeClass("noteHighlight");
            } else {
                cell.addClass("noteHighlight");
                $(parentTableSel+"td.note[midinum='"+midinum+"']").addClass("noteHighlight");
            }
            if (isRecording()){
              	recordHighlight(tableID, doEraseHighlight, styleNum, sBeatNum, midinum, cellrow, noteName);
            }
            result.returnCause = Cause.HIGHLIGHT;
           return result;
       } else if (doHighlightSingle){
           if (doEraseHighlightSingle){
               cell.removeClass("noteHighlightSingle");
               var tdn = $(parentTableSel+"td.note[midinum='"+midinum+"'][cellrow='"+cellrow+"']");
               tdn.removeClass("noteHighlightSingle");
           } else {
               var tdn = $(parentTableSel+"td.note[midinum='"+midinum+"'][cellrow='"+cellrow+"']");
               tdn.addClass("noteHighlightSingle");
           }
           if (isRecording()){
               recordHighlightSingle(tableID, doEraseHighlightSingle, styleNum, sBeatNum, midinum, cellrow, noteName);
           }
           result.returnCause = Cause.HIGHLIGHTMULTI;
           return result;
        } else {
            cell.css("outline", "");
            cell.removeClass("noteHighlight");
        }

        if(doDropper) {
            dropper(cell, cellcol, cellrow, styleNum, noteName);
            result.returnCause = Cause.DROPPER;
            return result;
        }
        if (doKeep) {
            result.returnCause = Cause.KEEP;
            return result;
        }
        var noteNameElements = $(parentTableSel+'.note' + noteName); // G --> .noteG
        var namedNoteDiv = noteNameElements.find(".namedNote");

        // NOTE: this is a little brittle: if you add any other structural classes besides "namedNote", this breaks.
        var lenOtherClasses = namedNoteDiv.prop("className").replace('namedNote','').length; // .trim()???deal with spaces
        var noteAlreadyColored = (lenOtherClasses>0);

		if (theColorClass == "noteClear"){  //color "noteClear" is hardcoded to mean actually clear/delete the note.
			getCurrentSection().getSectionNotes(tableID).clearNamedNote(noteName);
            clearNamedNoteDivs(namedNoteDiv);
            noteNameElements.find(".NoteDisplay").removeClass().addClass("NoteDisplay");
            result.returnCause = Cause.CLEAR;
		} else {
            result.returnCause = Cause.NAMEDNOTE;
            var note = Note.newNote(noteName, styleNum);
            note.colorClass = theColorClass;

            var automaticColorClass = lookupUserColorClass(note, lookupContext);
            var noteAlreadyColoredWithCurrent  = namedNoteDiv.hasClass(automaticColorClass);

			getCurrentSection().getSectionNotes(tableID).clearNamedNote(noteName);
            clearNamedNoteDivs(namedNoteDiv);
            noteNameElements.find(".NoteDisplay").removeClass().addClass("NoteDisplay");

            if ( ! noteAlreadyColoredWithCurrent){
		        styleNamedNote(noteNameElements, lookupUserColorClass(note, lookupContext), noteName);
	    		    getCurrentSection().getSectionNotes(tableID).setNamedNote(noteName, note);
            }
		}
        
        return result;
    }
}

export function dropper(cell, cellcol, cellrow, styleNum, noteName){
    var jCell = $(cell);
    
    //else styleNum ==> Single,Tiny,Bend.
    var tableID = "";
    var parentTable = jCell.closest("table");
    if (parentTable){
        var jParentTable =  $(parentTable);
        tableID = jParentTable.attr("id");

        if (noteName && styleNum == 0){ //namedNote
            var note = getCurrentSection().getSectionNotes(tableID).namedNotes[noteName];
            if (note){
                turnOffAutoColorCheckbox();

                $("input[name=rbColor]")
                    .css({"box-shadow": "none"}); //clear any previously highlighted

                var foundColorClass = note.colorClass;
                $("input[name=rbColor][value="+foundColorClass+"]")
                    .prop('checked', true)
                    .trigger('change')
                    .css({"box-shadow": "0 0 10pt 20pt cyan"});

                setNoteClickedCaption(cell, foundColorClass, styleNum);
                $("td.note").css({"cursor": "auto"});
            }
            return;
        }

        var foundColorClass = jsonPath(getCurrentSection().noteTables, "$.."+tableID+"[?(@.col=="+cellcol+"  && @.row=="+cellrow+" && @.styleNum=="+styleNum+")].colorClass");
        if (foundColorClass){
        $("input[name=rbColor][value="+foundColorClass+"]")
                .prop('checked', true)
                .trigger('change')
                .css({"box-shadow": "0 0 10pt 20pt cyan"});
            setNoteClickedCaption(cell, foundColorClass, styleNum);
            $("td.note").css({"cursor": "auto"});
        }
    }
}

export function styleNamedNote(theClass, theColorClass, noteName){
	theClass.children(".NoteDisplay")
		.addClass("NoteActive");
	var namedNoteDiv = theClass.children(".NoteDisplay").children(".namedNote");
    clearNamedNoteDivs(namedNoteDiv);
    namedNoteDiv.addClass("NamedNoteActive").addClass(theColorClass).show();
	namedNoteDiv.css("opacity",  getSong().namedNoteOpacity);
}

export function eraseNamedNote(NoteDisplayClassEls){
    NoteDisplayClassEls.removeClass().addClass("NoteDisplay");
    var namedNoteDiv = NoteDisplayClassEls.children(".namedNote");
    clearNamedNoteDivs(namedNoteDiv);
}
export function clearNamedNoteDivs(namedNoteDivs){
    namedNoteDivs.removeClass().addClass("namedNote");
}


export function colorSingleNotes(cell, theColorClass, styleNum, dontAddToTableArray, lookupContext = null) {
    lookupContext = lookupContext || createNotetableLookupContext(getCurrentSection());
    var bendValue = $('#selBend').val();
    if (styleNum == Note.STYLENUM_BEND){
        var isNut = cell.hasClass("nut") || cell.hasClass("nutR");
        if (isNut){
            return;
        }
    }
    var clear = (theColorClass == "noteClear");
    var jCell = $(cell);
    var tableID = "";
    var reversed = "";
    var parentTable = jCell.closest("table");
    if (parentTable){
        var jParentTable =  $(parentTable);
        tableID = jParentTable.attr("id");
        reversed = jParentTable.attr("reversed");
        if (reversed === "true"){
            bendValue = bendValue+"LH";
            console.log("+++++ reversed table using LH classes: "+bendValue);
        }
    }


    var midinum = jCell.attr("midinum");
    var r = jCell.attr("cellrow");
    var c = jCell.attr("cellcol");
    var noteName = jCell.attr("noteName"); //could also get this from caller colorNote().

    var notePlayed = Note.newNote(noteName, styleNum);
    notePlayed.midinum = midinum;
    notePlayed.row = r;
    notePlayed.col = c;
    notePlayed.colorClass = theColorClass;

    var sn = jCell.attr("stylenum");
    var sns = sn ? sn : "";
    jCell.attr("stylenum", sns +" + "+styleNum);
    if (styleNum == Note.STYLENUM_BEND){
        notePlayed.bendValue = bendValue;
    }
    var textdiv;
    var theMidiNotePlayedClass;
    var theBendClass = null;
    var singleNoteAlreadyPlayed = false;
    var tinyNoteAlreadyPlayed = false;
    var bendAlreadyPlayed = false;
    var fingeringAlreadyPlayed = false;
    if (styleNum == Note.STYLENUM_TINY){
        textdiv =    jCell.find(".tinyNote");
        tinyNoteAlreadyPlayed = textdiv.hasClass(lookupUserColorClass(notePlayed, lookupContext));
        textdiv.removeClass().addClass("tinyNote");
        theMidiNotePlayedClass = "tinyNotePlayed";
    } else if (styleNum == Note.STYLENUM_SINGLE){
        textdiv =    jCell.find(".singleNote");
        singleNoteAlreadyPlayed = textdiv.hasClass(lookupUserColorClass(notePlayed, lookupContext));
        textdiv.removeClass().addClass("singleNote");
        textdiv.css("opacity",  getSong().singleNoteOpacity);
        theMidiNotePlayedClass = "singleNotePlayed";
    } else if (styleNum == Note.STYLENUM_FINGERING){
		textdiv =    jCell.find(".Fingering");
		fingeringAlreadyPlayed = textdiv.hasClass(lookupUserColorClass(notePlayed, lookupContext));
        textdiv.removeClass().addClass("Fingering");
		textdiv.show();
        jCell.removeClass("OverlayRaisedForPiano");
		var radio = $("input:radio[name=rbHighlight]:checked");
		var finger = radio.attr("finger");
		textdiv.html(finger);
		notePlayed.finger = finger;
		notePlayed.colorClass = theColorClass;
		theMidiNotePlayedClass = "FingeringPlayed";
    } else if (styleNum == Note.STYLENUM_BEND){
        textdiv =    jCell.find(".tinyNote");
                bendAlreadyPlayed = textdiv.hasClass(lookupUserColorClass(notePlayed, lookupContext));
        textdiv.removeClass().addClass("tinyNote");
        theMidiNotePlayedClass = "tinyNotePlayedBend";
        theBendClass = bendValue;
    }
    getSong().removeNotePlayedFromTable(notePlayed, tableID);
    if (!clear){
        if (    !singleNoteAlreadyPlayed
             && !tinyNoteAlreadyPlayed
             && !bendAlreadyPlayed
             && !fingeringAlreadyPlayed
             && !bendAlreadyPlayed
           ){
                var tableArr = getSong().getTableArrInCurrentSection(tableID);
                if (dontAddToTableArray){  //because recording has already added the note to beats in recordedNotes.
                    //console.log("Not adding note to tablearray:"+JSON.stringify(notePlayed));
                } else {
                    tableArr.push(notePlayed);
                }

	        		textdiv.addClass(lookupUserColorClass(notePlayed, lookupContext));
                textdiv.addClass(theMidiNotePlayedClass);
                textdiv.show();//Playback called .hide()
                if (styleNum == Note.STYLENUM_FINGERING) {
					jCell.addClass("OverlayRaisedForPiano");
				}
                if (theBendClass){
                    textdiv.addClass(theBendClass);
                }
        }
    }
    return notePlayed;
}


//=================================REPLAY========================================




export function getReplayOptionsArray(){
    function freshOpts(baseopts, tablename){
        let opts = {};
        Object.assign(opts, baseopts);
        opts.tablename = tablename; //e.g. Constants.TABLE_ID_PREFIX+"S6_1";
        return opts;
    }
    function applySectionOpts(opts, section){
        opts.sharps =      section.sharps;
        opts.rootID =      section.rootID;
        opts.rootIDLead =  section.rootIDLead;
        opts.rootKey =     getSong().noteIDToNoteName(opts.rootID);
        opts.rootKeyLead = getSong().noteIDToNoteName(opts.rootIDLead);                         
    }
    
    let resultOptionsArray = [];
    let baseopts = {};
    baseopts.hideNamedNotes  = $("#cbHideNamedNotes").prop("checked");
    baseopts.hideTinyNotes = $("#cbHideTinyNotes").prop("checked");
    baseopts.hideSingleNotes = $("#cbHideSingleNotes").prop("checked");
    baseopts.hideFingering   = $("#cbHideFingering").prop("checked");

    let visibleTables = getSong().getVisibleTunings();
    visibleTables.forEach(tablename =>{
        let wiring = getSong().wirings.find(w => (w.tablename === tablename)); 
        if (wiring && wiring.relativeSection){
            let opts = freshOpts(baseopts, tablename);
            let section = getSong().getRelativeSectionWithWrap(wiring.relativeSection);
            opts.sectionIndex =  getSong().getSections().indexOf(section);
            opts.listenToTablename = wiring.listenToTablename;
            opts.relativeSection = wiring.relativeSection;
            opts.type = ReplayOptions.Type.RELATIVE;
            opts.directionType = getSong().getRelativeSectionDirection(opts.relativeSection);
            applySectionOpts(opts, section);
            resultOptionsArray.push(opts);
        } else {
            let opts = freshOpts(baseopts, tablename);
            let section = getCurrentSection();
            opts.sectionIndex =  getSong().getSections().indexOf(section);
            opts.listenToTablename = tablename;
            opts.type = ReplayOptions.Type.SELF;
            applySectionOpts(opts, section);
            resultOptionsArray.push(opts);
            //Now add a LISTENER if present on top of SELF, which means SectionStatus widgets show LISTENER values, and notes in SELF get clobbered and you see SELF notes only if listenTo is not playing them.
            if (wiring && wiring.listenToTablename) {
                let listenerOpts = freshOpts(baseopts, tablename);
                let listenerSection = getCurrentSection();
                listenerOpts.sectionIndex =  getSong().getSections().indexOf(listenerSection);
                listenerOpts.listenToTablename = wiring.listenToTablename;
                listenerOpts.listenerProjection = wiring.listenerProjection || 'row-midi';
                listenerOpts.type = ReplayOptions.Type.LISTENER;
                applySectionOpts(listenerOpts, listenerSection);
                resultOptionsArray.push(listenerOpts);
            }
 
        }
    });
    return resultOptionsArray;
}

function getReplaySection(replayOptions){
    if (replayOptions.type === ReplayOptions.Type.RELATIVE){
        return getSong().getRelativeSectionWithWrap(replayOptions.relativeSection);
    }
    return getCurrentSection();
}

/** You will get back an array of opts:
      if wiring.relativeSection, there will be one opts, meaning replay() will be called once.
      if wiring. listenToTablename and not relativeSection, you will get two, 
          meaning replay() will be called first for your listenToTablename, then once for your own tablename.
*/    
export function replay(){
    let optsArray = getReplayOptionsArray();
    optsArray.forEach(opts => {
        replayTable(opts);
    });
}

export function replayTable(replayOptions){
    const currSection = getReplaySection(replayOptions);
    if (replayOptions.type === ReplayOptions.Type.SELF){
        //console.log("replayOptions for SELF: "+JSON.stringify(replayOptions));
        let idx = getSong().sections.indexOf(getCurrentSection());
        let tonalResult = getTonalForTable(getSong(), currSection, replayOptions.listenToTablename);
        let tonalPickerSet = buildTonalPickerSet("CaptionRowTonal", TonalPickerOrientation.HORIZONTAL, 
                                                 replayOptions.listenToTablename, idx, 
                                                 tonalResult.chords, currSection.chartChord, 
                                                 tonalResult.scale,  currSection.chartMode,
                                                 tonalResult.chord, tonalResult.mode, tonalResult.tonalSourceSet);
        $('#'+replayOptions.listenToTablename+'_captionRowTonalInfo').html(tonalPickerSet);
    }

    //const lookupContext = createNotetableLookupContext(currSection);
    const lookupContext = createNotetableLookupContext(getCurrentSection());
    let relativeSectionText = replayOptions.relativeSection 
                                ? "<span class='relativeSectionLabel'>"+replayOptions.relativeSection+"</span>" 
                                : "";

    $('#relSec1_'+replayOptions.tablename).html(relativeSectionText+'<span class="instrumentSectionMark">§</span>'+(replayOptions.sectionIndex+1));
    $('#relSec2_'+replayOptions.tablename).html(relativeSectionText+'<span class="instrumentSectionMark">§</span>'+(replayOptions.sectionIndex+1));

    let nnTablenameSelector = replayOptions.tablename
                        ? '#'+replayOptions.tablename+' '
                        : "";
    let tablename = replayOptions.tablename;
    let listenToTablename = replayOptions.listenToTablename;
    const showBeatCounter = !!controlsToDisplayOptions().showLooperLightBeats;
    const currentBeatNumber = getBeatNumber();

    if (replayOptions.type === ReplayOptions.Type.RELATIVE){
        let defaultDisplayOptions = controlsToDisplayOptions();
        //let relSectionOptions = getSong().getDisplayOptionsInEffect(currSection, defaultDisplayOptions);
        let relSectionOptions = getSong().getDisplayOptionsInEffect(getCurrentSection(), defaultDisplayOptions);
        //console.log("relSectionOptions before assign: "+JSON.stringify(relSectionOptions));
        
        Object.assign(relSectionOptions, replayOptions);
        //console.log("relSectionOptions after assign: "+JSON.stringify(relSectionOptions));
        buildCellsForTable(relSectionOptions.sharps, relSectionOptions, replayOptions.tablename);
        EventBus.trigger("Widget:SectionStatus:statusChanged",
                            {
                                ownerID: replayOptions.tablename,
                                relativeSection: relSectionOptions.relativeSection || '',
                                sectionNumber: (relSectionOptions.sectionIndex !== undefined) ? relSectionOptions.sectionIndex + 1 : '',
                                beatNumber: currentBeatNumber,
                                showBeatCounter,
                                rootKey: relSectionOptions.rootKey || '',
                                rootKeyLead: relSectionOptions.rootKeyLead || '',
                                keyMode: relSectionOptions.type
                            }
                        );
    } else {
        EventBus.trigger("Widget:SectionStatus:statusChanged",
            {
                ownerID: replayOptions.tablename,
                relativeSection: replayOptions.relativeSection || '',
                sectionNumber: (replayOptions.sectionIndex !== undefined) ? replayOptions.sectionIndex + 1 : '',
                beatNumber: currentBeatNumber,
                showBeatCounter,
                rootKey: replayOptions.rootKey || '',
                rootKeyLead: replayOptions.rootKeyLead || '',
                keyMode: replayOptions.type
            }
        );
    }
    
    if (!replayOptions.hideNamedNotes){
        if (currSection.sectionNotesByTable && currSection.sectionNotesByTable[listenToTablename]){
            let namedNotes = currSection.sectionNotesByTable[listenToTablename].namedNotes;
            if (namedNotes){
                Object.keys(namedNotes).forEach(noteName => {
                    var namedNote = namedNotes[noteName];
                    var theSelect;
                    if (namedNote.noteName){
                        theSelect = nnTablenameSelector+".note"+namedNote.noteName;
                    }
                    var theClass = $(theSelect);
                    if (!theSelect){
                        console.log("undef:["+theSelect+"]"+JSON.stringify(namedNote));
                    }
                    var theColorClass = lookupUserColorClass(namedNote, lookupContext);
                    styleNamedNote(theClass, theColorClass, noteName); // sets opacity.
                });
            }
        }
    } else {
        $(nnTablenameSelector+'.namedNote').hide();
    }

    var tablearr = null;
    let sn = currSection.sectionNotesByTable[listenToTablename];
    if (sn){
        tablearr = sn.playedNotes;
    }
    tablearr = getProjectedListenerPlayedNotes(replayOptions, tablearr || []);
    if (tablearr){
        tablearr.forEach(script => {
            var jtdselector = "#"+tablename +" td[cellrow="+script.row+"][midiNum="+script.midinum+"]";
            var jtd = $(jtdselector);
            jtd.each(function(i, obj){
                var textdiv;
                if (script.styleNum == undefined){
                    script.styleNum = 1;//legacy files not saved with styleNum attr.
                }
                if (script.styleNum == Note.STYLENUM_TINY && !replayOptions.hideTinyNotes){
                    textdiv = $(this).find(".tinyNote");
                    textdiv.addClass("tinyNotePlayed");
                    textdiv.css("opacity",  getSong().tinyNoteOpacity);
                } else if (script.styleNum == Note.STYLENUM_SINGLE && !replayOptions.hideSingleNotes){
                    textdiv = $(this).find(".singleNote");
                    textdiv.addClass("singleNotePlayed");
                    textdiv.css("opacity",  getSong().singleNoteOpacity);
                } else if (script.styleNum == Note.STYLENUM_BEND && !replayOptions.hideTinyNotes){
                    textdiv = $(this).find(".tinyNote");
                    textdiv.addClass("tinyNotePlayedBend");
                    textdiv.addClass(script.bendValue);
                    textdiv.css("opacity",  getSong().tinyNoteOpacity);//tiny and bends go together on visibility and opacity
                } else if (script.styleNum == Note.STYLENUM_FINGERING && !replayOptions.hideFingering){
                    textdiv = $(this).find(".Fingering");
                    if (script.finger){
                        textdiv.html(script.finger);
                    }
                    $(this).addClass("OverlayRaisedForPiano");
                    textdiv.addClass("FingeringPlayed");
                    textdiv.show();
                }
                if (textdiv && script.colorClass) {
                    textdiv.addClass(lookupUserColorClass(script, lookupContext));
                }
            });
        });
    }
}

//=================================END REPLAY========================================



export function showMidiNotesInTable(tableID, midinum, preferredRow){
  var tds = $("table[id='"+tableID+"'] td[midinum='"+midinum+"'][cellrow='"+preferredRow+"']");
  if (tds.length==0){
      tds = $("table[id='"+tableID+"'] td[midinum='"+midinum+"']");
      return $(tds[0]);
  } else {
      return $(tds[0]);
  }
}

function normalizeDisplayPartClass(partClass = 'namedNote') {
    return `${partClass || 'namedNote'}`.replace(/^\./, '');
}

function hasJQueryDomAccess() {
    return typeof $ === 'function';
}

const TRANSIENT_NAMED_NOTE_OWNER_ATTR = 'data-transient-named-note-owner';
const TRANSIENT_NAMED_NOTE_CLASS_ATTR = 'data-transient-named-note-original-class';
const TRANSIENT_NAMED_NOTE_STYLE_ATTR = 'data-transient-named-note-original-style';
const TRANSIENT_NOTE_DISPLAY_CLASS_ATTR = 'data-transient-note-display-original-class';
const TRANSIENT_NOTE_DISPLAY_STYLE_ATTR = 'data-transient-note-display-original-style';
const TRANSIENT_DIAMOND_POSITION_OWNER_ATTR = 'data-transient-diamond-position-owner';

function rememberTransientNamedNoteState(part, owner = '') {
    if (!owner || part.length === 0) {
        return;
    }
    const noteDisplay = part.parent('.NoteDisplay');
    if (noteDisplay.length > 0) {
        if (!noteDisplay.attr(TRANSIENT_NOTE_DISPLAY_CLASS_ATTR)) {
            noteDisplay.attr(TRANSIENT_NOTE_DISPLAY_CLASS_ATTR, noteDisplay.attr('class') || 'NoteDisplay');
        }
        if (!noteDisplay.is(`[${TRANSIENT_NOTE_DISPLAY_STYLE_ATTR}]`)) {
            const originalStyle = noteDisplay.attr('style');
            noteDisplay.attr(TRANSIENT_NOTE_DISPLAY_STYLE_ATTR, typeof originalStyle === 'string' ? originalStyle : '');
        }
    }
    if (!part.attr(TRANSIENT_NAMED_NOTE_CLASS_ATTR)) {
        part.attr(TRANSIENT_NAMED_NOTE_CLASS_ATTR, part.attr('class') || 'namedNote');
    }
    if (!part.is(`[${TRANSIENT_NAMED_NOTE_STYLE_ATTR}]`)) {
        const originalStyle = part.attr('style');
        part.attr(TRANSIENT_NAMED_NOTE_STYLE_ATTR, typeof originalStyle === 'string' ? originalStyle : '');
    }
    part.attr(TRANSIENT_NAMED_NOTE_OWNER_ATTR, owner);
}

function restoreTransientNamedNoteState(part) {
    if (part.length === 0) {
        return;
    }

    const noteDisplay = part.parent('.NoteDisplay');
    if (noteDisplay.length > 0) {
        const originalDisplayClass = noteDisplay.attr(TRANSIENT_NOTE_DISPLAY_CLASS_ATTR) || 'NoteDisplay';
        const originalDisplayStyle = noteDisplay.attr(TRANSIENT_NOTE_DISPLAY_STYLE_ATTR);
        noteDisplay.attr('class', originalDisplayClass);
        if (typeof originalDisplayStyle === 'string' && originalDisplayStyle.length > 0) {
            noteDisplay.attr('style', originalDisplayStyle);
        } else {
            noteDisplay.removeAttr('style');
        }
        noteDisplay.removeAttr(TRANSIENT_NOTE_DISPLAY_CLASS_ATTR);
        noteDisplay.removeAttr(TRANSIENT_NOTE_DISPLAY_STYLE_ATTR);
    }

    const originalClass = part.attr(TRANSIENT_NAMED_NOTE_CLASS_ATTR) || 'namedNote';
    const originalStyle = part.attr(TRANSIENT_NAMED_NOTE_STYLE_ATTR);
    part.attr('class', originalClass);
    if (typeof originalStyle === 'string' && originalStyle.length > 0) {
        part.attr('style', originalStyle);
    } else {
        part.removeAttr('style');
    }
    part.removeAttr(TRANSIENT_NAMED_NOTE_OWNER_ATTR);
    part.removeAttr(TRANSIENT_NAMED_NOTE_CLASS_ATTR);
    part.removeAttr(TRANSIENT_NAMED_NOTE_STYLE_ATTR);
}

export function clearTransientNamedNotes(owner = '') {
    const selector = owner
        ? `.namedNote[${TRANSIENT_NAMED_NOTE_OWNER_ATTR}='${owner}']`
        : `.namedNote[${TRANSIENT_NAMED_NOTE_OWNER_ATTR}]`;
    $(selector).each(function() {
        restoreTransientNamedNoteState($(this));
    });
}

export function clearTransientDiamondPositions(owner = '', tableID = '') {
    if (!hasJQueryDomAccess()) {
        return;
    }
    const ownerSelector = owner
        ? `[${TRANSIENT_DIAMOND_POSITION_OWNER_ATTR}='${owner}']`
        : `[${TRANSIENT_DIAMOND_POSITION_OWNER_ATTR}]`;
    const tableSelector = tableID
        ? `table[id='${tableID}'] `
        : '';
    $(`${tableSelector}tr.diamondsRow.NotAString > td.diamonds${ownerSelector}`).each(function() {
        $(this)
            .removeClass('diamondsPositionCurrent')
            .removeAttr(TRANSIENT_DIAMOND_POSITION_OWNER_ATTR);
    });
}

export function findNoteCell(tableID, cellrow, cellcol) {
    return $("table[id='"+tableID+"'] td.note[cellrow='"+cellrow+"'][cellcol='"+cellcol+"']").first();
}

export function findDiamondCell(tableID, cellcol) {
    if (!hasJQueryDomAccess()) {
        return null;
    }
    return $("table[id='"+tableID+"'] tr.diamondsRow.NotAString > td.diamonds[cellcol='"+cellcol+"']").first();
}

export function findNoteDisplayPart(tableID, cellrow, cellcol, partClass = 'namedNote') {
    const cell = findNoteCell(tableID, cellrow, cellcol);
    if (cell.length === 0) {
        return $();
    }
    const normalizedPartClass = normalizeDisplayPartClass(partClass);
    return cell.children('.NoteDisplay').children('.' + normalizedPartClass).first();
}

export function showNoteDisplayPart(tableID, cellrow, cellcol, partClass = 'namedNote', extraClass = '') {
    const part = findNoteDisplayPart(tableID, cellrow, cellcol, partClass);
    if (part.length === 0) {
        return false;
    }
    if (extraClass) {
        part.addClass(extraClass);
    }
    part.show();
    return true;
}

export function showNamedNoteAtCell(tableID, cellrow, cellcol, colorClass = 'noteTransparent', owner = '') {
    const part = findNoteDisplayPart(tableID, cellrow, cellcol, 'namedNote');
    if (part.length === 0) {
        return false;
    }
    rememberTransientNamedNoteState(part, owner);
    part.parent('.NoteDisplay').addClass('NoteActive');
    clearNamedNoteDivs(part);
    part.addClass(colorClass).show();
    if (getSong() && getSong().namedNoteOpacity != null) {
        part.css('opacity', getSong().namedNoteOpacity);
    }
    return true;
}

export function showNamedNotesAtCells(cells = [], options = {}) {
    const clearExisting = !!options.clearExisting;
    const owner = options.owner || '';

    if (clearExisting) {
        clearTransientNamedNotes(owner);
    }

    let shownCount = 0;
    (cells || []).forEach(({ tableID, cellrow, cellcol, colorClass }) => {
        if (showNamedNoteAtCell(tableID, cellrow, cellcol, colorClass || 'noteTransparent', owner)) {
            shownCount += 1;
        }
    });
    return shownCount;
}

export function showDiamondPositionAtCell(tableID, cellcol, owner = '') {
    if (!hasJQueryDomAccess()) {
        return false;
    }
    const cell = findDiamondCell(tableID, cellcol);
    if (!cell || cell.length === 0) {
        return false;
    }
    if (owner) {
        cell.attr(TRANSIENT_DIAMOND_POSITION_OWNER_ATTR, owner);
    }
    cell.addClass('diamondsPositionCurrent');
    return true;
}

export function showDiamondPositionRange(tableID, minFret, maxFret, options = {}) {
    if (!hasJQueryDomAccess()) {
        return 0;
    }
    const clearExisting = !!options.clearExisting;
    const owner = options.owner || '';

    if (clearExisting) {
        clearTransientDiamondPositions(owner, tableID);
    }

    const parsedMinFret = Number.parseInt(minFret, 10);
    const parsedMaxFret = Number.parseInt(maxFret, 10);
    if (!tableID || !Number.isInteger(parsedMinFret) || !Number.isInteger(parsedMaxFret) || parsedMaxFret < parsedMinFret) {
        return 0;
    }

    let shownCount = 0;
    for (let fret = parsedMinFret; fret <= parsedMaxFret; fret += 1) {
        if (showDiamondPositionAtCell(tableID, `${fret}`, owner)) {
            shownCount += 1;
        }
    }
    return shownCount;
}

export function showHighlightsForBeat(nBeat){
    let optsArray = getReplayOptionsArray();
    optsArray.forEach(opts => {
        if (opts.type === ReplayOptions.Type.RELATIVE) {
            let currSection = getReplaySection(opts);
            //nBeat is 1-based.
            if (opts.directionType === Song.DirectionType.BACKWARD){
                showHighlightsForBeatForOptions(currSection.getBeatCount(), opts);
            } else if (opts.directionType === Song.DirectionType.FORWARD){
                showHighlightsForBeatForOptions(1, opts);    
            }
        } else {
            showHighlightsForBeatForOptions(nBeat, opts);
        }
    });
}

//This doesn't currently support the hideSingleNotes, hideTinyNotes, hideFingerin, but it should.
export function showHighlightsForBeatForOptions(nBeat, options){
    const currSection = getReplaySection(options);
    //const lookupContext = createNotetableLookupContext(currSection);
    const lookupContext = createNotetableLookupContext(getCurrentSection());
    let tableSelector = '';
    if (options.tablename){
        tableSelector = '#'+options.tablename+' ';
    }
    let sn = currSection.sectionNotesByTable[options.listenToTablename];
    let dict = null;
    if (sn) {
        dict = sn.recordedNotes;
    }
    if (dict){
        $(tableSelector+"td.note").removeClass("noteHighlight");
		$(tableSelector+"td.note").removeClass("OverlayRaisedForPiano");

        $(tableSelector+"td.note").removeClass("noteHighlightSingle");

		$(tableSelector+"div.Fingering.Playback")
			.attr("class", "Fingering")    //remove marker classes: FingeringPlayed Playback, and any color
			.hide();

		$(tableSelector+"div.singleNote.Playback")
		    .attr("class", "singleNote")  //remove marker classes: singleNote singleNotePlayed Playback, and any color
			.hide();

		$(tableSelector+"div.tinyNote.Playback")
			.attr("class", "tinyNote")   //remove marker classes: [tinyNotePlayed tinyNotePlayedBend Playback] and any color
		 	.hide();

		var arrForBeat = getProjectedListenerRecordedNotesForBeat(options, nBeat, dict);
        if (arrForBeat) {
            arrForBeat.forEach(note => {
                var tdNote = $(tableSelector+"td.note[midinum='"+note.midinum+"'][cellrow='"+note.row+"']");
                if (note.styleNum == Note.STYLENUM_MIDIPITCHES){
                    $(tableSelector+"td.note[midinum='"+note.midinum+"']")
                        .addClass("noteHighlight");
                } else if (note.styleNum == Note.STYLENUM_MIDIPITCHESSINGLE){
                    tdNote
                        .addClass("noteHighlightSingle");
                } else if (note.styleNum == Note.STYLENUM_FINGERING){
                    tdNote
						.addClass("OverlayRaisedForPiano")
                        .find("div.Fingering")
                        .addClass("FingeringPlayed")
                        .addClass("Playback")
                        .addClass(lookupUserColorClass(note, lookupContext))
                        .html(note.finger)  //finger (1234T) shown in cell here.
                        .show();
                }  else if (note.styleNum == Note.STYLENUM_SINGLE){
                    tdNote
                        .find("div.singleNote")
                        .addClass("singleNotePlayed")
                        .addClass("Playback")
                        .addClass(lookupUserColorClass(note, lookupContext))
                        .show();
                }  else if (note.styleNum == Note.STYLENUM_TINY){
                    tdNote
                        .find("div.tinyNote")
                        .addClass("tinyNotePlayed")
                        .addClass("Playback")
                        .addClass(lookupUserColorClass(note, lookupContext))
                        .show();
                }  else if (note.styleNum == Note.STYLENUM_BEND){
                    tdNote
                        .find("div.tinyNote")
                        .addClass("tinyNotePlayedBend")
                        .addClass("Playback")
                        .addClass(note.bendValue)
                        .addClass(lookupUserColorClass(note, lookupContext))
                        .show();
                }
            });
        }
        
    }
}

export function highlightOneNote(noteName){
	var selector = "td.note"+noteName;
      $(selector).addClass("noteHighlight");
}

//=================================CLEARING========================================

export function fullRepaint(){
    if (appInit_running()){
        return;
    }
    clearAll();
    resetNoteNames();
    showBeats();
    // After resizing cells
    const wrapper = document.querySelector('.fretTableWrapper');
    if (wrapper) {
        // Force reflow
        void wrapper.offsetWidth;
    }
}

export function clearAll() {
    let visibleTables = getSong().getVisibleTunings();
    visibleTables.forEach(tablename =>{
        clearAllForTable(tablename);
    });
}
export function clearAllForTable(tablename) {

    let tableSelector = '';
    if (tablename){
        tableSelector = '#'+tablename+' ';
    }

    hideNoteClickedCaption();
    var tdNote = $(tableSelector+"td.note");
    tdNote.removeClass("OverlayRaisedForPiano");
    tdNote.children(".NoteDisplay").removeClass("NoteActive");
    clearTransientDiamondPositions('', tablename);

    var namedNoteDiv = tdNote.children(".NoteDisplay").children(".namedNote");
    clearNamedNoteDivs(namedNoteDiv);

    var tdNoteTinyNote = $(tableSelector+"td.note .tinyNote");
    tdNoteTinyNote.removeClass().addClass("tinyNote");

    $(tableSelector+"td.note .singleNote").removeClass().addClass("singleNote");

    $(tableSelector+"td.note .Fingering").removeClass().addClass("Fingering");

    $(".noteHighlight").css("outline", "");
    clearHighlights();
    colorWhiteBlackKeys();
}

export function clearHighlights(){
    let visibleTables = getSong().getVisibleTunings();
    visibleTables.forEach(tablename =>{
        clearHighlightsForTable(tablename);
    });

}
export function clearHighlightsForTable(tablename){
    let tableSelector = '';
    if (tablename){
        tableSelector = '#'+tablename+' ';
    }

    $(tableSelector+"td.note").removeClass("noteHighlight");
    $(tableSelector+"td.note").removeClass("noteHighlightSingle");
}

//==================FILLING=====================================================

export function colorWhiteBlackKeys() {
    $('.noteDb:not(.nut,.nutR)').addClass("noteBlackKey");
    $('.noteEb:not(.nut,.nutR)').addClass("noteBlackKey");
    $('.noteGb:not(.nut,.nutR)').addClass("noteBlackKey");
    $('.noteAb:not(.nut,.nutR)').addClass("noteBlackKey");
    $('.noteBb:not(.nut,.nutR)').addClass("noteBlackKey");
    $('.noteD:not(.nut,.nutR)').addClass("noteWhiteKey");
    $('.noteE:not(.nut,.nutR)').addClass("noteWhiteKey");
    $('.noteF:not(.nut,.nutR)').addClass("noteWhiteKey");
    $('.noteG:not(.nut,.nutR)').addClass("noteWhiteKey");
    $('.noteA:not(.nut,.nutR)').addClass("noteWhiteKey");
    $('.noteB:not(.nut,.nutR)').addClass("noteWhiteKey");
    $('.noteC:not(.nut,.nutR)').addClass("noteWhiteKey");
}

export function fillChord() {
    var listenToTablename = $('#fillVisibleTablesSelect').val();
    var chordFnNotes = $('#dropDownChords').val();
    var chordFnNotesArr = chordFnNotes.split(',');

    var scaleNotes = $('#dropDownScales').val();
    var scaleNotesArr = scaleNotes.split(',');

    var rootID = parseInt(getCurrentSection().rootID);
    var rootName = NOTE_NAMES_ARRAY[rootID];
    var rootClassName = ".note" + NOTE_NAMES_ARRAY[rootID];

    var scaleColor = $("input:radio[name=rbnFillNoteScale]:checked").val()
    var chordsColor = $("input:radio[name=rbnFillNoteChord]:checked").val()
    var rootColor = $("input:radio[name=rbnFillNoteRoot]:checked").val()

    var keepRoot = (rootColor == "noteKeep");
    var keepChords = (chordsColor == "noteKeep");


    var chordClasses = [];
    var scaleClasses = [];
    var chordNames = [];
    var scaleNames = [];

    for (let i = 0; i < chordFnNotesArr.length; i++) {
        var noteID = (parseInt(chordFnNotesArr[i]) + rootID) % 12;
        var noteName = NOTE_NAMES_ARRAY[noteID];
        if (keepRoot && rootName==noteName){
            console.log("NOT hosing root note by chord: "+noteName);
        } else {
            chordClasses.push(".note" + noteName);
            chordNames.push(noteName);
        }
    }

    for (let i = 0; i < scaleNotesArr.length; i++) {
        var noteID = (parseInt(scaleNotesArr[i]) + rootID) % 12;
        var noteName = NOTE_NAMES_ARRAY[noteID];
        if (   (keepChords && chordNames.includes(noteName))
            || (keepRoot   && rootName==noteName)            ){
            console.log("NOT hosing root/chord note by scale: "+noteName);
        } else {
            scaleClasses.push(".note" + noteName);
            scaleNames.push(noteName);
        }
    }

    var chordClassNames = chordClasses.join(', ');
    var scaleClassNames = scaleClasses.join(', ');
    fillChord2(rootClassName, chordClassNames, scaleClassNames,
               rootName, chordNames, scaleNames,
               rootColor, chordsColor, scaleColor,
               listenToTablename);
}

export function fillChord2(root, chord, scale, rootName, chordNoteNames, scaleNoteNames, rootColor, chordsColor, scaleColor, listenToTablename) {
    //the arguments <chordNoteNames> and <scaleNoteNames> are arrays of ".noteBb" etc.

	/** EACH OF THESE IS A COLLECTION OF TD > DIV.NoteDisplay   **/
	var theChordClass = $(chord).children(".NoteDisplay");
    var theScaleClass = $(scale).children(".NoteDisplay");
    var theRootClass = $(root).children(".NoteDisplay");


    if ( rootColor == "noteClear"){
        doFill(theRootClass, rootName, rootColor);
    }
    if ( chordsColor == "noteClear"){
        doFill(theChordClass, chordNoteNames, chordsColor, listenToTablename);
    }

    if ( scaleColor != "noteHighlightSingle"){
        doFill(theScaleClass, scaleNoteNames, scaleColor, listenToTablename);
    }
    if ( chordsColor != "noteClear" && chordsColor != "noteHighlightSingle"){
        doFill(theChordClass, chordNoteNames, chordsColor, listenToTablename);
    }
    if (rootColor != "noteClear"){ doFill(theRootClass, rootName, rootColor, listenToTablename); }


    clearAll();
    replay();
    if (chordsColor == "noteHighlightSingle"){
        theChordClass.parent("td.note").addClass("noteHighlightSingle");
    }
    if ( scaleColor == "noteHighlightSingle"){
        theScaleClass.parent("td.note").addClass("noteHighlightSingle");
    }
}
export function doFill(theClass, NoteNames, Color, listenToTablename) {
    if (Color == "noteKeep") {
        return;
    }
    var currSection = getCurrentSection();
    const sectionNotes = currSection.getSectionNotes(listenToTablename);
    if (Color != "noteClear") {
        // NO: let replay color the notes. We are just adding them to the model here.
        // theClass.addClass(lookupUserColorClassByClass(Color))
        //          .addClass("NoteActive");
        Object.keys(NoteNames).forEach(key => {
            var noteName = NoteNames[key];
            sectionNotes.setNamedNote(noteName, { "noteName": noteName, "colorClass": Color });
        });
    } else {
        eraseNamedNote(theClass);
        Object.keys(NoteNames).forEach(key => {
            sectionNotes.clearNamedNote(NoteNames[key]);
        });
    }
}

//================================= EventBus handling ========================================

// Listen for note creation events and update listener tables
EventBus.on('Note:colored', function(event, data) {
    const { sourceTableID } = data;
    const colorNoteResult = data && data.colorNoteResult ? data.colorNoteResult : null;
    const song = getSong();
    if (!song || !song.wirings) return;

    // Find all wirings where listenToTablename matches the source
    song.wirings.forEach(wiring => {
        if (wiring.listenToTablename === sourceTableID && wiring.tablename !== sourceTableID) {
            // Prevent infinite loop: don't notify the source table
            // Keep relative-section observer behavior gated to matching current section,
            // but allow plain listeners to update immediately on every source note change.
            if (wiring.relativeSection) {
                const relSection = song.getRelativeSectionWithWrap(wiring.relativeSection);
                if ((song.getSections().length === 1)
                    ||
                    (song.getSections().indexOf(getCurrentSection()) != song.getSections().indexOf(relSection))) {
                    return;
                }
            }

            
            // Replay the listener table (full replay, as layouts may differ)
            const replayOptions = {
                tablename: wiring.tablename,
                listenToTablename: sourceTableID,
                currSection: getCurrentSection(),
                sectionIndex: song.getSections().indexOf(getCurrentSection()),
                relativeSection: wiring.relativeSection,
                listenerProjection: wiring.listenerProjection || 'row-midi',
                type: wiring.relativeSection ? ReplayOptions.Type.RELATIVE : ReplayOptions.Type.LISTENER
            };
            clearAllForTable(wiring.tablename);
            replayTable(replayOptions);

            // During recording, Single/Tiny/Fingering/Bend notes are written to recordedNotes.
            // Replay reads playedNotes, so push an immediate beat-highlight refresh for listeners.
            if (!wiring.relativeSection
                && isRecording()
                && colorNoteResult
                && colorNoteResult.returnCause === Cause.PLAYEDNOTE) {
                showHighlightsForBeatForOptions(getBeatNumber(), replayOptions);
            }
        }
    });
});
EventBus.on('Wiring:removed', function(event, data) {
    const { tablename } = data;
    const song = getSong();
    if (!song) return;
    clearAllForTable(tablename);
    replayTable({
        tablename: tablename,
        listenToTablename: tablename,
        currSection: getCurrentSection(),
        sectionIndex: song.getSections().indexOf(getCurrentSection()),
    });
});
EventBus.on('Wiring:added', function(event, data) {
    const song = getSong();
    if (!song) return;
    // EventBus.trigger("Wiring:added", {tablename:tablename, listenToTablename: listenToTablename});
    //clearAllForTable(tablename);
    replayTable({
        tablename: data.tablename,
        listenToTablename: data.listenToTablename,
        currSection: getCurrentSection(),
        sectionIndex: song.getSections().indexOf(getCurrentSection()),
        relativeSection: data.relativeSection,
        listenerProjection: data.listenerProjection || 'row-midi',
        type: data.relativeSection ? ReplayOptions.Type.RELATIVE : ReplayOptions.Type.LISTENER
    });
});
EventBus.on('NoteTable:ShowNamedNotesAtCells', function(event, data) {
    showNamedNotesAtCells(data && Array.isArray(data.cells) ? data.cells : [], {
        clearExisting: !!(data && data.clearExisting),
        owner: data && data.owner ? data.owner : ''
    });
});
EventBus.on('NoteTable:ShowDiamondPositionRange', function(event, data) {
    showDiamondPositionRange(
        data && data.tableID ? data.tableID : '',
        data && data.minFret,
        data && data.maxFret,
        {
            clearExisting: !!(data && data.clearExisting),
            owner: data && data.owner ? data.owner : ''
        }
    );
});
//=================================END-of-FILE========================================
