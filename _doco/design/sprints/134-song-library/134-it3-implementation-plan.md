# Sprint 134 Song Library — Iteration 3 Implementation Plan

## Approved revision summary

This plan has been revised from the first Iteration 3 plan and is now approved for implementation.

Key decisions:

- `instruments` in `songs/song-list.json` is generated-only. Developers should not hand-edit it.
- `songs/song-list.json` is expected to contain object entries with `href` and `description`; legacy string entries should be skipped and warned about by the updater rather than converted.
- Display order is exactly the order of `songs[]` in `songs/song-list.json`.
- `visibleNoteTables` has been removed from repository song data and code. The updater and UI must use `noteTablesLayout` only.
- Badge labels use exact `fromBaseID`. Missing `fromBaseID` in canonical library songs is treated as a warning and skipped rather than falling back to `baseID` for display.
- `Observer` means a wiring exists for the table and `relativeSection` is non-empty.
- Duplicate `fromBaseID` badges are rendered separately because duplicate roles/relative-section observers are meaningful.
- The CSS badge rules are the explicit static rules in `song-library.css`; do not introduce CSS custom properties for these static colors.
- `noteTablesLayout` is the visibility source of truth. If `myTunings[].visible` conflicts with `noteTablesLayout`, use `noteTablesLayout` and warn.
- Updater errors should be collected across all entries and reported together.
- Performance acceptance target: hidden tables should produce zero replay/prewarm tasks.

## Scope

Iteration 3 has four implementation tracks:

1. Generate `songs[].instruments` in `songs/song-list.json` from the referenced song files.
2. Render `instruments` in the Song Library as a third column of badges.
3. Keep/update the approved static CSS badge styles and add a three-column responsive layout.
4. Add tests that prove generated metadata, display rendering, and hidden-table replay/prewarm selection behave as intended.

## Current code observations

### Song Library

- `SongLibrary.js` currently builds a root/directory model from `songs[]`, `href`, `description`, and `directoryIntros`.
- Link text is filename-only per Iteration 2.
- Intro rows already span all columns with `grid-column: 1 / -1`.
- `song-library.css` already contains the approved badge role classes and needs the row grid adjusted for the third column.

### Visibility model

- `Song.noteTablesLayout[]` is the only persisted visibility/layout model.
- `Song.getVisibleTunings()` returns visible table IDs from `noteTablesLayout`.
- `visibleNoteTables` is no longer supported by the application code.

### Role model

For each tuning table ID:

- Main: no wiring entry whose `tablename` is the table ID.
- Listener: wiring exists, `listenToTablename` is set, and `relativeSection` is empty.
- Observer: wiring exists and `relativeSection` is non-empty.

## Generated `instruments` data contract

Each song-list entry may include:

```json
"instruments": [
  { "fromBaseID": "P46", "wiring": "Listener", "visible": true },
  { "fromBaseID": "S6", "wiring": "Observer", "visible": false },
  { "fromBaseID": "S6", "wiring": "Main", "visible": true }
]
```

Generation rules:

1. Read only song files listed in `songs/song-list.json`.
2. Do not walk `songs/` to discover extra songs.
3. Do not modify song files.
4. Preserve `songs[]` order and preserve all hand-authored song-list fields.
5. Replace only the generated `instruments` field on valid object entries.
6. Skip legacy string entries and warn.
7. Skip malformed object entries and warn.
8. For each song, inspect `myTunings[]` in order.
9. Require non-empty `fromBaseID` for badge display; skip and warn if missing.
10. Compute `tableID` as `Constants.TABLE_ID_PREFIX + tuning.baseID`.
11. Use `noteTablesLayout` to determine `visible`.
12. If `noteTablesLayout` has no entry for a tuning, warn and fall back to `tuning.visible !== false` for that generated item.
13. If `tuning.visible` is present and conflicts with `noteTablesLayout`, use `noteTablesLayout` and warn.
14. Classify `wiring` as `Main`, `Listener`, or `Observer` from `wirings[]`.

## Implementation track A — `bin/update-song-list.js`

Add an ES module CLI utility with exported pure helpers for Jest tests.

CLI behavior:

- Default target: `songs/song-list.json`.
- `--song-list <path>`: update a specific list.
- `--check`: report whether the file is up to date without writing.
- `--quiet`: suppress per-song success output.
- `--help`: print usage.

Helper functions:

- `normalizeSongListHref(entry)`
- `tableIDForBaseID(baseID)`
- `buildVisibilityMap(songJson)`
- `classifyWiring(tableID, wirings)`
- `extractInstrumentSummaries(songJson)`
- `updateSongListData(songListJson, options)`

Reporting policy:

- Keep processing all entries after an error.
- Report warnings and errors together at the end.
- Exit non-zero on errors or pending `--check` changes.
- Warnings are printed but do not make a successful update fail.
- Do not write when there are errors that prevent complete regeneration.

Package scripts:

```json
"update:song-list": "node bin/update-song-list.js",
"check:song-list": "node bin/update-song-list.js --check"
```

## Implementation track B — Song Library rendering

Update `SongLibrary.js` to preserve and render `instruments`.

Model changes:

- Preserve `instruments` arrays from object entries.
- Normalize each item to `{ fromBaseID, wiring, visible }`.
- Skip invalid instrument entries without throwing.
- Keep duplicate `fromBaseID` values.

Rendering changes:

- Add a third cell to every song row: `songLibraryCellInstruments`.
- Render one `span.songLibraryInstrument` per instrument.
- Add exactly one role class: `instrumentMain`, `instrumentListener`, or `instrumentObserver`.
- Add `instrumentNotVisible` when `visible === false`.
- Escape `fromBaseID` label text.
- Keep the third cell even when there are no instruments.

## Implementation track C — CSS

Keep the approved explicit static badge CSS in `song-library.css`. Do not replace role colors with CSS custom properties.

Add the three-column row layout:

```css
.songLibraryRow {
    display: grid;
    grid-template-columns: minmax(16em, 32%) minmax(18em, 1fr) minmax(10em, 24%);
    gap: 0.6em;
    padding: 0.25em 0.4em;
}
```

Add a narrow-width fallback:

```css
@media (max-width: 900px) {
    .songLibraryRow {
        grid-template-columns: 1fr;
    }
}
```

## Implementation track D — performance acceptance

Existing code already scopes several hot paths to visible tables:

- `NoteTableController.getReplayOptionsArray()` iterates `getSong().getVisibleTunings()`.
- Note-table render-cache prewarm uses `song.getVisibleTunings()`.
- Cache size is based on visible table count.

Add or keep tests that prove hidden tables produce zero replay/prewarm tasks. Defer deeper optimization until a test or timing trace shows hidden tables still doing DOM/render/cache work.

## Validation plan

Targeted checks:

- `node bin/update-song-list.js --check`
- `node bin/update-song-list.js --song-list songs/song-list.json`
- `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/song-library-model.test.js _tests/jest/update-song-list.test.js _tests/jest/song-load-library.test.js _tests/jest/note-table-render-cache.test.js --verbose --runInBand`

Pre-checkin check:

- `export INFINITE_NECK_VERBOSE=-1`
- `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`
