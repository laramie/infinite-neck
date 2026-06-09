import * as ThemeFunctions from '../themeFunctions.js';
import * as InfiniteNeck from '../infinite-neck.js';

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
        $(this).blur();  // Remove focus so keyboard doesn't change selection
    }
    
    static bindEvents(){
        //======= themes  =======
        $('#btnTheme').click(function() {
            var newTheme = ThemeFunctions.controlsToTheme();
            InfiniteNeck.getSong().userTheme = newTheme;
            ThemeFunctions.installUserTheme(newTheme);
            $('#selThemes').val('USER').trigger('change');
        });
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