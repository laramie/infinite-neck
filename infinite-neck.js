/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */

	// You can draw lines using SVG!
	//  https://stackoverflow.com/questions/56722754/draw-a-line-from-one-element-to-another

	const SHARP = "&#9839;";
	const FLAT = "&#9837;";
	const NATURAL = "&nbsp;";
	const TUNINGS_PFX = "tunings-";

	const STYLENUM_NAMED = 0;
	const STYLENUM_TINY = 1;
	const STYLENUM_SINGLE = 2;
	const STYLENUM_MIDIPITCHES = 3;
	const STYLENUM_MIDIPITCHESSINGLE = 4;
	const STYLENUM_BEND = 5;
	const STYLENUM_FINGERING = 6;

	const NUM_FRETS_MAX = 108;

	const gBEND_CLASSES = "semitone1 semitone2 semitone3 prebend1 prebend2 prebend3 updown1 updown2 updown3"
						  +" semitone1LH semitone2LH semitone3LH prebend1LH prebend2LH prebend3LH updown1LH updown2LH updown3LH";

	const gNoteNamesArr       = "A,Bb,B,C,Db,D,Eb,E,F,Gb,G,Ab".split(',');

	const gNoteNamesArrFlats = "A,B<small>&#9837;</small>,B,C,D<small>&#9837;</small>,D,E<small>&#9837;</small>,E,F,G<small>&#9837;</small>,G,A<small>&#9837;</small>".split(',');

	const gNoteNamesArrSharps = "A,A<small>&#9839;</small>,B,C,C<small>&#9839;</small>,D,D<small>&#9839;</small>,E,F,F<small>&#9839;</small>,G,G<small>&#9839;</small>".split(',');

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
	var noteNamesFuncArr = noteNamesFuncArrDEFAULT;

	function styleNumToCaption(styleNum){
		switch(styleNum){
			case STYLENUM_NAMED:
				return "Named";
			case STYLENUM_TINY:
				return "Tiny";
			case STYLENUM_SINGLE:
				return "Single";
			case STYLENUM_MIDIPITCHES:
				return "Pitch";
			case STYLENUM_MIDIPITCHESSINGLE:
				return "Multi";
			case STYLENUM_BEND:
				return "Bend";
			case STYLENUM_FINGERING:
				return "Fingering";
		}
		return "Unknown"+styleNum;
	}

	function noteNameToNoteID(noteName){
		return gNoteNamesArr.indexOf(noteName);
	}

	function noteIDToNoteName(noteIndex){
		var noteName;
		if (gSong.getCurrentFrame().sharps){
	        noteName = gNoteNamesArrSharps[noteIndex];
	    } else {
	        noteName = gNoteNamesArrFlats[noteIndex];
	    }
		return noteName;
	}

	function noteIDToNoteNameRaw(noteIndex){
		return gNoteNamesArr[noteIndex];
	}

	//==========================================================================

	var gSharps = false;

	var gSong = null;  //constructed in document ready.

	function getCurrentFrame(){
	    return gSong.getCurrentFrame();
	}

	function getFramesCurrentIndex(){
	    return gSong.getFramesCurrentIndex();
	}

	function getFrames(){
	    return gSong.getFrames();
	}
	function getSong(){
		return gSong;
	}

	//==========================================================================

	function buildDropDownSectionOrderOptions(){
		var len = gSong.getFrames().length;
		var curr = gSong.getFramesCurrentIndex();
		var result = "<option value='BEGIN'>BEGIN</option>";
		for (var i=0; i<len; i++){
			var iStr = ""+(i+1);
			if (i==curr){
				result += "<option value='"+i+"' selected>"+iStr+"</option>";
			} else {
				result += "<option value='"+i+"'>"+iStr+"</option>";
			}
		}
		result += "<option value='END'>END</option>";
		return result;
	}

	function showHideDisplayOptionsPresent(){
		var options = getCurrentFrame().displayOptions;
		if (options){
			$('#btnDeleteDisplayOptions,#btnDeleteDisplayOptions2').prop("disabled",false);
		} else {
			$('#btnDeleteDisplayOptions,#btnDeleteDisplayOptions2').prop("disabled",true);
		}
	}

	function frameChanged(){
		$('#dropDownSectionOrder').html(buildDropDownSectionOrderOptions());
		$("#dropDownRoot").val(getCurrentFrame().rootID);
	    $("#dropDownRootLead").val(getCurrentFrame().rootIDLead);
		var options = getCurrentFrame().displayOptions;
		if (options){
			displayOptionsToControls(options);
		}
		showHideDisplayOptionsPresent();
	    gSong.gotoFirstBeat();
	    showHighlightsForBeat(gSong.getBeat());
	    updateFramesStatus();
	}

	function updateFramesStatus(){
		$(".lblFramesStatusFrameNo").html(""+(gSong.getFramesCurrentIndex()+1));
	    var txt = ""+(gSong.getFramesCurrentIndex()+1)+"/"+ gSong.frames.length;
	    $("#lblFramesStatus").html(txt);
	    $("#lblFramesStatus2").html(txt);
	    $("#txtBeatsPer" ).val(gSong.getBeats());
		$("#lblBeats").html(gSong.getBeats());
	    var jLblCurrentBeat = $("#lblCurrentBeat");
	    jLblCurrentBeat.text("1");
	    $("#lblBeat").html("1");

	    //clearRecordedNotes();
	    $("#txtCaption").val(gSong.getCurrentFrame().caption);
	    var key =  gSong.getCurrentFrame().rootID;
	    var rawCaption = gSong.getCurrentFrame().caption;
		var caption = eval("\`"+rawCaption+"\`");
	    $(".lblSectionCaption").html(caption);

		var currentFilename = $("#txtFilename").val();
	    $(".lblSongName").html(currentFilename);
		//gSong.songName = currentFilename;

		var rootIndex = toInt(gSong.getCurrentFrame().rootID, 0);
	    var rootIndexLead = toInt(gSong.getCurrentFrame().rootIDLead, 0);
		var keyname = noteIDToNoteName(rootIndex);
		var keynameLead = noteIDToNoteName(rootIndexLead);

	    $(".lblRootID").html(keyname);

	    var spans = $(".spanLeadDifferentFromRoot");
	    if (gSong.getCurrentFrame().rootIDLead != "-1"){
	        spans.html("lead key: "+keynameLead);
	        spans.show();
	        $(".lblRootIDLead").html(keynameLead).show();
	    } else {
          spans.hide();
          $(".lblRootIDLead").hide();//zanzibar
	    }
		showHideDisplayOptionsPresent();
	}

	function clearAndReplayFrame(){
		gSong.gotoFirstBeat();
		clearAll();
		resetNoteNames(); //calls replay()
		updateFramesStatus();
		showBeats();
		//prevFrame calls this: updateFramesStatus();

	}

	function showBeats(){
		var beat = gSong.getBeat();
		$("#lblBeat").html(""+beat);
		$("#lblCurrentBeat").text(""+beat);
		showHighlightsForBeat(beat);
	}

	function getMillisForCurrentFrame(){
	    var beats = DEFAULT_BEATS_PER;
	    var sBeats = getCurrentFrame().beats;
	    if (sBeats){
	        beats = parseInt(sBeats);
	    }

	    var bpm = getBPM();
	    var millisNextTimeout = (beats/bpm)*60*1000;
	    return millisNextTimeout;
	}

	function showBPM(){
		$(".bpm").html(getSong().defaultBPM+"<small>bpm</small>");
	}

	function setBPM(newValue){
		$("#txtBPM").val(newValue);
		getSong().defaultBPM = ""+newValue;
		showBPM();
	}

	function getBPM(){
	    var sBpm = $("#txtBPM").val();
	    var bpm = parseInt(sBpm);
	    if (Number.isNaN(bpm) || bpm == 0){
	        bpm = DEFAULT_BPM;
	    }
	    getSong().defaultBPM = ""+bpm;
	    return bpm;
	}

	function getMillisForBeatClock(){
	    var bpm = getBPM();
	    var fBpm =  (1/bpm)*60*1000;
	    return fBpm;
	}

	function reloadAllTuningsDisplay(){
	    var div = $('#divAllTunings');
	    div.empty();
	    div.append(dumpTuningsToTable(gSong.getTuningHashInMemoryModel()));
	    bindFormTuningsEvents();
	}

	function resetSharpsControls() {
	    //turn all to sharps
	    $(".ddnAb").html("G<small>&#9839;&nbsp;</small>");
	    $(".ddnBb").html("A<small>&#9839;&nbsp;</small>");
	    $(".ddnDb").html("C<small>&#9839;&nbsp;</small>");
	    $(".ddnEb").html("D<small>&#9839;&nbsp;</small>");
	    $(".ddnGb").html("F<small>&#9839;&nbsp;</small>");
	}

	function resetFlatsControls() {
	    //turn all to flats
	    $(".ddnAb").html("A<small>&#9837;</small>");
	    $(".ddnBb").html("B<small>&#9837;</small>");
	    $(".ddnDb").html("D<small>&#9837;</small>");
	    $(".ddnEb").html("E<small>&#9837;</small>");
	    $(".ddnGb").html("G<small>&#9837;</small>");
	}

	function resetSharps(options) {
	    buildCells(gSharps, options);
	    resetSharpsControls();
	}

	function resetFlats(options) {
	    buildCells(gSharps, options);
	    resetFlatsControls();
	}


	function resetNoteNames() {
	    var options = {};
	    var rootID = getCurrentFrame().rootID;
	    gSharps = getCurrentFrame().sharps;
	    if (rootID!=null && ((""+rootID).length>0)) {
	        options.rootID = rootID;
			options.rootIDLead = getCurrentFrame().rootIDLead;//20240423
	        //console.log("=========Using rootID from getCurrentFrame(): "+rootID+" ");
	    } else {
	        var optVal = $('#dropDownRoot  option:selected').val();
			var rootIDLead = $("#dropDownRootLead").val();
	        options.rootID = parseInt(optVal);
			options.rootIDLead = toInt(rootIDLead, -2);
	        //console.log("==========NOT Using rootID:"+rootID+", using dropDownRoot value instead: "+optVal+" options.rootID: "+options.rootID);
	        getCurrentFrame().rootID = options.rootID;
	        getCurrentFrame().rootIDLead = options.rootIDLead;
	    }
	    options.showCellNotes = $("#cbShowCellNotes").prop("checked");
	    options.subscripts = $("#cbSubscripts").prop("checked");
	    options.showSubscriptPitches = $("#cbShowSubscriptPitches").prop("checked");
	    options.showSubscriptFunctions = $("#cbShowSubscriptFunctions").prop("checked");
	    options.cellIsFunction = ($('input[name="rbnFunctionNotename"]:checked').val() == "showFunction");
	    options.showMidiNum = $("#cbMidiNum").prop("checked");
		options.useCenterForRightFunction = $("#cbCenterForRightFunction").prop("checked");
		options.NoteDisplaySizes = {"width":$("#dropDownCellWidth").val(),"height":$("#dropDownCellHeight").val()};
		options.naturalFretWidths = $("#cbNaturalFretWidths").prop("checked");
		options.naturaFontScaling = toInt($('#selNaturaFontScaling option:selected').val(), 45);

	    if (gSharps) {
	        resetSharps(options);
	        resetSharpsControls();
	    } else {
	        resetFlats(options);
	        resetFlatsControls();
	    }
		if ($("#rbNotename").prop("checked")) {
			$('#btnNoteV').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
			$('#btnFuncV').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
		} else if ($("#rbFunction").prop("checked")) {
			$('#btnFuncV').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
			$('#btnNoteV').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
		}
		replay();
	}

	function buildCells(sharps, options) {
		activityRebuild();
	    if (sharps) {
	        buildCellsFromSelector("td.noteAb", "G", SHARP, 11, options);
	        buildCellsFromSelector("td.noteBb", "A", SHARP, 1, options);
	        buildCellsFromSelector("td.noteDb", "C", SHARP, 4, options);
	        buildCellsFromSelector("td.noteEb", "D", SHARP, 6, options);
	        buildCellsFromSelector("td.noteGb", "F", SHARP, 9, options);
	    } else {
	        buildCellsFromSelector("td.noteAb","A", FLAT, 11, options);
	        buildCellsFromSelector("td.noteBb","B", FLAT, 1, options);
	        buildCellsFromSelector("td.noteDb","D", FLAT, 4, options);
	        buildCellsFromSelector("td.noteEb","E", FLAT, 6, options);
	        buildCellsFromSelector("td.noteGb","G", FLAT, 9, options);
	    }
	    buildCellsFromSelector("td.noteA","A", NATURAL, 0, options);
	    buildCellsFromSelector("td.noteB","B", NATURAL, 2, options);
	    buildCellsFromSelector("td.noteC","C", NATURAL, 3, options);
	    buildCellsFromSelector("td.noteD","D", NATURAL, 5, options);
	    buildCellsFromSelector("td.noteE","E", NATURAL, 7, options);
	    buildCellsFromSelector("td.noteF","F", NATURAL, 8, options);
	    buildCellsFromSelector("td.noteG","G", NATURAL, 10, options);
		activityRebuildDone();
	}

	//list of menu divs, accessed through .entries(), and associated button names,
	//  accessed through selectors stored in values with menu as key: AllMenuDivs[strMenuDiv]
	const AllMenuDivs = {
		"#palette": "#btnPalette",
		"#divFileControls": "#btnFileControls",
		"#divSectionControls": "#btnSectionControls",
		"#divViewControls": "#btnViewControls",
		"#divThemeControls": "#btnThemeControls",
		"#divFillNotes": "#btnFillNotes",
		"#divTunings": "#btnTunings",
		"#divDesktop": "#btnDesktop"
	}

	function hideAllMenuDivs(){
		for (const [key, value] of Object.entries(AllMenuDivs)){
			$(key).hide();
		}
		$('.MainMenuTabBtn').removeClass("BtnPunchedIn").addClass("BtnPunchedOut");
	    //$("#topControlsCaptions").show();
	 }

	 function showOneMenu(strMenuDiv){
		 var wasFull = leaveFullscreen();
		 var jStrMenuDiv = $(strMenuDiv);
		 if (wasFull){
			 hideAllMenuDivs();
			 jStrMenuDiv.show();
		 } else {
		     if (jStrMenuDiv.is(":visible") ){
				 hideAllMenuDivs();
		     } else {
				 hideAllMenuDivs();
		         jStrMenuDiv.show();
				 $(AllMenuDivs[strMenuDiv]).addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
		     }
		 }
		 //$("#topControlsCaptions").hide();
		 scrollToTop();
	 }

	 function getHelpTopic(){
		 var anchor = "";
		 for (const [key, value] of Object.entries(AllMenuDivs)){
			 var jStrMenuDiv = $(key);
			 if (jStrMenuDiv.is(":visible")){
			 	anchor = key;
				break;
 			 }
 		 }
		 return  'help.html'+anchor;
	 }

	function exportFromTable(tblSource){
		gSong.markVisibleTablesForFileSave();
		for (tableDestKey in getSong().visibleTables){
			var tableDest = getSong().visibleTables[tableDestKey];
			if (tblSource != tableDest){
				//console.log("src:"+tblSource+", dest:"+tableDest);
				exportPlayedNotesToOtherTable(tblSource, tableDest);
			}
		}
	}

	function exportPlayedNotesToOtherTable(tblSource, tblDest){
	  var noteArr = gSong.getTableArrInCurrentFrame(tblSource);
	  for (key in noteArr){
	      var noteCell = noteArr[key];
	      //console.log("exportPlayedNotesToOtherTable "+noteCell.midinum+","+noteCell.row);
	      var jtd = showMidiNotesInTable(tblDest, noteCell.midinum, noteCell.row);
	      //colorNote(jtd);



	      colorSingleNotes(jtd, noteCell.colorClass, noteCell.styleNum, false);
	  }
	}



  function turnOnKeep(){
      $("#idKeep").prop("checked", true);
  }

  function hideNoteClickedCaption(){
     $(".lblNoteClickedCaption").hide();
  }

  function setNoteClickedCaption(cell, theColorClass, styleNum){
      var caption = "";
      if (cell.attr('midinum')){
          $(".lblNoteClickedCaption").show();
		  var celltable = cell.attr('celltable');
		  if (celltable){
			  celltable = celltable.substring("lbl".length);
		  }
          caption = " "
                   +cell.attr('noteName')+'&nbsp;&nbsp;&nbsp;<small>'+celltable+'</small>['
	                 +(parseInt(cell.attr('cellrow'))+1)+','
	                 +cell.attr('cellcol')+']&nbsp;<small>midi:</small>'
	                 +cell.attr('midinum')
					 +'&nbsp;<small>'+styleNumToCaption(styleNum)+':'+theColorClass+'</small>' ;
	    }
      $(".lblNoteClickedCaption").html(caption);
   }

  	function getBeatNumber(){
		return $("#lblCurrentBeat").text();
	}

	function doingAutomaticColor(){
		return $("#cbAutomaticColor").prop("checked");  //automaticColorScheme
	}

	function turnOffHiding(){
	    var hideNamedNotes = $("#cbHideNamedNotes").prop("checked");
	    var hideTinyNotes = $("#cbHideTinyNotes").prop("checked");
	    var hideSingleNotes = $("#cbHideSingleNotes").prop("checked");
	    var hideFingering = $("#cbHideFingering").prop("checked");
	    $("#cbHideNamedNotes").prop("checked", false);
	    $("#cbHideTinyNotes").prop("checked", false);
	    $("#cbHideSingleNotes").prop("checked", false);
	    $("#cbHideFingering").prop("checked", false);
	    $("#lblHideWarning").hide();
	    if (hideNamedNotes || hideTinyNotes || hideSingleNotes || hideFingering){
	        clearAll();
	        replay();
	    }
  	}

	function updateMemoryModelPreFileSave(){
	    gSong.markVisibleTablesForFileSave();
	    gSong.removeUnusedTablesFromMemoryModel();
	    getBPM();
	    gSong.songName = $("#txtFilename").val();  //TODO: move this to a more obvious function.
		gSong.userColors = gUserColorDict.dict;
		gSong.theme = $('#selThemes').val();
	}

    // file save / save file / saveFile event
	function downloadPlayedNotes(){
	    updateMemoryModelPreFileSave();
	    var text = JSON.stringify(getSong(), null, 2); // Create element. (with 2 spaces indentation)
	    //console.log("saved file:\r\n"+text);
		var a = document.createElement('a'); // Attach href attribute with value of your file.
	    a.setAttribute("href", "data:application/xml;charset=utf-8," + text);
	    // HTML5 property, to force browser to download it.
	    var fname = "";
	    fname = $("#txtFilename").val().trim();
	    if (fname==""){
	        fname = "untitled";
	    }
	    a.setAttribute("download", fname+".json");
	    a.click();
	    hideAllMenuDivs();
	}

    // file open / open file / openFile event
	function setupOpenFile(){
	  	var fileInput = document.getElementById('fileInput');
		fileInput.addEventListener('change', function(e) {  //click works, but is too jumpy. change doesn't work when you apply same file.
		    var file = fileInput.files[0];
			var textType = /json.*/;
			if (file.type.match(textType)) {
				var reader = new FileReader();
				reader.onload = function(e) {
					var str = JSON.stringify(reader.result, null, 2); // spacing level = 2
					openSong(reader.result);
				}
				hideAllMenuDivs();
				reader.readAsText(file);
			} else {
				console.log("File not supported!"+file.name);
			}
        });
	}

	function openSong_ORIGINAL(str){
		var numFoundBeforeFileLoad = showTuningsForTablesInFile();
		//in current "file" which is in-memory obj of anything user was noodling with before opening a file.
		if (numFoundBeforeFileLoad==0){
		  hideAllTunings();
		  //console.log("hiding all tunings on file load");
		}
		var jsonObj = JSON.parse(str);
		var frs = [];
		for (var k in jsonObj.frames){
			var frame = jsonObj.frames[k];
			var replacementFrame = gSong.constructFrame();
			frame = Object.assign(replacementFrame, frame);
			frs.push(frame);
		}
		jsonObj.frames = frs;
		if (!gSong.isEmpty(gSong.getCurrentFrame())){
			var yes = confirm("Keep previous Song Sections? \n( 'Cancel' deletes !! \nOtherwise, 'OK' adds new Song Sections at end of current Song Sections.)");
			if (!yes){
				gSong.removeAllFrames();
			}
		}
		gSong.addFrames(jsonObj);
		//todo: this means we are manually adding all things from file jsonObj individually,
		//      rather than having JSON fill in our whole song object then doing fixup(). Uggg.
		hideGraveyard();
		Object.assign(gSong.graveyard, jsonObj.graveyard);
		Object.assign(gSong.colorDicts, jsonObj.colorDicts);
		installDefaultColorDicts();

		readOptionsFromFile(jsonObj);
		applyStylesheetsTo_gUserColorDict();
		buildColorDicts();
		resetNoteNames();
		updateFramesStatus();
		replay();
		var tuningsShowing = showTuningsForTablesInFile();
		if (tuningsShowing == 0){
			console.log("showDefaultTuning because file load found none");
			showDefaultTuning();
		}
	}
	function openSong(str){
		var numFoundBeforeFileLoad = showTuningsForTablesInFile();
		if (numFoundBeforeFileLoad==0){
		  hideAllTunings();
		}
		var jsonObj = JSON.parse(str);
		Object.assign(gSong, jsonObj)
		var frs = [];
		for (var k in jsonObj.frames){
			var frame = jsonObj.frames[k];
			var replacementFrame = gSong.constructFrame();
			frame = Object.assign(replacementFrame, frame);
			frs.push(frame);
		}
		jsonObj.frames = frs;
		if (!gSong.isEmpty(gSong.getCurrentFrame())){

			var yes = $("#cbAppendSections").prop("checked");
			//var yes = confirm("Keep previous Song Sections? \n( 'Cancel' deletes !! \nOtherwise, 'OK' adds new Song Sections at end of current Song Sections.)");
			if (!yes){
				gSong.removeAllFrames();
			}
		}
		gSong.addFrames(jsonObj);
		gSong.graveyard = makeGraveyard(gSong.graveyard);
		updateAfterOpenSong();
	}
	function updateAfterOpenSong(){
		hideGraveyard();
		installDefaultColorDicts();

		$('#selThemes').val(gSong.theme).change();
		$("#txtFilename").val(gSong.songName).change();
		setBPM(gSong.defaultBPM);

		applyStylesheetsTo_gUserColorDict();
		buildColorDicts();


		var tuningsShowing = showTuningsForTablesInFile();
		if (tuningsShowing == 0){
			console.log("showDefaultTuning because file load found none");
			showDefaultTuning();
		}

		replay();
		frameChanged();
	}

	function installDefaultColorDicts(){
		gSong.colorDicts["All-Clear"] = gAllClear;
		gSong.colorDicts["CycleOfColors"] = gDefault_CycleOfColors;
		gSong.colorDicts["Roles"] = gUserColorDictRolesDefault;
		gSong.colorDicts["Fingerings"] = gUserColorDictFingeringsDefault;
		gSong.colorDicts["Default"] = gUserColorDictOEM;
	}


	function loadSong(songName){
		$.get( "songs/"+songName, function( data ) {  //jQuery automatically calls something like JSON.parse and turns the result into a real javascript Object.
			if (!gSong.isEmpty(gSong.getCurrentFrame())){
				var yes = confirm("Keep previous Song Sections? ( 'Cancel' deletes !! Otherwise, 'OK' adds new Song Sections at end of current Song Sections.)");
				if (!yes){
					gSong.removeAllFrames();
				}
			}
			openSong(JSON.stringify(data));
		});
	}

	function songLibrary(){
		var divSongList = $('#divSongList');
		if (divSongList.is(":visible") && divSongList.html().trim().length > 0){
			divSongList.hide();
		} else {
			$.get( "songs/song-list.json", function(data){
				var result = "";
				for (var k in data.songs){
						var song = data.songs[k];
						result = result + "<a href='javascript:loadSong(\""+song+"\")'>"+song+"</a><br />";
				}
				$('#divSongList').html(result).show();
			});
		}
	}

	function installAllTuningsTables(){
		var count = 0;
	    for (i in allTunings.tunings){
			var div = buildTable(allTunings.tunings[i]);
			if (div){
		        $('#tabledest').append(div);
				count++;
			}
	    }
		if (count==0){
			var warning = $("<div class='warningMessage'>");
			warning.html("No tunings chosen: click the Tunings button.");
			$('#tabledest').append(warning);
		}
	}

	function resinstallAllTuningsTables(){
	        var target = $("#tabledest");
	        target.empty();
	        installAllTuningsTables();
	        installTDNoteClick();
			installBtnHamburgerClicks();
	        clearAll();
	        resetNoteNames();
	        showhideTunings();
	}

	function installTDNoteClick(){
	    $('td.note').click(function() {
	        colorNote($(this));
	        event.stopPropagation();
	    });
	}

	function installRBColorChangeEvents(){
		$( 'input[name="rbColor"]:radio' ).change(function() {
			if ("noteKeep" === $(this).val()){
			} else if ("noteDropper" === $(this).val()){
				$("td.note").css({"cursor": "zoom-in"});
			} else {
				$("td.note").css({"cursor": "pointer"});
				turnOffHiding();
			}
		});
		$( 'input[name="rbColor"]' ).click(function() {
			$('input[name="rbColor"]').css({"box-shadow": "none"});
			$("td.note").css({"cursor": "auto"});
		});
	}


  function addBeat(){
          clearHighlights();
          var jLblCurrentBeat = $("#lblCurrentBeat");
	        var sBeats = $("#txtBeatsPer").val();
	        if (sBeats == ""){
	            $("#txtBeatsPer").val("1");
	            sBeats = $("#txtBeatsPer").val();
	            jLblCurrentBeat.text("1");
	            $("#lblBeat").html("1");
				$("#lblBeats").html(sBeats);
	            return;
	        }
	        var sCurrBeat = jLblCurrentBeat.text();
	        var currBeat = parseInt(sCurrBeat);
	        var beats = parseInt(sBeats);
	        if (currBeat == beats){
	                beats++;
	                currBeat++;
	                $("#txtBeatsPer").val(beats);
					$("#lblBeats").html(beats);
	                jLblCurrentBeat.text(currBeat);
	                $("#lblBeat").html(currBeat);
	        } else if (currBeat < beats) {
	                beats++;
	                $("#txtBeatsPer").val(beats);
					$("#lblBeats").html(beats);
	        }
			getCurrentFrame().beats = beats;
			$('#lblBeats').html(beats);
			showBeats();
  }

	// see also: song.js :: cycleThruKeysAllFrames()
	function cycleThruKeys(amount){
		var curr = toInt(getCurrentFrame().rootID, 0);
		curr=(12+curr + amount) % 12;
		getCurrentFrame().rootID = curr;
		$("#dropDownRoot").val(getCurrentFrame().rootID);
		resetNoteNames();
		clearRecordedNotes();//for some reason this clears highlights correctly, and used to be in updateFramesStatus, but didn't belong there.
		updateFramesStatus();
	}

	function leaveFullscreen(){
		var wasVisible =  $('.container').is(':visible');
		$('.container').show();
		$("#tabledestTopPad").hide();
		$("#divESCAPE").hide();
		return !wasVisible;
	}
	function enterFullscreen(showESCButton){
		$('.container').hide();
		$("#tabledestTopPad").show();
		if (showESCButton){ // undefined ==> false
			$("#divESCAPE").show();
		}
	}
	var gCaptionsRowShowing = false;
	function toggleFullscreen(){
		var wasVisible =  $('.container').is(':visible');  //container holds the menu buttons, so NOT fullscreen when visible.
		$('.container').toggle();
		if (wasVisible){
			gCaptionsRowShowing = $('.captionRow').is(":visible");
			$('.captionRow').hide();
			$("#tabledestTopPad").show();
		} else {
			if (gCaptionsRowShowing){
				$('.captionRow').show();
			} else {
				$('.captionRow').hide();
			}
			$("#tabledestTopPad").hide();
			$("#divESCAPE").hide();
		}
	}
	function toggleTransport(){
		//var wasVisible =  $('.transport').is(':visible');
		$('#transport').toggle();
	}
	function toggleCaption(){
		$('#topControlsCaptions').toggle();
	}
	function toggleInstrumentCaptionRow(){
		$('.captionRow').toggle();
	}

	var gFretLengths = [];
	function populateFretLengthArray(){
		var width = 60;
		var L0 = 1;  //tuned length, (L-sub-zero)
		const MAGIC_RATIO = 0.9438743;      //hand calculated from equation for fret ratios.
		const FIRSTFRET_LENGTH = 0.05297;   //hand calculated from equation for fret ratios.

		for (var n=2; n<=NUM_FRETS_MAX+1; n++){
			var Cn = (Math.pow(MAGIC_RATIO, n));
			var Cnm1 = (Math.pow(MAGIC_RATIO, (n-1)));
			var R = (L0*(1-Cn)-L0*(1-Cnm1))/FIRSTFRET_LENGTH ; //0.05297 is the length of the first fret, if tuned length is 1.
			gFretLengths.push(R);
		}
	}

	function transpose(amount){
		cycleThruKeys(amount);
		var namedNoteName = gSong.moveNamedNotes(amount);

		//fullRepaint();//Don't do this, it is a bit slow because it rebuilds.
		clearAll();
		replay();
		showBeats();

		highlightOneNote(namedNoteName);
	}

	function transposeSong(amount){
		gSong.cycleThruKeysAllFrames(amount);
		var namedNoteName = gSong.moveNamedNotesAllFrames(amount);
		fullRepaint();
		/*clearAll();
		replay();
		showBeats();

		highlightOneNote(namedNoteName);
		*/
	}

	function transposeSongKeys(amount){
		gSong.cycleThruKeysAllFrames(amount);
		fullRepaint();
		showBeats();
	}

		function printTablesStats(tables){
			var result = "";
			var B = "<br />";
			for (key in tables){
				var tableArr = tables[key];
				result = result + B + key + ":" + tableArr.length;
			}
			return result;
		}

		function printSections(){
			var frames = getFrames();
			var B = "<br />" ;
			var result = "<table border='1' cellspacing='0'><tr><th>ID</th><th>beats</th><th>KEY</th><th>Caption</th><th>Details</th>";
			var namedNotes, specialNotes;
			for (idx in frames){
				var frame = frames[idx];
				namedNotes = (Object.keys(frame.namedNotes).length>0) ? "namedNotes: "+JSON.stringify(Object.keys(frame.namedNotes)) : "";
				specialNotes = (Object.keys(frame.tables).length>0) ? "<br />SpecialNotes: "+printTablesStats(frame.tables) : "";
				var SEP = "</td><td>";
				debugger
				result = result+"<tr><td>"
				       +"<a href=\"javascript:linkToSection('"+idx+"');\">"+(toInt(idx,0)+1)+"</a>"+SEP
					   +frame.beats+SEP
					   +"<B style='font-size: 130%;'>"+noteIDToNoteName(frame.rootID) +(frame.rootIDLead!=-1?"/"+noteIDToNoteName(frame.rootIDLead):"")+"</B>"+SEP
				       +"<b style='font-size: 130%;'>"+frame.caption+"</b>"+SEP
					   +namedNotes
					   +specialNotes
					   "</td></tr>";
			}
			return result+"</table>";
		}

		function linkToSection(idx){
			gSong.gotoFrame(idx);
			hideCmdLine();
		}

		function rangeNamedNoteSlide(element_id, value) {  //called when someone drags the slider--fires javascript onChange from html.
	        //console.log("rangeSlide:"+element_id+" value: "+value);
			setNamedNoteOpacity_inner(element_id, value);
	    }

		function setNamedNoteOpacity_inner(element_id, newValue){
			getSong().namedNoteOpacity = newValue;
			//console.log("setNamedNoteOpacity_inner element_id:"+element_id+" value: "+newValue);
			clearAll();
		    replay();
		    updateFramesStatus();
		}

		function getNamedNoteOpacity(){
			return $("#rangeNamedNoteOpacity").attr("value");
		}

		function setNamedNoteOpacity(newValue){
			$("#rangeNamedNoteOpacity").attr("value", (newValue));
			setNamedNoteOpacity_inner(null, newValue);
		}

		//======== SingleNote opacity ==========

		function getSingleNoteOpacity(){
			return $("#rangeSingleNoteOpacity").attr("value");
		}

		function setSingleNoteOpacity(newValue){
			$("#rangeSingleNoteOpacity").attr("value", (newValue));
			setSingleNoteOpacity_inner(null, newValue);
		}

		function setSingleNoteOpacity_inner(element_id, newValue){
			getSong().singleNoteOpacity = newValue;
			clearAll();
		    replay();
		    updateFramesStatus();
		}

		function rangeSingleNoteOpacitySlide(element_id, value) {
			setSingleNoteOpacity_inner(element_id, value);
	    }

		//======== TinyNote opacity ==========

		function getTinyNoteOpacity(){
			return $("#rangeTinyNoteOpacity").attr("value");
		}

		function setTinyNoteOpacity(newValue){
			$("#rangeTinyNoteOpacity").attr("value", (newValue));
			setTinyNoteOpacity_inner(null, newValue);
		}

		function setTinyNoteOpacity_inner(element_id, newValue){
			getSong().tinyNoteOpacity = newValue;
			clearAll();
			replay();
			updateFramesStatus();
		}

		function rangeTinyNoteOpacitySlide(element_id, value) {
			setTinyNoteOpacity_inner(element_id, value);
		}

	//==============  Other functions that set CSS vars but not in Themes (or themeFunctions.js) =====================


	var gNutSizeState = -1;  //start before state machine.
	function cycleThruNutWidths(direction){
		const arr = ["0", "30px", "60px", "100px", "140px", "220px", "340px","800px"];
		var newValue="200px";
		var show = true;
		if (gNutSizeState==-1){
			gNutSizeState = arr.length-1;
		}
		gNutSizeState = (gNutSizeState+1) % arr.length ;
		if (gNutSizeState==0){
			newValue="0";
			show = false;
			$('.nut').hide();
		} else {
			newValue = arr[gNutSizeState] ;
		}
		setOneCssVar("--nut-width",newValue);
		if (show) $('.nut').show();
	}



	//=============== Misc functions under development  ===========================================

	function updateFontLabel(){
			$('#lblUIFontSize').html(""+gFontSize).show();
			$('#lblCellFontSize').html(""+gNoteFontSize).show();
	}




	//var gLastWhiteBackgroundColor = null;
	//var gLastBlackBackgroundColor = null;
	function showAllNoteNames(show){
		if (show){
			var LastBlackBackgroundColor = $('.noteBlackKey').css("background-color");
			var LastWhiteBackgroundColor  = $('.noteWhiteKey').css("background-color");
			var hexbb = convertRGB_to_HEX(LastBlackBackgroundColor);
			var hexww = convertRGB_to_HEX(LastWhiteBackgroundColor);
			var bw = false; //false is cooler. //force choice of Black/White color for all background colors.  mid-tone colors don't work so well.
			var fontblack = invertColor(hexbb, bw);
			var fontwhite = invertColor(hexww, bw);
			$('.noteWhiteKey').css({color: fontwhite});
			$('.noteBlackKey').css({color: fontblack});
		} else {
			//if (gLastBlackBackgroundColor && gLastWhiteBackgroundColor){
			//		$('.noteWhiteKey').css({color: "transparent"});   //gLastWhiteBackgroundColor});
			//		$('.noteBlackKey').css({color: "transparent"});   //gLastBlackBackgroundColor});
			//		console.log("gLastBlackBackgroundColor:"+gLastBlackBackgroundColor);
			//} else {
			$('.noteWhiteKey').css({color: "transparent"}); //this must sync with .noteWhiteKey's default background color so letters disappear.
			$('.noteBlackKey').css({color: "transparent"});  //ditto
			//}
			//alert("else "+$('.noteWhiteKey').css("color"));

		}
	}


	function automateDisplay(){

	}

	var gPresentationMode = false; //turn this on when full presentation: script takes control of cell widths & heights, etc.

	function displayOptionsToControls(options){

		if (gPresentationMode){
			var sizesObj = options.NoteDisplaySizes;
		 	$("#dropDownCellWidth").val(sizesObj.width);
		 	$("#dropDownCellHeight").val(sizesObj.height);	 // e.g. {"width": 120,"height": 60};
		}

		if (options.showAllNoteNames){
			$("#cbShowAllNoteNames").prop("checked", true);
			$('#btnShowAllNoteNames').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
		} else {
			$("#cbShowAllNoteNames").prop("checked", false);
			$('#btnShowAllNoteNames').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
		}
		showAllNoteNames(options.showAllNoteNames);

		$("#cbShowCellNotes").prop("checked", options.showCellNotes);
		if (options.showCellNotes){
			$("#cbCenterForRightFunction").prop("checked", options.useCenterForRightFunction);  //otherwise unchecked.
		} else {
			$("#cbCenterForRightFunction").prop("checked", false);
		}

		if (options.cellIsFunction){
			$('input[name=rbnFunctionNotename][value=showFunction]').prop('checked', true);
		} else {
			$('input[name=rbnFunctionNotename][value=showNotename]').prop('checked', true);
		}

	    $("#cbSubscripts").prop("checked", options.subscripts);
	    $("#cbShowSubscriptPitches").prop("checked", options.showSubscriptPitches);
	    $("#cbShowSubscriptFunctions").prop("checked", options.showSubscriptFunctions);
	    $("#cbMidiNum").prop("checked", options.showMidiNum);


	 	$("#cbNaturalFretWidths").prop("checked", options.naturalFretWidths);

		$("#cbShowAllNoteNames").prop("checked", options.showAllNoteNames);
		$("#cbHideNamedNotes").prop("checked", options.hideNamedNotes);
	    $("#cbHideTinyNotes").prop("checked", options.hideTinyNotes);
	    $("#cbHideSingleNotes").prop("checked", options.hideSingleNotes);
	    $("#cbHideFingering").prop("checked", options.hideFingering);

		$("#lblHideWarning").hide();

		setNamedNoteOpacity(options.namedNoteOpacity);
		setSingleNoteOpacity(options.singleNoteOpacity);
		setTinyNoteOpacity(options.tinyNoteOpacity);

		$('#textareaFunctionSymbols').val(options.dropDownFunctionSymbols.value).change();


		var currentColorDict = options.currentColorDict;
		if (currentColorDict){
			gSong.currentColorDict = currentColorDict;
			chuseStylesheet(currentColorDict);
		}

		$("#cbAutomaticColor").prop("checked", options.autoColor);
	}

	function controlsToDisplayOptions(){
		var options = {};
		options.autoColor = $("#cbAutomaticColor").prop("checked");
		options.showCellNotes = $("#cbShowCellNotes").prop("checked");
	    options.subscripts = $("#cbSubscripts").prop("checked");
	    options.showSubscriptPitches = $("#cbShowSubscriptPitches").prop("checked");
	    options.showSubscriptFunctions = $("#cbShowSubscriptFunctions").prop("checked");
	    options.cellIsFunction = ($('input[name="rbnFunctionNotename"]:checked').val() == "showFunction");
	    options.showMidiNum = $("#cbMidiNum").prop("checked");
		options.useCenterForRightFunction = $("#cbCenterForRightFunction").prop("checked");
		options.naturalFretWidths = $("#cbNaturalFretWidths").prop("checked");

		options.hideNamedNotes = $("#cbHideNamedNotes").prop("checked");
		options.hideTinyNotes = $("#cbHideTinyNotes").prop("checked");
		options.hideSingleNotes = $("#cbHideSingleNotes").prop("checked");
		options.hideFingering = $("#cbHideFingering").prop("checked");

		options.showAllNoteNames = $("#cbShowAllNoteNames").prop("checked");

		options.namedNoteOpacity = getNamedNoteOpacity();
		options.singleNoteOpacity = getSingleNoteOpacity();
		options.tinyNoteOpacity = getTinyNoteOpacity();

		options.currentColorDict = gSong.currentColorDict;
		options.NoteDisplaySizes =  {
										"caption": parseInt($("#dropDownCellWidth").val()) + 'x' + parseInt($("#dropDownCellHeight").val()),
			                        	"width":$("#dropDownCellWidth").val(),
										"height":$("#dropDownCellHeight").val()
									};
		options.dropDownFunctionSymbols = {
										"caption":	$("#dropDownFunctionSymbols option:selected").text(),
										"value":  $("#dropDownFunctionSymbols").val()
									};


		return options;
	}

	function installBtnHamburgerClicks(){
		$(".showsubcaption").click(function() {
			$(".subcaption").toggle();
		});
	}

	function transportResize(){
		//if at top, use this: var left = $('#transportLeftPoint').position().left;
		var tHeight = $('#transport').outerHeight()
		var tWidth = $('#transport').outerWidth()
		var wHeight = $(window).height();
		var wWidth = $(window).width();
		var left = (wWidth / 2) - (tWidth / 2);
		var top = (wHeight-tHeight);

		$('#transport').css({"left": left+"px", "top": top+"px"});
	}



	var gPressTimer;



	//=============== document.ready event Binding ==========================

	function bindDesktopEvents(){

		$("#btnPalette").click(function() {
		    showOneMenu("#palette");
		});
		$("#btnDesktop").click(function() {
		    showOneMenu("#divDesktop");
		});


		$("#btnHelp").click(function() {

		});

		$("#btnHamburger").click(function() {
		   $("#divControls").toggle();
		   hideAllMenuDivs();
		});


		$("#cbPresentationMode").change(function(){
			gPresentationMode = this.checked;
		});



		$("#showHideExtraColors").click(function(event) {
			$("#extraColors").toggle();
			if ($("#extraColors").is(":visible")){
				$("#showHideExtraColors")
					.html("Less...")
					.removeClass("BtnPunchedOut")
					.addClass("BtnPunchedIn");
			} else {
				$("#showHideExtraColors")
				    .html("More...")
					.removeClass("BtnPunchedIn")
					.addClass("BtnPunchedOut");
			}
			event.stopPropagation();
		});

		$("#showHideCustomColorEditors").click(function(event) {
			$("#CustomColorEditors").toggle();
			if ($("#CustomColorEditors").is(":visible")){
				$("#showHideCustomColorEditors").html("Customize Less ...");
			} else {
				$("#showHideCustomColorEditors").html("Customize ...");
			}
			event.stopPropagation();
		});

		$("#showHideCustomColorLinks").click(function() {
			$('#divColorDicts').toggle();
		});

		$("#btnSectionControls").click(function() {
		    showOneMenu("#divSectionControls");
		});
		$("#btnFileControls").click(function() {
		    showOneMenu("#divFileControls")
		});
		$("#btnTunings").click(function() {
		    reloadAllTuningsDisplay();
		    showOneMenu("#divTunings");
		});
		$("#btnFillNotes").click(function() {
		    showOneMenu("#divFillNotes");
		});
		$("#btnViewControls").click(function() {
		    showOneMenu("#divViewControls");
		});
		$("#btnThemeControls").click(function() {
		    showOneMenu("#divThemeControls");
		});

		// ======== BEGIN "Quick" Menu: ==========
		function linkButtonToCB(btnSelector, cbSelector){
			var btn = $(btnSelector);
			var cb = $(cbSelector);
			var wasChecked = cb.prop('checked');
			if (wasChecked){
				btn.addClass(   "BtnPunchedOut")
				   .removeClass("BtnPunchedIn");
				cb.prop('checked', false);
			} else {
				btn.addClass(   "BtnPunchedIn")
				   .removeClass("BtnPunchedOut");
				cb.prop('checked', true);
			}
		}
		$("#btnShowAllNoteNames").click(function() {
			linkButtonToCB('#btnShowAllNoteNames', '#cbShowAllNoteNames');
			showAllNoteNames($('#cbShowAllNoteNames').prop('checked'));
		});
		$("#btnRandomLoop").click(function() {
			getSong().randomLoop = ! getSong().randomLoop;
			if (getSong().randomLoop){
				$('#btnRandomLoop').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
			} else {
				$('#btnRandomLoop').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
			}
			if (framesLooping()){
				restartLoopFrames();
			}
		});
		$("#btnNoteV").click(function() {
			checkRB("#rbNotename");
			resetNoteNames();
		});
		$("#btnFuncV").click(function() {
			checkRB("#rbFunction");
			resetNoteNames();
		});
		$("#btnAutoColor,#btnAutoColor2").click(function() {
			var cbac = $("#cbAutomaticColor");
			cbac.prop("checked", !cbac.prop("checked"));

			$("#cbAutomaticColor").trigger("change");
			//linkButtonToCB('#btnAutoColor', '#cbAutomaticColor');
			resetNoteNames();
		});
		// ========== END "Quick" Menu ==========




		$("#btnToggleTransport").click(function() {
			$('#transport').toggle();
		});
		$("#btnToggleCmdLine").click(function() {
			toggleCmdLine();
		});
		$("#btnToggleQuick").click(function() {
			$('#divQuick').toggle();
		});





		$("#btnClear").click(function() {
		    resetNoteNames();
		    clearAll();
		});
		$("#btnDownload").click(function() {
		    downloadPlayedNotes();
		});
		$("#btnReplay").click(function() {
		    replay();
		});
		$("#btnPrevFrame, #btnPrevFrame2").click(function() {
		    gSong.gotoPrevFrame(false);
		});
		$("#btnNextFrame, #btnNextFrame2").click(function() {
		    gSong.gotoNextFrame(false);
		});
		$("#btnFirstFrame").click(function() {
			gSong.firstFrame();
			clearAndReplayFrame();
		});
		$("#btnLastFrame").click(function() {
		    gSong.lastFrame();
			clearAndReplayFrame();
		});

		$("#btnNewFrame").click(function() {
		    var newIndex = $('#dropDownSectionOrder').val();//might include pseudo-value "END".
		    gSong.newFrame(newIndex);
		});
		$("#btnDeleteFrame").click(function() {
		    gSong.deleteCurrentFrame();
		});
		$("#btnAddShallowCloneFrame").click(function() {
			var newIndex = $('#dropDownSectionOrder').val();//might include pseudo-value "END".
		    gSong.addShallowCloneFrame(newIndex);
		});
		$("#btnAddDeepCloneFrame").click(function() {
		    var newIndex = $('#dropDownSectionOrder').val();//might include pseudo-value "END".
		    gSong.addDeepCloneFrame(newIndex);
		});
		$('#btnMoveSectionOrder').click(function(){
			var newIndex = $('#dropDownSectionOrder').val();
			if (newIndex == "END"){
				gSong.moveFrameToEND();
			} else {
				gSong.moveFrameTo(newIndex);
			}
			fullRepaint();
		});
		$("#btnLoopFrames").click(function() {
		    toggleLoopFrames();
		});
		$("#btnLoopBeats").click(function() {
		    toggleLoopBeats();
		});
		$("#btnLoopBeatsTransport").click(function() {
		    toggleLoopBeats();
		});

		$("#cbShowAllNoteNames").click(function() {
			var show = $("#cbShowAllNoteNames").prop("checked");
			if (show){
				$('#btnShowAllNoteNames')
				   .addClass(   "BtnPunchedIn")
				   .removeClass("BtnPunchedOut");
			} else {
				$('#btnShowAllNoteNames')
				   .addClass(   "BtnPunchedOut")
				   .removeClass("BtnPunchedIn");
			}
			showAllNoteNames(show);
		});

		$(".RecordButton").click(function() {
			var btn = $("#btnRecord");
			var recording = btn.attr("recording");
			if (recording === undefined) {
				$(".RecordButton").addClass("ButtonOn");    //.css({"background-color": "red"});
			    $("#btnRecord").attr("recording", "true");
				clearRecordedNotes();
		        showBeats(gSong.getBeat());
			} else if (recording === "false"){
				$(".RecordButton").addClass("ButtonOn");    //.css({"background-color": "red"});
			    $("#btnRecord").attr("recording", "true");
				clearRecordedNotes();
		        showBeats(gSong.getBeat());
			} else if (recording === "true") {
				$(".RecordButton").removeClass("ButtonOn");  //.css({"background-color": "green"});
				   	$("#btnRecord").attr("recording", "false");
			} else {
				$(".RecordButton").removeClass("ButtonOn"); //css({"background-color": "green"});
				   	$("#btnRecord").attr("recording", "false");
			}
		});

		$("#txtBeatsPer" ).on( "change", function() {
		 getCurrentFrame().beats = $( this ).val();
		});

		$("#btnPrevBeat").click(function() {
		    gSong.prevBeat();
		    showHighlightsForBeat(gSong.getBeat());
		});
		$("#btnNextBeat").click(function() {
		    gSong.nextBeat();
		});
		$("#btnPrevBeatTransport").click(function() {
		    gSong.prevBeat();
		});
		$("#btnNextBeatTransport").click(function() {
		  	gSong.nextBeat();
		});

		$("#btnInsertFirstBeat").click(function() {
		    gSong.moveBeatsLater();
		});
		$("#btnAddBeat").click(function() {
		    addBeat();
		});
		$("#btnDeleteBeat").click(function() {
			gSong.deleteBeat();
		});

		$("#txtCaption" ).on( "change", function() {
		 var cap = $( this ).val();
		 getCurrentFrame().caption = cap;
		 $(".lblSectionCaption").html(cap);

		});
		$("#txtFilename" ).on( "change", function() {
		 $(".lblSongName").html($( this ).val());
		});

		$("#txtBPM" ).on( "change", function() {
		 setBPM($(this).val());  //interestingly, this does NOT cause jQuery to call ".change()" again.
		});

		$("#btnSharps").click(function() {
	        gSharps = true;
	        getCurrentFrame().sharps = true;
	        resetNoteNames();
			updateFramesStatus();
	    });
	    $("#btnFlats").click(function() {
	        gSharps = false;
	        getCurrentFrame().sharps = false;
	        resetNoteNames();
			updateFramesStatus();
	    });

		$("#btnTransposeDown").click(function() {
			 transpose(-1);
	    });
	    $("#btnTransposeUp").click(function() {
			 transpose(1);
	    });
		$("#btnTransposeJumpDown").click(function() {
			 transpose(-5);
	    });
	    $("#btnTransposeJumpUp").click(function() {
			 transpose(5);
	    });

	    $('#dropDownRoot').change(function() {
	        getCurrentFrame().rootID = $(this).val();
	        fullRepaint();
	        updateFramesStatus();
	    });
		$('#dropDownRootLead').change(function() {
            getCurrentFrame().rootIDLead = $('#dropDownRootLead').val();
            fullRepaint();
	        updateFramesStatus();
	    });

		$('#dropDownCellHeight').change(function() {
			fullRepaint();
	    });
		$('#dropDownCellWidth').change(function() {
			fullRepaint();
		});
		$("#cbNaturalFretWidths,#selNaturaFontScaling").change(function(){
			fullRepaint();
		});
		$("#selNoteFont").change(function(){
			setOneCssVar("--td-note-font-family", $("#selNoteFont").val());
			fullRepaint();
		});
		$("#selLeftSubscriptFontSize").change(function(){
			setOneCssVar("--left-subscript-font-size", $("#selLeftSubscriptFontSize").val());
			fullRepaint();
		});
		$("#selRightSubscriptFontSize").change(function(){
			setOneCssVar("--right-subscript-font-size", $("#selRightSubscriptFontSize").val());
			fullRepaint();
		});
		$("#selTinyNoteMaxHeight").change(function(){
			setOneCssVar("--tiny-note-max-height", $("#selTinyNoteMaxHeight").val());
			fullRepaint();
		});
		$("#selTinyNoteFontSize").change(function(){
			setOneCssVar("--tiny-note-font-size", $("#selTinyNoteFontSize").val());
			fullRepaint();
		});


		$("#selMidiFontSize").change(function(){
			setOneCssVar("--midi-font-size", $("#selMidiFontSize").val());
			fullRepaint();
		});
		$("#selFingeringFontSize").change(function(){
			setOneCssVar("--fingering-font-size", $("#selFingeringFontSize").val());
			fullRepaint();
		});
		$("#selFingeringPosition").change(function(){
			setOneCssVar("--fingering-position", $("#selFingeringPosition").val());
			fullRepaint();
		});
		$('#dropDownInstrumentMargins').change(function() {
			//short-circuit and set it now, it is in mem for next time.
			var margin = this.value;
			$('.instrumentBackground').css({"margin-top": margin, "margin-bottom": +margin });
		});

	    $('#selBend').click(function() {
	        $("#rbBend").prop("checked", true);
	    });

		$("#rbFinger1").click(function(){
			checkRB("#idRFinger1");
		});
		$("#rbFinger2").click(function(){
			checkRB("#idRFinger2");
		});
		$("#rbFinger3").click(function(){
			checkRB("#idRFinger3");
		});
		$("#rbFinger4").click(function(){
			checkRB("#idRFinger4");
		});
		$("#rbFingerT").click(function(){
			checkRB("#idRFingerT");
		});

		$("#cbAutomaticColor").change(function() {
			if (this.checked) {
				//console.log("cbAutomaticColor was checked--hiding");
				$('#manualColors').hide();
				$('#btnAutoColor,#btnAutoColor2').addClass("BtnPunchedIn").removeClass("BtnPunchedOut");
			} else {
				//console.log("cbAutomaticColor was not checked--showing");
				$('#manualColors').show();
				$('#btnAutoColor,#btnAutoColor2').addClass("BtnPunchedOut").removeClass("BtnPunchedIn");
			}
			fullRepaint();
		});

		$('#cbHideNamedNotes, #cbHideSingleNotes, #cbHideTinyNotes, #cbHideFingering').change(function() {
				var hnchecked = $('#cbHideNamedNotes').prop("checked");
				var hschecked = $('#cbHideSingleNotes').prop("checked");
				var htchecked = $('#cbHideTinyNotes').prop("checked");
				var hfchecked = $('#cbHideFingering').prop("checked");

				if (htchecked || hschecked || hfchecked || hnchecked){
					turnOnKeep();
					$("#lblHideWarning").show();
				} else {
					$("#lblHideWarning").hide();
				}
				clearAll();
				replay();
	    });

		$('#cbShowCellNotes').change(function() {

			if ( ! this.checked ) {
				$("#cbCenterForRightFunction").prop("checked", false);
			}
			resetNoteNames();
	    });
		$('#cbCenterForRightFunction').change(function() {

			if ( this.checked ) {
				$("#cbShowCellNotes").prop("checked", true);
			}
			resetNoteNames();
	    });
	    $('input[type=radio][name=rbnFunctionNotename]').change(function() {
	        resetNoteNames();
	    });

	    $('#cbSubscripts').change(function() {
	        resetNoteNames();
	    });
	    $('#cbShowSubscriptPitches').change(function() {
	        resetNoteNames();
	    });
	    $('#cbShowSubscriptFunctions').change(function() {
	        resetNoteNames();
	    });
	    $('#cbMidiNum').change(function() {
	        resetNoteNames();
	    });
		$("#textareaFunctionSymbols" ).on( "change", function() {
			var txtVal = $('#textareaFunctionSymbols').val();
		    try {
				//Since we are allowing the user to put somthing in, let's validate a bit before accepting.
				 noteNamesFuncArr = JSON.parse(txtVal);
				 if (!noteNamesFuncArr.length){
					 throw new TypeError("NoteFunction array is empty -- check commas and quotes.");
				 }
				 if (!noteNamesFuncArr[0]){
					 throw new TypeError("First NoteFunction is empty");
				 }
				 if (!noteNamesFuncArr[11]){
					 throw new TypeError("Last NoteFunction is empty");
				 }
			 	 gSong.noteNamesFuncArr = txtVal;
			} catch (error) {
				noteNamesFuncArr = noteNamesFuncArrDEFAULT;
				alert("Error setting NoteFunction names: "+error);
			}
			fullRepaint();
		});
		$("#btnFunctionSymbolsReset").click(function() {
			noteNamesFuncArr = noteNamesFuncArrDEFAULT;
			$('#textareaFunctionSymbols').val(JSON.stringify(noteNamesFuncArr));
			fullRepaint();
		});
		$('#dropDownFunctionSymbols').change(function() {
            var value = $('#dropDownFunctionSymbols').val();
			noteNamesFuncArr = JSON.parse(value);  //this one is safe--comes from our built SELECT.
			$('#textareaFunctionSymbols').val(JSON.stringify(noteNamesFuncArr));
            fullRepaint();
	    });



		$("#btnFillChord").click(function() {
	        fillChord();
	    });

		$("#btnControlsToDisplayOptions, #btnControlsToDisplayOptions2").click(function() {
	        var options = controlsToDisplayOptions();
			getCurrentFrame().displayOptions = options;
			INFO("controlsToDisplayOptions: <br>"+JSON.stringify(options, null, 2));
			showHideDisplayOptionsPresent();
	    });
		$("#btnDeleteDisplayOptions, #btnDeleteDisplayOptions2").click(function() {
			delete getCurrentFrame().displayOptions;
			showHideDisplayOptionsPresent();
	    });

		$("#btnRecordUserColors").click(function() {
			recordUserColors();
		});
		$("#btnRecordUserColorsFromSection").click(function() {
			recordUserColorsFromSection();
		});
	}

	function bindThemeEvents(){
		//======= themes  =======
		$('#btnTheme').click(function() {
			var newTheme = controlsToTheme();
			theme(newTheme);
		});
		$('#btnToggleThemeTableResults').click(function() {
			$('#themeTableResults').toggle();
		});
		$('#selThemes').change(function() {
			var id = this.id;
			var val =  this.value;
			var selectedTheme = getThemes()[val];
			theme(selectedTheme);
			themeToControls(selectedTheme);
			clearThemeDiffResults();
		});
		$('#warny').click(function(){
			$(this).hide();
		});
		$('#btnShowWarny').click(function(){
			$('#warny').show();
		});
	}

	//=============== document.ready HELPER functions ==========================

	function ChromeFullscreen() {
	  document.documentElement.webkitRequestFullScreen();
	}

	const SCALING_PREFS = "ScalingPrefs";

	function saveScalingPrefs(){
		var scalingPrefs = {
			UIFontSize:   getUIFontSize(),
			NoteFontSize: getNoteFontSize(),
			CellWidth:    $("#dropDownCellWidth").val(),
			CellHeight:  $("#dropDownCellHeight").val()
		};
		localStorage.setItem(SCALING_PREFS, JSON.stringify(scalingPrefs));
		$("#divScalingPrefs").html(JSON.stringify(scalingPrefs));
	}

	function applyScalingPrefs(noSnark){
		var scalingPrefsStr = localStorage.getItem(SCALING_PREFS);
		if (scalingPrefsStr){
			var scalingPrefs = JSON.parse(scalingPrefsStr);
			if (scalingPrefs.UIFontSize){
				setUIFontSize(scalingPrefs.UIFontSize);
				setNoteFontSize(scalingPrefs.NoteFontSize);
				$("#dropDownCellWidth").val(scalingPrefs.CellWidth).change();
				$("#dropDownCellHeight").val(scalingPrefs.CellHeight).change();
				$("#divScalingPrefs").html(JSON.stringify(scalingPrefs));
			}
		} else {
			if (!noSnark){
				$("#divScalingPrefs").html("No ScalingPrefs in browser storage: click [Save Scaling Prefs] first.");
			}
		}
	}

	function clearScalingPrefs(){
		localStorage.removeItem(SCALING_PREFS);
		$("#divScalingPrefs").html("ScalingPrefs: "+JSON.stringify(localStorage.getItem(SCALING_PREFS)));
	}

	//=============== document.ready ===========================================

	$(document).ready(function() {
		window.onerror = function (message, url, lineNo, colno, error){
			debugger
		    alert('window.onerror: ' + message
			    + '\r\n URL:'+url
				+'\r\n Line Number: ' + lineNo
				+'\r\n Col Number: '+colno
				+'\r\n Stack: '+error.stack
			);
		    return true;
		}

		populateFretLengthArray();

		gSong = makeSong();  //var song global in this file (at top).

		gSong.graveyard = makeGraveyard();

		installDefaultColorDicts();
		applyStylesheetsTo_gUserColorDict();
		buildColorDicts();
		$('#divColorDicts').hide();
		$("#CustomColorEditors").hide();

	    installAllTuningsTables();
		installBtnHamburgerClicks();
	    setupOpenFile();
		frameChanged();
	    installTDNoteClick();
		bindDesktopEvents();
		applyScalingPrefs(true);

		$('#SelectThemesDest').html(getWidget_SelectThemes());  //must come before bindThemeEvents()
		bindThemeEvents();
		auditThemes();//sends WARN messages, so hide after.
		$('#warny').hide();
		$('#themeTableResults').hide();
		$('#selThemes').val("Autobahn").change();
		//will get picked up in open file, but here is the default theme,
		//    which isn't "Default", although it should be.
		//$('#selThemes').val("PoolShark").change();

		$('#textareaFunctionSymbols').val(JSON.stringify(noteNamesFuncArr));

		var currentFilename = $("#txtFilename").val();
	    $(".lblSongName").html(currentFilename);
		getSong().songName = currentFilename;
		$('.topControlsCaptions').show();

	    $('#cbHighlight').prop('checked', false);
		//NOTE: "checked" is done in buildUserColors, so you don't need to check any rb colors here.

		$("#palette").show();
		$('#cbAutomaticColor').prop('checked', true);
		$("#cbAutomaticColor").trigger('change');//will change from checked to not checked and run click().

		$("#dropDownRootColors").val("noteKeep");
	    $("#dropDownChordsColors").val("noteKeep");
	    $("#dropDownScalesColors").val("noteKeep");
      	$("#lblHideWarning").hide();

		showHideDisplayOptionsPresent();  //enables and disables btnDeleteDisplayOptions etc.
 		hideAllMenuDivs();
		$("#divQuick").hide();
		$("#tabledestTopPad").hide();
		$("#CmdMenu").hide();

		updateFontLabel();

		buildUserColors();
		installRBColorChangeEvents();

	    reloadAllTuningsDisplay();
	    showDefaultTuning();//calls showhideTunings and shows S6 if none found.
	    bindFormTuningsEvents();


		$("#btnFlats").click();  //calls resetNoteNames();

		$(document).on('keypress', document_keypress);
		$("#txtCmdLine").on('keypress', txtCmdLine_keypress);
		$(document).on('keyup', document_keyup);

		$( window ).on( "resize", function() {
			transportResize();
		} );
		transportResize();


		/*$('#cbFloatPalette').change(function() {
			if (this.checked){
				dragElement(document.getElementById("palette"));
			} else {
				dontDragElement(document.getElementById("palette"));
			}
		});
		*/
        draggable(document.getElementById('transport'));

		scrollToTop();

	}); //END document ready function
