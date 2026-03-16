# MVC Separations for NoteTable as Object

## Document Version
- version: V2

## Introduction
This document analyzes the concrete separation of Model, View, and Controller responsibilities for the evolving NoteTable architecture, referencing the design in notetable-as-real-object-planning.md and the current codebase. It addresses where Controller logic should reside, clarifies View vs Controller boundaries, and maps current and future class responsibilities.

---

## 1. Model Layer

### Core Model Classes
- **Song**: Holds Sections, manages LayoutManager, orchestrates playback, and exposes methods for navigation (next/prev Section/Beat).
- **Section**: Contains NoteTable instances, manages RecordedBeats, exposes methods to get/set NoteTables and Notes.
- **NoteTable**: Represents an instrument, holds Notes, Tuning, Section reference, and state (observerType, isListener, etc.).
- **Note**: Domain object for a musical note.
- **LayoutManager / Layout / ResponsivePattern**: Manage which NoteTables are visible, their arrangement, and layout rules.
- **TableBuilder**: Factory for NoteTable objects.

### Model Responsibilities
- Hold all persistent and domain state.
- Expose methods for mutation and querying (e.g., addNote, setTuning, getObservedNotes).
- No direct knowledge of UI or jQuery.

---

## 2. View Layer

### Concrete View Classes
- **NoteTableView**: Renders a NoteTable as HTML, handles repainting, emits DOM for cells, rows, and controls.
- **LayoutView** (future): Renders Layouts and ResponsivePatterns, manages container DIVs.
- **PaletteView**: Renders color/note selection palette.
- **TransportView**: Renders transport controls (play, next, prev, etc.).

### View Responsibilities
- Render Model state to the DOM.
- Receive UI events (clicks, changes) and delegate to Controller.
- No direct mutation of Model state.
- All jQuery should be isolated here (event binding, DOM manipulation).

---

## 3. Controller Layer

### Where is the Controller?
- **Current State:**
  - Controller logic is scattered: in infinite-neck.js, menu.js, command-menu.js, keyboard-handler.js, and sometimes in jQuery event handlers within View code.
  - Palette values and UI state are managed in the View/Controller layer, not persisted.

- **Recommended Structure:**
  - **Dedicated Controller Classes/Modules:**
    - **SongController**: Handles user actions affecting Song (navigation, playback, section/beat changes).
    - **NoteTableController**: Handles cell clicks, note creation, and updates to NoteTable/NoteTableView.
    - **PaletteController**: Handles palette selection, color/note type application.
    - **TransportController**: Handles transport UI events.
  - Controllers receive events from Views, update Models, and trigger View updates (repaint, etc.).
  - Controllers should not directly manipulate the DOM or hold persistent state.

### Controller Responsibilities
- Orchestrate user actions: receive events from Views, update Models, and request View updates.
- Mediate between Model and View, ensuring separation.
- Contain all imperative logic for user workflows.

---

## 4. Mapping Current Patterns to MVC

| Current File/Class         | Future Role         | Notes |
|---------------------------|---------------------|-------|
| infinite-neck.js          | Controllers, App Init | Move orchestration logic to Controllers |
| menu.js, command-menu.js  | Controllers         | Menu/command handling logic |
| keyboard-handler.js       | Controllers         | Keyboard event handling |
| notetable.js              | Model, Controller   | Move procedural logic to Model/Controller |
| NoteTableView             | View                | All rendering, jQuery here |
| TableBuilder              | Model (Factory)     | No UI logic |

---

## 5. View vs Controller: Clarifications
- **View:** Only renders, binds events, and delegates to Controller. No model mutation.
- **Controller:** Handles all user actions, updates Model, and tells View to repaint.
- **Palette values:** Should be managed in Controller, not View, and only passed to Model when needed.
- **jQuery:** All event binding and DOM manipulation in View; all business logic in Controller.

---

## 6. Recommendations
- Refactor event handlers out of jQuery callbacks in View classes into dedicated Controller classes.
- Keep all jQuery in View classes; Controllers should be UI-agnostic.
- Use Pub/Sub (EventBus) for decoupling Controllers and Views where needed.
- For headless use (Jest, CLI, batch), interact only with Model and Controller layers, never Views.
- Document event flows and Controller responsibilities for maintainability.

---

## 7. Example: Cell Click Flow (MVC)
1. **User clicks cell** (View: NoteTableView binds click event).
2. **View delegates to Controller** (NoteTableController.handleCellClick(cell, paletteValue)).
3. **Controller updates Model** (NoteTable.addNote(...)).
4. **Controller requests View update** (NoteTableView.repaint()).

---

## 8. Open Questions
- Should Controllers be classes or modules? (Classes recommended for testability and stateful workflows.)
- How to best structure Controllers for batch/CLI use?
- How to keep Palette and other transient UI state out of the Model?

---

## References
- [notetable-as-real-object-planning.md](notetable-as-real-object-planning.md)
- [notetable-as-real-object.md](notetable-as-real-object.md)
