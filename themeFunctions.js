import { gThemes } from './themes.js';

//relies on themes.js which defines gThemes.

    //========= things that hold a ref to gThemes ==============================
    export function getDefaultTheme(){
        return gThemes["Default"];
    }
    export function getThemes(){
        return gThemes;
    }
    export function getEmptyUserTheme(){
		return {
			id: "USER",
			caption: "USER"
		};
	}
	export function installUserTheme(userTheme){
		if (!userTheme || typeof userTheme !== 'object' || Array.isArray(userTheme)){
			gThemes["USER"] = getEmptyUserTheme();
			return null;
		}
		const runtimeUserTheme = {
			...userTheme,
			id: "USER",
			caption: "USER"
		};
		gThemes["USER"] = runtimeUserTheme;
		return runtimeUserTheme;
	}
    export function getWidget_SelectThemes(){
        return generateSelectThemes(gThemes);
    }

    //========= tracks whichever Theme is currently reflected in the Theme controls ============
    let lastAppliedTheme = null;
    /** Sprint 146 Iteration 2 (per user feedback): records the Theme object that themes.builder.js
     *  just loaded into the Theme controls via themeToControls() -- e.g. the per-table Theme in
     *  effect for whatever #selThemeTable is currently picked -- so controlsToTheme() can chain
     *  baseid/basecaption from IT when the user hits Save, instead of blindly re-consulting
     *  #selThemes (which doesn't move when a Matrix cell/table is picked, and may be stale).
     *  Only call this for "real" load flows (selThemeTableChange()/selThemesChange()) -- NOT from
     *  auditThemes()'s informational loop over every catalog theme, or Save would pick up
     *  whatever theme was last audited instead of what's actually on screen. */
    export function setLastAppliedTheme(theme){
        lastAppliedTheme = theme;
    }
    export function getLastAppliedTheme(){
        return lastAppliedTheme;
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

export function dumpThemeIds(){
	let result = [];
	result.push("<p><b style='font-size: 120%;'>Theme id values.</b> Use id with <b>/ei</b> to select themes by command-line (<b>/</b> <i>&gt; th<b>e</b>me &gt; <b>i</b>d</i>) in macros.</p>");
	result.push("<table class='tblThemeIdDump'>");
	result.push(`<tr><th>id</th><th>caption</th></tr>`);
	Object.values(gThemes).forEach(theme => {
		result.push(`<tr><td>${theme.id}</td><td>${theme.caption}</td></tr>`);
	});
	result.push("</table>");
	return result.join('\n');
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
			setVal('#dropDownNoteCornerShape', 'noteCornerShape'); //  bevel
			setVal('#dropDownNamedNoteRadius', 'namedNoteRadius');  //  1%-50%
			setVal('#dropDownIvoryEbony', 'notePadding');  //padding is 0.5-1.5em
			setVal('#dropDownCellSpacing', 'cellSpacing');  //border-spacing is 0.1-1.0em
			setVal('#dropDownInstrumentBackground', 'instrumentBackground');
			setVal('#dropDownInstrumentMargins', 'instrumentMargins');
			setVal('#dropDownNutColor', 'nutColor');
			setVal('#dropDownRootColor', 'rootColor');
			setVal('#dropDownDiamondsSize', 'diamondsSize');
			setVal('#dropDownDiamondsColor', 'diamondsColor');
			setVal('#dropDownDoubleDiamondsColor', 'doubleDiamondsColor');
			setVal('#dropDownDiamondsBackgroundColor', 'diamondsBackgroundColor');
			setVal('#dropDownFaceDiamondsSize', 'faceDiamondsSize');
			setVal('#dropDownFaceDiamondsColor', 'faceDiamondsColor');
			setVal('#dropDownFaceDoubleDiamondsSize', 'faceDoubleDiamondsSize');
			setVal('#dropDownFaceDoubleDiamondsColor', 'faceDoubleDiamondsColor');
			setVal('#dropDownFaceTinyDiamondsSize', 'faceTinyDiamondsSize');
			setVal('#dropDownSingleNoteShrink', 'singleNoteShrink');
			setVal('#dropDownSingleNoteShadowColor', 'singleNoteShadowColor');
			setVal('#dropDownNoteWhiteShadowColor', 'noteWhiteShadowColor');
			setVal('#dropDownNoteBlackShadowColor', 'noteBlackShadowColor');
			setVal('#dropDownSystemPitchColor', 'systemPitchColor');
			setVal('#dropDownSystemMultiColor', 'systemMultiColor');
			setVal('#dropDownSystemLeadColor', 'systemLeadColor');
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
			setVal('#dropDownInstrumentBorderThickness', 'instrumentBorderThickness');
			setVal('#dropDownInstrumentBorderSlice', 'instrumentBorderSlice');
			const ibi = theme["instrumentBorderImage"];
			if (ibi && (ibi != 'none')){
				//add *extra* space inside the border:
				setOneCssVar('--instrument-border-thickness', theme["instrumentBorderThickness"]);
				setOneCssVar('--instrument-border-slice', theme["instrumentBorderSlice"]);
			} else {
				setOneCssVar('--instrument-border-thickness', '0');
			}
		}
		setThemeControlValues();
	}

	export function controlsToTheme(){
		var defaultOptions = JSON.parse(JSON.stringify(getDefaultTheme()));
		var options = JSON.parse(JSON.stringify(defaultOptions));
		// Sprint 146 Iteration 2 (per user feedback): prefer whichever Theme is actually reflected
		// in the controls right now (tracked via setLastAppliedTheme() -- e.g. a per-table Theme
		// walked back from an earlier Section) over #selThemes, which is a separate picker that
		// doesn't move when a table/Matrix cell is picked and can be stale. Falls back to #selThemes
		// only if nothing has been explicitly loaded yet (e.g. before the Theme page's first use).
		var origThemeOptions = getLastAppliedTheme() || getThemes()[$('#selThemes').val()];

		function overwriteDefaultWithThemeValue(defOptions, themeOptions){
			Object.assign(defOptions, themeOptions);
		}
		//this applies current controls to default options.
		function overwriteDefaultWithControlValue(options){
			// Sprint 146 Iteration 2: capture the pre-suffix base id/caption (e.g. "Autobahn")
			// BEFORE appending the "-"/"+" + #selThemes suffix below, so callers that re-tag a
			// saved Theme for a specific Table+Section (see Song.js's _computeTableThemeIdentity())
			// can rebuild a clean "<base>+<table>:S<n>" caption without string-parsing games.
			// Prefer any baseid/basecaption ALREADY on options (merged in from origThemeOptions,
			// e.g. when origThemeOptions is itself a previously-concocted per-table Theme) so we
			// chain from the true root instead of re-basing off an already-suffixed id/caption.
			options.baseid = options.baseid || options.id;
			options.basecaption = options.basecaption || options.caption;
			options.id = options.id + "-"+$('#selThemes').val();
			options.caption = options.caption + "+"+$('#selThemes option:selected').text();
			options.noteRadius = $('#dropDownNoteRadius').val();
			options.noteCornerShape = $('#dropDownNoteCornerShape').val();
			options.namedNoteRadius = $('#dropDownNamedNoteRadius').val();
			options.notePadding = $('#dropDownIvoryEbony').val();
			options.cellSpacing = $('#dropDownCellSpacing').val();
			options.instrumentBackground = $('#dropDownInstrumentBackground').val();
			options.instrumentMargins = $('#dropDownInstrumentMargins').val();
			options.nutColor = $('#dropDownNutColor').val();
			options.rootColor = $('#dropDownRootColor').val();
			options.diamondsSize = $('#dropDownDiamondsSize').val();
			options.diamondsColor = $('#dropDownDiamondsColor').val();
			options.doubleDiamondsColor = $('#dropDownDoubleDiamondsColor').val();
			options.diamondsBackgroundColor = $('#dropDownDiamondsBackgroundColor').val();
			options.faceDiamondsSize = $('#dropDownFaceDiamondsSize').val();
			options.faceDiamondsColor = $('#dropDownFaceDiamondsColor').val();
			options.faceDoubleDiamondsSize = $('#dropDownFaceDoubleDiamondsSize').val();
			options.faceDoubleDiamondsColor = $('#dropDownFaceDoubleDiamondsColor').val();
			options.faceTinyDiamondsSize = $('#dropDownFaceTinyDiamondsSize').val();
			options.singleNoteShrink = $('#dropDownSingleNoteShrink').val();
			options.singleNoteShadowColor = $('#dropDownSingleNoteShadowColor').val();
			options.noteWhiteShadowColor = $('#dropDownNoteWhiteShadowColor').val();
			options.noteBlackShadowColor = $('#dropDownNoteBlackShadowColor').val();
			options.systemPitchColor = $('#dropDownSystemPitchColor').val();
			options.systemMultiColor = $('#dropDownSystemMultiColor').val();
			options.systemLeadColor = $('#dropDownSystemLeadColor').val();
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
			options.instrumentBorderThickness = $('#dropDownInstrumentBorderThickness').val();
			options.instrumentBorderSlice = $('#dropDownInstrumentBorderSlice').val();

			if (options.instrumentBorderImage && options.instrumentBorderImage !== "none"){
				//This is really *extra* space for the border.  Check the CSS declaration in instrument.css :: .instrumentBackground
				setOneCssVar('--instrument-border-thickness', options.instrumentBorderThickness);
				setOneCssVar('--instrument-border-slice', options.instrumentBorderSlice);
			} else {
				options.instrumentBorderThickness = '0'; 
				setOneCssVar('--instrument-border-thickness', '0');
			}
    
		}
		overwriteDefaultWithThemeValue(options, origThemeOptions);
		overwriteDefaultWithControlValue(options);
		//console.log("orig:"+JSON.stringify(origThemeOptions));
		//console.log("default:"+JSON.stringify(defaultOptions));
		//console.log("new:"+JSON.stringify(options));

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
		//console.log("theme::rule==>themeOptions:"+JSON.stringify(themeOptions));
		function resolvedThemeValue(whichOption){
			if (themeOptions && themeOptions[whichOption]){
				return themeOptions[whichOption];
			}
			if (defaultOptions && defaultOptions[whichOption]){
				return defaultOptions[whichOption];
			}
			return "";
		}
		function isUsableContrastColor(value){
			return !!value && `${value}`.trim() !== '' && `${value}`.trim().toLowerCase() !== 'transparent';
		}
		function normalizeColorToken(value){
			return `${value || ''}`.trim().toLowerCase();
		}
		function resolvedUniversalLaneColor(fontOption, ownKeyColorOption, oppositeKeyColorOption, fallbackValue){
			const fontColor = resolvedThemeValue(fontOption);
			const ownKeyColor = resolvedThemeValue(ownKeyColorOption);
			if (isUsableContrastColor(fontColor) && normalizeColorToken(fontColor) !== normalizeColorToken(ownKeyColor)){
				return fontColor;
			}
			const oppositeKeyColor = resolvedThemeValue(oppositeKeyColorOption);
			if (isUsableContrastColor(oppositeKeyColor)){
				return oppositeKeyColor;
			}
			return fallbackValue;
		}
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

		// Sprint 146: the 11 "hard" rule blocks that used to be emitted directly onto class
		// selectors here (td.note padding/border-radius/corner-shape, .namedNote/.NoteDisplay/
		// .universalNamedNote/.singleNote border-radius, table.fretTable border-spacing,
		// .instrumentBackground background-color, .nut border-color, .noteWhiteKey/.noteBlackKey
		// background-color+box-shadow) have all been converted to var-driven CSS -- see
		// infinite-neck.css's "Instrument / NoteTable / FretTable" section. This is what makes
		// per-table (per-instrument) theming possible: TableBuilder.js can set any of these vars
		// directly on a single table element to override the :root default below, using the same
		// mechanism already proven for --face-diamonds-left/--stringDividerHeight. Only the :root
		// assignments (which drive ALL tables unless a table overrides one itself) remain here.
		var styleBody = " :root { "
									+rule("--nut-gradient-color", "nutColor")
									+rule("--note-root-color", "rootColor")
									+rule("--diamonds-color", "diamondsColor")
									+rule("--diamonds-background-color", "diamondsBackgroundColor")
									+rule("--double-diamonds-color", "doubleDiamondsColor")
									+rule("--diamonds-size", "diamondsSize")
									+rule("--face-diamonds-size", "faceDiamondsSize")
									+rule("--face-diamonds-color", "faceDiamondsColor")
									+rule("--face-double-diamonds-size", "faceDoubleDiamondsSize")
									+rule("--face-double-diamonds-color", "faceDoubleDiamondsColor")
									+rule("--face-tiny-diamonds-size", "faceTinyDiamondsSize")
									+rule("--single-note-shrink", "singleNoteShrink")
									+rule("--note-white-color", "noteWhiteColor")
			
									+rule("--note-white-key-special-color", "noteWhiteKeySpecialColor")
									+rule("--note-black-key-special-color", "noteBlackKeySpecialColor")

									+rule("--single-note-shadow-color", "singleNoteShadowColor")
									+rule("--note-white-shadow-color", "noteWhiteShadowColor")
									+rule("--note-black-shadow-color", "noteBlackShadowColor")
									+rule("--system-pitch-color", "systemPitchColor")
									+rule("--system-multi-color", "systemMultiColor")
									+rule("--system-lead-color", "systemLeadColor")
									+"--universal-note-white-key-color: " + resolvedUniversalLaneColor('noteWhiteKeyFontColor', 'noteWhiteKeyColor', 'noteBlackKeyColor', 'black') + "; "
									+"--universal-note-black-key-color: " + resolvedUniversalLaneColor('noteBlackKeyFontColor', 'noteBlackKeyColor', 'noteWhiteKeyColor', 'white') + "; "
									+rule("--instrument-margin-tb", "instrumentMargins")
									+rule("--cell-spacing", "cellSpacing")
									+rule("--note-padding", "notePadding")
									+rule("--note-radius", "noteRadius")
									+rule("--note-corner-shape", "noteCornerShape")
									+rule("--named-note-radius", "namedNoteRadius")
									+rule("--instrument-background-color", "instrumentBackground")
									+rule("--note-white-key-color", "noteWhiteKeyColor")
									+rule("--note-black-key-color", "noteBlackKeyColor")
									+rule("--note-white-key-shadow-color", "noteWhiteKeyShadowColor")
									+rule("--note-black-key-shadow-color", "noteBlackKeyShadowColor")
									+rule("--border-image-black-key", "borderImageBlackKey")
									+rule("--border-image-white-key", "borderImageWhiteKey")
									+rule("--instrument-border-image", "instrumentBorderImage")
									+rule("--instrument-border-thickness", "instrumentBorderThickness")
									+rule("--instrument-border-slice", "instrumentBorderSlice")
									//+rule("--td-note-font-family", "tdNoteFontFamily")
									//+rule("--right-subscript-font-size", "rightSubscriptFontSize")

						+"       }";

		var style = $("style#laramieStyle");    //looking for <style id='laramieStyle'>
		style.html(styleBody);  //you can check that document.styleSheets will not have gotten any longer.
		themeResults(JSON.stringify(themeOptions, null, 2));
		THEME_INFO("style sent to DOM: <br>"+styleBody);
	}

	// Sprint 146 Phase 5: the same cssVarName/themeKey pairs theme()'s rule() calls write into
	// the global :root block above, kept here as a flat list (rather than refactoring theme()
	// itself, to avoid touching its already-verified string-building logic) so a single table's
	// element can get the identical set of vars applied as an inline-style override -- higher
	// specificity than :root, but scoped to just that table, not document-wide.
	const TABLE_THEME_CSS_VARS = [
		['--nut-gradient-color', 'nutColor'],
		['--note-root-color', 'rootColor'],
		['--diamonds-color', 'diamondsColor'],
		['--diamonds-background-color', 'diamondsBackgroundColor'],
		['--double-diamonds-color', 'doubleDiamondsColor'],
		['--diamonds-size', 'diamondsSize'],
		['--face-diamonds-size', 'faceDiamondsSize'],
		['--face-diamonds-color', 'faceDiamondsColor'],
		['--face-double-diamonds-size', 'faceDoubleDiamondsSize'],
		['--face-double-diamonds-color', 'faceDoubleDiamondsColor'],
		['--face-tiny-diamonds-size', 'faceTinyDiamondsSize'],
		['--single-note-shrink', 'singleNoteShrink'],
		['--note-white-color', 'noteWhiteColor'],
		['--note-white-key-special-color', 'noteWhiteKeySpecialColor'],
		['--note-black-key-special-color', 'noteBlackKeySpecialColor'],
		['--single-note-shadow-color', 'singleNoteShadowColor'],
		['--note-white-shadow-color', 'noteWhiteShadowColor'],
		['--note-black-shadow-color', 'noteBlackShadowColor'],
		['--system-pitch-color', 'systemPitchColor'],
		['--system-multi-color', 'systemMultiColor'],
		['--system-lead-color', 'systemLeadColor'],
		['--instrument-margin-tb', 'instrumentMargins'],
		['--cell-spacing', 'cellSpacing'],
		['--note-padding', 'notePadding'],
		['--note-radius', 'noteRadius'],
		['--note-corner-shape', 'noteCornerShape'],
		['--named-note-radius', 'namedNoteRadius'],
		['--instrument-background-color', 'instrumentBackground'],
		['--note-white-key-color', 'noteWhiteKeyColor'],
		['--note-black-key-color', 'noteBlackKeyColor'],
		['--note-white-key-shadow-color', 'noteWhiteKeyShadowColor'],
		['--note-black-key-shadow-color', 'noteBlackKeyShadowColor'],
		['--border-image-black-key', 'borderImageBlackKey'],
		['--border-image-white-key', 'borderImageWhiteKey'],
		['--instrument-border-image', 'instrumentBorderImage'],
		['--instrument-border-thickness', 'instrumentBorderThickness'],
		['--instrument-border-slice', 'instrumentBorderSlice'],
	];

	function isUsableContrastColorValue(value){
		return !!value && `${value}`.trim() !== '' && `${value}`.trim().toLowerCase() !== 'transparent';
	}
	function normalizeColorTokenValue(value){
		return `${value || ''}`.trim().toLowerCase();
	}
	// Same derivation as theme()'s resolvedUniversalLaneColor(), but reads directly off a
	// complete themeOptions object (no defaultOptions fallback needed -- controlsToTheme()
	// already guarantees every key is filled in before a per-table Theme is ever saved).
	function resolvedUniversalLaneColorFromOptions(themeOptions, fontOption, ownKeyColorOption, oppositeKeyColorOption, fallbackValue){
		const fontColor = themeOptions[fontOption];
		const ownKeyColor = themeOptions[ownKeyColorOption];
		if (isUsableContrastColorValue(fontColor) && normalizeColorTokenValue(fontColor) !== normalizeColorTokenValue(ownKeyColor)){
			return fontColor;
		}
		const oppositeKeyColor = themeOptions[oppositeKeyColorOption];
		if (isUsableContrastColorValue(oppositeKeyColor)){
			return oppositeKeyColor;
		}
		return fallbackValue;
	}

	/** Sprint 146 Phase 5: applies (or clears) one table's per-instrument Theme override.
	 *  themeOptions must be a complete frozen theme object (same shape controlsToTheme()
	 *  produces -- every key already filled in from defaults), or null/undefined to clear a
	 *  previously-applied override (e.g. after "Clear Table Theme"), letting the table fall
	 *  back to inheriting the global :root theme written by theme() above. Called from
	 *  TableBuilder.js's buildNoteTable() (initial/rebuild) and infinite-neck.js's
	 *  refreshTableThemeDisplay() (immediate Save/Clear feedback, no full rebuild needed). */
	export function applyThemeToTableElement(tableEl, themeOptions){
		if (!tableEl || !tableEl.style){
			return;
		}
		if (!themeOptions || typeof themeOptions !== 'object'){
			TABLE_THEME_CSS_VARS.forEach(([cssVarName]) => tableEl.style.removeProperty(cssVarName));
			tableEl.style.removeProperty('--universal-note-white-key-color');
			tableEl.style.removeProperty('--universal-note-black-key-color');
			return;
		}
		TABLE_THEME_CSS_VARS.forEach(([cssVarName, themeKey]) => {
			const value = themeOptions[themeKey];
			if (value !== undefined && value !== null && value !== ''){
				tableEl.style.setProperty(cssVarName, value);
			} else {
				tableEl.style.removeProperty(cssVarName);
			}
		});
		tableEl.style.setProperty('--universal-note-white-key-color', resolvedUniversalLaneColorFromOptions(themeOptions, 'noteWhiteKeyFontColor', 'noteWhiteKeyColor', 'noteBlackKeyColor', 'black'));
		tableEl.style.setProperty('--universal-note-black-key-color', resolvedUniversalLaneColorFromOptions(themeOptions, 'noteBlackKeyFontColor', 'noteBlackKeyColor', 'noteWhiteKeyColor', 'white'));
	}

	function WARN(message){
		warny("WARNING: "+message, true);
	}
	export function THEME_INFO(message){
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
			showOptions('#dropDownNoteCornerShape', 'noteCornerShape');
			showOptions('#dropDownNamedNoteRadius', 'namedNoteRadius');
			showOptions('#dropDownIvoryEbony', 'notePadding');
			showOptions('#dropDownCellSpacing', 'cellSpacing');
			showOptions('#dropDownInstrumentBackground', 'instrumentBackground');
			showOptions('#dropDownInstrumentMargins', 'instrumentMargins');
			showOptions('#dropDownNutColor', 'nutColor');
			showOptions('#dropDownRootColor', 'rootColor');
			showOptions('#dropDownDiamondsSize', 'diamondsSize');
			showOptions('#dropDownDiamondsColor', 'diamondsColor');
			showOptions('#dropDownDoubleDiamondsColor', 'doubleDiamondsColor');
			showOptions('#dropDownDiamondsBackgroundColor', 'diamondsBackgroundColor');
			showOptions('#dropDownFaceDiamondsSize', 'faceDiamondsSize');
			showOptions('#dropDownFaceDiamondsColor', 'faceDiamondsColor');
			showOptions('#dropDownFaceDoubleDiamondsSize', 'faceDoubleDiamondsSize');
			showOptions('#dropDownFaceDoubleDiamondsColor', 'faceDoubleDiamondsColor');
			showOptions('#dropDownFaceTinyDiamondsSize', 'faceTinyDiamondsSize');
			showOptions('#dropDownSingleNoteShrink', 'singleNoteShrink');
			showOptions('#dropDownSingleNoteShadowColor', 'singleNoteShadowColor');
			showOptions('#dropDownNoteWhiteShadowColor', 'noteWhiteShadowColor');
			showOptions('#dropDownNoteBlackShadowColor', 'noteBlackShadowColor');
			showOptions('#dropDownSystemPitchColor', 'systemPitchColor');
			showOptions('#dropDownSystemMultiColor', 'systemMultiColor');
			showOptions('#dropDownSystemLeadColor', 'systemLeadColor');
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
			showOptions('#dropDownInstrumentBorderThickness', 'instrumentBorderThickness');
			showOptions('#dropDownInstrumentBorderSlice', 'instrumentBorderSlice');
		}	
		auditThemesShowOptions();

		THEME_INFO("auditThemes result <br>"+table[0].outerHTML);
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
