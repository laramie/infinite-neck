/* Sprint 153: the two curated Instrument chart widget templates.  Edit THIS file to change them.
 *
 *   top  -- horizontal: replaces the Instrument Caption Row while "show top chart widget" is on.
 *   left -- vertical:   replaces the Left Rail stack while "show left chart widget" is on.
 *
 * Both are print-only (see 153-it3-implementation-plan.md); there is no per-Song override and nothing is persisted.
 * Sibling templates, chosen from the Print panel, are a later sprint: then this flat { top, left } object becomes
 * named choices, and getChartWidgetTemplate(placement, id) in instrument-chart-core.js picks one.
 *
 * Rules (the Jest guard in _tests/jest/instrument-chart-core.test.js enforces them):
 *   - HTML tags: only the sanitizer's allowed tags (here b, small, br); no classes needed.
 *   - ${name} variables: only names in SAFE_WIDGET_TOKENS (instrument-chart-core.js), whose values are numbers,
 *     note names, or HTML-escaped text.  Every ${name} follows the Section THIS Instrument shows.
 *     See /vdv in the app for the list.
 *   - ${chartChordCaption} and ${chartModeCaption} are the Chart chord and mode as shown in the Chart,
 *     i.e. optionally transposed per the Song's Chart options.  ${chartChord} and ${chartMode} are
 *     the text exactly as written in the Section.
 */

export const CHART_WIDGET_TEMPLATES = Object.freeze({
	top:
		'<b>${chartChordCaption}</b></span><span class="spacer2"> </span><span class="fontSmaller">${chartModeCaption}&nbsp;&nbsp;${getSectionCaption}<span class="spacer2"> </span>${rootKeys}&nbsp;&nbsp;'
		+ '&sect;${currentSectionCardinal}&nbsp;<small>${beats} beats</small></span>',
	left:
		'<b>${chartChordCaption}</b><br>${rootKeys}'
});
