# Sprint 134 Song Library — Iteration 3 Implementation Plan

## Scope

Iteration 1 and 2 already moved the visible library UI into `SongLibrary.js` and `song-library.css`, with the library driven by `songs/song-list.json`. Iteration 3 adds two related but separable tracks:

1. Generate an `instruments` summary for each listed song, without modifying the song files.
2. Render those instrument summaries in the Song Library as a third column with role/visibility styling.
3. Audit and improve runtime paths so hidden instruments stay authorable, but do not add loop/render cost.

The generation/display work is straightforward. The hidden-instrument performance work should be handled as a measured optimization sprint because there are several existing code paths with slightly different meanings for “visible”.

## Current Code Observations

### Song Library

- `SongLibrary.js` currently normalizes song-list entries from either legacy string entries or object entries with `href` and `description`.
- `renderSongLibraryHtml()` currently outputs two columns:
	- link cell
	- description cell
- Link text is currently filename-only, per Iteration 2.
- Intro rows span all columns via `grid-column: 1 / -1`, so adding a third column should not require special intro-row handling.
- `song-library.css` currently uses a two-column CSS grid and alternating row colors.

### Song visibility model

- Persisted visibility now appears to be `song.noteTablesLayout[]`, with entries shaped as `{ tableID, visible }`.
- `Song.getVisibleTunings()` returns visible table IDs from `noteTablesLayout`.
- Legacy `visibleNoteTables` is normalized into `noteTablesLayout` during `SongPersistence` construction.
- `myTunings[].visible` still exists in saved tuning objects, but current runtime visibility decisions should prefer `noteTablesLayout`.

### Role model

Current wiring conventions map well to Iteration 3:

- Main: no wiring entry whose `tablename` is the table ID.
- Listener: wiring exists, `listenToTablename` is set, and `relativeSection` is empty.
- Observer: wiring exists and `relativeSection` is non-empty.

This matches comments in `NoteTableController.js`, `WiringBuilder.js`, `ClipPlugin.js`, and `ArpeggioPlugin.js`.

### Existing performance status

Some invisible-instrument optimization already exists:

- `TableBuilder.buildNoteTable()` returns `null` when passed `visible: false`.
- `NoteTableController.getReplayOptionsArray()` iterates `getSong().getVisibleTunings()`, so replay is already scoped to visible tables.
- Note-table render-cache prewarm uses `song.getVisibleTunings()` and sets cache size proportional to visible table count.

The biggest remaining risk is not obvious from the design alone: hidden instruments may still be touched indirectly through plugin maintenance, section data updates, or code paths that scan all `myTunings`, all `wirings`, or all `sectionNotesByTable` entries.

## Proposed `instruments` Data Contract

Each object entry in `songs/song-list.json` may include:

```json
"instruments": [
	{ "fromBaseID": "P46", "wiring": "Listener", "visible": true },
	{ "fromBaseID": "S6", "wiring": "Observer", "visible": false },
	{ "fromBaseID": "S6", "wiring": "Main", "visible": true }
]
```

### Generation rules

For each song-list entry with a valid `href`:

1. Read only the song file referenced by `href`, relative to the directory containing the song-list file.
2. Do not discover extra songs by walking `songs/`.
3. Do not modify the song file.
4. Compute one instrument summary for each `myTunings[]` entry with a non-empty `baseID`.
5. Use `fromBaseID` when present; otherwise use `baseID`.
6. Compute `tableID` as `tbl` + `baseID`, using the existing `Constants.TABLE_ID_PREFIX`.
7. Compute `visible` from `noteTablesLayout` first:
	 - if `noteTablesLayout` contains `tableID`, `visible = entry.visible !== false`
	 - else if legacy `visibleNoteTables` exists, `visible = visibleNoteTables.includes(tableID)`
	 - else use `tuning.visible !== false`
8. Compute `wiring` from `wirings[]`:
	 - `Observer` when matching wiring has non-empty `relativeSection`
	 - `Listener` when matching wiring has non-empty `listenToTablename` and empty `relativeSection`
	 - `Main` otherwise
9. Preserve the song-list entry order and all hand-authored fields such as `href`, `description`, and future fields.
10. Replace only the generated `instruments` value for each listed song entry.

### Ordering recommendation

Use the order of `myTunings[]`, not alphabetical order. That preserves author intent and roughly mirrors the MyTunings/library table order.

### String entries in song-list files

The utility has to add `instruments`, so a legacy string entry cannot remain a string if updated. Recommended behavior:

- Convert a string entry such as `"demo/foo.json"` to `{ "href": "demo/foo.json", "instruments": [...] }`.
- Leave invalid entries untouched but report them.

This keeps old-format reading support while allowing generated metadata in the primary curated list.

## Implementation Track A — `bin/update-song-list.js`

Add `bin/update-song-list.js` as an ES module command-line utility.

### CLI behavior

Initial useful options:

- default target: `songs/song-list.json`
- `--song-list <path>` to update another list
- `--check` to compute and compare without writing; exit non-zero when updates are needed
- `--quiet` to suppress per-song output
- `--help` for usage

Optional later options, if useful:

- `--write-empty-instruments` to write `[]` when a song cannot be read; otherwise keep old value and report error
- `--sort-keys` should not be added now, because preserving hand-authored JSON shape is more important.

### File writing strategy

Use `JSON.parse()` / `JSON.stringify(data, null, 2)` for the first iteration. This will reformat the list file, but not the individual song files. That is acceptable for a generated metadata update, and it is consistent with existing repo scripts.

If preserving custom spacing in `songs/song-list.json` becomes important later, switch to a targeted JSON patcher. Do not start there.

### Suggested helper functions

Implement and unit-test pure helpers where possible:

- `normalizeSongListHref(entry)`
- `tableIDForBaseID(baseID)`
- `buildVisibilityMap(songJson)`
- `classifyWiring(tableID, wirings)`
- `extractInstrumentSummaries(songJson)`
- `updateSongListData(songListJson, songListPath)`

The CLI wrapper should be thin and should call these helpers.

### Package script

Add a package script such as:

```json
"update:song-list": "node bin/update-song-list.js"
```

Optional check script:

```json
"check:song-list": "node bin/update-song-list.js --check"
```

## Implementation Track B — Song Library rendering

Update `SongLibrary.js` to preserve and render `instruments`.

### Model changes

- Extend `parseSongEntry()` so object entries return `instruments` when it is an array.
- Extend `normalizeSongListEntries()` to include `instruments` in each normalized song object.
- Add a normalizer for each instrument summary:
	- `fromBaseID`: string, fallback `baseID`, fallback empty/skip
	- `wiring`: one of `Main`, `Listener`, `Observer`; fallback `Main`
	- `visible`: `instrument.visible !== false`
- Do not mutate incoming song-list objects.

### Rendering changes

For each song row, render a third cell:

```html
<div class='songLibraryCell songLibraryCellInstruments'>
	<span class='songLibraryInstrument instrumentMain'>P46</span>
	<span class='songLibraryInstrument instrumentListener instrumentNotVisible'>Piano</span>
</div>
```

Recommended class construction:

- Always include `songLibraryInstrument`.
- Include one role class: `instrumentMain`, `instrumentListener`, or `instrumentObserver`.
- Include `instrumentNotVisible` when `visible === false`.
- Escape instrument labels and classes generated from values.
- Do not render the third cell conditionally; an empty third cell keeps the grid stable.

### Tests

Update `_tests/jest/song-library-model.test.js` to verify:

- `normalizeSongListEntries()` preserves `instruments`.
- rendering emits `songLibraryCellInstruments`.
- rendering emits all three role classes.
- invisible entries include `instrumentNotVisible`.
- missing/empty instruments produce an empty third cell without throwing.
- intro rows still span all columns.

## Implementation Track C — CSS

Update `song-library.css` for three columns and badges.

### Grid layout

Change the row grid to something like:

```css
.songLibraryRow {
		display: grid;
		grid-template-columns: minmax(16em, 32%) minmax(18em, 1fr) minmax(10em, 24%);
		gap: 0.6em;
		padding: 0.25em 0.4em;
}
```

The exact widths can be tuned by UI acceptance testing. The important point is that the instrument column should not steal too much description space.

### Idiomatic badge CSS

The proposed CSS works, but it will be more maintainable if common badge properties live in one class and role classes only set design tokens.

Recommended structure:

```css
.songLibraryInstrument {
		display: inline-block;
		margin: 0.1em 0.2em 0.1em 0;
		padding: 0.1em 0.35em;
		border-radius: 0.35em;
		border: 2px solid var(--song-library-instrument-border);
		background-color: var(--song-library-instrument-bg);
		color: var(--song-library-instrument-fg);
		font-family: "Kode Mono", "Courier New", monospace;
		font-size: 85%;
		font-weight: 700;
		white-space: nowrap;
}

.instrumentMain {
		--song-library-instrument-bg: white;
		--song-library-instrument-fg: brown;
		--song-library-instrument-border: brown;
}

.instrumentListener {
		--song-library-instrument-bg: #ffe57b;
		--song-library-instrument-fg: #0a0;
		--song-library-instrument-border: #0a0;
}

.instrumentObserver {
		--song-library-instrument-bg: rgb(213, 255, 213);
		--song-library-instrument-fg: #00a;
		--song-library-instrument-border: #00a;
}

.songLibraryInstrument.instrumentNotVisible {
		opacity: 0.72;
		border-width: 1px;
}
```

If the darker hidden backgrounds in the design are important, use role-specific variables on `.instrumentMain.instrumentNotVisible`, etc. The variable-based approach still avoids duplicating all badge properties.

### Responsive behavior

Add a narrow-width fallback so descriptions remain readable on small windows:

```css
@media (max-width: 900px) {
		.songLibraryRow {
				grid-template-columns: 1fr;
		}
}
```

This keeps the Song Library usable in narrow side-by-side development windows.

## Implementation Track D — Performance audit and optimization

### What already appears safe

The design goal “hidden instruments should not slow replay/looping” is partially satisfied already:

- `replay()` only builds replay options for `getVisibleTunings()`.
- section-change prewarming only considers `getVisibleTunings()`.
- cache max entries are scaled to visible tuning count.
- hidden note tables are not built by `TableBuilder.buildNoteTable()` when visibility is passed correctly.

### Audit targets

Before changing performance code, add instrumentation or tests around these paths:

1. `NoteTableController.getReplayOptionsArray()`
	 - Verify hidden main/listener/observer tables never produce replay options.
2. `NoteTableController.replayTable()`
	 - Verify no DOM selectors are executed for hidden table IDs during replay.
3. `NoteTableRenderCache` prewarm in `infinite-neck.js`
	 - Verify hidden tables are not prewarmed.
4. `showHighlightsForBeat()` and listener highlight propagation
	 - Verify beat looping does not propagate into hidden listeners/observers.
5. `sectionChanged()` and `clearAndReplaySection()`
	 - Verify section status/widget updates are limited to visible table widgets where possible.
6. Plugin events fired on section navigation or beat looping
	 - Verify plugins can update model state for hidden instruments when required, without doing hidden DOM rendering.

### Optimization rules

Use one distinction consistently:

- Model/update work is allowed for hidden instruments when it keeps authored song state correct.
- DOM/render/highlight/cache/prewarm work should skip hidden instruments.

This distinction matches the design requirement that TransposePlugin and positions for Fill/Arpeggio should still stay correct for hidden instruments, while tick/section-loop performance should not pay for rendering them.

### Candidate helper

Add a helper on `Song` only if the audit shows repeated ad-hoc checks:

- `isTableVisible(tableID)` already exists.
- A small `getVisibleTableIDSet()` helper may be useful to avoid repeatedly constructing `Set` objects in hot paths.

Avoid adding legacy compatibility branches beyond the existing `SongPersistence` normalization.

### Performance tests

Add focused Jest tests rather than broad browser/JSDOM tests:

- `getReplayOptionsArray()` with hidden Main, Listener, and Observer tables.
- prewarm task selection with visible vs hidden tables.
- helper tests for `extractInstrumentSummaries()` using raw song JSON.
- if feasible, a looper/tick test that spies on replay or section-change hooks and proves hidden table IDs are absent from replay/prewarm inputs.

Browser acceptance testing should still validate actual UI performance and visuals.

## Open Questions / Design Holes

1. **Generated field ownership:** Should developers ever hand-edit `instruments`, or should `bin/update-song-list.js` be treated as the sole owner? Recommendation: generated-only; hand edits will be overwritten.

2. **String song-list entries:** Is converting legacy strings to objects acceptable in the primary curated list when running the updater? Recommendation: yes, because adding `instruments` requires object entries.

3. **Observer label source:** The proposed role mapping assumes `relativeSection` means Observer. This matches current code comments, but the plan should be confirmed before implementation.

4. **Duplicate `fromBaseID` display:** Songs may intentionally have two S6-derived instruments, such as an S6 Main and an S6 Observer. Recommendation: render duplicate badges separately because role/visibility may differ.

5. **`Piano` vs `PianoSkeuomorphic`:** The design examples show `Piano`, but current sample songs may have `fromBaseID: "PianoSkeuomorphic"`. Recommendation: use exact `fromBaseID` for generation now. Add a later display-label map only if users dislike the raw base IDs.

6. **Visibility source of truth:** Runtime currently prefers `noteTablesLayout`; generation should also prefer it. If a song has conflicting `myTunings[].visible`, `noteTablesLayout` should win.

7. **Updater error policy:** If a listed song is missing or invalid JSON, should the updater fail the whole run or keep going? Recommendation: keep going, report all errors, and exit non-zero without writing partial changes unless an explicit `--force` is added later.

8. **Performance acceptance target:** The design asks for low impact but does not define a threshold. Recommendation: record baseline counts/timing for replay/prewarm tasks before and after adding hidden instruments; use “hidden tables produce zero replay/prewarm tasks” as the first pass criterion.

## Suggested Implementation Order

1. Add pure extraction helpers and tests for instrument summaries.
2. Add `bin/update-song-list.js` with `--check`, update package scripts, and test on a temporary fixture song list.
3. Run the updater on `songs/song-list.json` after reviewing expected output.
4. Update `SongLibrary.js` model/rendering for the third column.
5. Update `song-library.css` with grid and badge styling.
6. Extend Song Library Jest tests.
7. Add replay/prewarm visibility tests around existing behavior.
8. Only then optimize any audited path that still touches hidden table IDs during replay, beat looping, section transition, or cache prewarming.

## Validation Plan

Targeted checks:

- `node bin/update-song-list.js --check`
- `node bin/update-song-list.js --song-list songs/song-list.json`
- `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/song-library-model.test.js _tests/jest/song-load-library.test.js _tests/jest/note-table-render-cache.test.js _tests/jest/looper.test.js --verbose --runInBand`

Pre-checkin check:

- `export INFINITE_NECK_VERBOSE=-1`
- `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`

Manual UI acceptance:

- Open File menu and expand Song Library.
- Confirm the root and directory accordions still start closed.
- Confirm links remain filename-only.
- Confirm descriptions keep raw curated HTML.
- Confirm instrument badges appear in the third column.
- Confirm visible/hidden Main/Listener/Observer styles are distinguishable.
- Load a multi-instrument song, hide an instrument, loop sections, and verify no visual stutter/regression compared with the baseline.
