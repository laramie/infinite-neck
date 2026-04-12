import * as NoteTableController from '../NoteTableController.js';
import * as InfiniteNeck from '../infinite-neck.js';
import { getSong, getCurrentSection } from '../infinite-neck.js';

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
            InfiniteNeck.setSectionKeysSharps();
        });
        $("#btnFlats").click(function() {
            InfiniteNeck.setSectionKeysFlats();
        });

        $("#btnTransposeDown").click(function() {
                InfiniteNeck.transpose(-1);
        });
        $("#btnTransposeUp").click(function() {
                InfiniteNeck.transpose(1);
        });
        $("#btnTransposeJumpDown").click(function() {
                InfiniteNeck.transpose(-5);
        });
        $("#btnTransposeJumpUp").click(function() {
                InfiniteNeck.transpose(5);
        });

        // CODE-EXAMPLE("SelectWidget", "Root")
        $('#dropDownRoot').change(function() {
            InfiniteNeck.getCurrentSection().rootID = $(this).val();
            NoteTableController.fullRepaint();
            InfiniteNeck.updateSectionsStatus();
        });
        // END CODE-EXAMPLE("SelectWidget", "Root")
        $('#dropDownRootLead').change(function() {
            InfiniteNeck.getCurrentSection().rootIDLead = $('#dropDownRootLead').val();
            NoteTableController.fullRepaint();
            InfiniteNeck.updateSectionsStatus();
        });


        $("#btnInsertFirstBeat").click(function() {
            getSong().insertFirstBeat();
        });
        $("#btnInsertBeat").click(function() {
            getSong().insertBeat(getSong().getBeat());
        });
        $("#btnDeleteBeat").click(function() {
            getSong().deleteBeat();
        });
        $("#btnAddBeat").click(function() {
            InfiniteNeck.addBeat();
        });

        $("#txtCaption" ).on( "change", function() {
            var cap = $( this ).val();
            getCurrentSection().caption = cap;
            InfiniteNeck.updateSectionsStatus();
        });

        $("#btnNewSection").click(function() {
            var newIndex = $('#dropDownSectionOrder').val();//might include pseudo-value "END".
            getSong().newSection(newIndex);
        });
        $("#btnDeleteSection").click(function() {
            getSong().deleteCurrentSection();
        });
        $("#btnAddShallowCloneSection").click(function() {
            var newIndex = $('#dropDownSectionOrder').val();//might include pseudo-value "END".
            getSong().addShallowCloneSection(newIndex);
        });
        $("#btnAddDeepCloneSection").click(function() {
            var newIndex = $('#dropDownSectionOrder').val();//might include pseudo-value "END".
            getSong().addDeepCloneSection(newIndex);
        });
        $('#btnMoveSectionOrder').click(function(){
            var newIndex = $('#dropDownSectionOrder').val();
            if (newIndex == "END"){
                getSong().moveSectionToEND();
            } else {
                getSong().moveSectionTo(newIndex);
            }
            InfiniteNeck.updateSectionsStatus();
            NoteTableController.fullRepaint();
        });
        $("#btnControlsToDisplayOptions_Section").click(function() {
	        InfiniteNeck.handleBtnControlsToDisplayOptions();
	    });
		$("#btnDeleteDisplayOptions_Section").click(function() {
			InfiniteNeck.handleBtnDeleteDisplayOptions();
	    });

    }

    //============= API =============================

    static setDisplayOptionsPresent(enabled) {
        $('#btnDeleteDisplayOptions_Section').prop("disabled", !enabled);
    }
    static sectionChanged(){
        $("#lblBeats").html(getSong().getBeats());
	    $("#lblBeat").html("1");
        $("#txtCaption").val(getSong().getCurrentSection().caption);
        $('#dropDownSectionOrder').html(InfiniteNeck.buildDropDownSectionOrderOptions());
        $("#dropDownRoot").val(getCurrentSection().rootID);
        $("#dropDownRootLead").val(getCurrentSection().rootIDLead);
    }
    static rootIDChanged(){
        $("#dropDownRoot").val(getCurrentSection().rootID);
    }

}