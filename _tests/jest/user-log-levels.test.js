import { gMenuFile } from '../../menu.js';
import EventBus from '../../event-bus.js';
import {
  DEFAULT_USER_LOG_LEVEL,
  MAX_MIDI_NUMBERS_LISTED,
  formatMidiNumberList,
  formatMidiNumbersByString,
  normalizeUserLogLevel,
  shouldShowUserLogMessage
} from '../../plugins/userLogLevels.js';
import { emitUserLog } from '../../plugins/emitUserLog.js';

describe('normalizeUserLogLevel', () => {
  test('accepts v, i, w by first letter, case-insensitively', () => {
    expect(normalizeUserLogLevel('v')).toBe('v');
    expect(normalizeUserLogLevel('Verbose')).toBe('v');
    expect(normalizeUserLogLevel('INFO')).toBe('i');
    expect(normalizeUserLogLevel('warnings only')).toBe('w');
  });

  test('anything else falls back', () => {
    expect(normalizeUserLogLevel('x')).toBe(DEFAULT_USER_LOG_LEVEL);
    expect(normalizeUserLogLevel('')).toBe(DEFAULT_USER_LOG_LEVEL);
    expect(normalizeUserLogLevel(undefined)).toBe(DEFAULT_USER_LOG_LEVEL);
    expect(normalizeUserLogLevel(null, 'w')).toBe('w');
  });

  test('the default level is info', () => {
    expect(DEFAULT_USER_LOG_LEVEL).toBe('i');
  });
});

describe('shouldShowUserLogMessage', () => {
  test('verbose shows everything', () => {
    expect(shouldShowUserLogMessage('v', 'v')).toBe(true);
    expect(shouldShowUserLogMessage('i', 'v')).toBe(true);
    expect(shouldShowUserLogMessage('w', 'v')).toBe(true);
  });

  test('info hides only verbose messages', () => {
    expect(shouldShowUserLogMessage('v', 'i')).toBe(false);
    expect(shouldShowUserLogMessage('i', 'i')).toBe(true);
    expect(shouldShowUserLogMessage('w', 'i')).toBe(true);
  });

  test('warnings only hides verbose and info messages', () => {
    expect(shouldShowUserLogMessage('v', 'w')).toBe(false);
    expect(shouldShowUserLogMessage('i', 'w')).toBe(false);
    expect(shouldShowUserLogMessage('w', 'w')).toBe(true);
  });

  test('an untagged message is a warning, so it shows at every setting', () => {
    ['v', 'i', 'w'].forEach((setting) => {
      expect(shouldShowUserLogMessage(undefined, setting)).toBe(true);
      expect(shouldShowUserLogMessage('', setting)).toBe(true);
    });
  });

  test('an unknown setting behaves as the default (info)', () => {
    expect(shouldShowUserLogMessage('v', 'nonsense')).toBe(false);
    expect(shouldShowUserLogMessage('w', 'nonsense')).toBe(true);
  });
});

describe('formatMidiNumberList', () => {
  test('lists distinct numbers ascending', () => {
    expect(formatMidiNumberList([54, 34, 36, 34, 41, 50])).toBe('[34,36,41,50,54]');
  });

  test('ignores values that are not MIDI integers; strings of digits count', () => {
    expect(formatMidiNumberList(['55', 'x', null, undefined, -3])).toBe('[55]');
  });

  test('an empty or non-array input gives []', () => {
    expect(formatMidiNumberList([])).toBe('[]');
    expect(formatMidiNumberList(undefined)).toBe('[]');
    expect(formatMidiNumberList('nope')).toBe('[]');
  });

  test('exactly 40 numbers have no ...more', () => {
    const values = Array.from({ length: MAX_MIDI_NUMBERS_LISTED }, (_, index) => index + 20);
    const text = formatMidiNumberList(values);
    expect(text.includes('...more')).toBe(false);
    expect(text.slice(1, -1).split(',')).toHaveLength(40);
  });

  test('more than 40 numbers show the lowest 40, then ...more', () => {
    const values = Array.from({ length: 45 }, (_, index) => index + 20);
    const text = formatMidiNumberList(values);
    expect(text.endsWith(',...more]')).toBe(true);
    const shown = text.slice(1, -1).split(',');
    expect(shown).toHaveLength(41);
    expect(shown[0]).toBe('20');
    expect(shown[39]).toBe('59');
    expect(shown[40]).toBe('...more');
  });
});

describe('formatMidiNumbersByString', () => {
  test('groups by 1-based string, ascending, distinct', () => {
    const entries = [
      { string: 8, midi: 41 }, { string: 7, midi: 36 }, { string: 7, midi: 34 }, { string: 7, midi: 34 }
    ];
    expect(formatMidiNumbersByString(entries)).toBe('{s7:[34,36],s8:[41]}');
  });

  test('a note with no usable string goes last under s?; junk is ignored', () => {
    const entries = [{ string: null, midi: 50 }, { string: 2, midi: 45 }, { string: 3, midi: 'x' }, { string: 0, midi: 40 }];
    expect(formatMidiNumbersByString(entries)).toBe('{s2:[45],s?:[40,50]}');
  });

  test('empty or non-array input gives {}', () => {
    expect(formatMidiNumbersByString([])).toBe('{}');
    expect(formatMidiNumbersByString(undefined)).toBe('{}');
  });

  test('exactly 40 numbers have no ...more; over 40 stops at 40, lowest strings first', () => {
    const forty = Array.from({ length: 40 }, (_, index) => ({ string: 1 + (index % 2), midi: 20 + index }));
    expect(formatMidiNumbersByString(forty)).not.toContain('...more');

    const forty5 = Array.from({ length: 45 }, (_, index) => ({ string: 1 + (index % 3), midi: 20 + index }));
    const text = formatMidiNumbersByString(forty5);
    expect(text.endsWith(',...more}')).toBe(true);
    const listed = text.replace(/s\d+:/g, '').match(/\d+/g);
    expect(listed).toHaveLength(40);
  });

  test('the 40 cap can cut inside a string group', () => {
    const entries = Array.from({ length: 45 }, (_, index) => ({ string: 1, midi: 20 + index }));
    const text = formatMidiNumbersByString(entries);
    expect(text.startsWith('{s1:[20,21,')).toBe(true);
    expect(text.endsWith('],...more}')).toBe(true);
    expect(text.replace(/s\d+:/g, '').match(/\d+/g)).toHaveLength(40);
  });
});

describe('emitUserLog', () => {
  let events;
  let handler;

  beforeEach(() => {
    events = [];
    handler = (event, data) => events.push(data);
    EventBus.on('UserLog', handler);
  });

  afterEach(() => {
    EventBus.off('UserLog', handler);
  });

  test('defaults to a warning', () => {
    emitUserLog('Sys', 'hello');
    expect(events).toEqual([{ subSystem: 'Sys', message: 'hello', level: 'w' }]);
  });

  test('carries a valid level and repairs an invalid one to a warning', () => {
    emitUserLog('Sys', 'quiet', 'v');
    emitUserLog('Sys', 'odd', 'zzz');
    expect(events.map((event) => event.level)).toEqual(['v', 'w']);
  });

  test('an empty message sends nothing', () => {
    emitUserLog('Sys', '');
    emitUserLog('Sys', undefined);
    expect(events).toHaveLength(0);
  });
});

describe('/fau u)ser log level menu', () => {
  function child(menu, trigger) {
    const found = (menu.children || []).find((node) => node.trigger === trigger);
    if (!found) throw new Error(`no child "${trigger}" under "${menu.caption}"`);
    return found;
  }

  const walk = (path) => path.split('').reduce((menu, trigger) => child(menu, trigger), gMenuFile);

  test('/fa has unique triggers and u)ser log level shows the current value', () => {
    const advanced = walk('fa');
    const triggers = advanced.children.map((node) => node.trigger);
    expect(new Set(triggers).size).toBe(triggers.length);
    const level = walk('fau');
    expect(level.caption).toBe('<b>u</b>ser log level [${userLogLevel}]');
    expect(level.vars).toEqual(['userLogLevel']);
  });

  test('v)erbose, i)nfo and w)arnings only set the level and keep the menu open', () => {
    expect(walk('fauv')).toMatchObject({ action: 'setUserLogLevel', value: 'v', preserveMenuStack: true });
    expect(walk('fauv').caption).toContain('erbose');
    expect(walk('faui')).toMatchObject({ action: 'setUserLogLevel', value: 'i', preserveMenuStack: true });
    expect(walk('faui').caption).toContain('nfo');
    expect(walk('fauw')).toMatchObject({ action: 'setUserLogLevel', value: 'w', preserveMenuStack: true });
    expect(walk('fauw').caption).toContain('arnings only');
    expect(walk('fau').children).toHaveLength(3);
  });
});
