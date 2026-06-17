# Palette Mode Implementation Checklist

date: 20260609

## Purpose

This checklist defines the minimum safe implementation for replacing the special `rbColor` states with a separate four-way palette mode group.

## Files In Scope

Primary runtime files:
- `presentation.js`
- `templates/palette.html`
- `templates/palette.css`
- `templates/palette.builder.js`
- `infinite-neck.js`
- `NoteTableController.js`
- `key-handlers.js`
- `menu.js`

Tests:
- `_tests/jest/presentation.test.js`
- `_tests/jest/key-handlers.test.js`
- `_tests/jest/note-table-controller-*.test.js`

## Phase 1. Presentation state

1. Add explicit palette mode state:
   - `paint`
   - `clear`
   - `keep`
   - `dropper`
2. Keep remembered paint color state.
3. Keep remembered restorable note-type state.
4. Add helpers for:
   - getting mode
   - setting mode
   - entering each mode
   - restoring remembered paint state
   - checking whether any restorable note type is currently selected
   - updating the mode-group UI and cyan highlight state

Acceptance:
- no controller logic needs to read `noteClear`, `noteKeep`, or `noteDropper` from `rbColor` after migration is complete

## Phase 2. Palette UI replacement

1. Replace the current special `rbColor` controls in `templates/palette.html`:
   - remove `idClear` as an `rbColor`
   - remove `idKeep` as an `rbColor`
   - remove `idDropper` as an `rbColor`
   - replace the standalone restore button with the new paint-mode control in the same group
2. Introduce a separate radio group such as `rbPaletteMode`.
3. Preserve the dynamic `Color: <caption>` label.
4. Preserve cyan mode highlights.

Acceptance:
- exactly one mode entry is active at a time
- paint-mode entry remains always visible near AutoColor

## Phase 3. Palette event routing

1. Add one central mode-group change handler.
2. Move cursor updates under explicit mode handling.
3. Keep role/color remembering attached to real `rbColor` selections only.
4. Keep note-type remembering attached to restorable `rbHighlight` selections only.
5. Keep Find Color success glow on the resolved paint radio.

Acceptance:
- mouse actions and programmatic actions follow the same mode transitions

## Phase 4. Controller migration

1. Update `NoteTableController.js` to branch on palette mode instead of fake special colors.
2. Preserve existing clear semantics for:
   - named notes
   - played notes
   - non-REC Pitch and Multi highlight clearing
3. Preserve dropper behavior.
4. Preserve keep behavior.
5. Preserve AutoColor paint resolution.

Acceptance:
- clicking cells in each mode yields the same intended behavior as before, but without reading fake special color values from `rbColor`

## Phase 5. Command-line migration

1. `/pn` note-type commands that imply painting must enter `paint` mode.
2. `/pnl` must route through the new paint-mode control.
3. `/pf` fingering commands must enter `paint` mode.
4. `/pr` role/color commands must enter `paint` mode.
5. `/pnc`, `/pnk`, `/pnf` must target explicit modes.
6. Bend subtype commands must also re-enter `paint` mode and select Bend.

Acceptance:
- command-line behavior matches mouse behavior for palette actions

## Phase 6. Remove legacy special-color dependencies

Search for and remove remaining runtime reads that depend on these fake paint values in `rbColor`:
- `noteClear`
- `noteKeep`
- `noteDropper`

Allowed remainder:
- migration shims during the implementation phase only

Acceptance:
- special-mode logic is driven by explicit palette mode helpers

## Phase 7. Tests

### Presentation tests

Add coverage for:
- mode transitions
- paint mode restoring remembered note type and color
- clear mode remembering and unchecking restorable note types
- cyan-mode alignment where appropriate

### Key-handler tests

Add coverage for:
- `/pn*` transitions under special modes
- `/pf*` entering paint mode
- `/pr*` entering paint mode
- `/pnl` routing through paint mode

### Controller tests

Add or update coverage for:
- clear mode
- keep mode
- dropper mode
- paint mode no longer depending on fake special colors

## Manual validation checklist

1. Mouse:
   - choose role/color, choose note type, place a note
   - switch to CLEAR, click a cell, then click paint mode
   - verify note type and remembered color/role restore correctly
2. Mouse:
   - AutoColor on
   - choose role, switch to CLEAR, then back to paint mode
   - verify dynamic paint caption still shows remembered role name
3. Mouse:
   - Find Color active
   - click a painted note
   - verify resolved `rbColor` gets cyan attention glow
4. Command-line:
   - `/pnn`, `/pns`, `/pnt`, `/pnb`, `/pnp`, `/pnm`, `/pnl`
   - `/pf*`
   - `/pr*`
5. Keyboard shortcuts:
   - direct palette-affecting shortcuts still behave consistently with mouse and command-line paths

## Smallest safe first implementation slice

If a full UI replacement is too large for one patch, the smallest safe slice is:
1. add explicit palette mode state in presentation
2. route controller and command-line through that state
3. keep a temporary compatibility layer for old special `rbColor` controls
4. replace the visible UI only after tests are green

That slice is acceptable only as a temporary migration phase, not as the final architecture.