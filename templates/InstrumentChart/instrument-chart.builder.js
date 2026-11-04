/* Sprint 153: Instrument chart widgets (print only; see 153-it3-implementation-plan.md).
 *
 * Every non-Tool Instrument gets two hidden host elements (TableBuilder.js): `.instrumentChartTop` (before .captionRow)
 * and `.leftRailChartHost` (after .leftRailStack).  A widget fills a host with the curated template for its placement,
 * expanded for the Section THAT Instrument shows.  Which hosts are visible is CSS only, keyed by two <body> classes,
 * `icwTop` and `icwLeft` (instrument-chart.css).
 *
 * Switch from the DevTools console:
 *     InstrumentChartBuilder.setMode({ top: true, left: true });
 *     InstrumentChartBuilder.setMode({ top: false });   // merges: left is untouched
 *     InstrumentChartBuilder.getMode();
 */
import EventBus from '../../event-bus.js';
import {
	CHART_WIDGET_PLACEMENTS,
	expandChartWidgetTemplate,
	getChartWidgetTemplate,
	normalizeChartWidgetMode
} from './instrument-chart-core.js';

const BODY_CLASS_BY_PLACEMENT = Object.freeze({ top: 'icwTop', left: 'icwLeft' });

let providers = {
	/** (sectionIndex) => Section | undefined */
	getSection: () => undefined
};

export class InstrumentChartBuilder {
	static registry = new Map();   // ownerID -> InstrumentChartWidget[]
	static mode = { top: false, left: false };

	static setProviders(next = {}) {
		providers = { ...providers, ...next };
	}

	/** @param hostEl DOM element or jQuery object  @param ownerID the tableID (matches statusChanged's ownerID)
	 *  @param placement 'top' | 'left'  @param options { instrumentCaption } */
	static createWidget(hostEl, ownerID, placement, options = {}) {
		const widget = new InstrumentChartWidget(hostEl, ownerID, placement, options);
		if (!InstrumentChartBuilder.registry.has(ownerID)) {
			InstrumentChartBuilder.registry.set(ownerID, []);
		}
		InstrumentChartBuilder.registry.get(ownerID).push(widget);
		return widget;
	}

	static removeByOwnerID(ownerID) {
		for (const widget of InstrumentChartBuilder.registry.get(ownerID) || []) {
			widget.destroy();
		}
		InstrumentChartBuilder.registry.delete(ownerID);
	}

	static removeAll() {
		for (const widgets of InstrumentChartBuilder.registry.values()) {
			widgets.forEach((widget) => widget.destroy());
		}
		InstrumentChartBuilder.registry.clear();
	}

	static refreshAll() {
		for (const widgets of InstrumentChartBuilder.registry.values()) {
			widgets.forEach((widget) => widget.refresh());
		}
	}

	/** Merges the booleans in `raw` ({top?, left?}) into the mode, sets the <body> classes, and refreshes the widgets. */
	static setMode(raw) {
		InstrumentChartBuilder.mode = normalizeChartWidgetMode(raw, InstrumentChartBuilder.mode);
		InstrumentChartBuilder.applyBodyClasses();
		InstrumentChartBuilder.refreshAll();
		return InstrumentChartBuilder.getMode();
	}

	static getMode() {
		return { ...InstrumentChartBuilder.mode };
	}

	static isPlacementOn(placement) {
		return InstrumentChartBuilder.mode[placement] === true;
	}

	static applyBodyClasses() {
		if (typeof document === 'undefined' || !document.body) {
			return;
		}
		for (const placement of CHART_WIDGET_PLACEMENTS) {
			document.body.classList.toggle(BODY_CLASS_BY_PLACEMENT[placement], InstrumentChartBuilder.isPlacementOn(placement));
		}
	}
}

class InstrumentChartWidget {
	constructor(hostEl, ownerID, placement, options = {}) {
		this.host = hostEl && hostEl.jquery ? hostEl[0] : hostEl;
		this.ownerID = ownerID;
		this.placement = placement;
		this.instrumentCaption = options.instrumentCaption ?? '';
		this.sectionIndex = null;   // unknown until this Instrument's table reports a Section
		this.lastHtml = null;
		this.statusChangedHandler = (event, data) => this.handleStatusChanged(data);
		EventBus.on('Widget:SectionStatus:statusChanged', this.statusChangedHandler);
	}

	/** replayTable() reports the Section each Instrument shows (1-based) in `sectionNumber`; the per-beat
	 *  emitters carry none and are ignored. */
	handleStatusChanged(data) {
		if (!data || data.ownerID !== this.ownerID) {
			return;
		}
		const sectionNumber = Number.parseInt(data.sectionNumber, 10);
		if (!Number.isFinite(sectionNumber) || sectionNumber < 1) {
			return;
		}
		const sectionIndex = sectionNumber - 1;
		if (sectionIndex === this.sectionIndex && this.lastHtml !== null) {
			return;   // same Section: the per-beat replays need no re-expansion; chart edits come through refreshAll()
		}
		this.sectionIndex = sectionIndex;
		this.refresh();
	}

	/** Does nothing unless this placement is on.  Writes the host only when the HTML changed. */
	refresh() {
		if (!this.host || !InstrumentChartBuilder.isPlacementOn(this.placement)) {
			return;
		}
		const section = this.sectionIndex === null ? undefined : providers.getSection(this.sectionIndex);
		const html = expandChartWidgetTemplate({
			template: getChartWidgetTemplate(this.placement),
			section,
			sectionIndex: this.sectionIndex,
			tableID: this.ownerID,
			instrumentCaption: this.instrumentCaption
		});
		if (html !== (this.lastHtml ?? '')) {
			this.host.innerHTML = html;
			this.lastHtml = html;
		}
	}

	destroy() {
		EventBus.off('Widget:SectionStatus:statusChanged', this.statusChangedHandler);
		this.host = null;
	}
}

// Browser-global handle for DevTools (the same pattern as SectionStatusBuilder).
if (typeof window !== 'undefined') {
	window.InstrumentChartBuilder = InstrumentChartBuilder;
}
