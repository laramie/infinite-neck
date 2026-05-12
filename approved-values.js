let approvedValueProviders = {};

export const APPROVED_VALUES_HELP_BLOCK_START = '<!-- BEGIN GENERATED APPROVED VALUES -->';
export const APPROVED_VALUES_HELP_BLOCK_END = '<!-- END GENERATED APPROVED VALUES -->';
export const APPROVED_VALUE_SAMPLE_CAVEAT = 'Sample values are live snapshots from the current song and current section, so they change as you edit, navigate, or load another song.';

export function setApprovedValueProviders(nextProviders = {}) {
	approvedValueProviders = { ...approvedValueProviders, ...nextProviders };
}

function requireProvider(name) {
	const fn = approvedValueProviders[name];
	if (typeof fn !== 'function') {
		throw new Error('approved-values missing provider: ' + name);
	}
	return fn;
}

function getBPM(...args) { return requireProvider('getBPM')(...args); }
function getCurrentSection(...args) { return requireProvider('getCurrentSection')(...args); }
function getSectionsCurrentIndex(...args) { return requireProvider('getSectionsCurrentIndex')(...args); }
function getSong(...args) { return requireProvider('getSong')(...args); }

function escapeHtml(text) {
	return `${text}`
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function opacityPercent(rawValue) {
	const opacity = parseFloat(rawValue);
	if (isNaN(opacity)) {
		return 'NaN';
	}
	return '' + (opacity * 100);
}

function formatSampleValue(value) {
	if (value === '') {
		return '<em>(empty string)</em>';
	}
	if (value === undefined || value === null) {
		return '<em>n/a</em>';
	}
	if (typeof value === 'object') {
		return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
	}
	return `<code>${escapeHtml(value)}</code>`;
}

function renderPatternHtml(name) {
	const escapedName = escapeHtml(name);
	return `<code>$${escapedName}</code><br><code>\${${escapedName}}</code>`;
}

const approvedValueEntries = [
	{
		name: 'currentSectionNumber',
		description: 'Current section index, zero-based',
		resolve: () => getSectionsCurrentIndex()
	},
	{
		name: 'currentSectionIndex',
		description: 'Current section index, zero-based',
		resolve: () => getSectionsCurrentIndex()
	},
	{
		name: 'currentSectionCardinal',
		description: 'Current section number, one-based',
		resolve: () => getSectionsCurrentIndex() + 1
	},
	{
		name: 'sectionCount',
		description: 'Total number of sections',
		resolve: () => getSong().sections.length
	},
	{
		name: 'graveyardRecordCount',
		description: 'Record count in the graveyard',
		resolve: () => getSong().graveyard.getRecordCount()
	},
	{
		name: 'beats',
		description: 'Beat count in the current section',
		resolve: () => getCurrentSection().beats
	},
	{
		name: 'beatCount',
		description: 'Alias of beats',
		resolve: () => getCurrentSection().beats
	},
	{
		name: 'currentBeat',
		description: 'Current beat in the current section',
		resolve: () => getCurrentSection().currentBeat
	},
	{
		name: 'getBPM',
		description: 'Current BPM',
		resolve: () => getBPM()
	},
	{
		name: 'getNamedNoteOpacity',
		description: 'Named-note opacity as percent string',
		resolve: () => opacityPercent(getSong().namedNoteOpacity)
	},
	{
		name: 'getSingleNoteOpacity',
		description: 'Single-note opacity as percent string',
		resolve: () => opacityPercent(getSong().singleNoteOpacity)
	},
	{
		name: 'getTinyNoteOpacity',
		description: 'Tiny-note opacity as percent string',
		resolve: () => opacityPercent(getSong().tinyNoteOpacity)
	},
	{
		name: 'getSongName',
		description: 'Current song name',
		resolve: () => getSong().songName
	},
	{
		name: 'getSectionCaption',
		description: 'Current section caption',
		resolve: () => getCurrentSection().caption
	}
];

const approvedValueEntryByName = new Map(approvedValueEntries.map(entry => [entry.name, entry]));

export function listApprovedValues(options = {}) {
	const includeSamples = options.includeSamples === true;
	return approvedValueEntries.map(entry => {
		let sampleValue;
		let sampleError;
		if (includeSamples) {
			try {
				sampleValue = entry.resolve();
			} catch (error) {
				sampleError = error;
			}
		}
		return {
			name: entry.name,
			description: entry.description,
			menuPattern: '$' + entry.name,
			templatePattern: '${' + entry.name + '}',
			sampleValue,
			sampleError
		};
	});
}

export function renderApprovedValuesReferenceHtml(options = {}) {
	const includeSamples = options.includeSamples === true;
	const title = options.title || 'Approved Variable Names';
	const rows = listApprovedValues({ includeSamples });
	const sampleHeader = includeSamples ? '<th style="border: 1px solid black; padding: 0.4em; text-align: left;">Current sample</th>' : '';
	const sampleCells = row => {
		if (!includeSamples) {
			return '';
		}
		if (row.sampleError) {
			return '<td style="border: 1px solid black; padding: 0.4em;"><em>n/a</em></td>';
		}
		return `<td style="border: 1px solid black; padding: 0.4em;">${formatSampleValue(row.sampleValue)}</td>`;
	};
	const tableRows = rows.map(row => {
		return [
			'<tr>',
			`<td style="border: 1px solid black; padding: 0.4em;"><code>${escapeHtml(row.name)}</code></td>`,
			`<td style="border: 1px solid black; padding: 0.4em; white-space: nowrap;">${renderPatternHtml(row.name)}</td>`,
			`<td style="border: 1px solid black; padding: 0.4em;">${escapeHtml(row.description)}</td>`,
			sampleCells(row),
			'</tr>'
		].join('');
	}).join('\n');
	const sampleNote = includeSamples
		? `<p><i>${escapeHtml(APPROVED_VALUE_SAMPLE_CAVEAT)}</i></p>`
		: '<p><i>Run <code>/vdv</code> in the app to see live sample values for the current song and section.</i></p>';
	return [
		`<h4>${escapeHtml(title)}</h4>`,
		'<p>Use <code>$name</code> in command-menu captions and input defaults. Use <code>${name}</code> in section-caption templates. Run <code>/vdv</code> to open this reference in Messages.</p>',
		sampleNote,
		'<table style="border-collapse: collapse; margin-left: 4em;">',
		'<thead><tr><th style="border: 1px solid black; padding: 0.4em; text-align: left;">Name</th><th style="border: 1px solid black; padding: 0.4em; text-align: left;">Patterns</th><th style="border: 1px solid black; padding: 0.4em; text-align: left;">Meaning</th>' + sampleHeader + '</tr></thead>',
		`<tbody>${tableRows}</tbody>`,
		'</table>'
	].join('\n');
}

export function resolveApprovedValue(what, options = {}) {
	const logUnknown = options.logUnknown === true;
	const entry = approvedValueEntryByName.get(what);
	if (!entry) {
		if (logUnknown) {
			console.log('approved-values::resolveApprovedValue::unknown:' + what);
		}
		return undefined;
	}
	return entry.resolve();
}

export function expandApprovedTemplate(templateText, options = {}) {
	const preserveUnknown = options.preserveUnknown !== false;
	const text = templateText == null ? '' : '' + templateText;
	return text.replace(/\$\{([^}]+)\}/g, (match, rawKey) => {
		const key = `${rawKey}`.trim();
		if (!/^[A-Za-z0-9:_-]+$/.test(key)) {
			return preserveUnknown ? match : '';
		}
		const resolved = resolveApprovedValue(key, { logUnknown: false });
		if (resolved === undefined || resolved === null) {
			return preserveUnknown ? match : '';
		}
		return '' + resolved;
	});
}
