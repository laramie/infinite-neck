//Do not try to documentation.js this file.
//wrapper to avoid documentation.js not understanding the __import__ keyword.
/** @ignore
 *  @private 
 * 
 */
export function widgetLoaderImport(path) {
    return import(path);
}