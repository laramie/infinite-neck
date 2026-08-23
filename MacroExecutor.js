/* There are separate files for macros:
 *   - MacroExecutor.js   :: This file.  Executes a macro, builds the command-line menu.
 *   - MacroEngine.js     :: Groups functions for running macros, especially the calling of macros from macros,
 *                           and the laying on of an overlay and preventing User actions during macro execution.
 *   - templates/macros/* :: The macro editor menu page.
 * 
 *  key-handler.js imports these modules and runs them.
 * 
 */

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
    return sourceLines.map((line) => `${line == null ? '' : line}`);
}

export function classifyMacroLine(line) {
    const text = `${line == null ? '' : line}`;
    if (text.trim().length === 0) {
        return 'blank';
    }
    if (/^\s*#/.test(text)) {
        return 'comment';
    }
    return 'command';
}

export function parseMacroLine(line, options = {}) {
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
        if (options.allowTemplateJson === true && jsonText.includes('${')) {
            return { path, hasValue: true, value: undefined, jsonTemplate: jsonText };
        }
        throw new Error(`Invalid JSON for ${path}: ${error.message}`);
    }
}

export function validateMacroLines(lines = []) {
    const normalized = normalizeMacroLines(lines);
    const errors = [];
    normalized.forEach((line, index) => {
        if (classifyMacroLine(line) !== 'command') {
            return;
        }
        try {
            parseMacroLine(line, { allowTemplateJson: true });
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

export function moveSongMacro(song, id, destinationNumber) {
    const macroId = `${id || ''}`.trim();
    const macros = getSongMacros(song);
    if (!Object.prototype.hasOwnProperty.call(macros, macroId)) {
        return { moved: false, reason: `macro not found: ${macroId}` };
    }
    const entries = Object.entries(macros);
    if (entries.length <= 1) {
        return { moved: true, macroId, from: 1, to: 1, ids: entries.map(([entryId]) => entryId) };
    }
    const fromIndex = entries.findIndex(([entryId]) => entryId === macroId);
    const rawDestination = Number.parseInt(destinationNumber, 10);
    const destination = Number.isInteger(rawDestination) ? rawDestination : entries.length;
    const clampedDestination = Math.max(1, Math.min(entries.length, destination));
    const [movingEntry] = entries.splice(fromIndex, 1);
    entries.splice(clampedDestination - 1, 0, movingEntry);

    Object.keys(macros).forEach((entryId) => delete macros[entryId]);
    entries.forEach(([entryId, record]) => {
        macros[entryId] = record;
    });

    return {
        moved: true,
        macroId,
        from: fromIndex + 1,
        to: clampedDestination,
        ids: entries.map(([entryId]) => entryId)
    };
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

function formatMacroExpansionValue(value, name) {
    if (value === undefined) {
        throw new Error(`Unknown expansion name: ${name}`);
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return `${value}`;
    }
    try {
        const serialized = JSON.stringify(value);
        if (serialized === undefined) {
            throw new Error(`cannot stringify expansion value for ${name}`);
        }
        return serialized;
    } catch (error) {
        throw new Error(`cannot stringify expansion value for ${name}: ${error.message}`);
    }
}

export function expandMacroLine(line, resolveName) {
    const source = `${line == null ? '' : line}`;
    if (typeof resolveName !== 'function') {
        return source;
    }

    let result = '';
    let index = 0;
    while (index < source.length) {
        if (source.startsWith('\\${', index)) {
            const close = source.indexOf('}', index + 3);
            if (close < 0) {
                result += source.substring(index + 1);
                break;
            }
            result += source.substring(index + 1, close + 1);
            index = close + 1;
            continue;
        }

        if (source.startsWith('${', index)) {
            const close = source.indexOf('}', index + 2);
            if (close < 0) {
                throw new Error('Unclosed expansion placeholder');
            }
            const name = source.substring(index + 2, close).trim();
            if (!name) {
                throw new Error('Empty expansion placeholder');
            }
            const resolved = resolveName(name);
            result += formatMacroExpansionValue(resolved, name);
            index = close + 1;
            continue;
        }

        result += source[index];
        index += 1;
    }
    return result;
}

export function executeMacroLines(lines = [], options = {}) {
    const normalized = normalizeMacroLines(lines);
    const results = [];
    for (let index = 0; index < normalized.length; index += 1) {
        const line = normalized[index];
        if (classifyMacroLine(line) !== 'command') {
            continue;
        }
        let expandedLine = line;
        try {
            expandedLine = typeof options.expandLine === 'function'
                ? options.expandLine(line, { lineNumber: index + 1 })
                : line;
            const result = executeMacroLine(expandedLine, options);
            results.push({ ...result, lineNumber: index + 1, line, expandedLine });
            if (options.verbose && typeof options.log === 'function') {
                options.log(`${index + 1}: ${expandedLine}${result.result ? ` => ${result.result}` : ' => ok'}`);
            }
        } catch (error) {
            const failure = {
                ok: false,
                lineNumber: index + 1,
                line,
                expandedLine,
                error: error.message
            };
            results.push(failure);
            if (typeof options.log === 'function') {
                options.log(`${index + 1}: ${expandedLine} => ERROR: ${error.message}`);
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
