export class WidgetLoader {
    constructor(){
    }

    /* widgetPath = './widgets/org.dynamide.gallery.widget.js'
     */
    loadWidget(widgetPath, id, page){
        let widget;
        if (!widgetPath){
            console.log("Widgets without modules not supported: "+id);
            return;
        } else {        
            import(widgetPath).then(module => {
                widget = module.makeWidget(id, page);
                widget.load(this);
            });
        }
    }

    fetchChunks(items, loadedFunction){
        // items: [{id, url}, ...]
        Promise.all(
            items.map(item =>
                fetch(item.url)
                    .then(resp => resp.text())
                    .then(text => ({ id: item.id, text }))
            )
        )
        .then(results => {
            let chunks = {};
            results.forEach(({id, text}) => {
                chunks[id] = text;
            });
            loadedFunction(chunks);
        })
        .catch(err => {
            console.error('Error fetching chunks:', err);
        });
    }

}