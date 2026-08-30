# 142-plan: centralize LOOP button caption/latching

Sprint index: [sprint planning index](../../../lifecycle/sprints.md)
Sprint doc: [sprint-142.md](sprint-142.md)
Design doc: [142-design.md](142-design.md)

This is a **plan only** — no code changes are made in this document.

## 1. Root-cause summary

Investigating the current code turned up three distinct, separable problems, not one:

1. **Quick-menu buttons aren't wired into the shared class hooks.**
   [index.html](../../../../index.html) defines `#quickLoopToggle` and `#quickBeatLoopToggle` with only
   `class="MenuButton BtnPunchedOut"` — neither carries `classLoopSections` / `classLoopBeats`, which is the
   selector every other caption/latch update already targets
   ([infinite-neck.js#L3360-L3377](../../../../infinite-neck.js#L3360-L3377),
   [infinite-neck.js#L4611-L4630](../../../../infinite-neck.js#L4611-L4630)). That's why those two buttons never
   get a caption or `ButtonOn` styling — it's a markup omission, not a logic bug.

2. **Caption/latch application is duplicated across four call sites** in
   [infinite-neck.js](../../../../infinite-neck.js), all reacting to the same underlying state
   (`sectionsLooping()` / `beatsLooping()` in [looper.js](../../../../looper.js)):
   - `showLoopSectionsStarted()` / `showLoopSectionsStopped()` (~L3360-3377)
   - the inline `EventBus.on('Looper:OnLoopBeatsStart'/'OnLoopBeatsStop', ...)` handlers (~L4611-4623)
   - `refreshTutorialLoopCaption()` (~L572-585), a bolt-on that recomputes a *different* caption
     (via [Tutorial.js#getLoopCaptionModel](../../../../Tutorial.js)) whenever the tutorial's
     "include in looping" checkboxes change, bypassing the EventBus entirely and calling
     `showLoopSectionsStarted()` directly.

   None of these four sites know about each other's caption logic. `looper.js` emits a `caption` string
   (`"LOOPING..."` / `"RANDOM...."`) that only accounts for `song.randomLoop`; `getLoopCaptionModel()`
   only accounts for partial-section-inclusion (`"LOOPING 2..5"`); nothing combines the two. This is the
   direct cause of the design doc's complaint that random-loop and partial-section-loop captions don't
   compose.

3. **The tutorial prompt is fully re-rendered on every section change, wiping out any caption/class that
   was applied out-of-band.** `syncSectionUi()` calls `renderTutorialPrompt()` on every navigation
   ([infinite-neck.js#L753-761](../../../../infinite-neck.js#L753-761)), which calls
   `TutorialPromptBuilder.renderToDest()` → `renderTutorialPrompt()` in
   [tutorial.builder.js](../../../../templates/tutorial/tutorial.builder.js). That function rebuilds the
   `.tutorialLOOP` / `.tutorialLoopBeats` buttons from a static template string (`LOOP`, `&infin;`) with no
   knowledge of current loop-active state at all. Any `ButtonOn`/caption previously poked onto those
   elements via jQuery is destroyed the moment the user moves to another Section — this is exactly the
   "reverts and is not displayed correctly on Section change" symptom in the design doc.

The good news: the actual state machine (`looper.js` — `sectionsLooping()`/`beatsLooping()`, the
`Looper:OnLoop*Start/Stop` events) and the entry points (keyboard, quick menu, transport buttons, tutorial
buttons, `TransportController`, `key-handlers.js`) are already a single, clean choke point. The mess is
entirely in the **presentation/DOM layer**, so we can fix this without touching the looping state machine.

## 2. Design principle: one caption authority, one DOM-application function

- **Caption text** stays a pure, DOM-free calculation in [Tutorial.js](../../../../Tutorial.js), since
  `getLoopCaptionModel()` already lives there and is already unit-tested
  ([_tests/jest/tutorial.test.js](../../../../_tests/jest/tutorial.test.js)). Extend its signature to also
  fold in `random`, so it becomes the *only* place that knows how to combine "random" + "partial section
  range" + "plain looping" into one string. This removes the need for `looper.js` to know or emit any
  caption text at all.

- **DOM application** (setting `.html()`/caption text and toggling `ButtonOn` on every button that
  represents a given loop kind) becomes exactly two small functions in
  [infinite-neck.js](../../../../infinite-neck.js), replacing the four scattered call sites in §1.2:
  - `applyLoopSectionsUi(active)`
  - `applyLoopBeatsUi(active)`

  Each is the single place that touches `#btnLoopSections`/`.classLoopSections` or
  `#btnLoopBeats`/`.classLoopBeats`, and each is the single place that triggers
  `Widget:SectionStatus:loopChanged`. `showLoopSectionsStarted`/`Stopped`, the two inline
  `Looper:OnLoopBeatsStart/Stop` handlers, and `refreshTutorialLoopCaption()` are retired in favor of calling
  these two functions from every relevant trigger point:
  1. `EventBus.on('Looper:OnLoopSectionsStart'/'OnLoopSectionsStop', ...)`
  2. `EventBus.on('Looper:OnLoopBeatsStart'/'OnLoopBeatsStop', ...)`
  3. `tutorialToggleIncludeInLooping()` / `tutorialToggleAllIncludeInLooping()` (whenever the included-section
     set changes while a loop is already running)

- **Tutorial prompt re-render bug (§1.3) gets fixed at the source, not patched around.** Rather than relying
  on a later jQuery mutation to "fix up" the freshly-rendered markup, `buildTutorialPromptModel()` /
  `renderTutorialPrompt()` in [tutorial.builder.js](../../../../templates/tutorial/tutorial.builder.js) take
  two additional inputs — `sectionsLoopActive` and `beatsLoopActive` (plus whatever `getLoopCaptionModel()`
  needs) — supplied by `infinite-neck.js` at call time from `sectionsLooping()`/`beatsLooping()`. The
  generated `.tutorialLOOP`/`.tutorialLoopBeats` button markup then bakes in the correct caption text and
  `ButtonOn` class as part of the template string itself, so a section-navigation re-render can never regress
  to a stale "LOOP"/unstyled state — there is no more "later mutation" for it to lose.

This keeps the existing architectural split intact (state in `looper.js`, pure calculation in `Tutorial.js`,
DOM binding in `infinite-neck.js`/`tutorial.builder.js`) and simply removes the duplication and the
render-order race, matching the "elegant, keep the current architecture" ask in the design doc.

## 3. Specific fixes

### 3a. Quick-menu buttons (markup only)
Add `classLoopSections` to `#quickLoopToggle` and `classLoopBeats` to `#quickBeatLoopToggle` in
[index.html](../../../../index.html) (~L101-102). No JS changes needed here — `bindDesktopEvents()`
already wires both buttons to `runActionByName('toggleLoopSections'/'toggleLoopBeats')`
([infinite-neck.js#L3808-3813](../../../../infinite-neck.js#L3808-3813)), and once the shared classes are
present, `applyLoopSectionsUi()`/`applyLoopBeatsUi()` will style them automatically along with every other
LOOP button.

### 3b. Consolidate caption/latch application
Replace `showLoopSectionsStarted()`, `showLoopSectionsStopped()`, the two inline
`Looper:OnLoopBeatsStart`/`OnLoopBeatsStop` handlers, and `refreshTutorialLoopCaption()` in
[infinite-neck.js](../../../../infinite-neck.js) with `applyLoopSectionsUi(active)` /
`applyLoopBeatsUi(active)`. Each function:
- computes the caption (sections: via extended `getLoopCaptionModel({ looping, random: getSong().randomLoop,
  includeInLoopingSectionIndexes, sectionCount })`; beats: fixed `"LOOPING..."` text, no partial-section
  concept applies there),
- sets the caption and toggles `ButtonOn` on `#btnLoopSections`/`.classLoopSections` or
  `#btnLoopBeats`/`.classLoopBeats`,
- triggers `Widget:SectionStatus:loopChanged` with `{ isLoopActive: active }` as today.

### 3c. Random + partial-section caption composition
Extend `Tutorial.js#getLoopCaptionModel()` to accept a `random` flag and produce a combined string (e.g.
`"RANDOM 2..5...."`) when both a random loop and a partial section-inclusion set are active, instead of the
two concerns being computed independently in two different files.

### 3d. Retire the caption payload out of `looper.js`
Once `infinite-neck.js` fully owns caption computation via `getLoopCaptionModel()`, the `caption` field
`looper.js` currently builds and sends on `Looper:OnLoopSectionsStart`
(`LOOPING_FRAMES_CAPTION`/`LOOPING_FRAMES_CAPTION_RANDOM`, [looper.js#L37-40](../../../../looper.js#L37-40),
[looper.js#L228-238](../../../../looper.js#L228-238)) becomes dead weight — the presenter recomputes it fully
from state it already needs to read. Per the repo's "no legacy paths" SOP, remove the `caption` payload and
those two constants from `looper.js` entirely rather than leaving an unused/duplicate code path — `looper.js`
should only be responsible for looping state transitions and emitting bare start/stop events, not caption
text.

### 3e. Tutorial prompt render-time correctness
`buildTutorialPromptModel()` gains `sectionsLoopActive`/`beatsLoopActive` (and the caption string) as inputs;
`renderTutorialPrompt()` in [tutorial.builder.js](../../../../templates/tutorial/tutorial.builder.js) uses
them to bake the right class/caption into the `.tutorialLOOP`/`.tutorialLoopBeats` button markup at
generation time (see §2, third bullet). `infinite-neck.js`'s `renderTutorialPrompt()` wrapper
(~L559-568) passes `sectionsLooping()`/`beatsLooping()` through alongside the existing `song`/`progress`/
`includeInLoopingSectionIndexes` options.

## 4. Call-site inventory (for the implementer)

All known entry points that must keep working, unchanged, after this refactor (none of these need to change
— they already funnel into `looper.js`'s `toggleLoopSections()`/`toggleLoopBeats()`, which is the correct
single choke point for state):
- Transport panel: `#btnLoopSections`, `#btnLoopBeats`
  ([infinite-neck.js#L3868-3871](../../../../infinite-neck.js#L3868-3871))
- Quick menu: `#quickLoopToggle`, `#quickBeatLoopToggle`
  ([infinite-neck.js#L3808-3813](../../../../infinite-neck.js#L3808-3813))
- Tutorial prompt buttons: `.tutorialLOOP`/`.tutorialLoopBeats` → `tutorialLoopSections()`/
  `tutorialLoopBeats()` ([infinite-neck.js#L639-644](../../../../infinite-neck.js#L639-644))
- Keyboard shortcuts: `"l"` and `"B"` cases in
  [key-handlers.js](../../../../key-handlers.js) (~L492, ~L543)
- Action system: `"toggleLoopSections"`/`"toggleLoopBeats"` cases in
  [key-handlers.js](../../../../key-handlers.js) (~L1037-1041), used by
  [transport-controller.js](../../../../transport-controller.js) `toggleLoopSections()`/`toggleLoopBeats()`

## 5. Suggested iteration breakdown

- **Iteration 2** — Extend `Tutorial.js#getLoopCaptionModel()` to accept `random`; update/add Jest cases in
  [_tests/jest/tutorial.test.js](../../../../_tests/jest/tutorial.test.js).
- **Iteration 3** — Introduce `applyLoopSectionsUi()`/`applyLoopBeatsUi()` in `infinite-neck.js`; rewire the
  four existing call sites (§1.2) to use them; update
  [_tests/jest/looper.test.js](../../../../_tests/jest/looper.test.js) expectations that reference the old
  `caption` event payload.
- **Iteration 4** — Thread `sectionsLoopActive`/`beatsLoopActive` into `buildTutorialPromptModel()` /
  `renderTutorialPrompt()` in `tutorial.builder.js` so section navigation no longer regresses the tutorial
  LOOP buttons.
- **Iteration 5** — Add `classLoopSections`/`classLoopBeats` to the quick-menu buttons in `index.html`
  (markup-only change).
- **Iteration 6** — Remove the now-dead `caption` payload and `LOOPING_FRAMES_CAPTION*` constants from
  `looper.js` (no-legacy cleanup per repo SOP).
- **Iteration 7** — Manual UI acceptance pass (per repo convention, browser/latching behavior is verified via
  UI acceptance testing, not Jest): confirm caption + `ButtonOn` styling stay correct across quick menu,
  transport panel, and tutorial buttons; confirm state survives Next/Prev/First/Last section navigation while
  a loop (including a partial-section loop) is active; confirm combined random + partial-section captions
  read sensibly.

## 6. Explicitly out of scope

- No change to `looper.js`'s state machine, timing providers, or `EventBus` event names.
- No change to how any button *starts/stops* a loop (all existing entry points keep calling the same
  `toggleLoopSections()`/`toggleLoopBeats()`/`TransportController` methods).
- `Widget:SectionStatus:loopChanged` payload shape is left as `{ isLoopActive }` for now; passing the
  computed caption through to `section-status.builder.js` as well is a reasonable future enhancement but
  isn't needed to fix the two reported bugs, so it's not included here.
