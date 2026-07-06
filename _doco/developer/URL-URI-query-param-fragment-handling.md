# URL / URI / Query Param / Fragment Handling Guide

This guide maps where URL-related behavior is implemented today, including implemented startup support for `?song=...&macro=...`.

## Current Locations (1-24)
| # | Area | Meaning | Source location |
|---|---|---|---|
| 1 | Song Library rendering | Song rows are rendered in library HTML. | [SongLibrary.js](../../SongLibrary.js#L156) |
| 2 | Song Library row action | Each song row emits `data-action='loadSong'` with the song path in args. | [SongLibrary.js](../../SongLibrary.js#L163) |
| 3 | Song Library init | Library UI initializer entrypoint. | [SongLibrary.js](../../SongLibrary.js#L209) |
| 4 | Song list fetch | Song Library JSON is fetched from `songs/song-list.json`. | [SongLibrary.js](../../SongLibrary.js#L212) |
| 5 | Data-action handler registry | Central map from `data-action` to runtime handlers. | [infinite-neck.js](../../infinite-neck.js#L3315) |
| 6 | Data-action click dispatch | Document-level click delegation for all `data-action` links/buttons. | [infinite-neck.js](../../infinite-neck.js#L3345) |
| 7 | Song file open by path | `loadSong(songName)` fetches `songs/` + relative path and opens JSON. | [infinite-neck.js](../../infinite-neck.js#L1704) |
| 8 | Song Library menu action | `songLibrary()` initializes the Song Library panel. | [infinite-neck.js](../../infinite-neck.js#L1716) |
| 9 | URL tuning entrypoint | Startup logic for default tuning selection. | [infinite-neck.js](../../infinite-neck.js#L1606) |
| 10 | tuning precedence guard | `tuning=` is ignored when `song=` is present, so song tunings win. | [infinite-neck.js](../../infinite-neck.js#L1609) |
| 11 | tuning query param parse | Reads `tuning` from `URLSearchParams(window.location.search)` when no `song=` is provided. | [infinite-neck.js](../../infinite-neck.js#L1614) |
| 12 | URL song normalization | Normalizes/decodes `song=` query value and strips optional leading `songs/`. | [infinite-neck.js](../../infinite-neck.js#L1626) |
| 13 | URL song startup loader | Loads song from `song=` query param at startup. | [infinite-neck.js](../../infinite-neck.js#L1648) |
| 14 | URL song query parse | Reads `song` from `URLSearchParams(window.location.search)`. | [infinite-neck.js](../../infinite-neck.js#L1653) |
| 15 | URL macro entrypoint | Startup logic that reads macro from query params. | [infinite-neck.js](../../infinite-neck.js#L1661) |
| 16 | macro query param parse | Reads `macro` from `URLSearchParams(window.location.search)`. | [infinite-neck.js](../../infinite-neck.js#L1666) |
| 17 | URL macro scheduling point | URL macro run is triggered after song open/update flow. | [infinite-neck.js](../../infinite-neck.js#L1593) |
| 18 | Info-link fragment click handler | Intercepts `#raise=` and `#macro=` links inside rendered Info HTML. | [infinite-neck.js](../../infinite-neck.js#L2824) |
| 19 | Fragment reflected to browser URL | Updates browser URL fragment using `history.pushState`. | [infinite-neck.js](../../infinite-neck.js#L2829) |
| 20 | Fragment action dispatcher | Converts parsed fragment actions into plugin raises and macro execution. | [infinite-neck.js](../../infinite-neck.js#L1197) |
| 21 | Fragment parser | Shared parser for `#raise=...` and `#macro=...` action fragments. | [app-action-fragment.js](../../app-action-fragment.js#L36) |
| 22 | Fragment validator | Validates whether a fragment is an allowed app action fragment. | [app-action-fragment.js](../../app-action-fragment.js#L79) |
| 23 | Info HTML sanitizer allowlist | Allows only safe links, including app action fragments and help fragments. | [html-sanitizer.js](../../html-sanitizer.js#L46) |
| 24 | Plugin raise executor + Macro runner | Actual plugin raise-from-hash and macro execution entrypoints. | [plugins/PluginManager.js](../../plugins/PluginManager.js#L1093), [key-handlers.js](../../key-handlers.js#L379) |

## URL Forms Reference

| URL form (example string) | meaning | code location handled |
|---|---|---|
| `/infinite-neck?macro=show-instruments` | Attempts to run a song macro by id on startup. If the current song has no matching macro (for example default startup song), this is a safe no-op with a user-log message. | [infinite-neck.js](../../infinite-neck.js#L1661), [infinite-neck.js](../../infinite-neck.js#L1666), [key-handlers.js](../../key-handlers.js#L379) |
| `#raise=transpose.blues,raise=arpeggio.firstPosition` | Raise one or more saved plugin snapshots from a fragment action link. | [app-action-fragment.js](../../app-action-fragment.js#L36), [infinite-neck.js](../../infinite-neck.js#L1197), [plugins/PluginManager.js](../../plugins/PluginManager.js#L1093) |
| `#raise=transpose.blues,raise=arpeggio.firstPostion,macro=S6` | Combined fragment action list: raise two saved plugin snapshots, then run macro id `S6`. Note: parser and examples use `macro=`; macro id must exist in song macros to run successfully. | [app-action-fragment.js](../../app-action-fragment.js#L36), [infinite-neck.js](../../infinite-neck.js#L1197), [key-handlers.js](../../key-handlers.js#L379) |
| `/infinite-neck?tuning=Bass4` | Override startup default visible tuning(s) by tuning id. | [infinite-neck.js](../../infinite-neck.js#L1606), [infinite-neck.js](../../infinite-neck.js#L1609) |
| `/infinite-neck?song=name-that-note/name-that-note .json&macro=S6` | Open Song Library song by relative path, then run macro id `S6` after load. The song path normalizer tolerates a stray space before `.json`. | [infinite-neck.js](../../infinite-neck.js#L1626), [infinite-neck.js](../../infinite-neck.js#L1648), [infinite-neck.js](../../infinite-neck.js#L1653), [infinite-neck.js](../../infinite-neck.js#L1661), [infinite-neck.js](../../infinite-neck.js#L1666), [infinite-neck.js](../../infinite-neck.js#L1704) |

## Notes

- Runtime behavior supports `song`, `macro`, and `tuning` query params.
- Precedence rule: if `song=` is present, startup `tuning=` is ignored so song-defined tunings remain authoritative.
- Current fragment behavior for `raise` and `macro` is already implemented for links in Info HTML and validated by the sanitizer/parser pipeline.
- Info sanitizer now allows safe same-app query links in Song Info, including forms like `<a href="?song=name-that-note/name-that-note.json&macro=P46">song</a>`.
