# sprint-141-float-layouts

sprint number: 141

sprint float-layouts:

date: 20260817

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: 
- Figure out how to have floating windows persist their state.
- Fix bugs in floating windows. 
- See [Iteration 1 problem statement](141-it1.md)

## Sprint document locations

- [Iteration 1 problem statement](141-it1.md) 

## Iterations

  - "Iteration 1": Describe the problem

  - "Iteration 2": Implement recommended fix first
    - **Small, independent, low-risk fix (do first, arguably even before persistence):**
      - Call `disposeAllDockables()` at the top of `updateAfterOpenSong()` and
        `updateAfterAppendSong()`'s `importOptions.sections` branch, so stale floats from a
        previous song never survive a new song load. This alone removes half of bug 2 with a
        one-line change and no schema/model work.

  - "Iteration 3": Implement architectural fixes and recommendations in [Iteration 1 analysis](141-it1-analysis.md) . These were slated for Iteration 2 in Copilot's analysis, but have now been given their own Iteration 3.    

