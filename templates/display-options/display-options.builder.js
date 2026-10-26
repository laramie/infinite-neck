/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 148 Iteration 5: the interactive DisplayOptions Matrix widget -- a mouse-driven wrapper of the /vpm commands.
// Thin and DOM-only: the rules live in the pure, Jest-tested modules
//   displayOptionsMatrixTools.js  (Tools, zones, what a click means, Inspect text)
//   displayOptionsMatrixView.js   (the table and Legend HTML)
//   displayOptionsPlan.js         (plans and Undo)
// The widget keeps no model state of its own: it reads the Song and the live controls at render and click time
// (InfiniteNeck.getDisplayOptionsMatrixContext) and redraws from EventBus events, so /vpm commands, the SAVE Diff
// buttons and the Matrix can be mixed freely.  It is quiet: actions report in the status line, never in Messages.
//
// Update strategy (design 6): hidden means idle (only a `stale` flag); the loop path (SectionChanged, live controls)
// patches the Current-row highlight and the LIVE row in place and never replaces Section cells; a full redraw happens
// when the model changes, a Song opens, or the list of Sections changes.

import * as InfiniteNeck from '../../infinite-neck.js';
import EventBus from '../../event-bus.js';
import { makeDivDockable, dockDivInPage } from '../../dockable.js';
import {
    TOOLS, ZONES, DEFAULT_TOOL_ID, getTool, isToolLegalInZone, sectionHeaderNavigates, planMatrixClick, planAffectsApply
} from './displayOptionsMatrixTools.js';
import { buildMatrixHtml, buildLiveRowHtml, buildLegendHtml } from './displayOptionsMatrixView.js';
import { escapeHtml } from './displayOptionsCellRules.js';

const NS = '.displayOptionsMatrix';
const DIV_ID = 'divDisplayOptionsMatrix';
const FLOAT_Z_INDEX = 900;
const FLOAT_RECT = { left: 4, top: 12, width: 90 };   // percent of the viewport (dockable.js)

const HINT_NOT_APPLIED = 'Controls not re-applied: press Apply, or navigate.';
const WARN_DIRTY = 'Live controls changed: SaveDiff before next Apply';

/** Tools whose effect is a whole row or a whole column (the hover preview highlights it). */
const ROW_TOOLS = new Set(['clearSection', 'sectionRead', 'sectionWrite']);
const COLUMN_TOOLS = new Set(['keyRead', 'keyWrite']);
/** Zones that are never clickable: no hover preview, no cursor change. */
const INERT_ZONES = new Set([ZONES.corner, ZONES.groupHeader, ZONES.specialLabel, ZONES.sectionLabel]);

export class DisplayOptionsMatrixBuilder {
    static widget = null;          // Singleton: #divDisplayOptionsMatrix
    static toolId = DEFAULT_TOOL_ID;
    static view = { column: true, row: true };
    static stale = true;
    static pending = null;
    static rafId = 0;
    static renderedSong = null;
    static renderedSections = [];
    static eventsBound = false;
    static legendBuilt = false;

    //========================= mounting =========================

    static addToDest(divDestSelector) {
        if (!DisplayOptionsMatrixBuilder.widget) {
            const template = document.getElementById('display-options-matrix-template');
            const clone = template.content.cloneNode(true);
            DisplayOptionsMatrixBuilder.widget = clone.querySelector(`#${DIV_ID}`);
            $(divDestSelector).empty().append(DisplayOptionsMatrixBuilder.widget);
            DisplayOptionsMatrixBuilder.buildToolRadios();
            DisplayOptionsMatrixBuilder.bindEvents();
            DisplayOptionsMatrixBuilder.setTool(DEFAULT_TOOL_ID);
        }
        return DisplayOptionsMatrixBuilder.widget;
    }

    /** The radio group comes from TOOLS, so the labels and order stay with the pure module. */
    static buildToolRadios() {
        const html = TOOLS.map((tool) => `<label><input type="radio" name="rbnDisplayOptionsMatrixTool" value="${tool.id}">${escapeHtml(tool.label)}</label>`);
        $('#dmTools').html(html.join(''));
    }

    //========================= open / float / dispose =========================

    static isOpen() {
        return !!DisplayOptionsMatrixBuilder.widget && $(DisplayOptionsMatrixBuilder.widget).css('display') !== 'none';
    }

    static isVisible() {
        return !!DisplayOptionsMatrixBuilder.widget && $(DisplayOptionsMatrixBuilder.widget).is(':visible');
    }

    static isFloating() {
        return !!document.getElementById(`floating-${DIV_ID}`);
    }

    static setOpen(open) {
        const builder = DisplayOptionsMatrixBuilder;
        if (!builder.widget) {
            return;
        }
        if (open) {
            $(builder.widget).show();
            builder.stale = true;
            builder.schedule('full');
        } else {
            builder.dockBeforeDispose();
            $(builder.widget).hide();
        }
        $('#spanDisplayOptionsMatrixArrow').html(open ? '&#x25BC;' : '&#x25B6;');
    }

    static float() {
        if (DisplayOptionsMatrixBuilder.widget && !DisplayOptionsMatrixBuilder.isFloating()) {
            makeDivDockable(DIV_ID, FLOAT_Z_INDEX, { ...FLOAT_RECT });
        }
    }

    /** disposeAllDockables() deletes a floating window together with the div inside it, so dock first.
     *  A no-op when the Matrix is not floating (dockDivInPage ignores it). */
    static dockBeforeDispose() {
        dockDivInPage(DIV_ID);
    }

    /** A Song was opened: start over with the Inspect tool and redraw when the Matrix is next seen. */
    static onSongOpened() {
        const builder = DisplayOptionsMatrixBuilder;
        if (!builder.widget) {
            return;
        }
        builder.setTool(DEFAULT_TOOL_ID);
        builder.setStatus([]);
        builder.stale = true;
        builder.schedule('full');
    }

    /** The View page was just shown: catch up if events arrived while the Matrix was hidden. */
    static refreshIfStale() {
        if (DisplayOptionsMatrixBuilder.widget && DisplayOptionsMatrixBuilder.stale) {
            DisplayOptionsMatrixBuilder.schedule('full');
        }
    }

    //========================= tools and view options =========================

    static setTool(toolId) {
        const builder = DisplayOptionsMatrixBuilder;
        const tool = getTool(toolId) ?? getTool(DEFAULT_TOOL_ID);
        builder.toolId = tool.id;
        $(`input[name="rbnDisplayOptionsMatrixTool"]`).each(function () {
            this.checked = this.value === tool.id;
        });
        const scroller = $('#dmScroll');
        TOOLS.forEach((t) => scroller.removeClass(`dmTool-${t.id}`));
        scroller.addClass(`dmTool-${tool.id}`);
        // Q10: choosing a Key or Section tool switches the matching overlay on, otherwise its toggle would look like nothing happened.
        if (tool.overlay === 'column') {
            builder.view.column = true;
        } else if (tool.overlay === 'row') {
            builder.view.row = true;
        }
        builder.updateViewButtons();
        builder.clearHover();
    }

    static updateViewButtons() {
        const { column, row } = DisplayOptionsMatrixBuilder.view;
        $('#btnViewColumnGates_Matrix').toggleClass('BtnPunchedIn', column).toggleClass('BtnPunchedOut', !column);
        $('#btnViewRowGates_Matrix').toggleClass('BtnPunchedIn', row).toggleClass('BtnPunchedOut', !row);
        $('#dmScroll').toggleClass('dmShowColGates', column).toggleClass('dmShowRowGates', row);
    }

    //========================= status line =========================

    /** lines: plain text (escaped here).  title is bold.  kind: '' | 'warn' | 'hint'. */
    static setStatus(lines, kind = '', title = '') {
        const status = $('#dmStatus');
        const parts = [];
        if (title) {
            parts.push(`<span class="dmStatusTitle">${escapeHtml(title)}</span>`);
        }
        (Array.isArray(lines) ? lines : [lines]).filter(Boolean).forEach((line) => parts.push(escapeHtml(line)));
        status.html(parts.join('<br>'))
            .toggleClass('dmStatusWarn', kind === 'warn')
            .toggleClass('dmStatusHint', kind === 'hint');
    }

    //========================= drawing =========================

    /** Coalesces redraw requests into one animation frame.  kind: 'full' | 'live' | 'current'. */
    static schedule(kind) {
        const builder = DisplayOptionsMatrixBuilder;
        if (!builder.widget) {
            return;
        }
        if (!builder.isVisible()) {
            builder.stale = true;   // hidden means idle: nothing is drawn until the Matrix is shown again
            return;
        }
        builder.pending = { ...(builder.pending || {}), [kind]: true };
        if (!builder.rafId) {
            builder.rafId = requestAnimationFrame(() => builder.flush());
        }
    }

    static sameSections(song) {
        const now = song.sections;
        const then = DisplayOptionsMatrixBuilder.renderedSections;
        return now.length === then.length && now.every((section, i) => section === then[i]);
    }

    static flush() {
        const builder = DisplayOptionsMatrixBuilder;
        const pending = builder.pending;
        builder.rafId = 0;
        builder.pending = null;
        if (!pending || !builder.widget) {
            return;
        }
        if (!builder.isVisible()) {
            builder.stale = true;
            return;
        }
        const ctx = InfiniteNeck.getDisplayOptionsMatrixContext();
        if (builder.stale || pending.full || ctx.song !== builder.renderedSong || !builder.sameSections(ctx.song)) {
            builder.render(ctx);
            return;
        }
        if (pending.current) {
            builder.moveCurrentRow(ctx.currentIndex);
        }
        if (pending.live) {
            builder.patchLiveRow(ctx);
        }
        builder.updateButtons(ctx);
    }

    static render(ctx = InfiniteNeck.getDisplayOptionsMatrixContext()) {
        const builder = DisplayOptionsMatrixBuilder;
        const scroller = document.getElementById('dmScroll');
        const host = document.getElementById('dmTableHost');
        const firstDraw = builder.renderedSong === null;
        const { scrollTop, scrollLeft } = scroller;
        host.innerHTML = buildMatrixHtml(ctx.song, { currentIndex: ctx.currentIndex, live: ctx.live });
        scroller.scrollTop = scrollTop;
        scroller.scrollLeft = scrollLeft;
        builder.measureStickyOffsets();
        builder.renderedSong = ctx.song;
        builder.renderedSections = ctx.song.sections.slice();
        builder.stale = false;
        builder.updateButtons(ctx);
        if (firstDraw) {
            builder.ensureCurrentRowVisible();
        }
    }

    /** The key, DEFAULTS and LIVE rows stick below the rows above them, so measure the heights (CSS can't). */
    static measureStickyOffsets() {
        const scroller = document.getElementById('dmScroll');
        const height = (selector) => scroller.querySelector(selector)?.offsetHeight ?? 0;
        const group = height('tr.dmGroupRow');
        const key = height('tr.dmKeyRow');
        const defaults = height('tr.dmDefaultsRow');
        const songDefaults = height('tr.dmSongDefaultsRow');
        const live = height('tr.dmLiveRow');
        // Row heights only, no border-spacing: stuck rows sit flush against each other.
        scroller.style.setProperty('--dm-top-key', `${group}px`);
        scroller.style.setProperty('--dm-top-defaults', `${group + key}px`);
        scroller.style.setProperty('--dm-top-songdefaults', `${group + key + defaults}px`);
        scroller.style.setProperty('--dm-top-live', `${group + key + defaults + songDefaults}px`);
        DisplayOptionsMatrixBuilder.stuckHeaderHeight = group + key + defaults + songDefaults + live;
    }

    static updateButtons(ctx) {
        $('#btnUndo_Matrix').prop('disabled', !ctx.canUndo);
        $('#btnSaveDiff_Matrix').toggleClass('riskyButtonActionRequired', !!ctx.dirty);
        $('#btnClearSongDisplayOptions').prop('disabled', !ctx.hasSongDefaults);
        $('#btnCurrentSectionToSongDisplayOptions').prop('disabled', !ctx.currentStoresCells);
    }

    /** SectionChanged: moves the highlight; no cell is replaced, so a click in progress is never lost. */
    static moveCurrentRow(currentIndex) {
        const host = document.getElementById('dmTableHost');
        host.querySelectorAll('.dmCurrentRow').forEach((el) => el.classList.remove('dmCurrentRow'));
        const row = host.querySelector(`tr[data-section-row="${currentIndex}"]`);
        if (row) {
            row.classList.add('dmCurrentRow');
            row.querySelector('th.dmSectionHeader')?.classList.add('dmCurrentRow');
        }
        DisplayOptionsMatrixBuilder.ensureCurrentRowVisible();
    }

    /** Scrolls only the Matrix's own container, and only when the Current row is out of view (never the page). */
    static ensureCurrentRowVisible() {
        const scroller = document.getElementById('dmScroll');
        const row = scroller?.querySelector('tr.dmSectionRow.dmCurrentRow');
        if (!row) {
            return;
        }
        const box = scroller.getBoundingClientRect();
        const rowBox = row.getBoundingClientRect();
        // the height of the stuck rows (the thead rect would also include the border-spacing gaps, which are not stuck)
        const headerHeight = DisplayOptionsMatrixBuilder.stuckHeaderHeight ?? 0;
        if (rowBox.top < box.top + headerHeight) {
            scroller.scrollTop -= (box.top + headerHeight) - rowBox.top;
        } else if (rowBox.bottom > box.bottom) {
            scroller.scrollTop += rowBox.bottom - box.bottom;
        }
    }

    static patchLiveRow(ctx) {
        const row = document.querySelector('#dmTableHost tr.dmLiveRow');
        if (!row) {
            return;
        }
        const holder = document.createElement('tbody');
        holder.innerHTML = buildLiveRowHtml(ctx.live);
        row.replaceWith(holder.firstElementChild);
    }

    //========================= clicks =========================

    static afterEditThatChangesApply(wasDirty, lines) {
        if (!$('#cbAutoApply_Matrix').prop('checked')) {
            lines.push(HINT_NOT_APPLIED);
            return 'hint';
        }
        if (wasDirty) {
            lines.push(WARN_DIRTY);
            return 'warn';
        }
        InfiniteNeck.sectionChanged();
        lines.push('Applied: controls re-applied from the model.');
        return '';
    }

    static handleClick(element) {
        const builder = DisplayOptionsMatrixBuilder;
        const zone = element.dataset.zone;
        const sectionIndex = element.dataset.section !== undefined ? parseInt(element.dataset.section, 10) : null;
        const key = element.dataset.key ?? null;
        const ctx = InfiniteNeck.getDisplayOptionsMatrixContext();
        const result = planMatrixClick(ctx.song, builder.toolId, zone, { sectionIndex, key }, { live: ctx.live, syncLive: ctx.syncLive });

        if (result.kind === 'none') {
            return;   // a zone this tool does not work in: silently nothing
        }
        if (result.kind === 'navigate') {
            InfiniteNeck.linkToSection(result.sectionIndex);
            return;
        }
        if (result.kind === 'inspect') {
            builder.setStatus(result.lines, '', result.title);
            return;
        }
        const out = InfiniteNeck.runDisplayOptionsPlan(result.plan, { quiet: true });
        const lines = [out.report];
        let kind = '';
        if (out.changed && planAffectsApply(result.plan, ctx.currentIndex)) {
            kind = builder.afterEditThatChangesApply(ctx.dirty, lines);
        }
        builder.setStatus(lines, kind);
    }

    static handleUndo() {
        const builder = DisplayOptionsMatrixBuilder;
        const wasDirty = InfiniteNeck.getDisplayOptionsMatrixContext().dirty;
        const out = InfiniteNeck.undoDisplayOptionsOp({ quiet: true });
        const lines = [out.report];
        const kind = out.changed ? builder.afterEditThatChangesApply(wasDirty, lines) : '';
        builder.setStatus(lines, kind);
    }

    static handleSaveAll() {
        DisplayOptionsMatrixBuilder.setStatus([InfiniteNeck.handleBtnSaveAll({ quiet: true }).report]);
    }

    static handleApply() {
        const sectionNumber = InfiniteNeck.getDisplayOptionsMatrixContext().currentIndex + 1;
        InfiniteNeck.sectionChanged();
        DisplayOptionsMatrixBuilder.setStatus([`Applied Section ${sectionNumber}: controls re-applied from the model.`]);
    }

    /** Sprint 148 it6: the two Song-DEFAULTS buttons.  A real change always alters what Apply would do (Song-DEFAULTS sit under
     *  every Section), so the usual Auto-apply / hint / dirty-warning path runs.  They do not use the Undo slot. */
    static handleSongDefaultsButton(action) {
        const builder = DisplayOptionsMatrixBuilder;
        const wasDirty = InfiniteNeck.getDisplayOptionsMatrixContext().dirty;
        const out = action({ quiet: true });
        const lines = [out.report];
        const kind = out.changed ? builder.afterEditThatChangesApply(wasDirty, lines) : '';
        builder.setStatus(lines, kind);
    }

    //========================= hover preview =========================

    static clearHover() {
        document.querySelectorAll('#dmTableHost .dmHot, #dmTableHost .dmIllegal').forEach((el) => el.classList.remove('dmHot', 'dmIllegal'));
    }

    static hover(element) {
        const builder = DisplayOptionsMatrixBuilder;
        builder.clearHover();
        const zone = element.dataset.zone;
        if (INERT_ZONES.has(zone)) {
            return;
        }
        if (zone === ZONES.sectionHeader && sectionHeaderNavigates(builder.toolId)) {
            return;   // a plain link with this Tool: no row preview, no not-allowed cursor
        }
        if (!isToolLegalInZone(builder.toolId, zone)) {
            element.classList.add('dmIllegal');
            return;
        }
        const host = document.getElementById('dmTableHost');
        let targets = [element];
        if (COLUMN_TOOLS.has(builder.toolId) && element.dataset.key) {
            targets = host.querySelectorAll(`[data-key="${CSS.escape(element.dataset.key)}"]`);
        } else if (ROW_TOOLS.has(builder.toolId) && element.dataset.section !== undefined) {
            targets = host.querySelectorAll(`tr[data-section-row="${CSS.escape(element.dataset.section)}"] > *`);
        }
        targets.forEach((el) => el.classList.add('dmHot'));
    }

    //========================= events =========================

    static toggleLegend() {
        const legend = $('#dmLegend');
        const opening = !legend.is(':visible');
        if (opening && !DisplayOptionsMatrixBuilder.legendBuilt) {
            legend.html(buildLegendHtml());
            DisplayOptionsMatrixBuilder.legendBuilt = true;
        }
        legend.toggle(opening);
        $('#spanDisplayOptionsMatrixLegendArrow').html(opening ? '&#x25BC;' : '&#x25B6;');
    }

    static bindEvents() {
        const builder = DisplayOptionsMatrixBuilder;
        const widget = $(builder.widget);
        const press = (selector, handler) => {
            widget.on(`click${NS}`, selector, function (e) {
                e.preventDefault();
                handler.call(this);
                this.blur();   // keep keyboard shortcuts working, as the other buttons do
            });
        };

        press('#btnSaveDiff_Matrix', () => builder.setStatus([InfiniteNeck.handleBtnSaveDiff({ quiet: true }).report]));
        press('#btnSaveAll_Matrix', () => builder.handleSaveAll());
        press('#btnApply_Matrix', () => builder.handleApply());
        press('#btnCurrentSectionToSongDisplayOptions', () => builder.handleSongDefaultsButton(InfiniteNeck.handleBtnCurrentSectionToSongDisplayOptions));
        press('#btnClearSongDisplayOptions', () => builder.handleSongDefaultsButton(InfiniteNeck.handleBtnClearSongDisplayOptions));
        press('#btnUndo_Matrix', () => builder.handleUndo());
        press('#btnFloatSection_divDisplayOptionsMatrix', () => builder.float());
        press('#btnClose_Matrix', () => builder.setOpen(false));
        press('#btnLegend_Matrix', () => builder.toggleLegend());
        press('#btnViewColumnGates_Matrix', () => {
            builder.view.column = !builder.view.column;
            builder.updateViewButtons();
        });
        press('#btnViewRowGates_Matrix', () => {
            builder.view.row = !builder.view.row;
            builder.updateViewButtons();
        });

        widget.on(`change${NS}`, 'input[name="rbnDisplayOptionsMatrixTool"]', function () {
            builder.setTool(this.value);
            this.blur();
        });
        widget.on(`change${NS}`, '#cbAutoApply_Matrix', function () {
            this.blur();
        });

        const host = $('#dmTableHost');
        host.on(`click${NS}`, 'a.dmSectionLink', (e) => e.preventDefault());
        host.on(`click${NS}`, '[data-zone]', function () {
            builder.handleClick(this);
        });
        host.on(`mouseover${NS}`, '[data-zone]', function () {
            builder.hover(this);
        });
        host.on(`mouseleave${NS}`, () => builder.clearHover());

        // The toggle lives on the View page's Display Options card (index.html), outside this widget.
        $(document).off(`click${NS}`, '#btnToggleDisplayOptionsMatrix').on(`click${NS}`, '#btnToggleDisplayOptionsMatrix', function () {
            builder.setOpen(!builder.isOpen());
            this.blur();
        });

        if (!builder.eventsBound) {
            builder.eventsBound = true;
            EventBus.on('SectionChanged', () => builder.schedule('current'));
            EventBus.on('DisplayOptionsModel:changed', () => builder.schedule('full'));
            EventBus.on('DisplayOptions:liveChanged', (event, data) => {
                builder.schedule('live');
                // Q2: with Auto-apply on, the next edit would overwrite unsaved control changes.
                if (data?.dirty && builder.isVisible() && $('#cbAutoApply_Matrix').prop('checked')) {
                    builder.setStatus([WARN_DIRTY], 'warn');
                }
            });
        }
    }
}
