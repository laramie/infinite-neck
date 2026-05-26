# MovePlugin Iteration 1 Review

## Scope understood

The feature intends to add a new Plugin Manager plugin under `file > plugins > move` that operates on the current Section only, and moves non-Named note content using menu-selected motion commands and menu-selected overflow algorithms.

At a high level, the design is feasible, but it is not implementation-ready yet. The largest open issues are:

1. target scope is underspecified at the table level
2. collision and replacement semantics are unspecified
3. several note-style rules are ambiguous or internally inconsistent
4. current code has no existing played/recorded move pipeline to reuse end-to-end
5. a few terminology and documentation problems will cause coding mistakes if not normalized first

## Confirmed codebase facts that affect the design

These are important because they change what is easy versus risky in implementation:

1. The current transposition path only fully implements NamedNotes movement. In `Song.js`, `movePlayedNotesAllSections()` and `moveRecordedNotesAllSections()` are still stubs that only log `not implemented`.
2. The existing `transposeSong()` entry point in `infinite-neck.js` is all-sections oriented, not current-section oriented, so MovePlugin should not be built as a thin wrapper around that function.
3. The persistence shape for a Section is per-table: `section.sectionNotesByTable[tableID].playedNotes`, `namedNotes`, and `recordedNotes[beat]`.
4. Bend notes already have a UI rule that forbids placing them on fret 0. That behavior exists today in `NoteTableController.colorSingleNotes()`.
5. Plugins can return a `message` payload and the command system will route it to `showMessages(...)`, so `show dropped notes` is straightforward.
6. Plugin property toggles and nested plugin menus are already supported cleanly by the Plugin Manager infrastructure.

## Design holes

### 1. Table scope is missing

The document says "current Section only", but the data model stores notes under `sectionNotesByTable[tableID]`. The design does not say whether MovePlugin should:

1. affect all tables in the current Section
2. affect only the currently displayed / focused table
3. affect a plugin-selected target table, similar to other plugins

This is the largest missing scope decision. Without it, the core traversal logic cannot be designed correctly.

### 2. Collision semantics are not defined

When a moved note lands on a cell already occupied by another eligible note of the same style family, the design does not specify what happens.

Examples:

1. two played SingleNotes move onto the same row/col
2. a moved recorded TinyNote lands on a beat/cell already containing another TinyNote
3. a moved HighlightSingle lands on a cell already visually occupied by another HighlightSingle for the same beat
4. a moved note lands on a cell occupied by an ineligible note type that is not being moved in this pass

Possible policies would be keep-both, dedupe, overwrite, skip-and-log, or merge-by-style. The design needs one explicit answer.

### 3. Mixed highlight behavior is underspecified

The document correctly notes that HighlightSingle behaves fundamentally differently from HighlightMulti, because HighlightSingle is tied to a concrete MIDI pitch and therefore cannot participate in "drop", "octave", and "string" in the same way.

But the menu exposes only one `h) highlights` toggle, which means a single Apply can select both highlight styles while the algorithm treats them differently.

Open questions:

1. Is the chosen algorithm ignored for HighlightSingle notes?
2. Are HighlightSingle notes always moved by direct MIDI change regardless of selected algorithm?
3. If so, should the user be warned that the algorithm applies only to HighlightMulti?
4. Should there actually be two include toggles instead of one?

As written, this will surprise users and coders alike.

### 4. Bend inclusion is ambiguous

The include menu offers Single, Tiny, Highlight, Played, and Recorded. There is no Bend toggle and no explicit statement that bends are excluded.

However, the design contains a Bend handling section, which implies bends may be encountered during movement.

That leaves three possible interpretations:

1. bends are included implicitly under Tiny or Single handling
2. bends are excluded from MovePlugin but need defensive code if encountered
3. bends should get their own include toggle later

This must be resolved explicitly. Right now the document points in more than one direction.

### 5. Source-of-truth fields are not defined

Persisted notes can carry `noteName`, `midinum`, `row`, `col`, `colorClass`, and sometimes bend-specific fields. The design talks mostly in terms of moving notes by row/col and by MIDI arithmetic, but does not specify which fields must be recomputed after a move.

That matters because a bad implementation could update only `row` and `col`, or only `midinum`, and leave the note internally inconsistent.

The next iteration should explicitly state:

1. whether `midinum` is authoritative
2. whether target `noteName` must always be recomputed from the destination cell / MIDI
3. whether `colorClass` is preserved verbatim
4. whether any other derived fields must be normalized after mutation

### 6. Missing behavior for malformed or sparse persisted notes

The repo schema documentation explicitly allows some persisted notes to be sparse. The MovePlugin design assumes MIDI-based search and movement are always possible, but does not specify what happens when an eligible note is missing `midinum`, `row`, or `col`.

Implementation needs a rule such as:

1. skip and log
2. drop and log
3. throw and abort the entire Apply

Without this, edge-case songfiles will produce undefined behavior.

### 7. `droppedNotes` lifetime is not defined

The design defines the content of `droppedNotes`, but not its lifecycle.

Missing decisions:

1. Is it cumulative across multiple `Apply` operations?
2. Is it cleared automatically on each `Apply`?
3. Is it cleared on plugin disable?
4. Is it cleared on song load?
5. Is it persisted into song plugin state, or runtime only?

My recommendation is runtime-only and cumulative until `clear dropped notes`, but that should be stated explicitly.

### 8. Apply atomicity is not defined

The design does not say whether one `Apply` is best-effort or transactional.

For example, if 100 notes are eligible and note 61 hits malformed data or an unexpected state:

1. should the first 60 mutations remain applied?
2. should the whole operation abort and roll back?
3. should the plugin continue and log the failure?

The easiest implementation is best-effort with per-note logging, but the document should say so.

### 9. Iteration order can affect results, but is not specified

When multiple notes are moved in place, the mutation order can change the result if collisions or replacements matter.

Examples:

1. mutating an array while iterating it
2. moving two notes into each other’s original positions
3. computing replacements based on already-moved earlier notes

The design should require a two-phase algorithm:

1. collect eligible source notes from a stable snapshot
2. compute destinations from the snapshot
3. write the results after planning

If this is not specified, subtle bugs are likely.

## Coding problems and implementation challenges

### 1. There is no ready-made movement API for played/recorded notes

Named note transposition already exists, but MovePlugin needs a new model-layer pipeline for:

1. iterating current-section notes
2. filtering by note family and storage location
3. computing candidate destinations per note
4. applying updates into `playedNotes` arrays and `recordedNotes[beat]` arrays
5. collecting dropped-note logs

This is not a trivial plugin-only patch. It needs model work, and likely new helper functions.

### 2. The design says "same visual effect" but the underlying semantics differ sharply

The document is already aware of this, but it is still a coding hazard. The user sees motions named like keyboard transpose actions, while implementation actually needs at least three categories of logic:

1. coordinate shift on row/col
2. pitch remap by MIDI +/- 12
3. special-case HighlightSingle direct MIDI movement

This makes it important to define exact invariants per style before coding.

### 3. `octave` search rules are implementable but fragile without utility functions

The described wrap search is precise in intent, but it is easy to code incorrectly. It needs reusable helpers for:

1. enumerating candidate rows in the required wrap order
2. testing whether a MIDI pitch exists on a row within fret bounds
3. separating search order from destination validity

If implemented inline inside a plugin action handler, it will become difficult to test.

### 4. Recorded-note mutation is structurally more complex than played-note mutation

Played notes live in one array per table. Recorded notes live in a dictionary of arrays keyed by beat. `droppedNotes` also wants the beat only for recorded notes.

That means any shared movement engine must either:

1. work on a normalized intermediate representation containing `tableID`, `beat`, `storageKind`, and `note`
2. or duplicate movement logic for played and recorded storage shapes

The first option is much safer.

### 5. UI refresh expectations need to be explicit

The document says the algorithm should work on the model and not emit events. That may be fine for recorded notes during looping, but MovePlugin will also operate on visible played notes.

Implementation therefore needs a clean answer to:

1. whether `Apply` should request a repaint after model mutation
2. whether active looping should be stopped first, as PluginManager sometimes does for other operations
3. whether any visual refresh is required even if no notes were moved

"Do not emit any events" is probably too absolute. The safer rule is "do not mutate through UI events; mutate the model directly, then request the appropriate repaint once."

### 6. Reversed tables and user-facing direction remain a usability risk

The document intentionally defines motion by persisted row numbers and visual table direction rather than tuning theory. That is reasonable, but tables can also be reversed visually, and the repository already has left-hand bend CSS behavior.

Even if the implementation follows persisted row numbering exactly, users may still perceive motion direction differently on reversed tables. The document should warn that MovePlugin uses model row order, not instrument-theory string order and not necessarily perceived pitch direction.

### 7. Duplicating bend rules instead of sharing them is a maintenance risk

The Bend section says the plugin does not need to call shared code and can duplicate existing behavior. That will work short-term, but it creates a drift risk if nut/fret validation rules change later.

Recommendation: even if full code reuse is not done now, the implementation plan should identify one shared predicate or helper for "is bend placement legal".

### 8. Testing will need fixture-heavy coverage

The feature combines:

1. multiple note styles
2. played versus recorded storage
3. three overflow algorithms
4. four motions
5. multiple tunings and fret ranges
6. bend edge cases
7. dropped-note logging

This has enough cross-product complexity that ad hoc manual testing will miss regressions. The implementation plan should assume targeted Jest tests from the start.

## Document problems and contradictions

### 1. Highlight terminology is still unsafe

The document acknowledges inconsistent names, but it does not fully normalize them. That is risky because the runtime code already contains confusing naming too.

In `Note.js`, the current `styleNumToCaption()` mapping is:

1. `STYLENUM_MIDIPITCHES` -> `Pitch`
2. `STYLENUM_MIDIPITCHESSINGLE` -> `Multi`

That is counterintuitive relative to the prose names HighlightMulti / HighlightSingle, and is exactly the kind of mismatch that causes coding mistakes.

The next iteration should define one canonical naming table and use only that table throughout the spec.

### 2. `string` algorithm section 3(b) is contradictory on first read

The text says jump up / jump down are "not logically possible, so notes are dropped when we run out of strings." Then it says notes *are* moved jump up / jump down as in `drop` and `octave`, but without replacement search.

I believe the intended meaning is:

1. a normal one-row jump is allowed
2. only overflow replacement is impossible
3. therefore overflow causes drop

That should be rewritten more directly.

### 3. `up` / `down` wording mixes motion names with fret direction and octave direction

Several paragraphs use "up" and "down" in different senses:

1. command trigger naming
2. row movement on the screen
3. fret-number increase or decrease
4. MIDI +12 / -12 octave substitution

The document tries to constrain this, but the prose still drifts between meanings. A small terminology table would reduce errors.

### 4. `droppedNotes` object shape should be declared as exact runtime JSON

The log entry format is described in prose and sample JSON, but several details remain unclear:

1. whether `Note` is a deep clone of the original payload before mutation
2. whether numeric-looking values stay strings, matching persisted data
3. whether extra fields like `bendValue`, `finger`, or plugin-specific future fields must be preserved in the logged `Note`

This should be written as an exact shape contract.

### 5. The spec does not state whether `Apply` with no include toggles is a no-op or an error

All include toggles default to false. That is reasonable, but the document does not say what `A) Apply` should do when nothing is selected.

It should explicitly choose one of:

1. no-op with status message
2. no-op with warning in messages
3. hard error

I recommend no-op with a clear status message.

### 6. The spec does not state whether algorithm selection also defaults

The include toggles have a default, but the algorithm does not. If there is no explicit default algorithm, the first `Apply` behavior is undefined.

Recommendation: default to `drop`, or require explicit algorithm selection and surface the unset state in the menu.

### 7. There is no stated undo or recoverability story beyond external backups

The document says there is no restore feature and users can back up songfiles or use graveyard beforehand. That may be acceptable, but the plugin still needs a crisp user warning because `Apply` is destructive and can drop notes.

If no undo is planned, the plugin help text and maybe pre-apply status should say so clearly.

## Recommended clarifications for Iteration 2

Before implementation planning, I recommend locking down these decisions in the design:

1. exact table scope: all tables in current Section, current table only, or selected target table
2. exact include matrix, including bends and the split between HighlightMulti and HighlightSingle
3. exact collision policy when a destination is already occupied
4. exact lifecycle of `droppedNotes`
5. exact field-normalization rules after movement: `midinum`, `noteName`, `row`, `col`, and preserved fields
6. exact behavior for malformed/sparse notes
7. exact no-selection and no-algorithm behavior for `Apply`
8. exact repaint / event behavior after model mutation
9. exact testing matrix and the minimum supported tuning / fret edge cases

## Bottom line

The feature direction is sound, and the Plugin Manager/menu framework appears capable of hosting it. The main blocker is not plugin infrastructure; it is semantic precision. The design needs one more tightening pass so implementation does not accidentally encode the wrong movement rules for mixed note styles, multi-table Sections, and destructive overflow cases.
