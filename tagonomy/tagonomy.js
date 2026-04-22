import { Page } from './Page.js';
import { WidgetLoader } from './WidgetLoader.js';
import EventBus from '../event-bus.js';


// Browser loads DOM, then script tag in index.html pulls in this module,
// which runs this top-level code runs first, which calls appInit().
if (typeof window !== 'undefined' && typeof $ !== 'undefined') {
    $(function() {
        if (typeof appInit === 'function') appInit();
    });
}

function appInit(){
    let widgetLoader = new WidgetLoader();
    let page = new Page(widgetLoader);
    console.log("appInit::new Page::widgets:"+JSON.stringify(page.getWidgets(),null,2));
}


function test(){
    let widgetLoader = new WidgetLoader();
    //hardcode test.  Later, use ids from page, and partials urls from Widget.
    widgetLoader.fetchChunks([ 
            {id: "org-dynamide-calout-1",      url: "widgets/org.dynamide.callout.shtml"}, 
            {id: "org-dynamide-gallery-1",     url: "widgets/org.dynamide.gallery.shtml"},
            {id: "org-dynamide-gallery-1:css", url: "widgets/org.dynamide.gallery.css"}
        ], 
        allChunksReady
    );
}
function allChunksReady(chunks, widgets){
    $('#org-dynamide-gallery-1').html(chunks["org-dynamide-gallery-1"]);
    $('#org-dynamide-callout-1').html(chunks["org-dynamide-callout-1"]);
}