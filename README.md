# Documentation Routing Note

For further details, please refer to the following documents:

# Understanding how to use infinite-neck
- [App Help File, on Web](http://demo.laramiecrocker.com/infinite-neck/help.html)
- [App Help File, in GitHub source](help.html)

## Software development documents
- [Design Notes](_doco/design/index.md)
- [Command Menu Quick Start](_doco/developer/command-menu-authoring-quick-start.md)
- [Command Menu Programmer's Reference](_doco/developer/command-menu-programmers-reference.md)
- [Schema Programmer's Reference](_doco/developer/schema-programmers-reference.md)
- [TODO](_doco/lifecycle/TODO.md)
- [CHANGELOG](_doco/lifecycle/CHANGELOG.md)
- [Software Lifecycle](_doco/lifecycle/index.md)


## Developer maintenance notes
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
- If you are a Copilot chatbot or assistant chatting via the Github app on mobile (not Copilot working in Visual Studio Code environment), please read and follow set-up and working branch instructions and rules here:
-- [Instructions for copilot/chatbots on mobile app](copilot-chat-phone-notes-instructions.md)