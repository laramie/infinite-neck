#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import * as Constants from '../Constants.js';

const DEFAULT_SONG_LIST = 'songs/song-list.json';
const WIRING_MAIN = 'Main';
const WIRING_LISTENER = 'Listener';
const WIRING_OBSERVER = 'Observer';
const VALID_WIRINGS = new Set([WIRING_MAIN, WIRING_LISTENER, WIRING_OBSERVER]);

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

export function tableIDForBaseID(baseID) {
    const id = `${baseID || ''}`.trim();
    return id ? `${Constants.TABLE_ID_PREFIX}${id}` : '';
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
            const fallback = tuning?.visible !== false;
            map.set(tableID, fallback);
            pushMessage(warnings, `UserLog SongListUpdater warning: ${songJson.songName || '<unnamed song>'} has no noteTablesLayout entry for ${tableID}; using tuning.visible=${fallback}.`);
            return;
        }
        if (typeof tuning.visible === 'boolean' && tuning.visible !== map.get(tableID)) {
            pushMessage(warnings, `UserLog SongListUpdater warning: ${songJson.songName || '<unnamed song>'} ${tableID} tuning.visible=${tuning.visible} conflicts with noteTablesLayout=${map.get(tableID)}; using noteTablesLayout.`);
        }
    });

    return map;
}

export function classifyWiring(tableID, wirings = []) {
    const wiring = Array.isArray(wirings)
        ? wirings.find((entry) => entry?.tablename === tableID)
        : null;
    if (!wiring) {
        return WIRING_MAIN;
    }
    if (`${wiring.relativeSection || ''}`.trim()) {
        return WIRING_OBSERVER;
    }
    if (`${wiring.listenToTablename || ''}`.trim()) {
        return WIRING_LISTENER;
    }
    return WIRING_MAIN;
}

export function normalizeInstrumentSummary(instrument) {
    if (!instrument || typeof instrument !== 'object' || Array.isArray(instrument)) {
        return null;
    }
    const fromBaseID = `${instrument.fromBaseID || ''}`.trim();
    if (!fromBaseID) {
        return null;
    }
    const wiring = VALID_WIRINGS.has(instrument.wiring) ? instrument.wiring : WIRING_MAIN;
    return {
        fromBaseID,
        wiring,
        visible: instrument.visible !== false
    };
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
        return {
            ...entry,
            instruments
        };
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