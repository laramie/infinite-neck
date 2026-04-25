/**
 * @module tagonomy/widgets/org.dynamide.gallery.widget
 */

import EventBus from '../../event-bus.js';
import { Widget } from './org.dynamide.Widget.js';

/**
 * Default configuration for GalleryWidget.
 * @type {Object}
 * @property {string} type - The widget type.
 * @property {Array<Object>} includes - Default includes for CSS and HTML.
 * @property {Array<string>} events - Events handled by this widget.
 */
const WidgetDefaults = {
    type: "org.dynamide.gallery.widget",
    includes: [ 
        {id: "css",  url: "widgets/org.dynamide.gallery.css"}, 
        {id: "html", url: "widgets/org.dynamide.gallery.shtml"} 
    ],
    events: ["org.dynamide.gallery:Resize",
             "org.dynamide.gallery:AddImage"]
};

/**
 * Factory function to create a GalleryWidget.
 * @param {string} type - The widget type.
 * @param {string} id - The widget id.
 * @param {Object} dataAttributes - Data attributes from the widget tag.
 * @param {Object} page - The page context.
 * @returns {GalleryWidget}
 */
export function makeWidget(type, id, dataAttributes, page){
    return new GalleryWidget(type, id, dataAttributes, page);
}

/**
 * GalleryWidget class.
 * 
 *
 * Extends {@link module:tagonomy/widgets/org.dynamide.Widget~Widget}.
 *
 * 
 * <p>The GalleryWidget implements {@link GalleryWidget#build} to create a SPAN that shows image files pulled in via the "html" chunk.
 * It manipulates the presentation of these images with data attributes "data-width" and "data-height".
 * </p>
 * 
 * <p>The GalleryWidget provides its default includes in WidgetDefaults, however this.includes may be modified.
 * </p>
 * 
 * <p>The GalleryWidget implements {@link GalleryWidget#registerEvents} to register the events listed in WidgetDefaults,
 * using its handler methods {@link GalleryWidget#resize} and {@link GalleryWidget#addImage}, which you can override or call.
 * </p>
 * 
 * @augments Widget
 */
export class GalleryWidget extends Widget {
    /**
     * Constructs a GalleryWidget instance.
     * @param {string} type - The widget type.
     * @param {string} id - The widget id.
     * @param {Object} dataAttributes - Data attributes from the widget tag.
     * @param {Object} page - The page context.
     */
    constructor(type, id, dataAttributes, page) {
        super(type, id, dataAttributes, page);
        Object.assign(this, WidgetDefaults);
    }
    
    /**
     * Builds the widget's DOM representation.
     * Creates a SPAN element and populates it with the HTML chunk.
     * If "data-width" and "data-height" attributes are present, sets the size of the first image.
     * @returns {jQuery} The root element for the widget.
     */
    build(){
        let widgetRoot = $("<span>");
        let htmlChunk = this.chunks["html"];
        if (htmlChunk && htmlChunk.text) {
            widgetRoot.html(htmlChunk.text);
        }
        let $widgetElem = $(`widget#${this.id}`);
        let width = $widgetElem.data('width'); 
        let height = $widgetElem.data('height'); 
        if (width && height) {
            widgetRoot.find('img').first().css({ width: width+"px", height: height+"px" });
        }
        return widgetRoot;
    }

    /**
     * Called to repaint or update the widget's DOM representation.
     * Subclasses may implement this as needed.
     */
    repaint(){
    }

    //====== non-API methods and event handlers ===================================

    /**
     * Handler for the "org.dynamide.gallery:Resize" event.
     * Override or call this method to handle resize events.
     * @param {Object} data - Event data.
     */
    resize(data){
    }

    /**
     * Handler for the "org.dynamide.gallery:AddImage" event.
     * Override or call this method to handle add image events.
     * @param {Object} data - Event data.
     */
    addImage(data){
    }

    /**
     * Registers event handlers for the events listed in WidgetDefaults.
     * Uses {@link GalleryWidget#resize} and {@link GalleryWidget#addImage} as handlers.
     */
    registerEvents(){
        EventBus.on("org.dynamide.gallery:Resize", this.resize);
        EventBus.on("org.dynamide.gallery:AddImage", this.addImage);
    }
}