# sprint-134 Iteration 1 implementation plan

Date: 2026-06-25
Sprint: 134 song-library
Inputs:
- [134-design.md](134-design.md)
- [index.html](../../../../index.html)
- [infinite-neck.js](../../../../infinite-neck.js)
- [songs/song-list.json](../../../../songs/song-list.json)
- [_tests/jest/song-load-library.test.js](../../../../_tests/jest/song-load-library.test.js)

## Iteration 1 objective

Implement a directory-first Song Library UI backed by `songs/song-list.json`, including per-song optional descriptions, while introducing a new module `SongLibrary.js` and preserving compatibility with existing string-only `songs[]` entries used by current tests and song lists.

## Scope for Iteration 1

In scope:
1. Extract and migrate song-library rendering/parsing behavior from [infinite-neck.js](../../../../infinite-neck.js) into new module [SongLibrary.js](../../../../SongLibrary.js).
2. Support two input shapes for `songs[]` entries:
- legacy string: `"dir/song.json"`
- object: `{ "href": "dir/song.json", "description": "...optional html..." }`
3. Build first-level directory groups from paths in `songs[]` (no filesystem walk).
4. Show one expanded directory at a time (accordion behavior).
5. Render song rows as two columns: link path + description HTML.
6. Skip invalid entries (missing/empty href).
7. Update tests that assume string-only `songs[]` so both formats are accepted.

Out of scope for Iteration 1:
1. Super-user toggle (`/fa`) to reveal filtered fixture directories.
2. New curation schema beyond existing `songs[]` list entries.
3. Full redesign of File menu layout beyond Song Library section.

## Current state summary

1. [infinite-neck.js](../../../../infinite-neck.js#L1565) currently builds a flat link list directly from `data.songs` and injects raw HTML into `#divSongList`.
2. [index.html](../../../../index.html#L123) provides button `#btnSongList` and container `#divSongList`.
3. [songs/song-list.json](../../../../songs/song-list.json) is currently string-only in `songs[]`.
4. [_tests/jest/song-load-library.test.js](../../../../_tests/jest/song-load-library.test.js#L137) assumes `songs[]` items are strings when constructing song file paths.

## Proposed implementation design

### 1) New module: SongLibrary.js

Create [SongLibrary.js](../../../../SongLibrary.js) as the single place for:
1. `normalizeSongListEntries(songListJson)`
- Input: parsed `song-list.json` object.
- Output normalized array of:
`{ href: string, description: string, directory: string, filename: string }`
- Accept both legacy and object entries.
- Skip entries with missing/blank href.

2. `groupSongsByDirectory(normalizedEntries)`
- Build ordered directory groups from href prefix before first `/`.
- If no `/` is present, assign to a synthetic bucket (proposal: `"(root)"`, see questions).

3. `renderSongLibraryHtml(groups, state)`
- Render details/summary markup for top-level Song Library and each directory.
- Enforce single-open-directory behavior via state flag / open directory id.
- Render song rows with two columns:
	- column 1: link with `data-action='loadSong'` and `data-action-args='<href>'`
	- column 2: description HTML (empty allowed)

4. `loadAndRenderSongLibrary(targetSelector)`
- Fetch `songs/song-list.json`.
- Normalize and group.
- Inject generated HTML into target.
- Initialize event handlers for directory open/close behavior.

5. `toggleSongLibraryVisibility(targetSelector)`
- Keep existing UX: hide if visible; show if hidden.
- On first open in a session, default directories collapsed.
- On hide/show of the File menu, preserve user-opened directory state.

### 2) Integration changes

1. In [infinite-neck.js](../../../../infinite-neck.js):
- Replace inlined `songLibrary()` internals with delegation to `SongLibrary.js`.
- Keep public export/function signature for compatibility with existing `data-action="songLibrary"` wiring.

2. In [index.html](../../../../index.html):
- Keep current button + container ids to minimize regression risk.
- Add minimal structural classes only if needed for table-like row layout.

3. Styling:
- Add targeted styles in [infinite-neck.css](../../../../infinite-neck.css) for two-column song rows and details indentation.
- Avoid broad menu CSS changes in Iteration 1.

### 3) Data compatibility rules

For each `songs[]` item:
1. If string and non-empty: map to `{ href: string, description: "" }`.
2. If object:
- use `href` when string and non-empty
- use `description` when string, else `""`
3. If malformed/no href: skip.

Ordering:
1. Preserve original order within each directory.
2. Preserve first-seen directory order from `songs[]`.

## Detailed work plan

Phase 1: Module extraction and parse model
1. Create [SongLibrary.js](../../../../SongLibrary.js) with normalize/group/render helpers.
2. Add unit-testable pure functions first (`normalizeSongListEntries`, `groupSongsByDirectory`).
3. Keep DOM/jQuery-specific wiring isolated in a thin adapter function.

Phase 2: UI rendering and accordion behavior
1. Implement details/summary-based rendering for directories.
2. Ensure only one directory is expanded at once.
3. Keep top-level Song Library collapsed on first entry.
4. Preserve expansion state across File-menu hide/show (same page session).

Phase 3: Integrate with existing action/event system
1. Update [infinite-neck.js](../../../../infinite-neck.js) `songLibrary()` to delegate to module.
2. Verify existing delegated click handler for `data-action='loadSong'` still opens selected song.
3. Confirm no behavior change for load confirmation flow in `loadSong()`.

Phase 4: Test updates for new `songs[]` format
1. Update helper logic in [_tests/jest/song-load-library.test.js](../../../../_tests/jest/song-load-library.test.js) so `createSongList()` accepts both entry shapes.
2. Add explicit test coverage for mixed arrays: string entries + object entries.
3. Add test case confirming missing href entries are skipped.

Phase 5: Song list fixture and smoke validation
1. Update one curated list (likely [songs/song-list.json](../../../../songs/song-list.json)) to include at least one object entry with description.
2. Keep most entries unchanged for low-risk rollout.
3. Run library Jest suite and full Jest pass.

## Acceptance criteria (Iteration 1)

1. Clicking `Song Library` shows directory list, not a flat song list.
2. Clicking a directory reveals only that directory's songs and collapses others.
3. Songs render as row with link + description column.
4. Legacy string-only song lists continue to work unchanged.
5. Object-format entries render descriptions when present.
6. Missing href entries do not render and do not break page behavior.
7. Existing load-song flow works via generated links.

## Test plan

Primary tests:
1. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/song-load-library.test.js --verbose --runInBand`
2. `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`

Additions recommended:
1. Parser tests for mixed `songs[]` input shape and skip-invalid behavior.
2. UI rendering tests (if existing test infra supports DOM assertions for menu HTML output).
3. Regression check that legacy `songs/tests/test-song-list.json` still passes.

## Risks and mitigations

Risk 1: Rendering description HTML introduces XSS risk.
1. Mitigation: descriptions are curated content from trusted repo lists in this iteration.
2. Follow-up: optional future sanitization pass if untrusted sources are introduced.

Risk 2: details/summary event behavior may conflict with existing delegated click handling.
1. Mitigation: isolate directory-toggle handlers and avoid intercepting song link clicks.

Risk 3: test tooling assumes `songs[]` strings only.
1. Mitigation: normalize test list entries before path concatenation and add mixed-shape tests.

Risk 4: directory derivation edge cases (`no slash`, duplicate separators).
1. Mitigation: define explicit normalization rules and test them.

## Open questions and design holes

1. Directory key for href values with no `/`:
- Option A: show under `(root)`.
- Option B: skip as malformed.
2. Description rendering policy:
- Should we allow raw HTML exactly as provided (current design intent), or pass through existing sanitizer utilities before insertion?
3. Initial open-state behavior detail:
- Should the top-level Song Library details be closed every time `Song Library` button is clicked, or only the first time in a session?
4. Empty directories behavior:
- If all entries in a derived directory are skipped (invalid href), should that directory still appear?
5. Link text behavior:
- Confirm link text remains full relative path (`dir/file.json`) rather than filename-only.
6. Test-fixture visibility:
- Iteration says list curation excludes fixtures; confirm no code-based filtering should be added now.

## Recommended delivery order

1. Implement and test parser normalization in `SongLibrary.js`.
2. Switch `infinite-neck.js` to delegate rendering.
3. Add details/summary accordion rendering.
4. Update Jest list parsing for mixed shape.
5. Update one curated `song-list.json` entry to object format and verify end-to-end.

## Definition of done

1. Code merged with new `SongLibrary.js` module and no behavioral regressions in open-song flow.
2. Mixed-format `songs[]` lists supported in runtime and Jest song-list loading tests.
3. Song Library UI shows directories and per-song descriptions per Iteration 1 design.
4. Full Jest command passes:
`node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`
