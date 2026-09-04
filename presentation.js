import EventBus from './event-bus.js';

export const gPresentation = {
    palette: {
        mode: 'paint',
        lastRestorableColor: null,
        lastRestorableHighlight: null,
        suppressRbColorRemember: false,
        keepWasForced: false,
        lockKeep: false
    }
};

const PALETTE_MODE_IDS = {
    paint: 'idPaletteModePaint',
    clear: 'idPaletteModeClear',
    keep: 'idPaletteModeKeep',
    dropper: 'idPaletteModeDropper'
};

const RESTORABLE_HIGHLIGHT_IDS = new Set([
    'idNamedNotes',
    'idSingleNotes',
    'idTinyNotes',
    'rbBend',
    'idMidiPitches',
    'idMidiPitchesSingle'
]);

// Mirrors the #selBend <option> captions in templates/palette.html -- read here
// instead of scraping the <option> text so PalettePresentation.getHighlightStatusMarkup()
// can compose the "Bend: <small>...</small>" status span from #selBend's plain value.
const BEND_TYPE_CAPTIONS = {
    semitone1: '1 semitone',
    semitone2: '2 semitones',
    semitone3: '3 semitones',
    prebend1: 'prebend 1',
    prebend2: 'prebend 2',
    prebend3: 'prebend 3',
    updown1: 'up-down 1',
    updown2: 'up-down 2',
    updown3: 'up-down 3'
};

export class PalettePresentation {
    static lockKeep(){
        gPresentation.palette.keepLocked = true;
        gPresentation.palette.mode = 'keep';
    }
    static unlockKeep(){
        gPresentation.palette.keepLocked = false;
        gPresentation.palette.mode = 'paint';
        PalettePresentation.enterPaintMode({
			restoreHighlightIfNeeded: true,
			forcedKeep: false
		});
    }

    static getMode() {
        if (gPresentation.palette.keepLocked){
            return 'keep';
        }
        if (!gPresentation.palette.mode) {
            PalettePresentation.initializePalettePresentation();
        }
        return gPresentation.palette.mode || 'paint';
    }

    static findPaletteModeRadio(mode = PalettePresentation.getMode()) {
        const id = PALETTE_MODE_IDS[mode];
        return id ? $('#' + id) : $();
    }

    static setMode(mode, options = {}) {
        const {
            forcedKeep = false,
            syncUi = true
        } = options;
        gPresentation.palette.mode = PALETTE_MODE_IDS[mode] ? mode : 'paint';
        gPresentation.palette.keepWasForced = forcedKeep;
        if (syncUi) {
            PalettePresentation.updatePaletteModeUi();
        }
        return gPresentation.palette.mode;
    }

    static enterPaintMode(options = {}) {
        const {
            restoreHighlightIfNeeded = true,
            forcedKeep = false
        } = options;
        PalettePresentation.setMode('paint', {
            forcedKeep,
            syncUi: true
        });
        if (restoreHighlightIfNeeded) {
            PalettePresentation.restoreLastRbHighlightIfNeeded();
        }
        return true;
    }

    static enterClearMode() {
        PalettePresentation.clearRestorableRbHighlightsForClear();
        PalettePresentation.setMode('clear', {
            forcedKeep: false,
            syncUi: true
        });
        return true;
    }

    static enterKeepMode(options = {}) {
        const {
            forcedKeep = false
        } = options;
        PalettePresentation.setMode('keep', {
            forcedKeep,
            syncUi: true
        });
        return true;
    }

    static enterDropperMode() {
        PalettePresentation.setMode('dropper', {
            forcedKeep: false,
            syncUi: true
        });
        PalettePresentation.restoreLastRbHighlightIfNeeded();
        return true;
    }

    static getLastRestorableRbColor() {
        if (!gPresentation.palette.lastRestorableColor) {
            PalettePresentation.initializePalettePresentation();
        }

        const remembered = gPresentation.palette.lastRestorableColor || {
            id: 'idRTransparent',
            value: 'noteTransparent',
            caption: 'Emboss'
        };

        return { ...remembered };
    }

    static getLastRestorableRbHighlight() {
        if (!gPresentation.palette.lastRestorableHighlight) {
            PalettePresentation.initializePalettePresentation();
        }

        const remembered = gPresentation.palette.lastRestorableHighlight || {
            id: 'idNamedNotes',
            value: 'Named',
            caption: 'Named'
        };

        return { ...remembered };
    }

    static getRbColorCaption($radio) {
        if (!$radio || $radio.length === 0) {
            return "";
        }
        const $label = $radio.closest("label");
        const labelText = $.trim($label.text());
        const labelTitle = $.trim($label.attr("title"));
        const radioTitle = $.trim($radio.attr("title"));
        return labelText || labelTitle || radioTitle || $radio.val() || $radio.attr("id") || "";
    }

    static getRbHighlightCaption($radio) {
        if (!$radio || $radio.length === 0) {
            return "";
        }
        const $label = $radio.closest("label");
        const labelText = $.trim($label.text());
        return labelText || $radio.attr("id") || $radio.val() || "";
    }

    static isRestorableHighlightRadio($radio) {
        if (!$radio || $radio.length === 0) {
            return false;
        }
        return RESTORABLE_HIGHLIGHT_IDS.has($radio.attr("id"));
    }

    static updateRestoreRbColorButton() {
        const $label = $("#choosePaletteModePaint");
        const $caption = $("#spanPaletteModePaintCaption");
        if ($label.length === 0 || $caption.length === 0) {
            return;
        }

        const remembered = gPresentation.palette.lastRestorableColor;
        const caption = remembered && remembered.caption ? remembered.caption : "Emboss";
        const isAligned = PalettePresentation.isRestoreButtonAligned();
        const postfix = isAligned ? "  \u2713 " : "";

        $label.toggleClass("chooseLastColorAligned", isAligned);
        $caption.text("Color: " + caption + postfix);
        PalettePresentation.refreshPaletteStatusSpans();
    }

    // Read-only status spans (see TableBuilder.js's buildCaptionRow(), which rides
    // these along with currentColorDict): span 1 mirrors whichever restorable
    // highlight radio (idNamedNotes/idSingleNotes/idTinyNotes/rbBend/
    // idMidiPitches/idMidiPitchesSingle) is active; span 2 mirrors whichever
    // palette-mode button (CLEAR/KEEP/Find Color/Color:...) is active, taking on
    // the resolved swatch color when in paint mode.
    static getHighlightStatusText() {
        const $checked = $('input[name="rbHighlight"]:checked').first();
        if (PalettePresentation.isRestorableHighlightRadio($checked)) {
            return PalettePresentation.getRbHighlightCaption($checked);
        }
        return PalettePresentation.getLastRestorableRbHighlight().caption;
    }

    static getActiveHighlightId() {
        const $checked = $('input[name="rbHighlight"]:checked').first();
        if (PalettePresentation.isRestorableHighlightRadio($checked)) {
            return $checked.attr('id');
        }
        return PalettePresentation.getLastRestorableRbHighlight().id;
    }

    static getBendSelectionCaption() {
        const value = $('#selBend').val();
        return BEND_TYPE_CAPTIONS[value] || value || '';
    }

    // HTML markup for the .paletteHighlightStatus span: plain caption, except for
    // Bend, which always has a selected #selBend value (no empty slot in that
    // dropdown) appended as a smaller sub-caption.
    static getHighlightStatusMarkup() {
        const caption = PalettePresentation.getHighlightStatusText();
        if (PalettePresentation.getActiveHighlightId() === 'rbBend') {
            return caption + ': <small>' + PalettePresentation.getBendSelectionCaption() + '</small>' /*+' \u2713'*/ ;
        }
        return caption /*+' \u2713'*/ ;
    }

    static getPaletteModeStatusText() {
        const $label = PalettePresentation.findPaletteModeRadio().closest('label');
        return $label.length > 0 ? $.trim($label.text()) : '';
    }

    static getResolvedRbColorStyle() {
        const FALLBACK = { backgroundColor: '#ffffff', color: '#000000' };
        const $label = PalettePresentation.findRestorableRbColor().closest('label');
        if ($label.length === 0 || typeof getComputedStyle !== 'function') {
            return FALLBACK;
        }
        const computed = getComputedStyle($label[0]);
        return {
            backgroundColor: computed.backgroundColor || FALLBACK.backgroundColor,
            color: computed.color || FALLBACK.color
        };
    }

    static getPaletteModeStatusStyle() {
        if (PalettePresentation.getMode() !== 'paint') {
            return { backgroundColor: '#ffffff', color: '#000000' };
        }
        return PalettePresentation.getResolvedRbColorStyle();
    }

    static refreshPaletteStatusSpans() {
        $('.paletteHighlightStatus').html(PalettePresentation.getHighlightStatusMarkup()+' <span style="color: #1e82f3;">\u2713</span>' );

        const modeStyle = PalettePresentation.getPaletteModeStatusStyle();
        let extraCheckmark = ' <span style="color: lightgreen;">\u2713</span>' ;//hack, because checkmark is created for #spanPaletteModePaintCaption, but we need the checkmark always so the buttons will have the right heights, because the checkmark is a Unicode char with extra height: once you use it you have to use it everywhere to get things to line up with the other spans.
        let statusText = PalettePresentation.getPaletteModeStatusText();
        if (!statusText.includes('\u2713')){
            statusText = statusText + extraCheckmark;
        }
        $('.paletteModeStatus')
            //.text(PalettePresentation.getPaletteModeStatusText())
            .html(statusText)
            .css({
                backgroundColor: modeStyle.backgroundColor,
                color: modeStyle.color
            });
    }

    static setExtraColorsVisible(isVisible) {
        const visible = !!isVisible;
        const $extraColors = $("#extraColors");
        const $button = $("#showHideExtraColors");

        if ($extraColors.length > 0) {
            $extraColors.toggle(visible);
        }

        if ($button.length > 0) {
            if (visible) {
                $button
                    .html("Less...")
                    .removeClass("BtnPunchedOut")
                    .addClass("BtnPunchedIn");
            } else {
                $button
                    .html("More...")
                    .removeClass("BtnPunchedIn")
                    .addClass("BtnPunchedOut");
            }
        }
    }

    static setAutomaticColorUi(isAutomaticColor) {
        const automatic = !!isAutomaticColor;
        $("#cbAutomaticColor").prop("checked", automatic);
        $("#manualColors").toggle(!automatic);
        $("#btnAutoColor,#btnAutoColor2")
            .toggleClass("BtnPunchedIn", automatic)
            .toggleClass("BtnPunchedOut", !automatic);
    }

    static ensureColorRadioVisible($radio) {
        if (!$radio || $radio.length === 0) {
            return false;
        }

        PalettePresentation.setAutomaticColorUi(false);

        if ($radio.closest("#extraColors").length > 0) {
            PalettePresentation.setExtraColorsVisible(true);
        }

        return true;
    }

    static rememberRestorableRbColor(radioEl) {
        if (!radioEl) {
            return;
        }
        const $radio = $(radioEl);
        const value = $radio.val();

        gPresentation.palette.lastRestorableColor = {
            id: $radio.attr("id"),
            value,
            caption: PalettePresentation.getRbColorCaption($radio)
        };

        PalettePresentation.updateRestoreRbColorButton();
    }

    static rememberRestorableRbHighlight(radioEl) {
        if (!radioEl) {
            return false;
        }

        const $radio = $(radioEl);
        if (!PalettePresentation.isRestorableHighlightRadio($radio)) {
            return false;
        }

        gPresentation.palette.lastRestorableHighlight = {
            id: $radio.attr("id"),
            value: $radio.val(),
            caption: PalettePresentation.getRbHighlightCaption($radio)
        };

        return true;
    }

    static rememberCurrentRestorableRbHighlight() {
        const $checked = $('input[name="rbHighlight"]:checked').first();
        return PalettePresentation.rememberRestorableRbHighlight($checked);
    }

    static clearRestorableRbHighlightsForClear() {
        PalettePresentation.rememberCurrentRestorableRbHighlight();
        $("#idNamedNotes, #idSingleNotes, #idTinyNotes, #rbBend, #idMidiPitches, #idMidiPitchesSingle")
            .prop("checked", false);
    }

    static hasRestorableHighlightSelected() {
        return $("#idNamedNotes, #idSingleNotes, #idTinyNotes, #rbBend, #idMidiPitches, #idMidiPitchesSingle")
            .filter(':checked')
            .length > 0;
    }

    static findRestorableRbColor() {
        const remembered = gPresentation.palette.lastRestorableColor;
        if (!remembered) {
            return $();
        }

        let $radio = $("#" + remembered.id);
        if ($radio.length === 0 && remembered.value) {
            $radio = $('input[name="rbColor"][value="' + remembered.value + '"]');
        }
        return $radio.first();
    }

    static findRestorableRbHighlight() {
        const remembered = gPresentation.palette.lastRestorableHighlight;
        if (!remembered) {
            return $();
        }

        let $radio = $("#" + remembered.id);
        if ($radio.length === 0 && remembered.value) {
            $radio = $('input[name="rbHighlight"][value="' + remembered.value + '"]');
        }
        return $radio.first();
    }

    static selectRbColorByElement($radio, options = {}) {
        const {
            remember = true,
            forcedKeep = false
        } = options;

        if (!$radio || $radio.length === 0) {
            return false;
        }

        gPresentation.palette.keepWasForced = forcedKeep;

        const prevSuppress = gPresentation.palette.suppressRbColorRemember;
        gPresentation.palette.suppressRbColorRemember = !remember;

        $radio.prop("checked", true).trigger("change");

        if (remember) {
            PalettePresentation.rememberRestorableRbColor($radio[0]);
        }

        gPresentation.palette.suppressRbColorRemember = prevSuppress;
        return true;
    }

    static selectRbColorById(id, options = {}) {
        return PalettePresentation.selectRbColorByElement($(id), options);
    }

    static restoreLastRbColor() {
        const $radio = PalettePresentation.findRestorableRbColor();
        const colorRestored = $radio.length === 0 ? false : PalettePresentation.selectRbColorByElement($radio, {
            remember: false,
            forcedKeep: false
        });
        const highlightRestored = PalettePresentation.enterPaintMode({
            restoreHighlightIfNeeded: true,
            forcedKeep: false
        });
        return colorRestored || highlightRestored;
    }

    static restoreLastRbHighlightIfNeeded() {
        if (PalettePresentation.hasRestorableHighlightSelected()) {
            return false;
        }

        const $radio = PalettePresentation.findRestorableRbHighlight();
        if ($radio.length === 0) {
            return false;
        }

        $radio.prop("checked", true);
        return true;
    }

    static updatePaletteModeUi() {
        Object.entries(PALETTE_MODE_IDS).forEach(([mode, id]) => {
            $('#' + id).prop('checked', PalettePresentation.getMode() === mode);
        });
        PalettePresentation.updateRestoreRbColorButton();
        // Sprint 143 (midi-note-in): single choke point for EVERY mode change
        // that goes through setMode() (enterPaintMode/enterClearMode/
        // enterKeepMode/enterDropperMode) -- unlike the rbPaletteMode radio's
        // own native 'change' event (which only fires for a direct click/
        // activateUiControl() on that radio), this fires for the "special
        // handling going back and forth between paint mode and clear" too,
        // e.g. picking a color or highlight while in Clear mode calls
        // enterPaintMode() directly (see infinite-neck.js's rbColor/
        // rbHighlight 'change' handlers), which reaches here without ever
        // firing a 'change' event on input[name="rbPaletteMode"]. Consumed by
        // templates/midi/midi.builder.js to keep the Launchpad's physical
        // Clear-mode indicator light in sync regardless of which code path
        // changed the mode. NOT fired by PalettePresentation.lockKeep(), which
        // bypasses setMode()/updatePaletteModeUi() entirely (a pre-existing
        // quirk, not introduced here).
        EventBus.trigger('Palette:modeChanged', { mode: PalettePresentation.getMode() });
    }

    static initializePalettePresentation() {
        if (!gPresentation.palette.mode) {
            const $checkedMode = $('input[name="rbPaletteMode"]:checked').first();
            gPresentation.palette.mode = $checkedMode.length > 0 ? ($checkedMode.val() || 'paint') : 'paint';
        }

        if (!gPresentation.palette.lastRestorableColor) {
            const $checked = $('input[name="rbColor"]:checked').first();
            if ($checked.length > 0) {
                PalettePresentation.rememberRestorableRbColor($checked[0]);
            }
        }

        if (!gPresentation.palette.lastRestorableHighlight) {
            PalettePresentation.rememberCurrentRestorableRbHighlight();
        }

        if (!gPresentation.palette.lastRestorableColor) {
            gPresentation.palette.lastRestorableColor = {
                id: "idRTransparent",
                value: "noteTransparent",
                caption: "Emboss"
            };
        }

        if (!gPresentation.palette.lastRestorableHighlight) {
            gPresentation.palette.lastRestorableHighlight = {
                id: 'idNamedNotes',
                value: 'Named',
                caption: 'Named'
            };
        }

        PalettePresentation.updatePaletteModeUi();
    }

    static isRestoreButtonAligned() {
        return PalettePresentation.getMode() === 'paint';
    }
}