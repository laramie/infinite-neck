import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Song } from '../../Song.js';
import { displayOptionsTable, setDisplayOptionsProviders } from '../../display-options.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, '../../songs/tests/display-options.json');

function load() {
    const song = new Song(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();
    song.setHeadless(true, true);
    setDisplayOptionsProviders({ getSong: () => song });
    return song;
}

describe('/vdd displayOptionsTable (static Matrix columns)', () => {
    test('has a column per DisplayOptions key even when no control provider exists', () => {
        load();
        const html = displayOptionsTable();
        expect(html).toContain("<span><span class='dmKeyName'>autoColor");
        expect(html).toContain("<span><span class='dmKeyName'>tinyNoteRadius");
        expect(html).toContain("<span><span class='dmKeyName'>sectionTheme");
        expect((html.match(/<tr>/g) || []).length).toBe(4); // header + the fixture's 3 Sections
    });

    test('sparse rows: only stored cells are filled, the rest are dark gray', () => {
        const song = load();
        song.sections.forEach((s) => { s.displayOptions = { noteFont: 'Cardo' }; });
        song.sections[1].displayOptions = { noteFont: 'Cardo', showMidiNum: true };
        const html = displayOptionsTable();
        expect(html).toContain('background-color: #303030');
        // Section 2's noteFont repeats the inherited value -> white; its showMidiNum is new -> green
        const row2 = html.split('<tr>')[3];
        expect(row2).toContain("background-color: white;'>Cardo");
        expect(row2).toContain("background-color: chartreuse;'>\u2713");
    });

    test('gate marks appear for column, row and cell gates; values are escaped', () => {
        const song = load();
        song.sections[0].displayOptions = { noteFont: '<b>x</b>' };
        song.displayOptionGates = { readBlocked: ['noteFont'], writeBlocked: ['showMidiNum'] };
        song.sections[1].displayOptionGates = { writeBlocked: ['*'] };
        song.sections[2].displayOptionGates = { readBlocked: ['hideTinyNotes'] };
        const html = displayOptionsTable();
        expect(html).toContain('Song column gates');
        // the literal row:/col:/cell: text is off (WANT_LITERAL_ROWMARK_TEXT etc.); gates are shown by classes instead
        expect(html).not.toMatch(/col:[rw]/);
        expect(html).not.toMatch(/row:[rw]/);
        expect(html).not.toContain('cell:');
        expect(html).toContain("<th class='vertical-header gateRead'>");
        expect(html).toContain("<th class='vertical-header gateWrite'>");
        expect(html).toContain("<td class='gateWrite'>2</td>");
        expect(html).toContain('cellGateRead');
        expect(html).not.toContain('cellGateWrite');
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
        expect(html).not.toContain('<b>x</b>');
    });

    test('an adapter-gated key shows its hint as its own line beside the name, not a superscript', () => {
        const song = load();
        song.presentationMode = false;
        const html = displayOptionsTable();
        expect(html).toContain("<span class='dmKeyName'>NoteDisplaySizes</span><span class='dmKeyHint' title='a:presentationMode'>a:presentationMode</span>");
        expect(html).not.toContain('<sup');
    });

    test('a Section with only a gate gets a row; a plain Section is skipped with a dashed marker after it', () => {
        const song = load();
        song.sections.forEach((s) => { delete s.displayOptions; });
        song.sections[2].displayOptionGates = { readBlocked: ['*'] };
        const html = displayOptionsTable();
        expect((html.match(/<tr>/g) || []).length).toBe(2);
        expect(html).toContain('dashed orange');
    });
});
