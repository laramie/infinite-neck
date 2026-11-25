#!/usr/bin/env node

// Sprint 158: bundles one tutorial course folder into one Workbook file.
//
//   songs/tutorials/C100-cowboy-chords/            -> songs/tutorials/C100-cowboy-chords.workbook.json
//     course.html                                     (optional) the Workbook caption, description, version
//     L101-cowboy-intro/                              each lesson folder becomes a Workbook folder
//       lesson.html                                   (optional) the folder caption and description
//       L101-1.json  L101-2.json                      the Songs, in name order
//
// course.html markers:  data-caption-for-course (text; add data-version="2" to set the version, default "1"),
//                       data-description-for-course (the HTML inside it is the description)
// lesson.html markers:  data-caption-for-lesson, data-description-for-lesson
// Descriptions are checked here against the same tag and link rules the App applies when it shows them
// (links: only #open=<song>.json of the same Workbook, and the help page).

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { parse, serialize } from 'parse5';
import { isAllowedSanitizerTag, isAllowedWorkbookAnchorHref } from '../html-sanitizer.js';
import {
    WORKBOOK_FILE_SUFFIX,
    buildWorkbookFile,
    cleanCaption,
    parseWorkbookFile,
    serializeWorkbookFile,
    validateFolderName,
    validateSongPath,
    validateWorkbookId,
    validateWorkbookVersion
} from '../Workbook.js';
import { buildTutorialPromptFileData } from './build-tutorial-prompts.js';

const DEFAULT_LIBRARY_ROOT = 'songs';

function printUsage() {
    console.log('Usage: node bin/build-tutorial-workbook.js (--course <course-dir> | --all <tutorials-dir>) [--library-root <dir>] [--check] [--quiet] [--help]');
    console.log('Bundles each course folder (Lesson folders of Song .json files) into <course-dir>.workbook.json.');
    console.log('--check reports whether the files are up to date (exit 1 if not) and writes nothing.');
}

function parseArgs(argv) {
    const result = { courses: [], all: '', libraryRoot: DEFAULT_LIBRARY_ROOT, check: false, quiet: false, help: false };
    const valueOf = (index, name) => {
        if (!argv[index + 1]) {
            throw new Error(`${name} requires a value`);
        }
        return argv[index + 1];
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--course') {
            result.courses.push(valueOf(index, arg));
            index += 1;
        } else if (arg === '--all') {
            result.all = valueOf(index, arg);
            index += 1;
        } else if (arg === '--library-root') {
            result.libraryRoot = valueOf(index, arg);
            index += 1;
        } else if (arg === '--check') {
            result.check = true;
        } else if (arg === '--quiet') {
            result.quiet = true;
        } else if (arg === '--help' || arg === '-h') {
            result.help = true;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    return result;
}

function resolveFromCwd(inputPath) {
    return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function getAttribute(node, name) {
    const attrs = Array.isArray(node?.attrs) ? node.attrs : [];
    const found = attrs.find((entry) => entry.name === name);
    return found ? found.value : undefined;
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

/** Tags and links of a description must be ones the App would keep.  Returns a list of problems. */
export function checkDescriptionHtml(html, where) {
    const problems = [];
    const fragment = parse(`<body>${html}</body>`);
    walkNodes(fragment, (node) => {
        const tag = node.tagName;
        if (!tag || ['html', 'head', 'body'].includes(tag)) {
            return;
        }
        if (!isAllowedSanitizerTag(tag)) {
            problems.push(`${where}: <${tag}> is not allowed in a description.`);
        }
        if (tag === 'a') {
            const href = getAttribute(node, 'href') || '';
            if (!isAllowedWorkbookAnchorHref(href)) {
                problems.push(`${where}: link "${href}" is not allowed (use #open=name.json or #open=Folder/name.json, or a help page link).`);
            }
        }
    });
    return problems;
}

/** @returns {{caption:string, description:string, version?:string, errors:string[]}} */
export function parseMarkerFile(rawHtml, kind, where) {
    const doc = parse(String(rawHtml || ''));
    const result = { caption: '', description: '', errors: [] };
    let sawCaption = false;
    let sawDescription = false;
    walkNodes(doc, (node) => {
        if (getAttribute(node, `data-caption-for-${kind}`) !== undefined) {
            if (sawCaption) {
                result.errors.push(`${where}: duplicate caption marker.`);
                return;
            }
            sawCaption = true;
            result.caption = cleanCaption(textContent(node));
            const version = getAttribute(node, 'data-version');
            if (version !== undefined) {
                result.version = version.trim();
            }
        }
        if (getAttribute(node, `data-description-for-${kind}`) !== undefined) {
            if (sawDescription) {
                result.errors.push(`${where}: duplicate description marker.`);
                return;
            }
            sawDescription = true;
            result.description = serialize(node).trim();
        }
    });
    if (result.description) {
        result.errors.push(...checkDescriptionHtml(result.description, where));
    }
    return result;
}

function readOptional(filePath) {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function listDirs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

/** Builds the Workbook of one course folder.
 *  @returns {{id:string, text:string|null, songCount:number, lessonCount:number, warnings:string[], errors:string[]}}  text is null when there is nothing to bundle. */
export function buildCourseWorkbook(courseDir, { libraryRoot = DEFAULT_LIBRARY_ROOT } = {}) {
    const warnings = [];
    const errors = [];
    const absCourse = resolveFromCwd(courseDir);
    const absLibrary = resolveFromCwd(libraryRoot);
    const id = path.basename(absCourse);
    const result = (text, songCount, lessonCount) => ({ id, text, songCount, lessonCount, warnings, errors });

    const idCheck = validateWorkbookId(id);
    if (!idCheck.ok || !idCheck.value) {
        errors.push(`Course folder name "${id}" cannot be a Workbook id: ${idCheck.ok ? 'it is empty' : idCheck.error}`);
        return result(null, 0, 0);
    }

    const info = { id, version: '1', caption: '', description: '', suggestedMount: 'tutorial' };
    const courseHtml = readOptional(path.join(absCourse, 'course.html'));
    if (courseHtml !== null) {
        const course = parseMarkerFile(courseHtml, 'course', `${id}/course.html`);
        errors.push(...course.errors);
        info.caption = course.caption;
        info.description = course.description;
        if (course.version !== undefined && course.version !== '') {
            const versionCheck = validateWorkbookVersion(course.version);
            if (versionCheck.ok) {
                info.version = versionCheck.value;
            } else {
                errors.push(`${id}/course.html: ${versionCheck.error}`);
            }
        }
    } else {
        warnings.push(`${id} has no course.html: the Workbook will have no caption or description.`);
    }

    const folders = [];
    const songs = [];
    for (const lesson of listDirs(absCourse)) {
        const lessonDir = path.join(absCourse, lesson);
        const songFiles = fs.readdirSync(lessonDir).filter((name) => /\.json$/i.test(name) && !/\.workbook\.json$/i.test(name)).sort();
        if (songFiles.length === 0) {
            continue;   // a lesson with no Songs yet is not bundled
        }
        const folderCheck = validateFolderName(lesson);
        if (!folderCheck.ok || folderCheck.value !== lesson) {
            errors.push(`Lesson folder "${lesson}": ${folderCheck.ok ? 'name has extra spaces.' : folderCheck.error}`);
            continue;
        }
        const lessonHtml = readOptional(path.join(lessonDir, 'lesson.html'));
        const folder = { name: lesson, caption: '', description: '' };
        if (lessonHtml !== null) {
            const parsed = parseMarkerFile(lessonHtml, 'lesson', `${id}/${lesson}/lesson.html`);
            errors.push(...parsed.errors);
            folder.caption = parsed.caption;
            folder.description = parsed.description;
        }
        folders.push(folder);

        for (const fileName of songFiles) {
            const songPath = path.join(lessonDir, fileName);
            let songJson;
            try {
                songJson = JSON.parse(fs.readFileSync(songPath, 'utf8'));
            } catch (error) {
                errors.push(`${id}/${lesson}/${fileName}: not valid JSON (${error.message}).`);
                continue;
            }
            const promptsHtml = readOptional(songPath.replace(/\.json$/i, '.prompts.html'));
            if (promptsHtml !== null) {
                const prompts = buildTutorialPromptFileData(songJson, promptsHtml);
                errors.push(...prompts.errors.map((message) => `${id}/${lesson}/${fileName}: ${message}`));
                if (prompts.changed) {
                    warnings.push(`${id}/${lesson}/${fileName}: its .prompts.html has changes not embedded in the Song yet (run build:tutorial-prompts first).`);
                }
            }
            const songRelative = path.join(lesson, fileName).split(path.sep).join('/');
            const checked = validateSongPath(songRelative);
            if (!checked.ok) {
                errors.push(`${id}/${songRelative}: ${checked.error}`);
                continue;
            }
            songs.push({
                path: checked.value,
                comment: '',
                source: path.relative(absLibrary, songPath).split(path.sep).join('/'),
                progress: null,
                includeInLooping: null,
                updatedAt: '',
                text: JSON.stringify(songJson, null, 2)
            });
        }
    }

    if (songs.length === 0) {
        return result(null, 0, 0);   // nothing to bundle: no file
    }

    const file = buildWorkbookFile({ folders, songs, savedAt: '', info });
    const text = `${serializeWorkbookFile(file)}\n`;
    const verify = parseWorkbookFile(text);
    if (!verify.ok) {
        errors.push(`${id}: the bundle would not open in the App: ${verify.error}`);
    }
    return result(text, songs.length, folders.length);
}

function courseOutputPath(courseDir) {
    const absCourse = resolveFromCwd(courseDir);
    return path.join(path.dirname(absCourse), `${path.basename(absCourse)}${WORKBOOK_FILE_SUFFIX}`);
}

export function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    if (args.help) {
        printUsage();
        return;
    }
    const courses = [...args.courses];
    if (args.all) {
        const root = resolveFromCwd(args.all);
        listDirs(root).forEach((name) => courses.push(path.join(root, name)));
    }
    if (courses.length === 0) {
        throw new Error('--course or --all is required');
    }

    let failed = false;
    for (const courseDir of courses) {
        const built = buildCourseWorkbook(courseDir, { libraryRoot: args.libraryRoot });
        if (!args.quiet) {
            built.warnings.forEach((warning) => console.warn(`WARN ${warning}`));
        }
        built.errors.forEach((error) => console.error(`ERROR ${error}`));
        if (built.errors.length > 0) {
            failed = true;
            continue;
        }
        if (built.text === null) {
            if (!args.quiet) {
                console.log(`${built.id}: no Songs, nothing to bundle.`);
            }
            continue;
        }
        const outPath = courseOutputPath(courseDir);
        const outName = path.basename(outPath);
        const current = readOptional(outPath);
        const upToDate = current === built.text;
        if (args.check) {
            if (!args.quiet) {
                console.log(upToDate ? `${outName} is up to date.` : `${outName} needs update.`);
            }
            if (!upToDate) {
                failed = true;
            }
            continue;
        }
        if (!upToDate) {
            fs.writeFileSync(outPath, built.text);
        }
        if (!args.quiet) {
            console.log(`${upToDate ? 'Up to date' : 'Wrote'} ${outName}: ${built.songCount} song(s) in ${built.lessonCount} lesson(s).`);
        }
    }
    if (failed) {
        process.exitCode = 1;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        printUsage();
        process.exitCode = 1;
    }
}
