# Sprint 903 TonalPlugin Design Sketch

This document is intentionally a design sketch only.

It is not an implementation plan, and it does not recommend coding yet.

The goal is to answer, at a hand-waving but reality-based level, what the command-line shape of a Tonal plugin could look like, and what the likely feasibility, risks, and product tradeoffs are.

## Short Answer

A command-line Tonal plugin looks viable.

The existing code already proves several important pieces:

- tonal detection already exists in `TonalFunctions.js`
- section/table writes already exist in `tonalPicker.js` and `infinite-neck.js`
- source-set selection already exists as `NamedNote`, `SingleNote`, `TinyNote`
- plugin menus already support a mix of static property menus and dynamic action submenus

So the missing work is not “can the product do tonal detection from the command line?”

The missing work is mostly about shaping it into a plugin-friendly workflow:

- current section targeting
- suggestion list display
- accept actions
- section navigation
- write policy
- optional Western-scale filtering

That means this is more of a menu-orchestration and product-design problem than a deep algorithmic problem.

## Current Reality

Today the tonal UI is centered on `tonalPicker.js` and is embedded in chart-related rendering.

The current picker already does these things:

- shows chord and mode suggestions
- lets the user select a suggestion from a numeric-like visible list in manufactured HTML
- writes table-level `chord` and `mode`
- can also write section-level `chartChord` and `chartMode`
- can change the tonal source set for the target table

The current tonal detection path in `TonalFunctions.js` already does these things:

- collects source note names from the selected source family
- injects the effective root into the detection set when needed
- runs `Chord.detect(...)`
- runs `Scale.detect(...)`
- filters scales through `filterWesternScales(...)`

So a command-line plugin does not need new music-theory infrastructure first.

## Recommended Product Shape

The cleanest mental model is not “a picker in command-line clothes.”

The cleaner model is:

- TonalPlugin computes the current section/table tonal suggestions
- it exposes the first few suggestions as menu choices
- it exposes explicit accept-first shortcuts
- it exposes section navigation inside the plugin
- it exposes write targets and write policy

That keeps the interaction command-line-native.

## Proposed Plugin Identity

- plugin name: `TonalPlugin`
- likely trigger: `t`
- purpose: inspect, navigate, and accept tonal suggestions for the current section/table

This would probably sit conceptually closer to `FillPlugin` and `ArpeggioPlugin` than to the existing chart tab UI.

## Proposed Full Menu Shape

Below is one plausible full menu shape.

This is not meant as a final commitment to triggers or exact captions.

```text
/fpt
	i) instrument [P46_1]
	s) source [NamedNote|SingleNote|TinyNote]
	w) western filter [on|off]
	a) auto write [off|table|chart|both]
	n) nav
	c) chords [count/status]
	m) modes [count/status]
	r) refresh
	h) help

/fptn
	p) prev section
	n) next section
	g) go current section status

/fptc
	a) accept first chord
	1) <first chord suggestion>
	2) <second chord suggestion>
	3) <third chord suggestion>
	4) <fourth chord suggestion>
	5) <fifth chord suggestion>
	6) <sixth chord suggestion>
	d) details / show all chord suggestions
	x) clear chord

/fptm
	a) accept first mode
	1) <first mode suggestion>
	2) <second mode suggestion>
	3) <third mode suggestion>
	4) <fourth mode suggestion>
	5) <fifth mode suggestion>
	6) <sixth mode suggestion>
	d) details / show all mode suggestions
	x) clear mode
```

## Why This Shape Fits The Existing System

This shape maps well onto the current plugin menu system because:

- `instrument`
- `source`
- `western filter`
- `auto write`

can all be ordinary plugin properties or property-like dynamic selections.

And:

- `prev section`
- `next section`
- `accept first chord`
- `accept first mode`
- numeric suggestion rows
- `refresh`

fit naturally as dynamic `pluginAction:invoke` menu entries.

This mirrors patterns already used elsewhere:

- static select properties for persistent plugin state
- dynamic action nodes for data that depends on the current song/section

## Viability By Feature

## 1. Western Filter Toggle

Wishlist:

- allow clearing the Western-only filter
- when off, pause `filterWesternScales(...)`

Viability: high.

This is probably the easiest part.

The current `getTonalForTable(...)` path already centralizes the scale-detection result and then applies `filterWesternScales(...)`.

A future implementation could add one of these:

- a boolean argument to `getTonalForTable(...)`
- a plugin-local post-filter decision after calling a lower-level helper
- a new helper that returns both world scales and filtered scales

Design note:

The product meaning of this toggle should be explicit. The user is not “changing music theory.” They are changing suggestion visibility.

So the UI should probably say something like:

- `western filter [on]`
- `western filter [off: world scales]`

That matters because turning it off may create very long suggestion lists.

## 2. nextSection / prevSection Navigation

Wishlist:

- plugin-local next/prev section navigation

Viability: high.

The codebase already has section navigation in the `Song` and transport paths, and many plugins already operate against the current section.

The real design question is whether TonalPlugin navigation should:

- only move the current section pointer
- or also trigger a UI replay/refresh like transport navigation

For a command-line plugin, the likely safer choice is:

- move the current section
- refresh the tonal suggestion menu/status
- avoid surprising transport side effects unless explicitly wanted

## 3. Accept First Chord / Mode

Wishlist:

- `A) Accept first chord`
- `A) Accept first mode`

Viability: high.

This is straightforward once the plugin can compute the current suggestion arrays.

The plugin action would do roughly this:

- compute current suggestions
- if empty, return a no-op result
- otherwise accept suggestion index `0`
- apply the chosen write policy
- return a concise action result

This is exactly the kind of action-oriented behavior the plugin system already supports.

## 4. Numeric Suggestion List

Wishlist:

- numeric list of suggestions to accept, similar to TonalPicker

Viability: medium-high.

This is feasible, but the existing plugin menu system imposes one design constraint:

- the menu is better at short dynamic child lists than at arbitrarily deep, huge lists

So the practical design should probably cap the visible numeric list to a manageable number, such as 6 or 9, and then optionally expose a “details” or “show all” message panel.

This is similar to the recent decision for `TonalPickerAllModes`, where inline display was intentionally capped.

Recommended product behavior:

- numeric rows show the first N suggestions
- caption/status indicates if more exist
- a secondary action can dump the full set to Messages if needed

That avoids building a command-line menu that becomes too long to use.

## 5. Automatic Song Writes

Wishlist:

- plugin writes to `Song` automatically, maybe protected by an option

Viability: high, but product-sensitive.

The write plumbing already exists today:

- table-level chord/mode writes
- section-level chartChord/chartMode writes
- tonalSourceSet writes

So the coding challenge is not whether writes are possible.

The challenge is product clarity.

A command-line Tonal plugin needs a very clear write policy because “accept suggestion” can mean several different things:

- write only table-level `chord`
- write only table-level `mode`
- write only chart-level fields
- write both table and chart values
- write nothing until explicitly committed

This is the biggest product ambiguity in the wishlist.

A safe future design would probably make it explicit with a property like:

- `auto write [off|table|chart|both]`

with a conservative default such as `off` or `table`.

## Recommended Data/State Shape

A future TonalPlugin likely needs a small amount of plugin-local state, for example:

- selected target table
- selected tonal source set override, or “use table setting”
- western-filter toggle
- write policy
- maybe last computed suggestion snapshot for menu rendering

The last item is important.

The command-line plugin should not rely on scraping or reusing DOM built by `tonalPicker.js`. It should recompute or cache the same underlying data model through shared tonal helpers.

That means the real long-term clean design is:

- shared tonal computation helpers in `TonalFunctions.js`
- UI-specific rendering in `tonalPicker.js`
- plugin-specific orchestration in a future `plugins/tonal/TonalPlugin.js`

## Recommended Menu Semantics

## Top-Level Summary Tokens

It would be useful if the top-level menu showed compact status values, for example:

- `instrument [P46_1]`
- `source [NamedNote]`
- `western filter [on]`
- `auto write [table]`
- `chords [4 suggestions, current=Cmaj7]`
- `modes [3 suggestions, current=C ionian]`

That keeps the plugin readable without descending everywhere.

## Accept Semantics

Accepting a suggestion should probably do all of these:

- write the selected value according to the chosen write policy
- refresh related tonal displays
- stay in the Tonal plugin menu hierarchy, likely popping back one level
- return a short action result

Example action results:

- `Accepted chord 1: Cmaj7`
- `Accepted mode 1: C ionian`
- `No chord suggestions`
- `No mode suggestions`

## Clear Semantics

If the plugin supports clear actions, they should be target-aware.

Example:

- `clear chord`
- `clear mode`

would need to respect whether the plugin is clearing:

- table values
- chart values
- both

This is another reason the write policy should be explicit rather than implicit.

## Risks And Product Challenges

## 1. Ambiguous Write Target

This is the biggest product issue.

The current tonal UI already spans two related but different concepts:

- per-table tonal picks
- section-level chart picks

A command-line plugin that simply says “accept” without making the write target obvious will feel inconsistent quickly.

## 2. Long Suggestion Lists

Turning off Western filtering can produce very large mode lists.

That creates command-line usability risk:

- long menus
- hard-to-predict numeric positions
- menu scrolling/reading overhead

The product probably needs to treat “world scales” as an advanced mode and cap visible suggestions.

## 3. Suggestion Instability

Tonal suggestions can change as notes change.

In a command-line plugin, the user expects suggestion `1` to remain meaningful while they are interacting. If the underlying section is mutating through replay or edits, the list can move under them.

That means the plugin may eventually need either:

- recompute on every entry, accepting the moving target
- or snapshot the suggestion list while the plugin is open

This is a subtle product decision.

## 4. Source-Set Duplication

The current table model already has `tonalSourceSet` persisted at the section/table level.

A plugin could either:

- reuse and edit that same persisted source set
- or keep a temporary plugin-local source override

These mean different things product-wise.

If the plugin mutates the persisted source set automatically, it stops being “just an inspection tool.”

## 5. Accept-First Can Feel Too Aggressive

`Accept first` is convenient, but it assumes the first suggestion is usually what the user wants.

That may be true often enough to justify the shortcut, but it can also encode too much confidence in Tonal’s ranking.

So the action should probably be presented as convenience, not authority.

## Coding Challenges

## 1. Shared Logic vs UI Coupling

The current tonal logic is split across:

- `TonalFunctions.js` for computation
- `tonalPicker.js` for HTML and click-handlers
- `infinite-neck.js` for writes

A future plugin should avoid duplicating business rules from `tonalPicker.js`.

That implies some refactoring may eventually be warranted, even if small.

## 2. Dynamic Menu Construction

The plugin system handles dynamic menus well, but suggestion lists are not simple static selects.

This means the plugin would likely need custom `MenuItemProxy` submenus rather than plain `PluginProperty` select rows.

That is feasible, but it is more handcrafted than a simple properties file.

## 3. Navigation Refresh Semantics

If TonalPlugin includes `prev section` and `next section`, the UI and plugin status need to stay synchronized.

That is feasible, but it means the plugin should have a clear refresh path after navigation.

## 4. Persistence Scope

Some TonalPlugin settings probably should persist, such as:

- target table
- western filter toggle
- write policy

Other values probably should not persist, such as:

- last suggestion list
- last accepted candidate index

This is manageable, but it needs a deliberate boundary.

## Recommended Design Direction

If this becomes a scheduled sprint later, the safest design direction would likely be:

1. build a small TonalPlugin that targets the current section and selected table
2. keep suggestion computation shared with `TonalFunctions.js`
3. expose `source`, `western filter`, and `write policy` first
4. expose numeric accept lists for a capped number of chord/mode suggestions
5. add `accept first` actions as convenience shortcuts
6. add section navigation only if the first version feels too stationary

That sequence is recommended because it reduces the number of product decisions made all at once.

## Bottom-Line Feasibility View

High-level viability: good.

The codebase already has the hard pieces:

- tonal detection
- source selection
- song writes
- command-menu plugin infrastructure

The main unknowns are not algorithmic unknowns. They are product-shape questions:

- what exactly “accept” writes to
- how much suggestion list to show
- how much auto-write behavior is desirable
- whether source selection should be inspection-only or persist back into the song model

So the concept looks feasible, but it should be treated as a workflow design problem first and only secondarily as a coding problem.
