# FillPlugin Design Notes

## Iteration1

### Summary

The proposed FillPlugin is viable within the current plugin system.

The strongest design direction for Iteration 1 is:

- keep FillPlugin as a self-contained plugin module, like ArpeggioPlugin and TransposePlugin
- avoid calling `fillChord()` directly, because it is a DOM-scraping UI adapter
- avoid coupling the first plugin version too tightly to `fillChord2()` and `doFill()`, because those helpers are currently specialized to the existing Fill page behavior and named-note model path
- allow small core helper additions where they improve model safety or owner-based cleanup, but keep the main fill logic plugin-owned

In short: parallel code paths are reasonable here, but they should share low-level model primitives where that improves correctness.

### What The Current Codebase Suggests

The current code points to a fairly clean separation:

- `fillChord()` is not a good reuse target for a plugin. It reads DOM widgets and translates UI state into model changes.
- `fillChord2()` is closer to reusable logic, but it still assumes DOM-selected note collections and the current Fill page's sequencing of root/chord/scale behavior.
- `doFill()` is currently a named-note helper, not a general fill engine. It writes only `namedNotes` and does not express owner semantics, note-type scoping, min/max row filtering, or single-note insertion.
- `ArpeggioPlugin` demonstrates the better architectural pattern for plugin work in this repo: keep plugin behavior inside the plugin, write real model notes, and request UI refresh through the established app/runtime path.

That means the current Fill page code is useful as a behavior reference, but not yet a stable plugin API.

### Recommended Iteration 1 Scope

The safest first implementation scope looks like this:

1. Named-note fill only.
2. One explicit target table.
3. Explicit `minFret`, `maxFret`, `minRow`, and `maxRow` properties.
4. Explicit note color selection from a limited initial set.
5. Owner tagging with `owner: "FillPlugin"` on notes created by the plugin.
6. `Apply`, `Clear`, `ClearSong`, `Commit Notes`, and `help` actions.
7. No chord-name or mode-name deep menu flow yet.
8. No attempt to unify plugin behavior with the existing Fill page in Iteration 1.

This gives a useful first version without forcing early answers to the harder cross-type and menu-taxonomy questions.

### Why Named Notes First

Named notes already have a dedicated persistence shape in the model:

- `section.sectionNotesByTable[tableID].namedNotes`

That makes Iteration 1 relatively straightforward.

Single-note fill is materially different because it does not live in that same map-based structure. It participates in the played-note array model and needs position-specific note objects with fields such as row, col, midinum, styleNum, and colorClass.

So the design should treat these as two separate plugin phases:

- Phase 1: named-note fill
- Phase 2: single-note fill and then broader note-type expansion

Trying to make a single abstraction cover both on day one is likely to blur two different storage and overwrite rules.

### Recommended Internal Design

The plugin should likely compute a fill plan first, then apply it.

That plan can stay private to the plugin for now, but conceptually it should contain:

- target table ID
- target note type
- allowed fret range
- allowed row range
- color strategy
- owner tag
- candidate notes to add
- candidate owned notes to remove

That separation matters because the plugin has unusual lifecycle semantics:

- user may apply repeatedly while refining range and color
- previously plugin-owned notes should often be replaced
- user-authored notes should not be overwritten
- `Commit Notes` changes the future cleanup behavior without changing note positions

This is closer to "reconcile plugin-owned model state" than to a one-shot fill helper.

### Major Design Strengths

The proposal already has several strong points:

- It respects the current plugin architecture rather than trying to make FillPlugin a hidden extension of the Fill page.
- It correctly treats command-line menu actions as model mutations, not DOM effects.
- It uses owner tagging to distinguish provisional plugin-authored notes from user-authored notes.
- It explicitly calls out scope-based cleanup operations: current section vs whole song.
- It preserves the option to back-port useful behavior later if the plugin flow proves better than the existing Fill page flow.

Those are good design instincts for this codebase.

### Main Holes In The Current Proposal

These are the biggest open questions or risk areas.

#### 1. Exact overwrite rules are underspecified

The statement "do not overwrite a User note at that location and Note type" is directionally correct, but the exact conflict matrix still needs definition.

Examples that need a precise rule:

- plugin-owned named note exists, plugin reapplies same note name with a new color
- user-authored named note exists, plugin wants same note name
- plugin-owned single note exists at row/col, user-authored single note exists at same row/col with different color
- plugin-owned named note exists and user later edits it manually; does that convert it into a user note or keep it plugin-owned?

Recommendation:

- define ownership precedence explicitly per note family
- define whether manual edits remove or preserve `owner: "FillPlugin"`
- define replacement keys precisely

For named notes, the natural replacement key is likely:

- `tableID + noteName`

For single notes, the natural replacement key is likely:

- `tableID + row + col + styleNum`

#### 2. `Commit Notes` is conceptually good but needs a hard rule

The action is useful, but its exact semantics need to be stated as a contract:

- Does it remove only `owner`?
- Does it also freeze other FillPlugin metadata if more fields are later added?
- Is it whole-song only, or should there also be a current-section commit?

Recommendation:

- for Iteration 1, define `Commit Notes` as: remove `owner: "FillPlugin"` from all FillPlugin-authored notes in the whole song and leave every other field unchanged

That is simple, testable, and matches the current proposal.

#### 3. Auto-clear on Apply may surprise users

The current proposal suggests that changing range settings should cause Apply to clear prior plugin-owned notes for the current note type before reapplying.

That is reasonable for provisional editing, but it needs a tighter rule.

Without a crisp scope, users may see unexpected deletion when they:

- change table
- change note type
- change only color
- change root/chord/mode source later

Recommendation:

- make Apply reconcile only FillPlugin-owned notes that match the same target table and note family in the chosen scope
- do not implicitly clear user-authored notes
- do not implicitly clear different note families

That produces a stable mental model: Apply replaces this plugin's owned output for this category, not everything nearby.

#### 4. `noteAutomatic` needs an explicit persistence rule

The design correctly identifies `noteAutomatic` as special.

The open question is whether FillPlugin should:

- persist the literal class `noteAutomatic`, or
- resolve it immediately to the current AutoColor-derived class and persist the resolved class

Recommendation:

- decide this before implementation begins
- prefer one explicit rule per note family

My recommendation for Iteration 1 is:

- if `noteAutomatic` is offered, resolve it at apply time to a concrete persisted color class

Reason:

- plugin-owned persisted notes should be deterministic across reloads
- later palette/theme changes should not silently mutate old persisted fill results unless the product explicitly wants that behavior

#### 5. Target table selection needs to be explicit, not inferred from current UI visibility

The Fill page can lean on page state more easily than a plugin can.

Recommendation:

- add a real plugin property for target table selection
- do not rely on whatever table happens to be visually front-most in the UI

This keeps plugin behavior reproducible in headless tests and in non-obvious UI states.

#### 6. Chord and mode string menus are correctly out of scope

This is the right call for Iteration 1.

The current unresolved areas are real:

- canonical naming alignment with `Song.chartChord` and `Song.chartMode`
- hierarchical browsing of tonal categories
- mapping current Fill page labels to canonical Tonal values

Recommendation:

- do not partially implement this in the first iteration
- keep Iteration 1 focused on the fill engine and ownership semantics

### Likely Core-Class Touches

The design can stay mostly plugin-local, but a few core touch points are likely worthwhile.

#### Probably required

- `plugins/registerPlugins.js`
  - register the new plugin
- `plugins/fill/FillPlugin.js`
  - plugin implementation
- `plugins/fill/properties.json`
  - menu-visible property definitions
- focused Jest tests for FillPlugin behavior

#### Likely beneficial small core helpers

- `SectionNotesPersistence.js` or adjacent model helpers
  - helper methods for enumerating, removing, or committing owned notes cleanly
- possibly `Section.js` or `Song.js`
  - scoped traversal helpers for current-section and whole-song owner cleanup

These helpers would be justified if they keep owner-based mutation logic out of the controller layer and make the plugin logic easier to test headlessly.

#### Likely not required for Iteration 1

- `PluginManager.js`
  - current plugin architecture already appears sufficient
- `PluginProperty.js`
  - existing property types should cover the first iteration
- `Note.js`
  - `Note` currently accepts arbitrary fields via `Object.assign`, so `owner` fits mechanically without requiring schema changes in the class itself

### Likely Core Areas To Avoid Touching Early

These look like poor first-iteration refactor targets:

- `fillChord()`
- broad rewrites of `fillChord2()`
- deep refactors shared with ArpeggioPlugin
- generalized note-type abstraction layers for every note family at once

Those changes would create a lot of churn before the FillPlugin rules are settled.

### Recommended Implementation Shape For A Later Coding Iteration

When implementation begins, the most maintainable path looks like:

1. Build FillPlugin as a stand-alone plugin directory with metadata-backed properties.
2. Start with named-note fill only.
3. Add owner-tagged apply/clear/clearSong/commit semantics.
4. Keep all first-pass fill computation inside the plugin.
5. Add only small model helpers if owner-based cleanup becomes repetitive or error-prone.
6. Revisit whether a shared non-DOM fill helper is worth extracting only after the plugin behavior stabilizes.

This sequence keeps the first version small, testable, and aligned with the repo's current plugin direction.

### Concrete Recommendations

My recommendations for Iteration 1 are:

1. Approve FillPlugin as a parallel plugin path rather than a wrapper around the existing Fill page.
2. Limit the first version to named notes.
3. Make target table, range limits, color, and owner behavior explicit plugin properties.
4. Define Apply as a reconciliation of FillPlugin-owned output for the same target table and note family.
5. Define `Commit Notes` as removal of the `owner` field only, whole-song, leaving note data intact.
6. Do not implement chord-name or mode-name deep menus yet.
7. Delay broad shared-helper refactors until the plugin behavior proves stable.

### Open Questions For Iteration 2

These are the questions I would want answered next:

1. What is the exact replacement key for each note family?
2. Does a manual user edit on a FillPlugin-owned note preserve or remove ownership?
3. Should `Commit Notes` also exist in a current-section variant?
4. Should `noteAutomatic` persist as a literal token or as a resolved color class?
5. Should target table selection allow only visible primary tables, or also listener/observer-related tables?
6. For the first shipped version, is the fill source strictly root/chord/scale derived from the current Section, or do you want an explicit note-name list input as an earlier shortcut?

## Iteration 2

### Summary

With the new clarification, the correct first implementation target is not named notes but `SingleNote`.

That materially changes the shape of the recommended first sprint.

The best Iteration 2 direction now looks like this:

- FillPlugin should target `SingleNote` only
- all other note types should be deferred to later, separate sprints
- the plugin should create persisted played-note entries with `styleNum = Note.STYLENUM_SINGLE`
- a cell should be treated as owned by at most one SingleNote for FillPlugin purposes
- if a SingleNote already exists at a target cell, FillPlugin should not place another one there
- `Commit Notes` should remove only `owner: "FillPlugin"` across the whole song and leave every other field unchanged
- Apply should reconcile only FillPlugin-owned notes for the same target table and same note family
- if `noteAutomatic` is offered, it should resolve immediately to a concrete persisted color class
- target table selection should be an explicit early `org.dynamide.Select` property whose default follows the ArpeggioPlugin rule

This is a cleaner first feature than named-note fill because it directly addresses the practical gap you described: range-limited, string-limited note placement that behaves more like guided fingering output than like the existing Fill page's all-positions named-note overlay.

### What The Current Codebase Suggests

Under the new goal, the current codebase suggests a different emphasis than in Iteration 1.

- The existing Fill page is still mainly a behavior reference, not an implementation substrate.
- The important model target is now `playedNotes`, not `namedNotes`.
- SingleNote placement is inherently positional. The meaningful identity is the cell, not just the note name.
- The browser behavior and the current replay path both suggest that a SingleNote effectively claims a cell, even if the deeper model could theoretically hold conflicting data.

That means the first FillPlugin implementation should think in terms of:

- candidate cells
- whether a cell is already occupied by a SingleNote
- whether that occupying note is plugin-owned or not
- whether the current Apply should leave it alone, replace it, or skip it

This is a better fit for a position-based reconciliation pass than for any map-based fill helper.

### Recommended Iteration 2 Scope

The safest and most useful Iteration 2 implementation scope looks like this:

1. SingleNote fill only.
2. One explicit target table.
3. Explicit `minFret`, `maxFret`, `minRow`, and `maxRow` properties.
4. Explicit note color selection from a limited initial set, including a resolved-at-apply-time `noteAutomatic` option if offered.
5. Owner tagging with `owner: "FillPlugin"` on notes created by the plugin.
6. `Apply`, `Clear`, `ClearSong`, `Commit Notes`, and `help` actions.
7. No deeper chord/mode input flow in this sprint.
8. No attempt to solve other note families in the same implementation.

That scope matches the clarified user value: create reusable, persisted, range-constrained SingleNotes without pulling in the broader note-type matrix too early.

### Why SingleNote First

Your refinement makes the product goal clearer.

Named notes remain useful for showing all available pitch locations, but that is not the real gap the plugin is trying to fill.

The real gap is:

- placing concrete playable note choices
- constrained by fret range and string range
- in a way that persists as actual note content rather than transient instructional overlay

That is exactly what SingleNotes are better suited for.

This choice also aligns with your product distinction:

- ArpeggioPlugin remains transient and practice-oriented
- FillPlugin becomes the persistent, range-aware note-placement tool

That separation is easier for both users and implementers to understand.

### Recommended Internal Design

The plugin should still compute a fill plan first, then apply it.

For the SingleNote-first version, that plan should be explicitly position-based and should contain:

- target table ID
- note family: `SingleNote`
- allowed fret range
- allowed row range
- color strategy
- owner tag
- candidate source notes to materialize
- target cells to add
- owned cells to remove within the reconciliation scope
- occupied cells to skip because they already contain a SingleNote

This separation matters because the lifecycle is still reconciliation-oriented:

- users will apply repeatedly while refining ranges and colors
- old FillPlugin-owned SingleNotes should often be removed and replaced
- user-authored SingleNotes should not be overwritten
- `Commit Notes` should permanently remove those notes from future FillPlugin cleanup

The plugin therefore behaves less like "fill these notes once" and more like "synchronize the plugin-owned SingleNote layer for this scope".

### Major Design Strengths

The refined proposal has several strong points.

- It picks one note family and fully commits to it, which sharply reduces ambiguity.
- It targets the user-facing gap that the current Fill page does not handle well.
- It adopts a realistic cell-ownership mental model for SingleNotes.
- It keeps plugin-created notes persistent and therefore genuinely useful for later playback and editing.
- It accepts a simple and testable `Commit Notes` contract.
- It keeps target table selection explicit, which is important for reproducibility.

These choices make the first implementation more coherent than the earlier multi-note-type concept.

### Main Holes And Risk Areas In The Refined Proposal

The refinement resolves several questions, but a few important implementation details still need tight wording.

#### 1. Exact occupancy detection still needs to be made concrete

The design direction is now clearly "if a SingleNote exists at that cell, do not fill it".

That is the correct default, but it still needs a precise runtime rule:

- what exact note shapes count as a SingleNote occupant
- whether only `styleNum = Note.STYLENUM_SINGLE` blocks placement, or whether other played-note styles at the same cell should also block placement
- whether a malformed or partial note object should be ignored or treated as occupying the cell

My recommendation is:

- in Iteration 2, block placement only when a note at the same `row + col` exists with `styleNum = Note.STYLENUM_SINGLE`

That keeps the rule simple and aligned with the product statement that SingleNote should own a cell.

#### 2. Manual recolor semantics should remain intentionally loose

You clarified that a manual recolor of a FillPlugin-owned note may either:

- strip ownership, or
- keep ownership and leave the note subject to later plugin deletion

And you prefer not to burden core click/edit code with plugin-specific ownership logic.

I agree with that tradeoff for this sprint.

Recommendation:

- do not add NoteTableController-level ownership mutation rules in Iteration 2
- allow manual recolor to remain semantically outside FillPlugin guarantees
- document that plugin-owned notes edited through generic UI paths may still be removed by later FillPlugin Apply or Clear operations

This is consistent with other existing caveat-emptor paths in listeners and observers.

#### 3. Auto-clear should stay tightly scoped

I still recommend the tighter rule you accepted:

- Apply should reconcile only FillPlugin-owned notes that match the same target table and note family in the chosen scope
- it should not clear user-authored notes
- it should not clear different note families

With SingleNotes, this is even more important because positional note loss is more visible to users than named-note replacement.

That makes the mental model:

- Apply replaces FillPlugin's current SingleNote output for this table and scope
- everything else is left alone

#### 4. `noteAutomatic` should resolve at apply time

I agree with your acceptance here.

For SingleNotes, resolving `noteAutomatic` immediately to a concrete color class is the right rule because it matches current click behavior and keeps persisted notes deterministic.

Recommendation:

- if FillPlugin exposes `noteAutomatic`, convert it to the concrete class before writing the note object into `playedNotes`

#### 5. Target table selection should be explicit and early

Your accepted rule is the right one.

Recommendation:

- provide a visible `org.dynamide.Select` property near the top of the plugin menu
- default it using the same rule as ArpeggioPlugin: first table in `myTunings` that is not wired
- populate selectable options from tables that satisfy that same primary-table rule

This keeps FillPlugin predictable and avoids hidden dependence on UI visibility state.

### Likely Core-Class Touches

The refined SingleNote-first design still looks mostly plugin-local, but the likely useful core touches have changed somewhat.

#### Probably required

- `plugins/registerPlugins.js`
  - register FillPlugin
- `plugins/fill/FillPlugin.js`
  - plugin implementation
- `plugins/fill/properties.json`
  - menu-visible property definitions
- focused Jest tests for FillPlugin behavior

#### Likely beneficial small core helpers

- `SectionNotesPersistence.js` or `SectionNotes.js`
  - helper methods for scanning, removing, and committing plugin-owned `playedNotes`
- possibly `Song.js` or `Section.js`
  - traversal helpers for current-section and whole-song owner cleanup

These are more likely to be helpful now than in the named-note version, because SingleNote cleanup is array-based and position-based rather than map-based.

The useful helper shape is likely around:

- iterate owned played notes
- remove owned played notes by predicate
- clear `owner` on played notes by predicate

That would keep owner-based mutation logic headless and testable.

#### Likely not required for Iteration 2

- `PluginManager.js`
  - current plugin architecture still appears sufficient
- `PluginProperty.js`
  - current property types should support this scope
- `Note.js`
  - `owner` still fits mechanically through `Object.assign`
- `NoteTableController.js`
  - I do not recommend adding plugin-specific click/edit ownership behavior in this sprint

### Likely Core Areas To Avoid Touching Early

These still look like poor early refactor targets:

- existing Fill page functions
- cross-plugin refactors shared with ArpeggioPlugin
- generalized abstractions for all note families
- controller-side ownership edits during generic note recolor operations

The refined scope is strong precisely because it avoids these broad changes.

### Recommended Implementation Shape For A Later Coding Iteration

When implementation begins, the most maintainable path now looks like:

1. Build FillPlugin as a stand-alone plugin directory with metadata-backed properties.
2. Implement SingleNote fill only.
3. Resolve the target table explicitly from a plugin property, using the Arpeggio-style default rule.
4. Compute candidate cells within `minFret/maxFret` and `minRow/maxRow`.
5. Before placement, skip any cell already occupied by an existing SingleNote.
6. On Apply, clear only FillPlugin-owned SingleNotes in the same target table and scope, then write the new set.
7. Implement `Commit Notes` as whole-song removal of `owner` only.
8. Leave manual recolor semantics outside the plugin contract for this sprint.

This is the smallest plan that still delivers the intended product value.

### Concrete Recommendations

My recommendations for Iteration 2 are:

1. Approve SingleNote as the only note family for the coming implementation.
2. Treat all other note families as later, separate sprints.
3. Treat SingleNote occupancy as cell-based: if a SingleNote already exists at the cell, FillPlugin should not place another one there.
4. Make target table, range limits, color, and owner behavior explicit plugin properties.
5. Define Apply as reconciliation of FillPlugin-owned SingleNotes for the same target table and scope.
6. Define `Commit Notes` as whole-song removal of `owner` only, leaving every other note field unchanged.
7. If `noteAutomatic` is offered, resolve it immediately to a concrete persisted color class.
8. Do not add controller-level ownership-stripping rules for manual recolor in this sprint.

### Open Questions For The Next Iteration

These are the questions I would want answered next before implementation starts:

1. What is the exact fill source for the first SingleNote version: section root/chord/scale data, currently highlighted notes, or another explicitly defined source?
2. Within Apply, is the cleanup scope strictly current section, with `ClearSong` as the only whole-song destructive action, or do you also want any whole-song apply modes later?
3. Should cells occupied by non-SingleNote played-note styles also block FillPlugin placement, or should the block rule remain SingleNote-only?
4. For the target-table select property, should the selectable list exclude all wired tables entirely, or should the default exclude them while a later advanced mode can expose them?

## Iteration 3

### Summary

The proposed role/color approach is feasible, and the simpler command-menu approach is the right one for this sprint.

My Iteration 3 recommendation is:

- extract the current Fill page's hard-coded chord and scale option data into `Constants.js`
- keep the existing Fill page behavior unchanged for now, but make `Constants.js` the new source of truth
- give FillPlugin three separate role-color controls for `root`, `chord`, and `scale`
- support two choices per role in the first version:
  - the canonical Fill role color for that role
  - the palette's current last-restorable color
- when the user selects the `last` option, resolve that to the current palette value immediately and store the concrete color class in the plugin property
- do not try to jump users into the `/pr` subtree and return a selected value into FillPlugin in this sprint

The command-menu flow you outlined is operationally clean and fits the current menu system better than any dynamic submenu handoff.

### Constants.js Extraction

This part is straightforward and low risk.

The current Fill page still hard-codes chord and scale option values in the page markup, while `NoteTableController.fillChord()` reads them through `#dropDownChords` and `#dropDownScales`.

Your proposal to move those value sets into `Constants.js` is sound for three reasons:

- it creates a single internal source of truth before the later Tonal.js alignment work
- it reduces the chance that FillPlugin and the Fill page drift apart in the interim
- it gives the later migration to dynamic option generation a clear transition point

My recommendation is:

- add exported constants in `Constants.js` for the current chord and scale option sets
- make those constants match the current `dropDownChords` and `dropDownScales` values exactly for now
- leave the existing page behavior unchanged in this sprint, except for reading from those constants if you choose to wire that in now

This is a small, useful core change.

### FillPlugin Role/Color Model

The three-role model is coherent and matches the current Fill semantics.

The plugin should treat these as three independent properties:

- root color choice
- chord color choice
- scale color choice

Conceptually, each role has two first-pass source choices:

- the canonical role color for that role
- the current palette "last restorable" color

So the FillPlugin mental model becomes:

- `root` can be `noteRoot` or whatever the palette currently remembers
- `chord` can be `noteChord` or whatever the palette currently remembers
- `scale` can be `noteScale` or whatever the palette currently remembers

This is simple for users and does not require FillPlugin to absorb the whole palette menu model.

### PalettePresentation Feasibility

This part also looks feasible with only a small cleanup.

`PalettePresentation` already maintains:

- `gPresentation.palette.lastRestorableColor`
- default initialization to `noteTransparent`
- a restore button that reflects the remembered choice

So the state you want already exists.

What is missing is not functionality but a clean access API.

Right now, other code could reach into `gPresentation.palette.lastRestorableColor`, but that would be a brittle dependency.

My recommendation is:

- add a small public getter to `PalettePresentation`

Something like:

- `PalettePresentation.getLastRestorableRbColor()` returning `{ id, value, caption }`
- or at minimum `PalettePresentation.getLastRestorableRbColorValue()`

That is the smallest clean core change here.

I also checked the initialization path, and the current default behavior already falls back to `noteTransparent` if nothing else has been remembered, which matches your desired startup behavior.

### Feasibility Of The Simple Command-Menu Approach

This is the most feasible approach with the current menu system.

The current command system is:

- tree-based
- trigger-driven
- stack-based for entering and exiting menus
- action-oriented rather than continuation-oriented

That fits your proposed explicit sequence very well:

```text
/prr
/fpfrl
/prc1
/fpfcl
/prs
/fpfsl
```

This approach has several advantages:

- it uses existing stable menu semantics
- it avoids hidden state handoff between unrelated menu subtrees
- it is script-friendly
- it is easy to explain and easy to test
- it preserves long-term command stability, which matters if menu scripting is a future goal

From an engineering perspective, this is the lowest-complexity path and the most aligned with the current command architecture.

So on the direct question: yes, this simple command-menu approach is fully feasible and is the better choice for this sprint.

### Feasibility Of Dynamically Dropping Into `/pr`

This is possible in theory, but awkward in the current architecture.

The problem is not merely displaying another subtree. The real problem is returning with a selected value and applying it to the right FillPlugin role property without introducing fragile cross-menu state.

The current command menu system supports:

- entering a child menu
- executing an action
- optionally popping one or two menu levels with `popOnBang`

What it does not naturally support is:

- enter some other menu subtree temporarily
- remember who asked for the value
- let the foreign submenu run as usual
- capture the selected result as a value rather than as a normal action side effect
- restore the original menu context and write the chosen result into a specific plugin property

That is a continuation problem, and the current menu code is not built around continuations.

### What Dynamic Submenu Handoff Would Require

To make a `/pr` handoff elegant, you would probably need at least one of these:

- a temporary "chooser mode" in the command engine
- a callback/continuation object stored alongside the menu stack
- a new action type meaning "choose a value from another subtree and return it here"
- dynamic subtree cloning plus custom return-value plumbing

Any of those can be built, but each is more invasive than it first appears because it touches:

- menu navigation semantics
- action dispatch semantics
- result propagation
- UI breadcrumbs and pop behavior

That is medium-to-high complexity relative to the value delivered.

For this plugin sprint, I do not think that investment is justified.

### A More Elegant Alternative Than Submenu Handoff

There is a simpler elegant solution that stays entirely within FillPlugin.

Instead of trying to enter `/pr`, FillPlugin can expose explicit role submenus of its own and map those choices directly.

For example:

- `root`
  - `role` meaning `noteRoot`
  - `last` meaning current palette last-restorable value
- `chord`
  - `role` meaning `noteChord`
  - `last` meaning current palette last-restorable value
- `scale`
  - `role` meaning `noteScale`
  - `last` meaning current palette last-restorable value

This can be implemented in one of two ways.

#### Option A: store symbolic choices

The plugin property stores one of:

- `role`
- `last`

Then `Apply` resolves that into a concrete class before writing notes.

This is simple, but has one downside:

- the FillPlugin menu caption does not directly show the final resolved current class unless extra resolver work is added

#### Option B: resolve immediately when the menu item is chosen

The plugin menu presents `role` and `last`, but selecting `last` immediately asks `PalettePresentation` for the current remembered value and stores that concrete value in the plugin property.

This is the cleaner option for the current app because:

- it matches your accepted rule that persisted note colors should be concrete
- it makes the plugin property caption immediately truthful
- it avoids future ambiguity if the palette later changes before Apply

I recommend Option B.

### Menu-Caption Practicalities

One small implementation detail matters here.

The current `PluginProperty` select helper builds child option captions statically, while menu captions in general can interpolate dynamic `$vars` through the resolver.

That means:

- the parent FillPlugin property caption can easily show the currently stored value
- a child option caption like `last: noteTransparent` is not available automatically from plain `properties.json` alone unless the child node is custom-built or the helper is extended

This is not a blocker.

You have two reasonable options:

1. Keep the child caption simple as just `last`, and let the parent property caption show the resolved current value.
2. Build these three role menus as custom `MenuItemProxy` nodes instead of plain metadata-only select properties, so the `last` child caption can include a live `$token`.

I would lean toward option 1 for the first implementation unless you feel strongly that the child caption must display the exact current remembered value.

If you do want the child caption to say `last: noteTransparent`, then a custom menu node is still feasible and localized. That is much cheaper than implementing dynamic submenu handoff.

### Recommended Iteration 3 Design

My recommended design for this iteration is:

1. Extract current Fill page chord and scale option data into `Constants.js` unchanged.
2. Add a small getter API to `PalettePresentation` for the last restorable color value and caption.
3. Give FillPlugin three separate role-color controls: `root`, `chord`, and `scale`.
4. For each role, offer two first-pass actions: canonical role color or current palette last-restorable color.
5. When `last` is chosen, resolve and store the concrete palette value immediately.
6. Do not attempt cross-subtree `/pr` handoff in this sprint.
7. Prefer the explicit command sequence model because it is simpler, more stable, and better suited to future scripting.

### Bottom Line

The simple command-menu approach is clearly feasible and is the right engineering choice for now.

Dynamic submenu dropping into `/pr` is possible, but it would introduce a new class of command-menu state management that the current system is not designed for.

So my recommendation is:

- keep `/pr` as its own menu
- let users set the palette state there when they want
- let FillPlugin read the remembered palette value through a small `PalettePresentation` getter
- expose FillPlugin's own `root/chord/scale` menu choices directly rather than trying to reuse `/pr` interactively

## Iteration 6 : *Bury* design discussion

### Summary

The proposed *Bury* feature is viable and fits the current plugin architecture better than inventing a separate plugin-config store.

The strongest design direction is:

- keep `Song.plugins` as the authoritative live plugin state
- treat Graveyard `PLUGIN` records as JSON snapshots of one plugin's persisted song state
- make revive import that JSON back into the plugin manager through a narrow plugin-specific restore path, rather than treating plugin revive as a generic object resurrection
- standardize the plugin menus now, because that is low-risk and improves consistency regardless of the final Graveyard workflow

In short: the product idea is strong, but the safest implementation is not "plugins are just another deleted object." The safer model is "Graveyard stores plugin-state snapshots, and revive imports one snapshot back into the manager."

### What The Current Codebase Suggests

The current codebase already gives you two important building blocks.

- live plugin user state is already persisted under `Song.plugins`
- Graveyard records already persist JSON snapshots with `type`, `context`, `json`, and `lastRevived`

That is good news, because it means *Bury* does not need a second persistence model.

However, the current Graveyard implementation also makes the main risk clear:

- `Graveyard.raise()` is a switch over concrete record types
- revive is not passive data access; it mutates the song, emits UI events, and requests repaint work
- Graveyard keeps a live back-reference to its owning song

That means plugin revive should not be implemented by loosely shoving plugin JSON through the current generic raise logic and hoping the plugin manager notices. That would be brittle.

### Why The Core Idea Is Good

The product goal is sound.

- users already understand the Graveyard as a place for recoverable things
- plugin configurations are natural candidates for snapshot-and-revive workflows
- user-supplied names make plugin state much more reusable than the current one-state-per-song model
- using the song's Graveyard gives you a lightweight way to move plugin setups between songs through existing save/load flows

This is especially strong for plugins such as Transpose, Arpeggio, and Fill, where users will likely want to flip between a few stable practice configurations rather than edit many individual properties every time.

### Recommended Mental Model

I recommend treating *Bury* as "save this plugin's current song-persisted state under a named Graveyard snapshot" rather than as deletion in the ordinary object-model sense.

That means:

- live plugin state remains in `Song.plugins[pluginId]`
- bury copies that state into a Graveyard record of type `PLUGIN`
- reset-to-default happens after the snapshot is stored
- revive loads the stored state into the plugin manager, replacing the live state for that plugin

This distinction matters because Sections and Stylesheets are raised as objects. Plugins are different: the runtime owner of plugin state is the plugin manager, not the Graveyard.

### Recommended Graveyard Record Shape

The current Graveyard structure is sufficient if the `context` and `json` payload are made explicit.

I recommend:

- `type: GraveType.PLUGIN`
- `context.pluginId`
- `context.userKey`
- `context.caption` or `context.displayName`
- `context.schemaVersion`
- `json` containing exactly the same JSON shape as one entry under `Song.plugins[pluginId]`

So the buried JSON payload should look like the existing plugin persistence shape, for example:

```json
{
  "enabled": false,
  "enableOnSongLoad": true,
  "properties": {
    "transposeIntervals": [2, 2, 1, 2, 2, 2, 1],
    "doLeadKey": true
  }
}
```

I do not recommend storing live menu nodes, plugin metadata, or any schema copied from `properties.json`. The plugin code should remain the source of truth for schema and defaults.

### Feasibility Of The Menu Changes

The menu standardization part is low risk and should be considered independently feasible.

- standardizing `E) Enable` and `L) Load enabled` is straightforward
- adding `B) Bury` to each plugin is also straightforward
- adding `B) Bury all` at the plugins root is conceptually clean
- showing a checkmark on enabled plugins is feasible because plugin menu captions are already generated dynamically by the manager

This is the easy part of the design.

The only caution is trigger allocation.

Because `B` becomes globally meaningful in plugin menus, each plugin's own action list should avoid collisions and preserve a predictable action order. That argues for the manager owning these shared top-level plugin actions rather than each plugin hand-authoring them.

### Main Design Holes And Risks

These are the main issues I would tighten before implementation.

#### 1. Revive semantics need a hard overwrite contract

The most important open question is what exactly happens when reviving onto a plugin that already has live non-default state.

Your current proposal says:

- first auto-bury current state as `USER`
- then revive the chosen state

That is reasonable, but it needs one exact rule:

- if `USER` already exists, does auto-bury overwrite it every time, or preserve the older `USER` and mint another key?

My recommendation is:

- auto-bury to `USER`, overwriting the prior `USER`

Reason:

- `USER` then means "the state that was live immediately before the last revive/import"
- this keeps the rule simple and predictable
- users who want durable named variants can explicitly bury with a custom key

#### 2. Bury should define what counts as "non-default"

`B) Bury all` depends on a precise definition of whether a plugin has meaningful state.

You already have a good conceptual rule available from current plugin persistence:

- if a plugin would be persisted in `Song.plugins`, then it is meaningful enough to bury

I recommend reusing that exact notion rather than inventing a second test.

So:

- `Bury all` should operate on the same set of plugin entries that song persistence would export

That avoids divergence between "persists in song" and "eligible for burial."

#### 3. Revive should restore only persisted user state, not plugin code/schema

This is a key architectural boundary.

Do not treat a buried plugin record as a full plugin definition. It should restore only:

- `enabled`
- `enableOnSongLoad`
- persisted `properties`

It should not restore:

- menu trigger
- help text
- event names
- property schema
- plugin class identity beyond `pluginId`

Those belong in code, not in buried data.

This keeps schema evolution manageable when plugin properties change later.

#### 4. Graveyard context should not become an ad hoc hierarchy store

The idea of `Graveyard > "transpose" > "USER"` is good as a user mental model, but I would not literally force the Graveyard to become a tree data structure for this iteration.

The current Graveyard is an append-only flat record list with context metadata.

Recommendation:

- keep the Graveyard flat
- encode hierarchy in `context.pluginId` and `context.userKey`
- let the Graveyard table filter, sort, or display those fields later if needed

That is much cheaper than redesigning the Graveyard storage model up front.

#### 5. User-supplied keys need normalization rules, not just stripping

The proposal says illegal characters should be stripped. That is acceptable, but stripping alone can create collisions that are surprising.

Examples:

- `A/B` and `AB` collapse to the same normalized key
- repeated spaces may create visually different but logically similar names

Recommendation:

- trim leading and trailing spaces
- collapse internal whitespace to a single space
- remove disallowed characters
- if the result is empty, use `USER`
- keep comparisons case-sensitive unless you explicitly want deduplication across case

That gives stable visible names while staying simple.

#### 6. Generic Graveyard `raise()` is likely the wrong long-term restore hook

Today `raise()` directly knows how to recreate supported record types. Plugins are different because applying plugin state should probably go through the plugin manager, which already knows how to:

- reset plugins to defaults
- load song plugin state
- enable or disable handlers safely

So I recommend a plugin-specific restore path inside `Graveyard.raise()` or a small delegated helper, not a broad attempt to make Graveyard itself understand plugin runtime internals.

Conceptually:

1. parse the buried plugin JSON
2. identify `pluginId`
3. ask the plugin manager to import that one plugin state
4. refresh UI and mark record as revived

That is much safer than mutating `song.plugins` directly and hoping runtime state stays synchronized.

### Complexity Concerns

The main complexity is not storage. The main complexity is state transition.

You are crossing three layers:

- persisted song JSON
- live plugin manager state
- Graveyard UI and revive workflow

That means the risky cases are:

- bury while plugin is enabled and actively handling events
- revive while a different config is already enabled
- revive a config for a plugin that has changed schema since the record was buried
- bury all while multiple plugins are enabled and have side effects on the current song state

None of these are blockers, but they argue for a narrow first implementation.

### Recommended Simplifications

These simplifications would preserve the product value while reducing risk.

#### 1. Start with one-plugin-at-a-time bury and revive semantics

Implement `B) Bury` first with a precise overwrite rule.

Then add `B) Bury all` only after the one-plugin flow is proven.

`Bury all` is useful, but it multiplies the edge cases around reset ordering and UI refresh.

#### 2. Keep the Graveyard storage flat in iteration one

Do not redesign the Graveyard into a nested structure.

Use:

- `type`
- `context.pluginId`
- `context.userKey`
- `json`

That is enough to deliver the feature.

#### 3. Use plugin-manager import/export helpers as the only live boundary

The plugin manager should own:

- export one plugin's persisted state
- import one plugin's persisted state
- reset one plugin to defaults

This keeps Graveyard dumb and reduces coupling.

#### 4. Prefer overwrite-on-same-key over version stacks for now

Your proposal already leans this way, and I agree.

If a user buries `transpose / Bob's I-IV-V Blues Practice` twice, the second should replace the first.

That keeps retrieval simple and matches the mental model of "save over this named preset."

#### 5. Add schema versioning to context now, even if unused at first

A small `schemaVersion` field in plugin Graveyard context is cheap insurance.

Even if revive initially just trusts the payload, version tagging will help later if property names or value formats change.

### Recommended Iteration 6 Direction

My recommendation for this iteration is:

1. Approve *Bury* as a Graveyard-backed snapshot/import feature for plugin state.
2. Keep `Song.plugins` as the authoritative live source of plugin state.
3. Introduce a new Graveyard record type `PLUGIN` whose payload is one plugin's persisted state JSON.
4. Keep the Graveyard storage flat and encode `pluginId` plus user key in record context.
5. Route revive through the plugin manager rather than directly mutating plugin internals.
6. Standardize plugin menu items now: `E) Enable`, `L) Load enabled`, `B) Bury`, `h) help`.
7. Define `USER` as the overwriteable emergency snapshot key used by auto-bury before revive.
8. Use the same "should this persist?" rule for `Bury all` that song persistence already uses.

### Bottom Line

The feature is feasible and worth doing.

The main design trap would be to overgeneralize the Graveyard and make it responsible for plugin runtime behavior. The cleaner boundary is:

- Graveyard stores named plugin-state snapshots
- plugin manager imports and applies them
- plugin code remains the source of truth for behavior and schema

If you keep that boundary, the design stays coherent and the later cross-song reuse story remains open.


