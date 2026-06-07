# Command Menu Validator With Dynamic Menus

This note is for developers and assistants working on `npm run validate:cmdmenu` in a menu system that is no longer fully static.

The validator was originally written for authored menu trees in `menu.js`. It now also needs to tolerate two intentional non-static patterns:

- runtime plugin subtrees added through `runtimeChildren`
- passive display rows that show live values but are not selectable menu items

The goal is not to weaken validation. The goal is to keep the validator strict for real authoring mistakes while teaching it the dynamic patterns the app intentionally supports.

## Core Rule

When the menu runtime grows a new legitimate pattern, update the validator to recognize that pattern explicitly.

Do not “fix” a validator error by forcing the menu authoring into a fake static shape that makes the runtime model worse.

## The Dynamic Patterns We Now Support

## 1. Runtime placeholder nodes

Example shape in `menu.js`:

```js
{
  name: 'pluginsRuntime',
  runtimeChildren: 'pluginManager',
  caption: '<b>p</b>lugins',
  trigger: 'p'
}
```

Meaning:

- this node is a real authored menu item
- its children are supplied at runtime, not statically in `menu.js`
- the validator must not warn that it is a selector leaf with no action
- the validator should count it so output makes the runtime shape visible

Current validator practice:

- increment `runtimeChildren menuItems`
- map known `runtimeChildren` providers to the action names they imply
- count those implied actions as referenced so dynamic plugin actions are not reported as dead cases

For the current plugin system, `runtimeChildren: 'pluginManager'` implies:

- `pluginAction:invoke`
- `pluginAction:bury`
- `pluginProperty:select`
- `pluginProperty:set`
- `pluginProperty:toggle`

If plugin runtime actions change, update that mapping in `bin/validate-command-menu.js`.

## 2. Passive display rows

Example shape in `menu.js`:

```js
{
  caption: 'current: [${spacebarActionName}]',
  vars: ['spacebarActionName']
}
```

Meaning:

- this row is visible
- it intentionally has no trigger
- it intentionally has no action
- it is not an input node
- it exists only to show live state inside a submenu

The validator must treat this as a valid display row, not as:

- a malformed child missing `trigger`
- a selector-style leaf with no action
- an `[input]` path

Current validator practice:

- detect this pattern as a passive display node
- assign it a path suffix like `/[display]`
- skip trigger-related errors and selector-leaf warnings for that node

## 3. Resolver-only live value tokens

Some live caption values come from `approved-values.js`.
Some come from explicit special cases in `key-handlers.js:getValue()`.

Example:

- `spacebarActionName` is currently handled directly in `getValue()`
- it is not part of the approved-values registry

The validator therefore needs two sources of truth for caption vars:

- approved-values entries
- literal resolver cases in `getValue()`

Current validator practice:

- scan `approved-values.js` through `listApprovedValues()`
- also scan the `getValue()` function body for literal `what === 'tokenName'` cases

This keeps the validator aligned with runtime reality without forcing every token into the approved-values registry.

## Best Practice For Fixing Validator Errors

Use this order.

1. Reproduce the exact output.

```bash
npm run validate:cmdmenu
```

2. Decide which class of problem it is:

- real menu authoring error in `menu.js`
- real dispatch mismatch in `key-handlers.js`
- real approved-values gap in `approved-values.js`
- legitimate dynamic pattern the validator does not know yet

3. If the runtime behavior is intentional and already works in the browser, prefer teaching the validator that pattern instead of distorting `menu.js`.

4. Keep validator exceptions narrow and named.

Good:

- `runtimeChildren: 'pluginManager'` implies these specific actions
- passive display rows are nodes with caption but no trigger/action/input/children

Bad:

- broad “ignore missing trigger” rules
- broad “ignore missing action” rules
- generic suppression of warnings by path without modeling the pattern

5. Re-run the validator until it is clean.

## Pattern Checklist

Before changing the validator, verify these runtime/menu facts.

### For runtime placeholders

- the node has a normal authored `caption`
- the node has a normal authored `trigger`
- the node identifies a specific runtime provider through `runtimeChildren`
- the runtime provider has a stable implied action set

### For passive display rows

- the row has a `caption`
- the row intentionally has no `trigger`
- the row intentionally has no `action`
- the row intentionally has no `input`
- the row intentionally has no children

If any of those are not true, it may be a real malformed node instead of a display row.

### For live caption vars

- if the token is a general-purpose approved variable, add it to `approved-values.js`
- if the token is intentionally local to `getValue()`, ensure the validator can discover that resolver case

## What Not To Do

- Do not add fake triggers just to silence the validator.
- Do not add fake no-op actions to passive display rows.
- Do not delete a real action case from `performCmdAction()` just because it is only used through runtime-generated menus.
- Do not move resolver-only values into `approved-values.js` unless they actually belong in the shared approved-values model.
- Do not weaken generic checks for the whole tree when only one dynamic pattern needs to be modeled.

## Recommended Maintenance Flow

When adding a new dynamic menu system:

1. implement the runtime behavior cleanly first
2. identify the stable authored placeholder shape in `menu.js`
3. identify the implied action set, if any
4. decide whether any rows are passive display rows
5. decide where live value tokens are resolved
6. teach `bin/validate-command-menu.js` those exact patterns
7. run `npm run validate:cmdmenu`
8. browser-test the real path

## Current Repository-Specific Rules

As of this document, the validator knows:

- `runtimeChildren: 'pluginManager'` is an intentional runtime subtree
- plugin runtime actions are valid even when not referenced statically in `menu.js`
- caption-only status rows such as `/fm/[display]` are valid
- `spacebarActionName` is a valid live caption token because `getValue()` resolves it directly

If a future assistant sees validator errors around plugin menus or the map-spacebar submenu, inspect these patterns first before changing the authored menu structure.