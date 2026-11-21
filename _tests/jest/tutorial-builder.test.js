import {
    buildLessonSectionListModel,
    buildTutorialPromptModel,
    renderCaptionEditor,
    renderLessonSectionList,
    renderPracticeList,
    renderPromptEditor,
    renderTutorialCaptionEditButton,
    renderTutorialEditButtons,
    renderTutorialPrompt,
    renderTutorialPromptEditButton
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
        // Sprint 152 it4 round 2: wizard shows the Song tutorial caption row, but not the strict controls.
        expect(html).toContain('tutorialPromptBreadcrumbs');
        expect(html).not.toContain('tutorialPromptSectionToggle');
        expect(html).not.toContain('tutorialPromptWidgetRow');
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

    test('the Song tutorial caption is the breadcrumbs (escaped, plain text), never the Section caption row', () => {
        const song = {
            tutorial: { level: 'wizard', caption: 'A & <b>B</b>' },
            sections: [{ caption: '' }]
        };
        const html = renderTutorialPrompt(buildTutorialPromptModel({ song, currentSectionIndex: 0 }));
        expect(html).toContain('<span class="tutorialPromptBreadcrumbs">A &amp; &lt;b&gt;B&lt;/b&gt;</span>');
        expect(html).toContain('<span class="tutorialPromptCaption"></span>');
    });

    test('breadcrumbs come before the header in wizard, and are still blank-safe', () => {
        const song = { tutorial: { level: 'wizard' }, sections: [{}] };
        const html = renderTutorialPrompt(buildTutorialPromptModel({ song, currentSectionIndex: 0 }));
        expect(html).toContain('<span class="tutorialPromptBreadcrumbs"></span>');
        expect(html.indexOf('tutorialBreadcrumbsLeader')).toBeLessThan(html.indexOf('tutorialPromptHeader'));
    });

    test('strict: the Song caption is the breadcrumbs and the Section tutorial caption is the header; a blank one stays blank', () => {
        const song = tutorialSong();
        song.sections[2].tutorial = undefined;
        const withCaption = renderTutorialPrompt(buildTutorialPromptModel({ song, currentSectionIndex: 0 }));
        expect(withCaption).toContain('<span class="tutorialPromptBreadcrumbs">Course / Lesson</span>');
        expect(withCaption).toContain('<span class="tutorialPromptCaption">Intro</span>');
        const blank = renderTutorialPrompt(buildTutorialPromptModel({ song, currentSectionIndex: 2 }));
        expect(blank).toContain('<span class="tutorialPromptCaption"></span>');
        expect(blank).not.toContain('<span class="tutorialPromptCaption">Course / Lesson</span>');
    });

    test('"use Section caption for tutorial": the header is the Section caption (escaped), or blank, never the Song caption', () => {
        ['strict', 'wizard'].forEach((level) => {
            const song = {
                tutorial: { level, caption: 'Song Cap', useCaptionForSectionCaption: true },
                sections: [{ caption: 'A & B', tutorial: { caption: 'ignored' } }, { caption: '' }, {}]
            };
            const first = renderTutorialPrompt(buildTutorialPromptModel({ song, currentSectionIndex: 0 }));
            expect(first).toContain('<span class="tutorialPromptCaption">A &amp; B</span>');
            expect(first).toContain('<span class="tutorialPromptBreadcrumbs">Song Cap</span>');
            [1, 2].forEach((index) => {
                const html = renderTutorialPrompt(buildTutorialPromptModel({ song, currentSectionIndex: index }));
                expect(html).toContain('<span class="tutorialPromptCaption"></span>');
                expect(html).not.toContain('<span class="tutorialPromptCaption">Song Cap</span>');
            });
        });
    });

    describe('Edit Prompt (sprint 152 it3, wizard mode)', () => {
        function wizardSong(extra = {}) {
            return {
                tutorial: { level: 'wizard', ...extra },
                sections: [{ caption: 'A', tutorial: { prompt: { lines: ['<p>Hello & <b>bye</b></p>', '<p>two</p>'] } } }, { caption: 'B' }],
                getSections() { return this.sections; },
                getCurrentSection() { return this.sections[0]; }
            };
        }

        test('wizard shows the Edit Prompt button, and no editor, when not editing', () => {
            const model = buildTutorialPromptModel({ song: wizardSong(), currentSectionIndex: 0 });
            expect(model.canEditPrompt).toBe(true);
            expect(model.promptEditing).toBe(false);
            expect(renderTutorialPromptEditButton(model)).toContain('data-action="tutorialEditPrompt"');
            expect(renderTutorialPromptEditButton(model)).toContain('Edit Prompt');
            const html = renderTutorialPrompt(model);
            expect(html).toContain('tutorialPromptContent');
            expect(html).not.toContain('tutorialPromptEditor');
            expect(html).not.toContain('tutorialPromptEditWarning');
        });

        test('no button for strict or none', () => {
            ['strict', 'none'].forEach((level) => {
                const model = buildTutorialPromptModel({ song: { ...wizardSong(), tutorial: { level } }, currentSectionIndex: 0, promptEditing: true, captionEditing: true });
                expect(model.canEditPrompt).toBe(false);
                expect(model.promptEditing).toBe(false);
                expect(model.captionEditing).toBe(false);
                expect(renderTutorialPromptEditButton(model)).toBe('');
                expect(renderTutorialCaptionEditButton(model)).toBe('');
                expect(renderTutorialEditButtons(model)).toBe('');
            });
        });

        test('"use caption for tutorial" no longer hides Edit Prompt; the caption becomes a label', () => {
            const model = buildTutorialPromptModel({ song: wizardSong({ useCaptionForSectionCaption: true }), currentSectionIndex: 0 });
            expect(renderTutorialPromptEditButton(model)).toContain('data-action="tutorialEditPrompt"');
            expect(renderTutorialCaptionEditButton(model)).toBe('<span class="tutorialCaptionLabel">&sect; Caption</span>');
            expect(renderTutorialCaptionEditButton(model)).not.toContain('<button');
            const stack = renderTutorialEditButtons(model);
            expect(stack.indexOf('tutorialCaptionLabel')).toBeLessThan(stack.indexOf('tutorialEditPrompt'));
        });

        test('wizard without "use caption for tutorial": Edit Caption stacks above Edit Prompt', () => {
            const model = buildTutorialPromptModel({ song: wizardSong(), currentSectionIndex: 0 });
            const stack = renderTutorialEditButtons(model);
            expect(stack).toContain('data-action="tutorialEditCaption">Edit Caption</button>');
            expect(stack.indexOf('tutorialEditCaption')).toBeLessThan(stack.indexOf('tutorialEditPrompt'));
            expect(stack).not.toContain('tutorialCaptionLabel');
        });

        test('while editing the caption: the caption editor with its warning replaces nothing else, and the buttons are hidden', () => {
            const song = wizardSong();
            song.sections[0].tutorial.caption = 'Tom & <b>Jerry</b>';
            const model = buildTutorialPromptModel({ song, currentSectionIndex: 0, captionEditing: true });
            expect(model.captionEditing).toBe(true);
            expect(renderTutorialEditButtons(model)).toBe('');
            const html = renderTutorialPrompt(model);
            expect(html).toContain('will re-write this caption.</div>');
            expect(html).toContain('id="tutorialCaptionEditor"');
            expect(html).toContain('>\nTom &amp; &lt;b&gt;Jerry&lt;/b&gt;</textarea>');
            expect(html).toContain('tutorialPromptContent');
        });

        test('the caption editor is not available when "use caption for tutorial" is on', () => {
            const model = buildTutorialPromptModel({ song: wizardSong({ useCaptionForSectionCaption: true }), currentSectionIndex: 0, captionEditing: true });
            expect(model.captionEditing).toBe(false);
            expect(renderTutorialPrompt(model)).not.toContain('tutorialCaptionEditor');
        });

        test('renderCaptionEditor is empty for a Section with no tutorial caption', () => {
            expect(renderCaptionEditor({})).toMatch(/<textarea[^>]*>\n<\/textarea>/);
        });

        test('the wizard header escapes the plain-text tutorial caption', () => {
            const song = wizardSong();
            song.sections[0].tutorial.caption = 'A & <b>B</b>';
            const html = renderTutorialPrompt(buildTutorialPromptModel({ song, currentSectionIndex: 0 }));
            expect(html).toContain('<span class="tutorialPromptCaption">A &amp; &lt;b&gt;B&lt;/b&gt;</span>');
        });

        test('while editing: the warning and a textarea holding the existing prompt replace the rendered prompt, and the button is hidden', () => {
            const model = buildTutorialPromptModel({ song: wizardSong(), currentSectionIndex: 0, promptEditing: true });
            expect(model.promptEditing).toBe(true);
            expect(renderTutorialPromptEditButton(model)).toBe('');
            const html = renderTutorialPrompt(model);
            expect(html).toContain('class="tutorialPromptEditWarning">WARNING: Running the tutorial builder (npm build:tutorial-prompts) will re-write this prompt.</div>');
            expect(html).toContain('id="tutorialPromptEditor"');
            expect(html).toContain('&lt;p&gt;Hello &amp; &lt;b&gt;bye&lt;/b&gt;&lt;/p&gt;\n&lt;p&gt;two&lt;/p&gt;</textarea>');
            expect(html).not.toContain('class="tutorialPromptContent"');
        });

        test('the editor is empty for a Section with no prompt', () => {
            const model = buildTutorialPromptModel({ song: wizardSong(), currentSectionIndex: 1, promptEditing: true });
            expect(renderPromptEditor(model)).toMatch(/<textarea[^>]*>\n<\/textarea>/);
        });

        test('the editor keeps a leading newline of the prompt text', () => {
            const html = renderPromptEditor({ promptEditText: '\n<p>x</p>' });
            expect(html).toContain('>\n\n&lt;p&gt;x&lt;/p&gt;</textarea>');
        });

        test('after the edit the prompt renders again and the warning is gone', () => {
            const song = wizardSong();
            song.sections[0].tutorial = { prompt: { lines: ['<p>New</p>'] } };
            const html = renderTutorialPrompt(buildTutorialPromptModel({ song, currentSectionIndex: 0, promptEditing: false }));
            expect(html).toContain('<div class="tutorialPromptContent">');
            expect(html).not.toContain('tutorialPromptEditWarning');
            expect(html).not.toContain('<textarea');
        });
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
