# Welcome to Laramie's infinite-neck

<a href="http://demo.laramiecrocker.com/infinite-neck">infinite-neck</a> is a web app that helps you learn the entire fretboard of your instrument, for soloing, comping, playing chords, arpeggios, and modes the way professional session players do.  It teaches you how to understand music changes such as I-IV-V progression, so that you can play in any key, and gives you tools to move your practice through keys and transpositions.  Using strong visuals to grow your pattern-recognition skills, it guides you through practices, and lets you record and notate songs, progressions, chords, licks, and modes you are working on.  We support many instruments, such as guitars in any tunings, basses, cello, mandolin, banjo, Chapman stick, midi-pads, and piano.  More than a simple note and chord-finder for guitars, infinite-neck gives a whole new way of looking at instruments from a perspective of understanding what drives music--the patterns, fabrics, and modes of sound, melody, and harmony.

Read our <a href="http://demo.laramiecrocker.com/infinite-neck/help.html">web documentation here</a>, try the <a href="http://demo.laramiecrocker.com/infinite-neck">infinite-neck</a> app on our website, and browse and download the code here on <a href="https://github.com/laramie/infinite-neck">GitHub</a>.  It is open source software, free for non-profit use and coding, and for running from a simple web server on your own workstation.

The rest of this README is geared towards programmers (assistants and humans) who maintain the software, and anyone who would like to use the software or coding solutions for their own non-profit projects.

# Documentation Routing Note

For further details, please refer to the following documents:

# Understanding how to use infinite-neck
- [App Help File, on Web](http://demo.laramiecrocker.com/infinite-neck/help.html)
- [App Help File, in GitHub source](help.html)

## Software development documents
- [Design Notes](_doco/design/index.md)
- [Command Menu Quick Start](_doco/developer/command-menu-authoring-quick-start.md)
- [Command Menu Programmer's Reference](_doco/developer/command-menu-programmers-reference.md)
- [Plugin Author Programmer's Reference](_doco/developer/Plugin-author-programmers-reference.md)
- [ArpeggioPlugin Programmer's Reference](_doco/developer/ArpeggioPlugin-programmers-reference.md)
- [Globals Programmer's Reference](_doco/developer/globals-programmers-reference.md)
- [Schema Programmer's Reference](_doco/developer/schema-programmers-reference.md)
- [Core songfile schema lives here](bin/song-file-schema.js)
- [TODO](_doco/lifecycle/TODO.md)
- [CHANGELOG](_doco/lifecycle/CHANGELOG.md)
- [Software Lifecycle](_doco/lifecycle/index.md)

Songfile schema note:

- V2 Sections may now carry optional plugin-local Section state under `section.pluginData.*`
- the current concrete use is `section.pluginData.arpeggio.positions` and `section.pluginData.arpeggio.lastPositionIndex`


## Developer maintenance notes
- test shell scripts (choose one)
```
   bin/test.bash           ## run Jest test suite
   bin/test-VERBOSE.bash   ## run with debug output
   bin/test-songs.bash     ## run just the song library test with song schema validation
```
- We install the repository from git clone in `~/infinite-neck` .  So `~/infinite-neck` means repository root directory.
- how we run Jest tests:
```
   cd ~/infinite-neck
   export INFINITE_NECK_VERBOSE=-1
   node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose  --runInBand
```
- after adding doco files, please run
```
   cd ~/infinite-neck
   bin/index.md-update-all.sh 
```
- after changing approved interpolation variables or the generated help block, please run
```
   cd ~/infinite-neck
   npm run update:help
```
- command-menu validation:
```
   npm run validate:cmdmenu
```
- songfile schema validation:
```
   npm run validate:song-schema
   npm run validate:song-schema:strict
```

## Copilot Notes and Scripts

- If you are a GitHub Copilot chatbot or assistant chatting via Visual Studio Code, please read this document to understand some base guidelines: 
    - [Guidelines for GitHub Copilot on VS Code](copilot-github-vs-code-instructions.md)

- If you are a GitHub Copilot chatbot or assistant chatting via the Github app on mobile (not Copilot working in Visual Studio Code environment), please read and follow set-up and working branch instructions and rules here:

   - [Instructions for copilot/chatbots on mobile app](copilot-chat-phone-notes-instructions.md)