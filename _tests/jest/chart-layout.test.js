import * as Constants from '../../Constants.js';
import { Section } from '../../Section.js';
import { Song } from '../../Song.js';
import { printChart, printChartOptions, printSections } from '../../section-printer.js';

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
            barClass: Constants.SONG_CHART_BAR_CLASS.BOX,
            lineCaptionFontsize: '120%',
            boxCaptionFontsize: '80%'
        });

        const html = printChartOptions(song);

        expect(html).toContain("data-chart-option='modes' checked");
        expect(html).toContain("data-chart-option='detailLine' checked");
        expect(html).toContain("data-chart-option='showCaptions' checked");
        expect(html).toContain("class='songChartBarClassSelect'");
        expect(html).toContain("<option value='Box' selected>");
        expect(html).toContain("class='songChartFontsizeSelect' data-chart-option='lineCaptionFontsize'");
        expect(html).toContain("<option value='120%' selected>");
        expect(html).toContain("class='songChartFontsizeSelect' data-chart-option='boxCaptionFontsize'");
        expect(html).toContain("<option value='80%' selected>");
    });

    test('Chart Details adds Position and Width controls while Summary remains unchanged', () => {
        const section = new Section({
            caption: 'A section',
            chartChord: 'Em7#5',
            chartMode: 'E phrygian',
            chartPosition: Constants.SECTION_CHART_POSITION.HEAD,
            chartCaptionWidth: Constants.SECTION_CHART_CAPTION_WIDTH.MEDIUM
        });
        const sections = [section];
        const song = createSongMock(sections);

        const detailsHtml = printSections(song, sections, true);
        const summaryHtml = printSections(song, sections, false);

        expect(detailsHtml).toContain('<th>Position</th><th>Width</th>');
        expect(detailsHtml).toContain("class='sectionChartPositionSelect'");
        expect(detailsHtml).toContain("class='sectionChartCaptionWidthSelect'");
        expect(summaryHtml).not.toContain('<th>Position</th>');
        expect(summaryHtml).not.toContain("sectionChartPositionSelect");
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
        expect(html).toContain('3. Third caption');
        expect(html).toContain('Short caption');
        expect(html).toContain("data-action='linkToSection' data-action-args='[0]'>1</a>:C:4");
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

    test('Chart output honors song chartOptions for modes, detailLine, and barClass', () => {
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
            barClass: Constants.SONG_CHART_BAR_CLASS.LEADSHEET
        });

        const html = printChart(song, sections);

        expect(html).toContain('barClass-LeadSheet');
        expect(html).not.toContain('chartBARMode');
        expect(html).not.toContain('chartBARMeta');
        expect(html).toContain('chartBARChord');
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
});
