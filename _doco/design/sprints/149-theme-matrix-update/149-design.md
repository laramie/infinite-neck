# sprint-149 Iteration 1 Request

Thank you for the help.html edits.  We'd like to see what a "Preview" mode of the Theme Matrix looks like.
- a "Preview" checkbox inside this TD below the help text (put a font-size on the wrapper or label around the checkbox so the checkbox control  and label aren't cramped by the 60%): 
```
<td colspan="3" style="font-size:60%;">"default" shows when [Allow Theme Automation] sets a Theme for this Section. See View|DisplayOptionsMatrix</td>
```

It starts off unchecked.

When checked, the cascade is shown in the cells of the Theme Matrix table using the rules you found, using the cleanest reading or (appropriate helpers) of values from the Model etc so that if we change something in the rules in other code, the Preview gets the updates automatically.

To show that it is a Preview, show the value cascaded in a gray font in the table.

Include handling of the default column, and previewing what theme automation is in effect.  

If default has multiple Themes hidden in it that are somehow different but display as "default" we should think about how to display that.  If so, let us know.  For now, display it as "default*" or something.

We will tweak this as we see it, so it's just a first iteration.

If you see any holes in what is Preview'ed or what *could* be shown, go ahead and implement, and let us know in the implementation report.  Please write the report to `149-it1-implementation-report.md`

# sprint-149 Iteration 2 Request

Please change "default*" to the form `default:Current` where Current is the value that you now put in the tool tip title.  e.g "default:USER" then later section has "default:BiginJapan". 

# sprint-149 Iteration 3 Request

Please change remaining Preview cells where exactly `default` is used to `default[PICKER]` where PICKER is the value the code is using ( presumably from the picker `#selThemes` ), and the square brackets are literal characters.  The literal square brackets give us a visual cue that this is different from formerly known as "default*". The tool tip title is still available, so we should also be able to tell the difference between "default" and what was formerly "default*". If there's another case, please let us know.

OK to leave the implementation report as-is for now.  We'll write an update when we are farther along in Iterations.

# sprint-149 Iteration 4 Request

Cool.  Please add an informational label in the row above the Preview checkbox and label.
Let it say "Allow Theme Automation: true" or "Allow Theme Automation: false"  in the style of 
```
<p class="viewDisplayOptionsReadOnly">autoColor: <span id="viewDisplayOptionAutoColorValue">true</span></p>
```
but create new ids and copy the needed CSS to the current themes template CSS file.
So it is not a checkbox, but has a bold, brown value in the same way.  Thus it is informational and live, but can't change the Allow Theme Automation state or checkbox.

Also, change the text in the enclosing TD back to normal, getting rid of the 60%.  It's getting hard to read, and we are already putting things in there that consume space, so we aren't so worried about making it tiny.  Make sure the old text there is accurate with our new changes, and fix it if needed.