import EventBus from '../../event-bus.js';

export class SectionStatusBuilder {
    static registry = new Map(); // ownerID -> array of widgets

    /**
     * Create and register a SectionStatusWidget.
     * @param {string} destSelector - CSS selector for destination element (must be unique)
     * @param {string} ownerID - Unique string for the owning table/div/span
     * @param {string} placementID - String for placement within the owner
     * @param {string} layout - 'vertical' or 'horizontal'
     * @returns {SectionStatusWidget}
     */
    static addToDest(destSelector, ownerID, placementID, layout = 'vertical') {
        const widget = new SectionStatusWidget(destSelector, ownerID, placementID, layout);
        if (!this.registry.has(ownerID)) {
            this.registry.set(ownerID, []);
        }
        this.registry.get(ownerID).push(widget);
        return widget;
    }

    /**
     * Remove and destroy all widgets for a given ownerID.
     * @param {string} ownerID
     */
    static removeByOwnerID(ownerID) {
        if (this.registry.has(ownerID)) {
            for (const widget of this.registry.get(ownerID)) {
                widget.destroy();
            }
            this.registry.delete(ownerID);
        }
    }

    /**
     * Remove and destroy all widgets.
     */
    static removeAll() {
        for (const widgets of this.registry.values()) {
            for (const widget of widgets) {
                widget.destroy();
            }
        }
        this.registry.clear();
    }
}

class SectionStatusWidget {
    constructor(destSelector, ownerID, placementID, layout) {
        this.ownerID = ownerID;
        this.placementID = placementID;
        this.layout = layout;
        this.widgetID = `${ownerID}_${placementID}_SectionStatus`;
        this.container = document.querySelector(destSelector);
        this.eventHandlers = [];
        this.render();
        this.subscribeEvents();
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        const tplId = this.layout === 'vertical'
            ? 'section-status-vertical-template'
            : 'section-status-horizontal-template';
        const tpl = document.getElementById(tplId);
        if (!tpl) return;
        const node = tpl.content.cloneNode(true);
        // For now, idx is always 0; can be extended as needed
        this.replaceTemplateVars(node, { idx: 0, tableID: this.ownerID });
        this.container.appendChild(node);
        this.container.dataset.widgetId = this.widgetID;
    }

    replaceTemplateVars(node, vars) {
        // Recursively replace ${var} in all attributes and text nodes
        const walk = (el) => {
            if (el.nodeType === Node.ELEMENT_NODE) {
                for (const attr of el.attributes) {
                    attr.value = attr.value.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '');
                }
                for (const child of el.childNodes) walk(child);
            } else if (el.nodeType === Node.TEXT_NODE) {
                el.textContent = el.textContent.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '');
            }
        };
        walk(node);
    }

    subscribeEvents() {
        // KeyChanged
        const keyChangedHandler = (event, data) => {
            if (data.widgetID === this.widgetID) {
                this.handleKeyChanged(data);
            }
        };
        EventBus.on('Widget:SectionStatus:keyChanged', keyChangedHandler);
        this.eventHandlers.push(['Widget:SectionStatus:keyChanged', keyChangedHandler]);

        // SectionChanged
        const sectionChangedHandler = (event, data) => {
            if (data.widgetID === this.widgetID) {
                this.handleSectionChanged(data);
            }
        };
        EventBus.on('Widget:SectionStatus:sectionChanged', sectionChangedHandler);
        this.eventHandlers.push(['Widget:SectionStatus:sectionChanged', sectionChangedHandler]);

        // LayoutChanged
        const layoutChangedHandler = (event, data) => {
            if (data.widgetID === this.widgetID && data.layout) {
                this.setLayout(data.layout);
            }
        };
        EventBus.on('Widget:SectionStatus:layoutChanged', layoutChangedHandler);
        this.eventHandlers.push(['Widget:SectionStatus:layoutChanged', layoutChangedHandler]);

        // IDChanged
        const idChangedHandler = (event, data) => {
            if (data.oldID === this.widgetID) {
                this.widgetID = data.newID;
            }
        };
        EventBus.on('Widget:SectionStatus:IDChanged', idChangedHandler);
        this.eventHandlers.push(['Widget:SectionStatus:IDChanged', idChangedHandler]);
    }

    handleKeyChanged(data) {
        // Example: update rootID display
        const el = this.container.querySelector('.lblRootID');
        if (el) el.textContent = data.rootID;
        const lead = this.container.querySelector('.lblRootIDLeadRelative');
        if (lead && data.rootIDLead !== undefined) lead.textContent = data.rootIDLead;
    }

    handleSectionChanged(data) {
        // Example: update caption
        const el = this.container.querySelector('.section-status-caption');
        if (el && data.caption) el.textContent = data.caption;
    }

    setLayout(newLayout) {
        if (this.layout !== newLayout) {
            this.layout = newLayout;
            this.render();
        }
    }

    destroy() {
        // Unsubscribe from EventBus
        for (const [topic, handler] of this.eventHandlers) {
            EventBus.off(topic, handler);
        }
        this.eventHandlers = [];
        // Remove DOM
        if (this.container) this.container.innerHTML = '';
    }
}

// Export for global use
window.SectionStatusBuilder = SectionStatusBuilder;
