export const gPresentation = {
    palette: {
        mode: 'paint',
        lastRestorableColor: null,
        lastRestorableHighlight: null,
        suppressRbColorRemember: false,
        keepWasForced: false
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

export class PalettePresentation {
    static getMode() {
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