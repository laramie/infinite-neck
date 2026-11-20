import { renderWorkbookHtml, renderStatusLine, renderSortBar } from '../../WorkbookUI.js';

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

describe('control boxes (Iteration 2 Round 2)', () => {
    test('all Workbook controls sit in one workbookToolbox before the rows', () => {
        const html = renderWorkbookHtml({ rootSongs: [song('r.json')], folders: [], songCount: 1, folderCount: 0, totalBytes: 1, meta: META });
        const boxStart = html.indexOf("class='workbookToolbox'");
        const boxEnd = html.indexOf("<div class='songLibraryRows'>");
        expect(boxStart).toBeGreaterThan(-1);
        for (const marker of ["data-wb-action='download'", "id='workbookFileInput'", "class='workbookStatus", "data-wb-action='addFolder'", "data-wb-action='sort'"]) {
            const at = html.indexOf(marker);
            expect(at).toBeGreaterThan(boxStart);
            expect(at).toBeLessThan(boxEnd);
        }
    });

    test('folder control row is not a songLibraryRow', () => {
        const html = renderWorkbookHtml({
            rootSongs: [],
            folders: [{ name: 'F', seq: 1, songs: [song('F/a.json')] }],
            songCount: 1, folderCount: 1, totalBytes: 1, meta: META
        }, { openFolders: new Set(['F']) });
        expect(html).toContain("<div class='workbookFolderToolRow'><div class='workbookFolderTools workbookFolderControls'>");
        expect(html).not.toContain('songLibraryRow workbookFolderToolRow');
    });
});

describe('sort bar and move buttons (Iteration 2)', () => {
    const folderView = (extra = {}) => ({
        rootSongs: [{ ...song('a.json'), canUp: false, canDown: true }, { ...song('b.json'), canUp: true, canDown: false }],
        folders: [{ name: 'F', seq: 3, canUp: false, canDown: true, songs: [{ ...song('F/c.json'), canUp: false, canDown: false }] }],
        songCount: 3,
        folderCount: 1,
        totalBytes: 3,
        meta: META,
        ...extra
    });

    test('three sort buttons follow the Add Folder row, with the active one marked', () => {
        const html = renderWorkbookHtml(folderView(), { sort: { key: 'date', dir: -1 } });
        expect(html.indexOf("data-wb-action='addFolder'")).toBeLessThan(html.indexOf('workbookSortBar'));
        expect(html).toContain('&#x2261; Default');
        expect(html).toContain('&#x1F552; Date');
        expect(html).toContain('&#x21C5; A-Z');
        expect(html).toMatch(/workbookSortActive' data-wb-action='sort' data-wb-sort='date' aria-pressed='true' title='Newest first/);
        expect(html).toMatch(/data-wb-sort='alpha' aria-pressed='false'/);
        expect(renderSortBar({ key: 'date', dir: 1 })).toContain('Oldest first');
        expect(renderSortBar({ key: 'alpha', dir: -1 })).toContain('Z to A');
        expect(renderSortBar()).toMatch(/workbookSortActive' data-wb-action='sort' data-wb-sort='list'/);
    });

    test('Song rows have up, down and a glyph Remove; folder rows have up and down between Rename and Delete; no Add current Song here', () => {
        const html = renderWorkbookHtml(folderView(), { openFolders: new Set(['F']) });
        expect(html).toContain("class='ssMoveUp btnMoveTuningUp' data-wb-action='moveUp' data-wb-path='a.json' disabled");
        expect(html).toContain("class='ssMoveDown btnMoveTuningDown' data-wb-action='moveDown' data-wb-path='a.json' title");
        expect(html).toContain("class='ssMoveUp btnMoveTuningUp' data-wb-action='moveUp' data-wb-path='b.json' title");
        expect(html).toContain("class='ssMoveDown btnMoveTuningDown' data-wb-action='moveDown' data-wb-path='b.json' disabled");
        expect(html).toMatch(/btnMoveTuningDown' data-wb-action='moveDown' data-wb-path='a.json'[^>]*>&#x2B07;<\/button><button type='button' class='ssRemove btnRemoveTuning' data-wb-action='removeSong'/);
        expect(html).not.toMatch(/>Remove<\/button>/);
        expect(html).not.toContain('Delete folder<');
        expect(html).not.toContain('Add current Song here');
        expect(html).not.toContain('addSongHere');
        const folderRow = html.slice(html.indexOf('workbookFolderTools'), html.indexOf("data-wb-path='F/c.json'"));
        expect(folderRow.indexOf('renameFolder')).toBeLessThan(folderRow.indexOf('moveFolderUp'));
        expect(folderRow.indexOf('moveFolderUp')).toBeLessThan(folderRow.indexOf('moveFolderDown'));
        expect(folderRow.indexOf('moveFolderDown')).toBeLessThan(folderRow.indexOf('deleteFolder'));
        expect(folderRow).toContain("class='ssMoveUp btnMoveTuningUp' data-wb-action='moveFolderUp' data-wb-folder='F' disabled");
        expect(folderRow).toContain("class='ssRemove btnRemoveTuning' data-wb-action='deleteFolder' data-wb-folder='F' disabled");
    });

    test('while sorted, every move button is disabled (they move the stored order)', () => {
        const html = renderWorkbookHtml(folderView(), { sort: { key: 'alpha', dir: 1 } });
        const enabledMoves = html.match(/data-wb-action='move(Folder)?(Up|Down)'[^>]*>/g).filter((tag) => !tag.includes('disabled'));
        expect(enabledMoves).toEqual([]);
        expect(html).toContain('switch to Default order first');
    });
});
