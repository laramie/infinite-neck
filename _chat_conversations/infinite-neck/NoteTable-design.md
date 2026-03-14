You want a V3 architectural triage centered on a NoteTable domain API, optional NoteTableView pairing, and the updated beat assumptions; I’ll quickly pull the existing repo memory notes so I can align terminology and produce a clean, implementation-ready report without rescanning source files.

Read memory infinite-neck-scanning.md

Read memory song-class-migration-2026-03-12.md

I’ve synced with repo memory and will now deliver V3 focused on a NoteTable domain API, a companion view API, and revised table-to-section/beat isolation behavior under your new assumptions.**V3 Assessment: NoteTable-Centric Architecture Under New Assumptions**

This is a strong pivot point for introducing a real NoteTable domain object.  
Your new constraints simplify the problem in the best way:

1. Observer tables are read-only.
2. Theme/displayOptions remain global.
3. Cross-section beat playback is disabled.
4. Recorded beats must remain table-origin-specific.
5. NamedNotes remain shared for tables viewing the same section.

That combination supports a clear Model/View split with low-risk migration.

## 1. Proposed Domain: NoteTable (Model API)

A NoteTable model should represent table identity, section binding, behavior capabilities, and access to table-scoped data projections. It should not touch DOM.

Suggested API shape:

```ts
type TableMode = "active" | "observer";

interface NoteTableModel {
  // Identity
  getId(): string;                    // "tblNate"
  getBaseTuningId(): string;          // "Nate"
  getCaption(): string;
  setCaption(caption: string): void;

  // Section binding
  getBoundSectionIndex(): number;     // section this table reads from
  bindToSection(sectionIndex: number): void;

  // Behavior mode
  getMode(): TableMode;               // active or observer
  setMode(mode: TableMode): void;
  isReadOnly(): boolean;              // true when observer

  // Data access (section-aware)
  getNamedNotes(): Record<string, unknown>;
  getTableNotes(): Array<unknown>;    // section.noteTables[tableId]
  getDisplayOptions(): Record<string, unknown>; // global passthrough if needed

  // Recording policy
  isBeatPlaybackEnabled(): boolean;   // false for observer by your new rule
  isBeatRecordingEnabled(): boolean;  // false for observer
}
```

Minimal implementation detail:
- Bound section index is explicit on each NoteTable.
- Table mode controls interaction gates.
- Table notes and named notes are always resolved through the bound section, not current section.

## 2. Proposed View: NoteTableView (UI API)

A NoteTableView should own selector scoping and event wiring for one table subtree.  
It should never decide which section to read; it asks the model.

Suggested API shape:

```ts
interface NoteTableView {
  // Root access
  getTableId(): string;
  getRootSelector(): string;          // "#tblNate"

  // Render/update
  repaint(): void;                    // table-scoped clear + paint
  renderNamedNotes(): void;           // table-scoped selectors only
  renderTableNotes(): void;           // from model.getTableNotes()

  // Interaction wiring
  bindEvents(): void;                 // note clicks, hover, etc.
  unbindEvents(): void;
  setReadOnly(readOnly: boolean): void;

  // Beat visuals
  clearBeatHighlights(): void;
  renderBeatHighlights(beatIndex: number): void; // no-op when disabled by model
}
```

Design intent:
- Model answers what is allowed.
- View enforces how DOM behavior is applied.
- Scoped selector discipline becomes structural, not accidental.

## 3. tableToSection and Friends: How It Changes

Today, tableToSection is proposed as a loose registry.  
With NoteTable model, make it authoritative via a manager.

Recommended companion service:

```ts
interface NoteTableRegistry {
  register(table: NoteTableModel): void;
  get(tableId: string): NoteTableModel;
  getAll(): NoteTableModel[];
  bindTableToSection(tableId: string, sectionIndex: number): void;
  setTableMode(tableId: string, mode: "active" | "observer"): void;

  // Compatibility helpers
  getSectionForTable(tableId: string): Section;
  isObserverTable(tableId: string): boolean;
}
```

Impact:
1. tableToSection becomes an implementation detail of registry.
2. Existing helper functions can remain temporarily as facades:
   - getSectionForTable(tableID) delegates to registry.
   - isObserverTable(tableID) delegates to registry.
3. Call sites stop depending on getCurrentSection for table-scoped operations.

## 4. Re-triage Under New Beat Rule (Observer Tables: No Recorded Beats)

This changes severity and removes one major complexity branch.

### P0 (Foundation)
- Introduce NoteTableModel + NoteTableRegistry.
- Bind each table to section + mode.
- Keep legacy function wrappers so migration is incremental.

### P1 (Selector isolation pass)
- Still high-priority and still necessary.
- Every paint/highlight/clear selector becomes table-root-prefixed.

### P2 (Read-only interaction gate)
- Observer tables skip click binding entirely.
- Optional UI affordance: cursor/default + subtle muted class.

### P3 (Section routing for note position + named notes)
- Note position reads table-bound section.
- NamedNotes also read table-bound section (shared semantics preserved).

### P4 (Recorded beats isolation, revised)
Because observer tables do not render beats from other sections:
- Cross-section beat mapping complexity is removed.
- Each table only supports beat rendering/recording when mode is active and beat-enabled.
- For active tables, recorded beats must remain originating-table specific.

This keeps your “real guitarist/player isolation” intact.

## 5. Recorded Beats: Exact Model Rule Set (V3)

Your sticky point becomes a clear policy contract:

1. Section timelines are independent.
2. Observer tables never show beat playback.
3. Active table beat playback uses only:
   - bound section timeline
   - notes tagged with that same tableId

So yes, recorded note payload should include table ownership:

```ts
type RecordedBeatNote = {
  midinum: number;
  row: number;
  styleNum: number;
  noteName?: string;
  tableId: string; // required
};
```

Read filter:
- renderBeatHighlights(tableId, beatIndex):
  - get section via registry
  - get beat notes for beatIndex
  - filter where note.tableId === tableId
  - render table-scoped

Write rule:
- Recording functions must stamp tableId from origin table.

This is the key model hardening for multiplayer-style isolation.

## 6. Suggested Migration Order (Low-Risk)

1. Introduce NoteTableModel + Registry with no behavior change yet.
2. Add tableId to recorded beat note payload at write points.
3. Implement table-scoped selector pass (existing attack map).
4. Route table note/named note reads through registry section binding.
5. Enforce observer read-only by event binding gate.
6. Disable observer beat rendering path.
7. Remove remaining direct getCurrentSection table-level reads.

## 7. Final Assessment

Yes, this is the right moment for a NoteTable class boundary.

- A single NoteTable model + NoteTable view pairing is sufficient for V1.
- You do not need a heavier framework split yet.
- tableToSection should evolve into NoteTableRegistry-owned state.
- Recorded beats need explicit table ownership in payload.
- NamedNotes staying shared by section is coherent and aligns with your musical intent.

If useful, next step can be a concrete “API contract draft” in code terms for song.js, notetable.js, and section-recorder.js showing exact function signatures to migrate first.

## 8. V3.1 Runtime Binding and Persistence Revision

This addendum reflects the new assumptions:
- Song remains authoritative for live Section objects.
- NoteTableModel persists `relativeSection` (empty string means current section).
- Observer tables are read-only and do not render recorded beats.

### 8.1 What Section references look like at runtime

Current runtime behavior in Song:
- `getRelativeSectionWithWrap(sAmount)` returns a live Section object reference from `song.sections[index]`.
- `getRelativeSectionIndexWithWrap(sAmount)` returns a number index by `song.sections.indexOf(section)`.

So both forms exist now:
- object reference (for immediate use)
- numeric index (for routing and persistence-friendly contracts)

Recommendation for NoteTableModel:
- Persist only `relativeSection` as a string (`""`, `"^2"`, `"&1"`, `"@1"`, etc.).
- Resolve target section on demand through Song each time (`getRelativeSectionIndexWithWrap`).
- Avoid persisting absolute indices or object pointers.

### 8.2 What happens when Sections are moved/added/loaded

Current Song behavior:
- `moveSectionTo` and `moveSectionToEND` reorder the same Section objects (identity preserved, array positions changed).
- `insertSectionAtDest` inserts a Section object in the array.
- `graveyard.raise` currently revives by adding a Section to Song (append path today).
- file load (`addSections`) revives plain objects into `Section` instances.

Implications for NoteTable binding:
- If NoteTable stores `relativeSection` strings, no rebasing step is needed when sections move.
- If NoteTable stores absolute indices, indices must be rebased on every move/insert/delete.
- If NoteTable stores object pointers, persistence is awkward and reload semantics are brittle.

Best-fit rule:
- store spec (`relativeSection`) in NoteTableModel
- resolve live target section/index at runtime through Song

### 8.3 Updated NoteTableModel API for section binding

```ts
interface NoteTableModel {
  getTableId(): string;
  getRelativeSection(): string;              // "" means current section
  setRelativeSection(spec: string): void;   // "", "^2", "&1", "@1", "2", ...

  resolveSectionIndex(song: Song): number;  // delegates to song.getRelativeSectionIndexWithWrap(spec)
  resolveSection(song: Song): Section;      // delegates to song.getRelativeSectionWithWrap(spec)

  isObserver(): boolean;                    // derived: relativeSection !== "" (or explicit mode)
  allowsCellEditing(): boolean;             // false for observer
  allowsBeatPlayback(): boolean;            // false for observer (per product rule)
  allowsBeatRecording(): boolean;           // false for observer
}
```

### 8.4 Persistence ownership options for played vs recorded notes

Your proposal is strong:
- move per-table played notes into `playedNotes`
- move beat recordings under table ownership

Two viable schemas:

Option A (minimal migration):
- keep `sections[].noteTables[tblId]` as played notes array
- keep `sections[].recordedNotes[beat]` but require each note to include `tableId`

Option B (domain-clean target):
- `sections[].noteTables[tblId]` becomes an object:

```json
{
  "playedNotes": [],
  "recordedNotes": {
    "1": [],
    "2": []
  }
}
```

Recommendation:
- Implement Option A first to isolate behavior quickly with low risk.
- Plan Option B as V2 schema once NoteTableModel/Registry is in place.

Reason:
- Option A touches fewer call sites and keeps current save/load shape mostly intact.
- Option B is cleaner long-term and aligns with NoteTable ownership boundaries.

### 8.5 Suggested persisted song-file shape for table metadata

Add a root-level block owned by NoteTableModel/Registry:

```json
"noteTableModels": {
  "tblNate": { "relativeSection": "",   "caption": "Nate", "enabled": true },
  "tblMyra": { "relativeSection": "^2", "caption": "Myra", "enabled": true },
  "tblLar":  { "relativeSection": "&1", "caption": "Lar",  "enabled": true }
}
```

Notes:
- `visibleNoteTables` can remain for backward compatibility during migration.
- At runtime, registry can treat `noteTableModels` as authoritative and derive visibility.

### 8.6 Recorded-note isolation contract (updated)

Regardless of Option A or B:
- recorded note payload must carry `tableId`
- read path must filter by current table
- observer tables skip beat rendering entirely

That preserves:
- per-player beat isolation
- shared NamedNotes semantics for same-section collaborators

## 9. Concrete Schema Migration Contract

This contract is written as an implementation checklist with explicit compatibility rules.

### 9.1 Schema stages

**Decision: no transitional S1 stage.** Introducing tableId inside legacy recorded notes at S1 would create a dependency that tests would later need to undo, causing brittle failures on S2 removal. Instead: cut directly S0 → S2 under tight Git commits with Jest + UI acceptance gates at each boundary.

Stage S0 (current):
- sections[n].noteTables[tblId] is a flat array of played notes.
- sections[n].recordedNotes[beat] is a flat array of recorded notes; no tableId field.
- visibleNoteTables is persisted at root level.

Stage S2 (target — one-step cut):
- sections[n].noteTables[tblId] becomes a table-scoped object:
  - playedNotes: []     (the existing flat note array, renamed)
  - recordedNotes: { "1": [], "2": [] }   (moved from section level)
- Section-level recordedNotes key is removed entirely on first S2 save.
- Root noteTableModels dictionary is introduced.
- saveSchemaVersion: 2 written at root.

### 9.2 Canonical persistence fields

Root level:
- noteTableModels: dictionary keyed by tableId
  - relativeSection: string (empty string means current section)
  - caption: string
  - enabled: boolean

Section level:
- namedNotes remains section-shared.
- noteTables remains keyed by tableId.

Recorded note payload contract (S2):
- tableId is required. It is implicit in the storage location (the note lives under its owning table), so the field need not be stored redundantly in the note payload — but the read path must be told which table scope it is operating in.
- Existing fields midinum, row, styleNum, noteName remain unchanged.

### 9.3 Load-time migration contract

Entry point:
- Song.makeSongFromData calls addSections.
- addSections normalizes each section through Section.revive.

Required load normalizers:

1. normalizeSongTableModels(songData)
- If noteTableModels exists, validate and keep.
- If missing, synthesize from visibleNoteTables with defaults:
  - relativeSection: ""
  - caption: derived from table id suffix or empty
  - enabled: true

2. normalizeSectionNoteTables(section)
- S0 shape: if section.noteTables[tblId] is an array, lift it into S2 shape:
  { playedNotes: <that array>, recordedNotes: {} }
- S2 shape: if section.noteTables[tblId] is already an object with playedNotes, accept as-is.
- Dual-read support must be retained indefinitely for old songs.

3. normalizeSectionRecordedNotes(section)
- If section.recordedNotes exists (S0 legacy location):
  - contains no tableId; must be distributed into table sub-records.
  - If song has exactly one visible table: move all notes under that table's recordedNotes.
  - If song has multiple visible tables: notes cannot be reliably routed; log warning, do not discard, attach to a special key "_unscoped" for inspection.
  - After distribution, do not remove section.recordedNotes on load; only omit it on S2 save.
- If section.recordedNotes missing or empty: no action needed.

4. observer behavior gate at load
- NoteTableModels with relativeSection not empty are observer tables.
- Observer tables must initialize as:
  - allowsCellEditing: false
  - allowsBeatRecording: false
  - allowsBeatPlayback: false

### 9.4 Save-time writer contract

Entry point:
- Song.prepareForSave remains the orchestrator.

Required save steps:

1. writeNoteTableModels(song)
- Always persist noteTableModels.
- Preserve relativeSection exactly as user set string.

2. writeVisibleTables(song)
- Keep visibleNoteTables during S1 and S2 transition for backward compatibility.

3. writeSectionNoteTables(song)
- Always emit S2 object shape: { playedNotes: [], recordedNotes: {} } per table.
- Do not emit the legacy flat array or section.recordedNotes.

4. writeRecordedNotes(song)
- Recorded notes live under sections[n].noteTables[tblId].recordedNotes.
- Do not write section.recordedNotes at all on S2 save.
- If _unscoped notes from load-time distribution are present, log warning and drop them at save time (they were already surfaced as a diagnostic on load).

5. schema marker
- Write saveSchemaVersion: 2 at root on every S2 save.

### 9.5 Runtime resolver contract for relativeSection

Rule:
- NoteTableModel stores relativeSection string, not absolute index and not section pointer.

Resolver API behavior:
- resolveSectionIndex(song):
  - if relativeSection is empty, return song.getSectionsCurrentIndex().
  - else return song.getRelativeSectionIndexWithWrap(relativeSection).

- resolveSection(song):
  - if relativeSection is empty, return song.getCurrentSection().
  - else return song.getRelativeSectionWithWrap(relativeSection).

Why this survives section moves:
- moveSectionTo and moveSectionToEND only reorder song.sections.
- relativeSection specs are recalculated against current index each time, so no rebase bookkeeping is needed.

### 9.6 Function-level implementation map

Song module:
- initializeSongState:
  - add noteTableModels field default {}.
- addSections and makeSongFromData path:
  - call normalizeSongTableModels after loading data.
  - keep Section.revive normalization.
- prepareForSave:
  - include writeNoteTableModels and saveSchemaVersion.

Section module:
- Section.revive:
  - Accept both S0 (flat array) and S2 (playedNotes object) shapes for noteTables entries.
  - After normalization, internal representation is always S2 shape.
  - Retain legacy section.recordedNotes in memory after load for distribution; never write it back.

Recorder module:
- recordHighlight, recordHighlightSingle, recordPlayedNote:
  - require origin tableId parameter; write into section.noteTables[tableId].recordedNotes.
  - do not write into section.recordedNotes.
- recordingHasPlayedNote and unRecordPlayedNote:
  - read from section.noteTables[tableId].recordedNotes.
  - do not touch section.recordedNotes.

Paint/render path:
- beat render functions must accept tableId and filter by note.tableId.
- observer tables skip beat rendering entirely.

### 9.7 Test contract (must-pass gates)

Load tests:
- S0 song with single visible table: recorded notes moved into that table's recordedNotes.
- S0 song with multiple visible tables: recorded notes appear in _unscoped, warning is logged.
- S0 song: noteTables flat array lifted to { playedNotes, recordedNotes } per table.
- S2 song: loaded without mutation.
- noteTableModels missing: synthesized from visibleNoteTables with relativeSection "".

Save tests:
- prepareForSave on S2 song: does not emit section.recordedNotes.
- prepareForSave on S2 song: emits noteTableModels and saveSchemaVersion: 2.
- Round-trip: load S2, save, re-load, sections match original.

Runtime tests:
- table with relativeSection "" tracks current section.
- table with relativeSection spec resolves through getRelativeSectionIndexWithWrap.
- after moveSectionTo or insertSectionAtDest, resolved targets remain semantically correct.
- observer table: allowsCellEditing, allowsBeatRecording, allowsBeatPlayback are all false.
- active table: beat render function receives only notes from table's own recordedNotes.

### 9.8 Migration rollout recommendation

No S1 stage. Migration is a single atomic cut under Git discipline.

Pre-cut:
- All Jest tests passing.
- UI acceptance baseline established.
- Git commit: "S0 baseline before S2 migration".

Cut:
- Implement normalization, recorder, and save changes in one branch.
- Tests rewritten to match S2 contracts from section 9.7.
- Git commit: "S2 schema: table-scoped playedNotes and recordedNotes".

Post-cut gates:
- All Jest tests passing with S2 shapes.
- UI acceptance rerun.
- Round-trip load/save verified on existing song files.
- S1 reader retained as dual-read for S0 files indefinitely.
- S0 reader (flat array) retained indefinitely.

### 9.9 Implementation task list for section 9.6 (execution order)

These tasks are ordered to keep the test suite green at each commit boundary.
Tasks in the same group may be implemented together in one commit.

**Group A: Normalize entry point and data shapes**

A1. Section.revive — add dual-read for noteTables entries
- File: Section.js
- If section.noteTables[tblId] is an array, convert to { playedNotes: <array>, recordedNotes: {} }.
- If already an object with playedNotes, accept as-is.
- Ensure toleration of missing playedNotes and recordedNotes keys (supply empty defaults).
- Test: Section.revive with S0 array shape → yields S2 object shape.
- Test: Section.revive with S2 object shape → unchanged.

A2. normalizeSongTableModels — synthesize noteTableModels from visibleNoteTables
- File: song.js
- New function: normalizeSongTableModels(fileObj)
- If fileObj.noteTableModels exists: validate, keep.
- If missing: for each tableId in fileObj.visibleNoteTables: create entry { relativeSection: "", caption: "", enabled: true }.
- Call from makeSongFromData after addSections.
- Test: S0 file load → noteTableModels synthesized with correct keys.
- Test: S2 file load → noteTableModels loaded without mutation.

A3. normalizeSectionRecordedNotes — distribute legacy section.recordedNotes
- File: song.js (called from addSections normalization)
- For each section: if section.recordedNotes has entries:
  - determine visibleNoteTables at load time.
  - single table: distribute all recorded notes into that table's recordedNotes.
  - multiple tables: attach notes to _unscoped key, log console.warn.
  - leave section.recordedNotes in memory; do not delete it here.
- Test: S0 single-table song → notes in table.recordedNotes, section.recordedNotes stays in memory.
- Test: S0 multi-table song → notes in _unscoped, console.warn emitted.

**Group B: Persistence write path**

B1. Song.prepareForSave — emit S2 structure
- File: song.js
- Add noteTableModels to the save object.
- Add saveSchemaVersion: 2.
- Do not emit section.recordedNotes.
- Test: prepareForSave on S2 model → JSON has noteTableModels and saveSchemaVersion.
- Test: prepareForSave on S2 model → no section.recordedNotes key.

B2. Song.prepareForSave — write per-table structure
- File: song.js
- Each section.noteTables[tblId] saved as { playedNotes, recordedNotes } object.
- Test: round-trip S0 load → prepareForSave → re-load → noteTables have playedNotes arrays.

**Group C: Recorder write path**

C1. recordHighlight, recordHighlightSingle, recordPlayedNote
- File: section-recorder.js
- Add tableId parameter.
- Write into section.noteTables[tableId].recordedNotes[beat] instead of section.recordedNotes[beat].
- Create noteTables[tableId] entry if missing, using S2 shape.
- Test: record a note → appears in table.recordedNotes, not in section.recordedNotes.

C2. recordingHasPlayedNote, unRecordPlayedNote
- File: section-recorder.js
- Add tableId parameter.
- Read/filter from section.noteTables[tableId].recordedNotes.
- Test: lookup for note in correct table → found. Lookup in wrong table → not found.

C3. getRecordedNotesForSection
- File: section-recorder.js
- Add tableId parameter; return section.noteTables[tableId].recordedNotes.
- Maintain backward-compatible variant or update all callers.
- Test: returns correct beat map for specified table.

**Group D: Render/beat path**

D1. showHighlightsForBeat (or equivalent beat display function)
- File: notetable.js
- Add tableId parameter.
- Read beats from table.recordedNotes instead of section.recordedNotes.
- Observer table: returns without rendering (check allowsBeatPlayback on registry).
- Test: beat 3 with two tables → each table renders only its own notes.

D2. Beat-position management functions (moveBeatsLater, deleteBeat)
- File: song.js
- Update to read/write from table.recordedNotes.
- Must iterate all tables in section when shifting beats, preserving per-table structure.
- Test: moveBeatsLater → all table beats shift correctly.
- Test: deleteBeat → correct beat removed per table.

**Group E: NoteTableModel / Registry**

E1. NoteTableModel class
- New file: NoteTableModel.js (or inline in a registry module).
- Properties: tableId, relativeSection (string), caption, enabled.
- Methods: resolveSectionIndex(song), resolveSection(song), isObserver(), allowsCellEditing(), allowsBeatRecording(), allowsBeatPlayback().
- Test: relativeSection "" → resolves to current section.
- Test: relativeSection "^2" → resolves through getRelativeSectionIndexWithWrap.

E2. NoteTableRegistry
- New file or companion export in NoteTableModel.js.
- Methods: register(model), get(tableId), getAll(), getSectionForTable(tableId, song), isObserverTable(tableId).
- Test: registry returns correct model by tableId.
- Test: getSectionForTable delegates to model.resolveSection.

**Group F: NoteTableView wiring**

F1. installTDNoteClick and installRBColorChangeEvents
- File: infinite-neck.js
- Skip event binding for tables where registry.isObserverTable is true.
- Test: observer table has no click handler; active table does.

F2. repaint / clearAll / colorNote scoping
- Files: notetable.js, infinite-neck.js
- Thread tableId parameter through repaint-chain functions (see selector attack map from Phase 1).
- Observer tables: repaint reads section from registry but does not fire click events.

# Commit Phase Tracker (refactor/NoteTableModel)

This is the authoritative execution order for this branch.

Important clarification:
- S0 is the starting state, not an implementation phase.
- S2 is the schema cut and should be implemented together with P4.

Recommended sequence:

1. Phase A (P0): Foundation and no-behavior-change wiring
- Introduce NoteTableModel and NoteTableRegistry scaffolding.
- Add minimal adapters/facades so existing call paths still work.
- Commit message suggestion: `P0 foundation: NoteTableModel/Registry scaffolding`.

2. Phase B (P1): Selector scoping pass
- Make selectors table-scoped across paint/repaint/highlight paths.
- Keep behavior equivalent except for scoping.
- Product decision from UI review: note highlight behavior (`noteHighlight` and `noteHighlightSingle`) remains global across visible tables for now, matching legacy behavior and musical intent.
- The new optional `tableID` scoping hooks stay in place as groundwork; a future setting may allow single-table highlight mode.
- Deferred note: git tag `multi-MIDI-highlights-introduced` marks the point where multiple recorded MIDI highlights began crossing visible tables.
- Deferred note: non-recorded highlight behavior is acceptable for now, but recorded MIDI highlights across different tables should eventually render with different colors per table; otherwise distinct notes can look falsely identical. Revisit this later rather than folding it into the current phase.
- Commit message suggestion: `P1 selector scoping: table-specific DOM selection`.

3. Phase C (P2 + P3): Read routing and observer behavior
- Route table reads through relativeSection resolution.
- Enforce observer table read-only behavior (no cell edit/click write paths).
- Commit message suggestion: `P2/P3 routing: observer read-only and section binding`.

4. Phase D (S2 + P4): Schema cut and recorded-beat isolation
- Perform the one-step S0 -> S2 migration.
- Move recorded beats under table ownership.
- Remove section-level recordedNotes from save output.
- Implement table-origin beat isolation.
- Commit message suggestion: `S2/P4 schema + beats: table-owned played/recorded notes`.

5. Phase E: Stabilization and cleanup
- Remove temporary adapters that are no longer needed.
- Finalize tests, docs, and any migration warnings.
- Commit message suggestion: `stabilize: cleanup adapters, finalize tests/docs`.

Per-phase gate policy:
- Green Jest before commit.
- UI acceptance check for affected behavior before commit.
- Keep commits narrow and phase-specific.

