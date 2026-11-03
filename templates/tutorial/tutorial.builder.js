import { escapeHtml } from '../../InstrumentRoleBadges.js';
import { getSanitizedInfo } from '../../html-sanitizer.js';
import {
    canEditTutorialPrompt,
    getLoopCaptionModel,
    isSectionDone,
    normalizeIncludeInLooping,
    normalizeTutorialMode,
    promptToEditText,
    TUTORIAL_MODES
} from '../../Tutorial.js';

function escapeAttribute(value = '') {
    return escapeHtml(value).replace(/'/g, '&#39;');
}

function normalizeSectionCount(song = {}) {
    return Array.isArray(song.sections) ? song.sections.length : 0;
}

function getSectionTutorial(song = {}, sectionIndex = 0) {
    const sections = Array.isArray(song.sections) ? song.sections : [];
    const section = sections[sectionIndex] || {};
    return section.tutorial && typeof section.tutorial === 'object' ? section.tutorial : {};
}

export function buildLessonSectionListModel({
    song = {},
    currentSectionIndex = 0,
    progress = {},
    includeInLoopingSectionIndexes = null
} = {}) {
    const sectionCount = normalizeSectionCount(song);
    const visibleInclude = new Set(normalizeIncludeInLooping(sectionCount, includeInLoopingSectionIndexes));
    const strict = normalizeTutorialMode(song?.tutorial?.level) === TUTORIAL_MODES.STRICT;
    return Array.from({ length: sectionCount }, (_, index) => {
        const tutorial = getSectionTutorial(song, index);
        let theSectionCaption = song?.tutorial?.useCaptionForSectionCaption 
            ? song.getSections()[index].caption
            : typeof tutorial.caption === 'string' ? tutorial.caption : '';
        // Authored strict captions are trusted HTML.  A blank caption falls back to the Section's own caption (plain text, escaped when rendered).
        let captionIsHtml = strict;
        if (!`${theSectionCaption || ''}`.trim()) {
            const sectionCaption = song?.sections?.[index]?.caption;
            theSectionCaption = typeof sectionCaption === 'string' ? sectionCaption : '';
            captionIsHtml = false;
        }
        return {
            sectionIndex: index,
            sectionNumber: index + 1,
            caption: theSectionCaption,
            captionIsHtml,
            current: index === currentSectionIndex,
            done: isSectionDone(progress, index),
            bookmarked: progress?.bookmarkSectionIndex === index,
            includeInLooping: visibleInclude.has(index)
        };
    });
}

export function renderLessonSectionList(model = [], { progressColumns = true } = {}) {
    const rows = (Array.isArray(model) ? model : []).map((row) => {
        const rowClass = row.current ? ' class="lessonSectionListCurrentRow"' : '';
        const sectionArgs = escapeAttribute(JSON.stringify([row.sectionIndex]));
        const doneArgs = escapeAttribute(JSON.stringify([row.sectionIndex]));
        const loopArgs = escapeAttribute(JSON.stringify([row.sectionIndex]));
        const bookmarkArgs = escapeAttribute(JSON.stringify([row.sectionIndex]));
        const bookmark = row.bookmarked ? '<span class="lessonSectionListBookmark" aria-label="Bookmarked">&#x261E;</span> ' : '';
        const caption = row.captionIsHtml === false ? escapeHtml(row.caption ?? '') : row.caption;
        const progressCells = progressColumns
            ? `<td><input type="checkbox" data-action="tutorialToggleDone" data-action-args='${doneArgs}'${row.done ? ' checked' : ''}></td>`
            + `<td><button type="button" data-action="tutorialToggleBookmark" data-action-args='${bookmarkArgs}'>${row.bookmarked ? '&#x1F5F9;' : '&#x2610;'}</button></td>`
            : '';
        return `<tr${rowClass}>`
            + `<td>${bookmark}<a href="#app-action:gotoSection:${row.sectionIndex}" class="lessonSectionListSectionLink" data-action="tutorialGotoSection" data-action-args='${sectionArgs}'>&sect;${row.sectionNumber}</a></td>`
            + `<td class="lessonSectionListCaption">${caption}</td>`
            + progressCells
            + `<td><input type="checkbox" data-action="tutorialToggleIncludeInLooping" data-action-args='${loopArgs}'${row.includeInLooping ? ' checked' : ''}></td>`
            + '</tr>';
    }).join('');
    const progressHeaders = progressColumns ? '<th>Done</th><th>Bookmark</th>' : '';
    return '<table class="lessonSectionList">'
        + '<thead><tr>'
        + `<th>Section</th><th>Caption</th>${progressHeaders}<th><button type="button" data-action="tutorialToggleAllIncludeInLooping">Include in Looping</button></th>`
        + '</tr></thead>'
        + `<tbody>${rows}</tbody>`
        + '</table>';
}

/** Wizard mode only: the bare Section list, with no tutorial chrome, for #divPracticeList. */
export function renderPracticeList(model = {}) {
    if (!model.wizard) {
        return '';
    }
    return '<div class="practiceListPaper"><div class="practiceListRendered">'
        + renderLessonSectionList(model.lessonSections)
        + '</div></div>';
}

function renderPromptLines(lines = []) {
    return (Array.isArray(lines) ? lines : [])
        .map((line) => getSanitizedInfo(line))
        .filter((line) => line.trim().length > 0)
        .join('\n');
}

export function buildTutorialPromptModel({
    song = {},
    currentSectionIndex = 0,
    progress = {},
    includeInLoopingSectionIndexes = null,
    lessonSectionListOpen = false,
    hamburgerControlsOpen = true,
    sectionsLoopActive = false,
    beatsLoopActive = false,
    promptEditing = false
} = {}) {
    const mode = normalizeTutorialMode(song?.tutorial?.level);
    const sectionTutorial = getSectionTutorial(song, currentSectionIndex);
    const sectionCount = normalizeSectionCount(song);
    const canEditPrompt = canEditTutorialPrompt(song);
    let theSectionCaption = typeof sectionTutorial.caption === 'string' ? sectionTutorial.caption : '';
    if (song?.tutorial?.useCaptionForSectionCaption) {
        theSectionCaption = song?.getCurrentSection().caption;
    }
    return {
        mode,
        strict: mode === TUTORIAL_MODES.STRICT,
        wizard: mode === TUTORIAL_MODES.WIZARD,
        canEditPrompt,
        promptEditing: canEditPrompt && !!promptEditing,
        promptEditText: promptToEditText(sectionTutorial.prompt),
        songCaption: typeof song?.tutorial?.caption === 'string' ? song.tutorial.caption : '',
        sectionCaption: theSectionCaption,
        currentSectionIndex,
        currentSectionNumber: currentSectionIndex + 1,
        sectionCount,
        promptHtml: renderPromptLines(sectionTutorial.prompt?.lines),
        hamburgerControlsOpen: !!hamburgerControlsOpen,
        lessonSectionListOpen: !!lessonSectionListOpen,
        sectionsLoopActive: !!sectionsLoopActive,
        beatsLoopActive: !!beatsLoopActive,
        loopSectionsCaption: getLoopCaptionModel({
            looping: !!sectionsLoopActive,
            random: !!song?.randomLoop,
            includeInLoopingSectionIndexes,
            sectionCount
        }),
        lessonSections: buildLessonSectionListModel({
            song,
            currentSectionIndex,
            progress,
            includeInLoopingSectionIndexes
        })
    };
}

/** Sprint 152 it3, wizard mode only: the prompt editor, in place of the rendered prompt.  The warning is a plain div so
 *  its look can be changed in CSS (.tutorialPromptEditWarning).  The newline right after the textarea tag is swallowed by
 *  the HTML parser, so text that itself starts with a newline is kept. */
export function renderPromptEditor(model = {}) {
    return '<div class="tutorialPromptEdit">'
        + '<div class="tutorialPromptEditWarning">WARNING: Running the tutorial builder (npm build:tutorial-prompts) will re-write this prompt.</div>'
        + '<div class="tutorialPromptEditHint">Click outside the box, or press Esc, to save and show the prompt.  An empty box removes the prompt.</div>'
        + `<textarea id="tutorialPromptEditor" class="tutorialPromptEditor" rows="10" spellcheck="false" aria-label="Prompt HTML for this Section">\n${escapeHtml(model.promptEditText ?? '')}</textarea>`
        + '</div>';
}

/** Sprint 152 it3, wizard mode only: the small button that floats to the right of the Prompt Area.  Hidden while editing. */
export function renderTutorialPromptEditButton(model = {}) {
    if (!model.wizard || !model.canEditPrompt || model.promptEditing) {
        return '';
    }
    return '<button type="button" class="BtnPunchedOut tutorialPromptEditButton" data-action="tutorialEditPrompt">Edit Prompt</button>';
}

export function renderTutorialPrompt(model = {}) {
    if (!model.strict && !model.wizard) {
        return '';
    }
    const arrow = model.lessonSectionListOpen ? "&#x1F783;" : "&#x1F782;"
    const hamburgerArrow = model.hamburgerControlsOpen ? "&#x1F781;" : "&#x1F782;"
    const sectionCurrOfCount = `<span class="tutorialSectionMark">&sect; </span><b>${model.currentSectionNumber}</b> <small>of</small> <b>${model.sectionCount}</b>`;    
    const sectionCurr = `<span class="tutorialSectionMark">&sect;</span>${model.currentSectionNumber}:&nbsp;&nbsp;`;    
    const breadcrumbs = model.strict
        ? `<span class="tutorialPromptBreadcrumbs">${escapeHtml(model.songCaption)}</span>`
        : '';
    
    const sectionToggle = model.strict
        ? '<button type="button" class="tutorialPromptSectionToggle" data-action="tutorialToggleSectionList">Tutorial Sections &nbsp;&nbsp;'+arrow+'</button>'
            +'&nbsp;&nbsp;'+sectionCurrOfCount
            +'<span class="tutorialBreadcrumbsLeader">Tutorial: </span><span class="tutorialPromptBreadcrumbsRow">'
            +  breadcrumbs
            +'</span><br>'
        : '';
    const tutorialPromptWidgetRow = model.strict
        ?  '<div class="tutorialPromptWidgetRow">'
         + '<button type="button" class="tutorialNav" data-action="tutorialFirstSection">&#x21E4; First</button>'
         + '<button type="button" class="tutorialNav" data-action="tutorialPrevSection">&laquo; Previous</button>'
         + '<button type="button" class="tutorialNavNext" data-action="tutorialNextSection">Next &raquo;</button>'
         + '<button type="button" class="tutorialNav" data-action="tutorialLastSection">Last &#x21E5;</button>'
         + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'
         + `<button type="button" class="tutorialLoopBeats classLoopBeats${model.beatsLoopActive ? ' ButtonOn' : ''}" data-action="tutorialLoopBeats">&infin;</button>`
         + `<button type="button" class="tutorialLOOP classLoopSections${model.sectionsLoopActive ? ' ButtonOn' : ''}" data-action="tutorialLoopSections">${model.loopSectionsCaption || 'LOOP'}</button>`
         + '</div>'
        :  ''; 
    const modeClass = model.strict ? 'tutorialPrompt--strict' : 'tutorialPrompt--wizard';
    const lessonList = model.strict && model.lessonSectionListOpen ? renderLessonSectionList(model.lessonSections) : '';
    
    const tutorialPromptContentDiv = model.promptEditing
            ? renderPromptEditor(model)
            : (model.promptHtml)
                ?   `<div class="tutorialPromptContent">${model.promptHtml}</div>`
                :  '';
    
    const hamburger = model.strict ? '<button type="button" class="tutorialWidgetRowHamburger" data-action="tutorialToggleHamburgerControls">&equiv; &nbsp;'+hamburgerArrow+'</button>' : '';
    const hamburgerControlsStyle = (model.hamburgerControlsOpen === true) 
           ?' style="display: inline;" '
           : 'style="display: none;" ';
    
    return `<div id="tutorialPrompt" class="tutorialPrompt ${modeClass}">`
            + `<span id="tutorialPromptBurgerControls" ${hamburgerControlsStyle}>`
            + sectionToggle 
            + lessonList
            + tutorialPromptWidgetRow
            + '</span>'
            + '<span class="tutorialPromptHeader">'
            +   hamburger
            +   sectionCurr+`<span class="tutorialPromptCaption">${model.sectionCaption || escapeHtml(model.songCaption)}</span>`
            + '</span>'
            + tutorialPromptContentDiv
         + '</div>';
}

export class TutorialPromptBuilder {
    static divTutorialPrompt = null;

    static addToDest(divDestSelector) {
        if (!TutorialPromptBuilder.divTutorialPrompt) {
            const template = document.getElementById('tutorial-prompt-template');
            if (!template) {
                return null;
            }
            const clone = template.content.cloneNode(true);
            TutorialPromptBuilder.divTutorialPrompt = clone.querySelector('#tutorialPrompt');
            $(divDestSelector).empty().append(TutorialPromptBuilder.divTutorialPrompt);
        }
        return TutorialPromptBuilder.divTutorialPrompt;
    }

    static renderFromSong(options = {}) {
        return renderTutorialPrompt(buildTutorialPromptModel(options));
    }

    static renderToDest(options = {}) {
        if (!TutorialPromptBuilder.divTutorialPrompt) {
            return '';
        }
        const model = buildTutorialPromptModel(options);
        const html = renderTutorialPrompt(model);
        $(TutorialPromptBuilder.divTutorialPrompt).replaceWith(html || '<div id="tutorialPrompt" class="tutorialPrompt tutorialPrompt--none"></div>');
        TutorialPromptBuilder.divTutorialPrompt = document.getElementById('tutorialPrompt');
        TutorialPromptBuilder.renderEditButton(model);
        return html;
    }

    /** The Edit Prompt button lives in a sibling host, side by side with #tutorialPrompt (which is replaced on every render).
     *  The destination only becomes a flex row while the button is showing, so strict and none layouts are untouched. */
    static renderEditButton(model) {
        const $dest = $(TutorialPromptBuilder.divTutorialPrompt).parent();
        if ($dest.length === 0) {
            return;
        }
        let $host = $dest.children('#tutorialPromptEditHost');
        if ($host.length === 0) {
            $host = $('<div id="tutorialPromptEditHost" class="tutorialPromptEditHost"></div>').appendTo($dest);
        }
        const buttonHtml = renderTutorialPromptEditButton(model);
        $host.html(buttonHtml);
        $dest.toggleClass('tutorialPromptHost--sideBySide', buttonHtml !== '');
    }
}
