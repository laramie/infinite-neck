# Iteration 2: Round 1: stylesheets analysis

User: With this songfile, I have successfully saved my Palette > Customize > Record Stylesheet changes.  When I open the file, I have my custom stylesheet listed.  But I've also dragged in all the stylesheets.  As part of sprint-122 we need to eliminate anything in the songfile that would be created in memory normally from defaults, therefore most of colorDicts is extra and I only need colorDicts["s2Laramie"] because that's the row I saved.  Can you see a simple way to winnow this down?  Analysis only, please, no code changes.

GitHub Copilot: I’m tracing how `colorDicts`, `userColors`, and active stylesheets are reconstructed on load so I can identify which songfile fields are genuinely canonical and which are redundant.

Searched for regex `colorDicts|userColors|activeStylesheets|currentColorDict|prepareForSave` (`**/infinite-neck/**/*.{js,md}`), 89 results

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#850-850), lines 850 to 940

Read [](file:///home/laramie/infinite-neck/Song.js#1-1), lines 1 to 220

Read [](file:///home/laramie/infinite-neck/colorFunctions.js#1-1), lines 1 to 260

I’ve confirmed the split contract: defaults are injected at load time, while save still serializes live merged color state. I’m reading the exact color save/load helpers next to identify the smallest canonical payload that would preserve your recorded stylesheet row without the runtime-expanded defaults.

Read [](file:///home/laramie/infinite-neck/Song.js#950-950), lines 950 to 990

Read [](file:///home/laramie/infinite-neck/colorFunctions.js#260-260), lines 260 to 520

Read [](file:///home/laramie/infinite-neck/_doco/design/sprints/122-persistence/122-persistence-matrix.md#18-18), lines 18 to 60

Read [](file:///home/laramie/infinite-neck/userColors.js#1-1), lines 1 to 260

I have enough to see the broad shape, but I want one more pass on whether `currentColorDict` or `userColors` is actually required to restore the recorded stylesheet row and selection state.

Searched for regex `currentColorDict|userColors` (`**/infinite-neck/**/*.{js}`), 19 results

Searched for regex `buildUserColors\(|recordUserColorsBoth\(|applyStylesheetsTo_gUserColorDict\(` (`**/infinite-neck/colorFunctions.js`), no results

Read [](file:///home/laramie/infinite-neck/colorFunctions.js#520-520), lines 520 to 795

The remaining ambiguity is selection state. I’m checking where `currentColorDict` is consumed, because that determines whether a minimal songfile can keep only the saved row or also needs a single pointer to reselect it on load.

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#1648-1648), lines 1648 to 1730

I can see the likely minimal contract now. I’m pulling exact line locations so the analysis can be precise about what is already derived, what is redundant, and the one caveat around stylesheet selection state.

Searching for regex `export function recordUserColorsBoth|export function applyStylesheetsTo_gUserColorDict|export function calculateActiveStylesheets|export function buildColorDicts|export function chuseStylesheet` (`**/infinite-neck/colorFunctions.js`)

Searching for regex `export function updateAfterOpenSong|export function installDefaultColorDicts|prepareForSave\(` (`**/infinite-neck/infinite-neck.js`)

Searching for regex `prepareForSave\(|this.userColors = userColors|getPersistentSongFile\(` (`**/infinite-neck/Song.js`)

Searching for regex `persistentSongFileReplacer|key === 'fretLengths'|key === 'userInstrumentTuning'` (`**/infinite-neck/SongPersistence.js`)

The search timed out on broad patterns. I’m retrying with narrow exact lookups so I can cite the specific save/load hooks cleanly.

Searched for text `recordUserColorsBoth` (`**/infinite-neck/colorFunctions.js`), no results

Searched for text `applyStylesheetsTo_gUserColorDict` (`**/infinite-neck/colorFunctions.js`), no results

Searched for text `calculateActiveStylesheets` (`**/infinite-neck/colorFunctions.js`), no results

Searched for text `buildColorDicts` (`**/infinite-neck/colorFunctions.js`), no results

Searched for text `chuseStylesheet` (`**/infinite-neck/colorFunctions.js`), no results

I have the behavior pinned down already; this last lookup is just to get cleaner line anchors in the files before I summarize the winnowing options.

Searched for text `recordUserColorsBoth` (`**/colorFunctions.js`), 5 results

Searched for text `applyStylesheetsTo_gUserColorDict` (`**/colorFunctions.js`), 6 results

Searched for text `buildColorDicts` (`**/colorFunctions.js`), 7 results

Searched for text `chuseStylesheet` (`**/colorFunctions.js`), 2 results

Searched for text `calculateActiveStylesheets` (`**/colorFunctions.js`), 2 results

I’ve got the exact anchors now. One more quick lookup on the save/load side, then I’ll give you the cleanest no-code recommendation for slimming the songfile.

Searched for text `updateAfterOpenSong` (`**/infinite-neck.js`), 2 results

Searched for text `installDefaultColorDicts` (`**/infinite-neck.js`), 4 results

Searched for text `prepareForSave({ visibleTableIds, songName, theme, bpm, userColors, plugins })` (`**/Song.js`), 1 result

Searched for text `persistentSongFileReplacer` (`**/SongPersistence.js`), 1 result

Searched for text `this.userColors = userColors` (`**/Song.js`), 1 result

Yes. There is a simple winnowing path, and your example file already shows why it should work.

What the code is doing now:

1. On song load, the app recreates the built-in stylesheet rows in memory every time.
   See infinite-neck/infinite-neck.js and infinite-neck/infinite-neck.js.

2. The recorded stylesheet row you created from Palette is a song-owned row inside Song.colorDicts.
   That row is created in infinite-neck/colorFunctions.js.

3. The live merged palette is rebuilt from checked stylesheet rows.
   That merge happens in infinite-neck/colorFunctions.js.

4. The Active Stylesheets summary is recalculated from the checked rows.
   That happens in infinite-neck/colorFunctions.js and infinite-neck/colorFunctions.js.

5. Save still writes the live merged userColors snapshot into the Song model.
   See infinite-neck/Song.js and infinite-neck/Song.js.

6. The current replacer is not filtering out either colorDicts or userColors.
   See infinite-neck/SongPersistence.js.

What that means for your s2laramie file:

1. The built-in rows under colorDicts are redundant.
   All-Clear, CycleOfColors, Roles, Fingerings, and Default are recreated in memory by installDefaultColorDicts on load, so they do not need to live in the songfile.

2. The custom row s2Laramie is the only user-authored row in colorDicts.
   That is the row you actually need to preserve.

3. The userColors block is also redundant for the current load contract.
   It is just the merged runtime result. The app does not have a clear hydration path that treats userColors as the canonical source. The sprint-122 notes already call this out as inconsistent in infinite-neck/_doco/design/sprints/122-persistence/122-persistence-matrix.md.

4. activeStylesheets is derived noise.
   It is recalculated from checked colorDict rows, so persisting it is duplication. The sprint notes say the same in infinite-neck/_doco/design/sprints/122-persistence/122-persistence-matrix.md.

The simplest winnowing rule:

1. Keep only user-authored stylesheet rows in colorDicts.
   In practice, that means keep only rows where readOnly is false and computed is false.
   In your attached file, that means keeping only s2Laramie.

2. Keep the checked flag on that user-authored row.
   The merge logic depends on checked when rebuilding the active palette.

3. Drop userColors.
   It is a runtime-expanded result, not a good canonical payload.

4. Drop activeStylesheets.
   It can be recomputed.

Why this is defensible:

1. The runtime already owns the built-in stylesheet library.
   Sprint-122 explicitly says Song.colorDicts should not be persisted wholesale because it contains runtime-expanded default state. See infinite-neck/_doco/design/sprints/122-persistence/122-persistence-matrix.md.

2. Your custom stylesheet row is already the right granularity.
   It is the user-owned delta.

3. For your specific example, s2Laramie is sparse and only overrides note12.
   That is fine because Default and the other built-ins are always injected on load, so the sparse row can still merge on top of the rebuilt defaults.

The one caveat:

1. If you care about exact stylesheet ordering or preserving unchecked built-in rows as a first-class song contract, the current code does not really define that cleanly.
   Defaults are reinstalled on load, and selection/order is still somewhat UI-driven.
   So slimming the file to only user rows is consistent with sprint-122, but it also means you are explicitly treating built-in row order and built-in checked-state as runtime behavior, not persisted song content.

My conclusion:

1. Yes, there is a simple way to winnow it down.
2. The clean minimal payload is:
   colorDicts containing only user-created rows like s2Laramie.
3. userColors and activeStylesheets look redundant under the current design.
4. That matches the sprint-122 direction already documented in infinite-neck/_doco/design/sprints/122-persistence/122-persistence-matrix.md.

No code changes made.

# Iteration 2: Round 2: fix filter

User: So just changing persistentSongFileReplacer() to persist colorDicts but replace (remove) userColors, we can still round-trip.  What is the best place to filter userColors for just the ones the user added?  I see there are a number of options on the objects in userColors.js to help us sort this out (readOnly, computed).  

GitHub Copilot: I’m checking one narrow thing before answering: whether the `readOnly` and `computed` flags help at the merged `userColors` level, or only while the data is still organized as stylesheet rows.

Read [](file:///home/laramie/infinite-neck/userColors.js#1-1), lines 1 to 220

Read [](file:///home/laramie/infinite-neck/colorFunctions.js#102-102), lines 102 to 205

Read [](file:///home/laramie/infinite-neck/SongPersistence.js#60-60), lines 60 to 90

Short answer: the best place is not in userColors at all.

Why:

1. By the time data reaches the merged userColors object, you have already lost provenance.
   In userColors.js, gUserColorDict is just the live merged result.
   In userColors.js, defaults are folded into it with Object.assign from Roles, Fingerings, and CycleOfColors.
   After that merge, an entry like note12 no longer tells you whether it came from a built-in sheet or a user sheet.

2. The flags you noticed are useful one level up, on stylesheet rows, not on merged userColors entries.
   The useful metadata is on objects like gUserColorDictRolesDefault, gUserColorDictFingeringsDefault, gDefault_CycleOfColors, and recorded schemes:
   readOnly, computed, checked.
   But those flags exist on the scheme containers, not on each leaf inside userColors.
   Your recorded user stylesheet is created with readOnly false and computed false in colorFunctions.js.

3. So if the goal is "keep only what the user added", the right source of truth is Song.colorDicts, not Song.userColors.
   That is where the app still knows which rows are built-in versus user-authored.
   See colorFunctions.js and colorFunctions.js.

Best place in the save pipeline:

1. Use SongPersistence.js only to remove whole fields.
   It is a good place to say "drop userColors entirely".
   It is not the best place to derive a canonical subset.

2. Build the filtered subset earlier, where the model still has structure.
   The best spot is the save-facing model step in Song.js, or a dedicated helper called from there.
   Reason:
   - prepareForSave is already where save-owned state gets normalized
   - Song.colorDicts is still intact there
   - you can filter rows by readOnly/computed cleanly there

3. Concretely, the filtering rule belongs on colorDicts rows:
   keep only schemes where readOnly is false and computed is false.
   That preserves user-authored stylesheet rows and discards built-ins.

So my recommendation is:

1. persistentSongFileReplacer should drop userColors wholesale.
2. If you want a filtered persisted stylesheet payload, compute it from Song.colorDicts before stringify.
3. The best home for that logic is Song.prepareForSave or a helper right next to it, not the replacer.

One important nuance:

1. If you literally persist colorDicts as-is and only stop persisting userColors, round-trip can still work.
2. But if you want the cleaner sprint-122 contract, the thing to filter is colorDicts, not userColors.
3. Filtering userColors for "just what the user added" is fundamentally weaker because userColors is already a flattened result.

So the strongest answer is:
1. Drop userColors in SongPersistence.js.
2. Filter user-owned stylesheet rows from Song.colorDicts in Song.js.
3. Do not try to infer user ownership from the merged gUserColorDict in userColors.js.


# Iteration 2: Round 3:  Code changes

User: OK. Two points: 1) we will keep using the song after hitting download, so the runtime should not be disturbed to lose stylesheet info. 2) we would expect that the stylesheets would also be the same on reload and open file.  We tested, and today turning off stylesheets like CycleOfColors via the links on the stylesheets table does not persist, so we would not expect that information to be saved.

With those caveats, can you make a CORE-APPROVED code change to get us to sprint-122 by filtering as you just proposed?  We are checked into git, so if it looks like we are missing something in the stylesheets page we can roll back.

GitHub Copilot: I’m implementing the serialization-only filter now so runtime state stays intact after download, while the saved songfile only keeps user-authored stylesheet rows and drops `userColors`.

Read changed files in [](file:///home/laramie/infinite-neck)

Searched for regex `getPersistentSongFile preserve save-facing V2 fields|persistentSongFileReplacer|colorDicts` (`**/_tests/jest/**/*.js`), 1 result

Read [](file:///home/laramie/infinite-neck/_tests/jest/song-api-load-V2.test.js#1-1), lines 1 to 220

I’ve found the existing save-path test that should carry this contract. Next I’m patching serialization so `colorDicts` is filtered only while stringifying, and then I’ll tighten that test to prove runtime-safe round-trip behavior.

Read [](file:///home/laramie/infinite-neck/_tests/jest/song-api-load-V2.test.js#220-220), lines 220 to 232

I’m editing only the save path now: filtering `colorDicts` during JSON serialization, keeping runtime `song.colorDicts` untouched after download, and adding a regression test that proves built-ins stay alive in memory while only user-authored rows are written.

Generating patch (104 lines) in [](file:///home/laramie/infinite-neck/SongPersistence.js), [](file:///home/laramie/infinite-neck/_tests/jest/song-api-load-V2.test.js)


```

```

```

```
The serialization filter is in place. I’m validating the two edited files and running the focused persistence test file now.

Checked [](file:///home/laramie/infinite-neck/SongPersistence.js), [](file:///home/laramie/infinite-neck/_tests/jest/song-api-load-V2.test.js), no problems found

Ran terminal command:  node --experimental-vm-modules node_modules/.bin/jest _tests/jest/song-api-load-V2.test.js --runInBand

The focused persistence tests passed. I’m running the repo’s full Jest command once because this touches the core song serialization path used across the app.

Ran terminal command:  node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand

The full suite finished; I’m reading the tail of the log to confirm overall pass/fail and make sure there were no save-path regressions hidden in the long output.

Read [](file:///home/laramie/.config/Code/User/workspaceStorage/a4cd8720505ac78a3e21b7b8e5ccf6c7/GitHub.copilot-chat/chat-session-resources/3826ffb4-f3fc-431a-b34e-df64b42351f9/call_3oOmZZ2DO0olA4wZoWRvYiBO__vscode-1780647472680/content.txt#520-520), lines 520 to 570

Read [](file:///home/laramie/.config/Code/User/workspaceStorage/a4cd8720505ac78a3e21b7b8e5ccf6c7/GitHub.copilot-chat/chat-session-resources/3826ffb4-f3fc-431a-b34e-df64b42351f9/call_3oOmZZ2DO0olA4wZoWRvYiBO__vscode-1780647472680/content.txt#570-570), lines 570 to 588

Validation is complete: the full Jest suite passed with the new serialization filter. I’m pulling the exact edit locations so the handoff can point you to the core save-path change and the regression test.

Searched for regex `filterPersistentColorDicts|persistentSongFileReplacer` (`**/SongPersistence.js`), 3 results

Searched for text `getPersistentSongFile keeps runtime stylesheet rows in memory but only saves user-authored colorDicts` (`**/_tests/jest/song-api-load-V2.test.js`), 1 result

The save path now filters stylesheet persistence the way you described, without disturbing runtime state after Download.

What changed:
- SongPersistence.js
  Added `filterPersistentColorDicts(colorDicts)`.
  It keeps only user-authored stylesheet rows, defined as rows where `readOnly` is false and `computed` is false.
- SongPersistence.js
  Updated `persistentSongFileReplacer(...)` so:
  - `userColors` is removed from the saved songfile
  - `colorDicts` is serialized through the new filter
  Because this happens only during `JSON.stringify(...)`, the live `song.colorDicts` object in memory is unchanged after save/download.
- song-api-load-V2.test.js
  Added a regression test that proves:
  - built-in stylesheet rows remain present in runtime memory after `getPersistentSongFile()`
  - only the user-authored row is written into the saved JSON
  - `userColors` is not saved

Why this matches your caveats:
- It does not mutate runtime stylesheet state while the user keeps working after download.
- It preserves user-authored stylesheet rows for round-trip on reload/open.
- It does not try to persist built-in on/off state like `CycleOfColors`, which matches your current expectation.
- It is a narrow, core save-path change rather than a broader stylesheet-page redesign.

Validation:
- Focused test passed:
  `node --experimental-vm-modules jest song-api-load-V2.test.js --runInBand`
- Full suite passed:
  `node --experimental-vm-modules jest _tests/jest/ --verbose --runInBand`
- Result: 36 suites passed, 425 tests passed.

One thing not changed:
- `activeStylesheets` is still persisted as before.
  I left that alone to keep this change minimal and rollback-safe. If you want, the next step would be to trim that derived field too.

Made changes.

# Iteration 2: Round 4: stylesheet row order wrong

User: So on load, the lar4 stylesheet gets loaded into the first row, which fails to do anything because the rules apply from first row down, with lower rows overriding any note role rules in rows above.  So the table should match the code order, so that means the code should make sure that the user added row is last, after Default.

```
<div id="divColorDicts" style="border: 1px solid green;">
                    <div id="divColorDictsDest"><table class="tblColorDicts"><tr><td style="font-weight: bold; vertical-align: bottom; border: 2px solid black; background-color: lightgray;">Stylesheets</td><td class="vertical-header"><span>Scale</span></td><td class="vertical-header"><span>Root</span></td><td class="vertical-header"><span>Chord</span></td><td class="vertical-header"><span>Chord2</span></td><td class="vertical-header"><span>Chord3</span></td><td class="vertical-header"><span>Colornote</span></td><td class="vertical-header"><span>Colornote2</span></td><td class="vertical-header"><span>Colornote3</span></td><td class="vertical-header"><span>Chromatic</span></td><td class="vertical-header"><span>Passing</span></td><td class="vertical-header"><span>Avoid</span></td><td class="vertical-header"><span>Avoid2</span></td><td class="vertical-header"><span>Avoid3</span></td><td class="vertical-header"><span>Bass</span></td><td class="vertical-header"><span>Lead</span></td><td class="vertical-header"><span>Lead2</span></td><td class="vertical-header"><span>Finger0</span></td><td class="vertical-header"><span>Finger1</span></td><td class="vertical-header"><span>Finger2</span></td><td class="vertical-header"><span>Finger3</span></td><td class="vertical-header"><span>Finger4</span></td><td class="vertical-header"><span>FingerT</span></td><td class="vertical-header"><span>1</span></td><td class="vertical-header"><span>2</span></td><td class="vertical-header"><span>3</span></td><td class="vertical-header"><span>4</span></td><td class="vertical-header"><span>5</span></td><td class="vertical-header"><span>6</span></td><td class="vertical-header"><span>7</span></td><td class="vertical-header"><span>8</span></td><td class="vertical-header"><span>9</span></td><td class="vertical-header"><span>10</span></td><td class="vertical-header"><span>11</span></td><td class="vertical-header"><span>12</span></td></tr><tr id="colorDictRowlar4"><td class="userColorResultLinks"><nobr><input id="cbWhichColorDictlar4" type="checkbox" name="cbnWhichColorDict" value="lar4" checked=""><a href="#" class="choose-stylesheet" data-dictkey="lar4">lar4</a><span style="width: 2em;">&nbsp;&nbsp;&nbsp;<a href="#" class="delete-stylesheet" data-dictkey="lar4">⌫</a></span></nobr></td><td from="noteScale">&nbsp;</td><td from="noteRoot">&nbsp;</td><td class="colorDictLinkTD noteHatched4 notePink3" noterole="noteChord">Ch</td><td from="noteChord2">&nbsp;</td><td from="noteChord3">&nbsp;</td><td from="noteColornote">&nbsp;</td><td from="noteColornote2">&nbsp;</td><td from="noteColornote3">&nbsp;</td><td from="noteChromatic">&nbsp;</td><td from="notePassing">&nbsp;</td><td from="noteAvoid">&nbsp;</td><td from="noteAvoid2">&nbsp;</td><td from="noteAvoid3">&nbsp;</td><td from="noteBass">&nbsp;</td><td from="noteLead">&nbsp;</td><td from="noteLead2">&nbsp;</td><td from="noteFinger0">&nbsp;</td><td from="noteFinger1">&nbsp;</td><td from="noteFinger2">&nbsp;</td><td from="noteFinger3">&nbsp;</td><td from="noteFinger4">&nbsp;</td><td from="noteFingerT">&nbsp;</td><td from="note1">&nbsp;</td><td class="colorDictLinkTD noteHatched noteYellow2" noterole="note2">τ</td><td from="note3">&nbsp;</td><td from="note4">&nbsp;</td><td from="note5">&nbsp;</td><td from="note6">&nbsp;</td><td from="note7">&nbsp;</td><td from="note8">&nbsp;</td><td from="note9">&nbsp;</td><td from="note10">&nbsp;</td><td from="note11">&nbsp;</td><td class="colorDictLinkTD noteHatched3 noteRed4" noterole="note12">Δ</td></tr><tr id="colorDictRowAll-Clear"><td class="userColorResultLinks"><nobr>✓&nbsp;<a href="#" class="choose-stylesheet" data-dictkey="All-Clear">All-Clear</a></nobr></td><td class="colorDictLinkTD noteWhite" noterole="noteScale">Sc</td><td class="colorDictLinkTD noteWhite" noterole="noteRoot">R</td><td class="colorDictLinkTD noteWhite" noterole="noteChord">Ch</td><td class="colorDictLinkTD noteWhite" noterole="noteChord2">Ch</td><td class="colorDictLinkTD noteWhite" noterole="noteChord3">Ch</td><td class="colorDictLinkTD noteWhite" noterole="noteColornote">C1</td><td class="colorDictLinkTD noteWhite" noterole="noteColornote2">C2</td><td class="colorDictLinkTD noteWhite" noterole="noteColornote3">C3</td><td class="colorDictLinkTD noteWhite" noterole="noteChromatic">c</td><td class="colorDictLinkTD noteWhite" noterole="notePassing">p</td><td class="colorDictLinkTD noteWhite" noterole="noteAvoid">a1</td><td class="colorDictLinkTD noteWhite" noterole="noteAvoid2">a2</td><td class="colorDictLinkTD noteWhite" noterole="noteAvoid3">a3</td><td class="colorDictLinkTD noteWhite" noterole="noteBass">B</td><td class="colorDictLinkTD noteWhite" noterole="noteLead">L</td><td class="colorDictLinkTD noteWhite" noterole="noteLead2">L2</td><td class="colorDictLinkTD noteWhite" noterole="noteFinger0">F0</td><td class="colorDictLinkTD noteWhite" noterole="noteFinger1">F1</td><td class="colorDictLinkTD noteWhite" noterole="noteFinger2">F2</td><td class="colorDictLinkTD noteWhite" noterole="noteFinger3">F3</td><td class="colorDictLinkTD noteWhite" noterole="noteFinger4">F4</td><td class="colorDictLinkTD noteWhite" noterole="noteFingerT">T</td><td class="colorDictLinkTD noteWhite" noterole="note1">I</td><td class="colorDictLinkTD noteWhite" noterole="note2">τ</td><td class="colorDictLinkTD noteWhite" noterole="note3">II</td><td class="colorDictLinkTD noteWhite" noterole="note4">m</td><td class="colorDictLinkTD noteWhite" noterole="note5">III</td><td class="colorDictLinkTD noteWhite" noterole="note6">IV</td><td class="colorDictLinkTD noteWhite" noterole="note7">Θ</td><td class="colorDictLinkTD noteWhite" noterole="note8">V</td><td class="colorDictLinkTD noteWhite" noterole="note9">σ</td><td class="colorDictLinkTD noteWhite" noterole="note10">6</td><td class="colorDictLinkTD noteWhite" noterole="note11">δ</td><td class="colorDictLinkTD noteWhite" noterole="note12">Δ</td></tr><tr id="colorDictRowCycleOfColors"><td class="userColorResultLinks"><nobr>✓&nbsp;<a href="#" class="choose-stylesheet" data-dictkey="CycleOfColors">CycleOfColors</a></nobr></td><td from="noteScale">&nbsp;</td><td from="noteRoot">&nbsp;</td><td from="noteChord">&nbsp;</td><td from="noteChord2">&nbsp;</td><td from="noteChord3">&nbsp;</td><td from="noteColornote">&nbsp;</td><td from="noteColornote2">&nbsp;</td><td from="noteColornote3">&nbsp;</td><td from="noteChromatic">&nbsp;</td><td from="notePassing">&nbsp;</td><td from="noteAvoid">&nbsp;</td><td from="noteAvoid2">&nbsp;</td><td from="noteAvoid3">&nbsp;</td><td from="noteBass">&nbsp;</td><td from="noteLead">&nbsp;</td><td from="noteLead2">&nbsp;</td><td from="noteFinger0">&nbsp;</td><td from="noteFinger1">&nbsp;</td><td from="noteFinger2">&nbsp;</td><td from="noteFinger3">&nbsp;</td><td from="noteFinger4">&nbsp;</td><td from="noteFingerT">&nbsp;</td><td class="colorDictLinkTD noteBlack" noterole="note1">I</td><td class="colorDictLinkTD notePink3" noterole="note2">τ</td><td class="colorDictLinkTD notePink5" noterole="note3">II</td><td class="colorDictLinkTD noteBlue1" noterole="note4">m</td><td class="colorDictLinkTD noteBlue4" noterole="note5">III</td><td class="colorDictLinkTD noteBrown2" noterole="note6">IV</td><td class="colorDictLinkTD noteRed3" noterole="note7">Θ</td><td class="colorDictLinkTD noteRed2" noterole="note8">V</td><td class="colorDictLinkTD noteYellow2" noterole="note9">σ</td><td class="colorDictLinkTD noteYellow4" noterole="note10">6</td><td class="colorDictLinkTD noteGreen1" noterole="note11">δ</td><td class="colorDictLinkTD noteGreen7" noterole="note12">Δ</td></tr><tr id="colorDictRowRoles"><td class="userColorResultLinks"><nobr>✓&nbsp;<a href="#" class="choose-stylesheet" data-dictkey="Roles">Roles</a></nobr></td><td class="colorDictLinkTD noteBlue2" noterole="noteScale">Sc</td><td class="colorDictLinkTD noteBlack" noterole="noteRoot">R</td><td class="colorDictLinkTD noteRed4" noterole="noteChord">Ch</td><td class="colorDictLinkTD noteRed2" noterole="noteChord2">Ch</td><td class="colorDictLinkTD noteBrown7" noterole="noteChord3">Ch</td><td class="colorDictLinkTD notePink1" noterole="noteColornote">C1</td><td class="colorDictLinkTD notePink2" noterole="noteColornote2">C2</td><td class="colorDictLinkTD notePink3" noterole="noteColornote3">C3</td><td class="colorDictLinkTD noteYellow6" noterole="noteChromatic">c</td><td class="colorDictLinkTD noteBlue4" noterole="notePassing">p</td><td class="colorDictLinkTD noteBlackout1" noterole="noteAvoid">a1</td><td class="colorDictLinkTD noteBlackout2" noterole="noteAvoid2">a2</td><td class="colorDictLinkTD noteBlack noteHatched2" noterole="noteAvoid3">a3</td><td class="colorDictLinkTD noteBassPlayer" noterole="noteBass">B</td><td class="colorDictLinkTD notePink3" noterole="noteLead">L</td><td class="colorDictLinkTD notePink6" noterole="noteLead2">L2</td><td from="noteFinger0">&nbsp;</td><td from="noteFinger1">&nbsp;</td><td from="noteFinger2">&nbsp;</td><td from="noteFinger3">&nbsp;</td><td from="noteFinger4">&nbsp;</td><td from="noteFingerT">&nbsp;</td><td from="note1">&nbsp;</td><td from="note2">&nbsp;</td><td from="note3">&nbsp;</td><td from="note4">&nbsp;</td><td from="note5">&nbsp;</td><td from="note6">&nbsp;</td><td from="note7">&nbsp;</td><td from="note8">&nbsp;</td><td from="note9">&nbsp;</td><td from="note10">&nbsp;</td><td from="note11">&nbsp;</td><td from="note12">&nbsp;</td></tr><tr id="colorDictRowFingerings"><td class="userColorResultLinks"><nobr>✓&nbsp;<a href="#" class="choose-stylesheet" data-dictkey="Fingerings">Fingerings</a></nobr></td><td from="noteScale">&nbsp;</td><td from="noteRoot">&nbsp;</td><td from="noteChord">&nbsp;</td><td from="noteChord2">&nbsp;</td><td from="noteChord3">&nbsp;</td><td from="noteColornote">&nbsp;</td><td from="noteColornote2">&nbsp;</td><td from="noteColornote3">&nbsp;</td><td from="noteChromatic">&nbsp;</td><td from="notePassing">&nbsp;</td><td from="noteAvoid">&nbsp;</td><td from="noteAvoid2">&nbsp;</td><td from="noteAvoid3">&nbsp;</td><td from="noteBass">&nbsp;</td><td from="noteLead">&nbsp;</td><td from="noteLead2">&nbsp;</td><td class="colorDictLinkTD Finger0" noterole="noteFinger0">F0</td><td class="colorDictLinkTD Finger1" noterole="noteFinger1">F1</td><td class="colorDictLinkTD Finger2" noterole="noteFinger2">F2</td><td class="colorDictLinkTD Finger3" noterole="noteFinger3">F3</td><td class="colorDictLinkTD Finger4" noterole="noteFinger4">F4</td><td class="colorDictLinkTD FingerT" noterole="noteFingerT">T</td><td from="note1">&nbsp;</td><td from="note2">&nbsp;</td><td from="note3">&nbsp;</td><td from="note4">&nbsp;</td><td from="note5">&nbsp;</td><td from="note6">&nbsp;</td><td from="note7">&nbsp;</td><td from="note8">&nbsp;</td><td from="note9">&nbsp;</td><td from="note10">&nbsp;</td><td from="note11">&nbsp;</td><td from="note12">&nbsp;</td></tr><tr id="colorDictRowDefault"><td class="userColorResultLinks"><nobr>⇒&nbsp;<a href="#" class="choose-stylesheet" data-dictkey="Default">Default</a></nobr></td><td class="colorDictLinkTD noteBlue2" noterole="noteScale">Sc</td><td class="colorDictLinkTD noteBlack" noterole="noteRoot">R</td><td class="colorDictLinkTD noteRed4" noterole="noteChord">Ch</td><td class="colorDictLinkTD noteRed2" noterole="noteChord2">Ch</td><td class="colorDictLinkTD noteBrown7" noterole="noteChord3">Ch</td><td class="colorDictLinkTD notePink1" noterole="noteColornote">C1</td><td class="colorDictLinkTD notePink2" noterole="noteColornote2">C2</td><td class="colorDictLinkTD notePink3" noterole="noteColornote3">C3</td><td class="colorDictLinkTD noteYellow6" noterole="noteChromatic">c</td><td class="colorDictLinkTD noteBlue4" noterole="notePassing">p</td><td class="colorDictLinkTD noteBlackout1" noterole="noteAvoid">a1</td><td class="colorDictLinkTD noteBlackout2" noterole="noteAvoid2">a2</td><td class="colorDictLinkTD noteBlack noteHatched2" noterole="noteAvoid3">a3</td><td class="colorDictLinkTD noteBassPlayer" noterole="noteBass">B</td><td class="colorDictLinkTD notePink3" noterole="noteLead">L</td><td class="colorDictLinkTD notePink6" noterole="noteLead2">L2</td><td class="colorDictLinkTD Finger0" noterole="noteFinger0">F0</td><td class="colorDictLinkTD Finger1" noterole="noteFinger1">F1</td><td class="colorDictLinkTD Finger2" noterole="noteFinger2">F2</td><td class="colorDictLinkTD Finger3" noterole="noteFinger3">F3</td><td class="colorDictLinkTD Finger4" noterole="noteFinger4">F4</td><td class="colorDictLinkTD FingerT" noterole="noteFingerT">T</td><td class="colorDictLinkTD noteBlack" noterole="note1">I</td><td class="colorDictLinkTD notePink3" noterole="note2">τ</td><td class="colorDictLinkTD notePink5" noterole="note3">II</td><td class="colorDictLinkTD noteBlue1" noterole="note4">m</td><td class="colorDictLinkTD noteBlue4" noterole="note5">III</td><td class="colorDictLinkTD noteBrown2" noterole="note6">IV</td><td class="colorDictLinkTD noteRed3" noterole="note7">Θ</td><td class="colorDictLinkTD noteRed2" noterole="note8">V</td><td class="colorDictLinkTD noteYellow2" noterole="note9">σ</td><td class="colorDictLinkTD noteYellow4" noterole="note10">6</td><td class="colorDictLinkTD noteGreen1" noterole="note11">δ</td><td class="colorDictLinkTD noteGreen7" noterole="note12">Δ</td></tr><tr id="colorDictRow&amp;rArr;&amp;nbsp;Result" class="userColorResultRow" style="height: 3em;"><td class="userColorResultCaption">⇒&nbsp;Result</td><td class="colorDictLinkTD noteBlue2" noterole="noteScale">Sc</td><td class="colorDictLinkTD noteBlack" noterole="noteRoot">R</td><td class="colorDictLinkTD noteRed4" noterole="noteChord">Ch</td><td class="colorDictLinkTD noteRed2" noterole="noteChord2">Ch</td><td class="colorDictLinkTD noteBrown7" noterole="noteChord3">Ch</td><td class="colorDictLinkTD notePink1" noterole="noteColornote">C1</td><td class="colorDictLinkTD notePink2" noterole="noteColornote2">C2</td><td class="colorDictLinkTD notePink3" noterole="noteColornote3">C3</td><td class="colorDictLinkTD noteYellow6" noterole="noteChromatic">c</td><td class="colorDictLinkTD noteBlue4" noterole="notePassing">p</td><td class="colorDictLinkTD noteBlackout1" noterole="noteAvoid">a1</td><td class="colorDictLinkTD noteBlackout2" noterole="noteAvoid2">a2</td><td class="colorDictLinkTD noteBlack noteHatched2" noterole="noteAvoid3">a3</td><td class="colorDictLinkTD noteBassPlayer" noterole="noteBass">B</td><td class="colorDictLinkTD notePink3" noterole="noteLead">L</td><td class="colorDictLinkTD notePink6" noterole="noteLead2">L2</td><td class="colorDictLinkTD Finger0" noterole="noteFinger0">F0</td><td class="colorDictLinkTD Finger1" noterole="noteFinger1">F1</td><td class="colorDictLinkTD Finger2" noterole="noteFinger2">F2</td><td class="colorDictLinkTD Finger3" noterole="noteFinger3">F3</td><td class="colorDictLinkTD Finger4" noterole="noteFinger4">F4</td><td class="colorDictLinkTD FingerT" noterole="noteFingerT">T</td><td class="colorDictLinkTD noteBlack" noterole="note1">I</td><td class="colorDictLinkTD notePink3" noterole="note2">τ</td><td class="colorDictLinkTD notePink5" noterole="note3">II</td><td class="colorDictLinkTD noteBlue1" noterole="note4">m</td><td class="colorDictLinkTD noteBlue4" noterole="note5">III</td><td class="colorDictLinkTD noteBrown2" noterole="note6">IV</td><td class="colorDictLinkTD noteRed3" noterole="note7">Θ</td><td class="colorDictLinkTD noteRed2" noterole="note8">V</td><td class="colorDictLinkTD noteYellow2" noterole="note9">σ</td><td class="colorDictLinkTD noteYellow4" noterole="note10">6</td><td class="colorDictLinkTD noteGreen1" noterole="note11">δ</td><td class="colorDictLinkTD noteGreen7" noterole="note12">Δ</td></tr></table></div>
                    <div class="ActiveStylesheets">Active Stylesheets: Default</div>
                </div>
```

GitHub Copilot: I found the root cause: built-ins are appended after the loaded user rows, so the in-memory object order is wrong on open. I’m patching the default stylesheet install path to rebuild `colorDicts` in code order with built-ins first and user-authored rows last, then I’ll add a regression test for that load contract.

Searched for regex `installDefaultColorDicts\(` (`**/infinite-neck.js`), 4 results

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#975-975), lines 975 to 995

Searched for text `colorDicts` (`**/_tests/jest/*.test.js`), 6 results

I’ve confirmed the central fix point is `installDefaultColorDicts()`. Next I’m checking the cleanest way to test it headlessly before editing, so we cover the exact “user row last after Default” contract.

Searching for regex `export function getSong|export function setupSongTests|export function installDefaultColorDicts` (`**/infinite-neck.js`)

Read [](file:///home/laramie/infinite-neck/infinite-neck.js#130-130), lines 130 to 210

Searching for regex `setupSongTests\(|installDefaultColorDicts\(|getSong\(` (`**/_tests/jest/*.test.js`)

The test hooks are there; the previous search just timed out. I’m retrying with narrower exact searches and then I’ll make the patch and regression test in one pass.

Searched for text `setupSongTests` (`**/infinite-neck.js`), 1 result

Searched for text `installDefaultColorDicts` (`**/_tests/jest/*.test.js`), no results

Searched for text `setupSongTests` (`**/_tests/jest/*.test.js`), 11 results

Read [](file:///home/laramie/infinite-neck/_tests/jest/song-api-more.test.js#1-1), lines 1 to 120

I’ve got a headless test target. I’m checking whether the headless entry re-exports `installDefaultColorDicts()`, so the regression test can exercise the exact load-order helper you’re concerned about.

Searched for text `installDefaultColorDicts` (`**/infinite-neck-headless.js`), no results

Read [](file:///home/laramie/infinite-neck/infinite-neck-headless.js)

I’m applying the load-order fix now: rebuilt runtime `colorDicts` will keep the canonical built-in order and append user-authored rows last, and the regression test will assert that exact key order.

Generating patch (75 lines) in [](file:///home/laramie/infinite-neck/infinite-neck.js), [](file:///home/laramie/infinite-neck/_tests/jest/song-api-more.test.js)


```

```

```

```
The order fix is in place. I’m validating the edited files and running the focused headless test file now.

Checked [](file:///home/laramie/infinite-neck/infinite-neck.js), [](file:///home/laramie/infinite-neck/_tests/jest/song-api-more.test.js), no problems found

Ran terminal command:  node --experimental-vm-modules node_modules/.bin/jest _tests/jest/song-api-more.test.js --runInBand

The focused load-order test passed. I’m running the full Jest suite once more because this changed shared song-load behavior used by both browser and headless flows.

Ran terminal command:  node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose --runInBand

The full suite finished. I’m reading the summary tail to verify the broader app still passes after the load-order rebuild.

Read [](file:///home/laramie/.config/Code/User/workspaceStorage/a4cd8720505ac78a3e21b7b8e5ccf6c7/GitHub.copilot-chat/chat-session-resources/3826ffb4-f3fc-431a-b34e-df64b42351f9/call_XTYxdI7Lviqh9D1pjfPHtf2k__vscode-1780647472700/content.txt#570-570), lines 570 to 589

Everything validated cleanly. I’m pulling the exact changed locations so the handoff can point you straight to the load-order fix and the new regression test.

Searched for regex `export function installDefaultColorDicts|userColorDicts` (`**/infinite-neck.js`), 4 results

Searched for text `installDefaultColorDicts appends user-authored stylesheets after Default` (`**/_tests/jest/song-api-more.test.js`), 1 result

The load-order problem is fixed.

What changed:
- infinite-neck.js
  `installDefaultColorDicts()` no longer appends built-ins into whatever order happened to be loaded from the songfile.
  It now:
  1. extracts any existing user-authored stylesheet rows
  2. rebuilds `song.colorDicts` in canonical order:
     `All-Clear`, `CycleOfColors`, `Roles`, `Fingerings`, `Default`
  3. appends user-authored rows after `Default`

That gives you the runtime order you wanted:
- built-ins first
- `Default` before user rows
- user rows last, so they can override lower-priority rules

Why this addresses your example:
- Before, loading a file with only `lar4` in persisted `colorDicts` meant `lar4` was inserted first, then the built-ins were appended after it.
- Since stylesheet application walks object order, later rows won, so `lar4` lost.
- Now `lar4` is reattached after `Default`, so it remains the last overriding row.

Regression test:
- song-api-more.test.js
  Added a headless test asserting that after `installDefaultColorDicts()` the key order is exactly:
  `All-Clear`, `CycleOfColors`, `Roles`, `Fingerings`, `Default`, `lar4`

Validation:
- Focused test passed:
  `node --experimental-vm-modules jest song-api-more.test.js --runInBand`
- Full suite passed:
  `node --experimental-vm-modules jest _tests/jest/ --verbose --runInBand`
- Result: 36 suites passed, 426 tests passed.

This stays consistent with the earlier sprint-122 filtering:
- persisted JSON still saves only user-authored `colorDicts`
- runtime still rebuilds built-ins on load
- runtime order now matches the stylesheet table/code order you expect

Next sensible check:
1. Open one of the affected songfiles in the browser and confirm the table now shows the user stylesheet row after `Default` and that the `Result` row reflects the override.

Made changes.

