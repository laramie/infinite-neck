import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCourseWorkbook, checkDescriptionHtml, parseMarkerFile } from '../../bin/build-tutorial-workbook.js';
import { buildWorkbookListEntry } from '../../bin/update-song-list.js';
import { parseWorkbookFile } from '../../Workbook.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function writeFile(root, relative, content) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content));
}

const SONG = {
    songName: 'x',
    tutorial: { level: 'strict', caption: 'Cap' },
    sections: [{}, {}],
    myTunings: [{ baseID: 'S1_a', fromBaseID: 'S1' }],
    noteTablesLayout: [{ tableID: 'tblS1_a', visible: true }]
};

describe('build-tutorial-workbook', () => {
    let root;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-build-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    test('bundles lessons into folders, in name order, with captions, descriptions, id, version and sources', () => {
        writeFile(root, 'lib/C1-test/course.html', '<h1 data-caption-for-course data-version="2.5">The course</h1><div data-description-for-course><p>Hello <a href="#open=L2-b/b.json">b</a></p></div>');
        writeFile(root, 'lib/C1-test/L2-b/lesson.html', '<h1 data-caption-for-lesson>Second</h1>');
        writeFile(root, 'lib/C1-test/L2-b/b.json', SONG);
        writeFile(root, 'lib/C1-test/L1-a/a2.json', SONG);
        writeFile(root, 'lib/C1-test/L1-a/a1.json', SONG);
        writeFile(root, 'lib/C1-test/L3-empty/notes.txt', 'no songs here');

        const built = buildCourseWorkbook(path.join(root, 'lib/C1-test'), { libraryRoot: path.join(root, 'lib') });
        expect(built.errors).toEqual([]);
        expect(built.songCount).toBe(3);
        expect(built.lessonCount).toBe(2);

        const parsed = parseWorkbookFile(built.text);
        expect(parsed.ok).toBe(true);
        expect(parsed.info).toMatchObject({ id: 'C1-test', version: '2.5', caption: 'The course', suggestedMount: 'tutorial' });
        expect(parsed.info.description).toContain('#open=L2-b/b.json');
        expect(parsed.folders.map((f) => f.name)).toEqual(['L1-a', 'L2-b']);
        expect(parsed.folders[1].caption).toBe('Second');
        expect(parsed.songs.map((s) => s.path)).toEqual(['L1-a/a1.json', 'L1-a/a2.json', 'L2-b/b.json']);
        expect(parsed.songs[0]).toMatchObject({ tutorial: 'strict', SectionCount: 2, caption: 'Cap' });
        const file = JSON.parse(built.text);
        expect(file.savedAt).toBe('');
        expect(file.songs[0].source).toBe('C1-test/L1-a/a1.json');
    });

    test('is deterministic, so --check can compare', () => {
        writeFile(root, 'C2/L1/a.json', SONG);
        const first = buildCourseWorkbook(path.join(root, 'C2'), { libraryRoot: root });
        const second = buildCourseWorkbook(path.join(root, 'C2'), { libraryRoot: root });
        expect(first.text).toBe(second.text);
        expect(first.warnings.join(' ')).toMatch(/no course\.html/);
    });

    test('a course with no Songs produces no file; bad ids and bad descriptions are errors', () => {
        writeFile(root, 'C3/L1/lesson.html', '<h1 data-caption-for-lesson>x</h1>');
        expect(buildCourseWorkbook(path.join(root, 'C3'), { libraryRoot: root }).text).toBeNull();

        writeFile(root, 'bad id/L1/a.json', SONG);
        expect(buildCourseWorkbook(path.join(root, 'bad id'), { libraryRoot: root }).errors.join(' ')).toMatch(/Workbook id/);

        writeFile(root, 'C4/course.html', '<h1 data-caption-for-course>c</h1><div data-description-for-course><script>x</script><a href="https://evil.example/">e</a></div>');
        writeFile(root, 'C4/L1/a.json', SONG);
        const errors = buildCourseWorkbook(path.join(root, 'C4'), { libraryRoot: root }).errors.join(' ');
        expect(errors).toMatch(/<script> is not allowed/);
        expect(errors).toMatch(/link "https:\/\/evil\.example\/" is not allowed/);
    });

    test('invalid Song JSON is an error naming the file', () => {
        writeFile(root, 'C5/L1/a.json', '{ not json');
        const built = buildCourseWorkbook(path.join(root, 'C5'), { libraryRoot: root });
        expect(built.errors.join(' ')).toMatch(/L1\/a\.json: not valid JSON/);
    });

    test('parseMarkerFile and checkDescriptionHtml', () => {
        const parsed = parseMarkerFile('<h1 data-caption-for-course data-version="3"> A  B </h1>', 'course', 'x');
        expect(parsed).toMatchObject({ caption: 'A B', version: '3', description: '' });
        expect(parseMarkerFile('<h1 data-caption-for-lesson>a</h1><h2 data-caption-for-lesson>b</h2>', 'lesson', 'x').errors.join(' ')).toMatch(/duplicate caption/);
        expect(checkDescriptionHtml('<p>fine <b>x</b> <a href="#open=a.json">a</a></p>', 'x')).toEqual([]);
    });
});

describe('Library Workbook files', () => {
    test('buildWorkbookListEntry counts Songs and lessons and unions instruments', () => {
        const file = {
            fileType: 'infinite-neck-workbook', workbookVersion: 2, id: 'C9', version: '1', caption: 'Nine <b>', folders: [{ name: 'L1' }, { name: 'L2' }],
            songs: [
                { path: 'L1/a.json', song: { ...SONG } },
                { path: 'L2/b.json', song: { ...SONG, noteTablesLayout: [{ tableID: 'tblS1_a', visible: false }] } },
                { path: 'root.json', song: { sections: [] } }
            ]
        };
        const { entry, error } = buildWorkbookListEntry({ href: 'tutorials/C9.workbook.json', kind: 'workbook', tutorial: 'strict', SectionCount: 4 }, file);
        expect(error).toBeUndefined();
        expect(entry).toMatchObject({ workbookId: 'C9', workbookVersion: '1', songCount: 3, lessonCount: 2 });
        expect(entry.description).toBe('<b>Nine &lt;b&gt;</b>: 3 songs in 2 lessons');
        expect(entry.instruments).toEqual([{ fromBaseID: 'S1', wiring: 'Main', visible: true }]);   // visible if any Song shows it
        expect(entry).not.toHaveProperty('tutorial');
        expect(entry).not.toHaveProperty('SectionCount');
        expect(buildWorkbookListEntry({ href: 'x.workbook.json' }, { fileType: 'nope' }).error).toMatch(/not a Workbook/);
    });

    test('every kind:"workbook" entry of songs/song-list.json opens, and is up to date with its file', () => {
        const list = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'songs/song-list.json'), 'utf8'));
        const workbooks = list.songs.filter((entry) => entry && entry.kind === 'workbook');
        expect(workbooks.length).toBeGreaterThan(0);
        workbooks.forEach((entry) => {
            expect(entry.href).toMatch(/\.workbook\.json$/);
            const file = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'songs', entry.href), 'utf8'));
            const built = buildWorkbookListEntry(entry, file);
            expect(built.error).toBeUndefined();
            expect(built.entry).toEqual(entry);
        });
    });
});
