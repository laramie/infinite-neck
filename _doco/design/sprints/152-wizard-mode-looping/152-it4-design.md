# sprint-152 Iteration 4

In this Iteration we wish to revisit how we left Tutorial Captions.

Currently, when tutorial mode is `wizard` *and* "use caption for tutorial" is true (`/vpu`) then button with data-action="tutorialEditPrompt" becomes available.  There is also some logic around making the prompt editable in tutorial songs which have tutorial captions.

We want to change this to the new rules:
- When in `wizard` the tutorial prompt edit flow is unchanged, and shows the button.  We are just adding the ability to edit the tutorial caption (not the Section Caption) in the same area.
- When in `wizard` both the tutorial caption and the tutorial prompt become editable, except if "use caption for tutorial" is true.
- if "use caption for tutorial" is true, then the tutorial caption is not editable, and the button becomes a label with a box border that says "&sect; Caption".
- if "use caption for tutorial" is false, then the tutorial caption is editable, and the button becomes a button with a caption says "Edit Caption", and the tutorial caption is edited in a flow exactly like "Edit Prompt", except that Song.section[n].tutorial.caption is the target, being the normal persisted value in the model. The warning applies like it does for tutorial prompt but should say "... will rewrite this caption."
- the rule to **hide the edit button unless "use caption for tutorial" is true** is obviated, since in wizard mode we can now edit both tutorial caption and tutorial prompt always.  The edit buttons disappear in tutorial modes `strict` and `none`.  Although, in `none` no handling is needed, really, since the whole div goes away.
- the "Edit Caption" and "Edit Prompt" buttons should stack vertically in the space now used for "Edit Prompt" on the right side of the screen.  When "Edit Caption" button becomes label "&sect; Caption" it also stacks vertically over the "Edit Prompt" button which remains.

