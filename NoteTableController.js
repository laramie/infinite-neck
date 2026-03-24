/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */


/*  This file manages an html table, specifically its TD.note collection.
*  Certain model data are stored or replicated in the TD elements themselves.
*  Home of future:
*      class NoteTable
*   which manages the real engine of infinite-neck.js, the display of the main model: getSong().
*   Output is all for the instrument noteTables built and inserted into index.html.
*/

import {
    lookupClassForNote,
    lookupUserColorClass
} from './colorFunctions.js';
import {
    Note
} from './note.js';
import {
    constNoteNamesArr
} from './song.js';
import {
    recordHighlight,
    recordHighlightSingle,
    recordPlayedNote,
    recordingHasPlayedNote,
    unRecordPlayedNote
} from './section-recorder.js';
import * as TuningsLibrary from './TuningsLibrary.js';
import {
	toInt
} from './utils.js';

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

const LOCAL_FALLBACK_NOTE_FUNCTIONS = "A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab".split(',');

export function isRecording(){
    var btn = $("#btnRecord");
    var recording = btn.attr("recording");
    return ((recording != undefined) && recording == "true");
}


export function cellBuilder(noteNameBase, sharpFlat, noteNum, options, theMidinum) {
    var song = getSong() || {};
    var relNoteNum = (12 + noteNum - options.rootID) % 12; //0-based: 0==first note of scale
    var fnArr = Array.isArray(song.noteNamesFuncArr) ? song.noteNamesFuncArr : [];
    var importFallback = Array.isArray(constNoteNamesArr) ? constNoteNamesArr : LOCAL_FALLBACK_NOTE_FUNCTIONS;
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
            +buildFloatingNotes(cell, subright, subleft, noteFnForHighlight, midinum, noteFunctionClass)
            +buildNamedNote(cell, subright, subleft, noteFn, midinum, noteFunctionClass)
			+"</div>";

    return result;
}

//=================================================================================

export function buildNamedNote(cell, subright, subleft, noteFn, midinum, noteFunctionClass){
    return "<div class='namedNote'>"
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
            cell.html(cellBuilder(noteLetter, sharpflat, noteNum, options, midinum));

			var isNut = (cell.hasClass("nut") || cell.hasClass("nutR"));

			var w = options.NoteDisplaySizes.width;
			var h = options.NoteDisplaySizes.height;
			var multiplier = 1;
			var width = w.substring(0, w.indexOf("px"));
			var height = h.substring(0, h.indexOf("px"));

			var fretWidth = toInt(width,60);
            if (options.naturalFretWidths && !tuning.fixedFretWidthMult){
				multiplier = getSong().fretLengths[cellcol];
                let mellowNormieRadical = 60;
                if (options.naturaFontScaling){
                    mellowNormieRadical = options.naturaFontScaling;
                }
				fretWidth = fretWidth * multiplier * (0.01*mellowNormieRadical);
			}
            if (tuning.fixedFretWidthMult ){
                fretWidth = width * tuning.fixedFretWidthMult * 0.6;
            }
            const sW = fretWidth+"pt";

            var fontMultiplier = Math.pow(multiplier, options.naturaFontScaling*0.01);//{was 0.75 when I got the body, cell, and scaling fonts worked out, before that was: 0.3} The smaller the exponent, the samller the effect of the multiplier, since it is less than one.
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

// td.note click calls just this from infinite-neck.js::installTDNoteClick()
export function colorNote(cell) {
    var styleNum = Note.STYLENUM_NAMED;
    var doHighlight = false;
    var doHighlightSingle = false;
    var doPlayedNotes = false;
    var doEraseHighlight = cell.hasClass("noteHighlight");
    var doEraseHighlightSingle = cell.hasClass("noteHighlightSingle");

    $("td.note.noteHighlight").removeClass("noteHighlight");
    var theHighlight = $("input:radio[name=rbHighlight]:checked").val();

    if (  theHighlight != "MidiPitchesSingle" ){
        $("td.note.noteHighlightSingle").removeClass("noteHighlightSingle");
    }
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
                     "styleNum": styleNum};

    if (doIndividualAutomatic){
        var lookupResult = lookupClassForNote(proxyNote);
        theColorClass = "note"+(lookupResult.functionNum+1);   //Use 1-based for note1, note2, etc.
    }

    if (!doKeep){
        turnOffHiding();
    }
    setNoteClickedCaption(cell, theColorClass, styleNum);

    // For these cases,
    //  1) if the user clicks twice whilst recording, remove that note from recording and display.
    //  2) we hose the existing classes on notes being removed, and add back in the essential class.
    //       e.g. cell.find(".singleNote").attr("class", ".singleNote").hide();
    function handleRecordedNote(className){
        if (recordingHasPlayedNote(sBeatNum, proxyNote)){
                unRecordPlayedNote(sBeatNum, proxyNote);
                cell.find('.'+className).attr("class", className).hide();
        } else {
            var thatNote = colorSingleNotes(cell, theColorClass, styleNum, true);
            recordPlayedNote(sBeatNum, thatNote);
            cell.find('.'+className).addClass("Playback").show();
        }
    }

    var noteName = cell.attr("noteName");
    if (noteName) {
       if (doPlayedNotes) {
            if(doDropper) {
                dropper(cell, cellcol, cellrow, styleNum, noteName);
                return;
            }
            if (!doKeep) {
                if (isRecording()){
                    if (theColorClass != "noteClear"){
                        if (styleNum == Note.STYLENUM_FINGERING){
                            handleRecordedNote("Fingering");
                        } else if (styleNum == Note.STYLENUM_SINGLE){
                            handleRecordedNote("singleNote");
                        } else if (styleNum == Note.STYLENUM_TINY
                               ||  styleNum == Note.STYLENUM_BEND){
                            handleRecordedNote("tinyNote");
                        } else {
                            colorSingleNotes(cell, theColorClass, styleNum, false);//no recording for namedNote.
                        }
                    }
                } else {
                    colorSingleNotes(cell, theColorClass, styleNum, false); //not sure why we want to drop in here with noteClear.... TODO!
                }
            }
            return;
        } else if (doHighlight){
            if (doEraseHighlight){
                cell.removeClass("noteHighlight");
                $("td.note[midinum='"+midinum+"']").removeClass("noteHighlight");
            } else {
                cell.addClass("noteHighlight");
                $("td.note[midinum='"+midinum+"']").addClass("noteHighlight");
            }
            if (isRecording()){
              	recordHighlight(doEraseHighlight, styleNum, sBeatNum, midinum, cellrow, noteName);
            }
           return;
       } else if (doHighlightSingle){
           if (doEraseHighlightSingle){
               cell.removeClass("noteHighlightSingle");
               var tdn = $("td.note[midinum='"+midinum+"'][cellrow='"+cellrow+"']");
               tdn.removeClass("noteHighlightSingle");
           } else {
               var tdn = $("td.note[midinum='"+midinum+"'][cellrow='"+cellrow+"']");
               tdn.addClass("noteHighlightSingle");
           }
           if (isRecording()){
               recordHighlightSingle(doEraseHighlightSingle, styleNum, sBeatNum, midinum, cellrow, noteName);
           }
           return;
        } else {
            cell.css("outline", "");
            cell.removeClass("noteHighlight");
        }

        if(doDropper) {
            dropper(cell, cellcol, cellrow, styleNum, noteName);
            return;
        }
        if (doKeep) {
            return;
        }
        var noteNameElements = $('.note' + noteName); // G --> .noteG
        var namedNoteDiv = noteNameElements.find(".namedNote");

        // NOTE: this is a little brittle: if you add any other structural classes besides "namedNote", this breaks.
        var lenOtherClasses = namedNoteDiv.prop("className").replace('namedNote','').length; // .trim()???deal with spaces
        var noteAlreadyColored = (lenOtherClasses>0);
        /*
        console.log("  note: "
                    +"\r\n   theColorClass:"+theColorClass
                    +"\r\n   lookupUserColorClassByClass:"+lookupUserColorClassByClass(theColorClass)
                    //+"\r\n   lookupUserColorClass(note):"+lookupUserColorClass(note)
                    +"\r\n   namedNoteDiv-->className:"+namedNoteDiv.prop("className")
                    );
        */


		if (theColorClass == "noteClear"){  //color "noteClear" is hardcoded to mean actually clear/delete the note.
			getCurrentSection().namedNotes[noteName] = {};
            clearNamedNoteDivs(namedNoteDiv);
            noteNameElements.find(".NoteDisplay").removeClass().addClass("NoteDisplay");;
		} else {

            var note = Note.newNote(noteName, styleNum);
            note.colorClass = theColorClass;

            var automaticColorClass = lookupUserColorClass(note);
            var noteAlreadyColoredWithCurrent  = namedNoteDiv.hasClass(automaticColorClass);

            getCurrentSection().namedNotes[noteName] = {};
            clearNamedNoteDivs(namedNoteDiv);
            noteNameElements.find(".NoteDisplay").removeClass().addClass("NoteDisplay");

            if ( ! noteAlreadyColoredWithCurrent){
                styleNamedNote(noteNameElements, lookupUserColorClass(note), noteName);
    		    getCurrentSection().namedNotes[noteName] = note;
            }
		}
        //console.log("  namedNoteDiv-->className:"+namedNoteDiv.prop("className"));
        return;
    }
}

export function dropper(cell, cellcol, cellrow, styleNum, noteName){
    var jCell = $(cell);
    if (noteName && styleNum == 0){ //namedNote
        var note = getCurrentSection().namedNotes[noteName];
        if (note){
            var foundColorClass = note.colorClass;
            $("input[name=rbColor][value="+foundColorClass+"]")
                .attr('checked', 'checked')
                .css({"box-shadow": "0 0 10pt 20pt cyan"});
            setNoteClickedCaption(cell, foundColorClass, styleNum);
            $("td.note").css({"cursor": "auto"});
        }
        return;
    }
    //else styleNum ==> Single,Tiny,Bend.
    var parentTableID = "";
    var parentTable = jCell.closest("table");
    if (parentTable){
        var jParentTable =  $(parentTable);
        parentTableID = jParentTable.attr("id");
        var foundColorClass = jsonPath(getCurrentSection().noteTables, "$.."+parentTableID+"[?(@.col=="+cellcol+"  && @.row=="+cellrow+" && @.styleNum=="+styleNum+")].colorClass");
        if (foundColorClass){
            $("input[name=rbColor][value="+foundColorClass+"]")
                .attr('checked', 'checked')
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
	namedNoteDiv.addClass(theColorClass).show();
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


export function colorSingleNotes(cell, theColorClass, styleNum, dontAddToTableArray) {
    var bendValue = $('#selBend').val();
    if (styleNum == Note.STYLENUM_BEND){
        var isNut = cell.hasClass("nut") || cell.hasClass("nutR");
        if (isNut){
            return;
        }
    }
    var clear = (theColorClass == "noteClear");
    var jCell = $(cell);
    var parentTableID = "";
    var reversed = "";
    var parentTable = jCell.closest("table");
    if (parentTable){
        var jParentTable =  $(parentTable);
        parentTableID = jParentTable.attr("id");
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
        tinyNoteAlreadyPlayed = textdiv.hasClass(lookupUserColorClass(notePlayed));
        textdiv.removeClass().addClass("tinyNote");
        theMidiNotePlayedClass = "tinyNotePlayed";
    } else if (styleNum == Note.STYLENUM_SINGLE){
        textdiv =    jCell.find(".singleNote");
        singleNoteAlreadyPlayed = textdiv.hasClass(lookupUserColorClass(notePlayed));
        textdiv.removeClass().addClass("singleNote");
        textdiv.css("opacity",  getSong().singleNoteOpacity);
        theMidiNotePlayedClass = "singleNotePlayed";
    } else if (styleNum == Note.STYLENUM_FINGERING){
		textdiv =    jCell.find(".Fingering");
		fingeringAlreadyPlayed = textdiv.hasClass(lookupUserColorClass(notePlayed));
        textdiv.removeClass().addClass("Fingering");
		textdiv.show();
		var radio = $("input:radio[name=rbHighlight]:checked");
		var finger = radio.attr("finger");
		textdiv.html(finger);
		notePlayed.finger = finger;
		notePlayed.colorClass = theColorClass;
		theMidiNotePlayedClass = "FingeringPlayed";
    } else if (styleNum == Note.STYLENUM_BEND){
        textdiv =    jCell.find(".tinyNote");
        bendAlreadyPlayed = textdiv.hasClass(lookupUserColorClass(notePlayed));
        textdiv.removeClass().addClass("tinyNote");
        theMidiNotePlayedClass = "tinyNotePlayedBend";
        theBendClass = bendValue;
    }
    getSong().removeNotePlayedFromTable(notePlayed, parentTableID);
    if (!clear){
        if (    !singleNoteAlreadyPlayed
             && !tinyNoteAlreadyPlayed
             && !bendAlreadyPlayed
             && !fingeringAlreadyPlayed
             && !bendAlreadyPlayed
           ){
                var tableArr = getSong().getTableArrInCurrentSection(parentTableID);
                if (dontAddToTableArray){  //because recording has already added the note to beats in recordedNotes.
                    //console.log("Not adding note to tablearray:"+JSON.stringify(notePlayed));
                } else {
                    tableArr.push(notePlayed);
                }

        		textdiv.addClass(lookupUserColorClass(notePlayed));
                textdiv.addClass(theMidiNotePlayedClass);
                textdiv.show();//Playback called .hide()
                if (theBendClass){
                    textdiv.addClass(theBendClass);
                }
        }
    }
    return notePlayed;
}


//=================================REPLAY========================================

export function replay(){
    var currSection = getCurrentSection();
    var hideNamedNotes  = $("#cbHideNamedNotes").prop("checked");
    var hideTinyNotes = $("#cbHideTinyNotes").prop("checked");
    var hideSingleNotes = $("#cbHideSingleNotes").prop("checked");
    var hideFingering   = $("#cbHideFingering").prop("checked");

    if (!hideNamedNotes){
        var clone = {};
        Object.keys(currSection.namedNotes).forEach(noteName => {
            //   every G cell has a class "noteG" --> however, as stored,
            //   namedNote.noteNameClass is ".noteG", to make it a selector
            //       ==> Construct jQuery with ".noteG"
            var namedNote = currSection.namedNotes[noteName];
            var theSelect;
            if (namedNote.noteName){
                theSelect = ".note"+namedNote.noteName;
            } else {
                theSelect = namedNote.noteNameClass; //old style before 20240324
            }
            var theClass = $(theSelect);
            if (!theSelect){
                console.log("undef:"+JSON.stringify(namedNote));
            }
            //console.log("named:"+theSelect+":"+theClass.length);
            var theColorClass = lookupUserColorClass(namedNote);
            styleNamedNote(theClass, theColorClass, noteName); // sets opacity.
        });
    } else {
        $('.namedNote').hide();
    }

    Object.keys(currSection.noteTables).forEach(tablename => {
        var tablearr = currSection.noteTables[tablename];
        tablearr.forEach(script => {
            var jtdselector = "#"+tablename +" td[cellrow="+script.row+"][midiNum="+script.midinum+"]";
            var jtd = $(jtdselector);
            console.log("select:"+jtdselector+":"+jtd.length);
            jtd.each(function(i, obj){
                var textdiv;
                if (script.styleNum == undefined){
                    script.styleNum = 1;//legacy files not saved with styleNum attr.
                    console.log("======================== undefined styleNum =============="+JSON.stringify(script));
                    //remove this if you don't see it in console. I've been on this file format for a while now.
                }
                if (script.styleNum == Note.STYLENUM_TINY && !hideTinyNotes){
                    textdiv = $(this).find(".tinyNote");
                    textdiv.addClass("tinyNotePlayed");
                    textdiv.css("opacity",  getSong().tinyNoteOpacity);
                } else if (script.styleNum == Note.STYLENUM_SINGLE && !hideSingleNotes){
                    textdiv = $(this).find(".singleNote");
                    textdiv.addClass("singleNotePlayed");
                    textdiv.css("opacity",  getSong().singleNoteOpacity);
                } else if (script.styleNum == Note.STYLENUM_BEND && !hideTinyNotes){
                    textdiv = $(this).find(".tinyNote");
                    textdiv.addClass("tinyNotePlayedBend");
                    textdiv.addClass(script.bendValue);
                    textdiv.css("opacity",  getSong().tinyNoteOpacity);//tiny and bends go together on visibility and opacity
                } else if (script.styleNum == Note.STYLENUM_FINGERING && !hideFingering){
                    textdiv = $(this).find(".Fingering");
                    if (script.finger){
                        textdiv.html(script.finger);
                    }
                    textdiv.addClass("FingeringPlayed");
                    textdiv.show();
                }
                if (textdiv && script.colorClass) {
                    textdiv.addClass(lookupUserColorClass(script));
                }
            });
        });
    });
}

export function showMidiNotesInTable(tableID, midinum, preferredRow){
  var tds = $("table[id='"+tableID+"'] td[midinum='"+midinum+"'][cellrow='"+preferredRow+"']");
  if (tds.length==0){
      tds = $("table[id='"+tableID+"'] td[midinum='"+midinum+"']");
      return $(tds[0]);
  } else {
      return $(tds[0]);
  }
}

export function showHighlightsForBeat(nBeat){
    var dict = getCurrentSection().recordedNotes;
    if (dict){
        $("td.note").removeClass("noteHighlight");

        $("td.note").removeClass("noteHighlightSingle");

		$("div.Fingering.Playback")
			.attr("class", "Fingering")    //remove marker classes: FingeringPlayed Playback, and any color
			.hide();

		$("div.singleNote.Playback")
		    .attr("class", "singleNote")  //remove marker classes: singleNote singleNotePlayed Playback, and any color
			.hide();

		$("div.tinyNote.Playback")
			.attr("class", "tinyNote")   //remove marker classes: [tinyNotePlayed tinyNotePlayedBend Playback] and any color
		 	.hide();

		var arrForBeat = dict[""+nBeat];
        if (arrForBeat) {
            arrForBeat.forEach(note => {
                var tdNote = $("td.note[midinum='"+note.midinum+"'][cellrow='"+note.row+"']");
                if (note.styleNum == Note.STYLENUM_MIDIPITCHES){
                    $("td.note[midinum='"+note.midinum+"']")
                        .addClass("noteHighlight");
                } else if (note.styleNum == Note.STYLENUM_MIDIPITCHESSINGLE){
                    tdNote
                        .addClass("noteHighlightSingle");
                } else if (note.styleNum == Note.STYLENUM_FINGERING){
                    tdNote
                        .find("div.Fingering")
                        .addClass("FingeringPlayed")
                        .addClass("Playback")
                        .addClass(lookupUserColorClass(note))
                        .html(note.finger)  //finger (1234T) shown in cell here.
                        .show();
                }  else if (note.styleNum == Note.STYLENUM_SINGLE){
                    tdNote
                        .find("div.singleNote")
                        .addClass("singleNotePlayed")
                        .addClass("Playback")
                        .addClass(lookupUserColorClass(note))
                        .show();
                }  else if (note.styleNum == Note.STYLENUM_TINY){
                    tdNote
                        .find("div.tinyNote")
                        .addClass("tinyNotePlayed")
                        .addClass("Playback")
                        .addClass(lookupUserColorClass(note))
                        .show();
                }  else if (note.styleNum == Note.STYLENUM_BEND){
                    tdNote
                        .find("div.tinyNote")
                        .addClass("tinyNotePlayedBend")
                        .addClass("Playback")
                        .addClass(note.bendValue)
                        .addClass(lookupUserColorClass(note))
                        .show();
                }
            });
        }
        
    }
}

export function highlightOneNote(noteName){
	var selector = "td.note"+noteName;
      $(selector).addClass("noteHighlight");
	  //console.log("Highlighting:"+noteName+" :: "+selector);
}



//=================================CLEARING========================================

export function fullRepaint(){
    clearAll();
    resetNoteNames();
    showBeats();
}

export function clearAll() {
    hideNoteClickedCaption();
    var tdNote = $("td.note");
    tdNote.children(".NoteDisplay").removeClass("NoteActive");

    var namedNoteDiv = tdNote.children(".NoteDisplay").children(".namedNote");
    clearNamedNoteDivs(namedNoteDiv);

    var tdNoteTinyNote = $("td.note .tinyNote");
    tdNoteTinyNote.removeClass().addClass("tinyNote");

    $("td.note .singleNote").removeClass().addClass("singleNote");

    $("td.note .Fingering").removeClass().addClass("Fingering");

    $(".noteHighlight").css("outline", "");
    clearHighlights();
    colorWhiteBlackKeys();
}

export function clearHighlights(){
    $("td.note").removeClass("noteHighlight");
    $("td.note").removeClass("noteHighlightSingle");
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
    var chordFnNotes = $('#dropDownChords').val();
    var chordFnNotesArr = chordFnNotes.split(',');

    var scaleNotes = $('#dropDownScales').val();
    var scaleNotesArr = scaleNotes.split(',');

    var rootID = parseInt($('#dropDownRoot').val());
    var rootName = constNoteNamesArr[rootID];
    var rootClassName = ".note" + constNoteNamesArr[rootID];

    var scaleColor = $("input:radio[name=rbnFillNoteScale]:checked").val()
    var chordsColor = $("input:radio[name=rbnFillNoteChord]:checked").val()
    var rootColor = $("input:radio[name=rbnFillNoteRoot]:checked").val()

    //var scaleColor = $('#dropDownScalesColors option:selected').val();
    //var chordsColor = $('#dropDownChordsColors option:selected').val();
    //var rootColor = $('#dropDownRootColors option:selected').val();

    var keepRoot = (rootColor == "noteKeep");
    var keepChords = (chordsColor == "noteKeep");


    var chordClasses = [];
    var scaleClasses = [];
    var chordNames = [];
    var scaleNames = [];

    for (let i = 0; i < chordFnNotesArr.length; i++) {
        var noteID = (parseInt(chordFnNotesArr[i]) + rootID) % 12;
        var noteName = constNoteNamesArr[noteID];
        if (keepRoot && rootName==noteName){
            console.log("NOT hosing root note by chord: "+noteName);
        } else {
            chordClasses.push(".note" + noteName);
            chordNames.push(noteName);
        }
    }

    for (let i = 0; i < scaleNotesArr.length; i++) {
        var noteID = (parseInt(scaleNotesArr[i]) + rootID) % 12;
        var noteName = constNoteNamesArr[noteID];
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
               rootColor, chordsColor, scaleColor);
}

export function fillChord2(root, chord, scale, rootName, chordNoteNames, scaleNoteNames, rootColor, chordsColor, scaleColor) {
    //the arguments <chordNoteNames> and <scaleNoteNames> are arrays of ".noteBb" etc.

	/** EACH OF THESE IS A COLLECTION OF TD > DIV.NoteDisplay   **/
	var theChordClass = $(chord).children(".NoteDisplay");
    var theScaleClass = $(scale).children(".NoteDisplay");
    var theRootClass = $(root).children(".NoteDisplay");


    if ( rootColor == "noteClear"){
        doFill(theRootClass, rootName, rootColor);
    }
    if ( chordsColor == "noteClear"){
        doFill(theChordClass, chordNoteNames, chordsColor);
    }

    if ( scaleColor != "noteHighlightSingle"){
        doFill(theScaleClass, scaleNoteNames, scaleColor);
    }
    if ( chordsColor != "noteClear" && chordsColor != "noteHighlightSingle"){
        doFill(theChordClass, chordNoteNames, chordsColor);
    }
    if (rootColor != "noteClear"){ doFill(theRootClass, rootName, rootColor); }


    clearAll();
    replay();
    if (chordsColor == "noteHighlightSingle"){
        theChordClass.parent("td.note").addClass("noteHighlightSingle");
    }
    if ( scaleColor == "noteHighlightSingle"){
        theScaleClass.parent("td.note").addClass("noteHighlightSingle");
    }
}

export function doFill(theClass, NoteNames, Color){
    if (Color == "noteKeep"){
        return;
    }
    var currSection = getCurrentSection();
    if (Color != "noteClear") {
        //NO: let replay color the notes.  We are just adding them to the model here.
        //theClass.addClass(lookupUserColorClassByClass(Color))
		//             .addClass("NoteActive");
        Object.keys(NoteNames).forEach(key => {
            var noteName = NoteNames[key];
            currSection.namedNotes[noteName] = {"noteName": noteName, "colorClass": Color};
        });
    } else {
        eraseNamedNote(theClass);
        Object.keys(NoteNames).forEach(key => {
            currSection.namedNotes[NoteNames[key]] = {};
        });
    }
}

//=================================END-of-FILE========================================
