# Sprint 116: ClipPlugin Fingering

## Goal

Add played Fingering support to ClipPlugin through a new explicit toggle, while leaving `recordedNotes` completely out of scope.

## Approved direction

1. Add a new explicit toggle: `includeFingering`.
2. Keep ClipPlugin behavior unchanged for `recordedNotes`; ClipPlugin still does not copy, cut, revive, or MIDI Paste `recordedNotes`.
3. Treat Fingering as another supported `playedNotes` style alongside Single, Tiny, and Bend.
4. Reuse ClipPlugin's existing played-note collision semantics during revive and MIDI Paste.

## Collision semantics

1. In ClipPlugin, played-note collision identity already uses `styleNum + row + col`.
2. That means a Fingering only collides with another Fingering on the same cell.
3. This matches the MovePlugin rule already chosen in chat for `playedNotes`: at most one Fingering per cell in the model.
4. `overwrite=false` should skip same-cell Fingering collisions.
5. `overwrite=true` should replace same-cell Fingering collisions.
6. Do not add any cross-storage logic between `playedNotes` and `recordedNotes`, because ClipPlugin does not operate on `recordedNotes`.

## Implementation shape

### 1. Plugin properties and menu

1. Add `includeFingering` to `plugins/clip/properties.json`.
2. Use trigger `f` and caption `fingering`.
3. Default it to `true` so ClipPlugin includes played Fingering by default alongside the other supported played-note lanes.
4. Add the toggle under `ClipPlugin -> include`.

### 2. Include summaries and counts

1. Extend `INCLUDED_STYLE_ORDER` to include `fingering`.
2. Extend `getIncludeConfig()` with `fingering`.
3. Extend `getNoteCounts()` with a Fingering count from `playedNotes`.
4. Extend `buildIncludeSummary()` so enabled Fingering appears as `f:<count>`.
5. Extend `collectClipCounts()` and default clip naming to include Fingering counts.

### 3. Copy payload

1. Extend `collectClipPayload()` counts with `fingering`.
2. When `includeFingering` is enabled, copy `playedNotes` entries whose `styleNum` is `Note.STYLENUM_FINGERING`.
3. Continue stripping only `owner`, while preserving Fingering payload fields such as `finger`.

### 4. Cut behavior

1. Extend `removeIncludedNotesFromSection()` so enabled Fingering is removed from `playedNotes` during cut.
2. Keep named-note cut behavior unchanged.
3. Keep `recordedNotes` untouched.

### 5. Revive and MIDI Paste

1. No special revive path is required for Fingering.
2. Existing `applyPlayedCandidate()` already handles same-style same-cell overwrite/skip behavior.
3. Existing MIDI Paste candidate construction should preserve `finger` while remapping `noteName`, `midinum`, `row`, and `col`.
4. Validate this with tests rather than adding special-case logic unless a defect appears.

## Tests

Add focused tests in `_tests/jest/clip-plugin.test.js` for:

1. include summary shows Fingering count when enabled
2. copy stores Fingering in the clip payload when enabled
3. cut removes Fingering only when enabled
4. revive skips same-cell Fingering when `overwrite=false`
5. revive replaces same-cell Fingering when `overwrite=true`
6. Fingering copy/revive preserves the `finger` payload
7. MIDI Paste preserves `finger` while remapping location fields

## Non-goals

1. Do not add `recordedNotes` support to ClipPlugin.
2. Do not change generic Graveyard behavior.
3. Do not change UI replay precedence between `playedNotes` and `recordedNotes`.
4. Do not modify `help-plugins.html` in this sprint.

## Validation

Run the focused ClipPlugin Jest suite after implementation:

`node --experimental-vm-modules node_modules/.bin/jest _tests/jest/clip-plugin.test.js --verbose --runInBand`
