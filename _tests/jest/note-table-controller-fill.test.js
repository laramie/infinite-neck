import {
  fillChord,
  setNotetableProviders
} from '../../NoteTableController.js';

function installFillPageJqueryStub({
  tableID = 'tbl1',
  chordValue = 'M',
  scaleValue = 'major',
  rootColor = 'noteRoot',
  chordColor = 'noteChord',
  scaleColor = 'noteScale'
} = {}, addedClasses = []) {
  globalThis.$ = (selector = '') => {
    const textSelector = `${selector || ''}`;
    const chain = {
      val() {
        if (textSelector === '#fillVisibleTablesSelect') {
          return tableID;
        }
        if (textSelector === '#dropDownChords') {
          return chordValue;
        }
        if (textSelector === '#dropDownScales') {
          return scaleValue;
        }
        if (textSelector === 'input:radio[name=rbnFillNoteRoot]:checked') {
          return rootColor;
        }
        if (textSelector === 'input:radio[name=rbnFillNoteChord]:checked') {
          return chordColor;
        }
        if (textSelector === 'input:radio[name=rbnFillNoteScale]:checked') {
          return scaleColor;
        }
        return '';
      },
      prop() {
        return false;
      },
      addClass(className) {
        addedClasses.push({ selector: textSelector, className: `${className || ''}` });
        return this;
      },
      removeClass() { return this; },
      children() { return this; },
      css() { return this; },
      hide() { return this; },
      show() { return this; },
      attr() { return this; },
      removeAttr() { return this; },
      find() { return this; },
      html() { return this; },
      each() { return this; },
      parent() { return this; }
    };
    return chain;
  };
  globalThis.jQuery = globalThis.$;
}

function createSectionNotes() {
  return {
    namedNotes: {},
    playedNotes: [],
    setNamedNote(noteName, note) {
      this.namedNotes[noteName] = note;
    },
    clearNamedNote(noteName) {
      delete this.namedNotes[noteName];
    }
  };
}

describe('NoteTableController fillChord legacy page wrapper', () => {
  test('accepts Tonal-native selectors and writes named notes by role precedence', () => {
    installFillPageJqueryStub();

    const sectionNotes = createSectionNotes();
    const section = {
      rootID: 3, // C
      getSectionNotes() {
        return sectionNotes;
      }
    };

    const song = {
      wirings: [],
      getVisibleTunings() {
        return [];
      }
    };

    setNotetableProviders({
      getCurrentSection: () => section,
      getSong: () => song,
      hideNoteClickedCaption: () => {},
      resetNoteNames: () => {},
      showBeats: () => {}
    });

    fillChord();

    expect(sectionNotes.namedNotes.C.colorClass).toBe('noteRoot');
    expect(sectionNotes.namedNotes.E.colorClass).toBe('noteChord');
    expect(sectionNotes.namedNotes.G.colorClass).toBe('noteChord');
    expect(sectionNotes.namedNotes.D.colorClass).toBe('noteScale');
  });

  test('noteHighlightSingle on chord keeps scale fill and adds transient highlight classes', () => {
    const addedClasses = [];
    installFillPageJqueryStub({ chordColor: 'noteHighlightSingle' }, addedClasses);

    const sectionNotes = createSectionNotes();
    const section = {
      rootID: 3, // C
      getSectionNotes() {
        return sectionNotes;
      }
    };

    const song = {
      wirings: [],
      getVisibleTunings() {
        return [];
      }
    };

    setNotetableProviders({
      getCurrentSection: () => section,
      getSong: () => song,
      hideNoteClickedCaption: () => {},
      resetNoteNames: () => {},
      showBeats: () => {}
    });

    fillChord();

    expect(sectionNotes.namedNotes.C.colorClass).toBe('noteRoot');
    expect(sectionNotes.namedNotes.E.colorClass).toBe('noteScale');
    expect(sectionNotes.namedNotes.G.colorClass).toBe('noteScale');

    const highlightSelectors = addedClasses
      .filter((entry) => entry.className === 'noteHighlightSingle')
      .map((entry) => entry.selector);
    expect(highlightSelectors).toContain('#tbl1 td.noteC');
    expect(highlightSelectors).toContain('#tbl1 td.noteE');
    expect(highlightSelectors).toContain('#tbl1 td.noteG');
  });
});
