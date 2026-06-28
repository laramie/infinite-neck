
# sprint-133 Iteration 6: fix old Fill page

So the old Fill menu page `#btnFillNotes` used NoteTableController.js::fillChord().

Now that we have normalized so that the value no longer has a list of integers, but has a Tonal.js identifier: 
`<option value="dim7">dim7</option>`
we have to do business the way that the FillPlugin does, because FillPlugin is working, whereas fillChord() is still expecting scaleNotes and chordFnNotes to be stringified arrays.

So this would be a good time to gut the fillChord() functions, and move over to calling FillPlugins helpers.  Probably they need to be moved closer to the core, because we don't want to call plugins from the core.  And whatever is done will be a wrapper that still has to deal with the UI web controls on the Fill page.  If they already exist in the proper architecture and import locations, fine.

Another thing that would be good to get away from is that the old fillChord() family of functions did not have the same algorithm as FillPlugin.  FillPlugin was written later, and has some fixes around roles and noteKeep etc.  FillPlugin should be the real algorithm used.

We want to avoid using a provider strategy for imports.  We'd prefer to have small modules that are common and imported by consumers. 

Can you write an implementation plan showing what you will move and wrap so that we can quickly check the architecture before coding starts, please?  Let it be: 

[133-it6-implementation-plan.md](133-it6-implementation-plan.md)

