# Feature: file info

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

