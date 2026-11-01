# sprint 148 Iteration 3 functions panel design

We are breaking out Iteration 3 from 148-design.md to focus on the Function Symbols panel.  This is a widget that will handle choosing of built-in and User Function Symbols sets and editing/CRUD of User-defined Function Symbols and sets.

Except for behavior refined below, the behavior should fit with the current discussion in this sprint-148 in Iteration 1 and Iteration 2.

One minor point to watch: we have changed `Function (Default)` everywhere to be just `Function` again for the default first OPTION in the SELECT dropDownFunctionSymbols and Songs that use it.  Therefore, there is no special handling of this caption.  It will continue to be the default by dint of being the first OPTION in the SELECT and being "selected" in HTML.

# Function Symbols panel design

To keep the new code out of index.html, the div that represents the Function Symbols will now be built from a template in `./templates/function-symbols/`.  It should follow the creation pattern of other widgets built in `./templates/`.

The default display will be a preview of the Function Symbols on the first row `previewFunctionSymbols`, then the SELECT `dropDownFunctionSymbols` on the second row, then a show/hide button `btnCustomizeFunctionSymbols` on the third row, then finally a fourth row with a shown/hidden div that has the CRUD controls.
The pseudo-code layout is like this:

```
<div id='widgetFunctionSymbols`>
    previewFunctionSymbols
    dropDownFunctionSymbols
    btnCustomizeFunctionSymbols
    <div id='divFunctionSymbolsCRUD'>
        "From:" lblFunctionSymbolsCaption
        "Function Symbols:" textareaFunctionSymbols
        "ID:" lblUserFunctionSymbolsID
        "Caption:" txtUserFunctionSymbolsCaption
        lblWarnUserFunctionSymbolsCaption
        lblWarnUserFunctionSymbols
        btnValidateUserFunctionSymbols
        btnSaveUserFunctionSymbols
        lblWarnUserFunctionSymbolsUsageCount
        btnMoveUpUserFunctionSymbols btnMoveDownUserFunctionSymbols btnDeleteUserFunctionSymbols
    </div>
</div>
```

The idea is these all stack in one column so they fit in a View card `.divViewCard` (wrapped in other elements to match the other divViewCard layouts).  These have been working well for flexible layouts and on the phone where the card fills the phone screen width.

## Notes for each control in `widgetFunctionSymbols`

### widgetFunctionSymbols

This is a widget that is a div that lives in `./templates/function-symnbols/` and gets built and installed on the View page where dropDownFunctionSymbols currently lives.  Below are notes for the owned controls.

#### dropDownFunctionSymbols
dropDownFunctionSymbols should behave similarly to the current version: when a new OPTION is selected, that becomes the Function Symbols in effect for the current Section and is available to be saved in displayOptions etc.

#### previewFunctionSymbols

widgetFunctionSymbols also contains a preview (previewFunctionSymbols) of what the chosen set would look like, similar to the first row of what `${transposedModeNotesFunctions}` spits out: a table of Functions in scale order of the 12 note functions, colored with the current color scheme for `[note1, note2, note3....note12]` respecting AutoColor (live).  Therefore it should display as noteTransparent with a `noteWhiteKey` background when AutoColor is off.  However, scale order here is laid out in rows from left to right and bottom to top. This preview table should be laid out like this, if "Function Numbers" were chosen:

|  |  |  |  |  |
|---|---|---|---|---|
| 11 | 12 | | | |
| 6 | 7 | 8 | 9 | 10 |
| 1 | 2 | 3 | 4 | 5|

That is, it looks like a 5-fret P4 guitar with equal width frets.  It's order is somewhat different from the JSON array of the values, because it is designed to look like our most popular instrument, the Guitar, while still being obvious to a piano player.  The order of the JSON array for editing should stay in the logical order: `["1","2",....]`.

Since this is above the SELECT and the customize button (`btnCustomizeFunctionSymbols`), it will always be visible and should be valid for the selected built-in and accepted User values in the dropDownFunctionSymbols.

#### btnCustomizeFunctionSymbols

This is a button for the collapsible divFunctionSymbolsCRUD.  It should behave like `btnToggleThemeMatrix` and have the same open/closed triangles.

#### lblFunctionSymbolsCaption

Here is where we spit out the caption associated with the Function Symbols set currently displayed in textareaFunctionSymbols.  It is preceded by the text "From:" so that it shows the source SELECT OPTION that the Function Symbols came from. After the new User set is accepted, the SELECT will contain the new User set, will be parked on that set, and thus this "From:" caption can be set to the new User set caption.

#### textareaFunctionSymbols

Here is where we display the JSON of the Function Symbols.  Initially, it will be the set chosen by the dropDownFunctionSymbols.  After the User begins editing these, that is no longer true, but updates of other labels and controls are not needed until the set is accepted.

#### lblUserFunctionSymbolsID

Informational for debugging and maybe for power-Users.  At any rate, for this implementation, a read-only label showing the calculated/squeezed ID based on the Caption the User has edited.

#### txtUserFunctionSymbolsCaption

The place where the User can set the Caption of the new User set of Function Symbols.  After he edits this, the lblUserFunctionSymbolsID should be updated, on focus loss.  This control is pre-populated with a value of `U: ${currentFunctionSymbolsCaption}` where currentFunctionSymbolsCaption is the value of the SELECT OPTION that the User sees in dropDownFunctionSymbols.  The only thing making it unique is therefore the "U: " in front of the string.  The corresponding ID would have "U-" prepended to the ID of the option selected.  The create/accept button will not be clickable until the caption is unique, and therefore the ID's uniqueness too.  It will be up to the User to come up with a unique caption: if prepending "U: " is not sufficient.  He can alter the Caption until the lblWarnUserFunctionSymbolsCaption goes away, at which point btnSaveUserFunctionSymbols becomes clickable, along with checking the conditions for btnValidateUserFunctionSymbols/lblWarnUserFunctionSymbols.

#### lblWarnUserFunctionSymbolsCaption
read-only label with warning message that helps User fix the Caption (and therefore ID) so that it is unique.  Should be styled in new CSS file for this template directory, with font-size: 70% and color: yellow, along with the other warning labels lblWarnUserFunctionSymbols and  lblWarnUserFunctionSymbolsUsageCount.

#### lblWarnUserFunctionSymbols

Invalid JSON and arrays without 12 elements should be warned here.

#### btnValidateUserFunctionSymbols
A simple button with caption "Validate".  When clicked, checks the textareaFunctionSymbols has valid JSON of 12 elements.  If invalid, adds message to lblWarnUserFunctionSymbols

If valid, along with the Caption/ID being unique, allows btnSaveUserFunctionSymbols to be clickable.

#### btnSaveUserFunctionSymbols
A button with caption "Save".

When the Caption (and ID) are unique, and the JSON acceptable, this button should be clickable.  

#### lblWarnUserFunctionSymbolsUsageCount
Warning label with same small+yellow CSS that warns if the current Song uses this Function Symbols set.  When zero, this label goes away, and btnDeleteUserFunctionSymbols is clickable.

#### btnDeleteUserFunctionSymbols,  btnMoveUpUserFunctionSymbols, btnMoveDownUserFunctionSymbols
It seems these three buttons could appear on one row together like `btnMoveTuningUp` / `btnMoveTuningDown` / `btnRemoveTuning` and copy the styles into the stylesheet for this template.  

#### btnDeleteUserFunctionSymbols
When no warning appears in lblWarnUserFunctionSymbolsUsageCount, this button is clickable and deletes this User Function Symbols set, removing it from the SELECT and the Song.

#### btnMoveUpUserFunctionSymbols
Moves the current selected User Function Symbols set up in the SELECT and redisplays the SELECT.  Does not move any User set above built-in sets.  Does not move any built-in sets.  When on a built-in set, is not clickable.  When at the top of the User sets, is not clickable.  

#### btnMoveDownUserFunctionSymbols
Moves the current selected User Function Symbols set down, with matching contrary rules to btnMoveUpUserFunctionSymbols. 

# sprint 148 Iteration 3 Round 2

## Answers to Section 8 in 148-it3-implementation-plan.md

We think this is in the plan, but the idea is that there is a registry of "Function Symbols" sets, and they are keyed by ID, and after loading contain the built-in sets plus the User sets.  On persistence, the User sets would be saved in the file.  So if the system updates built-in sets per-note definitions, and doesn't change an ID of a set, then the User would still see those updates on the next song load.

Accept all proposals in `4.`.

Change yellow warning labels to `color: brown;` text.

Approve changes in `5.`

Section 8 answers:
1. use functionSymbols as "<id>" and migrate stored blocks.
2. Upsate a set in place so it can be edited.
3. Yes, strip one leading U.
4. approved recommended
5. Auto-validate.  If auto-validation works, we don't need the validate button.
6. accept limits proposed.
7. Only count stored in sections.
8. Immediate delete.
9. Defer import/append.
10. migrate test fixtures.
11. warning color `color: brown;`
12. blank no-border positions 13-15.  Show the symbol only.
13. Replace the whole "Function Symbols" inside the second View card.
14. Approved go-ahead for the files in 5.2 

Not exactly sure about the details, but do make it so that once a User function symbol set has been created, it can be edited and deleted in a normal way by selecting it.  The ID never needs to change one it has been accepted the first time by the User.  If the caption is edited later, it won't match the ID and that is OK.