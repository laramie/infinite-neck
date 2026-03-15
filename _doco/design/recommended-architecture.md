# Recommended Architecture for Song Class Migration

## Overview

The migration from factory-based pattern to ES6 classes with proper MVC layering should follow a structured sequence. This document outlines the data model shape, layering approach, and step-by-step refactoring sequence to support multiple independent NoteTable instances each viewing separate Sections.

---

## Data Model Shape

### Current State
- Song: Factory function returning object (makeSong)
- NoteTable: View + business logic mix
- Tuning: Implicit in song data
- Dependencies: Provider-based injection

### Target State

```
WorkspaceSession (aggregate root)
├── Song (data model)
│   ├── title, artist, tuning_name
│   ├── Sections[] (immutable collection)
│   │   ├── id, name, notes[], displayOptions
│   │   └── Each section independent
│   └── Looper (state)
│
└── NoteTable instances[] (independent viewports)
    ├── NoteTable_1 → viewing Section[0]
    ├── NoteTable_2 → viewing Section[1]
    └── NoteTable_N → viewing any Section
```

### Key Principles

1. **Song is pure model** — No DOM, no jQuery, no EventBus, no side effects
2. **NoteTable instances are independent** — Each can point to any Section, different zoom levels, different selection state
3. **Tuning is immutable reference** — Loaded once at Song creation, accessible but not mutable during runtime
4. **Sections are the viewport unit** — Each NoteTable "shows" exactly one Section; switching sections = switching active NoteTable or changing target Section

---

## Layering Architecture

### Three-Layer Model

**Layer 1: Domain (Pure Classes)**
```
Song
  - Constructor: (title, artist, tuningName, sections)
  - Properties: title, artist, tuningName, sections (getters)
  - Methods: addSection(section), renameSection(id, name), ...
  - Contract: Zero side effects, zero external dependencies

Section
  - Constructor: (id, name, notes, displayOptions)
  - Properties: id, name, notes[], displayOptions (immutable or copy-on-write)
  - Methods: getNoteAt(index), setNote(index, note), ...
  - Contract: Data container, validation only

NoteTable (model layer)
  - Constructor: (section, tuning, zoomLevel, selectionIndex)
  - Properties: section, tuning, zoomLevel, selectionIndex
  - Methods: selectNote(index), moveSelection(delta), zoomTo(level), ...
  - Contract: State management for a single viewport
```

**Layer 2: Application (Orchestrators/Controllers)**
```
AppController (or SongController)
  - Owns: WorkspaceSession, event bus integration
  - Responsibilities:
    - Route user commands to Song/NoteTable methods
    - Coordinate multi-table updates (e.g., two tables viewing same section need refresh)
    - Emit application events after state changes
  - Contract: Owns the EventBus; translates UI events → domain method calls

WorkspaceSession (aggregate root)
  - Owns: Song instance, Map<NoteTable instances>
  - Responsibilities:
    - Persistence (serialize/deserialize Song + NoteTable states)
    - Consistency (e.g., ensure deleted section isn't still referenced)
  - Contract: Port between app controller and serialization
```

**Layer 3: UI (Views/Adapters)**
```
notetable-view.js (adapter)
  - Input: NoteTable model instance + Section data
  - Output: DOM rendering (table cells, styling, event binding)
  - Responsibilities: Render only, pass UI events back to AppController
  - Contract: No domain logic, no direct Song/Section mutation

infinite-neck.js (composition root + top-level view controller)
  - Responsibilities: Bootstrap, global event binding, coordinate multiple views
  - Contract: Routes everything through AppController
```

### Dependency Flow

```
DOM Event
  ↓
UI Event Handler (infinite-neck.js)
  ↓
AppController.handleUserCommand(cmd, newNoteTable state, etc.)
  ↓
Song/NoteTable domain methods (pure, state immutable or CoW)
  ↓
AppController.emitStateChanged(Song, NoteTable)
  ↓
Views repaint (notetable-view calls render(section, table))
```

---

## Recommended Refactoring Sequence

### Phase 1: Song Class + Compatibility Bridge (Lowest Risk)

**Goal:** Convert Song to real ES6 class while maintaining zero behavior change.

**Steps:**

1. **Create Song class in song.js**
   ```javascript
   export class Song {
     constructor(title, artist, tuningName, sections, looper) {
       this.title = title;
       this.artist = artist;
       this.tuningName = tuningName;
       this._sections = sections.slice(); // defensive copy
       this._looper = looper;
     }
     
     get sections() { return this._sections; }
     get looper() { return this._looper; }
     // ... other accessors and methods
   }
   ```

2. **Create temporary compatibility wrapper**
   ```javascript
   export function makeSong() {
     return new Song(
       DEFAULT_TITLE,
       DEFAULT_ARTIST,
       'C',
       [],
       { /* looper init */ }
     );
   }
   ```

3. **Tests remain unchanged** — makeSong() continues to work; internal implementation switches to class
   - Validation: All 70 tests still pass
   - Behavior: Identical before/after

4. **Merge once tests green**

### Phase 2: NoteTable Model Class

**Goal:** Extract NoteTable state management into independent model class.

**Steps:**

1. **Create NoteTable class (model layer only)**
   ```javascript
   export class NoteTable {
     constructor(section, tuning, zoomLevel = 1, selectedNoteIndex = 0) {
       this.section = section;
       this.tuning = tuning;
       this.zoomLevel = zoomLevel;
       this.selectedNoteIndex = selectedNoteIndex;
     }
     
     selectNote(index) { /* pure method */ }
     moveSelection(delta) { /* pure method */ }
     // ... viewport state methods
   }
   ```

2. **Create view adapter: notetable-view.js**
   ```javascript
   export function renderNoteTable(container, noteTableModel, section) {
     // Pure rendering from model data
     // No state mutation here
   }
   ```

3. **Keep existing notetable.js as temporary shim** during transition
   - Tests continue to pass
   - Views gradually migrate to notetable-view.js

4. **Merge once tests green**

### Phase 3: App Controller + Orchestration

**Goal:** Extract event orchestration out of infinite-neck.js into proper controller.

**Steps:**

1. **Create AppController class**
   ```javascript
   export class AppController {
     constructor(workspaceSession) {
       this.workspace = workspaceSession;
     }
     
     handleKeyDown(event) { /* route to Song/NoteTable */ }
     handleNoteClick(noteIndex, tableId) { /* update table, emit event */ }
     // ...
   }
   ```

2. **Move handler logic out of infinite-neck.js:** bindDesktopEvents() methods → AppController methods

3. **Infinite-neck.js becomes thin event dispatcher**
   ```javascript
   addEventListener('keydown', (e) => {
     appController.handleKeyDown(e);
   });
   ```

4. **Merge once tests pass**

### Phase 4: EventBus → Constructor Injection Transition (Optional, Lower Priority)

**Goal:** Gradual replacement of EventBus with more explicit domain events.

**Steps:**

1. **Provider pattern already in place** — use as bridge
2. **New classes use constructor injection** for dependencies
3. **Old factories (makeSong, makeGraveyard) continue using providers** as compatibility layer
4. **Slowly migrate event listeners** to callback chains instead of EventBus.on()

---

## Safety Patterns & Risk Mitigation

### Safe Patterns

- ✅ **Provider bridge is good** — Keep it; use to inject into classes during construction
- ✅ **Make Song immutable or copy-on-write** — Prevents accidental mutations from UI layer
- ✅ **Tests first** — Write Song class tests before refactoring infinite-neck.js event binding
- ✅ **Thin adapters** — View classes only render + pass events; no domain logic
- ✅ **Backward-compatible wrappers** — makeSong() and makeGraveyard() can wrap new classes for gradual migration

### Risky Patterns (Avoid)

- ❌ **Don't add DOM refs to Song/Section/NoteTable** — Pure model only
- ❌ **Don't replace EventBus and providers simultaneously** — Do EventBus replacement once class structure is stable
- ❌ **Don't mix Song class and UI refactor in same PR** — Do them separately
- ❌ **Don't remove provider functions during Song class phase** — Keep them; they're the dependency bridge

---

## Validation Checklist

Before each phase merge:

- [ ] All 70 existing tests pass (behavior identical)
- [ ] Export audit: 0 unresolved symbols
- [ ] Dependency graph: 0 cycles
- [ ] New classes: Zero DOM references, zero EventBus coupling (enforced by linter or code review)
- [ ] Backward-compatibility wrapper (makeSong, etc.) works
- [ ] Manual smoke test: Load song, switch sections, zoom, edit notes — all same as before

---

## Next Action

**Start with Phase 1: Song Class + Compatibility Bridge**

1. Write Song class skeleton (no methods yet, just structure)
2. Write wrapper makeSong() that returns new Song(...)
3. Update one test to verify it still works
4. Gradually add Song methods (addSection, renameSection, etc.) as-needed
5. Once all tests pass, move to Phase 2 (NoteTable)

**Why this order?**
- Song is foundational; NoteTable and AppController depend on Song working
- Lowest risk (isolated model, no UI coupling)
- Tests validate structure immediately
- Quick dopamine hit → builds confidence for later phases
