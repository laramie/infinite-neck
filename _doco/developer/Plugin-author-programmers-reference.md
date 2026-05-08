# Plugin Author Programmer's Reference

## Roadmap

This note documents the current plugin architecture for developers who already know the menu system, EventBus, Song model, and repository startup flow.

The current plugin system spans these modules:

- `plugins/PluginManager.js`
- `plugins/pluginRuntime.js`
- `plugins/registerPlugins.js`
- `plugins/PluginProperty.js`
- individual plugin modules such as `plugins/transpose/TransposePlugin.js` and `plugins/arpeggio/ArpeggioPlugin.js`

The shortest accurate summary is:

1. `PluginManager.js` owns runtime registration, menu integration, persistence, enable/disable state, and EventBus subscriptions.
2. `PluginProperty.js` owns typed property normalization and menu-node generation from property metadata.
3. each plugin module owns its own behavior, property metadata, and event handling.
4. `registerPlugins.js` is where plugin instances are registered into the runtime.

## Minimum Plugin Shape

A plugin is a class instance registered with `pluginManager.register(new YourPlugin())`.

The current de facto interface is demonstrated by both `TransposePlugin` and `ArpeggioPlugin`.

At minimum a plugin should provide:

- `constructor()`
- `setManager(manager)`
- `getId()`
- `getRegisteredName()`
- `getMenuTrigger()`
- `getEventNames()`
- `getProperties()`
- `getProperty(name)`
- `getVisibleMenuChildren()`
- `resetToDefaults()`
- `loadSongState(persistedProperties)`
- `exportSongState()`
- `setPropertyValue(name, rawValue, context)`
- `enable(context)`
- `disable(context)`
- `handleEvent(eventName, payload, context)`
- `invokeAction(actionName, context)`

Optional but commonly useful:

- `resolveValue(fieldName, context)` for menu variable substitution

## Registration Path

The current startup path is:

1. `plugins/pluginRuntime.js` creates the singleton `pluginManager`
2. `plugins/registerPlugins.js` imports plugin classes and registers instances
3. `pluginManager.refreshPluginsMenuNode()` rebuilds the runtime plugins subtree inside the menu model

To add a new plugin today:

1. create a directory under `plugins/your-plugin/`
2. create the plugin class module
3. create a `properties.json` metadata file if the plugin has user-facing properties
4. import and register it in `plugins/registerPlugins.js`

That is the minimal bootstrap.

## Property Metadata Model

The current property system is metadata-driven.

Both existing plugins load properties from JSON and wrap them with `new PluginProperty(spec)`.

Supported property categories currently used in the repository include:

- `Number`
- `org.dynamide.toggle`
- `org.dynamide.Select`
- `org.dynamide.IntegerArray`
- `org.dynamide.Action`

`PluginProperty.js` provides:

- normalization
- default handling
- persistence values
- runtime menu-node generation

That means most new plugin menu UI should be added in metadata first, not by hand-writing menu items.

## Runtime Menu Integration

The plugin runtime subtree is built dynamically by `PluginManager.buildPluginsMenuChildren()`.

Each plugin contributes:

1. two manager-owned boolean nodes
   - `enabled`
   - `enableOnSongLoad`
2. plugin-owned property nodes returned from `getVisibleMenuChildren()`

This means a new plugin automatically gets:

- runtime menu placement
- enable toggle
- load-on-song-open toggle

without having to hand-edit the static menu for those common controls.

## Persistence Contract

Plugin persistence is stored under `song.plugins[pluginId]`.

The current persisted shape is:

```json
{
  "yourPluginId": {
    "enabled": false,
    "enableOnSongLoad": false,
    "properties": {
      "someProperty": "value"
    }
  }
}
```

Important detail:

- `loadSongPluginState(song)` in `PluginManager.js` resets plugin defaults first, then overlays persisted property state, then applies `enableOnSongLoad`

If your plugin keeps internal runtime-only state beyond property values, make sure `resetToDefaults()` and `loadSongState()` both reset it coherently.

`TransposePlugin.resetIntervalState()` is the current simple example of this pattern.

## Event Model

Plugins do not subscribe to EventBus directly in their own constructors.

Instead:

1. the plugin reports desired EventBus names through `getEventNames()`
2. `PluginManager.enablePluginEntry()` installs handlers for those names
3. `PluginManager.disablePluginEntry()` removes them

This is the current contract for enable/disable hygiene.

Reason:

- plugin enable state and EventBus subscriptions stay in one place
- disabled plugins do not keep stale handlers attached

If a new plugin needs a new runtime event, add it to `getEventNames()` and handle it in `handleEvent(...)`.

## Action Model

User-triggered plugin actions are currently routed through `invokeAction(actionName, context)`.

Examples:

- `TransposePlugin` supports `apply` and `help`
- `ArpeggioPlugin` supports `apply`, `clear`, and `help`

If a property is declared with `datatype = org.dynamide.Action`, `PluginProperty.getMenuNodeSpec()` builds the correct menu action node automatically.

## Minimal Plugin Authoring Pattern

The smallest maintainable pattern in this repository today is:

1. metadata-backed properties in `properties.json`
2. plugin constructor that builds `PluginProperty` instances and a `propertyMap`
3. pure-ish helper methods for the plugin's internal domain logic
4. thin `handleEvent(...)` and `invokeAction(...)` entry points
5. focused Jest coverage for the plugin file

This is preferable to burying logic inside menu handlers or EventBus callbacks.

## Existing Plugin Examples

These are examples, not templates to copy blindly.

### `TransposePlugin`

Useful as the simple example.

It demonstrates:

- property-driven configuration
- runtime-only internal state (`currentIntervalIndex`, `currentAppliedInterval`)
- one event trigger (`DaCapo:OnSongEnd`)
- one direct domain action (`transposeSong(...)`)

Use this plugin as the model when your plugin is mostly model manipulation with modest UI surface area.

### `ArpeggioPlugin`

Useful as the complex example.

It demonstrates:

- multiple property types
- multiple runtime events
- owner-tagged model writes
- DOM-only UI intent emitted over EventBus
- interaction with `colorFunctions.js`, `NoteTableController.js`, `looper.js`, and Song UI refresh events

Use Arpeggio as the model when your plugin needs to coordinate model state, playback timing, and temporary UI presentation.

## Maintenance Points

### When adding a new plugin

Check all of these:

- `plugins/registerPlugins.js`
- your plugin module
- your plugin `properties.json`
- focused Jest tests

### When adding a new property type

Check `PluginProperty.js` first.

The current property system is centralized there. Do not work around it per-plugin unless you want a long-term maintenance fork.

### When adding new runtime menu behavior

Check `PluginManager.js`.

The menu action strings such as:

- `pluginProperty:set`
- `pluginProperty:toggle`
- `pluginProperty:select`
- `pluginAction:invoke`

are currently interpreted there.

### When adding a plugin that manipulates UI state

Prefer this split:

- plugin computes intent
- EventBus carries intent
- UI/controller layer performs DOM work

Arpeggio's named-note reveal path is the current example of that split.

### When adding a plugin that manipulates model state

Prefer explicit owner tagging if the plugin writes structures that coexist with user-authored content.

Arpeggio's generated notes use `owner = 'ArpeggioPlugin'` for this reason.

## Practical Summary

For future plugin authors, the shortest accurate workflow is:

1. create a plugin class and metadata file
2. implement the standard plugin methods used by `PluginManager`
3. register the instance in `registerPlugins.js`
4. let `PluginProperty.js` generate your menu nodes from metadata whenever possible
5. persist only configuration in `exportSongState()`, and reset runtime-only state in `resetToDefaults()`
6. keep EventBus subscription ownership in `PluginManager`, not in plugin constructors
7. add focused Jest tests before depending on the plugin in authored songs