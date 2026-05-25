# FillPlugin sprint-2 design response

## Scope reviewed

Per request, I reviewed:

- sprint-1 in [sprint-101-fill-plugin.md](sprint-101-fill-plugin.md)
- sprint-2 in [sprint-108-fill-plugin-more-types.md](sprint-108-fill-plugin-more-types.md)
- the current sprint-2 design in [FillPlugin-sprint-2-design.md](FillPlugin-sprint-2-design.md)
- the completed sprint-1 FillPlugin code now in the repository at [plugins/fill/FillPlugin.js](../../../../plugins/fill/FillPlugin.js) and [plugins/fill/properties.json](../../../../plugins/fill/properties.json)

## Executive summary

Sprint-2 is feasible.

The current sprint-1 implementation already has the right general ingredients:

- target-table selection
- fret and string range filtering
- role-driven note selection for root/chord/scale
- menu/submenu construction using `MenuItemProxy`
- per-property persistence
- event-driven apply / clear / clear-song / commit flow

However, sprint-2 is not a small additive change. The current implementation is structurally centered on one primary family, `SingleNote`, plus one special overlay option, `tinyNotes`. The sprint-2 design introduces three sibling note families with partly shared and partly distinct semantics:

- `NamedNote`
- `SingleNote`
- `TinyNote`

and also preserves a separate overlay mode:

- `SingleNote -> add TinyNote`

That means the feature is feasible, but should be treated as a moderate refactor of FillPlugin's property model, menu tree, plan builder, and clear/commit semantics.

## What the current code already supports well

### 1. Shared role logic is already a strong base

The current plugin already models root/chord/scale as parallel role concepts with color and mode behavior. That logic lives in a reusable enough shape now that it can be expanded into per-note-family role groups.

This is the strongest reason the sprint is feasible.

### 2. Range filtering already exists and is stable

Sprint-1 already has working fret and string range handling, including:

- persisted zero-based row storage
- 1-based user display for strings
- row/fret normalization on load and set

That means `SingleNote` and standalone `TinyNote` can reuse the current range machinery directly.

### 3. Menu composition is already dynamic enough

The current options menu is manually composed in code rather than generated from a rigid fixed schema. That is good for sprint-2, because the requested hierarchy is richer than sprint-1 and includes nested submenus and one-shot actions like `Copy from SingleNote`.

## Where sprint-2 differs materially from sprint-1

### 1. The current property model is flat and single-family

Today there is only one role triplet:

- `rootMode/rootColor`
- `chordMode/chordColor`
- `scaleMode/scaleColor`

plus one standalone overlay selector:

- `tinyNotes`

That flat shape works for sprint-1 because there is only one role-bearing note family, `SingleNote`.

For sprint-2, the plugin needs separate configuration namespaces for at least:

- `named.root/chord/scale`
- `single.root/chord/scale`
- `tiny.root/chord/scale`
- `single.addTiny`

So the current property schema cannot simply be extended with one or two more properties. It needs a deliberate reorganization.

### 2. NamedNote is not operationally the same as SingleNote

The design says NamedNote should “be just like SingleNote” except that it ignores fret and string limits.

At the UI level that is straightforward.

At the model level it is not the same operation.

The current FillPlugin writes into `playedNotes` by cell. NamedNotes live in a different structure and semantic model: they are note-name keyed and intentionally expand conceptually across the entire neck.

So `NamedNote` is feasible, but it should be treated as a parallel output family, not as a thin variant of the current `SingleNote` implementation.

### 3. Standalone TinyNote and overlay TinyNote are two different systems

The design correctly distinguishes these two cases:

1. overlay TinyNote under `SingleNote`
2. standalone `TinyNote` as a sibling family

Those are not the same feature internally.

Overlay TinyNote is currently implemented as “if a SingleNote is emitted in this cell, optionally emit a TinyNote on top using the special tiny color menu.”

Standalone TinyNote instead wants its own root/chord/scale role selection and its own independent emission path, even when no SingleNote is present.

So sprint-2 should not try to coerce both concepts through the current single `tinyNotes` property. They need to be modeled distinctly.

## Feasibility by requested note family

### NamedNote

Feasible: yes.

Complexity: medium.

Reasoning:

- the menu structure is easy to add
- the role logic can be reused
- the main implementation work is output/clear/commit semantics because NamedNotes are not stored as `playedNotes`
- range filtering must be intentionally bypassed for this family

### SingleNote

Feasible: yes.

Complexity: low to medium.

Reasoning:

- sprint-1 already does this
- sprint-2 mostly requires moving the current role options under a new `SingleNote` submenu and preserving current behavior

### TinyNote as sibling family

Feasible: yes.

Complexity: medium.

Reasoning:

- same role logic can be reused
- same range logic can be reused
- it needs its own property namespace and its own emission path
- it should not depend on whether a SingleNote was generated in the same cell

### `SingleNote -> add TinyNote`

Feasible: yes.

Complexity: low.

Reasoning:

- this is very close to the existing sprint-1 tiny-note overlay
- the main change is menu placement and coexistence rules with standalone TinyNote

## Suggested implementation shape

The current sprint-1 code suggests a good sprint-2 architecture:

### 1. Introduce explicit note-family config groups

Instead of one shared `ROLE_CONFIG`, define a role config builder or grouped config for:

- `named`
- `single`
- `tiny`

Each family would own:

- root mode
- root color
- chord mode
- chord color
- scale mode
- scale color

Then keep a separate `singleAddTiny` property for the overlay tiny-note option.

### 2. Generalize planning into per-family emission

The current plan builder effectively decides one cell at a time and returns:

- one `singleNote`
- maybe one `tinyNote`

Sprint-2 should instead produce a plan more like:

- `namedNotesToSet`
- `singleNotesToPlace`
- `tinyNotesToPlace`
- `overlayTinyNotesToPlace`

or any equivalent normalized structure.

That would make apply/clear/commit much easier to reason about.

### 3. Keep range checks family-specific

- `SingleNote` and standalone `TinyNote` should use current fret/string limits
- `NamedNote` should bypass those limits entirely, per design

That split is feasible and should be explicit in code rather than hidden in ad hoc branching.

### 4. Preserve sprint-1 overlay behavior as a separate path

The overlay tiny-note option should remain logically subordinate to SingleNote, with its current “same cell as SingleNote” behavior.

That should not be merged with the sibling TinyNote family.

## Main design clarifications needed

These are the places where implementation behavior is not fully locked down yet.

### 1. When standalone TinyNote is active, should `SingleNote -> add TinyNote` be hidden, disabled, or merely ignored at apply time?

The document says it should “become unavailable during the fill, that is, ignored if chosen or persisted.”

That leaves three possible behaviors:

- keep visible and silently ignore
- keep visible but show disabled / unavailable state
- omit from menu dynamically while standalone TinyNote has any active roles

My recommendation:

- easiest and least risky is runtime ignore plus help/summary text
- best UX is disabled or captioned unavailable if the menu system makes that easy

Design team should choose which one is intended.

### 2. What counts as “TinyNote as its own category has root, chord, or scale chosen”?

For example, does any non-`none` mode count as active?

Likely answer:

- yes, if any of tiny/root, tiny/chord, or tiny/scale would emit notes, standalone TinyNote is active

But it would be better to state that explicitly.

### 3. How should `Copy from SingleNote` treat color modes?

The design says it copies “root, chord, and scale from SingleNote once.”

Please confirm it copies both:

- the mode (`none`, `keep`, `role`)
- and the color value for any role-mode entries

That is the most natural reading, but it should be explicit.

### 4. Should `Copy from SingleNote` copy the overlay tiny-note choice?

The design text strongly implies no: it copies only root/chord/scale role settings.

I am flagging this only because the phrase “from SingleNote” could be read broadly.

### 5. Can NamedNote, SingleNote, and standalone TinyNote all target the same musical role simultaneously?

The design suggests yes, and says all three sibling types can be present in the same table with different colors.

If that is final, then implementation should explicitly allow:

- NamedNote root
- SingleNote root
- TinyNote root

all at once, without precedence suppression between those families.

Please confirm that is intended.

### 6. For NamedNote clear/commit behavior, should FillPlugin manage only plugin-owned NamedNotes or all NamedNotes it would currently define?

This is important.

The current sprint-1 plugin mostly lives in the `playedNotes` world. NamedNotes are a different persistence surface and may already exist from user action.

So the design team should choose one of these models:

- conservative: FillPlugin only clears/commits NamedNotes it previously created and marked as its own
- recompute model: FillPlugin replaces the exact subset of named notes corresponding to its configured output family

This needs to be decided before implementation.

### 7. If NamedNote ignores fret/string limits, should it also ignore the target table’s visible playable restrictions such as dead BanjoNut cells?

My reading is yes, because NamedNotes are conceptual note-name marks across the neck rather than played-note placements.

But the design should state that explicitly.

## Stale references / file-location issues found

I found stale references in the old sprint-planning filename now replaced by [sprint-108-fill-plugin-more-types.md](sprint-108-fill-plugin-more-types.md).

The file currently refers to these names:

- `FillPlugin-sprint2-design.md`
- `FillPlugin-sprint2-design-copilot.md`
- `FillPlugin-sprint2-implementation-plan.md`

But in the current directory, the actual sprint-2 design files use the hyphenated form:

- [FillPlugin-sprint-2-design.md](FillPlugin-sprint-2-design.md)
- [FillPlugin-sprint-2-design-copilot.md](FillPlugin-sprint-2-design-copilot.md)
- [FillPlugin-sprint-2-implementation-plan.md](FillPlugin-sprint-2-implementation-plan.md)

So there was at least one stale-location / stale-filename issue in the older planning document:

1. the old sprint planning doc used `sprint2` where the actual files use `sprint-2`

## Bottom line

Sprint-2 is feasible from the completed sprint-1 codebase.

The main recommendation is:

- do not try to bolt NamedNote and standalone TinyNote onto the current flat sprint-1 property model
- instead, deliberately refactor FillPlugin into note-family groups with separate planning/output paths

If the Design team answers the clarification questions above, implementation planning for sprint-2 can proceed cleanly.
