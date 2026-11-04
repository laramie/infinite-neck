# sprint-153-instrument-chart-widgets

sprint number: 153

sprint shortname: instrument-chart-widgets

date: 20261103

status: **passed and accepted** (20261104, Iteration 4 UI test)

Index of all sprints for reference: [sprint planning index](../../../lifecycle/sprints.md)

## Purpose

Purpose of this sprint is to:
- Create widgets to show chart info close to the Instruments for planned print layout, especially when planned print layout shows multiple Sections. 

## Sprint document locations

- [sprint-154-print-layout](../154-print-layout/sprint-154.md) is an in-progress sprint that will use these widgets per-Instrument to follow the Sections and provide Chart chords, modes, and Song keys for each Observer and the Main Instrument so they print properly.

- [design document](153-design.md) 

## Iterations

  - "Iteration 1": 
    - Define Wishlist
    - Copilot produced analysis of Wishlist: [153-it1-analysis.md](153-it1-analysis.md)
  - "Iteration 2":
    - Decisions captured in the design document
    - Copilot produced implementation plan: [153-it2-implementation-plan.md](153-it2-implementation-plan.md)
  - "Iteration 3":
    - Simplifications captured in the design document (widgets are print-only)
    - Copilot produced simplified implementation plan: [153-it3-implementation-plan.md](153-it3-implementation-plan.md)
  - "Iteration 4":
    - Decisions captured in the design document (`*Caption` tokens in templates, Tonal tokens scoped to a Section, flat `{top, left}` templates); CORE-APPROVED coding done.
    - Templates: [templates/InstrumentChart/instrument-chart-templates.js](../../../../templates/InstrumentChart/instrument-chart-templates.js)
    - Developer switch (DevTools console, not persisted, reset on song load): `InstrumentChartBuilder.setMode({ top: true, left: true })`; `setMode({ top: false })` merges; `InstrumentChartBuilder.getMode()`.
    - Teardown: on table rebuild the widgets are removed, and only the SectionStatus owners whose ids start with `tbl` (the `leadsheet` owner shares that registry and is kept).
    - New Jest: `approved-values-scoped`, `instrument-chart-core`, `instrument-chart-builder`.
    - Manual UI acceptance (not run by Copilot): load `songs/demo/superchart.json`, switch both modes on, check each Instrument shows its own Section's chord/mode/key and that `${getSectionCaption}` with HTML in a caption is shown escaped.
  - "Iteration 4 test results": passed and accepted.  The `setMode` variants all worked.  The left rail widget wrapped every chord until `min-width: 4em` was added by hand in `instrument-chart.css`; GUI controls for the left width and the two paddings moved to sprint-154: [154-it3-implementation-plan.md](../154-print-layout/154-it3-implementation-plan.md).

