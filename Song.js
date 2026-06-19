import * as Constants from './Constants.js';
import EventBus from './event-bus.js';
import {
    GraveType
} from './graveyard.js';
import {
    getRecordedNotesForSection
} from './section-recorder.js';
import {
	toInt
} from './utils.js';
import { ANSIColors } from './bin/ANSIColors.js';
import { Section } from './Section.js';
import { SectionNotes } from './SectionNotes.js';
import { Wiring } from './Wiring.js';
import { DEFAULT_BEATS, RANDOM_SECTION_HISTORY_MAX } from './Constants.js';
import { SongPersistence } from './SongPersistence.js';


export class Song extends SongPersistence {
    constructor(obj) {
        super(obj, Section); 
        delete this.runtime;
        delete this.recording;
        Object.defineProperty(this, 'runtime', {
            value: {
                recording: false
            },
            enumerable: false,
            configurable: true,
            writable: true
        });
        // TODO:  deal with this: fixupCurrentIndexForLoadedSong 
    }

    isRecording(){
        return this.runtime?.recording === true;
    }

    setRecording(value){
        this.runtime.recording = value === true;
        return this.runtime.recording;
    }

    toggleRecording(){
        return this.setRecording(!this.isRecording());
    }

    resetRecording(){
        return this.setRecording(false);
    }

    getPersistentSongFile(){
        var text = JSON.stringify(this, SongPersistence.persistentSongFileReplacer, 2); 
        return text;
    }
    
    setHeadless(value, quiet = false) {
        this.isHeadless = value;
        if (this.isHeadless) {
            if (!quiet) console.log(ANSIColors.Bold + ANSIColors.cyan("Song running in Headless mode.  No $ or jQuery calls supported."));
            return;
        }
    }

    ensureNoteTablesLayout() {
        const seen = new Set();
        const normalized = [];
        const incoming = Array.isArray(this.noteTablesLayout) ? this.noteTablesLayout : [];

        incoming.forEach((entry) => {
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const tableID = `${entry.tableID || entry.tablename || ''}`.trim();
            if (!tableID || seen.has(tableID)) {
                return;
            }
            seen.add(tableID);
            normalized.push({ tableID, visible: entry.visible !== false });
        });

        this.noteTablesLayout = normalized;
        return this.noteTablesLayout;
    }

    getNoteTablesLayout() {
        return this.ensureNoteTablesLayout();
    }

    getNoteTablesLayoutMap() {
        const map = new Map();
        this.getNoteTablesLayout().forEach((entry) => {
            map.set(entry.tableID, entry.visible !== false);
        });
        return map;
    }

    setNoteTablesLayout(layout = []) {
        this.noteTablesLayout = Array.isArray(layout) ? layout : [];
        this.ensureNoteTablesLayout();
    }

    setTableVisibilityByBaseID(baseID, visible) {
        if (!baseID) {
            return;
        }
        const tableID = Constants.TABLE_ID_PREFIX + baseID;
        this.setTableVisibilityByTableID(tableID, visible);
    }

    setTableVisibilityByTableID(tableID, visible) {
        if (!tableID) {
            return;
        }
        const layout = this.getNoteTablesLayout();
        const idx = layout.findIndex((entry) => entry.tableID === tableID);
        if (idx >= 0) {
            layout[idx].visible = !!visible;
            return;
        }
        layout.push({ tableID, visible: !!visible });
    }

    isTableVisible(tableID) {
        const layout = this.getNoteTablesLayout();
        const match = layout.find((entry) => entry.tableID === tableID);
        return !!(match && match.visible !== false);
    }

    moveTableInLayoutByBaseID(baseID, direction) {
        const tableID = Constants.TABLE_ID_PREFIX + baseID;
        const layout = this.getNoteTablesLayout();
        const index = layout.findIndex((entry) => entry.tableID === tableID);
        if (index < 0) {
            return false;
        }
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= layout.length) {
            return false;
        }
        const [row] = layout.splice(index, 1);
        layout.splice(nextIndex, 0, row);
        return true;
    }

    removeTableFromLayoutByBaseID(baseID) {
        const tableID = Constants.TABLE_ID_PREFIX + baseID;
        this.noteTablesLayout = this.getNoteTablesLayout().filter((entry) => entry.tableID !== tableID);
    }

    getAllModelTableIDs() {
        const tableIDs = new Set();
        this.getNoteTablesLayout().forEach((entry) => {
            tableIDs.add(entry.tableID);
        });
        if (Array.isArray(this.myTunings)) {
            this.myTunings.forEach((tuning) => {
                if (tuning && tuning.baseID) {
                    tableIDs.add(Constants.TABLE_ID_PREFIX + tuning.baseID);
                }
            });
        }
        if (Array.isArray(this.sections)) {
            this.sections.forEach((section) => {
                if (!section || !section.sectionNotesByTable || typeof section.sectionNotesByTable !== 'object') {
                    return;
                }
                Object.keys(section.sectionNotesByTable).forEach((tableID) => tableIDs.add(tableID));
            });
        }
        if (Array.isArray(this.wirings)) {
            this.wirings.forEach((wiring) => {
                if (wiring?.tablename) {
                    tableIDs.add(wiring.tablename);
                }
                if (wiring?.listenToTablename) {
                    tableIDs.add(wiring.listenToTablename);
                }
            });
        }
        return Array.from(tableIDs);
    }

    getGhostTableIDs() {
        const layoutMap = this.getNoteTablesLayoutMap();
        return this.getAllModelTableIDs().filter((tableID) => !layoutMap.has(tableID));
    }
    
    getVisibleTunings(){
        return this.getNoteTablesLayout()
            .filter((entry) => entry.visible !== false)
            .map((entry) => entry.tableID);
    }

    getVisibleUnwiredTunings(){
        const visibleTableIDs = new Set(this.getVisibleTunings());
        const wiredDisplayTables = new Set((this.wirings || [])
            .map((wiring) => wiring?.tablename)
            .filter(Boolean));

        return this.getMyTunings().filter((tuning) => {
            if (!tuning || !tuning.baseID) {
                return false;
            }
            const tableID = Constants.TABLE_ID_PREFIX + tuning.baseID;
            return visibleTableIDs.has(tableID) && !wiredDisplayTables.has(tableID);
        });
    }

    getVisibleTuningIDs(){
        return this.getVisibleTunings()
            .filter((tableID) => tableID.startsWith(Constants.TABLE_ID_PREFIX))
            .map((tableID) => tableID.substring(Constants.TABLE_ID_PREFIX.length));
    }

    getMyTunings() {
        if (!Array.isArray(this.myTunings)) {
            this.myTunings = [];
        }
        return this.myTunings;
    }

    buildGhostTablesAuditText() {
        const tablePrefix = Constants.TABLE_ID_PREFIX || '';
        const allModelTableIDs = this.getAllModelTableIDs().slice().sort();
        const layoutTableIDs = this.getNoteTablesLayout()
            .map((entry) => entry.tableID)
            .filter((tableID) => !!tableID)
            .sort();
        const myTuningTableIDs = (Array.isArray(this.myTunings) ? this.myTunings : [])
            .map((tuning) => `${tablePrefix}${tuning?.baseID || ''}`)
            .filter((tableID) => tableID !== tablePrefix)
            .sort();
        const ghostTableIDs = this.getGhostTableIDs().slice().sort();

        return [
            'Ghost table audit (post-addTunings):',
            `All model tableIDs   ${String(allModelTableIDs.length).padStart(3, ' ')}: ${allModelTableIDs.length > 0 ? allModelTableIDs.join(', ') : '(none)'}`,
            `Layout/view tableIDs ${String(layoutTableIDs.length).padStart(3, ' ')}: ${layoutTableIDs.length > 0 ? layoutTableIDs.join(', ') : '(none)'}`,
            `myTunings tableIDs   ${String(myTuningTableIDs.length).padStart(3, ' ')}: ${myTuningTableIDs.length > 0 ? myTuningTableIDs.join(', ') : '(none)'}`,
            `Tables without matching views (${ghostTableIDs.length}): ${ghostTableIDs.length > 0 ? ghostTableIDs.join(', ') : '(none)'}`
        ].join('\n');
    }

    addTunings(newTunings){
        if (!Array.isArray(this.myTunings)) {
            this.myTunings = [];
        }
        if (!Array.isArray(newTunings) || newTunings.length === 0) {
            return;
        }

        const tuningKeyFields = ['fromBaseID', 'baseInstrument', 'nStrings', 'rowRange', 'reverse'];
        const noCollisionImported = [];
        const detailLines = [];
        let suffixIndex = 1;
        let sawCollision = false;

        const stringifyTuning = (tuning) => JSON.stringify(tuning, null, 4);
        const cloneTuning = (tuning) => JSON.parse(JSON.stringify(tuning));
        const buildKeyPayload = (tuning) => ({
            // baseID is runtime/generated; lineage identity is fromBaseID.
            // Fallback preserves compatibility with older songs missing fromBaseID.
            fromBaseID: tuning?.fromBaseID || tuning?.baseID,
            baseInstrument: tuning?.baseInstrument,
            nStrings: tuning?.nStrings,
            rowRange: tuning?.rowRange,
            reverse: tuning?.reverse
        });
        const isDuplicateByKeyFields = (left, right) => {
            const leftPayload = buildKeyPayload(left);
            const rightPayload = buildKeyPayload(right);
            return JSON.stringify(leftPayload) === JSON.stringify(rightPayload);
        };

        newTunings.forEach((rawNewTuning, incomingIndex) => {
            if (!rawNewTuning || typeof rawNewTuning !== 'object') {
                detailLines.push(`Skipped incoming tuning at index ${incomingIndex}: not an object.`);
                return;
            }

            const incomingBaseID = `${rawNewTuning.baseID || ''}`.trim();
            if (!incomingBaseID) {
                detailLines.push(`Skipped incoming tuning at index ${incomingIndex}: missing baseID.`);
                return;
            }

            const newTuning = cloneTuning(rawNewTuning);
            newTuning.baseID = incomingBaseID;

            const existing = this.myTunings.find((t) => t && t.baseID === incomingBaseID);
            if (!existing) {
                this.myTunings.push(newTuning);
                this.setTableVisibilityByBaseID(newTuning.baseID, true);
                noCollisionImported.push(newTuning.baseID);
                return;
            }

            sawCollision = true;

            if (isDuplicateByKeyFields(existing, newTuning)) {
                detailLines.push([
                    `Duplicate-by-key-fields detected and dropped:`,
                    `Key fields used: ${tuningKeyFields.join(', ')}`,
                    `Existing tuning caption: ${existing.caption || '(no caption)'}`,
                    `Incoming tuning caption: ${newTuning.caption || '(no caption)'}`,
                    'Existing tuning JSON:',
                    stringifyTuning(existing),
                    'Incoming tuning JSON:',
                    stringifyTuning(newTuning),
                    'Result: incoming tuning dropped.'
                ].join('\n'));
                return;
            }

            const oldID = newTuning.baseID;
            let candidateID = `${oldID}_s${suffixIndex}`;
            while (this.myTunings.some((t) => t && t.baseID === candidateID)) {
                suffixIndex += 1;
                candidateID = `${oldID}_s${suffixIndex}`;
            }

            newTuning.baseID = candidateID;
            this.myTunings.push(newTuning);
            this.setTableVisibilityByBaseID(newTuning.baseID, true);
            detailLines.push([
                `Collision resolved with new ID:`,
                `Caption: ${newTuning.caption || '(no caption)'}`,
                `Old ID: ${oldID}`,
                `New ID: ${newTuning.baseID}`,
                'Imported tuning JSON:',
                stringifyTuning(newTuning)
            ].join('\n'));
            suffixIndex += 1;
        });

        const summaryLines = [];
        if (noCollisionImported.length > 0) {
            summaryLines.push('Imported with no ID collisions (IDs did not already exist in song):');
            summaryLines.push(noCollisionImported.map((id) => `- ${id}`).join('\n'));
        }
        if (!sawCollision && noCollisionImported.length === 0 && detailLines.length === 0) {
            summaryLines.push('No tunings were imported.');
        }

        const reportParts = [];
        if (summaryLines.length > 0) {
            reportParts.push(summaryLines.join('\n'));
        }
        if (detailLines.length > 0) {
            reportParts.push(detailLines.join('\n\n'));
        }
        reportParts.push(this.buildGhostTablesAuditText());

        const reportBody = reportParts.join('\n\n');
        EventBus.trigger('ShowMessages', { html: `<pre>${reportBody}</pre>` });
    }

    addWiring(tablename, relativeSection, listenToTablename, listenerProjection = 'row-midi') {
        const idx = this.wirings.findIndex(w => w.tablename === tablename);
        const newWiring = new Wiring({ tablename:tablename, 
                                       relativeSection:relativeSection, 
                                       listenToTablename:listenToTablename,
                                       listenerProjection: listenerProjection || 'row-midi'});
        if (idx === -1) {
            this.wirings.push(newWiring);
        } else {
            this.wirings[idx] = newWiring;
        }
        EventBus.trigger("Wiring:added", {
            tablename: tablename,
            listenToTablename: listenToTablename,
            relativeSection: relativeSection,
            listenerProjection: newWiring.listenerProjection
        });
    }

    removeWiring(tablename){
        this.wirings = this.wirings.filter(w => w.tablename !== tablename);
        EventBus.trigger("Wiring:removed", {tablename:tablename});
    }

    fixupCurrentIndexForLoadedSong() {
        var sci = this.gSectionsCurrentIndex;
        if (this.gSectionsCurrentIndex >= this.sections.length) {
            this.gSectionsCurrentIndex = this.sections.length - 1;
            console.warn("gSong::fixupCurrentIndexForLoadedSong() found that the song gSectionsCurrentIndex was out of range: " + sci + " resetting to : " + this.gSectionsCurrentIndex);
        }
        if (this.gSectionsCurrentIndex < 0) {
            this.gSectionsCurrentIndex = 0;
            console.warn("gSong::fixupCurrentIndexForLoadedSong() found that the song gSectionsCurrentIndex was out of range: " + sci);
        }
    }

    getCurrentSection() {
        const section = this.sections[this.gSectionsCurrentIndex];
        return section;
    }

    // ==========  Utility methods ==========

    //has to be a method because it uses Section key and sharps/flats.
    noteIDToNoteName(noteIndex) {
        return this.getCurrentSection().noteIDToDisplayName(noteIndex);
    }
    

    // =========== wrapping ==================

    test_getRelativeSectionWithWrap(consoleLog = false){
        const testResult = {
            warnings: [],
            infos: [],
            terse: []
        };

        const test = (sAmount) => {
            allSections.forEach((section, idx) => {
                this.gotoSection(idx);
                let resultSection = this.getRelativeSectionWithWrap(sAmount, testResult.warnings);
                let resultIdx = this.sections.indexOf(resultSection);
                let message = "test-relative: sections[" + idx + "] by   "
                               + String(sAmount).padStart(4, ' ')  
                               + " ==> sections["+resultIdx+"] ::"
                               +" key:" + String(Constants.noteIDToNoteNameRaw(resultSection.rootID)).padEnd(3, ' ') 
                               + " caption:" + resultSection.caption;
                let terseMessage = "[" + idx + "] " + String(sAmount).padStart(4, ' ')  + " ==> ["+resultIdx+"]"              
                if (consoleLog) {
                    console.log(message);
                }
                testResult.terse.push(terseMessage);
                testResult.infos.push(message);
            });
        }
        let allSections = this.getSections();
        testResult.infos.push("This song has "+allSections.length+" sections.  Tests will be applied to each.");
        test("-2");
        test("-1");
        test("-0");
        test("0");
        test("1");
        test("2");
        test("3");
        test("+0");
        test("+1");
        test("+2");
        test("+3");
        test("@2");
        test("@1");
        test("@0");
        test("@-0");
        test("@-1");
        test("^0");
        test("^1");
        test("^2");
        test("^-1");
        test("^+1");
        test("&-1");
        test("&-0");
        test("&0");
        test("&1");
        test("&2");
        test("&3");
        test("&4");
        test("&-1");
        test("&+1");
        test("foo");
        test("+foo");
        test("-foo");
        test("+");
        test("-");
        test("");
        return testResult;
    }


    static DirectionType = Object.freeze({
        FORWARD:         '+',
        BACKWARD:        '-',
        OTHER:           'O',
        EMPTY:           'E'
    });

    static Direction = Object.freeze({
        FORWARD:         '+',
        BACKWARD:        '-',
        ABSOLUTE:        'A',
        PREVIOUS_PLAYED: '@',  // legal values for full string: "@-2" or "@2" or "@+2"
        BACKWARD_NOWRAP: '^',  // legal values: ^1 ^2  go backwards.  No minus sign.
        FORWARD_NOWRAP:  '&',  // legal value: &1 &2 go forwards. No minus signs.
        BAD_INPUT:       'X',
        EMPTY:           'E'
    });

    getRelativeSectionDirection(sAmount){
        let result = this.getRelativeSectionWithWrapAndDirection(sAmount)
        switch (result.direction){
            case Song.Direction.FORWARD:         
            case Song.Direction.FORWARD_NOWRAP:  
                return Song.DirectionType.FORWARD;
            case Song.Direction.BACKWARD:        
            case Song.Direction.PREVIOUS_PLAYED: 
            case Song.Direction.BACKWARD_NOWRAP: 
                return Song.DirectionType.BACKWARD;
            case Song.Direction.EMPTY: 
                return Song.DirectionType.EMPTY;
            case Song.Direction.ABSOLUTE:        
            case Song.Direction.BAD_INPUT:       
                return Song.DirectionType.OTHER;
            default:
                return Song.DirectionType.OTHER;
        }
    }

    /*   Support
     *   +3   3 sections ahead, with wrap
     *   -3   3 sections back, with wrap
     *   -1   previous section, with wrap
     *   +1   next section, with wrap
     *   -0   current section
     *   +0   current section
     *    0   first section
     *    1   Section 1 absolute (there always must be one section)
     *    2   Section 2 absolute, or last if num too large
     *    @1  Last section played in Random mode
     *    @2  Two sections ago played in Random mode
     *    ^1  previous section, no wrap, just go as early as you can, max is Section 1
     *    ^-1 ignore sign, just do ^1
     *    ^+1 ignore sign, just do ^1
     *    ^2  2 sections back, no wrap, just go as early as you can, max is Section 1
     *    &1  1 section ahead, no wrap, max is last Section
     *    &2  2 sections ahead, no wrap, max is last Section
     *    &-2 ignore sign, just do &2
     *    &+2 ignore sign, just do &2
     * 
     *    Negative signs after the first character are ignored, so @-1 is the same as @1, and --1 is the same as -1.
     *     So you can go "back" with -1 or ^1 or @1, and --1, ^-1, and @-1 are identical, respectively.
    */

    getRelativeSectionWithWrap(sAmount, logCollector = null) {
        let result = this.getRelativeSectionWithWrapAndDirection(sAmount, logCollector);
        return result.section;
    }

    getRelativeSectionWithWrapAndDirection(sAmount, logCollector = null) {
        if (sAmount && sAmount[0]){
    
            // Special case: "0" means first section
            if (sAmount === "0") {
                return { section: this.sections[0], direction: Song.Direction.ABSOLUTE };
            }
            // Special case: "+0" or "-0" means current section
            if (sAmount === "+0" || sAmount === "-0") {
                return { section: this.sections[this.gSectionsCurrentIndex], direction: Song.Direction.ABSOLUTE };
            }
            // Extract firstChar if present
            const match = sAmount.match(/^([+\-@^&])([-+]?\d+)/);
            let firstChar = null;
            let intNum = 0;
            let isnum = false;
            if (match) {
                firstChar = match[1];
                // Try to parse the integer part
                intNum = Math.abs(parseInt(match[2], 10));
                isnum = /^[-+]?\d+$/.test(match[2]);
                if (!isnum){
                    firstChar = Song.Direction.BAD_INPUT;
                }
            } else {
                // If no special char, check for pure integer
                if (/^[-+]?\d+$/.test(sAmount)) {
                    firstChar = Song.Direction.ABSOLUTE;
                    intNum = Math.abs(parseInt(sAmount, 10));  //deal with the illegal --2.
                    isnum = true;
                } else {
                    // Malformed input: neither special char nor integer
                    firstChar = Song.Direction.BAD_INPUT;
                    intNum = 0;
                    isnum = false;
                    const msg = "Malformed section amount: " + sAmount;
                    if (logCollector) {
                        logCollector.push(msg);
                    } else {
                        console.warn(msg);
                    }
                }
            }
    
            var currentIndex = this.gSectionsCurrentIndex;
            function wrap(oneBasedDistance, sectionsArray, currentZeroBasedIndex){
                const n = sectionsArray.length;
                const wrappedIndex = ((currentZeroBasedIndex + oneBasedDistance) % n + n) % n;
                return wrappedIndex;
            }
    
            if (intNum === 0){
                firstChar = Song.Direction.BAD_INPUT;
            }
    
            if ((firstChar === Song.Direction.FORWARD || firstChar === Song.Direction.BACKWARD) && intNum === 0) {
                firstChar = Song.Direction.ABSOLUTE;
                intNum = 1;
            }
    
            switch (firstChar){
                case Song.Direction.BAD_INPUT:
                    return { section: this.sections[currentIndex], direction: Song.Direction.BAD_INPUT };
                case Song.Direction.EMPTY:
                    return { section: this.sections[currentIndex], direction: Song.Direction.EMPTY };
                case Song.Direction.ABSOLUTE: //(number only, goto num or max)
                    if (intNum < 1) {
                        return { section: this.sections[0], direction: Song.Direction.ABSOLUTE };
                    }
                    if (intNum > this.sections.length){
                        return { section: this.sections[this.sections.length-1], direction: Song.Direction.ABSOLUTE };
                    }
                    return { section: this.sections[intNum-1], direction: Song.Direction.ABSOLUTE };
                case Song.Direction.PREVIOUS_PLAYED:  //(@) sections back in random-play history
                    if (intNum < 1) {
                        return { section: this.sections[currentIndex], direction: Song.Direction.PREVIOUS_PLAYED };
                    }
                    return { section: this.sections[this.getPreviousPlayedSectionIndex(intNum, currentIndex)], direction: Song.Direction.PREVIOUS_PLAYED };
                case Song.Direction.FORWARD: // (+)
                    var wrappedIndex = wrap(intNum, this.sections, currentIndex);
                    return { section: this.sections[wrappedIndex], direction: Song.Direction.FORWARD };
                case Song.Direction.BACKWARD: //(-)
                    var wrappedIndex = wrap( -1 * intNum, this.sections, currentIndex);
                    return { section: this.sections[wrappedIndex], direction: Song.Direction.BACKWARD };
                case Song.Direction.BACKWARD_NOWRAP:  //(^)
                    return { section: this.sections[Math.max(0, (currentIndex - Math.abs(intNum)))], direction: Song.Direction.BACKWARD_NOWRAP };
                case Song.Direction.FORWARD_NOWRAP:   //(&)
                    var idx = (currentIndex + Math.abs(intNum))
                    var maxidx = this.sections.length-1;
                    return { section: this.sections[(idx > maxidx) ? maxidx : idx], direction: Song.Direction.FORWARD_NOWRAP };
            }
        } else {
            // If sAmount is empty or falsy, return current section with EMPTY direction
            return { section: this.getCurrentSection(), direction: Song.Direction.EMPTY };
        }
    }


    pushRandomSectionHistory(idx){
        if (!Array.isArray(this.randomSectionHistory)){
            this.randomSectionHistory = [];
        }
        if (!Number.isInteger(idx)){
            return;
        }
        if (idx < 0 || idx >= this.sections.length){
            return;
        }
        this.randomSectionHistory.push(idx);
        if (this.randomSectionHistory.length > RANDOM_SECTION_HISTORY_MAX){
            this.randomSectionHistory.splice(0, this.randomSectionHistory.length - RANDOM_SECTION_HISTORY_MAX);
        }
    }

    getPreviousPlayedSectionIndex(nBack, fallbackIndex){
        if (!Array.isArray(this.randomSectionHistory) || this.randomSectionHistory.length === 0){
            return fallbackIndex;
        }
        const safeBack = Math.max(1, Math.abs(toInt(nBack, 1)));
        const historyPos = Math.max(0, this.randomSectionHistory.length - safeBack);
        const idx = this.randomSectionHistory[historyPos];
        if (!Number.isInteger(idx) || idx < 0 || idx >= this.sections.length){
            return fallbackIndex;
        }
        return idx;
    }

    getRelativeSectionIndexWithWrap(sAmount, logCollector = null) {
        const section = this.getRelativeSectionWithWrap(sAmount, logCollector);
        return this.sections.indexOf(section);
    }

    getRelativeSectionIndicesWithWrap(relativeSectionSpecs, logCollector = null) {
        if (!Array.isArray(relativeSectionSpecs)) {
            return [];
        }
        return relativeSectionSpecs.map(spec => this.getRelativeSectionIndexWithWrap(spec, logCollector));
    }

    getSectionsCurrentIndex(){
        return this.gSectionsCurrentIndex;
    }

    static assertAllSectionNotesAreInstances(section) {
        Object.entries(section.sectionNotesByTable).forEach(([tableID, sn]) => {
            if (!(sn instanceof SectionNotes)) {
                console.error(`sectionNotesByTable[${tableID}] is not a SectionNotes instance!`, sn);
            }
        });
    }

    constructSection(){
        let theSection = new Section();
        theSection.rootID = this.rootID;
        theSection.sharps = this.sharps;
        theSection.beats = DEFAULT_BEATS;
        return theSection;
    }

	getDefaultTableID() {
        const visibleTableIDs = this.getVisibleTunings();
        if (visibleTableIDs.length > 0) {
            return visibleTableIDs[0];
		}
		const firstTuning = Array.isArray(this.myTunings) ? this.myTunings[0] : null;
		if (firstTuning?.baseID) {
			return Constants.TABLE_ID_PREFIX + firstTuning.baseID;
		}
		return undefined;
	}

    removeAllSections(){
        this.sections = [];
        this.addSection(this.constructSection());
    }

    ensureDefaultSection(){
        this.sections = this.sections || [];
        if (this.getSections().length === 0){
            this.addSection(this.constructSection());
        }
    }


	addSection(section){
        section = section;
	    var newIndex = this.sections.push(section) - 1;
	    this.gSectionsCurrentIndex = newIndex;
	    if (!this.constructing) this.publish_UpdateSectionStatus();
	    return newIndex;
	    // sections is an array of gNotesPlayed objects. push() returns length.
	}
	addSectionAfterCurrent(section){
        section = section;
        if (this.sections.length == 0){
            this.sections.push(section);
            this.gSectionsCurrentIndex = 0;
        } else {
    		var deleteCount=0;
    		var start = this.gSectionsCurrentIndex+1;
    	    var newIndex = this.sections.splice(start, deleteCount, section);
            this.gSectionsCurrentIndex = this.gSectionsCurrentIndex+1;
        }
        this.requestUiFullRepaint();
	    this.publish_UpdateSectionStatus();
	    return this.gSectionsCurrentIndex;
	    // sections is an array of gNotesPlayed objects.
	}
	getSections(){
	    return this.sections;
	}

    //these two return an html string that is either sharps or flats, depending on section.
    getRootKey(){
        return this.getCurrentSection().getRootKey();
    }
    getRootKeyLead(){
        return this.getCurrentSection().getRootKeyLead();
    }

    //these two return a simple noteName, one of [A, Bb, B, C, Db, ...etc.]
    getRootNoteName(){
        return this.getCurrentSection().getRootNoteName();
    }
    getLeadNoteName(){
        return this.getCurrentSection().getLeadNoteName();
    }

	getBeat(){
        return this.getCurrentSection().getBeat();
	}
	incBeat(){
        return this.getCurrentSection().incBeat(DEFAULT_BEATS);
	}
	incBeatLoop(){
        return this.getCurrentSection().incBeatLoop(DEFAULT_BEATS);
	}
	decBeat(){
        return this.getCurrentSection().decBeat(DEFAULT_BEATS);
	}

	getBeats(){
        var curr = this.getCurrentSection();
        if (!curr){
			console.warn("this.getCurrentSection() returned undefined in song.getBeats().");
            return DEFAULT_BEATS;
        }
        return curr.getBeats(DEFAULT_BEATS);
	}
	setBeats(newValue){
        this.getCurrentSection().setBeats(newValue);
	}

    addBeat(){
        this.setBeats(this.getBeats() + 1);
        this.publish_UpdateSectionStatus();
        this.requestUiUpdatePrintSections();
        this.requestUiFullRepaint();
        this.requestUiShowBeats();
    }


	gotoFirstBeat(){
        this.getCurrentSection().gotoFirstBeat();
	    this.gFirstBeatSeen = false;
	}

    gotoLastBeat(){
        this.getCurrentSection().gotoLastBeat();
    }

    gotoBeat(oneBasedIndex){
        this.getCurrentSection().gotoBeat(oneBasedIndex);
    }

    gotoLastBeatInSong(){
        this.lastSection();
        this.gotoLastBeat();
    }

    moveBeatsLaterForTable(tableID, beatCount, oneBasedIndex){
        var result = {};
        var notes = getRecordedNotesForSection(tableID);
        var insertIndex = toInt(oneBasedIndex, 1);
        if (insertIndex < 1){
            insertIndex = 1;
        }
        if (insertIndex > beatCount + 1){
            insertIndex = beatCount + 1;
        }
        for (var i=1; i<insertIndex; i++){
            result[""+i] = notes[""+i];
        }
        for (var i=beatCount; i>=insertIndex; i--){
            result[""+(i+1)] = notes[""+i];
        }
        result[""+insertIndex] = [];
        this.getCurrentSection().getSectionNotes(tableID).recordedNotes = result;
    }

    insertBeatsAtCurrentSection(oneBasedIndex, insertCount = 1){
        const section = this.getCurrentSection();
        const beatCount = this.getBeats();
        let insertIndex = toInt(oneBasedIndex, 1);
        const count = toInt(insertCount, 0);
        if (!section || count < 1) {
            return {
                inserted: 0,
                startBeat: insertIndex
            };
        }
        if (insertIndex < 1){
            insertIndex = 1;
        }
        if (insertIndex > beatCount + 1){
            insertIndex = beatCount + 1;
        }

        section.getAllSectionNotes().forEach(([, sn]) => {
            const notes = sn.recordedNotes || {};
            const result = {};
            for (let i = 1; i < insertIndex; i += 1){
                result[`${i}`] = notes[`${i}`];
            }
            for (let i = 0; i < count; i += 1){
                result[`${insertIndex + i}`] = [];
            }
            for (let i = insertIndex; i <= beatCount; i += 1){
                result[`${i + count}`] = notes[`${i}`];
            }
            sn.recordedNotes = result;
        });

        this.setBeats(beatCount + count);
        this.gotoBeat(insertIndex);
        this.publish_UpdateSectionStatus();
        this.requestUiUpdatePrintSections();
        this.requestUiFullRepaint();
        this.requestUiShowBeats();
        return {
            inserted: count,
            startBeat: insertIndex
        };
    }

	moveBeatsLater(oneBasedIndex){
        var beatCount = this.getBeats();
        var insertIndex = toInt(oneBasedIndex, 1);
        if (insertIndex < 1){
            insertIndex = 1;
        }
        if (insertIndex > beatCount + 1){
            insertIndex = beatCount + 1;
        }
        let allTablesInSection = this.getCurrentSection().getAllSectionNotes();
        allTablesInSection.forEach(([tableID, sn]) => {
            this.moveBeatsLaterForTable(tableID, beatCount, insertIndex);
        });
		this.setBeats(beatCount+1);
    	this.gotoBeat(insertIndex);
		this.publish_UpdateSectionStatus();
        this.requestUiUpdatePrintSections();
		this.requestUiFullRepaint();
        this.requestUiShowBeats();
	}
    insertFirstBeat(){
        this.moveBeatsLater(1);
    }
    insertBeat(oneBasedIndex){
        this.moveBeatsLater(oneBasedIndex);
    }

    shuffleRecordedBeatsDown(recordedBeats, nBeats, nStartBeat){
  	  for (var curr=nStartBeat; curr<=nBeats; curr++){
  		if (recordedBeats[curr]){
  			delete recordedBeats[curr];
          }
  		if ( (curr+1 <= nBeats) && recordedBeats[curr+1] ){
  			recordedBeats[curr]=recordedBeats[curr+1];
  		}
  	  }
  	  return recordedBeats;
    }

    deleteBeat() {
        var nStartBeat = this.getBeat();
        var nBeats = this.getBeats();
        if (nBeats <= 1) {
            console.warn("Can't delete beat #1. returning.");
            return;
        }
        // For each table in sectionNotesByTable:
        let allTablesInSection = this.getCurrentSection().getAllSectionNotes();
        allTablesInSection.forEach(([tableID, sn]) => {
            if (sn.recordedNotes) {
                sn.recordedNotes = this.shuffleRecordedBeatsDown(sn.recordedNotes, nBeats, nStartBeat);
            }
        });
        this.setBeats(nBeats - 1);
        var currBeat = nStartBeat > this.getBeats() ? this.getBeats() : nStartBeat;
        this.getCurrentSection().currentBeat = currBeat;
        this.publish_UpdateSectionStatus();
		this.requestUiUpdatePrintSections();
        this.requestUiShowBeats();
    }

    prevBeat(){
  	  this.prevNextBeat(false);
    }

    nextBeat(){
  	  this.prevNextBeat(true);
    }

    prevNextBeat(isNext){
			this.requestUiClearHighlights();
  	        var beat  = this.getBeat();
  	        var beats = this.getBeats();

            if (isNext){
  	            if (beat < beats){
  	               this.incBeat();
  	            }
  	        } else {
  	            if (beat > 1){
  	               this.decBeat();
  	            }
  	        }
            this.publish_UpdateSectionStatus();
            this.requestUiShowBeats();
    }


    //============== NOTE: Keep all new EventBus handling code between these comments, ending in END-TODO:EventBus =====================================
    
    publish_SectionChanged(data = {}){
        var song = this || obj;
        if (song.isHeadless){
            return;
        }
        //sectionChanged(); //TODO:EventBus: call this throught the EventBus
        EventBus.trigger('SectionChanged', { ...data, sectionIndex: song.getSectionsCurrentIndex() });
    }      

    // replacement for direct calls to infinite-neck.js :: updateSectionsStatus();
    publish_UpdateSectionStatus(){
        var song = this || obj;
        if (song.isHeadless){
            return;
        }
        //updateSectionsStatus();  // TODO:EventBus:  call this through the EventBus instead.
        EventBus.trigger('UpdateSectionStatus', { sectionIndex: song.getSectionsCurrentIndex() });
    }

    //Not handled at all yet:
    publish_SectionMoved(){
        var song = this || obj;
        EventBus.trigger('SectionMoved', { sectionIndex: song.getSectionsCurrentIndex() });
    }

    //============== END-TODO:EventBus =====================================

    
    
    //============== Section handling =====================================

    firstSectionStateOnly(){
        this.gSectionsCurrentIndex = 0;
    }

	firstSection(){
        this.firstSectionStateOnly();
        this.publish_SectionChanged();
	}

    lastSectionStateOnly() {
        this.gSectionsCurrentIndex = this.sections.length-1;
    }

	lastSection() {
         this.lastSectionStateOnly();
         this.publish_SectionChanged();
	}

    prevSectionStateOnly(){
        if (this.gSectionsCurrentIndex > 0){
            this.gSectionsCurrentIndex--;
        }
    }

	prevSection(){
        this.prevSectionStateOnly();
        this.publish_SectionChanged();
	}

    nextSectionStateOnly(){
        if (this.gSectionsCurrentIndex < (this.sections.length-1)){
            this.gSectionsCurrentIndex++;
        }
    }

	nextSection(){
        this.nextSectionStateOnly();
        this.publish_SectionChanged();
	}

    gotoSectionStateOnly(idx){
        var sectionIdx = toInt(idx, -1);
        if (sectionIdx > -1 && sectionIdx < this.sections.length){
            this.gSectionsCurrentIndex = sectionIdx;
            return true;
        }
        console.warn("############### bad sectionIdx:"+sectionIdx+" gotoSection("+idx+") len:"+this.sections.length);
        return false;
    }

    gotoSection(idx){
        const previousSectionIndex = this.getSectionsCurrentIndex();
        if (this.gotoSectionStateOnly(idx)){
            if (!this.isHeadless){
                this.publish_SectionChanged({
                    previousSectionIndex,
                    reason: 'goto',
                    source: 'song'
                });
            }
        }
    }

    gotoNextSectionStateOnly(orGotoFirst){
        var isRandom = this.randomLoop == true;
        if (isRandom) {
            var prevSectionIdx = this.gSectionsCurrentIndex;
            var rand = Math.random();
            var randSection = Math.floor(rand*this.sections.length);
            if (randSection == this.gSectionsCurrentIndex){
                for (var r = 0; r<10; r++){
                    rand = Math.random();
                    randSection = Math.floor(rand*this.sections.length);
                    if (randSection != this.gSectionsCurrentIndex){
                        break;
                    }
                }
            }
            this.pushRandomSectionHistory(prevSectionIdx);
            this.gSectionsCurrentIndex = randSection;
        } else if (this.getSectionsCurrentIndex()+1 >= this.sections.length){
            if( orGotoFirst ) this.firstSectionStateOnly();
        } else {
            this.nextSectionStateOnly();
        }
    }

    gotoNextSection(orGotoFirst){
        const previousSectionIndex = this.getSectionsCurrentIndex();
        this.gotoNextSectionStateOnly(orGotoFirst);
        this.publish_SectionChanged({
            previousSectionIndex,
            reason: 'next',
            source: 'song'
        });
	}

    gotoPrevSectionStateOnly(orGotoLast){
        if (this.getSectionsCurrentIndex()==0){
            if( orGotoLast ) this.lastSectionStateOnly();
        } else {
            this.prevSectionStateOnly();
        }
    }

	gotoPrevSection(orGotoLast){
        const previousSectionIndex = this.getSectionsCurrentIndex();
        this.gotoPrevSectionStateOnly(orGotoLast);
        this.publish_SectionChanged({
            previousSectionIndex,
            reason: 'prev',
            source: 'song'
        });
	}

    insertSectionAtDest(aSection, destIndex){
        if (destIndex == "END"){
            this.sections.push(aSection);
            this.gSectionsCurrentIndex = this.sections.length-1;
        } else if (destIndex == "BEGIN"){
            this.sections.splice(0, 0, aSection);  //insert BEFORE first current.
            this.gSectionsCurrentIndex = 0;
        } else {
            var iDest = toInt(destIndex, -1);
            if (iDest<=-1){
                alert("bad index in addCloneSection: "+destIndex);
                this.addSectionAfterCurrent(aSection);
            } else {
                iDest = iDest + 1; //insert AFTER named section.
                this.sections.splice(iDest, 0, aSection);
                if (iDest >= this.sections.length){
                    this.gSectionsCurrentIndex = this.sections.length - 1;
                } else {
                    this.gSectionsCurrentIndex = iDest;
                }
            }
        }
    }

	newSection(destIndex){
	    var aSection = this.constructSection();
	    if (destIndex){
            this.insertSectionAtDest(aSection, destIndex);
        } else {
            this.addSectionAfterCurrent(aSection);
        }
        this.requestUiClearAll();
	    this.gotoFirstBeat();
	    this.publish_SectionChanged();//updateSectionsStatus();
	}

	addShallowCloneSection(destIndex){
	    return this.addCloneSection(false, destIndex);
	}
	addDeepCloneSection(destIndex){
	    return this.addCloneSection(true, destIndex);
	}

    sectionNotesHasNotes(sectionNotes){
        if (!sectionNotes || typeof sectionNotes !== 'object') {
            return false;
        }

        const playedCount = (sectionNotes.playedNotes || [])
            .filter((note) => note && (typeof note !== 'object' || Object.keys(note).length > 0))
            .length;
        const namedCount = Object.values(sectionNotes.namedNotes || {})
            .filter((note) => note && (typeof note !== 'object' || Object.keys(note).length > 0))
            .length;
        const recordedCount = Object.values(sectionNotes.recordedNotes || {})
            .reduce((total, notes) => {
                if (!Array.isArray(notes)) {
                    return total;
                }
                return total + notes.filter((note) => note && (typeof note !== 'object' || Object.keys(note).length > 0)).length;
            }, 0);

        return playedCount + namedCount + recordedCount > 0;
    }

    addCloneSectionForTable(tableID){
        const sourceSection = this.getCurrentSection();
        const sourceSectionNotes = sourceSection?.sectionNotesByTable?.[tableID];
        if (!this.sectionNotesHasNotes(sourceSectionNotes)) {
            return {
                cloned: false,
                reason: `no notes for ${tableID || 'selected instrument'}`
            };
        }

        const aSection = sourceSection.clone(true);
        Object.keys(aSection.sectionNotesByTable || {}).forEach((candidateTableID) => {
            if (candidateTableID !== tableID) {
                delete aSection.sectionNotesByTable[candidateTableID];
            }
        });
        this.addSectionAfterCurrent(aSection);
        this.requestUiClearAll();
        this.requestUiResetNoteNames();
        this.publish_SectionChanged();
        return {
            cloned: true,
            section: aSection
        };
    }

    insertCloneTableIntoSection(tableID, oneBasedSectionNumber){
        const sourceSection = this.getCurrentSection();
        const sourceIndex = this.getSections().indexOf(sourceSection);
        const destIndex = toInt(oneBasedSectionNumber, -1) - 1;
        if (destIndex < 0 || destIndex >= this.sections.length) {
            return {
                inserted: false,
                reason: `Section ${oneBasedSectionNumber} not found`
            };
        }
        if (destIndex === sourceIndex) {
            return {
                inserted: false,
                reason: `Section ${oneBasedSectionNumber} is current`
            };
        }

        const sourceSectionNotes = sourceSection?.sectionNotesByTable?.[tableID];
        if (!this.sectionNotesHasNotes(sourceSectionNotes)) {
            return {
                inserted: false,
                reason: `no notes for ${tableID || 'selected instrument'}`
            };
        }

        const destSection = this.sections[destIndex];
        const destSectionNotes = destSection?.sectionNotesByTable?.[tableID];
        if (this.sectionNotesHasNotes(destSectionNotes)) {
            return {
                inserted: false,
                reason: `${tableID} not empty in Section ${oneBasedSectionNumber}`
            };
        }

        destSection.sectionNotesByTable = destSection.sectionNotesByTable || {};
        destSection.sectionNotesByTable[tableID] = new SectionNotes(JSON.parse(JSON.stringify(sourceSectionNotes)));
        this.requestUiClearAll();
        this.requestUiResetNoteNames();
        this.publish_SectionChanged();
        return {
            inserted: true,
            section: destSection
        };
    }

	clearCurrentSectionTable(tableID){
        const section = this.getCurrentSection();
        if (!section || !section.sectionNotesByTable || !Object.prototype.hasOwnProperty.call(section.sectionNotesByTable, tableID)) {
            return {
                cleared: false,
                reason: `no table data for ${tableID || 'selected instrument'}`
            };
        }

        const context = {
            "SectionIndex": this.getSections().indexOf(section),
            "caption": section.caption,
            "tableID": tableID,
            "action": "clearCurrentSectionTable"
        };
        this.graveyard.bury(GraveType.SECTION, section, context);
        delete section.sectionNotesByTable[tableID];
        this.requestUiClearAll();
        this.requestUiReplay();
        this.publish_SectionChanged();
        return {
            cleared: true
        };
	}

	addCloneSection(deep, destIndex){
        var aSection = this.getCurrentSection().clone(deep);
        if (destIndex){
            this.insertSectionAtDest(aSection, destIndex);
        } else {
    		this.addSectionAfterCurrent(aSection);
        }
        this.requestUiClearAll();
        this.requestUiResetNoteNames();//calls replay
	    //updateSectionsStatus();
        this.publish_SectionChanged();//calls updateSectionsStatus...TODO might be one too many calls in this chain--could cleanup for efficiency
	    return aSection;
	}

	deleteCurrentSection(){
	    var obj = this.getCurrentSection();
        var context = {"SectionIndex": this.getSections().indexOf(obj),
                       "caption": obj.caption
                      };
        this.graveyard.bury(GraveType.SECTION, obj, context);

        if (this.sections.length<=1){
            console.warn("Can't remove only section. Clearing instead.");
	        this.sections = [];
            this.gSectionsCurrentIndex = 0;
	        this.newSection();
	        return false;
	    }

        this.sections.splice(this.gSectionsCurrentIndex, 1);
	    this.prevSection();
        this.requestUiClearAll();
        this.requestUiReplay();
        this.publish_SectionChanged();
        //fullRepaint();
		return true;
	}

	isEmpty(section){
        return section.isEmpty();
	}

    moveSectionToEND(){
		var section = this.getCurrentSection();
        var arr = this.sections;
	    arr.push(arr.splice(this.gSectionsCurrentIndex, 1)[0]);
        this.lastSection(); //calls clear and update
	}

	moveSectionTo(newIndex){
        if (newIndex > this.sections.length-1){
            alert("moveSectionTo can't move to section index: "+newIndex+" because sections.length = "+this.sections.length);
            return;
        }
        var oldIndex = this.gSectionsCurrentIndex
        this.sections.splice(newIndex, 0, this.sections.splice(oldIndex, 1)[0]);
        this.gotoSection(newIndex);  //calls clear and update
	}

    //=============== Model Management/Cleanup Functions ==========================================

    /** call with defaultDisplayOptions = infinite-neck:controlsToDisplayOptions() */
    getDisplayOptionsInEffect(currSection, defaultDisplayOptions){
        // Start at currSection and walk backwards through song.sections
        let idx = this.sections.indexOf(currSection);
        if (idx === -1) {
            // currSection not found, fallback to default
            return defaultDisplayOptions;
        }
        for (let i = idx; i >= 0; i--) {
            const section = this.sections[i];
            if (section && section.displayOptions) {
                return section.displayOptions;
            }
        }
        return defaultDisplayOptions;
    }

    //This function works: it transposes every Section in a Song by 'amount'.
    cycleThruKeysAllSections(amount, doKeyLead = false){
        var sections = this.getSections();
        sections.forEach(section => {
            section.transposeRoot(amount);
            if (doKeyLead) {
                section.transposeRootLead(amount);
            }
        });
	}

    getTableArrInCurrentSection(tableID){
        return this.getCurrentSection().getTableArr(tableID);
	}

	getTableArrInSection(section, tableID){
        return section.getTableArr(tableID);
	}


    removeUnusedTablesFromMemoryModel(){
    	    this.sections.forEach(section => {
    	        section.removeEmptyTables();
    	    });
	}

    renameTuningIDInModel(oldID, newID) {
        var oldKey =  Constants.TABLE_ID_PREFIX + oldID;
        var newKey =  Constants.TABLE_ID_PREFIX + newID;
        if (oldKey === newKey) {
            return;
        }

        this.sections.forEach(function(section) {
            if (!section || !section.sectionNotesByTable || !Object.prototype.hasOwnProperty.call(section.sectionNotesByTable, oldKey)) {
                return;
            }

            const oldSectionNotes = section.sectionNotesByTable[oldKey];
            const newSectionNotes = section.sectionNotesByTable[newKey];

            if (newSectionNotes) {
                newSectionNotes.playedNotes = [
                    ...(Array.isArray(newSectionNotes.playedNotes) ? newSectionNotes.playedNotes : []),
                    ...(Array.isArray(oldSectionNotes.playedNotes) ? oldSectionNotes.playedNotes : [])
                ];
                newSectionNotes.namedNotes = {
                    ...(oldSectionNotes.namedNotes || {}),
                    ...(newSectionNotes.namedNotes || {})
                };
                newSectionNotes.recordedNotes = {
                    ...(oldSectionNotes.recordedNotes || {}),
                    ...(newSectionNotes.recordedNotes || {})
                };
                if (!newSectionNotes.chord && oldSectionNotes.chord) {
                    newSectionNotes.chord = oldSectionNotes.chord;
                }
                if (!newSectionNotes.mode && oldSectionNotes.mode) {
                    newSectionNotes.mode = oldSectionNotes.mode;
                }
                if (!newSectionNotes.tonalSourceSet && oldSectionNotes.tonalSourceSet) {
                    newSectionNotes.tonalSourceSet = oldSectionNotes.tonalSourceSet;
                }
            } else {
                section.sectionNotesByTable[newKey] = oldSectionNotes;
            }

            delete section.sectionNotesByTable[oldKey];
        });

        this.noteTablesLayout = this.getNoteTablesLayout()
            .map((entry) => ({
                tableID: entry.tableID === oldKey ? newKey : entry.tableID,
                visible: entry.visible !== false
            }))
            .filter((entry, index, arr) => arr.findIndex((other) => other.tableID === entry.tableID) === index);

        if (Array.isArray(this.wirings)) {
            this.wirings = this.wirings.map((wiring) => {
                if (!wiring) {
                    return wiring;
                }
                return {
                    ...wiring,
                    tablename: wiring.tablename === oldKey ? newKey : wiring.tablename,
                    listenToTablename: wiring.listenToTablename === oldKey ? newKey : wiring.listenToTablename
                };
            });
        }
    }

    markVisibleTablesForFileSave(visibleTableIds){
        if (!Array.isArray(visibleTableIds)) {
            return;
        }
        const visibleSet = new Set(visibleTableIds);
        const layout = this.getNoteTablesLayout();
        layout.forEach((entry) => {
            entry.visible = visibleSet.has(entry.tableID);
        });
        visibleTableIds.forEach((tableID) => {
            if (!layout.some((entry) => entry.tableID === tableID)) {
                layout.push({ tableID, visible: true });
            }
        });
    }

    prepareForSave({ visibleTableIds, songName, theme, bpm, userColors, plugins }){
        this.markVisibleTablesForFileSave(visibleTableIds);
        this.ensureNoteTablesLayout();
        this.removeUnusedTablesFromMemoryModel();
        this.songName = songName;
        this.defaultBPM = "" + bpm;
        this.userColors = userColors;
        this.theme = theme;
        this.songfileVersion = 'V2.1';
        delete this.visibleNoteTables;
        if (plugins && typeof plugins === 'object') {
            this.plugins = { ...plugins };
        }
    }

  getTuningHashInMemoryModel(){
    const hashTuningNames = {};
    const tablePrefix = Constants.TABLE_ID_PREFIX || '';

    function countArrayEntries(arr) {
        if (!Array.isArray(arr)) {
            return 0;
        }
        return arr.filter((entry) => entry != null).length;
    }

    function countNamedNotes(namedNotes) {
        if (!namedNotes || typeof namedNotes !== 'object') {
            return 0;
        }
        let total = 0;
        Object.values(namedNotes).forEach((entry) => {
            if (Array.isArray(entry)) {
                total += countArrayEntries(entry);
            } else if (entry != null) {
                total += 1;
            }
        });
        return total;
    }

    function countRecordedNotes(recordedNotes) {
        if (!recordedNotes || typeof recordedNotes !== 'object') {
            return 0;
        }
        let total = 0;
        Object.values(recordedNotes).forEach((beatEntry) => {
            if (Array.isArray(beatEntry)) {
                total += countArrayEntries(beatEntry);
            } else if (beatEntry && typeof beatEntry === 'object') {
                total += Object.values(beatEntry).filter((entry) => entry != null).length;
            } else if (beatEntry != null) {
                total += 1;
            }
        });
        return total;
    }

    this.sections.forEach((section) => {
        if (!section || !section.sectionNotesByTable || typeof section.sectionNotesByTable !== 'object') {
            return;
        }
        Object.entries(section.sectionNotesByTable).forEach(([tableID, sectionNotes]) => {
            if (!sectionNotes || typeof sectionNotes !== 'object') {
                return;
            }

            const tuningID = tableID.startsWith(tablePrefix)
                ? tableID.substring(tablePrefix.length)
                : tableID;
            const tableCount = countArrayEntries(sectionNotes.playedNotes)
                + countNamedNotes(sectionNotes.namedNotes)
                + countRecordedNotes(sectionNotes.recordedNotes);

            if (tableCount > 0) {
                hashTuningNames[tuningID] = (hashTuningNames[tuningID] || 0) + tableCount;
            }
        });
    });

	    return hashTuningNames;
	}


    removeNotePlayedFromTable(notePlayed, parentTableID){
      var tableArr = this.getTableArrInCurrentSection(parentTableID);
      tableArr.forEach((itemNotePlayed, key) => {
            if (   itemNotePlayed.col == notePlayed.col
                && itemNotePlayed.row == notePlayed.row
                && itemNotePlayed.styleNum == notePlayed.styleNum  ){
                //console.log("found cell["+key+"] item: "+JSON.stringify(itemNotePlayed));
                tableArr.splice(key, 1);
                return false; // break out of forEach
            }
        });
    }

    moveNamedNotesAllSections(amount){
        var sections = this.getSections();
        sections.forEach(section => {
            this.moveNamedNotesForSection(amount, section);       
        });
	}

    moveNamedNotes(amount){
        this.moveNamedNotesForSection(amount, this.getCurrentSection());

    }
    moveNamedNotesForSection(amount, section){
	    section.moveNamedNotes(amount);
  	}
    
    //============= EventBus =========================

    requestUiClearAll() {
        EventBus.trigger('SongUiClearAll');
    }

    requestUiReplay() {
        EventBus.trigger('SongUiReplay');
    }

    requestUiFullRepaint() {
        EventBus.trigger('SongUiFullRepaint');
    }

    requestUiClearHighlights() {
        EventBus.trigger('SongUiClearHighlights');
    }

    requestUiResetNoteNames() {
        EventBus.trigger('SongUiResetNoteNames');
    }

    requestUiShowBeats() {
        EventBus.trigger('SongUiShowBeats');
    }

    requestUiUpdatePrintSections() {
        EventBus.trigger('SongUiUpdatePrintSections');
    }

    requestUiClearAndReplaySection() {
        EventBus.trigger('SongUiClearAndReplaySection');
    }




}

