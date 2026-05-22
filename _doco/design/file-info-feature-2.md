# Feature: file info

## Document Version

- this is version 2, for Iteration 2: Design
- version 1, for Iteration 1: Design, is persisted in: `_doco/design/file-info-feature-1.md`

## Design Wishes

We would like an 'info' feature for all songfiles.

This is a chunk of html that is stored in the JSON of the song file, under location `Song.info` and escaped as necessary for JSON, preserving html tags and html entities when revived.

The purpose is for Users to write informational comments about the Song, and any instructions, such as "Works best with Auto-color off" or even whole HTML-formatted descriptions.  But it is a div that lives inside a body--we supply the body and the stylesheet since this is a child of our single-page web app.

The entry into this feature is through new command-line menu item /fi with trigger `i` and caption `info`.  There is also an entry via a top-level menu button, described below.

The implementation of the feature is an html div in the style of all the other top-level menu pages, therefore, we will be adding a matching top level menu button for it, "Info" with no trigger or matching keymapped letter. It lives between the File and Chart buttons. 

However, it should match the newer style of `palette` so that it has a 'float' button and that creates a floating window with a pin to get it back to docked.

Within that div, we want a fake tabs control as implemented in divTunings, where there is a tab for "My Tunings" and a tab for "All Tunings".  Use the same styles and colors as the tabs controls in divTunings.

We want one tab for viewing the info as rendered HTML, tab caption "Info".  We want a second tab, tab caption "Edit" for editing the info in a resizeable textarea that hopefully is as big as its container.  There is no save button.  On losing focus, it should persist to the Song.

Additionally, we need a Song.openInfo property, so that if Song.openInfo is set and the song is opened, its info is shown in the following ways:
- `Song.openInfo == "none"` : don't show info
- `Song.openInfo == "float"` : show the div and float it
- `Song.openInfo == "parked"` : show the div in its parked location on index.html. 

This value is set by a SELECT above the textarea on the second tab, "Edit" of the tabs control page.  When it is selected, it should persist to the Song. The caption, left of the SELECT is "Show info on opening Song:" 

The showing of the info page on startup is identical to if the User mashed on the "Info" menu button, or used command-line `/fi`.  That is, on first showing, the "Info" page is shown with rendered HTML, but the tabs controls and the editing tab are fully available as normal.  There is no attempt to make this pop-up like a modal dialog or read-only.

There should also be a "Close" button centered on the bottom of the "Info" tab page, for Users who don't know yet that ESC will close the window, and any menu page in infinite-neck. Right of the button should be a span with text "Or hit ESC to close".

There is a small bug in our floating window system that is scheduled for a later sprint.  If you can work around this in this sprint for this window so that it fully goes away, so much the better.  The bug is that if you float a window, then hit ESC, the div gets display:none, but the window stays around as a tiny floater with just the pin icon.  

We would prefer if the builder style used to create this followed transport, section-drawer, palette and SectionStatus/section-status, so that it lives in templates/info/ with files like 
- `templates/info/info.html`
- `templates/info/info.css`
- `templates/info/info.builder.js`

SectionStatus may be the most evolved, but is a widget, not a page.  palette* looks to be the latest code, so may be the best to follow. There may be some sorting out and figuring out which is the latest and most evolved of these templates, so before coding, let's do a design iteration and solve that.

Please provide an analisys of this design, comparing the componentization of the various templates as applicable to the info template, and noting any other design holes, shortcomings, or problems. 

## Iteration 2: Design

This Iteration is still in the design phase.  We are answering questions from 'Iteration 1: Design' and Copilot's response: `_doco/design/file-info-feature-copilot-1.md`

### Design Team Comments

We are happy to have the problems of the floating windows described.  If they can be fixed simply for this info page and for this sprint, let's do it.  That can be the demonstration model for how we go back and fix the rest of the floating windows.  There is a later sprint planned that also includes a window manager with layout manager, so it's a bigger conversation.  We don't need to fix the other windows now, but if fixing it means fixing the files that manage floating windows, and those fixes can be reasonably applied to the current codebase, we'd prefer that as an iteration within this sprint.  We don't want to fix shared code with "legacy" code handlers, or optional params sprinkled around.  We accept the design to manage just this window close through the builder API, below.

### Questions Answered

#### No hacks

HTML-only validation, no script injection, no href or action attributes, no css injection, no STYLE tags, no SCIPT tags, no IFRAME, no external resources, no HTML controls or buttons.  If it is considered safe to allow inline styles, then we would allow that.  If there are known CSS injection hacks, then we'd disallow it.  This is not a help builder, just a way to allow Users reasonable presentation of comments with features like H1, H2, UL, OL, etc. Probably html comments should be disallowed as there is no use case and some features could be snuck in as perhaps some frameworks use custom html comments for this-n-that.  Hopefully there is a jQuery method or DOM method for simply stripping down to simple HTML, so we don't need any repo dependencies.

Songfiles may be shared between users, so sanitation is key.

#### Empty Song.info

Empty Song.info : don't show.  We don't want boilerplate from infinite-neck either.  As we author demo songs, those will have info in them for specific instructions on the Song.  So it is primarily for the Song author (either User, or demo song creator) to decide on the text or total absence.

#### Persisting event-handling: 

- keep blur because it matches the requested UX
- also persist on change
- persist on tab switch away from Edit
- Let's add the feel-good checkmark button after the SELECT on the same line.  It appears next to the txtFilename and others, allows for the User to blur textarea, and simply has this: `<button type="button">✓</button>`  In this case since it could be confused with somehow checking the SELECT, add the caption `&nbsp;&nbsp;Save:` in front of the button.

#### property defaults

Default Song.info to "" and Song.openInfo to "none" in constructor.  Other than adding these to every new song or openned song, no legacy handling.  If the user saves the song, they get the new fields.  If they don't, they don't.  If the song is missing these fields, they default as shown, then the system treats it as a no-op and does not show info.  If the user later launches info, they get an empty textarea and a blank html div.  Button and command-line entry points always remain visible.

#### Empty Info Behavior

If Song.openInfo implies showing the info, but Song.info is empty or pure whitespace, ignore Song.openInfo and reset it to Song.openInfo = "none".  On persistence or acceptance of textarea edits, pure whitespace and trailing whitespace should be trimmed.  Leading whitespace in front of visible text characters should be preserved.

#### First show of tab
- reset to the rendered Info tab on song load and on first explicit show after song load
- after that, preserve the current tab: Tunings preserves the selected tab even after ESC.  We should emulate that.

#### Floating Close Semantics

- add an Info-specific close path in the feature design
- the Close button and ESC handling for Info should call InfoBuilder.hide()
- InfoBuilder.hide() should ensure both the content page and any floating wrapper are removed or docked cleanly
- better fixes for dockable.js are deferred to a later sprint.

#### Menu Registration

- use #divInfo only as a parking slot
- use #info as the visible menu page and the item registered in AllMenuDivs

#### Command-Line And Key Trigger Language

Correct: the letter `i` only functions within the command-line because it is a static menu item with trigger `i` under parent menu item `/f` "file".  so `/fi` functions like any other command-line.  The letter `i` is not mapped as a global key handler the way other menu buttons take advantage of.

####  HTML Editing Ergonomics

Keeping it simple: the raw HTML is available in the "Edit" tab, the rendered in the "Info" tab.  No preview.  Changing tabs away from "Edit" should cause persitence and changing tabs to "Info" should cause re-render.  There's no User-facing way to edit the info other than this one textarea, so this should suffice.  We do allow expansion of allowed tokens in Section Caption, but that is not implemented here, so the content is static.  We won't support widgets or allowed expansions, so no events should be needed.  The only state change is User updating through the textarea.

### Request

In general, we approve Copilot's report, especially around the architectural shape of files, directory, and best practices from other templates.  All the recommendations are Approved, except a few tweaks in our answers above.

Please review this Iteration's answers.  If they are sufficient, please write the implementation plan in
`_doco/design/file-info-implementation-plan.md`

We will approve the implementation plan before proceding to coding changes.




