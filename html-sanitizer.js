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

export function isAllowedSanitizerTag(tagName) {
	return ALLOWED_TAGS.has(String(tagName || '').toLowerCase());
}