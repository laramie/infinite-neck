import * as NoteTableController from '../../NoteTableController.js';
import * as ColorFunctions from '../../colorFunctions.js';
import { 
	PalettePresentation 
} from '../../presentation.js';
import * as PaletteUtils from '../../paletteUtils.js'


export class PaletteBuilder {
    // #divPalette is our dest in index.html, 
    // #palette is the top div in the template.
    static div_palette = null; //Singleton.   
    static eventNamespace = '.paletteBuilder';
    static selectFingerColorRole(suffix) {
        return PalettePresentation.selectRbColorByElement($(`#idRFinger${suffix}`));
    }

    static addToDest(divDestSelector) {
        if (!PaletteBuilder.div_palette){
            const template = document.getElementById('palette-template');
            const clone = template.content.cloneNode(true);
            PaletteBuilder.div_palette = clone.querySelector('#palette');
            $(divDestSelector).empty().append(PaletteBuilder.div_palette);
            PaletteBuilder.bindEvents();
        }
        return PaletteBuilder.div_palette;
    }

    static bindEvents(){
        const eventNamespace = PaletteBuilder.eventNamespace;
        
        $('#selBend')
            .off(`click${eventNamespace}`)
            .on(`click${eventNamespace}`, function() {
                $("#rbBend").prop("checked", true).trigger('change');
            });

        $('#rbFinger0, #rbFinger1, #rbFinger2, #rbFinger3, #rbFinger4, #rbFingerT')
            .off(`click${eventNamespace}`)
            .on(`click${eventNamespace}`, function() {
                const suffix = this.id.replace('rbFinger', '');
                PaletteBuilder.selectFingerColorRole(suffix);
            });

        $("#cbAutomaticColor")
            .off(`change${eventNamespace}`)
            .on(`change${eventNamespace}`, function() {
            PalettePresentation.setAutomaticColorUi(this.checked);
            NoteTableController.fullRepaint(); //TODO: this should be through EventBus.
        });

        $("#cbAutomaticColorHighlight")
            .off(`change${eventNamespace}`)
            .on(`change${eventNamespace}`, function() {
            PalettePresentation.setAutomaticColorHighlightUi(this.checked);
            NoteTableController.fullRepaint(); //TODO: this should be through EventBus.
        });


        $("#showHideExtraColors")
            .off(`click${eventNamespace}`)
            .on(`click${eventNamespace}`, function(event) {
            PalettePresentation.setExtraColorsVisible(!$("#extraColors").is(":visible"));
            event.stopPropagation();
        });

        $("#showHideCustomColorEditors")
            .off(`click${eventNamespace}`)
            .on(`click${eventNamespace}`, function(event) {
            $("#CustomColorEditors").toggle();
            if ($("#CustomColorEditors").is(":visible")){
                $("#showHideCustomColorEditors")
                     .html('Customize &#x25BC;');
            } else {
                $("#showHideCustomColorEditors")
                     .html('Customize &#x25B6;');
            }
            event.stopPropagation();
        });

        $("#showHideCustomColorLinks")
            .off(`click${eventNamespace}`)
            .on(`click${eventNamespace}`, function(event) {
            $('#divColorDicts').toggle();
            if ($("#divColorDicts").is(":visible")){
                $("#showHideCustomColorLinks")
                    .removeClass("BtnPunchedOut")
                    .addClass("BtnPunchedIn");
            } else {
                $("#showHideCustomColorLinks")
                    .removeClass("BtnPunchedIn")
                    .addClass("BtnPunchedOut");
            }
            event.stopPropagation();
        });

        $("#btnRecordUserColors")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				ColorFunctions.saveStylesheet();
			});
		$("#btnRecordUserColorsFromSection")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				ColorFunctions.loadEditorFromSection();
			});
		$("#btnNewStylesheet")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				ColorFunctions.newStylesheet();
			});
		$("#btnCopyStylesheet")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				ColorFunctions.copyStylesheet();
			});
		$("#btnRenameStylesheet")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				ColorFunctions.renameStylesheet();
			});
		$("#txtColorSchemeName")
			.off(`input${eventNamespace}`)
			.on(`input${eventNamespace}`, function() {
				ColorFunctions.refreshStylesheetHint();
			});

		// Looks (named recipes)
		$("#selColorLooks")
			.off(`change${eventNamespace}`)
			.on(`change${eventNamespace}`, function() {
				ColorFunctions.chooseColorLook($(this).val());
			});
		$("#txtColorLookName")
			.off(`input${eventNamespace}`)
			.on(`input${eventNamespace}`, function() {
				ColorFunctions.refreshLookHint();
			});
		$("#btnSaveColorLook")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				ColorFunctions.saveColorLook();
			});
		$("#btnRemoveColorLook")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				ColorFunctions.removeColorLook($('#selColorLooks').val());
			});

		$("#btnLegend_Stylesheets")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function(event) {
				const legend = $('#divStylesheetLegend');
				const opening = !legend.is(':visible');
				legend.toggle(opening);
				$('#spanStylesheetLegendArrow').html(opening ? '&#x25BC;' : '&#x25B6;');
				event.stopPropagation();
			});

        // Event delegation for stylesheet selection (rows are rebuilt, so use attr() so numeric-looking names stay strings)
        $(document)
            .off(`click${eventNamespace}`, 'a.choose-stylesheet')
            .on(`click${eventNamespace}`, 'a.choose-stylesheet', function(e) {
            e.preventDefault();
            ColorFunctions.chuseStylesheet($(this).attr('data-dictkey'));
        });

        $(document)
            .off(`click${eventNamespace}`, 'span.clear-role-picker')
            .on(`click${eventNamespace}`, 'span.clear-role-picker', function(e) {
            e.preventDefault();
            ColorFunctions.clearRolePicker($(this).attr('data-role'));
        });

        $(document)
            .off(`click${eventNamespace}`, 'span.choose-color-picker')
            .on(`click${eventNamespace}`, 'span.choose-color-picker', function(e) {
            e.preventDefault();
            const target = $(this).attr('data-target');
            ColorFunctions.showColorPicker(this, target);
        });

        $(document)
            .off(`click${eventNamespace}`, 'span.choose-hatch-picker')
            .on(`click${eventNamespace}`, 'span.choose-hatch-picker', function(e) {
            e.preventDefault();
            const target = $(this).attr('data-target');
            ColorFunctions.showHatchPicker(this, target);
        });

        $(document)
            .off(`click${eventNamespace}`, 'td.colorPickerCell')
            .on(`click${eventNamespace}`, 'td.colorPickerCell', function(e) {
            e.preventDefault();
            ColorFunctions.colorPickerClicked(this);
        });

        $(document)
            .off(`click${eventNamespace}`, 'td.hatchPickerCell')
            .on(`click${eventNamespace}`, 'td.hatchPickerCell', function(e) {
            e.preventDefault();
            ColorFunctions.hatchPickerClicked(this);
        });

        $(document)
            .off(`click${eventNamespace}`, 'td.colorDictLinkTD[noteRole]')
            .on(`click${eventNamespace}`, 'td.colorDictLinkTD[noteRole]', function(e) {
            e.preventDefault();
            e.stopPropagation();
            PaletteUtils.checkAndTriggerNoteRole($(this).attr('noteRole'));
        });


    }


}