# FillPlugin Implementation Plan

## Purpose

This document is the stable implementation plan and maintenance reference for the first FillPlugin sprint.

It records the approved product behavior, the recommended implementation shape, the expected file touch points, and the acceptance criteria.

This document intentionally focuses on the chosen design for the current sprint. Rejected alternatives and earlier exploratory discussion remain in:

- `_doco/design/FillPlugin-design.md`
- `_doco/design/FillPlugin-design-copilot.md`

## Scope

This sprint implements FillPlugin as a new plugin following the current plugin architecture used by ArpeggioPlugin and TransposePlugin.

The first sprint scope is intentionally narrow:

- implement `SingleNote` fill only
- implement plugin-owned persisted notes
- implement root / chord / scale role behavior
- implement current-section apply behavior
- implement `Clear`, `ClearSong`, and `Commit Notes`
- implement explicit target-table selection
- move current Fill-page chord and scale option values into `Constants.js`
- add a small `PalettePresentation` getter for the last restorable color

Out of scope for this sprint:

- named-note fill in FillPlugin
- other played-note families beyond `SingleNote`
- dynamic submenu handoff into `/pr`
- Tonal.js canonical-name alignment
- generalized cross-plugin refactors

## No Major Holes

At this point I do not see any major product-design holes blocking implementation.

The remaining work is mostly implementation detail, not unresolved behavior.

The main implementation recommendation that is still a design choice for engineers is this:

- candidate fill cells should be derived from tuning data and note math rather than by scraping DOM state

That is a technical recommendation, not an open product question.

## Approved Product Design

### Plugin Identity

- plugin name: `FillPlugin`
- plugin lives in its own plugin directory
- implementation is separate from the existing Fill page code path

### Note Family

- only `SingleNote` is implemented in this sprint
- `SingleNote` means persisted played-note entries with `styleNum = Note.STYLENUM_SINGLE`
- other note families are deferred to later sprints

### Fill Target Scope

All fill operations write notes only into the current section.

The targeting hierarchy is:

- Current Section
- Selected Table
- Row Range
- Fret Range
- Roles

### Actions And Their Scope

- `Apply`
  - applies only to Current Section and Selected Table
- `Clear`
  - applies only to Current Section and Selected Table
- `ClearSong`
  - applies across all Sections for the Selected Table
- `Commit Notes`
  - applies across all Sections for the Selected Table
- `help`
  - shows FillPlugin help / summary

### Table Eligibility

Selectable tables are tables with no wirings of their own.

More precisely:

- a table is selectable if it is a main table that does not display another table's notes
- a table may still be selected if other tables listen to it or observe it
- a table is not selectable if it is itself wired to display another table's notes

The default selected table follows the same rule used by ArpeggioPlugin:

- first table in `myTunings` that is not wired

### Roles And Role Targets

The three fill roles are:

- root
- chord
- scale

Each role has two separate concerns:

1. whether the role emits notes at all
2. what color role is used for notes emitted by that role

For each role, the top-level mode choices are:

- `none`
- `keep`
- `role`

The approved menu shape is:

```text
r) root
    n) none
    k) keep
    r) role [noteRoot]
        n) noteRoot
        l) last
c) chord
    n) none
    k) keep
    r) role [noteChord]
        n) noteChord
        l) last
s) scale
    n) none
    k) keep
    r) role [noteScale]
        n) noteScale
        l) last
```

Approved caption rule:

- keep the child caption simple as just `last`
- let the parent property caption show the resolved current value

### Role Semantics

These role semantics follow the current Fill page behavior.

Example in C major:

- root set: `C`
- chord set: `C,E,G` where the chord option values do not include the root interval directly in the current Fill page dropdowns
- scale set: `C,D,E,F,G,A,B`

Because these note sets overlap, `keep` and `none` are necessary to preserve the current Fill semantics.

The meaning is:

- `none`
  - remove FillPlugin-owned SingleNotes for that role within the current apply scope and emit nothing for that role
- `keep`
  - do not emit notes for that role and do not let a later role overwrite notes belonging to the protected earlier role set in the current fill computation
- `role`
  - emit notes for that role using the selected role-color source

### Role Colors

The stable role colors are:

- `noteRoot`
- `noteChord`
- `noteScale`

For each role's nested `role` menu, the first sprint choices are:

- the canonical role color for that role
- `last`

`last` means:

- use `PalettePresentation.getLastRestorableRbColor()`

### Palette Rule

Approved API:

- `PalettePresentation.getLastRestorableRbColor()` returns `{ id, value, caption }`

Required default behavior:

- default palette value is `noteTransparent` when nothing else has been remembered

### noteAutomatic Rule

Approved behavior:

- `noteAutomatic` remains a valid menu option value
- it is resolved at Fill time to a concrete note color based on the actual target cell and note function

So:

- the property value may remain `noteAutomatic`
- the persisted note written into the model must contain the resolved concrete color class

### SingleNote Occupancy Rule

Approved rule:

- block placement only when a note at the same `row + col` exists with `styleNum = Note.STYLENUM_SINGLE`

Implications:

- SingleNotes are treated as owning a cell for FillPlugin purposes
- other note families may still coexist in that cell, because that is already part of the broader note-type design

### Ownership Rule

FillPlugin-authored SingleNotes are marked with:

- `owner: "FillPlugin"`

Ownership semantics for this sprint:

- FillPlugin may remove or update notes it owns
- user-authored SingleNotes must not be overwritten by FillPlugin
- manual recolor of a FillPlugin-owned note does not remove `owner`
- NoteTableController should not gain plugin-specific ownership logic
- user-edited FillPlugin-owned notes remain eligible for later FillPlugin cleanup

### Commit Notes Rule

Approved behavior:

- `Commit Notes` removes `owner: "FillPlugin"` from all FillPlugin-authored notes in the selected table across all sections
- no other note field changes during commit

### Clear Rules

Approved behavior:

- `Clear`
  - removes FillPlugin-owned SingleNotes in the current section for the selected table
- `ClearSong`
  - removes FillPlugin-owned SingleNotes across all sections for the selected table

### Apply Reconciliation Rule

Approved behavior:

- `Apply` reconciles only FillPlugin-owned SingleNotes for the selected table in the current section
- `Apply` does not remove user-authored SingleNotes
- `Apply` does not remove other note families

Practical meaning:

- previous FillPlugin-owned SingleNotes in the targeted current-section / selected-table scope are removed first
- the new fill result is then written
- any cell already occupied by a user-authored `SingleNote` is skipped

### Fill Source Rule

The fill source for this sprint follows the current Fill page semantics.

Inputs:

- current section `rootID`
- selected chord option intervals
- selected scale option intervals

Current Fill-page semantics to preserve:

- root is the section root note
- chord intervals are relative to root and intentionally omit the root from the dropdown values
- scale intervals are relative to root and include root where the selected scale contains interval `0`
- `keep` prevents later role passes from hosing earlier protected role-note sets during fill computation

This means FillPlugin should compute three note-name sets:

- root note set
- chord note set
- scale note set

Then apply the approved role-mode logic before converting those note names into concrete `SingleNote` placements.

## Recommended Technical Design

### Core Recommendation

Implement FillPlugin as a stand-alone plugin that computes a fill plan and then applies it.

Recommended internal phases:

1. resolve target table and current section
2. resolve chord / scale option intervals from constants
3. compute root / chord / scale note-name sets
4. apply `none` / `keep` / `role` semantics to those sets
5. derive candidate cells for those note names inside the selected row and fret ranges
6. remove existing FillPlugin-owned SingleNotes in current-section / selected-table scope
7. insert new SingleNotes only where no existing user-authored SingleNote occupies the cell

### Recommendation: Derive Candidate Cells From Tuning Data, Not DOM

Recommended implementation detail:

- compute candidate cells from the selected tuning's `rowRange`, fret count, reverse flag, and `Constants.midinumToNoteName()`

Reason:

- this keeps the core fill logic headless and testable
- it avoids coupling FillPlugin placement logic to DOM presence and selector behavior
- it matches how tables are already generated in `TableBuilder.js`

The Fill page may continue using DOM-oriented helpers independently.

### Recommended Internal Helper Shapes

These do not need to be public APIs beyond what the plugin uses, but this is the recommended shape.

- `getEligibleTargetTunings(song)`
- `getDefaultTargetTable(song)`
- `buildTargetTableOptions(song)`
- `resolveRoleColor(propertyValue, roleName, section, cellCandidate)`
- `computeRoleNoteSets(section, selectedChord, selectedScale, roleModes)`
- `collectCandidateCells(tuning, noteNames, rowRange, fretRange)`
- `buildSingleNote(candidate, resolvedColorClass)`
- `clearOwnedSingleNotesInSection(section, tableID)`
- `clearOwnedSingleNotesInSong(song, tableID)`
- `commitOwnedSingleNotesInSong(song, tableID)`

### Persistence-Layer Helper Recommendation

Keep ownership-aware cleanup logic out of `NoteTableController`.

If small safety helpers are needed, add them to `SectionNotesPersistence.js` or adjacent model code.

Recommended helper direction:

- iterate played notes by predicate
- remove played notes by predicate
- clear a field such as `owner` by predicate

This should stay generic enough to avoid marrying the persistence layer to plugin-specific behavior.

## Planned Files To Add Or Modify

### New Files

- `plugins/fill/FillPlugin.js`
- `plugins/fill/properties.json`
- `_tests/jest/fill-plugin.test.js`
- `_doco/design/FillPlugin-implementation-plan.md`

### Existing Files Likely To Change

- `plugins/registerPlugins.js`
  - register FillPlugin
- `Constants.js`
  - add chord and scale option source arrays / structs
- `presentation.js`
  - add `PalettePresentation.getLastRestorableRbColor()`
- `infinite-neck.js`
  - call the small Fill-page select builder during startup
- `index.html`
  - keep Fill-page destination spans, but move hard-coded chord/scale option data toward builder-populated content if done in this sprint
- possibly `SectionNotesPersistence.js`
  - add safe played-note predicate helpers if implementation becomes awkward without them

### Files Not Expected To Need Meaningful Changes

- `PluginManager.js`
- `PluginProperty.js`
- `NoteTableController.js` for ownership behavior
- ArpeggioPlugin files

## Properties And Actions

The exact trigger letters can be finalized during implementation, but the first sprint should include these properties and actions.

### Top-Level Plugin Properties

- target table: `org.dynamide.Select`
- min fret: `Number`
- max fret: `Number`
- min row: `Number`
- max row: `Number`

### Root Role Properties

- root mode: `Select` with `none | keep | role`
- root role-color source: `Select` with `noteRoot | last`

### Chord Role Properties

- chord mode: `Select` with `none | keep | role`
- chord role-color source: `Select` with `noteChord | last`

### Scale Role Properties

- scale mode: `Select` with `none | keep | role`
- scale role-color source: `Select` with `noteScale | last`

### Chord And Scale Source Properties

- selected chord formula: `Select`
- selected scale formula: `Select`

These are sourced from the new `Constants.js` data copied from the current Fill page dropdown values.

### Actions

- `Apply`
- `Clear`
- `ClearSong`
- `Commit Notes`
- `help`

## Constants.js Migration Plan

Move the current Fill page dropdown values into `Constants.js` as the source of truth.

Recommended shape:

- `FILL_CHORD_OPTIONS`
- `FILL_SCALE_OPTIONS`

Each option should carry enough information for both HTML select building and FillPlugin select-property building.

Recommended object shape:

```js
{
  value: "4,7",
  caption: "Maj"
}
```

or if useful for FillPlugin select nodes:

```js
{
  value: "4,7",
  caption: "Maj",
  trigger: "m"
}
```

The constants must match the current Fill page options exactly in this sprint.

## Fill Page Builder Plan

Approved direction:

- create a small helper that builds the Fill page's chord and scale `<select>` elements from `Constants.js`
- wire that helper during normal infinite-neck startup
- do not introduce a widget/template refactor for this work

This keeps the Fill page and FillPlugin aligned while staying simple.

## Ordered Implementation Plan

### Phase 1: Core Data And Small Shared Helpers

1. Add `FILL_CHORD_OPTIONS` and `FILL_SCALE_OPTIONS` to `Constants.js`.
2. Add `PalettePresentation.getLastRestorableRbColor()` to `presentation.js`.
3. Add a simple Fill-page select builder and call it from startup.

### Phase 2: Plugin Skeleton

1. Create `plugins/fill/FillPlugin.js`.
2. Create `plugins/fill/properties.json`.
3. Register FillPlugin in `plugins/registerPlugins.js`.
4. Add help / summary output showing current property state.

### Phase 3: Fill Computation

1. Resolve target table from plugin property.
2. Resolve row and fret ranges.
3. Resolve chord and scale formulas from constants.
4. Compute root / chord / scale note-name sets from `rootID`.
5. Apply approved `none` / `keep` / `role` semantics.
6. Enumerate candidate cells for selected note names within row and fret ranges.

### Phase 4: Reconciliation And Persistence

1. Remove FillPlugin-owned SingleNotes in current-section / selected-table scope during `Apply`.
2. Insert new notes where no user-authored SingleNote already occupies the cell.
3. Implement `Clear`.
4. Implement `ClearSong`.
5. Implement `Commit Notes`.

### Phase 5: Tests

1. Add focused plugin tests for property behavior and export behavior.
2. Add tests for role overlap semantics.
3. Add tests for range filtering.
4. Add tests for table-selection defaulting.
5. Add tests for apply / clear / clearSong / commit behavior.
6. Add tests for occupancy blocking when a user SingleNote already exists.
7. Add tests for `noteAutomatic` resolution at fill time.

## Test Plan

The first sprint should rely primarily on Jest coverage.

Recommended test cases:

- default target table is first non-wired tuning table
- selectable target tables exclude tables that are wired to display another table
- root/chord/scale note-name set computation matches current Fill-page interval behavior
- `keep` preserves earlier role-note sets against later role-note sets
- `none` emits nothing and removes owned notes for that role from the current apply result
- `Apply` clears prior FillPlugin-owned SingleNotes only in current section / selected table
- `ClearSong` clears across sections for selected table only
- `Commit Notes` removes `owner` only across sections for selected table only
- existing user-authored SingleNote blocks FillPlugin placement at same `row + col`
- non-SingleNote note families do not block FillPlugin placement
- `noteAutomatic` resolves to a concrete stored color at fill time

## Acceptance Criteria

The sprint is complete when all of the following are true.

1. FillPlugin appears in the plugin menu and persists its properties normally.
2. FillPlugin can target a selected non-wired main table.
3. FillPlugin can fill only the current section.
4. FillPlugin emits only `SingleNote` entries.
5. FillPlugin never overwrites a user-authored SingleNote already occupying a target cell.
6. `Clear` removes FillPlugin-owned SingleNotes only in current section / selected table.
7. `ClearSong` removes FillPlugin-owned SingleNotes across all sections for selected table.
8. `Commit Notes` removes only `owner` across all sections for selected table.
9. Root / chord / scale role behavior matches the approved `none | keep | role` semantics.
10. Role-color selection supports canonical role colors and `last`.
11. `noteAutomatic` resolves to a concrete color when notes are written.
12. Fill-page chord and scale options are sourced from `Constants.js`.

## Maintenance Notes

Important maintenance decisions from this sprint:

- FillPlugin is intentionally separate from the Fill page implementation path
- FillPlugin owns its own fill algorithm
- ownership cleanup belongs in plugin logic and small persistence helpers, not in `NoteTableController`
- command-menu submenu hopping into `/pr` is intentionally not part of this sprint
- `last` palette behavior depends on `PalettePresentation.getLastRestorableRbColor()`
- `noteAutomatic` remains a menu-time symbolic value but becomes a concrete persisted note color at fill time


# FillPlugin Implementation Plan Extensions for Iteration 4

## Timeline and Scope

This section documents work done in the next iteration after the above sections were described and completed 20260510.

## Iteration 4 Implementation Plan

This iteration extends the now-working FillPlugin and related plugin help / transpose behavior.

The scope here is intentionally incremental.

It does not replace the first sprint plan above.

It adds the next approved behaviors on top of the completed implementation.

### Iteration 4 Scope

This iteration includes:

- refine FillPlugin role-painting semantics to match the newly approved overwrite model
- remove `scale keep` from FillPlugin options because it has no meaningful effect in the plugin model
- add optional Tiny companion notes that mirror emitted FillPlugin `SingleNote` placements
- expose handled EventBus events in plugin help output
- align TransposePlugin help formatting with the current ArpeggioPlugin / FillPlugin summary style
- add a TransposePlugin `Auto sharps/flats` option based on a simple key-spelling policy in `Constants.js`
- add a TransposePlugin `Reset` action based on tracked transpose offset

Out of scope for this iteration:

- any generalized event ordering system
- any FillPlugin support for highlight / recorded-note families
- any new `noteLead3` color role
- full enharmonic-key theory or major/minor key-signature modeling
- preserving original `Section.sharps` history across arbitrary song edits after transpose

### Approved FillPlugin Role Model For Iteration 4

The approved conceptual fill order is now:

1. scale pass
2. chord pass
3. root pass

Base behavior:

- scale role paints all scale notes first
- chord role overwrites scale-role notes where chord-note positions overlap
- root role overwrites chord-role and scale-role notes where root positions overlap

This defines the default visual precedence:

- root wins over chord
- chord wins over scale
- scale is the fallback layer

### Revised Meaning Of `none`, `keep`, And `role`

For Iteration 4, the role modes are interpreted as placement rules inside the ordered pass model above.

- `role`
  - emit that role normally during its pass using the configured role color source
- `keep`
  - emit nothing for that role and preserve whatever lower-priority role result is already present at that position
- `none`
  - emit nothing for that role and suppress any lower-priority FillPlugin result at that position

This yields the approved examples:

- if root is `role`, root notes are painted in root color
- if root is `keep`, overlapping chord or scale notes remain visible and no root note is emitted
- if root is `none`, no note remains at root positions, even if chord or scale would otherwise place one there
- if chord is `role`, chord notes overwrite scale notes at overlapping positions
- if chord is `keep`, overlapping scale notes remain visible and no chord note is emitted
- if chord is `none`, no note remains at chord positions unless a later root pass overwrites that position
- if scale is `role`, scale notes provide the base layer
- if scale is `none`, scale emits nothing

Because FillPlugin already preserves user-authored `SingleNote` cells, `scale keep` has no useful plugin meaning and should be removed from the menu.

### Recommended Implementation Shape For Role Semantics

Do not treat role processing as three independent note sets that are later merged by simple overwrite.

Instead, build a per-cell fill decision in pass order.

Recommended helper direction:

- compute root / chord / scale membership sets for pitch classes as before
- collect candidate cells in the selected row / fret range
- for each candidate cell, evaluate scale pass, then chord pass, then root pass
- store one Fill decision object per cell, carrying:
  - whether FillPlugin should emit a `SingleNote`
  - the resolved note color for that `SingleNote`
  - whether lower-priority roles are suppressed at that cell

This keeps `keep` and `none` semantics explicit and testable.

### FillPlugin Tiny Notes

Approved rule:

- Tiny notes mirror emitted FillPlugin `SingleNote` notes only
- Tiny notes do not independently select or suppress cells
- if no FillPlugin `SingleNote` is emitted at a cell, no FillPlugin Tiny note is emitted there

Approved Tiny menu:

```text
t) tiny notes
    n) none
    e) emboss - noteTransparent
    a) noteAutomatic
    1) noteLead
    2) noteLead2
```

Approved Tiny semantics:

- `none`
  - do not emit Tiny notes
- `noteTransparent`
  - emit Tiny notes using emboss behavior so AutoColor continues to respect lead-key behavior
- `noteAutomatic`
  - emit Tiny notes whose stored color is resolved at apply time for the concrete cell
- `noteLead`
  - emit Tiny notes in `noteLead`
- `noteLead2`
  - emit Tiny notes in `noteLead2`

Important constraint:

- there is no `noteLead3` in this iteration

### Tiny Color Resolution Rule

The Tiny option values should be persisted as property values, but concrete note colors should be written into emitted notes using the existing color-resolution rules for Tiny notes.

Implications:

- `noteTransparent` remains a valid Tiny option because emboss behavior is intentional and dynamic
- `noteAutomatic` remains valid and is resolved at apply time to a concrete stored note color
- Tiny AutoColor behavior should continue to honor the current lead-key semantics already used elsewhere in the app

### FillPlugin Reconciliation For Tiny Notes

The existing FillPlugin ownership and cleanup model should extend to Tiny notes emitted by the plugin.

Recommended rule:

- plugin-owned Tiny notes should also carry `owner: "FillPlugin"`
- `Apply` should reconcile plugin-owned Tiny notes in the same current-section / selected-table scope as plugin-owned `SingleNote` notes
- `Clear`, `ClearSong`, and `Commit Notes` should apply to both plugin-owned Fill `SingleNote` and plugin-owned Fill Tiny notes for the selected table

Placement blocking should remain unchanged for `SingleNote` fill:

- only an existing `SingleNote` blocks FillPlugin `SingleNote` placement at that `row + col`

Tiny emission is downstream of that decision and should not introduce a new occupancy rule.

### Plugin Help Footer And Event Disclosure

Approved direction:

- plugins should disclose which EventBus events they handle in their help output
- this is informational only and does not imply event ordering guarantees beyond the existing event bus behavior

Recommended implementation shape:

- add a small shared helper used by plugin help rendering to append an events footer
- footer should list the plugin's current `getEventNames()` values
- if a plugin handles no events, the footer may say that explicitly or omit the section

This work should be applied at least to:

- FillPlugin
- ArpeggioPlugin
- TransposePlugin

### TransposePlugin Help Parity

Approved direction:

- TransposePlugin help should match the stronger summary style already used by the other plugins

Recommended behavior:

- first line should summarize the current transpose state in the same bold / summary-oriented manner used elsewhere
- help output should also include the new events footer
- help should include the current `Auto sharps/flats` state and the tracked transpose offset

### Transpose Auto Sharps/Flats

Approved option name:

- `Auto sharps/flats`

This option should not modify `transposeSong()` itself.

The implementation should:

1. transpose the song using the existing transpose path
2. then apply a simple spelling-policy pass to section spelling state

Approved first-pass policy source:

- add `Constants.SHARP_IDS`
- flat IDs are all note IDs not in that list

Approved first-pass contents:

- `Constants.SHARP_IDS = [A, B, C, D, E, G]`

Operational interpretation:

- if a section root lands on an ID in `SHARP_IDS`, prefer sharp spelling for that section
- otherwise prefer flat spelling for that section

This intentionally mirrors the simple command-menu grouping behavior rather than attempting a richer music-theory model.

### Transpose Reset

Approved direction:

- TransposePlugin should track how many steps it has moved from its baseline state
- add a `Reset` action that transposes back to zero net offset

Recommended behavior:

- maintain a running transpose-offset property or internal state value
- normal transpose actions increment or decrement that offset
- `Reset` applies the inverse transpose needed to return the song to zero net plugin offset
- after reset, offset returns to `0`

Known limitation retained by design:

- this does not attempt to preserve original `Section.sharps` history across later song edits or inserted sections
- if the user changes the song structure after transposition, spelling recovery remains best-effort only

### Expected File Touch Points For Iteration 4

Likely files to modify:

- `plugins/fill/FillPlugin.js`
  - revise role-pass algorithm
  - remove `scale keep`
  - add Tiny-note property and emit / cleanup logic
  - include event footer in help
- `plugins/fill/properties.json`
  - update role menus
  - add Tiny-note menu options
- `plugins/arpeggio/ArpeggioPlugin.js`
  - include event footer in help
- `plugins/transpose/TransposePlugin.js`
  - add summary-style help output
  - add `Auto sharps/flats`
  - add `Reset`
  - track transpose offset
  - include event footer in help
- `plugins/transpose/properties.json`
  - add `Auto sharps/flats`
  - add `Reset`
- `Constants.js`
  - add `SHARP_IDS`
  - possibly add a small helper around spelling-policy lookup if that reads more clearly than raw array checks
- shared plugin-help utility location if a common helper is introduced
- `_tests/jest/fill-plugin.test.js`
  - add role-pass and Tiny tests
- `_tests/jest/arpeggio-plugin.test.js`
  - update help expectations if needed
- `_tests/jest/transpose-plugin.test.js`
  - add help, spelling-policy, and reset tests

Files not expected to need structural changes:

- `event-bus.js`
- `PluginManager.js`
- `transposeSong()` core algorithm

### Ordered Implementation Steps For Iteration 4

#### Phase 1: Fill Role Semantics

1. Update FillPlugin menu definitions to remove `scale keep`.
2. Replace the current role-resolution path with a pass-ordered per-cell decision model.
3. Preserve existing ownership cleanup and user-`SingleNote` protection.
4. Update Fill help text to describe the new pass order and include events handled.

#### Phase 2: Tiny Companion Notes

1. Add the Tiny property and menu options.
2. Extend Fill apply logic so each emitted plugin-owned `SingleNote` may also emit one plugin-owned Tiny note.
3. Extend clear / clearSong / commit paths to include plugin-owned Tiny notes.
4. Ensure Tiny color resolution follows the approved rules for `noteTransparent`, `noteAutomatic`, `noteLead`, and `noteLead2`.

#### Phase 3: Shared Help Footer

1. Add a small help-footer helper or equivalent shared pattern.
2. Apply it to FillPlugin, ArpeggioPlugin, and TransposePlugin.
3. Keep help output concise and deterministic for tests.

#### Phase 4: Transpose Enhancements

1. Add `Auto sharps/flats` property to TransposePlugin.
2. Add `SHARP_IDS` spelling policy in `Constants.js`.
3. After normal transposition, apply section spelling from the simple policy when the option is enabled.
4. Track net transpose offset.
5. Add `Reset` action that returns the plugin-managed offset to zero.
6. Update Transpose help summary to show current interval, auto-spelling state, offset, and handled events.

#### Phase 5: Tests

1. Add Fill tests for root / chord / scale pass precedence.
2. Add Fill tests for `root none`, `root keep`, `chord none`, `chord keep`, and `scale none`.
3. Add Fill tests confirming `scale keep` is no longer offered.
4. Add Fill tests for Tiny mirroring behavior.
5. Add Fill tests for Tiny cleanup and commit behavior.
6. Add Transpose tests for help formatting and event disclosure.
7. Add Transpose tests for `Auto sharps/flats` policy.
8. Add Transpose tests for tracked offset and `Reset`.

### Iteration 4 Acceptance Criteria

This iteration is complete when all of the following are true.

1. FillPlugin role painting follows the approved pass order: scale, then chord, then root.
2. `root keep` preserves lower-priority color at root positions and emits no root note.
3. `root none` suppresses lower-priority FillPlugin output at root positions.
4. `chord keep` preserves scale output at chord positions and emits no chord note.
5. `chord none` suppresses scale output at chord positions unless a later root pass overwrites that cell.
6. `scale keep` is no longer present in FillPlugin options.
7. FillPlugin can optionally emit one plugin-owned Tiny note for each emitted plugin-owned `SingleNote`.
8. FillPlugin never emits a Tiny note where it did not emit the corresponding `SingleNote`.
9. FillPlugin `Clear`, `ClearSong`, and `Commit Notes` handle plugin-owned Tiny notes consistently with plugin-owned `SingleNote` notes.
10. FillPlugin, ArpeggioPlugin, and TransposePlugin help output discloses their handled events.
11. TransposePlugin help uses the current summary style rather than the old static format.
12. TransposePlugin can optionally apply the simple `Auto sharps/flats` policy after transposition.
13. TransposePlugin tracks its net transpose offset and can `Reset` back to zero plugin-managed offset.

### Remaining Known Limits

I do not see a blocking design hole for this iteration.

The main intentional limits are:

- same-event plugin ordering remains whatever the existing enable / handler-registration order produces
- the auto spelling policy is intentionally simple and not music-theory complete
- `Reset` is defined against plugin-managed transpose offset, not full historical reconstruction of original section spelling

## Iteration 5 Implementation Notes

This iteration extended the transpose API so lead-key transposition can be requested explicitly while preserving the previous behavior everywhere else by default.

### Implemented API Changes

- `infinite-neck.js :: transposeSong(amount, options = {})`
  - now accepts `options.doKeyLead`
  - now safely normalizes missing options so legacy callers of `transposeSong(amount)` continue to behave the same way
- `infinite-neck.js :: transposeSongKeys(amount, doKeyLead = false)`
  - now accepts an optional lead-key transpose flag
- `Song.cycleThruKeysAllSections(amount, doKeyLead = false)`
  - still transposes `rootID` in all sections
  - now also transposes `rootIDLead` only when `doKeyLead` is true
- `Section.transposeRootLead(amount)`
  - added as a parallel API to `transposeRoot(amount)`
  - leaves `rootIDLead = -1` untouched so "follow root" semantics remain intact

### Implemented TransposePlugin Changes

- added toggle property `d) do lead key`
- TransposePlugin now passes `doKeyLead` through its transpose options
- help summary now reports the current `do lead key` state

### Compatibility Rule Kept

Current code outside of TransposePlugin continues to behave identically unless it explicitly opts in to lead-key transposition.

That is the main compatibility guarantee for this iteration.

### Files Updated In Iteration 5

- `Section.js`
- `Song.js`
- `infinite-neck.js`
- `plugins/transpose/TransposePlugin.js`
- `plugins/transpose/properties.json`
- `_tests/jest/transpose-plugin.test.js`
- `_tests/jest/plugin-manager-persistence.test.js`
- `_tests/jest/song-api-Section.test.js`
- `_tests/jest/song-api-load-V2.test.js`

### Iteration 5 Validation

Focused Jest coverage was extended to verify:

- default no-lead-key behavior is unchanged
- explicit lead-key transposition updates `rootIDLead`
- `rootIDLead = -1` remains unchanged
- TransposePlugin persists and reports the new `do lead key` toggle

## Iteration 6 Implementation Notes for *Bury* feature

This iteration adds named plugin-configuration snapshots using the Graveyard as a JSON snapshot store, while preserving the current ownership boundaries:

- `Song.plugins` remains the authoritative live plugin state
- plugin code remains the source of truth for behavior, menu structure, and property schema
- Graveyard stores named plugin-state snapshots and revive imports them back through the plugin runtime

This is intentionally a conceptual reuse of Graveyard, not a redesign of Graveyard into a general plugin manager.

### Scope Approved For This Iteration

The approved scope for this iteration is:

1. add a new plugin snapshot workflow called `Bury`
2. standardize shared plugin menu actions and labels
3. support one-plugin-at-a-time bury and revive
4. add the required safety behavior around looping and enabled plugins
5. defer `B) Bury all` to a later iteration

### Shared Menu Standardization

All plugin menus should begin with the same shared actions in this order:

- `E) Enable`
- `L) Load enabled`
- `B) Bury`

All plugin menus should still end with:

- `h) help`

The plugin list should also show an enabled checkmark for enabled plugins at menu-text generation time.

This standardization should remain manager-owned rather than plugin-authored so:

- action order stays consistent across all plugins
- trigger collisions are reduced
- plugin-specific code remains focused on plugin-specific properties and actions

### Storage Model

The live state model remains unchanged:

- plugin state is still stored in `Song.plugins[pluginId]`

The new Graveyard snapshot model should add a new record type:

- `GraveType.PLUGIN`

Each buried plugin record should store:

- `context.pluginId`
- `context.userKey`
- `context.schemaVersion`
- optional user-facing caption metadata if helpful for display
- `json` equal to one plugin's persisted `Song.plugins[pluginId]` JSON payload

The buried payload should contain only persisted user state:

- `enabled`
- `enableOnSongLoad`
- `properties`

It should not contain:

- menu nodes
- action definitions
- event names
- property schema definitions
- runtime-only plugin objects

### Keying And Overwrite Rules

The visible user mental model remains:

- plugin id + user key

Examples:

- `transpose / USER`
- `transpose / Bob's I-IV-V Blues Practice`

The physical Graveyard storage may remain flat. The hierarchy is represented in record context, not by introducing a nested Graveyard data structure.

Normalization rule for the user-entered key:

- trim leading and trailing whitespace
- collapse internal whitespace to a single space
- remove disallowed characters
- allow alphanumeric, hyphen, underscore, spaces, leading digits, and single quote
- if the normalized result is empty, use `USER`

Overwrite rule:

- burying the same `pluginId + userKey` again replaces the earlier snapshot at that logical key

### Bury Workflow

The bury flow for one plugin should be:

1. determine the plugin's current exported persisted state
2. if the plugin is currently enabled, disable it immediately before any reset work
3. if section or beat looping is active, stop looping before proceeding
4. if the plugin needs to warn or veto before burial, do that before final snapshot/reset
5. prompt for the user key
6. normalize the key, defaulting to `USER`
7. write or replace the `PLUGIN` record in the Graveyard
8. reset that plugin to defaults
9. leave `enabled = false` and `enableOnSongLoad = false`
10. refresh plugin menu state and any related UI summaries

Two safety rules are intentional here:

- disable first
- stop looping first

These reduce race-like behavior where a plugin is still reacting to loop events while its state is being buried and reset.

### Looping Safety Rule

For this iteration, the safest approved behavior is:

- if loop playback is active, stop it when bury begins

This is preferable to trying to support hot-swapping plugin state mid-loop.

The repository already has a simple stop-loop helper path, so the implementation should use the existing loop-stop behavior rather than inventing a new paused or suspended plugin mode.

This rule should apply before resetting plugin state, not afterward.

### Revive Workflow

Revive should be treated as import of one plugin snapshot, not generic object resurrection.

The revive flow should be:

1. identify the Graveyard record and confirm it is `GraveType.PLUGIN`
2. parse `context.pluginId` and the record JSON payload
3. stop looping before changing live plugin state
4. if the target plugin currently has meaningful non-default state, auto-bury that state under `USER`
5. ask the plugin manager to import the revived state for that one plugin
6. refresh plugin menu state and any related UI summaries
7. mark the Graveyard record as revived

Revive should go through plugin-manager import helpers rather than mutating `song.plugins` directly. That preserves synchronization between:

- persisted plugin JSON
- live manager flags such as `enabled`
- registered event handlers
- plugin-specific reset/default logic

### TransposePlugin Safety Exception

TransposePlugin has one special safety case:

- it tracks a live transpose offset used by `Reset`

If TransposePlugin is buried after it has moved the song away from its baseline state, then resetting the plugin to defaults means that plugin-managed reset history is lost.

For this reason, TransposePlugin should be allowed a pre-bury warning or veto hook.

Approved behavior:

- if TransposePlugin has a non-zero tracked transpose offset, it may warn before burial that continuing will lose plugin-managed resetability for that transposed state
- this warning should happen at or before key entry, not after the snapshot is committed

This does not require a generalized modal framework. A simple plugin-level pre-bury hook that returns either:

- proceed
- proceed with warning text
- veto with reason

is sufficient for this iteration.

The warning text should make clear that the song's current transposed model state remains as-is, but the plugin will no longer know how to roll back to the previous baseline using its own `Reset` action.

### Manager And Graveyard Responsibilities

The clean boundary for this iteration is:

- Graveyard owns record storage and display
- PluginManager owns plugin export/import/reset/enable coordination
- each plugin may optionally contribute a small pre-bury safety hook

Recommended new PluginManager responsibilities:

- export one plugin entry in persisted-song shape
- import one plugin entry in persisted-song shape
- reset one plugin to defaults and managed booleans
- report whether a plugin currently has meaningful persisted state
- support shared `Bury` menu actions

Recommended Graveyard responsibility changes:

- add `PLUGIN` to `GraveType`
- add one `raise()` case that delegates plugin restore to the plugin runtime boundary
- keep Graveyard otherwise flat and data-oriented

### Deferred Items

These items are explicitly deferred to a later iteration:

- `B) Bury all`
- bulk revive/import flows
- richer Graveyard filtering or grouping UI for plugin records
- cross-song or browser-global preset libraries outside song Graveyard
- hot-start or hot-revive behavior while looping continues uninterrupted

Deferring `Bury all` is the correct tradeoff for this iteration because one-plugin bury/revive already covers the core product value while keeping reset ordering and safety rules understandable.

### Implementation Sequence

Recommended implementation order:

1. extend `GraveType` with `PLUGIN`
2. add PluginManager helpers for export/import/reset of a single plugin entry
3. standardize shared plugin menu items and enabled-check display
4. add the `Bury` action path with user-key prompt and overwrite behavior
5. add the looping safety stop at bury and revive entry points
6. add TransposePlugin pre-bury warning/veto support for non-zero offset
7. add Graveyard revive delegation for plugin records
8. add focused validation and Jest coverage

### Validation Targets

Focused validation for this iteration should cover:

1. bury stores one plugin snapshot in Graveyard with `type = PLUGIN`
2. bury resets the target plugin to defaults and leaves it disabled
3. bury stops active looping before reset work
4. revive imports one buried plugin snapshot back into the plugin manager
5. revive auto-buries current meaningful plugin state to `USER` before overwrite
6. same-key bury overwrites the logical prior snapshot
7. plugin menu labels are standardized as approved
8. enabled plugins show the checkmark in the plugins menu
9. TransposePlugin warns or vetoes when bury is attempted with non-zero offset
10. legacy song save/load behavior for `Song.plugins` remains unchanged outside the new bury/revive workflow

### Compatibility Goal

The compatibility goal for this iteration is:

- songs that never use `Bury` continue to behave exactly as they do today
- `Song.plugins` save/load remains the primary persistence mechanism
- Graveyard plugin records add a new optional workflow without changing existing plugin semantics

That is the key constraint for implementing the feature safely.

## Iteration 6

This iteration collected the follow-on UX and plugin-menu work completed after the bury/revive flow stabilized.

The implemented scope in this iteration is:

- plugin status markers in the plugins menu and plugin help headers
- an expandable Graveyard Context cell using inline more/less links
- dynamic per-plugin target-table selection for FillPlugin and ArpeggioPlugin

### Plugin Status Markers

Two independent runtime markers are now displayed for plugins.

- `🗹` (`U+1F5F9`, CHECK) means the plugin is currently enabled
- `🖺` (`U+1F5BA`, TEXT AND PICTURE) means the plugin currently has persisted state in `Song.plugins`

These markers are shown in two places:

- after the plugin name in the `/fp` plugins menu
- on the first bold status line of plugin help output

Examples of the intended meanings:

- `transpose 🗹` means enabled but no meaningful persisted song state yet
- `transpose 🗹 🖺` means enabled and also currently persisted into `Song.plugins`
- `transpose 🖺` means not enabled, but the plugin still has song-level persisted state

The important design point is that these two markers are not aliases for one another.

- enablement is runtime behavior
- persisted state is song-model state

To support this cleanly, the plugin manager now keeps `Song.plugins` synchronized with the live plugin runtime state when managed booleans or plugin properties change.

### Plugin Help Status Line

Plugin help now starts with a standardized bold status line:

- plugin name
- plugin status markers
- compact summary of active values

For example:

- `Fill plugin: 🗹 🖺 target table=P46_1 chord formula=Maj ...`

On that first bold line only, the value side of `name=value` pairs is wrapped for styling using:

- `<em class='pluginHelpValue'>...</em>`

This keeps the status line readable while letting the CSS distinguish labels from current values.

Plugin help also now includes a legend describing the two plugin status markers so the symbols are self-explanatory in the UI.

### Graveyard Context Expansion

The Graveyard Context column no longer truncates long `record.context` values to a fixed short string only.

Instead, when the serialized context exceeds the compact preview length:

- the first portion is shown inline in the table cell
- an inline link appears at the end of the preview
- clicking `more...` expands the remainder of the context inside the same table cell
- clicking again switches the same control to `less...`

This uses the same delegated `data-target` toggle mechanism already used by the existing Graveyard `show/hide` JSON row control.

The intended layout behavior is:

- the Graveyard table should not grow wider because of expanded context text
- the Context cell should instead wrap and grow vertically as needed

The inline control is now implemented as a real anchor, not a span pretending to be a link. That is the more normal browser behavior and preserves standard link affordances such as link color, underline, and pointer cursor.

### FillPlugin Target Table Select

FillPlugin now exposes a dynamic `target table` select menu under `/fpf` and `/fpft`.

The option list is populated at runtime from the currently eligible tables, using the approved rule:

- candidate tables must not themselves be wired display tables
- if another table listens to a candidate table, that candidate is still allowed
- this remains a plugin-level choice, not a song-level choice

The menu is intentionally capped at the first nine valid tables for this iteration.

- triggers are `1` through `9`
- captions are shown as `1) S6_1`, `2) P46_1`, `3) Bass_1`, and so on

This list is rebuilt dynamically when tunings or wirings change, so FillPlugin sees newly eligible tables without needing a page reload.

### ArpeggioPlugin Target Table Select

ArpeggioPlugin now participates in the same user-facing target-table selection model as FillPlugin.

This was the correct parallel change because ArpeggioPlugin previously used the same conceptual rule as FillPlugin:

- choose the first eligible table in `myTunings`
- ignore tables that are themselves wired display tables

ArpeggioPlugin now has its own runtime-populated `target table` select with the same behavior as FillPlugin:

- first nine eligible tables only
- numbered `1..9` triggers and `1)..9)` captions
- current selection stored in plugin persistence
- help/status summary reflects the selected target table

The trigger used for the ArpeggioPlugin property is capital `T`, as approved in chat, to avoid colliding with its existing lowercase menu keys.

### Non-Participation Of TransposePlugin

TransposePlugin does not participate in the target-table chooser work.

That is intentional and should remain explicit in the design notes:

- TransposePlugin is designed to operate at the song level
- FillPlugin and ArpeggioPlugin are designed to operate at the table level

Because of that design split, target-table lookup has not been centralized into a shared plugin helper in this iteration.

That is an acceptable tradeoff for now because:

- only FillPlugin and ArpeggioPlugin need this field today
- their user-facing behavior is now parallel
- TransposePlugin would not consume the abstraction

If a later plugin also needs per-table targeting, extracting the common chooser logic can be reconsidered then.

### Implementation Notes

The implementation boundary for this iteration is:

- PluginManager owns status-marker resolution and song-plugin synchronization
- plugin help helpers own the shared help-header and legend formatting
- Graveyard owns inline context expansion markup in its table renderer
- FillPlugin and ArpeggioPlugin each own their own eligible-table discovery and select-option generation

The last point is important: the runtime menu shape is parallel across Fill and Arpeggio, but the target-table chooser remains per-plugin implementation, not a shared central service.

### Validation Targets

Focused validation for this iteration should cover:

1. plugin menu rows show `🗹` only when the plugin is enabled
2. plugin menu rows show `🖺` only when the plugin has persisted state in `Song.plugins`
3. plugin help headers show the same status markers and include a legend explaining them
4. Graveyard context cells expand with `more...` and collapse with `less...`
5. expanded Graveyard context wraps vertically without forcing the table wider
6. FillPlugin `/fpft` opens a numbered target-table submenu rather than behaving as a bang node
7. FillPlugin target-table options update when tunings or wirings change
8. ArpeggioPlugin target-table selection behaves the same way from the user perspective
9. ArpeggioPlugin persists and restores the selected target table through normal plugin song persistence
10. TransposePlugin remains unchanged with respect to target-table selection

### Compatibility Goal

The compatibility goal for this iteration is:

- existing songs continue to load even if they predate the new plugin status markers or target-table chooser work
- plugin status display adds visibility only; it does not alter plugin behavior on its own
- the Graveyard still renders compactly by default, with expansion only on demand
- TransposePlugin remains song-scoped and unaffected by per-table chooser work

That keeps this iteration additive and user-facing, rather than changing the underlying plugin ownership model.
