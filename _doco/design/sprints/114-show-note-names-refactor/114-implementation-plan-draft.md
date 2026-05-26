I have enough context from the current rendering path. I’m turning that into a concrete implementation plan tied to the existing files and repaint lifecycle, with no code changes.**Implementation Plan**

Solution direction: replace the current global text-color hack with a dedicated per-cell universal note-name lane rendered inside each cell’s existing `NoteDisplay`, using theme contrast colors and explicit layer ordering.

Current anchor points
- Cell structure is built in NoteTableController.js and NoteTableController.js.
- Replay applies real NamedNotes in NoteTableController.js.
- The current Show All Note Names hack lives in infinite-neck.js.
- Existing display-layer CSS lives in infinite-neck.css and the piano-specific geometry overrides live in piano-skeuomorphic.css.

**Goals**
- Show note names, MIDI numbers, and functions in the same layout as `namedNote`.
- Keep that universal lane underneath `namedNote`, `singleNote`, `tinyNote`, `Fingering`, and transient/plugin NamedNotes.
- Make it independent from `hideNamedNotes`.
- Make it controlled only by the existing `showAllNoteNames` display option.
- Use theme contrast colors, not note color classes and not computed background introspection.
- Keep it per-cell and within existing `NoteDisplay` geometry so it inherits current sizing, piano layout, nuts, and natural fret widths.

**Design Summary**
- Add a new structural sibling inside each `NoteDisplay`, separate from `namedNote`.
- Give it the same inner layout markup as `namedNote`, but a distinct outer class.
- Toggle it by class or visibility, not by repainting key-family text colors.
- Style it with dedicated contrast CSS variables for white-key and black-key contexts.
- Treat it as display-only. No changes to `SectionNotesPersistence`, section model shape, or clip/transpose persistence.

**Recommended DOM Shape**
In each cell’s `NoteDisplay`, render this order:

1. `universalNamedNote`
2. `tinyNote`
3. `singleNote`
4. `Fingering`
5. `namedNote`

or equivalent explicit z-index ordering that results in:
- universal lane above bare key background
- universal lane below all visible overlays
- real `namedNote` above universal lane
- transient/plugin NamedNotes also above universal lane

The exact DOM order matters less than explicit z-index rules.

**Work Breakdown**

1. **Add a dedicated universal lane builder**
- Update NoteTableController.js so cell construction emits one more lane inside `NoteDisplay`.
- Refactor the existing `buildNamedNote` markup in NoteTableController.js into a shared internal builder that can emit:
  - `namedNote`
  - `universalNamedNote`
- Keep inner content identical in layout:
  - center alignment
  - functions vs note names
  - enharmonic/subscript placement
  - MIDI positioning
  - `CenterCell` behavior
- Outer class must remain distinct so replay/plugin logic continues to target only real `namedNote`.

Implementation note:
- Avoid reusing the `namedNote` class on the universal lane. Much of the existing logic assumes `.namedNote` means persisted or transient NamedNotes, including resets in NoteTableController.js and NoteTableController.js.

2. **Replace the current Show All Note Names strategy**
- Remove the responsibility of infinite-neck.js for deriving contrast from key backgrounds.
- Change the feature so it only toggles visibility/state of the new per-cell universal lane.
- Preferred mechanism:
  - toggle a root class, table class, or `NoteDisplay` descendant selector
  - do not loop through keys mutating font colors
- Keep the existing `showAllNoteNames` boolean in display options. No schema change required because it is already present in infinite-neck.js.

Implementation note:
- The best place to apply the state is likely after `resetNoteNames()` or as part of `displayOptionsToControls()` in infinite-neck.js, but the rendering of the universal lane itself should live in `NoteTableController`.

3. **Add explicit lane CSS**
- In infinite-neck.css, add a dedicated rule set for `.universalNamedNote`.
- Reuse the same box model/layout pattern as `.namedNote`, but with:
  - its own `display`
  - its own `z-index`
  - no note color classes
  - no persistence/transient semantics
- Add explicit z-index values for all overlay layers rather than relying on incidental DOM order.

Recommended visual stack:
- background key face
- `universalNamedNote`
- `tinyNote`
- `singleNote`
- `Fingering`
- `namedNote`
- transient/plugin named-note overlays if they still use `.namedNote`

This is the main behavior guarantee the user wants: any visible note overlay must cover the universal lane.

4. **Add dedicated contrast variables**
- Introduce theme-level CSS variables for the universal lane, likely via themeFunctions.js where theme rules are generated.
- Example variable shape:
  - `--universal-note-white-key-color`
  - `--universal-note-black-key-color`
- Source them from theme configuration, not from note classes and not from computed DOM colors.
- Default values can be black/white for most themes, but the contract should allow other high-contrast pairs.

Likely affected files:
- themeFunctions.js
- themes.js
- possibly theme UI if these should become configurable later

Recommendation:
- For first implementation, wire defaults through theme generation without adding UI controls unless the repo already expects those options to be user-editable immediately.

5. **Handle piano and special layouts via inheritance, not custom logic**
- Because the lane is inside `NoteDisplay`, it should automatically inherit:
  - piano key face geometry from piano-skeuomorphic.css
  - natural fret width sizing from NoteTableController.js
  - nut sizing and font scaling from NoteTableController.js
- Add only minimal piano-specific CSS if the visual stack needs a different z-index or color selector.
- Do not create separate positioning logic for piano unless testing proves a mismatch.

6. **Keep replay and model semantics separate**
- Real NamedNotes should continue to be driven by `sectionNotes.namedNotes` and replay in NoteTableController.js.
- The universal lane should be passive and always reflect the cell’s current textual content.
- It should not:
  - call `setNamedNote`
  - use `lookupUserColorClass`
  - participate in transient named-note event handling
  - persist anything to song data

This separation is the core architectural win.

7. **Define interaction behavior**
The universal lane should be:
- independent of `hideNamedNotes`
- independent of `namedNoteOpacity`
- controlled only by `showAllNoteNames`
- covered by visible played overlays and NamedNotes

Recommended rule:
- it is always present in DOM
- hidden by default with CSS
- shown when `showAllNoteNames` is true

That avoids repeated DOM mutation and keeps repaint logic simpler.

8. **Testing plan**
Given the repo’s Jest environment is `node` in jest.config.js, browser-level DOM tests are limited. The implementation should still add focused regression coverage where possible.

Suggested tests:
- builder-level assertions in a new or existing test file for `NoteTableController` helpers:
  - universal lane markup exists
  - it uses the same internal text layout shape as `namedNote`
  - it has a distinct outer class
- state-level tests around display options plumbing:
  - `showAllNoteNames` still round-trips through display options
- manual browser verification for:
  - standard fretboard
  - PianoSkeuomorphic
  - natural fret widths
  - hide/show NamedNotes independent from universal lane
  - single/tiny/Fingering covering the universal lane
  - theme changes preserving contrast

If broader DOM tests are wanted, that would likely require a separate test harness or switching specific tests to a DOM-capable environment.

**Files Likely To Change**
- NoteTableController.js
  - add universal lane markup
  - factor shared named-note layout builder
  - keep real NamedNote replay and transient logic isolated
- infinite-neck.js
  - replace current showAllNoteNames color hack with visibility toggle/state hook
- infinite-neck.css
  - add universal lane styles and explicit layer ordering
- piano-skeuomorphic.css
  - only if piano-specific layer tuning is needed
- themeFunctions.js
  - emit dedicated universal lane contrast variables
- themes.js
  - define theme defaults for those contrast variables
- tests under jest

**Recommended Sequence**
1. Refactor `NoteTableController` markup builder to support a second note-name lane.
2. Add CSS and z-index rules for the new lane.
3. Swap `showAllNoteNames` from text-color mutation to lane visibility.
4. Add theme contrast variables and defaults.
5. Verify visually on standard tunings and PianoSkeuomorphic.
6. Add targeted regression tests for markup and display-option behavior.

**Key Risks**
- Class-name collisions with existing `.namedNote` reset/transient logic.
- Unexpected stacking behavior if z-index remains partly implicit.
- Theme drift if contrast colors are not defined for all themes.
- Piano-specific overlap quirks if the new lane is placed outside `NoteDisplay`.

**Risk Mitigations**
- Use a unique outer class for the universal lane.
- Normalize all relevant overlay z-indexes explicitly.
- Provide theme defaults centrally in theme generation.
- Keep the lane inside `NoteDisplay` so it inherits current geometry.

**Acceptance Criteria**
- Enabling Show All Note Names reveals a stable per-cell text lane.
- The lane matches NamedNote layout, including MIDI/functions/subscripts.
- Real `namedNote`, `singleNote`, `tinyNote`, and `Fingering` visibly cover the universal lane when present.
- `hideNamedNotes` does not affect the universal lane.
- PianoSkeuomorphic works without computed-color hacks.
- Theme changes affect lane contrast via theme variables, not DOM introspection.
- No changes to persisted song structure are required.

If you want, I can turn this into a sprint-style implementation checklist next, broken into concrete edit steps per file.