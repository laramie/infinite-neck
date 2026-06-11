import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pianoCssPath = path.resolve(__dirname, '../../templates/piano/piano-skeuomorphic.css');

describe('piano skeuomorphic note lane visibility css', () => {
    test('keeps ordinary named notes hidden until replay colors them', () => {
        const css = fs.readFileSync(pianoCssPath, 'utf8');

        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteWhiteKey .namedNote:not(.NamedNoteActive) {\n    color: transparent;\n}');
        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteBlackKey .namedNote:not(.NamedNoteActive) {\n    color: transparent;\n}');
        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteWhiteKey .universalNamedNote {\n    color: #241c13;\n}');
        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteBlackKey .universalNamedNote {\n    color: #f8f2de;\n}');
    });

    test('raises white piano keys for overlaid fingering and uses a controllable base width', () => {
        const css = fs.readFileSync(pianoCssPath, 'utf8');

        expect(css).toContain('--piano-white-key-width: 50px;');
        expect(css).toContain('--piano-white-to-black-width-ratio: 2.3;');
        expect(css).toContain('--piano-black-key-width: calc(var(--piano-white-key-width) / var(--piano-white-to-black-width-ratio));');
        expect(css).toContain('--piano-face-horizontal-gap: max(4px, calc(var(--note-padding) * 0.45), calc(var(--cell-spacing) * 0.75));');
        expect(css).toContain('--piano-white-face-side-gap: var(--piano-face-horizontal-gap);');
        expect(css).toContain('--piano-black-face-side-gap: max(2px, calc(var(--piano-face-horizontal-gap) * 0.70));');
        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteWhiteKey.OverlayRaisedForPiano {\n    z-index: 7;\n}');
    });

    test('centers piano midi numbers and retunes only the nested centered lane layout', () => {
        const css = fs.readFileSync(pianoCssPath, 'utf8');

        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteWhiteKey .midinumDisplayNamedNote,');
        expect(css).toContain('transform: translateX(-50%);');
        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteBlackKey .singleNote > .CenterCell > .CenterCell,');
        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteWhiteKey .singleNote > .CenterCell > .CenterCell,');
        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteWhiteKey .singleNote > .CenterCell,');
        expect(css).toContain('position: absolute;');
        expect(css).toContain('top: calc(100% * var(--piano-black-key-height));');
    });

    test('centers ordinary piano tiny notes without changing bend placement', () => {
        const css = fs.readFileSync(pianoCssPath, 'utf8');

        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteWhiteKey .tinyNote:not(.tinyNotePlayedBend),');
        expect(css).toContain('table.fretTable.pianoSkeuomorphicTable td.note.noteBlackKey .tinyNote:not(.tinyNotePlayedBend) {');
        expect(css).toContain('left: 50%;');
        expect(css).toContain('transform: translateX(-50%);');
    });
});