/**
 * User Log levels, lowest severity first:
 *   v  verbose        everything, including Dropped Notes summaries
 *   i  info           hides verbose messages
 *   w  warnings only  hides verbose and info messages
 * A message with no level is a warning, so existing callers never disappear.
 *
 * Pure helpers only (no EventBus, no DOM) so UserLog.js and Jest can both use them.
 */
export const USER_LOG_LEVEL_ORDER = Object.freeze(['v', 'i', 'w']);
export const USER_LOG_LEVEL_VERBOSE = 'v';
export const USER_LOG_LEVEL_INFO = 'i';
export const USER_LOG_LEVEL_WARNING = 'w';
export const DEFAULT_USER_LOG_LEVEL = USER_LOG_LEVEL_INFO;
export const USER_LOG_LEVEL_CAPTIONS = Object.freeze({ v: 'verbose', i: 'info', w: 'warnings' });
export const MAX_MIDI_NUMBERS_LISTED = 40;

export function normalizeUserLogLevel(value, fallback = DEFAULT_USER_LOG_LEVEL) {
  const letter = `${value ?? ''}`.trim().toLowerCase().charAt(0);
  return USER_LOG_LEVEL_ORDER.includes(letter) ? letter : fallback;
}

/** `setting` is the level the User chose; `messageLevel` is the level the message was tagged with. */
export function shouldShowUserLogMessage(messageLevel, setting = DEFAULT_USER_LOG_LEVEL) {
  const message = USER_LOG_LEVEL_ORDER.indexOf(normalizeUserLogLevel(messageLevel, USER_LOG_LEVEL_WARNING));
  const chosen = USER_LOG_LEVEL_ORDER.indexOf(normalizeUserLogLevel(setting));
  return message >= chosen;
}

/**
 * `[34,36,41,...more]`: distinct integers, ascending, at most MAX_MIDI_NUMBERS_LISTED
 * of them, with `...more` when the list was cut short.
 */
export function formatMidiNumberList(values = [], limit = MAX_MIDI_NUMBERS_LISTED) {
  const distinct = [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value >= 0)
  )].sort((left, right) => left - right);
  const shown = distinct.slice(0, limit).map((value) => `${value}`);
  if (distinct.length > limit) {
    shown.push('...more');
  }
  return `[${shown.join(',')}]`;
}

/**
 * Groups MIDI numbers by 1-based string (the numbering a MIDI Paste map uses):
 * `{s7:[34,36],s8:[41],...more}`.  `entries` are `{ string, midi }`; a note with no usable
 * string goes in `s?`.  Within a string the numbers are distinct and ascending, and at most
 * `limit` numbers are listed in all, lowest strings first, with `...more` when cut short.
 */
export function formatMidiNumbersByString(entries = [], limit = MAX_MIDI_NUMBERS_LISTED) {
  const byString = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const midi = Number.parseInt(entry?.midi, 10);
    if (!Number.isInteger(midi) || midi < 0) {
      return;
    }
    const string = Number.isInteger(entry?.string) && entry.string >= 1 ? entry.string : null;
    if (!byString.has(string)) {
      byString.set(string, new Set());
    }
    byString.get(string).add(midi);
  });

  const strings = [...byString.keys()].sort((left, right) => ((left === null) - (right === null)) || (left - right));
  const groups = [];
  let remaining = limit;
  let more = false;
  strings.forEach((string) => {
    const numbers = [...byString.get(string)].sort((left, right) => left - right);
    if (remaining <= 0) {
      more = true;
      return;
    }
    const shown = numbers.slice(0, remaining);
    more = more || shown.length < numbers.length;
    remaining -= shown.length;
    groups.push(`s${string ?? '?'}:[${shown.join(',')}]`);
  });
  if (more) {
    groups.push('...more');
  }
  return `{${groups.join(',')}}`;
}
