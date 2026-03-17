# Actual vs Expected Class Diagram

Below is a Mermaid class diagram showing the actual classes and relationships found in the codebase, as discovered by spelunking from the main entry points ( infinite-neck.js::appInit and _tests/jest/song-api-load.test.js which calls infinite-neck.js::setupSongTests() ). This diagram is suitable for comparison with the expected diagrams in class-diagram.md and note-types-class-diagram.md in this same directory.

- This diagram reflects only actual JavaScript classes and their relationships as found in the codebase, omitting legacy, utility, and provider-pattern modules.

```mermaid
classDiagram
    class Song {
        +sections : Section[]
        +myTunings
        +tunings
        +addSection()
        +addSections()
        +getSections()
        +setHeadless()
        +fixupCurrentIndexForLoadedSong()
        +constructSection()
        +other domain methods...
    }
    class Section {
        +noteTables
        +namedNotes
        +recordedNotes
        +caption
        +rootID
        +rootIDLead
        +beats
        +currentBeat
        +sharps
        +cloneFrom()
        +populateCloneFrom()
    }
    class Note {
        +noteName
        +styleNum
        +static styleNumToCaption()
    }
    class TableBuilder {
        <<static facade>>
        +findTuning()
        +findTuningForName()
        +findTuningForID()
        +buildNoteTable()
        +other static methods...
    }
    class EventBus {
        +on()
        +off()
        +trigger()
    }

    %% Relationships
    Song "1" o-- "*" Section : contains
    Section "1" o-- "*" Note : uses
    Section "1" o-- "*" NoteTable : noteTables
    Song "1" o-- "*" TableBuilder : uses
    Song "1" ..> EventBus : triggers/events
    NoteTable <.. TableBuilder : built by

    %% NoteTable is referenced as a class-like module in notetable.js
    class NoteTable {
        <<module pattern>>
        +cellBuilder()
        +buildNamedNote()
        +buildFloatingNotes()
        +buildCellsFromSelector()
        +colorNote()
        +other functions...
    }
```
