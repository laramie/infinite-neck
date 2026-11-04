# sprint-154-print-layout

sprint number: 154

sprint shortname: print-layout

date: 20261103

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to: 
- Implement a print layout so Songs can be printed.
  - Initial Wishlist is in design document.

## Sprint document locations

- [sprint-153-instrument-chart-widgets](../153-instrument-chart-widgets/sprint-153.md) is an in-progress sprint that will deal with creating widgets that will display Chart chords, modes, and Song keys left or top of each Instrument, so they follow the Instrument for each Section.

- [design document](154-design.md) 

## Iterations

  - "Iteration 1": 
    - Define Wishlist
    - Copilot produced analysis of Wishlist: [154-it1-analysis.md](154-it1-analysis.md)
  - "Iteration 2":
    - Decisions captured in the design document
    - Copilot produced implementation plan (with DevTools spike recipe): [154-it2-implementation-plan.md](154-it2-implementation-plan.md) (written before sprint-153 was built; superseded by Iteration 3, kept for the spike recipe and unchanged sections)
  - "Iteration 3":
    - Sprint-153 passed and accepted.  Its test results add print panel controls: left widget width, left widget top padding, top widget left padding (with "align with left rail").
    - Copilot produced the revised implementation plan: [154-it3-implementation-plan.md](154-it3-implementation-plan.md).  No `T` / `L` buttons, no re-sync, no ChartWidgets tab; two panel checkboxes drive `InstrumentChartBuilder.setMode()`; widget spacing via `InstrumentChartBuilder.setMetrics()`; a latent `layout.js` flag bug is fixed first.

