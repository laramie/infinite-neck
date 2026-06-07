# Sprint 122 Iteration 3 Implementation Plan

## Purpose

This plan turns [122-it3-design.md](/home/laramie/infinite-neck/_doco/design/sprints/122-persistence/122-it3-design.md) into an implementation sequence for coding Iteration 3.

The plan is intentionally conservative.

1. It keeps `myTunings` as the canonical song-owned store.
2. It avoids a broad persistence redesign.
3. It treats the current lineage model as mostly correct.
4. It uses the current `fromBaseID` concept as the implementation basis for the new user-facing "Lineage ID" idea.

## Core Implementation Decision

Iteration 3 should not introduce a brand-new persisted lineage field unless coding proves it is necessary.

Instead:

1. Library tunings continue to use `baseID` as their canonical archetype ID.
2. Song-owned tunings continue to use `baseID` as their unique instrument ID.
3. Song-owned tunings continue to use `fromBaseID` as their lineage or compatibility ID.
4. The UI may label `fromBaseID` as "Lineage ID" in the add/edit flow.

This preserves the current clone behavior and keeps compatibility logic aligned with the existing `fromBaseID || baseID` runtime pattern.

## Scope

Iteration 3 should include the following.

1. Rename the tabs to "Tunings in Song" and "Tunings Library".
2. Make the library tab read-only except for Clone and non-destructive comparison fields.
3. Move the current deep USER editor off the library tab and onto the song-owned tab.
4. Redefine that editor as an "Add one tuning" flow.
5. Have that flow create a new `myTunings` row directly.
6. Validate unique song tuning IDs.
7. Validate lineage using the existing `fromBaseID` model.
8. Update help text and docs to match the new flow.

Iteration 3 should not include the following.

1. Clone from song tuning.
2. A full helper rename sweep such as replacing every use of `getAllTunings()`.
3. Full removal of all runtime `USER` handling if doing so risks widening the change.
4. A schema redesign for tunings.

## Working Assumptions

The plan assumes the following are already true and should remain true.

1. Every visible or interactive instrument in a song should correspond to a unique tuning row in `myTunings`.
2. Library tunings are templates, not user-owned mutable objects.
3. A cloned library tuning gets a unique song tuning ID and preserves lineage through `fromBaseID`.
4. Compatibility logic should continue to treat lineage plus structure as important inputs.

## Proposed File Targets

The coding work will likely center on these files.

1. [TuningsLibrary.js](/home/laramie/infinite-neck/TuningsLibrary.js)
2. [index.html](/home/laramie/infinite-neck/index.html)
3. [help.html](/home/laramie/infinite-neck/help.html)
4. [infinite-neck.js](/home/laramie/infinite-neck/infinite-neck.js)
5. [Song.js](/home/laramie/infinite-neck/Song.js)
6. Relevant tests under [_tests/jest](/home/laramie/infinite-neck/_tests/jest)

Depending on how tightly the USER path is retired, [bin/song-file-schema.js](/home/laramie/infinite-neck/bin/song-file-schema.js) and [SongPersistence.js](/home/laramie/infinite-neck/SongPersistence.js) may also need a review, though not necessarily a change in the first pass.

## Implementation Phases

## Phase 1: UI Naming And Library Tab Simplification

Objective:

Make the UI reflect the correct ownership model before changing deeper behavior.

Tasks:

1. Rename the "My Tunings" tab label to "Tunings in Song".
2. Rename the "All Tunings" tab label to "Tunings Library".
3. Remove or disable editing-oriented controls from the library tab where they imply ownership or mutation.
4. Keep Clone available in the library tab.
5. Keep useful comparison fields visible in the library tab.

Notes:

1. This phase should be largely UI-only.
2. Code helper names do not need to change yet.
3. The library tab should answer "what can I start from?" and not "where do I edit my song tunings?"

Exit criteria:

1. User-facing labels match the design.
2. The library tab no longer reads like a place for deep custom editing.

## Phase 2: Move Deep Custom Editing To The Song-Owned Side

Objective:

Retire the current conceptual role of the USER editor and replace it with a song-owned add flow.

Tasks:

1. Move the current USER editor UI from the library tab into the song-owned tab.
2. Rename the entry point from "Customize USER Tuning" to "Add one tuning" or equivalent.
3. Review the fields in that editor and keep only those needed for deep creation or deep editing.
4. Introduce a user-facing "Lineage ID" field that maps to `fromBaseID` in the created song tuning row.
5. Keep the current shallow row edits in the song-owned table.

Notes:

1. This phase is primarily about ownership and flow, not about broad runtime cleanup.
2. The editor can initially be add-only if edit-in-place would complicate the first implementation too much.
3. If edit support is inexpensive, it may be included, but the add flow is the key requirement.

Exit criteria:

1. A user can create a custom song tuning without touching the library tab's old USER flow.
2. The created tuning is inserted directly into `myTunings`.
3. The created tuning appears as a normal song-owned row.

## Phase 3: Implement Song-Tuning Creation Logic

Objective:

Replace USER-object mutation with direct creation of song-owned tuning objects.

Tasks:

1. Add a creation path that builds a new tuning object from the add form.
2. Set `instance: true` and `visible: true` on created song-owned tunings unless there is a strong reason not to.
3. Set `baseID` to the unique song tuning ID supplied or derived by the form.
4. Set `fromBaseID` from the user-facing Lineage ID field.
5. Set `baseInstrument`, `caption`, `nStrings`, `rowRange`, `banjoNut`, and other relevant tuning properties from the form.
6. Push the new object into `getMyTuningsStore()`.
7. Refresh the song-owned table and install or show the corresponding note table.

Notes:

1. The implementation should follow the existing clone flow where practical.
2. This is the lowest-risk way to align the new feature with the current storage model.

Exit criteria:

1. New custom tunings are real `myTunings` entries.
2. No mutation of the shared runtime `USER` tuning is required for the new flow.

## Phase 4: Validation Rules For ID And Lineage

Objective:

Make the add flow safe and predictable without inventing a new schema.

Tasks:

1. Validate that the new song tuning `baseID` is unique across active known tunings.
2. Validate that `rowRange` parses successfully and determines `nStrings`.
3. Validate that `banjoNut`, if provided, parses successfully.
4. Validate that `fromBaseID` is non-empty when the add flow requires lineage.
5. If `fromBaseID` matches a known library `baseID` or an already-known lineage definition, require compatible structure.
6. If `fromBaseID` is newly invented, accept it only if it becomes the first definition of that lineage for its structural signature.
7. If another song tuning already uses the same `fromBaseID`, require compatible structure before allowing reuse.

The minimum compatibility checks for reuse of a lineage should be:

1. Matching `baseInstrument`
2. Matching `nStrings`
3. Matching `rowRange`

Notes:

1. This follows the new note in the design doc: if `fromBaseID` points at an existing lineage, structure must match.
2. If a new lineage is invented, that song tuning becomes the first active definition of that lineage in the current song/runtime context.
3. This preserves the usefulness of lineage without introducing a separate persisted lineage registry in Iteration 3.

Exit criteria:

1. The add flow rejects structurally inconsistent reuse of an existing lineage.
2. The add flow allows invention of a new lineage when no conflict exists.

## Phase 5: Narrow Separation Of Concerns Cleanup

Objective:

Reduce confusion around `getAllTunings()` enough to support the new UI model without requiring a large helper refactor.

Tasks:

1. Ensure the library tab renders from library tunings only.
2. Ensure the song-owned tab renders from song tunings only.
3. Leave `getAllTunings()` available for runtime-wide lookup or install behavior where that is still needed.
4. Add comments or small helper wrappers if necessary to clarify the difference between library rendering and global lookup.

Notes:

1. The key change is behavioral separation, not helper renaming.
2. A later refactor can rename helpers such as `getAllTunings()` if that still seems valuable.

Exit criteria:

1. The library tab no longer depends conceptually on the mixed helper.
2. The runtime can still find and install all known tunings it needs.

## Phase 6: USER Path Containment

Objective:

Reduce dependency on the old USER abstraction without forcing a risky all-at-once removal.

Tasks:

1. Stop routing new custom tuning creation through the USER runtime object.
2. Leave legacy load behavior intact initially if that reduces migration risk.
3. Audit whether the save path still needs to pass `userInstrumentTuning` for this Iteration.
4. If safe, stop writing or updating that bridge data for newly created song tunings.
5. If not yet safe, leave legacy bridge behavior in place but ensure the new flow does not depend on it.

Notes:

1. This phase should be conservative.
2. The goal is to remove USER from the new path first, not necessarily from every legacy path immediately.

Exit criteria:

1. The new Iteration 3 flow does not rely on USER.
2. Existing songs still load acceptably.

## Testing Plan

The minimum test coverage for Iteration 3 should include the following.

1. UI labels changed to "Tunings in Song" and "Tunings Library".
2. Cloning from the library still creates a song-owned tuning with a unique `baseID` and preserved `fromBaseID`.
3. Adding a custom tuning creates a `myTunings` row directly.
4. Adding a custom tuning rejects duplicate song tuning IDs.
5. Reusing an existing lineage rejects mismatched `nStrings`.
6. Reusing an existing lineage rejects mismatched `rowRange`.
7. Inventing a new lineage succeeds when no conflict exists.
8. The created tuning installs or displays as expected.
9. Existing songs with `userInstrumentTuning` still load acceptably.

Candidate test files likely to need updates or additions:

1. [_tests/jest/song-api-load-V2.test.js](/home/laramie/infinite-neck/_tests/jest/song-api-load-V2.test.js)
2. [_tests/jest/ui-smoke.test.js](/home/laramie/infinite-neck/_tests/jest/ui-smoke.test.js)
3. [_tests/jest/display-options.test.js](/home/laramie/infinite-neck/_tests/jest/display-options.test.js)
4. A new targeted tuning-flow test if the existing suites do not isolate this behavior well.

## Suggested Coding Order

The recommended coding order is:

1. Update labels and library-tab rendering behavior.
2. Move and rename the USER editor UI.
3. Implement direct creation into `myTunings`.
4. Add ID and lineage validation.
5. Refresh install/show behavior for the new rows.
6. Run targeted tests and fix regressions.
7. Decide whether limited cleanup of legacy USER save behavior is safe in the same change.

This order keeps the risky work late and keeps the visible behavioral shift aligned with the data-model shift.

## Risks

The main risks are:

1. Accidentally breaking legacy load behavior tied to `userInstrumentTuning`.
2. Allowing inconsistent reuse of a lineage ID.
3. Leaving the library tab partially editable in confusing ways.
4. Breaking runtime note-table installation if the new song-owned add flow does not trigger the same refresh/install hooks as Clone.

## Open Questions For Review Before Coding

These are the questions worth explicitly approving before implementation starts.

1. Should the new add flow require Lineage ID, or allow it to default to the new song tuning ID when omitted?
2. Should a newly invented lineage be validated only within the current song/runtime, or should the library namespace also block reuse?
3. Should the first Iteration 3 delivery support only add, or both add and deep edit through the moved form?
4. Should newly added custom tunings always default to visible, matching Clone behavior?
5. Should limited cleanup of legacy `userInstrumentTuning` save behavior be part of this Iteration, or explicitly deferred?

## Recommended Default Answers

My recommendation for those questions is:

1. Require Lineage ID in the new add flow.
2. Validate invented lineage against both library `baseID` values and already-used song lineage values.
3. Support add first; keep deep edit of existing song tunings as a follow-up unless it comes nearly for free.
4. Default new custom tunings to visible.
5. Defer full cleanup of legacy `userInstrumentTuning` save behavior unless testing shows it is already inert and easy to remove safely.

## Summary

Iteration 3 can be implemented as a focused ownership-and-lineage cleanup.

The practical coding plan is:

1. Rename and simplify the tabs.
2. Move deep custom tuning creation onto the song-owned side.
3. Use `fromBaseID` as the implementation backing for the user-facing Lineage ID concept.
4. Create custom tunings directly in `myTunings`.
5. Validate that reused lineage matches structure.
6. Leave broader helper renames and full USER retirement for later unless they prove cheap and safe.

That should give a clean path to coding without stretching the Iteration into a broader redesign.
