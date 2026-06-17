export function check(id){
    activateUiControl(id, { forceChange: true });
}

export function checkAndTrigger(id){
    activateUiControl(id, { forceChange: true });
}

export function activateUiControl(id, options = {}) {
    const {
        forceChange = false
    } = options;
    const $el = $(id);
    if (!$el || $el.length === 0) {
        return false;
    }

    const el = $el[0];
    if (el && typeof el.click === 'function') {
        el.click();
        return true;
    }

    const inputType = `${el?.type || $el.attr?.('type') || ''}`.toLowerCase();
    const isCheckable = inputType === 'radio' || inputType === 'checkbox';
    if (isCheckable) {
        $el.prop('checked', true);
    }
    $el.trigger('click');
    if (forceChange && isCheckable) {
        $el.trigger('change');
    }
    return true;
}

export function isSpecialPaletteModeSelected() {
    const $checked = $('input[name="rbPaletteMode"]:checked').first();
    if (!$checked || $checked.length === 0) {
        return false;
    }
    const value = $checked.val();
    return value === 'clear' || value === 'keep' || value === 'dropper';
}

export function activatePaintModeIfSpecialSelected() {
    if (!isSpecialPaletteModeSelected()) {
        return false;
    }
    return activateUiControl('#idPaletteModePaint');
}
