# sprint-138-tutorial-mode — Iteration 3 Implementation Plan Draft

Date: 2026-07-15

Inputs:

- [Iteration 1 Design](_doco/design/sprints/138-tutorial-mode/138-it1-design.md)
- [Copilot Iteration 1 Design Review](_doco/design/sprints/138-tutorial-mode/138-it1-copilot-design-review.md)
- [Iteration 2 Design](_doco/design/sprints/138-tutorial-mode/138-it2-design.md)
- [Iteration 2 Implementation Plan Draft](_doco/design/sprints/138-tutorial-mode/138-it2-implementation-plan.md)
- [Iteration 3 Design](_doco/design/sprints/138-tutorial-mode/138-it3-design.md)

## Purpose of this document

This document is the next implementation-plan draft for sprint 138 tutorial mode. It incorporates the Iteration 3 simplifications and supersedes the broader Iteration 2 plan where Iteration 3 explicitly narrows scope.

Iteration 3 keeps the central tutorial experience:

1. Tutorial prompt content stored in song JSON.
2. A Prompt Area that follows the current Section.
3. `tutorialMode` values `none | strict | wizard`.
4. Strict mode as a locked learner experience.
5. Wizard mode as normal mode plus visible Section prompts.
6. A splash screen to avoid the empty startup display.
7. Prompt build tooling from sibling `.prompts.html` files.
8. Course/Lesson/Tutorial directory layout under the Song Library.
9. Local progress for Done and one Bookmark.
10. Chart Line and Chart display support in fullscreen/strict contexts.

Iteration 3 removes several Iteration 2 complexities:

1. No special wizard lockdown or wizard surface configuration.
2. No runtime `tutorialAuthoring` mode.
3. No `authorPreviewLockdown` checkbox.
4. No prompt-authored buttons.
5. No new strict keyboard mapping.
6. No broad action-gating framework beyond the focused strict-mode gates needed for existing input paths.
7. No built-in Theme/Tuning selector widgets in the Prompt Area.
8. No `visited` or `seen` tutorial progress.
9. No prompt images.
10. No automatic song-list caption extraction.

## Iteration 3 scope

### In scope

1. Add persisted tutorial metadata to Song and Section data.
2. Add runtime tutorial presentation state under `gPresentation.tutorial`.
3. Add a tutorial controller module responsible for mode activation, Prompt Area rendering, navigation widgets, Done/Bookmark progress, command-line escape hatch, and focused strict-mode gates.
4. Add Prompt Area template, builder, and CSS.
5. Implement `tutorialMode` command/menu actions under View > Presentation > Tutorial Mode:
   - `none`
   - `strict`
   - `wizard`
6. Implement wizard mode as normal mode plus prompt display when the current Section has prompt content.
7. Implement strict mode as Prompt Area plus restricted chrome and restricted keyboard entry.
8. Implement `Meta+Shift+m` command-line access in all modes.
9. Implement a one-section Bookmark widget and Done checkbox.
10. Implement tutorial progress badges in Song Library listings at runtime.
11. Implement splash screen as a separate template, with a simple `Loading...` state and CSS spinner.
12. Add prompt build tooling from `${songfile-stem}.prompts.html` into song JSON.
13. Use a real HTML parser for the build tool.
14. Sanitize Prompt Area HTML using the Info-style safe subset, plus approved variable expansion.
15. Allow prompt anchors for macro, raise, and existing superlinks; do not allow prompt buttons.
16. Keep prompt `img` tags disallowed.
17. Support Chart Line and Chart display in fullscreen/strict mode without tab-button chrome.
18. Extend fullscreen remembered Chart display behavior from `/cl` to `/cc`.
19. Keep `.prompts.html` files out of Song Library listings.
20. Add focused Jest coverage for model, schema, build tool, prompt sanitization wrappers, pure progress helpers, and strict key gates.

### Out of scope

1. Full tutorial authoring UI.
2. Any runtime prompt fetch.
3. Prompt-authored buttons or `data-action` elements.
4. Wizard lockdown or `allowedUI` additions/removals.
5. Runtime `tutorialAuthoring=true|false` query handling.
6. Author-preview lockdown checkbox.
7. New strict keyboard shortcut scheme.
8. Random Looping guards beyond hiding inaccessible UI.
9. Automatic `song-list.json` caption extraction.
10. Tutorial prompt images.
11. Per-Section `visited` or `seen` progress.
12. Automatic Done marking on Next.
13. Multiple bookmarks.
14. On-section-enter macro events.
15. Built-in Theme/Tuning selector widgets in Prompt Area.

## Current architecture seams

Relevant files:

- [infinite-neck.js](infinite-neck.js)
- [presentation.js](presentation.js)
- [key-handlers.js](key-handlers.js)
- [command-line.js](command-line.js)
- [Song.js](Song.js)
- [SongPersistence.js](SongPersistence.js)
- [Section.js](Section.js)
- [SectionPersistence.js](SectionPersistence.js)
- [SongLibrary.js](SongLibrary.js)
- [html-sanitizer.js](html-sanitizer.js)
- [bin/song-file-schema.js](bin/song-file-schema.js)

Recommended integration points:

1. `appInit()` loads splash/tutorial templates and initializes runtime presentation state.
2. URL startup routing decides whether splash is visible or hidden.
3. `openSong()` / `updateAfterOpenSong()` normalizes the active tutorial mode from the Song.
4. `sectionChanged()` refreshes Prompt Area content and progress widget state.
5. `document_keypress()` receives a focused strict-mode allowlist gate.
6. `document_keydown()` and `document_keyup()` keep normal command-line/Escape behavior, plus the `Meta+Shift+m` command-line shortcut.
7. Existing command-line menu action execution sets `tutorialMode` through new View > Presentation actions.
8. Song Library rendering adds runtime tutorial progress badges if the song entry is a tutorial.

Recommendation:

- Keep tutorial logic centralized in a new [Tutorial.js](Tutorial.js) module and a Prompt Area builder. Avoid scattering tutorial conditionals across unrelated modules except at necessary entry/gate points.

## Data model

### Song-level tutorial data

Add explicit support for:

```json
{
  "tutorial": {
    "level": "strict",
    "caption": "Chromatic Scale on one string",
    "storageKey": "tutorials/C000-intro/L001-one-string-intro/L001-1"
  }
}
```

Fields:

- `level`: one of `none`, `strict`, `wizard`.
- `caption`: optional tutorial/song caption populated by build tooling.
- `storageKey`: optional stable key for local progress.

Iteration 3 recommendation:

- Remove `allowedUI` from the implementation target for this sprint. If existing draft JSON contains `allowedUI`, schema may either reject it or ignore it, but new tutorial authoring docs should not mention it as supported in sprint 138.
- Prefer rejecting `allowedUI` in schema for now to keep the no-wizard-lockdown simplification enforceable.

Defaults:

- Missing `tutorial` means `level = none`.
- Missing `tutorial.level` means `none`.
- Non-tutorial songs remain behaviorally unchanged.

### Section-level tutorial data

Add explicit support for:

```json
{
  "tutorial": {
    "caption": "Section 1 - Getting Started",
    "prompt": {
      "lines": [
        "<p>Prompt for Section 1 goes here.</p>"
      ]
    }
  }
}
```

Fields:

- `caption`: optional Section tutorial caption.
- `prompt.lines`: optional array of sanitized/renderable HTML source lines.

Prompt visibility rules:

1. `tutorialMode = none`: Prompt Area hidden.
2. `tutorialMode = strict`: Prompt Area visible for tutorial songs; if a Section has no prompt, show stable widget/caption chrome with an empty or fallback prompt row.
3. `tutorialMode = wizard`: Prompt Area appears only when the current Section has prompt content or a tutorial caption; it disappears when the Section has no prompt/caption.

Recommendation:

- Treat missing prompt data in a strict tutorial as a build-time warning, not an immediate runtime failure. Strict tutorials can still navigate, but authored content should be complete before release.

### Local tutorial progress data

Store progress in browser local storage:

```json
{
  "version": 1,
  "storageKey": "tutorials/C000-intro/L001-one-string-intro/L001-1",
  "completedSectionIndex": 0,
  "bookmarkSectionIndex": 2,
  "updatedAt": "2026-07-15T00:00:00.000Z"
}
```

Iteration 3 refinement:

- Store highest completed Section as a single index, not a list.
- Store one bookmark Section index or `null`.
- Do not store `visited` or `seen`.
- Bookmark does not auto-save the current Section on tutorial open.

Open design detail:

- If a learner completes Section 3 and later clears Done on Section 2, should highest completed remain Section 3 or rewind? Recommendation: for sprint 138, Done toggles only the current Section against the highest-completed rule:
  - Clicking Done on a later Section advances `completedSectionIndex`.
  - Clicking Done on the current highest completed Section clears back to the previous completed index only if prior completion history is available.
  - Since we are not storing a list, use simpler behavior: clicking Done when current Section is the highest completed clears all completion by setting `completedSectionIndex = null`; clicking Done on any Section sets highest completed to that Section.
- This should be confirmed because the Song Library badge is specified as highest-numbered completed Section.

## Runtime presentation state

Extend [presentation.js](presentation.js):

```js
gPresentation.tutorial = {
  mode: 'none',
  active: false,
  strict: false,
  wizard: false,
  currentSectionIndex: -1,
  promptVisible: false,
  commandLineEasterEggActive: false,
  lastBlockedKey: ''
};
```

Recommended helper API:

- `TutorialPresentation.reset()`
- `TutorialPresentation.setMode(mode)`
- `TutorialPresentation.getMode()`
- `TutorialPresentation.isNone()`
- `TutorialPresentation.isStrict()`
- `TutorialPresentation.isWizard()`
- `TutorialPresentation.isActive()`
- `TutorialPresentation.setPromptVisible(value)`

Iteration 3 removals from the previous draft:

- `tutorialAuthoring`
- `authorPreviewLockdown`
- `effectiveLockdown`
- `visibleSurfaces`
- `lockedSurfaces`
- broad `canRunAction()` policy maps

Recommendation:

- Keep helper state primitive and serializable where practical. Do not store `Set` instances in `gPresentation` for this sprint; they complicate test setup and are unnecessary after the wizard simplification.

## Tutorial controller module

Add [Tutorial.js](Tutorial.js).

Responsibilities:

1. Normalize tutorial metadata from the active Song.
2. Set runtime `gPresentation.tutorial.mode`.
3. React to song load and section changes.
4. Render Prompt Area state via [templates/tutorial/tutorial.builder.js](templates/tutorial/tutorial.builder.js).
5. Manage local progress for Done and Bookmark.
6. Provide strict key allowlist helper.
7. Provide command-line `Meta+Shift+m` helper.
8. Provide tutorial URL/base-app URL helpers.
9. Provide Song Library progress badge helpers.

Recommended exports:

- `Tutorial.normalizeMode(mode)`
- `Tutorial.getSongTutorialMode(song)`
- `Tutorial.isTutorialSong(song)`
- `Tutorial.hasSectionPrompt(section)`
- `Tutorial.handleSongLoaded(song, context)`
- `Tutorial.handleSectionChanged(song, context)`
- `Tutorial.shouldShowPromptArea(song, section)`
- `Tutorial.getPromptModel(song, section, context)`
- `Tutorial.canHandleStrictKey(event)`
- `Tutorial.isCommandLineEasterEgg(event)`
- `Tutorial.getProgress(song)`
- `Tutorial.setDone(sectionIndex, song)`
- `Tutorial.clearDoneIfCurrent(sectionIndex, song)`
- `Tutorial.toggleBookmark(sectionIndex, song)`
- `Tutorial.getSongLibraryBadgeModel(songListEntry, progress)`
- `Tutorial.getAppBaseUrl(location)`

Dependency strategy:

- Keep normalization, progress, URL, key allowlist, and badge model helpers pure enough for Jest.
- Put DOM operations in the builder and thin integration calls.
- Do not import jQuery into pure helpers.

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

Place a host below the menu-button/logo area and above menu pages:

```html
<div id="divTutorialPrompt"></div>
```

Iteration 3 refinement:

- If top menu buttons are hidden in strict mode, put a compact Infinite Neck logo/link in the tutorial widget row.
- The compact logo should link to the current app base URL with no `song=` query.

Recommended app-base extraction:

- Use `window.location.origin + window.location.pathname` because current song URLs are query based.
- Strip query and hash.
- Example:
  - Current: `http://localhost:8000/infinite-neck/?song=tutorials/C000-intro/L001-one-string-intro/L001-1.json`
  - Base: `http://localhost:8000/infinite-neck/`

### Strict mode Prompt Area rows

Strict mode shows:

1. Widget row.
2. Prompt caption row.
3. Prompt HTML row.

The previous breadcrumb row is not needed in strict mode unless the team wants it later. Course/Lesson/Tutorial path can be available in the prompt caption row or through a copy-link glyph if desired.

Recommended strict widget row controls:

- Compact logo/link.
- `⇤ First`
- `« Previous`
- `LOOP`
- `BEAT-LOOP`
- `Done` checkbox.
- Bookmark snippet.
- `Next »`
- `Last ⇥`

### Wizard mode Prompt Area rows

Wizard mode shows prompts as normal-mode assistance:

1. Prompt caption row.
2. Prompt HTML row.

Wizard mode does not show:

- Widget row.
- Breadcrumb row.
- Author-preview checkbox.
- Special locked/allowed UI controls.

Wizard mode prompt visibility:

- Show when the current Section has `section.tutorial.prompt.lines[]` or `section.tutorial.caption`.
- Hide when the current Section has neither prompt nor caption.

### Prompt caption row

Display:

- `song.tutorial.caption`, when present.
- `section.tutorial.caption`, when present.

Recommendation:

- Keep `Section.caption` separate from `section.tutorial.caption`. `Section.caption` continues to serve Chart/LeadSheet/lyrics use cases.

### Prompt HTML row

Render from:

```js
section.tutorial.prompt.lines.join('\n')
```

Rendering steps:

1. Join lines.
2. Expand approved variables using the same approved mechanism used by Info, if available in a safe order.
3. Sanitize as tutorial prompt HTML.
4. Insert into `#tutorialPromptHtml`.
5. Bind allowed anchor behavior through delegated click handling only if existing global handlers do not already cover it safely.

Recommendation on expansion order:

- Expand approved variables before sanitization, then sanitize the final HTML fragment. This reduces the chance that a variable expansion bypasses sanitizer rules.

Design hole:

- The exact approved-variable expansion API for Info needs to be identified during implementation and reused rather than duplicated.

## Bookmark refinement

Replace the Iteration 2 bookmark checkbox with a one-bookmark widget.

When bookmark is set:

```text
bookmark: [§1] [Set]
```

When bookmark is not set:

```text
bookmark: [Set]
```

Behavior:

1. `[Set]` sets bookmark to the current Section if current Section is not already bookmarked.
2. `[Set]` clears bookmark if the current Section is already bookmarked.
3. `[§1]` jumps to the bookmarked Section.
4. Only one bookmark exists per tutorial.
5. Bookmark is stored in local storage only.

Styling:

- Wrap snippet in a container with `border: 2px solid black; background-color: white;`.
- `[Set]` uses green styling similar to `.BtnPunchedIn`.
- `[§1]`, when present, also uses green styling.
- The bookmarked Section token should have a separate CSS class from the Set button.

Suggested classes:

- `.tutorialBookmarkWidget`
- `.tutorialBookmarkSetButton`
- `.tutorialBookmarkGotoButton`
- `.tutorialBookmarkSectionToken`

Design hole:

- Confirm whether Section display uses one-based numbering everywhere in the widget. Recommendation: yes; users see Section 1, while storage remains zero-based.

## Done checkbox

The Done checkbox remains.

Behavior:

1. Checked when the current Section number is less than or equal to `completedSectionIndex`, if highest-completed semantics are used.
2. Clicking Done on the current Section sets highest completed Section to current Section.
3. Clicking Done when current Section is already the highest completed Section clears completion state, unless a richer completion list is later adopted.
4. `Next` does not alter Done.

Recommendation:

- Because the Song Library badge only displays highest completed Section, keep storage as a single highest index for sprint 138.
- Document the clear behavior in tutorial author docs if it remains user visible.

## Tutorial mode behavior

### `none`

- Prompt Area hidden.
- No strict chrome.
- Normal app behavior.

### `wizard`

Wizard mode is normal mode plus optional Section prompts.

Behavior:

1. All regular app chrome and features remain available.
2. Prompt Area appears only for Sections that have tutorial prompt/caption content.
3. Prompt Area omits widget row and breadcrumb row.
4. Prompt links may use macro, raise, and superlinks subject to sanitizer rules.
5. Wizard mode doubles as author preview mode.
6. Wizard mode can be entered by command-line/menu action `/vptw`.
7. Wizard mode can be hidden by `/vptn`.

Implementation simplification:

- Do not implement wizard `allowedUI`.
- Do not implement wizard action gating beyond ordinary sanitizer protection.
- Do not implement `tutorialAuthoring`.

Recommendation:

- Name the internal state `wizard` even though it is currently normal-plus-prompts, so later guided wizard behavior can be added without changing song files.

### `strict`

Strict mode is the learner mode.

Behavior:

1. Prompt Area visible.
2. Widget row visible.
3. Menu buttons hidden, including hamburger, unless a compact logo/link is included in widget row.
4. Fret tables visible.
5. Left rail LooperLight visible.
6. Instrument caption row and Song caption rows hidden.
7. Command-line not normally accessible.
8. Command-line accessible through `Meta+Shift+m`.
9. Prompt links may run sanitized macro, raise, and superlinks.
10. Keyboard shortcuts are filtered through a small allowlist.
11. Tutorial navigation buttons map to the same behavior as transport navigation buttons.
12. LOOP and BEAT-LOOP reuse existing transport/looper behavior and visuals.
13. Random Looping is not exposed and does not need a special guard for this sprint.
14. ESC does not stop looping and does not exit tutorial; it continues to hide command-line/transient UI as existing behavior permits.

Recommended strict visible surfaces:

- Tutorial Prompt Area.
- Compact logo/link in widget row.
- Fret tables.
- Left rail LooperLight.
- Chart Line or Chart view only when invoked/configured.
- Splash is outside tutorial mode and not part of strict surfaces.

Recommended strict hidden surfaces:

- Top menu buttons/hamburger.
- Instrument caption rows.
- Song caption rows.
- Normal transport if duplicated by tutorial widget row.
- Chart tab-button chrome in fullscreen/strict Chart views.
- File/Info/Fill/Palette/View menu pages unless opened through command-line escape into non-strict mode.

Design hole:

- The exact CSS selectors for hiding top menu buttons, captions, and normal transport should be confirmed in browser during implementation. Prefer body classes and CSS over repeated JS `.hide()` calls.

## Tutorial mode commands

Add tutorial mode menu items under View > Presentation > Tutorial Mode.

Desired command-line paths:

- `/vptn`: tutorial mode none.
- `/vpts`: tutorial mode strict.
- `/vptw`: tutorial mode wizard.

Behavior:

1. Actions set runtime presentation state.
2. Actions should be available from normal command-line.
3. `Meta+Shift+m` makes command-line reachable even in strict mode so authors can switch out of strict.
4. Tutorial mode changes are not persisted unless existing presentation state persistence already persists comparable view settings. Recommendation: do not persist tutorial mode globally for this sprint; derive initial mode from `song.tutorial.level` on song load.

Open question:

- Should switching a tutorial song from strict to wizard override only current runtime state, or should it update `gSong.tutorial.level` for save? Recommendation: runtime only for command actions; authors who want to change the song file should edit song JSON or use future authoring tools.

## Keyboard handling

Iteration 3 removes new keyboard mappings. Existing keyboard mappings remain; strict mode gates determine which keys get through.

### Strict `document_keypress()` gate

Suggested allowlist:

```js
['n', 'b', ',', '.', '<', '>', 'h', 'H', 'w', 'W', 'l', 'L']
```

Meaning should follow existing app shortcuts, not new tutorial semantics.

Implementation direction:

```js
if (Tutorial.isStrictModeActive() && !Tutorial.canHandleStrictKey(event)) {
  return;
}
```

Place the gate early enough in `document_keypress()` to block menu/action shortcuts, but after any command-line text-entry handling that should remain active when command-line is open.

### `Meta+Shift+m`

Add a keyboard path available in all modes:

- If `event.metaKey && event.shiftKey && key === 'm'`, open command-line as though normal mode `m` had been pressed.

Notes:

1. In strict mode, ordinary `m` remains blocked.
2. The command-line should never be hidden merely because strict mode is active.
3. Once open, command-line handles `ESC` and `x` normally.
4. Authors can enter `/vptw`, `/vptn`, or `/vpts` from strict via the Easter egg.

Design hole:

- Linux keyboards often use `Super` for `Meta`; browser support can vary. Manual acceptance should verify `Meta+Shift+m` in the target Linux browser. If unreliable, consider also allowing `Ctrl+Shift+m` only if the user approves.

### Escape behavior

ESC should not:

- Stop looping.
- Exit tutorial.
- Switch tutorial mode.

ESC should continue to:

- Hide command-line when command-line owns it.
- Hide existing transient UI where existing code already does that.

Recommendation:

- Avoid adding tutorial-specific ESC behavior unless a regression shows existing ESC paths stop loops in strict mode.

## Prompt HTML sanitization and links

### Allowed prompt HTML

Start from current Info sanitizer behavior.

Allow:

- Common text structure tags already allowed in Info.
- Anchors supported by Info-style superlinks.
- Macro links.
- Raise links.
- Approved variable/widget expansion already supported by Info.

Disallow:

- `img`.
- `button`.
- `script`.
- `style` attributes.
- Inline event attributes.
- Forms.
- File inputs.
- Arbitrary `data-action`.
- Arbitrary external executable links.

Recommendation:

- Add a wrapper such as `sanitizeTutorialPromptHtml(rawHtml)` that calls shared sanitizer primitives with the tutorial profile. This avoids weakening Info sanitizer defaults accidentally.

### Links styled as pseudo-buttons

Since prompt-authored buttons are out of scope, style anchors inside Prompt Area as optional pseudo-buttons via CSS classes.

Example authoring pattern:

```html
<a href="#macro=show-open-string-demo" class="tutorialPseudoButton">Show demo</a>
```

Implementation requirements:

1. Sanitizer must preserve approved anchor hrefs.
2. Sanitizer may preserve a small allowlist of CSS classes, including `tutorialPseudoButton`, if current sanitizer supports class allowlisting.
3. Default link behavior should remain link-like.

Design hole:

- Current sanitizer class-attribute handling must be inspected. If classes are stripped, pseudo-button styling can target `.tutorialPromptHtmlRow a` without requiring class preservation.

### Macro, raise, and superlinks

Iteration 3 explicitly allows these in prompts.

Recommendation:

- Reuse existing Info superlink dispatch code rather than adding a new prompt action grammar.
- Do not add strict-mode macro allowlists in sprint 138 unless the current Info macro path is unsafe for shared songs.
- Document that tutorial authors are trusted in the same way Info authors are trusted for macro/raise links.

Design hole:

- The design asserts macros are sanitized because they use known command/macro IDs. Implementation should verify that prompt-invoked macros cannot execute arbitrary JavaScript or unsanitized HTML before finalizing this assumption.

## Prompt build process

### New command-line build tool

Add:

- [bin/build-tutorial-prompts.js](bin/build-tutorial-prompts.js)

Purpose:

- Read a tutorial song JSON file.
- Read sibling `${songfile-stem}.prompts.html`.
- Extract tutorial caption and per-section prompt/caption blocks.
- Write updated tutorial data back into the JSON song file.

Input convention:

```text
songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json
songs/tutorials/C000-intro/L001-one-string-intro/L001-1.prompts.html
```

Prompt markers:

- `data-caption-for-tutorial="true"`
- `data-caption-for-section="1"`
- `data-prompt-for-section="1"`

Rules:

1. Section numbers in source are one-based.
2. Section indexes in JSON are zero-based.
3. Preserve line breaks inside prompt blocks.
4. Store prompt HTML as `section.tutorial.prompt.lines[]`.
5. Store tutorial caption as `song.tutorial.caption`.
6. Store Section tutorial caption as `section.tutorial.caption`.
7. Ensure `song.tutorial.level` exists; default to existing value or `strict` only if the command explicitly opts in. Recommendation: do not silently convert a normal song into a strict tutorial.

### HTML parser recommendation

Use `parse5`.

Reasons:

1. Widely adopted in the Node ecosystem.
2. Actively maintained and standards-oriented.
3. No browser/DOM emulation overhead.
4. Suitable for command-line parsing.
5. More dependable than regex for nested prompt blocks.
6. Simpler dependency footprint than `jsdom`.

Alternative:

- `htmlparser2` is also dependable and lightweight, but `parse5` is closer to browser HTML parsing semantics.

Recommendation:

- Add `parse5` as a dev dependency unless build tooling is considered production/runtime. Since this is a Node build tool, dev dependency is likely correct.

### Package script

Add to [package.json](package.json):

```json
{
  "scripts": {
    "build:tutorial-prompts": "node bin/build-tutorial-prompts.js"
  }
}
```

Potential usage:

```text
npm run build:tutorial-prompts -- songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json
```

### Validation

Report errors for:

1. Missing song file.
2. Missing prompt source file.
3. Invalid JSON.
4. Missing Sections array.
5. Duplicate tutorial caption marker.
6. Duplicate prompt marker for the same Section.
7. Duplicate Section caption marker for the same Section.
8. Out-of-range Section number.
9. Non-integer or zero/negative Section number.
10. Unsupported marker values.

Report warnings for:

1. Strict tutorial Section missing prompt content.
2. Prompt block present with empty content.
3. Section caption present without prompt content.
4. Source includes `img`, `button`, or other tags that runtime sanitizer will strip.

Design hole:

- Decide whether build tool should sanitize before writing JSON or preserve source and let runtime sanitize. Recommendation: preserve source lines and runtime sanitize, but have build tool warn about obviously stripped tags. This preserves author intent and keeps one sanitizer authority at runtime.

## Splash screen

### New files

Add:

- [templates/splash/splash.html](templates/splash/splash.html)
- [templates/splash/splash.css](templates/splash/splash.css)
- [templates/splash/splash.builder.js](templates/splash/splash.builder.js)

Keep splash independent of tutorial templates.

### Splash visual behavior

1. Full-screen overlay is recommended.
2. Initial no-query startup shows choices.
3. URL song/tutorial loads show a simple `Loading...` state.
4. If the user clicks a splash button, hide choices and show spinner/loading text while the action proceeds.
5. Use a simple CSS spinner or transition; animated GIFs are not required.
6. Splash remains until a valid choice or URL load has resolved.

### Splash buttons

Buttons:

1. `Open Tutorial`
2. `Open Song from Library`
3. `Author Song / Play Instruments`
4. `Open Local Song File`

Button behavior:

- `Open Tutorial`: open File menu, open Song Library, expand `tutorials` node.
- `Open Song from Library`: open File menu, open Song Library at root.
- `Author Song / Play Instruments`: create/open blank normal song.
- `Open Local Song File`: open File menu with Song Library collapsed and expose existing local-file open workflow.

Recommendation:

- Implement a pure splash routing decision helper and a browser builder separately.
- Avoid making splash depend on tutorial state; splash is startup chrome.

Design hole:

- The exact API to programmatically open File menu > Song Library > tutorials needs code archaeology. If no stable API exists, implement the minimal new Song Library open/expand helper rather than simulating clicks.

## Song Library tutorial progress badges

Iteration 3 adds runtime badges for tutorials in File > Song Library.

Display location:

- First column, after the existing Copy song link glyphs.

Badge examples:

```text
[§1:§3]
```

Meaning:

- `§1`: highest completed Section is Section 1.
- `§3`: bookmarked Section is Section 3.

Markup recommendation:

```html
<span class="songLibraryTutorialProgressBadge songLibraryInstrument instrumentObserver">
  <span class="songLibraryTutorialCompleted">&sect;1</span><span class="songLibraryTutorialSeparator">:</span><span class="songLibraryTutorialBookmark">&sect;3</span>
</span>
```

Rules:

1. Show badge only for tutorial songs.
2. Show completed span only when highest completed Section is set.
3. Show bookmark span only when bookmark is set.
4. If neither is set, show no badge.
5. Use distinct CSS classes for completed and bookmark spans.
6. Keep Instrument badges unchanged and visually separate.

Required implementation detail:

- Song Library entries need a stable way to identify the tutorial `storageKey` before opening the song. If `song-list.json` does not include enough metadata, derive storage key from the listed song path.

Design hole:

- Confirm whether tutorial detection in Song Library should use path under `tutorials/`, explicit metadata in `song-list.json`, or lazy song JSON metadata. Recommendation: path under `tutorials/` is enough for sprint 138 badges; explicit metadata can come later.

## Course/Lesson/Tutorial library layout

Directory convention:

```text
songs/tutorials/<Course>/<Lesson>/<Tutorial>.json
songs/tutorials/<Course>/<Lesson>/<Tutorial>.prompts.html
```

Example:

```text
songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json
songs/tutorials/C000-intro/L001-one-string-intro/L001-1.prompts.html
```

Rules:

1. `.json` tutorial songs appear in Song Library listings.
2. `.prompts.html` files do not appear in listings.
3. `song-list.json` files are manually edited for this sprint, except existing Instrument badge automation.
4. Progress badges are runtime display additions and do not modify `song-list.json`.
5. Opening tutorials from splash expands the `tutorials` branch, expected to be a sibling to `name-that-note` and `demo`.

Recommendation:

- Do not alter `npm run update:song-list` for captions in sprint 138.
- Ensure existing song-list update tooling ignores `.prompts.html` files if it does not already.

## Chart Line and Chart display work

Iteration 3 clarifies that `LeadSheet` means the tutorial author configures Chart options normally, and `/cc` shows the configured Chart style. `/cl` remains Chart Line.

Requirements:

1. In fullscreen mode, `/cl` should show Chart Line without tab-button chrome.
2. In fullscreen mode, `/cc` should show the configured Chart display without tab-button chrome.
3. In strict mode, `/cl` and `/cc` should show without tab-button chrome.
4. Fullscreen remembered Chart Line state should be extended so `/cc` has a separately remembered fullscreen/strict Chart display state as needed.
5. Existing Chart Options such as LeadSheet, Bare, or Box determine what `/cc` shows.
6. Chart display is read-only in strict mode from the learner perspective.

Relevant likely files:

- [infinite-neck.js](infinite-neck.js)
- [section-printer.js](section-printer.js)
- [section-printer.css](section-printer.css)
- [templates/SectionStatus/section-status.builder.js](templates/SectionStatus/section-status.builder.js)

Recommendation:

- Do not create a separate `chartLeadSheet` tutorial surface for sprint 138. Use existing Chart option state and make `/cc` respect fullscreen/strict chrome rules.
- Add CSS/body-class logic to hide tab-button chrome in strict/fullscreen Chart display.

Design hole:

- Need to identify whether `/cc` currently maps to Chart, Chart Chords, Chart Controls, or a different action name. The implementation plan should preserve existing command semantics and only adjust display chrome.

## Looper and navigation widgets

Navigation buttons map to existing transport navigation behavior because tutorial Sections are Song Sections.

Buttons:

- First.
- Previous.
- Next.
- Last.

Loop buttons:

- LOOP.
- BEAT-LOOP.

Requirements:

1. Reuse existing transport action functions rather than duplicating navigation logic.
2. Reuse existing loop and beat-loop visuals in the tutorial buttons.
3. Keep left rail LooperLight visible in strict mode.
4. Do not expose Random Looping in strict mode.
5. Do not add extra Random Looping guard code unless an accessible path is found during acceptance testing.

Design hole:

- Need to identify whether transport navigation currently uses direct functions, command actions, or button click handlers. Prefer stable function/action calls over simulating DOM clicks.

## Schema updates

Update [bin/song-file-schema.js](bin/song-file-schema.js).

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
    storageKey: { type: 'string' }
  },
  required: ['level'],
  additionalProperties: false
};
```

Iteration 3 recommendation:

- Exclude `allowedUI`, `tutorialAuthoring`, `authorPreviewLockdown`, prompt action allowlists, theme selectors, tuning selectors, `visited`, and `seen` from schema for this sprint.

Open question:

- Should `song.tutorial.level` be required when `tutorial` exists? Recommendation: yes, in schema; persistence normalization can default missing level to `none` for older or hand-authored files.

## Persistence updates

Update [SongPersistence.js](SongPersistence.js):

1. Normalize `song.tutorial`.
2. Normalize `song.tutorial.level` to `none | strict | wizard`.
3. Normalize `song.tutorial.caption` to string or absent.
4. Normalize `song.tutorial.storageKey` to string or derive at runtime.
5. Avoid preserving unsupported tutorial fields when saving if schema rejects them.

Update [SectionPersistence.js](SectionPersistence.js):

1. Normalize `section.tutorial`.
2. Normalize `section.tutorial.caption` to string or absent.
3. Normalize `section.tutorial.prompt.lines` to an array of strings or absent.

Recommendation:

- Do not add legacy migration code for pre-sprint tutorial shapes; this is new work and the repo preference is no-legacy unless specifically required.

## CSS/body classes

Add body classes for broad chrome changes:

- `tutorial-active`
- `tutorial-mode-strict`
- `tutorial-mode-wizard`
- `tutorial-prompt-visible`
- `tutorial-command-line-open`

Strict CSS should hide broad chrome.

Wizard CSS should only style/show Prompt Area and should not hide normal chrome.

Recommendation:

- Use classes on `body` plus component classes inside tutorial templates.
- Avoid setting inline styles in JS except where existing code already requires it.

Design hole:

- Existing CSS specificity may require careful selectors. Strict mode acceptance should include a visual checklist for hidden menu buttons, captions, transport duplication, and LooperLight visibility.

## App integration work plan

### Phase 1: Model, schema, and pure helpers

1. Add tutorial schemas to [bin/song-file-schema.js](bin/song-file-schema.js).
2. Add tutorial normalization in [SongPersistence.js](SongPersistence.js) and [SectionPersistence.js](SectionPersistence.js).
3. Add [Tutorial.js](Tutorial.js) pure helpers for mode, prompt visibility, progress, URL base, strict key allowlist, and Song Library badge model.
4. Add Jest tests for:
   - missing tutorial means `none`.
   - valid levels normalize correctly.
   - invalid levels normalize or reject according to chosen persistence/schema boundary.
   - strict/wizard prompt visibility rules.
   - one-bookmark progress.
   - highest-completed progress.
   - app-base URL extraction.
   - strict key allowlist.

### Phase 2: Prompt build tool

1. Add `parse5` dependency.
2. Add [bin/build-tutorial-prompts.js](bin/build-tutorial-prompts.js).
3. Add package script `build:tutorial-prompts`.
4. Implement single-song mode.
5. Add fixture JSON and `.prompts.html` files under [_tests/jest/fixtures/](_tests/jest/fixtures/) or similar.
6. Add tests for:
   - tutorial caption extraction.
   - Section caption extraction.
   - prompt line preservation.
   - duplicate marker errors.
   - out-of-range errors.
   - warnings for tags runtime will strip.

### Phase 3: Prompt Area rendering

1. Add tutorial template/CSS/builder.
2. Add host in [index.html](index.html).
3. Load template during `appInit()`.
4. Render strict Prompt Area with widget row.
5. Render wizard Prompt Area without widget/breadcrumb rows.
6. Hide wizard Prompt Area on Sections with no prompt/caption.
7. Render captions and prompt HTML.
8. Reuse Info-style approved variable expansion and sanitization profile.
9. Style prompt anchors as pseudo-buttons where appropriate.

### Phase 4: Tutorial lifecycle hooks

1. Call tutorial song-load hook from `updateAfterOpenSong()` or nearest stable seam.
2. Call tutorial section-change hook from `sectionChanged()`.
3. Apply body classes for current mode and prompt visibility.
4. Derive initial mode from `song.tutorial.level`.
5. Add View > Presentation > Tutorial Mode command actions.
6. Ensure `/vptn`, `/vpts`, `/vptw` work.

### Phase 5: Strict chrome and keyboard gates

1. Hide strict chrome using CSS/body classes.
2. Keep compact logo/link in widget row.
3. Keep left rail LooperLight visible.
4. Gate `document_keypress()` with strict allowlist.
5. Add `Meta+Shift+m` command-line shortcut in all modes.
6. Ensure command-line remains usable once opened.
7. Ensure ESC hides command-line but does not stop loops or exit tutorial.
8. Add focused pure tests for key decisions; use browser/manual acceptance for full keyboard behavior.

### Phase 6: Widget actions and progress

1. Bind navigation buttons to existing transport navigation paths.
2. Bind LOOP and BEAT-LOOP to existing looper paths and visuals.
3. Implement Done checkbox behavior.
4. Implement Bookmark widget `[§n] [Set]`.
5. Persist progress to local storage.
6. Refresh widget state on Section changes.
7. Add tests for pure progress helpers.

### Phase 7: Splash screen

1. Add splash template/CSS/builder.
2. Add full-screen overlay startup flow.
3. Implement choices and loading state.
4. Route `song=`, `tuning=`, no-query startup, and clicked button cases.
5. Add File menu/Song Library open helpers for root/tutorials/local-file flows.
6. Add tests for pure routing helper.
7. Validate manually in browser.

### Phase 8: Song Library progress badges

1. Identify Song Library listing render path.
2. Derive tutorial storage key for listed tutorial songs.
3. Read local progress.
4. Render badge after Copy song link glyphs.
5. Add CSS classes for completed/bookmark spans.
6. Ensure Instrument badges remain unchanged.
7. Add pure tests for badge model.

### Phase 9: Chart display adjustments

1. Identify `/cl` and `/cc` action/display paths.
2. Ensure `/cc` works in fullscreen with remembered state analogous to `/cl`.
3. Hide Chart tab-button chrome in fullscreen/strict Chart display.
4. Ensure strict prompt macro links can invoke `/cl` and `/cc`.
5. Confirm configured Chart style such as LeadSheet/Bare/Box is respected.
6. Validate manually in browser.

### Phase 10: Documentation updates

1. Update [sprint-138.md](_doco/design/sprints/138-tutorial-mode/sprint-138.md) with links to Iteration 3 plan.
2. Update [_doco/developer/globals-programmers-reference.md](_doco/developer/globals-programmers-reference.md) for `gPresentation.tutorial`.
3. Add tutorial prompt authoring docs.
4. Add build tool usage docs.
5. Document allowed prompt HTML and link patterns.
6. Document Course/Lesson/Tutorial layout.
7. Document strict-mode keyboard and command-line Easter egg.

## Testing strategy

### Jest targets

Use repo ESM test pattern:

```text
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand
```

Add/update tests for:

1. Tutorial schema validation.
2. Song/Section tutorial normalization.
3. Tutorial mode helper behavior.
4. Prompt visibility rules.
5. Local progress helpers.
6. Bookmark widget model.
7. Song Library badge model.
8. Strict key allowlist.
9. App-base URL extraction.
10. Splash route decision helper.
11. Prompt build tool extraction and validation.
12. Tutorial sanitizer wrapper.

### Browser/manual acceptance

Manual acceptance checklist:

1. No-query startup shows splash choices, not empty no-tunings display.
2. Splash `Open Tutorial` opens File menu > Song Library > tutorials branch.
3. Splash `Open Song from Library` opens File menu > Song Library root.
4. Splash `Author Song / Play Instruments` opens blank normal mode.
5. Splash `Open Local Song File` exposes local-file open flow.
6. URL `song=` tutorial opens strict/wizard according to song tutorial level.
7. URL `song=` non-tutorial opens normal UI.
8. URL `tuning=` still opens blank normal mode with requested tuning.
9. Strict Prompt Area appears with widget row.
10. Wizard Prompt Area appears only on prompted Sections and has no widget row.
11. Strict top menu buttons/hamburger are hidden.
12. Strict compact logo goes to app base URL.
13. Strict left rail LooperLight remains visible.
14. Strict instrument and Song caption rows are hidden.
15. Navigation buttons change Sections and refresh prompt content.
16. LOOP and BEAT-LOOP match existing visuals and behavior.
17. Done persists locally.
18. Bookmark `[§n] [Set]` sets, jumps, and clears correctly.
19. Song Library badges show completed/bookmark state.
20. `Meta+Shift+m` opens command-line in strict mode.
21. `/vptw`, `/vpts`, and `/vptn` switch modes.
22. ESC hides command-line but does not exit tutorial or stop looping.
23. Prompt macro/raise/superlinks work when sanitized.
24. Prompt `img` and `button` content is stripped or inert.
25. `/cl` and `/cc` display without tab-button chrome in fullscreen/strict contexts.

## Recommendations summary

1. Use `parse5` for prompt build parsing.
2. Keep wizard mode as normal-plus-prompts only.
3. Remove `tutorialAuthoring`, `authorPreviewLockdown`, `allowedUI`, and broad action-gating from sprint 138 implementation.
4. Use body classes and CSS for strict chrome hiding.
5. Centralize tutorial mode and progress helpers in [Tutorial.js](Tutorial.js).
6. Reuse Info sanitizer/superlink behavior through a tutorial wrapper instead of inventing a new prompt action grammar.
7. Expand approved variables before sanitizing final prompt HTML.
8. Treat prompt-authored links as links; style them as pseudo-buttons with CSS.
9. Store one bookmark and one highest completed Section.
10. Derive Song Library tutorial progress badge storage keys from tutorial song paths for sprint 138.
11. Keep splash independent from tutorial mode.
12. Preserve existing Chart option semantics; make `/cc` chrome-free in fullscreen/strict rather than creating a separate LeadSheet path.

## Design holes and unanswered questions

### Completion semantics

- How should clearing Done work with highest-completed-only storage?
- Is clearing all completion acceptable when the current highest completed Section is unchecked?

Recommendation:

- Accept simple highest-completed behavior for sprint 138 and document it.

### Command-line Easter egg portability

- Does `Meta+Shift+m` work consistently in the target Linux browser?

Recommendation:

- Test manually before final acceptance. Do not add `Ctrl+Shift+m` unless approved.

### Song Library open/expand API

- Is there an existing stable function to open File menu > Song Library and expand a branch?

Recommendation:

- Add a small explicit API if none exists; avoid DOM-click simulation.

### Prompt sanitizer class handling

- Can prompt anchors preserve classes such as `tutorialPseudoButton`?

Recommendation:

- If class allowlisting is awkward, style all prompt anchors within `.tutorialPromptHtmlRow` as pseudo-buttons where desired, or use parent context classes.

### Macro safety assumption

- Are macro and raise superlinks safe enough for strict tutorial prompts in shared songs?

Recommendation:

- Verify implementation paths. If they can mutate too broadly, document that tutorial songs are trusted authored content for this sprint rather than adding allowlists now.

### Strict chrome selector accuracy

- Which exact elements correspond to menu buttons, hamburger, captions, normal transport, left rail LooperLight, and Chart tab chrome?

Recommendation:

- Resolve during implementation with browser inspection and keep selectors in template/CSS code rather than model code.

### `/cc` command semantics

- What exact existing action does `/cc` invoke, and how does it differ from `/cl`?

Recommendation:

- Preserve existing action semantics; only adjust fullscreen/strict display chrome and remembered state.

### Tutorial detection in Song Library

- Should runtime badges identify tutorials by path under `tutorials/`, by `song-list.json` metadata, or by loading each song JSON?

Recommendation:

- Use path-based detection for sprint 138. Loading every song JSON for badges could slow Song Library display.

### Strict random looping

- Is there any remaining reachable path to enable Random Looping in strict mode?

Recommendation:

- Do not add defensive code unless acceptance testing finds an accessible path.

### Build-time vs runtime sanitization

- Should build tool write sanitized prompt HTML or source prompt HTML?

Recommendation:

- Write source prompt lines; runtime sanitizer remains authoritative. Build tool warns about obviously disallowed tags.

## Draft acceptance checklist

A first Iteration 3 implementation is ready for deeper review when:

1. Non-tutorial songs behave normally.
2. Tutorial song schema and persistence normalize `none | strict | wizard`.
3. Prompt build tool embeds tutorial caption, Section captions, and prompt lines.
4. Prompt Area renders strict and wizard modes correctly.
5. Wizard mode is normal mode plus prompts only.
6. Strict mode hides menu chrome and shows compact logo in widget row.
7. Strict mode keeps fret tables and left rail LooperLight visible.
8. Strict mode does not expose normal command-line except through `Meta+Shift+m`.
9. `/vptn`, `/vpts`, and `/vptw` switch tutorial modes.
10. Strict key gate blocks non-allowed keypress paths.
11. ESC does not stop looping or exit tutorial.
12. Navigation buttons map to existing transport navigation.
13. LOOP and BEAT-LOOP reuse existing behavior and visuals.
14. Done state persists locally.
15. One Bookmark persists locally, jumps, and clears from current bookmarked Section.
16. Song Library tutorial progress badges render after copy-link glyphs.
17. Splash screen appears on empty startup and routes all four choices.
18. URL query loading still works for `song=` and `tuning=`.
19. Prompt HTML is sanitized, allows approved variables and safe links, and disallows images/buttons.
20. `/cl` and `/cc` can be invoked from strict prompt links/macros and show without tab-button chrome.
21. `.prompts.html` files are excluded from Song Library listings.
22. Focused Jest tests cover pure helpers and build tooling.
23. Browser acceptance confirms visual layout and keyboard behavior.

## Suggested implementation order

Recommended order:

1. Model/schema normalization.
2. Pure [Tutorial.js](Tutorial.js) helpers.
3. Prompt build tool with `parse5`.
4. Prompt Area rendering in wizard mode first.
5. Prompt Area widget row and strict mode rendering.
6. Tutorial mode commands under View > Presentation.
7. Strict body classes and CSS chrome hiding.
8. Strict key gate and `Meta+Shift+m`.
9. Done and Bookmark local progress.
10. Song Library progress badges.
11. Splash screen.
12. Chart `/cl` and `/cc` chrome adjustments.
13. Documentation and acceptance pass.

Reasoning:

- Wizard rendering is the least invasive way to validate prompt data and sanitizer behavior.
- Strict lockdown should come after rendering and command escape paths exist.
- Progress badges depend on progress storage and can follow the widget implementation.
- Splash and Chart changes touch broader application startup/display paths and should come after tutorial core behavior is stable.
