/* Sprint 154: PrintLayoutController -- enters and leaves the print Layout, builds the transient tiles, and applies the
 * panel's options.  No jQuery; every outside dependency is a provider injected by infinite-neck.js, so it can be tested
 * with fakes.  See printlayout.js (the pure part) and 154-it4-implementation-report.md.
 *
 * Console:
 *     PrintLayoutController.enter();   PrintLayoutController.leave();   PrintLayoutController.getOptions();
 *     PrintLayoutController.apply({ grid: { rows: 2, cols: 4 }, chart: { left: false } });
 */
import EventBus from '../../event-bus.js';
import { Wiring } from '../../Wiring.js';
import { InstrumentChartBuilder } from '../InstrumentChart/instrument-chart.builder.js';
import * as PL from '../../printlayout.js';
import { resolveChartWidgetTemplateID } from '../InstrumentChart/instrument-chart-core.js';
import { emptyUserTemplates } from '../InstrumentChart/chart-widget-template-sets.js';

const PAGE_STYLE_ID = 'printLayoutPageStyle';
const BODY_VARS = ['--print-page-width', '--print-page-height', '--print-cols', '--print-scale'];

let providers = {
	getSong: () => undefined,
	/** () => void: rebuild every table (EventBus 'ReinstallAllTuningsTables') */
	reinstallTables: () => {},
	getThemeId: () => '',
	setThemeId: () => {},
	isFullscreen: () => false,
	leaveFullscreen: () => {},
	dockAll: () => {},
	gotoSection: () => {},
	printPage: () => {}
};

export class PrintLayoutController {
	static active = false;
	static restore = null;          // { theme } recorded at enter()
	static lastFitScale = 1;
	static sectionChangedHandler = null;
	static beforePrintHandler = null;

	static setProviders(next = {}) {
		providers = { ...providers, ...next };
	}

	static isActive() {
		return PrintLayoutController.active === true;
	}

	// ------------------------------------------------------------ options

	static getMainCandidates() {
		const song = providers.getSong();
		if (!song) {
			return [];
		}
		return PL.listMainCandidates({
			myTunings: song.myTunings,
			wirings: song.wirings,
			visibleTableIDs: song.getVisibleTunings()
		});
	}

	/** [{tableID, label}] for the Main select. */
	static getMainChoices() {
		const song = providers.getSong();
		return PrintLayoutController.getMainCandidates().map((tableID) => {
			const tuning = song.myTunings.find((t) => `tbl${t.baseID}` === tableID);
			const caption = tuning?.caption ? `${tuning.caption} ` : '';
			return { tableID, label: `${caption}(${PL.mainBaseIDOf(tableID)})` };
		});
	}

	/** The normalized panel options ({grid, chart}), read from layout.screenList.print.  A chosen template id that no longer
	 *  exists (a deleted User template) reads as the placement's first system template. */
	static getOptions() {
		const song = providers.getSong();
		const printScreen = song?.getLayout()?.screenList?.print;
		const opts = PL.normalizePrintOptions(printScreen, PrintLayoutController.getMainCandidates());
		const userLists = PrintLayoutController.getUserTemplates();
		opts.chart.topTemplateID = resolveChartWidgetTemplateID('top', opts.chart.topTemplateID, userLists);
		opts.chart.leftTemplateID = resolveChartWidgetTemplateID('left', opts.chart.leftTemplateID, userLists);
		return opts;
	}

	/** The Song's User chart widget templates, { top: [], left: [] }. */
	static getUserTemplates() {
		return providers.getSong()?.chartWidgetTemplates ?? emptyUserTemplates();
	}

	/** Replaces one placement's User list in the Song (the editors call this; the Print options pick the id). */
	static setUserTemplates(placement, list) {
		const song = providers.getSong();
		song.chartWidgetTemplates = { ...emptyUserTemplates(), ...song.chartWidgetTemplates, [placement]: list };
	}

	/** Merges `partial` ({grid?, chart?}) into the options and persists them in layout.screenList.print. */
	static setOptions(partial = {}) {
		const song = providers.getSong();
		const printScreen = song.getLayout().screenList.print;
		const next = PL.normalizePrintOptions(partial, PrintLayoutController.getMainCandidates(), PrintLayoutController.getOptions());
		printScreen.grid = next.grid;
		printScreen.chart = next.chart;
		return PrintLayoutController.getOptions();   // the same, with a deleted template's id resolved to the default
	}

	/** The Theme to write into the Song file while print has changed the live Theme (null: nothing to override). */
	static getThemeToSave() {
		return PrintLayoutController.active && PrintLayoutController.restore ? PrintLayoutController.restore.theme : null;
	}

	// ------------------------------------------------------------ lifecycle

	/** @returns {{ok: boolean, message: string}} */
	static enter() {
		if (PrintLayoutController.active) {
			return { ok: true, message: 'Print Layout is already on.' };
		}
		const song = providers.getSong();
		if (!song) {
			return { ok: false, message: 'No Song.' };
		}
		if (PrintLayoutController.getMainCandidates().length === 0) {
			return { ok: false, message: 'No Instrument can be the Main: it must be visible, not a Tool, and not an Observer or Listener.' };
		}
		const opts = PrintLayoutController.setOptions({});
		PrintLayoutController.restore = { theme: providers.getThemeId() };
		providers.dockAll();                                   // docked only: floating is not supported in print
		InstrumentChartBuilder.setMode({ top: false, left: false });   // widgets off while the Layout flags are applied (layout.js)
		PrintLayoutController.active = true;
		document.body.classList.add('printScreen');
		song.getLayout().enterPrint();
		PrintLayoutController.buildTiles(opts);
		PrintLayoutController.applyAll(opts);
		PrintLayoutController.subscribe();
		PrintLayoutController.notify();
		return { ok: true, message: 'Print Layout on.' };
	}

	/** Leaves print: widgets off first, then the tiles go, then the Layout returns to its own screen. */
	static leave() {
		if (!PrintLayoutController.active) {
			return { ok: true, message: 'Print Layout is already off.' };
		}
		const song = providers.getSong();
		PrintLayoutController.unsubscribe();
		InstrumentChartBuilder.setMode({ top: false, left: false });
		InstrumentChartBuilder.resetMetrics();
		PrintLayoutController.removeTilesFromModel(song);
		PrintLayoutController.active = false;                  // themeInEffect applies again when the tables are rebuilt
		providers.reinstallTables();
		const restoreTheme = PrintLayoutController.restore?.theme;
		PrintLayoutController.restore = null;
		if (restoreTheme && providers.getThemeId() !== restoreTheme) {
			providers.setThemeId(restoreTheme);
		}
		PrintLayoutController.clearDom();
		if (providers.isFullscreen()) {
			providers.leaveFullscreen();
		}
		song.getLayout().leavePrint();
		PrintLayoutController.notify();
		return { ok: true, message: 'Print Layout off.' };
	}

	/** A Song was just loaded: the old Song (and its tiles) is gone, so only the runtime state is cleared. */
	static reset() {
		PrintLayoutController.unsubscribe();
		PrintLayoutController.active = false;
		PrintLayoutController.restore = null;
		InstrumentChartBuilder.setMode({ top: false, left: false });
		InstrumentChartBuilder.resetMetrics();
		InstrumentChartBuilder.resetTemplateIDs();
		PrintLayoutController.clearDom();
		PrintLayoutController.notify();
	}

	/** Applies `partial` ({grid?, chart?}).  Rows, columns, and Main rebuild the tiles; everything else is CSS only. */
	static apply(partial = {}) {
		if (!PrintLayoutController.active) {
			PrintLayoutController.setOptions(partial);
			PrintLayoutController.notify();
			return PrintLayoutController.getOptions();
		}
		const previous = PrintLayoutController.getOptions();
		const next = PrintLayoutController.setOptions(partial);
		const retile = next.grid.rows !== previous.grid.rows
			|| next.grid.cols !== previous.grid.cols
			|| next.grid.mainTableID !== previous.grid.mainTableID;
		if (retile) {
			PrintLayoutController.buildTiles(next);
		}
		PrintLayoutController.applyAll(next);
		PrintLayoutController.notify();
		return next;
	}

	// ------------------------------------------------------------ tiles (Option T: transient entries in the model)

	static removeTilesFromModel(song) {
		song.myTunings = (song.myTunings || []).filter((tuning) => !PL.isPrintTileID(tuning?.baseID));
		song.wirings = (song.wirings || []).filter((wiring) => !PL.isPrintTileID(wiring?.tablename));
		song.setNoteTablesLayout(song.getNoteTablesLayout().filter((entry) => !PL.isPrintTileID(entry?.tableID)));
	}

	/** Replaces the tiles in the model, then rebuilds the tables (which tears down and rebuilds their widgets). */
	static buildTiles(opts) {
		const song = providers.getSong();
		PrintLayoutController.removeTilesFromModel(song);
		const mainTuning = song.myTunings.find((tuning) => `tbl${tuning.baseID}` === opts.grid.mainTableID);
		const tiles = PL.planTiles(opts, mainTuning);
		const layout = song.getNoteTablesLayout();
		tiles.forEach((tile) => {
			song.myTunings.push(tile.tuning);
			layout.push({ tableID: tile.tableID, visible: true });
			// pushed directly: Song.addWiring() fires Wiring:added, which replays a table that is not built yet
			song.wirings.push(new Wiring({
				tablename: tile.tableID,
				relativeSection: tile.relativeSection,
				listenToTablename: tile.listenToTablename
			}));
		});
		providers.reinstallTables();
	}

	// ------------------------------------------------------------ DOM / CSS

	static applyAll(opts) {
		const body = document.body;
		const pagePx = PL.pageWidthPx(opts.grid.paper);
		body.style.setProperty('--print-page-width', `${pagePx}px`);
		body.style.setProperty('--print-cols', `${opts.grid.cols}`);
		PrintLayoutController.applyPageStyle(opts.grid.paper);
		PrintLayoutController.applyPageBox(opts.grid);

		const wantedTheme = opts.grid.theme === PL.PRINT_THEME_SONG ? PrintLayoutController.restore?.theme : opts.grid.theme;
		if (wantedTheme && providers.getThemeId() !== wantedTheme) {
			providers.setThemeId(wantedTheme);
		}

		InstrumentChartBuilder.setMetrics({
			leftWidthEm: opts.chart.leftWidthEm,
			leftPaddingTopEm: opts.chart.leftPaddingTopEm,
			topPaddingLeftEm: opts.chart.topPaddingLeftEm
		});
		InstrumentChartBuilder.setTemplateIDs({ top: opts.chart.topTemplateID, left: opts.chart.leftTemplateID });
		InstrumentChartBuilder.setMode({ top: opts.chart.top, left: opts.chart.left });

		PrintLayoutController.markTiles(opts);
		PrintLayoutController.applyScale(opts);
	}

	static applyPageStyle(paperID) {
		let style = document.getElementById(PAGE_STYLE_ID);
		if (!style) {
			style = document.createElement('style');
			style.id = PAGE_STYLE_ID;
			document.head.appendChild(style);
		}
		style.textContent = PL.pageSizeCss(paperID);
	}

	static clearDom() {
		document.body.classList.remove('printScreen', 'printPageBoxOn');
		BODY_VARS.forEach((name) => document.body.style.removeProperty(name));
		document.getElementById('tabledest')?.removeAttribute('data-page-box');
		document.getElementById(PAGE_STYLE_ID)?.remove();
	}

	/** The dashed box around page 1's printable area (print.css).  The width is exact (it is the grid's own width);
	 *  the height is the paper height minus the margins, in CSS px, which is what the browser prints at 100% scale. */
	static applyPageBox(grid) {
		const body = document.body;
		body.classList.toggle('printPageBoxOn', grid.pageBox === true);
		body.style.setProperty('--print-page-height', `${PL.pageHeightPx(grid.paper)}px`);
		document.getElementById('tabledest')?.setAttribute('data-page-box', PL.pageBoxLabel(grid.paper));
	}

	static getTileOuters() {
		return [...document.querySelectorAll('#tabledest > .instrumentBackgroundOuter')];
	}

	/** Which slot (0 = Main, k = tile k) a table outer is, or null for every other table. */
	static slotOfOuter(outer, mainBaseID) {
		const inner = outer.querySelector(':scope > .instrumentBackground');
		const id = inner?.id || '';
		const baseID = id.startsWith('div') ? id.substring(3) : id;
		if (baseID === mainBaseID) {
			return 0;
		}
		const prefix = `${mainBaseID}${PL.PRINT_TILE_MARKER}`;
		if (PL.isPrintTileID(baseID) && baseID.startsWith(prefix)) {
			return Number.parseInt(baseID.substring(prefix.length), 10);
		}
		return null;
	}

	/** Excludes tables that are not in the plan, orders the tiles, and blanks tiles past the last Section. */
	static markTiles(opts = PrintLayoutController.getOptions()) {
		const song = providers.getSong();
		const mainBaseID = PL.mainBaseIDOf(opts.grid.mainTableID);
		const cur = song.getSectionsCurrentIndex();
		const count = song.getSections().length;
		PrintLayoutController.getTileOuters().forEach((outer) => {
			const slot = PrintLayoutController.slotOfOuter(outer, mainBaseID);
			outer.classList.toggle('printExcluded', slot === null);
			if (slot === null) {
				outer.classList.remove('printBlank');
				outer.style.order = '';
				return;
			}
			outer.style.order = `${slot}`;
			outer.classList.toggle('printBlank', PL.sectionIndexForSlot(cur, slot, count) === null);
		});
	}

	/** Sets --print-scale: the typed percent, or the fit of the widest tile (natural width) to the grid track. */
	static applyScale(opts = PrintLayoutController.getOptions()) {
		const body = document.body;
		let fit = PrintLayoutController.lastFitScale;
		if (typeof opts.grid.scale !== 'number') {
			body.style.setProperty('--print-scale', '1');          // natural size, to measure
			const widths = PrintLayoutController.getTileOuters()
				.filter((outer) => !outer.classList.contains('printExcluded'))
				.map((outer) => outer.getBoundingClientRect().width);
			fit = PL.fitScale({
				trackPx: PL.trackWidthPx({ pageWidthPx: PL.pageWidthPx(opts.grid.paper), cols: opts.grid.cols }),
				naturalWidthPx: Math.max(0, ...widths)
			});
			PrintLayoutController.lastFitScale = fit;
		}
		const scale = PL.effectiveScale(opts.grid.scale, fit);
		body.style.setProperty('--print-scale', `${scale}`);
		return scale;
	}

	// ------------------------------------------------------------ pages

	static getPageInfo() {
		const song = providers.getSong();
		return PL.pageInfo(song.getSectionsCurrentIndex(), song.getSections().length, PrintLayoutController.getOptions());
	}

	static goPage(which) {
		const song = providers.getSong();
		const opts = PrintLayoutController.getOptions();
		const cur = song.getSectionsCurrentIndex();
		const count = song.getSections().length;
		const target = {
			next: () => PL.nextPageIndex(cur, count, opts),
			previous: () => PL.previousPageIndex(cur, count, opts),
			first: () => PL.firstPageIndex(),
			last: () => PL.lastPageIndex(count, opts)
		}[which]?.();
		if (target !== null && target !== undefined && target !== cur) {
			providers.gotoSection(target);
		}
		return target;
	}

	static print() {
		PrintLayoutController.applyScale();                    // DisplayOptions may have changed the natural width
		providers.printPage();
	}

	// ------------------------------------------------------------ events

	static subscribe() {
		PrintLayoutController.unsubscribe();
		PrintLayoutController.sectionChangedHandler = () => {
			PrintLayoutController.markTiles();
			PrintLayoutController.notify();
		};
		EventBus.on('SectionChanged', PrintLayoutController.sectionChangedHandler);
		if (typeof window !== 'undefined' && window.addEventListener) {
			PrintLayoutController.beforePrintHandler = () => PrintLayoutController.applyScale();
			window.addEventListener('beforeprint', PrintLayoutController.beforePrintHandler);
		}
	}

	static unsubscribe() {
		if (PrintLayoutController.sectionChangedHandler) {
			EventBus.off('SectionChanged', PrintLayoutController.sectionChangedHandler);
			PrintLayoutController.sectionChangedHandler = null;
		}
		if (PrintLayoutController.beforePrintHandler && typeof window !== 'undefined') {
			window.removeEventListener('beforeprint', PrintLayoutController.beforePrintHandler);
			PrintLayoutController.beforePrintHandler = null;
		}
	}

	/** The panel listens to this. */
	static notify() {
		EventBus.trigger('PrintLayout:changed', { active: PrintLayoutController.active });
	}
}

if (typeof window !== 'undefined') {
	window.PrintLayoutController = PrintLayoutController;
}
