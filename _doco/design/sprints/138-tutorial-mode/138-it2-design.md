# Iteration 2 Design

We want to simplify and tighten the design from Iteration 1 based on reviewing our [Iteration 1 Design](138-it1-design.md) and [Copilot's Iteration 1 analysis](138-it1-copilot-design-review.md).

## tutorialMode

- `song.tutorial.level`: `none | strict | wizard`
- runtime author override: `gPresentation.tutorial.tutorialAuthoring: boolean`
- query param `tutorialAuthoring=true` that sets `gPresentation.tutorial.tutorialAuthoring: boolean`.

When the `gPresentation.tutorial.tutorialAuthoring` is set, the Prompt Area widget row will include a checkbox that toggles the UI into fully following `song.tutorial.level` in terms of lockddowns and showing/hiding UI element.  When the checkbox is not checked, the Prompt Area will be shown, but none of the lockdowns will be in effect, and the rest of the UI will be shown normally, so the developer/author can use all the features to set up the tutorial.  When the query param is absent or reversed as `tutorialAuthoring=false`,  `gPresentation.tutorial.tutorialAuthoring` is reset to false. 

- Wizard mode is basically normal mode, but with two features:
  - the tutorial Prompt Area will be shown for each Section
  - the tutorial will specify which semantic areas of the UI to show/hide.
- Strict mode will have one default set of lockdowns.
- Wizard mode will have one default set of lockdowns, but the ability to turn things back on, by specifying a semantic Set in properties.  

- Tutorial Prompt Area will be below the menu buttons, but above any other menu pages, such as palette, Info, Fill, File, etc.  This keeps the menu bar and the logo on top so as to be stable, but keeps the tutorial prompt above other UI elements that may be shown in Wizard mode.  In strict mode, it doesn't matter, since none of these items, especially including Info, will be shown.

- In tutorial strict mode, there will be a bottom strip with links at the bottom of the page. This bottom strip would have the logo, which would be a clickable link to the main app, that is, without a song or tutorial query parameter, a help file link, and a link to the Song Library tutorials block.  .

## New App Splash Screen

In all use, we will introduce a splash screen so that the empty "no tunings" display is not seen any more.  

- If the `tuning=` query param is passed, the User wants a new, blank song with his preferred tuning, so normal mode is shown when the Tuning is available.  

- If the loaded song is a tutorial, the splash screen will launch the tutorial.  

- If the URL is that of a regular song from the Song Library, the splash screen will launch the normal UI with that song loaded.  

- If none of the above, the splash screen will allow Users one of three options with three big buttons: ["Open Tutorial", "Open Song from Library", "Author Song / Play Instruments"] :  
  - "Open Tutorial": Load a Tutorial from the Song Library, by showing the Song Library with the Tutorial branch open.
  - "Open Song from Library": Load a Song from the Song Library, by showing the root of the Song Library.
  - "Author Song / Play Instruments": Open a new, blank song in normal mode, showing the default instrument.

## Chart 

We need to add LeadSheet to fullscreen display, just like Line.  These two then need to be allowed in tutorial mode, since tutorial mode is not fullscreen mode, but we will want these two Chart displays.

When in tutorial mode, Charts should still show active Section, but should not allow clicking a Section or BAR to navigate.

If Section.caption is used for song lyrics and is promoted to visibility through the Chart, then it will be visible for that purpose because Chart LeadSheet will be visible and controlled by the tutorial author through this sprint.

## Build Process for Section Prompts

We have decided to go with a build process to integrate the Section tutorial prompts into the song file, rather than fetches at runtime from html fragment files.  This preserves the concept of the songfile as a stand-alone file, while allowing developers to see all the prompts for all Sectionsrendered on one page, and allowing easy editing in a standard HTML editor.

Additionally, the build process will install Section tutorial captions into each Section from the source file.  The Section.caption is not used as the caption for each prompt now.  Since Section.caption is shown in CaptionRow, it will not be visible in tutorialMode==strict.  Section.caption when used for song lyrics and promoted to visibility through the Chart will be available in tutorial mode.

The target format in the songfile will be: 
`Song.sections[].tutorial.prompt.lines[]`
where `lines[]` is an array of HTML lines escaped for JSON storage.

The source for the build process is a file named after the tutorial songfile with `.prompts.html` extension instead of `.json`.  It will live in the same directory.  For example, the build process will read the file `songs/tutorials/C105/L101.prompts.html` and find the div that correlates to "Section 1" and chop it into lines based on linefeed characters in the file and escape them and build `Song.sections[0].tutorial.lines[]` in `songs/tutorials/C105/L101.json`.

The source file is a single HTML file with all Section prompts. 
- Filename is `${tutorial-songfile-stem}.prompts.html`.
- One discoverable element with attribute `data-caption-for-tutorial="true"` is the source for the `Song.tutorial.caption`. 
- Each Section prompt HTML block is in a discoverable div via `data-prompt-for-section` which uses 1-based User-facing Section numbers.
- Each `data-caption-for-section` contents becomes `Song.sections[].tutorial.caption`. e.g. `Song.sections[0].tutorial.caption` == `Caption for Section 1 - Getting Started`.

Here is an example `L001-1.prompts.html` file:

```html
<html>
<body>
    <h1 data-caption-for-tutorial="true">Chromatic Scale on one string</h1>
    <h2 data-caption-for-section="1">Caption for Section 1 - Getting Started</h2>
    <div data-prompt-for-section="1">
        <p>Prompt for Section 1 goes here</p>
        <p>All html elements, buttons, links, and text pass through to lines[].</p>
    </div>
    <h2 data-caption-for-section="2">Caption for Section 2 - Chords in A Minor</h2>
    <div data-prompt-for-section="2">
        <p>Prompt for Section 2 goes here.
          Whitespace preserved in lines[], but HTML rules of browser cause this paragraph to behave normally.
        </p>
    </div>
    <h2 data-caption-for-section="3">Caption for Section 3 - Chords in E Major</h2>
    <div data-prompt-for-section="3">
        <p>Prompt for Section 3 goes here</p>
    </div>
</body>
</html>

```

Thus, the development process will allow reading `http://localhost:8000/infinite-neck/songs/tutorials/C000-intro/L001-one-string-intro/L001-1.prompts.html` in the browser, which can in its HEAD section pull in `../../../templates/tutorial/tutorial.css` and thus have an easy development editing environment.  When the prompts look acceptable, the build process would be run, updating L001.json which would then be tested in the browser.

Because of this process, we want to simplify and not do <tutorial-btn> transformations. But because of User-to-User shared song files, we will still want html-sanitizer protection from someone getting a tutorial to do something malicious and making it look like it is us doing something like uploading or downloading files or other access.  However, we do want to be able to perform actions as buttons do, and calling raise and macro superlinks as we do in `Info`.  This will need to be discussed and designed.

## Course/Lesson/Tutorial Layout

The tutorials may be laid out into "Courses" (C###) and "Lessons" (L###) with actual tutorials being song files (*.json) and .prompts.html files next to them in the directory (but not listed in the Library because they will be omitted from song-list.json).  Each directory song-list.json can still add per-tutorial description for the Song Library directory listings.

The tutorials in the Song Libary tutorials/ branch will look something like this:

```
./songs/       : is presented as "Song Library"
   tutorials/
      C000-intro/
        L001-one-string-intro/
            L001-1.json : has Song.tutorial.caption: "Chromatic Scale on one string"
            L001-2.json :  Song.tutorial.caption: "C Major Scale on one string"
            L001-3.json :  Song.tutorial.caption: "A Minor Scale on one string"
            L001-4.json :  Song.tutorial.caption: "E Major Scale on one String" 
            L001-1.prompts.html : captions and Section prompts for L001-1.json tutorial song
            L001-2.prompts.html : captions and Section prompts for L001-2.json tutorial song
            ....        
        L002-bass-intro/
            L002-1.json :  Song.tutorial.caption: "Strings of the bass"
            L002-2.json :  Song.tutorial.caption: "A bass in every guitar"
            L002-3.json :  Song.tutorial.caption: "Scales on four bass strings"
            L002-4.json :  Song.tutorial.caption: "Bass for three-chord songs"
            L002-5.json :  Song.tutorial.caption: "Bass for <i>Ramones: I Wanna Be Sedated</i>"
        L003-guitar-intro/
        L004-piano-introl/
      C100-cowboy-chords/
        L101-cowboy-intro/
        L110-cheatin-heart/
        L112-brown-eyed-girl/
      C200-blues/
        L201-blues-intro/
        L202-mustang-sally/
            L202-1.json :  Song.tutorial.caption: "Play <i>Mustang Sally</i>"
      C300-rock/  
        L310-smoke-on-the-water/
      C301-jazz-intro/
        L302-st-louis-woman/
        L310-autumn-leaves/
      C401-progressions/
      C501-soloing/
```

## Prompt Area

We will need to define semantica names for the "Prompt Area" and the html containers needed.  For this document, "Prompt Area" generally means the new div that contains all tutorial display.

The Prompt Area starts with several system-provided rows.  The first of these is the widget row, which includes navigation that would normally be provided by transport and keyboard: [first, next, prev, last].  It also includes tutorial buttons "Done", and "Bookmark".  If the authoring query param has been seen, it will include a toggle button or checkbox that turns on strict mode in the actual UI, hiding things and locking down, or unhiding and unlocking. Additionally, the widget row will include LOOP and BEAT-LOOP buttons.

After the first few tutorials in the Courses, we will need to allow acces to User-selected (but not customizable)
 Themes, and User-selected (but not customizable) Tunings.  The very earliest in each Course will make these choices for the User, but the later ones will need to be designed to be flexible, using Listeners, or offer song flavors for popular tunings, or allow macros via tutorial buttons to swap in Instruments similar to how we do songs in ./songs/demo/ and ./songs/practice/ and ./songs/name-that-note/.  One simple solution may be to provide the Themes dropdown in the prompt widget row.  Other than specific intro lessons that rely on certain Themes, most lessons will benefit from the User being able to own the (built-in) theme choice.

So the Prompt Area is now four rows: 
- a widget row. 
- a Course/Lesson/Tutorial path/breadcrumbs row.
- a Prompt Caption Row with Song.tutorial.caption and Section.tutorial.caption.
- a Prompt HTML div that grows as needed to fit the html authored by the tutorial author stored in Song.section.tutorial.prompt.lines[].

The widget row has:
- Nav buttons,styled like the Transport `#btnFirstSection`, `#btnPrevSection`, `#btnNextSection`, `#btnLastSection`, but with added text in addition to the glyphs from Transport buttons like so: ["⇤ First","« Previous","Next »","Last ⇥"], but all the same basic sizing. "Next" button is green like `.BtnPunchedOut`.
- Done/Bookmark checkboxes with label with background-color `white` when unchecked and `lightgreen` when checked.

Thus the Prompt Path/Breadcrumb and Prompt Caption Rows have:
- Tutorial-Directories: the path to the tutorial file from `songs/`. Examples:
  - tutorials/C000-intro/L001-one-string-intro/
  - tutorials/C200-blues/L202-mustang-sally/
- Tutorial-filename/songfile-name
- Tutorial-Caption: read from Song.tutorial.caption read from the songs when building the Song Library song-list.json and from the songfile when opening the tutorial. Examples:
  - "Chromatic Scale on on string"
  - "C Major Scale on one string"
  - "Play Mustang Sally"
- Section.tutorial.caption 

- Song.Section.caption must be presented somehow.  It may contain lyrics for the Section, but won't be tutorial instructions/caption.

Each tutorial song has a copy-to-clipboard glyph with the link to the tutorial after the Tutorial-songfile-name.  Works the same as songs in the Song Library, loads files by URL. (Because the tutorial listing _IS_ in the Song Library)

A text-based schematic for the layout is:  

```
| ⇤ First | « Previous |  <stretch-whitespace> | []Author-Preview-Checkbox | LOOP | BEAT-LOOP | []Done | []Bookmark | Next » |Last ⇥ |
| Tutorial-Directories | Tutorial-songfile-name | tutorial-copy-to-clipboard-glyph |
| Tutorial-Caption | Section-tutorial-caption |
|     Prompt HTML Area               |                                                          |
```
We'll want enough separate CSS classes (like one per row) so we can style the path/breadcrumbs row to be small-font and more subdued, and for the caption row to be more like the existing caption rows.

# Request

Copilot, please produce an [Iteration 2 implementation plan draft](138-it2-implementation-plan.md), working from [Iteration 1 Design](138-it1-design.md) and [Copilot's Iteration 1 analysis](138-it1-copilot-design-review.md) and the changes specified by _this document_, including and organizing the features, and necessary implementation details, but not the chatty design discussion, and not the rejected design ideas and possibilities.  Prepare questions and point out implementation plan areas that need attention, specification, or design. Expect that this is still a draft, and that areas need work before the implementation plan is complete.