# sprint-119 Iteration 6 Implementation Plan: Clip recordedNotes/beats

## Purpose

This document analyzes the requested sprint-119 Iteration 6 behavior from [119-it6.md](_doco/design/sprints/119-cleanup/119-it6.md) and proposes an implementation plan for review before coding changes are approved.

The request has two feature areas:

1. Add `/seii`: **section > edit > instrument > insert clone table into other section**.
2. Extend `ClipPlugin` under `/fpc` with a **recorded notes** flow for copying and pasting `recordedNotes` beat data.

The plan below intentionally separates design decisions, implementation steps, tests, risks, and approval questions.

---

## Current-code findings

### Command/menu action flow

- Static section edit menus live in [menu.js](menu.js).
- Command actions are handled in [key-handlers.js](key-handlers.js), including the existing `sectionEditInstrumentClone` action.
- Plugin menus are dynamic. `ClipPlugin.getVisibleMenuChildren()` builds `/fpc` children from [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js).
- `PluginManager.invokeMenuAction()` passes menu input arguments through to `plugin.invokeAction(actionName, { song, pluginManager, args })`, so the recorded-notes copy/paste actions can be implemented inside `ClipPlugin` without extra dispatcher work for plugin actions.
- The existing command result object shape supports short dropdown results plus optional longer messages. For this iteration, warnings should generally be returned in `result` only.

### Existing `/seic` behavior

- `/seic` is implemented as `sectionEditInstrumentClone` in [key-handlers.js](key-handlers.js).
- It delegates most behavior to `Song.addCloneSectionForTable(tableID)` in [Song.js](Song.js).
- The cloned section contains only the selected table data and is inserted after the current section.
- `sectionEditNextSectionCardinal` is already available as a menu variable and returns the current section number plus one.

### Section/table data model

- A section stores table data under `section.sectionNotesByTable[tableID]`.
- Each table's section data is a `SectionNotes` instance with `namedNotes`, `playedNotes`, and `recordedNotes`.
- `recordedNotes` is keyed by 1-based beat number as strings, for example `{ "1": [note], "2": [note] }`.
- Beat insertion is already supported for the current section by `Song.moveBeatsLater(oneBasedIndex)` and `Song.moveBeatsLaterForTable(tableID, beatCount, oneBasedIndex)` in [Song.js](Song.js).
- `Section.getBeat()` and `Section.getBeats()` in [Section.js](Section.js) provide the current beat and section beat count.

### ClipPlugin current scope

- Current clipping copies `namedNotes` and `playedNotes`, not `recordedNotes`.
- Existing clip payloads carry source tuning context including `baseID` and `fromBaseID`.
- Existing paste paths already have utilities for compatibility, collision handling, cloning note-like objects, and result summaries.
- Current collision behavior in `ClipPlugin` uses a helper named `playedCollisionKey(note)`. In the current code it keys by `styleNum`, `row`, and `col`, so recorded-note collision logic should either reuse that helper or deliberately introduce a better-named helper for cell/style collisions.

### REC mode

- REC mode is currently detected in UI code by checking `#btnRecord`'s `recording` attribute.
- For testability, recorded-note paste actions should not hard-code jQuery deep inside all logic. Prefer a small mode-check boundary that can be supplied or stubbed from tests.
- This should be addressed before Iteration 6: REC mode is command/application runtime state, not DOM state. The DOM should render that state, not own it.

---

## Proposed behavior details

### `/seii`: insert cloned selected instrument table into another section

Menu path:

```text
/seii
section > edit > instrument > insert clone table into other section
INPUT> 1-based-section-number
```

Recommended caption:

```text
<b>i</b>nsert clone [${sectionEditInstrumentBaseID}] into Section
```

Recommended input:

- `id`: `value`
- `datatype`: `Number` or `string` normalized manually
- `caption`: `section number (1-${sectionEditNextSectionCardinal})`
- `default`: `${sectionEditNextSectionCardinal}`

Validation:

1. No selected section edit instrument: no-op warning.
2. Destination section number is not an integer: no-op warning.
3. Destination section does not exist: no-op warning.
4. Source selected table has no table data in current section: no-op warning.
5. Destination section already has non-empty data for the same table: no-op warning.
6. If destination section has an empty placeholder table for the same `tableID`, replace it with the clone.
7. Otherwise insert the cloned `SectionNotes` under the same `tableID`.

Result examples:

- `inserted P46_1 into Section 3`
- `Section 7 not found`
- `P46_1 not empty in Section 3`
- `no notes for P46_1`

Implementation note: add a `Song.insertCloneTableIntoSection(tableID, oneBasedSectionNumber)` helper rather than putting all object mutation in [key-handlers.js](key-handlers.js). This keeps menu handling small and makes the behavior easier to test.

---

## Proposed ClipPlugin menu structure

Add this dynamic subtree under `/fpc`:

```text
r) recorded notes
		c) copy
				status: [tblname:sectionNum:beatnum]
			c) current beat
			a) all beats
		p) paste
				status: [tblname:sectionNum:beatnum]
				a) add all beats
				i) insert all beats
				p) play beats into current
				s) squeeze beats into current beat
				f) flatten beats into playedNotes
```

Implementation notes:

- Build this in `ClipPlugin.getVisibleMenuChildren()` using new builder methods such as `buildRecordedNotesMenuNode()` and `buildRecordedStatusNode()`.
- The `status:` lines should be non-action informational menu children. Existing command menu patterns support caption-only/status-like items; if not, use an inert action that returns a status result.
- Do not reuse the existing include/note-type filter settings. This flow copies all recorded note styles.
- Do not expose MIDI Paste or note-type selection inside this flow.

Suggested action names:

- `copyRecordedCurrentBeat`
- `copyRecordedAllBeats`
- `pasteRecordedAddAllBeats`
- `pasteRecordedInsertAllBeats`
- `pasteRecordedPlayIntoCurrent`
- `pasteRecordedSqueezeCurrentBeat`
- `pasteRecordedFlattenToPlayedNotes`

---

## Clip memory design

The current `ClipPlugin` uses Graveyard clip records for named/played notes. For the new recorded-notes flow, use the same Graveyard-backed clip storage pattern unless reviewers prefer an in-memory-only clip.

Recommended payload shape:

```json
{
	"schemaVersion": 1,
	"clipKind": "recordedNotes",
	"source": {
		"tableID": "P46_1",
		"baseID": "46_1",
		"fromBaseID": "46",
		"sectionIndex": 0,
		"sectionNumber": 1,
		"beatNumber": 2,
		"beatCount": 4,
		"nStrings": 6,
		"midiPitches": [40, 45, 50, 55, 59, 64]
	},
	"recordedNotesByBeat": {
		"1": [{ "styleNum": 2, "row": 1, "col": 3 }]
	},
	"sourceBeatNumbers": [2]
}
```

Why include both `recordedNotesByBeat` and `sourceBeatNumbers`:

- It preserves sparse source beats when copying all beats.
- It lets paste code iterate in source order without depending on object key ordering.
- It supports copying the current beat as a one-beat source set even when the original beat number was not `1`.

Recommended internal normalized form for paste:

```text
sourceBeats = [
	{ originalBeatNumber: 2, notes: [...] },
	{ originalBeatNumber: 3, notes: [...] }
]
```

When copying all beats, include every beat from `1..section.getBeats()`. Empty beats should be included as empty arrays so the source set length matches the section beat count.

---

## Compatibility rules

Iteration 6 says the source and destination tables must have the same lineage, and that cells line up.

Recommended checks before any recorded paste:

1. A recorded-notes clip exists.
2. Destination section exists.
3. Destination table is selected and has a tuning record.
4. Source and destination lineage match by `fromBaseID || baseID`.
5. `nStrings` matches.
6. `midiPitches` arrays match exactly, in order.
7. Recorded-note collisions line up by `styleNum:row:col`.

Result examples:

- `no recordedNotes clip`
- `P46_1 incompatible with P52_1`
- `P46_1 string layout mismatch`

This is intentionally stricter than current MIDI Paste. It matches the iteration goal: no MIDI remapping, same row/column/pitch cell alignment.

---

## Paste scenario algorithms

All paste operations should clone notes before inserting them and strip runtime-only ownership references if present.

### Shared recorded-note collision behavior

For REC-mode paste into `recordedNotes`, collisions are per destination beat and per note cell/type.

Recommended key:

```text
styleNum:row:col
```

When a candidate note collides with an existing destination note:

- Replace the existing note.
- Count the operation as overwritten.
- The candidate wins, including color, roll, note name, and other persisted fields.

This differs from the configurable existing `overwrite` property: the iteration text says collisions should be overwritten/replaced in these scenarios, so this new flow should ignore the `overwrite` plugin property unless reviewers explicitly request otherwise.

### 1. Play beats into current, source set has one beat

Preconditions:

- REC mode must be on.
- Source set length is one.

Algorithm:

1. Read the current destination beat.
2. Merge the single source beat's notes into that destination beat.
3. Replace collisions, keep unrelated existing notes.
4. Do not create beats.

Result example:

- `played 1 beat into current: added 3, overwritten 1`

### 2. Play beats into current, source set has many beats

Preconditions:

- REC mode must be on.

Algorithm:

1. Let destination start at current beat.
2. Pair source beat `0` with destination current beat.
3. Advance both source and destination one beat at a time.
4. Stop when source beats are exhausted or destination beats are exhausted.
5. Do not create new beats.
6. Replace collisions within each destination beat.

Result example:

- `played 2/4 beats: added 5, overwritten 1`

### 3. Squeeze beats into current beat

Preconditions:

- REC mode must be on.

Algorithm:

1. Read the current destination beat.
2. Iterate all source beats in order.
3. Merge every note into the same destination beat.
4. Replace collisions. Later source beats should win over earlier source beats if they collide within the squeeze operation.
5. Do not create beats.

Result example:

- `squeezed 4 beats into beat 2: added 8, overwritten 3`

### 4. Add all beats

Preconditions:

- REC mode must be on.

Algorithm:

1. Insert `sourceBeats.length` new empty beats after the current destination beat.
2. Populate those newly inserted beats in source order.
3. Because these are new beats, no normal collision overwrite should occur.
4. Preserve empty source beats as empty inserted beats.

Result example:

- `added 4 beats after beat 2: 12 notes`

Implementation caution: current `Song.moveBeatsLater()` inserts one beat in the current section and updates UI state. For multiple-beat insertions, either loop carefully or add a batch helper to avoid repeated repaint churn.

### 5. Insert all beats

Preconditions:

- REC mode must be on.

Algorithm:

1. Insert `sourceBeats.length` new empty beats before the current destination beat.
2. Populate those newly inserted beats in source order.
3. Preserve empty source beats.

Result example:

- `inserted 4 beats before beat 2: 12 notes`

### 6. Flatten beats into `playedNotes`

Preconditions:

- REC mode must be off.

Algorithm:

1. Read all source beats in order.
2. Flatten notes by style precedence:
	 1. `Single`
	 2. `Tiny`
	 3. `Bend`
	 4. `Pitch`
	 5. `Multi`
3. Append/merge into destination `playedNotes` using played-note collision behavior.
4. `Multi` should visually win over `Pitch` when both are present by being processed after `Pitch`.
5. Warn that `Pitch` and/or `Multi` highlights are temporary when included.

Result examples:

- `flattened 4 beats: added 12`
- `flattened 4 beats: added 12; Pitch/Multi are temporary`
- `flattened 4 beats: added 2; Multi is temporary`

Open design point: `Pitch` and `Multi` may not behave like persisted `playedNotes` across navigation today. The implementation should match the sprint request for immediate display but should not promise persistence beyond current known behavior.

---

## REC-mode warnings

For all REC-mode mismatches, return a no-op warning in `result` and avoid mutation.

Recommended wording:

- REC required actions: `REC mode required`
- REC forbidden action: `REC mode must be off`

Actions requiring REC on:

- `pasteRecordedPlayIntoCurrent`
- `pasteRecordedSqueezeCurrentBeat`
- `pasteRecordedAddAllBeats`
- `pasteRecordedInsertAllBeats`

Action requiring REC off:

- `pasteRecordedFlattenToPlayedNotes`

Copy actions should not require a REC-mode state unless reviewers request it. The sprint text only describes REC-mode requirements for paste scenarios.

---

## Recommended pre-iteration: REC mode runtime state

Yes: this makes sense as a short prerequisite iteration before Iteration 6.

Iteration 6 will need reliable REC-mode checks from `ClipPlugin`, command handlers, and tests. Leaving REC mode as a `#btnRecord` jQuery attribute would make the new behavior too UI-coupled and brittle. The better small refactor is to move REC mode into runtime-only application state and keep existing CSS class broadcasting as the view update mechanism.

### Scope

This should be a small MVC-ish cleanup, not a schema change.

In scope:

- Add runtime-only recording state to `Song`, for example `song.runtime.recording` or a non-persisted `song.recording` field guarded by the persistence replacer.
- Default REC mode to `false` for every new or loaded song.
- Add methods such as `song.isRecording()`, `song.setRecording(value)`, and `song.toggleRecording()`.
- Keep [infinite-neck.js](infinite-neck.js) as the controller for the transport button and CSS class broadcast.
- Change [NoteTableController.js](NoteTableController.js) `isRecording()` to ask the current `Song`, not the DOM.
- Keep `.RecordButton` / `.ButtonOn` as the view mechanism for transport and section-status gee-gaws.
- Ensure all `.RecordButton` views, including [templates/SectionStatus/section-status.html](templates/SectionStatus/section-status.html), continue to update from the same CSS class broadcast.

Out of scope:

- Persisting REC mode in song files.
- Adding a new EventBus event.
- Reworking the larger recording model or `recordedNotes` schema.
- Replacing current CSS-based view synchronization.

### Proposed design

Add runtime methods to `Song`:

```text
isRecording() -> boolean
setRecording(value) -> boolean
toggleRecording() -> boolean
resetRecording() -> false
```

`Song` should initialize the state to `false` in its constructor. If using a property directly on `Song`, the property name should be clearly runtime-only and excluded from persistence. A nested runtime bag is preferable if the existing persistence replacer allows it to be safely excluded.

[infinite-neck.js](infinite-neck.js) should become the controller boundary:

1. User clicks `.RecordButton` or invokes `/r...toggleRecording`.
2. Controller calls `getSong().toggleRecording()`.
3. Controller calls a view-sync helper, for example `syncRecordingViews()`.
4. `syncRecordingViews()` adds or removes `.ButtonOn` on `.RecordButton`.
5. When recording is turned on, preserve existing behavior: clear current recorded notes and refresh beat display.

[NoteTableController.js](NoteTableController.js) should use model state:

```text
isRecording() -> getSong()?.isRecording() === true
```

For headless/Jest paths, this removes the dependency on `#btnRecord` and makes REC-mode guards testable.

### View synchronization

Keep this existing pattern:

```text
$('.RecordButton').addClass('ButtonOn')
$('.RecordButton').removeClass('ButtonOn')
```

The important shift is that `.ButtonOn` becomes derived view state. The state source becomes `Song`, not `#btnRecord.attr('recording')`.

This preserves the section-status gee-gaws such as:

```html
<span class="instrumentSectionMark"><span class="RecordDot RecordButton ButtonOn"></span>§</span>
```

Those remain proper views under the CSS broadcast approach.

### Testing

Recommended targeted tests:

1. New/loaded `Song` starts with `isRecording() === false`.
2. `toggleRecording()` toggles model state only.
3. Song persistence output does not include recording state.
4. `NoteTableController.isRecording()` reads `Song` state, not DOM state.
5. Existing command action `toggleRecording` still delegates correctly.

Manual UI acceptance:

1. Transport REC button toggles `.ButtonOn`.
2. Section-status record dots toggle with the same `.ButtonOn` CSS broadcast.
3. Loading a song always starts REC off.
4. Turning REC on still clears recorded notes and refreshes beat display as before.

### Why before Iteration 6

Iteration 6 adds REC-required and REC-forbidden paste commands. Those commands need deterministic, testable state. Doing this first will simplify `ClipPlugin` implementation and avoid spreading new jQuery checks into plugin code.

---

## Implementation phases

### Phase 1: Small section-edit feature

Files:

- [menu.js](menu.js)
- [key-handlers.js](key-handlers.js)
- [Song.js](Song.js)
- Add or extend Jest tests under [_tests/jest/](_tests/jest/)

Steps:

1. Add `/seii` menu item under section edit instrument.
2. Add `sectionEditInstrumentInsertIntoSection` command action.
3. Add `Song.insertCloneTableIntoSection(tableID, oneBasedSectionNumber)`.
4. Validate all no-op warning cases.
5. Add tests for valid insert, missing section, current-section destination rejection, existing non-empty destination table, and missing source table data.

### Phase 2: Recorded-notes clip payload and copy actions

Files:

- [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js)
- [_tests/jest/clip-plugin.test.js](_tests/jest/clip-plugin.test.js)

Steps:

1. Add recorded-notes menu subtree.
2. Add status resolver for selected table/current section/current beat.
3. Add payload builder for current beat and all beats.
4. Store recorded-notes clips with a distinct `clipKind`.
5. Add tests for source payload shape and empty-beat preservation.

### Phase 3: Recorded paste helpers

Files:

- [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js)
- Possibly [Song.js](Song.js) if batch beat insertion belongs there

Steps:

1. Add compatibility validation helper.
2. Add note cloning helper for recorded-note candidates.
3. Add collision-map helper for one destination beat.
4. Add batch beat insertion helper or carefully loop existing insertion APIs.
5. Add shared result-summary helper.

### Phase 4: Paste scenarios

Files:

- [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js)
- [_tests/jest/clip-plugin.test.js](_tests/jest/clip-plugin.test.js)

Steps:

1. Implement `play beats into current`.
2. Implement `squeeze beats into current beat`.
3. Implement `add all beats`.
4. Implement `insert all beats`.
5. Implement `flatten beats into playedNotes`.
6. Add targeted tests for every example in [119-it6.md](_doco/design/sprints/119-cleanup/119-it6.md).

### Phase 5: UI refresh and command results

Files:

- [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js)
- Potentially [Song.js](Song.js)

Steps:

1. Ensure mutated paste operations request the appropriate UI updates.
2. Keep result strings compact enough for the command-line dropdown.
3. Avoid voluminous `showMessages()` content for this iteration.
4. Run command menu validation if available.

---

## Test plan

Preferred full command:

```sh
export INFINITE_NECK_VERBOSE=-1
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand
```

Targeted tests during implementation:

```sh
export INFINITE_NECK_VERBOSE=-1
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/clip-plugin.test.js --verbose --runInBand
```

Recommended Jest coverage:

1. `/seii` inserts selected table clone into an existing empty destination section.
2. `/seii` warns and no-ops when destination section does not exist.
3. `/seii` warns and no-ops when destination table is non-empty.
4. Copy current beat records one source beat with the current beat's notes.
5. Copy all beats preserves source section beat count and empty beats.
6. Play beats into current stops at destination end without creating beats.
7. Play beats into current replaces same cell/type collisions.
8. Squeeze all beats into current beat, with later source collisions winning.
9. Add all beats inserts after current beat.
10. Insert all beats inserts before current beat.
11. Flatten requires REC off.
12. REC-mode paste actions require REC on.
13. Compatibility rejects different lineage.
14. Compatibility rejects different `nStrings` or `midiPitches`.
15. Flatten result mentions `Pitch`, `Multi`, or `Pitch/Multi` temporary warning only when those styles are present.

Manual UI acceptance checks:

1. Confirm `/fpc` menu shows the proposed recorded-notes subtree and status lines.
2. Confirm `/seii` input prompt default is useful for adding to the next section.
3. Confirm warnings appear in the command result dropdown.
4. Confirm copied beats can be pasted after changing selected ClipPlugin instrument to a compatible table.

---

## Risks and mitigations

### Risk: mutating section beats incorrectly

`Song.moveBeatsLater()` operates on the current section and changes current beat/UI state. Multi-beat inserts could accidentally reverse order or repaint repeatedly.

Mitigation: implement a small, tested batch helper for inserting `N` beats at a 1-based position, then populate the inserted range in one pass.

### Risk: collision key mismatch

The sprint language says same note type and cell. Current `ClipPlugin` collision key uses `styleNum:row:col`.

Mitigation: name the helper around cell/style collisions and test replacement by `styleNum`, `row`, and `col` explicitly.

### Risk: REC-mode testability

Direct jQuery checks make Jest harder.

Mitigation: isolate REC-mode detection behind one helper that can use context/test injection before falling back to UI state.

### Risk: recorded note styles beyond listed flatten order

Recorded notes may include Fingering or Named styles, but the sprint flatten order lists Single, Tiny, Bend, Pitch, Multi.

Mitigation: ask whether `Fingering` and `Named` should be included in recorded-note flattening. Until clarified, copied/pasted recorded beats should preserve all styles for REC-mode operations, while flatten should process only the explicitly requested styles plus any approved additions.

### Risk: persistent vs temporary highlights

`Pitch` and `Multi` are described as temporary after flattening.

Mitigation: return the requested warning and add tests for result text, but avoid changing broader highlight persistence behavior in this iteration.

---

## Approval questions

1. **Clip storage:** Should recorded-notes clips be Graveyard-backed like current `ClipPlugin` clips, or should this new recorded-notes flow use only an in-memory latest clip?

2. **Overwrite setting:** Should recorded-note paste always replace collisions as the sprint text says, ignoring the existing `overwrite` property, or should `overwrite=false` skip collisions?

3. **Flatten included styles:** For `flatten beats into playedNotes`, should `Fingering` and `Named` recorded notes be ignored, included, or warned as unsupported? The sprint explicitly names Single, Tiny, Bend, Pitch, and Multi.

4. **Empty source beats:** When copying all beats, should empty source beats be preserved so paste inserts/rests keep timing, or should empty beats be dropped? This plan recommends preserving them.

5. **`/seii` destination emptiness:** Should "destination table is not empty" mean only the same `tableID` in the destination section is non-empty, or any table in the destination section is non-empty? This plan assumes same `tableID` only.

6. **`/seii` allowed destination:** Should `/seii` allow inserting into the current section if the selected table is missing/empty there, or should it require a different section?

7. **Lineage strictness:** Is exact `midiPitches` array equality required in addition to same lineage and `nStrings`, or is same lineage enough? This plan recommends exact equality to satisfy "cells line up".

8. **Batch insertion helper location:** Is it acceptable to add a small general-purpose beat insertion helper to [Song.js](Song.js), or should all beat insertion remain inside `ClipPlugin` for feature isolation?

9. **Status line format:** Is `status: [P46_1:1:2]` acceptable, or should the displayed section and beat labels be more verbose, such as `status: [P46_1:Section 1:Beat 2]`?

10. **Result verbosity:** Are compact result strings such as `played 2/4 beats: added 5, overwritten 1` acceptable for the command dropdown?

---

## Recommended decision before coding

Approve the plan with the following defaults unless changed by answers above:

- Use Graveyard-backed recorded-notes clips with `clipKind: "recordedNotes"`.
- Preserve empty beats when copying all beats.
- Ignore existing note-type include filters for recorded-notes copy/paste.
- Ignore the existing `overwrite` property and always replace recorded-note collisions.
- Require same lineage, same `nStrings`, and exact `midiPitches` equality for recorded-note paste.
- Add a small `Song` helper for `/seii` and likely a second tested helper for batch beat insertion.
- Keep all warnings short and in the command result line.

## Approved decisions for coding

The questions above have been answered in [119-it6.md](_doco/design/sprints/119-cleanup/119-it6.md). Coding should use these decisions:

- Recorded-notes clips are Graveyard-backed and use `clipKind: "recordedNotes"`.
- Recorded-note paste ignores the existing `overwrite` property and always replaces collisions.
- REC-mode recorded-note copy/paste ignores existing note-type include filters and copies all recorded note types.
- Flatten includes `Single`, `Tiny`, `Bend`, `Fingering`, `Pitch`, and `Multi` recorded notes.
- Flatten excludes `Named` recorded notes, including any that leak in through a user-authored song file.
- Empty source beats are preserved when copying all beats.
- `/seii` checks whether the same destination `tableID` in the destination section is non-empty. Other tables in the destination section do not block the insert.
- `/seii` rejects the current section as the destination because the current section is the source.
- Recorded-note paste requires same lineage, same `nStrings`, and exact `midiPitches` array equality. This iteration is not MIDI Paste.
- Recorded-note collision identity is `styleNum:row:col`.
- Add the general helper(s) to [Song.js](Song.js) where appropriate.
- Status line format is `status: [P46_1:1:2]`.
- Compact result strings such as `played 2/4 beats: added 5, overwritten 1` are acceptable.
- Iteration pre-6 is complete: REC mode now lives in runtime `Song` state, defaults off on load, is not persisted, and remains visible through `.RecordButton` / `.ButtonOn` CSS broadcasts.
