/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 157: the Workbook.  Pure module (no DOM, no jQuery, no browser storage): names, the Workbook file format,
// and WorkbookModel, which keeps the list in memory and writes through a storage adapter (WorkbookStorage.js).
//
// Sprint 158: a Workbook can also be a mounted tutorial course.  File format v2 adds Workbook-level `id`, `version`, `caption`,
// `description`, `suggestedMount`, and folders that can carry a caption and a description.  Each Song entry carries a derived
// cache (caption, instruments, SectionCount, tutorial level) that is always recomputed from the Song, never trusted from a file.
//
// Paths: a Song is "name.json" (Workbook root) or "folder/name.json".  Folders are one level deep.
// Order is order of addition: every entry gets a `seq`, folders and Songs share the counter.

import { getSongInstrumentSummaries } from './InstrumentRoleBadges.js';

export const WORKBOOK_FILE_TYPE = 'infinite-neck-workbook';
export const WORKBOOK_VERSION = 2;
export const SUPPORTED_WORKBOOK_VERSIONS = Object.freeze([1, 2]);
export const WORKBOOK_LABEL = 'Workbook';
export const BUILTIN_MOUNT_ID = 'workbook';
export const WORKBOOK_FILE_SUFFIX = '.workbook.json';

export const MAX_NAME_LENGTH = 64;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_CAPTION_LENGTH = 200;
export const MAX_WORKBOOK_DESCRIPTION_LENGTH = 20000;
export const MAX_FOLDER_DESCRIPTION_LENGTH = 5000;
export const MAX_SONGS = 1000;
export const MAX_FOLDERS = 200;
export const MAX_INSTRUMENTS_PER_SONG = 24;
export const MAX_SONG_TEXT_LENGTH = 5 * 1024 * 1024;
export const STALE_BACKUP_CHANGES = 5;

const FOLDER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SONG_BASE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9_-]))*$/;
const RESERVED_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
export const WORKBOOK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const TUTORIAL_LEVELS = new Set(['none', 'wizard', 'strict']);

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
    if (/\.workbook$/i.test(value)) {
        return fail('Song names cannot end in ".workbook": that ending marks a Workbook file.', { fixable: true });
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
    return value.replace(/\.workbook$/i, '-workbook');
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

/** `<id>.workbook.json` for a Workbook that has an id (a course), else `Workbook-YYYYMMDD.workbook.json`. */
export function workbookDownloadName(date = new Date(), id = '') {
    if (WORKBOOK_ID_PATTERN.test(`${id || ''}`)) {
        return `${id}${WORKBOOK_FILE_SUFFIX}`;
    }
    const iso = date.toISOString().slice(0, 10).replaceAll('-', '');
    return `Workbook-${iso}${WORKBOOK_FILE_SUFFIX}`;
}

//==================== file format ====================

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function byteLength(text) {
    return new TextEncoder().encode(text).length;
}

//---- Sprint 158: Workbook info (id, version, caption, description), folder info, and the derived Song summary ----

/** Plain text on one line, capped.  A caption is escaped wherever it is shown. */
export function cleanCaption(value) {
    return typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, MAX_CAPTION_LENGTH) : '';
}

function cleanDescription(value, max, sanitizeHtml) {
    if (typeof value !== 'string') {
        return '';
    }
    const text = value.slice(0, max);
    return sanitizeHtml ? `${sanitizeHtml(text)}`.slice(0, max) : text;
}

/** @returns {{ok:true, value:string} | {ok:false, error:string}}  An empty id is allowed (a Workbook without one). */
export function validateWorkbookId(id) {
    const value = `${id ?? ''}`.trim();
    if (!value) {
        return { ok: true, value: '' };
    }
    if (!WORKBOOK_ID_PATTERN.test(value)) {
        return fail(`Workbook id "${value.slice(0, 40)}" is not valid: use letters, digits, - and _, starting with a letter or digit, up to 64 characters.`);
    }
    return { ok: true, value };
}

/** @returns {{ok:true, value:string} | {ok:false, error:string}}  A number or text; an empty version is allowed. */
export function validateWorkbookVersion(version) {
    const value = `${version ?? ''}`.trim();
    if (!value) {
        return { ok: true, value: '' };
    }
    if (!VERSION_PATTERN.test(value)) {
        return fail(`Workbook version "${value.slice(0, 40)}" is not valid: use letters, digits, . - and _, up to 32 characters.`);
    }
    return { ok: true, value };
}

/** The Workbook-level fields of a file (or of an edit).  Nothing else in the file is trusted as Workbook info.
 *  @param {{sanitizeHtml?: (html:string) => string}} [options]
 *  @returns {{ok:true, info:{id,version,caption,description,suggestedMount}} | {ok:false, error:string}} */
export function normalizeWorkbookInfo(raw = {}, { sanitizeHtml } = {}) {
    const source = isPlainObject(raw) ? raw : {};
    const id = validateWorkbookId(source.id);
    if (!id.ok) {
        return id;
    }
    const version = validateWorkbookVersion(source.version);
    if (!version.ok) {
        return version;
    }
    return {
        ok: true,
        info: {
            id: id.value,
            version: version.value,
            caption: cleanCaption(source.caption),
            description: cleanDescription(source.description, MAX_WORKBOOK_DESCRIPTION_LENGTH, sanitizeHtml),
            suggestedMount: source.suggestedMount === 'tutorial' ? 'tutorial' : ''
        }
    };
}

/** What a Workbook row needs to show about a Song without reading its text.  Always computed from the Song itself.
 *  Instruments use `allowUnknown: true` (the shared rule with the Library build): a tuning without a `fromBaseID` shows as "(unknown)". */
export function deriveSongSummary(song) {
    const obj = isPlainObject(song) ? song : {};
    const level = isPlainObject(obj.tutorial) ? `${obj.tutorial.level ?? ''}`.trim().toLowerCase() : '';
    return {
        caption: cleanCaption(isPlainObject(obj.tutorial) ? obj.tutorial.caption : ''),
        instruments: getSongInstrumentSummaries(obj, { allowUnknown: true }).slice(0, MAX_INSTRUMENTS_PER_SONG),
        SectionCount: Array.isArray(obj.sections) ? obj.sections.length : 0,
        tutorial: TUTORIAL_LEVELS.has(level) ? level : ''
    };
}

function deriveSummaryFromText(text) {
    try {
        return deriveSongSummary(JSON.parse(text));
    } catch {
        return deriveSongSummary(null);
    }
}

/** A Workbook folder as the file stores it: a bare name (the minimal form) or { name, caption?, description? }. */
function normalizeFolderItem(item, sanitizeHtml) {
    if (typeof item === 'string') {
        return { name: item, caption: '', description: '' };
    }
    if (isPlainObject(item)) {
        return {
            name: item.name,
            caption: cleanCaption(item.caption),
            description: cleanDescription(item.description, MAX_FOLDER_DESCRIPTION_LENGTH, sanitizeHtml)
        };
    }
    return null;
}

//---- Sprint 158: mounts.  A mount is one Workbook; the built-in one is "workbook". ----

/** A Song Library href that may be fetched as a Workbook: "tutorials/C000-intro.workbook.json".  Relative, no "..", no query. */
export function isLibraryWorkbookHref(href) {
    const text = `${href ?? ''}`;
    return /^[A-Za-z0-9_./-]+\.workbook\.json$/.test(text)
        && !text.includes('..')
        && !text.includes('//')
        && !text.startsWith('/')
        && !text.startsWith('.');
}

/** The base of a mount id from a file name: "C100-cowboy-chords.workbook.json" gives "C100-cowboy-chords". */
export function mountIdFromFileName(fileName) {
    const cleaned = `${fileName ?? ''}`.split(/[\\/]/).pop()
        .replace(/\.workbook\.json$/i, '')
        .replace(/\.json$/i, '')
        .replace(/[^A-Za-z0-9_-]+/g, '-')
        .replace(/^[-_]+/, '')
        .replace(/-+$/, '')
        .slice(0, 60);
    return cleaned || 'workbook-file';
}

/** `base`, or base-2, base-3 ... when taken (not case-sensitive).  The built-in "workbook" is always taken. */
export function uniqueMountId(base, taken = []) {
    const used = new Set([BUILTIN_MOUNT_ID, ...taken].map((id) => `${id}`.toLowerCase()));
    let candidate = base;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) {
        candidate = `${base}-${n}`;
    }
    return candidate;
}

/** The IndexedDB name of a mounted Workbook (lower case, so ids that differ only by case cannot clash). */
export function mountDbName(mountId) {
    return `infinite-neck-workbook-mount-${`${mountId}`.toLowerCase()}`;
}

const MOUNT_REGISTRY_KEY = 'infinite-neck:workbook-mounts';
const LEDGER_KEY_PREFIX = 'infinite-neck:workbook-progress:';

function safeStorageRead(storage, key) {
    try {
        const raw = storage?.getItem?.(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function safeStorageWrite(storage, key, value) {
    try {
        if (value === null) {
            storage?.removeItem?.(key);
        } else {
            storage?.setItem?.(key, JSON.stringify(value));
        }
        return true;
    } catch {
        return false;   // storage full or unavailable: mounts and progress notes are best effort, the Workbook itself is in IndexedDB
    }
}

/** The mounts to restore at launch, in display order.  Bad records are dropped. */
export function readMountRegistry(storage) {
    const raw = safeStorageRead(storage, MOUNT_REGISTRY_KEY);
    if (!Array.isArray(raw)) {
        return [];
    }
    const seen = new Set([BUILTIN_MOUNT_ID]);
    const result = [];
    for (const item of raw) {
        const id = `${item?.mountId ?? ''}`;
        if (WORKBOOK_ID_PATTERN.test(id) && !seen.has(id.toLowerCase())) {
            seen.add(id.toLowerCase());
            result.push({ mountId: id });
        }
    }
    return result;
}

export function writeMountRegistry(storage, mountIds) {
    return safeStorageWrite(storage, MOUNT_REGISTRY_KEY, mountIds.map((mountId) => ({ mountId })));
}

/** Progress (Done, Bookmark) and Include in Looping of the mounted Workbook, by Song path, keyed by its mount id.
 *  Saved when a mount is unmounted or replaced, so that mounting the same course again (a newer version, or later) gets it back. */
export function readProgressLedger(storage, mountId) {
    const raw = safeStorageRead(storage, `${LEDGER_KEY_PREFIX}${`${mountId}`.toLowerCase()}`);
    const result = {};
    if (!isPlainObject(raw)) {
        return result;
    }
    for (const [path, state] of Object.entries(raw).slice(0, MAX_SONGS)) {
        if (!isPlainObject(state) || !validateSongPath(path).ok) {
            continue;
        }
        const progress = sanitizeProgress(state.progress);
        const includeInLooping = sanitizeIncludeInLooping(state.includeInLooping);
        if (progress || includeInLooping) {
            result[path] = { progress, includeInLooping };
        }
    }
    return result;
}

export function writeProgressLedger(storage, mountId, ledger) {
    return safeStorageWrite(storage, `${LEDGER_KEY_PREFIX}${`${mountId}`.toLowerCase()}`, Object.keys(ledger || {}).length ? ledger : null);
}

export function clearProgressLedger(storage, mountId) {
    return safeStorageWrite(storage, `${LEDGER_KEY_PREFIX}${`${mountId}`.toLowerCase()}`, null);
}

/** @param {Map|Iterable} entries  a WorkbookModel's entries (kind 'song' ones are read) */
export function ledgerFromEntries(entries) {
    const ledger = {};
    for (const entry of entries) {
        if (entry.kind === 'song' && (entry.progress || entry.includeInLooping)) {
            ledger[entry.path] = { progress: entry.progress ?? null, includeInLooping: entry.includeInLooping ?? null };
        }
    }
    return ledger;
}

/** Puts remembered progress into a parsed file (before it is stored).  The file's own progress wins: the ledger only fills
 *  Songs that have none, and only for paths the new file has.  Returns how many Songs got something. */
export function applyLedgerToParsed(parsed, ledger = {}) {
    let applied = 0;
    for (const song of parsed.songs) {
        const remembered = ledger[song.path];
        if (remembered && !song.progress && !song.includeInLooping) {
            song.progress = remembered.progress;
            song.includeInLooping = remembered.includeInLooping;
            applied++;
        }
    }
    return applied;
}

//---- Sprint 157 it2: per-Song practice state kept in the Workbook (never in the Song) ----

const MAX_SECTION_INDEX = 100000;
const MAX_INDEX_LIST = 10000;

/** The ISO form that toISOString() writes, so dates compare correctly as plain text. */
function isIsoDate(value) {
    return typeof value === 'string'
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
        && !Number.isNaN(Date.parse(value));
}

function toIndex(value) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n >= 0 && n <= MAX_SECTION_INDEX ? n : null;
}

function sanitizeIndexList(list) {
    if (!Array.isArray(list)) {
        return null;
    }
    const set = new Set();
    list.slice(0, MAX_INDEX_LIST).forEach((value) => {
        const n = toIndex(value);
        if (n !== null) {
            set.add(n);
        }
    });
    return [...set].sort((a, b) => a - b);
}

/** Tutorial Done / Bookmark.  null when there is nothing to remember. */
export function sanitizeProgress(raw) {
    if (!isPlainObject(raw)) {
        return null;
    }
    const doneSectionIndexes = sanitizeIndexList(raw.doneSectionIndexes) || [];
    const bookmarkSectionIndex = toIndex(raw.bookmarkSectionIndex);
    if (doneSectionIndexes.length === 0 && bookmarkSectionIndex === null) {
        return null;
    }
    return { doneSectionIndexes, bookmarkSectionIndex };
}

/** The Practice List's Include in Looping Sections.  null means "never chosen" (all Sections). */
export function sanitizeIncludeInLooping(raw) {
    return sanitizeIndexList(raw);
}

//---- Sprint 157 it2: session-only display sorting ----

export const SORT_KEYS = Object.freeze(['list', 'date', 'alpha']);

function makeComparator(sortKey, sortDir, keyOf) {
    return (a, b) => {
        const ka = keyOf(a);
        const kb = keyOf(b);
        let result = 0;
        if (sortKey === 'alpha') {
            result = ka.name < kb.name ? -1 : (ka.name > kb.name ? 1 : 0);   // plain comparison: case-sensitive, not locale-aware
        } else if (sortKey === 'date') {
            result = ka.date < kb.date ? -1 : (ka.date > kb.date ? 1 : 0);
        }
        return (result * sortDir) || (ka.seq - kb.seq);
    };
}

/** @param {{folders:(string|{name:string,caption?:string,description?:string})[], songs:{path:string, comment:string, source:string, text:string}[], savedAt?:string, info?:object}} input
 *  Each Song text is parsed into the file as a plain JSON object, so the file is one valid, editable document.
 *  The Song's `caption`, `instruments` and `SectionCount` are written for people and tools that read the file; opening it ignores them. */
export function buildWorkbookFile({ folders = [], songs = [], savedAt = new Date().toISOString(), info = {} } = {}) {
    const file = {
        fileType: WORKBOOK_FILE_TYPE,
        workbookVersion: WORKBOOK_VERSION,
        savedAt
    };
    file.id = info.id || '';
    file.version = info.version || '';
    file.caption = info.caption || '';
    file.description = info.description || '';
    if (info.suggestedMount) {
        file.suggestedMount = info.suggestedMount;
    }
    file.folders = folders.map((folder) => {
        const item = normalizeFolderItem(folder);
        const out = { name: item.name };
        if (item.caption) {
            out.caption = item.caption;
        }
        if (item.description) {
            out.description = item.description;
        }
        return out;
    });
    file.songs = songs.map((entry) => {
        const song = JSON.parse(entry.text);
        const summary = deriveSongSummary(song);
        return {
            path: entry.path,
            comment: entry.comment || '',
            source: entry.source || '',
            caption: summary.caption,
            instruments: summary.instruments,
            SectionCount: summary.SectionCount,
            progress: sanitizeProgress(entry.progress),
            includeInLooping: sanitizeIncludeInLooping(entry.includeInLooping),
            updatedAt: entry.updatedAt || '',
            song
        };
    });
    return file;
}

export function serializeWorkbookFile(file) {
    return JSON.stringify(file, null, 2);
}

/** Validates an untrusted Workbook file.  Nothing is opened or run: it only returns data for the model to store.
 *  Versions 1 and 2 are read.  `sanitizeHtml` (optional) cleans the descriptions; they are sanitized again whenever shown.
 *  @returns {{ok:true, info:object, folders:{name,caption,description}[], songs:{path,comment,source,text,caption,instruments,SectionCount,tutorial}[]} | {ok:false, error:string}} */
export function parseWorkbookFile(text, { sanitizeHtml } = {}) {
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
    if (!SUPPORTED_WORKBOOK_VERSIONS.includes(file.workbookVersion)) {
        return fail(`Unsupported Workbook version: ${JSON.stringify(file.workbookVersion)}.  This App reads versions ${SUPPORTED_WORKBOOK_VERSIONS.join(' and ')}.`);
    }
    const normalizedInfo = normalizeWorkbookInfo(file, { sanitizeHtml });
    if (!normalizedInfo.ok) {
        return normalizedInfo;
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
    const addFolder = (name, caption = '', description = '') => {
        const checked = validateFolderName(name);
        if (!checked.ok || checked.value !== name) {
            return fail(`Folder ${JSON.stringify(name)}: ${checked.ok ? 'name has extra spaces.' : checked.error}`);
        }
        if (folderKeys.has(pathKey(name))) {
            return fail(`Folder "${name}" appears twice (names are not case-sensitive).`);
        }
        folderKeys.add(pathKey(name));
        folders.push({ name, caption, description });
        return null;
    };
    for (const item of folderList) {
        const folder = normalizeFolderItem(item, sanitizeHtml);
        if (!folder) {
            return fail('Every item in "folders" must be a name or an object with a name.');
        }
        const problem = addFolder(folder.name, folder.caption, folder.description);
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
            progress: sanitizeProgress(entry.progress),
            includeInLooping: sanitizeIncludeInLooping(entry.includeInLooping),
            updatedAt: isIsoDate(entry.updatedAt) ? entry.updatedAt : '',
            ...deriveSongSummary(entry.song),   // caption, instruments, SectionCount, tutorial: never taken from the file's own copies
            text: songText
        });
    }
    return { ok: true, info: normalizedInfo.info, folders, songs };
}

//==================== the model ====================

const DEFAULT_META = Object.freeze({
    nextSeq: 1,
    lastBackupAt: null,
    changesSinceBackup: 0,
    id: '',
    version: '',
    caption: '',
    description: '',
    suggestedMount: ''
});

export class WorkbookModel {
    /** @param adapter see WorkbookStorage.js: loadIndex, getText, getAllTexts, commit
     *  @param {{now?: () => string}} [options] */
    constructor(adapter, { now = () => new Date().toISOString() } = {}) {
        this.adapter = adapter;
        this.now = now;
        this.entries = new Map();
        this.meta = { ...DEFAULT_META };
        this._tail = Promise.resolve();   // writes run one at a time, see the end of this file
    }

    _serial(task) {
        const run = this._tail.then(task);
        this._tail = run.catch(() => {});
        return run;
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

    /** @param {{sortKey?: 'list'|'date'|'alpha', sortDir?: 1|-1}} [sort]  Display order only; nothing stored changes.
     *  'list' is the stored order of addition (dir ignored).  'date' is last saved or modified (1 = oldest first).
     *  'alpha' is case-sensitive by name (1 = A-Z).  Folders sort by name, or by their newest content for 'date'.
     *  Every Song and folder also says whether the stored order lets it move up or down (canUp, canDown). */
    getView({ sortKey = 'list', sortDir = 1 } = {}) {
        const bySeq = (a, b) => a.seq - b.seq;
        const all = [...this.entries.values()];
        const songs = all.filter((entry) => entry.kind === 'song').sort(bySeq);
        const folderEntries = all.filter((entry) => entry.kind === 'folder').sort(bySeq);
        const annotate = (list) => list.map((entry, index) => ({ ...entry, canUp: index > 0, canDown: index < list.length - 1 }));
        const dir = sortDir < 0 ? -1 : 1;
        const key = SORT_KEYS.includes(sortKey) ? sortKey : 'list';
        const sortSongs = (list) => (key === 'list' ? list : [...list].sort(makeComparator(key, dir, (song) => ({ name: splitPath(song.path).filename, date: song.updatedAt || '', seq: song.seq }))));

        const folders = annotate(folderEntries).map((folder) => {
            const folderSongs = annotate(songs.filter((song) => splitPath(song.path).folder === folder.path));
            const newest = folderSongs.reduce((latest, song) => ((song.updatedAt || '') > latest ? song.updatedAt : latest), folder.updatedAt || '');
            return {
                name: folder.path, seq: folder.seq, canUp: folder.canUp, canDown: folder.canDown, date: newest,
                caption: folder.caption || '', description: folder.description || '',
                songs: sortSongs(folderSongs)
            };
        });
        const sortedFolders = key === 'list' ? folders : [...folders].sort(makeComparator(key, dir, (folder) => ({ name: folder.name, date: folder.date, seq: folder.seq })));
        return {
            rootSongs: sortSongs(annotate(songs.filter((song) => !splitPath(song.path).folder))),
            folders: sortedFolders,
            songCount: songs.length,
            folderCount: folders.length,
            totalBytes: songs.reduce((sum, song) => sum + (song.bytes || 0), 0),
            info: this.getInfo(),
            meta: { ...this.meta }
        };
    }

    /** The Workbook-level info: id, version, caption, description, suggestedMount (all text, '' when not set). */
    getInfo() {
        const { id, version, caption, description, suggestedMount } = this.meta;
        return { id: id || '', version: version || '', caption: caption || '', description: description || '', suggestedMount: suggestedMount || '' };
    }

    /** The Workbook's remembered practice state for a Song (Tutorial Done / Bookmark, Include in Looping), or null. */
    getSongState(path) {
        const entry = this.getEntry(path);
        if (!entry || entry.kind !== 'song') {
            return null;
        }
        return { progress: entry.progress ?? null, includeInLooping: entry.includeInLooping ?? null };
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
    async saveSong({ folder = '', baseName, text, source, comment, progress, includeInLooping } = {}) {
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
            ...deriveSummaryFromText(text),
            seq: existing ? existing.seq : this.meta.nextSeq,
            comment: comment !== undefined ? `${comment}`.slice(0, MAX_COMMENT_LENGTH) : (existing?.comment || ''),
            source: `${source || existing?.source || ''}`.slice(0, 200),
            progress: progress !== undefined ? sanitizeProgress(progress) : (existing?.progress ?? null),
            includeInLooping: includeInLooping !== undefined ? sanitizeIncludeInLooping(includeInLooping) : (existing?.includeInLooping ?? null),
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
            putEntries: [{ path: checked.value, kind: 'folder', seq: this.meta.nextSeq, caption: '', description: '', comment: '', source: '', bytes: 0, updatedAt: this.now() }],
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
        await this._write({ putEntries: [{ ...entry, comment: text, updatedAt: this.now() }] });
        return { ok: true, changed: true };
    }

    /** Remembers practice state for a Song.  Patch keys: progress, includeInLooping (only the keys given are changed).
     *  Does not touch the Song text or its date. */
    async setSongState(path, patch = {}) {
        const entry = this.getEntry(path);
        if (!entry || entry.kind !== 'song') {
            return fail(`"${path}" is not in the Workbook.`);
        }
        const next = { ...entry };
        if ('progress' in patch) {
            next.progress = sanitizeProgress(patch.progress);
        }
        if ('includeInLooping' in patch) {
            next.includeInLooping = sanitizeIncludeInLooping(patch.includeInLooping);
        }
        const same = JSON.stringify([next.progress ?? null, next.includeInLooping ?? null]) === JSON.stringify([entry.progress ?? null, entry.includeInLooping ?? null]);
        if (same) {
            return { ok: true, changed: false };
        }
        await this._write({ putEntries: [next] });
        return { ok: true, changed: true };
    }

    /** Moves a Song up or down among the Songs of its folder (or the root), or a folder among the folders.
     *  This changes the stored order of addition. */
    async moveEntry(path, direction) {
        const entry = this.getEntry(path);
        if (!entry) {
            return fail(`"${path}" is not in the Workbook.`);
        }
        const step = direction < 0 ? -1 : 1;
        const folder = entry.kind === 'song' ? splitPath(entry.path).folder : '';
        const group = [...this.entries.values()]
            .filter((other) => other.kind === entry.kind && (entry.kind === 'folder' || splitPath(other.path).folder === folder))
            .sort((a, b) => a.seq - b.seq);
        const index = group.findIndex((other) => other.path === entry.path);
        const neighbour = group[index + step];
        if (!neighbour) {
            return fail(`"${entry.path}" is already ${step < 0 ? 'first' : 'last'}.`);
        }
        await this._write({ putEntries: [{ ...entry, seq: neighbour.seq }, { ...neighbour, seq: entry.seq }] });
        return { ok: true };
    }

    /** Edits the Workbook-level info.  Patch keys: id, version, caption, description (only the keys given change).
     *  `sanitizeHtml` (optional) cleans the description. */
    async setWorkbookInfo(patch = {}, { sanitizeHtml } = {}) {
        const merged = normalizeWorkbookInfo({ ...this.getInfo(), ...patch }, { sanitizeHtml });
        if (!merged.ok) {
            return merged;
        }
        const before = JSON.stringify(this.getInfo());
        const next = { ...merged.info, suggestedMount: this.meta.suggestedMount || '' };
        if (JSON.stringify(next) === before) {
            return { ok: true, changed: false };
        }
        await this._write({ metaPatch: next });
        return { ok: true, changed: true };
    }

    /** Edits a folder's caption and description (only the keys given change). */
    async setFolderInfo(name, patch = {}, { sanitizeHtml } = {}) {
        const folder = this.getEntry(name);
        if (!folder || folder.kind !== 'folder') {
            return fail(`Folder "${name}" does not exist.`);
        }
        const next = { ...folder };
        if ('caption' in patch) {
            next.caption = cleanCaption(patch.caption);
        }
        if ('description' in patch) {
            next.description = cleanDescription(patch.description, MAX_FOLDER_DESCRIPTION_LENGTH, sanitizeHtml);
        }
        if ((next.caption || '') === (folder.caption || '') && (next.description || '') === (folder.description || '')) {
            return { ok: true, changed: false };
        }
        await this._write({ putEntries: [next] });
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
        const folders = all.filter((entry) => entry.kind === 'folder').sort(bySeq).map((entry) => ({ name: entry.path, caption: entry.caption || '', description: entry.description || '' }));
        const songs = all.filter((entry) => entry.kind === 'song').sort(bySeq).map((entry) => ({
            path: entry.path,
            comment: entry.comment,
            source: entry.source,
            progress: entry.progress ?? null,
            includeInLooping: entry.includeInLooping ?? null,
            updatedAt: entry.updatedAt || '',
            text: texts.get(entry.path)
        }));
        const file = buildWorkbookFile({ folders, songs, savedAt: this.now(), info: this.getInfo() });
        return { file, text: serializeWorkbookFile(file) };
    }

    /** Replaces the whole stored Workbook with a parsed file (see parseWorkbookFile).  The file is the backup. */
    async replaceFromParsed(parsed) {
        let seq = 1;
        const putEntries = [];
        const putTexts = [];
        const updatedAt = this.now();
        for (const folder of parsed.folders) {
            putEntries.push({
                path: folder.name, kind: 'folder', seq: seq++, caption: folder.caption || '', description: folder.description || '',
                comment: '', source: '', bytes: 0, updatedAt
            });
        }
        for (const song of parsed.songs) {
            putEntries.push({
                path: song.path, kind: 'song', seq: seq++, comment: song.comment, source: song.source,
                caption: song.caption || '', instruments: song.instruments || [], SectionCount: song.SectionCount || 0, tutorial: song.tutorial || '',
                progress: song.progress ?? null, includeInLooping: song.includeInLooping ?? null,
                bytes: byteLength(song.text), updatedAt: song.updatedAt || updatedAt
            });
            putTexts.push({ path: song.path, text: song.text });
        }
        await this._write({
            clearAll: true,
            putEntries,
            putTexts,
            metaPatch: { nextSeq: seq, lastBackupAt: updatedAt, changesSinceBackup: 0, ...(parsed.info || {}) },
            countsAsChange: false
        });
    }
}

// Every public change runs after the one before it has been committed.  Two quick changes (a Done tick, then an
// Include in Looping tick) would otherwise both start from the same in-memory entry, and the second would undo the first.
for (const name of ['saveSong', 'addFolder', 'renameFolder', 'deleteFolder', 'deleteSong', 'setComment', 'setSongState', 'moveEntry', 'setWorkbookInfo', 'setFolderInfo', 'markBackedUp', 'replaceFromParsed']) {
    const original = WorkbookModel.prototype[name];
    WorkbookModel.prototype[name] = function serialized(...args) {
        return this._serial(() => original.apply(this, args));
    };
}
