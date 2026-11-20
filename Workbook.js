/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 157: the Workbook.  Pure module (no DOM, no jQuery, no browser storage): names, the Workbook file format,
// and WorkbookModel, which keeps the list in memory and writes through a storage adapter (WorkbookStorage.js).
//
// Paths: a Song is "name.json" (Workbook root) or "folder/name.json".  Folders are one level deep.
// Order is order of addition: every entry gets a `seq`, folders and Songs share the counter.

export const WORKBOOK_FILE_TYPE = 'infinite-neck-workbook';
export const WORKBOOK_VERSION = 1;
export const WORKBOOK_LABEL = 'Workbook';

export const MAX_NAME_LENGTH = 64;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_SONGS = 1000;
export const MAX_FOLDERS = 200;
export const MAX_SONG_TEXT_LENGTH = 5 * 1024 * 1024;
export const STALE_BACKUP_CHANGES = 5;

const FOLDER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SONG_BASE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9_-]))*$/;
const RESERVED_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

//==================== names ====================

function fail(error, extra = {}) {
    return { ok: false, error, ...extra };
}

function checkCommonName(value, what) {
    if (!value) {
        return `${what} name is empty.`;
    }
    if (value.length > MAX_NAME_LENGTH) {
        return `${what} name is longer than ${MAX_NAME_LENGTH} characters.`;
    }
    return '';
}

function describeBadCharacters(value, what) {
    if (/\s/.test(value)) {
        return fail(`${what} names cannot contain spaces.  Use - instead.`, { fixable: true });
    }
    return fail(`${what} names may only use letters, digits, - _ and (in Song names) single dots, and must start with a letter or digit.`, { fixable: true });
}

/** @returns {{ok:true, value:string} | {ok:false, error:string, fixable?:boolean}} */
export function validateFolderName(name) {
    const value = `${name ?? ''}`.trim();
    const common = checkCommonName(value, 'Folder');
    if (common) {
        return fail(common);
    }
    if (!FOLDER_PATTERN.test(value)) {
        return describeBadCharacters(value, 'Folder');
    }
    if (RESERVED_PATTERN.test(value)) {
        return fail(`"${value}" is a reserved name on Windows.`);
    }
    return { ok: true, value };
}

/** The base name of a Song, without ".json" (a typed ".json" is accepted and removed).
 *  @returns {{ok:true, value:string} | {ok:false, error:string, fixable?:boolean}} */
export function validateSongBaseName(name) {
    const value = `${name ?? ''}`.trim().replace(/\.json$/i, '');
    const common = checkCommonName(value, 'Song');
    if (common) {
        return fail(common);
    }
    if (!SONG_BASE_PATTERN.test(value)) {
        return describeBadCharacters(value, 'Song');
    }
    if (RESERVED_PATTERN.test(value.split('.')[0])) {
        return fail(`"${value}" is a reserved name on Windows.`);
    }
    return { ok: true, value };
}

/** Turns anything into a name the validators accept (spaces to -, other characters to -). */
export function sanitizeName(raw) {
    let value = `${raw ?? ''}`.trim()
        .replace(/\.json$/i, '')
        .replace(/\s+/g, '-')
        .replace(/[^A-Za-z0-9._-]/g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/^[._-]+/, '')
        .replace(/\.+$/, '');
    if (value.length > MAX_NAME_LENGTH) {
        value = value.slice(0, MAX_NAME_LENGTH).replace(/\.+$/, '');
    }
    return value;
}

/** The default Song name offered by Save to Workbook: the Workbook name it was opened from, else the Library file
 *  name (folder stripped), else whatever is in the Song Name box. */
export function defaultSongBaseName({ workbookPath = '', libraryHref = '', filenameBox = '' } = {}) {
    const candidates = [
        splitPath(workbookPath).base,
        `${libraryHref || ''}`.split('/').pop(),
        filenameBox
    ];
    for (const candidate of candidates) {
        const cleaned = sanitizeName(candidate);
        if (cleaned) {
            return cleaned;
        }
    }
    return 'untitled';
}

export function pathKey(path) {
    return `${path ?? ''}`.toLowerCase();
}

export function makeSongPath(folder, base) {
    return folder ? `${folder}/${base}.json` : `${base}.json`;
}

export function splitPath(path) {
    const text = `${path ?? ''}`;
    const slash = text.indexOf('/');
    const folder = slash >= 0 ? text.slice(0, slash) : '';
    const filename = slash >= 0 ? text.slice(slash + 1) : text;
    return { folder, filename, base: filename.replace(/\.json$/i, '') };
}

/** Full check of a stored or imported Song path. */
export function validateSongPath(path) {
    const text = `${path ?? ''}`;
    const parts = text.split('/');
    if (parts.length > 2) {
        return fail(`"${text}": folders may be only one level deep.`);
    }
    const filename = parts[parts.length - 1];
    if (!/\.json$/i.test(filename)) {
        return fail(`"${text}": a Song name must end in .json.`);
    }
    const base = validateSongBaseName(filename);
    if (!base.ok) {
        return fail(`"${text}": ${base.error}`);
    }
    if (parts.length === 2) {
        const folder = validateFolderName(parts[0]);
        if (!folder.ok || folder.value !== parts[0]) {
            return fail(`"${text}": ${folder.ok ? 'folder name has extra spaces.' : folder.error}`);
        }
    }
    return { ok: true, value: makeSongPath(parts.length === 2 ? parts[0] : '', base.value) };
}

//==================== display helpers ====================

export function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) {
        return `${n} B`;
    }
    if (n < 1024 * 1024) {
        return `${(n / 1024).toFixed(1)} KB`;
    }
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function isBackupStale(meta = {}) {
    return (meta.changesSinceBackup || 0) >= STALE_BACKUP_CHANGES || (!meta.lastBackupAt && (meta.changesSinceBackup || 0) > 0);
}

export function describeBackup(meta = {}) {
    const changes = meta.changesSinceBackup || 0;
    const changeText = `${changes} change${changes === 1 ? '' : 's'} since`;
    if (!meta.lastBackupAt) {
        return changes > 0 ? `Backup: never downloaded, ${changes} change${changes === 1 ? '' : 's'}` : 'Backup: never downloaded';
    }
    return `Backup: last downloaded ${`${meta.lastBackupAt}`.slice(0, 10)}, ${changeText}`;
}

export function workbookDownloadName(date = new Date()) {
    const iso = date.toISOString().slice(0, 10).replaceAll('-', '');
    return `Workbook-${iso}.json`;
}

//==================== file format ====================

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function byteLength(text) {
    return new TextEncoder().encode(text).length;
}

/** @param {{folders:string[], songs:{path:string, comment:string, source:string, text:string}[], savedAt?:string}} input
 *  Each Song text is parsed into the file as a plain JSON object, so the file is one valid, editable document. */
export function buildWorkbookFile({ folders = [], songs = [], savedAt = new Date().toISOString() } = {}) {
    return {
        fileType: WORKBOOK_FILE_TYPE,
        workbookVersion: WORKBOOK_VERSION,
        savedAt,
        folders: [...folders],
        songs: songs.map((entry) => ({
            path: entry.path,
            comment: entry.comment || '',
            source: entry.source || '',
            song: JSON.parse(entry.text)
        }))
    };
}

export function serializeWorkbookFile(file) {
    return JSON.stringify(file, null, 2);
}

/** Validates an untrusted Workbook file.  Nothing is opened or run: it only returns data for the model to store.
 *  @returns {{ok:true, folders:string[], songs:{path,comment,source,text}[]} | {ok:false, error:string}} */
export function parseWorkbookFile(text) {
    let file;
    try {
        file = JSON.parse(text);
    } catch {
        return fail('This file is not valid JSON.');
    }
    if (!isPlainObject(file) || file.fileType !== WORKBOOK_FILE_TYPE) {
        if (isPlainObject(file) && (Array.isArray(file.sections) || Array.isArray(file.myTunings))) {
            return fail('This looks like a Song file, not a Workbook.  Use "Open Song from Local Files" for Songs.');
        }
        return fail(`This is not a Workbook file (fileType "${WORKBOOK_FILE_TYPE}" is missing).`);
    }
    if (file.workbookVersion !== WORKBOOK_VERSION) {
        return fail(`Unsupported Workbook version: ${JSON.stringify(file.workbookVersion)}.  This App reads version ${WORKBOOK_VERSION}.`);
    }

    const folderList = file.folders === undefined ? [] : file.folders;
    const songList = file.songs === undefined ? [] : file.songs;
    if (!Array.isArray(folderList) || !Array.isArray(songList)) {
        return fail('"folders" and "songs" must be lists.');
    }
    if (folderList.length > MAX_FOLDERS) {
        return fail(`Too many folders (the limit is ${MAX_FOLDERS}).`);
    }
    if (songList.length > MAX_SONGS) {
        return fail(`Too many Songs (the limit is ${MAX_SONGS}).`);
    }

    const folders = [];
    const folderKeys = new Set();
    const addFolder = (name) => {
        const checked = validateFolderName(name);
        if (!checked.ok || checked.value !== name) {
            return fail(`Folder ${JSON.stringify(name)}: ${checked.ok ? 'name has extra spaces.' : checked.error}`);
        }
        if (folderKeys.has(pathKey(name))) {
            return fail(`Folder "${name}" appears twice (names are not case-sensitive).`);
        }
        folderKeys.add(pathKey(name));
        folders.push(name);
        return null;
    };
    for (const name of folderList) {
        const problem = addFolder(name);
        if (problem) {
            return problem;
        }
    }

    const songs = [];
    const songKeys = new Set();
    for (const entry of songList) {
        if (!isPlainObject(entry)) {
            return fail('Every item in "songs" must be an object.');
        }
        const checked = validateSongPath(entry.path);
        if (!checked.ok) {
            return checked;
        }
        const path = checked.value;
        if (path !== entry.path) {
            return fail(`"${entry.path}": use the exact form "${path}".`);
        }
        if (songKeys.has(pathKey(path))) {
            return fail(`Song "${path}" appears twice (names are not case-sensitive).`);
        }
        songKeys.add(pathKey(path));
        if (!isPlainObject(entry.song)) {
            return fail(`Song "${path}": "song" must be a JSON object.`);
        }
        const songText = JSON.stringify(entry.song, null, 2);
        if (songText.length > MAX_SONG_TEXT_LENGTH) {
            return fail(`Song "${path}" is too large.`);
        }
        const { folder } = splitPath(path);
        if (folder && !folderKeys.has(pathKey(folder))) {
            const problem = addFolder(folder);
            if (problem) {
                return problem;
            }
        }
        songs.push({
            path,
            comment: typeof entry.comment === 'string' ? entry.comment.slice(0, MAX_COMMENT_LENGTH) : '',
            source: typeof entry.source === 'string' ? entry.source.trim().slice(0, 200) : '',
            text: songText
        });
    }
    return { ok: true, folders, songs };
}

//==================== the model ====================

const DEFAULT_META = Object.freeze({ nextSeq: 1, lastBackupAt: null, changesSinceBackup: 0 });

export class WorkbookModel {
    /** @param adapter see WorkbookStorage.js: loadIndex, getText, getAllTexts, commit
     *  @param {{now?: () => string}} [options] */
    constructor(adapter, { now = () => new Date().toISOString() } = {}) {
        this.adapter = adapter;
        this.now = now;
        this.entries = new Map();
        this.meta = { ...DEFAULT_META };
    }

    async init() {
        const index = await this.adapter.loadIndex();
        this.entries = new Map();
        for (const entry of index.entries || []) {
            this.entries.set(pathKey(entry.path), entry);
        }
        this.meta = { ...DEFAULT_META, ...(index.meta || {}) };
        return this;
    }

    //---- reading ----

    getEntry(path) {
        return this.entries.get(pathKey(path)) || null;
    }

    hasFolder(name) {
        return this.getEntry(name)?.kind === 'folder';
    }

    findSong(folder, base) {
        const entry = this.getEntry(makeSongPath(folder, base));
        return entry?.kind === 'song' ? entry : null;
    }

    isEmpty() {
        return this.entries.size === 0;
    }

    getView() {
        const bySeq = (a, b) => a.seq - b.seq;
        const all = [...this.entries.values()];
        const songs = all.filter((entry) => entry.kind === 'song').sort(bySeq);
        const folders = all.filter((entry) => entry.kind === 'folder').sort(bySeq).map((folder) => ({
            name: folder.path,
            seq: folder.seq,
            songs: songs.filter((song) => splitPath(song.path).folder === folder.path)
        }));
        return {
            rootSongs: songs.filter((song) => !splitPath(song.path).folder),
            folders,
            songCount: songs.length,
            folderCount: folders.length,
            totalBytes: songs.reduce((sum, song) => sum + (song.bytes || 0), 0),
            meta: { ...this.meta }
        };
    }

    async getSongText(path) {
        const entry = this.getEntry(path);
        if (!entry || entry.kind !== 'song') {
            return null;
        }
        const text = await this.adapter.getText(entry.path);
        return typeof text === 'string' ? text : null;
    }

    //---- writing: every change is one adapter transaction, memory is updated only after it succeeds ----

    async _write({ putEntries = [], deleteEntries = [], putTexts = [], deleteTexts = [], clearAll = false, metaPatch = {}, countsAsChange = true }) {
        const meta = { ...this.meta, ...metaPatch };
        if (countsAsChange) {
            meta.changesSinceBackup = this.meta.changesSinceBackup + 1;
        }
        const writes = [];
        if (clearAll) {
            writes.push({ store: 'entries', op: 'clear' }, { store: 'songText', op: 'clear' });
        }
        deleteEntries.forEach((path) => writes.push({ store: 'entries', op: 'delete', key: path }));
        deleteTexts.forEach((path) => writes.push({ store: 'songText', op: 'delete', key: path }));
        putEntries.forEach((entry) => writes.push({ store: 'entries', op: 'put', value: entry }));
        putTexts.forEach(({ path, text }) => writes.push({ store: 'songText', op: 'put', key: path, value: text }));
        writes.push({ store: 'meta', op: 'put', key: 'meta', value: meta });

        await this.adapter.commit(writes);

        if (clearAll) {
            this.entries.clear();
        }
        deleteEntries.forEach((path) => this.entries.delete(pathKey(path)));
        putEntries.forEach((entry) => this.entries.set(pathKey(entry.path), entry));
        this.meta = meta;
    }

    _countOf(kind) {
        return [...this.entries.values()].filter((entry) => entry.kind === kind).length;
    }

    /** @param {{folder?:string, baseName:string, text:string, source?:string, comment?:string}} input
     *  @returns {Promise<{ok:true, path:string, replaced:boolean} | {ok:false, error:string, fixable?:boolean}>} */
    async saveSong({ folder = '', baseName, text, source, comment } = {}) {
        const base = validateSongBaseName(baseName);
        if (!base.ok) {
            return base;
        }
        if (folder && !this.hasFolder(folder)) {
            return fail(`Folder "${folder}" does not exist.`);
        }
        if (typeof text !== 'string' || !text) {
            return fail('There is no Song to save.');
        }
        if (text.length > MAX_SONG_TEXT_LENGTH) {
            return fail('This Song is too large for the Workbook.');
        }
        const folderName = folder ? this.getEntry(folder).path : '';
        const path = makeSongPath(folderName, base.value);
        const existing = this.getEntry(path);
        if (existing && existing.kind !== 'song') {
            return fail(`"${path}" is already in use.`);
        }
        if (!existing && this._countOf('song') >= MAX_SONGS) {
            return fail(`The Workbook is full (${MAX_SONGS} Songs).`);
        }
        const entry = {
            path,
            kind: 'song',
            seq: existing ? existing.seq : this.meta.nextSeq,
            comment: comment !== undefined ? `${comment}`.slice(0, MAX_COMMENT_LENGTH) : (existing?.comment || ''),
            source: `${source || existing?.source || ''}`.slice(0, 200),
            bytes: byteLength(text),
            updatedAt: this.now()
        };
        await this._write({
            deleteEntries: existing && existing.path !== path ? [existing.path] : [],
            deleteTexts: existing && existing.path !== path ? [existing.path] : [],
            putEntries: [entry],
            putTexts: [{ path, text }],
            metaPatch: existing ? {} : { nextSeq: this.meta.nextSeq + 1 }
        });
        return { ok: true, path, replaced: !!existing };
    }

    async addFolder(name) {
        const checked = validateFolderName(name);
        if (!checked.ok) {
            return checked;
        }
        if (this.getEntry(checked.value)) {
            return fail(`"${checked.value}" already exists.`);
        }
        if (this._countOf('folder') >= MAX_FOLDERS) {
            return fail(`There are already ${MAX_FOLDERS} folders.`);
        }
        await this._write({
            putEntries: [{ path: checked.value, kind: 'folder', seq: this.meta.nextSeq, comment: '', source: '', bytes: 0, updatedAt: this.now() }],
            metaPatch: { nextSeq: this.meta.nextSeq + 1 }
        });
        return { ok: true, path: checked.value };
    }

    async renameFolder(oldName, newName) {
        const old = this.getEntry(oldName);
        if (!old || old.kind !== 'folder') {
            return fail(`Folder "${oldName}" does not exist.`);
        }
        const checked = validateFolderName(newName);
        if (!checked.ok) {
            return checked;
        }
        if (checked.value === old.path) {
            return { ok: true, path: old.path };
        }
        const clash = this.getEntry(checked.value);
        if (clash && clash !== old) {
            return fail(`"${checked.value}" already exists.`);
        }
        const children = [...this.entries.values()].filter((entry) => entry.kind === 'song' && splitPath(entry.path).folder === old.path);
        const putEntries = [{ ...old, path: checked.value, updatedAt: this.now() }];
        const putTexts = [];
        const deleteEntries = [old.path];
        const deleteTexts = [];
        for (const child of children) {
            const text = await this.adapter.getText(child.path);
            const newPath = makeSongPath(checked.value, splitPath(child.path).base);
            putEntries.push({ ...child, path: newPath });
            putTexts.push({ path: newPath, text });
            deleteEntries.push(child.path);
            deleteTexts.push(child.path);
        }
        await this._write({ putEntries, putTexts, deleteEntries, deleteTexts });
        return { ok: true, path: checked.value };
    }

    async deleteFolder(name) {
        const folder = this.getEntry(name);
        if (!folder || folder.kind !== 'folder') {
            return fail(`Folder "${name}" does not exist.`);
        }
        const songCount = [...this.entries.values()].filter((entry) => entry.kind === 'song' && splitPath(entry.path).folder === folder.path).length;
        if (songCount > 0) {
            return fail(`Folder "${folder.path}" still has ${songCount} Song${songCount === 1 ? '' : 's'}.  Remove them first.`);
        }
        await this._write({ deleteEntries: [folder.path] });
        return { ok: true };
    }

    async deleteSong(path) {
        const entry = this.getEntry(path);
        if (!entry || entry.kind !== 'song') {
            return fail(`"${path}" is not in the Workbook.`);
        }
        await this._write({ deleteEntries: [entry.path], deleteTexts: [entry.path] });
        return { ok: true };
    }

    async setComment(path, comment) {
        const entry = this.getEntry(path);
        if (!entry || entry.kind !== 'song') {
            return fail(`"${path}" is not in the Workbook.`);
        }
        const text = `${comment ?? ''}`.slice(0, MAX_COMMENT_LENGTH);
        if (text === entry.comment) {
            return { ok: true, changed: false };
        }
        await this._write({ putEntries: [{ ...entry, comment: text }] });
        return { ok: true, changed: true };
    }

    async markBackedUp() {
        await this._write({ metaPatch: { lastBackupAt: this.now(), changesSinceBackup: 0 }, countsAsChange: false });
    }

    //---- the whole Workbook as a file ----

    async exportFile() {
        const texts = await this.adapter.getAllTexts();
        const bySeq = (a, b) => a.seq - b.seq;
        const all = [...this.entries.values()];
        const folders = all.filter((entry) => entry.kind === 'folder').sort(bySeq).map((entry) => entry.path);
        const songs = all.filter((entry) => entry.kind === 'song').sort(bySeq).map((entry) => ({
            path: entry.path,
            comment: entry.comment,
            source: entry.source,
            text: texts.get(entry.path)
        }));
        const file = buildWorkbookFile({ folders, songs, savedAt: this.now() });
        return { file, text: serializeWorkbookFile(file) };
    }

    /** Replaces the whole stored Workbook with a parsed file (see parseWorkbookFile).  The file is the backup. */
    async replaceFromParsed(parsed) {
        let seq = 1;
        const putEntries = [];
        const putTexts = [];
        const updatedAt = this.now();
        for (const name of parsed.folders) {
            putEntries.push({ path: name, kind: 'folder', seq: seq++, comment: '', source: '', bytes: 0, updatedAt });
        }
        for (const song of parsed.songs) {
            putEntries.push({ path: song.path, kind: 'song', seq: seq++, comment: song.comment, source: song.source, bytes: byteLength(song.text), updatedAt });
            putTexts.push({ path: song.path, text: song.text });
        }
        await this._write({
            clearAll: true,
            putEntries,
            putTexts,
            metaPatch: { nextSeq: seq, lastBackupAt: updatedAt, changesSinceBackup: 0 },
            countsAsChange: false
        });
    }
}
