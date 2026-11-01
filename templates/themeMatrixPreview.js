/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 149 Iteration 1: the Theme Matrix "Preview" model.  Pure module (no DOM, no jQuery).
//
// The Theme Matrix normally shows only what each Section STORES.  The Preview shows what each Section
// would actually APPLY, so the cascade can be read straight off the table.  Nothing here has its own copy
// of the cascade rules: every value is asked of the Song, so a rule change in Song.js or in the
// DisplayOptions resolver shows up in the Preview with no edit here.
//
//   Theme automation ("default" column) -> song.resolveDisplayOptionsAt(idx, { purpose: 'apply' })
//                                          (the same resolve navigation uses: cascade, Song-DEFAULTS, gates, adapter)
//   Table Themes (Instrument columns)   -> song.getStoredTableThemeInEffect(section, tableID)
//                                          (the same walk-back the live tables use)
//
// A cell is { text, kind, title? }.  kind:
//   'stored'    the Section itself stores and applies this value (drawn normally, not as a Preview)
//   'inherited' not stored here; carried from an earlier Section or from Song-DEFAULTS
//   'song'      an Instrument with no Table Theme at or before this Section: it shows the Song Theme
//   'held'      Theme automation applies nothing here (no value, or read-blocked): the Themes dropdown keeps what it holds
//   'dormant'   stored, but Allow Theme Automation is off, so it is not applied
//   'ignored'   stored here, but read-blocked, so it is not applied (the value that is applied is in the title)
//   'none'      nothing to show

export const SONG_THEME_LABEL = 'default';

/** "default[PICKER]" -- the Instrument shows the Song Theme, which is one fixed Theme: the one the Themes dropdown
 *  (#selThemes) holds.  The square brackets are literal.  With no picker value, just "default". */
export function songThemeLabel(pickerThemeId) {
    return pickerThemeId ? `${SONG_THEME_LABEL}[${pickerThemeId}]` : SONG_THEME_LABEL;
}

/** "default:Current" -- the Instrument shows the Song Theme, and Theme automation has made it `current` here
 *  (or HELD_LABEL when automation applies nothing at this Section). */
export function songThemeVariesLabel(current) {
    return `${SONG_THEME_LABEL}:${current}`;
}
export const HELD_LABEL = '(kept)';

const KEY = 'sectionTheme';

function sectionNumber(index) {
    return `Section ${index + 1}`;
}

/** Which Section's own Table Theme block is this?  Table Themes are stored per Section, so the theme the Song
 *  returns is the very object a Section holds. */
function tableThemeSourceIndex(song, tableID, theme) {
    for (let i = (song.sections?.length ?? 0) - 1; i >= 0; i--) {
        if (song.sections[i]?.sectionNotesByTable?.[tableID]?.theme === theme) {
            return i;
        }
    }
    return -1;
}

function describeSource(entry) {
    if (entry?.source === 'songDefault') {
        return 'from Song-DEFAULTS';
    }
    if (entry?.source === 'stored' && Number.isInteger(entry.sectionIndex)) {
        return `from ${sectionNumber(entry.sectionIndex)}`;
    }
    return '';
}

/** The "default" column cell for one Section: Theme automation (the sectionTheme Display Option). */
function buildAutomationCell(song, index, knownThemeIds) {
    const stored = `${song.sections[index]?.displayOptions?.[KEY] ?? ''}`;

    if (!song.allowThemeAutomation) {
        return stored
            ? { text: stored, kind: 'dormant', title: 'Stored, but not applied: Allow Theme Automation is off.', value: null }
            : { text: '', kind: 'none', value: null };
    }

    const { values, entries } = song.resolveDisplayOptionsAt(index, { purpose: 'apply' });
    const value = values?.[KEY];
    const entry = entries?.[KEY];
    const known = (id) => !knownThemeIds || knownThemeIds.has(id);
    const unknownNote = (id) => (known(id) ? '' : ` "${id}" is not in the Themes dropdown.`);
    const text = (id) => (known(id) ? `${id}` : `${id}?`);

    if (value !== undefined && value !== null && value !== '') {
        const ownAndApplied = entry?.source === 'stored' && entry.sectionIndex === index;
        if (ownAndApplied) {
            return { text: text(value), kind: 'stored', title: unknownNote(value).trim() || undefined, value: `${value}` };
        }
        const where = describeSource(entry);
        if (stored) {
            return {
                text: stored, kind: 'ignored', value: `${value}`,
                title: `Stored here but read-blocked, so ignored.  Applies: ${value} (${where}).${unknownNote(value)}`
            };
        }
        return {
            text: text(value), kind: 'inherited', value: `${value}`,
            title: `Applied ${where}.${unknownNote(value)}`
        };
    }

    // Nothing is applied here.
    const blocked = entry?.source === 'blocked';
    const reason = blocked
        ? 'Read-blocked here: the Themes dropdown keeps what it holds.'
        : 'No Section at or before this one stores a Theme (and Song-DEFAULTS has none): the Themes dropdown keeps what it holds.';
    if (stored) {
        return { text: stored, kind: 'ignored', value: null, title: `Stored here but read-blocked, so ignored.  ${reason}` };
    }
    return { text: HELD_LABEL, kind: 'held', value: null, title: reason };
}

/**
 * @param {object} song     a Song (needs sections, allowThemeAutomation, resolveDisplayOptionsAt, getStoredTableThemeInEffect)
 * @param {string[]} tableIDs  the Instrument columns, in display order
 * @param {{knownThemeIds?: Set<string>|null, pickerThemeId?: string|null}} [options]
 *   knownThemeIds: ids in the Themes dropdown; a sectionTheme outside it is shown with "?"
 *   pickerThemeId: the value of the Themes dropdown (#selThemes), shown as "default[PICKER]"
 * @returns {{automationOn:boolean, songThemeVaries:boolean, songThemeIds:string[],
 *            rows:Array<{sectionIndex:number, defaultCell:object, tableCells:Object<string,object>}>}}
 *   songThemeVaries: the Song Theme (what an Instrument with no Table Theme shows) is not one fixed Theme -- Theme
 *   automation applies more than one, or applies one only in some Sections -- so the plain label "default" would
 *   hide more than one Theme and is shown as "default:Current" (Current = the Theme automation applies at that Section).
 *   When it does not vary, the label is "default[PICKER]".
 */
export function buildThemeMatrixPreview(song, tableIDs, { knownThemeIds = null, pickerThemeId = null } = {}) {
    const sections = song?.sections ?? [];
    const automationOn = !!song?.allowThemeAutomation;

    const defaultCells = sections.map((_, index) => buildAutomationCell(song, index, knownThemeIds));

    // Does "default" stand for more than one Theme?  Only automation can make it so (with it off, the Song Theme is the
    // dropdown's one value).  Distinct applied ids, or some Sections applying one and some holding, both count.
    const appliedIds = defaultCells.map((cell) => cell.value).filter((id) => id !== null && id !== undefined);
    const distinct = [...new Set(appliedIds)];
    const songThemeVaries = automationOn
        && distinct.length > 0
        && (distinct.length > 1 || appliedIds.length < sections.length);

    const rows = sections.map((section, index) => {
        const tableCells = {};
        for (const tableID of tableIDs) {
            tableCells[tableID] = buildTableCell(song, section, index, tableID, defaultCells[index], songThemeVaries, knownThemeIds, pickerThemeId);
        }
        return { sectionIndex: index, defaultCell: defaultCells[index], tableCells };
    });

    return { automationOn, songThemeVaries, songThemeIds: distinct, rows };
}

function buildTableCell(song, section, index, tableID, defaultCell, songThemeVaries, knownThemeIds, pickerThemeId) {
    const own = section?.sectionNotesByTable?.[tableID]?.theme;
    if (own) {
        return { text: own.caption || '', kind: 'stored' };
    }
    const inEffect = song.getStoredTableThemeInEffect(section, tableID);
    if (inEffect) {
        const from = tableThemeSourceIndex(song, tableID, inEffect);
        return {
            text: inEffect.caption || '',
            kind: 'inherited',
            title: from >= 0 ? `Table Theme carried from ${sectionNumber(from)}.` : 'Table Theme carried from an earlier Section.'
        };
    }
    let title;
    if (!song.allowThemeAutomation) {
        title = 'No Table Theme: shows the Song Theme (the Themes dropdown).';
    } else if (defaultCell.value) {
        title = `No Table Theme: shows the Song Theme, which Theme automation sets to ${defaultCell.value} here.`;
    } else {
        title = 'No Table Theme: shows the Song Theme, which Theme automation leaves as the Themes dropdown holds it.';
    }
    let text = songThemeLabel(pickerThemeId);
    if (songThemeVaries) {
        const applied = defaultCell.value;
        const current = applied ? (!knownThemeIds || knownThemeIds.has(applied) ? applied : `${applied}?`) : HELD_LABEL;
        text = songThemeVariesLabel(current);
    }
    return {
        text,
        kind: 'song',
        title: songThemeVaries ? `${title}  (The Song Theme changes from Section to Section.)` : title
    };
}
