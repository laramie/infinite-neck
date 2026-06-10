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
        if (selector !== 'label') {
          return wrap([]);
        }
        return wrap(items.map((item) => item.label).filter(Boolean));
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

function createInput({ id, name, value, checked = false, labelText = '' }) {
  const label = { id: `${id}Label`, tag: 'label', text: labelText, classes: new Set() };
  return {
    id,
    tag: 'input',
    name,
    value,
    checked,
    label,
    classes: new Set(),
    triggered: []
  };
}

describe('PalettePresentation CLEAR and restore note type state', () => {
  beforeEach(() => {
    gPresentation.palette.lastRestorableColor = null;
    gPresentation.palette.lastRestorableHighlight = null;
    gPresentation.palette.suppressRbColorRemember = false;
    gPresentation.palette.keepWasForced = false;
  });

  test('CLEAR remembers and unchecks the six note-type radios, then Restore restores color and note type', () => {
    const elements = [
      createInput({ id: 'idNamedNotes', name: 'rbHighlight', value: 'Named', labelText: 'Named' }),
      createInput({ id: 'idSingleNotes', name: 'rbHighlight', value: 'Single', checked: true, labelText: 'Single' }),
      createInput({ id: 'idTinyNotes', name: 'rbHighlight', value: 'Tiny', labelText: 'Tiny' }),
      createInput({ id: 'rbBend', name: 'rbHighlight', value: 'Bend', labelText: 'Bend' }),
      createInput({ id: 'idMidiPitches', name: 'rbHighlight', value: 'MidiPitches', labelText: 'Pitch' }),
      createInput({ id: 'idMidiPitchesSingle', name: 'rbHighlight', value: 'MidiPitchesSingle', labelText: 'Multi' }),
      createInput({ id: 'rbFinger1', name: 'rbHighlight', value: 'Fingering', labelText: '1' }),
      createInput({ id: 'idRTransparent', name: 'rbColor', value: 'noteTransparent', labelText: 'Emboss' }),
      createInput({ id: 'idRChord', name: 'rbColor', value: 'noteChord', checked: true, labelText: 'Chord' }),
      { id: 'btnRestoreRbColor', tag: 'button', text: '', classes: new Set() }
    ];
    const { byId } = installJqueryStub(elements);

    PalettePresentation.initializePalettePresentation();
    PalettePresentation.clearRestorableRbHighlightsForClear();

    expect(byId.get('idSingleNotes').checked).toBe(false);
    expect(byId.get('idNamedNotes').checked).toBe(false);
    expect(byId.get('idTinyNotes').checked).toBe(false);
    expect(byId.get('rbBend').checked).toBe(false);
    expect(byId.get('idMidiPitches').checked).toBe(false);
    expect(byId.get('idMidiPitchesSingle').checked).toBe(false);
    expect(PalettePresentation.getLastRestorableRbHighlight().id).toBe('idSingleNotes');

    PalettePresentation.restoreLastRbColor();

    expect(byId.get('idRChord').checked).toBe(true);
    expect(byId.get('idRChord').triggered).toContain('change');
    expect(byId.get('idSingleNotes').checked).toBe(true);
  });

  test('Restore leaves an existing rbHighlight selection alone', () => {
    const elements = [
      createInput({ id: 'idNamedNotes', name: 'rbHighlight', value: 'Named', labelText: 'Named' }),
      createInput({ id: 'idSingleNotes', name: 'rbHighlight', value: 'Single', labelText: 'Single' }),
      createInput({ id: 'idTinyNotes', name: 'rbHighlight', value: 'Tiny', labelText: 'Tiny' }),
      createInput({ id: 'rbBend', name: 'rbHighlight', value: 'Bend', labelText: 'Bend' }),
      createInput({ id: 'idMidiPitches', name: 'rbHighlight', value: 'MidiPitches', labelText: 'Pitch' }),
      createInput({ id: 'idMidiPitchesSingle', name: 'rbHighlight', value: 'MidiPitchesSingle', labelText: 'Multi' }),
      createInput({ id: 'rbFinger1', name: 'rbHighlight', value: 'Fingering', checked: true, labelText: '1' }),
      createInput({ id: 'idRTransparent', name: 'rbColor', value: 'noteTransparent', checked: true, labelText: 'Emboss' }),
      { id: 'btnRestoreRbColor', tag: 'button', text: '', classes: new Set() }
    ];
    const { byId } = installJqueryStub(elements);

    gPresentation.palette.lastRestorableHighlight = {
      id: 'idTinyNotes',
      value: 'Tiny',
      caption: 'Tiny'
    };

    PalettePresentation.restoreLastRbColor();

    expect(byId.get('rbFinger1').checked).toBe(true);
    expect(byId.get('idTinyNotes').checked).toBe(false);
  });
});