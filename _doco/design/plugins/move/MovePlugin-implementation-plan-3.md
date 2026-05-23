# MovePlugin Implementation Plan

## Document Version

- version 3
- based on MovePlugin-design-3.md plus post-review deterministic clarifications from chat
- supersedes MovePlugin-implementation-plan-2.md
- approved as the coding baseline

## Purpose

This version incorporates the final deterministic corrections discovered during review of version 2. These do not reopen the design. They tighten the implementation plan in places where the runtime model is stricter than the previous plan stated.

The biggest changes in version 3 are:

1. legality of a landing cell must be derived from tuning structure, not from a flat "fret 0" assumption
2. `STYLENUM_MIDIPITCHES` must be treated as singular per beat for audit purposes
3. playedNotes take precedence over recordedNotes, both during planning and during audit

## Version 3 Corrections

### 1. Nut legality is structural, not numeric-fret shorthand

The earlier wording "bend must not land on fret 0" was useful shorthand, but it is not precise enough for the actual tuning system.

In this repository:

1. a landing cell's legality depends on the tuning's nut model
2. the nut may differ by row because of `banjoNut`
3. a user tuning may define different per-row nut offsets
4. reversed tables do not change the logical fret number, but they do affect how nut cells are laid out visually

Implementation rule for version 3:

1. MovePlugin helpers must determine whether a candidate cell is legal from the tuning definition itself
2. do not equate "illegal for bend" with `col === 0`
3. instead, compute whether the landing cell is the nut cell for that row, under that tuning
4. reject bends on that nut cell

This strongly supports the helper-based approach. For version 1 coding, the helper should live in `move-helpers.js`. If later the core grows a canonical legality helper, MovePlugin can switch to it.

### 2. `STYLENUM_MIDIPITCHES` should be singular per beat

The earlier plan used beat-plus-midinum collision for `STYLENUM_MIDIPITCHES`. That is still useful for movement identity, but the stricter runtime/UI rule for version 1 should be:

1. only one `STYLENUM_MIDIPITCHES` note should survive per beat
2. if a second one would be placed in the same beat, it must drop
3. audit should enforce singularity per beat even if older data does not

This is stricter than version 2 and should now be treated as the coding rule.

### 3. playedNotes take precedence over recordedNotes

This is the most behaviorally important version-3 correction.

The UI rule is:

1. recorded notes are not supposed to coexist in a cell already occupied by a played note
2. the UI clears the played note before allowing the recorded placement path

So MovePlugin must respect that precedence.

Implementation rule:

1. when planning a recorded-note landing, check the corresponding played-note lane first
2. if a played note already occupies that lane and cell, the recorded candidate must drop
3. audit must also enforce that no recorded note survives in the same lane and cell as a played note

This is in addition to same-family collision rules inside recordedNotes themselves.

## Approved Baseline

The approved baseline from version 2 still holds, with the version-3 corrections above.

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

1. `up` means `midinum + 1`
2. `down` means `midinum - 1`
3. this remains true for reversed or left-handed tables

### Jump motions

1. `jump up` means move to lower row index first
2. `jump down` means move to higher row index first
3. this row orientation does not invert on reversed or left-handed tables
4. when overflow search is needed under `octave` or `string`, candidate replacements are chosen by MIDI truth and the algorithm's row-search order

### Left-handed tables

1. reversed tables keep the same logical row ordering as right-handed tables
2. reversed tables keep fretwise move semantics MIDI-driven rather than visually inverted
3. octave replacement search order across rows is the same as right-handed tables

## Final Note-Style Rules

### SingleNotes

1. ordinary cell note
2. `midinum`, `row`, and `col` are meaningful and recomputed on landing
3. collision key is Single lane at row and col

### TinyNotes

1. ordinary cell note
2. `midinum`, `row`, and `col` are meaningful and recomputed on landing
3. collision key is Tiny-or-Bend lane at row and col

### Bends

1. Bends are not TinyNotes in the model.
2. Bends use their own `styleNum` and preserve `bendValue`.
3. Bends share the destination occupancy lane with TinyNotes.
4. Bends must not land on the nut cell for that row.

### `STYLENUM_MIDIPITCHESSINGLE`

1. recorded cell-bound highlight
2. collision key is same style on same beat and same cell
3. `midinum`, `row`, and `col` are all meaningful and recomputed on landing

### `STYLENUM_MIDIPITCHES`

1. treat it as a recorded pitch-wide highlight note
2. only one `STYLENUM_MIDIPITCHES` note should survive per beat
3. `midinum` is authoritative and is recomputed by movement
4. `row` is historically meaningful and must be recalculated and persisted on move
5. `col` is not authoritative for persistence in version 1

## Final Collision And Precedence Rules

These are the coding rules for version 1.

### Intra-family collisions

1. Single collides with Single
2. Tiny collides with Tiny and Bend
3. Bend collides with Bend and Tiny
4. `STYLENUM_MIDIPITCHESSINGLE` collides with the same style on the same beat and cell
5. `STYLENUM_MIDIPITCHES` is singular per beat

### Cross-storage precedence

1. playedNotes take precedence over recordedNotes
2. a recorded note may not land in a lane and cell already occupied by a played note
3. if it attempts to do so, it drops and logs the reason
4. audit must enforce this rule even if a buggy planning path misses it

### Scratch-output evaluation rule

1. collision is evaluated against scratch output built so far, not against the raw source collections
2. the newcomer is the note that drops
3. the drop reason should remain `moved note already played` unless a more specific deterministic reason is clearer

## Final Dropped-Notes Shape

`droppedNotes` remains informational-only, human-readable, and non-schema.

Recommended runtime entry shape:

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

1. `beat` is `null` for played-note entries
2. informational entries such as apply-start may omit `Note`
3. `optionsSummary` should be simple and human-readable rather than strict JSON
4. `tableID` and `storageKind` are useful and may be included consistently

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
5. occupancy and precedence checks
6. note reconstruction
7. dropped-note entry construction
8. post-build audit helpers
9. tuning-derived landing legality helpers
10. color recalculation helper

## Runtime State Plan

MovePlugin should own:

1. `droppedNotes = []`
2. `applyCounter = 0`
3. `needsSectionBackupBeforeNextApply = true`

Lifecycle:

1. plugin load or reset initializes all three
2. each `Apply` increments `applyCounter`
3. `clear dropped notes` empties `droppedNotes` and sets `needsSectionBackupBeforeNextApply = true`
4. `clear dropped notes` does not reset `applyCounter`

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
4. target table defaults to the first valid visible table, following existing plugin patterns

For version 1:

1. `Enable` remains managed by PluginManager
2. MovePlugin ignores enable state semantically
3. MovePlugin listens to no events
4. `Apply` works whether enabled or not
5. motions remain selection state rather than bang actions in this sprint

## Normalized Intermediate Representation

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

## Apply Algorithm

### Phase 1. Resolve context

1. resolve current Song and current Section
2. resolve selected target table and its tuning
3. build current Section lookup context for automatic recolor logic
4. read algorithm, motion, and include properties
5. increment `applyCounter`

### Phase 2. Apply-start logging and backup gate

1. append one apply-start informational entry
2. if `needsSectionBackupBeforeNextApply` is true, bury the current Section and flip the flag to false

### Phase 3. Stable snapshot collection

1. clone the target table's played notes and recorded notes for read planning
2. filter by include toggles and supported style families
3. emit normalized candidate objects

### Phase 4. Candidate ordering

1. `jump up`: ascending row index first
2. `jump down`: descending row index first
3. `up` and `down`: preserve stable source order

### Phase 5. Movement planning per candidate

For each candidate:

1. validate `midinum`
2. dispatch by style family
3. compute direct target or overflow search
4. validate landing legality from the tuning and row-specific nut definition
5. recompute note fields
6. test occupancy against scratch output
7. if recorded, test precedence against played-note scratch occupancy
8. either append landed note to scratch output or append dropped-note entry

### Phase 6. Scratch-output rebuild

1. build new `playedNotes`
2. build new `recordedNotes`
3. preserve `namedNotes` untouched
4. preserve all other tables untouched

### Phase 7. Audit

Before committing scratch output:

1. no duplicate Singles at same cell within played or within a recorded beat
2. no duplicate Tiny-or-Bend occupancy at same cell within played or within a recorded beat
3. no duplicate `STYLENUM_MIDIPITCHESSINGLE` at same beat and cell
4. only one `STYLENUM_MIDIPITCHES` survives per beat
5. no recorded note survives in a lane and cell already occupied by a played note

Repair policy:

1. keep earliest landed scratch note
2. drop later conflicts
3. log the repair as a dropped-notes informational entry

### Phase 8. Commit and repaint

1. write scratch played and recorded collections back to the target Section table
2. request repaint
3. return a short result string summarizing moved, dropped, and skipped counts

## Style-Specific Planning Rules

### Single, Tiny, and Bend

Shared planner shape:

1. compute desired MIDI result from motion semantics
2. compute landing cell from target MIDI and row rules
3. apply overflow algorithm when needed
4. recalculate `noteName`, `row`, and `col`
5. preserve literal non-functional colors
6. recalculate functional automatic-color classes when appropriate

For Bend specifically:

1. preserve `bendValue`
2. reject nut-cell landing through shared legality helper

### `STYLENUM_MIDIPITCHESSINGLE`

1. treat as a cell-bound recorded note
2. compute new MIDI
3. compute landing row and col like a normal cell note
4. apply beat-plus-cell collision policy for that style
5. respect played-note precedence for its lane

### `STYLENUM_MIDIPITCHES`

1. compute new MIDI from the motion or overflow result
2. compute and persist a recalculated row
3. recompute `noteName`
4. enforce singularity per beat
5. do not depend on `col` as authoritative persistence for this style in version 1

## Color Recalculation Plan

Rules:

1. if the existing color class is function-driven, such as `note1`, `note2`, and similar automatic-role classes, recalculate from the current Section context and the moved note's new musical function
2. if the existing color class is literal or non-functional, preserve it
3. `noteTransparent` remains safe to preserve
4. styles that use lead-key versus root-key coloring should continue to follow the existing lookup rules already encoded in `colorFunctions.js`

## Graveyard Backup Plan

1. first `Apply` after a clear buries the current Section as backup
2. no Section deletion occurs
3. later applies do not bury again until `clear dropped notes`

## Testing Plan

### Helper tests

1. candidate collection from one table
2. apply-start informational entry formatting
3. `up` and `down` MIDI semantics on normal and reversed tables
4. `jump up` and `jump down` row semantics on normal and reversed tables
5. `octave` overflow search order
6. `string` overflow search order
7. malformed note drop with `midinum` missing
8. Tiny and Bend mutual collision behavior
9. row-specific nut legality for bends and other landing checks
10. `STYLENUM_MIDIPITCHESSINGLE` same-beat same-cell collision
11. `STYLENUM_MIDIPITCHES` singular-per-beat audit
12. played-note precedence over recorded-note placement
13. automatic recolor versus literal-color preservation
14. `STYLENUM_MIDIPITCHES` row recalculation and persistence behavior

### Plugin integration tests

1. target table only is modified
2. `Apply` with no include toggles is a no-op plus informational log
3. first apply after clear performs one Section bury
4. repeated applies without clear do not repeat Section backup
5. `show dropped notes` returns a messages payload
6. `clear dropped notes` empties runtime log and reopens backup gate
7. `applyCounter` increments across clears

## Build Order

1. add `MovePlugin-implementation-plan-3.md`
2. add `move-helpers.js` with pure planning helpers and tests
3. implement candidate collection, legality helpers, and scratch-output builders
4. implement Single, Tiny, and Bend planning
5. implement `STYLENUM_MIDIPITCHESSINGLE`
6. implement `STYLENUM_MIDIPITCHES` with singular-per-beat rule and persisted row recomputation
7. add dropped-notes entry builders and `show/clear` actions
8. add graveyard backup gate
9. add repaint and result messaging
10. add target-table property and plugin menu wiring
11. run targeted Jest coverage and manual verification

## Bottom Line

MovePlugin is approved for coding with these additional guardrails:

1. landing legality must come from the actual tuning and row-specific nut structure
2. `STYLENUM_MIDIPITCHES` is singular per beat for audit and placement
3. playedNotes take precedence over recordedNotes

With those corrections applied, the implementation can proceed deterministically.