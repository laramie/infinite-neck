import { jest } from '@jest/globals';

const approvedValues = await import('../../approved-values.js');
const { getChartDisplayValue } = await import('../../section-printer.js');

function makeSection({ beats, caption, chartChord, chartMode, key, lead }) {
  return { beats, caption, chartChord, chartMode, getRootKey: () => key, getRootKeyLead: () => lead };
}

const current = makeSection({ beats: 4, caption: 'Current', chartChord: 'Am', chartMode: 'Dorian', key: 'F', lead: 'A' });
const other = makeSection({ beats: 6, caption: 'Other <i>x</i>', chartChord: '<b>x</b>', chartMode: 'Lydian', key: 'D', lead: 'D' });

const tonalCalls = [];

beforeEach(() => {
  tonalCalls.length = 0;
  approvedValues.setApprovedValueProviders({
    getBPM: () => 120,
    getCurrentSection: () => current,
    getSectionsCurrentIndex: () => 0,
    getSong: () => ({ sections: [current, other], songName: 'Song <b>', graveyard: { getRecordCount: () => 0 } }),
    getRootKey: () => 'F',
    getRootKeyLead: () => 'A',
    getTransposeCaptionValue: () => 'LIVE-TRANSPOSE',
    getArpeggioCaptionValue: () => 'LIVE-ARP',
    getFillCaptionValue: () => 'LIVE-FILL',
    getChartDisplayForSection: (kind, section) => `[${kind}:${section.caption}]`,
    getTonalCaptionValue: (tokenName, section) => {
      tonalCalls.push([tokenName, section]);
      return `tonal(${tokenName}:${section ? section.caption : 'current'})`;
    }
  });
});

const context = (extra = {}) => ({ section: other, sectionIndex: 1, tableID: 'tblX', instrumentCaption: 'Lead <1>', ...extra });

describe('scoped approved-value expansion', () => {
  test('without a context nothing changes', () => {
    expect(approvedValues.expandApprovedTemplate('${beats} ${rootKeys} ${currentSectionCardinal} ${getSectionCaption}'))
      .toBe('4 F\u2836A 1 Current'.replace('\u2836', '&#x2836;'));
    expect(approvedValues.expandApprovedTemplate('${chartChordCaption}|${chartModeCaption}'))
      .toBe('<span class="lblSectionChartChord"></span>|<span class="lblSectionMode"></span>');
    expect(approvedValues.expandApprovedTemplate('${instrumentCaption}')).toBe('');
    expect(approvedValues.expandApprovedTemplate('${transposeCurrentOffset}')).toBe('LIVE-TRANSPOSE');
  });

  test('section-scoped tokens follow context.section, not the current Section', () => {
    const text = approvedValues.expandApprovedTemplate('${beats}|${beatCount}|${currentSectionIndex}|${currentSectionNumber}|${currentSectionCardinal}|${rootKey}|${rootKeyLead}', { context: context() });
    expect(text).toBe('6|6|1|1|2|D|D');
  });

  test('rootKeys shows the Lead Key only when it differs', () => {
    expect(approvedValues.expandApprovedTemplate('${rootKeys}', { context: context() })).toBe('D');
    expect(approvedValues.expandApprovedTemplate('${rootKeys}', { context: context({ section: current, sectionIndex: 0 }) })).toBe('F&#x2836;A');
  });

  test('chart tokens use the context section and are escaped', () => {
    expect(approvedValues.expandApprovedTemplate('${chartChord}|${chartMode}', { context: context() })).toBe('&lt;b&gt;x&lt;/b&gt;|Lydian');
    expect(approvedValues.expandApprovedTemplate('${chartChordCaption}|${chartModeCaption}', { context: context() })).toBe('[chord:Other <i>x</i>]|[mode:Other <i>x</i>]');
  });

  test('instrumentCaption is escaped', () => {
    expect(approvedValues.expandApprovedTemplate('${instrumentCaption}', { context: context() })).toBe('Lead &lt;1&gt;');
  });

  test('getSectionCaption is escaped and expanded once, without recursion', () => {
    const withTokens = makeSection({ beats: 2, caption: '<i>hi</i> ${beats} ${getSectionCaption} ${chartChordCaption}', chartChord: 'C', chartMode: 'Ionian', key: 'C', lead: 'C' });
    const text = approvedValues.expandApprovedTemplate('${getSectionCaption}', { context: context({ section: withTokens }) });
    expect(text).toBe('&lt;i&gt;hi&lt;/i&gt; 2  [chord:<i>hi</i> ${beats} ${getSectionCaption} ${chartChordCaption}]');
  });

  test('song-scoped tokens are unchanged by a context', () => {
    expect(approvedValues.expandApprovedTemplate('${sectionCount}|${getBPM}', { context: context() })).toBe('2|120');
  });

  test('live tokens are blank inside a context', () => {
    expect(approvedValues.expandApprovedTemplate('a${currentBeat}b${transposeCurrentOffset}c${arpeggioPositionsStatus}d${fillPositionsStatus}e', { context: context() })).toBe('abcde');
  });

  test('unknown names follow preserveUnknown', () => {
    expect(approvedValues.expandApprovedTemplate('${nope}', { context: context() })).toBe('${nope}');
    expect(approvedValues.expandApprovedTemplate('${nope}', { context: context(), preserveUnknown: false })).toBe('');
  });

  test('Tonal tokens receive context.section; without a context the section is not forced', () => {
    expect(approvedValues.expandApprovedTemplate('${transposedChordNotes}', { context: context() })).toBe('tonal(transposedChordNotes:Other <i>x</i>)');
    expect(tonalCalls[0][1]).toBe(other);
    tonalCalls.length = 0;
    expect(approvedValues.expandApprovedTemplate('${transposedChordNotes}')).toBe('tonal(transposedChordNotes:current)');
    expect(tonalCalls[0][1]).toBeUndefined();
  });

  test('listApprovedValues reports a scope for every entry', () => {
    const values = approvedValues.listApprovedValues();
    const scopes = Object.values(approvedValues.APPROVED_VALUE_SCOPES);
    expect(values.length).toBeGreaterThan(0);
    values.forEach((v) => expect(scopes).toContain(v.scope ?? 'live'));
    const byName = Object.fromEntries(values.map((v) => [v.name, v.scope]));
    expect(byName.beats).toBe('section');
    expect(byName.getBPM).toBe('song');
    expect(byName.currentBeat === undefined || byName.currentBeat === 'live').toBe(true);
    expect(byName.rootKeys).toBe('section');
  });
});

describe('getChartDisplayValue escapeHtml option', () => {
  test('default behavior is unchanged', () => {
    expect(getChartDisplayValue('<b>x</b>', 'chord', {})).toBe('<b>x</b>');
    expect(getChartDisplayValue('Am7', 'chord', { stripTonalRoots: true })).toBe('m7');
  });

  test('escapeHtml escapes the text', () => {
    expect(getChartDisplayValue('<b>x</b>', 'chord', {}, { escapeHtml: true })).toBe('&lt;b&gt;x&lt;/b&gt;');
    expect(getChartDisplayValue('<b>x</b>', 'chord', { stripTonalRoots: true }, { escapeHtml: true })).not.toContain('<b>');
  });
});
