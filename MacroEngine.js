import * as Globals from './globals.js';
import {
    classifyMacroLine,
    executeMacroLine,
    executeSongMacro,
    expandMacroLine,
    getSongMacro,
    validateMacroId
} from './MacroExecutor.js';
import { UserLog } from './UserLog.js';


const MAX_MACRO_EXECUTION_DEPTH = 4;
const MACRO_LINES_PER_FRAME = 8;

const MACRO_ALLOWED_EXTERNAL_ACTIONS = new Set([
    'noAction',
    'showUserLog',
    'hideViewMessages',
    'reshowViewMessages',
    'showDialog-info',
    'showViewDiagnostics',
    'showViewDiagnosticsFullModel',
    'showViewDiagnosticsMenu',
    'showViewDiagnosticsMenuJson',
    'showViewDiagnosticsUserColorDict',
    'showViewDiagnosticsDisplayOptions',
    'showViewDiagnosticsVariables',
    'showViewDiagnosticsSongFileFormat'
]);

const state = {
    deps: null,
    macroExecutionDepth: 0,
    macroInternalActionDepth: 0,
    macroActiveEngine: null,
    run: {
        running: false,
        engine: null,
        overlayNode: null,
        focusNode: null
    }
};

function requireDeps() {
    if (!state.deps) {
        throw new Error('MacroEngine not configured');
    }
    return state.deps;
}

export function configureMacroEngine(nextDeps = {}) {
    state.deps = {
        ...(state.deps || {}),
        ...nextDeps
    };
}

export function ensureMacroOverlay() {
    const deps = requireDeps();
    if (state.run.overlayNode && state.run.focusNode) {
        return;
    }
    let overlay = document.getElementById('macroProcessingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'macroProcessingOverlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.display = 'none';
        overlay.style.background = 'rgba(0, 0, 0, 0.18)';
        overlay.style.zIndex = '2147483647';
        overlay.style.pointerEvents = 'auto';

        const panel = document.createElement('div');
        panel.style.position = 'fixed';
        panel.style.top = '1rem';
        panel.style.right = '1rem';
        panel.style.padding = '0.6rem 0.9rem';
        panel.style.background = 'rgba(20, 20, 20, 0.85)';
        panel.style.color = '#fff';
        panel.style.border = '1px solid rgba(255,255,255,0.35)';
        panel.style.borderRadius = '0.35rem';
        panel.style.fontSize = '3rem';
        panel.style.maxWidth = '48rem';
        panel.textContent = 'Macro running. Song edits are locked until completion.';

        const trapInput = document.createElement('input');
        trapInput.type = 'text';
        trapInput.id = 'macroProcessingFocusTrap';
        trapInput.autocomplete = 'off';
        trapInput.value = 'macro processing';
        trapInput.style.position = 'absolute';
        trapInput.style.width = '1px';
        trapInput.style.height = '1px';
        trapInput.style.opacity = '0.01';
        trapInput.style.border = '0';
        trapInput.style.padding = '0';
        trapInput.style.left = '-10000px';
        trapInput.style.top = '0';

        overlay.appendChild(panel);
        overlay.appendChild(trapInput);
        overlay.addEventListener('mousedown', (evt) => {
            evt.preventDefault();
            if (state.run.running) {
                trapInput.focus();
            }
        });
        document.body.appendChild(overlay);
    }
    state.run.overlayNode = overlay;
    state.run.focusNode = document.getElementById('macroProcessingFocusTrap');
    if (state.run.focusNode) {
        state.run.focusNode.addEventListener('blur', () => {
            if (state.run.running) {
                setTimeout(() => {
                    if (state.run.running) {
                        state.run.focusNode?.focus();
                    }
                }, 0);
            }
        });
    }
    deps.onOverlayReady?.();
}

export function showMacroOverlay() {
    ensureMacroOverlay();
    if (state.run.overlayNode) {
        state.run.overlayNode.style.display = 'block';
    }
    state.run.focusNode?.focus();
}

export function hideMacroOverlay() {
    if (state.run.overlayNode) {
        state.run.overlayNode.style.display = 'none';
    }
}

export function focusMacroOverlay() {
    state.run.focusNode?.focus();
}

export function scheduleMacroFrame(callback) {
    if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(callback);
        return;
    }
    setTimeout(() => callback(Date.now()), 0);
}

export function isMacroMutationLockActive() {
    return state.run.running && state.macroInternalActionDepth === 0;
}

export function isAllowedDuringMacro(actionName) {
    return MACRO_ALLOWED_EXTERNAL_ACTIONS.has(`${actionName || ''}`);
}

export function logMacro(message) {
    const deps = requireDeps();
    UserLog.addToUserLog('Macro', message);
    if (state.run.running && deps.isMacroVerbose()) {
        UserLog.showUserLog();
    }
}

export function parseMacroCallInput(argByInputID) {
    const rawValue = argByInputID;
    let value = rawValue;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            throw new Error('macro call object is required');
        }
        try {
            value = JSON.parse(trimmed);
        } catch (error) {
            throw new Error(`macro call input must be valid JSON: ${error.message}`);
        }
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('macro call input must be a JSON object');
    }
    const keys = Object.keys(value);
    const allowedKeys = new Set(['macro', 'args']);
    const unknownKeys = keys.filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
        throw new Error(`macro call input has unsupported keys: ${unknownKeys.join(', ')}`);
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'macro')) {
        throw new Error('macro call input must include macro');
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'args')) {
        throw new Error('macro call input must include args');
    }

    const macroId = `${value.macro || ''}`.trim();
    if (!validateMacroId(macroId)) {
        throw new Error(`invalid macro id: ${macroId}`);
    }
    if (!value.args || typeof value.args !== 'object' || Array.isArray(value.args)) {
        throw new Error('macro call args must be a JSON object');
    }

    return {
        macroId,
        args: value.args
    };
}

function resolveMacroExpansionValue(name, callArgs = {}) {
    const deps = requireDeps();
    if (Object.prototype.hasOwnProperty.call(callArgs, name)) {
        return callArgs[name];
    }
    const resolved = deps.getValue(name);
    if (resolved === name) {
        return undefined;
    }
    return resolved;
}

export function runMacroMenuAction(menuItem, args, context = {}) {
    const deps = requireDeps();
    if (menuItem?.action === 'pluginProperty:toggle' && context.hasValue) {
        return deps.setPluginToggleValueForMacro(menuItem, context.value);
    }
    if (menuItem?.action === 'macroCall' && state.macroActiveEngine && context.hasValue) {
        const parsed = parseMacroCallInput(context.value);
        state.macroActiveEngine.pushMacroCall(parsed.macroId, parsed.args);
        return { result: `queued ${parsed.macroId}` };
    }
    state.macroInternalActionDepth += 1;
    let actionResult;
    try {
        actionResult = deps.performCmdAction(menuItem, args);
    } finally {
        state.macroInternalActionDepth -= 1;
    }
    if (actionResult?.macroExecutionError) {
        throw new Error(actionResult.macroExecutionError);
    }
    return actionResult;
}

export function createMacroFrame(song, macroId, callArgs = {}) {
    const macro = getSongMacro(song, macroId);
    if (!macro) {
        throw new Error(`Macro not found: ${macroId}`);
    }
    const lines = Array.isArray(macro.lines) ? macro.lines : [];
    return {
        macroId,
        callArgs,
        lines,
        nextIndex: 0
    };
}

export function createMacroEngine(rootMacroId, options = {}) {
    const deps = requireDeps();
    const song = Globals.getSong();
    const rootCallArgs = options.callArgs && typeof options.callArgs === 'object' && !Array.isArray(options.callArgs)
        ? options.callArgs
        : {};
    const engine = {
        rootMacroId,
        stack: [],
        results: [],
        linesExecuted: 0,
        verbose: options.verbose ?? deps.isMacroVerbose(),
        failed: false,
        failure: null,
        pushMacroCall(macroId, callArgs = {}) {
            if (this.stack.length >= MAX_MACRO_EXECUTION_DEPTH) {
                throw new Error(`Macro call depth exceeded (${this.stack.length}/${MAX_MACRO_EXECUTION_DEPTH}): ${macroId}`);
            }
            this.stack.push(createMacroFrame(song, macroId, callArgs));
        }
    };
    engine.pushMacroCall(rootMacroId, rootCallArgs);
    return engine;
}

export function processMacroEngineFrame(engine) {
    const deps = requireDeps();
    let linesInFrame = 0;
    while (engine.stack.length > 0 && linesInFrame < MACRO_LINES_PER_FRAME) {
        const frame = engine.stack[engine.stack.length - 1];
        if (frame.nextIndex >= frame.lines.length) {
            engine.stack.pop();
            continue;
        }

        const lineNumber = frame.nextIndex + 1;
        const line = `${frame.lines[frame.nextIndex] ?? ''}`;
        frame.nextIndex += 1;
        if (classifyMacroLine(line) !== 'command') {
            continue;
        }

        try {
            const expandedLine = expandMacroLine(line, (name) => resolveMacroExpansionValue(name, frame.callArgs));
            state.macroActiveEngine = engine;
            deps.refreshBeforePath();
            const result = executeMacroLine(expandedLine, {
                rootMenu: deps.rootMenu(),
                actionRunner: runMacroMenuAction,
                refreshBeforePath: deps.refreshBeforePath,
                refreshRuntimeChildren: deps.refreshRuntimeChildren
            });
            state.macroActiveEngine = null;
            engine.linesExecuted += 1;
            linesInFrame += 1;
            engine.results.push({
                ok: true,
                macroId: frame.macroId,
                lineNumber,
                line,
                expandedLine,
                result: result.result || ''
            });
            if (engine.verbose) {
                logMacro(`${lineNumber}: ${expandedLine}${result.result ? ` => ${result.result}` : ' => ok'}`);
            }
        } catch (error) {
            state.macroActiveEngine = null;
            engine.failed = true;
            engine.failure = {
                macroId: frame.macroId,
                lineNumber,
                line,
                error: error.message
            };
            engine.results.push({
                ok: false,
                macroId: frame.macroId,
                lineNumber,
                line,
                error: error.message
            });
            if (engine.verbose) {
                logMacro(`${lineNumber}: ${line} => ERROR: ${error.message}`);
            }
            return false;
        }
    }
    return engine.stack.length === 0;
}

export function finalizeMacroEngine(engine) {
    state.run.running = false;
    state.run.engine = null;
    hideMacroOverlay();
    if (engine.failed) {
        logMacro(`Macro ${engine.rootMacroId} stopped at line ${engine.failure.lineNumber}: ${engine.failure.error}`);
        return {
            ok: false,
            error: engine.failure.error,
            failedLineNumber: engine.failure.lineNumber,
            results: engine.results
        };
    }
    logMacro(`Macro ${engine.rootMacroId} completed (${engine.linesExecuted} lines)`);
    return {
        ok: true,
        results: engine.results
    };
}

export function pumpMacroEngine(engine) {
    const done = processMacroEngineFrame(engine);
    if (engine.failed || done) {
        const finalResult = finalizeMacroEngine(engine);
        engine.onDone?.(finalResult);
        return;
    }
    scheduleMacroFrame(() => pumpMacroEngine(engine));
}

export function runSongMacroById(macroId, options = {}) {
    const deps = requireDeps();
    const id = `${macroId || ''}`.trim();
    if (!id) {
        return { ok: false, error: 'macro id is required' };
    }
    if (state.macroExecutionDepth >= MAX_MACRO_EXECUTION_DEPTH) {
        const message = `Macro call depth exceeded (${state.macroExecutionDepth}/${MAX_MACRO_EXECUTION_DEPTH}): ${id}`;
        logMacro(message);
        return { ok: false, error: message };
    }
    const callArgs = options.callArgs && typeof options.callArgs === 'object' && !Array.isArray(options.callArgs)
        ? options.callArgs
        : {};
    state.macroExecutionDepth += 1;
    try {
        deps.refreshBeforePath();
        const result = executeSongMacro(Globals.getSong(), id, {
            rootMenu: deps.rootMenu(),
            actionRunner: runMacroMenuAction,
            refreshBeforePath: deps.refreshBeforePath,
            refreshRuntimeChildren: deps.refreshRuntimeChildren,
            expandLine: (line) => expandMacroLine(line, (name) => resolveMacroExpansionValue(name, callArgs)),
            verbose: options.verbose ?? deps.isMacroVerbose(),
            log: logMacro
        });
        if (result.ok) {
            logMacro(`Macro ${id} completed (${result.results.length} lines)`);
        } else {
            logMacro(`Macro ${id} stopped at line ${result.failedLineNumber}: ${result.error}`);
        }
        return result;
    } catch (error) {
        logMacro(`Macro ${id} failed: ${error.message}`);
        return { ok: false, error: error.message };
    } finally {
        state.macroExecutionDepth -= 1;
    }
}

export function isInMacroAction() {
    return state.macroInternalActionDepth > 0;
}

export function startSongMacroById(macroId, options = {}) {
    const deps = requireDeps();
    const id = `${macroId || ''}`.trim();
    if (!id) {
        return { ok: false, error: 'macro id is required' };
    }
    if (state.run.running) {
        return { ok: false, error: 'macro is already running' };
    }
    try {
        const engine = createMacroEngine(id, options);
        engine.onDone = typeof options.onDone === 'function' ? options.onDone : null;
        state.run.running = true;
        state.run.engine = engine;
        showMacroOverlay();
        if (engine.verbose) {
            UserLog.showUserLog();
        }
        scheduleMacroFrame(() => pumpMacroEngine(engine));
        return { ok: true, started: true, macroId: id };
    } catch (error) {
        logMacro(`Macro ${id} failed: ${error.message}`);
        return { ok: false, error: error.message };
    }
}
