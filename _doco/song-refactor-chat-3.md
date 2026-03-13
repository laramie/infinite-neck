# Song / Looper Refactor — Handoff Notes (Chat 3)

_Continuation from song-refactor-chat-2.md_
_State as of 2026-03-12 — 126/126 tests green, 4 suites_

---

## What Just Landed (this chat)

| Stage | Summary | Status |
|-------|---------|--------|
| 16 | Looper toggle / restart headless-testable | ✅ done |
| 17 | Default looper providers jQuery/window-safe | ✅ done |
| — | `@n` PREVIOUS_PLAYED random-section history in Song | ✅ done |
| — | History cap set to 16 (long-running / all-day safety) | ✅ done |
| — | Debug `console.log` cleanup — hot-loop paths nuked | ✅ done |

---

## Codebase State

### looper.js
- Full injectable-provider pattern complete — **zero** direct `$()`, `window.setInterval`, or `window.clearTimeout` calls in logic paths
- `createDefaultLooperProviders()` factory with `hasJQuery()`, `getButtonCaption()`, `setButtonState()` safe helpers
- Exports: `setLooperProviders`, `toggleLoopSections`, `restartLoopSections`, `toggleLoopBeats`, `sectionsLooping`, `beatsLooping`, `tickBeat`, `__resetLooperForTests`, `__resetLooperProvidersForTests`

### song.js
- `RANDOM_SECTION_HISTORY_MAX = 16`
- `randomSectionHistory: []` — initialized in obj literal and `initializeSongState()`
- `pushRandomSectionHistory(idx)` — validates, pushes, splices to cap
- `getPreviousPlayedSectionIndex(nBack, fallbackIndex)` — safe n-back lookup with fallback
- `gotoNextSection` — records `prevSectionIdx` before random jump
- `getRelativeSectionWithWrap` `Direction.PREVIOUS_PLAYED` case — now uses history (was TODO / falling through)
- **Console logs retained** (intentional): line 256 headless banner (quiet-guarded), line 297 test helper (explicit opt-in)
- Hot-loop logs removed: EventBus trace x2, random-tick log, blob-save log, tuning-fallback log
- Upgraded to `console.warn`: getBeats guard, deleteBeat guard, deleteCurrentSection guard, file-type guard

### infinite-neck.js
- Removed: `console.log("saved Blob:...")` (line was 659)
- Upgraded: `console.log("File not supported!...")` → `console.warn`
- Removed: `console.log("showDefaultTuning because file load found none")`

### Test files
- `_tests/jest/looper.test.js` — 13 tests, 4 describe blocks
- `_tests/jest/song-api-load.test.js` — 56 tests, includes 3 new random-history tests

---

## Key Patterns / Rules to Remember

- **ESM Jest**: always `import { jest } from '@jest/globals'` in test files
- **EventBus guard**: any headless test that calls `gotoNextSection` / `gotoPrevSection` must mock EventBus:
  ```js
  jest.spyOn(EventBus, 'trigger').mockImplementation(() => {});
  ```
- **Looper interval isolation**: toggle/restart suite requires `beforeEach(() => __resetLooperForTests())`
- **Song construction**: `makeSong()` returns `new Song()` which `Object.assign`s from `makeSongLegacy()`

---

## The Big Vision (Next Feature)

**Goal: Guitar Hero / Synthesia-style look-ahead + look-back**

Show multiple Sections simultaneously on-screen around the current play position:

```
[ @2 back ] [ @1 back ] [ >>> NOW <<< ] [ +1 ahead ] [ +2 ahead ]
```

- The `@n` PREVIOUS_PLAYED history we just built is the **look-back engine**
- Look-ahead needs a symmetric read-forward pass from Song (read-only, no state mutation)
- NoteTable views would each receive a section index and render independently
- Candidate new Song API: `getPreviousPlayedSectionIndices(count)` — returns last N history indices as array (pitched but not yet accepted)
- Look-ahead counterpart: `getLookAheadSectionIndices(count)` — returns next N section indices from current position respecting FORWARD/RANDOM mode

### Suggested next stages
1. `getPreviousPlayedSectionIndices(count)` batch getter + test
2. `getLookAheadSectionIndices(count)` — FORWARD and RANDOM variants (random = speculative, non-mutating)
3. NoteTable multi-instance wiring (UI layer, out of scope for this refactor track but enabled by it)

---

## Test Run Snapshot
```
Test Suites: 4 passed, 4 total
Tests:       126 passed, 126 total
Time:        ~2.7s
```

Run with: `npm test -- --runInBand`

---

_Enjoy the pizza. The codebase will be here when you get back._
