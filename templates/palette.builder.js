import * as NoteTableController from '../NoteTableController.js';
import * as ColorFunctions from '../colorFunctions.js';

export class PaletteBuilder {
    // #divPalette is our dest in index.html, 
    // #palette is the top div in the template.
    static div_palette = null; //Singleton.   
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
        function checkRB(id){
            $(id).prop("checked", true);
        }
        
        $('#selBend').click(function() {
            $("#rbBend").prop("checked", true);
        });

        $("#rbFinger0").click(function(){
            checkRB("#idRFinger0");
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
            NoteTableController.fullRepaint(); //TODO: this should be through EventBus.
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

        $("#btnRecordUserColors").click(function() {
			ColorFunctions.recordUserColors();
		});
		$("#btnRecordUserColorsFromSection").click(function() {
			ColorFunctions.recordUserColorsFromSection();
		});

        // Event delegation for stylesheet selection and deletion links
        $(document).on('click', 'a.choose-stylesheet', function(e) {
            e.preventDefault();
            const dictkey = $(this).data('dictkey');
            ColorFunctions.chuseStylesheet(dictkey);
        });

        $(document).on('click', 'a.delete-stylesheet', function(e) {
            e.preventDefault();
            const dictkey = $(this).data('dictkey');
            ColorFunctions.deleteUserStylesheet(dictkey);
        });

        $(document).on('click', 'span.choose-color-picker', function(e) {
            e.preventDefault();
            const target = $(this).data('target');
            ColorFunctions.showColorPicker(this, target);
        });

        $(document).on('click', 'span.choose-hatch-picker', function(e) {
            e.preventDefault();
            const target = $(this).data('target');
            ColorFunctions.showHatchPicker(this, target);
        });

        $(document).on('click', 'td.colorPickerCell', function(e) {
            e.preventDefault();
            ColorFunctions.colorPickerClicked(this);
        });

        $(document).on('click', 'td.hatchPickerCell', function(e) {
            e.preventDefault();
            ColorFunctions.hatchPickerClicked(this);
        });


    }


}