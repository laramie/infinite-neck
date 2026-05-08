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


## Developer maintenance notes
- test shell scripts (choose one)
```
   bin/test.bash           ## run Jest test suite
   bin/test-VERBOSE.bash   ## run with debug output
   bin/test-songs.bash     ## run just the song library test with song schema validation
```
- how we run Jest tests:
```
   cd infinite-neck
   export INFINITE_NECK_VERBOSE=-1
   node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose  --runInBand
```
- after adding doco files, please run
```
   cd infinite-neck
   bin/index.md-update-all.sh 
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