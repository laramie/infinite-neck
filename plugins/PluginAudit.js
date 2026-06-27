function escapeHtml(value) {
  return `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatScalar(value) {
  if (value === undefined || value === null || value === '') {
    return '&nbsp;';
  }
  if (typeof value === 'object') {
    return escapeHtml(JSON.stringify(value));
  }
  return escapeHtml(`${value}`);
}

function formatInstrument(value) {
  const raw = `${value || ''}`.trim();
  if (!raw) {
    return '&nbsp;';
  }
  return escapeHtml(raw.startsWith('tbl') ? raw.slice('tbl'.length) : raw);
}

function getSongPluginProperties(song, pluginId) {
  return song?.plugins?.[pluginId]?.properties || {};
}

function getCurrentSectionIndex(song, sections = []) {
  const currentSection = typeof song?.getCurrentSection === 'function' ? song.getCurrentSection() : null;
  return sections.findIndex((section) => section === currentSection);
}

function buildSongLevelTable(song) {
  const arpeggio = getSongPluginProperties(song, 'arpeggio');
  const fill = getSongPluginProperties(song, 'fill');
  const transpose = getSongPluginProperties(song, 'transpose');

  const values = [
    formatInstrument(arpeggio.targetTable),
    formatScalar(arpeggio.minFret),
    formatScalar(arpeggio.maxFret),
    formatScalar(arpeggio.minRow),
    formatScalar(arpeggio.maxRow),
    formatInstrument(fill.targetTable),
    formatScalar(fill.minFret),
    formatScalar(fill.maxFret),
    formatScalar(fill.minRow),
    formatScalar(fill.maxRow),
    formatScalar(transpose.intervals)
  ];

  return [
    "<table border='1' class='tblDisplayOptions pluginAuditTable pluginAuditSongTable'>",
    '<caption>Plugin Audit: Song-Level Persisted Properties</caption>',
    '<tr><th>&nbsp;</th><th colspan="5">arpeggio</th><th colspan="5">fill</th><th colspan="1">transpose</th></tr>',
    '<tr><th scope="col">scope</th>'
      + '<th class="vertical-header"><span>Instrument</span></th>'
      + '<th class="vertical-header"><span>minFret</span></th>'
      + '<th class="vertical-header"><span>maxFret</span></th>'
      + '<th class="vertical-header"><span>minRow</span></th>'
      + '<th class="vertical-header"><span>maxRow</span></th>'
      + '<th class="vertical-header"><span>Instrument</span></th>'
      + '<th class="vertical-header"><span>minFret</span></th>'
      + '<th class="vertical-header"><span>maxFret</span></th>'
      + '<th class="vertical-header"><span>minRow</span></th>'
      + '<th class="vertical-header"><span>maxRow</span></th>'
      + '<th class="vertical-header"><span>chroma</span></th>'
      + '</tr>',
    `<tr><td>song.plugins</td><td>${values.join('</td><td>')}</td></tr>`,
    '</table>'
  ].join('\n');
}

function buildSectionWidget(pluginManager, pluginId, tokenName, song, section) {
  const plugin = pluginManager?.getPluginById?.(pluginId);
  if (!plugin) {
    return '';
  }

  if (typeof plugin.getApprovedCaptionState === 'function' && typeof plugin.buildPositionsStatusWidget === 'function') {
    const state = plugin.getApprovedCaptionState({ song, section }) || {};
    return plugin.buildPositionsStatusWidget({ ...state, enabled: true }) || '';
  }

  if (typeof plugin.getApprovedCaptionValue !== 'function') {
    return '';
  }

  return plugin.getApprovedCaptionValue(tokenName, { song, section }) || '';
}

function collectSectionUnknownKeys(section, knownKeyMap) {
  const pluginData = section?.pluginData;
  if (!pluginData || typeof pluginData !== 'object') {
    return [];
  }

  const extras = [];
  Object.entries(pluginData).forEach(([pluginId, pluginState]) => {
    if (!pluginState || typeof pluginState !== 'object') {
      extras.push(`${pluginId}`);
      return;
    }
    const knownKeys = knownKeyMap[pluginId] || null;
    Object.keys(pluginState).forEach((key) => {
      if (knownKeys && knownKeys.has(key)) {
        return;
      }
      extras.push(`${pluginId}.${key}`);
    });
  });

  return extras;
}

function buildSectionLevelTable(song, pluginManager) {
  const sections = Array.isArray(song?.getSections?.())
    ? song.getSections()
    : (Array.isArray(song?.sections) ? song.sections : []);
  const currentSectionIndex = getCurrentSectionIndex(song, sections);
  const knownKeyMap = {
    arpeggio: new Set(['positions', 'lastPositionIndex']),
    fill: new Set(['positions', 'lastPositionIndex'])
  };

  const discoveredExtras = new Set();
  const rows = sections.map((section, index) => {
    const arpeggioWidget = buildSectionWidget(pluginManager, 'arpeggio', 'arpeggioPositionsStatus', song, section) || '&nbsp;';
    const fillWidget = buildSectionWidget(pluginManager, 'fill', 'fillPositionsStatus', song, section) || '&nbsp;';
    const extras = collectSectionUnknownKeys(section, knownKeyMap);
    extras.forEach((key) => discoveredExtras.add(key));
    const extrasDisplay = extras.length > 0 ? escapeHtml(extras.join(', ')) : '&nbsp;';
    const rowClass = index === currentSectionIndex ? " class='sectionPrinterCurrentSectionRow pluginAuditCurrentSectionRow'" : '';
    return `<tr${rowClass}><td>${index + 1}</td><td>${arpeggioWidget}</td><td>${fillWidget}</td><td>${extrasDisplay}</td></tr>`;
  });

  const footer = discoveredExtras.size > 0
    ? `<div class='pluginAuditFooter'><b>Discovered section plugin keys:</b> ${escapeHtml(Array.from(discoveredExtras).sort().join(', '))}</div>`
    : `<div class='pluginAuditFooter'><b>Discovered section plugin keys:</b> none</div>`;

  return [
    "<table border='1' class='tblDisplayOptions pluginAuditTable pluginAuditSectionTable'>",
    '<caption>Plugin Audit: Section-Level pluginData</caption>',
    '<tr><th scope="col">Section #</th><th class="vertical-header"><span>arpeggioPositionsStatus</span></th><th class="vertical-header"><span>fillPositionsStatus</span></th><th class="vertical-header"><span>extra pluginData keys</span></th></tr>',
    rows.join('\n'),
    '</table>',
    footer
  ].join('\n');
}

export function buildPluginAuditHtml({ song = null, pluginManager = null } = {}) {
  if (!song) {
    return "<div class='warningMessage'>Plugin audit unavailable: no current song.</div>";
  }

  return [
    '<div class="pluginAuditReport">',
    '<h3>Plugin Audit</h3>',
    '<div>Current section row is highlighted when visible in this report.</div>',
    buildSongLevelTable(song),
    buildSectionLevelTable(song, pluginManager),
    '</div>'
  ].join('\n');
}
