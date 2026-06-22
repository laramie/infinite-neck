# Design

Now that we have ArpeggioPlugin doing flashcard and random, and now that we have FillPlugin properly implementing "automatic from chart", we'd like to port the "automatic from chart" into ArpeggioPlugin > type, `/fpat`.  

This currently supports `n) named` and `s) single`.

We would add siblings to named and single:
```
    n) named
    s) single
    c) auto chord
    m) auto mode
    b) auto chord+mode
```

This would use the algorithm from FillPlugin where applicable.

auto chord would just follow the Section.chartChord, and auto mode would just follow Section.chartMode, and auto chord+mode would follow both.

In all cases, where TransposePlugin is transposing things, behave as though we are following the transposition, not the original chart chords and modes in their persisted roots, but instead using the behavior when Chart > Options > `Strip Tonal roots (view only)` and `Add transposed root to chord` are in effect, but not relying on those actually being checked or the values in the session.  If Transpose is happening, the Arpeggio auto modes should use the transposed root.

Please provide an implementation plan following the intent of this design, calling out any implications, design holes, and perhaps surprising implementation outcomes, in `133-it4-implementation-plan.md`

## Design holes and open questions ANSWERED

1. Root authority: should auto types always use `section.rootID`, or should `rootIDLead` ever override when set?
ANSWER: Ignore roodIDLead.

2. Literal-vs-transposed expectation: should there be any optional "respect literal chart tonic" mode, or is transposed-root-only mandatory for all auto types?
ANSWER: All auto types do transposed-root-only.  If UA testing shows User confusion, we'll just change the captions to include something about transposition, but "auto" implies that for now.   named and single stay as they are now.

3. Intersection semantics: confirm that `auto chord+mode` must be strict intersection rather than union.
ANSWER: Sorry, we meant "union".  The candidate set would be all notes in the chord plus all notes in the mode.  Technically, the chord should be contained in the mode, but that is not a requirement of anything, and many musical styles break this rule to make interesting music.  Tonal.js may have some internal rules about this, but when we use Tonal.js to select them independently and store them separately in the Section, everything works.

4. Percent repeat `%`: should `%` reuse previous section chart values for auto types, or be treated as unresolved/empty in Arpeggio context?
ANSWER: The repeat should be display-only for this use-case.  Arpeggio should follow Section, not calculated "BAR".  BAR is a construct of the Chart display.  Each Section should have just one Section.chartChord and Section.chartMode.  So the Arpeggio should not change at BAR boundaries anyway.

5. Chord extensions: should auto chord note sets include full extension tones when available (9/11/13), or be constrained to triad/seventh for playability?
ANSWER: The notes that are visible when we do Fill should be the same as the notes available for Arpeggio.  These should come from actual chord chosen and/or actual mode chosen.  So Tonal.js's optional extensions should not be an issue, because the User has allready limited his choice in the Chart to a concrete chord.

6. Alias source-of-truth: should Fill and Arpeggio share one alias table module now to prevent divergence?
ANSWER: Sounds like a good optimization.


