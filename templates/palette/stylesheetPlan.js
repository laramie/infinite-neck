// Sprint 150: pure (no DOM, no jQuery) model for the Palette's Stylesheet CRUD.
// colorFunctions.js renders and applies; this module decides, so Jest can test every rule.
//
// Sprint 155 vocabulary (the layout and shipping set are in systemFolders.js)
//   system sheet: a read-only, checkbox-ticked sheet from SYSTEM_LAYOUT (All-Clear, CycleOfColors, Roles, ...).
//                 They are independent: any subset may be ticked.  List order is precedence, the bottom wins.
//   user sheet  : {readOnly:false, computed:false, checked, dict} saved with the Song; a flat, non-exclusive list.
//   recipe      : a '+'-joined set of sheet names, last-applied first, user sheets first, e.g. "b+a+MoodLight+Default".
//                 The token Default means the shipping set.  Token order is cosmetic: song.colorDicts order decides.
//   Look        : a named recipe, stored per Song in song.colorLooks = {name: recipe}.  The Look Default (the shipping
//                 set) always exists, is first, and is not stored.

import {
    SYSTEM_LAYOUT, DEFAULT_LOOK_NAME, layoutSheets, systemIds, shippingIds, findLayoutSheet, exclusiveSiblings
} from './systemFolders.js';

export const BUILT_IN_ORDER = systemIds();
export const RESERVED_NAMES = [...BUILT_IN_ORDER, DEFAULT_LOOK_NAME];
export const MAX_SHEET_NAME_LENGTH = 40;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const lower = (s) => String(s).toLowerCase();
const RESERVED_LOWER = RESERVED_NAMES.map(lower);
const SAFE_CLASS = /^[A-Za-z0-9_ -]*$/;

//=============================== names ========================================

/** The canonical spelling of a system sheet id or of Default, or null. */
export function builtInName(name) {
    const i = RESERVED_LOWER.indexOf(lower(name ?? ''));
    return i < 0 ? null : RESERVED_NAMES[i];
}

export function isBuiltInName(name) {
    return builtInName(name) !== null;
}

/** Trim, collapse anything outside [A-Za-z0-9] to "-", trim "-", cap the length.
 *  All-digit names are prefixed because JS orders integer-like object keys first, which would break list order. */
export function cleanSheetName(raw) {
    const original = String(raw ?? '');
    let name = original.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
    if (name.length > MAX_SHEET_NAME_LENGTH) {
        name = name.substring(0, MAX_SHEET_NAME_LENGTH).replace(/-+$/g, '');
    }
    if (/^[0-9]+$/.test(name)) {
        name = 'sheet-' + name;
    }
    return { name, changed: name !== original };
}

/** First name not in `taken` (case-insensitive). Increments a trailing number: Foo -> Foo2 -> Foo3. */
export function freeName(preferred, taken) {
    const takenLower = new Set([...(taken || [])].map(lower));
    const base = String(preferred || 'user');
    if (!takenLower.has(lower(base))) return base;
    const m = /^(.*?)(\d+)$/.exec(base);
    const stem = m ? m[1] : base;
    let n = m ? parseInt(m[2], 10) + 1 : 2;
    while (takenLower.has(lower(stem + n))) n++;
    return stem + n;
}

export function userKeys(colorDicts) {
    return Object.keys(colorDicts || {}).filter((k) => isUserSheet(colorDicts, k));
}

export function builtInKeys(colorDicts) {
    return BUILT_IN_ORDER.filter((k) => hasOwn(colorDicts, k));
}

export function isUserSheet(colorDicts, key) {
    const entry = hasOwn(colorDicts, key) ? colorDicts[key] : null;
    return !!entry && !isBuiltInName(key) && !entry.readOnly && !entry.computed;
}

export function takenNames(song) {
    return [
        ...RESERVED_NAMES,
        ...Object.keys((song && song.colorDicts) || {}),
        ...Object.keys((song && song.colorLooks) || {})
    ];
}

function findKeyCI(keys, name) {
    return keys.find((k) => lower(k) === lower(name)) ?? null;
}

//=============================== class parts ==================================

export function splitClass(colorClass) {
    const tokens = String(colorClass ?? '').split(/\s+/).filter(Boolean);
    return {
        color: tokens.filter((t) => !t.startsWith('noteHatched')).join(' '),
        hatch: tokens.filter((t) => t.startsWith('noteHatched')).join(' ')
    };
}

export function joinClass(cell) {
    return [cell?.color, cell?.hatch].filter(Boolean).join(' ');
}

function sameCell(a, b) {
    return joinClass(a) === joinClass(b);
}

function cellsOf(entry) {
    const out = {};
    for (const [k, v] of Object.entries((entry && entry.dict) || {})) {
        if (v && v.colorClass && !v.readonly) out[k] = splitClass(v.colorClass);
    }
    return out;
}

//=============================== sanitize on open =============================

function sanitizeCell(cell) {
    if (!cell || typeof cell !== 'object') return null;
    if (typeof cell.colorClass !== 'string' || !cell.colorClass.trim() || !SAFE_CLASS.test(cell.colorClass)) return null;
    const out = { colorClass: cell.colorClass.trim().replace(/\s+/g, ' ') };
    ['caption', 'tiny'].forEach((f) => { if (typeof cell[f] === 'string') out[f] = cell[f]; });
    if (typeof cell.captionClass === 'string' && SAFE_CLASS.test(cell.captionClass)) out.captionClass = cell.captionClass;
    if (cell.readonly === true) out.readonly = true;
    return out;
}

/** userEntries: array of [rawName, entry]. Returns {dicts, renames:[{from,to,reason}]} with cleaned, unique, safe names. */
export function sanitizeColorDicts(userEntries, { knownRoles = null } = {}) {
    const dicts = {};
    const renames = [];
    const placed = [];
    for (const [rawName, entry] of userEntries || []) {
        if (!entry || typeof entry !== 'object' || !entry.dict || typeof entry.dict !== 'object') {
            renames.push({ from: rawName, to: null, reason: 'dropped: not a stylesheet' });
            continue;
        }
        const cleaned = cleanSheetName(rawName);
        let name = cleaned.name;
        let reason = cleaned.changed ? 'name cleaned' : '';
        if (!name) {
            name = 'user';
            reason = 'empty name';
        }
        if (isBuiltInName(name)) {
            name += '-user';
            reason = 'collides with a built-in stylesheet';
        }
        if (findKeyCI(placed, name)) {
            name = freeName(name, [...RESERVED_NAMES, ...placed]);
            reason = 'duplicate name';
        }
        if (isBuiltInName(name)) name = freeName(name + '-user', [...RESERVED_NAMES, ...placed]);
        const dict = {};
        for (const [noteKey, cell] of Object.entries(entry.dict)) {
            if (!hasOwn(entry.dict, noteKey)) continue;
            if (knownRoles && !knownRoles.has(noteKey)) continue;
            if (!/^note[A-Za-z0-9]+$/.test(noteKey)) continue;
            const clean = sanitizeCell(cell);
            if (clean) dict[noteKey] = clean;
        }
        placed.push(name);
        dicts[name] = { readOnly: false, computed: false, checked: entry.checked !== false, dict };
        if (name !== rawName) renames.push({ from: rawName, to: name, reason });
    }
    return { dicts, renames };
}

//=============================== flags and order ==============================

/** Song open: system sheets are ticked per the shipping set (alwaysOn or defaultOn). User flags are untouched. */
export function resetSystemFlags(colorDicts, layout = SYSTEM_LAYOUT) {
    layoutSheets(layout).forEach((s) => {
        if (hasOwn(colorDicts, s.id)) colorDicts[s.id].checked = s.alwaysOn || s.defaultOn;
    });
    return colorDicts;
}

/** Checkbox click on a system sheet.  alwaysOn sheets stay ticked.  Ticking a sheet in an exclusive folder unticks its
 *  siblings.  Returns true when any flag changed. */
export function setSystemSheetChecked(colorDicts, id, checked, layout = SYSTEM_LAYOUT) {
    const sheet = findLayoutSheet(id, layout);
    if (!sheet || !hasOwn(colorDicts, id)) return false;
    const want = sheet.alwaysOn ? true : !!checked;
    let changed = false;
    const set = (key, value) => {
        if (hasOwn(colorDicts, key) && !!colorDicts[key].checked !== value) { colorDicts[key].checked = value; changed = true; }
    };
    set(id, want);
    if (want) exclusiveSiblings(id, layout).forEach((other) => set(other, false));
    return changed;
}

/** Is system sheet `id` in effect?  alwaysOn sheets always are. */
export function isSystemTicked(colorDicts, id, layout = SYSTEM_LAYOUT) {
    const sheet = findLayoutSheet(id, layout);
    if (!sheet) return false;
    return sheet.alwaysOn || (hasOwn(colorDicts, id) && !!colorDicts[id].checked);
}

/** song.colorDicts for a new Song: system sheets in layout order, then the user sheets, flags reset to the shipping set. */
export function assembleColorDicts(systemSheets, userDicts, layout = SYSTEM_LAYOUT) {
    const out = {};
    systemIds(layout).forEach((id) => { if (hasOwn(systemSheets, id)) out[id] = systemSheets[id]; });
    Object.keys(userDicts || {}).forEach((k) => { out[k] = userDicts[k]; });
    return resetSystemFlags(out, layout);
}

/** Returns a new colorDicts with built-ins first, then user sheets with `key` moved by delta. null at the ends. */
export function moveUserSheet(colorDicts, key, delta) {
    const users = userKeys(colorDicts);
    const from = users.indexOf(key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= users.length) return null;
    users.splice(to, 0, users.splice(from, 1)[0]);
    const out = {};
    Object.keys(colorDicts).filter((k) => !isUserSheet(colorDicts, k)).forEach((k) => { out[k] = colorDicts[k]; });
    users.forEach((k) => { out[k] = colorDicts[k]; });
    return out;
}

//=============================== recipes ======================================

/** The system sheets in effect, in layout order (alwaysOn sheets always are). */
function tickedSystemIds(colorDicts, layout) {
    return layoutSheets(layout).filter((s) => s.alwaysOn || (hasOwn(colorDicts, s.id) && colorDicts[s.id].checked)).map((s) => s.id);
}

/** The ticked set as a recipe: user sheets (last-applied first), then the system sheets (last-applied first).
 *  When the system sheets include the whole shipping set the shipping part is written as the token Default, after the
 *  extras: "b+a+MoodLight+Default".  expandDefault writes the system sheets out instead (used by Save Look, so a
 *  Look keeps meaning the same sheets even if the shipping set changes later). */
export function buildRecipe(colorDicts, { layout = SYSTEM_LAYOUT, expandDefault = false } = {}) {
    const users = userKeys(colorDicts).filter((k) => colorDicts[k].checked).reverse();
    const system = tickedSystemIds(colorDicts, layout);
    const shipping = shippingIds(layout);
    if (!expandDefault && shipping.every((id) => system.includes(id))) {
        const extras = system.filter((id) => !shipping.includes(id)).reverse();
        return [...users, ...extras, DEFAULT_LOOK_NAME].join('+');
    }
    return [...users, ...system.reverse()].join('+');
}

/** {system: [ids in layout order] | null, users: [names]}.  Tokens: a system id or Default (the shipping set), matched
 *  case-insensitively, else a user sheet name.  A recipe with no system token (an old-style value such as "user")
 *  means the shipping set plus those user sheets.  All-Clear is always included.  The empty recipe is {system: null}. */
export function parseRecipe(str, layout = SYSTEM_LAYOUT) {
    const tokens = String(str ?? '').split('+').map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) return { system: null, users: [] };
    const ids = systemIds(layout);
    const picked = new Set();
    const users = [];
    let sawSystem = false;
    tokens.forEach((t) => {
        if (lower(t) === lower(DEFAULT_LOOK_NAME)) {
            sawSystem = true;
            shippingIds(layout).forEach((id) => picked.add(id));
            return;
        }
        const id = ids.find((i) => lower(i) === lower(t));
        if (id) {
            sawSystem = true;
            picked.add(id);
        } else if (!users.includes(t)) {
            users.push(t);
        }
    });
    if (!sawSystem) shippingIds(layout).forEach((id) => picked.add(id));
    layoutSheets(layout).filter((s) => s.alwaysOn).forEach((s) => picked.add(s.id));
    return { system: ids.filter((id) => picked.has(id)), users };
}

export function recipeKey(recipeOrParsed, layout = SYSTEM_LAYOUT) {
    const p = typeof recipeOrParsed === 'string' ? parseRecipe(recipeOrParsed, layout) : recipeOrParsed;
    if (!p.system) return '';
    return p.system.join(',') + '|' + [...p.users].sort().join(',');
}

/** The Looks table: Default (the shipping set, always first, never stored) then the Song's own Looks. */
export function lookTable(colorLooks, layout = SYSTEM_LAYOUT) {
    const out = { [DEFAULT_LOOK_NAME]: shippingIds(layout).slice().reverse().join('+') };
    Object.keys(colorLooks || {}).forEach((name) => {
        if (lower(name) !== lower(DEFAULT_LOOK_NAME)) out[name] = colorLooks[name];
    });
    return out;
}

export function allLooks(song, layout = SYSTEM_LAYOUT) {
    return lookTable(song && song.colorLooks, layout);
}

function resolveValue(value, colorLooks, layout = SYSTEM_LAYOUT) {
    const v = String(value ?? '');
    const looks = lookTable(colorLooks, layout);
    return hasOwn(looks, v) ? { look: v, recipe: String(looks[v]) } : { look: null, recipe: v };
}

/** Sets the system flags (alwaysOn or named) and the user flags absolutely from a Look name or recipe.
 *  Does not reorder. Returns {missing}. */
export function applyRecipe(colorDicts, value, colorLooks = {}, layout = SYSTEM_LAYOUT) {
    const { recipe } = resolveValue(value, colorLooks, layout);
    const p = parseRecipe(recipe, layout);
    const missing = [];
    if (!p.system) return { missing, applied: false };
    layoutSheets(layout).forEach((s) => {
        if (hasOwn(colorDicts, s.id)) colorDicts[s.id].checked = s.alwaysOn || p.system.includes(s.id);
    });
    const known = userKeys(colorDicts);
    known.forEach((k) => { colorDicts[k].checked = p.users.includes(k); });
    p.users.forEach((u) => { if (!known.includes(u)) missing.push(u); });
    return { missing, applied: true };
}

/** What to store in song.currentColorDict: keep the preferred spelling if it still means the ticked set,
 *  else a Look with the same recipe (Default first), else the canonical recipe. */
export function chooseColorDictValue({ colorDicts, colorLooks = {}, preferred = '', keepMissing = false, layout = SYSTEM_LAYOUT }) {
    const canonical = buildRecipe(colorDicts, { layout });
    const key = recipeKey(canonical, layout);
    const pref = String(preferred ?? '');
    if (pref) {
        const { recipe } = resolveValue(pref, colorLooks, layout);
        // keepMissing: a Section that names a sheet that is gone keeps its own spelling (the Matrix flags it)
        // until the user changes the selection; re-recording the sheet makes it work again.
        if (keepMissing && parseRecipe(recipe, layout).users.some((u) => !isUserSheet(colorDicts, u))) return pref;
        if (recipeKey(recipe, layout) === key) return pref;
    }
    const looks = lookTable(colorLooks, layout);
    const look = Object.keys(looks).find((n) => recipeKey(String(looks[n]), layout) === key);
    return look ?? canonical;
}

export function describeColorValue(song, value) {
    if (!song || !song.colorDicts || !Object.keys(song.colorDicts).length) return { status: 'unknown', missing: [] };
    const v = String(value ?? '');
    if (!v) return { status: 'ok', missing: [] };
    const { look, recipe } = resolveValue(v, song.colorLooks);
    const p = parseRecipe(recipe);
    const missing = p.users.filter((u) => !isUserSheet(song.colorDicts, u));
    return { status: missing.length ? 'missing' : 'ok', missing, kind: look ? 'look' : 'recipe' };
}

//=============================== usage and rename =============================

function valueTokens(value, colorLooks) {
    return parseRecipe(resolveValue(value, colorLooks).recipe).users;
}

export function findSheetUsage(song, key) {
    const looks = (song && song.colorLooks) || {};
    const sections = [];
    ((song && song.sections) || []).forEach((s, i) => {
        if (valueTokens(s?.displayOptions?.currentColorDict, looks).includes(key)) sections.push(i + 1);
    });
    return {
        sections,
        defaults: valueTokens(song?.displayOptionsDefault?.currentColorDict, looks).includes(key),
        looks: Object.keys(looks).filter((n) => parseRecipe(looks[n]).users.includes(key))
    };
}

export function findLookUsage(song, name) {
    const sections = [];
    ((song && song.sections) || []).forEach((s, i) => {
        if (s?.displayOptions?.currentColorDict === name) sections.push(i + 1);
    });
    return { sections, defaults: song?.displayOptionsDefault?.currentColorDict === name };
}

export function describeUsage(usage) {
    const parts = [];
    if (usage.sections.length) parts.push('Section' + (usage.sections.length > 1 ? 's ' : ' ') + usage.sections.join(', '));
    if (usage.defaults) parts.push('Song DEFAULTS');
    if (usage.looks && usage.looks.length) parts.push('Look' + (usage.looks.length > 1 ? 's ' : ' ') + usage.looks.join(', '));
    return parts.join('; ');
}

function repointValue(value, from, to, looks) {
    if (typeof value !== 'string' || !value || hasOwn(looks, value)) return value;
    if (value === from) return to;
    if (!value.includes('+')) return value;
    return value.split('+').map((t) => (t.trim() === from ? to : t)).join('+');
}

/** Rewrites every stored reference to sheet `from` so it names `to`. Returns the number of values changed. */
export function repointReferences(song, from, to) {
    const looks = song.colorLooks || {};
    let n = 0;
    const fix = (obj, field) => {
        if (!obj || typeof obj[field] !== 'string') return;
        const next = repointValue(obj[field], from, to, looks);
        if (next !== obj[field]) { obj[field] = next; n++; }
    };
    (song.sections || []).forEach((s) => fix(s && s.displayOptions, 'currentColorDict'));
    fix(song.displayOptionsDefault, 'currentColorDict');
    fix(song, 'currentColorDict');
    fix(song, 'activeStylesheets');
    Object.keys(looks).forEach((name) => {
        const next = repointValue(String(looks[name]), from, to, {});
        if (next !== looks[name]) { looks[name] = next; n++; }
    });
    return n;
}

//=============================== editor state =================================

export function createEditor() {
    return { selectedKey: '', sourceKind: 'new', original: {}, edits: {}, note: '' };
}

export function editorSelect(editor, colorDicts, key) {
    editor.edits = {};
    editor.note = '';
    if (hasOwn(colorDicts, key)) {
        editor.selectedKey = key;
        editor.sourceKind = isBuiltInName(key) ? 'builtin' : 'user';
        editor.original = cellsOf(colorDicts[key]);
    } else {
        editor.selectedKey = '';
        editor.sourceKind = 'new';
        editor.original = {};
    }
    return editor;
}

export function editorSetPart(editor, noteKey, part, value) {
    const base = visibleCell(editor, noteKey);
    const next = { color: base.color, hatch: base.hatch, [part]: String(value ?? '') };
    const orig = editor.original[noteKey];
    const origEmpty = !orig || !joinClass(orig);
    const nextEmpty = !joinClass(next);
    if ((orig && sameCell(orig, next)) || (origEmpty && nextEmpty) || (editor.sourceKind === 'builtin' && nextEmpty)) {
        delete editor.edits[noteKey];
    } else {
        editor.edits[noteKey] = { color: next.color, hatch: next.hatch };
    }
    return editor;
}

export function editorClearRole(editor, noteKey) {
    const orig = editor.original[noteKey];
    if (editor.sourceKind === 'builtin' || !orig || !joinClass(orig)) {
        delete editor.edits[noteKey];
    } else {
        editor.edits[noteKey] = { color: '', hatch: '' };
    }
    return editor;
}

/** Replaces the pending edits with `cells` ({noteKey:{color,hatch}}), keeping only differences from the source. */
export function editorLoadEdits(editor, cells) {
    editor.edits = {};
    for (const [k, cell] of Object.entries(cells || {})) {
        const orig = editor.original[k];
        if (!joinClass(cell)) continue;
        if (orig && sameCell(orig, cell)) continue;
        editor.edits[k] = { color: cell.color || '', hatch: cell.hatch || '' };
    }
    return editor;
}

/** status: blank | saved | edited | removed | inherited */
export function visibleCell(editor, noteKey) {
    if (hasOwn(editor.edits, noteKey)) {
        const e = editor.edits[noteKey];
        return { color: e.color, hatch: e.hatch, status: joinClass(e) ? 'edited' : 'removed' };
    }
    const orig = editor.original[noteKey];
    if (orig && joinClass(orig)) {
        return { color: orig.color, hatch: orig.hatch, status: editor.sourceKind === 'builtin' ? 'inherited' : 'saved' };
    }
    return { color: '', hatch: '', status: 'blank' };
}

export function countChanges(editor) {
    let changed = 0;
    let removed = 0;
    Object.values(editor.edits).forEach((e) => { if (joinClass(e)) changed++; else removed++; });
    return { changed, removed };
}

function visibleCells(editor, { withOriginal }) {
    const out = {};
    if (withOriginal) Object.entries(editor.original).forEach(([k, c]) => { if (joinClass(c)) out[k] = { ...c }; });
    Object.entries(editor.edits).forEach(([k, e]) => { if (joinClass(e)) out[k] = { ...e }; else delete out[k]; });
    return out;
}

//=============================== plans ========================================

function blocked(reason, extra = {}) {
    return { ok: false, blocked: reason, ...extra };
}

function sameCellMaps(a, b) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => hasOwn(b, k) && sameCell(a[k], b[k]));
}

export function planSave(editor, { rawName, colorDicts, colorLooks = {} }) {
    const cleaned = cleanSheetName(rawName);
    let name = cleaned.name;
    let nameNote = cleaned.changed && name ? 'cleaned' : '';
    if (!name) {
        name = freeName('user', [...RESERVED_NAMES, ...Object.keys(colorDicts), ...Object.keys(colorLooks)]);
        nameNote = 'empty';
    }
    if (isBuiltInName(name)) {
        name = builtInName(name) + '-user';
        nameNote = 'built-in';
    }
    if (findKeyCI(Object.keys(colorLooks), name)) return blocked('name-is-look', { name });
    const existingKey = findKeyCI(userKeys(colorDicts), name);
    if (existingKey) name = existingKey;
    const existing = existingKey ? cellsOf(colorDicts[existingKey]) : null;

    const write = visibleCells(editor, { withOriginal: editor.sourceKind !== 'builtin' });
    const removed = Object.entries(editor.edits).filter(([, e]) => !joinClass(e)).map(([k]) => k);
    const final = { ...(existing || {}), ...write };
    removed.forEach((k) => { delete final[k]; });

    if (!Object.keys(final).length) return blocked(existing ? 'would-be-empty' : 'empty', { name });
    if (existing && sameCellMaps(existing, final)) return blocked('no-change', { name });

    let changed = 0;
    let removedCount = 0;
    if (existing) {
        Object.entries(final).forEach(([k, c]) => { if (!existing[k] || !sameCell(existing[k], c)) changed++; });
        Object.keys(existing).forEach((k) => { if (!final[k]) removedCount++; });
    }
    const sourceNote = editor.sourceKind === 'builtin' && !existing ? editor.selectedKey : '';
    return {
        ok: true,
        action: existing ? 'update' : 'create',
        name,
        cells: final,
        count: Object.keys(final).length,
        changed,
        removed: removedCount,
        nameNote,
        fromBuiltIn: sourceNote
    };
}

export function planCopy(editor, { colorDicts, colorLooks = {} }) {
    const cells = visibleCells(editor, { withOriginal: true });
    if (!Object.keys(cells).length) return blocked('empty');
    const taken = [...RESERVED_NAMES, ...Object.keys(colorDicts), ...Object.keys(colorLooks)];
    let preferred;
    if (editor.sourceKind === 'user') preferred = editor.selectedKey + '-copy';
    else if (editor.sourceKind === 'builtin') preferred = editor.selectedKey + '-user';
    else preferred = 'user';
    const name = freeName(cleanSheetName(preferred).name, taken);
    return { ok: true, action: 'copy', name, cells, count: Object.keys(cells).length };
}

export function planRename(selectedKey, rawName, { colorDicts, colorLooks = {} }) {
    if (!isUserSheet(colorDicts, selectedKey)) return blocked('not-user-sheet');
    const cleaned = cleanSheetName(rawName);
    if (!cleaned.name) return blocked('empty');
    if (cleaned.name === selectedKey) return blocked('no-change', { name: cleaned.name });
    const taken = [...RESERVED_NAMES, ...Object.keys(colorDicts).filter((k) => k !== selectedKey), ...Object.keys(colorLooks)];
    if (findKeyCI(taken, cleaned.name)) return blocked('name-taken', { name: cleaned.name });
    return { ok: true, action: 'rename', from: selectedKey, name: cleaned.name, nameNote: cleaned.changed ? 'cleaned' : '' };
}

export function describePlan(plan) {
    if (!plan) return '';
    if (!plan.ok) {
        const q = plan.name ? ` "${plan.name}"` : '';
        switch (plan.blocked) {
            case 'empty': return 'Nothing to save yet: pick at least one color or hatch.';
            case 'would-be-empty': return `Saving would leave${q} with no colors. Delete the stylesheet instead.`;
            case 'no-change': return `No changes to save${q}.`;
            case 'name-is-look': return `"${plan.name}" is the name of a Look. Choose a different stylesheet name.`;
            case 'name-taken': return `"${plan.name}" is already used by a stylesheet, built-in or Look.`;
            case 'not-user-sheet': return 'Select one of your own stylesheets to rename it. Built-ins cannot be renamed.';
            default: return 'Cannot save.';
        }
    }
    const s = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const lead = plan.nameNote === 'cleaned' ? `Name cleaned to "${plan.name}". `
        : plan.nameNote === 'built-in' ? `A built-in cannot be overwritten, so this saves as "${plan.name}". `
        : plan.nameNote === 'empty' ? `No name given, so this saves as "${plan.name}". ` : '';
    if (plan.action === 'rename') {
        return `${lead}Renames "${plan.from}" to "${plan.name}" and updates Sections, Looks and DEFAULTS that use it.`;
    }
    if (plan.action === 'copy') return `Copy as "${plan.name}" with ${s(plan.count, 'color')}.`;
    if (plan.action === 'update') {
        const bits = [];
        if (plan.changed) bits.push(`${plan.changed} changed`);
        if (plan.removed) bits.push(`${plan.removed} removed`);
        return `${lead}Updates "${plan.name}": ${bits.join(', ')}. The previous version goes to the Graveyard.`;
    }
    if (plan.fromBuiltIn) {
        return `${lead}"${plan.name}" starts from ${plan.fromBuiltIn}: Save writes only the ${s(plan.count, 'cell')} you changed.`;
    }
    return `${lead}New sheet "${plan.name}" with ${s(plan.count, 'color')}.`;
}

/** Builds the sheet entry for a create/update/copy plan. roleTemplates is the OEM dict (caption, tiny, captionClass). */
export function buildSheetEntry(plan, roleTemplates, checked = true) {
    const dict = {};
    Object.keys(roleTemplates).forEach((noteKey) => {
        const cell = plan.cells[noteKey];
        if (!cell) return;
        const t = roleTemplates[noteKey] || {};
        const out = {};
        ['caption', 'tiny', 'captionClass'].forEach((f) => { if (typeof t[f] === 'string') out[f] = t[f]; });
        out.colorClass = joinClass(cell);
        dict[noteKey] = out;
    });
    return { readOnly: false, computed: false, checked, dict };
}

//=============================== table rows ===================================

/** Cells of the ticked sheets in `ids`, merged in the given (layout) order, the last one winning. Used for a closed
 *  folder's summary row. Returns {noteKey: cell} with the cells as stored. */
export function folderSummaryCells(colorDicts, ids) {
    const out = {};
    (ids || []).forEach((id) => {
        Object.entries((hasOwn(colorDicts, id) && colorDicts[id].dict) || {}).forEach(([k, v]) => {
            if (v && v.colorClass && !v.readonly) out[k] = v;
        });
    });
    return out;
}

/** "Folder : child+child" with the ticked children in precedence order (the last-applied first, as in a recipe),
 *  or just "Folder" when none is ticked. `tickedIds` is in layout order. */
export function folderLabel(name, tickedIds) {
    const ids = [...(tickedIds || [])].reverse();
    return ids.length ? `${name} : ${ids.join('+')}` : name;
}

/** The rows of the Stylesheets table, top to bottom: the system layout (a folder's sheets only while it is open), then
 *  the user sheets as a flat list. `showColors` says whether a sheet row shows its cells ("All" overrides unticked).
 *  A folder row shows `summaryIds` merged while closed (its own `showAll` is ignored) and blank cells while open. */
export function planStylesheetRows(colorDicts, { openFolders = new Set(), showAll = false, layout = SYSTEM_LAYOUT } = {}) {
    const rows = [];
    const sheetRow = (s, folder) => {
        const checked = isSystemTicked(colorDicts, s.id, layout);
        return { kind: 'sheet', id: s.id, folder, system: true, checked, alwaysOn: s.alwaysOn, showColors: checked || showAll };
    };
    layout.forEach((entry) => {
        if (entry.sheet) {
            if (hasOwn(colorDicts, entry.sheet)) rows.push(sheetRow(findLayoutSheet(entry.sheet, layout), null));
            return;
        }
        const children = entry.sheets.filter((s) => hasOwn(colorDicts, s.id)).map((s) => findLayoutSheet(s.id, layout));
        if (!children.length) return;
        const ticked = children.filter((s) => isSystemTicked(colorDicts, s.id, layout)).map((s) => s.id);
        const open = openFolders.has(entry.folder);
        rows.push({
            kind: 'folder', name: entry.folder, open, ids: children.map((s) => s.id), ticked,
            label: folderLabel(entry.folder, ticked), summaryIds: ticked
        });
        if (open) children.forEach((s) => rows.push(sheetRow(s, entry.folder)));
    });
    const users = userKeys(colorDicts);
    users.forEach((id, userIndex) => {
        rows.push({ kind: 'sheet', id, folder: null, system: false, checked: !!colorDicts[id].checked, alwaysOn: false,
            showColors: !!colorDicts[id].checked || showAll, userIndex, userCount: users.length });
    });
    return rows;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Recipe text as safe HTML that may break after each "+": each token is escaped, joined by "+<wbr>". */
export function wrapRecipeHtml(text) {
    return String(text ?? '').split('+').map((t) => t.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])).join('+<wbr>');
}

//=============================== Looks ========================================

export function planSaveLook({ rawName, colorDicts, colorLooks = {} }) {
    const cleaned = cleanSheetName(rawName);
    if (!cleaned.name) return blocked('empty');
    const taken = [...RESERVED_NAMES, ...Object.keys(colorDicts)];
    if (findKeyCI(taken, cleaned.name)) return blocked('name-taken', { name: cleaned.name });
    const existingKey = findKeyCI(Object.keys(colorLooks), cleaned.name);
    const name = existingKey ?? cleaned.name;
    const recipe = buildRecipe(colorDicts, { expandDefault: true });
    if (existingKey && colorLooks[existingKey] === recipe) return blocked('no-change', { name });
    return { ok: true, action: existingKey ? 'update' : 'create', name, recipe, nameNote: cleaned.changed ? 'cleaned' : '' };
}

export function describeLookPlan(plan) {
    if (!plan.ok) {
        if (plan.blocked === 'empty') return 'Type a name to save the current stylesheet selection as a Look.';
        if (plan.blocked === 'name-taken') return `"${plan.name}" is already a stylesheet or built-in name.`;
        return `The Look "${plan.name}" already has this recipe.`;
    }
    const lead = plan.nameNote === 'cleaned' ? `Name cleaned to "${plan.name}". ` : '';
    return `${lead}${plan.action === 'update' ? 'Updates' : 'Saves'} Look "${plan.name}" = ${plan.recipe}`;
}
