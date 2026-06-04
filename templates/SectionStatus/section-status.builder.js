import {ReplayOptions} from '../../ReplayOptions.js';
import EventBus      from '../../event-bus.js';

function hasOwnStatusValue(data, key) {
    return Object.prototype.hasOwnProperty.call(data || {}, key);
}

export function normalizeSectionStatusBeatState(data = {}, currentState = {}) {
    const showBeatCounter = hasOwnStatusValue(data, 'showBeatCounter')
        ? !!data.showBeatCounter
        : !!currentState.showBeatCounter;
    const rawBeatNumber = hasOwnStatusValue(data, 'beatNumber')
        ? data.beatNumber
        : currentState.beatNumberText;
    const parsedBeatNumber = Number.parseInt(rawBeatNumber, 10);
    const beatNumberText = showBeatCounter && Number.isFinite(parsedBeatNumber) && parsedBeatNumber > 0
        ? String(parsedBeatNumber)
        : '';
    return {
        showBeatCounter,
        beatNumberText
    };
}

export class SectionStatusBuilder {
    static registry = new Map(); // ownerID -> array of widgets

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
        this.container = destEl && destEl.jquery ? destEl[0] : destEl;
        this.eventHandlers = [];
        this.loopActive = false;
        this.showBeatCounter = false;
        this.beatNumberText = '';
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
            layout: this.layout,
            idx: 0,
            widgetClasses: `SectionStatusWidget SectionStatusWidget--${this.layout} SectionStatusWidget--${this.placementID}`
        };
        let replaced = this.expandTemplate(tpl.innerHTML, vars);
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
        this.applyLoopState();
        this.applyBeatState();
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
        const statusChangedHandler = (event, data) => {
            if (this.matchesEventTarget(data)) {
                this.handleStatusChanged(data);
            }
        };
        EventBus.on('Widget:SectionStatus:statusChanged', statusChangedHandler);
        this.eventHandlers.push(['Widget:SectionStatus:statusChanged', statusChangedHandler]);

        const loopChangedHandler = (event, data) => {
            if (this.matchesEventTarget(data)) {
                this.handleLoopChanged(data);
            }
        };
        EventBus.on('Widget:SectionStatus:loopChanged', loopChangedHandler);
        this.eventHandlers.push(['Widget:SectionStatus:loopChanged', loopChangedHandler]);
    }

    matchesEventTarget(data) {
        if (!data) return false;
        if (data.widgetID && data.widgetID !== this.widgetID) return false;
        if (data.ownerID && data.ownerID !== this.ownerID) return false;
        if (data.placementID && data.placementID !== this.placementID) return false;
        return true;
    }

    normalizeStatusData(data) {
        if (!data) return null;
        if (data.replayOptions) {
            return {
                relativeSection: data.replayOptions.relativeSection || '',
                sectionNumber: (data.replayOptions.sectionIndex !== undefined) ? data.replayOptions.sectionIndex + 1 : '',
                rootKey: data.replayOptions.rootKey || '',
                rootKeyLead: data.replayOptions.rootKeyLead || '',
                keyMode: data.replayOptions.type,
                beatNumber: data.beatNumber ?? data.replayOptions.currentBeat,
                showBeatCounter: data.showBeatCounter,
                isLoopActive: data.isLoopActive
            };
        }
        return data;
    }

    handleStatusChanged(data) {
        if (!this.container) return;
        const status = this.normalizeStatusData(data);
        if (!status) return;
        const $container = $(this.container);
        function updateIfChanged($el, val, isHtml = false) {
            if (!$el.length) return;
            if (isHtml) {
                if ($el.html() !== (val || '')) $el.html(val || '');
            } else {
                if ($el.text() !== (val || '')) $el.text(val || '');
            }
        }
        function setActiveIfChanged($el, val) {
            if (!$el.length) return;
            const isActive = String(val ?? '').trim() !== '';
            if ($el.hasClass('ssKey_hasValue') !== isActive) {
                $el.toggleClass('ssKey_hasValue', isActive);
            }
        }

        if (hasOwnStatusValue(status, 'relativeSection')) {
            updateIfChanged($container.find('.SectionStatus_relativeSection'), status.relativeSection || '');
        }
        if (hasOwnStatusValue(status, 'sectionNumber')) {
            updateIfChanged($container.find('.SectionsStatus_SectionNumber'), (status.sectionNumber !== undefined) ? String(status.sectionNumber) : '');
        }

        if (hasOwnStatusValue(status, 'showBeatCounter') || hasOwnStatusValue(status, 'beatNumber')) {
            const beatState = normalizeSectionStatusBeatState(status, {
                showBeatCounter: this.showBeatCounter,
                beatNumberText: this.beatNumberText
            });
            this.showBeatCounter = beatState.showBeatCounter;
            this.beatNumberText = beatState.beatNumberText;
            this.applyBeatState();
        }

        const $rootKey = $container.find('.SectionStatus_rootKey');
        const $rootKeyLead = $container.find('.SectionStatus_rootKeyLead');

        if (hasOwnStatusValue(status, 'rootKey')) {
            const rootKey = status.rootKey || '';
            updateIfChanged($rootKey, rootKey, true);
            setActiveIfChanged($rootKey, rootKey);
        }
        if (hasOwnStatusValue(status, 'rootKeyLead')) {
            const rootKeyLead = status.rootKeyLead || '';
            updateIfChanged($rootKeyLead, rootKeyLead, true);
            setActiveIfChanged($rootKeyLead, rootKeyLead);
        }

        if (hasOwnStatusValue(status, 'keyMode')) {
            // jQuery and DOM both do class changes efficiently, no need to optimize the following:
            //These are all defined in section-status.css
            $rootKey.removeClass('ssKey_relative ssKey_listener');
            $rootKeyLead.removeClass('ssKey_relative ssKey_listener');
            switch (status.keyMode) {
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

        if (hasOwnStatusValue(status, 'isLoopActive') && typeof status.isLoopActive === 'boolean') {
            this.loopActive = status.isLoopActive;
            this.applyLoopState();
        }
    }

    handleLoopChanged(data) {
        if (!data || typeof data.isLoopActive !== 'boolean') return;
        this.loopActive = data.isLoopActive;
        this.applyLoopState();
    }

    applyLoopState() {
        if (!this.container) return;
        const $container = $(this.container);
        $container.attr('data-loop-active', this.loopActive ? 'true' : 'false');
        $container.find('.SectionStatus_loopLight').toggleClass('SectionStatus_loopActive', this.loopActive);
    }

    applyBeatState() {
        if (!this.container) return;
        const $container = $(this.container);
        $container.attr('data-show-beat-counter', this.showBeatCounter ? 'true' : 'false');
        $container.find('.SectionStatus_beatNumber').text(this.beatNumberText);
        $container.find('.SectionStatus_loopLight').toggleClass('SectionStatus_showBeatCounter', this.showBeatCounter);
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

// Export for browser-global use when available.
if (typeof window !== 'undefined') {
    window.SectionStatusBuilder = SectionStatusBuilder;
}
