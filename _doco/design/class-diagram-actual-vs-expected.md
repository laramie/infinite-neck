# Actual vs Expected Class Diagram

Below is a Mermaid class diagram showing the actual classes and relationships found in the codebase, as discovered by spelunking from the main entry points (infinite-neck.js::appInit and _tests/jest/song-api-load.test.js). This diagram is suitable for comparison with the expected diagrams in class-diagram.md and note-types-class-diagram.md.

- This diagram reflects only actual JavaScript classes and their relationships as found in the codebase, omitting legacy, utility, and provider-pattern modules.

```mermaid
classDiagram
    class Song {
        +constructor()
        +sections
        +noteTableRegistry
        +addSection()
        +getSections()
        +getCurrentSection()
        +getNoteTableRegistry()
    }
    class Section {
        +constructor(rootID, sharps, beats)
        +noteTables
    }
    class NoteTableModel {
        +constructor(tableId, relativeSection, caption, enabled)
    }
    class NoteTableRegistry {
        +constructor()
        +NoteTableModel[] models
    }
    class Note {
        +constructor(noteNameOrOther, styleNum)
    }
    class TableBuilder

    Song "1" o-- "*" Section : contains
    Song "1" o-- "1" NoteTableRegistry : has
    NoteTableRegistry "1" o-- "*" NoteTableModel : manages
    Section "1" o-- "*" NoteTableModel : contains
    NoteTableModel "1" o-- "*" Note : uses
```
