# Ideas after reading 138-it1-copilot-design-review.md

We should install a splash screen because current screen exposes moment before tunings installed, which is awkward.  More importantly, in tutorial:strict we don't want to expose *anything*, especially menus.

Change `<tutorial-btn>` to `<tutorial-button>`

Make a mock-up of limited transport as the top row of the tutorial prompt with the big, built-in buttons.

Add tutorial specific buttons to this row: Section completed, Tutorial completed, (Bookmark Section/tutorial Bookmark)

We need to add LeadSheet to fullscreen display, just like Line.  These two need to be allowed in tutorial mode.