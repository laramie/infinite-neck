# Iteration 1 Round 1 Design

Purpose of this sprint is to: 
- Create a "Workbook" feature, where a User can save Songs from our library, customized, annotated, with rudimentary bookmark/link helpers, to both Browser persistence and downloaded file-sharable format. 

Purpose of this Iteration is to define the wishlist, and in Rounds to Copilot, assess the feasibility, best choices for scaling in the Browser, and least impact on existing features and code in the App.  To this idea of "least-impact", consider the following points:

1) IMPORTANT: Copilot, anywhere a feature is dreamed up in this design phase, consider how that feature can be implemented in Workbook by using features currently found in the App, even if it means writing Macros, Creating template SongWidgets, or utilizing Tutorial authoring or Wizard mode.  A few extra steps for the User in a well-documented process in the helpfile is preferable to fancy workflows in the App.  Simple steps in the App will be necessary and desireable to add, such as folder and file management of course.

2) More on the philosophy of the extent of feature impact on the codebase:
  - We don't have a library of Macros, so we are not talking about a complex set of built-in macros.  Our process is to make such features either built-in in the core, or in a plugin.  But a simple Macro that a User could create or paste is fair game.  
  - More likely would be a Macro that lives in a Song that lends itself to being customized, for example, any of the Songs that have transposition could be easily customized by a graveyard/raise link or a Macro, and the User could be expected to edit Song Info to save these choices.  
  - The User temporarly becomes a developing Song author, saves the Song to the Workbook, then can resume being an end-User by clicking on a Song in the Workbook and playing along or practicing.

## Workbook feature wishlist

- When the User is working in the Browser, they can:
  - save on demand
  - optionally autosave
  - save the entire Workbook (multiple Songs) to a single-file format for download, filesharing, and reloading from another machine.  

- We don't want to replicate features of Tutorial mode, but want to eventually promote its features for use in Workbook.  
  - Most prominent eventual features to surface are:
    - the "Practice List" `/vtwp`
    - the Tutorial Bookmarks
  - Nice-to-haves:
    - User annotations perhaps reusing either the Caption or the Tutorial Caption features, or even Tutorial Prompts, similar to how Wizard mode is able to edit the Prompt area and how it may be desireable to make both Wizard mode and Workbook edit Tutorial Captions and Tutorial Prompts.
  - The User is allowed today to become power-user, wizard-author, song-author, end-user, etc., all without formally changing roles or logins.  Therefore, these features may be available right now, for example the "Practice List" is effectively wide-open and available now with a few menu choices.  That is an acceptable set of steps for the initial versions. 
  - It may be that some of these features require persisting session-only choices, and for these we will want to track and push these into the sprint. 
  - Many features, such as simply turning on Presentation Mode so that cell widths and heights are persisted, are good-to-go as they are now and don't need promotion.  It will be up to documenting these in the helpfile in the new section on how to set up a Workbook. 


- Given that we like JSON as the universal format for all our internal and User-facing file formats, the Workbook should also be User-viewable and User-editable for the power-user and thus be JSON.  We imagine that the best Workbook format is thus JSON Songs verbatim, stashed as properties in a Workbook JSON file.  We are concerned about file size, but if the file size can be stashed in Browser Storage safely using any of the Browser API strategies, within the current practices of Browser use, then we are OK.  We prefer that over any kind of binary format or zipped or tarred format.  The size of the Workbook can be considered to be the entire libary at this point in time.  The current number of Songs, if added to a weekly practice list, would be a full-time occupation to practice, so is a good normal scaling guess.  It is possible someone could try to place an entire course for a class in a Workbook and then share that "Libary" file on a server to all students, in which case the size might double but certainly not increase tenfold.

- We want the Workbook to be similar to the Song Libary, but we don't want all the features, for example, the Instrument Badges require server-side files and build process, so they are out of scope for Workbook.   However, we might as well plan for a little bit of structure, even if not implemented in the first versions.
  - plan for collapsing Folders, but without per-folder summaries.
  - plan for link to song in Workbook
  - plan for User-supplied comment per Song, to be similar to how Songs in the Library have a description per Song, since that info will not be carried over from the Libary.  For now, User will keep progress notes in this User-supplied comment.
  - All Songs in Workbook are saved at once, or whenever one Song is saved the Workbook is updated. It is not possible to have two Songs open, and we don't intend any fancy features such as Appending between Workbook Songs.  Append should continue to work with a regular Song, and this Song can be saved to Workbook.
  - Songs should have a JSON-filename name just like regular Songs.
    - Library folder will probably have to be stripped from song name.
    - Library Songs have spaces in names removed by server-side developers, so this should be enforced in names chosen by User for Workbook Songs.  They really should be the same filename, but we don't want to force the issue.  In other words, if a User selects `Song Libary > practice/All-Chords.json` while in `Workbook` then they should be given the default of `Workbook > All-Chords.json` and if they had created `Workbook > DailySongs` and saved to there, they should be given the default of `Workbook > DailySongs/All-Chords.json` and be allowed to edit that to `Workbook > DailySongs/All-Chords-C-Only.json`, but not to edit `DailySongs` folder name in that step.  Additionally, `Daily Songs` is disallowed, since we will consider User folders to be space-free, cross-platform-valid filenames.
    - Overwriting a song that exists by that name in Workbook should be protected by a pop-up modal Confirm dialog, but allowed. 

- To satisfy the above, the initial version could have these features:  
  - Provide an always present top-level openable folder `Workbook`, below and sibling to `Song Library` e.g. `summary.songLibrarySummary`
  - For initial versions, almost no CRUD or list-ordering of Workbook.  Simply:
    - While under `Workbook`
      - Add a folder
      - Delete a folder if it has zero songs
      - Rename a folder
      - while a folder is "open" have a first row with a button to: 
        - Add a Song
        - More CRUDL features may grow in this row.
      - in a row for a Song:
        - Add a comment/progress note to a Song
        - Click link to open Song
        - Remove a Song

- The UI on the `File` menu page should thus have structure like: 
```
Song Library 
  demo
  practice
  ...
Workbook
  user-folder-1
  user-folder-2
    user-saved-song-1.json
    user-saved-song-2.json  
```

The user songs would have a simple listing.
- Re-ordering the list is out of scope for now, and should just be in order of addition, first first, last song saved last within each folder.
- Folders should also be in added list order.  
- Sorting and list management will come later.
- song listing looks like this : `<span>user-saved-song-1.json</span><span>My daily practice using the All-Chords song, but in C and F, with tiny cell sizes.  Practice List hides SUS chords.</span>`  where `span` is simply representative of showing two cells, not the actual storage or identification in the DOM.         
    
## Required features not designed yet

Not decide yet are issues around how to load in a Workbook from local disk:
- Should the Open widget live below the `Song Libary`/`Workbook` level so that Users don't open a Workbook when they want to open a Song, thus blowing away their current Workbook?
- Should a Workbook be downloaded automatically when opening a Workbook, or is it viable and non-confusing to have multiple Workbooks in Browser storage (we think simpler to have only one in Browser storage, and prevent User from deleting Workbook except by process of downloading one first.)
- When should User be prompted to make backup of Workbook?  On every Song addition?
- Where is the UI widget for `Save Song to Workbook`?  Is it in same block as `Download Song` or is it within folder of `Workbook` or within `divSongList`.  

## Iteration 1 Round 1 Request

Copilot, please analyze the above feature wishlist and discussion, and propose a first version plan.  This would be a design plan so we can check features, work-scope, and make UI decisions.  This is not an implementation plan.  Please discuss options of safe and scalable Browser storage and file format.  

# Iteration 1 Round 2 : implementation

We like the analysis very much.  

We like the proposed UI layout.  Proceed to create the UI as proposed.

All the recommendations, especially in the `Questions for the Design Team (with recommendations)` section, are ACCEPTED. (Including the most important choice of Accepting the recommendation to use IndexedDB.)  Coding of v1 including core files is APPROVED.

The way we read the questions and recommendations, v1a and v1b are APPROVED to implement now and together.

We will wait for version v2 for all v2 choices and options deferred to v2.  None of the v2 choices need to be implemented.  This way, we can evaluate v1 and decide which persisted features we will need.  We like that all the v1 recommendations are safe and sensible.  Thus, the primary things that are not saved today will continue to be unsaved in v1, which is good: No autosave, no Workbook merge, no override of scaling prefs, no Practice List persistence, no tutorial progress other than the step `v1 binds progress to workbook/<path>` which seems good and simple.  As we work on v2 we will no doubt decide on regular Song persistence of these things for the same sprint iteration.


