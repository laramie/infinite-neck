# sprint-157 Iteration 1: Analysis of the Workbook wishlist, storage and file format

Status: design analysis only. No code was changed. Facts marked "verified" were read from the code or measured from `songs/**` (excluding `_trash`). Statements about browser behaviour (quotas, eviction, API support) come from general knowledge of the platform and **were not tested in a browser**.

Inputs: [157-design.md](157-design.md), [sprint-157.md](sprint-157.md).

## 1. Summary

1. The Workbook is feasible and can be almost entirely **additive**: one new block on the File page, a few new modules, and a handful of small hooks in [infinite-neck.js](../../../../infinite-neck.js). No change to `Song`, `Section` or the Song file format is needed for version 1.
2. **Recommended storage: IndexedDB**, one record per Song (the Song JSON text, verbatim) plus light list data. `localStorage` is viable on size alone, but it is synchronous, small, shared with the App's other keys, and **an unguarded `setItem` in [Tutorial.js](../../../../Tutorial.js#L303) would start failing** once the Workbook fills it. See section 4.
3. **Recommended file format: one pretty-printed JSON document**, `{ fileType, workbookVersion, folders[], songs[] }`, each song entry carrying its Song as a plain JSON object. The whole shipped library is about 1.9 MB that way (150 KB gzipped). See section 5.
4. Browser storage can be wiped (user clears site data, Safari's inactivity purge, a different origin such as `localhost` vs production). So **the download is the real backup, and the design should make backup status visible**, without nagging on every save. See 7.3.
5. Three things the wishlist assumes are "just there" are **not persisted in the Song file today**: Tutorial Bookmarks / done marks, Include-in-Looping (the Practice List), and the Browser's Scaling Prefs, which *override* Song cell sizes. These are the "session-only choices" the design doc asks us to track. See section 8.
6. A shared Workbook file is **untrusted input**: comments and names must be escaped (the Library's descriptions are raw HTML by design, Workbook comments must not be). See 9.
7. 17 questions for the Design Team are in section 11, each with a recommendation. The ones that block coding are Q1 to Q8.

## 2. How it works today (verified)

| Fact | Where |
|---|---|
| The File page is `#divFileControls`: Open from local file (`#fileInput`) with four Append checkboxes, then `#divSongList` (the Library), then Song Name + **Download Song**, then BPM etc. | [index.html](../../../../index.html#L119) |
| The Library is a pure string builder: `<details class='songLibraryRootDetails'><summary class='songLibrarySummary'>Song Library</summary>`, root rows first, then one `<details>` per directory, `name='songLibraryDirectoryGroup'` (accordion). | [SongLibrary.js](../../../../SongLibrary.js#L211) |
| `initializeSongLibrary` does `$.get('songs/song-list.json')` then **replaces** the whole `#divSongList` HTML. Anything the Workbook put inside `#divSongList` would be wiped. The Workbook needs its own sibling container. | [SongLibrary.js](../../../../SongLibrary.js#L238) |
| A Library row is `<a data-action='loadSong' data-action-args='["practice/All-Chords.json"]'>`; a global delegated `click` on `[data-action]` dispatches to a handler table. New Workbook links are just new entries in that table. | [bindDataActionHandlers](../../../../infinite-neck.js#L4906) |
| Library row cell classes are `songLibraryRow`, `songLibraryCellLink`, `songLibraryCellDescription`. The Workbook can reuse them for the "two cells" look with no new CSS beyond a few buttons. | [song-library.css](../../../../song-library.css), [SongLibrary.js](../../../../SongLibrary.js#L174) |
| `loadSong(name)` does `$.get("songs/"+name)`, shows a native `confirm()` ("Did you save the current Song with File | Download already?") when the current Song is not empty, sets `gPendingSongLibraryHref`, then calls `openSong(text)`. | [loadSong](../../../../infinite-neck.js#L2522) |
| `openSong(str)` takes **the JSON text**, and for a full (non-append) open copies the pending href into `gCurrentSongLibraryHref`. | [openSong](../../../../infinite-neck.js#L2246) |
| Saving = `getPersistentSongFile()` which first runs `updateMemoryModelPreFileSave()` (syncs name, BPM, theme, userColors, plugins, anchorage) then `JSON.stringify(song, replacer, 2)`. `downloadPlayedNotes()` wraps that in a Blob + `<a download>`. **A "Save to Workbook" can call `getPersistentSongFile()` unchanged and store the text.** | [getPersistentSongFile](../../../../infinite-neck.js#L2129), [downloadPlayedNotes](../../../../infinite-neck.js#L2137), [Song.js](../../../../Song.js#L55) |
| The filename box `#txtFilename` holds the name **without** `.json`; the download appends `.json`. No validation today (spaces allowed). | [downloadPlayedNotes](../../../../infinite-neck.js#L2137) |
| `localStorage` already holds: `ScalingPrefs`, `InstrumentPrefs`, the UserLog level, and `infinite-neck:tutorial-progress:<storageKey>`. No IndexedDB anywhere in the repo. | grep of `*.js` |
| Tutorial progress (done Sections + bookmark) is **not in the Song file**. It is in `localStorage`, keyed by `song.tutorial.storageKey` if set, else by the Library href minus `songs/` and `.json`. | [Tutorial.js](../../../../Tutorial.js#L95), [getTutorialStorageEntry](../../../../infinite-neck.js#L572) |
| Include-in-Looping (the Practice List checkboxes) lives only in `tutorialRuntimeState`, which is **reset to `null` on every Song open**. It is not saved anywhere. | [tutorialRuntimeState](../../../../infinite-neck.js#L563) |
| Browser Scaling Prefs **beat** Song-DEFAULTS cell sizes, as a whole blob, at every Song open. | [displayOptionsOpenSizes.js](../../../../templates/display-options/displayOptionsOpenSizes.js#L1) |

### Size of the library today (measured)

| Measure | Value |
|---|---|
| JSON files under `songs/` (outside `_trash`) | 74, 3.19 MB total |
| Songs actually listed in `song-list.json` | 43 resolvable files |
| Those 43, as shipped (pretty-printed, indent 2) | **1.92 MB** |
| Those 43, minified | 1.08 MB |
| Those 43, each gzipped separately | 154 KB |
| Median / largest Song | 22.8 KB / 330 KB (`practice/supersong-black-keys.json`) |

The design doc's "double, certainly not tenfold" gives a planning ceiling of **about 4 MB as text, 8 MB as a stress case**. That is small for every storage option except `localStorage`, see below.

## 3. The wishlist mapped to existing features (design principle 1)

| Wishlist item | Use what exists | New code needed? |
|---|---|---|
| Customize a Song (transposition, hide chords, cell sizes, Themes) | Author it in the normal App, then Save to Workbook. Transposition via graveyard/raise link or a Macro in the Song. | No. Help text only. |
| Cell sizes / presentation | Presentation Mode already persists sizes in the Song. **But see 8.3: Scaling Prefs override them.** | Help text, possibly one decision (Q10). |
| "Practice List" `/vtwp` | Wizard mode + `/vtwp`. | No for use. **Persisting its choices is new** (8.2). |
| Tutorial Bookmarks | Tutorial progress. | **Persisting/porting is new** (8.1). |
| Annotation | Song Caption / Tutorial Caption / Tutorial Prompt (wizard mode edits prompts). | No for v1. The *list* comment is new Workbook data (not Song data). |
| Link to a Song in the Workbook | `data-action` link, same mechanism as the Library link. | Small. |
| Copy a link to share | `copySongLink` builds `?song=<path>`; it only works for Library paths (the server must have the file). | Not applicable to Workbook Songs, see Q15. |
| Append | Already works on the current Song, then Save to Workbook. | No. |
| Folder / Song list, rename, delete, comment | Not present. | Yes, the core of the sprint. |

Everything the design doc lists under "nice-to-haves" can stay documentation-only for v1. The new code is the store, the list UI, name validation, and the Workbook file Download/Open.

## 4. Browser storage options

Requirement summary: JSON text, 2 to 8 MB, survives reloads, must not break existing prefs and tutorial progress, must work from the same origin that serves the App.

| Option | Capacity | API | Fit |
|---|---|---|---|
| **localStorage** | about 5 million characters per origin (browser-dependent, strings are UTF-16). | Synchronous, blocks the main thread. | See below. Works for v1 size, poor headroom, shares quota with everything else. |
| **IndexedDB** | Typically hundreds of MB or a share of free disk; `navigator.storage.estimate()` reports it. | Async, transactions, many records. | **Best fit.** Per-Song records, atomic multi-record updates, large headroom. |
| OPFS (Origin Private File System) | Same pool as IndexedDB. | Files, async. | Works, but nothing IndexedDB lacks here; less familiar tooling; no transactions. Not recommended. |
| File System Access API (`showSaveFilePicker`) | A real disk file. | Chromium only, permission re-prompt each session. | Great *optional* later add-on for "save in place" and real autosave. Cannot be the baseline. |
| Cache API / cookies | n/a | n/a | No. |

### 4.1 Why not just localStorage

- **Headroom.** A library-size Workbook as pretty text is 1.92 million characters, about 40 % of a 5 M-character quota. The "double" case is 80 %. Minifying would help (1.08 M), but the user wants the stored Song JSON verbatim.
- **Shared quota with a fragile writer.** [writeTutorialProgressToStorage](../../../../Tutorial.js#L293) calls `storage.setItem` without a `try/catch`. If the Workbook consumed the quota, **tutorial Bookmarks and done-marks would start throwing**, and so would any pref save. A big Workbook must not be able to do that.
- **Write cost.** One key for the whole Workbook means rewriting 2 to 4 MB synchronously on every save. Per-Song keys fix that but turn the key space into an ad-hoc database (folders, order, comments in more keys, no atomicity between them).
- **Partial failure.** A quota error halfway through a multi-key update leaves the Workbook inconsistent, with no transaction to roll back.

### 4.2 Why IndexedDB

- One **transaction** can update a Song record and the list data together, so a failed write leaves the previous state.
- Saving one Song writes about 20 KB, not 2 MB.
- Quota is large and separate from `localStorage`, so the existing prefs and tutorial progress are unaffected.
- The App is not on the render hot path when talking to the store: every Workbook operation is user-initiated (open File page, Save, Open). Async fits, the same way `loadSong` is already async via `$.get`.
- `openSong(str)` already takes **text**, so storing the Song **as the text string** from `getPersistentSongFile()` means "Open from Workbook" is `openSong(await store.getSongText(path))` with no conversion and no loss. (Stored as an object, key order and number formatting could change.)

### 4.3 Recommended store layout (IndexedDB database `infinite-neck-workbook`, version 1)

| Object store | Key | Value |
|---|---|---|
| `entries` | `path` (`"DailySongs"` for a folder, `"DailySongs/All-Chords.json"` or `"All-Chords.json"` for a Song) | `{ path, kind: 'folder' or 'song', seq, comment, source, bytes, updatedAt }` |
| `songText` | `path` | the Song JSON text, verbatim |
| `meta` | name | `{ lastBackupAt, changesSinceBackup, formatVersion }` |

- **`seq`** is a counter assigned inside the transaction. Display order is `seq` ascending (the "order of addition" rule), so there is no hot "list order" record that two tabs could clobber.
- Splitting `entries` from `songText` means the File page lists the Workbook without loading 2 MB of text. This split is optional at the sizes expected; if it feels like over-engineering, one store works.
- `source` is the Library href the Song was first saved from (for example `practice/All-Chords.json`), informational and used for the default filename.
- On first use call `navigator.storage.persist()` (best effort) to ask the browser not to evict. Chromium decides by heuristics, Firefox may ask the user, Safari ignores it.

### 4.4 What can go wrong (and the plan)

| Risk | Plan |
|---|---|
| IndexedDB unavailable or errors (some private-browsing modes, blocked storage). | The Workbook block shows a one-line notice "Workbook is not saved in this browser. Use Download Workbook." and runs from memory for the session. Not legacy handling, it is the failure mode of a new feature. |
| `QuotaExceededError`. | Surface the error text in the Workbook block, keep the previous state (the transaction aborted), offer Download. |
| User clears site data, or **Safari removes script-writable storage after 7 days without interaction** (not applicable to a Home-Screen web app). | Backup status line (7.3). The file is the real backup. |
| **Origin scoping.** `http://localhost:8080` and the production site are different origins: "my Workbook disappeared". `http` and `https` are different too. | One sentence in the help file; the Workbook block shows the origin-neutral item count so the user notices an empty Workbook. |
| **Two tabs** writing at once. | Per-entry records and atomic transactions mean the worst case is "last save of the same path wins". The view re-reads on `visibilitychange`; optionally a `BroadcastChannel` to refresh. No lock needed. |
| Older database version in a future sprint. | Version the DB and the file. Under the no-legacy rule there is nothing to migrate in v1. |

## 5. File format

### 5.1 Recommendation

A single JSON document, pretty-printed (indent 2), user-viewable and editable:

```json
{
  "fileType": "infinite-neck-workbook",
  "workbookVersion": 1,
  "savedAt": "2026-11-18T12:00:00.000Z",
  "folders": ["DailySongs", "ClassWeek1"],
  "songs": [
    {
      "path": "All-Chords.json",
      "comment": "Progress notes, free text",
      "source": "practice/All-Chords.json",
      "song": { "myTunings": [ ... ], "sections": [ ... ] }
    },
    {
      "path": "DailySongs/All-Chords-C-Only.json",
      "comment": "",
      "source": "practice/All-Chords.json",
      "song": { ... }
    }
  ]
}
```

- Songs are **verbatim JSON objects** under the `song` property (the design doc's "JSON Songs verbatim, stashed as properties"). On export, each stored text is `JSON.parse`d into the envelope; on import, `JSON.stringify(song, null, 2)` gives back the text for the store. This keeps the file a single valid document that a power user can edit, and keeps the in-store text identical to what **Download Song** would produce.
- **`fileType`** lets the Song opener and the Workbook opener **reject each other's files with a clear message** (a Workbook picked in Open Song, or a Song picked in Open Workbook). Today a Workbook file chosen in the Song file input would be passed to `openSong` and fail confusingly.
- **Array of entries, not an object keyed by path.** An array keeps "order of addition" explicit, makes duplicate paths detectable on import, and avoids building an object from untrusted keys (`__proto__`, which the App already guards against in [appendStylesheetsFromSong](../../../../infinite-neck.js#L2197)). The cost is that a hand-editor must keep `path` unique; import reports duplicates. The alternative, an object keyed by path, is a legitimate reading of "properties" in the design doc: see Q5.
- **`folders`** is a list so empty folders survive a round trip. Folder order in the list is the display order.
- **`comment`** is plain text.
- No instrument badges, no folder summaries (out of scope as stated), but `folders` can become `[{name, ...}]` in a later version, which is why `workbookVersion` exists.

### 5.2 Size

Pretty-printing the nested Songs adds indentation, so the whole library as a Workbook is roughly 2 MB. A static server with gzip delivers it at about 150 KB (measured above on separate files; one combined file compresses at least as well). This is fine for downloading and for "a class shares a Workbook from a server". Minifying is not worth the readability loss.

### 5.3 Names

| Item | Rule (proposed) |
|---|---|
| Characters | `A-Z a-z 0-9 . _ -`, must start with a letter or digit. No spaces, no `/` inside a name. |
| Folder | Max 64 chars, **one level deep** in v1 (the path model `a/b/c.json` allows deeper later). |
| Song filename | The user edits the base name, `.json` is added automatically, max 64 chars before `.json`. |
| Uniqueness | **Case-insensitive** within a folder, because the file may be unpacked on Windows or macOS. |
| Reserved | Windows device names (`CON`, `NUL`, `COM1`, ...) are refused, so names stay "cross-platform-valid". |
| Defaults | The Library folder prefix is stripped: `practice/All-Chords.json` becomes `All-Chords` in the chosen folder (the design doc's rule). Library names with spaces are not a problem because Library names have none. A name typed with spaces gets a one-click "replace spaces with `-`". |
| Folder is fixed in the save step | The save form shows the folder as a read-only choice from a list, not a text box, so the user cannot invent a folder by typing (design doc rule). |

## 6. UI proposal

Placement inside `#divFileControls`, keeping the existing order (nothing moves):

```
Open Song from Local Files ...              (unchanged)
  [Song Library]  (details, unchanged, #divSongList)
  [Workbook]      (details, NEW, own container #divWorkbook, class songLibrarySummary)
Song Name: [............]  Roles: ...
[Download Song] name.json  [Save to Workbook...]     (NEW button, same group)
```

### 6.1 The Workbook block

```
Workbook   (12 songs, 2 folders, 1.4 MB)  [Download Workbook] [Open Workbook...]
  Backup: last downloaded 2026-11-10, 5 changes since    (status line, see 7.3)
  [+ New Folder]
  All-Chords.json        | My daily practice ...             [remove]
  DailySongs  (details, one open at a time like the Library)
     [Add current Song here]  [Rename folder] [Delete folder]   <- first row inside an open folder
     All-Chords-C-Only.json | tiny cells. Practice List hides SUS    [remove]
```

- It uses the **same summary class** as the Library (`songLibrarySummary`), so it matches the look. It is *not* inside `#divSongList`, for the re-render reason in section 2.
- A folder's collapse state is a **view-only** flag (not stored), but it must be preserved across re-renders: every change re-renders the block, and a naive re-render would close the folder the user is working in.
- Song rows: link (calls `openWorkbookSong`), comment cell, remove. The comment is editable in place (commit on blur, the same pattern as the wizard prompt editor `focusout`).
- "Delete folder" is **disabled while it has Songs** (the design doc's rule). Rename folder rewrites the `path` of its children in one transaction.
- Remove Song asks via native `confirm()`, the same style the App already uses.

### 6.2 Save to Workbook (answer to the "where is the widget" question)

Two entry points, one function:

1. **Primary: a `Save to Workbook` button next to `Download Song`.** The user is already looking at the Song Name box there. It reveals a small inline form (folder dropdown, filename prefilled, Save, Cancel). An inline form is preferable to a modal because the App has no modal form facility, only native `confirm()`.
2. **Secondary: `Add current Song here` in an open folder's first row**, which preselects that folder.

Rules:
- If the Song was opened **from the Workbook** and is saved to **the same path**: save silently (no confirm). That is just "Save".
- If the target path exists and is **not** the one this Song was opened from: native `confirm()` "Replace `DailySongs/All-Chords.json`?" (the design doc's overwrite rule).
- Folder default: the folder the Song was opened from, else the last folder used, else the Workbook root.
- Filename default: the opened Workbook path, else the Library file name without folder or `.json`, else `#txtFilename`.

This needs one new tracking variable beside `gCurrentSongLibraryHref`: the current Workbook path (call it `gCurrentWorkbookPath`), set when a Song is opened from the Workbook or saved to it, cleared when anything else is opened.

### 6.3 Open Song vs Open Workbook (design doc open question 1)

**Keep Open Song exactly where it is. Put Open Workbook inside the Workbook block**, below the `Song Library`/`Workbook` level only in the sense that it is not next to Open Song. A user who wants a Song cannot hit it by accident, and a Workbook file chosen in the Song input is refused by the `fileType` check (and the reverse).

### 6.4 Opening a Workbook file replaces the stored one (open question 2)

Browser storage holds **one** Workbook. Open Workbook replaces it, so the flow is:

1. The user chooses a file, which is read and validated *before* anything is touched.
2. If the current Workbook is non-empty and has changes not yet downloaded, a `confirm()` offers: OK to replace, or Cancel to go back and press **Download Workbook** first. No automatic download: browsers may block a download that is not tied to a click, and a surprise file in Downloads is its own confusion.
3. On OK, a single transaction clears the store and writes the new one.

Optional safety net, cheap with IndexedDB: keep the replaced Workbook once as a `previous` snapshot with a "Restore previous Workbook" link. Not needed for v1, listed as Q9.

Merge ("add these songs to my Workbook") is a different feature with collision rules; out of scope. Q9.

## 7. Behaviours

### 7.1 Save on demand

Covered by 6.2. The store write is `getPersistentSongFile()` plus one transaction.

### 7.2 Autosave (wishlist: optional)

There is **no dirty flag for the Song**; the only dirty tracking in the App is for Display Options. Autosave therefore needs one of: a timer that compares the new `getPersistentSongFile()` text to the last stored text, or hooks on many edit paths. A timer is the least invasive, but:

- `getPersistentSongFile()` is not read-only: `updateMemoryModelPreFileSave()` writes into the Song model (visible tunings, anchorage, BPM). Calling it every 30 seconds is cheap (stringify of 20 to 330 KB) but changes state while the user plays.
- Autosave over a Workbook Song means a **practice setup can be destroyed by experimenting** (recording, transposing, deleting Sections), with no undo.

Recommendation: **not in v1.** Later, make it opt-in, **only for a Song that is bound to a Workbook path**, never for a Library-opened Song, and keep one previous version per Song for undo. This matches the "Save on demand, optionally autosave" wording, with autosave as the optional half. Q11.

### 7.3 Backup prompting (open question 3)

Not on every Song addition (it would be ignored within a day). Instead:

- Keep `changesSinceBackup` and `lastBackupAt` in `meta`; a Download Workbook resets them.
- Show the one-line status in the Workbook block ("5 changes since last download", or "never downloaded" in a warning colour past a threshold such as 5 changes).
- Prompt (a `confirm()`) only on **destructive** operations: Open Workbook (replace), Delete folder, Remove Song when `changesSinceBackup` is high. These are the moments a backup matters.
- No `beforeunload` prompt: the data is in the browser store, closing the tab loses nothing.

### 7.4 Downloading the Workbook

Same mechanism as `downloadPlayedNotes`: Blob + `<a download>`. Suggested file name `Workbook-YYYYMMDD.json`, distinct from Song files.

## 8. Things the Workbook cannot carry unless we decide to

These matter because the wishlist wants Workbook entries that feel like a personal practice setup and move between machines.

### 8.1 Tutorial Bookmarks and done-marks

They live in `localStorage` under `infinite-neck:tutorial-progress:<key>`, not in the Song and not in the Workbook. The key comes from `song.tutorial.storageKey` if explicit, else from `gCurrentSongLibraryHref`. Consequences for a Workbook Song:

- A Workbook copy of a Library tutorial that keeps its explicit `storageKey` **shares progress with the Library original**. That may be what the user wants (progress follows the lesson) or not.
- A Song with no explicit key and no Library href falls back to the filename in `#txtFilename`, so two Workbook Songs with the same name in different folders would **share one progress record**.
- None of it is in the downloaded Workbook, so a bookmark is lost on another machine.

Proposal: v1 binds Workbook Songs to the key `workbook/<path>` (so folders do not collide) and documents that progress is per browser. v2 stores `progress` in the Workbook entry (done indexes + bookmark) and includes it in the file. Q12.

### 8.2 Include-in-Looping (the Practice List)

It is reset on every Song open and never saved. A Workbook that promises "Practice List hides SUS chords" (the design doc's own example comment) cannot keep that promise. Options:

- **A** (no Song-format change): store `includeInLooping: [indexes]` on the Workbook entry and restore it into `tutorialRuntimeState` when opening from the Workbook. Workbook-only, Song untouched.
- **B**: persist it in the Song (`song.tutorial`). Works for Library Songs too, but changes the Song format; this is a "top-level file" change that needs its own decision.

Recommendation: A, in v2, with the progress data from 8.1. Q12.

### 8.3 Browser Scaling Prefs override Song cell sizes

At every Song open the saved Scaling Prefs beat the Song's Song-DEFAULTS NoteDisplaySizes (see the header comment in [displayOptionsOpenSizes.js](../../../../templates/display-options/displayOptionsOpenSizes.js#L1)). A user who once clicked Save Scaling Prefs and then makes a Workbook Song with "tiny cell sizes" will find the Workbook Song opens at the Prefs sizes. This is existing, intentional behaviour, so v1 should **not** change it, but the help section on setting up a Workbook must say "Clear Scaling Prefs first" (the clear action exists: `clearScalingPrefs`). Q10 asks whether a Workbook Song should instead win over Prefs.

## 9. Security and safety

- A Workbook file is **untrusted input**, like any shared file. On import:
  - require `fileType` and a supported `workbookVersion`; reject otherwise with a message;
  - validate every `folders[]` and `songs[].path` with the name rules in 5.3, rejecting `..`, backslashes and absolute paths (the existing [normalizeUrlSongPath](../../../../infinite-neck.js#L2432) already rejects `..`);
  - require each `song` to be a plain object; **do not run or open anything at import**, a Song is only opened when the user clicks its link;
  - cap sizes (for example 1,000 entries, 5 MB per Song) so a hostile file cannot hang the tab.
- **Escape everything user-controlled when rendering.** Library descriptions are injected as raw HTML ([SongLibrary.js](../../../../SongLibrary.js#L195)) because they come from the server build. Workbook comments and names come from the user or from a shared file, so they must go through `escapeHtml` (already exported from `InstrumentRoleBadges.js`) and, in `data-action-args`, the existing attribute escaping. Comments are plain text, no HTML.
- A shared Workbook is a way to deliver many Songs, and Songs can contain Macros and plugin state. The trust model is the same as File > Open Song of a downloaded file (opening is explicit, one Song at a time), so this does not widen what a Song can do, but the help file should say "only open Workbooks from people you trust".
- Server-side request forgery does not apply (no server component). A future `?workbook=<url>` loader would be subject to CORS and should only accept same-origin or an allow-list.

## 10. Impact on existing code (least-impact check)

| Area | Change | Risk |
|---|---|---|
| [index.html](../../../../index.html) | New `#divWorkbook` block after `#divSongList`; `Save to Workbook` button + inline form beside `btnDownload`. | Low, additive. |
| [infinite-neck.js](../../../../infinite-neck.js) | New entries in the `dataActionHandlers` table; `gCurrentWorkbookPath`; one `openWorkbookSong` that mirrors `loadSong` but reads the store; reuse of the existing `confirm()` wording through a small shared helper. | Low to medium. This is the only top-level file that must change. Needs the explicit go-ahead per the repo rules. |
| [SongLibrary.js](../../../../SongLibrary.js) | None required. The Workbook renderer is new and reuses CSS classes. | None. |
| [Tutorial.js](../../../../Tutorial.js) | None in v1 (8.1). A follow-up may add a `try/catch` around `setItem`, worth doing regardless because any large `localStorage` use can break it. | Optional. |
| `Song`, `Section`, persistence | **No change.** | None. |
| New modules | A pure model + name validation + file (de)serialization module (Jest-testable, no browser APIs); an IndexedDB adapter behind a tiny `load/save/remove/list` interface (Jest uses an in-memory implementation of the same interface); a small renderer. | Low. Fits the repo's non-browser Jest pattern; the IndexedDB adapter and UI are covered by UI acceptance testing. |
| Docs | A "Set up a Workbook" section in [help.html](../../../../help.html). | None. |

Pre-existing issue to know about: `loadSong` asks "Did you save the current Song with File | Download already?" because there is no dirty flag. Opening a Workbook Song should show the same confirm, reworded to mention the Workbook, via the shared helper. A true dirty flag is out of scope.

## 11. Questions for the Design Team (with recommendations)

Blocking (Q1 to Q8):

1. **Store.** IndexedDB (recommended) or localStorage? *Recommend IndexedDB, section 4.*
2. **Store as text.** Keep each Song as the verbatim JSON text? *Yes, `openSong` takes text.*
3. **Container.** Workbook in its own `#divWorkbook` sibling of `#divSongList`, same summary class? *Yes.*
4. **Folders.** One level deep in v1, root Songs allowed (shown first, like the Library), folders in added order? *Yes.*
5. **File shape.** Array of `{path, comment, source, song}` (recommended), or an object keyed by path as literally worded in the design doc? *Array: explicit order, detectable duplicates, safe from `__proto__`.*
6. **File discriminator.** Add `fileType: "infinite-neck-workbook"` and refuse cross-opening Song and Workbook files? *Yes.*
7. **Save entry points.** Button beside Download Song (primary) plus "Add current Song here" in a folder? *Yes, both call one function; silent when overwriting the path the Song was opened from.*
8. **Open Workbook** lives inside the Workbook block, replaces the stored Workbook after a `confirm()`, no automatic download? *Yes.*

Not blocking:

9. Keep a one-step "previous Workbook" snapshot, and is Merge wanted later? *Snapshot: nice to have. Merge: later.*
10. Should a Workbook Song's saved cell sizes beat the Browser Scaling Prefs? *No change in v1, document "Clear Scaling Prefs".*
11. Autosave: not in v1, later opt-in, only for Workbook-bound Songs, with one undo version per Song? *Yes.*
12. Persist Tutorial progress and Include-in-Looping in the Workbook entry (not the Song), and in the file, in v2? v1 binds progress to `workbook/<path>`. *Yes.*
13. Name rules in 5.3 (no spaces, case-insensitive uniqueness, Windows reserved names refused, 64 characters)? *Yes.*
14. Backup status line plus confirm only on destructive actions (7.3)? *Yes.*
15. "Copy link" for a Workbook Song: `?song=` only works for server files. Omit in v1, or add a `?workbook=` loader later? *Omit.*
16. Soft limits (entry count and size shown in the header, hard caps only on import)? *Show size; cap on import only.*
17. Is `Workbook` the folder label, and is the file name `Workbook-YYYYMMDD.json`? *Yes.*

## 12. Suggested slicing (for Iteration 2 to refine, not a plan)

1. **v1a**: store + model + validation + Save to Workbook + list + open + remove, folder add/rename/delete, comments. Jest for the pure parts.
2. **v1b**: Download / Open Workbook, backup status line, import validation, help section.
3. **v2**: progress and Include-in-Looping in the entry, optional autosave, previous-Workbook snapshot, optional File System Access "save in place" on Chromium.
