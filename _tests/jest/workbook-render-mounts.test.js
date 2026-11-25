import { renderMountControls, renderWorkbookHtml } from '../../WorkbookUI.js';
import { renderSongLibraryHtml } from '../../SongLibrary.js';
import { getSanitizedWorkbookDescription, isAllowedWorkbookAnchorHref } from '../../html-sanitizer.js';

const META = { nextSeq: 5, lastBackupAt: '2026-11-18T00:00:00.000Z', changesSinceBackup: 0 };

function song(path, extra = {}) {
    return { path, kind: 'song', seq: 1, comment: '', source: '', bytes: 10, canUp: false, canDown: false, ...extra };
}

function view(extra = {}) {
    return {
        rootSongs: [],
        folders: [],
        songCount: 0,
        folderCount: 0,
        totalBytes: 0,
        meta: META,
        info: { id: 'C1', version: '1', caption: '', description: '' },
        ...extra
    };
}

describe('mounted Workbook rendering', () => {
    const mountUi = { builtIn: false, mountId: 'C100-cowboy' };

    test('a mount is labelled by its id, has no Open Workbook input and no duplicate ids, and has Unmount/Download/Discard', () => {
        const html = renderWorkbookHtml(view(), mountUi);
        expect(html).toContain("<summary class='songLibrarySummary'>C100-cowboy ");
        expect(html).not.toContain("id='workbookFileInput'");
        expect(html).not.toContain("id='workbookNewFolderName'");
        expect(html).toContain("class='workbookNewFolderInput'");
        expect(html).toContain("data-wb-action='unmount'");
        expect(html).toContain("data-wb-action='discard'");
        expect(html.match(/data-wb-action='download'/g)).toHaveLength(1);
        expect(html.indexOf("class='workbookMountControls'")).toBeGreaterThan(html.indexOf("class='workbookStatus"));
    });

    test('the built-in Workbook keeps its own controls and has no mount buttons', () => {
        const html = renderWorkbookHtml(view());
        expect(html).toContain("id='workbookFileInput'");
        expect(html).toContain("id='workbookNewFolderName'");
        expect(html).not.toContain("data-wb-action='unmount'");
        expect(html).not.toContain('workbookMountControls');
    });

    test('Unmount waits for an up-to-date Download; Discard is the opposite', () => {
        const clean = renderMountControls({ changesSinceBackup: 0 });
        expect(clean).not.toMatch(/data-wb-action='unmount' disabled/);
        expect(clean).toMatch(/data-wb-action='discard' disabled/);
        const dirty = renderMountControls({ changesSinceBackup: 3 });
        expect(dirty).toMatch(/data-wb-action='unmount' disabled/);
        expect(dirty).not.toMatch(/data-wb-action='discard' disabled/);
        expect(dirty).toContain('3 changes not downloaded');
    });

    test('folder groups are per mount so one mount does not close another', () => {
        const folders = [{ name: 'F', seq: 1, canUp: false, canDown: false, songs: [song('F/a.json')] }];
        expect(renderWorkbookHtml(view({ folders, folderCount: 1, songCount: 1 }), mountUi)).toContain("name='workbookFolderGroup-C100-cowboy'");
        expect(renderWorkbookHtml(view({ folders, folderCount: 1, songCount: 1 }), { builtIn: false, mountId: 'Other' })).toContain("name='workbookFolderGroup-Other'");
        expect(renderWorkbookHtml(view({ folders, folderCount: 1, songCount: 1 }))).toContain("name='workbookFolderGroup'");
    });

    test('Song rows show the caption with the file name, instrument badges and the progress badge', () => {
        const html = renderWorkbookHtml(view({
            rootSongs: [song('L1-1.json', {
                caption: 'Playing <one> string',
                tutorial: 'strict',
                SectionCount: 4,
                progress: { doneSectionIndexes: [0, 1], bookmarkSectionIndex: 2 },
                instruments: [{ fromBaseID: 'S1', wiring: 'Main', visible: true }]
            })],
            songCount: 1
        }), mountUi);
        expect(html).toContain('>Playing &lt;one&gt; string</a>');
        expect(html).toContain("<span class='workbookFileName'>L1-1.json</span>");
        expect(html).toContain('songLibraryInstrument');
        expect(html).toContain('>S1</span>');
        expect(html).toContain('songLibraryTutorialProgressBadge');
        expect(html).toContain('(2/4)');
    });

    test('a folder shows its caption, and how many strict Tutorial Songs are completely Done', () => {
        const done = song('F/a.json', { tutorial: 'strict', SectionCount: 2, progress: { doneSectionIndexes: [0, 1], bookmarkSectionIndex: null } });
        const open = song('F/b.json', { tutorial: 'strict', SectionCount: 2, progress: null });
        const html = renderWorkbookHtml(view({
            folders: [{ name: 'F', caption: 'Lesson <1>', description: '', seq: 1, canUp: false, canDown: false, songs: [done, open] }],
            folderCount: 1,
            songCount: 2
        }), mountUi);
        expect(html).toContain('Lesson &lt;1&gt; <span class=\'workbookFolderName\'>F</span>');
        expect(html).toContain('(2 songs, 1 done)');
    });

    test('Workbook and folder descriptions go through the sanitizer; the default one fails closed in Node', () => {
        const evil = '<img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>';
        const html = renderWorkbookHtml(view({ info: { id: '', version: '', caption: 'Cap <b>', description: evil } }), mountUi);
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
        expect(html).toContain('Cap &lt;b&gt;');

        const custom = renderWorkbookHtml(view({ info: { id: '', version: '', caption: '', description: '<p>ok</p>' } }), { ...mountUi, sanitizeHtml: (text) => `[clean:${text}]` });
        expect(custom).toContain('[clean:<p>ok</p>]');
    });

    test('the info editor shows id, version, caption, description with Save and Cancel; errors and drafts are escaped', () => {
        const html = renderWorkbookHtml(view(), { ...mountUi, editing: { scope: 'workbook', draft: { id: 'a"b', version: '1', caption: "c'd", description: '<p>x</p>' }, error: 'Bad <id>' } });
        expect(html).toContain("class='workbookEditId'");
        expect(html).toContain("class='workbookEditVersion'");
        expect(html).toContain("data-wb-action='saveInfo'");
        expect(html).toContain("data-wb-action='cancelInfo'");
        expect(html).toContain('value=\'a&quot;b\'');
        expect(html).toContain('&lt;p&gt;x&lt;/p&gt;</textarea>');
        expect(html).toContain('Bad &lt;id&gt;');

        const folderHtml = renderWorkbookHtml(view({
            folders: [{ name: 'F', seq: 1, canUp: false, canDown: false, songs: [] }], folderCount: 1
        }), { ...mountUi, editing: { scope: 'folder', name: 'F' }, openFolders: new Set(['F']) });
        expect(folderHtml).toContain("data-wb-scope='folder' data-wb-folder='F'");
        expect(folderHtml).not.toContain("class='workbookEditId'");
    });
});

describe('Workbook description sanitizer rules', () => {
    test('only #open= links of this Workbook and help links are allowed', () => {
        expect(isAllowedWorkbookAnchorHref('#open=a.json')).toBe(true);
        expect(isAllowedWorkbookAnchorHref('#open=L1-lesson/a-1.json')).toBe(true);
        expect(isAllowedWorkbookAnchorHref('#open=../a.json')).toBe(false);
        expect(isAllowedWorkbookAnchorHref('#open=a/b/c.json')).toBe(false);
        expect(isAllowedWorkbookAnchorHref('#open=a.txt')).toBe(false);
        expect(isAllowedWorkbookAnchorHref('#macro=macroStrict')).toBe(false);
        expect(isAllowedWorkbookAnchorHref('https://example.com/')).toBe(false);
        expect(isAllowedWorkbookAnchorHref('javascript:alert(1)')).toBe(false);
    });

    test('without a DOM the description is escaped, never passed through', () => {
        expect(getSanitizedWorkbookDescription('<b>x</b> & "y"')).toBe('&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;');
        expect(getSanitizedWorkbookDescription('   ')).toBe('');
    });
});

describe('Song Library Workbook rows', () => {
    const list = {
        songs: [
            { href: 'a/one.json', description: 'One', instruments: [] },
            { href: 'tutorials/C000-intro.workbook.json', kind: 'workbook', description: '<b>Intro</b>: 1 song in 1 lesson', instruments: [{ fromBaseID: 'S1', wiring: 'Main', visible: true }] },
            { href: 'tutorials/not-a-workbook.json', kind: 'workbook', description: 'x', instruments: [] }
        ],
        directoryIntros: []
    };

    test('a workbook entry has Mount as Tutorial and Download buttons instead of a Song link', () => {
        const html = renderSongLibraryHtml(list);
        expect(html).toContain("data-action='mountLibraryWorkbook'");
        expect(html).toContain("data-action='downloadLibraryWorkbook'");
        expect(html).toContain('Mount as Tutorial');
        expect(html).toContain('C000-intro.workbook.json</span>');
        expect(html).toContain('<b>Intro</b>: 1 song in 1 lesson');
        expect(html).toContain('>S1</span>');
        expect(html.match(/data-action='loadSong'/g)).toHaveLength(2);   // one.json, and the kind-less not-a-workbook.json
    });
});
