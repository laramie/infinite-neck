/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 3: pure (DOM-free, Song-free) logic for the Function Symbols panel.
// See _doco/design/sprints/148-displayOptions-diff/148-it3-implementation-plan.md
//
// A "Function Symbols set" is { id, caption, symbols: [12 strings] }.
//   - Built-in sets are defined here (frozen); edit them here and every Song picks up the
//     change by id on its next load.
//   - User sets live in the Song as `song.functionSymbolSets` and are saved in the Song file.
//   - Sections refer to a set by id: section.displayOptions.functionSymbols === "<id>".
//
// Symbols are rendered as HTML by the note cell builder, so every symbol is validated against
// a small whitelist (no attributes) with a pure tokenizer -- never the DOM sanitizer, which
// is a pass-through when there is no `document` (Jest, Node tools).

export const DEFAULT_SET_ID = 'function';
export const USER_CAPTION_PREFIX = 'U: ';
export const USER_ID_PREFIX = 'u-';
export const SYMBOL_COUNT = 12;
export const MAX_USER_SETS = 20;
export const MAX_TEXT_LENGTH = 40;

const ALLOWED_SYMBOL_TAGS = new Set(['small', 'em', 'sub', 'sup', 'b', 'i', 's', 'span']);
const FORBIDDEN_CAPTION_CHARS = /[<>&"']/;

function freezeSet(id, caption, symbols) {
    return Object.freeze({ id, caption, symbols: Object.freeze([...symbols]) });
}

/** Order is the order of the SELECT.  Symbols use the decoded characters the old SELECT
 *  produced at runtime (HTML attribute decoding turned &tau; into the character). */
export const BUILTIN_SETS = Object.freeze([
    freezeSet('function', 'Function',
        ['I', 'τ', 'II', 'm', 'III', 'IV', 'Θ', 'V', 'σ', '6', 'δ', 'Δ']),
    freezeSet('extensions', 'Extensions',
        ['I', 'τ<small> ♭9</small>', 'II<small> 9</small>', 'm', 'III', 'IV<small> 11</small>', 'Θ<small> #11</small>', 'V', 'σ<small> ♭13</small>', '6<small> 13</small>', 'δ', 'Δ']),
    freezeSet('extensions-only', 'Extensions (only)',
        ['I', '<small>♭9</small>', '<small>9</small>', 'm', 'III', 'IV<small>11</small>', '<small>#11</small>', 'V', '<small>♭13</small>', '<small>13</small>', 'δ', 'Δ']),
    freezeSet('jazz', 'Jazz',
        ['1', '<em>♭</em>2', '2', '<em>♭</em>3', '3', '4', '<em>♭</em>5', '5', '<em>♭</em>6', '6', '<em>♭</em>7', '7']),
    freezeSet('jazz-extensions', 'Jazz Extensions',
        ['1', '<em>♭</em>9', '9', '<em>♭</em>3', '3', '11', '<em>#</em>11', '5', '<em>♭</em>13', '13', '<em>♭</em>7', '7']),
    freezeSet('function-numbers', 'Function Numbers',
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']),
    freezeSet('function-offset', 'Function Offset',
        ['+0', '+1', '+2', '+3', '+4', '+5', '+6', '+7', '+8', '+9', '+10', '+11']),
    freezeSet('function-plus-offset', 'Function + Offset',
        ['I<small>+0</small>', 'τ<small>+1</small>', 'II<small>+2</small>', 'm<small>+3</small>', 'III<small>+4</small>', 'IV<small>+5</small>', 'Θ<small>+6</small>', 'V<small>+7</small>', 'σ<small>+8</small>', '6<small>+9</small>', 'δ<small>+10</small>', 'Δ<small>+11</small>']),
    freezeSet('sounds-like', 'Sounds Like',
        ['One', 'Tau', 'Two', 'Mi', 'Three', 'Four', 'Tri', 'Fi', 'Sa', 'Six', 'Dom', 'Say']),
    freezeSet('solfege', 'Solfège',
        ['Do', 'Ra', 'Re', 'Ma', 'Mi', 'Fa', 'Se', 'Sol', 'Le', 'La', 'Ta', 'Ti']),
    freezeSet('kanji-numerals', 'Kanji Numerals',
        ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'])
]);

//=========================== registry ==========================================

export function isBuiltInId(id) {
    return BUILTIN_SETS.some((set) => set.id === id);
}

/** Built-ins first (fixed order), then user sets in Song order. */
export function getAllSets(userSets = []) {
    return [...BUILTIN_SETS, ...(Array.isArray(userSets) ? userSets : [])];
}

/** Returns the set, or null when the id is neither built-in nor a user set. */
export function resolveSet(id, userSets = []) {
    if (typeof id !== 'string' || !id) {
        return null;
    }
    return getAllSets(userSets).find((set) => set.id === id) || null;
}

/** For the migration tool: the built-in id whose symbols equal the given array, else null. */
export function findBuiltInIdForSymbols(symbols) {
    if (!Array.isArray(symbols)) {
        return null;
    }
    const text = JSON.stringify(symbols);
    const found = BUILTIN_SETS.find((set) => JSON.stringify(set.symbols) === text);
    return found ? found.id : null;
}

/** 1-based Section numbers whose own stored DisplayOptions block names this set.
 *  Sections that merely inherit the set by cascade store nothing and are not counted. */
export function findUsage(sections, id) {
    const list = Array.isArray(sections) ? sections : [];
    const used = [];
    list.forEach((section, index) => {
        if (section?.displayOptions?.functionSymbols === id) {
            used.push(index + 1);
        }
    });
    return used;
}

//=========================== captions and ids ==================================

/** Lowercase ascii kebab-case: diacritics stripped, runs of other characters become one "-". */
export function squeezeId(caption) {
    return `${caption ?? ''}`
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Id for a new User set: squeezed caption, always starting with "u-" so it can never
 *  collide with a built-in id.  "" when the caption has no letter or digit. */
export function userIdFromCaption(caption) {
    const squeezed = squeezeId(caption);
    if (!squeezed) {
        return '';
    }
    return squeezed.startsWith(USER_ID_PREFIX) ? squeezed : `${USER_ID_PREFIX}${squeezed}`;
}

export function normalizeCaption(caption) {
    return `${caption ?? ''}`.trim().replace(/\s+/g, ' ');
}

/** Removes ONE leading "U: " so cloning never nests "U: U: ...". */
export function stripUserCaptionPrefix(caption) {
    return normalizeCaption(caption).replace(/^U:\s*/i, '');
}

export function proposeCaption(selectedCaption) {
    return `${USER_CAPTION_PREFIX}${stripUserCaptionPrefix(selectedCaption)}`;
}

/**
 * @param exceptId  when updating an existing User set: its own caption/id are not conflicts.
 * @param forCreate true: the id is derived from the caption and must be unique;
 *                  false: the set keeps `exceptId` forever, so only the caption is checked.
 * @returns {{ok:boolean, caption:string, id:string, message:string}}
 */
export function validateCaption(rawCaption, allSets, { exceptId = null, forCreate = true } = {}) {
    const caption = normalizeCaption(rawCaption);
    const id = forCreate ? userIdFromCaption(caption) : (exceptId || '');
    const fail = (message) => ({ ok: false, caption, id, message });

    if (!caption) {
        return fail('Caption is required.');
    }
    if (caption.length > MAX_TEXT_LENGTH) {
        return fail(`Caption is ${caption.length} characters; the limit is ${MAX_TEXT_LENGTH}.`);
    }
    if (FORBIDDEN_CAPTION_CHARS.test(caption)) {
        return fail('Caption cannot contain < > & or quote characters.');
    }
    const sets = Array.isArray(allSets) ? allSets : [];
    const lower = caption.toLowerCase();
    const clash = sets.find((set) => set.id !== exceptId && set.caption.toLowerCase() === lower);
    if (clash) {
        return fail(`A set captioned "${clash.caption}" already exists; change the caption.`);
    }
    if (forCreate) {
        if (!id) {
            return fail('Caption needs at least one letter or digit.');
        }
        if (sets.some((set) => set.id === id)) {
            return fail(`ID "${id}" is already in use; change the caption.`);
        }
    }
    return { ok: true, caption, id, message: '' };
}

//=========================== symbols ===========================================

/** Returns '' when the text is acceptable, otherwise a short message.
 *  Allowed: plain text, whitelisted tags WITHOUT attributes (properly nested), and
 *  well-formed entities (&flat; &#9837; &#x266d;). */
export function checkSymbolMarkup(text) {
    const stack = [];
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        const code = text.charCodeAt(i);
        if (code < 32 || code === 127) {
            return 'control characters are not allowed';
        }
        if (ch === '<') {
            const match = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)>/.exec(text.slice(i));
            if (!match) {
                return 'tag not allowed (only <small> <em> <sub> <sup> <b> <i> <s> <span>, no attributes)';
            }
            const name = match[2].toLowerCase();
            if (!ALLOWED_SYMBOL_TAGS.has(name)) {
                return `tag <${name}> not allowed`;
            }
            if (match[1]) {
                if (stack.pop() !== name) {
                    return `unbalanced </${name}>`;
                }
            } else {
                stack.push(name);
            }
            i += match[0].length - 1;
        } else if (ch === '>') {
            return 'stray ">"';
        } else if (ch === '&') {
            const match = /^&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/.exec(text.slice(i));
            if (!match) {
                return 'stray "&" (write entities like &flat; )';
            }
            i += match[0].length - 1;
        }
    }
    if (stack.length) {
        return `unclosed <${stack[stack.length - 1]}>`;
    }
    return '';
}

/** @returns {{ok:boolean, symbols:string[]|null, message:string}} */
export function validateSymbolArray(value) {
    if (!Array.isArray(value)) {
        return { ok: false, symbols: null, message: 'Must be a JSON array of 12 strings.' };
    }
    if (value.length !== SYMBOL_COUNT) {
        return { ok: false, symbols: null, message: `${value.length} entries, need ${SYMBOL_COUNT}.` };
    }
    for (let i = 0; i < value.length; i += 1) {
        const entry = value[i];
        const label = `Entry ${i + 1}`;
        if (typeof entry !== 'string') {
            return { ok: false, symbols: null, message: `${label} is not text (use quotes).` };
        }
        if (!entry.trim()) {
            return { ok: false, symbols: null, message: `${label} is empty.` };
        }
        if (entry.length > MAX_TEXT_LENGTH) {
            return { ok: false, symbols: null, message: `${label} is ${entry.length} characters; the limit is ${MAX_TEXT_LENGTH}.` };
        }
        const problem = checkSymbolMarkup(entry);
        if (problem) {
            return { ok: false, symbols: null, message: `${label}: ${problem}.` };
        }
    }
    return { ok: true, symbols: [...value], message: '' };
}

/** Parses and validates the textarea's text. */
export function validateSymbols(text) {
    let parsed;
    try {
        parsed = JSON.parse(`${text ?? ''}`);
    } catch (error) {
        return { ok: false, symbols: null, message: 'Not valid JSON: check commas and quotes.' };
    }
    return validateSymbolArray(parsed);
}

//=========================== preview ===========================================

/** Rows top to bottom, 5 columns, laid out like a 5-fret guitar: bottom row 1-5,
 *  middle row 6-10, top row 11-12 (positions 13-15 are null).  Cells are
 *  { index, symbol } where index is the 0-based position in the JSON array. */
export function buildPreviewGrid(symbols) {
    const list = Array.isArray(symbols) ? symbols : [];
    const columns = 5;
    const rows = [];
    for (let rowStart = 2 * columns; rowStart >= 0; rowStart -= columns) {
        const row = [];
        for (let col = 0; col < columns; col += 1) {
            const index = rowStart + col;
            row.push(index < SYMBOL_COUNT ? { index, symbol: list[index] ?? '' } : null);
        }
        rows.push(row);
    }
    return rows;
}

//=========================== user set list operations ==========================
// All return new arrays/objects; callers assign the result to the Song.

export function addUserSet(userSets, set) {
    return [...userSets, { id: set.id, caption: set.caption, symbols: [...set.symbols] }];
}

export function updateUserSet(userSets, id, changes) {
    return userSets.map((set) => (set.id === id
        ? { id: set.id, caption: changes.caption ?? set.caption, symbols: [...(changes.symbols ?? set.symbols)] }
        : set));
}

export function deleteUserSet(userSets, id) {
    return userSets.filter((set) => set.id !== id);
}

/** delta -1 = up, +1 = down.  Never leaves the User list (built-ins are not in it). */
export function moveUserSet(userSets, id, delta) {
    const from = userSets.findIndex((set) => set.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= userSets.length) {
        return userSets;
    }
    const copy = [...userSets];
    [copy[from], copy[to]] = [copy[to], copy[from]];
    return copy;
}

/** Cleans what came from a Song file: drops invalid entries, duplicate ids and built-in ids,
 *  caps the count.  Used by SongPersistence on load. */
export function normalizeUserSets(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const seen = new Set(BUILTIN_SETS.map((set) => set.id));
    const result = [];
    for (const entry of list) {
        if (result.length >= MAX_USER_SETS) {
            break;
        }
        if (!entry || typeof entry !== 'object') {
            continue;
        }
        const id = `${entry.id ?? ''}`;
        if (!/^u-[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || seen.has(id)) {
            continue;
        }
        const caption = normalizeCaption(entry.caption);
        if (!caption || caption.length > MAX_TEXT_LENGTH || FORBIDDEN_CAPTION_CHARS.test(caption)) {
            continue;
        }
        const symbols = validateSymbolArray(entry.symbols);
        if (!symbols.ok) {
            continue;
        }
        seen.add(id);
        result.push({ id, caption, symbols: symbols.symbols });
    }
    return result;
}

//=========================== panel state =======================================

/**
 * Everything the widget needs to paint, derived from plain data (no DOM, no Song).
 *
 * Built-in selected  -> mode "create": Save adds a new User set (caption proposed as "U: <caption>").
 * User set selected  -> mode "update": Save edits it in place; its id never changes, and
 *                       the caption may be renamed (it need not match the id).
 *
 * @param {{selectedId:string, userSets:object[], draftText:string, draftCaption:string, sections:object[]}} input
 */
export function computeState({ selectedId, userSets = [], draftText = '', draftCaption = '', sections = [] }) {
    const allSets = getAllSets(userSets);
    const selected = resolveSet(selectedId, userSets);
    const isBuiltIn = !selected || isBuiltInId(selected.id);
    const mode = isBuiltIn ? 'create' : 'update';
    const userIndex = isBuiltIn ? -1 : userSets.findIndex((set) => set.id === selected.id);

    const symbols = validateSymbols(draftText);
    const caption = validateCaption(draftCaption, allSets, {
        exceptId: isBuiltIn ? null : selected.id,
        forCreate: isBuiltIn
    });

    let captionMessage = caption.message;
    if (isBuiltIn && !captionMessage && userSets.length >= MAX_USER_SETS) {
        captionMessage = `This Song already has ${MAX_USER_SETS} User sets; delete one first.`;
    }
    const roomToCreate = !isBuiltIn || userSets.length < MAX_USER_SETS;

    let dirty = true;
    if (!isBuiltIn) {
        const sameSymbols = symbols.ok && JSON.stringify(symbols.symbols) === JSON.stringify(selected.symbols);
        dirty = !(sameSymbols && caption.caption === selected.caption);
    }

    const usageSections = isBuiltIn ? [] : findUsage(sections, selected.id);

    return {
        mode,
        isBuiltIn,
        selectedId: selected ? selected.id : DEFAULT_SET_ID,
        symbols,
        caption,
        symbolsMessage: symbols.ok ? '' : symbols.message,
        captionMessage,
        idLabel: caption.id,
        dirty,
        canSave: symbols.ok && caption.ok && roomToCreate && dirty,
        usageSections,
        canDelete: !isBuiltIn && usageSections.length === 0,
        canMoveUp: !isBuiltIn && userIndex > 0,
        canMoveDown: !isBuiltIn && userIndex >= 0 && userIndex < userSets.length - 1
    };
}
