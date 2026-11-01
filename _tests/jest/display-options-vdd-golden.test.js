// Sprint 148 it5: pins the exact /vdd HTML so the shared cell rules (displayOptionsMatrixView.js) cannot change it.
// To regenerate after an intentional /vdd change:  UPDATE_VDD_GOLDEN=1 node --experimental-vm-modules node_modules/.bin/jest _tests/jest/display-options-vdd-golden.test.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Song } from '../../Song.js';
import { displayOptionsTable, setDisplayOptionsProviders } from '../../display-options.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, '../../songs/tests/display-options.json');
const GOLDEN = path.join(here, 'golden/vdd-table.golden.html');

function scenario() {
    const song = new Song(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();
    song.setHeadless(true, true);
    setDisplayOptionsProviders({ getSong: () => song });
    song.sections[0].displayOptions = {
        noteFont: '<b>Cardo</b>', showMidiNum: true, autoColor: false, hideTinyNotes: false,
        NoteDisplaySizes: { width: '40px', height: '30px', NoteFontSize: 12, caption: 'Big' }
    };
    song.sections[1].displayOptions = { noteFont: '<b>Cardo</b>', showMidiNum: false, tinyNoteWidth: '35%' };
    song.sections[2].displayOptions = { hideTinyNotes: true };
    song.displayOptionGates = { readBlocked: ['noteFont'], writeBlocked: ['showMidiNum'] };
    song.sections[1].displayOptionGates = { writeBlocked: ['*'], readBlocked: ['tinyNoteWidth'] };
    song.sections[2].displayOptionGates = { readBlocked: ['hideTinyNotes', 'autoColor'], writeBlocked: ['hideTinyNotes'] };
    return song;
}

describe('/vdd golden output', () => {
    test('matches the pinned HTML byte for byte', () => {
        scenario();
        const html = displayOptionsTable();
        if (process.env.UPDATE_VDD_GOLDEN) {
            fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
            fs.writeFileSync(GOLDEN, html);
        }
        expect(html).toBe(fs.readFileSync(GOLDEN, 'utf8'));
    });

    test('plain Sections are skipped with the dashed marker', () => {
        const song = scenario();
        delete song.sections[1].displayOptions;
        delete song.sections[1].displayOptionGates;
        const html = displayOptionsTable();
        expect(html).toContain('dashed orange');
    });
});
