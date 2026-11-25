import {
    WORKBOOK_FILE_TYPE,
    WorkbookModel,
    applyLedgerToParsed,
    buildWorkbookFile,
    clearProgressLedger,
    deriveSongSummary,
    isLibraryWorkbookHref,
    ledgerFromEntries,
    mountDbName,
    mountIdFromFileName,
    normalizeWorkbookInfo,
    parseWorkbookFile,
    readMountRegistry,
    readProgressLedger,
    sanitizeName,
    serializeWorkbookFile,
    uniqueMountId,
    validateSongBaseName,
    workbookDownloadName,
    writeMountRegistry,
    writeProgressLedger
} from '../../Workbook.js';
import { createMemoryAdapter } from '../../WorkbookStorage.js';
import { extractInstrumentSummaries } from '../../bin/update-song-list.js';

const SONG = {
    songName: 'S',
    tutorial: { level: 'strict', caption: 'Plain caption' },
    sections: [{}, {}, {}],
    myTunings: [{ baseID: 'S1_a', fromBaseID: 'S1' }, { baseID: 'Nolineage' }],
    noteTablesLayout: [{ tableID: 'tblS1_a', visible: true }, { tableID: 'tblNolineage', visible: false }]
};
const SONG_TEXT = JSON.stringify(SONG, null, 2);

function fakeStorage() {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => { store.set(key, value); },
        removeItem: (key) => { store.delete(key); },
        store
    };
}

async function newModel() {
    const adapter = createMemoryAdapter();
    const model = new WorkbookModel(adapter, { now: () => '2026-11-18T00:00:00.000Z' });
    await model.init();
    return { model, adapter };
}

describe('Workbook info (id, version, caption, description)', () => {
    test('normalizeWorkbookInfo validates id and version, trims captions, caps description', () => {
        const ok = normalizeWorkbookInfo({ id: 'C100-cowboy', version: '2.1', caption: '  A\n caption  ', description: '<p>x</p>', suggestedMount: 'tutorial' });
        expect(ok).toEqual({ ok: true, info: { id: 'C100-cowboy', version: '2.1', caption: 'A caption', description: '<p>x</p>', suggestedMount: 'tutorial' } });
        expect(normalizeWorkbookInfo({}).info).toEqual({ id: '', version: '', caption: '', description: '', suggestedMount: '' });
        expect(normalizeWorkbookInfo({ id: 'bad id!' }).ok).toBe(false);
        expect(normalizeWorkbookInfo({ id: '../x' }).ok).toBe(false);
        expect(normalizeWorkbookInfo({ version: 'a b' }).ok).toBe(false);
        expect(normalizeWorkbookInfo({ version: 3 }).info.version).toBe('3');
        expect(normalizeWorkbookInfo({ suggestedMount: 'elsewhere' }).info.suggestedMount).toBe('');
        expect(normalizeWorkbookInfo({ description: 'x'.repeat(30000) }).info.description.length).toBe(20000);
        expect(normalizeWorkbookInfo({ caption: 'c'.repeat(500) }).info.caption.length).toBe(200);
    });

    test('a sanitizer is applied to descriptions when parsing', () => {
        const text = JSON.stringify({
            fileType: WORKBOOK_FILE_TYPE, workbookVersion: 2, description: '<script>x</script>',
            folders: [{ name: 'F', description: '<b>y</b>' }], songs: []
        });
        const parsed = parseWorkbookFile(text, { sanitizeHtml: (html) => html.replace(/<script>.*<\/script>/g, '') });
        expect(parsed.info.description).toBe('');
        expect(parsed.folders[0].description).toBe('<b>y</b>');
    });

    test('names ending in .workbook are reserved, so a Song cannot look like a Workbook file', () => {
        const result = validateSongBaseName('my.workbook');
        expect(result.ok).toBe(false);
        expect(result.fixable).toBe(true);
        expect(sanitizeName('my.workbook.json')).toBe('my-workbook');
        expect(validateSongBaseName(sanitizeName('my.workbook')).ok).toBe(true);
    });

    test('download name uses the id when there is one', () => {
        expect(workbookDownloadName(new Date('2026-01-02T00:00:00Z'), 'C200-blues')).toBe('C200-blues.workbook.json');
        expect(workbookDownloadName(new Date('2026-01-02T00:00:00Z'), 'bad id')).toBe('Workbook-20260102.workbook.json');
    });
});

describe('derived Song summary', () => {
    test('caption, instruments (with (unknown)), SectionCount, tutorial level', () => {
        expect(deriveSongSummary(SONG)).toEqual({
            caption: 'Plain caption',
            instruments: [
                { fromBaseID: 'S1', wiring: 'Main', visible: true },
                { fromBaseID: '(unknown)', wiring: 'Main', visible: false }
            ],
            SectionCount: 3,
            tutorial: 'strict'
        });
        expect(deriveSongSummary(null)).toEqual({ caption: '', instruments: [], SectionCount: 0, tutorial: '' });
    });

    test('the App and the Library build give the same instruments for the same Song', () => {
        expect(deriveSongSummary(SONG).instruments).toEqual(extractInstrumentSummaries(SONG, []));
    });

    test('saving a Song caches the summary on the entry; a file never overrides it', async () => {
        const { model } = await newModel();
        await model.saveSong({ baseName: 's', text: SONG_TEXT });
        const entry = model.getEntry('s.json');
        expect(entry).toMatchObject({ caption: 'Plain caption', SectionCount: 3, tutorial: 'strict' });
        expect(entry.instruments).toHaveLength(2);

        const { text } = await model.exportFile();
        const edited = JSON.parse(text);
        edited.songs[0].caption = 'LIE';
        edited.songs[0].instruments = [{ fromBaseID: 'LIE', wiring: 'Main', visible: true }];
        edited.songs[0].SectionCount = 99;
        const parsed = parseWorkbookFile(JSON.stringify(edited));
        expect(parsed.songs[0]).toMatchObject({ caption: 'Plain caption', SectionCount: 3 });
        expect(parsed.songs[0].instruments[0].fromBaseID).toBe('S1');
    });
});

describe('file format v2', () => {
    test('round trip keeps info and folder captions; model getView exposes them', async () => {
        const { model } = await newModel();
        await model.addFolder('L1');
        await model.saveSong({ folder: 'L1', baseName: 's', text: SONG_TEXT });
        expect((await model.setWorkbookInfo({ id: 'C9-test', version: '3', caption: 'Nine', description: '<p>d</p>' })).changed).toBe(true);
        expect((await model.setFolderInfo('L1', { caption: 'Lesson one', description: '<p>l</p>' })).changed).toBe(true);

        const view = model.getView();
        expect(view.info).toMatchObject({ id: 'C9-test', version: '3', caption: 'Nine' });
        expect(view.folders[0]).toMatchObject({ caption: 'Lesson one', description: '<p>l</p>' });

        const { file, text } = await model.exportFile();
        expect(file).toMatchObject({ workbookVersion: 2, id: 'C9-test', version: '3', caption: 'Nine' });
        expect(file.folders[0]).toEqual({ name: 'L1', caption: 'Lesson one', description: '<p>l</p>' });

        const parsed = parseWorkbookFile(text);
        expect(parsed.ok).toBe(true);
        const other = (await newModel()).model;
        await other.replaceFromParsed(parsed);
        expect(other.getView().info).toMatchObject({ id: 'C9-test', version: '3' });
        expect(other.getView().folders[0].caption).toBe('Lesson one');
        expect(other.getView().meta.changesSinceBackup).toBe(0);
    });

    test('version 1 files (folders as bare names) still open', () => {
        const parsed = parseWorkbookFile(JSON.stringify({ fileType: WORKBOOK_FILE_TYPE, workbookVersion: 1, folders: ['A'], songs: [{ path: 'A/x.json', song: { sections: [] } }] }));
        expect(parsed.ok).toBe(true);
        expect(parsed.info.id).toBe('');
        expect(parsed.folders).toEqual([{ name: 'A', caption: '', description: '' }]);
    });

    test('bad id or version in a file is rejected with a message', () => {
        const wrap = (extra) => JSON.stringify({ fileType: WORKBOOK_FILE_TYPE, workbookVersion: 2, folders: [], songs: [], ...extra });
        expect(parseWorkbookFile(wrap({ id: 'no spaces' })).error).toMatch(/id/);
        expect(parseWorkbookFile(wrap({ version: '!!' })).error).toMatch(/version/);
    });

    test('info edits are changes; an edit that changes nothing is not; bad edits are refused', async () => {
        const { model } = await newModel();
        await model.setWorkbookInfo({ caption: 'x' });
        expect(model.getView().meta.changesSinceBackup).toBe(1);
        expect((await model.setWorkbookInfo({ caption: 'x' })).changed).toBe(false);
        expect(model.getView().meta.changesSinceBackup).toBe(1);
        expect((await model.setWorkbookInfo({ id: 'bad id' })).ok).toBe(false);
        expect((await model.setFolderInfo('Nope', { caption: 'x' })).ok).toBe(false);
    });

    test('suggestedMount survives into an export of a mounted Tutorial', async () => {
        const file = buildWorkbookFile({ folders: [], songs: [], savedAt: '', info: { id: 'C1', suggestedMount: 'tutorial' } });
        expect(file.suggestedMount).toBe('tutorial');
        const parsed = parseWorkbookFile(serializeWorkbookFile(file));
        const { model } = await newModel();
        await model.replaceFromParsed(parsed);
        expect((await model.exportFile()).file.suggestedMount).toBe('tutorial');
    });
});

describe('mount helpers', () => {
    test('mountIdFromFileName and uniqueMountId', () => {
        expect(mountIdFromFileName('C100-cowboy-chords.workbook.json')).toBe('C100-cowboy-chords');
        expect(mountIdFromFileName('C:\\x\\My Course (2).json')).toBe('My-Course-2');
        expect(mountIdFromFileName('')).toBe('workbook-file');
        expect(uniqueMountId('C1', [])).toBe('C1');
        expect(uniqueMountId('C1', ['c1'])).toBe('C1-2');
        expect(uniqueMountId('workbook', [])).toBe('workbook-2');
        expect(uniqueMountId('a', ['a', 'a-2'])).toBe('a-3');
    });

    test('db names are lower case and prefixed', () => {
        expect(mountDbName('C100-Cowboy')).toBe('infinite-neck-workbook-mount-c100-cowboy');
    });

    test('isLibraryWorkbookHref accepts only relative .workbook.json hrefs', () => {
        expect(isLibraryWorkbookHref('tutorials/C000-intro.workbook.json')).toBe(true);
        expect(isLibraryWorkbookHref('../x.workbook.json')).toBe(false);
        expect(isLibraryWorkbookHref('/etc/x.workbook.json')).toBe(false);
        expect(isLibraryWorkbookHref('http://x/y.workbook.json')).toBe(false);
        expect(isLibraryWorkbookHref('tutorials/a.json')).toBe(false);
        expect(isLibraryWorkbookHref('a.workbook.json?x=1')).toBe(false);
    });

    test('mount registry round trip drops bad and duplicate records', () => {
        const storage = fakeStorage();
        expect(readMountRegistry(storage)).toEqual([]);
        writeMountRegistry(storage, ['C1', 'C2']);
        expect(readMountRegistry(storage)).toEqual([{ mountId: 'C1' }, { mountId: 'C2' }]);
        storage.setItem('infinite-neck:workbook-mounts', JSON.stringify([{ mountId: 'ok' }, { mountId: 'OK' }, { mountId: 'bad id' }, { mountId: 'workbook' }, null, 5]));
        expect(readMountRegistry(storage)).toEqual([{ mountId: 'ok' }]);
        storage.setItem('infinite-neck:workbook-mounts', 'not json');
        expect(readMountRegistry(storage)).toEqual([]);
    });
});

describe('progress ledger', () => {
    test('saved from entries, applied to a re-mounted file; the file\'s own progress wins', async () => {
        const { model } = await newModel();
        await model.saveSong({ baseName: 'a', text: SONG_TEXT });
        await model.saveSong({ baseName: 'b', text: SONG_TEXT });
        await model.setSongState('a.json', { progress: { doneSectionIndexes: [0, 1], bookmarkSectionIndex: 2 }, includeInLooping: [1] });

        const storage = fakeStorage();
        writeProgressLedger(storage, 'C1', ledgerFromEntries(model.entries.values()));
        const ledger = readProgressLedger(storage, 'c1');   // not case-sensitive
        expect(Object.keys(ledger)).toEqual(['a.json']);

        const parsed = {
            songs: [
                { path: 'a.json', progress: null, includeInLooping: null },
                { path: 'b.json', progress: { doneSectionIndexes: [0], bookmarkSectionIndex: null }, includeInLooping: null },
                { path: 'new.json', progress: null, includeInLooping: null }
            ]
        };
        expect(applyLedgerToParsed(parsed, ledger)).toBe(1);
        expect(parsed.songs[0].progress.doneSectionIndexes).toEqual([0, 1]);
        expect(parsed.songs[0].includeInLooping).toEqual([1]);
        expect(parsed.songs[2].progress).toBeNull();

        clearProgressLedger(storage, 'C1');
        expect(readProgressLedger(storage, 'C1')).toEqual({});
        expect(storage.store.size).toBe(0);
    });

    test('an empty ledger removes its storage key; garbage is ignored', () => {
        const storage = fakeStorage();
        writeProgressLedger(storage, 'X', {});
        expect(storage.store.size).toBe(0);
        storage.setItem('infinite-neck:workbook-progress:x', JSON.stringify({ '../bad.json': { progress: { doneSectionIndexes: [1] } }, 'ok.json': 5 }));
        expect(readProgressLedger(storage, 'x')).toEqual({});
    });
});
