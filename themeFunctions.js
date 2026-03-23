import { gThemes } from './themes.js';

//relies on themes.js which defines gThemes.

    //========= things that hold a ref to gThemes ==============================
    export function getDefaultTheme(){
        return gThemes["Default"];
    }
    export function getThemes(){
        return gThemes;
    }
    export function getWidget_SelectThemes(){
        return generateSelectThemes(gThemes);
    }
    //==========================================================================

    function generateSelectThemes(themes){
	var sel = "<select class='selThemesClass' id='selThemes' tabindex='-1'>";
	var value = "";
	var result = "";
	var opt;
	var isFirst = true;
	Object.values(themes).forEach(theme => {
		//console.log("theme:"+theme.id+":"+JSON.stringify(theme, null, 2));
		var selectedAttr = isFirst ? " selected" : "";
		opt =  "<option tabindex='-1' value='"+theme.id+"'"+selectedAttr+">"+theme.caption+" </option>";
		sel = sel + opt;
		isFirst = false;
	});
	sel = sel + "</select>";
	return sel;
}

    //============  Helper functions for manipulating the DOM stylesheet =======
	/** send this to the DOM but not as a theme.
	  *    setOneVariable("--cell-spacing", "30px");
	  * produces this rule on the document:
	  *    :root { --cell-spacing: 30px; }
	  */
	export function setOneCssVar(varname, value){
		document.body.style.setProperty(varname, value);
	}
	/** send this to the DOM but as a variable in an existing stylesheet created by theme().
	  * Once any variable is "themed" by calling theme(), you must use this call to re-set it.
	  *    setOneThemedCssVar("--cell-spacing", "30px");
	  * produces this rule on the style#laramieStyle element:
	  *    :root { --cell-spacing: 30px; }
	  $("#laramieStyle").html(":root { "+varname+": "+value+"; }");
	  */
	function setOneThemedCssVar(varname, value){
		$("#laramieStyle").html(":root { "+varname+": "+value+"; }");
	}
    //=======================================================================


	export function themeToControls(theme){
		function setVal(selector, whichThemeKey){
			if (theme[whichThemeKey]){
				var newValue = theme[whichThemeKey];
				var jSelectBox = $(selector);
				var exists = false;
				var availableValues = "";
				var first = true;
				jSelectBox.children("option").each(function(){
					availableValues += (first?"":",")+this.value;
					first = false;
				    if (this.value == newValue) {
				        exists = true;
				        return false;
				    }
				});
				if (exists){
					jSelectBox.val(newValue);
					//console.log(theme.id+":val["+whichThemeKey+"]:"+newValue);
				} else {
					WARN("theme:"+theme.id+"["+whichThemeKey+"]==&gt;["+newValue+"]"
					    +" NOT IN SELECT"+selector+" {"+availableValues+"}");
				}
			} else {
				//console.log(theme.id+":NOT doing val["+whichThemeKey+"]:");
			}
		}
		//console.log("themeToControls:"+JSON.stringify(theme, null, 2));
		function setThemeControlValues(){
			setVal('#dropDownNoteRadius', 'noteRadius'); //  1%-50%
			setVal('#dropDownNamedNoteRadius', 'namedNoteRadius');  //  1%-50%
			setVal('#dropDownIvoryEbony', 'notePadding');  //padding is 0.5-1.5em
			setVal('#dropDownCellSpacing', 'cellSpacing');  //border-spacing is 0.1-1.0em
			setVal('#dropDownInstrumentBackground', 'instrumentBackground');
			setVal('#dropDownInstrumentMargins', 'instrumentMargins');
			setVal('#dropDownNutColor', 'nutColor');
			setVal('#dropDownDiamondsSize', 'diamondsSize');
			setVal('#dropDownDiamondsColor', 'diamondsColor');
			setVal('#dropDownDoubleDiamondsColor', 'doubleDiamondsColor');
			setVal('#dropDownDiamondsBackgroundColor', 'diamondsBackgroundColor');
			setVal('#dropDownNoteWhiteShadowColor', 'noteWhiteShadowColor');
			setVal('#dropDownNoteBlackShadowColor', 'noteBlackShadowColor');
			setVal('#dropDownNoteWhiteKeyShadowColor', 'noteWhiteKeyShadowColor');
			setVal('#dropDownNoteBlackKeyShadowColor', 'noteBlackKeyShadowColor');
			
			setVal('#dropDownNoteWhiteKeyColor', 'noteWhiteKeyColor');
			setVal('#dropDownNoteBlackKeyColor', 'noteBlackKeyColor');
			setVal('#dropDownNoteWhiteKeySpecialColor', 'noteWhiteKeySpecialColor');
			setVal('#dropDownNoteBlackKeySpecialColor', 'noteBlackKeySpecialColor');


			setVal('#dropDownNoteWhiteKeyFontColor', 'noteWhiteKeyFontColor');
			setVal('#dropDownNoteBlackKeyFontColor', 'noteBlackKeyFontColor');
			setVal('#dropDownBorderImageWhiteKey', 'borderImageWhiteKey');
			setVal('#dropDownBorderImageBlackKey', 'borderImageBlackKey');
			setVal('#dropDownInstrumentBorderImage', 'instrumentBorderImage');
		}
		setThemeControlValues();
	}

	export function controlsToTheme(){
		var defaultOptions = JSON.parse(JSON.stringify(getDefaultTheme()));
		var options = JSON.parse(JSON.stringify(defaultOptions));
		var origThemeOptions = getThemes()[$('#selThemes').val()];

		function overwriteDefaultWithThemeValue(defOptions, themeOptions){
			Object.assign(defOptions, themeOptions);
		}
		//this applies current controls to default options.
		function overwriteDefaultWithControlValue(options){
			options.id = options.id + "-"+$('#selThemes').val();
			options.caption = options.caption + "+"+$('#selThemes option:selected').text();
			options.noteRadius = $('#dropDownNoteRadius').val();
			options.namedNoteRadius = $('#dropDownNamedNoteRadius').val();
			options.notePadding = $('#dropDownIvoryEbony').val();
			options.cellSpacing = $('#dropDownCellSpacing').val();
			options.instrumentBackground = $('#dropDownInstrumentBackground').val();
			options.instrumentMargins = $('#dropDownInstrumentMargins').val();
			options.nutColor = $('#dropDownNutColor').val();
			options.diamondsSize = $('#dropDownDiamondsSize').val();
			options.diamondsColor = $('#dropDownDiamondsColor').val();
			options.doubleDiamondsColor = $('#dropDownDoubleDiamondsColor').val();
			options.diamondsBackgroundColor = $('#dropDownDiamondsBackgroundColor').val();
			options.noteWhiteShadowColor = $('#dropDownNoteWhiteShadowColor').val();
			options.noteBlackShadowColor = $('#dropDownNoteBlackShadowColor').val();
			options.noteWhiteKeyShadowColor = $('#dropDownNoteWhiteKeyShadowColor').val();
			options.noteBlackKeyShadowColor = $('#dropDownNoteBlackKeyShadowColor').val();

			options.noteWhiteKeyColor = $('#dropDownNoteWhiteKeyColor').val();
			options.noteBlackKeyColor = $('#dropDownNoteBlackKeyColor').val();
			options.noteWhiteKeySpecialColor = $('#dropDownNoteWhiteKeySpecialColor').val();
			options.noteBlackKeySpecialColor = $('#dropDownNoteBlackKeySpecialColor').val();

			options.noteWhiteKeyFontColor = $('#dropDownNoteWhiteKeyFontColor').val();
			options.noteBlackKeyFontColor = $('#dropDownNoteBlackKeyFontColor').val();
			options.borderImageWhiteKey = $('#dropDownBorderImageWhiteKey').val();
			options.borderImageBlackKey = $('#dropDownBorderImageBlackKey').val();
			options.instrumentBorderImage = $('#dropDownInstrumentBorderImage').val();
		}
		overwriteDefaultWithThemeValue(options, origThemeOptions);
		overwriteDefaultWithControlValue(options);
		console.log("orig:"+JSON.stringify(origThemeOptions));
		console.log("default:"+JSON.stringify(defaultOptions));
		console.log("new:"+JSON.stringify(options));

		themeDiffResults(themeDiff(options, defaultOptions, origThemeOptions));
		return options;
	}

	function themeDiff(options, def, orig){
		function u(val){
			return (val==undefined) ? "<span class='undefThemeOption'>"+val+"</span>" : val;
		}
		var htmlres = "";
		Object.keys(options).forEach(key => {
			var val = options[key];
			var valdef = def[key];
			var valorig = orig[key];
			if (val != valorig){
				htmlres += "<tr class='themeDiff_Changed'><td><b>"+key+"</b></td><td>"+val+"</td><td>"+u(valorig)+"</td><td>"+u(valdef)+"</td></tr>";
			} else if (val != valdef){
				htmlres += "<tr class='themeDiff_NotDefault'><td>"+key+"</td><td>"+val+"</td><td>"+u(valorig)+"</td><td>"+u(valdef)+"</td></tr>";
			} else {
				htmlres += "<tr  class='themeDiff_Default'><td><i>"+key+"</i></td><td>"+val+"</td><td>"+u(valorig)+"</td><td>"+u(valdef)+"</td></tr>";
			}
		});
		return "<table id='themeDiff'>"
				+"<caption><span class='themeDiff_NotDefault'>not default</span><span class='themeDiff_Default'>default</span><span class='themeDiff_Changed'>changed</span></caption>"
				+" <tr><th>property</th><th>value</th><th>original</th><th>default</th></tr>"
				  +htmlres
				+"</table>";
	}

	function themeResults(html){
		$('#tdThemeResults').html(html);
	}
	function themeDiffResults(html){
		$('#themeDiffResults').html(html);
	}
	export function clearThemeDiffResults(){
		$('#themeDiffResults').html("");
	}

	export function theme(themeOptions){
		console.log("theme::rule==>themeOptions:"+JSON.stringify(themeOptions));
		function rule(cssVarName, whichOption){
			//console.log("cssVarName:"+cssVarName+", whichOption:"+whichOption+"<=="); 
			if (themeOptions && themeOptions[whichOption]){
				return cssVarName+": "+themeOptions[whichOption]+"; ";   //no extra quotes around cssVarName or value.  This is CSS not JSON.
			} else if (defaultOptions[whichOption]){
				return cssVarName+": "+defaultOptions[whichOption]+"; ";   //no extra quotes around cssVarName or value.  This is CSS not JSON.
			}
			//console.log(themeOptions.id+":NOT using rule option: "+whichOption);
			return "";
		}
		var defaultOptions = getDefaultTheme();

		//This is pure CSS, so use things like {border-radius: 10%;}  and NOT JSON: {"border-radius": "10%"}
		//  which doesn't pass the CSS parser.

		var styleBody = "td.note {"
						         +rule("padding", "notePadding")
						         +rule("border-radius", "noteRadius")
								 +"}"
						 +" .namedNote, .NoteDisplay {"
						         +rule("border-radius", "namedNoteRadius")
								 +"}"
						 +" .singleNote {"
						         +rule("border-radius", "namedNoteRadius")
								 +" border-top-left-radius: var(--singleNote-top-left-radius);"
								 +"}"
						 +" table.fretTable {"
						         +rule("border-spacing", "cellSpacing")
								 +"}"
						 +" .instrumentBackground {"
						         +rule("background-color", "instrumentBackground")
								 +"}"
						 +" .nut {"
						         +rule("border-color", "nutColor")
							     +"}"
						 +" .noteWhiteKey {"
							     +rule("background-color", "noteWhiteKeyColor")
							     +rule("color", "noteWhiteKeyFontColor")
								 +rule("box-shadow", "noteWhiteKeyShadowColor")
								 +"}"
						 +" .noteBlackKey {"
							     +rule("background-color", "noteBlackKeyColor")
							     +rule("color", "noteBlackKeyFontColor")
							     +rule("box-shadow", "noteBlackKeyShadowColor")
								 +"}"
						 +" :root { "
									+rule("--nut-gradient-color", "nutColor")
									+rule("--diamonds-color", "diamondsColor")
									+rule("--diamonds-background-color", "diamondsBackgroundColor")
									+rule("--double-diamonds-color", "doubleDiamondsColor")
									+rule("--diamonds-size", "diamondsSize")
									+rule("--note-white-color", "noteWhiteColor")
			
									+rule("--note-white-key-special-color", "noteWhiteKeySpecialColor")
									+rule("--note-black-key-special-color", "noteBlackKeySpecialColor")

									+rule("--note-white-shadow-color", "noteWhiteShadowColor")
									+rule("--note-black-shadow-color", "noteBlackShadowColor")
									+rule("--instrument-margin-tb", "instrumentMargins")
									+rule("--cell-spacing", "cellSpacing")
									+rule("--named-note-radius", "namedNoteRadius")
									+rule("--border-image-black-key", "borderImageBlackKey")
									+rule("--border-image-white-key", "borderImageWhiteKey")
									+rule("--instrument-border-image", "instrumentBorderImage")
									//+rule("--td-note-font-family", "tdNoteFontFamily")
									//+rule("--right-subscript-font-size", "rightSubscriptFontSize")

						+"       }";

		var style = $("style#laramieStyle");    //looking for <style id='laramieStyle'>
		style.html(styleBody);  //you can check that document.styleSheets will not have gotten any longer.
		themeResults(JSON.stringify(themeOptions, null, 2));
		INFO("style sent to DOM: <br>"+styleBody);
	}

	function WARN(message){
		warny("WARNING: "+message, true);
	}
	export function INFO(message){
		warny("INFO: "+message, false);
	}
	function warny(message, logToConsole){
		if (logToConsole) console.log(message);
		var warny = $('#warny');
		warny.html(warny.html()+"<br><br>"+message);
		//warny.show();
	}

	export function auditThemes(){
		function showOptions(selector, optionName, foo){
			table.append("<tr><td>"+optionName+"</td><td><b>{&nbsp;"+showSelectOptions(selector,"   ")+"&nbsp;}</b></td><td>"+selector+"</td></tr>");
		}
		var table = $("<table class='INFO_Table'>");

		Object.values(getThemes()).forEach(theme => {
			themeToControls(theme);
		});
		//Now show what's in all those SELECT dropdowns.
		function auditThemesShowOptions(){
			showOptions('#dropDownNoteRadius', 'noteRadius');
			showOptions('#dropDownNamedNoteRadius', 'namedNoteRadius');
			showOptions('#dropDownIvoryEbony', 'notePadding');
			showOptions('#dropDownCellSpacing', 'cellSpacing');
			showOptions('#dropDownInstrumentBackground', 'instrumentBackground');
			showOptions('#dropDownInstrumentMargins', 'instrumentMargins');
			showOptions('#dropDownNutColor', 'nutColor');
			showOptions('#dropDownDiamondsSize', 'diamondsSize');
			showOptions('#dropDownDiamondsColor', 'diamondsColor');
			showOptions('#dropDownDoubleDiamondsColor', 'doubleDiamondsColor');
			showOptions('#dropDownDiamondsBackgroundColor', 'diamondsBackgroundColor');
			showOptions('#dropDownNoteWhiteShadowColor', 'noteWhiteShadowColor');
			showOptions('#dropDownNoteBlackShadowColor', 'noteBlackShadowColor');
			showOptions('#dropDownNoteWhiteKeyShadowColor', 'noteWhiteKeyShadowColor');
			showOptions('#dropDownNoteBlackKeyShadowColor', 'noteBlackKeyShadowColor');

			showOptions('#dropDownNoteWhiteKeyColor', 'noteWhiteKeyColor');
			showOptions('#dropDownNoteBlackKeyColor', 'noteBlackKeyColor');
			showOptions('#dropDownNoteWhiteKeySpecialColor', 'noteWhiteKeySpecialColor');
			showOptions('#dropDownNoteBlackKeySpecialColor', 'noteBlackKeySpecialColor');

			showOptions('#dropDownNoteWhiteKeyFontColor', 'noteWhiteKeyFontColor');
			showOptions('#dropDownNoteBlackKeyFontColor', 'noteBlackKeyFontColor');
			showOptions('#dropDownBorderImageWhiteKey', 'borderImageWhiteKey');
			showOptions('#dropDownBorderImageBlackKey', 'borderImageBlackKey');
			showOptions('#dropDownInstrumentBorderImage', 'instrumentBorderImage');
		}	
		auditThemesShowOptions();

		INFO("auditThemes result <br>"+table[0].outerHTML);
	}

	function showSelectOptions(selector, delimeter){
		var jSelectBox = $(selector);
		var availableValues = "";
		var first = true;
		jSelectBox.children("option").each(function(){
			availableValues += (first?"":delimeter)+this.value;
			first = false;
		});
		return availableValues;
	}
