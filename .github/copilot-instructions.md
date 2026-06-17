# GitHub Copilot Instructions — infinite-neck

## File and path formatting rules

These rules take precedence over all other formatting guidance.

### In chat responses
- When a file path appears (whether typed in backticks or plain text), render it as a clickable Markdown link:
  `[relative/path/to/file.ts](relative/path/to/file.ts)`
- With a line number:
  `[relative/path/to/file.ts](relative/path/to/file.ts#L42)`
- Always use **repository-relative paths** (no leading `/`, no machine-local absolute paths).
- Backticks are allowed for shell commands, inline code, and symbol names.

### In .md file output
- Use standard Markdown links with repository-relative targets:
  `[description](relative/path/to/file.md)`
- These render as clickable links in VS Code Markdown Preview and on GitHub.com.
- Line anchors are supported on GitHub.com: `[description](path/to/file.ts#L10)`

### When the user pastes a path
- If the user writes a path in backticks (pasted from VS Code "Copy Relative Path"), treat it as a file reference and emit a clickable link for it in your response.

### Examples
Good:
- [src/Song.js](src/Song.js)
- [Song.js line 42](Song.js#L42)
- `npm run test` (shell command — backticks OK here)
- `Song.getDisplayOptionsInEffect()` (symbol name — backticks OK here)

Bad (do not produce these):
- `/home/laramie/infinite-neck/Song.js`
- `Song.js` as a bare backtick path with no link
- plain text file name with no link: Song.js

---

## Goal
Understand how we view the codebase, and how we appreciate a workflow with GitHub Copilot.

## Rules
1. **Work only on the current git branch.**
2. **Be sure we have explicitly asked for code changes to files in `./` in the repository. These are all top-level files that can break the application. See the next section for details.**
3. **Rarely do we want "legacy" code handling. See below.**

## Standard operating procedure (SOP)
- Our code aims to be fully ES6.

- In general, we run our codebase as "no-legacy" support. If something needs changing, we run as "break-everything"/"fix-everything". If you see old stuff, we'd prefer to do a clean-up sprint rather than code that handles legacy artifacts. For example, we do *not* support song files older than V2. We like to keep the old file formats around for testing, and new files marked as good in the songs lists.

- Please feel free to modify Jest test code.

- Please feel free to add modules and helpers in `./_tests/jest/` or `./bin/` or add commands in `./package.json`.

- Node command-line tools should go in `./bin/`

- Please be sure we want main code changes in `./` in the repository, such as `./Song.js` etc. We will ask specifically for these changes. Our goal is to have design discussions or at least viability/safety discussions first, often capturing these in markdown files in one of these locations, which you are welcome to read to understand the repository:
  - `./_doco/`
  - `./_doco/design/`

- Our Sprint process produces reports about sprint status, as well as Markdown discussions including chat, as well as design documents and implementation plans. In many cases, these are the best documentation about how we made decisions about the code and intended features.
  - `./_doco/lifecycle/sprints.md`

We stash programmer/developer instructions here:
  - `./_doco/developer/`

## Here is how we run our Jest tests

All Tests:
```
cd ~/infinite-neck
export INFINITE_NECK_VERBOSE=-1
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose  --runInBand
```

To see the output of console.logs in the test:
```
export INFINITE_NECK_VERBOSE=2
```
