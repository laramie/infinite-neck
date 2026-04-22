const WidgetDefaults = {
    type: "org.dynamide.Widget",
    includes: [ 
        {id: "css",  url: ""}, 
        {id: "html", url: ""} 
    ],
    events: []
};

export function makeWidget(id, page){
    return new Widget(id, page);
}

export class Widget {
    constructor(id, page) {
        Object.assign(this, WidgetDefaults);
        this.id = id;
        this.page = page;
        this.chunks = {};    
    }
    
    load(widgetLoader){
        widgetLoader.fetchChunks(this.includes, (chunks) => this.loaded(chunks));  //arrow function is equivalent of :  widgetLoader.fetchChunks(this.includes, this.loaded.bind(this));
    }
    
    loaded(chunks){
        this.chunks = chunks;
        this.page.widgetLoaded(this);
    }
    
    /**
     * Registers CSS rules by appending a <style> element to the given head element.
     *
     * @param {jQuery} jHeadElement - jQuery object for the <head> element to append the style to.
     * @param {string} [css=""] - CSS rules as a string. Subclasses will override this method and supply CSS internally, omitting this parameter from their API.
     *
     * Subclasses will override this method and provide CSS from an internal source (e.g., this.templates["css"]).
     * Callers should generally use the subclass API, which do not require the css parameter.
     */
    registerCSS(jHeadElement){
        let css = this.chunks["css"];
        if (css){
            let jStyle = $("<style>");
            jStyle.text(css);
            jHeadElement.append(jStyle);
        }
    }
    build(){
    }
    repaint(){
    }
    registerEvents(){
    }
}