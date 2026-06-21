import * as Constants from './Constants.js';
import {
    toInt
} from './utils.js';    
import {
    getTonalForTable
} from './TonalFunctions.js';

import { 
    buildTonalPickerSet, 
    TonalPickerOrientation 
} from './tonalPicker.js';


const tonalNamespace = globalThis.Tonal?.Chord
    ? globalThis.Tonal
    : await import('tonal');
const { Chord, Mode, Scale } = tonalNamespace;

const DEFAULT_CHART_HEAD_NAMES = Object.freeze([
    Constants.SECTION_CHART_POSITION.HEAD,
    'BRIDGE',
    'CHORUS',
    'SOLO',
    'CODA'
]);

const CHART_POSITION_FIXED_VALUES = [
    Constants.SECTION_CHART_POSITION.INTRO,
    Constants.SECTION_CHART_POSITION.LINE,
    Constants.SECTION_CHART_POSITION.BAR,
    Constants.SECTION_CHART_POSITION.OUTRO
];

const CHART_CAPTION_WIDTH_VALUES = [
    Constants.SECTION_CHART_CAPTION_WIDTH.NONE,
    Constants.SECTION_CHART_CAPTION_WIDTH.SHORT,
    Constants.SECTION_CHART_CAPTION_WIDTH.MEDIUM,
    Constants.SECTION_CHART_CAPTION_WIDTH.LINE
];

const CHART_BAR_CLASS_VALUES = [
    Constants.SONG_CHART_BAR_CLASS.BOX,
    Constants.SONG_CHART_BAR_CLASS.BARE,
    Constants.SONG_CHART_BAR_CLASS.LEADSHEET
];

const CHART_FONT_SIZE_VALUES = [
    '50%',
    '60%',
    '70%',
    '80%',
    '90%',
    '100%',
    '110%',
    '120%',
    '140%',
    '160%',
    '180%',
    '200%'
];

const CHART_SPACING_VALUES = [
    'tight',
    'comfy',
    'relaxed'
];

const CHART_SPACING_PRESETS = Object.freeze({
    tight: {
        chartPadding: '0.4em',
        barPadding: '0.2em',
        barWidth: '8em',
        leadSheetWidth: '10em',
        shortWidth: '10em'
    },
    comfy: {
        chartPadding: '1em',
        barPadding: '1em',
        barWidth: '12em',
        leadSheetWidth: '15em',
        shortWidth: '15em'
    },
    relaxed: {
        chartPadding: '2em',
        barPadding: '2em',
        barWidth: '20em',
        leadSheetWidth: '20em',
        shortWidth: '20em'
    }
});

function sanitizeChartHeadName(value) {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^A-Za-z0-9_\- ]/g, '');
}

function uniqueStrings(values = []) {
    const seen = new Set();
    return values.filter((value) => {
        if (!value || seen.has(value)) {
            return false;
        }
        seen.add(value);
        return true;
    });
}

export function normalizeChartHeadNames(rawHeadNames) {
    const values = Array.isArray(rawHeadNames) ? rawHeadNames : [];
    const cleaned = uniqueStrings(values.map((value) => sanitizeChartHeadName(value)));
    if (cleaned.length > 0) {
        return cleaned;
    }
    return [...DEFAULT_CHART_HEAD_NAMES];
}

export function parseChartHeadNamesTextarea(textValue) {
    const rawLines = String(textValue ?? '').split(/\r?\n/);
    return normalizeChartHeadNames(rawLines);
}

function getChartHeadNames(theSong) {
    return normalizeChartHeadNames(theSong?.chartOptions?.HEADNames);
}

function getChartPositionValues(theSong) {
    return [
        Constants.SECTION_CHART_POSITION.INTRO,
        ...getChartHeadNames(theSong),
        Constants.SECTION_CHART_POSITION.LINE,
        Constants.SECTION_CHART_POSITION.BAR,
        Constants.SECTION_CHART_POSITION.OUTRO
    ];
}

function isHeadChartPosition(chartPosition, chartHeadNames) {
    return chartHeadNames.includes(chartPosition);
}

function getEffectiveSongChartOptions(theSong) {
    const chartOptions = theSong?.chartOptions && typeof theSong.chartOptions === 'object' ? theSong.chartOptions : {};
    const chartHeadNames = normalizeChartHeadNames(chartOptions.HEADNames);
    return {
        modes: chartOptions.modes !== false,
        detailLine: chartOptions.detailLine !== false,
        showCaptions: chartOptions.showCaptions !== false,
        showNextLine: chartOptions.showNextLine === true,
        stripTonalRoots: chartOptions.stripTonalRoots === true,
        addTransposedRootToChord: chartOptions.stripTonalRoots === true && chartOptions.addTransposedRootToChord === true,
        HEADNames: chartHeadNames,
        barClass: CHART_BAR_CLASS_VALUES.includes(chartOptions.barClass)
            ? chartOptions.barClass
            : Constants.SONG_CHART_BAR_CLASS.BOX,
        chordFontsize: CHART_FONT_SIZE_VALUES.includes(chartOptions.chordFontsize)
            ? chartOptions.chordFontsize
            : '100%',
        lineCaptionFontsize: CHART_FONT_SIZE_VALUES.includes(chartOptions.lineCaptionFontsize)
            ? chartOptions.lineCaptionFontsize
            : '100%',
        boxCaptionFontsize: CHART_FONT_SIZE_VALUES.includes(chartOptions.boxCaptionFontsize)
            ? chartOptions.boxCaptionFontsize
            : '100%',
        chartSpacing: CHART_SPACING_VALUES.includes(chartOptions.chartSpacing)
            ? chartOptions.chartSpacing
            : 'relaxed'
    };
}

function getTransposedRootDisplay(section = null) {
    const rootID = toInt(section?.rootID, 0);
    return Constants.NOTE_NAMES_ARRAY[rootID] || Constants.NOTE_NAMES_ARRAY[0] || '';
}

function formatChordWithoutRoot(chartChord = '') {
    const rawValue = `${chartChord || ''}`.trim();
    if (!rawValue || rawValue === '%') {
        return rawValue;
    }

    const tonalChord = Chord?.get?.(rawValue) || null;
    const symbol = `${tonalChord?.symbol || ''}`.trim();
    const tonic = `${tonalChord?.tonic || ''}`.trim();
    if (!symbol || !tonic) {
        return rawValue;
    }

    if (symbol.length > tonic.length && symbol.toLowerCase().startsWith(tonic.toLowerCase())) {
        const stripped = symbol.slice(tonic.length).trim();
        return stripped || rawValue;
    }

    return rawValue;
}

function resolveModeName(modeValue = '') {
    const rawValue = `${modeValue || ''}`.trim();
    if (!rawValue) {
        return '';
    }

    if (Mode && typeof Mode.name === 'function') {
        const namedMode = `${Mode.name(rawValue) || ''}`.trim();
        if (namedMode) {
            return namedMode;
        }
    }

    const modeInfo = Mode?.get?.(rawValue) || null;
    if (modeInfo?.name) {
        return `${modeInfo.name}`.trim();
    }

    const scaleInfo = Scale?.get?.(rawValue) || null;
    if (scaleInfo?.type) {
        return `${scaleInfo.type}`.trim();
    }

    return '';
}

function formatModeWithoutRoot(chartMode = '') {
    const rawValue = `${chartMode || ''}`.trim();
    if (!rawValue) {
        return '';
    }
    return resolveModeName(rawValue) || rawValue;
}

export function getChartDisplayValue(value, valueKind = 'text', songChartOptions = {}, context = {}) {
    const text = `${value || ''}`;
    const section = context?.section || null;
    if (!songChartOptions?.stripTonalRoots) {
        return text;
    }

    let strippedText = text;
    if (valueKind === 'chord') {
        strippedText = formatChordWithoutRoot(text);
    } else if (valueKind === 'mode') {
        strippedText = formatModeWithoutRoot(text);
    }

    if (songChartOptions?.addTransposedRootToChord && (valueKind === 'chord' || valueKind === 'mode')) {
        const rootText = getTransposedRootDisplay(section);
        if (rootText && strippedText && strippedText !== '%') {
            return `<b class='chartTransposedRoot'>${rootText}</b>${strippedText}`;
        }
    }

    return strippedText;
}

function percentStringToMultiplier(percentValue) {
    const parsed = Number.parseFloat(String(percentValue).replace('%', ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return '1';
    }
    return String(parsed / 100);
}

function getSectionKeyDisplay(theSong, section) {    //&#x2836 &#x2847 66 B4
    // Key display must follow the source section (including its sharps/flats),
    // not the currently selected section in the Song.
    const rootID = toInt(section?.rootID, 0);
    const leadID = toInt(section?.rootIDLead, -1);
    const displayName = (noteID) => {
        if (typeof section?.noteIDToDisplayName === 'function') {
            return section.noteIDToDisplayName(noteID);
        }
        return theSong.noteIDToNoteName(noteID);
    };
    return displayName(rootID) + (leadID !== -1 ? "&#x2836;" + displayName(leadID) : "");
}

function getSectionBeatsDisplay(section) {
    if (typeof section?.getBeats === 'function') {
        return section.getBeats();
    }
    return section?.beats ?? '';
}

function getEffectiveChartPosition(section, chartHeadNames) {
    const chartPosition = section?.chartPosition;
    if (CHART_POSITION_FIXED_VALUES.includes(chartPosition) || isHeadChartPosition(chartPosition, chartHeadNames)) {
        return chartPosition;
    }
    if (chartPosition === Constants.SECTION_CHART_POSITION.HEAD && !chartHeadNames.includes(Constants.SECTION_CHART_POSITION.HEAD)) {
        return chartHeadNames[0];
    }
    return Constants.SECTION_CHART_POSITION.BAR;
}

function getEffectiveChartCaptionWidth(section) {
    return CHART_CAPTION_WIDTH_VALUES.includes(section?.chartCaptionWidth)
        ? section.chartCaptionWidth
        : Constants.SECTION_CHART_CAPTION_WIDTH.NONE;
}

function escapeHtmlAttribute(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll("'", '&#39;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function formatOwnedDisplayText(displayText, owner = '') {
    const safeText = escapeHtmlAttribute(displayText);
    if (!owner) {
        return safeText;
    }
    return `<span class='SPN_OWNED'>${safeText}</span>`;
}

function getChartBeatsPerBarInputValue(section) {
    return section?.beatsPerBar == null ? '' : String(section.beatsPerBar);
}

function getEffectiveSectionBeatsPerBar(section) {
    const rawValue = getChartBeatsPerBarInputValue(section).trim();
    if (!/^[1-9]\d*$/.test(rawValue)) {
        return null;
    }
    return toInt(rawValue, 0);
}

function formatChartBeatsPerBarInput(section, idx) {
    return `<input class='sectionChartBeatsPerBarInput' data-section-idx='${idx}' aria-label='Chart beats per bar' size='3' inputmode='numeric' value='${escapeHtmlAttribute(getChartBeatsPerBarInputValue(section))}'>`;
}

function getChartBarWidthClass(theSections, songChartOptions) {
    if (songChartOptions.barClass === Constants.SONG_CHART_BAR_CLASS.LEADSHEET) {
        return 'chartBAR--leadSheet';
    }
    const hasMediumCaption = theSections.some((section) => getEffectiveChartCaptionWidth(section) === Constants.SECTION_CHART_CAPTION_WIDTH.MEDIUM);
    return hasMediumCaption ? 'chartBAR--medium' : 'chartBAR--short';
}

function getChartBarBeatCounts(section) {
    const sectionBeats = getSectionBeatsDisplay(section);
    const beatsPerBar = getEffectiveSectionBeatsPerBar(section);
    if (!beatsPerBar || beatsPerBar >= sectionBeats) {
        return [sectionBeats];
    }

    const beatCounts = [];
    let remainingBeats = sectionBeats;
    while (remainingBeats > 0) {
        const barBeats = Math.min(beatsPerBar, remainingBeats);
        beatCounts.push(barBeats);
        remainingBeats -= barBeats;
    }
    return beatCounts;
}

function createChartBarEntries(section, idx, songChartOptions) {
    if (songChartOptions.barClass !== Constants.SONG_CHART_BAR_CLASS.LEADSHEET) {
        return [{
            section,
            idx,
            barBeats: getSectionBeatsDisplay(section),
            chordText: section.chartChord,
            isRepeatBar: false,
            allowInlineCaption: true
        }];
    }

    return getChartBarBeatCounts(section).map((barBeats, barIndex) => ({
        section,
        idx,
        barBeats,
        chordText: barIndex === 0 ? section.chartChord : '%',
        isRepeatBar: barIndex > 0,
        allowInlineCaption: barIndex === 0
    }));
}

function formatSelectOptions(values, selectedValue) {
    return values.map((value) => {
        const selected = selectedValue === value ? ' selected' : '';
        return `<option value='${value}'${selected}>${value}</option>`;
    }).join('');
}

function formatChartPositionSelect(theSong, section, idx) {
    const chartHeadNames = getChartHeadNames(theSong);
    const currentValue = getEffectiveChartPosition(section, chartHeadNames);
    return `<select class='sectionChartPositionSelect' data-section-idx='${idx}' aria-label='Chart position'>`
        + formatSelectOptions(getChartPositionValues(theSong), currentValue)
        + `</select>`;
}

function formatChartCaptionWidthSelect(section, idx) {
    const currentValue = getEffectiveChartCaptionWidth(section);
    return `<select class='sectionChartCaptionWidthSelect' data-section-idx='${idx}' aria-label='Chart caption width'>`
        + formatSelectOptions(CHART_CAPTION_WIDTH_VALUES, currentValue)
        + `</select>`;
}

function formatSongChartOptionCheckbox(optionName, isChecked, labelText, isDisabled = false) {
    const checked = isChecked ? ' checked' : '';
    const disabled = isDisabled ? ' disabled' : '';
    return `<label class='songChartOptionsControl'><input type='checkbox' class='songChartOptionsCheckbox' data-chart-option='${optionName}'${checked}${disabled}> ${labelText}</label>`;
}

function formatSongChartBarClassSelect(barClass) {
    return `<label class='songChartOptionsControl'>Bar Style <select class='songChartBarClassSelect' aria-label='Chart bar style'>`
        + formatSelectOptions(CHART_BAR_CLASS_VALUES, barClass)
        + `</select></label>`;
}

function formatSongChartBarClassSelectControl(barClass) {
    return `<select class='songChartBarClassSelect' aria-label='Chart bar style'>`
        + formatSelectOptions(CHART_BAR_CLASS_VALUES, barClass)
        + `</select>`;
}

function formatSongChartFontsizeSelect(optionName, currentValue, labelText) {
    return `<label class='songChartOptionsControl'>${labelText} <select class='songChartFontsizeSelect' data-chart-option='${optionName}' aria-label='${labelText}'>`
        + formatSelectOptions(CHART_FONT_SIZE_VALUES, currentValue)
        + `</select></label>`;
}

function formatSongChartFontsizeSelectControl(optionName, currentValue, labelText) {
    return `<select class='songChartFontsizeSelect' data-chart-option='${optionName}' aria-label='${labelText}'>`
        + formatSelectOptions(CHART_FONT_SIZE_VALUES, currentValue)
        + `</select>`;
}

function formatSongChartSpacingSelectControl(currentValue) {
    return `<select class='songChartSpacingSelect' data-chart-option='chartSpacing' aria-label='Chart spacing'>`
        + formatSelectOptions(CHART_SPACING_VALUES, currentValue)
        + `</select>`;
}

function formatChartStyleVariables(songChartOptions, includeChartSpacing = true) {
    const declarations = [
        `--chart-bar-chord-scale:${percentStringToMultiplier(songChartOptions.chordFontsize)}`,
        `--chart-bar-secondary-font-size:${songChartOptions.lineCaptionFontsize}`,
        `--chart-line-caption-font-size:${songChartOptions.boxCaptionFontsize}`,
        `--lead-sheet-beat-count-margin-right:${songChartOptions.chartSpacing === 'tight' ? '0' : 'calc(-0.8em + 4px)'}`
    ];

    if (includeChartSpacing) {
        const spacing = CHART_SPACING_PRESETS[songChartOptions.chartSpacing] || CHART_SPACING_PRESETS.relaxed;
        declarations.push(`--chart-panel-padding:${spacing.chartPadding}`);
        declarations.push(`--chart-bar-padding:${spacing.barPadding}`);
        declarations.push(`--chart-bar-width:${spacing.barWidth}`);
        declarations.push(`--chart-bar-leadsheet-width:${spacing.leadSheetWidth}`);
        declarations.push(`--chart-bar-short-width:${spacing.shortWidth}`);
    }

    return ` style='${declarations.join('; ')};'`;
}

function formatChartLineValue(value, valueKind = 'text', songChartOptions = {}, context = {}) {
    const displayValue = getChartDisplayValue(value, valueKind, songChartOptions, context);
    return displayValue ? displayValue : '&nbsp;';
}

function formatChartCaptionText(section) {
    return section?.caption ? section.caption : '&nbsp;';
}

function formatChartCaptionEditor(section, idx) {
    return `<div class='sectionChartCaptionCell' data-section-idx='${idx}'>`
        + `<div class='sectionChartCaptionDisplay'>${formatChartCaptionText(section)}</div>`
        + `<button type='button' class='sectionChartCaptionEditButton' aria-label='Edit caption'>Edit</button>`
        + `<div class='sectionChartCaptionEditor' hidden>`
        + `<textarea class='sectionChartCaptionTextarea' rows='5'>${escapeHtmlAttribute(section?.caption || '')}</textarea>`
        + `<button type='button' class='sectionChartCaptionSaveButton' aria-label='Save caption'>&check;</button>`
        + `</div>`
        + `</div>`;
}

function formatChartMetaLine(theSong, section, idx) {
    const sectionNumber = idx + 1;                                         //&#x2836 &#x2847 66 B4
    return `<a href='#' data-action='linkToSection' data-action-args='[${idx}]'>${sectionNumber}</a> &#x28B4; ${getSectionKeyDisplay(theSong, section)} &#x2866; <span class='leadSheetLineBARBeatCount'>${getSectionBeatsDisplay(section)}</span>`;
}

function formatChartBar(theSong, barEntry, songChartOptions, chartBarWidthClass, isFirstInLine, currentSectionIndex) {
    const { section, idx, barBeats, chordText, allowInlineCaption, isRepeatBar } = barEntry;
    const captionWidth = getEffectiveChartCaptionWidth(section);
    const isLeadSheetBar = songChartOptions.barClass === Constants.SONG_CHART_BAR_CLASS.LEADSHEET;
    const barClasses = ['chartBAR', chartBarWidthClass, `barClass-${songChartOptions.barClass}`];
    if (isFirstInLine) {
        barClasses.push('chartBAR--firstInLine');
    }
    if (isRepeatBar) {
        barClasses.push('chartBAR--repeat');
    }
    if (idx === currentSectionIndex) {
        barClasses.push('chartBAR--currentSection');
    }
    const barActionAttrs = ` data-action='linkToSection' data-action-args='[${idx}]'`;
    const parts = [
        `<span class='${barClasses.join(' ')}'${barActionAttrs}>`,
        `<div class='chartBARChord'>${formatChartLineValue(chordText, 'chord', songChartOptions, { section })}</div>`,
    ];

    if (isLeadSheetBar) {
        if (songChartOptions.modes) {
            parts.push(`<div class='chartBARMode'>${formatChartLineValue(section.chartMode, 'mode', songChartOptions, { section })}</div>`);
        }
    } else {
        if (songChartOptions.modes) {
            parts.push(`<div class='chartBARMode'>${formatChartLineValue(section.chartMode, 'mode', songChartOptions, { section })}</div>`);
        }
        if (songChartOptions.detailLine) {
            parts.push(`<div class='chartBARMeta'>${formatChartMetaLine(theSong, section, idx)}</div>`);
        }
    }

    if (allowInlineCaption && songChartOptions.showCaptions && (captionWidth === Constants.SECTION_CHART_CAPTION_WIDTH.SHORT || captionWidth === Constants.SECTION_CHART_CAPTION_WIDTH.MEDIUM)) {
        parts.push(`<div class='chartBARCaption'>${formatChartCaptionText(section)}</div>`);
    }

    if (isLeadSheetBar && songChartOptions.detailLine) {
        parts.push(`<div class='chartBARBeatCount'><span class='leadSheetLineBARBeatCount'>${barBeats}</span></div>`);
    }

    parts.push('</span>');
    return parts.join('');
}

function createChartLineModel(blockType) {
    return {
        blockType,
        bars: [],
        captions: [],
        sectionIndexes: []
    };
}

function buildChartRenderModel(theSong, theSections, songChartOptions) {
    const chartHeadNames = songChartOptions.HEADNames;
    const blocks = [];
    const allLines = [];
    let currentBlock = null;
    let currentLine = null;

    function flushLine() {
        if (!currentLine || currentLine.bars.length === 0) {
            currentLine = null;
            return;
        }
        currentBlock.lines.push(currentLine);
        allLines.push(currentLine);
        currentLine = null;
    }

    function flushBlock() {
        flushLine();
        if (!currentBlock || currentBlock.lines.length === 0) {
            currentBlock = null;
            return;
        }
        blocks.push(currentBlock);
        currentBlock = null;
    }

    function startBlock(blockType) {
        if (currentBlock && currentBlock.blockType === blockType && currentBlock.lines.length === 0 && !currentLine) {
            return;
        }
        flushBlock();
        currentBlock = {
            blockType,
            lines: []
        };
    }

    function ensureBlock() {
        if (!currentBlock) {
            startBlock(chartHeadNames[0]);
        }
    }

    function startLine() {
        ensureBlock();
        flushLine();
        currentLine = createChartLineModel(currentBlock.blockType);
    }

    theSections.forEach((section, idx) => {
        const chartPosition = getEffectiveChartPosition(section, chartHeadNames);
        switch (chartPosition) {
            case Constants.SECTION_CHART_POSITION.INTRO:
            case Constants.SECTION_CHART_POSITION.OUTRO:
                startBlock(chartPosition);
                break;
            case Constants.SECTION_CHART_POSITION.LINE:
            case Constants.SECTION_CHART_POSITION.BAR:
            default:
                if (isHeadChartPosition(chartPosition, chartHeadNames)) {
                    startBlock(chartPosition);
                } else {
                    ensureBlock();
                }
                break;
        }

        if (chartPosition !== Constants.SECTION_CHART_POSITION.BAR || !currentLine || currentLine.bars.length === 0) {
            startLine();
        }

        const barEntries = createChartBarEntries(section, idx, songChartOptions);
        barEntries.forEach((barEntry) => {
            currentLine.bars.push(barEntry);
        });

        if (!currentLine.sectionIndexes.includes(idx)) {
            currentLine.sectionIndexes.push(idx);
        }

        if (getEffectiveChartCaptionWidth(section) === Constants.SECTION_CHART_CAPTION_WIDTH.LINE) {
            currentLine.captions.push(formatLineCaptionEntry(section, idx, songChartOptions));
        }
    });

    flushBlock();
    return {
        blocks,
        allLines
    };
}

function renderChartLine(theSong, lineModel, songChartOptions, chartBarWidthClass, currentSectionIndex) {
    const lineBars = lineModel.bars.map((barEntry, barEntryIdx) => {
        return formatChartBar(theSong, barEntry, songChartOptions, chartBarWidthClass, barEntryIdx === 0, currentSectionIndex);
    });
    return createChartLineMarkup(lineBars, lineModel.captions);
}

function getCurrentSectionIndex(theSong, theSections) {
    const currentSection = typeof theSong?.getCurrentSection === 'function' ? theSong.getCurrentSection() : null;
    const currentIdx = theSections.findIndex((section) => section === currentSection);
    if (currentIdx >= 0) {
        return currentIdx;
    }
    return Number.isInteger(theSong?.gSectionsCurrentIndex) ? theSong.gSectionsCurrentIndex : 0;
}

function formatLeadSheetLineBar(barEntry, leadSheetLineOptions, isFirstInLine, isCurrentSection) {
    const { section, idx, barBeats, chordText, isRepeatBar } = barEntry;
    const barClasses = ['leadSheetLineBAR'];
    if (isFirstInLine) {
        barClasses.push('leadSheetLineBAR--firstInLine');
    }
    if (isRepeatBar) {
        barClasses.push('leadSheetLineBAR--repeat');
    }
    if (isCurrentSection) {
        barClasses.push('leadSheetLineBAR--currentSection');
    }

    const parts = [
        `<span class='${barClasses.join(' ')}' data-action='linkToSection' data-action-args='[${idx}]'>`,
        `<div class='leadSheetLineBARChord'>${formatChartLineValue(chordText, 'chord', leadSheetLineOptions, { section })}</div>`
    ];

    if (leadSheetLineOptions.modes) {
        parts.push(`<div class='leadSheetLineBARMode'>${formatChartLineValue(section.chartMode, 'mode', leadSheetLineOptions, { section })}</div>`);
    }
    if (leadSheetLineOptions.detailLine) {
        parts.push(`<div class='leadSheetLineBARBeatCount'>${barBeats}</div>`);
    }

    parts.push('</span>');
    return parts.join('');
}

function renderLeadSheetLineRow(lineModel, leadSheetLineOptions, currentSectionIndex) {
    const bars = lineModel.bars.map((barEntry, barEntryIdx) => {
        return formatLeadSheetLineBar(
            barEntry,
            leadSheetLineOptions,
            barEntryIdx === 0,
            barEntry.idx === currentSectionIndex
        );
    });
    return `<div class='leadSheetLineRow'>${bars.join('')}</div>`;
}

function createLeadSheetLinePanel(className, content) {
    return `<div class='leadSheetLinePanel ${className}'>${content}</div>`;
}

function renderLeadSheetLinePlaceholder(leadSheetLineOptions) {
    const parts = [
        "<div class='leadSheetLineRow leadSheetLineRow--placeholder'>",
        "<span class='leadSheetLineBAR leadSheetLineBAR--firstInLine leadSheetLineBAR--placeholder' aria-hidden='true'>",
        "<div class='leadSheetLineBARChord'>&nbsp;</div>"
    ];

    if (leadSheetLineOptions.modes) {
        parts.push("<div class='leadSheetLineBARMode'>&nbsp;</div>");
    }
    if (leadSheetLineOptions.detailLine) {
        parts.push("<div class='leadSheetLineBARBeatCount'>&nbsp;</div>");
    }

    parts.push('</span>');
    parts.push('</div>');
    return parts.join('');
}

export function printChartOptions(theSong) {
    const chartOptions = getEffectiveSongChartOptions(theSong);
    const headNamesText = chartOptions.HEADNames.join('\n');
    const selectTable = "<div class='divViewCard sectionPrinterChartOptionsCard'>"
        + "<table class='viewControls'>"
        + "<tr><th>Option</th><th>Value</th></tr>"
        + `<tr><td>Bar Style</td><td>${formatSongChartBarClassSelectControl(chartOptions.barClass)}</td></tr>`
        + `<tr><td>Chord size</td><td>${formatSongChartFontsizeSelectControl('chordFontsize', chartOptions.chordFontsize, 'Chord size')}</td></tr>`
        + `<tr><td>BAR caption/detail font size</td><td>${formatSongChartFontsizeSelectControl('lineCaptionFontsize', chartOptions.lineCaptionFontsize, 'BAR caption/detail font size')}</td></tr>`
        + `<tr><td>Line caption font size</td><td>${formatSongChartFontsizeSelectControl('boxCaptionFontsize', chartOptions.boxCaptionFontsize, 'Line caption font size')}</td></tr>`
        + `<tr><td>Chart Spacing</td><td>${formatSongChartSpacingSelectControl(chartOptions.chartSpacing)}</td></tr>`
        + "</table>"
        + "</div>";
    const headNamesEditor = "<div class='sectionPrinterChartOptionsHeadNames'>"
        + "<label class='songChartHeadNamesLabel' for='songChartHeadNamesTextarea'>Chart Names</label>"
        + `<textarea id='songChartHeadNamesTextarea' class='songChartHeadNamesTextarea' rows='10' aria-label='Chart Names'>${escapeHtmlAttribute(headNamesText)}</textarea>`
        + "</div>";
    return "<div id='sectionPrinterChartOptions'>"
        + "<div class='sectionPrinterChartOptionsColumn sectionPrinterChartOptionsColumn--left'>"
        + formatSongChartOptionCheckbox('modes', chartOptions.modes, 'Show mode line')
        + formatSongChartOptionCheckbox('detailLine', chartOptions.detailLine, 'Show section detail line')
        + formatSongChartOptionCheckbox('showCaptions', chartOptions.showCaptions, 'Show captions')
        + formatSongChartOptionCheckbox('showNextLine', chartOptions.showNextLine, 'Show Next Line')
        + formatSongChartOptionCheckbox('stripTonalRoots', chartOptions.stripTonalRoots, 'Strip Tonal roots (view only)')
        + formatSongChartOptionCheckbox('addTransposedRootToChord', chartOptions.addTransposedRootToChord, 'Add transposed root to chord', !chartOptions.stripTonalRoots)
        + selectTable
        + "</div>"
        + "<div class='sectionPrinterChartOptionsColumn sectionPrinterChartOptionsColumn--right'>"
        + headNamesEditor
        + "</div>"
        + "</div>";
}

function formatLineCaptionEntry(section, idx, songChartOptions) {
    if (!songChartOptions.showCaptions) {
        return '';
    }
    if (!section?.caption) {
        return '';
    }
    return `<div class='chartLineCaption'>${idx + 1}. ${section.caption}</div>`;
}

function createChartLineMarkup(lineBars, lineCaptions) {
    if (lineBars.length === 0) {
        return '';
    }

    let lineMarkup = `<div class='chartLINE'>${lineBars.join('')}</div>`;
    const nonEmptyCaptions = lineCaptions.filter((caption) => caption);
    if (nonEmptyCaptions.length > 0) {
        lineMarkup += `<div class='chartLineCaptions'>${nonEmptyCaptions.join('')}</div>`;
    }
    return lineMarkup;
}

function getChartBlockClassSuffix(blockType, chartHeadNames) {
    if (blockType === Constants.SECTION_CHART_POSITION.INTRO) {
        return Constants.SECTION_CHART_POSITION.INTRO;
    }
    if (blockType === Constants.SECTION_CHART_POSITION.OUTRO) {
        return Constants.SECTION_CHART_POSITION.OUTRO;
    }
    if (isHeadChartPosition(blockType, chartHeadNames)) {
        return Constants.SECTION_CHART_POSITION.HEAD;
    }
    return Constants.SECTION_CHART_POSITION.HEAD;
}

function createChartBlockTitle(blockType, chartHeadNames) {
    const cssClassSuffix = getChartBlockClassSuffix(blockType, chartHeadNames);
    return `<div class='chart${cssClassSuffix}Title'>${blockType}</div>`;
}

function createChartBlockMarkup(blockType, blockContent, chartHeadNames) {
    if (!blockType) {
        return '';
    }
    const cssClassSuffix = getChartBlockClassSuffix(blockType, chartHeadNames);
    return `<div class='chart${cssClassSuffix}'>${createChartBlockTitle(blockType, chartHeadNames)}${blockContent.join('')}</div>`;
}

export function printSections(theSong, theSections, showDetails) {
    let currentSection = theSong.getCurrentSection();
    let result = "<table class='sectionPrintNotes'><tr><th>ID</th><th>beats</th><th>KEY</th><th style='white-space: nowrap;'>&sharp;&nbsp;/&flat;</th><th>Chord</th><th>Mode</th>"
        + (showDetails ? "<th>Beats</th><th>Position</th><th>Caption Width</th>" : "")
        + "<th>Caption</th>"
        + (showDetails ? "<th>Details</th>" : "")
        + "</tr>";
    let details;
    theSections.forEach((section, idx) => {
        let rowClass = "";
        if (currentSection === section){
            rowClass = "class='sectionPrinterCurrentSectionRow'";
        }
        details = "<pre style='margin:0'>" + getSectionNotesDisplayString(section) + "</pre>";
        const SEP = "</td><td>";
        result += `<tr ${rowClass}><td>`
            + "<a href='#' data-action='linkToSection' data-action-args='[" + idx + "]'>" + (toInt(idx, 0) + 1) + "</a>" + SEP
            + section.beats + SEP
                + "<B style='font-size: 130%;'>" + getSectionKeyDisplay(theSong, section) + "</B>" + SEP
            + (section.sharps ? " &sharp; " : " &flat; ") + SEP
            + (section.chartChord ? "<span class='SPN_CHORD'>"+section.chartChord+"</span>" : "&nbsp;") + SEP
            + (section.chartMode ? "<span class='SPN_MODE'>"+section.chartMode+"</span>" : "&nbsp;") + SEP
                + (showDetails ? (formatChartBeatsPerBarInput(section, idx) + SEP + formatChartPositionSelect(theSong, section, idx) + SEP + formatChartCaptionWidthSelect(section, idx) + SEP) : "")
            + (showDetails ? formatChartCaptionEditor(section, idx) : ("<span class='SPN_SPAN_CAPTION'><b style='font-size: 130%;'>" + section.caption + "</b></span>"))
            + (showDetails ? (SEP + details) : "")
            + "</td></tr>";
    });
    return result + "</table>";
}

export function printSectionsNotes(theSong, theSections){
    const instrumentTableIDs = [];
    const seenTableIDs = new Set();

    function addInstrumentTableID(tableID) {
        if (!seenTableIDs.has(tableID)) {
            seenTableIDs.add(tableID);
            instrumentTableIDs.push(tableID);
        }
    }

    function stripTablePrefix(tableID) {
        if (tableID && tableID.startsWith(Constants.TABLE_ID_PREFIX)) {
            return tableID.substring(Constants.TABLE_ID_PREFIX.length);
        }
        return tableID || '';
    }

    function getNoteName(note) {
        if (note && note.noteName) {
            return note.noteName;
        }
        if (note && note.midinum !== undefined) {
            return TableBuilder.midinumToNoteName(parseInt(note.midinum, 10));
        }
        return '';
    }

    function formatDisplayNote(note, fallbackNoteName = '') {
        const noteName = fallbackNoteName || getNoteName(note);
        if (!noteName) {
            return '';
        }
        return formatOwnedDisplayText(noteName, note?.owner || '');
    }

    function formatNamedNotes(namedNotes) {
        return Object.entries(namedNotes || {})
            .filter(([_, v]) => v && Object.keys(v).length > 0)
            .map(([noteName, note]) => formatDisplayNote(note, noteName))
            .filter((noteName) => !!noteName)
            .join(',');
    }
    function formatPlayedNotes(playedNotes) {
        return (playedNotes || [])
            .map((note) => formatDisplayNote(note))
            .filter((noteMarkup) => !!noteMarkup)
            .join(',');
    }

    function formatRecordedNotes(recordedNotes) {
        const beatMarkup = Object.keys(recordedNotes || {})
            .sort((left, right) => toInt(left, 0) - toInt(right, 0))
            .map((beat) => {
                const noteNames = (recordedNotes[beat] || [])
                    .map((note) => formatDisplayNote(note))
                    .filter((noteMarkup) => !!noteMarkup)
                    .join(',');
                return noteNames ? `<div class='beat'><span class='beatNum'>${beat}:</span> ${noteNames}</div>` : '';
            })
            .filter((beatNotes) => !!beatNotes)
            .join('');

        return beatMarkup ? `<div class='beats'>${beatMarkup}</div>` : '';
    }

    theSections.forEach((section) => {
        section.getAllSectionNotes().forEach(([tableID]) => {
            addInstrumentTableID(tableID);
        });
    });

    let result = "<div id='sectionPrintNotesScroller'><table id='sectionPrintNotesChart' class='sectionPrintNotes'><tr>"
        + "<th class='SPN_TH' rowspan='2'>ID</th>"
        + "<th class='SPN_TH' rowspan='2'>beats</th>"
        + "<th class='SPN_TH' rowspan='2'>KEY</th>"
        + "<th class='SPN_TH' rowspan='2'>&sharp;/&flat;</th>"
        + "<th class='SPN_TH' rowspan='2'>Chord</th>"
        + "<th class='SPN_TH' rowspan='2'>Mode</th>"
        + "<th class='SPN_TH' rowspan='2'>Caption</th>";

    let colorAlt = true;  
    let theClass = "";  
    instrumentTableIDs.forEach((tableID) => {
        theClass = colorAlt ? "SPN_evenColn" : "SPN_oddColn"; 
        result += "<th class='"+theClass+"' colspan='4'>" + stripTablePrefix(tableID) + "</th>";
        colorAlt = !colorAlt;
    });
    result += "</tr><tr>";
    colorAlt = true;
    instrumentTableIDs.forEach(() => {
        theClass = colorAlt ? "SPN_evenCol" : "SPN_oddCol"; 
        result += "<th class='"+theClass+"n'>named</th><th class='"+theClass+"p'>played</th><th class='"+theClass+"r'>rec</th><th class='"+theClass+"c'>Chords</th>";
        colorAlt = !colorAlt;
    });
    result += "</tr>";

    
    let currentSection = theSong.getCurrentSection();
    theSections.forEach((section, idx) => {
        let rowClass = "";
        if (currentSection === section){
            rowClass = "class='sectionPrinterCurrentSectionRow'";
        }
        result += `<tr ${rowClass}><td>`
            + "<a href='#' data-action='linkToSection' data-action-args='[" + idx + "]'>" + (toInt(idx, 0) + 1) + "</a>"
            + "</td><td>" + section.beats
            + "</td><td><B style='font-size: 130%;'>" + getSectionKeyDisplay(theSong, section) + "</B>"
            + "</td><td>" + (section.sharps ? " &sharp; " : " &flat; ")
            + "</td><td>" + (section.chartChord ? section.chartChord : "&nbsp;") 
            + "</td><td>" + (section.chartMode ? section.chartMode : "&nbsp;") 
            + "</td><td class='SPN_CAPTION'><b style='font-size: 130%;'>" + section.caption + "</b></td>";

        instrumentTableIDs.forEach((tableID) => {
            const sn = section.sectionNotesByTable[tableID];
            if (!sn) {
                result += "<td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>";
                return;
            }
            result += "<td><div class='SPN_NN'>" + (formatNamedNotes(sn.namedNotes) || "&nbsp;") + "</div></td>";
            result += "<td><div class='SPN_PN'>" + (formatPlayedNotes(sn.playedNotes) || "&nbsp;") + "</div></td>";
            result += "<td><div class='SPN_RN'>" + (formatRecordedNotes(sn.recordedNotes) || "&nbsp;") + "</div></td>";
            
            let tonalResult = getTonalForTable(theSong, section, tableID);
            let chartChordsNotes = tonalResult.normalizedNamedNotes.join(',');
            let tonalPickerSet = buildTonalPickerSet("SectionPrinterTonal", TonalPickerOrientation.VERTICAL, 
                                                        tableID, idx, 
                                                        tonalResult.chords, section.chartChord, 
                                                        tonalResult.scale,  section.chartMode,
                                                        tonalResult.chord, tonalResult.mode, tonalResult.tonalSourceSet);
            let noteRooTblNm =  tonalResult.noteRootTablename ? `:Player: ${tonalResult.noteRootTablename.slice(Constants.TABLE_ID_PREFIX.length)}` : ''; 
            result += "<td><div class='SPN_CC'>" 
                            +(tonalResult.rootKey ? `<b>noteRoot${noteRooTblNm}:${tonalResult.rootKey}</b>&raquo;<br>` : '')
                            +chartChordsNotes+':'
                            +tonalPickerSet
                            +"</div></td>";
        });

        result += "</tr>";
    });

    return result + "</table></div>";
}

export function printChart(theSong, theSections) {
    const songChartOptions = getEffectiveSongChartOptions(theSong);
    const chartBarWidthClass = getChartBarWidthClass(theSections, songChartOptions);
    const chartParts = [`<div id='sectionPrinterChart'${formatChartStyleVariables(songChartOptions)}>`];
    const chartModel = buildChartRenderModel(theSong, theSections, songChartOptions);
    const currentSectionIndex = getCurrentSectionIndex(theSong, theSections);
    chartModel.blocks.forEach((block) => {
        const blockContent = block.lines.map((lineModel) => renderChartLine(theSong, lineModel, songChartOptions, chartBarWidthClass, currentSectionIndex));
        chartParts.push(createChartBlockMarkup(block.blockType, blockContent, songChartOptions.HEADNames));
    });
    chartParts.push('</div>');
    return chartParts.join('');
}

export function printLeadSheetLine(theSong, theSections, options = {}) {
    const songChartOptions = getEffectiveSongChartOptions(theSong);
    const leadSheetLineOptions = {
        ...songChartOptions,
        barClass: Constants.SONG_CHART_BAR_CLASS.LEADSHEET,
        showCaptions: false
    };
    const rootId = options.rootId || 'sectionPrinterChartLine';
    const chartModel = buildChartRenderModel(theSong, theSections, leadSheetLineOptions);
    const currentSectionIndex = getCurrentSectionIndex(theSong, theSections);
    const currentLineIndex = chartModel.allLines.findIndex((lineModel) => lineModel.sectionIndexes.includes(currentSectionIndex));
    const safeLineIndex = currentLineIndex >= 0 ? currentLineIndex : 0;
    const currentLine = chartModel.allLines[safeLineIndex] || createChartLineModel(songChartOptions.HEADNames[0]);
    const nextLine = songChartOptions.showNextLine ? chartModel.allLines[safeLineIndex + 1] : null;
    const parts = [`<div id='${escapeHtmlAttribute(rootId)}' class='sectionPrinterChartLine'${formatChartStyleVariables(leadSheetLineOptions, false)}>`];

    parts.push(createLeadSheetLinePanel('leadSheetLinePanelCurrent', renderLeadSheetLineRow(currentLine, leadSheetLineOptions, currentSectionIndex)));

    if (songChartOptions.showNextLine) {
        if (nextLine) {
            parts.push(createLeadSheetLinePanel('leadSheetLinePanelNext', renderLeadSheetLineRow(nextLine, leadSheetLineOptions, currentSectionIndex)));
        } else {
            parts.push(createLeadSheetLinePanel('leadSheetLinePanelPlaceholder', renderLeadSheetLinePlaceholder(leadSheetLineOptions)));
        }
    }

    parts.push('</div>');
    return parts.join('');
}


export function getSectionNotesDisplayData(section) {
    const namedNotes = new Set();
    const playedNotes = [];
    const recordedNotes = [];

    section.getAllSectionNotes().forEach(([tableID, sn]) => {
        Object.keys(sn?.namedNotes || {}).forEach((noteName) => {
            namedNotes.add(noteName);
        });

        const playedCount = Array.isArray(sn?.playedNotes) ? sn.playedNotes.length : 0;
        if (playedCount > 0) {
            playedNotes.push(`${tableID}:${playedCount}`);
        }

        const recordedCount = Object.values(sn?.recordedNotes || {}).reduce((count, notesForBeat) => {
            return count + (Array.isArray(notesForBeat) ? notesForBeat.length : 0);
        }, 0);
        if (recordedCount > 0) {
            recordedNotes.push(`${tableID}:${recordedCount}`);
        }
    });

    return {
        namedNotes: Array.from(namedNotes).sort((left, right) => left.localeCompare(right)),
        playedNotes,
        recordedNotes
    };
}

export function getSectionNotesDisplayString(section) {
    const details = getSectionNotesDisplayData(section);
    return JSON.stringify(details, null, 4);
}


