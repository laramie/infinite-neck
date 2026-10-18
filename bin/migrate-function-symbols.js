#!/usr/bin/env node

// Sprint 148 Iteration 3: one-time migration of stored Function Symbols.
//
//   before:  "dropDownFunctionSymbols": { "caption": "Default", "value": "[\"I\",\"τ\",...]" }
//   after:   "functionSymbols": "function"
//
// The built-in id is found by matching the stored `value` array against the built-in sets in
// templates/function-symbols/functionSymbolSets.js.  A value that matches no built-in is reported
// and left untouched.  The edit is textual, so the rest of each file keeps its exact formatting.
//
// Usage: node bin/migrate-function-symbols.js [--write] [--check] [--include-trash] [paths...]
//   (default: dry run over ./songs; --write rewrites files; --check exits 1 if the old key remains)

import fs from 'fs';
import path from 'path';
import { findBuiltInIdForSymbols } from '../templates/function-symbols/functionSymbolSets.js';

const OLD_KEY_BLOCK = /"dropDownFunctionSymbols"\s*:\s*\{[^{}]*\}/g;
// The same block inside a JSON string (Graveyard records keep whole Sections as escaped JSON text).
const OLD_KEY_BLOCK_ESCAPED = /\\"dropDownFunctionSymbols\\"\s*:\s*\{[^{}]*\}/g;

function parseArgs(argv) {
    const result = { write: false, check: false, includeTrash: false, paths: [] };
    argv.forEach((arg) => {
        if (arg === '--write') {
            result.write = true;
        } else if (arg === '--check') {
            result.check = true;
        } else if (arg === '--include-trash') {
            result.includeTrash = true;
        } else if (arg.startsWith('--')) {
            throw new Error(`Unknown option ${arg}`);
        } else {
            result.paths.push(arg);
        }
    });
    if (result.paths.length === 0) {
        result.paths.push('songs');
    }
    return result;
}

function collectJsonFiles(target, includeTrash, files = []) {
    const stat = fs.statSync(target);
    if (stat.isFile()) {
        if (target.endsWith('.json')) {
            files.push(target);
        }
        return files;
    }
    fs.readdirSync(target).forEach((name) => {
        if (name === 'node_modules' || name.startsWith('.') || (!includeTrash && name === '_trash')) {
            return;
        }
        collectJsonFiles(path.join(target, name), includeTrash, files);
    });
    return files;
}

/** Returns { text, replaced, unmatched: [reason...] } for one file's text. */
export function migrateText(text) {
    let replaced = 0;
    const unmatched = [];
    const idForBlock = (plainBlock) => {
        try {
            const value = JSON.parse(`{${plainBlock}}`).dropDownFunctionSymbols?.value;
            return findBuiltInIdForSymbols(JSON.parse(value));
        } catch (error) {
            return null;
        }
    };
    const migrated = text
        .replace(OLD_KEY_BLOCK, (block) => {
            const id = idForBlock(block);
            if (!id) {
                unmatched.push(block.replace(/\s+/g, ' ').slice(0, 120));
                return block;
            }
            replaced += 1;
            return `"functionSymbols": "${id}"`;
        })
        .replace(OLD_KEY_BLOCK_ESCAPED, (block) => {
            let id = null;
            try {
                id = idForBlock(JSON.parse(`"${block}"`)); // undo one level of JSON string escaping
            } catch (error) {
                id = null;
            }
            if (!id) {
                unmatched.push(`(escaped) ${block.replace(/\s+/g, ' ').slice(0, 120)}`);
                return block;
            }
            replaced += 1;
            return `\\"functionSymbols\\": \\"${id}\\"`;
        });
    return { text: migrated, replaced, unmatched };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const files = args.paths.flatMap((target) => collectJsonFiles(target, args.includeTrash));
    let totalReplaced = 0;
    let totalUnmatched = 0;
    let remaining = 0;

    files.forEach((file) => {
        const original = fs.readFileSync(file, 'utf8');
        if (!original.includes('dropDownFunctionSymbols')) {
            return;
        }
        const { text, replaced, unmatched } = migrateText(original);
        totalReplaced += replaced;
        totalUnmatched += unmatched.length;
        if (unmatched.length || replaced) {
            console.log(`${file}: ${replaced} migrated${unmatched.length ? `, ${unmatched.length} UNMATCHED` : ''}`);
            unmatched.forEach((block) => console.log(`    unmatched: ${block}`));
        }
        if (text.includes('dropDownFunctionSymbols')) {
            remaining += 1;
        }
        if (args.write && text !== original) {
            fs.writeFileSync(file, text);
        }
    });

    console.log(`${args.write ? 'Wrote' : 'Dry run:'} ${totalReplaced} blocks migrated, ${totalUnmatched} unmatched, ${files.length} files scanned.`);
    if (!args.write && totalReplaced) {
        console.log('Re-run with --write to apply.');
    }
    if (args.check && (remaining > 0 || totalReplaced > 0 || totalUnmatched > 0)) {
        process.exitCode = 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    main();
}
