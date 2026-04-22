import EventBus from '../../event-bus.js';
import { Widget } from './org.dynamide.Widget.js';

const WidgetDefaults = {
    type: "org.dynamide.gallery.widget",
    includes: [ 
        {id: "css",  url: "widgets/org.dynamide.gallery.css"}, 
        {id: "html", url: "widgets/org.dynamide.gallery.shtml"} 
    ],
    events: ["org.dynamide.gallery:Resize",
             "org.dynamide.gallery:AddImage"]
};

export function makeWidget(id, page){
    return new GalleryWidget(id, page);
}

export class GalleryWidget extends Widget {
    constructor(id, page) {
        super(id, page);
        Object.assign(this, WidgetDefaults);
    }
    
    build(){
        let widgetRoot = $("<span>");
        widgetRoot.html(this.chunks["html"]);
        let $widgetElem = $(`widget#${this.id}`);
        let width = $widgetElem.data('width'); 
        let height = $widgetElem.data('height'); 
        if (width && height) {
            widgetRoot.find('img').first().css({ width: width+"px", height: height+"px" });
        }
        return widgetRoot;
    }

    repaint(){
    }
    //====== non-API methods and event handlers ===================================
    resize(data){
    }
    addImage(data){
    }
    registerEvents(){
        EventBus.on("org.dynamide.gallery:Resise", this.resize);
        EventBus.on("org.dynamide.gallery:AddImage", this.addImage);
    }
}
