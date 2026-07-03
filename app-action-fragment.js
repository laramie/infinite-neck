const NAME_PATTERN = '[A-Za-z_][A-Za-z0-9_-]*';
const PLUGIN_RAISE_VALUE_PATTERN = new RegExp(`^${NAME_PATTERN}\\.${NAME_PATTERN}$`);
const MACRO_VALUE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const EXPLICIT_ACTION_PATTERN = /^(raise|macro)=/;

function splitFragment(hash = '') {
    return `${hash || ''}`.trim().replace(/^#/, '').split(',').map((segment) => segment.trim()).filter(Boolean);
}

function parseSegment(segment, currentAction = '') {
    const equalsIndex = segment.indexOf('=');
    if (equalsIndex > 0) {
        const action = segment.slice(0, equalsIndex).trim();
        const value = segment.slice(equalsIndex + 1).trim();
        if (action === 'raise' || action === 'macro') {
            return { action, value };
        }
        return { action: '', value: '', error: `invalid action ${action}` };
    }
    if (!currentAction) {
        return { action: '', value: '', error: `missing action for ${segment}` };
    }
    return { action: currentAction, value: segment };
}

function validateItem(action, value) {
    if (action === 'raise') {
        return PLUGIN_RAISE_VALUE_PATTERN.test(value) ? '' : `invalid raise ${value}`;
    }
    if (action === 'macro') {
        return MACRO_VALUE_PATTERN.test(value) ? '' : `invalid macro ${value}`;
    }
    return `invalid action ${action}`;
}

export function parseAppActionFragment(hash = '') {
    const text = `${hash || ''}`.trim();
    if (!text.startsWith('#')) {
        return { items: [], errors: ['fragment must start with #'] };
    }

    const segments = splitFragment(text);
    const items = [];
    const errors = [];
    let currentAction = '';

    segments.forEach((segment) => {
        const parsed = parseSegment(segment, currentAction);
        if (parsed.error) {
            errors.push(parsed.error);
            return;
        }
        const error = validateItem(parsed.action, parsed.value);
        if (error) {
            errors.push(error);
            return;
        }
        currentAction = parsed.action;
        if (parsed.action === 'raise') {
            const dotIndex = parsed.value.indexOf('.');
            items.push({
                action: 'raise',
                value: parsed.value,
                pluginId: parsed.value.slice(0, dotIndex),
                userKey: parsed.value.slice(dotIndex + 1)
            });
            return;
        }
        items.push({
            action: 'macro',
            value: parsed.value,
            macroId: parsed.value
        });
    });

    return { items, errors };
}

export function isAllowedAppActionFragment(href = '') {
    const normalized = `${href || ''}`.trim();
    if (!normalized.startsWith('#')) {
        return false;
    }
    const firstSegment = normalized.replace(/^#/, '').split(',')[0]?.trim() || '';
    if (!EXPLICIT_ACTION_PATTERN.test(firstSegment)) {
        return false;
    }
    const parsed = parseAppActionFragment(normalized);
    return parsed.items.length > 0 && parsed.errors.length === 0;
}
