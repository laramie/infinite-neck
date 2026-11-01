import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Song } from '../../Song.js';
import { SongPersistence } from '../../SongPersistence.js';
import { Section } from '../../Section.js';
import { validateSongFileSchema as validateSongFile } from '../../bin/song-file-schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, '../../songs/tests/display-options.json');

function load(extra = {}) {
    const data = { ...JSON.parse(fs.readFileSync(FIXTURE, 'utf8')), ...extra };
    const song = new Song(data);
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();
    song.setHeadless(true, true);
    return song;
}

function saved(song) {
    return JSON.parse(JSON.stringify(song, SongPersistence.persistentSongFileReplacer));
}

describe('displayOptionGates persistence', () => {
    test('absent gates stay absent (no empty field is written)', () => {
        const song = load();
        expect('displayOptionGates' in song).toBe(false);
        expect('displayOptionGates' in song.sections[0]).toBe(false);
        const out = saved(song);
        expect(out.displayOptionGates).toBeUndefined();
        expect(out.sections[0].displayOptionGates).toBeUndefined();
    });

    test('Song and Section gates are normalized on load and round-trip', () => {
        const data = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
        data.displayOptionGates = { readBlocked: ['noteFont', 'bogus', 'noteFont'], writeBlocked: [] };
        data.sections[1].displayOptionGates = { writeBlocked: ['*', 'showMidiNum'] };
        const song = new Song(data);
        expect(song.displayOptionGates).toEqual({ readBlocked: ['noteFont'] });
        expect(song.sections[1].displayOptionGates).toEqual({ writeBlocked: ['*', 'showMidiNum'] });
        const out = saved(song);
        expect(out.displayOptionGates).toEqual({ readBlocked: ['noteFont'] });
        expect(out.sections[1].displayOptionGates).toEqual({ writeBlocked: ['*', 'showMidiNum'] });
        const again = new Song(out);
        expect(again.sections[1].displayOptionGates).toEqual({ writeBlocked: ['*', 'showMidiNum'] });
    });

    test('Section.clone: deep keeps displayOptions and gates; shallow drops displayOptions but keeps gates', () => {
        const section = new Section({ displayOptions: { noteFont: 'Cardo' }, displayOptionGates: { readBlocked: ['*'] } });
        const deep = section.clone(true);
        expect(deep.displayOptions).toEqual({ noteFont: 'Cardo' });
        expect(deep.displayOptionGates).toEqual({ readBlocked: ['*'] });
        const shallow = section.clone(false);
        expect(shallow.displayOptions).toBeUndefined();
        expect(shallow.displayOptionGates).toEqual({ readBlocked: ['*'] });
    });

    test('schema accepts good gates and rejects unknown keys', () => {
        const good = saved(load());
        good.displayOptionGates = { readBlocked: ['noteFont'] };
        good.sections[0].displayOptionGates = { readBlocked: ['*', 'noteFont'] };
        expect(validateSongFile(good).valid).toBe(true);
        good.displayOptionGates = { readBlocked: ['*'] };
        expect(validateSongFile(good).valid).toBe(false);
    });
});
