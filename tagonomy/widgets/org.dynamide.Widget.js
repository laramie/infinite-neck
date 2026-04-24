import EventBus from '../../event-bus.js';

export function makeWidget(type, id, dataAttributes, page){
    return new Widget(type, id, dataAttributes, page);
}

export class Widget {
    constructor(type, id, dataAttributes, page) {
        this.id = id;
        this.type = type; //type is a path
        this.page = page;
        this.dataAttributes = dataAttributes;
        this.chunks = {};    
    }

    static makeClassKey(type){
        return type.replace(/[./]/g, "-");
    }
    getClassKey(){
        return Widget.makeClassKey(this.type);
    }
    
    load(widgetLoader){
        widgetLoader.fetchChunks(this.includes, (chunks) => this.loaded(chunks));  //arrow function is equivalent of :  widgetLoader.fetchChunks(this.includes, this.loaded.bind(this));
    }
    
    loaded(chunks){
        console.log("loaded for "+this.id+" chunks: "+JSON.stringify(chunks));
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
    /** This is the one chance for the widget to reliably get the contents from the page, 
     *    after this we may remove the widget element and replace it with the results of build() 
     *    with the widget.id as that element.
     */
    grabContents(jElement){
    }
    build(){
    }
    repaint(){
    }
    registerEvents(){
    }
}