import * as NoteTableController from '../NoteTableController.js';

export class SectionDrawerBuilder {
    static span_sectionDrawer = null; //Singleton.

    static addToDest(divDestSelector) {
        if (!SectionDrawerBuilder.span_sectionDrawer){
            const template = document.getElementById('section-drawer-template');
            const clone = template.content.cloneNode(true);
            SectionDrawerBuilder.span_sectionDrawer = clone.querySelector('#sectionDrawer');
            $(divDestSelector).empty().append(SectionDrawerBuilder.span_sectionDrawer);
            SectionDrawerBuilder.bindEvents();
        }
        return SectionDrawerBuilder.span_sectionDrawer;
    }

    static bindEvents(){
        $("#btnSharps").click(function() {
            setSectionKeysSharps();
        });
        $("#btnFlats").click(function() {
            setSectionKeysFlats();
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

        // CODE-EXAMPLE("SelectWidget", "Root")
        $('#dropDownRoot').change(function() {
            getCurrentSection().rootID = $(this).val();
            fullRepaint();
            updateSectionsStatus();
        });
        // END CODE-EXAMPLE("SelectWidget", "Root")
        $('#dropDownRootLead').change(function() {
            getCurrentSection().rootIDLead = $('#dropDownRootLead').val();
            fullRepaint();
            updateSectionsStatus();
        });
    }

}