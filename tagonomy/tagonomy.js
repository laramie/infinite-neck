import { Page } from './Page.js';
import { WidgetLoader } from './WidgetLoader.js';


// Browser loads DOM, then script tag in index.html pulls in this module,
// which runs this top-level code runs first, which calls appInit().
if (typeof window !== 'undefined' && typeof $ !== 'undefined') {
    $(function() {
        if (typeof appInit === 'function') appInit();
    });
}

function appInit(){
    let widgetLoader = new WidgetLoader();
    let page = new Page(widgetLoader);  //rips through web page and loads all widgets.
    page.whenAllWidgetsLoaded().then(() => {
        // Custom replacer to remove 'page' property from Widget objects
        function widgetReplacer(key, value) {
            if (key === 'page') {
                return undefined;
            }
            return value;
        }
        console.log("appInit::new Page::widgets:"+
            JSON.stringify(page.getWidgets(), widgetReplacer, 2)
        );
    });
}
