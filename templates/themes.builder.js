import * as ThemeFunctions from '../themeFunctions.js';
import * as InfiniteNeck from '../infinite-neck.js';
import * as Constants from '../Constants.js';

export class ThemesBuilder {
    static divThemes = null; //Singleton
    static addToDest(divDestSelector) {
        if (!ThemesBuilder.divThemes){
            const template = document.getElementById('themes-template');
            const clone = template.content.cloneNode(true);
            ThemesBuilder.divThemes = clone.querySelector('#divThemes');
            $(divDestSelector).empty().append(ThemesBuilder.divThemes);
            ThemesBuilder.bindEvents();
            $('#warny').hide();
            $('#themeTableResults').hide();
        }
        return ThemesBuilder.divThemes;
    }

    /** After calling this, choose a theme either by default or by looking in song you just opened for USER theme. */
    static rebuildThemesDropdown(){
        $('#selThemes').off('change');
        $('#SelectThemesDest').html(ThemeFunctions.getWidget_SelectThemes());  //must come before bindThemeEvents()
        ThemeFunctions.auditThemes();//sends WARN messages, so hide after.
        $('#warny').hide();
        $('#themeTableResults').hide();
        $('#selThemes').on('change', ThemesBuilder.selThemesChange);
        ThemesBuilder.updateThemeTableSelect();
    }

    /** Sprint 146 (table-themes): (re)populates the "Save/Clear Theme for:" picker with every
     *  Instrument/table in the model (mirrors WiringBuilder.updateAllWiringSelects()'s use of
     *  getAllModelTableIDs()), keeping the leading "default" (whole song) option selected if
     *  nothing else was chosen yet. Call whenever the Theme page is shown, since Instruments can
     *  be added/removed while it's hidden. */
    static updateThemeTableSelect(){
        const sel = $('#selThemeTable');
        if (sel.length === 0) {
            return;
        }
        const previousValue = sel.val();
        const prefix = Constants.TABLE_ID_PREFIX;
        const tableIDs = InfiniteNeck.getSong().getAllModelTableIDs().slice().sort();
        sel.empty();
        sel.append($('<option>', { value: '', text: 'default (whole song)' }));
        tableIDs.forEach((tableID) => {
            const displayText = tableID.startsWith(prefix) ? tableID.slice(prefix.length) : tableID;
            sel.append($('<option>', { value: tableID, text: displayText }));
        });
        if (previousValue && tableIDs.includes(previousValue)) {
            sel.val(previousValue);
        }
        ThemesBuilder.updateThemeTableButtons();
    }

    /** Sprint 146: enables/disables "Clear Table Theme" based on whether the CURRENT Section
     *  (not the walk-back-resolved value) has its own saved Theme for the picked table --
     *  mirrors infinite-neck.js's showHideDisplayOptionsPresent(). */
    static updateThemeTableButtons(){
        const tableID = $('#selThemeTable').val();
        if (!tableID) {
            $('#btnDeleteTableTheme').prop('disabled', true);
            return;
        }
        const sectionNotes = InfiniteNeck.getCurrentSection().sectionNotesByTable?.[tableID];
        $('#btnDeleteTableTheme').prop('disabled', !sectionNotes?.theme);
    }

    /** Sprint 146: when a table is picked, reflect that table's Theme-in-effect (walking back
     *  through earlier Sections, falling back to the live global Theme) into the Theme controls,
     *  same shape as selThemesChange() above. Picking "default" restores the live global Theme. */
    static selThemeTableChange(){
        const tableID = $('#selThemeTable').val();
        const globalTheme = ThemeFunctions.getThemes()[$('#selThemes').val()] || ThemeFunctions.getDefaultTheme();
        ThemeFunctions.themeToControls(ThemeFunctions.getDefaultTheme());  //reset all dropdowns first, not every theme has every value.
        if (!tableID) {
            ThemeFunctions.themeToControls(globalTheme);
        } else {
            const currentSection = InfiniteNeck.getCurrentSection();
            const tableTheme = InfiniteNeck.getSong().getTableThemeInEffect(currentSection, tableID, globalTheme);
            ThemeFunctions.themeToControls(tableTheme);
        }
        ThemesBuilder.updateThemeTableButtons();
    }

    static selThemesChange(){
        var id = this.id;
        var val =  this.value;
        var selectedTheme = ThemeFunctions.getThemes()[val];
        ThemeFunctions.theme(selectedTheme);
        ThemeFunctions.themeToControls(ThemeFunctions.getDefaultTheme());  //Not all themes have all values, so reset all the dropdowns with theme "Default" first.
        ThemeFunctions.themeToControls(selectedTheme);
        ThemeFunctions.clearThemeDiffResults();
        InfiniteNeck.refreshShowAllNoteNames();
        InfiniteNeck.updateDisplayOptionsReadonlyValues();
        $(this).blur();  // Remove focus so keyboard doesn't change selection
    }
    
    static bindEvents(){
        //======= themes  =======
        $('#btnTheme').click(function() {
            const tableID = $('#selThemeTable').val();
            if (!tableID) {
                var newTheme = ThemeFunctions.controlsToTheme();
                InfiniteNeck.getSong().userTheme = newTheme;
                ThemeFunctions.installUserTheme(newTheme);
                $('#selThemes').val('USER').trigger('change');
            } else {
                InfiniteNeck.handleBtnControlsToTableTheme(tableID);
                ThemesBuilder.updateThemeTableButtons();
            }
        });
        $('#btnDeleteTableTheme').click(function() {
            const tableID = $('#selThemeTable').val();
            if (!tableID) {
                return;
            }
            InfiniteNeck.handleBtnDeleteTableTheme(tableID);
            ThemesBuilder.selThemeTableChange();  //controls now reflect whatever's in effect after Clear.
        });
        $('#selThemeTable').on('change', ThemesBuilder.selThemeTableChange);
        $('#btnToggleThemeTableResults').click(function() {
            $('#themeTableResults').toggle();
        });
        $('#selThemes').change(ThemesBuilder.selThemesChange);
        $('#warny').click(function(){
            $(this).hide();
        });
        $('#btnShowWarny').click(function(){
            $('#warny').css("zIndex", 80000);
            $('#warny').show();
        });

        const eventNamespace = '.bindThemesEvents';
        function namespaceEvents(events){
			return events
				.split(' ')
				.map((eventName) => `${eventName}${eventNamespace}`)
				.join(' ');
		}
		function bindEvent(events, selector, handler){
			const namespacedEvents = namespaceEvents(events);
			$(selector)
				.off(namespacedEvents)
				.on(namespacedEvents, handler);
		}
        bindEvent('change', '#dropDownInstrumentMargins', function() {
			//short-circuit and set it now, it is in mem for next time.
			var margin = this.value;
			$('.instrumentBackground').css({"margin-top": margin, "margin-bottom": +margin });
		});

    }

}