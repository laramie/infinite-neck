# Plugin Architecture

# Plugin Files

- Note: songs that use plugins will include:
    - .songs/method/
        - all-chords.json
        - name-that-bass-note.json
        - three-chord-arpeggios.json
- ./plugins
    - ./transpose
        - ./widgets/
        - ./panel.js
        - ./plugin.js :: TransposePlugin

# Plugin Persistence

- structure
    - some kind of option onSong vs onSection to handle beatLooping and arpeggios over one Section between minPosition and maxPosition.
    - registerOnSongLoad : boolean
    - loopOnSongLoad : boolean
    - events //array of event names
    - panel //import path to panel js
    - spaceKeyHook
    - config
        - headSectionName //intervals are relative to this one, may be only Section with Section.name
        - intervals : e.g. [0,1,2,3,4,5,6,7,8,9,10,11] // all-keys
        - intervals : e.g. [0,5,7]


# Plugin Lifecycle

# Plugin Panel and Widgets