# Copilot Chat (GitHub/VS Code) — Notes Workflow

## Goal
Understand how we view the codebase, and how we appreciate a workflow with GitHub Copilot.

## Rules
1. **Work only on the current git branch:**
2. **Be sure we have explicitly asked for code changes to files in `./` in the repository.  These are all top-level files that can break the application.  See the next section for details.**
3. **Rarely do we want "legacy" code handling. See below.** 


## Standard operating procedure (SOP)
- Our code aims to be fully ES6.

- In general, we run our codebase as "no-legacy" support.  If something needs changing, we run as "break-everything"/"fix-everything".  If you see old stuff, we'd prefer to do a clean-up sprint than to have code that handles legacy artifacts.  For example, we do *not* support song files older than V2.  We like to keep the old file formats around for testing, and new files marked as good in the songs lists.

- Please feel free to modify Jest test code.  

- Please feel free to add modules and helpers in ./_test/jest/ or ./bin/ or add commands in ./package.json . 

- Node command-line tools should go in ./bin/

- Please be sure we want main code changes in `./` in the respository, such as `./Song.js` etc.  We will ask specifically for these changes.  Our goal is to have design discussions or at least viability/safety discusssions first, often capturing these in markdown files in one of these locations, which you are welcome to read to understand the repository: 
- `./_chat_conversations/infinite-neck/`
- `./_doco/ `
- `./_doco/design/`

We stash programmer/developer instructions here: 
- `./_doco/developer/`


## Here is how we run our Jest tests 

All Tests: 
```
        cd ~/infinite-neck
        export INFINITE_NECK_VERBOSE=-1
        node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose  --runInBand
```

If you want to see the output of console.logs in the test, you can turn on 
export INFINITE_NECK_VERBOSE=2

