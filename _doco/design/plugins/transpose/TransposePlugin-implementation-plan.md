# TransposePlugin implementation plan

## State of TransposePlugin

- baseline TransposePlugin current implementation:
``` 
    commit 87e5010b34de1b524dd43a61a6037205b258ded0
    Author: Laramie Crocker <git@laramiecrocker.com>
    Date:   Tue May 12 01:41:02 2026 -0700
```

## Implementation plan for new features as of 20260512

This plan captures the intended TransposePlugin behavior for the next implementation pass. It is based on the current baseline implementation plus the clarified design answers from chat on 2026-05-12.

### Goals

The plugin must support two different reset concepts that are currently conflated:

1. reset to the current sequence baseline
2. reset to the original session baseline

The important user-facing reason is that users often use one section or one chord shape as a movable progression template. They may transpose until they hear a new practical home key, then decide that the currently sounding key is now "home" for the rest of the session. After that rebasing step, interval cycling should continue relative to the new home key.

### User model

The intended user mental model is:

1. the Song has a current live pitch position in the session
2. TransposePlugin may walk the Song away from that position by applying interval deltas
3. the user may decide that the current live position is now the new home key
4. once the user makes that choice, both reset baselines move to the current live position
5. subsequent interval cycling should restart from the beginning of the interval list relative to that new home key

In practice, this is useful for progressions such as `0,5,7` where the user starts from one shape, auditions a new key by transposing, then accepts that key as the new tonic and wants future looping/apply operations to run as I, IV, V from there.

### Menu changes

The current single action:

- `R) Reset`

becomes a submenu:

- `R) Reset`
- `o) original`
- `c) current interval`
- `s) set original to current`

These are all actions. `R` is a parent menu item with children; `o`, `c`, and `s` are lower-case action items beneath it.

Action meanings:

- `original` means reset the live Song to the original session baseline, then restart the active interval sequence from the first interval relative to that restored home key
- `current interval` means reset the live Song to the current sequence baseline, equivalent to the current plugin reset behavior in spirit, but without destroying the original baseline
- `set original to current` means accept the current live Song position as home and rebase both the original baseline and the current sequence baseline to that position

### State model

The implementation should stop relying on a single implicit reset state.

The plugin needs explicit runtime-only session state for at least these concepts:

1. current interval index
2. current applied interval
3. live Song offset tracked by the plugin for this session
4. sequence baseline offset
5. original baseline offset
6. whether the plugin has been "awakened" yet for this session

Suggested semantics for those values:

- `currentIntervalIndex`: the current slot in the configured interval list
- `currentAppliedInterval`: the interval value currently considered active for delta calculations
- `liveSongOffset`: the plugin's running notion of where the Song currently sits relative to the plugin's baseline coordinate system
- `sequenceBaselineOffset`: the live Song offset that counts as zero for `Reset current interval`
- `originalBaselineOffset`: the live Song offset that counts as zero for `Reset original`
- `hasCapturedSessionBaseline`: whether the plugin has crossed the first-action threshold that defines the beginning of its session reality

The offsets are runtime-only and session-only. They are not persisted under `song.plugins`.

### Frankenstein rule

The chat clarified the session-baseline capture rule as a "Frankenstein rule": the plugin is considered present but not really awake until the user kicks it into action.

The beginning of plugin reality is:

1. when the user enables the plugin, or
2. when the user changes any plugin property other than the passive act of merely viewing menus, or
3. when the plugin is loaded on song open with `enableOnSongLoad=true`, or
4. when the plugin is revived from graveyard state

Important consequence:

- simply opening the plugin menu does not capture a baseline
- simply existing in registered runtime does not capture a baseline
- changing even a non-transposing property such as `doLeadKey` is considered sufficient to wake the plugin and establish its baseline
- revive establishes the baseline immediately and produces an already-awake plugin runtime state

The default from song load/startup is that the live song state is both original zero and current zero once the plugin becomes active for that session.

### Revive and song-load rules

These rules are now explicit:

- loading a song with `enableOnSongLoad=true` makes the loaded song state both the current baseline and the original baseline
- reviving from the graveyard should treat the revived state as a new awake-from-zero state
- a revived plugin should not carry forward prior session offset history
- after revive, the plugin should behave as though the current live song position is zero/original until further actions move it

### Apply semantics

The current implementation advances first to the next interval and applies the delta from `currentAppliedInterval` to that next interval.

For the new implementation, Apply should be defined as:

1. treat the current live Song position as the position for the currently active interval
2. compute the next target interval in the configured list
3. compute the delta from the currently active interval to the next target interval
4. transpose the Song by that delta
5. update `liveSongOffset`
6. advance `currentIntervalIndex`
7. set `currentAppliedInterval` to the newly active interval

This means that after rebasing home with `set original to current`, the next Apply should move from `0` to the next interval in the configured list.

Example:

- intervals are `[0,5,7]`
- user has accepted current live key as home
- sequence restarts at `0`
- next Apply moves to `5`
- next Apply moves to `7`
- next Apply moves back to `0`

### Intervals canonicalization

The interval list must quietly enforce a `0` home position.

Implementation rule:

1. if the user inputs an interval list that does not contain `0`, the plugin silently inserts `0`
2. the implementation should canonicalize the list so that `0` is the starting interval used for restart/apply semantics
3. Apply and reset logic may then assume that the sequence starts from `0`

Rationale:

- interval lists without `0` produced counter-intuitive behavior during testing
- the user mental model is that the plugin restarts from home, then advances through progression intervals from there

### Intervals editing semantics

This is the main functional change from the baseline plugin.

Changing `intervals` must no longer destroy the ability to return to the original session baseline.

When the user changes `intervals`:

1. do not transpose the Song
2. preserve `originalBaselineOffset`
3. move `sequenceBaselineOffset` to the current live Song position
4. restart interval sequencing from the first interval in the new list
5. set `currentAppliedInterval` to the first interval in the new list

That means the live position is accepted as the new current-sequence zero, but not as the new original baseline.

### Reset action semantics

#### Reset current interval

This is the replacement for current reset behavior.

It should:

1. transpose the Song so that the live Song position returns to `sequenceBaselineOffset`
2. restart the interval list from the first interval
3. set `currentAppliedInterval` to the first interval
4. leave `originalBaselineOffset` unchanged

#### Reset original

This is the newly separated behavior.

It should:

1. transpose the Song so that the live Song position returns to `originalBaselineOffset`
2. move `sequenceBaselineOffset` to that same restored position
3. restart the interval list from the first interval
4. set `currentAppliedInterval` to the first interval

The user explicitly wants this to behave as though the restored home key is now where the sequence starts again.

#### Set original to current

This is a full rebase.

It should:

1. leave the Song untouched musically because the current live position is already the desired home
2. set `originalBaselineOffset` to the current live Song position
3. set `sequenceBaselineOffset` to the current live Song position
4. restart the interval list from the first interval
5. set `currentAppliedInterval` to the first interval

This means both baselines become zero relative to the newly accepted home key.

### Section edits and song mutations

The baseline offsets are defined numerically, not by reference to a specific Section object.

Therefore:

- adding Sections must not change any baseline offsets
- deleting Sections must not change any baseline offsets
- moving Sections must not change any baseline offsets

Rationale:

- the plugin's offset concept is relative to the song's transposed pitch state, not to the identity of whichever section used to occupy `sections[0]`

Example accepted by design:

1. original first Section was in C
2. plugin offset moves the Song to D, so offset is `2`
3. the original first Section is deleted
4. the former second Section becomes the new first Section and is currently in E
5. resetting by offset `2` should move that new first Section to D

That is correct because the removed old C section is no longer part of the song reality.

### External transposition while TransposePlugin is active

The user explicitly accepts non-deterministic advanced workflows here.

Design rule for this sprint:

- if something else transposes the Song while TransposePlugin is active, the plugin does not attempt to detect or correct for it
- subsequent reset calculations are relative to the plugin's own stored offsets plus whatever live song state the user has created by other means
- this is treated as an advanced-user feature, not a bug

This means offset tracking is intentionally not guaranteed to remain authoritative under external mutation.

### Persistence rules

The new baseline offsets are session-only.

Persisted song/plugin state should continue to include only the existing persisted plugin properties and manager-owned fields. No original offset, sequence baseline offset, or live offset should be written to disk.

Expected consequence:

- if the user saves while the Song is transposed, that saved song state is accepted as the new musical truth on next load
- on next load, the loaded state is both current zero and original zero for the new session

### Help and diagnostics

This sprint's summary/help output should include at least:

1. current interval
2. current offset from sequence baseline
3. original offset or original baseline marker

The exact string format can be chosen during implementation, but the summary must make the two reset concepts visible enough that the warning/help text is understandable during live use.

### Bury warning behavior

Current bury warnings should continue to function.

Minimum requirement for the new warning:

- if a concise warning can include the relevant offset and interval values, include them
- the warning should still offer the same accept-or-abort path used today

The exact warning text can be finalized during implementation so long as it reflects the separated reset semantics.

### Menu implementation consequences

The current TransposePlugin menu is largely metadata-driven through `properties.json` and `PluginProperty`.

Because Reset now has action children, the plugin will likely need a custom menu subtree for the Reset branch instead of expressing the whole plugin menu purely through property metadata.

That is acceptable and expected.

Implementation may take either of these approaches:

1. keep most properties metadata-driven and inject a custom Reset subtree from `getVisibleMenuChildren()`
2. move more of the TransposePlugin menu construction into custom code if that proves simpler

The recommended approach is option 1 to minimize churn.

The intended top-level menu order under TransposePlugin is:

1. Enable
2. Load
3. Bury
4. Apply
5. Reset
6. help
7. intervals
8. remaining non-action properties

The top-level triggers for the plugin-owned portion are:

1. `A` for Apply
2. `R` for Reset
3. `h` for help
4. `i` for intervals
5. then the existing remaining property triggers

`Reset` is not itself the old direct reset action after this change. Choosing `Reset` enters a submenu.

The Reset submenu order is:

1. `o` original
2. `c` current interval
3. `s` set original to current

Those lower-case submenu items are the real actions.

### Behavioral examples

#### Example A: accept a new home key

1. intervals are `[0,5,7]`
2. user starts in C-based song state
3. plugin advances until live song state is E-based
4. user chooses `Reset -> set original to current`
5. no notes move immediately
6. both baselines now treat E as home
7. next Apply moves E -> A
8. next Apply moves A -> B
9. next Apply moves B -> E

#### Example B: edit intervals without losing original reset

1. original home is C
2. plugin has moved live song state to D
3. user edits intervals
4. Song stays in D
5. sequence baseline becomes D
6. original baseline remains C
7. `Reset current interval` returns to D
8. `Reset original` returns to C

#### Example C: revive from graveyard

1. plugin is revived with some persisted properties
2. revived song state is accepted as the new live zero/original zero for the session
3. prior session offset history is discarded
4. future apply/reset actions operate relative to the revived state

### Test plan

The implementation should include focused Jest coverage for at least these cases:

1. intervals change no longer erases original reset ability
2. `Reset current interval` restores sequence baseline and restarts sequence
3. `Reset original` restores original baseline and restarts sequence
4. `Set original to current` rebases both baselines and restarts sequence
5. next Apply after rebase goes to the next interval from zero
6. song load with `enableOnSongLoad=true` establishes both baselines at loaded state
7. revive establishes both baselines at revived state
8. external section add/delete/move does not alter baseline offsets
9. summary/help strings expose both reset concepts
10. bury warning includes useful offset context without blocking existing flow

### Remaining implementation note

The resolved design intentionally treats all property writes as wake-up events for baseline capture. That includes non-transposing properties. This is broader than a strictly musical-action-only rule, but it is consistent with the chosen session model and with immediate awake-on-revive behavior.

### Recommended coding order

1. refactor TransposePlugin runtime state to separate live offset, original baseline, and sequence baseline
2. change interval-edit behavior so it rebases only the sequence baseline
3. add Reset submenu actions and wire them through custom menu-node generation
4. update help/summary strings to show the new reset model
5. update bury warning text
6. add Jest coverage for the new state transitions

This plan should be sufficient to drive the next coding pass once the open questions above are confirmed or accepted as written.

## Implementation plan for new feature: TransposePlugin allowed-variables

- The above sections were implemented 20260512.
- This section describes work planned on 20260513.
- This section describes an implementation plan called `TransposePlugin allowed-variables`

### Goal

Expose a very small, allowlisted set of caption-safe variables for TransposePlugin state and current-section key state.

This work is not intended to expose arbitrary plugin internals. It is intended to promote a few high-value derived values into the same approved-values pipeline already used for safe `${name}` expansion in section captions.

### Scope

This plan covers only:

1. variable naming
2. value meanings
3. empty-string gating rules
4. provider wiring strategy
5. implications for future implementation

This plan does not include code changes yet.

### Core design decision

The approved-values allowlist remains the publication boundary.

That means:

1. every new caption-safe token must have an explicit entry in `approved-values.js`
2. `rootKey` and `rootKeyLead` are general approved values and do not depend on any plugin
3. transpose-derived values are also explicit approved values, but their `resolve()` functions may delegate to a provider that reads TransposePlugin state

The earlier idea of a single monolithic TransposePlugin resolver function is now considered stale. The preferred design is:

1. explicit approved token names in `approved-values.js`
2. provider-backed resolution from bootstrap
3. implementation detail hidden behind small, read-only helper methods in TransposePlugin or a narrowly scoped transpose-caption helper

### Why this is the preferred shape

This keeps the safe-expansion contract intact:

1. section captions still expand only allowlisted names
2. `/vdv` and help generation still discover the same list automatically
3. values remain pull-based and therefore do not drift out of sync with plugin state
4. advanced users and programmers see exact published names rather than implicit plugin internals

### Naming alignment rule

Names that reuse the word `offset` should align with the TransposePlugin runtime meanings wherever practical.

Current plugin runtime meanings are:

1. `currentInterval`: current interval in the active interval list
2. `currentOffset`: offset from the current sequence baseline
3. `originalOffset`: offset from the original baseline

Therefore the approved caption tokens should:

1. reuse those names when they mean the same thing
2. avoid inventing new `offset` names when the concept is actually a root key or a formatted display string
3. use `total` only when explicitly describing a sum of distances not already named by the plugin

### General variables independent of TransposePlugin

These should be promoted as always-available approved values because they are properties of the current Section, not of TransposePlugin.

| User-facing token | Meaning | Source | Empty when |
| --- | --- | --- | --- |
| `rootKey` | Current section root key using section display naming | `Section.getRootKey()` | Never during normal song runtime |
| `rootKeyLead` | Current section lead key using section display naming | `Section.getRootKeyLead()` | Never during normal song runtime |

Notes:

1. these values should resolve independently of plugin enable state
2. these values should use section display naming, not raw note-name arrays, so sharps/flats stay aligned with the current section

### Proposed transpose-derived approved tokens

The table below separates user-facing token names from their internal meaning. The goal is programmer clarity first and caption usefulness second.

| User-facing token | Meaning | Suggested source concept | Empty when |
| --- | --- | --- | --- |
| `transposeCurrentInterval` | Current interval in the active TransposePlugin interval list | existing plugin `currentInterval` | plugin not enabled, not awake, or not musically meaningful yet |
| `transposeCurrentOffset` | Current offset from the current sequence baseline | existing plugin `currentOffset` | plugin not enabled, not awake, or current transpose state not musically meaningful |
| `transposeOriginalOffset` | Current offset from the original baseline | existing plugin `originalOffset` | plugin not enabled, not awake, or current transpose state not musically meaningful |
| `transposeOriginalRootKey` | Root key implied by undoing the original baseline offset from the current section root | derived from `rootKey` and `transposeOriginalOffset` | plugin not enabled, not awake, or original offset not musically meaningful |
| `transposeSequenceRootKey` | Root key implied by undoing the current sequence offset from the current section root | derived from `rootKey` and `transposeCurrentOffset` | plugin not enabled, not awake, or current offset not musically meaningful |
| `transposeFunctionSteps` | Comma-separated emphasized function-symbol steps for the currently active transpose chain | derived formatted display | plugin not enabled, not awake, or chain would be empty |
| `transposeDistanceSteps` | Comma-separated emphasized numeric distances for the currently active transpose chain | derived formatted display | plugin not enabled, not awake, or chain would be empty |
| `transposeFunctionDistanceSteps` | Comma-separated emphasized `Function+distance` steps for the currently active transpose chain | derived formatted display | plugin not enabled, not awake, or chain would be empty |
| `transposeProgressionFunctions` | Full caption fragment combining root keys with emphasized function steps | derived formatted display | plugin not enabled, not awake, or chain would be empty |
| `transposeProgressionDistances` | Full caption fragment combining root keys with emphasized numeric distances | derived formatted display | plugin not enabled, not awake, or chain would be empty |
| `transposeProgressionFunctionDistances` | Full caption fragment combining root keys with emphasized `Function+distance` steps | derived formatted display | plugin not enabled, not awake, or chain would be empty |

### Naming recommendations

These are the recommended names to review and either accept or adjust before coding.

1. prefer `transposeCurrentOffset` over new invented variants because it matches the plugin runtime meaning
2. prefer `transposeOriginalOffset` as the single published total-from-original offset name
3. do not publish a `transposeTotalOffset` alias in this sprint
4. prefer `transposeSequenceRootKey` over `transposeOffsetRootKey` because it aligns with the plugin term `current sequence baseline`
5. prefer `transposeProgressionFunctionDistances` over shorter but less clear spellings because this token is user-facing and should be understandable in `/vdv`

### Tokens not recommended

These proposed names are intentionally not recommended because they risk semantic drift from the plugin model.

| Proposed name to avoid | Reason |
| --- | --- |
| `transposeOffsetRootKey` | `offset` is ambiguous next to the plugin’s existing offset meanings |
| `transposeTotalOffset` | redundant with `transposeOriginalOffset` and adds another “total” concept |
| `transposeTotalDistance` | likely duplicates `transposeOriginalOffset` or a formatted step and adds another “total” concept |
| `transposeCurrentRootKey` | redundant with general `rootKey` |

### Derived musical chain

The planned transpose-derived caption values are based on this read-only chain:

1. `rootKey` is the current displayed section root key now
2. `transposeCurrentOffset` is the distance from sequence baseline root to current root
3. `transposeOriginalOffset` is the distance from original baseline root to current root
4. `transposeSequenceRootKey` is the root implied by subtracting `transposeCurrentOffset` from the current section root
5. `transposeOriginalRootKey` is the root implied by subtracting `transposeOriginalOffset` from the current section root

That gives a stable way to derive the display chain without introducing new persisted plugin state.

### Formatting model

The design calls for a small number of caption-ready formatted strings, not a generic report engine.

The emphasized wrapper is planned as:

1. prefix: `<em class="transposeProg">`
2. suffix: `</em>`

The function symbol vocabulary should reuse the existing function-symbol source rather than duplicating a second musical table.

Implementation note:

1. if `Function+distance` strings are needed, they should be derived from the function-symbol source plus the numeric distance
2. raw root keys should use section display naming so sharps/flats remain correct for the current section

### Empty-string gating rule

Transpose-derived approved values should return the empty string when the transpose state is not both available and meaningful.

Planned gating rule:

1. if TransposePlugin is not registered, return `''`
2. if TransposePlugin is not enabled, return `''`
3. if TransposePlugin is not awake, return `''`
4. if the requested display would be musically empty or trivial for the intended token, return `''`

This allows captions to stay visually clean when the plugin is idle.

General values `rootKey` and `rootKeyLead` are not subject to transpose-plugin gating.

### Provider strategy

The recommended strategy is:

1. add general providers in `approved-values.js` for `rootKey` and `rootKeyLead`
2. add one transpose-specific provider entry from bootstrap, but do not expose a generic plugin-value bridge for captions
3. keep each approved token explicit in `approvedValueEntries`

The transpose-specific provider may internally call narrowly scoped helper methods on TransposePlugin, but the public approved-values surface should remain a fixed allowlist.

This gives:

1. no stale push-synchronization problem
2. no widening of caption expansion to arbitrary plugin state
3. one published list for `/vdv`, help generation, and section-caption expansion

### Suggested implementation shape

When this is coded, the likely shape is:

1. `approved-values.js` gains approved entries for `rootKey` and `rootKeyLead`
2. `approved-values.js` also gains explicit approved entries for the accepted transpose-derived names
3. bootstrap installs a transpose-caption provider function alongside the existing approved-value providers
4. the provider reads TransposePlugin state and returns primitive or formatted values for those specific names only

This is preferred over:

1. pushing values from TransposePlugin into approved-values state
2. exposing generic `${plugin:...}` resolution in section captions
3. storing a second mirrored caption-state cache inside the plugin runtime

### Review questions before coding

These review decisions are now resolved for this sprint.

1. `transposeTotalOffset` will not be published; `transposeOriginalOffset` is the single total-from-original offset name
2. the derived root token name is `transposeSequenceRootKey`
3. all approved formatted transpose display values listed above are in scope for publication in this sprint
4. trivial transpose state should return `''`

### Recommendation summary

The recommended review baseline is:

1. publish `rootKey` and `rootKeyLead` as general approved values
2. publish `transposeCurrentInterval`, `transposeCurrentOffset`, and `transposeOriginalOffset` as the primary atomic transpose values
3. publish all approved formatted transpose display values listed in the table, except any removed `total` aliases
4. avoid introducing new offset names unless they align directly with existing plugin meanings
5. keep all published names explicit in `approvedValueEntries`






