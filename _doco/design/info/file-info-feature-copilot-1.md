# File Info Design Analysis

## Summary

The proposed Info feature fits best as a singleton top-level page component, not as a multi-instance widget.

The best implementation pattern is a hybrid:

- Use the file packaging of SectionStatus: a dedicated folder with one HTML file, one CSS file, and one builder file.
- Use the lifecycle of palette/themes/section-drawer: clone one template into one parked destination in index.html, then bind events once.
- Use the visual tab pattern of Tunings: two fake tab buttons with `BtnPunchedIn` and `BtnPunchedOut` state.
- Do not copy the full SectionStatus registry pattern, because Info is a singleton page, not a repeated widget stamped onto many owners.

The main design risk is not the template packaging. The main risk is that the existing menu and floating systems treat "hide the content div" and "remove the floating wrapper" as different concerns. That is the exact reason the tiny pinned floater survives ESC today.

## Existing Patterns Compared

### 1. Palette

Relevant files:

- [templates/palette.builder.js](../../templates/palette.builder.js)
- [templates/palette.html](../../templates/palette.html)
- [templates/palette.css](../../templates/palette.css)

What palette gets right:

- It already follows the desired page pattern of `html + css + builder`.
- It is a singleton page inserted into a parked destination in [index.html](../../index.html#L60).
- It already uses the float button convention that works with [dockable.js](../../dockable.js).
- It is close to the intended UX for Info because it is a top-level menu page that can be floated.

What palette gets wrong or leaves weak:

- It relies heavily on global IDs and global selectors, so the builder is not very self-contained.
- Event binding is wide and document-global in several places, which makes the component harder to reason about than it needs to be.
- The builder owns cloning and event binding, but not much explicit render-state logic.

Conclusion:

- Palette is the best current page-level precedent for Info.
- Info should copy its top-level lifecycle, but should improve on its scoping discipline.

### 2. Section Drawer

Relevant files:

- [templates/section-drawer.builder.js](../../templates/section-drawer.builder.js)
- [templates/section-drawer.html](../../templates/section-drawer.html)
- [templates/section-drawer.css](../../templates/section-drawer.css)

What section-drawer gets right:

- It is small, understandable, and direct.
- It uses the same singleton builder shape as palette.
- It is a good example of a page fragment that is installed once and then updated from the rest of the app.

What section-drawer gets wrong or leaves weak:

- It is still largely driven by global selectors.
- It does not separate render/update methods from one-time event binding very much.
- It is not dockable by itself; it lives inside transport.

Conclusion:

- Section Drawer is a good example of size and simplicity.
- It is a useful guide for keeping InfoBuilder small, but not a full UX model for the feature.

### 3. Themes

Relevant files:

- [templates/themes.builder.js](../../templates/themes.builder.js)
- [templates/themes.html](../../templates/themes.html)
- [templates/themes.css](../../templates/themes.css)

What themes gets right:

- It is another singleton page builder with a dedicated template file.
- It demonstrates a page that has its own local controls and some render/rebuild behavior.

What themes gets wrong or leaves weak:

- It is closer to a large control panel than to a compact content page.
- It still uses global selectors throughout.
- It does not provide a stronger abstraction than palette; it is simply another variation of the same generation.

Conclusion:

- Themes is useful as another reference that the singleton page-builder pattern is established.
- It is not the strongest model for Info beyond confirming the packaging direction.

### 4. Transport

Relevant files:

- [templates/transport.builder.js](../../templates/transport.builder.js)
- [index.html](../../index.html#L1035)

What transport gets right:

- It contains the strongest current layout logic for a floating-or-parked UI region.
- It has explicit methods for show, toggle, resize, expand, collapse, and parking modes.
- It is the most evolved current example of stateful UI behavior separated from the rest of the app.

What transport gets wrong or leaves weak for this feature:

- It is not packaged as a full `html + css + builder` triplet in its own directory.
- Its markup still lives in [index.html](../../index.html#L1035), so it is not the template-loading model you want for Info.
- It solves a different problem: transport docking and section drawer expansion, not a self-contained content page.

Conclusion:

- Transport should influence Info's behavior API, not its file packaging.
- The useful lesson is to give Info explicit show/hide/float/dock methods rather than making visibility purely incidental DOM manipulation.

### 5. SectionStatus

Relevant files:

- [templates/SectionStatus/section-status.builder.js](../../templates/SectionStatus/section-status.builder.js)
- [templates/SectionStatus/section-status.html](../../templates/SectionStatus/section-status.html)
- [templates/SectionStatus/section-status.css](../../templates/SectionStatus/section-status.css)

What SectionStatus gets right:

- It has the cleanest file packaging in the repo.
- It supports multiple templates inside one HTML file.
- It separates the builder/registry from the instance widget class.
- It has an explicit lifecycle: create, render, subscribe, update, destroy.
- It is the most componentized code of the group.

What SectionStatus gets wrong or leaves weak for this feature:

- It is built for repeated widget instances, not one singleton page.
- It uses template-string expansion and owner/widget IDs because it must support many copies.
- That extra machinery would be unnecessary overhead for Info.

Conclusion:

- SectionStatus is the best packaging model, but not the best runtime model.
- Info should borrow its directory structure and lifecycle thinking, not its registry pattern.

### 6. Tunings Tabs

Relevant files:

- [index.html](../../index.html#L788)
- [TuningsLibrary.js](../../TuningsLibrary.js#L459)
- [infinite-neck.css](../../infinite-neck.css#L190)

What tunings gets right:

- The fake tabs are simple and readable.
- The active/inactive states are already visually integrated with the app through `MenuTabBtn`, `BtnPunchedIn`, and `BtnPunchedOut`.
- The switching logic is tiny and easy to reproduce.

What tunings gets wrong or leaves weak:

- The tab markup is inline in [index.html](../../index.html#L788), not packaged as a component.
- The tab state is DOM-only and not represented explicitly as component state.
- `bindFormTuningsEvents()` mixes tab behavior with the rest of tunings behavior.

Conclusion:

- The visual and interaction model is right for Info.
- The implementation should be copied conceptually, but moved into `templates/info/info.*` rather than repeated inline in index.html.

## Recommended Componentization For Info

The cleanest design for this sprint is:

- `templates/info/info.html`
- `templates/info/info.css`
- `templates/info/info.builder.js`

And one parked destination in [index.html](../../index.html):

- `divInfo` as the parked host in the top menu area

Inside `info.html`, use one root page element:

- `#info` as the actual menu/page div that is shown, hidden, floated, and docked

This mirrors palette's parked-destination pattern:

- parked host in index.html
- actual root element inside the loaded template

That matters because the menu system currently shows and hides the actual menu element, not merely its parking slot. See [infinite-neck.js](../../infinite-neck.js#L635).

## Recommended Builder Shape

Info should be a singleton builder with explicit UI methods.

Recommended public methods:

- `addToDest(divDestSelector)`
- `bindEvents()`
- `renderFromSong(song)`
- `show(mode = 'parked')`
- `hide()`
- `activateTab(tabName)`
- `persistInfo()`
- `persistOpenInfo()`
- `applyOpenInfoOnSongLoad(song)`

This is more explicit than palette today, and closer to the transport builder style where the UI behavior has named operations.

## Recommended Runtime Model

Info should not be event-driven at first.

Direct JS calls are the better fit for the feature because:

- the page is singleton
- the page is directly tied to the current Song
- there is no fan-out problem to solve
- the existing menu system already opens pages by direct call

So the initial interaction flow should be direct:

- song open loads Song.info and Song.openInfo
- InfoBuilder renders from current song
- menu button or `/fi` calls `showOneMenu('#info')` or a thin wrapper around it
- if open mode is `float`, the code shows the page then floats it once

If a later sprint wants cross-component notifications, those can be layered in. They are not necessary to get the first implementation right.

## Design Holes To Resolve Before Coding

### 1. Raw HTML Policy

This is the biggest design hole.

The request says `Song.info` stores raw HTML and that it should render as HTML. That is feasible, but you need an explicit policy for whether the app allows these inside info content:

- `<script>`
- `<style>`
- inline event handlers such as `onclick`
- `<iframe>`
- external assets
- `javascript:` URLs

If the answer is "yes, fully trusted HTML," then song files can execute arbitrary code in the app context. That may be acceptable for your own local files, but it should be a conscious choice.

My recommendation for this sprint:

- allow normal content markup such as `div`, `p`, `span`, `ul`, `ol`, `li`, `a`, `strong`, `em`, `img`, `table`
- do not allow script-bearing or page-global tags
- treat info as rich content, not as a code execution surface

Even if you defer full sanitization, the design should declare the intended trust model now.

### 2. CSS Bleed

The request says the app supplies the surrounding body and stylesheet. That is fine, but raw HTML can still introduce markup that collides visually with the rest of the app.

Questions to answer:

- Are inline styles allowed?
- Are class names in info HTML allowed to depend on app CSS?
- Are style tags forbidden?

Recommendation:

- render info inside a clearly namespaced container such as `.infoRendered`
- allow inherited app typography and spacing
- do not allow page-global style tags in stored info markup

### 3. Persistence On Blur Only

Saving only on blur is slightly fragile.

Examples that can lose edits:

- the user types, then closes the song or reloads before the textarea blurs
- the user triggers some command that swaps state while focus remains in the textarea

Recommendation:

- keep `blur` because it matches the requested UX
- also persist on `change`
- optionally persist on tab switch away from Edit

That still feels like "no save button," but is safer.

### 4. Default Values And Schema

The design introduces two new Song properties:

- `Song.info`
- `Song.openInfo`

You should define defaults now:

- `Song.info = ""`
- `Song.openInfo = "none"`

Also decide whether missing values in older songs are normalized when loaded, or merely treated as absent in the UI.

### 5. Empty Info Behavior

The current request does not say what happens if:

- `openInfo` is `float` or `parked`
- but `info` is empty

Possible behaviors:

- show an empty Info page anyway
- suppress auto-open when info is empty
- show Edit tab instead of Info tab when info is empty

My recommendation:

- if auto-open is requested and info is empty, still show the page
- but keep the initial active tab as Info to stay consistent with the spec
- show a small empty-state message in the rendered tab such as "No song info yet"

### 6. First-Show Tab Semantics

The design clearly says that on first showing, the rendered Info tab is shown first.

What is still unclear is whether that applies:

- only on song-open auto-show
- only on the first show after each song load
- on every explicit open via button or `/fi`

Recommendation:

- reset to the rendered Info tab on song load and on first explicit show after song load
- after that, preserve the current tab while the page remains open

### 7. Floating Close Semantics

This needs an explicit design decision because it intersects the known dockable bug.

Today ESC hides menu divs through [hideAllMenuDivs()](../../infinite-neck.js#L640), while floating wrappers are managed separately by [dockable.js](../../dockable.js#L116). That split is why a floating wrapper can survive after its child content is hidden.

Recommendation:

- add an Info-specific close path in the feature design
- the Close button and ESC handling for Info should call `InfoBuilder.hide()`
- `InfoBuilder.hide()` should ensure both the content page and any floating wrapper are removed or docked cleanly

If you want a narrow sprint workaround instead of a general dockable fix, this is the least invasive place to put it.

### 8. Menu Registration Detail

The new top-level button is straightforward, but the exact selector used by the menu system matters.

Current menus are mapped through `AllMenuDivs` in [infinite-neck.js](../../infinite-neck.js#L629).

For Info, the design should specify whether the menu system targets:

- `#divInfo`, the parked host in index.html
- or `#info`, the actual page root cloned from the template

Recommendation:

- use `#divInfo` only as a parking slot
- use `#info` as the visible menu page and the item registered in `AllMenuDivs`

That keeps it consistent with palette.

### 9. Command-Line And Key Trigger Language

The request says `/fi` with trigger `i` and caption `info`.

This looks fine for the command tree, but it is worth confirming that `i` is only the trigger within the `/f...` branch and not intended as a new global keybinding. There is already existing key usage in [key-handlers.js](../../key-handlers.js#L195).

Recommendation:

- treat `i` as the submenu trigger inside the slash command structure only
- do not add a new global one-key hotkey for Info

### 10. HTML Editing Ergonomics

The request says "a resizable textarea that hopefully is as big as its container." That is implementable, but one detail should be decided now:

- Should the Edit tab show raw HTML only?
- Or should it eventually support a preview split?

For this sprint, raw HTML in a full-size textarea is the correct scope. A split preview would add complexity without solving a design problem you have actually asked for.

## Recommended Scope Boundary

For this sprint, I would keep Info deliberately narrow:

- singleton page
- packaged under `templates/info/`
- fake tabs like Tunings
- float button like palette/themes
- parked or floating auto-open based on `Song.openInfo`
- explicit `show`, `hide`, `render`, and `persist` methods
- no EventBus dependency unless implementation reveals a real need

I would explicitly defer:

- generalized dockable lifecycle cleanup for every page
- rich HTML sanitization framework
- modal behavior
- WYSIWYG editing
- tab state persistence across app reloads

## Concrete Recommendation

If the question is "which existing template family should Info follow," the answer is:

- package it like SectionStatus
- instantiate it like palette
- keep it as small and direct as section-drawer
- borrow tab visuals from Tunings
- borrow explicit behavioral methods from transport

That combination is the best fit for the feature as requested and avoids importing the wrong complexity from any one precedent.

## Proposed Next Design Pass

Before coding, the next useful design step would be to write a short implementation sketch that settles only these items:

- exact DOM IDs and parked/root selectors
- `InfoBuilder` public API
- `Song.info` and `Song.openInfo` defaults
- trusted HTML policy
- exact close behavior for parked versus floating Info

Once those are fixed, the implementation should be straightforward.
