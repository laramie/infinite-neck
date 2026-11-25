# sprint-158 Iteration 2 Design

Given the analysis and questions of `158-it1-r1-analysis.md` and the further analysis on instrument badges in `158-it1-r2-analysis.md` and our answers here, please implement a version that gets as much of the design as possible into code.  We expect to tweak that version rather than going through a more formal implementation plan.

# analysis section 8. Questions ANSWERED


1. **Caption versus description rule.** Adopt "caption = short plain text, description = sanitized HTML, comment = User plain notes" across Song, entry, folder and Workbook? *Recommend yes.*

- ANSWER: Accept Recommendation.

2. **No `Song.description`.** Keep all long text in the catalog or Workbook, never in the Song? *Recommend yes.*

- ANSWER:  Accept Recommendation.

3. **File format.** Bump to `workbookVersion: 2` with folder objects and Workbook-level `id`, `version`, `caption`, `description`, accepting a bare folder string as the minimal form? Or keep v1 and put folder text in a parallel map? *Recommend v2 with objects; the string form is a legal minimum, not a legacy path.* Sprint 157 backups in the wild keep opening.

- ANSWER:  Accept Recommendation.

4. **Mount identity.** Refactor `WorkbookUI.js` into a per-mount controller and make the App track `{ mountId, path }`? *Recommend yes, as its own iteration, ahead of any UI for the Tutorial block.*

- ANSWER:  Accept Recommendation.

5. **Progress when the Tutorial changes.** Keep a progress ledger keyed by Workbook `id` + path so re-mounting restores it (H2-B)? *Recommend yes.*

- ANSWER:  Accept Recommendation.

6. **Mount sources.** Library offers only Mount as Tutorial and Download, never Mount as Workbook? *Recommend yes.*

- ANSWER:  Accept Recommendation.

7. **Bundler and source files.** Approve `course.html` and `lesson.html` marker files and a new tool in `./bin/` that writes `songs/tutorials/<course>.workbook.json`, with `update-song-list.js` deriving the Library row from it? *Recommend yes.*

- ANSWER:  Accept Recommendation.

8. **Lesson folders: accordion or independent?** Accordion (`name=` per mount) for consistency with the Library and the Workbook, or independent for a long Course? *Recommend accordion, separate group name per mount.*

- ANSWER:  Accept Recommendation.

9. **External links in descriptions.** Allow only `#open=` and help links for now (what the sanitizer's spirit permits), and take external `https:` links as a later, separate decision? *Recommend yes.*

- ANSWER:  Accept Recommendation.

10. **Caption markup.** Keep `Song.tutorial.caption` plain (3.2 option A), and edit the design's `<i>` examples? *Recommend yes.*

- ANSWER:  Accept Recommendation.

11. **Locking.** No read-only content flag in v1; "re-mount to repair" is the recovery? *Recommend yes.*

- ANSWER:  Accept Recommendation.

12. **`suggestedMount` hint** when a course file is opened as the Workbook? *Recommend yes; it protects the User's Workbook cheaply.*

- ANSWER: Accept Recommendation. 

13. **Per-Song badges inside a mounted Course** carried from the build only (no in-browser derivation)? *Recommend yes.*

- ANSWER:  Accept Recommendation.

14. **Row layout** per H11? *Recommend yes.*

- ANSWER:  Accept Recommendation.

15. **Naming.** Reserve the `.workbook` suffix in Song names, and use `*.workbook.json` for downloads while still accepting any `.json`? *Recommend yes.*

- ANSWER:  Accept Recommendation.

16. **Tutorial block when empty.** Show a hint instead of hiding it? *Recommend yes.*

- ANSWER:  Accept Recommendation.

17. **Retire tutorial Songs from `song-list.json`** once their Course is bundled, and migrate any `?song=tutorials/...` links? *Recommend yes.*

- ANSWER:  Accept Recommendation.

18. **"Update available".** Include `version` compare on Library rows in v1, or defer? *Recommend defer the badge, keep `id` and `version` in the file now so it can be added without another format change.*

- ANSWER:  Accept Recommendation.

# Important Points

We accept the limitation to keeping various properties as simple text, as recommended.

Most importantly, we accept turning the .workbook.json handling into a Factory (H1 Recommendation accepted).  The ramification is that we rescind the requirement that there be only one "Tutorial" workbook mounted.  Instead, the User may mount zero to many .worbook.json files, whether from disk or from our Libary.  These appear *after* "Library" and "Workbook".  So the "Workbook" is simply the first mount, and is built-in and can't be unmounted.  The other mounts can be unmounted.

Thus, the mounts and built-ins could look like this after opening two of our Library courses, and one from "Other-Org".

```
Song Library
Workbook
C100-cowboy-chords
C200-blues
Other-Org-Course-300
```

To support this, we need mechanisms not discussed yet:
1) A set of buttons to allow the User to unmount with reasonable safety: 
  - "Unmount"
  - "Download"
  - "Discard"
  The "Unmount" button is grayed until "Download" is used or is up to date.
  The "Discard" button unmounts, giving one final system confirmation dialog that mounted workbook changes will be lost.
  When Download status is up to date, "Discard" is grayed.
  These would live after `.workbookStatus` in each Workbook/Tutorial.
2) An "Open Tutorial" file control below `#cbAppendGraveyardRecords` similar to `#workbookFileInput` but that targets the factory and a new mount, picking up the .workbook.json file from disk instead of from the Libary, and instead of the built-in "Workbook" mount.  Here the caption is "Open Tutorial" but it really is any .workbook.json file, including non-tutorials.  We'll work this out in the tweak Rounds. This is needed because otherwise there is no way to pick up a Workbook from disk, since there is no `<summary>` div for a Workbook that hasn't been mounted yet.

We will also want a per-mount set of controls for editing the mounted Workbook's description as discussed already.

# Request

Please proceed to best effort approved coding.  Please produce an implementation report of what was built in `158-it2-implementation-report.md`, especially noting any choices you had to make, and noting areas we should check for the next design tweak Iteration.

