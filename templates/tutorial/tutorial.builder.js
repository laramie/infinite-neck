import { escapeHtml } from '../../InstrumentRoleBadges.js';
import { getSanitizedInfo } from '../../html-sanitizer.js';
import {
    getLoopCaptionModel,
    isSectionDone,
    normalizeIncludeInLooping,
    normalizeTutorialMode,
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
    return Array.from({ length: sectionCount }, (_, index) => {
        const tutorial = getSectionTutorial(song, index);
        let theSectionCaption = song?.tutorial?.useCaptionForSectionCaption 
            ? song.getSections()[index].caption
            : typeof tutorial.caption === 'string' ? tutorial.caption : '';
        return {
            sectionIndex: index,
            sectionNumber: index + 1,
            caption: theSectionCaption,
            current: index === currentSectionIndex,
            done: isSectionDone(progress, index),
            bookmarked: progress?.bookmarkSectionIndex === index,
            includeInLooping: visibleInclude.has(index)
        };
    });
}

export function renderLessonSectionList(model = []) {
    const rows = (Array.isArray(model) ? model : []).map((row) => {
        const rowClass = row.current ? ' class="lessonSectionListCurrentRow"' : '';
        const sectionArgs = escapeAttribute(JSON.stringify([row.sectionIndex]));
        const doneArgs = escapeAttribute(JSON.stringify([row.sectionIndex]));
        const loopArgs = escapeAttribute(JSON.stringify([row.sectionIndex]));
        const bookmarkArgs = escapeAttribute(JSON.stringify([row.sectionIndex]));
        const bookmark = row.bookmarked ? '<span class="lessonSectionListBookmark" aria-label="Bookmarked">&#x261E;</span> ' : '';
        return `<tr${rowClass}>`
            + `<td>${bookmark}<a href="#app-action:gotoSection:${row.sectionIndex}" class="lessonSectionListSectionLink" data-action="tutorialGotoSection" data-action-args='${sectionArgs}'>&sect;${row.sectionNumber}</a></td>`
            + `<td class="lessonSectionListCaption">${row.caption}</td>`
            + `<td><input type="checkbox" data-action="tutorialToggleDone" data-action-args='${doneArgs}'${row.done ? ' checked' : ''}></td>`
            + `<td><button type="button" data-action="tutorialToggleBookmark" data-action-args='${bookmarkArgs}'>${row.bookmarked ? '&#x1F5F9;' : '&#x2610;'}</button></td>`
            + `<td><input type="checkbox" data-action="tutorialToggleIncludeInLooping" data-action-args='${loopArgs}'${row.includeInLooping ? ' checked' : ''}></td>`
            + '</tr>';
    }).join('');
    return '<table class="lessonSectionList">'
        + '<thead><tr>'
        + '<th>Section</th><th>Caption</th><th>Done</th><th>Bookmark</th><th><button type="button" data-action="tutorialToggleAllIncludeInLooping">Include in Looping</button></th>'
        + '</tr></thead>'
        + `<tbody>${rows}</tbody>`
        + '</table>';
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
    beatsLoopActive = false
} = {}) {
    const mode = normalizeTutorialMode(song?.tutorial?.level);
    const sectionTutorial = getSectionTutorial(song, currentSectionIndex);
    const sectionCount = normalizeSectionCount(song);
    let theSectionCaption = typeof sectionTutorial.caption === 'string' ? sectionTutorial.caption : '';
    if (song?.tutorial?.useCaptionForSectionCaption) {
        theSectionCaption = song?.getCurrentSection().caption;
    }
    return {
        mode,
        strict: mode === TUTORIAL_MODES.STRICT,
        wizard: mode === TUTORIAL_MODES.WIZARD,
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
    
    const tutorialPromptContentDiv = (model.promptHtml)
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
            +   sectionCurr+`<span class="tutorialPromptCaption">${model.sectionCaption || model.songCaption}</span>`
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
        const html = TutorialPromptBuilder.renderFromSong(options);
        $(TutorialPromptBuilder.divTutorialPrompt).replaceWith(html || '<div id="tutorialPrompt" class="tutorialPrompt tutorialPrompt--none"></div>');
        TutorialPromptBuilder.divTutorialPrompt = document.getElementById('tutorialPrompt');
        return html;
    }
}
