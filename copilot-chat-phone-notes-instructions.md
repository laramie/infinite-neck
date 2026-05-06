# Copilot Chat (Phone) — Notes Workflow

## Goal
Use GitHub mobile Copilot chat to make small documentation/TODO/design-note updates in a predictable way, without touching `main` directly.

## Rules
1. **Work only on branch:** `phone/notes`
2. **Never commit to `main`.** Do not create commits on `main`.
3. If a write/commit is requested, **trigger any permission/authorization prompts first**, before making edits.
4. Before editing any file, **open and read it** to confirm the correct path and the target section.
5. Keep changes small and focused per commit.

## Where to write things
- TODO list lives at: `TODO.md`
  - New items go under: `## Inbox / Unassigned` directly below `- place new TODOs here...`
- Design discussions / notes:
  - Save to: `bin/namespacer/doco/`
  - Filename format: `phone-notes-YYYY-MM-DD-<topic>.md`

## Commit conventions
- Commit message prefix: `phone-notes: `
  - Example: `phone-notes: add FindMain Accumulator IO todo`

## Standard operating procedure (SOP)
When asked to make a change:
1. Confirm branch is `phone/notes`.
2. Open the target file and quote the surrounding section to confirm placement.
3. Apply the change.
4. Commit to `phone/notes`.
5. Report back with: files changed + commit message.