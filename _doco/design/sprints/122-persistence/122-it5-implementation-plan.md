# sprint-122-persistence Iteration 5 implementation plan

Status: Draft for Design approval (no code changes yet)

## 1) Intent and scope

Iteration 5 makes Song.visibleNoteTables the canonical source of truth for note-table visibility and ordering in "Tunings in Song", while preventing orphaning of table-backed SectionNotes by disallowing delete (X) when InMem > 0.

In scope:
- Disable X for rows where InMem is non-blank and > 0.
- Allow X for rows where InMem is blank or 0.
- Keep View checkbox behavior (hide/show layout only), but write through to Song.visibleNoteTables.
- Preserve table order from Song.visibleNoteTables for the "Tunings in Song" list and move up/down behavior.
- Remove DOM visibility as save-time/model-time authority.
- Keep prepareForSave() cleanup behavior.

Out of scope (explicit defer):
- Graveyard flow for references to missing table IDs.
- New UX for cross-table section revive/migration.
- Large refactor of unrelated visibility consumers unless needed to enforce correctness.

## 2) Contract to implement

Canonical contract:
- Song.visibleNoteTables is persisted user-authored song state.
- Song.visibleNoteTables order is the order of "Tunings in Song" view rows.
- Hiding a table updates Song.visibleNoteTables only; it does not remove sectionNotesByTable data.
- Deleting a tuning row (X) is blocked when InMem > 0 to prevent orphaning.
- tuning.visible is runtime derived convenience only (if retained).
- DOM visibility is projection only, never source of truth.

## 3) Concrete change plan (by area)

### A. Model API hardening (Song.js)

Current touchpoints:
- getVisibleTunings()
- getVisibleTuningIDs()
- setVisibleTableIds(...)
- prepareForSave(...)
- removeUnusedTablesFromMemoryModel()

Planned changes:
1. Make visibility query methods model-pure:
- getVisibleTunings() and getVisibleTuningIDs() must read Song.visibleNoteTables (or derived tunings list), not jQuery/DOM visibility.

2. Normalize writer semantics:
- setVisibleTableIds(ids) should preserve order, dedupe, and ignore unknown IDs only per approved fallback policy.

3. Keep cleanup semantics unchanged:
- prepareForSave() still calls removeUnusedTablesFromMemoryModel(); this is storage cleanup, not visibility authority.

Expected result:
- Any call site asking song visibility reads model state, not browser state.

### B. Save path ownership fix (infinite-neck.js)

Current touchpoint:
- updateVisibleTablesInMemoryModel() is called in save path and currently derives from DOM/table visibility.

Planned changes:
1. Stop deriving visibility from rendered table nodes at save time.
2. Ensure save uses existing Song.visibleNoteTables as already managed by UI interactions.
3. If updateVisibleTablesInMemoryModel() remains, reduce it to a model-sync helper that does not scrape :visible from DOM.

Expected result:
- Headless/partial-render states cannot clobber persisted visibility.

### C. Tunings in Song UI behavior (TuningsLibrary.js + related handlers)

Current touchpoints:
- showTuningsForTablesInFile()
- row actions for View checkbox and Move/X controls

Planned changes:
1. X-button gating:
- Compute InMem per row from model-backed counts.
- Disable X when InMem > 0.
- Keep X enabled when InMem is blank or 0.

2. View checkbox write-through:
- Checking/unchecking updates Song.visibleNoteTables immediately.
- Apply granular table show/hide without full rebuild where feasible.

3. Order ownership:
- Up/down movement updates Song.visibleNoteTables order directly.
- Row render order in "Tunings in Song" follows Song.visibleNoteTables, not DOM incidental order.

Expected result:
- UI controls become model editors; model remains authoritative.

### D. Runtime projection alignment (TableBuilder.js + consumers)

Current risk:
- Runtime install/build paths may still consult tuning.visible and/or visible DOM nodes.

Planned changes:
1. Ensure runtime visible set is computed from Song.visibleNoteTables.
2. If tuning.visible is kept, regenerate it from Song.visibleNoteTables during hydration/update.
3. Audit visible-table consumers used by replay/wiring lists to ensure they consult model-derived visibility.

Known consumers to verify:
- NoteTableController.js visible-table queries.
- templates/WiringBuilder.js source list behavior.

Expected result:
- Hidden tables remain valid model data and can be re-shown deterministically.

### E. Load/hydration policy and fallback

Current touchpoints:
- showTuningsForTablesInFile() + fallback behavior in song-open path.

Planned changes:
1. Validate Song.visibleNoteTables against myTunings IDs during load.
2. Apply explicit fallback policy (needs Design sign-off; see open questions):
- Use valid subset.
- Warn/log invalid IDs.
- If empty after validation and song has tunings, choose deterministic song-owned fallback.

Expected result:
- Visibility mismatches are recoverable without silent host-default drift.

## 4) Sequence and checkpoints

1. Implement model API hardening in Song.js.
2. Update save path to stop DOM-derived visibility.
3. Update Tunings in Song handlers: X gating, checkbox write-through, move/order wiring.
4. Align runtime projection and load fallback behavior.
5. Add/adjust tests (unit + integration).
6. Manual acceptance run using defined scenarios.

Checkpoint after step 2:
- Verify that toggling view and saving without full table rendering preserves visibleNoteTables.

Checkpoint after step 4:
- Verify hidden-table notes and listener wiring still round-trip and remain recoverable.

## 5) Test plan (required before merge)

Automated tests:
1. Save path does not recompute visibility from DOM and preserves Song.visibleNoteTables.
2. Visibility checkbox updates Song.visibleNoteTables immediately.
3. X is disabled when InMem > 0 and enabled at 0/blank.
4. Move up/down updates Song.visibleNoteTables order.
5. Hidden table with section notes round-trips (notes remain, table re-show works).
6. Invalid visibleNoteTables IDs on load apply approved fallback and emit warning.

Manual scenarios:
1. Two-table listener setup where source table is hidden, save/reopen, listener behavior remains valid.
2. Attempt to X table with notes in memory: blocked.
3. Delete sections to zero InMem, then X: allowed.
4. Hide/unhide does not erase section note payloads.

## 6) Concrete files likely to change (for coding phase)

- Song.js
- infinite-neck.js
- TuningsLibrary.js
- TableBuilder.js (if needed for projection consistency)
- NoteTableController.js (if visible-set lookups need adjustment)
- templates/WiringBuilder.js (if source list should include/exclude hidden tables per policy)
- _tests/jest/* visibility/save/load related tests

Note:
Exact file list may adjust after implementation spike, but these are the verified current touchpoints.

## 7) Design holes / approval questions

The following must be approved before coding starts:

1. InMem definition for X gating:
- Is InMem strictly "count of sectionNotesByTable entries with non-empty notes across all sections", or a broader count including derived/legacy note containers?

2. X-button UX when blocked:
- Disable only, or disable + tooltip/message explaining "Delete sections first"?

3. Invalid visibleNoteTables policy on load:
- Keep valid subset and warn?
- If subset is empty but song has myTunings, should fallback be first song tuning, previous default table ID, or no visible tables?

4. Ordering source of truth details:
- If a tuning exists in myTunings but missing from visibleNoteTables, should it appear in "Tunings in Song" list as hidden append, or not appear until manually added?

5. Hidden-table participation policy:
- Should hidden tables remain selectable in wiring source/target pickers, or should pickers remain "visible-only"?
- Current behavior appears mixed; design decision required for consistency.

6. Rename handling and ID repair:
- Confirm that rename continues to update visibleNoteTables and sectionNotesByTable references atomically.
- Confirm whether preserving manual ID-repair workflow is still required as an explicit supported behavior.

7. Event/performance constraints:
- Approve requirement that visibility checkbox updates must be granular (no full table reinstall unless necessary).

8. Schema strictness:
- Should visibleNoteTables be required in V2 schema formally, or remain optional with strict validator enforcement only?

## 8) Definition of done for Iteration 5

Iteration 5 is done when all are true:
- Song.visibleNoteTables is canonical for visibility and ordering.
- Save/load does not depend on DOM visibility.
- X gating by InMem prevents orphaning paths defined in scope.
- Hide/show preserves section note data and supports deterministic restore.
- Tests cover core persistence and fallback behavior.
- Design approval questions above are resolved and documented.

