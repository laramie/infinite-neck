# FillPlugin sprint-2 implementation plan

## Scope

Sprint id: sprint-2

Feature name: more-types

This plan implements the sprint-2 design in [FillPlugin-sprint-2-design.md](FillPlugin-sprint-2-design.md), including the Iteration 2 clarifications.

Sprint-1 remains the baseline:

- SingleNote fill in `playedNotes`
- optional overlay TinyNote on top of SingleNote
- one shared role triplet for root/chord/scale

Sprint-2 expands FillPlugin to support three sibling note families:

- NamedNote
- SingleNote
- TinyNote

and preserves the special overlay mode:

- SingleNote -> add TinyNote

## Goals

1. Add sibling `NamedNote`, `SingleNote`, and `TinyNote` configuration groups to FillPlugin.
2. Keep `SingleNote -> add TinyNote` as a separate overlay feature with its existing semantics.
3. Allow all three sibling families to coexist in the same table and same role at the same time.
4. Reuse current fret and string range logic for `SingleNote` and standalone `TinyNote`.
5. Ensure `NamedNote` ignores fret and string range limits.
6. Keep current FillPlugin “keep/none/role” semantics rather than switching to owner-only preservation.
7. Preserve sprint-1 behavior as closely as possible where sprint-2 does not explicitly change it.

## Non-goals

1. No Bend support.
2. No Highlight support.
3. No MovePlugin-style legality restrictions for nut/open-string NamedNotes.
4. No redesign of the general FillPlugin event lifecycle.
5. No persistence migration for legacy file formats beyond the current tolerant behavior already used in FillPlugin.

## Design decisions from Iteration 2

These are treated as fixed inputs for implementation:

1. If standalone TinyNote is active, `SingleNote -> add TinyNote` is ignored at runtime.
2. Best UX is to show disabled/unavailable state in the menu if practical, but runtime ignore is the required behavior.
3. `Copy from SingleNote` copies the full root/chord/scale property set:
	- mode
	- color value
4. `Copy from SingleNote` does not copy the overlay tiny-note option.
5. NamedNote, SingleNote, and TinyNote may all coexist for the same role.
6. FillPlugin continues to use its Keep semantics rather than switching to owner-only protection.
7. NamedNote may appear on nut/open-string positions and does not inherit MovePlugin nut restrictions.

## Current codebase baseline

The current sprint-1 implementation in [plugins/fill/FillPlugin.js](../../../../plugins/fill/FillPlugin.js) has these characteristics:

1. One shared role config:
	- `rootMode/rootColor`
	- `chordMode/chordColor`
	- `scaleMode/scaleColor`
2. One special overlay property:
	- `tinyNotes`
3. One plan builder centered on `playedNotes` output plus optional tiny-note overlay.
4. Range handling that already works well:
	- `minFret/maxFret`
	- `minRow/maxRow`
	- 1-based string display, zero-based row persistence
5. Clear/commit flow designed around FillPlugin replacing or preserving lane content according to Keep semantics.

This means sprint-2 is primarily a refactor-and-expand sprint, not a patch sprint.

## Proposed implementation structure

## 1. Property model refactor

Replace the current single-family property layout with grouped family properties.

### New family groups

Create three sibling family namespaces:

- `named`
- `single`
- `tiny`

Each family gets these role properties:

- root mode
- root color
- chord mode
- chord color
- scale mode
- scale color

### Overlay property

Retain a separate overlay property under SingleNote:

- `singleAddTiny`

This is the sprint-2 replacement for today’s top-level `tinyNotes` property.

### Property naming recommendation

Use explicit prefixed names in `properties.json`, for example:

- `namedRootMode`
- `namedRootColor`
- `namedChordMode`
- `namedChordColor`
- `namedScaleMode`
- `namedScaleColor`
- `singleRootMode`
- `singleRootColor`
- `singleChordMode`
- `singleChordColor`
- `singleScaleMode`
- `singleScaleColor`
- `tinyRootMode`
- `tinyRootColor`
- `tinyChordMode`
- `tinyChordColor`
- `tinyScaleMode`
- `tinyScaleColor`
- `singleAddTiny`

This keeps the implementation explicit and makes persistence/debugging easy.

## 2. Menu refactor

Replace the current flat role rows with three note-family submenus.

### Target hierarchy

- chord formula
- scale formula
- minFret
- maxFret
- upper string limit
- lower string limit
- NamedNote
  - Copy from SingleNote
  - root
  - chord
  - scale
- SingleNote
  - root
  - chord
  - scale
  - add TinyNote
- TinyNote
  - Copy from SingleNote
  - root
  - chord
  - scale

### Menu implementation recommendation

Generalize the existing `buildRoleMenuNode(roleName)` pattern into a family-aware builder such as:

- `buildNoteFamilyMenuNode(familyName)`
- `buildFamilyRoleMenuNode(familyName, roleName)`

This should avoid triplicating menu code.

### Disabled overlay UX

If standalone TinyNote is active, try to present `SingleNote -> add TinyNote` as unavailable.

Recommended approach:

- caption suffix such as `[disabled]`
- still render the node if easy, but ignore at runtime

If the menu system makes disabled rendering awkward, keep the node visible and annotate via caption/help/summary.

## 3. Planning model refactor

Replace the sprint-1 “single note plus optional tiny note” plan shape with a normalized multi-family plan.

### Recommended plan shape

For one apply pass, compute a plan object with explicit family outputs, for example:

- `namedOutput`
- `singleOutput`
- `tinyOutput`
- `singleOverlayTinyOutput`

Each output should be normalized before commit.

Suggested detail:

- `namedOutput`: note-name keyed objects or a normalized set ready to become `namedNotes`
- `singleOutput`: array of `playedNotes` notes with `styleNum = STYLENUM_SINGLE`
- `tinyOutput`: array of `playedNotes` notes with `styleNum = STYLENUM_TINY`
- `singleOverlayTinyOutput`: array of `playedNotes` tiny notes sharing cells with `singleOutput`

Then combine `tinyOutput` and `singleOverlayTinyOutput` carefully into the TinyNote lane according to the sprint-2 rules.

## 4. Family-specific candidate selection rules

### NamedNote

- ignores `minFret/maxFret`
- ignores `minRow/maxRow`
- still respects the tuning’s actual note map
- may appear on nut/open-string cells
- should be resolved by note name, not by played-note lane logic

Implementation recommendation:

- do not route NamedNote through the same cell-filtering function used for SingleNote/TinyNote
- instead compute the selected role note names and write them directly to `namedNotes`

### SingleNote

- uses current sprint-1 candidate filtering unchanged
- uses `minFret/maxFret`
- uses `minRow/maxRow`

### TinyNote as sibling family

- uses the same range rules as SingleNote
- uses its own root/chord/scale property set
- places tiny notes even if no SingleNote exists in the same cell

### SingleNote overlay TinyNote

- only exists where SingleNote emitted a note in the same pass
- uses its own limited color menu semantics from sprint-1
- is ignored whenever standalone TinyNote is active

## 5. Standalone TinyNote precedence rule

The Iteration 2 clarification makes this rule explicit:

- if standalone TinyNote would emit any notes, overlay TinyNote is disabled/ignored

Implementation recommendation:

Create a helper such as:

- `isStandaloneTinyActive()`

This should return true if any tiny root/chord/scale mode would produce output under current config.

Then:

- menu can display `singleAddTiny` as disabled/unavailable if possible
- apply path must ignore `singleAddTiny` when standalone TinyNote is active

## 6. Copy-from-SingleNote action

Add one-shot actions for:

- NamedNote -> Copy from SingleNote
- TinyNote -> Copy from SingleNote

### Required behavior

Copy all three role groups from SingleNote:

- root mode + root color
- chord mode + chord color
- scale mode + scale color

Do not copy:

- overlay tiny-note choice

Implementation recommendation:

Add plugin actions such as:

- `copyFamilyFromSingle:named`
- `copyFamilyFromSingle:tiny`

These should mutate the target family properties in place and return a simple result message.

## 7. Keep semantics and lane replacement

The plugin should continue to follow FillPlugin’s Keep model.

That means:

- if a family role mode is `keep`, that lane preserves existing notes of that family
- if not `keep`, the plugin is allowed to replace that family’s lane content as implied by current Fill semantics

### Important implication

Because sprint-2 introduces three different note families, keep/replace must now be reasoned per family lane, not globally.

Recommended implementation split:

- NamedNote clear/replace logic
- SingleNote clear/replace logic
- TinyNote clear/replace logic

This avoids accidental coupling between lanes.

## 8. NamedNote clear and commit behavior

Per Iteration 2, stay with FillPlugin’s existing Keep-style model, not owner-only preservation.

So for NamedNotes:

- `keep` preserves existing NamedNotes in the relevant role outcome
- non-keep behavior allows replacement as implied by FillPlugin’s overall fill semantics

Implementation note:

This will likely require a dedicated named-note merge/replacement helper because `namedNotes` is keyed differently from `playedNotes`.

## 9. Commit path refactor

The sprint-1 `commitNotes` logic should be expanded to commit all active families.

Recommended sequence:

1. compute selected family outputs
2. merge/replace NamedNotes according to NamedNote keep semantics
3. merge/replace SingleNotes according to SingleNote keep semantics
4. merge/replace TinyNotes according to TinyNote keep semantics
5. apply overlay TinyNote only if standalone TinyNote is not active
6. preserve current section/song scope semantics from sprint-1

## 10. Clear path refactor

Likewise, `clearCurrentSection`, `clearSong`, and any Fill-owned cleanup helpers should become family-aware.

Recommended helpers:

- clear named-note output for FillPlugin family config
- clear single-note output for FillPlugin family config
- clear tiny-note output for FillPlugin family config

Exact implementation can either:

- recompute and replace according to keep rules
- or remove known Fill-emitted shapes directly

The important requirement is consistency with current FillPlugin keep semantics.

## Implementation phases

## Phase 1: property and menu refactor

Deliverables:

- new sprint-2 property schema in [plugins/fill/properties.json](../../../../plugins/fill/properties.json)
- new family-aware menu construction in [plugins/fill/FillPlugin.js](../../../../plugins/fill/FillPlugin.js)
- copy-from-SingleNote actions
- disabled/unavailable overlay TinyNote UX if practical

Validation:

- menu shape tests
- resolver/value tests
- persistence shape tests

## Phase 2: planning refactor

Deliverables:

- family-aware role config helpers
- normalized plan builder for NamedNote/SingleNote/TinyNote/overlay TinyNote
- standalone TinyNote precedence handling

Validation:

- pure planning tests where possible
- role coexistence tests
- standalone TinyNote disables overlay TinyNote tests

## Phase 3: commit and clear semantics

Deliverables:

- family-aware apply/clear/clearSong/commit behavior
- named-note output path
- per-family keep semantics

Validation:

- current-section apply tests
- clear-song tests
- commit tests
- mixed-family coexistence tests

## Phase 4: help, summary, and persistence polish

Deliverables:

- updated help text
- updated summary text
- updated persistence tests
- updated legacy-empty-stub logic if needed

Validation:

- help/summary tests
- persistence round-trip tests

## Recommended test additions

At minimum, add tests for:

1. menu hierarchy now shows NamedNote, SingleNote, TinyNote sibling groups
2. `Copy from SingleNote` copies all root/chord/scale modes and colors
3. changing SingleNote later does not live-update copied NamedNote/TinyNote settings
4. NamedNote ignores fret limits
5. NamedNote ignores string limits
6. NamedNote can appear on nut/open-string positions
7. SingleNote still obeys fret and string limits
8. standalone TinyNote obeys fret and string limits
9. standalone TinyNote can emit with no SingleNote present
10. overlay TinyNote still rides atop SingleNote when standalone TinyNote is inactive
11. overlay TinyNote is ignored when standalone TinyNote is active
12. NamedNote, SingleNote, and TinyNote can all coexist for the same role in the same table
13. keep semantics remain intact per lane/family
14. clear/commit work correctly with mixed family output

## Main risk areas

1. Property explosion and menu complexity
	- mitigation: family-aware builders, not manual duplication

2. NamedNote lane semantics diverging from `playedNotes`
	- mitigation: implement NamedNote as a separate output path early, not as an afterthought

3. Keep semantics becoming ambiguous across families
	- mitigation: write per-family merge helpers with explicit tests

4. Overlay TinyNote conflicting with sibling TinyNote
	- mitigation: centralize `isStandaloneTinyActive()` and use it in both menu and apply code

## Recommended implementation order in code

1. Refactor property names and menu builders first
2. Introduce family config helpers second
3. Build standalone TinyNote and NamedNote planning/commit paths
4. Reattach sprint-1 overlay TinyNote as a subordinate feature under SingleNote
5. Finish clear/commit/help/persistence updates

This order minimizes the risk of trying to extend the sprint-1 flat structure too long.

## Deliverable definition for sprint-2

Sprint-2 is complete when:

1. FillPlugin exposes the new sibling menu hierarchy
2. NamedNote, SingleNote, and TinyNote can each be configured independently
3. NamedNote ignores fret/string range limits
4. SingleNote and standalone TinyNote obey fret/string range limits
5. overlay TinyNote still works under SingleNote when standalone TinyNote is inactive
6. standalone TinyNote prevails over overlay TinyNote when active
7. copy-from-SingleNote works for NamedNote and TinyNote
8. keep semantics are preserved per lane
9. apply/clear/commit all work correctly for mixed-family output
10. tests cover the new families and mixed interactions
