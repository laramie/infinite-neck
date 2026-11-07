import * as sets from '../../templates/InstrumentChart/chart-widget-template-sets.js';
import { CHART_WIDGET_TEMPLATES } from '../../templates/InstrumentChart/instrument-chart-templates.js';

const SYSTEM_TOP = CHART_WIDGET_TEMPLATES.top[0];
const mine = { id: 'u-mine', caption: 'Mine', template: '<b>${chartChordCaption}</b>' };

describe('checkChartWidgetTemplate', () => {
  test('accepts allowed tags, whitelisted classes, entities and safe tokens', () => {
    expect(sets.checkChartWidgetTemplate('<b>${chartChordCaption}</b><br>${rootKeys}')).toBe('');
    expect(sets.checkChartWidgetTemplate('<span class="spacer2"> </span><span class="fontSmaller fontLarger140">&sect;${beats}</span>')).toBe('');
    expect(sets.checkChartWidgetTemplate("<span class='spacer2'>x</span>")).toBe('');
    expect(sets.checkChartWidgetTemplate('a<br/>b')).toBe('');
  });

  test('rejects empty, too long, and control characters', () => {
    expect(sets.checkChartWidgetTemplate('')).not.toBe('');
    expect(sets.checkChartWidgetTemplate('   ')).not.toBe('');
    expect(sets.checkChartWidgetTemplate('x'.repeat(sets.MAX_TEMPLATE_LENGTH + 1))).toMatch(/limit/);
    expect(sets.checkChartWidgetTemplate('a\u0001b')).toMatch(/Control/);
    expect(sets.checkChartWidgetTemplate(undefined)).not.toBe('');
  });

  test('rejects tags that are not allowed, links, and stray angle brackets', () => {
    expect(sets.checkChartWidgetTemplate('<script>x</script>')).toMatch(/script/);
    expect(sets.checkChartWidgetTemplate('<img src=x>')).toMatch(/img/);
    expect(sets.checkChartWidgetTemplate('<a href="x">y</a>')).toMatch(/<a>/);
    expect(sets.checkChartWidgetTemplate('a < b')).toMatch(/Stray/);
    expect(sets.checkChartWidgetTemplate('a > b')).toMatch(/Stray/);
    expect(sets.checkChartWidgetTemplate('<b')).toMatch(/Stray/);
  });

  test('rejects every attribute but class, and classes that are not whitelisted', () => {
    expect(sets.checkChartWidgetTemplate('<b onclick="x()">y</b>')).toMatch(/class/);
    expect(sets.checkChartWidgetTemplate('<b style="color:red">y</b>')).toMatch(/class/);
    expect(sets.checkChartWidgetTemplate('<span class="evil">y</span>')).toMatch(/evil/);
    expect(sets.checkChartWidgetTemplate('<span class="spacer2 evil">y</span>')).toMatch(/evil/);
    expect(sets.checkChartWidgetTemplate('<span class="spacer2" id="x">y</span>')).toMatch(/class/);
    expect(sets.checkChartWidgetTemplate('</b onclick="x()">')).toMatch(/Closing/);
  });

  test('rejects ${names} that are not safe in a widget, and says which', () => {
    expect(sets.checkChartWidgetTemplate('${getSongName}')).toMatch(/getSongName/);
    expect(sets.checkChartWidgetTemplate('${nope}')).toMatch(/nope/);
  });
});

describe('lists', () => {
  test('the system templates come first, then the User ones in the order added', () => {
    const other = { id: 'u-other', caption: 'Other', template: '<b>x</b>' };
    const user = { top: [mine, other], left: [] };
    expect(sets.getAllTemplates('top', user).map((e) => e.id))
      .toEqual([...CHART_WIDGET_TEMPLATES.top.map((e) => e.id), 'u-mine', 'u-other']);
    expect(sets.getAllTemplates('left', user)).toHaveLength(CHART_WIDGET_TEMPLATES.left.length);
    expect(sets.getAllTemplates('top', undefined)).toHaveLength(CHART_WIDGET_TEMPLATES.top.length);
    expect(sets.isSystemTemplateID('top', SYSTEM_TOP.id)).toBe(true);
    expect(sets.isSystemTemplateID('top', 'u-mine')).toBe(false);
  });

  test('add, update and delete return new lists and keep the id when renamed', () => {
    const list = [];
    const added = sets.addUserTemplate(list, mine);
    expect(list).toEqual([]);
    expect(added).toEqual([mine]);
    const renamed = sets.updateUserTemplate(added, 'u-mine', { caption: 'Renamed', template: '<i>y</i>' });
    expect(renamed).toEqual([{ id: 'u-mine', caption: 'Renamed', template: '<i>y</i>' }]);
    expect(added[0].caption).toBe('Mine');
    expect(sets.deleteUserTemplate(renamed, 'u-mine')).toEqual([]);
    expect(sets.deleteUserTemplate(renamed, 'u-none')).toEqual(renamed);
  });
});

describe('normalizeUserTemplates / persistUserTemplates', () => {
  test('always returns both placements', () => {
    expect(sets.normalizeUserTemplates(undefined)).toEqual({ top: [], left: [] });
    expect(sets.normalizeUserTemplates('x')).toEqual({ top: [], left: [] });
    expect(sets.normalizeUserTemplates({ top: 5 })).toEqual({ top: [], left: [] });
  });

  test('drops bad ids, system-id clashes, duplicate ids and captions, unsafe templates, and non-objects', () => {
    const result = sets.normalizeUserTemplates({
      left: [
        mine,
        mine,                                                                    // duplicate id
        { id: 'u-dup', caption: 'mine', template: '<b>x</b>' },                  // caption clashes (case-insensitive)
        { id: 'plain', caption: 'No prefix', template: '<b>x</b>' },
        { id: 'u-Upper', caption: 'Upper', template: '<b>x</b>' },
        { id: 'u-ok', caption: 'Bad <caption>', template: '<b>x</b>' },
        { id: 'u-ok2', caption: 'Unsafe', template: '<img src=x>' },
        { id: CHART_WIDGET_TEMPLATES.left[0].id, caption: 'System id', template: '<b>x</b>' },
        { id: 'u-sys-caption', caption: CHART_WIDGET_TEMPLATES.left[0].caption, template: '<b>x</b>' },   // clashes with a system caption
        null,
        'text',
        { id: 'u-fine', caption: '  Fine   one ', template: '<b>${beats}</b>' }
      ]
    });
    expect(result.left).toEqual([mine, { id: 'u-fine', caption: 'Fine one', template: '<b>${beats}</b>' }]);
    expect(result.top).toEqual([]);
  });

  test('caps each list', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `u-t${i}`, caption: `T${i}`, template: '<b>x</b>' }));
    expect(sets.normalizeUserTemplates({ top: many }).top).toHaveLength(sets.MAX_USER_TEMPLATES);
  });

  test('persistUserTemplates leaves out empty placements, and everything when empty', () => {
    expect(sets.persistUserTemplates({ top: [], left: [] })).toBeUndefined();
    expect(sets.persistUserTemplates(undefined)).toBeUndefined();
    expect(sets.persistUserTemplates({ top: [mine], left: [] })).toEqual({ top: [mine] });
    expect(sets.isEmptyUserTemplates({ top: [], left: [] })).toBe(true);
    expect(sets.isEmptyUserTemplates({ top: [], left: [mine] })).toBe(false);
  });
});

describe('proposeCaption', () => {
  test('a copy is "U: <caption>" and the prefix is never nested', () => {
    expect(sets.proposeCaption('Chord,k')).toBe('U: Chord,k');
    expect(sets.proposeCaption('U: Chord')).toBe('U: Chord');
  });
});

describe('computeEditorState', () => {
  const base = { placement: 'top', userLists: { top: [mine], left: [] } };

  test('a system template is copied: create mode, the id comes from the caption, nothing to delete', () => {
    const state = sets.computeEditorState({ ...base, selectedId: SYSTEM_TOP.id, draftTemplate: SYSTEM_TOP.template, draftCaption: 'U: Chord,Mode' });
    expect(state).toMatchObject({ mode: 'create', isSystem: true, canDelete: false, canSave: true, id: 'u-chord-mode' });
    expect(state.idLabel).toBe('u-chord-mode');
  });

  test('creating needs a caption that is not taken and a valid template', () => {
    const draft = { ...base, selectedId: SYSTEM_TOP.id, draftTemplate: '<b>${beats}</b>' };
    expect(sets.computeEditorState({ ...draft, draftCaption: '' })).toMatchObject({ canSave: false, captionMessage: expect.stringMatching(/required/i) });
    expect(sets.computeEditorState({ ...draft, draftCaption: 'mine' })).toMatchObject({ canSave: false, captionMessage: expect.stringMatching(/already exists/) });
    expect(sets.computeEditorState({ ...draft, draftCaption: SYSTEM_TOP.caption })).toMatchObject({ canSave: false });
    expect(sets.computeEditorState({ ...draft, draftTemplate: '<script>', draftCaption: 'New' })).toMatchObject({ canSave: false, templateMessage: expect.stringMatching(/script/) });
  });

  test('a User template is edited in place: the id stays, the caption may be renamed, Save needs a change', () => {
    const same = sets.computeEditorState({ ...base, selectedId: 'u-mine', draftTemplate: mine.template, draftCaption: 'Mine' });
    expect(same).toMatchObject({ mode: 'update', canDelete: true, canSave: false, idLabel: 'u-mine' });
    const renamed = sets.computeEditorState({ ...base, selectedId: 'u-mine', draftTemplate: mine.template, draftCaption: 'Completely different' });
    expect(renamed).toMatchObject({ canSave: true, idLabel: 'u-mine' });
    const edited = sets.computeEditorState({ ...base, selectedId: 'u-mine', draftTemplate: '<i>x</i>', draftCaption: 'Mine' });
    expect(edited.canSave).toBe(true);
  });

  test('renaming to another template\'s caption is refused', () => {
    const state = sets.computeEditorState({ ...base, selectedId: 'u-mine', draftTemplate: mine.template, draftCaption: SYSTEM_TOP.caption });
    expect(state.canSave).toBe(false);
  });

  test('a full list refuses another copy', () => {
    const many = Array.from({ length: sets.MAX_USER_TEMPLATES }, (_, i) => ({ id: `u-t${i}`, caption: `T${i}`, template: '<b>x</b>' }));
    const state = sets.computeEditorState({ placement: 'top', userLists: { top: many, left: [] }, selectedId: SYSTEM_TOP.id, draftTemplate: '<b>x</b>', draftCaption: 'One more' });
    expect(state.canSave).toBe(false);
    expect(state.limitMessage).toMatch(/delete one/);
  });

  test('an unknown selected id reads as the first system template', () => {
    const state = sets.computeEditorState({ ...base, selectedId: 'u-gone', draftTemplate: '<b>x</b>', draftCaption: 'U: Fresh' });
    expect(state.mode).toBe('create');
  });
});
