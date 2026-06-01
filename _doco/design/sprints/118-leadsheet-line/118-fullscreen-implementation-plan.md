# Sprint 118 Fullscreen LeadSheetLine Implementation Plan

## Iteration Goal

This iteration is discussion-only and covers a proposed fullscreen-aware behavior for `LeadSheetLine`.

The goal is to make command-line `/cl` show the `LeadSheetLine` while preserving fullscreen mode, suppressing chart tab chrome, and keeping the `LeadSheetLine` visible until explicitly hidden with `/ch` or until fullscreen exits.

No code changes are part of this iteration.

## Desired User Behavior

The requested behavior is:

- entering fullscreen through the existing `f` keymap should continue to hide menu chrome and preserve the user’s fullscreen-oriented context
- running `/cl` while fullscreen is active should show `LeadSheetLine`
- that fullscreen `LeadSheetLine` should not show the `Chart` page or its tab controls
- showing the fullscreen `LeadSheetLine` should not exit fullscreen mode
- the fullscreen `LeadSheetLine` should stay visible across the normal redraw/update cycle until explicitly hidden
- a new command-line action `/ch` should hide that fullscreen `LeadSheetLine`
- `ESC` should continue to exit fullscreen mode
- if the `Chart` menu page was not open before fullscreen, exiting fullscreen should not force it open afterward

This is intentionally different from the current menu-page behavior, where `/cl` simply selects the `Line` tab in `#divChart`.

## Current Baseline

### Fullscreen semantics today

The current fullscreen model is built around hiding the main menu container:

- `enterFullscreen()` in `infinite-neck.js` hides `.container`
- `leaveFullscreen()` in `infinite-neck.js` shows `.container`
- `toggleFullscreen()` toggles `.container` visibility and also hides or restores other chrome such as caption rows and dock handles

This matters because `#divChart` lives inside `.container` in `index.html`.

So under the current structure, anything that depends on showing `#divChart` is structurally coupled to leaving fullscreen.

### Menu-show semantics today

The current menu primitive is `showOneMenu(strMenuDiv, forceOpen = false)` in `infinite-neck.js`.

It currently begins by calling `leaveFullscreen()`.

That means:

- pressing `r` exits fullscreen before showing `#divChart`
- running `/cl` exits fullscreen before showing `#divChart`
- this is not a bug in the chart code specifically; it is the generic menu-show contract

### Chart-tab semantics today

The chart tab strip, including the new `Line` tab, is embedded directly in the markup of `#divChart` in `index.html`.

So the current `printSectionsLine()` path does two things at once:

- selects the `Line` tab content
- shows the entire `Chart` menu page, including tab chrome

That is why the tab controls appear when `/cl` runs today.

### Remembered UI state today

The app already has some “remember what was showing” behavior, but it is not implemented as one generalized fullscreen-state model.

Examples:

- caption-row visibility is remembered through `getSong().captionsRowShowing`
- chart sub-tab selection is effectively remembered by DOM visibility inside `#divChart`, because `showChartTab()` toggles tab bodies and `hideAllMenuDivs()` hides the parent menu page without resetting the internal selected tab

So the existing system does have persistent UI memory, but it is fragmented and local rather than expressed as one central fullscreen object.

## Core Architectural Finding

The simplest safe approach is not to make `showOneMenu()` partially fullscreen-aware.

Instead, the safest approach is:

1. keep normal menu-page behavior unchanged
2. add a dedicated fullscreen-safe host for `LeadSheetLine` outside `.container`
3. let `/cl` branch based on whether fullscreen is active
4. let `/ch` hide the fullscreen `LeadSheetLine` without affecting fullscreen itself

This keeps menu behavior and fullscreen overlay behavior separate.

## Why This Is Simpler Than Reusing `#divChart`

Reusing `#divChart` for fullscreen creates three coupled problems:

1. `#divChart` is inside `.container`, which fullscreen intentionally hides
2. `showOneMenu()` intentionally exits fullscreen before showing a menu page
3. the chart tab strip is bundled into `#divChart`, so hiding tab chrome becomes a secondary special case on top of the fullscreen special case

Trying to preserve fullscreen while still using `showOneMenu("#divChart")` would likely force one or more of these less clean designs:

- add a `preserveFullscreen` parameter to `showOneMenu()` and then special-case menu visibility logic for chart-only callers
- move `#divChart` out of `.container`, which would alter the broader layout contract for menu pages
- hide only pieces of the chart menu page with CSS or conditional DOM logic while it is still being used as a normal menu container

All of those are more invasive than rendering into a separate fullscreen host.

## Recommended Implementation Direction

### Recommendation

Introduce a dedicated fullscreen overlay host for `LeadSheetLine`, outside `.container`, and treat it as a focused fullscreen presentation surface rather than as a menu page.

Recommended behavior:

- in non-fullscreen mode, `/cl` behaves exactly as it does today by showing `#divChart` and selecting `Line`
- in fullscreen mode, `/cl` does not call `showOneMenu()` and instead shows the fullscreen `LeadSheetLine` host
- `/ch` hides the fullscreen `LeadSheetLine` host
- `ESC` exits fullscreen and also clears the fullscreen `LeadSheetLine` host

### Why this aligns with the current app

This design preserves current contracts:

- `showOneMenu()` continues to mean “leave fullscreen and show a menu page”
- fullscreen continues to mean “hide `.container` and focus on non-menu surfaces”
- `LeadSheetLine` rendering remains owned by `section-printer.js`

It also keeps the special behavior local to the `LeadSheetLine` fullscreen use case, rather than making the whole menu system more complex.

## State Model Discussion

### The user requirement

The important new product requirement is that fullscreen should remember whether the `LeadSheetLine` is showing.

That means `/cl` is not just a transient “open this once” action. It becomes a mode-like toggle for fullscreen context.

### Narrow state approach

The narrowest useful implementation is a dedicated fullscreen `LeadSheetLine` state, for example conceptually:

- `isLeadSheetLineVisibleInFullscreen`

This could be held in runtime UI state and consulted when:

- entering or leaving fullscreen
- updating chart/transport views
- processing `/cl` and `/ch`

Advantages:

- minimal surface area
- no broad refactor required
- matches the immediate requirement closely

Disadvantages:

- another special-case UI memory flag is added to the app

### General fullscreen-state object approach

A broader refactor would introduce a more general fullscreen presentation-state object, conceptually something like:

- what overlay or focused view is active in fullscreen
- whether `LeadSheetLine` is visible
- perhaps later whether transport-only or another widget is pinned in fullscreen

Advantages:

- cleaner long-term architecture if multiple fullscreen overlays are expected
- centralizes fullscreen memory instead of scattering one-off booleans

Disadvantages:

- higher design and testing cost now
- adds abstraction before the app clearly needs more than one fullscreen-specific overlay mode

### Recommendation on state model

Do not do the large fullscreen-state refactor in this iteration unless more fullscreen-specific views are already planned.

The safer and simpler approach is:

- add a narrow runtime fullscreen `LeadSheetLine` visibility state now
- keep the code structured so that this state could later move into a more general fullscreen object if needed

That gives a low-risk path now without closing off a future refactor.

## Proposed Behavior For `/cl` And `/ch`

### `/cl`

Recommended behavior:

- if not fullscreen:
  - keep current behavior
  - call the existing `printSectionsLine()` path that shows `#divChart` with the `Line` tab selected
- if fullscreen:
  - mark the fullscreen `LeadSheetLine` as visible
  - render/update the fullscreen `LeadSheetLine` host
  - hide the command-line
  - do not show `#divChart`
  - do not leave fullscreen

### `/ch`

Recommended behavior:

- if fullscreen:
  - hide the fullscreen `LeadSheetLine` host
  - clear the fullscreen `LeadSheetLine` visibility state
  - keep fullscreen active
- if not fullscreen:
  - either do nothing with a short result message, or optionally route to hiding the `Chart` menu page if the user wants `/ch` to mean a broader “close chart” action

For simplicity, the narrower interpretation is better:

- `/cl` and `/ch` should manage the fullscreen `LeadSheetLine` only

That avoids conflating fullscreen overlay behavior with ordinary menu visibility.

## ESC Behavior

The requested `ESC` rule fits the current app well.

Today `ESC` already:

- leaves fullscreen
- hides command-line
- hides menu divs

Recommended refinement for the fullscreen `LeadSheetLine` feature:

- also hide the fullscreen `LeadSheetLine` host when `ESC` is pressed

This is consistent with the existing “ESC gets me back out of special viewing state” behavior.

The specific requirement that “if chart menu page wasn't up, then it would also not be up in non-full screen mode” is naturally satisfied by the dedicated-host approach, because fullscreen `LeadSheetLine` would not rely on `#divChart` at all.

That is a strong reason to avoid reusing the chart menu page for fullscreen.

## Rendering And Refresh Plan

### Renderer reuse

Reuse the existing `printLeadSheetLine(theSong, theSections)` renderer from `section-printer.js`.

That keeps one rendering source of truth for:

- current line calculation
- next line behavior
- section highlighting
- click-to-section behavior

### Refresh path

The fullscreen host should be refreshed by the same central repaint cycle that currently updates chart tabs.

That means the likely clean shape is:

- `updatePrintSections()` continues to rebuild chart tab bodies
- a neighboring helper rebuilds or hides the fullscreen `LeadSheetLine` host depending on fullscreen state and visibility state

This preserves the established “central redraw” architecture and avoids introducing a second bespoke event path.

## UI And DOM Plan

### New host element

Recommended new DOM element in `index.html`:

- a dedicated fullscreen `LeadSheetLine` host outside `.container`

It should:

- exist alongside other top-level non-menu UI elements
- be hidden by default
- not be part of the chart page tab strip

### CSS plan

The fullscreen host can likely reuse most of the existing `LeadSheetLine` CSS, but it should have a wrapper class or ID specific to fullscreen placement.

This allows:

- controlling z-index and placement independently of normal menu mode
- keeping the compact `LeadSheetLine` styling already implemented
- avoiding accidental dependency on chart menu layout styles

## Files Likely To Change In The Coding Iteration

### Definitely

- `index.html`
- `infinite-neck.js`
- `key-handlers.js`
- `menu.js`
- `section-printer.css`

### Likely

- `section-printer.js`

Only if a fullscreen-specific wrapper render helper is useful beyond reusing the current `printLeadSheetLine(...)` output as-is.

### Possibly

- `_tests/jest/chart-layout.test.js`
- a UI-focused test location if one exists for command-line or fullscreen behavior

## Testing Discussion

The highest-value tests would be:

1. `/cl` in normal mode still opens `#divChart` on `Line`
2. `/cl` in fullscreen does not call the normal menu path that exits fullscreen
3. fullscreen `LeadSheetLine` remains visible across redraws while its fullscreen-visible state is true
4. `/ch` hides the fullscreen `LeadSheetLine` without leaving fullscreen
5. `ESC` leaves fullscreen and also hides the fullscreen `LeadSheetLine`
6. if `#divChart` was not visible before fullscreen, exiting fullscreen after `/cl` does not unexpectedly show it

If automated UI testing is limited, some of these may remain manual verification steps.

## Risks And Edge Cases

### Risk: broadening `showOneMenu()` too much

If the implementation tries to make `showOneMenu()` itself fullscreen-preserving for certain callers, it risks changing the behavior of many unrelated menu flows.

That is the main reason this plan recommends a separate fullscreen host rather than a generalized change to menu-show semantics.

### Risk: state duplication

If the app tracks both:

- whether `#divChart` is showing in normal mode
- whether fullscreen `LeadSheetLine` is showing

then these states must not be treated as the same thing.

That is acceptable, but the naming and control flow should be explicit so normal menu state and fullscreen overlay state do not leak into one another.

### Risk: future fullscreen features

If more fullscreen-specific “pinned views” are expected soon, a one-off `LeadSheetLine` fullscreen flag may feel too narrow later.

This is a tradeoff:

- narrow state is simpler now
- generalized state is cleaner if more fullscreen overlays are imminent

## Recommended Decision Before Coding

The simplest safe implementation is:

- keep the normal `/cl` behavior outside fullscreen exactly as it is
- add a dedicated fullscreen host for `LeadSheetLine` outside `.container`
- add a narrow runtime state for whether fullscreen `LeadSheetLine` is visible
- make `/cl` show that fullscreen host when fullscreen is active
- add `/ch` to hide that fullscreen host while remaining in fullscreen
- keep `ESC` as the global fullscreen exit and also clear the fullscreen host
- do not refactor `showOneMenu()` into a partially fullscreen-aware primitive
- do not do a broad fullscreen-state-object refactor yet unless another fullscreen-specific overlay is already planned for the near future

This version is the best fit for code simplicity, local reasoning, and not breaking existing menu behavior.