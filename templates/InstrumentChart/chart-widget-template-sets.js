/* Sprint 154 it5: pure (no DOM, no Song) logic for the Instrument chart widget TEMPLATE lists.
 *
 * A template is { id, caption, template }.  There is one ordered list per placement ('top', 'left'):
 *   - system templates: CHART_WIDGET_TEMPLATES (instrument-chart-templates.js), edited in source;
 *   - User templates: `song.chartWidgetTemplates = { top: [...], left: [...] }`, saved in the Song file, appended after
 *     the system ones in the order they were added.  Their ids are "u-" + the caption squeezed to kebab-case (the same
 *     rule as the Function Symbols sets), made once when the template is created and kept when it is renamed.
 *   - The Print options store only the chosen id per placement (`chart.topTemplateID`, `chart.leftTemplateID`).
 *
 * Selecting a system template and pressing Save makes a User copy ("create"); selecting a User template and pressing
 * Save edits it in place ("update").  Only User templates can be deleted.
 *
 * Templates are put into innerHTML, so checkChartWidgetTemplate() is strict and is applied on Save AND on load:
 * only sanitizer-allowed tags (never <a>), no attribute but class="..." with whitelisted classes, and only the
 * ${names} in SAFE_WIDGET_TOKENS.  It uses no DOM (the DOM sanitizer is a pass-through in Node). */
import { isAllowedSanitizerTag, isWhitelistedClass } from '../../html-sanitizer.js';
import {
	USER_ID_PREFIX,
	normalizeCaption,
	userIdFromCaption,
	validateCaption
} from '../function-symbols/functionSymbolSets.js';
import { CHART_WIDGET_TEMPLATES } from './instrument-chart-templates.js';
import { CHART_WIDGET_PLACEMENTS, SAFE_WIDGET_TOKENS, extractTemplateTokens } from './instrument-chart-core.js';

export { USER_ID_PREFIX };
export const MAX_USER_TEMPLATES = 20;
export const MAX_TEMPLATE_LENGTH = 2000;
export const USER_CAPTION_PREFIX = 'U: ';

const CLASS_ATTRIBUTE = /^class\s*=\s*(?:"([^"<>]*)"|'([^"<>']*)')$/;

export function emptyUserTemplates() {
	return { top: [], left: [] };
}

export function isEmptyUserTemplates(userLists) {
	return CHART_WIDGET_PLACEMENTS.every((placement) => !(userLists?.[placement]?.length > 0));
}

//=========================== lists =============================================

export function getSystemTemplates(placement) {
	return CHART_WIDGET_TEMPLATES[placement] ?? [];
}

export function getUserTemplates(placement, userLists) {
	return Array.isArray(userLists?.[placement]) ? userLists[placement] : [];
}

/** System templates first (source order), then the User's (the order they were added). */
export function getAllTemplates(placement, userLists) {
	return [...getSystemTemplates(placement), ...getUserTemplates(placement, userLists)];
}

export function isSystemTemplateID(placement, id) {
	return getSystemTemplates(placement).some((entry) => entry.id === id);
}

//=========================== validation ========================================

/** '' when `text` is acceptable, otherwise a short message. */
export function checkChartWidgetTemplate(text) {
	if (typeof text !== 'string' || text.trim() === '') {
		return 'The template is empty.';
	}
	if (text.length > MAX_TEMPLATE_LENGTH) {
		return `The template is ${text.length} characters; the limit is ${MAX_TEMPLATE_LENGTH}.`;
	}
	if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
		return 'Control characters are not allowed.';
	}
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (ch === '>') {
			return 'Stray ">" (write &gt; for the character).';
		}
		if (ch !== '<') {
			continue;
		}
		const match = /^<(\/?)([A-Za-z][A-Za-z0-9]*)([^<>]*)>/.exec(text.slice(i));
		if (!match) {
			return 'Stray "<" (write &lt; for the character).';
		}
		const name = match[2].toLowerCase();
		if (name === 'a' || !isAllowedSanitizerTag(name)) {
			return `Tag <${name}> is not allowed.`;
		}
		const rest = match[3].replace(/\/\s*$/, '').trim();
		if (rest !== '') {
			if (match[1]) {
				return `Closing tag </${name}> cannot have attributes.`;
			}
			const attribute = CLASS_ATTRIBUTE.exec(rest);
			if (!attribute) {
				return `Only class="..." is allowed inside <${name}>.`;
			}
			const unknown = (attribute[1] ?? attribute[2]).split(/\s+/).filter(Boolean).find((className) => !isWhitelistedClass(className));
			if (unknown) {
				return `Class "${unknown}" is not whitelisted (use the class list).`;
			}
		}
		i += match[0].length - 1;
	}
	const unsafe = extractTemplateTokens(text).find((name) => !SAFE_WIDGET_TOKENS.includes(name));
	if (unsafe) {
		return `\${${unsafe}} cannot be used in a widget.`;
	}
	return '';
}

//=========================== list operations ===================================
// All return new arrays; callers assign the result to song.chartWidgetTemplates[placement].

export function addUserTemplate(list, entry) {
	return [...list, { id: entry.id, caption: entry.caption, template: entry.template }];
}

export function updateUserTemplate(list, id, changes) {
	return list.map((entry) => (entry.id === id
		? { id: entry.id, caption: changes.caption ?? entry.caption, template: changes.template ?? entry.template }
		: entry));
}

export function deleteUserTemplate(list, id) {
	return list.filter((entry) => entry.id !== id);
}

/** Cleans what came from a Song file, per placement: drops invalid entries, ids that are not "u-...", duplicate ids
 *  and captions, and anything past the cap.  Always returns { top: [], left: [] }. */
export function normalizeUserTemplates(raw) {
	const result = emptyUserTemplates();
	for (const placement of CHART_WIDGET_PLACEMENTS) {
		const incoming = Array.isArray(raw?.[placement]) ? raw[placement] : [];
		const accepted = [];
		const known = [...getSystemTemplates(placement)];
		for (const entry of incoming) {
			if (accepted.length >= MAX_USER_TEMPLATES) {
				break;
			}
			if (!entry || typeof entry !== 'object') {
				continue;
			}
			const id = `${entry.id ?? ''}`;
			if (!/^u-[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || known.some((other) => other.id === id)) {
				continue;
			}
			const caption = validateCaption(entry.caption, known, { exceptId: id, forCreate: false });
			if (!caption.ok || checkChartWidgetTemplate(entry.template) !== '') {
				continue;
			}
			const clean = { id, caption: caption.caption, template: entry.template };
			accepted.push(clean);
			known.push(clean);
		}
		result[placement] = accepted;
	}
	return result;
}

/** For the Song file: only the placements that have User templates; undefined when there are none. */
export function persistUserTemplates(userLists) {
	const out = {};
	for (const placement of CHART_WIDGET_PLACEMENTS) {
		const list = getUserTemplates(placement, userLists);
		if (list.length > 0) {
			out[placement] = list;
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

//=========================== caption proposals =================================

export function stripUserCaptionPrefix(caption) {
	return normalizeCaption(caption).replace(/^U:\s*/i, '');
}

/** A built-in is cloned: propose "U: <caption>" (the prefix is not nested when cloning a User one). */
export function proposeCaption(selectedCaption) {
	return `${USER_CAPTION_PREFIX}${stripUserCaptionPrefix(selectedCaption)}`;
}

//=========================== editor state ======================================

/**
 * Everything one editor needs to paint, from plain data.
 * @param {{placement:string, selectedId:string, userLists:object, draftTemplate:string, draftCaption:string}} input
 * @returns {{mode:'create'|'update', canSave:boolean, canDelete:boolean, templateMessage:string, captionMessage:string,
 *            idLabel:string, caption:string, id:string, isSystem:boolean, limitMessage:string}}
 */
export function computeEditorState({ placement, selectedId, userLists, draftTemplate, draftCaption }) {
	const all = getAllTemplates(placement, userLists);
	const selected = all.find((entry) => entry.id === selectedId) ?? all[0];
	const isSystem = isSystemTemplateID(placement, selected?.id);
	const mode = isSystem ? 'create' : 'update';
	const templateMessage = checkChartWidgetTemplate(draftTemplate);
	const captionCheck = validateCaption(draftCaption, all, { exceptId: isSystem ? null : selected.id, forCreate: isSystem });
	const full = getUserTemplates(placement, userLists).length >= MAX_USER_TEMPLATES;
	const limitMessage = isSystem && full ? `This Song already has ${MAX_USER_TEMPLATES} User templates here; delete one first.` : '';
	const changed = isSystem
		|| draftTemplate !== selected.template
		|| normalizeCaption(draftCaption) !== selected.caption;
	return {
		mode,
		canSave: templateMessage === '' && captionCheck.ok && !limitMessage && changed,
		canDelete: !isSystem,
		templateMessage,
		captionMessage: captionCheck.message,
		idLabel: isSystem ? (captionCheck.id || userIdFromCaption(draftCaption)) : selected.id,
		caption: captionCheck.caption,
		id: captionCheck.id,
		isSystem,
		limitMessage
	};
}
