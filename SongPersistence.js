import * as Constants from './Constants.js';
import { Wiring } from './Wiring.js';
import { Graveyard } from './graveyard.js';

const DEFAULT_CHART_HEAD_NAMES = [
    Constants.SECTION_CHART_POSITION.HEAD,
    'BRIDGE',
    'CHORUS',
    'SOLO',
    'CODA'
];

const DEFAULT_PLUGIN_FIRING_ORDER = ['t', 'f', 'a', 'o', 'c', 'm'];

function sanitizeChartHeadName(value) {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^A-Za-z0-9_\- ]/g, '');
}

function normalizeChartHeadNames(rawHeadNames) {
    const values = Array.isArray(rawHeadNames) ? rawHeadNames : [];
    const seen = new Set();
    const cleaned = values
        .map((value) => sanitizeChartHeadName(value))
        .filter((value) => {
            if (!value || seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    return cleaned.length > 0 ? cleaned : [...DEFAULT_CHART_HEAD_NAMES];
}

function normalizePluginFiringOrder(rawPluginFiringOrder) {
    const values = Array.isArray(rawPluginFiringOrder)
        ? rawPluginFiringOrder
        : `${rawPluginFiringOrder || ''}`.trim();

    const tokens = Array.isArray(values)
        ? values.map((value) => `${value || ''}`)
        : (values.includes(',') ? values.split(',') : values.split(''));

    const cleaned = [];
    tokens.forEach((value) => {
        const token = `${value || ''}`.trim().toLowerCase();
        if (!token || cleaned.includes(token)) {
            return;
        }
        cleaned.push(token);
    });

    return cleaned.length > 0 ? cleaned : [...DEFAULT_PLUGIN_FIRING_ORDER];
}

function toTableID(baseID) {
    return `${Constants.TABLE_ID_PREFIX}${baseID}`;
}

function normalizeLayoutEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const tableID = `${entry.tableID || entry.tablename || ''}`.trim();
    if (!tableID) {
        return null;
    }
    return {
        tableID,
        visible: entry.visible !== false
    };
}

function normalizeNoteTablesLayout({ noteTablesLayout, visibleNoteTables, myTunings }) {
    const seen = new Set();
    const layout = [];

    if (Array.isArray(noteTablesLayout)) {
        noteTablesLayout.forEach((entry) => {
            const normalized = normalizeLayoutEntry(entry);
            if (!normalized || seen.has(normalized.tableID)) {
                return;
            }
            seen.add(normalized.tableID);
            layout.push(normalized);
        });
    } else if (Array.isArray(visibleNoteTables)) {
        visibleNoteTables.forEach((tableID) => {
            const key = `${tableID || ''}`.trim();
            if (!key || seen.has(key)) {
                return;
            }
            seen.add(key);
            layout.push({ tableID: key, visible: true });
        });
    }

    // Legacy songs may have incomplete visible tables. Ensure all song tunings are represented.
    if (Array.isArray(myTunings)) {
        myTunings.forEach((tuning) => {
            if (!tuning || !tuning.baseID) {
                return;
            }
            const tableID = toTableID(tuning.baseID);
            if (seen.has(tableID)) {
                return;
            }
            seen.add(tableID);
            layout.push({ tableID, visible: true });
        });
    }

    return layout;
}

const songDefaults = {
    activeStylesheets: "Default",
    captionsRowShowing: false,
    defaultBPM: "80",
    info: "",
    namedNoteOpacity: "1.00",
    openInfo: "none",
    presentationMode: false,
    pluginFiringOrder: [...DEFAULT_PLUGIN_FIRING_ORDER],
    chartOptions: {
        modes: true,
        detailLine: true,
        showCaptions: true,
        showNextLine: false,
        stripTonalRoots: false,
        addTransposedRootToChord: false,
        HEADNames: [...DEFAULT_CHART_HEAD_NAMES],
        barClass: Constants.SONG_CHART_BAR_CLASS.BOX,
        chartSpacing: 'relaxed',
        chordFontsize: '100%',
        lineCaptionFontsize: '100%',
        boxCaptionFontsize: '100%'
    },
    rootID: "3",
    sharps: false,
    singleNoteOpacity: "1.00",
    tinyNoteOpacity: "1.00",
    songfileVersion: "V2",
    songName: "RoundMidnight",
    theme: "Snow",

    //run-time fields:
    isHeadless: false,
    gSectionsCurrentIndex: 0,
    gFirstBeatSeen: false,
    gSongModelListener: null,
    captionsRowShowing: false,

    //shared collections:
    noteNamesFuncArr: [...Constants.noteNamesFuncArrDEFAULT],
    fretLengths: Constants.calcFretLengths()    
};

export class SongPersistence {
    //TODO: add arg gSongPreferences so that colorDicts, and others can be set from preferences/template song.
    //SEE: chat conversation about what is safe/unsafe to access here: 
    //        _chat_conversations/infinite-neck/gSongPreferences-chat.md
    constructor(obj = {}, Section_Class) {
        //do these first for non-null defaults, though they may get overwritten by obj.
        this.randomSectionHistory = [];
        this.myTunings = [];
        this.visibleNoteTables = [];
        this.noteTablesLayout = [];
        this.colorDicts = {};
        this.plugins = {};

        Object.assign(this, songDefaults, obj);
        const incomingChartOptions = obj.chartOptions && typeof obj.chartOptions === 'object' ? obj.chartOptions : {};
        this.chartOptions = {
            ...songDefaults.chartOptions,
            ...incomingChartOptions
        };
        this.chartOptions.HEADNames = normalizeChartHeadNames(this.chartOptions.HEADNames);
        this.pluginFiringOrder = normalizePluginFiringOrder(this.pluginFiringOrder);

        this.sections = (obj.sections||[]).map(s => new Section_Class(s));
        this.wirings =  (obj.wirings||[]).map(w => new Wiring(w));
        this.noteTablesLayout = normalizeNoteTablesLayout({
            noteTablesLayout: obj.noteTablesLayout,
            visibleNoteTables: obj.visibleNoteTables,
            myTunings: this.myTunings
        });
        this.plugins = obj.plugins && typeof obj.plugins === 'object' ? { ...obj.plugins } : {};
        this.graveyard = new Graveyard(obj.graveyard);
        this.graveyard.setSong(this);
    }

    static filterPersistentColorDicts(colorDicts){
        if (!colorDicts || typeof colorDicts !== 'object'){
            return colorDicts;
        }
        const filtered = {};
        Object.entries(colorDicts).forEach(([key, scheme]) => {
            if (!scheme || typeof scheme !== 'object'){
                return;
            }
            if (scheme.readOnly || scheme.computed){
                return;
            }
            filtered[key] = scheme;
        });
        return filtered;
    }

    static persistentSongFileReplacer(key, value){
        if (key === 'colorDicts'){
            return SongPersistence.filterPersistentColorDicts(value);
        }
        if (   key === 'userColors' 
            || key === 'fretLengths' 
            || key === 'noteNamesFuncArr'
            || key === 'noteNamesFuncArrDEFAULT'
            || key === 'gSectionsCurrentIndex'
            || key === 'gFirstBeatSeen'
            || key === 'gSongModelListener'
            || key === 'randomSectionHistory'
            || key === 'isHeadless'
            || key === 'runtime'
            || key === 'recording'
            || key === 'tunings'
            || key === 'userInstrumentTuning'
            || key === 'visibleNoteTables'
            ) 
        {
            return undefined;
        }
        return value;
    }

}
