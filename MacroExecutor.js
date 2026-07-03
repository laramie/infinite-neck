const MACRO_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function cloneLines(lines) {
    return Array.isArray(lines) ? lines.map((line) => `${line}`) : [];
}

function normalizeMacroRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return { lines: [] };
    }
    return {
        ...record,
        lines: normalizeMacroLines(record.lines || [])
    };
}

export function validateMacroId(id) {
    const text = `${id || ''}`.trim();
    return MACRO_ID_PATTERN.test(text);
}

export function getMacroIdValidationMessage(id) {
    const text = `${id || ''}`.trim();
    if (!text) {
        return 'macro id is required';
    }
    if (!validateMacroId(text)) {
        return 'macro id must start with a letter and contain only letters, numbers, underscore, and hyphen';
    }
    return '';
}

export function normalizeMacroLines(textOrLines = []) {
    const sourceLines = Array.isArray(textOrLines)
        ? textOrLines
        : `${textOrLines || ''}`.split(/\r?\n/);
    return sourceLines
        .map((line) => `${line}`.trim())
        .filter((line) => line.length > 0);
}

export function parseMacroLine(line) {
    const trimmed = `${line || ''}`.trim();
    if (!trimmed) {
        return null;
    }
    const spaceIdx = trimmed.indexOf(' ');
    const path = spaceIdx < 0 ? trimmed : trimmed.substring(0, spaceIdx);
    if (!path.startsWith('/')) {
        throw new Error(`Macro command path must start with /: ${path}`);
    }
    if (path.length === 1) {
        throw new Error('Macro command path must include at least one trigger after /');
    }
    if (spaceIdx < 0) {
        return { path, hasValue: false, value: undefined };
    }
    const jsonText = trimmed.substring(spaceIdx + 1).trim();
    if (!jsonText) {
        throw new Error(`Macro command ${path} has an empty JSON value`);
    }
    try {
        return { path, hasValue: true, value: JSON.parse(jsonText) };
    } catch (error) {
        throw new Error(`Invalid JSON for ${path}: ${error.message}`);
    }
}

export function validateMacroLines(lines = []) {
    const normalized = normalizeMacroLines(lines);
    const errors = [];
    normalized.forEach((line, index) => {
        try {
            parseMacroLine(line);
        } catch (error) {
            errors.push({
                lineNumber: index + 1,
                line,
                message: error.message
            });
        }
    });
    return {
        valid: errors.length === 0,
        errors,
        lines: normalized
    };
}

export function normalizeSongMacros(song) {
    if (!song || typeof song !== 'object') {
        return {};
    }
    const source = song.macros && typeof song.macros === 'object' && !Array.isArray(song.macros)
        ? song.macros
        : {};
    const macros = {};
    Object.entries(source).forEach(([id, record]) => {
        const normalizedId = `${id || ''}`.trim();
        if (!validateMacroId(normalizedId)) {
            return;
        }
        macros[normalizedId] = normalizeMacroRecord(record);
    });
    song.macros = macros;
    return song.macros;
}

export function getSongMacros(song) {
    return normalizeSongMacros(song);
}

export function getSongMacroIds(song) {
    return Object.keys(getSongMacros(song));
}

export function getSongMacro(song, id) {
    const macroId = `${id || ''}`.trim();
    return getSongMacros(song)[macroId] || null;
}

export function upsertSongMacro(song, id, lines = []) {
    const macroId = `${id || ''}`.trim();
    const idError = getMacroIdValidationMessage(macroId);
    if (idError) {
        throw new Error(idError);
    }
    const validation = validateMacroLines(lines);
    if (!validation.valid) {
        const firstError = validation.errors[0];
        throw new Error(`line ${firstError.lineNumber}: ${firstError.message}`);
    }
    const macros = getSongMacros(song);
    macros[macroId] = {
        ...(macros[macroId] || {}),
        lines: cloneLines(validation.lines)
    };
    return macros[macroId];
}

export function deleteSongMacro(song, id) {
    const macroId = `${id || ''}`.trim();
    const macros = getSongMacros(song);
    if (!Object.prototype.hasOwnProperty.call(macros, macroId)) {
        return false;
    }
    delete macros[macroId];
    return true;
}

function formatPathNotFound(path, trigger, offset) {
    return `Command-line path not found at trigger ${trigger} (${offset + 1}) in ${path}`;
}

export function findMenuItemByMacroPath(rootMenu, path, options = {}) {
    const parsed = parseMacroLine(path);
    const triggerPath = parsed.path.substring(1);
    const refreshRuntimeChildren = options.refreshRuntimeChildren || function () {};
    let currentMenu = rootMenu;
    refreshRuntimeChildren(currentMenu);
    for (let index = 0; index < triggerPath.length; index += 1) {
        const trigger = triggerPath[index];
        const children = currentMenu?.children || [];
        const child = children.find((candidate) => candidate && candidate.trigger === trigger);
        if (!child) {
            throw new Error(formatPathNotFound(parsed.path, trigger, index));
        }
        refreshRuntimeChildren(child);
        currentMenu = child;
    }
    return currentMenu;
}

export function executeMacroLine(line, options = {}) {
    const parsed = parseMacroLine(line);
    if (!parsed) {
        return { ok: true, skipped: true, line };
    }
    const rootMenu = options.rootMenu;
    if (!rootMenu) {
        throw new Error('Macro executor requires rootMenu');
    }
    const actionRunner = options.actionRunner;
    if (typeof actionRunner !== 'function') {
        throw new Error('Macro executor requires actionRunner');
    }
    if (typeof options.refreshBeforePath === 'function') {
        options.refreshBeforePath(parsed.path);
    }
    const menuItem = findMenuItemByMacroPath(rootMenu, parsed.path, {
        refreshRuntimeChildren: options.refreshRuntimeChildren
    });
    if (!menuItem?.action) {
        throw new Error(`Macro path ended at a menu with no action: ${parsed.path}`);
    }
    const args = {};
    if (menuItem.input) {
        if (!parsed.hasValue) {
            throw new Error(`Macro command requires JSON input value: ${parsed.path}`);
        }
        args[menuItem.input.id] = parsed.value;
    } else if (parsed.hasValue) {
        if (menuItem.action !== 'pluginProperty:toggle') {
            throw new Error(`Macro command does not accept a JSON value: ${parsed.path}`);
        }
        args.value = parsed.value;
    }
    const actionResult = actionRunner(menuItem, args, {
        path: parsed.path,
        hasValue: parsed.hasValue,
        value: parsed.value,
        line
    }) || {};
    return {
        ok: true,
        path: parsed.path,
        action: menuItem.action,
        result: actionResult.result || '',
        actionResult
    };
}

export function executeMacroLines(lines = [], options = {}) {
    const normalized = normalizeMacroLines(lines);
    const results = [];
    for (let index = 0; index < normalized.length; index += 1) {
        const line = normalized[index];
        try {
            const result = executeMacroLine(line, options);
            results.push({ ...result, lineNumber: index + 1, line });
            if (options.verbose && typeof options.log === 'function') {
                options.log(`${index + 1}: ${line}${result.result ? ` => ${result.result}` : ' => ok'}`);
            }
        } catch (error) {
            const failure = {
                ok: false,
                lineNumber: index + 1,
                line,
                error: error.message
            };
            results.push(failure);
            if (typeof options.log === 'function') {
                options.log(`${index + 1}: ${line} => ERROR: ${error.message}`);
            }
            return {
                ok: false,
                results,
                error: error.message,
                failedLineNumber: index + 1
            };
        }
    }
    return { ok: true, results };
}

export function executeSongMacro(song, id, options = {}) {
    const macroId = `${id || ''}`.trim();
    const macro = getSongMacro(song, macroId);
    if (!macro) {
        throw new Error(`Macro not found: ${macroId}`);
    }
    return executeMacroLines(macro.lines, options);
}
