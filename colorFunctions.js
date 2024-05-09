//color functions, moved from infinite-neck.js

//================== colorDicts ================================================

	function clean_ColorSchemeName(colorSchemeName){
		var result = {};
		colorSchemeName = colorSchemeName.replace(/([^a-z0-9]+)/gi, '-');
		if (colorSchemeName.trim().length == 0){
			colorSchemeName = "user";
			result.changed = true;
		}
		var existingScheme = gSong.colorDicts[colorSchemeName];
		if (existingScheme){
			if (existingScheme.readOnly || existingScheme.computed){
				result.systemSchemeName = colorSchemeName;
				colorSchemeName += "-user";
				result.changed = true;
			}
		}
		result.colorSchemeName = colorSchemeName;
		return result;
	}

	function recordUserColorsBoth(doSampleSection, doPickerChoices){
		var colorSchemeName = $('#txtColorSchemeName').val();
		var chosenSystemSchemeName = $('#txtColorSchemeName').attr('systemSchemeName');
		var cleanResult = clean_ColorSchemeName(colorSchemeName);
		colorSchemeName = cleanResult.colorSchemeName;
		$('#txtColorSchemeName').val(colorSchemeName);
		if (cleanResult.changed){
			flashLabel('#lblStylesheetName');
		}

		var rootIndex = toInt(getCurrentFrame().rootID, 0);
	    var rootIndexLead = toInt(getCurrentFrame().rootIDLead, 0);

		var colorDict = {};
		var notes = getCurrentFrame().namedNotes;
		var keys = Object.keys(notes);

		if (doSampleSection){
			for (k in keys){
				var noteName = keys[k];
				var noteFnNum = noteNameToNoteID(noteName);
				var rel =(12+noteFnNum-rootIndex) % 12;
				var noteKey = "note"+(rel+1);   //Use 1-based for note1, note2, etc.
				var note = notes[keys[k]];
				var cc = note.colorClass;
				if (cc){
					var noteClone = JSON.parse(JSON.stringify(note));
					noteClone.colorClass = cc;
					var res = lookupUserColor(noteClone);
					var defClone = JSON.parse(JSON.stringify(gUserColorDictOEM.dict[noteKey]));
					defClone.colorClass = res.colorClass;
					colorDict[noteKey] = defClone;
				}
			}
		}

		if (doPickerChoices){
			for (const [noteKey, captionColor] of Object.entries(saveUserColorChoices())) {
				if (captionColor.colorClass && !(captionColor.readonly)){
					//var res = lookupUserColor({"colorClass": captionColor.colorClass});
					if (!colorDict[noteKey]){
						colorDict[noteKey] = JSON.parse(JSON.stringify(captionColor));
					}
					//colorDict[noteKey].colorClass = res.colorClass;
					colorDict[noteKey].colorClass = captionColor.colorClass;
				}
			}
		}

		//console.log("new scheme: "+JSON.stringify(colorDict));
		var recordedScheme = gSong.colorDicts[colorSchemeName];
		if (recordedScheme){
			Object.assign(recordedScheme.dict, colorDict);  //this colorDict is already a .dict object.
			recordedScheme.checked = true;
		} else {
			recordedScheme = {
			    readOnly: false,
			    computed: false,
			    checked: true,
			    dict: {}
			};
			if (cleanResult.systemSchemeName){
				var cloneBase = gSong.colorDicts[cleanResult.systemSchemeName];
				Object.assign(recordedScheme.dict, cloneBase.dict);
			} else if (chosenSystemSchemeName){
				var cloneBase = gSong.colorDicts[chosenSystemSchemeName];
				Object.assign(recordedScheme.dict, cloneBase.dict);
			}
			$('#txtColorSchemeName').attr('systemSchemeName', null);

			Object.assign(recordedScheme.dict, colorDict);  //this colorDict is already a .dict object.
		}

		gSong.colorDicts[colorSchemeName] = recordedScheme;

		for (const [notekey, captionColor] of Object.entries(recordedScheme.dict)) {
			if (captionColor.colorClass){
				gUserColorDict.dict[notekey] = captionColor;
			}
		}
		chuseStylesheet(colorSchemeName);
		buildColorDicts();
		buildUserColors();
	}

	function recordUserColors(){
		recordUserColorsBoth(false, true);
	}

	function recordUserColorsFromSection(){
		recordUserColorsBoth(true, false);
	}


	 function saveUserColorChoices(){
		 var dict = {};
	 	$("#UserColorsEditorDest td[id^='colorDestRole']").each(function(i, TD){
		    var jTD = $(TD);
		    var hatchClassPicked = jTD.attr("hatchClassPicked");
		    var colorClassPicked = jTD.attr("colorClassPicked");
		    var id = TD.id;
		    var theClass = jTD.attr("class");
		    if (theClass && theClass.length>0){
		        var noteKey = 'note'+id.substring('colorDestRole'.length);
				//console.log(theClass+"==>"+noteKey);
				var defClone = JSON.parse(JSON.stringify(gUserColorDictOEM.dict[noteKey]));
				defClone.colorClass = theClass;
				dict[noteKey] = defClone;
		    }
		});
		return dict;
	 }

	const COLOR_DICT_ROW = "colorDictRow";

	function buildColorDicts(){
		var eventSelectors = [];
		var tbl = $("<table class='tblColorDicts'>");

		// Headers from gUserColorDict.dict, which is the definitive list of all merged Roles+Fingerings+Functions
		var headerRow = $('<tr>');
		headerRow.append($('<td style="font-weight: bold; vertical-align: bottom; border: 2px solid black; background-color: lightgray;">').html("Stylesheets"));
		for (const [notekeyTempl, noteTempl] of Object.entries(gUserColorDict.dict)) {
			if (noteTempl.readonly){
				continue;
			}
			if (notekeyTempl == "computed" || notekeyTempl == "readOnly"){
				continue;
			}
			headerRow.append($('<td class="vertical-header">').append($('<span>').html( notekeyTempl.substring('note'.length) )));
		}
		tbl.append(headerRow);

		// then all matching keys in each Dict in the song's list.
		for (const [dictkey, schemeObj] of Object.entries(gSong.colorDicts)) {
			tbl.append(colorDictDisplayRow(dictkey, schemeObj, true, eventSelectors));
		}

		// Finally, the current, live, merged master list where lookups happen.
		var resultRow = colorDictDisplayRow("&rArr;&nbsp;Result", gUserColorDict, false, eventSelectors);
		resultRow.css({"height": "3em"});
		tbl.append(resultRow);


		$('#divColorDictsDest').empty().append(tbl);
		$('#divColorDicts').show();
		var activeStylesheets = calculateActiveStylesheets();
		$('.ActiveStylesheets').html("Active Stylesheets: "+activeStylesheets);
		gSong.activeStylesheets = activeStylesheets;

		updateCurrentColorDictStrip(activeStylesheets, gUserColorDict);
		registerColorSchemeCBEventSelectors(eventSelectors);
	}

	function colorDictDisplayRow(dictkey, schemeObj, doChuseLink, eventSelectors){
		const CB = '<input id="cbWhichColorDict'+dictkey+'"	type="checkbox" name="cbnWhichColorDict" value="'+dictkey+'" CHECKY_CHECKED>';
		const SP = "&nbsp;";
		var row = $('<tr>');
		row.attr("id", COLOR_DICT_ROW+dictkey);
		var A;
		var linkTD = $('<td>');
		var checky = "-";
		if (schemeObj.readOnly){
			if (schemeObj.checked){
				checky = "&check;&nbsp;";
			} else {
				checky = "&nbsp;&nbsp;";
			}
		}
		if (schemeObj.computed){
			if (schemeObj.checked){
				checky = "&rArr;&nbsp;";
			} else {
				checky = "&#x21CF;&nbsp;";
			}
		}
		if (!schemeObj.readOnly && !schemeObj.computed){
			if (schemeObj.checked){
				checky = CB.replace(/CHECKY_CHECKED/g, " checked ");
			} else {
				checky = CB.replace(/CHECKY_CHECKED/g, " ");
			}
		}
		if (doChuseLink){
			var A = $('<a href="javascript:chuseStylesheet(\''+dictkey+'\');">').html(dictkey);
			var nobr = $('<nobr>');
			nobr.append(checky);
			nobr.append(A);
			if (!schemeObj.readOnly && !schemeObj.computed){
				var rightX = $('<span style="width: 2em;">&nbsp;&nbsp;&nbsp;<a href="javascript:deleteUserStylesheet(\''+dictkey+'\');">&#x232B;</a></span>');
				nobr.append(rightX);
			}
			linkTD.append(nobr);
			linkTD.addClass('userColorResultLinks');
		} else {
			row.addClass('userColorResultRow');
			linkTD.addClass('userColorResultCaption');
			linkTD.html(dictkey);
		}
		row.append(linkTD);

		for (const [notekeyTempl, noteTempl] of Object.entries(gUserColorDict.dict)) {
			if (noteTempl.readonly){
				continue;
			}
			if (notekeyTempl == "computed" || notekeyTempl == "readOnly"){
				continue;
			}
			if (!schemeObj.dict){
				alert("No dict at "+notekeyTempl);
			}
			var note = schemeObj.dict[notekeyTempl];
			if (!note){
				row.append($('<td>').html(SP).attr('from', notekeyTempl));
				continue;
			}
			var borderClass = note.colorClass == "noteTransparent" ? " colorDictTransparent" : "";
			var caption;
			if (note.tiny){
				caption = note.tiny;
			} else {
				caption = note.caption;
			}
			if (!note.colorClass){
				caption = "";
			}
			row.append($('<td>').html(caption).addClass(note.colorClass+borderClass));
		}

		if (doChuseLink){
			eventSelectors.push('#cbWhichColorDict'+dictkey);
		}

		return row;
	}

	function registerColorSchemeCBEventSelectors(eventSelectors){
		for (k in eventSelectors){
			$(eventSelectors[k]).change(function(){
				var cb = $(this);
				var willBeChecked = cb.prop('checked');
				var id = cb.val();
				gSong.colorDicts[id].checked = willBeChecked;
				applyStylesheetsTo_gUserColorDict();
				fullRepaint();
				buildColorDicts();
			});
		}
	}

	function moveStylesheetToEnd(lastDictkey){
		function remainingChecked(scheme){
			if (remainingCheckedVal == null){
				return scheme.checked;
			}
			return remainingCheckedVal;
		}
		var remainingCheckedVal = null;
		var temp = {};
		var last = null;

		for (const [key, scheme] of Object.entries(gSong.colorDicts)) {
			if (key == lastDictkey){
				if ( !scheme.readOnly && !scheme.computed ){
					//user clicked user stylesheet
					scheme.checked = true;
					remainingCheckedVal = null; //null==KEEP
					last = scheme;
				} else {
					//user clicked system entry: "All-Clear" or "Default" etc.
					scheme.checked = true; //remainingChecked(scheme);
					//all previous computed system items are now checked
					if (scheme.computed){
						for (const [k, sch] of Object.entries(temp)){
							sch.checked = true;
						}
						//all subsequent items are now unchecked
						remainingCheckedVal = false;
					} else if (scheme.readOnly){
						for (const [k, sch] of Object.entries(temp)){
							sch.checked = true;
						}
						remainingCheckedVal = false;
					}
					temp[key] = scheme;
				}
			} else {
				scheme.checked = remainingChecked(scheme);
				temp[key] = scheme;
				if (scheme.computed || scheme.readOnly){
					scheme.checked = remainingChecked(scheme);
				}
			}
		}
		if (last){
			temp[lastDictkey] = last;
		}
		gSong.colorDicts = temp;
	}

	function chuseStylesheet(dictkey){
		var colorScheme = gSong.colorDicts[dictkey];
		if (colorScheme){
			gSong.currentColorDict = dictkey;
			for (const [notekey, captionColor] of Object.entries(colorScheme.dict)) {
				if (captionColor.colorClass){
					gUserColorDict.dict[notekey] = captionColor;
				}
			}

			var cleanResult = clean_ColorSchemeName(dictkey);
			if (cleanResult.systemSchemeName != "All-Clear"){
				$('#txtColorSchemeName').val(cleanResult.colorSchemeName).attr('systemSchemeName', cleanResult.systemSchemeName);
				flashLabel('#lblStylesheetName');
			}

			moveStylesheetToEnd(dictkey);
			applyStylesheetsTo_gUserColorDict();
			buildUserColors();
			buildColorDicts();
			fullRepaint();
		}
	}

	function refreshStylesheets(){
		applyStylesheetsTo_gUserColorDict();
		buildUserColors();
		buildColorDicts();
		fullRepaint();
	}

	function flashLabel(lblSelector){
		$(lblSelector).addClass('basicBackground');
		setTimeout(function() {
	   		$(lblSelector).removeClass('basicBackground');
			$(lblSelector).addClass('transBackground');
			setTimeout(function() {
		   		$(lblSelector).removeClass('transBackground');
			}, 1000);


		}, 1000);
	}

	function deleteUserStylesheet(dictkey){
		var obj = gSong.colorDicts[dictkey];
		context = {"dictkey": dictkey, "which": "UserStylesheet"};
        gSong.graveyard.bury(GraveType.STYLESHEET, obj, context);

		delete gSong.colorDicts[dictkey];
		applyStylesheetsTo_gUserColorDict();
		buildUserColors();
		buildColorDicts();
		fullRepaint();
	}

	function updateCurrentColorDictStrip(dictLabel, colorScheme){
		var row = colorDictDisplayRow(dictLabel, colorScheme, false);
		var newRow = $('<tr>');
		newRow.html(row.html());
		var tbl = $("<table class='tblColorDictOneRow'>");
		tbl.append(newRow);
		$('.currentColorDict').empty().append(tbl);
	}

	function applyStylesheetsTo_gUserColorDict(){
		for (const [key, scheme] of Object.entries(gSong.colorDicts)) {
			if (scheme.checked && !scheme.computed){
				var dict = scheme.dict;
				Object.assign(gUserColorDict.dict, dict);
			}
		}
	}

	function calculateActiveStylesheets(){
		var result = [];
		for (const [key, scheme] of Object.entries(gSong.colorDicts)) {
			if (scheme.checked){
				if (scheme.Default){
					result = ["Default"]; //reset and ditch the previous things that built gUserColorDictOEM.
				} else {
					result.push(key);
				}
			}
		}
		return result.join("+");
	}

    function buildUserColors() {
        function buildOneRadio(Role, obj, checkedString){
            var userColorClass = "note"+Role;
            var captionClass = (obj.captionClass) ? obj.captionClass : userColorClass;
            var radio = $('<input type="radio" id="idR'+Role+'" name="rbColor" value="note'+Role+'"  '+checkedString+'>');
            var label = $('<label id="chooseRole'+Role+'" ></label>');
            label.append(radio);
            label.append(""+obj.caption);
            label.addClass("userColorRB");
            label.addClass(lookupUserColorClassByClass(captionClass));
			radio.val(userColorClass);
            $("#idRoleButtonsDest").append(label);
        }
        $("#idRoleButtonsDest").empty();
        var checkedString = 'checked="checked"';
        for (key in gUserColorDict.dict){
	         var obj = gUserColorDict.dict[key];
	         var role = key.substring("note".length);  // from noteChord" to "Chord"
	         buildOneRadio(role, obj, checkedString);
	         checkedString = '';//first one done, now the rest should be NOT checked.
        }
        $("#idRootRoleSpan").removeClass().addClass(gUserColorDict.dict["noteRoot"].colorClass);
        $("#idChordRoleSpan").removeClass().addClass(gUserColorDict.dict["noteChord"].colorClass);
        $("#idScaleRoleSpan").removeClass().addClass(gUserColorDict.dict["noteScale"].colorClass);


		$('#lblFillNoteRoot').addClass(gUserColorDict.dict["noteRoot"].colorClass).addClass("radioFillChooser");
		$("#lblFillNoteRoot").css("background", $("#idRootRoleSpan").css("background"));

		$('#lblFillNoteChord').addClass(gUserColorDict.dict["noteChord"].colorClass).addClass("radioFillChooser");
		$("#lblFillNoteChord").css("background", $("#idChordRoleSpan").css("background"));

		$('#lblFillNoteScale').addClass(gUserColorDict.dict["noteScale"].colorClass).addClass("radioFillChooser");
		$("#lblFillNoteScale").css("background", $("#idScaleRoleSpan").css("background"));

        buildUserColorsEditor();
    }

//================== Pickers ===================================================
	function buildColorPicker(){
		var CELL = '<td onclick="colorPickerClicked(this)" colorClass="NOTE_COLOR_CLASS" class="colorPickerCell NOTE_COLOR_CLASS" >&nbsp;&nbsp;</td>'
		var result = [];
		var groups = gColorPickerColors.groups;
		for (ig in groups){
			var row = groups[ig];
			if (row) result.push("<tr>");
			for (ir in row){
				var noteColor = row[ir];
				if (noteColor){
					var cell = CELL.replace(/NOTE_COLOR_CLASS/g, noteColor);
					result.push(cell);
				}
			}
			if (row) result.push("</tr>");
		}
		var noneRow = "<tr><td colspan='100%' colorClass='' class='noteBlue6' onclick=\"colorPickerClicked(this)\">none</td></tr>";
		result.push(noneRow);
		return result.join(''); //Return just TRs not TABLE.
	}

	function buildUserColorsEditor() {
		function buildOneColor(role, obj, checkedString){
			  if (obj.readonly){   // e.g. noteTransparent and noteAutomatic are not user-editable and are marked thusly.
				  return null;
			  }
			  var userColorClass = "note"+role;
			  var captionClass = (obj.captionClass) ? obj.captionClass : userColorClass;
			  var lookedup = lookupUserColorClassByClass(captionClass);
			  var editingBox = "<td id='colorDestRole"+role+"'>&nbsp;</td>"
			                  +"<td><span class='pickerButton' onclick=\"showColorPicker(this,'#colorDestRole"+role+"')\">color</span>&nbsp;</td>"
							  +"<td><span class='pickerButton' onclick=\"showHatchPicker(this,'#colorDestRole"+role+"')\">hatch</span></td>";

			  var row = $('<tr><td>'+role+'</td>'
			                 +'<td class="'+captionClass+'">'+captionClass+'</td>'
							 +'<td class="'+lookedup+'">'+lookedup+'</td>'
							 +'<td>'+editingBox+'</td>'
						 +'</tr>');
			  return row;
	   }
	   var table = $('<table>');
	   for (key in gUserColorDict.dict){
		   var obj = gUserColorDict.dict[key];
		   var role = key.substring("note".length);  // from noteChord" to "Chord"
		   var row = buildOneColor(role, obj, "");
		   if (row) {
			   table.append(row);
		   }
	   }
	   $("#UserColorsEditorDest").empty().append(table);
	   $('#colorPicker').html(buildColorPicker());  //buildColorPicker returns rows, not TABLE.
	   // #hatchPicker is built manually in index.html
	 }


	 const COLOR_PICKER_DEST = "colorClassDestSel";
	 const HATCH_PICKER_DEST = "hatchClassDestSel";

	 function showColorPicker(btnElement, selector){
		 $('#hatchPicker').hide();
		 var colorPicker  = $('#colorPicker');
		 showPicker(btnElement, selector, colorPicker, COLOR_PICKER_DEST);
	 }
	 function showHatchPicker(btnElement, selector){
		 $('#colorPicker').hide();
		 var hatchPicker = $('#hatchPicker');
		 showPicker(btnElement, selector, hatchPicker, HATCH_PICKER_DEST);
	 }

	 function showPicker(t, selector, picker, pickerDestSel){
		 if (picker[0].lastCaller && picker[0].lastCaller == t){  //DOM added-attributes set on real DOM obj, not jQuery collection.
			 picker.hide();
			 picker[0].lastCaller = null;
			 return;
		 }
		 picker[0].lastCaller = t;
		 var palette = $('#palette');
		 var clicked = $(t);
		 var palettePadding = $('.sectionPageControlsGroup').css("padding");
		 var fPalettePadding = palettePadding.substring(0, palettePadding.length-2);

		 var pbmr = parseFloat($('.pickerButton').css('margin'));
		 var pbpa = parseFloat($('.pickerButton').css('padding'));
		 var fPickerButtonBloat = 0;
		 if (pbmr && pbpa && !isNaN(pbmr) && !isNaN(pbpa)){
			 	fPickerButtonBloat = pbmr + pbpa;
		 } else {
			 fPickerButtonBloat = 10;
		 }

		 var pickerTop;
	  	 if ( (clicked.offset().top + picker.height()) > palette.height()){
			pickerTop = (palette.height()-picker.height()-(fPalettePadding*2)) +"px";  //there's also a shadow height, but just multiply padding x2 and call it a night.
		 } else {
			pickerTop = clicked.offset().top - palette.offset().top;
		 }
		 picker.css({"position":"absolute",
		             "top":pickerTop,
				     "left":clicked.width() + clicked.offset().left - palette.offset().left + fPickerButtonBloat,
				     "border":"1px solid green"});
		 picker.attr(pickerDestSel, selector);
		 picker.show();
	 }

	 //============= Picker Clicked ==========================
	 var optionsColorPicker = {
		 pickerSelector: '#colorPicker',
		 dest: COLOR_PICKER_DEST,
		 lastPickedKey: 'colorClassPicked',
		 otherPickedKey: 'hatchClassPicked'
	 }
	 var optionsHatchPicker = {
		 pickerSelector: '#hatchPicker',
		 dest: HATCH_PICKER_DEST,
		 lastPickedKey: 'hatchClassPicked',
		 otherPickedKey: 'colorClassPicked'
	 }
	 function colorPickerClicked(t){
		 genericPickerClicked(t, optionsColorPicker);
	 }
	 function hatchPickerClicked(t){
		 genericPickerClicked(t, optionsHatchPicker);
	 }
	 function genericPickerClicked(t, options){
		 var colorClass = $(t).attr("colorClass");
		 var picker = $(options.pickerSelector);
		 var selector = picker.attr(options.dest);
		 var destCell = $(selector);
		 destCell.removeClass();
		 destCell.addClass(colorClass);
		 destCell.attr(options.lastPickedKey, colorClass);
		 var html = colorClass;

		 var otherClass = destCell.attr(options.otherPickedKey);
		 if (otherClass) {
			 destCell.addClass(otherClass);

			 if (colorClass.length>0){
			  	 html = colorClass + "+" + otherClass;
			 } else {
				 html = otherClass;
			 }
		 }
		 destCell.html(html);
		 picker.hide();
		 picker[0].lastCaller = null;
	 }
//================== END Pickers ===============================================


//================== Class and Color Lookups ===================================

    /*****
     *       Handle buttons like "Root", "Chord", and "Avoid".
     *       "ColorClass" may be a space-separated list of CSS classes, or just one class.
     *
     *       Source in "userColors.js" to get gUserColorDict.dict.
     *****/

	function lookupUserColorClass(note){  //automaticColorScheme
		return lookupUserColor(note).colorClass;
	}
	function lookupUserColor(note){  //automaticColorScheme
		if (doingAutomaticColor()){
			var res = lookupClassForNote(note);
			if (res) {
				// console.log("automatic userColor["+note.colorClass+"] -->"+res.colorClass);
				return res;
			} else {
				// console.log("automatic userColor["+note.colorClass+"]not found.");
			}
		}
		return {"colorClass":lookupUserColorClassByClass(note.colorClass), "functionNum":null};
	}

	function lookupUserColorClassByClass(theColorClass){
		var userColor = gUserColorDict.dict[theColorClass];
		if (!userColor){
			//console.log("userColor["+theColorClass+"]==null -->"+theColorClass);
			return theColorClass;
		}
		//console.log("userColor["+theColorClass+"] -->"+userColor.colorClass);
		return userColor.colorClass;
	}

	function lookupClassForNote(note){
		var result = {};
		var theRootID;
		switch (note.styleNum){
			case STYLENUM_BEND:
			case STYLENUM_TINY:
				theRootID = getCurrentFrame().rootIDLead;
				if (!theRootID || theRootID == "-1"){
					theRootID = getCurrentFrame().rootID;
				}
				break;
			case STYLENUM_NAMED:
			case STYLENUM_SINGLE:
			case STYLENUM_MIDIPITCHES:
			case STYLENUM_MIDIPITCHESSINGLE:
			case STYLENUM_FINGERING:
				theRootID = getCurrentFrame().rootID;
				break;
			default:
				theRootID = getCurrentFrame().rootID;
		}
		if (!note.noteName){  //for older files. :(
			if (note.midinum){
				note.noteName = midinumToNoteName(note.midinum);
			} else {
				if (note.noteNameClass){
					note.noteName = note.noteNameClass.substring(".note".length);  //todo: change this when you fix noteNameClass to be not ".note" but "note"
				}
			}
		}
		var noteNum = gNoteNamesArr.indexOf(note.noteName);  //   Bb ==> 1 (since A ==> 0)
		var relNoteNum = (12 + noteNum - theRootID) % 12; //the function number: Tau is 1.  0-based: 0==first note of scale
		//var noteFnBase = noteNamesFuncArr[relNoteNum];

		var notePlusNumKey = "note"+(relNoteNum+1);  //Use 1-based for note1, note2, etc.
		var userColor = gUserColorDict.dict[notePlusNumKey];
		if (userColor){
			result.colorClass = userColor.colorClass;
			result.functionNum = relNoteNum;
			return result;
		}
		return null;
	}
//================== END Class and Color Lookups ===============================
