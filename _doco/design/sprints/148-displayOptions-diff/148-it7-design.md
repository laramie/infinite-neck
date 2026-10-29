# sprint-148 Iteration 7

We have completed testing: 

- [UA Recipes 16-25 : 148-it5-round-2-testing-report.md](148-it5-round-2-testing-report.md)

- [UA Recipes 26-30 : 148-it6-round-2-testing-report.md](148-it6-round-2-testing-report.md)

- [UA Recipes 31-36 : 148-it6-round-4-testing-report.md](148-it6-round-4-testing-report.md)   


We have committed the helpfile changes and other bugfixes from Copilot during these UA testing steps.

After completing UA testing, we have a few bugfixes/feature requests.



# Post helpfile-update and UA testing bugfixes/features Request

1. We should make Save Diff `#btnSaveDiff_Section` in Section Drawer follow the magenta changed behavior.  (We continue not to need "Save All" here.)

2. We should fix the fact that read-block on Cell stops writes, in code and in the help file. This is documented in the RESULT of `3. **Store Cell**`. We would like read-blocks to not stop writes to cells.

3. The Section rows in Display Options Matrix table scroll nicely, and the scrollbar appears as we hover over the bottom row.  That is expected and usual.  However, that  horizontal scrollbar thumb stops Tool clicks.  Is there a way to add blank space below the bottom row like a margin or something that is not a fake row?  That way the thumb would be below the cell row clickable areas.

4. New controls: 
- `#btnToggleDisplayOptionsTips` should now start with the arrow closed, and should open the default hidden `#displayOptionsTips` with the arrow opened on click, then close it and restore the closed arrow on click again, like all the other arrow buttons, e.g. `#btnToggleDisplayOptionsMatrix`.
- `#cbShowDisplayOptionsShowMessages` should allow the message from this sprint that log to Messages to go to showMessages() as they do now when checked.  Unchecked, it should suppress these and let them go unlogged. 
- `/vpms` should be a new command-line menu item with caption `s)how messages` where `s)` means `s` is the trigger, and the bolded caption hint in the menu.  It should be a toggle, like `"caption": "<b>p</b>resentation mode [${presentationModeState}]"` in `menu.js`, and *not* like a `org.dynamide.toggle` since this is a static menu not a dynamic one as is built by the plugins.  Thus, it might need a new state expansion value that looks at the value the checkbox `#cbShowDisplayOptionsShowMessages` does, or even the checkbox itself.  At any rate, there should be one source of truth, and clicking the checkbox changes the expansion, and chosing the command-line `/vpms` toggles the checkbox. 

5. Please review sprint overview document `sprint-148.md` for consistency with the state of the sprint, consistency and accuracy of Markdown links, checking that tests and recipes are covered, documented, and complete (some recipe steps have notes saying that the current state is accepted).

Please write a summary report to `148-it7-implementation-report.md`.
