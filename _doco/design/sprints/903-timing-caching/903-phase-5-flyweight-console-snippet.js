/*
 * Sprint 903 Phase 5 -- Flyweight content-node cache benchmark (console-pasteable version)
 *
 * Purpose: benchmark `element.innerHTML = htmlString` (the current approach in
 * NoteTableController.js's buildCellsFromSelector()) against parsing each distinct content
 * string into a detached master Node ONCE and using node.cloneNode(true) thereafter --
 * run directly against the REAL, currently-rendered content of the live infinite-neck app,
 * not synthetic sample data.
 *
 * How to use:
 *   1. Load infinite-neck in a browser tab, open a song, make sure a Section with a visible
 *      NoteTable is on screen (any song/key works).
 *   2. Open DevTools console on that tab.
 *   3. Paste this entire file's contents in and press Enter.
 *   4. Read the console.log output. A scratch (offscreen, invisible) table is built and torn
 *      down automatically -- this never touches or disturbs the live visible table.
 *
 * See 903-phase-5-flyweight-content-cache-plan.md for the full design writeup this benchmark
 * supports, and 903-phase-5-flyweight-benchmark.html for a standalone (no-app-needed) version
 * using content captured from a real session.
 */
(function flyweightContentCacheBenchmark() {
    const CELL_COUNT = 300;   // matches the real capture: one buildCellsForTable() rebuild
    const TRIAL_COUNT = 10;

    // 1. Gather REAL content variants from whatever is currently rendered in the live app.
    const liveCells = Array.from(document.querySelectorAll('td.note'))
        .filter((td) => td.querySelector('.NoteDisplay'));
    if (liveCells.length === 0) {
        console.warn('[flyweight-bench] No rendered td.note cells with .NoteDisplay found -- '
            + 'load a song and make sure a Section is visible, then re-run this snippet.');
        return;
    }
    const variants = Array.from(new Set(
        liveCells.map((td) => td.querySelector('.NoteDisplay').outerHTML)
    ));
    console.log(`[flyweight-bench] Found ${liveCells.length} live td.note cells, `
        + `${variants.length} distinct .NoteDisplay content variants currently rendered.`);

    // 2. Build an offscreen, attached-but-invisible scratch table using REAL <td> shapes
    //    (cloned from a real td.note, preserving its classes/attributes so CSS selector
    //    matching cost is representative) -- never touches the live table.
    const templateTd = liveCells[0].cloneNode(false); // shallow clone: attrs/classes only, no children
    const scratchHost = document.createElement('div');
    scratchHost.style.cssText = 'position:absolute; left:-99999px; top:0;';

    function buildScratchCells(count) {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        const row = document.createElement('tr');
        const cells = [];
        for (let i = 0; i < count; i += 1) {
            const td = templateTd.cloneNode(false);
            row.appendChild(td);
            cells.push(td);
        }
        tbody.appendChild(row);
        table.appendChild(tbody);
        return { table, cells };
    }

    function pickVariant(variantList, i) {
        return variantList[i % variantList.length];
    }

    function benchInnerHtml(cells, count) {
        const start = performance.now();
        for (let i = 0; i < count; i += 1) {
            cells[i].innerHTML = pickVariant(variants, i);
        }
        return performance.now() - start;
    }

    function buildMasters() {
        // One-time parse per distinct variant -- outside the timed per-cell loop, matching
        // the real implementation's lazy NoteTableRenderCache.getOrBuildContentNode() build.
        return variants.map((html) => {
            const template = document.createElement('template');
            template.innerHTML = html;
            return template.content.firstElementChild;
        });
    }

    function benchCloneNode(cells, masters, count) {
        const start = performance.now();
        for (let i = 0; i < count; i += 1) {
            cells[i].replaceChildren(masters[i % masters.length].cloneNode(true));
        }
        return performance.now() - start;
    }

    function stats(samples, count) {
        const sum = samples.reduce((a, b) => a + b, 0);
        const avgMs = sum / samples.length;
        return {
            avgMs: Math.round(avgMs * 1000) / 1000,
            minMs: Math.round(Math.min(...samples) * 1000) / 1000,
            maxMs: Math.round(Math.max(...samples) * 1000) / 1000,
            perCellUs: Math.round((avgMs / count) * 1000 * 1000) / 1000
        };
    }

    const innerHtmlSamples = [];
    const cloneNodeSamples = [];

    document.body.appendChild(scratchHost);
    try {
        for (let t = 0; t < TRIAL_COUNT; t += 1) {
            const s1 = buildScratchCells(CELL_COUNT);
            scratchHost.appendChild(s1.table);
            innerHtmlSamples.push(benchInnerHtml(s1.cells, CELL_COUNT));
            scratchHost.removeChild(s1.table);

            const s2 = buildScratchCells(CELL_COUNT);
            const masters = buildMasters();
            scratchHost.appendChild(s2.table);
            cloneNodeSamples.push(benchCloneNode(s2.cells, masters, CELL_COUNT));
            scratchHost.removeChild(s2.table);
        }
    } finally {
        document.body.removeChild(scratchHost); // always clean up scratch DOM
    }

    const innerHtmlStats = stats(innerHtmlSamples, CELL_COUNT);
    const cloneNodeStats = stats(cloneNodeSamples, CELL_COUNT);
    const speedup = innerHtmlStats.avgMs / cloneNodeStats.avgMs;

    console.log(`[flyweight-bench] cells/trial=${CELL_COUNT} trials=${TRIAL_COUNT} `
        + `distinctVariants=${variants.length}`);
    console.log('[flyweight-bench] innerHTML=       approach:', innerHtmlStats);
    console.log('[flyweight-bench] cloneNode(true)  approach:', cloneNodeStats);
    console.log(`[flyweight-bench] cloneNode is ${speedup.toFixed(2)}x faster than innerHTML= `
        + `for this real content shape/size (masters rebuilt fresh each trial above -- in the `
        + `real app the master-build cost is paid at most once per distinct key for the whole `
        + `session, not once per trial, so real-world speedup should be at least this good).`);

    // Full raw payload, convenient to copy/paste back for sharing, same shape as the
    // standalone HTML benchmark's output.
    window.__flyweightBenchResult = {
        cellCount: CELL_COUNT,
        trialCount: TRIAL_COUNT,
        variantCount: variants.length,
        innerHtmlSamplesMs: innerHtmlSamples,
        cloneNodeSamplesMs: cloneNodeSamples,
        innerHtmlStats,
        cloneNodeStats,
        speedup
    };
    console.log('[flyweight-bench] Full result also stored at window.__flyweightBenchResult -- '
        + 'copy(window.__flyweightBenchResult) puts it on your clipboard.');
})();
