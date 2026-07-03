# Sprint 137 Macros — Iteration 1 Implementation Plan

Date: 2026-07-03

Source design: [137-design.md](137-design.md)

## Purpose of this document

This document turns the initial macro design into an implementation analysis and decision plan.  The goal for Iteration 1 is not to pretend the design is finished; it is to identify the concrete code seams, risky choices, and questions that should be settled before changing the main application files.

The requested feature has four major parts:

1. Persist named macros in a song.
2. Run a named macro on song load from a URL query parameter.
3. Let the User add, edit, delete, and run song-stored macros from the command-line menu.
4. Add enough menu-driving infrastructure that macros can execute ordinary static menu items, dynamic menu items, plugin menu items, input-backed menu items, selects, and explicit boolean state setting for toggles.

## Existing architecture findings

### Command-line menu plumbing

The current command-line menu is a live object tree rooted at `gMenuFile` in [menu.js](../../../../menu.js).  It already supports a mixture of static children and dynamically refreshed children:

- `gMenuFile` is the static root menu object.
- `setMenuRuntimeChildrenResolver()` installs one runtime child resolver.
- `refreshRuntimeChildren(menu)` replaces `menu.children` when `menu.runtimeChildren` is present and the resolver returns an array.
- `resolveMenuValue()` supports caption/default substitution using a value resolver.

The command-line UI is handled in [command-line.js](../../../../command-line.js):

- On ordinary trigger keys, it refreshes the current menu and each child before matching the typed key.
- If the selected item has `action` and no child menus, it calls the configured action runner.
- If the selected item has `input`, it dives into the synthetic input node and waits for `Enter`.
- For inputs, it builds an `args` object keyed by `menuItem.input.id`.

The central action runner is `performCmdAction(menuItem, args)` in [key-handlers.js](../../../../key-handlers.js).  This function is the safest existing execution seam for macro lines because it already knows how menu actions map to application behavior.

There is also an existing helper, `parkCommandLineAtPath(triggerPath)`, in [key-handlers.js](../../../../key-handlers.js).  It resets to root, refreshes plugin menus, then dives one trigger at a time.  It is useful evidence that direct path traversal is already needed by the codebase, but it is currently not exported and it is UI-oriented: it clears command results, manipulates `#txtCmdLine`, and shows the command line.

### Plugin and dynamic menu construction

The plugin menu lives under File > Plugins:

- [menu.js](../../../../menu.js) has a `pluginsRuntime` marker node under `/f/p`.
- [plugins/PluginManager.js](../../../../plugins/PluginManager.js) rebuilds that marker node with `refreshPluginsMenuNode()`.
- `buildPluginMenuNode(plugin)` combines managed plugin property nodes with `plugin.getVisibleMenuChildren()`.
- Plugin property nodes are built by [plugins/PluginProperty.js](../../../../plugins/PluginProperty.js).

Important plugin menu action types already exist:

- `pluginProperty:set` for input-backed properties.
- `pluginProperty:toggle` for `org.dynamide.toggle` properties.
- `pluginProperty:select` for `org.dynamide.Select` child choices.
- `pluginAction:invoke` for custom plugin actions.

The current plugin property layer already knows how to normalize booleans, integer strings, integer arrays, selects, and action values.  That is a strong argument for sending macro values through the same `performCmdAction()` / `PluginManager.invokeMenuAction()` path instead of building macro-specific plugin mutation code.

### Song persistence shape

Song construction and serialization are centered in [SongPersistence.js](../../../../SongPersistence.js):

- The constructor assigns defaults, then `Object.assign(this, songDefaults, obj)`.
- Known nested structures such as `sections`, `wirings`, `noteTablesLayout`, `plugins`, and `graveyard` are normalized.
- `persistentSongFileReplacer()` filters runtime-only fields and some non-persistent fields.

The song schema tool [bin/song-file-schema.js](../../../../bin/song-file-schema.js) currently allows additional root properties, so a root-level `macros` object would not immediately violate schema validation.  Even so, adding an explicit schema definition is recommended so future validation and test failures are easier to interpret.

### URL query parameter pattern

The existing URL parameter pattern is in [infinite-neck.js](../../../../infinite-neck.js).  `showDefaultTunings()` reads `window.location.search`, checks `tuning`, and applies a default tuning after instrument preferences have been applied.

Macro-on-load needs a similar hook, but timing is more sensitive than the existing `tuning` parameter.  A macro may drive plugin menus, visibility menus, and other UI state.  It should not fire until the song, tunings, plugin manager, command menu tree, and runtime menu children are all ready.

### UserLog pattern

User-facing log messages are already handled through `UserLog` events and `addToUserLog()` in [key-handlers.js](../../../../key-handlers.js).  Several subsystems use this for quiet operational logging.  Macro execution should use a `Macro` subsystem label.

The initial design says verbose mode should log each executed line and result.  Non-verbose mode should still log failures, macro start/end, and URL auto-run outcomes.

### Page-level editor UI pattern

The Info dialog is the best existing model:

- Builder file: [templates/info/info.builder.js](../../../../templates/info/info.builder.js)
- Host behavior: [infinite-neck.js](../../../../infinite-neck.js)
- Command action: `showDialog-info` in [key-handlers.js](../../../../key-handlers.js)

A macro editor can follow the same pattern: a page-level/menu-level div, builder class, textarea, Save button, save-on-blur, render from song, close with Escape through the normal menu/dialog machinery.

### Tuning visibility support

The requested `/t/s` and `/t/h` menu is viable because tuning visibility is already modeled.  [TuningsLibrary.js](../../../../TuningsLibrary.js) exports show/hide style helpers and [InstrumentRoleBadges.js](../../../../InstrumentRoleBadges.js) reads `song.noteTablesLayout[].visible` as the visibility model.

The main implementation choice is whether `/t` should be a new top-level command menu branch, or whether the existing command menu already has a competing trigger or concept that should absorb it.  Based on the current design, top-level `/t` is acceptable if trigger validation passes.

## Proposed macro data model

Use the root-level song shape from the design:

```json
{
  "macros": {
    "macro1": {
      "lines": [
        "/fpapv [[7,12]]",
        "/fpasl 4",
        "/fpac true",
        "/fpaye"
      ]
    }
  }
}
```

Recommended normalized internal rules:

- `song.macros` is always an object after load.
- Macro IDs are object keys.
- Each macro record has at least `{ "lines": [] }`.
- Lines are stored as trimmed strings.
- Blank lines are removed on save.
- No comment syntax in Iteration 1.
- Macro IDs should be conservative: `^[A-Za-z][A-Za-z0-9_-]*$`.
- Preserve insertion order by relying on object key insertion order, or switch to an array if the UI needs stable explicit ordering later.

Recommended optional metadata, not necessary for Iteration 1:

```json
{
  "macros": {
    "macro1": {
      "lines": [],
      "caption": "Human readable caption",
      "updatedAt": "2026-07-03T00:00:00.000Z"
    }
  }
}
```

Iteration 1 recommendation: do not add optional metadata until there is a concrete UI need.

## Macro line syntax

The design syntax is sound:

```text
path
path json
```

Parsing rule:

1. Trim the whole line.
2. If empty, ignore before persistence/execution.
3. Split on the first ASCII space only.
4. The left side is the command path.
5. The right side is parsed with `JSON.parse()` as a JSON property value.
6. If JSON parsing fails, the macro line fails and macro execution stops.

Examples:

| Line | Parsed path | Parsed value |
| --- | --- | --- |
| `/fpaye` | `/fpaye` | no value |
| `/fpasl 4` | `/fpasl` | `4` |
| `/fpac true` | `/fpac` | `true` |
| `/fpapv [[7,12]]` | `/fpapv` | `[[7,12]]` |
| `/foo "bar baz"` | `/foo` | `"bar baz"` |

Recommendation: require paths to start with `/`.  Internally, strip the leading `/` before trigger traversal, matching `parkCommandLineAtPath('fp')` style.

## Macro execution model

### Core executor proposal

Add a new core module, tentatively `MacroExecutor.js`, with no direct UI rendering responsibility.

Suggested public functions:

- `parseMacroLine(line)`
- `normalizeMacroLines(textOrLines)`
- `validateMacroId(id)`
- `getSongMacros(song)`
- `upsertSongMacro(song, id, lines)`
- `deleteSongMacro(song, id)`
- `executeMacro(song, id, options)`
- `executeMacroLines(lines, options)`
- `executeMacroLine(line, options)`

Suggested injected dependencies for `executeMacroLine()`:

- `rootMenu`, normally `gMenuFile`.
- `actionRunner`, normally `performCmdAction`.
- `refreshBeforePath`, normally plugin/menu refresh work.
- `log`, normally a wrapper around UserLog.

This keeps parsing and execution testable without requiring a browser/JSDOM-heavy Jest setup.

### Path traversal proposal

Do not execute macro paths by synthesizing keyboard events.  Instead:

1. Start from the root menu.
2. Strip one leading `/` from the macro path.
3. For each trigger character:
   - refresh runtime children on the current menu;
   - find the child with matching `trigger`;
   - refresh that child if needed;
   - move to that child.
4. At the final menu item:
   - if it has `action`, execute it;
   - if it has `input`, pass the parsed JSON value as the input argument;
   - if it has children but no action, fail with “path ended at submenu”; or optionally support a future default child convention.

This should become a non-UI equivalent of `parkCommandLineAtPath()` plus the action portions of `txtCmdLine_keypress()`.

### Building `args` from macro values

For an input-backed final menu item:

```javascript
args[menuItem.input.id] = value;
```

Open design question: should `args` values be raw parsed JSON values or strings?

Recommendation: use parsed JSON values where possible.  Current plugin property normalization already accepts booleans, arrays, and strings in many places.  However, older non-plugin actions may expect strings.  If this causes breakage, handle conversion action-by-action instead of converting all macro values to strings.

### Return shape

Define a normalized execution result independent of existing action result quirks:

```javascript
{
  ok: true,
  path: "/fpaye",
  action: "pluginProperty:select",
  result: "style=every"
}
```

On failure:

```javascript
{
  ok: false,
  path: "/fpasl",
  error: "Command-line path not found at trigger s in /fpasl"
}
```

Macro execution stops on the first failed line.

### Runtime menu refresh policy

Recommendation for Iteration 1:

- Refresh plugin menu nodes before every macro line.
- Refresh runtime children during every path traversal step.
- Re-run plugin menu refresh after every plugin action indirectly through existing `PluginManager.invokeMenuAction()` behavior.

This is safer than refreshing once at macro start because macro lines can mutate state that changes later dynamic menu options.

## Command-line menu additions

Initial design menu:

```text
/f
  m) macro
    a) add
    d) delete
      n) number
      i) id
    e) edit
      n) number
      i) id
    r) run
      n) number
      i) id
    v) verbose mode
```

Recommended implementation details:

### `/f/m/a` add

Input:

- `id`
- datatype `string`
- validation: macro ID pattern and not already present unless overwrite is explicitly confirmed later.

Action:

1. Create `{ lines: [] }`.
2. Open the macro editor for that ID.
3. Preserve menu stack if needed so the editor action does not unexpectedly pop.

### `/f/m/e/n` edit by number

Runtime children from current `song.macros` keys:

- trigger `1`, `2`, `3`, etc. for first nine macros.
- For more than nine macros, decide whether to support multi-character triggers.  The existing menu trigger system is character-oriented, so `number` is practical only for `1` through `9` unless a list item opens an input or pagination is introduced.

Recommendation: support numbered triggers `1` through `9` in Iteration 1 and document the limit.  Use edit-by-id for larger collections.

### `/f/m/e/i` edit by ID

Input ID, validate existence, open editor.

### `/f/m/r/n` run by number

Runtime children from current `song.macros` keys.  Same `1` through `9` caveat.

### `/f/m/r/i` run by ID

Input ID, validate existence, execute macro.

### `/f/m/d/n` and `/f/m/d/i` delete

Deletion should probably require a confirmation step to prevent accidental loss.

Iteration 1 decision options:

1. Implement delete immediately with no confirmation and rely on saved song/download history.
2. Add a nested `y/n` confirmation menu similar to graveyard confirmation patterns.
3. Skip delete implementation until add/edit/run are proven.

Recommendation: implement confirmation, or postpone delete.  Do not implement silent deletion.

### `/f/m/v` verbose mode

The design says this is a toggle with default `false`.

Decision needed: where is verbose mode stored?

Options:

1. Song-level persisted setting, e.g. `song.macroVerbose`.
2. Runtime-only global setting.
3. User preference outside the song.

Recommendation: use runtime-only for Iteration 1 unless there is a clear reason verbose behavior should travel with the song.  The macro definitions belong in the song; the logging preference feels like a local diagnostic setting.

## Macro editor UI

Add a page-level editor modeled on the Info dialog.

Suggested files:

- `templates/macros/macros.template.html`, if following template extraction patterns.
- `templates/macros/macros.builder.js`.
- CSS additions only if the existing menu/dialog styles are insufficient.

Suggested UI:

- Macro ID label/input, read-only when editing an existing macro.
- Textarea containing one command per line.
- Save button.
- Run button, optional but useful.
- Delete button, optional and preferably confirmed.
- Status message area for parse/save feedback.

Save behavior:

- Save on button click.
- Save on textarea blur.
- Trim each line.
- Remove blank lines.
- Validate each line enough to catch malformed JSON before storing.
- Do not require command paths to resolve at save time; dynamic menus may depend on runtime state.

Open design question: should invalid JSON be rejected on save or only fail on run?

Recommendation: reject invalid JSON on save because the design requires JSON and this gives faster User feedback.

## URL auto-run plan

Parameter proposal:

```text
?macro=macro1
```

Alternate names considered:

- `runMacro=macro1` is more explicit.
- `macro=macro1` matches the design language and is concise.

Recommendation: use `macro` unless there is concern about future URL namespace conflicts.

Execution timing:

1. Open/load song.
2. Normalize `song.macros`.
3. Initialize tunings and default tuning visibility.
4. Initialize/reconcile plugins and plugin menus.
5. Run existing post-load UI updates.
6. Schedule macro execution after the current call stack with `queueMicrotask()` or `setTimeout(..., 0)` if needed so UI/menu tree state is stable.

Important: auto-run should log both success and failure to UserLog, even when verbose mode is off.

Failure cases:

- URL macro ID missing from song: log “Macro not found: id”.
- Macro line parse error: log line number and JSON error.
- Path not found: log line number and path.
- Action throws: catch, log, stop.

## Toggle and select design problem

The example macro includes:

```text
/fpac true
/fpaye
```

This exposes the largest design gap.

### Existing toggle behavior

`org.dynamide.toggle` menu items currently build `pluginProperty:toggle` nodes in [plugins/PluginProperty.js](../../../../plugins/PluginProperty.js).  [plugins/PluginManager.js](../../../../plugins/PluginManager.js) handles these by inverting the current property value.  There is no current “set this toggle to true/false” menu semantics.

### Required macro behavior

Macros need idempotent state setting.  A line like `/fpac true` should mean “make color true,” not “toggle color, and hope it becomes true.”

### Recommended solution

Extend macro execution, not ordinary interactive trigger behavior:

- If a final menu item has action `pluginProperty:toggle` and the macro line has a JSON value:
  - parse/normalize the value as boolean;
  - call `pluginManager.setPropertyValue(entry, propertyName, value)` instead of `togglePropertyValue()`.
- If there is no JSON value, preserve existing toggle behavior.

This gives macros idempotence without changing how Users interactively type toggle menu triggers.

Alternative: add `input` nodes to toggles.  This would expose value-setting in the interactive command line too, but it changes UX and may make simple toggles less convenient.

### Existing select behavior

`org.dynamide.Select` properties build children, one child per option, each with `pluginProperty:select` and a specific `value`.

A macro can currently select by including the child trigger in the path, such as `/fpaye`, if `e` is the desired option trigger.  A future enhancement could support `/fpay "every"` at the parent select node, but this is not necessary for Iteration 1 if examples include the full trigger path.

Recommendation: Iteration 1 supports select by child trigger path only.  Parent-node select-by-value can be a later enhancement.

## Tuning show/hide menu plan

Design menu:

```text
/t
  s) show
    a) all
    l) list
    i) id
  h) hide
    a) all
    l) list
    i) id
```

Recommended action semantics:

- `/tsa`: show all tunings.
- `/tha`: hide all tunings.
- `/tsl1`: show first tuning in current list.
- `/thl1`: hide first tuning in current list.
- `/tsi "S6"` or `/tsi S6` depending input parsing mode: show by ID.
- `/thi "S6"`: hide by ID.

Because macro JSON requires strings to be quoted, macro lines should use:

```text
/tsi "S6"
/thi "S6"
```

Open design problem: the design says `/t/s/i INPUT: id`; the command-line input UI accepts raw strings, while macro JSON syntax requires JSON strings.  This difference is acceptable but should be documented in macro help.

Implementation details:

- Runtime list children should be generated from currently known tunings.
- Numbered list should have the same `1` through `9` trigger limitation unless pagination/multi-character input is designed.
- Show/hide all should update `song.noteTablesLayout` and DOM state using existing TuningsLibrary helpers, not directly mutate DOM in macro code.

## Runtime child resolver design problem

There is currently one global `setMenuRuntimeChildrenResolver()` hook.  [key-handlers.js](../../../../key-handlers.js) installs the section edit resolver.  Plugin menus are refreshed separately by `PluginManager.refreshPluginsMenuNode()` rather than through this resolver.

Macros and the new macro/tuning runtime lists will need additional runtime children:

- macro edit/run/delete numbered lists;
- tuning show/hide numbered lists;
- possibly future macro library/list displays.

Recommendation: replace the single-purpose resolver with a dispatcher function in [key-handlers.js](../../../../key-handlers.js):

```javascript
function refreshRuntimeMenuChildren(menu) {
  return refreshSectionEditRuntimeChildren(menu)
      || refreshMacroRuntimeChildren(menu)
      || refreshTuningRuntimeChildren(menu)
      || null;
}
```

Then call `setMenuRuntimeChildrenResolver(refreshRuntimeMenuChildren)` once.

This is a small but important architecture cleanup before adding new runtime menus.

## Validation and tests

### Unit tests worth adding

Add Jest tests for a browser-light core module rather than UI behavior:

- `parseMacroLine()` accepts path-only lines.
- `parseMacroLine()` splits only on first space.
- `parseMacroLine()` parses JSON arrays, booleans, numbers, and strings.
- `parseMacroLine()` rejects invalid JSON.
- `normalizeMacroLines()` trims lines and removes blanks.
- `validateMacroId()` accepts/rejects expected IDs.
- `executeMacroLines()` stops on first failure using a fake menu tree/action runner.
- `executeMacroLine()` passes input values under `menuItem.input.id`.
- `executeMacroLine()` handles toggle-with-value idempotently if that behavior is implemented in the executor.

### Command menu validation

Update [bin/validate-command-menu.js](../../../../bin/validate-command-menu.js) when adding new runtime children or dynamic implied actions.  Existing validation knows about runtime child action maps and will otherwise report warnings for dynamic menu structures.

### Song schema and load tests

Even though root additional properties are currently allowed, add an explicit `macros` schema to [bin/song-file-schema.js](../../../../bin/song-file-schema.js):

- object keyed by macro ID pattern;
- each value has required `lines` array;
- each line is a string.

Add or extend song load tests so songs with no macros and songs with macros both load and serialize correctly.

### Manual acceptance tests

1. Create a macro through `/f/m/a`.
2. Edit and save macro lines.
3. Run macro by ID.
4. Run macro by number.
5. Confirm failure stops on the first bad line.
6. Confirm verbose mode logs every line.
7. Load a song with `?macro=macro1` and confirm the macro runs once after load.
8. Confirm `/fpac true` is idempotent and does not toggle false on the second run.
9. Confirm tuning show/hide macro lines update visible instruments and persist through song download/reload.

## Open questions for decision

### 1. Should macro verbose mode persist in the song?

Recommendation: no for Iteration 1.  Keep it runtime-only.

### 2. Should invalid macro JSON be rejected on save?

Recommendation: yes.  It is much friendlier than accepting a macro that cannot run.

### 3. Should macro paths be validated on save?

Recommendation: no.  Dynamic/plugin menus can depend on song state, selected section, selected instrument, plugin enablement, or runtime conditions.  Validate paths at run time.

### 4. Should delete require confirmation?

Recommendation: yes, or postpone delete.  Do not silently delete persisted macro definitions.

### 5. How many number-list macros/tunings should `/n` and `/l` support?

Recommendation: support `1` through `9` for Iteration 1 and rely on ID input for larger collections.  Multi-character menu triggers are a separate command-line design issue.

### 6. Should macros be allowed to run macros?

Recommendation: not in Iteration 1.  Prevent or ignore macro-run actions while a macro is already running, or enforce a recursion depth limit of `1` with a clear UserLog message.

### 7. Should macro execution roll back partial changes on failure?

Recommendation: no.  Existing command actions are imperative UI/application mutations with no transaction model.  Log the partial-failure state clearly.

### 8. Should macro execution use command-line UI state?

Recommendation: no.  Macro execution should traverse and invoke the menu tree directly.  The command-line UI may show status, but it should not be required for execution.

### 9. Should select parent nodes accept JSON values?

Recommendation: not in Iteration 1.  Use full child paths such as `/fpaye`.  Consider parent select-by-value later.

### 10. Should toggle value-setting be available interactively too?

Recommendation: not initially.  Add idempotent toggle-with-value behavior for macro execution only, unless there is explicit UX demand for interactive value setting.

## Proposed implementation phases

### Phase A — design-safe foundation

Files likely affected:

- New `MacroExecutor.js`
- New Jest tests in `_tests/jest/`
- Possibly [bin/song-file-schema.js](../../../../bin/song-file-schema.js)

Work:

1. Implement macro line parsing and normalization.
2. Implement macro ID validation.
3. Implement song macro helpers.
4. Implement a menu-tree executor against injected dependencies.
5. Add tests with fake menu trees and action runners.

This phase can be done before UI decisions are final.

### Phase B — command menu integration

Files likely affected:

- [menu.js](../../../../menu.js)
- [key-handlers.js](../../../../key-handlers.js)
- [bin/validate-command-menu.js](../../../../bin/validate-command-menu.js)

Work:

1. Add `/f/m` menu structure.
2. Add runtime child dispatcher.
3. Add action cases for add, edit, run, delete, verbose toggle.
4. Wire actions to `MacroExecutor` helpers.
5. Ensure command menu validation passes.

### Phase C — macro editor dialog

Files likely affected:

- New `templates/macros/macros.builder.js`
- New macro template/CSS if needed
- [infinite-neck.js](../../../../infinite-neck.js)
- [key-handlers.js](../../../../key-handlers.js)
- Possibly [index.html](../../../../index.html) or relevant HTML host file

Work:

1. Add page-level macro editor host.
2. Render selected macro ID and textarea.
3. Save on blur and Save button.
4. Open editor from add/edit menu actions.
5. Provide parse validation feedback.

### Phase D — idempotent toggle support

Files likely affected:

- `MacroExecutor.js`
- [plugins/PluginManager.js](../../../../plugins/PluginManager.js), if executor should call a new public helper
- Tests

Work:

1. Detect `pluginProperty:toggle` plus provided macro value.
2. Normalize boolean.
3. Set property value instead of toggling.
4. Confirm `/fpac true` is repeatable.

### Phase E — URL auto-run

Files likely affected:

- [infinite-neck.js](../../../../infinite-neck.js)
- Possibly macro executor/bootstrap module

Work:

1. Read `macro` query parameter after song load.
2. Schedule execution after menu/plugin readiness.
3. Log success/failure.
4. Prevent repeated execution on unrelated UI refreshes.

### Phase F — tuning show/hide menu

Files likely affected:

- [menu.js](../../../../menu.js)
- [key-handlers.js](../../../../key-handlers.js)
- [TuningsLibrary.js](../../../../TuningsLibrary.js), only if existing exports are insufficient
- [bin/validate-command-menu.js](../../../../bin/validate-command-menu.js)

Work:

1. Add `/t/s` and `/t/h` branches.
2. Add show/hide all actions.
3. Add runtime list children.
4. Add show/hide by ID input actions.
5. Add acceptance macro examples.

## Recommended first implementation slice

The lowest-risk first slice is:

1. `MacroExecutor.js` with parsing, normalization, fake-menu execution, and tests.
2. Explicit schema support for `macros`.
3. A small design review checkpoint using those tests and this plan before editing [menu.js](../../../../menu.js), [key-handlers.js](../../../../key-handlers.js), or [infinite-neck.js](../../../../infinite-neck.js).

This gives us concrete behavior for the macro language while postponing the larger UI/menu decisions until the team agrees on the design answers above.
