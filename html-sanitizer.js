const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;

const ALLOWED_TAGS = new Set([
	'div',
	'p',
	'br',
	'span',
	'strong',
	'b',
	'em',
	'i',
	'u',
	's',
	'small',
	'sub',
	'sup',
	'code',
	'pre',
	'blockquote',
	'ul',
	'ol',
	'li',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'hr',
	'a',
	'kbd'
]);

const PLUGIN_RAISE_FRAGMENT_PATTERN = /^#raise=[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z_][A-Za-z0-9_-]*(?:,(?:raise=)?[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z_][A-Za-z0-9_-]*)*$/;

export function isAllowedInfoAnchorHref(href = '') {
	return PLUGIN_RAISE_FRAGMENT_PATTERN.test(String(href || '').trim());
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