I have the scope. I’m turning it into a concrete plan centered on a looper-owned helper plus a single replay call site, and I’ll call out the broader command surface that will inherit the new behavior.**Plan**
1. Add a looper-owned helper in looper.js named `notifySectionRestartIfLooping()`.
   The helper should:
   - read current loop state using the existing `sectionsLooping()` and `beatsLooping()` logic in looper.js
   - no-op if neither loop mode is active
   - no-op if there is no current song
   - emit `DaCapo:OnSectionBegin` with the same payload shape already used by looper start/wrap code in looper.js and looper.js

2. Reuse the existing looper event payload shape instead of inventing a new one.
   That means the helper should emit:
   - `sectionIndex`
   - `sectionCount`
   - `beat`
   - `beats`
   using the current song/section state after the restart target has been moved to beat 1 or section 1.

3. Call the helper from the replay path in infinite-neck.js, not from each individual command case.
   The best single insertion point is `clearAndReplaySection()` in infinite-neck.js, because that is already the shared replay mechanism for:
   - `/rbf` via `gotoFirstBeat` in key-handlers.js
   - `/rs0` via `firstSection` in key-handlers.js
   - and several adjacent navigation/replay actions that currently reuse the same path

4. Place the helper call after beat reset and UI clear, but before replay-dependent refresh work.
   The ordering to validate during implementation is:
   - `gotoFirstBeat()`
   - `clearAll()`
   - `notifySectionRestartIfLooping()`
   - `resetNoteNames()`
   - `updateSectionsStatus()`
   - `showBeats()`
   The reason for this order is that plugins responding to `DaCapo:OnSectionBegin` may regenerate notes or request UI refresh, and you do not want `clearAll()` to immediately wipe out what the plugin just recreated.

5. Do not change the existing loop start behavior for `/rl` and `/re`.
   `startLoopSections()` and `startLoopBeats()` already emit `DaCapo:OnSectionBegin` in looper.js and looper.js. The plan should leave those unchanged and only close the explicit replay gap.

6. Expect broader behavior than just `/rbf` and `/rs0`, and confirm that it is acceptable before coding.
   Because the helper would be called from `clearAndReplaySection()`, this will also affect any other action that reaches that function while looping is active, including:
   - `lastSection`
   - `gotoFirstBeat`
   - some section navigation paths that trigger replay indirectly through Song.js and Song.js
   If the intended behavior is truly “any explicit replay/restart while looping counts as a fresh section begin,” this is correct. If the intent is only `/rbf` and `/rs0`, then the call site should move back to key-handlers.js and key-handlers.js instead.

7. Keep reset behavior unchanged unless testing shows a duplicate-event problem.
   `resetSong` and `resetSongHard` already restart the prior loop mode through `restartLoopSections()` or `restartLoopBeats()` in key-handlers.js, which leads back into the existing looper start emissions in looper.js and looper.js.
   The plan should not add a second explicit begin emission to the reset path unless tests prove there is still a gap.

8. Add focused tests in the existing looper and key-handler suites.
   Test coverage should include:
   - helper emits nothing when both loop modes are off
   - helper emits exactly one `DaCapo:OnSectionBegin` when section looping is on
   - helper emits exactly one `DaCapo:OnSectionBegin` when beat looping is on
   - `/rbf` emits `DaCapo:OnSectionBegin` when loop sections is active
   - `/rbf` emits `DaCapo:OnSectionBegin` when loop beats is active
   - `/rs0` emits `DaCapo:OnSectionBegin` when loop sections is active
   - `/rs0` emits `DaCapo:OnSectionBegin` when loop beats is active
   - `/rbf` and `/rs0` do not emit it when no loop mode is active
   Likely files:
   - looper.test.js
   - key-handlers.test.js

9. Run the command-menu validator and the focused Jest suites after implementation.
   Validation target:
   - no menu wiring changes expected
   - no behavior regressions in existing looper/plugin tests
   - new replay tests confirm the event gap is closed

**Scope**
- Code changes:
  - looper.js
  - infinite-neck.js
  - possibly no changes needed in key-handlers.js if the shared replay insertion point is accepted
- Test changes:
  - looper.test.js
  - key-handlers.test.js

**Main Risk**
The main risk is not technical complexity. It is behavioral breadth: putting the helper in `clearAndReplaySection()` will likely make more replay-style commands count as a fresh section begin while looping, not just `/rbf` and `/rs0`.

**Recommendation**
Proceed with the shared replay insertion point in infinite-neck.js if the design intent is “manual replay while looping should be semantically equivalent to a fresh loop of the current section.” If that intent is narrower, the same helper should still be added in looper.js, but called only from the two specific command handlers.