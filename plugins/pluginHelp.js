export function buildPluginEventsHelpFooter(plugin) {
  const eventNames = typeof plugin?.getEventNames === 'function' ? plugin.getEventNames() : [];
  if (!Array.isArray(eventNames) || eventNames.length === 0) {
    return 'Events handled:\n- none';
  }
  return `Events handled:\n- ${eventNames.join('\n- ')}`;
}

export default buildPluginEventsHelpFooter;