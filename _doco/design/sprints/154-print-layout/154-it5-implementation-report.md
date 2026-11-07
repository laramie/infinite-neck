# sprint-154 Iteration 5 — Implementation Report

Status: coded, Jest green (91 suites / 1350 tests), `validate-command-menu` 0 errors. **Browser UI not exercised by me** — please run the UA recipes below.

CORE files touched (approved): [infinite-neck.js](../../../../infinite-neck.js), [SongPersistence.js](../../../../SongPersistence.js).

---

## 1. Bug: empty `divP46_1_wiring` visible on "Enter Print Layout"

### Root cause
`reinstallAllTuningsTables()` rebuilds every table, which creates fresh `.divWiring` elements. They are visible by default. The `e` key toggles the `WIRING_OPEN` state, but that state was only re-applied by `WiringBuilder.addWiringWidget()` -> `restoreWiringOpenState()`. Print tiles have no Wiring widget, so nothing re-applied the state and the placeholder text ("Wiring for ... goes here.") showed. Pressing `e` hid it because `toggleWiringOpenState` hides all `.divWiring`.

A related defect: after *leaving* print, the rebuilt tables had no Wiring widgets at all.

### Fix (three parts, `e` shortcut untouched)
1. `reinstallAllTuningsTables()` now ends with `restoreWiringOpenState()` (general fix: any rebuild re-applies the current state).
2. The print provider `reinstallTables` also triggers `UpdateAllWiringSelects` when print is **not** active (i.e. after Leave), rebuilding the Wiring widgets.
3. [print.css](../../../../print.css): `body.printScreen .divWiring { display: none !important; }`. Tiles have no wiring, so nothing to show.

Debugging note: `e` still toggles `WIRING_OPEN`; while in Print Layout it has no visible effect because of (3). If you ever wonder why `e` "does nothing" there, that rule is the reason.

---

## 2. Optional: page bounding box

**Feasible, implemented, with caveats.**

- Width is exact: the grid's own width is Paper width − 2 × 0.4in (CSS px, `--print-page-width`).
- Height: Paper height − 0.8in in CSS px (`--print-page-height`), valid at 100% print scale.
- Drawn as `#tabledest::after` (absolute, dashed red, label from `data-page-box`), hidden in `@media print`. New option `grid.pageBox` (default on), checkbox **Page box** in the panel.
- Label example: `Letter, portrait: 7.7 x 10.2 in printable (739 x 979 px), page 1`.

Caveats (why it is a guide, not a guarantee):
- Print dialog scale other than 100% changes the real page.
- The Chart host (or anything printed above `#tabledest`) shifts the real page start.
- Page breaks fall on tile boundaries (`break-inside: avoid`), so the last tiles on page 1 may move to page 2 even if inside the box.
- `@page size` is honored by Chrome; Firefox/Safari untested.

---

## 3. Required: template lists + two editors

### Data model
- `CHART_WIDGET_TEMPLATES = { top: [ {id, caption, template}, ... ], left: [ ... ] }` in [templates/InstrumentChart/instrument-chart-templates.js](../../../../templates/InstrumentChart/instrument-chart-templates.js). Placement = list name.
- System ids (explicit, kebab-case, start with `<placement>-`, never `u-`): `top-chord-mode-caption-key-section-beats`, `top-chord`, `left-chord-key`, `left-chord`.
- User templates: `song.chartWidgetTemplates = { top: [], left: [] }`. Omitted from file when empty; only non-empty placements saved. Ids = `u-` + squeezed caption (reuses `functionSymbolSets.js` helpers); id is kept when the caption is renamed. Max 20 per placement, caption <= 40, template <= 2000 chars.
- Chosen template per placement is a print-screen option: `chart.topTemplateID` / `chart.leftTemplateID` (default = first system id). Unknown/deleted id resolves to the first system template.
- Pure logic in new [templates/InstrumentChart/chart-widget-template-sets.js](../../../../templates/InstrumentChart/chart-widget-template-sets.js); resolver `getChartWidgetTemplate(placement, id, userLists)` in `instrument-chart-core.js`.

### Security / validation
User templates go to `innerHTML`, so `checkChartWidgetTemplate` is strict and runs on Save **and on load** (unsafe entries in hand-edited Song files are dropped):
- sanitizer-allowed tags only (never `<a>`, no `cmd-line`);
- only `class="..."` attributes, only whitelisted classes;
- only `SAFE_WIDGET_TOKENS` in `${...}`;
- no stray `<` / `>`, no control chars.
Tag balance is not required. The system top template keeps your stray `</span>` after `</b>` as written.

### Editors (on `#divPrintLayoutTab`, left above top)
Built by [templates/printlayout/chart-template-editor.js](../../../../templates/printlayout/chart-template-editor.js), wired in `printlayout.builder.js`, styles in `printlayout.css`. Follows the Function Symbols pattern: dropdown, Customize button, caption, system-managed ID label, Save, `X`, textarea; no previews, no reordering.
- System template selected + Save = "Save as new" (caption proposed "U: <caption>").
- User template selected + Save = edit in place.
- Only User templates deletable; after delete the selection falls back to the default id.
- Live: every change goes through `PrintLayoutController.setUserTemplates` + `apply({chart:{...TemplateID}})`, tiles re-expand immediately.
- Draft text survives panel refreshes (rebuilt only when chosen id or that placement's user list changes).
- Whitelist class SELECT + Insert via `installWhitelistClassControls(host, textarea, 'selWhitelistClasses{Left|Top}Chart')`, same whitelist as SongWidgets; no "save false" button.

### Persistence / schema
`SongPersistence.js` normalizes on load, filters on save. [bin/song-file-schema.js](../../../../bin/song-file-schema.js) gains `chartWidgetTemplates` (top/left, no additional properties).

### Auto-approved "Recommended" choices
Ids stored per placement list; no per-item placement property; `u-` prefix; selection stored in print options; selecting a system template + Save creates a copy; limits 20 / 40 / 2000; strict validation on load.

---

## 4. Files
Modified: `infinite-neck.js`, `SongPersistence.js`, `print.css`, `printlayout.js`, `bin/song-file-schema.js`, `templates/InstrumentChart/{instrument-chart-core,instrument-chart-templates,instrument-chart.builder}.js`, `templates/printlayout/{printlayout.builder,printlayout.controller}.js`, `templates/printlayout/printlayout.css`.
New: `templates/InstrumentChart/chart-widget-template-sets.js`, `templates/printlayout/chart-template-editor.js`, `_tests/jest/chart-widget-template-sets.test.js`.
Tests changed: `instrument-chart-core`, `instrument-chart-builder`, `printlayout` tests. Several template-text-dependent tests were already stale after your earlier template edit; they now use inline/User templates and a vocabulary guard instead of system template text.

## 5. Test results
`node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --runInBand`: 91 suites, 1350 tests passed. `node bin/validate-command-menu.js`: 0 errors, 5 pre-existing warnings.

## 6. UA recipes
**A. Wiring div.** Load a song, Enter Print Layout: no empty wiring div, no gap. Press `e` (no visible change). Leave Print Layout: Wiring widgets are back and `e` toggles them.
**B. Page box.** Choose Letter / A4 / portrait / landscape: dashed box and label follow. Toggle "Page box" off: gone. Compare with print preview at 100% scale.
**C. System templates.** Pick each system template in both editors: tiles update live.
**D. User templates (left and top).** Select system -> edit text -> caption shows "U: ..." -> Save as new -> it appears in the dropdown, selected, tiles update. Edit + Save: in place, same id. `X`: removed, falls back to default. Create 20: the limit message appears.
**E. Whitelist Insert.** Choose a class, Insert: a `class="..."` insert lands in that editor's textarea.
**F. Validation.** Try `<a href=x>`, `<script>`, `${bogus}`: Save is blocked with a warning.
**G. Persistence.** Save the song, reload: User templates present; selection restored from the print screen options. Hand-edit an unsafe entry into the file: dropped on load.

## 7. Console snippets
```js
InstrumentChartBuilder.getTemplateIDs()
InstrumentChartBuilder.setTemplateIDs({ top: 'top-chord' })
PrintLayoutController.getUserTemplates()
getSong().chartWidgetTemplates
document.querySelectorAll('.divWiring').forEach(d => console.log(d.id, getComputedStyle(d).display))
document.querySelector('#tabledest').getBoundingClientRect()
```

## 8. Known gaps
- Browser UI untested by me (editor layout, dropdown/Customize behavior).
- Page box accuracy caveats above; Firefox/Safari untested.
- Tag balance in User templates is intentionally not enforced.
