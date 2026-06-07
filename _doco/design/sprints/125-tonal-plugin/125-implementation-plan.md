# Sprint 125 TonalPlugin Implementation Plan

This document is the Iteration 2 implementation plan for sprint 125.

It is based on:

- the original request in `125-design.md`
- the follow-up product clarifications in `125-design.md`
- the earlier design sketch in `125-design-sketch.md`

This is not coding yet.

The purpose of this document is to define a realistic first implementation slice, identify file touch points, and surface the remaining questions that should be answered before Iteration 3 coding approval.

## Scope Summary

Sprint 125 should implement a first command-line Tonal plugin focused on a single fast workflow:

- pick one instrument/table
- move section-by-section
- inspect chord and mode suggestions for the current section
- accept the first suggestion quickly, or choose suggestion `1` through `9`
- write accepted values to table or to table-plus-chart according to a persistent plugin option

This sprint is intentionally not trying to be a full command-line replacement for every existing TonalPicker feature.

## In-Scope Features

## 1. New TonalPlugin

A new plugin should be added with:

- registered name `tonal`
- plugin menu trigger `o`
- plugin menu caption `t<b>o</b>nal`

Important clarification:

Because the trigger is now `o`, the actual command path should be `/fpo`, not `/fpt`.

The examples in the earlier design notes still use `/fpt` in a few places, but the implementation should normalize on `/fpo`.

## 2. Accept-Focused Top-Level Flow

The top-level plugin menu should stay intentionally spare:

```text
/fpo
  a) accept
  p) print extra modes
```

The accept workflow menu should look approximately like:

```text
/fpoa
  i) instrument [P46_1]
  a) auto write [table|chart+table]
  p) prev section
  n) next section
  c) chords [count/status]
  C) accept Chord 'min7'
  m) modes [count/status]
  M) accept Mode 'minor'
  r) refresh
  h) help
```

This menu shape should be treated as product-approved direction unless the remaining questions below force a minor adjustment.

## 3. Instrument Picker

The plugin should reuse the same target-table style used by the current plugins.

Expected behavior:

- list eligible tables/instruments using a normal plugin property select
- persist that choice with the plugin
- keep the selected instrument stable while navigating sections

## 4. Auto Write Policy

This sprint should support exactly two auto-write options:

- `table`
- `chart+table`

No `none` mode is planned for this sprint.

That follows the clarified main use case:

- users generally want table and chart to stay in sync during rip-through approval
- a table-only option still exists for the less common case of revisiting a table without changing chart values

## 5. Chord Suggestions

The plugin should compute the current section/table tonal result and expose up to 9 chord suggestions.

Expected command behavior:

- `C)` immediately accepts chord suggestion `1` if present and stays in `/fpoa`
- `c)` opens a submenu with:
  - `a)` accept suggestion `1`
  - `1)` through `9)` suggestion rows as available

The top-level summary value should reflect:

- current accepted/matching state
- visible first suggestion
- count of hidden suggestions if more exist

Examples:

- `chords [&check;Cmaj7]`
- `chords [&check;Cmaj7, 4 more]`
- `chords []`

## 6. Mode Suggestions

The plugin should compute the current section/table tonal result and expose up to 9 filtered mode suggestions.

Expected command behavior:

- `M)` immediately accepts mode suggestion `1` if present and stays in `/fpoa`
- `m)` opens a submenu with:
  - `a)` accept suggestion `1`
  - `1)` through `9)` suggestion rows as available

Top-level summary examples:

- `modes [C ionian]`
- `modes [C ionian, 3 more]`
- `modes []`

## 7. prev/next Section Navigation

Section navigation in this sprint should be deliberately simple:

- `p)` previous section
- `n)` next section

Expected behavior:

- move exactly one section backward or forward
- update the current section using the same user-visible repaint path as transport navigation
- remain in `/fpoa`
- recalculate chord/mode summaries after navigation

The product intent here is “rip through sections using stable keys,” not generalized transport control.

## 8. Refresh

`r)` should force a recomputation of the current suggestion/status values and remain in `/fpoa`.

This is the escape hatch for the known moving-target ambiguity when other actions or plugins may have changed notes since the menu was opened.

## 9. Print Extra Modes

`/fpop` should dump the unfiltered extra modes to `showMessages(...)` and exit that action immediately.

This action should:

- bypass the Western filter
- not allow direct acceptance from that long list in this sprint
- act as a pedagogical and exploratory dump only

This is the agreed way to avoid deep or paged command-line menus.

## Explicitly Out Of Scope

The following items should not be included in this sprint:

- clear chord or clear mode actions
- command-line editing or accepting of long unfiltered mode lists
- source-set picker in TonalPlugin
- paging or scrolling mechanics in the command menu
- background syncing while the menu remains open during looping
- persisting transient suggestion snapshots or accepted indexes

The source set for this sprint should be read directly from the model’s persisted `tonalSourceSet` on the selected table.

## Architectural Direction

## 1. Keep Plugin Logic Out Of Core

The new TonalPlugin should keep its workflow logic inside the plugin implementation, in line with the product preference stated in `125-design.md`.

Core systems such as command routing, transport, and plugin manager should not be modified unless strictly required for registration or already-standard plugin integration.

## 2. No DOM Scraping

The plugin must not inspect or reuse TonalPicker DOM markup.

It should recompute from shared tonal helpers and the song model.

That preserves the separation between:

- chart/HTML TonalPicker presentation
- command-line Tonal plugin presentation

## 3. Shared Helper Extraction

The revised design explicitly asks that shared code live in:

- `tonalPicker-functions.js`

Recommended use of that file:

- host shared tonal computation helpers used by both TonalPicker and TonalPlugin
- keep HTML rendering concerns in `tonalPicker.js`
- keep plugin orchestration in `plugins/tonal/TonalPlugin.js`

### Recommended extraction boundary

The cleanest first extraction would be helpers such as:

- compute tonal detection for a song/section/table with options
- optionally include or bypass Western filtering
- summarize suggestion arrays for compact menu values
- accept and write selected chord/mode values according to write policy

This can be done either by moving existing logic from `TonalFunctions.js` into `tonalPicker-functions.js`, or by letting `tonalPicker-functions.js` become a thin shared wrapper over `TonalFunctions.js` plus write helpers.

The important part is not the exact source file ownership. The important part is:

- TonalPicker and TonalPlugin should call the same shared tonal business logic
- neither should scrape the other’s UI output

## 4. Model-Owned tonalSourceSet

This sprint should not introduce a plugin-local source override.

The plugin should read the current table’s persisted `tonalSourceSet` from the model and use that directly.

That keeps the sprint aligned with the stated use case:

- TonalPicker remains the place where source is selected
- TonalPlugin becomes the place where suggestions are approved quickly

## Proposed File Touch Points

Expected new files:

- `plugins/tonal/TonalPlugin.js`
- `plugins/tonal/properties.json`
- `_tests/jest/tonal-plugin.test.js`
- `tonalPicker-functions.js`
- `_doco/design/sprints/125-tonal-plugin/125-implementation-plan.md`

Expected modified files:

- `plugins/registerPlugins.js`
- `help-plugins.html`
- possibly `TonalFunctions.js`
- possibly `tonalPicker.js`

### Why each file is likely involved

`plugins/tonal/TonalPlugin.js`

- plugin menu shape
- dynamic suggestion submenus
- accept actions
- section navigation actions
- summary rendering
- help text

`plugins/tonal/properties.json`

- instrument property
- auto-write property
- help action
- possibly `print extra modes` if kept as a direct action property rather than custom node

`tonalPicker-functions.js`

- shared tonal computation and write helpers

`TonalFunctions.js`

- may need a new option or exported helper to bypass Western filtering safely

`tonalPicker.js`

- may switch to using the shared helper module instead of owning those rules privately

`plugins/registerPlugins.js`

- register the new TonalPlugin with the plugin manager

`help-plugins.html`

- document `/fpo`, `/fpoa`, `/fpoc`, `/fpom`, `/fpop`

`_tests/jest/tonal-plugin.test.js`

- focused plugin workflow tests for this sprint

## Suggested Internal Plugin Shape

## Properties

Likely persistent properties:

- `targetTable`
- `autoWrite`
- `help`

Likely dynamic/custom menu nodes instead of properties:

- `accept`
- `printExtraModes`
- `prevSection`
- `nextSection`
- `refresh`
- `chords`
- `modes`
- immediate `C` and `M` accept actions

This split mirrors how FillPlugin mixes static properties and handcrafted action nodes.

## Suggested action names

Potential action names, purely as plan labels:

- `acceptFirstChord`
- `acceptChordIndex:0..8`
- `acceptFirstMode`
- `acceptModeIndex:0..8`
- `prevSection`
- `nextSection`
- `refresh`
- `printExtraModes`

The actual naming can be adjusted during coding, but these illustrate the intended action granularity.

## Suggested Summary Semantics

The top-level `chords` and `modes` captions should be generated dynamically each time the menu is resolved.

The summary string should:

- show `[]` when there are no suggestions
- show the first suggestion
- append `, N more` when more than one suggestion remains hidden
- optionally prefix the first suggestion with `&check;` based on the current write target comparison rule

The plan should assume no suggestion snapshot persistence.

Instead:

- recompute on render
- recompute after every action
- recompute after section navigation

That matches the preferred simplification in the design notes.

## Write Semantics

## `autoWrite = table`

Accepting a chord should write:

- current section / current table `chord`

Accepting a mode should write:

- current section / current table `mode`

## `autoWrite = chart+table`

Accepting a chord should write:

- current section / current table `chord`
- current section `chartChord`

Accepting a mode should write:

- current section / current table `mode`
- current section `chartMode`

The implementation should use existing model write functions where available instead of mutating structures ad hoc.

## UI Refresh Semantics

After any accept or section navigation action, the plugin should request the normal UI refresh/update path so the user sees:

- current section change
- current chart labels change
- current TonalPicker/chart-related displays change

The design note explicitly prefers behavior that feels like pressing existing transport navigation buttons.

So the implementation should prefer the existing section navigation and repaint path rather than a plugin-only silent section pointer update.

## Testing Plan

Add focused Jest coverage for:

1. plugin registration and top-level menu trigger/caption
2. root menu shape `/fpo` with `accept` and `print extra modes`
3. accept menu shape `/fpoa`
4. instrument selection summary
5. auto-write options limited to `table` and `chart+table`
6. top-level chord summary with zero suggestions
7. top-level chord summary with one suggestion
8. top-level chord summary with one visible plus `N more`
9. top-level mode summary with zero suggestions
10. top-level mode summary with one visible plus `N more`
11. immediate `C` accepts first chord and stays at accept level
12. immediate `M` accepts first mode and stays at accept level
13. chord submenu `a)` accepts first suggestion
14. chord submenu `1..9)` accepts the chosen suggestion index
15. mode submenu `a)` accepts first suggestion
16. mode submenu `1..9)` accepts the chosen suggestion index
17. hidden overflow count is reported when more than 9 suggestions exist
18. `print extra modes` dumps unfiltered extra modes to `showMessages(...)`
19. `prev section` moves one section back and refreshes summaries
20. `next section` moves one section forward and refreshes summaries
21. plugin reads model `tonalSourceSet` and does not expose a source property
22. `autoWrite=table` writes only table values
23. `autoWrite=chart+table` writes both table and chart values
24. refresh recomputes summaries without persisting temporary suggestion lists

## Risks

## 1. `/fpt` vs `/fpo` Drift In Docs Or Tests

The revised design text still includes old `/fpt` examples even after assigning trigger `o`.

The implementation plan assumes the real path should be `/fpo` everywhere.

This should be confirmed before coding to avoid doc/test churn.

## 2. Section Navigation Path Choice

The product wants navigation to feel like mashing transport buttons.

That suggests using existing section navigation/repaint flows, but those may carry more side effects than a plugin-only section index change.

This is implementable, but the exact navigation function choice should be confirmed during coding.

## 3. Shared Helper Refactor Scope

Creating `tonalPicker-functions.js` is good architecture, but it adds a small refactor tax before the plugin itself exists.

The safest coding path is:

- extract only the minimum shared helpers needed by TonalPlugin and TonalPicker
- do not try to redesign all tonal infrastructure in the same sprint

## 4. Suggestion Count Stability

Because the plugin will recompute on refresh rather than persist suggestion snapshots, a user could see menu captions change after navigation or external note edits.

This is acceptable for this sprint per the design notes, but should be documented in help text.

## 5. Unfiltered Mode Dump Volume

The extra-modes dump could be large.

That is accepted product-wise, but it should be treated as a Messages-panel action only, not a menu selection surface.

## Remaining Questions For Iteration 3 Approval

## 1. Confirm Menu Root Path

Should all coding and docs normalize to:

- `/fpo`

given the approved plugin trigger `o`?

This plan assumes yes.

## 2. Checkmark Comparison Rule When `autoWrite = chart+table`

The design text says:

- if auto-write includes chart, the checkmark is based on the section chart value
- if auto-write is table-only, the checkmark is based on the table value

Please confirm that when `autoWrite = chart+table`, the summary should compare only against chart values and ignore whether table already matches.

This plan assumes yes, because that is what the note says.

## 3. Slash Chord Acceptance Semantics

The main use case explicitly expects slash chords to flow into chartChord when Tonal recommends them.

Please confirm that TonalPlugin should accept Tonal’s chord text verbatim for chart writing rather than normalize or strip slash notation.

This plan assumes verbatim acceptance.

## 4. Overflow Result Message Wording

The design text suggests results such as:

- `4 more modes, see Tonal picker`

Please confirm whether that overflow wording belongs:

- only in the top-level summary caption
- only in the dropdown action result
- or in both

This plan assumes:

- summary captions use `, N more`
- action results mention the accepted value only
- overflow hint text is mainly a summary concern

## 5. `print extra modes` Output Scope

Should `print extra modes` dump:

- only non-Western extra modes beyond the filtered list
- or the full unfiltered mode result list, including Western modes too?

The wording “dump all modes, without the western filter” suggests the second interpretation.

This plan assumes full unfiltered list.

## Recommended Coding Sequence For Iteration 3

1. add `tonalPicker-functions.js` with the minimum shared tonal helpers
2. update `tonalPicker.js` and/or `TonalFunctions.js` to use those shared helpers cleanly
3. create `plugins/tonal/TonalPlugin.js` and `plugins/tonal/properties.json`
4. register the plugin in `plugins/registerPlugins.js`
5. implement top-level accept workflow menu and summaries
6. implement immediate `C` and `M` accept actions
7. implement chord/mode numbered submenus with 1..9 cap
8. implement section navigation and refresh
9. implement `print extra modes`
10. add focused Jest coverage
11. update `help-plugins.html`

## Bottom Line

Sprint 125 looks feasible with the revised scope.

The main reason it now looks especially workable is that the feature set has been simplified into a narrow approval workflow:

- no source picker in the plugin
- no clear actions
- no command-line long-list acceptance
- no persisted transient suggestion state

That makes this sprint mostly about:

- shared tonal helper extraction
- one new plugin
- dynamic suggestion menus
- controlled write behavior

Those are all well within the patterns already present in the repository.