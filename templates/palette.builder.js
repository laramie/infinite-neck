import * as NoteTableController from '../NoteTableController.js';
import * as ColorFunctions from '../colorFunctions.js';
import { 
	PalettePresentation 
} from '../presentation.js';
import * as PaletteUtils from '../paletteUtils.js'


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
                     .html("Customize Less ...")
                     .removeClass("BtnPunchedOut")
                     .addClass("BtnPunchedIn");
            } else {
                $("#showHideCustomColorEditors")
                     .html("Customize ...")
                     .removeClass("BtnPunchedIn")
                     .addClass("BtnPunchedOut");
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
				ColorFunctions.recordUserColors();
			});
		$("#btnRecordUserColorsFromSection")
			.off(`click${eventNamespace}`)
			.on(`click${eventNamespace}`, function() {
				ColorFunctions.recordUserColorsFromSection();
			});

        // Event delegation for stylesheet selection and deletion links
        $(document)
            .off(`click${eventNamespace}`, 'a.choose-stylesheet')
            .on(`click${eventNamespace}`, 'a.choose-stylesheet', function(e) {
            e.preventDefault();
            const dictkey = $(this).data('dictkey');
            ColorFunctions.chuseStylesheet(dictkey);
        });

        $(document)
            .off(`click${eventNamespace}`, 'a.delete-stylesheet')
            .on(`click${eventNamespace}`, 'a.delete-stylesheet', function(e) {
            e.preventDefault();
            const dictkey = $(this).data('dictkey');
            ColorFunctions.deleteUserStylesheet(dictkey);
        });

        $(document)
            .off(`click${eventNamespace}`, 'span.choose-color-picker')
            .on(`click${eventNamespace}`, 'span.choose-color-picker', function(e) {
            e.preventDefault();
            const target = $(this).data('target');
            ColorFunctions.showColorPicker(this, target);
        });

        $(document)
            .off(`click${eventNamespace}`, 'span.choose-hatch-picker')
            .on(`click${eventNamespace}`, 'span.choose-hatch-picker', function(e) {
            e.preventDefault();
            const target = $(this).data('target');
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