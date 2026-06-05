I’m tracing how “Visible tables” currently moves between model, DOM, save path, and load path so I can point to the actual holes rather than reason from the sprint doc alone.

Read [](file:///home/laramie/infinite-neck/_doco/design/sprints/122-persistence/122-persistence-matrix.md)

Searched for regex `visibleNoteTables|Visible tables|visible tables|checkbox` (`**/*.js`), 196 results

I’ve confirmed the matrix already identifies the core problem: the shape is fine, but the save path still treats the DOM as authoritative. Next I’m reading the concrete visibility code paths to separate model truth from view synchronization.

Read [](file:///home/laramie/infinite-neck/Song.js#920-920), lines 920 to 990

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#560-560), lines 560 to 700

Read [](file:///home/laramie/infinite-neck/TuningsLibrary.js#460-460), lines 460 to 545

Read [](file:///home/laramie/infinite-neck/bin/song-file-schema.js#260-260), lines 260 to 310

I have the core save-side pieces. I’m reading the load/hydration and pruning paths now, because the biggest risk here is not just saving the wrong visibility list but deleting hidden table data based on it.

Searched for regex `function updateVisibleTablesInMemoryModel|updateVisibleTablesInMemoryModel\(|removeUnusedTablesFromMemoryModel|showTuningsForTablesInFile|updateAfterOpenSong|visibleTableIds` (`**/{infinite-neck.js,Song.js,TuningsLibrary.js}`), 21 results

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#700-700), lines 700 to 840

Read [](file:///home/laramie/infinite-neck/Song.js#360-360), lines 360 to 430

Read [](file:///home/laramie/infinite-neck/Song.js#120-120), lines 120 to 220

Read [](file:///home/laramie/infinite-neck/Song.js#884-884), lines 884 to 930

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#844-844), lines 844 to 980

Read [](file:///home/laramie/infinite-neck/TuningsLibrary.js#680-680), lines 680 to 780

Read [](file:///home/laramie/infinite-neck/_tests/jest/song-api-load-V2.test.js#60-60), lines 60 to 232

Read [](file:///home/laramie/infinite-neck/Song.js#1-1), lines 1 to 80

Read [](file:///home/laramie/infinite-neck/SongPersistence.js)

Searched for regex `removeEmptyTables\(|sectionNotesByTable|visibleNoteTables` (`**/Section.js`), 12 results

Read [](file:///home/laramie/infinite-neck/Section.js#1-1), lines 1 to 180

The main shape is clear now: `visibleNoteTables` exists in the model and schema, but the runtime still recalculates it from what the browser is showing. I’m checking one more layer: whether hidden tables are otherwise treated as non-existent elsewhere, especially through table installation and wiring/default-table logic.

Searched for regex `visibleNoteTables|getDefaultTableID\(|getVisibleTunings\(|visible\s*=\s*true|visible\s*=\s*show|requestReinstallAllTuningsTables|installAllTuningsTables|installOneTuningTable` (`**/*.js`), 99 results

Read [](file:///home/laramie/infinite-neck/TuningsLibrary.js#240-240), lines 240 to 340

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#980-980), lines 980 to 1105

Searched for regex `buildNoteTable\(|if \(!tuning.visible|tuning.visible` (`**/TableBuilder.js`), 1 result

Read [](file:///home/laramie/infinite-neck/TableBuilder.js#1-1), lines 1 to 80

Read [](file:///home/laramie/infinite-neck/bin/song-file-schema.js#310-310), lines 310 to 336

I’ve got enough to identify the real contract gap. I’m checking one last inconsistency around lookup and fallback, because missing or stale `visibleNoteTables` entries can fail differently depending on whether the song has matching `myTunings` loaded yet.

Searched for regex `function findTuning\(|function findTuningForID\(|getMyTunings\(|getAllTunings\(|reloadTuningsDisplay` (`**/TuningsLibrary.js`), 14 results

Read [](file:///home/laramie/infinite-neck/TuningsLibrary.js#1-1), lines 1 to 140

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#748-748), lines 748 to 790

Read [](file:///home/laramie/infinite-neck/templates/WiringBuilder.js#45-45), lines 45 to 90

I’ve finished the code pass. The central issue is a split-brain contract: the model already has `visibleNoteTables`, but both save-time and many runtime decisions still trust the DOM instead. I’m writing up the concrete holes, the actual data-loss risks, and the model-owned contract I’d recommend.

Read [](file:///home/laramie/infinite-neck/Song.js#28-28), lines 28 to 52

Read [](file:///home/laramie/infinite-neck/Section.js#158-158), lines 158 to 176

Read [](file:///home/laramie/infinite-neck/bin/validate-song-schema.js#132-132), lines 132 to 148

**Assessment**

For “Visible tables,” the persisted field is already the right object: `Song.visibleNoteTables` is a song-level list of visible table IDs, it survives load/save, and tests already treat it as part of the V2 contract in Song.js, SongPersistence.js, song-file-schema.js, and song-api-load-V2.test.js.

The problem is not the field shape. The problem is ownership.

Right now the system is split across three competing sources of truth:

1. `Song.visibleNoteTables` in the model
2. `tuning.visible` flags on the tuning objects
3. actual DOM visibility of `#div<baseID>` note-table containers

That split shows up directly in code:

- Save-time visibility is recomputed from the DOM in infinite-neck.js and then copied back into the model in infinite-neck.js.
- The model itself still exposes DOM-dependent visibility helpers in Song.js.
- Open/load uses `visibleNoteTables` to set runtime tuning visibility through the view layer in infinite-neck.js and TuningsLibrary.js.
- Table construction obeys `tuning.visible`, not `song.visibleNoteTables`, in TableBuilder.js.

So today “Visible tables” is still partly treated as runtime expanded state, even though the sprint direction says it should be song-owned persistence.

**What The Model Should Own**

The model should own exactly this:

- Which table IDs are part of the song’s visible set
- The order of that set if order matters
- Rename-safe updates when a tuning ID changes
- Validation that visible IDs refer to valid song-owned tunings

The model should not own:

- whether a DOM node is currently hidden by CSS
- whether a panel is collapsed
- whether the app is in fullscreen or docked mode
- any browser-specific notion of `:visible`

A clean contract would be:

- `Song.visibleNoteTables` is canonical
- `tuning.visible` is derived runtime convenience only, or removed
- DOM visibility is a view projection of the model, never the source of truth

**Current Holes**

**1. Save path still trusts the DOM**
- infinite-neck.js rebuilds the visible list by asking which table divs are currently `:visible`.
- That means save correctness depends on a browser view being present and synchronized.
- In headless or partial-view contexts, that can overwrite correct model state with stale or empty visibility.

**2. Model methods are not pure**
- Song.js uses jQuery selectors inside `getVisibleTunings()` and `getVisibleTuningIDs()`.
- That makes the model depend on the DOM and breaks the intended persistence boundary.
- It also means many callers think they are asking the model, but they are really asking the current browser state.

**3. There are three visibility representations**
- `song.visibleNoteTables`
- `myTunings[n].visible`
- DOM display state
- These can drift. When they drift, the current code usually resolves the disagreement by trusting the DOM.

**4. Load fallback is too forgiving**
- infinite-neck.js calls TuningsLibrary.showTuningsForTablesInFile, and if none are found it falls back to defaults in infinite-neck.js.
- If `visibleNoteTables` is wrong, stale, or missing, the app can silently show default tunings instead of preserving song intent.
- That is a reasonable usability fallback, but a weak persistence contract.

**5. Schema does not fully enforce the contract**
- `visibleNoteTables` exists in the schema at song-file-schema.js, but it is not required in the V2 required list at song-file-schema.js.
- Strict validation separately requires it in validate-song-schema.js, which means the canonical contract is partly in schema and partly outside it.

**6. Hidden-table runtime behavior is stronger than “presentation only”**
- Replay/build paths operate on visible tables derived from DOM state in Song.js and NoteTableController.js.
- Wiring UI also uses visible tables as its candidate set in WiringBuilder.js.
- So a table becoming “not visible” affects more than display. It affects what the user can reach and manipulate.

**Dangers Right Now**

**1. A no-view or stale-view save can strand real song data**
If `visibleNoteTables` is recomputed from the DOM at save time and the DOM is incomplete, hidden, or not installed, the song can be saved with too few visible tables or none at all.

The section note data may still remain in `sectionNotesByTable`, so the notes are not physically deleted. But on reopen:

- the table may not be shown
- replay and note rendering may not reach it
- wiring menus may not list it
- the user experiences the notes as “gone”

That is the most important current risk: not immediate deletion, but effective orphaning.

**2. A hidden table can become operationally invisible**
Because table building obeys `tuning.visible` in TableBuilder.js, and many runtime paths ask the DOM or `getVisibleTunings()`, a table that is hidden for the wrong reason stops participating in normal app behavior.

Again, the notes may still be in the model, but the song is no longer opening “correctly from that info stored in the model.”

**3. Hidden tables with wiring can become especially confusing**
If a table is omitted from visible state, existing wirings may still persist in the model, but UI lists and replay paths increasingly operate only on visible tables. That produces a half-alive state: the song still contains the table and wiring, but the app no longer surfaces it well.

**4. Empty table containers are dropped on save**
`prepareForSave()` calls `removeUnusedTablesFromMemoryModel()` in Song.js, which delegates to Section.js.
That cleanup removes note-table entries with no notes.

That is not itself a bug. But it means you cannot rely on section payload shape to reconstruct visibility later. If a table is intentionally visible but empty, only `visibleNoteTables` preserves that intent. That makes it even more important that `visibleNoteTables` be model-owned and never overwritten from the DOM by accident.

**5. The current design can silently convert persistence errors into default-view behavior**
If persisted visibility cannot be resolved, the app falls back to default tunings instead of treating it as a recoverable mismatch. That is convenient for casual use, but dangerous for persistence work because it hides the defect.

**Recommendations**

**1. Make `Song.visibleNoteTables` the only canonical source**
Model-owned methods should be pure and DOM-free, for example:

- `song.getVisibleTableIDs()`
- `song.setVisibleTableIDs(ids)`
- `song.showTable(tableID)`
- `song.hideTable(tableID)`
- `song.isTableVisible(tableID)`
- `song.normalizeVisibleTableIDs()`

Those methods should operate only on `song.visibleNoteTables`.

**2. Stop scraping visibility from the DOM at save time**
Replace the logic in infinite-neck.js with one of these approaches:

1. best option: checkbox changes update the model immediately, so save just serializes `song.visibleNoteTables`
2. acceptable option: save caller explicitly passes the chosen visible IDs, but they must come from the model-facing UI state, not from `:visible`

The save path should never need to inspect rendered table divs.

**3. Demote `tuning.visible` to derived state**
You have two reasonable options:

1. Keep `tuning.visible`, but treat it as a runtime projection rebuilt from `song.visibleNoteTables`
2. Remove `tuning.visible` entirely from decision-making and compute it from the model when rendering

Either is fine. What is not fine is letting both be authoritative.

**4. Move visibility queries out of the DOM-backed model helpers**
`Song.getVisibleTunings()` and `Song.getVisibleTuningIDs()` in Song.js should stop touching `$`.
They should return values from `song.visibleNoteTables`.

View helpers can still ask the DOM if needed, but they should not live on the model.

**5. Hydrate runtime visibility from the model early and only once**
On open:

- load `myTunings`
- validate `visibleNoteTables` against available song tunings
- derive runtime `tuning.visible` from `visibleNoteTables`
- install/render tables from that model state

That is better than the current indirect flow where load calls a view helper that mutates tuning visibility and then falls back to defaults.

**6. Validate visible IDs against `myTunings`**
Because the visible checkboxes live under “Tunings in Song,” the safest contract is:

- `visibleNoteTables` should reference song-owned tuning IDs only
- every entry should match a `myTunings.baseID`
- non-matching entries should be preserved for diagnostics, but not silently trusted

If the app sees a mismatch, it should warn and apply a deterministic fallback, not silently replace the set with generic defaults.

**7. Make the fallback policy explicit**
Recommended load policy:

1. If `visibleNoteTables` is present and valid, use it exactly.
2. If some IDs are invalid, keep the valid subset and warn.
3. If none are valid but the song has `myTunings`, fall back to the first song tuning, not host defaults.
4. Only if there are no song tunings at all should host/default tuning logic run.

That keeps fallback song-owned.

**8. Tighten schema and tests**
I would make `visibleNoteTables` required for V2, not just strict validation.

At minimum, add tests for:

1. headless save preserves existing `song.visibleNoteTables` without any DOM
2. open uses persisted `visibleNoteTables` exactly
3. hidden table with note data round-trips without becoming unreachable
4. hidden table with wiring survives and remains user-recoverable
5. stale/invalid `visibleNoteTables` produces deterministic fallback plus warning
6. rename updates `visibleNoteTables` and keeps visibility stable across reopen

**Bottom Line**

`visibleNoteTables` is already the right persisted field. The gap is that the system still behaves as if visibility is a view-derived runtime fact.

For sprint-122, I would define the contract this way:

- `visibleNoteTables` is User-authored songfile data
- DOM visibility is runtime expanded state
- `tuning.visible` is derived runtime convenience, not persisted truth
- the model is responsible for visibility identity, validity, and round-trip stability
- the view is responsible only for reflecting model visibility

If you want, I can turn this into a short “Iteration 5: Visible Tables” section in the sprint docs, either in 122-persistence-matrix.md or as a design note in sprint-122.md.