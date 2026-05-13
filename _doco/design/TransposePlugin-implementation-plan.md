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
4. when the plugin is revived from graveyard state and then first acts under that revived state

Important consequence:

- simply opening the plugin menu does not capture a baseline
- simply existing in registered runtime does not capture a baseline
- changing even a non-transposing property such as `doLeadKey` is considered sufficient to wake the plugin and establish its baseline

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

### Open questions and possible inconsistencies

These are the remaining places where the design may still need explicit confirmation before coding.

#### 1. Exact wake-up moment versus passive property edits

The current answer says the plugin wakes when the user enables it or sets any other property. That is coherent, but it means a user can establish session baseline by changing a non-transposing property such as `doLeadKey` or `NamedNotes` before ever transposing anything.

Question:

- do we explicitly want that behavior, or do we want wake-up only on the first action that could affect transposition flow such as enable, apply, reset, intervals change, or event-driven apply?

Current plan assumes the broader rule: any property set wakes the plugin.

#### 2. What exactly counts as revived but asleep

The chat says graveyard revive resets position and makes the monster alive but asleep. The earlier clarification also says revive from graveyard makes the current state the zero/original state.

Those are mostly compatible, but implementation needs one precise rule:

- does revive itself capture the baseline immediately, or does revive merely clear prior session state and wait until the first subsequent enable/property/action step to capture baseline?

Current plan assumes: revive discards prior offset history and the revived state becomes the effective zero/original state for the new session.

#### 3. Apply semantics when the interval list does not contain zero

The chat notes current behavior is a bit weird when the list lacks `0`, and suggests the intended behavior should be defined relative to wherever offset zero currently is.

Question:

- do we want to require that interval lists include `0`, or explicitly support interval lists without `0` by treating the first list item as the first target reached from the current zero baseline?

Current plan assumes no hard requirement that the list include `0`.

### Recommended coding order

1. refactor TransposePlugin runtime state to separate live offset, original baseline, and sequence baseline
2. change interval-edit behavior so it rebases only the sequence baseline
3. add Reset submenu actions and wire them through custom menu-node generation
4. update help/summary strings to show the new reset model
5. update bury warning text
6. add Jest coverage for the new state transitions

This plan should be sufficient to drive the next coding pass once the open questions above are confirmed or accepted as written.


