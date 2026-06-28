# Sprint 129 — Graveyard Plugin Menu Implementation Plan

## Goal

Restructure the managed plugin `B) Bury` command into a plugin-wide `g) graveyard` submenu, then expand that submenu to support plugin snapshot save, bury, raise, and Info-link workflows.

Coding is approved with the final review caveats from [129-design.md](129-design.md): do not keep `pluginAction:bury` compatibility, and do not invent a novel sub-action dispatch scheme if existing dynamic plugin action patterns are sufficient.

This revision incorporates the answered questions from [129-design.md](129-design.md), especially the resolved menu shape, save/link semantics, URI-fragment behavior, identifier restrictions, and testing preference to avoid brittle hardcoded menu-structure tests.

## Current behavior summary

Current managed plugin menu nodes are built centrally in [plugins/PluginManager.js](plugins/PluginManager.js):

- `buildManagedPropertyNodes()` appends `buildManagedBuryNode(pluginId)` for every plugin.
- `buildManagedBuryNode()` creates top-level `B) Bury` with `action: 'pluginAction:bury'` and an input for `graveyard key`.
- `invokeMenuAction()` dispatches `pluginAction:bury` to `buryPluginEntry()`.
- `buryPluginEntry()`:
	- calls plugin `beforeBury()` if present,
	- saves a snapshot via `storePluginSnapshot(..., { disableBeforeSnapshot: true })`,
	- resets/clears the plugin state via `resetPluginEntryState()`.
- `storePluginSnapshot()` writes a Graveyard record of type `PLUGIN` through `replaceGraveyardRecord()`.
- Plugin snapshot revive currently runs through [graveyard.js](graveyard.js): `Graveyard.raise(index)` detects `GraveType.PLUGIN` and delegates to `graveyardPluginSnapshotImporter`, which currently points to `PluginManager.importPluginSnapshot()` via [plugins/pluginRuntime.js](plugins/pluginRuntime.js).

Current plugin Graveyard record shape is approximately:

```text
type: 'PLUGIN'
context: {
	pluginId,
	userKey,
	logicalKey: `${pluginId}::${userKey}`,
	schemaVersion: 1,
	caption: `${registeredName} / ${userKey}`
}
json: JSON.stringify({ enabled, enableOnSongLoad, graveyardKey, properties })
```

## Requested menu shape

For all plugins, replace the top-level managed `B) Bury` item with:

```text
g) graveyard
	b) bury (save+clear)
	r) raise
	s) save
	l) link
```

Where:

- `b) bury (save+clear)` is equivalent to old `B) Bury`:
	- save snapshot to Graveyard,
	- clear/reset plugin state.
- `s) save` saves the same snapshot to Graveyard but does **not** clear/reset the plugin.
- `r) raise` opens a submenu of the most recent 9 Graveyard records for that plugin.
- `l) link` prompts for a Graveyard key, saves the current plugin snapshot without clearing, then appends a hyperlink to the song Info area, pointing to a URL fragment such as:
	- `#raise=transpose.MyPluginSettings`
	- superlink: `#raise=transpose.MyPluginSettings,arpeggio.MyArpeggioPositionSettings`

The managed plugin-level menu path should look like this, shown for Transpose:

```text
/fpt
	E) Enable
	L) Load enabled
	g) graveyard
		b) bury (save+clear)
		r) raise
		s) save
		l) link
	A) Apply
	R) Reset
	...
```

All current plugins have been checked by the project owner: `g` is available at the first plugin menu level, and the inner `b`, `r`, `s`, `l` triggers live only under `/...g`.

## Proposed menu architecture

### Centralized managed submenu

Implement this centrally in [plugins/PluginManager.js](plugins/PluginManager.js), not in individual plugins.

Replace `buildManagedBuryNode(pluginId)` with something like:

```text
buildManagedGraveyardNode(pluginId)
```

Returned node:

```text
{
	name: 'graveyard',
	caption: '<b>g</b>raveyard',
	trigger: 'g',
	children: [
		buildManagedGraveyardBuryNode(pluginId),
		buildManagedGraveyardRaiseNode(pluginId),
		buildManagedGraveyardSaveNode(pluginId),
		buildManagedGraveyardLinkNode(pluginId)
	]
}
```

Recommended action names:

```text
pluginAction:graveyardBury
pluginAction:graveyardSave
pluginAction:graveyardRaise
pluginAction:graveyardLink
```

Do not use a novel `pluginAction:graveyard` plus `graveyardAction` sub-action scheme. Use explicit action names unless an existing dynamic plugin action pattern already provides a better fit.

### No backward compatibility for old bury menu action

Do not support `pluginAction:bury` for old snapshots or old tests. Remove old tests if encountered. Current managed plugin menus should emit only the new graveyard action names.

## PluginManager behavior changes

### Save vs bury split

Current `storePluginSnapshot()` already supports the desired `save` behavior if called with:

```text
disableBeforeSnapshot: false
skipLoopStop: true
```

Add a public-ish method:

```text
savePluginEntry(entry, rawValue)
```

Behavior:

1. Prompt for the Graveyard key/name, defaulting to `USER` where the menu/input flow provides a default.
2. Validate the key as a plugin Graveyard identifier.
3. Do **not** run `beforeBury()`; there is no clear/reset step, so the existing bury warning semantics should not apply.
4. Call `storePluginSnapshot(entry, rawValue, { disableBeforeSnapshot: false, skipLoopStop: true })`.
5. Do **not** call `resetPluginEntryState()`.
6. Keep plugin enabled state and properties intact.
7. Refresh managed plugin menu node.
8. Return `result: saved ${pluginId} as ${userKey}`.

The save-only flow should allow looping to continue. The snapshot is plugin option state, not runtime helper state.

### Graveyard key validation

Tighten plugin Graveyard user keys for all plugin snapshot actions (`save`, `bury`, `link`, and raise-by-key lookup input if any) to identifiers:

```text
^[A-Za-z_][A-Za-z0-9_-]*$
```

Allowed:

- alphanumeric characters,
- `_`,
- `-`,
- not starting with a digit.

Reserved and therefore disallowed in user keys:

- `.`,
- `,`,
- `=`,
- `#`.

This keeps URI fragment parsing simple and avoids requiring URL encoding for generated plugin Graveyard links.

### Bury behavior

Keep old behavior, but rename the menu caption from `Bury` to `bury (save+clear)`.

Behavior remains:

1. Prompt for the Graveyard key/name.
2. Validate the key as a plugin Graveyard identifier.
3. Run the existing bury flow, including `beforeBury()` if present.
4. Save snapshot.
5. Disable/clear/reset plugin state.

### Raise behavior

Add helpers:

```text
getPluginGraveyardRecords(pluginId, limit = 9)
buildManagedGraveyardRaiseNode(pluginId)
buildManagedGraveyardRaiseRecordNode(pluginId, record, graveyardIndex, ordinal)
raisePluginSnapshotByGraveyardIndex(pluginId, graveyardIndex)
raisePluginSnapshotByKey(pluginId, userKey)
```

`getPluginGraveyardRecords()` should scan `song.graveyard.records` newest-first and return records where:

```text
record.type === 'PLUGIN'
record.context.pluginId === pluginId
```

Return at most 9 for menu triggers `1` through `9`.

Raise submenu captions should be based on User-supplied names:

```text
1) MyTransposeSettings1
2) MyTransposeSettings2
...
```

Fallback caption order:

1. `record.context.userKey`
2. `record.context.caption`
3. `record.context.logicalKey`
4. `record.timestamp`

Submenu leaf action should wrap the existing Graveyard raise behavior as closely as practical:

- import the chosen snapshot with `autoBuryCurrent: true`, matching current revive behavior;
- update `record.lastRevived` for consistency with global Graveyard table raises;
- continue using shared backend helpers where possible, while keeping menu-specific display concerns local to the plugin menu.

### Link behavior

Add helper:

```text
appendPluginGraveyardLinkToSongInfo(entry, userKey)
```

The `l) link` action should use a save-like flow:

1. Prompt for the Graveyard key/name, defaulting to `USER` where the menu/input flow provides a default.
2. Validate the key as a plugin Graveyard identifier.
3. Save/update the plugin snapshot without clearing and without stopping looping, using the same semantics as `s) save`.
4. Append a new hyperlink line to song Info.
5. Always append; do not deduplicate existing links.

The hyperlink target format is:

```text
#raise=${pluginId}.${userKey}
```

Example:

```text
<a href="#raise=transpose.MyPluginSettings">raise transpose.MyPluginSettings</a>
```

The link action uses the same input as save/bury:

```text
graveyard key
```

Because `l) link` saves before appending, the generated link should point at an existing plugin Graveyard record unless saving fails.

## URL fragment raise handling

### Fragment forms

Single link:

```text
#raise=transpose.MyPluginSettings
```

Superlink:

```text
#raise=transpose.MyPluginSettings,arpeggio.MyArpeggioPositionSettings
```

Also support the explicit repeated-operator form for hand-edited Info links:

```text
#raise=transpose.USER,raise=arpeggio.MySettings2
```

Recommended parser:

```text
parseRaiseFragment(hash)
	-> [
		{ pluginId: 'transpose', userKey: 'MyPluginSettings' },
		{ pluginId: 'arpeggio', userKey: 'MyArpeggioPositionSettings' }
	]
```

Parsing rules:

- Only handle `#raise=` fragments.
- Split records on commas.
- For each comma-separated segment, allow an optional leading `raise=`.
- For each record, split on the first `.` only.
- Validate plugin ids and user keys as identifiers; generated links should not need URL encoding.
- Trim whitespace.
- Ignore invalid blank entries with a clear console warning or message result.
- Use short lowercase Graveyard plugin ids such as `transpose`, `arpeggio`, `clip`; do not generate registered class-name aliases such as `ArpeggioPlugin`.

### When to execute

Do **not** treat load-time hash processing as a supported primary use case. The `Load enabled` flag remains the song-load mechanism for plugin state.

The supported use case is clicking rendered Info links in the already-loaded song, so one song can hold multiple plugin configurations without loading song variants.

Potential implementation:

```text
function handleRaiseFragment(hash) {
	const raises = pluginManager.parseRaiseFragment(hash);
	pluginManager.raisePluginSnapshotsByKeys(raises);
}
```

Requirement says “keeping song and URL, but performing raise”. That implies do **not** navigate away, replace the song file, or modify the current URL/query string other than the URI fragment that the browser naturally applies for an anchor click.

### Re-run behavior

Recommended behavior:

1. Handle clicks on rendered Info anchors whose `href` begins with `#raise=`.
2. Optionally also listen to `hashchange` so typed/pasted fragments do not break and can work when practical.
3. Do not run an automatic raise as part of normal song-load initialization.
4. Guard against duplicate processing of the same click/hash if both click and `hashchange` handlers fire.
5. Apply superlinks left-to-right.
6. If one item in a superlink is missing or invalid, continue with subsequent items, collect per-item results, and show a summary through `ShowMessages`.

## Song Info integration

Append links to the HTML text of `Song.info`, escaped/sanitized as needed by the existing Info rendering path.

Implementation tasks:

1. Identify persisted Info field used by [templates/info/info.builder.js](templates/info/info.builder.js).
2. Append link as formatted HTML using a newline plus `<br>` so each generated link starts on its own line.
3. Re-render Info panel after appending.
4. Persist link through normal save.

Required generated format:

```text
\n<br>Raise plugin state: <a href="#raise=transpose.USER">transpose.USER</a>
\n<br>Raise plugin state: <a href="#raise=transpose.MySettings1">transpose.MySettings1</a>
```

Multiple `l) link` invocations should keep appending lines, including duplicates. This preserves user notes and lets advanced users manually edit several lines into superlinks.

The Info sanitizer should allow `a` anchor tags only when the destination is a URI fragment raise link such as `#raise=transpose.USER` or `#raise=transpose.USER,raise=arpeggio.MySettings2`. It should not allow full external URLs such as `http://example.com#raise=foo` under this exception.

## Graveyard record lookup design

Add manager helpers:

```text
findPluginGraveyardRecord(pluginId, userKey)
findPluginGraveyardRecordIndex(pluginId, userKey)
```

Matching should prefer exact:

```text
record.type === 'PLUGIN'
record.context.pluginId === pluginId
record.context.userKey === userKey
```

If historical records may only have `logicalKey`, optionally fallback to:

```text
record.context.logicalKey === `${pluginId}::${userKey}`
```

When duplicates exist, raise should use newest-first; the newest matching record wins.

## EventBus integration

EventBus can help keep UI concerns decoupled.

Suggested events:

```text
PluginGraveyard:saved
PluginGraveyard:buried
PluginGraveyard:raised
PluginGraveyard:linkAdded
PluginGraveyard:raiseMissing
```

Use cases:

- Show result/message through existing `PluginManager:ShowResult` or `ShowMessages` conventions.
- Refresh plugin menus after raise/save/bury.
- Refresh Info panel after link insertion.
- Trigger `SongUiFullRepaint` after raise if plugin state affects visible UI.

Do not overbuild EventBus in first pass. Keep `PluginManager.invokeMenuAction()` as the command owner; use EventBus only for UI side effects that are already EventBus-oriented.

## Implementation steps

### Step 1 — Preserve backend contract tests, avoid brittle menu-structure tests

Do **not** add new hardcoded dynamic/static menu-structure tests. The project preference is to validate menus by User Acceptance testing because menu structure is intentionally configuration-driven.

Jest should focus on backend behavior that remains stable across menu reshaping:

- plugin Graveyard key validation accepts/rejects the intended identifiers;
- save/bury/link/raise helpers perform the right state changes;
- parser/helper code handles single links and superlinks.

### Step 2 — Build managed graveyard submenu

In [plugins/PluginManager.js](plugins/PluginManager.js):

- Replace `managedNodes.push(this.buildManagedBuryNode(pluginId))` with `buildManagedGraveyardNode(pluginId)`.
- Remove the old top-level `buildManagedBuryNode()`/`pluginAction:bury` path; use `buildManagedGraveyardBuryNode()` under `g) graveyard` instead.

### Step 3 — Add save action

Add `savePluginEntry()` and dispatch it from the new `s) save` menu node.

Test that:

- Graveyard gets a `PLUGIN` record.
- Plugin state remains enabled/properties remain unchanged.
- Song plugin state remains synced.
- `beforeBury()` is not called.
- looping is not stopped.

### Step 4 — Add raise submenu

Add newest-first record lookup and dynamic raise children.

Menu behavior:

- If no records exist: show disabled/no-action node, e.g. `no plugin snapshots`.
- If records exist: show up to 9 with triggers `1` through `9`.

Test that:

- newest-first record helper returns the newest 9 matching records.
- duplicate-key lookup resolves to newest matching record.
- captions can be built from `userKey`.
- selecting/raising a record imports the expected snapshot, auto-buries current state, and updates `lastRevived`.

### Step 5 — Add link action

Add `l) link` node with `graveyard key` input.

The link action should save/update the plugin snapshot with save-only semantics, then append a new Info HTML line.

Test that:

- Link is appended to persisted song Info.
- Duplicate links are appended again on new lines.
- The save part does not clear plugin state, does not run `beforeBury()`, and does not stop looping.
- Result message includes the generated fragment.
- Sanitization permits only fragment raise anchors, not full external URLs.

### Step 6 — Add hash raise parser and handler

Implement in a small module or PluginManager helper. Suggested names:

```text
parsePluginRaiseHash(hash)
raisePluginSnapshotsFromHash(hash)
```

Wire from [infinite-neck.js](infinite-neck.js) for rendered Info link clicks, with optional `hashchange` support as a non-primary convenience. Do not make initial song-load hash processing a required supported path.

Test parser/helper behavior separately in Jest. Browser click behavior should be manually UA-tested.

### Step 7 — Full integration and UA testing

Manual scenarios:

1. Configure Transpose plugin, `g s` save as `MyPluginSettings`.
2. Change Transpose settings.
3. `g r 1` raises saved settings.
4. `g b` saves and clears settings.
5. `g l` appends Info link.
6. Click Info link and verify plugin raises without changing song file URL except hash.
7. Use superlink to raise Transpose and Arpeggio in one click.

## Testing plan

### Jest

Primary tests:

- Save vs bury state behavior.
- Save/link do not run `beforeBury()` and do not stop looping.
- Graveyard key identifier validation.
- Raise record helper returns newest-first, max 9.
- Raise-by-key imports correct plugin snapshot.
- Raise updates `lastRevived` and auto-buries current state.
- Hash parser supports single and superlink forms.
- Link appender writes expected Info lines and appends duplicates.
- Info sanitizer permits only `#raise=` fragment anchors for this feature.

Do not add new hardcoded tests that assert exact dynamic/static menu shape. Menu trigger/path verification belongs in UA testing for this sprint.

Likely test file:

- [_tests/jest/plugin-manager-persistence.test.js](_tests/jest/plugin-manager-persistence.test.js)

Potential new focused test file:

- [_tests/jest/plugin-graveyard-menu.test.js](_tests/jest/plugin-graveyard-menu.test.js)

### Browser/UA

- Verify command menu triggers do not conflict with plugin-specific triggers.
- Verify every plugin has `g) graveyard` where old top-level `B) Bury` was available.
- Verify `/...g b`, `/...g s`, `/...g r`, and `/...g l` flows manually.
- Verify Info links are clickable and do not break app routing.
- Verify superlink applies all snapshots in order.
- Verify missing snapshot produces visible message and does not partially corrupt plugin state.

## Resolved decisions from [129-design.md](129-design.md)

1. `s) save` does not run `beforeBury()`.
2. `s) save` does not stop looping.
3. `l) link` follows a save-like flow: prompt for key, save/update snapshot, then append the Info link.
4. Info link insertion appends HTML to `Song.info` as `\n<br>Raise plugin state: <a href="#raise=plugin.USER">plugin.USER</a>`.
5. Duplicate Info links are allowed and should keep appending.
6. Duplicate Graveyard record lookup uses newest matching record.
7. Raise-by-menu updates `lastRevived`.
8. Superlink failure continues through remaining items, collects results, and shows a summary.
9. Superlinks apply left-to-right.
10. Plugin Graveyard user keys are tightened to identifiers so `.`, `,`, `=`, and `#` remain reserved fragment delimiters.
11. Links use short lowercase Graveyard plugin ids such as `transpose` and `arpeggio`; `ArpeggioPlugin` was an example typo.
12. `g` is available at the first plugin menu level; `b`, `r`, `s`, and `l` are scoped inside the new `g) graveyard` submenu.
13. Plugin Graveyard menu raise should wrap/share the existing global Graveyard raise backend semantics.
14. Menu raise and URL/Info-link raise should auto-bury current plugin state, matching current revive behavior.
15. Do not add brittle hardcoded menu-structure Jest tests; validate menus by UA testing.

## Recommended first implementation boundary

After review approval, the recommended code sprint can implement the full requested feature set in this sequence:

- Managed `g) graveyard` submenu.
- `b) bury (save+clear)`.
- `s) save`.
- `r) raise` submenu from latest 9 plugin records.
- Raise-by-menu with `lastRevived` update.
- `l) link` save-and-append behavior.
- Info sanitizer allowance for safe `#raise=` anchors.
- Info-link click/hash handling for single-link and superlink raise.
- Backend/helper Jest tests for non-menu behavior.
- UA menu testing for the new managed menu shape.

If we still want a smaller first coding pass, the safest split is:

1. Menu restructure, `bury`, `save`, `raise`, key validation, and backend tests.
2. `link`, Info sanitizer, Info click/hash handling, superlinks, and UA tests.

The design uncertainty around Info and fragments has now been answered, so they no longer need to be explicitly deferred unless we want a smaller review/test cycle.

## Definition of done

- All plugins show `g) graveyard` instead of top-level `B) Bury`.
- `b) bury (save+clear)` preserves old behavior.
- `s) save` snapshots without clearing.
- `r) raise` lists newest 9 plugin snapshots and revives selected snapshot.
- `l) link` saves current plugin snapshot without clearing and appends a new Info link line.
- URL/Info `#raise=` single-link and superlink behavior is implemented for rendered Info link clicks.
- Plugin Graveyard keys reject reserved delimiter characters.
- Jest coverage exists for backend snapshot behavior, key validation, lookup/parser helpers, link appending, and sanitizer behavior, but not brittle exact menu shape.
- UA test confirms at least Transpose and Arpeggio plugin workflows.
