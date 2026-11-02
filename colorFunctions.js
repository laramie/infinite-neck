//color functions, moved from infinite-neck.js
// Sprint 150: Stylesheet CRUD UI.  The decisions (names, recipes, plans, editor state) live in the
// pure module templates/palette/stylesheetPlan.js; this file renders with safe DOM calls and applies the plans.
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
import {
	applyRecipe, buildRecipe, buildSheetEntry, chooseColorDictValue, countChanges, createEditor,
	describeLookPlan, describePlan, describeUsage, editorClearRole, editorLoadEdits, editorSelect,
	editorSetPart, findLookUsage, findSheetUsage, freeName, isBuiltInName, isUserSheet, joinClass,
	moveUserSheet, planCopy, planRename, planSave, planSaveLook, repointReferences, setBuiltInLevel,
	splitClass, takenNames, userKeys, visibleCell
} from './templates/palette/stylesheetPlan.js';

var colorFunctionsProviders = {
	getSong: function () { return null; },
	getCurrentSection: function () { return null; },
	doingAutomaticColor: function () { return false; },
	doingAutomaticColorHighlight: function () { return false; },
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

function doingAutomaticColorHighlight() {
	return colorFunctionsProviders.doingAutomaticColorHighlight();
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
	autoColorHighlight = doingAutomaticColorHighlight(),
	colorDict = gUserColorDict.dict,
	...rest
} = {}) {
	return {
		section,
		autoColor,
		autoColorHighlight,
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

	const GLYPH_UP = '\u2191';
	const GLYPH_DOWN = '\u2193';
	const GLYPH_DELETE = '\u232B';

	// The Stylesheet editor's pending state (what the Customize panel shows). Module-level, so
	// rebuilding the role table or the Stylesheets table never wipes picks.
	const editor = createEditor();

	const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

	/** Captions may carry entities ("&#9839;"); decode to plain text and always insert as text. */
	function decodeEntities(s) {
		return $('<textarea>').html(String(s ?? '')).val();
	}

	/** Element-id slug for a sheet or role name. */
	function domId(name) {
		return String(name).replace(/[^A-Za-z0-9_-]/g, '_');
	}

	function songLooks() {
		const song = getSong();
		return (song && song.colorLooks) || {};
	}

	function showStylesheetMessage(text) {
		$('#divStylesheetMessage').text(text || '');
	}

	function setNameField(value) {
		$('#txtColorSchemeName').val(value);
	}

	function roleKeys() {
		return Object.keys(gUserColorDict.dict).filter((k) => !gUserColorDict.dict[k].readonly);
	}

	/** Every user action that changes which sheets are ticked (or their order or content) ends here:
	 *  the stored value is recomputed from the ticked set (recipe, or a Look with the same recipe). */
	function refreshAfterUserChange() {
		getSong().currentColorDict = '';
		applyStylesheetsTo_gUserColorDict();
		buildUserColors();
		buildColorDicts({ force: true });
		fullRepaint();
	}

	export function resetStylesheetEditor() {
		Object.assign(editor, createEditor());
		setNameField('');
		showStylesheetMessage('');
		renderAllEditorCells();
		refreshStylesheetHint();
	}

	//------------------------------ table ---------------------------------------

	export function buildColorDicts(options = {}){
		const song = getSong();
		if (!song || !song.colorDicts) return;
		var tbl = $("<table class='tblColorDicts'>").attr('id', 'tblColorDicts');

		// Headers from gUserColorDict.dict, which is the definitive list of all merged Roles+Fingerings+Functions
		var headerRow = $('<tr>').attr('id', 'ssRowHeader');
		headerRow.append($('<td class="ssHeaderCaption">').text('Stylesheets'));
		roleKeys().forEach((notekey) => {
			headerRow.append($('<td class="vertical-header">').append($('<span>').text(notekey.substring('note'.length))));
		});
		headerRow.append($('<td class="ssHeaderButtons">'));
		tbl.append(headerRow);

		// then all matching keys in each Dict in the song's list.
		const users = userKeys(song.colorDicts);
		for (const [dictkey, schemeObj] of Object.entries(song.colorDicts)) {
			const userIndex = users.indexOf(dictkey);
			tbl.append(colorDictDisplayRow(dictkey, schemeObj, {
				link: true,
				selected: dictkey === editor.selectedKey,
				userIndex,
				userCount: users.length
			}));
		}

		// Finally, the current, live, merged master list where lookups happen.
		var resultRow = colorDictDisplayRow("\u21D2\u00A0Result", gUserColorDict, { link: false });
		resultRow.attr('id', 'ssRowResult').css({"height": "3em"});
		tbl.append(resultRow);

		$('#divColorDictsDest').empty().append(tbl);

		// Keep the stored values in step with what is ticked: the recipe, a matching Look, or (when a Section
		// pointed at a sheet that is gone) the Section's own spelling, so the Matrix can flag it.
		const recipe = buildRecipe(song.colorDicts);
		song.activeStylesheets = recipe;
		// A Song that never chose a stylesheet keeps storing nothing (so Save does not start writing "Default" into
		// every Section); any user action (options.force) stores the recomputed value.
		if (options.force || song.currentColorDict || recipe !== 'Default') {
			song.currentColorDict = chooseColorDictValue({
				colorDicts: song.colorDicts,
				colorLooks: songLooks(),
				preferred: song.currentColorDict,
				keepMissing: true
			});
		}
		const lookName = hasOwn(songLooks(), song.currentColorDict) ? song.currentColorDict : '';
		$('.ActiveStylesheets').text('Active Stylesheets: ' + recipe + (lookName ? '  (Look: ' + lookName + ')' : ''));

		updateCurrentColorDictStrip(recipe, gUserColorDict);
		refreshLooksUi();
	}

	function roleCell(noteRole, note, caption = null) {
		const cellCaption = caption ?? note?.tiny ?? note?.caption ?? '';
		const colorClass = note?.colorClass || '';
		const borderClass = colorClass == "noteTransparent" ? " colorDictTransparent" : "";
		return $('<td>')
			.addClass('colorDictLinkTD')
			.attr('noteRole', noteRole)
			.attr('title', noteRole)
			.text(decodeEntities(cellCaption))
			.addClass(colorClass + borderClass);
	}

	function ssButton(id, cssClasses, glyph, title, disabled, onClick) {
		return $('<button type="button" tabindex="-1">')
			.attr({ id, title })
			.addClass(cssClasses)
			.text(glyph)
			.prop('disabled', !!disabled)
			.on('click', function (e) {
				e.preventDefault();
				e.stopPropagation();
				onClick();
			});
	}

	export function colorDictDisplayRow(dictkey, schemeObj, rowOptions = {}){
		const { link = false, selected = false, userIndex = -1, userCount = 0 } = rowOptions;
		const isUser = !schemeObj.readOnly && !schemeObj.computed;
		const slug = domId(dictkey);
		var row = $('<tr>');
		var linkTD = $('<td>');
		var nobr = $('<nobr>');

		if (link) {
			row.attr('id', 'ssRow-' + slug).addClass(isUser ? 'ssRowUser' : 'ssRowBuiltIn');
			if (selected) row.addClass('ssSelected');
			if (isUser) {
				nobr.append($('<input type="checkbox" class="ssSheetCheck">')
					.attr({ id: 'ssCheck-' + slug, 'data-dictkey': dictkey, title: 'Include this stylesheet' })
					.prop('checked', !!schemeObj.checked)
					.on('change', function () {
						const sheet = getSong().colorDicts[dictkey];
						if (!sheet) return;
						sheet.checked = this.checked;
						refreshAfterUserChange();
						displayOptionsChanged();
					}));
			} else if (schemeObj.computed) {
				nobr.append($('<span class="ssMark">').text(schemeObj.checked ? '\u21D2\u00A0' : '\u21CF\u00A0'));
			} else {
				nobr.append($('<span class="ssMark">').text(schemeObj.checked ? '\u2713\u00A0' : '\u00A0\u00A0'));
			}
			nobr.append($('<a href="#" class="choose-stylesheet">')
				.attr({
					id: 'ssLink-' + slug,
					'data-dictkey': dictkey,
					title: isUser ? 'Select: tick it and load it into the editor' : 'Select this built-in level (all built-ins up to here)'
				})
				.text(dictkey));
			linkTD.attr('id', 'ssLinkTD-' + slug).addClass('userColorResultLinks').append(nobr);
		} else {
			row.addClass('userColorResultRow');
			linkTD.addClass('userColorResultCaption').text(dictkey);
		}
		row.append(linkTD);

		roleKeys().forEach((notekeyTempl) => {
			var note = schemeObj.dict ? schemeObj.dict[notekeyTempl] : null;
			if (!note) {
				row.append($('<td>').html('&nbsp;').attr('from', notekeyTempl));
				return;
			}
			row.append(roleCell(notekeyTempl, note, note.colorClass ? undefined : ''));
		});

		if (link) {
			const buttonsTD = $('<td>').attr('id', 'ssButtonsTD-' + slug).addClass('ssButtonsTD');
			if (isUser) {
				const box = $('<div class="ssButtons">').attr('id', 'ssButtons-' + slug);
				box.append(ssButton('ssMoveUp-' + slug, 'ssMoveUp btnMoveTuningUp', GLYPH_UP, 'Move up (later sheets win)', userIndex <= 0,
					() => moveUserStylesheet(dictkey, -1)));
				box.append(ssButton('ssMoveDown-' + slug, 'ssMoveDown btnMoveTuningDown', GLYPH_DOWN, 'Move down (later sheets win)', userIndex >= userCount - 1,
					() => moveUserStylesheet(dictkey, 1)));
				box.append(ssButton('ssRemove-' + slug, 'ssRemove btnRemoveTuning', GLYPH_DELETE, 'Delete this stylesheet (it goes to the Graveyard)', false,
					() => deleteUserStylesheet(dictkey)));
				buttonsTD.append(box);
			}
			row.append(buttonsTD);
		} else {
			row.append($('<td>'));
		}
		return row;
	}

	export function updateCurrentColorDictStrip(dictLabel, colorScheme){
		var newRow = $('<tr>');
		newRow.append($('<td class="userColorResultCaption">').text(dictLabel));
		['noteTransparent', 'noteAutomatic'].forEach((noteRole) => {
			const note = gUserColorDict.dict[noteRole];
			if (note) newRow.append(roleCell(noteRole, note));
		});
		roleKeys().forEach((notekey) => {
			const note = colorScheme.dict[notekey];
			if (!note) {
				newRow.append($('<td>').html('&nbsp;'));
			} else {
				newRow.append(roleCell(notekey, note, note.colorClass ? undefined : ''));
			}
		});
		var tbl = $("<table class='tblColorDictOneRow'>");
		tbl.append(newRow);
		$('.colorDictSwatchStrip').empty().append(tbl);
	}

	//------------------------------ select, apply, order ------------------------

	/** Link click.  A built-in sets the built-in level only (user ticks are left alone); a user sheet is ticked.
	 *  Either way the editor is loaded from it. No reordering: order is changed only with the arrow buttons. */
	export function chuseStylesheet(dictkey){
		const song = getSong();
		if (!song || !hasOwn(song.colorDicts, dictkey)) return;
		if (isBuiltInName(dictkey)) {
			setBuiltInLevel(song.colorDicts, dictkey);
		} else {
			song.colorDicts[dictkey].checked = true;
		}
		editorSelect(editor, song.colorDicts, dictkey);
		setNameField(isBuiltInName(dictkey) ? freeName(dictkey + '-user', takenNames(song)) : dictkey);
		showStylesheetMessage('');
		renderAllEditorCells();
		refreshAfterUserChange();
		refreshStylesheetHint();
		displayOptionsChanged();
	}

	export function refreshStylesheets(){
		applyStylesheetsTo_gUserColorDict();
		buildUserColors();
		buildColorDicts();
		fullRepaint();
	}

	/** Applies a Section's stored value (a Look name, a recipe, or a legacy single sheet name) without touching the editor. */
	export function applyColorLook(value){
		const song = getSong();
		const v = String(value ?? '');
		if (!song || !song.colorDicts || !v) return { missing: [] };
		const result = applyRecipe(song.colorDicts, v, songLooks());
		song.currentColorDict = v;
		applyStylesheetsTo_gUserColorDict();
		buildUserColors();
		buildColorDicts();
		fullRepaint();
		return result;
	}

	export function moveUserStylesheet(dictkey, delta){
		const song = getSong();
		const moved = moveUserSheet(song.colorDicts, dictkey, delta);
		if (!moved) return;
		song.colorDicts = moved;
		refreshAfterUserChange();
		showStylesheetMessage('Moved "' + dictkey + '". Later sheets win where they color the same role.');
	}

	export function deleteUserStylesheet(dictkey){
		const song = getSong();
		if (!isUserSheet(song.colorDicts, dictkey)) return;
		const usage = findSheetUsage(song, dictkey);
		var obj = song.colorDicts[dictkey];
		var context = {"dictkey": dictkey, "which": "UserStylesheet"};
		song.graveyard.bury(GraveType.STYLESHEET, obj, context);

		delete song.colorDicts[dictkey];
		if (editor.selectedKey === dictkey) {
			editorSelect(editor, song.colorDicts, '');
			setNameField('');
			renderAllEditorCells();
		}
		refreshAfterUserChange();
		refreshStylesheetHint();
		displayOptionsChanged();
		const used = describeUsage(usage);
		showStylesheetMessage('Deleted "' + dictkey + '" (see the Graveyard).'
			+ (used ? ' Still referenced by: ' + used + '. Those show the sheet as missing until you re-create it with the same name.' : ''));
	}

	/** Rebuilds the live dict: start from the OEM defaults, then layer every ticked non-computed sheet in list order. */
	export function applyStylesheetsTo_gUserColorDict(){
		const live = gUserColorDict.dict;
		Object.keys(live).forEach((k) => { delete live[k]; });
		Object.assign(live, gUserColorDictOEM.dict);
		const song = getSong();
		if (!song || !song.colorDicts) return;
		for (const scheme of Object.values(song.colorDicts)) {
			if (scheme.checked && !scheme.computed && scheme.dict){
				for (const [noteKey, cell] of Object.entries(scheme.dict)) {
					if (hasOwn(gUserColorDictOEM.dict, noteKey) && cell && cell.colorClass) {
						live[noteKey] = cell;
					}
				}
			}
		}
	}

	export function calculateActiveStylesheets(){
		return buildRecipe(getSong().colorDicts);
	}

	//------------------------------ role buttons ---------------------------------

    export function buildUserColors() {
		const dest = $("#idRoleButtonsDest");
		const prior = $('input[name="rbColor"]:checked');
		const priorInside = prior.closest('#idRoleButtonsDest').length > 0;
		const priorValue = prior.val();
		const somethingElseChecked = prior.length > 0 && !priorInside;

        function buildOneRadio(Role, obj){
            var userColorClass = "note"+Role;
            var captionClass = (obj.captionClass) ? obj.captionClass : userColorClass;
            var radio = $('<input type="radio" name="rbColor">').attr('id', 'idR'+Role).val(userColorClass);
            var label = $('<label>').attr({ id: 'chooseRole'+Role, title: 'note'+Role });
            label.append(radio);
            label.append(document.createTextNode(decodeEntities(obj.caption)));
            label.addClass("userColorRB");
			label.addClass(lookupUserColorClassByClass(userColorClass));
			if (captionClass !== userColorClass) {
				label.addClass(lookupUserColorClassByClass(captionClass));
			}
            dest.append(label);
        }
        dest.empty();
		Object.entries(gUserColorDict.dict).forEach(([key, obj]) => {
			var role = key.substring("note".length);  // from noteChord" to "Chord"
			buildOneRadio(role, obj);
		});
		if (!somethingElseChecked) {
			const same = priorInside ? dest.find('input[type=radio]').filter(function () { return this.value === priorValue; }) : $();
			(same.length ? same : dest.find('input[type=radio]').first()).prop('checked', true);
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

//================== Editor: New, Save, Copy, Rename, From Section ===============

	function currentPlanInputs() {
		const song = getSong();
		return { colorDicts: song.colorDicts, colorLooks: songLooks() };
	}

	export function refreshStylesheetHint() {
		const song = getSong();
		if (!song || !song.colorDicts) return;
		const rawName = $('#txtColorSchemeName').val();
		const savePlan = planSave(editor, { rawName, ...currentPlanInputs() });
		const copyPlan = planCopy(editor, currentPlanInputs());
		const renamePlan = planRename(editor.selectedKey, rawName, currentPlanInputs());
		let text = describePlan(savePlan);
		if (renamePlan.ok) text += ' ' + describePlan(renamePlan);
		const counts = countChanges(editor);
		$('#divStylesheetHint')
			.text(text)
			.toggleClass('ssHintBlocked', !savePlan.ok)
			.attr('data-changed', counts.changed)
			.attr('data-removed', counts.removed);
		$('#divStylesheetNote').text(editor.note || '');
		$('#btnRecordUserColors').prop('disabled', !savePlan.ok);
		$('#btnCopyStylesheet').prop('disabled', !copyPlan.ok);
		$('#btnRenameStylesheet').prop('disabled', !renamePlan.ok);
	}

	function commitSheet(plan) {
		const song = getSong();
		const previous = hasOwn(song.colorDicts, plan.name) ? song.colorDicts[plan.name] : null;
		if (plan.action === 'update' && previous) {
			song.graveyard.bury(GraveType.STYLESHEET, previous, { dictkey: plan.name, which: 'UserStylesheet' });
		}
		song.colorDicts[plan.name] = buildSheetEntry(plan, gUserColorDictOEM.dict, true);
		editorSelect(editor, song.colorDicts, plan.name);
		setNameField(plan.name);
		renderAllEditorCells();
		refreshAfterUserChange();
		refreshStylesheetHint();
		displayOptionsChanged();
	}

	export function saveStylesheet() {
		const plan = planSave(editor, { rawName: $('#txtColorSchemeName').val(), ...currentPlanInputs() });
		if (!plan.ok) {
			showStylesheetMessage(describePlan(plan));
			return null;
		}
		commitSheet(plan);
		showStylesheetMessage((plan.action === 'update' ? 'Updated "' : 'Saved "') + plan.name + '".');
		return plan;
	}

	export function copyStylesheet() {
		const plan = planCopy(editor, currentPlanInputs());
		if (!plan.ok) {
			showStylesheetMessage(describePlan(plan));
			return null;
		}
		commitSheet(plan);
		showStylesheetMessage('Copied to "' + plan.name + '".');
		return plan;
	}

	export function renameStylesheet() {
		const song = getSong();
		const plan = planRename(editor.selectedKey, $('#txtColorSchemeName').val(), currentPlanInputs());
		if (!plan.ok) {
			showStylesheetMessage(describePlan(plan));
			return null;
		}
		const renamed = {};
		Object.keys(song.colorDicts).forEach((k) => { renamed[k === plan.from ? plan.name : k] = song.colorDicts[k]; });
		song.colorDicts = renamed;
		const count = repointReferences(song, plan.from, plan.name);
		const pending = editor.edits;
		editorSelect(editor, song.colorDicts, plan.name);
		editor.edits = pending;
		setNameField(plan.name);
		renderAllEditorCells();
		refreshAfterUserChange();
		refreshStylesheetHint();
		displayOptionsChanged();
		showStylesheetMessage('Renamed "' + plan.from + '" to "' + plan.name + '"; ' + count + ' stored reference' + (count === 1 ? '' : 's') + ' updated.');
		return plan;
	}

	/** New: a blank editor (nothing selected, empty name); stylesheets stay as they are. */
	export function newStylesheet() {
		editorSelect(editor, getSong().colorDicts, '');
		setNameField('');
		showStylesheetMessage('');
		renderAllEditorCells();
		refreshStylesheetHint();
		$('#txtColorSchemeName').trigger('focus');
		buildColorDicts();
	}

	/** From Section: samples the first visible instrument's named notes into the editor (pending edits; nothing is saved). */
	export function loadEditorFromSection() {
		const lookupContext = createLookupContext();
		const section = getCurrentSection();
		const song = getSong();
		var rootIndex = toInt(section.rootID, 0);
		const cells = {};
		let tunings = song.getVisibleTunings();
		if (tunings.length > 0) {
			var notes = section.getSectionNotes(tunings[0]).namedNotes;
			if (notes) {
				Object.keys(notes).forEach(noteName => {
					var noteFnNum = noteNameToNoteID(noteName);
					var rel = (12 + noteFnNum - rootIndex) % 12;
					var noteKey = "note" + (rel + 1); // Use 1-based for note1, note2, etc.
					var note = notes[noteName];
					if (note.colorClass && hasOwn(gUserColorDictOEM.dict, noteKey)) {
						var res = lookupUserColor(JSON.parse(JSON.stringify(note)), lookupContext);
						if (res.colorClass) cells[noteKey] = splitClass(res.colorClass);
					}
				});
			}
		}
		if (!Object.keys(cells).length) {
			showStylesheetMessage('No colored Named Notes were found on the first visible instrument.');
			return null;
		}
		editorLoadEdits(editor, cells);
		editor.note = doingAutomaticColor()
			? 'AutoColor is on, so these are the Function colors AutoColor resolved, not the colors you picked.'
			: '';
		showStylesheetMessage('Loaded ' + Object.keys(cells).length + ' roles from the first instrument. Review, then Save Stylesheet.');
		renderAllEditorCells();
		refreshStylesheetHint();
		return cells;
	}

//================== Looks =======================================================

	export function refreshLooksUi() {
		const song = getSong();
		const sel = $('#selColorLooks');
		if (!song || !sel.length) return;
		const looks = songLooks();
		sel.empty().append($('<option>').attr('value', '').text('(Looks)'));
		Object.keys(looks).forEach((name) => {
			sel.append($('<option>').attr('value', name).text(name + '  =  ' + looks[name]));
		});
		sel.val(hasOwn(looks, song.currentColorDict) ? song.currentColorDict : '');
		$('#btnRemoveColorLook').prop('disabled', !sel.val());
		refreshLookHint();
	}

	export function refreshLookHint() {
		const song = getSong();
		if (!song || !song.colorDicts) return;
		const plan = planSaveLook({ rawName: $('#txtColorLookName').val(), ...currentPlanInputs() });
		$('#divColorLookHint').text(describeLookPlan(plan)).toggleClass('ssHintBlocked', !plan.ok);
		$('#btnSaveColorLook').prop('disabled', !plan.ok);
	}

	export function saveColorLook() {
		const song = getSong();
		const plan = planSaveLook({ rawName: $('#txtColorLookName').val(), ...currentPlanInputs() });
		if (!plan.ok) {
			showStylesheetMessage(describeLookPlan(plan));
			return null;
		}
		song.colorLooks = song.colorLooks || {};
		song.colorLooks[plan.name] = plan.recipe;
		song.currentColorDict = plan.name;
		$('#txtColorLookName').val('');
		buildColorDicts();
		displayOptionsChanged();
		showStylesheetMessage('Look "' + plan.name + '" = ' + plan.recipe + '. Sections can now store the Look name.');
		return plan;
	}

	export function chooseColorLook(name) {
		if (!name) return;
		applyColorLook(name);
		displayOptionsChanged();
	}

	export function removeColorLook(name) {
		const song = getSong();
		if (!name || !hasOwn(song.colorLooks, name)) return;
		const usage = findLookUsage(song, name);
		delete song.colorLooks[name];
		if (!Object.keys(song.colorLooks).length) delete song.colorLooks;
		if (song.currentColorDict === name) song.currentColorDict = '';
		buildColorDicts();
		displayOptionsChanged();
		const used = describeUsage({ ...usage, looks: [] });
		showStylesheetMessage('Removed Look "' + name + '".' + (used ? ' Still stored by: ' + used + '; the Matrix shows them struck through.' : ''));
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

	function renderEditorCell(role) {
		const td = $('#colorDestRole' + role);
		if (!td.length) return;
		const cell = visibleCell(editor, 'note' + role);
		td.removeClass().addClass('ssCell ssCell-' + cell.status);
		if (cell.color) td.addClass(cell.color);
		if (cell.hatch) td.addClass(cell.hatch);
		const label = cell.status === 'removed' ? '\u00D7' : (cell.status === 'blank' ? '\u00A0' : joinClass(cell));
		td.text(label).attr('title', cell.status);
	}

	function renderAllEditorCells() {
		$('#UserColorsEditorDest td[id^="colorDestRole"]').each(function () {
			renderEditorCell(this.id.substring('colorDestRole'.length));
		});
	}

	export function buildUserColorsEditor() {
		var table = $('<table class="ssEditorTable">').attr('id', 'tblStylesheetEditor');
		roleKeys().forEach((key) => {
			const obj = gUserColorDict.dict[key];
			const role = key.substring("note".length);  // from noteChord" to "Chord"
			const slug = domId(role);
			const captionClass = obj.captionClass ? obj.captionClass : key;
			const lookedup = lookupUserColorClassByClass(captionClass);
			const target = '#colorDestRole' + slug;
			const row = $('<tr>').attr('id', 'ssEditRow-' + slug);
			row.append($('<td>').text(role));
			row.append($('<td>').addClass(captionClass).text(captionClass));
			row.append($('<td>').addClass(lookedup).text(lookedup));
			row.append($('<td>').attr('id', 'colorDestRole' + slug).text('\u00A0'));
			row.append($('<td>').append($('<span class="pickerButton choose-color-picker">').attr({ id: 'ssPickColor-' + slug, 'data-target': target }).text('color')));
			row.append($('<td>').append($('<span class="pickerButton choose-hatch-picker">').attr({ id: 'ssPickHatch-' + slug, 'data-target': target }).text('hatch')));
			row.append($('<td>').append($('<span class="pickerButton clear-role-picker">').attr({ id: 'ssClear-' + slug, 'data-role': slug, title: 'Remove this role from the stylesheet' }).text('clear')));
			table.append(row);
		});
		$("#UserColorsEditorDest").empty().append(table);
		$('#colorPicker').html(buildColorPicker());  //buildColorPicker returns rows, not TABLE.
		// #hatchPicker is built manually in palette.html
		renderAllEditorCells();
		refreshStylesheetHint();
	}

	export function clearRolePicker(role) {
		editorClearRole(editor, 'note' + role);
		renderEditorCell(role);
		refreshStylesheetHint();
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
		 part: 'color'
	 }
	 var optionsHatchPicker = {
		 pickerSelector: '#hatchPicker',
		 dest: HATCH_PICKER_DEST,
		 part: 'hatch'
	 }
	 export function colorPickerClicked(t){
		 genericPickerClicked(t, optionsColorPicker);
	 }
	 export function hatchPickerClicked(t){
		 genericPickerClicked(t, optionsHatchPicker);
	 }
	 /** A pick updates the editor state (never the DOM class list directly); "none" empties that part. */
	 export function genericPickerClicked(t, options){
		 var colorClass = $(t).attr("colorClass") || '';
		 var picker = $(options.pickerSelector);
		 var destId = String(picker.attr(options.dest) || '').replace(/^#colorDestRole/, '');
		 if (destId) {
			 editorSetPart(editor, 'note' + destId, options.part, colorClass);
			 renderEditorCell(destId);
			 refreshStylesheetHint();
		 }
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
		// Multi highlights (STYLENUM_MIDIPITCHESSINGLE) are governed by their own AutoColorHighlight
		// flag, independent of the general AutoColor flag -- users may want AutoColor for
		// Named/Single/Bend/Tiny/Fingering notes while still picking an explicit color for Multi
		// highlights (or vice-versa). Pitch highlights (STYLENUM_MIDIPITCHES) never participate in
		// AutoColor/AutoColorHighlight at all -- the note-table rendering path never calls this
		// with a Pitch note (see NoteTableController.js), so this only affects other consumers
		// (e.g. MIDI Launchpad color mapping), which keep using the general AutoColor flag.
		const useAutoColor = note.styleNum === Note.STYLENUM_MIDIPITCHESSINGLE ? context.autoColorHighlight : context.autoColor;
		if (useAutoColor){
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

	/** Returns a single space-separated string of every colorClass value currently registered
	 *  in the active colorDict (gUserColorDict.dict by default). Used to broadly strip any
	 *  previously-applied resolved highlight color from a cell/table without needing to track
	 *  exactly which one was applied -- the generalized replacement for the old single-slot
	 *  gLast_noteHighlight bookkeeping. See NoteTableController.js's Pitch/Multi highlight paths.
	 *  Reads lookupContext.colorDict directly (not via resolveLookupContext/createLookupContext)
	 *  so this never triggers the section-lookup default-parameter chain -- callers with no
	 *  section in scope (e.g. a bare table-clear with no active song) can call this safely. */
	export function getAllRegisteredColorClasses(lookupContext = {}){
		const colorDict = (lookupContext && lookupContext.colorDict) || gUserColorDict.dict;
		return Object.values(colorDict || {})
			.map((entry) => entry && entry.colorClass)
			.filter(Boolean)
			.join(' ');
	}

	let highlightColorProbeEl = null;
	function getHighlightColorProbeElement(){
		if (typeof document === 'undefined'){
			return null;
		}
		if (!highlightColorProbeEl || !highlightColorProbeEl.isConnected){
			highlightColorProbeEl = document.createElement('span');
			highlightColorProbeEl.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:1px; height:1px; visibility:hidden; pointer-events:none;';
			document.body.appendChild(highlightColorProbeEl);
		}
		return highlightColorProbeEl;
	}

	/** Resolves a colorClass (any registered swatch class -- a raw picker color like
	 *  "noteBrown2"/"noteHighlight3", or a dict-driven role like "noteHighlightH1") to the
	 *  actual color it paints, by probing a detached DOM element with that class and reading
	 *  its computed background-color. Used to drive the Pitch/Multi highlight "glow" box-shadow
	 *  (see infinite-neck.css's .noteHighlight/.noteHighlightSingle and their --resolved-highlight-color
	 *  var) so the glow ring always matches whatever the user picked in the palette -- regardless
	 *  of whether that swatch class happens to also define its own box-shadow (which would
	 *  otherwise only affect whichever single DOM level cascade order happens to favor, producing
	 *  inconsistent outer/inner ring colors). Returns null if no usable color could be resolved
	 *  (e.g. transparent swatches, or a non-browser/test environment), letting callers fall back
	 *  to the CSS var's own default (the system Theme color). */
	export function resolveHighlightGlowColor(colorClass){
		if (!colorClass || typeof getComputedStyle !== 'function'){
			return null;
		}
		const probe = getHighlightColorProbeElement();
		if (!probe){
			return null;
		}
		probe.className = colorClass;
		const backgroundColor = getComputedStyle(probe).backgroundColor;
		if (!backgroundColor || backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)'){
			return null;
		}
		return backgroundColor;
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
			// Keep function-key lookup section-relative. noteRoot is intentionally
			// limited to the explicit noteRoot note in the table that owns it.
			result.colorClass = userColor.colorClass;
			if (note.colorClass === 'noteRoot' && context.noteRootTablename && context.tablename && context.noteRootTablename === context.tablename) {
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
