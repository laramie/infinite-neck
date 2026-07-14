# sprint-138-tutorial-mode — Iteration 2 Implementation Plan Draft

Date: 2026-07-13

Inputs:

- [Iteration 1 Design](138-it1-design.md)
- [Copilot Iteration 1 Design Review](138-it1-copilot-design-review.md)
- [Iteration 2 Design](138-it2-design.md)

## Purpose of this document

This document converts the Iteration 2 tutorial-mode design into a draft implementation plan. It intentionally omits rejected Iteration 1 ideas and focuses on the current target design:

1. A tutorial Prompt Area that follows the current Section.
2. Tutorial levels `none | strict | wizard`.
3. A runtime authoring override controlled by `tutorialAuthoring=true|false`.
4. A first-app splash screen that prevents the empty startup display.
5. Embedded tutorial prompt HTML stored in the song file via a build process.
6. Tutorial-safe action and UI lockdown mechanisms.
7. Chart support needed by tutorials, including LeadSheet in fullscreen-like displays.
8. A Course/Lesson/Tutorial directory convention under the Song Library.

This is still a draft. Several implementation choices require design confirmation before coding begins.

## Iteration 2 scope

### In scope

1. Add persisted tutorial metadata to Song and Section data.
2. Add runtime tutorial presentation state under `gPresentation.tutorial`.
3. Add a tutorial controller module responsible for tutorial mode activation, Prompt Area rendering, navigation, progress, and UI/action gating.
4. Add a Prompt Area template, builder, and CSS.
5. Add tutorial query parameter handling for `tutorialAuthoring=true|false`.
6. Add a Prompt Area author-preview checkbox visible only when tutorial authoring mode is active.
7. Add strict-mode lockdown defaults.
8. Add wizard-mode UI surface controls.
9. Add a splash screen flow for startup, URL song load, tutorial load, tuning query, and blank-song authoring.
10. Add a build process that reads `${songfile-stem}.prompts.html` and writes prompt/caption data into the tutorial song JSON.
11. Add sanitizer support for tutorial prompt HTML and safe tutorial prompt actions.
12. Add Course/Lesson/Tutorial library conventions and enough metadata handling for tutorial listings.
13. Add Chart LeadSheet support to fullscreen-style display and allow tutorial-controlled Chart surfaces.
14. Add tutorial tests for model normalization, build process, sanitizer/action gating, and pure tutorial logic.

### Out of scope for this draft

1. Implementing full tutorial content/course authoring.
2. Building a custom visual tutorial authoring editor inside the app.
3. Making `.prompts.html` files appear as loadable songs in the Song Library.
4. Supporting the removed Iteration 1 `advanced` tutorial level.
5. Runtime fetches of per-section prompt fragments.
6. `<tutorial-btn>` source-to-button transformation as the primary prompt action model.
7. Replacing existing Info, Fill, Palette, or Transport panels.
8. Persisting learner progress into the song file.

## Current architecture seams

### Runtime application lifecycle

Relevant files:

- [infinite-neck.js](infinite-neck.js)
- [Song.js](Song.js)
- [SongPersistence.js](SongPersistence.js)
- [Section.js](Section.js)
- [SectionPersistence.js](SectionPersistence.js)
- [event-bus.js](event-bus.js)

Current lifecycle points to use:

1. `appInit()` creates a new Song, loads templates, binds app events, installs default tunings, then optionally loads URL content.
2. `openSong()` replaces the active Song, loads plugin runtime state, and calls `updateAfterOpenSong()`.
3. `updateAfterOpenSong()` refreshes UI state after a loaded song becomes active.
4. `sectionChanged()` is the app-level current-section refresh seam.
5. `Song.publish_SectionChanged()` emits `SectionChanged` through `EventBus`.

Implementation direction:

- Add tutorial hooks at app/song/section lifecycle seams instead of scattering checks through many UI functions.
- Keep tutorial controller logic testable without relying on browser DOM whenever possible.

### Presentation state

Relevant files:

- [presentation.js](presentation.js)
- [_doco/developer/globals-programmers-reference.md](_doco/developer/globals-programmers-reference.md)

Current `gPresentation` is page-session state. Tutorial mode should extend it intentionally, not add unrelated globals.

### Keyboard/action routing

Relevant files:

- [key-handlers.js](key-handlers.js)
- [command-line.js](command-line.js)
- [menu.js](menu.js)
- [app-action-fragment.js](app-action-fragment.js)

Current action paths include:

1. Normal keyboard shortcuts in `document_keypress()`.
2. Spacebar mapping in `document_keydown()`.
3. Escape handling in `document_keyup()`.
4. Command-line menu actions through `performCmdAction()`.
5. `[data-action]` click handlers in [infinite-neck.js](infinite-neck.js).
6. Info superlinks for macro/raise actions.
7. Macro executor paths.

Implementation direction:

- Strict tutorial mode needs both keyboard gating and action gating.
- Wizard mode may show more UI, but still needs tutorial-aware action policy when a surface is hidden or locked.

### Info/prompt rendering precedents

Relevant files:

- [templates/info/info.builder.js](templates/info/info.builder.js)
- [templates/info/info.html](templates/info/info.html)
- [templates/info/info.css](templates/info/info.css)
- [html-sanitizer.js](html-sanitizer.js)

The Info builder is the closest existing model: template clone, namespaced binding, sanitized HTML rendering, and current Song data binding. Tutorial should follow the builder pattern but use a separate Prompt Area.

### Schema and validation

Relevant file:

- [bin/song-file-schema.js](bin/song-file-schema.js)

Current schema is permissive at top-level Song and Section levels, but tutorial data should be explicitly validated because it can affect UI lockdown and actions.

## Data model

### Song-level tutorial shape

Add explicit support for:

```json
{
  "tutorial": {
    "level": "strict",
    "caption": "Chromatic Scale on one string",
    "allowedUI": ["promptArea", "fretTables", "chartLeadSheet"],
    "storageKey": "tutorials/C000-intro/L001-one-string-intro/L001-1"
  }
}
```

Required fields:

- `level`: one of `none`, `strict`, `wizard`.

Optional fields:

- `caption`: display caption for the tutorial/song, populated by the prompt build process.
- `allowedUI`: wizard-mode semantic surface overrides.
- `storageKey`: stable key for local progress.
- `coursePath`: optional normalized path under `songs/`, if needed for breadcrumbs.
- `tutorialFile`: optional songfile basename, if not derived at runtime.

Default behavior:

- Missing `tutorial` means `level=none`.
- Missing `tutorial.level` means `none`.
- `strict` uses one default strict lockdown profile.
- `wizard` uses one default wizard profile plus `allowedUI` additions.

### Section-level tutorial shape

Add explicit support for:

```json
{
  "tutorial": {
    "caption": "Caption for Section 1 - Getting Started",
    "prompt": {
      "lines": [
        "        <p>Prompt for Section 1 goes here</p>"
      ]
    }
  }
}
```

Required fields for tutorial Sections:

- none; non-tutorial Sections remain valid.

Optional fields:

- `caption`: Section tutorial caption populated from `data-caption-for-section`.
- `prompt.lines`: array of HTML lines populated from `data-prompt-for-section`.

Not persisted in Section tutorial data:

- learner `done`
- learner `bookmark`
- learner `visited`
- author-preview state

Learner progress remains browser-local storage.

### Local tutorial progress shape

Store learner progress in browser storage:

```json
{
  "version": 1,
  "storageKey": "tutorials/C000-intro/L001-one-string-intro/L001-1",
  "completedSections": [0, 1],
  "visitedSections": [0, 1, 2],
  "bookmarkSectionIndex": 2,
  "updatedAt": "2026-07-13T00:00:00.000Z"
}
```

Recommended storage key:

```text
infinite-neck:tutorial-progress:<song.tutorial.storageKey-or-derived-song-path>
```

## Runtime presentation state

### `gPresentation.tutorial`

Extend [presentation.js](presentation.js):

```js
gPresentation.tutorial = {
  level: 'none',
  active: false,
  tutorialAuthoring: false,
  authorPreviewLockdown: false,
  effectiveLockdown: false,
  visibleSurfaces: new Set(),
  lockedSurfaces: new Set(),
  currentSectionIndex: -1,
  promptVisible: false,
  lastActionBlocked: ''
};
```

Notes:

1. `tutorialAuthoring` is runtime-only and controlled by query param.
2. `authorPreviewLockdown` is the Prompt Area checkbox state.
3. `effectiveLockdown` is true when:
   - tutorial is active, and
   - not in tutorial authoring mode, or authoring preview is checked.
4. `visibleSurfaces` and `lockedSurfaces` are semantic names, not selectors.

### Presentation helper API

Add a tutorial presentation helper class or exported functions from [presentation.js](presentation.js):

- `TutorialPresentation.reset()`
- `TutorialPresentation.setTutorialAuthoring(value)`
- `TutorialPresentation.setAuthorPreviewLockdown(value)`
- `TutorialPresentation.setLevel(level)`
- `TutorialPresentation.isActive()`
- `TutorialPresentation.isStrict()`
- `TutorialPresentation.isWizard()`
- `TutorialPresentation.isTutorialAuthoring()`
- `TutorialPresentation.isEffectiveLockdown()`
- `TutorialPresentation.canShow(surfaceName)`
- `TutorialPresentation.canRunAction(actionName)`

Keep DOM mutation outside [presentation.js](presentation.js). Presentation state helpers should not fetch prompts, mutate the Song, or run actions.

## Tutorial controller module

### New module

Add [Tutorial.js](Tutorial.js).

Responsibilities:

1. Normalize tutorial metadata from the active Song.
2. Apply tutorial runtime state to `gPresentation.tutorial`.
3. React to song load and section changes.
4. Render Prompt Area state through the prompt builder.
5. Manage local tutorial progress.
6. Provide safe tutorial action dispatch for Prompt Area controls.
7. Provide action/key gating helpers used by [key-handlers.js](key-handlers.js) and click handlers.
8. Apply semantic UI surface visibility/lockdown through browser integration callbacks.

Recommended exports:

- `Tutorial.handleAppInit(context)`
- `Tutorial.handleSongLoaded(song, context)`
- `Tutorial.handleSectionChanged(song, context)`
- `Tutorial.getTutorialLevel(song)`
- `Tutorial.isTutorialSong(song)`
- `Tutorial.getEffectiveState(song)`
- `Tutorial.runPromptAction(actionName, args, context)`
- `Tutorial.canRunAction(actionName, context)`
- `Tutorial.canHandleKey(event, context)`
- `Tutorial.getProgress(song)`
- `Tutorial.setDone(sectionIndex, value, song)`
- `Tutorial.setBookmark(sectionIndex, value, song)`
- `Tutorial.resolvePromptHtml(section)`

Dependency strategy:

- Keep pure model/progress helpers independent of DOM.
- Inject app-level navigation and loop callbacks, or import stable app functions only in a thin browser adapter.
- Avoid direct access to `gSong`; use `getSong()` at action time.

## Prompt Area UI

### New files

Add:

- [templates/tutorial/tutorial.html](templates/tutorial/tutorial.html)
- [templates/tutorial/tutorial.css](templates/tutorial/tutorial.css)
- [templates/tutorial/tutorial.builder.js](templates/tutorial/tutorial.builder.js)

Update:

- [index.html](index.html)
- [infinite-neck.js](infinite-neck.js)

### Placement

Place the Prompt Area below the top menu/logo row and above menu pages such as Palette, Info, Fill, File, and View.

Recommended host insertion in [index.html](index.html):

```html
<div id="divTutorialPrompt"></div>
```

Place it inside `.container` after `#divTopCaptions` and before `#divPalette` unless testing shows strict chrome needs it outside `.container`. Iteration 2 explicitly wants the menu bar/logo stable above the prompt.

### Prompt Area rows

The Prompt Area consists of four rows:

1. Widget row.
2. Course/Lesson/Tutorial path row.
3. Prompt caption row.
4. Prompt HTML row.

Suggested stable DOM IDs/classes:

- `#tutorialPrompt`
- `.tutorialPromptRow`
- `.tutorialPromptWidgetRow`
- `.tutorialPromptBreadcrumbRow`
- `.tutorialPromptCaptionRow`
- `.tutorialPromptHtmlRow`
- `#tutorialPromptHtml`
- `#tutorialPromptTutorialCaption`
- `#tutorialPromptSectionCaption`
- `#tutorialPromptBreadcrumbs`
- `#tutorialPromptSongfileName`
- `#tutorialPromptCopyLink`

### Widget row controls

Controls:

- `⇤ First`
- `« Previous`
- author-preview lockdown checkbox, only when `tutorialAuthoring=true`
- `LOOP`
- `BEAT-LOOP`
- `Done` checkbox
- `Bookmark` checkbox
- `Next »`
- `Last ⇥`

Implementation notes:

1. Buttons should be real `<button type="button">` controls.
2. Done/Bookmark should be checkboxes with white unchecked background and lightgreen checked background.
3. Navigation button styles should align with existing transport buttons but include text.
4. `Next` should use a green `.BtnPunchedOut` style variant.
5. Widget row actions should use delegated events within `TutorialPromptBuilder`, not inline `onclick`.

### Breadcrumb/caption rows

The breadcrumb row displays:

- tutorial directory path from `songs/`, for example `tutorials/C000-intro/L001-one-string-intro/`
- tutorial songfile name, for example `L001-1.json`
- copy-to-clipboard glyph/action for tutorial URL

The caption row displays:

- `song.tutorial.caption`
- `section.tutorial.caption`

Separate `Section.caption` from tutorial caption. `Section.caption` may still be visible through Chart/LeadSheet when authored for lyrics.

### Prompt HTML row

Render from:

```js
section.tutorial.prompt.lines.join('\n')
```

Rendering steps:

1. Join lines with `\n`.
2. Sanitize tutorial HTML.
3. Optionally expand approved variables only if design approves.
4. Insert into `#tutorialPromptHtml`.
5. Bind allowed tutorial prompt actions through delegated click handlers.

## Tutorial mode behavior

### `none`

- Prompt Area hidden.
- No tutorial lockdown.
- Normal app behavior.

### `strict`

- Prompt Area visible.
- Strict default lockdown in effect unless `tutorialAuthoring=true` and author-preview checkbox is unchecked.
- Menu pages hidden.
- Command-line blocked.
- Note editing blocked.
- Chart surfaces allowed only if included in strict defaults.
- Transport replaced by Prompt Area widgets for section navigation and loop controls.
- Bottom strip visible.

Strict default visible surfaces should include:

- `topLogoMenuBar` or equivalent stable top logo area
- `promptArea`
- `fretTables`
- optional `chartLeadSheet` / `chartLine` when configured
- `strictBottomStrip`

Strict locked surfaces should include:

- note-table editing
- chart navigation clicks
- command line
- palette changes
- fill menu
- file menu
- tuning authoring
- section drawer edits
- macros except explicitly allowed tutorial prompt actions

### `wizard`

- Prompt Area visible.
- Default wizard lockdown applies.
- `song.tutorial.allowedUI` can turn semantic surfaces back on.
- Wizard is basically normal mode plus tutorial prompt and tutorial-controlled UI surface visibility.
- Wizard should still use action gating for hidden/locked surfaces.

Wizard default visible surfaces should include:

- top menu/logo
- promptArea
- fretTables
- chart surfaces if configured
- possibly regular menus unless hidden by default wizard profile

Exact wizard defaults need final design confirmation.

### Runtime tutorial authoring

Controlled by query param:

- `tutorialAuthoring=true` sets `gPresentation.tutorial.tutorialAuthoring = true`.
- `tutorialAuthoring=false` sets it to false.
- absent query param resets it to false.

When active:

1. Prompt Area is shown for tutorial songs.
2. Author-preview lockdown checkbox appears in widget row.
3. Checkbox unchecked means no lockdown and normal UI is visible.
4. Checkbox checked means app follows the tutorial level’s lockdown/show-hide rules.
5. This state is runtime-only and not saved into the song file.

## Semantic UI surfaces

Define one central mapping from semantic names to selectors and behavior. This mapping should live in browser presentation/chrome code, not in persisted Song JSON.

Initial semantic surface names:

- `topLogoMenuBar`
- `mainMenuButtons`
- `promptArea`
- `fileMenu`
- `infoMenu`
- `fillMenu`
- `palette`
- `tuningsMenu`
- `viewMenu`
- `themeMenu`
- `desktopMenu`
- `commandLine`
- `transportFull`
- `transportMinimal`
- `fretTables`
- `instrumentCaptionRows`
- `songCaption`
- `chartLine`
- `chartLeadSheet`
- `chartSummary`
- `leftRail`
- `diamonds`
- `dockHandles`
- `strictBottomStrip`

Implementation tasks:

1. Create a surface registry module or section in [Tutorial.js](Tutorial.js) / browser adapter.
2. Add CSS classes to `body` such as:
   - `tutorial-active`
   - `tutorial-strict`
   - `tutorial-wizard`
   - `tutorial-effective-lockdown`
   - `tutorial-authoring`
3. Use CSS for broad hiding.
4. Use JS for semantic exceptions and dynamic surfaces.
5. Guard action handlers for hidden/locked surfaces.

## Action gating

### Tutorial prompt actions

Prompt widget actions should be first-class tutorial actions:

- `tutorial.firstSection`
- `tutorial.prevSection`
- `tutorial.nextSection`
- `tutorial.lastSection`
- `tutorial.loopToggle`
- `tutorial.beatLoopToggle`
- `tutorial.doneToggle`
- `tutorial.bookmarkToggle`
- `tutorial.copyTutorialLink`
- `tutorial.authorPreviewToggle`

Optional later prompt content actions:

- `tutorial.openTutorialLink`
- `tutorial.runMacro`
- `tutorial.raisePluginSnapshot`

### Strict-mode allowed actions

Strict mode initially allows only:

- prompt widget navigation
- prompt widget loop controls
- Done/Bookmark progress actions
- copy tutorial link
- safe help/library bottom-strip links
- Chart read-only display refresh actions

### Action-gate insertion points

Add checks to:

1. `document_keydown()` in [key-handlers.js](key-handlers.js)
2. `document_keypress()` in [key-handlers.js](key-handlers.js)
3. `document_keyup()` in [key-handlers.js](key-handlers.js)
4. `runActionByName()` / `performCmdAction()` path in [key-handlers.js](key-handlers.js)
5. `[data-action]` handler in [infinite-neck.js](infinite-neck.js)
6. Info/app action fragment handlers if tutorial prompt supports superlinks
7. Macro execution if tutorials can invoke macros
8. Note-table click/edit handlers
9. Chart click handlers that navigate sections

Blocked actions should fail quietly for learners and optionally log under authoring mode.

## Keyboard behavior

Strict mode keyboard defaults:

- `ArrowRight` or `n`: next Section
- `ArrowLeft` or `p`: previous Section
- `Home`: first Section
- `End`: last Section
- `Space`: tutorial loop toggle or design-confirmed default
- `Escape`: stop transient UI/loop, not exit tutorial

Blocked in strict mode:

- `/` command line
- `i` Fill
- `p` Palette, if `p` is not chosen for prev Section
- `f` fullscreen
- `F` File
- normal palette/editing shortcuts
- note editing shortcuts

Attention needed:

- `p` conflicts with current Palette shortcut. Confirm whether strict prev Section uses `p`, `ArrowLeft` only, or another key.
- Confirm whether `Space` should toggle LOOP, BEAT-LOOP, or activate focused button only.

## Bottom strip for strict mode

Add a bottom strip visible in strict mode.

Contents:

1. Logo/link to main app with no song/tutorial query parameter.
2. Help file link.
3. Link to Song Library tutorials branch.

Suggested files:

- [templates/tutorial/tutorial.html](templates/tutorial/tutorial.html)
- [templates/tutorial/tutorial.css](templates/tutorial/tutorial.css)

Suggested classes:

- `.tutorialBottomStrip`
- `.tutorialBottomStripLogo`
- `.tutorialBottomStripLink`

Open questions:

- Exact main-app URL.
- Exact help topic URL.
- Exact Song Library tutorials branch URL/query behavior.

## Splash screen

### New files

Add:

- [templates/splash/splash.html](templates/splash/splash.html)
- [templates/splash/splash.css](templates/splash/splash.css)
- [templates/splash/splash.builder.js](templates/splash/splash.builder.js)

Or place under `templates/tutorial/` only if design wants splash to be tutorial-owned. The splash appears broader than tutorial mode, so a separate template is cleaner.

### Splash states

Startup routing:

1. If `tuning=` query param is present:
   - initialize blank song with requested tuning when available
   - enter normal UI
2. Else if `song=` query param loads a tutorial song:
   - show splash while loading
   - launch tutorial mode after song load
3. Else if `song=` query param loads a non-tutorial song:
   - show splash while loading
   - launch normal UI after song load
4. Else:
   - show splash with three buttons:
     - `Open Tutorial`
     - `Open Song from Library`
     - `Author Song / Play Instruments`

Button behavior:

- `Open Tutorial`: show Song Library with tutorials branch open.
- `Open Song from Library`: show Song Library root.
- `Author Song / Play Instruments`: open blank normal mode and show default instrument.

Implementation notes:

1. Hide startup fret/no-tunings display until splash decision completes.
2. Do not break existing URL query loading.
3. Keep splash state outside persisted Song.
4. Ensure headless tests can bypass splash.

Open questions:

- Whether splash is a full-screen overlay or replaces only the main app area.
- Exact API for opening Song Library to tutorials branch.
- Whether local-file open is available from splash.

## Chart and LeadSheet work

### LeadSheet in fullscreen-style display

Current design requires LeadSheet to be available like Line in fullscreen display.

Implementation tasks:

1. Identify current Chart Line fullscreen rendering path in [infinite-neck.js](infinite-neck.js) and Section printer code.
2. Add a corresponding LeadSheet fullscreen render path.
3. Add UI/action/menu support for showing/hiding fullscreen LeadSheet if needed.
4. Add semantic tutorial surface `chartLeadSheet`.
5. Ensure strict/wizard tutorial modes can show `chartLine` and/or `chartLeadSheet` without entering app fullscreen.

Relevant likely files:

- [infinite-neck.js](infinite-neck.js)
- [section-printer.js](section-printer.js)
- [section-printer.css](section-printer.css)
- [templates/SectionStatus/section-status.builder.js](templates/SectionStatus/section-status.builder.js)

### Chart read-only behavior in tutorial mode

Tutorial mode requirements:

1. Charts still show active Section.
2. Clicking a Section or BAR in Chart does not navigate while tutorial lockdown is active.
3. `Section.caption` remains available through Chart/LeadSheet for lyrics if authored that way.

Implementation tasks:

1. Add tutorial action gate to Chart click handlers.
2. Keep active Section highlight updates running through existing `sectionChanged()` / `updatePrintSections()` paths.
3. Do not block display-only chart rendering.

## Prompt build process

### New command-line build tool

Add a Node command-line tool under [bin/](bin/), for example:

- [bin/build-tutorial-prompts.js](bin/build-tutorial-prompts.js)

Purpose:

- Read a tutorial song JSON file.
- Read sibling `${songfile-stem}.prompts.html`.
- Extract tutorial caption and per-section prompt/caption blocks.
- Write updated tutorial data back into the JSON song file.

### Input convention

For song file:

```text
songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json
```

Prompt source:

```text
songs/tutorials/C000-intro/L001-one-string-intro/L001-1.prompts.html
```

Prompt HTML source markers:

- `data-caption-for-tutorial="true"`
- `data-caption-for-section="1"`
- `data-prompt-for-section="1"`

Section numbers are 1-based in source HTML and converted to zero-based array indexes in JSON.

### Output convention

Write:

- `song.tutorial.caption`
- `song.sections[index].tutorial.caption`
- `song.sections[index].tutorial.prompt.lines[]`

Line handling:

1. Preserve source line breaks inside each prompt block.
2. Store lines as strings in JSON.
3. JSON escaping is handled by `JSON.stringify()`.
4. Preserve meaningful whitespace; do not minify.

### Build tool validation

The build tool should report errors for:

- missing song file
- missing prompt source file
- invalid JSON
- no `data-caption-for-tutorial="true"`
- duplicate tutorial caption markers
- duplicate `data-prompt-for-section`
- prompt section number out of range
- caption section number out of range
- missing prompt block for a Section when tutorial level is not `none` (confirm whether this is error or warning)

### HTML parsing dependency

Need design/implementation decision:

1. Use a lightweight dependency such as `parse5`, `htmlparser2`, or `jsdom`.
2. Or implement a constrained marker extractor.

Recommendation for correctness: use a real HTML parser package in dev/runtime dependencies for the build tool.

### Package scripts

Add scripts to [package.json](package.json), for example:

```json
{
  "scripts": {
    "build:tutorial-prompts": "node bin/build-tutorial-prompts.js"
  }
}
```

Possible CLI usage:

```text
node bin/build-tutorial-prompts.js songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json
```

Optional batch mode:

```text
node bin/build-tutorial-prompts.js songs/tutorials/**/*.json
```

Batch mode can wait until single-file mode works.

## Prompt HTML sanitization and safe actions

### Sanitizer extension

Update [html-sanitizer.js](html-sanitizer.js) or add a tutorial-specific wrapper:

- `sanitizeTutorialHtmlFragment(rawHtml, options)`
- `isAllowedTutorialAnchorHref(href)`
- `isAllowedTutorialActionElement(element)`

Need to support ordinary tutorial prompt HTML plus controlled action links/buttons.

### Allowed prompt actions

Because Iteration 2 avoids `<tutorial-btn>` transformation, define allowed authorable action patterns.

Options needing design confirmation:

1. Use ordinary anchors matching Info superlinks:
   - `#raise=plugin.snapshot`
   - `#macro=macroId`
2. Use ordinary buttons with constrained attributes:
   - `<button data-tutorial-action="nextSection">Next</button>`
3. Use anchors for tutorial app actions:
   - `<a href="#tutorial=nextSection">Next</a>`

Draft recommendation:

- System widget row uses real buttons bound by `TutorialPromptBuilder`.
- Prompt HTML content may use safe anchors, not arbitrary `button` tags, until a final action grammar is specified.
- Strict mode should disallow `macro` and `raise` unless explicitly whitelisted by tutorial metadata.
- Wizard mode may allow `macro` and `raise` through `allowedPromptActions`, `allowedMacros`, and/or `allowedSnapshots`.

### HTML tags

Start from current Info allowed tags and consider adding only what tutorial prompts require.

Likely allowed:

- existing Info tags
- `img` only if design approves image support and path restrictions
- `button` only if design approves `data-tutorial-action`

Disallowed:

- inline event attributes
- `style`
- external scripts
- forms
- file inputs
- arbitrary `data-action`
- arbitrary download/upload links

Open attention item:

- The Iteration 2 design explicitly wants buttons/actions and Info-style macro/raise links, but also wants protection from malicious shared song files. This needs a final action grammar before coding sanitizer changes.

## Course/Lesson/Tutorial library layout

### Directory convention

Tutorial songs live under:

```text
songs/tutorials/<Course>/<Lesson>/<Tutorial>.json
songs/tutorials/<Course>/<Lesson>/<Tutorial>.prompts.html
```

Examples:

```text
songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json
songs/tutorials/C000-intro/L001-one-string-intro/L001-1.prompts.html
```

### Song Library behavior

Requirements:

1. `.json` tutorial songs appear in Song Library listings.
2. `.prompts.html` files are omitted from `song-list.json` and are not listed as songs.
3. Directory `song-list.json` may provide per-tutorial descriptions.
4. Tutorial branch can be opened directly from splash and strict bottom strip.
5. Tutorial caption can be read from `song.tutorial.caption` for listings where available.

Relevant likely files:

- [SongLibrary.js](SongLibrary.js)
- [song-library.css](song-library.css)
- any song-list generation scripts under [bin/](bin/)

Implementation tasks:

1. Ensure existing Song Library ignores `.prompts.html`.
2. Add tutorial-branch open behavior if not already present.
3. Add display support for `song.tutorial.caption` if a listing loads metadata from song JSON.
4. Add copy-link behavior consistent with normal Song Library song links.

Open questions:

- Which script generates `song-list.json` today, and should it read `song.tutorial.caption`?
- Should Course/Lesson directory captions come only from `song-list.json`?
- Should local progress badges appear in Iteration 2 or later?

## Navigation, looping, Done, and Bookmark

### Navigation

Prompt widget nav should call existing app/Song navigation paths.

Actions:

- First Section
- Previous Section
- Next Section
- Last Section

Implementation requirements:

1. Do not use random section navigation in strict tutorial actions.
2. Refresh Prompt Area after navigation through the normal `sectionChanged()` path.
3. `Next` should not automatically mark Done unless design confirms.
4. `Done` checkbox explicitly manages completion state.

Attention item:

- Iteration 1 suggested Next could mark completed. Iteration 2 adds a separate Done checkbox. Confirm whether Next still marks Done or Done is independent.

### LOOP and BEAT-LOOP

Prompt widget controls:

- `LOOP`
- `BEAT-LOOP`

Implementation requirements:

1. Reuse existing looper functions where possible.
2. Keep behavior deterministic in strict mode.
3. Disable random loop mode in strict tutorials.
4. Reflect active loop state in button appearance.

Relevant files:

- [looper.js](looper.js)
- [looper-transport-timing.js](looper-transport-timing.js)
- [transport-controller.js](transport-controller.js)
- [infinite-neck.js](infinite-neck.js)

### Done and Bookmark

Store in local tutorial progress.

Rules:

- Done checkbox toggles current Section completion.
- Bookmark checkbox sets or clears current Section as bookmark.
- Only one bookmark per tutorial unless design says multiple bookmarks.
- Checked state updates when Section changes.

Open question:

- Should Done/Bookmark be hidden, disabled, or shown read-only in wizard mode?

## Themes and Tunings in tutorial mode

Iteration 2 notes that later tutorials may allow user-selected built-in Themes and Tunings.

Draft plan:

1. Strict early lessons: no theme/tuning UI.
2. Wizard or later strict lessons: optional semantic surface for built-in Theme dropdown in Prompt Area widget row.
3. Do not allow user-customizable theme/tuning editing through tutorial Prompt Area.
4. Instrument swaps should use predefined macros or separate song flavors until a safe tuning-selector action model is specified.

Potential Prompt Area widget additions:

- `themeSelectorBuiltIn`
- `tuningSelectorBuiltIn`

Attention needed:

- This is not fully specified enough for Iteration 2 coding unless narrowed.

## Query parameters

### Existing params

Existing params include at least `song=`, `macro=`, and `tuning=` paths.

### New param

Add:

```text
tutorialAuthoring=true|false
```

Rules:

1. `true` sets runtime authoring mode true.
2. `false` sets runtime authoring mode false.
3. absent resets runtime authoring mode false.
4. value is not persisted.
5. authoring mode only affects tutorial songs.

Possible future params needing explicit decision:

- `tutorial=` shortcut to tutorial branch or tutorial song
- `tutorialBranch=` to open Song Library tutorials branch

Do not add future params until required.

## Schema updates

Update [bin/song-file-schema.js](bin/song-file-schema.js):

1. Add `tutorialSchema` for Song-level tutorial data.
2. Add `sectionTutorialSchema` for Section-level tutorial data.
3. Add prompt lines schema.
4. Add allowed level enum: `none`, `strict`, `wizard`.
5. Add `allowedUI` as array of semantic strings.
6. Add caption fields as strings.

Schema should explicitly allow tutorial data while rejecting malformed prompt shapes.

Suggested shape:

```js
const tutorialLevelSchema = { type: 'string', enum: ['none', 'strict', 'wizard'] };

const sectionTutorialSchema = {
  type: 'object',
  properties: {
    caption: { type: 'string' },
    prompt: {
      type: 'object',
      properties: {
        lines: { type: 'array', items: { type: 'string' } }
      },
      required: ['lines'],
      additionalProperties: false
    }
  },
  additionalProperties: false
};

const songTutorialSchema = {
  type: 'object',
  properties: {
    level: tutorialLevelSchema,
    caption: { type: 'string' },
    allowedUI: { type: 'array', items: { type: 'string' } },
    storageKey: { type: 'string' }
  },
  required: ['level'],
  additionalProperties: false
};
```

Attention item:

- If prompt actions/macros/snapshots become persisted allowlists, add them to schema before implementation.

## Persistence updates

Update [SongPersistence.js](SongPersistence.js):

1. Add tutorial defaults.
2. Normalize `song.tutorial.level`.
3. Normalize `song.tutorial.caption`.
4. Normalize `song.tutorial.allowedUI` to a clean array.
5. Preserve unknown tutorial fields only if schema permits them.

Update [SectionPersistence.js](SectionPersistence.js):

1. Add tutorial default or normalization helper.
2. Normalize `section.tutorial.caption`.
3. Normalize `section.tutorial.prompt.lines` to an array of strings.

Update persistence tests to verify load/save roundtrip.

## App integration work plan

### Phase 1: Model, schema, and pure helpers

1. Add tutorial schemas to [bin/song-file-schema.js](bin/song-file-schema.js).
2. Add tutorial normalization in [SongPersistence.js](SongPersistence.js) and [SectionPersistence.js](SectionPersistence.js).
3. Add [Tutorial.js](Tutorial.js) with pure metadata/progress/effective-state helpers.
4. Add Jest coverage for:
   - level normalization
   - missing tutorial means inactive
   - strict/wizard effective state
   - local progress shape helpers
   - schema accepts valid tutorial shape
   - schema rejects invalid level/prompt lines shape

### Phase 2: Prompt build tool

1. Add [bin/build-tutorial-prompts.js](bin/build-tutorial-prompts.js).
2. Add HTML parser dependency if approved.
3. Implement single-song build mode.
4. Add package script.
5. Add fixture prompt/source test files under [_tests/jest/fixtures/](_tests/jest/fixtures/) or a similar test fixture directory.
6. Add Jest tests for:
   - tutorial caption extraction
   - section caption extraction
   - prompt lines extraction
   - duplicate marker errors
   - out-of-range section errors
   - JSON write shape

### Phase 3: Prompt Area template and builder

1. Add tutorial template/CSS/builder files.
2. Add [index.html](index.html) host and stylesheet link.
3. Load tutorial template in [infinite-neck.js](infinite-neck.js) during `appInit()`.
4. Render Prompt Area on tutorial song load.
5. Refresh Prompt Area on section change.
6. Bind widget row actions.
7. Bind author-preview checkbox.
8. Add local progress read/write for Done/Bookmark.

### Phase 4: Tutorial mode activation and chrome

1. Parse `tutorialAuthoring=true|false` during startup/song load query handling.
2. Add `Tutorial.handleSongLoaded()` call in `updateAfterOpenSong()` or a nearby stable lifecycle point.
3. Add `Tutorial.handleSectionChanged()` call in `sectionChanged()`.
4. Add body classes for tutorial active/level/lockdown/authoring.
5. Implement semantic surface mapping.
6. Implement strict default lockdown.
7. Implement wizard default surface policy and `allowedUI` overrides.
8. Add strict bottom strip.

### Phase 5: Action and keyboard lockdown

1. Add tutorial key gate to `document_keydown()`, `document_keypress()`, and `document_keyup()`.
2. Add tutorial action gate to command-line action execution.
3. Add tutorial action gate to `[data-action]` handler.
4. Add note-table edit guard for strict effective lockdown.
5. Add Chart click-navigation guard for tutorial mode.
6. Add macro/superlink guard if prompt content actions are enabled.
7. Add tests for pure action-gating helpers.
8. Use manual/browser acceptance for actual UI lockdown.

### Phase 6: Splash screen

1. Add splash template/CSS/builder.
2. Add startup state that hides blank no-tunings display.
3. Route `tuning=`, tutorial song, regular song, and no-query startup cases.
4. Add splash buttons for:
   - Open Tutorial
   - Open Song from Library
   - Author Song / Play Instruments
5. Integrate Song Library branch-open behavior.
6. Add minimal tests for pure routing decision helper.
7. Validate manually in browser for visual startup timing.

### Phase 7: Chart LeadSheet and read-only tutorial chart

1. Add LeadSheet fullscreen-style render path.
2. Add semantic tutorial surface `chartLeadSheet`.
3. Allow tutorial mode to show Chart Line/LeadSheet without app fullscreen.
4. Block Chart click navigation while tutorial lockdown is active.
5. Confirm `Section.caption` lyrics display through LeadSheet.
6. Add focused tests where helpers are pure; use UI acceptance for rendering.

### Phase 8: Song Library tutorial branch support

1. Ensure `.prompts.html` files are excluded from listings.
2. Add or confirm tutorial branch-open behavior.
3. Display `song.tutorial.caption` in tutorial listings if available.
4. Add copy-link behavior for tutorial song entries and Prompt Area glyph.
5. Defer progress badges unless design marks them required for Iteration 2.

## Testing strategy

### Jest targets

Add or update tests for:

1. Tutorial model normalization.
2. Tutorial schema validation.
3. Prompt build tool extraction.
4. Sanitizer behavior for tutorial prompt HTML.
5. Tutorial local progress helper.
6. Tutorial effective state helper.
7. Tutorial action-gating helper.
8. Query param parsing helper.
9. Splash routing decision helper.

Use the repo’s ESM Jest command pattern:

```text
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand
```

### Browser/manual acceptance

Manual acceptance remains necessary for:

1. Splash visual startup timing.
2. Prompt Area placement and layout.
3. Strict lockdown across actual UI.
4. Wizard surface show/hide behavior.
5. Chart LeadSheet display.
6. Chart click blocking.
7. Transport/loop interactions.
8. Author-preview toggle behavior.
9. Copy-to-clipboard glyph.

## Documentation updates

Update or add:

1. [sprint-138.md](sprint-138.md) if plan links change.
2. [_doco/developer/globals-programmers-reference.md](_doco/developer/globals-programmers-reference.md) to document `gPresentation.tutorial`.
3. Tutorial prompt authoring documentation under [_doco/developer/](_doco/developer/) or the sprint folder.
4. Build tool usage documentation.
5. Prompt HTML allowed-tags/actions reference.
6. Course/Lesson/Tutorial directory convention documentation.

## Areas needing attention before implementation is complete

### Prompt actions and sanitizer grammar

Iteration 2 says prompt HTML should be sanitized, should support actions, and may support Info-style `raise` and `macro` superlinks. This needs a precise grammar before coding.

Required decisions:

1. Are authorable action controls anchors only, buttons only, or both?
2. Are `#macro=` and `#raise=` allowed in strict mode?
3. If allowed, where are allowed macro IDs/snapshots listed?
4. Can prompt HTML include `img`?
5. Are approved variables expanded in prompt HTML?
6. Is sanitization before or after approved variable expansion?

### Strict keyboard mapping

Required decisions:

1. Should `p` mean previous Section in strict mode, despite normal Palette shortcut?
2. Should `Space` toggle LOOP, BEAT-LOOP, or activate focused control?
3. Should Escape stop looping, hide transient UI, do nothing, or leave tutorial?

### Done and Next semantics

Required decisions:

1. Does `Next` mark current Section Done?
2. Is Done independent of visited/current Section?
3. Can multiple bookmarks exist, or only one?
4. Should Bookmark auto-save current Section when leaving tutorial?

### Wizard defaults

Required decisions:

1. What is the default wizard visible surface set?
2. Is command-line visible in wizard by default?
3. Are macros allowed in wizard by default?
4. Does wizard allow note editing by default?

### Splash screen details

Required decisions:

1. Exact visual placement: full-screen overlay or app-body replacement.
2. Exact Song Library API for opening tutorials branch.
3. Whether local file open appears on splash.
4. Whether splash appears briefly during URL song loads or only while loading is pending.

### Build tool dependency

Required decision:

- Which HTML parser dependency to use for [bin/build-tutorial-prompts.js](bin/build-tutorial-prompts.js).

Recommendation:

- Use a real parser rather than regex extraction.

### Chart LeadSheet implementation

Required decisions:

1. Exact distinction between Chart Line and Chart LeadSheet in fullscreen-style display.
2. Whether strict mode shows LeadSheet by default or only through tutorial metadata.
3. Whether existing Chart tab LeadSheet rendering already has reusable code or needs a new printer function.

### Song Library metadata

Required decisions:

1. Whether tutorial listing captions come from `song.tutorial.caption`, `song-list.json`, or both.
2. Whether progress badges are Iteration 2 or later.
3. Exact branch-open URL/query for tutorials.

## Draft acceptance checklist

A first implementation should be considered ready for deeper review when:

1. Non-tutorial songs behave normally.
2. Tutorial songs show the Prompt Area.
3. Strict tutorial songs apply strict default lockdown.
4. `tutorialAuthoring=true` shows Prompt Area without lockdown until author-preview is checked.
5. `tutorialAuthoring=false` or absent disables authoring mode.
6. Wizard tutorial songs show Prompt Area and apply wizard surface policy.
7. Prompt widget navigation changes Sections and refreshes prompt/captions.
8. Done and Bookmark persist in local browser storage.
9. Prompt HTML is sanitized.
10. Prompt build tool embeds tutorial caption, Section captions, and prompt lines into JSON.
11. Splash screen prevents the empty no-tunings startup display.
12. URL `tuning=` still opens blank normal mode with requested tuning.
13. URL regular song opens normal UI.
14. URL tutorial song launches tutorial UI.
15. Chart Line and LeadSheet can be shown in tutorial mode as configured.
16. Chart clicks do not navigate while tutorial lockdown is active.
17. `.prompts.html` files are not listed as songs.
18. Tests cover pure/model/build/sanitizer helpers.

## Suggested implementation order

Recommended order to reduce risk:

1. Model/schema normalization.
2. Build tool and fixtures.
3. Prompt Area rendering without lockdown.
4. Tutorial song-load and section-change lifecycle hooks.
5. Local progress for Done/Bookmark.
6. Authoring query param and author-preview checkbox.
7. Strict/wizard chrome surface mapping.
8. Keyboard/action lockdown.
9. Splash screen.
10. Chart LeadSheet/read-only chart changes.
11. Song Library tutorial branch polish.

Reasoning:

- Prompt build and rendering can be validated before lockdown makes debugging harder.
- Authoring mode should exist before strict lockdown is applied.
- Splash and Chart work touch broader UI and should come after the tutorial core is stable.
