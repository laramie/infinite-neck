import {
  PalettePresentation,
  gPresentation
} from '../../presentation.js';

function installJqueryStub(elements) {
  const byId = new Map(elements.map((element) => [element.id, element]));

  function matchesSelector(element, selector) {
    if (!element || !selector) {
      return false;
    }

    const trimmed = selector.trim();
    if (trimmed.startsWith('#')) {
      return element.id === trimmed.slice(1);
    }

    const inputMatch = trimmed.match(/^input\[name="([^"]+)"\](?::checked)?(?:\[value="([^"]+)"\])?$/);
    if (!inputMatch) {
      return false;
    }

    const [, name, value] = inputMatch;
    const requiresChecked = trimmed.includes(':checked');
    if (element.tag !== 'input' || element.name !== name) {
      return false;
    }
    if (value && element.value !== value) {
      return false;
    }
    if (requiresChecked && !element.checked) {
      return false;
    }
    return true;
  }

  function query(selector) {
    if (!selector) {
      return [];
    }
    return selector
      .split(',')
      .flatMap((part) => Array.from(byId.values()).filter((element) => matchesSelector(element, part)));
  }

  function wrap(items) {
    const api = {
      jqueryStub: true,
      _items: items,
      length: items.length,
      first() {
        return wrap(items.slice(0, 1));
      },
      filter(selector) {
        if (selector === ':checked') {
          return wrap(items.filter((item) => item.checked));
        }
        return wrap(items.filter((item) => matchesSelector(item, selector)));
      },
      attr(name) {
        return items[0]?.[name];
      },
      val() {
        return items[0]?.value;
      },
      prop(name, value) {
        if (value === undefined) {
          return items[0]?.[name];
        }
        items.forEach((item) => {
          item[name] = value;
        });
        return api;
      },
      trigger(name) {
        items.forEach((item) => {
          item.triggered = item.triggered || [];
          item.triggered.push(name);
        });
        return api;
      },
      closest(selector) {
        if (selector === 'label') {
          return wrap(items.map((item) => item.label).filter(Boolean));
        }
        if (selector.startsWith('#')) {
          const targetId = selector.slice(1);
          const matches = [];
          items.forEach((item) => {
            let parent = item.parent;
            while (parent) {
              if (parent.id === targetId) {
                matches.push(parent);
                break;
              }
              parent = parent.parent;
            }
          });
          return wrap(matches);
        }
        return wrap([]);
      },
      text(value) {
        if (value === undefined) {
          return items[0]?.text || '';
        }
        items.forEach((item) => {
          item.text = value;
        });
        return api;
      },
      toggleClass(className, enabled) {
        items.forEach((item) => {
          item.classes = item.classes || new Set();
          if (enabled) {
            item.classes.add(className);
          } else {
            item.classes.delete(className);
          }
        });
        return api;
      },
      html(value) {
        return api.text(value);
      },
      toggle(enabled) {
        const shouldShow = enabled === undefined ? !items[0]?.visible : !!enabled;
        items.forEach((item) => {
          item.visible = shouldShow;
        });
        return api;
      },
      addClass(className) {
        items.forEach((item) => {
          item.classes = item.classes || new Set();
          item.classes.add(className);
        });
        return api;
      },
      removeClass(className) {
        items.forEach((item) => {
          item.classes = item.classes || new Set();
          item.classes.delete(className);
        });
        return api;
      }
    };
    items.forEach((item, index) => {
      api[index] = item;
    });
    return api;
  }

  globalThis.$ = (selector) => {
    if (typeof selector === 'string') {
      return wrap(query(selector));
    }
    if (selector?.jqueryStub) {
      return selector;
    }
    if (!selector) {
      return wrap([]);
    }
    return wrap([selector]);
  };
  globalThis.$.trim = (value) => `${value || ''}`.trim();
  globalThis.jQuery = globalThis.$;

  return { byId };
}

function createInput({ id, name, value, checked = false, labelText = '', labelTitle = '', parent = null }) {
  const label = { id: `${id}Label`, tag: 'label', text: labelText, title: labelTitle, classes: new Set(), parent };
  const input = {
    id,
    tag: 'input',
    name,
    value,
    checked,
    label,
    parent: label,
    classes: new Set(),
    triggered: []
  };
  label.child = input;
  return input;
}

describe('PalettePresentation CLEAR and restore note type state', () => {
  beforeEach(() => {
    gPresentation.palette.mode = 'paint';
    gPresentation.palette.lastRestorableColor = null;
    gPresentation.palette.lastRestorableHighlight = null;
    gPresentation.palette.suppressRbColorRemember = false;
    gPresentation.palette.keepWasForced = false;
  });

  test('CLEAR enters clear mode, remembers and unchecks the six note-type radios, then restore enters paint mode and restores note type', () => {
    const elements = [
      createInput({ id: 'idPaletteModePaint', name: 'rbPaletteMode', value: 'paint', checked: true, labelText: 'Color: Emboss' }),
      createInput({ id: 'idPaletteModeClear', name: 'rbPaletteMode', value: 'clear', labelText: 'CLEAR' }),
      createInput({ id: 'idPaletteModeKeep', name: 'rbPaletteMode', value: 'keep', labelText: 'KEEP' }),
      createInput({ id: 'idPaletteModeDropper', name: 'rbPaletteMode', value: 'dropper', labelText: 'Find Color' }),
      createInput({ id: 'idNamedNotes', name: 'rbHighlight', value: 'Named', labelText: 'Named' }),
      createInput({ id: 'idSingleNotes', name: 'rbHighlight', value: 'Single', checked: true, labelText: 'Single' }),
      createInput({ id: 'idTinyNotes', name: 'rbHighlight', value: 'Tiny', labelText: 'Tiny' }),
      createInput({ id: 'rbBend', name: 'rbHighlight', value: 'Bend', labelText: 'Bend' }),
      createInput({ id: 'idMidiPitches', name: 'rbHighlight', value: 'MidiPitches', labelText: 'Pitch' }),
      createInput({ id: 'idMidiPitchesSingle', name: 'rbHighlight', value: 'MidiPitchesSingle', labelText: 'Multi' }),
      createInput({ id: 'rbFinger1', name: 'rbHighlight', value: 'Fingering', labelText: '1' }),
      createInput({ id: 'idRTransparent', name: 'rbColor', value: 'noteTransparent', labelText: 'Emboss' }),
      createInput({ id: 'idRChord', name: 'rbColor', value: 'noteChord', checked: true, labelText: 'Chord' }),
      { id: 'choosePaletteModePaint', tag: 'label', text: '', classes: new Set() },
      { id: 'spanPaletteModePaintCaption', tag: 'span', text: '', classes: new Set() }
    ];
    const { byId } = installJqueryStub(elements);

    PalettePresentation.initializePalettePresentation();
    PalettePresentation.enterClearMode();

    expect(byId.get('idSingleNotes').checked).toBe(false);
    expect(byId.get('idNamedNotes').checked).toBe(false);
    expect(byId.get('idTinyNotes').checked).toBe(false);
    expect(byId.get('rbBend').checked).toBe(false);
    expect(byId.get('idMidiPitches').checked).toBe(false);
    expect(byId.get('idMidiPitchesSingle').checked).toBe(false);
    expect(PalettePresentation.getMode()).toBe('clear');
    expect(PalettePresentation.getLastRestorableRbHighlight().id).toBe('idSingleNotes');

    PalettePresentation.restoreLastRbColor();

    expect(PalettePresentation.getMode()).toBe('paint');
    expect(byId.get('idRChord').checked).toBe(true);
    expect(byId.get('idRChord').triggered).toContain('change');
    expect(byId.get('idSingleNotes').checked).toBe(true);
    expect(byId.get('idPaletteModePaint').checked).toBe(true);
  });

  test('entering paint mode leaves an existing note-type selection alone', () => {
    const elements = [
      createInput({ id: 'idPaletteModePaint', name: 'rbPaletteMode', value: 'paint', checked: false, labelText: 'Color: Emboss' }),
      createInput({ id: 'idPaletteModeClear', name: 'rbPaletteMode', value: 'clear', checked: true, labelText: 'CLEAR' }),
      createInput({ id: 'idPaletteModeKeep', name: 'rbPaletteMode', value: 'keep', labelText: 'KEEP' }),
      createInput({ id: 'idPaletteModeDropper', name: 'rbPaletteMode', value: 'dropper', labelText: 'Find Color' }),
      createInput({ id: 'idNamedNotes', name: 'rbHighlight', value: 'Named', checked: true, labelText: 'Named' }),
      createInput({ id: 'idSingleNotes', name: 'rbHighlight', value: 'Single', labelText: 'Single' }),
      createInput({ id: 'idTinyNotes', name: 'rbHighlight', value: 'Tiny', labelText: 'Tiny' }),
      createInput({ id: 'rbBend', name: 'rbHighlight', value: 'Bend', labelText: 'Bend' }),
      createInput({ id: 'idMidiPitches', name: 'rbHighlight', value: 'MidiPitches', labelText: 'Pitch' }),
      createInput({ id: 'idMidiPitchesSingle', name: 'rbHighlight', value: 'MidiPitchesSingle', labelText: 'Multi' }),
      createInput({ id: 'rbFinger1', name: 'rbHighlight', value: 'Fingering', labelText: '1' }),
      createInput({ id: 'idRTransparent', name: 'rbColor', value: 'noteTransparent', checked: true, labelText: 'Emboss' }),
      { id: 'choosePaletteModePaint', tag: 'label', text: '', classes: new Set() },
      { id: 'spanPaletteModePaintCaption', tag: 'span', text: '', classes: new Set() }
    ];
    const { byId } = installJqueryStub(elements);

    gPresentation.palette.lastRestorableHighlight = {
      id: 'idTinyNotes',
      value: 'Tiny',
      caption: 'Tiny'
    };

    PalettePresentation.enterPaintMode({
      restoreHighlightIfNeeded: true
    });

    expect(PalettePresentation.getMode()).toBe('paint');
    expect(byId.get('idNamedNotes').checked).toBe(true);
    expect(byId.get('idTinyNotes').checked).toBe(false);
  });

  test('entering dropper mode restores the last note type after CLEAR cleared it', () => {
    const elements = [
      createInput({ id: 'idPaletteModePaint', name: 'rbPaletteMode', value: 'paint', checked: false, labelText: 'Color: Emboss' }),
      createInput({ id: 'idPaletteModeClear', name: 'rbPaletteMode', value: 'clear', checked: true, labelText: 'CLEAR' }),
      createInput({ id: 'idPaletteModeKeep', name: 'rbPaletteMode', value: 'keep', labelText: 'KEEP' }),
      createInput({ id: 'idPaletteModeDropper', name: 'rbPaletteMode', value: 'dropper', labelText: 'Find Color' }),
      createInput({ id: 'idNamedNotes', name: 'rbHighlight', value: 'Named', labelText: 'Named' }),
      createInput({ id: 'idSingleNotes', name: 'rbHighlight', value: 'Single', labelText: 'Single' }),
      createInput({ id: 'idTinyNotes', name: 'rbHighlight', value: 'Tiny', labelText: 'Tiny' }),
      createInput({ id: 'rbBend', name: 'rbHighlight', value: 'Bend', labelText: 'Bend' }),
      createInput({ id: 'idMidiPitches', name: 'rbHighlight', value: 'MidiPitches', labelText: 'Pitch' }),
      createInput({ id: 'idMidiPitchesSingle', name: 'rbHighlight', value: 'MidiPitchesSingle', labelText: 'Multi' }),
      createInput({ id: 'idRTransparent', name: 'rbColor', value: 'noteTransparent', checked: true, labelText: 'Emboss' }),
      { id: 'choosePaletteModePaint', tag: 'label', text: '', classes: new Set() },
      { id: 'spanPaletteModePaintCaption', tag: 'span', text: '', classes: new Set() }
    ];
    const { byId } = installJqueryStub(elements);

    gPresentation.palette.lastRestorableHighlight = {
      id: 'idSingleNotes',
      value: 'Single',
      caption: 'Single'
    };

    PalettePresentation.enterDropperMode();

    expect(PalettePresentation.getMode()).toBe('dropper');
    expect(byId.get('idSingleNotes').checked).toBe(true);
  });

  test('paint caption uses label title for unlabeled extra colors', () => {
    const extraColors = { id: 'extraColors', tag: 'div', visible: false, classes: new Set() };
    const elements = [
      createInput({ id: 'idPaletteModePaint', name: 'rbPaletteMode', value: 'paint', checked: true, labelText: 'Color: Emboss' }),
      createInput({ id: 'idRTransparent', name: 'rbColor', value: 'noteTransparent', labelText: 'Emboss' }),
      createInput({ id: 'idGreen7', name: 'rbColor', value: 'noteGreen7', checked: true, labelTitle: 'noteGreen7', parent: extraColors }),
      { id: 'choosePaletteModePaint', tag: 'label', text: '', classes: new Set() },
      { id: 'spanPaletteModePaintCaption', tag: 'span', text: '', classes: new Set() }
    ];
    const { byId } = installJqueryStub(elements);

    PalettePresentation.rememberRestorableRbColor(byId.get('idGreen7'));

    expect(PalettePresentation.getLastRestorableRbColor().caption).toBe('noteGreen7');
    expect(byId.get('spanPaletteModePaintCaption').text).toContain('noteGreen7');
  });

  test('ensureColorRadioVisible opens manual and extra colors for hidden extra-color radios', () => {
    const manualColors = { id: 'manualColors', tag: 'div', visible: false, classes: new Set() };
    const extraColors = { id: 'extraColors', tag: 'div', visible: false, classes: new Set(), parent: manualColors };
    const elements = [
      { id: 'cbAutomaticColor', tag: 'input', name: 'cbnAutomaticColor', checked: true, classes: new Set() },
      { id: 'btnAutoColor', tag: 'button', classes: new Set(['BtnPunchedIn']) },
      { id: 'btnAutoColor2', tag: 'button', classes: new Set(['BtnPunchedIn']) },
      { id: 'showHideExtraColors', tag: 'button', text: 'More...', classes: new Set(['BtnPunchedOut']) },
      manualColors,
      extraColors,
      createInput({ id: 'idGreen7', name: 'rbColor', value: 'noteGreen7', labelTitle: 'noteGreen7', parent: extraColors })
    ];
    const { byId } = installJqueryStub(elements);

    PalettePresentation.ensureColorRadioVisible($(byId.get('idGreen7')));

    expect(byId.get('cbAutomaticColor').checked).toBe(false);
    expect(byId.get('manualColors').visible).toBe(true);
    expect(byId.get('extraColors').visible).toBe(true);
    expect(byId.get('showHideExtraColors').text).toBe('Less...');
    expect(byId.get('btnAutoColor').classes.has('BtnPunchedOut')).toBe(true);
    expect(byId.get('btnAutoColor2').classes.has('BtnPunchedOut')).toBe(true);
  });
});