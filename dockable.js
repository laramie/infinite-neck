const hasWindow = typeof window !== 'undefined';
const hasDocument = typeof document !== 'undefined';
const dockableFloatStateFallback = {};

// Utility: Return a JSON string of all dockable state objects (for debugging/inspection)
export function getAllDockableStateJSON() {
    // You can refine this to include other window properties if needed
    const floatState = hasWindow ? (window._dockableFloatState || {}) : dockableFloatStateFallback;
    try {
        return JSON.stringify(floatState, null, 2);
    } catch (e) {
        return 'Error stringifying dockable state: ' + e;
    }
}
// Clamp only the size (width/height) of a floating window to fit within the viewport, without moving it
function clampDockableSizeToViewport(floatWin, margin = 12) {
    if (!floatWin) return;

    const viewportWidth = Math.max(window.innerWidth || 0, 0);
    const viewportHeight = Math.max(window.innerHeight || 0, 0);
    const rect = floatWin.getBoundingClientRect();

    let newWidth = rect.width;
    let newHeight = rect.height;

    // Calculate the maximum width so the right edge is within the viewport minus margin
    const maxRight = viewportWidth - margin;
    if (rect.right > maxRight) {
        newWidth = Math.max(0, maxRight - rect.left);
        floatWin.style.width = newWidth + 'px';
    }

    // Calculate the maximum height so the bottom edge is within the viewport minus margin
    const maxBottom = viewportHeight - margin;
    if (rect.bottom > maxBottom) {
        newHeight = Math.max(0, maxBottom - rect.top);
        floatWin.style.height = newHeight + 'px';
    }
}
// dockable.js

import { draggable } from './drag.js';

function getDockableFloatState() {
    if (!hasWindow) return dockableFloatStateFallback;
    if (!window._dockableFloatState) window._dockableFloatState = {};
    return window._dockableFloatState;
}

function captureRectAsViewportPercent(floatWin) {
    const viewportWidth = Math.max(window.innerWidth || 0, 1);
    const viewportHeight = Math.max(window.innerHeight || 0, 1);
    const rect = floatWin.getBoundingClientRect();
    return {
        left: (rect.left / viewportWidth) * 100,
        top: (rect.top / viewportHeight) * 100,
        width: (rect.width / viewportWidth) * 100,
        height: (rect.height / viewportHeight) * 100
    };
}

/** Optional callback invoked as dockCaptureHook(divId, rectPercent) right when a div
 *  is docked (rect is percentages of viewport, same shape as anchorage.floatRect).
 *  dockable.js is deliberately Song/model-agnostic (it's used for non-tuning panels
 *  too, e.g. Info/ChartInput), so it cannot import Song itself -- instead the
 *  model-aware caller (infinite-neck.js) registers a hook here to persist the live
 *  rect into noteTablesLayout[].anchorage at dock time. This makes the *model* the
 *  single source of truth for "where should this reopen", instead of a separate
 *  window-stashed session cache. See sprint-141 Iteration 3 bugfix ("Float button
 *  throws away floatRect" / "consult the model, not a window var"). */
let dockCaptureHook = null;
export function setDockCaptureHook(fn) {
    dockCaptureHook = typeof fn === 'function' ? fn : null;
}

/** Optional callback invoked as dragEndCaptureHook(divId, rectPercent) right when a
 *  drag on a still-floating window ends (mouseup after a drag -- see draggable()'s
 *  onDragEnd param in drag.js). Unlike dockCaptureHook above, the div is still
 *  floating at this point -- only its position/size changed -- so the model-aware
 *  caller should update anchorage.floatRect without touching anchorage.floated. This
 *  is what makes a live drag persist to the in-memory Song model immediately,
 *  responding to the User's action, without waiting for a file save. */
let dragEndCaptureHook = null;
export function setDragEndCaptureHook(fn) {
    dragEndCaptureHook = typeof fn === 'function' ? fn : null;
}

function getFloatingDockables() {
    if (!hasDocument) return [];
    const floatState = getDockableFloatState();
    return Object.keys(floatState)
        .map(divId => ({
            divId,
            state: floatState[divId],
            floatWin: document.getElementById('floating-' + divId)
        }))
        .filter(entry => entry.floatWin);
}

function clampOneDockableToViewport(floatWin, margin = 12) {
    if (!floatWin) return;

    const viewportWidth = Math.max(window.innerWidth || 0, 0);
    const viewportHeight = Math.max(window.innerHeight || 0, 0);
    // Read the *rendered* position/size in px via getBoundingClientRect() rather than
    // parsing floatWin.style.left/top: those styles may be percentage strings (e.g.
    // makeDivDockable() restoring a saved anchorage.floatRect as "34.44%"), and
    // parseFloat() would silently strip the '%' and misread that number as px --
    // collapsing a restored position back to near top-left. See sprint-141 Iteration 3
    // bugfix (saved floatRect values were being ignored on song load).
    const rect = floatWin.getBoundingClientRect();
    const left = rect.left;
    const top = rect.top;

    // Clamp position
    const maxLeft = Math.max(margin, viewportWidth - rect.width - margin);
    const maxTop = Math.max(margin, viewportHeight - rect.height - margin);

    const clampedLeft = Math.min(Math.max(left, margin), maxLeft);
    const clampedTop = Math.min(Math.max(top, margin), maxTop);

    // Only touch the style (switching it to a px value) when the window is actually
    // out of bounds -- otherwise leave a percentage-based style alone so it stays
    // responsive to viewport resizes and doesn't get needlessly pinned to px.
    if (clampedLeft !== left) {
        floatWin.style.left = clampedLeft + 'px';
    }
    if (clampedTop !== top) {
        floatWin.style.top = clampedTop + 'px';
    }

    // Adjust size if too large for viewport
    let newWidth = rect.width;
    let newHeight = rect.height;
    const maxWidth = viewportWidth - 2 * margin;
    const maxHeight = viewportHeight - 2 * margin;

    if (rect.width > maxWidth) {
        newWidth = maxWidth;
        floatWin.style.width = newWidth + 'px';
    }
    // Only shrink height if needed
    if (rect.height > maxHeight) {
        newHeight = maxHeight;
        floatWin.style.height = newHeight + 'px';
    }
}

function applyHandleOrientation(floatWin, handle, contentHost, orientation, toggleBtn) {
    const isTop = orientation === 'top';

    floatWin.style.flexDirection = isTop ? 'column' : 'row';
    floatWin.style.alignItems = isTop ? 'stretch' : 'stretch';
    floatWin.dataset.handleOrientation = orientation;

    handle.style.flex = isTop ? '0 0 2em' : '0 0 2em';
    handle.style.width = isTop ? 'auto' : '2em';
    handle.style.minWidth = isTop ? '0' : '2em';
    handle.style.height = isTop ? '2em' : 'auto';
    handle.style.minHeight = isTop ? '2em' : '100%';
    handle.style.alignSelf = 'stretch';
    handle.style.flexDirection = isTop ? 'row' : 'column';
    handle.style.alignItems = 'center';
    handle.style.justifyContent = 'flex-start';
    handle.style.paddingTop = isTop ? '0' : '0.25em';
    handle.style.paddingLeft = isTop ? '0.25em' : '0';
    handle.style.borderTopLeftRadius = '12px';
    handle.style.borderTopRightRadius = isTop ? '12px' : '0';
    handle.style.borderBottomLeftRadius = isTop ? '0' : '12px';
    handle.style.borderBottomRightRadius = '0';

    contentHost.style.flex = '1 1 auto';
    contentHost.style.minWidth = '0';
    contentHost.style.minHeight = '0';

    toggleBtn.textContent = isTop ? '↔' : '↕';
    toggleBtn.title = isTop ? 'Move handle to left side' : 'Move handle to top';
}

export function isDivFloating(divId) {
    if (!hasDocument) return false;
    const floatState = getDockableFloatState();
    return !!floatState[divId];
}

/** Renames a currently-floating div's DOM id (and its floating wrapper's id) in place,
 *  keeping its dockable state under the new key. No-op if the div isn't currently
 *  floating (a docked div's id is safe for the caller to rename directly). Needed
 *  because divIds are derived from a tuning's baseID (see Constants.TABLEDIV_ID_PREFIX):
 *  renaming a Tuning ID while its table is floated must keep the floating window in
 *  sync, otherwise it's orphaned under the old id and a stale caption, while a fresh
 *  docked instance gets built under the new id. See sprint-141 Iteration 3 bugfix. */
export function renameDockableDiv(oldDivId, newDivId) {
    if (!hasDocument || !oldDivId || !newDivId || oldDivId === newDivId) return;
    const floatState = getDockableFloatState();
    const state = floatState[oldDivId];
    if (!state) return;

    const div = document.getElementById(oldDivId);
    const floatWin = document.getElementById('floating-' + oldDivId);
    if (div) div.id = newDivId;
    if (floatWin) floatWin.id = 'floating-' + newDivId;

    delete floatState[oldDivId];
    floatState[newDivId] = state;

    const floatBtn = document.getElementById('btnFloatSection_' + oldDivId);
    if (floatBtn) floatBtn.id = 'btnFloatSection_' + newDivId;
}

/** Detaches divId from its current parent and re-parents it into a new floating
 *  window appended to document.body. rect, if given, is a { left, top, width,
 *  height } object of percentages of the viewport (see sprint-141 Iteration 3,
 *  point 9.2) used to restore a previously-saved position/size; any omitted key
 *  falls back to the existing hardcoded default (top/left) or browser intrinsic
 *  sizing (width/height). */
export function makeDivDockable(divId, rect = null) {
    if (!hasDocument) return;
    const floatState = getDockableFloatState();

    const div = document.getElementById(divId);
    if (!div || floatState[divId]) return;

    // Save original parent and next sibling
    floatState[divId] = {
        parent: div.parentNode,
        next: div.nextSibling
    };

    // The Song model (noteTablesLayout[].anchorage.floatRect) is the single source of
    // truth for "where should this reopen" -- callers that want a restored position
    // must resolve it from the model and pass it explicitly as rect (see
    // infinite-neck.js's floatNoteTableDiv()). See sprint-141 Iteration 3 bugfix
    // ("Float button throws away floatRect" / "consult the model, not a window var").
    const effectiveRect = rect;

    const hasLeft = effectiveRect && typeof effectiveRect.left === 'number' && Number.isFinite(effectiveRect.left);
    const hasTop = effectiveRect && typeof effectiveRect.top === 'number' && Number.isFinite(effectiveRect.top);
    const hasWidth = effectiveRect && typeof effectiveRect.width === 'number' && Number.isFinite(effectiveRect.width);
    const hasHeight = effectiveRect && typeof effectiveRect.height === 'number' && Number.isFinite(effectiveRect.height);

    // Create floating container
    const floatWin = document.createElement('div');
    floatWin.id = 'floating-' + divId;
    floatWin.style.position = 'fixed';
    floatWin.style.top = hasTop ? `${effectiveRect.top}%` : '100px';
    floatWin.style.left = hasLeft ? `${effectiveRect.left}%` : '100px';
    if (hasWidth) {
        floatWin.style.width = `${effectiveRect.width}%`;
    }
    if (hasHeight) {
        floatWin.style.height = `${effectiveRect.height}%`;
    }
    floatWin.style.zIndex = 200;
    //floatWin.style.background = '#96001c';
    floatWin.style.background = 'white';
    floatWin.style.border = '2px solid #0b4803';
    floatWin.style.borderRadius = '12px';
    //floatWin.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
    floatWin.style.boxShadow = '0 0 6pt 0 maroon';
    floatWin.style.padding = '0';
    floatWin.className = 'toolWindowRounded';
    floatWin.style.display = 'flex';
    floatWin.style.flexDirection = 'row';
    floatWin.style.alignItems = 'stretch';
    floatWin.style.minHeight = '6em';
    floatWin.style.resize = 'both';
    floatWin.style.overflow = 'auto';
    floatWin.style.boxSizing = 'border-box';

    // Create vertical drag handle
    const handle = document.createElement('div');
    handle.style.display = 'flex';
    handle.style.boxSizing = 'border-box';
    handle.style.background = '#5aff39';
    handle.style.cursor = 'grab';
    handle.style.userSelect = 'none';
    handle.className = "dockable-handle";

    const contentHost = document.createElement('div');
    contentHost.style.flex = '1 1 auto';
    contentHost.style.minWidth = '0';
    contentHost.style.minHeight = '0';

    // Dock button (emoji)
    const dockBtn = document.createElement('button');
    dockBtn.textContent = '📌';
    dockBtn.title = 'Dock';
    dockBtn.style.background = 'none';
    dockBtn.style.border = 'none';
    dockBtn.style.padding = '0';
    dockBtn.style.margin = '0';
    dockBtn.style.lineHeight = '1';
    dockBtn.style.fontSize = '1.5em';
    dockBtn.style.cursor = 'pointer';
    dockBtn.onclick = function (e) {
        e.stopPropagation();
        // Use the div's *current* id (not the divId parameter closed over at creation
        // time) -- renameDockableDiv() may have updated div.id since this handler was
        // created (e.g. a Tuning ID rename while the table was floating).
        dockDivInPage(div.id);
    };

    const toggleHandleBtn = document.createElement('button');
    toggleHandleBtn.style.background = 'none';
    toggleHandleBtn.style.border = 'none';
    toggleHandleBtn.style.padding = '0';
    toggleHandleBtn.style.margin = '0';
    toggleHandleBtn.style.lineHeight = '1';
    toggleHandleBtn.style.fontSize = '2.2em';
    toggleHandleBtn.style.cursor = 'pointer';
    toggleHandleBtn.onclick = function (e) {
        e.stopPropagation();
        const nextOrientation = floatWin.dataset.handleOrientation === 'top' ? 'side' : 'top';
        applyHandleOrientation(floatWin, handle, contentHost, nextOrientation, toggleHandleBtn);
        clampDockableSizeToViewport(floatWin);
    };

    handle.appendChild(dockBtn);
    handle.appendChild(toggleHandleBtn);

    applyHandleOrientation(floatWin, handle, contentHost, 'side', toggleHandleBtn);

    // Add drag logic to handle only. On drag end, persist the live position/size to
    // the model (via dragEndCaptureHook, if registered) using the div's *current* id
    // -- see the dockBtn.onclick comment above for why div.id (not divId) is used.
    draggable(floatWin, handle, function () {
        if (dragEndCaptureHook) {
            dragEndCaptureHook(div.id, captureRectAsViewportPercent(floatWin));
        }
    });

    // Compose window: [handle][content]
    floatWin.appendChild(handle);
    contentHost.appendChild(div);
    floatWin.appendChild(contentHost);

    // Add to body
    document.body.appendChild(floatWin);
    clampOneDockableToViewport(floatWin);
    const floatBtn = document.getElementById('btnFloatSection_' + divId);
    if (floatBtn) floatBtn.style.display = 'none'; // or floatBtn.disabled = true;
}

export function dockDivInPage(divId) {
    if (!hasDocument) return;
    const floatState = getDockableFloatState();
    const div = document.getElementById(divId);
    const state = floatState[divId];
    const floatWin = document.getElementById('floating-' + divId);
    if (!div || !state || !floatWin) return;

    // Let the model-aware caller (infinite-neck.js) persist this window's live
    // position/size into noteTablesLayout[].anchorage.floatRect right now, so a
    // subsequent Float reads it back from the model -- see setDockCaptureHook() above.
    if (dockCaptureHook) {
        dockCaptureHook(divId, captureRectAsViewportPercent(floatWin));
    }

    // Restore to original parent and position
    if (state.parent && state.parent.isConnected) {
        if (state.next && state.next.parentNode === state.parent) {
            state.parent.insertBefore(div, state.next);
        } else {
            state.parent.appendChild(div);
        }
    }

    const floatBtn = document.getElementById('btnFloatSection_' + divId);
    if (floatBtn) floatBtn.style.display = ''; // or floatBtn.disabled = false;

    // Remove floating window
    floatWin.remove();

    // Clean up state
    delete floatState[divId];
}

export function disposeAllDockables() {
    const floatState = getDockableFloatState();
    getFloatingDockables().forEach(({ divId, floatWin }) => {
        if (floatWin) {
            floatWin.remove();
        }
        delete floatState[divId];
    });
}

export function dockAllDockables() {
    getFloatingDockables().forEach(({ divId }) => {
        dockDivInPage(divId);
    });
}

export function gatherAllDockables(startLeft = 40, startTop = 40, gap = 40) {
    let left = startLeft;
    let top = startTop;

    getFloatingDockables().forEach(({ floatWin }) => {
        floatWin.style.left = left + 'px';
        floatWin.style.top = top + 'px';
        clampOneDockableToViewport(floatWin, gap);
        top += gap;
        left += gap;
    });
}

export function clampAllDockablesToViewport(margin = 12) {
    getFloatingDockables().forEach(({ floatWin }) => {
        clampOneDockableToViewport(floatWin, margin);
    });
}

if (hasWindow) {
    window.addEventListener('resize', function () {
        clampAllDockablesToViewport();
    });
}

// Make functions globally accessible for inline HTML usage
if (hasWindow) {
    window.makeDivDockable = makeDivDockable;
    window.dockDivInPage = dockDivInPage;
    window.disposeAllDockables = disposeAllDockables;
    window.dockAllDockables = dockAllDockables;
    window.gatherAllDockables = gatherAllDockables;
    window.clampAllDockablesToViewport = clampAllDockablesToViewport;
    window.renameDockableDiv = renameDockableDiv;
}
