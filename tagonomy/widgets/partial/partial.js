/**
 * @module tagonomy/widgets/partial/partial
 */

import { Widget } from '../org.dynamide.Widget.js';

/**
 * Factory function to create a PartialWidget.
 * @param {string} type - The widget type.
 * @param {string} id - The widget id.
 * @param {Object} dataAttributes - Data attributes from the widget tag.
 * @param {Object} page - The page context.
 * @returns {PartialWidget}
 */
export function makeWidget(type, id, dataAttributes, page){
    return new PartialWidget(type, id, dataAttributes, page);
}

/**
 * PartialWidget class.
 *
 * Extends {@link Widget}.
 *
 * Any includes in the "data-includes" attribute will be processed:
 * - If "css" is present, its content will be appended to the HEAD element.
 * - If "html" is present, its content will be appended to a SPAN element and returned from {@link PartialWidget#build}, replacing the original &lt;widget&gt; element.
 *
 * Any child nodes or text content within the widget tag will be ignored.
 *
 * The {@link PartialWidget#build} method returns `undefined` if no "html" include is specified,
 * so the widget will emit no block element and disappear from the DOM, but any "css" will still be appended to HEAD.
 *
 *
 *     @param {string} type - The widget type.
 *     @param {string} id - The widget id.
 *     @param {Object} dataAttributes - Data attributes from the widget tag.
 *     @param {Object} page - The page context.

 * @augments Widget
 * 
 * @class
 */
export class PartialWidget extends Widget {
    /**
     */
    constructor(type, id, dataAttributes, page) {
        super(type, id, dataAttributes, page);
    }
    
    /**
     * Builds the widget's DOM representation.
     * If "html" is included, returns a SPAN element containing the HTML.
     * If not, returns undefined (widget disappears from DOM, but CSS is still applied).
     * @returns {jQuery|undefined}
     */
    build(){
        let htmlChunk = this.chunks["html"];
        if (htmlChunk && htmlChunk.text) {
            let widgetRoot = $("<span>");
            widgetRoot.html(htmlChunk.text);
            return widgetRoot;
        }
        return undefined;
    }
}