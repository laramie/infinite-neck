/* Sprint 154: the "Print" Desktop tab.  Plain DOM; every action goes through PrintLayoutController.
 * Console: PrintLayoutBuilder.refresh()
 */
import EventBus from '../../event-bus.js';
import { PrintLayoutController } from './printlayout.controller.js';
import { PRINT_LIMITS, PRINT_PAPERS, PRINT_THEME_PRINT, PRINT_THEME_SONG, PRINT_SCALE_AUTO } from '../../printlayout.js';
import { CHART_WIDGET_ALIGN } from '../InstrumentChart/instrument-chart-core.js';

const PAPER_LABELS = {
	'letter-portrait': 'Letter, portrait',
	'letter-landscape': 'Letter, landscape',
	'a4-portrait': 'A4, portrait',
	'a4-landscape': 'A4, landscape'
};

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

function labeled(text, control) {
	return el('label', { class: 'plField' }, [el('span', { text }), control]);
}

export class PrintLayoutBuilder {
	static root = null;
	static subscribed = false;

	static addToDest(divDestSelector) {
		const dest = document.querySelector(divDestSelector);
		if (!dest) {
			return;
		}
		dest.replaceChildren(PrintLayoutBuilder.buildPanel());
		PrintLayoutBuilder.root = dest;
		if (!PrintLayoutBuilder.subscribed) {
			EventBus.on('PrintLayout:changed', () => PrintLayoutBuilder.refresh());
			PrintLayoutBuilder.subscribed = true;
		}
		PrintLayoutBuilder.refresh();
	}

	static q(id) {
		return PrintLayoutBuilder.root?.querySelector(`#${id}`);
	}

	static buildPanel() {
		const numberInput = (id, min, max, step = 1) => el('input', { id, type: 'number', min: `${min}`, max: `${max}`, step: `${step}` });
		const checkbox = (id) => el('input', { id, type: 'checkbox' });
		const select = (id) => el('select', { id });

		const panel = el('div', { class: 'printLayoutPanel' }, [
			el('div', { class: 'plRow' }, [
				el('button', { id: 'plBtnToggle', type: 'button', text: 'Enter Print Layout' }),
				el('button', { id: 'plBtnPrint', type: 'button', text: 'Print\u2026' }),
				el('button', { id: 'plBtnFit', type: 'button', text: 'Fit now' }),
				el('span', { id: 'plStatus', class: 'plStatus' })
			]),
			el('div', { class: 'plRow' }, [
				labeled('Main', select('plMain')),
				labeled('Rows', numberInput('plRows', PRINT_LIMITS.minRowsCols, PRINT_LIMITS.maxRowsCols)),
				labeled('Columns', numberInput('plCols', PRINT_LIMITS.minRowsCols, PRINT_LIMITS.maxRowsCols)),
				el('span', { id: 'plTiles', class: 'plStatus' })
			]),
			el('div', { class: 'plRow' }, [
				labeled('Paper', select('plPaper')),
				labeled('Theme', select('plTheme')),
				labeled('Auto fit', checkbox('plScaleAuto')),
				labeled('Scale %', numberInput('plScale', PRINT_LIMITS.minScalePercent, PRINT_LIMITS.maxScalePercent, 5))
			]),
			el('div', { class: 'plRow' }, [
				el('button', { id: 'plBtnFirst', type: 'button', text: '|<', title: 'First page' }),
				el('button', { id: 'plBtnPrev', type: 'button', text: '<', title: 'Previous page' }),
				el('span', { id: 'plPageLabel', class: 'plStatus' }),
				el('button', { id: 'plBtnNext', type: 'button', text: '>', title: 'Next page' }),
				el('button', { id: 'plBtnLast', type: 'button', text: '>|', title: 'Last page' })
			]),
			el('div', { class: 'plRow' }, [
				labeled('Top caption widget', checkbox('plTop')),
				labeled('Left rail widget', checkbox('plLeft')),
				labeled('Left width (em)', numberInput('plLeftWidth', 2, 12, 0.1)),
				labeled('Left padding top (em)', numberInput('plLeftPadTop', 0, 10, 0.05)),
				labeled('Top padding left (em)', numberInput('plTopPadLeft', 0, 20, 0.1)),
				labeled('Align with left rail', checkbox('plTopAlign'))
			]),
			el('div', {
				class: 'plHint',
				text: 'Each page holds Rows x Columns Sections, starting at the current Section. Use the Section buttons or the page buttons to move; Print\u2026 uses the browser dialog (set Margins: Default, Scale: 100%).'
			})
		]);
		PrintLayoutBuilder.bind(panel);
		return panel;
	}

	static bind(panel) {
		const on = (id, event, handler) => panel.querySelector(`#${id}`).addEventListener(event, handler);
		const num = (id) => Number.parseFloat(panel.querySelector(`#${id}`).value);
		const apply = (partial) => {
			PrintLayoutController.apply(partial);
			PrintLayoutBuilder.refresh();
		};

		on('plBtnToggle', 'click', () => {
			const result = PrintLayoutController.isActive() ? PrintLayoutController.leave() : PrintLayoutController.enter();
			PrintLayoutBuilder.refresh(result.ok ? '' : result.message);
		});
		on('plBtnPrint', 'click', () => PrintLayoutController.print());
		on('plBtnFit', 'click', () => {
			PrintLayoutController.applyScale();
			PrintLayoutBuilder.refresh();
		});
		on('plMain', 'change', (e) => apply({ grid: { mainTableID: e.target.value } }));
		on('plRows', 'change', () => apply({ grid: { rows: num('plRows') } }));
		on('plCols', 'change', () => apply({ grid: { cols: num('plCols') } }));
		on('plPaper', 'change', (e) => apply({ grid: { paper: e.target.value } }));
		on('plTheme', 'change', (e) => apply({ grid: { theme: e.target.value } }));
		on('plScaleAuto', 'change', (e) => apply({ grid: { scale: e.target.checked ? PRINT_SCALE_AUTO : (num('plScale') || 100) } }));
		on('plScale', 'change', () => apply({ grid: { scale: num('plScale') } }));
		on('plBtnFirst', 'click', () => PrintLayoutController.goPage('first'));
		on('plBtnPrev', 'click', () => PrintLayoutController.goPage('previous'));
		on('plBtnNext', 'click', () => PrintLayoutController.goPage('next'));
		on('plBtnLast', 'click', () => PrintLayoutController.goPage('last'));
		on('plTop', 'change', (e) => apply({ chart: { top: e.target.checked } }));
		on('plLeft', 'change', (e) => apply({ chart: { left: e.target.checked } }));
		on('plLeftWidth', 'change', () => apply({ chart: { leftWidthEm: num('plLeftWidth') } }));
		on('plLeftPadTop', 'change', () => apply({ chart: { leftPaddingTopEm: num('plLeftPadTop') } }));
		on('plTopPadLeft', 'change', () => apply({ chart: { topPaddingLeftEm: num('plTopPadLeft') } }));
		on('plTopAlign', 'change', (e) => apply({ chart: { topPaddingLeftEm: e.target.checked ? CHART_WIDGET_ALIGN : (num('plTopPadLeft') || 0.4) } }));
	}

	static fillSelect(select, choices, value) {
		select.replaceChildren(...choices.map(({ value: v, label }) => el('option', { value: v, text: label })));
		select.value = value;
	}

	static themeChoices() {
		const builtIns = [...document.querySelectorAll('#selThemes option')]
			.map((option) => ({ value: option.value, label: option.textContent }))
			.filter((choice) => choice.value && choice.value !== PRINT_THEME_PRINT);
		return [
			{ value: PRINT_THEME_PRINT, label: 'Print (black and white)' },
			{ value: PRINT_THEME_SONG, label: "Song's current Theme" },
			...builtIns
		];
	}

	/** Re-reads the options and the Song into the controls. */
	static refresh(message = '') {
		if (!PrintLayoutBuilder.root || !PrintLayoutBuilder.q('plMain')) {
			return;
		}
		const q = PrintLayoutBuilder.q.bind(PrintLayoutBuilder);
		const active = PrintLayoutController.isActive();
		let opts;
		try {
			opts = PrintLayoutController.getOptions();
		} catch {
			return;                                            // no Song yet
		}
		q('plBtnToggle').textContent = active ? 'Leave Print Layout' : 'Enter Print Layout';
		['plBtnPrint', 'plBtnFit', 'plBtnFirst', 'plBtnPrev', 'plBtnNext', 'plBtnLast'].forEach((id) => {
			q(id).disabled = !active;
		});

		const mains = PrintLayoutController.getMainChoices().map(({ tableID, label }) => ({ value: tableID, label }));
		PrintLayoutBuilder.fillSelect(q('plMain'), mains.length > 0 ? mains : [{ value: '', label: '(none available)' }], opts.grid.mainTableID);
		q('plMain').disabled = active && mains.length < 2;
		PrintLayoutBuilder.fillSelect(q('plPaper'), Object.keys(PRINT_PAPERS).map((id) => ({ value: id, label: PAPER_LABELS[id] || id })), opts.grid.paper);
		PrintLayoutBuilder.fillSelect(q('plTheme'), PrintLayoutBuilder.themeChoices(), opts.grid.theme);

		q('plRows').value = `${opts.grid.rows}`;
		q('plCols').value = `${opts.grid.cols}`;
		q('plTiles').textContent = `${opts.grid.rows * opts.grid.cols} per page (max ${PRINT_LIMITS.maxTiles})`;
		const auto = typeof opts.grid.scale !== 'number';
		q('plScaleAuto').checked = auto;
		q('plScale').disabled = auto;
		q('plScale').value = auto ? `${Math.round(PrintLayoutController.lastFitScale * 100)}` : `${opts.grid.scale}`;

		q('plTop').checked = opts.chart.top;
		q('plLeft').checked = opts.chart.left;
		q('plLeftWidth').value = `${opts.chart.leftWidthEm}`;
		q('plLeftPadTop').value = `${opts.chart.leftPaddingTopEm}`;
		const align = opts.chart.topPaddingLeftEm === CHART_WIDGET_ALIGN;
		q('plTopAlign').checked = align;
		q('plTopPadLeft').disabled = align;
		q('plTopPadLeft').value = align ? '' : `${opts.chart.topPaddingLeftEm}`;

		let pageLabel = '';
		if (active) {
			const info = PrintLayoutController.getPageInfo();
			pageLabel = `Sections ${info.first}-${info.last} of ${info.count}, page ${info.page} of ${info.pages}${info.sliding ? ' (between pages)' : ''}`;
		}
		q('plPageLabel').textContent = pageLabel;
		q('plStatus').textContent = message || (active ? 'Print Layout is on.' : 'Print Layout is off.');
	}
}

if (typeof window !== 'undefined') {
	window.PrintLayoutBuilder = PrintLayoutBuilder;
}
