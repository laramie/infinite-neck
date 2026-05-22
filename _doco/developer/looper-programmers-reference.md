# Looper Programmer's Reference

## Roadmap

This reference covers the current interaction among three modules:

- `looper.js`
- `looper-transport-timing.js`
- `looper-timing-select-handler.js`

The current design separates three concerns:

1. `looper.js` owns loop lifecycle and beat/section progression.
2. `looper-timing-select-handler.js` owns the UI event that flips timing mode.
3. `looper-transport-timing.js` owns transport-clock behavior when transport timing is installed.

At runtime there are two independent pieces of looper timing state in `looper.js`:

1. `looperTimingMode`
2. `looperTimingProviders`

Those two values are related but not identical.

- `looperTimingMode` says which timing policy the looper should currently use: `visual` or `transport`.
- `looperTimingProviders` is the currently installed provider object containing timing hooks.

That distinction matters because switching mode does not always replace the installed provider object.

### Initial startup state

When the module is first loaded:

- `looperTimingMode` is initialized to `LoopTimingMode.VISUAL`.
- `looperTimingProviders` is initialized to a copy of `defaultTimingProviders`.

So on first startup, Visual timing uses the default provider object from `looper.js` itself.

### After Transport has been installed once

When Transport timing is installed the first time, `installTransportTiming()` in `looper.js` does two things:

1. creates a transport provider object by calling `createLooperTransportTimingProviders()` from `looper-transport-timing.js`
2. installs that object via `setLooperTimingProviders()`

Then it sets the current mode to `LoopTimingMode.TRANSPORT`.

After that point, the installed provider object remains the transport provider object until something explicitly replaces it.

### Switching back to Visual

Switching back to Visual currently changes only `looperTimingMode`.

It does **not** reinstall `defaultTimingProviders`.

Instead, the currently installed transport provider remains installed, and `looper.js` uses `callTimingHook()` plus `providerSupportsTimingMode()` to decide whether a hook should actually be invoked.

Because the transport provider declares:

- `supportedTimingModes: ['transport']`

its hooks are skipped while `looperTimingMode === 'visual'`.

That is the core mental model for the current implementation.

## Start Path

This section documents the concrete functions involved when section looping starts.

The typical UI entry point is outside this trio, for example a keyboard command or button click that calls `toggleLoopSections()` in `looper.js`.

### Concrete call path when the looper starts

1. `toggleLoopSections()` in `looper.js`
2. `startLoopSections()` in `looper.js`
3. `callTimingHook('resetTimingState', { reason: 'start-loop', loopKind: 'sections' }, { ignoreTimingMode: true })` in `looper.js`
4. `showBPM()` in `looper.js`
5. `EventBus.trigger('Looper:OnLoopSectionsStart', ...)` in `looper.js`
6. `EventBus.trigger('DaCapo:OnSongBegin', ...)` in `looper.js`
7. `EventBus.trigger('DaCapo:OnSectionBegin', ...)` in `looper.js`
8. `scheduleNextBeatTick('sections')` in `looper.js`

### Concrete scheduling path after startup

Inside `scheduleNextBeatTick('sections')`:

1. `getSong()`
2. `buildTimingContext(...)`
3. `getEffectiveBeatDelayMillis(context)`
4. inside `getEffectiveBeatDelayMillis(context)`:
	- choose hook name:
	  - `getVisualDelayMillis` if current mode is Visual
	  - `getTransportDelayMillis` if current mode is Transport
	- call `callTimingHook(...)`
5. `callTimingHook('beforeScheduleNextTick', context)`
6. `startLoopTimer(() => runScheduledBeatTick(loopKind), delayMillis)`
7. `callTimingHook('afterScheduleNextTick', ...)`

### Concrete tick path after the timeout fires

When the timer fires:

1. `runScheduledBeatTick('sections')`
2. `buildTimingContext(...)`
3. `callTimingHook('beforeBeatTick', context)`
4. `tickBeat(song, { sectionsLooping: true, showBeats })`
5. `callTimingHook('afterBeatTick', { ...context, tickResult })`
6. `scheduleNextBeatTick('sections')`

### Mode-sensitive hook behavior at start time

At startup the hook target depends on current mode and whether Transport has ever been installed.

#### Visual at initial app load

- installed provider object: `defaultTimingProviders`
- active mode: `visual`
- visual hooks may run from `defaultTimingProviders`

#### Visual after Transport was previously installed

- installed provider object: transport provider from `looper-transport-timing.js`
- active mode: `visual`
- transport hooks are skipped by `callTimingHook()` because `supportedTimingModes` does not include `visual`

#### Transport

- installed provider object: transport provider from `looper-transport-timing.js`
- active mode: `transport`
- transport hooks are called normally

## Switch To Transport

This section documents the concrete functions involved when the user selects Transport Timing.

### UI entry point

The current UI entry point is:

1. `installLoopTimingModeControls()` in `looper-timing-select-handler.js`
2. radio click handler
3. inner function `applyLoopTimingMode('transport')`

### First switch to Transport

If Transport has never been installed in the current page session, this path runs:

1. `applyLoopTimingMode('transport')` in `looper-timing-select-handler.js`
2. `installTransportTiming()` in `looper.js`
3. `createLooperTransportTimingProviders(...)` in `looper-transport-timing.js`
4. `resolveTransportClock(...)` in `looper-transport-timing.js`
5. either:
	- `resolveWindowTransportClock(...)`, or
	- `fallbackNowFactory()`
6. return provider object from `createLooperTransportTimingProviders(...)`
7. `setLooperTimingProviders(providers)` in `looper.js`
8. `setLoopTimingMode(LoopTimingMode.TRANSPORT)` in `looper.js`
9. `transportTimingInstalled = true` in `looper-timing-select-handler.js`

### Subsequent switches to Transport

If Transport was already installed earlier in the session, this shorter path runs:

1. `applyLoopTimingMode('transport')` in `looper-timing-select-handler.js`
2. `setLoopTimingMode(LoopTimingMode.TRANSPORT)` in `looper.js`

No new provider object is created in that case.

### What changes when Transport is active

Once `looperTimingMode` becomes `transport`, `looper.js` changes which delay hook it asks for inside `getEffectiveBeatDelayMillis(context)`:

- it selects `getTransportDelayMillis`

Also, generic hooks like these become eligible to run against the transport provider:

- `beforeScheduleNextTick`
- `afterScheduleNextTick`
- `beforeBeatTick`
- `afterBeatTick`
- `beforeSectionTransition`
- `afterSectionTransition`

because `providerSupportsTimingMode('transport')` returns true for the installed transport provider.

## Switch To Visual

This section documents the concrete functions involved when the user selects Visual Timing.

### UI entry point

The current UI entry point is again:

1. `installLoopTimingModeControls()` in `looper-timing-select-handler.js`
2. radio click handler
3. inner function `applyLoopTimingMode('visual')`

### Concrete call path when switching to Visual

1. `applyLoopTimingMode('visual')` in `looper-timing-select-handler.js`
2. `setLoopTimingMode(LoopTimingMode.VISUAL)` in `looper.js`

That is the entire mode-switch path.

### What does **not** happen when switching to Visual

These functions are **not** called during a switch back to Visual:

- `setLooperTimingProviders(...)`
- `installTransportTiming()`
- `createLooperTransportTimingProviders(...)`
- `resolveTransportClock(...)`
- `resolveWindowTransportClock(...)`
- `fallbackNowFactory()`

Also, `defaultTimingProviders` is **not** reinstalled.

### What is installed after switching to Visual

If the page session has previously installed the transport provider, then after switching to Visual:

- installed provider object: still the transport provider object from `looper-transport-timing.js`
- active mode: `visual`

### Why the transport hooks stop firing in Visual

The suppression happens inside `callTimingHook()` in `looper.js`:

1. `callTimingHook(hookName, context, ...)`
2. `providerSupportsTimingMode(context.timingMode)`
3. read `looperTimingProviders.supportedTimingModes`
4. transport provider returns `['transport']`
5. `visual` is not included
6. hook invocation is skipped

So after switching back to Visual, the transport provider is still installed but mode-gated off.

### Visual delay selection after switching back from Transport

During scheduling, `getEffectiveBeatDelayMillis(context)` now chooses:

- `getVisualDelayMillis`

But because the installed provider object is still the transport provider, and because that provider does not support Visual mode, `callTimingHook('getVisualDelayMillis', context)` returns `undefined`.

Then `getEffectiveBeatDelayMillis(context)` falls back to:

- `context.defaultDelayMillis`

which is the beat duration from `getMillisForBeatClock()`.

That is why Visual timing still works even though `defaultTimingProviders` is not reinstalled.

## Practical Summary

For future maintenance, the shortest accurate summary is:

1. Initial Visual mode uses `defaultTimingProviders`.
2. First Transport install replaces the provider object with the transport provider.
3. Switching back to Visual does not restore the default provider object.
4. Visual works after that because `looper.js` gates transport hooks by mode and falls back to the default beat delay when no Visual hook returns a value.

If a future refactor wants Visual hooks to actively run again after returning from Transport, then one of these designs would need to be implemented:

1. reinstall `defaultTimingProviders` on switch to Visual
2. keep a composite provider object that supports both modes
3. add an explicit `installVisualTiming()` symmetric with `installTransportTiming()`
