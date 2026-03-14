- Babel viability scanner: node bin/babel-viability-scan.cjs
- Default npm scan excludes generated output path bin/namespacer/data/out.
- Full scan with generated files: npm run -s scan:babel:all
- Reports write to _TEMP_ONLY; default and all-files runs now use different filenames.
- ripgrep (rg) may be unavailable in this environment; use grep fallback when needed.
- Shell history expansion can break node -e snippets containing '!'; avoid '!' in inline JS conditions.
- Dependency map command: npm run -s scan:deps
- Dependency reports: _TEMP_ONLY/module-dependency-map.json and _TEMP_ONLY/module-dependency-map.md
- Current root graph (28 files) has 1 large cycle spanning core UI modules.


- Provider-injection wiring in infinite-neck.js can hit TDZ at module init for export const symbols (e.g., cycleThruNutWidths); pass lazy wrapper functions in provider maps to avoid early access.
- Key-handler decoupling now uses setKeyHandlerProviders in key-handlers.js, wired from infinite-neck.js.


- Opacity range sliders in index.html should avoid inline onChange handlers; use delegated jQuery events in infinite-neck.js because module exports are not reliably global for inline HTML callbacks.
- Function symbols reset bug: getSong().noteNamesFuncArrDEFAULT must exist on Song; reset/catch paths should clone defaults, and notetable cellBuilder should fallback if noteNamesFuncArr is missing to prevent undefined index crashes.
- First class migration step: song.js now exports class Song that Object.assigns legacy factory output; makeSong() returns new Song() while legacy behavior remains intact.



- Looper headless refactor: looper.js exports tickBeat(song, { sectionsLooping, showBeats }); interval handler delegates to it for DOM-free unit tests.
- Loop-state checks now run through looper providers (getLoopSectionsCaption/getLoopBeatsCaption), allowing sectionsLooping()/beatsLooping() tests without jQuery.
- In this repo's ESM Jest setup, tests that use mocks should import { jest } from '@jest/globals'.

- Looper has module-scoped interval pointer; headless Jest tests should call __resetLooperForTests() in beforeEach to avoid cross-test leakage.

- Stage 17 looper hardening: default looper providers are now runtime-safe without jQuery/window (caption fallbacks + guarded timer wrappers), so sectionsLooping()/beatsLooping() can run headlessly even before test provider injection.

- Implemented @n previous-played semantics in song.js using Song.randomSectionHistory (bounded array, max 256). gotoNextSection records previous index when randomLoop is active; getRelativeSectionWithWrap('@n') reads n-back from that history and falls back to current section when empty/out-of-range.

- Product decision: random section history cap set to 16 (was 256) to support practical "previous pages" chord-context use case; enforced by Jest contract test in song-api-load.test.js.

- Startup tuning query param added in infinite-neck.js: app supports ?tuning=<ID> (e.g., ?tuning=P48), resolved at appInit via getStartupTuningBaseID with fallback to S6.
