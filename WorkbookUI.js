/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 157: the Workbook block on the File page (#divWorkbook) and the "Save to Workbook" form.
// renderWorkbookHtml() is pure (a string builder, like SongLibrary.js) and is what Jest tests.  The rest is the
// browser-side controller: it owns one WorkbookModel and re-renders after every change.
// Styles: song-library.css (the Workbook reuses the Library classes).

import { escapeHtml } from './InstrumentRoleBadges.js';
import {
    MAX_COMMENT_LENGTH,
    MAX_NAME_LENGTH,
    WorkbookModel,
    defaultSongBaseName,
    describeBackup,
    formatBytes,
    isBackupStale,
    makeSongPath,
    parseWorkbookFile,
    pathKey,
    sanitizeName,
    splitPath,
    validateSongBaseName,
    workbookDownloadName
} from './Workbook.js';
import { createMemoryAdapter, openIndexedDbAdapter } from './WorkbookStorage.js';

function plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function attr(value) {
    return escapeHtml(value);
}

//==================== pure rendering ====================

export function renderStatusLine(meta = {}) {
    const stale = isBackupStale(meta) ? ' workbookStatusStale' : '';
    return `<div class='workbookStatus${stale}'>${escapeHtml(describeBackup(meta))}</div>`;
}

// The same glyph buttons as Tunings in Song and the Stylesheets table (infinite-neck.css: .btnMoveTuningUp etc.)
const GLYPH_UP = '&#x2B06;';
const GLYPH_DOWN = '&#x2B07;';
const GLYPH_REMOVE = '&#x232B;';

function isListOrder(ui) {
    return !ui.sort || ui.sort.key === 'list';
}

/** Up/Down move the stored (list) order, so they only work while the list is shown in that order. */
function renderMoveButtons(kind, idAttr, entry, ui) {
    const listOrder = isListOrder(ui);
    const hint = listOrder ? '' : ' (switch to Default order first)';
    const up = listOrder && entry.canUp;
    const down = listOrder && entry.canDown;
    const what = kind === 'folder' ? 'folder' : 'Song';
    return `<button type='button' class='ssMoveUp btnMoveTuningUp' data-wb-action='${kind === 'folder' ? 'moveFolderUp' : 'moveUp'}' ${idAttr}${up ? '' : ' disabled'} title='Move ${what} up${hint}' aria-label='Move ${what} up'>${GLYPH_UP}</button>`
        + `<button type='button' class='ssMoveDown btnMoveTuningDown' data-wb-action='${kind === 'folder' ? 'moveFolderDown' : 'moveDown'}' ${idAttr}${down ? '' : ' disabled'} title='Move ${what} down${hint}' aria-label='Move ${what} down'>${GLYPH_DOWN}</button>`;
}

const SORT_BUTTONS = [
    { key: 'list', caption: '&#x2261; Default', titles: { 1: 'Order of addition (the stored order)' } },
    { key: 'date', caption: '&#x1F552; Date', titles: { [-1]: 'Newest first.  Click to reverse.', 1: 'Oldest first.  Click to reverse.' } },
    { key: 'alpha', caption: '&#x21C5; A-Z', titles: { 1: 'A to Z, capitals first.  Click to reverse.', [-1]: 'Z to A.  Click to reverse.' } }
];

export function renderSortBar(sort = { key: 'list', dir: 1 }) {
    let html = "<div class='workbookToolbar workbookSortBar'><span class='workbookSortLabel'>Sort:</span> ";
    SORT_BUTTONS.forEach((button) => {
        const active = sort.key === button.key;
        const dir = button.key === 'list' ? 1 : (sort.dir < 0 ? -1 : 1);
        const title = active ? button.titles[dir] : (button.key === 'date' ? 'Newest first' : (button.key === 'alpha' ? 'A to Z' : button.titles[1]));
        html += `<button type='button' class='workbookSortButton${active ? ' workbookSortActive' : ''}' data-wb-action='sort' data-wb-sort='${button.key}' aria-pressed='${active}' title='${attr(title)}'>${button.caption}</button> `;
    });
    return `${html}</div>`;
}

function renderSongRow(song, ui = {}) {
    const { filename } = splitPath(song.path);
    const path = attr(song.path);
    return (
        "<div class='songLibraryRow workbookRow'>"
        + "<div class='songLibraryCell songLibraryCellLink'>"
        + `<a href='#' data-wb-action='openSong' data-wb-path='${path}' title='${path}'>${escapeHtml(filename)}</a>`
        + '</div>'
        + "<div class='songLibraryCell songLibraryCellDescription'>"
        + `<input type='text' class='workbookComment' data-wb-path='${path}' maxlength='${MAX_COMMENT_LENGTH}' value='${attr(song.comment || '')}' placeholder='Progress notes' aria-label='Comment for ${path}'>`
        + '</div>'
        + "<div class='songLibraryCell workbookCellActions'>"
        + renderMoveButtons('song', `data-wb-path='${path}'`, song, ui)
        + `<button type='button' class='ssRemove btnRemoveTuning' data-wb-action='removeSong' data-wb-path='${path}' title='Remove ${path} from the Workbook' aria-label='Remove ${path} from the Workbook'>${GLYPH_REMOVE}</button>`
        + '</div>'
        + '</div>'
    );
}

function renderFolder(folder, ui) {
    const name = attr(folder.name);
    const isOpen = ui.openFolders instanceof Set && ui.openFolders.has(folder.name);
    const hasSongs = folder.songs.length > 0;
    let html = `<details class='songLibraryDirectoryDetails workbookFolderDetails' name='workbookFolderGroup' data-wb-folder='${name}'${isOpen ? ' open' : ''}>`;
    html += `<summary class='songLibrarySummary songLibraryDirectorySummary'>${escapeHtml(folder.name)} <span class='workbookCounts'>(${plural(folder.songs.length, 'song')})</span></summary>`;
    html += "<div class='songLibraryDirectoryBody'><div class='songLibraryRows'>";
    html += "<div class='songLibraryRow workbookFolderToolRow'><div class='songLibraryCell workbookCellTools workbookFolderTools'>";
    html += `<input type='text' class='workbookRenameInput' size='18' maxlength='${MAX_NAME_LENGTH}' value='${name}' aria-label='New name for folder ${name}'> `;
    html += `<button type='button' data-wb-action='renameFolder' data-wb-folder='${name}'>Rename folder</button> `;
    html += renderMoveButtons('folder', `data-wb-folder='${name}'`, folder, ui);
    html += `<button type='button' class='ssRemove btnRemoveTuning' data-wb-action='deleteFolder' data-wb-folder='${name}'${hasSongs ? " disabled title='Remove the Songs first'" : " title='Delete this empty folder'"} aria-label='Delete folder ${name}'>${GLYPH_REMOVE}</button>`;
    html += '</div></div>';
    folder.songs.forEach((song) => {
        html += renderSongRow(song, ui);
    });
    html += '</div></div></details>';
    return html;
}

/** @param view the result of WorkbookModel.getView()
 *  @param {{rootOpen?:boolean, openFolders?:Set<string>, message?:{text:string, kind?:string}|null, persistent?:boolean, sort?:{key:string, dir:number}}} [ui] */
export function renderWorkbookHtml(view, ui = {}) {
    const counts = `${plural(view.songCount, 'song')}, ${plural(view.folderCount, 'folder')}, ${formatBytes(view.totalBytes)}`;
    let html = `<details class='songLibraryRootDetails workbookRootDetails'${ui.rootOpen ? ' open' : ''}>`;
    html += `<summary class='songLibrarySummary'>Workbook <span class='workbookCounts'>(${escapeHtml(counts)})</span></summary>`;
    html += "<div class='songLibraryBody workbookBody'>";

    if (ui.persistent === false) {
        html += "<div class='workbookNotice'>The Workbook is not saved in this browser (storage is unavailable).  Use Download Workbook to keep your work.</div>";
    }
    html += "<div class='workbookToolbar'>";
    html += "<button type='button' data-wb-action='download'>Download Workbook</button> ";
    html += "<label class='workbookOpenLabel'>Open Workbook: <input type='file' id='workbookFileInput' accept='.json,application/json'></label>";
    html += '</div>';
    html += renderStatusLine(view.meta);
    if (ui.message && ui.message.text) {
        html += `<div class='workbookMessage ${ui.message.kind === 'error' ? 'workbookMessageError' : 'workbookMessageInfo'}'>${escapeHtml(ui.message.text)}</div>`;
    }
    html += "<div class='workbookToolbar'>";
    html += `<input type='text' id='workbookNewFolderName' size='20' maxlength='${MAX_NAME_LENGTH}' placeholder='new-folder-name' aria-label='New folder name'> `;
    html += "<button type='button' data-wb-action='addFolder'>+ New Folder</button>";
    html += '</div>';
    html += renderSortBar(ui.sort);

    html += "<div class='songLibraryRows'>";
    if (view.songCount === 0 && view.folderCount === 0) {
        html += "<div class='songLibraryRow songLibraryIntroRow'><div class='songLibraryCell songLibraryCellIntro'>The Workbook is empty.  Use <b>Save to Workbook</b> next to <b>Download Song</b> to add the current Song.</div></div>";
    }
    view.rootSongs.forEach((song) => {
        html += renderSongRow(song, ui);
    });
    html += '</div>';
    view.folders.forEach((folder) => {
        html += renderFolder(folder, ui);
    });
    html += '</div></details>';
    return html;
}

//==================== browser-side controller ====================

let model = null;
let providers = null;
const ui = {
    rootOpen: false,
    openFolders: new Set(),
    message: null,
    persistent: true,
    lastFolder: '',
    sort: { key: 'list', dir: 1 }   // display only: never stored, back to list order at launch and when a Workbook is opened
};

function container() {
    return $('#divWorkbook');
}

function setMessage(text, kind = 'info') {
    ui.message = text ? { text, kind } : null;
}

function captureOpenState() {
    const root = container().find('.workbookRootDetails');
    if (root.length) {
        ui.rootOpen = root.prop('open') === true;
        ui.openFolders = new Set();
        container().find('details[data-wb-folder]').each(function () {
            if (this.open) {
                ui.openFolders.add($(this).attr('data-wb-folder'));
            }
        });
    }
}

function renderSaveFormFolders(selected) {
    const select = $('#selWorkbookFolder');
    if (!select.length) {
        return;
    }
    const view = model.getView();
    let html = "<option value=''>(Workbook root)</option>";
    view.folders.forEach((folder) => {
        html += `<option value='${attr(folder.name)}'>${escapeHtml(folder.name)}</option>`;
    });
    select.html(html);
    select.val(view.folders.some((folder) => folder.name === selected) ? selected : '');
}

/** @param {boolean} [capture=true] false when the caller has just set ui.rootOpen / ui.openFolders on purpose */
function render(capture = true) {
    const jq = container();
    if (!jq.length || !model) {
        return;
    }
    if (capture) {
        captureOpenState();
    }
    jq.show().html(renderWorkbookHtml(model.getView({ sortKey: ui.sort.key, sortDir: ui.sort.dir }), ui));
}

function refreshStatus() {
    container().find('.workbookStatus').replaceWith(renderStatusLine(model.getView().meta));
}

function askConfirm(message) {
    return providers.confirm ? providers.confirm(message) : globalThis.confirm(message);
}

function staleNote() {
    const meta = model.getView().meta;
    return isBackupStale(meta) ? '\n\nThe Workbook has changes that were not downloaded yet.' : '';
}

async function run(task) {
    try {
        await task();
    } catch (error) {
        console.warn('Workbook error', error);
        setMessage(`Workbook error: ${error?.message || error}`, 'error');
        render();
    }
}

//---- save form ----

function showSaveError(text, fixable = false) {
    const target = $('#spanWorkbookSaveError');
    target.empty().text(text);
    if (text && fixable) {
        target.append(" <button type='button' id='btnWorkbookFixName'>Fix name</button>");
    }
}

function showSaveForm() {
    if (!model) {
        return;
    }
    const current = providers.getCurrentWorkbookPath();
    renderSaveFormFolders(current ? splitPath(current).folder : ui.lastFolder);
    $('#txtWorkbookSongName').val(defaultSongBaseName({
        workbookPath: current,
        libraryHref: providers.getLibraryHref(),
        filenameBox: providers.getFilenameBoxValue()
    }));
    showSaveError('');
    $('#spanWorkbookSaveMessage').text('');
    const form = $('#divSaveToWorkbook').show();
    if (form[0]?.scrollIntoView) {
        form[0].scrollIntoView({ block: 'nearest' });
    }
    $('#txtWorkbookSongName').trigger('focus').trigger('select');
}

function hideSaveForm() {
    $('#divSaveToWorkbook').hide();
    showSaveError('');
}

async function saveToWorkbook() {
    const folder = `${$('#selWorkbookFolder').val() || ''}`;
    const base = validateSongBaseName($('#txtWorkbookSongName').val());
    if (!base.ok) {
        showSaveError(base.error, base.fixable);
        return;
    }
    const path = makeSongPath(folder, base.value);
    const existing = model.getEntry(path);
    const sameAsOpened = pathKey(providers.getCurrentWorkbookPath()) === pathKey(path);
    if (existing && !sameAsOpened && !askConfirm(`"${existing.path}" is already in the Workbook.  Replace it?`)) {
        return;
    }
    const state = providers.getSongProgressState();
    const result = await model.saveSong({
        folder,
        baseName: base.value,
        text: providers.getPersistentSongFile(),
        source: providers.getLibraryHref(),
        // Sprint 157 it2: the Workbook takes the Bookmark / Done and Include in Looping the Song has right now, and
        // from here on is the only place they are read from.  They replace what a Song of that name had.
        progress: state.progress,
        includeInLooping: state.includeInLooping
    });
    if (!result.ok) {
        showSaveError(result.error, result.fixable);
        return;
    }
    providers.setCurrentWorkbookPath(result.path);
    ui.lastFolder = folder;
    setMessage('');
    hideSaveForm();
    $('#spanWorkbookSaveMessage').text(`${result.replaced ? 'Replaced' : 'Saved'} Workbook/${result.path}`);
    // show the Song where it landed: open its folder (the accordion keeps one folder open)
    captureOpenState();
    ui.rootOpen = true;
    if (folder) {
        ui.openFolders = new Set([folder]);
    }
    render(false);
    requestPersistentStorage();
}

function requestPersistentStorage() {
    try {
        const request = globalThis.navigator?.storage?.persist?.();
        if (request && typeof request.catch === 'function') {
            request.catch(() => {});
        }
    } catch {
        // best effort only
    }
}

//---- Workbook actions ----

async function openWorkbookSong(path) {
    const text = await model.getSongText(path);
    if (text === null) {
        setMessage(`"${path}" could not be read from the Workbook.`, 'error');
        render();
        return;
    }
    providers.openWorkbookSong(path, text);
}

async function removeSong(path) {
    if (!askConfirm(`Remove "${path}" from the Workbook?${staleNote()}`)) {
        return;
    }
    const result = await model.deleteSong(path);
    if (result.ok && pathKey(providers.getCurrentWorkbookPath()) === pathKey(path)) {
        providers.setCurrentWorkbookPath('');
    }
    setMessage(result.ok ? `Removed ${path}` : result.error, result.ok ? 'info' : 'error');
    render();
}

async function addFolder() {
    const input = $('#workbookNewFolderName');
    const result = await model.addFolder(input.val());
    if (result.ok) {
        ui.openFolders = new Set([result.path]);
        ui.rootOpen = true;
        setMessage(`Added folder ${result.path}`);
    } else {
        setMessage(result.error, 'error');
    }
    render(!result.ok);
    if (!result.ok) {
        $('#workbookNewFolderName').val(sanitizeName(input.val())).trigger('focus');
    }
}

async function renameFolder(name, newName) {
    captureOpenState();
    const result = await model.renameFolder(name, newName);
    if (result.ok) {
        const current = providers.getCurrentWorkbookPath();
        if (current && splitPath(current).folder === name && result.path !== name) {
            providers.setCurrentWorkbookPath(makeSongPath(result.path, splitPath(current).base));
        }
        ui.openFolders = new Set([result.path]);
        setMessage(result.path === name ? '' : `Renamed folder ${name} to ${result.path}`);
    } else {
        setMessage(result.error, 'error');
    }
    render(!result.ok);
}

async function deleteFolder(name) {
    if (!askConfirm(`Delete the empty folder "${name}"?${staleNote()}`)) {
        return;
    }
    captureOpenState();
    const result = await model.deleteFolder(name);
    ui.openFolders.delete(name);
    setMessage(result.ok ? `Deleted folder ${name}` : result.error, result.ok ? 'info' : 'error');
    render(false);
}

async function moveEntry(path, direction) {
    const result = await model.moveEntry(path, direction);
    setMessage(result.ok ? '' : result.error, 'error');
    render();
}

function setSort(key) {
    if (key === 'list') {
        ui.sort = { key: 'list', dir: 1 };   // list order never reverses
    } else if (ui.sort.key === key) {
        ui.sort = { key, dir: -ui.sort.dir };
    } else {
        ui.sort = { key, dir: key === 'date' ? -1 : 1 };   // newest first, A to Z
    }
    render();   // keeps the open and closed folders as they are
}

async function downloadWorkbook() {
    const { text } = await model.exportFile();
    const name = workbookDownloadName();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', name);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    await model.markBackedUp();
    setMessage(`Downloaded ${name}`);
    render();
}

async function openWorkbookFile(file) {
    const text = await file.text();
    const parsed = parseWorkbookFile(text);
    if (!parsed.ok) {
        setMessage(`Could not open ${file.name}: ${parsed.error}`, 'error');
        render();
        return;
    }
    if (!model.isEmpty()) {
        const view = model.getView();
        let question = `Replace the Workbook in this browser (${plural(view.songCount, 'song')}) with "${file.name}" (${plural(parsed.songs.length, 'song')})?`;
        if (view.meta.changesSinceBackup > 0) {
            question += `\n\nThe current Workbook has ${plural(view.meta.changesSinceBackup, 'change')} that were not downloaded.  Choose Cancel, then use Download Workbook first, if you want to keep them.`;
        }
        if (!askConfirm(question)) {
            render();   // also clears the file input
            return;
        }
    }
    await model.replaceFromParsed(parsed);
    providers.setCurrentWorkbookPath('');
    ui.openFolders = new Set();
    ui.rootOpen = true;
    ui.sort = { key: 'list', dir: 1 };
    setMessage(`Opened ${file.name}: ${plural(parsed.songs.length, 'song')}, ${plural(parsed.folders.length, 'folder')}`);
    render(false);
}

function handleAction(action, $el) {
    const path = $el.attr('data-wb-path') || '';
    const folder = $el.attr('data-wb-folder') || '';
    switch (action) {
        case 'openSong': return openWorkbookSong(path);
        case 'removeSong': return removeSong(path);
        case 'addFolder': return addFolder();
        case 'renameFolder': return renameFolder(folder, $el.closest('.workbookFolderTools').find('.workbookRenameInput').val());
        case 'deleteFolder': return deleteFolder(folder);
        case 'moveUp': return moveEntry(path, -1);
        case 'moveDown': return moveEntry(path, 1);
        case 'moveFolderUp': return moveEntry(folder, -1);
        case 'moveFolderDown': return moveEntry(folder, 1);
        case 'sort': setSort($el.attr('data-wb-sort')); return undefined;
        case 'download': return downloadWorkbook();
        default: return undefined;
    }
}

function bindEvents() {
    container().off('.workbook')
        .on('click.workbook', '[data-wb-action]', function (event) {
            event.preventDefault();
            void run(() => handleAction($(this).attr('data-wb-action'), $(this)));
        })
        .on('change.workbook', '.workbookComment', function () {
            const path = $(this).attr('data-wb-path');
            void run(async () => {
                const result = await model.setComment(path, $(this).val());
                if (!result.ok) {
                    setMessage(result.error, 'error');
                    render();
                } else if (result.changed) {
                    refreshStatus();
                }
            });
        })
        .on('change.workbook', '#workbookFileInput', function () {
            const file = this.files && this.files[0];
            if (file) {
                void run(() => openWorkbookFile(file));
            }
        })
        .on('keydown.workbook', 'input[type=text]', function (event) {
            if (event.key !== 'Enter') {
                return;
            }
            event.preventDefault();
            if (this.id === 'workbookNewFolderName') {
                container().find("[data-wb-action='addFolder']").trigger('click');
            } else if ($(this).hasClass('workbookRenameInput')) {
                $(this).closest('.workbookFolderTools').find("[data-wb-action='renameFolder']").trigger('click');
            } else {
                this.blur();
            }
        });

    $('#btnSaveToWorkbook').off('click.workbook').on('click.workbook', () => showSaveForm());
    $('#btnWorkbookSaveConfirm').off('click.workbook').on('click.workbook', () => { void run(saveToWorkbook); });
    $('#btnWorkbookSaveCancel').off('click.workbook').on('click.workbook', hideSaveForm);
    $('#divSaveToWorkbook').off('.workbook')
        .on('click.workbook', '#btnWorkbookFixName', () => {
            $('#txtWorkbookSongName').val(sanitizeName($('#txtWorkbookSongName').val()));
            showSaveError('');
        })
        .on('keydown.workbook', '#txtWorkbookSongName', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void run(saveToWorkbook);
            }
        });
}

async function createModel() {
    try {
        const adapter = await openIndexedDbAdapter();
        const created = new WorkbookModel(adapter);
        await created.init();
        ui.persistent = true;
        return created;
    } catch (error) {
        console.warn('Workbook: IndexedDB is unavailable, the Workbook will not be saved in this browser.', error);
        ui.persistent = false;
        return new WorkbookModel(createMemoryAdapter()).init();
    }
}

/** Call once at startup.
 *  @param {{
 *    getPersistentSongFile: () => string,
 *    getSongProgressState: () => {progress: object|null, includeInLooping: number[]|null},
 *    getLibraryHref: () => string,
 *    getFilenameBoxValue: () => string,
 *    getCurrentWorkbookPath: () => string,
 *    setCurrentWorkbookPath: (path: string) => void,
 *    openWorkbookSong: (path: string, text: string) => boolean,
 *    confirm?: (message: string) => boolean
 *  }} p */
export async function initializeWorkbook(p) {
    providers = p;
    model = await createModel();
    bindEvents();
    render();
    document.addEventListener('visibilitychange', () => {
        const typing = container()[0]?.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT';
        if (document.visibilityState === 'visible' && model && !typing) {
            void run(async () => {
                await model.init();   // another tab may have changed the Workbook
                render();
            });
        }
    });
}

/** Sprint 157 it2: what the Workbook remembers about a Song ({progress, includeInLooping}), or null.
 *  Read synchronously from the in-memory list.  Used only for a Song that was opened from, or saved to, the Workbook. */
export function getWorkbookSongState(path) {
    return model ? model.getSongState(path) : null;
}

/** Remembers practice state for a Workbook Song (patch keys: progress, includeInLooping).  Not awaited by callers:
 *  the in-memory model already has the new state in the App, and a failed write is reported in the Workbook block. */
export function updateWorkbookSongState(path, patch) {
    if (!model || !path) {
        return Promise.resolve();
    }
    return model.setSongState(path, patch)
        .then((result) => {
            if (result.ok && result.changed) {
                refreshStatus();
            }
        })
        .catch((error) => {
            console.warn('Workbook: could not save practice state', error);
            setMessage(`Workbook error: ${error?.message || error}`, 'error');
            render();
        });
}
