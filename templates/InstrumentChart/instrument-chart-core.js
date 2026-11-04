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

/** @param placement 'top' or 'left'.  @param id reserved for the later template selector; ignored for now. */
export function getChartWidgetTemplate(placement, id) {
	return CHART_WIDGET_TEMPLATES[placement] ?? '';
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
