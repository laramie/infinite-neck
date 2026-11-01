import {
  showHighlightsForBeatForOptions,
  setNotetableProviders
} from '../../NoteTableController.js';
import { ReplayOptions } from '../../ReplayOptions.js';
import { setColorFunctionsProviders } from '../../colorFunctions.js';
import { gUserColorDict } from '../../userColors.js';
import { Note } from '../../Note.js';

function installJqueryStub(onAddClass) {
  globalThis.$ = (selector = '') => {
    const chain = {
      removeClass() { return this; },
      attr() { return this; },
      hide() { return this; },
      hasClass() { return false; },
      addClass(className) {
        if (typeof onAddClass === 'function') {
          onAddClass(selector, className);
        }
        return this;
      },
      find(subselector = '') {
        return globalThis.$(`${selector} ${subselector}`);
      },
      show() { return this; },
      html() { return this; },
      each(callback) {
        callback.call({ style: { setProperty() {}, removeProperty() {} } });
        return this;
      }
    };
    return chain;
  };
  globalThis.jQuery = globalThis.$;
}

describe('NoteTableController observer replay color context', () => {
  beforeEach(() => {
    gUserColorDict.dict = {
      noteAutomatic: { colorClass: 'noteAutomatic' },
      note1: { colorClass: 'color-from-observed' },
      note8: { colorClass: 'color-from-current' }
    };
  });

  test('relative observer highlight replay resolves AutoColor from observed section root', () => {
    const addedClasses = [];
    installJqueryStub((selector, className) => {
      if (`${selector}`.includes('div.singleNote')) {
        addedClasses.push(className);
      }
    });

    const observedSection = {
      rootID: 3, // C
      rootIDLead: -1,
      sectionNotesByTable: {
        tblSource: {
          recordedNotes: {
            '1': [
              {
                noteName: 'C',
                styleNum: Note.STYLENUM_SINGLE,
                colorClass: 'noteAutomatic',
                midinum: '60',
                row: '0'
              }
            ]
          }
        }
      }
    };

    const currentSection = {
      rootID: 8, // F
      rootIDLead: -1,
      sectionNotesByTable: {
        tblSource: {
          recordedNotes: {}
        }
      }
    };

    const song = {
      sections: [observedSection, currentSection],
      getSections() {
        return this.sections;
      },
      getRelativeSectionWithWrap() {
        return observedSection;
      }
    };

    setNotetableProviders({
      getSong: () => song,
      getCurrentSection: () => currentSection,
      getBeatNumber: () => 1,
      hideNoteClickedCaption: () => {},
      resetNoteNames: () => {},
      setNoteClickedCaption: () => {},
      showBeats: () => {},
      turnOffHiding: () => {}
    });

    setColorFunctionsProviders({
      getSong: () => song,
      getCurrentSection: () => currentSection,
      doingAutomaticColor: () => true,
      doingAutomaticColorHighlight: () => true,
      fullRepaint: () => {}
    });

    showHighlightsForBeatForOptions(1, {
      tablename: 'tblObserver',
      listenToTablename: 'tblSource',
      relativeSection: '-1',
      type: ReplayOptions.Type.RELATIVE
    });

    expect(addedClasses).toContain('color-from-observed');
    expect(addedClasses).not.toContain('color-from-current');
  });

  test('recorded fingering replay respects hideFingering display option', () => {
    const addedClasses = [];
    installJqueryStub((selector, className) => {
      if (`${selector}`.includes('div.Fingering')) {
        addedClasses.push(className);
      }
    });

    const currentSection = {
      rootID: 3,
      rootIDLead: -1,
      sectionNotesByTable: {
        tblS1: {
          recordedNotes: {
            '1': [
              {
                noteName: 'E',
                styleNum: Note.STYLENUM_FINGERING,
                colorClass: 'noteFinger1',
                midinum: '40',
                row: '0',
                finger: '1'
              }
            ]
          }
        }
      }
    };

    const song = {
      sections: [currentSection],
      getSections() {
        return this.sections;
      }
    };

    setNotetableProviders({
      getSong: () => song,
      getCurrentSection: () => currentSection,
      getBeatNumber: () => 1,
      hideNoteClickedCaption: () => {},
      resetNoteNames: () => {},
      setNoteClickedCaption: () => {},
      showBeats: () => {},
      turnOffHiding: () => {}
    });

    setColorFunctionsProviders({
      getSong: () => song,
      getCurrentSection: () => currentSection,
      doingAutomaticColor: () => false,
      doingAutomaticColorHighlight: () => false,
      fullRepaint: () => {}
    });

    showHighlightsForBeatForOptions(1, {
      tablename: 'tblS1',
      listenToTablename: 'tblS1',
      type: ReplayOptions.Type.SELF,
      hideFingering: true
    });

    expect(addedClasses).not.toContain('FingeringPlayed');
    expect(addedClasses).not.toContain('Playback');
  });
});
