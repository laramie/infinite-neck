# sprint-154 Iteration 4: implementation report

Implements [154-it3-implementation-plan.md](154-it3-implementation-plan.md) with the answers in [154-design.md](154-design.md) (Iteration 4) and the findings in [154-spike-results.md](154-spike-results.md).

Status: coded, Jest green (90 suites, 1318 tests; was 89 / 1283), `node bin/validate-command-menu.js` 0 errors (5 pre-existing warnings), `bin/help.html-updater.js` run. **Not yet seen in a browser** — everything below marked UA needs your eyes.

## 1. What was built

| Area | Where |
|---|---|
| Pure logic: option normalization (max 48 tiles), Main candidates, tile plan, paging, page width, fit scale | [printlayout.js](../../../../printlayout.js) (new) |
| Controller: enter / leave / apply / tiles / theme / scale / paging / print | [templates/printlayout/printlayout.controller.js](../../../../templates/printlayout/printlayout.controller.js) (new) |
| "Print" Desktop tab panel | [templates/printlayout/printlayout.builder.js](../../../../templates/printlayout/printlayout.builder.js), [printlayout.css](../../../../templates/printlayout/printlayout.css) (new) |
| Grid, tile, `@media print` CSS | [print.css](../../../../print.css) (new) |
| Print Layout screen, `toJSON`, `isInlineShown` fix | [layout.js](../../../../layout.js) |
| Tiles never written to a Song file | [SongPersistence.js](../../../../SongPersistence.js) **(CORE)** |
| `Print` theme (white, black shadows, black nut) | [themes.js](../../../../themes.js) |
| Chart-widget metrics API (`setMetrics`, `getMetrics`, `resetMetrics`) | [instrument-chart-core.js](../../../../templates/InstrumentChart/instrument-chart-core.js), [instrument-chart.builder.js](../../../../templates/InstrumentChart/instrument-chart.builder.js), [instrument-chart.css](../../../../templates/InstrumentChart/instrument-chart.css) |
| Wiring, Print tab, `isChartHostAllowed()`, table-driven `showDesktopTab`, theme guards | [infinite-neck.js](../../../../infinite-neck.js) **(CORE)**, [index.html](../../../../index.html) |

Behavior in one paragraph: **Print** tab → *Enter Print Layout*. The Main Instrument plus `rows*cols-1` transient Observer tiles (`<mainBaseID>__pt<k>`, wiring `+k` to the Main) are added to the model, tables are rebuilt, and a CSS grid shows Sections *cur .. cur+n-1*. Tiles past the last Section are blank. Panel controls: Main, Rows, Columns (1–8, ≤ 48 tiles), Paper, Theme, Auto-fit / Scale %, page buttons, Top/Left chart widgets, left width, left padding top, top padding left / "Align with left rail", Fit now, Print…. *Leave* removes the tiles, rebuilds, and restores the Theme and the Layout screen. Opening a Song always leaves print (nothing about "print active" is saved). There are no command-line changes (Q6).

## 2. Answers to the Iteration 4 decisions

Q1 fixed left width ✔ (`--icw-left-width`, width/min/max). Q9 **48 tiles max** ✔ (rows and cols each 1–8; if `rows*cols > 48`, rows is reduced: 8 cols → 6 rows). Q12 default 4.8em ✔. Q13 top padding `'align'` ✔ (= left width + `--icw-align-nudge`, default 0px; falls back to 0.4em when the left widget is off). Q14 both checkboxes default on ✔. Q15 layout computed-display bug fixed ✔ (`Layout.isInlineShown`). Q16 `showDesktopTab` is now a table (`DESKTOP_TABS`: which, button, panel, onLeave, onEnter) ✔. Q6 no command-line ✔.

## 3. Changes from the it3 plan (adjustments after the spike)

1. **Tiles have natural width and are zoomed, not stretched.** Spike 2 (tiles cropped: Nut + 4 frets) came from `instrument.css` sizing by viewport (`100vw`, `max-width:100vw`) while the print dialog lays out at a different width than the window. In `body.printScreen`, `#tabledest` is now a fixed-width grid (`--print-page-width` = paper width − 2×0.4in, in CSS px) and each tile is `width:max-content; zoom:var(--print-scale)`, with the fret wrapper not scrolling. Screen == paper, whatever the window size.
2. **New option `grid.paper`** (Letter/A4 × portrait/landscape; it3 had no paper option) — needed to know the page width; also writes an `@page { size; margin:0.4in }` style element.
3. **Auto fit** = measure the widest non-excluded tile at zoom 1, compare with the grid track, set `--print-scale` (floor to 2 decimals, 3% slack, 0.25–1.5). Re-run on option changes, **on `beforeprint`**, and by "Fit now". Typed Scale % overrides it. (Spike 3: `scale` alone cropped more — it now only means zoom.)
4. **Transport and menus hidden in `@media print`** (`.container, #transport, #divQuick, #CmdMenu, #divMessageAndJsonTree, #divESCAPE`). Spike 1's "half the Transport on page 2" was `#transport` sitting outside `.container`.
5. **Print theme gets black shadows** (`0 0 2pt 1pt black`) because spike 1 showed cell shadows not printing at 3x2. Root cause of that is still open (see §6, item 3).
6. **`contain: inline-size` on `.instrumentChartTop`** so a long Section caption wraps inside the table's width and never widens a tile (otherwise it would shrink every tile under auto-fit).
7. **Tiles are pushed straight into `song.myTunings` / `song.wirings` / `song.noteTablesLayout`** (a `Wiring` object), not via `song.addWiring()`: `Wiring:added` replays a table that does not exist yet. Rebuild goes through `EventBus.trigger('ReinstallAllTuningsTables')`, which also invalidates `NoteTableCache`.
8. **Every table that is not Main/tile gets `.printExcluded`** (an empty grid item would still take a cell).
9. **Tiles skip stored per-table Themes**: new `tableThemeInEffect()` returns null while print is active, so the chosen print Theme covers every tile.
10. **Theme safety**: `updateMemoryModelPreFileSave` and the per-Section `sectionTheme` use `PrintLayoutController.getThemeToSave()` (the Theme before print), and `displayOptionsToControls` ignores `allowThemeAutomation` Themes while printing. A Song saved while in print never stores `Print`.
11. **`Layout.toJSON()`** drops `printActive`, never saves `print` as the current screen, and omits `screenList.print` while it still equals the defaults (most Song files do not change).
12. **`isChartHostAllowed()`** replaces eight `isFullscreenActive() || isStrictTutorial()` sites and also allows print, so Chart / Chart Line hosts work in print.

## 4. CORE files touched

[infinite-neck.js](../../../../infinite-neck.js): imports (`dockAllDockables`, controller, builder); `PrintLayoutController.setProviders`; `isPrintLayoutActive`, `isChartHostAllowed` (8 sites); `tableThemeInEffect` (2 sites); `getThemeToSave` (2 sites); `allowThemeAutomation` guard; `PrintLayoutController.reset()` at the top of `updateAfterOpenSong`; `DESKTOP_TABS` + `showDesktopTab`; `#btnDesktopTabPrintLayout` binder; panel mounted in the startup promise list.
[SongPersistence.js](../../../../SongPersistence.js): replacer filters `__pt` entries (`myTunings`, `wirings`, `noteTablesLayout`, `sectionNotesByTable`).

## 5. Tests

New [_tests/jest/printlayout.test.js](../../../../_tests/jest/printlayout.test.js) (ids, normalization incl. 48 cap, Main candidates, tile plan, blank slots, paging, page size/fit, Print theme, tiles not persisted, controller model side with fake providers). Extended `instrument-chart-core.test.js` (metrics, CSS-variable guard against `instrument-chart.css`), `instrument-chart-builder.test.js` (metrics with a fake `document.body`), `layout.test.js` (print screen, back-fill, `toJSON`, `isInlineShown`). No JSDom/jQuery. Full run: 90 suites, 1318 tests passed.

## 6. UA test recipes

Use Chrome first (spikes were Chrome only). Use a Song with a multi-Section chart (e.g. `songs/demo`). *Print preview* = Print… button, then "Save as PDF" or just the preview.

**A. Enter / leave**
1. Desktop menu → **Print** tab. Panel shows "Print Layout is off". Click **Enter Print Layout**. Expect: tool windows docked, only the Main + tiles visible, white Print theme, captions/left rails hidden, top and left chart widgets on.
2. Click **Leave Print Layout**. Expect: your previous Theme, Layout, and all Instruments back; no widgets; File → Save the Song and diff it: no `__pt`, no `print`, Theme unchanged.
3. Enter, then open another Song from the library. Expect: print is off, normal screen, no stale `printScreen` look.

**B. Grid and paging**
4. Rows 2 × Cols 3. Expect 6 tiles; Section N, N+1, … in reading order (left→right, top→bottom). Go to the last Sections: trailing tiles blank, not hidden-shifted.
5. Cols 8 / Rows 8. Expect Rows to drop to 6 ("48 per page"). Go back to 3 × 2.
6. `>` `>|` `<` `|<`: jump by a whole page (n Sections). Use the Section drawer to land mid-page: label says "(between pages)"; `>` returns to a multiple of n.
7. Change Main (if the Song has two non-Observer Instruments). Expect the other Instrument's tiles; the first Main disappears.

**C. Fit and paper (the spike regressions)**
8. Paper = Letter portrait, 3 × 2, Auto fit on. Tiles must fit the grid width with no cropping at any browser window size (resize the window narrow and wide; Fit now). Print… preview: no Transport page, no half-page 2, Nut and all frets visible.
9. Repeat with Letter landscape and A4 portrait/landscape. The `@page` size in the print dialog must match the paper choice.
10. Uncheck Auto fit, type 60 and 120 %. Tiles zoom accordingly; at 120 % tiles may overflow the page — expected.
11. In print preview: Background graphics off and on; Grayscale. Colors/shadows should survive (`print-color-adjust: exact`); with the Print theme, cell outlines must print (spike 1 failure).

**D. Chart widgets**
12. Uncheck Top, then Left, then both: each tile loses that widget and the table does not jump (left width is fixed). Check both again.
13. Left width 4.8 / padding top 0.15 should look like the Sprint 153 acceptance. Change left width to 6: the top caption's left edge follows (Align on). Uncheck Align, set 2: top caption stops following.
14. Put a very long caption on a Section: the top widget wraps; the tile width does not grow.

**E. Interaction and safety**
15. While in print, change the Theme dropdown in the panel (Song's current Theme vs Print): tiles change, leave restores.
16. Turn *Allow Theme Automation* on, give a Section a different Theme, enter and leave print: no `Print` in that Section; saved Song has the original Theme.
17. Enter print, `/vwd` or float a window if the command still exists: floated windows must not appear in print.
18. Enter print with a Song whose only Instruments are Tools / Observers: expect the message "No Instrument can be the Main…".
19. Hit Save while in print, reload: Song opens normal, tiles absent, Theme normal.

## 7. Console investigations (please run, and paste results back)

```js
// 1. What did the layout compute? Page width, columns, scale, tile widths.
const b = document.body.style;
[b.getPropertyValue('--print-page-width'), b.getPropertyValue('--print-cols'), b.getPropertyValue('--print-scale')];
[...document.querySelectorAll('#tabledest > .instrumentBackgroundOuter:not(.printExcluded)')]
  .map(o => [o.querySelector('.instrumentBackground')?.id, Math.round(o.getBoundingClientRect().width), o.style.order]);
document.getElementById('tabledest').getBoundingClientRect().width;

// 2. Options and metrics in effect; change them live.
PrintLayoutController.getOptions();
InstrumentChartBuilder.getMetrics();
PrintLayoutController.apply({ grid: { rows: 2, cols: 4, scale: 70 } });
PrintLayoutController.apply({ grid: { scale: 'auto' } });
PrintLayoutController.lastFitScale;

// 3. Alignment of top caption vs left rail (nudge in px, if the two do not line up):
const left = document.querySelector('.instrumentChartLeft')?.getBoundingClientRect();
const top  = document.querySelector('.instrumentChartTop')?.getBoundingClientRect();
[left?.right, top?.left];
document.body.style.setProperty('--icw-align-nudge', '6px');   // then try -6px; tell me the value that looks right

// 4. Thin shadow-line dropout at small zoom (spike 1): does it track zoom?
PrintLayoutController.apply({ grid: { scale: 40 } });   // then 60, 80, 100: where do the cell outlines vanish in print preview?

// 5. Rebuild cost with 48 tiles.
console.time('rebuild'); PrintLayoutController.apply({ grid: { rows: 6, cols: 8 } }); console.timeEnd('rebuild');
document.querySelectorAll('#tabledest .instrumentBackgroundOuter').length;
InstrumentChartBuilder.registry.size;     // widgets registered (1-2 per table)

// 6. __pt ids leaking into model-reading lists (should be false for each):
JSON.stringify(getSong()).includes('__pt');                          // true while in print (model), false after Leave
[...document.querySelectorAll('select')].some(s => s.innerHTML.includes('__pt'));   // Wiring/Observer selects, Tunings lists
document.body.innerText.includes('__pt');

// 7. After Leave: nothing left behind.
PrintLayoutController.leave();
document.body.classList.contains('printScreen');                     // false
document.body.style.cssText;                                         // no --print-* / --icw-* left
document.getElementById('printLayoutPageStyle');                     // null
getSong().myTunings.filter(t => t.baseID.includes('__pt')).length;   // 0
```

Also report: (a) first fill of tile widgets — does each tile show its own Section number straight away, or only after the first Section change? (b) time to Enter with 6 × 8; (c) Firefox and Safari print preview (untested; `zoom` and `contain: inline-size` need a recent engine; Firefox gained `zoom` in 126); (d) whether the Wiring page / tuning lists show tile entries during print.

## 8. Known gaps and risks

- Browser UI untested in this iteration (Jest has no DOM by project policy).
- `zoom` + `getBoundingClientRect` behavior for the auto-fit measure is relied on at zoom 1 only; `beforeprint` re-fit is the safety net.
- Tile ids (`__pt<k>`) can appear in lists that read the model while print is on (checks in §7.6). They are removed on Leave and never saved.
- Floating windows are docked on Enter and not restored on Leave (use the existing refloat command).
- The 48-tile rebuild time is unmeasured (spike inconclusive); §7.5 measures it.
- Print theme and `Print` ID are reserved: a User theme named `Print` would collide.
