import {
  PICK_KEY_SEQUENCE,
  buildInstrumentPickOptions,
  buildPickCaption,
  getPickCapacity,
  getPickTriggers
} from '../../pick-triggers.js';
import {
  DEFAULT_PICK_LINES,
  getPickColumns,
  getPickLines,
  resetPickPrefs,
  setPickColumns,
  setPickLines
} from '../../menu-pick-prefs.js';
import { buildChildMenuCaptionsRow, gMenuFile, setMenuValueResolver } from '../../menu.js';
import { getMacroDeleteNumberOptions, getMacroMoveNumberOptions, getMacroNumberOptions } from '../../MacroMenu.js';
import { findMenuItemByMacroPath } from '../../MacroExecutor.js';
import { PluginProperty } from '../../plugins/PluginProperty.js';
import { setSong } from '../../globals.js';

function makeMacroSong(count) {
  const macros = {};
  for (let index = 1; index <= count; index += 1) {
    macros[`M${index}`] = { lines: [] };
  }
  return { macros };
}

function makeTunings(count) {
  return Array.from({ length: count }, (_, index) => ({ baseID: `T${index + 1}` }));
}

describe('pick trigger allocator', () => {
  test('sequence is 1-9 then a-z without x', () => {
    expect(PICK_KEY_SEQUENCE.slice(0, 9)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(PICK_KEY_SEQUENCE).toContain('a');
    expect(PICK_KEY_SEQUENCE).toContain('z');
    expect(PICK_KEY_SEQUENCE).not.toContain('x');
    expect(PICK_KEY_SEQUENCE).not.toContain('0');
    expect(new Set(PICK_KEY_SEQUENCE).size).toBe(PICK_KEY_SEQUENCE.length);
    expect(PICK_KEY_SEQUENCE.length).toBe(34);
  });

  test('keys 1-9 and their order never change, whatever is reserved', () => {
    const plain = getPickTriggers(Infinity);
    const withI = getPickTriggers(Infinity, { reserved: ['i'] });
    expect(withI.slice(0, 9)).toEqual(plain.slice(0, 9));
    expect(withI.slice(0, 8)).toEqual(plain.slice(0, 8));
  });

  test('reserved keys are removed and capacity drops by one', () => {
    expect(getPickCapacity()).toBe(34);
    expect(getPickCapacity({ reserved: ['i'] })).toBe(33);
    expect(getPickTriggers(Infinity, { reserved: ['i'] })).not.toContain('i');
    expect(getPickTriggers(Infinity, { reserved: ['n'] })).not.toContain('n');
  });

  test('count limits the result and is clamped to the capacity', () => {
    expect(getPickTriggers(3)).toEqual(['1', '2', '3']);
    expect(getPickTriggers(0)).toEqual([]);
    expect(getPickTriggers(500).length).toBe(34);
  });

  test('buildPickCaption bolds the trigger', () => {
    expect(buildPickCaption('b', 'foo')).toBe('<b>b</b>) foo');
  });

  test('instrument options keep every tuning but only key the first ones, never i or x', () => {
    const options = buildInstrumentPickOptions(makeTunings(40), (tuning) => `tbl${tuning.baseID}`);
    expect(options.length).toBe(40);
    const keyed = options.filter((option) => option.trigger);
    expect(keyed.length).toBe(33);
    expect(keyed.map((option) => option.trigger)).not.toContain('i');
    expect(keyed.map((option) => option.trigger)).not.toContain('x');
    expect(options[0]).toEqual({ value: 'tblT1', caption: '1) T1', trigger: '1' });
    expect(options[39]).toEqual({ value: 'tblT40', caption: 'T40', trigger: '' });
  });

  test('instrument select menu node lists picks, a "more" note, and i)d last', () => {
    const property = new PluginProperty({
      name: 'targetTable',
      caption: 'Instrument',
      trigger: 'I',
      datatype: 'org.dynamide.Select',
      options: buildInstrumentPickOptions(makeTunings(40), (tuning) => `tbl${tuning.baseID}`)
    });
    const node = property.getMenuNodeSpec({ getId: () => 'fill' });
    const picks = node.children.filter((child) => child.pick);
    expect(picks.length).toBe(33);
    expect(node.children.length).toBe(35);
    expect(node.children[33].caption).toBe('... 7 more: use i)d');
    expect(node.children[33].trigger).toBe('');
    expect(node.children[34].trigger).toBe('i');
    expect(node.children[34].pick).toBe(false);
    const triggers = node.children.map((child) => child.trigger).filter(Boolean);
    expect(new Set(triggers).size).toBe(triggers.length);
  });
});

describe('macro pick lists', () => {
  beforeEach(() => setSong(makeMacroSong(12)));
  afterEach(() => setSong(null));

  test('past nine macros the picks continue with letters', () => {
    const options = getMacroNumberOptions('macroRunById');
    expect(options.length).toBe(12);
    expect(options.map((option) => option.trigger)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c']
    );
    expect(options[10]).toMatchObject({ value: 'M11', trigger: 'b', pick: true, action: 'macroRunById' });
    expect(options[9].caption).toBe('<b>a</b>) M10');
  });

  test('delete and move lists use the same keys and are flagged as picks', () => {
    expect(getMacroDeleteNumberOptions().every((option) => option.pick === true)).toBe(true);
    expect(getMacroMoveNumberOptions().map((option) => option.trigger).slice(9)).toEqual(['a', 'b', 'c']);
  });

  test('a macro path reaches the 11th macro with its letter pick', () => {
    const rootMenu = {
      children: [{
        trigger: 'f',
        children: [{
          trigger: 'm',
          children: [{
            trigger: 'r',
            children: [{ trigger: 'n', runtimeChildren: 'macroRunNumber', children: [] }]
          }]
        }]
      }]
    };
    const refreshRuntimeChildren = (menu) => {
      if (menu.runtimeChildren === 'macroRunNumber') {
        menu.children = getMacroNumberOptions('macroRunById');
      }
    };
    const found = findMenuItemByMacroPath(rootMenu, '/fmrnb', { refreshRuntimeChildren });
    expect(found.value).toBe('M11');
    const first = findMenuItemByMacroPath(rootMenu, '/fmrn1', { refreshRuntimeChildren });
    expect(first.value).toBe('M1');
  });
});

describe('pick list rendering and prefs', () => {
  beforeEach(() => {
    resetPickPrefs();
    gMenuFile.tall = true;
    setMenuValueResolver(() => undefined);
  });
  afterAll(() => {
    resetPickPrefs();
    gMenuFile.tall = true;
  });

  function makeMenu(pickCount) {
    const triggers = getPickTriggers(pickCount, { reserved: ['i'] });
    return {
      caption: 'pick',
      children: [
        ...triggers.map((trigger) => ({ caption: buildPickCaption(trigger, `item${trigger}`), trigger, pick: true, action: 'go' })),
        { caption: '<b>i</b>d', trigger: 'i', action: 'byId' }
      ]
    };
  }

  test('prefs default to 9 lines, columns on; lines validate', () => {
    expect(getPickLines()).toBe(DEFAULT_PICK_LINES);
    expect(getPickColumns()).toBe(true);
    expect(setPickLines('12')).toBe(12);
    expect(setPickLines('0')).toBe(0);
    expect(setPickLines('abc')).toBeNull();
    expect(setPickLines('-3')).toBeNull();
    expect(setPickLines('100')).toBeNull();
    expect(getPickLines()).toBe(0);
    expect(setPickColumns(false)).toBe(false);
  });

  test('a menu with no pick children renders as before (no grid)', () => {
    const html = buildChildMenuCaptionsRow({ children: [{ caption: '<b>a</b>aa', trigger: 'a' }] });
    expect(html).not.toContain('CmdPickGrid');
    expect(html).toContain('e<b>x</b>it');
  });

  test('pick children are in a grid with --pick-lines, other children follow it, then exit', () => {
    const html = buildChildMenuCaptionsRow(makeMenu(12));
    expect(html).toContain("class='CmdPickGrid'");
    expect(html).toContain('--pick-lines:9');
    expect(html.match(/CmdPickItem/g).length).toBe(12);
    expect(html.indexOf('<b>i</b>d')).toBeGreaterThan(html.lastIndexOf('CmdPickItem'));
    expect(html.indexOf('e<b>x</b>it')).toBeGreaterThan(html.indexOf('<b>i</b>d'));
    expect(html.indexOf('<b>c</b>) itemc')).toBeLessThan(html.indexOf('<b>i</b>d'));
  });

  test('/vml changes the row count; 0 or /vmc off gives one column; triggers never change', () => {
    const menu = makeMenu(12);
    const triggersBefore = menu.children.map((child) => child.trigger);

    setPickLines(5);
    expect(buildChildMenuCaptionsRow(menu)).toContain('--pick-lines:5');

    setPickLines(0);
    expect(buildChildMenuCaptionsRow(menu)).toContain('CmdPickGridOneColumn');

    setPickLines(9);
    setPickColumns(false);
    expect(buildChildMenuCaptionsRow(menu)).toContain('CmdPickGridOneColumn');

    expect(menu.children.map((child) => child.trigger)).toEqual(triggersBefore);
  });

  test('short mode puts the grid in one cell and the other children in their own cells', () => {
    gMenuFile.tall = false;
    const html = buildChildMenuCaptionsRow(makeMenu(12));
    expect(html.startsWith('<td><div class=')).toBe(true);
    expect(html).toContain('<td><b>i</b>d</td>');
    expect(html).toContain("<td width='100%'>e<b>x</b>it</td>");
  });
});
