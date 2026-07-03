#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listApprovedValues } from '../approved-values.js';
import { gMenuFile } from '../menu.js';

//These are used by dynamically built menus, so cause warnings unless allowlisted here.
const runtimeChildrenActionMap = new Map([
    ['pluginManager', [
        'pluginAction:audit',
        'pluginAction:invoke',
        'pluginAction:graveyardBury',
        'pluginAction:graveyardSave',
        'pluginAction:graveyardRaise',
        'pluginAction:graveyardLink',
        'pluginProperty:select',
        'pluginProperty:set',
        'pluginProperty:toggle'
    ]],
    ['sectionEditInstrument', [
        'sectionEditInstrumentSelect'
    ]],
    ['macroEditNumber', [
        'macroEditById'
    ]],
    ['macroRunNumber', [
        'macroRunById'
    ]],
    ['macroDeleteNumber', [
        'macroDeleteConfirmed',
        'macroDeleteCancel'
    ]],
    ['tuningShowList', [
        'showTuningById'
    ]],
    ['tuningHideList', [
        'hideTuningById'
    ]]
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const keyHandlersPath = path.join(repoRoot, 'key-handlers.js');

const keyHandlersSource = fs.readFileSync(keyHandlersPath, 'utf8');

function extractSwitchBlock(source, switchMarker) {
    const switchStart = source.indexOf(switchMarker);
    if (switchStart === -1) {
        return '';
    }

    const braceStart = source.indexOf('{', switchStart);
    if (braceStart === -1) {
        return '';
    }

    let depth = 0;
    for (let index = braceStart; index < source.length; index++) {
        const ch = source[index];
        if (ch === '{') {
            depth += 1;
        } else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(braceStart + 1, index);
            }
        }
    }

    return '';
}

function extractBlockAfterMarker(source, marker) {
    const blockStart = source.indexOf(marker);
    if (blockStart === -1) {
        return '';
    }

    const braceStart = source.indexOf('{', blockStart);
    if (braceStart === -1) {
        return '';
    }

    let depth = 0;
    for (let index = braceStart; index < source.length; index++) {
        const ch = source[index];
        if (ch === '{') {
            depth += 1;
        } else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(braceStart + 1, index);
            }
        }
    }

    return '';
}

function collectTopLevelCaseLabels(switchBody) {
    const labels = new Set();
    let depth = 0;
    let index = 0;

    while (index < switchBody.length) {
        const ch = switchBody[index];
        if (ch === '{') {
            depth += 1;
            index += 1;
            continue;
        }
        if (ch === '}') {
            depth = Math.max(0, depth - 1);
            index += 1;
            continue;
        }

        if (depth === 0 && switchBody.startsWith('case ', index)) {
            const match = switchBody.slice(index).match(/^case\s+"([^"]+)"\s*:/);
            if (match) {
                labels.add(match[1]);
                index += match[0].length;
                continue;
            }
        }

        index += 1;
    }

    return labels;
}

const actionCases = collectTopLevelCaseLabels(extractSwitchBlock(keyHandlersSource, 'switch (menuItem.action){'));
const valueCases = new Set(listApprovedValues({ includeSamples: false }).map((entry) => entry.name));
const menuValueCases = collectLiteralValueCases(extractBlockAfterMarker(keyHandlersSource, 'export function getValue(what)'));

const errors = [];
const warnings = [];
let runtimeChildrenCount = 0;
const runtimeActionRefs = new Set();

function collectLiteralValueCases(functionBody) {
    const labels = new Set();
    const literalPattern = /what\s*===\s*'([^']+)'/g;
    let match;

    while ((match = literalPattern.exec(functionBody)) !== null) {
        labels.add(match[1]);
    }

    return labels;
}

function hasChildren(node) {
    return Array.isArray(node?.children) && node.children.length > 0;
}

function hasRuntimeChildren(node) {
    return typeof node?.runtimeChildren === 'string' && node.runtimeChildren.length > 0;
}

function isPassiveDisplayNode(node) {
    return Boolean(node)
        && !node.trigger
        && !node.action
        && !node.input
        && !hasChildren(node)
        && !hasRuntimeChildren(node)
        && typeof node.caption === 'string';
}

function addError(message) {
    errors.push(message);
}

function addWarning(message) {
    warnings.push(message);
}

function isLikelyResolverToken(value) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function pathForNode(parentPath, node) {
    if (!node || !node.trigger) {
        if (isPassiveDisplayNode(node)) {
            return parentPath + '/[display]';
        }
        return parentPath + '/[input]';
    }
    if (parentPath === '/') {
        return '/' + node.trigger;
    }
    return parentPath + node.trigger;
}

function validateVisibleNode(node, nodePath) {
    if (!node.caption) {
        addError(nodePath + ': missing caption');
    }
    if (isPassiveDisplayNode(node)) {
        return;
    }
    if (!node.trigger) {
        addError(nodePath + ': missing trigger');
    }
    if (node.caption && node.trigger && !node.caption.includes('<b>' + node.trigger + '</b>')) {
        addWarning(nodePath + ': caption does not visibly bold the trigger');
    }
    if (nodePath !== '/' && node.trigger === 'x') {
        addWarning(nodePath + ': trigger x conflicts with command-line exit behavior');
    }
    if (nodePath !== '/' && node.trigger === '/') {
        addWarning(nodePath + ': trigger / conflicts with command-line reset-to-root behavior');
    }
}

function validateVars(node, nodePath) {
    if (!Array.isArray(node.vars)) {
        return;
    }
    node.vars.forEach((token) => {
        if (!valueCases.has(token) && !menuValueCases.has(token)) {
            addError(nodePath + ': unresolved vars token "' + token + '" in approved-values registry');
        }
        if (node.caption && !node.caption.includes('${' + token + '}')) {
            addWarning(nodePath + ': vars token "' + token + '" is listed but not referenced in caption');
        }
    });
}

function validateAction(node, nodePath) {
    if (!node.action) {
        return;
    }
    if (!actionCases.has(node.action)) {
        addError(nodePath + ': action "' + node.action + '" is missing from performCmdAction()');
    }
}

function validateInput(node, nodePath) {
    if (!node.input) {
        return;
    }
    if (!node.action) {
        addError(nodePath + ': input node must also define an action');
    }
    if (node.input.type !== 'input') {
        addError(nodePath + ': input.type must be "input"');
    }
    if (!node.input.id) {
        addError(nodePath + ': input.id is required');
    }
    if (!node.input.caption) {
        addWarning(nodePath + ': input.caption is missing');
    }
    if (typeof node.input.default === 'string' && isLikelyResolverToken(node.input.default) && !valueCases.has(node.input.default)) {
        addWarning(nodePath + ': input.default token "' + node.input.default + '" is not handled by approved-values registry');
    }
    if (typeof node.input.default !== 'undefined' && node.input.default === '') {
        addWarning(nodePath + ': input.default is empty');
    }
}

function validateChildren(node, nodePath) {
    if (!Array.isArray(node.children) || node.children.length === 0) {
        return;
    }

    const seenByTrigger = new Map();
    node.children.forEach((child, index) => {
        const childPath = pathForNode(nodePath, child);

        if (!child.trigger && !isPassiveDisplayNode(child)) {
            addError(childPath + ': child at index ' + index + ' is missing trigger');
        } else if (seenByTrigger.has(child.trigger)) {
            addError(
                nodePath + ': duplicate sibling trigger "' + child.trigger + '" at ' + seenByTrigger.get(child.trigger) + ' and ' + childPath
            );
        } else if (child.trigger) {
            seenByTrigger.set(child.trigger, childPath);
        }

        const noChildren = !hasChildren(child);
        const noAction = !child.action;
        if (noChildren && noAction && !node.action && !hasRuntimeChildren(child) && !isPassiveDisplayNode(child)) {
            addWarning(childPath + ': selector-style leaf has no action, and parent also has no action');
        }
    });
}

function walk(node, nodePath = '/') {
    if (typeof node.runtimeChildren === 'string' && node.runtimeChildren.length > 0) {
        runtimeChildrenCount += 1;
        const impliedActions = runtimeChildrenActionMap.get(node.runtimeChildren) || [];
        impliedActions.forEach((action) => runtimeActionRefs.add(action));
    }
    validateVisibleNode(node, nodePath);
    validateVars(node, nodePath);
    validateAction(node, nodePath);
    validateInput(node, nodePath);
    validateChildren(node, nodePath);

    if (!Array.isArray(node.children)) {
        return;
    }

    node.children.forEach((child) => {
        walk(child, pathForNode(nodePath, child));
    });
}

walk(gMenuFile, '/');

const actionRefs = new Set();
function collectActions(node) {
    if (node.action) {
        actionRefs.add(node.action);
    }
    if (Array.isArray(node.children)) {
        node.children.forEach(collectActions);
    }
}
collectActions(gMenuFile);

runtimeActionRefs.forEach((action) => actionRefs.add(action));

const unusedActionCases = Array.from(actionCases)
    .filter((action) => !actionRefs.has(action))
    .sort();

unusedActionCases.forEach((action) => {
    addWarning('performCmdAction() contains unused case "' + action + '". If dynamic, update validate-command-menu.js::runtimeChildrenActionMap');
});

console.log('Command Menu Validator');
console.log('======================');
console.log('Menu actions referenced: ' + actionRefs.size);
console.log('performCmdAction cases: ' + actionCases.size);
console.log('approved-values tokens: ' + valueCases.size);
console.log('runtimeChildren menuItems: ' + runtimeChildrenCount);
console.log('');

if (errors.length === 0 && warnings.length === 0) {
    console.log('No issues found.');
    process.exit(0);
}

if (errors.length > 0) {
    console.log('Errors');
    console.log('------');
    errors.forEach((message) => console.log('- ' + message));
    console.log('');
}

if (warnings.length > 0) {
    console.log('Warnings');
    console.log('--------');
    warnings.forEach((message) => console.log('- ' + message));
    console.log('');
}

console.log('Summary: ' + errors.length + ' error(s), ' + warnings.length + ' warning(s)');
process.exit(errors.length > 0 ? 1 : 0);