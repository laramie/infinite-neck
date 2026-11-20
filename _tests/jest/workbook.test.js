import {
    WORKBOOK_FILE_TYPE,
    WorkbookModel,
    defaultSongBaseName,
    describeBackup,
    isBackupStale,
    parseWorkbookFile,
    sanitizeName,
    serializeWorkbookFile,
    validateFolderName,
    validateSongBaseName,
    validateSongPath,
    workbookDownloadName
} from '../../Workbook.js';
import { createMemoryAdapter } from '../../WorkbookStorage.js';

const SONG_A = JSON.stringify({ songName: 'A', sections: [{ n: 1 }] }, null, 2);
const SONG_B = JSON.stringify({ songName: 'B', sections: [{ n: 2 }] }, null, 2);

async function newModel() {
    let tick = 0;
    const adapter = createMemoryAdapter();
    const model = new WorkbookModel(adapter, { now: () => `2026-11-18T00:00:${String(tick++).padStart(2, '0')}.000Z` });
    await model.init();
    return { model, adapter };
}

describe('Workbook names', () => {
    test('folder names: space-free, cross-platform-valid', () => {
        expect(validateFolderName('DailySongs')).toEqual({ ok: true, value: 'DailySongs' });
        expect(validateFolderName('  week-1_a  ').value).toBe('week-1_a');
        const spaced = validateFolderName('Daily Songs');
        expect(spaced.ok).toBe(false);
        expect(spaced.fixable).toBe(true);
        expect(spaced.error).toMatch(/spaces/);
        expect(validateFolderName('').ok).toBe(false);
        expect(validateFolderName('a/b').ok).toBe(false);
        expect(validateFolderName('..').ok).toBe(false);
        expect(validateFolderName('.hidden').ok).toBe(false);
        expect(validateFolderName('a.b').ok).toBe(false);
        expect(validateFolderName('NUL').ok).toBe(false);
        expect(validateFolderName('com3').ok).toBe(false);
        expect(validateFolderName('x'.repeat(65)).ok).toBe(false);
        expect(validateFolderName('x'.repeat(64)).ok).toBe(true);
    });

    test('song base names accept a typed .json and single dots only', () => {
        expect(validateSongBaseName('All-Chords').value).toBe('All-Chords');
        expect(validateSongBaseName('All-Chords.json').value).toBe('All-Chords');
        expect(validateSongBaseName('v1.2-song').value).toBe('v1.2-song');
        expect(validateSongBaseName('a..b').ok).toBe(false);
        expect(validateSongBaseName('song.').ok).toBe(false);
        expect(validateSongBaseName('my song').fixable).toBe(true);
        expect(validateSongBaseName('con.txt').ok).toBe(false);
        expect(validateSongBaseName('../x').ok).toBe(false);
        expect(validateSongBaseName('é').ok).toBe(false);
    });

    test('sanitizeName always produces something the validators accept (or empty)', () => {
        for (const raw of ['My Song (2).json', '  ..weird//name ', 'ünï cödé', 'a..b', '---x', 'x.']) {
            const cleaned = sanitizeName(raw);
            if (cleaned) {
                expect(validateSongBaseName(cleaned).ok).toBe(true);
            }
        }
        expect(sanitizeName('My Song.json')).toBe('My-Song');
    });

    test('defaultSongBaseName strips the Library folder and prefers the Workbook name', () => {
        expect(defaultSongBaseName({ libraryHref: 'practice/All-Chords.json', filenameBox: 'x' })).toBe('All-Chords');
        expect(defaultSongBaseName({ workbookPath: 'DailySongs/All-Chords-C-Only.json', libraryHref: 'practice/All-Chords.json' })).toBe('All-Chords-C-Only');
        expect(defaultSongBaseName({ filenameBox: 'Round midnight' })).toBe('Round-midnight');
        expect(defaultSongBaseName({})).toBe('untitled');
    });

    test('validateSongPath: one folder level, .json required', () => {
        expect(validateSongPath('a.json')).toEqual({ ok: true, value: 'a.json' });
        expect(validateSongPath('F/a.json').ok).toBe(true);
        expect(validateSongPath('F/G/a.json').ok).toBe(false);
        expect(validateSongPath('a.txt').ok).toBe(false);
        expect(validateSongPath('F /a.json').ok).toBe(false);
        expect(validateSongPath('../a.json').ok).toBe(false);
    });

    test('download name and backup text', () => {
        expect(workbookDownloadName(new Date('2026-11-18T12:00:00Z'))).toBe('Workbook-20261118.json');
        expect(describeBackup({ lastBackupAt: null, changesSinceBackup: 0 })).toBe('Backup: never downloaded');
        expect(describeBackup({ lastBackupAt: null, changesSinceBackup: 2 })).toBe('Backup: never downloaded, 2 changes');
        expect(describeBackup({ lastBackupAt: '2026-11-10T01:00:00.000Z', changesSinceBackup: 1 })).toBe('Backup: last downloaded 2026-11-10, 1 change since');
        expect(isBackupStale({ changesSinceBackup: 4, lastBackupAt: 'x' })).toBe(false);
        expect(isBackupStale({ changesSinceBackup: 5, lastBackupAt: 'x' })).toBe(true);
        expect(isBackupStale({ changesSinceBackup: 1, lastBackupAt: null })).toBe(true);
    });
});

describe('WorkbookModel', () => {
    test('save, list in order of addition, replace keeps position and comment', async () => {
        const { model } = await newModel();
        expect((await model.addFolder('DailySongs')).ok).toBe(true);
        expect((await model.addFolder('Week2')).ok).toBe(true);
        expect((await model.saveSong({ baseName: 'zeta', text: SONG_A, source: 'practice/zeta.json' })).path).toBe('zeta.json');
        expect((await model.saveSong({ folder: 'DailySongs', baseName: 'b', text: SONG_B })).path).toBe('DailySongs/b.json');
        expect((await model.saveSong({ baseName: 'alpha', text: SONG_A })).path).toBe('alpha.json');
        expect((await model.saveSong({ folder: 'DailySongs', baseName: 'a', text: SONG_A })).path).toBe('DailySongs/a.json');
        await model.setComment('zeta.json', 'my notes');

        const again = await model.saveSong({ baseName: 'ZETA', text: SONG_B });
        expect(again).toEqual({ ok: true, path: 'ZETA.json', replaced: true });

        const view = model.getView();
        expect(view.rootSongs.map((s) => s.path)).toEqual(['ZETA.json', 'alpha.json']);
        expect(view.rootSongs[0].comment).toBe('my notes');
        expect(view.rootSongs[0].source).toBe('practice/zeta.json');
        expect(view.folders.map((f) => f.name)).toEqual(['DailySongs', 'Week2']);
        expect(view.folders[0].songs.map((s) => s.path)).toEqual(['DailySongs/b.json', 'DailySongs/a.json']);
        expect(view.songCount).toBe(4);
        expect(await model.getSongText('ZETA.json')).toBe(SONG_B);
        expect(await model.getSongText('zeta.json')).toBe(SONG_B);   // names are not case-sensitive
        expect(await model.getSongText('missing.json')).toBeNull();
    });

    test('rejects bad names, missing folders and clashes', async () => {
        const { model } = await newModel();
        expect((await model.addFolder('Daily Songs')).ok).toBe(false);
        await model.addFolder('Daily');
        expect((await model.addFolder('daily')).error).toMatch(/already exists/);
        expect((await model.saveSong({ folder: 'Nope', baseName: 'a', text: SONG_A })).ok).toBe(false);
        expect((await model.saveSong({ baseName: 'my song', text: SONG_A })).ok).toBe(false);
        expect((await model.saveSong({ baseName: 'a', text: '' })).ok).toBe(false);
    });

    test('folder: rename moves its Songs, delete only when empty', async () => {
        const { model } = await newModel();
        await model.addFolder('Old');
        await model.addFolder('Other');
        await model.saveSong({ folder: 'Old', baseName: 'a', text: SONG_A });
        await model.setComment('Old/a.json', 'c');

        expect((await model.deleteFolder('Old')).ok).toBe(false);
        expect((await model.renameFolder('Old', 'Other')).ok).toBe(false);
        expect((await model.renameFolder('Old', 'New Name')).ok).toBe(false);

        const renamed = await model.renameFolder('Old', 'New');
        expect(renamed).toEqual({ ok: true, path: 'New' });
        const view = model.getView();
        expect(view.folders.map((f) => f.name)).toEqual(['New', 'Other']);   // keeps its place in the list
        expect(view.folders[0].songs[0].path).toBe('New/a.json');
        expect(view.folders[0].songs[0].comment).toBe('c');
        expect(await model.getSongText('New/a.json')).toBe(SONG_A);
        expect(await model.getSongText('Old/a.json')).toBeNull();

        expect((await model.deleteSong('New/a.json')).ok).toBe(true);
        expect((await model.deleteFolder('New')).ok).toBe(true);
        expect(model.getView().folders.map((f) => f.name)).toEqual(['Other']);
    });

    test('a failed commit leaves the stored and in-memory Workbook as they were', async () => {
        const { model, adapter } = await newModel();
        await model.saveSong({ baseName: 'a', text: SONG_A });
        const realCommit = adapter.commit;
        adapter.commit = async () => { throw new Error('QuotaExceededError'); };
        await expect(model.saveSong({ baseName: 'b', text: SONG_B })).rejects.toThrow('QuotaExceededError');
        adapter.commit = realCommit;
        expect(model.getView().songCount).toBe(1);
        const reloaded = await new WorkbookModel(adapter).init();
        expect(reloaded.getView().songCount).toBe(1);
    });

    test('the Workbook survives a reload from the adapter', async () => {
        const { model, adapter } = await newModel();
        await model.addFolder('F');
        await model.saveSong({ folder: 'F', baseName: 'a', text: SONG_A, comment: 'hi' });
        const reloaded = await new WorkbookModel(adapter).init();
        expect(reloaded.getView().folders[0].songs[0].comment).toBe('hi');
        await reloaded.addFolder('G');   // seq counter continues
        expect(reloaded.getView().folders.map((f) => f.name)).toEqual(['F', 'G']);
    });

    test('backup counters: changes count, download resets', async () => {
        const { model } = await newModel();
        await model.addFolder('F');
        await model.saveSong({ baseName: 'a', text: SONG_A });
        await model.setComment('a.json', 'x');
        await model.setComment('a.json', 'x');   // unchanged: not a change
        expect(model.getView().meta.changesSinceBackup).toBe(3);
        await model.markBackedUp();
        expect(model.getView().meta.changesSinceBackup).toBe(0);
        expect(model.getView().meta.lastBackupAt).toBeTruthy();
    });
});

describe('Workbook file', () => {
    test('export then parse round-trips Songs verbatim, with order, folders and comments', async () => {
        const { model } = await newModel();
        await model.addFolder('Empty');
        await model.addFolder('F');
        await model.saveSong({ baseName: 'root', text: SONG_A, source: 'practice/root.json', comment: 'c1' });
        await model.saveSong({ folder: 'F', baseName: 'inF', text: SONG_B });

        const { file, text } = await model.exportFile();
        expect(file.fileType).toBe(WORKBOOK_FILE_TYPE);
        expect(file.folders).toEqual(['Empty', 'F']);
        expect(file.songs[0]).toMatchObject({ path: 'root.json', comment: 'c1', source: 'practice/root.json' });
        expect(file.songs[0].song).toEqual(JSON.parse(SONG_A));
        expect(text).toBe(serializeWorkbookFile(file));

        const parsed = parseWorkbookFile(text);
        expect(parsed.ok).toBe(true);
        expect(parsed.songs.map((s) => s.text)).toEqual([SONG_A, SONG_B]);

        const other = (await newModel()).model;
        await other.saveSong({ baseName: 'old', text: SONG_A });
        await other.replaceFromParsed(parsed);
        const view = other.getView();
        expect(view.rootSongs.map((s) => s.path)).toEqual(['root.json']);
        expect(view.folders.map((f) => f.name)).toEqual(['Empty', 'F']);
        expect(view.meta.changesSinceBackup).toBe(0);
        expect(await other.getSongText('F/inF.json')).toBe(SONG_B);
        expect(await other.getSongText('old.json')).toBeNull();
    });

    function wrap(overrides = {}) {
        return JSON.stringify({ fileType: WORKBOOK_FILE_TYPE, workbookVersion: 1, folders: [], songs: [], ...overrides });
    }

    test('rejects what is not a Workbook, with a clear message', () => {
        expect(parseWorkbookFile('not json').error).toMatch(/not valid JSON/);
        expect(parseWorkbookFile(JSON.stringify({ sections: [], myTunings: [] })).error).toMatch(/Song file/);
        expect(parseWorkbookFile('[]').error).toMatch(/not a Workbook/);
        expect(parseWorkbookFile(wrap({ workbookVersion: 2 })).error).toMatch(/version/);
    });

    test('validates untrusted names, duplicates, shapes and limits', () => {
        const song = { sections: [] };
        expect(parseWorkbookFile(wrap({ folders: ['Bad Name'] })).ok).toBe(false);
        expect(parseWorkbookFile(wrap({ folders: ['A', 'a'] })).error).toMatch(/twice/);
        expect(parseWorkbookFile(wrap({ songs: [{ path: '../x.json', song }] })).ok).toBe(false);
        expect(parseWorkbookFile(wrap({ songs: [{ path: 'a/b/c.json', song }] })).ok).toBe(false);
        expect(parseWorkbookFile(wrap({ songs: [{ path: 'a.json', song }, { path: 'A.json', song }] })).error).toMatch(/twice/);
        expect(parseWorkbookFile(wrap({ songs: [{ path: 'a.json', song: 'text' }] })).ok).toBe(false);
        expect(parseWorkbookFile(wrap({ songs: [{ path: 'a.json', song: [] }] })).ok).toBe(false);
        expect(parseWorkbookFile(wrap({ songs: ['a.json'] })).ok).toBe(false);
        expect(parseWorkbookFile(wrap({ folders: 'x' })).ok).toBe(false);
        const many = Array.from({ length: 1001 }, (_, i) => ({ path: `s${i}.json`, song }));
        expect(parseWorkbookFile(wrap({ songs: many })).error).toMatch(/Too many/);
    });

    test('a folder used by a Song but missing from "folders" is added; comments are plain text and capped', () => {
        const parsed = parseWorkbookFile(wrap({
            songs: [{ path: 'Week1/a.json', comment: 'x'.repeat(5000), source: 5, song: { sections: [] } }]
        }));
        expect(parsed.ok).toBe(true);
        expect(parsed.folders).toEqual(['Week1']);
        expect(parsed.songs[0].comment.length).toBe(2000);
        expect(parsed.songs[0].source).toBe('');
    });

    test('__proto__ keys inside a Song stay data and do not pollute', () => {
        const text = '{"fileType":"infinite-neck-workbook","workbookVersion":1,"songs":[{"path":"a.json","song":{"__proto__":{"polluted":true},"sections":[]}}]}';
        const parsed = parseWorkbookFile(text);
        expect(parsed.ok).toBe(true);
        expect({}.polluted).toBeUndefined();
    });
});
