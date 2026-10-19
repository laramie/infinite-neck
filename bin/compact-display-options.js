#!/usr/bin/env node

// Sprint 148 Iteration 4: DRY-RUN report of redundant DisplayOptions cells.
//
// Songs saved before Iteration 4 store a whole DisplayOptions snapshot per Section ("SAVE").  The Matrix
// stores SPARSE blocks (only what a Section changes).  This tool reports, per Song, which stored cells
// repeat what the Section already inherits (earlier Sections' readable cells, then the defaults) and so
// could be dropped without changing what the Song shows.
//
// It NEVER writes.  There is no --write option on purpose (Round 3 Q9): compaction is a behaviour change
// that the Matrix sprint will drive.  Cells that are write-blocked by a gate are not reported.
//
// Notes on what "redundant" means:
//   - Sections are processed in order; a cell is compared with the cascade of the Sections BEFORE it, after
//     earlier redundant cells have been (virtually) dropped.
//   - NoteDisplaySizes / sectionTheme are only considered when the Song has presentationMode /
//     allowThemeAutomation on; currentColorDict has no default, so its first cell is always kept.
//   - After a real compaction a key that no Section stores any more is no longer "automated": navigation
//     then leaves its control alone instead of resetting it to the default.
//
// Usage: node bin/compact-display-options.js [--verbose] [--include-trash] [paths...]
//   (default: ./songs)    e.g.  node bin/compact-display-options.js songs/tests/display-options.json --verbose

import fs from 'fs';
import path from 'path';
import { valuesEqual, isDisplayOptionKey } from '../templates/display-options/displayOptionsMeta.js';
import { isExplicitWriteBlocked, isReadBlocked } from '../templates/display-options/displayOptionsGates.js';
import { resolveDisplayOptions } from '../templates/display-options/displayOptionsResolver.js';

function parseArgs(argv) {
    const result = { verbose: false, includeTrash: false, paths: [] };
    argv.forEach((arg) => {
        if (arg === '--verbose') {
            result.verbose = true;
        } else if (arg === '--include-trash') {
            result.includeTrash = true;
        } else if (arg === '--write') {
            throw new Error('compact-display-options is a dry run only: there is no --write');
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

/** Pure: works on parsed Song JSON.  Returns { stored, redundant: [{ sectionIndex, key }] } (sectionIndex 0-based). */
export function findRedundantCells(songData) {
    const sections = (songData.sections || []).map((s) => ({
        displayOptions: s.displayOptions ? { ...s.displayOptions } : undefined,
        displayOptionGates: s.displayOptionGates
    }));
    const song = {
        sections,
        displayOptionGates: songData.displayOptionGates,
        presentationMode: !!songData.presentationMode,
        allowThemeAutomation: !!songData.allowThemeAutomation
    };
    let stored = 0;
    const redundant = [];
    sections.forEach((section, sectionIndex) => {
        const block = section.displayOptions;
        if (!block) return;
        const baseline = resolveDisplayOptions(song, sectionIndex, { purpose: 'baseline' }).values;
        for (const key of Object.keys(block)) {
            if (!isDisplayOptionKey(key)) continue;
            stored++;
            if (isExplicitWriteBlocked(song, section, key) || isReadBlocked(song, section, key)) continue;
            if (key in baseline && valuesEqual(key, block[key], baseline[key])) {
                redundant.push({ sectionIndex, key });
                delete block[key];
            }
        }
    });
    return { stored, redundant };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const files = args.paths.flatMap((target) => collectJsonFiles(target, args.includeTrash));
    let totalStored = 0;
    let totalRedundant = 0;
    let filesWithCells = 0;

    files.forEach((file) => {
        let data;
        try {
            data = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (error) {
            return;
        }
        if (!Array.isArray(data.sections)) return;
        const { stored, redundant } = findRedundantCells(data);
        if (!stored) return;
        filesWithCells++;
        totalStored += stored;
        totalRedundant += redundant.length;
        console.log(`${file}: ${stored} stored cells, ${redundant.length} redundant`);
        if (args.verbose) {
            redundant.forEach(({ sectionIndex, key }) => console.log(`    Section ${sectionIndex + 1}: ${key}`));
        }
    });

    console.log(`Dry run: ${totalRedundant} of ${totalStored} stored cells are redundant, in ${filesWithCells} files with cells (${files.length} files scanned). Nothing was written.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    main();
}
