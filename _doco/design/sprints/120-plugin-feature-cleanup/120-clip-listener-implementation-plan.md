# ClipPlugin Listener Copy Implementation Plan

## Scope

This document covers only the new ClipPlugin feature discussed in Iteration 1 of sprint 120:

- `L) copy Listened notes`

It does not cover other sprint-120 fixes.

It does not introduce code changes yet.

## Goal

Add a new ClipPlugin copy action that captures the notes currently being projected into a Listener table, without scraping the DOM.

The action should:

1. work only for true Listener tables
2. ignore Observer tables completely
3. ignore `recordedNotes`
4. obey existing ClipPlugin include options
5. preserve note meaning from the listened-to table, not the destination table's display-side styling
6. drop any projected played notes that do not map onto the listener table, matching current Listener behavior

## Approved design constraints

The implementation should follow the refined decisions in sprint 120 exactly:

1. Capture Listener notes from model-backed source data, not from the DOM.
2. Preserve note meaning, not a literal snapshot of visible rendered cells.
3. Drop notes that Listener drops today.
4. Ignore `recordedNotes`.
5. Treat source `namedNotes` as `namedNotes` and source `playedNotes` as `playedNotes`.
6. Obey ClipPlugin include toggles.
7. Ignore Observer tables.
8. Add a menu item after MIDI Paste, with caption shape `L) copy Listened notes`.

## Minimal product interpretation

To keep this iteration small and safe, the new feature should be a second copy path, not a new clip format.

Recommended interpretation:

1. Reuse the existing `CLIP` Graveyard payload shape.
2. Reuse the existing Graveyard storage behavior.
3. Reuse the existing clip naming flow.
4. Add one new action that builds a clip payload from Listener source data instead of from the selected table's own `SectionNotes`.
5. Do not add a new revive mode. Existing revive behavior should continue to work because the payload remains a normal clip payload.

## User-visible behavior

## Menu placement

Under ClipPlugin, place a new action immediately after MIDI Paste:

- `L) copy Listened notes`

This action should follow the same `automatic` behavior as the existing `C) copy` action:

1. if `automatic = true`, execute immediately with the default generated clip name
2. if `automatic = false`, prompt for a clip name using the same input flow as normal copy

## When the action should work

The action should execute only when the selected ClipPlugin `targetTable` is a Listener table, meaning:

1. there is a wiring whose `tablename` matches the selected target table
2. that wiring has `listenToTablename`
3. that wiring does not use `relativeSection`

If the selected target table is not a true Listener table, the action should not try to guess behavior.

Recommended result message:

- `Clip listener-copy skipped: target table is not a Listener`

## What gets copied

The copied note set should come from the listened-to source table in the current section, then be transformed into the note set that Listener would project into the selected target table.

That means:

1. source table = wiring `listenToTablename`
2. destination table = selected ClipPlugin `targetTable`
3. section = current section only

### NamedNotes

Copy source `namedNotes` directly as `namedNotes`.

Do not materialize them into explicit destination cells.

Reasoning:

1. this matches the approved rule to preserve note meaning
2. Listener already treats named-note projection as a named-note concern, not as a list of cell snapshots
3. this avoids inventing a second representation for named notes

### PlayedNotes

Copy source `playedNotes` as projected `playedNotes`.

For each eligible source played note:

1. resolve its source MIDI pitch
2. keep the same row index
3. find the landing cell on the destination listener table by row plus MIDI
4. if a legal landing cell exists, emit a copied played note at that destination row and destination col
5. if no legal landing cell exists, drop it

This is the same minimal mapping rule already recommended for Listener capture.

### RecordedNotes

Ignore `recordedNotes` completely.

No part of this feature should read them, project them, or store them.

## Payload strategy

## Reuse current clip payload

Do not create a new Graveyard type.

Do not create a Listener-specific clip schema.

The new action should still produce the normal `CLIP` payload shape already used by ClipPlugin.

The only difference is how the payload is collected.

Current normal copy builds payload from the selected table's own section notes.

Listener copy should instead build payload from:

1. source `namedNotes` from the listened-to table
2. source `playedNotes` remapped into the selected listener table's projected coordinates

## Color and note attributes

Use source-note payloads, not destination display styling.

That means:

1. keep note attributes that already exist in the source model note
2. do not read any color classes or other styling from the listener table DOM
3. do not preserve any extra rendering state that Listener introduces during replay

Minimal interpretation of the approved design:

1. source model note data is authoritative
2. destination display-side coloring is ignored

## Proposed implementation shape

## 1. Add a new menu node in ClipPlugin

In [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js), add a new action node:

- action name: `copyListenedToGraveyard`
- caption: `L copy Listened notes`
- trigger: `L`

It should mirror the normal copy node's `automatic` and input behavior.

## 2. Add a new action handler

In [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js), add a new invoke branch:

- `copyListenedToGraveyard`

Recommended internal shape:

- `copyListened(song, args = {})`

This should parallel `copyOrCut(...)` but remain copy-only.

No cut variant is proposed in this iteration.

## 3. Resolve Listener wiring from selected target table

Add a helper in [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js) with behavior equivalent to:

1. read selected target table ID
2. find `song.wirings` entry where `tablename === targetTableID`
3. require `listenToTablename`
4. reject any wiring that also uses `relativeSection`

Recommended helper result:

```js
{
	targetTableID,
	sourceTableID,
	wiring
}
```

or `null` when the target table is not a supported Listener.

## 4. Build a Listener-aware clip payload collector

Add a dedicated payload builder in [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js), separate from normal `collectClipPayload(...)`.

Suggested name:

- `collectListenerClipPayload(song)`

This helper should:

1. resolve current section
2. resolve selected target listener table
3. resolve listened-to source table
4. read source `SectionNotes`
5. obey existing include toggles
6. construct a normal clip payload using projected destination played-note coordinates

## 5. Reuse existing tuning-layout helpers for played-note projection

Use existing helper infrastructure instead of introducing Listener-specific math.

The most likely reusable helpers are already in [move-helpers.js](move-helpers.js):

1. `createTuningLayout(...)`
2. `getCellByRowCol(...)`
3. `getCellByRowMidi(...)`

Recommended mapping flow for each played note:

1. determine source tuning from `listenToTablename`
2. determine destination tuning from selected listener table
3. build layouts for both
4. resolve source MIDI from note payload or from source row/col in source layout
5. locate destination cell by same row and same MIDI in destination layout
6. clone the note and replace only row/col/midinum/noteName with destination-cell values
7. if no destination cell exists, drop the note

## 6. Reuse include toggles exactly as they work today

Listener copy should obey the same toggles already used by normal copy:

1. `includeNamed`
2. `includeSingle`
3. `includeTiny`
4. `includeBend`
5. `includeFingering`

No new include properties are needed.

## 7. Reuse existing naming and Graveyard bury flow

After building the listener-aware payload:

1. compute the default clip name the same way normal copy does
2. accept manual input name the same way normal copy does
3. call existing Graveyard `bury(...)` with `GraveType.CLIP`
4. return a result message that indicates Listener copy was used

Recommended result message shape:

- `Clip copied listened notes N as <name>.`

If useful, include source and target table IDs in the message.

## Non-goals for this iteration

1. No DOM scraping.
2. No Observer support.
3. No `recordedNotes` support.
4. No new cut action for listened notes.
5. No new revive mode.
6. No color remapping based on listener-table display state.
7. No attempt to copy a merged visible result when self notes and listened notes overlap on the same table.

## Recommended overlap rule

Keep the feature source-driven, not display-merged.

If the selected target table is a Listener and also has its own notes in its own `SectionNotes`, `L) copy Listened notes` should ignore those self notes.

It should copy only the listened-to source stream.

Reasoning:

1. this matches the feature name
2. this avoids ambiguity
3. normal `C) copy` already exists for copying the selected table's own notes

## Validation and tests to implement later

When coding starts, add or extend Jest coverage in [_tests/jest/clip-plugin.test.js](_tests/jest/clip-plugin.test.js).

Recommended tests:

1. menu includes `L) copy Listened notes` in the intended position
2. action skips when selected target table is not a Listener
3. action skips when target table is an Observer or relative wiring
4. source `namedNotes` copy through as `namedNotes`
5. source played single notes map by same row plus MIDI into destination listener table
6. unmappable played notes are dropped
7. include toggles exclude the intended note families
8. destination display colors are not consulted
9. resulting clip record is stored as a normal `CLIP`
10. a clip created by `L` revives through existing revive logic without schema changes

## File touch points for the later coding phase

Primary expected code changes:

1. [plugins/clip/ClipPlugin.js](plugins/clip/ClipPlugin.js)
2. [_tests/jest/clip-plugin.test.js](_tests/jest/clip-plugin.test.js)

Possible helper reuse only, with no expected behavior change required there:

1. [move-helpers.js](move-helpers.js)

No changes are expected in replay code for this iteration if the implementation stays source-driven and does not scrape DOM state.

## Remaining questions

These are small enough that coding can probably proceed with the recommended defaults, but they should be recorded here.

### 1. Exact success caption

Recommended default:

- `Clip copied listened notes <count> as <name>.`

Question:

- should the message also include `from <sourceTableID> to <targetTableID>`?

### 2. Menu caption exact text

Recommended default:

- `L copy Listened notes`

Question:

- should the visible caption use `Listened` exactly, or should it be normalized to `Listener` or `listened-to`?

### 3. Source color attributes

Recommended default:

- preserve any color-related attributes already present on the source model note
- ignore any destination-side listener display coloring

Question:

- is that the intended reading of the approved design text?

## Recommended implementation order for the later coding iteration

1. add the new menu node and invoke branch
2. add Listener-wiring resolution helper
3. add listener-aware payload collector
4. add played-note projection by row plus MIDI using existing layout helpers
5. wire to existing Graveyard bury path
6. add Jest coverage for supported and rejected cases

## Bottom line

This feature is viable with a small, focused change set because it can be implemented as a new ClipPlugin copy path that:

1. reads source notes from the listened-to table's model state
2. projects played notes into the selected listener table using existing tuning-layout helpers
3. keeps `namedNotes` as `namedNotes`
4. drops unmappable played notes
5. stores the result as a normal clip

That is the minimal interpretation of the approved design and should avoid broad architectural changes.
