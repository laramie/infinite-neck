# Summary
- We ask about template expansion, and EventBus scaling, then dive into designing widgets using templates.
- We design a second-generation widget, after our template experiments in ./templates/
- We implement this widget, SectionStatus, as our prototype for more widgets, and install it for testing.
- At the end, we have code in ./templates/SectionStatus/*
  -   [section-status.builder.js](../../templates/SectionStatus/section-status.builder.js)
  -   [section-status.css](../../templates/SectionStatus/section-status.css)
  -   [section-status.html](../../templates/SectionStatus/section-status.html)
- We also get a programmer's guide for installing and calling the widget:
  -   [Programmer's Instructions for the SectionStatus widget](../../templates/SectionStatus/programmer-instructions.md)
- Date:20260414  
  

## User:
 When we do template expansion in ES6 using backtics, is there a way to pull in the text from a template file downloaded from the source server with fetch(url), then eval'ing the template so that things like ${myVar} get replaced?

## GitHub Copilot:
 Optimizing tool selection...Yes, you can achieve ES6 template string expansion with text loaded from a server, but you cannot directly "eval" a template string with ${...} placeholders unless you wrap it in a function. Here’s a safe and common pattern:

1. Fetch the template text from the server.
2. Wrap the template string in a function using the Function constructor or a tagged template.
3. Pass your variables as arguments.

Example using the Function constructor:

```javascript
// Assume templateText is fetched from the server and contains: "Hello, ${name}!"
const templateText = 'Hello, ${name}!';

// Create a function that returns the evaluated template
function expandTemplate(template, vars) {
  return new Function(...Object.keys(vars), `return \`${template}\`;`)(...Object.values(vars));
}

// Usage:
const result = expandTemplate(templateText, { name: 'Alice' });
console.log(result); // "Hello, Alice!"
```

**Caution:** Using the Function constructor (or eval) can be a security risk if the template text is not trusted. Only use this with trusted sources.

If you want a safer approach, consider using a template engine like Mustache or Handlebars, which do not use eval and are safer for untrusted templates.**Caution:** Using the Function constructor (or eval) can be a security risk if the template text is not trusted. Only use this with trusted sources.

If you want a safer approach, consider using a template engine like Mustache or Handlebars, which do not use eval and are safer for untrusted templates.

## User:
 No, it's coming from the same server that serves up the .js files, which also get expanded.  So are there any CORS hoops I gott jump through?  I mean it's same code.

## GitHub Copilot:
 If your JavaScript code and the template files are served from the same origin (same protocol, domain, and port), you do not need to worry about CORS—fetch will work without any special configuration.

CORS (Cross-Origin Resource Sharing) is only a concern when you are making requests across different origins (e.g., from example.com to api.example.net). For files served from the same server and origin, fetch will succeed as long as the file is accessible (not blocked by server config or authentication).

In summary:  
- No CORS hoops are needed for same-origin fetches.
- Just ensure the template file is publicly accessible at the URL you fetch.

## User:
 I have this EventBus, and it is working very well.  At what point do I have to worry about scale.  I want to add some widgets, and i thought the best way to wire them up without plugging into imports is through the EventBus.  I'f I start having  dozens of widgets is this any more of a bottleneck than direct JS calls?  Are there any advantages to grouping messages by subtopic so listeners listen on different "chanels"?

## GitHub Copilot:
 Great questions! Here’s a concise breakdown for your EventBus scaling concerns:

**1. Performance/Scale:**  
- For dozens (even hundreds) of widgets, a typical EventBus (publish/subscribe) pattern is not a bottleneck in modern browsers. Event dispatching is fast, and unless you have thousands of listeners or emit events at a very high frequency (e.g., animation frame), you won’t notice a performance hit.
- Direct JS calls are always a bit faster, but the difference is negligible for most UI apps.

**2. Maintainability/Decoupling:**  
- EventBus is excellent for decoupling: widgets don’t need to know about each other, just the event names.
- This makes adding/removing widgets or features much easier.

**3. Grouping by Subtopic/Channels:**  
- Yes, grouping events by subtopic (e.g., "widget:resize", "widget:update") is a best practice. It prevents unrelated listeners from firing and keeps code organized.
- Listeners should subscribe only to the events they care about. This also helps avoid accidental event name collisions.

**4. When to Worry:**  
- If you notice lag, profile your event handlers—usually, the bottleneck is in the handler logic, not the bus itself.
- If you have thousands of widgets or events, consider optimizing with event namespaces, throttling, or even a more sophisticated event system.

**Summary:**  
- For dozens of widgets, EventBus is fine and brings maintainability benefits.
- Use subtopics/channels for clarity and efficiency.
- Only optimize further if you see real performance issues.

Let me know if you want a code example for event grouping or best practices!

## User:
 We already use topics with a colon in the string.  But you can see our current implementation just sends every message every time.  Are there refinements to parsing it out, or is that overkill for our scale.


## GitHub Copilot:
 If you’re already using colon-separated topics (e.g., "widget:update"), you’re following a good convention. For your current scale (dozens of widgets), parsing the topic string (splitting by colon, etc.) for subtopic routing is usually unnecessary overhead—just matching the full string is fast and simple.

**Refinements are only needed if:**
- You want wildcard subscriptions (e.g., "widget:*" to listen to all widget events).
- You want to implement event bubbling or hierarchy (e.g., "widget" catches all "widget:*" events).
- You have hundreds/thousands of event types and want to optimize lookup.

**For your use case:**
- Matching the full topic string is efficient and maintainable.
- If you ever need wildcards or hierarchical listeners, you can add topic parsing then.

**Summary:**  
For dozens of widgets and events, your current approach is not overkill and does not need further parsing. Only add complexity if you need advanced features like wildcards or event hierarchies.

## User:
 Creating a widget in a Template.

We have some widgets we've created so far for whole panels that work as pop-ups and help to 
clean the code out of our main web app, infinite-neck.js and index.html and infinite-neck.css.

We've worked in many frameworks, some of our favorites being Visual Basic, and Borland Delphi.  We find
that modern frameworks don't aggregate related widget files as nicely as these old workhorses, and 
we are particularly frustrated working in Angular and Mustache.  We find the direct features of ES6 in the browser
to be perfect, and the layer of jQuery eases most of our pain.  But jQueryUI is particulary clunky,
and jQuery core is particularly nice, but leaves somethings to be desired when aggregating widgets.

Now we'd like to create a widget to explore how to best handle these questions in our existing web app, infinite-neck.

We'd like to see how tight we can get the widget.  We are putting all the widgets in one directory, but the long term
plan is to have one directory per widget, then a widget really becomes a package.

It is essential that widgets be stateful, work with the DOM, work with ES6 browser loading, and be instantiated and unique 
so we can stamp out as many as needed and not have them clobber each other.

The layout of our templates so far is handled in files such as (from most recent to oldest implementation):
```
    templates/section-drawer.builder.js
    templates/palette.builder.js
    templates/themes.builder.js
    templates/WiringBuilder.js
```
This new widget would thus get three files [ and their stati ]
```
    HTML code: section-status.html    [implemented, but changes expected to wire it up]

    CSS:       section-status.css     [implemented]

    JS code:   section-status.builder.js    [not implemented, blank and empty]
        section-status.builder.js should have a Builder class, 
        class SectionStatusBuilder {
            static addToDest(destSelector, tableID){}
        }
```    
and two insertion points into the web app, which you should not modify, 
  but emit sample code ready-to-paste, as infinite-neck.js is hard to patch:

1) *We add* this to the loadTemplates area in infinite-neck.js::appInit() : 
```
        const promises = [
            loadTemplates().then(() => {
                getSong().getVisibleTuningIDs().forEach(tuningID => {
                    WiringBuilder.addWiringWidget(tuningID, Constants.TABLE_ID_PREFIX+tuningID);
                    // Magic knowledge in WiringBuilder should probably be pulled out, but looks like this:
                    //    WiringBuilder expects our DOM to have one div dest for each table passed in:
                    //    `#div${tuningID}_wiring`
                });
                setWiringOpenState(false);
            }),

            loadTemplates('templates/themes.html').then(() => {
                ThemesBuilder.addToDest('#divThemeControls');
                rebuildThemesDropdown();
                $('#selThemes').val("Autobahn").change();
            }),
            
            loadTemplates('templates/section-drawer.html').then(() => {
                SectionDrawerBuilder.addToDest("#spanSectionDrawer");
                sectionChanged();
            })
        ];
```
2) CSS *we add* to the HEAD of index.html
```
    <link rel="stylesheet" type="text/css" href="templates/templates.css" />
    <link rel="stylesheet" type="text/css" href="templates/themes.css" />
    <link rel="stylesheet" type="text/css" href="templates/palette.css" />
    <link rel="stylesheet" type="text/css" href="templates/section-drawer.css" />
```
    Actually, it would be cool if the *.builder.js file could pull this in, or if loadTemplates() could pull it in in the same group of promises. 
    We'd like recommendations on that, but not code for this sprint--we'll keep doing the CSS the above way for now.


Events:
- Listens: <topic> <data>
```
        "Widget:SectionStatus:keyChanged"        {widgetID: "tblS6_1_SectionStatus_1", rootID: 3, rootIDLead: 8}
        "Widget:SectionStatus:sectionChanged"    {widgetID: "tblS6_1_SectionStatus_1",sectionID: 3, caption: "Section 3 Slowly"}
        "Widget:SectionStatus:layoutChanged"     {widgetID: "tblS6_1_SectionStatus_1", layout: "vertical", features: ["rootID", "rootIDLead", "caption", "LooperLight"]} 
        "Widget:SectionStatus:IDChanged"         {widgetID: "tblS6_1_SectionStatus_1", oldID: "tblS6_1_SectionStatus_1", newID: "tblS6_Lead_SectionStatus_1"} 
```
In the style of NoteTableController.js, handle events at the bottom of SectionStatus.builder.js as file-level functions like so: 
```
        EventBus.on('Note:colored', function(event, data) {
        });
```
In our case that would look like: 
```
        EventBus.on('Widget:SectionStatus:keyChanged', function(event, data) {
        });
```
You should also discuss implementing whatever triggers are needed in section-status.builder.js.
Here is an example trigger from Song.js: 
```
        EventBus.trigger("Wiring:removed", {tablename:tablename});
```
We expect that the main page designer will wire up buttons at the top of the Instrument tables
in TableBuilder.js::buildNoteTable() that will call for changing the horizontal/vertical change, 
and showing/hiding the section-status widgets, and specifying whether the caption is present, etc.

We expect that the creating of the widgets would *not* be event based, but driven directly in JS,
passing in the destination DOM element id, 
and the unique-ifying string such as Instrument tableID this widget gets attached to, and glues its string id to tableID.
This would be a SectionStatusBuilder.addToDest(destSelector, tableID) call. 
This method returns the DOM element, you can see by looking at WiringBuilder and ThemesBuilder.

We note that only one of our template files has the capability for multiple HTML template elements, and we only use one in that file, templates/templates.html
However, for this implementation, we have put two templates, one for vertical, one for horizontal, that are 
coded today in an if/else in TableBuilder.js::formatKeyBoxes(tableID, idx, vertical)

We are doing a bit of hand-waving here, in that we aren't sure if "Widget:SectionStatus:LayoutChanged" 
    will actually cause the templates to get selected and expanded.  For this sprint, we 
    will probably fall back to having this done once in SectionStatusBuilder by having a additional  parameter to addToDest() for layout     

    
Before we do any coding, we'd like a review of this plan, and some sample sketches of what things look like that we haven't specified or implemented.

We'd like a discussion of the merits and posibilities of having the templates re-evaluated on the fly, since it is likely that the widgets will 
be called on to change orientation in the DOM, and we'd like to keep the IDs the same, and have the outer div/span stay attached.

We'd like a discussion on whether SectionStatusBuilder is OK as a class with static methods, or whether there are 
advantages to having it instantiated.

We can then clarify and decide on the implementation details.

## GitHub Copilot:
 Your plan is thoughtful and aligns well with modern, modular, and maintainable web development—especially for a custom, framework-light approach. Here’s a review, some sketches, and discussion of the key architectural questions you raised:

---

## 1. Directory and File Structure

**Current Plan:**  
- All widgets in one directory now, eventually one directory per widget (HTML, CSS, JS grouped).
- Each widget is a “package” with its own files.

**Merits:**  
- This is excellent for maintainability, discoverability, and future scalability.
- Mirrors the best of classic component-based frameworks (Delphi, VB) but with modern web tech.

---

## 2. Widget Instantiation and Uniqueness

**Plan:**  
- `SectionStatusBuilder.addToDest(destSelector, tableID, layout)` creates a widget in a given DOM location, with a unique ID based on `tableID`.
- Returns the DOM element for further manipulation.

**Merits:**  
- Keeps widget creation explicit and controlled.
- Avoids accidental ID clobbering.
- Allows for multiple widgets per page, each with its own state.

---

## 3. Static Class vs. Instance

**Static Class (current plan):**
- Pros:  
  - Simple, easy to use for “stamp out” widgets.
  - No need to manage instances if all state is in the DOM or in data attributes.
- Cons:  
  - Harder to manage per-widget JS state (e.g., timers, local variables, event handlers that need to be cleaned up).
  - If you want to support widget destruction, or more complex behaviors, instance-based is better.

**Instance-based:**
- Pros:  
  - Each widget can have its own state, methods, and lifecycle.
  - Easier to add features like teardown, local event listeners, or internal caching.
- Cons:  
  - Slightly more boilerplate (need to track instances, maybe a registry).

**Recommendation:**  
- For simple, mostly-DOM-driven widgets, static is fine.
- If you anticipate more complex state, or want to support widget removal/cleanup, go instance-based.

---

## 4. Template Re-evaluation (Dynamic Layout Switching)

**Plan:**  
- Two templates (vertical/horizontal) in the HTML.
- Layout can change at runtime (e.g., via event or method call).

**Merits:**  
- Allows for flexible UI that adapts to user actions or screen size.

**Implementation Sketch:**  
- Keep the outer container (e.g., `<span class="section-status-widget">`) fixed.
- When layout changes, clear the inner HTML and re-insert the new template’s content, updating IDs as needed.
- Keep the widget’s unique ID and data attributes on the outer container.

**Sample Pseudocode:**
```javascript
class SectionStatusWidget {
  constructor(destSelector, tableID, layout) {
    this.container = document.querySelector(destSelector);
    this.tableID = tableID;
    this.layout = layout;
    this.render();
  }
  render() {
    // Remove old content
    this.container.innerHTML = '';
    // Clone the right template
    const tpl = document.getElementById(
      this.layout === 'vertical'
        ? 'section-status-vertical-template'
        : 'section-status-horizontal-template'
    );
    const node = tpl.content.cloneNode(true);
    // Replace ${idx}, ${tableID} as needed (see below)
    // ...
    this.container.appendChild(node);
  }
  setLayout(newLayout) {
    this.layout = newLayout;
    this.render();
  }
}
```
- This approach allows you to keep the same DOM node and IDs, and just swap the inner content.

---

## 5. Template Expansion

**Plan:**  
- Use ES6 template strings or manual string replacement to fill in `${idx}` and `${tableID}`.

**Merits:**  
- Simple, direct, and works well for your use case.
- If you want to get fancier, you could use a minimal template engine, but for now, direct replacement is fine.

---

## 6. Event Handling

**Plan:**  
- Listen for events like `"Widget:SectionStatus:keyChanged"` at the file level.
- Update the relevant widget(s) based on `widgetID` in the event data.

**Merits:**  
- Decouples widget logic from the rest of the app.
- Allows for easy extension and testing.

**Sketch:**
```javascript
EventBus.on('Widget:SectionStatus:keyChanged', function(event, data) {
  // Find the widget by data.widgetID and update as needed
});
```

---

## 7. CSS Loading

**Plan:**  
- For now, include CSS in `<head>`.
- In the future, consider dynamic loading via JS or as part of the template loading process.

**Merits:**  
- Keeps things simple for now.
- Dynamic loading is possible, but not urgent.

---

## 8. Widget Creation (Sample Usage)

**Paste-ready code for main app:**
```javascript
// To create a new SectionStatus widget:
SectionStatusBuilder.addToDest('#divSectionStatus_S6', 'tblS6_1', 'vertical');
```
- This would insert the widget into the given div, with unique IDs based on `tableID`.

---

## 9. Widget Removal/Cleanup

- If you go instance-based, you can add a `destroy()` method to clean up event listeners, etc.
- For static, you’ll need to manage this manually.

---

## 10. Summary Table

| Feature                | Static Class | Instance Class |
|------------------------|--------------|---------------|
| Simple creation        | ✔️           | ✔️            |
| Per-widget state       | ❌           | ✔️            |
| Easy teardown          | ❌           | ✔️            |
| DOM-driven             | ✔️           | ✔️            |
| Future extensibility   | ❌           | ✔️            |

---

## 11. Recommendations

- For this sprint, static is fine if widgets are simple.
- If you want to support dynamic layout switching, use a class (instance-based) for each widget.
- Keep template expansion simple for now; revisit if you need more power.
- Stick with manual CSS inclusion for now.

---

## 12. Unspecified/To-Sketch

- How you want to handle widget registry (if at all).
- How you want to handle widget destruction/cleanup.
- How you want to handle per-widget state (beyond DOM).

---

**Let me know which direction you want to go (static vs. instance), and if you want a more detailed code sketch for the widget class and template expansion!**

## User:
 OK, thanks for the feedback!
-- no time like now, so we've moved the files to:
   ` ./templates/SectionStatus/ `

 -- Let's do a very lightweight object-per-widget.  Like, the SectionStatusBuilder is a builder pattern that stamps out the widget, but the widget owns registering for EventBus and handling events, and reformatting itself.  Still not sure of the balance for how the code works for switching orientations, but it seems that with a tiny object, it could help it stay attached to the dom  and remember tableID, etc.  Your sample code looks correct in this regard. Also, this widget may need to keep track of getSong().getSection() as an example of a model class it could listen to.  Mostly likely thatt will be decoupled and sent through the EventBus, but it might be needed.

 Yes, keep CSS inclusion for now.

 Let's have whatever is the simplest widget registry, e.g. a Singleton class that maintains an array of instantiated widgets.  It is normal in our application to delete Instrument tables and re-create them with different Tunings, and the tables often get rebuilt anyway, so having the widgets at least be able to unsubscribe and get out of the DOM would help a lot in browser session longevity and preventing sluggishness.

 We do know when we throw away a table, but I don't know if there's any automatic way to hook a window event into kicking us for cleanup.  If there's nothing automatic like that, we could simply ensure that calls to reinstallAllTuningTables() etc. call cleanup.

 Let's go with class widget-per-instance in this implementation.  You've convinced me there's enough there to go ahead.

Let's see an implementation plan and more code sketches please, which we'll review and discuss.


## GitHub Copilot:
 Great! Here’s a focused implementation plan and code sketches for your SectionStatus widget, using a builder pattern for creation, per-widget class instances, and a simple registry for lifecycle management and cleanup.

---

## Implementation Plan

### 1. Directory Structure

```
templates/SectionStatus/
    section-status.builder.js
    section-status.html
    section-status.css
```

---

### 2. Widget Class

- Each widget is an instance of `SectionStatusWidget`.
- Handles its own DOM, state, and EventBus subscriptions.
- Can re-render itself (e.g., for layout/orientation changes).
- Has a `destroy()` method for cleanup.

---

### 3. Builder/Registry

- `SectionStatusBuilder` is a singleton with:
  - `addToDest(destSelector, tableID, layout)` to create and register a widget.
  - `removeByTableID(tableID)` to destroy and remove a widget.
  - An internal registry (object or Map) of widgets by unique ID.

---

### 4. EventBus Integration

- Each widget subscribes to relevant EventBus topics on creation.
- Unsubscribes on destroy.
- Handles only events for its own `widgetID`.

---

### 5. Template Handling

- On creation or layout change, the widget clones the appropriate template, fills in IDs, and attaches to the DOM.
- Keeps the outer container stable for easy re-rendering.

---

### 6. Cleanup

- `destroy()` removes DOM, unsubscribes from EventBus, and removes from registry.
- App code (e.g., in `reinstallAllTuningTables()`) should call builder’s remove methods as needed.

---

## Code Sketches

### section-status.builder.js

```javascript
// Singleton builder and registry
class SectionStatusBuilder {
    static registry = new Map();

    static addToDest(destSelector, tableID, layout = 'vertical') {
        // Remove existing widget for this tableID if present
        if (this.registry.has(tableID)) {
            this.registry.get(tableID).destroy();
        }
        const widget = new SectionStatusWidget(destSelector, tableID, layout);
        this.registry.set(tableID, widget);
        return widget;
    }

    static removeByTableID(tableID) {
        if (this.registry.has(tableID)) {
            this.registry.get(tableID).destroy();
            this.registry.delete(tableID);
        }
    }

    static removeAll() {
        for (const widget of this.registry.values()) {
            widget.destroy();
        }
        this.registry.clear();
    }
}

// Per-widget instance
class SectionStatusWidget {
    constructor(destSelector, tableID, layout) {
        this.tableID = tableID;
        this.layout = layout;
        this.widgetID = `${tableID}_SectionStatus`;
        this.container = document.querySelector(destSelector);
        this.eventHandlers = [];
        this.render();
        this.subscribeEvents();
    }

    render() {
        // Clear container
        this.container.innerHTML = '';
        // Select template
        const tplId = this.layout === 'vertical'
            ? 'section-status-vertical-template'
            : 'section-status-horizontal-template';
        const tpl = document.getElementById(tplId);
        const node = tpl.content.cloneNode(true);
        // Replace ${idx}, ${tableID} in IDs and attributes
        // (You may want to use a utility function for this)
        this.replaceTemplateVars(node, { idx: 0, tableID: this.tableID }); // idx:0 as example
        this.container.appendChild(node);
        // Optionally, set a data attribute for lookup
        this.container.dataset.widgetId = this.widgetID;
    }

    replaceTemplateVars(node, vars) {
        // Recursively replace ${var} in all attributes and text nodes
        const walk = (el) => {
            if (el.nodeType === Node.ELEMENT_NODE) {
                for (const attr of el.attributes) {
                    attr.value = attr.value.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '');
                }
                for (const child of el.childNodes) walk(child);
            } else if (el.nodeType === Node.TEXT_NODE) {
                el.textContent = el.textContent.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '');
            }
        };
        walk(node);
    }

    subscribeEvents() {
        // Example: only handle events for this widgetID
        const keyChangedHandler = (event, data) => {
            if (data.widgetID === this.widgetID) {
                this.handleKeyChanged(data);
            }
        };
        EventBus.on('Widget:SectionStatus:keyChanged', keyChangedHandler);
        this.eventHandlers.push(['Widget:SectionStatus:keyChanged', keyChangedHandler]);
        // Add more handlers as needed
    }

    handleKeyChanged(data) {
        // Update DOM as needed
        // Example: update rootID display
        const el = this.container.querySelector('.lblRootID');
        if (el) el.textContent = data.rootID;
    }

    setLayout(newLayout) {
        if (this.layout !== newLayout) {
            this.layout = newLayout;
            this.render();
        }
    }

    destroy() {
        // Unsubscribe from EventBus
        for (const [topic, handler] of this.eventHandlers) {
            EventBus.off(topic, handler);
        }
        this.eventHandlers = [];
        // Remove DOM
        if (this.container) this.container.innerHTML = '';
    }
}

// Example usage (in app code):
// SectionStatusBuilder.addToDest('#divSectionStatus_S6', 'tblS6_1', 'vertical');
// SectionStatusBuilder.removeByTableID('tblS6_1');
```

---

## Widget Registry

- The registry is a `Map` keyed by `tableID` (or widgetID if you prefer).
- Ensures only one widget per tableID, and allows for easy cleanup.

---

## Cleanup/Destruction

- Call `SectionStatusBuilder.removeByTableID(tableID)` when a table is removed.
- Or `SectionStatusBuilder.removeAll()` when all widgets should be destroyed (e.g., before rebuilding all tables).

---

## EventBus Unsubscription

- Each widget tracks its own event handlers for easy removal.
- Uses `EventBus.off(topic, handler)` (assuming your EventBus supports it; if not, you may need to extend it).

---

## Template Variable Replacement

- The `replaceTemplateVars` method recursively replaces `${var}` in all attributes and text nodes.
- You can expand this for more complex needs.

---

## Layout Switching

- Call `widget.setLayout('horizontal')` to switch orientation; widget re-renders itself in place.

---

## Model Integration

- If you want the widget to listen to model changes directly, you can pass a model reference to the constructor, or (preferably) have the model emit events via EventBus.

---

## Summary

- Builder pattern for creation and registry.
- Per-widget class for state, DOM, and event handling.
- Clean destroy/teardown for browser longevity.
- Simple, extensible, and maintainable.

---

Let me know if you want a more detailed implementation, or if you have questions about any part of this plan!

## User:
 Thanks for that!  We are ready to see some hard code in the repository!

Some details:
some tableIDs will have multiple widgets attached, and another DIV is not a tableID.  However, each destination can be guaranteed to be a SPAN or a DIV with an id.  So we should change how we call things with tableID.  Currently, we use 1 and 2 to specialize the ids but this is clunky.  We should probably send in a string for the element ID, be it tblS6_1 or leadSheetCaptionRow, and a second string for the placement within, e.g. "subcaption" or "left" that are simply names, not code meanings. These would be glued together.  Don't think there would be a need for more uniqueness, since the dest element must have a unique ID.  I think this leaves us with :

    constructor(destSelector, ownerID, placementID, layout)

For the widget registry, the answer may be that ownerID keys to an array of widgets created for that owner, because we can easily track the owner id, and call to have its dependent widgets cleaned up.

Let's stick with the widget *not* knowing about the model, since we are putting in the EventBus wiring, which has as its greatest feature decoupling from the model.

I think you have a complete handle on it, but just in case you need any examples to refine thinking, the way we are doing it now and dealing with issues is threaded into construction here:
   TableBuilder.js:: buildNoteTable(options)
       formatKeyBoxes(tableID, "1", false)
  and very messy, WET handling here: 
     NoteTableController.js::replayTable(replayOptions) 
        grabbing DOM ids "relSec*"    

Please go ahead and implement as much as you can in ./templates/SectionStatus/   Please make a file inside that folder called ./templates/SectionStatus/programmer-instructions.md with sample code to instantiate, clean up, and especially code snippets inside tripple backticks for wiring the CSS link code and the Promise template loading lines.


## GitHub Copilot:
 Created [](file:///home/laramie/infinite-neck/templates/SectionStatus/programmer-instructions.md)

Created [](file:///home/laramie/infinite-neck/templates/SectionStatus/section-status.builder.js)

The following files have been created in ./templates/SectionStatus/:

- programmer-instructions.md: Contains sample code for instantiating, cleaning up, and wiring up the SectionStatus widget, including CSS and template loading snippets.
- section-status.builder.js: Implements the SectionStatusBuilder singleton and SectionStatusWidget class, supporting per-widget instantiation, registry, event handling, layout switching, and cleanup.

You can now instantiate widgets with:
```js
SectionStatusBuilder.addToDest('#yourDest', 'yourOwnerID', 'yourPlacementID', 'vertical');
```
and clean up with:
```js
SectionStatusBuilder.removeByOwnerID('yourOwnerID');
```
See programmer-instructions.md for more usage details. Let me know if you want to proceed with further integration or need any adjustments!

Made changes.

## User:
 Excellent! We look forward to playing with your handiwork!

## GitHub Copilot:
 Thank you! If you have any questions or need further tweaks as you integrate and test the SectionStatus widget, just let me know. Happy coding!

## User:
 So the way I do things right now is this: 
```
opts.currSection = getSong().getRelativeSectionWithWrap(wiring.relativeSection);
 ....
let replayOptions = opts; // through parameter passing
....
 relSectionOptions.rootID = replayOptions.currSection.rootID;
```
That means I have a live javascript object reference, currSection, that I can dig things out of, and apply them to the widget, which is hand-coded now, before installing your code.
```
       let relSecRootIDLead1 = "relSecRootIDLead1_"+replayOptions.tablename;
        let relSecRootIDLead2 = "relSecRootIDLead2_"+replayOptions.tablename;
        if (relSectionOptions.rootIDLead > -1 ){
            var keynameLead = getSong().noteIDToNoteName(relSectionOptions.rootIDLead);
            $('#'+relSecRootIDLead1+',#'+relSecRootIDLead2).html(keynameLead).show();
        } else {
            $('#'+relSecRootIDLead1+',#'+relSecRootIDLead2).html("").hide();
        }
        let relSecRootID1 = "relSecRootID1_"+replayOptions.tablename;
        let relSecRootID2 = "relSecRootID2_"+replayOptions.tablename;
        var keyname = getSong().noteIDToNoteName(relSectionOptions.rootID);
        $('#'+relSecRootID1+',#'+relSecRootID2).html(keyname);

        $('#normalKeys1_'+replayOptions.tablename).hide();
        $('#normalKeys2_'+replayOptions.tablename).hide();
        $('#relativeKeys1_'+replayOptions.tablename).show();
        $('#relativeKeys2_'+replayOptions.tablename).show();
```
So I handcode all DOM id references and gingerly keep them lined up (in a few cases, they miss and we get widgets that glow at the wrong time, which is why we had you do this!)

So my question is, how do we grab the widget reference, since there are two per table in this example, to send it the message that rootID has changed?  Both widgets in the same tableID get the same message.  One table listens to one Section.  But we have two widget ids.  So either you can show me how to grab the right reference, or we could tweak the EventBus messages.

## GitHub Copilot:
 Great question! Here’s how you can handle this with the new widget system:

### 1. Widget Registry and Lookup

With the new SectionStatusBuilder, each widget is registered by `ownerID` (e.g., your tableID), and each widget instance has a unique `widgetID` (e.g., `tblS6_1_subcaption_SectionStatus` and `tblS6_1_left_SectionStatus`).

**To get all widgets for a table:**
```js
const widgets = SectionStatusBuilder.registry.get('tblS6_1'); // Array of widget instances
```

**To get a specific widget by placement:**
```js
const widgets = SectionStatusBuilder.registry.get('tblS6_1') || [];
const widget = widgets.find(w => w.placementID === 'subcaption');
```

---

### 2. EventBus Messaging

Currently, your EventBus messages target widgets by `widgetID`. If you want to update both widgets for a table, you can:

- Send two messages, one for each `widgetID` (preferred for precision).
- Or, tweak the EventBus handler so that if the message is sent with just `ownerID`, all widgets for that owner update.

**Example: Send to both widgets**
```js
const widgets = SectionStatusBuilder.registry.get('tblS6_1') || [];
widgets.forEach(widget => {
    EventBus.trigger('Widget:SectionStatus:keyChanged', {
        widgetID: widget.widgetID,
        rootID: ...,
        rootIDLead: ...
    });
});
```

**Or, enhance the widget event handler:**
```js
// In SectionStatusWidget.subscribeEvents()
const keyChangedHandler = (event, data) => {
    if (data.widgetID === this.widgetID || data.ownerID === this.ownerID) {
        this.handleKeyChanged(data);
    }
};
```
Then you can send a single message with `ownerID` and all widgets for that table will update.

---

### 3. Recommendation

- For maximum control and to avoid accidental updates, send messages to specific `widgetID`s.
- If you want to broadcast to all widgets for a table, add `ownerID` to your event data and update the handler as above.

---

### 4. Summary Table

| Approach                | Pros                        | Cons                        |
|-------------------------|-----------------------------|-----------------------------|
| Send to each widgetID   | Precise, avoids collisions  | Slightly more code          |
| Broadcast by ownerID    | Simple for all-in-one update| Risk of accidental updates  |

---

**In short:**  
You can grab the widget reference from the registry by `ownerID` and `placementID`, and send targeted EventBus messages. Or, you can enhance the event handler to listen for `ownerID` and update all widgets for that table.

Let me know if you want a code snippet for either approach!

## User:
 That is clear.  Thanks.
The other case I need to handle, is you can see that I'm having part of the widget's responsibility is displaying different CSS for whether it is in an instrument table that is "listening" or "observing".  Observers can listen to different Sections, so they are look-ahead or look-behind of what everyone else is looking at the model for `getCurrentSection()`.  So we notify the user by having different colors, etc.  And we currently deal with this by using different spans.  But whether we do it that way, or whether we swap out css className, we need to notify the widget that we are in "listener" mode or "observer" mode.  So I was going to send a message on the EventBus to the widget (which I know because I'm in the replay() of the table in `NoteTableController.js::replayTable(replayOptions)` and I have a handle to the Section, the table, and therefore the widgets, and I'm in the if block for "observer" `(replayOptions.type === ReplayOptions.RELATIVE)`.

Can you emit a code snippet for how I would send this message, and how I would handle it in the widget class, please?

## GitHub Copilot:
 Absolutely! Here’s how you can handle “listener” vs. “observer” mode using the EventBus and your widget class.

---

### 1. Sending the Mode Message from replayTable

Suppose you have the widget reference (or widgetID) and you know the mode:

```javascript
// Example: inside replayTable(replayOptions)
const widgets = SectionStatusBuilder.registry.get(replayOptions.tablename) || [];
widgets.forEach(widget => {
    EventBus.trigger('Widget:SectionStatus:modeChanged', {
        widgetID: widget.widgetID,
        mode: (replayOptions.type === ReplayOptions.RELATIVE) ? 'observer' : 'listener'
    });
});
```
Or, if you want to use placementID to target a specific widget:
```javascript
const widget = widgets.find(w => w.placementID === 'subcaption');
if (widget) {
    EventBus.trigger('Widget:SectionStatus:modeChanged', {
        widgetID: widget.widgetID,
        mode: (replayOptions.type === ReplayOptions.RELATIVE) ? 'observer' : 'listener'
    });
}
```

---

### 2. Handling the Message in SectionStatusWidget

Add this to your `subscribeEvents()` in the widget class:

```javascript
const modeChangedHandler = (event, data) => {
    if (data.widgetID === this.widgetID && data.mode) {
        this.setMode(data.mode);
    }
};
EventBus.on('Widget:SectionStatus:modeChanged', modeChangedHandler);
this.eventHandlers.push(['Widget:SectionStatus:modeChanged', modeChangedHandler]);
```

And implement the method:

```javascript
setMode(mode) {
    // Example: swap CSS class on the container or a child element
    this.mode = mode;
    if (this.container) {
        this.container.classList.remove('section-status-listener', 'section-status-observer');
        this.container.classList.add('section-status-' + mode);
    }
    // Or, update a specific span, or swap templates, etc.
}
```

---

### 3. CSS Example

Add to your CSS:
```css
.section-status-listener {
    background-color: #e0f7fa;
}
.section-status-observer {
    background-color: #ffe0b2;
}
```

---

**Summary:**  
- Send a `Widget:SectionStatus:modeChanged` event with the widgetID and mode.
- In the widget, listen for this event and update the DOM/CSS as needed.

Let me know if you want a more advanced pattern or have other widget state needs!

## User:
 Very nice!

## GitHub Copilot:
 Thank you! If you need more examples, integration help, or want to refine the widget/event patterns further, just let me know. Happy coding!


---
## Programmer's Instructions Link
see: [Programmer's Instructions for the SectionStatus widget](../../templates/SectionStatus/programmer-instructions.md)
   