# Instrument Observers Sequence Diagram

This document describes the current flow as coded on 2026-05-06.

Key current behavior:

- The page view controls are global DOM state.
- `sectionChanged()` applies the current section `displayOptions` back into those page controls if present.
- `resetNoteNames()` scrapes the page controls and rebuilds all visible tables from one shared current-page options object.
- `replay()` then builds an options array per visible table.
- Relative observers use model data from the observed section for `sharps`, `rootID`, and `rootIDLead`.
- Relative observers also merge display options by calling `controlsToDisplayOptions()` and then `song.getDisplayOptionsInEffect(observedSection, defaultDisplayOptions)`.
- `colorNote()` always creates its lookup context from the current section, even if the clicked cell came from an observer table.

## Looping and Replay


```mermaid
%%{init: {
  "theme": "forest",
  "themeVariables":{"fontSize":"128px","actorFontSize":"128px","messageFontSize":"126px","noteFontSize":"124px"}
}}%%
sequenceDiagram
	autonumber
	actor Looper
	participant Song
	participant App as InfiniteNeck page
	participant Controls as View controls page
	participant NTC as NoteTableController
	participant Current as Section current
	participant Prev as Section observed minus 1
	participant Next as Section observed plus 1
	participant Main as Table main current section
	participant Back as Table observer minus 1
	participant Ahead as Table observer plus 1

	alt Beat advances inside same section
		Looper->>App: showBeats()
		App->>NTC: showHighlightsForBeat(current beat)
		Note over NTC,Back: Relative backward observer uses last beat of observed section
		Note over NTC,Ahead: Relative forward observer uses first beat of observed section
	else Beat reaches section end while section looping
		Looper->>Song: gotoNextSection(true)
		Song-->>Song: change current section index
		Song->>App: Event SongUiClearAndReplaySection
		Song->>App: Event SectionChanged

		App->>App: sectionChanged()
		Current-->>App: currentSection.displayOptions if present
		App->>Controls: displayOptionsToControls(current section displayOptions)
		App->>App: clearAndReplaySection()
		App->>Song: gotoFirstBeat()
		App->>NTC: clearAll()
		App->>App: resetNoteNames()
		Note over App,Controls: resetNoteNames scrapes current page controls
		Note over App,Controls: options include rootID and rootIDLead from current section
		Note over App,Controls: plus showCellNotes, cellIsFunction, showMidiNum
		Note over App,Controls: NoteDisplaySizes, naturalFretWidths, naturalFontScaling
		App->>NTC: buildCells(current sharps, current page options)
		NTC->>Main: buildCellsForTable(current page options)
		NTC->>Back: buildCellsForTable(current page options)
		NTC->>Ahead: buildCellsForTable(current page options)

		App->>NTC: replay()
		NTC->>NTC: getReplayOptionsArray()
		Note right of NTC: baseopts only reads page hide flags
		Note right of NTC: hideNamedNotes
		Note right of NTC: hideTinyNotes
		Note right of NTC: hideSingleNotes
		Note right of NTC: hideFingering

		NTC->>Song: getVisibleTunings and wirings
		NTC->>Current: read current section model for SELF
		NTC->>Song: getRelativeSectionWithWrap(-1)
		Song-->>NTC: Prev section object
		NTC->>Prev: read observed model for RELATIVE minus 1
		NTC->>Song: getRelativeSectionWithWrap(+1)
		Song-->>NTC: Next section object
		NTC->>Next: read observed model for RELATIVE plus 1
		Note right of NTC: replayOptions per table carry
		Note right of NTC: tablename, listenToTablename, type
		Note right of NTC: sectionIndex, relativeSection, directionType
		Note right of NTC: sharps, rootID, rootIDLead

		loop For each replayOptions
			alt SELF for main table
				NTC->>NTC: createNotetableLookupContext(current section)
				NTC->>Main: replay namedNotes, playedNotes, recordedNotes from current section
			else RELATIVE for observer minus 1
				NTC->>Controls: controlsToDisplayOptions()
				Controls-->>NTC: defaultDisplayOptions from current page
				NTC->>Song: getDisplayOptionsInEffect(prev section, defaultDisplayOptions)
				Song-->>NTC: nearest displayOptions walking backward from prev section
				NTC-->>NTC: relSectionOptions = observed section display options plus replayOptions
				NTC->>Back: buildCellsForTable(relSectionOptions)
				NTC->>NTC: createNotetableLookupContext(prev section)
				NTC->>Back: replay notes from prev section.sectionNotesByTable[listenToTablename]
			else RELATIVE for observer plus 1
				NTC->>Controls: controlsToDisplayOptions()
				Controls-->>NTC: defaultDisplayOptions from current page
				NTC->>Song: getDisplayOptionsInEffect(next section, defaultDisplayOptions)
				Song-->>NTC: nearest displayOptions walking backward from next section
				NTC-->>NTC: relSectionOptions = observed section display options plus replayOptions
				NTC->>Ahead: buildCellsForTable(relSectionOptions)
				NTC->>NTC: createNotetableLookupContext(next section)
				NTC->>Ahead: replay notes from next section.sectionNotesByTable[listenToTablename]
			end
		end

		App->>App: updateSectionsStatus()
		App->>App: showBeats()
		App->>NTC: showHighlightsForBeat(current beat)
	end
```

## Cell Click and colorNote

```mermaid
sequenceDiagram
	autonumber
	participant Controls as View controls page
	participant NTC as NoteTableController
	participant Current as Section current
	participant Main as Table main current section
	participant Back as Table observer minus 1
	participant Ahead as Table observer plus 1

	alt User clicks a cell in main table
		Main->>NTC: colorNote(cell)
	else User clicks a cell in observer minus 1
		Back->>NTC: colorNote(cell)
	else User clicks a cell in observer plus 1
		Ahead->>NTC: colorNote(cell)
	end

	NTC->>NTC: colorNoteInner(cell)
	NTC->>NTC: createNotetableLookupContext(getCurrentSection())
	NTC->>Current: read current section only for lookupContext
	NTC-->>NTC: infer clicked tableID from cell.closest(table)
	NTC->>Controls: read rbHighlight and rbColor radio state
	NTC->>Controls: read current beat number

	alt Played note or fingering or bend
		NTC->>Current: recordPlayedNote or unRecordPlayedNote in current section.sectionNotesByTable[clicked tableID]
		NTC->>NTC: colorSingleNotes using lookupContext from current section
	else Highlight or highlight single
		NTC->>Current: recordHighlight in current section.sectionNotesByTable[clicked tableID]
	end

	NTC-->>Main: update clicked table cell classes if main table was clicked
	NTC-->>Back: update clicked table cell classes if observer minus 1 was clicked
	NTC-->>Ahead: update clicked table cell classes if observer plus 1 was clicked
	NTC->>NTC: Event Note colored

	Note over NTC,Current: Current behavior is page centric for clicks
	Note over NTC,Current: lookupContext always comes from current section
	Note over NTC,Current: clicked tableID decides which table bucket is updated
	Note over NTC,Current: observer clicks do not switch lookupContext to observed section
```

## Current Flow Summary

- `Looper` advances the song section through `song.gotoNextSection(true)`.
- `Song` asks the page to `clearAndReplaySection()` through EventBus.
- `sectionChanged()` first revives page controls from the current section `displayOptions` if present.
- `resetNoteNames()` rebuilds all visible tables from one current-page options object.
- `getReplayOptionsArray()` then creates one `SELF` replayOptions for the main table and one `RELATIVE` replayOptions for each observer table.
- For relative observers, `replayTable()` currently re-scrapes page controls and then replaces them with `getDisplayOptionsInEffect(observedSection, defaultDisplayOptions)` before rebuilding that observer table.
- `colorNote()` is current-section centric for lookup context and recording, even when the clicked DOM cell is on an observer table.
