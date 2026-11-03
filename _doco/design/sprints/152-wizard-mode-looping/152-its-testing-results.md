- [ Y ] Wizard mode: the Edit Prompt button shows to the right of the prompt.
- [ Y ] Strict mode and none mode: no button, layout unchanged.
- [ Y ] Wizard mode with "use caption for tutorial" on: no button.
- [ Y ] Click Edit Prompt on a Section with a prompt: the textarea holds the prompt, and the red warning is above it.
- [ Y ] Click Edit Prompt on a Section with no prompt: the textarea is empty.
- [ Y ] Type HTML, click outside: the prompt renders, the warning is gone, and a script tag or inline handler is stripped.
- [ Y ] Type text, press Esc: the edit is saved.
- [ Y ] Clear the box, click outside: the prompt is removed.
- [ Y ] Start looping with the editor open: the edit is accepted, and it is on the Section that was edited.
- [ Y ] Save and reload the Song: the edited prompt persists.
- [ Not tested yet ] Run `npm run build:tutorial-prompts`: the edit is overwritten (expected, per the warning).

Found: 
`/vpu` does not show the status of the toggle `use caption for tutorial` and presents this same text whether the value is true or not.  It should show something like `use caption for tutorial [true]` and `use caption for tutorial [false]` while still presenting the normal trigger, bold on the trigger, etc.  This is a static menu, so will need an added expansion to show that state.

`/vp` should show the tutorial mode in the menu similarly. "tutorial mode" should be 
- `tutorial mode [none]`
- `tutorial mode [wizard]`
- `tutorial mode [strict]`

Also a static menu, so will need an expansion.

