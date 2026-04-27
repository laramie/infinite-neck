/**
 * @module tagonomy/widgets/include/include
 */

import { Widget } from '../org.dynamide.Widget.js';

/**
 * Factory function to create an IncludeWidget.
 * @param {string} type - The widget type.
 * @param {string} id - The widget id.
 * @param {Object} dataAttributes - Data attributes from the widget tag.
 * @param {Object} page - The page context.
 * @returns {IncludeWidget}
 */
export function makeWidget(type, id, dataAttributes, page){
    return new IncludeWidget(type, id, dataAttributes, page);
}

/**
 * IncludeWidget class.
 *
 * Extends {@link Widget}.
 *
 * The IncludeWidget behaves just like the PartialWidget, except that the includes may be specified by a text node within the widget element, rather than the "data-includes" attribute, for readability.
 *
 * Any includes specified will be processed:
 * - If "css" is present, its content will be appended to the HEAD element.
 * - If "html" is present, its content will be appended to a SPAN element and returned from {@link IncludeWidget#build}, replacing the original &lt;widget&gt; element.
 *
 * If the &lt;widget&gt; element contains a text node, it will be parsed as JSON and expected to be of the following structure:
 * ```
 * [
 *   {"id":"html","url":"include-test.shtml"},
 *   {"id":"css","url":"include-test.css"}
 * ]
 * ```
 * where each object specifies the id for the included chunk and the url to fetch.
 *
 * Any child nodes or text content within the widget tag will be ignored after parsing.
 *
 * The {@link IncludeWidget#build} method returns `undefined` if no "html" include is specified,
 * so the widget will emit no block element and disappear from the DOM, but any "css" will still be appended to HEAD.
 *
 * @param {string} type - The widget type.
 * @param {string} id - The widget id.
 * @param {Object} dataAttributes - Data attributes from the widget tag.
 * @param {Object} page - The page context.

 * @augments Widget
 * 
 * @class
 */
export class IncludeWidget extends Widget {
    constructor(type, id, dataAttributes, page) {
        super(type, id, dataAttributes, page);
    }

    /**
     * Grabs and parses the contents of the widget element as JSON to set includes.
     * The expected structure is an array of objects with "id" and "url" properties.
     * After parsing, the element is emptied.
     * @param {jQuery} jElement - The jQuery element representing the widget.
     */
    grabContents(jElement){
        let contents = (jElement.html()||"");
        let obj = JSON.parse(contents);
        this.includes = obj;
        jElement.empty();
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