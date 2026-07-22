#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import {
    classifyInstrumentRole,
    normalizeInstrumentSummary,
    tableIDForBaseID
} from '../InstrumentRoleBadges.js';

const DEFAULT_SONG_LIST = 'songs/song-list.json';

export { tableIDForBaseID };

function printUsage() {
    console.log('Usage: node bin/update-song-list.js [--song-list <path>] [--check] [--quiet] [--help]');
    console.log('Defaults to updating songs/song-list.json.');
}


function parseArgs(argv) {
    const result = {
        songList: DEFAULT_SONG_LIST,
        check: false,
        quiet: false,
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

function pushMessage(messages, message) {
    if (message) {
        messages.push(message);
    }
}

export function normalizeSongListHref(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return '';
    }
    return typeof entry.href === 'string' ? entry.href.trim() : '';
}

export function buildVisibilityMap(songJson = {}, warnings = []) {
    const map = new Map();
    const layout = Array.isArray(songJson.noteTablesLayout) ? songJson.noteTablesLayout : [];
    layout.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const tableID = `${entry.tableID || ''}`.trim();
        if (!tableID || map.has(tableID)) {
            return;
        }
        map.set(tableID, entry.visible !== false);
    });

    (Array.isArray(songJson.myTunings) ? songJson.myTunings : []).forEach((tuning) => {
        const tableID = tableIDForBaseID(tuning?.baseID);
        if (!tableID) {
            return;
        }
        if (!map.has(tableID)) {
            map.set(tableID, true);
            pushMessage(warnings, `UserLog SongListUpdater warning: ${songJson.songName || '<unnamed song>'} has no noteTablesLayout entry for ${tableID}; using visible=true.`);
            return;
        }
        if (Object.prototype.hasOwnProperty.call(tuning, 'visible')) {
            pushMessage(warnings, `UserLog SongListUpdater warning: ${songJson.songName || '<unnamed song>'} ${tableID} has stale tuning.visible; ignoring it and using noteTablesLayout.`);
        }
    });

    return map;
}

export function classifyWiring(tableID, wirings = []) {
    return classifyInstrumentRole(tableID, wirings);
}

export function extractInstrumentSummaries(songJson = {}, warnings = []) {
    const visibilityByTableID = buildVisibilityMap(songJson, warnings);
    const tunings = Array.isArray(songJson.myTunings) ? songJson.myTunings : [];
    const result = [];

    tunings.forEach((tuning) => {
        const baseID = `${tuning?.baseID || ''}`.trim();
        const tableID = tableIDForBaseID(baseID);
        if (!baseID || !tableID) {
            return;
        }
        const fromBaseID = `${tuning?.fromBaseID || ''}`.trim();
        if (!fromBaseID) {
            pushMessage(warnings, `UserLog SongListUpdater warning: ${songJson.songName || '<unnamed song>'} ${tableID} has no fromBaseID; skipping instrument badge.`);
            return;
        }
        result.push({
            fromBaseID,
            wiring: classifyWiring(tableID, songJson.wirings),
            visible: visibilityByTableID.get(tableID) !== false
        });
    });

    return result;
}

export function extractTutorialSummary(songJson = {}) {
    const level = `${songJson?.tutorial?.level || ''}`.trim().toLowerCase();
    if (level !== 'strict') {
        return null;
    }
    return {
        tutorial: 'strict',
        SectionCount: Array.isArray(songJson.sections) ? songJson.sections.length : 0
    };
}

export function updateSongListData(songListJson = {}, options = {}) {
    const warnings = [];
    const errors = [];
    const songListPath = options.songListPath ? resolveFromCwd(options.songListPath) : resolveFromCwd(DEFAULT_SONG_LIST);
    const songListDir = path.dirname(songListPath);
    const readSongJson = options.readSongJson || readJsonFile;
    const songs = Array.isArray(songListJson.songs) ? songListJson.songs : [];

    const nextSongs = songs.map((entry, index) => {
        if (typeof entry === 'string') {
            pushMessage(warnings, `Song list entry ${index + 1} is a legacy string; skipped: ${entry}`);
            return entry;
        }
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            pushMessage(warnings, `Song list entry ${index + 1} is not an object; skipped.`);
            return entry;
        }
        const href = normalizeSongListHref(entry);
        if (!href) {
            pushMessage(warnings, `Song list entry ${index + 1} has no href; skipped.`);
            return entry;
        }

        const songPath = path.resolve(songListDir, href);
        let songJson;
        try {
            songJson = readSongJson(songPath, { href, entry, index });
        } catch (error) {
            errors.push(`Unable to read ${href}: ${error.message}`);
            return entry;
        }

        const instruments = extractInstrumentSummaries(songJson, warnings);
        const tutorialSummary = extractTutorialSummary(songJson);
        const nextEntry = {
            ...entry,
            instruments
        };
        if (tutorialSummary) {
            nextEntry.tutorial = tutorialSummary.tutorial;
            nextEntry.SectionCount = tutorialSummary.SectionCount;
        } else {
            delete nextEntry.tutorial;
            delete nextEntry.SectionCount;
        }
        return nextEntry;
    });

    const data = {
        ...songListJson,
        songs: nextSongs
    };

    return {
        data,
        warnings,
        errors,
        changed: stableJson(data) !== stableJson(songListJson)
    };
}

function reportMessages({ warnings = [], errors = [] }, quiet = false) {
    if (!quiet) {
        warnings.forEach((warning) => console.warn(`WARN ${warning}`));
    }
    errors.forEach((error) => console.error(`ERROR ${error}`));
}

export function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    if (args.help) {
        printUsage();
        return;
    }

    const songListPath = resolveFromCwd(args.songList);
    const original = readJsonFile(songListPath);
    const result = updateSongListData(original, { songListPath });

    reportMessages(result, args.quiet);

    if (args.check) {
        if (!args.quiet) {
            console.log(result.changed ? `${args.songList} needs update.` : `${args.songList} is up to date.`);
        }
        if (result.changed || result.errors.length > 0) {
            process.exitCode = 1;
        }
        return;
    }

    if (result.errors.length > 0) {
        process.exitCode = 1;
        return;
    }

    if (result.changed) {
        fs.writeFileSync(songListPath, stableJson(result.data));
        if (!args.quiet) {
            console.log(`Updated ${args.songList}.`);
        }
    } else if (!args.quiet) {
        console.log(`${args.songList} is up to date.`);
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