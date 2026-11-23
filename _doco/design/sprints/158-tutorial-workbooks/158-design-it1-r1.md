# sprint-158 Design

## Sprint Design Goals

We want to extend the Workbook pattern to include tutorial Songs, and to organize tutorials in the Library by Workbooks: listed, displayed, and available for download.  What "displayed" means is to be determined in this sprint.

We have these areas to be concerned with: 

- How the Library lists tutorial Workbooks.

- Naming and displaying Workbooks as their own entity parallel to Song files.  We already deal with this when opening a JSON file, so we just need to make this obvious with 1) having workbooks have an extra extension: `*.workbook.json`, 2) Displaying this name in listings ("C100-cowboy-chords.workbook.json"), 3) additional styling in listings TBD.

- Mapping of Course folders to Workbooks, e.g. `./songs/tutorials/C100-cowboy-chords/` becomes available as bundled file `./songs/tutorials/C100-cowboy-chords.workbook.json`, and thus `./songs/tutorials/C100-cowboy-chords/*` directory listing is no longer presented in "Library" directory listing.  

  - The directory would still exist with exploded contents for the build process and developer editing and testing, and anyone with the link could still open the latest un-bundled Song file therein.  
  - Unbundled files share only name with bundled files and bundled files are thus a frozen version placed as part of some build process into the .workbook.json file.  
  - All infinite-neck Library Course names are unique, so for our tutorials, these .workbook.json files can live under ./songs/tutorials/`.  
  - Other institutions' tutorial Workbooks would be hosted on their filesharing sites, so a User would download them separately and mount them in infinite-neck, so would end up in "Tutorial" or "Workbook" as single folders as explained below.

- It currently seems valuable to have separate mount points for "Tutorial" and "Workbook".  So if a User is working through a Tutorial, they can still maintain their personal practice list without having to unmount and remount it.

- How the Library allows digging into Workbooks without the User downloading or "opening" them.  Thus, opening the folder in the Library could, in fact, mount the Workbook and allow inspection of its contents as though the folders and Songs within were mounted in the Library. We currently reject this strategy for the one presented below. 

- For now, we opt to have this be two separate cases: 1) Mount, 2) Download.  

  - "Mount" would require the User to "mount" the tutorial Workbook by clicking on the Workbook file mounting link. Now the tutorial Workbook appears in a third, top-level folder on the File menu page, so there are three siblings: 1) Library, 2) Tutorial, 3) Workbook.  
    - "Library" is the existing Library folder.  
    - "Tutorial" is the new, mounted tutorial Workbook, replaceable by any other tutorial mounted this way from our Library, or mounted from User local disk. 
    - "Workbook" is the existing mount point for the User Workbook. 
  
  - Two tutorials can not be mounted at once, so there are no more than three top-level folders in this spec. 
  
  - We retain the name "Workbook" to generally mean the User Workbook mounted by default in the app, unless we say something like "tutorial Workbook", or "generate a Workbook file".  
  
  - Actually, since "Tutorial" IS_A Workbook, once mounted it inherits all features of "Workbook" -- file order preservation, Practice List privileges and persistence, bookmark and progress persistence, download ability, etc.
  
  - "Download" would allow the User to simply download the entire tutorial Workbook to their local system for mounting as their "Workbook" later, or for mounting as "Tutorial" later, or for filesharing with others, e.g. as courseware. 

  - The mechanism of determining where a User mounts a Workbook file is: 
    - If the User clicks `Workbook > Open Workbook`  i.e. `#workbookFileInput`, then that .workbook.json file is mounted in the app under "Workbook".
    - If the User clicks `Tutorial > Open Workbook` (new, parallel control to `#workbookFileInput`) then that .workbook.json file is mounted in the app under "Tutorial".

- How Directory description text is mananged
  - in song-list.json and our build process
  - in Workbooks, curated by a User

- How Song caption and description are handled
  - in song-list.json and our build process
  - in Workbooks, curated by a User
    - Here, we would like a "description" property and matching control in `.workbookToolbox` that opens an editor and results in a text display element that lives below and outside the controls, and above the file listing in the file listing area, on finishing the editor.  The example to use is an inline version of `#songWidgetsEditor`.  Widgets are probably a bad idea, but links may be valuable in the resulting description, and tables and other allowed HTML would allow a Workbook author to summarize the course.  Links with macros would affect the current Song, so may be a bad idea, but links that allow other Songs to be loaded may be good.  For now, we will let links be allowed, and lock them down later. 
  - when there is an existing `Song.tutorial.caption` what precedence does it take, and is it always the single source of the Song caption for Workbooks.  Thus, "caption" and "description" are separate properties, and must be aligned with 1) how "caption" is used for tutorials (succint and mostly text plus `<b>` and `<i>`), 2) how "description" takes a place in the Workbook top file area, 3) how Songs in the Library have longer captions from `song-list.json`
  - how to show instrument badges in Workbook and Tutorial listings.


- How should deeper subfolders behave: accordion or outline, and are these supported by the Browser `<summary>` element natively so we don't have to write special accordion code and manage state in the Library, Tutorial, and Workbook listings?

## Course Library Layout

We are picking up from where sprint-138 left off.  There, we defined the coursework for several courses, each with folders of lessons and each lesson folder having multiple lesson files (Songs) and prompts files for the build process.

Note that in the above discussion we used `C100-cowboy-chords` as our example Course.  It has not been fleshed out with Lessons and Songs yet.  The only functioning example of a tutorial Song is `C000-intro/L001-one-string-intro/L001-1.json`.  All Courses can be considered to eventually have one or more Lessons with one or more Songs like that stashed in their folder structure.  Thus the listings below are incomplete because we have not developed them yet.


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

We then set up the ./songs/tutorials directory to match, using stubs and placeholders: 

`tree tuturials` produces:

```
tutorials
├── C000-intro
│   ├── L001-one-string-intro
│   │   ├── L001-1.json
│   │   ├── L001-1.prompts.html
│   │   └── L001-2.prompts.html
│   ├── L002-bass-intro
│   │   └── L002-1.prompts.html
│   ├── L003-guitar-intro
│   │   └── L003-1.prompts.html
│   └── L004-piano-intro
│       └── L004-1.prompts.html
├── C100-cowboy-chords
│   ├── L101-cowboy-intro
│   │   └── L101-1.prompts.html
│   ├── L110-cheatin-heart
│   │   └── L110-1.prompts.html
│   └── L112-brown-eyed-girl
│       └── L112-1.prompts.html
├── C200-blues
│   ├── L201-blues-intro
│   │   └── L201-1.prompts.html
│   └── L202-mustang-sally
│       └── L202-1.prompts.html
├── C300-rock
│   └── L310-smoke-on-the-water
│       └── L310-1.prompts.html
├── C301-jazz-intro
│   ├── L302-st-louis-woman
│   │   └── L302-1.prompts.html
│   └── L310-autumn-leaves
│       └── L310-1.prompts.html
├── C401-progressions
└── C501-soloing
```


# sprint-158 Iteration 1 Round 1 :: Request

Please review this file, `158-design-it1-r1.md`, and give us feedback on items we should drill down on, define more, and any holes you see in useability.  We'd especially like some clarity on "description" and "caption" and where these appear in the in-app authoring and in the build process, and where these things really live in the Song file or as new properties in a .workbook.json file.  We'd also like to ensure that the normal Browser handling of `<summary>` elements is discussed relevant to our questions.

Please be aware that `158-design.md` will be versioned in this sprint by filenames so that you may concretely address `158-design-it1-r1.md` as the version we are handing you in Iteration 1 Round 1.  `158-design.md` will evolve and be our living document with current design choices.

