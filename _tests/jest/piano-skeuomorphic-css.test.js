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
});