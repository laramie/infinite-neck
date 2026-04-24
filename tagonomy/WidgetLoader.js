export class WidgetLoader {
    constructor(){
    }

    /* widgetPath = './widgets/org.dynamide.gallery.widget.js'
     */
    loadWidget(widgetPath, id, dataAttributes, page, jWidget){
        let widget;
        if (!widgetPath){
            console.log("Widgets without modules not supported: "+id);
            return;
        } else {        
            import(widgetPath).then(module => {
                widget = module.makeWidget(widgetPath, id, dataAttributes, page);
                widget.grabContents(jWidget)
                widget.load(this);
            });
        }
    }

    fetchChunks(items, loadedFunction){
        console.log("fetchChunks: "+JSON.stringify(items));
        if (!Array.isArray(items) || items.length === 0) {
            console.log("fetchChunks calling empty loadedFunction because no array of items");
            loadedFunction({});
            return;
        }
        // items: [{id, url}, ...]
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