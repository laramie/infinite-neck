# sprint-138-tutorial-mode Design

# Purpose: 

Purpose of this sprint is to: 
- Create a tutorial mode for simple viewing of songs with a minimum of UI or advanced features.

- Provide a prompt area similar to Info area, but follows Section like Caption does, and not editable when in tutorialMode:strict.  

- Within this area, simplified, buttons map to standard, safe actions such as "enter tutorial", "start looping", "save tutorial bookmark" and so on using custom html element tags such as `<tutorial-btn>`.

- Allow level of tutorial mode:
  - tutorialMode : strict :  very little way to escape doing anything but navigating Sections with simple next/prev/first/last, reading prompts, and looping.  A simple way for tutorial author to put palette into "keep" mode seems useful.  This level of strict is for allowing a User to navigate a song, see the notes and read the prompt, play along on a physical instrument, but not change the song.
  - tutorialMode:advanced : advanced user who understands infinite-neck features but still wants to enjoy a guided lesson with a minimum of UI bells-and-whistles.  May add optional macro links to click.  May add more keyboard shortcuts to change View options.  May add command-line access, etc.  May allow users to add notes as part of the learning process.
  - tutorialMode:wizard : allows most UI features, keyboard shortcuts, menus, and command-line, but still walks advanced User through things they can do to enhance their learning, expand their understanding of features.  So retains the tutorial guide elements such as prompt, and maybe add highlighting of UI elements.  Not in scope for this sprint.
  - author : we need some way for an author to escape tutorialMode, so they can set View options, etc., while still seeing prompt area and testing tutorial-btn and macros.  Possibly through query param.  Editing the prompt files is through the filesystem with developer access to the server.

# Use-cases

## Beginner plays three-chord-wonder

User opens song, sees prompt directing User to place fingers on real-world guitar to match Fingerings in Section 1.  Advises User to click Next when achieved. (Next is a `<tutorial-btn>` that advances to nextSection, and marks `Section.tutorial.seen=true`).
User sees Section 2, sees prompt directing User to place fingers according to Section 2.  Advises User to click Next when achieved.
Section 3 does the same.  Advises User that he has completed tutorial, and can practice the tutorial in LOOP mode and introduces the LOOP button.
Link in last Section points to next tutorial.

## Beginner plays Blues song

User opens song, sees prompt directing user to read the Chart, which is shown, and to compare highlighted first chart chord with chord on Instrument.  Advises User to advance to Next.  
Second Section prompt points out that Chart Section 2 is highlighted and that Instrument chord has changed.
Next Sections advise User to practice chord per Section, and last Section encourages User to LOOP.
Link in last Section points to next tutorial.

## Beginner gets chord theory

User opens tutorial song and is advised that song from last tutorial (link to tutorial provided) will now be shown with Note Function in addition to Note Name, which is all that has been shown previously.  Lesson points out use of Note Function.  
Subsequent theory lessons can introduce UI elements and demonstrate their use to actual playing techniques.

# Features not implemented

  - Wizard mode will be like non-tutorial normal mode but with ability to see the tutorial prompt and no tutorial UI restrictions.  Additionally, Wizard mode will allow highlighting of labels for UI elements to guide Users.  Wizard mode will not be implemented in this sprint--we just want to keep it in mind when designing tutorial mode.  For example, in Wizard mode, the prompt area will likely be above the menu buttons so it can stay in the top row during User UI training.  So this informs where the prompt area is inserted: likley above the buttons, but in a full-screen-like display with no buttons showing.  
  - Similarly, in Advanced mode, showing the Song Caption bar may be available.

# Guidelines

  - Keep changes to the UI and features of non-tutorial mode to an absolute minimum.
  - Let the tutorial mode ride on top almost like a different presentation in terms of outer chrome.  Prompt area should be on top of UI, and the rest of the UI should look like full-screen mode, with elements locked down as described below.
  - Allow minimal changes to core:
    - Presentation::tutorialMode should be a simple state holder
    - Tutorial.js should be a new module with class Tutorial (probably Singleton) that does most of the driving, by setting tutorialMode, and then calling features in code the way an advanced User would do, while relying on infinite-neck.js to hide various aspects of the UI once switched off explicity by Tutorial.js or by Presentation::tutorialMode.

    
# Keystroke lockdown

- key-handlers.js will get a simple bypass to a simpler method with limited key handlers.  Rather than have branching within `document_keypress()` there should be one test that returns early if key pressed is not in the set allowed by each tutorial mode.  Thus Presentation.tutorialMode=="strict" has the fewest keystrokes, then Presentation.tutorialMode=="advanced" has more, and so on.

# div lockdown

- Keep the Instrument fretTable area exactly the same.
- Allow captionRow to be locked in hidden state.
- Allow tdLeftRailStack to be shown, but controlled by tutorial author or macros.
- Allow td.diamondsRow to be shown.  Tutorial author will set MyTunings, which won't be available to User.
- divTopControlsCaptions should mostly be hidden, except in Wizard mode can be shown.


# Tutorial class data model

A song is authored to be a tutorial.  That means that any authoring of the tutorial that can be made to work
with the Song/Section plumbing should do so, such as View options, type of notes used and shown, plugins set up, Wirings, Chart, Palette options, stylesheets, Themes.

Tutorial class will need to have state related to the entire tutorial that doesn't fit in the Song/Section current persistence.  It should keep most of this in its state which should easily persist via JSON to a block within the Song.

```
Song.tutorial {
    level: <strict|advanced|wizard|author,none>,
    allowedUI: [divMenu, fretTable, captionRow, tdLeftRailStack, diamondsRow]  /* these should be mapped through Presentation somehow rather than actual IDs or CSS classes.  For example Presentation.allowedUI.fretTables covers all `fretTable` instances.*/

}
```

Some state will need to be stored per Section.
Song.sections[1].tutorial {
    prompt: "1.shtml",
    seen: true,
}

Tutorial songs will occupy a directory-per-lesson-group.  So two tutorial songs may be in the same directory if they are intimately related, cover the same lesson group, or may even share prompt files.

The per-Section prompts should be HTML, stored in .shtml files in a directory-per-song, like so: 
```
songs/tutorials/tutorial1/
    1.shtml : This is an HTML fragment that gets presented in the tutorial prompt area for Section 1.
    2.shtml : fragment for Section 2
    3.shtml : fragment for Section 3
    tutorial1.json : this is a song file, which has a Song.tutorial property containing all the JSON  needed to define Tutorial class, and has Song.Section.tutorial.prompt pointing to one of these .shtml fragments.

```

# Out of Scope

## tutorial separate from song

While it seems attractive to have a tutorial ride on top of a Song file and thus allow two tutorials to drive the same song, this design is rejected in this sprint since being able to tie the tutorial prompts to stable song Sections wins.  Thus, each tutorial Section-specific information should live *in* the Section itself in the Section.tutorial property.  Except that the prompt itself lives in an .shtml fragment file for ease in editing. 

## User persisted data

Browser storage should be utilized to store which tutorial Sections have been completed.  And this should be available to mark the Song Library directory listings.