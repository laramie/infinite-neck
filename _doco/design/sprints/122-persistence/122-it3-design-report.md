# 122 Iteration 3 Design Report

## Summary

The direction in [122-it3-design.md](/home/laramie/infinite-neck/_doco/design/sprints/122-persistence/122-it3-design.md) is correct.

The important thing already working today is this:

1. `tunings.js` is the template/library source.
2. `myTunings` is the song-owned, persisted source.
3. Cloning from library to song already matches the right mental model.

So the real problem in this Iteration is not persistence. The real problem is that the current UI names and one special runtime path (`USER`) blur the model and weaken tuning lineage.

My recommendation is to treat this Iteration as a staged cleanup:

1. Fix the user-facing names first.
2. Keep `myTunings` as the canonical song-owned object.
3. Stop treating `USER` as a privileged conceptual tuning.
4. Preserve and clarify lineage fields so MIDI paste and compatibility checks stay meaningful.
5. Defer true "clone from song tuning" and full one-tuning editor expansion unless they can be added without disturbing the current clone/install flow.

## What Is Already Right

The current code already contains the foundation the design wants.

1. `getMyTuningsStore()` returns `song.myTunings`, so song-owned tunings already have a clear home.
2. The clone flow in [TuningsLibrary.js](/home/laramie/infinite-neck/TuningsLibrary.js) already deep-clones a source tuning into `myTunings`, assigns a new `baseID`, stamps `fromBaseID`, and marks the clone visible.
3. The "My Tunings" table is already the place where a tuning becomes editable in practical terms, including rename and visibility behavior.
4. The persistence docs already treat `myTunings` as canonical and `userInstrumentTuning` as a bridge/special case rather than the real durable model.
5. The sample song [LarsUserTunings.json](/home/laramie/infinite-neck/_doco/design/sprints/122-persistence/LarsUserTunings.json) confirms that `myTunings` already carries the real song-owned instruments, while `userInstrumentTuning` behaves like an auxiliary bridge object.

That means the proposed direction is mostly a clarification and consolidation of existing behavior, not a fresh invention.

## What The Sample Song Confirms

The sample song strengthens the case for the proposed cleanup.

1. The song persists multiple real instruments in `myTunings`, and those are clearly the important objects for the song.
2. Several materially different instruments use `fromBaseID: "USER"`, including Banjo and Guitar variants. That is exactly the lineage collapse described in the design note.
3. `userInstrumentTuning` in the same file appears to duplicate one custom tuning shape rather than introduce a separate durable concept.
4. `visibleNoteTables` points at the `myTunings`-derived table IDs, which further supports the idea that song behavior is already centered on song tunings, not on the special USER object.

So the sample does not weaken the report's recommendation. It makes it more concrete: the current songfile already shows that `myTunings` is the real model, and `USER` is the confusing leftover abstraction.

## Main Design Tension

The main tension is that two different ideas are currently using overlapping names.

1. Library/template identity.
2. Song-owned tuning identity.
3. Compatibility lineage.
4. Actual table/instrument identity in the song.

Today those ideas are partially carried by `baseID`, partially by `fromBaseID`, and partially by table IDs derived from tuning IDs.

That works acceptably when a song tuning is a near-clone of a library tuning. It becomes muddy when many unrelated custom instruments all descend from `USER`.

That is the strongest point in the design note: `USER` collapses lineage that should remain specific.

## Concrete Code Constraints

These constraints matter because they show what can be changed cheaply and what will ripple.

1. `getAllTunings()` currently returns `allTunings.tunings.concat(getMyTuningsStore())` in [TuningsLibrary.js](/home/laramie/infinite-neck/TuningsLibrary.js). So the code-level concept "All Tunings" is not actually pure library data.
2. Save still passes `userInstrumentTuning: TuningsLibrary.findTuningForID("USER")` in [infinite-neck.js](/home/laramie/infinite-neck/infinite-neck.js#L862).
3. Load still restores that special object back onto the live runtime `USER` tuning in [infinite-neck.js](/home/laramie/infinite-neck/infinite-neck.js#L953).
4. MIDI compatibility already depends on lineage concepts. In [move-helpers.js](/home/laramie/infinite-neck/move-helpers.js#L22), compatibility ID uses `fromBaseID || baseID`.
5. Clone already sets `fromBaseID = baseID`, which is the right basic rule for preserving ancestry.

This means the most valuable near-term change is not changing persistence shape again. It is making lineage and ownership more explicit while shrinking the privileged role of `USER`.

## Round 2 Response

The new Round 2 notes sharpen the design in a useful way.

The most important refinement is this: if "Tunings Library" is truly just a source of starting points, then the current USER editor does not belong there. It belongs with song-owned tunings, because it is really an "add one song tuning" flow.

I agree with the Round 2 direction, with a few clarifications.

### 1. Make the library tab a true starting-point list

If the library tab is conceptually read-only, then showing editable-looking controls there is misleading.

The current code still renders many controls into the clone/library table because the old model allowed the library area to act partly as a staging area for USER customization. Round 2 is correct to push against that.

Recommendation:

1. Keep Clone on the library side.
2. Keep informative columns such as instrument, strings, notes, and maybe frets if useful for comparison.
3. Remove or make read-only columns that imply editing ownership, especially if the same edits are now meant to live on song tunings.
4. Move deep-edit affordances completely off the library tab.

That would make the library tab simpler and would align it with the new naming.

### 2. Move the USER editor into "Tunings in Song" as an add flow

This is the strongest new idea in Round 2.

The current USER editor in [index.html](/home/laramie/infinite-neck/index.html) is really not editing a normal library tuning. It edits the special runtime `USER` object through fields such as `textareaRowRange`, `textareaBanjoNut`, `dropDownBaseInstrument`, and `txtUserInstrumentCaption`, then saves through `btnSaveUserTuning`.

The handler in [TuningsLibrary.js](/home/laramie/infinite-neck/TuningsLibrary.js) confirms this: it loads `findTuningForID("USER")`, mutates that object, and copies it onto `getSong().userInstrumentTuning`.

That flow is exactly what Round 2 is trying to retire.

The cleaner interim replacement is:

1. Put the editor on "Tunings in Song".
2. Rename it from "Customize USER Tuning" to something like "Add Song Tuning" or "Add Custom Tuning".
3. On save, create a new `myTunings` row directly rather than mutating the shared `USER` runtime object.
4. Let the new row then participate in the same shallow row edits the current my-tunings table already supports.

This is a good fit for the current architecture because it does not require clone-from-song yet, and it uses the existing song-owned store.

### 3. A separate Lineage ID is the right missing field

Round 2 improves on Round 1 by naming the real missing concept directly.

The current flow already supports changing the song tuning ID. What it does not support clearly is declaring the compatibility lineage independently from that per-song instrument ID.

The example in the design note is strong:

1. `P5` is the tuning lineage or archetype.
2. `LarP5_mark` is the concrete song instrument.

That distinction is better than treating `LarP5_mark` itself as the compatibility identifier.

So I agree that the new add/edit flow should validate two separate ideas:

1. Song tuning ID: unique within the installed song/runtime namespace.
2. Lineage ID: meaningful as a compatibility/archetype label and not conflicting with known lineage names in confusing ways.

This does not necessarily mean introducing a brand-new persisted field in Round 2 if that feels too large. It does mean the design should stop pretending one ID is sufficient for both jobs.

### 4. Current role of `getAllTunings()`

The current code uses `getAllTunings()` as a convenience helper for "anything the app may need to find by tuning ID," not just for the visible library tab.

The current call sites show four practical roles.

1. Global lookup: `findTuning()` and `findTuningForID()` use it so callers can ask for a tuning by ID without knowing whether the source is library or song-owned.
2. Bulk visibility operations: `hideAllTunings()` iterates it so every known tuning can be hidden.
3. Duplicate-ID protection: the my-tuning rename flow checks `getAllTunings().some(...)` so a song tuning cannot be renamed to collide with an existing library or song tuning.
4. Table installation: [infinite-neck.js](/home/laramie/infinite-neck/infinite-neck.js) calls `TuningsLibrary.getAllTunings()` in `installAllTuningsTables()` to build every note-table div the runtime might show.

So the concatenation exists because the current runtime wants one combined set for lookup and installation.

That means the function is not wrong, but its name and conceptual position are misleading.

### 5. Implications for separating concerns

The implication is not that `getAllTunings()` must disappear immediately. The implication is that one helper is currently serving two different concerns.

Those concerns are:

1. Library presentation.
2. Runtime-wide tuning lookup/install.

Those should be split conceptually, even if the refactor happens in stages.

Recommended split:

1. `getLibraryTunings()`: library-only rows from `tunings.js`.
2. `getSongTunings()` or the existing `getMyTuningsStore()`: song-owned rows.
3. `getKnownTunings()` or similar: the current concatenated lookup/install list.
4. `findAnyTuningForID()` or similar: explicit global lookup when callers do not care about ownership.

With that split:

1. The "Tunings Library" tab can render only library rows.
2. The "Tunings in Song" tab can render only song rows.
3. Runtime install/show/hide logic can still use a combined list where that is actually required.
4. Future maintenance gets easier because helper names begin to explain intent.

This is the main architectural implication of Round 2.

### 6. One additional code smell worth noting

There is one detail in current code that strengthens the case for cleanup.

In [infinite-neck.js](/home/laramie/infinite-neck/infinite-neck.js), save still passes `userInstrumentTuning` into `prepareForSave(...)`, but the current implementation in [Song.js](/home/laramie/infinite-neck/Song.js) no longer assigns that value during `prepareForSave(...)`.

At the same time, load still checks for `getSong().userInstrumentTuning` and copies it into the runtime `USER` object.

That suggests the USER bridge path is already partially stale. It is another reason to avoid building new design around it.

## Round 2 Recommendations

If you want to keep Round 2 small and high-value, I would recommend this exact slice.

1. Make "Tunings Library" visually read-only except for Clone.
2. Move the USER/custom editor onto "Tunings in Song" and redefine it as "Add one tuning".
3. Have that add flow create a song-owned row directly.
4. Validate both song ID and lineage ID in that flow.
5. Keep `getAllTunings()` behavior for runtime lookup/install if needed, but stop treating it as the model for the library tab.
6. Add a follow-up refactor task to separate library-only helpers from global lookup helpers.

That would answer the Round 2 concerns without opening a larger rewrite.

## Analysis Of The Proposed Changes

### 1. Rename "My Tunings" to "Tunings in Song"

This is a strong change and should be done.

Reasons:

1. It matches actual persistence semantics.
2. It removes the misleading personal/global implication of "My".
3. It aligns with the sprint-122 design principle that song-owned objects are the persisted truth.

Low risk if kept user-facing only in this round.

### 2. Rename "All Tunings" to "Tunings Library"

This is also directionally correct, but it exposes a code mismatch.

User-facing rename is good.

But the report should note that the current data source for "All Tunings" is not pure library content. If the label changes to "Tunings Library", the implementation should eventually stop using the mixed `getAllTunings()` list for that tab.

Recommendation:

1. Change the label now.
2. Keep code names for this Iteration if desired.
3. Add a follow-up task to separate "library list" from "lookup across all known tunings" in code.

That separation will make later reasoning much easier.

### 3. Allow deeper customization in song-owned tunings

This is the correct end state.

But I would frame it more carefully:

1. Song-owned tunings should be fully editable in principle.
2. Not every field needs to become inline-editable in this Iteration.
3. The editing surface should respect validation and lineage rules.

The design note is right that changing arrays like `rowRange`, `banjoNut`, string count, or base instrument should move into a focused one-tuning editor rather than expanding the grid.

That is not only a UI preference. It is also where the model needs validation hooks.

### 4. Eliminate USER tuning as the special mental model

This is the most important recommendation in the note.

I agree with the goal, but I recommend a phased interpretation:

1. Eliminate `USER` as a user-facing concept first.
2. Then eliminate it as a persistence bridge.
3. Only then remove any remaining runtime dependency.

The reason for doing this in phases is that the runtime still clearly depends on a live `USER` tuning object during save/load. Replacing that in one step is possible, but it increases the chance of mixing conceptual cleanup with load/install regressions.

The conceptual rule should become:

1. Every song-owned instrument is just a tuning in `myTunings`.
2. Its ancestry should point to a meaningful library archetype when one exists.
3. If it becomes sufficiently customized that it no longer matches a known archetype, the song still owns it directly; it does not need to become "USER".

That is a better mental model than having a universal USER ancestor.

### 5. Add a one-tuning edit flow

This is the right place for the hard edits.

I would explicitly define its job as:

1. Validate changes that affect layout or compatibility.
2. Keep tuning identity rules coherent.
3. Prevent accidental duplicate IDs.
4. Make it obvious whether the user is editing a song tuning or cloning a new one.

The main caution is scope. A modal/editor flow is reasonable. A large new subsystem is not necessary for this Iteration.

### 6. Future clone-from-song flow

This makes sense, but it is not required to solve the USER problem.

It should be treated as a later round unless implementation turns out to be trivial. The current clone flow already provides the main value: library to song.

The USER problem is solved by preserving real ancestry and editing song-owned tunings directly, not by adding more clone sources immediately.

## Suggested Terminology Cleanup

The design note is circling an important distinction that should be stated directly.

I recommend these terms:

1. Library tuning: a template from `tunings.js`.
2. Song tuning: an entry in `song.myTunings`.
3. Tuning ID: the unique identifier for a song-owned tuning row and its related table keying.
4. Lineage ID: the compatibility ancestor used for paste/import reasoning. Today this is effectively `fromBaseID || baseID`.

That is more stable than trying to make one field carry all meanings.

In particular, I would avoid overloading `baseID` in the prose.

Today `baseID` is doing two jobs:

1. It is the tuning object's current ID.
2. In library objects, it also implies archetype identity.

Once users deeply edit song tunings, those jobs diverge.

So the report recommendation is:

1. Keep current field names for now if minimizing disruption matters.
2. But describe them internally as current ID versus lineage source.
3. Do not let future design prose assume that `baseID` alone is enough to express both archetype and instance meaning.

## Validation Rules Worth Making Explicit

The design note correctly says validation is tricky. I think these rules should be written down before coding.

1. Every song tuning ID must be unique across all installed song tunings.
2. Editing a song tuning ID must continue to rename table/model references safely.
3. If a song tuning is cloned from a library tuning, it should preserve lineage to that source.
4. Deep edits should not silently erase lineage unless the user intentionally re-bases the tuning.
5. Compatibility decisions should prefer explicit lineage plus structural facts such as string count and instrument family.
6. A generic catch-all lineage such as `USER` should not be the normal result of deep edits.

This is where the current design note is strongest: it recognizes that a musician's customized instrument is still a meaningful instrument, not an anonymous user blob.

## Recommended Phasing

### Round A: low-risk mental-model cleanup

1. Rename the tabs to "Tunings in Song" and "Tunings Library".
2. Update docs and UI copy to state that song persistence lives in `myTunings`.
3. Keep existing code names and clone flow.
4. Document that the current "library" implementation is still backed by mixed lookup helpers.

### Round B: reduce USER specialness without widening scope too much

1. Add the one-tuning edit flow for song tunings.
2. Make song tuning edits the preferred path for custom instruments.
3. Stop encouraging USER as the way to create a custom instrument.
4. Preserve meaningful lineage from initial library source instead of flattening to USER.

### Round C: remove the bridge object if still needed

1. Change save/load so custom instruments are restored purely from `myTunings` rather than copying through a live `USER` tuning object.
2. Audit any runtime installation code that still assumes `USER` exists.
3. Remove or quarantine legacy `userInstrumentTuning` behavior.

### Round D: optional later improvements

1. Clone from "Tunings in Song".
2. Separate code helpers for library-only list versus all-known lookup.
3. Consider a more explicit field name for lineage if future refactoring makes that worthwhile.

## Suggested Design Adjustments

Here are the main changes I would make to the design note before coding.

1. Replace "This does away with a USER tuning, and makes all User instruments USER tunings" with a clearer statement that all custom instruments become normal song tunings, not USER-class tunings.
2. Explicitly separate user-facing naming changes from code/data refactors.
3. State that `getAllTunings()` is currently a mixed lookup helper and should not be treated as proof that the library and song stores are conceptually the same thing.
4. State that lineage must survive cloning and most deep edits, because MIDI paste and similar compatibility checks rely on it.
5. Treat clone-from-song as desirable but non-blocking.

## Bottom Line

The design is pointed in the right direction.

The least disruptive version is:

1. Keep `myTunings` as the one true song-owned persisted tuning store.
2. Rename the tabs to match that truth.
3. Move custom-instrument editing onto song tunings.
4. Remove `USER` as the normal conceptual ancestor.
5. Preserve lineage explicitly so compatibility logic remains useful.

If this Iteration stays disciplined about those five points, it should produce a much cleaner mental model without reopening the broader persistence work that sprint-122 has already stabilized.
