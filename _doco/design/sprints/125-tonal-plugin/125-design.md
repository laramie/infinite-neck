# Design

This next question is for a future, unscheduled sprint.  No code changes, no implementation plan.  Please produce a design-sketch document as described below.  It started off as a planning sprint sprint-903, and has been promoted to active sprint `sprint-125-tonal-plugin`.

We want a hand-waving answer about what the shape of the menu and the viability of having a command-line menu version of the TonalPickers.

Here's our hand-wavy wish-list:
125-TonalPlugin
  - allows clearing the filter for Western modes. It's a toggle.  When off, the TonalFunction.js filterWesternScales is paused. 
  - has a nextSection, prevSection nav
  - has a A) Accept first modes, and A) Accept first chords in modes and chords sub-menus
  - has a numeric list of suggestions to accept, just like the tonalPicker
  - writes to Song automatically (maybe protected with an option) 

  Again, this is just to start a design discussion on our side, based in the reality and feasibility of the code side.

Include a proposed full plugin menu shape, and include discussion of risks and design/product challenges and coding challenges.

Let the output report be in `_doco/design/sprints/125-tonal-plugin/125-design-sketch.md` 

## Iteration 2: Post-design-sketch comments, request for implementation plan


### General 

We like:
- Like other plugins, it keeps all its code in the plugin and out of the core
- it is not a DOM scraper, it uses the same base functions as the TonalPicker widgets, but is a completely separate presentation with the idioms of the command-line.  Where needed, recompute rather than dig around in the DOM.

- section navigation is simple, just forward and backward one section at a time, with full repaint and update just as if User were mashing on #transport buttons.

- Instrument picker reused from other plugins, and once picked, likely stays there through section navigation.  

### Main Use Case

- Main use case is ripping through all the sections on one instrument, approving what Tonal has proposed, and in a few cases, picking #2 or #3 suggestion.  But most likely is putting in enough notes and keys that the Tonal suggestions will be right, and it's one step more safe and interactive than hitting some song-wide function like "accept all Tonal recommendations that I skipped."  

- Tonal is very good for exploring when you are putting in a few notes and aren't sure what chord or mode you are in, but by the time you've keyed in all the notes you are likely to want per section, the recommendations will be few and will be good. You just want to see them and approve them.  

- Similarly, when you are ripping through on the main guitar, you are sure the chord you pick will be the chartChord, because you've already picked keys, and already chosen Bass noteRoot values where the guitar might be playing off into space but knows the Bass player defines the root.  So the guitar will get a slash chord, and Bass players know to ready the slash chord and find their root, when reading charts--they often don't have a separate chart than the guitar player.  

- So to suport this general, most-like use case, we need to have the easy, stick-around-until-the-end setting of auto-write-to-song, that is chartChord plus table level chord.  Because generally, the two are in lock step.  If you write to table chord in the UI today, you can then write it to the song.  So it's likely that you will auto-write to table and song at the same time.  

- You could go back and set a lead guitar to some other chord and not want to update the song.  But you would never update the Song without updating the table.  You'd only go back and update the table chord without updating the song afterwards.  So there is no "none" for auto-write.  It's just table-only, or table-and-chart.

### Full Mode List Problems

Producing long lists in the menu is bad.
- For these situations, you rightly call out the problems. 
- We'd like to side-step these by having the long lists printed out to showMessages, and postponing allowing entry or selection of these values into the Model until a later sprint where it is pushed as a needed feature.
- If we include it in this sprint, let's say that it would be a separate menu item that just dumps all modes, without the wester filter, into showMessages and quits there.
- The biggest mismatch is that we don't intend to support these modes in FillPlugin or the Fill menu page.
- We would need a way to copy or select the text into mode.  It's an advanced user thing to want an esoteric mode.  It seems bad to make the user copy-and-paste and then have to validate.  It also seems bad to have the menu system suddenly have to learn about paging.  It mostly is something that Tonal shows, and that we'd want to pass through to the User for pedagogy.

### Menu Details

Trigger `t` is taken by the popular TransposePlugin.

Therefore, TonalPlugin will have trigger `o` and plugins menu item `t<b>o</b>nal`

We'd opt for a few changes in the menu in your sketch.
We expect that the TonalPlugin will allow access to more Tonal features, since we don't dig into it very far in infinite-neck.  So the first menu is intentionally spare to allow for future features, and keep this rip-through-and-accept flow in its own menu.  The menu then feels like:

- "With TonalPlugin...Accept"
- "Accept what?"
- "This instrument, this section, chords suggestions."
- "Here they are."
- "Accept!"
- "Next Section!"
- "Accept!"
- ....

```
/fpo
    a) accept
    p) print extra modes

/fpoa
	i) instrument [P46_1]
	a) auto write [table|chart+table]
	p) prev section
    n) next section
	c) chords [count/status]
    C) accept Chord 'min7'
	m) modes [count/status]
    M) accept Mode 'minor'
	r) refresh
	h) help
```

/fpop -  print extra modes just does a dump to showMessages and closes menu.
/fpoap - navigate to previous section, leave menu here, update UI, update count/status
/fpoan - navigate to next section, leave menu here, update UI, update count/status

For any other nuanced navigation, close command-line and come back in, or use `r) refresh`.

`m) modes` drops you into a sub-menu with `a) accept 1: dorian` and `1) dorian` `2) minor` and so on.

Capital `M` is like the immediate action verbs in ClipPlugin for `C copy` and elsewhere for `Apply`.  It does it and stays there, and puts the `!` before the menu item it just did: `! accept <b>C</b>hord 'min7'`

Same for Capital `C` : accepts the chord, stays there.

For consistency let the max number of suggested modes or chords be 1) through 9). More are silently dropped except that dropdown result says "4 more modes, see Tonal picker" and likewise for chords.  The picker is the right place to deal with more because it is more intuitively interactive with the notes being placed right there.  If you have too many suggestions, you probably haven't placed enough notes.

For this sprint, we are ommitting clear semantics and clear actions totally.  These types of edits will be left in the TonalPicker UI.  The accept sub-menu will be all about 1) accepting, or 2) not accepting and moving to the next.

For this sprint, since choosing source of NamedNote, SingleNote, and TinyNote seems to replicate tonalSourceSet, we would prefer to defer to the value in the Model, which is picked and persisted in the TonalPicker.  So we rely on the TonalPicker, but since the value lives in the Model in the table's tonalSourceSet, we are not UI dependent on the TonalPicker existing.  Therefore it seems a safe simplification.  Again, the use case is ripping through the song and accepting Tonal suggestions visually and safely with fast key presses in stable locations rather than finicky mouse clicks.


### Showing values

Showing values before dropping into chords or modes:
```
chords [&check;Cmaj7, 4 more]
modes [C ionian, 3 more]

or when only one: 

chords [&check;Cmaj7]
modes [C ionian]

or when none: 

chords []
modes []
```

If you are doing auto-write to Section.chartChord, then the &check; is calculated as being shown if the chord is in the Section, else absent.  If you are doing auto-write to table, then the &check is calculated as being shown if chord is in the table, else absent.

### Accept Semantics

Seem correct in the design sketch.  We have discussed them more above.

Specifically, we show how we can have "accept" show the value being accepted, and either an immediate action `C` or a submenu `c` for example.

### Moving target ambiguities

Since we have not specified that the menus should update during looping or other refresh events, we can assume that the Section the user dropped into or did a simple nav to is the one he thinks he is editing.  FillPlugin and some others could change the tonal suggestions.  We will limit this by documentation, rather than stopping the looper or trying to keep the menu in sync.  Again, this won't break a song, it will just put un-preferred chords in the chart, without deleting or adding notes.

### Shared, refactored functions

Let them be in `tonalPicker-functions.js` for ease of importing and splitting out shared code from the HTML-oriented `tonalPicker.js.`

### Persistence

Given that we are happy to have the menus recalculate and refresh values on changing menu levels, we would want any temporary stuf not persisted.  So we aren't even sure these things need to exist, much less be persisted: 
- last suggestion list
- last accepted candidate index

## Iteration 3: answers and approval for coding

Thank you for [125-implementation-plan.md](125-implementation-plan.md)  We approve the plan, and add the following discussion and answers.

It is, by the way, acceptable to increase the imports from Tonal.js especially where they have exposed a function that eases or normalizes inputs to their other functions.  Tonal.js is function-oriented and plays best when given what it supports and expects.  We defer to their authority for most features.  Where we diverge is that we support additional modes and chord spellings and try to call these out in User-facing lists with parenthesis, but our long-term goal is to standardize more fully on their nomenclature.

Default autoWrite is chart+table.

We fixed references to all now be /fpo for menu path in 125-design.md  . We did not alter 125-design-sketch.md, it being your document, and being produced before we made the path change.  But /fpo is the correct path, `o` is the trigger, and `t<b>o</b>nal` is the plugins menu menu-item caption.

Yes, the plan is correct. We debated whether to have two checkmarks or checkmark styles for table vs. chartChord etc.  But we decided that if the intent was to rip through and ensure chords were in the Section.chartChord, then knowing that it was stored in the table was low-importance, and possibly confusing.  Where nuanced understanding of this is required, the HTML tonalPicker spells it out in color and Kanji characters and strikethrough and the support of seeing the Chart or Chart Notes at the same time.  In other words, too much visual density for the command-line to handle.  So check means: for the storage you are autoWriting, it is there or it is absent before you accept.

Slash chords. Yes--preserve Tonal.js's format.  We had FillPlugin do some fanciness with stripping out the slash chords, so that we could recreate just the mode fill.  But for TonalPlugin, we are attempting to accept Tonal's verbatim suggestion, and show it on the chart, the same as TonalPicker allows.

Overflow Result Message Wording: only in dropdown action result.  Subtle and hidden from the normal flow, but available to the advanced/observant User.

Yes, the full unfiltered list, which would include the Western modes too, should be output upon `print extra modes`.

### Iteration 3 Request 

With that, coding for TonalPlugin and helpers is APPROVED.  Core changes should not be needed, but registering the Plugin and tweaking imports (while not technically in core) is CORE-APPROVED.


## Iteration 4: Tweaks

1) Make the `chords [[✓BbMadd9, 1 more]]` menu item have up to 3 chords, instead of 1 as designed.

2) transform `accept <b>C</b>hord 'BbMadd9'` into `<b>Chord <em>BbMadd9</em>` . In other words, preserve the styling of the verb with the normal `<b>` highlight for the trigger, add `<em>` styling for the suggested single chord, remove the single quotes, and add `<em>` rule to command-line.css to make em in this context be simply `font-weight: bold` but not a different color.

3) do the same for `Mode`, previously called `accept Modes...`

4) Looking good. We'd like to tweak the checkmark.  Let it be a span, styled in command-line.css and whichever quote styles work with the menu output:
`<span class='commandCheckmark'>&check;</span>`  With styling: bold; font-size 90%; color: red; and with left and right padding/margin of 0.2em; so that the checkmark has a little space on both sides but still plays well as inline text--adjust rules as you know works well.







