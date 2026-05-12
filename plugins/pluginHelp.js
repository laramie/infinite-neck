const ENABLED_CHECKMARK = '&#x1F5F9;';
const PERSISTED_SONG_MARK = '&#x1F5BA;';

function escapeHtml(text) {
  return `${text}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function wrapPluginHelpSummaryValues(summary = '') {
  return `${summary}`.replace(/=([^\s]+)/g, (_match, value) => `=<em class='pluginHelpValue'>${escapeHtml(value)}</em>`);
}

export function buildPluginHelpHeader(plugin, title, summary = '') {
  const pluginId = typeof plugin?.getId === 'function' ? plugin.getId() : '';
  const statusSuffix = pluginId && plugin?.manager?.resolveValue
    ? plugin.manager.resolveValue(`plugin:${pluginId}:statusSuffix`) || ''
    : '';
  const summarySuffix = summary ? ` ${wrapPluginHelpSummaryValues(summary)}` : '';
  return `<b><u>${title}</u>${statusSuffix}${summarySuffix}</b>`;
}

export function buildPluginStatusLegend() {
  return `Status marks:\n- ${ENABLED_CHECKMARK} enabled\n- ${PERSISTED_SONG_MARK} persisted in Song.plugins`;
}

export function buildPluginEventsHelpFooter(plugin) {
  const eventNames = typeof plugin?.getEventNames === 'function' ? plugin.getEventNames() : [];
  const legend = buildPluginStatusLegend();
  if (!Array.isArray(eventNames) || eventNames.length === 0) {
    return `${legend}\n\nEvents handled:\n- none`;
  }
  return `${legend}\n\nEvents handled:\n- ${eventNames.join('\n- ')}`;
}

export default buildPluginEventsHelpFooter;