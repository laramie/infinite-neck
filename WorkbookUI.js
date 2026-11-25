/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 157: the Workbook block on the File page (#divWorkbook) and the "Save to Workbook" form.
// Sprint 158: the Workbook is the first of any number of "mounts".  The built-in mount (id "workbook", #divWorkbook) is
// always there.  A mounted Workbook (a Tutorial from a .workbook.json file) is another block in #divWorkbookMounts, with its
// own IndexedDB database, its own model, and Unmount / Download / Discard buttons.
//
// renderWorkbookHtml() is pure (a string builder, like SongLibrary.js) and is what Jest tests.  The rest is the
// browser-side controllers: each owns one WorkbookModel and re-renders after every change.
// Styles: song-library.css (the Workbook reuses the Library classes).

import { escapeHtml, renderInstrumentBadges } from './InstrumentRoleBadges.js';
import { getSanitizedWorkbookDescription } from './html-sanitizer.js';
import { renderProgressBadgeHtml } from './SongLibrary.js';
import { getProgressBadgeModel, isStrictTutorialLevel } from './Tutorial.js';
import {
    BUILTIN_MOUNT_ID,
    MAX_CAPTION_LENGTH,
    MAX_COMMENT_LENGTH,
    MAX_FOLDER_DESCRIPTION_LENGTH,
    MAX_NAME_LENGTH,
    MAX_WORKBOOK_DESCRIPTION_LENGTH,
    WorkbookModel,
    applyLedgerToParsed,
    clearProgressLedger,
    defaultSongBaseName,
    describeBackup,
    formatBytes,
    isBackupStale,
    isLibraryWorkbookHref,
    ledgerFromEntries,
    makeSongPath,
    mountDbName,
    mountIdFromFileName,
    parseWorkbookFile,
    pathKey,
    readMountRegistry,
    readProgressLedger,
    sanitizeName,
    splitPath,
    uniqueMountId,
    validateSongBaseName,
    validateSongPath,
    workbookDownloadName,
    writeMountRegistry,
    writeProgressLedger
} from './Workbook.js';
import { WORKBOOK_DB_NAME, createMemoryAdapter, deleteIndexedDb, openIndexedDbAdapter } from './WorkbookStorage.js';

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

/** Unmount is allowed only when the last Download is up to date.  Discard is for the other case: it throws the changes away.
 *  Download is always allowed. */
export function renderMountControls(meta = {}) {
    const changes = meta.changesSinceBackup || 0;
    const unmountHint = changes > 0 ? `${plural(changes, 'change')} not downloaded yet.  Download first, or use Discard.` : 'Remove this Tutorial from this browser (your Done and Bookmark marks are remembered)';
    const discardHint = changes > 0 ? 'Remove this Tutorial and throw away the changes that were not downloaded' : 'Nothing to discard: the last Download is up to date.  Use Unmount.';
    return "<div class='workbookMountControls'>"
        + `<button type='button' data-wb-action='unmount'${changes > 0 ? ' disabled' : ''} title='${attr(unmountHint)}'>Unmount</button> `
        + `<button type='button' data-wb-action='download' title='Download this Workbook as a .workbook.json file'>Download</button> `
        + `<button type='button' data-wb-action='discard'${changes > 0 ? '' : ' disabled'} title='${attr(discardHint)}'>Discard</button>`
        + '</div>';
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

/** Caption (plain text, escaped) and description (HTML, sanitized every time it is shown).  '' when there is neither. */
function renderInfoDisplay(info, sanitizeHtml, extraClass) {
    const caption = info.caption ? `<div class='workbookInfoCaptionText'>${escapeHtml(info.caption)}</div>` : '';
    const description = info.description ? `<div class='workbookInfoDescriptionText'>${sanitizeHtml(info.description)}</div>` : '';
    return caption || description ? `<div class='workbookInfoBlock ${extraClass}'>${caption}${description}</div>` : '';
}

const DESCRIPTION_HELP = 'Basic HTML only.  Links may go to the help pages, or open a Song of this Workbook as &lt;a href="#open=name.json"&gt; or "#open=Folder/name.json".';

function renderInfoEditor(scope, values, folderName, errorText) {
    const isWorkbook = scope === 'workbook';
    let html = `<div class='workbookInfoEditor' data-wb-scope='${scope}'${isWorkbook ? '' : ` data-wb-folder='${attr(folderName)}'`}>`;
    if (errorText) {
        html += `<div class='workbookMessage workbookMessageError'>${escapeHtml(errorText)}</div>`;
    }
    if (isWorkbook) {
        html += `<label>Id <input type='text' class='workbookEditId' size='24' maxlength='64' value='${attr(values.id || '')}'></label> `;
        html += `<label>Version <input type='text' class='workbookEditVersion' size='8' maxlength='32' value='${attr(values.version || '')}'></label> `;
    }
    html += `<label class='workbookEditRow'>Caption <input type='text' class='workbookEditCaption' size='50' maxlength='${MAX_CAPTION_LENGTH}' value='${attr(values.caption || '')}'></label>`;
    html += `<label class='workbookEditRow'>Description <textarea class='workbookEditDescription' rows='6' cols='70' maxlength='${isWorkbook ? MAX_WORKBOOK_DESCRIPTION_LENGTH : MAX_FOLDER_DESCRIPTION_LENGTH}'>${escapeHtml(values.description || '')}</textarea></label>`;
    html += `<div class='workbookEditHelp'>${DESCRIPTION_HELP}</div>`;
    html += "<button type='button' data-wb-action='saveInfo'>Save</button> <button type='button' data-wb-action='cancelInfo'>Cancel</button>";
    return `${html}</div>`;
}

function renderSongRow(song, ui = {}) {
    const { filename } = splitPath(song.path);
    const path = attr(song.path);
    const caption = song.caption || '';
    const linkText = escapeHtml(caption || filename);
    const fileNote = caption ? `<span class='workbookFileName'>${escapeHtml(filename)}</span>` : '';
    const badge = isStrictTutorialLevel(song.tutorial) ? renderProgressBadgeHtml(getProgressBadgeModel(song, song.progress || {})) : '';
    const instruments = Array.isArray(song.instruments) && song.instruments.length ? `<div class='workbookRowBadges'>${renderInstrumentBadges(song.instruments)}</div>` : '';
    return (
        "<div class='songLibraryRow workbookRow'>"
        + "<div class='songLibraryCell songLibraryCellLink'>"
        + `<a href='#' data-wb-action='openSong' data-wb-path='${path}' title='${path}'>${linkText}</a>`
        + fileNote
        + badge
        + '</div>'
        + "<div class='songLibraryCell songLibraryCellDescription'>"
        + instruments
        + `<input type='text' class='workbookComment' data-wb-path='${path}' maxlength='${MAX_COMMENT_LENGTH}' value='${attr(song.comment || '')}' placeholder='Progress notes' aria-label='Comment for ${path}'>`
        + '</div>'
        + "<div class='songLibraryCell workbookCellActions'>"
        + renderMoveButtons('song', `data-wb-path='${path}'`, song, ui)
        + `<button type='button' class='ssRemove btnRemoveTuning' data-wb-action='removeSong' data-wb-path='${path}' title='Remove ${path} from the Workbook' aria-label='Remove ${path} from the Workbook'>${GLYPH_REMOVE}</button>`
        + '</div>'
        + '</div>'
    );
}

/** How many Songs of a folder are completely Done (every Section ticked), counting only strict Tutorial Songs. */
function countDoneTutorialSongs(songs) {
    let tutorials = 0;
    let done = 0;
    songs.forEach((song) => {
        if (!isStrictTutorialLevel(song.tutorial) || !(song.SectionCount > 0)) {
            return;
        }
        tutorials++;
        const badge = getProgressBadgeModel(song, song.progress || {});
        if (badge && badge.doneCount >= badge.sectionCount) {
            done++;
        }
    });
    return { tutorials, done };
}

function renderFolder(folder, ui, groupName, sanitizeHtml) {
    const name = attr(folder.name);
    const isOpen = ui.openFolders instanceof Set && ui.openFolders.has(folder.name);
    const hasSongs = folder.songs.length > 0;
    const { tutorials, done } = countDoneTutorialSongs(folder.songs);
    const countText = plural(folder.songs.length, 'song') + (tutorials > 0 ? `, ${done} done` : '');
    const editing = ui.editing && ui.editing.scope === 'folder' && ui.editing.name === folder.name ? ui.editing : null;
    const heading = folder.caption
        ? `${escapeHtml(folder.caption)} <span class='workbookFolderName'>${escapeHtml(folder.name)}</span>`
        : escapeHtml(folder.name);
    let html = `<details class='songLibraryDirectoryDetails workbookFolderDetails' name='${attr(groupName)}' data-wb-folder='${name}'${isOpen ? ' open' : ''}>`;
    html += `<summary class='songLibrarySummary songLibraryDirectorySummary'>${heading} <span class='workbookCounts'>(${countText})</span></summary>`;
    html += "<div class='songLibraryDirectoryBody'><div class='songLibraryRows'>";
    html += "<div class='workbookFolderToolRow'><div class='workbookFolderTools workbookFolderControls'>";
    html += `<input type='text' class='workbookRenameInput' size='18' maxlength='${MAX_NAME_LENGTH}' value='${name}' aria-label='New name for folder ${name}'> `;
    html += `<button type='button' data-wb-action='renameFolder' data-wb-folder='${name}'>Rename folder</button> `;
    html += `<button type='button' data-wb-action='editFolderInfo' data-wb-folder='${name}' title='Edit the caption and description of this folder'>Edit info</button> `;
    html += renderMoveButtons('folder', `data-wb-folder='${name}'`, folder, ui);
    html += `<button type='button' class='ssRemove btnRemoveTuning' data-wb-action='deleteFolder' data-wb-folder='${name}'${hasSongs ? " disabled title='Remove the Songs first'" : " title='Delete this empty folder'"} aria-label='Delete folder ${name}'>${GLYPH_REMOVE}</button>`;
    html += '</div></div>';
    html += editing
        ? renderInfoEditor('folder', editing.draft || folder, folder.name, editing.error)
        : renderInfoDisplay({ caption: '', description: folder.description || '' }, sanitizeHtml, 'workbookFolderInfo');
    folder.songs.forEach((song) => {
        html += renderSongRow(song, ui);
    });
    html += '</div></div></details>';
    return html;
}

/** @param view the result of WorkbookModel.getView()
 *  @param {{rootOpen?:boolean, openFolders?:Set<string>, message?:{text:string, kind?:string}|null, persistent?:boolean,
 *           sort?:{key:string, dir:number}, builtIn?:boolean, mountId?:string, label?:string,
 *           editing?:{scope:'workbook'|'folder', name?:string, draft?:object, error?:string}|null,
 *           sanitizeHtml?:(html:string)=>string}} [ui]
 *  `builtIn` is true (the default) for the Workbook, false for a mounted Tutorial. */
export function renderWorkbookHtml(view, ui = {}) {
    const builtIn = ui.builtIn !== false;
    const label = builtIn ? 'Workbook' : (ui.label || ui.mountId || 'Workbook');
    const groupName = builtIn ? 'workbookFolderGroup' : `workbookFolderGroup-${ui.mountId || label}`;
    const sanitizeHtml = ui.sanitizeHtml || getSanitizedWorkbookDescription;
    const info = view.info || {};
    const counts = `${plural(view.songCount, 'song')}, ${plural(view.folderCount, 'folder')}, ${formatBytes(view.totalBytes)}`;
    const editingWorkbook = ui.editing && ui.editing.scope === 'workbook' ? ui.editing : null;

    let html = `<details class='songLibraryRootDetails workbookRootDetails'${ui.rootOpen ? ' open' : ''}>`;
    html += `<summary class='songLibrarySummary'>${escapeHtml(label)} <span class='workbookCounts'>(${escapeHtml(counts)})</span></summary>`;
    html += "<div class='songLibraryBody workbookBody'>";

    if (ui.persistent === false) {
        html += builtIn
            ? "<div class='workbookNotice'>The Workbook is not saved in this browser (storage is unavailable).  Use Download Workbook to keep your work.</div>"
            : "<div class='workbookNotice'>This Tutorial is not saved in this browser (storage is unavailable).  It is gone when the page is closed.</div>";
    }
    html += "<div class='workbookToolbox'>";
    html += "<div class='workbookToolbar'>";
    if (builtIn) {
        html += "<button type='button' data-wb-action='download'>Download Workbook</button> ";
        html += "<label class='workbookOpenLabel'>Open Workbook: <input type='file' id='workbookFileInput' accept='.json,application/json'></label> ";
    }
    html += "<button type='button' data-wb-action='editInfo' title='Edit the id, version, caption and description of this Workbook'>Edit info</button>";
    html += '</div>';
    html += renderStatusLine(view.meta);
    if (!builtIn) {
        html += renderMountControls(view.meta);
    }
    if (ui.message && ui.message.text) {
        html += `<div class='workbookMessage ${ui.message.kind === 'error' ? 'workbookMessageError' : 'workbookMessageInfo'}'>${escapeHtml(ui.message.text)}</div>`;
    }
    html += "<div class='workbookToolbar'>";
    html += `<input type='text' class='workbookNewFolderInput'${builtIn ? " id='workbookNewFolderName'" : ''} size='20' maxlength='${MAX_NAME_LENGTH}' placeholder='new-folder-name' aria-label='New folder name'> `;
    html += "<button type='button' data-wb-action='addFolder'>+ New Folder</button>";
    html += '</div>';
    html += renderSortBar(ui.sort);
    html += '</div>';

    html += editingWorkbook
        ? renderInfoEditor('workbook', editingWorkbook.draft || info, '', editingWorkbook.error)
        : renderInfoDisplay(info, sanitizeHtml, 'workbookMainInfo');

    html += "<div class='songLibraryRows'>";
    if (view.songCount === 0 && view.folderCount === 0) {
        html += builtIn
            ? "<div class='songLibraryRow songLibraryIntroRow'><div class='songLibraryCell songLibraryCellIntro'>The Workbook is empty.  Use <b>Save to Workbook</b> next to <b>Download Song</b> to add the current Song.</div></div>"
            : "<div class='songLibraryRow songLibraryIntroRow'><div class='songLibraryCell songLibraryCellIntro'>This Workbook has no Songs.</div></div>";
    }
    view.rootSongs.forEach((song) => {
        html += renderSongRow(song, ui);
    });
    html += '</div>';
    view.folders.forEach((folder) => {
        html += renderFolder(folder, ui, groupName, sanitizeHtml);
    });
    html += '</div></details>';
    return html;
}

//==================== browser-side: providers, mounts ====================

let providers = null;
const controllers = new Map();   // pathKey(mountId) -> controller; the built-in one first
let mountsMessage = null;

function storage() {
    try {
        return globalThis.localStorage || null;
    } catch {
        return null;
    }
}

function getController(mountId) {
    return controllers.get(pathKey(mountId || BUILTIN_MOUNT_ID)) || null;
}

function createController({ mountId, builtIn = false }) {
    return {
        mountId,
        builtIn,
        dbName: builtIn ? WORKBOOK_DB_NAME : mountDbName(mountId),
        adapter: null,
        model: null,
        ui: {
            rootOpen: false,
            openFolders: new Set(),
            message: null,
            persistent: true,
            lastFolder: '',
            sort: { key: 'list', dir: 1 },   // display only: never stored, back to list order at launch and when a Workbook is opened
            editing: null,
            builtIn,
            mountId,
            label: builtIn ? 'Workbook' : mountId,
            sanitizeHtml: getSanitizedWorkbookDescription
        }
    };
}

function container(ctl) {
    return ctl.builtIn ? $('#divWorkbook') : $(`#divWorkbookMount-${ctl.mountId}`);
}

function setMessage(ctl, text, kind = 'info') {
    ctl.ui.message = text ? { text, kind } : null;
}

function captureOpenState(ctl) {
    const root = container(ctl).find('.workbookRootDetails');
    if (root.length) {
        ctl.ui.rootOpen = root.prop('open') === true;
        ctl.ui.openFolders = new Set();
        container(ctl).find('details[data-wb-folder]').each(function () {
            if (this.open) {
                ctl.ui.openFolders.add($(this).attr('data-wb-folder'));
            }
        });
    }
}

/** @param {boolean} [capture=true] false when the caller has just set ui.rootOpen / ui.openFolders on purpose */
function render(ctl, capture = true) {
    const jq = container(ctl);
    if (!jq.length || !ctl.model) {
        return;
    }
    if (capture) {
        captureOpenState(ctl);
    }
    jq.show().html(renderWorkbookHtml(ctl.model.getView({ sortKey: ctl.ui.sort.key, sortDir: ctl.ui.sort.dir }), ctl.ui));
}

function refreshStatus(ctl) {
    const meta = ctl.model.getView().meta;
    const jq = container(ctl);
    jq.find('.workbookStatus').replaceWith(renderStatusLine(meta));
    if (!ctl.builtIn) {
        jq.find('.workbookMountControls').replaceWith(renderMountControls(meta));
    }
}

function askConfirm(message) {
    return providers.confirm ? providers.confirm(message) : globalThis.confirm(message);
}

function staleNote(ctl) {
    const meta = ctl.model.getView().meta;
    return isBackupStale(meta) ? '\n\nThe Workbook has changes that were not downloaded yet.' : '';
}

async function run(ctl, task) {
    try {
        await task();
    } catch (error) {
        console.warn('Workbook error', error);
        setMessage(ctl, `Workbook error: ${error?.message || error}`, 'error');
        render(ctl);
    }
}

function setMountsMessage(text, kind = 'info') {
    mountsMessage = text ? { text, kind } : null;
    refreshMountChrome();
}

/** The hint under the Workbook, and the mount choices of the Save form. */
function refreshMountChrome() {
    const mounted = [...controllers.values()].filter((ctl) => !ctl.builtIn);
    let html = '';
    if (mountsMessage) {
        html += `<div class='workbookMessage ${mountsMessage.kind === 'error' ? 'workbookMessageError' : 'workbookMessageInfo'}'>${escapeHtml(mountsMessage.text)}</div>`;
    }
    if (mounted.length === 0) {
        html += "<div class='workbookMountsHint'>No Tutorials are mounted.  Use <b>Open Tutorial</b>, or <b>Mount as Tutorial</b> in the Song Library.</div>";
    }
    $('#divWorkbookMountsStatus').html(html);

    const select = $('#selWorkbookMount');
    if (select.length) {
        const previous = `${select.val() || ''}`;
        let options = '';
        [...controllers.values()].forEach((ctl) => {
            options += `<option value='${attr(ctl.mountId)}'>${escapeHtml(ctl.builtIn ? 'Workbook' : ctl.mountId)}</option>`;
        });
        select.html(options);
        select.val(getController(previous) ? getController(previous).mountId : BUILTIN_MOUNT_ID);
    }
}

function persistRegistry() {
    const ids = [...controllers.values()].filter((ctl) => !ctl.builtIn && ctl.ui.persistent).map((ctl) => ctl.mountId);
    writeMountRegistry(storage(), ids);
}

async function openModel(ctl) {
    try {
        ctl.adapter = await openIndexedDbAdapter(undefined, ctl.dbName);
        ctl.model = new WorkbookModel(ctl.adapter);
        await ctl.model.init();
        ctl.ui.persistent = true;
    } catch (error) {
        console.warn(`Workbook ${ctl.mountId}: IndexedDB is unavailable, it will not be saved in this browser.`, error);
        ctl.ui.persistent = false;
        ctl.adapter = createMemoryAdapter();
        ctl.model = new WorkbookModel(ctl.adapter);
        await ctl.model.init();
    }
}

function addMountDom(ctl) {
    const host = $('#divWorkbookMounts');
    if (!host.length) {
        return false;
    }
    host.append(`<div id='divWorkbookMount-${ctl.mountId}' class='workbookMountBlock'></div>`);
    return true;
}

function registerController(ctl) {
    controllers.set(pathKey(ctl.mountId), ctl);
}

/** Mounts a parsed Workbook file as a new mount (or in place of the mount with the same id).  Returns the controller or null. */
async function mountParsed(parsed, fileName) {
    const info = parsed.info || {};
    const usableId = info.id && pathKey(info.id) !== BUILTIN_MOUNT_ID ? info.id : '';
    const existing = usableId ? getController(usableId) : null;
    let mountId;
    if (existing) {
        const changes = existing.model.getView().meta.changesSinceBackup;
        const question = `"${existing.mountId}" is already mounted${changes > 0 ? ` and has ${plural(changes, 'change')} that were not downloaded` : ''}.\n\nMount "${fileName}" in its place?  Your Done and Bookmark marks are kept.`;
        if (!askConfirm(question)) {
            return null;
        }
        await unmountController(existing, { saveLedger: true });
        mountId = existing.mountId;
    } else {
        mountId = uniqueMountId(usableId || mountIdFromFileName(fileName), [...controllers.values()].map((ctl) => ctl.mountId));
    }
    if (!$('#divWorkbookMounts').length) {
        throw new Error('There is no place on this page for a mounted Tutorial.');
    }
    applyLedgerToParsed(parsed, readProgressLedger(storage(), mountId));
    const ctl = createController({ mountId });
    await openModel(ctl);
    await ctl.model.replaceFromParsed(parsed);
    registerController(ctl);
    addMountDom(ctl);
    bindMountEvents(ctl);
    ctl.ui.rootOpen = true;
    setMessage(ctl, `Mounted ${fileName}: ${plural(parsed.songs.length, 'song')}, ${plural(parsed.folders.length, 'folder')}`);
    render(ctl, false);
    persistRegistry();
    refreshMountChrome();
    return ctl;
}

async function unmountController(ctl, { saveLedger = false, clearLedger = false } = {}) {
    if (clearLedger) {
        clearProgressLedger(storage(), ctl.mountId);
    } else if (saveLedger) {
        writeProgressLedger(storage(), ctl.mountId, ledgerFromEntries(ctl.model.entries.values()));
    }
    try {
        ctl.adapter?.close?.();
        await deleteIndexedDb(ctl.dbName);
    } catch (error) {
        console.warn('Workbook: could not delete the database of an unmounted Tutorial', error);
    }
    container(ctl).remove();
    controllers.delete(pathKey(ctl.mountId));
    if (providers.getCurrentWorkbookMount() === ctl.mountId) {
        providers.setCurrentWorkbook('', '');
    }
    persistRegistry();
    refreshMountChrome();
}

async function restoreMounts() {
    for (const { mountId } of readMountRegistry(storage())) {
        const ctl = createController({ mountId });
        try {
            await openModel(ctl);
        } catch (error) {
            console.warn(`Workbook: could not restore ${mountId}`, error);
            continue;
        }
        if (!ctl.ui.persistent || ctl.model.isEmpty()) {
            ctl.adapter?.close?.();
            await deleteIndexedDb(ctl.dbName).catch(() => {});   // the database was lost: forget the mount
            continue;
        }
        registerController(ctl);
        if (addMountDom(ctl)) {
            bindMountEvents(ctl);
            render(ctl, false);
        }
    }
    persistRegistry();
    refreshMountChrome();
}

async function mountFromText(text, fileName) {
    const parsed = parseWorkbookFile(text, { sanitizeHtml: getSanitizedWorkbookDescription });
    if (!parsed.ok) {
        setMountsMessage(`Could not mount ${fileName}: ${parsed.error}`, 'error');
        return null;
    }
    const ctl = await mountParsed(parsed, fileName);
    if (ctl) {
        setMountsMessage('');
        const block = container(ctl)[0];
        block?.scrollIntoView?.({ block: 'nearest' });
    }
    return ctl;
}

/** Open Tutorial: a .workbook.json file from disk becomes a new mount. */
async function openTutorialFile(file) {
    try {
        await mountFromText(await file.text(), file.name);
    } catch (error) {
        console.warn('Workbook: mount failed', error);
        setMountsMessage(`Could not mount ${file.name}: ${error?.message || error}`, 'error');
    }
}

/** Mount as Tutorial: a .workbook.json file of the Song Library (href is relative to songs/, e.g. "tutorials/C000-intro.workbook.json"). */
export async function mountLibraryWorkbook(href) {
    if (!isLibraryWorkbookHref(href)) {
        setMountsMessage(`"${`${href}`.slice(0, 80)}" is not a Workbook file of the Song Library.`, 'error');
        return;
    }
    try {
        const text = await $.ajax({ url: `songs/${href}`, dataType: 'text' });
        await mountFromText(text, href.split('/').pop());
    } catch (error) {
        console.warn('Workbook: library mount failed', error);
        setMountsMessage(`Could not load songs/${href}.`, 'error');
    }
}

/** Download (Song Library): the .workbook.json file itself, to open later, or on another computer, with Open Tutorial. */
export function downloadLibraryWorkbook(href) {
    if (!isLibraryWorkbookHref(href)) {
        return;
    }
    const a = document.createElement('a');
    a.setAttribute('href', `songs/${href}`);
    a.setAttribute('download', href.split('/').pop());
    a.click();
}

//==================== browser-side: save form ====================

function selectedController() {
    return getController($('#selWorkbookMount').val()) || getController(BUILTIN_MOUNT_ID);
}

function renderSaveFormFolders(ctl, selected) {
    const select = $('#selWorkbookFolder');
    if (!select.length || !ctl) {
        return;
    }
    const view = ctl.model.getView();
    let html = "<option value=''>(Workbook root)</option>";
    view.folders.forEach((folder) => {
        html += `<option value='${attr(folder.name)}'>${escapeHtml(folder.name)}</option>`;
    });
    select.html(html);
    select.val(view.folders.some((folder) => folder.name === selected) ? selected : '');
}

function showSaveError(text, fixable = false) {
    const target = $('#spanWorkbookSaveError');
    target.empty().text(text);
    if (text && fixable) {
        target.append(" <button type='button' id='btnWorkbookFixName'>Fix name</button>");
    }
}

function showSaveForm() {
    if (!getController(BUILTIN_MOUNT_ID)) {
        return;
    }
    refreshMountChrome();
    const currentMount = providers.getCurrentWorkbookMount();
    const target = getController(currentMount) || getController(BUILTIN_MOUNT_ID);
    $('#selWorkbookMount').val(target.mountId);
    const current = currentMount === target.mountId ? providers.getCurrentWorkbookPath() : '';
    renderSaveFormFolders(target, current ? splitPath(current).folder : target.ui.lastFolder);
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
    const ctl = selectedController();
    const model = ctl.model;
    const folder = `${$('#selWorkbookFolder').val() || ''}`;
    const base = validateSongBaseName($('#txtWorkbookSongName').val());
    if (!base.ok) {
        showSaveError(base.error, base.fixable);
        return;
    }
    const path = makeSongPath(folder, base.value);
    const existing = model.getEntry(path);
    const sameAsOpened = providers.getCurrentWorkbookMount() === ctl.mountId && pathKey(providers.getCurrentWorkbookPath()) === pathKey(path);
    if (existing && !sameAsOpened && !askConfirm(`"${existing.path}" is already in ${ctl.builtIn ? 'the Workbook' : `"${ctl.mountId}"`}.  Replace it?`)) {
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
    providers.setCurrentWorkbook(ctl.mountId, result.path);
    ctl.ui.lastFolder = folder;
    setMessage(ctl, '');
    hideSaveForm();
    $('#spanWorkbookSaveMessage').text(`${result.replaced ? 'Replaced' : 'Saved'} ${ctl.builtIn ? 'Workbook' : ctl.mountId}/${result.path}`);
    // show the Song where it landed: open its folder (the accordion keeps one folder open)
    captureOpenState(ctl);
    ctl.ui.rootOpen = true;
    if (folder) {
        ctl.ui.openFolders = new Set([folder]);
    }
    render(ctl, false);
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

//==================== browser-side: Workbook actions ====================

async function openWorkbookSong(ctl, path) {
    const text = await ctl.model.getSongText(path);
    if (text === null) {
        setMessage(ctl, `"${path}" could not be read from the Workbook.`, 'error');
        render(ctl);
        return;
    }
    providers.openWorkbookSong(ctl.mountId, path, text);
}

function isCurrent(ctl, path) {
    return providers.getCurrentWorkbookMount() === ctl.mountId && pathKey(providers.getCurrentWorkbookPath()) === pathKey(path);
}

async function removeSong(ctl, path) {
    if (!askConfirm(`Remove "${path}" from the Workbook?${staleNote(ctl)}`)) {
        return;
    }
    const result = await ctl.model.deleteSong(path);
    if (result.ok && isCurrent(ctl, path)) {
        providers.setCurrentWorkbook('', '');
    }
    setMessage(ctl, result.ok ? `Removed ${path}` : result.error, result.ok ? 'info' : 'error');
    render(ctl);
}

async function addFolder(ctl) {
    const input = container(ctl).find('.workbookNewFolderInput');
    const result = await ctl.model.addFolder(input.val());
    if (result.ok) {
        ctl.ui.openFolders = new Set([result.path]);
        ctl.ui.rootOpen = true;
        setMessage(ctl, `Added folder ${result.path}`);
    } else {
        setMessage(ctl, result.error, 'error');
    }
    render(ctl, !result.ok);
    if (!result.ok) {
        container(ctl).find('.workbookNewFolderInput').val(sanitizeName(input.val())).trigger('focus');
    }
}

async function renameFolder(ctl, name, newName) {
    captureOpenState(ctl);
    const result = await ctl.model.renameFolder(name, newName);
    if (result.ok) {
        const current = providers.getCurrentWorkbookPath();
        if (providers.getCurrentWorkbookMount() === ctl.mountId && current && splitPath(current).folder === name && result.path !== name) {
            providers.setCurrentWorkbook(ctl.mountId, makeSongPath(result.path, splitPath(current).base));
        }
        ctl.ui.openFolders = new Set([result.path]);
        setMessage(ctl, result.path === name ? '' : `Renamed folder ${name} to ${result.path}`);
    } else {
        setMessage(ctl, result.error, 'error');
    }
    render(ctl, !result.ok);
}

async function deleteFolder(ctl, name) {
    if (!askConfirm(`Delete the empty folder "${name}"?${staleNote(ctl)}`)) {
        return;
    }
    captureOpenState(ctl);
    const result = await ctl.model.deleteFolder(name);
    ctl.ui.openFolders.delete(name);
    setMessage(ctl, result.ok ? `Deleted folder ${name}` : result.error, result.ok ? 'info' : 'error');
    render(ctl, false);
}

async function moveEntry(ctl, path, direction) {
    const result = await ctl.model.moveEntry(path, direction);
    setMessage(ctl, result.ok ? '' : result.error, 'error');
    render(ctl);
}

function setSort(ctl, key) {
    const { ui } = ctl;
    if (key === 'list') {
        ui.sort = { key: 'list', dir: 1 };   // list order never reverses
    } else if (ui.sort.key === key) {
        ui.sort = { key, dir: -ui.sort.dir };
    } else {
        ui.sort = { key, dir: key === 'date' ? -1 : 1 };   // newest first, A to Z
    }
    render(ctl);   // keeps the open and closed folders as they are
}

async function downloadWorkbook(ctl) {
    const { text } = await ctl.model.exportFile();
    const info = ctl.model.getInfo();
    const name = workbookDownloadName(new Date(), info.id || (ctl.builtIn ? '' : ctl.mountId));
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', name);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    await ctl.model.markBackedUp();
    setMessage(ctl, `Downloaded ${name}`);
    render(ctl);
}

/** "Open Workbook" of the built-in Workbook.  A file that says suggestedMount "tutorial" is offered as a Tutorial mount instead. */
async function openWorkbookFile(ctl, file) {
    const text = await file.text();
    const parsed = parseWorkbookFile(text, { sanitizeHtml: getSanitizedWorkbookDescription });
    if (!parsed.ok) {
        setMessage(ctl, `Could not open ${file.name}: ${parsed.error}`, 'error');
        render(ctl);
        return;
    }
    if (parsed.info.suggestedMount === 'tutorial') {
        const question = `"${file.name}" is a Tutorial Workbook, made to be mounted next to your Workbook instead of replacing it.\n\nOK: mount it as a Tutorial (recommended).\nCancel: do nothing.`;
        if (askConfirm(question)) {
            await mountFromText(text, file.name);
        }
        render(ctl);   // also clears the file input
        return;
    }
    if (!ctl.model.isEmpty()) {
        const view = ctl.model.getView();
        let question = `Replace the Workbook in this browser (${plural(view.songCount, 'song')}) with "${file.name}" (${plural(parsed.songs.length, 'song')})?`;
        if (view.meta.changesSinceBackup > 0) {
            question += `\n\nThe current Workbook has ${plural(view.meta.changesSinceBackup, 'change')} that were not downloaded.  Choose Cancel, then use Download Workbook first, if you want to keep them.`;
        }
        if (!askConfirm(question)) {
            render(ctl);   // also clears the file input
            return;
        }
    }
    await ctl.model.replaceFromParsed(parsed);
    if (providers.getCurrentWorkbookMount() === ctl.mountId) {
        providers.setCurrentWorkbook('', '');
    }
    ctl.ui.openFolders = new Set();
    ctl.ui.rootOpen = true;
    ctl.ui.editing = null;
    ctl.ui.sort = { key: 'list', dir: 1 };
    setMessage(ctl, `Opened ${file.name}: ${plural(parsed.songs.length, 'song')}, ${plural(parsed.folders.length, 'folder')}`);
    render(ctl, false);
}

async function unmountAction(ctl) {
    const changes = ctl.model.getView().meta.changesSinceBackup;
    if (changes > 0) {
        setMessage(ctl, `${plural(changes, 'change')} not downloaded yet.  Use Download first, or Discard.`, 'error');
        render(ctl);
        return;
    }
    await unmountController(ctl, { saveLedger: true });
}

async function discardAction(ctl) {
    const changes = ctl.model.getView().meta.changesSinceBackup;
    if (changes === 0) {
        return;
    }
    const question = `Discard "${ctl.mountId}"?\n\nIt will be removed from this browser, and its ${plural(changes, 'change')} that were not downloaded, with the Done and Bookmark marks, are lost.`;
    if (!askConfirm(question)) {
        return;
    }
    await unmountController(ctl, { clearLedger: true });
}

//---- editing the description (Workbook and folders) ----

function readEditor($editor) {
    return {
        id: $editor.find('.workbookEditId').val(),
        version: $editor.find('.workbookEditVersion').val(),
        caption: $editor.find('.workbookEditCaption').val(),
        description: $editor.find('.workbookEditDescription').val()
    };
}

async function saveInfo(ctl, $editor) {
    const values = readEditor($editor);
    const sanitizeHtml = ctl.ui.sanitizeHtml;
    let result;
    if ($editor.attr('data-wb-scope') === 'folder') {
        const name = $editor.attr('data-wb-folder');
        result = await ctl.model.setFolderInfo(name, { caption: values.caption, description: values.description }, { sanitizeHtml });
        if (!result.ok) {
            ctl.ui.editing = { scope: 'folder', name, draft: { name, ...values }, error: result.error };
            render(ctl);
            return;
        }
    } else {
        result = await ctl.model.setWorkbookInfo(values, { sanitizeHtml });
        if (!result.ok) {
            ctl.ui.editing = { scope: 'workbook', draft: values, error: result.error };
            render(ctl);
            return;
        }
    }
    ctl.ui.editing = null;
    setMessage(ctl, result.changed ? 'Saved.' : '');
    render(ctl);
}

function handleAction(ctl, action, $el) {
    const path = $el.attr('data-wb-path') || '';
    const folder = $el.attr('data-wb-folder') || '';
    switch (action) {
        case 'openSong': return openWorkbookSong(ctl, path);
        case 'removeSong': return removeSong(ctl, path);
        case 'addFolder': return addFolder(ctl);
        case 'renameFolder': return renameFolder(ctl, folder, $el.closest('.workbookFolderTools').find('.workbookRenameInput').val());
        case 'deleteFolder': return deleteFolder(ctl, folder);
        case 'moveUp': return moveEntry(ctl, path, -1);
        case 'moveDown': return moveEntry(ctl, path, 1);
        case 'moveFolderUp': return moveEntry(ctl, folder, -1);
        case 'moveFolderDown': return moveEntry(ctl, folder, 1);
        case 'sort': setSort(ctl, $el.attr('data-wb-sort')); return undefined;
        case 'download': return downloadWorkbook(ctl);
        case 'unmount': return unmountAction(ctl);
        case 'discard': return discardAction(ctl);
        case 'editInfo':
            captureOpenState(ctl);
            ctl.ui.editing = { scope: 'workbook' };
            render(ctl, false);
            return undefined;
        case 'editFolderInfo':
            captureOpenState(ctl);
            ctl.ui.editing = { scope: 'folder', name: folder };
            render(ctl, false);
            return undefined;
        case 'cancelInfo':
            ctl.ui.editing = null;
            render(ctl);
            return undefined;
        case 'saveInfo': return saveInfo(ctl, $el.closest('.workbookInfoEditor'));
        default: return undefined;
    }
}

/** A link of a description, <a href="#open=Folder/name.json">, opens that Song of the same Workbook. */
async function openDescriptionLink(ctl, href) {
    let path = '';
    try {
        path = decodeURIComponent(href.replace(/^#open=/, ''));
    } catch {
        return;
    }
    const checked = validateSongPath(path);
    if (!checked.ok || !ctl.model.getEntry(checked.value) || ctl.model.getEntry(checked.value).kind !== 'song') {
        setMessage(ctl, `"${path.slice(0, 80)}" is not a Song of this Workbook.`, 'error');
        render(ctl);
        return;
    }
    await openWorkbookSong(ctl, ctl.model.getEntry(checked.value).path);
}

function bindMountEvents(ctl) {
    container(ctl).off('.workbook')
        .on('click.workbook', '[data-wb-action]', function (event) {
            event.preventDefault();
            void run(ctl, () => handleAction(ctl, $(this).attr('data-wb-action'), $(this)));
        })
        .on('click.workbook', "a[href^='#open=']", function (event) {
            event.preventDefault();
            void run(ctl, () => openDescriptionLink(ctl, $(this).attr('href')));
        })
        .on('change.workbook', '.workbookComment', function () {
            const path = $(this).attr('data-wb-path');
            void run(ctl, async () => {
                const result = await ctl.model.setComment(path, $(this).val());
                if (!result.ok) {
                    setMessage(ctl, result.error, 'error');
                    render(ctl);
                } else if (result.changed) {
                    refreshStatus(ctl);
                }
            });
        })
        .on('change.workbook', '#workbookFileInput', function () {
            const file = this.files && this.files[0];
            if (file) {
                void run(ctl, () => openWorkbookFile(ctl, file));
            }
        })
        .on('keydown.workbook', 'input[type=text]', function (event) {
            if (event.key !== 'Enter') {
                return;
            }
            event.preventDefault();
            if ($(this).hasClass('workbookNewFolderInput')) {
                container(ctl).find("[data-wb-action='addFolder']").trigger('click');
            } else if ($(this).hasClass('workbookRenameInput')) {
                $(this).closest('.workbookFolderTools').find("[data-wb-action='renameFolder']").trigger('click');
            } else if ($(this).closest('.workbookInfoEditor').length) {
                $(this).closest('.workbookInfoEditor').find("[data-wb-action='saveInfo']").trigger('click');
            } else {
                this.blur();
            }
        });
}

function bindGlobalEvents() {
    $('#btnSaveToWorkbook').off('click.workbook').on('click.workbook', () => showSaveForm());
    $('#btnWorkbookSaveConfirm').off('click.workbook').on('click.workbook', () => { void run(selectedController(), saveToWorkbook); });
    $('#btnWorkbookSaveCancel').off('click.workbook').on('click.workbook', hideSaveForm);
    $('#selWorkbookMount').off('change.workbook').on('change.workbook', () => {
        renderSaveFormFolders(selectedController(), '');
    });
    $('#divSaveToWorkbook').off('.workbook')
        .on('click.workbook', '#btnWorkbookFixName', () => {
            $('#txtWorkbookSongName').val(sanitizeName($('#txtWorkbookSongName').val()));
            showSaveError('');
        })
        .on('keydown.workbook', '#txtWorkbookSongName', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void run(selectedController(), saveToWorkbook);
            }
        });
    $('#workbookMountFileInput').off('change.workbook').on('change.workbook', function () {
        const file = this.files && this.files[0];
        if (file) {
            void openTutorialFile(file).then(() => { this.value = ''; });
        }
    });
}

/** Call once at startup.
 *  @param {{
 *    getPersistentSongFile: () => string,
 *    getSongProgressState: () => {progress: object|null, includeInLooping: number[]|null},
 *    getLibraryHref: () => string,
 *    getFilenameBoxValue: () => string,
 *    getCurrentWorkbookPath: () => string,
 *    getCurrentWorkbookMount: () => string,
 *    setCurrentWorkbook: (mountId: string, path: string) => void,
 *    openWorkbookSong: (mountId: string, path: string, text: string) => boolean,
 *    confirm?: (message: string) => boolean
 *  }} p */
export async function initializeWorkbook(p) {
    providers = p;
    controllers.clear();
    const builtin = createController({ mountId: BUILTIN_MOUNT_ID, builtIn: true });
    await openModel(builtin);
    registerController(builtin);
    bindMountEvents(builtin);
    bindGlobalEvents();
    render(builtin);
    await restoreMounts();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') {
            return;
        }
        controllers.forEach((ctl) => {
            const active = document.activeElement;
            const typing = container(ctl)[0]?.contains(active) && (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA');
            if (!typing && ctl.model) {
                void run(ctl, async () => {
                    await ctl.model.init();   // another tab may have changed the Workbook
                    render(ctl);
                });
            }
        });
    });
}

/** Sprint 157 it2: what a Workbook remembers about a Song ({progress, includeInLooping}), or null.
 *  Read synchronously from the in-memory list.  Used only for a Song that was opened from, or saved to, a Workbook mount. */
export function getWorkbookSongState(mountId, path) {
    const ctl = getController(mountId);
    return ctl ? ctl.model.getSongState(path) : null;
}

/** Remembers practice state for a Workbook Song (patch keys: progress, includeInLooping).  Not awaited by callers:
 *  the in-memory model already has the new state in the App, and a failed write is reported in the Workbook block. */
export function updateWorkbookSongState(mountId, path, patch) {
    const ctl = getController(mountId);
    if (!ctl || !path) {
        return Promise.resolve();
    }
    return ctl.model.setSongState(path, patch)
        .then((result) => {
            if (result.ok && result.changed) {
                refreshStatus(ctl);
            }
        })
        .catch((error) => {
            console.warn('Workbook: could not save practice state', error);
            setMessage(ctl, `Workbook error: ${error?.message || error}`, 'error');
            render(ctl);
        });
}
