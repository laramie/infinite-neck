/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */
import { PRINT_SCREEN_FLAG_DEFAULTS, normalizePrintOptions } from './printlayout.js';

/** Sprint 154: the `print` screen = the usual flags + `grid` and `chart` (the PrintLayout panel's options).
 *  The Main is validated later, by the panel (it needs the Song), so a persisted mainTableID is kept as is. */
function buildPrintScreen(persisted) {
    const normalized = normalizePrintOptions(persisted, [persisted?.grid?.mainTableID || '']);
    return { ...PRINT_SCREEN_FLAG_DEFAULTS, ...(persisted || {}), name: 'print', grid: normalized.grid, chart: normalized.chart };
}

const DEFAULT_PRINT_SCREEN_JSON = JSON.stringify(buildPrintScreen(null));

export class Layout {
    constructor(jsonObj){
        this.screenList = {};
        this.screenList.fullscreen = {
            name: "fullscreen",
            CaptionRow: true,
            Caption: true,
            SongTitle: true,
            SongWidgets: true,
            PracticeList: false,
            WidgetRow: true,
            InstrumentCaptions: true,
            LeftRails: true,
            CaptionLooperLayout: 'column'
        };
        
        this.screenList.escaped = {
            name: "escaped",
            CaptionRow: true,
            Caption: true,
            SongTitle: true,
            SongWidgets: true,
            PracticeList: false,
            WidgetRow: true,
            InstrumentCaptions: true,
            LeftRails: true,
            CaptionLooperLayout: 'column'
        };
        this.screen = this.screenList.escaped;
        if (jsonObj){
            Object.assign(this, jsonObj);
        }
        // Sprint 154: `print` is a third screen.  Songs saved before it have none; a Song is never reopened IN print
        // (its tiles are transient), so a persisted `screen` named print falls back to escaped.
        this.screenList.print = buildPrintScreen(this.screenList.print);
        if (this.screen && this.screen.name === 'print') {
            this.screen = this.screenList.escaped;
        }
        /** Runtime only (never saved, see toJSON): true while PrintLayoutController has print entered. */
        this.printActive = false;
        // Object.assign above leaves `screen` as a separate copy of its screenList entry.  Re-link them so that a
        // toggle made on the current screen is the one remembered when leaving and entering fullscreen.  The persisted
        // `screen` is the latest state, so it wins over the stale screenList entry.
        const linkedScreen = this.screen && this.screenList ? this.screenList[this.screen.name] : null;
        if (linkedScreen && linkedScreen !== this.screen) {
            Object.assign(linkedScreen, this.screen);
            this.screen = linkedScreen;
        }
        // Older song files have no SongWidgets or PracticeList flag in their persisted screens: SongWidgets defaults to shown, PracticeList to hidden.
        [...Object.values(this.screenList || {}), this.screen].forEach((screen) => {
            if (screen && screen.SongWidgets === undefined) {
                screen.SongWidgets = true;
            }
            if (screen && screen.PracticeList === undefined) {
                screen.PracticeList = false;
            }
        });
    }

    toggleCaptionRow(visible){
        this.screen.CaptionRow = $('#topControlsCaptions').toggle(visible).css('display') !== 'none';
    }
    
    toggleCaption(visible){
        this.screen.Caption = $('.lblSectionCaption').toggle(visible).css('display') !== 'none';
    }

    toggleSongTitle(visible){
        this.screen.SongTitle = $('.lblSongName').toggle(visible).css('display') !== 'none'; 
    }
    
    toggleWidgetRow(visible){
        this.screen.WidgetRow = $('.SongTitleLeadSheet').toggle(visible).css('display') !== 'none'; 
    }

    /** Persists the User's choice (not the element's display, which is also hidden whenever the
     *  Song Widgets are empty), then applies it.  Called with no argument, flips the current choice. */
    toggleSongWidgets(visible){
        this.screen.SongWidgets = typeof visible === 'boolean' ? visible : this.screen.SongWidgets === false;
        this.applySongWidgetsVisibility();
    }

    /** #lblSongWidgets shows only when it has content AND the current screen's SongWidgets flag is on. */
    applySongWidgetsVisibility(){
        const jSongWidgets = $('#lblSongWidgets');
        const hasContent = (jSongWidgets.html() || '').trim().length > 0;
        const songWidgetWillShow = hasContent && this.screen.SongWidgets !== false;
        jSongWidgets.toggle(songWidgetWillShow);
        const jSongWidgetsBR = $('#lblSongWidgetsBR');
        jSongWidgetsBR.toggle(!songWidgetWillShow);
    }

    /** Sprint 152: the wizard-mode Practice List.  Persists the User's choice per screen, then applies it.
     *  Called with no argument, flips the current choice. */
    togglePracticeList(visible){
        this.screen.PracticeList = typeof visible === 'boolean' ? visible : this.screen.PracticeList !== true;
        this.applyPracticeListVisibility();
    }

    /** #divPracticeList shows only when it has content (it is filled only in wizard mode) AND the current screen's flag is on. */
    applyPracticeListVisibility(){
        const jPracticeList = $('#divPracticeList');
        const hasContent = (jPracticeList.html() || '').trim().length > 0;
        jPracticeList.toggle(hasContent && this.screen.PracticeList === true);
    }

    toggleInstrumentCaptions(visible){
        this.screen.InstrumentCaptions = Layout.isInlineShown($('.captionRow').toggle(visible));
    }

    toggleLeftRails(visible){
        this.screen.LeftRails = Layout.isInlineShown($('.leftRailStack').toggle(visible));
        if (this.screen.LeftRails){
            $(".LeftRailLayoutButtons button").removeClass("grayed-out-button").prop("disabled", false);
        } else {
            $(".LeftRailLayoutButtons button").addClass("grayed-out-button").prop("disabled", true);
        }
    }

    /** @direction is 'row' or 'column' which behave as setters, or undefined, which behaves as a toggle. */
    toggleCaptionLooperLayout(direction){
        let newDirection = 'column';
        let $lrs = $('.leftRailStack');
        if (direction){
            $lrs.css('flex-direction', direction);
            newDirection = direction;
        } else {
            let fd = $lrs.css('flex-direction');
            if (fd == 'column'){
                $lrs.css('flex-direction','row');
                newDirection =  'row';
            } else {
                $lrs.css('flex-direction','column');
                newDirection =  'column';
            }
        }
        this.setCaptionLooperLayout(newDirection);
        return newDirection;
    }

    setCaptionLooperLayout(direction){
        this.screen.CaptionLooperLayout = direction;
    }
    
    enterFullscreen(){
        this.screen = this.printActive ? this.screenList.print : this.screenList.fullscreen;
        this.doToggles();
    }

    leaveFullscreen(){
        this.screen = this.printActive ? this.screenList.print : this.screenList.escaped;
        this.doToggles();
    }

    /** Sprint 154.  Print is a Layout screen of its own that survives entering and leaving fullscreen. */
    isPrint(){
        return this.printActive === true;
    }

    enterPrint(){
        this.printActive = true;
        this.screen = this.screenList.print;
        this.doToggles();
    }

    leavePrint(){
        this.printActive = false;
        this.screen = this.screenList.escaped;
        this.doToggles();
    }

    /** Sprint 154.  Reads the INLINE display the toggle just set, not the computed one: while an Instrument chart
     *  widget is on, CSS (`display: none !important`, instrument-chart.css) hides .captionRow / .leftRailStack, and
     *  the computed value would record "hidden" into the Layout, which is saved with the Song.
     *  No element = true, as before. */
    static isInlineShown($elements){
        return $elements.length === 0 ? true : $elements.get(0).style.display !== 'none';
    }

    /** Not saved: the runtime flag, and print itself as the current screen (a Song never reopens in print).
     *  The `print` screen is left out while it is still the defaults, so most Song files do not change. */
    toJSON(){
        const { printActive, ...saved } = this;
        if (saved.screen && saved.screen.name === 'print') {
            saved.screen = saved.screenList.escaped;
        }
        if (saved.screenList && JSON.stringify(saved.screenList.print) === DEFAULT_PRINT_SCREEN_JSON) {
            const { print, ...others } = saved.screenList;
            saved.screenList = others;
        }
        return saved;
    }

    doToggles(){  
        console.log("Layout:\n"+JSON.stringify(this.screen, null, 4));  
        this.toggleCaptionRow(this.screen.CaptionRow);
        this.toggleCaption(this.screen.Caption);
        this.toggleSongTitle(this.screen.SongTitle);
        this.toggleSongWidgets(this.screen.SongWidgets);
        this.togglePracticeList(this.screen.PracticeList === true);
        this.toggleWidgetRow(this.screen.WidgetRow);
        this.toggleInstrumentCaptions(this.screen.InstrumentCaptions);
        this.toggleLeftRails(this.screen.LeftRails);
        this.toggleCaptionLooperLayout(this.screen.CaptionLooperLayout);
    }

} 
