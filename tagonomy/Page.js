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
        $("widget").each((index, widgetElement) => {
            let dataAttributes = {};
            $.each(widgetElement.attributes, function() {
                if(this.name.startsWith('data-')) {
                    dataAttributes[this.name] = this.value;
                }
            });
            let jWidget = $(widgetElement);
            let id = jWidget.attr("id");
            let type = jWidget.attr("data-type");
            widgetLoader.loadWidget(type, id, dataAttributes, this, jWidget);//don't let callees hang onto this after widget.grabContents().
        });
    }
    
    widgetLoaded(widget){
        this.widgets[widget.id] = widget;
        let jWidget = $(`widget#${widget.id}`);
        //widget.grabContents(jWidget);//This is the one chance for the widget to reliably get the contents from the page, after this we may remove the widget element and replace it with the results of build() with the widget.id as that element.
        let jHeadElement = $('head');
        widget.registerCSS(jHeadElement);
        let built = widget.build();
        if (built === undefined || built === null){
            jWidget.remove();
            return;
        }
        let jElement = $(built);
        if (jElement.length === 0){
            jWidget.remove();
            return;
        }
        if (jElement.length === 1){
            jWidget.replaceWith(jElement);
            jElement.attr("id", widget.id);
            return;
        }
        let jWrapper = $("<span>");
        jWrapper.append(jElement);
        jWidget.replaceWith(jWrapper);
        jWrapper.attr("id", widget.id);
    }

}