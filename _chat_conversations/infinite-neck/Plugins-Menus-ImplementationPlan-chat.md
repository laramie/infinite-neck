# Plugins Menus Implementation Plan

## Purpose

This document is the implementation plan for runtime plugin menus and plugin property editing in the command menu system.

This plan intentionally omits design alternatives already rejected in the Design Document. It describes the implementation we now intend to build.

## Implementation Summary

We will implement a runtime-generated subtree under the existing `/file/plugins` menu marker.

The implementation will use composition:

- `PluginManager` owns registered plugin instances and routing.
- each plugin instance owns or builds `MenuItemProxy` objects.
- menu nodes remain plain-object-compatible for the existing command menu runtime.
- plugin property editing and plugin actions are routed through generic action strings.

We will implement two plugins to validate the design:

1. `TransposePlugin`
2. `ArpeggioPlugin`

These will prove support for:

- numeric properties,
- boolean properties using strict JSON `true|false`,
- `org.dynamide.Select` as menu choices,
- array-of-integer input for `TransposePlugin.intervals`,
- runtime menu generation,
- plugin-local validation,
- and persistence of plugin user state only.

## Confirmed Decisions Incorporated In This Plan

The implementation plan assumes these decisions are final for the first coding pass:

- `HAS_A` / composition, not mix-in inheritance.
- `MenuItemProxy` is the runtime proxy name.
- `PropertyDefinition` and `PropertyState` are merged for now.
- menus are not persisted.
- plugin properties are authored by the plugin programmer.
- property triggers are hand-authored by the plugin programmer.
- plugin actions are stable strings, not function pointers.
- booleans use strict JSON text input now.
- `org.dynamide.Select` uses child menu choices, not free text.
- command results can use a simple message string.
- common plugin on/off lifecycle state is centralized rather than authored per-plugin as ordinary user-facing properties.

## Scope Of The First Implementation

### In scope

- runtime expansion of the `/file/plugins` node
- generic command dispatch for plugin property set/select/action
- value resolution for plugin menu defaults and captions
- central plugin registration and runtime lookup
- centralized plugin lifecycle state such as enabled/disabled
- plugin menu generation from plugin-authored property/action definitions
- `TransposePlugin` using array-of-integer `intervals`
- `ArpeggioPlugin` using `org.dynamide.Select` for `style`
- Song persistence for plugin user choices only

### Out of scope

- HTML property sheet UI
- general-purpose validator framework
- persisted menu schemas
- user-editable event lists
- multiple instances of the same plugin type per Song
- free-text select entry
- truthy/falsy aliases beyond strict JSON booleans

## Target Files

### Files to modify

- `plugins/PluginManager.js`
- `plugins/registerPlugins.js`
- `plugins/transpose/TransposePlugin.js`
- `plugins/arpeggio/ArpeggioPlugin.js`
- `menu.js`
- `command-line.js` only if a small runtime refresh hook is needed
- `key-handlers.js`
- Song persistence files after exact storage location is confirmed in code

### New files to add

- `plugins/MenuItemProxy.js`
- `plugins/PluginProperty.js`
- optionally `plugins/plugin-datatypes.js` if the shared coercion helpers start to grow

If the Song persistence code is currently concentrated in an existing persistence module, we will extend that module rather than introducing a parallel plugin persistence layer.

## Runtime Architecture To Implement

### 1. `MenuItemProxy`

Purpose:

- a plain-object-compatible runtime node for the command menu
- safe place for transient menu fields like `parent` and `bang`
- carrier for routing metadata such as `pluginId`, `propertyName`, and `actionName`

Planned shape:

```js
class MenuItemProxy {
	constructor(owner, spec = {}) {
		this.owner = owner;
		this.name = spec.name || '';
		this.caption = spec.caption || '';
		this.trigger = spec.trigger || '';
		this.action = spec.action || '';
		this.children = spec.children || [];
		this.input = spec.input || null;
		this.vars = spec.vars || [];
		this.popOnBang = !!spec.popOnBang;

		this.pluginId = spec.pluginId;
		this.propertyName = spec.propertyName;
		this.actionName = spec.actionName;
		this.value = spec.value;
	}
}
```

Notes:

- `owner` is runtime-only and will not be persisted.
- the command menu runtime may mutate `parent` and `bang`; that is acceptable here.

### 2. `PluginProperty`

Purpose:

- one merged definition-plus-current-value object for the first implementation
- hold metadata needed for menu generation and persistence
- coerce and validate values for simple datatypes

Planned shape:

```js
class PluginProperty {
	constructor(spec = {}) {}
	getMenuNodeSpec(plugin) {}
	getValue() {}
	setValue(rawValue, context) {}
	normalize(rawValue, context) {}
	toPersistedValue() {}
}
```

Supported first-pass datatypes:

- `Number`
- `boolean`
- `org.dynamide.Select`
- `org.dynamide.Action`
- `org.dynamide.IntegerArray`

Notes:

- `org.dynamide.IntegerArray` is introduced for `TransposePlugin.intervals`.
- JSON serialization is the storage boundary.
- validation result may remain simple in the first pass: `{ ok, value, message }` internally or just thrown/returned messages if that is simpler in the existing code style.

### 3. `PluginManager`

Purpose:

- central registry for plugin singletons per Song
- central enable/disable lifecycle management
- menu subtree generation
- routing target for generic plugin menu actions
- value resolver for live plugin defaults/captions

Planned responsibilities:

- register plugin instances
- keep lookup by plugin id
- build children for `/file/plugins`
- attach runtime children to the plugins marker node
- route `pluginProperty:set`
- route `pluginProperty:select`
- route `pluginAction:invoke`
- resolve tokens like `plugin:transpose:intervals`
- apply centralized enabled-state handling

Planned public methods:

```js
class PluginManager {
	register(pluginInstance) {}
	getRegisteredPlugins() {}
	getPluginById(pluginId) {}
	buildPluginsMenuChildren() {}
	refreshPluginsMenuNode(rootMenu) {}
	invokeMenuAction(menuItem, args) {}
	resolveValue(token) {}
	loadSongPluginState(song) {}
	exportSongPluginState() {}
}
```

### 4. Plugin instances

Purpose:

- hold plugin-authored property metadata
- hold current user-facing values
- expose menu children
- validate changes against live app state
- implement stable named actions
- subscribe to configured events when enabled

Planned shared shape:

```js
class PluginInstance {
	getId() {}
	getRegisteredName() {}
	getEventNames() {}
	getProperties() {}
	getProperty(name) {}
	getVisibleMenuChildren() {}
	setPropertyValue(name, rawValue, context) {}
	selectPropertyValue(name, selectedValue, context) {}
	invokeAction(actionName, context) {}
	enable(context) {}
	disable(context) {}
	exportSongState() {}
}
```

This does not require a formal base class on day one. A shared pattern is sufficient unless duplication becomes noisy.

## Menu Integration Plan

### Existing marker

The current `menu.js` already contains:

```json
{
	"caption": "<b>p</b>lugins",
	"trigger": "p"
}
```

We will treat this as the runtime placeholder marker.

### Planned behavior

At startup, or before the command menu is first displayed, the plugin system will find that node and attach generated children.

Planned result:

```json
{
	"caption": "<b>p</b>lugins",
	"trigger": "p",
	"children": [
		{
			"caption": "<b>t</b>ranspose",
			"trigger": "t",
			"pluginId": "transpose",
			"children": [
				{
					"caption": "<b>i</b>ntervals [$plugin:transpose:intervals]",
					"trigger": "i",
					"action": "pluginProperty:set",
					"pluginId": "transpose",
					"propertyName": "intervals",
					"input": {
						"type": "input",
						"caption": "JSON integer array",
						"default": "plugin:transpose:intervals",
						"datatype": "org.dynamide.IntegerArray",
						"id": "value"
					}
				}
			]
		}
	]
}
```

Notes:

- generated children will replace the old static plugin examples
- `menu.js` remains the source of the placeholder only
- runtime-generated nodes will be ordinary plain-object-compatible nodes

### Refresh strategy

We will prefer explicit refresh over lazy getters.

Planned approach:

1. `registerPlugins.js` builds the plugin manager and plugin instances.
2. plugin manager finds the `/file/plugins` node in `gMenuFile`.
3. plugin manager assigns `children` on that node.
4. when plugin state changes, plugin manager may rebuild that subtree if captions/defaults need refresh.

This fits the current menu runtime better than lazy child generation.

## Generic Command Actions To Implement

We will add a small plugin-aware path in `key-handlers.js::performCmdAction()` for these action strings:

- `pluginProperty:set`
- `pluginProperty:select`
- `pluginAction:invoke`

### `pluginProperty:set`

Use for:

- `Number`
- `boolean`
- `org.dynamide.IntegerArray`

Behavior:

- extract `args[input.id]`
- route to `pluginManager.invokeMenuAction(menuItem, args)`
- plugin manager finds the plugin and property
- plugin validates and normalizes the value
- command returns a simple message string

### `pluginProperty:select`

Use for:

- `org.dynamide.Select`

Behavior:

- parent node owns the action
- child menu item supplies the chosen `value`
- plugin manager routes the selection to the plugin property
- command returns a simple message string

### `pluginAction:invoke`

Use for:

- plugin-authored actions such as `apply`, `reset`, or `help`

Behavior:

- plugin manager finds plugin by `pluginId`
- plugin manager calls `plugin.invokeAction(actionName, context)`
- result string goes to command results

## Value Resolution Plan

We will extend `key-handlers.js::getValue()` to delegate plugin tokens to `PluginManager.resolveValue()`.

Token format:

```text
plugin:{pluginId}:{fieldName}
```

Examples:

- `plugin:transpose:intervals`
- `plugin:transpose:NamedNotes`
- `plugin:arpeggio:minFret`
- `plugin:arpeggio:maxFret`
- `plugin:arpeggio:style`
- `plugin:arpeggio:maxAllowedFret`

Use cases:

- input defaults
- dynamic captions
- lightweight help/report text later if needed

## Centralized Lifecycle State

The standard plugin lifecycle flags will be centralized rather than exposed as ordinary user-facing plugin properties.

Centralized state per plugin:

- `enabled`
- any startup policy needed to enable on Song load

This state will be managed by `PluginManager` and persisted with Song.

The plugin-specific user-facing properties will remain separate.

## Plugin Persistence Plan

Song persistence will store only:

- plugin id
- centralized enabled-state fields
- user-facing property values

### Planned persisted shape

```json
{
	"plugins": [
		{
			"id": "transpose",
			"enabled": true,
			"enableOnSongLoad": true,
			"properties": {
				"intervals": [0, 5, 7],
				"NamedNotes": true,
				"PlayedNotes": false,
				"RecordedNotes": false
			}
		},
		{
			"id": "arpeggio",
			"enabled": false,
			"enableOnSongLoad": false,
			"properties": {
				"minFret": 0,
				"maxFret": 12,
				"lowToHigh": true,
				"upOnly": false,
				"style": "alternate"
			}
		}
	]
}
```

Notes:

- this plan uses JSON-native booleans and arrays, not stringified pseudo-JSON
- runtime menu input may still enter strings first, but normalization will convert to the persisted JSON-native value

## Plugin Definitions To Implement

### `TransposePlugin`

File:

- `plugins/transpose/TransposePlugin.js`

User-facing properties:

- `intervals`: `org.dynamide.IntegerArray`
- `NamedNotes`: `boolean`
- `PlayedNotes`: `boolean`
- `RecordedNotes`: `boolean`

Planned plugin actions:

- `apply`
- optionally `help` if useful during the first pass

Validation rules:

- `intervals` must parse as a JSON array
- every item in `intervals` must be an integer
- the empty array is probably invalid for first implementation unless explicitly desired
- booleans must be strict JSON `true` or `false` when entered through text input

Runtime notes:

- `intervals[0]` represents the current Song base state
- the plugin will own the ingestion and stepping logic for interval progression
- the implementation plan does not dictate the transpose algorithm internals beyond providing the values cleanly to the plugin

Example persisted values:

- `[0,1,2,3,4,5,6,7,8,9,10,11]`
- `[0,5,7]`

### `ArpeggioPlugin`

File:

- `plugins/arpeggio/ArpeggioPlugin.js`

User-facing properties:

- `minFret`: `Number`
- `maxFret`: `Number`
- `lowToHigh`: `boolean`
- `upOnly`: `boolean`
- `style`: `org.dynamide.Select`

`style` options:

- `every`
- `alternate`
- `random`

Planned plugin actions:

- `apply`
- optionally `help`

Validation rules:

- `minFret` and `maxFret` must parse as integers
- legal range depends on the current instrument/tuning context
- `minFret <= maxFret`
- `style` must be one of the authored options
- booleans must be strict JSON `true` or `false`

Runtime notes:

- this plugin proves live validation against current instrument state
- this plugin proves select-style menu choices

## Property Authoring Format

For the first implementation, each plugin will define its property metadata in code unless a local `properties.json` already makes implementation cleaner.

The minimum property spec shape to support code generation is:

```json
{
	"name": "style",
	"caption": "style",
	"trigger": "s",
	"datatype": "org.dynamide.Select",
	"value": "alternate",
	"defaultValue": "every",
	"inputCaption": "choose style",
	"options": [
		{ "value": "every", "caption": "every", "trigger": "e" },
		{ "value": "alternate", "caption": "alternate", "trigger": "a" },
		{ "value": "random", "caption": "random", "trigger": "r" }
	],
	"visibleInMenu": true
}
```

Required first-pass fields:

- `name`
- `caption`
- `trigger`
- `datatype`
- `value`
- `defaultValue`
- `visibleInMenu`

Conditionally required:

- `inputCaption` for input-based datatypes
- `options` for `org.dynamide.Select`
- `actionName` for `org.dynamide.Action`

## Implementation Sequence

### Step 1. Add runtime menu proxy and shared property helper

Create:

- `plugins/MenuItemProxy.js`
- `plugins/PluginProperty.js`

Deliverable:

- shared runtime structures exist
- simple coercion helpers exist for the first datatypes

### Step 2. Rework `PluginManager` into a real runtime coordinator

Modify:

- `plugins/PluginManager.js`

Deliverable:

- plugin registration by id
- menu subtree generation
- lifecycle enable/disable
- action routing
- value resolution

### Step 3. Rework `registerPlugins.js`

Modify:

- `plugins/registerPlugins.js`

Deliverable:

- instantiate plugin instances, not loose config objects
- register both plugins with the manager
- inject event bus and any needed app services
- refresh the `/file/plugins` subtree at startup

### Step 4. Implement `TransposePlugin`

Modify:

- `plugins/transpose/TransposePlugin.js`

Deliverable:

- authored properties for `intervals`, `NamedNotes`, `PlayedNotes`, `RecordedNotes`
- menu children generation
- property normalization and validation
- stable actions such as `apply`
- event handling using centralized manager lifecycle

### Step 5. Implement `ArpeggioPlugin`

Modify:

- `plugins/arpeggio/ArpeggioPlugin.js`

Deliverable:

- authored properties for `minFret`, `maxFret`, `lowToHigh`, `upOnly`, `style`
- select menu children for `style`
- validation against live fret/instrument constraints
- stable actions such as `apply`

### Step 6. Add generic plugin dispatch to `key-handlers.js`

Modify:

- `key-handlers.js`

Deliverable:

- new generic action cases
- delegation to plugin manager
- plugin token resolution via `getValue()`
- simple result messages returned to command results

### Step 7. Wire plugin menu refresh into menu startup/runtime

Modify as needed:

- `menu.js`
- `command-line.js`
- or startup wiring file if a cleaner hook already exists

Deliverable:

- `/file/plugins` marker is populated before user enters the menu
- subtree can be refreshed when plugin state changes if needed

The preferred path is to do this without complicating `command-line.js`.

### Step 8. Extend Song persistence

Modify the existing Song persistence modules after locating the authoritative files.

Deliverable:

- plugin state loads from Song
- plugin state exports back to Song
- persisted values remain JSON-native

### Step 9. Validate with targeted manual and automated tests

Deliverable:

- menu generation verified
- property editing verified
- persistence verified
- both plugins coexisting verified

## Command Menu Shapes To Generate

### Input-backed property node

Used for `Number`, `boolean`, and `org.dynamide.IntegerArray`.

```json
{
	"caption": "<b>i</b>ntervals [$plugin:transpose:intervals]",
	"trigger": "i",
	"action": "pluginProperty:set",
	"pluginId": "transpose",
	"propertyName": "intervals",
	"input": {
		"type": "input",
		"caption": "JSON integer array",
		"default": "plugin:transpose:intervals",
		"datatype": "org.dynamide.IntegerArray",
		"id": "value"
	}
}
```

### Select-backed property node

Used for `org.dynamide.Select`.

```json
{
	"caption": "<b>s</b>tyle [$plugin:arpeggio:style]",
	"trigger": "s",
	"action": "pluginProperty:select",
	"pluginId": "arpeggio",
	"propertyName": "style",
	"children": [
		{
			"caption": "<b>e</b>very",
			"trigger": "e",
			"value": "every"
		},
		{
			"caption": "<b>a</b>lternate",
			"trigger": "a",
			"value": "alternate"
		},
		{
			"caption": "<b>r</b>andom",
			"trigger": "r",
			"value": "random"
		}
	]
}
```

### Action node

Used for plugin-authored actions.

```json
{
	"caption": "<b>a</b>pply",
	"trigger": "a",
	"action": "pluginAction:invoke",
	"pluginId": "transpose",
	"actionName": "apply"
}
```

## Runtime Flow To Implement

### Startup flow

1. app startup creates plugin manager
2. `registerPlugins.js` instantiates `TransposePlugin` and `ArpeggioPlugin`
3. plugin manager registers them
4. plugin manager finds `/file/plugins` marker and installs generated children
5. plugin manager loads persisted Song state if available
6. manager applies enabled-state policy and wires events

### Menu input flow for a normal property

1. user opens `/file/plugins`
2. user chooses plugin node
3. user chooses property node
4. menu input collects raw text
5. `performCmdAction()` routes to `pluginProperty:set`
6. plugin manager finds plugin and property
7. property/plugin normalizes and validates
8. plugin updates live state
9. plugin manager optionally refreshes plugin subtree captions/defaults
10. command results show a simple message

### Menu flow for a select property

1. user chooses select property node
2. child options are shown
3. user selects option trigger
4. `performCmdAction()` routes parent action with child value
5. plugin manager updates the property
6. results show a simple message

### Plugin event flow

1. manager enables plugin
2. manager wires plugin event names to plugin handler
3. event bus fires event
4. plugin instance receives payload and current property values
5. plugin performs its runtime behavior

## Acceptance Criteria

The first implementation is complete when all of the following are true:

1. `/file/plugins` shows runtime-generated plugin entries for both plugins.
2. `TransposePlugin` properties can be inspected and edited from the command menu.
3. `ArpeggioPlugin` properties can be inspected and edited from the command menu.
4. `style` is selected through child menu choices, not text entry.
5. `intervals` accepts JSON arrays of integers and rejects invalid input with a message.
6. booleans accept strict JSON `true` and `false`.
7. changing a property updates the live plugin state.
8. plugin actions can be invoked from the menu.
9. both plugins can coexist in the registry and menu without collisions.
10. plugin user state persists through Song save/load.

## Testing Plan

### Manual verification

1. open command menu and navigate to `/file/plugins`
2. confirm both plugin names appear
3. edit `TransposePlugin.intervals` with `[0,5,7]`
4. edit `TransposePlugin.intervals` with invalid JSON and confirm a clear failure message
5. edit boolean properties with `true` and `false`
6. change `ArpeggioPlugin.style` through menu choices
7. verify `minFret` / `maxFret` validation behavior
8. invoke plugin actions from menu
9. save and reload Song, then confirm plugin state restored

### Automated verification

Add or extend targeted tests for:

- plugin manager registration and lookup
- menu subtree generation
- property normalization for integer array, boolean, number, select
- plugin token resolution
- Song plugin-state serialization/deserialization

Use the repo's existing Jest entrypoints rather than plain `npx jest`.

## Notes For Code Generation

When generating code from this plan:

- prefer small, explicit helpers over a broad framework
- keep command-menu changes minimal and generic
- keep plugin-specific logic inside plugin files
- preserve the existing menu runtime contract of plain field access
- do not reintroduce DaCapo-era complexity
- keep persisted plugin data JSON-native

## Questions To Resolve During Coding Only If Needed

These do not block the plan, but they may need confirmation when we touch the code:

1. which Song persistence file is the authoritative storage point for plugin state
2. whether plugin subtree refresh after each property change is necessary immediately, or whether token-based defaults/captions already make it sufficient
3. whether centralized enabled-state should be shown in the menu in phase one, or remain runtime/persistence-only until a later pass

None of these questions require revisiting the design direction before starting implementation.

## Addenda

Persistence in songfile should be:
./plugins/transpose/
./plugins/arpeggio/

e.g. 


