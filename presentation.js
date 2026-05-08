export const gPresentation = {
    palette: {
        lastRestorableColor: null,
        suppressRbColorRemember: false,
        keepWasForced: false
    }
};

export class PalettePresentation {
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

    static updateRestoreRbColorButton() {
        const $btn = $("#btnRestoreRbColor");
        if ($btn.length === 0) {
            return;
        }
    
        const remembered = gPresentation.palette.lastRestorableColor;
        const caption = remembered && remembered.caption ? remembered.caption : "Emboss";
        const prefix = PalettePresentation.isRestoreButtonAligned() ? "\u2713 " : "";
    
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
        if ($radio.length === 0) {
            return false;
        }
        return PalettePresentation.selectRbColorByElement($radio, {
            remember: false,
            forcedKeep: false
        });
    }

    static initializePalettePresentation() {
        if (!gPresentation.palette.lastRestorableColor) {
            const $checked = $('input[name="rbColor"]:checked').first();
            if ($checked.length > 0 && !PalettePresentation.isSpecialRbColorValue($checked.val())) {
                PalettePresentation.rememberRestorableRbColor($checked[0]);
            }
        }

        if (!gPresentation.palette.lastRestorableColor) {
            gPresentation.palette.lastRestorableColor = {
                id: "idRTransparent",
                value: "noteTransparent",
                caption: "Emboss"
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