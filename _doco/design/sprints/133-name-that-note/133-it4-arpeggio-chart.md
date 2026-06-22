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

