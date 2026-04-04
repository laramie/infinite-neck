We need to handle layouts of Instruments for infinite-neck.

You should be able to follow the structure of our repository by following the documents from README.md .

The main domain object for this app is Song in Song.js, and it is persisted in a "song file" which is a JSON representation that the user can download and upload.  We also have pre-built songs in the ./songs library available as songs/song-list.json.

The main app file is infinite-neck.js .

Synonyms: tables, noteTables, NoteTable, Instrument.
The real implementation is NoteTableController.js who builds HTML tables we call noteTables.  These get system-wide unique IDs, such as tblS6_1, tblP4_1, tblBass_1. 

The prefix comes from: 
    Constants.js::export const TABLE_ID_PREFIX = "tbl";
So it's 
    tableID = Constants.TABLE_ID_PREFIX+Tuning.baseID    

The Instrument is based on a Tuning, which is prototyped from the JSON in tunings.js, 
and cloned into myTunings, which lives in Song, and has a View managed by TuningsLibrary.js

Once a row for that Tuning is in myTunings, when the first column checkbox is clicked, a noteTable comes into the DOM.  (We are going to change that behavior a bit.)  The noteTable is built strictly on the spec in the Tuning: the MIDI values determine the Note numbers in each row cell in those rows.

The View management of noteTables, however, is what we want to rework.

Currently, if the checkbox is clicked in myTunings, a noteTable is built and inserted, in myTunings order, into #tabledest as a DIV with DIV and TABLE children.  If the User clicks "Float", that div is detached from the DOM and put under management of dockable.js which it manages the window resizing via window._dockableFloatState .

The new design should continue to use the following rules:

If a noteTable is not Float, then it is docked, meaning it lives in #tabledest in the order it appears in myTunings.

If a noteTable is Float, then it is managed by dockable.js.

However, we don't want a bunch of globals hanging out on the "window" object, just the minimum needed to make dockable.js work.

What we want is a combination of classes that will owned by the Song model, and therefore persisted to the song file (e.g. All-Chords.json).  These new classes should look like this:

Layout (Layout.js)
    API:

    model:
        ID: "string"    (e.g. "FullBand", "FirstMovement", "SecondMovement", "Chorus", "Verse", "A-Section", "Guitars") 
        main [
            "tblP4_1": {},
            "tblBass_1": {}
        ]
        floating {
            "tblS6_1": {
                left: 12,
                top: 12, 
                width: 1000,
                height: 300
            }
            "tblS6_observer": {
                left: 12,
                top: 312, 
                width: 1000,
                height: 300
            }
        }
            

LayoutManager (LayoutManager.js)
    API:
        getLayoutIDs() - return simple js string Array of Layout IDs
        getLayoutSelect() - return formatted HTML select of layout IDs
    model: 
        layouts {
            "FullBand": {Layout object},
            "Chorus":   {Layout object}
        }

Every time a User hits "Float" or the thumbtack to "dock" the window, that is remembered in Layout, which should save its state in Section.

Each Section has viewOptions, so we want a similar structure, but not as part of viewOptions because that system is getting complex.  Each Section will have a dropdown SELECT that is built by LayoutManager.getLayoutSelect().  When a User chooses a Layout in the SELECT, the Section persists that choice, so that when the Song calls nextSection(), the Layout is consulted and all the tables go to their correct spots in the DOM, either #tabledest, or in dockable.js .  We'd like to do this with detach and attach, so we don't have to rebuild the noteTable. It's clearAll() method will be called anyway, clearing out all the Notes and display classes on every Section change.

The Layout in effect in the Section gets carried over to the next Section, unless a User clicks a "Save Layout" button named "btnSaveLayout" and a name in an edit box called "editLayout".  The a new Layout is added to the LayoutManager, with the visible windows in effect, and their states of either being docked in myTunings order in #tabledest or with position and the fact of Float in dockable.js.

One of the motivating issues, and therefore something to get right, is that it is currently possible to Float a noteTable, then unclick and click the checkbox in myTunings, and a new instance will be built in #tabledest, thus duplicates.  When the checkbox is unclicked again, the float window becomes empty or orphaned.  So rather than that checkbox existing, we'd like to manage it with the Layout.  So the Layout will need a DIV that appears on the Section menu page that lets the User chose which Tunings will be visible.  By default, once a Tuning is cloned, it should be visible, and should be in #tabledest and added to the Layout in effect.  If the User Float's it, the Layout takes note.  But the user can then go into the Layout and deselect that noteTable from this Layout.  However it should remain in a list of things to add to the Layout in either main or floating.

A word on Views.  We have a predominant way of doing the GUI, but we like a new way we are dealing with control panel DIVs.  This is the pattern in ./templates/ . Currently we have the wirings panel built using these three files:

    ./templates/templates.css
    ./templates/templates.html
    ./templates/WiringBuilder.js

So we would like the View/Controller here:

    ./templates/LayoutController.js
    ./templates/Layout.html
    ./templates/Layout.css
    ./templates/LayoutManagerController.js
    ./templates/LayoutManger.html
    ./templates/LayoutManger.css

And the model here:

    ./Layout.js
    ./LayoutManager.js


For the first step, let's do a design review before writing any code in the repository.

We'd like to see your proposed implementation of concrete classes in the chat, along with any features that are implied in what we've specified but not spelled out properly or fully.

We'd especially like to pin down the User flows, and holes in the specification around losing Layouts because of navigation between Sections.

Then we'll do another design iteration and then commit some code.

Thanks!







