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


## Implementation notes (Iteration 4)

- [Tutorial.js](../../../../Tutorial.js): `canEditTutorialPrompt` is now wizard only; new `canEditTutorialCaption` (wizard and not "use caption for tutorial"), `captionTextToCaption`, `applyCaptionToSectionTutorial`.
- [templates/tutorial/tutorial.builder.js](../../../../templates/tutorial/tutorial.builder.js): `renderCaptionEditor`, `renderTutorialCaptionEditButton` (button, or the boxed "&sect; Caption" label), `renderTutorialEditButtons` (caption above prompt, stacked).
- [infinite-neck.js](../../../../infinite-neck.js): `tutorialEditCaption`, `tutorialCaptionEditorBlurred`, `commitTutorialCaptionEdit`, state `captionEditSection`; same commit-on-blur / commit-on-render flow as the prompt.
- [templates/tutorial/tutorial.css](../../../../templates/tutorial/tutorial.css): `.tutorialPromptEditStack`, `.tutorialCaptionLabel`, `.tutorialCaptionEditor`.
- Decisions: the tutorial caption is stored as plain text (as the tutorial builder stores it), so the editor strips tags; the wizard header now escapes it.  The buttons are hidden while either editor is open (the label stays).  The caption editor sits between the header and the prompt.

## Manual acceptance checklist

- [PASS] Wizard, "use caption for tutorial" off: "Edit Caption" stacked above "Edit Prompt" at the right.
- [PASS] Edit Caption: warning says "...will re-write this caption."; textarea holds the current tutorial caption; click outside or Esc saves; header caption updates; empty removes it.
- [PASS] Wizard, "use caption for tutorial" on: boxed "§ Caption" label above "Edit Prompt"; Edit Prompt works.
- [PASS] Strict and none: no buttons or label.
- [PASS] Looping with the caption editor open accepts the edit onto the Section that was edited.
- [PASS] Save and reload: the edited caption persists.

# sprint-152 Iteration 4 Round 2

We have marked the Manual acceptance checklist from Iteration 4 Round 1 as PASS.

We have tweaked a little CSS.

In "use caption for tutorial" mode (set by menu.js through key-handlers.js as `tutorial.useCaptionForSectionCaption`), we have specified that if Section.caption is available, then that gets used for the tutorial section caption which is `.tutorialPromptCaption`, otherwise the `Song.tutorial.caption` gets used.  We'd like to roll that back a bit to the new rules: 
- if no Section.caption is available in "use caption for tutorial" mode, then let the `.tutorialPromptCaption` be blank.
- Thus, Song.tutorial.caption never becomes the `tutorialPromptHeader` even in strict mode.  Either the `data-caption-for-section` from the build process of the tutorial becomes the tutorialPromptCaption, or the Section.caption becomes the tutorialPromptCaption, or it is blank.
- the new text for menu item "use caption for tutorial" is "use Section caption for tutorial" so that this is a bit more obvious. Trigger unchanged.
- the Song.tutorial.caption is still used to head the page in tutorial mode in `.tutorialPromptBreadcrumbs`. (This was supposed to be a built-up breadcrumbs value, but it is currently just the Song.tutorial.caption, which is fine for now with that behavior and name.)  It is still editable with `/vpe`.  It is still writable by the build process.  Let us know if this presents any conflict, other than the fact that the build process can clobber the value.
- the Song.tutorial.caption is not visible in wizard mode.  Change this by making it the same as `strict` mode, so inserting the `tutorialBreadcrumbsLeader` and `tutorialPromptBreadcrumbsRow` above `tutorialPromptHeader` but not the `tutorialPromptBurgerControls` or any of the other `tutorialPromptBurgerControls` child controls, since in wizard mode we separately show the Practice List with `/vtwp`.  But if it is cleaner or safer to always use `tutorialPromptBurgerControls` as the container and simply omit all the other controls in wizard mode, then that is acceptable.

Hopefully we have specified all these nested elements correctly.  If not, let us restate the goal: 
1) Tutorial built with Tutorial.caption from `data-caption-for-tutorial` or User has specified with menu item "edit tutorial main caption".
2) Tutorial built with captions for each Section from `data-caption-for-section`
result) ==> Tutorial in wizard and strict modes shows Tutorial.caption on a first row somewhere (or blank if omitted), and Section.tutorial.caption on a second row somewhere.

==> If User specifies (new menu text) "use Section caption for tutorial" then that second row comes from Section.caption, or is blank if that current Section.caption is blank.

==> in no case is the old behavior applied by using Tutorial.caption as that second row.

If this is all consistent, then please ensure that tests are updated.

We are left with the unfortunate name `useCaptionForSectionCaption` which really means "useSectionCaptionForSectionTutorialCaption".  However, we want to leave it as useCaptionForSectionCaption for now, since the code generally works, and we want to sort out the other confusions first.



