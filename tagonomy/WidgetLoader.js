import { widgetLoaderImport } from './WidgetLoaderImport.js';  //wrapper to avoid documentation.js not understanding the __import__ keyword.


/** @class
 */
export class WidgetLoader {
    constructor(){
    }

    /**
     * Dynamically loads a widget module and initializes it.
     */
    loadWidget(widgetPath, id, dataAttributes, page, jWidget){
        //widgetPath = './widgets/org.dynamide.gallery.widget.js'
        let widget;
        if (!widgetPath){
            console.log("Widgets without modules not supported: "+id);
            return;
        } else { 
            widgetLoaderImport(widgetPath).then(module => {
                widget = module.makeWidget(widgetPath, id, dataAttributes, page);
                widget.grabContents(jWidget)
                widget.load(this);
            });
        }
    }


    /** Widget subclasses should call this in load() to pull in resources, but 
     *  can also just set this.includes instead.
     */
    fetchChunks(items, loadedFunction){
        if (!Array.isArray(items) || items.length === 0) {
            console.log("fetchChunks calling empty loadedFunction because no array of items");
            loadedFunction({});
            return;
        }
        Promise.all(
            items.map(item =>
                fetch(item.url)
                    .then(resp => resp.text())
                    .then(text => ({ id: item.id, url: item.url, text }))
            )
        )
        .then(results => {
            let chunks = {};
            results.forEach(({id, url, text}) => {
                chunks[id] = { id, url, text };
            });
            loadedFunction(chunks);
        })
        .catch(err => {
            console.error('Error fetching chunks:', err);
        });
    }

}