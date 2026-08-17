import * as Constants from './Constants.js';
import * as TuningsLibrary from './TuningsLibrary.js';

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
function createToolCalculatorSingleton(song, baseID, notesourceID){
    var newBaseID = baseID + '_singleton';
    var divID = Constants.TABLEDIV_ID_PREFIX + newBaseID;
    var tableID = Constants.TABLE_ID_PREFIX + newBaseID;

    if (!TuningsLibrary.findTuningForID(newBaseID)) {
        var original = TuningsLibrary.findTuningForID(baseID);
        if (!original) {
            alert("Original tuning not found.");
            return;
        }

        var cloned = JSON.parse(JSON.stringify(original)); // Deep clone
        cloned.baseID = newBaseID;
        cloned.fromBaseID = baseID;
        cloned.instance = true;
        delete cloned.visible;
        TuningsLibrary.getMyTuningsStore().push(cloned);
        song.setTableVisibilityByBaseID(cloned.baseID, true);
        song.addWiring(tableID, '', notesourceID);
        TuningsLibrary.reloadMyTuningsDisplay();
        TuningsLibrary.requestInstrumentAdded(cloned.baseID);
        TuningsLibrary.requestReinstallAllTuningsTables(cloned.baseID);
    }
    makeDivDockable(divID); //global old-school javascript function on Window, installed by dockable.js (which also exports it).
}

export function createPerfect4thsCalculator(song){
    createToolCalculatorSingleton(song, 'Perfect4thsCalculator', `${Constants.NOTESOURCE_ID_PREFIX}EveryNamedNote`);
}