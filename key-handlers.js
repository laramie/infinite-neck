/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */

function document_keyup(evt) {
    if (evt.keyCode == 27) {  // ESC key
        leaveFullscreen();
        hideCmdLine();
        hideAllMenuDivs();
        $("#btnLoopFrames").focus();
    }
}

const FONT_INCREMENT = 1;
const DEFAULT_NOTE_FONT_SIZE = 22;  // Keep in sync with infinite-neck.css :root --named-note-font-size: 22pt;  Here "pt" is glued on by code below.

var gNoteFontSize = DEFAULT_NOTE_FONT_SIZE;

var gFontSize = 10;

function document_keypress(e) {
    if (event.keyCode == 13) {
        //alert(this.value);
        event.preventDefault();
    }
    var tag = e.target.tagName.toLowerCase();
    if ( tag != 'input' && tag != 'textarea'){
        switch (e.key){
            case "m":
            case "M":
                showCmdLine();
                e.preventDefault();
                break;
            case "a":
                toggleCaption();
                break;
            case "A":
                toggleInstrumentCaptionRow();
                break;
            case "b":
            case "B":
                gSong.prevBeat();
                break;
            case "c": //"_C_olor"
                $("#cbAutomaticColor").click();
                break;
            case "n":
            case "N":
                gSong.nextBeat();
                break;
            case "<":
            case ",":
                gSong.gotoPrevFrame(false);
                break;
            case ">":
            case ".":
                gSong.gotoNextFrame(false);
                break;
            case "[":
                checkRB('#idMidiPitches');
                break;
            case "]":
                checkRB('#idMidiPitchesSingle');
                break;
            case "p":
            case "P":
                showOneMenu("#palette");
                break;
            case "s":
            case "S":
                showOneMenu("#divSectionControls");
                break;
            case "l":
            case "L":
                toggleLoopFrames();
                break;
            case "i":
                showOneMenu("#divFillNotes");
                break;
            case "k":
                 cycleThruKeys(1);
                 highlightOneNote(gSong.getRootNoteName());
                 break;
            case "K":
                cycleThruKeys(-1);
                highlightOneNote(gSong.getRootNoteName());
                break;
            case "f":
            case "F":
                toggleFullscreen();
                break;
            case "t":
                toggleTransport();
                break;
            case "u":
            case "D":  //SHIFT-D is the same as "up"
                if ( ! $("#cbTransposeNotes").prop("checked")){
                    break;
                }
                transpose(1);
                break;
            case "U": // SHIFT-U is the same as "down"
            case "d":
                if ( ! $("#cbTransposeNotes").prop("checked")){
                    break;
                }
                transpose(-1);
                break;
            case "j":  //for "Jump strings"
                if ( ! $("#cbTransposeNotes").prop("checked")){
                    break;
                }
                 transpose(5);
                 break;
            case "J":
                if ( ! $("#cbTransposeNotes").prop("checked")){
                    break;
                }
                transpose(-5);
                break;
            case "W":
                if($('#dropDownCellWidth option:selected').prev().length>0)
                     $('#dropDownCellWidth option:selected').prev().attr('selected', 'selected').trigger('change');
                 break;
            case "w":
                    if($('#dropDownCellWidth option:selected').next().length>0)
                         $('#dropDownCellWidth option:selected').next().attr('selected', 'selected').trigger('change');
                    else
                         $('#dropDownCellWidth option').first().attr('selected', 'selected').trigger('change');
                 break;
            case "H":
                    if($('#dropDownCellHeight option:selected').prev().length>0)
                         $('#dropDownCellHeight option:selected').prev().attr('selected', 'selected').trigger('change');
                break;
            case "h":
                    if($('#dropDownCellHeight option:selected').next().length>0)
                         $('#dropDownCellHeight option:selected').next().attr('selected', 'selected').trigger('change');
                    else
                         $('#dropDownCellHeight option').first().attr('selected', 'selected').trigger('change');
                break;
            case "v":
            case "V":
                showOneMenu("#divViewControls");
                break;
            case "q":
                $('#divQuick').toggle();
                break;
            case "/":
                setMenuAtRoot();
                clearCmdResults();
                showCmdLine();
                var menu = gMenuPointer;
                var childCaptions = buildChildMenuCaptionsRow(menu);
                updateCmdLineView();
                event.preventDefault();
                break;
            case "1":
                //select radio button with value e.key, which will be one of 12345, with 5 representing "T".
                $("#rbFinger1").attr('checked', 'checked');
                checkRB("#idRFinger1");
                break;
            case "2":
                $("#rbFinger2").attr('checked', 'checked');
                checkRB("#idRFinger2");
                break;
            case "3":
                $("#rbFinger3").attr('checked', 'checked');
                checkRB("#idRFinger3");
                break;
            case "4":
                $("#rbFinger4").attr('checked', 'checked');
                checkRB("#idRFinger4");
                break;
            case "5":
                $("#rbFingerT").attr('checked', 'checked');
                checkRB("#idRFingerT");
                break;
            case "6":
                checkRB("#idNamedNotes");
                break;
            case "7":
                checkRB("#idSingleNotes");
                break;
            case "8":
                checkRB("#idTinyNotes");
                break;
            case "9":
                checkRB("#rbBend");
                break;
            case "0":
                cycleThruNutWidths(-1);
                break;
            case "=":
                increaseUIFont();
                break;
            case "-":
                decreaseUIFont();
                break;
            case "+":
                increaseNoteFont();
                break;
            case "_":
                decreaseNoteFont();
                break;
            case ")":
                gNoteFontSize = DEFAULT_NOTE_FONT_SIZE;
                setOneCssVar("--named-note-font-size",""+gNoteFontSize+"pt");
                updateFontLabel();
                break;
            default:
        }
    }
}

//=============== Handlers for CmdMenu =========================================
   	//  performCmdAction :: take a menuItem and user entered trigger and perhaps a value, and perform some action in this engine.
   	//
   	//  getValue :: turn a string Get request from a menu into a value.
	//


// Called by the CmdMenu whenever someone has a string that identifies an "action".
function performCmdAction(menuItem, args){
	var actionResult = {};
	actionResult.result = "";
	actionResult.menuItem = menuItem;
	actionResult.args = args;
	actionResult.popOnBang = false;

	if (menuItem.popOnBang){
		actionResult.popOnBang = true;
	}
	var argByInputID = (args && menuItem && menuItem.input) ? args[menuItem.input.id] : undefined;
	switch (menuItem.action){
		case "setupOpenFile":
			document.getElementById('fileInput').click();
			break;
		case "lock":
            //right now just unlocks "Allow keyboard transposing..."  but there could be other things to lock down in a "song".
            $("#cbTransposeNotes").prop("checked", false);
			break;
		case "unlock":
            $("#cbTransposeNotes").prop("checked", true);
			break;
		case "downloadPlayedNotes":
			downloadPlayedNotes();
			break;
		case "setSongName":
			if (argByInputID){
				$("#txtFilename").val(argByInputID).change();
			}
			break;

		case "setSectionCaption":
			getCurrentFrame().caption = argByInputID;
			updateFramesStatus();
			break;
		case "firstSection":
			gSong.firstFrame();
            clearAndReplayFrame();
			actionResult.result = ""+(getFramesCurrentIndex()+1);
			break;
		case "prevSection":
			gSong.gotoPrevFrame(false);  //calls clearAndReplayFrame();
			actionResult.result = ""+(getFramesCurrentIndex()+1);
			break;
		case "nextSection":
			gSong.gotoNextFrame(false);  //calls clearAndReplayFrame();
			actionResult.result = ""+(getFramesCurrentIndex()+1);
			break;
		case "lastSection":
			gSong.lastFrame();
            clearAndReplayFrame();
			actionResult.result = ""+(getFramesCurrentIndex()+1);
			break;
        case "transposeSong":
            if (argByInputID){
				var amount = toInt(argByInputID, 0);
				if (amount != 0){
				    transposeSong(amount);
                    actionResult.result = "transposed "+amount;
				}
			}
            break;
        case "transposeSongKeys":
            if (argByInputID){
				var amount = toInt(argByInputID, 0);
				if (amount != 0){
				    transposeSongKeys(amount);
                    actionResult.result = "transposed keys "+amount;
				}
			}
            break;
		case "setBPM":
			if (argByInputID){
				var bpm = toInt(argByInputID, 0);
				if (bpm > 0){
					setBPM(bpm);
					restartLoopFrames();
				}
			}
			actionResult.result = getBPM();
			break;
		case "setNamedNoteOpacity":
			actionResult.result = "ERROR";
			if (argByInputID){
				var opacity = toInt(argByInputID, -1);
				if (opacity > -1 && opacity<101){
					setNamedNoteOpacity(0.01*opacity);
					actionResult.result = getSong().namedNoteOpacity;
				}
			}
			break;
		case "setSingleNoteOpacity":
			actionResult.result = "ERROR";
			if (argByInputID){
				var opacity = toInt(argByInputID, -1);
				if (opacity > -1 && opacity<101){
					setSingleNoteOpacity(0.01*opacity);
					actionResult.result = getSong().singleNoteOpacity;
				}
			}
			break;
		case "setTinyNoteOpacity":
			actionResult.result = "ERROR";
			if (argByInputID){
				var opacity = toInt(argByInputID, -1);
				if (opacity > -1 && opacity<101){
					setTinyNoteOpacity(0.01*opacity);
					actionResult.result = getSong().tinyNoteOpacity;
				}
			}
			break;
		case "nextBeat":
			gSong.nextBeat();
			actionResult.result = ""+getCurrentFrame().currentBeat;
			break;
		case "prevBeat":
			gSong.prevBeat();
			actionResult.result = ""+getCurrentFrame().currentBeat;
			break;
		case "addBeat":
			addBeat();
			actionResult.result = ""+getCurrentFrame().beats;
			break;
		case "deleteBeat":
			gSong.deleteBeat();
			actionResult.result = ""+getCurrentFrame().beats;
			break;
        case "moveBeatsLater":
			gSong.moveBeatsLater();
			actionResult.result = ""+getCurrentFrame().beats;
			break;
		case "showDialog-song":
			showOneMenu("#divFileControls");//file==song now.
			break;
		case "showDialog-section":
			showOneMenu("#divSectionControls");
			break;
		case "showDialog-fill":
			showOneMenu("#divFillNotes");
			break;
		case "showDialog-view":
			showOneMenu("#divViewControls");
			break;
		case "showDialog-themes":
			showOneMenu("#divThemeControls");
			break;
		case "showDialog-tunings":
			showOneMenu("#divTunings");
			break;
		case "showDialog-palette":
			showOneMenu("#palette");
			break;
		case "toggleTransport":
			toggleTransport();
			break;
		case "viewFullscreen":
			enterFullscreen();
			hideCmdLine();
			break;
		case "toggleFullscreen":
			toggleFullscreen();
			break;
		case "setMenuPrefs":
			console.log("setMenuPrefs:"+JSON.stringify(args));
			var c = args["key"];
			if (c == "s"){ //"short"
				gMenuFile.tall = false;
			} else if (c == "t"){
				gMenuFile.tall = true;
			}
			break;
		case "showViewDiagnostics":
			showMessages(JSON.stringify(getCurrentFrame(), null, 2));
			break;
		case "showViewDiagnosticsFullModel":
			showMessages(JSON.stringify(getSong(), null, 2));
			break;
		case "showViewDiagnosticsMenu":
			showMessages(JSON.stringify(dumpMenus(), null, 2));
			break;
        case "showViewDiagnosticsUserColorDict":
            showMessages(JSON.stringify(gUserColorDict.dict, null, 2));
            actionResult.result = "ColorDictionary sent to Messages";
            break;
        case "showViewDiagnosticsDisplayOptions":
            showMessages(displayOptionsTable());
            actionResult.result = "DisplayOptions sent to Messages";
            break;
        case "showViewDiagnosticsFullModel":
			showMessages(JSON.stringify(getSong(), null, 2));
			break;
		case "showGraveyard":
			showGraveyard();
			break;
		case "hideViewMessages":
            $("#divMessages").hide();
            actionResult.result = "Messages hidden";
            break;

		case "printSections":
            $("#divMessages").show();
			$("#divMessages").html(printSections());
			hideCmdLine();
			break;
		case "sectionDelete":
			var deleted = gSong.deleteCurrentFrame();
			if (deleted){
				actionResult.result = "deleted";
			} else {
				actionResult.result = "cleared";
			}
			break;
		case "sectionAdd":
			console.log("sectionAdd=====!!");
			gSong.newFrame(); //don't call addFrame(frame), which is an internal call.
			actionResult.result = "added";
			break;
		case "sectionAddShallowClone":
			addShallowCloneFrame();
			actionResult.result = "added-shallow";
			break;
		case "sectionAddDeepClone":
			addDeepCloneFrame();
			actionResult.result = "added-deep";
			break;
		case "sectionKeep":
			console.log("sectionKeep=====!");
			actionResult.result = "kept";
			break;
		case "showHelp":
			window.open('help.html','_blank');
			break;
		case "showNamedNotes":
			$("#cbHideNamedNotes").prop("checked", false).change();
			break;
		case "showSingleNotes":
			$("#cbHideSingleNotes").prop("checked", false).change();
			break;
		case "showTinyNotes":
			$("#cbHideTinyNotes").prop("checked", false).change();
			break;
		case "showFingering":
			$("#cbHideFingering").prop("checked", false).change();
			break;
		case "hideNamedNotes":
			$("#cbHideNamedNotes").prop("checked", true).change();
			break;
		case "hideSingleNotes":
			$("#cbHideSingleNotes").prop("checked", true).change();
			break;
		case "hideTinyNotes":
			$("#cbHideTinyNotes").prop("checked", true).change();
			break;
		case "hideFingering":
			$("#cbHideFingering").prop("checked", true).change();
			break;
		case "selectFingering":
			if (args){
				switch (args["key"]){
					case "1":
					    checkRB("#rbFinger1");
						checkRB("#idRFinger1");
						break;
					case "2":
					    checkRB("#rbFinger2");
					    checkRB("#idRFinger2");
						break;
					case "3":
					    checkRB("#rbFinger3");
					    checkRB("#idRFinger3");
						break;
					case "4":
					    checkRB("#rbFinger4");
					    checkRB("#idRFinger4");
						break;
					case "5":
					    checkRB("#rbFingerT");
					    checkRB("#idRFingerT");
						break;
					case "t":
					    checkRB("#rbFingerT");
						checkRB("#idRFingerT");
						break;
				}
			}
			break;
		case "selectRadioNoteType":
			if (args){
				function check(id){
					$(id).prop("checked", true);
				}
				switch (args["key"]){
					case "n":
					    check("#idNamedNotes");
						break;
					case "s":
						check("#idSingleNotes");
						break;
					case "t":
						check("#idTinyNotes");
						break;
					case "b":
						check("#rbBend");
						break;
					case "p":
						check("#idMidiPitches");
						break;
					case "h":
						check("#idMidiPitchesSingle");
						break;
					case "k":
						check("#idKeep");
						break;
					case "c":
						check("#idClear");
						break;
                    case "f":
						check("#idDropper");
                        $("#idDropper").change();
                        //$("#idDropper").prop("checked", true);
						break;
				}
			}
			break;
		case "selectBendType":
			console.log("selectBendType: "+stringifyMenuItem(menuItem));
			$("#selBend").val(menuItem.name);
			$("#rbBend").prop("checked", true);
			break;
		default:
			break;
	}
	return actionResult;
}

function scrollToMessages(){
    var scrollDiv = document.getElementById("divMessages").offsetTop;
    window.scrollTo({ top: scrollDiv, behavior: 'smooth'});
}
function showMessages(html){
    $("#divMessages").show();
    $("#divMessages").html(html);
    hideCmdLine();
    scrollToMessages();
}
function hideMessages(){
    $("#divMessages").hide();
}
function showGraveyard(){
    hideAllMenuDivs();
    showMessages(gSong.graveyard.buildTable());
}
function hideGraveyard(){
    $("#divMessages").hide();
}

function increaseUIFont(){
    ++gFontSize;
    updateUIFont();
}
function decreaseUIFont(){
    --gFontSize;
    updateUIFont();
}
function updateUIFont(){
    $("body").css({"font-size": (gFontSize)+"pt"});
    updateFontLabel();
}
function getUIFontSize(){
    return gFontSize;
}
function setUIFontSize(newValue){
    gFontSize = newValue;
    updateUIFont();
}


function increaseNoteFont(){
    gNoteFontSize += FONT_INCREMENT;
    updateNoteFont();
}
function decreaseNoteFont(){
    if (gNoteFontSize > 0.5){ gNoteFontSize -= FONT_INCREMENT; }
    updateNoteFont();
}
function updateNoteFont(){
    setOneCssVar("--named-note-font-size",""+gNoteFontSize+"pt");
    updateFontLabel();
}
function getNoteFontSize(){
    return gNoteFontSize;
}
function setNoteFontSize(newValue){
    gNoteFontSize = newValue;
    updateNoteFont();
}


function getValue(what){
	switch (what){
		case "currentSectionNumber":
		case "currentFrameIndex":
			return getFramesCurrentIndex();
		case "currentFrameCardinal":
			return getFramesCurrentIndex()+1;
		case "frameCount":
			return getSong().frames.length;
		case "beats":
		case "beatCount":
			return getCurrentFrame().beats;
		case "currentBeat":
			return getCurrentFrame().currentBeat;
		case "getBPM":
			return getBPM();
		case "getNamedNoteOpacity":
			var op = parseFloat(getSong().namedNoteOpacity);
			if (isNaN(op)){
				return "NaN";
			}
			return ""+(op*100);
        case "getSingleNoteOpacity":
            var op = parseFloat(getSong().singleNoteOpacity);
            if (isNaN(op)){
                return "NaN";
            }
            return ""+(op*100);
		case "getTinyNoteOpacity":
            var op = parseFloat(getSong().tinyNoteOpacity);
            if (isNaN(op)){
                return "NaN";
            }
            return ""+(op*100);
		case "getSongName":
			return getSong().songName;
		case "getSectionCaption":
			return getCurrentFrame().caption;
		default:
            console.log("key-handler.js::getValue::no-value-found::default:"+what);
			return what;
	}
}
