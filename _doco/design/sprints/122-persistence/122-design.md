# sprint-122-persistence Design document

The Iterations are planned and scheduled from sprint-122.md

Here we define the detail and work we foresee in the Iterations.

The main design question for sprint-122 is not simply "what fields should be unfiltered by the replacer?".

The real question is:

- which objects are canonical song-owned persistence objects,
- which objects are runtime-expanded or library-owned,
- and how load/save should hydrate between them without duplication or drift.

The [persistence matrix](122-persistence-matrix.md) is the authoritative cross-reference for that work.

## Design principles

1. Persist canonical User-owned objects, not runtime-expanded convenience state.
2. Prefer one songfile object per persistence concern rather than multiple overlapping snapshots.
3. Allow graceful fallback when a host lacks the exact same library defaults.
4. Do not require the View or DOM to save song-owned persistence state.
5. Keep songfiles human-debuggable.

## Current problem statement

At the moment the persistence system mixes four categories of state:

- library defaults such as `themes.js` and `tunings.js`
- runtime-expanded state such as `colorDicts` and `activeStylesheets`
- song-owned state such as `myTunings` and `visibleNoteTables`
- session-only state such as `isHeadless` and random-loop-history

These categories are not consistently separated. Some fields are already persisted correctly, some are persisted but loaded incompletely, and some are derived or runtime-only values that should remain filtered.


-------------------------

## Iterations

### "Iteration 1": Persistence Matrix

Title: Define Scope and Persistence Matrix

Scope:
  - Define all User-facing persistence areas that belong in the songfile.
  - Correct the [persistence matrix](122-persistence-matrix.md) so it reflects actual current code and file formats.
  - Explicitly define things that are *not* persisted.
  - Define fallback behavior when a host does not have matching library defaults.
  - Produce iteration-by-iteration design targets for the rest of the sprint.

Desired output:

- one corrected matrix that names canonical songfile objects
- a short list of runtime-only filtered fields
- a short fallback policy for tunings, themes, and stylesheets

Key questions to settle:

- Is `userColors` the canonical saved color payload, or should a different User-owned object replace it?
- Is `userTheme` the canonical saved custom theme payload when `theme === "USER"`?
- Is `visibleNoteTables` model-owned, caller-owned, or still View-derived?

### "Iteration 2": Fix User Colors/Stylesheets

Problem:

Color persistence is currently split across `userColors`, `colorDicts`, `activeStylesheets`, `currentColorDict`, and the live global merged palette. The save and load contracts are not aligned.

Goals:

- choose a canonical songfile payload for User color customization
- stop relying on runtime-expanded `colorDicts` as the persistence contract
- ensure saved color payload hydrates into the live runtime palette on open
- keep fallback behavior reasonable when stylesheet names differ across hosts

Likely non-goals:

- persisting every system/default stylesheet in full
- preserving every runtime checkbox/order artifact unless explicitly chosen as canonical

### "Iteration 3": Tunings

Title: Fix myTunings, ensure USER tuning works.

Problem:

`myTunings` is already the real V2 persistence object, but the older `tunings` idea still creates confusion. The special `USER` tuning also splits ownership between runtime library state and a songfile snapshot.

Goals:

- confirm `myTunings` as the canonical persisted tuning list
- keep `tunings` filtered and documented as derived/legacy
- ensure `userInstrumentTuning` cleanly restores the runtime `USER` tuning
- preserve graceful behavior when a peer host lacks matching installed tuning library entries

Design note:

This iteration is about persistence contract and load behavior, not about expanding the tuning library itself.

Iteration 3 Design work continues in: [Iteration 3 Design](122-it3-design.md)


### "Iteration 4": USER Theme

Title: Fix USER Theme

Problem:

The system persists `theme` and often `userTheme`, but the load path does not yet clearly rehydrate `userTheme` into the runtime `USER` theme registry before selection.

Goals:

- define the relationship between `theme` and `userTheme`
- ensure `theme === "USER"` loads predictably
- keep library themes lightweight by saving only selected ids plus custom payload when needed
- define graceful fallback for missing named themes

Fallback target:

- if a named library theme is missing, fall back to installed default or nearest compatible theme
- if a `userTheme` payload exists, prefer it over host library absence

### "Iteration 5": Fix Visible Tables

[122-it5-report](122-it5-report.md)
[122-it5.design](122-it5-design.md)

Problem:

`visibleNoteTables` is already a good persisted shape, but save currently derives it from DOM visibility. That makes persistence depend on the View, which is the opposite of what this sprint wants.

Goals:

- make `visibleNoteTables` save cleanly without requiring the DOM
- keep note-table visibility persistence from mutating underlying section note data
- preserve current round-trip behavior for existing songs

Likely design direction:

- the model or save caller should provide the authoritative visible-table list
- the View may reflect or edit that state, but should not be the only source of truth



----------------------


## Sprint-122 Risks and edge cases

### Peer host does not have the same library tuning

- `myTunings` in the songfile should be enough to preserve user-created tunings.
- The host should not depend on matching installed tuning libraries for song-owned tunings.

### Peer host does not have the same library theme

- `theme` ids should fall back gracefully.
- `userTheme` should carry enough payload to reconstruct the custom theme intent.

### Old stylesheet names differ across versions

- role coverage matters more than exact stylesheet names.
- avoid persisting more runtime-expanded stylesheet detail than necessary.

## Out of scope

- session cursors like current section index
- playback history and random-selection history
- callback/pointer objects
- broader future import/export package design for full libraries
