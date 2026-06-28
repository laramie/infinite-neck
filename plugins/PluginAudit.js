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

const SONG_LEVEL_AUDIT_COLUMNS = Object.freeze([
  { label: 'Instrument', propertyName: 'targetTable' },
  { label: 'minFret', propertyName: 'minFret' },
  { label: 'maxFret', propertyName: 'maxFret' },
  { label: 'minRow', propertyName: 'minRow' },
  { label: 'maxRow', propertyName: 'maxRow' },
  { label: 'chroma', propertyName: 'intervals' },
  { label: 'inputs', propertyName: 'auditInputs', kind: 'audit' },
  { label: 'outputs', propertyName: 'auditOutputs', kind: 'audit' }
]);

function getPluginsInAuditOrder(pluginManager) {
  const registeredPlugins = Array.isArray(pluginManager?.getRegisteredPlugins?.())
    ? pluginManager.getRegisteredPlugins()
    : [];
  const pluginsByTrigger = new Map(
    registeredPlugins.map((plugin) => [`${plugin.getMenuTrigger?.() || ''}`.trim().toLowerCase(), plugin])
  );
  const ordered = [];

  const triggerOrder = Array.isArray(pluginManager?.getSongPluginFiringOrder?.())
    ? pluginManager.getSongPluginFiringOrder()
    : [];
  triggerOrder.forEach((trigger) => {
    const plugin = pluginsByTrigger.get(`${trigger || ''}`.toLowerCase());
    if (plugin && !ordered.includes(plugin)) {
      ordered.push(plugin);
    }
  });

  registeredPlugins.forEach((plugin) => {
    if (!ordered.includes(plugin)) {
      ordered.push(plugin);
    }
  });

  return ordered;
}

function pluginHasProperty(plugin, propertyName) {
  const properties = Array.isArray(plugin?.getProperties?.()) ? plugin.getProperties() : [];
  return properties.some((property) => property?.name === propertyName);
}

function formatSongLevelCellValue(column, value) {
  if (column.propertyName === 'targetTable') {
    return formatInstrument(value);
  }
  return formatScalar(value);
}

function normalizeAuditCellContent(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((part) => `${part || ''}`.trim())
      .filter((part) => part.length > 0)
      .map((part) => escapeHtml(part));
    return parts.length > 0 ? parts.join('<br>') : '&nbsp;';
  }

  const text = `${value}`.trim();
  if (!text) {
    return '&nbsp;';
  }

  const encoded = text.split('<br>').map((part) => escapeHtml(part));
  return encoded.join('<br>');
}

function getPluginAuditCellValue(plugin, song, propertyName) {
  const methodName = propertyName === 'auditInputs' ? 'getAuditInputs' : 'getAuditOutputs';
  if (!plugin || typeof plugin[methodName] !== 'function') {
    return undefined;
  }
  return normalizeAuditCellContent(plugin[methodName]({ song }));
}

function buildSongLevelTable(song, pluginManager) {
  const pluginsInOrder = getPluginsInAuditOrder(pluginManager);

  const rows = pluginsInOrder.map((plugin) => {
    const pluginId = `${plugin?.getId?.() || ''}`;
    const pluginName = `${plugin?.getRegisteredName?.() || pluginId}`;
    const persistedProperties = getSongPluginProperties(song, pluginId);

    const cells = SONG_LEVEL_AUDIT_COLUMNS.map((column) => {
      if (column.kind === 'audit') {
        const auditValue = getPluginAuditCellValue(plugin, song, column.propertyName);
        if (auditValue === undefined) {
          return "<td style='background-color: #555;'>&nbsp;</td>";
        }
        return `<td>${auditValue}</td>`;
      }

      const applies = pluginHasProperty(plugin, column.propertyName);
      if (!applies) {
        return "<td style='background-color: #555;'>&nbsp;</td>";
      }

      const hasPersistedValue = Object.prototype.hasOwnProperty.call(persistedProperties, column.propertyName);
      const rawValue = hasPersistedValue ? persistedProperties[column.propertyName] : undefined;
      return `<td>${formatSongLevelCellValue(column, rawValue)}</td>`;
    }).join('');

    return `<tr><td>${escapeHtml(pluginName)}</td>${cells}</tr>`;
  });

  const headerCells = SONG_LEVEL_AUDIT_COLUMNS
    .map((column) => `<th class='vertical-header'><span>${escapeHtml(column.label)}</span></th>`)
    .join('');

  return [
    "<table border='1' class='tblDisplayOptions pluginAuditTable pluginAuditSongTable'>",
    '<caption>Plugin Audit: Song-Level Persisted Properties</caption>',
    `<tr><th scope='col'>plugin</th>${headerCells}</tr>`,
    rows.join('\n'),
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
    buildSongLevelTable(song, pluginManager),
    buildSectionLevelTable(song, pluginManager),
    '</div>'
  ].join('\n');
}
