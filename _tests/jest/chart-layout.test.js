import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import * as Constants from '../../Constants.js';
import { Section } from '../../Section.js';
import { Song } from '../../Song.js';
import { printChart, printChartOptions, printLeadSheetLine, printSections } from '../../section-printer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHART_FIXTURE_FILE = path.join(__dirname, '../../songs/tests/chart-test-fixture.json');

function loadChartFixtureSong() {
    const data = JSON.parse(fs.readFileSync(CHART_FIXTURE_FILE, 'utf8'));
    const song = new Song(data);
    song.setHeadless(true, true);
    song.ensureDefaultSection();
    song.fixupCurrentIndexForLoadedSong();
    return song;
}

function createSongMock(sections, chartOptions = {}, currentSectionIndex = 0) {
    return {
        chartOptions,
        getCurrentSection() {
            return sections[currentSectionIndex] || sections[0];
        },
        gSectionsCurrentIndex: currentSectionIndex,
        noteIDToNoteName(noteIndex) {
            const normalizedIndex = Number.parseInt(noteIndex, 10);
            return Constants.noteIDToNoteNameRaw(Number.isNaN(normalizedIndex) ? 0 : normalizedIndex);
        }
    };
}

describe('chart layout rendering', () => {
    test('Section defaults include chartPosition and chartCaptionWidth', () => {
        const section = new Section();

        expect(section.chartPosition).toBe(Constants.SECTION_CHART_POSITION.BAR);
        expect(section.chartCaptionWidth).toBe(Constants.SECTION_CHART_CAPTION_WIDTH.NONE);
    });

    test('Song defaults include chartOptions', () => {
        const song = new Song({ sections: [{}] });

        expect(song.pluginFiringOrder).toEqual(['t', 'f', 'a', 'o', 'c', 'm']);

        expect(song.chartOptions).toEqual({
            modes: true,
            detailLine: true,
            showCaptions: true,
            showNextLine: false,
            stripTonalRoots: false,
            addTransposedRootToChord: false,
            HEADNames: ['HEAD', 'BRIDGE', 'CHORUS', 'SOLO', 'CODA'],
            barClass: Constants.SONG_CHART_BAR_CLASS.BOX,
            chartSpacing: 'relaxed',
            chordFontsize: '100%',
            lineCaptionFontsize: '100%',
            boxCaptionFontsize: '100%'
        });
    });

    test('Chart Options renders checkboxes and bar style select with defaults', () => {
        const song = createSongMock([new Section()], {
            modes: true,
            detailLine: true,
            showCaptions: true,
            showNextLine: true,
            stripTonalRoots: true,
            addTransposedRootToChord: true,
            HEADNames: ['BRIDGE', 'HEAD', 'FOO'],
            barClass: Constants.SONG_CHART_BAR_CLASS.BARE,
            chartSpacing: 'comfy',
            chordFontsize: '180%',
            lineCaptionFontsize: '120%',
            boxCaptionFontsize: '80%'
        });

        const html = printChartOptions(song);

        expect(html).toContain("data-chart-option='modes' checked");
        expect(html).toContain("data-chart-option='detailLine' checked");
        expect(html).toContain("data-chart-option='showCaptions' checked");
        expect(html).toContain("data-chart-option='showNextLine' checked");
        expect(html).toContain("data-chart-option='stripTonalRoots' checked");
        expect(html).toContain("data-chart-option='addTransposedRootToChord' checked");
        expect(html.indexOf("data-chart-option='showNextLine' checked")).toBeLessThan(html.indexOf("data-chart-option='stripTonalRoots' checked"));
        expect(html.indexOf("data-chart-option='stripTonalRoots' checked")).toBeLessThan(html.indexOf("data-chart-option='addTransposedRootToChord' checked"));
        expect(html).toContain("class='divViewCard sectionPrinterChartOptionsCard'");
        expect(html).toContain("class='sectionPrinterChartOptionsColumn sectionPrinterChartOptionsColumn--left'");
        expect(html).toContain("class='sectionPrinterChartOptionsColumn sectionPrinterChartOptionsColumn--right'");
        expect(html).toContain("class='sectionPrinterChartOptionsHeadNames'");
        expect(html).toContain("class='songChartHeadNamesLabel' for='songChartHeadNamesTextarea'>Chart Names</label>");
        expect(html).toContain("id='songChartHeadNamesTextarea' class='songChartHeadNamesTextarea'");
        expect(html).toContain('>BRIDGE\nHEAD\nFOO</textarea>');
        expect(html).toContain("<table class='viewControls'>");
        expect(html).toContain('<tr><td>Bar Style</td><td><select');
        expect(html).toContain('<tr><td>Chart Spacing</td><td><select');
        expect(html).toContain('<tr><td>Chord size</td><td><select');
        expect(html).toContain('<tr><td>BAR caption/detail font size</td><td><select');
        expect(html).toContain('<tr><td>Line caption font size</td><td><select');
        expect(html).not.toContain('>Bar Style <select');
        expect(html).not.toContain('>Chord size <select');
        expect(html).not.toContain('>BAR caption/detail font size <select');
        expect(html).not.toContain('>Line caption font size <select');
        expect(html).toContain("class='songChartBarClassSelect'");
        expect(html).toContain("class='songChartSpacingSelect' data-chart-option='chartSpacing'");
        expect(html).toContain("<option value='comfy' selected>");
        expect(html).toContain("<option value='Bare' selected>");
        expect(html).toContain("<option value='LeadSheet'>LeadSheet</option>");
        expect(html).toContain("class='songChartFontsizeSelect' data-chart-option='chordFontsize'");
        expect(html).toContain("<option value='180%' selected>");
        expect(html).toContain("class='songChartFontsizeSelect' data-chart-option='lineCaptionFontsize'");
        expect(html).toContain("<option value='120%' selected>");
        expect(html).toContain("class='songChartFontsizeSelect' data-chart-option='boxCaptionFontsize'");
        expect(html).toContain("<option value='80%' selected>");
    });

    test('Chart Details adds Beats, Position, Width, and caption editing controls while Summary remains unchanged', () => {
        const section = new Section({
            caption: 'A section',
            chartChord: 'Em7#5',
            chartMode: 'E phrygian',
            beatsPerBar: '4',
            chartPosition: Constants.SECTION_CHART_POSITION.HEAD,
            chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.MEDIUM
        });
        const sections = [section];
        const song = createSongMock(sections);

        const detailsHtml = printSections(song, sections, true);
        const summaryHtml = printSections(song, sections, false);

        expect(detailsHtml).toContain('<th>Beats</th><th>Position</th><th>Caption Width</th>');
        expect(detailsHtml).toContain("class='sectionChartBeatsPerBarInput'");
        expect(detailsHtml).toContain("value='4'");
        expect(detailsHtml).toContain("class='sectionChartPositionSelect'");
        expect(detailsHtml).toContain("class='sectionChartCaptionWidthSelect'");
        expect(detailsHtml).toContain("class='sectionChartCaptionCell' data-section-idx='0'");
        expect(detailsHtml).toContain("class='sectionChartCaptionDisplay'>A section</div>");
        expect(detailsHtml).toContain("class='sectionChartCaptionTextarea'");
        expect(detailsHtml).toContain("class='sectionChartCaptionSaveButton'");
        expect(summaryHtml).not.toContain('<th>Beats</th>');
        expect(summaryHtml).not.toContain('sectionChartBeatsPerBarInput');
        expect(summaryHtml).not.toContain('<th>Position</th>');
        expect(summaryHtml).not.toContain("sectionChartPositionSelect");
        expect(summaryHtml).not.toContain('sectionChartCaptionTextarea');
    });

    test('Chart output creates implicit HEAD block, line containers, and mixed caption rendering', () => {
        const sections = [
            new Section({
                chartChord: 'Em7#5',
                chartMode: 'E phrygian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.NONE,
                rootID: '3',
                beats: 4,
                caption: 'ignored'
            }),
            new Section({
                chartChord: 'A7',
                chartMode: '',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.NONE,
                rootID: '3',
                beats: 4,
                caption: 'ignored'
            }),
            new Section({
                chartChord: 'Dm7',
                chartMode: 'D dorian',
                chartPosition: Constants.SECTION_CHART_POSITION.LINE,
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.LINE,
                rootID: '3',
                beats: 4,
                caption: 'Third caption'
            }),
            new Section({
                chartChord: 'G7',
                chartMode: 'G mixolydian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.SHORT,
                rootID: '3',
                beats: 4,
                caption: 'Short caption'
            })
        ];
        const song = createSongMock(sections);

        const html = printChart(song, sections);

        expect(html).toContain("class='chartHEADTitle'>HEAD</div>");
        expect(html.match(/class='chartLINE'/g)).toHaveLength(2);
        expect(html).toContain('chartBAR--short');
        expect(html.match(/chartBAR--short/g)).toHaveLength(4);
        expect(html).toContain('3. Third caption');
        expect(html).toContain('Short caption');
        expect(html).toContain("data-action='linkToSection' data-action-args='[0]'>1</a>");
        expect(html).toContain("class='leadSheetLineBARBeatCount'>4</span>");
    });

    test('Chart output uses medium width for all bars when any section has medium caption width', () => {
        const sections = [
            new Section({ chartChord: 'C', chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.NONE, rootID: '3', beats: 4 }),
            new Section({ chartChord: 'F', chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.MEDIUM, rootID: '3', beats: 4 })
        ];
        const song = createSongMock(sections);

        const html = printChart(song, sections);

        expect(html).toContain('chartBAR--medium');
        expect(html).not.toContain('chartBAR--short');
    });

    test('Chart output creates explicit INTRO, HEAD, and OUTRO containers', () => {
        const sections = [
            new Section({ chartPosition: Constants.SECTION_CHART_POSITION.INTRO, chartChord: 'C', rootID: '3', beats: 4 }),
            new Section({ chartPosition: Constants.SECTION_CHART_POSITION.BAR, chartChord: 'F', rootID: '3', beats: 4 }),
            new Section({ chartPosition: Constants.SECTION_CHART_POSITION.HEAD, chartChord: 'G', rootID: '3', beats: 4 }),
            new Section({ chartPosition: Constants.SECTION_CHART_POSITION.OUTRO, chartChord: 'C', rootID: '3', beats: 4 })
        ];
        const song = createSongMock(sections);

        const html = printChart(song, sections);

        expect(html).toContain("class='chartINTROTitle'>INTRO</div>");
        expect(html).toContain("class='chartHEADTitle'>HEAD</div>");
        expect(html).toContain("class='chartOUTROTitle'>OUTRO</div>");
    });

    test('Chart output honors Bare barClass without changing standard bar contents', () => {
        const sections = [
            new Section({
                chartChord: 'Em7#5',
                chartMode: 'E phrygian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                rootID: '3',
                beats: 4
            })
        ];
        const song = createSongMock(sections, {
            modes: false,
            detailLine: false,
            barClass: Constants.SONG_CHART_BAR_CLASS.BARE
        });

        const html = printChart(song, sections);

        expect(html).toContain('barClass-Bare');
        expect(html).not.toContain('chartBARMode');
        expect(html).not.toContain('chartBARMeta');
        expect(html).toContain('chartBARChord');
    });

    test('Chart output makes Box-style bars clickable and highlights the current section', () => {
        const sections = [
            new Section({
                chartChord: 'Cmaj7',
                chartMode: 'C ionian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                rootID: '3',
                beats: 4
            }),
            new Section({
                chartChord: 'F7',
                chartMode: 'F mixolydian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                rootID: '3',
                beats: 4
            })
        ];
        const song = createSongMock(sections, {
            barClass: Constants.SONG_CHART_BAR_CLASS.BOX
        }, 1);

        const html = printChart(song, sections);

        expect(html).toContain("data-action='linkToSection' data-action-args='[0]'");
        expect(html).toContain("data-action='linkToSection' data-action-args='[1]'");
        expect(html).toMatch(/class='chartBAR [^']*barClass-Box[^']*chartBAR--currentSection[^']*' data-action='linkToSection' data-action-args='\[1\]'/);
    });

    test('Bare chart style stays Box-sized and only removes borders', () => {
        const css = fs.readFileSync(path.join(__dirname, '../../section-printer.css'), 'utf8');
        const bareBlockMatch = css.match(/\.barClass-Bare\s*\{([^}]*)\}/);

        expect(bareBlockMatch).not.toBeNull();
        expect(bareBlockMatch[1]).toContain('border: 0;');
        expect(bareBlockMatch[1]).not.toContain('font-size');
    });

    test('LeadSheet expands a section into repeated bars, keeps mode line, and makes bars clickable', () => {
        const sections = [
            new Section({
                chartChord: 'Em7#5',
                chartMode: 'E phrygian',
                caption: 'Verse opens',
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.SHORT,
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                beatsPerBar: '4',
                rootID: '3',
                beats: 10
            })
        ];
        const song = createSongMock(sections, {
            barClass: Constants.SONG_CHART_BAR_CLASS.LEADSHEET
        });

        const html = printChart(song, sections);

        expect(html).toContain('barClass-LeadSheet');
        expect(html).toContain('chartBAR--leadSheet');
        expect(html).toContain('chartBAR--firstInLine');
        expect(html).toContain("data-action='linkToSection' data-action-args='[0]'");
        expect(html).toContain('Em7#5');
        expect(html).toContain('>%<');
        expect(html).toContain('chartBARMode');
        expect(html).toContain('E phrygian');
        expect(html.match(/class='leadSheetLineBARBeatCount'>4<\/span>/g)).toHaveLength(2);
        expect(html).toContain("class='leadSheetLineBARBeatCount'>2</span>");
        expect(html).not.toContain('chartBARMeta');
        expect(html).toContain('Verse opens');
        expect(html.indexOf('Verse opens')).toBeLessThan(html.indexOf("class='leadSheetLineBARBeatCount'>4</span>"));
    });

    test('LeadSheet highlights all repeated bars for the current section', () => {
        const sections = [
            new Section({
                chartChord: 'Em7#5',
                chartMode: 'E phrygian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                beatsPerBar: '4',
                rootID: '3',
                beats: 10
            })
        ];
        const song = createSongMock(sections, {
            barClass: Constants.SONG_CHART_BAR_CLASS.LEADSHEET
        }, 0);

        const html = printChart(song, sections);

        expect(html.match(/chartBAR--currentSection/g)).toHaveLength(3);
        expect(html.match(/data-action='linkToSection' data-action-args='\[0\]'/g)).toHaveLength(3);
    });

    test('LeadSheet hides beats line when show section detail line is off', () => {
        const sections = [
            new Section({
                chartChord: 'A7',
                chartMode: 'A mixolydian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                beatsPerBar: '2',
                rootID: '3',
                beats: 4
            })
        ];
        const song = createSongMock(sections, {
            barClass: Constants.SONG_CHART_BAR_CLASS.LEADSHEET,
            detailLine: false,
            modes: true
        });

        const html = printChart(song, sections);

        expect(html).toContain('chartBARMode');
        expect(html).toContain('A mixolydian');
        expect(html).not.toContain('chartBARBeatCount');
        expect(html).not.toContain('beats:2');
    });

    test('LeadSheetLine renders the current line with dedicated compact classes and ignores captions', () => {
        const sections = [
            new Section({
                chartChord: 'Cmaj7',
                chartMode: 'C ionian',
                chartPosition: Constants.SECTION_CHART_POSITION.HEAD,
                beatsPerBar: '2',
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.LINE,
                caption: 'Ignored caption one',
                rootID: '3',
                beats: 4
            }),
            new Section({
                chartChord: 'F7',
                chartMode: 'F mixolydian',
                chartPosition: Constants.SECTION_CHART_POSITION.LINE,
                beatsPerBar: '2',
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.SHORT,
                caption: 'Ignored caption two',
                rootID: '3',
                beats: 4
            })
        ];
        const song = createSongMock(sections, {
            barClass: Constants.SONG_CHART_BAR_CLASS.BOX,
            showCaptions: true,
            modes: true,
            detailLine: true,
            showNextLine: false
        }, 1);

        const html = printLeadSheetLine(song, sections);

        expect(html).toContain("id='sectionPrinterChartLine'");
        expect(html).toContain("--chart-bar-chord-scale:1");
        expect(html).toContain("--chart-bar-secondary-font-size:100%");
        expect(html).toContain("--chart-line-caption-font-size:100%");
        expect(html).toContain("class='leadSheetLineBARMode'");
        expect(html).toContain("class='leadSheetLineBARBeatCount'");
        expect(html).toContain('leadSheetLinePanelCurrent');
        expect(html).not.toContain('leadSheetLinePanelNext');
        expect(html).toContain('leadSheetLineBAR');
        expect(html).toContain('leadSheetLineBAR--currentSection');
        expect(html).toContain('leadSheetLineBARChord');
        expect(html).toContain('>%<');
        expect(html).not.toContain('Ignored caption one');
        expect(html).not.toContain('Ignored caption two');
        expect(html).not.toContain('barClass-Box');
    });

    test('LeadSheetLine mode and beats follow BAR caption/detail font size', () => {
        const sections = [
            new Section({
                chartChord: 'Dm7',
                chartMode: 'D dorian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                beatsPerBar: '2',
                rootID: '3',
                beats: 4
            })
        ];
        const song = createSongMock(sections, {
            barClass: Constants.SONG_CHART_BAR_CLASS.BOX,
            modes: true,
            detailLine: true,
            lineCaptionFontsize: '140%'
        });

        const html = printLeadSheetLine(song, sections);

        expect(html).toContain("--chart-bar-secondary-font-size:140%");
        expect(html).toContain("class='leadSheetLineBARMode'>D dorian</div>");
        expect(html).toContain("class='leadSheetLineBARBeatCount'>2</div>");
    });

    test('Chart and LeadSheetLine can strip Tonal roots in view-only mode', () => {
        const sections = [
            new Section({
                chartChord: 'Cm7b5',
                chartMode: 'C locrian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                beatsPerBar: '4',
                rootID: '3',
                beats: 4
            })
        ];

        const strippedSong = createSongMock(sections, {
            barClass: Constants.SONG_CHART_BAR_CLASS.LEADSHEET,
            modes: true,
            detailLine: true,
            stripTonalRoots: true
        });
        const strippedChartHtml = printChart(strippedSong, sections);
        const strippedLineHtml = printLeadSheetLine(strippedSong, sections);

        expect(strippedChartHtml).toContain("class='chartBARChord'>m7b5</div>");
        expect(strippedChartHtml).toContain("class='chartBARMode'>locrian</div>");
        expect(strippedLineHtml).toContain("class='leadSheetLineBARChord'>m7b5</div>");
        expect(strippedLineHtml).toContain("class='leadSheetLineBARMode'>locrian</div>");

        const unstrippedSong = createSongMock(sections, {
            barClass: Constants.SONG_CHART_BAR_CLASS.LEADSHEET,
            modes: true,
            detailLine: true,
            stripTonalRoots: false
        });
        const unstrippedChartHtml = printChart(unstrippedSong, sections);
        const unstrippedLineHtml = printLeadSheetLine(unstrippedSong, sections);

        expect(unstrippedChartHtml).toContain("class='chartBARChord'>Cm7b5</div>");
        expect(unstrippedChartHtml).toContain("class='chartBARMode'>C locrian</div>");
        expect(unstrippedLineHtml).toContain("class='leadSheetLineBARChord'>Cm7b5</div>");
        expect(unstrippedLineHtml).toContain("class='leadSheetLineBARMode'>C locrian</div>");
    });

    test('Chart Options keeps add transposed root disabled until strip roots is enabled', () => {
        const song = createSongMock([new Section()], {
            stripTonalRoots: false,
            addTransposedRootToChord: true
        });

        const html = printChartOptions(song);

        expect(html).toContain("data-chart-option='addTransposedRootToChord' disabled");
        expect(html).not.toContain("data-chart-option='addTransposedRootToChord' checked");
    });

    test('Chart and LeadSheetLine can prepend transposed root when strip roots and add root are both enabled', () => {
        const sections = [
            new Section({
                chartChord: 'Cm7b5',
                chartMode: 'C locrian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                beatsPerBar: '4',
                rootID: '3',
                beats: 4
            })
        ];

        const song = createSongMock(sections, {
            barClass: Constants.SONG_CHART_BAR_CLASS.LEADSHEET,
            modes: true,
            detailLine: true,
            stripTonalRoots: true,
            addTransposedRootToChord: true
        });

        const chartHtml = printChart(song, sections);
        const lineHtml = printLeadSheetLine(song, sections);

        expect(chartHtml).toContain("class='chartBARChord'><b class='chartTransposedRoot'>C</b>m7b5</div>");
        expect(chartHtml).toContain("class='chartBARMode'><b class='chartTransposedRoot'>C</b> locrian</div>");
        expect(lineHtml).toContain("class='leadSheetLineBARChord'><b class='chartTransposedRoot'>C</b>m7b5</div>");
        expect(lineHtml).toContain("class='leadSheetLineBARMode'><b class='chartTransposedRoot'>C</b> locrian</div>");
    });

    test('LeadSheetLine optionally renders the next line and preserves placeholder space at the end', () => {
        const sections = [
            new Section({
                chartChord: 'Am7',
                chartMode: 'A aeolian',
                chartPosition: Constants.SECTION_CHART_POSITION.HEAD,
                beatsPerBar: '2',
                rootID: '3',
                beats: 4
            }),
            new Section({
                chartChord: 'Dm7',
                chartMode: 'D dorian',
                chartPosition: Constants.SECTION_CHART_POSITION.LINE,
                beatsPerBar: '2',
                rootID: '3',
                beats: 4
            })
        ];

        const nextLineSong = createSongMock(sections, {
            showNextLine: true,
            modes: false,
            detailLine: false,
            chordFontsize: '120%',
            lineCaptionFontsize: '90%',
            boxCaptionFontsize: '80%'
        }, 0);
        const htmlWithNext = printLeadSheetLine(nextLineSong, sections);

        expect(htmlWithNext).toContain("--chart-bar-chord-scale:1.2");
        expect(htmlWithNext).toContain("--chart-bar-secondary-font-size:90%");
        expect(htmlWithNext).toContain("--chart-line-caption-font-size:80%");
        expect(htmlWithNext).toContain('leadSheetLinePanelNext');
        expect(htmlWithNext).not.toContain('leadSheetLinePanelPlaceholder');
        expect(htmlWithNext).not.toContain('leadSheetLineBARMode');
        expect(htmlWithNext).not.toContain('leadSheetLineBARBeatCount');

        const placeholderSong = createSongMock(sections, {
            showNextLine: true,
            modes: true,
            detailLine: true
        }, 1);
        const htmlWithPlaceholder = printLeadSheetLine(placeholderSong, sections);

        expect(htmlWithPlaceholder).toContain('leadSheetLinePanelPlaceholder');
        expect(htmlWithPlaceholder).toContain('leadSheetLineRow--placeholder');
    });

    test('Chart output applies song chart font-size variables', () => {
        const sections = [
            new Section({
                chartChord: 'G7',
                chartMode: 'G mixolydian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.LINE,
                caption: 'Line caption',
                rootID: '3',
                beats: 4
            })
        ];
        const song = createSongMock(sections, {
            chartSpacing: 'tight',
            chordFontsize: '180%',
            lineCaptionFontsize: '140%',
            boxCaptionFontsize: '70%'
        });

        const html = printChart(song, sections);

        expect(html).toContain("--chart-bar-chord-scale:1.8");
        expect(html).toContain("--chart-bar-secondary-font-size:140%");
        expect(html).toContain("--chart-line-caption-font-size:70%");
        expect(html).toContain("--chart-panel-padding:0.4em");
        expect(html).toContain("--chart-bar-padding:0.2em");
        expect(html).toContain("--chart-bar-width:8em");
        expect(html).toContain("--chart-bar-leadsheet-width:10em");
        expect(html).toContain("--chart-bar-short-width:10em");
        expect(html).toContain('chartBARMode');
        expect(html).toContain('chartLineCaption');
    });

    test('LeadSheetLine ignores chart spacing vars while still using chart font-size vars', () => {
        const sections = [
            new Section({
                chartChord: 'Dm7',
                chartMode: 'D dorian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                beatsPerBar: '2',
                rootID: '3',
                beats: 4
            })
        ];
        const song = createSongMock(sections, {
            chartSpacing: 'tight',
            chordFontsize: '160%',
            lineCaptionFontsize: '120%',
            boxCaptionFontsize: '80%'
        });

        const html = printLeadSheetLine(song, sections);

        expect(html).toContain("--chart-bar-chord-scale:1.6");
        expect(html).toContain("--chart-bar-secondary-font-size:120%");
        expect(html).toContain("--chart-line-caption-font-size:80%");
        expect(html).not.toContain("--chart-panel-padding:");
        expect(html).not.toContain("--chart-bar-padding:");
        expect(html).not.toContain("--chart-bar-width:");
        expect(html).not.toContain("--chart-bar-leadsheet-width:");
        expect(html).not.toContain("--chart-bar-short-width:");
    });

    test('Chart output suppresses both bar and line captions when showCaptions is false', () => {
        const sections = [
            new Section({
                chartChord: 'Dm7',
                chartMode: 'D dorian',
                chartPosition: Constants.SECTION_CHART_POSITION.BAR,
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.SHORT,
                caption: 'Bar caption',
                rootID: '3',
                beats: 4
            }),
            new Section({
                chartChord: 'G7',
                chartMode: 'G mixolydian',
                chartPosition: Constants.SECTION_CHART_POSITION.LINE,
                chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.LINE,
                caption: 'Line caption',
                rootID: '3',
                beats: 4
            })
        ];
        const song = createSongMock(sections, {
            showCaptions: false
        });

        const html = printChart(song, sections);

        expect(html).not.toContain('chartBARCaption');
        expect(html).not.toContain('chartLineCaptions');
        expect(html).not.toContain('Bar caption');
        expect(html).not.toContain('Line caption');
    });

    test('fixture-backed chart renders sprint LeadSheet structure and Details controls from disk', () => {
        const song = loadChartFixtureSong();
        const sections = song.getSections();

        const chartHtml = printChart(song, sections);
        const detailsHtml = printSections(song, sections, true);
        const optionsHtml = printChartOptions(song);

        expect(song.chartOptions.barClass).toBe(Constants.SONG_CHART_BAR_CLASS.LEADSHEET);
        expect(chartHtml).toContain("class='chartINTROTitle'>INTRO</div>");
        expect(chartHtml).toContain("class='chartHEADTitle'>HEAD</div>");
        expect(chartHtml).toContain("class='chartOUTROTitle'>OUTRO</div>");
        expect(chartHtml).toContain('barClass-LeadSheet');
        expect(chartHtml).toContain('chartBAR--leadSheet');
        expect(chartHtml).toContain('Section One');
        expect(chartHtml).toContain('Section Three, Sweetly');
        expect(chartHtml).toContain("class='leadSheetLineBARBeatCount'>4</span>");
        expect(chartHtml).toContain("class='leadSheetLineBARBeatCount'>2</span>");
        expect(chartHtml).toContain('>%<');
        expect(chartHtml).toContain('chartLineCaptions');
        expect(chartHtml).toContain('6. In my dying years, in my dying yearss, I\'m gonna beat up all my childhood fears');
        expect(chartHtml).toContain("data-action='linkToSection' data-action-args='[2]'");

        expect(detailsHtml).toContain("class='sectionChartBeatsPerBarInput' data-section-idx='2'");
        expect(detailsHtml).toContain("value='4'");
        expect(detailsHtml).toContain("class='sectionChartCaptionTextarea'");
        expect(detailsHtml).toContain('Section Three, Sweetly');

        expect(optionsHtml).toContain("data-chart-option='modes' checked");
        expect(optionsHtml).toContain("data-chart-option='detailLine' checked");
        expect(optionsHtml).toContain("data-chart-option='showCaptions' checked");
        expect(optionsHtml).toContain("data-chart-option='showNextLine'");
        expect(optionsHtml).toContain("data-chart-option='stripTonalRoots'");
        expect(optionsHtml).toContain("data-chart-option='addTransposedRootToChord'");
        expect(optionsHtml).toContain("<option value='LeadSheet' selected>");
    });
});
