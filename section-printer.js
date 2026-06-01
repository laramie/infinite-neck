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


const { Chord } = globalThis.Tonal?.Chord
    ? globalThis.Tonal
    : await import('tonal');

const CHART_POSITION_VALUES = [
    Constants.SECTION_CHART_POSITION.INTRO,
    Constants.SECTION_CHART_POSITION.HEAD,
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

function getEffectiveSongChartOptions(theSong) {
    const chartOptions = theSong?.chartOptions && typeof theSong.chartOptions === 'object' ? theSong.chartOptions : {};
    return {
        modes: chartOptions.modes !== false,
        detailLine: chartOptions.detailLine !== false,
        showCaptions: chartOptions.showCaptions !== false,
        showNextLine: chartOptions.showNextLine === true,
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
            : '100%'
    };
}

function percentStringToMultiplier(percentValue) {
    const parsed = Number.parseFloat(String(percentValue).replace('%', ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return '1';
    }
    return String(parsed / 100);
}

function getSectionKeyDisplay(theSong, section) {
    return theSong.noteIDToNoteName(section.rootID) + (section.rootIDLead != -1 ? "/" + theSong.noteIDToNoteName(section.rootIDLead) : "");
}

function getSectionBeatsDisplay(section) {
    if (typeof section?.getBeats === 'function') {
        return section.getBeats();
    }
    return section?.beats ?? '';
}

function getEffectiveChartPosition(section) {
    return CHART_POSITION_VALUES.includes(section?.chartPosition)
        ? section.chartPosition
        : Constants.SECTION_CHART_POSITION.BAR;
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

function formatChartPositionSelect(section, idx) {
    const currentValue = getEffectiveChartPosition(section);
    return `<select class='sectionChartPositionSelect' data-section-idx='${idx}' aria-label='Chart position'>`
        + formatSelectOptions(CHART_POSITION_VALUES, currentValue)
        + `</select>`;
}

function formatChartCaptionWidthSelect(section, idx) {
    const currentValue = getEffectiveChartCaptionWidth(section);
    return `<select class='sectionChartCaptionWidthSelect' data-section-idx='${idx}' aria-label='Chart caption width'>`
        + formatSelectOptions(CHART_CAPTION_WIDTH_VALUES, currentValue)
        + `</select>`;
}

function formatSongChartOptionCheckbox(optionName, isChecked, labelText) {
    const checked = isChecked ? ' checked' : '';
    return `<label class='songChartOptionsControl'><input type='checkbox' class='songChartOptionsCheckbox' data-chart-option='${optionName}'${checked}> ${labelText}</label>`;
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

function formatChartStyleVariables(songChartOptions) {
    return ` style='--chart-bar-chord-scale:${percentStringToMultiplier(songChartOptions.chordFontsize)}; --chart-bar-secondary-font-size:${songChartOptions.lineCaptionFontsize}; --chart-line-caption-font-size:${songChartOptions.boxCaptionFontsize};'`;
}

function formatChartLineValue(value) {
    return value ? value : '&nbsp;';
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
    const sectionNumber = idx + 1;
    return `<a href='#' data-action='linkToSection' data-action-args='[${idx}]'>${sectionNumber}</a>:${getSectionKeyDisplay(theSong, section)}:${getSectionBeatsDisplay(section)}`;
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
        `<div class='chartBARChord'>${formatChartLineValue(chordText)}</div>`,
    ];

    if (isLeadSheetBar) {
        if (songChartOptions.modes) {
            parts.push(`<div class='chartBARMode'>${formatChartLineValue(section.chartMode)}</div>`);
        }
    } else {
        if (songChartOptions.modes) {
            parts.push(`<div class='chartBARMode'>${formatChartLineValue(section.chartMode)}</div>`);
        }
        if (songChartOptions.detailLine) {
            parts.push(`<div class='chartBARMeta'>${formatChartMetaLine(theSong, section, idx)}</div>`);
        }
    }

    if (allowInlineCaption && songChartOptions.showCaptions && (captionWidth === Constants.SECTION_CHART_CAPTION_WIDTH.SHORT || captionWidth === Constants.SECTION_CHART_CAPTION_WIDTH.MEDIUM)) {
        parts.push(`<div class='chartBARCaption'>${formatChartCaptionText(section)}</div>`);
    }

    if (isLeadSheetBar && songChartOptions.detailLine) {
        parts.push(`<div class='chartBARBeatCount'>beats:${barBeats}</div>`);
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
            startBlock(Constants.SECTION_CHART_POSITION.HEAD);
        }
    }

    function startLine() {
        ensureBlock();
        flushLine();
        currentLine = createChartLineModel(currentBlock.blockType);
    }

    theSections.forEach((section, idx) => {
        const chartPosition = getEffectiveChartPosition(section);
        switch (chartPosition) {
            case Constants.SECTION_CHART_POSITION.INTRO:
            case Constants.SECTION_CHART_POSITION.HEAD:
            case Constants.SECTION_CHART_POSITION.OUTRO:
                startBlock(chartPosition);
                break;
            case Constants.SECTION_CHART_POSITION.LINE:
            case Constants.SECTION_CHART_POSITION.BAR:
            default:
                ensureBlock();
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
        `<div class='leadSheetLineBARChord'>${formatChartLineValue(chordText)}</div>`
    ];

    if (leadSheetLineOptions.modes) {
        parts.push(`<div class='leadSheetLineBARMode'>${formatChartLineValue(section.chartMode)}</div>`);
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
    const selectTable = "<div class='divViewCard sectionPrinterChartOptionsCard'>"
        + "<table class='viewControls'>"
        + "<tr><th>Option</th><th>Value</th></tr>"
        + `<tr><td>Bar Style</td><td>${formatSongChartBarClassSelectControl(chartOptions.barClass)}</td></tr>`
        + `<tr><td>Chord size</td><td>${formatSongChartFontsizeSelectControl('chordFontsize', chartOptions.chordFontsize, 'Chord size')}</td></tr>`
        + `<tr><td>BAR caption/detail font size</td><td>${formatSongChartFontsizeSelectControl('lineCaptionFontsize', chartOptions.lineCaptionFontsize, 'BAR caption/detail font size')}</td></tr>`
        + `<tr><td>Line caption font size</td><td>${formatSongChartFontsizeSelectControl('boxCaptionFontsize', chartOptions.boxCaptionFontsize, 'Line caption font size')}</td></tr>`
        + "</table>"
        + "</div>";
    return "<div id='sectionPrinterChartOptions'>"
        + formatSongChartOptionCheckbox('modes', chartOptions.modes, 'Show mode line')
        + formatSongChartOptionCheckbox('detailLine', chartOptions.detailLine, 'Show section detail line')
        + formatSongChartOptionCheckbox('showCaptions', chartOptions.showCaptions, 'Show captions')
        + formatSongChartOptionCheckbox('showNextLine', chartOptions.showNextLine, 'Show Next Line')
        + selectTable
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

function createChartBlockTitle(blockType) {
    return `<div class='chart${blockType}Title'>${blockType}</div>`;
}

function createChartBlockMarkup(blockType, blockContent) {
    if (!blockType) {
        return '';
    }
    return `<div class='chart${blockType}'>${createChartBlockTitle(blockType)}${blockContent.join('')}</div>`;
}

export function printSections(theSong, theSections, showDetails) {
    let currentSection = theSong.getCurrentSection();
    let result = "<table class='sectionPrintNotes'><tr><th>ID</th><th>beats</th><th>KEY</th><th>&sharp;/&flat;</th><th>Chord</th><th>Mode</th>"
        + (showDetails ? "<th>Beats</th><th>Position</th><th>Width</th>" : "")
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
            + (section.chartChord ? section.chartChord : "&nbsp;") + SEP
            + (section.chartMode ? section.chartMode : "&nbsp;") + SEP
                + (showDetails ? (formatChartBeatsPerBarInput(section, idx) + SEP + formatChartPositionSelect(section, idx) + SEP + formatChartCaptionWidthSelect(section, idx) + SEP) : "")
            + (showDetails ? formatChartCaptionEditor(section, idx) : ("<b style='font-size: 130%;'>" + section.caption + "</b>"))
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

    function formatNamedNotes(namedNotes) {
        return Object.entries(namedNotes || {})
            .filter(([_, v]) => v && Object.keys(v).length > 0)
            .map(([k]) => k)
            .join(',');
    }
    function formatPlayedNotes(playedNotes) {
        return (playedNotes || [])
            .map((note) => getNoteName(note))
            .filter((noteName) => !!noteName)
            .join(',');
    }

    function formatRecordedNotes(recordedNotes) {
        const beatMarkup = Object.keys(recordedNotes || {})
            .sort((left, right) => toInt(left, 0) - toInt(right, 0))
            .map((beat) => {
                const noteNames = (recordedNotes[beat] || [])
                    .map((note) => getNoteName(note))
                    .filter((noteName) => !!noteName)
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
            + "</td><td><b style='font-size: 130%;'>" + section.caption + "</b></td>";

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
            result += "<td><div class='SPN_CC'>" 
                            +(tonalResult.rootKey ? `<b>noteRoot:${tonalResult.noteRootTablename}:${tonalResult.rootKey}</b>&raquo;` : '')
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
        chartParts.push(createChartBlockMarkup(block.blockType, blockContent));
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
    const currentLine = chartModel.allLines[safeLineIndex] || createChartLineModel(Constants.SECTION_CHART_POSITION.HEAD);
    const nextLine = songChartOptions.showNextLine ? chartModel.allLines[safeLineIndex + 1] : null;
    const parts = [`<div id='${escapeHtmlAttribute(rootId)}' class='sectionPrinterChartLine'${formatChartStyleVariables(leadSheetLineOptions)}>`];

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


