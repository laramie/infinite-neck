// Sprint 155: the layout of the SYSTEM stylesheets in the Palette's Stylesheets table.  Data and pure helpers only
// (no DOM, no sheet objects), so Jest can import it and a developer can edit it in one place.
//
// How to add a system stylesheet
//   1. Put the sheet data in optionalSheets.js (or, for a shipping sheet, userColors.js) under its id.
//   2. Add the id to SYSTEM_LAYOUT below, at the place where it should take effect.
//
// Rules
//   - The list order IS the precedence order: the bottom of the list wins (it is applied last), exactly as the user's
//     own stylesheets do.  Folders are only a view: a folder is never a stylesheet, a Look, or a reserved name, and
//     it has no checkbox.  The sheets inside a folder are ordinary system sheets that happen to be shown together.
//   - `defaultOn`  : ticked when a Song opens.  The sheets that are `alwaysOn` or `defaultOn` are the "shipping set",
//                    which is what the Look named Default means.
//   - `alwaysOn`   : cannot be unticked (no checkbox).
//   - `exclusive`  : (folders) ticking one sheet unticks the others in that folder.  Unticking all is allowed.
//                    This only governs clicks; a stored recipe that names two such sheets ticks both.
//   - Keep every optional (not shipping) sheet BELOW every shipping sheet.  Then a recipe may be written as
//     "<optional sheets>+Default" without changing which sheet wins.  layoutProblems() checks this.
//   - User stylesheets are not in the layout: they are a flat, non-exclusive list below all of these.

export const DEFAULT_LOOK_NAME = 'Default';

export const SYSTEM_LAYOUT = [
    { sheet: 'All-Clear', alwaysOn: true },
    { folder: 'NoteFunctions', exclusive: true, sheets: [
        { id: 'CycleOfColors', defaultOn: true }
    ] },
    { sheet: 'Roles', defaultOn: true },
    { sheet: 'Fingerings', defaultOn: true },
    { sheet: 'Highlights', defaultOn: true },
    { folder: 'Moods', exclusive: true, sheets: [
        { id: 'MoodLight' },
        { id: 'MoodMinor' }
    ] },
    // Printing sheets are complete (they cover every role) and come last so they win over everything above.
    { folder: 'Printing', exclusive: true, sheets: [
        { id: 'Letterpress' },
        { id: 'Gradient' },
        { id: 'Halftone' }
    ] }
];

/** Flat list in precedence order: [{id, folder (name or null), alwaysOn, defaultOn}]. */
export function layoutSheets(layout = SYSTEM_LAYOUT) {
    const out = [];
    for (const entry of layout) {
        if (entry.sheet) {
            out.push({ id: entry.sheet, folder: null, alwaysOn: !!entry.alwaysOn, defaultOn: !!entry.defaultOn });
        } else {
            for (const s of entry.sheets) {
                out.push({ id: s.id, folder: entry.folder, alwaysOn: !!s.alwaysOn, defaultOn: !!s.defaultOn });
            }
        }
    }
    return out;
}

export function systemIds(layout = SYSTEM_LAYOUT) {
    return layoutSheets(layout).map((s) => s.id);
}

/** The shipping set: ids that are ticked when a Song opens (what the Look "Default" means), in precedence order. */
export function shippingIds(layout = SYSTEM_LAYOUT) {
    return layoutSheets(layout).filter((s) => s.alwaysOn || s.defaultOn).map((s) => s.id);
}

export function findLayoutSheet(id, layout = SYSTEM_LAYOUT) {
    return layoutSheets(layout).find((s) => s.id === id) ?? null;
}

export function folderEntry(name, layout = SYSTEM_LAYOUT) {
    return layout.find((e) => e.folder === name) ?? null;
}

/** Ids of the other sheets that must be unticked when `id` is ticked ([] unless `id` is in an exclusive folder). */
export function exclusiveSiblings(id, layout = SYSTEM_LAYOUT) {
    const sheet = findLayoutSheet(id, layout);
    if (!sheet || !sheet.folder) return [];
    const folder = folderEntry(sheet.folder, layout);
    return folder && folder.exclusive ? folder.sheets.map((s) => s.id).filter((other) => other !== id) : [];
}

/** Developer mistakes in a layout; [] when it is sound. Used by Jest (and handy in a console). */
export function layoutProblems(layout = SYSTEM_LAYOUT) {
    const problems = [];
    const sheets = layoutSheets(layout);
    const seen = new Set();
    for (const s of sheets) {
        const key = s.id.toLowerCase();
        if (seen.has(key)) problems.push(`duplicate id: ${s.id}`);
        seen.add(key);
        if (!/^[A-Za-z0-9-]+$/.test(s.id)) problems.push(`id has characters outside [A-Za-z0-9-]: ${s.id}`);
        if (s.id.toLowerCase() === DEFAULT_LOOK_NAME.toLowerCase()) problems.push(`"${DEFAULT_LOOK_NAME}" is the name of the Default Look`);
    }
    for (const entry of layout) {
        if (entry.folder && !(entry.sheets && entry.sheets.length)) problems.push(`folder ${entry.folder} is empty`);
    }
    const shipping = new Set(shippingIds(layout));
    const lastShipping = sheets.map((s) => shipping.has(s.id)).lastIndexOf(true);
    sheets.forEach((s, i) => {
        if (!shipping.has(s.id) && i < lastShipping) problems.push(`optional sheet ${s.id} is above a shipping sheet`);
    });
    return problems;
}
