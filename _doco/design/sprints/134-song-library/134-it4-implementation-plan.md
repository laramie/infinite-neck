# Sprint 134 Song Library — Iteration 4 Implementation Plan

## Scope

Iteration 4 has four implementation tracks:

1. Make the Iteration 3 instrument role badge renderer reusable outside [SongLibrary.js](../../../../SongLibrary.js).
2. Render the same role badges in the My Tunings table, replacing the current `from` text column with a `Role` badge column.
3. Add approved text-expansion widgets for whole-song instrument badges and make those expansions render in File > Info.
4. Remove persisted/runtime `myTunings[].visible` as an obsolete model field, keeping `noteTablesLayout[].visible` as the single source of truth.

## Current code observations

### Badge rendering

- [SongLibrary.js](../../../../SongLibrary.js) already normalizes `songs[].instruments` and renders `<span class='songLibraryInstrument instrumentMain|instrumentListener|instrumentObserver ...'>fromBaseID</span>`.
- The role-class logic and badge HTML renderer are currently private implementation details in [SongLibrary.js](../../../../SongLibrary.js).
- [song-library.css](../../../../song-library.css) already contains the approved badge CSS classes. Because the My Tunings grid and Song Library live on the same host page, the same CSS should be available without additional stylesheet loading.

### My Tunings grid

- [TuningsLibrary.js](../../../../TuningsLibrary.js) builds the My Tunings rows and currently appends the song-owned lineage column with `tun.fromBaseID`.
- The row order is already driven by `noteTablesLayout` where possible via `getOrderedMyTuningsByLayout()`.
- The existing `ReloadTuningsDisplays` event is already used to rebuild My Tunings displays after song load and menu actions.
- Wiring changes already emit `Wiring:added` and `Wiring:removed` from [Song.js](../../../../Song.js), and [NoteTableController.js](../../../../NoteTableController.js) already reacts to those events for replay.

### Approved values and Info

- [approved-values.js](../../../../approved-values.js) owns the `${name}` template expansion registry and help/reference rendering.
- Section captions already use `expandApprovedTemplate(rawCaption)` in [infinite-neck.js](../../../../infinite-neck.js).
- File > Info currently sanitizes and stores the user-entered HTML in [templates/info/info.builder.js](../../../../templates/info/info.builder.js), then renders `song.info` directly.
- The Info sanitizer allows table/span tags but strips attributes such as `class`. Therefore approved widget HTML should be generated after user HTML sanitization, not stored as sanitized user input.

### Visibility model

- `noteTablesLayout[].visible` is the working source of truth for visible instruments.
- [bin/update-song-list.js](../../../../bin/update-song-list.js) still checks `myTunings[].visible` and warns when it conflicts with `noteTablesLayout`.
- [TuningsLibrary.js](../../../../TuningsLibrary.js) still creates some tuning templates with `visible: true`.
- [tunings.js](../../../../tunings.js) still contains many library tuning `visible` values.
- Some song files may still contain stale `myTunings[].visible` fields.

## Shared role badge utility

Create a small reusable ES module, likely [InstrumentRoleBadges.js](../../../../InstrumentRoleBadges.js), rather than making UI code import all of [SongLibrary.js](../../../../SongLibrary.js).

Recommended exported functions:

- `classifyInstrumentRole(tableID, wirings)` returns `Main`, `Listener`, or `Observer` using the approved Iteration 3 role model.
- `normalizeInstrumentSummary(instrument)` returns `{ fromBaseID, wiring, visible }` or `null`.
- `getInstrumentRoleClass(instrument)` returns `instrumentMain`, `instrumentListener`, or `instrumentObserver`.
- `renderInstrumentBadge(instrument)` returns one escaped badge span.
- `renderInstrumentBadges(instruments)` returns concatenated badge spans.
- `getSongInstrumentSummaries(song)` builds summaries from a live song using `myTunings[]`, `wirings[]`, and `noteTablesLayout[]`.
- `renderSongInstrumentTable(song)` returns the requested table form.

Reuse policy:

- [SongLibrary.js](../../../../SongLibrary.js) should import the renderer and stop carrying its own duplicate badge role logic.
- [bin/update-song-list.js](../../../../bin/update-song-list.js) may either import pure role helpers or retain CLI-local helpers. Prefer sharing `classifyInstrumentRole()` and normalization if import dependencies stay browser/Node safe.
- The utility must not depend on jQuery or the DOM.

## Implementation track A — My Tunings role badges

Update [TuningsLibrary.js](../../../../TuningsLibrary.js):

1. Rename the song-owned `from` column header to `Role`.
2. Replace the raw `tun.fromBaseID` cell with one role badge generated from the shared badge utility.
3. Derive badge input from the live song:
   - `fromBaseID`: exact `tun.fromBaseID`.
   - `wiring`: classify from `song.wirings` for `Constants.TABLE_ID_PREFIX + tun.baseID`.
   - `visible`: `song.isTableVisible(tableID)` or equivalent `noteTablesLayout` lookup.
4. Keep duplicate badges where duplicate tunings exist; each My Tunings row represents one tuning instance.
5. If `fromBaseID` is missing, render an escaped fallback such as `(unknown)` or an empty cell plus `title`; do not fall back to `baseID` unless explicitly approved.

Refresh behavior:

- Add listeners for `Wiring:added` and `Wiring:removed` that trigger `ReloadTuningsDisplays`, or trigger `ReloadTuningsDisplays` at the end of `Song.addWiring()` and `Song.removeWiring()`.
- Prefer one event path so wiring changes, note table reinstall, and My Tunings refresh do not diverge.
- Avoid rebuilding while the user is mid-edit in a My Tunings input if possible; if the current table is visible, a full rebuild is acceptable for this iteration because the badges must stay correct.

Tests:

- Extend existing TuningsLibrary tests or add a small pure-helper test proving Main/Listener/Observer class selection for My Tunings badge inputs.
- If browser-oriented DOM tests are awkward, keep Jest coverage on the shared pure functions and manually validate the My Tunings DOM in UI acceptance.

## Implementation track B — `${songInstrumentBadges}` and `${songInstrumentTable}`

Update [approved-values.js](../../../../approved-values.js):

1. Add an approved value named `songInstrumentBadges`.
2. Add an approved value named `songInstrumentTable`.
3. Mark both with `sampleFormat: 'html'` so `/vdv` displays live HTML samples.
4. Resolve both from the current song, not the current section.

Widget behavior:

- `${songInstrumentBadges}` renders the same badge list the Song Library renders for one song entry.
- `${songInstrumentTable}` renders:
  - `<table>`
  - header row: `Role`, `ID`
  - one row per `myTunings[]` item in live song/order
  - first data cell: the badge
  - second data cell: escaped tuning `baseID`
- Use exact `fromBaseID` for badge labels.
- Use `noteTablesLayout` for visibility.
- Preserve duplicate instruments.

Recommended table classes:

- Add a stable wrapper class such as `songInstrumentTable` to the table for CSS targeting.
- Keep the role badges themselves unchanged so existing `.songLibraryInstrument` CSS applies.

Tests:

- Add Jest coverage in approved-values tests for both token names.
- Assert escaped `baseID`/`fromBaseID`, duplicate row preservation, role class, and `instrumentNotVisible` behavior.

## Implementation track C — expand approved values in File > Info

Update [templates/info/info.builder.js](../../../../templates/info/info.builder.js):

1. Import `expandApprovedTemplate` from [approved-values.js](../../../../approved-values.js).
2. Keep storing sanitized raw user HTML/template text in `song.info`.
3. Render a separate expanded value into `#divInfoRendered`:
   - sanitize user input first,
   - preserve `${...}` tokens in stored text,
   - expand approved tokens only for rendered output.
4. Do not write expanded widget HTML back to the textarea or song file.
5. Keep unknown tokens preserved, matching current caption expansion behavior.

Suggested helper in `InfoBuilder`:

- `getRenderedInfoHtml(rawInfo)`:
  - calls `InfoBuilder.getSanitizedInfo(rawInfo)`
  - calls `expandApprovedTemplate(sanitizedInfo)`
  - returns expanded HTML

Important sanitizer note:

- Approved widget HTML should not be passed back through the user-input sanitizer after expansion, because the sanitizer currently strips `class` attributes that the badges require.
- This is acceptable because approved widgets are generated by application code, not arbitrary user HTML.

Tests:

- Extend InfoBuilder sanitizer/render tests, or add tests for a pure helper if InfoBuilder DOM setup is heavy.
- Verify `song.info` stores `${songInstrumentBadges}` literally while `#divInfoRendered` contains badge spans.
- Verify user-authored disallowed attributes/scripts are still removed before expansion.

## Implementation track D — remove tuning `visible`

### Runtime/model cleanup

Update runtime code so `myTunings[].visible` is no longer read or written for persistent state:

1. Remove `visible: true` from song-owned tuning templates in [TuningsLibrary.js](../../../../TuningsLibrary.js).
2. Audit code paths that clone/import tunings and ensure they do not add `visible` to `myTunings`.
3. Keep `noteTablesLayout` initialization responsible for visibility. New visible user-facing tables should receive `noteTablesLayout` entries with `visible: true`.
4. Avoid changing unrelated uses of local variables/options named `visible` that are purely DOM/display flags and not persisted tuning model fields.

### `tunings.js` cleanup

Remove `visible` fields from library tuning definitions in [tunings.js](../../../../tunings.js). These are not the user/song visibility model and have become misleading.

### Song file cleanup

Add or extend a developer utility to remove stale `myTunings[].visible` fields from repository song files.

Recommended approach:

- Add a one-purpose script in [bin/](../../../../bin/) such as `strip-tuning-visible.js`.
- Default target: canonical song files referenced by [songs/song-list.json](../../../../songs/song-list.json).
- Optional `--all-songs` can walk [songs/](../../../../songs/) later, but is not required for Iteration 4.
- `--check` reports stale fields without writing.
- Write only song files where a `myTunings[].visible` field is removed.
- Do not alter `noteTablesLayout[].visible`.

Package scripts:

- `strip:tuning-visible`: run the remover.
- `check:tuning-visible`: run the remover in check mode.

### `update-song-list` cleanup

Update [bin/update-song-list.js](../../../../bin/update-song-list.js):

1. Stop reading `tuning.visible` as a fallback.
2. Stop warning about `tuning.visible` conflicts.
3. If a tuning has no `noteTablesLayout` entry, warn and use an explicit default.
4. Recommended default: `visible: true`, because missing layout means there is not enough layout state to hide the table intentionally.
5. Consider adding a warning if stale `tuning.visible` is present so cleanup is discoverable, but do not use the value.

Tests:

- Update [update-song-list.test.js](../../../../_tests/jest/update-song-list.test.js) to remove conflict-warning expectations.
- Add coverage proving stale `tuning.visible=false` is ignored when `noteTablesLayout=true`.
- Add coverage proving missing `noteTablesLayout` warns and defaults consistently.
- Add tests for the cleanup utility if a utility is added.

## Implementation order

1. Create shared badge helper and move [SongLibrary.js](../../../../SongLibrary.js) badge rendering onto it.
2. Update [bin/update-song-list.js](../../../../bin/update-song-list.js) only as needed to use shared role helpers without changing behavior yet.
3. Implement My Tunings `Role` badges and wiring refresh event.
4. Add approved values and File > Info rendering expansion.
5. Remove `myTunings[].visible` runtime writes/reads and update the song-list updater behavior.
6. Remove `visible` from [tunings.js](../../../../tunings.js).
7. Run the song cleanup utility for canonical songs.
8. Run validation and then `npm run update:song-list` to ensure the warning shown in the request is gone.

## Validation plan

Targeted checks:

- `npm run check:song-list`
- `npm run update:song-list`
- `npm run check:tuning-visible`
- `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/song-library-model.test.js _tests/jest/update-song-list.test.js --verbose --runInBand`

Likely additional targeted Jest files after implementation:

- shared badge helper tests
- approved-values tests
- InfoBuilder render tests, if existing test setup supports DOM safely

Pre-checkin check:

- `export INFINITE_NECK_VERBOSE=-1`
- `node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand`

Manual UI acceptance:

- Open File > Song Library and verify existing badges still render unchanged.
- Open My Tunings and verify the `Role` column uses badges for Main, Listener, Observer, and hidden instruments.
- Change wiring while My Tunings is visible and verify badges refresh.
- Add `${songInstrumentBadges}` to File > Info, save, switch to rendered Info, and verify badges appear while the textarea keeps the token.
- Add `${songInstrumentTable}` to File > Info and verify the table appears with Role and ID columns.
- Run `npm run update:song-list` and verify no `tuning.visible` conflict warnings remain.

## Questions / decisions needed

1. **Missing `noteTablesLayout` fallback:** Should the updater default missing layout entries to visible? Recommendation: yes, warn and use `visible: true`.
2. **Canonical song cleanup scope:** Should the cleanup utility modify only songs listed in [songs/song-list.json](../../../../songs/song-list.json), or every JSON file under [songs/](../../../../songs/)? Recommendation: canonical list only for Iteration 4.
3. **Missing `fromBaseID` in My Tunings:** Should the badge cell show `(unknown)` or be blank with a warning/title? Recommendation: show `(unknown)` with the Main/Listener/Observer role class so the row remains diagnosable.
4. **Shared helper file name:** Is [InstrumentRoleBadges.js](../../../../InstrumentRoleBadges.js) acceptable as a new top-level module? Recommendation: yes, because the renderer is now shared by Song Library, My Tunings, and approved values.
5. **Event strategy for wiring refresh:** Should `Song.addWiring()`/`Song.removeWiring()` trigger `ReloadTuningsDisplays` directly, or should listeners in [infinite-neck.js](../../../../infinite-neck.js) bridge wiring events to reload? Recommendation: bridge in [infinite-neck.js](../../../../infinite-neck.js) to keep model methods focused on model events.