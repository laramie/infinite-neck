# Iteration 1, request 1

So now that you have looked at that code, can you give us an analysis of replacing the strategy of what that is trying to do?  This is informational, no code changes at this point.  What we are trying to do is show all the note names exactly as shown by NamedNotes.  We found a trick with messing with the visibility using transparent etc.  But it's a hack.  What would be involved with having a separate "lane", a real DOM layer that was just the note names, laid out the same as NamedNotes, but invisible or display:none that we could turn on and have it z-ordered correctly, without messing up the layout of any of the note types?  We've had a number of bugs where the transparency fails because it is a hack, especially when we have lots of color schemes.

# Iteration 1, Copilot response

I’m tracing how NamedNotes are actually rendered and positioned so I can compare the current font-color hack against a dedicated note-name lane and give you a concrete cost/risk analysis.

Searched for regex `namedNote|setNamedNote|showAllNoteNames|NoteDisplay|CenterCell` (`**/*.{js,css,html}`), 200 results

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#1-1), lines 1 to 260

Read [](file:///home/laramie/infinite-neck/Note.js)

Read [](file:///home/laramie/infinite-neck/SectionNotesPersistence.js)

I have the render structure; next I’m reading the CSS and NamedNote update paths to assess whether a dedicated lane can reuse the same positioning contract or whether it would need parallel styling logic.

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#430-430), lines 430 to 560

Searched for regex `clearNamedNoteDivs|namedNoteDiv|NoteDisplay\.removeClass|lookupClassForNote` (`**/NoteTableController.js`), 24 results

Read [](file:///home/laramie/infinite-neck/infinite-neck.css#1360-1360), lines 1360 to 1495

I’ve confirmed NamedNotes are a first-class child inside each NoteDisplay already. I’m reading the replay/repaint path now, because a separate lane is only viable if it can plug into the same repaint lifecycle without duplicating too much of the note-application logic.

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#920-920), lines 920 to 1165

Searched for regex `function replay|export function replay|fullRepaint|repaint|namedNotes` (`**/NoteTableController.js`), 21 results

Read [](file:///home/laramie/infinite-neck/test.html#30-30), lines 30 to 120

Read [](file:///home/laramie/infinite-neck/NoteTableController.js#726-726), lines 726 to 830

Yes. A separate real note-name lane is a better design than the current font-color/transparency trick.

Short version

The clean approach is not a global overlay floating above the table. The clean approach is a per-cell overlay lane inside the existing NoteDisplay container.

Why that is the right shape

- The current cell DOM already behaves like a lane stack. In infinite-neck/NoteTableController.js, each cell builds one NoteDisplay container with sibling layers for tinyNote, singleNote, Fingering, and namedNote.
- The current Show All Note Names feature is not using that lane system. It is globally changing text color on .noteWhiteKey and .noteBlackKey in infinite-neck/infinite-neck.js, which is why it keeps breaking against theme backgrounds, gradients, transparency, and piano-specific wrapper cells.
- NamedNotes themselves are already a proper overlay layer, styled through replay and styleNamedNote in infinite-neck/NoteTableController.js and infinite-neck/NoteTableController.js. That is the architecture to imitate.

What the current hack is doing wrong

- It toggles the text color of the whole key family, not a dedicated label element, in infinite-neck/infinite-neck.js.
- It infers contrast from background presentation details instead of owning its own layer.
- It depends on theme output and computed CSS behavior, which varies across plain fills, gradients, transparent wrappers, and special layouts like PianoSkeuomorphic.
- It is conceptually cross-cutting: one feature is manipulating the visual contract of every key class, rather than just showing or hiding one dedicated element.

That means the current design is fragile by construction, not just buggy in implementation.

Recommended replacement

Build a new sibling layer inside each NoteDisplay, something conceptually like:

- tinyNote
- singleNote
- Fingering
- allNoteNameLane
- namedNote

or:

- allNoteNameLane under all “real” played/named overlays
- singleNote
- tinyNote
- namedNote
- Fingering

The important point is that this new lane lives inside the same NoteDisplay that already owns centering, sizing, piano-key geometry, nut behavior, and natural fret width scaling.

Why not a separate table-wide overlay container

A detached overlay sounds attractive, but in this repo it would be the more fragile design.

Reasons:

- Cell sizing is dynamic. NoteDisplay width and font-size are computed in infinite-neck/NoteTableController.js and applied per cell in infinite-neck/NoteTableController.js.
- PianoSkeuomorphic changes physical geometry and overlap behavior heavily in infinite-neck/templates/piano/piano-skeuomorphic.css.
- Natural fret widths, nut widths, reversed tables, and per-tuning layout decisions all already flow through the existing cell DOM.
- A detached overlay would require recomputing absolute positions for every visible cell and staying in sync on resize, repaint, tuning reload, and theme change.

That is a lot of machinery to recreate something the current per-cell DOM already gives you for free.

So if by separate lane you mean a real DOM layer, yes. If you mean a separate cross-table overlay system, I would not recommend it.

What would be involved

1. Add a new structural child to each cell
- Today the note content is produced by cellBuilder and buildNamedNote in infinite-neck/NoteTableController.js and infinite-neck/NoteTableController.js.
- You would likely introduce one more builder that emits the same inner markup geometry as namedNote, but with a distinct outer class.
- The key idea is: same content structure, separate purpose, separate class.

2. Stop using key-family color mutation for Show All Note Names
- The feature in infinite-neck/infinite-neck.js would become a pure visibility toggle.
- Instead of computing contrast and painting .noteWhiteKey / .noteBlackKey, it would just toggle a class on the document, table, or NoteDisplay lane itself.

3. Add explicit z-order rules
- Right now tinyNote has explicit z-index in infinite-neck/infinite-neck.css, Fingering has another in infinite-neck/infinite-neck.css, and namedNote mostly wins by DOM order.
- A dedicated lane should not rely on incidental DOM order.
- I would normalize this with explicit z-index rules so the always-visible note names are predictably below real played overlays and below actual NamedNotes.
- That makes the behavior stable across themes and future CSS changes.

4. Decide the visual contract of the new lane
This is the main design question.

There are two possible interpretations of “exactly as shown by NamedNotes”:

- Same layout and typography as NamedNotes
- Same full visual treatment as NamedNotes, including color class behavior

I strongly recommend the first, not the second.

Why:
- Real NamedNotes are semantically colored notes.
- Show All Note Names is just a universal label layer.
- If the new lane reuses palette color classes, you are back in theme-coupling land again.

A better contract is:
- same centering
- same function-vs-note-name rendering
- same subscript/enharmonic layout
- same MIDI placement if desired
- stable dedicated text color rules for white-key and black-key contexts
- no note color class dependency

5. Keep it out of the model
- This should not touch SectionNotesPersistence at all. NamedNotes are persisted model state in infinite-neck/SectionNotesPersistence.js.
- Show All Note Names is display-only.
- The new lane should be regenerated during cell build and toggled during repaint, but never stored in section data.

6. Make it independent from actual NamedNotes and transient NamedNotes
- Plugins already use transient named-note display via NoteTable events in infinite-neck/NoteTableController.js and infinite-neck/NoteTableController.js.
- That mechanism should keep targeting real namedNote, not the universal lane.
- This is a major advantage of a separate class: you avoid collisions with replay, plugin overlays, and the brittle class-reset code around namedNote in infinite-neck/NoteTableController.js.

What gets simpler

- Theme compatibility becomes much simpler because Show All Note Names no longer depends on background-color introspection.
- PianoSkeuomorphic stops being special for this feature.
- hideNamedNotes and showAllNoteNames become separable concepts instead of overlapping CSS hacks.
- The logic becomes easier to reason about:
  - namedNote = modeled or transient note overlay
  - allNoteNameLane = universal label overlay
  - single/tiny/fingering = played-note overlays

What gets more expensive

The main cost is DOM size.

A new lane with the same internal markup as namedNote likely adds around one extra small subtree per cell. Since buildNamedNote is not trivial markup in infinite-neck/NoteTableController.js, this is a real increase.

That said, the repo is already doing a lot of per-cell DOM work:
- every cell already gets tinyNote, singleNote, Fingering, and namedNote
- full rebuilds already happen through fullRepaint in infinite-neck/NoteTableController.js

So this is not free, but it is architecturally aligned with the way the app already works.

My expectation:
- moderate DOM cost
- low conceptual cost
- much lower bug surface than the current theme-dependent hack

What I would recommend specifically

Best option

- Add a new per-cell sibling layer inside NoteDisplay
- Use the same textual content geometry as buildNamedNote
- Give it its own class, not namedNote plus modifiers
- Hide/show it with a single class toggle
- Give it explicit z-index below real interactive overlays
- Give it dedicated stable color rules for white-key and black-key contexts
- Keep it display-only, with no model persistence

I would not recommend

- A detached absolute-positioned overlay over the whole table
- Reusing namedNote itself and trying to coerce it into two roles
- Continuing the global key text-color mutation strategy

Open design decisions you should settle first

1. Should the universal lane respect hideNamedNotes, or is it a completely separate concern?
2. Should it show exactly the current cell mode:
note names vs functions, subscripts, MIDI text, center-for-right-function, and so on?
3. Should it appear below or above singleNote and tinyNote?
My recommendation: below real played overlays, below actual NamedNotes, above bare key background.
4. Should its color be theme-driven, or fixed by white-key/black-key contrast variables?
My recommendation: fixed by dedicated contrast variables, not by note color classes.

Bottom line

A separate DOM lane is the right long-term direction, but it should be a per-cell lane inside NoteDisplay, not a detached overlay system. That gives you the visual stability you want without re-solving layout, piano overlap, fret scaling, and z-ordering at the table level.

If you want, I can next turn this into a concrete implementation design with:
1. exact DOM shape
2. CSS layer ordering
3. which functions would change
4. migration steps with low regression risk

# Iteration 2: questions answered

Please make an implementation plan since the following questions are answered:

Generally, the show named notes universal lane is to show in black and white the note names, midi numbers, and functions, in the layout of NamedNotes, but underneath NamedNotes and all the others.  Placing any visible note covers the universal lane's text.  This is part of the problem today, is there are times where that appears to be not true because the hack doesn't think in layers. Some themes are not black and white, but there are complimentary pairs of colors for making sure fonts are visible and high-contrast in every theme.  These should be used for the universal lane.

We defintely want the per-cell approach.

Should the universal lane respect hideNamedNotes, or is it a completely separate concern?  A: The universal lane is a separate concern.

Should it show exactly the current cell mode:
note names vs functions, subscripts, MIDI text, center-for-right-function, and so on?  A: Yes, not the colors, but the layout should be like NamedNotes.

Should it appear below or above singleNote and tinyNote?
My recommendation: below real played overlays, below actual NamedNotes, above bare key background.  A: Yes, exactly.


Should its color be theme-driven, or fixed by white-key/black-key contrast variables?
My recommendation: fixed by dedicated contrast variables, not by note color classes. A: as described above, use the contrast variables.  For most themes, this will be black/white, but you can see the other themes have similar choices that work with theme colors.

# Iteration 2: Copilot draft implementation plan

(114-implementation-plan-draft.md)