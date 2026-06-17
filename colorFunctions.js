//color functions, moved from infinite-neck.js
import {
	gColorPickerColors
} from './colorPickerColors.js';
import {
	Note
} from './Note.js';
import { noteNameToNoteID } from './Constants.js';
import { NOTE_NAMES_ARRAY } from './Constants.js';
import {
	GraveType
} from './graveyard.js';
import {
	gUserColorDict,
	gUserColorDictOEM
} from './userColors.js';
import {
	toInt
} from './utils.js';

var colorFunctionsProviders = {
	getSong: function () { return null; },
	getCurrentSection: function () { return null; },
	doingAutomaticColor: function () { return false; },
	fullRepaint: function () { },
	displayOptionsChanged: function () { }
};

export function setColorFunctionsProviders(providers) {
	if (!providers) return;
	colorFunctionsProviders = {
		...colorFunctionsProviders,
		...providers
	};
}

function getSong() {
	return colorFunctionsProviders.getSong();
}

function getCurrentSection() {
	return colorFunctionsProviders.getCurrentSection();
}

function doingAutomaticColor() {
	return colorFunctionsProviders.doingAutomaticColor();
}

function fullRepaint() {
	return colorFunctionsProviders.fullRepaint();
}

function displayOptionsChanged() {
	return colorFunctionsProviders.displayOptionsChanged();
}

export function createLookupContext({
	section = getCurrentSection(),
	autoColor = doingAutomaticColor(),
	colorDict = gUserColorDict.dict,
	...rest
} = {}) {
	return {
		section,
		autoColor,
		colorDict,
		...rest
	};
}

function resolveLookupContext(lookupContext = {}) {
	const context = createLookupContext(lookupContext);
	if (!context.section) {
		return {
			...context,
			rootID: context.rootID ?? null,
			rootIDLead: context.rootIDLead ?? null
		};
	}
	return {
		...context,
		rootID: context.rootID ?? context.section.rootID,
		rootIDLead: context.rootIDLead ?? context.section.rootIDLead
	};
}


//================== colorDicts ================================================

	export function clean_ColorSchemeName(colorSchemeName){
		var result = {};
		colorSchemeName = colorSchemeName.replace(/([^a-z0-9]+)/gi, '-');
		if (colorSchemeName.trim().length == 0){
			colorSchemeName = "user";
			result.changed = true;
		}
		var existingScheme = getSong().colorDicts[colorSchemeName];
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

	export function recordUserColorsBoth(doSampleSection, doPickerChoices){
		const lookupContext = createLookupContext();
		var colorSchemeName = $('#txtColorSchemeName').val();
		var chosenSystemSchemeName = $('#txtColorSchemeName').attr('systemSchemeName');
		var cleanResult = clean_ColorSchemeName(colorSchemeName);
		colorSchemeName = cleanResult.colorSchemeName;
		$('#txtColorSchemeName').val(colorSchemeName);
		if (cleanResult.changed){
			flashLabel('#lblStylesheetName');
		}

		var rootIndex = toInt(getCurrentSection().rootID, 0);
	    var rootIndexLead = toInt(getCurrentSection().rootIDLead, 0);

		var colorDict = {};

		if (doSampleSection){
			let tunings = getSong().getVisibleTunings();
			if (tunings.length>0){
				let firstTableID = tunings[0];
				var notes = getCurrentSection().getSectionNotes(firstTableID).namedNotes;
				if (notes){
					var keys = Object.keys(notes);
					keys.forEach(noteName => {
						var noteFnNum = noteNameToNoteID(noteName);
						var rel = (12 + noteFnNum - rootIndex) % 12;
						var noteKey = "note" + (rel + 1); // Use 1-based for note1, note2, etc.
						var note = notes[noteName];
						var cc = note.colorClass;
						if (cc) {
							var noteClone = JSON.parse(JSON.stringify(note));
							noteClone.colorClass = cc;
							var res = lookupUserColor(noteClone, lookupContext);
							var defClone = JSON.parse(JSON.stringify(gUserColorDictOEM.dict[noteKey]));
							defClone.colorClass = res.colorClass;
							colorDict[noteKey] = defClone;
						}
					});
				} else {
					console.log("didn't find notes for firstTableID["+firstTableID+"] when doSampleSection in colorFunctions::recordUserColorsBoth()");
				}
			} else {
				console.log("No visible tunings for doSampleSection in colorFunctions::recordUserColorsBoth()");
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
		var recordedScheme = getSong().colorDicts[colorSchemeName];
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
				var cloneBase = getSong().colorDicts[cleanResult.systemSchemeName];
				Object.assign(recordedScheme.dict, cloneBase.dict);
			} else if (chosenSystemSchemeName){
				var cloneBase = getSong().colorDicts[chosenSystemSchemeName];
				Object.assign(recordedScheme.dict, cloneBase.dict);
			}
			$('#txtColorSchemeName').attr('systemSchemeName', null);

			Object.assign(recordedScheme.dict, colorDict);  //this colorDict is already a .dict object.
		}

		getSong().colorDicts[colorSchemeName] = recordedScheme;

		for (const [notekey, captionColor] of Object.entries(recordedScheme.dict)) {
			if (captionColor.colorClass){
				gUserColorDict.dict[notekey] = captionColor;
			}
		}
		chuseStylesheet(colorSchemeName);
		buildColorDicts();
		buildUserColors();
	}

	export function recordUserColors(){
		recordUserColorsBoth(false, true);
	}

	export function recordUserColorsFromSection(){
		recordUserColorsBoth(true, false);
	}


	 export function saveUserColorChoices(){
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

	export function buildColorDicts(){
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
		for (const [dictkey, schemeObj] of Object.entries(getSong().colorDicts)) {
			tbl.append(colorDictDisplayRow(dictkey, schemeObj, true, eventSelectors));
		}

		// Finally, the current, live, merged master list where lookups happen.
		var resultRow = colorDictDisplayRow("&rArr;&nbsp;Result", gUserColorDict, false, eventSelectors);
		resultRow.css({"height": "3em"});
		tbl.append(resultRow);


		$('#divColorDictsDest').empty().append(tbl);

		var activeStylesheets = calculateActiveStylesheets();
		$('.ActiveStylesheets').html("Active Stylesheets: "+activeStylesheets);
		getSong().activeStylesheets = activeStylesheets;

		updateCurrentColorDictStrip(activeStylesheets, gUserColorDict);
		registerColorSchemeCBEventSelectors(eventSelectors);
	}

	export function colorDictDisplayRow(dictkey, schemeObj, doChuseLink, eventSelectors){
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
			var A = $('<a href="#" class="choose-stylesheet" data-dictkey="'+dictkey+'">').html(dictkey);
			var nobr = $('<nobr>');
			nobr.append(checky);
			nobr.append(A);
			if (!schemeObj.readOnly && !schemeObj.computed){
				var rightX = $('<span style="width: 2em;">&nbsp;&nbsp;&nbsp;<a href="#" class="delete-stylesheet" data-dictkey="'+dictkey+'">&#x232B;</a></span>');
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
			row.append($('<td>').addClass('colorDictLinkTD').attr('noteRole', notekeyTempl).attr('title', notekeyTempl).html(caption).addClass(note.colorClass+borderClass));
		}

		if (doChuseLink){
			eventSelectors.push('#cbWhichColorDict'+dictkey);
		}
		

		return row;
	}

	function colorDictLinkCell(noteRole, note, caption = null) {
		const displayCaption = caption ?? note?.tiny ?? note?.caption ?? '';
		const colorClass = note?.colorClass || '';
		const borderClass = colorClass == "noteTransparent" ? " colorDictTransparent" : "";
		return $('<td>')
			.addClass('colorDictLinkTD')
			.attr('noteRole', noteRole)
			.attr('title', noteRole)
			.html(displayCaption)
			.addClass(colorClass + borderClass);
	}

	export function registerColorSchemeCBEventSelectorsFAILED(eventSelectors){
		if (!eventSelectors){
			console.warn("ERROR getting event selectors, which should look like:" 
				+"0:#cbWhichColorDictAll-Clear,1:#cbWhichColorDictCycleOfColors,2:#cbWhichColorDictRoles,3:#cbWhichColorDictFingerings,4:#cbWhichColorDictDefault"
			)
			return ;
		}
		var foo = eventSelectors;
		Object.keys(eventSelectors).forEach(k => {
			$(eventSelectors[k]).change(function(){
				var cb = $(this);
				var willBeChecked = cb.prop('checked');
				var id = cb.val();
				getSong().colorDicts[id].checked = willBeChecked;
				applyStylesheetsTo_gUserColorDict();
				fullRepaint();
				buildColorDicts();
			});
		});
	}

	export function registerColorSchemeCBEventSelectors(eventSelectors){
		eventSelectors.forEach(function(selector){
			$(selector).change(function(){
				var cb = $(this);
				var willBeChecked = cb.prop('checked');
				var id = cb.val();
				getSong().colorDicts[id].checked = willBeChecked;
				applyStylesheetsTo_gUserColorDict();
				fullRepaint();
				buildColorDicts();
			});
		});
	}

	export function moveStylesheetToEnd(lastDictkey){
		function remainingChecked(scheme){
			if (remainingCheckedVal == null){
				return scheme.checked;
			}
			return remainingCheckedVal;
		}
		var remainingCheckedVal = null;
		var temp = {};
		var last = null;

		for (const [key, scheme] of Object.entries(getSong().colorDicts)) {
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
		getSong().colorDicts = temp;
	}

export function chuseStylesheet(dictkey){
		var colorScheme = getSong().colorDicts[dictkey];
		if (colorScheme){
			getSong().currentColorDict = dictkey;
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
			displayOptionsChanged();
		}
	}

	export function refreshStylesheets(){
		applyStylesheetsTo_gUserColorDict();
		buildUserColors();
		buildColorDicts();
		fullRepaint();
	}

	export function flashLabel(lblSelector){
		$(lblSelector).addClass('basicBackground');
		setTimeout(function() {
	   		$(lblSelector).removeClass('basicBackground');
			$(lblSelector).addClass('transBackground');
			setTimeout(function() {
		   		$(lblSelector).removeClass('transBackground');
			}, 1000);


		}, 1000);
	}

	export function deleteUserStylesheet(dictkey){
		var obj = getSong().colorDicts[dictkey];
		var context = {"dictkey": dictkey, "which": "UserStylesheet"};
        getSong().graveyard.bury(GraveType.STYLESHEET, obj, context);

		delete getSong().colorDicts[dictkey];
		applyStylesheetsTo_gUserColorDict();
		buildUserColors();
		buildColorDicts();
		fullRepaint();
	}

	export function updateCurrentColorDictStrip(dictLabel, colorScheme){
		var row = colorDictDisplayRow(dictLabel, colorScheme, false);
		var newRow = $('<tr>');
		newRow.html(row.html());
		['noteTransparent', 'noteAutomatic'].reverse().forEach((noteRole) => {
			const note = gUserColorDict.dict[noteRole];
			if (note) {
				newRow.children('td:first').after(colorDictLinkCell(noteRole, note));
			}
		});
		var tbl = $("<table class='tblColorDictOneRow'>");
		tbl.append(newRow);
		$('.currentColorDict').empty().append(tbl);
	}

	export function applyStylesheetsTo_gUserColorDict(){
		for (const [key, scheme] of Object.entries(getSong().colorDicts)) {
			if (scheme.checked && !scheme.computed){
				var dict = scheme.dict;
				Object.assign(gUserColorDict.dict, dict);
			}
		}
	}

	export function calculateActiveStylesheets(){
		var result = [];
		for (const [key, scheme] of Object.entries(getSong().colorDicts)) {
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

    export function buildUserColors() {
        function buildOneRadio(Role, obj, checkedString){
            var userColorClass = "note"+Role;
            var captionClass = (obj.captionClass) ? obj.captionClass : userColorClass;
            var radio = $('<input type="radio" id="idR'+Role+'" name="rbColor" value="note'+Role+'"  '+checkedString+'>');
            var label = $('<label id="chooseRole'+Role+'" title="note'+Role+'" ></label>');
            label.append(radio);
            label.append(""+obj.caption);
            label.addClass("userColorRB");
            label.addClass(lookupUserColorClassByClass(captionClass));
			radio.val(userColorClass);
            $("#idRoleButtonsDest").append(label);
        }
        $("#idRoleButtonsDest").empty();
        var checkedString = 'checked="checked"';
		Object.entries(gUserColorDict.dict).forEach(([key, obj], idx) => {
			var role = key.substring("note".length);  // from noteChord" to "Chord"
			buildOneRadio(role, obj, checkedString);
			checkedString = '';//first one done, now the rest should be NOT checked.
		});
    
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
	export function buildColorPicker(){
		var CELL = '<td colorClass="NOTE_COLOR_CLASS" class="colorPickerCell NOTE_COLOR_CLASS" >&nbsp;&nbsp;</td>'
		var result = [];
		var groups = gColorPickerColors.groups;
		Object.entries(groups).forEach(([ig, row]) => {
			if (row) result.push("<tr>");
			row.forEach(noteColor => {
				if (noteColor){
					var cell = CELL.replace(/NOTE_COLOR_CLASS/g, noteColor);
					result.push(cell);
				}
			});
			if (row) result.push("</tr>");
		});
		var noneRow = "<tr><td colspan='100%' colorClass='' class='colorPickerCell noteBlue6'>none</td></tr>";
		result.push(noneRow);
		return result.join(''); //Return just TRs not TABLE.
	}

	export function buildUserColorsEditor() {
		function buildOneColor(role, obj, checkedString){
			  if (obj.readonly){   // e.g. noteTransparent and noteAutomatic are not user-editable and are marked thusly.
				  return null;
			  }
			  var userColorClass = "note"+role;
			  var captionClass = (obj.captionClass) ? obj.captionClass : userColorClass;
			  var lookedup = lookupUserColorClassByClass(captionClass);
			  var editingBox = "<td id='colorDestRole"+role+"'>&nbsp;</td>"
			                  +"<td><span class='pickerButton choose-color-picker' data-target='#colorDestRole"+role+"'>color</span>&nbsp;</td>"
							  +"<td><span class='pickerButton choose-hatch-picker' data-target='#colorDestRole"+role+"'>hatch</span></td>";

			  var row = $('<tr><td>'+role+'</td>'
			                 +'<td class="'+captionClass+'">'+captionClass+'</td>'
							 +'<td class="'+lookedup+'">'+lookedup+'</td>'
							 +'<td>'+editingBox+'</td>'
						 +'</tr>');
			  return row;
	   }
	    var table = $('<table>');
	    Object.entries(gUserColorDict.dict).forEach(([key, obj]) => {
			var role = key.substring("note".length);  // from noteChord" to "Chord"
			var row = buildOneColor(role, obj, "");
			if (row) {
				table.append(row);
			}
		});
	   $("#UserColorsEditorDest").empty().append(table);
	   $('#colorPicker').html(buildColorPicker());  //buildColorPicker returns rows, not TABLE.
	   // #hatchPicker is built manually in index.html
	 }


	 const COLOR_PICKER_DEST = "colorClassDestSel";
	 const HATCH_PICKER_DEST = "hatchClassDestSel";

	 export function showColorPicker(btnElement, selector){
		 $('#hatchPicker').hide();
		 var colorPicker  = $('#colorPicker');
		 showPicker(btnElement, selector, colorPicker, COLOR_PICKER_DEST);
	 }
	 export function showHatchPicker(btnElement, selector){
		 $('#colorPicker').hide();
		 var hatchPicker = $('#hatchPicker');
		 showPicker(btnElement, selector, hatchPicker, HATCH_PICKER_DEST);
	 }

	 export function showPicker(t, selector, picker, pickerDestSel){
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
	 export function colorPickerClicked(t){
		 genericPickerClicked(t, optionsColorPicker);
	 }
	 export function hatchPickerClicked(t){
		 genericPickerClicked(t, optionsHatchPicker);
	 }
	 export function genericPickerClicked(t, options){
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

	export function lookupUserColorClass(note, lookupContext){  //automaticColorScheme
		return lookupUserColor(note, lookupContext).colorClass;
	}
	export function lookupUserColor(note, lookupContext){  //automaticColorScheme
		const context = resolveLookupContext(lookupContext);
		if (context.autoColor){
			var res = lookupClassForNote(note, context);
			if (res) {
				// console.log("automatic userColor["+note.colorClass+"] -->"+res.colorClass);
				return res;
			} else {
				// console.log("automatic userColor["+note.colorClass+"]not found.");
			}
		}
		return {"colorClass":lookupUserColorClassByClass(note.colorClass, context), "functionNum":null};
	}

	export function lookupUserColorClassByClass(theColorClass, lookupContext){
		const context = resolveLookupContext(lookupContext);
		var userColor = context.colorDict[theColorClass];
		if (!userColor){
			//console.log("userColor["+theColorClass+"]==null -->"+theColorClass);
			return theColorClass;
		}
		//console.log("userColor["+theColorClass+"] -->"+userColor.colorClass);
		return userColor.colorClass;
	}

	export function lookupClassForNote(note, lookupContext){
		const context = resolveLookupContext(lookupContext);
		var result = {};
		var theRootID;
		switch (note.styleNum){
			case Note.STYLENUM_BEND:
			case Note.STYLENUM_TINY:
				theRootID = context.rootIDLead;
				if (theRootID == null || theRootID === "" || theRootID == "-1"){
					theRootID = context.rootID;
				}
				break;
			case Note.STYLENUM_NAMED:
			case Note.STYLENUM_SINGLE:
			case Note.STYLENUM_MIDIPITCHES:
			case Note.STYLENUM_MIDIPITCHESSINGLE:
			case Note.STYLENUM_FINGERING:
				theRootID = context.rootID;
				break;
			default:
				theRootID = context.rootID;
		}
		if (!note.noteName){
			return null;  
			/*  Some cases leave notes such as this hanging around: 
			"sectionNotesByTable": {
				"tblMIDI_1": {
				  "namedNotes": {
					"F": {},
					"Gb": {},
					"Bb": {
						"noteName": "Bb",
						"styleNum": 0,
						"colorClass": "noteTransparent"
					}
			*/
		}
		var noteNum = NOTE_NAMES_ARRAY.indexOf(note.noteName);  //   Bb ==> 1 (since A ==> 0)
		var relNoteNum = (12 + noteNum - theRootID) % 12; //the function number: Tau is 1.  0-based: 0==first note of scale

		var notePlusNumKey = "note"+(relNoteNum+1);  //Use 1-based for note1, note2, etc.
		var userColor = context.colorDict[notePlusNumKey];
		if (userColor){
			// Keep the existing function-key lookup, but let the root-bearing table
			// promote the root function to the special noteRoot styling.
			result.colorClass = userColor.colorClass;
			if (relNoteNum === 0 && context.noteRootTablename && context.tablename && context.noteRootTablename === context.tablename) {
				const noteRootColor = context.colorDict.noteRoot;
				if (noteRootColor?.colorClass) {
					result.colorClass = noteRootColor.colorClass;
				}
			}
			result.functionNum = relNoteNum;
			return result;
		}
		return null;
	}
//================== END Class and Color Lookups ===============================
