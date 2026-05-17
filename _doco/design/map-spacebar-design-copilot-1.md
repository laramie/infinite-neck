# Copilot Report: map spacebar

## Summary

The proposed feature is reasonable, but the risky part is not the key binding itself. The risky part is making a manual spacebar action behave like the looper's existing runtime semantics so that:

- section transitions repaint correctly
- `DaCapo:OnSectionBegin` and `DaCapo:OnSongEnd` fire in the expected order
- plugins such as `TransposePlugin` see the same lifecycle they already depend on
- loop state does not end up half-running while a manual jump also changes section state

The safest implementation direction is:

1. add a configurable spacebar action state in `key-handlers.js`
2. expose a small set of dedicated action functions there
3. make the menu only configure that state
4. for the eventful actions, route through one narrow helper that performs the Song move and event emission in the correct order

That is better than trying to wire each menu item directly to ad hoc code paths.

## Current Runtime Facts

### Focus gating already matches the request

`document_keypress(e)` in `key-handlers.js` already exits early for `input` and `textarea`, so the current global-key pattern is already consistent with "do not fire while focus is in a control".

The design note says this behavior is desired, and the current architecture supports it naturally.

### The looper already defines the canonical event order

`looper.js` currently does these important things:

- on `startLoopSections()` it emits both:
	- `DaCapo:OnSongBegin`
	- `DaCapo:OnSectionBegin`
- on section boundary inside `tickBeat(...)` it emits:
	- `DaCapo:OnSectionEnd`
	- if wrapping past the last section, `DaCapo:OnSongEnd`
	- then `song.gotoNextSection(true)`
	- then `DaCapo:OnSectionBegin`

That means the current runtime already has a meaningful lifecycle contract. A manual spacebar action should reuse that contract rather than inventing a parallel one.

### Plain Song navigation methods do not emit DaCapo lifecycle events

`Song.firstSection()`, `lastSection()`, `prevSection()`, `nextSection()`, `gotoSection()`, `gotoNextSection()`, and `gotoPrevSection()` update section state and repaint, but they do not themselves emit `DaCapo:OnSectionBegin` or `DaCapo:OnSongEnd`.

So for the proposed manual actions, calling Song methods alone is not sufficient if the design expects plugin lifecycle events to run.

## Menu Trigger Analysis

### `<` and `>` do not appear to break command-menu handling

From the command-menu reference:

- triggers are single typed keys
- lowercase `x` is reserved for exit
- `/` is reserved to reset to root
- `Enter` is submission/navigation

There is no documented prohibition on `<` or `>` as triggers.

Also, the app already uses `<` and `>` as direct keyboard shortcuts in `document_keypress(e)`:

- `<` goes to first section
- `>` goes to last section

So those characters are already accepted by the keyboard layer.

### One practical caution: captions are HTML

`caption` is an HTML string in the menu model. So if the visible menu text wants to show `<` or `>`, the caption should use escaped HTML:

- `&lt;`
- `&gt;`

The `trigger` value itself can still be the literal character `<` or `>`.

So the answer is:

- trigger values `<` and `>` are probably fine
- visible caption text should escape them

## Action-By-Action Analysis

### `l) toggle looping`

Low risk.

This already maps naturally onto `toggleLoopSections()` in `looper.js`.

This is the cleanest case because it reuses existing transport behavior rather than simulating it.

### `b) toggle beat looping`

Low risk.

This already maps naturally onto `toggleLoopBeats()`.

### `n) next beat`

Low-to-medium risk.

This likely wants the same behavior as the existing `N` keyboard shortcut, which currently calls `getSong().nextBeat()`.

The main question is whether the mapped spacebar action should behave exactly like that existing shortcut, or whether it should be transport-aware in a stronger sense. If exact parity with current manual next-beat behavior is desired, the risk is low.

### `>) next section`

Medium risk.

The design explicitly says:

- section is advanced
- `DaCapo:OnSectionBegin` is fired

That is not what plain `Song.gotoNextSection(...)` does by itself. The action must either:

1. call the Song section-change path and then explicitly fire `DaCapo:OnSectionBegin`, or
2. better, call a shared helper that reproduces the same order used by `looper.tickBeat(...)`

This matters because plugins that listen to `DaCapo:OnSectionBegin` are depending on that event, not just on the visual section change.

### `<) restart section`

Medium-to-high risk.

Conceptually this is simple: stay on the current section and re-fire section-begin semantics.

But there are two tricky parts:

1. The Song API does not expose a single semantic "restart current section at beat 1 and replay everything" helper in the same way the looper defines a boundary transition.
2. The request says "If possible without a bunch of wacky or brittle coding, reset at first beat. Otherwise, don't implement or install menu item."

That second clause is correct. This action should be treated as optional unless there is a clean path that:

- resets to beat 1
- refreshes UI consistently
- emits `DaCapo:OnSectionBegin`
- does not duplicate fragile replay logic from elsewhere

If implementation requires scattered calls into UI internals, it should be omitted.

### `s) song restart`

High risk.

The design expects:

- `DaCapo:OnSongEnd` fires
- song restarts from section 0
- sequencing may need care so plugins like `TransposePlugin` work correctly

That concern is real.

`TransposePlugin` currently listens to `DaCapo:OnSongEnd`. So if "song restart" means "pretend we reached song end, then immediately return to the beginning", the event ordering is important.

The main ambiguity is whether plugin end-of-song work should happen:

- before the section is reset to 0
- before beat is reset to 1
- before looping state is restarted

If this is implemented, the helper should explicitly define and preserve the sequence. The safest sequence is probably:

1. stop/clear current loop state if needed
2. emit `DaCapo:OnSongEnd` against the current end-of-run state
3. move Song to section 0 and beat 1
4. repaint current section
5. emit `DaCapo:OnSectionBegin` for section 0 if the restart is supposed to establish a fresh active section lifecycle

Without that kind of sequencing, plugins may observe a confusing hybrid state.

### `e) song end`

High risk and questionable value.

The design already notes this might be weird, and that is accurate.

If this means:

- emit `DaCapo:OnSongEnd`
- park at last section

then there is an immediate semantic question: is this an actual transition to the last section, or just an "end now" signal from wherever the user currently is?

Those are different behaviors.

If the app moves to the last section first and then fires `OnSongEnd`, plugins may observe a different section than the one the user was actually on.

If the app fires `OnSongEnd` immediately and then moves to the last section, plugins see the current state, but the final parked UI state differs from the event state.

So this action is implementable, but only if the product meaning is nailed down first. As written, it is underspecified.

### `z) zero spacebar action`

Low risk.

This should simply clear the configured mapping and cause the spacebar handler to no-op.

This is the right default/fallback behavior.

## Event and Plugin Risk Analysis

### The main failure mode is "visual move happened, lifecycle did not"

If a manual spacebar section action only changes Song state and repaint, but does not emit the lifecycle event, plugins that depend on `DaCapo:OnSectionBegin` or `DaCapo:OnSongEnd` will silently fail to do their work.

That would produce confusing partial behavior:

- the section visibly changed
- but plugin state did not update

This is the most important correctness risk in the design.

### The next failure mode is "lifecycle fired in the wrong order"

`DaCapo:OnSongEnd` is especially sensitive because it is conceptually a boundary event. If a helper moves section state first and fires later, plugins will treat the post-move state as the end-of-song state.

That may be wrong for `TransposePlugin` and for future plugins.

### Looping state can become ambiguous

If spacebar actions are allowed while sections looping or beats looping is active, the design should decide whether those actions:

- stop looping first
- operate inside the current loop mode
- are ignored while looping is active

Without a rule here, manual actions can race conceptually with scheduled looper ticks.

The simplest policy is:

- for transport-mutating actions like next section, restart section, song restart, song end: clear loop state first
- for pure toggles, call the existing looper toggles directly

That avoids mixed ownership of transport state.

## Recommended Implementation Direction

### 1. Treat the feature as two layers

Layer 1: configuration through command menu

- add static menu items under `run -> map spacebar handler`
- each item stores an action ID such as `toggleLoopSections`, `nextBeat`, `nextSection`, `restartSection`, `songRestart`, `songEnd`, `none`

Layer 2: runtime key behavior

- `document_keypress(e)` checks for spacebar when not focused in a control
- it dispatches the currently configured action ID

That separation is cleaner than trying to make the menu tree itself be the runtime action engine.

### 2. Use stable action IDs, not caption text

Do not key behavior off visible menu text like `'song restart'`.

Use a stable internal value per action. Visible menu captions can change later without breaking behavior.

### 3. Centralize eventful transport actions

For these actions:

- next section
- restart section
- song restart
- song end

use one helper in `key-handlers.js` or a transport helper module that owns:

- loop clearing if needed
- Song movement
- repaint/replay
- event firing order

That will prevent drift between similar actions.

### 4. Be conservative about implementing `restart section` and `song end`

These are the two most semantically awkward actions.

My recommendation:

- implement `next section`, `toggle looping`, `toggle beat looping`, `next beat`, and `zero action` first
- only implement `restart section` and `song end` if a clean helper emerges naturally

That aligns with the design note's own caution.

## Specific Answers To The Request

### Where firing events may miss the intended design

The intended design will be missed if manual spacebar actions:

- move Song state without emitting `DaCapo:OnSectionBegin`
- emit `DaCapo:OnSongEnd` after already mutating section state into a new location
- leave looping active while also doing manual transport jumps

### Where the design may break looping or plugins

Potential break points:

- `TransposePlugin` currently listens to `DaCapo:OnSongEnd`, so song-restart and song-end sequencing matters.
- Any plugin listening to `DaCapo:OnSectionBegin` will miss work if manual next-section or restart-section actions only repaint and do not emit the event.
- Running a manual transport jump while the looper is active could produce mixed state unless loop ownership is resolved first.

### Whether `<` or `>` would break menu handling

Probably not.

They appear safe as trigger values because:

- command-menu reserves `x`, `/`, and `Enter`, not `<` or `>`
- the app already uses `<` and `>` as direct keyboard shortcuts

But the visible `caption` should HTML-escape them as `&lt;` and `&gt;`.

## Bottom Line

The feature is viable.

The design is strongest if it is treated as:

- a configurable spacebar binding
- backed by a small transport-action dispatcher
- with eventful actions routed through one canonical helper

The main technical warning is to avoid implementing section/songs jumps as raw Song mutations without matching the looper's event lifecycle.
