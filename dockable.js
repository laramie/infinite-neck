// dockable.js

export function makeDivDockable(divId) {
    if (!window._dockableFloatState) window._dockableFloatState = {};
    const floatState = window._dockableFloatState;

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
    floatWin.style.zIndex = 9999;
    floatWin.style.background = '#fff';
    floatWin.style.border = '2px solid #888';
    floatWin.style.borderRadius = '12px';
    floatWin.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
    floatWin.style.padding = '0';
    floatWin.className = 'toolWindowRounded floatingWindowResizable';
    floatWin.style.display = 'flex';
    floatWin.style.flexDirection = 'row';
    floatWin.style.alignItems = 'stretch';

    // Create vertical drag handle
    const handle = document.createElement('div');
    handle.style.width = '2em';
    handle.style.height = '100%';
    handle.style.background = '#eee';
    handle.style.cursor = 'grab';
    handle.style.display = 'flex';
    handle.style.flexDirection = 'column';
    handle.style.alignItems = 'center';
    handle.style.justifyContent = 'center';
    handle.style.userSelect = 'none';
    handle.style.borderTopLeftRadius = '12px';
    handle.style.borderBottomLeftRadius = '12px';

    // Dock button (emoji)
    const dockBtn = document.createElement('button');
    dockBtn.textContent = '📌';
    dockBtn.title = 'Dock';
    dockBtn.style.background = 'none';
    dockBtn.style.border = 'none';
    dockBtn.style.fontSize = '1.5em';
    dockBtn.style.cursor = 'pointer';
    dockBtn.onclick = function (e) {
        e.stopPropagation();
        dockDivInPage(divId);
    };
    handle.appendChild(dockBtn);

    // Add drag logic to handle only
    if (typeof window.draggable === 'function') window.draggable(floatWin, handle);

    // Compose window: [handle][content]
    floatWin.appendChild(handle);
    floatWin.appendChild(div);

    // Add to body
    document.body.appendChild(floatWin);
}

export function dockDivInPage(divId) {
    const floatState = window._dockableFloatState || {};
    const div = document.getElementById(divId);
    const state = floatState[divId];
    const floatWin = document.getElementById('floating-' + divId);
    if (!div || !state || !floatWin) return;

    // Restore to original parent and position
    if (state.next && state.next.parentNode === state.parent) {
        state.parent.insertBefore(div, state.next);
    } else {
        state.parent.appendChild(div);
    }

    // Remove floating window
    floatWin.remove();

    // Clean up state
    delete floatState[divId];
}

// Make functions globally accessible for inline HTML usage
window.makeDivDockable = makeDivDockable;
window.dockDivInPage = dockDivInPage;
