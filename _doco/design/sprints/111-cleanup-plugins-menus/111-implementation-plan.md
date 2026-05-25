# Implementation plan for sprint-111-cleanup-plugins-menus

## Iteration 1 goal

Iteration 1 produces the implementation plan only. No code changes are part of this iteration.

This plan covers the items marked in-scope in [111-design.md](111-design.md) and explicitly leaves the design document's `TODO later` items out of the coding plan for this pass.

## Scope to implement in the coding iteration

1. Normalize plugin menu labels and submenu structure across ArpeggioPlugin, FillPlugin, MovePlugin, and ClipPlugin.
2. Add the requested global key mappings that connect directly to plugin command-line flows.
3. Change `/vdm` menu dump formatting so it can be pasted into or mirrored by `help.html` without the current indentation artifacts.
4. Update `help.html` so the new keymaps, plugin menus, and menu dump behavior are documented consistently.

## Out of scope for this sprint iteration

- Menu audit tooling described under `TODO later` in the design.
- Function symbol parser / `eval()` follow-up.
- Expanded `CLEAR` chooser behavior.
- Highlight clearing documentation outside the specific help updates required by this sprint.

## Implementation approach

### 1. Plugin menu normalization

#### ArpeggioPlugin

Planned work:

- Rename `Target table` to `Table` while preserving the current trigger and target-table behavior.
- Move `help` to the end of the plugin menu.
- Reassign `style` from trigger `s` to trigger `y` so `s` is available for `strings`.
- Keep `positions` as a top-level submenu, but change its caption to show a computed summary value.
- Add a top-level `strings` submenu that shows a computed `upper:lower` summary using user-facing string numbers.
- Move `minFret` and `maxFret` out of the root menu and into the `positions` submenu.
- Move `upper string limit` and `lower string limit` out of the root menu and into the new `strings` submenu.
- Preserve the existing position-management actions already present in the plugin where they match the design: clear section values, copy section values, refresh values, and show current section values.

Likely files:

- `plugins/arpeggio/properties.json`
- `plugins/arpeggio/ArpeggioPlugin.js`
- Possibly `plugins/PluginProperty.js` or `plugins/PluginManager.js` only if current menu node generation cannot express the required summary captions cleanly

Implementation notes:

- Arpeggio already has custom runtime menu construction, so this is not just a property JSON rename.
- The top-level `positions` and `strings` captions should be driven by resolver tokens so they always reflect current state.
- Trigger assignments must continue to avoid `x`, which is globally reserved for menu exit.

#### FillPlugin

Planned work:

- Rename `Target table` to `Table`.
- Keep the existing `options` submenu at the plugin root.
- Change `options` so `minFret` and `maxFret` are grouped under a `positions` submenu with a `[min:max]` summary.
- Change `options` so `upper string limit` and `lower string limit` are grouped under a `strings` submenu with a `[upper:lower]` summary.
- Leave the rest of the existing family submenus (`NamedNote`, `SingleNote`, `TinyNote`) in place.

Likely files:

- `plugins/fill/properties.json`
- `plugins/fill/FillPlugin.js`

Implementation notes:

- FillPlugin already builds its own `options` menu in code, so the grouping work belongs primarily in `FillPlugin.js`.
- String summaries should display human-facing string numbers, not the plugin's zero-based stored row indexes.

#### MovePlugin

Planned work:

- Rename `Target table` to `Table` with no behavior change.

Likely files:

- `plugins/move/properties.json`
- Possibly `plugins/move/MovePlugin.js` only if the caption is overridden in runtime menu construction

#### ClipPlugin

Planned work:

- Rename `Target table` to `Table` with no behavior change.

Likely files:

- `plugins/clip/properties.json`
- Possibly `plugins/clip/ClipPlugin.js` only if the caption is overridden in runtime menu construction

### 2. Global key mapping changes

Planned work:

- Change uppercase `P` so it no longer toggles the Palette and instead opens the command-line parked at `/fp`.
- Keep lowercase `p` mapped to Palette.
- Add uppercase `C` to park the user on the ClipPlugin command-line menu.
- Keep lowercase `c` mapped to auto-color.
- Change uppercase `S` so it performs the same end-user effect as `/sax` without diverting the user into command-line flow.
- Keep lowercase `s` mapped to the Section drawer.
- In `txtCmdLine`, map `Shift+ArrowDown` and `Shift+ArrowUp` to the same short-menu behavior as `/vms` without ejecting the user from command-line input.
- Preserve the existing unshifted `ArrowUp` and `ArrowDown` command-line behavior for `/vmt` and `/vmo`.

Likely files:

- `key-handlers.js`
- `command-line.js` if command-line focus helpers or parked-menu helpers need extension

Implementation notes:

- Global `P`, `C`, and `S` currently live in the main keyboard handler and will need to be split from their lowercase behaviors.
- Arrow-key handling will likely need to be implemented in `keydown`, not `keypress`, because the current short-menu behavior is not character input.
- The implementation should reuse existing command/menu actions rather than duplicating plugin logic in key handlers.

### 3. `/vdm` menu dump formatting

Planned work:

- Replace the current hyphen-based indentation in `dumpMenus()` with indentation that renders correctly in help content.
- Remove the trailing `>` currently appended at the end of each dumped line.
- Make the output compatible with a `PRE` block or equivalent white-space-preserving container.

Likely files:

- `menu.js`
- `help.html`

Implementation notes:

- The current implementation emits `----` indentation and a `:>` suffix from `showChildMenusRecursively()`.
- The design calls for `&nbsp;` indentation, so the output format should be intentionally HTML-aware if it is going to be pasted directly into `help.html`.
- The updated dump should still preserve the existing bold trigger markup already present in menu captions.

### 4. `help.html` updates

Planned work:

- Update the keymap tables so `P`, `C`, and `S` reflect the new meanings.
- Update the command-line menu help where `/vdm` is described.
- Update the static menu-dump example so it matches the new live formatting.
- Update the ArpeggioPlugin help section to show the new root-level menu order and new `positions` and `strings` structure.
- Update the FillPlugin help section to show the new `options` submenu structure.
- Update MovePlugin and ClipPlugin help text anywhere `Target table` is shown so the label is now `Table`.
- Update any plugin keyboard/menu reminder sections that mention the old shortcuts.

Likely files:

- `help.html`

Implementation notes:

- This file already contains both keymap tables and plugin-specific help sections, so the documentation changes should be kept together in the same coding pass.
- The `/vdm` sample in help should be regenerated or rewritten immediately after the formatter change so the example does not drift.

## Suggested coding order

1. Update ArpeggioPlugin menu structure and summaries.
2. Update FillPlugin menu structure and summaries.
3. Rename `Target table` to `Table` in MovePlugin and ClipPlugin.
4. Implement the global keybinding changes.
5. Fix `/vdm` formatting.
6. Update `help.html` after the runtime behavior is stable.
7. Run focused validation and manual checks.

This order keeps the documentation update last, after the final menu text and key behavior are known.

## Validation plan for the coding iteration

### Manual verification

- Open the command-line plugin menus and confirm the root menu order, captions, and triggers match the design.
- Verify ArpeggioPlugin `positions` and `strings` show the correct summaries after changing values.
- Verify FillPlugin `options` shows `positions` and `strings` summaries and that the nested items still edit correctly.
- Verify MovePlugin and ClipPlugin show `Table` instead of `Target table`.
- Press `P`, `C`, and `S` in the main UI and confirm each performs the intended action while lowercase `p`, `c`, and `s` still do the old behavior.
- In the command-line input, press `Shift+ArrowDown` and `Shift+ArrowUp` and confirm both perform the short-menu action without kicking the user out of the command-line flow.
- Run `/vdm` and confirm indentation is help-compatible and no line ends with `>`.
- Confirm `help.html` examples match the actual runtime menu text and shortcut behavior.

### Focused automated verification

- Run targeted lint or syntax validation on the edited JavaScript and HTML files.
- Add or update unit tests only if the menu-summary logic or formatter is extracted into testable helpers during implementation.

## Risks and dependencies

- The plugin menus are partly data-driven and partly built in custom plugin code, so consistency changes may require parallel edits in both property JSON and plugin class menu builders.
- Keyboard handling is split between global handlers and command-line behavior, so arrow-key work may require care to avoid regressions in existing command-line navigation.
- `help.html` includes a static menu dump example, so documentation drift is likely unless the example is updated after the formatter change.

## Design clarifications incorporated

1. Arpeggio `positions` caption rule:

- When section `values` are set, they win and the caption shows the JSON-stringified current-section values.
- When section `values` are unset, the caption shows the default `minFret:maxFret` range.

2. Arpeggio `positions` empty-state display:

- The current-section values display should use `JSON.stringify(values)`.
- When no section values exist, the menu should show `positions []` for the current-section value line while the top-level summary falls back to the default range.

3. FillPlugin structure:

- `positions` and `strings` remain inside the existing `options` submenu.

4. Uppercase `S` implementation path:

- Prefer `key-handlers.js::runActionByName('sectionAdd', args)` with empty args rather than routing through a command-line simulation.

5. Uppercase `S` user feedback:

- The shortcut should be silent on success.
- Errors should still surface through the normal message flow.

6. Command-line shifted arrows:

- `Shift+ArrowUp` and `Shift+ArrowDown` both force the same short-menu mode.

7. Keyboard shortcut scope:

- The new uppercase shortcuts keep the current rule that normal text-input editing is not interrupted, except for the explicit `txtCmdLine` shifted-arrow behavior.

8. `/vdm` help snapshot policy:

- Update the help file manually once in this sprint.
- Any automated help-generation flow is deferred to the later menu-tools iteration.

## Acceptance criteria for the future coding pass

- ArpeggioPlugin root menu matches the target structure in the design, including `Table`, `positions`, `strings`, and `help` placement.
- FillPlugin `options` reflects the new grouped `positions` and `strings` structure.
- MovePlugin and ClipPlugin show `Table` instead of `Target table`.
- `P`, `C`, and `S` perform the new uppercase behaviors, while lowercase `p`, `c`, and `s` continue to perform their existing behaviors.
- `Shift+ArrowDown` and `Shift+ArrowUp` in the command-line preserve command-line flow while applying the requested short-menu behavior.
- `/vdm` output is compatible with the help-file display format and does not use hyphen indentation or trailing `>` markers.
- `help.html` is updated so shortcut tables and plugin menu documentation match runtime behavior.
