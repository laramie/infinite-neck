# sprint-138-tutorial-mode — Copilot Design Review

Date: 2026-07-11

Related design: [138-it1-design.md](_doco/design/sprints/138-tutorial-mode/138-it1-design.md)

## Review scope

This is a design review, not an implementation plan. The goal is to identify decisions and coding specifications that should be made explicit before implementation begins.

The current design direction is good: tutorial mode should ride above the existing Song/Section model, keep non-tutorial behavior nearly unchanged, and use a new tutorial presentation layer instead of reworking the main UI. The main risk is that “tutorial mode” can easily become scattered across [infinite-neck.js](infinite-neck.js), [key-handlers.js](key-handlers.js), [presentation.js](presentation.js), Info rendering, menus, transport, and song loading unless the sprint first defines a small number of authoritative seams.

## Executive summary

Recommended design direction:

1. Keep tutorial state in three separate layers:
   - persisted lesson intent in `song.tutorial` and `section.tutorial`
   - page-session presentation state in `gPresentation.tutorial`
   - derived/runtime controller behavior in a new `Tutorial` module
2. Treat tutorial prompt rendering like Info rendering, but do not reuse the Info surface directly.
3. Define a small safe tutorial action vocabulary before adding `<tutorial-btn>`.
4. Add tutorial-specific event hooks at section navigation and song load boundaries rather than sprinkling tutorial checks through existing UI code.
5. Add one centralized tutorial key/action gate in [key-handlers.js](key-handlers.js), and a second action-level guard for click/macro/command invocations that bypass keyboard handling.
6. Do not rely on today’s fullscreen toggle as the tutorial chrome model. Tutorial mode needs its own presentation/chrome state because current fullscreen hides `.container`, which also contains the proposed top prompt host if inserted naïvely.

## User flow critique

### Beginner three-chord flow

The first use-case is clear and compelling, but it needs a few UX decisions made explicit:

- What does “click Next when achieved” mean visually?
  - Is Next always visible in the prompt area?
  - Is there also a keyboard shortcut?
  - Does it visually mark the current section complete before navigation, after navigation, or both?
- `seen=true` is not necessarily the same as “completed”. The design should separate:
  - visited/currently seen
  - user clicked “I got it”
  - user completed/practiced in loop mode
- The last Section introducing LOOP is good, but “start looping” needs a tutorial-safe transport definition:
  - loop current section only?
  - loop all sections?
  - preserve current beat?
  - restart from section 1?

Suggested vocabulary:

- `visited`: automatically true when the Section becomes current
- `completed`: true when the user clicks a tutorial “Next” or “Done” action
- `bookmark`: user-selected local progress marker, not necessarily completion

### Beginner Blues song flow

The flow depends on Chart visibility and highlighted chart chord. The design should specify whether strict tutorial mode can show Chart in read-only form.

Current design says strict allows very little UI besides section navigation, prompts, and looping. The Blues use-case needs an exception:

- Either Chart is part of the allowed tutorial surface, controlled by tutorial author
- Or prompt text must duplicate the chart information

Recommended: allow `song.tutorial.allowedUI` to include semantic surfaces like `chartSummary`, `chartLine`, or `chartCurrentSection`, not raw DOM IDs.

### Beginner chord-theory flow

This use-case depends on changing display options across tutorials. The design should make explicit whether those display options are authored in the Song/Section state or driven by tutorial actions.

Recommended:

- Prefer authored Song/Section display options for static lesson setup.
- Reserve tutorial buttons/macros for user-visible transitions, not hidden setup required for every section.
- If prompts can change View options, strict mode must distinguish “tutorial-authored safe display changes” from “user arbitrary display changes”.

### Author flow

Author mode is necessary, but should not be treated as a tutorial level equivalent to strict/advanced/wizard. It is more like an override.

Recommended distinction:

- `song.tutorial.level`: `none | strict | advanced | wizard`
- runtime author override: `gPresentation.tutorial.authorOverride: boolean`
- query param may activate author override, but should not rewrite persisted tutorial level

This avoids accidentally saving a tutorial song as `author` mode and exposing editing controls to normal users.

## Data model suggestions

### Persisted song-level tutorial model

The draft proposes:

```text
Song.tutorial {
    level: <strict|advanced|wizard|author,none>,
    allowedUI: [...]
}
```

Recommended refinement:

```text
song.tutorial = {
    enabled: true,
    level: "strict",
    promptBasePath: "songs/tutorials/tutorial1/",
    promptPolicy: "section-html-fragment",
    allowedUI: ["fretTables", "tutorialPrompt", "transportMinimal", "chartLine"],
    allowedActions: ["tutorial.next", "tutorial.prev", "tutorial.loop.toggle"],
    paletteMode: "keep",
    showSongCaption: false,
    showInstrumentCaptionRows: false,
    storageKey: "tutorial1"
}
```

Design points:

- Keep names semantic. Avoid persisted raw IDs like `divMenu` or `tdLeftRailStack` unless wrapped through a semantic mapping.
- `allowedUI` should describe surfaces, not selectors.
- `allowedActions` should whitelist tutorial-level actions, not arbitrary command-line actions.
- `promptBasePath` avoids each Section needing a full relative path.
- `storageKey` gives local progress storage a stable identity even if song name changes.

### Persisted section-level tutorial model

Recommended:

```text
section.tutorial = {
    prompt: "1.shtml",
    title: "Section 1: C chord",
    actions: ["next", "loop"],
    autoMarkVisited: true,
    completionMode: "next-click"
}
```

Do not persist user progress such as `seen` directly into the song file if the user is a learner. The design already says browser storage should hold completed sections. Keep author-authored metadata in `section.tutorial`; keep learner progress in local storage.

If author testing needs to mark sections seen, keep that in runtime/local storage too unless there is an explicit authoring command to bake defaults into the file.

### Schema and persistence requirements

Current persistence matters:

- [SongPersistence.js](SongPersistence.js) uses `Object.assign()` with incoming song data, then normalizes known fields.
- [SectionPersistence.js](SectionPersistence.js) uses `Object.assign()` with incoming section data.
- [bin/song-file-schema.js](bin/song-file-schema.js) currently allows extra top-level song and section properties, but several nested schemas are strict.

Even though `tutorial` would likely survive today because top-level and section-level `additionalProperties` are true, this sprint should add explicit schema coverage for:

- `song.tutorial`
- `section.tutorial`
- allowed `level` enum
- prompt path restrictions
- allowed UI semantic names
- allowed action names

Reason: tutorial mode should be validated intentionally, especially because it loads external prompt fragments and can trigger actions.

## `gPresentation` and `presentation.js` design suggestions

[presentation.js](presentation.js) currently exports `gPresentation` and `PalettePresentation`. The current `gPresentation` object is page-session UI state and is already documented in [globals-programmers-reference.md](_doco/developer/globals-programmers-reference.md).

Recommended addition:

```text
gPresentation.tutorial = {
    mode: "none",
    authorOverride: false,
    active: false,
    locked: false,
    allowedUI: new Set(),
    allowedActions: new Set(),
    promptVisible: false,
    currentPromptPath: "",
    currentPromptHtml: "",
    lastError: ""
}
```

Do not put fetch logic, DOM mutations, or command execution into `gPresentation`. Keep it as state only.

Recommended API shape in [presentation.js](presentation.js):

- `TutorialPresentation.getMode()`
- `TutorialPresentation.setMode(mode, options)`
- `TutorialPresentation.isActive()`
- `TutorialPresentation.isStrict()`
- `TutorialPresentation.isAuthorOverride()`
- `TutorialPresentation.getAllowedUI()`
- `TutorialPresentation.getAllowedActions()`
- `TutorialPresentation.canShow(surfaceName)`
- `TutorialPresentation.canRunAction(actionName)`
- `TutorialPresentation.reset()`

The existing `PalettePresentation` pattern is a good reference, but tutorial presentation should be separate from palette state. Tutorial may call palette behavior, for example to enter keep mode, but palette should not know tutorial semantics.

## `Tutorial.js` module responsibilities

A new `Tutorial.js` should be a controller/service, not just a data holder.

Recommended responsibilities:

- Load and normalize tutorial config from the active `Song` at song-load time.
- Resolve current Section prompt path.
- Fetch prompt HTML fragments.
- Sanitize prompt HTML.
- Render prompt into a tutorial prompt host.
- Bind tutorial controls inside the prompt host.
- Mark local progress in browser storage.
- React to Section changes.
- Apply tutorial chrome through presentation/UI helpers.
- Provide `canRunAction()` and `canHandleKey()` helpers used by key/action gates.

Do not make `Tutorial.js` own Song navigation logic directly if existing Song methods are available. It should call stable app actions or `Song`/transport methods through providers.

Recommended public surface:

- `Tutorial.initialize({ song })`
- `Tutorial.handleSongLoaded(song)`
- `Tutorial.handleSectionChanged(song, section)`
- `Tutorial.enter(level, options)`
- `Tutorial.exit(options)`
- `Tutorial.renderCurrentPrompt()`
- `Tutorial.runAction(actionName, args)`
- `Tutorial.canRunAction(actionName)`
- `Tutorial.canHandleKey(keyEvent)`
- `Tutorial.getProgress(song)`
- `Tutorial.saveProgress(song, patch)`

## `infinite-neck.js` integration suggestions

[infinite-neck.js](infinite-neck.js) owns browser startup, song loading, fullscreen/chrome behavior, Info/Macro builders, and EventBus UI handlers. Tutorial integration should stay at those seams.

Recommended additions to specify before implementation:

### Song load lifecycle

Hook tutorial after plugin/runtime song state is loaded and after basic UI exists.

Relevant current lifecycle:

- `appInit()` creates a new Song, installs templates, binds events, then optionally loads URL song.
- `openSong()` replaces `gSong`, calls `ensureDefaultSection()`, loads plugin state, then calls `updateAfterOpenSong()`.
- `updateAfterOpenSong()` updates theme, tunings, UI, Info, macro URL runs, and section state.
- `sectionChanged()` syncs section UI, replays section, refreshes plugin menus.

Design requirement:

- Add a single tutorial song-load hook, probably near `updateAfterOpenSong()` after the current Song is stable.
- Add a single tutorial section-change hook, probably inside `sectionChanged()` after `syncSectionUi()` and before or after replay depending on prompt timing.
- Ensure headless tests can call tutorial model helpers without DOM.

### Chrome/fullscreen lifecycle

Current fullscreen functions hide `.container` and `.dockable-handle`, and restore caption rows according to `song.captionsRowShowing`. This is not enough for tutorial mode because the prompt area likely lives inside or near `.container`.

Design requirement:

- Tutorial mode should not be implemented by calling `enterFullscreen()` and then trying to unhide pieces.
- Add a semantic chrome applier, e.g. `applyPresentationChrome()` or `applyTutorialChrome()`, that maps semantic surfaces to selectors.
- Fullscreen and tutorial mode may share CSS classes, but they should not share the same state flag.

Recommended semantic UI surfaces:

- `topControls`
- `mainMenuTabs`
- `fileMenu`
- `infoMenu`
- `fillMenu`
- `palette`
- `viewControls`
- `tutorialPrompt`
- `fretTables`
- `instrumentCaptionRows`
- `songCaption`
- `transportMinimal`
- `transportFull`
- `chartLine`
- `chartSummary`
- `leftRail`
- `diamonds`
- `dockHandles`
- `commandLine`

### EventBus hooks

Current EventBus hooks already include `SectionChanged`, `SongUiReplay`, `SongUiFullRepaint`, and related UI events. Tutorial should use EventBus for browser UI reactions, but `Tutorial` should still expose direct methods for tests.

Suggested tutorial events:

- `Tutorial:ModeChanged`
- `Tutorial:PromptChanged`
- `Tutorial:ProgressChanged`
- `Tutorial:ActionBlocked`
- `Tutorial:ActionRun`

These are optional for first implementation, but naming them now will prevent ad hoc DOM-only coupling.

## Prompt area design

The prompt area should be a new template, not a modification of Info.

Suggested files:

- `templates/tutorial/tutorial.html`
- `templates/tutorial/tutorial.css`
- `templates/tutorial/tutorial.builder.js`

The builder can borrow patterns from [templates/info/info.builder.js](templates/info/info.builder.js): template cloning, event namespace, render-from-song method, and sanitized HTML rendering.

Differences from Info:

- Strict mode prompt is not editable.
- Prompt follows Section, not whole Song.
- Prompt should have tutorial action controls.
- Prompt should probably remain visible while normal menu chrome is hidden.
- Prompt needs loading/error states for external fragment fetches.

Recommended prompt host placement:

- Add a stable host near the top of [index.html](index.html), outside the menu surface that fullscreen hides, or ensure tutorial chrome explicitly unhides it.
- Do not render tutorial prompts into `#divInfo`; Info remains Song-level help/notes.

## Prompt HTML and `<tutorial-btn>` safety

[html-sanitizer.js](html-sanitizer.js) currently allows a limited set of tags and safe Info anchors. It does not currently allow `<tutorial-btn>`.

Design requirement before coding:

- Decide whether `<tutorial-btn>` remains a custom element tag or becomes a normal `<button data-tutorial-action="next">` after sanitization.

Recommended approach:

1. Allow authors to write `<tutorial-btn action="next">Next</tutorial-btn>` in source fragments.
2. During tutorial prompt normalization, convert it to a real `<button type="button" class="tutorialBtn" data-tutorial-action="next">Next</button>`.
3. Only allow actions from a fixed tutorial action enum.
4. Do not allow arbitrary `data-action`, inline `onclick`, arbitrary `href`, styles, or command-line paths in strict mode.

Safe action vocabulary should be explicit. Suggested first-pass strict actions:

- `nextSection`
- `prevSection`
- `firstSection`
- `lastSection`
- `toggleLoopCurrentSection`
- `stopLooping`
- `markComplete`
- `saveBookmark`
- `resumeBookmark`
- `openTutorialLink`

Advanced-only actions can include:

- `runMacro`
- `raisePluginSnapshot`
- `togglePrompt`
- `showCommandLine`
- selected view toggles

Important: Info superlinks already support `#raise=` and `#macro=`. Tutorial strict mode should not automatically inherit all Info superlink power. If advanced mode allows macros, tutorial should run them through a tutorial allowlist.

## Keystroke lockdown design

The current [key-handlers.js](key-handlers.js) has one main `document_keypress()` switch for ordinary shortcuts, plus `document_keydown()` for mapped spacebar and `document_keyup()` for ESC. It also exposes `runActionByName()` and command-menu action execution.

The design correctly proposes a single early bypass in `document_keypress()`. That is necessary but not sufficient.

Required gates:

1. `document_keypress()` gate for ordinary key shortcuts.
2. `document_keydown()` gate for mapped spacebar.
3. `document_keyup()` decision for ESC in strict mode.
4. command-line visibility/action gate.
5. click action gate for `data-action` and tutorial prompt actions.
6. macro gate if advanced mode permits macros.
7. plugin/action gate if tutorial prompt can raise plugin snapshots.

Reason: users can trigger behavior through clicks, Info links, command-line, macros, transport controls, and key handlers. A keyboard-only gate creates a false sense of lockdown.

Recommended strict key set:

- ArrowRight or `n`: next section
- ArrowLeft or `p`: previous section
- Home: first section
- End: last section
- Space: tutorial-defined safe action, likely loop toggle or next
- Escape: stop loop or exit transient overlay, not exit tutorial

Avoid reusing today’s full normal-mode shortcuts in strict mode. For example, current `i` opens Fill, `p` opens Palette, `/` opens command-line, and `f` toggles fullscreen. Strict mode should block those unless explicitly allowed.

## UI lockdown design

The design’s div lockdown list is heading in the right direction, but raw DOM names should be converted to semantic surfaces.

Recommended mapping layer:

```text
PresentationSurfaces = {
    fretTables: [selectors resolved dynamically],
    tutorialPrompt: ["#tutorialPrompt"],
    songCaption: ["#topControlsCaptions"],
    instrumentCaptionRows: [".captionRow"],
    leftRail: ["#tdLeftRailStack"],
    diamonds: [".diamondsRow"],
    menuChrome: ["#divControls", ".MainMenuTabBtn"],
    dockHandles: [".dockable-handle"],
    commandLine: ["#CmdMenu"]
}
```

The mapping should live in browser presentation code, not in persisted Song JSON. Persist semantic names only.

Strict mode should additionally protect against state-changing controls that remain visible:

- note-table click handlers
- palette changes
- section drawer edits
- transport controls beyond allowed tutorial transport
- tunings/forms
- command-line menu
- file menu

Recommended CSS pattern:

- put `tutorial-mode tutorial-mode-strict` classes on a top-level element such as `body`
- use CSS to hide broad UI surfaces
- use JS only for state decisions and dynamic surfaces
- use `pointer-events: none` or disabled attributes for visible read-only controls where hiding would harm the lesson

## Navigation, looping, and progress

Tutorial buttons should probably use existing `Song` navigation methods rather than inventing new navigation state.

Design decisions needed:

- Does `Next` call normal `gotoNextSection()` or state-only navigation followed by controlled replay?
- Does it wrap from last to first?
- Does it stop loop before changing section?
- Does it mark the current section complete before moving or mark the destination as visited after moving?
- How should random loop mode be disabled in strict tutorials?

Recommended strict behavior:

- Next marks current section complete, stops beat looping if needed, navigates to next section without randomization, replays, renders prompt.
- Prev navigates without changing completion.
- First/Last navigate without changing completion.
- Loop toggles deterministic section loop only.

Progress should be kept in local storage, not saved into the song file by normal learner usage.

Suggested storage key:

```text
infinite-neck:tutorial-progress:<song.tutorial.storageKey or songName>
```

Suggested stored shape:

```text
{
    version: 1,
    songName: "tutorial1",
    completedSections: [0, 1, 2],
    visitedSections: [0, 1, 2],
    bookmarkSectionIndex: 2,
    updatedAt: "2026-07-11T00:00:00.000Z"
}
```

## External prompt fragment loading

The draft proposes `.shtml` fragment files next to the tutorial song. This is workable, but needs a path policy.

Design requirements:

- Prompt paths must be relative to a configured tutorial base path.
- Reject `..`, absolute URLs, query strings, fragments, and paths outside tutorial roots.
- Fetch failures should render a safe inline error in author mode and a learner-friendly fallback in strict mode.
- Prompt HTML must be sanitized after fetch.
- Prompt fragments should be cacheable per section path during a session.

Consider using `.html` instead of `.shtml` unless the server intentionally processes SSI. If `.shtml` is required, document whether fragments are static or server-processed.

## Interaction with Info, macros, and approved templates

Info rendering uses `getSanitizedInfo()` and then `expandApprovedTemplate()`. Tutorial prompts may also need approved variables, but this is a design choice.

Recommendation:

- Allow approved variables in tutorial prompts only if they are read-only and safe.
- Do not expand variables that expose HTML or command/action links unless they are sanitized afterward.
- For strict mode, avoid Info superlinks and use tutorial action buttons instead.
- For advanced mode, allow macros only through `song.tutorial.allowedMacros` or per-section allowed actions.

## Testing and acceptance specifications to add before implementation

Before coding, add a short specification for each of these acceptance areas:

### Model and persistence

- Loading a non-tutorial song leaves tutorial inactive.
- Loading a tutorial song normalizes missing defaults.
- `song.tutorial` and `section.tutorial` survive load/save roundtrip.
- Schema accepts valid tutorial data and rejects invalid levels/actions/prompt paths.

### Presentation state

- `gPresentation.tutorial` resets on app/test setup.
- Switching songs resets prompt and tutorial runtime state.
- Author override changes runtime state but does not persist into song JSON.

### Prompt rendering

- Section change renders the correct prompt.
- Missing prompt produces safe fallback.
- Unsafe HTML is removed.
- `<tutorial-btn>` only produces whitelisted actions.
- Prompt buttons work in strict mode without exposing regular menus.

### Lockdown

- Strict mode blocks normal shortcut keys such as `/`, `i`, `p`, `f`, `F`, and palette/menu shortcuts.
- Strict mode permits only the documented tutorial keys.
- Strict mode blocks command-line opening from keyboard and click paths.
- Strict mode prevents note editing from visible fret tables.
- Advanced mode allows only its documented additional actions.
- Author override permits normal UI while keeping tutorial prompt visible.

### Navigation/progress

- Next marks the intended Section complete.
- Prev does not accidentally mark complete.
- Bookmark saves locally and resumes correctly.
- Local progress is keyed per tutorial identity.
- Loop action is deterministic and does not enter random loop mode.

## Specific coding specification gaps to resolve

1. Exact `song.tutorial` schema.
2. Exact `section.tutorial` schema.
3. Whether `author` is a persisted level or runtime override.
4. Semantic `allowedUI` names and their selector mapping.
5. Strict/advanced/wizard action vocabulary.
6. Strict/advanced/wizard key vocabulary.
7. Whether prompt fragments use `.shtml` or `.html`.
8. Prompt path security rules.
9. Sanitizer policy for `<tutorial-btn>`.
10. Whether tutorial prompts expand approved variables.
11. Whether strict mode can show Chart, and which Chart form.
12. Whether visible fret tables are read-only via handler guard, CSS, or both.
13. How tutorial mode interacts with existing fullscreen.
14. What transport actions are allowed in strict mode.
15. Local storage key format and progress shape.
16. Song Library metadata requirements for progress badges.
17. Headless test strategy for `Tutorial` without DOM.
18. Browser/UI acceptance test strategy for actual lockdown.

## Suggested design refinements for the current document

Add these sections to the design before implementation planning:

1. **Tutorial levels matrix**
   - Rows: strict, advanced, wizard, author override
   - Columns: keys, menus, command line, macros, note editing, transport, chart, prompt, palette, section drawer

2. **Tutorial action vocabulary**
   - Document every action a `<tutorial-btn>` can invoke.
   - Mark each action allowed in strict/advanced/wizard.

3. **Presentation surfaces vocabulary**
   - Define semantic names and intended DOM targets.
   - Keep this separate from persisted tutorial JSON.

4. **Prompt security model**
   - Allowed tags, attributes, paths, and actions.
   - Whether approved variables are allowed.

5. **Lifecycle hooks**
   - On app init
   - On open song
   - On section changed
   - On tutorial mode changed
   - On song close/replace

6. **Progress model**
   - Author metadata vs learner local progress.
   - Completion vs visited vs bookmark.

## Bottom line

The design is viable and fits the repo direction if tutorial mode is treated as a small presentation/controller layer over the existing Song/Section model. The largest architectural risk is not prompt rendering; it is lockdown consistency. Keyboard filtering alone is insufficient because the app has multiple action paths. The design should define one tutorial state source, one semantic UI surface map, one action vocabulary, and one central action gate before implementation planning starts.
