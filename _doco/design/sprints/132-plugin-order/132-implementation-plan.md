# 132 Plugin Order - Implementation Plan

## Goal

Make plugin firing order explicit, configurable, and persisted per song so looping behavior matches musical intent.

Primary target from the design request:

1. Validate whether plugin order is the culprit in the reported loop behavior.
2. Replace brittle order-by-registration behavior with a single code-defined ordering source.
3. Add advanced menu control at `/fap`:
	- caption: `p) plugin firing order [...]`
	- input accepted as either `t,f,a,o,c,m` or `tfaocm`
4. Persist this setting in the song file and declare the property name in schema.

## Current Behavior Analysis

### 1) EventBus dispatch order is subscription order

In [event-bus.js](event-bus.js), handlers are executed in array insertion order:

- `on(event, handler)` appends with `push`.
- `trigger(event, data)` iterates `forEach`.

That means plugin order for a given event is effectively the order handlers were subscribed.

### 2) Plugin subscriptions are currently per-plugin and registration-driven

In [plugins/PluginManager.js](plugins/PluginManager.js), `enablePluginEntry()` subscribes each plugin handler directly to EventBus for each event in `plugin.getEventNames()`.

Today, load-time enable order comes from plugin map iteration (insertion order), which is set by [plugins/registerPlugins.js](plugins/registerPlugins.js):

- transpose (`t`)
- arpeggio (`a`)
- clip (`c`)
- fill (`f`)
- move (`m`)
- tonal (`o`)

So handler order is currently an implementation side-effect, not a user-controlled policy.

### 3) Loop/event timing complexity is real

The design note is accurate: there are multiple order dimensions.

- Section loop transitions happen in [looper.js](looper.js), including:
  - `DaCapo:OnSongEnd`
  - section advance
  - `DaCapo:OnSectionBegin`
- Transpose listens to `DaCapo:OnSongEnd` and `Looper:OnResetSong` in [plugins/transpose/TransposePlugin.js](plugins/transpose/TransposePlugin.js).
- Fill listens to `DaCapo:OnSectionBegin` and `Looper:OnResetSong` in [plugins/fill/FillPlugin.js](plugins/fill/FillPlugin.js).
- Arpeggio listens to `DaCapo:OnSectionBegin`, `SongUiShowBeats`, and `Looper:OnResetSong` in [plugins/arpeggio/ArpeggioPlugin.js](plugins/arpeggio/ArpeggioPlugin.js).

Important nuance: configuring plugin order controls order among plugins handling the same event. It does not reorder distinct events (`OnSongEnd` vs `OnSectionBegin`) relative to each other.

## Recommendation

Adopt a centralized PluginManager event dispatcher so plugin order is defined in one place and applied consistently for every event.

Why this is preferred over re-registering handlers:

1. Stable: no dependency on registration timing or toggle history.
2. Minimal surface area: one event dispatch path in PluginManager.
3. Flexible: easy to add event-specific exceptions later if needed.

## Proposed Data Model

Add a song-level property:

- `pluginFiringOrder`

Recommended shape:

- Array of trigger tokens (strings), example: `['t','f','a','o','c','m']`

Why array over raw string:

1. Easier to validate and normalize.
2. Easier to diff in song files.
3. Avoids repeated parsing at runtime.

Persistence/schema touchpoints:

- [SongPersistence.js](SongPersistence.js): include default `pluginFiringOrder`.
- [bin/song-file-schema.js](bin/song-file-schema.js): declare `pluginFiringOrder` property name as optional array of strings. No enum restrictions needed.

## Menu and UX Plan

### `/fap` control

In [menu.js](menu.js), add under File -> Advanced:

- trigger: `p`
- caption: `plugin firing order [${pluginFiringOrderDisplay}]`
- action: `setPluginFiringOrder`
- input datatype: string
- input default: `${pluginFiringOrderInput}`

Examples accepted:

- `t,f,a,o,c,m`
- `tfaocm`

Normalization behavior:

1. Strip spaces.
2. If commas exist, split commas; else split per char.
3. Lowercase.
4. Keep only known plugin triggers from currently registered plugins.
5. Remove duplicates, first occurrence wins.
6. Append unspecified known triggers in current default order for completeness.

Display behavior after save:

- `p) plugin firing order [t,f,a,o,c,m]`

Code touchpoints:

- [key-handlers.js](key-handlers.js): add case `setPluginFiringOrder` and dynamic value resolver tokens.
- [plugins/PluginManager.js](plugins/PluginManager.js): expose parse/normalize/get-display/set-order methods.

## Dispatcher Architecture Plan

### Current

Each enabled plugin subscribes its own EventBus handler.

### Proposed

PluginManager subscribes once per event name and dispatches internally in resolved order.

Implementation outline in [plugins/PluginManager.js](plugins/PluginManager.js):

1. Build event -> plugins index from enabled plugins.
2. Subscribe one manager handler per event.
3. On event:
	- compute effective plugin order for this song
	- iterate enabled plugins matching event in order
	- call `plugin.handleEvent(...)`
	- preserve current result/message handling via `PluginManager:ShowResult`
4. Keep non-event plugins in order list for completeness, but they naturally skip dispatch.

Effective order resolution:

1. Song-defined order (`song.pluginFiringOrder`) if present.
2. Fallback to static default order constant in one place, set to `[t,f,a,o,c,m]` (clean-code default, not legacy-derived).
3. Any unknown triggers ignored with a warning result.

## Validation-First Phase (Required by Design)

Before behavior changes, add targeted instrumentation to prove culprit.

### What to log

For loop boundary transitions (last beat of last section):

1. Event emission order from [looper.js](looper.js)
2. Plugin handling order per event from PluginManager
3. Section index and beat context

### How to scope logs

Use a temporary boolean constant (same style as prior timing toggles) so logs are easy to enable/disable in code.

### Expected diagnostic outcome

1. Confirm whether `DaCapo:OnSongEnd` transpose runs before or after next `DaCapo:OnSectionBegin` fill.
2. Confirm current order between Fill and Arpeggio on `DaCapo:OnSectionBegin`.
3. If findings prove the assumed default order `[t,f,a,o,c,m]` is wrong for intended musical behavior, recommend an updated default from Phase 0 evidence before finalizing the constant.

Note: the attached song file currently has transpose persisted as disabled by default in [songs/sprint-121/C-chords-w-tiny-modes.json](songs/sprint-121/C-chords-w-tiny-modes.json). Reproduction steps should explicitly enable it when validating transpose interaction.

## Implementation Phases

## Phase 0 - Diagnostics

1. Add temporary plugin-order debug logs (guarded by const).
2. Reproduce with the attached song and capture event/handler order.
3. Record findings in sprint chat notes.

## Phase 1 - Internal Ordering Core

1. Introduce a single default order constant (triggers) in PluginManager, initially `[t,f,a,o,c,m]`.
2. Add song order parser/normalizer and display helpers.
3. Convert PluginManager event execution to centralized dispatch.
4. Keep public plugin APIs unchanged.

## Phase 2 - Menu and Persistence

1. Add `/fap` menu input and caption wiring.
2. Add key-handlers action `setPluginFiringOrder`.
3. Persist to song and include schema property.

## Phase 3 - Test Coverage and Hardening

1. Unit-test parser normalization and fallback behavior.
2. Unit-test per-event dispatch order for same-event plugins.
3. Add integration test for looping boundary event sequence assumptions.
4. Verify persistence round-trip on song save/load.

## Test Plan

Suggested suites to extend:

1. [plugin-manager-persistence.test.js](_tests/jest/plugin-manager-persistence.test.js)
2. [looper.test.js](_tests/jest/looper.test.js)
3. [fill-plugin.test.js](_tests/jest/fill-plugin.test.js)
4. [arpeggio-plugin.test.js](_tests/jest/arpeggio-plugin.test.js)

Add new focused tests for:

1. Parsing `t,f,a,o,c,m` and `tfaocm` to identical normalized order.
2. Duplicate/unknown trigger handling.
3. Effective order applies only among listeners for each event.
4. Non-listening plugins retained in display/persistence but skipped at dispatch.

## Risks and Mitigations

1. Risk: accidental change in behavior for existing songs with no custom order.
	- Mitigation: default order constant is intentionally set to `[t,f,a,o,c,m]`; if Phase 0 evidence contradicts intended behavior, revise the default and document rationale.

2. Risk: menu confusion if partial orders are provided.
	- Mitigation: normalize and auto-append missing known triggers, then show canonical bracketed result.

3. Risk: hidden coupling with enable/disable toggles.
	- Mitigation: centralized dispatcher recomputes active listeners after toggle changes.

4. Risk: schema mismatch failures in song-load tests.
	- Mitigation: include `pluginFiringOrder` property in [bin/song-file-schema.js](bin/song-file-schema.js) in the same change as persistence.

## Definition of Done

1. Looping plugin dispatch order is deterministic and code-defined.
2. `/fap` allows setting order via comma-separated or compact trigger string.
3. Menu reflects canonical order in bracket format.
4. Order persists per song and survives load/save roundtrip.
5. Existing plugin behavior unchanged except intended order control.
6. Full Jest suite passes.

