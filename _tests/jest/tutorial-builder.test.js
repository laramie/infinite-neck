import {
    buildLessonSectionListModel,
    buildTutorialPromptModel,
    renderLessonSectionList,
    renderPracticeList,
    renderTutorialPrompt
} from '../../templates/tutorial/tutorial.builder.js';

function tutorialSong(level = 'strict') {
    return {
        tutorial: { level, caption: 'Course / Lesson' },
        sections: [
            { tutorial: { caption: 'Intro', prompt: { lines: ['<p>Start <a href="#app-action:nextSection">Next</a></p>'] } } },
            { tutorial: { caption: 'Loop', prompt: { lines: ['<table><tr><td><a href="#app-action:prevSection">Prev</a></td></tr></table>'] } } },
            {}
        ]
    };
}

describe('Tutorial Prompt builder', () => {
    test('buildLessonSectionListModel renders blank metadata rows and current/bookmark/done state', () => {
        const rows = buildLessonSectionListModel({
            song: tutorialSong(),
            currentSectionIndex: 1,
            progress: { doneSectionIndexes: [0], bookmarkSectionIndex: 1 },
            includeInLoopingSectionIndexes: [1]
        });

        expect(rows).toEqual([
            expect.objectContaining({ sectionNumber: 1, caption: 'Intro', current: false, done: true, bookmarked: false, includeInLooping: false }),
            expect.objectContaining({ sectionNumber: 2, caption: 'Loop', current: true, done: false, bookmarked: true, includeInLooping: true }),
            expect.objectContaining({ sectionNumber: 3, caption: '', current: false, done: false, bookmarked: false, includeInLooping: false })
        ]);
    });

    test('renders strict Prompt Area with breadcrumbs and open LessonSectionList', () => {
        const model = buildTutorialPromptModel({
            song: tutorialSong(),
            currentSectionIndex: 1,
            progress: { doneSectionIndexes: [0], bookmarkSectionIndex: 1 },
            includeInLoopingSectionIndexes: [1],
            lessonSectionListOpen: true
        });
        const html = renderTutorialPrompt(model);

        expect(html).toContain('tutorialPrompt--strict');
        expect(html).toContain('lessonSectionListCurrentRow');
        expect(html).toContain('lessonSectionListBookmark');
        expect(html).toContain('data-action="tutorialToggleIncludeInLooping"');
        expect(html).toContain('<table><tr><td><a href="#app-action:prevSection">Prev</a></td></tr></table>');
    });

    test('renders wizard Prompt Area without strict LessonSectionList chrome', () => {
        const model = buildTutorialPromptModel({
            song: tutorialSong('wizard'),
            currentSectionIndex: 0,
            lessonSectionListOpen: true
        });
        const html = renderTutorialPrompt(model);

        expect(html).toContain('tutorialPrompt--wizard');
        expect(html).toContain('Intro');
        expect(html).toContain('Start');
        expect(html).not.toContain('lessonSectionList');
        expect(html).not.toContain('tutorialPromptBreadcrumbs');
    });

    test('bakes active loop state and caption into the LOOP buttons so re-render on Section change cannot regress it', () => {
        const inactiveModel = buildTutorialPromptModel({
            song: tutorialSong(),
            currentSectionIndex: 1
        });
        const inactiveHtml = renderTutorialPrompt(inactiveModel);
        expect(inactiveHtml).toContain('class="tutorialLOOP classLoopSections" data-action="tutorialLoopSections">LOOP<');
        expect(inactiveHtml).toContain('class="tutorialLoopBeats classLoopBeats" data-action="tutorialLoopBeats">');

        const activeModel = buildTutorialPromptModel({
            song: { ...tutorialSong(), randomLoop: true },
            currentSectionIndex: 1,
            includeInLoopingSectionIndexes: [1, 2],
            sectionsLoopActive: true,
            beatsLoopActive: true
        });
        const activeHtml = renderTutorialPrompt(activeModel);
        expect(activeHtml).toContain('class="tutorialLOOP classLoopSections ButtonOn" data-action="tutorialLoopSections">RANDOM 2..3<');
        expect(activeHtml).toContain('class="tutorialLoopBeats classLoopBeats ButtonOn" data-action="tutorialLoopBeats">');
    });

    describe('Practice List (sprint 152, wizard mode)', () => {
        function wizardSong() {
            return {
                tutorial: { level: 'wizard' },
                sections: [{ caption: 'A major' }, { caption: 'B <b>minor</b>' }, { tutorial: { caption: 'Authored' }, caption: 'ignored' }]
            };
        }

        test('wizard renders the bare list on paper, with Include, Done and Bookmark columns and no tutorial chrome', () => {
            const html = renderPracticeList(buildTutorialPromptModel({
                song: wizardSong(),
                currentSectionIndex: 1,
                progress: { doneSectionIndexes: [0], bookmarkSectionIndex: 1 },
                includeInLoopingSectionIndexes: [1]
            }));
            expect(html).toContain('practiceListPaper');
            expect(html).toContain('practiceListRendered');
            expect(html).toContain('lessonSectionList');
            expect(html).toContain('lessonSectionListCurrentRow');
            expect(html).toContain('data-action="tutorialToggleIncludeInLooping"');
            expect(html).toContain('data-action="tutorialToggleDone"');
            expect(html).toContain('data-action="tutorialToggleBookmark"');
            expect(html).not.toContain('tutorialPromptWidgetRow');
            expect(html).not.toContain('tutorialPromptBreadcrumbs');
        });

        test('strict and none render no Practice List', () => {
            ['strict', 'none'].forEach((level) => {
                const song = { ...wizardSong(), tutorial: { level } };
                expect(renderPracticeList(buildTutorialPromptModel({ song }))).toBe('');
            });
        });

        test('blank tutorial captions fall back to the Section caption, HTML-escaped in wizard mode', () => {
            const rows = buildLessonSectionListModel({ song: wizardSong() });
            expect(rows.map((row) => row.caption)).toEqual(['A major', 'B <b>minor</b>', 'Authored']);
            const html = renderPracticeList(buildTutorialPromptModel({ song: wizardSong() }));
            expect(html).toContain('B &lt;b&gt;minor&lt;/b&gt;');
            expect(html).not.toContain('B <b>minor</b>');
        });

        test('strict authored captions stay raw HTML, but the Section caption fallback is escaped', () => {
            const song = {
                tutorial: { level: 'strict' },
                sections: [{ caption: '<i>x</i>', tutorial: { caption: '<b>Authored</b>' } }, { caption: '<i>x</i>' }]
            };
            const html = renderLessonSectionList(buildLessonSectionListModel({ song }));
            expect(html).toContain('<b>Authored</b>');
            expect(html).toContain('&lt;i&gt;x&lt;/i&gt;');
        });

        test('progressColumns false removes Done and Bookmark', () => {
            const html = renderLessonSectionList(buildLessonSectionListModel({ song: wizardSong() }), { progressColumns: false });
            expect(html).not.toContain('tutorialToggleDone');
            expect(html).not.toContain('tutorialToggleBookmark');
            expect(html).not.toContain('<th>Done</th>');
            expect(html).toContain('tutorialToggleIncludeInLooping');
        });

        test('the wizard Prompt Area still carries no list', () => {
            const html = renderTutorialPrompt(buildTutorialPromptModel({ song: wizardSong(), lessonSectionListOpen: true }));
            expect(html).not.toContain('lessonSectionList');
        });
    });
});
