import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Song } from '../../Song.js';
import { BUILTIN_SETS } from '../../templates/function-symbols/functionSymbolSets.js';
import { migrateText } from '../../bin/migrate-function-symbols.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_FILE = path.join(__dirname, '../../songs/tests/display-options.json');

const twelve = (prefix = 's') => Array.from({ length: 12 }, (_, i) => `${prefix}${i + 1}`);

function makeSong(extra = {}) {
    const data = { ...JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8')), ...extra };
    const song = new Song(data);
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();
    song.setHeadless(true, true);
    return song;
}

describe('Song.functionSymbolSets persistence', () => {
    test('defaults to an empty array and is not written when empty', () => {
        const song = makeSong();
        expect(song.functionSymbolSets).toEqual([]);
        expect(JSON.parse(song.getPersistentSongFile())).not.toHaveProperty('functionSymbolSets');
    });

    test('round trips valid User sets', () => {
        const song = makeSong({ functionSymbolSets: [{ id: 'u-mine', caption: 'U: Mine', symbols: twelve() }] });
        const saved = JSON.parse(song.getPersistentSongFile());
        expect(saved.functionSymbolSets).toEqual([{ id: 'u-mine', caption: 'U: Mine', symbols: twelve() }]);

        const reloaded = makeSong({ functionSymbolSets: saved.functionSymbolSets });
        expect(reloaded.functionSymbolSets).toEqual(saved.functionSymbolSets);
    });

    test('drops invalid, duplicate and built-in-id entries on load', () => {
        const song = makeSong({
            functionSymbolSets: [
                { id: 'u-ok', caption: 'U: OK', symbols: twelve() },
                { id: 'u-ok', caption: 'U: Dup', symbols: twelve() },
                { id: 'jazz', caption: 'U: Not user id', symbols: twelve() },
                { id: 'u-bad', caption: 'U: Bad', symbols: twelve().map((s, i) => (i === 0 ? '<script>' : s)) },
                { id: 'u-short', caption: 'U: Short', symbols: ['a', 'b'] },
                null,
            ],
        });
        expect(song.functionSymbolSets.map((set) => set.id)).toEqual(['u-ok']);
    });

    test('noteNamesFuncArr is still not persisted', () => {
        const song = makeSong();
        song.noteNamesFuncArr = [...BUILTIN_SETS[0].symbols];
        expect(JSON.parse(song.getPersistentSongFile())).not.toHaveProperty('noteNamesFuncArr');
    });
});

describe('migrateText', () => {
    const oldBlock = (set) => `"dropDownFunctionSymbols": { "caption": "x", "value": ${JSON.stringify(JSON.stringify(set.symbols))} }`;

    test('every built-in set maps to its id', () => {
        BUILTIN_SETS.forEach((set) => {
            const result = migrateText(`{ ${oldBlock(set)} }`);
            expect(result.unmatched).toEqual([]);
            expect(result.replaced).toBe(1);
            expect(JSON.parse(result.text)).toEqual({ functionSymbols: set.id });
        });
    });

    test('unmatched value is reported and left alone', () => {
        const text = `{ "dropDownFunctionSymbols": { "caption": "x", "value": "[\\"nope\\"]" } }`;
        const result = migrateText(text);
        expect(result.replaced).toBe(0);
        expect(result.unmatched).toHaveLength(1);
        expect(result.text).toBe(text);
    });

    test('handles the escaped copy inside a JSON string and is idempotent', () => {
        const inner = `{ ${oldBlock(BUILTIN_SETS[0])} }`;
        const text = JSON.stringify({ json: inner });
        const first = migrateText(text);
        expect(first.replaced).toBe(1);
        expect(JSON.parse(JSON.parse(first.text).json)).toEqual({ functionSymbols: BUILTIN_SETS[0].id });
        const second = migrateText(first.text);
        expect(second.replaced).toBe(0);
        expect(second.text).toBe(first.text);
    });
});
