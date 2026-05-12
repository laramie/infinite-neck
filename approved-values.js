let approvedValueProviders = {};

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

export function resolveApprovedValue(what, options = {}) {
	const logUnknown = options.logUnknown === true;
	switch (what) {
		case 'currentSectionNumber':
		case 'currentSectionIndex':
			return getSectionsCurrentIndex();
		case 'currentSectionCardinal':
			return getSectionsCurrentIndex() + 1;
		case 'sectionCount':
			return getSong().sections.length;
		case 'graveyardRecordCount':
			return getSong().graveyard.getRecordCount();
		case 'beats':
		case 'beatCount':
			return getCurrentSection().beats;
		case 'currentBeat':
			return getCurrentSection().currentBeat;
		case 'getBPM':
			return getBPM();
		case 'getNamedNoteOpacity': {
			var namedOpacity = parseFloat(getSong().namedNoteOpacity);
			if (isNaN(namedOpacity)) {
				return 'NaN';
			}
			return '' + (namedOpacity * 100);
		}
		case 'getSingleNoteOpacity': {
			var singleOpacity = parseFloat(getSong().singleNoteOpacity);
			if (isNaN(singleOpacity)) {
				return 'NaN';
			}
			return '' + (singleOpacity * 100);
		}
		case 'getTinyNoteOpacity': {
			var tinyOpacity = parseFloat(getSong().tinyNoteOpacity);
			if (isNaN(tinyOpacity)) {
				return 'NaN';
			}
			return '' + (tinyOpacity * 100);
		}
		case 'getSongName':
			return getSong().songName;
		case 'getSectionCaption':
			return getCurrentSection().caption;
		default:
			if (logUnknown) {
				console.log('approved-values::resolveApprovedValue::unknown:' + what);
			}
			return undefined;
	}
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
