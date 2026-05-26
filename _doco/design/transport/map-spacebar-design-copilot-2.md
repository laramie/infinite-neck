# Copilot Report: map spacebar, Iteration 2

## Summary

Iteration 2 is materially safer than Iteration 1.

The main reason is that Iteration 2 stops trying to make spacebar into a general-purpose transport simulator and instead splits the problem into two clearer buckets:

1. `ConvenienceMapping`: map spacebar to actions that already exist and already have acceptable behavior.
2. `NewActions`: add only the few missing actions that actually matter to the user workflow.

That narrowing is the right direction.

The remaining design risk is no longer the spacebar binding itself. The real remaining risk is semantic drift between:

- existing Song and Looper behavior
- plugin expectations around `DaCapo:OnSectionBegin` and `DaCapo:OnSongEnd`
- UI refresh behavior, especially DisplayOptions and replay/clear behavior

My recommendation for Iteration 2 is:

- treat `ConvenienceMapping` as direct aliases to existing actions
- keep the spacebar feature itself dumb and configuration-driven
- add new events only for reset-style semantics that are not already represented well today
- do not add new DaCapo events unless they represent an actual musical boundary that plugins should hear

In short: the spacebar feature is now reasonable, but only if the new actions are defined around existing runtime truths rather than around idealized transport states.

## What Still Matters From Iteration 1

Most of the earlier danger has been removed by the Iteration 2 simplification.

The parts that still matter are:

### 1. Song navigation is not the same thing as lifecycle events

That is still true.

Current code still separates:

- Song/UI state changes
- plugin lifecycle events

`Song.firstSection()`, `lastSection()`, `gotoSection()`, `gotoNextSection()`, and `gotoPrevSection()` primarily change state and trigger section/UI refresh behavior. They do not themselves define the full plugin lifecycle contract.

By contrast, `looper.js` still owns the canonical sequence for runtime musical boundaries:

- `DaCapo:OnSongBegin`
- `DaCapo:OnSectionBegin`
- `DaCapo:OnSectionEnd`
- `DaCapo:OnSongEnd`

So any new action that claims to be more than navigation still needs explicit semantics.

### 2. `DaCapo:OnSongEnd` remains sensitive

This also still matters.

`TransposePlugin` still listens to `DaCapo:OnSongEnd` and not to ordinary section navigation. That means any feature that fires `OnSongEnd` is not just moving transport state. It is asking plugins to commit end-of-song behavior.

That is why `RestartSong` and `ResetSong` should not fire `DaCapo:OnSongEnd`, and why `NextSongLoop` needs special care if it is kept.

### 3. DisplayOptions are still tied to section-change UI flow, not to DaCapo events

This is the biggest concrete code reality to keep in mind for Iteration 2.

Current behavior still routes section-display refresh through `sectionChanged()` in `infinite-neck.js`, which does these things:

- applies `displayOptionsToControls(options)` when present
- calls `clearAndReplaySection()`
- updates section status

That means the current app truth is still:

- UI section refresh is primarily driven by `SectionChanged`
- plugin musical lifecycle is driven separately by DaCapo events

So the design note is correct to flag this as a discussion point. It is not yet true that DisplayOptions are applied from `OnSectionBegin`.

## Analysis Of Iteration 2 By Category

## ConvenienceMapping

This part is low risk if it is implemented as strict aliasing to existing commands.

That means:

- spacebar should dispatch a stable internal action id
- that action id should call the same helper or command path as the existing keyboard or command-menu action
- no special-case spacebar-only semantics should be added for these mappings

That keeps the spacebar feature from becoming a second transport engine.

### Recommended scope for ConvenienceMapping

These are good candidates because they already correspond to existing behavior:

- toggle loop sections
- toggle loop beats
- next beat
- previous beat
- first section
- previous section
- next section
- last section

The new command-line menu additions for section and beat navigation fit this model well.

### Recommended rule

If an action already exists today, the mapped spacebar version should do exactly that action, no more and no less.

That includes keeping any current oddities.

If an existing action currently does not fire `DaCapo:OnSectionBegin`, the spacebar convenience mapping should not silently add that behavior. Otherwise the same action would have two meanings depending on how it was invoked.

That consistency matters more than theoretical elegance.

## NewActions

This is where the remaining design work really lives.

### RestartSong

This is the cleanest new action in Iteration 2.

Your clarified requirement is:

- go to song begin
- do not fire `DaCapo:OnSongEnd`
- skip all remaining beats and sections
- do not invent fake playback of skipped material

That is a coherent requirement.

My recommendation is:

- define `RestartSong` as a transport/navigation action, not as a DaCapo musical-boundary event
- do not add a new DaCapo event for it
- if you need an event, use a Looper/transport-scoped event such as `Looper:OnSongRestart`

Reasoning:

- restarting to the beginning without reaching the end is not a song-end musical event
- current plugins do not appear to need a special musical callback merely to observe a rewind
- adding a new DaCapo event without a real listener need will create architecture noise quickly

The most defensible semantics are:

- move to first section
- move to first beat
- update UI through the same section-change path the app already uses
- optionally emit `DaCapo:OnSongBegin` and `DaCapo:OnSectionBegin` if you want plugin authors to treat restart as a fresh musical start

The last bullet is the only real design choice left.

My advice is:

- if RestartSong is meant to behave like “we are now freshly at the beginning and plugins should prepare for play”, then fire `OnSongBegin` and `OnSectionBegin`
- if it is meant to be pure repositioning while stopped, do not fire them

Either choice is valid, but it should be explicit and used consistently everywhere, not only for spacebar.

### ResetSong

This is the strongest case for a genuinely new event.

Why it is different from `RestartSong`:

- `RestartSong` is transport position
- `ResetSong` is state clearing

That distinction is real and useful.

The design note already identifies the main current use-case correctly:

- Transpose has a normal reset and a hard reset
- Arpeggio and Fill want a clear-like behavior

So I recommend:

- add one reset event
- attach payload data, for example `{ hard: false }` or `{ hard: true }`
- keep it out of the DaCapo namespace unless you decide reset is musically meaningful rather than operational

Suggested shape:

- `Looper:OnSongReset` with `{ hard: false }`
- `Looper:OnSongReset` with `{ hard: true }`

This is better than separate `ResetSong` and `ResetSongHard` events because:

- it keeps the API smaller
- plugin authors only need one listener
- the hard/non-hard distinction stays explicit in data

### ArpeggioPlugin and FillPlugin on reset

Your proposal makes sense.

Arpeggio and Fill should respond to song reset by doing their clear behavior. That is a good fit for a reset event, and it avoids overloading ordinary section navigation with clearing semantics.

I agree with this part of the design.

### Transpose on reset

The design also makes sense here.

Transpose currently treats end-of-song and reset as conceptually different. That is correct.

Recommended semantics:

- ordinary reset returns to the current session baseline, such as `intervals[0]`
- hard reset returns to original baseline/original session state

That matches the current Transpose model much better than trying to infer reset mode from `OnSongBegin` or `OnSongEnd`.

### NextSongLoop

This is still the shakiest remaining idea.

The requirement is understandable:

- skip forward to the next song begin after song end
- do fire `DaCapo:OnSongEnd`
- do not simulate skipped intermediate sections or beats

The reason this remains risky is that it mixes three concerns at once:

- logical end-of-song
- wrap to beginning
- continued looping intent

It is still more complex than the other Iteration 2 items, and it is not part of the proposed spacebar mapping menu shown later in the design note.

So my recommendation is:

- do not include `NextSongLoop` in the first implementation wave for spacebar mapping
- keep it as a transport/looper follow-up if the looping workflow proves it is needed

That does not mean the idea is wrong. It means it is still the least stable item in the current proposal and should not block the cleaner parts.

## Event Namespace Recommendation

Your namespace question is important, and I think the direction in the note is right.

### Recommended meaning of namespaces

Use `DaCapo:` for musical boundary events that reflect musical lifecycle:

- song begins
- section begins
- section ends
- song ends

Use `Looper:` for transport or operational control events:

- reset song
- restart song
- start or stop loop modes
- transport-originated state reset

This separation is valuable because `ResetSong` is not the same kind of thing as `OnSongEnd`.

If you keep that line clean, plugin authors will understand whether they are responding to music flow or to transport management.

### Concrete recommendation

Do not add:

- `DaCapo:OnSongReset`
- `DaCapo:OnSongRestart`

Prefer:

- `Looper:OnSongReset`
- optionally `Looper:OnSongRestart`

Or, if restart is implemented purely as navigation, do not add a restart event at all.

## DisplayOptions And UI Semantics

The design note says DisplayOptions should probably be applied on `OnSectionBegin`, but current code does not work that way yet.

At the moment, DisplayOptions are still effectively part of section-change UI handling.

That means two practical recommendations follow.

### 1. Do not block Iteration 2 on a DisplayOptions event-system migration

That migration may be a good refactor, but it is a larger concern than the spacebar feature.

The spacebar and new menu actions can still be designed correctly if they route through the same section-change behavior already used elsewhere.

### 2. Be explicit that “musical begin” and “UI section refresh” are separate for now

That avoids confusion later.

For example, a `RestartSong` implementation might intentionally do both:

- section/UI refresh through existing section-change logic
- optional musical lifecycle begin events for plugins

Those should be treated as two deliberate steps, not as one accidental side effect.

## Looper States Table Review

The table is useful, but a few lines should be interpreted carefully.

### `SongBegin` versus `FirstSection`

In the current app these are close, but not identical concepts.

- `FirstSection` is a location
- `SongBegin` is a lifecycle concept, especially if plugins care about begin events

That distinction matters when deciding whether a command should only navigate or also emit begin events.

### `RestartSong`

The table marks this as effectively available through first section. That is true only for position, not for dedicated semantics.

So the gap is real, but it is not a UI gap. It is a semantics gap.

### `SectionBegin` and `FirstBeat`

The note is correct that there is value in distinguishing them conceptually.

In current code, many paths already assume replay starts from beat 1 during section refresh. That means a separate explicit “go to beat 1” action may be less urgent than it appears, provided restart actions continue to use the existing replay path.

## Command-Line Menu Analysis

Iteration 2 improves the command-menu design.

### Using alphabetic triggers for map-spacebar is better

This removes the earlier concern around literal `<` and `>` menu triggers.

Even though those characters were probably workable, alphabetic triggers are clearer and less fragile in captions and documentation.

So the new structure:

- `/fmR`
- `/fmr`
- `/fmz`
- `/fmZ`
- `/fmu`

is better than the earlier symbol-based variant.

### `gotoBeat n` and `gotoSection n`

These additions make sense and align with the Iteration 2 goal.

They are useful independent of the spacebar feature, and they fit the “command-line only, no HTML UI changes” constraint well.

They are also lower risk than adding more synthetic transport actions, because they are explicit navigation commands.

## Recommended Implementation Direction

If and when you implement this, I recommend the following model.

### 1. Keep spacebar mapping configuration separate from action semantics

Menu items should only set a stable mapping value, for example:

- `none`
- `restartSong`
- `restartSection`
- `resetSong`
- `resetSongHard`
- existing convenience actions such as `nextBeat` or `nextSection`

Then `key-handlers.js` should dispatch that value.

### 2. Reuse existing action paths for ConvenienceMapping

Do not create spacebar-only implementations for actions that already exist.

### 3. Centralize the genuinely new actions

Implement `RestartSong`, `ResetSong`, and any later `NextSongLoop` in one transport helper area so that:

- UI updates
- section/beat positioning
- loop clearing decisions
- event emission

are all defined in one place.

That is the only safe way to keep later plugin behavior coherent.

### 4. Decide loop-state policy explicitly

The note says navigation is allowed at all times, including during looping and beat looping.

That is a valid product decision, but the implementation should still define what happens to active loop mode when such an action occurs.

My recommendation is:

- restart and reset actions should clear active looping first
- pure loop toggles should continue to use the current loop functions directly
- ordinary navigation convenience actions should match their existing current behavior exactly

That keeps behavior predictable.

## Specific Answers To Iteration 2

### Is Iteration 2 a better scope than Iteration 1?

Yes. Much better.

It cuts away most of the earlier unstable ideas and leaves a smaller set that can be defined cleanly.

### Should `RestartSong` probably be its own event?

Not necessarily.

It should definitely be its own action.

It only needs its own event if plugin authors actually need to distinguish restart from plain navigation. Based on the current plugins, that case is not yet proven.

### Should `ResetSong` probably be its own event?

Yes.

This is the clearest case for a new event because it means “clear state,” not just “move transport position.”

### Should the new reset event live under DaCapo?

No, probably not.

`ResetSong` is better modeled as transport/operational state, so `Looper:` is the cleaner namespace.

### Does the earlier `<` and `>` trigger concern still matter?

Not materially.

Iteration 2’s alphabetic menu triggers avoid the issue entirely.

### Should Iteration 2 keep `NextSongLoop` in scope now?

I would postpone it.

It remains the least settled and highest-risk item, and it is not necessary to deliver the improved spacebar mapping and reset model.

## Bottom Line

Iteration 2 is a sound correction.

The strongest parts of the design are:

- using spacebar as a configurable alias layer rather than a new transport system
- separating convenience mappings from genuinely new actions
- introducing reset semantics explicitly rather than trying to overload song-end behavior
- moving away from symbolic menu triggers to letter triggers

The main remaining recommendation is to be strict about semantics:

- navigation actions stay navigation
- reset actions get a dedicated reset event
- `DaCapo:OnSongEnd` stays reserved for actual song-end meaning
- `NextSongLoop` waits until there is a stronger need and a cleaner transport story

If you keep those boundaries, Iteration 2 should be implementable without reintroducing the instability that Iteration 1 exposed.
