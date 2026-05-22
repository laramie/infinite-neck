# Design Document

- Purpose: Architecture for getting Properties from the command-line Menu system to the Plugins, which are modules that plug into infinite-neck without changing the infinite-neck user input interface, but do affect the data model layer such as SectionNotes and run-time behavior such as looping.

## Design Guidelines

- This document governs the design.  

- This H1 section, "Design Document", will be relevant for all Iterations, re-read it every time, as we'll continue to update it.

- This document is structured in H1 sections, one per each design iteration [ "Iteration 1", "Iteration 2"] as H1 headings.  Copilot should work in the new, stubbed out section at the end of the document on each iteration.

- Each Iteration Copilot works on will be preceded by an Iteration where we discuss new items or respond to previous Copilot reports, So we would put a request in Iteration 1, Copilot would respond in Iteration 2, we would respond in Iteration 3, and so on.  We won't change Iteration texts prior to the current request.  But we will update this section "Design Document" to include results of our iterations.

- No code changes to the repository other than changing this document.

- Early iterations may include discussion and hand-waving. Pseudo-code and commented out code, methods, and properties are welcome and allowed.  We'll specify as we go to later iterations when code should be runnable and ready to paste into the repository.

- Early iterations should include Copilot design proposals, which should focus on clean code design, modern, idiomatic ES6 usage, and design patterns proven to be robust, easy to maintain and understand, and elegant.

- We tend not to be strict about using model, view, or controller classes and design patterns or frameworks, but we do want separation of concerns in the design regarding data model, presentation layer, and controllers.

- Please ask us to make corrections, clarifications, and flesh out designs in the Design Document section.  Make these requests in the Copilot Iteration sections, and we will update the Design Document section.


## Areas of the current design
- Plugins : currently in ./plugins/
    - we like:
        - ./plugins/PluginTransposeSong.js
        - ./plugins/PluginFillChord.js
        - these are ridiculously simple.  PluginTransposeSong actually works, and PluginFillChord is a placeholder, but they work because EventBus and infinite-neck are broadcasting the events and these plugins fire.
    
    - we don't like DaCapo.js, as it is experimental and overcomplicated.  During implementation, it required changes to Looper.js, which then emitted EventBus events, which turned out to be the valuable part.  So the EventBus events that start with "DaCapo:" are essential--they are the real driver of the Plugin system.

    - we have a simple stub in ./plugins/registerPlugins.js which blindly registers plugins and wires their events.  It works but has no control for delaying starts of the Plugins.  It uses the PluginManager.js which is simple and works, but may need extension.  
    - ./plugins/PluginRegistry.js is probably an artifact we'll ditch.     
    
    - we need: 
        - to configure the plugins via a JSON object which will be persisted in Song thus in the song file.

        - to have each plugin have common properties we'll define in the iterations, but at the minimum: 
            - "on" : if "on" is true, the plugin should have it's events wired.
            - "enableOnSongLoad" : if true, "on" becomes true when the Song is loaded.
            - "events" : a string Array with event names.  Gets mappped to functions.
            - "properties" 
                - property values that map to value Menu item inputs
                - actions that map to Menu item actions. These would have the string value of a "doIt()" function, and a datatype of org.dynamide.Action.

        - to provide an editor for this plugin configuration.  Rather than build a UI, we want to configure the properties via our command-line menu system.  However, our menu system is based on JSON tree-structured data, and does not currently have live Javascript objects participate as nodes except as built by the Menu system.  We'd like to change that, since the system was supposedly built to support adding MenuItem instances that are ES class instances.

        - to begin work on our Properties Model, which is a set of datatypes, default values, editors, validators, and property sheets to pass around a basic Property object that contains name and value, plus a host of supporting properties such as datatype, caption, etc.  We'd like enough work on this system so that we can use the Menu system.  We don't need editors, validators, or property sheet UI yet. 

## Properties Model

- We have had success with a Properties model before, and would like to design that in ES6 for this application.  It may have broader use in our app, but for now, we will use it to support wiring the plugins to the Menu system.

- The basic features of the Properties model:
    - every javascript property on a participating Object has a Property object: 
        - Property : is a class, call its instance "prop".
            - name : shadows the actual property name so that at some point in the code we can say: 
            `targetObject[prop.name] = prop.value`
            - value : a String value.  Will always be at least an empty string, not null or undefined.  Gets assigned to the target object under the Property.name
            - datatype : an identifier into a namespace of datatypes, the simple ones of which represent ES types
                - String
                - Number
                - boolean
                - org.dynamide.Select : maps to a SELECT element when presentation is HTML, or a text menu list when presentation is the Menu system.  Used instead of Array when the list of choices is known, but probably persisted and passed as a string Array.  
                - org.dynamide.Choice : maps to a radio button
                - org.dynamide.State : maps to a pair of exclusive buttons shown side-by-side with pairs of css classes for on/off, or could map to a button with in/out state.  UI presentation layer would choose widget type.
                - org.dynamide.Action : maps to buttons on the UI side, and ES functions or function names on the code side
            - editor : a class that validates values and runs rules.  Not planned for this design.
            - defaultValue 
            - datasource : some hand-waving here: we've wired these things up to data providers and default pick-lists before, but are unsure of the shape of these at this point.    


### Current Menu system: 

- module command-menu.js handles the menu tree runtime

- the menu structure is stored here: 
    - menu.js

- Documentation exists here: 
    - _doco/design/command-menu-authoring-quick-start.md
    - _doco/design/command-menu-programmers-reference.md

### Getting user input from a menu item today

Here, in particular, is how DaCapo handles its user inputs for its properties.  (DaCapo is an overly complicated bit of code: it has been replaced by TransposePlugin, which simply registers globally and listens for EventBus events.)  But DaCapo gets user inputs in a way that we'd like to support for the next version of TransposePlugin and any others.

```
        {
          "caption": "<b>p</b>lugins",
          "trigger": "p",
          "children": [
            {
              "name": "inputsDaCapo",
              "caption": "<b>i</b>nputs to DaCapo",
              "trigger": "i",
              "action": "pluginDaCapoWInput",
              "input": {
                "type": "input",
                "caption": "JSON config",
                "defaultWorked": "{'named':true,'played':true}",
                "default": {'amount': 1, 'NamedNotes':true, 'PlayedNotes':true, 'RecordedNotes':true},
                "datatype": "json",
                "id": "daCapoInput"
              }
            },
            {
                "name": "daCapo",
                "caption": "<b>d</b>aCapo",
                "trigger": "d",
                "action": "pluginDaCapo"
            }
          ]
        }
        
```            

## Persistence
- assume all classes can be stored as JSON data, and if they have nested collections, they can follow the model used in 
    - Song/SongPersistence
    - Section/SectionPersistence
    - SectionNotes/SectionNotesPersistence

# Iteration 1
In Iteration 2 we'd like to: 
    1) define the JSON object structure of necessary objects which will be class instance at runtime.
    2) define the necessary interfaces/available methods on classes to participate in the Menu system
    3) find holes in the Properties model

## Requests

- Copilot: please work in Iteration 2.
- Please produce an analysis of how viable it is to make a simple set of classes that will participate in the Menu system as MenuItem with children arrays, actions, and inputs.
- Please produce JSON object structures or fill out proposed structure as needed to further the discussion.  However in this iteration, don't worry about completing this aspect of the design: we would like to get a handle on scope and feasibility first.


# Iteration 2 

## Summary

Short version: this is viable, but it is more viable if runtime class instances do not become the menu tree directly.

The current command menu already works with plain JavaScript objects that have the shape:

- `caption`
- `trigger`
- `children`
- `action`
- `input`
- `vars`
- `name`
- `popOnBang`

That means a simple class-backed design is feasible now if class instances either:

1. expose exactly those fields as plain enumerable properties, or
2. more safely, materialize plain menu-node objects for the menu runtime.

I recommend option 2.

## Read Of The Current Code

From the current implementation:

- The command menu runtime is object-shape driven, not type-driven.
- `command-line.js` does direct property access such as `child.trigger`, `child.action`, `child.input`, and `menu.children`.
- The runtime mutates menu nodes with transient state such as `parent` and `bang`.
- Actions are dispatched by string name through `performCmdAction(menuItem, args)` in `key-handlers.js`.
- Input defaults and caption variables are resolved through string tokens in `getValue()`.

That gives us an important design boundary:

- plain object menu nodes already fit the system well,
- live class instances can participate only if they tolerate direct property reads and runtime mutation,
- direct method dispatch from the menu is not a first-class feature today,
- and property editing will need an action-routing layer, not just more JSON.

## Viability Assessment

### 1. Simple class instances participating as menu nodes

Viability: medium to high.

This is feasible if the instances are intentionally lightweight and mostly data-shaped. Example: a `PluginMenuNode` instance with `caption`, `trigger`, `children`, and `action` fields will likely work.

The main risks are:

- the menu runtime mutates nodes by assigning `parent` and `bang`,
- persistence should not accidentally include those transient fields,
- and class methods do not buy much unless there is an adapter or registry that calls them.

### 2. A simple set of classes participating in the menu system through adapters

Viability: high.

This is the cleaner direction.

The design would be:

- persisted JSON stores plugin state and property values,
- runtime classes rehydrate that state,
- runtime classes produce plain menu-node objects,
- menu actions route back into plugin/property instances through stable action identifiers.

This keeps the current menu system intact while allowing richer runtime behavior behind it.

### 3. Directly persisting runtime menu class instances in Song

Viability: low to medium.

I do not recommend persisting the live menu tree itself. The current menu tree has runtime-only concerns like `parent`, `bang`, and dynamic defaults. Persisting the menu tree would mix:

- presentation concerns,
- runtime navigation state,
- and the song's durable plugin configuration.

That would raise complexity quickly.

## Main Recommendation

Reduce scope by separating three concerns explicitly:

1. `PluginTypeDefinition`: code-owned metadata for a plugin type.
2. `PluginInstanceState`: persisted song data for one configured plugin instance.
3. `MenuNode`: ephemeral plain objects generated from runtime state for the command menu.

This gives the menu system what it already wants, while allowing plugins and properties to become real classes.

## Proposed JSON Structures

I think the important design move is to avoid persisting the full property schema in every song unless the schema itself is intended to be user-editable. If not, store the schema in code and persist only instance state plus values.

### Proposed persisted song structure

```json
{
    "plugins": [
        {
            "instanceId": "transpose-main",
            "pluginType": "PluginTransposeSong",
            "caption": "Transpose Song",
            "on": false,
            "enableOnSongLoad": true,
            "events": [
                "DaCapo:OnSongEnd",
                "DaCapo:OnSectionBegin"
            ],
            "propertyValues": {
                "amount": "1",
                "NamedNotes": "true",
                "PlayedNotes": "false",
                "RecordedNotes": "false"
            }
        }
    ]
}
```

Notes:

- `instanceId` is important if later you allow more than one instance of the same plugin type.
- `pluginType` should be the registry key, not a file path.
- `propertyValues` should contain persisted values only, not runtime functions.
- `events` may be persisted if you want per-song overrides. If not, this should move to the plugin type definition in code.

### Proposed code-owned plugin type definition

```json
{
    "pluginType": "PluginTransposeSong",
    "defaultCaption": "Transpose Song",
    "defaultOn": false,
    "defaultEnableOnSongLoad": true,
    "defaultEvents": [
        "DaCapo:OnSongEnd",
        "DaCapo:OnSectionBegin"
    ],
    "properties": [
        {
            "name": "amount",
            "caption": "Transpose amount",
            "datatype": "Number",
            "defaultValue": "1"
        },
        {
            "name": "NamedNotes",
            "caption": "Affect named notes",
            "datatype": "boolean",
            "defaultValue": "true"
        },
        {
            "name": "PlayedNotes",
            "caption": "Affect played notes",
            "datatype": "boolean",
            "defaultValue": "false"
        },
        {
            "name": "RecordedNotes",
            "caption": "Affect recorded notes",
            "datatype": "boolean",
            "defaultValue": "false"
        },
        {
            "name": "applyNow",
            "caption": "Apply now",
            "datatype": "org.dynamide.Action",
            "action": "plugin:transpose-main:applyNow"
        }
    ]
}
```

Notes:

- The `org.dynamide.Action` value should be a stable action identifier, not source code for a function body.
- I would keep `caption` and menu trigger metadata outside the core property model unless you want every property to be editable through the menu.

### Proposed ephemeral menu node generated at runtime

```json
{
    "name": "transpose-main",
    "caption": "<b>t</b>ranspose Song",
    "trigger": "t",
    "children": [
        {
            "name": "on",
            "caption": "<b>o</b>n [false]",
            "trigger": "o",
            "action": "pluginProperty:set",
            "input": {
                "type": "input",
                "caption": "true|false",
                "default": "plugin:transpose-main:on",
                "datatype": "boolean",
                "id": "value"
            },
            "pluginInstanceId": "transpose-main",
            "propertyName": "on"
        },
        {
            "name": "amount",
            "caption": "<b>a</b>mount [1]",
            "trigger": "a",
            "action": "pluginProperty:set",
            "input": {
                "type": "input",
                "caption": "integer",
                "default": "plugin:transpose-main:amount",
                "datatype": "Number",
                "id": "value"
            },
            "pluginInstanceId": "transpose-main",
            "propertyName": "amount"
        },
        {
            "name": "applyNow",
            "caption": "<b>p</b>lay/apply now",
            "trigger": "p",
            "action": "pluginAction:invoke",
            "pluginInstanceId": "transpose-main",
            "propertyName": "applyNow"
        }
    ]
}
```

This keeps the menu runtime's expectations simple:

- everything still looks like a normal menu node,
- actions still dispatch through strings,
- and additional metadata rides along on the node so the dispatcher can route back to the right object.

## Proposed Runtime Classes

These are the minimum classes that seem useful without overdesigning this.

### `PluginTypeDefinition`

Responsibility:

- describes a plugin type,
- owns the default property definitions,
- creates runtime instances.

Suggested shape:

```js
class PluginTypeDefinition {
    getPluginType() {}
    getDefaultEvents() {}
    getPropertyDefinitions() {}
    createInstance(instanceState, context) {}
}
```

### `PluginInstance`

Responsibility:

- owns one plugin's current state,
- wires and unwires events,
- exposes properties,
- handles plugin-specific actions.

Suggested shape:

```js
class PluginInstance {
    getInstanceId() {}
    getPluginType() {}
    enable(context) {}
    disable(context) {}
    isEnabled() {}
    getEvents() {}
    getProperties() {}
    getProperty(name) {}
    setPropertyValue(name, rawValue, context) {}
    invokeAction(actionName, context) {}
    handleEvent(eventName, payload, context) {}
    exportState() {}
}
```

### `Property`

Responsibility:

- carries property metadata,
- owns the persisted value,
- converts or validates as needed,
- provides enough metadata for menu editing.

Suggested shape:

```js
class Property {
    getName() {}
    getCaption() {}
    getDatatype() {}
    getValue() {}
    setValue(rawValue) {}
    getDefaultValue() {}
    toPersistedValue() {}
    getMenuInputCaption() {}
    getMenuDefaultToken() {}
    validate(rawValue, context) {}
}
```

### `MenuNodeProvider`

Responsibility:

- converts runtime objects into plain menu nodes.

Suggested shape:

```js
class MenuNodeProvider {
    toMenuNode(context) {}
    toChildMenuNodes(context) {}
}
```

This can be a formal class or just a convention.

## Necessary Interfaces To Participate In The Current Menu System

If the goal is "what must a class provide so the current command menu can use it?", then the true answer is smaller than it first appears.

### Minimal data interface

A participating menu object needs to provide readable properties equivalent to:

```js
{
    caption,
    trigger,
    children,
    action,
    input,
    vars,
    name,
    popOnBang
}
```

and it must tolerate the runtime adding:

```js
{
    parent,
    bang
}
```

### Minimal action interface

Because the menu currently dispatches only by `menuItem.action` string, a participating class also needs a route back from that action string.

That can be done one of two ways:

1. extend `performCmdAction()` with generic plugin/property actions, or
2. introduce a registry that maps action strings to handler functions.

For this design, I would target generic actions such as:

- `pluginProperty:set`
- `pluginProperty:toggle`
- `pluginAction:invoke`
- `plugin:on`
- `plugin:off`

That keeps the menu grammar stable.

### Minimal value-resolution interface

If menu captions or defaults are dynamic, the objects also need stable resolver tokens so `getValue()` can answer things like:

- `plugin:transpose-main:amount`
- `plugin:transpose-main:on`
- `plugin:transpose-main:eventSummary`

This suggests a general resolver format of:

```text
plugin:{instanceId}:{fieldName}
```

## Holes In The Properties Model

These are the main places where the current draft needs clarification.

### 1. `value` as always-String is too narrow

This is the biggest hole.

It works for menu input transport, but it is too narrow as the semantic model for all datatypes.

Problems:

- `org.dynamide.Action` is not meaningfully a string value in the same sense as `Number` or `boolean`.
- `org.dynamide.Select` needs a list of options in addition to the current value.
- later JSON-like values or arrays would be awkward.

Recommendation:

- persist a string representation when convenient,
- but let the `Property` class own coercion and typed interpretation.

I would distinguish conceptually between:

- `value`: persisted raw value,
- `effectiveValue`: typed/runtime interpretation.

### 2. `datatype` namespace needs firmer semantics

Right now `datatype` is descriptive, but the design needs to decide whether it controls:

- persistence format,
- input parsing,
- validation,
- menu editor choice,
- HTML editor choice,
- or all of the above.

I recommend:

- `datatype` determines coercion and default editor choice,
- explicit editor metadata can override presentation later.

### 3. `org.dynamide.Action` needs a formal payload shape

This needs clarification before implementation.

I recommend that an action property contain:

- `name`
- `caption`
- `datatype`
- `action` as an identifier string

not a literal `doIt()` string body.

Storing executable source in song JSON will complicate persistence, safety, and debugging immediately.

### 4. option-bearing datatypes are underspecified

`org.dynamide.Select`, `org.dynamide.Choice`, and `org.dynamide.State` need an option model.

Likely missing fields:

- `options`
- `labels`
- `captions`
- `defaultValue`
- maybe `datasource`

Suggested option shape:

```json
{
    "options": [
        { "value": "true", "caption": "On" },
        { "value": "false", "caption": "Off" }
    ]
}
```

### 5. target binding is not yet modeled

The document says:

```text
targetObject[prop.name] = prop.value
```

That is fine for the simplest case, but plugin properties will also need to answer:

- where does this property live,
- what object applies it,
- and is assignment enough or is a setter/action required?

Example: setting `on` probably should call enable/disable lifecycle code, not just assign a field.

Recommendation:

- do not make direct property assignment the universal rule,
- let `PluginInstance.setPropertyValue()` own side effects.

### 6. lifecycle is missing

Plugins need at least:

- initialize from song,
- enable,
- disable,
- dispose,
- rewire events when properties change.

Without lifecycle methods, the `on` property will be ambiguous.

### 7. validation result shape is missing

The document mentions validators later, but even early on the property layer should define what a validation response looks like.

Suggested shape:

```json
{
    "ok": true,
    "normalizedValue": "1",
    "message": ""
}
```

This would let menu input stay string-based while still supporting normalization.

### 8. schema identity and evolution are missing

If songs persist plugin config, later plugin-schema changes will happen.

Likely needed eventually:

- `schemaVersion` on plugin instance state,
- migration on load,
- stable property names.

I would at least reserve the idea now.

## Scope Guidance For The Next Iteration

To keep implementation tractable, I suggest the first real implementation target be:

1. one plugin type,
2. one plugin instance in Song,
3. two editable property datatypes: `Number` and `boolean`,
4. one action datatype: `org.dynamide.Action`,
5. menu nodes generated from runtime objects but consumed as plain objects.

That would prove the architecture without needing the full property-sheet framework.

## Questions / Requests For Clarification

Please correct or refine these points in the Design Document before implementation work:

1. Should Song persist only plugin instance state, while plugin property definitions live in code?
2. Do you want to support multiple instances of the same plugin type, or exactly one instance per plugin type for now?
3. Is `org.dynamide.Action` allowed to be only an action identifier string, not executable source code?
4. Should per-plugin event lists be user-editable in Song, or should events stay fixed by plugin type initially?
5. Do you want every plugin property to be menu-editable, or only a curated subset with explicit menu triggers?
6. Should menu triggers be hand-authored for plugin properties, or generated automatically from captions where possible?

My recommendation for now is:

- persist instance state only,
- allow one instance per plugin type initially,
- make `org.dynamide.Action` identifier-based,
- keep event lists fixed initially,
- expose only curated menu-editable properties,
- and hand-author triggers for clarity.



# Iteration 3

## Answers

1) Each plugin is indeed a singleton per Song instance.

2) Event lists are defined by the Plugin programmer.  User only turns them off indirectly by turning the plugin "on" state to false.  Users should not modify, but there may be a need for the list to be viewable in a report about plugins, or a Plugin help description, so that User knows which events are triggering this plugin.

3) Yes, the list of Property fields visible to the Menu is curated by the Plugin programmer.  We expected that this list would also be set with the menu trigger letter at the same time, since trigger can only be determined when the list of Properties and Actions are known.  Therefore, actions are hand-authored by Plugin programmer.

4) Plugin properties live in code or property files (JSON) authored by the Plugin programmer.  Our preference is for each Plugin to live in its own directory, and have a .js file, and a properties.json file, along with menu definition files if we go that route, and HTML presentation layer files as needed.

5) therefore, the Song persists only the user choices around instance of the plugin: "on" state, "enableOnSongLoad" value, id, and User-facing properties essential to the plugin: transposeIntervals, minPosition, maxPosition, isRandom, and so on.

6) Yes, the idea was to not have any live function pointer wiring, or sourceable or attachable code.  The idea is to have all that in the Plugin itself, and expose only actions that are single words.  So "doIt()" in this context means one function with no params, that can be triggered either by turning the Plugin on, or by mashing on an Action button.  The action is thus a name just like the action in the menu: well known, stable, and a string.

7)  No Menu needs to be persisted, and the menu.js file does not need to be modified.  There would be a runtime addition to the menu tree only.

8) Since each Plugin is to be authored by a Plugin programmer, having the requirement that known properties "popOnBang" etc. be used, and that "bang" and "parent" are reserved.

9) The requirement that the Property `value` field be a string is not necessary. Only that by persistence time, and when passing things around in the menu, that values be serializable as JSON. 


## New Discussions

- The only visibility of the plugin in the menu would be at runtime, when the user drops into the plugins menu. They would see
    ```
    /file
        ./plugins/
            ./Transpose
            ./Argpeggio
            ./RandomNote
            ./RandomChord
    ```
    where each of those names is the registered name in the PluginManager.

- Given this menu example, we assumed that we could make a MenuItem class, then subclass it or extend it so that each MenuItem provides the menu list at that level, and contains a reference to its owner so that Action or property reads can be directed at the Plugin.  We envisioned that MenuItem would be a mix-in so that it is owned by any class that wants to be represented as a MenuItem, e.g. have "caption", "trigger" and so on, and that can provide "children", and "input"

Forgive the sloppy naming in the following description, we aren't quite sure yet how to structure `MenuItem`, `this.menuItem`, and `this.getMenuItem()`.  We intend to convey that there are parallel classes: the instance class PluginManager, and the Plugin instance classes on the one hand, and on the other hand their proxies MenuItem instances that stand in nicely for a plain object with "caption", "trigger", and "children" etc.

PluginManager
    - HAS_A this.menuItem, responds to getMenuItem()
    - responds to getCmdMenu with a list, generated from the list of registered Plugins: 
        ```
        ["Transpose",
         "Argpeggio",
         "RandomNote",
         "RandomChord"
        ]
    - the child returned by that MenuItem for "Transpose" would be a MenuItem that is owned by PluginTransposeSong, and has a back pointer to PluginTransposeSong.

PluginTransposeSong
     - HAS_A this.menuItem, responds to getMenuItem()
     - this.menuItem thus has children list of `MenuItem`s
     - this particular plugin would respond with a MenuItems that can be set as its "input" 
        -
        ```
            "amount": "1",
            "NamedNotes": "true",
            "PlayedNotes": "false",
            "RecordedNotes": "false"
        ```

PluginArpeggio
    - HAS_A this.menuItem
    - this.menuItem has children that can be set as its "input"
        -
        ```
            "minFret",
            "maxFret",
            "lowToHigh",
            "upOnly",
            "style",
        ```
    - the tricky bit comes when we specify that "style" should be one of ["every", "alternate", "random"]
    - we'd also need to specify that minFret and maxFret are numbers (which should be in a range specified by the tuning in effect...so some validation before showing default values, or afterwards is involved).
    - and upOnly is boolean.

So, yes, we want the minimum needed to handle these cases, and there is no need for a fancy editor, or a complex datatype currently if we can handle these simple datatype.

Also, we kind of expected that action and validation would be handled by the Plugin via registry so they are not any new special cases in command-line.js, except that if a type field such as isLive were present, then the Plugin or its proxy MenuItem would be called for the action.

Please provide discussion of whether this style of having the PluginManager and Plugin implement a mixin class that behaves like a MenuItem is doable with having them 
- output the structure you recommended for playing well with the current menu
- having enough back pointer to get to the PluginManager and Plugin instance for meaningful live values, such as the registerd Plugin list, and a calculation of the number of frets on an instrument.

Assume that we want the minimum implementation of Properties.  We provided a full description of how we got Properties working in previous projects.  However, most of that is not needed in this design, so we'd agree with your that a provable implementation that focuses on getting values to Plugins is much more important, and certainly cleaner.

# Iteration 4

## Summary

Yes, the style you describe is doable.

But with the current menu runtime, I would not make `PluginManager` and each `Plugin` literally be `MenuItem`s by inheritance or mix-in in the strong sense.

I would instead use:

- `PluginManager` and `Plugin` as domain/runtime objects,
- a very small `MenuItemProxy` or `MenuProjection` object that has the plain fields the menu already expects,
- and a back pointer from that proxy to its owner runtime object.

That is very close to what you described with `this.menuItem` and `getMenuItem()`, and I think it is the right simplification.

So my answer is:

- your general shape is sound,
- the "HAS_A menuItem" direction is better than a true mix-in,
- and the proxy should materialize plain `children` arrays for the current menu runtime rather than expecting the runtime to call methods such as `getChildren()`.

## Why I Recommend Composition Over A True MenuItem Mix-In

Your runtime today does not really consume a `MenuItem` protocol. It consumes plain object fields.

Specifically, the current menu code:

- reads `caption`, `trigger`, `children`, `action`, `input`, and `vars` directly,
- mutates the node with `parent`,
- temporarily mutates the node with `bang`,
- and does not ask the node to render itself or resolve its own children.

That means a true mix-in has some costs:

- every participating domain object now has to tolerate menu-runtime mutation,
- persistence code has to be careful not to serialize transient menu fields,
- and the domain model gets polluted with command-menu concerns.

By contrast, if `PluginManager` and `Plugin` each own a proxy object:

- the menu runtime gets exactly the object shape it expects,
- transient fields like `parent` and `bang` stay on the proxy,
- and back pointers can still reach the live plugin and manager state.

So I would describe the recommended pattern as:

- not "Plugin IS_A MenuItem",
- but "Plugin HAS_A MenuProjection".

That seems to align well with your clarified goal.

## Direct Answer To The New Discussion

### Is it doable for PluginManager and Plugin to expose menu behavior and live values?

Yes.

This is especially workable because:

1. you do not need to persist menu nodes,
2. you do want live runtime values,
3. the visible plugin/property list is curated by the plugin author,
4. and actions are stable strings, not function pointers.

Those constraints remove most of the dangerous parts.

### Can there be enough back pointer to reach meaningful live values?

Yes.

A runtime-only proxy node can safely carry references such as:

- `owner`: plugin instance or manager instance,
- `pluginId`,
- `propertyName`,
- `actionName`,
- and maybe `propertyDef` if convenient.

Since these nodes are ephemeral and not persisted, there is no problem with them containing live references.

### Can the menu show values computed at runtime, like plugin list or fret count?

Yes, with one important design rule:

- the menu runtime should still receive a plain node tree,
- but that tree can be regenerated or refreshed from live objects whenever the plugins menu is entered or when plugin state changes.

In other words, use live generation of plain nodes, not live domain objects pretending to be the menu runtime.

## Recommended Runtime Topology

I think the minimum clean shape is this:

```text
PluginManager
  HAS_A plugin instances
  HAS_A managerMenuProxy

PluginInstance
  HAS_A property definitions
  HAS_A current property values
  HAS_A pluginMenuProxy

PropertyDefinition
  metadata authored by plugin programmer

PropertyState
  current user value for a property in a Song

MenuItemProxy
  plain-object-compatible node for command menu runtime
  HAS_A back pointer to owner
```

If you want to simplify even further, `PropertyDefinition` and `PropertyState` can be merged for now, provided:

- the definition lives in plugin code or JSON,
- and the Song only persists the values the user changed.

## Recommended Minimal Class Shapes

### `PluginManager`

Responsibilities:

- register plugins,
- expose the list of active plugin instances,
- provide a runtime menu proxy for the plugins menu,
- route generic plugin-related menu actions.

Suggested shape:

```js
class PluginManager {
    getRegisteredPlugins() {}
    getPluginById(pluginId) {}
    getMenuItem() {}
    buildPluginMenuChildren() {}
    invokeMenuAction(menuItem, args) {}
}
```

### `PluginInstance`

Responsibilities:

- expose curated property/action definitions,
- provide current values,
- validate and normalize new values,
- wire/unwire its events when needed,
- provide a plugin menu proxy.

Suggested shape:

```js
class PluginInstance {
    getId() {}
    getRegisteredName() {}
    getMenuItem() {}
    buildMenuChildren() {}
    getVisibleProperties() {}
    getVisibleActions() {}
    getPropertyValue(name) {}
    setPropertyValue(name, rawValue) {}
    validatePropertyValue(name, rawValue, context) {}
    invokeAction(actionName, context) {}
    enable() {}
    disable() {}
    exportSongState() {}
}
```

### `MenuItemProxy`

Responsibilities:

- look like the current menu node shape,
- carry back pointers,
- be freely disposable and rebuildable.

Suggested shape:

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
    }
}
```

This is intentionally boring. That is a good thing here.

## Recommended Output Structure For The Current Menu Runtime

Below is the structure I would target as the runtime-expanded subtree under the existing plugins menu.

### Plugins menu owned by `PluginManager`

```json
{
    "name": "plugins-runtime-root",
    "caption": "<b>p</b>lugins",
    "trigger": "p",
    "children": [
        {
            "name": "transpose",
            "caption": "<b>t</b>ranspose",
            "trigger": "t",
            "action": "plugin:open",
            "pluginId": "transpose",
            "ownerType": "PluginManager",
            "children": [
                {
                    "name": "on",
                    "caption": "<b>o</b>n [true]",
                    "trigger": "o",
                    "action": "pluginProperty:set",
                    "pluginId": "transpose",
                    "propertyName": "on",
                    "input": {
                        "type": "input",
                        "caption": "true|false",
                        "default": "plugin:transpose:on",
                        "datatype": "boolean",
                        "id": "value"
                    }
                },
                {
                    "name": "amount",
                    "caption": "<b>a</b>mount [1]",
                    "trigger": "a",
                    "action": "pluginProperty:set",
                    "pluginId": "transpose",
                    "propertyName": "amount",
                    "input": {
                        "type": "input",
                        "caption": "integer",
                        "default": "plugin:transpose:amount",
                        "datatype": "Number",
                        "id": "value"
                    }
                },
                {
                    "name": "namedNotes",
                    "caption": "<b>n</b>amedNotes [true]",
                    "trigger": "n",
                    "action": "pluginProperty:set",
                    "pluginId": "transpose",
                    "propertyName": "NamedNotes",
                    "input": {
                        "type": "input",
                        "caption": "true|false",
                        "default": "plugin:transpose:NamedNotes",
                        "datatype": "boolean",
                        "id": "value"
                    }
                },
                {
                    "name": "apply",
                    "caption": "<b>p</b>lay/apply",
                    "trigger": "p",
                    "action": "pluginAction:invoke",
                    "pluginId": "transpose",
                    "actionName": "apply"
                },
                {
                    "name": "help",
                    "caption": "<b>h</b>elp",
                    "trigger": "h",
                    "action": "pluginAction:invoke",
                    "pluginId": "transpose",
                    "actionName": "help"
                }
            ]
        }
    ]
}
```

Important note:

- the `action` strings above remain generic,
- while `pluginId`, `propertyName`, and `actionName` provide enough routing data to get back to the real runtime object.

That avoids a new command-line special case for each individual plugin.

## How To Think About `children`

This is the most important place where I would adapt your mix-in idea to the current runtime.

### What the current runtime wants

It wants:

- `menu.children` to already be an array,
- and each child to already have a `caption` and `trigger`.

### What the plugin side wants

It wants:

- live values,
- dynamic property menus,
- computed lists such as registered plugins,
- and validation against live app state such as tuning/fret count.

### The compromise that fits both

When the plugins menu is about to be shown, build or refresh the `children` array from live runtime state.

So instead of the command menu doing:

```js
menu.getChildren()
```

the plugin system does:

```js
menu.children = pluginManager.buildPluginMenuChildren()
```

before the menu is displayed.

That is a better fit with the current code than trying to make `children` itself be lazy magic.

## Back Pointers And Live Values

Yes, back pointers are enough.

I would separate two cases.

### 1. Routing actions back to owners

For action routing, the proxy node may safely hold runtime references or IDs.

Good options:

- `pluginId` only, then `PluginManager` resolves the plugin,
- or `owner` direct pointer for convenience.

I slightly prefer ID plus manager lookup for ordinary nodes because it keeps the proxy lighter and easier to inspect, but either is workable.

### 2. Showing live values in captions and defaults

For live caption/default values, I would prefer ID-based resolution tokens such as:

- `plugin:transpose:on`
- `plugin:transpose:amount`
- `plugin:arpeggio:minFret`
- `plugin:arpeggio:maxFret`
- `plugin:arpeggio:maxAllowedFret`

Then a generic resolver in the plugin layer can answer those values.

That is cleaner than storing actual values into captions too early, because the existing menu already knows how to call `resolveMenuValue()`.

## Minimal Properties Model For This Design

Given your simplifications, I would reduce the Properties model to only what is needed for menu-driven plugins.

### Proposed minimum property fields

```json
{
    "name": "style",
    "caption": "style",
    "trigger": "s",
    "datatype": "org.dynamide.Select",
    "value": "alternate",
    "defaultValue": "every",
    "options": [
        { "value": "every", "caption": "every" },
        { "value": "alternate", "caption": "alternate" },
        { "value": "random", "caption": "random" }
    ],
    "visibleInMenu": true
}
```

For this iteration, I think the minimum useful fields are:

- `name`
- `caption`
- `trigger`
- `datatype`
- `value`
- `defaultValue`
- `options` for select-like types
- `visibleInMenu`

Optional but useful:

- `actionName` for `org.dynamide.Action`
- `inputCaption` for numeric/string entry prompts
- `help` or `description`

### Datatypes I would support first

1. `Number`
2. `boolean`
3. `org.dynamide.Select`
4. `org.dynamide.Action`

That covers the examples you gave.

## How I Would Map The Simple Datatypes To The Existing Menu

### `Number`

Use the existing `input` pattern.

Example:

```json
{
    "caption": "<b>m</b>inFret [0]",
    "trigger": "m",
    "action": "pluginProperty:set",
    "pluginId": "arpeggio",
    "propertyName": "minFret",
    "input": {
        "type": "input",
        "caption": "0..max fret",
        "default": "plugin:arpeggio:minFret",
        "datatype": "Number",
        "id": "value"
    }
}
```

### `boolean`

Use one of two simple patterns:

1. `input` with `true|false`, or
2. parent-handled choice with children such as `on` / `off`.

I would start with `input` for minimum implementation unless you strongly prefer the feel of a choice menu.

### `org.dynamide.Select`

This should map naturally to a submenu of options, not to free text input.

For your `style` example:

```json
{
    "caption": "<b>s</b>tyle [alternate]",
    "trigger": "s",
    "action": "pluginProperty:select",
    "pluginId": "arpeggio",
    "propertyName": "style",
    "children": [
        { "caption": "<b>e</b>very", "trigger": "e", "value": "every" },
        { "caption": "<b>a</b>lternate", "trigger": "a", "value": "alternate" },
        { "caption": "<b>r</b>andom", "trigger": "r", "value": "random" }
    ]
}
```

That matches the command menu's existing "parent action + child token" pattern very well.

### `org.dynamide.Action`

This should be a simple leaf node with a stable action name.

Example:

```json
{
    "caption": "<b>a</b>pply",
    "trigger": "a",
    "action": "pluginAction:invoke",
    "pluginId": "transpose",
    "actionName": "apply"
}
```

## Validation And Live Constraints

Your `minFret` / `maxFret` example is exactly the right place to keep validation in the plugin, not in `command-line.js`.

I recommend this rule:

- `command-line.js` remains generic and blind,
- plugin routing code converts the menu request into `plugin.setPropertyValue(...)`,
- and the plugin validates against live state such as current instrument, tuning, fret count, and its own dependent properties.

For example, `PluginArpeggio` should be able to answer:

- current maximum legal fret,
- whether `minFret <= maxFret`,
- and whether the selected `style` is in the allowed option list.

That means your intuition here is correct: plugin validation should be registry/plugin driven, not hard-coded into command-line.

## What Should Be Generic In The Dispatcher

You said you expect action and validation to be handled by plugin registry so they are not new special cases in `command-line.js`.

I agree.

The generic dispatcher only needs a small set of plugin-aware action strings:

- `pluginProperty:set`
- `pluginProperty:select`
- `pluginAction:invoke`
- `pluginReport:show`

Everything after that should be routed through `PluginManager` and then the specific plugin instance.

So the plugin-specific logic lives in:

- plugin property definitions,
- plugin validation,
- plugin action implementation,
- and plugin menu-building code.

Not in the global command-line runtime.

## Recommended Simplification For Iteration 5 And First Implementation

If the goal is the smallest provable vertical slice, I would implement only this:

1. one runtime-generated plugins subtree under the existing plugins menu,
2. one generic dispatcher path for plugin property set/select/action,
3. one plugin with `Number`, `boolean`, and `Action`,
4. optionally a second plugin that proves `org.dynamide.Select`,
5. no general editor framework,
6. no persisted menu schema.

That would prove:

- live runtime menu expansion,
- owner back pointers,
- generic action routing,
- plugin-local validation,
- and song persistence of plugin user state only.

## Recommended Terminology Cleanup

Your naming confusion is normal here. I think a small vocabulary cleanup will help keep the implementation from drifting.

I recommend these terms:

- `PluginManager`: owns plugin instances and routing.
- `PluginInstance`: the real runtime plugin object.
- `MenuItemProxy`: a runtime plain-object-compatible menu node.
- `PropertyDefinition`: plugin-authored metadata.
- `PropertyState`: persisted user value in Song.

Then avoid using `MenuItem` for both the abstract idea and the runtime proxy object.

## Questions / Requests For Clarification

Please refine these in the next iteration if they matter:

1. Should the runtime-generated plugin subtree replace the static `/file/plugins` children entirely, or should the static DaCapo examples remain alongside the generated entries during transition?
2. For boolean properties, do you prefer free text input `true|false`, or a submenu choice of `on/off` for better keyboard ergonomics?
3. Should `org.dynamide.Select` always render as child menu choices, or do you want to reserve the option of free-text entry for some select-like properties?
4. When validation fails, should the plugin return a simple message string for the command results list, or do you want a richer validation result structure at first implementation time?

My recommendation is:

- generated subtree replaces the old static plugin entries as soon as the first plugin is migrated,
- booleans use submenu choices if you care about feel, otherwise text input is the smallest start,
- `org.dynamide.Select` should be menu choices, not free text,
- and validation can initially return a simple normalized value plus message.

# Iteration 5

This is the final Design Phase Iteration.  Copilot, you do not need to produce an Iteration in this document.  Your next work product will be the ImplementationPlan: 

   `_chat_conversations/infinite-neck/Plugins-Menus-ImplementationPlan-chat.md`

Copilot, please prepare that document so that we can go from that plan to having you generate the code.  Design considerations and choices don't need to be spelled out since we are keeping the Design Document.  But the implementation plan should:

- show what you will implement (as you have been) but omitting the options we've rejected
- include most of your plans from Iteration 4, taking into account our answers below
- be a chance for us to review the decisions we've made together
- be sufficient for you to generate the code 
- be a guide for us to understand and extend the code.

For our part, we have: 
- Cleaned up the menu.js to remove DaCapo.  We only left the /file/plugins node in the menu.  Not sure if leaving that there is correct.  We need some kind of marker to let menu.js implementors know that a placeholder to be replaced at runtime is there.
- Removed DaCapo.js
- Removed the old PluginRegistry.js  
- Renamed the plugins and moved them into their directories (see below).

- For TransposePlugin we will need an "intervals" property, which is an array of integer. This replaces "amount".  First number in the array is the state of the Song when we start, so a transposition of zero.  The plugin will have to do an ingestion of this, which will be part of our implementing the Plugin.  The first example here would be transposing all the way around the 12 allowable values of Song.rootKey.  The second example is where we show a standard progression, in musical terms: Progression: I-IV-V which maps to intervals 0,5,7.  We will take care of implementing how TransposePlugin handles these.  Here are the two example User inputs for reference: 
        - intervals : [0,1,2,3,4,5,6,7,8,9,10,11] 
        - intervals : [0,5,7]

- For plugins properties, we are omitting the standard properties "on" and "enableOnSongLoad", since you have a mechanism for centralizing these.         

- So we would like to support two plugins:  TransposePlugin and ArpeggioPlugin. This will allow us to validate that the Registry is working for more than just one, and that we have one with an array of integer, and one with a org.dynamide.Select.  These are stubbed out in the repository, though broken because of references to old config objects:

    - ./plugins/transpose/TransposePlugin.js
        - User-facing properties w/example: 
            - "intervals": [0,1,2,3,4,5,6,7,8,9,10,11] 
            - "NamedNotes": "true"
            - "PlayedNotes": "false"
            - "RecordedNotes": "false"

    - ./plugins/arpeggio/ArpeggioPlugin.js
        - User-facing properties w/example: 
            - "minFret": 0
            - "maxFret": 5
            - "lowToHigh": "true"
            - "style": one of: ["every", "alternate", "random"]
            
To reiterate, we are very happy with your recommendations and agree completeley on: 
- the proper implementation is HAS_A/Composition and not mixin
- MenuItemProxy is the preferred name versus MenuProjection
- "PropertyDefinition and PropertyState can be merged" is a good plan
- inputCaption is a useful property field
- having actions in the menu will be very useful, as the User can drive interaction with the plugin during looping
- booleans should be true|false now.  Later we will implement validators and accept other truthy values.  For now, strict JSON is preferred.
- org.dynamide.Select should be menu choices, not free text
- "simple message string for the command results list" is acceptable feedback for the User


