import { isAllowedAppActionFragment } from './app-action-fragment.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;

const ALLOWED_TAGS = new Set([
	'a',
	'b',
	'blockquote',
	'br',
	'caption',
	'code',
	'div',
	'em',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'hr',
	'i',
	'kbd',
	'li',
	'cmd-line',
	'ol',
	'p',
	'pre',
	's',
	'small',
	'span',
	'strong',
	'sub',
	'sup',
	'table',
	'tbody',
	'td',
	'th',
	'thead',
	'tr',
	'u',
	'ul'
]);

/* To help maintainability, these classes should be defined in html-whitelist.css */
const WHITELIST_CLASSES = new Set([
	'captionColor2',
	'captionColor3',
	'fontSmaller',
	'fontLarger140',
	'fontLarger160',
	'fontLarger200',
	'fontLarger250',
	'fontLarger300',
	'spacer2',
	'spacer8',
	'centerWidgets',
	'leftJustifyWidgets',
	'rightJustifyWidgets',
	'linkBox',
	'ButtonTable'
]);

const HELP_PAGE_FRAGMENT_PATTERN = /^(?:help|help-plugins)\.html#[A-Za-z][A-Za-z0-9_:-]*(?:-[A-Za-z0-9_:-]+)*$/;
const MACRO_QUERY_VALUE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const TUNING_QUERY_VALUE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const SONG_QUERY_VALUE_PATTERN = /^[A-Za-z0-9_./ -]+\.json$/;
const ALLOWED_INFO_QUERY_KEYS = new Set(['song', 'macro', 'tuning']);

function parseInfoQueryHref(href = '') {
	const normalized = String(href || '').trim();
	let query = '';
	if (normalized.startsWith('?')) {
		query = normalized.slice(1);
	} else {
		const appQueryMatch = normalized.match(/^(?:\.?\/|\/)?(?:index\.html|infinite-neck(?:\.html)?)\?(.+)$/);
		if (!appQueryMatch) {
			return null;
		}
		query = appQueryMatch[1] || '';
	}
	if (!query || query.includes('#')) {
		return null;
	}
	return new URLSearchParams(query);
}

//Also, see infinite-neck.js::ACTION_LINK_CONTAINERS which has allowed link containers like ['#divInfoRendered', '#divTutorialPrompt', '#lblSongWidgets', '.lblSectionCaption'];
		
function isAllowedInfoQueryHref(href = '') {
	const params = parseInfoQueryHref(href);
	if (!params) {
		return false;
	}
	let hasKnownKey = false;
	for (const key of params.keys()) {
		if (!ALLOWED_INFO_QUERY_KEYS.has(key)) {
			return false;
		}
		hasKnownKey = true;
	}
	if (!hasKnownKey) {
		return false;
	}

	const song = `${params.get('song') || ''}`.trim();
	const macro = `${params.get('macro') || ''}`.trim();
	const tuning = `${params.get('tuning') || ''}`.trim();

	if (song && !SONG_QUERY_VALUE_PATTERN.test(song)) {
		return false;
	}
	if (song.includes('..')) {
		return false;
	}
	if (macro && !MACRO_QUERY_VALUE_PATTERN.test(macro)) {
		return false;
	}
	if (tuning && !TUNING_QUERY_VALUE_PATTERN.test(tuning)) {
		return false;
	}
	return true;
}

export function isAllowedInfoAnchorHref(href = '') {
	const normalized = String(href || '').trim();
	return isAllowedAppActionFragment(normalized)
		|| HELP_PAGE_FRAGMENT_PATTERN.test(normalized)
		|| isAllowedInfoQueryHref(normalized);
}

function filterWhitelistClasses(classAttribute) {
	const seen = new Set();
	String(classAttribute || '').split(/\s+/).forEach((className) => {
		if (WHITELIST_CLASSES.has(className)) {
			seen.add(className);
		}
	});
	return [...seen];
}

export function isWhitelistedClass(className) {
	return WHITELIST_CLASSES.has(String(className || ''));
}

function sanitizeNode(node, doc) {
	if (!node) {
		return null;
	}

	if (node.nodeType === TEXT_NODE) {
		return doc.createTextNode(node.textContent || '');
	}

	if (node.nodeType === COMMENT_NODE) {
		return null;
	}

	if (node.nodeType !== ELEMENT_NODE) {
		return null;
	}

	const tagName = (node.tagName || '').toLowerCase();
	if (!ALLOWED_TAGS.has(tagName)) {
		return null;
	}

	const cleanNode = doc.createElement(tagName);
	if (tagName === 'a') {
		const href = node.getAttribute('href') || '';
		if (!isAllowedInfoAnchorHref(href)) {
			return null;
		}
		cleanNode.setAttribute('href', href.trim());
	}
	const keptClasses = filterWhitelistClasses(node.getAttribute('class'));
	if (keptClasses.length > 0) {
		cleanNode.setAttribute('class', keptClasses.join(' '));
	}
	Array.from(node.childNodes).forEach((childNode) => {
		const cleanChild = sanitizeNode(childNode, doc);
		if (cleanChild) {
			cleanNode.appendChild(cleanChild);
		}
	});

	return cleanNode;
}

export function trimTrailingWhitespacePreserveLeading(rawHtml = '') {
	return String(rawHtml ?? '').replace(/[\s\u00a0]+$/u, '');
}

export function sanitizeHtmlFragment(rawHtml = '') {
	const trimmed = trimTrailingWhitespacePreserveLeading(rawHtml);
	if (/^[\s\u00a0]*$/u.test(trimmed)) {
		return '';
	}

	if (typeof document === 'undefined') {
		return trimmed;
	}

	const template = document.createElement('template');
	template.innerHTML = trimmed;

	const container = document.createElement('div');
	Array.from(template.content.childNodes).forEach((childNode) => {
		const cleanChild = sanitizeNode(childNode, document);
		if (cleanChild) {
			container.appendChild(cleanChild);
		}
	});

	return trimTrailingWhitespacePreserveLeading(container.innerHTML);
}

export function getSanitizedInfo(rawHtml = '') {
	const sanitized = sanitizeHtmlFragment(rawHtml);
	if (/^[\s\u00a0]*$/u.test(sanitized)) {
		return '';
	}
	return sanitized;
}

export function getSanitizedSongWidgets(rawHtml = '') {
	return getSanitizedInfo(rawHtml);
}

export function isAllowedSanitizerTag(tagName) {
	return ALLOWED_TAGS.has(String(tagName || '').toLowerCase());
}

/** Returns the HTML (a string) of a SELECT listing every whitelisted class, for the Info and
 *  SongWidgets edit pages.  Pass a distinct id when more than one is in the DOM at once. */
export function buildWhitelistClassesSelect(id = 'selWhitelistClasses') {
	const options = [...WHITELIST_CLASSES]
		.map((className) => `<option value="${className}">${className}</option>`)
		.join('');
	return `<select id="${id}" class="selWhitelistClasses" title="CSS classes you may use in class=&quot;...&quot; attributes here.">${options}</select>`;
}

// True from the moment the User presses on the whitelist SELECT/Insert controls until the Insert
// finishes (or focus leaves them).  Edit textareas persist (and therefore sanitize) on blur/change;
// without this check, reaching for the controls mid-typing -- e.g. at `<span class="|">` -- would
// sanitize the half-typed HTML away before the class could be inserted.
let whitelistControlActive = false;

export function isWhitelistControlActive() {
	return whitelistControlActive;
}

/** Fills `hostElement` with the whitelist SELECT and an Insert button that inserts the selected class
 *  name at the cursor (or over the selection) of `textareaElement`. */
export function installWhitelistClassControls(hostElement, textareaElement, selectId = 'selWhitelistClasses') {
	if (!hostElement || !textareaElement) {
		return;
	}
	hostElement.innerHTML = '<span class="infoSaveCaption">class:</span>'
		+ buildWhitelistClassesSelect(selectId)
		+ '<button type="button" class="btnInsertWhitelistClass" title="Insert the selected class at the cursor.">Insert</button>';
	const selectElement = hostElement.querySelector('select');
	const buttonElement = hostElement.querySelector('button');

	hostElement.addEventListener('mousedown', () => {
		whitelistControlActive = true;
	});
	hostElement.addEventListener('focusout', (event) => {
		if (!hostElement.contains(event.relatedTarget)) {
			whitelistControlActive = false;
		}
	});
	buttonElement.addEventListener('click', () => {
		const className = selectElement.value;
		const start = textareaElement.selectionStart ?? textareaElement.value.length;
		const end = textareaElement.selectionEnd ?? start;
		// A second class after an existing one needs a separating space.
		const previousChar = start > 0 ? textareaElement.value.charAt(start - 1) : '';
		const insertText = /[A-Za-z0-9_-]/.test(previousChar) ? ` ${className}` : className;
		textareaElement.setRangeText(insertText, start, end, 'end');
		whitelistControlActive = false;
		textareaElement.focus();
	});
}