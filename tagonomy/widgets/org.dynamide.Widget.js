/**
 * @module tagonomy/widgets/org.dynamide.Widget
 */

import EventBus from '../../event-bus.js';

/**
 * Factory function to create a Widget.
 * 
 * @param {string} type - The relative path to the concrete Widget subclass. Used to determine the widget type and CSS key.
 * @param {string} id - The id of the <widget> element, and subsequently the id of any root element containing the result of build().
 * @param {Object} dataAttributes - A dictionary of all the "data-*" attributes on <widget> in the exact form found (e.g., dataAttributes["data-includes"]).
 * @param {Object} page - A live reference to the {@link Page} instance that represents the web page containing this widget.
 * @returns {Widget}
 */
export function makeWidget(type, id, dataAttributes, page){
    return new Widget(type, id, dataAttributes, page);
}

/**
 * Widget class.
 *
 * The Widget class is a concrete class that will handle includes in the <widget> element's "data-includes" attribute,
 * which will append a CSS style tag to the HEAD tag, but does not implement {@link Widget#build}.
 * Subclasses are expected to implement {@link Widget#build} if they want to have an element be in the DOM in the BODY tag.
 *
 * Widget ignores any child nodes or text node within the widget element, but subclasses may grab these by implementing {@link Widget#grabContents}
 * before those nodes are thrown away.
 *
 * Subclasses should not hold onto any jQuery or DOM elements after returning from methods.
 *
 * The {@link Widget#build} method is expected to return:
 * - `undefined` if no element should be appended to the DOM
 * - a jQuery element such as <span> or <div> that will preserve any elements within it, and be available for the Widget subclass to manipulate later.
 *   This element will have its "id" attribute set to the "id" of the <widget> element as authored in the page.
 *
 * After construction, loading, and DOM insertion, you may respond to any {@link EventBus} messages you have registered during {@link Widget#registerEvents}.
 *
     * constructor() 
     *
     * Constructs a Widget instance.
     * 
     * Deals with includes by looking at "data-includes" attribute on the widget element.
     * If present, creates a dictionary of this shape:
     * 
     *   ```
     *   "includes": [
     *    {
     *      "id": "css",
     *      "url": "widgets/org.dynamide.gallery.css"
     *    },
     *    {
     *      "id": "html",
     *      "url": "widgets/org.dynamide.gallery.shtml"
     *    }
     *  ]
     *  ```
     * 
     * and passes that to WidgetLoader.fetch... which returns `chunks` which is of this shape:
     * 
     * 
     *  ```
     *  "chunks": {
     *    "css": {
     *      "id": "css",
     *      "url": "widgets/org.dynamide.gallery.css",
     *      "text": ".gallery {display: inline-block; background-color: blue;}"
     *    },
     *    "html": {
     *      "id": "html",
     *      "url": "widgets/org.dynamide.gallery.shtml",
     *      "text": "<p class=\"gallery\">....</p>"
     *    }
     *  }
     *  ```
     * 
     * @param {string} type - The relative path to the concrete Widget subclass. Use {@link Widget.makeClassKey} or {@link Widget#getClassKey} for CSS keys.
     * @param {string} id - The id of the <widget> element and any root element containing the result of build().
     * @param {Object} dataAttributes - Dictionary of all "data-*" attributes on <widget> (e.g., dataAttributes["data-includes"]).
     * @param {Object} page - Reference to the {@link Page} instance containing this widget.
     * @property {Object} chunks - Dictionary of loaded resource chunks (e.g., "css", "html").
     * @property {Object} includes - Dictionary of resources to fetch, loaded automatically from "data-includes" (e.g., "css", "html").
    * 
    * @class
    */
export class Widget {
    constructor(type, id, dataAttributes, page) {
        this.id = id;
        this.type = type;
        this.page = page;
        this.dataAttributes = dataAttributes;
        this.chunks = {};    
        this.includes = JSON.parse(dataAttributes["data-includes"]||"{}");
    }

    /**
     * Converts a widget type (path) to a CSS class key.
     * @param {string} type - The widget type (path).
     * @returns {string} The CSS class key.
     */
    static makeClassKey(type){
        return type.replace(/[./]/g, "-");
    }

    /**
     * Gets the CSS class key for this widget instance.
     * @returns {string} The CSS class key.
     */
    getClassKey(){
        return Widget.makeClassKey(this.type);
    }
    
    /**
     * Called when the WidgetLoader has constructed this Widget concrete subclass.
     * At this point, "this" and any methods you have defined are accessible, but any includes or resources have not been fetched yet.
     * This is your opportunity to request these resources with widgetLoader.fetchChunks().
     * Generally, you do not need to override this method; simply ensure this.includes is properly filled out.
     * If you do override this method, follow the pattern in Widget.load() and pass your loaded() function pointer with an arrow function so "this" is bound.
     * When those resources have been loaded, {@link Widget#loaded} will be called.
     * If you do not call super.loaded(widgetLoader), you'll break the includes, but also your
     * loaded() function will never be called, which breaks how Page loads all Widgets, 
     * causing it to never return from the Promise in whenAllWidgetsLoaded().
     * 
     * @param {Object} widgetLoader - The WidgetLoader instance.
     */
    load(widgetLoader){
        widgetLoader.fetchChunks(this.includes, (chunks) => this.loaded(chunks));
    }
    
    /**
     * Called when fetch() for resources completes.
     * All the resources you requested in this.includes are present in the dictionary chunks, with standard keys being "css" and "html".
     * Example:
     * ```
     * {
     *   "css": {
     *     "id": "css",
     *     "url": "partial-test-standalone.css",
     *     "text": ".partial-test-standalone { ... }"
     *   }
     * }
     * ```
     * This method is expected to call this.page.widgetLoaded(this) so that Page can call widget.registerCSS(), widget.build(), and widget.registerEvents().
     * 
     * @param {Object} chunks - Dictionary of loaded resource chunks.
     */
    loaded(chunks){
        this.chunks = chunks;
        this.page.widgetLoaded(this);
    }
    
    /**
     * Registers CSS rules by appending a <style> element to the given head element.
     * 
     * @param {jQuery} jHeadElement - jQuery object for the <head> element to append the style to.
     */
    registerCSS(jHeadElement){
        let cssChunk = this.chunks["css"];
        if (cssChunk && cssChunk.text) {
            // Generate a unique id for the style tag based on the url of the stylesheet loaded
            let styleId = (cssChunk.url || "widget").replace(/[./]/g, "-");
            // Check if a style tag with this id already exists
            if (jHeadElement.find('style#'+styleId).length === 0) {
                let jStyle = $("<style>");
                jStyle.attr("id", styleId);
                jStyle.text(cssChunk.text);
                jHeadElement.append(jStyle);
            }
        }
    }

    /**
     * This is the one chance for the widget to reliably get the contents from the page,
     * after this we may remove the widget element and replace it with the results of build()
     * with the widget.id as that element.
     * 
     * Widget ignores any child nodes or text node within the widget element, but subclasses may grab these by implementing this method before those nodes are thrown away.
     * Subclasses should not hold onto any jQuery or DOM elements after returning from this method.
     * 
     * @param {jQuery} jElement - The jQuery element representing the widget.
     */
    grabContents(jElement){
    }

    /**
     * Subclasses are expected to implement this method if they want to have an element be in the DOM in the BODY tag.
     * 
     * The build() method is expected to return:
     * - `undefined` if no element should be appended to the DOM
     * - a jQuery element such as <span> or <div> that will preserve any elements within it, and be available for the Widget subclass to manipulate later.
     *   This element will have its "id" attribute set to the "id" of the <widget> element as authored in the page.
     * 
     * Subclasses should not hold onto any jQuery or DOM elements after returning from this method.
     * 
     * @returns {jQuery|undefined}
     */
    build(){
    }

    /**
     * Called to repaint or update the widget's DOM representation.
     * Subclasses may implement this as needed.
     */
    repaint(){
    }

    /**
     * Called to register any event handlers for this widget.
     * After construction, loading, and DOM insertion, you may respond to any {@link EventBus} messages you have registered here.
     * Subclasses may implement this as needed.
     */
    registerEvents(){
    }
}