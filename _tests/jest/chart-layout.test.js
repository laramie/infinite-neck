import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import * as Constants from '../../Constants.js';
import { Section } from '../../Section.js';
import { Song } from '../../Song.js';
import { printChart, printChartOptions, printSections } from '../../section-printer.js';

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

function createSongMock(sections, chartOptions = {}) {
    return {
        chartOptions,
        getCurrentSection() {
            return sections[0];
        },
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

        expect(song.chartOptions).toEqual({
            modes: true,
            detailLine: true,
            showCaptions: true,
            barClass: Constants.SONG_CHART_BAR_CLASS.BOX,
            lineCaptionFontsize: '100%',
            boxCaptionFontsize: '100%'
        });
    });

    test('Chart Options renders checkboxes and bar style select with defaults', () => {
        const song = createSongMock([new Section()], {
            modes: true,
            detailLine: true,
            showCaptions: true,
            barClass: Constants.SONG_CHART_BAR_CLASS.BARE,
            lineCaptionFontsize: '120%',
            boxCaptionFontsize: '80%'
        });

        const html = printChartOptions(song);

        expect(html).toContain("data-chart-option='modes' checked");
        expect(html).toContain("data-chart-option='detailLine' checked");
        expect(html).toContain("data-chart-option='showCaptions' checked");
        expect(html).toContain("class='songChartBarClassSelect'");
        expect(html).toContain("<option value='Bare' selected>");
        expect(html).toContain("<option value='LeadSheet'>LeadSheet</option>");
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

        expect(detailsHtml).toContain('<th>Beats</th><th>Position</th><th>Width</th>');
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
        expect(html).toContain("data-action='linkToSection' data-action-args='[0]'>1</a>:C:4");
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
        expect(html.match(/chartBARBeatCount'>beats:4/g)).toHaveLength(2);
        expect(html).toContain("chartBARBeatCount'>beats:2");
        expect(html).not.toContain('chartBARMeta');
        expect(html).toContain('Verse opens');
        expect(html.indexOf('Verse opens')).toBeLessThan(html.indexOf("chartBARBeatCount'>beats:4"));
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
            lineCaptionFontsize: '140%',
            boxCaptionFontsize: '70%'
        });

        const html = printChart(song, sections);

        expect(html).toContain("--chart-bar-secondary-font-size:140%");
        expect(html).toContain("--chart-line-caption-font-size:70%");
        expect(html).toContain('chartBARMode');
        expect(html).toContain('chartLineCaption');
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
        expect(chartHtml).toContain("chartBARBeatCount'>beats:4");
        expect(chartHtml).toContain("chartBARBeatCount'>beats:2");
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
        expect(optionsHtml).toContain("<option value='LeadSheet' selected>");
    });
});
