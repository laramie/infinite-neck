# sprint-140-tool-notesource Analysis

## Scope and assumptions

This is a design-only analysis with no code edits.

Assumptions based on current behavior:
- Tool windows are driven by tuning.Tool and use persisted layout options from Song.noteTablesLayout via ToolDisplayOptions.
- Tool windows are intended to be informational only (no user click-note editing).
- Fill behavior already exists in FillPlugin and is mature, with broad Jest coverage.
- Existing FillPlugin behavior for normal instruments must remain stable.

## Decision criteria

1. Backward compatibility for current FillPlugin users.
2. Ability to drive many Tool tables with different settings.
3. Persistence clarity in song data.
4. UI/command complexity.
5. Testability and maintenance cost.
6. Path for adding non-Fill note algorithms later.

## Option 1: Extend FillPlugin with multi-instrument targeting

### Summary

Keep one FillPlugin, add an Instruments menu that manages a target list, and store a per-target fill settings object.

### What coding changes would likely look like

Data model and persistence:
- Extend plugin state schema in FillPlugin persistence to hold:
  - target table list.
  - per-target fill settings override.
  - optional default profile used when a target has no override.
- Keep existing single-instrument properties as a compatibility facade so old songs still load and old commands still work.

Plugin and command wiring:
- Add Instruments submenu to FillPlugin command UI:
  - add target from MyTunings.
  - remove target.
  - select current target profile.
  - edit selected target profile with current FillPlugin controls.
- Add run commands:
  - fill selected target.
  - fill all targets.
  - clear FillPlugin-owned notes for selected target or all targets.

Execution behavior:
- Iterate targets and run the existing fill algorithm per target.
- Resolve section key, note functions, and AutoColor per section exactly as current FillPlugin does.
- Enforce ownership markers so cleanup stays precise.

Likely files touched in implementation:
- [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)
- [NoteTableController.js](NoteTableController.js)
- [Song.js](Song.js)
- [SongPersistence.js](SongPersistence.js)
- [plugins/registerPlugins.js](plugins/registerPlugins.js) only if plugin init contracts change
- [infinite-neck.js](infinite-neck.js) only if Tool-specific trigger plumbing is added
- [_tests/jest/fill-plugin.test.js](_tests/jest/fill-plugin.test.js)
- new tests under [_tests/jest/](_tests/jest/) as needed

### Benefits

- Lowest conceptual change: reuse known FillPlugin behavior.
- Fastest route to working Tool notesource.
- Fewer new abstractions to teach users.

### Risks

- FillPlugin UI could become crowded.
- Increased state complexity inside one plugin may reduce maintainability.
- If not carefully isolated, normal instrument fill flows could regress.

### Compatibility strategy

- Keep legacy FillPlugin properties as first-class inputs.
- Auto-migrate old state to one default target profile in memory on load.
- Persist in new format only after explicit user edit, or support dual-read for a transition period.

## Option 2: New Notesource plugin with per-instrument strategy objects

### Summary

Create a separate Notesource plugin that owns a list of driven instruments and, for each instrument, a provider config object. One provider type can be Fill-style logic; others can be added later.

### What coding changes would likely look like

Architecture:
- Add Notesource plugin module that manages:
  - target instruments list.
  - strategy type per target, such as Fill.
  - strategy config payload per target.
- Define a small provider interface:
  - produce notes for section plus target table.
  - optional validate and normalize config.
  - optional summary text for UI.

Fill integration:
- Either:
  - call into extracted Fill algorithm helper from FillPlugin, or
  - duplicate Fill logic initially (not recommended).
- Prefer extraction to avoid divergence.

Persistence:
- Persist Notesource state separately from FillPlugin state.
- Keep FillPlugin untouched for existing instrument workflows.

Likely files touched in implementation:
- new plugin folder under [plugins/](plugins/)
- [plugins/registerPlugins.js](plugins/registerPlugins.js)
- [Song.js](Song.js)
- [SongPersistence.js](SongPersistence.js)
- [infinite-neck.js](infinite-neck.js) if Tool startup invokes notesource refresh
- tests in [_tests/jest/](_tests/jest/) for Notesource plugin and provider contracts

### Benefits

- Clean separation of concerns.
- Better long-term extensibility for non-Fill generators.
- Reduced risk of destabilizing FillPlugin.

### Risks

- Highest initial implementation effort.
- Requires extracting shared algorithm or accepting temporary duplication.
- More plugin surface area for users to learn.

### Compatibility strategy

- No migration required for existing FillPlugin users.
- Tool users adopt Notesource explicitly.

## Option 3: Shared NoteSource Engine plus thin plugin adapters (recommended)

### Summary

Create a reusable notesource engine and keep plugin roles clear:
- FillPlugin remains user-facing for normal instrument fill workflows.
- ToolNoteSource plugin (or Tool wiring layer) manages Tool-target orchestration.
- Both consume the same engine profiles, including Fill profile type.

This gives Option 1 speed for Fill logic reuse and Option 2 extensibility without forcing all concerns into one plugin.

### What coding changes would likely look like

Core extraction:
- Extract deterministic Fill note generation into a pure module, for example a notesource engine package under plugins.
- Define profile schema for Fill-like behavior and section context inputs.

Adapter layers:
- FillPlugin becomes a thin adapter that maps its current command state to engine profile and writes results.
- ToolNoteSource adapter maps per-tool target config to the same engine profile and writes results to Tool tables.

Persistence:
- Persist Tool-target notesource config in a Tool-focused place, likely on noteTablesLayout entry extension or plugin-owned persisted state.
- Keep FillPlugin persistence schema backward-compatible.

Likely files touched in implementation:
- [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js)
- new shared engine modules under [plugins/](plugins/)
- new Tool notesource plugin module under [plugins/](plugins/)
- [Song.js](Song.js)
- [SongPersistence.js](SongPersistence.js)
- [infinite-neck.js](infinite-neck.js)
- test suites for engine and adapter integration in [_tests/jest/](_tests/jest/)

### Benefits

- Best long-term architecture.
- Avoids algorithm drift between Fill and Tool notesources.
- Keeps existing FillPlugin user experience mostly intact.
- Supports future providers beyond Fill through profile or strategy expansion.

### Risks

- Moderate upfront refactor required.
- Requires careful ownership and cleanup semantics to avoid cross-plugin note collisions.

## Comparative view

- Lowest short-term effort: Option 1.
- Lowest regression risk to existing FillPlugin users: Option 2.
- Best long-term balance of extensibility and reuse: Option 3.

## Suggested recommendation

Recommend Option 3 with phased delivery:

Phase 1:
- Extract shared Fill note-generation engine and prove parity with current FillPlugin via Jest snapshot/behavior tests.

Phase 2:
- Add Tool-target orchestration using engine profiles for at least Perfect4thsCalculator and one chart-rooted chord use case.

Phase 3:
- Add UX polish for per-target profile editing and presets.

This sequence reduces risk by establishing algorithm parity first, then adding orchestration.

## Migration and data-shape notes

For Tool windows, store notesource config near table identity so behavior follows the table:
- candidate: Song.noteTablesLayout entry extension, for example a Tool-specific notesource object.

General compatibility guidance:
- Read old shapes and normalize in memory.
- Write stable normalized shape.
- Keep strict ownership tags for generated notes to support precise clear/refresh behavior.

## Testing strategy outline

1. Engine parity tests against current FillPlugin outputs for representative keys, roots, and section contexts.
2. Multi-target tests to verify isolated per-table config and no cross-target contamination.
3. Persistence round-trip tests for old and new state shapes.
4. Tool-table behavior tests confirming informational-only behavior and no click-note side effects.
5. Cleanup tests validating owner-scoped note removal.

## Open questions to resolve before implementation

1. Where should Tool notesource config persist: noteTablesLayout entry, plugin state, or both?
2. Should Tool refresh be automatic on section/key change, or command-triggered?
3. Should per-target profiles inherit from a global default profile?
4. How should UI present many targets without overloading command menus?
5. Should FillPlugin eventually support importing/exporting profiles shared with Tool notesource?

## Final recommendation in one line

Adopt Option 3 (shared engine plus adapters), because it minimizes long-term duplication while preserving existing FillPlugin behavior and enabling scalable Tool notesource growth.
