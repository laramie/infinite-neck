#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parse, serializeOuter } from 'parse5';

const DEFAULT_PROMPT_EXTENSION = '.prompts.html';

function printUsage() {
    console.log('Usage: node bin/build-tutorial-prompts.js --song <song.json> [--prompts <song.prompts.html>] [--check] [--quiet] [--help]');
    console.log('Embeds tutorial captions and prompt HTML from a .prompts.html source into one song JSON file.');
}

function parseArgs(argv) {
    const result = {
        song: '',
        prompts: '',
        check: false,
        quiet: false,
        help: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--song') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('--song requires a path');
            }
            result.song = value;
            index += 1;
            continue;
        }
        if (arg === '--prompts') {
            const value = argv[index + 1];
            if (!value) {
                throw new Error('--prompts requires a path');
            }
            result.prompts = value;
            index += 1;
            continue;
        }
        if (arg === '--check') {
            result.check = true;
            continue;
        }
        if (arg === '--quiet') {
            result.quiet = true;
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            result.help = true;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    return result;
}

function resolveFromCwd(inputPath) {
    return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function derivePromptsPath(songPath) {
    return songPath.replace(/\.json$/i, DEFAULT_PROMPT_EXTENSION);
}

function stableJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function getAttribute(node, name) {
    const attrs = Array.isArray(node?.attrs) ? node.attrs : [];
    const attr = attrs.find((entry) => entry.name === name);
    return attr ? attr.value : '';
}

function textContent(node) {
    if (!node) {
        return '';
    }
    if (node.nodeName === '#text') {
        return node.value || '';
    }
    return (Array.isArray(node.childNodes) ? node.childNodes : []).map(textContent).join('');
}

function walkNodes(node, visit) {
    if (!node) {
        return;
    }
    visit(node);
    (Array.isArray(node.childNodes) ? node.childNodes : []).forEach((child) => walkNodes(child, visit));
}

function isWhitespaceText(node) {
    return node?.nodeName === '#text' && /^[\s\u00a0]*$/u.test(node.value || '');
}

function serializePromptLines(node) {
    return (Array.isArray(node?.childNodes) ? node.childNodes : [])
        .filter((child) => !isWhitespaceText(child))
        .map((child) => serializeOuter(child).trim())
        .filter((line) => line.length > 0);
}

function parsePositiveSectionNumber(value) {
    const sectionNumber = Number.parseInt(value, 10);
    return Number.isInteger(sectionNumber) && sectionNumber > 0 ? sectionNumber : null;
}

function pushSectionMarker(map, markerType, sectionNumber, value, errors) {
    if (!map.has(sectionNumber)) {
        map.set(sectionNumber, {});
    }
    const existing = map.get(sectionNumber);
    if (Object.prototype.hasOwnProperty.call(existing, markerType)) {
        errors.push(`Duplicate ${markerType} marker for Section ${sectionNumber}.`);
        return;
    }
    existing[markerType] = value;
}

export function parseTutorialPromptHtml(rawHtml = '') {
    const doc = parse(String(rawHtml || ''));
    const errors = [];
    const warnings = [];
    const sectionData = new Map();
    let tutorialCaption = '';

    walkNodes(doc, (node) => {
        const tutorialCaptionMarker = getAttribute(node, 'data-caption-for-tutorial');
        if (tutorialCaptionMarker) {
            if (tutorialCaption) {
                errors.push('Duplicate tutorial caption marker.');
                return;
            }
            tutorialCaption = textContent(node).trim();
        }

        const captionSectionNumber = parsePositiveSectionNumber(getAttribute(node, 'data-caption-for-section'));
        if (captionSectionNumber !== null) {
            pushSectionMarker(sectionData, 'caption', captionSectionNumber, textContent(node).trim(), errors);
        }

        const promptSectionNumber = parsePositiveSectionNumber(getAttribute(node, 'data-prompt-for-section'));
        if (promptSectionNumber !== null) {
            pushSectionMarker(sectionData, 'promptLines', promptSectionNumber, serializePromptLines(node), errors);
        }
    });

    if (!tutorialCaption) {
        warnings.push('No tutorial caption marker found.');
    }

    return {
        tutorialCaption,
        sections: [...sectionData.entries()].sort(([a], [b]) => a - b).map(([sectionNumber, data]) => ({
            sectionNumber,
            ...data
        })),
        warnings,
        errors
    };
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

export function applyTutorialPromptsToSong(songJson = {}, promptData = {}) {
    const nextSong = cloneJson(songJson || {});
    const warnings = [...(promptData.warnings || [])];
    const errors = [...(promptData.errors || [])];
    const sections = Array.isArray(nextSong.sections) ? nextSong.sections : [];

    if (promptData.tutorialCaption) {
        nextSong.tutorial = {
            ...(nextSong.tutorial && typeof nextSong.tutorial === 'object' && !Array.isArray(nextSong.tutorial) ? nextSong.tutorial : {}),
            caption: promptData.tutorialCaption
        };
        if (!nextSong.tutorial.level) {
            nextSong.tutorial.level = 'none';
        }
    }

    (Array.isArray(promptData.sections) ? promptData.sections : []).forEach((sectionPrompt) => {
        const sectionIndex = sectionPrompt.sectionNumber - 1;
        if (sectionIndex < 0 || sectionIndex >= sections.length) {
            errors.push(`Prompt marker references Section ${sectionPrompt.sectionNumber}, but song has ${sections.length} Section${sections.length === 1 ? '' : 's'}.`);
            return;
        }
        const section = sections[sectionIndex] || {};
        const tutorial = {
            ...(section.tutorial && typeof section.tutorial === 'object' && !Array.isArray(section.tutorial) ? section.tutorial : {})
        };
        if (typeof sectionPrompt.caption === 'string') {
            tutorial.caption = sectionPrompt.caption;
        }
        if (Array.isArray(sectionPrompt.promptLines)) {
            tutorial.prompt = { lines: sectionPrompt.promptLines };
        }
        sections[sectionIndex] = {
            ...section,
            tutorial
        };
    });

    if (nextSong?.tutorial?.level === 'strict') {
        sections.forEach((section, index) => {
            const tutorial = section?.tutorial || {};
            if (typeof tutorial.caption !== 'string' || tutorial.caption.trim() === '') {
                warnings.push(`Strict tutorial Section ${index + 1} has no tutorial caption.`);
            }
            if (!Array.isArray(tutorial.prompt?.lines) || tutorial.prompt.lines.length === 0) {
                warnings.push(`Strict tutorial Section ${index + 1} has no tutorial prompt lines.`);
            }
        });
    }

    nextSong.sections = sections;
    return {
        song: nextSong,
        warnings,
        errors,
        changed: stableJson(nextSong) !== stableJson(songJson)
    };
}

export function buildTutorialPromptFileData(songJson = {}, rawPromptHtml = '') {
    return applyTutorialPromptsToSong(songJson, parseTutorialPromptHtml(rawPromptHtml));
}

function reportMessages({ warnings = [], errors = [] }, quiet = false) {
    if (!quiet) {
        warnings.forEach((warning) => console.warn(`WARN ${warning}`));
    }
    errors.forEach((error) => console.error(`ERROR ${error}`));
}

export function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    if (args.help) {
        printUsage();
        return;
    }
    if (!args.song) {
        throw new Error('--song is required');
    }

    const songPath = resolveFromCwd(args.song);
    const promptsPath = resolveFromCwd(args.prompts || derivePromptsPath(args.song));
    const originalSong = JSON.parse(fs.readFileSync(songPath, 'utf8'));
    const rawPromptHtml = fs.readFileSync(promptsPath, 'utf8');
    const result = buildTutorialPromptFileData(originalSong, rawPromptHtml);

    reportMessages(result, args.quiet);

    if (args.check) {
        if (!args.quiet) {
            console.log(result.changed ? `${args.song} needs tutorial prompt update.` : `${args.song} tutorial prompts are up to date.`);
        }
        if (result.changed || result.errors.length > 0) {
            process.exitCode = 1;
        }
        return;
    }

    if (result.errors.length > 0) {
        process.exitCode = 1;
        return;
    }

    if (result.changed) {
        fs.writeFileSync(songPath, stableJson(result.song));
        if (!args.quiet) {
            console.log(`Updated ${args.song}.`);
        }
    } else if (!args.quiet) {
        console.log(`${args.song} tutorial prompts are up to date.`);
    }
}

try {
    if (import.meta.url === `file://${process.argv[1]}`) {
        main();
    }
} catch (error) {
    console.error(error.message);
    printUsage();
    process.exitCode = 1;
}
