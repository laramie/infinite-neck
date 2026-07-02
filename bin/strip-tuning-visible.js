#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const DEFAULT_SONG_LIST = 'songs/song-list.json';

function printUsage() {
    console.log('Usage: node bin/strip-tuning-visible.js [--song-list <path>] [--check] [--quiet] [--include-tunings-library] [--help]');
    console.log('Removes stale myTunings[].visible fields from songs listed in songs/song-list.json.');
}

function parseArgs(argv) {
    const result = {
        songList: DEFAULT_SONG_LIST,
        check: false,
        quiet: false,
        includeTuningsLibrary: false,
        help: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--song-list') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('--song-list requires a path');
            }
            result.songList = value;
            index += 1;
            continue;
        }
        if (arg === '--check') {
            result.check = true;
            continue;
        }
        if (arg === '--quiet') {
            result.quiet = true;
            continue;
        }
        if (arg === '--include-tunings-library') {
            result.includeTuningsLibrary = true;
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            result.help = true;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    return result;
}

function resolveFromCwd(inputPath) {
    return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function getSongHrefs(songListJson = {}) {
    return (Array.isArray(songListJson.songs) ? songListJson.songs : [])
        .map((entry) => (entry && typeof entry === 'object' && !Array.isArray(entry)) ? `${entry.href || ''}`.trim() : '')
        .filter(Boolean);
}

export function stripTuningVisibleFromSong(songJson = {}) {
    let changed = false;
    const tunings = Array.isArray(songJson.myTunings) ? songJson.myTunings : [];
    const nextTunings = tunings.map((tuning) => {
        if (!tuning || typeof tuning !== 'object' || Array.isArray(tuning)) {
            return tuning;
        }
        if (!Object.prototype.hasOwnProperty.call(tuning, 'visible')) {
            return tuning;
        }
        changed = true;
        const nextTuning = { ...tuning };
        delete nextTuning.visible;
        return nextTuning;
    });

    return {
        data: changed ? { ...songJson, myTunings: nextTunings } : songJson,
        changed
    };
}

function stripVisibleLinesFromTuningsLibrary(source) {
    return source.replace(/^\s+"visible":\s*(?:true|false),?\n/gm, '');
}

function collectSongFiles(songListPath) {
    const songList = readJsonFile(songListPath);
    const songListDir = path.dirname(songListPath);
    return getSongHrefs(songList).map((href) => path.resolve(songListDir, href));
}

function processSongFile(filePath, { check }) {
    const original = readJsonFile(filePath);
    const result = stripTuningVisibleFromSong(original);
    if (result.changed && !check) {
        fs.writeFileSync(filePath, stableJson(result.data));
    }
    return result.changed;
}

function processTuningsLibrary(filePath, { check }) {
    const original = fs.readFileSync(filePath, 'utf8');
    const next = stripVisibleLinesFromTuningsLibrary(original);
    const changed = next !== original;
    if (changed && !check) {
        fs.writeFileSync(filePath, next);
    }
    return changed;
}

export function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    if (args.help) {
        printUsage();
        return;
    }

    const songListPath = resolveFromCwd(args.songList);
    const changedFiles = [];
    const errors = [];
    const songFiles = collectSongFiles(songListPath);

    songFiles.forEach((songFilePath) => {
        try {
            if (processSongFile(songFilePath, args)) {
                changedFiles.push(path.relative(process.cwd(), songFilePath));
            }
        } catch (error) {
            errors.push(`${path.relative(process.cwd(), songFilePath)}: ${error.message}`);
        }
    });

    if (args.includeTuningsLibrary) {
        const tuningsPath = resolveFromCwd('tunings.js');
        try {
            if (processTuningsLibrary(tuningsPath, args)) {
                changedFiles.push(path.relative(process.cwd(), tuningsPath));
            }
        } catch (error) {
            errors.push(`${path.relative(process.cwd(), tuningsPath)}: ${error.message}`);
        }
    }

    errors.forEach((error) => console.error(`ERROR ${error}`));
    if (!args.quiet) {
        if (changedFiles.length > 0) {
            console.log(`${args.check ? 'Would update' : 'Updated'} ${changedFiles.length} file(s):`);
            changedFiles.forEach((file) => console.log(`- ${file}`));
        } else {
            console.log('No stale tuning.visible fields found.');
        }
    }
    if (errors.length > 0 || (args.check && changedFiles.length > 0)) {
        process.exitCode = 1;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        printUsage();
        process.exitCode = 1;
    }
}