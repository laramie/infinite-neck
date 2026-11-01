
## Confirmed understanding 

- **Tier-1 "default" Theme** = the existing live `getSong().userTheme` / `"USER"` entry in `#selThemes`, exactly as installed today via `installUserTheme()` and `resolveLoadedThemeId()` in infinite-neck.js. Nothing new needed here — it already *is* the default tier.
- **Frozen block, not a themeId reference.** Confirmed by re-reading the existing "Theme" button handler in themes.builder.js: `ThemeFunctions.controlsToTheme()` already produces exactly this frozen object (full key/value dump of current control values, with `id`/`caption` synthesized), and it's what gets stashed into `getSong().userTheme` today. Per-table storage will call the same `controlsToTheme()` and stash the resulting object, not a name/id lookup.
- **Storage location**: `section.sectionNotesByTable[tableID].theme = <frozen theme object>`, written via `Section.ensureSectionNotes(tableID)`/`getSectionNotes(tableID)` — the existing lazy-create seam in Section.js, so no new "does this table have an entry yet" plumbing is needed.
- **Save/Clear semantics** mirror `displayOptions` exactly, confirmed against the real handlers in infinite-neck.js: `handleBtnControlsToDisplayOptions()` does `getCurrentSection().displayOptions = controlsToDisplayOptions()`; `handleBtnDeleteDisplayOptions()` does `delete getCurrentSection().displayOptions`. The table-theme equivalents will do the same, scoped to `getCurrentSection().getSectionNotes(tableID).theme`, and only ever touch the *current* section (never search-and-clear across sections) — matching infinite-neck.js's `showHideDisplayOptionsPresent()`, which enables/disables the Clear button based on the *current* section's own stored value only, not the walked-back effective value.
- **System Highlights ride along as inert data** — no schema/shape carve-out, just documented as "present but ignored when resolving per-table."
- **"Allow Theme Automation" stays untouched** — confirmed no code changes needed; it continues to only automate the tier-1/default theme via `sectionTheme`, independent of the new per-table mechanism.

## Two things I found that need a decision/fix before coding

1. **Schema blocker (new finding, more serious than the tuningSchema case):** song-file-schema.js's `sectionNotesSchema` has `additionalProperties: false` (unlike the permissive `tuningSchema`). Writing `.theme` onto a `SectionNotes` object will **fail schema validation** unless we explicitly add a `theme` property to this schema. Proposed: `theme: { type: 'object' }` (loose, unenumerated — consistent with "no-legacy, don't over-specify" style already used elsewhere). This is a required code change, not a no-op.

2. **Silent data-loss risk (new finding):** Section.js's `removeEmptyTables()` — invoked by `Song.removeUnusedTablesFromMemoryModel()` — deletes a table's entire `sectionNotesByTable[tableID]` entry whenever it has no `playedNotes`/`namedNotes`/`recordedNotes`, without checking for a stored `.theme`. An instrument with a saved per-table Theme but no notes yet in that section would have its Theme **silently deleted** on the next cleanup pass. Needs a one-line fix: include `|| !!sn.theme` in the `hasNotes` check (and the same check exists conceptually in `isEmpty()` at Section.js, though that one only affects a different code path — worth auditing both). Flagging this now since it's exactly the kind of bug that would only surface much later, silently.

## Implementation plan

### Phase 1 — Var-driven migration (11 hard blocks), scoped to instrument/table
No change from before, still first since it de-risks everything downstream:
- Convert all 11 hard rule blocks in `theme()`'s `styleBody` (themeFunctions.js) into `var(--x, <fallback>)` rules in infinite-neck.css, deleting the hard blocks and keeping/adding the `:root` `rule()` entries, exactly as demonstrated for `--cell-spacing`.
- No behavior change yet (still resolves via the single global `:root`); this only proves the CSS is scoping-ready.

### Phase 2 — Schema + model plumbing
- **Schema fix**: add `theme: { type: 'object' }` to `sectionNotesSchema` in song-file-schema.js.
- **Pruning fix**: update `Section.removeEmptyTables()`'s `hasNotes` computation (Section.js) to also treat `sn.theme` as "keep this entry." Audit `isEmpty()` (Section.js) for the same concern (it's used differently — for "does this Section have any content" — decide whether a theme-only table should count as non-empty there too; likely yes, for consistency).
- **Song.js additions** (mirroring `getStoredDisplayOptionsInEffect`/`getDisplayOptionsInEffect` at Song.js almost verbatim, just walking `section.sectionNotesByTable?.[tableID]?.theme` instead of `section.displayOptions`):
  - `getStoredTableThemeInEffect(currSection, tableID)` — walk-back loop, returns the first non-null `.theme` found at or before `currSection`, else `null`.
  - `getTableThemeInEffect(currSection, tableID, defaultTheme)` — `getStoredTableThemeInEffect(...) ?? defaultTheme` (defaultTheme = tier-1/USER-or-Default, resolved the same way `resolveLoadedThemeId()` already does).
- **infinite-neck.js additions** (mirroring `handleBtnControlsToDisplayOptions`/`handleBtnDeleteDisplayOptions` at infinite-neck.js exactly):
  - `handleBtnControlsToTableTheme(tableID)`: `getCurrentSection().getSectionNotes(tableID).theme = ThemeFunctions.controlsToTheme();`
  - `handleBtnDeleteTableTheme(tableID)`: `delete getCurrentSection().sectionNotesByTable?.[tableID]?.theme;` (only if entry exists — don't create one just to delete from it).

### Phase 3 — Theme page UI: Instrument/Table picker
- Add a `<select>` to themes.html, populated like the existing Wiring `selTablename` dropdown (`song.getAllModelTableIDs()`), with a leading `"default"` option — satisfies decision #6.
- On picker change: if `"default"`, behave exactly as today (no-op, existing `#selThemes` flow untouched). If a table is picked, resolve `getTableThemeInEffect(currentSection, tableID, ...)` and feed it into the *existing* dropdowns via `themeToControls()` — same controls, just re-targeted, per decision #6.
- Repurpose/extend the existing `#btnTheme` click handler (themes.builder.js): if picker is `"default"`, keep today's exact behavior (`getSong().userTheme = ...`); if an instrument is picked, call the new `handleBtnControlsToTableTheme(tableID)` instead.
- Add a "Clear" button next to it for the picked table, wired to `handleBtnDeleteTableTheme(tableID)`, enabled/disabled based on whether *the current section itself* (not the walked-back value) has `sectionNotesByTable[tableID]?.theme` set — mirroring `showHideDisplayOptionsPresent()`'s exact disabled-state logic. Per your point 4, this is intentionally a simple first cut; refining "elegant delete" UX is deferred.

### Phase 4 — `/vdf` visibility
- No dedicated work: once Phase 2's schema change lands and `.theme` is being written to `SectionNotes` objects, `/vdf`'s existing `getPersistentSongFile()` → `JSON.stringify(this, SongPersistence.persistentSongFileReplacer, 2)` dump (Song.js) picks it up automatically, same as every other Section-scoped field. Just needs a quick confirmation that `SongPersistence.persistentSongFileReplacer` doesn't have an explicit allow-list excluding unknown `SectionNotes` keys (worth a 2-minute check when coding).

### Phase 5 — Deferred (next round, per your explicit note)
- `TableBuilder.buildNoteTable()` resolving `getTableThemeInEffect(currentSection, tableID, ...)` per table and applying its vars directly onto that table's element (`tableEl.style.setProperty(...)`), so two instruments visually diverge on the same page simultaneously. Mechanically straightforward given Phase 1 (vars already exist) + Phase 2 (resolution logic already exists) — this phase is "just" wiring the two together at render time, plus deciding *when* to re-apply (section change, table theme save/clear, table build time).
- Round-1 verification instead happens via: `/vdf` showing the correct persisted shape, and the Theme page's picker/Save/Clear round-tripping correctly through Jest-testable model methods (`getStoredTableThemeInEffect`, `handleBtnControlsToTableTheme`, `handleBtnDeleteTableTheme`) — no DOM/visual rendering required for round 1's tests, consistent with your Jest-avoids-browser-behavior preference.