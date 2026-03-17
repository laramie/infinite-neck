# MVC Separations for NoteTable as Object

## Document Version
- version: V3

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


## 5. View vs Controller: Clarifications and UI State Handling

- **View:** Only renders, binds events, and delegates to Controller. No model mutation.
- **Controller:** Handles all user actions, updates Model, and tells View to repaint.
- **Palette values:** Should be managed in Controller, not View, and only passed to Model when needed.
- **jQuery:** All event binding and DOM manipulation in View; all business logic in Controller.

### Handling of View/UI State (displayOptions)

Currently, UI state such as font sizes, cell dimensions, opacity, etc., is round-tripped between the UI controls and the CSS var layer using functions like `displayOptionsToControls(options)` and `controlsToDisplayOptions()`. These are invoked in:

- `infinite-neck.js :: displayOptionsToControls(options)`
- When a Section becomes current, its `displayOptions` (if present) are applied to the UI via `displayOptionsToControls`.
- When the user clicks a button (e.g., `#btnControlsToDisplayOptions`), the current UI state is captured and stored in the current Section's `displayOptions` property.

**MVC Recommendation:**
- The Model (Section) should own the persistent `displayOptions` object.
- The View should only render controls and read/write their values.
- The Controller should:
  - Listen for UI events (button clicks, control changes).
  - Gather UI state from the View (via a method like `controlsToDisplayOptions()`), and update the Model (Section.displayOptions).
  - When a Section is activated, the Controller should fetch `displayOptions` from the Model and instruct the View to apply them (via `displayOptionsToControls(options)`).
- This keeps the View stateless except for transient UI, and ensures all persistent UI state flows through the Controller.

**Example Flow:**
1. User changes a control (e.g., font size slider).
2. View notifies Controller of the change.
3. Controller updates Model (Section.displayOptions).
4. When Section changes, Controller fetches displayOptions and tells View to update controls and CSS vars.

---


## 6. Recommendations and Palette/Controller Orchestration
- Refactor event handlers out of jQuery callbacks in View classes into dedicated Controller classes.
- Keep all jQuery in View classes; Controllers should be UI-agnostic.
- Use Pub/Sub (EventBus) for decoupling Controllers and Views where needed.
- For headless use (Jest, CLI, batch), interact only with Model and Controller layers, never Views.
- Document event flows and Controller responsibilities for maintainability.

### Palette and Complex UI Rule Handling

**Current Pattern:**
- Palette radio buttons and checkboxes are manipulated by user actions and by rules (e.g., clicking a Dropper note, toggling cbAutomaticColor).
- The resulting palette state determines what happens when a user creates a Note.
- Some palette state is transient and not persisted, but is critical for correct UI feedback and note creation.

**MVC Recommendation:**
- The View should only render palette controls and highlight/activate them as instructed.
- The Controller (PaletteController) should:
  - Listen for all palette UI events (radio/checkbox changes, cell clicks).
  - Maintain the current palette state (in memory, not in the Model unless persistence is needed).
  - Apply UI rules: e.g., when idDropper is selected and a Dropper note is clicked, determine which palette radio should be highlighted, and instruct the View to update highlights.
  - When cbAutomaticColor is checked, Controller should update palette state, deselect color radios, and select idRTransparent, then instruct the View to update the UI accordingly.
  - When a table cell is clicked, Controller should use the current palette state to determine what Note to create, update the Model, and request a View repaint.

**Example Flow for Dropper:**
1. User clicks idDropper radio (View notifies Controller).
2. User clicks a Dropper note cell (View notifies Controller with cell/note info).
3. Controller determines which color radio should be highlighted based on note properties.
4. Controller instructs View to highlight the correct radio button.

**Example Flow for cbAutomaticColor:**
1. User checks cbAutomaticColor (View notifies Controller).
2. Controller updates palette state, deselects color radios, selects idRTransparent.
3. Controller instructs View to update radio button highlights.

---


## 7. Example: Cell Click and Palette Flow (MVC)

### Cell Click Flow
1. **User clicks cell** (View: NoteTableView binds click event).
2. **View delegates to Controller** (NoteTableController.handleCellClick(cell, paletteState)).
3. **Controller updates Model** (NoteTable.addNote(...)).
4. **Controller requests View update** (NoteTableView.repaint()).

### Palette/Dropper/AutomaticColor Flow
1. **User clicks palette control** (View notifies PaletteController).
2. **PaletteController updates palette state and applies UI rules.**
3. **PaletteController instructs View to update highlights, disables, etc.**
4. **User clicks table cell** (View notifies NoteTableController with current palette state).
5. **NoteTableController uses palette state to create/update Note in Model.**
6. **Controller requests View update.**

---

## 8. Open Questions
- Should Controllers be classes or modules? (Classes recommended for testability and stateful workflows.)
- How to best structure Controllers for batch/CLI use?
- How to keep Palette and other transient UI state out of the Model?

---

## References
- [notetable-as-real-object-planning.md](notetable-as-real-object-planning.md)
- [notetable-as-real-object.md](notetable-as-real-object.md)
