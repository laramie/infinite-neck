# Command Menu Programmer's Reference

This document describes the command-menu system that powers the mini command-line UI in infinite-neck. It is aimed at maintainers who need to extend menu.js, wire new actions into JavaScript, or debug how command data flows from the menu tree into performCmdAction().

The reference is based on the current code paths in menu.js, command-line.js, key-handlers.js, infinite-neck.js, and the CmdMenu markup in index.html.

## Table of Contents

1. [System Overview](#system-overview)
2. [Mental Model](#mental-model)
3. [User Interaction and Reserved Keys](#user-interaction-and-reserved-keys)
4. [Menu Schema](#menu-schema)
5. [Supported Node Patterns](#supported-node-patterns)
6. [Argument and Data Flow](#argument-and-data-flow)
7. [Caption Variables and Input Defaults](#caption-variables-and-input-defaults)
8. [Current Menu Inventory](#current-menu-inventory)
9. [JavaScript Wiring for New Actions](#javascript-wiring-for-new-actions)
10. [Maintainer Checklist](#maintainer-checklist)

## System Overview

The command menu is not a free-form shell. It is a single-keystroke REPL over a nested JavaScript object tree.

Each typed key is interpreted relative to the current menu node. The runtime either:

- dives into a submenu,
- opens an input prompt,
- executes a leaf action,
- executes a parent action using the selected child as a choice token,
- or performs reserved navigation such as exit or go-to-root.

### Source map

| File | Responsibility |
| --- | --- |
| `index.html` | Defines the visible `#CmdMenu` UI: breadcrumbs, prompt area, options row, results dropdown, and input textbox. |
| `menu.js` | Stores the menu tree data and the runtime helpers for navigation, caption expansion, breadcrumbs, and child layout. |
| `command-line.js` | Implements the REPL loop for keypresses inside `#txtCmdLine`. This is where menu traversal and action dispatch decisions happen. |
| `key-handlers.js` | Implements `performCmdAction(menuItem, args)` and `getValue(token)`. This is the main JavaScript side of menu execution. |
| `infinite-neck.js` | Wires provider functions into `key-handlers.js` and binds the document and command-line event handlers during app startup. |

## Mental Model

The command menu behaves like a tree walker with a small amount of runtime state.

### Core runtime state

| Symbol | Meaning |
| --- | --- |
| `gMenuFile` | The authored menu tree. Root node plus all nested children. |
| `gMenuPointer` | The current node being displayed or edited. |
| `gCurrentMenuStack` | Historical stack used by `diveMenu()` and `peekParentMenu()`. Most visible rendering walks `parent` links instead. |
| `gMenuValueResolver` | Function used to resolve caption variables and input defaults. It is set from `key-handlers.js::getValue()`. |

### Important invariants

- Matching is local to the current node's `children` array.
- Trigger matching is exact and case-sensitive because it compares `child.trigger == e.key`.
- Trigger uniqueness is only required among siblings, not globally across the entire tree.
- Captions are HTML strings. The UI inserts them with `.html()`, so `<b>`, `<small>`, `&flat;`, and similar markup are intentional.
- The runtime does not validate schema correctness. If a node is malformed, it usually fails silently or falls into the default branch of `performCmdAction()`.

## User Interaction and Reserved Keys

### How the command line opens

Outside the command-line textbox, `document_keypress()` opens the UI like this:

| Key | Behavior |
| --- | --- |
| `m` or `M` | Show `#CmdMenu` without resetting the current menu pointer. |
| `/` | Reset to root with `setMenuAtRoot()`, clear prior results, show the menu, and refresh the view. |
| `ESC` | Hide the command line, hide other menu divs, leave fullscreen, and focus the loop button. |

### Reserved behavior inside `#txtCmdLine`

These inputs are consumed by `txtCmdLine_keypress()` before normal menu-child matching:

| Input | Behavior |
| --- | --- |
| `x` keypress | Immediate exit. Hides `#CmdMenu`. |
| `/` keypress | Reset to root, clear results, clear the textbox, redraw the root menu. |
| `Enter` on non-empty text while in an input prompt | Submit input and call the target action with `args[input.id] = typedValue`. |
| `Enter` on empty text | Pop one menu level. If currently on an input pseudo-node, pop two levels. |
| `Enter` after typing `..` | Pop one menu level and redraw. |
| `Enter` after typing `X` | Hide the command line and clear the textbox. |

### Reserved trigger advice

- Do not assign lowercase `x` as a normal menu trigger. It is hard-reserved for exit inside the command-line textbox.
- Do not rely on `/` as a child trigger. Inside the textbox it always resets to root.
- `Enter` is submission/navigation, not a selectable trigger.

## Menu Schema

### Author-authored properties

The following properties appear directly in `menu.js` and define command behavior.

| Property | Required | Applies to | Meaning |
| --- | --- | --- | --- |
| `caption` | Yes for visible menu nodes | Most menu nodes | HTML string shown to the user. By convention the trigger character is wrapped in `<b>...</b>`. |
| `trigger` | Yes for nodes reachable from a `children` array | Most menu nodes | Single typed key that selects the node from its siblings. Case-sensitive. |
| `children` | Optional | Branch nodes | Array of submenu nodes. Presence normally means navigation rather than immediate execution. |
| `action` | Optional | Executable nodes and selector parents | Action name dispatched to `performCmdAction(menuItem, args)`. |
| `input` | Optional | Action nodes that collect text or numbers | Embedded input descriptor. The runtime treats this as a pseudo-child prompt. |
| `vars` | Optional | Any captioned node | List of tokens to resolve through `getValue()` and substitute into `${token}` placeholders in `caption`. |
| `name` | Optional | Nodes whose action needs a semantic identifier | Stable semantic value distinct from `caption` and `trigger`. Currently important for bend-type selection. |
| `popOnBang` | Optional | Action leaves, usually confirmation answers | Requests an extra menu pop after action execution. Used to return from a confirmation submenu to the menu that asked the question. |
| `tall` | Optional, effectively root-only | Root menu | Global display preference for vertical versus horizontal child layout. |

### Input descriptor properties

`input` is not a normal child in the `children` array. It is an embedded object that the REPL temporarily pushes onto the navigation stack.

| Property | Required | Meaning |
| --- | --- | --- |
| `type` | Yes | Currently only `input` is implemented. |
| `caption` | Yes | Prompt label shown to the user, such as `(string)` or `0-100`. |
| `default` | Optional but widely used | Token or literal displayed in square brackets in the prompt. It is not automatically accepted or injected into the textbox. |
| `datatype` | Optional | Maintainer-facing type hint. Today it is descriptive only and is not enforced by the REPL. |
| `id` | Yes for useful inputs | Key name under which the raw typed value is passed to the action in `args`. |

### Runtime-only properties

These are not part of the authored schema contract, but the runtime mutates nodes with them.

| Property | Set by | Meaning |
| --- | --- | --- |
| `parent` | `diveMenu()` | Back-link to the node from which the runtime entered this node. Used heavily by prompt and breadcrumb rendering. |
| `bang` | `command-line.js` during execution | Temporary flag used only to decorate the currently fired option with `!` in the rendered menu list. |

### Maintainer notes

- The code does not auto-generate captions from triggers. If you want the UI to highlight the trigger, you must place the trigger character inside `<b>...</b>` yourself.
- The code does not enforce uniqueness, required fields, or valid action names. Those are authoring responsibilities.
- `children: []` and no `children` are both treated as having no child menus.

## Supported Node Patterns

The menu system supports a small number of recurring structural patterns. Most maintenance work is adding one of these patterns, not inventing a new grammar.

### 1. Pure submenu node

Use this when a node only groups children and does not execute anything itself.

```json
{
  "caption": "<b>f</b>ile",
  "trigger": "f",
  "children": [
    { "caption": "<b>o</b>pen", "trigger": "o", "action": "setupOpenFile" }
  ]
}
```

Behavior:

- Typing `f` while on the parent node calls `diveMenu(child)`.
- The REPL redraws using that child's `children`.
- No action is executed when the submenu opens.

Maintainer notes:

- This pattern only needs `menu.js` edits if all descendants already point at existing actions.
- Trigger uniqueness only matters within the enclosing `children` array.

### 2. Simple leaf action

Use this when a single trigger should execute one action immediately.

```json
{
  "caption": "<b>g</b>raveyard",
  "trigger": "g",
  "action": "showGraveyard"
}
```

Behavior:

- The runtime briefly dives into the child for breadcrumb purposes.
- It calls `gCmdActionRunner(child)` with no synthesized `args` object.
- It pops back up one level after execution.
- `actionResult.result` is recorded in the results dropdown.

Maintainer notes:

- Add a `case` to `performCmdAction()` for every new `action` string.
- If the action needs to report a status line, set `actionResult.result`.
- If the action needs app services that `key-handlers.js` does not currently expose, extend the provider wiring described later in this document.

### 3. Input action

Use this when the user must type a free-form or numeric value before the action runs.

```json
{
  "caption": "<b>b</b>pm",
  "trigger": "b",
  "action": "setBPM",
  "input": {
    "type": "input",
    "caption": "1-240",
    "default": "getBPM",
    "datatype": "int",
    "id": "bpm"
  }
}
```

Behavior:

1. Selecting the node dives into the action node.
2. Because the node has an `input`, the runtime then dives again into the embedded `input` object.
3. The prompt shows `caption[default]:` if a default exists.
4. On `Enter`, the runtime calls the action as `performCmdAction(menuItem, { bpm: typedValue })`.
5. The current pointer remains on the input prompt after submission. The user must leave explicitly with empty `Enter`, `..`, `x`, or `/`.

Maintainer notes:

- `args[input.id]` receives the raw string typed by the user.
- `datatype` is documentation only. Validation and conversion are done manually inside `performCmdAction()`, usually with `toInt()`.
- `default` does not make `Enter` accept the default. Empty `Enter` means "go up", not "use default".
- If you need a live default or caption variable, implement or extend a token in `getValue()`.

### 4. Parent-handled choice menu

Use this when the parent action wants the child trigger as a selector token rather than each child having its own action.

Example shape:

```json
{
  "caption": "<b>m</b>enu prefs",
  "trigger": "m",
  "action": "setMenuPrefs",
  "children": [
    { "caption": "<b>s</b>hort", "trigger": "s" },
    { "caption": "<b>t</b>all", "trigger": "t" }
  ]
}
```

Behavior:

- The parent is a normal submenu when first entered.
- If the chosen child has no `children` and no `action`, the runtime does not dive into the child.
- Instead it calls the parent action with `args = { key: selectedChildTrigger }`.
- The pointer stays on the same menu level, so this pattern naturally lingers.

Current examples:

- `setMenuPrefs`
- `selectFingering`
- `selectRadioNoteType`

Maintainer notes:

- This is the correct pattern for radio-button style choices, mode pickers, and any menu where the choice set belongs to one action handler.
- The implementor reads `args.key` inside the parent action.
- A leaf node with no action only works if its parent has an `action`. Otherwise it is just a placeholder and selecting it effectively does nothing useful.

### 5. Confirmation submenu

There is no dedicated `confirm: true` syntax. Confirmation is authored as an ordinary submenu whose children are usually `Y` and `n` leaf actions.

```json
{
  "caption": "<b>C</b>lear graveyard, with backup",
  "trigger": "C",
  "children": [
    {
      "caption": "<b>Y</b>es: CLEAR ${graveyardRecordCount} graveyard records !",
      "trigger": "Y",
      "action": "downloadBackupThenClearGraveyard",
      "vars": ["graveyardRecordCount"],
      "popOnBang": true
    },
    {
      "caption": "<b>n</b>o: keep graveyard.",
      "trigger": "n",
      "action": "noAction",
      "popOnBang": true
    }
  ]
}
```

Behavior:

- The confirmation question is just a submenu node.
- Each answer is an ordinary leaf action.
- `popOnBang: true` tells the REPL to pop an extra level after executing the answer, so the user returns to the menu that asked the question.

Maintainer notes:

- Use `vars` when the question needs live state such as counts or section numbers.
- Use `popOnBang` for confirmation answers when the submenu should collapse after the answer is chosen.
- If you omit `popOnBang`, the user will remain one level deeper than a typical confirmation flow.

### 6. Named semantic leaf

Use `name` when the action needs a stable semantic token and the trigger or caption is not enough.

```json
{
  "name": "semitone2",
  "caption": "<b>2</b>&nbsp;frets",
  "trigger": "2",
  "action": "selectBendType",
  "popOnBang": true
}
```

Behavior:

- The action executes as a normal leaf action.
- The handler can read `menuItem.name`.

Maintainer notes:

- This is useful for semantic identifiers that should remain stable even if the displayed caption changes.
- In the current codebase, `selectBendType` depends on `menuItem.name` and writes it into `#selBend`.

### 7. Dialog launcher

Use a leaf action to pop open an existing page-level dialog or control panel.

```json
{
  "caption": "<b>;</b>&nbsp;dialog",
  "trigger": ";",
  "action": "showDialog-view"
}
```

Behavior:

- The action runs immediately like any other leaf action.
- The handler typically calls `showOneMenu("#someDiv")`.

Maintainer notes:

- Add the target UI panel in `index.html` if it does not already exist.
- Wire the action to the right DOM selector in `performCmdAction()`.

## Argument and Data Flow

This is the critical maintainer contract.

### Dispatch shapes

| Pattern | Action target | `args` shape | What the implementor reads |
| --- | --- | --- | --- |
| Simple leaf action | The leaf node itself | Usually `undefined` | `menuItem`, possibly `menuItem.trigger` or `menuItem.name` |
| Input action | The action node that owns `input` | `{ [input.id]: typedValue }` | `args[input.id]` |
| Parent-handled choice | The current parent menu | `{ key: child.trigger }` | `args.key` |
| Confirmation answer | The answer leaf node | Usually `undefined` | `menuItem`, optionally `menuItem.popOnBang` |
| Named semantic leaf | The leaf node itself | Usually `undefined` | `menuItem.name` |

### The actual flow in `txtCmdLine_keypress()`

1. Reserved navigation keys are handled first.
2. The runtime scans `gMenuPointer.children` for `child.trigger == e.key`.
3. If the child has `action` and no child menus:
   - it dives into the child,
   - if the child also has `input`, it dives again into `child.input`,
   - otherwise it executes the child action immediately.
4. If the child has no children and no action:
   - it is treated as a selector leaf,
   - the current parent menu's action is called with `args.key = e.key`.
5. Otherwise the runtime just dives into the child submenu.

### Action return contract

`performCmdAction()` returns an `actionResult` object with this shape:

```js
{
  result: "",
  menuItem,
  args,
  popOnBang: false
}
```

Notes:

- `result` is displayed in the command-results dropdown.
- `popOnBang` controls whether the REPL does a second `surfaceOneMenu()` after a leaf action.
- The code sets `popOnBang` from `menuItem.popOnBang` before the `switch` body runs.

### Maintainer notes

- When you add a new action, decide which data path it needs before choosing the menu shape.
- If you need a discrete selection from a short list, prefer a parent-handled choice menu over several nearly identical leaf actions.
- If you need free-form entry, use `input` and read `args[input.id]`.

## Caption Variables and Input Defaults

The menu system supports two distinct kinds of dynamic value insertion.

### 1. Caption variables via `vars`

`expandCaption(menuItem)` replaces `${token}` placeholders in `caption` by calling `gMenuValueResolver(token)` for each token listed in `vars`.

Important details:

- Replacement only happens for tokens explicitly listed in `vars`.
- If the resolver returns `undefined`, the placeholder remains unchanged.
- If the resolver returns an empty string, the placeholder is replaced by that empty string.
- This affects only the rendered caption, not the data passed to the action.

### 2. Input defaults via `input.default`

When the current pointer is an input pseudo-node, `printMenuStack()` displays:

```text
caption[resolvedDefault]:
```

Important details:

- The default is display-only.
- The textbox is not pre-filled.
- Empty `Enter` means "go up", not "accept default".
- Literal defaults such as `"0"` and `"1"` work today because `getValue()` falls through and returns unknown tokens unchanged.

### Current resolver tokens

These tokens are currently defined in `approved-values.js` and resolved through `key-handlers.js::getValue()`.

| Token | Meaning |
| --- | --- |
| `currentSectionNumber` | Current section index, zero-based |
| `currentSectionIndex` | Current section index, zero-based |
| `currentSectionCardinal` | Current section number, one-based |
| `sectionCount` | Total number of sections |
| `graveyardRecordCount` | Record count in the graveyard |
| `beats` | Beat count in the current section |
| `beatCount` | Alias of `beats` |
| `currentBeat` | Current beat in the current section |
| `getBPM` | Current BPM |
| `getNamedNoteOpacity` | Named-note opacity as percent string |
| `getSingleNoteOpacity` | Single-note opacity as percent string |
| `getTinyNoteOpacity` | Tiny-note opacity as percent string |
| `getSongName` | Current song name |
| `getSectionCaption` | Current section caption |

### Current input-bearing commands

| Path | Action | `input.id` | `default` | `datatype` |
| --- | --- | --- | --- | --- |
| `/fn` | `setSongName` | `name` | `getSongName` | `string` |
| `/fb` | `setBPM` | `bpm` | `getBPM` | `int` |
| `/fat` | `transposeSong` | `transposeSong` | `0` | `int` |
| `/fak` | `transposeSongKeys` | `transposeSongKeys` | `0` | `int` |
| `/fpi` | `pluginDaCapoWInput` | `daCapoInput` | `1` | `int` |
| `/sc` | `setSectionCaption` | `caption` | `getSectionCaption` | `string` |
| `/von` | `setNamedNoteOpacity` | `namedNoteOpacity` | `getNamedNoteOpacity` | `int` |
| `/vos` | `setSingleNoteOpacity` | `singleNoteOpacity` | `getSingleNoteOpacity` | `int` |
| `/vot` | `setTinyNoteOpacity` | `tinyNoteOpacity` | `getTinyNoteOpacity` | `int` |

Maintainer notes:

- Add a new `approved-values.js` registry entry whenever a menu caption, input default, or section-caption template needs live application state.
- Keep display tokens and action logic separate. `getValue()` is for rendering, not for performing side effects.

## Current Menu Inventory

### Top-level commands

| Path | Area | Main patterns in use |
| --- | --- | --- |
| `/f` | File | Leaf actions, input actions, confirmation submenu, plugin submenu, dialog launcher |
| `/s` | Section | Leaf actions, navigation submenu, confirmation submenu, input action, key-selection submenus, live counters in captions, dialog launcher |
| `/v` | View | Parent-handled choice menu, show/hide leaf actions, input actions, diagnostics submenu, fullscreen actions, dialog launcher |
| `/e` | Themes | Dialog launcher |
| `/t` | Tunings | Dialog launcher |
| `/i` | Fill | Dialog launcher |
| `/p` | Palette | Parent-handled choice menus, named semantic leaves, dialog launcher, one placeholder `role` entry |
| `/r` | Run | Loop toggles, live counters, navigation submenus |
| `/h` | Help | Simple leaf action |

### Current parent-handled choice menus

| Path | Parent action | Child values passed through `args.key` |
| --- | --- | --- |
| `/vm` | `setMenuPrefs` | `s`, `t` |
| `/pf` | `selectFingering` | `o`, `1`, `2`, `3`, `4`, `5`, `t` |
| `/pn` | `selectRadioNoteType` | `n`, `s`, `t`, `b`, `p`, `h`, `k`, `c`, `f` |

### Current confirmation menus

| Path | Question | Yes action | No action |
| --- | --- | --- | --- |
| `/fC` | Clear graveyard with backup | `downloadBackupThenClearGraveyard` | `noAction` |
| `/sed` | Delete current section | `sectionDelete` | `sectionKeep` |

### Current dynamic-caption menus

| Path | Caption state |
| --- | --- |
| `/se` | `[${currentSectionCardinal}/${sectionCount}]` |
| `/sb` | `[${currentBeat}/${beats}]` |
| `/rs` | `[${currentSectionCardinal}/${sectionCount}]` |
| `/rb` | `[${currentBeat}/${beats}]` |
| `/fC/Y` | `${graveyardRecordCount}` in confirmation caption |
| `/sed/Y` | Current section position in confirmation caption |

### Known edge cases in the current tree

| Node | Observation |
| --- | --- |
| `/pr` | `role` currently has no `action`, no `children`, and its parent `/p` also has no `action`, so it behaves like a placeholder rather than a working command. |
| `/fpi` | `pluginDaCapoWInput` currently logs the menu item but does not consume `args.daCapoInput`. |
| `gMenuLoaded` diagnostics | `gMenuLoaded` is a JSON string snapshot of `gMenuFile` taken before runtime navigation mutates nodes with `parent` and `bang`. This is useful when you want static authored JSON rather than live runtime state. |

## JavaScript Wiring for New Actions

The command menu does not call directly into every module from `menu.js`. The usual path is:

1. `menu.js` defines an `action` string.
2. `command-line.js` decides when to call `gCmdActionRunner(menuItem, args)`.
3. `key-handlers.js::performCmdAction()` switches on `menuItem.action`.
4. `key-handlers.js` reaches app functions through provider wrappers.
5. `infinite-neck.js::installModuleProviders()` supplies the real functions.

### When adding a new action string

1. Add or edit the node in `menu.js`.
2. Add a `case "yourAction"` branch in `performCmdAction()`.
3. If the action needs a helper not already exposed in `key-handlers.js`, add:
   - a `requireProvider()` wrapper in `key-handlers.js`, and
   - the concrete provider function in `infinite-neck.js::installModuleProviders()`.
4. If the command needs dynamic defaults or caption variables, extend `getValue()`.

### Provider pattern example

`key-handlers.js` does not directly own most app functionality. Instead it exposes local wrapper functions such as:

```js
function getSong(...args) { return requireProvider('getSong')(...args); }
function showOneMenu(...args) { return requireProvider('showOneMenu')(...args); }
```

Those are fulfilled by `infinite-neck.js` during startup via `setKeyHandlerProviders({...})`.

This means a new command often needs wiring in two places, not one:

- the `performCmdAction()` switch branch,
- and the provider registration path if the needed helper is new to `key-handlers.js`.


## Maintenance

### Expansion of vars and getValue() in menus

- Caption expansion only happens for menu items that declare a `vars` array.
- Caption placeholders now use `${token}` syntax only. There is no legacy `$token` handling in the menu runtime.
- `input.default` uses the same resolver path but stays as a bare token or literal such as `getBPM` or `0`; it does not use `vars`.
- The lists below are manual baselines captured from the current `menu.js` and should be updated when menu text or line numbers move.

- Here is the current caption-level `${token}` baseline from the menu definition.

| Command path | Raw string to expand | Vars names available on this menu item | menu.js line |
| --- | --- | --- | --- |
| `/fCY` | `<b>Y</b>es: CLEAR ${graveyardRecordCount} graveyard records !` | `graveyardRecordCount` | `81` |
| `/se` | `<b>e</b>dit<small>[${currentSectionCardinal}/${sectionCount}]</small>` | `currentSectionCardinal`, `sectionCount` | `202` |
| `/sedY` | `<b>Y</b>es: DELETE section ${currentSectionCardinal}/${sectionCount} !` | `currentSectionCardinal`, `sectionCount` | `214` |
| `/sb` | `<b>b</b>eats<small>[${currentBeat}/${beats}]</small>` | `currentBeat`, `beats` | `444` |
| `/rs` | `<b>s</b>ection<small>[${currentSectionCardinal}/${sectionCount}]</small>` | `currentSectionCardinal`, `sectionCount` | `1068` |
| `/rb` | `<b>b</b>eats<small>[${currentBeat}/${beats}]</small>` | `currentBeat`, `beats` | `1098` |

- Here is the current `input.default` baseline from `menu.js`. These do not use `vars`; they resolve through the same menu value resolver when the input prompt renders.

| Command path | Raw input.default string | menu.js line |
| --- | --- | --- |
| `/fn` | `getSongName` | `53` |
| `/fb` | `getBPM` | `66` |
| `/fat` | `0` | `133` |
| `/fak` | `0` | `146` |
| `/sc` | `getSectionCaption` | `256` |
| `/von` | `getNamedNoteOpacity` | `594` |
| `/vos` | `getSingleNoteOpacity` | `607` |
| `/vot` | `getTinyNoteOpacity` | `620` |


### Maintainer notes

- Prefer reusing existing app-level helpers instead of putting DOM logic directly into menu data.
- Keep `menu.js` declarative. Business logic belongs in `performCmdAction()` or deeper app functions.
- If a menu item only opens an existing panel, keep it as a lightweight `showDialog-*` action rather than inventing one-off UI code paths.

## Maintainer Checklist

Use this checklist when adding or changing commands.

1. Choose the correct pattern.
   - simple leaf action
   - input action
   - parent-handled choice menu
   - confirmation submenu
   - dialog launcher

2. Author the menu node correctly in `menu.js`.
   - `caption` present
   - `trigger` present and sibling-unique
   - trigger visibly marked in `<b>...</b>`
   - `action`, `children`, `input`, `vars`, `name`, `popOnBang` used intentionally

3. Wire the JavaScript side.
   - add or update `performCmdAction()`
   - extend provider wiring if needed
   - extend `getValue()` if using live caption/default tokens

4. Respect reserved inputs.
   - avoid lowercase `x`
   - avoid `/` as a child trigger
   - remember empty `Enter` means navigate up

5. Test the full flow manually.
   - open with `m` and with `/`
   - navigate by trigger path
   - submit input
   - verify breadcrumbs and prompt text
   - verify result line in the dropdown
   - verify pop behavior for confirmation or lingering menus

6. For input commands, verify all three layers.
   - prompt caption
   - displayed default
   - argument key in `args[input.id]`

7. For selector menus, verify parent dispatch.
   - child has no action
   - parent has action
   - parent reads `args.key`

Following these rules keeps the command menu predictable, keeps `menu.js` declarative, and keeps new commands aligned with the patterns the current REPL actually supports.