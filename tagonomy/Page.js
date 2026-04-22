/** Represents a web page html file that has widget elements: 
 *    <widget id="theID" type="org.dynamide.WidgetOne" />
 *  Knows how to find those widgets, load them, 
 * and insert their build() result into the slot of the widget tag.
 * Each widget.id is provided by the designer of the html file, 
 * who can then expect that after loading, each widget may be found by id in the DOM and also 
 * reference its javascript class registered by id from javascript.
 * 
 * Cleanup is by jQuery.remove() which detaches from DOM and allows garbage collection, 
 * but does not call widget.destroy() or anything fancy.  Therefore, until any fancy registry is in place, 
 * store data on data- attributes.
 */

export class Page {
    constructor(widgetLoader){
        this.widgets = {};  //keyed by widget.id, which will be page-unique.  So this is the registry.
        this.loadAllWidgetsInPage(widgetLoader);
    }
    
    getWidgets(){
        return this.widgets;
    }

    //look for all widgets like this: 
    //      <widget id="org-dynamide-gallery-1" data-type="org.dynamide.gallery" />
    loadAllWidgetsInPage(widgetLoader){
        $("widget").each((index, element) => {
            let jElement = $(element);
            let id = jElement.attr("id");
            let type = jElement.attr("data-type");
            widgetLoader.loadWidget(type, id, this);
        });
    }
    
    widgetLoaded(widget){
        this.widgets[widget.id] = widget;
        let jHeadElement = $('head');
        widget.registerCSS(jHeadElement);
        let jElement = widget.build();
        $('#'+widget.id).empty().append(jElement);
    }

}