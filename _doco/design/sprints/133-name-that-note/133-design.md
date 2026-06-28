# Design.

We want to implement a name-that-note practice song using Arpeggio Plugin.
    - arpeggio already has: 
      - style: random
      - string range
      - position range
      - note coloring
      - delay of display of note name and function with "flashcard" mode
      - display NamedNote based on SingleNote inputs, which can be hidden.  So the User can put up to 12 SingleNotes on the neck, in a mode or chord pattern, choose "Hide Single Notes" in View, choose "type": "single" in arpeggio in `/fpat`, enable the plugin, and hit "LOOP" and be in busines.

name-that-note is like flashcard mode with arpeggio today, but within string range and positions a note is chosen at random, shown with the highlight, then revealed with a NamedNote on the next beat.      

If we try this today with style: random, we get some funny results because "random" was never worked out fully or tested. It was put in when we wrote arpeggio, but never spec'd very carefully because we knew this sprint would come some day.

So we'd like to nail down what "random" means, then get into the details of what using "flashcard" mode with random means.

Eventually, in a later Iteration in this sprint, we'd like to teach arpeggio to read the Chart the way FillPlugin does.  But that is deferred for the first Iterations.  We just want to keep it in mind.  For these first Iterations, the strategy will be to allow the User to build Sections with lots of beats (like 24 to 36) so they can easily cover a wide "position" on all strings, and learn that position before changing "positions" (position-pairs in the internal naming of the code) either by adjusting plugin settings manually or through revive, or by setting `positions > values` and "song loops per position" to get the whole practice session they want.

Our first step will be to understand what "style": "random" is doing.  It seems to select the entire candidate set by random number set, on *each beat*, which seems a bit much.  At any rate, for the name-that-note in "flashcard" mode practice, we need it to randomly select one note, show the highlight, then on the next beat show the note name and the next highlight, the way flashcard mode works properly in "style":"every".  Particularly we don't want the highlight to be replaced in the next beat by a random note.  We want the NamedNote shown to be in the exact cell where the highlight was shown in the previous beat.

So the first deliverable from Copilot is `133-analysis-1.md`.  Please provide a bried summary of what random is doing now, and discuss the steps needed to make it do what we have sketched out, and what answers we will need to design or provide for a meaningful implementation plan.

# Design: Iteration 2: answers to analysis questions

- What to do with small note sets?  Answer: a valid use case is a Section with one beat.  A User could craft a song with many Sections, each with one beat, but each Section with some restriction of interest: a chord, a mode, a color scheme.  If they were not in flashcard mode, the system would play the one note, with all features, and even color, but it could still be a randomly chosen note.  So: minimum notes would be 1.

- This also means that random is independent of flashcard mode.

- For each section, we do want to de-dupe, and start fresh for each section.   It would be valid to allow duplicates, but we aren't rolling that out as a feature--much simpler to say it will be unique so that if you have 12 beats you are guaranteed to hit all tones in a chromatic possibility set, even if you haven't covered all cells on the neck.

- This means we want the random generation to occur simply for each Section.  So each change due to configuration change would also regenerate.  Also restarting song regenerates.

- We think the special case of restart section as mapped by `/fmr` should *not* regenerate, but repeat note in the same order, even if obscured by flashcard etc.  This way, there is one way to repeat an interesting or difficult sequence during practice deterministically.  If it is truly interesting or musical, the User can grab it by pausing looping and using ClipPlugin.  (We should ensure that there is some mechanism either in ClipPlugin or in `/fa` to commit/remove-owner from notes grabbed from plugins that place `owner:` properties on temporary notes.)

- Therefore, restarting looping or beat looping should *not* regenerate, if it picks up within a Section and continues that Section.  That is, starting looping at beat one or crossing a boundary into a Section would generate a random set.  Pausing looping on beat 4 of 8 would pause.  Resuming looping on beat 4 of 8 continues looping on that same set, picking up where everything was, as happens in ArpeggioPlugin today.  The User can craft a longer beat-count Section and can see the beats and total beat count coming in the Transport, so has time to stop the loop if he cares.

- The special last-beat handling should be retained.  It is unfortunate that the beat can't be revealed in the next Section, but that is too un-implementable: Section changes are allowed to change almost everything: color, layout, key, note functions. If a User really cares about having enough notes to guess, he will make more beats in the Section.  And if a song has 8 beats, it musically cannot be extended to have 9 beats just for display purposes.

- The special case of exhausting the set when more beats are available: we would think the algorithm could predict this and make a comfortably large enough set to survive de-duping.  And we already said that restarting Section or pausing and restarting looping continue with the same set in the same order.  So if exhaustion happens, then a reshuffle of the same set is in order.

- There is, we believe, no other use case for "random" that what we are designing now.  Randomly going through an arpeggio and randomly going through all notes in the position and string ranges are the same use case, the latter being an arpeggio over a "chromatic" set of all 12 notes, or "chromatic mode" as it is called musically.  Since "chromatic" is currently available as a Tonal.js mode and as an infinite-neck Fill Menu Page mode, this is a valid "degenerate chord"/"full mode". Tonal.js won't accept it as a "chord", and neither do we, but we both accept "chromatic" as a mode.  And we intend arpeggio to support 1) named, 2) single, 3) Section.chartChord, and 4) Section.chartMode as valid source note sets.  3) and 4) will be added in a later Iteration.


# Iteration 3: answers to 133-implementation-plan-1.md

- Special case of "loop beats" (e.g. `#btnLoopBeats`) should loop over the same set of generated random notes, in the same sequence each loop.  Technically, we haven't passed a Section boundary, so this fits both the mental model, and the use-case of practicing with a repeated set for body memory.  If the user wants a new randomized set for a Section on each loop, he can make a song with one Section and use LOOP Sections.

- As we implied, these specifications *are* the full specs for "random".  There should not really be old hold-over behavior from previous implementation of "random". Previous implementation of "flashcard" is correct, so *should* be retained, and fixed to work with any new requirements.

- According to `help.html#transportNavigationTable` the `prevSection` action is compatible with crossing Section boundaries, so the special case of having one Section and mashing on the button for prevSection technically takes you to the begining of the Section without crossing a boundary, but not according to the help doco.  However, the behavior should be treated as Section navigation.  This is why we created specifically the `RestartSection`  `/rbf`  `gotoFirstBeat` action and the matching mapping in `/fmr`, so that semantically `/fmr` is the true RestartSection, and other GUI quick-thinking behaviors are navigation.  Therefore `/fmr` is restart-section-reuse-generated-random-notes, and others like `prevSection` are start-section-with-regenerated.

- However, navigating beats by `gotoFirstBeat` `gotoLastBeat` `prevBeat` and `nextBeat` does not seem to cross boudaries, but allow you to go to beat 1 and the resume Section LOOP.  Therefore, these should behave the same as if you had *not* crossed a  Section boundary.  That much is logical and easy to justify.  The implied case breaks a rule in the implementation plan, which we want to ammend: using beat navigation within a Section and then starting from any beat, specifically including starting from beat 1 does not generate a new set.  That rule really meant: when you get to a new Section, and are sitting on beat 1, you should have already acquired a random set, so starting from here plays that set.  If you open a song and are sitting on Section 1, beat 1, and turn on (or Load Enabled) ArpeggioPlugin and it wakes up with "random" then it should be generating a random set in this case, so it is not the act of starting on beat 1 that causes the random set generation, but rather the fact of being in a Section that hasn't played yet while being in "random" mode.

- Math.random is fine for generation.

- Rather than UserLog, please use console.log for random sequence debugging.  It is easier to grep for and remember to clean up before creating a distribution.

With these answers, the implementation plan is approved for coding.  Please proceed.


    