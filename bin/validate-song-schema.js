#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { validateSongFileSchema } from './song-file-schema.js';

const DEFAULT_SONG_LISTS = [
    'songs/song-list.json',
    'songs/tests/test-song-list.json'
];

function printUsage() {
    console.log('Usage: node bin/validate-song-schema.js [--song-list <path>] [--file <path>] [--quiet] [--alert-empty-songs] [--strict]');
    console.log('Defaults to validating songs/song-list.json and songs/tests/test-song-list.json.');
    console.log('--alert-empty-songs reports empty section counts per song.');
    console.log('--strict also enables empty-section reporting, fails songs whose sections are all empty, and requires noteTablesLayout to be present.');
}

function parseArgs(argv) {
    const result = {
        songLists: [],
        files: [],
        quiet: false,
        alertEmptySongs: false,
        strict: false,
        help: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--song-list') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('--song-list requires a path');
            }
            result.songLists.push(value);
            index += 1;
            continue;
        }
        if (arg === '--file') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('--file requires a path');
            }
            result.files.push(value);
            index += 1;
            continue;
        }
        if (arg === '--quiet') {
            result.quiet = true;
            continue;
        }
        if (arg === '--alert-empty-songs' || arg === '--alertEmptySongs' || arg === '--alertEmtpySongs') {
            result.alertEmptySongs = true;
            continue;
        }
        if (arg === '--strict') {
            result.strict = true;
            result.alertEmptySongs = true;
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

function listSongsFromSongList(songListPath) {
    const songList = readJsonFile(songListPath);
    const songs = Array.isArray(songList.songs) ? songList.songs : [];
    const baseDir = path.dirname(songListPath);
    return songs
        .map((songEntry) => {
            if (typeof songEntry === 'string') {
                const href = songEntry.trim();
                return href ? href : null;
            }
            if (!songEntry || typeof songEntry !== 'object' || Array.isArray(songEntry)) {
                return null;
            }
            if (typeof songEntry.href !== 'string') {
                return null;
            }
            const href = songEntry.href.trim();
            return href ? href : null;
        })
        .filter((songPath) => typeof songPath === 'string')
        .map((songPath) => path.resolve(baseDir, songPath));
}

function uniquePaths(paths) {
    return [...new Set(paths)];
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getRecordedNoteCount(recordedNotes) {
    if (!isPlainObject(recordedNotes)) {
        return 0;
    }
    return Object.values(recordedNotes).reduce((count, notes) => count + (Array.isArray(notes) ? notes.length : 0), 0);
}

function sectionNotesHasContent(sectionNotes) {
    if (!isPlainObject(sectionNotes)) {
        return false;
    }
    const playedNotesCount = Array.isArray(sectionNotes.playedNotes) ? sectionNotes.playedNotes.length : 0;
    const namedNotesCount = isPlainObject(sectionNotes.namedNotes) ? Object.keys(sectionNotes.namedNotes).length : 0;
    const recordedNotesCount = getRecordedNoteCount(sectionNotes.recordedNotes);
    return playedNotesCount + namedNotesCount + recordedNotesCount > 0;
}

function sectionHasContent(section) {
    const sectionNotesByTable = isPlainObject(section?.sectionNotesByTable) ? section.sectionNotesByTable : {};
    const allTables = Object.values(sectionNotesByTable);
    if (allTables.length === 0) {
        return false;
    }
    return allTables.some(sectionNotesHasContent);
}

function getEmptySectionCount(songJson) {
    if (!Array.isArray(songJson.sections)) {
        return 0;
    }
    return songJson.sections.reduce((count, section) => count + (sectionHasContent(section) ? 0 : 1), 0);
}

function validateOneFile(filePath, options = {}) {
    const data = readJsonFile(filePath);
    const result = validateSongFileSchema(data);
    const emptySectionCount = getEmptySectionCount(data);
    const totalSections = Array.isArray(data.sections) ? data.sections.length : 0;
    const errors = [...result.errors];
    const notices = [];

    if (options.alertEmptySongs) {
        notices.push(`empty sections: ${emptySectionCount}/${totalSections}`);
    }

    if (options.strict) {
        if (!Object.prototype.hasOwnProperty.call(data, 'noteTablesLayout')) {
            errors.push('/ strict mode requires noteTablesLayout to be present');
        }
        if (totalSections > 0 && emptySectionCount === totalSections) {
            errors.push(`/ strict mode found all sections empty (${emptySectionCount}/${totalSections})`);
        }
    }

    return {
        filePath,
        valid: errors.length === 0,
        errors,
        notices,
        emptySectionCount,
        totalSections
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printUsage();
        return;
    }

    const useDefaultSongLists = args.songLists.length === 0 && args.files.length === 0;
    const songListArgs = useDefaultSongLists ? DEFAULT_SONG_LISTS : args.songLists;
    const songListPaths = songListArgs.map(resolveFromCwd);
    const explicitFiles = args.files.map(resolveFromCwd);
    const allSongFiles = uniquePaths([
        ...explicitFiles,
        ...songListPaths.flatMap(listSongsFromSongList)
    ]);

    if (allSongFiles.length === 0) {
        throw new Error('No song files found to validate');
    }

    const results = allSongFiles.map((filePath) => validateOneFile(filePath, args));
    const failures = results.filter((result) => !result.valid);

    if (!args.quiet) {
        results.forEach((result) => {
            const relativePath = path.relative(process.cwd(), result.filePath) || result.filePath;
            const noticeSuffix = result.notices.length > 0 ? ` | ${result.notices.join(' | ')}` : '';
            if (result.valid) {
                console.log(`PASS ${relativePath}${noticeSuffix}`);
                return;
            }
            console.log(`FAIL ${relativePath}${noticeSuffix}`);
            result.errors.forEach((error) => {
                console.log(`  ${error}`);
            });
        });
    }

    const summary = `Validated ${results.length} song file${results.length === 1 ? '' : 's'}: ${results.length - failures.length} passed, ${failures.length} failed.`;
    if (failures.length > 0) {
        console.error(summary);
        process.exitCode = 1;
        return;
    }

    console.log(summary);
}

try {
    main();
} catch (error) {
    console.error(error.message);
    printUsage();
    process.exitCode = 1;
}
