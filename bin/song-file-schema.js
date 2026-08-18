import Ajv2020 from 'ajv/dist/2020.js';
import { SECTION_CHART_CAPTION_WIDTH, SONG_CHART_BAR_CLASS } from '../Constants.js';

const INTEGER_LIKE_PATTERN = '^-?\\d+$';
const ALLOWED_NOTE_NAMES = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab'];
const NOTE_NAME_KEY_PATTERN = '^(A|Bb|B|C|Db|D|Eb|E|F|Gb|G|Ab)$';

const integerLikeSchema = {
    anyOf: [
        { type: 'integer' },
        { type: 'string', pattern: INTEGER_LIKE_PATTERN }
    ]
};

const stringOrNumberSchema = {
    anyOf: [
        { type: 'string' },
        { type: 'number' }
    ]
};

const noteNameSchema = {
    type: 'string',
    enum: ALLOWED_NOTE_NAMES
};

const emptyObjectSchema = {
    type: 'object',
    maxProperties: 0,
    additionalProperties: false
};

const namedNoteSchema = {
    type: 'object',
    properties: {
        noteName: noteNameSchema,
        colorClass: { type: 'string', minLength: 1 },
        noteNameClass: { type: 'string', minLength: 1 },
        styleNum: { type: 'integer' },
        type: { type: 'string', minLength: 1 }
    },
    required: ['noteName'],
    additionalProperties: true
};

const placedNoteSchema = {
    type: 'object',
    properties: {
        noteName: noteNameSchema,
        colorClass: { type: 'string', minLength: 1 },
        styleNum: { type: 'integer' },
        midinum: integerLikeSchema,
        row: integerLikeSchema,
        col: integerLikeSchema,
        owner: { type: 'string', minLength: 1 },
        bendValue: { type: 'string', minLength: 1 },
        noteNameClass: { type: 'string', minLength: 1 },
        finger: { type: 'string', minLength: 1 },
        type: { type: 'string', minLength: 1 }
    },
    required: ['styleNum'],
    additionalProperties: true
};

const tuningSchema = {
    type: 'object',
    properties: {
        instance: { type: 'boolean' },
        baseID: { type: 'string', minLength: 1 },
        baseInstrument: { type: 'string', minLength: 1 },
        caption: { type: 'string' },
        nStrings: { type: 'integer', minimum: 1 },
        rowRange: {
            type: 'array',
            minItems: 1,
            items: { type: 'integer' }
        },
        showDiamonds: { type: 'boolean' },
        diamonds: {
            type: 'array',
            items: { type: 'integer' }
        },
        doubleDiamonds: {
            type: 'array',
            items: { type: 'integer' }
        },
        frets: { type: 'integer', minimum: 0 },
        nut: { type: 'boolean' },
        reverse: { type: 'boolean' },
        fromBaseID: { type: 'string', minLength: 1 }
    },
    required: ['baseID', 'baseInstrument', 'caption', 'nStrings', 'rowRange', 'frets', 'nut', 'reverse'],
    additionalProperties: true
};

const wiringSchema = {
    type: 'object',
    properties: {
        tablename: { type: 'string', minLength: 1 },
        relativeSection: { type: 'string' },
        listenToTablename: { type: 'string', minLength: 1 },
        listenerProjection: {
            type: 'string',
            enum: ['row-midi', 'midi-low-to-high', 'midi-high-to-low']
        }
    },
    required: ['tablename', 'relativeSection', 'listenToTablename'],
    additionalProperties: false
};

const graveyardRecordSchema = {
    type: 'object',
    properties: {
        timestamp: { type: 'number' },
        date: { type: 'string' },
        time: { type: 'string' },
        type: { type: 'string', minLength: 1 },
        context: { type: 'object' },
        json: { type: 'string' },
        lastRevived: {
            anyOf: [
                { type: 'number' },
                { type: 'null' }
            ]
        }
    },
    required: ['timestamp', 'date', 'time', 'type', 'context', 'json'],
    additionalProperties: true
};

const sectionNotesSchema = {
    type: 'object',
    properties: {
        playedNotes: {
            type: 'array',
            items: placedNoteSchema
        },
        namedNotes: {
            type: 'object',
            propertyNames: { pattern: NOTE_NAME_KEY_PATTERN },
            additionalProperties: {
                anyOf: [emptyObjectSchema, namedNoteSchema]
            }
        },
        recordedNotes: {
            type: 'object',
            propertyNames: { pattern: '^\\d+$' },
            additionalProperties: {
                type: 'array',
                items: placedNoteSchema
            }
        },
        chord: { type: 'string' },
        mode: { type: 'string' },
        tonalSourceSet: { type: 'string' }
    },
    required: ['playedNotes', 'namedNotes', 'recordedNotes'],
    additionalProperties: false
};

const sectionSchema = {
    type: 'object',
    properties: {
        sectionNotesByTable: {
            type: 'object',
            additionalProperties: sectionNotesSchema
        },
        pluginData: {
            type: 'object',
            properties: {
                arpeggio: {
                    type: 'object',
                    properties: {
                        positions: {
                            type: 'array',
                            items: {
                                type: 'array',
                                minItems: 2,
                                maxItems: 2,
                                items: integerLikeSchema
                            }
                        },
                        lastPositionIndex: integerLikeSchema
                    },
                    additionalProperties: true
                }
            },
            additionalProperties: true
        },
        caption: { type: 'string' },
        chartChord: { type: 'string' },
        chartMode: { type: 'string' },
        chartPosition: { type: 'string', minLength: 1 },
        chartCaptionWidth: { type: 'string', enum: Object.values(SECTION_CHART_CAPTION_WIDTH) },
        beatsPerBar: integerLikeSchema,
        rootID: integerLikeSchema,
        rootIDLead: integerLikeSchema,
        beats: integerLikeSchema,
        currentBeat: integerLikeSchema,
        sharps: { type: 'boolean' }
    },
    required: ['sectionNotesByTable', 'rootID', 'beats', 'currentBeat', 'sharps'],
    additionalProperties: true
};

const tutorialLevelSchema = { type: 'string', enum: ['none', 'strict', 'wizard'] };

const sectionTutorialSchema = {
    type: 'object',
    properties: {
        caption: { type: 'string' },
        prompt: {
            type: 'object',
            properties: {
                lines: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['lines'],
            additionalProperties: false
        }
    },
    additionalProperties: false
};

sectionSchema.properties.tutorial = sectionTutorialSchema;

const songTutorialSchema = {
    type: 'object',
    properties: {
        level: tutorialLevelSchema,
        caption: { type: 'string' },
        storageKey: { type: 'string' },
        useCaptionForSectionCaption: { type: 'boolean' }
    },
    required: ['level'],
    additionalProperties: false
};

const pluginSchema = {
    type: 'object',
    properties: {
        enabled: { type: 'boolean' },
        enableOnSongLoad: { type: 'boolean' },
        graveyardKey: { type: 'string' },
        properties: { type: 'object' }
    },
    required: ['enabled', 'enableOnSongLoad', 'properties'],
    additionalProperties: true
};

const chartOptionsSchema = {
    type: 'object',
    properties: {
        modes: { type: 'boolean' },
        detailLine: { type: 'boolean' },
        showCaptions: { type: 'boolean' },
        showNextLine: { type: 'boolean' },
        stripTonalRoots: { type: 'boolean' },
        addTransposedRootToChord: { type: 'boolean' },
        HEADNames: {
            type: 'array',
            items: { type: 'string' }
        },
        barClass: { type: 'string', enum: Object.values(SONG_CHART_BAR_CLASS) },
        chordFontsize: {
            type: 'string',
            enum: ['50%', '60%', '70%', '80%', '90%', '100%', '110%', '120%', '140%', '160%', '180%', '200%']
        },
        lineCaptionFontsize: {
            type: 'string',
            enum: ['50%', '60%', '70%', '80%', '90%', '100%', '110%', '120%', '140%', '160%', '180%', '200%']
        },
        boxCaptionFontsize: {
            type: 'string',
            enum: ['50%', '60%', '70%', '80%', '90%', '100%', '110%', '120%', '140%', '160%', '180%', '200%']
        },
        chartSpacing: {
            type: 'string',
            enum: ['tight', 'comfy', 'relaxed']
        }
    },
    additionalProperties: false
};

const anchorageSchema = {
    type: 'object',
    properties: {
        floated: { type: 'boolean' },
        // left/width are percentages of window.innerWidth; top/height are percentages
        // of window.innerHeight (each 0-100+). Captured from the floating window's
        // getBoundingClientRect() at save time and applied back as CSS `%` values
        // (position: fixed) at load time -- see captureAnchorageBeforeSave() and
        // makeDivDockable() in infinite-neck.js/dockable.js. Not pixels.
        floatRect: {
            type: 'object',
            properties: {
                left: { type: 'number' },
                top: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' }
            },
            additionalProperties: false
        },
        // Stacking order among currently-floated windows: raised to the top of the
        // "deck" whenever the User clicks a floating window's .dockable-handle. See
        // sprint-141 Iteration 4, points 1-3.
        zIndex: { type: 'number' },
        // 'top' or 'side' -- which edge of the floating window the drag handle sits
        // along. See sprint-141 Iteration 4, point 4.
        handleOrientation: { type: 'string', enum: ['top', 'side'] }
    },
    additionalProperties: false
};

const noteTableLayoutEntrySchema = {
    type: 'object',
    properties: {
        tableID: { type: 'string', minLength: 1 },
        visible: { type: 'boolean' },
        ToolDisplayOptions: { type: 'object' },
        CaptionLeft: { type: 'boolean' },
        SectionStatusLeft: { type: 'boolean' },
        anchorage: anchorageSchema
    },
    required: ['tableID', 'visible'],
    additionalProperties: false
};

const macroSchema = {
    type: 'object',
    properties: {
        lines: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: ['lines'],
    additionalProperties: true
};

const infoLinesSchema = {
    type: 'object',
    properties: {
        lines: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: ['lines'],
    additionalProperties: false
};

export const songFileV2Schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
        activeStylesheets: { type: 'string', minLength: 1 },
        captionsRowShowing: { type: 'boolean' },
        defaultBPM: stringOrNumberSchema,
        chartOptions: chartOptionsSchema,
        namedNoteOpacity: stringOrNumberSchema,
        presentationMode: { type: 'boolean' },
        allowThemeAutomation: { type: 'boolean' },
        pluginFiringOrder: {
            type: 'array',
            items: { type: 'string', minLength: 1 }
        },
        rootID: integerLikeSchema,
        sharps: { type: 'boolean' },
        singleNoteOpacity: stringOrNumberSchema,
        tinyNoteOpacity: stringOrNumberSchema,
        songfileVersion: {
            type: 'string',
            pattern: '^V2(\\.1)?$'
        },
        songName: { type: 'string', minLength: 1 },
        theme: { type: 'string', minLength: 1 },
        info: {
            anyOf: [
                { type: 'string' },
                infoLinesSchema
            ]
        },
        tutorial: songTutorialSchema,
        userTheme: {
            anyOf: [
                { type: 'string' },
                { type: 'object' },
                { type: 'null' }
            ]
        },
        sections: {
            type: 'array',
            minItems: 1,
            items: sectionSchema
        },
        myTunings: {
            type: 'array',
            minItems: 1,
            items: tuningSchema
        },
        tunings: false,
        userInstrumentTuning: {
            anyOf: [
                tuningSchema,
                { type: 'null' }
            ]
        },
        noteTablesLayout: {
            type: 'array',
            items: noteTableLayoutEntrySchema
        },
        wirings: {
            type: 'array',
            items: wiringSchema
        },
        plugins: {
            type: 'object',
            additionalProperties: pluginSchema
        },
        macros: {
            type: 'object',
            propertyNames: { pattern: '^[A-Za-z][A-Za-z0-9_-]*$' },
            additionalProperties: macroSchema
        },
        graveyard: {
            type: 'object',
            properties: {
                records: {
                    type: 'array',
                    items: graveyardRecordSchema
                }
            },
            required: ['records'],
            additionalProperties: false
        },
        gSectionsCurrentIndex: integerLikeSchema,
        gFirstBeatSeen: { type: 'boolean' },
        gSongModelListener: { type: 'null' },
        isHeadless: { type: 'boolean' },
        noteNamesFuncArrDEFAULT: { type: 'array' },
        randomSectionHistory: { type: 'array' }
    },
    required: [
        'myTunings',
        'rootID',
        'sections',
        'songName',
        'songfileVersion'
    ],
    additionalProperties: true
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSongFileV2 = ajv.compile(songFileV2Schema);

export function validateSongFileSchema(songJson) {
    const valid = validateSongFileV2(songJson);
    return {
        valid,
        errors: valid ? [] : formatSchemaErrors(validateSongFileV2.errors)
    };
}

export function formatSchemaErrors(errors = []) {
    return errors.map((error) => {
        const path = error.instancePath || '/';
        return `${path} ${error.message}`;
    });
}
