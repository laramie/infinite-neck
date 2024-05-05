//relies on themes.js which defines gThemes.

    //========= things that hold a ref to gThemes ==============================
    function getDefaultTheme(){
        return gThemes["Default"];
    }
    function getThemes(){
        return gThemes;
    }
    function getWidget_SelectThemes(){
        return generateSelectThemes(gThemes);
    }
    //==========================================================================

    function generateSelectThemes(themes){
        var sel = "<select class='selThemesClass' id='selThemes' tabindex='-1'>";
        var value = "";
        var result = "";
        var opt;

        for (var key in themes){
            var theme = themes[key];
            //console.log("theme:"+key+":"+JSON.stringify(theme, null, 2));

            opt =  "<option tabindex='-1' value='"+theme.id+"'>"+theme.caption+" </option>";
            sel = sel +opt;
        }
        sel = sel + "</select>";
        return sel;
    }

    //============  Helper functions for manipulating the DOM stylesheet =======
	/** send this to the DOM but not as a theme.
	  *    setOneVariable("--cell-spacing", "30px");
	  * produces this rule on the document:
	  *    :root { --cell-spacing: 30px; }
	  */
	function setOneCssVar(varname, value){
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


	function themeToControls(theme){
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
		setVal('#dropDownNoteRadius', 'noteRadius'); //  1%-50%
		setVal('#dropDownNamedNoteRadius', 'namedNoteRadius');  //  1%-50%
		setVal('#dropDownIvoryEbony', 'notePadding');  //padding is 0.5-1.5em
		setVal('#dropDownCellSpacing', 'cellSpacing');  //border-spacing is 0.1-1.0em
		setVal('#dropDownInstrumentBackground', 'instrumentBackground');
		setVal('#dropDownNutColor', 'nutColor');
		setVal('#dropDownDiamondsColor', 'diamondsColor');
		setVal('#dropDownDoubleDiamondsColor', 'doubleDiamondsColor');
		setVal('#dropDownDiamondsBackgroundColor', 'diamondsBackgroundColor');
		setVal('#dropDownDiamondsSize', 'diamondsSize');
		setVal('#dropDownInstrumentMargins', 'instrumentMargins');
		setVal('#dropDownBorderImageWhiteKey', 'borderImageWhiteKey');
		setVal('#dropDownBorderImageBlackKey', 'borderImageBlackKey');
		setVal('#dropDownInstrumentBorderImage', 'instrumentBorderImage');
	}

	function controlsToTheme(){
		var defaultOptions = JSON.parse(JSON.stringify(getDefaultTheme()));
		var options = JSON.parse(JSON.stringify(defaultOptions));
		var origThemeOptions = getThemes()[$('#selThemes option:selected').val()];

		function overwriteDefaultWithThemeValue(defOptions, themeOptions){
			Object.assign(defOptions, themeOptions);
		}
		//this applies current controls to default options.
		function overwriteDefaultWithControlValue(options){
			options.id = options.id + "-"+$('#selThemes option:selected').val();
			options.caption = options.caption + "+"+$('#selThemes option:selected').text();
			options.noteRadius           = $('#dropDownNoteRadius option:selected').val(); //  1%-50%
			options.namedNoteRadius      = $('#dropDownNamedNoteRadius option:selected').val();  //  1%-50%
			options.notePadding          = $('#dropDownIvoryEbony option:selected').val();  //padding is 0.5-1.5em
			options.cellSpacing          = $('#dropDownCellSpacing option:selected').val();  //border-spacing is 0.1-1.0em
			options.instrumentBackground = $('#dropDownInstrumentBackground option:selected').val();
			options.nutColor             = $('#dropDownNutColor option:selected').val();
			options.diamondsColor        = $('#dropDownDiamondsColor option:selected').val();
			options.doubleDiamondsColor  = $('#dropDownDoubleDiamondsColor option:selected').val();
			options.diamondsBackgroundColor= $('#dropDownDiamondsBackgroundColor option:selected').val();
			options.diamondsSize         = $('#dropDownDiamondsSize option:selected').val();
			options.instrumentMargins    = $('#dropDownInstrumentMargins option:selected').val();
			options.borderImageWhiteKey    = $('#dropDownBorderImageWhiteKey option:selected').val();
			options.borderImageBlackKey    = $('#dropDownBorderImageBlackKey option:selected').val();
			options.instrumentBorderImage  = $('#dropDownInstrumentBorderImage option:selected').val();
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
		for (key in options){
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
		}
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
	function clearThemeDiffResults(){
		$('#themeDiffResults').html("");
	}

	function theme(themeOptions){
		function rule(cssVarName, whichOption){
			if (themeOptions[whichOption]){
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
								 +"}"
						 +" .noteBlackKey {"
							     +rule("background-color", "noteBlackKeyColor")
							     +rule("color", "noteBlackKeyFontColor")
								 +"}"
						 +" :root { "
									+rule("--nut-gradient-color", "nutColor")
									+rule("--diamonds-color", "diamondsColor")
									+rule("--diamonds-background-color", "diamondsBackgroundColor")
									+rule("--double-diamonds-color", "doubleDiamondsColor")
									+rule("--diamonds-size", "diamondsSize")
									+rule("--note-white-color", "noteWhiteColor")
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
	function INFO(message){
		warny("INFO: "+message, false);
	}
	function warny(message, logToConsole){
		if (logToConsole) console.log(message);
		var warny = $('#warny');
		warny.html(warny.html()+"<br><br>"+message);
		//warny.show();
	}

	function auditThemes(){
		function showOptions(selector, optionName, foo){
			table.append("<tr><td>"+optionName+"</td><td><b>{&nbsp;"+showSelectOptions(selector,"   ")+"&nbsp;}</b></td><td>"+selector+"</td></tr>");
		}
		var table = $("<table class='INFO_Table'>");

		var themes = getThemes();
		for (k in themes){
			themeToControls(themes[k]);
			//sends a boatload of warning messages, one for each theme value not found in a select.
		}
		//Now show what's in all those SELECT dropdowns.
		showOptions('#dropDownNoteRadius', 'noteRadius'); //  1%-50%
		showOptions('#dropDownNamedNoteRadius', 'namedNoteRadius');  //  1%-50%
		showOptions('#dropDownIvoryEbony', 'notePadding');  //padding is 0.5-1.5em
		showOptions('#dropDownCellSpacing', 'cellSpacing');  //border-spacing is 0.1-1.0em
		showOptions('#dropDownInstrumentBackground', 'instrumentBackground');
		showOptions('#dropDownNutColor', 'nutColor');
		showOptions('#dropDownDiamondsColor', 'diamondsColor');
		showOptions('#dropDownDoubleDiamondsColor', 'doubleDiamondsColor');
		showOptions('#dropDownDiamondsBackgroundColor', 'diamondsBackgroundColor');
		showOptions('#dropDownDiamondsSize', 'diamondsSize');
		showOptions('#dropDownBorderImageWhiteKey', 'borderImageWhiteKey');
		showOptions('#dropDownBorderImageBlackKey', 'borderImageBlackKey');
		showOptions('#dropDownInstrumentBorderImage', 'instrumentBorderImage');

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
