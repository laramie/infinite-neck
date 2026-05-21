# File Info Implementation Plan

## Purpose

This sprint adds a new top-level singleton page, Info, for song-specific informational HTML stored on the Song model.

The feature must:

- let song authors store sanitized rich HTML in `Song.info`
- let users view that HTML in a rendered Info tab
- let users edit the raw HTML in an Edit tab
- persist `Song.info` and `Song.openInfo` without a dedicated save flow
- support parked and floated display modes
- close cleanly even when floated, without leaving the tiny pinned floater behind

This plan implements the approved design decisions from Iteration 2 and keeps the scope narrow enough for the sprint.

## Approved Design Inputs

The design answers are sufficient to proceed.

The implementation will adopt these approved decisions:

- `Song.info` default is `""`
- `Song.openInfo` default is `"none"`
- menu entry is `/fi` under `/f`, with trigger `i` and caption `info`
- top-level menu button is `Info`, placed between File and Chart
- `#divInfo` is only the parking slot
- `#info` is the actual visible menu page
- first show after song load opens the rendered Info tab
- after that, current tab selection is preserved across ESC/show/hide, matching Tunings behavior
- persistence happens on `blur`, `change`, and when switching away from Edit
- pure whitespace content is trimmed to empty and disables `Song.openInfo`
- empty `Song.info` never auto-opens
- close button and ESC both use `InfoBuilder.hide()`
- no EventBus dependency is required for this feature

## Implementation Choice Resolved Here

One item was intentionally left conditional in the design answers: inline styles.

For this sprint, inline styles should be disallowed.

Reasoning:

- song files may be shared between users
- the feature explicitly prioritizes sanitization
- allowing inline style expands the attack surface and complicates review
- the feature does not need inline style support to satisfy its main purpose

This keeps the sanitizer simple, dependency-free, and defensible. If a later sprint wants inline style support, it can be added explicitly with its own review.

## End State For This Sprint

At the end of this sprint, the code should support this flow:

1. Song objects always carry `info` and `openInfo` defaults.
2. The app loads a new `templates/info/` page template and stylesheet.
3. A new `InfoBuilder` installs the page into `#divInfo`.
4. Users can open Info from the top menu button or `/fi`.
5. The Info tab renders sanitized HTML from `Song.info`.
6. The Edit tab shows editable raw HTML and the `openInfo` selector.
7. Leaving Edit persists sanitized content and re-renders Info.
8. If `Song.openInfo` is `parked` or `float`, a newly opened song shows Info automatically only when sanitized content is non-empty.
9. Closing a floated Info page removes the floating wrapper cleanly.

## Non-Goals For This Sprint

These items are explicitly out of scope:

- general fix of all floating-window behavior in the app
- shared window manager or layout manager work
- generalized dockable lifecycle redesign
- WYSIWYG editing
- split preview mode
- widget expansion or variable interpolation inside Info HTML
- EventBus integration for Info state changes
- support for external resources, anchors, forms, controls, media, or scripts inside `Song.info`

## Files To Add

### New template files

- `templates/info/info.html`
- `templates/info/info.css`
- `templates/info/info.builder.js`

## Files To Modify

### UI shell and bootstrapping

- `index.html`
- `infinite-neck.js`
- `key-handlers.js`
- `menu.js`

### Song model and persistence

- `SongPersistence.js`

### Optional shared floating support

- `dockable.js` only if a clean, generally useful helper emerges during implementation

This sprint should not change shared floating code unless the change is direct, small, and improves the current code rather than adding legacy branching.

## Architectural Shape

The Info feature should follow a hybrid of existing repo patterns:

- package like `templates/SectionStatus/*`
- install once like `palette.builder.js`
- keep builder size and directness like `section-drawer.builder.js`
- use Tunings-style fake tabs
- expose explicit show/hide methods in the style of `transport.builder.js`

Runtime model:

- singleton page
- direct calls from app code
- no registry
- no EventBus listeners

## DOM Structure Plan

### Parking slot in `index.html`

Add a parked destination div near the other top-level menu pages:

- `#divInfo`

Add a new top menu button between File and Chart:

- `#btnInfo`

### Root template element in `templates/info/info.html`

The loaded template should clone in a single root page:

- `#info`

Recommended high-level internal structure:

- float button row
- Tunings-style fake tab row
- rendered tab panel
- edit tab panel

Recommended main internal element IDs:

- `#btnFloatSection_info`
- `#btnInfoTabInfo`
- `#btnInfoTabEdit`
- `#divInfoTabInfo`
- `#divInfoTabEdit`
- `#divInfoRendered`
- `#selOpenInfo`
- `#btnSaveInfo`
- `#textareaSongInfo`
- `#btnCloseInfo`

The rendered panel should also include the close affordance:

- centered `Close` button
- static text `Or hit ESC to close`

## CSS Plan

`templates/info/info.css` should:

- style `#info` as a top-level menu page consistent with existing menu pages
- reuse app button classes where practical instead of re-inventing tab/button styling
- match the Tunings tab visual language for the tab bar
- make the Edit textarea large, resizable, and container-filling in normal desktop use
- keep the rendered panel readable with a simple content wrapper class such as `.infoRendered`

The CSS should not attempt to sandbox arbitrary user CSS. That is handled by sanitizer policy through disallowing style-bearing content.

## Builder API Plan

`templates/info/info.builder.js` should export `InfoBuilder`.

Recommended public methods:

- `addToDest(divDestSelector)`
- `bindEvents()`
- `renderFromSong(song = getSong())`
- `show(forceMode = null)`
- `hide()`
- `isVisible()`
- `activateTab(tabName)`
- `persistInfo()`
- `persistOpenInfo()`
- `applyOpenInfoOnSongLoad(song = getSong())`
- `sanitizeHtml(rawHtml)`
- `getSanitizedInfo(rawHtml)`

Recommended internal state on the builder singleton:

- `div_info`
- `currentTab`
- `firstShowAfterSongLoad`
- `eventNamespace`

## Sanitization Plan

This feature needs a strict allowlist sanitizer with no new dependency.

Implementation approach:

1. Parse with a detached DOM container or `DOMParser`.
2. Walk the parsed nodes.
3. Drop disallowed nodes entirely.
4. For allowed elements, strip all attributes.
5. Remove HTML comments.
6. Preserve text nodes.
7. Serialize sanitized HTML back to a string.

### Allowed tags for sprint 1

Allow only non-interactive, presentation-oriented tags such as:

- `div`
- `p`
- `br`
- `span`
- `strong`
- `b`
- `em`
- `i`
- `u`
- `s`
- `small`
- `sub`
- `sup`
- `code`
- `pre`
- `blockquote`
- `ul`
- `ol`
- `li`
- `h1`
- `h2`
- `h3`
- `h4`
- `h5`
- `h6`
- `table`
- `thead`
- `tbody`
- `tr`
- `th`
- `td`
- `hr`

### Disallowed content

Disallow all of the following by rule, not by best effort:

- `script`
- `style`
- `iframe`
- `object`
- `embed`
- `svg`
- `math`
- `form`
- `input`
- `textarea`
- `select`
- `button`
- `label`
- `img`
- `audio`
- `video`
- `link`
- `meta`
- `base`
- `a`
- any event-handler attribute
- any `href`, `src`, `action`, `formaction`, or similar navigation/resource attribute
- all inline styles
- all HTML comments

This initial rule set aligns with the safety goals and the approved use case of formatted comments, headings, and lists.

## Song Model Plan

Defaults belong in `SongPersistence.js`, where current Song defaults already live.

Add to `songDefaults`:

- `info: ""`
- `openInfo: "none"`

This ensures:

- new songs get the fields automatically
- older songs opened from disk receive the defaults on construction
- saved songs persist the new fields without any separate legacy migration step

No additional persistence override is required unless implementation reveals a replacer-side exclusion conflict.

## App Bootstrapping Plan

### `index.html`

Add:

- stylesheet link for `templates/info/info.css`
- top-level menu button `#btnInfo` between File and Chart
- parked host `#divInfo` near the other menu divs

### `infinite-neck.js`

Add:

- import for `InfoBuilder`
- template load in `appInit()` using `loadTemplates('templates/info/info.html')`
- `InfoBuilder.addToDest('#divInfo')` in the corresponding promise
- `#info` entry in `AllMenuDivs`
- click binding for `#btnInfo`
- post-open hook in `updateAfterOpenSong()` to refresh and optionally auto-show Info

Recommended open-song sequence in `updateAfterOpenSong()`:

1. normalize current song defaults through constructor state
2. render Info from the current Song
3. reset Info first-show state for the new song
4. apply `Song.openInfo`

The auto-open call should be made after the song object is fully installed and after normal menu/theme setup for that song, so Info reflects the actual loaded state.

## Menu Integration Plan

### `menu.js`

Under `/f`, add a new child item:

- caption `info`
- trigger `i`
- action `showDialog-info`

### `key-handlers.js`

Add a new action case:

- `showDialog-info` -> show the Info page through the same path as the menu button

That keeps `/fi` aligned with the button behavior and avoids a separate logic path.

## Info Open/Show/Hide Behavior Plan

### Show behavior

`InfoBuilder.show(forceMode = null)` should:

1. determine the target mode:
	- explicit `forceMode` if supplied
	- otherwise current `Song.openInfo` when relevant
	- otherwise normal parked mode for manual open
2. render current Song state into both panels
3. on first show after song load, activate the rendered Info tab
4. otherwise preserve the previous tab selection
5. show the page in parked mode first
6. if target mode is `float`, float it after it is visible

Manual opens from button and `/fi` should default to parked mode, not rewrite `Song.openInfo`.

### Hide behavior

`InfoBuilder.hide()` should:

1. persist pending Edit content if needed
2. cleanly remove floating wrapper state if Info is currently floated
3. hide `#info`
4. reset button state as needed

The implementation must not leave `floating-info` behind.

For this sprint, that behavior may be implemented entirely inside `InfoBuilder.hide()` if that is the cleanest path.

## Floating Window Plan

The general dockable bug is deferred, but Info must close correctly.

Recommended implementation order:

1. Build Info on the existing `makeDivDockable('info')` mechanism.
2. Add builder-owned detection for whether Info is currently floated.
3. When hiding Info, explicitly clean up the wrapper created by `dockable.js`.

Preferred cleanup strategy:

- use existing dock-back behavior if it produces a clean disappearance
- if docking would briefly re-show the page or cause side effects, remove the wrapper and restore parked placement directly from `InfoBuilder.hide()` in a narrow, local way

If a small helper naturally belongs in `dockable.js`, it is acceptable to add one helper such as a "close dockable now" operation, but only if it improves the shared abstraction without adding compatibility branches.

## Tab Behavior Plan

Tabs should emulate Tunings behavior, with explicit state in the builder.

Rules:

- valid tabs are `info` and `edit`
- button classes switch between `BtnPunchedIn` and `BtnPunchedOut`
- `currentTab` survives ESC/show/hide within the same loaded song
- `firstShowAfterSongLoad` resets on song load
- first show after song load forces the Info tab

Switching away from Edit must:

- persist sanitized content
- re-render the rendered panel

Switching to Info should always render from the currently persisted Song state.

## Persistence Rules Plan

### `Song.info`

On persist:

1. read textarea value
2. trim trailing whitespace only
3. if resulting content is pure whitespace, store `""`
4. sanitize the resulting HTML
5. if sanitized output is empty or whitespace-only, store `""`
6. assign to `getSong().info`

The textarea should then reflect the persisted value so the user sees the normalized result.

### `Song.openInfo`

On persist:

- allowed values are only `none`, `parked`, `float`
- if `Song.info` is empty after persistence, force `Song.openInfo = 'none'`
- selector UI should update to reflect that normalization

### Save triggers

Persist on:

- textarea `blur`
- textarea `change`
- leaving Edit tab
- explicit click of the `Save: ✓` button
- changing the `openInfo` selector

The `Save: ✓` button is a convenience commit action, not a different save path.

## Auto-Open Rules Plan

When a song is opened:

1. sanitize and normalize current `Song.info` as needed for display
2. if sanitized content is empty, set `Song.openInfo = 'none'`
3. if `Song.openInfo === 'parked'`, show parked Info
4. if `Song.openInfo === 'float'`, show Info and float it
5. if `Song.openInfo === 'none'`, do nothing

Manual open actions must not silently change `Song.openInfo`.

## ESC And Close Button Plan

Both paths must use `InfoBuilder.hide()`.

Recommended integration:

- Close button inside Info calls `InfoBuilder.hide()` directly
- `hideAllMenuDivs()` gets a special-case for `#info`, parallel to the existing `#spanSectionDrawer` special-case

That means the existing ESC flow in `key-handlers.js` can remain simple:

- ESC calls `hideAllMenuDivs()`
- `hideAllMenuDivs()` delegates Info cleanup to the builder API

This keeps Info close behavior centralized and avoids duplicating floating cleanup logic between ESC and button handlers.

## Event Binding Plan

`InfoBuilder.bindEvents()` should use namespaced `.off().on()` bindings consistent with current repo practice.

Bindings needed:

- click `#btnInfoTabInfo`
- click `#btnInfoTabEdit`
- click `#btnCloseInfo`
- click `#btnSaveInfo`
- blur/change `#textareaSongInfo`
- change `#selOpenInfo`
- optional Enter handling on the selector row only if it improves UX without interfering with textarea editing

Avoid document-global delegated bindings unless necessary.

## Validation And Testing Plan

### Manual validation

Verify these user flows:

1. Open Info from the new top button.
2. Open Info from `/fi`.
3. Edit HTML, blur textarea, reopen, and confirm persistence.
4. Switch from Edit to Info and confirm sanitize + re-render.
5. Choose `parked`, save, reopen song, confirm auto-open parked.
6. Choose `float`, save, reopen song, confirm auto-open floated.
7. Make content whitespace-only, save, confirm Info does not auto-open and selector normalizes to `none`.
8. Float Info, press ESC, confirm no tiny floater remains.
9. Float Info, click Close, confirm no tiny floater remains.
10. Confirm other menus still close normally with ESC.

### Sanitizer validation

Verify removal of:

- scripts
- styles
- comments
- buttons and form controls
- anchors and href-bearing content
- images and resource tags
- inline styles

Verify preservation of:

- headings
- paragraphs
- lists
- tables
- inline emphasis tags
- plain text and intended leading whitespace before visible text

### Automated tests

If tests are added in this sprint, prioritize narrow logic tests over full UI tests:

- sanitizer allowlist/denylist tests
- normalization tests for trailing whitespace and empty-content handling
- auto-open normalization tests for `Song.openInfo`

## Implementation Order

Recommended coding order:

1. Add Song defaults.
2. Add `index.html` button, host div, and stylesheet link.
3. Add `templates/info/info.html` and `templates/info/info.css`.
4. Implement `InfoBuilder` skeleton with `addToDest`, tabs, and basic show/hide.
5. Integrate template loading and button/menu hooks.
6. Implement sanitizer and persistence normalization.
7. Hook song-open auto-show behavior.
8. Implement floated close cleanup.
9. Run manual validation and add any narrow tests if practical.

## Expected Review Focus

When this implementation is reviewed, the primary focus should be:

- sanitizer strictness
- correctness of `Song.info` and `Song.openInfo` normalization
- whether Info close cleanup is truly self-contained
- whether the feature introduces any regressions in menu show/hide behavior
- whether the code stays within the approved singleton-page architecture

## Approval Checkpoint

If this plan is approved, implementation can proceed without another design pass.

The only meaningful behavior choice already resolved here is that inline styles are out for this sprint in favor of a simpler and safer allowlist sanitizer.
