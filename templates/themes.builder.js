import * as ThemeFunctions from '../themeFunctions.js';
import * as InfiniteNeck from '../infinite-neck.js';
import * as Constants from '../Constants.js';
import EventBus from '../event-bus.js';
import { escapeHtml } from '../InstrumentRoleBadges.js';

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
        ThemesBuilder.updateThemeTableDestSelect();
        ThemesBuilder.updateThemeSectionDestSelect();
        ThemesBuilder.renderThemeMatrix();
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
            ThemeFunctions.setLastAppliedTheme(globalTheme);
        } else {
            const currentSection = InfiniteNeck.getCurrentSection();
            const tableTheme = InfiniteNeck.getSong().getTableThemeInEffect(currentSection, tableID, globalTheme);
            ThemeFunctions.themeToControls(tableTheme);
            ThemeFunctions.setLastAppliedTheme(tableTheme);
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
        ThemeFunctions.setLastAppliedTheme(selectedTheme);
        ThemeFunctions.clearThemeDiffResults();
        InfiniteNeck.refreshShowAllNoteNames();
        InfiniteNeck.updateDisplayOptionsReadonlyValues();
        $(this).blur();  // Remove focus so keyboard doesn't change selection
    }

    /** Sprint 146 Iteration 2: (re)populates the "Copy Table Theme to Table:" destination picker
     *  with every Instrument/table in the model -- unlike #selThemeTable, there is no "default"
     *  option here, since Copy always writes into a specific table's per-Section storage (there
     *  is no per-Section slot for "the whole song"). Purely a destination choice -- changing
     *  this select never triggers any other action or changes the displayed Theme controls. */
    static updateThemeTableDestSelect(){
        const sel = $('#selThemeTableDest');
        if (sel.length === 0) {
            return;
        }
        const previousValue = sel.val();
        const prefix = Constants.TABLE_ID_PREFIX;
        const tableIDs = InfiniteNeck.getSong().getAllModelTableIDs().slice().sort();
        sel.empty();
        tableIDs.forEach((tableID) => {
            const displayText = tableID.startsWith(prefix) ? tableID.slice(prefix.length) : tableID;
            sel.append($('<option>', { value: tableID, text: displayText }));
        });
        if (previousValue && tableIDs.includes(previousValue)) {
            sel.val(previousValue);
        }
    }

    /** Sprint 146 Iteration 2: (re)populates the "Section:" destination picker (paired with
     *  #selThemeTableDest) with every Section (1-based display, value = 0-based sectionIndex).
     *  Purely a destination choice -- selecting an option here never navigates or changes
     *  displayed controls (143-it2-design.md point 3). Called from the 'SectionChanged' handler
     *  below (not just rebuildThemesDropdown()) so adding/removing/moving a Section -- which
     *  always publishes 'SectionChanged' -- keeps this list current even while the Theme page
     *  is open. */
    static updateThemeSectionDestSelect(){
        const sel = $('#selThemeSectionNumDest');
        if (sel.length === 0) {
            return;
        }
        const previousValue = sel.val();
        const sections = InfiniteNeck.getSong().sections || [];
        sel.empty();
        sections.forEach((section, sectionIndex) => {
            sel.append($('<option>', { value: sectionIndex, text: `${sectionIndex + 1}` }));
        });
        if (previousValue !== undefined && previousValue !== null && sections[previousValue]) {
            sel.val(previousValue);
        }
    }

    /** Sprint 146 Iteration 2 (143-it2-design.md points 1-2): rebuilds the Section x Instrument
     *  Theme matrix table body from the current model -- one row per Section, one column per
     *  Instrument/table (getAllModelTableIDs()), each cell showing that Table+Section's own
     *  saved theme.caption (blank if none). The CURRENT section's row gets
     *  .themeMatrixRow--current (143-it2-design.md point 3, mirrors chartBAR--currentSection). */
    static renderThemeMatrix(){
        const table = $('#tblThemeMatrix');
        if (table.length === 0) {
            return;
        }
        const song = InfiniteNeck.getSong();
        const prefix = Constants.TABLE_ID_PREFIX;
        const tableIDs = song.getAllModelTableIDs().slice().sort();
        const sections = song.sections || [];
        const currentSectionIndex = song.getSectionsCurrentIndex();

        let html = '<thead><tr><th>Section</th>';
        tableIDs.forEach((tableID) => {
            const displayText = tableID.startsWith(prefix) ? tableID.slice(prefix.length) : tableID;
            html += `<th>${escapeHtml(displayText)}</th>`;
        });
        html += '</tr></thead><tbody>';

        sections.forEach((section, sectionIndex) => {
            const rowClass = sectionIndex === currentSectionIndex ? ' class="themeMatrixRow--current"' : '';
            html += `<tr${rowClass}><td class="themeMatrixSectionCell" data-section-index="${sectionIndex}">${sectionIndex + 1}</td>`;
            tableIDs.forEach((tableID) => {
                const caption = section?.sectionNotesByTable?.[tableID]?.theme?.caption || '';
                html += `<td class="themeMatrixCell" data-section-index="${sectionIndex}" data-table-id="${escapeHtml(tableID)}">${escapeHtml(caption)}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';
        table.html(html);
    }

    /** Sprint 146 Iteration 2 (143-it2-design.md point 1): shows/hides the Theme matrix, mirroring
     *  #tutorialPromptSectionToggle's right/down arrow indicator pair. */
    static toggleThemeMatrix(){
        const wrap = $('#divThemeMatrixWrap');
        const opening = !wrap.is(':visible');
        wrap.toggle(opening);
        $('#spanThemeMatrixArrow').html(opening ? '&#x25BC;' : '&#x25B6;');
        if (opening) {
            ThemesBuilder.renderThemeMatrix();
        }
    }

    /** Sprint 146 Iteration 2 (143-it2-design.md point 3): a Theme matrix cell was clicked --
     *  navigate to that Section and select that table in #selThemeTable, which brings up the
     *  carry-forward Theme in effect for it (there may be no storage yet at this exact cell,
     *  which is fine -- that's the point of navigating there first before hitting Theme/Copy). */
    static themeMatrixCellClick(sectionIndex, tableID){
        InfiniteNeck.linkToSection(sectionIndex);
        ThemesBuilder.updateThemeTableSelect();
        $('#selThemeTable').val(tableID).trigger('change');
        ThemesBuilder.renderThemeMatrix();
    }

    /** Sprint 146 Iteration 2 (per user feedback): clicking the Section-number column (not an
     *  Instrument cell) just navigates to that Section and resets #selThemeTable back to
     *  "default" -- there's no specific table implied by clicking the bare Section number. */
    static themeMatrixSectionCellClick(sectionIndex){
        InfiniteNeck.linkToSection(sectionIndex);
        ThemesBuilder.updateThemeTableSelect();
        $('#selThemeTable').val('').trigger('change');
        ThemesBuilder.renderThemeMatrix();
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
                ThemesBuilder.renderThemeMatrix();
            }
        });
        $('#btnDeleteTableTheme').click(function() {
            const tableID = $('#selThemeTable').val();
            if (!tableID) {
                return;
            }
            InfiniteNeck.handleBtnDeleteTableTheme(tableID);
            ThemesBuilder.selThemeTableChange();  //controls now reflect whatever's in effect after Clear.
            ThemesBuilder.renderThemeMatrix();
        });
        $('#selThemeTable').on('change', ThemesBuilder.selThemeTableChange);
        $('#btnCopyThemeToSection').click(function() {
            const destTableID = $('#selThemeTableDest').val();
            const destSectionIndex = parseInt($('#selThemeSectionNumDest').val(), 10);
            if (!destTableID || Number.isNaN(destSectionIndex)) {
                return;
            }
            InfiniteNeck.handleBtnCopyThemeToSection(destTableID, destSectionIndex);
            ThemesBuilder.updateThemeTableButtons();
            ThemesBuilder.renderThemeMatrix();
        });
        $('#btnToggleThemeMatrix').click(function() {
            ThemesBuilder.toggleThemeMatrix();
        });
        $('#tblThemeMatrix').on('click', 'td.themeMatrixSectionCell', function() {
            const sectionIndex = parseInt($(this).data('section-index'), 10);
            if (Number.isNaN(sectionIndex)) {
                return;
            }
            ThemesBuilder.themeMatrixSectionCellClick(sectionIndex);
        });
        $('#tblThemeMatrix').on('click', 'td.themeMatrixCell', function() {
            const sectionIndex = parseInt($(this).data('section-index'), 10);
            const tableID = `${$(this).data('table-id')}`;
            if (Number.isNaN(sectionIndex) || !tableID) {
                return;
            }
            ThemesBuilder.themeMatrixCellClick(sectionIndex, tableID);
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

        EventBus.on('SectionChanged', function() {
            ThemesBuilder.updateThemeTableButtons();
            ThemesBuilder.updateThemeSectionDestSelect();
            ThemesBuilder.renderThemeMatrix();
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