export const TUTORIAL_MODES = Object.freeze({
    NONE: 'none',
    STRICT: 'strict',
    WIZARD: 'wizard'
});

const VALID_TUTORIAL_MODES = new Set(Object.values(TUTORIAL_MODES));
const PROGRESS_VERSION = 2;
const PROGRESS_STORAGE_PREFIX = 'infinite-neck:tutorial-progress:';

export function normalizeTutorialMode(mode) {
    const normalized = `${mode || ''}`.trim().toLowerCase();
    return VALID_TUTORIAL_MODES.has(normalized) ? normalized : TUTORIAL_MODES.NONE;
}

export function isStrictTutorialLevel(level) {
    return normalizeTutorialMode(level) === TUTORIAL_MODES.STRICT;
}

export function isTutorialSong(song = {}) {
    return normalizeTutorialMode(song?.tutorial?.level) !== TUTORIAL_MODES.NONE;
}

/** Sprint 152 it3/it4: the wizard-mode "Edit Prompt" button exists only in wizard mode (strict and none never edit).
 *  "use caption for tutorial" does not matter for the prompt. */
export function canEditTutorialPrompt(song = {}) {
    return normalizeTutorialMode(song?.tutorial?.level) === TUTORIAL_MODES.WIZARD;
}

/** Sprint 152 it4: the wizard-mode tutorial caption (`section.tutorial.caption`) is editable, except when "use caption for tutorial"
 *  is on: then the Section's own caption is shown instead, and the Edit Caption button is a "&sect; Caption" label. */
export function canEditTutorialCaption(song = {}) {
    return canEditTutorialPrompt(song) && !song?.tutorial?.useCaptionForSectionCaption;
}

/** Sprint 152 it4: textarea text to the plain-text `section.tutorial.caption` to store ('' when nothing is left).
 *  `toPlainText` is html-sanitizer's getSanitizedPlainText: tags are removed, entities decoded, whitespace collapsed. */
export function captionTextToCaption(text, toPlainText = (value) => value) {
    return `${toPlainText(`${text ?? ''}`.replace(/\r\n?/g, '\n')) ?? ''}`.trim();
}

/** Returns the new `section.tutorial` object with its caption set (or removed for an empty caption); undefined when nothing is left. */
export function applyCaptionToSectionTutorial(sectionTutorial, caption) {
    const tutorial = sectionTutorial && typeof sectionTutorial === 'object' ? { ...sectionTutorial } : {};
    if (caption) {
        tutorial.caption = caption;
    } else {
        delete tutorial.caption;
    }
    return Object.keys(tutorial).length > 0 ? tutorial : undefined;
}

/** Text for the Edit Prompt textarea: the existing prompt lines, one per line. */
export function promptToEditText(prompt) {
    return Array.isArray(prompt?.lines) ? prompt.lines.map((line) => `${line ?? ''}`).join('\n') : '';
}

/** Textarea text to a `section.tutorial.prompt` value, or null when the text is empty (after sanitizing).
 *  The whole text is sanitized at once, so an element typed across several lines survives, and is stored as one entry
 *  (render joins entries with a newline anyway, so it displays the same as one entry per line). */
export function promptTextToPrompt(text, sanitize = (value) => value) {
    const normalized = `${text ?? ''}`.replace(/\r\n?/g, '\n');
    const clean = `${sanitize(normalized) ?? ''}`;
    return clean.trim().length > 0 ? { lines: [clean] } : null;
}

/** Returns the new `section.tutorial` object with its prompt set (or removed for a null prompt); undefined when nothing is left. */
export function applyPromptToSectionTutorial(sectionTutorial, prompt) {
    const tutorial = sectionTutorial && typeof sectionTutorial === 'object' ? { ...sectionTutorial } : {};
    if (prompt) {
        tutorial.prompt = prompt;
    } else {
        delete tutorial.prompt;
    }
    return Object.keys(tutorial).length > 0 ? tutorial : undefined;
}

/** Sprint 152 it5: the text typed for `Song.tutorial.caption` (command line `/vpe`) to the plain-text caption to store.
 *  Typed `\"` means `"`.  `toPlainText` (html-sanitizer's getSanitizedPlainText) removes tags and decodes entities, so the
 *  stored caption is plain text, which is escaped wherever it is rendered.  Returns '' when nothing is left. */
export function tutorialCaptionFromInput(text, toPlainText = (value) => value) {
    const unescaped = `${text ?? ''}`.replace(/\r\n?/g, '\n').replaceAll('\\"', '"');
    return `${toPlainText(unescaped) ?? ''}`.trim();
}

/** Sprint 152 it5 r3: typing exactly `<>` (before any sanitizing, which would strip it) in `/vpe` means "remove Song.tutorial.caption".
 *  A blank entry still means "no change"; the literal text `&lt;>` is stored as `<>`. */
export function isTutorialCaptionClearToken(text) {
    return `${text ?? ''}`.trim() === '<>';
}

/** Returns the new `Song.tutorial` object with its caption set (or removed for an empty caption).  Keeps the other fields,
 *  and always has a `level`. */
export function applyCaptionToSongTutorial(songTutorial, caption) {
    const tutorial = songTutorial && typeof songTutorial === 'object' ? { ...songTutorial } : {};
    tutorial.level = normalizeTutorialMode(tutorial.level);
    if (caption) {
        tutorial.caption = caption;
    } else {
        delete tutorial.caption;
    }
    return tutorial;
}

/** Sprint 152 it5: whether `Song.tutorial` is worth writing to a Song file.  A tutorial at level `none` is dropped,
 *  unless the author set something that only matters to authoring (a caption, a storage key, or "use caption for tutorial"). */
export function isSongTutorialPersistable(songTutorial) {
    if (!songTutorial || typeof songTutorial !== 'object') {
        return false;
    }
    if (normalizeTutorialMode(songTutorial.level) !== TUTORIAL_MODES.NONE) {
        return true;
    }
    return `${songTutorial.caption ?? ''}`.length > 0
        || `${songTutorial.storageKey ?? ''}`.length > 0
        || songTutorial.useCaptionForSectionCaption === true;
}

export function deriveTutorialStorageKeyFromHref(href = '') {
    return `${href || ''}`.trim().replace(/^songs\//, '').replace(/\.json$/i, '');
}

export function getTutorialStorageKey(songOrEntry = {}) {
    const explicit = `${songOrEntry?.tutorial?.storageKey || songOrEntry?.storageKey || ''}`.trim();
    if (explicit) {
        return explicit;
    }
    return deriveTutorialStorageKeyFromHref(songOrEntry?.href || '');
}

export function getTutorialProgressStorageKey(songOrEntry = {}) {
    const storageKey = getTutorialStorageKey(songOrEntry);
    return storageKey ? `${PROGRESS_STORAGE_PREFIX}${storageKey}` : '';
}

function normalizeSectionIndex(value, sectionCount) {
    const index = Number.parseInt(value, 10);
    if (!Number.isInteger(index) || index < 0) {
        return null;
    }
    if (Number.isInteger(sectionCount) && sectionCount >= 0 && index >= sectionCount) {
        return null;
    }
    return index;
}

export function normalizeDoneSectionIndexes(rawIndexes = [], sectionCount) {
    const seen = new Set();
    const result = [];
    (Array.isArray(rawIndexes) ? rawIndexes : []).forEach((value) => {
        const index = normalizeSectionIndex(value, sectionCount);
        if (index === null || seen.has(index)) {
            return;
        }
        seen.add(index);
        result.push(index);
    });
    return result.sort((a, b) => a - b);
}

export function normalizeTutorialProgress(rawProgress = {}, sectionCount) {
    const progress = rawProgress && typeof rawProgress === 'object' && !Array.isArray(rawProgress) ? rawProgress : {};
    return {
        version: PROGRESS_VERSION,
        storageKey: `${progress.storageKey || ''}`,
        doneSectionIndexes: normalizeDoneSectionIndexes(progress.doneSectionIndexes, sectionCount),
        bookmarkSectionIndex: normalizeSectionIndex(progress.bookmarkSectionIndex, sectionCount),
        updatedAt: typeof progress.updatedAt === 'string' ? progress.updatedAt : ''
    };
}

export function isSectionDone(progress = {}, sectionIndex) {
    return normalizeDoneSectionIndexes(progress.doneSectionIndexes).includes(sectionIndex);
}

export function setDoneSection(progress = {}, sectionIndex, value, sectionCount) {
    const index = normalizeSectionIndex(sectionIndex, sectionCount);
    const normalized = normalizeTutorialProgress(progress, sectionCount);
    if (index === null) {
        return normalized;
    }
    const set = new Set(normalized.doneSectionIndexes);
    if (value) {
        set.add(index);
    } else {
        set.delete(index);
    }
    return {
        ...normalized,
        doneSectionIndexes: [...set].sort((a, b) => a - b)
    };
}

export function toggleDoneSection(progress = {}, sectionIndex, sectionCount) {
    return setDoneSection(progress, sectionIndex, !isSectionDone(progress, sectionIndex), sectionCount);
}

export function toggleBookmarkSection(progress = {}, sectionIndex, sectionCount) {
    const index = normalizeSectionIndex(sectionIndex, sectionCount);
    const normalized = normalizeTutorialProgress(progress, sectionCount);
    if (index === null) {
        return normalized;
    }
    return {
        ...normalized,
        bookmarkSectionIndex: normalized.bookmarkSectionIndex === index ? null : index
    };
}

export function normalizeIncludeInLooping(sectionCount, rawIndexes) {
    const count = Number.parseInt(sectionCount, 10);
    if (!Number.isInteger(count) || count <= 0) {
        return [];
    }
    if (!Array.isArray(rawIndexes)) {
        return Array.from({ length: count }, (_, index) => index);
    }
    return normalizeDoneSectionIndexes(rawIndexes, count);
}

export function toggleIncludeInLooping(includeIndexes, sectionIndex, sectionCount) {
    const index = normalizeSectionIndex(sectionIndex, sectionCount);
    const current = new Set(normalizeIncludeInLooping(sectionCount, includeIndexes));
    if (index === null) {
        return [...current].sort((a, b) => a - b);
    }
    if (current.has(index)) {
        current.delete(index);
    } else {
        current.add(index);
    }
    return [...current].sort((a, b) => a - b);
}

export function toggleAllIncludeInLooping(includeIndexes, sectionCount) {
    const all = normalizeIncludeInLooping(sectionCount);
    const current = normalizeIncludeInLooping(sectionCount, includeIndexes);
    return current.length === all.length ? [] : all;
}

export function getEffectiveIncludeInLooping(includeIndexes, sectionCount) {
    const normalized = normalizeIncludeInLooping(sectionCount, includeIndexes);
    return normalized.length > 0 ? normalized : normalizeIncludeInLooping(sectionCount);
}

/** True when IncludeInLooping actually constrains Section looping: a non-empty set that is smaller than all Sections.
 *  Empty or null means all Sections are included, so it is not a subset. */
export function isLoopSubsetInEffect(includeIndexes, sectionCount) {
    const all = normalizeIncludeInLooping(sectionCount);
    const include = normalizeIncludeInLooping(sectionCount, includeIndexes);
    return include.length > 0 && include.length < all.length;
}

export function filterIncludedLoopSectionIndex(candidateIndex, options = {}) {
    if (!options.tutorialActive || options.beatLooping) {
        return candidateIndex;
    }
    const sectionCount = Number.parseInt(options.sectionCount, 10);
    const candidate = normalizeSectionIndex(candidateIndex, sectionCount);
    if (candidate === null || !Number.isInteger(sectionCount) || sectionCount <= 0) {
        return candidateIndex;
    }
    const include = getEffectiveIncludeInLooping(options.includeInLoopingSectionIndexes, sectionCount);
    if (include.includes(candidate)) {
        return candidate;
    }
    for (let offset = 1; offset <= sectionCount; offset += 1) {
        const next = (candidate + offset) % sectionCount;
        if (include.includes(next)) {
            return next;
        }
    }
    return candidate;
}

export function getLoopCaptionModel({ looping = false, random = false, includeInLoopingSectionIndexes = [], sectionCount = 0 } = {}) {
    if (!looping) {
        return 'LOOP';
    }
    const baseWord = random ? 'RANDOM' : 'LOOPING';
    if (!isLoopSubsetInEffect(includeInLoopingSectionIndexes, sectionCount)) {
        return `${baseWord}`;
    }
    const include = normalizeIncludeInLooping(sectionCount, includeInLoopingSectionIndexes);
    return `${baseWord} ${include[0] + 1}..${include[include.length - 1] + 1}`;
}

export function getProgressBadgeModel(entry = {}, progress = {}) {
    if (!isStrictTutorialLevel(entry.tutorial)) {
        return null;
    }
    const sectionCount = Number.parseInt(entry.SectionCount, 10);
    const normalized = normalizeTutorialProgress(progress, sectionCount);
    const doneCount = normalized.doneSectionIndexes.length;
    const highestDoneIndex = doneCount > 0 ? normalized.doneSectionIndexes[doneCount - 1] : null;
    const hasBookmark = normalized.bookmarkSectionIndex !== null;
    if (doneCount === 0 && !hasBookmark) {
        return null;
    }
    return {
        highestDoneSectionNumber: highestDoneIndex === null ? null : highestDoneIndex + 1,
        doneCount,
        sectionCount: Number.isInteger(sectionCount) && sectionCount >= 0 ? sectionCount : 0,
        bookmarkSectionNumber: hasBookmark ? normalized.bookmarkSectionIndex + 1 : null
    };
}

export function readTutorialProgressFromStorage(entry = {}, storage = globalThis.localStorage) {
    const key = getTutorialProgressStorageKey(entry);
    if (!key || !storage || typeof storage.getItem !== 'function') {
        return normalizeTutorialProgress({}, entry.SectionCount);
    }
    try {
        const raw = storage.getItem(key);
        return normalizeTutorialProgress(raw ? JSON.parse(raw) : {}, entry.SectionCount);
    } catch {
        return normalizeTutorialProgress({}, entry.SectionCount);
    }
}

export function writeTutorialProgressToStorage(entry = {}, progress = {}, storage = globalThis.localStorage) {
    const key = getTutorialProgressStorageKey(entry);
    if (!key || !storage || typeof storage.setItem !== 'function') {
        return normalizeTutorialProgress(progress, entry.SectionCount);
    }
    const normalized = {
        ...normalizeTutorialProgress(progress, entry.SectionCount),
        storageKey: getTutorialStorageKey(entry),
        updatedAt: new Date().toISOString()
    };
    storage.setItem(key, JSON.stringify(normalized));
    return normalized;
}
