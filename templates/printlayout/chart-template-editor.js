/* Sprint 154 it5: one editor for the chart widget templates of ONE placement ('left' or 'top'), shown on the Print tab.
 * It follows the Function Symbols editor (templates/function-symbols): a SELECT of the templates, a Customize button that
 * opens a textarea + Caption + system-managed ID + Save + X, with no preview (the Print tiles are the preview) and no
 * reordering.  Add-ons: the whitelist class SELECT + Insert, the same control the SongWidgets page uses.
 *
 * MODEL FIRST: the pure logic is chart-widget-template-sets.js; every change goes through PrintLayoutController, which
 * stores the User lists in the Song and re-applies the Print options, so the tiles change live. */
import { installWhitelistClassControls } from '../../html-sanitizer.js';
import { CHART_WIDGET_DEFAULT_TEMPLATE_IDS } from '../InstrumentChart/instrument-chart-core.js';
import {
	addUserTemplate,
	computeEditorState,
	deleteUserTemplate,
	getAllTemplates,
	getUserTemplates,
	isSystemTemplateID,
	proposeCaption,
	updateUserTemplate
} from '../InstrumentChart/chart-widget-template-sets.js';
import { PrintLayoutController } from './printlayout.controller.js';

function el(tag, attrs = {}, children = []) {
	const node = document.createElement(tag);
	Object.entries(attrs).forEach(([name, value]) => {
		if (name === 'text') {
			node.textContent = value;
		} else if (name === 'class') {
			node.className = value;
		} else {
			node.setAttribute(name, value);
		}
	});
	children.forEach((child) => node.appendChild(child));
	return node;
}

export class ChartTemplateEditor {
	/** @param placement 'left' | 'top'  @param title what the row is called */
	constructor(placement, title) {
		this.placement = placement;
		this.title = title;
		this.optionKey = `${placement}TemplateID`;
		this.idPart = placement === 'left' ? 'Left' : 'Top';
		this.shownID = null;          // the id the SELECT and the draft were last built for
		this.shownSignature = null;   // JSON of this placement's User list when they were built
		this.root = this.build();
	}

	q(suffix) {
		return this.root.querySelector(`#pl${this.idPart}${suffix}`);
	}

	build() {
		const P = this.idPart;
		const id = (suffix) => `pl${P}${suffix}`;
		const textarea = el('textarea', { id: id('TemplateText'), rows: '4', spellcheck: 'false', class: 'plTemplateText' });
		const whitelistHost = el('span', { id: id('WhitelistHost'), class: 'plWhitelistHost' });

		const root = el('div', { class: 'plEditor', 'data-placement': this.placement }, [
			el('div', { class: 'plRow' }, [
				el('label', { for: id('TemplateSelect'), class: 'plEditorTitle', text: this.title }),
				el('select', { id: id('TemplateSelect') }),
				el('button', { id: id('BtnCustomize'), type: 'button', class: 'safeButton' }, [
					el('span', { text: 'Customize ' }),
					el('span', { id: id('CustomizeArrow'), text: '\u25B6' })
				])
			]),
			el('div', { id: id('Crud'), class: 'plCrud', style: 'display:none;' }, [
				el('div', { class: 'plRow' }, [el('span', { text: 'From: ' }), el('span', { id: id('From') })]),
				el('label', { for: id('TemplateText'), class: 'plLabel', text: 'Template:' }),
				textarea,
				whitelistHost,
				el('div', { id: id('WarnTemplate'), class: 'plWarn' }),
				el('div', { class: 'plRow' }, [el('span', { text: 'ID: ' }), el('span', { id: id('IdLabel') })]),
				el('label', { for: id('Caption'), class: 'plLabel', text: 'Caption:' }),
				el('input', { id: id('Caption'), type: 'text', maxlength: '40', autocomplete: 'off' }),
				el('div', { id: id('WarnCaption'), class: 'plWarn' }),
				el('div', { class: 'plRow' }, [
					el('button', { id: id('BtnSave'), type: 'button', class: 'safeButton', text: 'Save', disabled: '' }),
					el('button', { id: id('BtnDelete'), type: 'button', class: 'fsDelete', title: 'Delete this User template', text: 'X', disabled: '' })
				]),
				el('div', { id: id('WarnLimit'), class: 'plWarn' })
			])
		]);
		// Same whitelist as the SongWidgets page; Insert goes into THIS editor's textarea.
		installWhitelistClassControls(whitelistHost, textarea, `selWhitelistClasses${P}Chart`);
		this.bind(root, whitelistHost);
		return root;
	}

	bind(root, whitelistHost) {
		const on = (suffix, event, handler) => root.querySelector(`#pl${this.idPart}${suffix}`).addEventListener(event, handler);
		on('TemplateSelect', 'change', (e) => PrintLayoutController.apply({ chart: { [this.optionKey]: e.target.value } }));
		on('BtnCustomize', 'click', () => this.toggleCustomize());
		on('TemplateText', 'input', () => this.refreshState({ skipId: true }));
		on('Caption', 'input', () => this.refreshState({ skipId: true }));
		on('Caption', 'blur', () => this.refreshState());
		on('BtnSave', 'click', () => this.save());
		on('BtnDelete', 'click', () => this.deleteCurrent());
		// Insert uses setRangeText, which fires no input event: re-check after it has run.
		whitelistHost.addEventListener('click', () => queueMicrotask(() => this.refreshState({ skipId: true })));
	}

	toggleCustomize() {
		const crud = this.q('Crud');
		const opening = crud.style.display === 'none';
		crud.style.display = opening ? '' : 'none';
		this.q('CustomizeArrow').textContent = opening ? '\u25BC' : '\u25B6';
	}

	getSelectedID() {
		return this.q('TemplateSelect').value;
	}

	computeState() {
		return computeEditorState({
			placement: this.placement,
			selectedId: this.getSelectedID(),
			userLists: PrintLayoutController.getUserTemplates(),
			draftTemplate: this.q('TemplateText').value.trim(),
			draftCaption: this.q('Caption').value
		});
	}

	/** Called by the panel on every refresh.  The SELECT and the draft are rebuilt only when the chosen id or this
	 *  placement's User list changed, so a draft being typed survives Section changes and page buttons. */
	sync(opts) {
		const selectedID = opts.chart[this.optionKey];
		const userList = getUserTemplates(this.placement, PrintLayoutController.getUserTemplates());
		const signature = JSON.stringify(userList);
		if (selectedID !== this.shownID || signature !== this.shownSignature) {
			this.rebuildSelect(selectedID);
			this.resetDraft();
			this.shownID = selectedID;
			this.shownSignature = signature;
		} else {
			this.refreshState();
		}
	}

	/** System templates first, then the User's in the order they were added. */
	rebuildSelect(selectedID) {
		const select = this.q('TemplateSelect');
		select.replaceChildren(...getAllTemplates(this.placement, PrintLayoutController.getUserTemplates())
			.map((entry) => el('option', { value: entry.id, text: entry.caption })));
		select.value = selectedID;
	}

	/** Puts the selected template into the draft controls.  A system one can only be copied: "U: <caption>" is proposed. */
	resetDraft() {
		const all = getAllTemplates(this.placement, PrintLayoutController.getUserTemplates());
		const entry = all.find((candidate) => candidate.id === this.getSelectedID()) ?? all[0];
		this.q('From').textContent = entry.caption;
		this.q('TemplateText').value = entry.template;
		this.q('Caption').value = isSystemTemplateID(this.placement, entry.id) ? proposeCaption(entry.caption) : entry.caption;
		this.refreshState();
	}

	/** Repaints the warnings and the enabled buttons.  skipId: leave the ID label alone while the caption is typed. */
	refreshState({ skipId = false } = {}) {
		const state = this.computeState();
		this.q('WarnTemplate').textContent = state.templateMessage;
		this.q('WarnCaption').textContent = state.captionMessage;
		this.q('WarnLimit').textContent = state.limitMessage;
		if (!skipId) {
			this.q('IdLabel').textContent = state.idLabel;
		}
		this.q('BtnSave').disabled = !state.canSave;
		this.q('BtnDelete').disabled = !state.canDelete;
		this.q('BtnSave').textContent = state.mode === 'create' ? 'Save as new' : 'Save';
	}

	save() {
		const state = this.computeState();
		if (!state.canSave) {
			return;
		}
		const list = getUserTemplates(this.placement, PrintLayoutController.getUserTemplates());
		const template = this.q('TemplateText').value.trim();
		let id;
		if (state.mode === 'create') {
			id = state.id;
			PrintLayoutController.setUserTemplates(this.placement, addUserTemplate(list, { id, caption: state.caption, template }));
		} else {
			id = this.getSelectedID();   // the id never changes; the caption may be renamed
			PrintLayoutController.setUserTemplates(this.placement, updateUserTemplate(list, id, { caption: state.caption, template }));
		}
		// Choose it, and re-expand the live tiles; apply() notifies, which calls sync() and rebuilds this editor.
		PrintLayoutController.apply({ chart: { [this.optionKey]: id } });
	}

	deleteCurrent() {
		const state = this.computeState();
		if (!state.canDelete) {
			return;
		}
		const list = getUserTemplates(this.placement, PrintLayoutController.getUserTemplates());
		PrintLayoutController.setUserTemplates(this.placement, deleteUserTemplate(list, this.getSelectedID()));
		PrintLayoutController.apply({ chart: { [this.optionKey]: CHART_WIDGET_DEFAULT_TEMPLATE_IDS[this.placement] } });
	}
}
