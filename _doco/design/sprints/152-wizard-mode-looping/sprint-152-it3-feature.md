# Sprint 152, Iteration 3: Edit Prompt (wizard mode)

Part of [sprint 152](sprint-152.md).  Requested in [152-design.md](152-design.md), "Iteration 3".

## What was implemented

In wizard mode, the Prompt Area (`#divTutorialPrompt`) shows a small **Edit Prompt** button floating to the right of `#tutorialPrompt`.

1. Click **Edit Prompt**.  The rendered prompt is replaced by a textarea (`#tutorialPromptEditor`).  If `section.tutorial.prompt` exists, the textarea holds its lines (joined with a newline); otherwise it is empty.
2. Above the textarea is a full-width warning div, `.tutorialPromptEditWarning`:
   "WARNING: Running the tutorial builder (npm build:tutorial-prompts) will re-write this prompt."
   It starts with `color: red;` and can be restyled in [templates/tutorial/tutorial.css](../../../../templates/tutorial/tutorial.css).
3. When the textarea loses focus, its text is sanitized and written to `section.tutorial.prompt` of the Section being edited.  The textarea goes away, the prompt renders, and the warning disappears with it.
4. If focus is lost because looping moved to another Section, the edit is accepted and written to the Section that was being edited, not the new current Section.

The button is wizard mode only.  It is not shown in strict or none mode, nor when "use caption for tutorial" (`useCaptionForSectionCaption`) is on, since the prompt is not what the user sees in that case.

The tutorial build script (`bin/build-tutorial-prompts.js`) and the author process are unchanged.  An edit made here is overwritten the next time the builder runs.

## Design adjustments (reasonable decisions)

- **Sanitizing.**  The whole textarea text is sanitized in one pass with `getSanitizedInfo` and stored as a single entry: `prompt: { lines: [clean] }`.  Rendering joins lines with a newline, so what is displayed is the same as with several lines.  The schema is unchanged.
- **Empty box.**  An empty result removes `prompt`, and removes `section.tutorial` if nothing else is left in it.
- **Button hidden while editing.**  Otherwise a second click would re-open a fresh editor.
- **Hint line.**  The editor also shows "Click outside the box, or press Esc, to save and show the prompt."  Esc works because the existing Esc handler focuses `#btnLoopSections`, which blurs the textarea.
- **Edit state is the Section object** (`tutorialRuntimeState.promptEditSection`), not an index, so the edit lands on the right Section even after looping advances.
- **Commit on any re-render.**  `renderTutorialPrompt()` accepts an open edit before it replaces the textarea.  This is what covers looping (`syncSectionUi()` calls it on every Section change), list clicks, and mode changes.
- **No double commit.**  `commitTutorialPromptEdit()` clears the edit state first, so the blur that fires when the textarea is removed is ignored.
- **Song change discards** an open edit, since the Section it belonged to is gone.
- **Layout.**  The button lives in a sibling host, `#tutorialPromptEditHost`, inside `#divTutorialPrompt`.  The parent gets the class `tutorialPromptHost--sideBySide` (flex) only while the button shows, so strict and none layouts are unchanged.  `#tutorialPrompt` is replaced on every render, so the button could not live inside it without being re-created on every keystroke-free render; a sibling is stable.
- **Leading newline.**  The textarea markup starts with a newline (which the HTML parser swallows) so a prompt whose text begins with a newline is kept.

## Known limitation

When the blur re-renders the prompt (or the practice list), the element that was clicked to cause the blur is replaced before its click lands.  The first click outside the editor on a re-rendered element can therefore be lost.  The edit itself is still saved.

## Files changed

- [Tutorial.js](../../../../Tutorial.js): `canEditTutorialPrompt`, `promptToEditText`, `promptTextToPrompt`, `applyPromptToSectionTutorial`.
- [templates/tutorial/tutorial.builder.js](../../../../templates/tutorial/tutorial.builder.js): `promptEditing`, `canEditPrompt`, and `promptEditText` in the model; `renderPromptEditor`; `renderTutorialPromptEditButton`; `TutorialPromptBuilder.renderEditButton`.
- [templates/tutorial/tutorial.css](../../../../templates/tutorial/tutorial.css): side-by-side layout, button, warning, hint, and textarea styles.
- [infinite-neck.js](../../../../infinite-neck.js): `commitTutorialPromptEdit`, `tutorialEditPrompt`, `tutorialPromptEditorBlurred`, edit state, and the `focusout` binding.
- Tests: [_tests/jest/tutorial.test.js](../../../../_tests/jest/tutorial.test.js) (helpers), [_tests/jest/tutorial-builder.test.js](../../../../_tests/jest/tutorial-builder.test.js) (button and editor rendering).  Jest follows the repo's non-browser pattern, so focus and blur behavior is in the manual checklist.

## Manual acceptance checklist

- [ ] Wizard mode: the Edit Prompt button shows to the right of the prompt.
- [ ] Strict mode and none mode: no button, layout unchanged.
- [ ] Wizard mode with "use caption for tutorial" on: no button.
- [ ] Click Edit Prompt on a Section with a prompt: the textarea holds the prompt, and the red warning is above it.
- [ ] Click Edit Prompt on a Section with no prompt: the textarea is empty.
- [ ] Type HTML, click outside: the prompt renders, the warning is gone, and a script tag or inline handler is stripped.
- [ ] Type text, press Esc: the edit is saved.
- [ ] Clear the box, click outside: the prompt is removed.
- [ ] Start looping with the editor open: the edit is accepted, and it is on the Section that was edited.
- [ ] Save and reload the Song: the edited prompt persists.
- [ ] Run `npm run build:tutorial-prompts`: the edit is overwritten (expected, per the warning).
