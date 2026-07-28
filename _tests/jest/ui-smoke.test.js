import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Song } from '../../Song.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const FIXTURE_FILE = path.join(__dirname, '../../songs/tests/display-options.json');


function readFixture() {
    return JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8'));
}

describe('Headless UI smoke contracts', () => {
    test('display-options fixture can navigate sections, loop, and save without throwing', () => {
        expect(() => {
            const data = readFixture();
            const song = new Song(data);
            song.ensureDefaultSection();
            song.fixupCurrentIndexForLoadedSong();
            song.setHeadless(true, true);

            song.gotoSection(0);
            song.gotoNextSection(true);
            song.gotoNextSection(true);
            song.gotoPrevSection(true);
            song.gotoSection(2);

            song.prepareForSave({
                songName: data.songName,
                theme: data.theme,
                bpm: parseInt(data.defaultBPM, 10),
                userColors: data.userColors
            });

            const savedObj = JSON.parse(JSON.stringify(song));
            expect(savedObj.sections).toHaveLength(3);
            savedObj.sections.forEach((section) => {
                expect(section).toHaveProperty('displayOptions');
            });
        }).not.toThrow();
    });
});
