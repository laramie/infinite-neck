# Globals Programmer's Reference

## Scope

This is not a full architecture note. It is a reminder that the repository currently has a few intentional globals or singleton-like module state objects that future work should treat carefully.

## `gPresentation` In `presentation.js`

`presentation.js` currently exports:

- `gPresentation`
- `PalettePresentation`

The current global object is:

```js
export const gPresentation = {
    palette: {
        lastRestorableColor: null,
        suppressRbColorRemember: false,
        keepWasForced: false
    }
};
```

Current assumptions:

- this object is page-session state, not persisted song state
- it currently exists to coordinate palette presentation behavior around `rbColor`
- it is shared module state, so callers should treat it as UI state with side effects, not as an immutable value object

Current palette fields:

- `lastRestorableColor`
  - remembered non-special `rbColor` selection
  - expected shape: `{ id, value, caption }`
- `suppressRbColorRemember`
  - temporary guard used while programmatically changing `rbColor`
- `keepWasForced`
  - tracks whether `noteKeep` was forced by presentation logic rather than chosen manually

Current API surface around that global:

- `PalettePresentation.initializePalettePresentation()`
- `PalettePresentation.rememberRestorableRbColor(...)`
- `PalettePresentation.restoreLastRbColor()`
- `PalettePresentation.selectRbColorByElement(...)`
- `PalettePresentation.updateRestoreRbColorButton()`

Practical rule:

- if a future feature needs more palette-session state, add it here intentionally and document the assumptions rather than letting similar state leak into multiple modules

## `gSong` In `infinite-neck.js`

`infinite-neck.js` currently keeps the active Song instance in file-local module state:

```js
var gSong = null;
export function getSong(){
    return gSong;
}
```

This is the canonical runtime Song object for the browser session and for headless test setup.

Current assumptions:

- there is one active Song per page session
- most modules do not import `Song` directly for the active model; they call `getSong()` via their provider wiring or directly from `infinite-neck.js`
- plugin runtime state is reloaded whenever `gSong` is replaced

Key lifecycle points:

- `openSong(str)`
  - constructs `gSong = new Song(jsonObj)`
  - calls `gSong.ensureDefaultSection()`
  - calls `pluginManager.loadSongPluginState(gSong)`
- `appInit()`
  - constructs a fresh browser Song and loads plugin runtime state against it
- `setupSongTests()`
  - constructs a fresh headless Song and loads plugin runtime state against it

Important implication:

- if code caches Song-derived state across `openSong()`, `appInit()`, or `setupSongTests()`, it may become stale when `gSong` is replaced

Practical rule:

- prefer `getSong()` access at use time rather than long-lived snapshots unless you are very sure the lifecycle is bounded

## Maintenance Note

The repository is not trying to eliminate all globals immediately.

The current practical goal is narrower:

- know which globals exist
- know what kind of state they hold
- keep new global state explicit and documented rather than accidental