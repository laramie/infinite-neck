import { renderWorkbookHtml, renderStatusLine } from '../../WorkbookUI.js';

function song(path, comment = '', bytes = 1024) {
    return { path, kind: 'song', seq: 1, comment, source: '', bytes };
}

const META = { nextSeq: 5, lastBackupAt: null, changesSinceBackup: 0 };

describe('renderWorkbookHtml', () => {
    test('empty Workbook shows the always-present summary and an empty hint', () => {
        const html = renderWorkbookHtml({ rootSongs: [], folders: [], songCount: 0, folderCount: 0, totalBytes: 0, meta: META });
        expect(html).toContain("<summary class='songLibrarySummary'>Workbook ");
        expect(html).toContain('(0 songs, 0 folders, 0 B)');
        expect(html).toContain('The Workbook is empty');
        expect(html).toContain("data-wb-action='download'");
        expect(html).toContain("id='workbookFileInput'");
        expect(html).toContain("data-wb-action='addFolder'");
    });

    test('root songs, folders in order, folder open state, delete disabled while it has Songs', () => {
        const html = renderWorkbookHtml({
            rootSongs: [song('root.json', 'note')],
            folders: [
                { name: 'Full', seq: 2, songs: [song('Full/a.json')] },
                { name: 'Empty', seq: 3, songs: [] }
            ],
            songCount: 2,
            folderCount: 2,
            totalBytes: 2048,
            meta: META
        }, { rootOpen: true, openFolders: new Set(['Full']) });

        expect(html).toContain("workbookRootDetails' open>");
        expect(html.indexOf('>Full ')).toBeLessThan(html.indexOf('>Empty '));
        expect(html).toMatch(/data-wb-folder='Full' open>/);
        expect(html).not.toMatch(/data-wb-folder='Empty' open>/);
        expect(html).toContain("data-wb-action='deleteFolder' data-wb-folder='Full' disabled");
        expect(html).not.toContain("data-wb-action='deleteFolder' data-wb-folder='Empty' disabled");
        expect(html).toContain("value='note'");
        expect(html).toContain('>a.json</a>');
        expect(html).toContain("name='workbookFolderGroup'");
    });

    test('everything user-controlled is escaped (comments, names, messages)', () => {
        const evil = `"><img src=x onerror=alert(1)>'`;
        const html = renderWorkbookHtml({
            rootSongs: [song('a.json', evil)],
            folders: [],
            songCount: 1,
            folderCount: 0,
            totalBytes: 10,
            meta: META
        }, { message: { text: `<b>${evil}</b>`, kind: 'error' } });
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<b>"');
        expect(html).toContain('&lt;img');
        expect(html).toContain('workbookMessageError');
    });

    test('a path with quotes cannot break out of its attribute', () => {
        const html = renderWorkbookHtml({
            rootSongs: [song("x' onclick='alert(1).json")],
            folders: [],
            songCount: 1,
            folderCount: 0,
            totalBytes: 1,
            meta: META
        });
        expect(html).not.toContain("onclick='alert");
    });

    test('not-persistent notice and stale backup status', () => {
        const html = renderWorkbookHtml({ rootSongs: [], folders: [], songCount: 0, folderCount: 0, totalBytes: 0, meta: META }, { persistent: false });
        expect(html).toContain('not saved in this browser');
        expect(renderStatusLine({ changesSinceBackup: 7, lastBackupAt: null })).toContain('workbookStatusStale');
        expect(renderStatusLine({ changesSinceBackup: 0, lastBackupAt: '2026-11-18T00:00:00.000Z' })).not.toContain('workbookStatusStale');
    });
});
