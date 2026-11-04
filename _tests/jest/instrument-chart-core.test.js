import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const approvedValues = await import('../../approved-values.js');
const { CHART_WIDGET_TEMPLATES } = await import('../../templates/InstrumentChart/instrument-chart-templates.js');
const core = await import('../../templates/InstrumentChart/instrument-chart-core.js');
const { isAllowedSanitizerTag } = await import('../../html-sanitizer.js');

function makeSection({ beats, caption, chartChord, chartMode, key, lead }) {
  return { beats, caption, chartChord, chartMode, getRootKey: () => key, getRootKeyLead: () => lead };
}

const sections = [
  makeSection({ beats: 4, caption: 'Intro', chartChord: 'Am', chartMode: 'Dorian', key: 'F', lead: 'A' }),
  makeSection({ beats: 8, caption: 'Verse', chartChord: 'G7', chartMode: 'Mixolydian', key: 'G', lead: 'G' })
];

beforeEach(() => {
  approvedValues.setApprovedValueProviders({
    getBPM: () => 100,
    getCurrentSection: () => sections[0],
    getSectionsCurrentIndex: () => 0,
    getSong: () => ({ sections }),
    getRootKey: () => 'F',
    getRootKeyLead: () => 'A',
    getChartDisplayForSection: (kind, section) => (kind === 'chord' ? section.chartChord : section.chartMode)
  });
});

describe('instrument chart templates', () => {
  test('are the approved Iteration 4 text', () => {
    expect(CHART_WIDGET_TEMPLATES.top).toBe('<b>${chartChordCaption}</b>&nbsp;${chartModeCaption}&nbsp;&nbsp;${rootKeys}&nbsp;&nbsp;&sect;${currentSectionCardinal}&nbsp;<small>${beats} beats</small>&nbsp;${getSectionCaption}');
    expect(CHART_WIDGET_TEMPLATES.left).toBe('<small>&sect;${currentSectionCardinal}</small><br><b>${chartChordCaption}</b><br>${rootKeys}');
    expect(Object.keys(CHART_WIDGET_TEMPLATES).sort()).toEqual(['left', 'top']);
  });

  test('vocabulary guard: allowed tags, no classes, only SAFE_WIDGET_TOKENS', () => {
    for (const template of Object.values(CHART_WIDGET_TEMPLATES)) {
      for (const match of template.matchAll(/<\/?\s*([A-Za-z][A-Za-z0-9]*)/g)) {
        expect(isAllowedSanitizerTag(match[1])).toBe(true);
      }
      expect(template).not.toMatch(/class\s*=/i);
      for (const token of core.extractTemplateTokens(template)) {
        expect(core.SAFE_WIDGET_TOKENS).toContain(token);
      }
    }
  });

  test('every SAFE_WIDGET_TOKEN is an approved value', () => {
    const names = approvedValues.listApprovedValues().map((v) => v.name);
    core.SAFE_WIDGET_TOKENS.forEach((token) => expect(names).toContain(token));
  });
});

describe('getChartWidgetTemplate / normalizeChartWidgetMode', () => {
  test('picks by placement and ignores the id', () => {
    expect(core.getChartWidgetTemplate('top')).toBe(CHART_WIDGET_TEMPLATES.top);
    expect(core.getChartWidgetTemplate('left', 'whatever')).toBe(CHART_WIDGET_TEMPLATES.left);
    expect(core.getChartWidgetTemplate('bottom')).toBe('');
  });

  test('merges booleans over the current mode and ignores everything else', () => {
    expect(core.normalizeChartWidgetMode({ top: true })).toEqual({ top: true, left: false });
    expect(core.normalizeChartWidgetMode({ left: true }, { top: true, left: false })).toEqual({ top: true, left: true });
    expect(core.normalizeChartWidgetMode({ top: 'yes', left: 1, extra: true }, { top: true, left: true })).toEqual({ top: true, left: true });
    expect(core.normalizeChartWidgetMode(null, { top: true, left: false })).toEqual({ top: true, left: false });
  });

  test('extractTemplateTokens lists names once, in order', () => {
    expect(core.extractTemplateTokens('${a} x ${ b } ${a}')).toEqual(['a', 'b']);
  });
});

describe('expandChartWidgetTemplate', () => {
  test('two Instruments on different Sections expand differently', () => {
    const first = core.expandChartWidgetTemplate({ template: CHART_WIDGET_TEMPLATES.left, section: sections[0], sectionIndex: 0, tableID: 'tblA' });
    const second = core.expandChartWidgetTemplate({ template: CHART_WIDGET_TEMPLATES.left, section: sections[1], sectionIndex: 1, tableID: 'tblB' });
    expect(first).toBe('<small>&sect;1</small><br><b>Am</b><br>F&#x2836;A');
    expect(second).toBe('<small>&sect;2</small><br><b>G7</b><br>G');
  });

  test('top template includes beats, caption, and the instrument caption token is blank when not supplied', () => {
    const html = core.expandChartWidgetTemplate({ template: CHART_WIDGET_TEMPLATES.top, section: sections[1], sectionIndex: 1, tableID: 'tblB' });
    expect(html).toContain('8 beats');
    expect(html).toContain('Verse');
    expect(html).toContain('Mixolydian');
    expect(core.expandChartWidgetTemplate({ template: '${instrumentCaption}', section: sections[1], sectionIndex: 1, instrumentCaption: 'P46_1' })).toBe('P46_1');
  });

  test('a missing Section expands to empty, and unknown names are removed', () => {
    expect(core.expandChartWidgetTemplate({ template: CHART_WIDGET_TEMPLATES.top, section: undefined })).toBe('');
    expect(core.expandChartWidgetTemplate({ template: 'a${nope}b', section: sections[0], sectionIndex: 0 })).toBe('ab');
  });
});

describe('chart widget metrics (sprint 154)', () => {
  const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates/InstrumentChart/instrument-chart.css');

  test('defaults are the accepted look: 4.8em, 0.15em, aligned with the rail', () => {
    expect(core.CHART_WIDGET_METRIC_DEFAULTS).toEqual({ leftWidthEm: 4.8, leftPaddingTopEm: 0.15, topPaddingLeftEm: 'align' });
    expect(core.normalizeChartWidgetMetrics()).toEqual(core.CHART_WIDGET_METRIC_DEFAULTS);
  });

  test('numbers are clamped and rounded, junk is ignored, and values merge over current', () => {
    const m = core.normalizeChartWidgetMetrics({ leftWidthEm: 99, leftPaddingTopEm: -1, topPaddingLeftEm: 1.234 });
    expect(m).toEqual({ leftWidthEm: 12, leftPaddingTopEm: 0, topPaddingLeftEm: 1.23 });
    expect(core.normalizeChartWidgetMetrics({ leftWidthEm: 'wide', topPaddingLeftEm: NaN }, m)).toEqual(m);
    expect(core.normalizeChartWidgetMetrics({ topPaddingLeftEm: 'align' }, m).topPaddingLeftEm).toBe('align');
    expect(core.normalizeChartWidgetMetrics({ leftWidthEm: 'align' }).leftWidthEm).toBe(4.8);
  });

  test("'align' follows the left width while the left widget is on, else the CSS default", () => {
    const on = core.resolveChartWidgetMetricVars({ leftWidthEm: 5 }, { leftOn: true });
    expect(on['--icw-left-width']).toBe('5em');
    expect(on['--icw-top-padding-left']).toBe('calc(5em + var(--icw-align-nudge, 0px))');
    const off = core.resolveChartWidgetMetricVars({ leftWidthEm: 5 }, { leftOn: false });
    expect(off['--icw-top-padding-left']).toBe('0.4em');
    expect(core.resolveChartWidgetMetricVars({ topPaddingLeftEm: 2 })['--icw-top-padding-left']).toBe('2em');
  });

  test('the CSS uses exactly these variables with the default values as fallbacks', () => {
    const css = fs.readFileSync(cssPath, 'utf8');
    Object.values(core.CHART_WIDGET_METRIC_VARS).forEach((name) => expect(css).toContain(`var(${name},`));
    expect(css).toContain('var(--icw-left-width, 4.8em)');
    expect(css).toContain('var(--icw-left-padding-top, 0.15em)');
    expect(css).toContain('var(--icw-top-padding-left, 0.4em)');
  });
});
