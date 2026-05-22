# MovePlugin Implementation Plan

## Document Version

- version 1
- based on MovePlugin-design-2.md
- this plan is intentionally not the final word on all semantics
- version 2 should tighten the remaining open questions after we inspect a few more runtime edge cases during coding or targeted fixture review

## Goal Of This Plan

Iteration 2 answers many design questions, so the job here is not to redesign the feature from scratch. The job is to turn the current design into an implementation sequence that is safe for the repository, while still flagging the few places where code facts and design intent are not perfectly aligned yet.

This plan therefore does four things:

1. translates the accepted design into code work items
2. explains a few areas where the code behaves differently than the current intuition
3. proposes a safe internal structure for MovePlugin
4. leaves a short list of questions for version 2 rather than pretending they are already settled

## Confirmed Decisions From Iteration 2

The following are now treated as accepted input for implementation version 1:

1. scope is current Section and one selected table at a time
2. the move engine lives in MovePlugin, not in Song or infinite-neck core helpers
3. movement is snapshot-based, using scratch-output semantics rather than mutating the live arrays in-place
4. collision with an already-landed moved note causes the newcomer to drop with reason `moved note already played`
5. `midinum` is authoritative
6. `noteName`, `row`, and `col` are recomputed from the landing location
7. malformed notes with no `midinum` are dropped and logged
8. `droppedNotes` persists for the plugin runtime until explicitly cleared
9. `Apply` continues through all candidate notes and logs problems rather than aborting early
10. helper utilities may live in a new shared module `move-helpers.js`
11. `Apply` with no include toggles is a no-op plus logging
12. default algorithm is `octave`
13. first `Apply` after a clear should bury the current Section once, then remain quiet until the next clear

## Important Code Facts To Carry Forward

These are facts from the current codebase that the implementation must respect.

### 1. Current transpose shortcut behavior is semitone-based, not a separate LH algorithm

The `/fu` keyboard path currently calls `transpose(amount)` with `+1`, `-1`, `+5`, and `-5`. The left-handed visual behavior comes primarily from table rendering, where reversed tables render fret numbers right-to-left while persisted `cellcol` still represents logical fret number.

Implication for MovePlugin:

1. `col` remains logical fret number, even on reversed tables
2. a move that changes `col` from `0` to `1` already appears on the opposite visual side in a reversed table
3. therefore we should not blindly invert every movement rule just because a table is left-handed

What still needs care is the user-facing visual intent for `u`, `d`, `j`, and `J`. Version 2 should pin down whether only fretwise motions need reinterpretation for reversed tables, or whether jump motions should remain pure row moves.

### 2. Bends are not TinyNotes in the model

This is the most important clarification to make explicit.

In code:

1. TinyNotes use `Note.STYLENUM_TINY`
2. Bends use `Note.STYLENUM_BEND`
3. playback renders bends through the tiny-note lane, but they are still a separate note type with extra `bendValue` state

So the safe implementation rule is:

1. treat bends as their own style for persistence and logging
2. treat bends as colliding with tiny notes for destination occupancy because they share the same visual lane and user expectation
3. keep one shared legality helper for bend placement, especially fret 0 rejection

This is the place where the design simplification "Bends are TinyNotes" does not match the actual code model.

### 3. `STYLENUM_MIDIPITCHES` is not a normal cell note in replay

Recorded `Note.STYLENUM_MIDIPITCHES` currently replays by selecting every table cell matching the note's `midinum`. The replay path ignores `row` and highlights the whole pitch across the table.

Implication:

1. `STYLENUM_MIDIPITCHES` should be handled as a pitch-wide highlight note, not as an ordinary row/col occupant
2. its movement can still be `midinum`-based, but collision rules cannot be copied directly from Single/Tiny/Bend behavior
3. any audit logic for these notes should likely key on `midinum` per beat, not on `row` and `col`

This is one of the areas that should stay explicit in version 2.

### 4. Automatic recolor support already exists

The repository already has the color lookup path needed for your accepted recolor rule:

1. preserve literal colors that are not function-driven
2. recompute function-driven classes such as `note1`, `note2`, etc. from the current Section context

That means MovePlugin should not invent a new color algorithm. It should reuse the existing lookup logic from `colorFunctions.js` with a current-section lookup context.

### 5. Section graveyard backup already has a valid persistence path

The graveyard already supports burying Sections. MovePlugin does not need a custom backup format for this first pass. It only needs a small runtime gate so the first `Apply` after a clear performs one Section bury, and later applies do not repeat that backup until the next clear.

## Explanation Of The Earlier "Ineligible Note Type" Concern

You asked what was meant by "a moved note lands on a cell occupied by an ineligible note type that is not being moved in this pass."

The concern was this:

1. the menu may select only Singles, leaving TinyNotes, Bends, or Highlights untouched
2. the destination cell may already contain one of those untouched note kinds
3. MovePlugin then needs a rule for whether the moved note may coexist with that untouched note or must drop

This matters because the model and UI do permit different note families to coexist in the same cell in some cases. For example, SingleNotes and TinyNotes use different display lanes. But TinyNotes and Bends do not really behave like independent lanes from the user's point of view, because bends render through the tiny-note path.

So the implementation should not use a single universal collision rule. It should use an occupancy policy by lane or family:

1. Single collides with Single
2. Tiny collides with Tiny and Bend
3. Bend collides with Bend and Tiny
4. `STYLENUM_MIDIPITCHESSINGLE` collides with the same style on the same beat and cell
5. `STYLENUM_MIDIPITCHES` needs its own beat-plus-midinum rule

That is the safest translation of the current runtime behavior.

## Proposed Internal Structure

The main implementation recommendation is to keep MovePlugin thin at the menu layer and move all note planning logic into helpers.

### New files

1. `plugins/move/MovePlugin.js`
2. `plugins/move/properties.json`
3. `move-helpers.js`

### MovePlugin responsibilities

1. plugin identity, menu, and property definitions
2. runtime plugin state such as `droppedNotes`, apply counter, and backup gate
3. current-table resolution
4. action dispatch for `Apply`, `show dropped notes`, and `clear dropped notes`
5. repaint request after successful played-note mutation
6. one-time graveyard backup gating

### `move-helpers.js` responsibilities

1. candidate collection from one Section and one table
2. normalized intermediate note representation
3. motion planning and algorithm search helpers
4. destination occupancy checks
5. note reconstruction after landing
6. dropped-note log construction
7. legality checks such as bend-at-nut rejection
8. final audit helpers for produced played and recorded note sets

## Normalized Intermediate Representation

Implement the move engine against a normalized array of candidate objects rather than directly against raw played/recorded storage.

Recommended shape:

```js
{
	tableID,
	storageKind,      // 'played' | 'recorded'
	beat,             // string beat number for recorded, null for played
	styleNum,
	note,
	sourceRow,
	sourceCol,
	sourceMidinum,
	sourceNoteName,
	sourceIndex       // original stable ordering within its array
}
```

Benefits:

1. one move planner can handle played and recorded notes
2. dropped-note logging becomes straightforward
3. stable ordering rules become explicit
4. scratch-output generation becomes simpler

## Proposed Apply Pipeline

### Phase 1. Resolve context

1. resolve current Song, current Section, and selected target table
2. resolve current Section lookup context for color calculations
3. read current plugin property selections
4. increment runtime apply counter

### Phase 2. Start logging and backup gate

1. append the synthetic apply-start `droppedNotes` entry
2. if backup gate is open, bury the current Section once and close the gate

For version 1, use a plain string reason for the options line exactly as requested, even though it is not strict JSON inside the `reason` string.

### Phase 3. Gather candidates from a stable snapshot

1. clone the target table's played and recorded note collections for read planning
2. filter by include toggles and supported styles
3. create normalized candidate entries
4. sort candidates by motion-specific processing order

Recommended sort rules:

1. for `jump up`, process ascending row index first
2. for `jump down`, process descending row index first
3. for `up` and `down`, preserve stable source order unless a later test proves row ordering reduces collisions materially

This matches the design clarification and avoids in-place mutation hazards.

### Phase 4. Plan each candidate move

For each candidate:

1. validate required fields
2. route by style family
3. compute direct destination or overflow search
4. test legality of the landing spot
5. test occupancy against the scratch output already built so far
6. either emit a landed note into scratch output or append a drop log entry

### Phase 5. Rebuild target storage

1. replace the target table's `playedNotes` with the scratch played output
2. replace the target table's `recordedNotes` with the scratch recorded output
3. preserve `namedNotes` untouched
4. preserve other tables in the Section untouched

### Phase 6. Audit

After building scratch output, run validation helpers before writing to the real Section object.

Audit rules for version 1:

1. no duplicate SingleNotes at same cell within played or within a recorded beat
2. no duplicate Tiny-or-Bend occupancy at same cell within played or within a recorded beat
3. no duplicate `STYLENUM_MIDIPITCHESSINGLE` at same cell within a recorded beat
4. no duplicate `STYLENUM_MIDIPITCHES` at same beat plus `midinum`

If an audit failure appears, the safest version-1 behavior is:

1. do not throw
2. log a dropped-note style entry describing the audit repair
3. prefer keeping the earliest landed scratch note and dropping later conflicts

### Phase 7. Repaint and status

1. request repaint after successful apply
2. return a short result string summarizing moved and dropped counts
3. do not depend on plugin enablement state

## Style-Specific Handling Plan

### 1. SingleNotes

1. ordinary cell note
2. uses row, col, and midinum
3. collision key is Single lane at row/col
4. color recalculation uses current Section root context if automatic-color class applies

### 2. TinyNotes

1. ordinary cell note
2. shares destination lane with bends
3. collision key is Tiny-or-Bend lane at row/col

### 3. Bends

1. separate persisted style from Tiny
2. shares destination lane with Tiny for occupancy purposes
3. preserve `bendValue`
4. reject landing on fret 0 using a shared bend legality helper

### 4. `STYLENUM_MIDIPITCHESSINGLE`

1. ordinary recorded cell highlight
2. collision key is same style at same beat and cell
3. movement uses direct landing cell recomputation from `midinum`
4. because these are still cell-bound in replay, row/col remain meaningful

### 5. `STYLENUM_MIDIPITCHES`

1. treat as recorded pitch-wide highlight note
2. primary authoritative key is `midinum`
3. movement should update `midinum` and recompute `noteName`
4. row/col should be preserved only if a valid landing cell is intentionally defined for logging or normalization

Version 2 needs to decide whether these notes should carry a canonical row/col at all after movement, or whether they should remain minimal pitch records.

## Menu And Plugin Property Plan

Follow current plugin infrastructure rather than inventing a special UI path.

Recommended menu children:

1. `Apply`
2. `algorithm`
3. `motions`
4. `include`
5. `target table`
6. `show dropped notes`
7. `clear dropped notes`
8. optional `help`

For version 1:

1. `Enable` remains managed by PluginManager and is ignored semantically
2. MovePlugin should not subscribe to runtime events
3. `Apply` should work whether enabled or not
4. motions remain selection state, not bang actions yet

That matches your request to defer bang-motion execution to a later sprint.

## Dropped Notes Plan

Use `droppedNotes` as runtime-only plugin state.

Recommended entry families:

1. apply-start entry
2. note-drop entry
3. audit-repair entry if needed

Recommended note-drop shape for version 1:

```js
{
	Note: { ...originalNoteClone },
	algorithm: 'octave',
	reason: 'moved note already played',
	beat: '2',
	tableID: 'tblGuitar_1',
	storageKind: 'recorded'
}
```

Notes:

1. `beat` should be absent or null for played notes
2. keeping `tableID` and `storageKind` is useful for debugging and consistent with the normalized intermediate representation
3. since this structure is for humans and not downstream parsing, extra fields are acceptable when they simplify safe coding

## Graveyard Backup Plan

Version 1 should use a simple runtime boolean, for example:

1. `needsSectionBackupBeforeNextApply = true` on plugin load
2. first `Apply` buries current Section and flips it to false
3. `clear dropped notes` empties the log, resets apply counter if desired only if you want that semantics later, and reopens the backup gate

My recommendation is:

1. clearing `droppedNotes` reopens the backup gate
2. clearing `droppedNotes` does not reset the apply counter unless you explicitly want the log numbering to restart

Your current design says the apply counter is for the life of the plugin in the session, so version 1 should keep incrementing across clears.

## Testing Plan

MovePlugin should ship with Jest coverage from the start. The cross-product is too large to rely on manual tests alone.

### Core helper tests

1. collect normalized candidates from one table
2. direct `up`, `down`, `jump up`, `jump down` destination planning
3. `octave` overflow search order
4. `string` overflow search order
5. malformed note drop behavior
6. collision handling into scratch output
7. bend legality at fret 0
8. color recalculation decisions for automatic versus literal classes

### Plugin integration tests

1. `Apply` no-op with no include toggles
2. `Apply` logs synthetic start entry
3. first apply after clear performs one Section backup
4. repeated apply without clear does not create repeated Section backups
5. `show dropped notes` returns JSON payload message
6. `clear dropped notes` empties runtime log and reopens backup gate
7. selected target table only is modified

### Left-handed tests

1. reversed table `up` and `down` visual-equivalence behavior
2. reversed table `jump up` and `jump down` behavior

These tests should be written after the version-2 clarification below is settled.

## Proposed Build Order

1. add `move-helpers.js` with pure helper functions and tests
2. implement normalized candidate collection and scratch-output builder
3. implement Single, Tiny, and Bend movement first
4. add `STYLENUM_MIDIPITCHESSINGLE`
5. add `STYLENUM_MIDIPITCHES`
6. add dropped-notes logging and `show/clear` actions
7. add graveyard backup gate
8. add repaint / result messaging
9. add target-table property and plugin menu wiring
10. run targeted Jest coverage and manual UI verification

This order deliberately postpones the most ambiguous highlight behavior until the ordinary cell-note pipeline is proven.

## Open Questions For Version 2

These are the places where another design pass is still useful.

### 1. Reversed-table semantics for motion names

The current codebase proves that reversed tables are mostly a rendering concern and that persisted `col` remains logical fret number. But your clarification says MovePlugin should emulate the visual behavior of `/fu` on left-handed tunings.

Version 2 should answer explicitly:

1. should `up` always mean `midinum + 1`, even on reversed tables
2. or should `up` mean visually left/right motion relative to the page on reversed tables
3. do `jump up` and `jump down` also invert under reversed tables, or only fretwise motions

My present recommendation is:

1. keep jump motions row-based and not reversed
2. keep fret motions semitone-based unless a manual UI check proves the user expectation differs

### 2. Canonical persisted shape for `STYLENUM_MIDIPITCHES`

Because replay ignores `row`, version 2 should decide whether these notes should:

1. always keep a canonical row/col anyway for debugging consistency
2. or persist only `midinum`, `noteName`, `styleNum`, and color state where possible

### 3. Exact formatting of synthetic apply-start droppedNotes entries

The design currently wants a non-JSON-ish options string embedded inside the `reason`. That is acceptable for version 1, but version 2 may want to separate:

1. `reason`
2. `optionsSummary`
3. `applyNumber`

That would make human reading easier while keeping the log flexible.

### 4. Whether `clear dropped notes` should also reset the apply counter

The current reading is no. Version 2 should confirm that explicitly.

## Bottom Line

The feature is now implementable with one important qualification: MovePlugin should be built around a normalized scratch-planning engine, not around ad hoc direct mutation of `playedNotes` and `recordedNotes` arrays.

The main technical caution points are:

1. bends are their own style even though they share the tiny-note lane
2. `STYLENUM_MIDIPITCHES` is a pitch-wide highlight, not a normal cell occupant
3. reversed-table behavior should be validated against actual UI expectations before the final left-handed rules are frozen

With those guarded explicitly, version 1 can proceed to coding in a staged way, and version 2 can stay focused on tightening the remaining semantic edges rather than reopening the whole design.
