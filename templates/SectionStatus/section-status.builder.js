import {ReplayOptions} from '../../ReplayOptions.js';
import EventBus      from '../../event-bus.js';

export class SectionStatusBuilder {
    static registry = new Map(); // ownerID -> array of widgets

    static MAGIC_BROADCAST_CSS_CLASS_LooperLight = "LooperLight"; //this is a broadcast from infinite-neck::showLoopSectionsStarted() and showLoopSectionsStopped() which sets css class "LooperLightOn"

    /**
     * Create and register a SectionStatusWidget.
     * @param {string} destSelector - CSS selector for destination element (must be unique)
     * @param {Object} destEl - dom object that is the destination element, overrides/ignores destSelector if not null
     * @param {string} ownerID - Unique string for the owning table/div/span
     * @param {string} placementID - String for placement within the owner
     * @param {string} layout - 'vertical' or 'horizontal'
     * @returns {SectionStatusWidget}
     */
    static addToDest(destSelector, ownerID, placementID, layout = 'vertical') {
        let destEl = document.querySelector(destSelector);
        const widget = new SectionStatusWidget(destEl, ownerID, placementID, layout);
        SectionStatusBuilder.registerWidget(ownerID, widget);
        return widget;
    }

    static createWidget(destEl, ownerID, placementID, layout = 'vertical'){
        const widget = new SectionStatusWidget(destEl, ownerID, placementID, layout);
        SectionStatusBuilder.registerWidget(ownerID, widget);
        return widget;
    }

    static registerWidget(ownerID, widget){
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
    constructor(destEl, ownerID, placementID, layout) {
        this.ownerID = ownerID;
        this.placementID = placementID;
        this.layout = layout;
        this.widgetID = `${ownerID}_${placementID}_SectionStatus`;
        this.container = destEl;
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
        const vars = {widgetID: this.widgetID, 
            ownerID: this.ownerID, 
            placementID: this.placementID, 
            idx: 0,
            LooperLight: SectionStatusBuilder.MAGIC_BROADCAST_CSS_CLASS_LooperLight
        };
        let replaced = this.expandTemplate(tpl.innerHTML, vars);
        console.log("=====replaceTemplate innerHTML: "+tpl.innerHTML);
        console.log("=====replaceTemplate replaced: "+replaced);
        /* So jQuery does some magic here.
         *   Normal DOM API behavior is that if you set innerHTML before being attached to the DOM, the browser throws
         *      plain text innerHTML away upon attachment.
         *   jQuery magic is that when you create with jQuery, like let d = $('<div>') it creates a mini-DOM that is 
         *      detached but live, and preserves its tree you build up with jQuery calls.  
         *   So we have to stay in jQuery land to append to this.container.
         */
        let jContainer = $(this.container);
        let jInner = $(replaced);
        jContainer.append(jInner);
        jContainer.data('widgetID', this.widgetID);
    }

    expandTemplate (templateString, vars){ 
        const expandRuntime = (str, values) => {
            const keys = Object.keys(values);
            const vals = Object.values(values);
            return new Function(...keys, `return \`${str}\`;`)(...vals);
        };
        return expandRuntime(templateString, vars); 
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
            if (data.widgetID === this.widgetID
                ||
                data.ownerID === this.ownerID 
            ) {
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
        if (!data.replayOptions) return;
        const opts = data.replayOptions;
        console.log("======opts======\n" + JSON.stringify(opts, (key, value) => key === "currSection" ? undefined : value, 2));
        function updateIfChanged($el, val, isHtml = false) {
            if (!$el.length) return;
            if (isHtml) {
                if ($el.html() !== (val || '')) $el.html(val || '');
            } else {
                if ($el.text() !== (val || '')) $el.text(val || '');
            }
        }

        updateIfChanged(this.container.find('.SectionStatus_relativeSection'), opts.relativeSection || '');
        updateIfChanged(this.container.find('.SectionsStatus_SectionNumber'), (opts.sectionIndex !== undefined) ? (opts.sectionIndex + 1) : '');
        updateIfChanged(this.container.find('.SectionStatus_rootKey'), opts.rootKey || '', true);
        updateIfChanged(this.container.find('.SectionStatus_rootKeyLead'), opts.rootKeyLead || '', true);

        // jQuery and DOM both do class changes efficiently, no need to optimize the following:
        const $rootKey = this.container.find('.SectionStatus_rootKey');
        const $rootKeyLead = this.container.find('.SectionStatus_rootKeyLead');
        //These are all defined in section-status.css
        $rootKey.removeClass('ssKey_relative ssKey_listener');
        $rootKeyLead.removeClass('ssKey_relative ssKey_listener');
        switch (opts.type) {
            case ReplayOptions.Type.RELATIVE:
                $rootKey.addClass('ssKey_relative');
                $rootKeyLead.addClass('ssKey_relative');
                break;
            case ReplayOptions.Type.LISTENER:
                $rootKey.addClass('ssKey_listener');
                $rootKeyLead.addClass('ssKey_listener');
                break;
            // SELF or default: no extra class
        }
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
