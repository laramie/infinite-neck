/* Sprint 154: pure (no DOM, no jQuery) core of the print Layout.
 *
 * "Print" is a Layout screen (layout.js) in which the Main Instrument is shown with transient Observers ("tiles") laid
 * out as a CSS grid, one Section per tile.  A tile k (1 .. rows*cols-1) is an ordinary Observer of the Main wired
 * `+k`, with ids made by tileBaseID().  Tiles exist only while print is active, and SongPersistence.js never saves
 * them (isPrintTileID).  See _doco/design/sprints/154-print-layout/154-it3-implementation-plan.md and
 * 154-it4-implementation-report.md. */
import * as Constants from './Constants.js';
import {
	CHART_WIDGET_DEFAULT_TEMPLATE_IDS,
	CHART_WIDGET_METRIC_DEFAULTS,
	normalizeChartWidgetMetrics
} from './templates/InstrumentChart/instrument-chart-core.js';

export const PRINT_TILE_MARKER = '__pt';
export const PRINT_LIMITS = Object.freeze({ minRowsCols: 1, maxRowsCols: 8, maxTiles: 48, minScalePercent: 25, maxScalePercent: 400 });
export const PRINT_THEME_PRINT = 'Print';
/** The theme choice that leaves the Song's Theme alone. */
export const PRINT_THEME_SONG = '__song__';
export const PRINT_SCALE_AUTO = 'auto';
export const PRINT_MARGIN_IN = 0.4;
export const PRINT_GAP_PX = 8;
export const PRINT_PAPERS = Object.freeze({
	'letter-portrait':  Object.freeze({ label: 'Letter, portrait',  widthIn: 8.5,  heightIn: 11 }),
	'letter-landscape': Object.freeze({ label: 'Letter, landscape', widthIn: 11,   heightIn: 8.5 }),
	'a4-portrait':      Object.freeze({ label: 'A4, portrait',      widthIn: 8.27, heightIn: 11.69 }),
	'a4-landscape':     Object.freeze({ label: 'A4, landscape',     widthIn: 11.69, heightIn: 8.27 })
});
export const PRINT_DEFAULT_PAPER = 'letter-portrait';

export const PRINT_GRID_DEFAULTS = Object.freeze({
	rows: 2,
	cols: 3,
	mainTableID: '',
	theme: PRINT_THEME_PRINT,
	scale: PRINT_SCALE_AUTO,
	paper: PRINT_DEFAULT_PAPER,
	pageBox: true            // Sprint 154 it5: a dashed box around page 1's printable area (screen only)
});

export const PRINT_CHART_DEFAULTS = Object.freeze({
	top: true,
	left: true,
	...CHART_WIDGET_METRIC_DEFAULTS,
	topTemplateID: CHART_WIDGET_DEFAULT_TEMPLATE_IDS.top,     // Sprint 154 it5: which template of each list
	leftTemplateID: CHART_WIDGET_DEFAULT_TEMPLATE_IDS.left
});

/** The flags of the `print` Layout screen (the same names the other screens use). */
export const PRINT_SCREEN_FLAG_DEFAULTS = Object.freeze({
	name: 'print',
	CaptionRow: true,
	Caption: false,
	SongTitle: true,
	SongWidgets: true,
	PracticeList: false,
	WidgetRow: false,
	InstrumentCaptions: false,
	LeftRails: false,
	CaptionLooperLayout: 'column'
});

// ---------------------------------------------------------------- ids

/** `tblP46_1__pt3`, `P46_1__pt3`, ... */
export function isPrintTileID(id) {
	return typeof id === 'string' && new RegExp(`${PRINT_TILE_MARKER}\\d+$`).test(id);
}

export function tileBaseID(mainBaseID, slot) {
	return `${mainBaseID}${PRINT_TILE_MARKER}${slot}`;
}

export function mainBaseIDOf(mainTableID) {
	const id = `${mainTableID || ''}`;
	return id.startsWith(Constants.TABLE_ID_PREFIX) ? id.substring(Constants.TABLE_ID_PREFIX.length) : id;
}

// ---------------------------------------------------------------- options

function clampInt(value, min, max, fallback) {
	const n = Number.parseInt(value, 10);
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Normalizes `raw` ({grid?, chart?}) over `current`.  `validMainTableIDs` (ids from listMainCandidates) decides which
 *  Main is acceptable: an unknown id falls back to the first one ('' when there is none).
 *  rows, cols: 1-8 each, and rows*cols <= 48 (rows is reduced).  scale: 'auto' or 25-400 (percent). */
export function normalizePrintOptions(raw, validMainTableIDs = [], current = null) {
	const src = (name) => ({ ...(current?.[name] || {}), ...(raw?.[name] || {}) });
	const g = src('grid');
	const c = src('chart');

	const cols = clampInt(g.cols, PRINT_LIMITS.minRowsCols, PRINT_LIMITS.maxRowsCols, PRINT_GRID_DEFAULTS.cols);
	let rows = clampInt(g.rows, PRINT_LIMITS.minRowsCols, PRINT_LIMITS.maxRowsCols, PRINT_GRID_DEFAULTS.rows);
	rows = Math.max(1, Math.min(rows, Math.floor(PRINT_LIMITS.maxTiles / cols)));

	let mainTableID = `${g.mainTableID || ''}`;
	if (!validMainTableIDs.includes(mainTableID)) {
		mainTableID = validMainTableIDs[0] || '';
	}

	let scale = PRINT_SCALE_AUTO;
	if (typeof g.scale === 'number' && Number.isFinite(g.scale)) {
		scale = Math.min(PRINT_LIMITS.maxScalePercent, Math.max(PRINT_LIMITS.minScalePercent, Math.round(g.scale)));
	}

	const theme = typeof g.theme === 'string' && g.theme.length > 0 ? g.theme : PRINT_GRID_DEFAULTS.theme;
	const paper = PRINT_PAPERS[g.paper] ? g.paper : PRINT_DEFAULT_PAPER;

	const metrics = normalizeChartWidgetMetrics(c);
	const templateID = (value, fallback) => (typeof value === 'string' && value !== '' ? value : fallback);
	return {
		grid: {
			rows, cols, mainTableID, theme, scale, paper,
			pageBox: typeof g.pageBox === 'boolean' ? g.pageBox : PRINT_GRID_DEFAULTS.pageBox
		},
		chart: {
			top: typeof c.top === 'boolean' ? c.top : PRINT_CHART_DEFAULTS.top,
			left: typeof c.left === 'boolean' ? c.left : PRINT_CHART_DEFAULTS.left,
			...metrics,
			topTemplateID: templateID(c.topTemplateID, PRINT_CHART_DEFAULTS.topTemplateID),
			leftTemplateID: templateID(c.leftTemplateID, PRINT_CHART_DEFAULTS.leftTemplateID)
		}
	};
}

/** The tableIDs that can be the Main: visible, not a Tool, not an Observer / Listener (no wiring), not a tile. */
export function listMainCandidates({ myTunings = [], wirings = [], visibleTableIDs = [] } = {}) {
	const wired = new Set((wirings || []).map((w) => w?.tablename).filter(Boolean));
	const tunings = new Map((myTunings || []).filter(Boolean).map((t) => [Constants.TABLE_ID_PREFIX + t.baseID, t]));
	return visibleTableIDs.filter((tableID) => {
		const tuning = tunings.get(tableID);
		return !!tuning && tuning.Tool !== true && !wired.has(tableID) && !isPrintTileID(tableID);
	});
}

// ---------------------------------------------------------------- tiles

export function tileCount(opts) {
	return Math.max(0, opts.grid.rows * opts.grid.cols - 1);
}

/** The transient entries to add for the tiles: [{ slot, baseID, tableID, relativeSection: '+k', listenToTablename, tuning }].
 *  `tuning` is a deep copy of the Main's, as an instance with the tile's baseID. */
export function planTiles(opts, mainTuning) {
	if (!mainTuning || !mainTuning.baseID) {
		return [];
	}
	const listenToTablename = Constants.TABLE_ID_PREFIX + mainTuning.baseID;
	const tiles = [];
	for (let slot = 1; slot <= tileCount(opts); slot++) {
		const baseID = tileBaseID(mainTuning.baseID, slot);
		tiles.push({
			slot,
			baseID,
			tableID: Constants.TABLE_ID_PREFIX + baseID,
			relativeSection: `+${slot}`,
			listenToTablename,
			tuning: { ...structuredClone(mainTuning), baseID, instance: true }
		});
	}
	return tiles;
}

/** The Section index slot `slot` shows when the Main shows `cur`; null past the last Section (a blank tile). */
export function sectionIndexForSlot(cur, slot, count) {
	const idx = cur + slot;
	return idx >= 0 && idx < count ? idx : null;
}

/** Slots (0 = the Main) whose Section does not exist. */
export function hiddenSlots(cur, count, opts) {
	const hidden = [];
	for (let slot = 0; slot <= tileCount(opts); slot++) {
		if (sectionIndexForSlot(cur, slot, count) === null) {
			hidden.push(slot);
		}
	}
	return hidden;
}

// ---------------------------------------------------------------- pages (pages are aligned to multiples of n = rows*cols)

export function perPage(opts) {
	return opts.grid.rows * opts.grid.cols;
}

export function pageInfo(cur, count, opts) {
	const n = perPage(opts);
	return {
		first: cur + 1,
		last: Math.min(cur + n, count),
		count,
		perPage: n,
		page: Math.floor(cur / n) + 1,
		pages: Math.max(1, Math.ceil(count / n)),
		sliding: cur % n !== 0
	};
}

export function nextPageIndex(cur, count, opts) {
	const target = (Math.floor(cur / perPage(opts)) + 1) * perPage(opts);
	return target < count ? target : null;
}

export function previousPageIndex(cur, count, opts) {
	if (cur <= 0) {
		return null;
	}
	const n = perPage(opts);
	return cur % n === 0 ? Math.max(0, cur - n) : Math.floor(cur / n) * n;
}

export function firstPageIndex() {
	return 0;
}

export function lastPageIndex(count, opts) {
	return count <= 0 ? 0 : Math.floor((count - 1) / perPage(opts)) * perPage(opts);
}

// ---------------------------------------------------------------- page size and scale

export function pageWidthPx(paperID, marginIn = PRINT_MARGIN_IN) {
	const paper = PRINT_PAPERS[paperID] || PRINT_PAPERS[PRINT_DEFAULT_PAPER];
	return Math.floor((paper.widthIn - 2 * marginIn) * 96);
}

/** Printable height of one page, CSS px (paper height minus the margins), for the on-screen page box. */
export function pageHeightPx(paperID, marginIn = PRINT_MARGIN_IN) {
	const paper = PRINT_PAPERS[paperID] || PRINT_PAPERS[PRINT_DEFAULT_PAPER];
	return Math.floor((paper.heightIn - 2 * marginIn) * 96);
}

/** The text drawn in the corner of the page box: "Letter, portrait: 7.7 x 10.2 in printable (739 x 979 px)". */
export function pageBoxLabel(paperID, marginIn = PRINT_MARGIN_IN) {
	const paper = PRINT_PAPERS[paperID] || PRINT_PAPERS[PRINT_DEFAULT_PAPER];
	const inches = (value) => Math.round((value - 2 * marginIn) * 10) / 10;
	return `${paper.label}: ${inches(paper.widthIn)} x ${inches(paper.heightIn)} in printable (${pageWidthPx(paperID, marginIn)} x ${pageHeightPx(paperID, marginIn)} px), page 1`;
}

export function pageSizeCss(paperID, marginIn = PRINT_MARGIN_IN) {
	const paper = PRINT_PAPERS[paperID] || PRINT_PAPERS[PRINT_DEFAULT_PAPER];
	const orientation = paper.widthIn > paper.heightIn ? 'landscape' : 'portrait';
	const sheet = paperID.startsWith('a4') ? 'A4' : 'letter';
	return `@page { size: ${sheet} ${orientation}; margin: ${marginIn}in; }`;
}

export function trackWidthPx({ pageWidthPx: pagePx, cols, gapPx = PRINT_GAP_PX }) {
	return (pagePx - gapPx * (cols - 1)) / cols;
}

/** The zoom that makes a tile of natural width `naturalWidthPx` fit a grid track of `trackPx` (a little slack). */
export function fitScale({ trackPx, naturalWidthPx, slack = 0.97, min = 0.25, max = 1.5 }) {
	if (!(trackPx > 0) || !(naturalWidthPx > 0)) {
		return 1;
	}
	const raw = (trackPx / naturalWidthPx) * slack;
	return Math.floor(Math.min(max, Math.max(min, raw)) * 100) / 100;
}

/** The scale to use: the percent the User typed, or the fit. */
export function effectiveScale(scale, fit) {
	return typeof scale === 'number' ? scale / 100 : fit;
}
