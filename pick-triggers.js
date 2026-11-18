// Trigger keys for generated command-line pick-lists (sprint 156).  Pure module: no DOM, no Song access.
//
// Keys are 1-9, then a-z.  'x' is never a pick key: the command line treats it as the automatic eXit key
// before it looks at any child trigger.  Callers reserve any other key a sibling item needs, for example
// 'i' where the same list ends with an i)d item, or 'n' where it ends with an n)one item.
//
// A pick's key depends only on its position and the reserved set, never on layout prefs, so macros that
// type a pick key keep working however the grid is laid out.

export const PICK_KEY_SEQUENCE = Object.freeze([
  ...'123456789',
  ...'abcdefghijklmnopqrstuvwyz'
]);

/**
 * Returns the pick keys for a list of `count` items, in order.  The result is shorter than `count`
 * when the list is longer than the available keys.  `count` may be Infinity for "all the keys".
 */
export function getPickTriggers(count, { reserved = [] } = {}) {
  const skip = new Set(reserved.map((key) => `${key}`));
  const keys = PICK_KEY_SEQUENCE.filter((key) => !skip.has(key));
  const wanted = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : keys.length;
  return keys.slice(0, wanted);
}

/** Largest number of items one pick-list can select by key, given the reserved keys. */
export function getPickCapacity({ reserved = [] } = {}) {
  return getPickTriggers(Infinity, { reserved }).length;
}

/** Caption for a pick item: the key in bold, then the label (which the caller has already escaped). */
export function buildPickCaption(trigger, labelHtml) {
  return `<b>${trigger}</b>) ${labelHtml}`;
}

// Keys an Instrument pick-list cannot use: 'i' belongs to the i)d item that follows the picks.
export const INSTRUMENT_PICK_RESERVED = Object.freeze(['i']);

/**
 * Options for a plugin's Instrument (targetTable) select.  Every tuning becomes an option, so i)d and
 * persisted values can name any Instrument.  Only the first getPickCapacity() options get a pick key;
 * the rest have trigger '' and are reached by i)d.
 */
export function buildInstrumentPickOptions(tunings, getTableID) {
  const triggers = getPickTriggers(tunings.length, { reserved: INSTRUMENT_PICK_RESERVED });
  return tunings.map((tuning, index) => {
    const trigger = triggers[index] || '';
    return {
      value: getTableID(tuning),
      caption: trigger ? `${trigger}) ${tuning.baseID}` : `${tuning.baseID}`,
      trigger
    };
  });
}
