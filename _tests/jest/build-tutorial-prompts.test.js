import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    applyTutorialPromptsToSong,
    buildTutorialPromptFileData,
    parseTutorialPromptHtml
} from '../../bin/build-tutorial-prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPT_FIXTURE = path.join(__dirname, 'fixtures/tutorial-prompts-example.prompts.html');

function baseSong(overrides = {}) {
    return {
        songName: 'tutorial-fixture',
        tutorial: { level: 'strict' },
        sections: [{}, {}],
        ...overrides
    };
}

describe('tutorial prompt build tool', () => {
    test('extracts tutorial caption, Section captions, and prompt lines from copied fixture', () => {
        const html = fs.readFileSync(PROMPT_FIXTURE, 'utf8');
        const result = parseTutorialPromptHtml(html);

        expect(result.errors).toEqual([]);
        expect(result.tutorialCaption).toBe('Intro to stringed instruments: playing on one string');
        expect(result.sections).toEqual([
            {
                sectionNumber: 1,
                caption: 'Getting Started: Chromatic Scale',
                promptLines: [
                    '<p>You are going to play the Chromatic scale on the E string.</p>',
                    '<p>Go to the Next step, where you can loop the notes and play along.</p>'
                ]
            },
            {
                sectionNumber: 2,
                caption: 'Play the Chromatic Scale',
                promptLines: ['<p>Now hit "BEAT-LOOP" and follow along.</p>']
            }
        ]);
    });

    test('embeds extracted tutorial prompt data into matching song Sections', () => {
        const html = fs.readFileSync(PROMPT_FIXTURE, 'utf8');
        const result = buildTutorialPromptFileData(baseSong(), html);

        expect(result.errors).toEqual([]);
        expect(result.changed).toBe(true);
        expect(result.song.tutorial).toEqual({
            level: 'strict',
            caption: 'Intro to stringed instruments: playing on one string'
        });
        expect(result.song.sections[0].tutorial).toEqual({
            caption: 'Getting Started: Chromatic Scale',
            prompt: {
                lines: [
                    '<p>You are going to play the Chromatic scale on the E string.</p>',
                    '<p>Go to the Next step, where you can loop the notes and play along.</p>'
                ]
            }
        });
        expect(result.song.sections[1].tutorial).toEqual({
            caption: 'Play the Chromatic Scale',
            prompt: {
                lines: ['<p>Now hit "BEAT-LOOP" and follow along.</p>']
            }
        });
    });

    test('reports duplicate prompt markers and out-of-range Section markers', () => {
        const promptData = parseTutorialPromptHtml(`
            <h1 data-caption-for-tutorial="true">Demo</h1>
            <h2 data-caption-for-section="1">One</h2>
            <h2 data-caption-for-section="1">Duplicate</h2>
            <div data-prompt-for-section="3"><p>Out of range</p></div>
        `);
        const result = applyTutorialPromptsToSong(baseSong(), promptData);

        expect(result.errors).toEqual(expect.arrayContaining([
            'Duplicate caption marker for Section 1.',
            'Prompt marker references Section 3, but song has 2 Sections.'
        ]));
    });

    test('warns when strict tutorial Sections are missing captions or prompt lines', () => {
        const result = buildTutorialPromptFileData(baseSong(), '<h1 data-caption-for-tutorial="true">Demo</h1>');

        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual(expect.arrayContaining([
            'Strict tutorial Section 1 has no tutorial caption.',
            'Strict tutorial Section 1 has no tutorial prompt lines.',
            'Strict tutorial Section 2 has no tutorial caption.',
            'Strict tutorial Section 2 has no tutorial prompt lines.'
        ]));
    });
});
