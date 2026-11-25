# sprint-158 Iteration 1 Round 1: Analysis of the tutorial-Workbooks design

Status: design analysis only. No code was changed. Facts marked "verified" were read from the code or the sprint documents named in the text. Statements about browser behaviour (`<details name>` support, find-in-page, click handling inside `<summary>`) come from general knowledge of the platform and **were not tested in a browser**.

Inputs: [158-design-it1-r1.md](158-design-it1-r1.md), [sprint-158.md](sprint-158.md). Earlier decisions this builds on: [157-design.md](../157-workbook/157-design.md), [157-it1-analysis.md](../157-workbook/157-it1-analysis.md).

## 1. Summary

1. **Course = Workbook fits the existing Workbook format without deeper folders.** A Workbook allows one folder level ([validateSongPath](../../../../Workbook.js)). `Course (Workbook) > Lesson (folder) > Song` is exactly that. Nothing in the design needs nested folders, so the "accordion or outline" question can be answered with the `<details>` pattern already in use (section 5).
2. **"Tutorial IS_A Workbook" is true for the data format but false for the code today.** The Workbook UI is a singleton: one IndexedDB name, one `#divWorkbook`, one `#workbookFileInput`, one `gCurrentWorkbookPath` string. A second mount point needs a "mount identity" threaded through about a dozen places (section 6, H1). This is the largest hidden cost in the sprint.
3. **"Caption" and "description" can be cleanly separated** with one rule: *short plain text is a `caption`, long sanitized HTML is a `description`, a user's own notes are a `comment`.* Section 3 gives the full table, and it says where each one lives in the Song, in the Workbook file, in `song-list.json` and in the build.
4. **The design's caption examples contain `<i>` tags, which `Song.tutorial.caption` cannot hold today.** It is plain text by design (section 3.2). Decide whether to keep that or to relax it.
5. **Replacing the Tutorial mount wipes the progress of the course that was mounted** (verified: [replaceFromParsed](../../../../Workbook.js) does `clearAll`). A student who switches courses loses Done marks and Bookmarks. This needs a decision before any code (H2).
6. **A Workbook description from a downloaded file is untrusted HTML.** The existing sanitizer helps but has one global link allow-list that does not fit this use (section 4).
7. 18 questions for the Design Team, each with a recommendation, are in section 8.

## 2. How the pieces work today (verified)

| Fact | Where |
|---|---|
| Library: `<details class='songLibraryRootDetails'>` containing one `<details name='songLibraryDirectoryGroup'>` per directory. Directory = first path segment of `href`. | [SongLibrary.js](../../../../SongLibrary.js) |
| So `tutorials/C000-intro/L001-one-string-intro/L001-1.json` is listed flat under directory `tutorials`. The Course and Lesson folders are not shown at all today. | `getDirectoryFromHref` in [SongLibrary.js](../../../../SongLibrary.js) |
| Library `description` and `directoryIntros[].html` are **raw trusted HTML** from `song-list.json`, written by hand. `instruments` and `SectionCount` are derived by the build. | [SongLibrary.js](../../../../SongLibrary.js), [bin/update-song-list.js](../../../../bin/update-song-list.js) |
| The only tutorial in the list, `L001-1.json`, is described as `"One-string Intro"` in `song-list.json`, while its own `Song.tutorial.caption` is `"Intro to stringed instruments: playing on one string"`. **Two texts for one Song already drift.** | [songs/song-list.json](../../../../songs/song-list.json), [L001-1.json](../../../../songs/tutorials/C000-intro/L001-one-string-intro/L001-1.json) |
| `Song.tutorial` = `{ level, caption, storageKey?, useCaptionForSectionCaption? }`. `Section.tutorial` = `{ caption, prompt }`. | [SongPersistence.js](../../../../SongPersistence.js), [SectionPersistence.js](../../../../SectionPersistence.js) |
| `Song.tutorial.caption` is **plain text**. `/vpe` strips tags and decodes entities; the build takes it from `textContent` of `<h1 data-caption-for-tutorial>`; "it is never used as the caption of a Section". | [help.html](../../../../help.html), [Tutorial.js](../../../../Tutorial.js), [bin/build-tutorial-prompts.js](../../../../bin/build-tutorial-prompts.js) |
| The tutorial build reads `<song>.prompts.html` and embeds captions and prompts into one Song JSON (`npm run build:tutorial-prompts`). The marker idiom is `data-caption-for-tutorial`, `data-caption-for-section="n"`, `data-prompt-for-section="n"`, parsed with parse5. | [bin/build-tutorial-prompts.js](../../../../bin/build-tutorial-prompts.js), [L001-1.prompts.html](../../../../songs/tutorials/C000-intro/L001-one-string-intro/L001-1.prompts.html) |
| Workbook file: `{ fileType, workbookVersion: 1, savedAt, folders: string[], songs: [{ path, comment, source, progress, includeInLooping, updatedAt, song }] }`. Folders are bare names, so **a folder cannot carry text in the file format today**. | [Workbook.js](../../../../Workbook.js) `buildWorkbookFile`, `parseWorkbookFile` |
| Inside IndexedDB a folder is already an entry object (`{ path, kind:'folder', seq, comment, ... }`), so the store can carry folder text without a schema change. Only the file format drops it. | [Workbook.js](../../../../Workbook.js) `replaceFromParsed`, `exportFile` |
| Workbook rows: link = file name, middle cell = an editable `comment` input (plain text, 2000 characters, escaped). No instrument badges, no description. | [WorkbookUI.js](../../../../WorkbookUI.js) `renderSongRow` |
| `WorkbookUI.js` keeps module-level `model`, `providers`, `ui`; `container()` is `#divWorkbook`; the DB name is the constant `infinite-neck-workbook`. | [WorkbookUI.js](../../../../WorkbookUI.js), [WorkbookStorage.js](../../../../WorkbookStorage.js) |
| The App holds one `gCurrentWorkbookPath`. Bookmark/Done and Include in Looping are read and written through `getWorkbookSongState(gCurrentWorkbookPath)` and `updateWorkbookSongState(gCurrentWorkbookPath, ...)`. | [infinite-neck.js](../../../../infinite-neck.js#L228), [infinite-neck.js](../../../../infinite-neck.js#L623), [infinite-neck.js](../../../../infinite-neck.js#L661) |
| `openSong()` already refuses a Workbook file (checks `fileType`, not the extension). `parseWorkbookFile` refuses a Song file. | [infinite-neck.js](../../../../infinite-neck.js#L2392), [Workbook.js](../../../../Workbook.js) |
| Sanitizer: one tag allow-list (no `details`, `summary`, `img`, `button`, `input`), one class allow-list, and **one global anchor allow-list**: `#raise=`/`#macro=` fragments, `help*.html#...`, and `?song=<path>.json` app queries. | [html-sanitizer.js](../../../../html-sanitizer.js), [app-action-fragment.js](../../../../app-action-fragment.js) |
| Click handling for `#raise=` and `#macro=` links only runs inside `#divInfoRendered`, `#divTutorialPrompt`, `#lblSongWidgets`, `.lblSectionCaption`. A link elsewhere is inert. | [infinite-neck.js](../../../../infinite-neck.js#L4551) |

## 3. Caption, description, comment: what each is and where it lives

### 3.1 The words today

| Name | What it is | Plain or HTML | Lives in | Written by | Shown where |
|---|---|---|---|---|---|
| `Song.tutorial.caption` | Main title of a tutorial Song | Plain text | Song JSON | build (`prompts.html`) or `/vpe` | Heads the Prompt Area in wizard and strict mode |
| `Section.tutorial.caption` | Title of one step | Plain text | Song JSON | build or "Edit Caption" | Prompt Area |
| `Section.caption` | The Section's own caption | Template-expanded HTML | Song JSON | author | Caption row |
| `Song.info` | The Info page | Sanitized HTML | Song JSON | author | Info page |
| `song-list.json` `description` | One Library row's text | Trusted HTML | catalog | **by hand** | Library row |
| `directoryIntros[].html` | A Library directory's intro | Trusted HTML | catalog | by hand | Top of the directory |
| Workbook entry `comment` | A User's progress notes | Plain text, escaped | Workbook (never the Song) | User | Workbook row, editable |

Observation: the Library already follows the rule "**catalog text lives in the catalog, Song text lives in the Song**". The Song carries no description. `song-list.json` carries it. Sprint 158 should extend that same rule to Workbooks rather than put new text fields into the Song.

### 3.2 The design's `<i>` captions

The design lists captions such as `"Bass for <i>Ramones: I Wanna Be Sedated</i>"` and says a caption is "succinct and mostly text plus `<b>` and `<i>`". Today that is not possible: the stored caption is plain text, tags are stripped on entry, and it is escaped when rendered. Two options:

- **A. Keep plain (recommended).** Italic song titles in a one-line caption are cosmetic. No change to the Song format, `/vpe`, the build or the sanitizer. Write `Bass for "I Wanna Be Sedated"` instead.
- **B. Allow a tiny inline subset (`<b>`, `<i>`, `<em>`).** Needs a change in `Song.tutorial.caption` handling in [Tutorial.js](../../../../Tutorial.js), `/vpe`, the build parser, and render sites; it also makes every caption consumer (rows, summaries, `title` attributes) HTML-aware. That is a Song and Tutorial change, which the SOP says to discuss first.

### 3.3 Recommended model: one rule, three words, four levels

- `caption`: short, one line, **plain text**.
- `description`: longer, **sanitized HTML** (the existing allow-list: `p`, `b`, `i`, `a`, `table`, lists, headings, and so on).
- `comment`: the User's own **plain-text** notes. Never authored by a course builder.

| Level | caption | description | comment | Source of truth |
|---|---|---|---|---|
| **Song** (in the Song file) | `Song.tutorial.caption` (exists) | none. Do not add `Song.description`. | none | The Song |
| **Entry** (a Song row in a Workbook) | `entry.caption`: a read-only **snapshot** of `Song.tutorial.caption` taken when the Song is bundled or saved. Cache only. | none in v1 | `entry.comment` (exists) | Caption: the Song. Comment: the Workbook. |
| **Folder** (a Lesson) | `folder.caption` (optional) | `folder.description` | none | The Workbook |
| **Workbook** (a Course) | `workbook.caption` | `workbook.description` | none | The Workbook file |

Why the snapshot on the entry: `getView()` lists from the index and does not read Song text ([Workbook.js](../../../../Workbook.js)). Showing a Song's caption without parsing up to 1000 Song texts (5 MB each at the cap) means copying it into the entry. Because the snapshot is a cache of the Song, it is refreshed every time the Song is saved to the Workbook, and **it is never edited in the list**. To change a caption the author opens the Song, runs `/vpe`, and uses Save to Workbook. This matches design principle 1 of sprint 157 (reuse what the App already does).

**Precedence for the row text** (answers "what precedence does `Song.tutorial.caption` take"):

1. Link text: `entry.caption` if present, else the file name. The file name moves to the link's `title` tooltip and to a small muted suffix.
2. The comment input stays as the second cell. It is never replaced by the caption, so a student's notes and the author's text never overwrite each other.
3. `Section.tutorial.caption` and `useCaptionForSectionCaption` are about steps, not Songs, and do not enter the Song's row.

**Library row for a bundled Course.** The text comes from the Workbook file, copied by `update-song-list.js` into the `song-list.json` entry, exactly the way it already copies `instruments` and `SectionCount` out of Song files. So the Course author maintains one place (the course source folder), not two. This fixes the `"One-string Intro"` versus `"Intro to stringed instruments..."` drift. The Library row's `description` is the **caption plus counts** (for example "12 songs in 4 lessons"), not the full description; the full HTML description appears once the Course is mounted.

### 3.4 Where this lives in the build

Reuse the `.prompts.html` idiom. Suggested source files in each Course folder (names are placeholders):

```
songs/tutorials/C100-cowboy-chords/
   course.html                  <h1 data-caption-for-course>, <div data-description-for-course>
   L101-cowboy-intro/
      lesson.html               <h2 data-caption-for-lesson>, <div data-description-for-lesson>
      L101-1.json
      L101-1.prompts.html
```

A new Node tool in `./bin/` (call it the bundler for now) would:

1. Run the existing prompts build per Song, or `--check` that it is current.
2. Read each Song JSON verbatim into `songs[].song`; read `Song.tutorial.caption` into `entry.caption`; compute `SectionCount` and the instrument summary (reusing `extractInstrumentSummaries`).
3. Read `course.html` and `lesson.html` for the description fields; sanitize at build so a bad source fails the build.
4. Assign `seq` by sorted names. The `C###-` and `L###-` prefixes already make that the intended order.
5. Write `songs/tutorials/<course>.workbook.json`.

`update-song-list.js` then lists the `.workbook.json` and drops the individual tutorial Song entries, so there is one Library row per Course. This is a design sketch, not an implementation plan.

## 4. Authoring descriptions in the app (`.workbookToolbox`)

The request: a "description" property with a control in `.workbookToolbox` that opens an editor like `#songWidgetsEditor`, and a display element below the controls and above the file list.

Recommendations:

- **Placement.** A `description` block right after `.workbookToolbox`, before `.songLibraryRows`. The editor button in the toolbox toggles an inline `<textarea>` in that block; leaving the field (blur) commits, as the tutorial prompt editor does ([infinite-neck.js](../../../../infinite-neck.js#L691)). Escape or double-Enter to cancel, matching `/vpe`.
- **Storage.** In IndexedDB, the `meta` store (a new key such as `info`), counted as a change for the "not downloaded" warning. In the file, top-level properties of the Workbook.
- **Sanitize on render and on read, not only in the editor.** A downloaded file can contain anything. Sprint 157 decided comments are escaped because shared files are untrusted ([157-it1-analysis.md](../157-workbook/157-it1-analysis.md) section 9); a rich description cannot be escaped, so it must be sanitized with the existing allow-list, both when `parseWorkbookFile` reads a file and when the block is rendered. Add length caps (suggest 20,000 characters for a Workbook, 5,000 for a folder) next to `MAX_COMMENT_LENGTH`.
- **Links: the current sanitizer cannot express "open that Song in this Workbook."** Verified in section 2:
  - `?song=` links open a **Library** Song (a server path), not a Workbook Song.
  - `#macro=` and `#raise=` run against the **current Song** ([handleInfoActionFragment](../../../../infinite-neck.js#L4600)). A Course description is shown with no Song necessarily open, so these make no sense there, and the description block is not in `ACTION_LINK_CONTAINERS`, so they would be inert anyway.
  - Recommendation: add one new, narrow link form, for example `#open=<lesson>/<song>.json`, validated with `validateSongPath`, resolved **against the same mount the description is in**. No cross-mount links. For descriptions, reject `#raise=` and `#macro=`. This means making the sanitizer's anchor check take a "profile" (Info page versus Workbook description), which is a small change in a top-level file ([html-sanitizer.js](../../../../html-sanitizer.js)) and needs explicit approval.
  - The design says "for now we will let links be allowed and lock them down later." The sanitizer already locks them down: it has no external (`https:`) link form at all. Suggest keeping it that way: allow **only** `#open=` and help links, and treat external links as a separate, later decision (Q9).
- **Folder (Lesson) descriptions** use the same editor, placed as the first block inside the folder body, under the folder tools row.
- **Tables** work (the sanitizer allows `table`, `tr`, `td`, `th`, `thead`, `tbody`). That covers "summarize the course in a table".
- **No `details` or `summary` in descriptions** (not in the tag allow-list). Keep that; collapsible text is what Lessons are for.

## 5. Native `<details>` / `<summary>`: what it gives us and what to watch for

### 5.1 What it already does for us

- Open/close, keyboard (Enter, Space) and screen-reader semantics, with no JavaScript.
- `name=` makes a group exclusive (an accordion). The Library already uses `songLibraryDirectoryGroup`, the Workbook `workbookFolderGroup`.
- Closed content is still in the DOM, so there is no lazy-render code to write. At the Workbook limits (1000 Songs, 200 folders) that is fine.
- Find-in-page opens a closed `<details>` that contains a match in current Chromium. Not tested here.

### 5.2 What it does not do

- **The open state lives only in the DOM.** Any `innerHTML` re-render resets it. That is why `captureOpenState()` exists in [WorkbookUI.js](../../../../WorkbookUI.js) and why `ui.openFolders` is a `Set`. A Tutorial mount needs its own copy of that state, which falls out naturally if the controller becomes an instance (H1).
- It does not remember anything across page loads. Same as today; do not persist it.

### 5.3 Pitfalls for this sprint

1. **Group `name` is page-wide, not per parent.** All `<details>` with the same `name` on the page form one group, even in different blocks. The Workbook block and the new Tutorial block are on the same File page, so the Tutorial block **must use its own name** (for example `tutorialFolderGroup`); sharing `workbookFolderGroup` would make opening a Lesson close the Workbook's open folder.
2. **Never reuse an ancestor's `name` for a descendant.** If nested levels were ever added, each depth needs its own group name or opening a child closes its parent.
3. **Keep interactive controls out of `<summary>`.** The tools row is already in the body, not the summary ([renderFolder](../../../../WorkbookUI.js)). Browsers differ on whether Space in an input inside `<summary>` toggles. Keep the summary as a short label plus a count.
4. **Put the description in the body, but make the collapsed state informative.** If the root block is collapsed, the description is hidden. Show the mounted course in the root summary (for example `Tutorial: Cowboy Chords (12 songs, 3/41 steps done)`), so the student can see what is mounted without opening it. Open the root automatically after a mount (the Workbook does this already: `ui.rootOpen = true`).
5. **Lesson progress belongs in the Lesson `<summary>`** as text (`L101-cowboy-intro (3/4 songs started)`), computed from the in-memory entries. Do not read `localStorage` per row, as the Library does today in `renderTutorialProgressBadge`.
6. **Browser support for `name` grouping** is recent (Chromium 120, Safari 17.2, Firefox 130, from general knowledge). Older browsers fall back to independent open/close, which is harmless. The site already depends on this.

### 5.4 Answer to "accordion or outline for deeper subfolders"

- Workbook folders are one level deep by design and by validation. Course, Lesson, Song needs only that. **Do not add deeper folders in this sprint.**
- The Library lists the bundled Courses flat under the `tutorials` directory (that is also how it works now). One level there too.
- If a future "Program" Workbook needed Course folders containing Lesson folders, native nested `<details>` would work with a distinct `name` per depth and open-state keyed by full path. Note it, do not build it.
- Use the **accordion** (`name=`) per mount for Lessons, as the Workbook folders do now. Outline style (independent) is the default of `<details>` without `name`; it is better for a long Course where a student wants Lessons 1 and 3 open together. Suggest accordion for consistency, and call it out in Q8.

## 6. Holes and usability gaps, in priority order

### H1. The Workbook code is a singleton (largest cost)

"Tutorial inherits all features of Workbook" is only true if the Workbook code becomes instantiable. Today (verified):

- DB name is a constant (`infinite-neck-workbook`); a second mount needs a second database (or a mount-prefixed key space).
- `#divWorkbook`, `#workbookFileInput`, `#btnSaveToWorkbook`, `#divSaveToWorkbook`, `#workbookNewFolderName` are fixed ids; two blocks need distinct ids or class-based scoping.
- `ui` (open folders, sort, message) is module state.
- `providers.getCurrentWorkbookPath()` returns one string. The App needs `{ mountId, path }` wherever it calls `getWorkbookSongState` / `updateWorkbookSongState` ([infinite-neck.js](../../../../infinite-neck.js#L623), [L641](../../../../infinite-neck.js#L641), [L664](../../../../infinite-neck.js#L664), [L674](../../../../infinite-neck.js#L674)).
- The Save-to-Workbook form needs a destination ("Save to: Workbook / Tutorial").
- The `visibilitychange` re-read, the status line, and the backup counter are per model and must be per instance.

Recommendation: turn `WorkbookUI.js` into a factory, `createWorkbookController({ mountId, label, dbName, container })`, and keep `WorkbookModel` (already pure and adapter-based) unchanged. This is a refactor of a top-level file and of the App's `gCurrentWorkbookPath` handling, so it needs explicit approval and should be its own iteration, with Jest on the pure parts (the model already has tests).

### H2. Switching Tutorials destroys the previous Tutorial's progress

`replaceFromParsed` clears everything. Mounting Course B over Course A deletes A's Done marks, Bookmarks and Include-in-Looping, and the confirm dialog only warns about *undownloaded changes*, which a student may never have made. Same problem when a Course is updated and re-mounted.

Options:

- **A. Warn only.** Simple, hostile to students.
- **B. Keep a small progress ledger keyed by Workbook `id` + Song path** in IndexedDB, outside the mounted content. Re-mounting the same `id` (a newer version, or switching back later) restores progress by path. Content is replaced, state is not. **Recommended.**
- **C. Several mounted Tutorials.** Rejected by the design ("two tutorials cannot be mounted at once"), and it multiplies UI.

Option B needs a stable `id` in the file (see H3) and a rule for path mismatch after an update: drop state for paths that no longer exist, and clamp indexes to the new `SectionCount` (the sanitizer already works with section counts).

### H3. Workbook identity and versioning

The file needs an identity separate from its file name: `id` (stable, for example `C100-cowboy-chords`), `version` (course content version, integer or date), `caption`, `description`, optional `author`. Without `id`, H2-B and "update available" in the Library are impossible. Recommend: `id` required for a tutorial Course, optional for a User Workbook (a User Workbook gets a generated one on first download).

File-format change: the current format has `workbookVersion: 1` and `folders: string[]`. Adding Workbook-level fields is additive. Giving folders text means folder objects. Recommend bumping to `workbookVersion: 2` with `folders: [{ name, caption?, description? }]`, and having the parser accept a bare string as the minimal form of a folder. That is one line and is not "legacy handling": the string is still a legal minimal folder. This is a policy call (Q3), because the SOP says "no legacy" while Sprint 157 users may already hold downloaded v1 backups.

### H4. Two ways to mount, and one of them can destroy the User's Workbook

`Workbook > Open Workbook` replaces the User's Workbook. A student who picks a downloaded *course* file there will replace their practice list with a course. The existing confirm helps only if there are undownloaded changes.

- Library rows for Courses should offer **Mount as Tutorial** and **Download** only. Never "Mount as Workbook".
- Add an optional file property `suggestedMount: 'tutorial'` (set by the bundler). When such a file is opened through the Workbook control, show: "This looks like a tutorial course. Open it as the Tutorial instead?" A native `confirm` is two-way (OK = Tutorial, Cancel = stop), which is the safe default. The user's UA note in sprint 157 (dialog catches attention better than red text) argues for the dialog here too.
- Without a `kind` flag, a Tutorial is just a second slot of the same type. That keeps IS_A true and lets a User author a Course in the Workbook (wizard mode plus Save to Workbook) and then mount it as a Tutorial to test it, with no build tool. That is the cheapest answer to "allow authoring of tutorial Workbooks".

### H5. What a Library row for a Course shows and does

A new row type, labelled with the full name `C100-cowboy-chords.workbook.json`, plus:

- caption and counts (lessons, songs, size in KB);
- a **Course-level instrument badge set**: the union of roles across its Songs, computed by the bundler;
- `[Mount as Tutorial]` and `[Download]`;
- state: "mounted", or "update available" when the mounted `id` matches and `version` differs (needs H3).

Mounting from the Library is a `GET` plus `parseWorkbookFile` plus the same replace path as a local file. No file picker. Use an explicit `kind: 'workbook'` in the `song-list.json` entry rather than sniffing `.workbook.json` in `href`.

### H6. Per-Song instrument badges and progress badges inside a mounted Workbook

Sprint 157 left badges out of the Workbook because they need the build. For Courses the bundler already has the data, so `entry.instruments` and `entry.SectionCount` can be carried as optional, build-written, read-only fields (sanitized by `normalizeInstrumentSummary`). User Workbook Songs would simply lack them. Deriving them in the browser at save time would need `extractInstrumentSummaries` lifted out of the Node-only [bin/update-song-list.js](../../../../bin/update-song-list.js) into a pure module; recommend deferring that.

The progress badge `(done/total)` needs `SectionCount`; `getProgressBadgeModel` ([Tutorial.js](../../../../Tutorial.js)) already accepts it on an entry, so the same function can serve Workbook rows.

### H7. Two progress stores for the same lesson

Bundled Songs keep progress in the Workbook mount. The unbundled `songs/tutorials/.../L001-1.json`, opened through the Library or a `?song=` link, keeps progress in `localStorage` keyed by href ([Tutorial.js](../../../../Tutorial.js)). The design says unbundled files "share only name"; that is also true of progress, so the two never sync. Recommend: remove tutorial Songs from `song-list.json` once their Course is bundled (so there is one Library path to a lesson), keep the unbundled files for developers only, and say so in the developer docs. Check Info pages and prompts for `?song=tutorials/...` links and migrate them to the `#open=` form.

### H8. Naming

- `.workbook.json` is a **convention for people and for listings**. `fileType` stays the only thing the code trusts (as `openSong` and `parseWorkbookFile` do now). Keep it so; a renamed file must still open.
- `SONG_BASE_PATTERN` allows single dots, so `x.workbook.json` is a legal *Song* name inside a Workbook. Reserve the `.workbook` suffix in Song names to avoid confusion.
- Download names: today `Workbook-YYYYMMDD.json` ([workbookDownloadName](../../../../Workbook.js)). New: `Workbook-YYYYMMDD.workbook.json` for the User's Workbook, `<id>.workbook.json` for a Tutorial. Open must still accept any name ending in `.json`.
- The `accept='.json,application/json'` on the file inputs is fine.

### H9. The Tutorial block is empty most of the time

`#divWorkbook:empty` is hidden today ([song-library.css](../../../../song-library.css#L202)). An empty Tutorial block should not be hidden: show a one-line hint ("No tutorial mounted. Choose a Course from Song Library > tutorials, or Open Workbook below") so students can find it. The Library's `tutorials` `directoryIntros` entry (currently "Tutorial Songs") should be rewritten to explain Mount versus Download in two sentences.

### H10. Should a student be able to edit a mounted Course?

Because Tutorial IS_A Workbook, a student can remove Songs, rename Lessons, and reorder. Re-mounting from the Library repairs it (and with H2-B, progress survives). So no read-only flag is needed in v1. If it proves a problem, a later optional `locked: true` file property could hide Remove and Rename in the Tutorial mount only. Defer (Q11).

### H11. Row layout

Library rows have three cells (link, description, instruments). Workbook rows have three cells (link, comment, actions). A Course row in a mounted Workbook wants caption, comment, badges, progress and actions. Suggest: link cell = caption (file name in `title`) plus the progress badge; middle cell = comment input with the instrument badges below it; actions cell unchanged. This keeps three columns, so [song-library.css](../../../../song-library.css) needs few changes.

### H12. Sorting by caption

The Workbook's A-Z sort compares **file names**. For Course content that is the intended order (`L101-1`, `L110-1`), so keep the sort on file names even though the row shows captions. State that in the help text, or the sort will look wrong when captions are shown.

### H13. Safety of Workbooks from other institutions

Same stance as sprint 157: parsing does not run anything. New items: sanitize `description` and `caption` on read; reject `id` that does not match a conservative pattern; cap lengths; and remember that a Song inside a file can still contain Info HTML and Macros, which the App already treats as untrusted at Song open. Do not auto-open a Song on mount.

### H14. Size and limits

Limits today: 1000 Songs, 200 folders, 64-character names, 5 MB per Song. `L001-1.json` alone is about a thousand lines with prompts; a Course of 30 Songs is expected to be well under a few MB (not measured; measure when the first real Course exists, as sprint 157 did). A mount downloads the whole file; HTTP caching makes the second mount cheap.

### H15. Tests

Keep to the project pattern (no browser, no jQuery): pure string-builder tests for the new Library row and the Tutorial block, `parseWorkbookFile` v2 cases (folder objects, bad ids, over-long descriptions, hostile HTML), the description sanitizer profile, the bundler (given a temp Course folder, produce expected JSON), and the mount-identity helpers.

## 7. Where each requirement in the design lands

| Design item | Answer in this analysis |
|---|---|
| Library lists tutorial Workbooks | Section 6 H5; one row per Course, `kind: 'workbook'`, derived by `update-song-list.js` from the Workbook file |
| `.workbook.json` naming and styling | H8: convention only; `fileType` is authoritative; reserve the suffix in Song names |
| Course folder maps to a bundled file; directory listing disappears | 3.4 and H7: bundler writes it; tutorial Songs leave `song-list.json`; unbundled files stay for developers |
| Separate mount points Tutorial and Workbook | H1: needs a controller factory and a mount identity |
| Mount versus Download | H4, H5: Library offers Mount as Tutorial and Download only |
| Which input mounts where | H4: separate inputs and ids; `suggestedMount` hint protects the Workbook |
| Directory description in `song-list.json` and the build | 3.3, 3.4: `directoryIntros` stays hand-written for Library directories; Lesson and Course text comes from `course.html` and `lesson.html` |
| Song caption and description | 3.3: caption is the Song's (`Song.tutorial.caption`), description is not a Song property |
| Workbook `description` and editor | Section 4 |
| Precedence of `Song.tutorial.caption` | 3.3: it is the single source for tutorial Songs; the entry caption is a refreshed cache; `comment` is separate |
| Instrument badges in listings | H5 (Course-level) and H6 (per Song, build-supplied) |
| Deeper subfolders and `<summary>` | Section 5: one level is enough; native `<details>`; distinct `name` per mount |

## 8. Questions for the Design Team (with recommendations)

Q1 to Q7 block coding.

1. **Caption versus description rule.** Adopt "caption = short plain text, description = sanitized HTML, comment = User plain notes" across Song, entry, folder and Workbook? *Recommend yes.*
2. **No `Song.description`.** Keep all long text in the catalog or Workbook, never in the Song? *Recommend yes.*
3. **File format.** Bump to `workbookVersion: 2` with folder objects and Workbook-level `id`, `version`, `caption`, `description`, accepting a bare folder string as the minimal form? Or keep v1 and put folder text in a parallel map? *Recommend v2 with objects; the string form is a legal minimum, not a legacy path.* Sprint 157 backups in the wild keep opening.
4. **Mount identity.** Refactor `WorkbookUI.js` into a per-mount controller and make the App track `{ mountId, path }`? *Recommend yes, as its own iteration, ahead of any UI for the Tutorial block.*
5. **Progress when the Tutorial changes.** Keep a progress ledger keyed by Workbook `id` + path so re-mounting restores it (H2-B)? *Recommend yes.*
6. **Mount sources.** Library offers only Mount as Tutorial and Download, never Mount as Workbook? *Recommend yes.*
7. **Bundler and source files.** Approve `course.html` and `lesson.html` marker files and a new tool in `./bin/` that writes `songs/tutorials/<course>.workbook.json`, with `update-song-list.js` deriving the Library row from it? *Recommend yes.*
8. **Lesson folders: accordion or independent?** Accordion (`name=` per mount) for consistency with the Library and the Workbook, or independent for a long Course? *Recommend accordion, separate group name per mount.*
9. **External links in descriptions.** Allow only `#open=` and help links for now (what the sanitizer's spirit permits), and take external `https:` links as a later, separate decision? *Recommend yes.*
10. **Caption markup.** Keep `Song.tutorial.caption` plain (3.2 option A), and edit the design's `<i>` examples? *Recommend yes.*
11. **Locking.** No read-only content flag in v1; "re-mount to repair" is the recovery? *Recommend yes.*
12. **`suggestedMount` hint** when a course file is opened as the Workbook? *Recommend yes; it protects the User's Workbook cheaply.*
13. **Per-Song badges inside a mounted Course** carried from the build only (no in-browser derivation)? *Recommend yes.*
14. **Row layout** per H11? *Recommend yes.*
15. **Naming.** Reserve the `.workbook` suffix in Song names, and use `*.workbook.json` for downloads while still accepting any `.json`? *Recommend yes.*
16. **Tutorial block when empty.** Show a hint instead of hiding it? *Recommend yes.*
17. **Retire tutorial Songs from `song-list.json`** once their Course is bundled, and migrate any `?song=tutorials/...` links? *Recommend yes.*
18. **"Update available".** Include `version` compare on Library rows in v1, or defer? *Recommend defer the badge, keep `id` and `version` in the file now so it can be added without another format change.*

## 9. Suggested order of decisions

This is not an implementation plan. It is the order in which the answers constrain each other:

1. Q1, Q2, Q3 fix the data model and file format.
2. Q4, Q5 fix the code structure (mount identity, progress ledger).
3. Q6, Q12, Q15, Q16, Q17 fix the user flow and naming.
4. Q7, Q13 fix the build and what the listings can show.
5. Q8, Q9, Q10, Q11, Q14, Q18 are presentation and policy choices that can follow.

Files that would be touched if all recommendations are accepted (for your approval, none changed here): [Workbook.js](../../../../Workbook.js), [WorkbookStorage.js](../../../../WorkbookStorage.js), [WorkbookUI.js](../../../../WorkbookUI.js), [SongLibrary.js](../../../../SongLibrary.js), [infinite-neck.js](../../../../infinite-neck.js) (mount identity, new inputs, link handler), [html-sanitizer.js](../../../../html-sanitizer.js) and [app-action-fragment.js](../../../../app-action-fragment.js) (the `#open=` form and a description profile), [index.html](../../../../index.html) (the Tutorial block), [song-library.css](../../../../song-library.css), [bin/update-song-list.js](../../../../bin/update-song-list.js), and a new tool in [bin/](../../../../bin/).
