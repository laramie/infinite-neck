import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Sprint 150 Iteration 2: the palette template files live in templates/palette/ (like templates/display-options/).
// Non-browser guard: the files are where the loaders and imports say they are.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

describe('templates/palette/ layout', () => {
    test('the three palette files are in templates/palette/ and the old paths are gone', () => {
        ['palette.builder.js', 'palette.css', 'palette.html'].forEach((f) => {
            expect(exists(`templates/palette/${f}`)).toBe(true);
            expect(exists(`templates/${f}`)).toBe(false);
        });
    });

    test('index.html links the css, infinite-neck.js imports the builder and loads the template from the new folder', () => {
        expect(read('index.html')).toContain('href="templates/palette/palette.css"');
        const main = read('infinite-neck.js');
        expect(main).toContain("from './templates/palette/palette.builder.js'");
        expect(main).toContain("loadTemplates('templates/palette/palette.html')");
        expect(read('index.html')).not.toMatch(/templates\/palette\.css/);
        expect(main).not.toMatch(/templates\/palette\.(html|builder\.js)/);
    });

    test('every relative import of palette.builder.js resolves', () => {
        const dir = path.join(root, 'templates/palette');
        const specs = [...read('templates/palette/palette.builder.js').matchAll(/from\s+'(\.[^']+)'/g)].map((m) => m[1]);
        expect(specs.length).toBeGreaterThan(0);
        specs.forEach((spec) => expect(fs.existsSync(path.join(dir, spec))).toBe(true));
    });

    test('palette.html still carries the template and the Stylesheet controls the builder binds', () => {
        const html = read('templates/palette/palette.html');
        ["id='palette-template'", 'id="palette"', 'id="btnRecordUserColors"', 'id="btnRecordUserColorsFromSection"',
            'id="txtColorSchemeName"', 'id="divColorDictsDest"', 'id="UserColorsEditorDest"'].forEach((frag) => {
            expect(html).toContain(frag);
        });
    });

    test('bin/print-control-defaults.js reads the moved palette.html (it skips missing files silently)', () => {
        expect(read('bin/print-control-defaults.js')).toContain("'templates/palette/palette.html'");
    });
});
