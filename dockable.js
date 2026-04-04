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
    const rect = floatWin.getBoundingClientRect();

    let left = parseFloat(floatWin.style.left || '0');
    let top = parseFloat(floatWin.style.top || '0');

    if (!Number.isFinite(left)) left = rect.left;
    if (!Number.isFinite(top)) top = rect.top;

    // Clamp position
    const maxLeft = Math.max(margin, viewportWidth - rect.width - margin);
    const maxTop = Math.max(margin, viewportHeight - rect.height - margin);

    left = Math.min(Math.max(left, margin), maxLeft);
    top = Math.min(Math.max(top, margin), maxTop);

    floatWin.style.left = left + 'px';
    floatWin.style.top = top + 'px';

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

export function makeDivDockable(divId) {
    if (!hasDocument) return;
    const floatState = getDockableFloatState();

    const div = document.getElementById(divId);
    if (!div || floatState[divId]) return;

    // Save original parent and next sibling
    floatState[divId] = {
        parent: div.parentNode,
        next: div.nextSibling
    };

    // Create floating container
    const floatWin = document.createElement('div');
    floatWin.id = 'floating-' + divId;
    floatWin.style.position = 'fixed';
    floatWin.style.top = '100px';
    floatWin.style.left = '100px';
    floatWin.style.zIndex = 200;
    floatWin.style.background = '#96001c';
    floatWin.style.border = '2px solid #888';
    floatWin.style.borderRadius = '12px';
    floatWin.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
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
        dockDivInPage(divId);
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

    // Add drag logic to handle only
    draggable(floatWin, handle);

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
}
