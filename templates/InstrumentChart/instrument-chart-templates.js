/* Sprint 153/154: the curated (system) Instrument chart widget templates.  Edit THIS file to change them.
 *
 *   top  -- horizontal: replaces the Instrument Caption Row while "show top chart widget" is on.
 *   left -- vertical:   replaces the Left Rail stack while "show left chart widget" is on.
 *
 * Each placement is an ORDERED LIST of { id, caption, template }; the Print panel (templates/printlayout) picks one per
 * placement.  The User can add more to the end of each list (saved in the Song as `chartWidgetTemplates`, see
 * chart-widget-template-sets.js); to promote one, copy it from the Song JSON into the list below.
 *
 *   id       a stable, unique, lowercase kebab-case name within its list.  The Print options store it, so do not
 *            rename one you have shipped.  It must not start with "u-" (that prefix is for the User's).
 *   caption  what the SELECT shows.  Free text, 1-40 characters; the code gives it no meaning.
 *   template the markup.
 *
 * Rules (the Jest guard in _tests/jest/instrument-chart-core.test.js enforces them):
 *   - HTML tags: only the sanitizer's allowed tags; no attributes except class="..." with whitelisted classes.
 *   - ${name} variables: only names in SAFE_WIDGET_TOKENS (instrument-chart-core.js), whose values are numbers,
 *     note names, or HTML-escaped text.  Every ${name} follows the Section THIS Instrument shows.
 *     See /vdv in the app for the list.
 *   - ${chartChordCaption} and ${chartModeCaption} are the Chart chord and mode as shown in the Chart,
 *     i.e. optionally transposed per the Song's Chart options.  ${chartChord} and ${chartMode} are
 *     the text exactly as written in the Section.
 */

export const CHART_WIDGET_TEMPLATES = Object.freeze({
	top: Object.freeze([
		Object.freeze({
			id: 'top-chord-mode-caption-key-section-beats',
			caption: 'Chord,Mode,Caption,k,s,b',
			template:
				'<b>${chartChordCaption}</b></span><span class="spacer2"> </span><span class="fontSmaller">${chartModeCaption}&nbsp;&nbsp;${getSectionCaption}<span class="spacer2"> </span>${rootKeys}&nbsp;&nbsp;'
				+ '&sect;${currentSectionCardinal}&nbsp;<small>${beats} beats</small></span>'
		}),
		Object.freeze({
			id: 'top-chord',
			caption: 'Chord',
			template: '<b>${chartChordCaption}</b>'
		})
	]),
	left: Object.freeze([
		Object.freeze({
			id: 'left-chord-key',
			caption: 'Chord,k',
			template: '<b>${chartChordCaption}</b><br>${rootKeys}'
		}),
		Object.freeze({
			id: 'left-chord',
			caption: 'Chord',
			template: '<b>${chartChordCaption}</b>'
		})
	])
});
