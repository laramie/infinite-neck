# sprint-122-persistence

sprint number: 122

sprint short name: persistence

date: 20260604

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to make User-owned persistence round-trip cleanly in the songfile without dragging in runtime-only or library-owned state.

In practical terms, this sprint is about defining and then fixing the persistence boundary between:

- system/library defaults
- runtime expanded state
- User-authored songfile data

The current system already persists some of this, but not consistently. Some fields are duplicated, some are filtered by the save replacer, some are saved but not hydrated correctly on load, and some are derived from the View when they should be model-owned.

## Main goals

- Define a canonical persistence contract for tunings, color/stylesheets, themes, and visible tables.
- Separate real songfile data from runtime-only data and derived/default data.
- Preserve graceful fallback when a host does not have the exact same library defaults installed.
- Keep the songfile shape understandable enough that it can be debugged by inspection.

## Sprint document locations

- [persistence matrix](122-persistence-matrix.md)
- [design document](122-design.md)
- [Copilot preliminary status report](122-report-1.md)

## Current planning position

The preliminary report found these main planning issues:

- `myTunings` is already the real persisted tuning object; `tunings` is a misleading derived snapshot and should not drive the design.
- `visibleNoteTables` is structurally safe to persist, but the current save path still derives it from the live DOM.
- color persistence is split across `theme`, `userTheme`, `userColors`, `colorDicts`, `activeStylesheets`, and `currentColorDict`, with no single canonical contract.
- several replacer exclusions are harmless runtime noise, but a few expose real ownership problems that the sprint must resolve.

## Iterations

### Iteration 1: Define Scope and Persistence Matrix

- Correct the matrix so it reflects the actual current system.
- Identify canonical songfile objects versus derived/runtime/library objects.
- Define fallback behavior for peers that do not share the same libraries.

### Iteration 2: Fix User Colors and Stylesheets

- Decide what part of color customization belongs in the songfile.
- Stop persisting or depending on redundant runtime-expanded stylesheet state.
- Ensure saved color data hydrates back into runtime state correctly.

- filter colorDicts and userColors now properly.
- DONE

### Iteration 3: Fix myTunings and ensure USER tuning works

- Confirm `myTunings` remains the persisted User tuning object.
- Ensure `USER` tuning persistence and reload semantics are stable.
- Avoid leaking live-library references or denormalized `tunings` snapshots into the songfile contract.

- Reorganized so that "Add one Tuning" replaces lots of this, and USER tuning is gone.
- DONE

### Iteration 4: Fix User Themes

- Define the relationship between `theme` and `userTheme`.
- Ensure a saved `USER` theme rehydrates correctly on load.
- Preserve graceful fallback when a host lacks an exact theme match.

- userTheme is saved in the songfile.   When song loads, this is loaded into USER theme in the dropdown, and any Theme button saves go to that USER theme.  Graceful fallback on host lacking theme not tested or implemented.
- DONE
- Fixed incompleteness: USER was coming up as the selected Theme always. FIXED

### Iteration 5: Fix Visible Tables

- Remove View-only dependence from visibility persistence.
- Ensure visible-table persistence can work in no-View or headless save flows.
- Keep visibility persistence from mutating or clobbering note-table model content.


