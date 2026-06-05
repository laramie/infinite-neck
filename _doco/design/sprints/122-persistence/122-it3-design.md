# Sprint 122 Iteration 3 Design

## Purpose

Iteration 3 is about clarifying the tuning mental model and removing the conceptual weight of the special `USER` tuning without reopening the broader persistence work.

Persistence for tunings is already largely correct today.

1. `tunings.js` is the library of templates and examples.
2. `myTunings` is the song-owned, persisted source of tunings actually used in a song.
3. The main design problem is naming, ownership, and lineage clarity.

The goal of this Iteration is to make those responsibilities explicit in the UI and in the tuning flows.

## Current Model

The current system already has the right foundation.

1. Library tunings come from `tunings.js`.
2. Song tunings are stored in `song.myTunings`.
3. Cloning from the library already creates a song-owned tuning row.
4. The current special `USER` flow provides a deep custom editor, but it does so through a privileged runtime tuning object rather than directly through `myTunings`.

The sample song [LarsUserTunings.json](/home/laramie/infinite-neck/_doco/design/sprints/122-persistence/LarsUserTunings.json) demonstrates both sides of the current model.

1. The real song-owned instruments are in `myTunings`.
2. Several materially different custom instruments share `fromBaseID: "USER"`.
3. That weakens lineage and makes compatibility decisions less meaningful.

## Problem Statement

The current design has three related problems.

1. The tab labels are misleading.
2. The `USER` tuning acts as a conceptual and runtime special case.
3. The current naming around IDs does not cleanly separate song-owned instrument identity from lineage identity.

The result is that a musician can create a useful custom instrument, but the system may describe its ancestry only as `USER`, even when a more meaningful lineage should be preserved or declared.

## Design Goals

This Iteration should achieve the following.

1. Make the UI names match the real ownership model.
2. Keep `myTunings` as the one true song-owned persisted tuning store.
3. Move deep custom-instrument editing onto the song-owned side.
4. Reduce or eliminate `USER` as a user-facing concept.
5. Preserve meaningful lineage for compatibility features such as MIDI paste.
6. Keep implementation disruption small.

## Non-Goals

This Iteration should not try to do the following.

1. Rework the entire persistence contract for songs.
2. Add clone-from-song-tuning as a required feature.
3. Support every legacy song pattern in the workspace as if it were authoritative.
4. Redesign all tuning-related runtime install logic in one step.

Some existing songs are older and predate V2 cleanup work. Design decisions in this Iteration should be based primarily on current V2 intent, fixtures, and active runtime behavior, not on every legacy artifact.

## User-Facing Naming

The current conceptual split is correct, but the labels should change.

1. Rename "My Tunings" to "Tunings in Song".
2. Rename "All Tunings" to "Tunings Library".

These are user-facing label changes. Code names do not need to change in this Iteration.

The intended meanings are:

1. "Tunings Library" is a list of starting points from `tunings.js`.
2. "Tunings in Song" is the set of tunings owned by and persisted with the song.

## Ownership Model

The ownership model for this Iteration is:

1. Library tunings are templates.
2. Song tunings are the editable and persisted objects.
3. A cloned tuning becomes a song tuning.
4. A newly invented custom tuning should also become a song tuning directly.

This means the special `USER` tuning should no longer be the normal way to think about custom instruments.

## Lineage And Identity

The design needs to separate two ideas that are currently too easy to blur.

1. Song tuning ID: the ID of the specific instrument row used in the song.
2. Lineage ID: the compatibility ancestry or tuning archetype used for reasoning such as MIDI paste.

Example:

1. `P5` is a lineage or tuning archetype.
2. `LarP5_mark` is a concrete song-owned instrument.

The concrete instrument ID should remain unique in the song and table namespace.

The lineage should remain meaningful even when the instrument has been customized.

This is the central fix for the current weakness of `fromBaseID: "USER"` appearing on materially different instruments.

## Round 1 Decisions

Round 1 establishes the design direction.

1. Keep `tunings.js` as the library source.
2. Keep `myTunings` as the persisted song-owned source.
3. Rename the tabs to match those roles.
4. Stop treating `USER` as the intended conceptual ancestor for arbitrary custom instruments.
5. Plan a one-tuning custom editor on the song-owned side.

## Round 2 Decisions

Round 2 narrows the implementation slice so it can be delivered with limited disruption.

### Library Tab

"Tunings Library" should become a read-only list of starting points.

Recommended behavior:

1. Keep Clone in the library tab.
2. Keep informative columns such as instrument, strings, notes, and other comparison-friendly properties.
3. Remove or make read-only the controls that imply library-owned editing.
4. Move deep-edit affordances completely off the library tab.

The library tab should answer one question: what should I start from?

### Song Tab

"Tunings in Song" should be the place where song-owned tunings are created and edited.

Recommended behavior:

1. Keep the current row-level shallow edits there.
2. Move the current USER editor there as a temporary or permanent "Add one tuning" flow.
3. On save, create or update a `myTunings` row directly.
4. Do not route this flow through the privileged runtime `USER` tuning object.

This gives the user one place for ownership and editing.

### Add-One-Tuning Flow

The current "Customize USER Tuning" flow should become a song-owned add flow.

The flow should:

1. Live under "Tunings in Song".
2. Allow deep edits such as rowRange, banjoNut, number of strings, instrument type, and caption.
3. Validate the song tuning ID.
4. Validate the Lineage ID.
5. Create a song-owned row directly in `myTunings`.

The design intent is that a user can invent a tuning such as `P5`, then create an instrument such as `LarP5_mark`, without forcing the lineage to collapse to `USER`.

## Validation Rules

The following rules should be treated as part of the design, not as incidental implementation details.

1. Every song tuning ID must be unique across library and song-owned tunings that share the active runtime namespace.
2. Editing a song tuning ID must continue to rename any model references safely.
3. Cloning from a library tuning should preserve lineage to that source.
4. Deep edits should not silently erase lineage.
5. Compatibility decisions should consider lineage and structural facts such as string count and instrument family.
6. A generic catch-all lineage such as `USER` should not be the normal result of creating or editing a custom tuning.

## Current `getAllTunings()` Behavior

The current implementation of `getAllTunings()` is:

1. `allTunings.tunings.concat(getMyTuningsStore())`

This helper is currently serving runtime convenience more than conceptual clarity.

Today it is used for several distinct jobs.

1. Global tuning lookup by ID.
2. Bulk visibility operations.
3. Duplicate-ID checks.
4. Building all note-table divs the runtime may need to show.

So the combined list is useful, but it should not be mistaken for the conceptual definition of the library tab.

## Separation Of Concerns

The current code uses one helper for two different concerns.

1. Library presentation.
2. Runtime-wide lookup and installation.

Those concerns should be separated conceptually in this Iteration, even if the code refactor happens in steps.

The intended shape is:

1. A library-only list for rendering the "Tunings Library" tab.
2. A song-only list for rendering the "Tunings in Song" tab.
3. A combined known-tunings helper for runtime lookup and install behavior where that is still useful.

This means `getAllTunings()` is not necessarily wrong, but it is poorly named for the UI-level idea it currently seems to imply.

## Recommended Implementation Slice

To keep the Iteration small and effective, the recommended slice is:

1. Rename the tabs.
2. Make the library tab visually read-only except for Clone.
3. Move the deep custom editor onto the song-owned tab.
4. Redefine that editor as "Add one tuning" rather than "Customize USER Tuning".
5. Have the add flow create a `myTunings` row directly.
6. Validate both song ID and Lineage ID.
7. Keep combined runtime lookup helpers where needed, but stop treating them as the conceptual model for the library tab.

## Deferred Work

The following items are reasonable follow-ups, but they are not required for this Iteration.

1. Clone from "Tunings in Song".
2. Rename code-level helpers such as `getAllTunings()` to reflect lookup intent more clearly.
3. Remove any remaining runtime dependency on the special `USER` object once the song-owned add/edit flow fully replaces it.

## Summary

Iteration 3 should clarify the tuning mental model, not reinvent tuning persistence.

The core design is:

1. The library provides starting points.
2. The song owns edited and custom tunings.
3. Custom tunings should be created directly as song tunings.
4. Lineage must remain meaningful.
5. The special `USER` tuning should fade out as a conceptual center of the system.

If implemented this way, the UI becomes easier to understand, custom instruments become easier to reason about, and compatibility logic retains better information without requiring a broad rewrite.

## Notes before implementation plan

Now that we see the call sites, we realize that the getAllTunings confusion comes from the fact that historically, you could have both a myTunings row and an instrument straight from the Tunings Library without unique ID.  This concept went away once we saw that having a unique row in myTunings solved a lot of conflicts, especially as we added Observers and Listeners where uniqueness based on otherwise identical instruments was key.  So much of it may actually be obviated.

We solved most of the lineage problems when designing the fields for tunings.js, plus the added unique ID for instances of instruments cloned from tunings.js.  These should be used when designing the field for "Lineage ID" (or choosing which one already answers it) since they answer most of the purposes of the existing fields: 

```
      "baseID": "P48",
      "baseInstrument": "Guitar",
      "caption": "P4-8",
      "nStrings": 8,
```      
```      
      "baseID": "P46",
      "baseInstrument": "Guitar",
      "caption": "P4",
      "nStrings": 6,
```      
```      
      "baseID": "S6",
      "baseInstrument": "Guitar",
      "caption": "Standard",
      "nStrings": 6,
```      

Here is how a tuning above gets put into myTunings, with an added "fromBaseID" property.
```
    "myTunings": [
    {
      "instance": true,
      "baseID": "P46_1",
      "baseInstrument": "Guitar",
      "caption": "P4",
      "nStrings": 6,
      "fromBaseID": "P46",
      ....
    }
```

These are all "Guitar" baseInstruments.
The 8-string versions have 8 in the baseID, the caption, and obviously "nStrings".
The caption lets the User see that it is a P4 tuning with 8 strings, while keeping the baseID alphanumeric only.
The caption for P46 is just P4 since 6 is the normal number of strings for a guitar, 8-strings being a specialty instrument.
The caption for S6 is "Standard" since this is the most standard guitar setup and tuning, and the tuning and number of strings are well-known.  Still, the baseID includes 6 so it won't conflict with an S8, another rare guitar but important in the world of our Users.

caption is exposed in the Library table as "Tuning" and baseID is exposed as "ID".

Then, when the User Clones an S6 into his "My Tunings", soon to be called "Tunings in Song", he gets the unique baseID: "P46_1" and we cut a new property, fromBaseID: "P46" for compatibility in pasting etc.  This is the current use of the "Lineage ID" concept.  So when the User is allowed to create a custom tuning with the new flow on the "Tunings in Song" page, we'll want to:
- check that baseID is unique, as we do today in Clone
- validate fromBaseID
  - if it is a reference to a baseID already defined, nStrings should match, and "rowRange" should match.
  - if fromBaseID as a baseID is not found then they are inventing a new one, so it becomes the definition of that baseID keyed with nStrings and rowRange.

This is the tricky bit about "Lineage ID" that we'll need to square with the Library and the "Tunings in Song".  
