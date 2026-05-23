# MovePlugin Implementation Plan

## Document Version

- version 2
- based on MovePlugin-design-3.md
- supersedes version 1 in MovePlugin-implementation-plan-1.md
- intended as the pre-coding implementation plan

## Purpose

This version incorporates the Iteration 3 answers and removes the main semantic uncertainty from version 1. The goal is now to state the implementation shape clearly enough that coding can begin after review, without reopening broad design questions.

This document therefore does three things:

1. records the final approved movement semantics for version 1 coding
2. defines the internal module and algorithm structure to implement those semantics safely
3. identifies only narrow implementation-time cautions, not open design holes

## Approved Baseline

The following are now treated as settled for coding.

1. MovePlugin operates on the current Section and one selected table at a time.
2. The move engine lives in MovePlugin and helper modules, not in Song or infinite-neck core APIs.
3. The move engine works from a stable snapshot and writes to scratch output, then replaces the target table's played and recorded note collections.
4. `midinum` is authoritative.
5. `noteName` is recomputed from the landing result.
6. `row` and `col` are recomputed where those fields are semantically meaningful for the style.
7. malformed notes with no `midinum` are dropped and logged.
8. `droppedNotes` is runtime-only plugin state and persists until explicitly cleared.
9. the apply counter is runtime-only, persists for the life of the plugin session, and is not reset by clear.
10. `Apply` continues through the full candidate set and logs failures rather than aborting early.
11. the default algorithm is `octave`.
12. `Apply` with no include toggles is a no-op plus an informational dropped-notes entry.
13. the first `Apply` after clear buries the current Section once as backup, then later applies stay quiet until the next clear.
14. `help` is approved in the menu.

## Final Movement Semantics

### Fretwise motions

These are now explicit and approved:

1. `up` means `midinum + 1`
2. `down` means `midinum - 1`
3. this remains true for reversed or left-handed tables

That means fretwise movement is always MIDI-driven, not page-direction driven.

### Jump motions

These are also now explicit and approved:

1. `jump up` means move to lower row index first, for example `row[2] -> row[1]`
2. `jump down` means move to higher row index first, for example `row[1] -> row[2]`
3. this row orientation does not invert on reversed or left-handed tables
4. when overflow search is needed under `octave` or `string`, the candidate replacements are still computed by MIDI truth, not by visual column symmetry

So jump motions are row-oriented first, but not purely row-oriented in the final destination, because octave replacement can land on a different row and fret based on pitch availability.

### Left-handed tables

The approved implementation rule is:

1. reversed tables keep the same logical row ordering as right-handed tables
2. reversed tables keep fretwise move semantics MIDI-driven rather than visually inverted
3. octave replacement search order across rows is the same as right-handed tables

This matches the current transpose shortcut intent more closely than a visual inversion rule would.

## Final Note-Style Rules

### 1. SingleNotes

1. ordinary cell note
2. `midinum`, `row`, and `col` are meaningful and recomputed on landing
3. collision key is Single lane at row and col

### 2. TinyNotes

1. ordinary cell note
2. `midinum`, `row`, and `col` are meaningful and recomputed on landing
3. collision key is Tiny-or-Bend lane at row and col

### 3. Bends

This is now fully settled.

1. Bends are not TinyNotes in the model.
2. Bends use their own `styleNum` and preserve `bendValue`.
3. Bends share the destination occupancy lane with TinyNotes.
4. Bends must not land on fret 0.

So the coding rule is:

1. persist bends as bends
2. validate bend legality with one shared helper
3. treat Tiny and Bend as mutually colliding at destination cells

### 4. `STYLENUM_MIDIPITCHESSINGLE`

1. recorded cell-bound highlight
2. collision key is same style on same beat and same cell
3. `midinum`, `row`, and `col` are all meaningful and recomputed on landing

### 5. `STYLENUM_MIDIPITCHES`

This is now more specific than version 1.

1. treat it as a recorded pitch-wide highlight note
2. collision key is beat plus `midinum`
3. `midinum` is authoritative and is recomputed by movement
4. `row` is historically meaningful and must be recalculated and persisted on move
5. `col` does not need to be treated as authoritative for persistence in this version

The approved interpretation is that `row` preserves the user's chosen placement context for the highlight even though playback highlights every matching pitch on the table.

## Final Collision Rules

These were approved and should be implemented exactly:

1. Single collides with Single
2. Tiny collides with Tiny and Bend
3. Bend collides with Bend and Tiny
4. `STYLENUM_MIDIPITCHESSINGLE` collides with the same style on the same beat and cell
5. `STYLENUM_MIDIPITCHES` collides by beat plus `midinum`

Additionally:

1. collision is evaluated against the scratch output built so far, not against the raw source collections
2. a colliding newcomer drops with reason `moved note already played`

## Final Dropped-Notes Shape

`droppedNotes` is informational-only, human-readable, and not intended as a downstream schema.

Recommended runtime entry shape for dropped or informational records:

```js
{
	Note: { ...originalNoteClone },
	algorithm: 'octave',
	reason: 'moved note already played',
	optionsSummary: 'motions:u include:[s,t,h,p]',
	applyNumber: 3,
	beat: null,
	tableID: 'tblGuitar_1',
	storageKind: 'played'
}
```

Rules:

1. `beat` should be `null` for played-note entries rather than absent
2. informational entries such as apply-start may omit `Note`
3. `optionsSummary` should be simple and human-readable rather than strict JSON
4. extra fields such as `tableID` and `storageKind` are acceptable and useful

### Apply-start entry

Each `Apply` appends one informational entry before candidate processing. Recommended shape:

```js
{
	algorithm: 'octave',
	reason: 'apply start',
	optionsSummary: 'motions:u include:[s,t,h,p] targetTable:tblGuitar_1',
	applyNumber: 3,
	beat: null,
	tableID: 'tblGuitar_1',
	storageKind: null
}
```

If no include toggles are active, this same apply-start entry should still be written, and the result message should state that the apply was a no-op.

## Internal Module Layout

### New files

1. `plugins/move/MovePlugin.js`
2. `plugins/move/properties.json`
3. `move-helpers.js`

### MovePlugin responsibilities

1. plugin identity and menu structure
2. property definitions and defaults
3. runtime state
4. action dispatch
5. current Section and target-table resolution
6. one-time graveyard backup gate
7. show and clear dropped-notes actions
8. repaint request and result message after apply

### `move-helpers.js` responsibilities

1. candidate collection from one Section and one table
2. normalized intermediate representation
3. movement planning for each style family
4. `drop`, `octave`, and `string` overflow search helpers
5. occupancy checks
6. note reconstruction
7. dropped-note entry construction
8. post-build audit helpers
9. bend legality helper
10. color recalculation helper

## Runtime State Plan

MovePlugin should own the following runtime state:

1. `droppedNotes = []`
2. `applyCounter = 0`
3. `needsSectionBackupBeforeNextApply = true`

Lifecycle rules:

1. plugin load or reset initializes all three
2. each `Apply` increments `applyCounter`
3. each `Apply` may append multiple dropped-notes entries
4. `clear dropped notes` empties `droppedNotes` and sets `needsSectionBackupBeforeNextApply = true`
5. `clear dropped notes` does not reset `applyCounter`

## Menu And Property Plan

Recommended visible menu shape for version 1 coding:

1. `Apply`
2. `algorithm`
3. `motions`
4. `include`
5. `target table`
6. `show dropped notes`
7. `clear dropped notes`
8. `help`

Property defaults:

1. `algorithm = octave`
2. motion selection has one active value at a time
3. all include toggles default false
4. target table defaults to the first valid visible table, following the existing plugin pattern

For version 1:

1. `Enable` remains managed by PluginManager
2. MovePlugin ignores enable state semantically
3. MovePlugin listens to no events
4. `Apply` works whether enabled or not
5. motions remain selection state rather than bang actions in this sprint

## Normalized Intermediate Representation

The scratch planner should operate on normalized candidate objects rather than raw persistence containers.

Recommended shape:

```js
{
	tableID,
	storageKind,      // 'played' | 'recorded'
	beat,             // string beat number or null
	styleNum,
	note,
	sourceRow,
	sourceCol,
	sourceMidinum,
	sourceNoteName,
	sourceIndex
}
```

This remains the right internal representation from version 1 and is now fully aligned with the approved `beat: null` choice for played-note logging.

## Apply Algorithm

### Phase 1. Resolve context

1. resolve current Song and current Section
2. resolve selected target table
3. build current Section lookup context for automatic recolor logic
4. read algorithm, motion, and include properties
5. increment `applyCounter`

### Phase 2. Apply-start logging and backup gate

1. append one apply-start informational entry
2. if `needsSectionBackupBeforeNextApply` is true, bury the current Section and flip the flag to false

Clarification:

1. burying a Section is orthogonal to deleting it
2. no deletion occurs here

### Phase 3. Stable snapshot collection

1. clone the target table's played notes and recorded notes for read planning
2. filter by include toggles and supported style families
3. emit normalized candidate objects

### Phase 4. Candidate ordering

Ordering rules:

1. `jump up`: ascending row index first
2. `jump down`: descending row index first
3. `up` and `down`: preserve stable source order

This ordering is part of the design because it lowers collisions in jump operations.

### Phase 5. Movement planning per candidate

For each candidate:

1. validate `midinum`
2. dispatch by style family
3. compute direct target or overflow search
4. validate legality of landing
5. recompute note fields
6. test occupancy against scratch output
7. either append landed note to scratch output or append dropped-note entry

### Phase 6. Scratch-output rebuild

1. build new `playedNotes`
2. build new `recordedNotes`
3. preserve `namedNotes` untouched
4. preserve all other tables untouched

### Phase 7. Audit

Before writing scratch output back to the real Section model, run audit helpers.

Audit rules:

1. no duplicate Singles at same cell within played or within a recorded beat
2. no duplicate Tiny-or-Bend occupancy at same cell within played or within a recorded beat
3. no duplicate `STYLENUM_MIDIPITCHESSINGLE` at same beat and cell
4. no duplicate `STYLENUM_MIDIPITCHES` at same beat and `midinum`

Repair policy for version 1:

1. keep earliest landed scratch note
2. drop later conflicts
3. log the repair as a dropped-notes informational entry

### Phase 8. Commit and repaint

1. write scratch played and recorded collections back to the target Section table
2. request repaint
3. return a short result string summarizing moved, dropped, and skipped counts

## Style-Specific Planning Rules

### Single, Tiny, and Bend

These can share most of the planner shape:

1. compute desired MIDI result from motion semantics
2. compute landing cell from target MIDI and row rules
3. apply overflow algorithm when needed
4. recalculate `noteName`, `row`, and `col`
5. preserve literal non-functional colors
6. recalculate functional automatic-color classes when appropriate

For Bend specifically:

1. preserve `bendValue`
2. reject fret 0 landing through shared legality helper

### `STYLENUM_MIDIPITCHESSINGLE`

Planner rules:

1. treat as a cell-bound recorded note
2. compute new MIDI
3. compute landing row and col like a normal cell note
4. apply beat-plus-cell collision policy for that style

### `STYLENUM_MIDIPITCHES`

Planner rules:

1. compute new MIDI from the motion or overflow result
2. compute and persist a recalculated row
3. recompute `noteName`
4. do not depend on `col` as authoritative persistence for this style in version 1
5. apply beat-plus-midinum collision policy

Implementation note:

1. because row plus MIDI defines a valid cell in the chosen tuning, row recomputation should be based on the resolved landing string chosen by the algorithm

## Color Recalculation Plan

Follow the approved design and existing colorFunctions behavior.

Rules:

1. if the existing color class is function-driven, such as `note1`, `note2`, and similar automatic-role classes, recalculate from the current Section context and the moved note's new musical function
2. if the existing color class is literal or non-functional, preserve it
3. `noteTransparent` remains safe to preserve
4. styles that use lead-key versus root-key coloring should continue to follow the existing lookup rules already encoded in `colorFunctions.js`

This means MovePlugin should reuse the existing lookup helpers instead of reproducing tonal color logic locally.

## Graveyard Backup Plan

Version 2 confirms the version-1 direction.

1. first `Apply` after a clear buries the current Section as backup
2. no Section deletion occurs
3. later applies do not bury again until `clear dropped notes`

This should be implemented as a simple runtime gate, not as plugin persistence.

## Testing Plan

MovePlugin should still ship with Jest coverage from the start.

### Helper tests

1. candidate collection from one table
2. apply-start informational entry formatting
3. `up` and `down` MIDI semantics on normal and reversed tables
4. `jump up` and `jump down` row semantics on normal and reversed tables
5. `octave` overflow search order
6. `string` overflow search order
7. malformed note drop with `midinum` missing
8. Tiny and Bend mutual collision behavior
9. `STYLENUM_MIDIPITCHESSINGLE` same-beat same-cell collision
10. `STYLENUM_MIDIPITCHES` beat-plus-midinum collision
11. bend legality at fret 0
12. automatic recolor versus literal-color preservation
13. `STYLENUM_MIDIPITCHES` row recalculation and persistence behavior

### Plugin integration tests

1. target table only is modified
2. `Apply` with no include toggles is a no-op plus informational log
3. first apply after clear performs one Section bury
4. repeated applies without clear do not repeat Section backup
5. `show dropped notes` returns a messages payload
6. `clear dropped notes` empties runtime log and reopens backup gate
7. `applyCounter` increments across clears

### Manual UI checks

1. selected table menu behavior
2. left-handed fretwise behavior feels identical to current `/fu` expectations
3. jump behavior on ordinary and P4 tunings
4. playback of moved recorded highlights

## Build Order

Recommended implementation order:

1. add `move-helpers.js` with pure planning helpers and tests
2. implement candidate collection and scratch-output builders
3. implement Single, Tiny, and Bend planning
4. implement `STYLENUM_MIDIPITCHESSINGLE`
5. implement `STYLENUM_MIDIPITCHES` with persisted row recomputation
6. add dropped-notes entry builders and `show/clear` actions
7. add graveyard backup gate
8. add repaint and result messaging
9. add target-table property and plugin menu wiring
10. run targeted Jest coverage and manual verification

This order still postpones the most specialized highlight behavior until the ordinary cell-note path is proven, while now carrying the approved persisted-row rule for `STYLENUM_MIDIPITCHES`.

## Implementation-Time Cautions

These are not open design questions, but they should stay visible while coding.

### 1. Do not treat reversed tables as visual-coordinate data

Use logical row and MIDI semantics from the approved rules. Do not try to invert jump directions because a table is reversed.

### 2. Do not collapse Bend into Tiny in persistence

They share a collision lane, not a style identity.

### 3. Do not overfit `STYLENUM_MIDIPITCHES` to current playback

Playback highlights all matching cells, but persisted row is still meaningful and must survive move operations.

### 4. Do not mutate source arrays in-place during planning

The scratch-output rule is part of the design, not just an implementation convenience.

## Bottom Line

MovePlugin is now defined well enough to code.

The core implementation shape is:

1. collect normalized candidates from one Section and one table
2. plan movement against a stable snapshot
3. build scratch played and recorded outputs
4. enforce the approved collision rules
5. log informational and dropped-note entries in a runtime-only `droppedNotes` array
6. bury the current Section once per clear cycle as backup
7. repaint after commit

The three most important guardrails during coding are:

1. fretwise moves are always MIDI-driven, even on reversed tables
2. Tiny and Bend collide but remain separate styles
3. `STYLENUM_MIDIPITCHES` uses beat-plus-midinum collision while still persisting recalculated row

With those rules fixed, the design-to-code transition should be straightforward.
