export const gPresentation = {
    palette: {
        lastRestorableColor: null,
        lastRestorableHighlight: null,
        suppressRbColorRemember: false,
        keepWasForced: false
    }
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

    static isSpecialRbColorValue(value) {
        return value === "noteKeep" || value === "noteClear" || value === "noteDropper";
    }

    static getRbColorCaption($radio) {
        if (!$radio || $radio.length === 0) {
            return "";
        }
        const $label = $radio.closest("label");
        const labelText = $.trim($label.text());
        return labelText || $radio.attr("id") || $radio.val() || "";
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
        const $btn = $("#btnRestoreRbColor");
        if ($btn.length === 0) {
            return;
        }
    
        const remembered = gPresentation.palette.lastRestorableColor;
        const caption = remembered && remembered.caption ? remembered.caption : "Emboss";
        const isAligned = PalettePresentation.isRestoreButtonAligned();
        const prefix = isAligned ? "\u2713 " : "";
    
        $btn.toggleClass("chooseLastColorAligned", isAligned);
        $btn.text(prefix + "Color: " + caption);
    }

    static rememberRestorableRbColor(radioEl) {
        if (!radioEl) {
            return;
        }
        const $radio = $(radioEl);
        const value = $radio.val();

        if (PalettePresentation.isSpecialRbColorValue(value)) {
            return;
        }

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
        const highlightRestored = PalettePresentation.restoreLastRbHighlightIfNeeded();
        return colorRestored || highlightRestored;
    }

    static restoreLastRbHighlightIfNeeded() {
        const $checked = $('input[name="rbHighlight"]:checked').first();
        if ($checked.length > 0) {
            return false;
        }

        const $radio = PalettePresentation.findRestorableRbHighlight();
        if ($radio.length === 0) {
            return false;
        }

        $radio.prop("checked", true);
        return true;
    }

    static initializePalettePresentation() {
        if (!gPresentation.palette.lastRestorableColor) {
            const $checked = $('input[name="rbColor"]:checked').first();
            if ($checked.length > 0 && !PalettePresentation.isSpecialRbColorValue($checked.val())) {
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

        PalettePresentation.updateRestoreRbColorButton();
    }

    static isRestoreButtonAligned() {
        const remembered = gPresentation.palette.lastRestorableColor;
        if (!remembered) {
            return false;
        }
    
        const $checked = $('input[name="rbColor"]:checked').first();
        if ($checked.length === 0) {
            return false;
        }
    
        if (PalettePresentation.isSpecialRbColorValue($checked.val())) {
            return false;
        }
    
        const checkedId = $checked.attr("id");
        const checkedValue = $checked.val();
    
        return checkedId === remembered.id || checkedValue === remembered.value;
    }
}