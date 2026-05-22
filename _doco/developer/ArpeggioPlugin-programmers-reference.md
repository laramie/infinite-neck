# ArpeggioPlugin Programmer's Reference

## Roadmap

This reference covers the current Arpeggio plugin implementation for developers who already know the Song, Section, SectionNotes, NoteTableController, and EventBus layers.

The current implementation spans these primary modules:

- `plugins/arpeggio/ArpeggioPlugin.js`
- `plugins/arpeggio/properties.json`
- `NoteTableController.js`
- `colorFunctions.js`
- `looper.js`

The current design separates four concerns:

1. `ArpeggioPlugin.js` owns sequence generation and plugin-level state.
2. `properties.json` owns menu-visible property metadata and defaults.
3. `NoteTableController.js` owns transient DOM display for named-note reveal.
4. `looper.js` and `Song.requestUiShowBeats()` provide the beat-driven refresh path that keeps Arpeggio's transient display synchronized while looping.

Arpeggio now also owns one Section-local state tree for its `positions` feature:

- `section.pluginData.arpeggio.positions`
- `section.pluginData.arpeggio.lastPositionIndex`

## Core Runtime Model

At runtime Arpeggio does two different jobs that are easy to confuse if you only skim the file.

1. It generates owner-tagged recorded notes into the current Section.
2. It optionally asks the UI to reveal named-note text for selected generated beats.

Those jobs are deliberately separate.

### Generated notes

Generated notes are written into `section.sectionNotesByTable[tableID].recordedNotes`.

Important details:

- generated notes are tagged with `owner = 'ArpeggioPlugin'`
- generated notes currently use `Note.STYLENUM_MIDIPITCHESSINGLE`
- generated notes store `midinum`, `row`, and `col`
- `clearGeneratedNotesInSection()` and `clearGeneratedNotesInSong()` remove only Arpeggio-owned notes

This is why the plugin can regenerate and clear its own material without disturbing manually authored notes in the same beat arrays.

### Named-note reveal

Named-note reveal is not stored in the Song model.

Instead, Arpeggio emits:

- `EventBus.trigger('NoteTable:ShowNamedNotesAtCells', ...)`

That event is consumed by `NoteTableController.js`, which performs DOM-only display work.

This split is intentional. The plugin decides which cells should be revealed; the controller decides how the DOM should look.

## Target Instrument Rule

Arpeggio does not ask the user for a table ID directly.

`getTargetTuning(song)` selects the first `myTunings` entry whose derived table ID is not present in the Song's wiring table names.

Current assumption:

- the first unwired instrument is the Arpeggio target

This works for the current practice-tool use cases, but it is an assumption, not a universal truth of the model.

If future work needs explicit targeting, this method is the place to change it.

## Sequence Generation Path

The sequence path inside `applyToSection()` is:

1. resolve target section
2. optionally clear existing generated notes in that section
3. resolve target tuning and table ID
4. resolve the effective fret window for this pass
5. collect candidate positions from named notes within that effective fret range
6. expand those candidates into a beat-count-length sequence using the selected style
7. write generated recorded notes into beat arrays
8. request UI beat refresh
9. emit transient named-note display intent if enabled

The important sequence helpers are:

- `resolveEffectiveFretWindow()`
- `collectCandidatesForSection()`
- `expandCandidateSequence()`
- `expandEverySequence()`
- `expandAlternateSequence()`
- `expandRandomSequence()`
- `expandBachSequence()`

## Section-local positions

Arpeggio now supports a custom `p) positions` submenu in the plugin menu.

That feature is intentionally not modeled as a flat persisted plugin property in `properties.json`.

Reason:

- positions are Section-local, not Song-plugin-global
- copy/clear/edit actions operate on Section state, not on plugin defaults

### Storage model

Positions are stored per Section under:

- `section.pluginData.arpeggio.positions`
- `section.pluginData.arpeggio.lastPositionIndex`

Plugin-level `minFret` and `maxFret` remain the default fallback values when a Section has no positions.

### Advancement rule

Positions advance only on `DaCapo:OnSectionBegin`.

Current state machine:

- if a Section has no positions, use plugin defaults and do not touch `lastPositionIndex`
- if a Section has positions and no stored index, or `lastPositionIndex === -1`, apply index `0`
- after applying index `i`, persist `lastPositionIndex = i`
- next qualifying section-begin applies `(i + 1) % positions.length`

Manual `apply` does not advance positions.

`SongUiShowBeats` must remain read-only with respect to `lastPositionIndex`; it uses the current stored position for transient display refresh.

### Input formats

The `values this section` menu item accepts:

- canonical JSON such as `[[0,3],[4,7]]`
- semicolon shorthand such as `0,3;2,5;6,9`
- semicolon shorthand with trailing implied width such as `0,3;2,5;6`
- boundary shorthand such as `0,3,5,9`

Stored and displayed values are normalized back to canonical JSON.

### Reset and load normalization

Arpeggio resets every Section's `lastPositionIndex` to `-1` when:

- `loadSongState(...)` runs
- `Looper:OnResetSong` is received

`-1` means "positions exist for this Section, but no position has been played yet." That preserves `positions[0]` as the first played position after reset or load.

Empty or missing positions are treated as unset and do not participate in advancement.

The `bach` helpers are intentionally more specialized than the others and should be treated as their own algorithm family, not as a trivial variant of `every` or `alternate`.

## Display Options Added In This Sprint

Arpeggio now has a second layer of behavior beyond note generation: beat-synchronized transient note-name reveal.

Relevant properties:

- `showNoteName`
- `colorNotes`
- `flashcard`

### `showNoteName`

Current values:

- `off`
- `one`
- `all`
- `played`

Meaning:

- `off`: never reveal transient named-note text
- `one`: show only one beat's note-name text at a time
- `all`: reveal all generated beat positions for the section
- `played`: accumulate beat-by-beat named-note reveals through the pass

### `colorNotes`

This is intentionally independent of `showNoteName`.

- `false`: transient reveal uses `noteTransparent`
- `true`: transient reveal uses the AutoColor class the note would have received

Implementation detail:

AutoColor resolution is done through `lookupClassForNote()` from `colorFunctions.js` using a proxy note with `styleNum = Note.STYLENUM_NAMED` and `autoColor: true` in the lookup context.

That means Arpeggio's transient note-name reveal is visually aligned with named-note semantics, not with tiny-note or bend semantics.

### `flashcard`

Flashcard mode changes when note-name text is revealed, not how the highlight works.

Current behavior:

- beat 1: highlight only, no note-name reveal
- intermediate beats: reveal the previous beat's note-name information
- final beat: reveal the previous beat and the current beat together

Flashcard respects the current `showNoteName` mode.

Examples:

- `one + flashcard`: delayed single-note reveal
- `all + flashcard`: hide on beat 1, then reveal the whole section from beat 2 onward
- `played + flashcard`: accumulate delayed reveals, and also reveal the final beat on the last beat

## Beat-Driven Refresh Path

This sprint added a second event path to Arpeggio:

- `DaCapo:OnSectionBegin`
- `SongUiShowBeats`

The first event regenerates the section when looping enters a section.

The second event keeps transient note-name reveal in sync with the current beat while the UI is running.

That distinction matters.

If Arpeggio only listened to `DaCapo:OnSectionBegin`, beat 1 would show correctly and later beats would not update. The plugin now relies on `Song.requestUiShowBeats()` -> `SongUiShowBeats` for ongoing beat display updates.

### Why the looper matters

`looper.js` must route beat refresh through `song.requestUiShowBeats()` when available.

If code bypasses that and calls `InfiniteNeck.showBeats()` directly, Arpeggio will not receive `SongUiShowBeats` and transient note-name display will stall at the initial beat.

That is a maintenance-sensitive integration point.

## Design Assumptions From This Sprint

These are the non-obvious assumptions that are easy to miss on a code walk.

### 1. Named-note reveal is DOM-only by design

Arpeggio does not mutate `namedNotes` in the Song model to show practice prompts.

Reason:

- the use case is temporary practice UI, not persistent song authoring state
- mutating model-level named notes would overwrite user-authored note display choices

### 2. Transient reveal is owner-scoped

The controller tags transient named-note DOM state with owner metadata.

Current owner:

- `ArpeggioPlugin`

Reason:

- cleanup must remove only transient plugin-owned visual state
- cleanup must restore original `.namedNote` and `.NoteDisplay` state exactly

### 3. `NoteActive` is part of the reveal contract

Transient named-note reveal now also temporarily applies `NoteActive` on the parent `.NoteDisplay`.

Reason:

- without `NoteActive`, hidden named notes look visually different from normal active named notes
- styling such as shadows and related CSS assumptions are attached to `.NoteDisplay.NoteActive`

This state is restored on cleanup and must not be left behind permanently.

### 4. Arpeggio chooses the current visible section conservatively

Before updating UI state, the plugin checks whether the target section is still the Song's current section.

Reason:

- it prevents stale beat-display events from drawing transient note-name state onto an off-screen section

### 5. `all` mode is display-only, not authoring-wide named-note activation

`showNoteName = all` does not populate `namedNotes` across the section.

It only asks the DOM layer to reveal the generated beat positions.

That distinction keeps `all` useful as a practice overlay rather than as a model rewrite.

## Maintenance Points

This section is the short list of places to check before changing behavior.

### When adding a new Arpeggio property

Touch all of these deliberately:

- `plugins/arpeggio/properties.json`
- `ArpeggioPlugin.buildSummary()` if the property affects help/debug output
- `ArpeggioPlugin.buildHelpMessage()` if the property changes the supported behavior surface
- focused tests in `_tests/jest/arpeggio-plugin.test.js`

### When changing note-name reveal semantics

Check both of these layers:

- plugin payload builder methods in `ArpeggioPlugin.js`
- transient DOM restore logic in `NoteTableController.js`

Do not change one without re-checking the other.

### When changing beat progression behavior

Check:

- `Song.requestUiShowBeats()`
- `looper.js`
- `ArpeggioPlugin.handleEvent('SongUiShowBeats', ...)`
- `ArpeggioPlugin.resolveEffectiveFretWindow(...)`

The transient overlay path depends on that event chain remaining intact.

### When changing AutoColor integration

Check:

- `colorFunctions.js`
- `resolveNamedNoteDisplayColorClass()` in Arpeggio

Arpeggio currently assumes that named-note-style AutoColor can be computed from section root context plus note name.

If AutoColor semantics become more DOM-dependent or table-dependent, this integration will need to be revisited.

### When changing target table semantics

Check:

- `getTargetTuning()`
- any Wiring-related filtering logic

The current rule is intentionally simple and may not be right for future multi-target or explicitly-targeted plugin work.

## Practical Summary

For future maintenance, the shortest accurate summary is:

1. Arpeggio generates owner-tagged single-pitch recorded notes into the current section.
2. It separately emits DOM-only named-note reveal requests for practice UI.
3. Beat-to-beat reveal updates depend on `SongUiShowBeats`, not only on section-begin events.
4. `colorNotes` reuses AutoColor lookup logic without requiring the UI's AutoColor toggle to be on.
5. `flashcard` delays reveal by one beat and forces the final beat to reveal itself because there is no next beat to do it.
6. `NoteTableController` owns the temporary DOM state and must restore both `.namedNote` and `.NoteDisplay` correctly.