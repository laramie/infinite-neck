# sprint-152 Iteration 1 Implementation Plan

Design: [152-design.md](152-design.md)  
Sprint: [sprint-152.md](sprint-152.md)  
Background (reference only): [sprint-138.md](../138-tutorial-mode/sprint-138.md)

Status: **plan only, no code written.** Several edits are to top-level `./` files, so each needs your explicit approval (see "Top-level files touched").

---

## 1. What exists today (verified in code)

| Concern | Where | Finding |
|---|---|---|
| Section list renderer | [templates/tutorial/tutorial.builder.js](../../../../templates/tutorial/tutorial.builder.js) `renderLessonSectionList(model)` | Pure function, no strict dependency. Rows have Done, Bookmark and Include-in-Looping controls, each a `data-action` handled by the delegated click handler in `bindDataActionHandlers()`. It can be reused as is. |
| Strict-only gating | same file, `renderTutorialPrompt()` | `lessonList = model.strict && model.lessonSectionListOpen ? ...`. The wizard branch emits only `#tutorialPrompt` with the header and content. |
| Runtime state | [infinite-neck.js](../../../../infinite-neck.js) `tutorialRuntimeState` (~L522) | `includeInLoopingSectionIndexes` (`null` means all). Transient, reset on song change. Mode independent. |
| Handlers | [infinite-neck.js](../../../../infinite-neck.js) `tutorialToggleDone`, `tutorialToggleBookmark`, `tutorialToggleIncludeInLooping`, `tutorialToggleAllIncludeInLooping` (~L630-L655) | Mode independent. Progress storage key comes from the song href or name, so Done/Bookmark persistence already works for any song. |
| Loop filter | [infinite-neck.js](../../../../infinite-neck.js) ~L5018 `setLoopSectionFilter(...)`, [Tutorial.js](../../../../Tutorial.js) `filterStrictLoopSectionIndex`, [looper.js](../../../../looper.js) `tickBeat` | Filtering is applied after every Section loop transition. See finding F1. |
| Transport caption | [infinite-neck.js](../../../../infinite-neck.js) `applyLoopSectionsUi()` (~L3773), [Tutorial.js](../../../../Tutorial.js) `getLoopCaptionModel()` | Writes `#btnLoopSections` and `.classLoopSections` for every mode. "LOOPING 1..3" **already works in wizard mode** once a subset can be set. |
| Looper Light | [templates/SectionStatus/section-status.css](../../../../templates/SectionStatus/section-status.css), [section-status.builder.js](../../../../templates/SectionStatus/section-status.builder.js) `applyLoopState()` | Solid `3px` border, green idle and magenta (`.SectionStatus_loopActive`, which uses `border: ... !important`). Many instances (Song Caption, Instrument Caption rows, left rails). |
| Widget visibility pattern | [layout.js](../../../../layout.js) `toggleSongWidgets` / `applySongWidgetsVisibility`, [key-handlers.js](../../../../key-handlers.js) ~L1655, [menu.js](../../../../menu.js) ~L1271 / L1348 / L1446 | The `/vhw`, `/vsw`, `/vtw` menus and the per-screen (`fullscreen` / `escaped`) persisted flags are already a clean template to copy. |
| Fullscreen | [infinite-neck.js](../../../../infinite-neck.js) `enterFullscreen` / `isFullscreenActive` | Fullscreen is `.container` hidden. `#divTutorialPrompt` is **inside** `.container` ([index.html](../../../../index.html) L111). So it is invisible in fullscreen. |

### Findings that affect the design

**F1. The loop-filter gate is accidentally always open.**  
`strictTutorial: normalizeTutorialMode(isStrictTutorial())` passes a boolean to a string normalizer. `normalizeTutorialMode(true)` and `normalizeTutorialMode(false)` both return `'none'`, which is truthy. So `filterStrictLoopSectionIndex` filters in every mode, including wizard. Wizard filtering therefore works today if a subset exists. The only missing pieces are the UI and the indicator. The fix should make the gate explicit: filter in strict and wizard only, never in none.

**F2. `#divTutorialPrompt` cannot be reused for fullscreen.**  
The design says the list must show in `fullscreen` and `escaped`. That rules out "turn off the other chrome under `#divTutorialPrompt`". We take the design's preferred option: a **new host div outside `.container`**, as `#divFullscreenChartHost` already is.

**F3. `Layout.screen` is not the same object as `screenList.escaped` after a Song loads.**  
`new Layout(obj.layout)` runs `Object.assign(this, jsonObj)`. After that, `this.screen` is a separate copy of the `escaped` entry. A toggle made while escaped edits the copy. Entering and leaving fullscreen then does `this.screen = this.screenList.escaped`, which is the stale entry from the file. So an escaped-mode toggle on a loaded Song can be lost. This affects any new per-screen flag, including the Practice List ("remembered separately in fullscreen and escaped"). It is a small fix in the Layout constructor (re-link `screen` to `screenList[screen.name]`). Question Q5.

**F4. Wizard Songs often have no `section.tutorial.caption`.**  
[songs/practice/supersong-C.json](../../../../songs/practice/supersong-C.json) has only `section.caption` ("A major", "Piano"). The list's Caption column would be blank. Also `row.caption` is inserted into the HTML unescaped. That is acceptable for authored strict tutorials, but not for arbitrary Section captions. Question Q2.

**F5. Focus.**  
[key-handlers.js](../../../../key-handlers.js) ignores shortcut keys while an `input` has focus. Today every list action re-renders (`replaceWith`), which drops focus. The Practice List must keep "full re-render after every action, no in-place patching", or the `l` key stops working after a click on a checkbox.

---

## 2. Design evaluation

Agree with the design. The rest of this section is refinements.

1. **New host, no tutorial chrome.** A static `<div id="divPracticeList">` in `index.html`, outside `.container`, between `#divFullscreenChartHost` and `#topControlsCaptions`. It is not template loaded, so there is no load race. It is filled only when the Song's mode is `wizard`, and is empty for `none` and `strict`. Strict mode keeps its own list, which is untouched.
2. **Visibility is a Layout flag, not tutorial runtime state.** Add `PracticeList` to each `Layout` screen. Show the host only when `hasContent && screen.PracticeList`, which is the same rule `applySongWidgetsVisibility` uses. `tutorialRuntimeState.lessonSectionListOpen` stays strict-only.
3. **Reuse `renderLessonSectionList`.** One renderer, so strict and wizard cannot drift. Add one options parameter, `{ progressColumns: true }`, so Question Q1 is a one-line change.
4. **Loop indicator by a body class, not per-widget state.** There are many Looper Light instances, and they re-render and re-apply loop state on every beat. A single class on `<body>` plus CSS covers all of them, survives re-render, and costs nothing per beat. This is the "runtime modified" rule in the design.
5. **Transport caption needs no new code.** Just verify it in wizard mode.

---

## 3. Implementation steps

### Step 1. Pure logic, [Tutorial.js](../../../../Tutorial.js)

- Rename `filterStrictLoopSectionIndex` to `filterIncludedLoopSectionIndex`. Replace option `strictTutorial` with `tutorialActive`. No legacy alias (per the repo's "break-everything" rule). `SongNavigationHooks.js` already has `filterLoopSectionIndex`, so the name must differ.
- Add `isLoopSubsetInEffect(includeIndexes, sectionCount)`. It is true when the normalized set is non-empty and smaller than all Sections. This is the same predicate `getLoopCaptionModel` uses to decide on "LOOPING 2..3", so the caption and the border can never disagree. `getLoopCaptionModel` should call it.
- Unchanged: empty set means all, `toggleAll`, the `first..last` caption for non-contiguous sets.

### Step 2. Rendering, [templates/tutorial/tutorial.builder.js](../../../../templates/tutorial/tutorial.builder.js)

- `renderLessonSectionList(model, { progressColumns = true } = {})`. Omit the Done and Bookmark `th` and `td` when `false`.
- New `renderPracticeList(model)` returns:
  ```html
  <div class="practiceListPaper"><div class="practiceListRendered">{lessonSectionList}</div></div>
  ```
  or `''` when `!model.wizard`.
- `buildLessonSectionListModel` caption source: see Q2.
- `renderTutorialPrompt` is unchanged for wizard. It still emits only the header and prompt content, with no list. The existing wizard test keeps passing.

### Step 3. Wiring, [infinite-neck.js](../../../../infinite-neck.js)

- New `renderPracticeList()`:
  - Build the model with `buildTutorialPromptModel`, which already supplies progress, current index, and include set.
  - `$('#divPracticeList').html(...)`.
  - Then `getSong().getLayout().applyPracticeListVisibility()`.
  - Guard: no song, headless, or host missing.
- Call it from the existing `renderTutorialPrompt()` wrapper. That wrapper is already called on `syncSectionUi()`, on every list action, and on `setTutorialMode()`, so no new call sites are needed. A full re-render each time keeps F5 intact.
- Loop filter at ~L5018: pass `tutorialActive: isTutorialSong(getSong())`, and drop the `normalizeTutorialMode(isStrictTutorial())` expression (F1).
- New `updateLoopSubsetIndicator()`:
  ```js
  const subset = isTutorialSong(song) && isLoopSubsetInEffect(tutorialRuntimeState.includeInLoopingSectionIndexes, sectionCount);
  $('body').toggleClass('loopSubset', subset && !beatsLooping());
  ```
  Call it from `applyLoopSectionsUi`, `applyLoopBeatsUi`, `refreshTutorialLoopCaption` (without its `sectionsLooping()` early return), and `resetTutorialRuntimeForSongIfNeeded`. Whether the class is limited to the looping state is decided in CSS (Q3).
- Caption (`applyLoopSectionsUi`): also gate on `isTutorialSong`, so a stale set cannot caption a non-tutorial Song after `setTutorialMode('none')`.
- No new `data-action` handlers. All already registered.

### Step 4. Layout, [layout.js](../../../../layout.js)

- `PracticeList: false` in both `screenList` entries. Back-fill `undefined` to `false` in the constructor, as is done for `SongWidgets`.
- `togglePracticeList(visible)` flips or sets `screen.PracticeList`, then calls `applyPracticeListVisibility()`.
- `applyPracticeListVisibility()`: `$('#divPracticeList').toggle(hasContent && screen.PracticeList !== false)`. Check the exact condition for the default in Q4.
- `doToggles()` also calls `togglePracticeList(this.screen.PracticeList)`, so entering or leaving fullscreen, and Song open, apply the right per-screen value.
- If approved (Q5): re-link `this.screen` in the constructor.
- Persistence is automatic, since `layout` is serialized with the Song. The Song file schema has no `layout` entry, so no schema change is needed.

### Step 5. Commands

- [menu.js](../../../../menu.js): add `{ "caption": "<b>p</b>ractice list", "trigger": "p", ... }` under `/vhw` (`hidePracticeList`), `/vsw` (`showPracticeList`), and `/vtw` (`togglePracticeList`). `p` is free in all three sibling lists. `x` is not used.
- [key-handlers.js](../../../../key-handlers.js): three `case`s next to the `SongWidgets` ones, calling `getSong().getLayout().togglePracticeList(false | true | undefined)`. They need no new imports, so the hand-picked `infinite-neck.js` mocks in the key-handler tests are unaffected.
- Resulting commands: `/vhwp`, `/vswp`, `/vtwp`.

### Step 6. CSS

- [templates/tutorial/tutorial.css](../../../../templates/tutorial/tutorial.css): `.practiceListPaper` (paper `rgb(251,185,99)`, `1px solid brown`, `0.75em` padding) and `.practiceListRendered` (`rgb(255,235,156)`, the same `box-shadow` as `.infoRendered`, `max-height: 40vh; overflow: auto`). Copy the values rather than reuse `.infoTabsPaper` / `.infoRendered`, because those carry `min-height: 16em` and table overrides. `.lessonSectionList` has `margin-left: 2em; width: 94%` for the strict layout, so scope an override under `.practiceListRendered` to zero those margins.
- [templates/SectionStatus/section-status.css](../../../../templates/SectionStatus/section-status.css):
  ```css
  /* subset of Sections in effect: dashed (idle green rule needs no !important, magenta does) */
  body.loopSubset .SectionStatus_loopActive { border-style: dashed !important; }
  /* Option B only, see Q3: */
  /* body.loopSubset .SectionStatus_loopLight { border-style: dashed; } */
  ```
  Colors, padding, radius and beat-counter rules are untouched. This depends on `body.loopSubset .X` outranking `.X` for `!important` declarations.

### Step 7. Markup, [index.html](../../../../index.html)

```html
<div id="divPracticeList" style="display: none;"></div>
```
Place it after `#divFullscreenChartHost`.

### Step 8. Docs

- [help.html](../../../../help.html): document `/vhwp`, `/vswp`, `/vtwp` near the other widget commands (~L3415-L3447). Extend the Looper Light text (~L1645) with the dashed border. Add a short Practice List note to the tutorial wizard help, if there is a section for it.

---

## 4. Tests (Jest only, no JSDOM, no jQuery, per repo practice)

- [_tests/jest/tutorial.test.js](../../../../_tests/jest/tutorial.test.js): update the existing filter tests for the rename and the new option. Add cases: wizard filters like strict, `none` does not filter. Add `isLoopSubsetInEffect` cases (null, empty, all, one, some) and check agreement with `getLoopCaptionModel`.
- [_tests/jest/tutorial-builder.test.js](../../../../_tests/jest/tutorial-builder.test.js): `renderPracticeList` for wizard contains `lessonSectionList`, the Include column and the current-row class. It returns `''` for strict and none. `progressColumns: false` removes Done and Bookmark. The wizard prompt still contains no list.
- New `_tests/jest/layout.test.js`: `PracticeList` default and back-fill for old files. The flag is stored per screen. A JSON round trip keeps both screens separate. If Q5 is approved, `screen` is the same object as `screenList.escaped` after load. Layout methods use `$`, so the test covers only the constructor and data. DOM methods are left to UI acceptance.
- Browser behavior (host visibility, the dashed border, focus) is covered by the manual checklist below.

Full run before check-in:
```
export INFINITE_NECK_VERBOSE=-1
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand
```

## 5. UI acceptance checklist (manual)

1. Open a wizard Song (for example [songs/practice/supersong-C.json](../../../../songs/practice/supersong-C.json)). `/vswp` shows the list, `/vhwp` hides it, `/vtwp` toggles it.
2. The list shows in escaped mode and in fullscreen. Show it in one and hide it in the other, save, reload, and each screen remembers its own state.
3. Strict and none Songs show no Practice List. The strict list is unchanged.
4. Uncheck some Sections. The Transport shows "LOOPING 2..4". Loop. Unchecked Sections are skipped. The Looper Light is dashed in the Song Caption, the Instrument Caption rows and the left rails.
5. Check all Sections (or uncheck all). The caption reads plain "LOOPING" and the border is solid.
6. Beat looping with a subset set: solid border, caption `∞` only.
7. Click a checkbox, then press `l`. Looping toggles, so focus is not trapped.
8. Click a Section link. Navigation works and the current row highlights.
9. Done and Bookmark survive a reload, as they do in strict mode (subject to Q1).
10. Switch the Song from wizard to none via `setTutorialMode`. The list disappears, and the caption and border return to normal while looping.

---

## 6. Top-level files touched (need explicit approval)

[Tutorial.js](../../../../Tutorial.js), [infinite-neck.js](../../../../infinite-neck.js), [layout.js](../../../../layout.js), [key-handlers.js](../../../../key-handlers.js), [menu.js](../../../../menu.js), [index.html](../../../../index.html), [help.html](../../../../help.html).  
Not top-level: `templates/tutorial/*`, `templates/SectionStatus/section-status.css`, `_tests/jest/*`.

---

## 7. Questions

**Q1. Done and Bookmark in wizard mode.**  
[sprint-152.md](sprint-152.md) says "Do not add Learner Done and Bookmark progress to wizard mode." [152-design.md](152-design.md) says to retain those columns because they come nearly free. These conflict.  
*Recommend:* follow the design (keep the columns) and edit the sprint Purpose line. The `progressColumns` option makes the alternative a one-line change.

**Q2. Caption column for wizard Songs.**  
Many wizard Songs have no `section.tutorial.caption`, so the Caption column would be blank.  
*Recommend:* in wizard mode, fall back to `section.caption` when the tutorial caption is blank, and use the same fallback for the list in either mode. Render wizard captions HTML-escaped. Strict authored captions keep their current raw rendering.

**Q3. When is the border dashed?**  
Your wording is "when we are Section looping with a constraining Set", but the example rule changes the green (idle) base rule.  
- A: dashed only while Section looping (magenta dashed). Idle stays solid green.  
- B: dashed whenever a subset is set and we are not beat looping (idle green dashed as a preview, and magenta dashed while looping).  
*Recommend A* because it matches the first sentence. B is one extra CSS line.

**Q4. Default and behavior of the flag.**  
(a) *Recommend* the Practice List defaults to hidden, so existing wizard Songs look the same until the User opts in. (b) In strict or none mode, `/vtwp` and friends still record the flag, with no visible effect. *Recommend* they show a short result message ("Practice list is available in wizard mode") and still store the flag.

**Q5. Fix the `Layout.screen` aliasing (F3)?**  
It is a one-line re-link in the constructor. Without it, per-screen toggles on a loaded Song can be lost, including the new flag. *Recommend yes*, with a test.

**Q6. Placement.**  
Above `#topControlsCaptions` (Song Caption row), below the quick menu, outside `.container`, with `max-height: 40vh` scrolling. In fullscreen it pushes the tables down when shown, and it is toggleable. OK? Should clicking a Section link auto-hide it? *Recommend no.*

**Q7. Rename `filterStrictLoopSectionIndex` and its option, no alias.**  
This matches the repo's no-legacy rule. OK?

**Q8. IncludeInLooping stays transient in wizard mode** (not persisted in the Song or browser storage, reset on Song load), the same as strict. Confirm.

Notes (no action unless you disagree):
- Starting a loop from a Section that is not included plays that Section once, then jumps to the next included one. This is today's strict behavior.
- With Random loop, the filter moves forward from the random pick to the next included Section. This is today's strict behavior.
- Wizard Done and Bookmark progress is not shown as library badges, since `getProgressBadgeModel` is strict-only.
