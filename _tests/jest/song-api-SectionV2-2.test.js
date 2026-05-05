import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import { Song } from '../../Song.js';
import {
    setupSongTests,
    getSong
} from '../../infinite-neck-headless.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_SONG_FILENAME = 'All-Chords.json';

function getSongPath(songFilename = PRIMARY_SONG_FILENAME) {
    return path.join(__dirname, '../../songs', songFilename);
}

function readSongJson(songFilename = PRIMARY_SONG_FILENAME) {
    return JSON.parse(fs.readFileSync(getSongPath(songFilename), 'utf8'));
}

function loadPrimarySongForApiTests() {
    const data = readSongJson(PRIMARY_SONG_FILENAME);

    setupSongTests();
    const song = new Song(data);
    song.setHeadless(true, true);
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();

    return { data, song };
}

test('cycleThruKeysAllSections transposes each section rootID with wrap', () => {
    const { data, song } = loadPrimarySongForApiTests();

    expect(Array.isArray(data.sections)).toBe(true);
    expect(song.getSections().length).toBe(data.sections.length);

    const before = song.getSections().map((section) => {
        const n = Number.parseInt(section.rootID, 10);
        return Number.isNaN(n) ? 0 : n;
    });

    song.cycleThruKeysAllSections(2);

    const after = song.getSections().map((section) => Number.parseInt(section.rootID, 10));
    const expected = before.map((n) => (12 + n + 2) % 12);

    expect(after).toEqual(expected);
});