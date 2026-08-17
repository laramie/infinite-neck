import * as TuningsLibrary from './TuningsLibrary.js';

export function createPerfect4thsCalculator(song){
        var baseID = 'Perfect4thsCalculator';
        var newBaseID = baseID+'_singleton';
        var divID = 'divPerfect4thsCalculator_singleton';

        // Find original tuning
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
        TuningsLibrary.reloadMyTuningsDisplay();
        TuningsLibrary.requestInstrumentAdded(cloned.baseID);
        TuningsLibrary.requestReinstallAllTuningsTables(cloned.baseID);
        makeDivDockable(divID); //global old-school javascript function on Window, installed by dockable.js (which also exports it).
        //TODO: wire this to 
    }