import { escapeHtml } from '../../InstrumentRoleBadges.js';
import { getSanitizedInfo } from '../../html-sanitizer.js';
import {
    canEditTutorialCaption,
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
            ? (typeof song?.sections?.[index]?.caption === 'string' ? song.sections[index].caption : '')
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
    promptEditing = false,
    captionEditing = false,
    bpmEditing = false
} = {}) {
    const mode = normalizeTutorialMode(song?.tutorial?.level);
    const sectionTutorial = getSectionTutorial(song, currentSectionIndex);
    const sectionCount = normalizeSectionCount(song);
    const canEditPrompt = canEditTutorialPrompt(song);
    const canEditCaption = canEditTutorialCaption(song);
    // Sprint 152 it4 round 2: .tutorialPromptCaption is the Section.tutorial.caption, or (when "use Section caption for tutorial" is on)
    // the Section's own caption, or blank.  Song.tutorial.caption is never used here; it heads the page as the breadcrumbs.
    const useSectionCaption = !!song?.tutorial?.useCaptionForSectionCaption;
    let theSectionCaption;
    if (useSectionCaption) {
        const ownCaption = song?.sections?.[currentSectionIndex]?.caption;
        theSectionCaption = typeof ownCaption === 'string' ? ownCaption : '';
    } else {
        theSectionCaption = typeof sectionTutorial.caption === 'string' ? sectionTutorial.caption : '';
    }
    return {
        mode,
        strict: mode === TUTORIAL_MODES.STRICT,
        wizard: mode === TUTORIAL_MODES.WIZARD,
        canEditPrompt,
        promptEditing: canEditPrompt && !!promptEditing,
        promptEditText: promptToEditText(sectionTutorial.prompt),
        canEditCaption,
        captionIsLabel: canEditPrompt && !canEditCaption, // wizard with "use caption for tutorial": a label, not a button
        captionEditing: canEditCaption && !!captionEditing,
        captionEditText: typeof sectionTutorial.caption === 'string' ? sectionTutorial.caption : '',
        songCaption: typeof song?.tutorial?.caption === 'string' ? song.tutorial.caption : '',
        sectionCaption: theSectionCaption,
        // Sprint 152 it5: strict mode only.  The Song's BPM (a string such as "80") for the BPM button, or the editor when bpmEditing.
        bpm: `${song?.defaultBPM ?? ''}`,
        bpmEditing: mode === TUTORIAL_MODES.STRICT && !!bpmEditing,
        // Authored strict captions are trusted HTML; a Section's own caption, and wizard captions, are plain text.
        sectionCaptionIsHtml: mode === TUTORIAL_MODES.STRICT && !useSectionCaption,
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

/** Sprint 152 it4, wizard mode only: the tutorial caption editor (`section.tutorial.caption`), exactly like the prompt editor.
 *  The caption is plain text. */
export function renderCaptionEditor(model = {}) {
    return '<div class="tutorialPromptEdit tutorialCaptionEdit">'
        + '<div class="tutorialPromptEditWarning">WARNING: Running the tutorial builder (npm build:tutorial-prompts) will re-write this caption.</div>'
        + '<div class="tutorialPromptEditHint">Click outside the box, or press Esc, to save the caption.  It is plain text.  An empty box removes the caption.</div>'
        + `<textarea id="tutorialCaptionEditor" class="tutorialPromptEditor tutorialCaptionEditor" rows="2" spellcheck="false" aria-label="Tutorial caption for this Section">\n${escapeHtml(model.captionEditText ?? '')}</textarea>`
        + '</div>';
}

function isEditingAnything(model = {}) {
    return !!(model.promptEditing || model.captionEditing);
}

/** Sprint 152 it3, wizard mode only: the small Edit Prompt button at the right of the Prompt Area.  Hidden while editing. */
export function renderTutorialPromptEditButton(model = {}) {
    if (!model.wizard || !model.canEditPrompt || isEditingAnything(model)) {
        return '';
    }
    return '<button type="button" class="BtnPunchedOut tutorialPromptEditButton" data-action="tutorialEditPrompt">Edit Prompt</button>';
}

/** Sprint 152 it4, wizard mode only: an Edit Caption button, or (when "use caption for tutorial" is on, so the caption is not
 *  editable) a boxed "&sect; Caption" label.  The button is hidden while editing; the label always shows. */
export function renderTutorialCaptionEditButton(model = {}) {
    if (!model.wizard) {
        return '';
    }
    if (model.captionIsLabel) {
        return '<span class="tutorialCaptionLabel">&sect; Caption</span>';
    }
    if (!model.canEditCaption || isEditingAnything(model)) {
        return '';
    }
    return '<button type="button" class="BtnPunchedOut tutorialPromptEditButton tutorialCaptionEditButton" data-action="tutorialEditCaption">Edit Caption</button>';
}

/** Sprint 152 it4: the Edit Caption button (or label) stacked above the Edit Prompt button.  '' when neither shows. */
export function renderTutorialEditButtons(model = {}) {
    const html = renderTutorialCaptionEditButton(model) + renderTutorialPromptEditButton(model);
    return html ? `<div class="tutorialPromptEditStack">${html}</div>` : '';
}

/** Sprint 152 it5, strict mode only: the BPM control of the widget row.  One button, text like `<span class="bpm">30<small>bpm</small></span>`
 *  (the `.bpm` span is kept live by showBPM()), or while editing the same text box and check button as the File menu page. */
export function renderTutorialBpmControl(model = {}) {
    if (!model.strict) {
        return '';
    }
    if (model.bpmEditing) {
        return `<input type="text" id="txtTutorialBPM" class="tutorialBpmInput" size="4" value="${escapeAttribute(model.bpm ?? '')}" aria-label="BPM">`
            + '<button type="button" class="tutorialNav tutorialBpm" data-action="tutorialCommitBpm">&check;</button>';
    }
    return '<button type="button" class="tutorialNav tutorialBpm" data-action="tutorialEditBpm" aria-label="Set BPM">'
        + `<span class="bpm">${escapeHtml(model.bpm ?? '')}<small>bpm</small></span></button>`;
}

export function renderTutorialPrompt(model = {}) {
    if (!model.strict && !model.wizard) {
        return '';
    }
    const arrow = model.lessonSectionListOpen ? "&#x1F783;" : "&#x1F782;"
    const hamburgerArrow = model.hamburgerControlsOpen ? "&#x1F781;" : "&#x1F782;"
    const sectionCurrOfCount = `<span class="tutorialSectionMark">&sect; </span><b>${model.currentSectionNumber}</b> <small>of</small> <b>${model.sectionCount}</b>`;    
    const sectionCurr = `<span class="tutorialSectionMark">&sect;</span>${model.currentSectionNumber}:&nbsp;&nbsp;`;    
    // Song.tutorial.caption heads the page in strict and wizard modes (first row; blank when omitted).
    const breadcrumbsRow = '<span class="tutorialBreadcrumbsLeader">Tutorial: </span><span class="tutorialPromptBreadcrumbsRow">'
        + `<span class="tutorialPromptBreadcrumbs">${escapeHtml(model.songCaption)}</span>`
        + '</span>';

    const sectionToggle = model.strict
        ? '<button type="button" class="tutorialPromptSectionToggle" data-action="tutorialToggleSectionList">Tutorial Sections &nbsp;&nbsp;'+arrow+'</button>'
            +'&nbsp;&nbsp;'+sectionCurrOfCount
            +breadcrumbsRow
            +'<br>'
        : '';
    // Wizard has no hamburger, so its breadcrumbs sit outside #tutorialPromptBurgerControls and are always visible.
    const wizardBreadcrumbs = model.wizard ? `<div class="tutorialPromptWizardBreadcrumbs">${breadcrumbsRow}</div>` : '';
    const tutorialPromptWidgetRow = model.strict
        ?  '<div class="tutorialPromptWidgetRow">'
         + '<button type="button" class="tutorialNav" data-action="tutorialFirstSection">&#x21E4; First</button>'
         + '<button type="button" class="tutorialNav" data-action="tutorialPrevSection">&laquo; Previous</button>'
         + '<button type="button" class="tutorialNavNext" data-action="tutorialNextSection">Next &raquo;</button>'
         + '<button type="button" class="tutorialNav" data-action="tutorialLastSection">Last &#x21E5;</button>'
         + renderTutorialBpmControl(model)
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
    
    const tutorialCaptionEditorDiv = model.captionEditing ? renderCaptionEditor(model) : '';
    const sectionCaptionHtml = model.sectionCaptionIsHtml ? (model.sectionCaption ?? '') : escapeHtml(model.sectionCaption ?? '');

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
            + wizardBreadcrumbs
            + '<span class="tutorialPromptHeader">'
            +   hamburger
            +   sectionCurr+`<span class="tutorialPromptCaption">${sectionCaptionHtml}</span>`
            + '</span>'
            + tutorialCaptionEditorDiv
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

    /** The Edit Caption / Edit Prompt buttons (stacked) live in a sibling host, side by side with #tutorialPrompt (which is replaced on every render).
     *  The destination only becomes a flex row while a button or label is showing, so strict and none layouts are untouched. */
    static renderEditButton(model) {
        const $dest = $(TutorialPromptBuilder.divTutorialPrompt).parent();
        if ($dest.length === 0) {
            return;
        }
        let $host = $dest.children('#tutorialPromptEditHost');
        if ($host.length === 0) {
            $host = $('<div id="tutorialPromptEditHost" class="tutorialPromptEditHost"></div>').appendTo($dest);
        }
        const buttonHtml = renderTutorialEditButtons(model);
        $host.html(buttonHtml);
        $dest.toggleClass('tutorialPromptHost--sideBySide', buttonHtml !== '');
    }
}
