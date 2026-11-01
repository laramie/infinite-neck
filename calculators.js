import * as Constants from './Constants.js';
import * as TuningsLibrary from './TuningsLibrary.js';
import { buildFloatRectForTable } from './infinite-neck.js';

/** Creates (once) or re-shows a floating singleton "calculator" Tool table: a
 *  cloned instance of a library Tool tuning (e.g. Perfect4thsCalculator),
 *  wired via a Listener Wiring to a notesource algorithm (e.g.
 *  nsEveryNamedNote) so it always shows that notesource's notes, recolored
 *  for whatever Section is currently playing. Sibling calculators (e.g. a
 *  Perfect5thsCalculator) can reuse this by supplying their own baseID and
 *  notesourceID.
 *  Singleton: only ever one instance per baseID, named `${baseID}_singleton`.
 *  If already created (registered in myTunings), just re-floats its div;
 *  otherwise clones the tuning, registers it, wires it, and shows it. */
function createToolCalculatorSingleton(song, baseID, fromBaseID, notesourceID){
    var divID = Constants.TABLEDIV_ID_PREFIX + baseID;
    var tableID = Constants.TABLE_ID_PREFIX + baseID;

    if (!TuningsLibrary.findTuningForID(baseID)) {
        var original = TuningsLibrary.findTuningForID(fromBaseID);
        if (!original) {
            alert("Original tuning not found.");
            return;
        }

        var cloned = JSON.parse(JSON.stringify(original)); // Deep clone
        cloned.baseID = baseID;
        cloned.fromBaseID = fromBaseID;
        cloned.instance = true;
        delete cloned.visible;
        TuningsLibrary.getMyTuningsStore().push(cloned);
        song.setTableVisibilityByBaseID(cloned.baseID, true);
        song.addWiring(tableID, '', notesourceID);
        TuningsLibrary.reloadMyTuningsDisplay();
        TuningsLibrary.requestInstrumentAdded(cloned.baseID);
        TuningsLibrary.requestReinstallAllTuningsTables(cloned.baseID);
    }
    makeDivDockable(divID, null, buildFloatRectForTable(song, tableID)); //global old-school javascript function on Window, installed by dockable.js (which also exports it).
}

export function createPerfect4thsCalculator(song){
    createToolCalculatorSingleton(song, '4ths', '4thsCalculator', `${Constants.NOTESOURCE_ID_PREFIX}EveryNamedNote`);
}