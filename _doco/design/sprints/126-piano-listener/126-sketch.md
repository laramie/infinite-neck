# sprint-126 piano-listener sketch

This document is a design sketch, not the implementation. Its purpose is to make the likely shape of the change concrete before coding.

## Summary direction

This should stay in core wiring/listener code, not become a plugin, unless we later discover that listener projection modes multiply beyond a small fixed set.

The present listener replay path in `NoteTableController.js` replays played notes by matching both `row` and `midinum`:

```js
"#" + tablename + " td[cellrow=" + script.row + "][midiNum=" + script.midinum + "]"
```

That works for same-shape or similar-shape instruments, but it breaks down when the listener has a single row, such as piano. A guitar note on source row 3 cannot appear on a one-row listener if replay still insists on source row 3.

The simplest safe direction is:

1. Keep the current listener behavior as the default.
2. Add one listener projection setting to wiring.
3. Support three projection modes for played notes:
	1. `row-midi` or `same-row-midi` = current behavior
	2. `midi-low-to-high` = ignore source row/col, place by MIDI only, process source strings from low string to high string
	3. `midi-high-to-low` = ignore source row/col, place by MIDI only, process source strings from high string to low string
4. Leave NamedNotes and RecordedNotes/Highlights alone for this sprint unless testing shows they also need the same projection rule.

## Why this should not be a plugin yet

The needed variation is still small and local:

1. one new persisted wiring field
2. one new control in Wiring UI
3. one helper that projects listener played notes
4. one replay branch that switches between current behavior and MIDI-only behavior

That is still normal core listener behavior, not a broad user-extensible action system.

If later we add more projection families, for example range folding, closest-position matching, or user-defined row priority, then a ListenerPlugin would become easier to justify.

## Recommended UX

Although the request mentions a checkbox, a single checkbox is not enough by itself because there are really three states, not two.

Recommended UI:

1. A small select or radio group in Wiring:
	1. `Same string + MIDI`
	2. `MIDI only, low string to high`
	3. `MIDI only, high string to low`

If you strongly prefer a checkbox-style UI, then it should really be:

1. checkbox: `Ignore source string; map by MIDI only`
2. secondary order control, enabled only when checkbox is on:
	1. `Low to high`
	2. `High to low`

The select version is simpler because it persists one field and avoids coupled UI state.

## Proposed model change

Add one new field on each wiring object, something like:

```js
listenerProjection: 'row-midi'
```

Allowed values:

```js
'row-midi'
'midi-low-to-high'
'midi-high-to-low'
```

Default must be `row-midi` so all existing songs preserve current behavior.

## Proposed replay behavior

### Current path

Current listener replay takes source played notes and looks for target cells that match the original source `row` and `midinum`.

That is why a piano listener effectively only reflects notes that happen to be on source row 0.

### New path for MIDI-only listener projection

When the wiring says `midi-low-to-high` or `midi-high-to-low`:

1. Collect the source played notes from the listened-to table.
2. Group or at least iterate them in source-string order, based on the source tuning's musical string order, not raw DOM row order.
3. For each note, resolve its target cell by `midinum` only.
4. If the target has multiple cells for that MIDI, choose one deterministic preferred cell.
	1. For piano, this will usually be only one cell.
	2. For multi-row targets, the first stable cell returned by layout lookup is acceptable for this sprint.
5. Apply the same CSS/display behavior used for played notes today.
6. Allow later notes in the chosen iteration order to overwrite earlier notes when they land on the same target cell.

That last point matches the requirement that notes clobber earlier listened notes when projecting by MIDI only.

## Important detail: string order must be musical, not visual

The low-to-high / high-to-low choice should not rely on raw row index alone.

It should be derived from the source tuning layout, for example by each row's open-string MIDI number. This matters because:

1. some tunings may have reversed display
2. row index is a screen/layout detail
3. the user request is musical: low string to high string, not top row to bottom row

So the helper should determine source row order from the tuning layout or `rowRange`, then iterate notes in that order.

## Recommended helper shape

This should be implemented as a helper, not inline in replay.

Two reasonable options:

1. add to `move-helpers.js`, since that file already contains `createTuningLayout()`, `getCellByRowMidi()`, and `getPreferredCellForMidi()`
2. add a new small helper module dedicated to listener projection if we want to avoid mixing move logic and listener logic

For this sprint, extending `move-helpers.js` is the smaller change because the needed layout utilities already live there.

Possible helper responsibilities:

1. normalize projection mode
2. sort source played notes by requested string order
3. resolve target cell by MIDI only
4. clone note data into a projected note with updated `row`, `col`, `midinum`, and `noteName`
5. return projected notes in final overwrite order

This is very similar in spirit to the existing Clip plugin MIDI-paste helpers, which already project notes across tunings by MIDI.

## Core files that need to change

### Primary code files

1. `templates/WiringBuilder.js`
	1. add the new UI control
	2. load the saved projection mode into the control
	3. include the value when wiring is added/updated

2. `Song.js`
	1. extend `addWiring()` so it accepts and stores the new projection field
	2. keep the default behavior backward-compatible when the field is omitted

3. `Wiring.js`
	1. add the default field to `wiringDefaults`

4. `SongPersistence.js`
	1. no structural rewrite should be needed, but this file must continue to hydrate the extra wiring field cleanly via `new Wiring(w)`

5. `bin/song-file-schema.js`
	1. allow the new wiring property in persisted song files
	2. preferably keep it optional so old files still validate

6. `ReplayOptions.js`
	1. add a field for the listener projection mode if replay passes this through explicitly

7. `NoteTableController.js`
	1. attach the wiring projection mode to listener replay options
	2. branch listener played-note replay between current row-aware behavior and new MIDI-only projection behavior
	3. preferably route the projection work through a helper rather than building selectors ad hoc

8. `move-helpers.js` or a new listener helper module
	1. add the projection helper logic
	2. reuse existing layout lookup helpers where possible

### Secondary but likely files

1. `help.html`
	1. document the new wiring option under Event Wiring Controls

2. `_tests/jest/song-api-load-V2.test.js`
	1. update persistence expectations for the new optional wiring field

3. new or existing Jest tests around listener replay behavior
	1. likely add to a note-table or song-level test file
	2. if helper logic is moved into `move-helpers.js`, unit tests there may be simpler than UI-heavy replay tests

4. possibly `templates/Wiring-template` host markup if the Wiring UI template lives in HTML rather than being entirely built in JS
	1. whichever file owns the actual Wiring DOM structure will need one more control slot

## Files that probably do not need to change

1. plugin code, unless we deliberately reuse helper logic from Clip by extracting shared code
2. section persistence for notes
3. event bus structure
4. relative-section logic itself

## Suggested implementation slices

### Slice 1: persist the new wiring mode

Goal:

Make the data model safe before touching replay.

Steps:

1. add the field in `Wiring.js`
2. pass it through `Song.addWiring()`
3. allow it in song schema
4. confirm old songs still load with default `row-midi`

Expected result:

The new mode exists as data, but behavior is unchanged.

### Slice 2: add the Wiring UI control

Goal:

Allow users to choose the projection mode.

Steps:

1. render the new control in Wiring UI
2. initialize it from current wiring state
3. include it when Add Wiring is clicked
4. ensure changing the control affects the button state the same way instrument and relative-section edits do

Expected result:

Users can save the option, but replay may still behave as before until the next slice.

### Slice 3: add the projection helper

Goal:

Create one deterministic transformation from source played notes to target listener cells.

Steps:

1. build source and target tuning layouts
2. sort source notes in musical string order
3. map each note to a target cell by MIDI only
4. return projected notes with updated row/col/noteName

Expected result:

The risky mapping logic is isolated and unit-testable.

### Slice 4: switch listener replay to use the helper

Goal:

Change only the played-note replay path for listener tables.

Steps:

1. preserve current path for `row-midi`
2. use the helper for the two MIDI-only modes
3. leave NamedNotes and highlights unchanged unless tests show obvious inconsistency

Expected result:

A piano listener can display all relevant source notes by MIDI rather than only notes from source row 0.

### Slice 5: document and test

Goal:

Make the feature discoverable and guard against regressions.

Steps:

1. document the new wiring option in help
2. add persistence test coverage
3. add at least one behavior test for each new mode

Expected result:

The feature is understandable and stable enough to keep in core code.

## Recommended tests

Minimum useful test set:

1. persistence test: loading a wiring with no `listenerProjection` defaults to `row-midi`
2. persistence test: saving/loading preserves `midi-low-to-high`
3. helper test: guitar source to piano target projects notes from multiple strings onto one-row target by MIDI only
4. helper test: when two source notes collide onto the same target cell, low-to-high and high-to-low produce different winners in the expected direction
5. replay test: default `row-midi` behavior is unchanged

## Main risks

1. treating low/high string order as screen order instead of musical order
2. changing highlight or recorded-note behavior accidentally when the sprint only asked for played notes
3. duplicating projection logic in several places instead of centralizing it in one helper
4. making schema changes too strict and breaking older song files
5. using a checkbox-only UI that cannot clearly represent three states

## Open questions before implementation

1. Should the new mode affect only played notes, or should recorded highlights eventually follow the same MIDI-only projection rule?
2. For multi-row non-piano targets in MIDI-only mode, is "first matching target cell" acceptable, or do we want a more musical preferred-row rule now?
3. Do we want the UI label to say "string" or "row"? The user-facing language should probably stay musical and say "string" even though the model stores rows.
4. Should the persisted field name be explicit like `listenerProjection`, or shorter like `listenMode`?

## Suggested completion criteria

1. Existing songs replay exactly as before unless the new wiring mode is selected.
2. A piano listener can show played notes from all source guitar strings when MIDI-only mode is enabled.
3. The chosen string-order mode deterministically decides which colliding note wins.
4. The feature is persisted in song files and restored correctly.
5. The implementation lives in core listener/wiring code without introducing a new plugin.
