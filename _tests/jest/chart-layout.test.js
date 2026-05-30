import * as Constants from '../../Constants.js';
import { Section } from '../../Section.js';
import { printChart, printSections } from '../../section-printer.js';

function createSongMock(sections) {
    return {
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
        expect(html).toContain("class='chartBAR chartBAR--short'");
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
});
