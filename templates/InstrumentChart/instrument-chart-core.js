/* Sprint 153: pure (no DOM, no jQuery) core of the Instrument chart widgets. */
import { expandApprovedTemplate } from '../../approved-values.js';
import { CHART_WIDGET_TEMPLATES } from './instrument-chart-templates.js';

export const CHART_WIDGET_PLACEMENTS = Object.freeze(['top', 'left']);

/** The ${names} a widget template may use: each is a number, a note name, or HTML-escaped text, so a widget never
 *  injects markup from the Song.  (getSongName and the plugin status tokens are not escaped, so they are not listed.) */
export const SAFE_WIDGET_TOKENS = Object.freeze([
	'chartChord', 'chartMode', 'chartChordCaption', 'chartModeCaption',
	'rootKey', 'rootKeyLead', 'rootKeys',
	'currentSectionNumber', 'currentSectionIndex', 'currentSectionCardinal',
	'beats', 'beatCount', 'getSectionCaption', 'instrumentCaption',
	'sectionCount', 'getBPM',
	'enharmonicTransposedModeNotes', 'transposedModeNotesFunctions',
	'enharmonicTransposedChordNotes', 'transposedChordNotes',
	'transposedChordNotesFunctions', 'transposedChordNotesLeadKeyFunctions',
	'enharmonicChartModeNotes', 'keySignatureCount', 'keySignatureCountHand', 'keySignatureSimplified'
]);

/** The first system template of each placement: what the Print options use until the User chooses another. */
export const CHART_WIDGET_DEFAULT_TEMPLATE_IDS = Object.freeze({
	top: CHART_WIDGET_TEMPLATES.top[0].id,
	left: CHART_WIDGET_TEMPLATES.left[0].id
});

/** Sprint 154 it5.  The { id, caption, template } for `id`: the system list first, then the User's list
 *  (`userLists` is the Song's { top: [], left: [] }).  An unknown id gives the placement's first system entry;
 *  an unknown placement gives null. */
export function getChartWidgetTemplateEntry(placement, id, userLists) {
	const system = CHART_WIDGET_TEMPLATES[placement];
	if (!system) {
		return null;
	}
	const user = Array.isArray(userLists?.[placement]) ? userLists[placement] : [];
	return system.find((entry) => entry.id === id) ?? user.find((entry) => entry.id === id) ?? system[0];
}

/** `id` itself when it names a template, else the placement's default id. */
export function resolveChartWidgetTemplateID(placement, id, userLists) {
	return getChartWidgetTemplateEntry(placement, id, userLists)?.id ?? '';
}

/** @param placement 'top' or 'left'.  @param id a template id (unknown or omitted: the first system template).
 *  @param userLists the Song's User templates, { top: [], left: [] }. */
export function getChartWidgetTemplate(placement, id, userLists) {
	return getChartWidgetTemplateEntry(placement, id, userLists)?.template ?? '';
}

/** Merges `raw` ({top?, left?}, booleans only) over `current`.  Anything that is not a boolean is ignored. */
export function normalizeChartWidgetMode(raw, current = { top: false, left: false }) {
	const next = { top: current.top === true, left: current.left === true };
	if (raw && typeof raw === 'object') {
		for (const placement of CHART_WIDGET_PLACEMENTS) {
			if (typeof raw[placement] === 'boolean') {
				next[placement] = raw[placement];
			}
		}
	}
	return next;
}

/* Sprint 154: spacing of the two widgets.  Every value is in em of the host, so it scales with the Instrument.
 *   leftWidthEm       fixed width of the left host (width = min-width = max-width), the same in every tile
 *   leftPaddingTopEm  space above the left widget's text
 *   topPaddingLeftEm  space left of the top widget's text; 'align' = the left host's width, so the text starts over the
 *                     first fret column */
export const CHART_WIDGET_ALIGN = 'align';
export const CHART_WIDGET_METRIC_DEFAULTS = Object.freeze({ leftWidthEm: 4.8, leftPaddingTopEm: 0.15, topPaddingLeftEm: CHART_WIDGET_ALIGN });
export const CHART_WIDGET_METRIC_RANGES = Object.freeze({ leftWidthEm: [2, 12], leftPaddingTopEm: [0, 10], topPaddingLeftEm: [0, 20] });
export const CHART_WIDGET_METRIC_VARS = Object.freeze({
	leftWidthEm: '--icw-left-width',
	leftPaddingTopEm: '--icw-left-padding-top',
	topPaddingLeftEm: '--icw-top-padding-left'
});
/** What the CSS uses for the top padding when there is nothing to align with (the left widget is off). */
export const CHART_WIDGET_TOP_PADDING_FALLBACK = '0.4em';

function normalizeOneMetric(name, value) {
	if (name === 'topPaddingLeftEm' && value === CHART_WIDGET_ALIGN) {
		return CHART_WIDGET_ALIGN;
	}
	if (typeof value !== 'number' || !Number.isFinite(value) || !CHART_WIDGET_METRIC_RANGES[name]) {
		return undefined;
	}
	const [min, max] = CHART_WIDGET_METRIC_RANGES[name];
	return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

/** Merges the valid entries of `raw` over `current` (defaults when omitted).  Numbers are clamped to their range;
 *  anything that is not a number (or 'align' for topPaddingLeftEm) is ignored. */
export function normalizeChartWidgetMetrics(raw, current = CHART_WIDGET_METRIC_DEFAULTS) {
	const next = { ...CHART_WIDGET_METRIC_DEFAULTS };
	for (const name of Object.keys(CHART_WIDGET_METRIC_DEFAULTS)) {
		for (const source of [current, raw]) {
			const value = source && typeof source === 'object' ? normalizeOneMetric(name, source[name]) : undefined;
			if (value !== undefined) {
				next[name] = value;
			}
		}
	}
	return next;
}

/** { '--icw-left-width': '4.8em', ... } for <body>.  'align' becomes the left width plus --icw-align-nudge (a console
 *  knob, default 0px) when the left widget is on, and the CSS default when it is off. */
export function resolveChartWidgetMetricVars(metrics, { leftOn = true } = {}) {
	const m = normalizeChartWidgetMetrics(metrics);
	const top = m.topPaddingLeftEm === CHART_WIDGET_ALIGN
		? (leftOn ? `calc(${m.leftWidthEm}em + var(--icw-align-nudge, 0px))` : CHART_WIDGET_TOP_PADDING_FALLBACK)
		: `${m.topPaddingLeftEm}em`;
	return {
		[CHART_WIDGET_METRIC_VARS.leftWidthEm]: `${m.leftWidthEm}em`,
		[CHART_WIDGET_METRIC_VARS.leftPaddingTopEm]: `${m.leftPaddingTopEm}em`,
		[CHART_WIDGET_METRIC_VARS.topPaddingLeftEm]: top
	};
}

/** The ${tokens} used by a template, in order of appearance (with repeats removed). */
export function extractTemplateTokens(template) {
	const names = [];
	for (const match of `${template || ''}`.matchAll(/\$\{([^}]+)\}/g)) {
		const name = match[1].trim();
		if (!names.includes(name)) {
			names.push(name);
		}
	}
	return names;
}

/** Expands a template for ONE Instrument: every ${name} follows `section` (the Section that Instrument shows),
 *  not the Song's current Section.  Unknown names and "current Section only" names expand to ''.
 *  A missing Section (an Observer past the last Section) expands to ''. */
export function expandChartWidgetTemplate({ template, section, sectionIndex, tableID, instrumentCaption } = {}) {
	if (!section) {
		return '';
	}
	return expandApprovedTemplate(template, {
		preserveUnknown: false,
		context: { section, sectionIndex, tableID, instrumentCaption }
	});
}
